// Drift guard for the "Learn why →" concept map. learnLinks.ts hard-codes
// lesson ids (it must not import the curriculum — client bundle weight), so
// this server-side test is what keeps the map honest when lessons change.
// Lesson ids are permanent keys per src/lib/learn/curriculum.ts, so a failure
// here means a typo in learnLinks.ts, not a renamed lesson.

import { test } from "node:test";
import assert from "node:assert/strict";

import { CONCEPT_RULES, learnLinksFor } from "../learnLinks";
import { findLesson } from "../../../lib/learn/curriculum";

test("every concept rule points at a real lesson id", () => {
  for (const rule of CONCEPT_RULES) {
    assert.ok(
      findLesson(rule.lessonId),
      `learnLinks rule "${rule.title}" points at unknown lesson id "${rule.lessonId}"`
    );
  }
});

test("rule titles match the real lesson titles", () => {
  for (const rule of CONCEPT_RULES) {
    const found = findLesson(rule.lessonId);
    assert.equal(
      rule.title,
      found?.lesson.title,
      `learnLinks chip for "${rule.lessonId}" promises "${rule.title}" but the lesson is titled "${found?.lesson.title}"`
    );
  }
});

test("matcher dedupes and caps results", () => {
  const corpus =
    "The forward P/E multiple looks stretched; margins are compressing, debt and leverage are rising, free cash flow is solid, the Fed may cut interest rates, and inflation is cooling.";
  const links = learnLinksFor(corpus, 4);
  assert.ok(links.length <= 4, "respects the max cap");
  assert.equal(new Set(links.map((l) => l.lessonId)).size, links.length, "no duplicate lessons");
});

test("no match on unrelated prose", () => {
  assert.deepEqual(learnLinksFor("The weather is nice today."), []);
});
