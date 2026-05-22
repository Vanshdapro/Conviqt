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

// Global daily spend kill switch. Refilled every UTC midnight.
const DAILY_BUDGET_USD = Number(
  process.env.DAILY_BUDGET_USD ?? 5
); // $5/day default
let dailySpendUSD = 0;
let dailyAnchorMs = Date.now();

export function ensureDailyBudget(estimatedSpendUSD: number) {
  const now = Date.now();
  if (now - dailyAnchorMs > 24 * 60 * 60 * 1000) {
    dailySpendUSD = 0;
    dailyAnchorMs = now;
  }
  if (dailySpendUSD + estimatedSpendUSD > DAILY_BUDGET_USD) {
    throw new Error(
      `Daily Anthropic budget exceeded ($${dailySpendUSD.toFixed(2)} of $${DAILY_BUDGET_USD.toFixed(2)}). Try again tomorrow.`
    );
  }
}

export function recordSpend(usd: number) {
  dailySpendUSD += usd;
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
