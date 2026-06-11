// Normalized market data types — the public contract of src/lib/marketdata/.
//
// Everything downstream (sweep agents, Portfolio, Dashboard, charts) consumes
// ONLY these shapes. Providers (Stooq, Yahoo, Finnhub, ...) each map their
// wire format into these types, so swapping a dead provider is a one-file
// change in providers.ts — never a rewrite of consumers.
//
// Honesty rule (CLAUDE.md): every payload carries a user-facing
// `freshnessLabel` ("delayed ~15 min", "end-of-day close") and a `sourceUrl`
// a human can visit. Delayed data is fine; unlabeled data is not. If no
// provider can answer, callers get null — never synthetic numbers.

export type ProviderName = "stooq" | "yahoo" | "finnhub" | "fmp";

// Human-readable publisher names for Source attribution (one source of
// truth — both sweep agents render these).
export const PROVIDER_LABELS: Record<ProviderName, string> = {
  stooq: "Stooq",
  yahoo: "Yahoo Finance",
  finnhub: "Finnhub",
  fmp: "Financial Modeling Prep",
};

export type Capability = "quote" | "history" | "keyStats";

export type HistoryRange = "1mo" | "3mo" | "6mo" | "1y" | "2y" | "5y";

export const HISTORY_RANGES: HistoryRange[] = [
  "1mo",
  "3mo",
  "6mo",
  "1y",
  "2y",
  "5y",
];

// Calendar days each range spans — shared by every provider that builds
// from/to date windows, so all providers serve identical ranges.
export const HISTORY_RANGE_DAYS: Record<HistoryRange, number> = {
  "1mo": 31,
  "3mo": 92,
  "6mo": 184,
  "1y": 366,
  "2y": 731,
  "5y": 1827,
};

export type Freshness = "realtime" | "delayed" | "eod";

export interface Quote {
  ticker: string;
  price: number;
  prevClose: number | null;
  changePct: number | null; // vs previous close, e.g. -1.42
  currency: string; // "USD" for the US-listed universe we cover
  asOf: string; // ISO timestamp of the quote itself (not of our fetch)
  freshness: Freshness;
  freshnessLabel: string; // user-facing, e.g. "delayed ~15 min"
  provider: ProviderName;
  sourceUrl: string; // human-visitable page backing this number
}

export interface Candle {
  date: string; // YYYY-MM-DD (exchange session date)
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number | null;
}

export interface PriceHistory {
  ticker: string;
  range: HistoryRange;
  interval: "1d";
  candles: Candle[]; // ascending by date
  asOf: string; // ISO timestamp of our fetch
  freshnessLabel: string; // e.g. "end-of-day data"
  provider: ProviderName;
  sourceUrl: string;
}

// Key stats are individually nullable: a provider that can only source part
// of the set returns what it has and flags `partial`. Consumers render "—"
// for missing fields — never a guessed number.
export interface KeyStats {
  ticker: string;
  marketCap: number | null; // USD
  peRatio: number | null; // trailing twelve months
  week52High: number | null;
  week52Low: number | null;
  volume: number | null; // latest session
  asOf: string; // ISO timestamp of our fetch
  freshnessLabel: string;
  provider: ProviderName;
  sourceUrl: string;
  partial: boolean;
}

// Thrown by provider adapters. `retryable: false` means "don't bother asking
// this provider again right now" (unsupported capability, not configured);
// the chain in index.ts moves on to the next provider either way.
export class ProviderError extends Error {
  constructor(
    public provider: ProviderName,
    message: string,
    public retryable = true
  ) {
    super(`[marketdata:${provider}] ${message}`);
    this.name = "ProviderError";
  }
}

// The adapter interface every provider implements. A provider that cannot
// serve a capability throws ProviderError(retryable=false) from that method.
export interface MarketDataProvider {
  name: ProviderName;
  quote(ticker: string): Promise<Quote>;
  history(ticker: string, range: HistoryRange): Promise<PriceHistory>;
  keyStats(ticker: string): Promise<KeyStats>;
}

// User-facing freshness labels — single source of truth so the wording stays
// consistent everywhere it renders.
export const FRESHNESS_LABELS = {
  delayed: "delayed ~15 min",
  eod: "end-of-day close",
  eodHistory: "end-of-day data",
  realtime: "real-time",
} as const;
