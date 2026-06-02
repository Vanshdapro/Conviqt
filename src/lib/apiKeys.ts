// Developer API key management — server-only. See migration 016.
//
// Keys are bearer tokens of the form `cvqt_live_<32 hex bytes>`. We store
// ONLY the SHA-256 hash in Postgres; the plaintext is returned to the caller
// exactly once at creation and is unrecoverable thereafter (same posture as
// Stripe/GitHub secret keys). Quota enforcement lives in the DB function
// consume_api_call, which is atomic under concurrency.

import crypto from "crypto";
import { getSupabaseAdmin } from "./supabase";

// ── Tiers ──────────────────────────────────────────────────────────────────

// Monthly call quota per developer tier. free_dev is the no-charge trial tier
// auto-granted on first key creation so devs can integrate before paying.
export const DEVELOPER_TIERS = {
  free_dev: { quota: 25,   label: "Free (trial)" },
  dev_500:  { quota: 500,  label: "Developer" },
  dev_2000: { quota: 2000, label: "Developer Pro" },
} as const;

export type DeveloperTier = keyof typeof DEVELOPER_TIERS;

// ── Types ────────────────────────────────────────────────────────────────────

export interface ApiKeyRow {
  id: number;
  email: string;
  key_prefix: string;
  name: string;
  active: boolean;
  created_at: string;
  last_used_at: string | null;
}

export interface DeveloperAccount {
  email: string;
  tier: DeveloperTier;
  monthly_quota: number;
  calls_used: number;
  period_end: string;
  status: string;
}

export interface ConsumeResult {
  ok: boolean;
  reason: "invalid_key" | "account_suspended" | "quota_exceeded" | "ok";
  email?: string;
  key_id?: number;
  tier?: DeveloperTier;
  remaining?: number;
  quota?: number;
  reset_at?: string;
}

// ── Key crypto ────────────────────────────────────────────────────────────────

const KEY_PREFIX = "cvqt_live_";

function hashKey(plaintext: string): string {
  return crypto.createHash("sha256").update(plaintext).digest("hex");
}

// Build a display prefix that's safe to store/show: the literal prefix plus the
// first 6 chars of the secret so a user can tell their keys apart in a list.
function displayPrefix(plaintext: string): string {
  const secret = plaintext.slice(KEY_PREFIX.length);
  return `${KEY_PREFIX}${secret.slice(0, 6)}…`;
}

// Pull a bearer key out of an incoming request. Accepts both
// `Authorization: Bearer cvqt_live_…` and `x-api-key: cvqt_live_…`.
export function extractApiKey(req: Request): string | null {
  const auth = req.headers.get("authorization");
  if (auth) {
    const m = auth.match(/^Bearer\s+(.+)$/i);
    if (m) return m[1].trim();
  }
  const x = req.headers.get("x-api-key");
  if (x) return x.trim();
  return null;
}

// ── Writes ───────────────────────────────────────────────────────────────────

// Mint a new key for a developer. Auto-provisions a free-tier entitlement so
// the key is immediately usable. Returns the PLAINTEXT once — never stored.
export async function createApiKey(
  email: string,
  name: string
): Promise<{ id: number; plaintext: string; prefix: string }> {
  const supabase = getSupabaseAdmin();
  const normalized = email.toLowerCase().trim();

  // Ensure the developer has at least a free-tier entitlement.
  const { error: ensureErr } = await supabase.rpc("ensure_developer_account", {
    p_email: normalized,
  });
  if (ensureErr) {
    console.error("[apiKeys] ensure_developer_account error:", ensureErr.message);
    throw new Error("Could not initialise developer account.");
  }

  const plaintext = `${KEY_PREFIX}${crypto.randomBytes(32).toString("hex")}`;
  const key_hash = hashKey(plaintext);
  const key_prefix = displayPrefix(plaintext);
  const cleanName = (name || "default").trim().slice(0, 60) || "default";

  const { data, error } = await supabase
    .from("api_keys")
    .insert({ email: normalized, key_hash, key_prefix, name: cleanName })
    .select("id")
    .single();

  if (error) {
    console.error("[apiKeys] createApiKey insert error:", error.message);
    throw new Error("Could not create API key.");
  }

  console.log(`[apiKeys] minted key id=${data.id} for ${normalized} (${cleanName})`);
  return { id: data.id, plaintext, prefix: key_prefix };
}

// Soft-revoke a key (sets active=false, stamps revoked_at). Scoped to the
// owner's email so one user can never revoke another's key.
export async function revokeApiKey(email: string, id: number): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  const { error, count } = await supabase
    .from("api_keys")
    .update({ active: false, revoked_at: new Date().toISOString() }, { count: "exact" })
    .eq("id", id)
    .eq("email", email.toLowerCase().trim())
    .eq("active", true);

  if (error) {
    console.error("[apiKeys] revokeApiKey error:", error.message);
    return false;
  }
  return (count ?? 0) > 0;
}

// Atomically verify a key and bill one call against its owner's quota.
// All enforcement (lookup, window roll, quota check, increment) is in the DB.
export async function consumeApiCall(plaintext: string): Promise<ConsumeResult> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.rpc("consume_api_call", {
    p_key_hash: hashKey(plaintext),
  });

  if (error) {
    console.error("[apiKeys] consume_api_call RPC error:", error.message);
    return { ok: false, reason: "invalid_key" };
  }
  return data as ConsumeResult;
}

// Provision or upgrade a developer's entitlement after a successful Stripe
// payment / renewal. Resets the monthly usage window. Called from the webhook.
export async function setDeveloperTier(
  email: string,
  tier: DeveloperTier,
  monthlyQuota: number,
  subscriptionId?: string | null
): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.rpc("set_developer_tier", {
    p_email: email.toLowerCase().trim(),
    p_tier: tier,
    p_monthly_quota: monthlyQuota,
    p_subscription: subscriptionId ?? null,
    p_status: "active",
  });
  if (error) {
    console.error("[apiKeys] setDeveloperTier RPC error:", error.message);
    throw error;
  }
  console.log(`[apiKeys] set tier ${tier} (${monthlyQuota}/mo) for ${email}`);
}

// Flip a developer's billing status (past_due / canceled / active) without
// disturbing usage. A non-active status fails closed at consume_api_call.
export async function setDeveloperStatus(
  email: string,
  status: "active" | "past_due" | "canceled"
): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.rpc("set_developer_status", {
    p_email: email.toLowerCase().trim(),
    p_status: status,
  });
  if (error) {
    console.error("[apiKeys] setDeveloperStatus RPC error:", error.message);
    throw error;
  }
  console.log(`[apiKeys] set status ${status} for ${email}`);
}

// Record one billed (or rejected) call for analytics + abuse forensics.
// Best-effort: a logging failure must never break the API response.
export async function logApiCall(params: {
  keyId: number;
  email: string;
  ticker: string;
  status: "ok" | "quota_exceeded" | "error";
  costUSD?: number;
  latencyMs?: number;
}): Promise<void> {
  try {
    const supabase = getSupabaseAdmin();
    await supabase.from("api_call_log").insert({
      key_id: params.keyId,
      email: params.email.toLowerCase().trim(),
      endpoint: "analyze",
      ticker: params.ticker,
      status: params.status,
      cost_usd: params.costUSD ?? 0,
      latency_ms: params.latencyMs ?? null,
    });
  } catch (err) {
    console.error("[apiKeys] logApiCall failed:", err instanceof Error ? err.message : err);
  }
}

// ── Reads ────────────────────────────────────────────────────────────────────

export async function listApiKeys(email: string): Promise<ApiKeyRow[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("api_keys")
    .select("id, email, key_prefix, name, active, created_at, last_used_at")
    .eq("email", email.toLowerCase().trim())
    .eq("active", true)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[apiKeys] listApiKeys error:", error.message);
    return [];
  }
  return (data ?? []) as ApiKeyRow[];
}

export async function getDeveloperAccount(
  email: string
): Promise<DeveloperAccount | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("developer_accounts")
    .select("email, tier, monthly_quota, calls_used, period_end, status")
    .eq("email", email.toLowerCase().trim())
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    console.error("[apiKeys] getDeveloperAccount error:", error.message);
    return null;
  }
  return data as DeveloperAccount;
}
