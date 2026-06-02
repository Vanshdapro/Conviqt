-- Migration 016: programmatic API access (Deliverable 10 — the Developer tier).
--
-- Lets developers call the Council pipeline over a REST API
-- (POST /v1/analyze) using a bearer key, billed against a monthly call
-- quota rather than the consumer credit ledger.
--
-- Two-table model, deliberately decoupled:
--   developer_accounts — the per-developer ENTITLEMENT (tier + monthly call
--                        quota + rolling usage window). One row per email.
--                        Provisioned/updated by the Stripe webhook.
--   api_keys           — the CREDENTIALS. Many keys per developer. We store
--                        only a SHA-256 hash of the secret; the plaintext is
--                        shown to the user exactly once at creation time.
--   api_call_log       — one row per billed call, for usage analytics and
--                        abuse forensics.
--
-- Quota lives on the developer (not the key) because the subscription is
-- per-developer — keys are just rotatable credentials that share the quota.
-- consume_api_call() enforces it atomically with a row lock so concurrent
-- calls can never oversell the quota.

-- ── Tables ───────────────────────────────────────────────────────────────────

create table if not exists developer_accounts (
  email                  text        not null primary key,
  tier                   text        not null default 'free_dev',  -- free_dev | dev_500 | dev_2000
  monthly_quota          integer     not null default 25  check (monthly_quota >= 0),
  calls_used             integer     not null default 0   check (calls_used >= 0),
  period_start           timestamptz not null default now(),
  period_end             timestamptz not null default (now() + interval '1 month'),
  status                 text        not null default 'active',    -- active | past_due | canceled
  stripe_subscription_id text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create table if not exists api_keys (
  id           bigserial   primary key,
  email        text        not null,
  key_hash     text        not null unique,   -- sha256(plaintext), hex
  key_prefix   text        not null,          -- first chars, safe to display (e.g. "cvqt_live_8f3a…")
  name         text        not null default 'default',
  active       boolean     not null default true,
  created_at   timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at   timestamptz
);

create index if not exists api_keys_email_idx on api_keys (email, created_at desc);
create index if not exists api_keys_active_idx on api_keys (key_hash) where active;

create table if not exists api_call_log (
  id          bigserial   primary key,
  key_id      bigint      not null,
  email       text        not null,
  endpoint    text        not null default 'analyze',
  ticker      text,
  status      text        not null,           -- ok | quota_exceeded | error
  cost_usd    numeric(8, 4) not null default 0,
  latency_ms  integer,
  created_at  timestamptz not null default now()
);

create index if not exists api_call_log_email_idx on api_call_log (email, created_at desc);
create index if not exists api_call_log_key_idx   on api_call_log (key_id, created_at desc);

-- ── RLS ──────────────────────────────────────────────────────────────────────
-- Same posture as the credit tables: only the service role touches these.
-- All app access goes through the admin client + SECURITY DEFINER functions.

alter table developer_accounts enable row level security;
alter table api_keys           enable row level security;
alter table api_call_log       enable row level security;

create policy "service_role_all_dev_accounts" on developer_accounts
  for all using (auth.role() = 'service_role');

create policy "service_role_all_api_keys" on api_keys
  for all using (auth.role() = 'service_role');

create policy "service_role_all_api_call_log" on api_call_log
  for all using (auth.role() = 'service_role');

-- ── updated_at trigger ───────────────────────────────────────────────────────

create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists developer_accounts_updated_at on developer_accounts;
create trigger developer_accounts_updated_at
  before update on developer_accounts
  for each row execute function update_updated_at_column();

-- ── Functions ────────────────────────────────────────────────────────────────

-- ensure_developer_account: idempotently create a free-tier developer row so a
-- newly-created key can make trial calls. No-op if the row already exists.
-- Returns the (possibly newly created) account as JSON.
create or replace function ensure_developer_account(p_email text)
returns json
language plpgsql
security definer
as $$
declare
  v_row developer_accounts%rowtype;
begin
  select * into v_row from developer_accounts where email = lower(trim(p_email));
  if not found then
    insert into developer_accounts (email)
    values (lower(trim(p_email)))
    returning * into v_row;
  end if;

  return json_build_object(
    'email',         v_row.email,
    'tier',          v_row.tier,
    'monthly_quota', v_row.monthly_quota,
    'calls_used',    v_row.calls_used,
    'period_end',    v_row.period_end,
    'status',        v_row.status
  );
end;
$$;

-- set_developer_tier: provision or upgrade a developer's entitlement. Called by
-- the Stripe webhook on checkout / renewal. Resets the usage window so a fresh
-- paid month starts at zero. Idempotent on (email, tier, subscription) for a
-- given period — calling twice in one cycle just refreshes the window.
create or replace function set_developer_tier(
  p_email          text,
  p_tier           text,
  p_monthly_quota  integer,
  p_subscription   text default null,
  p_status         text default 'active'
)
returns void
language plpgsql
security definer
as $$
begin
  insert into developer_accounts (
    email, tier, monthly_quota, calls_used,
    period_start, period_end, status, stripe_subscription_id
  )
  values (
    lower(trim(p_email)), p_tier, p_monthly_quota, 0,
    now(), now() + interval '1 month', p_status, p_subscription
  )
  on conflict (email) do update
    set tier                   = excluded.tier,
        monthly_quota          = excluded.monthly_quota,
        calls_used             = 0,
        period_start           = now(),
        period_end             = now() + interval '1 month',
        status                 = excluded.status,
        stripe_subscription_id = coalesce(excluded.stripe_subscription_id, developer_accounts.stripe_subscription_id),
        updated_at             = now();
end;
$$;

-- set_developer_status: flip status without touching quota/usage (cancellation,
-- past_due). A canceled/past_due account fails closed in consume_api_call.
create or replace function set_developer_status(p_email text, p_status text)
returns void
language plpgsql
security definer
as $$
begin
  update developer_accounts
     set status = p_status, updated_at = now()
   where email = lower(trim(p_email));
end;
$$;

-- consume_api_call: the atomic billing gate for an API request.
--   1. resolve an ACTIVE key by hash → owner email + key id
--   2. lock the owner's developer row
--   3. roll the monthly window if it has elapsed (usage back to 0)
--   4. fail closed on non-active subscription status
--   5. enforce the quota, increment usage, stamp last_used_at
-- Returns JSON: { ok, reason, email, key_id, tier, remaining, quota, reset_at }.
-- reason ∈ invalid_key | account_suspended | quota_exceeded | ok
create or replace function consume_api_call(p_key_hash text)
returns json
language plpgsql
security definer
as $$
declare
  v_key     api_keys%rowtype;
  v_acct    developer_accounts%rowtype;
begin
  select * into v_key
    from api_keys
   where key_hash = p_key_hash and active
   limit 1;

  if not found then
    return json_build_object('ok', false, 'reason', 'invalid_key');
  end if;

  -- Provision a free-tier entitlement on first use if somehow missing.
  select * into v_acct from developer_accounts where email = v_key.email for update;
  if not found then
    insert into developer_accounts (email) values (v_key.email)
    returning * into v_acct;
  end if;

  -- Roll the usage window forward if the period elapsed.
  if now() >= v_acct.period_end then
    update developer_accounts
       set calls_used   = 0,
           period_start = now(),
           period_end   = now() + interval '1 month',
           updated_at   = now()
     where email = v_acct.email
    returning * into v_acct;
  end if;

  if v_acct.status <> 'active' then
    return json_build_object(
      'ok', false, 'reason', 'account_suspended',
      'email', v_key.email, 'tier', v_acct.tier
    );
  end if;

  if v_acct.calls_used >= v_acct.monthly_quota then
    return json_build_object(
      'ok', false, 'reason', 'quota_exceeded',
      'email', v_key.email, 'key_id', v_key.id, 'tier', v_acct.tier,
      'remaining', 0, 'quota', v_acct.monthly_quota,
      'reset_at', v_acct.period_end
    );
  end if;

  update developer_accounts
     set calls_used = calls_used + 1, updated_at = now()
   where email = v_acct.email;

  update api_keys
     set last_used_at = now()
   where id = v_key.id;

  return json_build_object(
    'ok', true, 'reason', 'ok',
    'email', v_key.email, 'key_id', v_key.id, 'tier', v_acct.tier,
    'remaining', v_acct.monthly_quota - v_acct.calls_used - 1,
    'quota', v_acct.monthly_quota,
    'reset_at', v_acct.period_end
  );
end;
$$;
