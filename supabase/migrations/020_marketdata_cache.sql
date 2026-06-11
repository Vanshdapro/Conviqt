-- Shared cache for the free keyless market data feeds (src/lib/marketdata/).
--
-- One row per cache key:
--   md:quote:NVDA          (15-min TTL)
--   md:stats:NVDA          (15-min TTL)
--   md:history:NVDA:1y     (24-h TTL)
--
-- TTLs are enforced at READ time in src/lib/marketdata/cache.ts (one table
-- serves every TTL class); fetched_at is the only freshness signal stored.
-- Stale rows are harmless — they're skipped on read and overwritten by the
-- next upsert for the same key.
--
-- This cache is what keeps Conviqt polite to the unofficial feeds: every
-- user shares one Stooq/Yahoo fetch per ticker per TTL window.

CREATE TABLE IF NOT EXISTS marketdata_cache (
  cache_key   text         PRIMARY KEY,
  payload     jsonb        NOT NULL,
  fetched_at  timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS marketdata_cache_fetched_idx
  ON marketdata_cache (fetched_at DESC);

-- Server-only surface: reads and writes go through the service role client.
-- No public read, no public insert.
ALTER TABLE marketdata_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service role all" ON marketdata_cache;
CREATE POLICY "service role all" ON marketdata_cache
  FOR ALL USING (auth.role() = 'service_role');
