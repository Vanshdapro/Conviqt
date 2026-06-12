// Live Portfolio view (server-only) — prices a basket of holdings with the
// marketdata layer and computes the stats strip with portfolioMath. NO model
// involvement: this is the free, every-page-load half of the Portfolio
// surface (playbook Phase 5). The paid half is the AI Health Check, which
// stays in orchestrator.ts.
//
// Honesty rules (CLAUDE.md): a holding the feeds can't price renders null
// fields (the UI shows "—" and says so), never a guessed number. Every
// rendered price traces to a Quote with provider + sourceUrl + freshness.

import { history, quote } from "../marketdata";
import type { Candle, PriceHistory, Quote } from "../marketdata/types";
import { FRESHNESS_LABELS } from "../marketdata/types";
import {
  computePortfolioStats,
  MIN_STAT_OBSERVATIONS,
  type PortfolioStats,
} from "../marketdata/portfolioMath";
import { universeName } from "../tickers";
import type { Holding } from "./types";

export const STATS_BENCHMARK = "SPY";

export interface LiveHoldingRow {
  ticker: string;
  companyName: string | null;
  shares: number;
  costBasis: number | null;
  price: number | null;
  changePct: number | null; // vs previous close
  value: number | null; // shares * price
  weightPct: number | null; // of priced portfolio value
  dayPL: number | null; // shares * (price - prevClose)
  totalPL: number | null; // shares * (price - costBasis); needs costBasis
  totalPLPct: number | null;
  freshnessLabel: string | null;
  sourceUrl: string | null;
}

export interface LiveTotals {
  value: number; // priced value
  dayPL: number | null;
  dayPLPct: number | null;
  totalPL: number | null; // over holdings with a cost basis only
  totalPLPct: number | null;
  costBasisCount: number; // holdings carrying a cost basis
  pricedCount: number;
  unpricedCount: number;
  freshnessLabel: string | null; // stalest label among the quotes — honest worst case
}

export interface LiveStatsStrip {
  stats: PortfolioStats | null;
  holdingsUsed: number; // holdings with usable 1y history
  holdingsTotal: number;
  benchmark: string;
  /** set when stats is null — plain-English why */
  reason: string | null;
}

export interface LivePortfolioView {
  rows: LiveHoldingRow[];
  totals: LiveTotals;
  statsStrip: LiveStatsStrip;
}

// ── Pricing ──────────────────────────────────────────────────────────────────

const FRESHNESS_RANK = { realtime: 0, delayed: 1, eod: 2 } as const;

function stalestLabel(quotes: Quote[]): string | null {
  if (quotes.length === 0) return null;
  const worst = quotes.reduce((a, q) =>
    FRESHNESS_RANK[q.freshness] > FRESHNESS_RANK[a.freshness] ? q : a
  );
  return worst.freshness === "eod"
    ? FRESHNESS_LABELS.eod
    : worst.freshnessLabel;
}

async function priceRows(
  holdings: Holding[]
): Promise<{ rows: LiveHoldingRow[]; totals: LiveTotals }> {
  const quotes = await Promise.all(
    holdings.map((h) => quote(h.ticker).catch(() => null))
  );

  const rows: LiveHoldingRow[] = holdings.map((h, i) => {
    const q = quotes[i];
    const costBasis = h.costBasis ?? null;
    if (!q) {
      return {
        ticker: h.ticker,
        companyName: universeName(h.ticker) ?? null,
        shares: h.shares,
        costBasis,
        price: null,
        changePct: null,
        value: null,
        weightPct: null,
        dayPL: null,
        totalPL: null,
        totalPLPct: null,
        freshnessLabel: null,
        sourceUrl: null,
      };
    }
    const value = h.shares * q.price;
    const dayPL = q.prevClose !== null ? h.shares * (q.price - q.prevClose) : null;
    const totalPL = costBasis !== null ? h.shares * (q.price - costBasis) : null;
    return {
      ticker: h.ticker,
      companyName: universeName(h.ticker) ?? null,
      shares: h.shares,
      costBasis,
      price: q.price,
      changePct: q.changePct,
      value,
      weightPct: null, // filled below once the priced total is known
      dayPL,
      totalPL,
      totalPLPct:
        totalPL !== null && costBasis !== null && costBasis > 0
          ? (totalPL / (h.shares * costBasis)) * 100
          : null,
      freshnessLabel: q.freshnessLabel,
      sourceUrl: q.sourceUrl,
    };
  });

  const priced = rows.filter((r) => r.value !== null);
  const totalValue = priced.reduce((s, r) => s + (r.value as number), 0);
  for (const r of rows) {
    if (r.value !== null && totalValue > 0) {
      r.weightPct = (r.value / totalValue) * 100;
    }
  }

  // Day P/L aggregates over holdings that have BOTH price and prevClose.
  const dayRows = rows.filter((r) => r.dayPL !== null);
  const dayPL = dayRows.length > 0 ? dayRows.reduce((s, r) => s + (r.dayPL as number), 0) : null;
  const prevValue = dayRows.reduce(
    (s, r) => s + ((r.value as number) - (r.dayPL as number)),
    0
  );
  const dayPLPct = dayPL !== null && prevValue > 0 ? (dayPL / prevValue) * 100 : null;

  // Total P/L aggregates over holdings carrying a cost basis.
  const costRows = rows.filter((r) => r.totalPL !== null);
  const totalPL =
    costRows.length > 0 ? costRows.reduce((s, r) => s + (r.totalPL as number), 0) : null;
  const costValue = costRows.reduce(
    (s, r) => s + r.shares * (r.costBasis as number),
    0
  );
  const totalPLPct = totalPL !== null && costValue > 0 ? (totalPL / costValue) * 100 : null;

  return {
    rows,
    totals: {
      value: totalValue,
      dayPL,
      dayPLPct,
      totalPL,
      totalPLPct,
      costBasisCount: costRows.length,
      pricedCount: priced.length,
      unpricedCount: rows.length - priced.length,
      freshnessLabel: stalestLabel(
        quotes.filter((q): q is Quote => q !== null)
      ),
    },
  };
}

// ── Stats strip ──────────────────────────────────────────────────────────────

// Build the portfolio's daily value series: for each session where EVERY
// holding with usable history has a close, value = Σ shares × close. Holdings
// with no history at all are excluded (and surfaced via holdingsUsed) rather
// than silently zeroed — partial coverage is shown, never hidden.
// Exported for the fixture tests (__tests__/live.test.ts) — pure function.
export function portfolioValueSeries(
  holdings: Holding[],
  histories: Array<PriceHistory | null>
): { candles: Candle[]; used: number } {
  const usable: Array<{ shares: number; closes: Map<string, number> }> = [];
  histories.forEach((ph, i) => {
    if (ph && ph.candles.length >= 2) {
      usable.push({
        shares: holdings[i].shares,
        closes: new Map(ph.candles.map((c) => [c.date, c.close])),
      });
    }
  });
  if (usable.length === 0) return { candles: [], used: 0 };

  // Intersect dates across all usable holdings, walking the first one.
  const candles: Candle[] = [];
  const firstDates = [...usable[0].closes.keys()].sort();
  for (const date of firstDates) {
    let value = 0;
    let covered = true;
    for (const u of usable) {
      const close = u.closes.get(date);
      if (close === undefined) {
        covered = false;
        break;
      }
      value += u.shares * close;
    }
    if (covered) {
      candles.push({ date, open: value, high: value, low: value, close: value, volume: null });
    }
  }
  return { candles, used: usable.length };
}

async function statsStrip(holdings: Holding[]): Promise<LiveStatsStrip> {
  const base: Omit<LiveStatsStrip, "stats" | "reason" | "holdingsUsed"> = {
    holdingsTotal: holdings.length,
    benchmark: STATS_BENCHMARK,
  };
  const [bench, ...histories] = await Promise.all([
    history(STATS_BENCHMARK, "1y").catch(() => null),
    ...holdings.map((h) => history(h.ticker, "1y").catch(() => null)),
  ]);

  const { candles, used } = portfolioValueSeries(holdings, histories);

  if (!bench || bench.candles.length < 2) {
    return {
      ...base,
      holdingsUsed: used,
      stats: null,
      reason: "Market benchmark history is unavailable right now.",
    };
  }
  if (candles.length < 2) {
    return {
      ...base,
      holdingsUsed: used,
      stats: null,
      reason: "Price history for these holdings is unavailable right now.",
    };
  }

  const stats = computePortfolioStats(candles, bench.candles);
  if (stats.observations < MIN_STAT_OBSERVATIONS) {
    return {
      ...base,
      holdingsUsed: used,
      stats: null,
      reason: `Not enough shared trading history yet (${stats.observations} sessions — these need at least ${MIN_STAT_OBSERVATIONS}).`,
    };
  }
  return { ...base, holdingsUsed: used, stats, reason: null };
}

// ── Entry point ──────────────────────────────────────────────────────────────

export async function getLivePortfolioView(
  holdings: Holding[]
): Promise<LivePortfolioView> {
  const [{ rows, totals }, strip] = await Promise.all([
    priceRows(holdings),
    statsStrip(holdings),
  ]);
  return { rows, totals, statsStrip: strip };
}
