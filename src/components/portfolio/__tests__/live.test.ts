// Fixture tests for the live Portfolio view's value-series construction —
// the pure core of the stats strip. The free feeds were down the day this
// shipped (Stooq IP-blocked, Yahoo cooling down), so this is the proof that
// the share-weighted series math is right when data DOES flow.

import { test } from "node:test";
import assert from "node:assert/strict";

import { portfolioValueSeries } from "../../../lib/portfolio/live";
import type { PriceHistory } from "../../../lib/marketdata/types";

function hist(ticker: string, closes: Array<[string, number]>): PriceHistory {
  return {
    ticker,
    range: "1y",
    interval: "1d",
    candles: closes.map(([date, close]) => ({
      date,
      open: close,
      high: close,
      low: close,
      close,
      volume: null,
    })),
    asOf: "2026-06-12T00:00:00Z",
    freshnessLabel: "end-of-day data",
    provider: "stooq",
    sourceUrl: "https://example.com",
  };
}

test("sums shares × close per shared session", () => {
  const holdings = [
    { ticker: "AAA", shares: 10 },
    { ticker: "BBB", shares: 2 },
  ];
  const histories = [
    hist("AAA", [["2026-06-01", 100], ["2026-06-02", 110], ["2026-06-03", 105]]),
    hist("BBB", [["2026-06-01", 50], ["2026-06-02", 40], ["2026-06-03", 45]]),
  ];
  const { candles, used } = portfolioValueSeries(holdings, histories);
  assert.equal(used, 2);
  assert.deepEqual(
    candles.map((c) => [c.date, c.close]),
    [
      ["2026-06-01", 10 * 100 + 2 * 50], // 1100
      ["2026-06-02", 10 * 110 + 2 * 40], // 1180
      ["2026-06-03", 10 * 105 + 2 * 45], // 1140
    ]
  );
});

test("only sessions covered by EVERY usable holding count", () => {
  const holdings = [
    { ticker: "AAA", shares: 1 },
    { ticker: "BBB", shares: 1 },
  ];
  const histories = [
    hist("AAA", [["2026-06-01", 100], ["2026-06-02", 101], ["2026-06-03", 102]]),
    hist("BBB", [["2026-06-02", 50], ["2026-06-03", 51]]), // missing 06-01
  ];
  const { candles } = portfolioValueSeries(holdings, histories);
  assert.deepEqual(candles.map((c) => c.date), ["2026-06-02", "2026-06-03"]);
});

test("holdings with no history are excluded and reported via `used`", () => {
  const holdings = [
    { ticker: "AAA", shares: 5 },
    { ticker: "ZZZ", shares: 99 }, // feeds couldn't answer
  ];
  const histories = [
    hist("AAA", [["2026-06-01", 10], ["2026-06-02", 11]]),
    null,
  ];
  const { candles, used } = portfolioValueSeries(holdings, histories);
  assert.equal(used, 1);
  // ZZZ's 99 shares must NOT silently zero into the series.
  assert.deepEqual(candles.map((c) => c.close), [50, 55]);
});

test("no usable history at all → empty series, never invented data", () => {
  const { candles, used } = portfolioValueSeries(
    [{ ticker: "AAA", shares: 1 }],
    [null]
  );
  assert.equal(used, 0);
  assert.equal(candles.length, 0);
});
