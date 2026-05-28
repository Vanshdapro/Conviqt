// Subscription helpers — server-only.
//
// Subscription state is stored in the `subscribers` Supabase table:
//   email                  text (unique)
//   stripe_customer_id     text (unique)
//   subscription_id        text | null
//   subscription_status    text  -- 'active' | 'trialing' | 'past_due' | 'canceled' | 'inactive'
//   plan                   text  -- 'free' | 'pro' | 'pro_annual' | 'deep_dive'
//   current_period_end     timestamptz | null
//   created_at / updated_at
//
// Call `upsertSubscriber` from the webhook handler to keep this in sync.
// Call `getSubscriberByEmail` from API routes to gate premium features.

import { getSupabaseAdmin } from "./supabase";

export interface Subscriber {
  email: string;
  stripe_customer_id: string;
  subscription_id: string | null;
  subscription_status: string;
  plan: string;
  current_period_end: string | null;
}

export type Plan = "free" | "pro" | "max_monthly" | "max_pro_monthly";

export function isPremium(subscriber: Subscriber | null): boolean {
  if (!subscriber) return false;
  const active = ["active", "trialing"].includes(subscriber.subscription_status);
  const paid = ["pro_monthly", "pro_annual", "deep_dive"].includes(subscriber.plan);
  return active && paid;
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
