import { test } from "node:test";
import assert from "node:assert/strict";
import { DEMO_ASSETS, getAsset } from "../data/prices";
import {
  fitFactorModel,
  counterfactualPath,
  effectBullets,
  type FactorModel,
} from "../factorModel";
import { MACRO_BASELINE } from "../data/macro";

const aapl = getAsset("AAPL")!;

test("every demo asset fits without NaN and with sane R²", () => {
  for (const a of DEMO_ASSETS) {
    const m = fitFactorModel(a);
    assert.ok(Number.isFinite(m.alpha), `${a.ticker} alpha finite`);
    for (const k of ["rate", "inflation", "tax"] as const) {
      assert.ok(Number.isFinite(m.betas[k]), `${a.ticker} beta.${k} finite`);
    }
    assert.ok(m.rSquared >= 0 && m.rSquared <= 1, `${a.ticker} R² in [0,1]`);
    assert.ok(m.nObs > 4, `${a.ticker} enough observations`);
  }
});

test("reproducibility: identical inputs → identical model", () => {
  const a = fitFactorModel(aapl);
  const b = fitFactorModel(aapl);
  assert.deepEqual(a, b);
});

test("zero-beta reprice reproduces the actual path exactly", () => {
  const flat: FactorModel = {
    ticker: aapl.ticker,
    alpha: 0,
    betas: { rate: 0, inflation: 0, tax: 0 },
    rSquared: 0,
    nObs: aapl.points.length - 1,
    meanMonthlyReturn: 0,
  };
  const path = counterfactualPath(aapl, flat, { ...MACRO_BASELINE, rate: 99 });
  assert.equal(path.length, aapl.points.length);
  for (let i = 0; i < path.length; i++) {
    // Rounding to cents can differ by 1 cent from recompounding; allow it.
    assert.ok(
      Math.abs(path[i].close - aapl.points[i].close) <= 0.02,
      `point ${i}: ${path[i].close} ≈ ${aapl.points[i].close}`
    );
  }
});

test("counterfactual direction follows the sign of the beta", () => {
  const model = fitFactorModel(aapl);
  // Build a model with a known positive inflation beta to assert direction
  // deterministically regardless of the fitted sign.
  const posInf: FactorModel = { ...model, betas: { rate: 0, inflation: 0.01, tax: 0 } };
  const hi = counterfactualPath(aapl, posInf, { ...MACRO_BASELINE, inflation: 12 });
  const lo = counterfactualPath(aapl, posInf, { ...MACRO_BASELINE, inflation: 0 });
  assert.ok(
    hi[hi.length - 1].close > lo[lo.length - 1].close,
    "higher inflation with positive beta → higher final value"
  );
});

test("effectBullets: baseline scenario yields no modelled effect", () => {
  const model = fitFactorModel(aapl);
  const bullets = effectBullets(model, { ...MACRO_BASELINE });
  for (const b of bullets) {
    assert.ok(Math.abs(b.annualizedPct) < 1e-6, `${b.factor} ~0 at baseline`);
    assert.match(b.text, /No change/);
  }
});
