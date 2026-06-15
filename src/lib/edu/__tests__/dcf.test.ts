import { test } from "node:test";
import assert from "node:assert/strict";
import { getFundamentals } from "../data/fundamentals";
import { getAsset } from "../data/prices";
import {
  computeDcf,
  defaultAssumptions,
  fairValuePath,
  classifyWedge,
} from "../dcf";

const aaplF = getFundamentals("AAPL")!;
const aaplP = getAsset("AAPL")!;

test("DCF is valid and positive for a firm with FCF", () => {
  const r = computeDcf(aaplF, defaultAssumptions(aaplF));
  assert.equal(r.valid, true);
  assert.ok(r.intrinsicPerShare > 0);
  assert.ok(r.baseFcfPerShare > 0);
});

test("DCF reproducibility: identical assumptions → identical value", () => {
  const a = defaultAssumptions(aaplF);
  assert.equal(computeDcf(aaplF, a).intrinsicPerShare, computeDcf(aaplF, a).intrinsicPerShare);
});

test("banks/financials (no FCF) are excluded, not faked", () => {
  const jpm = getFundamentals("JPM")!;
  const r = computeDcf(jpm, defaultAssumptions(jpm));
  assert.equal(r.valid, false);
  assert.match(r.reason ?? "", /does not apply|financ|bank|free cash flow/i);
});

test("higher discount rate lowers intrinsic value (monotonic)", () => {
  const a = defaultAssumptions(aaplF);
  const lo = computeDcf(aaplF, { ...a, discountRate: 0.08 }).intrinsicPerShare;
  const hi = computeDcf(aaplF, { ...a, discountRate: 0.12 }).intrinsicPerShare;
  assert.ok(hi < lo, "12% discount should value below 8%");
});

test("higher growth raises intrinsic value (monotonic)", () => {
  const a = defaultAssumptions(aaplF);
  const lo = computeDcf(aaplF, { ...a, nearGrowth: 0.03 }).intrinsicPerShare;
  const hi = computeDcf(aaplF, { ...a, nearGrowth: 0.1 }).intrinsicPerShare;
  assert.ok(hi > lo, "10% growth should value above 3%");
});

test("invalid when discount rate ≤ terminal growth", () => {
  const a = defaultAssumptions(aaplF);
  const r = computeDcf(aaplF, { ...a, discountRate: 0.02, terminalGrowth: 0.03 });
  assert.equal(r.valid, false);
});

test("fair-value path is aligned, ends at intrinsic, and trends up", () => {
  const a = defaultAssumptions(aaplF);
  const r = computeDcf(aaplF, a);
  const path = fairValuePath(r.intrinsicPerShare, aaplP.points, a.terminalGrowth);
  assert.equal(path.length, aaplP.points.length);
  assert.ok(Math.abs(path[path.length - 1].close - r.intrinsicPerShare) <= 0.02);
  assert.ok(path[0].close < path[path.length - 1].close, "anchor grows over time");
});

test("classifyWedge: price above fair → positive premium, deterministic", () => {
  const fair = aaplP.points.map((p) => ({ date: p.date, close: p.close / 2 }));
  const w1 = classifyWedge("AAPL", "Apple Inc.", aaplP.points, fair);
  const w2 = classifyWedge("AAPL", "Apple Inc.", aaplP.points, fair);
  assert.ok(w1.latestPct > 0);
  assert.equal(w1.label, w2.label);
  assert.equal(w1.bullets.length, 3);
});
