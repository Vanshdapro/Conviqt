// Quick smoke test for the Anthropic SDK + the two model strings Conviqt uses.
// Run from the project root:
//   node --env-file=.env.local scripts/test-anthropic.mjs
// Requires Node 20.6+ for --env-file.

import Anthropic from "@anthropic-ai/sdk";

const key = process.env.ANTHROPIC_API_KEY;
console.log("ANTHROPIC_API_KEY set:", !!key);
console.log("ANTHROPIC_API_KEY prefix:", key ? key.slice(0, 12) + "..." : "(none)");

if (!key) {
  console.error("\nNo key found. Make sure .env.local lives in the project root and contains ANTHROPIC_API_KEY=...");
  process.exit(1);
}

if (key.includes("...") || key.includes("paste") || key.length < 30) {
  console.error("\nKey looks like a placeholder, not a real key. Replace it with the real value from console.anthropic.com.");
  process.exit(1);
}

const client = new Anthropic({ apiKey: key });

async function probe(label, model) {
  const t0 = Date.now();
  try {
    const r = await client.messages.create({
      model,
      max_tokens: 32,
      messages: [{ role: "user", content: "Reply with just the word: ok" }],
    });
    const text = r.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("");
    console.log(`PASS  ${label}  (${model})  ${Date.now() - t0}ms  ->  ${text.trim()}`);
  } catch (err) {
    console.error(`FAIL  ${label}  (${model})  ${err.status ?? "?"}  ${err.message}`);
  }
}

await probe("specialist (Haiku 4.5)", "claude-haiku-4-5-20251001");
await probe("judge (Sonnet 4.6)", "claude-sonnet-4-6");
