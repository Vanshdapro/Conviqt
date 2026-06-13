// Scheduled content generation for Dashboard + Headlines (playbook Phase 4).
//
// Cost discipline (CLAUDE.md): the whole refresh runs on Haiku and must stay
// under $0.35 all-in. The two cost levers, by design:
//   1. Dashboard = ONE Haiku call with web_search (max 3) that produces
//      trends + signals + events together — never one call per widget.
//   2. Headlines = raw headlines come from Currents (free), then Haiku
//      annotates regions in BATCHES of 4 per call with NO web_search.
// Every call's cost is measured with estimateCallCostUSD and returned to the
// refresh route, which writes the per-run ledger row (feed_refresh_runs).

import { getOpenAI, MODELS, estimateCallCostUSD } from "../openai";
import { fetchHeadlines, type NewsHeadline } from "../news/currents";
import {
  FEED_REGIONS,
  type DashboardContent,
  type FeedEvent,
  type FeedHeadline,
  type FeedRegion,
  type HeadlinesRegion,
} from "./types";

// Hard ceiling for one full refresh (CLAUDE.md "Cost discipline").
export const PER_REFRESH_BUDGET_USD = 0.35;

const TICKER_RE = /^[A-Z][A-Z0-9.\-]{0,9}$/;

type Usage = {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
};

function countWebSearches(content: Array<{ type: string; name?: string }>): number {
  return content.filter((b) => b.type === "server_tool_use" && b.name === "web_search").length;
}

function findToolUse<T>(
  content: Array<{ type: string; name?: string; input?: unknown }>,
  name: string
): T | null {
  for (let i = content.length - 1; i >= 0; i--) {
    const b = content[i];
    if (b.type === "tool_use" && b.name === name) return b.input as T;
  }
  return null;
}

function clampLine(s: unknown, max = 180): string {
  if (typeof s !== "string") return "";
  const t = s.trim().replace(/\s+/g, " ");
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

function cleanTickers(raw: unknown, max = 3): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const t of raw) {
    if (typeof t !== "string") continue;
    const sym = t.trim().toUpperCase();
    if (TICKER_RE.test(sym) && !out.includes(sym)) out.push(sym);
    if (out.length >= max) break;
  }
  return out;
}

// ── Dashboard: trends + signals + events in ONE searching call ──────────────

const DASHBOARD_TOOL = {
  name: "submit_dashboard",
  description: "Submit the finished dashboard content. Call exactly once, after your searches.",
  input_schema: {
    type: "object" as const,
    properties: {
      trends: {
        type: "array",
        description: "Exactly 3 one-line reads on what is shaping the market today.",
        items: { type: "string" },
      },
      signals: {
        type: "array",
        description: "Exactly 3 unusual movers seen in your search results.",
        items: {
          type: "object",
          properties: {
            ticker: { type: "string", description: "US-listed ticker, e.g. NVDA" },
            note: { type: "string", description: "What is unusual (the move), one line" },
            reason: { type: "string", description: "Why it is moving, one line" },
          },
          required: ["ticker", "note", "reason"],
        },
      },
      events: {
        type: "array",
        description:
          "Up to 6 upcoming dates that matter: notable earnings and the next Fed (FOMC) decision. Only dates you saw in search results.",
        items: {
          type: "object",
          properties: {
            kind: { type: "string", enum: ["earnings", "fed", "macro"] },
            date: { type: "string", description: "YYYY-MM-DD" },
            label: { type: "string", description: "One line, plain English" },
            ticker: { type: "string", description: "Ticker if kind=earnings" },
            sourceUrl: { type: "string", description: "URL from your search results backing this date" },
          },
          required: ["kind", "date", "label"],
        },
      },
    },
    required: ["trends", "signals", "events"],
  },
};

const FEED_SEARCH_TOOL = {
  type: "web_search_20250305" as const,
  name: "web_search" as const,
  max_uses: 3, // the cost lever — 3¢ of search per refresh, no more
};

const DASHBOARD_SYSTEM = `You write the daily market dashboard for Conviqt, a research and education app for beginner investors. Plain English only — no jargon, no finance-bro shorthand. Never tell anyone to buy or sell; you describe what is happening, not what to do.

Process:
1. Use web_search (up to 3 searches, e.g. "stock market today", "biggest stock movers unusual volume today", "upcoming earnings this week next FOMC meeting date") to ground every claim.
2. Then call submit_dashboard exactly once.

Rules:
- trends: exactly 3, each one sentence under 140 characters, about what is shaping the market right now (rates, sectors, big stories).
- signals: exactly 3 stocks moving unusually (big move, heavy volume, odd direction). Real US-listed tickers from your search results only. note = the move, reason = the why. Never invent a number you did not see.
- events: upcoming earnings dates for widely-held companies plus the next Fed (FOMC) decision date, only if your searches showed the date. Include the sourceUrl the date came from. Dates must be today or later.
- If your searches did not surface something, leave it out — honesty beats completeness.`;

export interface GenerateResult<T> {
  content: T;
  costUSD: number;
  webSearches: number;
}

export async function generateDashboard(): Promise<GenerateResult<DashboardContent>> {
  const client = getOpenAI();
  const today = new Date().toISOString().slice(0, 10);

  const res = await client.messages.create({
    model: MODELS.feed,
    max_tokens: 2000,
    system: DASHBOARD_SYSTEM,
    tools: [FEED_SEARCH_TOOL, DASHBOARD_TOOL],
    messages: [
      {
        role: "user",
        content: `Today is ${today}. Build the dashboard content: search, then submit.`,
      },
    ],
  });

  const webSearches = countWebSearches(res.content as never);
  const costUSD = estimateCallCostUSD(MODELS.feed, res.usage as Usage, webSearches);

  const raw = findToolUse<{
    trends?: unknown[];
    signals?: Array<{ ticker?: unknown; note?: unknown; reason?: unknown }>;
    events?: Array<{ kind?: unknown; date?: unknown; label?: unknown; ticker?: unknown; sourceUrl?: unknown }>;
  }>(res.content as never, DASHBOARD_TOOL.name);
  if (!raw) {
    throw new Error(`dashboard: model never called ${DASHBOARD_TOOL.name} (stop=${res.stop_reason})`);
  }

  const trends = (raw.trends ?? [])
    .map((t) => clampLine(t, 160))
    .filter(Boolean)
    .slice(0, 3)
    .map((text) => ({ text }));

  const signals = (raw.signals ?? [])
    .map((s) => ({
      ticker: cleanTickers([s.ticker], 1)[0] ?? "",
      note: clampLine(s.note, 160),
      reason: clampLine(s.reason, 160),
    }))
    .filter((s) => s.ticker && s.note)
    .slice(0, 3);

  const events: FeedEvent[] = (raw.events ?? [])
    .map((e) => ({
      kind: (["earnings", "fed", "macro"].includes(String(e.kind)) ? e.kind : "macro") as FeedEvent["kind"],
      date: typeof e.date === "string" ? e.date.trim() : "",
      label: clampLine(e.label, 120),
      ticker: cleanTickers([e.ticker], 1)[0],
      sourceUrl: typeof e.sourceUrl === "string" && /^https?:\/\//.test(e.sourceUrl) ? e.sourceUrl : undefined,
    }))
    .filter((e) => /^\d{4}-\d{2}-\d{2}$/.test(e.date) && e.date >= today && e.label)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 6);

  if (trends.length < 3 || signals.length < 3) {
    // Honest failure beats a half-filled dashboard that looks authoritative.
    throw new Error(
      `dashboard: incomplete output (trends=${trends.length}, signals=${signals.length})`
    );
  }

  return {
    content: { trends, signals, events, generatedAt: new Date().toISOString() },
    costUSD,
    webSearches,
  };
}

// ── Headlines: Currents gathers, Haiku annotates in region batches ──────────

const CANDIDATES_PER_REGION = 9; // what Haiku sees
const PUBLISHED_PER_REGION = 5; // what we publish
const REGIONS_PER_CALL = 4; // batch size — 11 regions → 3 Haiku calls

const TAKES_TOOL = {
  name: "submit_takes",
  description: "Submit the chosen headlines with their one-line takes.",
  input_schema: {
    type: "object" as const,
    properties: {
      regions: {
        type: "array",
        items: {
          type: "object",
          properties: {
            region: { type: "string", description: "The region id exactly as given" },
            picks: {
              type: "array",
              description: `The ${PUBLISHED_PER_REGION} most market-relevant headlines for this region, by index.`,
              items: {
                type: "object",
                properties: {
                  index: { type: "number", description: "Candidate index as listed" },
                  take: { type: "string", description: "One line: why traders care. Under 140 chars, plain English." },
                  tickers: {
                    type: "array",
                    description: "0-3 US-listed stock tickers this plausibly touches. Stocks only — never crypto coin symbols.",
                    items: { type: "string" },
                  },
                },
                required: ["index", "take", "tickers"],
              },
            },
          },
          required: ["region", "picks"],
        },
      },
    },
    required: ["regions"],
  },
};

const TAKES_SYSTEM = `You annotate world news headlines for Conviqt, a stock research and education app for beginners. For each region pick the ${PUBLISHED_PER_REGION} headlines most relevant to markets/business (skip listicles, celebrity fluff, sports), and for each give:
- take: one sentence, under 140 characters, plain English, on why a trader or investor would care. No jargon, no advice, never "buy" or "sell".
- tickers: 0-3 US-listed stock tickers (including ADRs like BABA, TSM) the story plausibly touches. The analysis engine covers stocks only — NEVER list crypto coin symbols (no BTC, ETH); for crypto stories use affected stocks (e.g. COIN, MSTR) or leave empty. If no listed stock is clearly affected, return [].
Use only the candidate indexes given. Do not rewrite titles. Call submit_takes exactly once.`;

interface RegionCandidates {
  region: FeedRegion;
  candidates: NewsHeadline[];
}

// Pick up to n candidates: newest first, preferring source variety so one
// outlet can't fill a whole tab.
function selectCandidates(headlines: NewsHeadline[], n: number): NewsHeadline[] {
  const seen = new Set<string>();
  const deduped = headlines.filter((h) => {
    const key = h.title.toLowerCase().slice(0, 80);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  deduped.sort((a, b) => (b.publishedAt || "").localeCompare(a.publishedAt || ""));
  const out: NewsHeadline[] = [];
  const usedSources = new Map<string, number>();
  for (const h of deduped) {
    if ((usedSources.get(h.source) ?? 0) >= 3) continue; // variety cap
    out.push(h);
    usedSources.set(h.source, (usedSources.get(h.source) ?? 0) + 1);
    if (out.length >= n) break;
  }
  return out;
}

async function gatherRegion(region: FeedRegion): Promise<RegionCandidates> {
  let headlines: NewsHeadline[] = [];
  try {
    headlines = await fetchHeadlines({ ...region.query, limit: 30 });
  } catch (err) {
    console.warn(`[feed] gather ${region.id}: primary query failed: ${err instanceof Error ? err.message : err}`);
  }
  if (headlines.length < PUBLISHED_PER_REGION && region.fallback) {
    try {
      const more = await fetchHeadlines({ ...region.fallback, limit: 30 });
      headlines = headlines.concat(more);
    } catch (err) {
      console.warn(`[feed] gather ${region.id}: fallback query failed: ${err instanceof Error ? err.message : err}`);
    }
  }
  return { region, candidates: selectCandidates(headlines, CANDIDATES_PER_REGION) };
}

async function annotateBatch(
  batch: RegionCandidates[]
): Promise<{ regions: HeadlinesRegion[]; costUSD: number }> {
  const client = getOpenAI();
  const now = new Date().toISOString();

  const listing = batch
    .map(({ region, candidates }) => {
      const lines = candidates
        .map(
          (h, i) =>
            `  [${i}] ${h.title}${h.description ? ` — ${h.description.slice(0, 160)}` : ""} (${h.source})`
        )
        .join("\n");
      return `REGION ${region.id} (${region.label}):\n${lines}`;
    })
    .join("\n\n");

  const res = await client.messages.create({
    model: MODELS.feed,
    max_tokens: 2500,
    system: TAKES_SYSTEM,
    tools: [TAKES_TOOL],
    tool_choice: { type: "tool", name: TAKES_TOOL.name },
    messages: [{ role: "user", content: listing }],
  });

  const costUSD = estimateCallCostUSD(MODELS.feed, res.usage as Usage, 0);
  const raw = findToolUse<{
    regions?: Array<{ region?: unknown; picks?: Array<{ index?: unknown; take?: unknown; tickers?: unknown }> }>;
  }>(res.content as never, TAKES_TOOL.name);

  const out: HeadlinesRegion[] = [];
  for (const { region, candidates } of batch) {
    const annotated = raw?.regions?.find((r) => r.region === region.id);
    const picks = (annotated?.picks ?? [])
      .map((p) => {
        const idx = typeof p.index === "number" ? p.index : -1;
        const h = candidates[idx];
        if (!h) return null;
        const take = clampLine(p.take, 150);
        if (!take) return null;
        const headline: FeedHeadline = {
          id: h.id,
          title: h.title,
          url: h.url,
          source: h.source,
          publishedAt: h.publishedAt,
          take,
          tickers: cleanTickers(p.tickers),
        };
        return headline;
      })
      .filter((h): h is FeedHeadline => h !== null)
      .slice(0, PUBLISHED_PER_REGION);
    out.push({ region: region.id, headlines: picks, generatedAt: now });
  }
  return { regions: out, costUSD };
}

export interface HeadlinesRunResult {
  /** Regions that produced a publishable edition this run. */
  regions: HeadlinesRegion[];
  /** Regions skipped because gathering came back empty (keep last edition). */
  skipped: string[];
  costUSD: number;
}

export async function generateHeadlines(): Promise<HeadlinesRunResult> {
  // Gather every region from Currents in parallel — free, ~11-22 requests of
  // the 1000/day tier.
  const gathered = await Promise.all(FEED_REGIONS.map(gatherRegion));

  const skipped = gathered.filter((g) => g.candidates.length === 0).map((g) => g.region.id);
  const usable = gathered.filter((g) => g.candidates.length > 0);

  const batches: RegionCandidates[][] = [];
  for (let i = 0; i < usable.length; i += REGIONS_PER_CALL) {
    batches.push(usable.slice(i, i + REGIONS_PER_CALL));
  }

  const results = await Promise.all(batches.map(annotateBatch));
  const regions = results.flatMap((r) => r.regions);
  const costUSD = results.reduce((sum, r) => sum + r.costUSD, 0);

  // A region whose annotation produced zero picks is also a skip — keeping
  // yesterday's edition (with its honest timestamp) beats an empty tab.
  const empty = regions.filter((r) => r.headlines.length === 0).map((r) => r.region);
  return {
    regions: regions.filter((r) => r.headlines.length > 0),
    skipped: [...skipped, ...empty],
    costUSD,
  };
}
