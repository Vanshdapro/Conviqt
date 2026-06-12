// Unit tests for the holdings CSV parser — fixture-driven, no network.

import { test } from "node:test";
import assert from "node:assert/strict";

import { parseHoldingsCsv } from "../csv";

test("headered CSV with ticker/shares/cost columns", () => {
  const r = parseHoldingsCsv(
    "Symbol,Quantity,Avg Cost\nAAPL,10,150.25\nMSFT,5,310\n"
  );
  assert.equal(r.error, null);
  assert.equal(r.skipped, 0);
  assert.deepEqual(r.holdings, [
    { ticker: "AAPL", shares: 10, costBasis: 150.25 },
    { ticker: "MSFT", shares: 5, costBasis: 310 },
  ]);
});

test("headerless CSV assumes ticker, shares, cost order", () => {
  const r = parseHoldingsCsv("NVDA,2,450\nVOO,1\n");
  assert.equal(r.error, null);
  assert.deepEqual(r.holdings, [
    { ticker: "NVDA", shares: 2, costBasis: 450 },
    { ticker: "VOO", shares: 1 },
  ]);
});

test("dollar signs, thousands separators, and quoted fields parse", () => {
  const r = parseHoldingsCsv(
    'Ticker,Name,Shares,Cost Basis\nAAPL,"Apple, Inc.","1,000","$150.50"\n'
  );
  assert.equal(r.error, null);
  assert.deepEqual(r.holdings, [{ ticker: "AAPL", shares: 1000, costBasis: 150.5 }]);
});

test("tab and semicolon delimiters are detected", () => {
  assert.deepEqual(parseHoldingsCsv("AAPL\t3\t100\n").holdings, [
    { ticker: "AAPL", shares: 3, costBasis: 100 },
  ]);
  assert.deepEqual(parseHoldingsCsv("AAPL;3;100\n").holdings, [
    { ticker: "AAPL", shares: 3, costBasis: 100 },
  ]);
});

test("bad rows are skipped and counted, duplicates deduped", () => {
  const r = parseHoldingsCsv(
    "ticker,shares\nAAPL,10\nNOTATICKERTOOLONG,5\nMSFT,-2\nAAPL,99\nGOOG,1\n"
  );
  assert.equal(r.error, null);
  assert.equal(r.skipped, 3); // too-long ticker, negative shares, duplicate
  assert.deepEqual(
    r.holdings.map((h) => h.ticker),
    ["AAPL", "GOOG"]
  );
  assert.equal(r.holdings[0].shares, 10); // first AAPL row wins
});

test("missing shares column in a headered file is a fatal error", () => {
  const r = parseHoldingsCsv("Symbol,Price\nAAPL,150\n");
  assert.notEqual(r.error, null);
  assert.equal(r.holdings.length, 0);
});

test("empty and unparseable files report honest errors", () => {
  assert.notEqual(parseHoldingsCsv("").error, null);
  assert.notEqual(parseHoldingsCsv("just some words\n").error, null);
});

test("hard cap at 40 holdings", () => {
  const lines = Array.from({ length: 60 }, (_, i) => `T${i},1`).join("\n");
  const r = parseHoldingsCsv(lines);
  assert.equal(r.error, null);
  assert.equal(r.holdings.length, 40);
});

test("zero-cost and blank cost basis are treated as unknown, not zero", () => {
  const r = parseHoldingsCsv("ticker,shares,cost\nAAPL,10,0\nMSFT,5,\n");
  assert.equal(r.holdings[0].costBasis, undefined);
  assert.equal(r.holdings[1].costBasis, undefined);
});
