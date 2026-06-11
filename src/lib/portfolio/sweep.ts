import {
  getAnthropic,
  MODELS,
  estimateCallCostUSD,
} from "../anthropic";
import { normalizeUrl } from "../url-normalize";
import { quote as mdQuote, PROVIDER_LABELS, type Quote } from "../marketdata";
import type { Source } from "../agents/types";
import type { Holding, HoldingFacts, PortfolioFactSheet } from "./types";

// The portfolio sweep is the single point where the auditor touches the open
// web. PRICES NO LONGER COME FROM SEARCH: every holding is priced through
// src/lib/marketdata (free keyless feeds, 15-min cache, $0) before the model
// is even called. The single Haiku call now batch-collects only what a price
// feed can't know — each holding's identity (company name, sector, asset
// type) and a shared macro-regime read. That cut the search cap from 4 to 2,
// halving the dominant cost driver of the audit.
//
// Provenance is enforced exactly like the Council sweep: the canonical Source
// list is derived from the web_search_tool_result blocks Anthropic returns,
// and model-reported sources that don't match a real search URL are dropped.
// Feed prices carry their own deterministic Source (the feed's public page).

// 2 searches = $0.02 in tool fees: one batched identity search + one macro
// search. Prices are injected from the marketdata layer, never searched.
const PORTFOLIO_WEB_SEARCH_TOOL = {
  type: "web_search_20250305" as const,
  name: "web_search" as const,
  max_uses: 2,
};

const SYSTEM = `You are the Portfolio Sweep agent for Conviqt's Portfolio Auditor.

Your job: given a list of US-listed tickers and share counts, gather the qualitative context the five risk analysts need. You are NOT giving advice or a verdict. You are producing a structured, cited fact sheet.

IMPORTANT — do NOT search for prices. Current prices for every holding are supplied automatically by Conviqt's market data feed and merged in after you report. Spend searches only on identity and macro context.

Procedure:
1. Use the web_search tool (up to 2 searches) efficiently. Batch tickers per query — do not search one ticker at a time.
   - Search 1: identities for any holdings you are not certain about — company name, sector, asset type (e.g. "AAPL MSFT NVDA company sector industry").
   - Search 2: current macro regime — fed funds rate, inflation trend, growth/recession signals, market risk appetite (e.g. "fed funds rate inflation CPI market outlook 2026").
2. After searching, call report_portfolio_facts ONCE with everything you found. Produce no other final output.

Rules:
- MANDATORY: the sources array must contain the exact URLs from your web_search results. Copy URLs verbatim — do not paraphrase or invent. The post-processor cross-checks every URL against the real search results and drops mismatches.
- For EVERY holding, return companyName, sector, assetType, and the sourceIndexes backing them. Identity facts (name, sector, asset type) for well-known tickers MAY be reported from your own knowledge with an empty sourceIndexes array — identities are stable. NEVER do that for any number.
- Sector should be a clean GICS-style label ("Technology", "Financials", "Health Care", "Energy", "Consumer Discretionary", etc.). For ETFs use the underlying theme.
- If a ticker does not resolve to a real US-listed instrument, set assetType to "unknown" and add it to unresolved.
- macroRegime: 2-4 sentences on the CURRENT regime (rates, inflation, growth, risk appetite), with macroSourceIndexes citing where it came from.`;

const REPORT_TOOL = {
  name: "report_portfolio_facts",
  description:
    "Emit the structured portfolio fact sheet — per-holding sector + price, plus a shared macro-regime read — citing every number to a web_search source URL.",
  input_schema: {
    type: "object" as const,
    properties: {
      sources: {
        type: "array",
        description:
          "URLs from your web_search results. REQUIRED. Use exact URLs; the post-processor verifies each and drops any that didn't appear in real search results.",
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
      holdings: {
        type: "array",
        description: "One entry per requested ticker.",
        items: {
          type: "object",
          properties: {
            ticker: { type: "string" },
            companyName: { type: "string" },
            sector: { type: "string" },
            industry: { type: "string" },
            assetType: { type: "string", enum: ["equity", "etf", "index", "unknown"] },
            sourceIndexes: {
              type: "array",
              items: { type: "number" },
              description:
                "Sources backing this identity. May be empty for well-known tickers reported from model knowledge.",
            },
          },
          required: ["ticker", "companyName", "sector", "assetType", "sourceIndexes"],
        },
      },
      macroRegime: {
        type: "string",
        description: "2-4 sentence current macro-regime read (rates, inflation, growth, risk appetite).",
      },
      macroSourceIndexes: {
        type: "array",
        items: { type: "number" },
        description: "Source indexes backing the macro regime read.",
      },
      unresolved: {
        type: "array",
        items: { type: "string" },
        description: "Tickers that do not resolve to a real US-listed instrument.",
      },
    },
    required: ["sources", "holdings", "macroRegime", "macroSourceIndexes", "unresolved"],
  },
};

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

interface ReportInput {
  sources: Array<{ url: string; title: string; publisher: string }>;
  holdings: Array<{
    ticker: string;
    companyName: string;
    sector: string;
    industry?: string;
    assetType: "equity" | "etf" | "index" | "unknown";
    sourceIndexes: number[];
  }>;
  macroRegime: string;
  macroSourceIndexes: number[];
  unresolved: string[];
}

export interface PortfolioSweepResult {
  factSheet: PortfolioFactSheet;
  costUSD: number;
  durationMs: number;
  webSearchCount: number;
  rejectedSources: number;
  // Holdings priced by the marketdata layer (vs. left unpriced — feeds down
  // or unknown symbol). Pricing no longer involves the model at all.
  marketDataPriced: number;
}

function extractCanonicalUrls(
  content: ContentBlock[]
): Map<string, { url: string; title: string }> {
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

function hostnameFor(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return "Unknown";
  }
}

export interface RunPortfolioSweepOptions {
  asOf?: string;
}

export async function runPortfolioSweep(
  holdings: Holding[],
  opts: RunPortfolioSweepOptions = {}
): Promise<PortfolioSweepResult> {
  const t0 = Date.now();
  const asOf = opts.asOf ?? new Date().toISOString();
  const anthropic = getAnthropic();

  // Price the whole basket through the marketdata layer FIRST, in parallel
  // with nothing — it's cached and free, and the model call below no longer
  // depends on it. A null quote = honestly unpriced, never guessed.
  const tickers = holdings.map((h) => h.ticker.toUpperCase());
  const quotes = await Promise.all(
    tickers.map(async (t) => {
      try {
        return await mdQuote(t);
      } catch (err) {
        console.warn(`[PortfolioSweep] marketdata quote failed for ${t}:`, err);
        return null;
      }
    })
  );
  const quoteByTicker = new Map<string, Quote>();
  tickers.forEach((t, i) => {
    const q = quotes[i];
    if (q) quoteByTicker.set(t, q);
  });

  const tickerList = holdings
    .map((h) => `${h.ticker.toUpperCase()} (${h.shares} sh)`)
    .join(", ");

  const response = await anthropic.messages.create({
    model: MODELS.sweep,
    max_tokens: 4096,
    system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
    tools: [PORTFOLIO_WEB_SEARCH_TOOL, REPORT_TOOL],
    messages: [
      {
        role: "user",
        content: `Portfolio holdings (${holdings.length}): ${tickerList}

Run your batched searches now, then call report_portfolio_facts with identities (company, sector, asset type) for every holding plus the macro regime. Prices are handled by the data feed — do not search for them.`,
      },
    ],
  });

  const content = response.content as unknown as ContentBlock[];

  for (const block of content) {
    if (block.type === "server_tool_use" && block.name === "web_search") {
      const q = (block.input as { query?: string })?.query ?? "?";
      console.log(`[PortfolioSweep] web_search: "${q}"`);
    }
  }

  const toolUse = content.find(
    (b) => b.type === "tool_use" && b.name === REPORT_TOOL.name
  );
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error(
      `[PortfolioSweep] model did not call report_portfolio_facts. Stop reason: ${response.stop_reason}.`
    );
  }

  const input = toolUse.input as ReportInput;
  const canonicalUrls = extractCanonicalUrls(content);

  // Provenance-verify sources, building an old→new index remap.
  const validSources: Source[] = [];
  const indexRemap = new Map<number, number>();
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
      url: canon.url,
      title: (s.title?.trim() || canon.title || canon.url).slice(0, 200),
      publisher: (s.publisher?.trim() || hostnameFor(canon.url)).slice(0, 80),
      retrievedAt: asOf,
    });
  }

  // Fallback: if the model omitted/garbled all sources but web_search did
  // return URLs, auto-populate up to 4 real canonical sources so cited
  // numbers still trace to a real search result (granularity lost, integrity kept).
  if (validSources.length === 0 && canonicalUrls.size > 0) {
    let n = 0;
    for (const [, meta] of canonicalUrls) {
      indexRemap.set(n, validSources.length);
      validSources.push({
        url: meta.url,
        title: (meta.title || meta.url).slice(0, 200),
        publisher: hostnameFor(meta.url).slice(0, 80),
        retrievedAt: asOf,
      });
      if (++n >= 4) break;
    }
  }

  const remapIndexes = (idxs: number[] | undefined): number[] =>
    Array.isArray(idxs)
      ? Array.from(
          new Set(
            idxs
              .map((i) => indexRemap.get(i))
              .filter((i): i is number => i !== undefined)
          )
        )
      : [];

  // Append one deterministic feed Source per distinct provider page used to
  // price the basket. Feed sources sit AFTER the provenance-validated search
  // sources, so the remap above is untouched.
  const feedSlotByUrl = new Map<string, number>();
  function feedSourceIndex(q: Quote): number {
    const existing = feedSlotByUrl.get(q.sourceUrl);
    if (existing !== undefined) return existing;
    const idx = validSources.length;
    validSources.push({
      url: q.sourceUrl,
      title: `${q.ticker} — market data feed (${q.freshnessLabel})`,
      publisher: PROVIDER_LABELS[q.provider] ?? q.provider,
      retrievedAt: asOf,
    });
    feedSlotByUrl.set(q.sourceUrl, idx);
    return idx;
  }

  const requested = new Set(tickers);
  const reported = Array.isArray(input.holdings) ? input.holdings : [];
  const seen = new Set<string>();

  // Identity from the model (cited or knowledge-based), price from the feed.
  const holdingFacts: HoldingFacts[] = [];
  function pushHolding(
    ticker: string,
    identity: { companyName: string; sector: string; industry?: string; assetType: HoldingFacts["assetType"]; sourceIndexes: number[] }
  ) {
    const q = quoteByTicker.get(ticker) ?? null;
    const sourceIndexes = [...identity.sourceIndexes];
    if (q) sourceIndexes.push(feedSourceIndex(q));
    holdingFacts.push({
      ticker,
      companyName: identity.companyName,
      sector: identity.sector,
      industry: identity.industry,
      price: q ? `$${q.price.toFixed(2)}` : "—",
      priceNum: q ? q.price : null,
      priceAsOf: q ? `${q.freshnessLabel} · ${q.asOf.slice(0, 10)}` : undefined,
      assetType: identity.assetType,
      sourceIndexes,
    });
  }

  for (const h of reported) {
    const ticker = (h.ticker ?? "").toUpperCase();
    if (!ticker || !requested.has(ticker) || seen.has(ticker)) continue;
    seen.add(ticker);
    pushHolding(ticker, {
      companyName: h.companyName?.trim() || ticker,
      sector: h.sector?.trim() || "Unknown",
      industry: h.industry?.trim() || undefined,
      assetType:
        h.assetType && ["equity", "etf", "index", "unknown"].includes(h.assetType)
          ? h.assetType
          : "unknown",
      sourceIndexes: remapIndexes(h.sourceIndexes),
    });
  }

  // Any requested ticker the model never reported on still gets priced by
  // the feed — identity unknown, price real.
  for (const t of requested) {
    if (!seen.has(t)) {
      pushHolding(t, {
        companyName: t,
        sector: "Unknown",
        assetType: "unknown",
        sourceIndexes: [],
      });
    }
  }

  const unresolved = Array.from(
    new Set([
      ...(Array.isArray(input.unresolved) ? input.unresolved.map((u) => u.toUpperCase()) : []),
      ...holdingFacts.filter((h) => h.priceNum === null).map((h) => h.ticker),
    ])
  );

  // Hard fail only if we priced nothing at all — an audit with zero priced
  // positions has no weights to reason over.
  const pricedCount = holdingFacts.filter((h) => h.priceNum !== null).length;
  if (pricedCount === 0) {
    throw new Error(
      `[PortfolioSweep] the market data feed could not price any of the ${holdings.length} holdings ` +
        `(feeds down or unknown symbols). Unresolved: ${unresolved.join(", ")}.`
    );
  }

  const webSearchCount = content.filter(
    (b) => b.type === "server_tool_use" && b.name === "web_search"
  ).length;

  const factSheet: PortfolioFactSheet = {
    asOf,
    holdings: holdingFacts,
    macroRegime: input.macroRegime?.trim() || "No macro-regime read returned.",
    macroSourceIndexes: remapIndexes(input.macroSourceIndexes),
    sources: validSources,
    unresolved,
  };

  const costUSD = estimateCallCostUSD(MODELS.sweep, response.usage, webSearchCount);

  console.log(
    `[PortfolioSweep] done in ${Date.now() - t0}ms: priced ${pricedCount}/${holdings.length} via marketdata, ` +
      `${validSources.length} sources, ${webSearchCount} searches, ${rejectedSources} rejected, cost=$${costUSD.toFixed(4)}`
  );

  return {
    factSheet,
    costUSD,
    durationMs: Date.now() - t0,
    webSearchCount,
    rejectedSources,
    marketDataPriced: pricedCount,
  };
}
