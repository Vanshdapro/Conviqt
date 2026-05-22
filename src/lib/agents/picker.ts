import {
  getAnthropic,
  MODELS,
  WEB_SEARCH_TOOL,
  estimateCallCostUSD,
} from "../anthropic";
import { VALID_TICKER_RE } from "./router";
import { pickerRecentTickers, pickerRecordTickers } from "../cache";

// Stock picker agent. Sonnet + web_search. Surveys current market themes
// and emits 1-3 tickers worth running a full Council on, each with a
// short setup thesis and the cited sources backing it.
//
// We deliberately stop here: the chat route can chain runCouncil() on
// each pick if the user wants the full report. That keeps the picker
// call cheap (5-8 cents) and makes deeper analysis opt-in.
//
// Picker memory: we feed in the last 24h of tickers we already surfaced
// and ask the model to avoid them unless the setup has materially
// changed. Fixes the "AAPL every day" failure mode the stress test
// flagged (fix #14).

const SYSTEM_BASE = `You are the Conviqt stock picker.

Your job: survey current US equity market conditions and surface 1-3 specific US-listed tickers that look like high-quality setups RIGHT NOW. Setup quality matters more than gut excitement — you are looking for asymmetric risk/reward with a clear narrative trigger.

Procedure:
1. Use web_search (up to 5 queries) to scan: this week's biggest movers, sector rotation themes, recent earnings beats/misses, macro shifts, notable insider buying clusters, any clean technical setups.
2. Pick 1-3 tickers that BEST fit the "asymmetric setup with a clear trigger" filter. Quality over quantity. Returning one strong pick beats returning three mediocre ones.
3. Call report_picks ONCE with your final list.

Rules:
- Tickers must be real US-listed equities (1-5 uppercase letters, optional .A/.B).
- Every pick MUST cite at least one sourceIndex.
- Each thesis is 2-3 sentences. Lead with the trigger. End with the primary risk.
- If conditions are genuinely unattractive, return zero picks and explain in the rationale.
- Never recommend penny stocks (under $5), OTC names, or obvious meme plays without strong setup justification.
- Be honest about uncertainty. You are surfacing candidates, not promising returns.`;

const REPORT_PICKS_TOOL = {
  name: "report_picks",
  description: "Emit 0-3 candidate tickers with cited setup theses.",
  input_schema: {
    type: "object" as const,
    properties: {
      regime: {
        type: "string",
        description:
          "One sentence describing the current market regime your picks lean into (e.g. 'late-cycle tech consolidation with rotation toward profitable AI infra names').",
      },
      sources: {
        type: "array",
        items: {
          type: "object",
          properties: {
            url: { type: "string" },
            title: { type: "string" },
            publisher: { type: "string" },
          },
          required: ["url", "title", "publisher"],
        },
      },
      picks: {
        type: "array",
        items: {
          type: "object",
          properties: {
            ticker: { type: "string" },
            companyName: { type: "string" },
            thesis: {
              type: "string",
              description:
                "2-3 sentences. Trigger → setup → primary risk. Cite source indexes inline.",
            },
            sourceIndexes: {
              type: "array",
              items: { type: "number" },
            },
          },
          required: ["ticker", "companyName", "thesis", "sourceIndexes"],
        },
      },
      rationale: {
        type: "string",
        description:
          "If returning zero picks, explain why nothing met the bar. Optional otherwise.",
      },
    },
    required: ["regime", "sources", "picks"],
  },
};

export interface PickerSource {
  url: string;
  title: string;
  publisher: string;
}

export interface Pick {
  ticker: string;
  companyName: string;
  thesis: string;
  sourceIndexes: number[];
}

export interface PickerResult {
  regime: string;
  picks: Pick[];
  sources: PickerSource[];
  rationale?: string;
  asOf: string;
  costUSD: number;
  durationMs: number;
  webSearchCount: number;
}

export async function runPicker(): Promise<PickerResult> {
  const t0 = Date.now();
  const anthropic = getAnthropic();

  const recent = pickerRecentTickers();
  const recentBlock =
    recent.length > 0
      ? `\n\nYou have surfaced these tickers in the last 24 hours: ${[...new Set(recent)].join(", ")}. Do NOT repeat them unless the setup has materially changed since (new earnings print, fresh macro catalyst, technical breakout). Prefer fresh names.`
      : "";

  const SYSTEM = SYSTEM_BASE + recentBlock;

  const response = await anthropic.messages.create({
    model: MODELS.picker,
    max_tokens: 3000,
    system: SYSTEM,
    tools: [WEB_SEARCH_TOOL, REPORT_PICKS_TOOL],
    messages: [
      {
        role: "user",
        content: `Scan today's US equity market and return your best 1-3 setups. If nothing meets the bar, return zero picks with a rationale.`,
      },
    ],
  });

  // Log every web_search the picker fired (fix #12 parity with sweep).
  for (const block of response.content) {
    if (block.type === "server_tool_use" && block.name === WEB_SEARCH_TOOL.name) {
      const query =
        (block.input as { query?: string } | undefined)?.query ?? "(no query)";
      console.log(`[picker] web_search: ${query}`);
    }
  }

  const toolUse = response.content.find(
    (b) => b.type === "tool_use" && b.name === REPORT_PICKS_TOOL.name
  );
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error(
      `[Picker] No report_picks tool call. stop_reason=${response.stop_reason}.`
    );
  }

  const input = toolUse.input as {
    regime: string;
    sources: PickerSource[];
    picks: Array<{
      ticker: string;
      companyName: string;
      thesis: string;
      sourceIndexes: number[];
    }>;
    rationale?: string;
  };

  const sources = input.sources ?? [];

  // Validate picks: require valid ticker shape (now tightened — shares
  // the single source-of-truth regex with the router), at least one valid
  // cited source. Picks failing validation are dropped silently — better
  // to show fewer good picks than a fake-looking one.
  const cleanPicks: Pick[] = [];
  for (const p of input.picks ?? []) {
    const ticker = (p.ticker ?? "").trim().toUpperCase();
    if (!VALID_TICKER_RE.test(ticker)) continue;
    const indexes = Array.isArray(p.sourceIndexes)
      ? p.sourceIndexes.filter(
          (i) => typeof i === "number" && i >= 0 && i < sources.length
        )
      : [];
    if (indexes.length === 0) continue;
    cleanPicks.push({
      ticker,
      companyName: p.companyName?.trim() || ticker,
      thesis: p.thesis?.trim() ?? "",
      sourceIndexes: Array.from(new Set(indexes)),
    });
  }

  // Record what we surfaced so the next call can avoid repeating it.
  if (cleanPicks.length > 0) {
    pickerRecordTickers(cleanPicks.map((p) => p.ticker));
  }

  const webSearchCount = response.content.filter(
    (b) =>
      b.type === "server_tool_use" && b.name === WEB_SEARCH_TOOL.name
  ).length;
  const costUSD = estimateCallCostUSD(
    MODELS.picker,
    response.usage,
    webSearchCount
  );

  return {
    regime: input.regime?.trim() ?? "",
    picks: cleanPicks,
    sources,
    rationale: input.rationale?.trim() || undefined,
    asOf: new Date().toISOString(),
    costUSD,
    durationMs: Date.now() - t0,
    webSearchCount,
  };
}
