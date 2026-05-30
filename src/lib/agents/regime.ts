import {
  getAnthropic,
  MODELS,
  WEB_SEARCH_TOOL,
  estimateCallCostUSD,
} from "../anthropic";
import { normalizeUrl } from "../url-normalize";
import type { AlphaPickSource, MacroRegime, RegimeStance } from "../alphaTypes";

// Macro Regime agent — the top of the Alpha Tracker funnel.
//
// Modeled on the "economist / macro" seat of a real desk: before any name is
// scouted, read the current market regime so the rest of the pipeline leans
// into tailwinds and away from headwinds. One Haiku call + up to 2 web_searches
// keeps this cheap (~2-3 cents). Output is structured and cited, then fed to
// the regime-aware picker and the CIO synthesis, and stamped on the pick.

const SYSTEM = `You are the Macro strategist who sets the regime for Conviqt's paper trading desk.

Your job: read TODAY'S US market regime, then call report_regime ONCE. You are not picking stocks — you are framing the environment the desk will hunt in.

Procedure:
1. Use web_search (up to 2 queries) to read the current tape. Cover: equity index trend + breadth, the VIX / volatility, 10y and 2y Treasury yields and the curve, the latest Fed posture and rate expectations, the freshest CPI / jobs print, the US dollar, and which sectors are leading vs lagging.
2. Synthesize into a single regime call and emit report_regime.

How to set stance:
- RISK_ON: improving breadth, falling or contained volatility, easing or steady policy, soft-landing data, cyclicals/tech leading.
- RISK_OFF: deteriorating breadth, spiking volatility, inverted curve biting, tightening or hawkish surprises, defensives leading, credit stress.
- NEUTRAL: mixed or rotating signals with no clear edge — the honest default when the tape is choppy.

Rules:
- favoredSectors: 2-4 sectors with a genuine macro tailwind in THIS regime. Be specific (e.g. "Energy", "Financials", "Software/AI infrastructure").
- avoidSectors: 2-4 sectors fighting a headwind right now.
- keyRisks: 2-4 named, current risks (e.g. "sticky core CPI re-pricing Fed cuts", "10y above 4.5% pressuring multiples"). Not generic platitudes.
- summary: 1-2 sentences. The regime in plain institutional language.
- Cite the sources array with the URLs your web_search actually returned. Never invent a URL or a data point.
- Be honest and current. Stale or hand-wavy macro is worse than NEUTRAL.`;

const REPORT_REGIME_TOOL = {
  name: "report_regime",
  description: "Emit the current macro regime read for the desk.",
  input_schema: {
    type: "object" as const,
    properties: {
      stance: {
        type: "string",
        enum: ["RISK_ON", "NEUTRAL", "RISK_OFF"],
      },
      summary: {
        type: "string",
        description: "1-2 sentence plain-language read of the current regime.",
      },
      favoredSectors: {
        type: "array",
        items: { type: "string" },
        description: "2-4 sectors with a macro tailwind right now.",
      },
      avoidSectors: {
        type: "array",
        items: { type: "string" },
        description: "2-4 sectors fighting a macro headwind right now.",
      },
      keyRisks: {
        type: "array",
        items: { type: "string" },
        description: "2-4 named, current macro risks the desk is watching.",
      },
      sources: {
        type: "array",
        description:
          "URLs from your web_search results backing this read. Use exact URLs returned by search.",
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
    },
    required: ["stance", "summary", "favoredSectors", "avoidSectors", "keyRisks", "sources"],
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

// Same provenance discipline as sweep: only keep model-reported sources whose
// URL actually appeared in a web_search_tool_result block.
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
      if (!norm || map.has(norm)) continue;
      map.set(norm, {
        url: result.url,
        title: typeof result.title === "string" ? result.title : result.url,
      });
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

function cleanList(arr: unknown, max: number): string[] {
  if (!Array.isArray(arr)) return [];
  return arr
    .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
    .map((x) => x.trim().slice(0, 80))
    .slice(0, max);
}

export async function runMacroRegime(): Promise<MacroRegime> {
  const t0 = Date.now();
  const asOf = new Date().toISOString();
  const anthropic = getAnthropic();

  const response = await anthropic.messages.create({
    model: MODELS.regime,
    max_tokens: 900,
    system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
    tools: [WEB_SEARCH_TOOL, REPORT_REGIME_TOOL],
    messages: [
      {
        role: "user",
        content:
          "Read today's US market regime, then call report_regime with your structured read.",
      },
    ],
  });

  const content = response.content as unknown as ContentBlock[];

  for (const block of content) {
    if (block.type === "server_tool_use" && block.name === "web_search") {
      const q = (block.input as { query?: string })?.query ?? "?";
      console.log(`[Regime] web_search: "${q}"`);
    }
  }

  const webSearchCount = content.filter(
    (b) => b.type === "server_tool_use" && b.name === WEB_SEARCH_TOOL.name
  ).length;
  const costUSD = estimateCallCostUSD(MODELS.regime, response.usage, webSearchCount);

  const toolUse = content.find(
    (b) => b.type === "tool_use" && b.name === REPORT_REGIME_TOOL.name
  );

  // Non-fatal: if the regime read fails, the pipeline continues NEUTRAL. A
  // missing regime should never block the desk from running.
  if (!toolUse || toolUse.type !== "tool_use") {
    console.warn(
      `[Regime] no report_regime call (stop_reason=${response.stop_reason}); defaulting to NEUTRAL`
    );
    return {
      stance: "NEUTRAL",
      summary: "Regime read unavailable this run; proceeding neutral.",
      favoredSectors: [],
      avoidSectors: [],
      keyRisks: [],
      sources: [],
      asOf,
      costUSD,
      durationMs: Date.now() - t0,
    };
  }

  const input = toolUse.input as {
    stance?: string;
    summary?: string;
    favoredSectors?: unknown;
    avoidSectors?: unknown;
    keyRisks?: unknown;
    sources?: Array<{ url: string; title: string; publisher: string }>;
  };

  // Provenance-verify sources against real web_search URLs.
  const canonical = extractCanonicalUrls(content);
  const sources: AlphaPickSource[] = [];
  const seen = new Set<string>();
  for (const s of input.sources ?? []) {
    const norm = normalizeUrl(s.url);
    if (!norm || !canonical.has(norm) || seen.has(norm)) continue;
    seen.add(norm);
    const canon = canonical.get(norm)!;
    sources.push({
      url: canon.url,
      title: (s.title?.trim() || canon.title || canon.url).slice(0, 200),
      publisher: (s.publisher?.trim() || hostnameFor(canon.url)).slice(0, 80),
    });
  }
  // If the model omitted sources but search returned URLs, back-fill up to 3.
  if (sources.length === 0) {
    let n = 0;
    for (const [, meta] of canonical) {
      sources.push({
        url: meta.url,
        title: (meta.title || meta.url).slice(0, 200),
        publisher: hostnameFor(meta.url).slice(0, 80),
      });
      if (++n >= 3) break;
    }
  }

  const stance: RegimeStance =
    input.stance === "RISK_ON" || input.stance === "RISK_OFF"
      ? input.stance
      : "NEUTRAL";

  return {
    stance,
    summary: (input.summary ?? "").trim().slice(0, 400) || "No regime summary provided.",
    favoredSectors: cleanList(input.favoredSectors, 4),
    avoidSectors: cleanList(input.avoidSectors, 4),
    keyRisks: cleanList(input.keyRisks, 4),
    sources,
    asOf,
    costUSD,
    durationMs: Date.now() - t0,
  };
}
