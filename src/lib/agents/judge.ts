import { getAnthropic, MODELS, estimateCallCostUSD } from "../anthropic";
import {
  AgentName,
  AgentOutput,
  Fact,
  FactSheet,
  JudgeOutput,
  KeyMetric,
  Verdict,
} from "./types";

// Judge synthesizes the four specialist verdicts into a full research note.
//
// Output is structured as an institutional-grade conviction call — not a
// summary paragraph but a proper PM memo with investment case, key metrics,
// bull/bear cases, catalysts, and a bottom-line sentence.
//
// Citation style: NO inline [#N] in prose. Sources are footnoted by the UI.
// The judge writes clean, authoritative prose like a Goldman Sachs internal note.

const SYSTEM = `You are the Chief Investment Officer of the Conviqt equity research council.

Four specialist analysts (Fundamentals, Technicals, Sentiment, Macro) have issued verdicts with evidence. You synthesize them into a final conviction call formatted as an institutional research note.

TONE AND STYLE
- Write like a Goldman Sachs or Point72 PM's internal conviction memo. Authoritative. No hedging language.
- No inline source citations like [#0] or [#N] in any prose field — keep the writing clean. Sources are shown separately in a footnote section.
- No "we believe", "our view", or "thesis". Write as if issuing a standalone verdict to a portfolio committee.
- Specific numbers are your credibility. Never be vague when you have data from the FactSheet or specialists.
- Bull and bear cases must be concrete: specific metrics, specific risks, realistic timelines.

WHAT EACH FIELD MUST CONTAIN
- investmentCase: 3-4 sentences. What is currently priced in, what the market is missing, and why this verdict is the right call at this moment. This is your opening argument — make it count.
- keyMetrics: the 5-7 most decision-relevant data points from the FactSheet and specialist reasoning. Signal = "bullish" if the metric argues for owning, "bearish" if it argues against, "neutral" if mixed/ambiguous.
- bullCase: 2-3 sentences. The single strongest reason to be long — specific catalyst, supporting data, and realistic time horizon.
- bearCase: 2-3 sentences. The single strongest reason to avoid — specific risk, the scenario that would prove bulls wrong, and magnitude of potential downside.
- catalysts: 2-4 near-term events (next 3-6 months) that will re-rate the stock in either direction. Be specific (earnings date, product launch, regulatory decision, macro event). One tight sentence each.
- bottomLine: One punchy sentence. The trade in 20 words or less. No hedging.

Output via report_judgment.`;

const JUDGMENT_TOOL = {
  name: "report_judgment",
  description: "Issue the final conviction call and full research note.",
  input_schema: {
    type: "object" as const,
    properties: {
      verdict: {
        type: "string",
        enum: ["BUY", "HOLD", "SELL"],
      },
      conviction: {
        type: "number",
        minimum: 0,
        maximum: 100,
        description: "Quality-weighted conviction in the final call. Honest — institutional analysts rarely exceed 75.",
      },
      investmentCase: {
        type: "string",
        description: "3-4 sentences. What is priced in, what the market is missing, why this verdict now. Clean prose — no [#N] citations.",
      },
      keyMetrics: {
        type: "array",
        description: "5-7 most decision-relevant data points. Pull real numbers from the FactSheet.",
        items: {
          type: "object",
          properties: {
            label: { type: "string", description: "Short metric name, e.g. 'Forward P/E', 'Revenue YoY', 'RSI 14-day'" },
            value: { type: "string", description: "Value with units, e.g. '65.8x', '+34% YoY', '72'" },
            signal: { type: "string", enum: ["bullish", "bearish", "neutral"] },
          },
          required: ["label", "value", "signal"],
        },
        minItems: 3,
        maxItems: 7,
      },
      bullCase: {
        type: "string",
        description: "2-3 sentences. Strongest reason to be long — specific catalyst, data, time horizon. No [#N].",
      },
      bearCase: {
        type: "string",
        description: "2-3 sentences. Strongest reason to avoid — specific risk, scenario, downside magnitude. No [#N].",
      },
      catalysts: {
        type: "array",
        description: "2-4 near-term events that will re-rate the stock. One tight sentence each.",
        items: { type: "string" },
        minItems: 2,
        maxItems: 4,
      },
      bottomLine: {
        type: "string",
        description: "Single punchy conviction sentence. The trade in 20 words or less.",
      },
      dissents: {
        type: "array",
        items: { type: "string", enum: ["Fundamentals", "Technicals", "Sentiment", "Macro"] },
        description: "Specialists whose verdict disagrees with yours.",
      },
    },
    required: [
      "verdict",
      "conviction",
      "investmentCase",
      "keyMetrics",
      "bullCase",
      "bearCase",
      "catalysts",
      "bottomLine",
      "dissents",
    ],
  },
};

export interface JudgeRunResult {
  output: Omit<JudgeOutput, "disagreement">;
  costUSD: number;
}

function renderJudgeFacts(facts: Fact[], factSheet: FactSheet): string {
  if (facts.length === 0) return "(no facts surfaced)";
  return facts
    .map((f) => {
      const src = factSheet.sources[f.sourceIndex];
      const srcLabel = src ? `[src:${f.sourceIndex}]` : "";
      const asOf = f.asOf ? ` (${f.asOf})` : "";
      const note = f.note ? ` [${f.note}]` : "";
      return `- ${f.key} = ${f.value}${note}${asOf} ${srcLabel}`;
    })
    .join("\n");
}

export async function runJudge(
  factSheet: FactSheet,
  agents: AgentOutput[],
  options: { focus?: string } = {}
): Promise<JudgeRunResult> {
  const t0 = Date.now();
  const anthropic = getAnthropic();

  const briefing = agents
    .map(
      (a) =>
        `[${a.agent}] verdict=${a.verdict} confidence=${a.confidence}
  Reasoning: ${a.reasoning}
  Flags: ${a.flags.join(", ") || "(none)"}`
    )
    .join("\n\n");

  const sourceLegend = factSheet.sources
    .map((s, i) => `src:${i} — ${s.publisher}: ${s.title.slice(0, 80)}`)
    .join("\n");

  const citedSourceIds = new Set<number>(agents.flatMap((a) => a.sourceIndexes));
  const judgeFacts = factSheet.facts.filter(
    (f) => citedSourceIds.has(f.sourceIndex) || f.category === "identity"
  );

  const focusBlock = options.focus
    ? `\nUser focus: ${options.focus.slice(0, 240)}\nAddress this directly in your investmentCase.\n`
    : "";

  const response = await anthropic.messages.create({
    model: MODELS.judge,
    max_tokens: 1500,
    system: SYSTEM,
    tools: [JUDGMENT_TOOL],
    tool_choice: { type: "tool", name: JUDGMENT_TOOL.name },
    messages: [
      {
        role: "user",
        content: `Ticker: ${factSheet.ticker} — ${factSheet.companyName} (${factSheet.sector}, type=${factSheet.assetType})
${factSheet.narrative ? `\nContext: ${factSheet.narrative}` : ""}

Evidence sources (use src:N notation internally only — do NOT put [#N] in your prose output):
${sourceLegend}

FactSheet data points:
${renderJudgeFacts(judgeFacts, factSheet)}

Specialist reports:
${briefing}
${focusBlock}
Issue your conviction call now.`,
      },
    ],
  });

  const toolUse = response.content.find(
    (block) => block.type === "tool_use" && block.name === JUDGMENT_TOOL.name
  );

  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error(
      `[Judge] Did not return a tool_use response. Got: ${JSON.stringify(
        response.content
      ).slice(0, 200)}`
    );
  }

  const input = toolUse.input as {
    verdict: Verdict;
    conviction: number;
    investmentCase: string;
    keyMetrics: KeyMetric[];
    bullCase: string;
    bearCase: string;
    catalysts: string[];
    bottomLine: string;
    dissents: AgentName[];
  };

  const unionSourceIndexes = Array.from(
    new Set(agents.flatMap((a) => a.sourceIndexes))
  ).sort((a, b) => a - b);

  const costUSD = estimateCallCostUSD(MODELS.judge, response.usage);

  return {
    output: {
      verdict: input.verdict ?? "HOLD",
      conviction: Math.max(0, Math.min(100, Math.round(input.conviction ?? 0))),
      investmentCase: (input.investmentCase ?? "").trim(),
      keyMetrics: Array.isArray(input.keyMetrics) ? input.keyMetrics : [],
      bullCase: (input.bullCase ?? "").trim(),
      bearCase: (input.bearCase ?? "").trim(),
      catalysts: Array.isArray(input.catalysts) ? input.catalysts : [],
      bottomLine: (input.bottomLine ?? "").trim(),
      dissents: Array.isArray(input.dissents) ? input.dissents : [],
      sourceIndexes: unionSourceIndexes,
      durationMs: Date.now() - t0,
    },
    costUSD,
  };
}
