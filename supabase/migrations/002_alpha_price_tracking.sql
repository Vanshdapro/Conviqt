-- Migration: add current price tracking columns to alpha_picks.
-- Run this in the Supabase SQL editor.

ALTER TABLE alpha_picks
  ADD COLUMN IF NOT EXISTS current_price      numeric(12,4),
  ADD COLUMN IF NOT EXISTS price_change_pct   numeric(8,4),
  ADD COLUMN IF NOT EXISTS price_last_updated date;
