import { getAnthropic, MODELS, estimateCallCostUSD } from "../anthropic";

// Cheap intent classifier. Decides whether a user message is asking to:
// - analyze a specific ticker (and extracts it + an optional focus)
// - generate stock picks
// - ask a general finance / methodology question
//
// Uses Haiku + forced tool_use. Cost target: under 0.5 cents per call.
//
// Tightened ticker regex: 1-5 uppercase letters with optional .A/.B share
// class suffix. Rejects garbage like "..", "---", "A.B.C" that the loose
// /^[A-Z.-]{1,8}$/ used to accept (fix #6 from stress test).

const TICKER_RE = /^[A-Z]{1,5}(\.[A-Z])?$/;

// Used to defend the "general" handler from hallucinating live prices.
// If a user asks "what's AAPL trading at" the router will see the ticker
// pattern + price-word and force the analyze path so we never ship a
// fabricated number.
const PRICE_WORD_RE =
  /\b(price|priced|quote|trading at|trades at|last|level|target|move|moves|moving|movement|drop|drops|dropped|fall|fell|gain|gained|rally|rallied|spike|crashed|hit|broke|breakout|breakdown|levels?|all-time high|ath|52-week|52w)\b/i;
const TICKER_PATTERN_RE = /\b[A-Z]{1,5}\b/;

export type RouterIntent =
  | { action: "analyze"; ticker: string; focus?: string }
  | { action: "focused"; ticker: string; question: string }
  | { action: "pick" }
  | { action: "general"; reason: string }
  | { action: "reject"; reason: string };

const SYSTEM = `You are the intent router for Conviqt, an equity research chatbot.

Classify the user's most recent message into one of five actions:

1. analyze — the user wants a FULL investment thesis on a specific US-listed stock: BUY/HOLD/SELL verdict, conviction score, bear/bull case. Triggered by: "analyze X", "is X a buy?", "should I buy/sell X?", "give me a full breakdown on X", "what's your take on X as an investment?".

2. focused — the user has a SPECIFIC question about a stock that does NOT need a full investment thesis. Examples: "what are we expecting in NVDA's earnings?", "is Adobe going to bounce back?", "why is TSLA down today?", "what's the setup into earnings for MSFT?", "what happened to AAPL after hours?". Extract the ticker AND preserve the user's question exactly (question field).

3. pick — the user wants Conviqt to suggest stocks worth analyzing. Phrases: "pick me a stock", "what should I look at", "any ideas", "find me a setup".

4. general — finance questions or Conviqt methodology questions that need no stock data. Definitions, how the Council works, follow-up clarifications on methodology. NEVER use general if the user mentions a specific ticker with a live data need.

5. reject — off-topic (jokes, harassment, personal info, incomprehensible). Or ticker can't resolve to a US-listed symbol.

Key distinction: "analyze NVDA" → analyze. "what are we expecting in NVDA's earnings?" → focused. "is NVDA a buy?" → analyze. "will NVDA bounce?" → focused.

For analyze and focused, the ticker MUST be a valid US-listed symbol (1-5 uppercase letters, optional .A/.B). Never invent a ticker.

Output via the classify_intent tool.`;

const CLASSIFY_TOOL = {
  name: "classify_intent",
  description: "Classify the user's most recent message.",
  input_schema: {
    type: "object" as const,
    properties: {
      action: {
        type: "string",
        enum: ["analyze", "focused", "pick", "general", "reject"],
      },
      ticker: {
        type: "string",
        description:
          "Required for action='analyze' or 'focused'. Uppercase US ticker, 1-5 letters with optional .A/.B suffix.",
      },
      focus: {
        type: "string",
        description:
          "Optional analytical focus for action='analyze' only. Short phrase, max 200 chars.",
      },
      question: {
        type: "string",
        description:
          "Required for action='focused'. The user's specific question verbatim (max 300 chars).",
      },
      reason: {
        type: "string",
        description:
          "Short justification for action='general' or action='reject'. Empty for analyze/focused/pick.",
      },
    },
    required: ["action"],
  },
};

export interface RouterResult {
  intent: RouterIntent;
  costUSD: number;
  durationMs: number;
}

export interface RouterMessage {
  role: "user" | "assistant";
  content: string;
}

// Pre-route guard: if the latest user message looks like a live-price
// question about a recognizable ticker pattern, we force "analyze" before
// the model even sees it. This is the second line of defense behind the
// system prompt — fix #8 from the stress test.
function preroutePriceQuestion(latest: string): RouterIntent | null {
  if (!PRICE_WORD_RE.test(latest)) return null;
  const tickerMatches = latest.match(/\b[A-Z]{1,5}\b/g);
  if (!tickerMatches) return null;
  // Filter out common English ALL-CAPS words and obvious noise.
  const NOISE = new Set([
    "I",
    "A",
    "AN",
    "THE",
    "AI",
    "ETF",
    "IPO",
    "EPS",
    "CEO",
    "CFO",
    "GDP",
    "CPI",
    "USD",
    "FED",
    "PE",
    "ATH",
  ]);
  const candidates = tickerMatches.filter(
    (t) => TICKER_RE.test(t) && !NOISE.has(t)
  );
  if (candidates.length !== 1) return null;
  // Route to focused, not analyze. The user asked a specific live-data
  // question — the focused pipeline (sweep + focusedJudge) gets them the
  // answer without burning 4 specialist agents + a full judge on a question
  // that doesn't need a BUY/HOLD/SELL thesis.
  return { action: "focused", ticker: candidates[0], question: latest };
}

export async function classifyIntent(
  messages: RouterMessage[]
): Promise<RouterResult> {
  const t0 = Date.now();
  if (messages.length === 0) {
    return {
      intent: { action: "reject", reason: "Empty conversation." },
      costUSD: 0,
      durationMs: 0,
    };
  }

  // Deterministic pre-route for "what's AAPL at?" style questions.
  const lastUser =
    [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
  const forced = preroutePriceQuestion(lastUser);
  if (forced) {
    return { intent: forced, costUSD: 0, durationMs: Date.now() - t0 };
  }

  const anthropic = getAnthropic();
  const response = await anthropic.messages.create({
    model: MODELS.router,
    max_tokens: 256,
    system: SYSTEM,
    tools: [CLASSIFY_TOOL],
    tool_choice: { type: "tool", name: CLASSIFY_TOOL.name },
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
  });

  const toolUse = response.content.find(
    (b) => b.type === "tool_use" && b.name === CLASSIFY_TOOL.name
  );
  if (!toolUse || toolUse.type !== "tool_use") {
    return {
      intent: { action: "reject", reason: "Router did not classify." },
      costUSD: estimateCallCostUSD(MODELS.router, response.usage),
      durationMs: Date.now() - t0,
    };
  }

  const input = toolUse.input as {
    action: "analyze" | "focused" | "pick" | "general" | "reject";
    ticker?: string;
    focus?: string;
    question?: string;
    reason?: string;
  };

  const costUSD = estimateCallCostUSD(MODELS.router, response.usage);
  const durationMs = Date.now() - t0;

  if (input.action === "analyze") {
    const ticker = (input.ticker ?? "").trim().toUpperCase();
    if (!TICKER_RE.test(ticker)) {
      return {
        intent: {
          action: "reject",
          reason: `Could not resolve a US-listed ticker from the message.`,
        },
        costUSD,
        durationMs,
      };
    }
    const focus = input.focus?.trim().slice(0, 200);
    return {
      intent: focus
        ? { action: "analyze", ticker, focus }
        : { action: "analyze", ticker },
      costUSD,
      durationMs,
    };
  }

  if (input.action === "focused") {
    const ticker = (input.ticker ?? "").trim().toUpperCase();
    if (!TICKER_RE.test(ticker)) {
      return {
        intent: {
          action: "reject",
          reason: `Could not resolve a US-listed ticker from the message.`,
        },
        costUSD,
        durationMs,
      };
    }
    // Fall back to a sensible question if the model didn't populate the field.
    const question = (input.question ?? input.focus ?? `What's the current situation with ${ticker}?`).trim().slice(0, 300);
    return {
      intent: { action: "focused", ticker, question },
      costUSD,
      durationMs,
    };
  }

  if (input.action === "pick") {
    return { intent: { action: "pick" }, costUSD, durationMs };
  }

  if (input.action === "general") {
    return {
      intent: { action: "general", reason: input.reason ?? "" },
      costUSD,
      durationMs,
    };
  }

  return {
    intent: { action: "reject", reason: input.reason ?? "Off-topic." },
    costUSD,
    durationMs,
  };
}

// Export ticker regex so other files (analyze route, picker) can stay in
// sync without duplicating the source of truth.
export const VALID_TICKER_RE = TICKER_RE;

// Sanitize a possibly-hallucinated free-text response to strip obvious
// dollar-quoted prices / multiples. Used by the chat general handler as
// a final safety net against price hallucinations.
export function stripLiveNumerics(text: string): {
  text: string;
  redactedCount: number;
} {
  let count = 0;
  const cleaned = text.replace(
    /\$\d[\d,.]*|(?<![A-Z])\d{1,4}(?:[.,]\d+)?\s?(?:x|×|%|bps|bp)\b/gi,
    (m) => {
      count += 1;
      return "[number redacted — ask 'analyze TICKER' for cited figures]";
    }
  );
  return { text: cleaned, redactedCount: count };
}
