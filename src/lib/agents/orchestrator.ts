import { runSweep } from "./sweep";
import { runFundamentals } from "./fundamentals";
import { runTechnicals } from "./technicals";
import { runSentiment } from "./sentiment";
import { runMacro } from "./macro";
import { runJudge } from "./judge";
import { runFocusedJudge } from "./focusedJudge";
import { runComparativeJudge } from "./comparativeJudge";
import { runSectorTickerScorecard, runSectorJudge } from "./sectorJudge";
import type { SectorBasket } from "./sectors";
import { computeDisagreement, computeDispersion } from "../disagreement";
import {
  AgentName,
  AgentOutput,
  CompareResult,
  CouncilResult,
  FocusedResult,
  FactSheet,
  SectorConstituent,
  SectorResult,
} from "./types";
import { cacheGet, cacheSet, COUNCIL_CACHE_TTL_MS, councilCacheKey } from "../cache";
import type { ExperienceLevel } from "./audience";
import type { SpecialistRunResult } from "./_runner";

// runCouncil is the single entrypoint for an on-demand stock analysis.
//
// Pipeline:
// 1. Sweep agent uses Claude web_search to build a cited FactSheet.
// 2. Four specialist agents read the FactSheet in parallel and produce
//    BUY/HOLD/SELL with source citations.
// 3. Judge synthesizes ONLY the surviving (confidence > 0) specialists.
//    Dead/failed specialists are kept out of the Judge briefing so they
//    don't poison consensus.
// 4. Disagreement is computed deterministically from the live agents.
//    The Judge does NOT report this number.
//
// Failure mode: if sweep returns zero usable facts, we throw before
// burning tokens on specialists. Per CLAUDE.md, the route returns 503
// rather than ship synthetic numbers.

type SpecialistFn = (
  fs: FactSheet,
  focus?: string
) => Promise<SpecialistRunResult>;

const SPECIALISTS: Array<{ name: AgentName; fn: SpecialistFn }> = [
  { name: "Fundamentals", fn: runFundamentals },
  { name: "Technicals", fn: runTechnicals },
  { name: "Sentiment", fn: runSentiment },
  { name: "Macro", fn: runMacro },
];

function fallbackAgent(name: AgentName, reason: string): AgentOutput {
  return {
    agent: name,
    verdict: "HOLD",
    confidence: 0,
    reasoning: `Agent failed to return a verdict: ${reason}`,
    flags: ["agent error"],
    sourceIndexes: [],
    durationMs: 0,
  };
}

// Progress events fired during a council run so the chat route can stream
// partial state to the user.
export type CouncilEvent =
  | { kind: "start"; ticker: string; runId: string; asOf: string }
  | { kind: "sweep_done"; factSheet: FactSheet; webSearchCount: number; costUSD: number; durationMs: number }
  | { kind: "specialist_done"; agent: AgentOutput; costUSD: number }
  | { kind: "judge_done"; result: CouncilResult };

// Progress events for the lightweight focused query pipeline.
export type FocusedEvent =
  | { kind: "start"; ticker: string; question: string; runId: string }
  | { kind: "sweep_done"; factSheet: FactSheet; costUSD: number }
  | { kind: "answer_done"; result: FocusedResult };

export interface RunCouncilOptions {
  focus?: string;
  onEvent?: (event: CouncilEvent) => void;
  /** Reader experience level — the one prompt switch (audience.ts). */
  audience?: ExperienceLevel | null;
}

function makeRunId(): string {
  return `run_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function runCouncil(
  ticker: string,
  options: RunCouncilOptions = {}
): Promise<CouncilResult> {
  const { focus, onEvent, audience } = options;
  const t0 = Date.now();
  const upper = ticker.toUpperCase();
  const runId = makeRunId();
  const asOf = new Date().toISOString();
  const warnings: string[] = [];
  let totalCostUSD = 0;

  onEvent?.({ kind: "start", ticker: upper, runId, asOf });

  // Step 1: sweep.
  let sweep;
  try {
    sweep = await runSweep(upper, { focus, asOf });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const error = new Error(`[Council] Sweep failed for ${upper}: ${msg}`);
    (error as Error & { warnings?: string[] }).warnings = [msg];
    throw error;
  }
  totalCostUSD += sweep.costUSD;
  console.log(
    `[Council] ${upper} sweep done in ${sweep.durationMs}ms, ${sweep.factSheet.facts.length} facts (${sweep.marketDataFacts} from data feed), ${sweep.factSheet.sources.length} sources, ${sweep.webSearchCount} searches, ${sweep.rejectedSources} rejected, cost=$${sweep.costUSD.toFixed(4)}`
  );

  if (sweep.rejectedSources > 0) {
    warnings.push(
      `Sweep rejected ${sweep.rejectedSources} model-authored source(s) that didn't match real web_search results.`
    );
  }
  if (sweep.factSheet.gaps.length > 0) {
    warnings.push(`Sweep gaps: ${sweep.factSheet.gaps.join(", ")}`);
  }
  if (sweep.factSheet.assetType !== "equity") {
    warnings.push(
      `Asset type detected as ${sweep.factSheet.assetType}. Some specialist lanes will be skipped.`
    );
  }

  onEvent?.({
    kind: "sweep_done",
    factSheet: sweep.factSheet,
    webSearchCount: sweep.webSearchCount,
    costUSD: sweep.costUSD,
    durationMs: sweep.durationMs,
  });

  // Step 2: specialists in parallel. Each emits a specialist_done event
  // as soon as it returns, so the UI can render the panel incrementally.
  const specialistPromises = SPECIALISTS.map(async ({ name, fn }) => {
    try {
      const result = await fn(sweep!.factSheet, focus);
      onEvent?.({
        kind: "specialist_done",
        agent: result.output,
        costUSD: result.costUSD,
      });
      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[Council] ${name} failed:`, msg);
      warnings.push(`${name} failed: ${msg}`);
      const stub = {
        output: fallbackAgent(name, msg),
        costUSD: 0,
      };
      onEvent?.({
        kind: "specialist_done",
        agent: stub.output,
        costUSD: 0,
      });
      return stub;
    }
  });

  const settled = await Promise.all(specialistPromises);
  const agentOutputs = settled.map((s) => s.output);
  settled.forEach((s) => {
    totalCostUSD += s.costUSD;
  });

  // Survivors = agents with non-zero confidence (real verdicts).
  // Failed / skipped agents are kept in the response (UI shows them
  // greyed out) but they do NOT go into the Judge briefing — they would
  // poison consensus and inflate disagreement artificially.
  const survivors = agentOutputs.filter((a) => a.confidence > 0);
  if (survivors.length === 0) {
    const err = new Error(
      `[Council] All four specialists failed for ${upper}. Nothing to judge. Reasons: ${warnings.join(" | ") || "(none captured)"}`
    );
    (err as Error & { warnings?: string[] }).warnings = warnings;
    throw err;
  }

  // Step 3: synthesize (only with surviving agents).
  const judgeResult = await runJudge(sweep.factSheet, survivors, { focus, audience });
  totalCostUSD += judgeResult.costUSD;

  // Step 4: stamp deterministic disagreement on top of the Judge's output.
  const disagreement = computeDisagreement(agentOutputs);

  const result: CouncilResult = {
    runId,
    ticker: upper,
    asOf,
    focus,
    factSheet: sweep.factSheet,
    agents: agentOutputs,
    judge: { ...judgeResult.output, disagreement },
    totalDurationMs: Date.now() - t0,
    warnings,
    estCostUSD: Number(totalCostUSD.toFixed(4)),
  };

  onEvent?.({ kind: "judge_done", result });

  return result;
}

// ── FOCUSED QUERY PIPELINE ────────────────────────────────────────────────────
//
// Lighter alternative to runCouncil for conversational stock questions that
// don't need a full investment thesis. Examples:
//   "what are we expecting in NVDA's earnings today?"
//   "is Adobe going to bounce back?"
//   "what happened to TSLA after hours?"
//
// Pipeline: sweep (3 searches) → focused judge (Haiku, ~400 tokens).
// No 4-agent breakdown. No BUY/HOLD/SELL conviction score.
// Saves ~60% cost vs a full council run for questions that don't warrant one.

export interface RunFocusedOptions {
  onEvent?: (event: FocusedEvent) => void;
  audience?: ExperienceLevel | null;
}

export async function runFocusedQuery(
  ticker: string,
  question: string,
  options: RunFocusedOptions = {}
): Promise<FocusedResult> {
  const { onEvent, audience } = options;
  const t0 = Date.now();
  const upper = ticker.toUpperCase();
  const runId = `fq_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  const asOf = new Date().toISOString();
  let totalCostUSD = 0;

  onEvent?.({ kind: "start", ticker: upper, question, runId });

  // Sweep: focus the search on the user's specific question.
  let sweep;
  try {
    sweep = await runSweep(upper, { focus: question, asOf });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`[FocusedQuery] Sweep failed for ${upper}: ${msg}`);
  }
  totalCostUSD += sweep.costUSD;
  console.log(
    `[FocusedQuery] ${upper} sweep done in ${sweep.durationMs}ms, ${sweep.factSheet.facts.length} facts, cost=$${sweep.costUSD.toFixed(4)}`
  );

  onEvent?.({ kind: "sweep_done", factSheet: sweep.factSheet, costUSD: sweep.costUSD });

  // Focused judge — answers the specific question in prose.
  const judgeResult = await runFocusedJudge(sweep.factSheet, question, audience);
  totalCostUSD += judgeResult.costUSD;

  const result: FocusedResult = {
    runId,
    ticker: upper,
    companyName: sweep.factSheet.companyName,
    sector: sweep.factSheet.sector,
    question,
    answer: judgeResult.answer,
    keyTakeaway: judgeResult.keyTakeaway,
    sources: sweep.factSheet.sources,
    sourceIndexes: judgeResult.sourceIndexes,
    asOf,
    estCostUSD: Number(totalCostUSD.toFixed(4)),
    totalDurationMs: Date.now() - t0,
  };

  onEvent?.({ kind: "answer_done", result });

  return result;
}

// ── HEAD-TO-HEAD COMPARE PIPELINE ─────────────────────────────────────────────
//
// "Compare NVDA vs AMD" → run the full Council on BOTH tickers in parallel,
// then a third comparative pass that issues a relative verdict.
//
// Cost discipline (CLAUDE.md): each side reuses the 4h Council cache. If a
// ticker was analyzed in the last 4h, that side costs nothing and we only pay
// for the side(s) that are cold plus the one comparative-judge synthesis. Two
// cold councils + synthesis stays in the ~5-6¢ range — justified for a
// 25-credit premium intent and well inside the monthly budget.

// Per-side progress stage surfaced to the UI. The two sides advance
// independently since the councils run concurrently.
export type CompareSideStage =
  | "queued"
  | "sweeping"
  | "specialists"
  | "judging"
  | "done";

export type CompareEvent =
  | { kind: "start"; tickerA: string; tickerB: string; runId: string; asOf: string }
  | { kind: "side_update"; side: "a" | "b"; ticker: string; stage: CompareSideStage; cached: boolean }
  | { kind: "side_done"; side: "a" | "b"; result: CouncilResult }
  | { kind: "comparing" }
  | { kind: "compare_done"; result: CompareResult };

export interface RunCompareOptions {
  onEvent?: (event: CompareEvent) => void;
  audience?: ExperienceLevel | null;
}

function compareStageFromCouncil(ev: CouncilEvent): CompareSideStage | null {
  if (ev.kind === "start") return "sweeping";
  if (ev.kind === "sweep_done") return "specialists";
  if (ev.kind === "specialist_done") return "specialists";
  if (ev.kind === "judge_done") return "judging";
  return null;
}

// Resolve one side: serve the cached Council run if warm, else run a fresh
// council (and populate the cache so a later single-ticker analyze is free).
// `fresh` lets the caller know whether to persist the result downstream.
async function resolveSide(
  side: "a" | "b",
  ticker: string,
  audience?: ExperienceLevel | null,
  onEvent?: (event: CompareEvent) => void
): Promise<{ result: CouncilResult; fresh: boolean }> {
  // Audience-suffixed key: a personalized side never collides with (or
  // poisons) the shared default council cache.
  const key = councilCacheKey(ticker, undefined, audience);
  const cached = cacheGet<CouncilResult>(key);
  if (cached) {
    onEvent?.({ kind: "side_update", side, ticker, stage: "done", cached: true });
    onEvent?.({ kind: "side_done", side, result: { ...cached, cached: true } });
    return { result: cached, fresh: false };
  }

  onEvent?.({ kind: "side_update", side, ticker, stage: "queued", cached: false });
  const result = await runCouncil(ticker, {
    audience,
    onEvent: (ev) => {
      const stage = compareStageFromCouncil(ev);
      if (stage) onEvent?.({ kind: "side_update", side, ticker, stage, cached: false });
    },
  });
  cacheSet(key, result, COUNCIL_CACHE_TTL_MS);
  onEvent?.({ kind: "side_update", side, ticker, stage: "done", cached: false });
  onEvent?.({ kind: "side_done", side, result });
  return { result, fresh: true };
}

export async function runCompare(
  tickerAInput: string,
  tickerBInput: string,
  options: RunCompareOptions = {}
): Promise<CompareResult & { freshSides: Array<"a" | "b"> }> {
  const { onEvent, audience } = options;
  const t0 = Date.now();
  const tickerA = tickerAInput.toUpperCase();
  const tickerB = tickerBInput.toUpperCase();
  const runId = makeRunId().replace("run_", "cmp_");
  const asOf = new Date().toISOString();

  onEvent?.({ kind: "start", tickerA, tickerB, runId, asOf });

  // Both councils run concurrently. A failure on either side aborts the
  // compare — per CLAUDE.md we don't synthesize a verdict on half the data.
  let sideA: { result: CouncilResult; fresh: boolean };
  let sideB: { result: CouncilResult; fresh: boolean };
  try {
    [sideA, sideB] = await Promise.all([
      resolveSide("a", tickerA, audience, onEvent),
      resolveSide("b", tickerB, audience, onEvent),
    ]);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`[Compare] Council failed for ${tickerA} vs ${tickerB}: ${msg}`);
  }

  // Third pass: the relative verdict.
  onEvent?.({ kind: "comparing" });
  const judge = await runComparativeJudge(sideA.result, sideB.result, audience);

  const totalCostUSD =
    (sideA.fresh ? sideA.result.estCostUSD : 0) +
    (sideB.fresh ? sideB.result.estCostUSD : 0) +
    judge.costUSD;

  const freshSides: Array<"a" | "b"> = [
    ...(sideA.fresh ? (["a"] as const) : []),
    ...(sideB.fresh ? (["b"] as const) : []),
  ];

  console.log(
    `[Compare] ${tickerA} vs ${tickerB} done in ${Date.now() - t0}ms, winner=${judge.output.winner}, freshSides=${freshSides.join(",") || "none"}, cost=$${totalCostUSD.toFixed(4)}`
  );

  const result: CompareResult = {
    runId,
    tickerA,
    tickerB,
    asOf,
    a: sideA.result,
    b: sideB.result,
    verdict: judge.output,
    totalDurationMs: Date.now() - t0,
    estCostUSD: Number(totalCostUSD.toFixed(4)),
  };

  onEvent?.({ kind: "compare_done", result });

  return { ...result, freshSides };
}

// ── SECTOR SNAPSHOT PIPELINE ──────────────────────────────────────────────────
//
// "analyze the AI infrastructure sector" → run an ABBREVIATED Council pass on
// each of 5-8 curated names (sweep → a single scorecard judge, NOT the full
// 4-specialist debate), then a sector judge synthesizes the basket into one
// thematic verdict.
//
// Cost discipline (CLAUDE.md): the marquee cost lever is reusing the 4h Council
// cache. Any name analyzed in the last 4h is reused for free (no sweep, no API
// cost) — derived straight from its full CouncilResult. Cold names run the
// abbreviated pass: a 2-search sweep (~2¢) + a Haiku scorecard (~0.3¢). Worst
// case (all cold) is ~6 names × ~2.5¢ + one Sonnet synthesis ≈ 17-20¢ — well
// inside the 40-credit premium intent and the daily budget.
//
// Abbreviated passes are intentionally NOT written back to the Council cache:
// they lack the 4-specialist breakdown a real "analyze" renders, so caching one
// under the council key would degrade a later single-stock analyze.

export type SectorTickerStage =
  | "queued"
  | "sweeping"
  | "scoring"
  | "done"
  | "failed";

export type SectorEvent =
  | { kind: "start"; sectorKey: string; sectorLabel: string; tickers: string[]; runId: string; asOf: string }
  | { kind: "ticker_update"; ticker: string; stage: SectorTickerStage; cached: boolean }
  | { kind: "ticker_done"; constituent: SectorConstituent }
  | { kind: "synthesizing" }
  | { kind: "sector_done"; result: SectorResult };

export interface RunSectorOptions {
  onEvent?: (event: SectorEvent) => void;
  audience?: ExperienceLevel | null;
}

// Derive a constituent from a warm full Council run — no API cost. We compress
// the full Judge verdict down to the scorecard shape the sector judge consumes.
function constituentFromCouncil(
  c: CouncilResult,
  subSector: string
): SectorConstituent {
  const j = c.judge;
  const thesis = j.bottomLine?.trim() || j.investmentCase.trim();
  const flags = Array.from(
    new Set(c.agents.filter((a) => a.confidence > 0).flatMap((a) => a.flags))
  ).slice(0, 3);
  return {
    ticker: c.ticker,
    companyName: c.factSheet.companyName,
    subSector,
    verdict: j.verdict,
    conviction: j.conviction,
    thesis,
    signals: j.keyMetrics.slice(0, 3),
    flags,
    sources: c.factSheet.sources,
    sourceIndexes: j.sourceIndexes.slice(0, 8),
    cached: true,
    estCostUSD: 0,
  };
}

// Resolve one name: reuse the warm Council run if present, else run the
// abbreviated sweep + scorecard pass. Never throws — a failed name comes back
// as a constituent carrying an `error`, so one bad ticker can't sink the basket.
async function resolveConstituent(
  spec: { ticker: string; subSector: string },
  asOf: string,
  onEvent?: (event: SectorEvent) => void
): Promise<SectorConstituent> {
  const ticker = spec.ticker.toUpperCase();

  const cached = cacheGet<CouncilResult>(councilCacheKey(ticker));
  if (cached) {
    const constituent = constituentFromCouncil(cached, spec.subSector);
    onEvent?.({ kind: "ticker_update", ticker, stage: "done", cached: true });
    onEvent?.({ kind: "ticker_done", constituent });
    return constituent;
  }

  try {
    onEvent?.({ kind: "ticker_update", ticker, stage: "sweeping", cached: false });
    const sweep = await runSweep(ticker, { asOf });

    onEvent?.({ kind: "ticker_update", ticker, stage: "scoring", cached: false });
    const card = await runSectorTickerScorecard(sweep.factSheet);

    const constituent: SectorConstituent = {
      ticker,
      companyName: sweep.factSheet.companyName || ticker,
      subSector: spec.subSector,
      verdict: card.verdict,
      conviction: card.conviction,
      thesis: card.thesis,
      signals: card.signals,
      flags: card.flags,
      sources: sweep.factSheet.sources,
      sourceIndexes: card.sourceIndexes,
      cached: false,
      estCostUSD: Number((sweep.costUSD + card.costUSD).toFixed(4)),
    };
    onEvent?.({ kind: "ticker_update", ticker, stage: "done", cached: false });
    onEvent?.({ kind: "ticker_done", constituent });
    return constituent;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[Sector] ${ticker} abbreviated pass failed:`, msg);
    const constituent: SectorConstituent = {
      ticker,
      companyName: ticker,
      subSector: spec.subSector,
      verdict: "HOLD",
      conviction: 0,
      thesis: `Could not score ${ticker}: ${msg}`,
      signals: [],
      flags: ["scoring error"],
      sources: [],
      sourceIndexes: [],
      cached: false,
      estCostUSD: 0,
      error: msg,
    };
    onEvent?.({ kind: "ticker_update", ticker, stage: "failed", cached: false });
    onEvent?.({ kind: "ticker_done", constituent });
    return constituent;
  }
}

export async function runSector(
  basket: SectorBasket,
  options: RunSectorOptions = {}
): Promise<SectorResult> {
  const { onEvent, audience } = options;
  const t0 = Date.now();
  const runId = makeRunId().replace("run_", "sec_");
  const asOf = new Date().toISOString();
  const warnings: string[] = [];

  onEvent?.({
    kind: "start",
    sectorKey: basket.key,
    sectorLabel: basket.label,
    tickers: basket.constituents.map((c) => c.ticker),
    runId,
    asOf,
  });

  // All names run concurrently. Each resolves independently (warm cache reuse
  // or a cold abbreviated pass) and never throws — failures surface as
  // error-carrying constituents.
  const constituents = await Promise.all(
    basket.constituents.map((spec) => resolveConstituent(spec, asOf, onEvent))
  );

  // Survivors = names that produced a real verdict. A failed name stays in the
  // response (UI greys it out) but is kept out of the synthesis so it can't
  // poison the thematic call.
  const survivors = constituents.filter((c) => !c.error && c.conviction > 0);
  const failed = constituents.filter((c) => c.error);
  if (failed.length > 0) {
    warnings.push(
      `${failed.length} name(s) failed to score: ${failed.map((c) => c.ticker).join(", ")}.`
    );
  }
  if (survivors.length < 2) {
    const err = new Error(
      `[Sector] Only ${survivors.length} of ${constituents.length} names in "${basket.label}" produced a verdict. Need at least 2 to synthesize a theme.`
    );
    (err as Error & { warnings?: string[] }).warnings = warnings;
    throw err;
  }

  // Thematic synthesis over the survivors only.
  onEvent?.({ kind: "synthesizing" });
  const judge = await runSectorJudge(basket, survivors, audience);

  // Deterministic basket dispersion — the sector analogue of disagreement.
  const dispersion = computeDispersion(
    survivors.map((c) => ({ verdict: c.verdict, conviction: c.conviction }))
  );

  const totalCostUSD =
    constituents.reduce((s, c) => s + c.estCostUSD, 0) + judge.costUSD;

  console.log(
    `[Sector] ${basket.key} done in ${Date.now() - t0}ms, stance=${judge.output.stance}, names=${survivors.length}/${constituents.length}, dispersion=${dispersion}, cost=$${totalCostUSD.toFixed(4)}`
  );

  const result: SectorResult = {
    runId,
    sectorKey: basket.key,
    sectorLabel: basket.label,
    blurb: basket.blurb,
    asOf,
    constituents,
    verdict: judge.output,
    dispersion,
    totalDurationMs: Date.now() - t0,
    estCostUSD: Number(totalCostUSD.toFixed(4)),
    warnings,
  };

  onEvent?.({ kind: "sector_done", result });

  return result;
}
