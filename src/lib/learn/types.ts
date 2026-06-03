// Conviqt Learn — shared types for the gamified financial academy.
//
// Lessons are STATIC. Every lesson's content is written once, by hand, and
// committed to the repo (see content/). Opening a lesson is a plain data read:
// no Anthropic call, no per-click spend, ever — like opening a page in a
// textbook. The only paid moment is the one-time credit unlock (see unlock.ts).

// ── Interactive widget allowlist ─────────────────────────────────────────────
// A lesson may embed ONE interactive simulator. The math/interactivity lives in
// trusted React components (Widgets.tsx); the lesson only supplies a type from
// this allowlist plus starting numbers. Unknown types render nothing.

export type WidgetType =
  | "compound_interest"
  | "budget_split"
  | "diversification"
  | "dollar_cost_averaging"
  // ── Advanced / institutional simulators ──
  | "position_sizing"      // Kelly criterion & fractional Kelly
  | "drawdown_recovery"    // the asymmetric cost of losses
  | "expected_value"       // probability-weighted asymmetric bets
  | "reverse_dcf"          // what growth is already priced in
  // ── Business-quality & valuation simulators ──
  | "ltv_cac"              // customer unit economics: LTV, payback, LTV/CAC
  | "rule_of_40"           // SaaS growth + margin tradeoff
  | "operating_leverage"   // fixed vs variable cost, how profit scales
  | "dilution"             // stock-based comp / issuance eroding ownership
  | "earnings_yield"       // earnings yield vs the risk-free rate (the Fed model)
  | "margin_of_safety"     // price vs conservative value, the discount cushion
  // ── Macro / risk / behavioral simulators ──
  | "inflation_real_return"// nominal return minus inflation = real purchasing power
  | "options_payoff"       // call / put payoff at expiry
  | "loss_aversion"        // prospect-theory value function (losses loom larger)
  | "rebalancing"          // disciplined rebalancing vs letting winners run
  | "sequence_risk";       // same average return, different order, different outcome

export interface LessonWidget {
  type: WidgetType;
  title: string;
  /** Plain-language sentence telling the learner what to try. */
  prompt: string;
  /** Starting parameters. Shape depends on type; the widget validates/defaults. */
  params: Record<string, number>;
}

// ── Static figure allowlist ──────────────────────────────────────────────────
// Each lesson may reference ONE diagram by key. The diagrams are hand-built,
// reusable React/SVG components (Figures.tsx) — no model-authored SVG, nothing
// to sanitize. A lesson with no natural diagram simply omits this.

export type FigureKey =
  | "three-statements"
  | "income-statement"
  | "balance-sheet"
  | "cash-flow"
  | "accruals"
  | "working-capital"
  | "dupont"
  | "margins"
  | "roic-spread"
  | "dcf-bridge"
  | "reverse-dcf"
  | "multiples"
  | "margin-of-safety"
  | "compounding"
  | "moat"
  | "drawdown"
  | "kelly"
  | "correlation"
  | "barbell"
  | "expected-value"
  | "base-rate"
  | "second-order"
  | "rates-gravity"
  | "credit-cycle"
  | "reflexivity"
  | "sentiment"
  | "pipeline"
  | "disagreement"
  // ── Statements & analysis (expansion) ──
  | "segment"
  | "goodwill"
  | "leases"
  | "stock-comp"
  | "unit-economics"
  | "capital-allocation"
  | "forensic"
  | "operating-leverage"
  // ── Valuation (expansion) ──
  | "sotp"
  | "normalized-earnings"
  | "dividend-discount"
  // ── Mental models (expansion) ──
  | "inversion"
  | "incentives"
  | "bayes"
  // ── Behavioral finance (new track) ──
  | "loss-aversion"
  | "anchoring"
  | "disposition"
  | "herding"
  | "overconfidence"
  // ── Market mechanics (new track) ──
  | "order-book"
  | "short-selling"
  | "etf-mechanics"
  | "options-payoff"
  | "bid-ask"
  // ── Macro (expansion) ──
  | "yield-curve"
  | "business-cycle"
  | "inflation"
  | "four-regimes"
  // ── Foundations (new track) ──
  | "risk-ladder"
  | "index-vs-active";

export interface QuizQuestion {
  question: string;
  options: string[]; // exactly 4
  answerIndex: number; // 0-3
  explanation: string; // shown after answering, why the answer is right
}

export interface ConceptCard {
  emoji: string;
  heading: string;
  body: string; // 1-3 sentences, sharp and concrete
}

export interface KeyTerm {
  term: string;
  definition: string;
}

export interface RealWorldExample {
  scenario: string;
  /** Optional US ticker the example references — bridges to Chat/Alpha. */
  ticker?: string;
  lesson: string; // the takeaway from the scenario
}

// ── Difficulty / XP ──────────────────────────────────────────────────────────

export type Difficulty = "core" | "advanced" | "mastery";

export const LESSON_XP_BY_DIFFICULTY: Record<Difficulty, number> = {
  core: 60,
  advanced: 100,
  mastery: 160,
};

// ── Static lesson (authored content + catalog meta) ──────────────────────────
// This is the single source of truth for a lesson. Content files export these.

export interface StaticLesson {
  id: string;            // stable, permanent — also the progress + unlock key
  title: string;
  hook: string;          // one-line teaser on the card
  difficulty: Difficulty;
  subtitle: string;      // one clear sentence under the title
  figure?: FigureKey;    // optional hand-built diagram
  conceptCards: ConceptCard[];
  keyTerms: KeyTerm[];
  widget?: LessonWidget | null;
  realWorldExample: RealWorldExample;
  quiz: QuizQuestion[];
  /** Deep-link into the Chat product to apply the concept on a real ticker. */
  tryInChat: { label: string; prompt: string };
  takeaways: string[];
}

/** A lesson as exposed by the assembled catalog: xp derived from difficulty. */
export interface CatalogLesson extends StaticLesson {
  xp: number;
}

export interface RawTrack {
  id: string;
  name: string;
  tagline: string;
  emoji: string;
  accent: string; // hex accent for the track
  lessons: StaticLesson[];
}

export interface Track {
  id: string;
  name: string;
  tagline: string;
  emoji: string;
  accent: string;
  lessons: CatalogLesson[];
}

// ── Rendered module (what LessonView consumes) ───────────────────────────────
// Assembled from a CatalogLesson by curriculum.getLessonModule().

export interface LessonModule {
  lessonId: string;
  title: string;
  subtitle: string;
  figure: FigureKey | null;
  conceptCards: ConceptCard[];
  keyTerms: KeyTerm[];
  widget: LessonWidget | null;
  realWorldExample: RealWorldExample;
  quiz: QuizQuestion[];
  tryInChat: { label: string; prompt: string };
  takeaways: string[];
  xp: number;
}

// ── Progress ─────────────────────────────────────────────────────────────────

export interface LearnStats {
  xp: number;
  level: number;
  streakDays: number;
  completedLessonIds: string[];
}

// Level curve: simple, legible thresholds. Level N requires 250*(N-1) cumulative XP.
export function levelForXp(xp: number): number {
  return Math.floor(xp / 250) + 1;
}

export function xpIntoLevel(xp: number): { into: number; needed: number } {
  const into = xp % 250;
  return { into, needed: 250 };
}
