// Financial Modeling Prep adapter — THE PLANNED PAID PROVIDER (dormant).
//
// Founder decision 2026-06-11: the free keyless feeds (Stooq/Yahoo) proved
// unreliable from real-world IPs, so one budgeted data subscription is
// approved — FMP Starter (~$19/mo annual). Until the key is purchased this
// adapter throws non-retryably and the chain skips it at zero cost.
//
// ACTIVATION = paste the key, nothing else:
//   1. Add FMP_API_KEY=... to .env.local (and Vercel env when shipping)
//   2. Restart `npm run dev`
//   That's it — providers.ts already lists FMP first in every chain.
//
// Defensive notes:
//  - New FMP accounts get the /stable/ API; legacy accounts use /api/v3.
//    Response shapes differ slightly (field spellings, history wrapper),
//    so the mappers below tolerate BOTH. Mappers are exported pure
//    functions, unit-tested on recorded fixtures in __tests__/fmp.test.ts.
//  - 401/403 (bad key / plan-gated endpoint) is non-retryable — don't
//    hammer a key that doesn't work. 429 → 60s cooldown (Starter is
//    300 calls/min; our Supabase cache should keep us far under it).
//  - FMP quotes may be real-time on some plans, but we label the honest
//    ceiling ("delayed ~15 min") rather than overpromise. Honesty is brand.

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
import { fetchRaw } from "../http";

const NAME = "fmp" as const;
const BASE = "https://financialmodelingprep.com";

function apiKey(): string {
  return (process.env.FMP_API_KEY ?? "").trim();
}

export function fmpConfigured(): boolean {
  return apiKey().length > 0;
}

function assertConfigured(): string {
  const key = apiKey();
  if (!key) {
    throw new ProviderError(NAME, "FMP_API_KEY not set — adapter dormant", false);
  }
  return key;
}

// FMP symbols use dashes for share classes (BRK.B → BRK-B), like Yahoo.
function fmpSymbol(ticker: string): string {
  return ticker.trim().toUpperCase().replace(/\./g, "-");
}

function publicPageUrl(ticker: string): string {
  return `https://site.financialmodelingprep.com/financial-summary/${fmpSymbol(ticker)}`;
}

async function fmpJson<T>(path: string, params: Record<string, string>): Promise<T> {
  const key = assertConfigured();
  const qs = new URLSearchParams({ ...params, apikey: key }).toString();
  const res = await fetchRaw(`${BASE}${path}?${qs}`, {
    provider: NAME,
    rateLimitCooldownMs: 60 * 1000,
  });
  if (res.status === 401 || res.status === 403) {
    throw new ProviderError(
      NAME,
      `${path}: HTTP ${res.status} — invalid key or endpoint not on this plan`,
      false
    );
  }
  if (!res.ok) {
    throw new ProviderError(NAME, `${path}: HTTP ${res.status}`);
  }
  const body = (await res.json()) as T & { ["Error Message"]?: string };
  if (body && typeof body === "object" && "Error Message" in body) {
    throw new ProviderError(NAME, `${path}: ${(body as Record<string, string>)["Error Message"]}`, false);
  }
  return body;
}

// ── Pure response mappers (exported for fixture tests) ──────────────────────

// /stable/quote and /api/v3/quote both return an ARRAY with one object.
// Spellings differ: v3 "changesPercentage" vs stable "changePercentage";
// v3 carries "pe", stable does not.
export interface FmpQuoteRow {
  symbol?: string;
  price?: number;
  previousClose?: number;
  changesPercentage?: number;
  changePercentage?: number;
  volume?: number;
  yearHigh?: number;
  yearLow?: number;
  marketCap?: number;
  pe?: number | null;
  timestamp?: number; // epoch seconds
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

export function mapFmpQuote(rows: FmpQuoteRow[] | unknown, ticker: string): Quote {
  const r = Array.isArray(rows) ? (rows[0] as FmpQuoteRow | undefined) : undefined;
  const price = num(r?.price);
  if (!r || price === null) {
    throw new ProviderError(NAME, `quote: no price for ${ticker} (unknown symbol?)`);
  }
  const prevClose = num(r.previousClose);
  const reported = num(r.changesPercentage) ?? num(r.changePercentage);
  const changePct =
    reported !== null
      ? Math.round(reported * 100) / 100
      : prevClose !== null && prevClose > 0
        ? Math.round(((price - prevClose) / prevClose) * 10000) / 100
        : null;
  return {
    ticker: ticker.toUpperCase(),
    price,
    prevClose,
    changePct,
    currency: "USD",
    asOf: r.timestamp ? new Date(r.timestamp * 1000).toISOString() : new Date().toISOString(),
    freshness: "delayed",
    freshnessLabel: FRESHNESS_LABELS.delayed,
    provider: NAME,
    sourceUrl: publicPageUrl(ticker),
  };
}

// /stable/historical-price-eod/full returns a flat DESCENDING array of rows;
// /api/v3/historical-price-full returns { symbol, historical: [...] }.
export interface FmpHistoryRow {
  date?: string;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  volume?: number;
}

export function mapFmpHistory(body: unknown, ticker: string): Candle[] {
  const rows: FmpHistoryRow[] = Array.isArray(body)
    ? (body as FmpHistoryRow[])
    : Array.isArray((body as { historical?: FmpHistoryRow[] })?.historical)
      ? (body as { historical: FmpHistoryRow[] }).historical
      : [];
  const candles: Candle[] = [];
  for (const r of rows) {
    const o = num(r.open);
    const h = num(r.high);
    const l = num(r.low);
    const c = num(r.close);
    if (!r.date || o === null || h === null || l === null || c === null) continue;
    candles.push({
      date: r.date.slice(0, 10),
      open: o,
      high: h,
      low: l,
      close: c,
      volume: num(r.volume),
    });
  }
  if (candles.length === 0) {
    throw new ProviderError(NAME, `history: no rows for ${ticker} (unknown symbol or plan limit?)`);
  }
  candles.sort((a, b) => a.date.localeCompare(b.date));
  return candles;
}

export function mapFmpKeyStats(
  rows: FmpQuoteRow[] | unknown,
  ticker: string,
  peFromRatios: number | null
): KeyStats {
  const r = Array.isArray(rows) ? (rows[0] as FmpQuoteRow | undefined) : undefined;
  if (!r) {
    throw new ProviderError(NAME, `keyStats: empty quote for ${ticker}`);
  }
  const marketCap = num(r.marketCap);
  const peRatio = num(r.pe) ?? peFromRatios;
  return {
    ticker: ticker.toUpperCase(),
    marketCap,
    peRatio,
    week52High: num(r.yearHigh),
    week52Low: num(r.yearLow),
    volume: num(r.volume),
    asOf: new Date().toISOString(),
    freshnessLabel: FRESHNESS_LABELS.delayed,
    provider: NAME,
    sourceUrl: publicPageUrl(ticker),
    partial: marketCap === null || peRatio === null,
  };
}

// ── Provider methods ─────────────────────────────────────────────────────────

async function fetchQuoteRows(ticker: string): Promise<unknown> {
  const sym = fmpSymbol(ticker);
  // Stable first (what a new account gets); fall back to legacy v3 once if
  // the stable path is refused for plan/routing reasons.
  try {
    return await fmpJson<unknown>("/stable/quote", { symbol: sym });
  } catch (err) {
    if (err instanceof ProviderError && !err.retryable) throw err;
    return await fmpJson<unknown>(`/api/v3/quote/${encodeURIComponent(sym)}`, {});
  }
}

async function quote(ticker: string): Promise<Quote> {
  return mapFmpQuote(await fetchQuoteRows(ticker), ticker);
}

async function history(ticker: string, range: HistoryRange): Promise<PriceHistory> {
  const sym = fmpSymbol(ticker);
  const to = new Date();
  const from = new Date(to.getTime() - HISTORY_RANGE_DAYS[range] * 24 * 60 * 60 * 1000);
  const params = {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
  let body: unknown;
  try {
    body = await fmpJson<unknown>("/stable/historical-price-eod/full", { symbol: sym, ...params });
  } catch (err) {
    if (err instanceof ProviderError && !err.retryable) throw err;
    body = await fmpJson<unknown>(`/api/v3/historical-price-full/${encodeURIComponent(sym)}`, params);
  }
  return {
    ticker: ticker.toUpperCase(),
    range,
    interval: "1d",
    candles: mapFmpHistory(body, ticker),
    asOf: new Date().toISOString(),
    freshnessLabel: FRESHNESS_LABELS.eodHistory,
    provider: NAME,
    sourceUrl: publicPageUrl(ticker),
  };
}

async function keyStats(ticker: string): Promise<KeyStats> {
  const rows = await fetchQuoteRows(ticker);
  // Stable /quote has no P/E. One cheap follow-up to ratios-ttm fills it;
  // if that endpoint is plan-gated or down, we return honest partial stats.
  let peFromRatios: number | null = null;
  const probe = Array.isArray(rows) ? (rows[0] as FmpQuoteRow | undefined) : undefined;
  if (num(probe?.pe) === null) {
    try {
      const ratios = await fmpJson<Array<{ priceToEarningsRatioTTM?: number }>>(
        "/stable/ratios-ttm",
        { symbol: fmpSymbol(ticker) }
      );
      peFromRatios = num(Array.isArray(ratios) ? ratios[0]?.priceToEarningsRatioTTM : null);
    } catch {
      peFromRatios = null;
    }
  }
  return mapFmpKeyStats(rows, ticker, peFromRatios);
}

export const fmpProvider: MarketDataProvider = {
  name: NAME,
  quote,
  history,
  keyStats,
};
