-- Migration 016: Weekly "Disagreement Digest" newsletter (Deliverable 6).
--
-- Two tables:
--
-- 1. newsletter_subscribers — the email list, with DOUBLE OPT-IN.
--    A row starts life as 'pending' the moment someone enters their email.
--    A confirmation email carries a one-time confirm_token; clicking it flips
--    the row to 'confirmed'. Only 'confirmed' rows ever receive the digest.
--    Every row also carries a stable unsubscribe_token so one-click unsubscribe
--    links work without auth (CAN-SPAM / good-citizen requirement).
--
--    This is a SEPARATE list from `subscribers` (migration 003) — that table is
--    paying Stripe customers keyed by stripe_customer_id. The newsletter is free
--    and email-only, so it gets its own table with its own lifecycle.
--
-- 2. newsletter_send_log — one row per ISO week the digest went out. The cron
--    claims a week (insert) before sending; the UNIQUE primary key makes a
--    double-fire (retry, manual + cron overlap) a no-op instead of a second
--    blast to the whole list.

-- ── Subscribers ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id                uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  email             text        NOT NULL UNIQUE,
  status            text        NOT NULL DEFAULT 'pending'
                                CHECK (status IN ('pending', 'confirmed', 'unsubscribed')),
  confirm_token     text        NOT NULL UNIQUE,
  unsubscribe_token text        NOT NULL UNIQUE,
  source            text,        -- where they signed up, e.g. 'landing', 'newsletter_page'
  created_at        timestamptz NOT NULL DEFAULT now(),
  confirmed_at      timestamptz,
  unsubscribed_at   timestamptz
);

-- The cron selects all confirmed rows; keep that scan cheap.
CREATE INDEX IF NOT EXISTS newsletter_subscribers_status_idx
  ON newsletter_subscribers (status);

-- Token lookups on the confirm / unsubscribe routes.
CREATE INDEX IF NOT EXISTS newsletter_subscribers_confirm_token_idx
  ON newsletter_subscribers (confirm_token);
CREATE INDEX IF NOT EXISTS newsletter_subscribers_unsubscribe_token_idx
  ON newsletter_subscribers (unsubscribe_token);

-- ── Weekly send ledger (idempotency) ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS newsletter_send_log (
  week_key        text        PRIMARY KEY,   -- ISO week, e.g. '2026-W23'
  sent_at         timestamptz NOT NULL DEFAULT now(),
  recipient_count integer     NOT NULL DEFAULT 0,
  ticker_count    integer     NOT NULL DEFAULT 0
);

-- ── RLS ────────────────────────────────────────────────────────────────────
-- Both tables are written ONLY by the service role (subscribe route + cron run
-- server-side with the service key). No anon access — the subscriber list is
-- private, and confirm/unsubscribe go through service-role API routes, not the
-- browser. Mirrors the service-role-only posture of subscribers (003).
ALTER TABLE newsletter_subscribers ENABLE ROW LEVEL SECURITY;
ALTER TABLE newsletter_send_log    ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service role all" ON newsletter_subscribers;
CREATE POLICY "service role all" ON newsletter_subscribers
  FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "service role all" ON newsletter_send_log;
CREATE POLICY "service role all" ON newsletter_send_log
  FOR ALL USING (auth.role() = 'service_role');
