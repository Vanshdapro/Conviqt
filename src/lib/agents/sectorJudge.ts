import { getAnthropic, MODELS, estimateCallCostUSD } from "../anthropic";
import { audienceDirective, type ExperienceLevel } from "./audience";
import {
  FactSheet,
  KeyMetric,
  MetricSignal,
  SectorConstituent,
  SectorRankRow,
  SectorVerdict,
  Verdict,
} from "./types";
import type { SectorBasket } from "./sectors";

// Two judges power the Sector Snapshot pipeline:
//
// 1. runSectorTickerScorecard — the ABBREVIATED per-name pass. Reads ONE
//    name's FactSheet (from the sweep) and emits a compact verdict: BUY/HOLD/
//    SELL + conviction + a 1-2 sentence cited thesis + a couple of signals.
//    Haiku, tight tool call (~0.3¢). This replaces the full 4-specialist
//    debate for sector mode — the brief calls for "sweep + judge per ticker".
//
// 2. runSectorJudge — the THEMATIC synthesis. Reads all surviving scorecards
//    at once and issues the sector verdict: theme stance, which subsector has
//    the most conviction, where the basket disagrees most, the macro read, and
//    a ranked basket. Sonnet — this is the marquee output and reasons across
//    the whole basket. Inputs are lean per-name briefs (not raw FactSheets) so
//    the single structured call stays ~1.5-2¢.

// ── Per-name scorecard (Haiku) ────────────────────────────────────────────────

const SCORECARD_SYSTEM = `You are a Conviqt sector analyst running a FAST read on a single stock as part of a sector sweep.

You have a FactSheet of cited facts gathered from the web right now. You are NOT writing a full investment thesis — you are producing a quick, decisive scorecard so a sector-level judge can aggregate many names. Be fast and concrete.

Rules:
- Issue a clear BUY / HOLD / SELL and a 0-100 conviction. Make a call; avoid defaulting to HOLD unless the evidence is genuinely balanced.
- thesis: 1-2 sentences. The single most important reason for your call. Cite source indexes inline as [#N] for any number.
- signals: 2-3 of the most decision-relevant data points from the FactSheet (valuation, growth, momentum, margin, balance sheet). Each is a label, a value WITH UNITS taken straight from the FactSheet, and whether it reads bullish/bearish/neutral. Never invent a number that isn't in the FactSheet.
- flags: 1-3 short labels, e.g. "overbought", "margin expansion", "rich multiple".
- Only cite facts present in the FactSheet. If the sweep missed something, lower conviction rather than guessing.

Output via report_scorecard.`;

const SCORECARD_TOOL = {
  name: "report_scorecard",
  description: "Emit the fast scorecard for this single stock.",
  input_schema: {
    type: "object" as const,
    properties: {
      verdict: { type: "string", enum: ["BUY", "HOLD", "SELL"] },
      conviction: { type: "number", description: "0-100." },
      thesis: {
        type: "string",
        description: "1-2 sentences. The key reason for the call. Cite [#N] for numbers.",
      },
      signals: {
        type: "array",
        description: "2-3 key data points from the FactSheet.",
        items: {
          type: "object",
          properties: {
            label: { type: "string", description: "e.g. 'Forward P/E', 'Revenue YoY'" },
            value: { type: "string", description: "Value with units, from the FactSheet, e.g. '29.4x', '+34%'" },
            signal: { type: "string", enum: ["bullish", "bearish", "neutral"] },
          },
          required: ["label", "value", "signal"],
        },
        minItems: 1,
        maxItems: 4,
      },
      flags: {
        type: "array",
        items: { type: "string" },
        description: "1-3 short labels.",
      },
      sourceIndexes: {
        type: "array",
        items: { type: "number" },
        description: "Indexes of the FactSheet sources you relied on.",
      },
    },
    required: ["verdict", "conviction", "thesis", "signals", "sourceIndexes"],
  },
};

function normalizeVerdict(v: unknown): Verdict {
  return v === "BUY" || v === "SELL" ? v : "HOLD";
}

function normalizeSignal(s: unknown): MetricSignal {
  return s === "bullish" || s === "bearish" ? s : "neutral";
}

function renderFacts(factSheet: FactSheet): string {
  if (factSheet.facts.length === 0) return "(no facts available)";
  return factSheet.facts
    .map((f) => {
      const src = factSheet.sources[f.sourceIndex];
      const srcLabel = src ? `[#${f.sourceIndex} ${src.publisher}]` : `[#${f.sourceIndex}]`;
      const note = f.note ? ` [${f.note}]` : "";
      const asOf = f.asOf ? ` (${f.asOf})` : "";
      return `- ${f.key} = ${f.value}${note}${asOf} ${srcLabel}`;
    })
    .join("\n");
}

export interface SectorScorecardResult {
  verdict: Verdict;
  conviction: number;
  thesis: string;
  signals: KeyMetric[];
  flags: string[];
  sourceIndexes: number[];
  costUSD: number;
  durationMs: number;
}

export async function runSectorTickerScorecard(
  factSheet: FactSheet
): Promise<SectorScorecardResult> {
  const t0 = Date.now();
  const anthropic = getAnthropic();

  const sourceLegend = factSheet.sources
    .map((s, i) => `#${i} — ${s.publisher}: ${s.title.slice(0, 80)}`)
    .join("\n");

  const response = await anthropic.messages.create({
    model: MODELS.sectorTicker,
    max_tokens: 600,
    system: [{ type: "text", text: SCORECARD_SYSTEM, cache_control: { type: "ephemeral" } }],
    tools: [SCORECARD_TOOL],
    tool_choice: { type: "tool", name: SCORECARD_TOOL.name },
    messages: [
      {
        role: "user",
        content: `Stock: ${factSheet.ticker} — ${factSheet.companyName} (${factSheet.sector})

Sources available:
${sourceLegend || "(none)"}

Facts from the sweep:
${renderFacts(factSheet)}${factSheet.narrative ? `\n\nContext notes: ${factSheet.narrative}` : ""}${factSheet.gaps.length > 0 ? `\n\nData gaps: ${factSheet.gaps.join(", ")}` : ""}

Score this name now.`,
      },
    ],
  });

  const toolUse = response.content.find(
    (b) => b.type === "tool_use" && b.name === SCORECARD_TOOL.name
  );
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error(
      `[SectorScorecard] No tool_use response for ${factSheet.ticker}. Got: ${JSON.stringify(
        response.content
      ).slice(0, 200)}`
    );
  }

  const input = toolUse.input as {
    verdict?: Verdict;
    conviction?: number;
    thesis?: string;
    signals?: Array<Partial<KeyMetric>>;
    flags?: string[];
    sourceIndexes?: number[];
  };

  const signals: KeyMetric[] = Array.isArray(input.signals)
    ? input.signals
        .filter((s) => s && s.label && s.value)
        .slice(0, 4)
        .map((s) => ({
          label: String(s.label),
          value: String(s.value),
          signal: normalizeSignal(s.signal),
        }))
    : [];

  const cleanIndexes = Array.isArray(input.sourceIndexes)
    ? Array.from(
        new Set(
          input.sourceIndexes.filter(
            (i) => typeof i === "number" && i >= 0 && i < factSheet.sources.length
          )
        )
      ).sort((a, b) => a - b)
    : [];

  const conviction = Math.max(0, Math.min(100, Math.round(Number(input.conviction ?? 0))));

  return {
    verdict: normalizeVerdict(input.verdict),
    conviction,
    thesis: (input.thesis ?? "").trim(),
    signals,
    flags: Array.isArray(input.flags) ? input.flags.map(String).slice(0, 3) : [],
    sourceIndexes: cleanIndexes,
    costUSD: estimateCallCostUSD(MODELS.sectorTicker, response.usage),
    durationMs: Date.now() - t0,
  };
}

// ── Thematic synthesis (Sonnet) ───────────────────────────────────────────────

const SECTOR_SYSTEM = `You are the head of research at Conviqt, issuing a SECTOR verdict on an investment theme.

Each name in the basket has already been through a fast scorecard pass (BUY/HOLD/SELL + a 0-100 internal confidence score + thesis + signals). You are NOT re-analyzing any single name. Your job is the THEME-LEVEL call that no single-stock note can produce: should an investor lean into this theme or fade it, where inside the theme the analysts' confidence concentrates, and where the basket is most divided.

This is a portfolio-level read, not a stack of single-stock summaries. Every field must reason ACROSS the basket. If you catch yourself describing one name in isolation without tying it to the theme, rewrite it.

TONE AND STYLE
- Decisive, but written for a smart beginner-to-intermediate investor. Plain English; briefly gloss any technical term you must use.
- Prose fields are shown to users VERBATIM. In prose, NEVER use internal vocabulary: do not write the words "Council", "agents", "pipeline", "conviction", or "disagreement", and never quote internal N/100 scores. Say it qualitatively: "the analysts are most confident in…", "the basket splits on…". (The separate NUMERIC conviction fields are internal scores — fill them, but keep the numbers out of prose.)
- No inline source citations like [#N] — each constituent's scorecard carries its own sources, surfaced in the report.
- Use the specifics in the briefs (verdicts, signals). Never invent a number that isn't there.

WHAT EACH FIELD MUST CONTAIN
- stance: the overall theme call — BUY (lean in), HOLD (selective / stock-pickers' market), or SELL (fade the theme).
- conviction: 0-100 internal confidence in that theme call (numeric field only).
- headline: ONE shareable sentence naming the theme's central tension. This is the line that gets screenshotted — make it sharp, e.g. "The AI buildout is consensus, but the smart money has rotated from chips to power."
- summary: 3-4 sentences. Where the analysts' confidence concentrates across the basket and why, and what splits the names.
- topSubSector / topSubSectorRationale: which subsector inside the basket the analysts back most strongly, and why. (Subsectors are provided per name.)
- topPick / topPickRationale: the single most-backed NAME (its ticker) and why it leads the theme.
- mostDivisive / mostDivisiveRationale: the name (ticker) the basket is most split on — the contrarian/debate name — and the crux of the debate.
- macroRead: the cross-cutting macro tailwind or headwind that re-rates the WHOLE theme (rates, capex cycle, regulation, demand, commodity). One the basket shares.
- bullCase / bearCase: the strongest case FOR and AGAINST the theme as a whole. 2-3 sentences each.
- ranking: every name in the basket, ordered by how strongly you back it within the theme (strongest first). For each: ticker, your BUY/HOLD/SELL on it within the theme, a 0-100 internal confidence (numeric field), and a one-clause plain-English note.
- bottomLine: the theme trade in 25 words or fewer. No hedging.

Output via report_sector_verdict.`;

const SECTOR_TOOL = {
  name: "report_sector_verdict",
  description: "Issue the thematic verdict synthesizing the basket.",
  input_schema: {
    type: "object" as const,
    properties: {
      stance: { type: "string", enum: ["BUY", "HOLD", "SELL"] },
      conviction: { type: "number", description: "0-100 conviction in the theme call." },
      headline: { type: "string", description: "One shareable sentence naming the theme's tension." },
      summary: { type: "string", description: "3-4 sentences. Where conviction concentrates and what splits the basket." },
      topSubSector: { type: "string", description: "The highest-conviction subsector label." },
      topSubSectorRationale: { type: "string", description: "Why that subsector leads. 1-2 sentences." },
      topPick: { type: "string", description: "Ticker of the single highest-conviction name." },
      topPickRationale: { type: "string", description: "Why it leads the theme. 1-2 sentences." },
      mostDivisive: { type: "string", description: "Ticker of the name the basket is most split on." },
      mostDivisiveRationale: { type: "string", description: "The crux of the debate. 1-2 sentences." },
      macroRead: { type: "string", description: "The cross-cutting macro driver for the whole theme. 1-2 sentences." },
      bullCase: { type: "string", description: "Strongest case FOR the theme. 2-3 sentences." },
      bearCase: { type: "string", description: "Strongest case AGAINST the theme. 2-3 sentences." },
      ranking: {
        type: "array",
        description: "Every name, ordered by within-theme conviction (highest first).",
        items: {
          type: "object",
          properties: {
            ticker: { type: "string" },
            verdict: { type: "string", enum: ["BUY", "HOLD", "SELL"] },
            conviction: { type: "number", description: "0-100." },
            note: { type: "string", description: "One-clause justification." },
          },
          required: ["ticker", "verdict", "conviction", "note"],
        },
      },
      bottomLine: { type: "string", description: "The theme trade in 25 words or fewer. No hedging." },
    },
    required: [
      "stance",
      "conviction",
      "headline",
      "summary",
      "topSubSector",
      "topSubSectorRationale",
      "topPick",
      "topPickRationale",
      "mostDivisive",
      "mostDivisiveRationale",
      "macroRead",
      "bullCase",
      "bearCase",
      "ranking",
      "bottomLine",
    ],
  },
};

export interface SectorJudgeResult {
  output: SectorVerdict;
  costUSD: number;
}

// Compact, synthesis-ready brief from one constituent's scorecard. We
// deliberately summarise rather than dump raw FactSheets — the scorecard
// already distils what matters, and a lean prompt is the cost lever for the
// Sonnet call across 5-8 names.
function constituentBrief(c: SectorConstituent): string {
  const sig = c.signals.map((s) => `${s.label} ${s.value} (${s.signal})`).join(", ");
  return `- ${c.ticker} — ${c.companyName} [${c.subSector}]: ${c.verdict} @ conviction ${c.conviction}/100
    thesis: ${c.thesis}
    signals: ${sig || "(none)"}${c.flags.length ? `\n    flags: ${c.flags.join(", ")}` : ""}`;
}

export async function runSectorJudge(
  basket: SectorBasket,
  constituents: SectorConstituent[],
  audience?: ExperienceLevel | null
): Promise<SectorJudgeResult> {
  const t0 = Date.now();
  const anthropic = getAnthropic();
  const aud = audienceDirective(audience);

  const briefs = constituents.map(constituentBrief).join("\n");
  const validTickers = new Set(constituents.map((c) => c.ticker));

  const response = await anthropic.messages.create({
    model: MODELS.sectorJudge,
    max_tokens: 1800,
    system: [
      { type: "text", text: SECTOR_SYSTEM, cache_control: { type: "ephemeral" } },
      ...(aud ? [{ type: "text" as const, text: aud }] : []),
    ],
    tools: [SECTOR_TOOL],
    tool_choice: { type: "tool", name: SECTOR_TOOL.name },
    messages: [
      {
        role: "user",
        content: `Theme: ${basket.label}
${basket.blurb}

Basket scorecards (${constituents.length} names):
${briefs}

Issue your sector verdict now. Reason across the whole basket — theme stance, where conviction concentrates by subsector and by name, where the basket is most divided, and the shared macro driver.`,
      },
    ],
  });

  const toolUse = response.content.find(
    (b) => b.type === "tool_use" && b.name === SECTOR_TOOL.name
  );
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error(
      `[SectorJudge] No tool_use response for ${basket.key}. Got: ${JSON.stringify(
        response.content
      ).slice(0, 200)}`
    );
  }

  const input = toolUse.input as {
    stance?: Verdict;
    conviction?: number;
    headline?: string;
    summary?: string;
    topSubSector?: string;
    topSubSectorRationale?: string;
    topPick?: string;
    topPickRationale?: string;
    mostDivisive?: string;
    mostDivisiveRationale?: string;
    macroRead?: string;
    bullCase?: string;
    bearCase?: string;
    ranking?: Array<Partial<SectorRankRow>>;
    bottomLine?: string;
  };

  // Keep only ranking rows that name a real constituent, so the report never
  // renders a row for a name that wasn't in the basket.
  const ranking: SectorRankRow[] = Array.isArray(input.ranking)
    ? input.ranking
        .filter((r) => r && r.ticker && validTickers.has(String(r.ticker).toUpperCase()))
        .map((r) => ({
          ticker: String(r.ticker).toUpperCase(),
          verdict: normalizeVerdict(r.verdict),
          conviction: Math.max(0, Math.min(100, Math.round(Number(r.conviction ?? 0)))),
          note: String(r.note ?? "").trim(),
        }))
    : [];

  return {
    output: {
      stance: normalizeVerdict(input.stance),
      conviction: Math.max(0, Math.min(100, Math.round(Number(input.conviction ?? 0)))),
      headline: (input.headline ?? "").trim(),
      summary: (input.summary ?? "").trim(),
      topSubSector: (input.topSubSector ?? "").trim(),
      topSubSectorRationale: (input.topSubSectorRationale ?? "").trim(),
      topPick: (input.topPick ?? "").trim().toUpperCase(),
      topPickRationale: (input.topPickRationale ?? "").trim(),
      mostDivisive: (input.mostDivisive ?? "").trim().toUpperCase(),
      mostDivisiveRationale: (input.mostDivisiveRationale ?? "").trim(),
      macroRead: (input.macroRead ?? "").trim(),
      bullCase: (input.bullCase ?? "").trim(),
      bearCase: (input.bearCase ?? "").trim(),
      ranking,
      bottomLine: (input.bottomLine ?? "").trim(),
      durationMs: Date.now() - t0,
    },
    costUSD: estimateCallCostUSD(MODELS.sectorJudge, response.usage),
  };
}
