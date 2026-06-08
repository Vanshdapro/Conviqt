-- ============================================================================
-- HOTFIX (2026-06-08): Conviqt Learn "paid but locked" bug.
--
-- ROOT CAUSE: migration 010_learn_unlocks.sql was never applied to production,
-- so the learn_unlocks table + unlock_lesson / unlock_lessons_bulk RPCs did not
-- exist. The app fell back to a path that deducted credits via deduct_credits
-- but then silently failed to record the unlock (no table) — charging users
-- 10 credits per click while the lesson stayed locked forever.
--
-- This script is SAFE TO RUN MULTIPLE TIMES. It:
--   1. Creates the learn_unlocks table + RPCs (idempotent — same as 010).
--   2. Refunds every learn_unlock charge that never produced an unlock row.
--   3. Records the lessons affected users had already paid for.
--
-- Paste the WHOLE file into Supabase → SQL Editor → Run.
-- ============================================================================

-- ── 1. Table + RPCs (verbatim from migration 010, all idempotent) ───────────

create table if not exists learn_unlocks (
  email        text        not null,
  lesson_id    text        not null,
  credits_paid integer     not null default 0,
  unlocked_at  timestamptz not null default now(),
  primary key (email, lesson_id)
);

create index if not exists learn_unlocks_email_idx
  on learn_unlocks (email, unlocked_at desc);

alter table learn_unlocks enable row level security;

drop policy if exists "service_role_all_learn_unlocks" on learn_unlocks;
create policy "service_role_all_learn_unlocks" on learn_unlocks
  for all using (auth.role() = 'service_role');

create or replace function unlock_lesson(
  p_email     text,
  p_lesson_id text,
  p_cost      integer
)
returns json
language plpgsql
security definer
as $$
declare
  v_email  text := lower(trim(p_email));
  v_before integer;
  v_after  integer;
  v_exists boolean;
begin
  select exists(
    select 1 from learn_unlocks
     where email = v_email and lesson_id = p_lesson_id
  ) into v_exists;

  if v_exists then
    select credits into v_before from user_credits where email = v_email;
    return json_build_object('ok', true, 'already', true, 'remaining', coalesce(v_before, 0));
  end if;

  if p_cost <= 0 then
    insert into learn_unlocks (email, lesson_id, credits_paid)
    values (v_email, p_lesson_id, 0)
    on conflict do nothing;
    select credits into v_before from user_credits where email = v_email;
    return json_build_object('ok', true, 'already', false, 'remaining', coalesce(v_before, 0));
  end if;

  select credits into v_before
    from user_credits
   where email = v_email
   for update;

  if not found then
    return json_build_object('ok', false, 'already', false, 'remaining', 0);
  end if;

  if v_before < p_cost then
    return json_build_object('ok', false, 'already', false, 'remaining', v_before);
  end if;

  v_after := v_before - p_cost;

  update user_credits
     set credits = v_after, updated_at = now()
   where email = v_email;

  insert into learn_unlocks (email, lesson_id, credits_paid)
  values (v_email, p_lesson_id, p_cost);

  insert into credit_log (email, delta, reason, credits_before, credits_after, cost_usd)
  values (v_email, -p_cost, 'learn_unlock', v_before, v_after, 0);

  return json_build_object('ok', true, 'already', false, 'remaining', v_after);
end;
$$;

create or replace function unlock_lessons_bulk(
  p_email      text,
  p_lesson_ids text[],
  p_rate       integer
)
returns json
language plpgsql
security definer
as $$
declare
  v_email   text := lower(trim(p_email));
  v_before  integer;
  v_after   integer;
  v_count   integer;
  v_charge  integer;
  v_new_ids text[];
begin
  select coalesce(array_agg(t.id), '{}')
    into v_new_ids
    from unnest(p_lesson_ids) as t(id)
   where not exists (
     select 1 from learn_unlocks lu
      where lu.email = v_email and lu.lesson_id = t.id
   );

  v_count := coalesce(array_length(v_new_ids, 1), 0);

  if v_count = 0 then
    select credits into v_before from user_credits where email = v_email;
    return json_build_object('ok', true, 'unlocked', 0, 'charged', 0, 'remaining', coalesce(v_before, 0));
  end if;

  v_charge := v_count * greatest(p_rate, 0);

  select credits into v_before
    from user_credits
   where email = v_email
   for update;

  if not found then
    return json_build_object('ok', false, 'unlocked', 0, 'charged', v_charge, 'remaining', 0);
  end if;

  if v_before < v_charge then
    return json_build_object('ok', false, 'unlocked', 0, 'charged', v_charge, 'remaining', v_before);
  end if;

  v_after := v_before - v_charge;

  update user_credits
     set credits = v_after, updated_at = now()
   where email = v_email;

  insert into learn_unlocks (email, lesson_id, credits_paid)
  select v_email, id, p_rate from unnest(v_new_ids) as id
  on conflict do nothing;

  if v_charge > 0 then
    insert into credit_log (email, delta, reason, credits_before, credits_after, cost_usd)
    values (v_email, -v_charge, 'learn_unlock_all', v_before, v_after, 0);
  end if;

  return json_build_object('ok', true, 'unlocked', v_count, 'charged', v_charge, 'remaining', v_after);
end;
$$;

-- ── 2. Refund every learn_unlock charge that bought nothing ─────────────────
-- For each user, count credits they were charged under reason 'learn_unlock' /
-- 'learn_unlock_all' MINUS what they were already refunded, MINUS what they now
-- legitimately own (credits_paid on real unlock rows). Refund the difference.
-- Because step 1 just created the table empty, every past charge is owed back.

with charged as (
  select email, coalesce(sum(-delta), 0) as paid
    from credit_log
   where reason in ('learn_unlock', 'learn_unlock_all')
   group by email
),
refunded as (
  select email, coalesce(sum(delta), 0) as refunded
    from credit_log
   where reason = 'learn_unlock_refund'
   group by email
),
owned as (
  select email, coalesce(sum(credits_paid), 0) as kept
    from learn_unlocks
   group by email
),
owed as (
  select c.email,
         c.paid - coalesce(r.refunded, 0) - coalesce(o.kept, 0) as refund_due
    from charged c
    left join refunded r on r.email = c.email
    left join owned o   on o.email = c.email
)
select add_credits(email, refund_due, 'learn_unlock_refund')
  from owed
 where refund_due > 0;

-- ── 3. (Optional) grant the lessons the tester already paid to unlock ───────
-- The reporter paid 10cr x5 testing 'fs-balance-sheet'. Give it to them free.
insert into learn_unlocks (email, lesson_id, credits_paid)
values ('prabhaagarwal0783@gmail.com', 'fs-balance-sheet', 0)
on conflict do nothing;

-- ── Verify ─────────────────────────────────────────────────────────────────
-- select * from learn_unlocks order by unlocked_at desc;
-- select email, credits from user_credits where email = 'prabhaagarwal0783@gmail.com';
