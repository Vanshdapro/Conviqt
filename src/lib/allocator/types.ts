// Shared types for the Allocator pipeline — Conviqt's forward-looking sibling
// to the Analyst (one ticker) and the Portfolio Auditor (an existing book).
// The Allocator takes an investor PROFILE (capacity, risk, horizon, goals,
// guardrails) and produces a cited, agent-debated allocation PLAN.
//
// Contract: profile → sweep (cited vehicle facts + macro) → deterministic
// baseline (the TFV framework, exact arithmetic) → 4 specialist agents →
// disagreement → Sonnet judge → AllocatorPlan → API → UI.
//
// Citation rule (inherited from the Council, see CLAUDE.md): every live market
// number a specialist or the judge cites — a price, an expense ratio, a yield,
// the macro regime — must trace back to a Source via a sourceIndex produced by
// the sweep's web_search. Allocation percentages and dollar splits are computed
// deterministically from the user's own capacity, so they need no source.

import type { Source } from "../agents/types";

export type { Source };

// ── Input: the investor profile ──────────────────────────────────────────────

export type RiskTolerance = "conservative" | "balanced" | "growth" | "aggressive";

// Goals the user is investing toward. Each maps to a horizon/liquidity profile
// the Goal & Liquidity planner reasons over.
export type Goal =
  | "retirement"
  | "wealth"
  | "house"
  | "income"
  | "education"
  | "bigPurchase"
  | "preservation";

// Guardrails that constrain the candidate vehicle universe.
export type Guardrail =
  | "indexOnly" // no single stocks or sector ETFs — broad funds only
  | "noBonds" // skip the bond sleeve entirely
  | "usOnly" // no international exposure
  | "dividendFocus" // tilt toward dividend/income vehicles
  | "addHedge" // add a small gold / I-Bond inflation hedge
  | "esgTilt"; // prefer a broad ESG fund for the core

export interface InvestorProfile {
  // Capacity — how much money the user is deploying.
  lumpSum: number; // one-time amount available now (USD), >= 0
  monthlyContribution: number; // recurring monthly SIP (USD), >= 0

  // Profile.
  riskTolerance: RiskTolerance;
  horizonYears: number; // 0.5 .. 50

  goals: Goal[]; // at least one

  // The TFV prerequisites (debt audit + emergency fund). These gate the plan.
  highInterestDebt: boolean; // any debt above ~7% APR
  hasEmergencyFund: boolean; // 3-6 months of expenses already set aside

  guardrails: Guardrail[];

  age?: number; // optional context only
  notes?: string; // free-text constraints, <= 280 chars
}

export type HorizonBucket = "short" | "medium" | "long" | "veryLong";

// ── Deterministic baseline (the TFV framework, no model) ──────────────────────

export type AssetClass =
  | "Core US Equity"
  | "International Equity"
  | "Bonds"
  | "Dividend / Income"
  | "Satellite / Single Stocks"
  | "Inflation Hedge"
  | "Cash Buffer";

// A prerequisite the user should clear before (or alongside) deploying — the
// debt-first and emergency-fund gates from the guide.
export interface Prerequisite {
  kind: "debt" | "emergency_fund";
  title: string;
  detail: string;
  blocking: boolean; // true = should largely come BEFORE investing
}

// One target sleeve in the deterministic skeleton. The specialists and judge
// reason over these exact numbers; the judge attaches specific tickers.
export interface BaselineSleeve {
  assetClass: AssetClass;
  targetPct: number; // 0-100, sums to ~100 across sleeves
  amountUSD: number; // targetPct of lumpSum
  monthlyUSD: number; // targetPct of monthlyContribution
}

// A vehicle the engine wants the sweep to price/quote. Deterministic — derived
// from the profile + guardrails so the sweep stays focused and cheap.
export interface CandidateVehicle {
  ticker: string; // "VTI", "VXUS"… or a pseudo-symbol like "HYSA" / "IBOND"
  name: string;
  assetClass: AssetClass;
  kind: "etf" | "fund" | "bond" | "cash" | "savings";
  // What the sweep should try to source for it.
  wants: Array<"price" | "expenseRatio" | "yield">;
}

export interface Baseline {
  bucket: HorizonBucket;
  // Capacity tier 1-4 (small → large), drives how many satellites are allowed.
  capacityTier: 1 | 2 | 3 | 4;
  annualDeploy: number; // monthly*12 + lumpSum amortized, for tiering only
  equityPct: number; // total equity across core+intl+satellite+dividend
  bondPct: number;
  cashPct: number;
  altPct: number;
  sleeves: BaselineSleeve[]; // sorted desc by targetPct
  prerequisites: Prerequisite[];
  candidateUniverse: CandidateVehicle[];
  notes: string[]; // deterministic rationale lines for the agents
}

// ── Sweep output: cited vehicle facts + macro regime ──────────────────────────

export interface VehicleFact {
  ticker: string;
  name: string;
  assetClass: AssetClass;
  kind: "etf" | "fund" | "bond" | "cash" | "savings";
  price?: string; // "$262.40"
  priceNum?: number | null;
  expenseRatio?: string; // "0.03%"
  yield?: string; // "4.6%" — MMF / bond / dividend / HYSA
  note?: string; // 1 short clause of color, optional
  sourceIndexes: number[];
}

export interface AllocatorFactSheet {
  asOf: string;
  vehicles: VehicleFact[];
  macroRegime: string; // 2-4 sentence current-regime read
  macroSourceIndexes: number[];
  sources: Source[];
  unresolved: string[]; // candidate tickers the sweep couldn't quote at all
}

// ── Specialist agents ─────────────────────────────────────────────────────────

export type SpecialistLane =
  | "Growth Architect"
  | "Risk Steward"
  | "Income & Tax Strategist"
  | "Goal & Liquidity Planner";

// A vehicle a specialist endorses, with a one-line reason. Tickers are
// validated against the swept universe before rendering.
export interface VehiclePick {
  ticker: string;
  reason: string;
}

export interface SpecialistOutput {
  lane: SpecialistLane;
  // The lane's recommended TOTAL equity allocation (0-100). The spread of these
  // across the four lanes is the deterministic disagreement score.
  equityPct: number;
  // 2-4 sentence cited stance, referencing facts with (#N).
  stance: string;
  endorses: VehiclePick[];
  // Plain-language risk/return read for this lane's recommendation.
  riskNote: string;
  sourceIndexes: number[];
  durationMs: number;
}

// ── Judge synthesis: the plan ─────────────────────────────────────────────────

export type RiskLevel = "low" | "moderate" | "elevated" | "high";

export interface AllocationLine {
  assetClass: AssetClass;
  vehicle: string; // ticker / "HYSA" / "I-Bonds"
  vehicleName: string;
  weightPct: number; // of the total investable amount
  amountUSD: number; // weightPct of lumpSum
  monthlyUSD: number; // weightPct of monthlyContribution
  riskLevel: RiskLevel;
  expectedReturn: string; // e.g. "7-10% / yr long-run"
  rationale: string; // why this fits the profile (cited with (#N))
  sourceIndexes: number[];
}

export interface AccountStep {
  account: string; // "401(k) to employer match", "Roth IRA", "HSA", "Taxable brokerage"
  detail: string; // one line on why / how much
}

export interface Exclusion {
  option: string; // "Individual stocks", "Bonds", "Crypto"
  reason: string; // why it does NOT fit this profile
}

export interface AllocatorPlan {
  profileSummary: string; // restate the profile in one prose sentence
  prerequisites: Prerequisite[]; // carried through from the baseline, possibly enriched
  allocation: AllocationLine[];
  // Deterministic rollups computed from the lines (not model-authored).
  equityPct: number;
  bondPct: number;
  cashPct: number;
  altPct: number;
  expectedReturnBand: string; // portfolio-level, e.g. "6-9% / yr"
  riskLevel: RiskLevel; // portfolio-level
  accountPriority: AccountStep[]; // tax-advantaged-first ordering
  sipPlan: string; // the SIP setup narrative (the guide's core tool)
  fits: string[]; // bullet reasons the plan fits the profile
  exclusions: Exclusion[]; // what we left out and why
  bottomLine: string; // one punchy sentence
  sourceIndexes: number[];
  durationMs: number;
}

// ── Top-level result ───────────────────────────────────────────────────────────

export interface AllocatorResult {
  runId: string;
  asOf: string;
  profile: InvestorProfile;
  baseline: Baseline;
  factSheet: AllocatorFactSheet;
  specialists: SpecialistOutput[];
  disagreement: number; // 0-100 spread of the lanes' equityPct reads
  plan: AllocatorPlan;
  warnings: string[];
  totalDurationMs: number;
  estCostUSD: number;
}

// ── Streaming events (API ↔ client) ───────────────────────────────────────────

export type AllocatorEvent =
  | { kind: "start"; runId: string }
  | { kind: "baseline_done"; baseline: Baseline }
  | { kind: "sweep_done"; factSheet: AllocatorFactSheet; costUSD: number }
  | { kind: "specialist_done"; specialist: SpecialistOutput; costUSD: number }
  | { kind: "judge_done"; result: AllocatorResult };
