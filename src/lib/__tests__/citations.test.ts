// Regression guard for the citation-tag leak (the "<cite index=…>" markup that
// showed up verbatim in a Headline Decoder result). stripCitationTags must drop
// the wrapper, keep the cited text, and never touch ordinary prose or math.

import { test } from "node:test";
import assert from "node:assert/strict";

import { stripCitationTags, deepStripCitations } from "../citations";

test("strips Claude web_search <cite …> wrappers, keeps the cited text", () => {
  const dirty =
    '<cite index="4-3,17-5">Iran reached a deal with the US</cite>. ' +
    '<cite index="11-1,11-2">The Strait of Hormuz reopens on signing</cite>.';
  const clean = stripCitationTags(dirty);
  assert.equal(
    clean,
    "Iran reached a deal with the US. The Strait of Hormuz reopens on signing."
  );
  assert.ok(!/<\/?cite/i.test(clean), "no <cite> markup may remain");
});

test("handles a bare closing tag and inline cites", () => {
  assert.equal(stripCitationTags('Up <cite index="1">3%</cite> today.'), "Up 3% today.");
  assert.equal(stripCitationTags("orphaned</cite> tail"), "orphaned tail");
});

test("leaves ordinary prose untouched", () => {
  const plain = "A clean, plain-English verdict — no tags here.";
  assert.equal(stripCitationTags(plain), plain);
  assert.equal(stripCitationTags(""), "");
});

test("does not eat legitimate < / > used as math operators", () => {
  assert.equal(stripCitationTags("P/E < 15 and EPS > 5."), "P/E < 15 and EPS > 5.");
});

test("deepStripCitations scrubs nested string values, preserves shape & non-strings", () => {
  const payload = {
    summary: '<cite index="2-1">Margins expanded</cite>.',
    conviction: 72,
    impacts: [{ why: 'Cheaper oil <cite index="9">hurts CL</cite>.', ticker: "CL" }],
    sources: ["https://example.com/a?b=1<notacite"], // a stray "<" that isn't a cite tag
  };
  const out = deepStripCitations(payload);
  assert.equal(out.summary, "Margins expanded.");
  assert.equal(out.conviction, 72);
  assert.equal(out.impacts[0].why, "Cheaper oil hurts CL.");
  assert.equal(out.impacts[0].ticker, "CL");
  // non-cite "<" survives untouched
  assert.equal(out.sources[0], "https://example.com/a?b=1<notacite");
});
