#!/usr/bin/env npx tsx
// Standalone CLI wrapper around runCouncil for the reel pipeline.
// Bypasses HTTP/auth — calls the Council directly with the local API key.
//
// Usage:
//   npx tsx scripts/council-reel.ts NVDA
//   npx tsx scripts/council-reel.ts TSLA datacenter demand
//
// JSON result → stdout. Progress logs → stderr. Exits 1 on failure.

import { readFileSync } from "fs";
import { resolve } from "path";
import { runCouncil } from "../src/lib/agents/orchestrator";
import type { CouncilResult } from "../src/lib/agents/types";

function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    try {
      const raw = readFileSync(resolve(__dirname, "..", file), "utf8");
      for (const line of raw.split("\n")) {
        const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
        if (m && !process.env[m[1]]) {
          process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
        }
      }
    } catch {
      // file absent
    }
  }
}

function toReelResult(r: CouncilResult) {
  return {
    runId: r.runId,
    ticker: r.ticker,
    asOf: r.asOf,
    cached: r.cached ?? false,
    company: {
      name: r.factSheet.companyName,
      sector: r.factSheet.sector,
      assetType: r.factSheet.assetType,
    },
    verdict: r.judge.verdict,
    conviction: r.judge.conviction,
    disagreement: r.judge.disagreement,
    investmentCase: r.judge.investmentCase,
    bullCase: r.judge.bullCase,
    bearCase: r.judge.bearCase,
    bottomLine: r.judge.bottomLine,
    catalysts: r.judge.catalysts,
    keyMetrics: r.judge.keyMetrics,
    dissents: r.judge.dissents,
    specialists: r.agents.map((a) => ({
      agent: a.agent,
      verdict: a.verdict,
      confidence: a.confidence,
      reasoning: a.reasoning,
      flags: a.flags,
    })),
    warnings: r.warnings,
    estCostUSD: r.estCostUSD,
    totalDurationMs: r.totalDurationMs,
  };
}

(async () => {
  loadEnv();

  const [, , rawTicker, ...focusParts] = process.argv;
  if (!rawTicker) {
    process.stderr.write("Usage: npx tsx scripts/council-reel.ts <TICKER> [focus...]\n");
    process.exit(1);
  }

  const ticker = rawTicker.trim().toUpperCase();
  const focus = focusParts.join(" ").trim() || undefined;

  try {
    // Redirect console.log → stderr so Council progress logs don't pollute
    // the JSON we write to stdout. The caller parses stdout as JSON.
    console.log = (...args: unknown[]) => process.stderr.write(args.join(" ") + "\n");

    process.stderr.write(`[council-reel] Running Council for ${ticker}${focus ? ` (focus: ${focus})` : ""}...\n`);
    const result = await runCouncil(ticker, { focus });
    process.stderr.write(
      `[council-reel] Done — ${result.judge.verdict}/${result.judge.conviction} disagreement=${result.judge.disagreement} cost=$${result.estCostUSD}\n`
    );
    process.stdout.write(JSON.stringify(toReelResult(result)));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`[council-reel] Failed: ${msg}\n`);
    process.stdout.write(JSON.stringify({ error: msg }));
    process.exit(1);
  }
})();
