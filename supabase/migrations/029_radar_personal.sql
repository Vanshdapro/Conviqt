-- Migration 029: the Radar — per-user personalized radar (lives inside Portfolio).
--
-- "What's coming for your money, what's at stake, and what each outcome would
-- mean." One CURRENT radar per (email, portfolio) — the upcoming-events horizon
-- is short-lived, so re-generation upserts the single row rather than archiving
-- (the market-wide radar lives in feed_cache; only the personalized one needs a
-- per-user home). The `payload` JSONB holds the full PersonalRadar — the matched
-- events + the model's plain-English stakes/outcome framings (orientation, never
-- alpha).
--
-- Access is server-only via the service-role admin client (same pattern as
-- portfolios / lens_daily_briefs / feed_cache). So — exactly like migration 028 —
-- RLS is enabled with ONLY a service_role policy; the public anon key reads zero
-- rows.

create table if not exists portfolio_radar (
  id            uuid primary key default gen_random_uuid(),
  user_email    text not null,
  portfolio_id  text not null,
  payload       jsonb not null,
  generated_at  timestamptz not null default now(),
  created_at    timestamptz not null default now()
);

-- One CURRENT radar per user/portfolio; re-generation upserts this row.
create unique index if not exists portfolio_radar_unique
  on portfolio_radar (user_email, portfolio_id);

-- "this user's radar for this portfolio" — the lookup path.
create index if not exists portfolio_radar_lookup
  on portfolio_radar (user_email, portfolio_id);

alter table portfolio_radar enable row level security;

-- Server-only access (service role bypasses RLS). No anon/auth policy → the
-- public anon key reads nothing, matching subscribers / portfolios / lens.
drop policy if exists "service_role_all" on portfolio_radar;
create policy "service_role_all" on portfolio_radar
  for all to service_role using (true) with check (true);
