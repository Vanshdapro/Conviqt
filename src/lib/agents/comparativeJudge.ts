import { getOpenAI, MODELS, estimateCallCostUSD } from "../openai";
import { audienceDirective, type ExperienceLevel } from "./audience";
import {
  CompareDimension,
  CompareEdge,
  CompareWinner,
  ComparativeVerdict,
  CouncilResult,
} from "./types";

// The comparative Judge is the third pass of a head-to-head Compare run. It
// does NOT re-fetch data or re-run specialists — both sides already have a
// full Council verdict. It reads the two completed verdicts side by side and
// issues a RELATIVE call: which name wins on valuation, positioning,
// catalysts, and risk/reward, plus an overall head-to-head verdict.
//
// Why this is a distinct output type (per the brief): no single-stock run
// produces a comparison. ChatGPT gives prose; a terminal gives two windows.
// This produces a structured verdict with stakes — the thing that's shareable.
//
// Cost discipline (CLAUDE.md): we feed the model lean per-side BRIEFS built
// from each verdict, not the raw FactSheets. Sonnet for synthesis quality;
// one tight structured tool call keeps it ~1-1.5¢.

const SYSTEM = `You are the head of research at Conviqt, issuing a HEAD-TO-HEAD verdict between two stocks.

Two stocks have each already been through the full analysis (fundamentals, technicals, sentiment, macro → final verdict). You are NOT re-analyzing either one. Your only job is the RELATIVE call: holding a dollar, which name is the better deployment of it right now, and on exactly which dimensions each one wins.

This is a comparison, not two summaries. Every field must be explicitly relative — "A trades at a 20% discount to B on forward earnings", never "A looks cheap". If you catch yourself describing one stock without reference to the other, rewrite it.

TONE AND STYLE
- Decisive, but written for a smart beginner-to-intermediate investor. Plain English; briefly gloss any technical term you must use ("forward P/E — the price relative to next year's expected earnings").
- Everything you write is shown to users VERBATIM. NEVER use internal vocabulary in any field: do not write the words "Council", "agents", "pipeline", "conviction", or "disagreement", and never quote internal N/100 scores from the briefs. Describe sureness qualitatively instead: "the analysts are more confident in A", "the team is split on B".
- No inline source citations like [#N] — the two underlying reports carry the sources.
- Specific market numbers win arguments. Use the figures in the briefs. Never invent a number that isn't there.

WHAT EACH FIELD MUST CONTAIN
- winner: "A", "B", or "TIE". TIE only when there is genuinely no decisive edge — prefer to make a call.
- headline: ONE shareable sentence that creates stakes. The best headlines name a tension, e.g. "A has the cleaner setup; B has the cheaper price — pick your risk." This is the line that gets screenshotted; make it sharp.
- summary: 3-4 sentences. Where the two diverge most, and why the winner wins despite the loser's strengths.
- dimensions: 5-8 head-to-head scorecard rows. Always include Valuation; add the most decision-relevant others (growth, margins, momentum, balance sheet, catalyst proximity, how confident the analysts are — in words, not scores). For each: side A's value and side B's value as short strings WITH UNITS, and which side the edge goes to. Use "tie" sparingly.
- valuationEdge: which is cheaper for what you get, with the specific multiples and the growth/quality that justifies (or doesn't) the gap.
- positioningEdge: who is winning the actual competitive/business battle — market share, moat, product cycle, secular tailwind.
- catalystEdge: which has the stronger or more imminent near-term catalysts, and when.
- riskRewardEdge: which offers better asymmetry — more upside per unit of downside, better downside protection.
- bottomLine: the trade in 25 words or fewer. No hedging.

Output via report_comparison.`;

const COMPARISON_TOOL = {
  name: "report_comparison",
  description: "Issue the head-to-head verdict comparing the two stocks.",
  input_schema: {
    type: "object" as const,
    properties: {
      winner: { type: "string", enum: ["A", "B", "TIE"] },
      headline: {
        type: "string",
        description:
          "One shareable sentence naming the key tension. The line that gets screenshotted.",
      },
      summary: {
        type: "string",
        description: "3-4 sentences. Where they diverge and why the winner wins. Explicitly relative.",
      },
      dimensions: {
        type: "array",
        description:
          "5-8 head-to-head rows. Must include Valuation. Never internal score rows.",
        items: {
          type: "object",
          properties: {
            dimension: { type: "string", description: "e.g. 'Valuation', 'Revenue growth', 'Momentum'" },
            aValue: { type: "string", description: "Side A value with units, e.g. '29.4x fwd P/E'" },
            bValue: { type: "string", description: "Side B value with units, e.g. '24.1x fwd P/E'" },
            edge: { type: "string", enum: ["a", "b", "tie"] },
            note: { type: "string", description: "Optional one-clause qualifier." },
          },
          required: ["dimension", "aValue", "bValue", "edge"],
        },
        minItems: 4,
        maxItems: 8,
      },
      valuationEdge: { type: "string", description: "Relative valuation with specific multiples. 1-2 sentences." },
      positioningEdge: { type: "string", description: "Who wins the competitive battle. 1-2 sentences." },
      catalystEdge: { type: "string", description: "Which has stronger/sooner catalysts. 1-2 sentences." },
      riskRewardEdge: { type: "string", description: "Which has better asymmetry. 1-2 sentences." },
      bottomLine: { type: "string", description: "The trade in 25 words or fewer. No hedging." },
    },
    required: [
      "winner",
      "headline",
      "summary",
      "dimensions",
      "valuationEdge",
      "positioningEdge",
      "catalystEdge",
      "riskRewardEdge",
      "bottomLine",
    ],
  },
};

export interface ComparativeJudgeResult {
  output: ComparativeVerdict;
  costUSD: number;
}

// Build a compact, comparison-ready brief from one side's completed Council
// run. We deliberately summarise rather than dump the raw FactSheet: the
// verdict + key metrics + bull/bear already distil what matters, and keeping
// the prompt lean is the cost lever for the Sonnet synthesis call.
function sideBrief(label: "A" | "B", r: CouncilResult): string {
  const j = r.judge;
  const metrics = j.keyMetrics
    .map((m) => `  - ${m.label}: ${m.value} (${m.signal})`)
    .join("\n");
  const cats = j.catalysts.map((c) => `  - ${c}`).join("\n");
  // Internal-only context labels: the system prompt forbids quoting these
  // scores or vocabulary back in any output field.
  return `=== SIDE ${label}: ${r.ticker} — ${r.factSheet.companyName} (${r.factSheet.sector}) ===
Verdict: ${j.verdict}  |  analyst confidence (internal, do not quote): ${j.conviction}/100  |  analyst split (internal, do not quote): ${j.disagreement}/100
Investment case: ${j.investmentCase}
Key metrics:
${metrics || "  (none)"}
Bull case: ${j.bullCase}
Bear case: ${j.bearCase}
Catalysts:
${cats || "  (none)"}
Bottom line: ${j.bottomLine}`;
}

function normalizeEdge(e: unknown): CompareEdge {
  return e === "a" || e === "b" ? e : "tie";
}

function normalizeWinner(w: unknown): CompareWinner {
  return w === "A" || w === "B" ? w : "TIE";
}

export async function runComparativeJudge(
  a: CouncilResult,
  b: CouncilResult,
  audience?: ExperienceLevel | null
): Promise<ComparativeJudgeResult> {
  const t0 = Date.now();
  const anthropic = getOpenAI();
  const aud = audienceDirective(audience);

  const response = await anthropic.messages.create({
    model: MODELS.comparativeJudge,
    max_tokens: 1600,
    system: [
      { type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } },
      ...(aud ? [{ type: "text" as const, text: aud }] : []),
    ],
    tools: [COMPARISON_TOOL],
    tool_choice: { type: "tool", name: COMPARISON_TOOL.name },
    messages: [
      {
        role: "user",
        content: `Compare these two stocks head to head. "A" is ${a.ticker}; "B" is ${b.ticker}.

${sideBrief("A", a)}

${sideBrief("B", b)}

Issue your head-to-head verdict now. Be explicitly relative on every field.`,
      },
    ],
  });

  const toolUse = response.content.find(
    (block) => block.type === "tool_use" && block.name === COMPARISON_TOOL.name
  );

  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error(
      `[ComparativeJudge] No tool_use response. Got: ${JSON.stringify(
        response.content
      ).slice(0, 200)}`
    );
  }

  const input = toolUse.input as {
    winner?: CompareWinner;
    headline?: string;
    summary?: string;
    dimensions?: Array<Partial<CompareDimension>>;
    valuationEdge?: string;
    positioningEdge?: string;
    catalystEdge?: string;
    riskRewardEdge?: string;
    bottomLine?: string;
  };

  const dimensions: CompareDimension[] = Array.isArray(input.dimensions)
    ? input.dimensions
        .filter((d) => d && d.dimension && d.aValue && d.bValue)
        .map((d) => ({
          dimension: String(d.dimension),
          aValue: String(d.aValue),
          bValue: String(d.bValue),
          edge: normalizeEdge(d.edge),
          ...(d.note ? { note: String(d.note) } : {}),
        }))
    : [];

  const costUSD = estimateCallCostUSD(MODELS.comparativeJudge, response.usage);

  return {
    output: {
      winner: normalizeWinner(input.winner),
      headline: (input.headline ?? "").trim(),
      summary: (input.summary ?? "").trim(),
      dimensions,
      valuationEdge: (input.valuationEdge ?? "").trim(),
      positioningEdge: (input.positioningEdge ?? "").trim(),
      catalystEdge: (input.catalystEdge ?? "").trim(),
      riskRewardEdge: (input.riskRewardEdge ?? "").trim(),
      bottomLine: (input.bottomLine ?? "").trim(),
      durationMs: Date.now() - t0,
    },
    costUSD,
  };
}
