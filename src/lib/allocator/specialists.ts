import { getAnthropic, MODELS, estimateCallCostUSD } from "../anthropic";
import { renderBaselineBrief, renderProfileBrief, renderVehicleBrief } from "./engine";
import type {
  AllocatorFactSheet,
  Baseline,
  InvestorProfile,
  SpecialistLane,
  SpecialistOutput,
  VehiclePick,
} from "./types";

// The four planning specialists. Each reads the SAME inputs — the investor
// profile, the deterministic baseline skeleton, the sourced vehicle facts, and
// the macro regime — and argues its lane. No web_search (the sweep already paid
// for that). Each call is Haiku, tool-forced, ~420 tokens out — four lanes ≈ 1.3¢.
//
// This is the "step-by-step reasoning from different agent perspectives" the
// product promises: four genuinely different lenses on the same money, whose
// equityPct reads feed a transparent disagreement score.

const SHARED_RULES = `Rules:
- Reason over the provided profile, the deterministic skeleton, the sourced vehicle facts, and the macro regime. Every market NUMBER you cite (a price, expense ratio, yield, the regime) must already appear in the facts; reference it as (#N). Allocation percentages come from the skeleton and need no citation.
- Stay in YOUR lane. You are one of four voices; you are not writing the whole plan.
- Only endorse vehicles that appear in the VEHICLE FACTS list. Use their real tickers.
- equityPct = the TOTAL equity weight (0-100) you would recommend for THIS investor given your lens. Be honest — if your lane argues for less equity (Risk Steward) or more (Growth Architect), say so; the spread across lanes is shown to the user as a disagreement signal.
- Respect the prerequisites: if high-interest debt or a missing emergency fund is flagged, factor that into how aggressively capital should be deployed.
- Institutional, plain tone. No hype. This is analysis, not personalized financial advice.`;

const PROMPTS: Record<SpecialistLane, string> = {
  "Growth Architect": `You are the Growth Architect on Conviqt's Allocator.
Your lens: the long-term compounding engine. You argue for the equity core and, where the profile genuinely supports it, satellite tilts (international, sector, single names). You think in decades and dollar-cost averaging. You push equity weight UP when the horizon is long and the risk tolerance allows — but you do not override a short horizon or a conservative mandate.
${SHARED_RULES}`,

  "Risk Steward": `You are the Risk Steward on Conviqt's Allocator.
Your lens: downside protection and volatility budgeting. You argue for the bond/cash sleeve, the 5% cash buffer, and right-sizing equity so the investor can actually hold through a 20-30% drawdown without panic-selling. You push equity weight DOWN when the horizon is short, the risk tolerance is conservative, or a near-term goal needs the money. You name the specific drawdown this book could see under the current regime.
${SHARED_RULES}`,

  "Income & Tax Strategist": `You are the Income & Tax Strategist on Conviqt's Allocator.
Your lens: yield and account location. You weigh dividend/income vehicles and current yields (money-market, bond, dividend ETF, I-Bonds) against the investor's goals, and you map the deployment to the right ACCOUNTS in priority order — employer 401(k) match first, then Roth IRA, then HSA, then taxable — explaining the tax advantage of each. You flag when chasing yield would hurt a long-horizon investor.
${SHARED_RULES}`,

  "Goal & Liquidity Planner": `You are the Goal & Liquidity Planner on Conviqt's Allocator.
Your lens: matching money to timelines. You check each stated goal against its horizon and flag mismatches (e.g. equities for a house down payment in 2 years is wrong; cash for a 30-year retirement goal is wrong). You enforce the prerequisites — debt payoff and the emergency fund — as gates that come before or alongside the allocation. You make sure the liquidity profile fits real life.
${SHARED_RULES}`,
};

const LANES: SpecialistLane[] = [
  "Growth Architect",
  "Risk Steward",
  "Income & Tax Strategist",
  "Goal & Liquidity Planner",
];

const REPORT_TOOL = {
  name: "report_stance",
  description: "Report your lane's recommended equity weight, cited stance, endorsed vehicles, and risk/return note.",
  input_schema: {
    type: "object" as const,
    properties: {
      equityPct: { type: "number", minimum: 0, maximum: 100, description: "Total equity weight you'd recommend (0-100)." },
      stance: { type: "string", description: "2-4 sentences in your lane, citing sourced facts with (#N)." },
      endorses: {
        type: "array",
        description: "Vehicles from the VEHICLE FACTS list you endorse, each with a one-line reason.",
        items: {
          type: "object",
          properties: {
            ticker: { type: "string" },
            reason: { type: "string" },
          },
          required: ["ticker", "reason"],
        },
      },
      riskNote: { type: "string", description: "Plain-language risk/return read for your recommendation." },
      sourceIndexes: { type: "array", items: { type: "number" }, description: "Source indexes for any sourced fact cited." },
    },
    required: ["equityPct", "stance", "endorses", "riskNote", "sourceIndexes"],
  },
};

function clampPct(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

export interface SpecialistRunResult {
  output: SpecialistOutput;
  costUSD: number;
}

async function runOne(
  lane: SpecialistLane,
  userMessage: string,
  sourceCount: number,
  validTickers: Set<string>
): Promise<SpecialistRunResult> {
  const t0 = Date.now();
  const anthropic = getAnthropic();

  const response = await anthropic.messages.create({
    model: MODELS.specialist,
    max_tokens: 480,
    system: [{ type: "text", text: PROMPTS[lane], cache_control: { type: "ephemeral" } }],
    tools: [REPORT_TOOL],
    tool_choice: { type: "tool", name: REPORT_TOOL.name },
    messages: [{ role: "user", content: userMessage }],
  });

  const toolUse = response.content.find(
    (b) => b.type === "tool_use" && b.name === REPORT_TOOL.name
  );
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error(`[${lane}] no tool_use in response.`);
  }

  const input = toolUse.input as {
    equityPct: number;
    stance: string;
    endorses: Array<{ ticker: string; reason: string }>;
    riskNote: string;
    sourceIndexes: number[];
  };

  const cleanIndexes = Array.isArray(input.sourceIndexes)
    ? Array.from(
        new Set(
          input.sourceIndexes.filter((i) => typeof i === "number" && i >= 0 && i < sourceCount)
        )
      )
    : [];

  const endorses: VehiclePick[] = (Array.isArray(input.endorses) ? input.endorses : [])
    .map((e) => ({ ticker: String(e.ticker ?? "").toUpperCase(), reason: (e.reason ?? "").trim() }))
    .filter((e) => validTickers.has(e.ticker) && e.reason.length > 0)
    .slice(0, 6);

  return {
    output: {
      lane,
      equityPct: clampPct(input.equityPct),
      stance: (input.stance ?? "").trim(),
      endorses,
      riskNote: (input.riskNote ?? "").trim(),
      sourceIndexes: cleanIndexes,
      durationMs: Date.now() - t0,
    },
    costUSD: estimateCallCostUSD(MODELS.specialist, response.usage),
  };
}

function buildUserMessage(
  profile: InvestorProfile,
  baseline: Baseline,
  factSheet: AllocatorFactSheet,
  lane: SpecialistLane
): string {
  const macroBlock = `MACRO REGIME${
    factSheet.macroSourceIndexes.length
      ? ` (${factSheet.macroSourceIndexes.map((i) => `#${i}`).join(", ")})`
      : ""
  }:
${factSheet.macroRegime}`;

  return `INVESTOR PROFILE:
${renderProfileBrief(profile)}

${renderBaselineBrief(baseline)}

VEHICLE FACTS (sourced — cite with (#N)):
${renderVehicleBrief(factSheet.vehicles)}

${macroBlock}

Issue your stance now using the report_stance tool. Stay in your lane (${lane}).`;
}

export function runSpecialist(
  lane: SpecialistLane,
  profile: InvestorProfile,
  baseline: Baseline,
  factSheet: AllocatorFactSheet
): Promise<SpecialistRunResult> {
  const validTickers = new Set(factSheet.vehicles.map((v) => v.ticker.toUpperCase()));
  const msg = buildUserMessage(profile, baseline, factSheet, lane);
  return runOne(lane, msg, factSheet.sources.length, validTickers);
}

export { LANES as SPECIALIST_LANES };
