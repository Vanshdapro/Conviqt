// Deterministic disagreement for the Portfolio Auditor. Conviqt's core value
// prop is making panel disagreement visible — here it answers "how much do the
// five risk analysts disagree on how dangerous this book is?"
//
// Each agent reports an overallRisk read (0-100). We map the spread of those
// reads to a 0-100 disagreement score: a tight cluster (everyone says ~70)
// = low disagreement; a wide split (one says 30, another says 85) = high.
//
// Method: population standard deviation of the overallRisk values, scaled.
// A std of ~28 points on a 0-100 scale already signals a sharp split, so we
// map std → disagreement with a 2.4x gain and clamp to 100.

import type { RiskAgentOutput } from "./types";

export function computePortfolioDisagreement(agents: RiskAgentOutput[]): number {
  const reads = agents
    .map((a) => a.overallRisk)
    .filter((n) => typeof n === "number" && isFinite(n));
  if (reads.length < 2) return 0;

  const mean = reads.reduce((s, x) => s + x, 0) / reads.length;
  const variance =
    reads.reduce((s, x) => s + (x - mean) ** 2, 0) / reads.length;
  const std = Math.sqrt(variance);

  return Math.max(0, Math.min(100, Math.round(std * 2.4)));
}
