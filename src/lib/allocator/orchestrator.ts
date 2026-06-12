import type { ExperienceLevel } from "../agents/audience";
import { computeBaseline } from "./engine";
import { runAllocatorSweep } from "./sweep";
import { runSpecialist, SPECIALIST_LANES } from "./specialists";
import { computeAllocatorDisagreement } from "./disagreement";
import { runAllocatorJudge } from "./judge";
import type {
  AllocatorEvent,
  AllocatorFactSheet,
  AllocatorResult,
  Baseline,
  InvestorProfile,
  SpecialistOutput,
} from "./types";

// runAllocator is the single entrypoint for an allocation plan.
//
// Pipeline (cost-controlled — see CLAUDE.md ceilings):
// 1. Deterministic baseline in TS (the TFV framework) — exact, no model.
// 2. ONE batched sweep (Haiku + web_search) → cited vehicle facts + macro.
// 3. Four planning agents in parallel (Haiku) over the same brief.
// 4. Deterministic disagreement across the lanes' equity reads.
// 5. Synthesis judge (Sonnet) → the concrete, cited plan.
//
// Failure mode: if the sweep can source nothing, we throw before burning tokens
// on agents — the route refunds credits rather than returning an uncited plan.

export interface RunAllocatorOptions {
  onEvent?: (event: AllocatorEvent) => void;
  audience?: ExperienceLevel | null;
}

function makeRunId(): string {
  return `al_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function runAllocator(
  profile: InvestorProfile,
  options: RunAllocatorOptions = {}
): Promise<AllocatorResult> {
  const { onEvent, audience } = options;
  const t0 = Date.now();
  const runId = makeRunId();
  const asOf = new Date().toISOString();
  const warnings: string[] = [];
  let totalCostUSD = 0;

  onEvent?.({ kind: "start", runId });

  // Step 1: deterministic baseline.
  const baseline: Baseline = computeBaseline(profile);
  onEvent?.({ kind: "baseline_done", baseline });

  // Step 2: batched sweep.
  let factSheet: AllocatorFactSheet;
  try {
    const sweep = await runAllocatorSweep(baseline, { asOf });
    factSheet = sweep.factSheet;
    totalCostUSD += sweep.costUSD;
    if (sweep.rejectedSources > 0) {
      warnings.push(`Sweep rejected ${sweep.rejectedSources} unverified source(s).`);
    }
    if (factSheet.unresolved.length > 0) {
      warnings.push(`Could not source live data for: ${factSheet.unresolved.join(", ")}.`);
    }
    onEvent?.({ kind: "sweep_done", factSheet, costUSD: sweep.costUSD });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`[Allocator] Sweep failed: ${msg}`);
  }

  // Step 3: four planning agents in parallel.
  const settled = await Promise.all(
    SPECIALIST_LANES.map(async (lane) => {
      try {
        const r = await runSpecialist(lane, profile, baseline, factSheet);
        onEvent?.({ kind: "specialist_done", specialist: r.output, costUSD: r.costUSD });
        return r;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[Allocator] ${lane} failed:`, msg);
        warnings.push(`${lane} failed: ${msg}`);
        const stub: SpecialistOutput = {
          lane,
          equityPct: baseline.equityPct,
          stance: `This agent failed to return a stance: ${msg}`,
          endorses: [],
          riskNote: "",
          sourceIndexes: [],
          durationMs: 0,
        };
        onEvent?.({ kind: "specialist_done", specialist: stub, costUSD: 0 });
        return { output: stub, costUSD: 0 };
      }
    })
  );

  const specialists = settled.map((s) => s.output);
  settled.forEach((s) => (totalCostUSD += s.costUSD));

  const live = specialists.filter((s) => s.durationMs > 0 && s.stance);
  if (live.length === 0) {
    throw new Error(`[Allocator] All four planning agents failed. ${warnings.join(" | ")}`);
  }

  // Step 4: deterministic disagreement.
  const disagreement = computeAllocatorDisagreement(specialists);

  // Step 5: synthesis judge.
  const judge = await runAllocatorJudge(profile, baseline, factSheet, specialists, audience);
  totalCostUSD += judge.costUSD;

  const result: AllocatorResult = {
    runId,
    asOf,
    profile,
    baseline,
    factSheet,
    specialists,
    disagreement,
    plan: judge.output,
    warnings,
    totalDurationMs: Date.now() - t0,
    estCostUSD: Number(totalCostUSD.toFixed(4)),
  };

  console.log(
    `[Allocator] ${runId} done in ${result.totalDurationMs}ms: equity=${judge.output.equityPct}% ` +
      `disagreement=${disagreement} lines=${judge.output.allocation.length} cost=$${result.estCostUSD}`
  );

  onEvent?.({ kind: "judge_done", result });

  return result;
}
