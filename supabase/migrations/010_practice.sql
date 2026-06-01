-- Migration 010: Conviqt Academy — Practice.
--
-- Practice is where the Learn curriculum gets executed under pressure: learners
-- trade through real historical market episodes, build PM-grade theses that an
-- AI grades, and run a live paper account on real tickers.
--
-- Tables:
--   practice_drill_cache      — pre-authored / pre-fetched drill modules (the
--                               historical price series + events for episode
--                               drills). Keyed by the static curriculum drill_id.
--                               Episode opens replay cached JSON for free, so
--                               running the simulator never triggers model spend.
--   practice_progress         — one row per (email, drill_id): best score, stars,
--                               XP awarded once, best P&L. XP/level/rank derive
--                               from these rows (single source of truth).
--   practice_thesis_feedback  — history of AI thesis grades (one row per graded
--                               submission) so a learner can see how their
--                               reasoning improved over time.
--   practice_paper_positions  — the live paper-trading account: real tickers,
--                               quote-snapshotted entries with a source URL.

-- ── Drill cache (episode price series + authored modules) ─────────────────────

create table if not exists practice_drill_cache (
  drill_id    text         not null primary key,
  kind        text         not null,            -- 'episode' | 'thesis'
  module      jsonb        not null,
  model       text,
  cost_usd    numeric(8,4) not null default 0,
  created_at  timestamptz  not null default now(),
  updated_at  timestamptz  not null default now()
);

-- ── Per-user progress ────────────────────────────────────────────────────────

create table if not exists practice_progress (
  email         text        not null,
  drill_id      text        not null,
  best_score    integer     not null default 0  check (best_score between 0 and 100),
  best_stars    integer     not null default 0  check (best_stars between 0 and 3),
  best_pnl_pct  numeric(8,2),                    -- best realised P&L %, null for thesis drills
  xp_awarded    integer     not null default 0  check (xp_awarded >= 0),
  attempts      integer     not null default 0  check (attempts >= 0),
  completed_at  timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  primary key (email, drill_id)
);

create index if not exists practice_progress_email_idx
  on practice_progress (email, completed_at desc);

-- ── AI thesis feedback history ────────────────────────────────────────────────

create table if not exists practice_thesis_feedback (
  id          uuid        not null default gen_random_uuid() primary key,
  email       text        not null,
  drill_id    text        not null,
  submission  jsonb       not null,             -- the learner's structured thesis
  grade       jsonb       not null,             -- the AI rubric grade
  overall     integer     not null default 0,   -- denormalised overall score for quick listing
  created_at  timestamptz not null default now()
);

create index if not exists practice_thesis_feedback_email_idx
  on practice_thesis_feedback (email, created_at desc);

-- ── Live paper-trading account ────────────────────────────────────────────────

create table if not exists practice_paper_positions (
  id            uuid         not null default gen_random_uuid() primary key,
  email         text         not null,
  ticker        text         not null,
  qty           numeric(16,4) not null check (qty > 0),
  entry_price   numeric(16,4) not null check (entry_price > 0),
  entry_source  text,                            -- citation URL for the entry quote
  entry_as_of   text,                            -- human freshness label for the entry quote
  stop_price    numeric(16,4),
  target_price  numeric(16,4),
  thesis        text,                            -- one-line rationale (optional)
  last_mark     numeric(16,4),                   -- most recent mark-to-market price
  last_mark_src text,                            -- citation URL for the last mark
  last_mark_at  timestamptz,
  status        text         not null default 'open',  -- 'open' | 'closed'
  exit_price    numeric(16,4),
  closed_at     timestamptz,
  opened_at     timestamptz  not null default now(),
  created_at    timestamptz  not null default now()
);

create index if not exists practice_paper_positions_email_idx
  on practice_paper_positions (email, status, opened_at desc);

-- ── RLS ──────────────────────────────────────────────────────────────────────
-- All access is through the service-role admin client (server-side), which
-- bypasses RLS. The drill cache is content (not user-specific) so it gets a
-- permissive anon read for possible future anon access.

alter table practice_drill_cache     enable row level security;
alter table practice_progress        enable row level security;
alter table practice_thesis_feedback enable row level security;
alter table practice_paper_positions enable row level security;

create policy "service_role_all_practice_drill_cache" on practice_drill_cache
  for all using (auth.role() = 'service_role');

create policy "anon_read_practice_drill_cache" on practice_drill_cache
  for select using (true);  -- drill content is not user-specific

create policy "service_role_all_practice_progress" on practice_progress
  for all using (auth.role() = 'service_role');

create policy "service_role_all_practice_thesis_feedback" on practice_thesis_feedback
  for all using (auth.role() = 'service_role');

create policy "service_role_all_practice_paper_positions" on practice_paper_positions
  for all using (auth.role() = 'service_role');

-- ── updated_at trigger on the cache (reuses fn from migration 003/004/007) ────

create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists practice_drill_cache_updated_at on practice_drill_cache;
create trigger practice_drill_cache_updated_at
  before update on practice_drill_cache
  for each row execute function update_updated_at_column();
