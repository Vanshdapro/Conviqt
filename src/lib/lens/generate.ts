// The Lens generator — builds one user's daily brief.
//
// Pipeline (cheap by design, CLAUDE.md cost discipline — on-demand 1–5¢):
//   1. Price every holding via the marketdata layer (parallel). Compute the
//      day's move per holding AND for the whole book — DETERMINISTICALLY, from
//      the user's own shares × sourced prices. The model never sees a number it
//      didn't get from us, and never invents one.
//   2. Pull a few headlines for the biggest movers (Currents, free) + the
//      cached market-wide trends for macro context. Both optional — the brief
//      still works off price moves alone if news is unavailable.
//   3. ONE DeepSeek V4 Flash call (MODELS.lens, NO web_search) turns the data
//      into plain English: what happened, why (the mechanism — this teaches),
//      what it means for THIS book, per-holding notes, what to watch, and it
//      ages yesterday's flags + proposes new ones (the receipts thread).
//
// Plain English only, never "buy"/"sell", never jargon (CLAUDE.md copy rules).

import { getOpenAI, MODELS, estimateCallCostUSD } from "../openai";
import { quote } from "../marketdata";
import { fetchHeadlines, currentsConfigured } from "../news/currents";
import { readDashboard } from "../feed/store";
import type { PortfolioRecord } from "../portfolio/store";
import type { Holding } from "../portfolio/types";
import { briefDateUTC } from "./types";
import type {
  LensBrief,
  LensFlag,
  LensFlagStatus,
  LensHoldingMove,
  LensWatchItem,
} from "./types";

// Soft ceiling for one brief (CLAUDE.md: on-demand 1–5¢, cap 7¢). DeepSeek
// Flash makes this trivial (≈0.1¢); we log if a run ever drifts past it.
export const PER_BRIEF_BUDGET_USD = 0.03;

const NEWS_FOR_TOP_MOVERS = 3; // only fetch headlines for the 3 biggest movers
const MAX_FLAGS = 8; // cap the carried receipts thread

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

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// Last tool_use block matching `name` (mirrors feed/generate's helper).
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

// ── Step 1: deterministic per-holding + portfolio day moves ──────────────────

interface PricedHolding {
  holding: Holding;
  valueUSD: number; // shares × current price
  prevValueUSD: number; // shares × previous close
  dayChangeUSD: number; // valueUSD − prevValueUSD
  move: LensHoldingMove; // weight / contrib / note filled later
}

async function priceHoldings(
  holdings: Holding[]
): Promise<{ priced: PricedHolding[]; unpriced: string[]; freshness: string }> {
  const results = await Promise.all(holdings.map(async (h) => ({ h, q: await quote(h.ticker) })));

  const priced: PricedHolding[] = [];
  const unpriced: string[] = [];
  let freshness = "";

  for (const { h, q } of results) {
    if (!q || !Number.isFinite(q.price) || q.price <= 0) {
      unpriced.push(h.ticker);
      continue;
    }
    if (!freshness) freshness = q.freshnessLabel;
    // prevClose, robust: use the feed's prevClose; else back it out of changePct.
    const prevClose =
      q.prevClose && q.prevClose > 0
        ? q.prevClose
        : q.changePct != null
          ? q.price / (1 + q.changePct / 100)
          : q.price;
    const valueUSD = h.shares * q.price;
    const prevValueUSD = h.shares * prevClose;
    const dayChangeUSD = valueUSD - prevValueUSD;
    const changePct =
      q.changePct != null ? q.changePct : prevClose > 0 ? (q.price / prevClose - 1) * 100 : null;

    priced.push({
      holding: h,
      valueUSD,
      prevValueUSD,
      dayChangeUSD,
      move: {
        ticker: h.ticker,
        changePct: changePct != null ? round2(changePct) : null,
        dayChangeUSD: round2(dayChangeUSD),
        weightPct: null, // filled once we know the total
        contribPct: null,
        priced: true,
        note: "", // filled by the model
      },
    });
  }

  return { priced, unpriced, freshness };
}

// ── Step 2: news + macro context (both optional) ─────────────────────────────

async function newsForMovers(movers: PricedHolding[]): Promise<string> {
  if (!currentsConfigured() || movers.length === 0) return "";
  const top = movers.slice(0, NEWS_FOR_TOP_MOVERS);
  const blocks = await Promise.all(
    top.map(async ({ move }) => {
      try {
        const hl = await fetchHeadlines({ keywords: move.ticker, category: "finance", limit: 4 });
        if (hl.length === 0) return "";
        const lines = hl
          .slice(0, 3)
          .map((h) => `    - ${h.title} (${h.source})`)
          .join("\n");
        return `  ${move.ticker}:\n${lines}`;
      } catch {
        return "";
      }
    })
  );
  const body = blocks.filter(Boolean).join("\n");
  return body ? `Recent headlines for the biggest movers:\n${body}` : "";
}

async function macroContext(): Promise<string> {
  try {
    const dash = await readDashboard();
    const trends = (dash?.trends ?? []).map((t) => `  - ${t.text}`).filter(Boolean);
    return trends.length
      ? `What's shaping the market today (general context):\n${trends.join("\n")}`
      : "";
  } catch {
    return "";
  }
}

// ── Receipts: carry prior flags, age them, append new ones ───────────────────

function ageFlags(
  prior: LensFlag[],
  updates: Array<{ id?: unknown; status?: unknown; outcomeNote?: unknown }> | undefined,
  newFlags: Array<{ text?: unknown; ticker?: unknown }> | undefined,
  date: string
): LensFlag[] {
  const byId = new Map<string, LensFlag>(prior.map((f) => [f.id, { ...f }]));

  for (const u of updates ?? []) {
    const f = byId.get(String(u.id));
    const status = String(u.status);
    if (f && (["open", "played_out", "faded"] as string[]).includes(status)) {
      f.status = status as LensFlagStatus;
      const note = clampLine(u.outcomeNote, 150);
      if (note) f.outcomeNote = note;
    }
  }

  let i = 0;
  for (const nf of newFlags ?? []) {
    const text = clampLine(nf?.text, 180);
    if (!text) continue;
    const ticker =
      typeof nf?.ticker === "string" && nf.ticker.trim() ? nf.ticker.trim().toUpperCase() : undefined;
    const id = `${date}-${ticker ?? `n${i++}`}`;
    if (byId.has(id)) continue;
    byId.set(id, { id, date, text, ticker, status: "open" });
  }

  // Newest first; keep the thread bounded.
  return [...byId.values()].sort((a, b) => b.date.localeCompare(a.date)).slice(0, MAX_FLAGS);
}

// ── The model call ────────────────────────────────────────────────────────────

const BRIEF_TOOL = {
  name: "submit_brief",
  description:
    "Submit the finished daily brief. Call exactly once, using only the numbers provided.",
  input_schema: {
    type: "object" as const,
    properties: {
      whatHappened: {
        type: "string",
        description: "1-2 sentences: what happened to this person's money today. Plain English.",
      },
      why: {
        type: "string",
        description:
          "1-2 sentences explaining the MECHANISM — why the movers moved. Teach it simply; assume a beginner.",
      },
      whatItMeans: {
        type: "string",
        description:
          "1-2 sentences: what today means for THIS specific portfolio (concentration, what's driving it). Never tell them to buy or sell.",
      },
      sinceYesterday: {
        type: "string",
        description:
          "Optional. One line on what CHANGED versus yesterday's brief. Omit if no prior brief was given.",
      },
      holdingNotes: {
        type: "array",
        description: "One short note per holding you were given (match by ticker). Plain English, why it moved.",
        items: {
          type: "object",
          properties: {
            ticker: { type: "string" },
            note: { type: "string", description: "One line, under 140 chars. Never invent a number." },
          },
          required: ["ticker", "note"],
        },
      },
      watch: {
        type: "array",
        description: "3-5 things to watch next that matter to THIS portfolio (earnings, events, levels).",
        items: {
          type: "object",
          properties: {
            text: { type: "string", description: "What to watch + why it matters here. One line." },
            ticker: { type: "string", description: "Related ticker, if any." },
            when: { type: "string", description: "Soft timing, e.g. 'Wed' or 'next earnings'. Optional." },
          },
          required: ["text"],
        },
      },
      flagUpdates: {
        type: "array",
        description: "Age the PRIOR flags you were given, by id. Only include flags that meaningfully changed.",
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            status: { type: "string", enum: ["open", "played_out", "faded"] },
            outcomeNote: { type: "string", description: "One line: how it aged." },
          },
          required: ["id", "status"],
        },
      },
      newFlags: {
        type: "array",
        description: "Up to 2 NEW things worth tracking over coming days (a thesis or risk we should be held to).",
        items: {
          type: "object",
          properties: {
            text: { type: "string" },
            ticker: { type: "string" },
          },
          required: ["text"],
        },
      },
    },
    required: ["whatHappened", "why", "whatItMeans", "holdingNotes", "watch"],
  },
};

const BRIEF_SYSTEM = `You write a daily money brief for Conviqt, a research and education app for beginner investors. You are explaining what happened to ONE person's portfolio today.

Voice: plain English, warm, calm. No jargon, no finance-bro shorthand, no machinery talk. You describe what happened and why — you NEVER tell anyone to buy or sell.

Hard rules:
- Use ONLY the numbers given to you. Never invent or estimate a figure. If you don't have a number, talk about direction in words.
- "why" must teach the mechanism simply (e.g. "chip stocks fell together because a big customer warned demand is slowing").
- "whatItMeans" is about THIS portfolio's shape (what's driving it, how concentrated it is) — not generic advice.
- Honesty is the brand. If today was quiet, say it was quiet. Don't manufacture drama.
- Age the prior flags honestly: mark one "played_out" only if the thing you were watching for actually happened; "faded" if it stopped mattering; otherwise leave it.
Then call submit_brief exactly once.`;

function buildUserPrompt(args: {
  date: string;
  portfolioName: string;
  movePct: number | null;
  dayChangeUSD: number;
  pricedValueUSD: number;
  holdings: LensHoldingMove[];
  unpriced: string[];
  newsBlock: string;
  macroBlock: string;
  priorFlags: LensFlag[];
  priorHeadline?: string;
}): string {
  const table = args.holdings
    .map(
      (h) =>
        `  ${h.ticker}: ${h.changePct != null ? `${h.changePct >= 0 ? "+" : ""}${h.changePct}%` : "n/a"} today, ` +
        `$${h.dayChangeUSD != null ? h.dayChangeUSD.toFixed(2) : "n/a"} change, ` +
        `${h.weightPct != null ? h.weightPct.toFixed(1) : "?"}% of the book` +
        (h.contribPct != null ? `, drove ${h.contribPct.toFixed(0)}% of today's move` : "")
    )
    .join("\n");

  const parts: string[] = [
    `Today is ${args.date}.`,
    `Portfolio: "${args.portfolioName}".`,
    args.movePct != null
      ? `The whole portfolio moved ${args.movePct >= 0 ? "+" : ""}${args.movePct.toFixed(2)}% today (${args.dayChangeUSD >= 0 ? "+" : ""}$${args.dayChangeUSD.toFixed(2)}), on $${args.pricedValueUSD.toFixed(0)} of priced holdings.`
      : `We could not compute a portfolio-level move today.`,
    ``,
    `Holdings (numbers are final — use them, don't change them):`,
    table || "  (none priced)",
  ];
  if (args.unpriced.length)
    parts.push(``, `Could not price (mention honestly if relevant): ${args.unpriced.join(", ")}`);
  if (args.newsBlock) parts.push(``, args.newsBlock);
  if (args.macroBlock) parts.push(``, args.macroBlock);
  if (args.priorHeadline)
    parts.push(``, `Yesterday's brief said: "${args.priorHeadline}" (use for the sinceYesterday line).`);
  if (args.priorFlags.length) {
    const fl = args.priorFlags.map((f) => `  [${f.id}] (${f.status}) ${f.text}`).join("\n");
    parts.push(``, `Prior flags to age (by id):\n${fl}`);
  }
  parts.push(``, `Write the brief, then call submit_brief.`);
  return parts.join("\n");
}

// ── Public entry point ──────────────────────────────────────────────────────────

export interface GenerateLensResult {
  brief: LensBrief;
  costUSD: number;
}

interface BriefToolOutput {
  whatHappened?: unknown;
  why?: unknown;
  whatItMeans?: unknown;
  sinceYesterday?: unknown;
  holdingNotes?: Array<{ ticker?: unknown; note?: unknown }>;
  watch?: Array<{ text?: unknown; ticker?: unknown; when?: unknown }>;
  flagUpdates?: Array<{ id?: unknown; status?: unknown; outcomeNote?: unknown }>;
  newFlags?: Array<{ text?: unknown; ticker?: unknown }>;
}

export async function generateLensBrief(
  portfolio: PortfolioRecord,
  opts: { priorBrief?: LensBrief | null; date?: string } = {}
): Promise<GenerateLensResult> {
  const date = opts.date ?? briefDateUTC();
  const { priced, unpriced, freshness } = await priceHoldings(portfolio.holdings);

  // Deterministic totals — the only source of every number in the brief.
  const pricedValueUSD = priced.reduce((s, p) => s + p.valueUSD, 0);
  const prevValueUSD = priced.reduce((s, p) => s + p.prevValueUSD, 0);
  const dayChangeUSD = pricedValueUSD - prevValueUSD;
  const portfolioMovePct = prevValueUSD > 0 ? (dayChangeUSD / prevValueUSD) * 100 : null;

  // Fill weight + contribution now that totals exist.
  for (const p of priced) {
    p.move.weightPct = pricedValueUSD > 0 ? round2((p.valueUSD / pricedValueUSD) * 100) : null;
    p.move.contribPct = dayChangeUSD !== 0 ? round2((p.dayChangeUSD / dayChangeUSD) * 100) : null;
  }

  // Biggest movers first (by absolute dollar impact).
  const sorted = [...priced].sort((a, b) => Math.abs(b.dayChangeUSD) - Math.abs(a.dayChangeUSD));
  const pricedMoves = sorted.map((p) => p.move);
  const unpricedMoves: LensHoldingMove[] = unpriced.map((t) => ({
    ticker: t,
    changePct: null,
    dayChangeUSD: null,
    weightPct: null,
    contribPct: null,
    priced: false,
    note: "",
  }));

  // Nothing priced → honest, model-free brief (saves the call).
  if (priced.length === 0) {
    const brief: LensBrief = {
      date,
      portfolioId: portfolio.id,
      portfolioName: portfolio.name,
      portfolioMovePct: null,
      dayChangeUSD: null,
      pricedValueUSD: null,
      whatHappened: "We couldn't pull live prices for your holdings right now.",
      why: "The market data we rely on was unavailable for these tickers this run — not a problem with your portfolio.",
      whatItMeans: "Check back shortly; today's read will fill in once prices come through.",
      holdings: unpricedMoves,
      watch: [],
      flagged: opts.priorBrief?.flagged ?? [],
      unpriced,
      dataFreshness: "data unavailable",
      generatedAt: new Date().toISOString(),
      estCostUSD: 0,
    };
    console.warn(`[lens] brief ${portfolio.id} ${date}: no holdings could be priced (${unpriced.length} unpriced)`);
    return { brief, costUSD: 0 };
  }

  const priorFlags = opts.priorBrief?.flagged ?? [];
  const [newsBlock, macroBlock] = await Promise.all([newsForMovers(sorted), macroContext()]);

  const prompt = buildUserPrompt({
    date,
    portfolioName: portfolio.name,
    movePct: portfolioMovePct,
    dayChangeUSD,
    pricedValueUSD,
    holdings: pricedMoves,
    unpriced,
    newsBlock,
    macroBlock,
    priorFlags,
    priorHeadline: opts.priorBrief?.whatHappened,
  });

  const res = await getOpenAI().messages.create({
    model: MODELS.lens,
    max_tokens: 1500,
    system: BRIEF_SYSTEM,
    tools: [BRIEF_TOOL],
    tool_choice: { type: "tool", name: BRIEF_TOOL.name },
    messages: [{ role: "user", content: prompt }],
  });

  const costUSD = estimateCallCostUSD(MODELS.lens, res.usage as Usage, 0);
  const raw = findToolUse<BriefToolOutput>(res.content as never, BRIEF_TOOL.name);
  if (!raw) {
    throw new Error(`lens: model never called ${BRIEF_TOOL.name} (stop=${res.stop_reason})`);
  }

  // Merge per-holding notes (matched by ticker) onto the deterministic moves.
  const noteByTicker = new Map<string, string>();
  for (const n of raw.holdingNotes ?? []) {
    const ticker = typeof n?.ticker === "string" ? n.ticker.trim().toUpperCase() : "";
    const note = clampLine(n?.note, 150);
    if (ticker && note) noteByTicker.set(ticker, note);
  }
  for (const m of pricedMoves) m.note = noteByTicker.get(m.ticker) ?? "";

  const watch: LensWatchItem[] = (raw.watch ?? [])
    .map((w) => {
      const text = clampLine(w?.text, 180);
      if (!text) return null;
      const ticker = typeof w?.ticker === "string" && w.ticker.trim() ? w.ticker.trim().toUpperCase() : undefined;
      const when = clampLine(w?.when, 40) || undefined;
      return { text, ticker, when } as LensWatchItem;
    })
    .filter((w): w is LensWatchItem => w !== null)
    .slice(0, 5);

  const flagged = ageFlags(priorFlags, raw.flagUpdates, raw.newFlags, date);

  const brief: LensBrief = {
    date,
    portfolioId: portfolio.id,
    portfolioName: portfolio.name,
    portfolioMovePct: portfolioMovePct != null ? round2(portfolioMovePct) : null,
    dayChangeUSD: round2(dayChangeUSD),
    pricedValueUSD: round2(pricedValueUSD),
    whatHappened: clampLine(raw.whatHappened, 400),
    why: clampLine(raw.why, 400),
    whatItMeans: clampLine(raw.whatItMeans, 400),
    sinceYesterday: opts.priorBrief ? clampLine(raw.sinceYesterday, 300) || undefined : undefined,
    holdings: [...pricedMoves, ...unpricedMoves],
    watch,
    flagged,
    unpriced,
    dataFreshness: freshness || "delayed",
    generatedAt: new Date().toISOString(),
    estCostUSD: costUSD,
  };

  if (costUSD > PER_BRIEF_BUDGET_USD) {
    console.warn(`[lens] brief cost $${costUSD.toFixed(4)} exceeded soft cap $${PER_BRIEF_BUDGET_USD}`);
  }
  console.log(
    `[lens] brief ${portfolio.id} ${date}: move=${brief.portfolioMovePct ?? "n/a"}% ` +
      `cost=$${costUSD.toFixed(4)} priced=${priced.length} unpriced=${unpriced.length}`
  );

  return { brief, costUSD };
}
