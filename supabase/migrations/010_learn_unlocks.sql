-- Migration 010: Conviqt Learn — per-lesson unlocks (pay once, own it forever).
--
-- Lessons are static, in-repo content (no per-open API cost). The ONLY paid
-- moment is a one-time credit unlock: a user pays credits ONCE for a lesson and
-- can re-open it free forever. Unlocking "everything" just unlocks each
-- currently-locked lesson in one atomic charge — lessons added later are fresh
-- unlocks, never retroactively granted. This mirrors alpha_unlocks (migration
-- 005); the email recorded here is always a verified, session-derived email.

-- ── Table ────────────────────────────────────────────────────────────────────

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

create policy "service_role_all_learn_unlocks" on learn_unlocks
  for all using (auth.role() = 'service_role');

-- ── unlock_lesson ────────────────────────────────────────────────────────────
-- Atomically unlock a single lesson for a user.
--   - Already unlocked → no charge, { ok:true, already:true }.
--   - Enough credits    → deduct cost, log, insert unlock row.
--   - Insufficient      → { ok:false, already:false, remaining }.
-- Returns JSON: { ok, already, remaining }

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

  -- Free lessons cost 0 — record the unlock without touching credits.
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

-- ── unlock_lessons_bulk ──────────────────────────────────────────────────────
-- "Unlock everything": unlock every requested lesson the user does NOT already
-- own, charging p_rate credits per newly-unlocked lesson, atomically.
--   - Nothing left to unlock → { ok:true, unlocked:0, charged:0, remaining }.
--   - Enough credits         → deduct count*rate, insert rows, one log entry.
--   - Insufficient           → { ok:false, unlocked:0, charged, remaining }.
-- The caller passes the authoritative catalog id list — the client never picks.
-- Returns JSON: { ok, unlocked, charged, remaining }

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
  -- Ids the user doesn't already own.
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
