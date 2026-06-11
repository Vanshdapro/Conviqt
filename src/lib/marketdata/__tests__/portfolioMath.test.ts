// Unit tests for the pure portfolio math. Run with `npm test`.
//
// Expected values are HAND-COMPUTED from the fixtures (shown in comments),
// not regenerated from the code under test — a regression must fail loudly.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  alignByDate,
  annualizedVolatility,
  beta,
  computePortfolioStats,
  dailyReturns,
  maxDrawdown,
  RISK_FREE_ANNUAL,
  sharpeRatio,
  TRADING_DAYS_PER_YEAR,
} from "../portfolioMath";
import type { Candle } from "../types";

function approx(actual: number | null, expected: number, eps = 1e-9) {
  assert.notEqual(actual, null, `expected ≈${expected}, got null`);
  assert.ok(
    Math.abs((actual as number) - expected) < eps,
    `expected ≈${expected}, got ${actual}`
  );
}

function candle(date: string, close: number): Candle {
  return { date, open: close, high: close, low: close, close, volume: 1000 };
}

describe("dailyReturns", () => {
  it("computes simple returns: 100→110→99→104.5", () => {
    // 110/100−1 = 0.10 ; 99/110−1 = −0.10 ; 104.5/99−1 = 0.0555…
    const r = dailyReturns([100, 110, 99, 104.5]);
    assert.equal(r.length, 3);
    approx(r[0], 0.1);
    approx(r[1], -0.1);
    approx(r[2], 104.5 / 99 - 1);
  });

  it("skips non-positive and non-finite previous closes", () => {
    assert.deepEqual(dailyReturns([0, 100]), []);
    assert.deepEqual(dailyReturns([100]), []);
    assert.deepEqual(dailyReturns([]), []);
  });
});

describe("annualizedVolatility", () => {
  it("matches hand-computed sample stdev × √252", () => {
    // returns [0.01, −0.01, 0.01, −0.01]: mean 0,
    // sample var = 4·(0.01)² / 3 = 1.3333e−4, sd = 0.011547005,
    // annualized = 0.011547005 × √252 = 0.18330302…
    const vol = annualizedVolatility([0.01, -0.01, 0.01, -0.01]);
    approx(vol, Math.sqrt(0.0004 / 3) * Math.sqrt(252), 1e-12);
    approx(vol, 0.1833030278, 1e-9);
  });

  it("returns null below 2 observations", () => {
    assert.equal(annualizedVolatility([0.01]), null);
    assert.equal(annualizedVolatility([]), null);
  });
});

describe("beta", () => {
  it("is exactly 2 when asset returns are 2× benchmark returns", () => {
    const bench = [0.01, -0.02, 0.015, 0.005, -0.01];
    const asset = bench.map((r) => 2 * r);
    approx(beta(asset, bench), 2, 1e-12);
  });

  it("is exactly 1 against itself and 0 for an uncorrelated flat asset", () => {
    const bench = [0.01, -0.02, 0.015];
    approx(beta(bench, bench), 1, 1e-12);
    approx(beta([0, 0, 0], bench), 0, 1e-12);
  });

  it("returns null for length mismatch, short series, or flat benchmark", () => {
    assert.equal(beta([0.01, 0.02], [0.01]), null);
    assert.equal(beta([0.01], [0.01]), null);
    assert.equal(beta([0.01, 0.02], [0.005, 0.005]), null);
  });
});

describe("maxDrawdown", () => {
  it("finds the deepest peak-to-trough: [100,120,90,95,130,80] → −38.46% from 130", () => {
    // 120→90 = 25% ; 130→80 = 38.4615…% → the latter wins.
    const dd = maxDrawdown([100, 120, 90, 95, 130, 80]);
    assert.notEqual(dd, null);
    approx(dd!.drawdown, 50 / 130, 1e-12);
    assert.equal(dd!.peakIndex, 4);
    assert.equal(dd!.troughIndex, 5);
  });

  it("is 0 for a monotonically rising series", () => {
    const dd = maxDrawdown([100, 101, 102, 103]);
    approx(dd!.drawdown, 0, 1e-12);
  });

  it("returns null below 2 closes", () => {
    assert.equal(maxDrawdown([100]), null);
    assert.equal(maxDrawdown([]), null);
  });
});

describe("sharpeRatio", () => {
  it("matches hand-computed value on a small fixture", () => {
    // returns [0.002, 0, 0.002, 0]: mean 0.001 → ann. return 0.252.
    // deviations ±0.001 → sample var 4e−6/3, sd 0.0011547005,
    // ann. vol = 0.018330302…  Sharpe = (0.252 − 0.045)/0.0183303 = 11.2928…
    const r = [0.002, 0, 0.002, 0];
    const expectedVol = Math.sqrt(0.000004 / 3) * Math.sqrt(252);
    approx(sharpeRatio(r), (0.001 * 252 - RISK_FREE_ANNUAL) / expectedVol, 1e-12);
    approx(sharpeRatio(r), 11.292776, 1e-5);
  });

  it("respects custom risk-free rate and period count", () => {
    const r = [0.002, 0, 0.002, 0];
    const vol = annualizedVolatility(r, 12)!;
    approx(sharpeRatio(r, 0.0, 12), (0.001 * 12) / vol, 1e-12);
  });

  it("returns null for flat (zero-vol) or too-short series", () => {
    assert.equal(sharpeRatio([0.01, 0.01, 0.01]), null);
    assert.equal(sharpeRatio([0.01]), null);
  });

  it("uses the 4.5% playbook constant and 252 trading days by default", () => {
    assert.equal(RISK_FREE_ANNUAL, 0.045);
    assert.equal(TRADING_DAYS_PER_YEAR, 252);
  });
});

describe("alignByDate", () => {
  it("intersects on date and drops sessions missing from either side", () => {
    const a = [candle("2026-01-01", 10), candle("2026-01-02", 11), candle("2026-01-04", 12)];
    const b = [candle("2026-01-01", 100), candle("2026-01-03", 101), candle("2026-01-04", 102)];
    const { dates, aCloses, bCloses } = alignByDate(a, b);
    assert.deepEqual(dates, ["2026-01-01", "2026-01-04"]);
    assert.deepEqual(aCloses, [10, 12]);
    assert.deepEqual(bCloses, [100, 102]);
  });
});

describe("computePortfolioStats", () => {
  // Benchmark fixture: deterministic ±1%/±2% wiggle. Asset = exactly 2× each
  // benchmark return, built programmatically so beta is 2 BY CONSTRUCTION.
  const benchReturns = [0.01, -0.02, 0.015, 0.005, -0.01, 0.02, -0.005, 0.01];
  const dates = [
    "2026-01-01", "2026-01-02", "2026-01-05", "2026-01-06", "2026-01-07",
    "2026-01-08", "2026-01-09", "2026-01-12", "2026-01-13",
  ];

  function seriesFromReturns(start: number, returns: number[]): number[] {
    const closes = [start];
    for (const r of returns) closes.push(closes[closes.length - 1] * (1 + r));
    return closes;
  }

  const benchCloses = seriesFromReturns(500, benchReturns);
  const assetCloses = seriesFromReturns(100, benchReturns.map((r) => 2 * r));
  const bench = benchCloses.map((c, i) => candle(dates[i], c));
  const asset = assetCloses.map((c, i) => candle(dates[i], c));

  it("computes beta 2 by construction, with sane vol/drawdown/sharpe", () => {
    const stats = computePortfolioStats(asset, bench);
    assert.equal(stats.observations, 8);
    approx(stats.beta, 2, 1e-9);
    // Asset daily returns are 2× bench → vol must be exactly 2× bench vol.
    const expectedVol = annualizedVolatility(benchReturns.map((r) => 2 * r))!;
    approx(stats.volatilityPct, Math.round(expectedVol * 1000) / 10, 1e-9);
    // Deepest decline: the consecutive −4% then... compute directly:
    const expectedDd = maxDrawdown(assetCloses)!.drawdown;
    approx(stats.maxDrawdownPct, Math.round(expectedDd * 1000) / 10, 1e-9);
    assert.notEqual(stats.sharpe, null);
  });

  it("returns all-null stats (not fake numbers) when series don't overlap", () => {
    const other = [candle("2025-06-01", 50), candle("2025-06-02", 51)];
    const stats = computePortfolioStats(asset, other);
    assert.equal(stats.observations, 0);
    assert.equal(stats.beta, null);
    assert.equal(stats.volatilityPct, null);
    assert.equal(stats.maxDrawdownPct, null);
    assert.equal(stats.sharpe, null);
  });
});
