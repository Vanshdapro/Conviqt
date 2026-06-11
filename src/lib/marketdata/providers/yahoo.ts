// Yahoo Finance adapter — second in the chain.
//
// Yahoo's public JSON endpoints are unofficial and actively defended:
//  - the v8 chart endpoint usually works bare, but 429s datacenter IPs;
//  - the v10 quoteSummary endpoint (market cap, P/E) requires the
//    cookie + crumb dance: GET fc.yahoo.com to receive a session cookie,
//    then GET v1/test/getcrumb with that cookie to receive a crumb token,
//    then pass BOTH on every quoteSummary call.
//
// Defenses here: crumb cached ~30 min and invalidated on 401/403 (one
// re-dance, then give up), 429 puts the whole provider in a 5-minute
// cooldown (see http.ts), 8s timeouts, and a chart-meta fallback for
// keyStats when quoteSummary is refused — partial honest stats beat none.

import {
  Candle,
  FRESHNESS_LABELS,
  HistoryRange,
  KeyStats,
  MarketDataProvider,
  PriceHistory,
  ProviderError,
  Quote,
} from "../types";
import { BROWSER_UA, fetchJson, fetchRaw } from "../http";

const NAME = "yahoo" as const;

// NVDA → NVDA, BRK.B → BRK-B
function yahooSymbol(ticker: string): string {
  return ticker.trim().toUpperCase().replace(/\./g, "-");
}

function publicPageUrl(ticker: string): string {
  return `https://finance.yahoo.com/quote/${yahooSymbol(ticker)}`;
}

// ── cookie + crumb ───────────────────────────────────────────────────────────

interface CrumbState {
  cookie: string;
  crumb: string;
  fetchedAt: number;
}

let crumbState: CrumbState | null = null;
const CRUMB_TTL_MS = 30 * 60 * 1000;

async function getCrumb(force = false): Promise<CrumbState> {
  if (
    !force &&
    crumbState &&
    Date.now() - crumbState.fetchedAt < CRUMB_TTL_MS
  ) {
    return crumbState;
  }

  // Step 1: any request to fc.yahoo.com sets the session cookie (the body is
  // a 404 page — that's expected; we only want the Set-Cookie header).
  const res = await fetchRaw("https://fc.yahoo.com/", {
    provider: NAME,
    timeoutMs: 6000,
  });
  const setCookies =
    typeof res.headers.getSetCookie === "function"
      ? res.headers.getSetCookie()
      : [res.headers.get("set-cookie") ?? ""];
  const cookie = setCookies
    .map((c) => c.split(";")[0])
    .filter(Boolean)
    .join("; ");
  if (!cookie) {
    throw new ProviderError(NAME, "crumb dance: no session cookie received");
  }

  // Step 2: trade the cookie for a crumb token.
  const crumbRes = await fetchRaw(
    "https://query2.finance.yahoo.com/v1/test/getcrumb",
    { provider: NAME, headers: { Cookie: cookie }, timeoutMs: 6000 }
  );
  const crumb = (await crumbRes.text()).trim();
  if (!crumbRes.ok || !crumb || crumb.includes("<") || crumb.length > 64) {
    throw new ProviderError(NAME, `crumb dance: bad crumb response (HTTP ${crumbRes.status})`);
  }

  crumbState = { cookie, crumb, fetchedAt: Date.now() };
  return crumbState;
}

// ── chart endpoint (quote + history) ─────────────────────────────────────────

interface ChartMeta {
  currency?: string;
  regularMarketPrice?: number;
  chartPreviousClose?: number;
  previousClose?: number;
  regularMarketTime?: number; // epoch seconds
  regularMarketVolume?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
}

interface ChartResponse {
  chart?: {
    result?: Array<{
      meta?: ChartMeta;
      timestamp?: number[];
      indicators?: {
        quote?: Array<{
          open?: Array<number | null>;
          high?: Array<number | null>;
          low?: Array<number | null>;
          close?: Array<number | null>;
          volume?: Array<number | null>;
        }>;
      };
    }>;
    error?: { code?: string; description?: string } | null;
  };
}

async function fetchChart(
  ticker: string,
  range: string,
  interval: string
): Promise<NonNullable<NonNullable<ChartResponse["chart"]>["result"]>[0]> {
  const sym = yahooSymbol(ticker);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=${range}&interval=${interval}`;
  const data = await fetchJson<ChartResponse>(url, { provider: NAME });
  const err = data.chart?.error;
  if (err) {
    throw new ProviderError(NAME, `chart error for ${ticker}: ${err.code ?? "?"} ${err.description ?? ""}`);
  }
  const result = data.chart?.result?.[0];
  if (!result?.meta) {
    throw new ProviderError(NAME, `chart: empty result for ${ticker}`);
  }
  return result;
}

async function quote(ticker: string): Promise<Quote> {
  const result = await fetchChart(ticker, "1d", "1d");
  const meta = result.meta!;
  const price = meta.regularMarketPrice;
  if (typeof price !== "number" || !Number.isFinite(price)) {
    throw new ProviderError(NAME, `quote: no regularMarketPrice for ${ticker}`);
  }
  const prevClose = meta.chartPreviousClose ?? meta.previousClose ?? null;
  const changePct =
    prevClose !== null && prevClose > 0
      ? Math.round(((price - prevClose) / prevClose) * 10000) / 100
      : null;
  const asOf = meta.regularMarketTime
    ? new Date(meta.regularMarketTime * 1000).toISOString()
    : new Date().toISOString();

  return {
    ticker: ticker.toUpperCase(),
    price,
    prevClose,
    changePct,
    currency: meta.currency ?? "USD",
    asOf,
    // Yahoo's web quotes are real-time for some US exchanges, delayed for
    // others. We label the honest ceiling rather than overpromise.
    freshness: "delayed",
    freshnessLabel: FRESHNESS_LABELS.delayed,
    provider: NAME,
    sourceUrl: publicPageUrl(ticker),
  };
}

async function history(ticker: string, range: HistoryRange): Promise<PriceHistory> {
  const result = await fetchChart(ticker, range, "1d");
  const ts = result.timestamp ?? [];
  const q = result.indicators?.quote?.[0];
  if (!q || ts.length === 0) {
    throw new ProviderError(NAME, `history: no candles for ${ticker}`);
  }
  const candles: Candle[] = [];
  for (let i = 0; i < ts.length; i++) {
    const o = q.open?.[i];
    const h = q.high?.[i];
    const l = q.low?.[i];
    const c = q.close?.[i];
    if (o == null || h == null || l == null || c == null) continue; // half-baked rows
    candles.push({
      date: new Date(ts[i] * 1000).toISOString().slice(0, 10),
      open: o,
      high: h,
      low: l,
      close: c,
      volume: q.volume?.[i] ?? null,
    });
  }
  if (candles.length === 0) {
    throw new ProviderError(NAME, `history: all candle rows were null for ${ticker}`);
  }
  return {
    ticker: ticker.toUpperCase(),
    range,
    interval: "1d",
    candles,
    asOf: new Date().toISOString(),
    freshnessLabel: FRESHNESS_LABELS.eodHistory,
    provider: NAME,
    sourceUrl: publicPageUrl(ticker),
  };
}

// ── quoteSummary (key stats) ─────────────────────────────────────────────────

interface RawNum {
  raw?: number;
}
interface QuoteSummaryResponse {
  quoteSummary?: {
    result?: Array<{
      price?: { marketCap?: RawNum; regularMarketVolume?: RawNum };
      summaryDetail?: {
        trailingPE?: RawNum;
        fiftyTwoWeekHigh?: RawNum;
        fiftyTwoWeekLow?: RawNum;
        volume?: RawNum;
      };
    }>;
    error?: { code?: string; description?: string } | null;
  };
}

function rawNum(v: RawNum | undefined): number | null {
  return typeof v?.raw === "number" && Number.isFinite(v.raw) ? v.raw : null;
}

async function keyStats(ticker: string): Promise<KeyStats> {
  const sym = yahooSymbol(ticker);

  // Try the crumb-gated quoteSummary, re-dancing once on 401/403.
  for (let attempt = 0; attempt < 2; attempt++) {
    let state: CrumbState;
    try {
      state = await getCrumb(attempt > 0);
    } catch (err) {
      console.warn(`[marketdata:yahoo] crumb dance failed: ${err instanceof Error ? err.message : err}`);
      break; // fall through to chart-meta fallback
    }
    const url =
      `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(sym)}` +
      `?modules=price%2CsummaryDetail&crumb=${encodeURIComponent(state.crumb)}`;
    const res = await fetchRaw(url, {
      provider: NAME,
      headers: { Cookie: state.cookie, "User-Agent": BROWSER_UA },
    });
    if (res.status === 401 || res.status === 403) {
      crumbState = null; // stale crumb — re-dance once
      continue;
    }
    if (!res.ok) {
      throw new ProviderError(NAME, `quoteSummary HTTP ${res.status} for ${ticker}`);
    }
    const data = (await res.json()) as QuoteSummaryResponse;
    const r = data.quoteSummary?.result?.[0];
    if (!r) break;
    const marketCap = rawNum(r.price?.marketCap);
    const peRatio = rawNum(r.summaryDetail?.trailingPE);
    const week52High = rawNum(r.summaryDetail?.fiftyTwoWeekHigh);
    const week52Low = rawNum(r.summaryDetail?.fiftyTwoWeekLow);
    const volume = rawNum(r.price?.regularMarketVolume) ?? rawNum(r.summaryDetail?.volume);
    return {
      ticker: ticker.toUpperCase(),
      marketCap,
      peRatio,
      week52High,
      week52Low,
      volume,
      asOf: new Date().toISOString(),
      freshnessLabel: FRESHNESS_LABELS.delayed,
      provider: NAME,
      sourceUrl: publicPageUrl(ticker),
      partial: marketCap === null || peRatio === null,
    };
  }

  // Fallback: the chart meta carries 52w range + volume without a crumb.
  const meta = (await fetchChart(ticker, "1d", "1d")).meta!;
  return {
    ticker: ticker.toUpperCase(),
    marketCap: null,
    peRatio: null,
    week52High: meta.fiftyTwoWeekHigh ?? null,
    week52Low: meta.fiftyTwoWeekLow ?? null,
    volume: meta.regularMarketVolume ?? null,
    asOf: new Date().toISOString(),
    freshnessLabel: FRESHNESS_LABELS.delayed,
    provider: NAME,
    sourceUrl: publicPageUrl(ticker),
    partial: true,
  };
}

export const yahooProvider: MarketDataProvider = {
  name: NAME,
  quote,
  history,
  keyStats,
};
