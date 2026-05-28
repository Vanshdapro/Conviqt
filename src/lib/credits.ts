// Credit management — server-only.
//
// Every user (free and paid) gets a row in user_credits (see migration 004).
// All mutations go through Postgres functions to guarantee atomicity — no
// two concurrent requests can deduct the same credits.
//
// Credit costs per intent (deducted before the pipeline runs):
//   analyze  — 15 credits  (Full Council, 6-agent pipeline)
//   focused  —  8 credits  (Focused sweep + Haiku judge)
//   general  — 18 credits  (Sonnet analyst + up to 3 web_search calls)
//   cache    —  1 credit   (any intent that hits the 4h cache)
//   pick     —  0 credits  (text redirect only, no pipeline)
//
// Monthly allowances:
//   free          →  50 credits / month (reset by grant_free_credits_if_due)
//   pro (any pack) →  one-time top-up, never expires
//   max_monthly    → 4 000 credits / month (25 % rollover)
//   max_pro_monthly → 7 500 credits / month (25 % rollover)

import { getSupabaseAdmin } from "./supabase";

// ── Constants ────────────────────────────────────────────────────────────────

export const FREE_MONTHLY_CREDITS = 50;

export const CREDITS_PER_INTENT = {
  analyze: 15,
  focused: 8,
  general: 18,
  cache:   1,
  pick:    0,
} as const;

export type Intent = keyof typeof CREDITS_PER_INTENT;

/** Credits granted per monthly reset for Max plans. */
export const MAX_PLAN_MONTHLY_CREDITS: Record<string, number> = {
  max_monthly:     4000,  // 3 500 base + 500 bonus
  max_pro_monthly: 7500,  // 6 000 base + 1 500 bonus
};

// ── Types ────────────────────────────────────────────────────────────────────

export interface UserCredits {
  email:            string;
  credits:          number;
  plan:             string;
  credits_reset_at: string | null;
}

// ── Reads ────────────────────────────────────────────────────────────────────

export async function getCredits(email: string): Promise<UserCredits | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("user_credits")
    .select("email, credits, plan, credits_reset_at")
    .eq("email", email.toLowerCase().trim())
    .single();

  if (error) {
    if (error.code === "PGRST116") return null; // row not found
    console.error("[credits] getCredits error:", error.message);
    return null;
  }
  return data as UserCredits;
}

// ── Writes ───────────────────────────────────────────────────────────────────

/**
 * Atomically deducts `amount` credits from the user.
 * Returns { ok: true, remaining } on success, { ok: false } if insufficient.
 */
export async function deductCredits(
  email:    string,
  amount:   number,
  reason:   string,
  costUSD = 0,
): Promise<{ ok: boolean; remaining: number }> {
  if (amount === 0) return { ok: true, remaining: -1 }; // pick redirect — no-op

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.rpc("deduct_credits", {
    p_email:    email.toLowerCase().trim(),
    p_credits:  amount,
    p_reason:   reason,
    p_cost_usd: costUSD,
  });

  if (error) {
    console.error("[credits] deductCredits RPC error:", error.message);
    return { ok: false, remaining: 0 };
  }

  const result = data as { ok: boolean; remaining: number };
  if (!result.ok) {
    console.log(`[credits] insufficient for ${email}: need ${amount}, have ${result.remaining}`);
  } else {
    console.log(`[credits] deducted ${amount} (${reason}) for ${email} → remaining=${result.remaining}`);
  }
  return result;
}

/**
 * Adds credits to a user's account (or creates the row).
 * Called from the Stripe webhook on successful payment.
 */
export async function addCredits(
  email:   string,
  amount:  number,
  reason:  string,
  plan?:   string,
): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.rpc("add_credits", {
    p_email:   email.toLowerCase().trim(),
    p_credits: amount,
    p_reason:  reason,
    p_plan:    plan ?? null,
  });

  if (error) {
    console.error("[credits] addCredits RPC error:", error.message);
    throw error;
  }
  console.log(`[credits] added ${amount} (${reason}) for ${email}, plan=${plan}`);
}

/**
 * Monthly renewal for Max subscriptions. Resets to the full monthly
 * allowance and carries over up to 25 % of unused credits.
 */
export async function resetSubscriptionCredits(
  email:          string,
  monthlyCredits: number,
  plan:           string,
): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.rpc("reset_subscription_credits", {
    p_email:           email.toLowerCase().trim(),
    p_monthly_credits: monthlyCredits,
    p_plan:            plan,
  });

  if (error) {
    console.error("[credits] resetSubscriptionCredits RPC error:", error.message);
    throw error;
  }
  console.log(`[credits] reset subscription credits for ${email} → ${monthlyCredits} (${plan})`);
}

/**
 * Initialises a free-tier user (50 credits) or refreshes their monthly
 * allocation if the reset date has passed. Safe to call on every first
 * chat request — it's a no-op when credits haven't expired yet.
 */
export async function grantFreeCreditsIfDue(email: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.rpc("grant_free_credits_if_due", {
    p_email: email.toLowerCase().trim(),
  });
  if (error) {
    console.error("[credits] grantFreeCreditsIfDue error:", error.message);
    // Non-fatal — the user may just be unable to get free credits right now.
  }
}
