-- Migration 006: idempotent, session-keyed credit grants.
--
-- Why: previously, purchased credits were only ever added by the Stripe
-- webhook (checkout.session.completed). If the webhook didn't fire — endpoint
-- not registered, wrong signing secret, wrong URL — the customer was charged
-- but never credited. The /verify route on the success page only READ the
-- balance; it had no way to grant credits safely (calling add_credits there
-- would double-count whenever the webhook DID fire).
--
-- This function fixes that: it grants credits exactly once per (email, reason).
-- Both the webhook and the success-page /verify call it with the same
-- reason = 'stripe_session_<checkout_session_id>', so whichever path runs
-- first wins and the other becomes a no-op. The success page is therefore a
-- reliable fallback for a missed webhook, with no risk of double-crediting.
--
-- Concurrency: a transaction-scoped advisory lock keyed on (email|reason)
-- serializes simultaneous webhook + verify calls so the existence check can't
-- race two inserts through.

create or replace function add_credits_once(
  p_email   text,
  p_credits integer,
  p_reason  text,
  p_plan    text default null
)
returns json
language plpgsql
security definer
as $$
declare
  v_email  text := lower(trim(p_email));
  v_exists boolean;
  v_before integer;
  v_after  integer;
begin
  -- Serialize concurrent grants for the same (email, reason).
  perform pg_advisory_xact_lock(hashtextextended(v_email || '|' || p_reason, 0));

  select exists(
    select 1 from credit_log
     where email = v_email and reason = p_reason
  ) into v_exists;

  if v_exists then
    select credits into v_after from user_credits where email = v_email;
    return json_build_object('granted', false, 'credits', coalesce(v_after, 0));
  end if;

  insert into user_credits (email, credits, plan, updated_at)
  values (v_email, p_credits, coalesce(p_plan, 'free'), now())
  on conflict (email) do update
    set credits    = user_credits.credits + p_credits,
        plan       = coalesce(p_plan, user_credits.plan),
        updated_at = now()
  returning credits into v_after;

  v_before := v_after - p_credits;

  insert into credit_log (email, delta, reason, credits_before, credits_after)
  values (v_email, p_credits, p_reason, v_before, v_after);

  return json_build_object('granted', true, 'credits', v_after);
end;
$$;
