"use client";

// The Research surface (playbook 2.2, Phase 3) — the home of the app.
//
// Home state: greeting by first name, "What do you want to look into?" input,
// Council/Flash mode toggle, two featured skill cards + a Skills button that
// opens the Skill Library sheet. Picking a skill arms a guided input
// (Face-Off asks for two tickers, Starter Portfolio asks budget + goals, …).
//
// Answer state: streaming progress in plain English, then the verdict header
// card (ticker, live price, plain verdict line, "How sure"), plain-English
// sections, "Learn why →" Academy links, related skills, and a collapsed
// Sources accordion. No machinery words anywhere (CLAUDE.md copy rules).

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { Card, ModeToggle, SkeletonText } from "@/components/ui";
import {
  FEATURED_SKILL_IDS,
  getSkill,
  SKILLS,
  type Skill,
} from "@/lib/skills";
import { SECTOR_BASKETS } from "@/lib/agents/sectors";
import type { Quote } from "@/lib/marketdata/types";
import type {
  CouncilResult,
  FocusedResult,
  CompareResult,
  SectorResult,
} from "@/lib/agents/types";
import type { HeadlineResult } from "@/lib/agents/headline";
import type { AllocatorResult, Goal, RiskTolerance } from "@/lib/allocator/types";
import type { PortfolioAuditResult } from "@/lib/portfolio/types";
import { SkillLibrarySheet, SkillIcon } from "./SkillLibrarySheet";
import { PaywallSheet } from "@/components/PaywallSheet";
import {
  CouncilAnswer,
  FocusedAnswer,
  CompareAnswer,
  SectorAnswer,
  HeadlineAnswer,
  AllocatorAnswer,
  AuditAnswer,
  TextAnswer,
  type QuoteMap,
} from "./answers";

// ── Run state ────────────────────────────────────────────────────────────────

type Outcome =
  | { kind: "council"; result: CouncilResult }
  | { kind: "focused"; result: FocusedResult }
  | { kind: "compare"; result: CompareResult }
  | { kind: "sector"; result: SectorResult }
  | { kind: "headline"; result: HeadlineResult }
  | { kind: "allocator"; result: AllocatorResult }
  | { kind: "audit"; result: PortfolioAuditResult }
  | { kind: "text"; text: string };

type TickerStageState = "pending" | "working" | "done" | "failed";

interface ProgressState {
  done: string[];
  active: string | null;
  tickerStages: Array<{ ticker: string; label: string; state: TickerStageState }>;
}

type Phase =
  | { name: "home" }
  | { name: "running"; asked: string; skillId: string | null; progress: ProgressState }
  | { name: "done"; asked: string; skillId: string | null; outcome: Outcome }
  | {
      name: "error";
      asked: string;
      skillId: string | null;
      message: string;
      code: "auth" | "limit" | "other";
    };

const TICKER_RE = /^[A-Z]{1,5}(\.[A-Z])?$/;

// ── Small helpers ────────────────────────────────────────────────────────────

function greetingFor(hour: number): string {
  if (hour < 5) return "Up late";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

const COMPARE_STAGE_LABEL: Record<string, string> = {
  queued: "waiting",
  sweeping: "reading the latest",
  specialists: "analysts at work",
  judging: "writing the verdict",
  done: "done",
};

const SECTOR_STAGE_LABEL: Record<string, string> = {
  queued: "waiting",
  sweeping: "reading the latest",
  scoring: "scoring",
  done: "done",
  failed: "couldn't score",
};

// ── Component ────────────────────────────────────────────────────────────────

export function ResearchSurface({ firstName }: { firstName: string | null }) {
  const [mode, setMode] = useState<"council" | "flash">("council");
  const [input, setInput] = useState("");
  const [libraryOpen, setLibraryOpen] = useState(false);
  // Soft paywall (Phase 7): opens when the month's included deep analyses run out.
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [armedSkill, setArmedSkill] = useState<Skill | null>(null);
  const [phase, setPhase] = useState<Phase>({ name: "home" });
  const [quotes, setQuotes] = useState<QuoteMap>({});

  // Guided-input state (only the armed skill's slice is used).
  const [gTicker, setGTicker] = useState("");
  const [gTickerB, setGTickerB] = useState("");
  const [gSector, setGSector] = useState("");
  const [gHeadline, setGHeadline] = useState("");

  const abortRef = useRef<AbortController | null>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);

  // Prefill from the URL: ?q= (free text), ?skill= (+ ticker/tickerA/tickerB/
  // headline). Read via window.location to keep this a plain client effect.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const q = params.get("q");
    if (q) setInput(q.slice(0, 300));
    const skillId = params.get("skill");
    if (skillId) {
      const skill = getSkill(skillId);
      if (skill) {
        setArmedSkill(skill);
        const t = (params.get("ticker") ?? params.get("tickerA") ?? "").toUpperCase();
        if (t) setGTicker(t);
        const tb = (params.get("tickerB") ?? "").toUpperCase();
        if (tb) setGTickerB(tb);
        const h = params.get("headline");
        if (h) setGHeadline(h.slice(0, 300));
      }
    }
  }, []);

  useEffect(() => () => abortRef.current?.abort(), []);

  const arm = useCallback((skill: Skill) => {
    setLibraryOpen(false);
    setArmedSkill(skill);
    setPhase({ name: "home" });
    surfaceRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const disarm = useCallback(() => setArmedSkill(null), []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setPhase({ name: "home" });
    setQuotes({});
  }, []);

  // ── Stream consumption ─────────────────────────────────────────────────────

  const runStream = useCallback(
    async (args: {
      asked: string;
      skillId: string | null;
      url: string;
      body: unknown;
      firstStage: string;
    }) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setQuotes({});
      let progress: ProgressState = { done: [], active: args.firstStage, tickerStages: [] };
      const pushProgress = () =>
        setPhase({ name: "running", asked: args.asked, skillId: args.skillId, progress: { ...progress, done: [...progress.done], tickerStages: [...progress.tickerStages] } });
      const advance = (label: string) => {
        if (progress.active && progress.active !== label) progress.done.push(progress.active);
        progress.active = label;
        pushProgress();
      };
      const setStage = (ticker: string, label: string, state: TickerStageState) => {
        const i = progress.tickerStages.findIndex((s) => s.ticker === ticker);
        if (i >= 0) progress.tickerStages[i] = { ticker, label, state };
        else progress.tickerStages.push({ ticker, label, state });
        pushProgress();
      };
      pushProgress();
      window.scrollTo({ top: 0, behavior: "smooth" });

      const fail = (message: string, code: "auth" | "limit" | "other") =>
        setPhase({ name: "error", asked: args.asked, skillId: args.skillId, message, code });
      const finish = (outcome: Outcome) =>
        setPhase({ name: "done", asked: args.asked, skillId: args.skillId, outcome });

      let specialistsDone = 0;
      let auditChecksDone = 0;
      let outcome: Outcome | null = null;

      try {
        const res = await fetch(args.url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(args.body),
          signal: controller.signal,
        });

        const contentType = res.headers.get("Content-Type") ?? "";
        if (!contentType.includes("ndjson")) {
          const data = await res.json().catch(() => null);
          const msg: string = data?.error ?? "Something went wrong. Try again in a moment.";
          if (res.status === 401) return fail("Sign in to start researching.", "auth");
          if (res.status === 402) {
            setPaywallOpen(true);
            return fail(msg, "limit");
          }
          if (data?.type === "text" && typeof data.text === "string") {
            return finish({ kind: "text", text: data.text });
          }
          return fail(msg, "other");
        }

        if (!res.body) return fail("The connection dropped. Try again.", "other");

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let nl: number;
          while ((nl = buffer.indexOf("\n")) >= 0) {
            const line = buffer.slice(0, nl).trim();
            buffer = buffer.slice(nl + 1);
            if (!line) continue;
            let ev: Record<string, unknown>;
            try {
              ev = JSON.parse(line);
            } catch {
              continue;
            }

            switch (ev.type) {
              case "quote": {
                const t = ev.ticker as string;
                setQuotes((prev) => ({ ...prev, [t]: (ev.quote as Quote | null) ?? null }));
                break;
              }
              case "council": {
                const e = ev.event as { kind: string; agent?: unknown };
                if (e.kind === "sweep_done") advance("Four analysts are weighing the facts…");
                if (e.kind === "specialist_done") {
                  specialistsDone += 1;
                  if (specialistsDone >= 4) advance("Writing the verdict…");
                  else advance(`Analysts weighing in… (${specialistsDone} of 4 done)`);
                }
                break;
              }
              case "focused": {
                const e = ev.event as { kind: string };
                if (e.kind === "sweep_done") advance("Writing the answer…");
                break;
              }
              case "compare": {
                const e = ev.event as {
                  kind: string;
                  side?: "a" | "b";
                  ticker?: string;
                  stage?: string;
                };
                if (e.kind === "side_update" && e.ticker && e.stage) {
                  setStage(
                    e.ticker,
                    COMPARE_STAGE_LABEL[e.stage] ?? e.stage,
                    e.stage === "done" ? "done" : "working"
                  );
                }
                if (e.kind === "comparing") advance("Weighing the two head-to-head…");
                break;
              }
              case "sector": {
                const e = ev.event as { kind: string; ticker?: string; stage?: string; tickers?: string[] };
                if (e.kind === "start" && Array.isArray(e.tickers)) {
                  for (const t of e.tickers) setStage(t, "waiting", "pending");
                }
                if (e.kind === "ticker_update" && e.ticker && e.stage) {
                  setStage(
                    e.ticker,
                    SECTOR_STAGE_LABEL[e.stage] ?? e.stage,
                    e.stage === "done" ? "done" : e.stage === "failed" ? "failed" : "working"
                  );
                }
                if (e.kind === "synthesizing") advance("Pulling the theme together…");
                break;
              }
              case "allocator": {
                const e = ev.event as { kind: string };
                if (e.kind === "baseline_done") advance("Sketching the baseline mix…");
                if (e.kind === "sweep_done") advance("Checking live data on each building block…");
                if (e.kind === "judge_done") advance("Writing up your plan…");
                break;
              }
              case "audit": {
                const e = ev.event as { kind: string };
                if (e.kind === "sweep_done") advance("Running five risk checks…");
                if (e.kind === "agent_done") {
                  auditChecksDone += 1;
                  if (auditChecksDone >= 5) advance("Writing the verdict…");
                  else advance(`Risk checks underway… (${auditChecksDone} of 5 done)`);
                }
                break;
              }
              case "text_chunk":
                break; // general answers render when complete
              case "council_done":
                outcome = { kind: "council", result: ev.result as CouncilResult };
                break;
              case "focused_done":
                outcome = { kind: "focused", result: ev.result as FocusedResult };
                break;
              case "compare_done":
                outcome = { kind: "compare", result: ev.result as CompareResult };
                break;
              case "sector_done":
                outcome = { kind: "sector", result: ev.result as SectorResult };
                break;
              case "headline_done":
                outcome = { kind: "headline", result: ev.result as HeadlineResult };
                break;
              case "allocator_done":
                outcome = { kind: "allocator", result: ev.result as AllocatorResult };
                break;
              case "audit_done":
                outcome = { kind: "audit", result: ev.result as PortfolioAuditResult };
                break;
              case "text":
                outcome = { kind: "text", text: ev.text as string };
                break;
              case "error":
                return fail(
                  (ev.error as string) || "Something went wrong. Try again in a moment.",
                  "other"
                );
              default:
                break;
            }
          }
        }

        if (outcome) finish(outcome);
        else fail("The run ended without an answer. Try again in a moment.", "other");
      } catch (err) {
        if ((err as Error)?.name === "AbortError") return;
        console.error("[research] stream failed:", err);
        fail("The connection dropped mid-run. Try again in a moment.", "other");
      }
    },
    []
  );

  // ── Submission paths ───────────────────────────────────────────────────────

  const submitFreeText = useCallback(
    (e?: FormEvent) => {
      e?.preventDefault();
      const text = input.trim();
      if (!text) return;
      void runStream({
        asked: text,
        skillId: null,
        url: "/api/chat",
        body: { messages: [{ role: "user", content: text }], mode },
        firstStage: mode === "flash" ? "On it — the fast read…" : "On it…",
      });
    },
    [input, mode, runStream]
  );

  const runChatSkill = useCallback(
    (skill: Skill, params: Record<string, string>, asked: string) => {
      void runStream({
        asked,
        skillId: skill.id,
        url: "/api/chat",
        body: { skill: skill.id, params, messages: [{ role: "user", content: asked }], mode },
        firstStage: "Reading the latest…",
      });
    },
    [mode, runStream]
  );

  const runAllocatorSkill = useCallback(
    (profile: Record<string, unknown>, asked: string) => {
      void runStream({
        asked,
        skillId: "starter-portfolio",
        url: "/api/allocator",
        body: profile,
        firstStage: "Sizing up your profile…",
      });
    },
    [runStream]
  );

  const runAuditSkill = useCallback(
    (holdings: Array<{ ticker: string; shares: number }>, asked: string) => {
      void runStream({
        asked,
        skillId: "portfolio-health-check",
        url: "/api/portfolio/audit",
        body: { name: "My portfolio", holdings },
        firstStage: "Pricing your holdings…",
      });
    },
    [runStream]
  );

  // ── Render ─────────────────────────────────────────────────────────────────

  const featured = FEATURED_SKILL_IDS.map((id) => getSkill(id)).filter(
    (s): s is Skill => s !== null
  );

  return (
    <div className="cvq-research" ref={surfaceRef}>
      {phase.name === "home" && (
        <>
          <p className="cvq-greeting" suppressHydrationWarning>
            {greetingFor(new Date().getHours())}
            {firstName ? `, ${firstName}` : ""}.
          </p>

          <form className="cvq-ask" onSubmit={submitFreeText}>
            <input
              type="text"
              className="cvq-ask-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="What do you want to look into?"
              aria-label="What do you want to look into?"
              maxLength={300}
              autoComplete="off"
            />
            <button
              type="submit"
              className="cvq-btn cvq-btn--primary cvq-ask-go"
              disabled={!input.trim()}
              aria-label="Run research"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </form>

          <div className="cvq-ask-meta">
            <ModeToggle value={mode} onChange={setMode} ariaLabel="Research depth" />
            <span className="cvq-mode-hint">
              {mode === "council"
                ? "Deep dive — a full team weighs in. About a minute."
                : "Flash — the fast take. About 20 seconds."}
            </span>
          </div>

          {armedSkill ? (
            <GuidedInput
              skill={armedSkill}
              onCancel={disarm}
              gTicker={gTicker}
              setGTicker={setGTicker}
              gTickerB={gTickerB}
              setGTickerB={setGTickerB}
              gSector={gSector}
              setGSector={setGSector}
              gHeadline={gHeadline}
              setGHeadline={setGHeadline}
              runChatSkill={runChatSkill}
              runAllocatorSkill={runAllocatorSkill}
              runAuditSkill={runAuditSkill}
            />
          ) : (
            <div className="cvq-featured">
              {featured.map((skill) => (
                <button
                  key={skill.id}
                  type="button"
                  className="cvq-card cvq-card--interactive cvq-featured-card"
                  onClick={() => arm(skill)}
                >
                  <SkillIcon id={skill.id} />
                  <span className="cvq-skill-name">{skill.name}</span>
                  <span className="cvq-skill-oneliner">{skill.oneLiner}</span>
                  <span className="cvq-featured-speed">{skill.speedLabel}</span>
                </button>
              ))}
              <button
                type="button"
                className="cvq-card cvq-card--interactive cvq-featured-card cvq-featured-card--all"
                onClick={() => setLibraryOpen(true)}
                data-tour="skills"
              >
                <span className="cvq-skill-ico" aria-hidden>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <rect x="3.5" y="3.5" width="7" height="7" rx="1.6" stroke="currentColor" strokeWidth="1.6" />
                    <rect x="13.5" y="3.5" width="7" height="7" rx="1.6" stroke="currentColor" strokeWidth="1.6" />
                    <rect x="3.5" y="13.5" width="7" height="7" rx="1.6" stroke="currentColor" strokeWidth="1.6" />
                    <path d="M17 14v6M14 17h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                  </svg>
                </span>
                <span className="cvq-skill-name">Skills</span>
                <span className="cvq-skill-oneliner">All {SKILLS.length} ways to dig in</span>
                <span className="cvq-featured-speed">Browse the library</span>
              </button>
            </div>
          )}
        </>
      )}

      {phase.name !== "home" && (
        <div className="cvq-runbar">
          <button type="button" className="cvq-btn cvq-btn--ghost" onClick={reset}>
            ← Ask something new
          </button>
          <span className="cvq-runbar-asked">{phase.asked}</span>
        </div>
      )}

      {phase.name === "running" && <ProgressCard progress={phase.progress} />}

      {phase.name === "error" && (
        <Card padding="lg" className="cvq-errorcard">
          {phase.code === "auth" && (
            <>
              <h3 className="cvq-section-title">Sign in to start researching</h3>
              <p>Your research history and plan live with your account.</p>
              <Link href="/login" className="cvq-btn cvq-btn--primary">
                Sign in
              </Link>
            </>
          )}
          {phase.code === "limit" && (
            <>
              <h3 className="cvq-section-title">You&apos;ve hit this month&apos;s limit</h3>
              <p>{phase.message}</p>
              <Link href="/pricing" className="cvq-btn cvq-btn--primary">
                See what Pro unlocks
              </Link>
            </>
          )}
          {phase.code === "other" && (
            <>
              <h3 className="cvq-section-title">That didn&apos;t work</h3>
              <p>{phase.message}</p>
              <button type="button" className="cvq-btn cvq-btn--secondary" onClick={reset}>
                Try again
              </button>
            </>
          )}
        </Card>
      )}

      {phase.name === "done" && (
        <>
          <AnswerSwitch outcome={phase.outcome} quotes={quotes} />
          <RelatedSkills skillId={phase.skillId} outcome={phase.outcome} onPick={arm} onReset={reset} />
          <p className="cvq-disclaimer">
            Conviqt is a research and education tool, not a licensed financial
            adviser. Nothing here is financial advice. Markets involve risk.
          </p>
        </>
      )}

      <SkillLibrarySheet open={libraryOpen} onClose={() => setLibraryOpen(false)} onPick={arm} />
      <PaywallSheet open={paywallOpen} onClose={() => setPaywallOpen(false)} />
    </div>
  );
}

// ── Answer dispatch ──────────────────────────────────────────────────────────

function AnswerSwitch({ outcome, quotes }: { outcome: Outcome; quotes: QuoteMap }) {
  switch (outcome.kind) {
    case "council":
      return <CouncilAnswer result={outcome.result} quotes={quotes} />;
    case "focused":
      return <FocusedAnswer result={outcome.result} quotes={quotes} />;
    case "compare":
      return <CompareAnswer result={outcome.result} quotes={quotes} />;
    case "sector":
      return <SectorAnswer result={outcome.result} />;
    case "headline":
      return <HeadlineAnswer result={outcome.result} quotes={quotes} />;
    case "allocator":
      return <AllocatorAnswer result={outcome.result} />;
    case "audit":
      return <AuditAnswer result={outcome.result} />;
    case "text":
      return <TextAnswer text={outcome.text} />;
  }
}

// ── Progress ─────────────────────────────────────────────────────────────────

function ProgressCard({ progress }: { progress: ProgressState }) {
  return (
    <Card padding="lg" className="cvq-progress" aria-live="polite">
      {progress.done.map((line, i) => (
        <div key={i} className="cvq-progress-line cvq-progress-line--done">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="m5 13 4 4L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {line}
        </div>
      ))}
      {progress.active && (
        <div className="cvq-progress-line cvq-progress-line--active">
          <span className="cvq-progress-dot" aria-hidden />
          {progress.active}
        </div>
      )}
      {progress.tickerStages.length > 0 && (
        <div className="cvq-progress-tickers">
          {progress.tickerStages.map((s) => (
            <span key={s.ticker} className="cvq-progress-ticker" data-state={s.state}>
              <span data-no-translate>{s.ticker}</span> · {s.label}
            </span>
          ))}
        </div>
      )}
      <SkeletonText lines={2} />
    </Card>
  );
}

// ── Related skills ───────────────────────────────────────────────────────────

const OUTCOME_DEFAULT_SKILL: Record<Outcome["kind"], string> = {
  council: "worth-owning",
  focused: "quick-take",
  compare: "face-off",
  sector: "sector-pulse",
  headline: "headline-decoder",
  allocator: "starter-portfolio",
  audit: "portfolio-health-check",
  text: "quick-take",
};

function RelatedSkills({
  skillId,
  outcome,
  onPick,
  onReset,
}: {
  skillId: string | null;
  outcome: Outcome;
  onPick: (skill: Skill) => void;
  onReset: () => void;
}) {
  const anchor = getSkill(skillId ?? OUTCOME_DEFAULT_SKILL[outcome.kind]);
  const related = (anchor?.related ?? [])
    .map((id) => getSkill(id))
    .filter((s): s is Skill => s !== null)
    .slice(0, 3);
  if (related.length === 0) return null;
  return (
    <section className="cvq-answer-section">
      <h3 className="cvq-section-title">Keep digging</h3>
      <div className="cvq-related">
        {related.map((skill) => (
          <button
            key={skill.id}
            type="button"
            className="cvq-card cvq-card--interactive cvq-related-card"
            onClick={() => {
              onReset();
              onPick(skill);
            }}
          >
            <SkillIcon id={skill.id} />
            <span className="cvq-skill-name">{skill.name}</span>
            <span className="cvq-skill-oneliner">{skill.oneLiner}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

// ── Guided inputs ────────────────────────────────────────────────────────────

const RISK_OPTIONS: Array<{ value: RiskTolerance; label: string }> = [
  { value: "conservative", label: "Careful" },
  { value: "balanced", label: "Balanced" },
  { value: "growth", label: "Growth" },
  { value: "aggressive", label: "Aggressive" },
];

const GOAL_OPTIONS: Array<{ value: Goal; label: string }> = [
  { value: "wealth", label: "Grow wealth" },
  { value: "retirement", label: "Retirement" },
  { value: "house", label: "Buy a home" },
  { value: "income", label: "Steady income" },
  { value: "education", label: "Education" },
  { value: "bigPurchase", label: "A big purchase" },
  { value: "preservation", label: "Keep it safe" },
];

function GuidedInput(props: {
  skill: Skill;
  onCancel: () => void;
  gTicker: string;
  setGTicker: (v: string) => void;
  gTickerB: string;
  setGTickerB: (v: string) => void;
  gSector: string;
  setGSector: (v: string) => void;
  gHeadline: string;
  setGHeadline: (v: string) => void;
  runChatSkill: (skill: Skill, params: Record<string, string>, asked: string) => void;
  runAllocatorSkill: (profile: Record<string, unknown>, asked: string) => void;
  runAuditSkill: (holdings: Array<{ ticker: string; shares: number }>, asked: string) => void;
}) {
  const { skill, onCancel } = props;
  const [error, setError] = useState<string | null>(null);

  // Starter Portfolio form state.
  const [lumpSum, setLumpSum] = useState("1000");
  const [monthly, setMonthly] = useState("100");
  const [risk, setRisk] = useState<RiskTolerance>("balanced");
  const [horizon, setHorizon] = useState("10");
  const [goals, setGoals] = useState<Goal[]>(["wealth"]);
  const [hasDebt, setHasDebt] = useState(false);
  const [hasFund, setHasFund] = useState(false);

  // Health Check holdings editor — preloaded from the saved portfolio if any.
  const [rows, setRows] = useState<Array<{ ticker: string; shares: string }>>([
    { ticker: "", shares: "" },
  ]);
  const [rowsPreloaded, setRowsPreloaded] = useState(false);

  useEffect(() => {
    if (skill.input !== "holdings" || rowsPreloaded) return;
    let alive = true;
    fetch("/api/portfolio")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive || !d || !Array.isArray(d.portfolios) || d.portfolios.length === 0) return;
        const holdings = d.portfolios[0]?.holdings;
        if (Array.isArray(holdings) && holdings.length > 0) {
          setRows(
            holdings.map((h: { ticker: string; shares: number }) => ({
              ticker: String(h.ticker ?? "").toUpperCase(),
              shares: String(h.shares ?? ""),
            }))
          );
        }
      })
      .catch(() => null)
      .finally(() => alive && setRowsPreloaded(true));
    return () => {
      alive = false;
    };
  }, [skill.input, rowsPreloaded]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (skill.input === "ticker") {
      const t = props.gTicker.trim().toUpperCase();
      if (!TICKER_RE.test(t)) return setError("That doesn't look like a US-listed ticker (try NVDA, AAPL…).");
      return props.runChatSkill(skill, { ticker: t }, `${skill.name} — ${t}`);
    }
    if (skill.input === "tickerPair") {
      const a = props.gTicker.trim().toUpperCase();
      const b = props.gTickerB.trim().toUpperCase();
      if (!TICKER_RE.test(a) || !TICKER_RE.test(b)) return setError("Both sides need a US-listed ticker (e.g. NVDA and AMD).");
      if (a === b) return setError("Pick two different stocks for a Face-Off.");
      return props.runChatSkill(skill, { tickerA: a, tickerB: b }, `${skill.name} — ${a} vs ${b}`);
    }
    if (skill.input === "sector") {
      if (!props.gSector) return setError("Pick an industry first.");
      const basket = SECTOR_BASKETS.find((bk) => bk.key === props.gSector);
      return props.runChatSkill(
        skill,
        { sectorKey: props.gSector },
        `${skill.name} — ${basket?.label ?? props.gSector}`
      );
    }
    if (skill.input === "headline") {
      const h = props.gHeadline.trim();
      if (h.length < 12) return setError("Paste the full headline so there's enough to decode.");
      return props.runChatSkill(skill, { headline: h }, `${skill.name} — “${h.slice(0, 80)}${h.length > 80 ? "…" : ""}”`);
    }
    if (skill.input === "allocator") {
      const lump = Number(lumpSum);
      const month = Number(monthly);
      const yrs = Number(horizon);
      if (!isFinite(lump) || lump < 0) return setError("Enter the amount you can invest now (0 is fine).");
      if (!isFinite(month) || month < 0) return setError("Enter a monthly amount (0 is fine).");
      if (lump === 0 && month === 0) return setError("Give the plan something to work with — a starting amount or a monthly amount.");
      if (!isFinite(yrs) || yrs < 0.5 || yrs > 60) return setError("Set a time horizon between 0.5 and 60 years.");
      if (goals.length === 0) return setError("Pick at least one goal.");
      return props.runAllocatorSkill(
        {
          lumpSum: lump,
          monthlyContribution: month,
          riskTolerance: risk,
          horizonYears: yrs,
          goals,
          highInterestDebt: hasDebt,
          hasEmergencyFund: hasFund,
          guardrails: [],
        },
        `${skill.name} — $${lump.toLocaleString()} + $${month.toLocaleString()}/mo, ${yrs}y`
      );
    }
    if (skill.input === "holdings") {
      // Fully blank rows (a leftover "+ Add another") are simply ignored;
      // partially-filled rows are real mistakes and get a specific error.
      // Note Number("") === 0, so emptiness is judged on the raw strings.
      const holdings = rows
        .filter((r) => r.ticker.trim() !== "" || r.shares.trim() !== "")
        .map((r) => ({ ticker: r.ticker.trim().toUpperCase(), shares: Number(r.shares) }));
      if (holdings.length === 0) return setError("Add at least one holding.");
      for (const h of holdings) {
        if (!TICKER_RE.test(h.ticker)) return setError(`"${h.ticker || "?"}" doesn't look like a US-listed ticker.`);
        if (!isFinite(h.shares) || h.shares <= 0) return setError(`Add a share count for ${h.ticker}.`);
      }
      return props.runAuditSkill(
        holdings,
        `${skill.name} — ${holdings.map((h) => h.ticker).join(", ")}`
      );
    }
  };

  const toggleGoal = (g: Goal) =>
    setGoals((prev) => (prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]));

  return (
    <form className="cvq-guided" onSubmit={submit}>
      <div className="cvq-guided-head">
        <SkillIcon id={skill.id} />
        <div>
          <div className="cvq-skill-name">{skill.name}</div>
          <div className="cvq-skill-oneliner">{skill.oneLiner}</div>
        </div>
        <button type="button" className="cvq-sheet-close" onClick={onCancel} aria-label="Close skill">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <p className="cvq-guided-prompt">{skill.guidedPrompt}</p>

      {skill.input === "ticker" && (
        <div className="cvq-guided-row">
          <input
            type="text"
            className="cvq-guided-input"
            value={props.gTicker}
            onChange={(e) => props.setGTicker(e.target.value.toUpperCase())}
            placeholder="e.g. NVDA"
            maxLength={7}
            autoFocus
            data-no-translate
          />
        </div>
      )}

      {skill.input === "tickerPair" && (
        <div className="cvq-guided-row">
          <input
            type="text"
            className="cvq-guided-input"
            value={props.gTicker}
            onChange={(e) => props.setGTicker(e.target.value.toUpperCase())}
            placeholder="First — e.g. NVDA"
            maxLength={7}
            autoFocus
            data-no-translate
          />
          <span className="cvq-guided-vs">vs</span>
          <input
            type="text"
            className="cvq-guided-input"
            value={props.gTickerB}
            onChange={(e) => props.setGTickerB(e.target.value.toUpperCase())}
            placeholder="Second — e.g. AMD"
            maxLength={7}
            data-no-translate
          />
        </div>
      )}

      {skill.input === "sector" && (
        <div className="cvq-guided-chips">
          {SECTOR_BASKETS.map((b) => (
            <button
              key={b.key}
              type="button"
              className="cvq-chip"
              aria-pressed={props.gSector === b.key}
              title={b.blurb}
              onClick={() => props.setGSector(b.key)}
            >
              {b.label}
            </button>
          ))}
        </div>
      )}

      {skill.input === "headline" && (
        <textarea
          className="cvq-guided-input cvq-guided-textarea"
          value={props.gHeadline}
          onChange={(e) => props.setGHeadline(e.target.value)}
          placeholder='e.g. "Fed signals two more rate cuts this year"'
          rows={3}
          maxLength={300}
          autoFocus
        />
      )}

      {skill.input === "allocator" && (
        <div className="cvq-guided-form">
          <label className="cvq-field">
            <span>Starting amount ($)</span>
            <input type="number" min="0" step="50" className="cvq-guided-input" value={lumpSum} onChange={(e) => setLumpSum(e.target.value)} />
          </label>
          <label className="cvq-field">
            <span>Monthly ($)</span>
            <input type="number" min="0" step="10" className="cvq-guided-input" value={monthly} onChange={(e) => setMonthly(e.target.value)} />
          </label>
          <label className="cvq-field">
            <span>Years until you need it</span>
            <input type="number" min="0.5" max="60" step="0.5" className="cvq-guided-input" value={horizon} onChange={(e) => setHorizon(e.target.value)} />
          </label>
          <div className="cvq-field">
            <span>Comfort with swings</span>
            <div className="cvq-guided-chips">
              {RISK_OPTIONS.map((r) => (
                <button key={r.value} type="button" className="cvq-chip" aria-pressed={risk === r.value} onClick={() => setRisk(r.value)}>
                  {r.label}
                </button>
              ))}
            </div>
          </div>
          <div className="cvq-field">
            <span>What it&apos;s for (pick any)</span>
            <div className="cvq-guided-chips">
              {GOAL_OPTIONS.map((g) => (
                <button key={g.value} type="button" className="cvq-chip" aria-pressed={goals.includes(g.value)} onClick={() => toggleGoal(g.value)}>
                  {g.label}
                </button>
              ))}
            </div>
          </div>
          <div className="cvq-field">
            <span>Any debt above ~7% interest?</span>
            <div className="cvq-guided-chips">
              <button type="button" className="cvq-chip" aria-pressed={hasDebt} onClick={() => setHasDebt(true)}>Yes</button>
              <button type="button" className="cvq-chip" aria-pressed={!hasDebt} onClick={() => setHasDebt(false)}>No</button>
            </div>
          </div>
          <div className="cvq-field">
            <span>3–6 months of expenses saved?</span>
            <div className="cvq-guided-chips">
              <button type="button" className="cvq-chip" aria-pressed={hasFund} onClick={() => setHasFund(true)}>Yes</button>
              <button type="button" className="cvq-chip" aria-pressed={!hasFund} onClick={() => setHasFund(false)}>No</button>
            </div>
          </div>
        </div>
      )}

      {skill.input === "holdings" && (
        <div className="cvq-guided-form">
          {rows.map((row, i) => (
            <div key={i} className="cvq-guided-row">
              <input
                type="text"
                className="cvq-guided-input"
                value={row.ticker}
                onChange={(e) =>
                  setRows((prev) => prev.map((r, j) => (j === i ? { ...r, ticker: e.target.value.toUpperCase() } : r)))
                }
                placeholder="Ticker"
                maxLength={7}
                data-no-translate
              />
              <input
                type="number"
                min="0"
                step="any"
                className="cvq-guided-input"
                value={row.shares}
                onChange={(e) =>
                  setRows((prev) => prev.map((r, j) => (j === i ? { ...r, shares: e.target.value } : r)))
                }
                placeholder="Shares"
              />
              {rows.length > 1 && (
                <button
                  type="button"
                  className="cvq-sheet-close"
                  aria-label={`Remove ${row.ticker || "row"}`}
                  onClick={() => setRows((prev) => prev.filter((_, j) => j !== i))}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            className="cvq-btn cvq-btn--ghost"
            onClick={() => setRows((prev) => [...prev, { ticker: "", shares: "" }])}
          >
            + Add another holding
          </button>
        </div>
      )}

      {error && <p className="cvq-guided-error" role="alert">{error}</p>}

      <div className="cvq-guided-actions">
        <button type="submit" className="cvq-btn cvq-btn--primary">
          Run {skill.name}
        </button>
        <span className="cvq-mode-hint">{skill.speedLabel}</span>
      </div>
    </form>
  );
}
