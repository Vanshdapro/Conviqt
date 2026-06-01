"use client";

import { useState } from "react";
import Link from "next/link";
import type { LessonModule, LearnStats } from "@/lib/learn/types";
import { LessonWidgetRenderer } from "./Widgets";
import { LessonFigure } from "./Figures";
import { Quiz } from "./Quiz";
import { ArrowRightIcon, CheckIcon, TrackIcon } from "./icons";

const INK = "#e8edf8";
const MUTED = "#8aa0c2";
const FAINT = "#526684";
const ACCENT = "#4f87f7";
const GOOD = "#22c55e";
const SURFACE = "#071120";
const SURFACE_SOFT = "rgba(232,237,248,0.035)";
const BORDER = "rgba(232,237,248,0.09)";
const RULE = "rgba(232,237,248,0.075)";
const MONO = "var(--font-mono), 'JetBrains Mono', monospace";
const SANS = "var(--font-sans), system-ui, sans-serif";
const DISPLAY = "var(--font-display), Georgia, 'Times New Roman', serif";
const SERIF = "var(--font-serif), Georgia, serif";

export function LessonView({
  module,
  trackId,
  trackName,
  accent = ACCENT,
  onBack,
  onCompleted,
}: {
  module: LessonModule;
  trackId: string;
  trackName: string;
  accent?: string;
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
    <article style={{ maxWidth: 860, margin: "0 auto", fontFamily: SANS }}>
      <style>{`
        .lesson-action, .lesson-quiet, .lesson-card { transition: border-color .16s ease, background .16s ease, transform .16s ease; }
        .lesson-action:hover, .lesson-quiet:hover, .lesson-card:hover { transform: translateY(-1px); }
        .lesson-action:focus-visible, .lesson-quiet:focus-visible, .lesson-card:focus-visible { outline: 2px solid rgba(79,135,247,.65); outline-offset: 3px; }
        @media (max-width: 720px) {
          .lesson-concepts { grid-template-columns: 1fr !important; }
          .lesson-bridge { align-items: stretch !important; }
          .lesson-bridge a { justify-content: center; width: 100%; }
        }
        @media (prefers-reduced-motion: reduce) {
          .lesson-action, .lesson-quiet, .lesson-card { transition: none; }
          .lesson-action:hover, .lesson-quiet:hover, .lesson-card:hover { transform: none; }
        }
      `}</style>

      <button
        className="lesson-quiet"
        onClick={onBack}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 7,
          background: "transparent",
          border: `1px solid ${BORDER}`,
          color: MUTED,
          borderRadius: 8,
          padding: "8px 12px",
          fontFamily: MONO,
          fontSize: 12,
          cursor: "pointer",
          marginBottom: 28,
        }}
      >
        <span style={{ transform: "rotate(180deg)", display: "inline-flex" }}>
          <ArrowRightIcon size={14} />
        </span>
        Lessons
      </button>

      <header style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, color: FAINT, marginBottom: 14 }}>
          <span
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              border: `1px solid ${BORDER}`,
              background: SURFACE_SOFT,
              color: ACCENT,
            }}
          >
            <TrackIcon trackId={trackId} size={15} />
          </span>
          <span style={{ fontFamily: MONO, fontSize: 12 }}>{trackName}</span>
        </div>
        <h1
          style={{
            color: INK,
            fontFamily: DISPLAY,
            fontSize: 40,
            lineHeight: 1.1,
            fontWeight: 500,
            letterSpacing: "-0.015em",
            margin: "0 0 14px",
          }}
        >
          {module.title}
        </h1>
        <p style={{ color: MUTED, fontFamily: SERIF, fontSize: 17, lineHeight: 1.6, margin: 0, maxWidth: 720 }}>
          {module.subtitle}
        </p>
      </header>

      {module.figure && <LessonFigure figure={module.figure} accent={accent} />}

      {module.conceptCards.length > 0 && (
        <section style={{ marginBottom: 26 }}>
          <SectionTitle>Core ideas</SectionTitle>
          <div className="lesson-concepts" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 10 }}>
            {module.conceptCards.map((card, index) => (
              <div
                key={`${card.heading}-${index}`}
                className="lesson-card"
                style={{
                  background: SURFACE,
                  border: `1px solid ${BORDER}`,
                  borderRadius: 8,
                  padding: 16,
                }}
              >
                <div style={{ color: FAINT, fontFamily: MONO, fontSize: 12, marginBottom: 10 }}>
                  {String(index + 1).padStart(2, "0")}
                </div>
                <h3 style={{ color: INK, fontFamily: SERIF, fontSize: 16, lineHeight: 1.35, margin: "0 0 8px", fontWeight: 600 }}>
                  {card.heading}
                </h3>
                <p style={{ color: MUTED, fontSize: 13.5, lineHeight: 1.55, margin: 0 }}>{card.body}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {module.widget && <LessonWidgetRenderer widget={module.widget} />}

      {module.realWorldExample.scenario && (
        <section
          style={{
            background: SURFACE_SOFT,
            border: `1px solid ${BORDER}`,
            borderRadius: 8,
            padding: 18,
            margin: "24px 0",
          }}
        >
          <SectionTitle compact>{ticker ? `Example: ${ticker}` : "Example"}</SectionTitle>
          <p style={{ margin: "0 0 12px", fontFamily: SERIF, fontSize: 15.5, color: INK, lineHeight: 1.62 }}>
            {module.realWorldExample.scenario}
          </p>
          <p style={{ margin: 0, fontSize: 14, color: MUTED, lineHeight: 1.55 }}>
            {module.realWorldExample.lesson}
          </p>
          {ticker && (
            <Link
              href={`/chat?q=${encodeURIComponent(`analyze ${ticker}`)}`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                marginTop: 14,
                fontFamily: MONO,
                fontSize: 12,
                color: ACCENT,
                textDecoration: "none",
              }}
            >
              Analyze {ticker}
              <ArrowRightIcon size={13} />
            </Link>
          )}
        </section>
      )}

      {module.keyTerms.length > 0 && (
        <section style={{ margin: "28px 0" }}>
          <SectionTitle>Terms</SectionTitle>
          <div style={{ borderTop: `1px solid ${RULE}` }}>
            {module.keyTerms.map((term, index) => (
              <div
                key={`${term.term}-${index}`}
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(120px, 180px) minmax(0, 1fr)",
                  gap: 18,
                  padding: "13px 0",
                  borderBottom: `1px solid ${RULE}`,
                }}
              >
                <span style={{ color: INK, fontFamily: SERIF, fontSize: 15, fontWeight: 600 }}>{term.term}</span>
                <span style={{ color: MUTED, fontSize: 14, lineHeight: 1.55 }}>{term.definition}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <Quiz questions={module.quiz} onComplete={handleQuizComplete} />

      {result && (
        <div
          style={{
            background: "rgba(34,197,94,0.07)",
            border: "1px solid rgba(34,197,94,0.24)",
            borderRadius: 8,
            padding: 18,
            margin: "20px 0",
            display: "flex",
            alignItems: "center",
            gap: 14,
          }}
        >
          <span style={{ color: GOOD, display: "inline-flex", flexShrink: 0 }}>
            <CheckIcon size={22} />
          </span>
          <div>
            <div style={{ color: INK, fontSize: 16, fontWeight: 650, marginBottom: 4 }}>
              {result.awardedXp > 0 ? `+${result.awardedXp} XP` : "Already completed"}
            </div>
            <p style={{ margin: 0, fontSize: 13.5, color: MUTED }}>
              Score: {result.pct}%.
            </p>
          </div>
        </div>
      )}

      <section
        className="lesson-bridge"
        style={{
          background: SURFACE,
          border: `1px solid ${BORDER}`,
          borderRadius: 8,
          padding: 18,
          margin: "24px 0",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div style={{ color: INK, fontFamily: SERIF, fontSize: 16, fontWeight: 600, marginBottom: 4 }}>Use this in research</div>
          <p style={{ margin: 0, color: MUTED, fontSize: 13.5 }}>Open Chat with a prompt based on this lesson.</p>
        </div>
        <Link
          className="lesson-action"
          href={chatHref}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            minHeight: 40,
            background: ACCENT,
            color: "#04101f",
            borderRadius: 8,
            padding: "0 16px",
            fontSize: 13.5,
            fontWeight: 650,
            textDecoration: "none",
            whiteSpace: "nowrap",
          }}
        >
          {module.tryInChat.label}
          <ArrowRightIcon size={15} />
        </Link>
      </section>

      {module.takeaways.length > 0 && (
        <section style={{ margin: "28px 0 10px" }}>
          <SectionTitle>Remember</SectionTitle>
          <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 10 }}>
            {module.takeaways.map((takeaway, index) => (
              <li key={`${takeaway}-${index}`} style={{ display: "flex", gap: 12, color: MUTED, fontSize: 14.5, lineHeight: 1.58 }}>
                <span style={{ color: FAINT, fontFamily: MONO, fontSize: 12, minWidth: 22, lineHeight: 1.8 }}>
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span>{takeaway}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}

function SectionTitle({
  children,
  compact = false,
}: {
  children: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <div
      style={{
        color: FAINT,
        fontFamily: MONO,
        fontSize: 10,
        letterSpacing: "0.18em",
        textTransform: "uppercase",
        marginBottom: compact ? 10 : 14,
      }}
    >
      {children}
    </div>
  );
}
