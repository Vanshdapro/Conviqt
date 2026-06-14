// Shared types for the Portfolio Auditor pipeline. This is the public
// contract between: holdings input → sweep → metrics → 5 risk agents →
// judge → API → UI.
//
// Citation rule (inherited from the Council, see CLAUDE.md): every live
// market number (price, sector classification, macro read) must trace back
// to a Source via a sourceIndex. Weights and concentration figures are
// computed deterministically in metrics.ts from the user's own share counts
// times the sourced prices — they carry the price's provenance.

import type { Source } from "../agents/types";

export type { Source };

// ── Input ──────────────────────────────────────────────────────────────────────

// A single line item as the user entered it (CSV row or manual entry).
// costBasis is optional — used for unrealized P/L context only, never for
// risk math (risk is about current exposure, which uses current price).
export interface Holding {
  ticker: string;
  shares: number;
  costBasis?: number; // per-share average cost, optional
}

export interface PortfolioInput {
  name: string;
  holdings: Holding[];
}

// ── Sweep output ─────────────────────────────────────────────────────────────

// What the batched sweep recovers for ONE holding. Price is a string with
// units (the model controls formatting); priceNum is the parsed numeric we
// use for weight math. sectorSource / priceSource index into the sweep's
// Source list.
export interface HoldingFacts {
  ticker: string;
  companyName: string;
  sector: string;       // GICS-ish sector label
  industry?: string;    // finer-grained, optional
  price: string;        // e.g. "$187.32"
  priceNum: number | null; // parsed; null if the sweep couldn't price it
  priceAsOf?: string;   // e.g. "close 2026-05-30"
  assetType: "equity" | "etf" | "index" | "unknown";
  sourceIndexes: number[]; // sources backing this holding's price/sector
}

// The batched fact sheet the sweep produces for the whole basket. Shared
// macro context is collected once, not per-holding.
export interface PortfolioFactSheet {
  asOf: string;          // ISO timestamp stamped at run start
  holdings: HoldingFacts[];
  macroRegime: string;   // 2-4 sentence current-regime read (rates, growth, risk appetite)
  macroSourceIndexes: number[];
  sources: Source[];
  // Tickers the sweep could not resolve or price at all.
  unresolved: string[];
}

// ── Deterministic metrics ──────────────────────────────────────────────────────

export interface PositionMetric {
  ticker: string;
  companyName: string;
  sector: string;
  shares: number;
  price: string;
  value: number;        // shares * priceNum
  weightPct: number;    // value / totalValue * 100
  priced: boolean;      // false if the sweep couldn't price it (excluded from weights)
}

export interface SectorWeight {
  sector: string;
  weightPct: number;
  tickers: string[];
}

export interface PortfolioMetrics {
  totalValue: number;
  pricedValue: number;       // value of holdings we could price
  positions: PositionMetric[]; // sorted desc by weight
  sectors: SectorWeight[];   // sorted desc by weight
  topPositionPct: number;    // largest single weight
  top5Pct: number;           // sum of 5 largest weights
  topSectorPct: number;      // largest sector weight
  hhi: number;               // Herfindahl index, 0-10000 (sum of weight%^2)
  positionCount: number;
  unpricedCount: number;
}

// ── Risk agents ──────────────────────────────────────────────────────────────

export type RiskDimension =
  | "Concentration"
  | "Sector Overlap"
  | "Macro Vulnerability"
  | "Correlation"
  | "Hidden Exposure";

export type Severity = "low" | "moderate" | "elevated" | "high";

export interface RiskAgentOutput {
  dimension: RiskDimension;
  // 0-100 risk score for THIS dimension. Higher = more risk.
  score: number;
  // The agent's read of OVERALL portfolio risk (0-100). The spread of these
  // across the five agents is what the deterministic disagreement score
  // measures — i.e. how much the panel disagrees on how dangerous this book is.
  overallRisk: number;
  severity: Severity;
  // 2-3 sentence finding, citing weights / sectors / macro with [#N] indexes.
  finding: string;
  // Tickers this dimension flags as the main contributors to the risk.
  flaggedTickers: string[];
  sourceIndexes: number[];
  durationMs: number;
}

// ── Judge synthesis ────────────────────────────────────────────────────────────

export interface Scenario {
  // e.g. "Recession", "Rate Shock (+150bps)", "Tariff War", "Tech Selloff"
  name: string;
  // Estimated portfolio impact, e.g. "-18% to -26%"
  estImpactPct: string;
  // Which holdings get hit hardest, and why (1-2 sentences).
  narrative: string;
  hardestHit: string[]; // tickers
  severity: Severity;
  sourceIndexes: number[];
}

export interface Hedge {
  // Concrete action, e.g. "Trim NVDA from 22% to <10%" or "Add 5% TLT"
  action: string;
  // Why it helps and what risk it addresses (1-2 sentences).
  rationale: string;
  // Which risk dimension(s) it primarily mitigates.
  addresses: RiskDimension[];
  // Rough priority 1 (highest) .. N. Used to rank the list.
  priority: number;
}

export interface PortfolioJudgeOutput {
  // 0-100 overall portfolio HEALTH score. Higher = healthier (inverse of risk).
  healthScore: number;
  healthGrade: string;   // "A".."F" derived label, e.g. "B-"
  // 3-4 sentence plain-prose assessment, no inline [#N].
  assessment: string;
  // 2-4 short plain-English things this portfolio is doing RIGHT. A stress-test
  // still names what's working — beginners need the balance, not just the scold.
  strengths: string[];
  scenarios: Scenario[];
  hedges: Hedge[];       // ranked
  bottomLine: string;    // one punchy sentence
  sourceIndexes: number[];
  durationMs: number;
}

// ── Top-level result ───────────────────────────────────────────────────────────

export interface PortfolioAuditResult {
  runId: string;
  portfolioName: string;
  asOf: string;
  factSheet: PortfolioFactSheet;
  metrics: PortfolioMetrics;
  agents: RiskAgentOutput[];
  // Deterministic 0-100 spread of the agents' overallRisk reads.
  disagreement: number;
  judge: PortfolioJudgeOutput;
  warnings: string[];
  totalDurationMs: number;
  estCostUSD: number;
  cached?: boolean;
}
