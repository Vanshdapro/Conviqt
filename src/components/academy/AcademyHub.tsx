"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const SURFACE = "var(--bg-surface)";
const BORDER = "var(--border)";
const RULE = "var(--border)";
const INK = "var(--text)";
const MUTED = "var(--text-2)";
const FAINT = "var(--text-muted)";
const ACCENT = "var(--accent)";
const GOOD = "var(--accent)";
const MONO = "var(--font-ui)";
const SANS = "var(--font-ui)";
const DISPLAY = "var(--font-display)";
const SERIF = "var(--font-ui)";

type LearnProgress = { xp: number; completedLessonIds?: string[] };
type PracticeSnapshot = {
  stats: { xp: number; rank: { title: string; minXp: number }; clearedDrillIds: string[] };
  nextRank: { title: string; minXp: number } | null;
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

  const rankFloor = practice?.stats.rank.minXp ?? 0;
  const rankCeil = practice?.nextRank?.minXp ?? (practice?.stats.xp ?? 0);
  const rankXp = practice?.stats.xp ?? 0;
  const rankPct = practice?.nextRank
    ? Math.max(0, Math.min(100, ((rankXp - rankFloor) / Math.max(1, rankCeil - rankFloor)) * 100))
    : 100;

  return (
    <div style={{ fontFamily: SANS }}>
      <style>{`
        .ac-card { transition: border-color .18s ease, background .18s ease, transform .18s ease; }
        .ac-card:hover { transform: translateY(-3px); }
        .ac-card:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }
        .ac-learn-card:hover { border-color: var(--accent) !important; }
        .ac-practice-card:hover { border-color: var(--accent) !important; }
        @media (max-width: 760px) {
          .ac-paths { grid-template-columns: 1fr !important; }
          .ac-title { font-size: 36px !important; line-height: 1.1 !important; }
          .ac-arc { flex-wrap: wrap !important; }
        }
        @media (prefers-reduced-motion: reduce) {
          .ac-card { transition: none; }
          .ac-card:hover { transform: none; }
        }
      `}</style>

      {/* Header */}
      <header style={{ marginBottom: 52, maxWidth: 780 }}>
        <div style={{ color: ACCENT, fontFamily: MONO, fontSize: 10, letterSpacing: "0.26em", textTransform: "uppercase", marginBottom: 18 }}>
          Conviqt Academy
        </div>
        <h1
          className="ac-title"
          style={{
            color: INK,
            fontFamily: DISPLAY,
            fontSize: 52,
            lineHeight: 1.03,
            letterSpacing: "-0.02em",
            fontWeight: 500,
            margin: "0 0 20px",
          }}
        >
          Learn the model.<br />Then prove you can run it.
        </h1>
        <p style={{ color: MUTED, fontFamily: SERIF, fontSize: 17.5, lineHeight: 1.64, margin: 0, maxWidth: 680 }}>
          The Academy has two halves.{" "}
          <strong style={{ color: INK, fontWeight: 600 }}>Learn</strong> builds the mental model — how risk, sizing,
          valuation, and markets actually work.{" "}
          <strong style={{ color: INK, fontWeight: 600 }}>Practice</strong> makes you do it: trade real historical
          episodes bar by bar and write theses an AI grades like a portfolio manager. Master both, and the rest of
          Conviqt — Research, the Dashboard, your Portfolio — stops being a black box.
        </p>
      </header>

      {/* Path cards */}
      <div
        className="ac-paths"
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 36 }}
      >
        {/* Learn Card */}
        <Link
          href="/academy/learn"
          className="ac-card ac-learn-card"
          style={{
            display: "flex",
            flexDirection: "column",
            background: SURFACE,
            border: `1px solid ${BORDER}`,
            borderRadius: 14,
            overflow: "hidden",
            textDecoration: "none",
            minHeight: 310,
          }}
        >
          <div style={{ padding: "24px 24px 0" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
              <div>
                <div style={{ color: ACCENT, fontFamily: MONO, fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 14 }}>
                  Part One — The Curriculum
                </div>
                <h2 style={{ color: INK, fontFamily: DISPLAY, fontSize: 34, fontWeight: 500, margin: "0 0 12px", letterSpacing: "-0.01em" }}>
                  Learn
                </h2>
              </div>
              <BookIllustration accent={ACCENT} />
            </div>
            <p style={{ color: MUTED, fontFamily: SERIF, fontSize: 15, lineHeight: 1.62, margin: 0 }}>
              Short, interactive lessons on budgeting, markets, risk, sizing, and valuation. Read one,
              move a slider, answer a few questions. Built for everyone from finance students to the merely curious.
            </p>
          </div>
          <div style={{ marginTop: "auto", padding: "18px 24px", borderTop: `1px solid var(--bg-sunken)`, background: "var(--bg-surface)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
              <span style={{ color: FAINT, fontFamily: MONO, fontSize: 11, letterSpacing: "0.04em" }}>Lessons completed</span>
              <span style={{ color: INK, fontFamily: MONO, fontSize: 12, fontWeight: 650 }}>
                {lessonsDone} / {learnTotal} lessons
              </span>
            </div>
            <div style={{ height: 3, borderRadius: 999, background: "var(--bg-sunken)", overflow: "hidden", marginBottom: 16 }}>
              <div style={{ width: `${learnTotal ? Math.round((lessonsDone / learnTotal) * 100) : 0}%`, height: "100%", background: ACCENT, borderRadius: 999, transition: "width .4s ease" }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ color: FAINT, fontFamily: MONO, fontSize: 11 }}>
                {learnTotal ? Math.round((lessonsDone / learnTotal) * 100) : 0}%
              </span>
              <span style={{ color: ACCENT, fontFamily: SANS, fontSize: 14, fontWeight: 650, display: "inline-flex", alignItems: "center", gap: 7 }}>
                Explore the curriculum
                <ArrowSvg />
              </span>
            </div>
          </div>
        </Link>

        {/* Practice Card */}
        <Link
          href="/academy/practice"
          className="ac-card ac-practice-card"
          style={{
            display: "flex",
            flexDirection: "column",
            background: SURFACE,
            border: `1px solid ${BORDER}`,
            borderRadius: 14,
            overflow: "hidden",
            textDecoration: "none",
            minHeight: 310,
          }}
        >
          <div style={{ padding: "24px 24px 0" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
              <div>
                <div style={{ color: GOOD, fontFamily: MONO, fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 14 }}>
                  Part Two — The Desk
                </div>
                <h2 style={{ color: INK, fontFamily: DISPLAY, fontSize: 34, fontWeight: 500, margin: "0 0 12px", letterSpacing: "-0.01em" }}>
                  Practice
                </h2>
              </div>
              <DeskIllustration accent={GOOD} />
            </div>
            <p style={{ color: MUTED, fontFamily: SERIF, fontSize: 15, lineHeight: 1.62, margin: 0 }}>
              Apply every lesson. Trade the COVID crash, Nvidia&apos;s AI run, and the SVB collapse bar by bar;
              climb a boss-fight ladder toward a PM certification; write theses an AI grades section by section.
            </p>
          </div>
          <div style={{ marginTop: "auto", padding: "18px 24px", borderTop: `1px solid var(--bg-sunken)`, background: "var(--bg-surface)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <span style={{ color: FAINT, fontFamily: MONO, fontSize: 11, letterSpacing: "0.04em" }}>Rank — {rank}</span>
              <span style={{ color: INK, fontFamily: MONO, fontSize: 12, fontWeight: 650 }}>
                {drillsTotal !== null ? `${drillsDone} / ${drillsTotal} drills` : `${drillsDone} drills`}
              </span>
            </div>
            <RankTrack pct={rankPct} accent={GOOD} />
            <div style={{ marginTop: 14, display: "flex", justifyContent: "flex-end" }}>
              <span style={{ color: GOOD, fontFamily: SANS, fontSize: 14, fontWeight: 650, display: "inline-flex", alignItems: "center", gap: 7 }}>
                Start practicing
                <ArrowSvg />
              </span>
            </div>
          </div>
        </Link>
      </div>

      {/* How it fits together */}
      <div
        style={{
          background: "var(--bg-surface)",
          border: `1px solid ${BORDER}`,
          borderRadius: 12,
          padding: "20px 24px",
        }}
      >
        <div style={{ color: FAINT, fontFamily: MONO, fontSize: 10.5, letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 18 }}>
          How it fits together
        </div>
        <div className="ac-arc" style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <ArcStep n="01" icon={<BookSvg />} label="Learn" sub="Build the mental model" accent={ACCENT} />
          <ArcSep />
          <ArcStep n="02" icon={<ChartSvg />} label="Practice" sub="Run it under fire" accent={GOOD} />
          <ArcSep />
          <ArcStep n="03" icon={<SearchSvg />} label="Research" sub="The real tools" faded />
        </div>
      </div>

      <footer style={{ marginTop: 32, paddingTop: 16, borderTop: `1px solid ${RULE}`, color: FAINT, fontSize: 12, lineHeight: 1.6 }}>
        Educational material only, not financial advice. Practice uses real historical prices, each carrying a source link.{" "}
        {practice && !practice.signedIn && (
          <>
            <Link href="/login" style={{ color: ACCENT, fontWeight: 600, textDecoration: "none" }}>Sign in</Link>{" "}
            to save your progress and rank.
          </>
        )}
      </footer>
    </div>
  );
}

function BookIllustration({ accent }: { accent: string }) {
  return (
    <svg width="96" height="68" viewBox="0 0 120 88" fill="none" aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }}>
      <path d="M8 16 C8 16 54 9 54 16 L54 78 C54 78 8 72 8 72 Z"
        fill={`color-mix(in srgb, ${accent} 5%, transparent)`} stroke={`color-mix(in srgb, ${accent} 27%, transparent)`} strokeWidth="1.4" />
      <path d="M66 16 C66 16 112 9 112 16 L112 72 C112 72 66 78 66 78 Z"
        fill={`color-mix(in srgb, ${accent} 5%, transparent)`} stroke={`color-mix(in srgb, ${accent} 27%, transparent)`} strokeWidth="1.4" />
      <path d="M54 14 L66 14 L66 80 L54 80 Z" fill={`color-mix(in srgb, ${accent} 13%, transparent)`} />
      <line x1="16" y1="30" x2="48" y2="29" stroke={`color-mix(in srgb, ${accent} 16%, transparent)`} strokeWidth="1.6" />
      <line x1="16" y1="40" x2="48" y2="39" stroke={`color-mix(in srgb, ${accent} 16%, transparent)`} strokeWidth="1.6" />
      <line x1="16" y1="50" x2="48" y2="49" stroke={`color-mix(in srgb, ${accent} 16%, transparent)`} strokeWidth="1.6" />
      <line x1="16" y1="60" x2="40" y2="59" stroke={`color-mix(in srgb, ${accent} 10%, transparent)`} strokeWidth="1.6" />
      <line x1="16" y1="70" x2="45" y2="69" stroke={`color-mix(in srgb, ${accent} 10%, transparent)`} strokeWidth="1.6" />
      <line x1="72" y1="30" x2="106" y2="29" stroke={`color-mix(in srgb, ${accent} 16%, transparent)`} strokeWidth="1.6" />
      <line x1="72" y1="40" x2="106" y2="39" stroke={`color-mix(in srgb, ${accent} 16%, transparent)`} strokeWidth="1.6" />
      <line x1="72" y1="50" x2="106" y2="49" stroke={`color-mix(in srgb, ${accent} 16%, transparent)`} strokeWidth="1.6" />
      <line x1="72" y1="60" x2="96" y2="59" stroke={`color-mix(in srgb, ${accent} 10%, transparent)`} strokeWidth="1.6" />
      <line x1="72" y1="70" x2="102" y2="69" stroke={`color-mix(in srgb, ${accent} 10%, transparent)`} strokeWidth="1.6" />
    </svg>
  );
}

function DeskIllustration({ accent }: { accent: string }) {
  return (
    <svg width="110" height="68" viewBox="0 0 136 88" fill="none" aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }}>
      {/* Monitor */}
      <rect x="4" y="6" width="72" height="54" rx="4" stroke={`color-mix(in srgb, ${accent} 27%, transparent)`} strokeWidth="1.4" fill={`color-mix(in srgb, ${accent} 4%, transparent)`} />
      <line x1="40" y1="60" x2="40" y2="70" stroke={`color-mix(in srgb, ${accent} 19%, transparent)`} strokeWidth="1.4" />
      <line x1="28" y1="70" x2="52" y2="70" stroke={`color-mix(in srgb, ${accent} 19%, transparent)`} strokeWidth="1.4" />
      <text x="12" y="24" fill={`color-mix(in srgb, ${accent} 40%, transparent)`} fontSize="8" fontFamily="monospace">$_</text>
      <line x1="12" y1="34" x2="66" y2="34" stroke={`color-mix(in srgb, ${accent} 9%, transparent)`} strokeWidth="1.3" />
      <line x1="12" y1="42" x2="56" y2="42" stroke={`color-mix(in srgb, ${accent} 9%, transparent)`} strokeWidth="1.3" />
      <line x1="12" y1="50" x2="60" y2="50" stroke={`color-mix(in srgb, ${accent} 9%, transparent)`} strokeWidth="1.3" />
      {/* Keyboard */}
      <rect x="84" y="46" width="48" height="30" rx="3" stroke={`color-mix(in srgb, ${accent} 22%, transparent)`} strokeWidth="1.4" fill={`color-mix(in srgb, ${accent} 3%, transparent)`} />
      <rect x="88" y="50" width="6" height="5" rx="1" fill={`color-mix(in srgb, ${accent} 9%, transparent)`} stroke={`color-mix(in srgb, ${accent} 16%, transparent)`} strokeWidth="0.6" />
      <rect x="96" y="50" width="6" height="5" rx="1" fill={`color-mix(in srgb, ${accent} 9%, transparent)`} stroke={`color-mix(in srgb, ${accent} 16%, transparent)`} strokeWidth="0.6" />
      <rect x="104" y="50" width="6" height="5" rx="1" fill={`color-mix(in srgb, ${accent} 9%, transparent)`} stroke={`color-mix(in srgb, ${accent} 16%, transparent)`} strokeWidth="0.6" />
      <rect x="112" y="50" width="6" height="5" rx="1" fill={`color-mix(in srgb, ${accent} 9%, transparent)`} stroke={`color-mix(in srgb, ${accent} 16%, transparent)`} strokeWidth="0.6" />
      <rect x="88" y="58" width="6" height="5" rx="1" fill={`color-mix(in srgb, ${accent} 9%, transparent)`} stroke={`color-mix(in srgb, ${accent} 16%, transparent)`} strokeWidth="0.6" />
      <rect x="96" y="58" width="6" height="5" rx="1" fill={`color-mix(in srgb, ${accent} 9%, transparent)`} stroke={`color-mix(in srgb, ${accent} 16%, transparent)`} strokeWidth="0.6" />
      <rect x="104" y="58" width="6" height="5" rx="1" fill={`color-mix(in srgb, ${accent} 9%, transparent)`} stroke={`color-mix(in srgb, ${accent} 16%, transparent)`} strokeWidth="0.6" />
      <rect x="112" y="58" width="6" height="5" rx="1" fill={`color-mix(in srgb, ${accent} 9%, transparent)`} stroke={`color-mix(in srgb, ${accent} 16%, transparent)`} strokeWidth="0.6" />
      <rect x="91" y="66" width="22" height="5" rx="1" fill={`color-mix(in srgb, ${accent} 8%, transparent)`} stroke={`color-mix(in srgb, ${accent} 16%, transparent)`} strokeWidth="0.6" />
      {/* Chart lines inside monitor - small candlestick-ish */}
      <polyline points="14,26 22,16 30,20 42,11 54,18 64,13" stroke={`color-mix(in srgb, ${accent} 31%, transparent)`} strokeWidth="1.2" fill="none" />
    </svg>
  );
}

function RankTrack({ pct, accent }: { pct: number; accent: string }) {
  const SEGMENTS = 10;
  const filled = Math.round((pct / 100) * SEGMENTS);
  return (
    <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
      {Array.from({ length: SEGMENTS }).map((_, i) => (
        <div
          key={i}
          style={{
            flex: 1,
            height: 4,
            borderRadius: 2,
            background: i < filled ? accent : "var(--bg-sunken)",
            transition: "background .3s ease",
          }}
        />
      ))}
    </div>
  );
}

function ArcStep({
  n, icon, label, sub, accent, faded,
}: {
  n: string; icon: React.ReactNode; label: string; sub: string; accent?: string; faded?: boolean;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
      <div
        style={{
          width: 38,
          height: 38,
          borderRadius: 9,
          background: faded ? "var(--bg-surface)" : `color-mix(in srgb, ${accent} 7%, transparent)`,
          border: `1px solid ${faded ? "var(--border)" : `color-mix(in srgb, ${accent} 16%, transparent)`}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: faded ? FAINT : accent,
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 7 }}>
          <span style={{ color: faded ? FAINT : accent, fontFamily: MONO, fontSize: 11, fontWeight: 650 }}>{n}</span>
          <span style={{ color: faded ? MUTED : INK, fontFamily: SERIF, fontSize: 15, fontWeight: 600 }}>{label}</span>
        </div>
        <div style={{ color: FAINT, fontFamily: MONO, fontSize: 11.5, letterSpacing: "0.02em", marginTop: 3 }}>{sub}</div>
      </div>
    </div>
  );
}

function ArcSep() {
  return (
    <span style={{ color: FAINT, flexShrink: 0 }} aria-hidden="true">
      <svg width={20} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
        <line x1="4" y1="12" x2="18.5" y2="12" />
        <polyline points="12.5 6 18.5 12 12.5 18" />
      </svg>
    </span>
  );
}

function ArrowSvg() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="4" y1="12" x2="18.5" y2="12" />
      <polyline points="12.5 6 18.5 12 12.5 18" />
    </svg>
  );
}

function BookSvg() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H12v15.5H5.5A1.5 1.5 0 0 0 4 21V5.5Z" />
      <path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H12v15.5h6.5A1.5 1.5 0 0 1 20 21V5.5Z" />
    </svg>
  );
}

function ChartSvg() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4v16h16" />
      <polyline points="7 14 11 9 14 12 19 6" />
    </svg>
  );
}

function SearchSvg() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="10.5" cy="10.5" r="6.5" />
      <line x1="20.5" y1="20.5" x2="15.5" y2="15.5" />
    </svg>
  );
}
