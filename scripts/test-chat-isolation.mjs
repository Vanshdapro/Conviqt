// Stress test: chat isolation — verifies each query is classified independently
// with no context bleed from previous messages.
//
// Run: node --env-file=.env.local scripts/test-chat-isolation.mjs
// Requires Node 20.6+ for --env-file. Cost: ~0.5¢ per case, < 8¢ total.

import Anthropic from "@anthropic-ai/sdk";

const key = process.env.ANTHROPIC_API_KEY;
if (!key) {
  console.error("No ANTHROPIC_API_KEY in environment. Run with --env-file=.env.local");
  process.exit(1);
}

const client = new Anthropic({ apiKey: key });

// Inline the router's system prompt + tool so this script is self-contained.
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
    type: "object",
    properties: {
      action: { type: "string", enum: ["analyze", "focused", "pick", "general", "reject"] },
      ticker: { type: "string" },
      focus: { type: "string" },
      question: { type: "string" },
      reason: { type: "string" },
    },
    required: ["action"],
  },
};

// Each test case: send ONLY the current query (one message, no history).
// This is exactly what the fixed Chat.tsx does.
const CASES = [
  // ── The exact scenario the user reported ───────────────────────────────
  {
    // CRWV (CoreWeave) went public March 2025; use the ticker directly since
    // the router model may not have post-cutoff company→ticker knowledge.
    query: "analyze CRWV",
    expect: { action: "analyze", ticker: "CRWV" },
    label: "CRWV (CoreWeave) full analysis",
  },
  {
    // This should be NVDA-focused, NOT confused by CRWV context
    query: "what are we expecting in NVDA's earnings?",
    expect: { action: "focused", ticker: "NVDA" },
    label: "NVDA earnings — independent of CRWV",
  },
  {
    // Should be PANW, NOT Nvidia
    query: "tell me about Palo Alto Networks recent earnings",
    expect: { action: "focused", ticker: "PANW" },
    label: "PANW earnings — independent of NVDA",
  },

  // ── Full analyze requests in isolation ─────────────────────────────────
  {
    query: "analyze NVDA",
    expect: { action: "analyze", ticker: "NVDA" },
    label: "NVDA standalone analyze",
  },
  {
    query: "is PANW a buy?",
    expect: { action: "analyze", ticker: "PANW" },
    label: "PANW buy question",
  },
  {
    query: "analyze AAPL",
    expect: { action: "analyze", ticker: "AAPL" },
    label: "AAPL standalone analyze",
  },

  // ── Focused stock questions in isolation ───────────────────────────────
  {
    query: "why is TSLA down today?",
    expect: { action: "focused", ticker: "TSLA" },
    label: "TSLA price question",
  },
  {
    query: "what happened to AAPL after hours?",
    expect: { action: "focused", ticker: "AAPL" },
    label: "AAPL after-hours question",
  },
  {
    query: "what's the setup into earnings for MSFT?",
    expect: { action: "focused", ticker: "MSFT" },
    label: "MSFT earnings setup",
  },

  // ── General questions (no ticker context needed) ────────────────────────
  {
    query: "explain the yield curve inversion and what it means for equities",
    expect: { action: "general" },
    label: "Yield curve — pure general",
  },
  {
    query: "what is a P/E ratio?",
    expect: { action: "general" },
    label: "P/E definition — pure general",
  },
  {
    query: "what is the Fed's current stance and how does it affect tech stocks?",
    expect: { action: "general" },
    label: "Fed policy — general (live macro, no ticker)",
  },

  // ── Edge: same ticker, different intent ────────────────────────────────
  {
    query: "should I sell NVDA?",
    expect: { action: "analyze", ticker: "NVDA" },
    label: "NVDA sell question → analyze",
  },
  {
    query: "will NVDA bounce from here?",
    expect: { action: "focused", ticker: "NVDA" },
    label: "NVDA bounce → focused (not full thesis)",
  },
];

async function classify(query) {
  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 256,
    system: SYSTEM,
    tools: [CLASSIFY_TOOL],
    tool_choice: { type: "tool", name: CLASSIFY_TOOL.name },
    messages: [{ role: "user", content: query }],
  });

  const toolUse = response.content.find(
    (b) => b.type === "tool_use" && b.name === CLASSIFY_TOOL.name
  );
  if (!toolUse || toolUse.type !== "tool_use") return null;
  return toolUse.input;
}

function check(result, expect) {
  if (!result) return "router returned nothing";
  if (result.action !== expect.action)
    return `action: got "${result.action}", want "${expect.action}"`;
  if (expect.ticker) {
    const got = (result.ticker ?? "").toUpperCase();
    const want = expect.ticker.toUpperCase();
    if (got !== want) return `ticker: got "${got}", want "${want}"`;
  }
  return null;
}

let passed = 0;
let failed = 0;
const t0 = Date.now();

console.log(`\nConviqt chat isolation stress test — ${CASES.length} cases\n`);
console.log("Each query is sent as a SINGLE message (no history) — the fixed behavior.\n");
console.log("─".repeat(70));

for (const { query, expect, label } of CASES) {
  const caseStart = Date.now();
  try {
    const result = await classify(query);
    const err = check(result, expect);
    const ms = Date.now() - caseStart;
    if (err) {
      console.log(`FAIL  ${label}`);
      console.log(`      query:  "${query}"`);
      console.log(`      reason: ${err}`);
      console.log(`      got:    ${JSON.stringify(result)}`);
      failed++;
    } else {
      const detail =
        result.ticker
          ? `${result.action}/${result.ticker}`
          : result.action;
      console.log(`PASS  ${label}  (${detail}, ${ms}ms)`);
      passed++;
    }
  } catch (e) {
    console.log(`ERROR ${label} — ${e.message}`);
    failed++;
  }
}

const totalMs = Date.now() - t0;
console.log("─".repeat(70));
console.log(`\n${passed} passed, ${failed} failed in ${(totalMs / 1000).toFixed(1)}s`);

if (failed > 0) process.exit(1);
