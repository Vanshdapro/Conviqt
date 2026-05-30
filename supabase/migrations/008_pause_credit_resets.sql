-- Migration 008: pause all automated credit resets during the starting phase.
--
-- At launch we do not want anyone's credits reset or capped. This migration:
--   1. Clears credits_reset_at on every existing row, so the "resets <date>"
--      label disappears in the UI and no free reset is ever considered "due".
--   2. Redefines grant_free_credits_if_due to ONLY provision brand-new free
--      users (50 credits, no reset date). The monthly-reset branch is removed,
--      so existing free users keep whatever balance they already have — bonus
--      credits handed out during launch are no longer clobbered back to 50.
--
-- Max subscription renewals are paused in application code via the
-- CREDIT_RESETS_ENABLED flag in src/lib/credits.ts.
--
-- To re-enable monthly resets later: restore the function body from migration
-- 004, backfill credits_reset_at, and flip CREDIT_RESETS_ENABLED to true.

-- 1. Clear all pending reset dates.
update user_credits
   set credits_reset_at = null
 where credits_reset_at is not null;

-- 2. Provision new users only — no monthly reset, no reset date.
create or replace function grant_free_credits_if_due(p_email text)
returns void
language plpgsql
security definer
as $$
declare
  v_row user_credits%rowtype;
begin
  select * into v_row
    from user_credits
   where email = lower(trim(p_email));

  if not found then
    -- Brand-new user: 50 free credits, NO reset date (resets paused at launch).
    insert into user_credits (email, credits, plan, credits_reset_at)
    values (lower(trim(p_email)), 50, 'free', null);

    insert into credit_log (email, delta, reason, credits_before, credits_after)
    values (lower(trim(p_email)), 50, 'free_tier_init', 0, 50);
  end if;
  -- Monthly reset intentionally disabled during the starting phase.
end;
$$;
