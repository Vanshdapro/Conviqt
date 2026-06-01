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

const SURFACE = "#071120";
const SURFACE_SOFT = "rgba(232,237,248,0.035)";
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

type Active = { module: LessonModule; track: Track } | null;
type Confirm =
  | { kind: "one"; lesson: CatalogLesson; track: Track; cost: number }
  | { kind: "all"; count: number; cost: number }
  | null;

const DIFFICULTY_LABEL: Record<CatalogLesson["difficulty"], string> = {
  core: "Core",
  advanced: "Advanced",
  mastery: "Deep dive",
};

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

  // Fetch a lesson module and render it. Assumes access has been confirmed.
  const fetchAndShow = useCallback(async (lesson: CatalogLesson, track: Track) => {
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
      if (res.status === 402) {
        // Race: not actually unlocked. Offer to unlock it.
        setConfirm({ kind: "one", lesson, track, cost: lessonUnlockCost(lesson.id) });
        return;
      }
      if (!res.ok) {
        setError("Could not load that lesson. Try again in a moment.");
        return;
      }
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

      if (res.status === 401) {
        setAuthed(false);
        setError("Sign in to unlock lessons.");
        setConfirm(null);
        return;
      }
      if (res.status === 402) {
        const d = (await res.json().catch(() => null)) as { credits?: number } | null;
        if (d && typeof d.credits === "number") setCredits(d.credits);
        setError("Not enough credits to unlock that. Top up to continue.");
        setConfirm(null);
        return;
      }
      if (!res.ok) {
        setError("Could not complete that unlock. Try again in a moment.");
        setConfirm(null);
        return;
      }

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
  const trackCount = TRACKS.length;
  const busy = loadingId !== null || unlocking;
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
          .learn-allbar { flex-direction: column !important; align-items: stretch !important; }
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
                disabled={busy}
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
                  cursor: busy ? "wait" : "pointer",
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

        {authed !== false && lockedPayable.length > 0 && (
          <div
            className="learn-allbar"
            style={{
              marginBottom: 30,
              background: SURFACE,
              border: `1px solid rgba(224,162,59,0.28)`,
              borderRadius: 10,
              padding: "15px 18px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 16,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 13, minWidth: 0 }}>
              <span style={{ color: CREDIT, display: "inline-flex", flexShrink: 0 }}>
                <LockIcon size={18} />
              </span>
              <div style={{ minWidth: 0 }}>
                <div style={{ color: INK, fontFamily: SERIF, fontSize: 15.5, fontWeight: 600, marginBottom: 2 }}>
                  Unlock the whole academy
                </div>
                <p style={{ margin: 0, color: MUTED, fontSize: 13, lineHeight: 1.5 }}>
                  Own all {lockedPayable.length} remaining {lockedPayable.length === 1 ? "lesson" : "lessons"} forever — {BUNDLE_RATE_PER_LESSON} credits each instead of 5.
                </p>
              </div>
            </div>
            <button
              className="learn-primary"
              onClick={() => setConfirm({ kind: "all", count: lockedPayable.length, cost: unlockAllCost })}
              disabled={busy}
              style={{
                flexShrink: 0,
                display: "inline-flex",
                alignItems: "center",
                gap: 9,
                minHeight: 40,
                border: `1px solid rgba(224,162,59,0.5)`,
                borderRadius: 8,
                background: "rgba(224,162,59,0.14)",
                color: CREDIT,
                padding: "0 16px",
                fontSize: 13.5,
                fontWeight: 650,
                fontFamily: MONO,
                cursor: busy ? "wait" : "pointer",
                whiteSpace: "nowrap",
              }}
            >
              Unlock all · {unlockAllCost} cr
            </button>
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
                    const free = FREE_LESSON_IDS.has(lesson.id);
                    const access = hasAccess(lesson.id);
                    const cost = lessonUnlockCost(lesson.id);
                    return (
                      <button
                        key={lesson.id}
                        className="learn-card"
                        onClick={() => openLesson(lesson, track)}
                        disabled={busy}
                        style={{
                          minHeight: 138,
                          textAlign: "left",
                          display: "flex",
                          flexDirection: "column",
                          justifyContent: "space-between",
                          gap: 18,
                          background: isDone ? "rgba(34,197,94,0.055)" : SURFACE,
                          border: `1px solid ${isDone ? "rgba(34,197,94,0.22)" : access ? BORDER : "rgba(224,162,59,0.2)"}`,
                          borderRadius: 8,
                          padding: 16,
                          color: INK,
                          cursor: busy ? "wait" : "pointer",
                          opacity: busy && !isLoading ? 0.48 : 1,
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
                            ) : free ? (
                              <span style={{ color: GOOD, fontFamily: MONO, fontSize: 11, letterSpacing: "0.04em" }}>Free</span>
                            ) : !access ? (
                              <span style={{ color: CREDIT, display: "inline-flex" }} aria-label="Locked">
                                <LockIcon size={14} />
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
                          {isLoading ? (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: MUTED }}>Opening</span>
                          ) : isDone ? (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: ACCENT }}>
                              Review<ArrowRightIcon size={13} />
                            </span>
                          ) : access ? (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: ACCENT }}>
                              Open<ArrowRightIcon size={13} />
                            </span>
                          ) : (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: CREDIT, fontFamily: MONO }}>
                              <LockIcon size={12} />Unlock · {cost} cr
                            </span>
                          )}
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
          {trackCount} tracks, {TOTAL_LESSONS} lessons. Pay once per lesson, keep it forever. Educational material only, not financial advice.
        </footer>
      </div>

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

function UnlockConfirm({
  confirm,
  credits,
  busy,
  onCancel,
  onConfirm,
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
        position: "fixed",
        inset: 0,
        zIndex: 50,
        background: "rgba(3,8,18,0.72)",
        backdropFilter: "blur(2px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 420,
          background: SURFACE,
          border: `1px solid ${BORDER}`,
          borderRadius: 12,
          padding: 22,
          fontFamily: SANS,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 14 }}>
          <span style={{ color: CREDIT, display: "inline-flex" }}>
            <LockIcon size={20} />
          </span>
          <div style={{ color: FAINT, fontFamily: MONO, fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase" }}>
            One-time unlock
          </div>
        </div>
        <h3 style={{ color: INK, fontFamily: DISPLAY, fontSize: 22, fontWeight: 500, margin: "0 0 8px", letterSpacing: "-0.01em" }}>
          {title}
        </h3>
        <p style={{ color: MUTED, fontSize: 14, lineHeight: 1.55, margin: "0 0 18px" }}>{body}</p>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "12px 0",
            borderTop: `1px solid ${RULE}`,
            borderBottom: `1px solid ${RULE}`,
            marginBottom: 18,
            fontFamily: MONO,
            fontSize: 13,
          }}
        >
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
            style={{
              minHeight: 40,
              border: `1px solid ${BORDER}`,
              background: "transparent",
              color: MUTED,
              borderRadius: 8,
              padding: "0 16px",
              fontSize: 13.5,
              fontWeight: 600,
              cursor: busy ? "default" : "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={busy || !enough}
            style={{
              minHeight: 40,
              border: `1px solid rgba(224,162,59,0.5)`,
              background: enough ? CREDIT : "rgba(224,162,59,0.2)",
              color: enough ? "#1c1206" : CREDIT,
              borderRadius: 8,
              padding: "0 18px",
              fontSize: 13.5,
              fontWeight: 700,
              cursor: busy || !enough ? "default" : "pointer",
              opacity: busy ? 0.7 : 1,
            }}
          >
            {busy ? "Unlocking..." : `Unlock · ${confirm.cost} cr`}
          </button>
        </div>
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
