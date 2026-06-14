// Shared HTTP plumbing for the free keyless market data providers.
//
// These endpoints are unofficial and hostile to automation: they rate-limit
// datacenter IPs (Yahoo 429s), serve HTML error pages with status 200
// (Stooq), and change behavior without notice. Everything here is defensive:
// hard timeouts, browser-like headers, and a per-provider cooldown so one
// angry endpoint doesn't get hammered in a retry loop.

import { ProviderError, ProviderName } from "./types";

const DEFAULT_TIMEOUT_MS = 8_000;

// A stable browser-ish UA. Both Stooq and Yahoo reject default fetch/curl UAs.
export const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

// ── Per-provider cooldown ────────────────────────────────────────────────────
// When a provider answers 429/403, we stop calling it for a window instead of
// burning requests (and goodwill). Per-instance state — on Vercel each warm
// lambda keeps its own, which is fine: the point is to stop tight retry loops.

const cooldownUntil = new Map<ProviderName, number>();

export function startCooldown(provider: ProviderName, ms: number) {
  cooldownUntil.set(provider, Date.now() + ms);
  console.warn(
    `[marketdata:${provider}] cooling down for ${Math.round(ms / 1000)}s after rate-limit/refusal`
  );
}

export function assertNotCoolingDown(provider: ProviderName) {
  const until = cooldownUntil.get(provider) ?? 0;
  if (Date.now() < until) {
    throw new ProviderError(
      provider,
      `in cooldown for another ${Math.round((until - Date.now()) / 1000)}s`,
      false
    );
  }
}

// ── Proactive token-bucket per provider ──────────────────────────────────────
// The free tiers we use have small per-minute ceilings (Twelve Data 8/min,
// Finnhub 60/min). The Supabase cache already takes most reads off the wire,
// but a burst-y page (Portfolio with 30 tickers) can still light up a provider
// fast enough to trip a 429. The bucket refills linearly; if it's empty we
// throw NON-RETRYABLE so the chain falls through to the next provider rather
// than queueing.

interface Bucket {
  tokens: number;
  capacity: number;
  refillPerMs: number; // tokens per millisecond
  lastRefill: number;
}

const buckets = new Map<ProviderName, Bucket>();

export function configureBucket(
  provider: ProviderName,
  perMinute: number,
  capacity = perMinute
) {
  buckets.set(provider, {
    tokens: capacity,
    capacity,
    refillPerMs: perMinute / 60_000,
    lastRefill: Date.now(),
  });
}

export function takeToken(provider: ProviderName) {
  const b = buckets.get(provider);
  if (!b) return; // unconfigured = no limit
  const now = Date.now();
  const elapsed = now - b.lastRefill;
  if (elapsed > 0) {
    b.tokens = Math.min(b.capacity, b.tokens + elapsed * b.refillPerMs);
    b.lastRefill = now;
  }
  if (b.tokens < 1) {
    const waitMs = Math.ceil((1 - b.tokens) / b.refillPerMs);
    throw new ProviderError(
      provider,
      `local rate limit: bucket empty (wait ${Math.ceil(waitMs / 1000)}s)`,
      false
    );
  }
  b.tokens -= 1;
}

// ── Fetch helpers ────────────────────────────────────────────────────────────

export interface FetchOpts {
  provider: ProviderName;
  headers?: Record<string, string>;
  timeoutMs?: number;
  // Cooldown applied when the endpoint answers 429 (rate limit).
  rateLimitCooldownMs?: number;
}

export async function fetchRaw(url: string, opts: FetchOpts): Promise<Response> {
  const { provider, headers, timeoutMs = DEFAULT_TIMEOUT_MS } = opts;
  assertNotCoolingDown(provider);
  takeToken(provider);

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { "User-Agent": BROWSER_UA, ...headers },
      signal: AbortSignal.timeout(timeoutMs),
      // These are point-in-time market reads; never let a framework cache lie.
      cache: "no-store",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new ProviderError(provider, `fetch failed: ${msg}`);
  }

  if (res.status === 429) {
    startCooldown(provider, opts.rateLimitCooldownMs ?? 5 * 60 * 1000);
    throw new ProviderError(provider, "rate limited (429)");
  }
  return res;
}

export async function fetchText(url: string, opts: FetchOpts): Promise<string> {
  const res = await fetchRaw(url, opts);
  if (!res.ok) {
    throw new ProviderError(opts.provider, `HTTP ${res.status} for ${url}`);
  }
  return res.text();
}

export async function fetchJson<T>(url: string, opts: FetchOpts): Promise<T> {
  const res = await fetchRaw(url, opts);
  if (!res.ok) {
    throw new ProviderError(opts.provider, `HTTP ${res.status} for ${url}`);
  }
  try {
    return (await res.json()) as T;
  } catch {
    throw new ProviderError(opts.provider, `non-JSON response for ${url}`);
  }
}
