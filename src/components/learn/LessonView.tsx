"use client";

// Conviqt Learn — renders one authored lesson module: hero infographic, concept
// cards, key terms, the interactive playground, a real-world example, the quiz,
// and the bridges into Chat + Alpha Tracker. Completing the quiz records XP.
// Styled to Conviqt's institutional system — mono electric-blue accent, no emoji.

import { useState } from "react";
import Link from "next/link";
import type { LessonModule, LearnStats } from "@/lib/learn/types";
import { LessonWidgetRenderer } from "./Widgets";
import { Quiz } from "./Quiz";
import { TrackIcon, CheckIcon, ArrowRightIcon } from "./icons";

const INK = "#e8edf8";
const INK_SOFT = "#c4d0e6";
const MUTED = "#7a92b8";
const FAINT = "#46597d";
const ACCENT = "#4f87f7"; // electric blue — interactive + semantic only
const CARD = "rgba(255,255,255,0.022)";
const CARD_BORDER = "rgba(232,237,248,0.08)";
const RULE = "#16243f";
const BORDER = `1px solid ${CARD_BORDER}`;
const SERIF = "var(--font-serif), 'Source Serif 4', Georgia, serif";
const DISPLAY = "var(--font-display), 'Playfair Display', Georgia, serif";
const MONO = "var(--font-mono), 'JetBrains Mono', monospace";

// Prestige layer — champagne gold, used only for provenance marks (chapter
// line, section eyebrows, concept numerals, colophon). Blue stays interactive.
const GOLD = "#c9a96a";
const GOLD_SOFT = "rgba(201,169,106,0.30)";
const GOLD_FAINT = "rgba(201,169,106,0.10)";

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

  const chatHref = `/chat?q=${encodeURIComponent(module.tryInChat.prompt)}`;
  const ticker = module.realWorldExample.ticker;

  return (
    <div style={{ maxWidth: 880, margin: "0 auto" }}>
      <style>{`
        .lrn-back { transition: color .15s ease, border-color .15s ease; }
        .lrn-back:hover { color: ${INK}; border-color: rgba(79,135,247,.4); }
        .lrn-bridge { transition: transform .15s ease, box-shadow .2s ease; }
        .lrn-bridge:hover { transform: translateY(-1px); box-shadow: 0 8px 28px rgba(79,135,247,.4); }
        @media (prefers-reduced-motion: reduce) { .lrn-bridge:hover { transform: none; } }
      `}</style>

      <button
        className="lrn-back"
        onClick={onBack}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 7,
          background: "none",
          border: BORDER,
          color: MUTED,
          borderRadius: 8,
          padding: "7px 15px",
          fontFamily: MONO,
          fontSize: 12,
          letterSpacing: "0.04em",
          cursor: "pointer",
          marginBottom: 26,
        }}
      >
        <span style={{ transform: "rotate(180deg)", display: "inline-flex" }}><ArrowRightIcon size={14} /></span>
        All lessons
      </button>

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, color: GOLD }}>
        <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 30, height: 30, borderRadius: 7, border: `1px solid ${GOLD_SOFT}`, background: "rgba(255,255,255,0.025)" }}>
          <TrackIcon trackId={trackId} size={16} />
        </span>
        <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase" }}>
          {trackName}
        </span>
      </div>
      <h1
        style={{
          fontFamily: DISPLAY,
          fontWeight: 500,
          fontSize: 40,
          lineHeight: 1.06,
          letterSpacing: "-0.018em",
          color: INK,
          margin: "0 0 14px",
        }}
      >
        {module.title}
      </h1>
      <p style={{ fontFamily: SERIF, fontSize: 17.5, color: INK_SOFT, margin: "0 0 18px", lineHeight: 1.58 }}>{module.subtitle}</p>
      <div style={{ height: 1, background: `linear-gradient(90deg, ${GOLD_SOFT}, ${GOLD_FAINT} 40%, transparent)`, margin: "0 0 30px" }} />

      {module.heroSvg && (
        <div
          style={{
            background: CARD,
            border: BORDER,
            borderRadius: 16,
            padding: 20,
            marginBottom: 32,
          }}
          dangerouslySetInnerHTML={{ __html: module.heroSvg }}
        />
      )}

      {/* Concept cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14, marginBottom: 8 }}>
        {module.conceptCards.map((c, i) => (
          <div key={i} style={{ background: CARD, border: BORDER, borderRadius: 12, padding: "18px 18px" }}>
            <div
              style={{
                fontFamily: DISPLAY,
                fontSize: 15,
                fontWeight: 500,
                fontStyle: "italic",
                color: GOLD,
                marginBottom: 12,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 28,
                height: 28,
                borderRadius: 7,
                background: GOLD_FAINT,
                border: `1px solid ${GOLD_SOFT}`,
              }}
            >
              {String(i + 1).padStart(2, "0")}
            </div>
            <h3 style={{ fontFamily: SERIF, margin: "0 0 6px", fontSize: 15.5, fontWeight: 600, color: INK }}>{c.heading}</h3>
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
            background: "rgba(79,135,247,0.05)",
            border: "1px solid rgba(79,135,247,0.2)",
            borderLeft: `2px solid ${ACCENT}`,
            borderRadius: 14,
            padding: "22px 24px",
            margin: "28px 0",
          }}
        >
          <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", color: ACCENT, marginBottom: 11 }}>
            In the real world{ticker ? ` · ${ticker}` : ""}
          </div>
          <p style={{ fontFamily: SERIF, margin: "0 0 10px", fontSize: 15.5, color: INK, lineHeight: 1.6 }}>
            {module.realWorldExample.scenario}
          </p>
          <p style={{ margin: 0, fontSize: 14, color: MUTED, lineHeight: 1.55 }}>
            <strong style={{ color: ACCENT, fontWeight: 600 }}>Takeaway:</strong> {module.realWorldExample.lesson}
          </p>
          {ticker && (
            <Link
              href={`/chat?q=${encodeURIComponent(`analyze ${ticker}`)}`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                marginTop: 15,
                fontFamily: MONO,
                fontSize: 12,
                color: ACCENT,
                textDecoration: "none",
              }}
            >
              See how the Council analyzes {ticker}
              <ArrowRightIcon size={13} />
            </Link>
          )}
        </section>
      )}

      {/* Key terms */}
      {module.keyTerms.length > 0 && (
        <section style={{ margin: "30px 0" }}>
          <SectionEyebrow>Lexicon</SectionEyebrow>
          <div style={{ display: "grid", gap: 1, background: RULE, border: `1px solid ${RULE}`, borderRadius: 10, overflow: "hidden" }}>
            {module.keyTerms.map((t, i) => (
              <div key={i} style={{ display: "flex", gap: 16, alignItems: "baseline", background: "#050d1a", padding: "13px 18px", flexWrap: "wrap" }}>
                <span style={{ fontFamily: MONO, fontSize: 13, color: GOLD, minWidth: 140, fontWeight: 600 }}>
                  {t.term}
                </span>
                <span style={{ fontSize: 14, color: INK_SOFT, lineHeight: 1.5, flex: 1 }}>{t.definition}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Quiz */}
      <Quiz questions={module.quiz} onComplete={handleQuizComplete} />

      {/* XP confirmation */}
      {result && (
        <div
          style={{
            background: GOLD_FAINT,
            border: `1px solid ${GOLD_SOFT}`,
            borderRadius: 14,
            padding: "26px 26px",
            margin: "20px 0 8px",
            textAlign: "center",
          }}
        >
          <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 46, height: 46, borderRadius: 999, background: "rgba(201,169,106,0.16)", border: `1px solid ${GOLD_SOFT}`, color: GOLD, marginBottom: 14 }}>
            <CheckIcon size={24} />
          </div>
          <div style={{ fontFamily: DISPLAY, fontSize: 24, fontWeight: 500, color: INK, marginBottom: 5 }}>
            {result.awardedXp > 0 ? `+${result.awardedXp} XP earned` : "Lesson revisited"}
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
          borderRadius: 14,
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
          <div style={{ fontFamily: SERIF, fontSize: 16, fontWeight: 600, color: INK, marginBottom: 4 }}>Ready to use it for real?</div>
          <p style={{ margin: 0, fontSize: 13.5, color: MUTED }}>
            Put this lesson to work on a live stock with the AI Council.
          </p>
        </div>
        <Link
          className="lrn-bridge"
          href={chatHref}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            background: ACCENT,
            color: "#04101f",
            borderRadius: 8,
            padding: "12px 24px",
            fontFamily: SERIF,
            fontSize: 13.5,
            fontWeight: 600,
            letterSpacing: "0.01em",
            textDecoration: "none",
            whiteSpace: "nowrap",
            boxShadow: "0 4px 18px rgba(79,135,247,0.28)",
          }}
        >
          {module.tryInChat.label}
          <ArrowRightIcon size={15} />
        </Link>
      </section>

      {/* Takeaways */}
      {module.takeaways.length > 0 && (
        <section style={{ margin: "30px 0 12px" }}>
          <SectionEyebrow>Commit to memory</SectionEyebrow>
          <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 13 }}>
            {module.takeaways.map((t, i) => (
              <li key={i} style={{ display: "flex", gap: 13, fontFamily: SERIF, fontSize: 15, color: INK_SOFT, lineHeight: 1.55, alignItems: "flex-start" }}>
                <span style={{ fontFamily: DISPLAY, fontStyle: "italic", fontSize: 14, color: GOLD, flexShrink: 0, lineHeight: 1.6, minWidth: 18 }}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                {t}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

// A small gold-ruled section label — the running head of a research note.
function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
      <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: GOLD }}>
        {children}
      </span>
      <span style={{ height: 1, flex: 1, background: RULE }} />
    </div>
  );
}
