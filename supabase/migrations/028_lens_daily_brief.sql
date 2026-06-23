-- Migration 028: the Lens — per-user daily brief (lives inside Portfolio).
--
-- "What happened to your money today, why, what it means, what to watch."
-- One row per (email, portfolio, UTC day). Generated on first open each day and
-- cached for the day. The `brief` JSONB holds the full LensBrief — deterministic
-- numbers + the model's plain-English synthesis + the receipts/flag thread.
--
-- Access is server-only via the service-role admin client (same pattern as
-- portfolios / feed_cache). So — exactly like migration 027 — RLS is enabled
-- with ONLY a service_role policy; the public anon key reads zero rows.

create table if not exists lens_daily_briefs (
  id            uuid primary key default gen_random_uuid(),
  email         text not null,
  portfolio_id  uuid not null,
  brief_date    date not null,
  brief         jsonb not null,
  est_cost_usd  numeric(10, 6) not null default 0,
  created_at    timestamptz not null default now()
);

-- One brief per user/portfolio/day; re-generation upserts this row.
create unique index if not exists lens_daily_briefs_unique
  on lens_daily_briefs (email, portfolio_id, brief_date);

-- "this user's recent briefs, newest first" — the daily thread.
create index if not exists lens_daily_briefs_thread
  on lens_daily_briefs (email, brief_date desc);

alter table lens_daily_briefs enable row level security;

-- Server-only access (service role bypasses RLS). No anon/auth policy → the
-- public anon key reads nothing, matching subscribers / portfolios.
drop policy if exists "service_role_all" on lens_daily_briefs;
create policy "service_role_all" on lens_daily_briefs
  for all to service_role using (true) with check (true);
