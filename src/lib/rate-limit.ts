// In-process token bucket rate limiter. Keyed by IP + route bucket name.
//
// Limitations: state is per-server-instance. On Vercel that means each
// lambda gets its own counter, so the effective limit is per-instance, not
// global. Good enough as a wallet-protection stop-gap; swap for Upstash
// Redis or a Supabase function later for a global counter.
//
// Buckets currently in use:
//   chat/general    : 30 / minute       (router + sometimes general text)
//   chat/analyze    : 6  / minute       (full council run, expensive)
//   chat/pick       : 4  / minute       (picker, web_search heavy)
//   api/analyze     : 12 / minute       (raw endpoint, no chat wrapper)
//   api/pick        : 6  / minute

interface Bucket {
  tokens: number;
  lastRefill: number; // epoch ms
}

const BUCKETS = new Map<string, Bucket>();

// ── Global daily spend kill switch ──────────────────────────────────────────
//
// This is the wallet backstop: once the day's estimated AI spend crosses
// DAILY_BUDGET_USD, every AI route throws and the user sees "try again
// tomorrow" instead of running up the bill.
//
// It is DURABLE and GLOBAL. The old version was a single in-process variable,
// but on Vercel each serverless instance has its own copy and resets to 0 on
// cold start — so the cap never actually accumulated and effectively never
// fired. We now persist the running total to Supabase (`daily_spend` table,
// migration 024) so every instance sees the same number.
//
// Mechanics: `recordSpend` bumps a fast in-process accumulator immediately AND
// fires a durable add to Supabase (no await — never blocks the request). A
// short-lived snapshot of the global total is refreshed in the background. The
// cap check uses max(local accumulator, last global snapshot), so it errs
// toward stopping spend rather than under-counting. Worst-case slop is one
// snapshot interval of spend across cold instances — acceptable for a cap.
const DAILY_BUDGET_USD = Number(
  process.env.DAILY_BUDGET_USD ?? 5
); // $5/day default

const SNAPSHOT_TTL_MS = 20_000; // re-read the global total at most this often

let dailySpendUSD = 0;          // this instance's own accumulated spend today
let dailyAnchorMs = Date.now(); // local day anchor (UTC-midnight rollover)
let globalSnapshotUSD = 0;      // last known GLOBAL total for today (Supabase)
let snapshotFetchedMs = 0;      // when globalSnapshotUSD was last refreshed
let snapshotInFlight = false;   // guard against piling up concurrent reads

function utcDay(): string {
  return new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'
}

// Fire-and-forget background refresh of the global daily total. Never throws,
// never blocks — callers read whatever snapshot is currently cached.
function refreshGlobalSnapshot(): void {
  if (snapshotInFlight) return;
  if (Date.now() - snapshotFetchedMs < SNAPSHOT_TTL_MS) return;
  snapshotInFlight = true;
  void (async () => {
    try {
      const { isSupabaseConfigured } = await import("./watchlist");
      if (!isSupabaseConfigured()) return; // local dev: in-process only
      const { getSupabaseAdmin } = await import("./supabase");
      const db = getSupabaseAdmin();
      const { data } = await db
        .from("daily_spend")
        .select("spent_usd")
        .eq("day", utcDay())
        .single();
      const total = Number((data as { spent_usd: number } | null)?.spent_usd ?? 0);
      // Never let the snapshot drop below what this instance already recorded.
      globalSnapshotUSD = Math.max(total, dailySpendUSD);
      snapshotFetchedMs = Date.now();
    } catch {
      // Missing table / transient error: keep the last snapshot, try again
      // after the TTL. The local accumulator still caps a runaway instance.
    } finally {
      snapshotInFlight = false;
    }
  })();
}

export function ensureDailyBudget(estimatedSpendUSD: number) {
  const now = Date.now();
  if (now - dailyAnchorMs > 24 * 60 * 60 * 1000) {
    dailySpendUSD = 0;
    globalSnapshotUSD = 0;
    snapshotFetchedMs = 0;
    dailyAnchorMs = now;
  }
  refreshGlobalSnapshot(); // async; this call uses the cached value, next call sees fresh
  const effective = Math.max(dailySpendUSD, globalSnapshotUSD);
  if (effective + estimatedSpendUSD > DAILY_BUDGET_USD) {
    throw new Error(
      `Daily AI budget exceeded ($${effective.toFixed(2)} of $${DAILY_BUDGET_USD.toFixed(2)}). Try again tomorrow.`
    );
  }
}

export function recordSpend(usd: number) {
  if (!(usd > 0)) return;
  dailySpendUSD += usd;
  globalSnapshotUSD += usd; // optimistic local bump until the next snapshot
  // Durable, global add — fire-and-forget so it never blocks the response.
  void (async () => {
    try {
      const { isSupabaseConfigured } = await import("./watchlist");
      if (!isSupabaseConfigured()) return;
      const { getSupabaseAdmin } = await import("./supabase");
      const db = getSupabaseAdmin();
      const { data } = await db.rpc("add_daily_spend", {
        p_day: utcDay(),
        p_amount: usd,
      });
      if (typeof data === "number") {
        globalSnapshotUSD = Math.max(globalSnapshotUSD, data);
        snapshotFetchedMs = Date.now();
      }
    } catch (err) {
      console.error(
        "[rate-limit] recordSpend durable write failed:",
        err instanceof Error ? err.message : err
      );
    }
  })();
}

export interface RateLimitConfig {
  bucket: string;
  capacity: number; // max tokens
  refillPerMinute: number; // tokens added per minute
}

export interface RateLimitDecision {
  ok: boolean;
  remaining: number;
  resetMs: number; // approx ms until next token
  retryAfterSeconds: number;
}

function refillBucket(b: Bucket, cfg: RateLimitConfig) {
  const now = Date.now();
  const elapsed = now - b.lastRefill;
  const refill = (elapsed / 60_000) * cfg.refillPerMinute;
  if (refill > 0) {
    b.tokens = Math.min(cfg.capacity, b.tokens + refill);
    b.lastRefill = now;
  }
}

export function checkRateLimit(
  ip: string,
  cfg: RateLimitConfig
): RateLimitDecision {
  const key = `${cfg.bucket}|${ip}`;
  let b = BUCKETS.get(key);
  if (!b) {
    b = { tokens: cfg.capacity, lastRefill: Date.now() };
    BUCKETS.set(key, b);
  }
  refillBucket(b, cfg);

  if (b.tokens < 1) {
    const tokensNeeded = 1 - b.tokens;
    const secondsToWait = (tokensNeeded / cfg.refillPerMinute) * 60;
    return {
      ok: false,
      remaining: 0,
      resetMs: Math.round(secondsToWait * 1000),
      retryAfterSeconds: Math.ceil(secondsToWait),
    };
  }
  b.tokens -= 1;
  return {
    ok: true,
    remaining: Math.floor(b.tokens),
    resetMs: 0,
    retryAfterSeconds: 0,
  };
}

// Extract a stable IP from common headers. Vercel sets x-forwarded-for.
// Falls back to "anon" so the bucket still functions when no IP is given.
export function getClientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  return "anon";
}

export const RATE_LIMITS = {
  chatGeneral: { bucket: "chat/general", capacity: 30, refillPerMinute: 30 },
  chatAnalyze: { bucket: "chat/analyze", capacity: 6, refillPerMinute: 6 },
  chatPick: { bucket: "chat/pick", capacity: 4, refillPerMinute: 4 },
  apiAnalyze: { bucket: "api/analyze", capacity: 12, refillPerMinute: 12 },
  apiPick: { bucket: "api/pick", capacity: 6, refillPerMinute: 6 },
} as const;
