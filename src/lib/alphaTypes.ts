// Types shared between the alpha pipeline, API routes, and frontend.

export interface AlphaPickSource {
  url: string;
  title: string;
  publisher: string;
}

// ── Institutional pipeline types ────────────────────────────────────────────
//
// The Alpha Tracker runs a multi-stage flow modeled on a real investment desk:
//   Macro regime gate → regime-aware scout → sweep → 6-lens council →
//   CIO + portfolio constructor. These types are the structured products of
//   each stage that get persisted with the pick and rendered in the UI.

// The macro regime the desk is operating in, produced by the regime agent.
export type RegimeStance = "RISK_ON" | "NEUTRAL" | "RISK_OFF";

export interface MacroRegime {
  stance: RegimeStance;
  summary: string; // 1-2 sentence read of the current market regime
  favoredSectors: string[]; // sectors with a macro tailwind right now
  avoidSectors: string[]; // sectors fighting a macro headwind right now
  keyRisks: string[]; // 2-4 named macro risks the desk is watching
  sources: AlphaPickSource[];
  asOf: string; // ISO timestamp
  costUSD: number;
  durationMs: number;
}

// The six analytical lenses the council scores every candidate on.
export type AlphaLens =
  | "Fundamental"
  | "Valuation"
  | "Catalyst"
  | "Risk"
  | "Technical"
  | "Sentiment";

export type LensSignal = "bullish" | "neutral" | "bearish";

// One lens's read on a candidate. Score is 0-10; for the Risk lens a HIGH
// score means low risk / favorable (so higher is always better across lenses).
export interface LensScore {
  lens: AlphaLens;
  score: number; // 0-10, higher = more favorable
  signal: LensSignal;
  note: string; // one-sentence justification
}

// Row shape for the alpha_picks Supabase table.
export interface AlphaPick {
  id?: string;
  run_id: string;
  ticker: string;
  company_name: string;
  entry_price: number;
  entry_date: string; // YYYY-MM-DD
  target_price: number;
  stop_loss: number;
  catalyst: string;
  conviction: number; // 1-10
  bull_thesis: string;
  bear_thesis: string;
  sources: AlphaPickSource[];
  status: "ACTIVE" | "SOLD";
  // Current price snapshot — updated each time the pipeline runs
  current_price?: number | null;
  price_change_pct?: number | null; // ((current - entry) / entry) * 100
  price_last_updated?: string | null; // YYYY-MM-DD
  exit_date?: string | null;
  exit_price?: number | null;
  exit_reason?: string | null;
  created_at?: string;
  // Portfolio-constructor + council outputs (migration 009). Optional so rows
  // written before the institutional rebuild still deserialize cleanly.
  position_size_pct?: number | null; // % of the paper book allocated
  risk_reward?: number | null; // (target-entry)/(entry-stop), computed in code
  lens_scores?: LensScore[] | null; // the 6-lens scorecard
  regime_stance?: RegimeStance | null; // macro regime at entry
  regime_summary?: string | null; // 1-line regime read at entry
}

// What the alpha judge produces before Supabase write validation.
export interface AlphaPickDraft {
  ticker: string;
  companyName: string;
  entryPrice: number;
  targetPrice: number;
  stopLoss: number;
  catalyst: string;
  conviction: number; // 1-10
  bullThesis: string;
  bearThesis: string;
  sources: AlphaPickSource[]; // already resolved from FactSheet sources
  positionSizePct: number; // % of paper book the CIO sized this at
  riskReward: number; // (target-entry)/(entry-stop), computed in code
  lensScores: LensScore[]; // the 6-lens scorecard for the selected name
}

// Result returned from the full pipeline run.
export interface AlphaRunResult {
  run_id: string;
  sells: Array<{ ticker: string; reason: string }>;
  new_picks: Array<{ ticker: string }>;
  errors: string[];
  costUSD: number;
  durationMs: number;
}
