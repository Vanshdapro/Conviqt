-- Migration 017: prediction & risk engine, mosaic edge scan, and prediction
-- resolution / calibration columns for the rebuilt Alpha Tracker.
--
-- Additive and deploy-safe (mirrors migration 009): every column is optional
-- and the store's insert / markSold / resolveHorizon paths degrade gracefully
-- when they are absent (PGRST204 / 42703 fallback), so there is no ordering
-- requirement between deploying the new pipeline and running this migration.
-- Run it in the Supabase SQL editor.

ALTER TABLE alpha_picks
  -- ── Mosaic edge scan ("the small factors") ──
  ADD COLUMN IF NOT EXISTS edge_factors        jsonb DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS edge_summary        text,
  -- ── Prediction & risk ──
  ADD COLUMN IF NOT EXISTS predicted_price     numeric(12,4),
  ADD COLUMN IF NOT EXISTS horizon_days        integer,
  ADD COLUMN IF NOT EXISTS target_date         date,
  ADD COLUMN IF NOT EXISTS confidence_pct      numeric(5,2),  -- risk = 100 - this
  ADD COLUMN IF NOT EXISTS prob_of_loss_pct    numeric(5,2),
  ADD COLUMN IF NOT EXISTS expected_value_pct  numeric(7,2),
  ADD COLUMN IF NOT EXISTS scenarios           jsonb DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS forecast_basis      text,
  -- ── Resolution / calibration ──
  ADD COLUMN IF NOT EXISTS resolved            boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS resolved_date       date,
  ADD COLUMN IF NOT EXISTS resolution_outcome  text,  -- TARGET_HIT|STOP_HIT|FUNDAMENTAL_EXIT|HORIZON_EXPIRED
  ADD COLUMN IF NOT EXISTS resolved_price      numeric(12,4),
  ADD COLUMN IF NOT EXISTS prediction_correct  boolean,
  ADD COLUMN IF NOT EXISTS realized_return_pct numeric(7,2);

-- Index for the calibration query (fetchResolved filters on resolved = true).
CREATE INDEX IF NOT EXISTS alpha_picks_resolved_idx ON alpha_picks (resolved)
  WHERE resolved = true;
