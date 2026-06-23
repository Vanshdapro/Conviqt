// The Map narrative generator — the plain-English voice over the deterministic
// market map.
//
// The deterministic engine (sectors.ts) already knows, from price history alone,
// which sectors led and lagged this period and how the market itself moved. That
// table always renders. This file adds ONE cheap DeepSeek V4 Flash call
// (MODELS.lens, NO web_search) that turns the table into a short story: what the
// market is doing, where capital rotated this month, and a few honest "things to
// watch" lines.
//
// Pipeline (cheap by design, CLAUDE.md cost discipline — ≈1–3¢ per refresh):
//   1. computeMarketMap() → the deterministic table (leaders/laggards/returns).
//   2. Cached market-wide macro context (Currents headlines via the Dashboard
//      feed). Optional — the call still works without it.
//   3. ONE MODELS.lens call over the table → headline, story, leaders/laggards
//      notes, and 2–3 forward "watch" lines. The model never invents a number.
//
// HONESTY GUARDRAIL (load-bearing, CLAUDE.md): the Map gives ORIENTATION, never
// alpha. It may say "capital rotated INTO energy this month, here's the story" —
// it must NEVER say "buy energy," never predict, never imply an edge. No
// imperative trade language. Plain English for a 19-year-old with $500.

import { getOpenAI, MODELS, estimateCallCostUSD } from "../openai";
import { fetchHeadlines, currentsConfigured } from "../news/currents";
import { readDashboard } from "../feed/store";
import { computeMarketMap } from "./sectors";
import type { MarketMapData, MarketMapNarrative, MarketMap, RotationEntry } from "./types";
import { retForHorizon } from "./types";

export const PER_MAP_BUDGET_USD = 0.03;

// How many leaders/laggards to surface to the model. The graph shows all 11
// sectors; the story only needs the extremes.
const ROTATION_FOR_STORY = 4;
// Headlines to gather as macro colour when the Dashboard cache is empty.
const NEWS_FOR_MACRO = 4;

type Usage = {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
};

// ── Local copies of the lens house helpers (kept private, same shapes) ───────

function clampLine(s: unknown, max = 220): string {
  if (typeof s !== "string") return "";
  const t = s.trim().replace(/\s+/g, " ");
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
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

function fmtPct(n: number | null): string {
  return n == null ? "n/a" : `${n >= 0 ? "+" : ""}${n}%`;
}

// One rotation row → a single readable line for the prompt. Lead with the
// horizon return (what the ranking is sorted by), keep the others for context.
function rotationLine(e: RotationEntry, horizon: MarketMapData["horizon"]): string {
  const lead = retForHorizon(e, horizon);
  return (
    `  ${e.label} (${e.ticker}) — ${fmtPct(lead)} this period ` +
    `[1wk ${fmtPct(e.ret1wPct)}, 1mo ${fmtPct(e.ret1mPct)}, 3mo ${fmtPct(e.ret3mPct)}]`
  );
}

// ── Macro context (optional, never blocks the call) ──────────────────────────

// Reuse the Dashboard's cached "Today's Trends" first (free, already paid for);
// fall back to a tiny Currents pull only if that cache is empty. Both are
// best-effort — the narrative is happy with no macro at all.
async function macroContext(): Promise<string> {
  try {
    const dash = await readDashboard();
    const trends = (dash?.trends ?? []).map((t) => `  - ${t.text}`).filter(Boolean);
    if (trends.length) {
      return `What's shaping the market lately (general context):\n${trends.join("\n")}`;
    }
  } catch {
    // fall through to Currents
  }

  if (!currentsConfigured()) return "";
  try {
    const hl = await fetchHeadlines({ category: "finance", country: "US", limit: NEWS_FOR_MACRO });
    if (hl.length === 0) return "";
    const lines = hl.slice(0, NEWS_FOR_MACRO).map((h) => `  - ${h.title} (${h.source})`).join("\n");
    return `Recent market headlines (general context):\n${lines}`;
  } catch {
    return "";
  }
}

// ── The model call ────────────────────────────────────────────────────────────

const MAP_TOOL = {
  name: "submit_map_story",
  description:
    "Submit the finished market-map narrative. Call exactly once, using only the numbers provided. Orientation only — never tell anyone to buy or sell, never predict.",
  input_schema: {
    type: "object" as const,
    properties: {
      headline: {
        type: "string",
        description:
          "One line: what the market is doing right now, in plain English a beginner would say. No jargon, no 'buy'.",
      },
      story: {
        type: "string",
        description:
          "2-4 sentences: where capital rotated this period (into what, out of what) and the honest story behind it. Describe what happened — never predict, never advise.",
      },
      leadersNote: {
        type: "string",
        description:
          "One line on what's leading and the honest why. Explain the rotation, do NOT say it will continue and do NOT say to buy it.",
      },
      laggardsNote: {
        type: "string",
        description: "One line on what's lagging and the honest why. No prediction, no advice.",
      },
      watch: {
        type: "array",
        description:
          "2-3 forward 'what to watch' lines — framing for the weeks ahead, NOT predictions. Each names a thing to keep an eye on and why it matters. Never a price target, never 'buy/sell'.",
        items: { type: "string" },
      },
    },
    required: ["headline", "story", "leadersNote", "laggardsNote", "watch"],
  },
};

const MAP_SYSTEM = `You write the plain-English story over Conviqt's market map — a picture of what the whole market is doing and where money moved this period. Conviqt is a research and education app for beginner investors.

Voice: plain English, warm, calm. No jargon, no finance-bro shorthand, no machinery talk. Picture explaining it to a 19-year-old with $500.

Hard rules (these are the brand — breaking them is worse than saying less):
- ORIENTATION ONLY. You describe what already happened and the story behind it. You NEVER tell anyone to buy or sell, NEVER predict where prices go, NEVER imply an edge or a "smart" move.
- No imperative trade language anywhere ("buy", "sell", "load up", "get in"). The map orients; it does not advise.
- Use ONLY the numbers given. Never invent or estimate a figure. Where you lack a number, talk in words.
- The horizon is the period stated. A single day's wiggle is noise — the story is the rotation across the period.
- "watch" lines are framing, not forecasts: name a thing to keep an eye on and why it matters, never "X will rise".
- Honesty is the brand. If rotation was muted or mixed, say so plainly. Don't manufacture drama.
Then call submit_map_story exactly once.`;

function buildUserPrompt(data: MarketMapData, macroBlock: string): string {
  const horizonLabel = data.horizon === "1w" ? "past week" : data.horizon === "3m" ? "past quarter" : "past month";

  // Indices anchor the read — "is the whole market up or down" framing.
  const indices = data.nodes
    .filter((n) => n.kind === "index")
    .map((n) => `  ${n.label} (${n.ticker}): ${fmtPct(retForHorizon(n, data.horizon))} this period`)
    .join("\n");

  const leaders = data.leaders.slice(0, ROTATION_FOR_STORY).map((e) => rotationLine(e, data.horizon)).join("\n");
  const laggards = data.laggards.slice(0, ROTATION_FOR_STORY).map((e) => rotationLine(e, data.horizon)).join("\n");

  const parts: string[] = [
    `Market map as of ${data.asOf}. Horizon: ${horizonLabel}. Source: ${data.freshnessLabel}.`,
    ``,
    `The market itself (anchors):`,
    indices || "  (no index data this run)",
    ``,
    `Sectors capital rotated INTO this period (leaders, best first):`,
    leaders || "  (none ranked)",
    ``,
    `Sectors capital rotated OUT OF this period (laggards, worst first):`,
    laggards || "  (none ranked)",
  ];
  if (data.unpriced.length) parts.push(``, `Could not price (leave out of the story): ${data.unpriced.join(", ")}`);
  if (macroBlock) parts.push(``, macroBlock);
  parts.push(
    ``,
    `Write the market-map story for the ${horizonLabel}, then call submit_map_story. Orientation only — never predict, never say buy or sell.`
  );
  return parts.join("\n");
}

interface MapToolOutput {
  headline?: unknown;
  story?: unknown;
  leadersNote?: unknown;
  laggardsNote?: unknown;
  watch?: unknown[];
}

// ── Public: the narrative (one MODELS.lens call over the deterministic table) ──

export async function generateMarketMapNarrative(
  data: MarketMapData,
  ctx: { macroBlock: string }
): Promise<{ narrative: MarketMapNarrative; costUSD: number }> {
  const prompt = buildUserPrompt(data, ctx.macroBlock);

  const res = await getOpenAI().messages.create({
    model: MODELS.lens,
    max_tokens: 1200,
    system: MAP_SYSTEM,
    tools: [MAP_TOOL],
    tool_choice: { type: "tool", name: MAP_TOOL.name },
    messages: [{ role: "user", content: prompt }],
  });

  const costUSD = estimateCallCostUSD(MODELS.lens, res.usage as Usage, 0);
  const raw = findToolUse<MapToolOutput>(res.content as never, MAP_TOOL.name);
  if (!raw) throw new Error(`map: model never called ${MAP_TOOL.name} (stop=${res.stop_reason})`);

  const watch = (raw.watch ?? [])
    .map((w) => clampLine(w, 200))
    .filter((w): w is string => w.length > 0)
    .slice(0, 3);

  const narrative: MarketMapNarrative = {
    headline: clampLine(raw.headline, 160),
    story: clampLine(raw.story, 600),
    leadersNote: clampLine(raw.leadersNote, 240),
    laggardsNote: clampLine(raw.laggardsNote, 240),
    watch,
  };

  if (costUSD > PER_MAP_BUDGET_USD) {
    console.warn(`[map] narrative cost $${costUSD.toFixed(4)} exceeded soft cap $${PER_MAP_BUDGET_USD}`);
  }
  console.log(
    `[map] narrative horizon=${data.horizon} leaders=${data.leaders.length} laggards=${data.laggards.length} ` +
      `watch=${watch.length} cost=$${costUSD.toFixed(4)}`
  );

  return { narrative, costUSD };
}

// ── Public: the full cached payload (deterministic map + optional narrative) ──

export async function generateMarketMap(): Promise<{ map: MarketMap; costUSD: number }> {
  // The deterministic table always ships — this is the part that always renders.
  const data = await computeMarketMap();

  // Macro context + narrative are best-effort. If the model call fails, the map
  // still ships with narrative=null (the engine output is what users came for).
  let narrative: MarketMapNarrative | null = null;
  let costUSD = 0;
  try {
    const macroBlock = await macroContext();
    const result = await generateMarketMapNarrative(data, { macroBlock });
    narrative = result.narrative;
    costUSD = result.costUSD;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[map] narrative failed, shipping deterministic map only: ${message}`);
    narrative = null;
  }

  const map: MarketMap = {
    data,
    narrative,
    generatedAt: new Date().toISOString(),
  };
  return { map, costUSD };
}
