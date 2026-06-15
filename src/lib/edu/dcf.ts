// DCF + wedge engine — the deterministic core of the Market Wedge Finder.
//
// Fundamental value is COMPUTED, never AI-drawn: a two-stage discounted cash
// flow over SEC EDGAR free cash flow gives an intrinsic value per share. The
// "wedge" is the gap between that fundamental line and the actual market price.
// The LLM (later) only NAMES the distortion; it never produces the numbers.
//
// Honest scope: DCF applies to firms with meaningful free cash flow. Banks /
// financials (no conventional capex-based FCF) are excluded and say so — the
// textbook DCF limitation, surfaced rather than faked.

import type { Fundamentals } from "./data/fundamentals";
import type { PricePoint } from "./data/prices";
import { MACRO_BASELINE } from "./data/macro";

export interface DcfAssumptions {
  discountRate: number; // r, fraction (e.g. 0.0975)
  nearGrowth: number; // g1, fraction, applied for nearYears
  terminalGrowth: number; // g2, fraction (must be < r)
  nearYears: number; // explicit forecast horizon
}

export interface DcfResult {
  valid: boolean;
  reason?: string; // why invalid (e.g. bank / negative FCF)
  intrinsicPerShare: number;
  baseFcfPerShare: number;
  assumptions: DcfAssumptions;
}

// Default discount rate ties valuation to the macro baseline: risk-free proxy
// (today's policy rate) + a standard equity risk premium.
const EQUITY_RISK_PREMIUM = 0.055;
const DEFAULT_TERMINAL_GROWTH = 0.025;
const DEFAULT_NEAR_YEARS = 5;

// Realized FCF compound growth across the bundled history, floored at the
// terminal rate (a going concern doesn't shrink forever in a teaching DCF) and
// capped so one noisy year can't drive the model.
export function historicalFcfGrowth(f: Fundamentals): number {
  const h = f.fcfHistory.filter((x) => x.fcf > 0);
  if (h.length < 2) return 0.04;
  const first = h[0].fcf;
  const last = h[h.length - 1].fcf;
  const years = h.length - 1;
  if (first <= 0 || last <= 0) return 0.04;
  const cagr = (last / first) ** (1 / years) - 1;
  return Math.max(DEFAULT_TERMINAL_GROWTH, Math.min(0.15, cagr));
}

// Normalized base FCF — the average of the last up-to-3 positive fiscal years.
// Single-year FCF is noisy (working-capital swings, one heavy-capex year), and
// the whole valuation scales off the base, so we smooth it.
function normalizedBaseFcf(f: Fundamentals): number {
  const recent = f.fcfHistory.filter((x) => x.fcf > 0).slice(-3);
  if (!recent.length) return f.fcfHistory[f.fcfHistory.length - 1]?.fcf ?? 0;
  return recent.reduce((s, x) => s + x.fcf, 0) / recent.length;
}

export function defaultAssumptions(f: Fundamentals): DcfAssumptions {
  return {
    discountRate: Math.round((MACRO_BASELINE.rate / 100 + EQUITY_RISK_PREMIUM) * 1000) / 1000,
    nearGrowth: Math.round(historicalFcfGrowth(f) * 1000) / 1000,
    terminalGrowth: DEFAULT_TERMINAL_GROWTH,
    nearYears: DEFAULT_NEAR_YEARS,
  };
}

// Two-stage DCF → intrinsic value per share. Deterministic.
export function computeDcf(f: Fundamentals, a: DcfAssumptions): DcfResult {
  const base: Omit<DcfResult, "valid" | "reason"> = {
    intrinsicPerShare: 0,
    baseFcfPerShare: 0,
    assumptions: a,
  };

  if (!f.fcfHistory.length) {
    return { ...base, valid: false, reason: "No free-cash-flow history — DCF does not apply to this firm (e.g. banks/financials are valued on equity, not capex-based FCF)." };
  }
  if (!f.sharesOutstanding || f.sharesOutstanding <= 0) {
    return { ...base, valid: false, reason: "Shares outstanding unavailable." };
  }
  if (a.discountRate <= a.terminalGrowth) {
    return { ...base, valid: false, reason: "Discount rate must exceed terminal growth." };
  }

  const baseFcf = normalizedBaseFcf(f);
  if (baseFcf <= 0) {
    return { ...base, valid: false, reason: "Free cash flow is negative — DCF is not meaningful here." };
  }

  const fcfPerShare0 = baseFcf / f.sharesOutstanding;
  const { discountRate: r, nearGrowth: g1, terminalGrowth: g2, nearYears: n } = a;

  let pv = 0;
  let fcfPS = fcfPerShare0;
  for (let t = 1; t <= n; t++) {
    fcfPS = fcfPerShare0 * (1 + g1) ** t;
    pv += fcfPS / (1 + r) ** t;
  }
  // Gordon terminal value on year-n FCF.
  const terminal = (fcfPS * (1 + g2)) / (r - g2);
  pv += terminal / (1 + r) ** n;

  return {
    ...base,
    valid: true,
    intrinsicPerShare: Math.round(pv * 100) / 100,
    baseFcfPerShare: Math.round(fcfPerShare0 * 100) / 100,
  };
}

// ── Fair-value path + wedge ────────────────────────────────────────────────
// Project today's intrinsic value across the price history at a steady long-run
// growth rate, so the fundamental line is a smooth anchor the market price
// weaves around. Aligned 1:1 with the price points.
export function fairValuePath(
  intrinsicPerShare: number,
  priceDates: PricePoint[],
  growth: number
): PricePoint[] {
  if (priceDates.length === 0) return [];
  const monthlyG = (1 + growth) ** (1 / 12) - 1;
  const lastIdx = priceDates.length - 1;
  return priceDates.map((p, i) => {
    const monthsFromEnd = lastIdx - i;
    const value = intrinsicPerShare / (1 + monthlyG) ** monthsFromEnd;
    return { date: p.date, close: Math.round(value * 100) / 100 };
  });
}

export interface Wedge {
  latestPct: number; // (price − fair)/fair at the most recent month, %
  label: string; // distortion name (rule-based; LLM can refine later)
  bullets: string[]; // hedged, sourced explanation
}

// Deterministic distortion classifier. Direction + magnitude of the latest gap,
// sector-aware, always hedged. The LLM narrative layer (src/lib/openai.ts) can
// replace `label`/`bullets` when keys are present — it must stay hedged + sourced.
export function classifyWedge(
  ticker: string,
  name: string,
  price: PricePoint[],
  fair: PricePoint[]
): Wedge {
  const p = price[price.length - 1]?.close ?? 0;
  const f = fair[fair.length - 1]?.close ?? 0;
  const pct = f > 0 ? ((p - f) / f) * 100 : 0;
  const mag = Math.abs(pct);

  let label: string;
  if (pct > 30) label = "Growth-Premium Wedge";
  else if (pct > 10) label = "Mild Premium";
  else if (pct >= -10) label = "Fair-Value Band — no major distortion";
  else if (pct >= -30) label = "Pessimism / Value Wedge";
  else label = "Deep-Value or Distortion Wedge";

  const dir = pct >= 0 ? "above" : "below";
  const bullets: string[] = [];
  bullets.push(
    `The market price sits about ${mag.toFixed(0)}% ${dir} the modelled fundamental value as of the latest month.`
  );
  if (mag <= 10) {
    bullets.push("A gap this small is within normal valuation noise — no strong distortion is implied.");
  } else if (pct > 10) {
    bullets.push(
      "A premium this size may reflect growth, quality, or sentiment the cash-flow model does not capture — or genuine over-pricing. The model cannot distinguish these on its own."
    );
  } else {
    bullets.push(
      "A discount this size may reflect risks, declining cash flows, or pessimism the model does not capture — or a genuine value opportunity. The sign alone does not tell you which."
    );
  }
  bullets.push(
    "This wedge is only as good as the DCF assumptions (discount rate, growth, terminal growth) — change them and the gap moves. Treat it as a starting question, not an answer."
  );

  return { latestPct: Math.round(pct * 10) / 10, label, bullets };
}
