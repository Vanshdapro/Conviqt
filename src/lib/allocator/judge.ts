import { getOpenAI, MODELS, estimateCallCostUSD } from "../openai";
import { audienceDirective, type ExperienceLevel } from "../agents/audience";
import { renderBaselineBrief, renderProfileBrief, renderVehicleBrief } from "./engine";
import type {
  AccountStep,
  AllocationLine,
  AllocatorFactSheet,
  AllocatorPlan,
  AssetClass,
  Baseline,
  Exclusion,
  InvestorProfile,
  Prerequisite,
  RiskLevel,
  SpecialistOutput,
} from "./types";

// The synthesis judge. Sonnet (not Haiku) because this is the high-stakes,
// low-frequency, credit-gated step where reasoning quality shows: it folds the
// deterministic skeleton + four lane stances + sourced vehicle facts + macro
// regime into a concrete, executable allocation — specific tickers, dollar
// amounts, an account-priority order, a SIP plan, and an honest fit/exclusion
// rationale. One Sonnet call (~1.8k out) at ~3¢ is acceptable for the flagship.

const ASSET_CLASSES: AssetClass[] = [
  "Core US Equity",
  "International Equity",
  "Bonds",
  "Dividend / Income",
  "Satellite / Single Stocks",
  "Inflation Hedge",
  "Cash Buffer",
];

const SYSTEM = `You are the Chief Investment Officer synthesizing Conviqt's Allocator into a concrete plan.

Four planning agents (Growth Architect, Risk Steward, Income & Tax Strategist, Goal & Liquidity Planner) have each argued their lane. You receive their stances plus the exact deterministic skeleton (allocation percentages and dollar splits computed from the investor's own capacity), the sourced vehicle facts, and the current macro regime. Produce the final, executable plan.

Deliver via the report_plan tool:
1. profileSummary: ONE plain sentence restating who this investor is and what they're optimizing for.
2. allocation: the concrete line items. Use the deterministic skeleton's sleeves and percentages as your backbone — do NOT invent a wildly different mix. For each sleeve, assign a SPECIFIC vehicle from the VEHICLE FACTS list (real ticker), keep the weightPct from the skeleton (you may make small ±3% adjustments and must keep the total ≈100%), and write a one-sentence rationale citing the vehicle's sourced expense ratio/yield/price with (#N) where available. Set riskLevel and a plain expectedReturn band per line.
3. accountPriority: the tax-advantaged-first ordering (employer 401(k) match → Roth IRA → HSA if eligible → taxable brokerage), each with a one-line detail. Tailor to the capacity.
4. sipPlan: 2-3 sentences on automating this as a Systematic Investment Plan — what to auto-invest monthly and the discipline rationale (dollar-cost averaging, removing emotion).
5. fits: 2-4 short bullets on WHY this allocation fits the stated profile (horizon, risk, goals).
6. exclusions: 1-4 options you deliberately LEFT OUT and why they don't fit this investor (e.g. "Individual stocks — capacity and horizon don't yet justify single-name risk"; "Bonds — 30-year horizon makes them a drag").
7. expectedReturnBand + riskLevel: portfolio-level rollups in plain language.
8. bottomLine: one punchy sentence — the single most important action.

Rules:
- Reason only over the provided skeleton, facts, and stances. Never invent a price, yield, or expense ratio; cite sourced ones with (#N).
- Honor the prerequisites: if a blocking debt or emergency-fund gate exists, the profileSummary and bottomLine must acknowledge it (deploy beyond those first).
- Only use tickers that appear in VEHICLE FACTS. If a sleeve has no sourced vehicle, name the canonical one (e.g. VTI) but keep the rationale uncited.
- Conviqt markets transparency, not alpha. Expected-return bands are long-run historical ranges, not forecasts. This is analysis, not personalized financial advice.`;

const REPORT_TOOL = {
  name: "report_plan",
  description: "Emit the final allocation plan: concrete line items, account priority, SIP plan, fit and exclusion rationale.",
  input_schema: {
    type: "object" as const,
    properties: {
      profileSummary: { type: "string" },
      allocation: {
        type: "array",
        items: {
          type: "object",
          properties: {
            assetClass: { type: "string", enum: ASSET_CLASSES },
            vehicle: { type: "string", description: "Ticker or 'HYSA' / 'I-Bonds'." },
            vehicleName: { type: "string" },
            weightPct: { type: "number", minimum: 0, maximum: 100 },
            riskLevel: { type: "string", enum: ["low", "moderate", "elevated", "high"] },
            expectedReturn: { type: "string", description: "e.g. '7-10% / yr long-run'." },
            rationale: { type: "string", description: "One sentence; cite sourced facts with (#N)." },
            sourceIndexes: { type: "array", items: { type: "number" } },
          },
          required: ["assetClass", "vehicle", "vehicleName", "weightPct", "riskLevel", "expectedReturn", "rationale"],
        },
      },
      accountPriority: {
        type: "array",
        items: {
          type: "object",
          properties: {
            account: { type: "string" },
            detail: { type: "string" },
          },
          required: ["account", "detail"],
        },
      },
      sipPlan: { type: "string" },
      fits: { type: "array", items: { type: "string" } },
      exclusions: {
        type: "array",
        items: {
          type: "object",
          properties: {
            option: { type: "string" },
            reason: { type: "string" },
          },
          required: ["option", "reason"],
        },
      },
      expectedReturnBand: { type: "string" },
      riskLevel: { type: "string", enum: ["low", "moderate", "elevated", "high"] },
      bottomLine: { type: "string" },
      sourceIndexes: { type: "array", items: { type: "number" } },
    },
    required: [
      "profileSummary",
      "allocation",
      "accountPriority",
      "sipPlan",
      "fits",
      "exclusions",
      "expectedReturnBand",
      "riskLevel",
      "bottomLine",
      "sourceIndexes",
    ],
  },
};

function renderStances(specialists: SpecialistOutput[]): string {
  return specialists
    .map(
      (s) =>
        `[${s.lane}] recommends equity ${s.equityPct}%\n  ${s.stance}${
          s.endorses.length ? `\n  Endorses: ${s.endorses.map((e) => `${e.ticker} (${e.reason})`).join("; ")}` : ""
        }\n  Risk/return: ${s.riskNote}`
    )
    .join("\n\n");
}

function classifyRollups(lines: AllocationLine[]): {
  equityPct: number;
  bondPct: number;
  cashPct: number;
  altPct: number;
} {
  let equity = 0,
    bond = 0,
    cash = 0,
    alt = 0;
  for (const l of lines) {
    switch (l.assetClass) {
      case "Core US Equity":
      case "International Equity":
      case "Dividend / Income":
      case "Satellite / Single Stocks":
        equity += l.weightPct;
        break;
      case "Bonds":
        bond += l.weightPct;
        break;
      case "Inflation Hedge":
        alt += l.weightPct;
        break;
      case "Cash Buffer":
        cash += l.weightPct;
        break;
    }
  }
  const r = (n: number) => Math.round(n * 10) / 10;
  return { equityPct: r(equity), bondPct: r(bond), cashPct: r(cash), altPct: r(alt) };
}

function cleanRisk(v: unknown): RiskLevel {
  return v === "low" || v === "moderate" || v === "elevated" || v === "high" ? v : "moderate";
}

export interface AllocatorJudgeRunResult {
  output: AllocatorPlan;
  costUSD: number;
}

export async function runAllocatorJudge(
  profile: InvestorProfile,
  baseline: Baseline,
  factSheet: AllocatorFactSheet,
  specialists: SpecialistOutput[],
  audience?: ExperienceLevel | null
): Promise<AllocatorJudgeRunResult> {
  const t0 = Date.now();
  const anthropic = getOpenAI();
  const aud = audienceDirective(audience);
  const sourceCount = factSheet.sources.length;

  const lumpSum = Math.max(0, profile.lumpSum || 0);
  const monthly = Math.max(0, profile.monthlyContribution || 0);

  const userMessage = `INVESTOR PROFILE:
${renderProfileBrief(profile)}

${renderBaselineBrief(baseline)}

VEHICLE FACTS (sourced — cite with (#N)):
${renderVehicleBrief(factSheet.vehicles)}

MACRO REGIME${factSheet.macroSourceIndexes.length ? ` (${factSheet.macroSourceIndexes.map((i) => `#${i}`).join(", ")})` : ""}:
${factSheet.macroRegime}

PLANNING AGENT STANCES:
${renderStances(specialists)}

Synthesize the final plan now via report_plan. Anchor the allocation to the deterministic skeleton's sleeves and percentages, assign a real ticker from VEHICLE FACTS to each, and keep the weights summing to ≈100%.`;

  const response = await anthropic.messages.create({
    model: MODELS.cio, // Sonnet — the high-stakes synthesis
    max_tokens: 2200,
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
    throw new Error("[AllocatorJudge] no tool_use in response.");
  }

  const input = toolUse.input as {
    profileSummary: string;
    allocation: Array<{
      assetClass: AssetClass;
      vehicle: string;
      vehicleName: string;
      weightPct: number;
      riskLevel: RiskLevel;
      expectedReturn: string;
      rationale: string;
      sourceIndexes?: number[];
    }>;
    accountPriority: Array<{ account: string; detail: string }>;
    sipPlan: string;
    fits: string[];
    exclusions: Array<{ option: string; reason: string }>;
    expectedReturnBand: string;
    riskLevel: RiskLevel;
    bottomLine: string;
    sourceIndexes: number[];
  };

  const cleanIdx = (idxs: number[] | undefined): number[] =>
    Array.isArray(idxs)
      ? Array.from(new Set(idxs.filter((i) => typeof i === "number" && i >= 0 && i < sourceCount)))
      : [];

  // Normalize allocation lines; renormalize weights to sum to 100 so the
  // dollar math is exact, then attach the user's capacity splits.
  const rawLines = (Array.isArray(input.allocation) ? input.allocation : [])
    .filter((l) => l && typeof l.weightPct === "number" && l.weightPct > 0)
    .map((l) => ({
      assetClass: ASSET_CLASSES.includes(l.assetClass) ? l.assetClass : "Core US Equity",
      vehicle: (l.vehicle ?? "").toString().trim() || "VTI",
      vehicleName: (l.vehicleName ?? "").toString().trim() || (l.vehicle ?? "").toString().trim(),
      weightPct: Math.max(0, Math.min(100, l.weightPct)),
      riskLevel: cleanRisk(l.riskLevel),
      expectedReturn: (l.expectedReturn ?? "").toString().trim() || "—",
      rationale: (l.rationale ?? "").toString().trim(),
      sourceIndexes: cleanIdx(l.sourceIndexes),
    }));

  const weightSum = rawLines.reduce((s, l) => s + l.weightPct, 0) || 1;
  const allocation: AllocationLine[] = rawLines.map((l) => {
    const weightPct = Math.round((l.weightPct / weightSum) * 1000) / 10;
    return {
      ...l,
      weightPct,
      amountUSD: Math.round((weightPct / 100) * lumpSum),
      monthlyUSD: Math.round((weightPct / 100) * monthly),
    };
  });

  const rollups = classifyRollups(allocation);

  const accountPriority: AccountStep[] = (Array.isArray(input.accountPriority) ? input.accountPriority : [])
    .map((a) => ({ account: (a.account ?? "").trim(), detail: (a.detail ?? "").trim() }))
    .filter((a) => a.account.length > 0)
    .slice(0, 5);

  const fits = (Array.isArray(input.fits) ? input.fits : [])
    .map((f) => String(f).trim())
    .filter((f) => f.length > 0)
    .slice(0, 5);

  const exclusions: Exclusion[] = (Array.isArray(input.exclusions) ? input.exclusions : [])
    .map((e) => ({ option: (e.option ?? "").trim(), reason: (e.reason ?? "").trim() }))
    .filter((e) => e.option.length > 0)
    .slice(0, 4);

  // Carry the deterministic prerequisites through — the judge acknowledges them
  // in prose, but the structured gates come from the engine, not the model.
  const prerequisites: Prerequisite[] = baseline.prerequisites;

  return {
    output: {
      profileSummary: (input.profileSummary ?? "").trim(),
      prerequisites,
      allocation,
      equityPct: rollups.equityPct,
      bondPct: rollups.bondPct,
      cashPct: rollups.cashPct,
      altPct: rollups.altPct,
      expectedReturnBand: (input.expectedReturnBand ?? "").trim() || "—",
      riskLevel: cleanRisk(input.riskLevel),
      accountPriority,
      sipPlan: (input.sipPlan ?? "").trim(),
      fits,
      exclusions,
      bottomLine: (input.bottomLine ?? "").trim(),
      sourceIndexes: cleanIdx(input.sourceIndexes),
      durationMs: Date.now() - t0,
    },
    costUSD: estimateCallCostUSD(MODELS.cio, response.usage),
  };
}
