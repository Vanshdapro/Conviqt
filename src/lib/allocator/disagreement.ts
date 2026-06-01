// Deterministic disagreement for the Allocator. Conviqt's core value prop is
// making panel disagreement visible — here it answers "how much do the four
// planning agents disagree on how much equity this investor should hold?"
//
// Each lane reports an equityPct (0-100). We map the spread of those reads to a
// 0-100 disagreement score: a tight cluster (everyone ~75%) = low disagreement;
// a wide split (Risk Steward says 40, Growth Architect says 90) = high.
//
// Method: population standard deviation of the equityPct reads, scaled. A std
// of ~21 points on a 0-100 equity scale already signals a sharp split, so we
// map std → disagreement with a 3.2x gain and clamp to 100.

import type { SpecialistOutput } from "./types";

export function computeAllocatorDisagreement(specialists: SpecialistOutput[]): number {
  const reads = specialists
    .map((s) => s.equityPct)
    .filter((n) => typeof n === "number" && isFinite(n));
  if (reads.length < 2) return 0;

  const mean = reads.reduce((s, x) => s + x, 0) / reads.length;
  const variance = reads.reduce((s, x) => s + (x - mean) ** 2, 0) / reads.length;
  const std = Math.sqrt(variance);

  return Math.max(0, Math.min(100, Math.round(std * 3.2)));
}
