-- Onboarding + subscription plan gating (Phase 7).
--
-- Two tables:
--
--   1. user_profiles   — what the 3-step onboarding collects: investor style,
--                        experience level (drives answer language complexity in
--                        every pipeline), plus the "done forever" markers for
--                        onboarding and the first-run tour.
--   2. analysis_usage  — the Free-tier meter: how many FRESH deep analyses
--                        (Council / Face-Off / Sector Pulse / Health Check /
--                        Starter Portfolio) a user ran this calendar month.
--                        Cache hits never count. Pro users are never counted.
--
-- Credits (migration 004) stay as INTERNAL metering only — no user-visible
-- numbers anywhere. Plan state itself lives in `subscribers` (migration 003);
-- no schema change needed there: `plan` is text and now also carries
-- 'pro_monthly' / 'pro_annual'.

-- ── 1. User profiles ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_profiles (
  email             text         PRIMARY KEY,
  investor_style    text         CHECK (investor_style IN ('steady', 'balanced', 'growth', 'bold')),
  experience_level  text         CHECK (experience_level IN ('new', 'learning', 'experienced')),
  onboarded_at      timestamptz,           -- set when onboarding finishes OR is skipped
  tour_dismissed_at timestamptz,           -- set when the first-run tour ends — never shown again
  created_at        timestamptz  NOT NULL DEFAULT now(),
  updated_at        timestamptz  NOT NULL DEFAULT now()
);

-- ── 2. Monthly deep-analysis meter (Free tier: 5/month) ─────────────────────
CREATE TABLE IF NOT EXISTS analysis_usage (
  email       text         NOT NULL,
  month       text         NOT NULL,            -- 'YYYY-MM' in UTC
  deep_count  integer      NOT NULL DEFAULT 0,
  updated_at  timestamptz  NOT NULL DEFAULT now(),
  PRIMARY KEY (email, month)
);

-- Atomic check-and-increment. Returns {allowed, used}. The row lock makes two
-- concurrent requests serialize, so the limit can never be raced past.
CREATE OR REPLACE FUNCTION use_deep_analysis(p_email text, p_limit integer)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_email text := lower(trim(p_email));
  v_month text := to_char(now() AT TIME ZONE 'utc', 'YYYY-MM');
  v_count integer;
BEGIN
  INSERT INTO analysis_usage (email, month, deep_count)
  VALUES (v_email, v_month, 0)
  ON CONFLICT (email, month) DO NOTHING;

  SELECT deep_count INTO v_count
  FROM analysis_usage
  WHERE email = v_email AND month = v_month
  FOR UPDATE;

  IF v_count >= p_limit THEN
    RETURN jsonb_build_object('allowed', false, 'used', v_count);
  END IF;

  UPDATE analysis_usage
  SET deep_count = deep_count + 1, updated_at = now()
  WHERE email = v_email AND month = v_month;

  RETURN jsonb_build_object('allowed', true, 'used', v_count + 1);
END;
$$;

-- ── RLS: service-role only (same posture as migration 012) ─────────────────
ALTER TABLE user_profiles  ENABLE ROW LEVEL SECURITY;
ALTER TABLE analysis_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_user_profiles" ON user_profiles
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_role_all_analysis_usage" ON analysis_usage
  FOR ALL USING (auth.role() = 'service_role');
