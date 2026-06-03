import { getAnthropic, MODELS, estimateCallCostUSD } from "../anthropic";
import {
  extractCanonicalUrls,
  resolveCitedSources,
  type ContentBlockLike,
  type ModelSource,
} from "./provenance";
import type { FactSheet } from "./types";
import type {
  EdgeDirection,
  EdgeWeight,
  MosaicEdgeFactor,
  MosaicLane,
  MosaicScan,
} from "../alphaTypes";

// The Mosaic Scan — the deep "small factors" pass (Feature 1).
//
// The rest of the desk reasons off surface economics (price, fundamentals, the
// obvious news). The mosaic seat does the opposite: it hunts the small,
// non-obvious, individually-unremarkable signals — insider buying clusters,
// 13F moves, short interest, options positioning, channel checks, hiring
// trends, regulatory/legal exposure — and assembles them into a variant
// perception. Mosaic theory / scuttlebutt: edge built from many tiny cited
// data points the crowd is not pricing.
//
// This is an ALPHA-ONLY stage. It is deliberately NOT wired into the shared
// chat sweep (sweep.ts), which lives under a 1-5¢ chat cost cap. Alpha runs
// ≤2 picks/week, so the extra search depth here is trivial monthly.
//
// Citation integrity (CLAUDE.md): every factor cites a sourceIndex that
// resolves to a URL Anthropic actually surfaced via web_search. Model-invented
// URLs are dropped, and factors citing them are dropped with them.

const LANES: MosaicLane[] = [
  "insider",
  "institutional",
  "short_interest",
  "options",
  "supply_chain",
  "customers",
  "management",
  "hiring",
  "regulatory",
  "legal",
  "social_sentiment",
  "technical_microstructure",
  "other",
];

// Mosaic gets 6 searches — deeper than the 2-search sweep. A dedicated tool
// (not the shared WEB_SEARCH_TOOL, which is capped at 2) so the chat sweep is
// untouched. Each search also returns large result blocks that count as input
// tokens, so 6 is the cost lever — kept bounded on purpose.
const MOSAIC_WEB_SEARCH = {
  type: "web_search_20250305" as const,
  name: "web_search" as const,
  max_uses: 6,
};

const SYSTEM = `You are the Mosaic Analyst on Conviqt's paper trading desk — the seat that builds VARIANT PERCEPTION.

The rest of the desk has already read the surface economics: price, P/E, growth, margins, the obvious headlines. Your job is the opposite. Hunt the SMALL, NON-OBVIOUS factors the crowd is NOT pricing but that move a thesis. This is mosaic theory / scuttlebutt — assembling an edge from many tiny, individually-unremarkable, cited data points.

You receive a ticker and the surface facts the desk already holds. Do NOT repeat those. Go find the edge.

Procedure:
1. Use web_search (up to 6 queries) across the non-obvious lanes — spend them on whichever are most likely to hold signal for THIS name:
   - Insider activity: Form 4 open-market buys/sells, clusters, size vs. comp.
   - Institutional flows: 13F adds/exits, notable new holders, activist stakes.
   - Short interest: short % of float, days-to-cover, borrow cost, squeeze setups.
   - Options positioning: unusual flow, skew, large open interest, dealer gamma.
   - Supply chain & customers: supplier commentary, channel checks, order trends, key customer wins/losses.
   - Management & capital allocation: exec departures/hires, buyback/insider tone, guidance-language shifts.
   - Hiring & labor: headcount trend, job-posting velocity, layoffs, Glassdoor shifts.
   - Regulatory & legal: pending regulation, agency action, litigation, investigations.
   - Social/retail sentiment: positioning and narrative momentum (treat as a soft signal).
   - Technical microstructure: unusual volume, liquidity, fund flows.
2. Then call report_mosaic ONCE with the cited edge factors and a 2-3 sentence variant-perception synthesis.

Rules:
- Every factor MUST cite a sourceIndex into your sources array, and every source URL MUST come from your actual web_search results. Invented URLs are cross-checked and dropped — and their factors go with them.
- A factor is a SPECIFIC, cited data point ("CFO bought $1.2M open-market on 2026-05-28", "short interest rose to 14% of float"), never a vague vibe.
- direction: does this cut bullish, bearish, or neutral for a long position? weight: how material is it (high/medium/low)?
- Quality over quantity. 4-10 genuine edge factors is excellent. If a lane holds nothing real, skip it — do NOT manufacture filler.
- Never invent a number. If the scan turns up little, return few factors and say so. An honest thin scan beats a padded one.
- edgeSummary: 2-3 sentences on what the mosaic tells you that the surface economics do NOT — the variant perception, and which way it tilts.`;

const REPORT_MOSAIC_TOOL = {
  name: "report_mosaic",
  description:
    "Emit the cited edge factors and a variant-perception synthesis for this candidate.",
  input_schema: {
    type: "object" as const,
    properties: {
      sources: {
        type: "array",
        description:
          "URLs from your web_search results. Use the exact URL from each result. The post-processor verifies every URL and drops mismatches.",
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
      factors: {
        type: "array",
        description: "Cited edge factors. Each entry must include a sourceIndex.",
        items: {
          type: "object",
          properties: {
            lane: { type: "string", enum: LANES },
            factor: { type: "string", description: "Short label for the signal." },
            detail: {
              type: "string",
              description: "One sentence with the specific number/fact.",
            },
            direction: { type: "string", enum: ["bullish", "bearish", "neutral"] },
            weight: { type: "string", enum: ["high", "medium", "low"] },
            sourceIndex: {
              type: "number",
              description: "Zero-based index into the sources array.",
            },
          },
          required: ["lane", "factor", "detail", "direction", "weight", "sourceIndex"],
        },
      },
      edgeSummary: {
        type: "string",
        description:
          "2-3 sentences: the variant perception the mosaic reveals and which way it tilts.",
      },
    },
    required: ["sources", "factors", "edgeSummary"],
  },
};

function renderKnownContext(fs: FactSheet): string {
  const known = fs.facts
    .slice(0, 16)
    .map((f) => `${f.key}=${f.value}`)
    .join("; ");
  return (
    `Company: ${fs.companyName} (${fs.sector}). ` +
    `Surface facts the desk already has (do NOT repeat these): ${known || "(none)"}.` +
    (fs.narrative ? ` Note: ${fs.narrative}` : "")
  );
}

function normalizeDirection(d: unknown): EdgeDirection {
  return d === "bullish" || d === "bearish" || d === "neutral" ? d : "neutral";
}

function normalizeWeight(w: unknown): EdgeWeight {
  return w === "high" || w === "medium" || w === "low" ? w : "medium";
}

// Run the mosaic scan for one candidate. ADVISORY: any failure returns an empty
// scan rather than throwing, so the council/CIO simply proceed without the edge
// layer. Cost ~$0.10-0.20 (6 searches + their result tokens on Haiku).
export async function runMosaicScan(
  ticker: string,
  factSheet: FactSheet,
  opts: { asOf?: string } = {}
): Promise<MosaicScan> {
  const t0 = Date.now();
  const asOf = opts.asOf ?? new Date().toISOString();
  const anthropic = getAnthropic();

  const response = await anthropic.messages.create({
    model: MODELS.mosaic,
    max_tokens: 2048,
    system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
    tools: [MOSAIC_WEB_SEARCH, REPORT_MOSAIC_TOOL],
    messages: [
      {
        role: "user",
        content: `Ticker: ${ticker.toUpperCase()}
${renderKnownContext(factSheet)}

Run your edge searches now, then call report_mosaic with what you found.`,
      },
    ],
  });

  const content = response.content as unknown as ContentBlockLike[];

  for (const block of content) {
    if (block.type === "server_tool_use" && block.name === "web_search") {
      const q = (block.input as { query?: string })?.query ?? "?";
      console.log(`[Mosaic] ${ticker} web_search: "${q}"`);
    }
  }

  const webSearchCount = content.filter(
    (b) => b.type === "server_tool_use" && b.name === "web_search"
  ).length;
  const costUSD = estimateCallCostUSD(MODELS.mosaic, response.usage, webSearchCount);

  const toolUse = content.find(
    (b) => b.type === "tool_use" && b.name === REPORT_MOSAIC_TOOL.name
  );

  if (!toolUse || toolUse.type !== "tool_use") {
    console.warn(
      `[Mosaic] ${ticker}: no report_mosaic call (stop_reason=${response.stop_reason}) — proceeding without edge factors`
    );
    return {
      ticker: ticker.toUpperCase(),
      factors: [],
      edgeSummary: "",
      sources: [],
      asOf,
      costUSD,
      durationMs: Date.now() - t0,
      webSearchCount,
    };
  }

  const input = toolUse.input as {
    sources?: ModelSource[];
    factors?: Array<{
      lane?: string;
      factor?: string;
      detail?: string;
      direction?: string;
      weight?: string;
      sourceIndex?: number;
    }>;
    edgeSummary?: string;
  };

  const canonical = extractCanonicalUrls(content);
  const { sources, indexRemap, rejected } = resolveCitedSources(
    input.sources ?? [],
    canonical
  );

  const factors: MosaicEdgeFactor[] = [];
  for (const f of input.factors ?? []) {
    if (typeof f.sourceIndex !== "number") continue;
    const newIdx = indexRemap.get(f.sourceIndex);
    if (newIdx === undefined) continue; // cited a rejected / invented source
    if (!LANES.includes(f.lane as MosaicLane)) continue;
    factors.push({
      lane: f.lane as MosaicLane,
      factor: (f.factor ?? "").trim().slice(0, 120) || "(unlabeled signal)",
      detail: (f.detail ?? "").trim().slice(0, 280),
      direction: normalizeDirection(f.direction),
      weight: normalizeWeight(f.weight),
      sourceIndex: newIdx,
    });
  }

  if (rejected > 0) {
    console.warn(
      `[Mosaic] ${ticker}: rejected ${rejected} model-authored source(s) not matching real web_search results.`
    );
  }
  console.log(
    `[Mosaic] ${ticker}: ${factors.length} edge factor(s), ${sources.length} source(s), cost=$${costUSD.toFixed(4)}`
  );

  return {
    ticker: ticker.toUpperCase(),
    factors,
    edgeSummary: (input.edgeSummary ?? "").trim().slice(0, 600),
    sources,
    asOf,
    costUSD,
    durationMs: Date.now() - t0,
    webSearchCount,
  };
}
