"use client";

// Conviqt Learn — the home dashboard. A gamified skill map across the five
// tracks, a live XP/level/streak header, and on-demand lesson generation.
//
// Clicking a lesson POSTs /api/learn (which meters credits + authors/replays the
// module) and swaps the grid for the full LessonView. Completing a lesson's quiz
// updates XP here without a page reload.

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { TRACKS, TOTAL_LESSONS } from "@/lib/learn/curriculum";
import { levelForXp, xpIntoLevel } from "@/lib/learn/types";

// Display-only mirror of CREDITS_PER_INTENT (credits.ts is server-only — it
// imports the Supabase admin client — so we can't import it into this client
// component). The server route is the source of truth for what's actually charged.
const LEARN_COST = 14;
const LEARN_CACHED_COST = 3;
import type { LearnStats, LessonModule, LessonMeta, Track } from "@/lib/learn/types";
import { LessonView } from "./LessonView";

const INK = "#e8edf8";
const MUTED = "rgba(232,237,248,0.55)";
const CARD = "rgba(232,237,248,0.04)";
const BORDER = "1px solid rgba(232,237,248,0.1)";

type Active = { module: LessonModule; track: Track } | null;

const DIFFICULTY_LABEL: Record<LessonMeta["difficulty"], string> = {
  starter: "Starter",
  core: "Core",
  sharp: "Sharp",
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

      const data = (await res.json()) as { module: LessonModule; remaining: number };
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
        trackName={active.track.name}
        accent={active.track.accent}
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

  return (
    <div>
      {/* Hero header */}
      <header style={{ marginBottom: 36 }}>
        <div style={{ fontSize: 12, letterSpacing: "0.18em", textTransform: "uppercase", color: "#34d399", marginBottom: 12, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span>Conviqt Learn</span>
          <span style={{ color: "#f59e0b", border: "1px solid rgba(245,158,11,0.4)", borderRadius: 100, padding: "2px 10px", letterSpacing: "0.1em" }}>
            Free to start
          </span>
        </div>
        <h1
          style={{
            fontFamily: "var(--font-display), Georgia, serif",
            fontWeight: 400,
            fontSize: 42,
            lineHeight: 1.05,
            color: INK,
            margin: "0 0 12px",
            maxWidth: 720,
          }}
        >
          From finance-curious to analyst-grade.
        </h1>
        <p style={{ fontSize: 16.5, color: MUTED, maxWidth: 620, margin: "0 0 26px", lineHeight: 1.55 }}>
          Playable lessons on budgeting, valuation, and how markets actually move — each one interactive,
          gamified, and wired into the same five-agent AI Council professionals use. Built for finance
          students and anyone serious about getting money-smart. Start free, learn by doing, level up.
        </p>

        {/* Primary conversion CTA */}
        {firstLesson && (
          <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", margin: "0 0 30px" }}>
            <button
              onClick={() => openLesson(firstLesson, firstTrack)}
              disabled={loadingId !== null}
              style={{
                fontFamily: "var(--font-serif), Georgia, serif",
                fontSize: 14,
                letterSpacing: "0.04em",
                color: "#1a1206",
                fontWeight: 700,
                background: "linear-gradient(135deg, #fcd34d 0%, #f59e0b 100%)",
                border: "1px solid rgba(252,211,77,0.65)",
                borderRadius: 100,
                padding: "14px 30px",
                cursor: loadingId !== null ? "wait" : "pointer",
                boxShadow: "0 0 30px rgba(245,158,11,0.4)",
                transition: "transform 0.15s ease, box-shadow 0.2s ease",
                whiteSpace: "nowrap",
              }}
            >
              {loadingId === firstLesson.id
                ? "Building your lesson…"
                : startingOut
                  ? "Start your first lesson free →"
                  : "Jump back in →"}
            </button>
            <span style={{ fontSize: 13, color: MUTED, lineHeight: 1.4 }}>
              {TOTAL_LESSONS} interactive lessons · no card required to begin
            </span>
          </div>
        )}

        {/* Stat strip */}
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
          <StatCard label="Level" value={`${level}`} sub={`${into}/${needed} XP`} accent="#a78bfa" big>
            <div style={{ marginTop: 10, height: 5, width: 150, background: "rgba(232,237,248,0.1)", borderRadius: 999 }}>
              <div style={{ width: `${pct}%`, height: "100%", background: "#a78bfa", borderRadius: 999, transition: "width 0.5s ease" }} />
            </div>
          </StatCard>
          <StatCard label="Total XP" value={xp.toLocaleString()} accent="#34d399" />
          <StatCard label="Streak" value={`${stats?.streakDays ?? 0}`} sub={(stats?.streakDays ?? 0) === 1 ? "day" : "days"} accent="#f59e0b" />
          <StatCard label="Lessons done" value={`${doneCount}`} sub={`of ${TOTAL_LESSONS}`} accent="#60a5fa" />
          <StatCard
            label="Credits"
            value={credits === null ? "—" : credits.toLocaleString()}
            sub={authed === false ? "sign in" : "balance"}
            accent="#e8edf8"
          />
        </div>

        {error && (
          <div
            style={{
              marginTop: 18,
              background: "rgba(248,113,113,0.1)",
              border: "1px solid rgba(248,113,113,0.35)",
              color: "#fca5a5",
              borderRadius: 12,
              padding: "12px 16px",
              fontSize: 13.5,
              display: "flex",
              gap: 14,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <span>{error}</span>
            {authed === false ? (
              <Link href="/login" style={{ color: "#fca5a5", fontWeight: 600 }}>Sign in →</Link>
            ) : (
              <Link href="/pricing" style={{ color: "#fca5a5", fontWeight: 600 }}>Get credits →</Link>
            )}
          </div>
        )}
      </header>

      {/* Tracks */}
      <div style={{ display: "grid", gap: 40 }}>
        {TRACKS.map((track) => {
          const trackDone = track.lessons.filter((l) => completed.has(l.id)).length;
          return (
            <section key={track.id}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 4 }}>
                <span style={{ fontSize: 22 }}>{track.emoji}</span>
                <h2 style={{ fontFamily: "var(--font-display), Georgia, serif", fontWeight: 400, fontSize: 24, color: INK, margin: 0 }}>
                  {track.name}
                </h2>
                <span style={{ fontFamily: "monospace", fontSize: 12, color: track.accent, marginLeft: "auto" }}>
                  {trackDone}/{track.lessons.length}
                </span>
              </div>
              <p style={{ fontSize: 14, color: MUTED, margin: "0 0 18px" }}>{track.tagline}</p>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14 }}>
                {track.lessons.map((lesson) => {
                  const isDone = completed.has(lesson.id);
                  const isLoading = loadingId === lesson.id;
                  return (
                    <button
                      key={lesson.id}
                      onClick={() => openLesson(lesson, track)}
                      disabled={loadingId !== null}
                      style={{
                        textAlign: "left",
                        background: isDone ? "rgba(52,211,153,0.06)" : CARD,
                        border: isDone ? "1px solid rgba(52,211,153,0.3)" : BORDER,
                        borderRadius: 16,
                        padding: "18px 18px 16px",
                        cursor: loadingId !== null ? "wait" : "pointer",
                        opacity: loadingId !== null && !isLoading ? 0.5 : 1,
                        transition: "all 0.18s ease",
                        position: "relative",
                        minHeight: 150,
                        display: "flex",
                        flexDirection: "column",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                        <span
                          style={{
                            fontSize: 10,
                            letterSpacing: "0.1em",
                            textTransform: "uppercase",
                            color: track.accent,
                            border: `1px solid ${track.accent}40`,
                            borderRadius: 100,
                            padding: "3px 9px",
                          }}
                        >
                          {DIFFICULTY_LABEL[lesson.difficulty]}
                        </span>
                        {isDone && <span style={{ color: "#34d399", fontSize: 15 }}>✓</span>}
                      </div>
                      <h3 style={{ margin: "0 0 6px", fontSize: 16, color: INK, lineHeight: 1.25 }}>{lesson.title}</h3>
                      <p style={{ margin: "0 0 14px", fontSize: 13, color: MUTED, lineHeight: 1.5, flex: 1 }}>{lesson.hook}</p>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontFamily: "monospace", fontSize: 11.5, color: "#34d399" }}>+{lesson.xp} XP</span>
                        <span style={{ fontFamily: "monospace", fontSize: 11, color: MUTED }}>
                          {isLoading ? "building…" : isDone ? `${LEARN_CACHED_COST} cr` : `${LEARN_COST} cr`}
                        </span>
                      </div>
                      {isLoading && (
                        <div
                          style={{
                            position: "absolute",
                            inset: 0,
                            borderRadius: 16,
                            background: "rgba(5,13,26,0.55)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 12.5,
                            color: track.accent,
                            letterSpacing: "0.04em",
                          }}
                        >
                          Authoring your lesson…
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

      <p style={{ textAlign: "center", color: MUTED, fontSize: 12, marginTop: 48, lineHeight: 1.6 }}>
        Conviqt Learn is financial education, not financial advice. Lessons are AI-generated and meant to
        build understanding — always do your own research before investing real money.
      </p>
    </div>
  );
}

function StatCard({
  label, value, sub, accent, big, children,
}: {
  label: string;
  value: string;
  sub?: string;
  accent: string;
  big?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div style={{ background: CARD, border: BORDER, borderRadius: 14, padding: "14px 18px", minWidth: 110 }}>
      <div style={{ fontSize: 10.5, letterSpacing: "0.1em", textTransform: "uppercase", color: MUTED, marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
        <span style={{ fontFamily: "monospace", fontSize: big ? 28 : 24, fontWeight: 700, color: accent }}>{value}</span>
        {sub && <span style={{ fontSize: 11.5, color: MUTED }}>{sub}</span>}
      </div>
      {children}
    </div>
  );
}
