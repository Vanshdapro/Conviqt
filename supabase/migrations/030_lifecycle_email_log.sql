-- Lifecycle email log — idempotency guard for one-time / once-per-stage
-- lifecycle emails: the welcome email (sent once when a user first verifies)
-- and the day-3 re-engagement nudge (sent once to a user who signed up but
-- never ran an analysis). One row per (email, kind); the composite PK is what
-- makes a repeated auth callback or a retried cron incapable of double-sending.
--
-- Service-role only. RLS is enabled with no policies, so the anon/auth roles
-- cannot read or write it — only the admin client (which bypasses RLS) touches
-- it, exactly like analysis_history / watchlist_alert_log.

create table if not exists lifecycle_email_log (
  email   text        not null,
  kind    text        not null,  -- 'welcome' | 'reengage_d3'
  sent_at timestamptz not null default now(),
  primary key (email, kind)
);

alter table lifecycle_email_log enable row level security;
