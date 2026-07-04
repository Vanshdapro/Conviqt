// Subscription helpers — server-only.
//
// Subscription state is stored in the `subscribers` Supabase table:
//   email                  text (unique)
//   stripe_customer_id     text (unique)
//   subscription_id        text | null
//   subscription_status    text  -- 'active' | 'trialing' | 'past_due' | 'canceled' | 'inactive'
//   plan                   text  -- 'free' | 'pro_monthly' | 'pro_annual' (+ legacy max plans)
//   current_period_end     timestamptz | null
//   created_at / updated_at
//
// Call `upsertSubscriber` from the webhook handler to keep this in sync.
// Call `getSubscriberByEmail` from API routes to gate premium features.

import { getSupabaseAdmin } from "./supabase";
import { FREE_MONTH_SIGNUP_WINDOW_START, FREE_MONTH_SIGNUP_WINDOW_END } from "./promo";

export interface Subscriber {
  email: string;
  stripe_customer_id: string;
  subscription_id: string | null;
  subscription_status: string;
  plan: string;
  current_period_end: string | null;
}

export type Plan =
  | "free"
  | "pro_monthly"
  | "pro_annual"
  | "max_monthly"
  | "max_pro_monthly"
  | "promo_free_month";

// Pro = any non-free plan with a live (active or trialing) subscription.
// Covers the Phase-7 Pro plans AND legacy Max subscribers, who keep their
// entitlement — we never downgrade a paying customer by renaming plans.
// `promo_free_month` is the one plan with a hard expiry (see below) since
// it's not backed by a real Stripe subscription that Stripe would cancel.
export function isPremium(subscriber: Subscriber | null): boolean {
  if (!subscriber) return false;
  if (subscriber.plan === "promo_free_month") {
    return !!subscriber.current_period_end && new Date(subscriber.current_period_end).getTime() > Date.now();
  }
  const active = ["active", "trialing"].includes(subscriber.subscription_status);
  const paid = !!subscriber.plan && subscriber.plan !== "free";
  return active && paid;
}

// One-off promo: accounts created 2026-07-04 → 2026-07-11 get Pro free for a
// month, no card, no Stripe. Window lives in ./promo (shared with pricing
// page copy). Delete this block once the window and every grantee's month
// have passed.
const FREE_MONTH_MS = 30 * 24 * 60 * 60 * 1000;

/** Grants the signup-week free month once, idempotently. No-op outside the window or if the user already has plan state. */
export async function grantFreeMonthIfEligible(user: {
  id: string;
  email: string;
  createdAt: string;
}): Promise<void> {
  const createdAtMs = new Date(user.createdAt).getTime();
  if (createdAtMs < FREE_MONTH_SIGNUP_WINDOW_START || createdAtMs >= FREE_MONTH_SIGNUP_WINDOW_END) {
    return;
  }
  const existing = await getSubscriberByEmail(user.email);
  if (existing) return;

  await upsertSubscriber({
    email: user.email,
    stripe_customer_id: `promo_${user.id}`,
    subscription_status: "active",
    plan: "promo_free_month",
    current_period_end: new Date(Date.now() + FREE_MONTH_MS).toISOString(),
  });
  console.log(`[subscription] granted free-month signup promo to ${user.email}`);
}

/** True while the subscription is in its 7-day trial window. */
export function isTrialing(subscriber: Subscriber | null): boolean {
  return !!subscriber && subscriber.subscription_status === "trialing";
}

export async function getSubscriberByEmail(
  email: string
): Promise<Subscriber | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("subscribers")
    .select("*")
    .eq("email", email.toLowerCase().trim())
    .single();

  if (error) {
    if (error.code === "PGRST116") return null; // not found
    console.error("[subscription] getSubscriberByEmail error:", error.message);
    return null;
  }
  return data as Subscriber;
}

export async function getSubscriberByCustomerId(
  stripeCustomerId: string
): Promise<Subscriber | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("subscribers")
    .select("*")
    .eq("stripe_customer_id", stripeCustomerId)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    console.error("[subscription] getSubscriberByCustomerId error:", error.message);
    return null;
  }
  return data as Subscriber;
}

export interface UpsertPayload {
  email: string;
  stripe_customer_id: string;
  subscription_id?: string | null;
  subscription_status?: string;
  plan?: Plan;
  current_period_end?: string | null;
}

export async function upsertSubscriber(payload: UpsertPayload): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("subscribers").upsert(
    {
      email: payload.email.toLowerCase().trim(),
      stripe_customer_id: payload.stripe_customer_id,
      subscription_id: payload.subscription_id ?? null,
      subscription_status: payload.subscription_status ?? "inactive",
      plan: payload.plan ?? "free",
      current_period_end: payload.current_period_end ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "email" }
  );

  if (error) {
    console.error("[subscription] upsertSubscriber error:", error.message);
    throw error;
  }
  console.log(`[subscription] upserted ${payload.email} → ${payload.plan} / ${payload.subscription_status}`);
}
