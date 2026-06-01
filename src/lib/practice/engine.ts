// Conviqt Academy — Practice: the episode simulator.
//
// Pure and deterministic, so the SAME code runs on the client (to show live
// equity as the learner clicks bar by bar) and on the server (to compute the
// authoritative attempt that scoring.ts grades). No server imports — types only.
//
// Convention (matches PriceBar): we have close-only data, so every fill — manual
// buys/sells, stop hits, target hits, and the terminal/halt liquidation — resolves
// at the close of its bar. We never fabricate intrabar prices.

import type { EpisodeSpec, TradeAction, EpisodeAttempt } from "./types";

export interface EquityPoint {
  bar: number;
  t: string;
  close: number;
  cash: number;
  shares: number;
  equity: number;
}

export interface EpisodeRun {
  /** Manual fills (re-priced to the bar close) plus auto fills (stop/target/terminal). */
  resolvedActions: TradeAction[];
  equityCurve: EquityPoint[];
  /** Book value at bar 0 (cash + any starting shares marked at the first close). */
  startingEquity: number;
  finalEquity: number;
  /** Peak-to-trough equity drawdown as a positive fraction (0.3 = 30%). */
  maxDrawdown: number;
  /** Fully-invested passive baseline: all starting equity into the name at bar 0. */
  buyHoldEquity: number;
}

const EPS = 1e-9;

function clampBar(bar: number, len: number): number {
  if (!Number.isFinite(bar)) return 0;
  return Math.max(0, Math.min(Math.floor(bar), len - 1));
}

// Replays the learner's manual action log against the price path, generating the
// forced fills (stops, targets, terminal liquidation) the rules imply.
export function runEpisode(spec: EpisodeSpec, manualActions: TradeAction[]): EpisodeRun {
  const bars = spec.bars;
  const startCash = spec.startingCash;
  const startShares = spec.startingShares ?? 0;
  const firstClose = bars[0]?.close ?? 0;
  const startingEquity = startCash + startShares * firstClose;

  // Bucket manual actions by bar. Ignore any client-sent `auto` fills — we
  // regenerate those here so the client can never fake a favourable exit.
  const manualByBar = new Map<number, TradeAction[]>();
  for (const a of manualActions) {
    if (a.auto) continue;
    if (a.side !== "buy" && a.side !== "sell") continue;
    const bar = clampBar(a.atBar, bars.length);
    const list = manualByBar.get(bar) ?? [];
    list.push(a);
    manualByBar.set(bar, list);
  }

  let cash = startCash;
  let shares = startShares;
  let stop = 0;
  let target = 0;
  const resolved: TradeAction[] = [];
  const equityCurve: EquityPoint[] = [];
  let peak = startingEquity;
  let maxDrawdown = 0;

  for (let bar = 0; bar < bars.length; bar++) {
    const close = bars[bar].close;

    // 1) Manual actions at this bar, executed at the bar close.
    for (const a of manualByBar.get(bar) ?? []) {
      if (a.side === "buy") {
        const affordable = close > 0 ? Math.floor(cash / close) : 0;
        const qty = Math.max(0, Math.min(Math.floor(a.shares), affordable));
        if (qty > 0) {
          cash -= qty * close;
          shares += qty;
          resolved.push({ atBar: bar, side: "buy", shares: qty, price: close, stop: a.stop, target: a.target });
        }
      } else {
        const qty = Math.max(0, Math.min(Math.floor(a.shares), shares));
        if (qty > 0) {
          cash += qty * close;
          shares -= qty;
          resolved.push({ atBar: bar, side: "sell", shares: qty, price: close, stop: a.stop, target: a.target });
        }
      }
      if (typeof a.stop === "number") stop = a.stop;
      if (typeof a.target === "number") target = a.target;
    }

    // 2) Resolve a working stop or target at this close, if still holding.
    if (shares > 0 && stop > 0 && close <= stop + EPS) {
      cash += shares * close;
      resolved.push({ atBar: bar, side: "sell", shares, price: close, stop, auto: true });
      shares = 0; stop = 0; target = 0;
    } else if (shares > 0 && target > 0 && close >= target - EPS) {
      cash += shares * close;
      resolved.push({ atBar: bar, side: "sell", shares, price: close, target, auto: true });
      shares = 0; stop = 0; target = 0;
    }

    // 3) Halt or final bar: force-liquidate whatever is left, at this close.
    const isLast = bar === bars.length - 1;
    if ((bars[bar].halted || isLast) && shares > 0) {
      cash += shares * close;
      resolved.push({ atBar: bar, side: "sell", shares, price: close, auto: true });
      shares = 0;
    }

    const equity = cash + shares * close;
    equityCurve.push({ bar, t: bars[bar].t, close, cash, shares, equity });
    if (equity > peak) peak = equity;
    if (peak > 0) maxDrawdown = Math.max(maxDrawdown, (peak - equity) / peak);

    if (bars[bar].halted) break; // nothing trades after a halt
  }

  const finalEquity = equityCurve.length ? equityCurve[equityCurve.length - 1].equity : startingEquity;

  // Buy & hold: put all starting equity into the name at bar 0 and ride it to
  // the end — including straight into a halt (→ ~0). The active trader is graded
  // against this passive baseline.
  const lastClose = bars[bars.length - 1]?.close ?? firstClose;
  const bhShares = firstClose > 0 ? startingEquity / firstClose : 0;
  const buyHoldEquity = bhShares * lastClose;

  return { resolvedActions: resolved, equityCurve, startingEquity, finalEquity, maxDrawdown, buyHoldEquity };
}

// Builds the EpisodeAttempt the scoring engine consumes. `startingCash` carries
// the total book value at t0 so P&L % is measured against the whole book (this
// matters for episodes that hand you a position, e.g. SVB).
export function buildAttempt(
  spec: EpisodeSpec,
  drillId: string,
  manualActions: TradeAction[],
): { attempt: EpisodeAttempt; run: EpisodeRun } {
  const run = runEpisode(spec, manualActions);
  const attempt: EpisodeAttempt = {
    drillId,
    actions: run.resolvedActions,
    finalEquity: run.finalEquity,
    startingCash: run.startingEquity,
    maxDrawdown: run.maxDrawdown,
    buyHoldEquity: run.buyHoldEquity,
  };
  return { attempt, run };
}
