-- Conviction Timeline — the longitudinal AI-consensus dataset.
--
-- Unlike stock_reports (one upserted row per ticker = the *latest* verdict),
-- this table is APPEND-ONLY: one row per canonical Council run. It is what
-- powers the time-series chart on /stock/[ticker] — "NVDA conviction dropped
-- from 9/10 to 5/10 in February" — and is the proprietary data moat: nobody
-- else has historical AI-disagreement data on public equities.
--
-- It accumulates FORWARD from the day this migration ships. We never replay
-- history; the page honestly shows "History from [first run]". Storage cost is
-- negligible (a few hundred bytes per run), so this adds nothing to the budget.
--
-- Population path: persistStockReport() (src/lib/stockReports.ts) fires a
-- fire-and-forget append on every canonical (unfocused) run — the same funnel
-- that already upserts stock_reports, so chat / /api/analyze / refresh-cron all
-- contribute points for free.

CREATE TABLE IF NOT EXISTS conviction_history (
  id            bigint       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ticker        text         NOT NULL,
  verdict       text         NOT NULL CHECK (verdict IN ('BUY', 'HOLD', 'SELL')),
  conviction    smallint     NOT NULL CHECK (conviction BETWEEN 0 AND 100),
  disagreement  smallint     NOT NULL CHECK (disagreement BETWEEN 0 AND 100),
  -- Specialist agents that dissented from the Judge's verdict, for the hover
  -- story ("the macro agent turned bearish first").
  dissents      text[]       NOT NULL DEFAULT '{}',
  -- One-line bull / bear case snapshots so the hover tooltip can tell the
  -- story of that run without loading the full report blob.
  bull_line     text,
  bear_line     text,
  as_of         timestamptz  NOT NULL,          -- when the underlying run happened
  created_at    timestamptz  NOT NULL DEFAULT now()
);

-- The chart query is always "this ticker, last N days, oldest first".
CREATE INDEX IF NOT EXISTS conviction_history_ticker_asof_idx
  ON conviction_history (ticker, as_of);

-- Same posture as stock_reports (migration 013): anyone can read (the chart is
-- a public SEO surface), only the service role writes.
ALTER TABLE conviction_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public read" ON conviction_history;
CREATE POLICY "public read" ON conviction_history
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "service role write" ON conviction_history;
CREATE POLICY "service role write" ON conviction_history
  FOR ALL USING (auth.role() = 'service_role');
