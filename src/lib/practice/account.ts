// Paper Trade Desk — notional $100k account math (isomorphic: no I/O).
//
// A trader's account is derived entirely from their paper positions — there is
// no separate cash ledger to desync. Open positions tie up cost basis; closed
// positions bank realized P&L; the live mark drives unrealized. Equity is always
// base + realized + unrealized, so the account reconciles by construction.
//
// Pure functions only (no DB, no fetch) so the same logic runs on the server for
// scoring and in the client for the desk header.

import {
  PAPER_BASE_EQUITY,
  MAX_TICKER_EXPOSURE_USD,
  type PaperAccount,
  type PaperPosition,
} from "./types";

const round2 = (n: number) => Math.round(n * 100) / 100;

// The mark we value a position at: exit price once closed, else the latest
// cited mark, else the entry (a freshly opened, never-marked position is flat).
function valuationPrice(p: PaperPosition): number {
  if (p.status === "closed") return p.exitPrice ?? p.entryPrice;
  return p.lastMark ?? p.entryPrice;
}

export function summarizeAccount(positions: PaperPosition[]): PaperAccount {
  let cashDeployed = 0;
  let realizedPnl = 0;
  let unrealizedPnl = 0;
  let openCount = 0;
  let closedCount = 0;
  const exposureByTicker: Record<string, number> = {};

  for (const p of positions) {
    const costBasis = p.entryPrice * p.qty;
    const pnl = (valuationPrice(p) - p.entryPrice) * p.qty;
    if (p.status === "closed") {
      realizedPnl += pnl;
      closedCount += 1;
    } else {
      cashDeployed += costBasis;
      unrealizedPnl += pnl;
      openCount += 1;
      exposureByTicker[p.ticker] = (exposureByTicker[p.ticker] ?? 0) + costBasis;
    }
  }

  const equity = PAPER_BASE_EQUITY + realizedPnl + unrealizedPnl;
  return {
    baseEquity: PAPER_BASE_EQUITY,
    cashDeployed: round2(cashDeployed),
    realizedPnl: round2(realizedPnl),
    unrealizedPnl: round2(unrealizedPnl),
    equity: round2(equity),
    returnPct: round2((equity / PAPER_BASE_EQUITY - 1) * 100),
    openCount,
    closedCount,
    exposureByTicker,
  };
}

export interface ExposureCheck {
  ok: boolean;
  /** Existing open cost basis already held in this ticker. */
  current: number;
  /** Cost basis of the proposed new fill. */
  incoming: number;
  /** The 10%-of-$100k ceiling. */
  cap: number;
}

// Guards the 10%-per-ticker cap at open time. Sums the new fill onto whatever is
// already open in that ticker and rejects if the combined cost basis would
// breach the cap. This is the core anti-lottery rule.
export function checkTickerExposure(
  openPositions: PaperPosition[],
  ticker: string,
  incomingCostBasis: number,
): ExposureCheck {
  const sym = ticker.trim().toUpperCase();
  const current = openPositions
    .filter((p) => p.status === "open" && p.ticker.toUpperCase() === sym)
    .reduce((sum, p) => sum + p.entryPrice * p.qty, 0);
  const cap = MAX_TICKER_EXPOSURE_USD;
  return {
    ok: current + incomingCostBasis <= cap + 1e-6,
    current: round2(current),
    incoming: round2(incomingCostBasis),
    cap,
  };
}
