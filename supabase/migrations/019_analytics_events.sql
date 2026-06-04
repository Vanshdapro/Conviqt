-- First-party, cookieless product analytics.
--
-- One row per tracked event. A tiny client beacon (src/components/analytics/
-- Analytics.tsx → /api/analytics/collect) records page_view + funnel events; the
-- Stripe webhook records the authoritative `paid` event server-side. No GA, no
-- Plausible, no cookies — the data lives in our own Postgres and the funnel can
-- be joined to real Stripe conversions.
--
-- Privacy posture: anon_id is a random client-generated UUID in localStorage,
-- not a fingerprint. We store no IP and no third-party identifiers.
--
-- Funnel: visitor (distinct anon_id w/ page_view) → signup → checkout_started → paid.

CREATE TABLE IF NOT EXISTS analytics_events (
  id            bigint       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event         text         NOT NULL,          -- 'page_view' | 'signup' | 'checkout_started' | 'paid' | …
  anon_id       text,                           -- random client UUID (cookieless visitor id)
  path          text,                           -- pathname (no query string)
  referrer      text,
  utm_source    text,
  utm_medium    text,
  utm_campaign  text,
  user_email    text,                           -- attached server-side for funnel events when signed in
  meta          jsonb        NOT NULL DEFAULT '{}'::jsonb,  -- e.g. { plan, amount, ticker }
  created_at    timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS analytics_events_event_time_idx
  ON analytics_events (event, created_at DESC);
CREATE INDEX IF NOT EXISTS analytics_events_time_idx
  ON analytics_events (created_at DESC);

-- Unlike stock_reports, analytics is NOT a public surface: no public read, no
-- public insert. Collection + the dashboard both go through the service role.
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service role all" ON analytics_events;
CREATE POLICY "service role all" ON analytics_events
  FOR ALL USING (auth.role() = 'service_role');

-- ── Aggregation RPCs (the dashboard calls these; service role bypasses RLS) ──

-- Headline funnel over the last p_days.
CREATE OR REPLACE FUNCTION analytics_funnel(p_days int DEFAULT 30)
RETURNS TABLE (visitors bigint, signups bigint, checkouts bigint, paid bigint)
LANGUAGE sql STABLE AS $$
  SELECT
    count(distinct anon_id) FILTER (WHERE event = 'page_view'),
    count(*)                FILTER (WHERE event = 'signup'),
    count(*)                FILTER (WHERE event = 'checkout_started'),
    count(*)                FILTER (WHERE event = 'paid')
  FROM analytics_events
  WHERE created_at >= now() - make_interval(days => p_days);
$$;

-- Daily series of the headline metrics.
CREATE OR REPLACE FUNCTION analytics_daily(p_days int DEFAULT 30)
RETURNS TABLE (day date, visitors bigint, signups bigint, paid bigint)
LANGUAGE sql STABLE AS $$
  SELECT
    created_at::date AS day,
    count(distinct anon_id) FILTER (WHERE event = 'page_view'),
    count(*)                FILTER (WHERE event = 'signup'),
    count(*)                FILTER (WHERE event = 'paid')
  FROM analytics_events
  WHERE created_at >= now() - make_interval(days => p_days)
  GROUP BY 1
  ORDER BY 1;
$$;

-- Top acquisition sources by distinct visitor (utm_source, else direct/organic).
CREATE OR REPLACE FUNCTION analytics_top_sources(p_days int DEFAULT 30, p_limit int DEFAULT 10)
RETURNS TABLE (source text, visitors bigint)
LANGUAGE sql STABLE AS $$
  SELECT
    coalesce(nullif(utm_source, ''), 'direct / organic') AS source,
    count(distinct anon_id) AS visitors
  FROM analytics_events
  WHERE created_at >= now() - make_interval(days => p_days)
  GROUP BY 1
  ORDER BY 2 DESC
  LIMIT p_limit;
$$;
