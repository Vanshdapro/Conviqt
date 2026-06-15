-- Durable global daily-spend cap (wallet kill-switch).
--
-- BACKGROUND: the daily $ kill-switch in src/lib/rate-limit.ts used to be a
-- plain in-process variable (`dailySpendUSD`). On Vercel each serverless
-- instance gets its own copy and resets to 0 on every cold start, so the
-- "$5/day cap" never actually accumulated globally and effectively never
-- fired. This table makes the counter durable and shared across every
-- instance, so the cap is real.
--
-- One row per UTC day. `add_daily_spend` atomically adds to today's total and
-- returns the new running total; the app throws once that crosses
-- DAILY_BUDGET_USD. Old rows are harmless history (query them for a daily
-- cost report) — prune with a cron later if desired.

CREATE TABLE IF NOT EXISTS daily_spend (
  day        text         PRIMARY KEY,          -- 'YYYY-MM-DD' in UTC
  spent_usd  numeric      NOT NULL DEFAULT 0,
  updated_at timestamptz  NOT NULL DEFAULT now()
);

-- Atomic add-and-return. ON CONFLICT makes concurrent requests serialize on
-- the row, so no spend is ever lost to a race.
CREATE OR REPLACE FUNCTION add_daily_spend(p_day text, p_amount numeric)
RETURNS numeric
LANGUAGE plpgsql
AS $$
DECLARE
  v_total numeric;
BEGIN
  INSERT INTO daily_spend (day, spent_usd)
  VALUES (p_day, p_amount)
  ON CONFLICT (day) DO UPDATE
    SET spent_usd  = daily_spend.spent_usd + EXCLUDED.spent_usd,
        updated_at = now()
  RETURNING spent_usd INTO v_total;

  RETURN v_total;
END;
$$;

-- ── RLS: service-role only (same posture as migrations 012 / 022) ──────────
ALTER TABLE daily_spend ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_daily_spend" ON daily_spend
  FOR ALL USING (auth.role() = 'service_role');

-- ── Reporting helpers (optional, read in the Supabase SQL editor) ──────────
--
-- Today's spend:
--   SELECT * FROM daily_spend WHERE day = to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD');
--
-- Free-tier deep-analysis usage this month, busiest first:
--   SELECT email, deep_count
--   FROM analysis_usage
--   WHERE month = to_char(now() AT TIME ZONE 'utc', 'YYYY-MM')
--   ORDER BY deep_count DESC;
