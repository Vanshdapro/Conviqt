// Finnhub adapter — dormant free-key fallback.
//
// The kill-switch for the day the keyless feeds die (playbook Part 6, #3):
// sign up at finnhub.io (free tier: 60 calls/min), set FINNHUB_API_KEY in
// the environment, and move this provider up the chain in providers.ts.
// Until the key exists, every method throws a non-retryable ProviderError
// and the chain skips over it at zero cost.
//
// Free-tier coverage (as of 2026): /quote is real-time for US stocks and
// /stock/metric covers market cap + P/E + 52w range. /stock/candle (history)
// is NO LONGER on the free tier — history() maps the 403 to a clear error so
// the chain falls through to whichever keyless source still works.

import {
  FRESHNESS_LABELS,
  HistoryRange,
  KeyStats,
  MarketDataProvider,
  PriceHistory,
  ProviderError,
  Quote,
} from "../types";
import { configureBucket, fetchRaw } from "../http";

const NAME = "finnhub" as const;
const BASE = "https://finnhub.io/api/v1";

// Finnhub free tier: 60 req/min. Capacity 12 so a Portfolio render with a
// dozen tickers can fetch quotes in parallel without queueing.
configureBucket(NAME, 60, 12);

function apiKey(): string {
  return (process.env.FINNHUB_API_KEY ?? "").trim();
}

export function finnhubConfigured(): boolean {
  return apiKey().length > 0;
}

function assertConfigured(): string {
  const key = apiKey();
  if (!key) {
    throw new ProviderError(NAME, "FINNHUB_API_KEY not set — adapter dormant", false);
  }
  return key;
}

async function finnhubJson<T>(path: string, params: Record<string, string>): Promise<T> {
  const key = assertConfigured();
  const qs = new URLSearchParams({ ...params, token: key }).toString();
  const res = await fetchRaw(`${BASE}${path}?${qs}`, {
    provider: NAME,
    // Finnhub free tier limits 60/min; back off a full minute on 429.
    rateLimitCooldownMs: 60 * 1000,
  });
  if (res.status === 403) {
    throw new ProviderError(NAME, `${path}: 403 — endpoint not included in the free tier`, false);
  }
  if (!res.ok) {
    throw new ProviderError(NAME, `${path}: HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

function publicPageUrl(ticker: string): string {
  return `https://finnhub.io/quote/${ticker.toUpperCase()}`;
}

async function quote(ticker: string): Promise<Quote> {
  const sym = ticker.trim().toUpperCase();
  // c = current, pc = previous close, t = epoch seconds. c === 0 → unknown symbol.
  const d = await finnhubJson<{ c?: number; pc?: number; t?: number }>("/quote", { symbol: sym });
  if (!d.c || !Number.isFinite(d.c)) {
    throw new ProviderError(NAME, `quote: no price for ${sym} (unknown symbol?)`);
  }
  const prevClose = d.pc && Number.isFinite(d.pc) ? d.pc : null;
  return {
    ticker: sym,
    price: d.c,
    prevClose,
    changePct:
      prevClose && prevClose > 0
        ? Math.round(((d.c - prevClose) / prevClose) * 10000) / 100
        : null,
    currency: "USD",
    asOf: d.t ? new Date(d.t * 1000).toISOString() : new Date().toISOString(),
    freshness: "realtime",
    freshnessLabel: FRESHNESS_LABELS.realtime,
    provider: NAME,
    sourceUrl: publicPageUrl(sym),
  };
}

async function history(_ticker: string, _range: HistoryRange): Promise<PriceHistory> {
  assertConfigured();
  // /stock/candle moved off the free tier in 2024. Implemented as an explicit
  // refusal so the chain documents WHY it skipped, instead of a mystery 403.
  throw new ProviderError(NAME, "history: /stock/candle is not on the Finnhub free tier", false);
}

async function keyStats(ticker: string): Promise<KeyStats> {
  const sym = ticker.trim().toUpperCase();
  interface MetricResp {
    metric?: {
      marketCapitalization?: number; // in MILLIONS of USD
      peTTM?: number;
      "52WeekHigh"?: number;
      "52WeekLow"?: number;
    };
  }
  const d = await finnhubJson<MetricResp>("/stock/metric", { symbol: sym, metric: "all" });
  const m = d.metric;
  if (!m) {
    throw new ProviderError(NAME, `keyStats: empty metrics for ${sym}`);
  }
  const marketCap =
    typeof m.marketCapitalization === "number" && Number.isFinite(m.marketCapitalization)
      ? m.marketCapitalization * 1_000_000 // Finnhub reports millions
      : null;
  const peRatio = typeof m.peTTM === "number" && Number.isFinite(m.peTTM) ? m.peTTM : null;
  const week52High = typeof m["52WeekHigh"] === "number" ? m["52WeekHigh"] : null;
  const week52Low = typeof m["52WeekLow"] === "number" ? m["52WeekLow"] : null;
  return {
    ticker: sym,
    marketCap,
    peRatio,
    week52High,
    week52Low,
    volume: null, // not in /stock/metric; quote/chart sources cover it
    asOf: new Date().toISOString(),
    freshnessLabel: FRESHNESS_LABELS.realtime,
    provider: NAME,
    sourceUrl: publicPageUrl(sym),
    partial: true,
  };
}

export const finnhubProvider: MarketDataProvider = {
  name: NAME,
  quote,
  history,
  keyStats,
};
