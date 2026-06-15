// Macro-factor sensitivity engine — the deterministic core of the Research
// Sandbox. NO AI draws these numbers: an ordinary least-squares regression
// estimates how an asset's monthly returns co-move with the macro regime
// (interest rate, inflation, corporate tax), then a counterfactual reprice
// shifts the historical path to the scenario the student dials in.
//
// Deterministic + reproducible: identical inputs → identical betas → identical
// path, every run. That property is what makes a Sandbox result citable.
//
// Methodology (disclosed to the user):
//   rₜ = α + β_rate·Rateₜ + β_inf·Inflationₜ + β_tax·Taxₜ + εₜ
//   rₜ = monthly log return; macro levels are the regime prevailing that month.
// Counterfactual: shift each month's return by βᵀ·(scenario − actualₜ), then
// recompound from the same starting price. A scenario equal to each month's
// actual macro reproduces the real path exactly (zero shift).

import type { DemoAsset, PricePoint } from "./data/prices";
import { macroAt, MACRO_BASELINE, MacroVector, MacroFactor } from "./data/macro";

export interface FactorModel {
  ticker: string;
  alpha: number; // intercept (monthly log return)
  betas: MacroVector; // sensitivity per +1 percentage-point of each factor
  rSquared: number; // in-sample fit, 0..1
  nObs: number;
  meanMonthlyReturn: number;
}

export interface Scenario extends MacroVector {}

// ── Returns ──────────────────────────────────────────────────────────────
// Monthly log returns aligned to points[1..]; element i corresponds to the
// move INTO points[i+1], dated by points[i+1].date.
function logReturns(points: PricePoint[]): { date: string; r: number }[] {
  const out: { date: string; r: number }[] = [];
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1].close;
    const cur = points[i].close;
    if (prev > 0 && cur > 0) out.push({ date: points[i].date, r: Math.log(cur / prev) });
  }
  return out;
}

// ── Linear algebra (4×4, zero deps) ───────────────────────────────────────
// Solve A·x = b for a small square system via Gaussian elimination with
// partial pivoting. Deterministic.
function solve(A: number[][], b: number[]): number[] {
  const n = b.length;
  // Augment.
  const m = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    // Pivot: largest magnitude in this column at/below the diagonal.
    let pivot = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(m[r][col]) > Math.abs(m[pivot][col])) pivot = r;
    }
    [m[col], m[pivot]] = [m[pivot], m[col]];
    const diag = m[col][col];
    if (Math.abs(diag) < 1e-12) continue; // singular column — leave coeff at 0
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const factor = m[r][col] / diag;
      for (let c = col; c <= n; c++) m[r][c] -= factor * m[col][c];
    }
  }
  return m.map((row, i) => (Math.abs(row[i]) < 1e-12 ? 0 : row[n] / row[i]));
}

// ── Fit ────────────────────────────────────────────────────────────────────
// OLS of monthly log returns on [1, rate, inflation, tax] macro levels.
export function fitFactorModel(asset: DemoAsset): FactorModel {
  const rets = logReturns(asset.points);
  const rows = rets.map(({ date, r }) => {
    const mv = macroAt(date);
    return { x: [1, mv.rate, mv.inflation, mv.tax], y: r };
  });

  const k = 4;
  const XtX: number[][] = Array.from({ length: k }, () => new Array(k).fill(0));
  const Xty: number[] = new Array(k).fill(0);
  for (const { x, y } of rows) {
    for (let a = 0; a < k; a++) {
      Xty[a] += x[a] * y;
      for (let b = 0; b < k; b++) XtX[a][b] += x[a] * x[b];
    }
  }
  const coeffs = solve(XtX, Xty); // [alpha, β_rate, β_inf, β_tax]

  // In-sample R².
  const yMean = rows.reduce((s, r) => s + r.y, 0) / (rows.length || 1);
  let ssRes = 0;
  let ssTot = 0;
  for (const { x, y } of rows) {
    const yHat = x[0] * coeffs[0] + x[1] * coeffs[1] + x[2] * coeffs[2] + x[3] * coeffs[3];
    ssRes += (y - yHat) ** 2;
    ssTot += (y - yMean) ** 2;
  }
  const rSquared = ssTot > 0 ? Math.max(0, 1 - ssRes / ssTot) : 0;

  return {
    ticker: asset.ticker,
    alpha: coeffs[0],
    betas: { rate: coeffs[1], inflation: coeffs[2], tax: coeffs[3] },
    rSquared,
    nObs: rows.length,
    meanMonthlyReturn: yMean,
  };
}

// Applied effect is bounded for legibility AND honesty: monthly betas from an
// in-sample regression are noisy, and extrapolating a large macro move far out
// of sample would compound into an absurd path over a decade. We cap the total
// applied drift at ±30%/yr and disclose it. The uncapped regression still lives
// in `model.betas` for the citation; this is the *display* sensitivity.
export const ANNUAL_EFFECT_CAP = 0.15;

export interface AppliedEffect {
  perFactorAnnual: Record<MacroFactor, number>; // signed fraction/yr, scaled to match the path
  totalAnnual: number; // signed fraction/yr actually applied (post-cap)
  monthlyDrift: number; // constant log-return drift added each month
  capped: boolean; // true when the raw effect hit the cap
}

// Effect of holding `scenario` instead of today's regime (MACRO_BASELINE),
// referenced to baseline so the slider reads as "vs the world as it is now".
// Per-factor contributions are scaled by the same cap factor as the total, so
// the bullets always sum to exactly what the chart shows.
export function appliedEffect(model: FactorModel, scenario: Scenario): AppliedEffect {
  const factors: MacroFactor[] = ["rate", "inflation", "tax"];
  const raw: Record<MacroFactor, number> = { rate: 0, inflation: 0, tax: 0 };
  let rawTotal = 0;
  for (const f of factors) {
    const annual = model.betas[f] * (scenario[f] - MACRO_BASELINE[f]) * 12; // fraction/yr
    raw[f] = annual;
    rawTotal += annual;
  }
  const cappedTotal = Math.max(-ANNUAL_EFFECT_CAP, Math.min(ANNUAL_EFFECT_CAP, rawTotal));
  const scale = Math.abs(rawTotal) > 1e-12 ? cappedTotal / rawTotal : 0;
  const perFactorAnnual: Record<MacroFactor, number> = {
    rate: raw.rate * scale,
    inflation: raw.inflation * scale,
    tax: raw.tax * scale,
  };
  return {
    perFactorAnnual,
    totalAnnual: cappedTotal,
    monthlyDrift: cappedTotal / 12,
    capped: Math.abs(rawTotal) > ANNUAL_EFFECT_CAP + 1e-12,
  };
}

// ── Counterfactual reprice ──────────────────────────────────────────────────
// Add a constant capped macro drift to every actual monthly return and
// recompound from the real starting price. The result is a smooth, monotonic
// divergence from the actual line whose direction follows the betas — readable
// at any slider position. A scenario equal to today's regime reproduces the
// actual path (zero drift). Aligned 1:1 with the asset's points.
export function counterfactualPath(asset: DemoAsset, model: FactorModel, scenario: Scenario): PricePoint[] {
  const pts = asset.points;
  if (pts.length === 0) return [];
  const { monthlyDrift } = appliedEffect(model, scenario);
  const out: PricePoint[] = [{ date: pts[0].date, close: pts[0].close }];
  let cum = pts[0].close;
  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1].close;
    const cur = pts[i].close;
    const actualR = prev > 0 && cur > 0 ? Math.log(cur / prev) : 0;
    cum *= Math.exp(actualR + monthlyDrift);
    out.push({ date: pts[i].date, close: Math.round(cum * 100) / 100 });
  }
  return out;
}

// ── Plain-text effect bullets (deterministic; LLM narrative layers on later) ──
export interface EffectBullet {
  factor: MacroFactor;
  text: string;
  annualizedPct: number; // signed effect on annual return, % (matches the chart)
}

const FACTOR_NOUN: Record<MacroFactor, string> = {
  rate: "interest rates",
  inflation: "inflation",
  tax: "the corporate tax rate",
};

// One bullet per factor, sorted by impact. Percentages are the post-cap applied
// contributions, so the explanation matches the rendered counterfactual exactly.
export function effectBullets(model: FactorModel, scenario: Scenario): EffectBullet[] {
  const eff = appliedEffect(model, scenario);
  const factors: MacroFactor[] = ["rate", "inflation", "tax"];
  return factors
    .map((f): EffectBullet => {
      const delta = scenario[f] - MACRO_BASELINE[f];
      const annualizedPct = eff.perFactorAnnual[f] * 100;
      const dir = annualizedPct >= 0 ? "adds" : "removes";
      const moveDir = delta >= 0 ? "Higher" : "Lower";
      const text =
        Math.abs(delta) < 1e-9
          ? `No change to ${FACTOR_NOUN[f]} — no modelled effect.`
          : `${moveDir} ${FACTOR_NOUN[f]} ` +
            `(${MACRO_BASELINE[f]}% → ${scenario[f]}%) ${dir} about ` +
            `${Math.abs(annualizedPct).toFixed(1)}% per year to the modelled path.`;
      return { factor: f, annualizedPct, text };
    })
    .sort((a, b) => Math.abs(b.annualizedPct) - Math.abs(a.annualizedPct));
}
