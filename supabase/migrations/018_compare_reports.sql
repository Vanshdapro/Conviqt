-- Public head-to-head compare cache.
--
-- Powers the compare SEO surface: conviqt.com/compare/aapl-vs-msft renders the
-- latest cached comparative verdict for a ticker PAIR. One row per canonical
-- pair holds the most recent public CompareResult so static generation + 24h
-- ISR can serve it without re-running the (expensive, two-Council) Compare on
-- every crawler hit.
--
-- Population path: a user runs "AAPL vs MSFT" in chat → streamCompare persists
-- here (fresh runs only; warm/cached replays don't re-persist).
--
-- Canonicalization: pair_key is the two tickers sorted + joined ("AAPL|MSFT"),
-- matching compareCacheKey() in cache.ts and comparePairKey() in tickers.ts. The
-- stored side A/B is sorted to match the canonical slug (see compareReports.ts).
--
-- The full CompareResult is stored verbatim in `report` (jsonb). The flat
-- columns are denormalized summary fields so hub/sitemap/OG queries don't have
-- to parse the blob.

CREATE TABLE IF NOT EXISTS compare_reports (
  pair_key        text         PRIMARY KEY,       -- canonical "AAPL|MSFT" (sorted)
  ticker_a        text         NOT NULL,          -- alphabetically-first side
  ticker_b        text         NOT NULL,
  company_name_a  text         NOT NULL,
  company_name_b  text         NOT NULL,
  winner          text         NOT NULL CHECK (winner IN ('A', 'B', 'TIE')),
  headline        text         NOT NULL,
  report          jsonb        NOT NULL,           -- full CompareResult
  est_cost_usd    numeric(10,4),
  as_of           timestamptz  NOT NULL,           -- when the underlying run happened
  updated_at      timestamptz  NOT NULL DEFAULT now()
);

-- Hub + sitemap list newest-first.
CREATE INDEX IF NOT EXISTS compare_reports_updated_idx
  ON compare_reports (updated_at DESC);

-- Same posture as stock_reports (migration 013): these pages are meant to be
-- indexed, so anyone can read; only the service role writes.
ALTER TABLE compare_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public read" ON compare_reports;
CREATE POLICY "public read" ON compare_reports
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "service role write" ON compare_reports;
CREATE POLICY "service role write" ON compare_reports
  FOR ALL USING (auth.role() = 'service_role');
