// The Lens generator — builds one user's MEDIUM-TERM portfolio read.
//
// A daily ±$30 wiggle is noise nobody pays for. So the brief is framed around
// the medium term: where each holding sits over the past week / month / quarter,
// what's driving it, and what it means for the book. Today's move is a demoted
// footnote, never the headline.
//
// Pipeline (cheap by design, CLAUDE.md cost discipline — on-demand 1–5¢):
//   1. Per holding: live quote + ~6mo price history. Compute, DETERMINISTICALLY,
//      the 1-week / 1-month / 3-month returns (per holding AND value-weighted for
//      the whole book). The model never invents or changes a number.
//   2. Headlines for the biggest movers (Currents, free) + cached market-wide
//      macro context. Both optional.
//   3. ONE DeepSeek V4 Flash call (MODELS.lens, NO web_search) → the trend, why
//      it's moving over weeks, what it means for THIS book, a per-stock read,
//      what to watch, and it ages yesterday's flags + proposes new ones.
//
// Plain English only, never "buy"/"sell", never jargon (CLAUDE.md copy rules).

import { getOpenAI, MODELS, estimateCallCostUSD } from "../openai";
import { quote, history } from "../marketdata";
import type { Candle } from "../marketdata";
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

export const PER_BRIEF_BUDGET_USD = 0.03;

const NEWS_FOR_TOP_MOVERS = 3;
const MAX_FLAGS = 8;

// Approximate trading sessions per horizon.
const SESSIONS_1W = 5;
const SESSIONS_1M = 21;
const SESSIONS_3M = 63;

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

// Close `n` sessions before the latest candle (clamped). null if no history.
function closeNAgo(candles: Candle[] | undefined, n: number): number | null {
  if (!candles || candles.length < 2) return null;
  const idx = Math.max(0, candles.length - 1 - n);
  const c = candles[idx]?.close;
  return c && c > 0 ? c : null;
}
function pctFrom(price: number, past: number | null): number | null {
  return past && past > 0 ? round2((price / past - 1) * 100) : null;
}
function fmtPct(n: number | null): string {
  return n == null ? "n/a" : `${n >= 0 ? "+" : ""}${n}%`;
}

// ── Step 1: deterministic per-holding day + medium-term moves ────────────────

interface PricedHolding {
  holding: Holding;
  valueUSD: number; // shares × current price
  prevValueUSD: number; // shares × previous close (today move)
  dayChangeUSD: number;
  value1wAgo: number | null; // shares × close ~1w ago (portfolio medium-term math)
  value1mAgo: number | null;
  absRet1m: number; // |1-month %| for ranking news/movers (0 if unknown)
  move: LensHoldingMove;
}

async function gatherHoldings(
  holdings: Holding[]
): Promise<{ priced: PricedHolding[]; unpriced: string[]; freshness: string }> {
  const results = await Promise.all(
    holdings.map(async (h) => ({
      h,
      q: await quote(h.ticker),
      hist: await history(h.ticker, "6mo").catch(() => null),
    }))
  );

  const priced: PricedHolding[] = [];
  const unpriced: string[] = [];
  let freshness = "";

  for (const { h, q, hist } of results) {
    if (!q || !Number.isFinite(q.price) || q.price <= 0) {
      unpriced.push(h.ticker);
      continue;
    }
    if (!freshness) freshness = q.freshnessLabel;

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
      q.changePct != null ? round2(q.changePct) : prevClose > 0 ? round2((q.price / prevClose - 1) * 100) : null;

    const candles = hist?.candles;
    const c1w = closeNAgo(candles, SESSIONS_1W);
    const c1m = closeNAgo(candles, SESSIONS_1M);
    const c3m = closeNAgo(candles, SESSIONS_3M);
    const ret1wPct = pctFrom(q.price, c1w);
    const ret1mPct = pctFrom(q.price, c1m);
    const ret3mPct = pctFrom(q.price, c3m);

    priced.push({
      holding: h,
      valueUSD,
      prevValueUSD,
      dayChangeUSD,
      value1wAgo: c1w != null ? h.shares * c1w : null,
      value1mAgo: c1m != null ? h.shares * c1m : null,
      absRet1m: ret1mPct != null ? Math.abs(ret1mPct) : 0,
      move: {
        ticker: h.ticker,
        changePct,
        dayChangeUSD: round2(dayChangeUSD),
        ret1wPct,
        ret1mPct,
        ret3mPct,
        weightPct: null, // filled once we know the total
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
        const lines = hl.slice(0, 3).map((h) => `    - ${h.title} (${h.source})`).join("\n");
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
    return trends.length ? `What's shaping the market lately (general context):\n${trends.join("\n")}` : "";
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
  return [...byId.values()].sort((a, b) => b.date.localeCompare(a.date)).slice(0, MAX_FLAGS);
}

// ── The model call ────────────────────────────────────────────────────────────

const BRIEF_TOOL = {
  name: "submit_brief",
  description: "Submit the finished medium-term brief. Call exactly once, using only the numbers provided.",
  input_schema: {
    type: "object" as const,
    properties: {
      trend: {
        type: "string",
        description:
          "1-2 sentences: the medium-term trajectory of this portfolio (lead with the past month, add past-week context). NOT today's move.",
      },
      why: {
        type: "string",
        description:
          "1-2 sentences on what is driving the book over recent WEEKS — the mechanism, taught simply for a beginner.",
      },
      whatItMeans: {
        type: "string",
        description:
          "1-2 sentences: what this medium-term picture means for THIS portfolio (concentration, what's leading vs lagging). Never buy/sell.",
      },
      sinceLast: {
        type: "string",
        description: "Optional. One line on what CHANGED versus the last brief. Omit if no prior brief was given.",
      },
      holdingNotes: {
        type: "array",
        description:
          "One read PER holding (match by ticker): its multi-week story — is it leading or lagging, what's driving it, where it stands. Plain English, no invented numbers.",
        items: {
          type: "object",
          properties: {
            ticker: { type: "string" },
            note: { type: "string", description: "1-2 sentences, the stock's medium-term read." },
          },
          required: ["ticker", "note"],
        },
      },
      watch: {
        type: "array",
        description: "3-5 things to watch over the coming weeks that matter to THIS portfolio.",
        items: {
          type: "object",
          properties: {
            text: { type: "string", description: "What to watch + why it matters here. One line." },
            ticker: { type: "string" },
            when: { type: "string", description: "Soft timing, e.g. 'next earnings'. Optional." },
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
            outcomeNote: { type: "string" },
          },
          required: ["id", "status"],
        },
      },
      newFlags: {
        type: "array",
        description: "Up to 2 NEW things worth tracking over the coming weeks (a thesis or risk to be held to).",
        items: {
          type: "object",
          properties: { text: { type: "string" }, ticker: { type: "string" } },
          required: ["text"],
        },
      },
    },
    required: ["trend", "why", "whatItMeans", "holdingNotes", "watch"],
  },
};

const BRIEF_SYSTEM = `You write a medium-term money brief for Conviqt, a research and education app for beginner investors. You explain where ONE person's portfolio stands over the past WEEKS and MONTHS — not today's wiggle.

Voice: plain English, warm, calm. No jargon, no finance-bro shorthand, no machinery talk. Describe what's happening and why — you NEVER tell anyone to buy or sell.

Hard rules:
- The horizon is medium term (weeks to a few months). Treat a single day's move as background noise; the story is the trend.
- Use ONLY the numbers given. Never invent or estimate a figure. Where you lack a number, talk in words.
- Give a real read on EACH holding — is it leading or lagging the book, what's driving it, where it stands.
- "whatItMeans" is about THIS portfolio's shape (what's leading, how concentrated) — not generic advice.
- Honesty is the brand. If the trend is flat, say so. Don't manufacture drama.
- Age prior flags honestly: "played_out" only if the watched-for thing happened; "faded" if it stopped mattering.
Then call submit_brief exactly once.`;

function buildUserPrompt(args: {
  date: string;
  portfolioName: string;
  move1wPct: number | null;
  move1mPct: number | null;
  todayPct: number | null;
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
        `  ${h.ticker} [${h.weightPct != null ? h.weightPct.toFixed(1) : "?"}% of book]: ` +
        `1wk ${fmtPct(h.ret1wPct)}, 1mo ${fmtPct(h.ret1mPct)}, 3mo ${fmtPct(h.ret3mPct)} (today ${fmtPct(h.changePct)})`
    )
    .join("\n");

  const parts: string[] = [
    `Today is ${args.date}. Portfolio: "${args.portfolioName}", $${args.pricedValueUSD.toFixed(0)} priced.`,
    `Whole-book moves: past week ${fmtPct(args.move1wPct)}, past month ${fmtPct(args.move1mPct)} (today ${fmtPct(args.todayPct)} — noise, don't lead with it).`,
    ``,
    `Holdings, medium-term returns (numbers are final — use them, don't change them):`,
    table || "  (none priced)",
  ];
  if (args.unpriced.length) parts.push(``, `Could not price: ${args.unpriced.join(", ")}`);
  if (args.newsBlock) parts.push(``, args.newsBlock);
  if (args.macroBlock) parts.push(``, args.macroBlock);
  if (args.priorHeadline) parts.push(``, `Last brief's trend line: "${args.priorHeadline}" (use for sinceLast).`);
  if (args.priorFlags.length) {
    parts.push(``, `Prior flags to age (by id):\n${args.priorFlags.map((f) => `  [${f.id}] (${f.status}) ${f.text}`).join("\n")}`);
  }
  parts.push(``, `Write the medium-term brief, then call submit_brief.`);
  return parts.join("\n");
}

// ── Public entry point ──────────────────────────────────────────────────────────

export interface GenerateLensResult {
  brief: LensBrief;
  costUSD: number;
}

interface BriefToolOutput {
  trend?: unknown;
  why?: unknown;
  whatItMeans?: unknown;
  sinceLast?: unknown;
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
  const { priced, unpriced, freshness } = await gatherHoldings(portfolio.holdings);

  // Deterministic totals — today + medium-term, value-weighted.
  const pricedValueUSD = priced.reduce((s, p) => s + p.valueUSD, 0);
  const prevValueUSD = priced.reduce((s, p) => s + p.prevValueUSD, 0);
  const dayChangeUSD = pricedValueUSD - prevValueUSD;
  const todayPct = prevValueUSD > 0 ? round2((dayChangeUSD / prevValueUSD) * 100) : null;

  const with1w = priced.filter((p) => p.value1wAgo != null);
  const sum1wNow = with1w.reduce((s, p) => s + p.valueUSD, 0);
  const sum1wAgo = with1w.reduce((s, p) => s + (p.value1wAgo as number), 0);
  const move1wPct = sum1wAgo > 0 ? round2((sum1wNow / sum1wAgo - 1) * 100) : null;

  const with1m = priced.filter((p) => p.value1mAgo != null);
  const sum1mNow = with1m.reduce((s, p) => s + p.valueUSD, 0);
  const sum1mAgo = with1m.reduce((s, p) => s + (p.value1mAgo as number), 0);
  const move1mPct = sum1mAgo > 0 ? round2((sum1mNow / sum1mAgo - 1) * 100) : null;

  for (const p of priced) {
    p.move.weightPct = pricedValueUSD > 0 ? round2((p.valueUSD / pricedValueUSD) * 100) : null;
  }

  // Rank for the holdings table + news by medium-term movement, then weight.
  const sorted = [...priced].sort((a, b) => b.absRet1m - a.absRet1m || b.valueUSD - a.valueUSD);
  const pricedMoves = sorted.map((p) => p.move);
  const unpricedMoves: LensHoldingMove[] = unpriced.map((t) => ({
    ticker: t,
    changePct: null,
    dayChangeUSD: null,
    ret1wPct: null,
    ret1mPct: null,
    ret3mPct: null,
    weightPct: null,
    priced: false,
    note: "",
  }));

  if (priced.length === 0) {
    const brief: LensBrief = {
      date,
      portfolioId: portfolio.id,
      portfolioName: portfolio.name,
      move1wPct: null,
      move1mPct: null,
      portfolioMovePct: null,
      dayChangeUSD: null,
      pricedValueUSD: null,
      whatHappened: "We couldn't pull live prices for your holdings right now.",
      why: "The market data we rely on was unavailable for these tickers this run — not a problem with your portfolio.",
      whatItMeans: "Check back shortly; the read will fill in once prices come through.",
      holdings: unpricedMoves,
      watch: [],
      flagged: opts.priorBrief?.flagged ?? [],
      unpriced,
      dataFreshness: "data unavailable",
      generatedAt: new Date().toISOString(),
      estCostUSD: 0,
    };
    console.warn(`[lens] brief ${portfolio.id} ${date}: no holdings priced (${unpriced.length})`);
    return { brief, costUSD: 0 };
  }

  const priorFlags = opts.priorBrief?.flagged ?? [];
  const [newsBlock, macroBlock] = await Promise.all([newsForMovers(sorted), macroContext()]);

  const prompt = buildUserPrompt({
    date,
    portfolioName: portfolio.name,
    move1wPct,
    move1mPct,
    todayPct,
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
    max_tokens: 1800,
    system: BRIEF_SYSTEM,
    tools: [BRIEF_TOOL],
    tool_choice: { type: "tool", name: BRIEF_TOOL.name },
    messages: [{ role: "user", content: prompt }],
  });

  const costUSD = estimateCallCostUSD(MODELS.lens, res.usage as Usage, 0);
  const raw = findToolUse<BriefToolOutput>(res.content as never, BRIEF_TOOL.name);
  if (!raw) throw new Error(`lens: model never called ${BRIEF_TOOL.name} (stop=${res.stop_reason})`);

  const noteByTicker = new Map<string, string>();
  for (const n of raw.holdingNotes ?? []) {
    const ticker = typeof n?.ticker === "string" ? n.ticker.trim().toUpperCase() : "";
    const note = clampLine(n?.note, 220);
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
    move1wPct,
    move1mPct,
    portfolioMovePct: todayPct,
    dayChangeUSD: round2(dayChangeUSD),
    pricedValueUSD: round2(pricedValueUSD),
    whatHappened: clampLine(raw.trend, 400),
    why: clampLine(raw.why, 400),
    whatItMeans: clampLine(raw.whatItMeans, 400),
    sinceYesterday: opts.priorBrief ? clampLine(raw.sinceLast, 300) || undefined : undefined,
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
    `[lens] brief ${portfolio.id} ${date}: 1m=${move1mPct ?? "n/a"}% 1w=${move1wPct ?? "n/a"}% ` +
      `cost=$${costUSD.toFixed(4)} priced=${priced.length} unpriced=${unpriced.length}`
  );

  return { brief, costUSD };
}
