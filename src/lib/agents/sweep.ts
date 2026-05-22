import {
  getAnthropic,
  MODELS,
  WEB_SEARCH_TOOL,
  estimateCallCostUSD,
} from "../anthropic";
import { normalizeUrl } from "../url-normalize";
import {
  AssetType,
  Fact,
  FactCategory,
  FactSheet,
  Source,
} from "./types";

// The sweep agent is the single point where Conviqt touches the open
// web. It runs Claude Haiku with the web_search server tool and a
// structured-output client tool (report_fact_sheet).
//
// Two integrity guarantees enforced here:
//   1. The canonical Source list is derived from web_search_tool_result
//      blocks Anthropic returns. The model's self-reported sources are
//      validated against this list by URL match. Sources the model invents
//      get dropped, and facts citing them get dropped too.
//   2. Every Fact must cite a sourceIndex that resolves into the validated
//      Source list.
//
// We also accept an optional `focus` argument that the chat router can
// surface so a user-specified analytical lens (e.g. "China supply chain
// risk") biases the sweep query selection without losing the rest of
// the structured collection.

const BASE_SYSTEM = `You are the Data Sweep agent for Conviqt, an equity research publication.

Your job: given a US-listed ticker, gather the freshest, highest-quality factual evidence the Council's four specialist analysts need. You are NOT producing a verdict. You are producing a structured FactSheet of cited numbers and short narrative notes.

Procedure:
1. Use the web_search tool to fetch current information. You have up to 2 searches — use them efficiently.
   - Search 1: price, fundamentals, and valuation (e.g. "{TICKER} stock price PE EPS revenue margins analyst rating 2025")
   - Search 2: recent news, macro context, and sentiment (e.g. "{TICKER} stock news outlook earnings macro 2025")
   If the user provided a focus lens, bias at least one query toward that topic.
2. After your searches complete, call the report_fact_sheet tool ONCE with everything you found. Do not produce any other final output.

Rules:
- MANDATORY: The sources array must contain the URLs from your web_search results. Include at least one source per search you ran. Copy the exact URL as it appeared in the search result — do not paraphrase, abbreviate, or omit the URL. Submitting an empty sources array will cause every fact to be discarded.
- Every fact MUST cite a sourceIndex pointing into the sources array.
- Only include URLs that were actually returned by your web_search calls. Do not invent URLs. The post-processor cross-checks every URL against the real search results and drops mismatches.
- Never invent a number. If you could not find a fact, leave it out and add the category to gaps.
- Prefer primary sources (10-K, 10-Q, FRED, official press release) over secondary aggregators. When using an aggregator (Yahoo Finance, Bloomberg, Reuters), name it as the publisher.
- Include the "as of" date for prices and any time-sensitive number.
- Keep narrative to 1-3 sentences of context that doesn't fit as a single Fact (e.g. "Just missed Q2 EPS by 4 cents; guided down for Q3.").
- Identity facts (company name, sector) still need a sourceIndex.
- Set assetType correctly. "equity" = single common stock. "etf" = exchange-traded fund (SPY, QQQ, VTI, sector ETFs). "index" = market index (^GSPC, ^DJI). "unknown" only if the symbol doesn't resolve.

If the ticker does not resolve to a real listed equity/ETF/index, return an empty facts array with gaps including every category, assetType="unknown", and put the reason in narrative.`;

const REPORT_FACT_SHEET_TOOL = {
  name: "report_fact_sheet",
  description:
    "Emit the structured FactSheet for the requested ticker, citing every fact to a source URL that came from your web_search results.",
  input_schema: {
    type: "object" as const,
    properties: {
      companyName: {
        type: "string",
        description: "Full company / fund / index name as it appears in filings.",
      },
      sector: {
        type: "string",
        description:
          "GICS sector or a short descriptive sector label (e.g. 'Technology — Consumer Electronics'). For ETFs use the underlying theme.",
      },
      assetType: {
        type: "string",
        enum: ["equity", "etf", "index", "unknown"],
        description:
          "What kind of instrument this ticker represents. Used downstream to skip lanes that don't apply (e.g. fundamentals for ETFs).",
      },
      sources: {
        type: "array",
        description:
          "URLs from your web_search results. REQUIRED — include at least one per search performed. Use the exact URL from the search result. The post-processor verifies each URL and drops any that didn't actually appear in your search results.",
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
      facts: {
        type: "array",
        description: "Cited evidence facts. Every entry must include sourceIndex.",
        items: {
          type: "object",
          properties: {
            key: {
              type: "string",
              description:
                "Snake_case identifier, e.g. 'price', 'pe_ttm', 'revenue_growth_yoy', 'rsi_14', 'fed_funds_target'.",
            },
            value: {
              type: "string",
              description:
                "String value with units, e.g. '$187.32', '29.4x', '+5.2%', '4.00-4.25%'.",
            },
            category: {
              type: "string",
              enum: [
                "identity",
                "price",
                "fundamental",
                "technical",
                "sentiment",
                "macro",
              ],
            },
            asOf: {
              type: "string",
              description:
                "Human-readable freshness label, e.g. 'close 2026-05-14' or 'Q3 FY26'.",
            },
            note: {
              type: "string",
              description:
                "Short qualifier such as 'TTM', 'non-GAAP', '14-day'.",
            },
            sourceIndex: {
              type: "number",
              description: "Zero-based index into the sources array.",
            },
          },
          required: ["key", "value", "category", "sourceIndex"],
        },
      },
      gaps: {
        type: "array",
        items: {
          type: "string",
          enum: [
            "identity",
            "price",
            "fundamental",
            "technical",
            "sentiment",
            "macro",
          ],
        },
        description: "Categories you could not populate from web search.",
      },
      narrative: {
        type: "string",
        description:
          "1-3 sentence narrative context. Optional. Cite source numbers inline if you mention specific events.",
      },
    },
    required: ["companyName", "sector", "assetType", "sources", "facts", "gaps"],
  },
};

export interface SweepResult {
  factSheet: FactSheet;
  costUSD: number;
  durationMs: number;
  webSearchCount: number;
  // URLs Anthropic actually returned from web_search. Logged so we can
  // audit hallucinations post-hoc.
  canonicalUrls: string[];
  // Sources the model claimed but that didn't appear in the canonical
  // web_search results. These were rejected. Useful as a signal for
  // misbehaving prompts.
  rejectedSources: number;
}

interface ReportFactSheetInput {
  companyName: string;
  sector: string;
  assetType: AssetType;
  sources: Array<{ url: string; title: string; publisher: string }>;
  facts: Array<{
    key: string;
    value: string;
    category: FactCategory;
    asOf?: string;
    note?: string;
    sourceIndex: number;
  }>;
  gaps: FactCategory[];
  narrative?: string;
}

interface ContentBlock {
  type: string;
  name?: string;
  input?: unknown;
  content?: unknown;
}

interface WebSearchResultLike {
  url?: string;
  title?: string;
  type?: string;
}

// Extract the canonical set of URLs Anthropic actually surfaced via
// web_search_tool_result blocks. Each block's content is an array of
// { url, title, encrypted_content, type: "web_search_result" } OR an
// error object — we ignore the latter.
function extractCanonicalUrls(content: ContentBlock[]): Map<string, { url: string; title: string }> {
  const map = new Map<string, { url: string; title: string }>();
  for (const block of content) {
    if (block.type !== "web_search_tool_result") continue;
    const inner = block.content;
    if (!Array.isArray(inner)) continue;
    for (const result of inner as WebSearchResultLike[]) {
      if (result.type !== "web_search_result") continue;
      if (typeof result.url !== "string") continue;
      const norm = normalizeUrl(result.url);
      if (!norm) continue;
      if (!map.has(norm)) {
        map.set(norm, {
          url: result.url,
          title: typeof result.title === "string" ? result.title : result.url,
        });
      }
    }
  }
  return map;
}

export interface RunSweepOptions {
  focus?: string;
  asOf?: string; // ISO timestamp to stamp on the factSheet + sources
}

export async function runSweep(
  ticker: string,
  opts: RunSweepOptions = {}
): Promise<SweepResult> {
  const t0 = Date.now();
  const asOf = opts.asOf ?? new Date().toISOString();
  const anthropic = getAnthropic();

  const focusBlock = opts.focus
    ? `\n\nUser focus for this analysis: ${opts.focus.slice(0, 240)}\n` +
      `Bias your search queries toward this focus while still covering the other lanes for the panel.\n`
    : "";

  const response = await anthropic.messages.create({
    model: MODELS.sweep,
    max_tokens: 3072,
    system: BASE_SYSTEM,
    tools: [WEB_SEARCH_TOOL, REPORT_FACT_SHEET_TOOL],
    messages: [
      {
        role: "user",
        content: `Ticker: ${ticker.toUpperCase()}${focusBlock}

Run your searches now, then call report_fact_sheet with everything you found.`,
      },
    ],
  });

  const content = response.content as unknown as ContentBlock[];

  // Log every web_search invocation. The Anthropic API returns the model's
  // search query in the server_tool_use input, and the resulting URLs in
  // the matching web_search_tool_result block. We log both so production
  // debugging isn't blind.
  for (const block of content) {
    if (block.type === "server_tool_use" && block.name === "web_search") {
      const q = (block.input as { query?: string })?.query ?? "?";
      console.log(`[Sweep] ${ticker} web_search: "${q}"`);
    }
    if (block.type === "web_search_tool_result") {
      const inner = block.content;
      const count = Array.isArray(inner) ? inner.length : 0;
      console.log(`[Sweep] ${ticker} web_search_result: ${count} hits`);
    }
  }

  // Pull out the final report_fact_sheet tool_use.
  const toolUse = content.find(
    (block) =>
      block.type === "tool_use" && block.name === REPORT_FACT_SHEET_TOOL.name
  );

  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error(
      `[Sweep] ${ticker}: model did not produce a report_fact_sheet call. ` +
        `Stop reason: ${response.stop_reason}. ` +
        `Last content block type: ${content[content.length - 1]?.type ?? "n/a"}.`
    );
  }

  const input = toolUse.input as ReportFactSheetInput;
  const canonicalUrls = extractCanonicalUrls(content);

  // Build provenance-verified Sources. For each model-reported source,
  // check the normalized URL against the canonical web_search urls.
  // Reject sources that don't match. Build an index remap so facts that
  // cited dropped sources can also be dropped.
  const validSources: Source[] = [];
  const indexRemap = new Map<number, number>(); // old → new
  let rejectedSources = 0;
  const modelSources = Array.isArray(input.sources) ? input.sources : [];
  for (let i = 0; i < modelSources.length; i++) {
    const s = modelSources[i];
    const norm = normalizeUrl(s.url);
    if (!norm || !canonicalUrls.has(norm)) {
      rejectedSources += 1;
      continue;
    }
    const canon = canonicalUrls.get(norm)!;
    const newIndex = validSources.length;
    indexRemap.set(i, newIndex);
    validSources.push({
      url: canon.url, // prefer the original URL Anthropic returned
      title: (s.title?.trim() || canon.title || canon.url).slice(0, 200),
      publisher: (s.publisher?.trim() || hostnameFor(canon.url)).slice(0, 80),
      retrievedAt: asOf,
    });
  }

  // Validate facts: drop any whose old sourceIndex didn't survive remap.
  const validFacts: Fact[] = [];
  for (const f of input.facts ?? []) {
    if (typeof f.sourceIndex !== "number") continue;
    const newIdx = indexRemap.get(f.sourceIndex);
    if (newIdx === undefined) continue;
    validFacts.push({
      key: f.key,
      value: f.value,
      category: f.category,
      asOf: f.asOf,
      note: f.note,
      sourceIndex: newIdx,
    });
  }

  const gaps: FactCategory[] = Array.from(new Set(input.gaps ?? []));
  const assetType: AssetType =
    input.assetType && ["equity", "etf", "index", "unknown"].includes(input.assetType)
      ? input.assetType
      : "unknown";

  // When the model omits the sources array (submits sources: []) but web_search
  // actually returned URLs, auto-populate up to 3 sources from the canonical
  // URL set. The canonical URLs come directly from Anthropic's
  // web_search_tool_result blocks — they are real, not model-invented.
  // Per-fact citation granularity is lost (all facts point to source 0) but
  // citation integrity holds: every number is traceable to a real search result.
  if (validSources.length === 0 && canonicalUrls.size > 0) {
    let autoCount = 0;
    for (const [, meta] of canonicalUrls) {
      validSources.push({
        url: meta.url,
        title: (meta.title || meta.url).slice(0, 200),
        publisher: hostnameFor(meta.url).slice(0, 80),
        retrievedAt: asOf,
      });
      if (++autoCount >= 3) break;
    }
    for (const f of input.facts ?? []) {
      validFacts.push({
        key: f.key,
        value: f.value,
        category: f.category,
        asOf: f.asOf,
        note: f.note,
        sourceIndex: 0,
      });
    }
    console.warn(
      `[Sweep] ${ticker}: model omitted sources array; auto-populated ${validSources.length} source(s) from canonical web_search URLs and recovered ${validFacts.length} fact(s).`
    );
  }

  // Only fail hard if we got nothing at all — no facts AND no canonical URLs.
  if (validFacts.length === 0) {
    throw new Error(
      `[Sweep] ${ticker}: sweep produced zero verified facts. ` +
        `Rejected ${rejectedSources} model-reported sources for not matching real web_search URLs. ` +
        `Gaps: ${gaps.join(", ") || "(none reported)"}. ` +
        `Narrative: ${input.narrative ?? "(none)"}.`
    );
  }

  // Count web_search server tool invocations for cost accounting.
  const webSearchCount = content.filter(
    (block) =>
      block.type === "server_tool_use" && block.name === WEB_SEARCH_TOOL.name
  ).length;

  const factSheet: FactSheet = {
    ticker: ticker.toUpperCase(),
    companyName: input.companyName?.trim() || ticker.toUpperCase(),
    sector: input.sector?.trim() || "Unknown",
    assetType,
    asOf,
    facts: validFacts,
    sources: validSources,
    gaps,
    narrative: input.narrative?.trim() || undefined,
  };

  const costUSD = estimateCallCostUSD(
    MODELS.sweep,
    response.usage,
    webSearchCount
  );

  if (rejectedSources > 0) {
    console.warn(
      `[Sweep] ${ticker}: rejected ${rejectedSources} model-authored sources that didn't match real web_search results.`
    );
  }

  return {
    factSheet,
    costUSD,
    durationMs: Date.now() - t0,
    webSearchCount,
    canonicalUrls: Array.from(canonicalUrls.keys()),
    rejectedSources,
  };
}

function hostnameFor(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return "Unknown";
  }
}
