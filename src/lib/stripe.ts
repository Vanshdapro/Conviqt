// Stripe singleton — server-only. Never import this in client components.
//
// Price IDs live in env vars. Create the products in Stripe Dashboard first,
// then paste the price IDs into .env.local / Vercel environment variables.
//
// Products to create (Products → Add product):
//   Pro Starter   500 credits  $5     one-time   → STRIPE_PRICE_CREDITS_500
//   Pro Standard  1000 credits $9     one-time   → STRIPE_PRICE_CREDITS_1000
//   Pro Plus      2000 credits $16    one-time   → STRIPE_PRICE_CREDITS_2000
//   Pro Power     3000 credits $24    one-time   → STRIPE_PRICE_CREDITS_3000
//   Max           4000 cr/mo   $28/mo recurring  → STRIPE_PRICE_MAX_MONTHLY
//   Max Pro       7500 cr/mo   $52/mo recurring  → STRIPE_PRICE_MAX_PRO_MONTHLY

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
  return resolveVar("NEXT_PUBLIC_SITE_URL") || "https://conviqt.com";
}

// ── Plan definitions ─────────────────────────────────────────────────────────

export type CreditPack      = "credits_500" | "credits_1000" | "credits_2000" | "credits_3000";
export type SubscriptionPlan = "max_monthly" | "max_pro_monthly";
export type PlanId           = CreditPack | SubscriptionPlan;

export const SUBSCRIPTION_PLANS = new Set<PlanId>(["max_monthly", "max_pro_monthly"]);

/** Credits granted on purchase (one-time packs) or per monthly cycle (subscriptions). */
export const CREDITS_BY_PLAN: Record<PlanId, number> = {
  credits_500:     500,
  credits_1000:   1000,
  credits_2000:   2000,
  credits_3000:   3000,
  max_monthly:    4000,   // 3 500 base + 500 loyalty bonus
  max_pro_monthly: 7500,  // 6 000 base + 1 500 loyalty bonus
};

const PLAN_ENV_MAP: Record<PlanId, string> = {
  credits_500:     "STRIPE_PRICE_CREDITS_500",
  credits_1000:    "STRIPE_PRICE_CREDITS_1000",
  credits_2000:    "STRIPE_PRICE_CREDITS_2000",
  credits_3000:    "STRIPE_PRICE_CREDITS_3000",
  max_monthly:     "STRIPE_PRICE_MAX_MONTHLY",
  max_pro_monthly: "STRIPE_PRICE_MAX_PRO_MONTHLY",
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
