// Drift guard for the Portfolio stats strip's teaching layer. statInfo.ts
// hard-codes Academy lesson ids (it must not import the curriculum — client
// bundle weight), so this server-side test keeps the mapping honest, exactly
// like learnLinks.test.ts does for the answer chips.

import { test } from "node:test";
import assert from "node:assert/strict";

import { STAT_INFO, STAT_KEYS, STAT_LESSON_IDS } from "../statInfo";
import { findLesson } from "../../../lib/learn/curriculum";

test("every stat points at a real Academy lesson id", () => {
  for (const key of STAT_KEYS) {
    const lessonId = STAT_LESSON_IDS[key];
    assert.ok(
      findLesson(lessonId),
      `stat "${key}" points at unknown lesson id "${lessonId}"`
    );
  }
});

test("every stat has explainer copy and a working interpreter", () => {
  const samples: Record<string, number[]> = {
    beta: [-0.3, 0.5, 1.0, 1.8],
    volatility: [8, 15, 28, 50],
    maxDrawdown: [5, 15, 28, 60],
    sharpe: [-0.5, 0.2, 0.8, 1.6],
  };
  for (const key of STAT_KEYS) {
    const info = STAT_INFO[key];
    assert.ok(info.what.length > 50, `${key}: "what" copy is too thin`);
    assert.ok(info.how.length > 50, `${key}: "how" copy is too thin`);
    for (const v of samples[key]) {
      const read = info.interpret(v);
      assert.ok(read.length > 30, `${key}: interpret(${v}) returned thin copy`);
      assert.ok(info.format(v).length > 0, `${key}: format(${v}) empty`);
    }
  }
});

test("copy rules: no banned machinery words in any rendered stat copy", () => {
  const banned = /\bagents?\b|council|credits?\b|\bCDI\b|disagreement|pipeline|web_search|tokens?\b|prompts?\b/i;
  for (const key of STAT_KEYS) {
    const info = STAT_INFO[key];
    const corpus = [
      info.what,
      info.how,
      ...[0.5, 1.3, 15, 30].map((v) => info.interpret(v)),
    ].join(" ");
    assert.ok(
      !banned.test(corpus),
      `${key}: banned word leaked into rendered copy`
    );
  }
});
