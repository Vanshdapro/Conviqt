-- Migration 016: Paper Trade Desk — public leaderboard.
--
-- Spins the academy's live paper desk (migration 011, practice_paper_positions)
-- out into a standalone, public-facing competition. Every trader runs a notional
-- $100k account; the leaderboard ranks them by a risk-adjusted weekly return
-- (a Sharpe-style score), not raw P&L, so smart sizing beats lottery tickets.
--
-- Two tables:
--   leaderboard_profiles  — one row per trader. Opt-in is explicit: a trader only
--                           appears on the PUBLIC board after choosing a handle
--                           and flipping opted_in. The handle (not the email) is
--                           the only identity ever shown publicly — emails never
--                           leave the server.
--   leaderboard_weekly    — frozen standings for a COMPLETED week. The live week
--                           is computed on the fly from positions; once a week
--                           ends we snapshot the final ranking here so the
--                           "top trader of the week" badge and historical weeks
--                           stay stable even as positions keep changing.
--
-- No model spend touches any of this — standings are pure SQL aggregation over
-- practice_paper_positions, so the leaderboard never dents the API budget.

-- ── Trader profiles (public identity + opt-in) ───────────────────────────────

create table if not exists leaderboard_profiles (
  email         text         not null primary key,
  handle        text         not null,
  display_name  text,
  opted_in      boolean      not null default false,
  created_at    timestamptz  not null default now(),
  updated_at    timestamptz  not null default now()
);

-- Handles are public and must be unique (case-insensitive). Enforced on the
-- normalized lower-case form so "Quant" and "quant" can't collide.
create unique index if not exists leaderboard_profiles_handle_key
  on leaderboard_profiles (lower(handle));

create index if not exists leaderboard_profiles_opted_in_idx
  on leaderboard_profiles (opted_in) where opted_in;

-- ── Frozen weekly standings ──────────────────────────────────────────────────

create table if not exists leaderboard_weekly (
  week_start    date         not null,           -- Monday (UTC) the week opened
  email         text         not null,
  handle        text         not null,
  display_name  text,
  sharpe        numeric(10,4) not null default 0, -- risk-adjusted score (the rank key)
  return_pct    numeric(10,4) not null default 0, -- notional account return % for the week
  trades        integer      not null default 0,  -- qualifying positions opened in the week
  rank          integer      not null default 0,  -- 1 = top trader of the week
  featured      boolean      not null default false, -- rank 1 gets the featured badge
  finalized_at  timestamptz  not null default now(),
  primary key (week_start, email)
);

create index if not exists leaderboard_weekly_rank_idx
  on leaderboard_weekly (week_start, rank);

-- ── RLS ──────────────────────────────────────────────────────────────────────
-- All writes go through the service-role admin client (server-side), which
-- bypasses RLS. The leaderboard is a PUBLIC surface, so both tables get a
-- permissive anon SELECT — but note the server only ever projects handle /
-- display_name / scores to clients, never the email column.

alter table leaderboard_profiles enable row level security;
alter table leaderboard_weekly    enable row level security;

create policy "service_role_all_leaderboard_profiles" on leaderboard_profiles
  for all using (auth.role() = 'service_role');

create policy "anon_read_leaderboard_profiles" on leaderboard_profiles
  for select using (true);

create policy "service_role_all_leaderboard_weekly" on leaderboard_weekly
  for all using (auth.role() = 'service_role');

create policy "anon_read_leaderboard_weekly" on leaderboard_weekly
  for select using (true);

-- ── updated_at trigger (reuses fn from migration 003/004/007/011/012) ─────────

create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists leaderboard_profiles_updated_at on leaderboard_profiles;
create trigger leaderboard_profiles_updated_at
  before update on leaderboard_profiles
  for each row execute function update_updated_at_column();
