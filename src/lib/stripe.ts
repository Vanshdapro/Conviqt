// Stripe singleton — server-only. Never import this in client components.
//
// Price IDs live in env vars. Create the products in Stripe Dashboard first,
// then paste the price IDs into .env.local / Vercel environment variables.
//
// THE PLAN WE SELL (founder pricing call 2026-06-14 — month-to-month only):
//   Pro (monthly)  $8/mo  recurring, 7-day trial → STRIPE_PRICE_PRO_MONTHLY
//   Dashboard setup: one "Conviqt Pro" product with a single $8/mo price, run
//   with subscription_data.trial_period_days = 7. No annual plan is offered.
//
// LEGACY (no longer sold, webhook still honors live subscriptions/sessions):
//   Pro (annual) — annual billing retired 2026-06-14; the price id/env stay so
//   any live annual sub keeps renewing, but checkout no longer offers it.
//   Credit packs (credits_500…3000) — one-time; retired with the credit brand.
//   Max / Max Pro — old credit subscriptions; renewals still reset credits.
//   Developer / Developer Pro — API call quota (migration 016); the /developers
//   surface is retired in Phase 8, existing subscriptions keep working.

import Stripe from "stripe";

function readEnvLocal(): Map<string, string> {
  if (process.env.NODE_ENV !== "development") return new Map();
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require("fs") as typeof import("fs");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require("path") as typeof import("path");
    const text = fs.readFileSync(path.resolve(process.cwd(), ".env.local"), "utf8");
    const map = new Map<string, string>();
    for (const line of text.split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.+)$/);
      if (m) map.set(m[1], m[2].trim());
    }
    return map;
  } catch {
    return new Map();
  }
}

function resolveVar(name: string): string {
  const fromEnv = process.env[name] ?? "";
  if (fromEnv.trim()) return fromEnv.trim();
  return readEnvLocal().get(name) ?? fromEnv;
}

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (_stripe) return _stripe;
  const key = resolveVar("STRIPE_SECRET_KEY");
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  _stripe = new Stripe(key, { apiVersion: "2026-05-27.dahlia" });
  return _stripe;
}

export function getWebhookSecret(): string {
  const secret = resolveVar("STRIPE_WEBHOOK_SECRET");
  if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET is not set");
  return secret;
}

export function getSiteUrl(): string {
  // Fallback must match the canonical host used in metadata (www). A non-www
  // redirect after Stripe checkout lands on a different origin than the one
  // that holds the session cookie, which silently logs the user out.
  return resolveVar("NEXT_PUBLIC_SITE_URL") || "https://www.conviqt.com";
}

// ── Plan definitions ─────────────────────────────────────────────────────────

export type CreditPack      = "credits_500" | "credits_1000" | "credits_2000" | "credits_3000";
export type ProPlan          = "pro_monthly" | "pro_annual";
export type SubscriptionPlan = ProPlan | "max_monthly" | "max_pro_monthly";
export type DeveloperPlan    = "dev_500" | "dev_2000";
export type PlanId           = CreditPack | SubscriptionPlan | DeveloperPlan;

/** Days of free trial on every Pro checkout (playbook 2.4). */
export const TRIAL_DAYS = 7;

export const SUBSCRIPTION_PLANS = new Set<PlanId>([
  "pro_monthly",
  "pro_annual",
  "max_monthly",
  "max_pro_monthly",
  "dev_500",
  "dev_2000",
]);

// The Pro subscription — the only consumer plan sold since Phase 7. Pro is a
// plan-state entitlement (subscribers table), NOT a credit grant.
export const PRO_PLANS = new Set<PlanId>(["pro_monthly", "pro_annual"]);

// What checkout will still sell. Annual Pro, credit packs, the Max plans, and
// the Developer (API) plans are retired — existing subscriptions keep working
// through the webhook, but no new sales. Pro monthly ($8/mo) is the only thing
// money buys (founder pricing call 2026-06-14).
export const PURCHASABLE_PLANS = new Set<PlanId>([
  "pro_monthly",
]);

// LEGACY: Developer (API) plans — the /developers surface and the public /v1
// API retired in Phase 8. The sets below survive only so the webhook can keep
// honoring any live legacy subscription without misrouting it.
export const DEVELOPER_PLANS = new Set<PlanId>(["dev_500", "dev_2000"]);

/** Monthly API call quota granted by each developer plan. */
export const API_QUOTA_BY_PLAN: Record<DeveloperPlan, number> = {
  dev_500:  500,
  dev_2000: 2000,
};

/** Credits granted on purchase (one-time packs) or per monthly cycle (subscriptions). */
export const CREDITS_BY_PLAN: Record<PlanId, number> = {
  credits_500:     500,
  credits_1000:   1000,
  credits_2000:   2000,
  credits_3000:   3000,
  pro_monthly:       0,   // Pro is plan-state, not a credit grant (Phase 7)
  pro_annual:        0,
  max_monthly:    4000,   // legacy: 3 500 base + 500 loyalty bonus
  max_pro_monthly: 7500,  // legacy: 6 000 base + 1 500 loyalty bonus
  dev_500:           0,   // grants API quota, not credits
  dev_2000:          0,
};

const PLAN_ENV_MAP: Record<PlanId, string> = {
  credits_500:     "STRIPE_PRICE_CREDITS_500",
  credits_1000:    "STRIPE_PRICE_CREDITS_1000",
  credits_2000:    "STRIPE_PRICE_CREDITS_2000",
  credits_3000:    "STRIPE_PRICE_CREDITS_3000",
  pro_monthly:     "STRIPE_PRICE_PRO_MONTHLY",
  pro_annual:      "STRIPE_PRICE_PRO_ANNUAL",
  max_monthly:     "STRIPE_PRICE_MAX_MONTHLY",
  max_pro_monthly: "STRIPE_PRICE_MAX_PRO_MONTHLY",
  dev_500:         "STRIPE_PRICE_DEV_500",
  dev_2000:        "STRIPE_PRICE_DEV_2000",
};

export function getPriceId(plan: PlanId): string {
  const envVar = PLAN_ENV_MAP[plan];
  if (!envVar) throw new Error(`Unknown plan: ${plan}`);
  const id = resolveVar(envVar);
  if (!id) throw new Error(`Price ID not configured for ${plan} (env: ${envVar})`);
  // Stripe Price IDs must start with "price_". Product IDs (prod_...) will fail at checkout.
  if (!id.startsWith("price_")) {
    throw new Error(`${envVar} contains "${id.slice(0, 10)}..." which looks like a Product ID, not a Price ID. Go to Stripe Dashboard → Products → [product] → copy the price_ ID.`);
  }
  return id;
}

export const ALL_PLANS = new Set<string>(Object.keys(PLAN_ENV_MAP));
