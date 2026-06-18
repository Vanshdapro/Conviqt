// Locks the Alpha Tracker headline metric. The founder's chosen definition is a
// CUMULATIVE return: each pick's % result is summed into one running total
// ("add it to the total and aggregate it; the return is not per stock"). A past
// bug labeled this field `avgReturn` while never averaging — this guard makes
// sure it stays a SUM (not a mean) and that wins/losses both count honestly.

import { test } from "node:test";
import assert from "node:assert/strict";

import { pickStats, type PickView } from "../picksView";
import type { AlphaPick } from "../alphaTypes";

// Minimal PickView factory — only the fields pickStats reads matter.
function view(returnPct: number | null, open: boolean): PickView {
  return {
    pick: {} as AlphaPick,
    open,
    returnPct,
    price: null,
    priceAsOfNote: null,
  };
}

test("totalReturn is the CUMULATIVE sum of every pick's % (never an average)", () => {
  const views = [
    view(30, false), // realized winner
    view(-8, false), // realized loser (stopped out)
    view(12, true), // open winner
    view(-8, true), // open loser
    view(4, true), // open winner
  ];
  const stats = pickStats(views);
  assert.ok(stats, "stats should be computed");
  // 30 - 8 + 12 - 8 + 4 = 30  (sum). The average would be 6.0 — must NOT be that.
  assert.equal(stats!.totalReturn, 30);
  assert.notEqual(stats!.totalReturn, 6);
  assert.equal(stats!.winRate, 60); // 3 of 5 >= ... strictly > 0
  assert.equal(stats!.total, 5);
  assert.equal(stats!.open, 3);
});

test("picks with no resolvable return are excluded from win rate, counted in total", () => {
  const views = [view(20, true), view(null, true)];
  const stats = pickStats(views);
  assert.ok(stats);
  assert.equal(stats!.totalReturn, 20);
  assert.equal(stats!.winRate, 100); // only the scored pick counts toward the rate
  assert.equal(stats!.total, 2); // but both count as picks
  assert.equal(stats!.open, 2);
});

test("returns null when nothing has a resolvable return yet", () => {
  assert.equal(pickStats([view(null, true)]), null);
});
