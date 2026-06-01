-- Public stock report cache.
--
-- Powers the SEO moat: conviqt.com/stock/NVDA renders the latest cached
-- Council verdict for a ticker. One row per ticker holds the most recent
-- public report so static generation + 24h ISR can serve it without re-running
-- the (expensive) Council on every crawler hit.
--
-- Population paths:
--   1. User runs "analyze TICKER" in chat / via /api/analyze → upsert here.
--   2. /api/stock/refresh cron re-runs the stalest tickers within budget.
--
-- The full CouncilResult is stored verbatim in `report` (jsonb). The flat
-- columns are denormalized summary fields so list/sitemap/metadata queries
-- don't have to parse the blob.

CREATE TABLE IF NOT EXISTS stock_reports (
  ticker        text         PRIMARY KEY,
  company_name  text         NOT NULL,
  sector        text,
  verdict       text         NOT NULL CHECK (verdict IN ('BUY', 'HOLD', 'SELL')),
  conviction    smallint     NOT NULL CHECK (conviction BETWEEN 0 AND 100),
  disagreement  smallint     NOT NULL CHECK (disagreement BETWEEN 0 AND 100),
  report        jsonb        NOT NULL,          -- full CouncilResult
  est_cost_usd  numeric(10,4),
  as_of         timestamptz  NOT NULL,          -- when the underlying run happened
  updated_at    timestamptz  NOT NULL DEFAULT now()
);

-- Cron picks the stalest tickers first.
CREATE INDEX IF NOT EXISTS stock_reports_updated_idx ON stock_reports (updated_at);

-- Row-level security: anyone can read (these pages are meant to be indexed),
-- only the service role writes. Mirrors alpha_picks (migration 001).
ALTER TABLE stock_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public read" ON stock_reports;
CREATE POLICY "public read" ON stock_reports
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "service role write" ON stock_reports;
CREATE POLICY "service role write" ON stock_reports
  FOR ALL USING (auth.role() = 'service_role');
