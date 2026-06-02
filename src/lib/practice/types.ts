// Conviqt Academy — Practice: shared types.
//
// Practice is the execution half of the Academy. Where Learn teaches the model
// (variant perception, position sizing, cutting losers, what's priced in),
// Practice makes the learner *do* it: trade a real historical episode bar by
// bar, or write a thesis an AI grades against a PM rubric.
//
// Two drill kinds:
//   episode — a historical market episode replayed bar by bar. The learner
//             manages a position with real money rules (size, stop, target) and
//             is graded on PROCESS (risk discipline) and P&L. Deterministic, free
//             to run: the price path is pre-fetched and cached.
//   thesis  — a written setup. The learner fills a structured PM thesis and an
//             AI grader scores each section and gives feedback. Metered (one
//             fresh Claude call), refunded on failure.
//
// Ladder: drills are arranged into tiers. A tier unlocks when every drill in the
// previous tier has been cleared at least once — the "boss-fight" progression
// that climbs toward a PM certification.

import { levelForXp, xpIntoLevel } from "../learn/types";

export type { } from "../learn/types";
export { levelForXp, xpIntoLevel };

export type DrillKind = "episode" | "thesis";
export type Difficulty = "core" | "advanced" | "mastery";

// ── Price series & events (episode drills) ───────────────────────────────────

// One revealed step of the episode. We store close-only: trades and stop/target
// fills resolve at the close of each revealed bar. This keeps the data honest
// (we never fabricate intrabar OHLC) and the simulator legible.
export interface PriceBar {
  /** ISO date or short label, e.g. "2020-03-23" or "Mar 23". */
  t: string;
  close: number;
  /** Terminal bar: position is force-resolved here (e.g. SVB halted → equity ~0). */
  halted?: boolean;
}

export type EventTone = "bull" | "bear" | "neutral";

// A headline that drops when the episode reaches `atBar`. This is the
// information flow — it tests whether the learner acts on signal vs noise.
export interface TimedEvent {
  atBar: number;
  headline: string;
  detail: string;
  tone: EventTone;
}

// The decision the episode is really testing, used to grade "signal response".
export interface KeyMoment {
  atBar: number;
  /** What a disciplined PM should do near this bar. */
  ideal: "buy" | "sell" | "hold" | "cut";
  /** Why — shown in the debrief. */
  why: string;
}

export interface EpisodeSpec {
  ticker: string;
  company: string;
  /** Human period label, e.g. "Feb–Jun 2020". */
  period: string;
  /** Scene-setting briefing. NO hindsight — only what the learner knows at bar 0. */
  briefing: string;
  /** Starting cash in the simulator (USD). */
  startingCash: number;
  /** Whether the learner starts already holding (some episodes hand you a position). */
  startingShares?: number;
  startingCostBasis?: number;
  bars: PriceBar[];
  events: TimedEvent[];
  keyMoments: KeyMoment[];
  /** What the episode drives home, shown in the debrief. */
  teachingPoint: string;
  /** Narrative of what a disciplined PM would have done. */
  idealPlay: string;
  /** Source URL for the price series — citation integrity, per CLAUDE.md. */
  sourceUrl: string;
  sourceLabel: string;
  /** Note on the price convention, e.g. "Nominal prices as traded (pre-split)." */
  priceNote?: string;
}

// ── Thesis drills ─────────────────────────────────────────────────────────────

// The structured sections of a PM thesis. The learner writes prose into each;
// the AI grader scores each dimension. Mirrors the Learn capstone.
export type ThesisSectionId =
  | "variant"      // the non-consensus view + why the market is wrong
  | "pricedIn"     // what the price already assumes (reverse-DCF intuition)
  | "catalyst"     // what closes the gap, and the timeframe
  | "quality"      // business quality / moat (or, for macro/event, the mechanism)
  | "bearCase"     // the bear case + the invalidation level
  | "risk";        // position size + stop = the risk plan

export interface ThesisSectionDef {
  id: ThesisSectionId;
  label: string;
  prompt: string;       // what to write
  placeholder: string;  // example phrasing to lower the blank-page cost
}

export interface ThesisSpec {
  /** The setup the learner reasons about. Evergreen — no live data required. */
  setup: string;
  /** Optional real ticker the setup references (bridges to Research). */
  ticker?: string;
  /** Which sections this drill asks for (subset/order of the canonical six). */
  sections: ThesisSectionDef[];
  /** What a strong answer demonstrates — shown after grading, not before. */
  whatGoodLooksLike: string;
}

// ── A drill (catalog entry) ───────────────────────────────────────────────────

export interface PracticeDrill {
  id: string;                 // stable cache key — never renumber
  kind: DrillKind;
  title: string;
  hook: string;               // one-line teaser on the card
  difficulty: Difficulty;
  xp: number;
  tier: number;               // ladder tier (1 = first, gates the next)
  /** Concepts this drill tests — labels + the Learn lesson ids they map to. */
  conceptTags: string[];
  conceptLessonIds: string[];
  episode?: EpisodeSpec;
  thesis?: ThesisSpec;
}

// ── Submitted thesis + AI grade ───────────────────────────────────────────────

export type ThesisSubmission = Partial<Record<ThesisSectionId, string>>;

export interface SectionScore {
  id: ThesisSectionId;
  label: string;
  score: number;      // 0-10
  critique: string;   // one-line, specific
}

export type ThesisVerdict = "would_fund" | "needs_work" | "back_to_drawing_board";

export interface ThesisGrade {
  overall: number;          // 0-100
  letter: string;           // A+ .. F
  verdict: ThesisVerdict;
  sections: SectionScore[];
  strengths: string[];
  gaps: string[];           // what a PM would push back on
  rewriteHint: string;      // one concrete next step
}

// ── Episode action log + result ───────────────────────────────────────────────

export type TradeSide = "buy" | "sell";

// One action the learner took, recorded at the bar it happened on. The scoring
// engine replays this log against the price path to grade process deterministically.
export interface TradeAction {
  atBar: number;
  side: TradeSide;
  shares: number;
  price: number;             // the bar close it executed at
  /** Stop in force AFTER this action (0/undefined = none). */
  stop?: number;
  target?: number;
  /** Was this a forced fill (stop/target/terminal) rather than a manual click? */
  auto?: boolean;
}

// The full record of an episode attempt, sent to the scoring engine + persisted.
export interface EpisodeAttempt {
  drillId: string;
  actions: TradeAction[];
  /** Final equity at the end of the episode. */
  finalEquity: number;
  startingCash: number;
  /** Peak-to-trough equity drawdown over the run, as a positive fraction (0.3 = 30%). */
  maxDrawdown: number;
  /** Buy-and-hold equity for the same starting cash, for benchmark comparison. */
  buyHoldEquity: number;
}

// ── Scoring output ─────────────────────────────────────────────────────────────

export interface ScoreDimension {
  id: string;
  label: string;
  score: number;     // 0-100 for this dimension
  weight: number;    // contribution to the overall
  note: string;      // one-line feedback
}

export interface EpisodeScore {
  overall: number;       // 0-100, process-weighted
  stars: 0 | 1 | 2 | 3;
  dimensions: ScoreDimension[];
  pnlPct: number;        // learner P&L %
  buyHoldPct: number;    // benchmark P&L %
  alphaPct: number;      // pnlPct - buyHoldPct
  headline: string;      // one-line summary of how they did
}

// ── Progress, ranks, stats ─────────────────────────────────────────────────────

export interface DrillProgress {
  drillId: string;
  bestScore: number;
  bestStars: number;
  bestPnlPct: number | null;
  xpAwarded: number;
  attempts: number;
}

export interface PracticeStats {
  xp: number;
  level: number;
  rank: Rank;
  clearedDrillIds: string[];   // cleared = at least 1 star
  progress: DrillProgress[];
}

export interface Rank {
  id: string;
  title: string;
  minXp: number;
}

// ── Live paper account ──────────────────────────────────────────────────────────
// The metered, real-ticker layer that sits beyond the free episode drills. Every
// price (entry + each mark) carries a source URL from web_search — per CLAUDE.md,
// no number renders without a citation.

export interface PaperQuote {
  ticker: string;
  price: number;
  asOf: string;       // human freshness label, e.g. "close 2026-05-30"
  sourceUrl: string;
  sourceTitle: string;
}

export type PaperStatus = "open" | "closed";

export interface PaperPosition {
  id: string;
  ticker: string;
  qty: number;
  entryPrice: number;
  entrySource: string | null;
  entryAsOf: string | null;
  stopPrice: number | null;
  targetPrice: number | null;
  thesis: string | null;
  lastMark: number | null;
  lastMarkSrc: string | null;
  lastMarkAt: string | null;
  status: PaperStatus;
  exitPrice: number | null;
  closedAt: string | null;
  openedAt: string;
  // Derived (computed in the store, not stored): current P&L on the last mark.
  marketValue: number | null;
  unrealizedPct: number | null;
}

// ── Notional account + leaderboard tuning ───────────────────────────────────
// The paper desk is a $100k simulated account. Ranking, sizing limits, and the
// anti-gaming guards all derive from these shared constants (used by both the
// server scoring lib and the client desk/leaderboard UI, so they live here).

/** Every trader's notional starting equity. Paper only — no real money. */
export const PAPER_BASE_EQUITY = 100_000;

/** Max cost basis a single ticker may hold, as a fraction of base equity.
 *  Caps lottery-ticket behaviour: no all-in on one name. */
export const MAX_TICKER_EXPOSURE_PCT = 0.1;

/** Dollar form of the per-ticker cap (10% of $100k = $10k). */
export const MAX_TICKER_EXPOSURE_USD = PAPER_BASE_EQUITY * MAX_TICKER_EXPOSURE_PCT;

/** Minimum qualifying positions in a week before a trader is RANKED. Below this
 *  they still appear as "building a track record" but can't top the board on a
 *  single lucky fill. */
export const LEADERBOARD_MIN_TRADES = 3;

/** Floor on the return standard deviation used in the Sharpe denominator, so a
 *  one-trade (zero-variance) account can't divide its way to an infinite score. */
export const LEADERBOARD_STD_FLOOR = 0.02;

// A live (notional) account summary derived from a trader's paper positions.
export interface PaperAccount {
  baseEquity: number;       // 100_000
  cashDeployed: number;     // Σ open cost basis (entry × qty)
  realizedPnl: number;      // Σ closed (exit − entry) × qty
  unrealizedPnl: number;    // Σ open (mark − entry) × qty
  equity: number;           // base + realized + unrealized
  returnPct: number;        // equity / base − 1, in %
  openCount: number;
  closedCount: number;
  // Per-ticker open cost basis, for the 10% exposure guard + UI.
  exposureByTicker: Record<string, number>;
}

// One trader's standing on the weekly leaderboard.
export interface LeaderboardRow {
  handle: string;
  displayName: string | null;
  rank: number | null;        // null = unranked (below LEADERBOARD_MIN_TRADES)
  sharpe: number;             // risk-adjusted score (the rank key)
  returnPct: number;          // notional account return for the week, %
  trades: number;             // qualifying positions opened in the week
  featured: boolean;          // rank 1 → featured top-trader badge
  isSelf?: boolean;           // marks the viewer's own row (server-set per request)
}

export interface LeaderboardWeek {
  weekStart: string;          // ISO date (Mon, UTC)
  weekEnd: string;            // ISO date (next Mon, exclusive)
  label: string;              // human label, e.g. "May 26 – Jun 1, 2026"
  isCurrent: boolean;         // live week (computed) vs frozen past week
  rows: LeaderboardRow[];
  featured: LeaderboardRow | null;
}

// The PM career ladder. Rank is earned by Practice XP; the title is the payoff
// of the boss-fight progression.
export const RANKS: Rank[] = [
  { id: "intern",   title: "Intern",            minXp: 0 },
  { id: "junior",   title: "Junior Analyst",    minXp: 200 },
  { id: "analyst",  title: "Analyst",           minXp: 500 },
  { id: "senior",   title: "Senior Analyst",    minXp: 900 },
  { id: "pm",       title: "Portfolio Manager",  minXp: 1400 },
  { id: "cio",      title: "Chief Investment Officer", minXp: 2000 },
];

export function rankForXp(xp: number): Rank {
  let rank = RANKS[0];
  for (const r of RANKS) if (xp >= r.minXp) rank = r;
  return rank;
}

export function nextRank(xp: number): Rank | null {
  for (const r of RANKS) if (xp < r.minXp) return r;
  return null;
}

export const DRILL_XP_BY_DIFFICULTY: Record<Difficulty, number> = {
  core: 80,
  advanced: 140,
  mastery: 220,
};

// Maps a process/grade score (0-100) to stars. Completing always earns ≥1 star.
export function starsForScore(score: number): 0 | 1 | 2 | 3 {
  if (score >= 85) return 3;
  if (score >= 65) return 2;
  return 1;
}

// XP earned on an attempt: base scaled by performance, with a floor so that
// finishing a hard drill at least pays. Only the FIRST clear awards XP (the
// store enforces award-once); later attempts just raise best score/stars.
export function xpForAttempt(baseXp: number, score: number): number {
  return Math.round(baseXp * Math.max(0.5, Math.min(1, score / 100)));
}
