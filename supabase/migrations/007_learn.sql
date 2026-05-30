-- Migration 007: Conviqt Learn — gamified financial academy.
--
-- Two tables:
--   learn_lesson_cache — globally cached, Claude-authored lesson modules.
--                        Keyed by the static curriculum lesson_id. The first
--                        learner to open a lesson pays full authoring credits;
--                        everyone after replays the cached JSON for fewer
--                        credits. This is the margin-protection lever.
--   learn_progress     — one row per (email, lesson_id) marking completion,
--                        XP awarded (once), and best quiz score. XP / level /
--                        streak are all derived from these rows at read time.

-- ── Lesson cache ─────────────────────────────────────────────────────────────

create table if not exists learn_lesson_cache (
  lesson_id   text         not null primary key,
  module      jsonb        not null,
  model       text,
  cost_usd    numeric(8,4) not null default 0,
  created_at  timestamptz  not null default now(),
  updated_at  timestamptz  not null default now()
);

-- ── Per-user progress ────────────────────────────────────────────────────────

create table if not exists learn_progress (
  email         text        not null,
  lesson_id     text        not null,
  xp_awarded    integer     not null default 0 check (xp_awarded >= 0),
  best_quiz_pct integer     not null default 0 check (best_quiz_pct between 0 and 100),
  completed_at  timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  primary key (email, lesson_id)
);

create index if not exists learn_progress_email_idx
  on learn_progress (email, completed_at desc);

-- ── RLS ──────────────────────────────────────────────────────────────────────
-- All access is through the service-role admin client (server-side), which
-- bypasses RLS. We still enable RLS and add a permissive read so the cache could
-- be read anon in future without exposing per-user progress.

alter table learn_lesson_cache enable row level security;
alter table learn_progress     enable row level security;

create policy "service_role_all_lesson_cache" on learn_lesson_cache
  for all using (auth.role() = 'service_role');

create policy "anon_read_lesson_cache" on learn_lesson_cache
  for select using (true);  -- lesson content is not user-specific

create policy "service_role_all_learn_progress" on learn_progress
  for all using (auth.role() = 'service_role');

-- ── updated_at trigger on the cache (reuses fn from migration 003/004) ────────

create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists learn_lesson_cache_updated_at on learn_lesson_cache;
create trigger learn_lesson_cache_updated_at
  before update on learn_lesson_cache
  for each row execute function update_updated_at_column();
