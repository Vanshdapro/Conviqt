-- The Conviqt Disagreement Index (CDI) — a published, named data product.
--
-- Each row is one WEEKLY snapshot of the CDI: the top N most AI-contested
-- stocks that week, frozen so the ranking is stable and citable. A journalist
-- who writes "the Conviqt Disagreement Index hit a 3-month high this week" is
-- pointing at a specific, durable row here — not a query that re-runs and
-- changes under them.
--
-- Why a snapshot table rather than a live query (like the /stock index does):
--   1. Citability — a named index needs a fixed weekly value, not a number
--      that drifts every time someone re-runs the Council on a ticker.
--   2. Trend — the "conviction trend vs last week" arrow needs a real prior
--      reference. We diff this week's snapshot against last week's row.
--   3. Cost — the snapshot is computed ONCE per week by a cron from data we
--      already store (stock_reports + the report blobs). Zero Claude spend:
--      the "what the agents are fighting about" blurb is composed
--      deterministically from the already-stored bull/bear case + dissents.
--
-- entries holds the full ranked CDIEntry[] (see src/lib/cdi.ts) as jsonb so a
-- page render is a single-row read. stats holds headline numbers (peak ticker,
-- average disagreement) for the press-release lede.

CREATE TABLE IF NOT EXISTS cdi_snapshots (
  -- Monday (UTC) of the week this snapshot represents. One snapshot per week;
  -- re-publishing the same week overwrites it.
  week_of           date         PRIMARY KEY,
  generated_at      timestamptz  NOT NULL DEFAULT now(),
  -- Average disagreement across the ranked entries, 0-100. The headline number.
  avg_disagreement  smallint     NOT NULL CHECK (avg_disagreement BETWEEN 0 AND 100),
  -- Full ranked list of CDIEntry objects (rank, ticker, disagreement, verdict,
  -- conviction, trend, vote split, dissents, fight summary, bull/bear lines).
  entries           jsonb        NOT NULL,
  -- Headline stats for the lede: { peakTicker, peakDisagreement, count, ... }.
  stats             jsonb
);

-- "Give me the latest snapshot" and "the one before it" are the only reads.
CREATE INDEX IF NOT EXISTS cdi_snapshots_week_idx
  ON cdi_snapshots (week_of DESC);

-- Same posture as stock_reports / conviction_history: the index is a public
-- SEO + press surface, so anyone can read; only the service role writes.
ALTER TABLE cdi_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public read" ON cdi_snapshots;
CREATE POLICY "public read" ON cdi_snapshots
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "service role write" ON cdi_snapshots;
CREATE POLICY "service role write" ON cdi_snapshots
  FOR ALL USING (auth.role() = 'service_role');
