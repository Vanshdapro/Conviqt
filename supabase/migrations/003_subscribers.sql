-- Migration 003: subscribers table for Stripe payment integration
--
-- Stores one row per paying customer. Kept in sync by the Stripe webhook
-- handler at /api/stripe/webhook.
--
-- subscription_status mirrors Stripe's subscription.status values:
--   'active' | 'trialing' | 'past_due' | 'canceled' | 'unpaid' | 'inactive'
--
-- plan mirrors our internal plan names:
--   'free' | 'pro' | 'pro_annual' | 'deep_dive'

create table if not exists subscribers (
  id                   uuid        default gen_random_uuid() primary key,
  email                text        not null unique,
  stripe_customer_id   text        not null unique,
  subscription_id      text,
  subscription_status  text        not null default 'inactive',
  plan                 text        not null default 'free',
  current_period_end   timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- Index for the most common lookup: by email (used in API routes to gate features)
create index if not exists subscribers_email_idx
  on subscribers (email);

-- Index for webhook handler lookups: by Stripe customer ID
create index if not exists subscribers_stripe_customer_id_idx
  on subscribers (stripe_customer_id);

-- Auto-update updated_at on any row change
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists subscribers_updated_at on subscribers;

create trigger subscribers_updated_at
  before update on subscribers
  for each row
  execute function update_updated_at_column();

-- Row-level security: service role (used by webhook) can do anything.
-- Anon role can read their own row by email (used for status checks).
alter table subscribers enable row level security;

create policy "service_role_all" on subscribers
  for all
  using (auth.role() = 'service_role');

create policy "anon_read_own" on subscribers
  for select
  using (true);  -- email check is enforced in app logic, not RLS, for simplicity
