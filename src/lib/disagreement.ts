// Deterministic disagreement scoring. Replaces the prior approach of
// asking the Judge model to self-report a 0-100 number. The Judge can't
// be trusted to score its own consensus rigorously, so we compute it
// from the agents array.
//
// Method:
// 1. Map each agent's verdict to a numeric score: BUY=+1, HOLD=0, SELL=-1.
// 2. Weight by confidence/100 so a 30-conf SELL contributes less than an
//    80-conf SELL. Agents that returned confidence=0 (failed lanes) are
//    skipped entirely.
// 3. Compute the confidence-weighted standard deviation of those scores.
//    Max possible spread on the four-agent panel: half BUY-conf-100 / half
//    SELL-conf-100 → std ≈ 1.0. We map [0, 1] → [0, 100].
// 4. Also account for unweighted vote spread: if 3 agents agree and 1
//    dissents we report ~30; if 2-2 we report ~70+. Take the max of the
//    weighted and unweighted signals.

import type { AgentOutput, Verdict } from "./agents/types";

function verdictScore(v: Verdict): number {
  if (v === "BUY") return 1;
  if (v === "SELL") return -1;
  return 0;
}

export function computeDisagreement(agents: AgentOutput[]): number {
  // Only count agents with non-zero confidence. Fallback HOLD/0 stubs from
  // failed specialists don't get a vote.
  const live = agents.filter((a) => a.confidence > 0);
  if (live.length < 2) return 0;

  // 1. Confidence-weighted variance of verdict scores.
  const weights = live.map((a) => Math.max(1, a.confidence) / 100);
  const scores = live.map((a) => verdictScore(a.verdict));
  const weightSum = weights.reduce((s, w) => s + w, 0);
  const weightedMean =
    scores.reduce((s, x, i) => s + x * weights[i], 0) / weightSum;
  const weightedVar =
    scores.reduce(
      (s, x, i) => s + weights[i] * (x - weightedMean) ** 2,
      0
    ) / weightSum;
  const weightedStd = Math.sqrt(weightedVar);
  const weightedScore = Math.min(100, Math.round(weightedStd * 100));

  // 2. Unweighted majority spread. A panel where 1 of 4 dissents still
  //    deserves ~30 disagreement even if everyone is high-conf.
  const counts: Record<Verdict, number> = { BUY: 0, HOLD: 0, SELL: 0 };
  for (const a of live) counts[a.verdict] += 1;
  const top = Math.max(counts.BUY, counts.HOLD, counts.SELL);
  const ratio = top / live.length; // 1.0 = unanimous, 0.34 = three-way tie
  // ratio=1.0 → 0,  ratio=0.75 → 25,  ratio=0.5 → 50,  ratio=0.34 → ~66
  const spreadScore = Math.round((1 - ratio) * 100);

  // 3. BUY-vs-SELL stretch: a BUY and a SELL on the same panel is louder
  //    than BUY vs HOLD even if vote ratios match.
  const hasBuy = counts.BUY > 0;
  const hasSell = counts.SELL > 0;
  const polarityBonus = hasBuy && hasSell ? 15 : 0;

  return Math.min(
    100,
    Math.max(weightedScore, spreadScore) + polarityBonus
  );
}

// Sector-level dispersion: how much a BASKET of stocks disagrees on direction.
// Same intuition as single-stock disagreement, but the "voters" are the basket
// constituents (each a BUY/HOLD/SELL with a 0-100 conviction) rather than the
// four specialists. A basket where everything is a high-conviction BUY scores
// near 0; a basket split between high-conviction BUYs and SELLs scores near
// 100. Like disagreement, this is computed deterministically — the sector
// judge does not self-report it.
export function computeDispersion(
  items: Array<{ verdict: Verdict; conviction: number }>
): number {
  const live = items.filter((i) => i.conviction > 0);
  if (live.length < 2) return 0;

  const weights = live.map((i) => Math.max(1, i.conviction) / 100);
  const scores = live.map((i) => verdictScore(i.verdict));
  const weightSum = weights.reduce((s, w) => s + w, 0);
  const weightedMean =
    scores.reduce((s, x, i) => s + x * weights[i], 0) / weightSum;
  const weightedVar =
    scores.reduce((s, x, i) => s + weights[i] * (x - weightedMean) ** 2, 0) /
    weightSum;
  const weightedScore = Math.min(100, Math.round(Math.sqrt(weightedVar) * 100));

  const counts: Record<Verdict, number> = { BUY: 0, HOLD: 0, SELL: 0 };
  for (const i of live) counts[i.verdict] += 1;
  const top = Math.max(counts.BUY, counts.HOLD, counts.SELL);
  const spreadScore = Math.round((1 - top / live.length) * 100);

  const polarityBonus = counts.BUY > 0 && counts.SELL > 0 ? 15 : 0;

  return Math.min(100, Math.max(weightedScore, spreadScore) + polarityBonus);
}
