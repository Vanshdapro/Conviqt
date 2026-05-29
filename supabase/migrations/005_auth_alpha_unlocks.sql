-- Migration 005: Alpha Tracker per-publication unlocks.
--
-- Users pay credits ONCE per Alpha "publication" (identified by run_id) to
-- reveal that batch of picks. After unlocking a run_id they can re-view those
-- picks for free forever. When a NEW publication (new run_id) is generated,
-- they must unlock again — but only for the new content.
--
-- This pairs with Supabase Auth: the email recorded here is always a verified,
-- session-derived email (never client-supplied).

-- ── Table ──────────────────────────────────────────────────────────────────

create table if not exists alpha_unlocks (
  email        text        not null,
  run_id       text        not null,
  credits_paid integer     not null default 0,
  unlocked_at  timestamptz not null default now(),
  primary key (email, run_id)
);

create index if not exists alpha_unlocks_email_idx
  on alpha_unlocks (email, unlocked_at desc);

alter table alpha_unlocks enable row level security;

create policy "service_role_all_unlocks" on alpha_unlocks
  for all using (auth.role() = 'service_role');

-- ── unlock_alpha ───────────────────────────────────────────────────────────
-- Atomically unlock the given publication (run_id) for a user.
--   - If already unlocked  → no charge, returns { ok:true, already:true }.
--   - If enough credits     → deduct cost, log, insert unlock row.
--   - If insufficient       → returns { ok:false, already:false, remaining }.
-- Returns JSON: { ok, already, remaining }

create or replace function unlock_alpha(
  p_email  text,
  p_run_id text,
  p_cost   integer
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
  -- Already unlocked this publication? Free re-view.
  select exists(
    select 1 from alpha_unlocks
     where email = v_email and run_id = p_run_id
  ) into v_exists;

  if v_exists then
    select credits into v_before from user_credits where email = v_email;
    return json_build_object('ok', true, 'already', true, 'remaining', coalesce(v_before, 0));
  end if;

  -- Lock the credit row for an atomic deduct.
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

  insert into alpha_unlocks (email, run_id, credits_paid)
  values (v_email, p_run_id, p_cost);

  insert into credit_log (email, delta, reason, credits_before, credits_after, cost_usd)
  values (v_email, -p_cost, 'alpha_unlock', v_before, v_after, 0);

  return json_build_object('ok', true, 'already', false, 'remaining', v_after);
end;
$$;
