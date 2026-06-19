-- Migration 027: close the subscribers RLS leak.
--
-- Migration 003 created an anon SELECT policy with `using (true)`, which let
-- ANY holder of the public anon key (it ships in the browser bundle) read
-- every customer's billing row — email, stripe_customer_id, plan,
-- subscription_status, current_period_end. That is a full customer/PII +
-- billing dump.
--
-- Every server read of this table goes through the service role
-- (getSupabaseAdmin / getSubscriberByEmail / getSubscriberByCustomerId), which
-- bypasses RLS. No client code reads `subscribers` with the anon key, so the
-- anon SELECT policy serves no purpose and is removed entirely. With RLS still
-- enabled and only the service_role_all policy present, anon/auth roles get
-- zero rows.

drop policy if exists "anon_read_own" on subscribers;

-- (RLS stays enabled from migration 003; service_role_all remains the only
--  policy, so the webhook/server keep full access and the public anon key gets
--  nothing.)
