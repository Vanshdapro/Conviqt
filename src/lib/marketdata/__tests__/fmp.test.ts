// Fixture tests for the FMP response mappers (providers/fmp.ts).
//
// The adapter is dormant until FMP_API_KEY exists, so these tests are what
// guarantees "paste the key and it works": recorded response shapes for BOTH
// the legacy /api/v3 API and the new /stable API are mapped and asserted
// here without any network. Run with `npm test`.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  mapFmpQuote,
  mapFmpHistory,
  mapFmpKeyStats,
} from "../providers/fmp";

// Recorded shape: /api/v3/quote/NVDA (legacy — has `pe`, `changesPercentage`)
const V3_QUOTE = [
  {
    symbol: "NVDA",
    name: "NVIDIA Corporation",
    price: 200.42,
    changesPercentage: -6.6729,
    change: -14.33,
    dayLow: 196.21,
    dayHigh: 209.18,
    yearHigh: 236.54,
    yearLow: 140.85,
    marketCap: 4894000000000,
    priceAvg50: 188.31,
    priceAvg200: 171.22,
    exchange: "NASDAQ",
    volume: 150398224,
    avgVolume: 162845120,
    open: 207.5,
    previousClose: 214.75,
    eps: 3.51,
    pe: 57.1,
    sharesOutstanding: 24420000000,
    timestamp: 1781121600,
  },
];

// Recorded shape: /stable/quote?symbol=NVDA (new accounts — `changePercentage`, NO `pe`)
const STABLE_QUOTE = [
  {
    symbol: "NVDA",
    name: "NVIDIA Corporation",
    price: 200.42,
    changePercentage: -6.6729,
    change: -14.33,
    volume: 150398224,
    dayLow: 196.21,
    dayHigh: 209.18,
    yearHigh: 236.54,
    yearLow: 140.85,
    marketCap: 4894000000000,
    priceAvg50: 188.31,
    priceAvg200: 171.22,
    exchange: "NASDAQ",
    open: 207.5,
    previousClose: 214.75,
    timestamp: 1781121600,
  },
];

// Recorded shape: /stable/historical-price-eod/full (flat, DESCENDING)
const STABLE_HISTORY = [
  { symbol: "NVDA", date: "2026-06-10", open: 207.5, high: 209.18, low: 196.21, close: 200.42, volume: 150398224 },
  { symbol: "NVDA", date: "2026-06-09", open: 213.1, high: 215.0, low: 211.9, close: 214.75, volume: 98123456 },
  { symbol: "NVDA", date: "2026-06-08", open: 210.0, high: 214.2, low: 209.5, close: 213.4, volume: 87654321 },
];

// Recorded shape: /api/v3/historical-price-full (wrapped in { historical })
const V3_HISTORY = {
  symbol: "NVDA",
  historical: STABLE_HISTORY,
};

describe("mapFmpQuote", () => {
  it("maps the legacy v3 shape (changesPercentage)", () => {
    const q = mapFmpQuote(V3_QUOTE, "nvda");
    assert.equal(q.ticker, "NVDA");
    assert.equal(q.price, 200.42);
    assert.equal(q.prevClose, 214.75);
    assert.equal(q.changePct, -6.67);
    assert.equal(q.provider, "fmp");
    assert.equal(q.freshnessLabel, "delayed ~15 min");
    assert.equal(q.asOf, new Date(1781121600 * 1000).toISOString());
  });

  it("maps the stable shape (changePercentage)", () => {
    const q = mapFmpQuote(STABLE_QUOTE, "NVDA");
    assert.equal(q.changePct, -6.67);
    assert.equal(q.price, 200.42);
  });

  it("derives changePct from previousClose when no reported field", () => {
    const q = mapFmpQuote([{ price: 110, previousClose: 100 }], "TEST");
    assert.equal(q.changePct, 10);
  });

  it("throws on empty array / missing price (never fabricates)", () => {
    assert.throws(() => mapFmpQuote([], "NVDA"));
    assert.throws(() => mapFmpQuote([{ symbol: "NVDA" }], "NVDA"));
    assert.throws(() => mapFmpQuote({ not: "an array" }, "NVDA"));
  });
});

describe("mapFmpHistory", () => {
  it("maps the stable flat array and sorts ascending", () => {
    const candles = mapFmpHistory(STABLE_HISTORY, "NVDA");
    assert.equal(candles.length, 3);
    assert.equal(candles[0].date, "2026-06-08");
    assert.equal(candles[2].date, "2026-06-10");
    assert.equal(candles[2].close, 200.42);
    assert.equal(candles[2].volume, 150398224);
  });

  it("maps the v3 wrapped shape identically", () => {
    const flat = mapFmpHistory(STABLE_HISTORY, "NVDA");
    const wrapped = mapFmpHistory(V3_HISTORY, "NVDA");
    assert.deepEqual(wrapped, flat);
  });

  it("skips malformed rows and throws when nothing survives", () => {
    const candles = mapFmpHistory(
      [...STABLE_HISTORY, { date: "2026-06-11", open: null, high: 1, low: 1, close: 1 }],
      "NVDA"
    );
    assert.equal(candles.length, 3); // bad row dropped
    assert.throws(() => mapFmpHistory([], "NVDA"));
    assert.throws(() => mapFmpHistory({ historical: "garbage" }, "NVDA"));
  });
});

describe("mapFmpKeyStats", () => {
  it("takes pe from the v3 quote directly", () => {
    const s = mapFmpKeyStats(V3_QUOTE, "NVDA", null);
    assert.equal(s.marketCap, 4894000000000);
    assert.equal(s.peRatio, 57.1);
    assert.equal(s.week52High, 236.54);
    assert.equal(s.week52Low, 140.85);
    assert.equal(s.volume, 150398224);
    assert.equal(s.partial, false);
  });

  it("falls back to ratios-ttm pe for the stable quote shape", () => {
    const s = mapFmpKeyStats(STABLE_QUOTE, "NVDA", 57.1);
    assert.equal(s.peRatio, 57.1);
    assert.equal(s.partial, false);
  });

  it("reports honest partial stats when pe is unavailable everywhere", () => {
    const s = mapFmpKeyStats(STABLE_QUOTE, "NVDA", null);
    assert.equal(s.peRatio, null);
    assert.equal(s.partial, true);
    assert.equal(s.marketCap, 4894000000000); // what we have, we keep
  });
});
