-- Watchlist + Earnings Alert System (Deliverable 3).
--
-- Three tables power the #1 retention mechanic:
--
--   1. watchlist          — up to 10 tickers a user is tracking. The cap is
--                           enforced in app code (src/lib/watchlist.ts), not a
--                           DB trigger, so the error surfaces cleanly in the UI.
--   2. earnings_calendar  — a shared, app-wide cache of the next earnings date
--                           per ticker. Populated by the daily alert cron via
--                           the sweep agent's web_search (NO new paid API — see
--                           CLAUDE.md). One row per ticker so a ticker on N
--                           watchlists is only ever priced once per refresh.
--   3. watchlist_alert_log— idempotency ledger. One row per alert actually sent
--                           so the cron never double-emails the same trigger.
--                           trigger_key disambiguates: the earnings date for an
--                           earnings alert, the report's as_of for a Council
--                           disagreement alert.

-- ── 1. Watchlist ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS watchlist (
  email       text         NOT NULL,
  ticker      text         NOT NULL,
  created_at  timestamptz  NOT NULL DEFAULT now(),
  PRIMARY KEY (email, ticker)
);

-- Cron reads every distinct watched ticker; users read their own rows.
CREATE INDEX IF NOT EXISTS watchlist_email_idx  ON watchlist (email);
CREATE INDEX IF NOT EXISTS watchlist_ticker_idx ON watchlist (ticker);

-- ── 2. Earnings calendar cache ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS earnings_calendar (
  ticker              text         PRIMARY KEY,
  company_name        text,
  next_earnings_date  date,                    -- null = unknown / not found
  confidence          text         NOT NULL DEFAULT 'unknown'
                        CHECK (confidence IN ('confirmed', 'estimated', 'unknown')),
  source_url          text,                    -- citation for the date (CLAUDE.md rule)
  source_title        text,
  as_of               timestamptz  NOT NULL,   -- when the web_search ran
  updated_at          timestamptz  NOT NULL DEFAULT now()
);

-- Cron refreshes the stalest earnings rows first.
CREATE INDEX IF NOT EXISTS earnings_calendar_updated_idx ON earnings_calendar (updated_at);

-- ── 3. Alert idempotency ledger ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS watchlist_alert_log (
  id            bigint       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email         text         NOT NULL,
  ticker        text         NOT NULL,
  alert_type    text         NOT NULL CHECK (alert_type IN ('earnings', 'disagreement')),
  trigger_key   text         NOT NULL,         -- earnings date or report as_of
  sent_at       timestamptz  NOT NULL DEFAULT now(),
  UNIQUE (email, ticker, alert_type, trigger_key)
);

CREATE INDEX IF NOT EXISTS watchlist_alert_log_sent_idx ON watchlist_alert_log (sent_at);

-- ── Row-level security ──────────────────────────────────────────────────────
-- The app reads/writes exclusively through the service-role admin client
-- (src/lib/supabase.ts → getSupabaseAdmin), identical to alpha_picks (001) and
-- credits (004). Identity is verified server-side from the session, never the
-- client, so we keep these tables service-role-only and do gating in app code.
ALTER TABLE watchlist           ENABLE ROW LEVEL SECURITY;
ALTER TABLE earnings_calendar   ENABLE ROW LEVEL SECURITY;
ALTER TABLE watchlist_alert_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service role all" ON watchlist;
CREATE POLICY "service role all" ON watchlist
  FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "service role all" ON earnings_calendar;
CREATE POLICY "service role all" ON earnings_calendar
  FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "service role all" ON watchlist_alert_log;
CREATE POLICY "service role all" ON watchlist_alert_log
  FOR ALL USING (auth.role() = 'service_role');
