"use client";

// Conviqt Learn — end-of-lesson quiz. Answer to lock in XP. Reports the score
// up so the lesson can record completion. Immediate feedback + explanations.

import { useState } from "react";
import type { QuizQuestion } from "@/lib/learn/types";

const ACCENT = "#34d399";
const INK = "#e8edf8";
const MUTED = "rgba(232,237,248,0.55)";

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
    <section style={{ margin: "32px 0" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <span style={{ fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", color: ACCENT }}>
          Check yourself
        </span>
        {submitted && (
          <span style={{ fontFamily: "monospace", fontSize: 13, color: pct >= 50 ? ACCENT : "#f59e0b" }}>
            {correct}/{questions.length} correct
          </span>
        )}
      </div>

      {questions.map((q, qi) => (
        <div key={qi} style={{ marginBottom: 22 }}>
          <p style={{ margin: "0 0 12px", fontSize: 15.5, color: INK, fontWeight: 500 }}>
            {qi + 1}. {q.question}
          </p>
          <div style={{ display: "grid", gap: 8 }}>
            {q.options.map((opt, oi) => {
              const isPicked = picked[qi] === oi;
              const isAnswer = q.answerIndex === oi;
              let bg = "rgba(232,237,248,0.04)";
              let border = "1px solid rgba(232,237,248,0.1)";
              let color = INK;
              if (submitted) {
                if (isAnswer) {
                  bg = "rgba(52,211,153,0.12)";
                  border = "1px solid rgba(52,211,153,0.5)";
                  color = ACCENT;
                } else if (isPicked) {
                  bg = "rgba(248,113,113,0.1)";
                  border = "1px solid rgba(248,113,113,0.45)";
                  color = "#f87171";
                }
              } else if (isPicked) {
                bg = "rgba(96,165,250,0.12)";
                border = "1px solid rgba(96,165,250,0.5)";
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
                    borderRadius: 10,
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
            <p style={{ margin: "10px 2px 0", fontSize: 13, color: MUTED, lineHeight: 1.5 }}>
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
            background: answeredAll ? ACCENT : "rgba(232,237,248,0.08)",
            color: answeredAll ? "#04140d" : MUTED,
            border: "none",
            borderRadius: 100,
            padding: "12px 30px",
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: "0.04em",
            cursor: answeredAll ? "pointer" : "not-allowed",
          }}
        >
          {answeredAll ? "Lock in answers" : "Answer every question"}
        </button>
      )}
    </section>
  );
}
