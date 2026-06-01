"use client";

// Conviqt Learn — end-of-lesson quiz. Answer to lock in XP. Reports the score
// up so the lesson can record completion. Immediate feedback + explanations.

import { useState } from "react";
import type { QuizQuestion } from "@/lib/learn/types";

const ACCENT = "#4f87f7";
const BULL = "#22c55e";
const BEAR = "#ef4444";
const HOLD = "#f59e0b";
const INK = "#e8edf8";
const MUTED = "#8aa0c2";
const SURFACE = "#071120";
const BORDER = "rgba(232,237,248,0.09)";
const MONO = "var(--font-mono), 'JetBrains Mono', monospace";
const SANS = "var(--font-sans), system-ui, sans-serif";
const SERIF = "var(--font-serif), Georgia, serif";

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
                  bg = "rgba(34,197,94,0.1)";
                  border = "1px solid rgba(34,197,94,0.5)";
                  color = BULL;
                } else if (isPicked) {
                  bg = "rgba(239,68,68,0.09)";
                  border = "1px solid rgba(239,68,68,0.45)";
                  color = BEAR;
                }
              } else if (isPicked) {
                bg = "rgba(79,135,247,0.12)";
                border = "1px solid rgba(79,135,247,0.5)";
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
            background: answeredAll ? ACCENT : "rgba(232,237,248,0.06)",
            color: answeredAll ? "#04101f" : MUTED,
            border: answeredAll ? "1px solid rgba(120,170,255,0.6)" : "1px solid rgba(232,237,248,0.1)",
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
