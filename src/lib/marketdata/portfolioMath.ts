// Pure portfolio math over daily price history. NO model involvement, NO
// network, NO side effects — exact arithmetic only, unit-tested on fixtures
// (__tests__/portfolioMath.test.ts).
//
// These power the Portfolio stats strip (Beta · Volatility · Max Drawdown ·
// Sharpe) computed from the free marketdata history feed at $0 per render.
//
// Conventions (documented so the numbers are defensible, not just plausible):
//  - Returns are simple daily returns: r_t = P_t / P_{t-1} - 1.
//  - Annualization uses 252 trading days.
//  - Volatility = SAMPLE standard deviation of daily returns × √252.
//  - Beta = cov(asset, benchmark) / var(benchmark), sample covariance,
//    computed on date-INTERSECTED return series (see alignByDate).
//  - Sharpe = (annualized mean daily return − risk-free) / annualized vol,
//    arithmetic annualization (mean × 252) — the standard ex-post form.
//  - Risk-free rate is a 4.5% annual constant (decided in the playbook;
//    revisit when the rate regime moves materially).
//
// Every function returns null when the input is too short to support the
// statistic — callers render "—", never a fabricated number.

import type { Candle } from "./types";

export const RISK_FREE_ANNUAL = 0.045;
export const TRADING_DAYS_PER_YEAR = 252;
// Below this many paired daily returns the Portfolio stats strip refuses to
// render statistics (noise dressed as numbers). Lives here — not in the
// server-only live.ts — because the client-side stat explainers quote it.
export const MIN_STAT_OBSERVATIONS = 30;

// Simple daily returns from a close series. n closes → n-1 returns.
export function dailyReturns(closes: number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    const prev = closes[i - 1];
    if (prev > 0 && Number.isFinite(prev) && Number.isFinite(closes[i])) {
      out.push(closes[i] / prev - 1);
    }
  }
  return out;
}

// Intersect two candle series on date so return math compares the same
// sessions (a stock that IPO'd mid-range, or a missing session on one feed,
// must not shift the series against each other).
export function alignByDate(
  a: Candle[],
  b: Candle[]
): { dates: string[]; aCloses: number[]; bCloses: number[] } {
  const bByDate = new Map(b.map((c) => [c.date, c.close]));
  const dates: string[] = [];
  const aCloses: number[] = [];
  const bCloses: number[] = [];
  for (const c of a) {
    const bClose = bByDate.get(c.date);
    if (bClose === undefined) continue;
    dates.push(c.date);
    aCloses.push(c.close);
    bCloses.push(bClose);
  }
  return { dates, aCloses, bCloses };
}

function mean(xs: number[]): number {
  return xs.reduce((s, x) => s + x, 0) / xs.length;
}

// Sample variance (n−1 denominator).
function sampleVariance(xs: number[]): number {
  const m = mean(xs);
  return xs.reduce((s, x) => s + (x - m) * (x - m), 0) / (xs.length - 1);
}

// Annualized volatility as a FRACTION (0.25 = 25%). Needs ≥2 returns.
export function annualizedVolatility(
  returns: number[],
  periodsPerYear: number = TRADING_DAYS_PER_YEAR
): number | null {
  if (returns.length < 2) return null;
  return Math.sqrt(sampleVariance(returns)) * Math.sqrt(periodsPerYear);
}

// Beta of asset vs benchmark over EQUAL-LENGTH, same-session return series
// (use alignByDate + dailyReturns to build them). Needs ≥2 paired returns
// and a benchmark that actually moved.
export function beta(
  assetReturns: number[],
  benchmarkReturns: number[]
): number | null {
  const n = Math.min(assetReturns.length, benchmarkReturns.length);
  if (n < 2 || assetReturns.length !== benchmarkReturns.length) return null;
  const ma = mean(assetReturns);
  const mb = mean(benchmarkReturns);
  let cov = 0;
  let varB = 0;
  for (let i = 0; i < n; i++) {
    cov += (assetReturns[i] - ma) * (benchmarkReturns[i] - mb);
    varB += (benchmarkReturns[i] - mb) * (benchmarkReturns[i] - mb);
  }
  if (varB === 0) return null;
  return cov / varB; // (n−1) cancels
}

export interface MaxDrawdown {
  // Peak-to-trough loss as a POSITIVE fraction (0.38 = −38% drawdown).
  drawdown: number;
  peakIndex: number;
  troughIndex: number;
}

// Largest peak-to-trough decline over a close series. Needs ≥2 closes.
export function maxDrawdown(closes: number[]): MaxDrawdown | null {
  if (closes.length < 2) return null;
  let peak = closes[0];
  let peakIdx = 0;
  let best: MaxDrawdown = { drawdown: 0, peakIndex: 0, troughIndex: 0 };
  for (let i = 1; i < closes.length; i++) {
    if (closes[i] > peak) {
      peak = closes[i];
      peakIdx = i;
      continue;
    }
    const dd = peak > 0 ? (peak - closes[i]) / peak : 0;
    if (dd > best.drawdown) {
      best = { drawdown: dd, peakIndex: peakIdx, troughIndex: i };
    }
  }
  return best;
}

// Ex-post Sharpe ratio. Returns null when there's no dispersion to divide by
// (a flat series has no defined Sharpe — rendering one would be a lie).
export function sharpeRatio(
  returns: number[],
  riskFreeAnnual: number = RISK_FREE_ANNUAL,
  periodsPerYear: number = TRADING_DAYS_PER_YEAR
): number | null {
  const vol = annualizedVolatility(returns, periodsPerYear);
  if (vol === null || vol === 0) return null;
  const annualizedReturn = mean(returns) * periodsPerYear;
  return (annualizedReturn - riskFreeAnnual) / vol;
}

export interface PortfolioStats {
  beta: number | null;
  // Percent units for direct rendering: 24.3 = 24.3%.
  volatilityPct: number | null;
  maxDrawdownPct: number | null;
  sharpe: number | null;
  // Number of paired daily returns the stats were computed over — surfaced
  // so thin data is visible ("computed over 14 sessions" is a warning sign).
  observations: number;
}

// Convenience composition for the common case: one instrument (or a
// portfolio value series) vs the SPY benchmark, both as daily candles.
export function computePortfolioStats(
  asset: Candle[],
  benchmark: Candle[]
): PortfolioStats {
  const { aCloses, bCloses } = alignByDate(asset, benchmark);
  const ra = dailyReturns(aCloses);
  const rb = dailyReturns(bCloses);
  const b = beta(ra, rb);
  const vol = annualizedVolatility(ra);
  const dd = maxDrawdown(aCloses);
  const sharpe = sharpeRatio(ra);
  return {
    beta: b !== null ? round2(b) : null,
    volatilityPct: vol !== null ? round1(vol * 100) : null,
    maxDrawdownPct: dd !== null ? round1(dd.drawdown * 100) : null,
    sharpe: sharpe !== null ? round2(sharpe) : null,
    observations: ra.length,
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
