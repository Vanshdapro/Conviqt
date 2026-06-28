// The Radar — shared contract. "What's coming, what's at stake, what it means
// for you." Third surface of the Lens trilogy (Map → Lens → Radar).
//
// Two layers, ONE shape:
//   • Market-wide Radar (FREE, Dashboard): upcoming market-movers (Fed/CPI/jobs
//     + big earnings), each with what's at stake + what each outcome would mean.
//     Globally cached in feed_cache, shared by all users (~$0/user).
//   • Personalized Radar (PRO, Portfolio, woven with the Lens): the same, but
//     filtered to the user's holdings — "what's coming for YOUR money."
//
// Honesty guardrail (CLAUDE.md, load-bearing): ORIENTATION, never alpha. The
// Radar says "NVDA reports Tuesday; here's what's at stake and what each outcome
// would mean for your book" — NEVER "NVDA will beat." Outcomes are framings, not
// predictions. No buy/sell. Plain English (a 19-year-old with $500).
//
// Client-safe: pure data + tiny helpers, no server imports. Event gathering is
// in events.ts (server), the narrative in generate.ts (MODELS.lens), market-wide
// persistence in store.ts (feed_cache), personal persistence in the per-user
// table from migration 029.

export type RadarEventKind = "earnings" | "fed" | "macro";

// ── Raw upcoming event (pre-AI) — produced by events.ts ──────────────────────

export interface UpcomingEvent {
  /** Stable id: `${kind}:${date}:${ticker || slug(title)}`. */
  id: string;
  kind: RadarEventKind;
  date: string; // YYYY-MM-DD (the event's calendar date)
  /** Whole days from today (UTC). 0 = today, 1 = tomorrow. */
  daysAway: number;
  /** Plain English: "NVDA reports Q2 earnings" / "FOMC rate decision" / "US CPI". */
  title: string;
  ticker?: string; // earnings events carry the ticker
  company?: string;
  /** GICS-ish sector label for personalization matching (e.g. "Technology"). */
  sector?: string;
  sourceUrl?: string; // traceability — where the date came from
}

// ── AI enrichment ────────────────────────────────────────────────────────────

/** One "what each outcome would mean" branch. A framing, NOT a prediction. */
export interface RadarOutcome {
  /** e.g. "If it runs hot" / "A clear beat" / "A surprise cut". */
  label: string;
  /** What that outcome would mean — honest orientation, never "buy/sell". */
  meaning: string;
}

export interface RadarItem extends UpcomingEvent {
  /** What's at stake, one or two plain-English lines. */
  stakes: string;
  /** 2–3 outcome framings. */
  outcomes: RadarOutcome[];
}

// ── Market-wide radar (FREE) — feed_cache key MARKET_RADAR_KEY ────────────────

export interface MarketRadar {
  items: RadarItem[];
  horizonDays: number;
  generatedAt: string; // ISO
  /** e.g. "earnings dates via web search" — honest provenance. */
  freshnessLabel?: string;
}

// ── Personalized radar (PRO) — per-user table (migration 029) ────────────────

export interface PersonalRadar {
  portfolioId: string;
  portfolioName: string;
  /** Events touching the user's tickers/sectors, soonest first. */
  items: RadarItem[];
  /** The user's tickers we actually found upcoming events for. */
  matchedTickers: string[];
  generatedAt: string; // ISO
  estCostUSD: number;
}

// ── Constants ────────────────────────────────────────────────────────────────

/** ~2-week look-ahead (plan open-decision #3). */
export const RADAR_HORIZON_DAYS = 30;
/** Cap surfaced items so the surface stays scannable, soonest first. */
export const RADAR_MAX_ITEMS = 8;
/** feed_cache key for the global, shared market-wide radar. */
export const MARKET_RADAR_KEY = "feed:radar";

/** Liquid mega-caps whose earnings move the whole tape — the market-wide
 *  earnings universe (Fed/macro come from the existing feed events). */
export const RADAR_MARKET_TICKERS: string[] = [
  "AAPL", "MSFT", "NVDA", "AMZN", "GOOGL", "META", "TSLA", "JPM", "XOM", "WMT",
];

// ── Helpers (client-safe) ─────────────────────────────────────────────────────

/** Whole days from `now` to a YYYY-MM-DD date, both floored to UTC midnight.
 *  Negative = already passed. */
export function daysAwayUTC(dateYMD: string, now = Date.now()): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateYMD);
  if (!m) return NaN;
  const target = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const today = new Date(now);
  const todayUTC = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return Math.round((target - todayUTC) / 86_400_000);
}

/** "today" / "tomorrow" / "in 3 days" / "Jun 24". Shared by both surfaces. */
export function whenLabel(daysAway: number, dateYMD: string): string {
  if (daysAway < 0) return dateYMD;
  if (daysAway === 0) return "today";
  if (daysAway === 1) return "tomorrow";
  if (daysAway <= 7) return `in ${daysAway} days`;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateYMD);
  if (!m) return `in ${daysAway} days`;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

const KIND_LABELS: Record<RadarEventKind, string> = {
  earnings: "Earnings",
  fed: "Fed",
  macro: "Data",
};
export function kindLabel(kind: RadarEventKind): string {
  return KIND_LABELS[kind];
}

/** Stable id for an event, so a later refresh can match/age the same one. */
export function radarEventId(kind: RadarEventKind, date: string, key: string): string {
  const slug = key.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `${kind}:${date}:${slug}`;
}
