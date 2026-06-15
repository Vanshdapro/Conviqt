import { test } from "node:test";
import assert from "node:assert/strict";
import { formatCitation, humanDate, type CitationMeta } from "../citation";
import { toCsv } from "../csv";

const meta: CitationMeta = {
  authors: "Conviqt for Academia",
  year: 2026,
  title: "Macro-factor sensitivity model: AAPL",
  url: "https://edu.conviqt.com/sandbox",
  dataSources: ["SEC EDGAR (10-K)", "Yahoo Finance snapshot 2026-06-15"],
  accessed: "15 June 2026",
};

test("APA places year in parentheses and tags the data set", () => {
  const c = formatCitation("apa", meta);
  assert.match(c, /\(2026\)/);
  assert.match(c, /\[Data set\]/);
  assert.match(c, /https:\/\/edu\.conviqt\.com\/sandbox/);
});

test("Harvard includes Available at + Accessed", () => {
  const c = formatCitation("harvard", meta);
  assert.match(c, /Available at:/);
  assert.match(c, /\(Accessed: 15 June 2026\)/);
});

test("Chicago quotes the title and gives an access date", () => {
  const c = formatCitation("chicago", meta);
  assert.match(c, /"Macro-factor sensitivity model: AAPL\."/);
  assert.match(c, /Accessed 15 June 2026/);
});

test("every style discloses the data provenance", () => {
  for (const style of ["apa", "harvard", "chicago"] as const) {
    const c = formatCitation(style, meta);
    assert.match(c, /SEC EDGAR/);
    assert.match(c, /Yahoo Finance snapshot 2026-06-15/);
  }
});

test("humanDate is deterministic and UTC", () => {
  assert.equal(humanDate(new Date("2026-06-15T00:00:00Z")), "15 June 2026");
});

test("CSV quotes fields with commas, quotes, and newlines", () => {
  const csv = toCsv(
    ["date", "note", "close"],
    [
      ["2026-01", "plain", 100],
      ["2026-02", "has, comma", 101],
      ["2026-03", 'has "quote"', 102],
      ["2026-04", "has\nnewline", null],
    ]
  );
  const lines = csv.split("\r\n");
  assert.equal(lines[0], "date,note,close");
  assert.equal(lines[1], "2026-01,plain,100");
  assert.equal(lines[2], '2026-02,"has, comma",101');
  assert.equal(lines[3], '2026-03,"has ""quote""",102');
  assert.match(csv, /"has\nnewline"/);
});

test("CSV renders null/undefined as empty cells", () => {
  const csv = toCsv(["a", "b"], [[null, undefined]]);
  assert.equal(csv.split("\r\n")[1], ",");
});
