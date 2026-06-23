// The Lens — the daily personalized brief that lives INSIDE Portfolio.
//
// "What happened to your money today, why, what it means, what to watch."
// Generated once per user/portfolio/UTC-day, fed live data we already fetch
// (marketdata quotes + Currents headlines), synthesized by DeepSeek V4 Flash
// (MODELS.lens) with NO web_search. Stored as a daily thread (continuity) with
// a flagged-items receipts log ("conviction you can check").
//
// HONESTY (CLAUDE.md): every NUMBER here is deterministic — computed in
// generate.ts from the user's own shares × sourced marketdata prices, never
// from the model. The model writes only the plain-English prose and the
// what-to-watch list. No invented figures, ever.
//
// Client-safe: pure data + a couple of tiny helpers, no server imports.

// ── Per-holding day move (numbers deterministic, `note` from the model) ──────

export interface LensHoldingMove {
  ticker: string;
  companyName?: string;
  changePct: number | null; // today vs previous close (the noise — shown small)
  dayChangeUSD: number | null; // shares × (price − prevClose)
  // Medium-term returns — the signal. Computed from price history.
  ret1wPct: number | null; // ~1 week
  ret1mPct: number | null; // ~1 month
  ret3mPct: number | null; // ~3 months
  weightPct: number | null; // position weight in the portfolio
  priced: boolean; // false when no provider could price it (excluded from math)
  note: string; // the medium-term read on this stock — its multi-week story
}

// ── What to watch (the Radar seed, personalized to this book) ────────────────

export interface LensWatchItem {
  text: string; // what to watch + why it matters to THIS portfolio
  ticker?: string;
  when?: string; // e.g. "Wed" / "next earnings" — soft, optional
}

// ── Receipts: a flag we made, aged honestly on later briefs ──────────────────

export type LensFlagStatus = "open" | "played_out" | "faded";

export interface LensFlag {
  id: string; // stable id so later briefs can age the same flag
  date: string; // YYYY-MM-DD the flag was first raised
  text: string; // the call we made ("watch X because Y")
  ticker?: string;
  status: LensFlagStatus; // updated by later generations
  outcomeNote?: string; // how it aged, filled in once it resolves
}

// ── The brief ────────────────────────────────────────────────────────────────

export interface LensBrief {
  date: string; // YYYY-MM-DD (UTC) this brief covers
  portfolioId: string;
  portfolioName: string;

  // Headline numbers — deterministic, from marketdata. Never the model.
  // The HEADLINE is medium-term (week/month); today is a demoted footnote.
  move1wPct: number | null; // value-weighted ~1-week move
  move1mPct: number | null; // value-weighted ~1-month move (the headline)
  portfolioMovePct: number | null; // today's move — small, secondary
  dayChangeUSD: number | null; // total dollar change today across priced holdings
  pricedValueUSD: number | null; // value of holdings we could price

  // The model's plain-English synthesis (no numbers it wasn't handed).
  whatHappened: string; // 1–2 sentences
  why: string; // 1–2 sentences — the mechanism (this teaches)
  whatItMeans: string; // 1–2 sentences — for THIS portfolio
  sinceYesterday?: string; // delta vs the last brief (continuity), optional

  holdings: LensHoldingMove[]; // sorted desc by |dayChangeUSD|
  watch: LensWatchItem[]; // what to watch next
  flagged: LensFlag[]; // the receipts thread (carried + aged across days)

  unpriced: string[]; // tickers no provider could price (honest gap)
  dataFreshness: string; // e.g. "delayed ~15 min" / "end-of-day close"
  generatedAt: string; // ISO
  estCostUSD: number;
}

// ── Deep Thesis (institutional-grade, on-demand, DeepSeek V4 Pro + reasoning) ──
//
// The Lens's DEEP mode. Unlike the daily brief (a cheap glance), this gathers
// MULTIPLE sources per holding — live quote, key stats, price history (momentum
// + valuation position), recent news, macro context — and asks a reasoning
// model for a structured thesis WITH a visible reasoning trace. On-demand and
// Pro-gated; never auto-run per user per day (it's the expensive path).

export type Conviction = "High" | "Medium" | "Low";

export interface LensSource {
  kind: "price" | "stats" | "history" | "news" | "macro";
  label: string; // e.g. "NVDA price — Finnhub (delayed ~15 min)"
  detail?: string; // one line of what it told us
  url?: string; // human-visitable source, when we have one
}

export interface LensThesisHolding {
  ticker: string;
  weightPct: number | null;
  momentum?: string; // plain-English trend read, computed from history
  valuation?: string; // plain-English valuation read, computed from key stats
  read: string; // the model's one-paragraph take on this holding
}

export interface LensThesis {
  date: string;
  portfolioId: string;
  portfolioName: string;

  summary: string; // one-paragraph thesis on the whole book
  drivers: string[]; // what is ACTUALLY driving this portfolio right now
  bull: string[]; // forces that help this book
  bear: string[]; // the real risks
  crux: string; // the single thing that matters most — what to actually watch
  conviction: Conviction; // shown as a word, never a raw number (CLAUDE.md)

  holdings: LensThesisHolding[];
  reasoning?: string; // the model's visible reasoning trace ("how we got here")
  sources: LensSource[]; // everything we looked at — the depth receipts

  generatedAt: string;
  estCostUSD: number;
}

// A compact row for the daily-thread list (no full brief payload).
export interface LensBriefListItem {
  date: string;
  portfolioMovePct: number | null;
  dayChangeUSD: number | null;
  headline: string; // whatHappened, trimmed
}

// ── Helpers (shared by the Portfolio surface) ────────────────────────────────

/** Today as YYYY-MM-DD in UTC — the brief's calendar key. */
export function briefDateUTC(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** Short list-row from a full brief. */
export function toLensListItem(b: LensBrief): LensBriefListItem {
  const headline = b.whatHappened.trim();
  return {
    date: b.date,
    portfolioMovePct: b.portfolioMovePct,
    dayChangeUSD: b.dayChangeUSD,
    headline: headline.length > 120 ? `${headline.slice(0, 119)}…` : headline,
  };
}
