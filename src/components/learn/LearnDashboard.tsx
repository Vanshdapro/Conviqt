"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  TRACKS,
  TOTAL_LESSONS,
  ALL_LESSON_IDS,
  FREE_LESSON_IDS,
  BUNDLE_RATE_PER_LESSON,
  lessonUnlockCost,
} from "@/lib/learn/curriculum";
import { levelForXp, xpIntoLevel } from "@/lib/learn/types";
import type { LearnStats, LessonModule, CatalogLesson, Track } from "@/lib/learn/types";
import { LessonView } from "./LessonView";
import { ArrowRightIcon, CheckIcon, LockIcon, TrackIcon } from "./icons";

const SURFACE = "#07121f";
const BORDER = "rgba(232,237,248,0.09)";
const RULE = "rgba(232,237,248,0.075)";
const INK = "#e8edf8";
const MUTED = "#8aa0c2";
const FAINT = "#526684";
const ACCENT = "#4f87f7";
const GOOD = "#22c55e";
const CREDIT = "#e0a23b";
const MONO = "var(--font-mono), 'JetBrains Mono', monospace";
const SANS = "var(--font-sans), system-ui, sans-serif";
const DISPLAY = "var(--font-display), Georgia, 'Times New Roman', serif";
const SERIF = "var(--font-serif), Georgia, serif";

const MINS_BY_DIFFICULTY = { core: 3, advanced: 5, mastery: 7 } as const;

type Active = { module: LessonModule; track: Track } | null;
type Confirm =
  | { kind: "one"; lesson: CatalogLesson; track: Track; cost: number }
  | { kind: "all"; count: number; cost: number }
  | null;

export function LearnDashboard() {
  const [stats, setStats] = useState<LearnStats | null>(null);
  const [credits, setCredits] = useState<number | null>(null);
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [unlocked, setUnlocked] = useState<Set<string>>(new Set());
  const [active, setActive] = useState<Active>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [unlocking, setUnlocking] = useState(false);
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
        if (d && typeof d.xp === "number") {
          setStats(d as LearnStats);
          if (Array.isArray(d.unlockedLessonIds)) setUnlocked(new Set(d.unlockedLessonIds as string[]));
        } else {
          setStats({ xp: 0, level: 1, streakDays: 0, completedLessonIds: [] });
        }
      })
      .catch(() => setStats({ xp: 0, level: 1, streakDays: 0, completedLessonIds: [] }));
  }, [refreshCredits]);

  const completed = useMemo(() => new Set(stats?.completedLessonIds ?? []), [stats]);
  const hasAccess = useCallback(
    (id: string) => FREE_LESSON_IDS.has(id) || unlocked.has(id),
    [unlocked],
  );

  const lockedPayable = useMemo(
    () => ALL_LESSON_IDS.filter((id) => !FREE_LESSON_IDS.has(id) && !unlocked.has(id)),
    [unlocked],
  );
  const unlockAllCost = lockedPayable.length * BUNDLE_RATE_PER_LESSON;

  const fetchAndShow = useCallback(async (lesson: CatalogLesson, track: Track) => {
    setLoadingId(lesson.id);
    try {
      const res = await fetch("/api/learn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonId: lesson.id }),
      });
      if (res.status === 401) { setAuthed(false); setError("Sign in to open lessons."); return; }
      if (res.status === 402) { setConfirm({ kind: "one", lesson, track, cost: lessonUnlockCost(lesson.id) }); return; }
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
    if (loadingId || unlocking) return;
    setError(null);
    if (!hasAccess(lesson.id)) {
      setConfirm({ kind: "one", lesson, track, cost: lessonUnlockCost(lesson.id) });
      return;
    }
    void fetchAndShow(lesson, track);
  }

  async function runUnlock() {
    if (!confirm || unlocking) return;
    setUnlocking(true);
    setError(null);
    const pending = confirm;
    try {
      const body = pending.kind === "all" ? { all: true } : { lessonId: pending.lesson.id };
      const res = await fetch("/api/learn/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.status === 401) { setAuthed(false); setError("Sign in to unlock lessons."); setConfirm(null); return; }
      if (res.status === 402) {
        setError("Not enough credits to unlock that. Top up to continue.");
        setConfirm(null);
        refreshCredits();
        return;
      }
      if (!res.ok) { setError("Could not complete that unlock. Try again in a moment."); setConfirm(null); refreshCredits(); return; }
      const data = (await res.json()) as { remaining?: number };
      if (typeof data.remaining === "number" && data.remaining >= 0) setCredits(data.remaining);
      if (pending.kind === "all") {
        setUnlocked(new Set(ALL_LESSON_IDS));
        setConfirm(null);
      } else {
        setUnlocked((prev) => new Set(prev).add(pending.lesson.id));
        setConfirm(null);
        await fetchAndShow(pending.lesson, pending.track);
      }
    } catch {
      setError("Connection dropped during unlock. Check your credits and try again.");
      setConfirm(null);
    } finally {
      setUnlocking(false);
    }
  }

  if (active) {
    return (
      <LessonView
        module={active.module}
        trackId={active.track.id}
        trackName={active.track.name}
        accent={active.track.accent}
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
  const busy = loadingId !== null || unlocking;
  const nextPair =
    TRACKS.flatMap((track) => track.lessons.map((lesson) => ({ track, lesson }))).find(
      ({ lesson }) => !completed.has(lesson.id),
    ) ?? (TRACKS[0]?.lessons[0] ? { track: TRACKS[0], lesson: TRACKS[0].lessons[0] } : null);

  return (
    <div style={{ fontFamily: SANS }}>
      <style>{`
        .learn-tile { transition: border-color .14s ease, background .14s ease; }
        .learn-tile:hover:not(:disabled) { border-color: rgba(79,135,247,.3) !important; background: rgba(232,237,248,.04) !important; }
        .learn-tile:focus-visible { outline: 2px solid rgba(79,135,247,.6); outline-offset: 2px; }
        .learn-primary { transition: opacity .14s ease, transform .12s ease; }
        .learn-primary:hover:not(:disabled) { opacity: 0.88; transform: translateY(-1px); }
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
          <div style={{ color: ACCENT, fontFamily: MONO, fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase", marginBottom: 18 }}>
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
                border: "1px solid rgba(79,135,247,0.55)",
                borderRadius: 8,
                background: ACCENT,
                color: "#04101f",
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

        {/* Progress + unlock card */}
        <aside style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Progress card */}
          <div
            style={{
              background: "rgba(232,237,248,0.03)",
              border: `1px solid ${BORDER}`,
              borderRadius: 10,
              padding: "18px 18px 14px",
            }}
          >
            <div style={{ color: ACCENT, fontFamily: MONO, fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 14 }}>
              Learn
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
              <span style={{ color: FAINT, fontFamily: MONO, fontSize: 11, letterSpacing: "0.04em" }}>Lessons completed</span>
              <span style={{ color: INK, fontFamily: MONO, fontSize: 13, fontWeight: 650 }}>{doneCount} / {TOTAL_LESSONS}</span>
            </div>
            <div style={{ height: 4, borderRadius: 999, background: "rgba(232,237,248,0.08)", overflow: "hidden", marginBottom: 14 }}>
              <div style={{ width: `${TOTAL_LESSONS ? Math.round((doneCount / TOTAL_LESSONS) * 100) : 0}%`, height: "100%", background: ACCENT, borderRadius: 999, transition: "width .4s ease" }} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, paddingTop: 12, borderTop: `1px solid ${RULE}` }}>
              <div>
                <div style={{ color: FAINT, fontFamily: MONO, fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 4 }}>Level</div>
                <div style={{ color: INK, fontFamily: MONO, fontSize: 18, fontWeight: 650 }}>{level}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ color: FAINT, fontFamily: MONO, fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 4 }}>XP</div>
                <div style={{ color: INK, fontFamily: MONO, fontSize: 18, fontWeight: 650 }}>{xp.toLocaleString()}</div>
              </div>
            </div>
            <div style={{ height: 3, borderRadius: 999, background: "rgba(232,237,248,0.07)", overflow: "hidden", marginTop: 10 }}>
              <div style={{ width: `${pct}%`, height: "100%", background: "rgba(79,135,247,0.5)", borderRadius: 999 }} />
            </div>
          </div>

          {/* Unlock whole academy */}
          {authed !== false && lockedPayable.length > 0 && (
            <div
              style={{
                background: "rgba(224,162,59,0.07)",
                border: "1px solid rgba(224,162,59,0.22)",
                borderRadius: 10,
                padding: "16px 18px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <span style={{ color: CREDIT, display: "inline-flex" }}>
                  <LockIcon size={16} />
                </span>
                <div style={{ color: INK, fontFamily: SERIF, fontSize: 14.5, fontWeight: 600 }}>
                  Unlock whole academy
                </div>
              </div>
              <p style={{ margin: "0 0 14px", color: MUTED, fontSize: 12.5, lineHeight: 1.5 }}>
                Own all {lockedPayable.length} remaining {lockedPayable.length === 1 ? "lesson" : "lessons"} forever — {BUNDLE_RATE_PER_LESSON} credits each.
              </p>
              <button
                className="learn-primary"
                onClick={() => setConfirm({ kind: "all", count: lockedPayable.length, cost: unlockAllCost })}
                disabled={busy}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  minHeight: 36,
                  border: "1px solid rgba(224,162,59,0.45)",
                  borderRadius: 7,
                  background: "rgba(224,162,59,0.14)",
                  color: CREDIT,
                  padding: "0 14px",
                  fontSize: 13,
                  fontWeight: 650,
                  fontFamily: MONO,
                  cursor: busy ? "wait" : "pointer",
                }}
              >
                Unlock all · {unlockAllCost} cr
              </button>
            </div>
          )}

          {/* Sign-in nudge */}
          {authed === false && (
            <div style={{ background: "rgba(79,135,247,0.07)", border: `1px solid rgba(79,135,247,0.2)`, borderRadius: 10, padding: "14px 16px", color: MUTED, fontSize: 13, lineHeight: 1.5 }}>
              <Link href="/login" style={{ color: ACCENT, fontWeight: 650, textDecoration: "none" }}>Sign in</Link> to save your progress and unlock lessons.
            </div>
          )}

          {/* Credits */}
          {authed === true && credits !== null && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: "rgba(232,237,248,0.025)", border: `1px solid ${BORDER}`, borderRadius: 8 }}>
              <span style={{ color: FAINT, fontFamily: MONO, fontSize: 11, letterSpacing: "0.04em" }}>Credits</span>
              <span style={{ color: INK, fontFamily: MONO, fontSize: 14, fontWeight: 650 }}>{credits.toLocaleString()}</span>
            </div>
          )}
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
          {authed === false
            ? <Link href="/login" style={{ color: "#fecaca", fontWeight: 650 }}>Sign in</Link>
            : <Link href="/pricing" style={{ color: "#fecaca", fontWeight: 650 }}>Get credits</Link>}
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
                  borderBottom: `1px solid rgba(232,237,248,0.07)`,
                  marginBottom: 6,
                }}
              >
                <span
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 6,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: track.accent,
                    background: `${track.accent}12`,
                    border: `1px solid ${track.accent}28`,
                    flexShrink: 0,
                  }}
                >
                  <TrackIcon trackId={track.id} size={14} />
                </span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ color: INK, fontFamily: SANS, fontSize: 12.5, fontWeight: 600, lineHeight: 1.3, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                    {track.name}
                  </div>
                  <div style={{ marginTop: 4, height: 2, borderRadius: 999, background: "rgba(232,237,248,0.07)", overflow: "hidden" }}>
                    <div style={{ width: `${trackPct}%`, height: "100%", background: trackDone === track.lessons.length ? GOOD : track.accent, borderRadius: 999 }} />
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
                        background: isDone ? "rgba(34,197,94,0.05)" : "rgba(232,237,248,0.025)",
                        border: `1px solid ${isDone ? "rgba(34,197,94,0.18)" : !access ? "rgba(224,162,59,0.18)" : "rgba(232,237,248,0.07)"}`,
                        borderRadius: 8,
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
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: FAINT, fontFamily: MONO, fontSize: 10.5 }}>
                          <ClockSvg />
                          {isLoading ? "Opening…" : `${mins} min`}
                        </span>
                        {isDone ? (
                          <span style={{ color: GOOD, display: "inline-flex" }}><CheckIcon size={13} /></span>
                        ) : !access ? (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: CREDIT, fontFamily: MONO, fontSize: 10 }}>
                            <LockIcon size={11} />unlock
                          </span>
                        ) : (
                          <span style={{ color: track.accent, fontFamily: MONO, fontSize: 10 }}>open</span>
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
        {TRACKS.length} tracks, {TOTAL_LESSONS} lessons. Pay once per lesson, keep it forever. Educational material only, not financial advice.
      </footer>

      {confirm && (
        <UnlockConfirm
          confirm={confirm}
          credits={credits}
          busy={unlocking}
          onCancel={() => { if (!unlocking) setConfirm(null); }}
          onConfirm={runUnlock}
        />
      )}
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

function UnlockConfirm({
  confirm, credits, busy, onCancel, onConfirm,
}: {
  confirm: NonNullable<Confirm>;
  credits: number | null;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const enough = credits === null || credits >= confirm.cost;
  const title = confirm.kind === "all" ? "Unlock everything" : confirm.lesson.title;
  const body =
    confirm.kind === "all"
      ? `Unlock all ${confirm.count} remaining lessons forever for ${confirm.cost} credits.`
      : `Unlock this lesson forever for ${confirm.cost} credits. You'll never pay for it again.`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Unlock ${title}`}
      onClick={onCancel}
      style={{
        position: "fixed", inset: 0, zIndex: 50,
        background: "rgba(3,8,18,0.72)", backdropFilter: "blur(2px)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 420,
          background: "#07121f", border: `1px solid rgba(232,237,248,0.09)`,
          borderRadius: 12, padding: 22, fontFamily: SANS,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 14 }}>
          <span style={{ color: CREDIT, display: "inline-flex" }}><LockIcon size={20} /></span>
          <div style={{ color: FAINT, fontFamily: MONO, fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase" }}>
            One-time unlock
          </div>
        </div>
        <h3 style={{ color: INK, fontFamily: DISPLAY, fontSize: 22, fontWeight: 500, margin: "0 0 8px", letterSpacing: "-0.01em" }}>
          {title}
        </h3>
        <p style={{ color: MUTED, fontSize: 14, lineHeight: 1.55, margin: "0 0 18px" }}>{body}</p>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderTop: `1px solid ${RULE}`, borderBottom: `1px solid ${RULE}`, marginBottom: 18, fontFamily: MONO, fontSize: 13 }}>
          <span style={{ color: MUTED }}>Cost</span>
          <span style={{ color: INK, fontWeight: 650 }}>{confirm.cost} credits</span>
        </div>
        {!enough && (
          <p style={{ color: "#fca5a5", fontSize: 13, lineHeight: 1.5, margin: "0 0 16px" }}>
            You have {credits} credits. <Link href="/pricing" style={{ color: "#fecaca", fontWeight: 650 }}>Get more</Link> to unlock this.
          </p>
        )}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button
            onClick={onCancel}
            disabled={busy}
            style={{ minHeight: 40, border: `1px solid rgba(232,237,248,0.09)`, background: "transparent", color: MUTED, borderRadius: 8, padding: "0 16px", fontSize: 13.5, fontWeight: 600, cursor: busy ? "default" : "pointer", fontFamily: SANS }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={busy || !enough}
            style={{ minHeight: 40, border: `1px solid rgba(224,162,59,0.5)`, background: enough ? CREDIT : "rgba(224,162,59,0.2)", color: enough ? "#1c1206" : CREDIT, borderRadius: 8, padding: "0 18px", fontSize: 13.5, fontWeight: 700, cursor: busy || !enough ? "default" : "pointer", opacity: busy ? 0.7 : 1, fontFamily: SANS }}
          >
            {busy ? "Unlocking…" : `Unlock · ${confirm.cost} cr`}
          </button>
        </div>
      </div>
    </div>
  );
}
