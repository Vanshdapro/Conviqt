-- Migration 004: credit ledger for the usage-based billing system.
--
-- Every user (free and paid) gets a row in user_credits.
-- Every credit movement (purchase, deduction, monthly reset) is logged in credit_log.
--
-- Three Postgres functions handle mutations atomically:
--   deduct_credits          — subtract credits before a pipeline run
--   add_credits             — top-up after a Stripe purchase
--   reset_subscription_credits — monthly renewal for Max plans (25 % rollover cap)
--   grant_free_credits_if_due  — give free users their monthly 50 credits if reset is due

-- ── Tables ───────────────────────────────────────────────────────────────────

create table if not exists user_credits (
  email              text        not null primary key,
  credits            integer     not null default 0   check (credits >= 0),
  plan               text        not null default 'free',
  credits_reset_at   timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create table if not exists credit_log (
  id             bigserial   primary key,
  email          text        not null,
  delta          integer     not null,   -- positive = added, negative = deducted
  reason         text        not null,
  credits_before integer,
  credits_after  integer,
  cost_usd       numeric(8, 4) not null default 0,
  created_at     timestamptz not null default now()
);

create index if not exists credit_log_email_idx
  on credit_log (email, created_at desc);

-- ── RLS ──────────────────────────────────────────────────────────────────────

alter table user_credits enable row level security;
alter table credit_log   enable row level security;

create policy "service_role_all_credits" on user_credits
  for all using (auth.role() = 'service_role');

create policy "anon_read_own_credits" on user_credits
  for select using (true);  -- app logic enforces email ownership

create policy "service_role_all_log" on credit_log
  for all using (auth.role() = 'service_role');

-- ── updated_at trigger ───────────────────────────────────────────────────────

-- Reuse the function from migration 003 if it already exists.
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists user_credits_updated_at on user_credits;
create trigger user_credits_updated_at
  before update on user_credits
  for each row execute function update_updated_at_column();

-- ── Functions ────────────────────────────────────────────────────────────────

-- deduct_credits: atomically subtract credits and log.
-- Returns JSON: { ok: true|false, remaining: integer }
create or replace function deduct_credits(
  p_email    text,
  p_credits  integer,
  p_reason   text,
  p_cost_usd numeric default 0
)
returns json
language plpgsql
security definer
as $$
declare
  v_before integer;
  v_after  integer;
begin
  select credits into v_before
    from user_credits
   where email = lower(trim(p_email))
   for update;

  if not found then
    return json_build_object('ok', false, 'remaining', 0);
  end if;

  if v_before < p_credits then
    return json_build_object('ok', false, 'remaining', v_before);
  end if;

  v_after := v_before - p_credits;

  update user_credits
     set credits = v_after, updated_at = now()
   where email = lower(trim(p_email));

  insert into credit_log (email, delta, reason, credits_before, credits_after, cost_usd)
  values (lower(trim(p_email)), -p_credits, p_reason, v_before, v_after, p_cost_usd);

  return json_build_object('ok', true, 'remaining', v_after);
end;
$$;

-- add_credits: upsert the user row and add credits.
-- Creates the row with the given plan if it doesn't exist yet.
create or replace function add_credits(
  p_email    text,
  p_credits  integer,
  p_reason   text,
  p_plan     text default null
)
returns void
language plpgsql
security definer
as $$
declare
  v_before integer;
  v_after  integer;
begin
  insert into user_credits (email, credits, plan, updated_at)
  values (
    lower(trim(p_email)),
    p_credits,
    coalesce(p_plan, 'free'),
    now()
  )
  on conflict (email) do update
    set credits    = user_credits.credits + p_credits,
        plan       = coalesce(p_plan, user_credits.plan),
        updated_at = now()
  returning credits into v_after;

  v_before := v_after - p_credits;

  insert into credit_log (email, delta, reason, credits_before, credits_after)
  values (lower(trim(p_email)), p_credits, p_reason, v_before, v_after);
end;
$$;

-- reset_subscription_credits: monthly renewal with 25 % rollover cap.
-- Used by the Stripe webhook on invoice.payment_succeeded (billing_reason = subscription_cycle).
create or replace function reset_subscription_credits(
  p_email           text,
  p_monthly_credits integer,
  p_plan            text
)
returns void
language plpgsql
security definer
as $$
declare
  v_before       integer;
  v_rollover_cap integer;
  v_rollover     integer;
  v_new_total    integer;
begin
  select coalesce(credits, 0) into v_before
    from user_credits
   where email = lower(trim(p_email));

  -- 25 % of the monthly allowance can roll over
  v_rollover_cap := p_monthly_credits / 4;
  v_rollover     := least(coalesce(v_before, 0), v_rollover_cap);
  v_new_total    := p_monthly_credits + v_rollover;

  insert into user_credits (email, credits, plan, credits_reset_at, updated_at)
  values (
    lower(trim(p_email)),
    v_new_total,
    p_plan,
    now() + interval '1 month',
    now()
  )
  on conflict (email) do update
    set credits          = v_new_total,
        plan             = p_plan,
        credits_reset_at = now() + interval '1 month',
        updated_at       = now();

  insert into credit_log (email, delta, reason, credits_before, credits_after)
  values (
    lower(trim(p_email)),
    v_new_total - coalesce(v_before, 0),
    'subscription_monthly_reset',
    coalesce(v_before, 0),
    v_new_total
  );
end;
$$;

-- grant_free_credits_if_due: initialise a new free user OR refresh their
-- monthly 50 credits once credits_reset_at has passed.
-- Safe to call on every first chat request — no-ops if not due.
create or replace function grant_free_credits_if_due(p_email text)
returns void
language plpgsql
security definer
as $$
declare
  v_row user_credits%rowtype;
begin
  select * into v_row
    from user_credits
   where email = lower(trim(p_email));

  if not found then
    -- Brand-new user: create with 50 free credits
    insert into user_credits (email, credits, plan, credits_reset_at)
    values (
      lower(trim(p_email)),
      50,
      'free',
      date_trunc('month', now()) + interval '1 month'
    );

    insert into credit_log (email, delta, reason, credits_before, credits_after)
    values (lower(trim(p_email)), 50, 'free_tier_init', 0, 50);

  elsif v_row.plan = 'free'
    and v_row.credits_reset_at is not null
    and now() >= v_row.credits_reset_at
  then
    -- Monthly refresh due
    update user_credits
       set credits          = 50,
           credits_reset_at = date_trunc('month', now()) + interval '1 month',
           updated_at       = now()
     where email = lower(trim(p_email));

    insert into credit_log (email, delta, reason, credits_before, credits_after)
    values (lower(trim(p_email)), 50 - v_row.credits, 'free_tier_monthly_reset', v_row.credits, 50);
  end if;
end;
$$;
