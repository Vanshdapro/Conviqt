// Shared types for the Dashboard + Headlines content feed (playbook Phase 4).
//
// Client-safe: pure data + tiny helpers, no server imports. Generation lives
// in generate.ts (server), persistence in store.ts (server).

// ── Regions ──────────────────────────────────────────────────────────────────

export interface FeedRegion {
  id: string;
  /** Tab label — short enough for a pill on a 390px screen. */
  label: string;
  /** Primary Currents /v1/search query for this tab. */
  query: { category?: string; country?: string; keywords?: string };
  /** Fallback query when the primary returns too few usable headlines. */
  fallback?: { category?: string; country?: string; keywords?: string };
}

// 10 regions + Crypto (playbook 2.2). Order = tab order.
export const FEED_REGIONS: FeedRegion[] = [
  { id: "us", label: "US", query: { country: "US", category: "finance" }, fallback: { country: "US", category: "business" } },
  { id: "india", label: "India", query: { country: "IN", category: "business" }, fallback: { keywords: "India economy markets" } },
  { id: "china", label: "China", query: { country: "CN", category: "business" }, fallback: { keywords: "China economy markets" } },
  { id: "japan", label: "Japan", query: { country: "JP", category: "business" }, fallback: { keywords: "Japan economy markets" } },
  { id: "europe", label: "Europe", query: { keywords: "European markets", category: "business" }, fallback: { keywords: "Europe economy" } },
  { id: "uk", label: "UK", query: { country: "GB", category: "business" }, fallback: { keywords: "UK economy markets" } },
  { id: "mideast", label: "Middle East", query: { keywords: "Middle East markets", category: "business" }, fallback: { keywords: "Gulf economy" } },
  { id: "latam", label: "Latin America", query: { keywords: "Latin America economy", category: "business" }, fallback: { keywords: "Brazil Mexico economy" } },
  { id: "africa", label: "Africa", query: { keywords: "Africa economy markets", category: "business" }, fallback: { keywords: "African economy" } },
  { id: "australia", label: "Australia", query: { country: "AU", category: "business" }, fallback: { keywords: "Australia economy markets" } },
  { id: "crypto", label: "Crypto", query: { keywords: "cryptocurrency", category: "business" }, fallback: { keywords: "bitcoin" } },
];

export const FEED_REGION_IDS = FEED_REGIONS.map((r) => r.id);

export function getFeedRegion(id: string): FeedRegion | null {
  return FEED_REGIONS.find((r) => r.id === id) ?? null;
}

// ── Headlines ────────────────────────────────────────────────────────────────

export interface FeedHeadline {
  id: string;
  title: string;
  url: string;
  source: string; // hostname, e.g. "reuters.com"
  publishedAt: string; // ISO 8601 ("" when the wire omitted it)
  /** One line: what this could mean for traders. Plain English. */
  take: string;
  /** US-listed tickers this headline plausibly touches (0–3). Stocks only. */
  tickers: string[];
}

export interface HeadlinesRegion {
  region: string; // FeedRegion id
  headlines: FeedHeadline[]; // exactly the 5 we publish, newest first
  generatedAt: string; // ISO
}

// ── Dashboard ────────────────────────────────────────────────────────────────

export interface FeedTrend {
  text: string; // one line, plain English
}

export interface FeedSignal {
  ticker: string;
  note: string; // what's unusual, one line
  reason: string; // why it's moving, one line
}

export type FeedEventKind = "earnings" | "fed" | "macro";

export interface FeedEvent {
  kind: FeedEventKind;
  date: string; // YYYY-MM-DD
  label: string; // e.g. "NVDA reports Q2 earnings" / "FOMC rate decision"
  ticker?: string;
  sourceUrl?: string; // traceability — where the date came from
}

export interface DashboardContent {
  trends: FeedTrend[]; // exactly 3
  signals: FeedSignal[]; // exactly 3
  events: FeedEvent[]; // next few, soonest first
  generatedAt: string; // ISO
}

// ── Market Snapshot (rendered live, not part of the 2×/day cache) ───────────
//
// Liquid ETF proxies, honestly labeled — the free feeds quote ETFs far more
// reliably than ^index symbols.

export const SNAPSHOT_TICKERS: { ticker: string; label: string }[] = [
  { ticker: "SPY", label: "S&P 500 · SPY" },
  { ticker: "QQQ", label: "Nasdaq 100 · QQQ" },
  { ticker: "DIA", label: "Dow · DIA" },
  { ticker: "IWM", label: "Small caps · IWM" },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

/** "3h ago" / "just now" / "2d ago" — shared by both surfaces. */
export function timeAgo(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const mins = Math.max(0, Math.floor((now - t) / 60_000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
