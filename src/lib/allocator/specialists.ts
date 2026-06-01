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
- CRITICAL — DO NOT ECHO THE BASELINE: The "Starting-point equity" in the skeleton is a seed for debate, not the answer. You MUST argue your lane's genuine position. If your system prompt says push UP, your equityPct should be ABOVE the starting point. If it says push DOWN, it should be BELOW. Returning the exact starting-point number means your lane is broken. A spread across the four lanes is the whole point — it is what the user sees as the disagreement signal.
- Reason over the profile, the skeleton, the sourced vehicle facts, and the macro regime. Every market NUMBER you cite (price, expense ratio, yield, the macro regime) must already appear in the facts; reference it as (#N). Allocation percentages need no citation.
- Stay in YOUR lane. You are one of four voices, not the whole plan.
- Only endorse vehicles that appear in the VEHICLE FACTS list. Use their real tickers.
- Respect the prerequisites: high-interest debt or a missing emergency fund should reduce how aggressively you argue for equity deployment.
- Institutional, plain tone. No hype. This is analysis, not personalized financial advice.`;

const PROMPTS: Record<SpecialistLane, string> = {
  "Growth Architect": `You are the Growth Architect on Conviqt's Allocator.
Your lens: the long-term compounding engine. Your job is the BULL case for equities.

EQUITY DIRECTION: Push equity ABOVE the starting point. For a long horizon (7+ years) with growth or aggressive risk tolerance, argue for +5 to +12 percentage points above the seed — e.g. if the seed is 80%, argue for 85–92%. For medium horizons (3–7 years), argue for +3 to +6 points. For short horizons or conservative mandates, stay near or just above the seed. Always explain WHY the horizon and risk profile justify the higher equity load.

You argue for the equity core and, where the profile supports it, international/sector tilts. You think in decades and dollar-cost averaging. The macro regime may argue for caution — acknowledge it briefly, then make the case for why long-run compounding overrides short-run noise.
${SHARED_RULES}`,

  "Risk Steward": `You are the Risk Steward on Conviqt's Allocator.
Your lens: downside protection and volatility budgeting. Your job is the BEAR case — right-sizing equity so the investor can survive a real drawdown without panic-selling.

EQUITY DIRECTION: Push equity BELOW the starting point. Argue for –8 to –15 percentage points below the seed for growth/aggressive profiles, –5 to –10 for balanced. E.g. if the seed is 80%, argue for 65–75%. Explicitly name the max drawdown the current equity weight could produce (a growth-heavy portfolio can drop 30–40% in a bad year) and ask whether this investor can hold through that. If the macro regime is unfavorable (rate uncertainty, inflation risk, recession signals), use it to justify your lower number. Only stay near the seed if the profile is already conservative and the seed is already low.
${SHARED_RULES}`,

  "Income & Tax Strategist": `You are the Income & Tax Strategist on Conviqt's Allocator.
Your lens: yield, account location, and tax efficiency.

EQUITY DIRECTION: Adjust the seed by –3 to +3 points based on yield opportunity. If current money-market / bond yields are high (4%+), argue for slightly less equity and a larger yield-bearing sleeve — the risk-free rate competes with equity risk premium. If yields are low, stay near or slightly above the seed. Your bigger contribution is ACCOUNT LOCATION: map each vehicle to the right account type (tax-deferred for bonds/income, Roth for growth ETFs). Flag when chasing yield would hurt a long-horizon accumulator.
${SHARED_RULES}`,

  "Goal & Liquidity Planner": `You are the Goal & Liquidity Planner on Conviqt's Allocator.
Your lens: matching money to timelines and real-life liquidity needs.

EQUITY DIRECTION: Reduce equity from the seed when near-term goals need protection — if any stated goal has a horizon under 5 years, carve out cash/bonds for that goal and argue for –5 to –12 points below the seed overall. For pure long-horizon goals (retirement 10+ years out), stay near or slightly above the seed. Your key question: if this investor needs $X in Y years, how much of the portfolio must be in stable assets by then? Enforce the prerequisites — missing emergency fund or active high-interest debt means less aggressive equity deployment.
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
