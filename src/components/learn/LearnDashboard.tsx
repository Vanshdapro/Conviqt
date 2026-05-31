"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { TRACKS, TOTAL_LESSONS } from "@/lib/learn/curriculum";
import { levelForXp, xpIntoLevel } from "@/lib/learn/types";
import type { LearnStats, LessonModule, LessonMeta, Track } from "@/lib/learn/types";
import { LessonView } from "./LessonView";
import { ArrowRightIcon, CheckIcon, TrackIcon } from "./icons";

const BG = "#050d1a";
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

type Active = { module: LessonModule; track: Track } | null;

const DIFFICULTY_LABEL: Record<LessonMeta["difficulty"], string> = {
  core: "Core",
  advanced: "Advanced",
  mastery: "Deep dive",
};

export function LearnDashboard() {
  const [stats, setStats] = useState<LearnStats | null>(null);
  const [credits, setCredits] = useState<number | null>(null);
  const [authed, setAuthed] = useState<boolean | null>(null);
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
        if (d && typeof d.xp === "number") setStats(d as LearnStats);
        else setStats({ xp: 0, level: 1, streakDays: 0, completedLessonIds: [] });
      })
      .catch(() => setStats({ xp: 0, level: 1, streakDays: 0, completedLessonIds: [] }));
  }, [refreshCredits]);

  const completed = useMemo(() => new Set(stats?.completedLessonIds ?? []), [stats]);

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
        setError("Sign in to open lessons.");
        return;
      }
      if (res.status === 503) {
        setError("That lesson is still being prepared. Try another one for now.");
        return;
      }
      if (!res.ok) {
        setError("Could not load that lesson. Try again in a moment.");
        return;
      }

      const data = (await res.json()) as { module: LessonModule; remaining?: number };
      setActive({ module: data.module, track });
      if (typeof data.remaining === "number" && data.remaining >= 0) setCredits(data.remaining);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setError("Connection dropped. Try that lesson again.");
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
  const trackCount = TRACKS.length;
  const nextPair =
    TRACKS.flatMap((track) => track.lessons.map((lesson) => ({ track, lesson }))).find(
      ({ lesson }) => !completed.has(lesson.id),
    ) ?? (TRACKS[0]?.lessons[0] ? { track: TRACKS[0], lesson: TRACKS[0].lessons[0] } : null);

  return (
    <div style={{ fontFamily: SANS }}>
      <style>{`
        .learn-shell * { box-sizing: border-box; }
        .learn-primary, .learn-card, .learn-link { transition: border-color .16s ease, background .16s ease, transform .16s ease, opacity .16s ease; }
        .learn-primary:hover:not(:disabled), .learn-card:hover:not(:disabled) { transform: translateY(-1px); }
        .learn-card:hover:not(:disabled) { border-color: rgba(79,135,247,.28); background: rgba(232,237,248,.05); }
        .learn-card:focus-visible, .learn-primary:focus-visible, .learn-link:focus-visible { outline: 2px solid rgba(79,135,247,.65); outline-offset: 3px; }
        @media (max-width: 720px) {
          .learn-hero { grid-template-columns: 1fr !important; }
          .learn-title { font-size: 38px !important; }
          .learn-track-head { align-items: flex-start !important; }
          .learn-track-progress { margin-left: 0 !important; width: 100%; }
          .learn-card-grid { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 430px) {
          .learn-title { font-size: 34px !important; line-height: 1.1 !important; }
        }
        @media (prefers-reduced-motion: reduce) {
          .learn-primary, .learn-card, .learn-link { transition: none; }
          .learn-primary:hover:not(:disabled), .learn-card:hover:not(:disabled) { transform: none; }
        }
      `}</style>

      <div className="learn-shell">
        <header
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) 320px",
            gap: 28,
            alignItems: "end",
            marginBottom: 42,
          }}
          className="learn-hero"
        >
          <div>
            <div style={{ color: ACCENT, fontFamily: MONO, fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase", marginBottom: 18 }}>
              Conviqt Learn
            </div>
            <h1
              className="learn-title"
              style={{
                color: INK,
                fontFamily: DISPLAY,
                fontSize: 47,
                lineHeight: 1.06,
                letterSpacing: "-0.015em",
                fontWeight: 500,
                margin: "0 0 16px",
                maxWidth: 680,
              }}
            >
              Investing, without the lecture voice.
            </h1>
            <p style={{ color: MUTED, fontFamily: SERIF, fontSize: 17, lineHeight: 1.6, margin: "0 0 24px", maxWidth: 620 }}>
              Short lessons on how markets, risk, sizing, and valuation actually work. Read one,
              move a slider, answer a few questions, and get back to the product.
            </p>
            {nextPair && (
              <button
                className="learn-primary"
                onClick={() => openLesson(nextPair.lesson, nextPair.track)}
                disabled={loadingId !== null}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 9,
                  minHeight: 42,
                  border: "1px solid rgba(79,135,247,0.58)",
                  borderRadius: 8,
                  background: ACCENT,
                  color: "#04101f",
                  padding: "0 18px",
                  fontSize: 14,
                  fontWeight: 650,
                  cursor: loadingId !== null ? "wait" : "pointer",
                }}
              >
                {loadingId === nextPair.lesson.id ? "Opening..." : doneCount === 0 ? "Start learning" : "Continue"}
                {loadingId !== nextPair.lesson.id && <ArrowRightIcon size={16} />}
              </button>
            )}
          </div>

          <aside
            style={{
              background: SURFACE_SOFT,
              border: `1px solid ${BORDER}`,
              borderRadius: 8,
              padding: 18,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
              <Metric label="Level" value={String(level)} />
              <Metric label="XP" value={xp.toLocaleString()} align="right" />
            </div>
            <div style={{ height: 5, borderRadius: 999, background: "rgba(232,237,248,0.09)", overflow: "hidden", marginBottom: 16 }}>
              <div style={{ width: `${pct}%`, height: "100%", background: ACCENT, borderRadius: 999 }} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, paddingTop: 14, borderTop: `1px solid ${RULE}` }}>
              <Metric label="Lessons" value={`${doneCount}/${TOTAL_LESSONS}`} />
              <Metric label={authed === false ? "Account" : "Credits"} value={authed === false ? "Sign in" : credits === null ? "-" : credits.toLocaleString()} align="right" />
            </div>
          </aside>
        </header>

        {error && (
          <div
            role="alert"
            style={{
              marginBottom: 28,
              background: "rgba(239,68,68,0.08)",
              border: "1px solid rgba(239,68,68,0.26)",
              color: "#fca5a5",
              borderRadius: 8,
              padding: "12px 14px",
              fontSize: 14,
              display: "flex",
              gap: 14,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <span>{error}</span>
            {authed === false ? (
              <Link href="/login" style={{ color: "#fecaca", fontWeight: 650 }}>Sign in</Link>
            ) : (
              <Link href="/pricing" style={{ color: "#fecaca", fontWeight: 650 }}>Get credits</Link>
            )}
          </div>
        )}

        <div style={{ display: "grid", gap: 38 }}>
          {TRACKS.map((track) => {
            const trackDone = track.lessons.filter((l) => completed.has(l.id)).length;
            const trackPct = Math.round((trackDone / track.lessons.length) * 100);
            return (
              <section key={track.id} aria-labelledby={`${track.id}-title`}>
                <div
                  className="learn-track-head"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    marginBottom: 14,
                    flexWrap: "wrap",
                  }}
                >
                  <span
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 8,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: track.accent,
                      background: "rgba(232,237,248,0.04)",
                      border: `1px solid ${BORDER}`,
                      flexShrink: 0,
                    }}
                  >
                    <TrackIcon trackId={track.id} size={18} />
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <h2 id={`${track.id}-title`} style={{ color: INK, fontFamily: DISPLAY, fontSize: 23, margin: "0 0 5px", fontWeight: 500, letterSpacing: "-0.01em" }}>
                      {track.name}
                    </h2>
                    <p style={{ color: FAINT, fontFamily: MONO, fontSize: 11, letterSpacing: "0.04em", lineHeight: 1.45, margin: 0 }}>
                      {track.lessons.length} lessons
                    </p>
                  </div>
                  <div className="learn-track-progress" style={{ marginLeft: "auto", minWidth: 160 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", color: FAINT, fontFamily: MONO, fontSize: 11, marginBottom: 7 }}>
                      <span>{trackDone} done</span>
                      <span>{trackPct}%</span>
                    </div>
                    <div style={{ height: 4, borderRadius: 999, background: "rgba(232,237,248,0.08)", overflow: "hidden" }}>
                      <div style={{ width: `${trackPct}%`, height: "100%", background: trackDone === track.lessons.length ? GOOD : track.accent, borderRadius: 999 }} />
                    </div>
                  </div>
                </div>

                <div className="learn-card-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(238px, 1fr))", gap: 10 }}>
                  {track.lessons.map((lesson, index) => {
                    const isDone = completed.has(lesson.id);
                    const isLoading = loadingId === lesson.id;
                    return (
                      <button
                        key={lesson.id}
                        className="learn-card"
                        onClick={() => openLesson(lesson, track)}
                        disabled={loadingId !== null}
                        style={{
                          minHeight: 138,
                          textAlign: "left",
                          display: "flex",
                          flexDirection: "column",
                          justifyContent: "space-between",
                          gap: 18,
                          background: isDone ? "rgba(34,197,94,0.055)" : SURFACE,
                          border: `1px solid ${isDone ? "rgba(34,197,94,0.22)" : BORDER}`,
                          borderRadius: 8,
                          padding: 16,
                          color: INK,
                          cursor: loadingId !== null ? "wait" : "pointer",
                          opacity: loadingId !== null && !isLoading ? 0.48 : 1,
                          position: "relative",
                          overflow: "hidden",
                        }}
                      >
                        <div>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
                            <span style={{ fontFamily: MONO, color: FAINT, fontSize: 12 }}>
                              {String(index + 1).padStart(2, "0")}
                            </span>
                            {isDone ? (
                              <span style={{ color: GOOD, display: "inline-flex" }} aria-label="Completed">
                                <CheckIcon size={16} />
                              </span>
                            ) : (
                              <span style={{ color: FAINT, fontFamily: MONO, fontSize: 11 }}>
                                {DIFFICULTY_LABEL[lesson.difficulty]}
                              </span>
                            )}
                          </div>
                          <h3 style={{ color: INK, fontFamily: SERIF, fontSize: 16.5, lineHeight: 1.32, margin: 0, fontWeight: 600, letterSpacing: 0 }}>
                            {lesson.title}
                          </h3>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, color: FAINT, fontSize: 12 }}>
                          <span style={{ fontFamily: MONO, letterSpacing: "0.02em" }}>{lesson.xp} XP</span>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: isLoading ? MUTED : ACCENT }}>
                            {isLoading ? "Opening" : isDone ? "Review" : "Open"}
                            {!isLoading && <ArrowRightIcon size={13} />}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>

        <footer style={{ marginTop: 54, paddingTop: 18, borderTop: `1px solid ${RULE}`, color: FAINT, fontSize: 12, lineHeight: 1.6 }}>
          {trackCount} tracks, {TOTAL_LESSONS} lessons. Educational material only, not financial advice.
        </footer>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  align = "left",
}: {
  label: string;
  value: string;
  align?: "left" | "right";
}) {
  return (
    <div style={{ textAlign: align }}>
      <div style={{ color: FAINT, fontFamily: MONO, fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: 6 }}>{label}</div>
      <div style={{ color: INK, fontFamily: MONO, fontSize: 20, fontWeight: 650, letterSpacing: 0 }}>{value}</div>
    </div>
  );
}
