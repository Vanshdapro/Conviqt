"use client";

// Conviqt Learn — end-of-lesson quiz. Answer to lock in XP. Reports the score
// up so the lesson can record completion. Immediate feedback + explanations.

import { useState } from "react";
import type { QuizQuestion } from "@/lib/learn/types";

const ACCENT = "var(--accent)";
const BULL = "var(--accent)";
const BEAR = "var(--down-ink)";
const HOLD = "var(--text-2)";
const INK = "var(--text)";
const MUTED = "var(--text-2)";
const SURFACE = "var(--bg-surface)";
const BORDER = "var(--border)";
const MONO = "var(--font-ui)";
const SANS = "var(--font-ui)";
const SERIF = "var(--font-ui)";

export function Quiz({
  questions,
  onComplete,
}: {
  questions: QuizQuestion[];
  onComplete: (pct: number) => void;
}) {
  const [picked, setPicked] = useState<(number | null)[]>(() => questions.map(() => null));
  const [submitted, setSubmitted] = useState(false);

  if (questions.length === 0) {
    return null;
  }

  const answeredAll = picked.every((p) => p !== null);
  const correct = picked.filter((p, i) => p === questions[i].answerIndex).length;
  const pct = Math.round((correct / questions.length) * 100);

  function choose(qi: number, oi: number) {
    if (submitted) return;
    setPicked((prev) => prev.map((v, i) => (i === qi ? oi : v)));
  }

  function submit() {
    if (!answeredAll) return;
    setSubmitted(true);
    onComplete(pct);
  }

  return (
    <section style={{ margin: "32px 0", fontFamily: SANS }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, marginBottom: 16 }}>
        <span style={{ fontFamily: SERIF, fontSize: 19, fontWeight: 600, color: INK }}>
          Quick check
        </span>
        {submitted && (
          <span style={{ fontFamily: MONO, fontSize: 13, color: pct >= 50 ? BULL : HOLD }}>
            {correct}/{questions.length} correct
          </span>
        )}
      </div>

      {questions.map((q, qi) => (
        <div key={qi} style={{ marginBottom: 22 }}>
          <p style={{ margin: "0 0 12px", fontFamily: SERIF, fontSize: 16, color: INK, fontWeight: 600, lineHeight: 1.5 }}>
            {qi + 1}. {q.question}
          </p>
          <div style={{ display: "grid", gap: 8 }}>
            {q.options.map((opt, oi) => {
              const isPicked = picked[qi] === oi;
              const isAnswer = q.answerIndex === oi;
              let bg = SURFACE;
              let border = `1px solid ${BORDER}`;
              let color = INK;
              if (submitted) {
                if (isAnswer) {
                  bg = "var(--accent-weak)";
                  border = "1px solid var(--accent)";
                  color = BULL;
                } else if (isPicked) {
                  bg = "var(--down-weak)";
                  border = "1px solid var(--down)";
                  color = BEAR;
                }
              } else if (isPicked) {
                bg = "var(--accent-weak)";
                border = "1px solid var(--accent)";
              }
              return (
                <button
                  key={oi}
                  onClick={() => choose(qi, oi)}
                  disabled={submitted}
                  style={{
                    textAlign: "left",
                    background: bg,
                    border,
                    color,
                    borderRadius: 8,
                    padding: "11px 14px",
                    fontSize: 14,
                    cursor: submitted ? "default" : "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  {opt}
                </button>
              );
            })}
          </div>
          {submitted && (
            <p style={{ margin: "10px 2px 0", fontSize: 13, color: MUTED, lineHeight: 1.55 }}>
              {q.explanation}
            </p>
          )}
        </div>
      ))}

      {!submitted && (
        <button
          onClick={submit}
          disabled={!answeredAll}
          style={{
            marginTop: 6,
            background: answeredAll ? ACCENT : "var(--bg-sunken)",
            color: answeredAll ? "var(--on-accent)" : MUTED,
            border: answeredAll ? "1px solid var(--accent)" : "1px solid var(--bg-sunken)",
            borderRadius: 8,
            padding: "12px 28px",
            fontFamily: SANS,
            fontSize: 13.5,
            fontWeight: 650,
            letterSpacing: 0,
            cursor: answeredAll ? "pointer" : "not-allowed",
            boxShadow: "none",
          }}
        >
          {answeredAll ? "Submit answers" : "Answer all questions"}
        </button>
      )}
    </section>
  );
}
