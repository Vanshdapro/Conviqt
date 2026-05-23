import {
  getAnthropic,
  MODELS,
  estimateCallCostUSD,
} from "../anthropic";
import type { FactSheet } from "./types";
import type { AlphaPickDraft, AlphaPickSource } from "../alphaTypes";

// The Alpha Judge takes up to 3 candidate FactSheets (each pre-researched by
// sweep) and selects at most 2 to publish as Alpha Tracker picks. For each
// selected pick it produces the full structured record: entry price (from
// FactSheet price facts), target, stop-loss, catalyst, conviction (1-10),
// bull/bear theses, and source citations back into the FactSheet.sources array.
//
// One Sonnet call handles all candidates so we stay under the cost ceiling.

const SYSTEM = `You are the Alpha Judge for Conviqt's paper portfolio.

You receive FactSheets for 1-3 candidate stocks. For each candidate you have:
- A FactSheet with cited price, fundamental, technical, sentiment, and macro facts
- A brief picker thesis explaining the setup

Your job: select the single best pick (0 is fine if nothing clears the bar) and produce a full structured record for it via the report_alpha_picks tool. Only ever return 1 pick.

Rules:
1. entry_price MUST come from a price fact in that candidate's FactSheet. Use the most recent closing/current price you can find. If no price fact exists, conviction must be 0.
2. target_price: 3-6 month price target. Must be higher than entry_price. Must have at least 5% upside, and a realistic basis (e.g. analyst consensus, historical multiple, product catalyst). Must cite a sourceIndex.
3. stop_loss: price at which the thesis is invalidated. Typically 8-15% below entry. Must cite a sourceIndex.
4. catalyst: the single most specific near-term catalyst (e.g. "Q3 earnings on Aug 12", "FDA decision expected Q3 2026", "Fed rate cut in Sept"). Be specific — not just "earnings".
5. conviction: 1-10. The minimum publishable conviction is 7. If your honest conviction is below 7 for a candidate, set it to 0 — the pipeline will skip that pick. Never inflate conviction.
6. bull_thesis: 2-3 sentences. Name specific numbers and catalysts. No vague language.
7. bear_thesis: 2-3 sentences. Name the specific risk, magnitude, and probability. Different background treatment in the UI — give it equal weight.
8. source_indexes: cite at least 2 source indexes from that candidate's FactSheet.sources array. These must resolve to real sources — do not cite indexes that don't exist.
9. Never select more than 1 pick total. This is a daily single-pick tracker.
10. Pick the single strongest candidate. Quality over quantity.`;

const REPORT_ALPHA_PICKS_TOOL = {
  name: "report_alpha_picks",
  description: "Emit the single best Alpha Tracker pick (0 or 1). Never emit more than 1.",
  input_schema: {
    type: "object" as const,
    properties: {
      picks: {
        type: "array",
        description: "0 or 1 pick. Must pass validation (conviction >= 7, entry_price > 0, source_indexes.length >= 2).",
        maxItems: 1,
        items: {
          type: "object",
          properties: {
            candidate_index: {
              type: "number",
              description: "0-based index of which candidate this pick is for.",
            },
            ticker: { type: "string" },
            company_name: { type: "string" },
            entry_price: {
              type: "number",
              description: "Current price from FactSheet price facts. Must be > 0.",
            },
            target_price: {
              type: "number",
              description: "3-6 month price target. Must be > entry_price.",
            },
            stop_loss: {
              type: "number",
              description: "Stop-loss price where thesis is invalidated. Must be < entry_price.",
            },
            catalyst: {
              type: "string",
              description: "Single most specific near-term catalyst.",
            },
            conviction: {
              type: "number",
              description: "1-10 conviction. Set to 0 to skip this pick.",
            },
            bull_thesis: {
              type: "string",
              description: "2-3 sentences. Specific catalysts, numbers, time horizon.",
            },
            bear_thesis: {
              type: "string",
              description: "2-3 sentences. Specific risk, magnitude, scenario.",
            },
            source_indexes: {
              type: "array",
              items: { type: "number" },
              description: "Indexes into this candidate's FactSheet.sources. Minimum 2.",
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

export interface AlphaJudgeCandidate {
  factSheet: FactSheet;
  pickerThesis: string;
}

export interface AlphaJudgeResult {
  drafts: AlphaPickDraft[];
  costUSD: number;
  durationMs: number;
}

export async function runAlphaJudge(
  candidates: AlphaJudgeCandidate[]
): Promise<AlphaJudgeResult> {
  const t0 = Date.now();
  const anthropic = getAnthropic();

  // Build the user message: summarize each candidate's FactSheet in a compact
  // way so the model has the cited facts it needs without burning tokens on
  // the full JSON payload.
  const candidateBlocks = candidates.map((c, i) => {
    const { factSheet, pickerThesis } = c;
    const priceFactLines = factSheet.facts
      .filter((f) => f.category === "price" || f.key === "price")
      .map((f) => `  ${f.key}: ${f.value}${f.asOf ? ` (${f.asOf})` : ""} [src:${f.sourceIndex}]`)
      .join("\n");
    const otherFactLines = factSheet.facts
      .filter((f) => f.category !== "price" && f.key !== "price")
      .slice(0, 20) // cap to avoid token explosion
      .map((f) => `  ${f.key}: ${f.value}${f.note ? ` (${f.note})` : ""} [src:${f.sourceIndex}]`)
      .join("\n");
    const sourceLines = factSheet.sources
      .map((s, si) => `  [${si}] ${s.title} — ${s.url}`)
      .join("\n");

    return `--- CANDIDATE ${i} ---
Ticker: ${factSheet.ticker}
Company: ${factSheet.companyName}
Sector: ${factSheet.sector}
Picker thesis: ${pickerThesis}
Narrative: ${factSheet.narrative ?? "(none)"}

Price facts:
${priceFactLines || "  (none)"}

Other facts:
${otherFactLines || "  (none)"}

Sources:
${sourceLines || "  (none)"}`;
  });

  const userMessage = `Here are ${candidates.length} candidate(s) for today's Alpha Tracker pick. Select the single best one (or 0 if nothing clears the bar) and call report_alpha_picks.\n\n${candidateBlocks.join("\n\n")}`;

  const response = await anthropic.messages.create({
    model: MODELS.picker, // Sonnet — same budget as picker
    max_tokens: 2000,
    system: SYSTEM,
    tools: [REPORT_ALPHA_PICKS_TOOL],
    tool_choice: { type: "any" as const },
    messages: [{ role: "user", content: userMessage }],
  });

  const toolUse = response.content.find(
    (b) => b.type === "tool_use" && b.name === REPORT_ALPHA_PICKS_TOOL.name
  );
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error(
      `[AlphaJudge] No report_alpha_picks call. stop_reason=${response.stop_reason}`
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
      bull_thesis: string;
      bear_thesis: string;
      source_indexes: number[];
    }>;
    rationale?: string;
  };

  const drafts: AlphaPickDraft[] = [];

  for (const p of input.picks ?? []) {
    // Skip picks the model flagged as below-bar.
    if (!p.conviction || p.conviction < 7) {
      console.log(`[AlphaJudge] skipping ${p.ticker}: conviction=${p.conviction} < 7`);
      continue;
    }
    if (!p.entry_price || p.entry_price <= 0) {
      console.log(`[AlphaJudge] skipping ${p.ticker}: entry_price=${p.entry_price} invalid`);
      continue;
    }
    if (p.target_price <= p.entry_price) {
      console.log(`[AlphaJudge] skipping ${p.ticker}: target_price <= entry_price`);
      continue;
    }
    if (p.stop_loss >= p.entry_price) {
      console.log(`[AlphaJudge] skipping ${p.ticker}: stop_loss >= entry_price`);
      continue;
    }

    // Map source_indexes back to actual Source objects from the FactSheet.
    const candIdx = p.candidate_index ?? 0;
    const factSheet = candidates[candIdx]?.factSheet;
    if (!factSheet) {
      console.log(`[AlphaJudge] skipping ${p.ticker}: bad candidate_index ${candIdx}`);
      continue;
    }

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
      console.log(`[AlphaJudge] skipping ${p.ticker}: only ${resolvedSources.length} valid source(s)`);
      continue;
    }

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
    });

    // Hard cap: 1 pick per run.
    if (drafts.length === 1) break;
  }

  if (input.rationale) {
    console.log(`[AlphaJudge] rationale: ${input.rationale}`);
  }

  const costUSD = estimateCallCostUSD(MODELS.picker, response.usage, 0);

  return { drafts, costUSD, durationMs: Date.now() - t0 };
}
