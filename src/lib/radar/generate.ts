// The Radar generator — turns upcoming events into plain-English ORIENTATION.
//
// Two flavours, ONE engine: the market-wide Radar (shared, FREE) and the
// personalized Radar (the user's holdings, PRO). Both take a list of upcoming
// events (from events.ts), cap to the soonest few, and make exactly ONE cheap
// model call (MODELS.lens = DeepSeek V4 Flash, NO web_search) that, per event,
// writes "what's at stake" + 2-3 "what each outcome would mean" framings.
//
// Honesty guardrail (CLAUDE.md, load-bearing): the Radar is ORIENTATION, never
// alpha. It says "NVDA reports Tuesday; here's what's at stake and what each
// outcome would mean" — it NEVER predicts a beat/miss, never says buy/sell.
// `outcomes` are conditional framings ("If it runs hot → …"), not forecasts.
// Plain English for a 19-year-old with $500; no jargon, no machinery talk.
//
// Cost: one MODELS.lens call over a handful of events is well under a cent.
// We never call the model when there are zero events (empty radar, $0).

import { getOpenAI, MODELS, estimateCallCostUSD } from "../openai";
import { gatherUpcomingEvents } from "./events";
import {
  RADAR_HORIZON_DAYS,
  RADAR_MAX_ITEMS,
  kindLabel,
  whenLabel,
} from "./types";
import type {
  MarketRadar,
  PersonalRadar,
  RadarItem,
  RadarOutcome,
  UpcomingEvent,
} from "./types";

/** Soft cost cap per Radar build. One DeepSeek Flash call over ≤8 events lands
 *  far below this; the warning only fires if something runs away. */
export const PER_RADAR_BUDGET_USD = 0.03;

// At most this many outcome framings per event — keeps each card scannable.
const MAX_OUTCOMES = 3;

type Usage = {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
};

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

// Soonest first; ids break ties so a refresh orders identically.
function soonestFirst(a: UpcomingEvent, b: UpcomingEvent): number {
  return a.daysAway - b.daysAway || a.id.localeCompare(b.id);
}

// Neutral, honest fallback when the model skips an event — we keep the event on
// the radar rather than dropping it, with stakes phrased as orientation only.
function neutralStakes(ev: UpcomingEvent): string {
  return `A scheduled ${kindLabel(ev.kind).toLowerCase()} event — worth knowing it's on the calendar.`;
}

// ── The model call (one tool, shared by both flavours) ───────────────────────

const RADAR_TOOL = {
  name: "submit_radar",
  description:
    "Submit the finished orientation for each upcoming event. Call exactly once. " +
    "For every event id you were given, return what's at stake and 2-3 outcome framings.",
  input_schema: {
    type: "object" as const,
    properties: {
      items: {
        type: "array",
        description:
          "One entry per event id provided (match by id). Cover every event; skip none.",
        items: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description: "The exact event id you were given.",
            },
            stakes: {
              type: "string",
              description:
                "One or two plain-English lines: what's at stake / why this date matters. " +
                "Orientation, NOT a prediction — never say it will beat, miss, rise or fall.",
            },
            outcomes: {
              type: "array",
              description:
                "2-3 conditional framings of what DIFFERENT outcomes would mean. " +
                "Each is an 'If X happens → here's what that would mean' branch, never a forecast and never buy/sell.",
              items: {
                type: "object",
                properties: {
                  label: {
                    type: "string",
                    description:
                      "The condition, e.g. 'If it runs hot', 'A clear beat', 'A surprise cut'. A few words.",
                  },
                  meaning: {
                    type: "string",
                    description:
                      "What that outcome would mean — honest orientation in plain English. Never 'buy'/'sell'.",
                  },
                },
                required: ["label", "meaning"],
              },
            },
          },
          required: ["id", "stakes", "outcomes"],
        },
      },
    },
    required: ["items"],
  },
};

const RADAR_SYSTEM = `You write a calm, plain-English "what's coming" radar for Conviqt, a research and education app for beginner investors (think a 19-year-old with $500).

Your ONLY job is ORIENTATION: for each upcoming event, explain what's at stake and what DIFFERENT outcomes would mean. You are a heads-up, never a tip sheet.

Hard rules (these are the brand — breaking them is the worst thing you can do):
- NEVER predict. Don't say a company will beat or miss, that a number will come in hot or cold, or that a price will rise or fall. You don't know, and pretending to is dishonest.
- "stakes" frames why the date matters — the question being answered, not the answer.
- "outcomes" are CONDITIONAL framings: "If it runs hot → here's what that would mean", "If the Fed holds → …". Each branch describes the meaning of that path, it is NOT a forecast of which path happens.
- NEVER tell anyone to buy or sell, or imply it. No "load up", no "take profits", no imperative trade language.
- Plain English only. No jargon, no finance-bro shorthand, no machinery talk. Explain like you're talking to a smart beginner.
- Be honest and proportionate. If an event is routine, say it plainly — don't manufacture drama.
Cover EVERY event id you're given. Then call submit_radar exactly once.`;

// One prompt builder; the only difference is market-wide vs "your holdings".
function buildPrompt(events: UpcomingEvent[], framing: "market" | "personal"): string {
  const lens =
    framing === "personal"
      ? `These events touch the stocks in ONE person's portfolio. Frame "stakes" and "outcomes" around what each could mean for THEIR money — the holdings they actually own.`
      : `These are market-wide events that can move the whole market. Frame "stakes" and "outcomes" for a general beginner investor watching the market.`;

  const lines = events
    .map((ev) => {
      const when = whenLabel(ev.daysAway, ev.date);
      const who = ev.ticker ? ` [${ev.ticker}${ev.company ? ` — ${ev.company}` : ""}]` : "";
      return `  - id=${ev.id} | ${kindLabel(ev.kind)} | ${when} (${ev.date})${who}: ${ev.title}`;
    })
    .join("\n");

  return [
    lens,
    ``,
    `Upcoming events (soonest first):`,
    lines,
    ``,
    `For each id above, write what's at stake + 2-3 outcome framings, then call submit_radar.`,
  ].join("\n");
}

interface RadarToolOutput {
  items?: Array<{
    id?: unknown;
    stakes?: unknown;
    outcomes?: Array<{ label?: unknown; meaning?: unknown }>;
  }>;
}

// Run the single model call and merge its enrichment back onto the events.
// Every event survives: a skipped one falls back to a neutral stakes line +
// empty outcomes, never dropped. Returns the assembled items and the call cost.
async function enrichEvents(
  events: UpcomingEvent[],
  framing: "market" | "personal"
): Promise<{ items: RadarItem[]; costUSD: number }> {
  const prompt = buildPrompt(events, framing);

  const res = await getOpenAI().messages.create({
    model: MODELS.lens,
    max_tokens: 3000,
    system: RADAR_SYSTEM,
    tools: [RADAR_TOOL],
    tool_choice: { type: "tool", name: RADAR_TOOL.name },
    messages: [{ role: "user", content: prompt }],
  });

  const costUSD = estimateCallCostUSD(MODELS.lens, res.usage as Usage, 0);
  const raw = findToolUse<RadarToolOutput>(res.content as never, RADAR_TOOL.name);
  if (!raw) {
    throw new Error(`radar: model never called ${RADAR_TOOL.name} (stop=${res.stop_reason})`);
  }

  // Index AI output by event id so order/coverage is driven by `events`.
  const byId = new Map<string, { stakes: string; outcomes: RadarOutcome[] }>();
  for (const it of raw.items ?? []) {
    const id = typeof it?.id === "string" ? it.id.trim() : "";
    if (!id) continue;
    const stakes = clampLine(it?.stakes, 220);
    const outcomes: RadarOutcome[] = (it?.outcomes ?? [])
      .map((o) => {
        const label = clampLine(o?.label, 60);
        const meaning = clampLine(o?.meaning, 220);
        return label && meaning ? { label, meaning } : null;
      })
      .filter((o): o is RadarOutcome => o !== null)
      .slice(0, MAX_OUTCOMES);
    byId.set(id, { stakes, outcomes });
  }

  const items: RadarItem[] = events.map((ev) => {
    const hit = byId.get(ev.id);
    return {
      ...ev,
      stakes: hit?.stakes || neutralStakes(ev),
      outcomes: hit?.outcomes ?? [],
    };
  });

  return { items, costUSD };
}

// ── Market-wide radar (FREE, shared) ─────────────────────────────────────────

export async function generateMarketRadar(): Promise<{ radar: MarketRadar; costUSD: number }> {
  const events = (await gatherUpcomingEvents()).sort(soonestFirst).slice(0, RADAR_MAX_ITEMS);

  if (events.length === 0) {
    const radar: MarketRadar = {
      items: [],
      horizonDays: RADAR_HORIZON_DAYS,
      generatedAt: new Date().toISOString(),
      freshnessLabel: "no scheduled market-movers in the look-ahead window",
    };
    console.log("[radar] market: no upcoming events — empty radar, no model call");
    return { radar, costUSD: 0 };
  }

  const { items, costUSD } = await enrichEvents(events, "market");

  const radar: MarketRadar = {
    items,
    horizonDays: RADAR_HORIZON_DAYS,
    generatedAt: new Date().toISOString(),
    freshnessLabel: "upcoming earnings & economic dates",
  };

  if (costUSD > PER_RADAR_BUDGET_USD) {
    console.warn(`[radar] market cost $${costUSD.toFixed(4)} exceeded soft cap $${PER_RADAR_BUDGET_USD}`);
  }
  console.log(`[radar] market: ${items.length} events cost=$${costUSD.toFixed(4)}`);

  return { radar, costUSD };
}

// ── Personalized radar (PRO, per portfolio) ──────────────────────────────────

export async function generatePersonalRadar(args: {
  portfolioId: string;
  portfolioName: string;
  tickers: string[];
}): Promise<{ radar: PersonalRadar; costUSD: number }> {
  const tickers = args.tickers.map((t) => t.trim().toUpperCase()).filter(Boolean);

  // Empty book → nothing to look ahead for. Skip the model entirely.
  if (tickers.length === 0) {
    const radar: PersonalRadar = {
      portfolioId: args.portfolioId,
      portfolioName: args.portfolioName,
      items: [],
      matchedTickers: [],
      generatedAt: new Date().toISOString(),
      estCostUSD: 0,
    };
    console.log(`[radar] personal ${args.portfolioId}: empty holdings — empty radar, no model call`);
    return { radar, costUSD: 0 };
  }

  const events = (await gatherUpcomingEvents({ tickers }))
    .sort(soonestFirst)
    .slice(0, RADAR_MAX_ITEMS);

  if (events.length === 0) {
    const radar: PersonalRadar = {
      portfolioId: args.portfolioId,
      portfolioName: args.portfolioName,
      items: [],
      matchedTickers: [],
      generatedAt: new Date().toISOString(),
      estCostUSD: 0,
    };
    console.log(`[radar] personal ${args.portfolioId}: no upcoming events — empty radar, no model call`);
    return { radar, costUSD: 0 };
  }

  const { items, costUSD } = await enrichEvents(events, "personal");

  // The user's tickers we actually found upcoming events for (deduped, ordered).
  const held = new Set(tickers);
  const matchedTickers = [
    ...new Set(
      items
        .map((it) => it.ticker?.toUpperCase())
        .filter((t): t is string => !!t && held.has(t))
    ),
  ];

  const radar: PersonalRadar = {
    portfolioId: args.portfolioId,
    portfolioName: args.portfolioName,
    items,
    matchedTickers,
    generatedAt: new Date().toISOString(),
    estCostUSD: costUSD,
  };

  if (costUSD > PER_RADAR_BUDGET_USD) {
    console.warn(
      `[radar] personal ${args.portfolioId} cost $${costUSD.toFixed(4)} exceeded soft cap $${PER_RADAR_BUDGET_USD}`
    );
  }
  console.log(
    `[radar] personal ${args.portfolioId}: ${items.length} events matched=${matchedTickers.length} cost=$${costUSD.toFixed(4)}`
  );

  return { radar, costUSD };
}
