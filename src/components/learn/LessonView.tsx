"use client";

// Conviqt Learn — renders one authored lesson module: hero infographic, concept
// cards, key terms, the interactive playground, a real-world example, the quiz,
// and the bridges into Chat + Alpha Tracker. Completing the quiz records XP.

import { useState } from "react";
import Link from "next/link";
import type { LessonModule, LearnStats } from "@/lib/learn/types";
import { LessonWidgetRenderer } from "./Widgets";
import { Quiz } from "./Quiz";

const INK = "#e8edf8";
const MUTED = "rgba(232,237,248,0.55)";
const CARD = "rgba(232,237,248,0.04)";
const BORDER = "1px solid rgba(232,237,248,0.1)";

export function LessonView({
  module,
  trackName,
  accent,
  onBack,
  onCompleted,
}: {
  module: LessonModule;
  trackName: string;
  accent: string;
  onBack: () => void;
  onCompleted: (stats: LearnStats) => void;
}) {
  const [result, setResult] = useState<{ awardedXp: number; pct: number } | null>(null);

  async function handleQuizComplete(pct: number) {
    try {
      const res = await fetch("/api/learn/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonId: module.lessonId, quizPct: pct }),
      });
      if (res.ok) {
        const data = (await res.json()) as { awardedXp: number; stats: LearnStats };
        setResult({ awardedXp: data.awardedXp, pct });
        onCompleted(data.stats);
      } else {
        setResult({ awardedXp: 0, pct });
      }
    } catch {
      setResult({ awardedXp: 0, pct });
    }
  }

  const chatHref = `/chat?q=${encodeURIComponent(module.tryInChat.prompt)}`;
  const ticker = module.realWorldExample.ticker;

  return (
    <div style={{ maxWidth: 880, margin: "0 auto" }}>
      <button
        onClick={onBack}
        style={{
          background: "none",
          border: BORDER,
          color: MUTED,
          borderRadius: 100,
          padding: "7px 16px",
          fontSize: 12.5,
          cursor: "pointer",
          marginBottom: 24,
        }}
      >
        ← All lessons
      </button>

      <div style={{ marginBottom: 6, fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", color: accent }}>
        {trackName}
      </div>
      <h1
        style={{
          fontFamily: "var(--font-display), Georgia, serif",
          fontWeight: 400,
          fontSize: 36,
          lineHeight: 1.1,
          color: INK,
          margin: "0 0 10px",
        }}
      >
        {module.title}
      </h1>
      <p style={{ fontSize: 17, color: MUTED, margin: "0 0 28px", lineHeight: 1.5 }}>{module.subtitle}</p>

      {module.heroSvg && (
        <div
          style={{
            background: CARD,
            border: BORDER,
            borderRadius: 18,
            padding: 18,
            marginBottom: 30,
          }}
          dangerouslySetInnerHTML={{ __html: module.heroSvg }}
        />
      )}

      {/* Concept cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14, marginBottom: 8 }}>
        {module.conceptCards.map((c, i) => (
          <div key={i} style={{ background: CARD, border: BORDER, borderRadius: 14, padding: "18px 18px" }}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>{c.emoji}</div>
            <h3 style={{ margin: "0 0 6px", fontSize: 15.5, color: INK }}>{c.heading}</h3>
            <p style={{ margin: 0, fontSize: 13.5, color: MUTED, lineHeight: 1.55 }}>{c.body}</p>
          </div>
        ))}
      </div>

      {/* Interactive playground */}
      {module.widget && <LessonWidgetRenderer widget={module.widget} />}

      {/* Real-world example */}
      {module.realWorldExample.scenario && (
        <section
          style={{
            background: "rgba(96,165,250,0.06)",
            border: "1px solid rgba(96,165,250,0.2)",
            borderRadius: 16,
            padding: "22px 24px",
            margin: "28px 0",
          }}
        >
          <div style={{ fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", color: "#60a5fa", marginBottom: 10 }}>
            In the real world{ticker ? ` · ${ticker}` : ""}
          </div>
          <p style={{ margin: "0 0 10px", fontSize: 15, color: INK, lineHeight: 1.6 }}>
            {module.realWorldExample.scenario}
          </p>
          <p style={{ margin: 0, fontSize: 14, color: MUTED, lineHeight: 1.55 }}>
            <strong style={{ color: "#60a5fa" }}>Takeaway:</strong> {module.realWorldExample.lesson}
          </p>
          {ticker && (
            <Link
              href={`/chat?q=${encodeURIComponent(`analyze ${ticker}`)}`}
              style={{
                display: "inline-block",
                marginTop: 14,
                fontSize: 12.5,
                color: "#60a5fa",
                textDecoration: "none",
                borderBottom: "1px solid rgba(96,165,250,0.4)",
                paddingBottom: 1,
              }}
            >
              See how the Council analyzes {ticker} →
            </Link>
          )}
        </section>
      )}

      {/* Key terms */}
      {module.keyTerms.length > 0 && (
        <section style={{ margin: "28px 0" }}>
          <div style={{ fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", color: MUTED, marginBottom: 14 }}>
            Words to know
          </div>
          <div style={{ display: "grid", gap: 10 }}>
            {module.keyTerms.map((t, i) => (
              <div key={i} style={{ display: "flex", gap: 14, alignItems: "baseline" }}>
                <span style={{ fontFamily: "monospace", fontSize: 13.5, color: accent, minWidth: 130, fontWeight: 600 }}>
                  {t.term}
                </span>
                <span style={{ fontSize: 14, color: MUTED, lineHeight: 1.5 }}>{t.definition}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Quiz */}
      <Quiz questions={module.quiz} onComplete={handleQuizComplete} />

      {/* XP celebration */}
      {result && (
        <div
          style={{
            background: "linear-gradient(135deg, rgba(52,211,153,0.14), rgba(96,165,250,0.1))",
            border: "1px solid rgba(52,211,153,0.35)",
            borderRadius: 18,
            padding: "24px 26px",
            margin: "20px 0 8px",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 30, marginBottom: 6 }}>{result.pct >= 50 ? "🎉" : "💪"}</div>
          <div style={{ fontFamily: "var(--font-display), Georgia, serif", fontSize: 22, color: INK, marginBottom: 4 }}>
            {result.awardedXp > 0 ? `+${result.awardedXp} XP earned!` : "Lesson revisited"}
          </div>
          <p style={{ margin: 0, fontSize: 13.5, color: MUTED }}>
            You scored {result.pct}%.{" "}
            {result.awardedXp === 0 && "You already banked the XP for this one — nice review."}
          </p>
        </div>
      )}

      {/* Bridge into Chat */}
      <section
        style={{
          background: CARD,
          border: BORDER,
          borderRadius: 16,
          padding: "22px 24px",
          margin: "24px 0 8px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 18,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div style={{ fontSize: 15.5, color: INK, marginBottom: 4 }}>Ready to use it for real?</div>
          <p style={{ margin: 0, fontSize: 13.5, color: MUTED }}>
            Put this lesson to work on a live stock with the AI Council.
          </p>
        </div>
        <Link
          href={chatHref}
          style={{
            background: accent,
            color: "#04140d",
            borderRadius: 100,
            padding: "12px 26px",
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: "0.03em",
            textDecoration: "none",
            whiteSpace: "nowrap",
          }}
        >
          {module.tryInChat.label} →
        </Link>
      </section>

      {/* Takeaways */}
      {module.takeaways.length > 0 && (
        <section style={{ margin: "28px 0 12px" }}>
          <div style={{ fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", color: MUTED, marginBottom: 14 }}>
            Remember this
          </div>
          <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 10 }}>
            {module.takeaways.map((t, i) => (
              <li key={i} style={{ display: "flex", gap: 10, fontSize: 14.5, color: INK, lineHeight: 1.5 }}>
                <span style={{ color: accent }}>◆</span>
                {t}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
