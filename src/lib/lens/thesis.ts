// The Lens — DEEP mode. The institutional-grade, on-demand thesis.
//
// Where the daily brief is a cheap glance, this goes deep and multi-source:
//   • Per holding it pulls live QUOTE + KEY STATS + 6mo PRICE HISTORY, and
//     computes momentum (1mo / full-window returns) and a valuation read
//     (P/E + position in the 52-week range) — all DETERMINISTIC, from sourced
//     numbers. The model never invents a figure.
//   • It pulls recent NEWS for the biggest positions and the cached market-wide
//     MACRO trends for context.
//   • It then asks DeepSeek V4 Pro (MODELS.lensPro) — a reasoning model, with
//     its chain-of-thought EXPOSED — for a structured thesis: what's really
//     driving the book, the bull/bear forces, and the single crux that matters.
//   • Every source we touched is returned as a `LensSource` — the depth receipts
//     ("conviction you can check").
//
// EXPENSIVE relative to the daily brief, so this is on-demand + Pro-gated +
// rate-limited — never auto-run per user per day. Plain English, no buy/sell.

import { getOpenAI, MODELS, estimateCallCostUSD } from "../openai";
import { quote, history, keyStats } from "../marketdata";
import type { Candle } from "../marketdata";
import { fetchHeadlines, currentsConfigured } from "../news/currents";
import { readDashboard } from "../feed/store";
import type { PortfolioRecord } from "../portfolio/store";
import type { Holding } from "../portfolio/types";
import { briefDateUTC } from "./types";
import type { Conviction, LensSource, LensThesis, LensThesisHolding } from "./types";

// Deep run soft cap. DeepSeek V4 Pro + reasoning over many sources lands ≈3–8¢;
// well above the daily brief but fine for an on-demand, Pro-gated, rate-limited
// action. We log if a run drifts past this.
export const PER_THESIS_BUDGET_USD = 0.12;

const NEWS_FOR_TOP = 4; // pull headlines for the 4 biggest positions
const SESSIONS_1MO = 21;

type Usage = {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
};

function clampLine(s: unknown, max = 280): string {
  if (typeof s !== "string") return "";
  const t = s.trim().replace(/\s+/g, " ");
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

function pctOverSessions(candles: Candle[], n: number): number | null {
  if (candles.length < 2) return null;
  const last = candles[candles.length - 1].close;
  const idx = Math.max(0, candles.length - 1 - n);
  const past = candles[idx].close;
  if (!(past > 0)) return null;
  return (last / past - 1) * 100;
}

function fmtPct(n: number | null): string {
  if (n == null) return "n/a";
  return `${n >= 0 ? "+" : ""}${Math.round(n * 10) / 10}%`;
}

// Tolerant JSON extraction — reasoning models sometimes wrap the object in prose
// or a ```json fence. Pull the first {...} block and parse it.
function extractJson(text: string | undefined): unknown | null {
  if (!text) return null;
  let t = text.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(t.slice(start, end + 1));
  } catch {
    return null;
  }
}

// ── Per-holding multi-source gather ──────────────────────────────────────────

interface HoldingDeep {
  holding: Holding;
  valueUSD: number;
  momentum?: string;
  valuation?: string;
  facts: string; // compact line fed to the model
  sources: LensSource[];
}

async function gatherHolding(h: Holding): Promise<HoldingDeep | null> {
  const [q, ks, hist] = await Promise.all([
    quote(h.ticker),
    keyStats(h.ticker),
    history(h.ticker, "6mo"),
  ]);
  if (!q || !(q.price > 0)) return null; // can't anchor a thesis without a price

  const valueUSD = h.shares * q.price;
  const sources: LensSource[] = [
    {
      kind: "price",
      label: `${h.ticker} price — ${q.provider} (${q.freshnessLabel})`,
      detail: `$${q.price} (${fmtPct(q.changePct)} today)`,
      url: q.sourceUrl,
    },
  ];

  // Momentum from history.
  let momentum: string | undefined;
  if (hist && hist.candles.length > 2) {
    const m1 = pctOverSessions(hist.candles, SESSIONS_1MO);
    const mFull = pctOverSessions(hist.candles, hist.candles.length - 1);
    momentum = `${fmtPct(m1)} past month, ${fmtPct(mFull)} over ~6 months`;
    sources.push({
      kind: "history",
      label: `${h.ticker} 6mo history — ${hist.provider}`,
      detail: momentum,
      url: hist.sourceUrl,
    });
  }

  // Valuation from key stats (P/E + 52-week position).
  let valuation: string | undefined;
  if (ks) {
    const bits: string[] = [];
    if (ks.peRatio != null) bits.push(`P/E ${Math.round(ks.peRatio * 10) / 10}`);
    if (ks.week52High != null && ks.week52Low != null && ks.week52High > ks.week52Low) {
      const pos = ((q.price - ks.week52Low) / (ks.week52High - ks.week52Low)) * 100;
      bits.push(`${Math.round(pos)}% up its 52-week range`);
    }
    if (ks.marketCap != null) {
      const b = ks.marketCap / 1e9;
      bits.push(b >= 1 ? `~$${Math.round(b)}B cap` : `~$${Math.round(ks.marketCap / 1e6)}M cap`);
    }
    if (bits.length) {
      valuation = bits.join(", ");
      sources.push({
        kind: "stats",
        label: `${h.ticker} key stats — ${ks.provider}`,
        detail: valuation,
        url: ks.sourceUrl,
      });
    }
  }

  const facts =
    `  ${h.ticker}: $${q.price} (${fmtPct(q.changePct)} today)` +
    (momentum ? `; momentum ${momentum}` : "") +
    (valuation ? `; ${valuation}` : "");

  return { holding: h, valueUSD, momentum, valuation, facts, sources };
}

async function newsFor(tickers: string[]): Promise<{ block: string; sources: LensSource[] }> {
  if (!currentsConfigured() || tickers.length === 0) return { block: "", sources: [] };
  const sources: LensSource[] = [];
  const blocks = await Promise.all(
    tickers.slice(0, NEWS_FOR_TOP).map(async (t) => {
      try {
        const hl = await fetchHeadlines({ keywords: t, category: "finance", limit: 5 });
        if (hl.length === 0) return "";
        for (const h of hl.slice(0, 3)) {
          sources.push({ kind: "news", label: `${t}: ${h.title}`, url: h.url, detail: h.source });
        }
        return `  ${t}:\n${hl.slice(0, 3).map((h) => `    - ${h.title} (${h.source})`).join("\n")}`;
      } catch {
        return "";
      }
    })
  );
  const body = blocks.filter(Boolean).join("\n");
  return { block: body ? `Recent headlines:\n${body}` : "", sources };
}

async function macro(): Promise<{ block: string; sources: LensSource[] }> {
  try {
    const dash = await readDashboard();
    const trends = (dash?.trends ?? []).map((t) => t.text).filter(Boolean);
    if (!trends.length) return { block: "", sources: [] };
    return {
      block: `Market-wide context today:\n${trends.map((t) => `  - ${t}`).join("\n")}`,
      sources: [{ kind: "macro", label: "Conviqt market dashboard (today's trends)", detail: trends[0] }],
    };
  } catch {
    return { block: "", sources: [] };
  }
}

// ── The model call ────────────────────────────────────────────────────────────

// We DON'T use function-calling here: reasoning models on OpenRouter routinely
// ignore a forced tool_choice (they reason, then answer in prose). So we ask for
// a JSON object and parse it tolerantly — the model's chain-of-thought still
// arrives separately in the reasoning block.
const THESIS_SCHEMA = `{
  "summary": "one tight paragraph — the real thesis on this whole portfolio right now",
  "drivers": ["2-4 things ACTUALLY driving this book right now"],
  "bull": ["2-4 forces working in this portfolio's favour"],
  "bear": ["2-4 real risks — name the ugly ones honestly"],
  "crux": "the SINGLE most decisive variable — the one thing to watch (1-2 sentences)",
  "conviction": "High | Medium | Low",
  "holdingReads": [{ "ticker": "AAPL", "read": "one paragraph: what it adds, its role, its risk" }]
}`;

const THESIS_SYSTEM = `You are the senior analyst writing a DEEP, institutional-grade thesis on one person's stock portfolio for Conviqt. Think like a buy-side analyst, but write so a smart beginner understands every word — plain English, no jargon, no machinery talk.

Reason hard before you answer: weigh the holdings against each other, the momentum and valuation data, the news, and the macro backdrop. Find what is REALLY driving this book, not the surface story.

Hard rules:
- Use ONLY the numbers and facts provided. Never invent or estimate a figure. Reason in words where you lack a number.
- Be specific to THIS portfolio — its concentration, what dominates it, how the pieces interact. No generic boilerplate.
- Name the real risks honestly. The brand is honesty; a thesis that only sells the upside is worthless.
- "crux" must be the single most decisive variable — the one thing that, if it moves, changes everything.
- NEVER tell the user to buy or sell. You give the analysts' view; the decision is theirs.
- conviction is a word (High/Medium/Low), never a score.

OUTPUT: respond with ONLY a single JSON object in exactly this shape — no markdown, no code fences, no prose before or after:
${THESIS_SCHEMA}`;

interface ThesisToolOutput {
  summary?: unknown;
  drivers?: unknown[];
  bull?: unknown[];
  bear?: unknown[];
  crux?: unknown;
  conviction?: unknown;
  holdingReads?: Array<{ ticker?: unknown; read?: unknown }>;
}

function strList(raw: unknown[] | undefined, max = 4, maxLen = 200): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((s) => clampLine(s, maxLen)).filter(Boolean).slice(0, max);
}

function asConviction(raw: unknown): Conviction {
  return raw === "High" || raw === "Low" ? raw : "Medium";
}

// ── Public entry point ──────────────────────────────────────────────────────────

export interface GenerateThesisResult {
  thesis: LensThesis;
  costUSD: number;
}

export async function generateDeepThesis(
  portfolio: PortfolioRecord,
  opts: { date?: string } = {}
): Promise<GenerateThesisResult> {
  const date = opts.date ?? briefDateUTC();

  // Gather every holding's multi-source facts in parallel.
  const gathered = (await Promise.all(portfolio.holdings.map(gatherHolding))).filter(
    (g): g is HoldingDeep => g !== null
  );
  if (gathered.length === 0) {
    throw new Error("thesis: could not price any holding — no data to build a thesis on");
  }

  const totalValue = gathered.reduce((s, g) => s + g.valueUSD, 0);
  const byWeight = [...gathered].sort((a, b) => b.valueUSD - a.valueUSD);

  const [news, mac] = await Promise.all([
    newsFor(byWeight.map((g) => g.holding.ticker)),
    macro(),
  ]);

  const sources: LensSource[] = [
    ...gathered.flatMap((g) => g.sources),
    ...news.sources,
    ...mac.sources,
  ];

  const factsBlock = byWeight
    .map((g) => {
      const w = totalValue > 0 ? ((g.valueUSD / totalValue) * 100).toFixed(1) : "?";
      return `${g.facts} [${w}% of the book]`;
    })
    .join("\n");

  const prompt = [
    `Today is ${date}. Portfolio: "${portfolio.name}", ${gathered.length} priced holdings, total value ~$${Math.round(totalValue)}.`,
    ``,
    `Holdings (numbers are final — reason with them, never change them):`,
    factsBlock,
    news.block ? `\n${news.block}` : "",
    mac.block ? `\n${mac.block}` : "",
    ``,
    `Reason it through, then output the JSON object.`,
  ]
    .filter((l) => l !== "")
    .join("\n");

  // Generous token budget: reasoning tokens count toward the completion, so a
  // tight cap would let the model spend everything thinking and truncate the
  // JSON. No tools (reasoning models ignore forced tool_choice) — JSON in text.
  const res = await getOpenAI().messages.create({
    model: MODELS.lensPro,
    max_tokens: 8000,
    reasoning: { effort: "high" }, // expose the chain-of-thought
    system: THESIS_SYSTEM,
    messages: [{ role: "user", content: prompt }],
  });

  const costUSD = estimateCallCostUSD(MODELS.lensPro, res.usage as Usage, 0);

  const blocks = res.content as Array<{ type: string; text?: string }>;
  const reasoning = clampLine(blocks.find((b) => b.type === "reasoning")?.text, 4000) || undefined;
  const textBlock = blocks.find((b) => b.type === "text");
  const raw = extractJson(textBlock?.text) as ThesisToolOutput | null;
  if (!raw) {
    throw new Error(
      `thesis: could not parse JSON from model (stop=${res.stop_reason}, textLen=${textBlock?.text?.length ?? 0})`
    );
  }

  const readByTicker = new Map<string, string>();
  for (const r of raw.holdingReads ?? []) {
    const ticker = typeof r?.ticker === "string" ? r.ticker.trim().toUpperCase() : "";
    const read = clampLine(r?.read, 400);
    if (ticker && read) readByTicker.set(ticker, read);
  }

  const holdings: LensThesisHolding[] = byWeight.map((g) => ({
    ticker: g.holding.ticker,
    weightPct: totalValue > 0 ? Math.round((g.valueUSD / totalValue) * 1000) / 10 : null,
    momentum: g.momentum,
    valuation: g.valuation,
    read: readByTicker.get(g.holding.ticker) ?? "",
  }));

  const thesis: LensThesis = {
    date,
    portfolioId: portfolio.id,
    portfolioName: portfolio.name,
    summary: clampLine(raw.summary, 700),
    drivers: strList(raw.drivers),
    bull: strList(raw.bull),
    bear: strList(raw.bear),
    crux: clampLine(raw.crux, 400),
    conviction: asConviction(raw.conviction),
    holdings,
    reasoning,
    sources,
    generatedAt: new Date().toISOString(),
    estCostUSD: costUSD,
  };

  if (costUSD > PER_THESIS_BUDGET_USD) {
    console.warn(`[lens] thesis cost $${costUSD.toFixed(4)} exceeded soft cap $${PER_THESIS_BUDGET_USD}`);
  }
  console.log(
    `[lens] thesis ${portfolio.id} ${date}: conviction=${thesis.conviction} ` +
      `holdings=${holdings.length} sources=${sources.length} reasoning=${reasoning ? "yes" : "no"} ` +
      `cost=$${costUSD.toFixed(4)}`
  );

  return { thesis, costUSD };
}
