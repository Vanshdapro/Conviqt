"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  TRACKS,
  TOTAL_LESSONS,
  FREE_LESSON_IDS,
  findLesson,
} from "@/lib/learn/curriculum";
import { levelForXp, xpIntoLevel } from "@/lib/learn/types";
import type { LearnStats, LessonModule, CatalogLesson, Track } from "@/lib/learn/types";
import { LessonView } from "./LessonView";
import { PaywallSheet } from "@/components/PaywallSheet";
import { ArrowRightIcon, CheckIcon, LockIcon, TrackIcon } from "./icons";

// Almanac tokens only (playbook 2.1) — the dark Learn palette died in Phase 8.
const SURFACE = "var(--bg-surface)";
const SUNKEN = "var(--bg-sunken)";
const BORDER = "var(--border)";
const RULE = "var(--border)";
const INK = "var(--text)";
const MUTED = "var(--text-2)";
const FAINT = "var(--text-muted)";
const ACCENT = "var(--accent)";
const ACCENT_WEAK = "var(--accent-weak)";
const ON_ACCENT = "var(--on-accent)";
const LABEL = "var(--font-ui)";
const SANS = "var(--font-ui)";
const DISPLAY = "var(--font-display)";
const SERIF = "var(--font-ui)";

const MINS_BY_DIFFICULTY = { core: 3, advanced: 5, mastery: 7 } as const;

// The Academy paywall copy — what the lock actually means here.
const ACADEMY_PAYWALL_TITLE = "That lesson is part of Pro";
const ACADEMY_PAYWALL_LEAD =
  "The fundamentals track is free for everyone, always. Pro opens the other tracks — all lessons, practice drills, and the leaderboard.";

type Active = { module: LessonModule; track: Track } | null;

export function LearnDashboard() {
  const [stats, setStats] = useState<LearnStats | null>(null);
  const [pro, setPro] = useState(false);
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [unlocked, setUnlocked] = useState<Set<string>>(new Set());
  const [active, setActive] = useState<Active>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [paywall, setPaywall] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Identity + plan only — the Academy gate is the subscription, never credits.
    fetch("/api/profile")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d && typeof d.email === "string") {
          setAuthed(true);
          setPro(typeof d.plan === "string" && d.plan !== "free");
        } else {
          setAuthed(false);
        }
      })
      .catch(() => setAuthed(false));

    fetch("/api/learn/progress")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d && typeof d.xp === "number") {
          setStats(d as LearnStats);
          if (Array.isArray(d.unlockedLessonIds)) setUnlocked(new Set(d.unlockedLessonIds as string[]));
        } else {
          setStats({ xp: 0, level: 1, streakDays: 0, completedLessonIds: [] });
        }
      })
      .catch(() => setStats({ xp: 0, level: 1, streakDays: 0, completedLessonIds: [] }));
  }, []);

  const completed = useMemo(() => new Set(stats?.completedLessonIds ?? []), [stats]);
  // Free fundamentals for everyone; credit-era unlocks honored forever; Pro opens all.
  const hasAccess = useCallback(
    (id: string) => pro || FREE_LESSON_IDS.has(id) || unlocked.has(id),
    [pro, unlocked],
  );

  const fetchAndShow = useCallback(async (lesson: CatalogLesson, track: Track) => {
    setLoadingId(lesson.id);
    try {
      const res = await fetch("/api/learn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonId: lesson.id }),
      });
      if (res.status === 401) { setAuthed(false); setError("Sign in to open lessons."); return; }
      if (res.status === 402) { setPaywall(true); return; }
      if (!res.ok) { setError("Could not load that lesson. Try again in a moment."); return; }
      const data = (await res.json()) as { module: LessonModule };
      setActive({ module: data.module, track });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setError("Connection dropped. Try that lesson again.");
    } finally {
      setLoadingId(null);
    }
  }, []);

  function openLesson(lesson: CatalogLesson, track: Track) {
    if (loadingId) return;
    setError(null);
    if (!hasAccess(lesson.id)) {
      setPaywall(true);
      return;
    }
    void fetchAndShow(lesson, track);
  }

  // Deep-link: /academy/learn?lesson=<id> ("Learn why →" links from Research
  // answers and the Portfolio stat sheets). Waits for progress + plan state so
  // an accessible lesson opens directly instead of bouncing off the paywall.
  const [deepLinked, setDeepLinked] = useState(false);
  useEffect(() => {
    if (deepLinked || stats === null || authed === null) return;
    const id = new URLSearchParams(window.location.search).get("lesson");
    if (!id) {
      setDeepLinked(true);
      return;
    }
    const found = findLesson(id);
    if (found) openLesson(found.lesson, found.track);
    setDeepLinked(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once when progress + plan land
  }, [deepLinked, stats, authed]);

  if (active) {
    return (
      <LessonView
        module={active.module}
        trackId={active.track.id}
        trackName={active.track.name}
        onBack={() => setActive(null)}
        onCompleted={(s) => setStats((prev) => ({ ...(prev ?? s), ...s }))}
      />
    );
  }

  const xp = stats?.xp ?? 0;
  const level = levelForXp(xp);
  const { into, needed } = xpIntoLevel(xp);
  const pct = Math.round((into / needed) * 100);
  const doneCount = completed.size;
  const busy = loadingId !== null;
  const nextPair =
    TRACKS.flatMap((track) => track.lessons.map((lesson) => ({ track, lesson }))).find(
      ({ lesson }) => !completed.has(lesson.id),
    ) ?? (TRACKS[0]?.lessons[0] ? { track: TRACKS[0], lesson: TRACKS[0].lessons[0] } : null);

  return (
    <div style={{ fontFamily: SANS }}>
      <style>{`
        .learn-tile { transition: border-color var(--motion-fast) var(--ease-out), background var(--motion-fast) var(--ease-out); }
        .learn-tile:hover:not(:disabled) { border-color: var(--border-strong) !important; background: ${SUNKEN} !important; }
        .learn-tile:focus-visible { outline: 2px solid ${ACCENT}; outline-offset: 2px; }
        .learn-primary { transition: background var(--motion-fast) var(--ease-out), transform var(--motion-fast) var(--ease-out); }
        .learn-primary:hover:not(:disabled) { background: var(--accent-hover) !important; transform: translateY(-1px); }
        @media (max-width: 820px) {
          .learn-hero { grid-template-columns: 1fr !important; }
          .learn-title { font-size: 36px !important; }
          .learn-tracks { grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)) !important; }
        }
        @media (max-width: 520px) {
          .learn-tracks { grid-template-columns: 1fr 1fr !important; }
        }
        @media (prefers-reduced-motion: reduce) {
          .learn-tile, .learn-primary { transition: none; }
          .learn-tile:hover:not(:disabled), .learn-primary:hover:not(:disabled) { transform: none; }
        }
      `}</style>

      {/* Hero header */}
      <header
        className="learn-hero"
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) 300px",
          gap: 28,
          alignItems: "start",
          marginBottom: 44,
        }}
      >
        <div>
          <div style={{ color: ACCENT, fontFamily: LABEL, fontSize: 11, fontWeight: 650, letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 18 }}>
            Conviqt Learn
          </div>
          <h1
            className="learn-title"
            style={{
              color: INK,
              fontFamily: DISPLAY,
              fontSize: 46,
              lineHeight: 1.06,
              letterSpacing: "-0.015em",
              fontWeight: 500,
              margin: "0 0 16px",
            }}
          >
            Investing, without the lecture voice.
          </h1>
          <p style={{ color: MUTED, fontFamily: SERIF, fontSize: 17, lineHeight: 1.62, margin: "0 0 26px" }}>
            Short lessons on how markets, risk, sizing, and valuation actually work. Read one,
            move a slider, answer a few questions, and get back to the product.
          </p>
          {nextPair && (
            <button
              className="learn-primary"
              onClick={() => openLesson(nextPair.lesson, nextPair.track)}
              disabled={busy}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 9,
                minHeight: 42,
                border: "1px solid transparent",
                borderRadius: "var(--radius-control)",
                background: ACCENT,
                color: ON_ACCENT,
                padding: "0 18px",
                fontSize: 14,
                fontWeight: 650,
                cursor: busy ? "wait" : "pointer",
                fontFamily: SANS,
              }}
            >
              {loadingId === nextPair.lesson.id ? "Opening…" : doneCount === 0 ? "Start learning" : "Continue"}
              {loadingId !== nextPair.lesson.id && <ArrowRightIcon size={16} />}
            </button>
          )}
        </div>

        {/* Progress + plan card */}
        <aside style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Progress card */}
          <div
            style={{
              background: SURFACE,
              border: `1px solid ${BORDER}`,
              borderRadius: "var(--radius-card)",
              boxShadow: "var(--shadow-card)",
              padding: "18px 18px 14px",
            }}
          >
            <div style={{ color: ACCENT, fontFamily: LABEL, fontSize: 10.5, fontWeight: 650, letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: 14 }}>
              Learn
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
              <span style={{ color: FAINT, fontFamily: LABEL, fontSize: 12 }}>Lessons completed</span>
              <span style={{ color: INK, fontFamily: LABEL, fontSize: 13, fontWeight: 650, fontVariantNumeric: "tabular-nums" }}>{doneCount} / {TOTAL_LESSONS}</span>
            </div>
            <div style={{ height: 4, borderRadius: "var(--radius-pill)", background: SUNKEN, overflow: "hidden", marginBottom: 14 }}>
              <div style={{ width: `${TOTAL_LESSONS ? Math.round((doneCount / TOTAL_LESSONS) * 100) : 0}%`, height: "100%", background: ACCENT, borderRadius: "var(--radius-pill)", transition: "width .4s ease" }} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, paddingTop: 12, borderTop: `1px solid ${RULE}` }}>
              <div>
                <div style={{ color: FAINT, fontFamily: LABEL, fontSize: 10.5, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 4 }}>Level</div>
                <div style={{ color: INK, fontFamily: LABEL, fontSize: 18, fontWeight: 650, fontVariantNumeric: "tabular-nums" }}>{level}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ color: FAINT, fontFamily: LABEL, fontSize: 10.5, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 4 }}>XP</div>
                <div style={{ color: INK, fontFamily: LABEL, fontSize: 18, fontWeight: 650, fontVariantNumeric: "tabular-nums" }}>{xp.toLocaleString()}</div>
              </div>
            </div>
            <div style={{ height: 3, borderRadius: "var(--radius-pill)", background: SUNKEN, overflow: "hidden", marginTop: 10 }}>
              <div style={{ width: `${pct}%`, height: "100%", background: ACCENT_WEAK, borderRadius: "var(--radius-pill)" }} />
            </div>
          </div>

          {/* Pro upsell — fundamentals are free; the rest comes with Pro. */}
          {authed !== false && !pro && (
            <div
              style={{
                background: ACCENT_WEAK,
                border: `1px solid ${BORDER}`,
                borderRadius: "var(--radius-card)",
                padding: "16px 18px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <span style={{ color: ACCENT, display: "inline-flex" }}>
                  <LockIcon size={16} />
                </span>
                <div style={{ color: INK, fontFamily: SERIF, fontSize: 14.5, fontWeight: 600 }}>
                  The full Academy comes with Pro
                </div>
              </div>
              <p style={{ margin: "0 0 14px", color: MUTED, fontSize: 12.5, lineHeight: 1.5 }}>
                Fundamentals are free, always. Pro opens every track — all {TOTAL_LESSONS} lessons.
              </p>
              <Link
                className="learn-primary"
                href="/pricing"
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  minHeight: 36,
                  border: "1px solid transparent",
                  borderRadius: "var(--radius-control)",
                  background: ACCENT,
                  color: ON_ACCENT,
                  padding: "0 14px",
                  fontSize: 13,
                  fontWeight: 650,
                  fontFamily: SANS,
                  textDecoration: "none",
                }}
              >
                Try Pro free for 7 days
              </Link>
            </div>
          )}

          {/* Sign-in nudge */}
          {authed === false && (
            <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: "var(--radius-card)", padding: "14px 16px", color: MUTED, fontSize: 13, lineHeight: 1.5 }}>
              <Link href="/login" style={{ color: "var(--link)", fontWeight: 650, textDecoration: "none" }}>Sign in</Link> to save your progress and keep lessons you open.
            </div>
          )}

        </aside>
      </header>

      {error && (
        <div
          role="alert"
          style={{
            marginBottom: 28,
            background: "var(--down-weak)",
            border: "1px solid var(--down)",
            color: "var(--down-ink)",
            borderRadius: "var(--radius-control)",
            padding: "12px 14px",
            fontSize: 14,
            display: "flex",
            gap: 14,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <span>{error}</span>
          {authed === false
            ? <Link href="/login" style={{ color: "var(--down-ink)", fontWeight: 650 }}>Sign in</Link>
            : <Link href="/pricing" style={{ color: "var(--down-ink)", fontWeight: 650 }}>See what Pro unlocks</Link>}
        </div>
      )}

      {/* Track columns grid */}
      <div
        className="learn-tracks"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(185px, 1fr))",
          gap: 10,
          alignItems: "start",
        }}
      >
        {TRACKS.map((track) => {
          const trackDone = track.lessons.filter((l) => completed.has(l.id)).length;
          const trackPct = Math.round((trackDone / track.lessons.length) * 100);
          return (
            <div key={track.id}>
              {/* Track header */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 9,
                  padding: "12px 12px 10px",
                  borderBottom: `1px solid ${RULE}`,
                  marginBottom: 6,
                }}
              >
                <span
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: "var(--radius-control)",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: ACCENT,
                    background: ACCENT_WEAK,
                    border: `1px solid ${BORDER}`,
                    flexShrink: 0,
                  }}
                >
                  <TrackIcon trackId={track.id} size={14} />
                </span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ color: INK, fontFamily: SANS, fontSize: 12.5, fontWeight: 600, lineHeight: 1.3, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                    {track.name}
                  </div>
                  <div style={{ marginTop: 4, height: 2, borderRadius: "var(--radius-pill)", background: SUNKEN, overflow: "hidden" }}>
                    <div style={{ width: `${trackPct}%`, height: "100%", background: ACCENT, borderRadius: "var(--radius-pill)" }} />
                  </div>
                </div>
              </div>

              {/* Lesson tiles */}
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {track.lessons.map((lesson) => {
                  const isDone = completed.has(lesson.id);
                  const isLoading = loadingId === lesson.id;
                  const access = hasAccess(lesson.id);
                  const mins = MINS_BY_DIFFICULTY[lesson.difficulty];

                  return (
                    <button
                      key={lesson.id}
                      className="learn-tile"
                      onClick={() => openLesson(lesson, track)}
                      disabled={busy}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
                        textAlign: "left",
                        background: isDone ? ACCENT_WEAK : SURFACE,
                        border: `1px solid ${BORDER}`,
                        borderRadius: "var(--radius-control)",
                        padding: "10px 12px",
                        cursor: busy ? "wait" : "pointer",
                        opacity: busy && !isLoading ? 0.5 : 1,
                        font: "inherit",
                      }}
                    >
                      <div style={{ color: INK, fontFamily: SERIF, fontSize: 13.5, lineHeight: 1.35, fontWeight: 550 }}>
                        {lesson.title}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: FAINT, fontFamily: LABEL, fontSize: 11 }}>
                          <ClockSvg />
                          {isLoading ? "Opening…" : `${mins} min`}
                        </span>
                        {isDone ? (
                          <span style={{ color: ACCENT, display: "inline-flex" }}><CheckIcon size={13} /></span>
                        ) : !access ? (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: FAINT, fontFamily: LABEL, fontSize: 10.5, fontWeight: 600 }}>
                            <LockIcon size={11} />Pro
                          </span>
                        ) : (
                          <span style={{ color: "var(--link)", fontFamily: LABEL, fontSize: 10.5, fontWeight: 600 }}>open</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <footer style={{ marginTop: 52, paddingTop: 16, borderTop: `1px solid ${RULE}`, color: FAINT, fontSize: 12, lineHeight: 1.6 }}>
        {TRACKS.length} tracks, {TOTAL_LESSONS} lessons. Fundamentals free for everyone; the rest comes with Pro. Educational material only, not financial advice.
      </footer>

      <PaywallSheet
        open={paywall}
        onClose={() => setPaywall(false)}
        title={ACADEMY_PAYWALL_TITLE}
        lead={ACADEMY_PAYWALL_LEAD}
      />
    </div>
  );
}

function ClockSvg() {
  return (
    <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 15.5 15.5" />
    </svg>
  );
}
