import {
  getOpenAI,
  MODELS,
  estimateCallCostUSD,
} from "../openai";
import type { FactSheet } from "./types";
import {
  MAX_PUBLISHABLE_CONFIDENCE,
  MIN_PUBLISHABLE_CONFIDENCE,
  type AlphaPickDraft,
  type AlphaPickSource,
  type LensScore,
  type MacroRegime,
  type MosaicScan,
  type Scenario,
} from "../alphaTypes";

// The CIO + Portfolio Constructor — the final seat on the desk.
//
// Inputs per candidate: a cited FactSheet, the scout's setup thesis, and the
// 6-lens council scorecard. Plus the day's macro regime. The CIO:
//   1. Selects the single best name (0 is fine — cash is a position).
//   2. Sizes it as a % of the paper book (the portfolio-constructor job),
//      scaling with conviction, risk/reward, and the regime.
//   3. Sets entry (from the FactSheet), a target, and a stop with real
//      reward:risk discipline.
//   4. Writes the bull/bear case and names the catalyst.
//
// One Sonnet call keeps this under the cost ceiling. risk_reward is computed
// deterministically in code from entry/target/stop — never trusted to the model.

const SYSTEM = `You are the Chief Investment Officer and portfolio constructor for Conviqt's paper trading desk.

You receive 1-3 candidates. For each you have: a cited FactSheet, the scout's setup thesis, a 6-lens council scorecard (Fundamental, Valuation, Catalyst, Risk, Technical, Sentiment — each 0-10, higher is better, including Risk where 10 = low/contained risk), and a MOSAIC of non-obvious "small factor" edge signals (insider buying, 13F flows, short interest, options positioning, supply-chain/customer checks, hiring, regulatory/legal) each tagged bullish/bearish and high/medium/low weight. You also have today's macro regime.

Your job: select the best TWO names (or one, or none), construct each position, AND issue an explicit, falsifiable price forecast with an honest confidence for each — via report_cio_pick. Return at most 2 picks, and they MUST be different tickers.

Selection:
- Aim to publish TWO names when two genuinely clear the bar — they should be distinct ideas, not two bets on the same theme. But quality rules: a strong single name beats a strong-plus-weak pair, so only add a second name if it clears the conviction bar on its own. Returning one (or zero) is correct when the second-best doesn't deserve real capital.
- Weigh the council scorecard, but you are the decision-maker — a single decisive lens (e.g. a hard-dated catalyst, or a glaring valuation gap) can carry a name with otherwise average scores, and a single fatal lens (severe Risk score) can veto an otherwise strong one.
- The MOSAIC is your variant perception — give it real weight. A cluster of high-weight bullish edge factors (e.g. heavy insider buying + falling short interest) can tip selection toward a name and should raise your confidence; high-weight bearish edge factors (e.g. an SEC probe, key-customer loss) should lower it or veto the name. Reflect the decisive edge factors in the thesis and the forecast basis.
- Respect the regime. In RISK_OFF, demand a higher bar and size smaller. In RISK_ON, you can lean in.
- Quality over activity. If nothing clears the bar, return zero picks and explain in rationale. Cash is a position.

Constructing the position:
1. entry_price MUST come from a price fact in the chosen candidate's FactSheet. If none exists, you cannot pick that name.
2. target_price: realistic 3-6 month target, above entry, with a basis (multiple, analyst consensus, catalyst). Cite a sourceIndex.
3. stop_loss: where the thesis is invalidated, below entry (typically 8-15% down). Cite a sourceIndex.
4. Reward:risk discipline — target and stop should give AT LEAST ~2:1 reward-to-risk. If you cannot construct a 2:1 setup honestly, lower conviction or pass.
5. position_size_pct: % of the paper book to allocate, 1-10. Scale UP with conviction and reward:risk; scale DOWN in a RISK_OFF regime or when the Risk lens is weak. A 10/10 conviction name in a RISK_ON regime might be 8-10%; a borderline name 1-3%.
6. conviction: 1-10. Minimum publishable is 7 — if your honest conviction is below 7, set it to 0 and the pick is skipped. Never inflate.
7. bull_thesis / bear_thesis: 2-3 sentences each, specific numbers and catalysts. Give the bear equal weight.
8. catalyst: the single most specific near-term trigger (dated if possible).
9. source_indexes: at least 2 from the chosen candidate's FactSheet.sources.

Forecasting the move (the headline of this product — be precise and honest):
10. horizon_days: the window your forecast plays out over (typically 30-120; never > 365). The target should be reachable inside it.
11. confidence_pct: your HONEST probability (${MIN_PUBLISHABLE_CONFIDENCE}-${MAX_PUBLISHABLE_CONFIDENCE}) that the stock reaches target_price at some point within horizon_days. This is the number investors trust you on — do NOT inflate it. A clean, catalyst-driven setup with mosaic support might be 70-80; a speculative one 50-60. ${MAX_PUBLISHABLE_CONFIDENCE} is the ceiling; never exceed it.
12. bear_price and bull_price: the downside and upside scenario prices at the horizon. bear_price must be BELOW entry (near or through the stop); bull_price must be ABOVE target_price. These bracket the base case (≈ target_price).
13. bear_prob, base_prob, bull_prob: probabilities (each 0-100) of landing near each scenario at the horizon. They should sum to ~100 (we normalize them). The base case sits at target_price.
14. prob_of_loss_pct: your honest probability (1-99) the position is BELOW entry at the horizon. This is the downside-risk number shown to investors.
15. forecast_basis: 1-2 sentences naming the specific drivers of the forecast (catalyst timing, valuation re-rate, decisive mosaic edge factors), citing source indexes.

Internal consistency: a high confidence_pct should pair with a low prob_of_loss_pct and a base/bull-tilted distribution. If you cannot honestly justify a confidence above ${MIN_PUBLISHABLE_CONFIDENCE}, the conviction is probably below 7 — pass.

Return at most 2 picks (different tickers). Pick the strongest one or two. Quality over quantity.`;

const REPORT_CIO_PICK_TOOL = {
  name: "report_cio_pick",
  description:
    "Emit the best 1-2 constructed picks (0, 1, or 2 — different tickers). Never emit more than 2.",
  input_schema: {
    type: "object" as const,
    properties: {
      picks: {
        type: "array",
        maxItems: 2,
        items: {
          type: "object",
          properties: {
            candidate_index: {
              type: "number",
              description: "0-based index of the chosen candidate.",
            },
            ticker: { type: "string" },
            company_name: { type: "string" },
            entry_price: { type: "number", description: "From FactSheet price facts. > 0." },
            target_price: { type: "number", description: "3-6 month target. > entry_price." },
            stop_loss: { type: "number", description: "Invalidation price. < entry_price." },
            catalyst: { type: "string", description: "Single most specific near-term catalyst." },
            conviction: { type: "number", description: "1-10. Set 0 to skip." },
            position_size_pct: {
              type: "number",
              description: "% of the paper book to allocate, 1-10.",
            },
            bull_thesis: { type: "string", description: "2-3 sentences, specific." },
            bear_thesis: { type: "string", description: "2-3 sentences, specific." },
            source_indexes: {
              type: "array",
              items: { type: "number" },
              description: "Indexes into the chosen candidate's FactSheet.sources. Minimum 2.",
            },
            horizon_days: {
              type: "number",
              description: "Forecast window in days (typically 30-120, never > 365).",
            },
            confidence_pct: {
              type: "number",
              description: `Honest probability (${MIN_PUBLISHABLE_CONFIDENCE}-${MAX_PUBLISHABLE_CONFIDENCE}) the stock reaches target_price within horizon_days. Do not inflate.`,
            },
            bear_price: {
              type: "number",
              description: "Downside scenario price at horizon. Below entry_price.",
            },
            bull_price: {
              type: "number",
              description: "Upside scenario price at horizon. Above target_price.",
            },
            bear_prob: { type: "number", description: "Probability (0-100) of the bear scenario." },
            base_prob: { type: "number", description: "Probability (0-100) of the base scenario (≈ target)." },
            bull_prob: { type: "number", description: "Probability (0-100) of the bull scenario." },
            prob_of_loss_pct: {
              type: "number",
              description: "Honest probability (1-99) the position is below entry at the horizon.",
            },
            forecast_basis: {
              type: "string",
              description: "1-2 sentences naming the forecast drivers, citing source indexes.",
            },
          },
          required: [
            "candidate_index",
            "ticker",
            "company_name",
            "entry_price",
            "target_price",
            "stop_loss",
            "catalyst",
            "conviction",
            "position_size_pct",
            "bull_thesis",
            "bear_thesis",
            "source_indexes",
            "horizon_days",
            "confidence_pct",
            "bear_price",
            "bull_price",
            "bear_prob",
            "base_prob",
            "bull_prob",
            "prob_of_loss_pct",
            "forecast_basis",
          ],
        },
      },
      rationale: {
        type: "string",
        description: "If returning 0 picks, explain why nothing cleared the bar. Optional otherwise.",
      },
    },
    required: ["picks"],
  },
};

export interface CIOCandidate {
  factSheet: FactSheet;
  pickerThesis: string;
  lensScores: LensScore[];
  mosaic?: MosaicScan; // the deep "small factors" scan for this candidate
}

export interface CIOResult {
  drafts: AlphaPickDraft[];
  costUSD: number;
  durationMs: number;
}

function renderCandidate(c: CIOCandidate, i: number): string {
  const { factSheet, pickerThesis, lensScores, mosaic } = c;
  const priceFactLines = factSheet.facts
    .filter((f) => f.category === "price" || f.key === "price")
    .map((f) => `  ${f.key}: ${f.value}${f.asOf ? ` (${f.asOf})` : ""} [src:${f.sourceIndex}]`)
    .join("\n");
  const otherFactLines = factSheet.facts
    .filter((f) => f.category !== "price" && f.key !== "price")
    .slice(0, 18)
    .map((f) => `  ${f.key}: ${f.value}${f.note ? ` (${f.note})` : ""} [src:${f.sourceIndex}]`)
    .join("\n");
  const lensLines = lensScores
    .map((l) => `  ${l.lens}: ${l.score}/10 (${l.signal}) — ${l.note}`)
    .join("\n");
  const sourceLines = factSheet.sources
    .map((s, si) => `  [${si}] ${s.title} — ${s.url}`)
    .join("\n");
  const mosaicLines =
    mosaic && mosaic.factors.length > 0
      ? mosaic.factors
          .map((f) => `  [${f.lane}] (${f.direction}, ${f.weight}) ${f.factor}: ${f.detail}`)
          .join("\n")
      : "";

  return `--- CANDIDATE ${i} ---
Ticker: ${factSheet.ticker}
Company: ${factSheet.companyName}
Sector: ${factSheet.sector}
Scout thesis: ${pickerThesis}
Narrative: ${factSheet.narrative ?? "(none)"}

6-Lens council scorecard:
${lensLines || "  (none)"}

Mosaic edge factors (the variant perception):
${mosaicLines || "  (none found)"}${mosaic?.edgeSummary ? `\n  Edge read: ${mosaic.edgeSummary}` : ""}

Price facts:
${priceFactLines || "  (none)"}

Other facts:
${otherFactLines || "  (none)"}

Sources:
${sourceLines || "  (none)"}`;
}

function renderRegime(regime?: MacroRegime): string {
  if (!regime) return "Macro regime: unavailable (treat as NEUTRAL).";
  return `Macro regime: ${regime.stance}. ${regime.summary}
Favored sectors: ${regime.favoredSectors.join(", ") || "(none)"}
Avoid sectors: ${regime.avoidSectors.join(", ") || "(none)"}
Key risks: ${regime.keyRisks.join("; ") || "(none)"}`;
}

// ── Forecast math (all derived in code, never trusted to the model) ──────────

const round2 = (n: number) => Math.round(n * 100) / 100;
const round1 = (n: number) => Math.round(n * 10) / 10;

function clampNum(v: unknown, lo: number, hi: number, fallback: number): number {
  const n = typeof v === "number" && Number.isFinite(v) ? v : fallback;
  return Math.max(lo, Math.min(hi, round1(n)));
}
function clampInt(v: unknown, lo: number, hi: number, fallback: number): number {
  const n = typeof v === "number" && Number.isFinite(v) ? Math.round(v) : fallback;
  return Math.max(lo, Math.min(hi, n));
}
function posOr(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? v : fallback;
}
function nonNeg(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : fallback;
}
function addDaysISO(days: number): string {
  const r = new Date();
  r.setUTCDate(r.getUTCDate() + days);
  return r.toISOString().slice(0, 10);
}

interface Forecast {
  predictedPrice: number;
  horizonDays: number;
  targetDate: string;
  confidencePct: number;
  riskPct: number;
  probOfLossPct: number;
  expectedValuePct: number;
  scenarios: Scenario[];
}

// Build the falsifiable forecast from the model's raw numbers, producing a
// coherent bear/base/bull distribution even when the model's inputs were
// sloppy (sensible fallbacks from entry/target/stop). predicted_price === the
// base-case target; confidence is clamped to the published honesty band.
function buildForecast(p: {
  entry_price: number;
  target_price: number;
  stop_loss: number;
  horizon_days?: number;
  confidence_pct?: number;
  bear_price?: number;
  bull_price?: number;
  bear_prob?: number;
  base_prob?: number;
  bull_prob?: number;
  prob_of_loss_pct?: number;
}): Forecast {
  const entry = p.entry_price;
  const predictedPrice = p.target_price; // base case = the headline target

  const horizonDays = clampInt(p.horizon_days, 7, 365, 90);
  const targetDate = addDaysISO(horizonDays);

  const confidencePct = clampNum(
    p.confidence_pct,
    MIN_PUBLISHABLE_CONFIDENCE,
    MAX_PUBLISHABLE_CONFIDENCE,
    60
  );
  const riskPct = round1(100 - confidencePct);
  const probOfLossPct = clampNum(p.prob_of_loss_pct, 1, 99, round1(100 - confidencePct));

  // Scenario prices with sane guards: bear below entry (default = stop); bull
  // above target (default extends the upside by the entry→target distance).
  let bearPrice = posOr(p.bear_price, p.stop_loss);
  if (bearPrice >= entry) bearPrice = p.stop_loss;
  let bullPrice = posOr(p.bull_price, predictedPrice + (predictedPrice - entry));
  if (bullPrice <= predictedPrice) bullPrice = predictedPrice + Math.max(0.01, predictedPrice - entry);

  // Scenario probabilities, normalized to sum 100. Fallback 25/50/25.
  let bear = nonNeg(p.bear_prob, 25);
  let base = nonNeg(p.base_prob, 50);
  let bull = nonNeg(p.bull_prob, 25);
  let total = bear + base + bull;
  if (total <= 0) {
    bear = 25;
    base = 50;
    bull = 25;
    total = 100;
  }
  const ret = (price: number) => round1(((price - entry) / entry) * 100);
  const scenarios: Scenario[] = [
    { label: "bear", price: round2(bearPrice), probability: round1((bear / total) * 100), returnPct: ret(bearPrice) },
    { label: "base", price: round2(predictedPrice), probability: round1((base / total) * 100), returnPct: ret(predictedPrice) },
    { label: "bull", price: round2(bullPrice), probability: round1((bull / total) * 100), returnPct: ret(bullPrice) },
  ];

  const expectedValuePct = round1(
    scenarios.reduce((acc, s) => acc + (s.probability / 100) * s.returnPct, 0)
  );

  return {
    predictedPrice: round2(predictedPrice),
    horizonDays,
    targetDate,
    confidencePct,
    riskPct,
    probOfLossPct,
    expectedValuePct,
    scenarios,
  };
}

export async function runCIO(
  candidates: CIOCandidate[],
  regime?: MacroRegime
): Promise<CIOResult> {
  const t0 = Date.now();
  const anthropic = getOpenAI();

  const userMessage = `Today's regime and ${candidates.length} candidate(s). Select the single best (or 0) and call report_cio_pick.

${renderRegime(regime)}

${candidates.map(renderCandidate).join("\n\n")}`;

  const response = await anthropic.messages.create({
    model: MODELS.cio,
    max_tokens: 1500,
    system: SYSTEM,
    tools: [REPORT_CIO_PICK_TOOL],
    tool_choice: { type: "any" as const },
    messages: [{ role: "user", content: userMessage }],
  });

  const toolUse = response.content.find(
    (b) => b.type === "tool_use" && b.name === REPORT_CIO_PICK_TOOL.name
  );
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error(
      `[CIO] No report_cio_pick call. stop_reason=${response.stop_reason}`
    );
  }

  const input = toolUse.input as {
    picks: Array<{
      candidate_index: number;
      ticker: string;
      company_name: string;
      entry_price: number;
      target_price: number;
      stop_loss: number;
      catalyst: string;
      conviction: number;
      position_size_pct: number;
      bull_thesis: string;
      bear_thesis: string;
      source_indexes: number[];
      horizon_days?: number;
      confidence_pct?: number;
      bear_price?: number;
      bull_price?: number;
      bear_prob?: number;
      base_prob?: number;
      bull_prob?: number;
      prob_of_loss_pct?: number;
      forecast_basis?: string;
    }>;
    rationale?: string;
  };

  const drafts: AlphaPickDraft[] = [];
  const seenTickers = new Set<string>();

  for (const p of input.picks ?? []) {
    const tkr = (p.ticker ?? "").trim().toUpperCase();
    if (tkr && seenTickers.has(tkr)) {
      console.log(`[CIO] skipping duplicate pick ${tkr}`);
      continue;
    }
    if (!p.conviction || p.conviction < 7) {
      console.log(`[CIO] skipping ${p.ticker}: conviction=${p.conviction} < 7`);
      continue;
    }
    if (!p.entry_price || p.entry_price <= 0) {
      console.log(`[CIO] skipping ${p.ticker}: entry_price=${p.entry_price} invalid`);
      continue;
    }
    if (p.target_price <= p.entry_price) {
      console.log(`[CIO] skipping ${p.ticker}: target_price <= entry_price`);
      continue;
    }
    if (p.stop_loss >= p.entry_price) {
      console.log(`[CIO] skipping ${p.ticker}: stop_loss >= entry_price`);
      continue;
    }

    const candIdx = p.candidate_index ?? 0;
    const candidate = candidates[candIdx];
    if (!candidate) {
      console.log(`[CIO] skipping ${p.ticker}: bad candidate_index ${candIdx}`);
      continue;
    }
    const factSheet = candidate.factSheet;

    const resolvedSources: AlphaPickSource[] = [];
    const seenIdxs = new Set<number>();
    for (const si of p.source_indexes ?? []) {
      if (typeof si !== "number" || seenIdxs.has(si)) continue;
      const src = factSheet.sources[si];
      if (!src) continue;
      seenIdxs.add(si);
      resolvedSources.push({
        url: src.url,
        title: src.title,
        publisher: src.publisher,
      });
    }

    if (resolvedSources.length < 2) {
      console.log(`[CIO] skipping ${p.ticker}: only ${resolvedSources.length} valid source(s)`);
      continue;
    }

    // Reward:risk computed in code from the structured numbers — never the model's.
    const reward = p.target_price - p.entry_price;
    const risk = p.entry_price - p.stop_loss;
    const riskReward = risk > 0 ? Math.round((reward / risk) * 100) / 100 : 0;

    // Clamp position size to a sane book weight. If the model omitted it,
    // fall back to a conviction-scaled default (7→3.5%, 10→5%).
    const rawSize =
      typeof p.position_size_pct === "number" && p.position_size_pct > 0
        ? p.position_size_pct
        : p.conviction * 0.5;
    const positionSizePct = Math.max(1, Math.min(10, Math.round(rawSize * 10) / 10));

    // The falsifiable forecast — derived numbers computed in code.
    const forecast = buildForecast(p);

    drafts.push({
      ticker: p.ticker.trim().toUpperCase(),
      companyName: p.company_name?.trim() || p.ticker.toUpperCase(),
      entryPrice: p.entry_price,
      targetPrice: p.target_price,
      stopLoss: p.stop_loss,
      catalyst: p.catalyst?.trim() ?? "",
      conviction: Math.min(10, Math.max(1, Math.round(p.conviction))),
      bullThesis: p.bull_thesis?.trim() ?? "",
      bearThesis: p.bear_thesis?.trim() ?? "",
      sources: resolvedSources,
      positionSizePct,
      riskReward,
      lensScores: candidate.lensScores,
      // Mosaic edge carried through from the selected candidate.
      edgeFactors: candidate.mosaic?.factors ?? [],
      edgeSummary: candidate.mosaic?.edgeSummary ?? "",
      // Prediction & risk.
      predictedPrice: forecast.predictedPrice,
      horizonDays: forecast.horizonDays,
      targetDate: forecast.targetDate,
      confidencePct: forecast.confidencePct,
      riskPct: forecast.riskPct,
      probOfLossPct: forecast.probOfLossPct,
      expectedValuePct: forecast.expectedValuePct,
      scenarios: forecast.scenarios,
      forecastBasis: p.forecast_basis?.trim() ?? "",
    });
    seenTickers.add(p.ticker.trim().toUpperCase());

    if (drafts.length === 2) break; // hard cap: 2 picks per run
  }

  if (input.rationale) {
    console.log(`[CIO] rationale: ${input.rationale}`);
  }

  const costUSD = estimateCallCostUSD(MODELS.cio, response.usage, 0);

  return { drafts, costUSD, durationMs: Date.now() - t0 };
}
