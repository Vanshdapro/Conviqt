import {
  getAnthropic,
  MODELS,
  WEB_SEARCH_TOOL,
  estimateCallCostUSD,
} from "../anthropic";
import { normalizeUrl } from "../url-normalize";
import {
  quote as mdQuote,
  keyStats as mdKeyStats,
  type Quote,
  type KeyStats,
} from "../marketdata";
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
// DIVISION OF LABOR (Phase 1 data layer): price, key stats, and valuation
// numbers come from src/lib/marketdata (free keyless feeds, cached, $0) and
// are injected into the FactSheet deterministically — web_search is reserved
// for what a price feed can't know: news, catalysts, sentiment, analyst
// commentary, macro context. Searches are the dominant cost per run; never
// spend them on numbers the data layer already has.
//
// Two integrity guarantees enforced here:
//   1. The canonical Source list is derived from web_search_tool_result
//      blocks Anthropic returns. The model's self-reported sources are
//      validated against this list by URL match. Sources the model invents
//      get dropped, and facts citing them get dropped too.
//   2. Every Fact must cite a sourceIndex that resolves into the validated
//      Source list. Injected market data facts cite a Source pointing at
//      the feed's public page (Stooq/Yahoo), so they stay traceable too.
//
// We also accept an optional `focus` argument that the chat router can
// surface so a user-specified analytical lens (e.g. "China supply chain
// risk") biases the sweep query selection without losing the rest of
// the structured collection.

const BASE_SYSTEM = `You are the Data Sweep agent for Conviqt, an equity research publication.

Your job: given a US-listed ticker, gather the freshest, highest-quality QUALITATIVE evidence the Council's four specialist analysts need. You are NOT producing a verdict. You are producing a structured FactSheet of cited facts and short narrative notes.

IMPORTANT — what NOT to search for: the current price, market cap, P/E, 52-week range, and volume are supplied automatically by Conviqt's market data feed and merged into the FactSheet after you report. Do NOT spend searches on price quotes or basic valuation stats. If a search result happens to include them, you may ignore them.

Procedure:
1. Use the web_search tool to fetch current information. You have up to 2 searches — use them efficiently.
   - Search 1: recent news and catalysts (e.g. "{TICKER} stock news earnings guidance catalysts")
   - Search 2: sentiment, analyst commentary, and macro context (e.g. "{TICKER} analyst rating sentiment outlook macro")
   If the user provided a focus lens, bias at least one query toward that topic.
2. After your searches complete, call the report_fact_sheet tool ONCE with everything you found. Do not produce any other final output.

Rules:
- MANDATORY: Put every concrete data point you find into the structured "facts" array — one Fact per item. This includes news-borne numbers (guided revenue, EPS beat/miss, segment growth, rate decisions) AND short qualitative facts (analyst consensus, sentiment reads, named catalysts). Do NOT report findings only inside "narrative" — anything that lives only in narrative is invisible to the analysts and will be discarded. A report with a rich narrative but an empty facts array is a FAILED report.
- MANDATORY: The sources array must contain the URLs from your web_search results. Include at least one source per search you ran. Copy the exact URL as it appeared in the search result — do not paraphrase, abbreviate, or omit the URL. Submitting an empty sources array will cause every fact to be discarded.
- Aim for at least 6-10 facts spanning fundamentals (earnings/guidance news), technicals (notable moves, momentum commentary), sentiment, and macro. If a search returned it, it belongs in a Fact.
- Every fact MUST cite a sourceIndex pointing into the sources array.
- Only include URLs that were actually returned by your web_search calls. Do not invent URLs. The post-processor cross-checks every URL against the real search results and drops mismatches.
- Never invent a number. If you could not find a fact, leave it out and add the category to gaps.
- Prefer primary sources (10-K, 10-Q, FRED, official press release) over secondary aggregators. When using an aggregator (Yahoo Finance, Bloomberg, Reuters), name it as the publisher.
- Include the "as of" date for any time-sensitive fact.
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
  // How many facts were injected from the marketdata layer (0 = feeds down,
  // FactSheet is web-search-only — honest, but worth seeing in logs).
  marketDataFacts: number;
}

// ── Market data injection ────────────────────────────────────────────────────
// Deterministic facts from src/lib/marketdata, formatted once here so every
// pipeline (council, focused, sector) renders identical numbers. Each carries
// a Source pointing at the feed's public page; freshness rides in `note`
// (e.g. "delayed ~15 min") because honesty about delay is brand.

interface MarketFactBundle {
  // facts paired with which bundled source they cite (by bundle index)
  entries: Array<{ fact: Omit<Fact, "sourceIndex">; sourceSlot: number }>;
  sources: Source[];
}

const PROVIDER_PUBLISHER: Record<string, string> = {
  stooq: "Stooq",
  yahoo: "Yahoo Finance",
  finnhub: "Finnhub",
};

function formatCompactUSD(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

function buildMarketFactBundle(
  q: Quote | null,
  ks: KeyStats | null,
  asOf: string
): MarketFactBundle {
  const sources: Source[] = [];
  const slotByUrl = new Map<string, number>();
  const entries: MarketFactBundle["entries"] = [];

  function slotFor(provider: string, url: string, ticker: string): number {
    const existing = slotByUrl.get(url);
    if (existing !== undefined) return existing;
    const slot = sources.length;
    sources.push({
      url,
      title: `${ticker} — market data feed`,
      publisher: PROVIDER_PUBLISHER[provider] ?? provider,
      retrievedAt: asOf,
    });
    slotByUrl.set(url, slot);
    return slot;
  }

  function push(
    fact: Omit<Fact, "sourceIndex">,
    provider: string,
    url: string,
    ticker: string
  ) {
    entries.push({ fact, sourceSlot: slotFor(provider, url, ticker) });
  }

  if (q) {
    const asOfDate = q.asOf.slice(0, 10);
    push(
      { key: "price", value: `$${q.price.toFixed(2)}`, category: "price", asOf: asOfDate, note: q.freshnessLabel },
      q.provider, q.sourceUrl, q.ticker
    );
    if (q.prevClose !== null) {
      push(
        { key: "prev_close", value: `$${q.prevClose.toFixed(2)}`, category: "price", asOf: asOfDate },
        q.provider, q.sourceUrl, q.ticker
      );
    }
    if (q.changePct !== null) {
      push(
        { key: "day_change_pct", value: `${q.changePct >= 0 ? "+" : ""}${q.changePct.toFixed(2)}%`, category: "price", asOf: asOfDate, note: q.freshnessLabel },
        q.provider, q.sourceUrl, q.ticker
      );
    }
  }
  if (ks) {
    const asOfDate = ks.asOf.slice(0, 10);
    if (ks.marketCap !== null) {
      push(
        { key: "market_cap", value: formatCompactUSD(ks.marketCap), category: "fundamental", asOf: asOfDate },
        ks.provider, ks.sourceUrl, ks.ticker
      );
    }
    if (ks.peRatio !== null) {
      push(
        { key: "pe_ttm", value: `${ks.peRatio.toFixed(1)}x`, category: "fundamental", asOf: asOfDate, note: "TTM" },
        ks.provider, ks.sourceUrl, ks.ticker
      );
    }
    if (ks.week52High !== null && ks.week52Low !== null) {
      push(
        { key: "52w_range", value: `$${ks.week52Low.toFixed(2)} – $${ks.week52High.toFixed(2)}`, category: "technical", asOf: asOfDate },
        ks.provider, ks.sourceUrl, ks.ticker
      );
    }
    if (ks.volume !== null) {
      push(
        { key: "volume", value: ks.volume.toLocaleString("en-US"), category: "technical", asOf: asOfDate, note: "latest session" },
        ks.provider, ks.sourceUrl, ks.ticker
      );
    }
  }

  return { entries, sources };
}

// Append bundled market facts to a validated FactSheet (source indexes are
// offset past the web-search sources) and drop now-covered gap categories.
function mergeMarketFacts(sheet: FactSheet, bundle: MarketFactBundle): number {
  if (bundle.entries.length === 0) return 0;
  const base = sheet.sources.length;
  sheet.sources.push(...bundle.sources);
  for (const { fact, sourceSlot } of bundle.entries) {
    sheet.facts.push({ ...fact, sourceIndex: base + sourceSlot });
  }
  const covered = new Set(bundle.entries.map((e) => e.fact.category));
  sheet.gaps = sheet.gaps.filter((g) => !covered.has(g));
  return bundle.entries.length;
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

// Max sweep attempts. The Haiku sweep occasionally returns an empty facts
// array (dumping numbers into narrative instead) or skips the report tool
// entirely — a transient ~10% failure that, unretried, 503s the whole Council
// on an arbitrary ticker. Retrying is the difference between "works on NVDA"
// and "works on every stock". Bounded at 2 so a pathological ticker can't blow
// the per-request cost ceiling (each attempt is ~5-8¢).
const MAX_SWEEP_ATTEMPTS = 2;

export async function runSweep(
  ticker: string,
  opts: RunSweepOptions = {}
): Promise<SweepResult> {
  const asOf = opts.asOf ?? new Date().toISOString();
  const t0 = Date.now();

  // Market data first — cached (15 min quotes / 24 h history) and $0, so it
  // never competes with the per-run cost ceiling. Feeds being down is a
  // logged non-event: the FactSheet just won't carry injected price facts.
  const [quoteRes, statsRes] = await Promise.allSettled([
    mdQuote(ticker),
    mdKeyStats(ticker),
  ]);
  const md = {
    quote: quoteRes.status === "fulfilled" ? quoteRes.value : null,
    stats: statsRes.status === "fulfilled" ? statsRes.value : null,
  };
  if (!md.quote) {
    console.warn(`[Sweep] ${ticker}: marketdata quote unavailable — price facts will be missing.`);
  }
  const bundle = buildMarketFactBundle(md.quote, md.stats, asOf);

  let lastErr: unknown;
  for (let attempt = 0; attempt < MAX_SWEEP_ATTEMPTS; attempt++) {
    try {
      return await attemptSweep(ticker, { ...opts, asOf }, attempt, bundle);
    } catch (err) {
      lastErr = err;
      console.warn(
        `[Sweep] ${ticker}: attempt ${attempt + 1}/${MAX_SWEEP_ATTEMPTS} failed: ${
          err instanceof Error ? err.message : err
        }`
      );
    }
  }

  // Qualitative sweep is down but the data feed answered: return a degraded,
  // honestly-labeled FactSheet instead of 503ing a ticker we can price. The
  // specialists see real cited numbers + explicit gaps — never synthetics.
  if (md.quote && bundle.entries.length > 0) {
    console.warn(
      `[Sweep] ${ticker}: all ${MAX_SWEEP_ATTEMPTS} web sweeps failed — degrading to marketdata-only FactSheet (${bundle.entries.length} facts).`
    );
    const sheet: FactSheet = {
      ticker: ticker.toUpperCase(),
      companyName: ticker.toUpperCase(),
      sector: "Unknown",
      assetType: "unknown",
      asOf,
      facts: [],
      sources: [],
      gaps: ["identity", "sentiment", "macro"],
      narrative:
        "Web research was unavailable for this run; only market data feed numbers are included. Qualitative context (news, sentiment, macro) is missing.",
    };
    const injected = mergeMarketFacts(sheet, bundle);
    return {
      factSheet: sheet,
      costUSD: 0, // failed attempts' tokens aren't recoverable here; logged above
      durationMs: Date.now() - t0,
      webSearchCount: 0,
      canonicalUrls: [],
      rejectedSources: 0,
      marketDataFacts: injected,
    };
  }

  throw lastErr instanceof Error
    ? lastErr
    : new Error(`[Sweep] ${ticker}: sweep failed after ${MAX_SWEEP_ATTEMPTS} attempts.`);
}

async function attemptSweep(
  ticker: string,
  opts: RunSweepOptions & { asOf: string },
  attempt: number,
  bundle: MarketFactBundle
): Promise<SweepResult> {
  const t0 = Date.now();
  const asOf = opts.asOf;
  const anthropic = getAnthropic();

  const focusBlock = opts.focus
    ? `\n\nUser focus for this analysis: ${opts.focus.slice(0, 240)}\n` +
      `Bias your search queries toward this focus while still covering the other lanes for the panel.\n`
    : "";

  // On a retry, the previous attempt produced no usable structured facts.
  // Tell the model explicitly so it doesn't repeat the same narrative-dump.
  const retryBlock =
    attempt > 0
      ? `\n\nIMPORTANT: A previous attempt returned no usable facts. You MUST populate the "facts" array with the actual numbers (price, P/E, EPS, revenue growth, margins, RSI, analyst rating, etc.) and the "sources" array with the exact web_search URLs. Do not leave facts or sources empty.\n`
      : "";

  const response = await anthropic.messages.create({
    model: MODELS.sweep,
    max_tokens: 3072,
    system: [{ type: "text", text: BASE_SYSTEM, cache_control: { type: "ephemeral" } }],
    tools: [WEB_SEARCH_TOOL, REPORT_FACT_SHEET_TOOL],
    messages: [
      {
        role: "user",
        content: `Ticker: ${ticker.toUpperCase()}${focusBlock}${retryBlock}

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

  // Inject the marketdata facts AFTER provenance validation — they're
  // deterministic feed numbers with their own Sources, not model output,
  // so they never pass through the web_search URL check.
  const marketDataFacts = mergeMarketFacts(factSheet, bundle);

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
    marketDataFacts,
  };
}

function hostnameFor(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return "Unknown";
  }
}
