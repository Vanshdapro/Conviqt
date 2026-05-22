import Anthropic from "@anthropic-ai/sdk";

// Singleton Anthropic client. Reused across all agents.
// Pulls ANTHROPIC_API_KEY from process.env automatically.

let client: Anthropic | null = null;

// Reads the ANTHROPIC_API_KEY with a dev-mode fallback.
// In Claude Code's desktop environment, the parent shell injects an empty
// ANTHROPIC_API_KEY which shadows what .env.local sets. If we detect an
// empty shell var in development, we parse .env.local directly.
function resolveApiKey(): string {
  const fromEnv = process.env.ANTHROPIC_API_KEY ?? "";
  if (fromEnv.trim()) return fromEnv.trim();

  if (process.env.NODE_ENV === "development") {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const fs = require("fs") as typeof import("fs");
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const path = require("path") as typeof import("path");
      const contents = fs.readFileSync(
        path.resolve(process.cwd(), ".env.local"),
        "utf8"
      );
      const match = contents.match(/^ANTHROPIC_API_KEY=(.+)$/m);
      if (match) return match[1].trim();
    } catch {
      // .env.local missing or unreadable — fall through to the error below
    }
  }

  return fromEnv;
}

export function getAnthropic(): Anthropic {
  if (!client) {
    const apiKey = resolveApiKey();
    if (!apiKey) {
      throw new Error(
        "ANTHROPIC_API_KEY is not set. Add it to .env.local and restart the dev server."
      );
    }
    client = new Anthropic({ apiKey });
  }
  return client;
}

// Model IDs — kept in one place so we can swap them without hunting through agents.
//
// Pricing (as of 2026-05, in USD per million tokens):
//   Haiku 4.5     : $1 in  / $5 out
//   Sonnet 4.6    : $3 in  / $15 out
//   Opus 4.6      : $15 in / $75 out
//
// Web search server tool: $10 / 1000 queries (= $0.01 per search).
//
// Model selection rules (see CLAUDE.md cost targets — hard cap $0.05/query):
// - Intent routing       : haiku  (cheap classification)
// - Sweep (web search)   : haiku  (search is the cost driver, not reasoning)
// - Specialists          : haiku  (constrained to structured tool call, 300 tokens)
// - Judge                : haiku  (cost target forces this; prompt is tight enough)
// - Stock picker         : sonnet (market-wide reasoning, lower frequency)
// - Opus                 : reserved, never default
export const MODELS = {
  router: "claude-haiku-4-5-20251001",
  sweep: "claude-haiku-4-5-20251001",
  specialist: "claude-haiku-4-5-20251001",
  judge: "claude-haiku-4-5-20251001",
  picker: "claude-sonnet-4-6",
  analyst: "claude-sonnet-4-6", // general chat — Sonnet for institutional depth
} as const;

// Per-model unit costs in USD per token. Used by orchestrator to estimate
// the dollar cost of a run and surface it back to the UI.
export const PRICING_PER_TOKEN = {
  "claude-haiku-4-5-20251001": {
    input: 1 / 1_000_000,
    output: 5 / 1_000_000,
  },
  "claude-sonnet-4-6": {
    input: 3 / 1_000_000,
    output: 15 / 1_000_000,
  },
  "claude-opus-4-6": {
    input: 15 / 1_000_000,
    output: 75 / 1_000_000,
  },
} as const;

// Cost per web_search server tool invocation.
export const WEB_SEARCH_COST_USD = 0.01;

// Anthropic-provided web_search server tool definition. This is run on
// Anthropic's side; we never see the raw search HTTP requests. Claude
// invokes it, the API embeds results into the message turn, then Claude
// continues.
//
// Note the tool name + type combo is fixed by the API. Bumping the
// version date string updates the tool variant; we'll bump if Anthropic
// retires the current one.
export const WEB_SEARCH_TOOL = {
  type: "web_search_20250305" as const,
  name: "web_search" as const,
  // 2 searches = $0.02. Each search also returns large content blocks that
  // count as input tokens — the token cost per search can dwarf the $0.01
  // fee itself. Capping at 2 is the single biggest cost lever.
  max_uses: 2,
};

// Analyst gets 3 searches — general questions may require cross-referencing
// multiple live data sources (e.g. macro print + earnings + sector move).
export const ANALYST_WEB_SEARCH_TOOL = {
  type: "web_search_20250305" as const,
  name: "web_search" as const,
  max_uses: 3,
};

// Helper: estimate USD cost of a single Anthropic call given its
// response.usage block and an optional explicit web_search count.
export function estimateCallCostUSD(
  model: keyof typeof PRICING_PER_TOKEN,
  usage: { input_tokens: number; output_tokens: number },
  webSearchCount = 0
): number {
  const price = PRICING_PER_TOKEN[model];
  if (!price) return 0;
  return (
    usage.input_tokens * price.input +
    usage.output_tokens * price.output +
    webSearchCount * WEB_SEARCH_COST_USD
  );
}
