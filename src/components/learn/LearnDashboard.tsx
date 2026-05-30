"use client";

// Conviqt Learn — the home dashboard. A disciplined, institutional skill map
// across the five tracks, a live XP/level/streak header, and on-demand lesson
// generation. Styled to Conviqt's own design system (electric-blue accent, navy
// structure, Playfair/Source Serif type) — not a candy-colored gamified app.
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
const ACCENT = "#4f87f7";
const BG = "#050d1a";
const CARD = "rgba(255,255,255,0.022)";
const CARD_BORDER = "rgba(232,237,248,0.08)";
const RULE = "#16243f";
const BORDER = `1px solid ${CARD_BORDER}`;
const SERIF = "var(--font-serif), 'Source Serif 4', Georgia, serif";
const DISPLAY = "var(--font-display), 'Playfair Display', Georgia, serif";
const MONO = "var(--font-mono), 'JetBrains Mono', monospace";

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

  return (
    <div>
      <style>{`
        .lrn-cta { transition: transform .15s ease, box-shadow .2s ease, background .2s ease; }
        .lrn-cta:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 8px 30px rgba(79,135,247,.42); }
        .lrn-cta:active:not(:disabled) { transform: translateY(0); }
        .lrn-card { transition: border-color .16s ease, background .16s ease, transform .16s ease, box-shadow .16s ease; }
        .lrn-card:hover:not(:disabled) { border-color: rgba(79,135,247,.42); background: rgba(79,135,247,.05); transform: translateY(-2px); box-shadow: 0 10px 32px rgba(5,13,26,.55); }
        .lrn-card:focus-visible { outline: 2px solid rgba(79,135,247,.6); outline-offset: 2px; }
        .lrn-card .lrn-go { opacity: 0; transform: translateX(-3px); transition: opacity .16s ease, transform .16s ease; }
        .lrn-card:hover:not(:disabled) .lrn-go { opacity: 1; transform: translateX(0); }
        @media (prefers-reduced-motion: reduce) {
          .lrn-cta, .lrn-card, .lrn-card .lrn-go { transition: none; }
          .lrn-cta:hover, .lrn-card:hover { transform: none; }
        }
      `}</style>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <header style={{ marginBottom: 44, borderBottom: `1px solid ${RULE}`, paddingBottom: 36 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", marginBottom: 20 }}>
          <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.22em", textTransform: "uppercase", color: ACCENT }}>
            Conviqt&nbsp;/&nbsp;Learn
          </span>
          <span
            style={{
              fontFamily: MONO,
              fontSize: 10,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: MUTED,
              border: `1px solid ${RULE}`,
              borderRadius: 4,
              padding: "3px 9px",
            }}
          >
            {guest ? "Preview · no account needed" : "Free to start"}
          </span>
        </div>

        <h1
          style={{
            fontFamily: DISPLAY,
            fontWeight: 500,
            fontSize: 46,
            lineHeight: 1.04,
            letterSpacing: "-0.01em",
            color: INK,
            margin: "0 0 16px",
            maxWidth: 760,
          }}
        >
          The investing masterclass an MBA skips.
        </h1>
        <p style={{ fontFamily: SERIF, fontSize: 17, color: INK_SOFT, maxWidth: 620, margin: "0 0 30px", lineHeight: 1.6 }}>
          The mental models, position-sizing math, risk frameworks, and market structure that
          professional capital actually runs on — Kelly sizing, variant perception, reverse-DCF,
          reflexivity, drawdown discipline. Each lesson is interactive and wired into the same
          institutional engine Conviqt uses to pick stocks.
        </p>

        {/* Primary CTA */}
        {firstLesson && (
          <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap", margin: "0 0 36px" }}>
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
                borderRadius: 8,
                padding: "13px 26px",
                cursor: loadingId !== null ? "wait" : "pointer",
                boxShadow: "0 4px 20px rgba(79,135,247,0.28)",
              }}
            >
              {loadingId === firstLesson.id
                ? "Building your lesson…"
                : startingOut
                  ? "Start your first lesson"
                  : "Resume where you left off"}
              {loadingId !== firstLesson.id && <ArrowRightIcon size={17} />}
            </button>
            <span style={{ fontFamily: MONO, fontSize: 12, color: MUTED, lineHeight: 1.5 }}>
              {TOTAL_LESSONS} lessons · 5 tracks · no card required
            </span>
          </div>
        )}

        {/* Stat strip */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(132px, 1fr))", gap: 1, background: RULE, border: `1px solid ${RULE}`, borderRadius: 12, overflow: "hidden" }}>
          <StatCell label="Level" value={`${level}`}>
            <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ height: 4, flex: 1, background: "rgba(232,237,248,0.08)", borderRadius: 999, overflow: "hidden" }}>
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

      {/* ── Tracks ───────────────────────────────────────────────────────── */}
      <div style={{ display: "grid", gap: 52 }}>
        {TRACKS.map((track, ti) => {
          const trackDone = track.lessons.filter((l) => completed.has(l.id)).length;
          const trackPct = Math.round((trackDone / track.lessons.length) * 100);
          return (
            <section key={track.id}>
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 6 }}>
                <span style={{ fontFamily: MONO, fontSize: 12, color: FAINT, letterSpacing: "0.06em" }}>
                  {String(ti + 1).padStart(2, "0")}
                </span>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 36,
                    height: 36,
                    borderRadius: 9,
                    background: "rgba(79,135,247,0.08)",
                    border: "1px solid rgba(79,135,247,0.2)",
                    color: ACCENT,
                  }}
                >
                  <TrackIcon trackId={track.id} size={19} />
                </span>
                <h2 style={{ fontFamily: DISPLAY, fontWeight: 500, fontSize: 25, color: INK, margin: 0, letterSpacing: "-0.01em" }}>
                  {track.name}
                </h2>
                <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 64, height: 4, background: "rgba(232,237,248,0.08)", borderRadius: 999, overflow: "hidden" }}>
                    <div style={{ width: `${trackPct}%`, height: "100%", background: ACCENT, borderRadius: 999 }} />
                  </div>
                  <span style={{ fontFamily: MONO, fontSize: 12, color: MUTED }}>
                    {trackDone}/{track.lessons.length}
                  </span>
                </div>
              </div>
              <p style={{ fontFamily: SERIF, fontSize: 14.5, color: MUTED, margin: "0 0 20px", paddingLeft: 26 }}>{track.tagline}</p>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(268px, 1fr))", gap: 14 }}>
                {track.lessons.map((lesson) => {
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
                        background: isDone ? "rgba(79,135,247,0.05)" : CARD,
                        border: isDone ? "1px solid rgba(79,135,247,0.28)" : BORDER,
                        borderRadius: 14,
                        padding: "18px 18px 15px",
                        cursor: loadingId !== null ? "wait" : "pointer",
                        opacity: loadingId !== null && !isLoading ? 0.45 : 1,
                        position: "relative",
                        minHeight: 158,
                        display: "flex",
                        flexDirection: "column",
                        color: INK,
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                        <DifficultyDots level={DIFFICULTY_LEVEL[lesson.difficulty]} label={DIFFICULTY_LABEL[lesson.difficulty]} />
                        {isDone && (
                          <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 18, height: 18, borderRadius: 999, background: "rgba(79,135,247,0.16)", color: ACCENT }}>
                            <CheckIcon size={12} />
                          </span>
                        )}
                      </div>
                      <h3 style={{ fontFamily: SERIF, margin: "0 0 6px", fontSize: 16.5, fontWeight: 600, color: INK, lineHeight: 1.3 }}>{lesson.title}</h3>
                      <p style={{ margin: "0 0 14px", fontSize: 13, color: MUTED, lineHeight: 1.55, flex: 1 }}>{lesson.hook}</p>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: `1px solid ${RULE}`, paddingTop: 11 }}>
                        <span style={{ fontFamily: MONO, fontSize: 11.5, color: ACCENT }}>+{lesson.xp} XP</span>
                        {guest ? (
                          <span className="lrn-go" style={{ color: ACCENT, display: "inline-flex" }}><ArrowRightIcon size={15} /></span>
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
                            borderRadius: 14,
                            background: "rgba(5,13,26,0.62)",
                            backdropFilter: "blur(2px)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontFamily: MONO,
                            fontSize: 12,
                            color: ACCENT,
                            letterSpacing: "0.04em",
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

      <p style={{ fontFamily: SERIF, textAlign: "center", color: FAINT, fontSize: 12.5, marginTop: 56, lineHeight: 1.6, maxWidth: 560, marginLeft: "auto", marginRight: "auto" }}>
        Conviqt Learn is financial education, not financial advice. Lessons are AI-authored to build
        understanding — always do your own research before investing real money.
      </p>
    </div>
  );
}

// ── Pieces ───────────────────────────────────────────────────────────────────

function StatCell({
  label, value, sub, valueColor = INK, children,
}: {
  label: string;
  value: string;
  sub?: string;
  valueColor?: string;
  children?: React.ReactNode;
}) {
  return (
    <div style={{ background: BG, padding: "15px 18px 16px" }}>
      <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: MUTED, marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
        <span style={{ fontFamily: MONO, fontSize: 24, fontWeight: 600, color: valueColor, letterSpacing: "-0.01em" }}>{value}</span>
        {sub && <span style={{ fontSize: 11.5, color: FAINT }}>{sub}</span>}
      </div>
      {children}
    </div>
  );
}

function DifficultyDots({ level, label }: { level: number; label: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
      <span style={{ display: "inline-flex", gap: 3 }}>
        {[1, 2, 3].map((i) => (
          <span
            key={i}
            style={{
              width: 5,
              height: 5,
              borderRadius: 999,
              background: i <= level ? ACCENT : "rgba(232,237,248,0.16)",
            }}
          />
        ))}
      </span>
      <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: MUTED }}>
        {label}
      </span>
    </span>
  );
}
