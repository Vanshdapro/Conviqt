"use client";

// Conviqt Learn — the home dashboard, composed as the cover of a private-bank
// research curriculum. A two-tier palette governs the whole surface: champagne
// gold (PRESTIGE) is a scarce resource reserved for the masthead rule, chapter
// numerals, seals and crests; electric blue (ACCENT) carries every interactive
// and semantic signal — CTAs, progress, links, XP. Editorial serif headings,
// monospace small-caps metadata, hairline rules, generous macro-whitespace.
//
// Clicking a lesson POSTs /api/learn (which authors/replays the module and, for
// real members, meters credits) and swaps the grid for the full LessonView.
// Completing a lesson's quiz updates XP here without a page reload.

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { TRACKS, TOTAL_LESSONS } from "@/lib/learn/curriculum";
import { levelForXp, xpIntoLevel } from "@/lib/learn/types";
import type { LearnStats, LessonModule, LessonMeta, Track } from "@/lib/learn/types";
import { LessonView } from "./LessonView";
import { TrackIcon, CheckIcon, ArrowRightIcon } from "./icons";

// Display-only mirror of CREDITS_PER_INTENT (credits.ts is server-only). The
// server route is the source of truth for what's actually charged.
const LEARN_COST = 14;
const LEARN_CACHED_COST = 3;

// ── Conviqt design tokens (from globals.css) ─────────────────────────────────
const INK = "#e8edf8";
const INK_SOFT = "#c4d0e6";
const MUTED = "#7a92b8";
const FAINT = "#46597d";
const ACCENT = "#4f87f7"; // electric blue — interactive + semantic only
const BG = "#050d1a";
const CARD = "rgba(255,255,255,0.022)";
const CARD_BORDER = "rgba(232,237,248,0.08)";
const RULE = "#16243f";
const BORDER = `1px solid ${CARD_BORDER}`;
const SERIF = "var(--font-serif), 'Source Serif 4', Georgia, serif";
const DISPLAY = "var(--font-display), 'Playfair Display', Georgia, serif";
const MONO = "var(--font-mono), 'JetBrains Mono', monospace";

// ── Prestige layer ───────────────────────────────────────────────────────────
// Champagne gold. Used sparingly, the way a private bank lets one metallic note
// signal provenance. Never for body text, never for interactive affordances.
const GOLD = "#c9a96a";
const GOLD_SOFT = "rgba(201,169,106,0.30)";
const GOLD_FAINT = "rgba(201,169,106,0.10)";

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];

type Active = { module: LessonModule; track: Track } | null;

const DIFFICULTY_LABEL: Record<LessonMeta["difficulty"], string> = {
  core: "Core",
  advanced: "Advanced",
  mastery: "Mastery",
};
const DIFFICULTY_LEVEL: Record<LessonMeta["difficulty"], number> = {
  core: 1,
  advanced: 2,
  mastery: 3,
};

export function LearnDashboard() {
  const [stats, setStats] = useState<LearnStats | null>(null);
  const [credits, setCredits] = useState<number | null>(null);
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [guest, setGuest] = useState<boolean>(false);
  const [active, setActive] = useState<Active>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refreshCredits = useCallback(() => {
    fetch("/api/credits")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d && typeof d.credits === "number") {
          setCredits(d.credits);
          setAuthed(true);
        } else {
          setAuthed(false);
        }
      })
      .catch(() => setAuthed(false));
  }, []);

  useEffect(() => {
    refreshCredits();
    fetch("/api/learn/progress")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d && typeof d.guest === "boolean") setGuest(d.guest);
        if (d && typeof d.xp === "number") setStats(d as LearnStats);
        else setStats({ xp: 0, level: 1, streakDays: 0, completedLessonIds: [] });
      })
      .catch(() => setStats({ xp: 0, level: 1, streakDays: 0, completedLessonIds: [] }));
  }, [refreshCredits]);

  const completed = useMemo(
    () => new Set(stats?.completedLessonIds ?? []),
    [stats],
  );

  async function openLesson(lesson: LessonMeta, track: Track) {
    if (loadingId) return;
    setError(null);
    setLoadingId(lesson.id);
    try {
      const res = await fetch("/api/learn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonId: lesson.id }),
      });

      if (res.status === 401) {
        setAuthed(false);
        setError("Sign in to start learning.");
        return;
      }
      if (res.status === 402) {
        const data = await res.json().catch(() => ({}));
        setError(`Not enough credits — this lesson costs ${data.needed ?? "?"}. Top up to keep learning.`);
        return;
      }
      if (!res.ok) {
        setError("Couldn't load that lesson. Try again in a moment.");
        return;
      }

      const data = (await res.json()) as { module: LessonModule; remaining: number; guest?: boolean };
      if (typeof data.guest === "boolean") setGuest(data.guest);
      setActive({ module: data.module, track });
      if (typeof data.remaining === "number" && data.remaining >= 0) setCredits(data.remaining);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setError("Network hiccup — try that lesson again.");
    } finally {
      setLoadingId(null);
    }
  }

  if (active) {
    return (
      <LessonView
        module={active.module}
        trackId={active.track.id}
        trackName={active.track.name}
        onBack={() => setActive(null)}
        onCompleted={(s) => setStats(s)}
      />
    );
  }

  const xp = stats?.xp ?? 0;
  const level = levelForXp(xp);
  const { into, needed } = xpIntoLevel(xp);
  const pct = Math.round((into / needed) * 100);
  const doneCount = completed.size;

  const firstTrack = TRACKS[0];
  const firstLesson = firstTrack?.lessons[0];
  const startingOut = doneCount === 0;

  const creditValue = guest ? "Open" : credits === null ? "—" : credits.toLocaleString();
  const creditSub = guest ? "preview" : authed === false ? "sign in" : "balance";

  const trackCount = TRACKS.length;

  return (
    <div>
      <style>{`
        .lrn-cta { transition: transform .18s cubic-bezier(.16,1,.3,1), box-shadow .25s ease, background .2s ease; }
        .lrn-cta:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 10px 34px rgba(79,135,247,.34); }
        .lrn-cta:active:not(:disabled) { transform: scale(.985); }
        .lrn-card { transition: border-color .2s ease, background .2s ease, transform .2s cubic-bezier(.16,1,.3,1), box-shadow .25s ease; }
        .lrn-card:hover:not(:disabled) { border-color: ${GOLD_SOFT}; background: rgba(255,255,255,.03); transform: translateY(-2px); box-shadow: 0 14px 40px rgba(5,13,26,.5); }
        .lrn-card:active:not(:disabled) { transform: translateY(0) scale(.995); }
        .lrn-card:focus-visible { outline: 1px solid ${GOLD_SOFT}; outline-offset: 3px; }
        .lrn-card .lrn-edge { transform: scaleX(0); transform-origin: left; transition: transform .25s cubic-bezier(.16,1,.3,1); }
        .lrn-card:hover:not(:disabled) .lrn-edge { transform: scaleX(1); }
        .lrn-card .lrn-go { opacity: 0; transform: translateX(-3px); transition: opacity .2s ease, transform .2s ease; }
        .lrn-card:hover:not(:disabled) .lrn-go { opacity: 1; transform: translateX(0); }
        @media (prefers-reduced-motion: reduce) {
          .lrn-cta, .lrn-card, .lrn-card .lrn-go, .lrn-card .lrn-edge { transition: none; }
          .lrn-cta:hover, .lrn-card:hover { transform: none; }
          .lrn-card .lrn-edge { transform: scaleX(1); }
        }
      `}</style>

      {/* ── Masthead ─────────────────────────────────────────────────────── */}
      <header style={{ marginBottom: 52, paddingBottom: 38, borderBottom: `1px solid ${RULE}` }}>
        {/* Publication line: wordmark left, provenance right, hairline gold rule */}
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 11 }}>
          <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.28em", textTransform: "uppercase", color: GOLD }}>
            Conviqt&nbsp;·&nbsp;Research Academy
          </span>
          <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase", color: FAINT }}>
            {guest ? "Open Enrollment" : "Member"}&nbsp;·&nbsp;Est. MMXXVI
          </span>
        </div>
        <div style={{ height: 1, background: `linear-gradient(90deg, ${GOLD_SOFT}, ${GOLD_FAINT} 42%, transparent)`, marginBottom: 30 }} />

        <h1
          style={{
            fontFamily: DISPLAY,
            fontWeight: 500,
            fontSize: 50,
            lineHeight: 1.02,
            letterSpacing: "-0.018em",
            color: INK,
            margin: "0 0 18px",
            maxWidth: 780,
          }}
        >
          The investing masterclass an MBA skips.
        </h1>
        <p style={{ fontFamily: SERIF, fontSize: 17.5, color: INK_SOFT, maxWidth: 640, margin: "0 0 32px", lineHeight: 1.62 }}>
          The mental models, position-sizing math, risk frameworks, and market structure that
          professional capital actually runs on — Kelly sizing, variant perception, reverse-DCF,
          reflexivity, drawdown discipline. Each lesson is interactive and wired into the same
          institutional engine Conviqt uses to pick stocks.
        </p>

        {/* Primary CTA */}
        {firstLesson && (
          <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap", margin: "0 0 38px" }}>
            <button
              className="lrn-cta"
              onClick={() => openLesson(firstLesson, firstTrack)}
              disabled={loadingId !== null}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 9,
                fontFamily: SERIF,
                fontSize: 14.5,
                letterSpacing: "0.01em",
                color: "#04101f",
                fontWeight: 600,
                background: ACCENT,
                border: "1px solid rgba(120,170,255,0.6)",
                borderRadius: 7,
                padding: "13px 26px",
                cursor: loadingId !== null ? "wait" : "pointer",
                boxShadow: "0 4px 20px rgba(79,135,247,0.26)",
              }}
            >
              {loadingId === firstLesson.id
                ? "Building your lesson…"
                : startingOut
                  ? "Begin the first lesson"
                  : "Resume where you left off"}
              {loadingId !== firstLesson.id && <ArrowRightIcon size={17} />}
            </button>
            <span style={{ fontFamily: MONO, fontSize: 12, color: MUTED, lineHeight: 1.5 }}>
              {TOTAL_LESSONS} lessons · {trackCount} chapters · no card required
            </span>
          </div>
        )}

        {/* Ledger — XP / level / streak readout */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(132px, 1fr))", gap: 1, background: RULE, border: `1px solid ${RULE}`, borderRadius: 10, overflow: "hidden" }}>
          <StatCell label="Level" value={`${level}`} crest>
            <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ height: 3, flex: 1, background: "rgba(232,237,248,0.08)", borderRadius: 999, overflow: "hidden" }}>
                <div style={{ width: `${pct}%`, height: "100%", background: ACCENT, borderRadius: 999, transition: "width 0.6s cubic-bezier(0.16,1,0.3,1)" }} />
              </div>
              <span style={{ fontFamily: MONO, fontSize: 10.5, color: FAINT }}>{into}/{needed}</span>
            </div>
          </StatCell>
          <StatCell label="Total XP" value={xp.toLocaleString()} />
          <StatCell label="Streak" value={`${stats?.streakDays ?? 0}`} sub={(stats?.streakDays ?? 0) === 1 ? "day" : "days"} />
          <StatCell label="Lessons" value={`${doneCount}`} sub={`of ${TOTAL_LESSONS}`} />
          <StatCell label="Credits" value={creditValue} sub={creditSub} valueColor={guest ? ACCENT : INK} />
        </div>

        {error && (
          <div
            role="alert"
            style={{
              marginTop: 18,
              background: "rgba(239,68,68,0.08)",
              border: "1px solid rgba(239,68,68,0.3)",
              color: "#fca5a5",
              borderRadius: 10,
              padding: "12px 16px",
              fontSize: 13.5,
              display: "flex",
              gap: 14,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <span>{error}</span>
            {authed === false && !guest ? (
              <Link href="/login" style={{ color: "#fca5a5", fontWeight: 600 }}>Sign in →</Link>
            ) : (
              <Link href="/pricing" style={{ color: "#fca5a5", fontWeight: 600 }}>Get credits →</Link>
            )}
          </div>
        )}
      </header>

      {/* ── Chapters ─────────────────────────────────────────────────────── */}
      <div style={{ display: "grid", gap: 60 }}>
        {TRACKS.map((track, ti) => {
          const trackDone = track.lessons.filter((l) => completed.has(l.id)).length;
          const trackPct = Math.round((trackDone / track.lessons.length) * 100);
          const trackComplete = trackDone === track.lessons.length && track.lessons.length > 0;
          return (
            <section key={track.id}>
              {/* Chapter header: roman numeral · glyph · title ··· progress */}
              <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 14, flexWrap: "wrap" }}>
                <span style={{ fontFamily: DISPLAY, fontSize: 22, fontStyle: "italic", color: GOLD, minWidth: 22, letterSpacing: "0.02em" }}>
                  {ROMAN[ti] ?? ti + 1}
                </span>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 38,
                    height: 38,
                    borderRadius: 8,
                    background: "rgba(255,255,255,0.025)",
                    border: `1px solid ${GOLD_SOFT}`,
                    color: GOLD,
                  }}
                >
                  <TrackIcon trackId={track.id} size={19} />
                </span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: "0.22em", textTransform: "uppercase", color: FAINT, marginBottom: 3 }}>
                    Chapter {ROMAN[ti] ?? ti + 1}
                  </div>
                  <h2 style={{ fontFamily: DISPLAY, fontWeight: 500, fontSize: 25, color: INK, margin: 0, letterSpacing: "-0.012em", lineHeight: 1.05 }}>
                    {track.name}
                  </h2>
                </div>
                <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 11, flexShrink: 0 }}>
                  <div style={{ width: 60, height: 3, background: "rgba(232,237,248,0.08)", borderRadius: 999, overflow: "hidden" }}>
                    <div style={{ width: `${trackPct}%`, height: "100%", background: trackComplete ? GOLD : ACCENT, borderRadius: 999, transition: "width .5s cubic-bezier(.16,1,.3,1)" }} />
                  </div>
                  <span style={{ fontFamily: MONO, fontSize: 12, color: trackComplete ? GOLD : MUTED }}>
                    {trackDone}/{track.lessons.length}
                  </span>
                </div>
              </div>
              {/* Hairline rule with tagline riding it */}
              <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 22, paddingLeft: 46 }}>
                <p style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 14.5, color: MUTED, margin: 0, minWidth: 0 }}>{track.tagline}</p>
                <div style={{ height: 1, flex: 1, minWidth: 16, background: RULE }} />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(272px, 1fr))", gap: 14 }}>
                {track.lessons.map((lesson, li) => {
                  const isDone = completed.has(lesson.id);
                  const isLoading = loadingId === lesson.id;
                  return (
                    <button
                      key={lesson.id}
                      className="lrn-card"
                      onClick={() => openLesson(lesson, track)}
                      disabled={loadingId !== null}
                      style={{
                        textAlign: "left",
                        background: CARD,
                        border: isDone ? `1px solid ${GOLD_SOFT}` : BORDER,
                        borderRadius: 12,
                        padding: "17px 18px 14px",
                        cursor: loadingId !== null ? "wait" : "pointer",
                        opacity: loadingId !== null && !isLoading ? 0.45 : 1,
                        position: "relative",
                        minHeight: 162,
                        display: "flex",
                        flexDirection: "column",
                        color: INK,
                        overflow: "hidden",
                      }}
                    >
                      {/* hover edge — gold hairline that draws in from the left */}
                      <span className="lrn-edge" style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: GOLD }} />

                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 13 }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 9 }}>
                          <span style={{ fontFamily: MONO, fontSize: 11, color: FAINT, letterSpacing: "0.06em" }}>
                            {String(li + 1).padStart(2, "0")}
                          </span>
                          <span style={{ width: 1, height: 11, background: RULE }} />
                          <DifficultyMark level={DIFFICULTY_LEVEL[lesson.difficulty]} label={DIFFICULTY_LABEL[lesson.difficulty]} />
                        </span>
                        {isDone && (
                          <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 19, height: 19, borderRadius: 999, background: GOLD_FAINT, border: `1px solid ${GOLD_SOFT}`, color: GOLD }}>
                            <CheckIcon size={12} />
                          </span>
                        )}
                      </div>
                      <h3 style={{ fontFamily: SERIF, margin: "0 0 6px", fontSize: 17, fontWeight: 600, color: INK, lineHeight: 1.28 }}>{lesson.title}</h3>
                      <p style={{ margin: "0 0 14px", fontSize: 13, color: MUTED, lineHeight: 1.55, flex: 1 }}>{lesson.hook}</p>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: `1px solid ${RULE}`, paddingTop: 11 }}>
                        <span style={{ fontFamily: MONO, fontSize: 11.5, color: ACCENT }}>+{lesson.xp} XP</span>
                        {guest ? (
                          <span className="lrn-go" style={{ color: GOLD, display: "inline-flex" }}><ArrowRightIcon size={15} /></span>
                        ) : (
                          <span style={{ fontFamily: MONO, fontSize: 11, color: FAINT }}>
                            {isDone ? `${LEARN_CACHED_COST} cr` : `${LEARN_COST} cr`}
                          </span>
                        )}
                      </div>
                      {isLoading && (
                        <div
                          style={{
                            position: "absolute",
                            inset: 0,
                            borderRadius: 12,
                            background: "rgba(5,13,26,0.66)",
                            backdropFilter: "blur(2px)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontFamily: MONO,
                            fontSize: 12,
                            color: GOLD,
                            letterSpacing: "0.06em",
                          }}
                        >
                          Authoring lesson…
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      <div style={{ marginTop: 64, paddingTop: 26, borderTop: `1px solid ${RULE}`, textAlign: "center" }}>
        <span style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: "0.26em", textTransform: "uppercase", color: GOLD }}>Conviqt Research Academy</span>
        <p style={{ fontFamily: SERIF, color: FAINT, fontSize: 12.5, marginTop: 12, lineHeight: 1.6, maxWidth: 560, marginLeft: "auto", marginRight: "auto" }}>
          Financial education, not financial advice. Lessons are AI-authored to build understanding —
          always do your own research before committing real capital.
        </p>
      </div>
    </div>
  );
}

// ── Pieces ───────────────────────────────────────────────────────────────────

function StatCell({
  label, value, sub, valueColor = INK, crest = false, children,
}: {
  label: string;
  value: string;
  sub?: string;
  valueColor?: string;
  crest?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div style={{ background: BG, padding: "15px 18px 16px" }}>
      <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", color: MUTED, marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
        <span style={{ fontFamily: crest ? DISPLAY : MONO, fontSize: crest ? 27 : 24, fontWeight: crest ? 500 : 600, color: crest ? GOLD : valueColor, letterSpacing: "-0.01em" }}>{value}</span>
        {sub && <span style={{ fontSize: 11.5, color: FAINT }}>{sub}</span>}
      </div>
      {children}
    </div>
  );
}

// Difficulty rendered as graded serifs (I / II / III) — a refined ledger mark
// rather than candy dots. Gold fill scales with tier.
function DifficultyMark({ level, label }: { level: number; label: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
      <span style={{ display: "inline-flex", gap: 2.5 }}>
        {[1, 2, 3].map((i) => (
          <span
            key={i}
            style={{
              width: 4,
              height: 9,
              borderRadius: 1,
              background: i <= level ? GOLD : "rgba(232,237,248,0.13)",
            }}
          />
        ))}
      </span>
      <span style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: "0.14em", textTransform: "uppercase", color: MUTED }}>
        {label}
      </span>
    </span>
  );
}
