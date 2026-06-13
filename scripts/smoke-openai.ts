// Live smoke test for the OpenAI adapter. Exercises the three hardest paths
// the agents depend on. Run: NODE_ENV=development npx tsx scripts/smoke-openai.ts
import { getOpenAI, MODELS, WEB_SEARCH_TOOL, estimateCallCostUSD } from "../src/lib/openai";

const ai = getOpenAI();

async function testForcedTool() {
  console.log("\n=== 1. Forced function/tool call (specialist/judge path) ===");
  const TOOL = {
    name: "report_verdict",
    description: "Report a verdict.",
    input_schema: {
      type: "object" as const,
      properties: {
        verdict: { type: "string", enum: ["BUY", "HOLD", "SELL"] },
        confidence: { type: "number" },
        reasoning: { type: "string" },
      },
      required: ["verdict", "confidence", "reasoning"],
    },
  };
  const res = await ai.messages.create({
    model: MODELS.specialist,
    max_tokens: 200,
    system: [{ type: "text", text: "You are a terse equity analyst.", cache_control: { type: "ephemeral" } }],
    tools: [TOOL],
    tool_choice: { type: "tool", name: TOOL.name },
    messages: [{ role: "user", content: "Give a verdict on a fictional cash-rich profitable company. Use the tool." }],
  });
  const tool = res.content.find((b) => b.type === "tool_use");
  console.log("stop_reason:", res.stop_reason);
  console.log("tool_use found:", !!tool, "name:", tool?.name);
  console.log("parsed input:", JSON.stringify(tool?.input));
  console.log("usage:", JSON.stringify(res.usage));
  console.log("cost: $" + estimateCallCostUSD(MODELS.specialist, res.usage).toFixed(5));
  if (!tool || !tool.input) throw new Error("FAIL: no tool_use returned");
}

async function testWebSearchPlusTool() {
  console.log("\n=== 2. web_search + structured tool (sweep/headline path) ===");
  const TOOL = {
    name: "report",
    description: "Report findings with sources.",
    input_schema: {
      type: "object" as const,
      properties: {
        summary: { type: "string" },
        sources: {
          type: "array",
          items: { type: "object", properties: { url: { type: "string" }, title: { type: "string" } } },
        },
      },
      required: ["summary", "sources"],
    },
  };
  const res = await ai.messages.create({
    model: MODELS.sweep,
    max_tokens: 1200,
    system: [{ type: "text", text: "You research markets. Search the web, then call the report tool with what you found and the source URLs.", cache_control: { type: "ephemeral" } }],
    tools: [WEB_SEARCH_TOOL, TOOL],
    messages: [{ role: "user", content: "What is the latest news about the S&P 500 today? Search, then call report." }],
  });
  const serverUse = res.content.filter((b) => b.type === "server_tool_use");
  const wsResult = res.content.find((b) => b.type === "web_search_tool_result");
  const tool = res.content.find((b) => b.type === "tool_use");
  const canonical = Array.isArray(wsResult?.content) ? (wsResult!.content as unknown[]) : [];
  console.log("stop_reason:", res.stop_reason);
  console.log("server_tool_use (searches):", serverUse.length, "queries:", serverUse.map((b) => (b.input as { query?: string })?.query));
  console.log("web_search_tool_result block present:", !!wsResult, "canonical URLs:", canonical.length);
  console.log("sample canonical:", JSON.stringify(canonical.slice(0, 2)));
  console.log("report tool_use found:", !!tool);
  console.log("usage:", JSON.stringify(res.usage));
  console.log("cost: $" + estimateCallCostUSD(MODELS.sweep, res.usage, serverUse.length).toFixed(5));
  if (canonical.length === 0) throw new Error("FAIL: no canonical web_search URLs (provenance would break)");
}

async function testStreaming() {
  console.log("\n=== 3. Streaming (analyst path) ===");
  let chunks = 0;
  let text = "";
  const stream = ai.messages.stream({
    model: MODELS.analyst,
    max_tokens: 120,
    system: [{ type: "text", text: "You are a terse finance tutor.", cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: "In two sentences, what is the yield curve?" }],
  });
  stream.on("text", (t) => {
    chunks++;
    text += t;
  });
  const final = await stream.finalMessage();
  console.log("delta chunks received:", chunks);
  console.log("text length:", text.length, "| matches final:", text.trim().length > 0);
  console.log("usage:", JSON.stringify(final.usage));
  console.log("first 120 chars:", text.slice(0, 120));
  if (chunks === 0 || text.length === 0) throw new Error("FAIL: no streamed text");
}

(async () => {
  try {
    await testForcedTool();
    await testWebSearchPlusTool();
    await testStreaming();
    console.log("\n✅ ALL SMOKE TESTS PASSED");
  } catch (e) {
    console.error("\n❌ SMOKE TEST FAILED:", e instanceof Error ? e.message : e);
    process.exit(1);
  }
})();
