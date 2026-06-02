// The editorial layer of the weekly Disagreement Digest (Deliverable 6).
//
// The Council already ran on these tickers — we are CURATING, not re-analysing.
// This module takes the week's most-contested stored reports and produces:
//   - intro: a 2-3 sentence editorial framing of what the panel fought over
//   - per-ticker `dissent`: one punchy sentence on the crux of the split
//
// Cost: ONE Haiku call, no web_search. Inputs are the already-written bull/bear
// cases (a few hundred tokens each), output is a few hundred tokens → well under
// 1¢/week, vs. the deliverable's ~10¢ estimate. No new market data is fetched,
// so the citation rule is satisfied by the underlying report (the email links
// to the full analysis where every number carries its source URL).
//
// Hard rule (CLAUDE.md "no synthetic data"): the `dissent` line is QUALITATIVE
// framing of an existing verdict, never a new quantitative claim. If the Haiku
// call fails, we fall back to the report's own bearCase — real data from the
// report, not fabricated — so the digest still ships.

import { getAnthropic, MODELS, estimateCallCostUSD } from "./anthropic";
import type { StoredReport } from "./stockReports";

export interface DigestEntry {
  ticker: string;
  companyName: string;
  verdict: "BUY" | "HOLD" | "SELL";
  conviction: number; // 0-100
  disagreement: number; // 0-100
  dissent: string; // the crux of why the Council split — one sentence
}

export interface DigestContent {
  intro: string;
  entries: DigestEntry[];
  costUSD: number;
  generatedBy: "claude" | "fallback";
}

// First sentence of the bear case — the deterministic fallback "point of
// dissent" when the editorial call is unavailable.
function bearCaseDissent(report: StoredReport): string {
  const bear = report.report.judge.bearCase?.trim();
  if (!bear) {
    return `The panel split ${report.disagreement}% on ${report.companyName}.`;
  }
  const firstSentence = bear.split(/(?<=[.!?])\s+/)[0]?.trim();
  return firstSentence || bear.slice(0, 180);
}

function fallbackContent(reports: StoredReport[]): DigestContent {
  return {
    intro:
      "The Council fractured hardest on these five names this week. Each carries a live verdict the panel could not reach consensus on — the disagreement is the signal.",
    entries: reports.map((r) => ({
      ticker: r.ticker,
      companyName: r.companyName,
      verdict: r.verdict,
      conviction: r.conviction,
      disagreement: r.disagreement,
      dissent: bearCaseDissent(r),
    })),
    costUSD: 0,
    generatedBy: "fallback",
  };
}

const SYSTEM = `You are the editor of Conviqt's weekly "Disagreement Digest" — a free newsletter that surfaces the five stocks Conviqt's AI research council split on hardest this week.

Conviqt runs a panel of AI analysts (Fundamentals, Technicals, Sentiment, Macro) on each ticker. A high disagreement score means the panel did NOT reach consensus — that tension is the product. You are NOT making buy/sell recommendations; you are reporting where smart, independent analysts diverge.

VOICE
- Sharp, literate, market-aware — Morning Brew meets an institutional desk note. Active retail investors and junior analysts read this. Never condescend.
- No hype, no "to the moon", no price targets, no guarantees. You report disagreement, not alpha.
- Never invent numbers. Use ONLY the conviction/disagreement scores and the bull/bear context provided. If you want a figure you weren't given, leave it out.

WHAT TO WRITE
- intro: 2-3 sentences framing the week. What's the through-line in what the panel fought over? Make the reader want to click. Do not list the tickers mechanically.
- For each stock, a "dissent" line: ONE punchy sentence (max ~28 words) naming the crux of the split — the specific thing the bulls and bears can't reconcile. Concrete, not generic. Lead with the tension, not the ticker.

Output via write_digest.`;

interface DigestToolInput {
  intro: string;
  items: Array<{ ticker: string; dissent: string }>;
}

const DIGEST_TOOL = {
  name: "write_digest",
  description: "Write the editorial intro and the per-stock dissent lines for this week's Disagreement Digest.",
  input_schema: {
    type: "object" as const,
    properties: {
      intro: {
        type: "string",
        description: "2-3 sentence editorial framing of the week's disagreement. No ticker list.",
      },
      items: {
        type: "array",
        description: "One entry per stock, in the order given.",
        items: {
          type: "object",
          properties: {
            ticker: { type: "string", description: "The ticker symbol, echoed back exactly." },
            dissent: {
              type: "string",
              description: "ONE sentence (≤28 words) on the crux of the split for this stock. Concrete, no invented numbers.",
            },
          },
          required: ["ticker", "dissent"],
        },
      },
    },
    required: ["intro", "items"],
  },
};

function renderReportBrief(reports: StoredReport[]): string {
  return reports
    .map((r, i) => {
      const j = r.report.judge;
      return `${i + 1}. ${r.ticker} — ${r.companyName}
   Verdict: ${r.verdict} · conviction ${r.conviction}/100 · disagreement ${r.disagreement}/100
   Dissenting lanes: ${j.dissents?.length ? j.dissents.join(", ") : "(none recorded)"}
   Bull case: ${(j.bullCase || "").trim() || "(none)"}
   Bear case: ${(j.bearCase || "").trim() || "(none)"}
   Bottom line: ${(j.bottomLine || "").trim() || "(none)"}`;
    })
    .join("\n\n");
}

// Build the digest editorial. Never throws — on any failure it returns the
// deterministic fallback so the weekly send still goes out.
export async function buildDigestContent(
  reports: StoredReport[]
): Promise<DigestContent> {
  if (reports.length === 0) {
    return { intro: "", entries: [], costUSD: 0, generatedBy: "fallback" };
  }

  try {
    const anthropic = getAnthropic();
    const response = await anthropic.messages.create({
      model: MODELS.judge, // Haiku — cheap, this is light summarization
      max_tokens: 900,
      system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
      tools: [DIGEST_TOOL],
      tool_choice: { type: "tool", name: DIGEST_TOOL.name },
      messages: [
        {
          role: "user",
          content: `This week's five most-contested reports (already analysed by the Council):\n\n${renderReportBrief(
            reports
          )}\n\nWrite the digest now. Keep every dissent line grounded in the bull/bear context above — do not introduce numbers you weren't given.`,
        },
      ],
    });

    const toolUse = response.content.find(
      (b) => b.type === "tool_use" && b.name === DIGEST_TOOL.name
    );
    if (!toolUse || toolUse.type !== "tool_use") {
      console.warn("[newsletterDigest] no tool_use in response — using fallback");
      return fallbackContent(reports);
    }

    const input = toolUse.input as DigestToolInput;
    const dissentByTicker = new Map(
      (input.items ?? []).map((it) => [it.ticker.toUpperCase().trim(), (it.dissent ?? "").trim()])
    );

    const entries: DigestEntry[] = reports.map((r) => {
      const written = dissentByTicker.get(r.ticker.toUpperCase());
      return {
        ticker: r.ticker,
        companyName: r.companyName,
        verdict: r.verdict,
        conviction: r.conviction,
        disagreement: r.disagreement,
        // Per-stock fallback: if the model skipped a ticker, use its bearCase.
        dissent: written || bearCaseDissent(r),
      };
    });

    const costUSD = estimateCallCostUSD(MODELS.judge, response.usage);
    const intro = (input.intro ?? "").trim() || fallbackContent(reports).intro;
    console.log(
      `[newsletterDigest] generated for ${reports.length} tickers, est $${costUSD.toFixed(4)}`
    );
    return { intro, entries, costUSD, generatedBy: "claude" };
  } catch (err) {
    console.error(
      "[newsletterDigest] Claude call failed, using fallback:",
      err instanceof Error ? err.message : err
    );
    return fallbackContent(reports);
  }
}
