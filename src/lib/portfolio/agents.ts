import { getOpenAI, MODELS, estimateCallCostUSD } from "../openai";
import { renderMetricsBrief } from "./metrics";
import type {
  PortfolioFactSheet,
  PortfolioMetrics,
  RiskAgentOutput,
  RiskDimension,
  Severity,
} from "./types";

// The five risk specialists. Each reads the SAME deterministic metrics brief
// + macro regime (no web_search — the sweep already paid for that) and scores
// its own dimension plus an honest read of overall portfolio risk. Keeping
// each call to Haiku + ~380 tokens is the cost lever: 5 agents ≈ 1.5¢.

const SHARED_RULES = `Rules:
- Reason ONLY over the provided metrics, sector weights, and macro regime. Every number you cite must already appear in the brief. Never invent a figure.
- When you cite a sourced fact (a price, the macro regime), reference its index like (#2). Concentration/weight figures are computed deterministically — you may cite them without a source index, but cite the underlying price source when you name a specific holding's exposure.
- Be specific and quantitative. Name the actual tickers and weights driving the risk.
- score = risk in YOUR dimension only (0 = no risk, 100 = extreme). overallRisk = your honest read of the WHOLE portfolio's risk (0-100); these can differ.
- severity maps to score: 0-25 low, 26-50 moderate, 51-75 elevated, 76-100 high.
- Institutional tone. No hype. A diversified, well-sized book SHOULD score low — do not manufacture risk that isn't there.`;

const PROMPTS: Record<RiskDimension, string> = {
  Concentration: `You are the Concentration Risk analyst on Conviqt's Portfolio Auditor.
Focus: single-position and top-heavy concentration. Largest position weight, top-5 weight, HHI, number of positions. A 25%+ single name or HHI > 2500 is a serious red flag; a long tail of <2% positions is the opposite problem (di-worsification).
${SHARED_RULES}`,

  "Sector Overlap": `You are the Sector Overlap analyst on Conviqt's Portfolio Auditor.
Focus: sector and industry clustering. Is the book secretly a one-sector bet? Largest sector weight, how many sectors carry real weight, whether "different" names are the same macro trade (e.g. five mega-cap tech names). A single sector > 40% is a flag.
${SHARED_RULES}`,

  "Macro Vulnerability": `You are the Macro Vulnerability analyst on Conviqt's Portfolio Auditor.
Focus: how the basket behaves under the CURRENT macro regime (use the provided regime read). Rate sensitivity (long-duration growth vs. value), inflation exposure, recession cyclicality, USD and tariff/trade exposure. Map specific holdings to specific macro factors.
${SHARED_RULES}`,

  Correlation: `You are the Correlation Risk analyst on Conviqt's Portfolio Auditor.
Focus: hidden co-movement. How many of these names actually move together (same factor: high-beta tech, rate-sensitive, same supply chain, same end-market)? A book of 15 names that all rally and fall together has the diversification of 3. Estimate the effective number of independent bets.
${SHARED_RULES}`,

  "Hidden Exposure": `You are the Hidden Exposure analyst on Conviqt's Portfolio Auditor.
Focus: exposures hiding in plain sight. A single-stock dependency repeated across ETFs and direct holdings (e.g. NVDA showing up directly AND inside QQQ AND inside a semis ETF), a shared customer/supplier (everyone selling to one hyperscaler), a single-country or single-commodity dependency, or a factor tilt the holder didn't intend. Surface the non-obvious.
${SHARED_RULES}`,
};

const LANES: RiskDimension[] = [
  "Concentration",
  "Sector Overlap",
  "Macro Vulnerability",
  "Correlation",
  "Hidden Exposure",
];

const REPORT_TOOL = {
  name: "report_risk",
  description: "Report your dimension risk score, overall-risk read, finding, and flagged tickers.",
  input_schema: {
    type: "object" as const,
    properties: {
      score: { type: "number", minimum: 0, maximum: 100, description: "Risk in your dimension (0-100)." },
      overallRisk: { type: "number", minimum: 0, maximum: 100, description: "Your read of total portfolio risk (0-100)." },
      severity: { type: "string", enum: ["low", "moderate", "elevated", "high"] },
      finding: { type: "string", description: "2-3 sentences, specific tickers + weights, cite sourced facts with (#N)." },
      flaggedTickers: { type: "array", items: { type: "string" }, description: "Tickers driving this risk." },
      sourceIndexes: { type: "array", items: { type: "number" }, description: "Source indexes for any sourced fact cited." },
    },
    required: ["score", "overallRisk", "severity", "finding", "flaggedTickers", "sourceIndexes"],
  },
};

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function severityFor(score: number): Severity {
  if (score <= 25) return "low";
  if (score <= 50) return "moderate";
  if (score <= 75) return "elevated";
  return "high";
}

export interface RiskAgentRunResult {
  output: RiskAgentOutput;
  costUSD: number;
}

async function runOne(
  dimension: RiskDimension,
  metricsBrief: string,
  macroBlock: string,
  sourceCount: number
): Promise<RiskAgentRunResult> {
  const t0 = Date.now();
  const anthropic = getOpenAI();

  const userMessage = `PORTFOLIO METRICS (deterministic — exact):
${metricsBrief}

${macroBlock}

Issue your risk read now using the report_risk tool. Stay in your lane (${dimension}).`;

  const response = await anthropic.messages.create({
    model: MODELS.specialist,
    max_tokens: 380,
    system: [{ type: "text", text: PROMPTS[dimension], cache_control: { type: "ephemeral" } }],
    tools: [REPORT_TOOL],
    tool_choice: { type: "tool", name: REPORT_TOOL.name },
    messages: [{ role: "user", content: userMessage }],
  });

  const toolUse = response.content.find(
    (b) => b.type === "tool_use" && b.name === REPORT_TOOL.name
  );
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error(`[${dimension}] no tool_use in response.`);
  }

  const input = toolUse.input as {
    score: number;
    overallRisk: number;
    severity: Severity;
    finding: string;
    flaggedTickers: string[];
    sourceIndexes: number[];
  };

  const score = clamp(input.score);
  const cleanIndexes = Array.isArray(input.sourceIndexes)
    ? Array.from(
        new Set(
          input.sourceIndexes.filter(
            (i) => typeof i === "number" && i >= 0 && i < sourceCount
          )
        )
      )
    : [];

  return {
    output: {
      dimension,
      score,
      overallRisk: clamp(input.overallRisk),
      severity:
        input.severity && ["low", "moderate", "elevated", "high"].includes(input.severity)
          ? input.severity
          : severityFor(score),
      finding: (input.finding ?? "").trim(),
      flaggedTickers: Array.isArray(input.flaggedTickers)
        ? input.flaggedTickers.map((t) => String(t).toUpperCase()).slice(0, 8)
        : [],
      sourceIndexes: cleanIndexes,
      durationMs: Date.now() - t0,
    },
    costUSD: estimateCallCostUSD(MODELS.specialist, response.usage),
  };
}

export function runRiskAgent(
  dimension: RiskDimension,
  factSheet: PortfolioFactSheet,
  metrics: PortfolioMetrics
): Promise<RiskAgentRunResult> {
  const metricsBrief = renderMetricsBrief(metrics);
  const macroBlock = `MACRO REGIME${factSheet.macroSourceIndexes.length ? ` (${factSheet.macroSourceIndexes.map((i) => `#${i}`).join(", ")})` : ""}:
${factSheet.macroRegime}`;
  return runOne(dimension, metricsBrief, macroBlock, factSheet.sources.length);
}

export { LANES as RISK_DIMENSIONS };
