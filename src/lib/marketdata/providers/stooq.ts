// Stooq CSV adapter — primary provider.
//
// Stooq (stooq.com) serves free CSV endpoints with EOD history and a
// delayed last quote. Very stable for years, no key, no auth — but
// unofficial: it serves an HTML "page does not exist" body WITH STATUS 200
// when it doesn't like the request or the caller's IP, so we sniff for HTML
// and for "N/D" (Stooq's null marker) instead of trusting the status code.
//
// Endpoints:
//   quote:   https://stooq.com/q/l/?s=nvda.us&f=sd2t2ohlcv&h&e=csv
//            → Symbol,Date,Time,Open,High,Low,Close,Volume
//   history: https://stooq.com/q/d/l/?s=nvda.us&i=d&d1=YYYYMMDD&d2=YYYYMMDD
//            → Date,Open,High,Low,Close,Volume (ascending)
//
// Stooq has no market cap / P/E, so keyStats here is a PARTIAL fallback
// (52-week range + volume derived from its own history + quote). It sits
// last in the keyStats chain for exactly that reason — see providers.ts.

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
import { fetchText } from "../http";

const NAME = "stooq" as const;

// NVDA → nvda.us, BRK.B → brk-b.us. US-listed universe only (matches the app).
function stooqSymbol(ticker: string): string {
  const t = ticker.trim().toLowerCase().replace(/\./g, "-");
  return t.includes(".") ? t : `${t}.us`;
}

function publicPageUrl(ticker: string): string {
  return `https://stooq.com/q/?s=${stooqSymbol(ticker)}`;
}

// Stooq error bodies are HTML with status 200. Real answers are CSV.
function assertCsv(body: string, what: string): void {
  const head = body.slice(0, 200).trim().toLowerCase();
  if (head.startsWith("<") || head.includes("<meta") || head.includes("<html")) {
    throw new ProviderError(NAME, `${what}: got HTML instead of CSV (endpoint moved or IP blocked)`);
  }
}

function parseNum(s: string | undefined): number | null {
  if (!s) return null;
  const v = s.trim();
  if (!v || v === "N/D" || v === "-") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

const RANGE_DAYS: Record<HistoryRange, number> = {
  "1mo": 31,
  "3mo": 92,
  "6mo": 184,
  "1y": 366,
  "2y": 731,
  "5y": 1827,
};

function yyyymmdd(d: Date): string {
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

async function fetchHistoryCsv(
  ticker: string,
  days: number
): Promise<Candle[]> {
  const sym = stooqSymbol(ticker);
  const d2 = new Date();
  const d1 = new Date(d2.getTime() - days * 24 * 60 * 60 * 1000);
  const url = `https://stooq.com/q/d/l/?s=${encodeURIComponent(sym)}&i=d&d1=${yyyymmdd(d1)}&d2=${yyyymmdd(d2)}`;
  const body = await fetchText(url, { provider: NAME });
  assertCsv(body, "history");

  const lines = body.trim().split("\n");
  // Header: Date,Open,High,Low,Close,Volume
  if (lines.length < 2 || !lines[0].toLowerCase().startsWith("date")) {
    throw new ProviderError(NAME, `history: unexpected CSV header for ${ticker}: "${lines[0]?.slice(0, 60)}"`);
  }
  const candles: Candle[] = [];
  for (const line of lines.slice(1)) {
    const [date, open, high, low, close, volume] = line.split(",");
    const o = parseNum(open);
    const h = parseNum(high);
    const l = parseNum(low);
    const c = parseNum(close);
    if (!date || o === null || h === null || l === null || c === null) continue;
    candles.push({ date: date.trim(), open: o, high: h, low: l, close: c, volume: parseNum(volume) });
  }
  if (candles.length === 0) {
    throw new ProviderError(NAME, `history: no rows for ${ticker} (unknown symbol?)`);
  }
  // Stooq returns ascending already; sort defensively anyway.
  candles.sort((a, b) => a.date.localeCompare(b.date));
  return candles;
}

async function quote(ticker: string): Promise<Quote> {
  const sym = stooqSymbol(ticker);
  const url = `https://stooq.com/q/l/?s=${encodeURIComponent(sym)}&f=sd2t2ohlcv&h&e=csv`;
  const body = await fetchText(url, { provider: NAME });
  assertCsv(body, "quote");

  const lines = body.trim().split("\n");
  // Header: Symbol,Date,Time,Open,High,Low,Close,Volume
  if (lines.length < 2) {
    throw new ProviderError(NAME, `quote: empty CSV for ${ticker}`);
  }
  const [, date, time, , , , close] = lines[1].split(",");
  const price = parseNum(close);
  if (price === null || !date || date.trim() === "N/D") {
    throw new ProviderError(NAME, `quote: no price for ${ticker} (unknown symbol?)`);
  }

  // Previous close comes from Stooq's own recent history (cheap, and the
  // history call is the one that's cached for 24h downstream anyway).
  let prevClose: number | null = null;
  try {
    const recent = await fetchHistoryCsv(ticker, 14);
    const before = recent.filter((c) => c.date < date.trim());
    prevClose = before.length > 0 ? before[before.length - 1].close : null;
  } catch {
    prevClose = null; // quote still stands on its own
  }

  const changePct =
    prevClose !== null && prevClose > 0
      ? ((price - prevClose) / prevClose) * 100
      : null;

  // Stooq US quotes are delayed intraday and become the official close after
  // hours. Either way "delayed ~15 min" is the honest ceiling of freshness.
  const asOfIso = toIso(date.trim(), time?.trim());

  return {
    ticker: ticker.toUpperCase(),
    price,
    prevClose,
    changePct: changePct !== null ? round2(changePct) : null,
    currency: "USD",
    asOf: asOfIso,
    freshness: "delayed",
    freshnessLabel: FRESHNESS_LABELS.delayed,
    provider: NAME,
    sourceUrl: publicPageUrl(ticker),
  };
}

async function history(ticker: string, range: HistoryRange): Promise<PriceHistory> {
  const candles = await fetchHistoryCsv(ticker, RANGE_DAYS[range]);
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

// Partial stats: 52w range + latest volume from Stooq's own feed. No market
// cap, no P/E — those fields stay null and `partial` is true. Last in the
// keyStats chain (providers.ts); better an honest partial than nothing.
async function keyStats(ticker: string): Promise<KeyStats> {
  const [q, hist] = await Promise.all([
    quote(ticker),
    fetchHistoryCsv(ticker, RANGE_DAYS["1y"]),
  ]);
  let hi = -Infinity;
  let lo = Infinity;
  for (const c of hist) {
    if (c.high > hi) hi = c.high;
    if (c.low < lo) lo = c.low;
  }
  const lastVolume = hist[hist.length - 1]?.volume ?? null;
  return {
    ticker: ticker.toUpperCase(),
    marketCap: null,
    peRatio: null,
    week52High: Number.isFinite(hi) ? hi : null,
    week52Low: Number.isFinite(lo) ? lo : null,
    volume: lastVolume,
    asOf: new Date().toISOString(),
    freshnessLabel: FRESHNESS_LABELS.eod,
    provider: NAME,
    sourceUrl: publicPageUrl(ticker),
    partial: true,
  };
}

function toIso(date: string, time?: string): string {
  // Stooq date "2026-06-10", time "22:00:11" (exchange-local-ish). We carry
  // it as a plain timestamp; consumers only render the human label.
  const t = time && /^\d{2}:\d{2}/.test(time) ? time : "00:00:00";
  const parsed = new Date(`${date}T${t}Z`);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export const stooqProvider: MarketDataProvider = {
  name: NAME,
  quote,
  history,
  keyStats,
};
