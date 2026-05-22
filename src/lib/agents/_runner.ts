import { getAnthropic, MODELS, estimateCallCostUSD } from "../anthropic";
import {
  AgentName,
  AgentOutput,
  Fact,
  FactCategory,
  FactSheet,
  Source,
  Verdict,
} from "./types";

// Tool schema every specialist agent uses to return structured output.
// Forcing tool_use means we get typed JSON, not free-form prose to regex.
// New since the chat-based pivot: sourceIndexes[] is mandatory AND must
// include at least one source whose cited fact lives in the specialist's
// own lane category. Citing only identity facts doesn't unlock the cap.
const VERDICT_TOOL = {
  name: "report_verdict",
  description:
    "Report your final verdict on the stock with a confidence score, concise reasoning, and the source indexes you cited.",
  input_schema: {
    type: "object" as const,
    properties: {
      verdict: {
        type: "string",
        enum: ["BUY", "HOLD", "SELL"],
        description:
          "Your single verdict. BUY if you would open a long position today, SELL if you would short or close longs, HOLD otherwise.",
      },
      confidence: {
        type: "number",
        minimum: 0,
        maximum: 100,
        description:
          "0 = no idea, 100 = absolute certainty. Be honest — institutional analysts rarely exceed 75.",
      },
      reasoning: {
        type: "string",
        description:
          "2-3 sentences. Concrete numbers with the source they came from. No marketing language.",
      },
      flags: {
        type: "array",
        items: { type: "string" },
        description:
          "Short tags (1-3 words each) highlighting key risks or strengths. Examples: 'margin pressure', 'overbought', 'insider selling'.",
      },
      sourceIndexes: {
        type: "array",
        items: { type: "number" },
        description:
          "Zero-based source indexes for every fact you cited in reasoning. Cite sources for in-lane evidence — citations to identity-only sources don't count and you'll get a confidence cap.",
      },
    },
    required: [
      "verdict",
      "confidence",
      "reasoning",
      "flags",
      "sourceIndexes",
    ],
  },
};

interface RunSpecialistArgs {
  agent: AgentName;
  systemPrompt: string;
  factSheet: FactSheet;
  // Which categories this specialist cares about. The runner filters the
  // fact list to those categories plus "identity" for context.
  relevantCategories: FactCategory[];
  // If true, the specialist's lane has no fact-level evidence at all.
  // Skip the API call and return HOLD/0 directly.
  missingData?: boolean;
  // Optional analytical focus passed through from the chat router.
  focus?: string;
}

export interface SpecialistRunResult {
  output: AgentOutput;
  costUSD: number;
}

// Format the facts subset as a numbered list that includes source indexes
// in line. Keeps the prompt cheap (one block per fact) while making sure
// the model has explicit pointers to cite back.
function renderFacts(
  facts: Fact[],
  sources: Source[]
): string {
  if (facts.length === 0) return "(no facts in this lane)";
  return facts
    .map((f) => {
      const src = sources[f.sourceIndex];
      const srcLabel = src
        ? `[#${f.sourceIndex} ${src.publisher}]`
        : `[#${f.sourceIndex} ?]`;
      const asOf = f.asOf ? ` (${f.asOf})` : "";
      const note = f.note ? ` [${f.note}]` : "";
      return `- ${f.key} = ${f.value}${note}${asOf} ${srcLabel}`;
    })
    .join("\n");
}

export async function runSpecialist({
  agent,
  systemPrompt,
  factSheet,
  relevantCategories,
  missingData,
  focus,
}: RunSpecialistArgs): Promise<SpecialistRunResult> {
  const t0 = Date.now();

  if (missingData) {
    return {
      output: {
        agent,
        verdict: "HOLD",
        confidence: 0,
        reasoning:
          "Insufficient data to form a verdict. Required inputs were missing or unavailable in this sweep.",
        flags: ["data unavailable"],
        sourceIndexes: [],
        durationMs: Date.now() - t0,
      },
      costUSD: 0,
    };
  }

  // Filter facts to this specialist's lane. We always include identity
  // facts (company, sector) for context.
  const categoryFilter = new Set<FactCategory>([
    "identity",
    ...relevantCategories,
  ]);
  const laneFacts = factSheet.facts.filter((f) =>
    categoryFilter.has(f.category)
  );

  // If after filtering the lane has nothing real, refuse rather than
  // calling the API for a guaranteed-vague answer.
  const nonIdentityLaneFacts = laneFacts.filter(
    (f) => f.category !== "identity"
  );
  if (nonIdentityLaneFacts.length === 0) {
    return {
      output: {
        agent,
        verdict: "HOLD",
        confidence: 0,
        reasoning: `Sweep produced no ${relevantCategories.join("/")} facts for ${factSheet.ticker}. Refusing to guess.`,
        flags: ["data unavailable"],
        sourceIndexes: [],
        durationMs: Date.now() - t0,
      },
      costUSD: 0,
    };
  }

  const focusBlock = focus
    ? `\nANALYTICAL FOCUS (from user): ${focus.slice(0, 240)}\nAddress this lens explicitly in your reasoning if it's relevant to your lane.\n`
    : "";

  const userMessage = `Ticker: ${factSheet.ticker} — ${factSheet.companyName} (${factSheet.sector}, assetType=${factSheet.assetType})

CITED EVIDENCE (your lane):
${renderFacts(laneFacts, factSheet.sources)}

${factSheet.narrative ? `NARRATIVE CONTEXT:\n${factSheet.narrative}\n\n` : ""}${focusBlock}Issue your verdict now using the report_verdict tool. Cite the source indexes for every number you reference.`;

  const anthropic = getAnthropic();
  const response = await anthropic.messages.create({
    model: MODELS.specialist,
    // 300 tokens is enough for a 2-3 sentence structured verdict.
    // Keeping this tight is the biggest per-specialist cost lever.
    max_tokens: 300,
    system: systemPrompt,
    tools: [VERDICT_TOOL],
    tool_choice: { type: "tool", name: VERDICT_TOOL.name },
    messages: [{ role: "user", content: userMessage }],
  });

  const toolUse = response.content.find(
    (block) => block.type === "tool_use" && block.name === VERDICT_TOOL.name
  );

  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error(
      `[${agent}] Did not return a tool_use response. Got: ${JSON.stringify(
        response.content
      ).slice(0, 200)}`
    );
  }

  const input = toolUse.input as {
    verdict: Verdict;
    confidence: number;
    reasoning: string;
    flags: string[];
    sourceIndexes: number[];
  };

  // Sanitize cited indexes: drop any out-of-range.
  const cleanIndexes = Array.isArray(input.sourceIndexes)
    ? Array.from(
        new Set(
          input.sourceIndexes.filter(
            (i) =>
              typeof i === "number" &&
              i >= 0 &&
              i < factSheet.sources.length
          )
        )
      )
    : [];

  // Lane-matched citation check (#7 in the stress test). At least one
  // cited fact must belong to the specialist's actual lane category, not
  // just identity. Otherwise the model can game the cap by citing the
  // company name fact.
  const laneCategorySet = new Set<FactCategory>(relevantCategories);
  const citedFactsByIndex = new Map<number, Fact>();
  for (const f of factSheet.facts) {
    if (!citedFactsByIndex.has(f.sourceIndex)) {
      citedFactsByIndex.set(f.sourceIndex, f);
    }
  }
  // Better: check ALL facts citing each cited source index, since one
  // source can back multiple facts in multiple categories.
  const citedLaneFacts = factSheet.facts.filter(
    (f) =>
      cleanIndexes.includes(f.sourceIndex) &&
      laneCategorySet.has(f.category)
  );

  const rawConfidence = Math.max(
    0,
    Math.min(100, Math.round(input.confidence))
  );

  let confidence = rawConfidence;
  const capFlags: string[] = [];
  if (cleanIndexes.length === 0) {
    confidence = Math.min(confidence, 30);
    capFlags.push("no citations");
  } else if (citedLaneFacts.length === 0) {
    confidence = Math.min(confidence, 30);
    capFlags.push("off-lane citations");
  }

  const baseFlags = Array.isArray(input.flags) ? input.flags.slice(0, 5) : [];
  const flags = [...baseFlags, ...capFlags];

  const costUSD = estimateCallCostUSD(MODELS.specialist, response.usage);

  return {
    output: {
      agent,
      verdict: input.verdict,
      confidence,
      reasoning: (input.reasoning ?? "").trim(),
      flags,
      sourceIndexes: cleanIndexes,
      durationMs: Date.now() - t0,
    },
    costUSD,
  };
}
