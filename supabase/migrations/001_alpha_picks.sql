-- Alpha Tracker picks table.
-- Run this in the Supabase SQL editor to create the schema.

CREATE TABLE IF NOT EXISTS alpha_picks (
  id          uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id      text         NOT NULL,
  ticker      text         NOT NULL,
  company_name text        NOT NULL,
  entry_price numeric(12,4) NOT NULL,
  entry_date  date         NOT NULL,
  target_price numeric(12,4),
  stop_loss   numeric(12,4),
  catalyst    text         NOT NULL,
  conviction  smallint     NOT NULL CHECK (conviction BETWEEN 1 AND 10),
  bull_thesis text         NOT NULL,
  bear_thesis text         NOT NULL,
  sources     jsonb        NOT NULL DEFAULT '[]',
  status      text         NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SOLD')),
  exit_date   date,
  exit_price  numeric(12,4),
  exit_reason text,
  created_at  timestamptz  NOT NULL DEFAULT now()
);

-- Index for the active-picks query in /api/alpha/picks.
CREATE INDEX IF NOT EXISTS alpha_picks_status_idx ON alpha_picks (status);

-- Index for recently-exited query.
CREATE INDEX IF NOT EXISTS alpha_picks_exit_date_idx ON alpha_picks (exit_date)
  WHERE status = 'SOLD';

-- Row-level security: anon can read, only service role can write.
ALTER TABLE alpha_picks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read" ON alpha_picks
  FOR SELECT USING (true);

CREATE POLICY "service role write" ON alpha_picks
  FOR ALL USING (auth.role() = 'service_role');
