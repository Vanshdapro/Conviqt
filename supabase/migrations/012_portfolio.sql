-- Migration 012: Portfolio Auditor — the deep multi-agent portfolio audit.
--
-- Two tables:
--   portfolios        — a saved basket of holdings (one user can have many).
--                       holdings is a jsonb array of { ticker, shares, costBasis? }.
--   portfolio_audits  — append-only audit history for a portfolio. Each row is
--                       one full audit run: the cached result payload + a
--                       denormalized health_score so we can chart health over
--                       time without rehydrating the whole jsonb.
--
-- All writes go through the service-role admin client (server-side); the route
-- guarantees the email comes from the verified session, never the client.
-- Re-viewing a stored audit is a pure DB read (free) — only a fresh run spends
-- credits + API budget.

-- ── Portfolios ───────────────────────────────────────────────────────────────

create table if not exists portfolios (
  id          uuid         not null default gen_random_uuid() primary key,
  email       text         not null,
  name        text         not null default 'My Portfolio',
  holdings    jsonb        not null default '[]'::jsonb,
  created_at  timestamptz  not null default now(),
  updated_at  timestamptz  not null default now()
);

create index if not exists portfolios_email_idx
  on portfolios (email, updated_at desc);

-- ── Audit history ──────────────────────────────────────────────────────────────

create table if not exists portfolio_audits (
  id            uuid         not null default gen_random_uuid() primary key,
  portfolio_id  uuid         not null references portfolios (id) on delete cascade,
  email         text         not null,
  result        jsonb        not null,
  health_score  integer      not null default 0 check (health_score between 0 and 100),
  est_cost_usd  numeric(8,4) not null default 0,
  created_at    timestamptz  not null default now()
);

create index if not exists portfolio_audits_portfolio_idx
  on portfolio_audits (portfolio_id, created_at desc);

create index if not exists portfolio_audits_email_idx
  on portfolio_audits (email, created_at desc);

-- ── RLS ──────────────────────────────────────────────────────────────────────
-- All access is through the service-role admin client (server-side), which
-- bypasses RLS. We still enable RLS with no anon policy so a leaked anon key
-- can never read another user's holdings or audits.

alter table portfolios       enable row level security;
alter table portfolio_audits enable row level security;

create policy "service_role_all_portfolios" on portfolios
  for all using (auth.role() = 'service_role');

create policy "service_role_all_portfolio_audits" on portfolio_audits
  for all using (auth.role() = 'service_role');

-- ── updated_at trigger (reuses fn from migration 003/004/007) ─────────────────

create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists portfolios_updated_at on portfolios;
create trigger portfolios_updated_at
  before update on portfolios
  for each row execute function update_updated_at_column();
