import {
  getAnthropic,
  MODELS,
  estimateCallCostUSD,
} from "../anthropic";
import type { FactSheet } from "./types";
import type {
  AlphaPickDraft,
  AlphaPickSource,
  LensScore,
  MacroRegime,
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

You receive 1-3 candidates. For each you have: a cited FactSheet, the scout's setup thesis, and a 6-lens council scorecard (Fundamental, Valuation, Catalyst, Risk, Technical, Sentiment — each 0-10, higher is better, including Risk where 10 = low/contained risk). You also have today's macro regime.

Your job: select the SINGLE best name (or none) and construct the position via report_cio_pick. Return at most 1 pick.

Selection:
- Weigh the council scorecard, but you are the decision-maker — a single decisive lens (e.g. a hard-dated catalyst, or a glaring valuation gap) can carry a name with otherwise average scores, and a single fatal lens (severe Risk score) can veto an otherwise strong one.
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

Return at most 1 pick. Pick the single strongest. Quality over quantity.`;

const REPORT_CIO_PICK_TOOL = {
  name: "report_cio_pick",
  description:
    "Emit the single best constructed pick (0 or 1). Never emit more than 1.",
  input_schema: {
    type: "object" as const,
    properties: {
      picks: {
        type: "array",
        maxItems: 1,
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
}

export interface CIOResult {
  drafts: AlphaPickDraft[];
  costUSD: number;
  durationMs: number;
}

function renderCandidate(c: CIOCandidate, i: number): string {
  const { factSheet, pickerThesis, lensScores } = c;
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

  return `--- CANDIDATE ${i} ---
Ticker: ${factSheet.ticker}
Company: ${factSheet.companyName}
Sector: ${factSheet.sector}
Scout thesis: ${pickerThesis}
Narrative: ${factSheet.narrative ?? "(none)"}

6-Lens council scorecard:
${lensLines || "  (none)"}

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

export async function runCIO(
  candidates: CIOCandidate[],
  regime?: MacroRegime
): Promise<CIOResult> {
  const t0 = Date.now();
  const anthropic = getAnthropic();

  const userMessage = `Today's regime and ${candidates.length} candidate(s). Select the single best (or 0) and call report_cio_pick.

${renderRegime(regime)}

${candidates.map(renderCandidate).join("\n\n")}`;

  const response = await anthropic.messages.create({
    model: MODELS.cio,
    max_tokens: 2000,
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
    }>;
    rationale?: string;
  };

  const drafts: AlphaPickDraft[] = [];

  for (const p of input.picks ?? []) {
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
    });

    if (drafts.length === 1) break; // hard cap: 1 pick per run
  }

  if (input.rationale) {
    console.log(`[CIO] rationale: ${input.rationale}`);
  }

  const costUSD = estimateCallCostUSD(MODELS.cio, response.usage, 0);

  return { drafts, costUSD, durationMs: Date.now() - t0 };
}
