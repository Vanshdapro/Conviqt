// Shared types for the Council pipeline. Everything in here is the public
// contract between sweep → specialists → judge → API → UI.
//
// Citation rule (see CLAUDE.md): every quantitative claim must trace back
// to a Source via a sourceIndex. The canonical Source list is derived
// from Anthropic's web_search_tool_result blocks — see sweep.ts. Model-
// authored sources that don't map onto a real search result are dropped.

export type Verdict = "BUY" | "HOLD" | "SELL";

export type AgentName =
  | "Fundamentals"
  | "Technicals"
  | "Sentiment"
  | "Macro";

export type FactCategory =
  | "identity"
  | "price"
  | "fundamental"
  | "technical"
  | "sentiment"
  | "macro";

// Asset type detected by sweep. ETFs and indices don't have fundamentals,
// so the Fundamentals lane is intentionally skipped to avoid burning
// tokens on a guaranteed-bad answer.
export type AssetType = "equity" | "etf" | "index" | "unknown";

// A single piece of evidence the sweep agent recovered from the open web.
// Always cite a sourceIndex. Strings carry their own units (e.g. "29.4x",
// "$187.32", "+5.2%") so the model that wrote them controls formatting.
export interface Fact {
  key: string;
  value: string;
  category: FactCategory;
  asOf?: string; // human-readable freshness, e.g. "as of close 2026-05-14" or "Q3 FY26"
  note?: string; // short qualifier, e.g. "TTM" or "non-GAAP"
  sourceIndex: number;
}

// Source URLs cited by the FactSheet. Indexed; specialists/judge refer
// back by index so we keep one canonical list rather than 5 duplicates.
//
// Provenance: every Source.url MUST appear (modulo normalization) in the
// web_search_tool_result blocks returned by Anthropic. The post-validation
// in sweep.ts drops any model-authored source that doesn't match.
export interface Source {
  url: string;
  title: string;
  publisher: string; // "Yahoo Finance", "FRED", "10-Q", etc. Model-inferred.
  retrievedAt: string; // ISO timestamp when sweep fetched
}

// What sweep produces. Specialists read this and only this.
export interface FactSheet {
  ticker: string;
  companyName: string;
  sector: string;
  assetType: AssetType;
  asOf: string; // ISO timestamp stamped at the start of the council run
  facts: Fact[];
  sources: Source[];
  // Categories the sweep wanted but failed to populate. Specialists in
  // those lanes lower confidence accordingly.
  gaps: FactCategory[];
  // Free-form narrative notes the sweep agent recorded (e.g. "missed
  // earnings expectations Q2 by 4 cents"). Carry-through context for
  // specialists.
  narrative?: string;
}

export interface AgentOutput {
  agent: AgentName;
  verdict: Verdict;
  confidence: number; // 0-100
  reasoning: string;
  flags: string[]; // short labels — e.g. ["overvalued", "margin pressure"]
  // Which Source indexes the agent relied on. Empty array == agent did
  // not cite a number and the UI should render its confidence with a "no
  // sources" indicator.
  sourceIndexes: number[];
  durationMs: number;
}

export type MetricSignal = "bullish" | "bearish" | "neutral";

export interface KeyMetric {
  label: string;   // e.g. "Forward P/E", "Revenue YoY", "RSI 14-day"
  value: string;   // e.g. "65.8x", "+34%", "72 (overbought)"
  signal: MetricSignal;
}

export interface JudgeOutput {
  verdict: Verdict;
  conviction: number; // 0-100
  // disagreement is computed deterministically in the orchestrator from
  // the agents array. The Judge model does NOT self-report it.
  disagreement: number; // 0-100
  // 3-4 sentence investment case — no inline [#N] citations, clean prose
  investmentCase: string;
  // 5-7 most decision-relevant data points pulled from the FactSheet
  keyMetrics: KeyMetric[];
  // Detailed bull case (2-3 sentences, specific catalysts + time horizon)
  bullCase: string;
  // Detailed bear case (2-3 sentences, specific risk + downside magnitude)
  bearCase: string;
  // 2-4 near-term events that will re-rate the stock
  catalysts: string[];
  // Single punchy conviction statement — the trade in ≤ 20 words
  bottomLine: string;
  dissents: AgentName[];
  sourceIndexes: number[]; // union of all specialist citations, for footnotes
  durationMs: number;
}

// Result from a focused question run (no BUY/HOLD/SELL — just a direct
// prose answer to the user's specific question with cited sources).
export interface FocusedResult {
  runId: string;
  ticker: string;
  companyName: string;
  sector: string;
  question: string;
  answer: string;        // 2-3 paragraphs answering the question directly
  keyTakeaway: string;  // one punchy sentence
  sources: Source[];    // from the FactSheet
  sourceIndexes: number[];
  asOf: string;
  estCostUSD: number;
  totalDurationMs: number;
  cached?: boolean;
}

export interface CouncilResult {
  runId: string; // unique identifier so the UI can scope DOM ids per run
  ticker: string;
  asOf: string; // ISO timestamp (matches factSheet.asOf for consistency)
  focus?: string; // optional user-supplied analytical lens from the chat router
  factSheet: FactSheet;
  agents: AgentOutput[];
  judge: JudgeOutput;
  totalDurationMs: number;
  // Anything we want surfaced to the UI (e.g. "Macro agent failed").
  warnings: string[];
  // Rough cost estimate in USD so we can show the user what each query
  // burned. Computed best-effort from token counts and search counts.
  estCostUSD: number;
  // True if this result was served from the in-process cache rather than
  // a fresh council run. UI can show a "cached" pill.
  cached?: boolean;
}
