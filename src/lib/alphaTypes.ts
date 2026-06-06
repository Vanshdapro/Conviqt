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

// ── Mosaic edge scan (Feature 1: "the small factors") ───────────────────────
//
// The mosaic scan is a deep, Alpha-only evidence pass that hunts the
// NON-obvious signals surface economics miss — the variant-perception edge a
// desk builds from many small, cited factors. It runs per finalist candidate
// after the sweep and feeds the council + CIO so it tilts selection and thesis.

// The analytical lanes the mosaic scan sweeps for edge.
export type MosaicLane =
  | "insider" // Form 4 open-market buying/selling clusters
  | "institutional" // 13F ownership changes, notable new holders
  | "short_interest" // short %, days-to-cover, squeeze setups
  | "options" // unusual options flow, skew, dealer positioning
  | "supply_chain" // suppliers, channel checks, component orders
  | "customers" // customer wins/losses, demand signals
  | "management" // exec changes, capital-allocation signals, guidance tone
  | "hiring" // headcount, job postings, Glassdoor, layoffs
  | "regulatory" // regulation, agency action, policy shifts
  | "legal" // litigation, investigations, settlements
  | "social_sentiment" // retail/social positioning, narrative shifts
  | "technical_microstructure" // unusual volume, liquidity, flow
  | "other";

export type EdgeDirection = "bullish" | "bearish" | "neutral";
export type EdgeWeight = "high" | "medium" | "low";

// One non-obvious, cited signal recovered by the mosaic scan.
export interface MosaicEdgeFactor {
  lane: MosaicLane;
  factor: string; // short label, e.g. "CFO + 2 directors bought open-market"
  detail: string; // one sentence with the specific number/fact
  direction: EdgeDirection;
  weight: EdgeWeight; // how material this factor is to the thesis
  sourceIndex: number; // index into MosaicScan.sources
}

// The full mosaic product for one candidate. sources are provenance-validated
// against real web_search results, exactly like a FactSheet.
export interface MosaicScan {
  ticker: string;
  factors: MosaicEdgeFactor[];
  edgeSummary: string; // 2-3 sentence variant-perception synthesis
  sources: AlphaPickSource[];
  asOf: string; // ISO timestamp
  costUSD: number;
  durationMs: number;
  webSearchCount: number;
}

// ── Prediction & risk (Feature 2) ───────────────────────────────────────────

// The honesty cap on published confidence. An uncalibrated 95%-confidence call
// is dishonest, so no pick may claim more than this until the calibration record
// earns the right to lift it. Surfaced in the UI alongside the calibration
// stats so the cap is transparent. Raise this manually as Brier/hit-rate prove out.
export const MAX_PUBLISHABLE_CONFIDENCE = 90;

// The floor — a publishable long should be a coin-flip or better, or why pick it.
export const MIN_PUBLISHABLE_CONFIDENCE = 50;

export type ScenarioLabel = "bear" | "base" | "bull";

// One leg of the bear/base/bull forecast distribution. returnPct is computed
// in code from entry; probabilities are normalized in code to sum to 100.
export interface Scenario {
  label: ScenarioLabel;
  price: number; // target price in this scenario
  probability: number; // 0-100, normalized across the three legs
  returnPct: number; // (price - entry) / entry * 100
}

// How a prediction was graded when it resolved.
export type ResolutionOutcome =
  | "TARGET_HIT" // sold at/through the target — prediction correct
  | "STOP_HIT" // sold at/through the stop — prediction wrong
  | "FUNDAMENTAL_EXIT" // sold on an adverse event before target — prediction wrong
  | "HORIZON_EXPIRED"; // horizon passed without hitting target — prediction wrong

// What the pipeline hands the store when it grades a prediction.
export interface PredictionResolution {
  outcome: ResolutionOutcome;
  resolvedDate: string; // YYYY-MM-DD
  resolvedPrice: number; // price the prediction was graded against (0 if unknown)
  predictionCorrect: boolean; // did predicted_price get reached within horizon
  realizedReturnPct: number; // (resolvedPrice - entry) / entry * 100
}

// ── Calibration / self-scoring track record (Feature 2) ─────────────────────

// One confidence band: what the desk predicted vs what actually happened.
export interface CalibrationBucket {
  label: string; // e.g. "70-80%"
  lo: number; // band lower bound (confidence %)
  hi: number; // band upper bound (confidence %)
  n: number; // resolved predictions whose confidence fell in this band
  predicted: number; // average predicted confidence in the band (%)
  actual: number; // realized hit rate in the band (%)
}

// Aggregate accuracy derived from resolved picks. The proof behind the risk
// number — and the engine that lets the confidence cap rise over time.
export interface CalibrationStats {
  resolved: number; // resolved predictions that carried a confidence
  hitRate: number; // % of resolved predictions that came true
  avgConfidence: number; // average predicted confidence across resolved (%)
  brier: number; // mean((conf/100 - outcome)^2); 0 = perfectly calibrated
  avgRealizedReturnPct: number; // average realized return across resolved
  buckets: CalibrationBucket[]; // populated confidence bands only
  maxPublishableConfidence: number; // current honesty cap, surfaced to the UI
}

// ── Aggregate performance (the headline "how is the desk doing" stat) ───────
//
// A simple, equal-weighted average return across every published position —
// active positions marked at their current unrealized price_change_pct, closed
// positions at their realized exit return. It answers one plain question for a
// visitor: across everything the Council has published, what has the average
// position returned? Computed server-side from the FULL position set (before
// the per-publication unlock gate) so it can be shown to every signed-in
// visitor as a track-record signal without revealing the gated picks themselves
// — only the blended numbers cross the gate, never the individual names.
export interface AlphaAggregate {
  avgReturnPct: number; // equal-weighted mean return across all counted positions
  positions: number; // total positions counted (active + closed)
  winners: number; // counted positions with return >= 0
  losers: number; // counted positions with return < 0
  activeCount: number; // active positions contributing an unrealized return
  closedCount: number; // closed positions contributing a realized return
  activeAvgReturnPct: number | null; // avg unrealized return across the live book
  closedAvgReturnPct: number | null; // avg realized return across closed positions
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
  // Mosaic edge scan (migration 017). Optional so pre-017 rows deserialize.
  edge_factors?: MosaicEdgeFactor[] | null; // the cited "small factor" signals
  edge_summary?: string | null; // variant-perception synthesis
  // Prediction & risk (migration 017). The forecast the desk is putting its
  // name behind, with an honest, falsifiable confidence.
  predicted_price?: number | null; // headline base-case target the desk expects
  horizon_days?: number | null; // prediction window in days
  target_date?: string | null; // YYYY-MM-DD = entry_date + horizon_days
  confidence_pct?: number | null; // P(predicted_price reached within horizon); risk = 100 - this
  prob_of_loss_pct?: number | null; // secondary: P(below entry at horizon)
  expected_value_pct?: number | null; // probability-weighted return across scenarios
  scenarios?: Scenario[] | null; // bear/base/bull distribution
  forecast_basis?: string | null; // 1-2 cited sentences behind the forecast
  // Resolution / calibration (migration 017). Written when the prediction is
  // graded — on sell, or when the horizon expires.
  resolved?: boolean | null;
  resolved_date?: string | null; // YYYY-MM-DD
  resolution_outcome?: ResolutionOutcome | null;
  resolved_price?: number | null; // price the prediction was graded against
  prediction_correct?: boolean | null; // did predicted_price get reached in time
  realized_return_pct?: number | null; // (resolved_price - entry) / entry * 100
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
  // Mosaic edge scan carried through from the selected candidate.
  edgeFactors: MosaicEdgeFactor[];
  edgeSummary: string;
  // Prediction & risk — emitted by the CIO, derived numbers computed in code.
  predictedPrice: number;
  horizonDays: number;
  targetDate: string; // YYYY-MM-DD
  confidencePct: number; // [50, MAX_PUBLISHABLE_CONFIDENCE]
  riskPct: number; // 100 - confidencePct
  probOfLossPct: number; // [1, 99]
  expectedValuePct: number; // probability-weighted return
  scenarios: Scenario[]; // bear/base/bull, probabilities normalized to 100
  forecastBasis: string;
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
