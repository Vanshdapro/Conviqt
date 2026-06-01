"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

// The Academy hub. The Academy has two halves: Learn (build the model) and
// Practice (prove you can run it). This page frames that arc and routes the
// learner into either side, with their live progress in each. Beyond the
// Academy sit the real tools — Research and Alpha — which is where a learner
// graduates to once the model is internalized.

const SURFACE = "#071120";
const SURFACE_SOFT = "rgba(232,237,248,0.035)";
const BORDER = "rgba(232,237,248,0.09)";
const RULE = "rgba(232,237,248,0.075)";
const INK = "#e8edf8";
const MUTED = "#8aa0c2";
const FAINT = "#526684";
const ACCENT = "#4f87f7";
const GOOD = "#22c55e";
const MONO = "var(--font-mono), 'JetBrains Mono', monospace";
const SANS = "var(--font-sans), system-ui, sans-serif";
const DISPLAY = "var(--font-display), Georgia, 'Times New Roman', serif";
const SERIF = "var(--font-serif), Georgia, serif";

type LearnProgress = { xp: number; completedLessonIds?: string[] };
type PracticeSnapshot = {
  stats: { xp: number; rank: { title: string }; clearedDrillIds: string[] };
  totals: { totalDrills: number; cleared: number };
  signedIn: boolean;
};

export function AcademyHub({ totalLessons }: { totalLessons: number }) {
  const [learn, setLearn] = useState<LearnProgress | null>(null);
  const [practice, setPractice] = useState<PracticeSnapshot | null>(null);

  useEffect(() => {
    fetch("/api/learn/progress")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d && typeof d.xp === "number") setLearn(d as LearnProgress); })
      .catch(() => null);

    fetch("/api/practice")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d && d.stats) setPractice(d as PracticeSnapshot); })
      .catch(() => null);
  }, []);

  const learnTotal = totalLessons;
  const lessonsDone = learn?.completedLessonIds?.length ?? 0;
  const drillsDone = practice?.totals.cleared ?? 0;
  const drillsTotal = practice?.totals.totalDrills ?? null;
  const rank = practice?.stats.rank.title ?? "Intern";

  return (
    <div style={{ fontFamily: SANS }}>
      <style>{`
        .ac-path { transition: border-color .16s ease, background .16s ease, transform .16s ease; }
        .ac-path:hover { transform: translateY(-2px); border-color: rgba(79,135,247,.32); background: rgba(232,237,248,.05); }
        .ac-path:focus-visible { outline: 2px solid rgba(79,135,247,.6); outline-offset: 3px; }
        @media (max-width: 760px) {
          .ac-paths { grid-template-columns: 1fr !important; }
          .ac-title { font-size: 40px !important; }
          .ac-arc { flex-direction: column !important; align-items: flex-start !important; gap: 10px !important; }
          .ac-arc-sep { display: none !important; }
        }
        @media (prefers-reduced-motion: reduce) {
          .ac-path { transition: none; }
          .ac-path:hover { transform: none; }
        }
      `}</style>

      <header style={{ marginBottom: 40, maxWidth: 720 }}>
        <div style={{ color: ACCENT, fontFamily: MONO, fontSize: 10, letterSpacing: "0.24em", textTransform: "uppercase", marginBottom: 18 }}>
          Conviqt Academy
        </div>
        <h1
          className="ac-title"
          style={{
            color: INK,
            fontFamily: DISPLAY,
            fontSize: 50,
            lineHeight: 1.04,
            letterSpacing: "-0.018em",
            fontWeight: 500,
            margin: "0 0 18px",
          }}
        >
          Learn the model. Then prove you can run it.
        </h1>
        <p style={{ color: MUTED, fontFamily: SERIF, fontSize: 17.5, lineHeight: 1.62, margin: 0 }}>
          The Academy has two halves. <strong style={{ color: INK, fontWeight: 600 }}>Learn</strong> builds the
          mental model — how risk, sizing, valuation, and markets actually work. <strong style={{ color: INK, fontWeight: 600 }}>Practice</strong> makes
          you do it: trade real historical episodes bar by bar and write theses an AI grades like a portfolio
          manager. Master both, and the real tools — Research and Alpha — stop being a black box.
        </p>
      </header>

      <div
        className="ac-paths"
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 34 }}
      >
        <PathCard
          href="/academy/learn"
          eyebrow="Part one — the curriculum"
          title="Learn"
          blurb="Short, interactive lessons on budgeting, markets, risk, sizing, and valuation. Read one, move a slider, answer a few questions. Built for everyone from finance students to the merely curious."
          metricLabel="Lessons completed"
          metricValue={`${lessonsDone} / ${learnTotal}`}
          progress={learnTotal ? Math.round((lessonsDone / learnTotal) * 100) : 0}
          cta="Open the curriculum"
          accent={ACCENT}
        />
        <PathCard
          href="/academy/practice"
          eyebrow="Part two — the desk"
          title="Practice"
          blurb="Apply every lesson. Trade the COVID crash, Nvidia's AI run, and the SVB collapse bar by bar; climb a boss-fight ladder toward a PM certification; write theses an AI grades section by section."
          metricLabel={`Rank — ${rank}`}
          metricValue={drillsTotal !== null ? `${drillsDone} / ${drillsTotal} drills` : `${drillsDone} drills`}
          progress={drillsTotal ? Math.round((drillsDone / drillsTotal) * 100) : 0}
          cta="Enter the desk"
          accent={GOOD}
        />
      </div>

      {/* The arc into the real product */}
      <div
        style={{
          background: SURFACE,
          border: `1px solid ${BORDER}`,
          borderRadius: 12,
          padding: "20px 22px",
        }}
      >
        <div style={{ color: FAINT, fontFamily: MONO, fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 14 }}>
          How it fits together
        </div>
        <div className="ac-arc" style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <ArcStep n="01" label="Learn" sub="Build the model" />
          <ArcSep />
          <ArcStep n="02" label="Practice" sub="Run it under fire" />
          <ArcSep />
          <ArcStep n="03" label="Research / Alpha" sub="The real tools" muted />
        </div>
      </div>

      <footer style={{ marginTop: 30, paddingTop: 16, borderTop: `1px solid ${RULE}`, color: FAINT, fontSize: 12, lineHeight: 1.6 }}>
        Educational material only, not financial advice. Practice uses real historical prices, each carrying a
        source link. {practice && !practice.signedIn ? (
          <>
            {" "}
            <Link href="/login" style={{ color: ACCENT, fontWeight: 600, textDecoration: "none" }}>Sign in</Link> to
            save your progress and rank.
          </>
        ) : null}
      </footer>
    </div>
  );
}

function PathCard({
  href, eyebrow, title, blurb, metricLabel, metricValue, progress, cta, accent,
}: {
  href: string;
  eyebrow: string;
  title: string;
  blurb: string;
  metricLabel: string;
  metricValue: string;
  progress: number;
  cta: string;
  accent: string;
}) {
  return (
    <Link
      href={href}
      className="ac-path"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 18,
        background: SURFACE,
        border: `1px solid ${BORDER}`,
        borderRadius: 12,
        padding: 24,
        textDecoration: "none",
        minHeight: 280,
      }}
    >
      <div>
        <div style={{ color: accent, fontFamily: MONO, fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: 12 }}>
          {eyebrow}
        </div>
        <h2 style={{ color: INK, fontFamily: DISPLAY, fontSize: 30, fontWeight: 500, letterSpacing: "-0.01em", margin: "0 0 12px" }}>
          {title}
        </h2>
        <p style={{ color: MUTED, fontFamily: SERIF, fontSize: 15, lineHeight: 1.6, margin: 0 }}>
          {blurb}
        </p>
      </div>

      <div style={{ marginTop: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
          <span style={{ color: FAINT, fontFamily: MONO, fontSize: 11, letterSpacing: "0.04em" }}>{metricLabel}</span>
          <span style={{ color: INK, fontFamily: MONO, fontSize: 13, fontWeight: 650 }}>{metricValue}</span>
        </div>
        <div style={{ height: 4, borderRadius: 999, background: "rgba(232,237,248,0.08)", overflow: "hidden", marginBottom: 18 }}>
          <div style={{ width: `${Math.max(0, Math.min(100, progress))}%`, height: "100%", background: accent, borderRadius: 999, transition: "width .4s ease" }} />
        </div>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            color: accent,
            fontFamily: SANS,
            fontSize: 14,
            fontWeight: 650,
          }}
        >
          {cta}
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="4" y1="12" x2="18.5" y2="12" />
            <polyline points="12.5 6 18.5 12 12.5 18" />
          </svg>
        </span>
      </div>
    </Link>
  );
}

function ArcStep({ n, label, sub, muted }: { n: string; label: string; sub: string; muted?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <span style={{ color: muted ? FAINT : ACCENT, fontFamily: MONO, fontSize: 12, fontWeight: 650 }}>{n}</span>
      <div>
        <div style={{ color: muted ? MUTED : INK, fontFamily: SERIF, fontSize: 15, fontWeight: 600 }}>{label}</div>
        <div style={{ color: FAINT, fontFamily: MONO, fontSize: 10.5, letterSpacing: "0.04em" }}>{sub}</div>
      </div>
    </div>
  );
}

function ArcSep() {
  return (
    <span className="ac-arc-sep" style={{ color: FAINT, flex: "0 0 auto" }} aria-hidden="true">
      <svg width={22} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
        <line x1="4" y1="12" x2="18.5" y2="12" />
        <polyline points="12.5 6 18.5 12 12.5 18" />
      </svg>
    </span>
  );
}
