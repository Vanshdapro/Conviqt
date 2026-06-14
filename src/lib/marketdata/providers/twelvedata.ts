// Twelve Data adapter — PRIMARY for quote + history (founder decision 2026-06-14).
//
// Twelve Data is the keyed free-tier feed that replaces Stooq/Yahoo as the
// load-bearing source for US-listed quotes and intraday/EOD price history.
// Free tier ceiling: 8 req/min, 800 req/day. The proactive token bucket in
// ../http.ts (`takeToken("twelvedata")`) enforces the per-minute side; the
// Supabase cache layer (15 min quotes, 24 h history) is what keeps us under
// the daily wall in practice. /statistics is plan-gated on the free tier, so
// keyStats() throws non-retryable and the chain falls through to Finnhub.
//
// Activation: TWELVE_DATA_API_KEY in env. Without the key the adapter throws
// non-retryably and the chain skips it at zero cost (so local dev without
// the secret degrades to Stooq/Yahoo cleanly).
//
// Endpoint shapes (paraphrased — see https://twelvedata.com/docs):
//   /quote?symbol=AAPL          → {symbol, name, close, previous_close,
//                                   change, percent_change, datetime, ...}
//   /time_series?symbol=AAPL    → {meta:{...}, values:[{datetime, open, high,
//     &interval=1day              low, close, volume}], status:"ok"}
//     &start_date=&end_date=
//
// Twelve Data may answer with status:"error" inside an HTTP-200 body (their
// way of reporting bad symbols / plan limits). We surface that as a retryable
// ProviderError so the chain tries the next provider.

import {
  Candle,
  FRESHNESS_LABELS,
  HISTORY_RANGE_DAYS,
  HistoryRange,
  KeyStats,
  MarketDataProvider,
  PriceHistory,
  ProviderError,
  Quote,
} from "../types";
import { configureBucket, fetchRaw } from "../http";

const NAME = "twelvedata" as const;
const BASE = "https://api.twelvedata.com";

// 8 req/min free tier, but allow a small burst (capacity 4) so a single page
// can fetch a few tickers concurrently without each one waiting 7.5s.
configureBucket(NAME, 8, 4);

function apiKey(): string {
  return (process.env.TWELVE_DATA_API_KEY ?? "").trim();
}

export function twelveDataConfigured(): boolean {
  return apiKey().length > 0;
}

function assertConfigured(): string {
  const key = apiKey();
  if (!key) {
    throw new ProviderError(NAME, "TWELVE_DATA_API_KEY not set — adapter dormant", false);
  }
  return key;
}

// Twelve Data uses dots for share classes (BRK.B) like the wire ticker — no
// transformation needed for US equities.
function tdSymbol(ticker: string): string {
  return ticker.trim().toUpperCase();
}

function publicPageUrl(ticker: string): string {
  return `https://twelvedata.com/symbol/${tdSymbol(ticker)}`;
}

interface TdEnvelope {
  status?: string; // "ok" | "error"
  code?: number; // Twelve Data error code (404, 429, 401, ...)
  message?: string;
}

async function tdJson<T>(path: string, params: Record<string, string>): Promise<T> {
  const key = assertConfigured();
  const qs = new URLSearchParams({ ...params, apikey: key }).toString();
  const res = await fetchRaw(`${BASE}${path}?${qs}`, {
    provider: NAME,
    // Free tier minutely cap → 60s cooldown on 429 so we don't burn the bucket.
    rateLimitCooldownMs: 60 * 1000,
  });
  if (res.status === 401 || res.status === 403) {
    throw new ProviderError(NAME, `${path}: HTTP ${res.status} — invalid key or plan-gated`, false);
  }
  if (!res.ok) {
    throw new ProviderError(NAME, `${path}: HTTP ${res.status}`);
  }
  const body = (await res.json()) as T & TdEnvelope;
  if (body && typeof body === "object" && body.status === "error") {
    // 404 / 400 = unknown symbol = retryable (chain tries next provider);
    // 401 / 403 = key/plan = non-retryable (next chain hit would just fail too).
    const code = body.code ?? 0;
    const nonRetryable = code === 401 || code === 403;
    throw new ProviderError(
      NAME,
      `${path}: ${body.message ?? "error"} (code ${code})`,
      !nonRetryable
    );
  }
  return body;
}

// ── /quote ───────────────────────────────────────────────────────────────────

interface TdQuoteResp {
  symbol?: string;
  name?: string;
  exchange?: string;
  currency?: string;
  datetime?: string; // "2024-06-13 15:59:00" (exchange-local) or "2024-06-13"
  timestamp?: number; // epoch seconds (sometimes present)
  open?: string | number;
  high?: string | number;
  low?: string | number;
  close?: string | number;
  volume?: string | number;
  previous_close?: string | number;
  change?: string | number;
  percent_change?: string | number;
  is_market_open?: boolean;
}

function num(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "string" ? Number(v) : (v as number);
  return Number.isFinite(n) ? n : null;
}

async function quote(ticker: string): Promise<Quote> {
  const sym = tdSymbol(ticker);
  const d = await tdJson<TdQuoteResp>("/quote", { symbol: sym });
  const price = num(d.close);
  if (price === null) {
    throw new ProviderError(NAME, `quote: no price for ${sym} (unknown symbol?)`);
  }
  const prevClose = num(d.previous_close);
  const reported = num(d.percent_change);
  const changePct =
    reported !== null
      ? Math.round(reported * 100) / 100
      : prevClose !== null && prevClose > 0
        ? Math.round(((price - prevClose) / prevClose) * 10000) / 100
        : null;
  // Twelve Data timestamps come back as epoch seconds when available, else a
  // local-clock string we just hand to Date(); the fetched-now fallback is
  // safe because freshnessLabel already promises "delayed ~15 min".
  const asOf =
    typeof d.timestamp === "number"
      ? new Date(d.timestamp * 1000).toISOString()
      : d.datetime
        ? new Date(d.datetime.replace(" ", "T") + "Z").toISOString()
        : new Date().toISOString();
  return {
    ticker: sym,
    price,
    prevClose,
    changePct,
    currency: (d.currency || "USD").toUpperCase(),
    asOf,
    freshness: "delayed",
    freshnessLabel: FRESHNESS_LABELS.delayed,
    provider: NAME,
    sourceUrl: publicPageUrl(sym),
  };
}

// ── /time_series ─────────────────────────────────────────────────────────────

interface TdTimeSeriesResp {
  meta?: { symbol?: string; interval?: string; exchange?: string };
  values?: Array<{
    datetime?: string; // YYYY-MM-DD for interval=1day
    open?: string;
    high?: string;
    low?: string;
    close?: string;
    volume?: string;
  }>;
}

// Twelve Data caps free-tier outputsize; ask for enough to cover 5y EOD comfortably.
const MAX_OUTPUT = 5000;

async function history(ticker: string, range: HistoryRange): Promise<PriceHistory> {
  const sym = tdSymbol(ticker);
  const to = new Date();
  const from = new Date(to.getTime() - HISTORY_RANGE_DAYS[range] * 24 * 60 * 60 * 1000);
  const body = await tdJson<TdTimeSeriesResp>("/time_series", {
    symbol: sym,
    interval: "1day",
    start_date: from.toISOString().slice(0, 10),
    end_date: to.toISOString().slice(0, 10),
    outputsize: String(MAX_OUTPUT),
    order: "ASC",
  });
  const rows = Array.isArray(body.values) ? body.values : [];
  const candles: Candle[] = [];
  for (const r of rows) {
    if (!r.datetime) continue;
    const o = num(r.open);
    const h = num(r.high);
    const l = num(r.low);
    const c = num(r.close);
    if (o === null || h === null || l === null || c === null) continue;
    candles.push({
      date: r.datetime.slice(0, 10),
      open: o,
      high: h,
      low: l,
      close: c,
      volume: num(r.volume),
    });
  }
  if (candles.length === 0) {
    throw new ProviderError(NAME, `history: no rows for ${sym}`);
  }
  candles.sort((a, b) => a.date.localeCompare(b.date));
  return {
    ticker: sym,
    range,
    interval: "1d",
    candles,
    asOf: new Date().toISOString(),
    freshnessLabel: FRESHNESS_LABELS.eodHistory,
    provider: NAME,
    sourceUrl: publicPageUrl(sym),
  };
}

// /statistics is plan-gated on the free tier — refuse non-retryably so the
// chain moves to Finnhub (which DOES cover key stats on free) without burning
// a token.
async function keyStats(_ticker: string): Promise<KeyStats> {
  assertConfigured();
  throw new ProviderError(
    NAME,
    "keyStats: /statistics is not on the Twelve Data free tier",
    false
  );
}

export const twelveDataProvider: MarketDataProvider = {
  name: NAME,
  quote,
  history,
  keyStats,
};
