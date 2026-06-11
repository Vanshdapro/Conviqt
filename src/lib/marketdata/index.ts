// Public API of the market data layer. Consumers import ONLY from here:
//
//   import { quote, history, keyStats } from "@/lib/marketdata"  (or relative)
//
// Each call: validate ticker → check cache (memory + Supabase) → walk the
// provider chain (providers.ts) until one answers → cache and return.
//
// All three return null when no provider can answer. Callers render an
// honest "data unavailable" state (CLAUDE.md: never synthetic data, never
// a guessed number). Every successful payload carries provider, sourceUrl,
// and a user-facing freshnessLabel ("delayed ~15 min") — delayed data is
// fine, unlabeled data is not.

import {
  Capability,
  HistoryRange,
  KeyStats,
  PriceHistory,
  ProviderError,
  Quote,
} from "./types";
import { PROVIDER_CHAIN } from "./providers";
import {
  cachedFetch,
  HISTORY_TTL_MS,
  QUOTE_TTL_MS,
  STATS_TTL_MS,
} from "./cache";

export * from "./types";

// US-listed universe: letters, digits, dots/hyphens (BRK.B), optional ^index.
const TICKER_RE = /^[\^]?[A-Z0-9][A-Z0-9.\-]{0,9}$/;

function normalizeTicker(raw: string): string | null {
  const t = raw.trim().toUpperCase();
  return TICKER_RE.test(t) ? t : null;
}

// Walk the chain for one capability. First provider to answer wins; every
// failure is logged with the provider's name so a dead feed is visible in
// the logs the day it dies, not the day a user complains.
async function firstToAnswer<T>(
  capability: Capability,
  call: (p: (typeof PROVIDER_CHAIN)[Capability][number]) => Promise<T>
): Promise<T | null> {
  for (const provider of PROVIDER_CHAIN[capability]) {
    try {
      return await call(provider);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const quiet = err instanceof ProviderError && !err.retryable;
      // Non-retryable = expected skip (dormant adapter, unsupported
      // capability, cooldown) — debug noise, not a warning.
      if (quiet) console.log(`[marketdata] ${capability}: skip ${provider.name}: ${msg}`);
      else console.warn(`[marketdata] ${capability}: ${provider.name} failed: ${msg}`);
    }
  }
  console.warn(`[marketdata] ${capability}: ALL providers failed — returning unavailable`);
  return null;
}

export async function quote(ticker: string): Promise<Quote | null> {
  const t = normalizeTicker(ticker);
  if (!t) return null;
  return cachedFetch<Quote>(`md:quote:${t}`, QUOTE_TTL_MS, () =>
    firstToAnswer("quote", async (p) => {
      const q = await p.quote(t);
      // Boundary invariant: a Quote that leaves this layer has a real,
      // positive price. A 0/NaN/negative price from a feed is a data error —
      // treat it as a provider failure so the chain tries the next source.
      // (Downstream: portfolio weights divide by price; facts render it.)
      if (!Number.isFinite(q.price) || q.price <= 0) {
        throw new ProviderError(p.name, `invalid price ${q.price} for ${t}`);
      }
      return q;
    })
  );
}

export async function history(
  ticker: string,
  range: HistoryRange
): Promise<PriceHistory | null> {
  const t = normalizeTicker(ticker);
  if (!t) return null;
  return cachedFetch<PriceHistory>(`md:history:${t}:${range}`, HISTORY_TTL_MS, () =>
    firstToAnswer("history", (p) => p.history(t, range))
  );
}

export async function keyStats(ticker: string): Promise<KeyStats | null> {
  const t = normalizeTicker(ticker);
  if (!t) return null;
  return cachedFetch<KeyStats>(`md:stats:${t}`, STATS_TTL_MS, () =>
    firstToAnswer("keyStats", (p) => p.keyStats(t))
  );
}
