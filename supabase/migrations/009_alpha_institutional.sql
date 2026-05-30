-- Migration: institutional pipeline columns for the rebuilt Alpha Tracker.
-- Adds the portfolio-constructor sizing fields, the 6-lens council scorecard,
-- and the macro regime stamped at entry. Run this in the Supabase SQL editor.
--
-- Safe to run before deploying the new pipeline: the app treats every column
-- below as optional and the store insert degrades gracefully if they are
-- absent, so there is no ordering requirement between deploy and migration.

ALTER TABLE alpha_picks
  ADD COLUMN IF NOT EXISTS position_size_pct numeric(5,2),
  ADD COLUMN IF NOT EXISTS risk_reward       numeric(6,2),
  ADD COLUMN IF NOT EXISTS lens_scores       jsonb DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS regime_stance     text,
  ADD COLUMN IF NOT EXISTS regime_summary    text;
