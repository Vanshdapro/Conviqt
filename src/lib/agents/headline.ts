import {
  getAnthropic,
  MODELS,
  WEB_SEARCH_COST_USD,
  estimateCallCostUSD,
} from "../anthropic";
import { normalizeUrl, hostOf } from "../url-normalize";
import { audienceDirective, type ExperienceLevel } from "./audience";
import { extractCanonicalUrls, type ContentBlockLike } from "./provenance";
import { VALID_TICKER_RE } from "./router";
import type { Source } from "./types";

// Headline Decoder — the News-impact run behind the "Headline Decoder" skill
// (playbook 2.3): any headline → which stocks it touches and how.
//
// Pipeline: Haiku + web_search (max 2) + one forced structured decode. The
// model verifies the story behind the headline, then maps the blast radius:
// affected US-listed tickers, the likely direction for each, and the
// mechanism in plain English.
//
// Integrity rules (CLAUDE.md):
// - Sources are provenance-validated against web_search_tool_result blocks —
//   invented URLs are dropped, and source indexes are remapped.
// - The decoder is told NOT to quote specific prices/numbers; it describes
//   direction and mechanism qualitatively, so nothing quantitative can be
//   hallucinated. Numbers belong to the analysis pipelines.

export type ImpactDirection = "up" | "down" | "unclear";

export interface HeadlineImpact {
  ticker: string;
  companyName: string;
  direction: ImpactDirection;
  why: string; // 1-2 plain-English sentences on the mechanism
  sourceIndexes: number[];
}

export interface HeadlineResult {
  runId: string;
  headline: string;
  summary: string;    // what actually happened, 2-3 plain sentences
  takeaway: string;   // one line — why traders care
  impacts: HeadlineImpact[];
  watchFor: string[]; // 1-3 follow-on things to watch
  sources: Source[];
  asOf: string;
  estCostUSD: number;
  totalDurationMs: number;
  cached?: boolean;
}

export type HeadlineEvent =
  | { kind: "start"; headline: string; runId: string }
  | { kind: "decode_done"; result: HeadlineResult };

const HEADLINE_WEB_SEARCH = {
  type: "web_search_20250305" as const,
  name: "web_search" as const,
  max_uses: 2,
};

const SYSTEM = `You are the news-impact analyst for Conviqt, a plain-English stock research app for everyday investors.

The user gives you a news headline. Your job:
1. Use web_search (up to 2 searches) to verify the story and find what it actually means for markets.
2. Call decode_headline with a structured read: what happened, why traders care, and which US-listed stocks the story touches — with the likely direction for each and the mechanism in one or two plain sentences.

Rules:
- Plain English only. No finance jargon, no shorthand. Write like you're explaining to a smart 19-year-old.
- Do NOT quote specific prices, percentages, or financial figures — describe direction and mechanism qualitatively. (Numbers come from a different, fully-cited pipeline.)
- Only include US-listed tickers (1-5 uppercase letters, optional .A/.B). 2-6 affected stocks is the sweet spot; quality over quantity.
- direction: "up" if the story plausibly helps the stock, "down" if it plausibly hurts, "unclear" if it genuinely cuts both ways. Be willing to say "unclear".
- The sources array must contain the exact URLs from your web_search results — copy them verbatim. A post-processor verifies every URL against the real search results and drops mismatches.
- Never frame anything as a trade instruction. This is research and education, not advice.`;

const DECODE_TOOL = {
  name: "decode_headline",
  description:
    "Report the structured news-impact read for the user's headline. Cite source indexes from your own sources array.",
  input_schema: {
    type: "object" as const,
    properties: {
      summary: {
        type: "string",
        description:
          "2-3 plain-English sentences: what actually happened, verified against your searches. No specific figures.",
      },
      takeaway: {
        type: "string",
        description: "One punchy plain-English line: why traders care about this story.",
      },
      impacts: {
        type: "array",
        description: "The stocks this story touches, most affected first (2-6 items).",
        items: {
          type: "object",
          properties: {
            ticker: { type: "string", description: "US-listed symbol, 1-5 uppercase letters." },
            companyName: { type: "string" },
            direction: { type: "string", enum: ["up", "down", "unclear"] },
            why: {
              type: "string",
              description: "1-2 plain sentences on the mechanism — how the story reaches this stock.",
            },
            sourceIndexes: {
              type: "array",
              items: { type: "number" },
              description: "Indexes into your sources array backing this read.",
            },
          },
          required: ["ticker", "direction", "why"],
        },
      },
      watchFor: {
        type: "array",
        items: { type: "string" },
        description: "1-3 short plain-English follow-ons: what would confirm or change this read.",
      },
      sources: {
        type: "array",
        description:
          "Exact URLs from your web_search results. REQUIRED — at least one per search performed.",
        items: {
          type: "object",
          properties: {
            url: { type: "string" },
            title: { type: "string" },
            publisher: { type: "string" },
          },
          required: ["url"],
        },
      },
    },
    required: ["summary", "takeaway", "impacts", "sources"],
  },
};

interface DecodeInput {
  summary?: string;
  takeaway?: string;
  impacts?: Array<{
    ticker?: string;
    companyName?: string;
    direction?: string;
    why?: string;
    sourceIndexes?: number[];
  }>;
  watchFor?: string[];
  sources?: Array<{ url?: string; title?: string; publisher?: string }>;
}

export interface RunHeadlineOptions {
  onEvent?: (event: HeadlineEvent) => void;
  audience?: ExperienceLevel | null;
}

export async function runHeadlineDecoder(
  headlineInput: string,
  options: RunHeadlineOptions = {}
): Promise<HeadlineResult> {
  const { onEvent } = options;
  const aud = audienceDirective(options.audience);
  const t0 = Date.now();
  const headline = headlineInput.trim().slice(0, 300);
  const runId = `hd_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  const asOf = new Date().toISOString();

  onEvent?.({ kind: "start", headline, runId });

  const anthropic = getAnthropic();

  // Haiku reliably runs the searches but often stops with end_turn instead
  // of calling the decode tool (observed live, twice). Fix: if the first
  // turn ends without the tool call, continue the SAME conversation with
  // tool_choice forcing decode_headline — the search results are already in
  // context, so the forced second turn is cheap and deterministic.
  const userMsg = {
    role: "user" as const,
    content: `Headline: "${headline}"\n\nVerify the story, then call decode_headline.`,
  };

  const first = await anthropic.messages.create({
    model: MODELS.sweep,
    max_tokens: 2048,
    system: [
      { type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } },
      ...(aud ? [{ type: "text" as const, text: aud }] : []),
    ],
    tools: [HEADLINE_WEB_SEARCH, DECODE_TOOL],
    messages: [userMsg],
  });

  let content = first.content as unknown as ContentBlockLike[];
  let webSearchCount = 0;
  for (const block of content) {
    if (block.type === "server_tool_use" && block.name === "web_search") {
      webSearchCount += 1;
      const q = (block.input as { query?: string })?.query ?? "?";
      console.log(`[Headline] web_search: "${q}"`);
    }
  }
  let attemptCostUSD = estimateCallCostUSD(MODELS.sweep, first.usage, 0);

  let toolUse = content.find(
    (b) => b.type === "tool_use" && b.name === DECODE_TOOL.name
  ) as (ContentBlockLike & { input: unknown }) | undefined;

  if (!toolUse) {
    console.log(
      `[Headline] no decode call on first turn (stop: ${first.stop_reason}) — forcing tool_choice on a second turn`
    );
    const second = await anthropic.messages.create({
      model: MODELS.sweep,
      max_tokens: 1536,
      system: [
        { type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } },
        ...(aud ? [{ type: "text" as const, text: aud }] : []),
      ],
      tools: [DECODE_TOOL],
      tool_choice: { type: "tool", name: DECODE_TOOL.name },
      messages: [
        userMsg,
        { role: "assistant", content: first.content },
        {
          role: "user",
          content:
            "Call decode_headline now with your structured read, citing only URLs your searches actually returned.",
        },
      ],
    });
    attemptCostUSD += estimateCallCostUSD(MODELS.sweep, second.usage, 0);
    // Canonical search URLs live in the FIRST turn's blocks; the decode tool
    // call lives in the second. Validate against the union.
    const secondContent = second.content as unknown as ContentBlockLike[];
    toolUse = secondContent.find(
      (b) => b.type === "tool_use" && b.name === DECODE_TOOL.name
    ) as (ContentBlockLike & { input: unknown }) | undefined;
    content = [...content, ...secondContent];
  }

  if (!toolUse) {
    throw new Error(
      `[Headline] model did not produce a decode_headline call even when forced.`
    );
  }

  const input = toolUse.input as DecodeInput;

  // Provenance validation — same guarantee as sweep.ts: every Source must
  // match a URL Anthropic actually returned; citations to dropped sources
  // are stripped (the impact text itself is qualitative, so it survives).
  const canonical = extractCanonicalUrls(content);
  const sources: Source[] = [];
  const indexRemap = new Map<number, number>();
  let rejected = 0;
  const modelSources = Array.isArray(input.sources) ? input.sources : [];
  for (let i = 0; i < modelSources.length; i++) {
    const s = modelSources[i];
    const norm = normalizeUrl(s?.url ?? "");
    if (!norm || !canonical.has(norm)) {
      rejected += 1;
      continue;
    }
    const canon = canonical.get(norm)!;
    indexRemap.set(i, sources.length);
    sources.push({
      url: canon.url,
      title: (s.title?.trim() || canon.title || canon.url).slice(0, 200),
      publisher: (s.publisher?.trim() || hostOf(canon.url) || "Unknown").slice(0, 80),
      retrievedAt: asOf,
    });
  }

  const impacts: HeadlineImpact[] = [];
  for (const raw of input.impacts ?? []) {
    const ticker = (raw.ticker ?? "").trim().toUpperCase();
    if (!VALID_TICKER_RE.test(ticker)) continue;
    const direction: ImpactDirection =
      raw.direction === "up" || raw.direction === "down" ? raw.direction : "unclear";
    const why = (raw.why ?? "").trim();
    if (!why) continue;
    impacts.push({
      ticker,
      companyName: (raw.companyName ?? ticker).trim().slice(0, 80),
      direction,
      why: why.slice(0, 400),
      sourceIndexes: (raw.sourceIndexes ?? [])
        .map((i) => indexRemap.get(i))
        .filter((i): i is number => i !== undefined),
    });
  }

  if (impacts.length === 0) {
    throw new Error(
      `[Headline] decode produced no usable stock impacts for "${headline}".`
    );
  }

  const costUSD = attemptCostUSD + webSearchCount * WEB_SEARCH_COST_USD;

  const result: HeadlineResult = {
    runId,
    headline,
    summary: (input.summary ?? "").trim().slice(0, 1200),
    takeaway: (input.takeaway ?? "").trim().slice(0, 300),
    impacts: impacts.slice(0, 6),
    watchFor: (input.watchFor ?? []).map((w) => w.trim()).filter(Boolean).slice(0, 3),
    sources,
    asOf,
    estCostUSD: Number(costUSD.toFixed(4)),
    totalDurationMs: Date.now() - t0,
  };

  console.log(
    `[Headline] decoded in ${result.totalDurationMs}ms, ${impacts.length} impacts, ${sources.length} sources (${rejected} rejected), cost=$${result.estCostUSD.toFixed(4)}`
  );

  onEvent?.({ kind: "decode_done", result });

  return result;
}
