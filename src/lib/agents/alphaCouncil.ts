import { getOpenAI, MODELS, estimateCallCostUSD } from "../openai";
import type { FactSheet } from "./types";
import type { AlphaLens, LensScore, LensSignal, MosaicScan } from "../alphaTypes";

// The 6-Lens Council — the analyst bench between the scout and the CIO.
//
// On a real desk this is six specialists (Fundamental, Valuation, Catalyst,
// Risk, Technical, Sentiment) each writing a memo. We honor that analytical
// framework but collapse it into ONE tight Haiku call that scores all six
// lenses at once. That keeps cost at well under a cent per candidate while
// still producing the full scorecard the CIO weighs and the UI renders.
//
// Scoring convention: every lens is 0-10 where HIGHER IS BETTER, including
// Risk (10 = low/contained risk, 0 = severe risk). This lets the CIO and the
// UI treat the six numbers uniformly.

const LENSES: AlphaLens[] = [
  "Fundamental",
  "Valuation",
  "Catalyst",
  "Risk",
  "Technical",
  "Sentiment",
];

const SYSTEM = `You are the analyst bench for Conviqt's paper trading desk. You score ONE candidate across six independent lenses, then call report_lenses ONCE.

You receive a cited FactSheet. Use ONLY those facts. Never invent a number. Cite the source index for any number you lean on.

The six lenses (score each 0-10, where 10 is the most favorable for going long and 0 is the least favorable — this holds for Risk too, where 10 = low/contained risk):
1. Fundamental — growth, margins, free cash flow, balance sheet, capital allocation.
2. Valuation — is the price attractive vs the company's growth/quality and its own history/peers? Cheap = high score.
3. Catalyst — is there a specific, dated near-term trigger that re-rates the stock? Concrete catalyst = high score.
4. Risk — downside, volatility, leverage, single-points-of-failure, crowdedness. Low/contained risk = HIGH score.
5. Technical — trend, momentum, relative strength, key levels. Constructive setup = high score.
6. Sentiment — positioning, analyst revisions, news flow, narrative. Favorable-but-not-euphoric = high score.

Rules:
- signal: "bullish" (score >= 7), "neutral" (4-6), "bearish" (<= 3). Keep signal consistent with score.
- note: ONE sentence per lens. Name the specific number or fact that drove the score, with its source index.
- If a lens has thin or missing evidence, score it 5 / neutral and say so — do NOT guess high or low.
- If MOSAIC EDGE FACTORS are provided, weigh them into the relevant lenses (especially Catalyst, Risk, and Sentiment). These are the non-obvious "small factor" signals the crowd is not pricing — a strong, high-weight edge factor can and should move a score, and you may name it in the note.
- Be honest and discriminating. Not everything is a 7+. Strong, differentiated names earn high marks; mediocre ones should look mediocre.`;

const REPORT_LENSES_TOOL = {
  name: "report_lenses",
  description: "Emit the 0-10 score, signal, and one-line note for all six lenses.",
  input_schema: {
    type: "object" as const,
    properties: {
      lenses: {
        type: "array",
        description: "Exactly six entries, one per lens.",
        items: {
          type: "object",
          properties: {
            lens: {
              type: "string",
              enum: LENSES,
            },
            score: { type: "number", description: "0-10, higher = more favorable." },
            signal: { type: "string", enum: ["bullish", "neutral", "bearish"] },
            note: {
              type: "string",
              description: "One sentence with the driving fact and its source index.",
            },
            sourceIndexes: {
              type: "array",
              items: { type: "number" },
              description: "Source indexes for facts cited in the note.",
            },
          },
          required: ["lens", "score", "signal", "note"],
        },
      },
    },
    required: ["lenses"],
  },
};

function renderFactSheet(fs: FactSheet): string {
  const factLines = fs.facts
    .slice(0, 28) // cap to keep the prompt cheap
    .map((f) => {
      const note = f.note ? ` [${f.note}]` : "";
      const asOf = f.asOf ? ` (${f.asOf})` : "";
      return `- (${f.category}) ${f.key} = ${f.value}${note}${asOf} [src:${f.sourceIndex}]`;
    })
    .join("\n");
  const sourceLines = fs.sources
    .map((s, i) => `  [${i}] ${s.publisher} — ${s.title}`)
    .join("\n");
  return `Ticker: ${fs.ticker} — ${fs.companyName} (${fs.sector}, assetType=${fs.assetType})
${fs.narrative ? `Narrative: ${fs.narrative}\n` : ""}
Facts:
${factLines || "  (none)"}

Sources:
${sourceLines || "  (none)"}`;
}

// Render the mosaic edge factors so the council can weigh the non-obvious
// "small factor" signals into the relevant lenses. Empty when the scan found
// nothing (or failed) — the council then simply scores off the FactSheet.
function renderMosaic(mosaic?: MosaicScan): string {
  if (!mosaic || mosaic.factors.length === 0) return "";
  const lines = mosaic.factors
    .map(
      (f) =>
        `- [${f.lane}] (${f.direction}, ${f.weight} weight) ${f.factor}: ${f.detail}`
    )
    .join("\n");
  return `\n\nMOSAIC EDGE FACTORS (non-obvious "small factor" signals from the deep scan — the variant perception):
${lines}${mosaic.edgeSummary ? `\nEdge read: ${mosaic.edgeSummary}` : ""}`;
}

function clampScore(n: unknown): number {
  const v = typeof n === "number" ? n : 5;
  return Math.max(0, Math.min(10, Math.round(v * 10) / 10));
}

function deriveSignal(score: number, claimed: unknown): LensSignal {
  if (claimed === "bullish" || claimed === "neutral" || claimed === "bearish") {
    return claimed;
  }
  if (score >= 7) return "bullish";
  if (score <= 3) return "bearish";
  return "neutral";
}

export interface AlphaCouncilResult {
  lensScores: LensScore[];
  costUSD: number;
  durationMs: number;
}

export async function runAlphaCouncil(
  factSheet: FactSheet,
  mosaic?: MosaicScan
): Promise<AlphaCouncilResult> {
  const t0 = Date.now();
  const anthropic = getOpenAI();

  const response = await anthropic.messages.create({
    model: MODELS.council,
    max_tokens: 900,
    system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
    tools: [REPORT_LENSES_TOOL],
    tool_choice: { type: "tool", name: REPORT_LENSES_TOOL.name },
    messages: [
      {
        role: "user",
        content: `Score this candidate across all six lenses, then call report_lenses.\n\n${renderFactSheet(factSheet)}${renderMosaic(mosaic)}`,
      },
    ],
  });

  const costUSD = estimateCallCostUSD(MODELS.council, response.usage);

  const toolUse = response.content.find(
    (b) => b.type === "tool_use" && b.name === REPORT_LENSES_TOOL.name
  );

  if (!toolUse || toolUse.type !== "tool_use") {
    // Non-fatal: return a neutral scorecard so the CIO can still proceed.
    console.warn(
      `[AlphaCouncil] ${factSheet.ticker}: no report_lenses call (stop_reason=${response.stop_reason})`
    );
    return {
      lensScores: LENSES.map((lens) => ({
        lens,
        score: 5,
        signal: "neutral" as const,
        note: "Council scorecard unavailable; treated as neutral.",
      })),
      costUSD,
      durationMs: Date.now() - t0,
    };
  }

  const input = toolUse.input as {
    lenses?: Array<{
      lens?: string;
      score?: number;
      signal?: string;
      note?: string;
    }>;
  };

  const byLens = new Map<AlphaLens, LensScore>();
  for (const raw of input.lenses ?? []) {
    if (!LENSES.includes(raw.lens as AlphaLens)) continue;
    const lens = raw.lens as AlphaLens;
    const score = clampScore(raw.score);
    byLens.set(lens, {
      lens,
      score,
      signal: deriveSignal(score, raw.signal),
      note: (raw.note ?? "").trim().slice(0, 240) || "No note provided.",
    });
  }

  // Guarantee all six lenses are present and in canonical order.
  const lensScores: LensScore[] = LENSES.map(
    (lens) =>
      byLens.get(lens) ?? {
        lens,
        score: 5,
        signal: "neutral" as const,
        note: "Lens not scored; treated as neutral.",
      }
  );

  return { lensScores, costUSD, durationMs: Date.now() - t0 };
}
