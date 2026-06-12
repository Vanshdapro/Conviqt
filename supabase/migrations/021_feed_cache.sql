-- Phase 4: Dashboard + Headlines — the globally shared content cache.
--
-- feed_cache: one row per cached surface, ROLLING (each refresh overwrites).
--   feed:dashboard            → DashboardContent (trends/signals/events)
--   feed:headlines:<region>   → HeadlinesRegion (5 annotated headlines)
--
-- The rolling shape is a LICENSE OBLIGATION, not a style choice: Currents
-- News API terms forbid permanent copies of their data (src/lib/news/
-- currents.ts). Upserts overwrite by key; nothing is ever archived.
--
-- feed_refresh_runs: one row per scheduled refresh run — the honest cost
-- ledger CLAUDE.md requires ("log actual cost per run", ≤ $0.35/run).

CREATE TABLE IF NOT EXISTS feed_cache (
  cache_key     text         PRIMARY KEY,
  payload       jsonb        NOT NULL,
  generated_at  timestamptz  NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS feed_refresh_runs (
  id            bigint       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kind          text         NOT NULL,  -- 'dashboard' | 'headlines'
  status        text         NOT NULL,  -- 'ok' | 'error' | 'over_budget'
  cost_usd      numeric      NOT NULL DEFAULT 0,
  web_searches  integer      NOT NULL DEFAULT 0,
  duration_ms   integer      NOT NULL DEFAULT 0,
  error         text,
  meta          jsonb        NOT NULL DEFAULT '{}'::jsonb,
  created_at    timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS feed_refresh_runs_time_idx
  ON feed_refresh_runs (created_at DESC);

-- Server-only surfaces: the app reads/writes through the service role client
-- (/api routes). No public read — keeps the Currents payload off PostgREST.
ALTER TABLE feed_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE feed_refresh_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service role all" ON feed_cache;
CREATE POLICY "service role all" ON feed_cache
  FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "service role all" ON feed_refresh_runs;
CREATE POLICY "service role all" ON feed_refresh_runs
  FOR ALL USING (auth.role() = 'service_role');
