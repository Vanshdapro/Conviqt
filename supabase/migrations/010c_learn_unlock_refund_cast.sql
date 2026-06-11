-- ============================================================================
-- CORRECTIVE (2026-06-11): the refund block in 010b never ran.
--
-- ROOT CAUSE: in 010b the refund called
--     add_credits(email, refund_due, 'learn_unlock_refund')
-- where refund_due is the result of SUM(...) over an integer column. Postgres
-- types SUM(integer) as BIGINT, and add_credits is declared (text, integer,
-- text). Function-call resolution does NOT apply the bigint→integer assignment
-- cast, so the statement raised:
--     ERROR: function add_credits(text, bigint, text) does not exist
-- That aborted the refund step, so affected users were charged but never
-- refunded. (010b was already executed, so editing it in place would never
-- re-run — hence this new corrective file.)
--
-- THE FIX: cast refund_due to integer explicitly.
--
-- This script is SAFE TO RUN MULTIPLE TIMES and safe regardless of how far 010b
-- got: the `refunded` CTE nets out any refunds already issued, so re-running
-- never double-refunds, and the table create is idempotent.
--
-- Paste the WHOLE file into Supabase → SQL Editor → Run.
-- ============================================================================

-- Ensure the table the refund query reads from exists (idempotent — 010/010b).
create table if not exists learn_unlocks (
  email        text        not null,
  lesson_id    text        not null,
  credits_paid integer     not null default 0,
  unlocked_at  timestamptz not null default now(),
  primary key (email, lesson_id)
);

-- Refund every learn_unlock charge that never produced an owned unlock row,
-- minus anything already refunded. (refund_due::integer is the actual fix.)
with charged as (
  select email, coalesce(sum(-delta), 0) as paid
    from credit_log
   where reason in ('learn_unlock', 'learn_unlock_all')
   group by email
),
refunded as (
  select email, coalesce(sum(delta), 0) as refunded
    from credit_log
   where reason = 'learn_unlock_refund'
   group by email
),
owned as (
  select email, coalesce(sum(credits_paid), 0) as kept
    from learn_unlocks
   group by email
),
owed as (
  select c.email,
         c.paid - coalesce(r.refunded, 0) - coalesce(o.kept, 0) as refund_due
    from charged c
    left join refunded r on r.email = c.email
    left join owned o   on o.email = c.email
)
select add_credits(email, refund_due::integer, 'learn_unlock_refund')
  from owed
 where refund_due > 0;

-- ── Verify ─────────────────────────────────────────────────────────────────
-- select email, delta, reason from credit_log
--  where reason = 'learn_unlock_refund' order by created_at desc;
