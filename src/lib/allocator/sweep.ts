import { getOpenAI, MODELS, estimateCallCostUSD } from "../openai";
import { normalizeUrl } from "../url-normalize";
import type { Source } from "../agents/types";
import type {
  AllocatorFactSheet,
  AssetClass,
  Baseline,
  CandidateVehicle,
  VehicleFact,
} from "./types";

// The Allocator sweep is the single point where the planner touches the open
// web. ONE Haiku call with web_search batch-collects, for the deterministic
// candidate universe: each vehicle's current price + expense ratio + (for
// cash/bond/dividend vehicles) current yield, plus a shared macro-regime read.
// Provenance is enforced exactly like the Council sweep — model-reported source
// URLs that don't match a real web_search result are dropped.

const ALLOCATOR_WEB_SEARCH_TOOL = {
  type: "web_search_20250305" as const,
  name: "web_search" as const,
  max_uses: 4,
};

const SYSTEM = `You are the Allocator Sweep agent for Conviqt's investment-planning engine.

Your job: given a short list of well-known funds/ETFs and cash vehicles, gather the freshest factual evidence the four planning agents need — current price, expense ratio, and (for bond/dividend/money-market/savings vehicles) current yield — plus a current macro-regime read. You are NOT giving advice or building the plan. You produce a structured, cited fact sheet.

Procedure:
1. Use the web_search tool (up to 4 searches) efficiently. Batch tickers per query — never one ticker at a time.
   - Search 1-2: prices + expense ratios for the ETFs/funds (e.g. "VTI VXUS BND SCHD ETF price expense ratio").
   - Search 3: current yields — money-market fund (VMFXX/SPAXX) 7-day yield, current Series I savings bond rate, high-yield savings rates, bond ETF SEC yield.
   - Search 4: current macro regime — fed funds rate, inflation/CPI trend, growth/recession signals, market risk appetite.
2. After searching, call report_vehicle_facts ONCE with everything found. Produce no other final output.

Rules:
- MANDATORY: the sources array must contain the exact URLs from your web_search results. Copy URLs verbatim. The post-processor cross-checks every URL against the real search results and drops mismatches; an empty sources array discards every fact.
- For EVERY requested vehicle, return what you can source: price (string with units) + priceNum for ETFs, expenseRatio for funds/ETFs, yield for cash/bond/dividend/savings vehicles. If you cannot source a field, omit it rather than inventing it. Never invent a number.
- Pseudo-tickers: "HYSA" = a typical high-yield savings APY; "IBOND" = the current US Series I savings bond composite rate. Quote a yield for these, no price.
- macroRegime: 2-4 sentences on the CURRENT regime (rates, inflation, growth, risk appetite), with macroSourceIndexes citing where it came from.`;

const REPORT_TOOL = {
  name: "report_vehicle_facts",
  description:
    "Emit the structured vehicle fact sheet — per-vehicle price/expense/yield as available — plus a shared macro-regime read, citing every number to a web_search source URL.",
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
      vehicles: {
        type: "array",
        description: "One entry per requested ticker/pseudo-ticker.",
        items: {
          type: "object",
          properties: {
            ticker: { type: "string" },
            price: { type: "string", description: "Price string with units, e.g. '$262.40'. Omit for cash/bond pseudo-vehicles." },
            priceNum: { type: ["number", "null"], description: "Bare numeric price, or null if not applicable/found." },
            expenseRatio: { type: "string", description: "e.g. '0.03%'. Omit if not found." },
            yield: { type: "string", description: "Current yield, e.g. '4.6%'. For money-market/bond/dividend/savings vehicles. Omit if not applicable." },
            note: { type: "string", description: "Optional one-clause color. Keep short." },
            sourceIndexes: { type: "array", items: { type: "number" } },
          },
          required: ["ticker", "sourceIndexes"],
        },
      },
      macroRegime: { type: "string", description: "2-4 sentence current macro-regime read." },
      macroSourceIndexes: { type: "array", items: { type: "number" } },
      unresolved: { type: "array", items: { type: "string" }, description: "Tickers you could not source anything for." },
    },
    required: ["sources", "vehicles", "macroRegime", "macroSourceIndexes", "unresolved"],
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
  vehicles: Array<{
    ticker: string;
    price?: string;
    priceNum?: number | null;
    expenseRatio?: string;
    yield?: string;
    note?: string;
    sourceIndexes: number[];
  }>;
  macroRegime: string;
  macroSourceIndexes: number[];
  unresolved: string[];
}

export interface AllocatorSweepResult {
  factSheet: AllocatorFactSheet;
  costUSD: number;
  durationMs: number;
  webSearchCount: number;
  rejectedSources: number;
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

export async function runAllocatorSweep(
  baseline: Baseline,
  opts: { asOf?: string } = {}
): Promise<AllocatorSweepResult> {
  const t0 = Date.now();
  const asOf = opts.asOf ?? new Date().toISOString();
  const anthropic = getOpenAI();

  const universe = baseline.candidateUniverse;
  const byTicker = new Map<string, CandidateVehicle>();
  for (const v of universe) byTicker.set(v.ticker.toUpperCase(), v);

  const list = universe
    .map((v) => `${v.ticker} (${v.name}; need: ${v.wants.join("+")})`)
    .join("\n");

  const response = await anthropic.messages.create({
    model: MODELS.sweep,
    max_tokens: 4096,
    system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
    tools: [ALLOCATOR_WEB_SEARCH_TOOL, REPORT_TOOL],
    messages: [
      {
        role: "user",
        content: `Vehicles to quote (${universe.length}):
${list}

Run your batched searches now, then call report_vehicle_facts with the price/expense/yield you could source for each, plus the macro regime.`,
      },
    ],
  });

  const content = response.content as unknown as ContentBlock[];

  for (const block of content) {
    if (block.type === "server_tool_use" && block.name === "web_search") {
      const q = (block.input as { query?: string })?.query ?? "?";
      console.log(`[AllocatorSweep] web_search: "${q}"`);
    }
  }

  const toolUse = content.find((b) => b.type === "tool_use" && b.name === REPORT_TOOL.name);
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error(
      `[AllocatorSweep] model did not call report_vehicle_facts. Stop reason: ${response.stop_reason}.`
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

  // Fallback: if the model omitted/garbled all sources but web_search returned
  // URLs, auto-populate up to 4 real canonical sources so cited numbers still
  // trace to a real search result.
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
            idxs.map((i) => indexRemap.get(i)).filter((i): i is number => i !== undefined)
          )
        )
      : [];

  const reported = Array.isArray(input.vehicles) ? input.vehicles : [];
  const seen = new Set<string>();
  const vehicleFacts: VehicleFact[] = [];

  for (const r of reported) {
    const ticker = (r.ticker ?? "").toUpperCase();
    const cand = byTicker.get(ticker);
    if (!cand || seen.has(ticker)) continue;
    seen.add(ticker);
    const priceNum =
      typeof r.priceNum === "number" && isFinite(r.priceNum) && r.priceNum > 0 ? r.priceNum : null;
    vehicleFacts.push({
      ticker: cand.ticker,
      name: cand.name,
      assetClass: cand.assetClass,
      kind: cand.kind,
      price: r.price?.trim() || (priceNum !== null ? `$${priceNum}` : undefined),
      priceNum,
      expenseRatio: r.expenseRatio?.trim() || undefined,
      yield: r.yield?.trim() || undefined,
      note: r.note?.trim() || undefined,
      sourceIndexes: remapIndexes(r.sourceIndexes),
    });
  }

  // Any requested vehicle the model never reported on = stub (still listed so
  // the planner knows it was in the universe, just unsourced).
  for (const cand of universe) {
    if (!seen.has(cand.ticker.toUpperCase())) {
      vehicleFacts.push({
        ticker: cand.ticker,
        name: cand.name,
        assetClass: cand.assetClass,
        kind: cand.kind,
        sourceIndexes: [],
      });
    }
  }

  const unresolved = Array.from(
    new Set([
      ...(Array.isArray(input.unresolved) ? input.unresolved.map((u) => u.toUpperCase()) : []),
      ...vehicleFacts
        .filter((v) => !v.price && !v.expenseRatio && !v.yield)
        .map((v) => v.ticker),
    ])
  );

  const webSearchCount = content.filter(
    (b) => b.type === "server_tool_use" && b.name === "web_search"
  ).length;

  // Soft integrity check: if we sourced literally nothing for the whole
  // universe AND have no sources, the plan would be uncited — fail loudly.
  const sourcedCount = vehicleFacts.filter((v) => v.sourceIndexes.length > 0).length;
  if (sourcedCount === 0 && validSources.length === 0) {
    throw new Error(
      `[AllocatorSweep] could not source any live vehicle facts. Rejected ${rejectedSources} unverified sources.`
    );
  }

  const factSheet: AllocatorFactSheet = {
    asOf,
    vehicles: vehicleFacts,
    macroRegime: input.macroRegime?.trim() || "No macro-regime read returned.",
    macroSourceIndexes: remapIndexes(input.macroSourceIndexes),
    sources: validSources,
    unresolved,
  };

  const costUSD = estimateCallCostUSD(MODELS.sweep, response.usage, webSearchCount);

  console.log(
    `[AllocatorSweep] done in ${Date.now() - t0}ms: sourced ${sourcedCount}/${universe.length}, ` +
      `${validSources.length} sources, ${webSearchCount} searches, ${rejectedSources} rejected, cost=$${costUSD.toFixed(4)}`
  );

  return {
    factSheet,
    costUSD,
    durationMs: Date.now() - t0,
    webSearchCount,
    rejectedSources,
  };
}

// Helper for the model layer: a tickers-by-asset-class index the judge uses to
// keep its vehicle picks inside the sourced universe.
export function vehiclesByClass(fs: AllocatorFactSheet): Record<string, VehicleFact[]> {
  const out: Record<string, VehicleFact[]> = {};
  for (const v of fs.vehicles) {
    const k: AssetClass = v.assetClass;
    (out[k] ??= []).push(v);
  }
  return out;
}
