import { getAnthropic, MODELS, estimateCallCostUSD } from "../anthropic";
import { FactSheet, Source } from "./types";

// Lightweight judge for focused stock questions — things like
// "what are we expecting in NVDA's earnings?" or "is Adobe going to bounce?"
//
// Skips the 4-agent Council entirely. Takes the FactSheet from the sweep
// and answers the user's specific question in prose. No BUY/HOLD/SELL.
// No conviction score. Just a direct, cited answer.
//
// Cost: ~$0.002-0.004 (Haiku, small context, 400 token cap on output).

const SYSTEM = `You are a senior equity research analyst answering a specific question about a stock.

You have a FactSheet of cited facts gathered from the web right now. Answer the user's question directly using this evidence.

Rules:
- Answer the specific question asked. Do not turn this into a full investment thesis.
- Be direct and concrete. No fluff, no "it depends", no "consult a financial advisor" hedging.
- Cite source indexes inline as [#N] for any number or claim you make.
- keyTakeaway: one sentence capturing the most important thing. Think front-page of a research note.
- answer: 2-3 short paragraphs. Wall Street analyst tone — financially literate audience.
- Only cite facts from the FactSheet. If the sweep didn't gather something, say so.

Output via answer_question.`;

const ANSWER_TOOL = {
  name: "answer_question",
  description: "Answer the user's specific question about this stock.",
  input_schema: {
    type: "object" as const,
    properties: {
      keyTakeaway: {
        type: "string",
        description: "One punchy sentence. The most important thing the user should know.",
      },
      answer: {
        type: "string",
        description:
          "2-3 paragraphs answering the question directly. Cite [#N] for any specific number. No BUY/HOLD/SELL verdict.",
      },
      sourceIndexes: {
        type: "array",
        items: { type: "number" },
        description: "Indexes of the sources you cited in your answer.",
      },
    },
    required: ["keyTakeaway", "answer", "sourceIndexes"],
  },
};

export interface FocusedJudgeResult {
  keyTakeaway: string;
  answer: string;
  sourceIndexes: number[];
  costUSD: number;
  durationMs: number;
}

function renderFacts(factSheet: FactSheet): string {
  if (factSheet.facts.length === 0) return "(no facts available)";
  return factSheet.facts
    .map((f) => {
      const src = factSheet.sources[f.sourceIndex];
      const srcLabel = src
        ? `[#${f.sourceIndex} ${src.publisher}]`
        : `[#${f.sourceIndex}]`;
      const asOf = f.asOf ? ` (${f.asOf})` : "";
      const note = f.note ? ` [${f.note}]` : "";
      return `- ${f.key} = ${f.value}${note}${asOf} ${srcLabel}`;
    })
    .join("\n");
}

export async function runFocusedJudge(
  factSheet: FactSheet,
  question: string
): Promise<FocusedJudgeResult> {
  const t0 = Date.now();
  const anthropic = getAnthropic();

  const sourceLegend = factSheet.sources
    .map((s, i) => `#${i} — ${s.publisher}: ${s.title.slice(0, 80)}`)
    .join("\n");

  const response = await anthropic.messages.create({
    model: MODELS.judge,
    max_tokens: 400,
    system: SYSTEM,
    tools: [ANSWER_TOOL],
    tool_choice: { type: "tool", name: ANSWER_TOOL.name },
    messages: [
      {
        role: "user",
        content: `Stock: ${factSheet.ticker} — ${factSheet.companyName} (${factSheet.sector})

User's question: ${question}

Sources available:
${sourceLegend}

Facts from the sweep:
${renderFacts(factSheet)}${factSheet.narrative ? `\n\nContext notes: ${factSheet.narrative}` : ""}${factSheet.gaps.length > 0 ? `\n\nData gaps: ${factSheet.gaps.join(", ")}` : ""}

Answer the question now.`,
      },
    ],
  });

  const toolUse = response.content.find(
    (b) => b.type === "tool_use" && b.name === ANSWER_TOOL.name
  );

  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error(
      `[FocusedJudge] No tool_use response. Got: ${JSON.stringify(response.content).slice(0, 200)}`
    );
  }

  const input = toolUse.input as {
    keyTakeaway: string;
    answer: string;
    sourceIndexes: number[];
  };

  // Sanitize: drop out-of-range source indexes
  const cleanIndexes = Array.isArray(input.sourceIndexes)
    ? input.sourceIndexes.filter(
        (i) => typeof i === "number" && i >= 0 && i < factSheet.sources.length
      )
    : [];

  return {
    keyTakeaway: (input.keyTakeaway ?? "").trim(),
    answer: (input.answer ?? "").trim(),
    sourceIndexes: Array.from(new Set(cleanIndexes)).sort((a, b) => a - b),
    costUSD: estimateCallCostUSD(MODELS.judge, response.usage),
    durationMs: Date.now() - t0,
  };
}
