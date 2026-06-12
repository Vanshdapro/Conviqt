import { getAnthropic, MODELS, estimateCallCostUSD } from "../anthropic";
import { audienceDirective, type ExperienceLevel } from "../agents/audience";
import { renderMetricsBrief } from "./metrics";
import type {
  PortfolioFactSheet,
  PortfolioMetrics,
  RiskAgentOutput,
  PortfolioJudgeOutput,
  Scenario,
  Hedge,
  Severity,
  RiskDimension,
} from "./types";

// The synthesis judge. Sonnet (not Haiku) because this is the high-stakes,
// low-frequency, credit-gated step where reasoning quality shows: it folds the
// five risk reads + exact metrics + macro regime into a health score, four
// what-if scenarios, and a RANKED hedge list. One Sonnet call (~1.5k out) at
// ~2-3¢ is acceptable for a 45-credit flagship audit.

const SYSTEM = `You are the Chief Risk Officer synthesizing Conviqt's Portfolio Auditor.

Five risk analysts (Concentration, Sector Overlap, Macro Vulnerability, Correlation, Hidden Exposure) have each scored the portfolio. You receive their findings plus the exact deterministic metrics and the current macro regime. Produce the final audit.

Deliver via the report_audit tool:
1. healthScore (0-100): overall portfolio HEALTH (inverse of risk). A concentrated, single-sector, highly-correlated book scores LOW (high risk). A diversified, well-sized, macro-balanced book scores HIGH. Weight the analysts' findings but apply judgment — don't just average.
2. healthGrade: a letter grade for the score (90+ A, 80-89 B, 70-79 C, 60-69 D, <60 F; use +/- nuance).
3. assessment: 3-4 sentences, plain institutional prose, NO inline (#N). State the single biggest risk plainly.
4. scenarios: EXACTLY these four stress tests — "Recession", "Rate Shock (+150bps)", "Tariff / Trade War", "Tech-Led Selloff". For each: estImpactPct (a range like "-18% to -26%"), a 1-2 sentence narrative, hardestHit tickers, and severity. Ground impacts in the actual holdings and weights, and cite the macro source where relevant.
5. hedges: 3-6 CONCRETE, ranked actions (priority 1 = most important). Each names a specific move ("Trim NVDA from 22% to under 10%", "Add 5-8% in TLT or a long-duration Treasury ETF", "Rotate part of the tech sleeve into defensives"). Say which risk dimension(s) it addresses and why. Be actionable, not generic.
6. bottomLine: one punchy sentence — the single most important thing to do.

Rules:
- Reason only over the provided numbers and findings. Never invent a holding, weight, or price.
- Conviqt markets transparency, not alpha. Frame hedges as risk management, not return predictions. This is analysis, not personalized financial advice.
- Impacts are directional estimates grounded in the book's composition, not precise forecasts.`;

const REPORT_TOOL = {
  name: "report_audit",
  description: "Emit the final portfolio audit: health score, four stress scenarios, and a ranked hedge list.",
  input_schema: {
    type: "object" as const,
    properties: {
      healthScore: { type: "number", minimum: 0, maximum: 100 },
      healthGrade: { type: "string" },
      assessment: { type: "string" },
      scenarios: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            estImpactPct: { type: "string", description: "Impact range, e.g. '-18% to -26%'." },
            narrative: { type: "string" },
            hardestHit: { type: "array", items: { type: "string" } },
            severity: { type: "string", enum: ["low", "moderate", "elevated", "high"] },
            sourceIndexes: { type: "array", items: { type: "number" } },
          },
          required: ["name", "estImpactPct", "narrative", "hardestHit", "severity"],
        },
      },
      hedges: {
        type: "array",
        items: {
          type: "object",
          properties: {
            action: { type: "string" },
            rationale: { type: "string" },
            addresses: {
              type: "array",
              items: {
                type: "string",
                enum: ["Concentration", "Sector Overlap", "Macro Vulnerability", "Correlation", "Hidden Exposure"],
              },
            },
            priority: { type: "number" },
          },
          required: ["action", "rationale", "addresses", "priority"],
        },
      },
      bottomLine: { type: "string" },
      sourceIndexes: { type: "array", items: { type: "number" } },
    },
    required: ["healthScore", "healthGrade", "assessment", "scenarios", "hedges", "bottomLine", "sourceIndexes"],
  },
};

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function gradeFor(score: number): string {
  if (score >= 90) return "A";
  if (score >= 85) return "A-";
  if (score >= 80) return "B+";
  if (score >= 75) return "B";
  if (score >= 70) return "B-";
  if (score >= 65) return "C+";
  if (score >= 60) return "C";
  if (score >= 55) return "C-";
  if (score >= 50) return "D+";
  if (score >= 45) return "D";
  return "F";
}

function renderAgentFindings(agents: RiskAgentOutput[]): string {
  return agents
    .map(
      (a) =>
        `[${a.dimension}] score=${a.score}/100 (${a.severity}), overallRisk=${a.overallRisk}/100\n  ${a.finding}${a.flaggedTickers.length ? `\n  Flagged: ${a.flaggedTickers.join(", ")}` : ""}`
    )
    .join("\n\n");
}

export interface PortfolioJudgeRunResult {
  output: PortfolioJudgeOutput;
  costUSD: number;
}

const VALID_DIMS: RiskDimension[] = [
  "Concentration",
  "Sector Overlap",
  "Macro Vulnerability",
  "Correlation",
  "Hidden Exposure",
];

export async function runPortfolioJudge(
  factSheet: PortfolioFactSheet,
  metrics: PortfolioMetrics,
  agents: RiskAgentOutput[],
  audience?: ExperienceLevel | null
): Promise<PortfolioJudgeRunResult> {
  const t0 = Date.now();
  const anthropic = getAnthropic();
  const aud = audienceDirective(audience);
  const sourceCount = factSheet.sources.length;

  const userMessage = `EXACT METRICS:
${renderMetricsBrief(metrics)}

MACRO REGIME${factSheet.macroSourceIndexes.length ? ` (${factSheet.macroSourceIndexes.map((i) => `#${i}`).join(", ")})` : ""}:
${factSheet.macroRegime}

RISK ANALYST FINDINGS:
${renderAgentFindings(agents)}

Synthesize the final audit now via report_audit. Remember: exactly four scenarios (Recession, Rate Shock (+150bps), Tariff / Trade War, Tech-Led Selloff) and a ranked hedge list.`;

  const response = await anthropic.messages.create({
    model: MODELS.cio, // Sonnet — the high-stakes synthesis
    max_tokens: 2000,
    system: [
      { type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } },
      ...(aud ? [{ type: "text" as const, text: aud }] : []),
    ],
    tools: [REPORT_TOOL],
    tool_choice: { type: "tool", name: REPORT_TOOL.name },
    messages: [{ role: "user", content: userMessage }],
  });

  const toolUse = response.content.find(
    (b) => b.type === "tool_use" && b.name === REPORT_TOOL.name
  );
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("[PortfolioJudge] no tool_use in response.");
  }

  const input = toolUse.input as {
    healthScore: number;
    healthGrade: string;
    assessment: string;
    scenarios: Array<{
      name: string;
      estImpactPct: string;
      narrative: string;
      hardestHit: string[];
      severity: Severity;
      sourceIndexes?: number[];
    }>;
    hedges: Array<{
      action: string;
      rationale: string;
      addresses: string[];
      priority: number;
    }>;
    bottomLine: string;
    sourceIndexes: number[];
  };

  const cleanIdx = (idxs: number[] | undefined): number[] =>
    Array.isArray(idxs)
      ? Array.from(
          new Set(idxs.filter((i) => typeof i === "number" && i >= 0 && i < sourceCount))
        )
      : [];

  const healthScore = clamp(input.healthScore);

  const scenarios: Scenario[] = (Array.isArray(input.scenarios) ? input.scenarios : [])
    .slice(0, 4)
    .map((s) => ({
      name: (s.name ?? "Scenario").trim(),
      estImpactPct: (s.estImpactPct ?? "—").trim(),
      narrative: (s.narrative ?? "").trim(),
      hardestHit: Array.isArray(s.hardestHit)
        ? s.hardestHit.map((t) => String(t).toUpperCase()).slice(0, 6)
        : [],
      severity:
        s.severity && ["low", "moderate", "elevated", "high"].includes(s.severity)
          ? s.severity
          : "moderate",
      sourceIndexes: cleanIdx(s.sourceIndexes),
    }));

  const hedges: Hedge[] = (Array.isArray(input.hedges) ? input.hedges : [])
    .map((h) => ({
      action: (h.action ?? "").trim(),
      rationale: (h.rationale ?? "").trim(),
      addresses: Array.isArray(h.addresses)
        ? (h.addresses.filter((d) => VALID_DIMS.includes(d as RiskDimension)) as RiskDimension[])
        : [],
      priority: typeof h.priority === "number" ? h.priority : 99,
    }))
    .filter((h) => h.action.length > 0)
    .sort((a, b) => a.priority - b.priority)
    .slice(0, 6);

  return {
    output: {
      healthScore,
      healthGrade: input.healthGrade?.trim() || gradeFor(healthScore),
      assessment: (input.assessment ?? "").trim(),
      scenarios,
      hedges,
      bottomLine: (input.bottomLine ?? "").trim(),
      sourceIndexes: cleanIdx(input.sourceIndexes),
      durationMs: Date.now() - t0,
    },
    costUSD: estimateCallCostUSD(MODELS.cio, response.usage),
  };
}
