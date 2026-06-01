import { runPortfolioSweep } from "./sweep";
import { computeMetrics } from "./metrics";
import { runRiskAgent, RISK_DIMENSIONS } from "./agents";
import { runPortfolioJudge } from "./judge";
import { computePortfolioDisagreement } from "./disagreement";
import type {
  Holding,
  PortfolioAuditResult,
  PortfolioFactSheet,
  PortfolioMetrics,
  RiskAgentOutput,
} from "./types";

// runAudit is the single entrypoint for a portfolio audit.
//
// Pipeline (cost-controlled — see CLAUDE.md ceilings):
// 1. ONE batched sweep (Haiku + web_search) → sectors + sourced prices + macro.
// 2. Deterministic metrics in TS (weights, concentration, HHI) — exact, no model.
// 3. Five risk agents in parallel (Haiku, read-only over the metrics brief).
// 4. Deterministic disagreement across the agents' overall-risk reads.
// 5. Synthesis judge (Sonnet) → health score, scenarios, ranked hedges.
//
// Failure mode: if the sweep can't price a single holding, we throw before
// burning tokens on agents — the route returns an error rather than a
// hallucinated audit.

export type AuditEvent =
  | { kind: "start"; runId: string; portfolioName: string; holdingsCount: number }
  | { kind: "sweep_done"; factSheet: PortfolioFactSheet; metrics: PortfolioMetrics; costUSD: number }
  | { kind: "agent_done"; agent: RiskAgentOutput; costUSD: number }
  | { kind: "judge_done"; result: PortfolioAuditResult };

export interface RunAuditOptions {
  name?: string;
  onEvent?: (event: AuditEvent) => void;
}

function makeRunId(): string {
  return `pa_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function runAudit(
  holdings: Holding[],
  options: RunAuditOptions = {}
): Promise<PortfolioAuditResult> {
  const { name = "My Portfolio", onEvent } = options;
  const t0 = Date.now();
  const runId = makeRunId();
  const asOf = new Date().toISOString();
  const warnings: string[] = [];
  let totalCostUSD = 0;

  onEvent?.({ kind: "start", runId, portfolioName: name, holdingsCount: holdings.length });

  // Step 1: batched sweep.
  let sweep;
  try {
    sweep = await runPortfolioSweep(holdings, { asOf });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`[Audit] Sweep failed: ${msg}`);
  }
  totalCostUSD += sweep.costUSD;

  if (sweep.rejectedSources > 0) {
    warnings.push(`Sweep rejected ${sweep.rejectedSources} unverified source(s).`);
  }
  if (sweep.factSheet.unresolved.length > 0) {
    warnings.push(
      `Could not price: ${sweep.factSheet.unresolved.join(", ")} — excluded from weights.`
    );
  }

  // Step 2: deterministic metrics.
  const metrics = computeMetrics(holdings, sweep.factSheet);

  onEvent?.({
    kind: "sweep_done",
    factSheet: sweep.factSheet,
    metrics,
    costUSD: sweep.costUSD,
  });

  // Step 3: five risk agents in parallel.
  const agentPromises = RISK_DIMENSIONS.map(async (dim) => {
    try {
      const r = await runRiskAgent(dim, sweep!.factSheet, metrics);
      onEvent?.({ kind: "agent_done", agent: r.output, costUSD: r.costUSD });
      return r;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[Audit] ${dim} failed:`, msg);
      warnings.push(`${dim} analyst failed: ${msg}`);
      const stub: RiskAgentOutput = {
        dimension: dim,
        score: 0,
        overallRisk: 0,
        severity: "low",
        finding: `This analyst failed to return a read: ${msg}`,
        flaggedTickers: [],
        sourceIndexes: [],
        durationMs: 0,
      };
      onEvent?.({ kind: "agent_done", agent: stub, costUSD: 0 });
      return { output: stub, costUSD: 0 };
    }
  });

  const settled = await Promise.all(agentPromises);
  const agents = settled.map((s) => s.output);
  settled.forEach((s) => (totalCostUSD += s.costUSD));

  const live = agents.filter((a) => a.finding && a.score >= 0 && a.durationMs > 0);
  if (live.length === 0) {
    throw new Error(`[Audit] All five risk analysts failed. ${warnings.join(" | ")}`);
  }

  // Step 4: deterministic disagreement.
  const disagreement = computePortfolioDisagreement(agents);

  // Step 5: synthesis judge.
  const judgeResult = await runPortfolioJudge(sweep.factSheet, metrics, agents);
  totalCostUSD += judgeResult.costUSD;

  const result: PortfolioAuditResult = {
    runId,
    portfolioName: name,
    asOf,
    factSheet: sweep.factSheet,
    metrics,
    agents,
    disagreement,
    judge: judgeResult.output,
    warnings,
    totalDurationMs: Date.now() - t0,
    estCostUSD: Number(totalCostUSD.toFixed(4)),
  };

  console.log(
    `[Audit] ${runId} done in ${result.totalDurationMs}ms: health=${judgeResult.output.healthScore} ` +
      `disagreement=${disagreement} cost=$${result.estCostUSD}`
  );

  onEvent?.({ kind: "judge_done", result });

  return result;
}
