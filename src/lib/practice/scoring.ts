// Conviqt Academy — Practice: episode scoring engine.
//
// Pure, deterministic. Given the episode spec and the learner's recorded
// attempt (their action log + final equity), it grades PROCESS first and P&L
// second — the explicit product decision: a lucky win with reckless sizing
// should score worse than a disciplined small loss.
//
// Five dimensions, process-weighted (P&L is only 10%):
//   Risk discipline  30 — did they size sanely and use stops?
//   Loss control     25 — did they cut losers / honor invalidation, not average
//                          into a falling knife, avoid catastrophic drawdown?
//   Signal response  25 — at the episode's key moments (the capitulation low, the
//                          thesis-breaking headline), did they act the right way?
//   Discipline       10 — did they avoid overtrading / churn?
//   Outcome (P&L)    10 — alpha vs buy-and-hold, capped so luck can't dominate.

import type {
  EpisodeSpec,
  EpisodeAttempt,
  EpisodeScore,
  ScoreDimension,
  TradeAction,
} from "./types";
import { starsForScore } from "./types";

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

// Reconstructs share/cash/cost-basis state after each action so we can reason
// about position size and adding-to-losers without trusting client-side math.
interface ReplayPoint {
  action: TradeAction;
  sharesAfter: number;
  avgCostBefore: number; // average cost basis just before this action
  equityAfter: number;
}

function replay(spec: EpisodeSpec, actions: TradeAction[]): ReplayPoint[] {
  let cash = spec.startingCash;
  let shares = spec.startingShares ?? 0;
  let costBasis = (spec.startingShares ?? 0) * (spec.startingCostBasis ?? 0);
  const points: ReplayPoint[] = [];

  for (const a of actions) {
    const avgCostBefore = shares > 0 ? costBasis / shares : 0;
    if (a.side === "buy") {
      cash -= a.shares * a.price;
      shares += a.shares;
      costBasis += a.shares * a.price;
    } else {
      const sold = Math.min(a.shares, shares);
      // reduce cost basis proportionally
      if (shares > 0) costBasis -= (sold / shares) * costBasis;
      shares -= sold;
      cash += sold * a.price;
    }
    const equityAfter = cash + shares * a.price;
    points.push({ action: a, sharesAfter: shares, avgCostBefore, equityAfter });
  }
  return points;
}

function dimension(id: string, label: string, score: number, weight: number, note: string): ScoreDimension {
  return { id, label, score: Math.round(clamp(score, 0, 100)), weight, note };
}

export function scoreEpisode(spec: EpisodeSpec, attempt: EpisodeAttempt): EpisodeScore {
  const manualTrades = attempt.actions.filter((a) => !a.auto);
  const points = replay(spec, attempt.actions);
  const lastBar = spec.bars.length - 1;

  // ── P&L vs benchmark ────────────────────────────────────────────────────────
  const pnlPct = ((attempt.finalEquity - attempt.startingCash) / attempt.startingCash) * 100;
  const buyHoldPct = ((attempt.buyHoldEquity - attempt.startingCash) / attempt.startingCash) * 100;
  const alphaPct = pnlPct - buyHoldPct;

  // ── Risk discipline ──────────────────────────────────────────────────────────
  const everSetStop = attempt.actions.some((a) => (a.stop ?? 0) > 0);
  let maxPositionPct = 0;
  for (const p of points) {
    if (p.action.side === "buy" && p.equityAfter > 0) {
      const posValue = p.sharesAfter * p.action.price;
      maxPositionPct = Math.max(maxPositionPct, posValue / p.equityAfter);
    }
  }
  // Adding to a loser: a buy at a price >10% below the average cost held just before it.
  const averagedIntoLoser = points.some(
    (p) => p.action.side === "buy" && p.avgCostBefore > 0 && p.action.price < p.avgCostBefore * 0.9,
  );

  let risk = 100;
  let riskNote = "Sized sensibly and managed exposure.";
  if (!everSetStop && maxPositionPct > 0.5) {
    risk -= 50;
    riskNote = "You bet over half the book on one name with no stop. That's how accounts blow up.";
  } else if (maxPositionPct > 0.9) {
    risk -= 35;
    riskNote = "You went effectively all-in. Even a great thesis can't survive that sizing.";
  } else if (!everSetStop) {
    risk -= 25;
    riskNote = "No stop was ever set — you were trading without a pre-defined exit.";
  } else if (maxPositionPct > 0.6) {
    risk -= 15;
    riskNote = "Position size ran hot; trim to keep a single name from dominating the book.";
  }
  if (averagedIntoLoser) {
    risk -= 20;
    if (risk < 60) riskNote = "You added to a losing position — averaging down on a broken setup.";
  }

  // ── Signal response (key moments) ──────────────────────────────────────────────
  // For each key moment, did the learner act in the ideal direction within a small
  // window after it? Reward ideal action, penalise the opposite.
  let signalScore = 100;
  let signalNote = "Read the tape well at the moments that mattered.";
  const keyMoments = spec.keyMoments ?? [];
  if (keyMoments.length > 0) {
    let earned = 0;
    const perMoment = 100 / keyMoments.length;
    const worst: string[] = [];
    for (const km of keyMoments) {
      const window = manualTrades.filter((a) => a.atBar >= km.atBar - 1 && a.atBar <= km.atBar + 2);
      const bought = window.some((a) => a.side === "buy");
      const sold = window.some((a) => a.side === "sell");
      let credit = perMoment * 0.4; // neutral / did nothing — partial credit
      if (km.ideal === "buy" || km.ideal === "hold") {
        if (sold && !bought) { credit = 0; worst.push(`sold into ${quote(spec, km.atBar)} — selling the bottom`); }
        else if (bought || km.ideal === "hold") credit = perMoment;
        else credit = perMoment * 0.5; // held through it
      } else { // sell / cut
        if (bought && !sold) { credit = 0; worst.push(`bought near ${quote(spec, km.atBar)} — chasing into the wrong moment`); }
        else if (sold) credit = perMoment;
        else credit = perMoment * 0.3; // failed to cut
      }
      earned += credit;
    }
    signalScore = earned;
    if (worst.length > 0) signalNote = `Mistimed a key moment: ${worst[0]}.`;
    else if (signalScore < 70) signalNote = "You sat out the moments that actually decided this episode.";
  }

  // ── Loss control ───────────────────────────────────────────────────────────────
  let loss = 100;
  let lossNote = "Kept losses contained.";
  // Held into a terminal/halted bar with shares = catastrophic (e.g. SVB → zero).
  const haltedBar = spec.bars.findIndex((b) => b.halted);
  const heldIntoHalt =
    haltedBar >= 0 && finalShares(spec, attempt.actions) > 0;
  if (heldIntoHalt) {
    loss -= 55;
    lossNote = "You rode a position into a wipeout. The first loss is the cheapest — cut on the invalidation.";
  }
  if (averagedIntoLoser) {
    loss -= 25;
    if (loss < 60) lossNote = "Averaging into the fall turned a manageable loss into a big one.";
  }
  if (attempt.maxDrawdown > 0.4) {
    loss -= 30;
    if (loss < 50) lossNote = `You let equity draw down ${Math.round(attempt.maxDrawdown * 100)}%. Recovering from that needs a ${Math.round((attempt.maxDrawdown / (1 - attempt.maxDrawdown)) * 100)}% gain.`;
  } else if (attempt.maxDrawdown > 0.25) {
    loss -= 15;
  }
  // Unhonored "cut" moments hurt loss control too.
  for (const km of keyMoments.filter((k) => k.ideal === "cut" || k.ideal === "sell")) {
    const reacted = manualTrades.some((a) => a.side === "sell" && a.atBar >= km.atBar && a.atBar <= km.atBar + 2);
    if (!reacted) loss -= 20;
  }

  // ── Discipline / overtrading ────────────────────────────────────────────────────
  let discipline = 100;
  let discNote = "No churn — every trade had a reason.";
  const tradeBudget = Math.max(4, Math.ceil(spec.bars.length / 3));
  if (manualTrades.length > tradeBudget) {
    const over = manualTrades.length - tradeBudget;
    discipline = clamp(100 - over * 12, 40, 100);
    discNote = `${manualTrades.length} trades in ${spec.bars.length} bars — overtrading bleeds edge through costs and noise.`;
  } else if (manualTrades.length === 0) {
    discipline = 60;
    discNote = "You never traded. Sometimes right, but Practice rewards taking a considered position.";
  }

  // ── P&L dimension (capped influence) ─────────────────────────────────────────────
  const pnlScore = clamp(50 + alphaPct * 2.5, 0, 100); // +20% alpha → 100, -20% → 0
  const pnlNote =
    alphaPct >= 0
      ? `Beat buy-and-hold by ${alphaPct.toFixed(1)} points.`
      : `Trailed buy-and-hold by ${Math.abs(alphaPct).toFixed(1)} points.`;

  const dimensions: ScoreDimension[] = [
    dimension("risk", "Risk discipline", risk, 30, riskNote),
    dimension("loss", "Loss control", loss, 25, lossNote),
    dimension("signal", "Signal response", signalScore, 25, signalNote),
    dimension("discipline", "Trading discipline", discipline, 10, discNote),
    dimension("pnl", "Outcome (vs buy & hold)", pnlScore, 10, pnlNote),
  ];

  const overall = Math.round(
    dimensions.reduce((sum, d) => sum + d.score * d.weight, 0) / 100,
  );
  const stars = starsForScore(overall);

  const headline = buildHeadline(overall, alphaPct, stars);

  return {
    overall,
    stars,
    dimensions,
    pnlPct: round2(pnlPct),
    buyHoldPct: round2(buyHoldPct),
    alphaPct: round2(alphaPct),
    headline,
  };

  function quote(s: EpisodeSpec, bar: number): string {
    const b = s.bars[bar];
    return b ? `${b.t}` : `that moment`;
  }
}

function finalShares(spec: EpisodeSpec, actions: TradeAction[]): number {
  let shares = spec.startingShares ?? 0;
  for (const a of actions) shares += a.side === "buy" ? a.shares : -a.shares;
  return Math.max(0, shares);
}

function buildHeadline(overall: number, alpha: number, stars: number): string {
  if (stars === 3) return "PM-grade. Disciplined process and you got paid for it.";
  if (stars === 2 && alpha >= 0) return "Solid. The process held up and you beat the benchmark.";
  if (stars === 2) return "Good discipline — the result lagged, but the process was sound.";
  if (overall >= 45) return "Mixed. The risk management needs work before the P&L will follow.";
  return "Rough run. Re-read the debrief: this is exactly what the drill is built to fix.";
}

const round2 = (n: number) => Math.round(n * 100) / 100;
