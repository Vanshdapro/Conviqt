"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeftIcon, ArrowRightIcon, PenIcon, ShieldIcon, BoltIcon, ReplayIcon, CheckIcon } from "./icons";

const SURFACE = "#071120";
const SURFACE_SOFT = "rgba(232,237,248,0.035)";
const BORDER = "rgba(232,237,248,0.09)";
const INK = "#e8edf8";
const MUTED = "#8aa0c2";
const FAINT = "#526684";
const ACCENT = "#4f87f7";
const GOOD = "#22c55e";
const BAD = "#f87171";
const CREDIT = "#e0a23b";
const MONO = "var(--font-mono), 'JetBrains Mono', monospace";
const SANS = "var(--font-sans), system-ui, sans-serif";
const DISPLAY = "var(--font-display), Georgia, 'Times New Roman', serif";
const SERIF = "var(--font-serif), Georgia, serif";

// Each section must clear this to count as a real answer (and to protect credits
// from a half-written thesis getting metered).
const MIN_SECTION_CHARS = 30;

interface ThesisSectionDef { id: string; label: string; prompt: string; placeholder: string; }
export interface PlayThesisDrill {
  id: string; kind: "thesis"; title: string; hook: string; difficulty: string;
  xp: number; tier: number; conceptTags: string[]; conceptLessonIds: string[];
  thesis: { setup: string; ticker: string | null; sections: ThesisSectionDef[] };
}

interface SectionScore { id: string; label: string; score: number; critique: string; }
type Verdict = "would_fund" | "needs_work" | "back_to_drawing_board";
interface ThesisGrade {
  overall: number; letter: string; verdict: Verdict;
  sections: SectionScore[]; strengths: string[]; gaps: string[]; rewriteHint: string;
}
interface GradeResult {
  grade: ThesisGrade; whatGoodLooksLike: string; cached: boolean;
  creditsCharged: number; creditsRemaining?: number; awardedXp?: number; stats?: unknown;
}

const VERDICT: Record<Verdict, { label: string; color: string }> = {
  would_fund: { label: "Would fund", color: GOOD },
  needs_work: { label: "Needs work", color: CREDIT },
  back_to_drawing_board: { label: "Back to the drawing board", color: BAD },
};

function scoreColor(s: number): string {
  if (s >= 70) return GOOD;
  if (s >= 45) return CREDIT;
  return BAD;
}
function sectionColor(s: number): string {
  // sections are 0-10
  if (s >= 7) return GOOD;
  if (s >= 4.5) return CREDIT;
  return BAD;
}

export function ThesisRunner({
  drill,
  onExit,
  onGraded,
}: {
  drill: PlayThesisDrill;
  onExit: () => void;
  onGraded?: (stats: unknown) => void;
}) {
  const sections = drill.thesis.sections;

  const [phase, setPhase] = useState<"setup" | "writing" | "grade">("setup");
  const [answers, setAnswers] = useState<Record<string, string>>(() =>
    Object.fromEntries(sections.map((s) => [s.id, ""])),
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCta, setErrorCta] = useState<{ href: string; label: string } | null>(null);
  const [result, setResult] = useState<GradeResult | null>(null);

  const filledCount = useMemo(
    () => sections.filter((s) => (answers[s.id] ?? "").trim().length >= MIN_SECTION_CHARS).length,
    [answers, sections],
  );
  const allFilled = filledCount === sections.length;

  function setSection(id: string, v: string) {
    setAnswers((prev) => ({ ...prev, [id]: v }));
  }

  async function submit() {
    setSubmitting(true);
    setError(null);
    setErrorCta(null);
    try {
      const submission: Record<string, string> = {};
      for (const s of sections) {
        const v = (answers[s.id] ?? "").trim();
        if (v) submission[s.id] = v;
      }
      const res = await fetch("/api/practice/grade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ drillId: drill.id, submission }),
      });

      if (res.status === 401) {
        setError("Sign in to have the desk grade your thesis and save your rank.");
        setErrorCta({ href: "/login", label: "Sign in" });
        return;
      }
      if (res.status === 402) {
        const d = (await res.json().catch(() => null)) as { needed?: number; credits?: number } | null;
        const needed = d?.needed;
        const have = d?.credits;
        setError(
          needed != null && have != null
            ? `Grading costs ${needed} credits and you have ${have}. Top up to submit.`
            : "You don't have enough credits to grade this thesis.",
        );
        setErrorCta({ href: "/pricing", label: "View pricing" });
        return;
      }
      if (res.status === 403) {
        setError("This drill is locked. Clear the earlier tier first.");
        return;
      }
      if (res.status === 502) {
        setError("The grader hit an error — your credits were refunded. Try again in a moment.");
        return;
      }
      if (res.status === 400) {
        setError("Write a bit more in each section before submitting.");
        return;
      }
      if (!res.ok) {
        setError("Couldn't grade that thesis. Try again shortly.");
        return;
      }

      const data = (await res.json()) as GradeResult;
      setResult(data);
      setPhase("grade");
      onGraded?.(data.stats);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setError("Connection dropped before grading. Your draft is safe — try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function revise() {
    setResult(null);
    setError(null);
    setErrorCta(null);
    setPhase("writing");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // ── GRADE ─────────────────────────────────────────────────────────────────────
  if (phase === "grade" && result) {
    const { grade } = result;
    const v = VERDICT[grade.verdict];
    return (
      <div style={{ fontFamily: SANS }}>
        {/* verdict header */}
        <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 26, marginBottom: 18, display: "flex", alignItems: "center", gap: 26, flexWrap: "wrap" }}>
          <div style={{ textAlign: "center", minWidth: 120 }}>
            <div style={{ fontFamily: MONO, fontSize: 46, fontWeight: 700, color: scoreColor(grade.overall), lineHeight: 1 }}>
              {grade.letter}
            </div>
            <div style={{ fontFamily: MONO, fontSize: 13, color: MUTED, marginTop: 6 }}>{grade.overall}/100</div>
          </div>
          <div style={{ flex: 1, minWidth: 240 }}>
            <div style={{ color: ACCENT, fontFamily: MONO, fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 10 }}>
              {drill.title} · Committee review
            </div>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8, color: v.color, fontFamily: SANS, fontSize: 18, fontWeight: 700, background: `${v.color}1a`, border: `1px solid ${v.color}55`, borderRadius: 100, padding: "6px 16px", marginBottom: 12 }}>
              {v.label}
            </span>
            <div>
              {result.cached ? (
                <span style={{ color: FAINT, fontFamily: MONO, fontSize: 12.5 }}>Unchanged from your last submission — no credits charged.</span>
              ) : (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                  {result.awardedXp != null && result.awardedXp > 0 && (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 7, color: GOOD, fontFamily: MONO, fontSize: 13 }}>
                      <BoltIcon size={15} /> +{result.awardedXp} XP
                    </span>
                  )}
                  <span style={{ color: FAINT, fontFamily: MONO, fontSize: 12.5 }}>
                    {result.creditsCharged} cr used{result.creditsRemaining != null ? ` · ${result.creditsRemaining} left` : ""}
                  </span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* section scores */}
        <Panel title="Section by section">
          <div style={{ display: "grid", gap: 16 }}>
            {grade.sections.map((s) => (
              <div key={s.id}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6, gap: 12 }}>
                  <span style={{ color: INK, fontFamily: SERIF, fontSize: 15, fontWeight: 600 }}>{s.label}</span>
                  <span style={{ color: sectionColor(s.score), fontFamily: MONO, fontSize: 13, fontWeight: 650 }}>{s.score}/10</span>
                </div>
                <div style={{ height: 5, borderRadius: 999, background: "rgba(232,237,248,0.08)", overflow: "hidden", marginBottom: 7 }}>
                  <div style={{ width: `${Math.max(0, Math.min(100, s.score * 10))}%`, height: "100%", background: sectionColor(s.score), borderRadius: 999 }} />
                </div>
                <p style={{ color: MUTED, fontSize: 13.5, lineHeight: 1.55, margin: 0 }}>{s.critique}</p>
              </div>
            ))}
          </div>
        </Panel>

        {/* strengths + gaps */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 18 }} className="th-sg">
          <style>{`@media (max-width: 720px){ .th-sg { grid-template-columns: 1fr !important; } }`}</style>
          <ListPanel title="What landed" items={grade.strengths} color={GOOD} empty="Nothing the committee wanted to single out yet." />
          <ListPanel title="What a PM would push back on" items={grade.gaps} color={CREDIT} empty="No major holes flagged." />
        </div>

        {/* rewrite hint */}
        <Panel title="Your one concrete next step">
          <p style={{ color: INK, fontFamily: SERIF, fontSize: 15.5, lineHeight: 1.62, margin: 0 }}>{grade.rewriteHint}</p>
        </Panel>

        {/* rubric, revealed after grading */}
        <Panel title="What a strong answer demonstrates">
          <p style={{ color: MUTED, fontSize: 14, lineHeight: 1.62, margin: 0 }}>{result.whatGoodLooksLike}</p>
        </Panel>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 6 }}>
          <button onClick={revise} style={primaryBtn(ACCENT)}>
            <ReplayIcon size={16} /> Revise &amp; resubmit
          </button>
          <Link href="/chat" style={{ ...ghostBtn(), textDecoration: "none" }}>
            Pressure-test it in Research <ArrowRightIcon size={15} />
          </Link>
          <button onClick={onExit} style={ghostBtn()}>
            <ArrowLeftIcon size={16} /> Back to the ladder
          </button>
        </div>
        <p style={{ color: FAINT, fontFamily: MONO, fontSize: 11, lineHeight: 1.6, marginTop: 18 }}>
          An identical resubmission is free — you&apos;re only charged when the thesis actually changes.
        </p>
      </div>
    );
  }

  // ── SETUP ───────────────────────────────────────────────────────────────────────
  if (phase === "setup") {
    return (
      <div style={{ fontFamily: SANS, maxWidth: 760 }}>
        <button onClick={onExit} style={backLink}><ArrowLeftIcon size={15} /> All drills</button>
        <div style={{ color: ACCENT, fontFamily: MONO, fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", margin: "20px 0 12px" }}>
          Tier {drill.tier} · {drill.difficulty} · AI-graded thesis
        </div>
        <h1 style={{ color: INK, fontFamily: DISPLAY, fontSize: 40, fontWeight: 500, letterSpacing: "-0.015em", lineHeight: 1.08, margin: "0 0 12px" }}>
          {drill.title}
        </h1>
        {drill.thesis.ticker && (
          <div style={{ color: MUTED, fontFamily: MONO, fontSize: 12.5, marginBottom: 16 }}>Re: {drill.thesis.ticker}</div>
        )}
        <p style={{ color: INK, fontFamily: SERIF, fontSize: 17, lineHeight: 1.66, margin: "0 0 24px" }}>{drill.thesis.setup}</p>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 24 }}>
          {drill.conceptTags.map((t) => (
            <span key={t} style={{ fontFamily: MONO, fontSize: 11, color: MUTED, background: SURFACE_SOFT, border: `1px solid ${BORDER}`, borderRadius: 100, padding: "5px 12px" }}>
              {t}
            </span>
          ))}
        </div>

        <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 18, marginBottom: 24 }}>
          <div style={{ color: FAINT, fontFamily: MONO, fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: 12 }}>
            You&apos;ll write {sections.length} sections
          </div>
          <div style={{ display: "grid", gap: 9 }}>
            {sections.map((s, i) => (
              <div key={s.id} style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
                <span style={{ color: ACCENT, fontFamily: MONO, fontSize: 12, fontWeight: 650, minWidth: 18 }}>{String(i + 1).padStart(2, "0")}</span>
                <span style={{ color: INK, fontFamily: SERIF, fontSize: 14.5, fontWeight: 600 }}>{s.label}</span>
              </div>
            ))}
          </div>
        </div>

        <p style={{ color: FAINT, fontFamily: MONO, fontSize: 11.5, lineHeight: 1.6, marginBottom: 22, display: "inline-flex", alignItems: "flex-start", gap: 8 }}>
          <ShieldIcon size={14} /> The desk runs a full AI committee review and grades section by section. It costs credits — an identical resubmission is free.
        </p>

        <div>
          <button onClick={() => setPhase("writing")} style={primaryBtn(ACCENT)}>
            <PenIcon size={16} /> Start writing
          </button>
        </div>
      </div>
    );
  }

  // ── WRITING ─────────────────────────────────────────────────────────────────────
  return (
    <div style={{ fontFamily: SANS }}>
      <style>{`
        .th-area { transition: border-color .15s ease; }
        .th-area:focus { border-color: rgba(79,135,247,.5) !important; }
      `}</style>

      <button onClick={onExit} style={backLink}><ArrowLeftIcon size={15} /> Exit drill</button>
      <h1 style={{ color: INK, fontFamily: DISPLAY, fontSize: 28, fontWeight: 500, margin: "12px 0 4px", letterSpacing: "-0.01em" }}>
        {drill.title}
      </h1>
      <p style={{ color: MUTED, fontFamily: SERIF, fontSize: 14.5, lineHeight: 1.55, margin: "0 0 22px", maxWidth: 720 }}>{drill.thesis.setup}</p>

      <div style={{ display: "grid", gap: 16 }}>
        {sections.map((s, i) => {
          const val = answers[s.id] ?? "";
          const ok = val.trim().length >= MIN_SECTION_CHARS;
          return (
            <section key={s.id} style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 18 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 6 }}>
                <span style={{ color: ACCENT, fontFamily: MONO, fontSize: 12, fontWeight: 650 }}>{String(i + 1).padStart(2, "0")}</span>
                <h2 style={{ color: INK, fontFamily: SERIF, fontSize: 17, fontWeight: 650, margin: 0 }}>{s.label}</h2>
                {ok && <CheckIcon size={15} style={{ color: GOOD }} />}
              </div>
              <p style={{ color: MUTED, fontSize: 13.5, lineHeight: 1.5, margin: "0 0 12px" }}>{s.prompt}</p>
              <textarea
                className="th-area"
                value={val}
                onChange={(e) => setSection(s.id, e.target.value)}
                placeholder={s.placeholder}
                rows={4}
                style={{
                  width: "100%", boxSizing: "border-box", resize: "vertical",
                  background: "rgba(232,237,248,0.04)", border: `1px solid ${BORDER}`, borderRadius: 9,
                  color: INK, fontFamily: SERIF, fontSize: 15, lineHeight: 1.6, padding: "12px 14px", outline: "none",
                }}
              />
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 6 }}>
                <span style={{ color: ok ? FAINT : "rgba(232,237,248,0.28)", fontFamily: MONO, fontSize: 10.5 }}>
                  {val.trim().length} chars{ok ? "" : ` · ${MIN_SECTION_CHARS} min`}
                </span>
              </div>
            </section>
          );
        })}
      </div>

      {error && (
        <div role="alert" style={{ marginTop: 16, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.26)", color: "#fca5a5", borderRadius: 10, padding: "12px 14px", fontSize: 13.5, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span>{error}</span>
          {errorCta && (
            <Link href={errorCta.href} style={{ color: ACCENT, fontFamily: MONO, fontSize: 12.5, fontWeight: 650, textDecoration: "none", marginLeft: "auto" }}>
              {errorCta.label} →
            </Link>
          )}
        </div>
      )}

      <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap", marginTop: 20 }}>
        <button
          onClick={submit}
          disabled={!allFilled || submitting}
          style={{ ...primaryBtn(GOOD), opacity: !allFilled || submitting ? 0.5 : 1, cursor: !allFilled ? "not-allowed" : submitting ? "wait" : "pointer" }}
        >
          <PenIcon size={16} /> {submitting ? "Grading…" : "Submit for grading"}
        </button>
        <span style={{ color: FAINT, fontFamily: MONO, fontSize: 11.5 }}>
          {filledCount} / {sections.length} sections ready · costs credits to grade
        </span>
      </div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20, marginBottom: 18 }}>
      <div style={{ color: FAINT, fontFamily: MONO, fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: 16 }}>{title}</div>
      {children}
    </section>
  );
}

function ListPanel({ title, items, color, empty }: { title: string; items: string[]; color: string; empty: string }) {
  return (
    <section style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20 }}>
      <div style={{ color: FAINT, fontFamily: MONO, fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: 14 }}>{title}</div>
      {items.length === 0 ? (
        <p style={{ color: FAINT, fontSize: 13, lineHeight: 1.5, margin: 0 }}>{empty}</p>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 10 }}>
          {items.map((it, i) => (
            <li key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <span style={{ width: 6, height: 6, borderRadius: 99, background: color, flexShrink: 0, marginTop: 7 }} />
              <span style={{ color: MUTED, fontSize: 13.5, lineHeight: 1.55 }}>{it}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function primaryBtn(color: string): React.CSSProperties {
  return {
    display: "inline-flex", alignItems: "center", gap: 8, minHeight: 46,
    border: `1px solid ${color}`, borderRadius: 9, background: color, color: "#04101f",
    padding: "0 22px", fontSize: 14.5, fontWeight: 700, fontFamily: SANS, cursor: "pointer",
  };
}
function ghostBtn(): React.CSSProperties {
  return {
    display: "inline-flex", alignItems: "center", gap: 8, minHeight: 46,
    border: `1px solid ${BORDER}`, borderRadius: 9, background: "transparent", color: MUTED,
    padding: "0 20px", fontSize: 14, fontWeight: 600, fontFamily: SANS, cursor: "pointer",
  };
}
const backLink: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "none",
  color: MUTED, fontFamily: MONO, fontSize: 12, cursor: "pointer", padding: 0,
};
