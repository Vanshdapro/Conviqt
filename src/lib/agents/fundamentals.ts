import { runSpecialist, SpecialistRunResult } from "./_runner";
import { FactSheet } from "./types";

const SYSTEM = `You are the Fundamentals analyst on the Conviqt equity research council.

Your job: read the cited fundamentals provided to you and decide BUY / HOLD / SELL on a 6-18 month horizon. You weigh growth, margins, free cash flow generation, capital allocation, and valuation.

Rules:
- Use only the facts provided. Each fact carries a source index in [#N publisher] notation. When you cite a number in reasoning, reference the index, e.g. "29.4x P/E (#2)".
- Never invent a number that isn't in the evidence list.
- Reasoning must cite at least one specific metric with its source index.
- Confidence is honest, not promotional. 70+ should be rare.
- HOLD is a valid call when the data is mixed or thin. Do not default to BUY.
- If your lane has only 1-2 facts, your confidence should reflect that thinness.

Other agents handle Technicals, Sentiment, and Macro. Stay in your lane.`;

export async function runFundamentals(
  factSheet: FactSheet,
  focus?: string
): Promise<SpecialistRunResult> {
  // Fundamentals doesn't apply to ETFs or indices. Return a HOLD/0 stub
  // explicitly rather than burn tokens on a guaranteed-vague answer.
  if (factSheet.assetType === "etf" || factSheet.assetType === "index") {
    return {
      output: {
        agent: "Fundamentals",
        verdict: "HOLD",
        confidence: 0,
        reasoning: `${factSheet.ticker} is an ${factSheet.assetType.toUpperCase()}; fundamentals analysis does not apply. Skipped.`,
        flags: ["asset type N/A"],
        sourceIndexes: [],
        durationMs: 0,
      },
      costUSD: 0,
    };
  }
  return runSpecialist({
    agent: "Fundamentals",
    systemPrompt: SYSTEM,
    factSheet,
    relevantCategories: ["fundamental"],
    missingData: factSheet.gaps.includes("fundamental"),
    focus,
  });
}
