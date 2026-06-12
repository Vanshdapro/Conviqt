"use client";

import { useState } from "react";
import Link from "next/link";
import type { LessonModule, LearnStats } from "@/lib/learn/types";
import { LessonWidgetRenderer } from "./Widgets";
import { LessonFigure } from "./Figures";
import { Quiz } from "./Quiz";
import { ArrowRightIcon, CheckIcon, TrackIcon } from "./icons";

// Almanac tokens only (playbook 2.1) — the dark lesson palette died in Phase 8.
const INK = "var(--text)";
const MUTED = "var(--text-2)";
const FAINT = "var(--text-muted)";
const ACCENT = "var(--accent)";
const ON_ACCENT = "var(--on-accent)";
const SURFACE = "var(--bg-surface)";
const SURFACE_SOFT = "var(--bg-sunken)";
const BORDER = "var(--border)";
const RULE = "var(--border)";
const LABEL = "var(--font-ui)";
const SANS = "var(--font-ui)";
const DISPLAY = "var(--font-display)";
const SERIF = "var(--font-ui)";

export function LessonView({
  module,
  trackId,
  trackName,
  onBack,
  onCompleted,
}: {
  module: LessonModule;
  trackId: string;
  trackName: string;
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

  const researchHref = `/research?q=${encodeURIComponent(module.tryInChat.prompt)}`;
  const ticker = module.realWorldExample.ticker;
  // The completion nudge sends the reader straight back to Research with the
  // lesson's example ticker pre-filled (or a blank prompt if there isn't one).
  const tryItHref = ticker
    ? `/research?q=${encodeURIComponent(`analyze ${ticker}`)}`
    : "/research";

  return (
    <article style={{ maxWidth: 860, margin: "0 auto", fontFamily: SANS }}>
      <style>{`
        .lesson-action, .lesson-quiet, .lesson-card { transition: border-color var(--motion-fast) var(--ease-out), background var(--motion-fast) var(--ease-out), transform var(--motion-fast) var(--ease-out); }
        .lesson-action:hover, .lesson-quiet:hover, .lesson-card:hover { transform: translateY(-1px); }
        .lesson-action:hover { background: var(--accent-hover) !important; }
        .lesson-quiet:hover { border-color: var(--border-strong) !important; }
        .lesson-action:focus-visible, .lesson-quiet:focus-visible, .lesson-card:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }
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
          borderRadius: "var(--radius-control)",
          padding: "8px 12px",
          fontFamily: LABEL,
          fontSize: 12.5,
          fontWeight: 600,
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
              borderRadius: "var(--radius-control)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              border: `1px solid ${BORDER}`,
              background: "var(--accent-weak)",
              color: ACCENT,
            }}
          >
            <TrackIcon trackId={trackId} size={15} />
          </span>
          <span style={{ fontFamily: LABEL, fontSize: 12.5, fontWeight: 600 }}>{trackName}</span>
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

      {module.figure && <LessonFigure figure={module.figure} accent="var(--accent)" />}

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
                  borderRadius: "var(--radius-card)",
                  boxShadow: "var(--shadow-card)",
                  padding: 16,
                }}
              >
                <div style={{ color: FAINT, fontFamily: LABEL, fontSize: 12, fontVariantNumeric: "tabular-nums", marginBottom: 10 }}>
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
            borderRadius: "var(--radius-card)",
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
              href={`/research?q=${encodeURIComponent(`analyze ${ticker}`)}`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                marginTop: 14,
                fontFamily: LABEL,
                fontSize: 13,
                fontWeight: 600,
                color: "var(--link)",
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
            background: "var(--accent-weak)",
            border: `1px solid ${BORDER}`,
            borderRadius: "var(--radius-card)",
            padding: 18,
            margin: "20px 0",
            display: "flex",
            alignItems: "center",
            gap: 14,
            flexWrap: "wrap",
          }}
        >
          <span style={{ color: ACCENT, display: "inline-flex", flexShrink: 0 }}>
            <CheckIcon size={22} />
          </span>
          <div style={{ flex: 1, minWidth: 180 }}>
            <div style={{ color: INK, fontSize: 16, fontWeight: 650, marginBottom: 4 }}>
              {result.awardedXp > 0 ? `+${result.awardedXp} XP` : "Already completed"}
            </div>
            <p style={{ margin: 0, fontSize: 13.5, color: MUTED }}>
              Score: {result.pct}%. Now take it out of the classroom.
            </p>
          </div>
          {/* The nudge back to Research — a lesson should end in the product. */}
          <Link
            className="lesson-action"
            href={tryItHref}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              minHeight: 40,
              background: ACCENT,
              color: ON_ACCENT,
              borderRadius: "var(--radius-control)",
              padding: "0 16px",
              fontSize: 13.5,
              fontWeight: 650,
              textDecoration: "none",
              whiteSpace: "nowrap",
            }}
          >
            Try it on a real stock
            <ArrowRightIcon size={15} />
          </Link>
        </div>
      )}

      <section
        className="lesson-bridge"
        style={{
          background: SURFACE,
          border: `1px solid ${BORDER}`,
          borderRadius: "var(--radius-card)",
          boxShadow: "var(--shadow-card)",
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
          <p style={{ margin: 0, color: MUTED, fontSize: 13.5 }}>Open Research with a prompt based on this lesson.</p>
        </div>
        <Link
          className="lesson-action"
          href={researchHref}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            minHeight: 40,
            background: ACCENT,
            color: ON_ACCENT,
            borderRadius: "var(--radius-control)",
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
                <span style={{ color: FAINT, fontFamily: LABEL, fontSize: 12, fontVariantNumeric: "tabular-nums", minWidth: 22, lineHeight: 1.8 }}>
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
        fontFamily: LABEL,
        fontSize: 11,
        fontWeight: 650,
        letterSpacing: "0.16em",
        textTransform: "uppercase",
        marginBottom: compact ? 10 : 14,
      }}
    >
      {children}
    </div>
  );
}
