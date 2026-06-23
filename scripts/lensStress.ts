// Throwaway stress harness for the Lens — run it directly, no UI/server needed:
//   NODE_ENV=development npx tsx --env-file=.env.local scripts/lensStress.ts
//
// Hits REAL marketdata + OpenRouter (costs a few cents). Proves: daily brief
// (Flash) works + is cheap, deep thesis (Pro + reasoning) is genuinely deep and
// multi-source, unpriceable tickers degrade gracefully, and cost stays sane.

import { generateDeepThesis } from "../src/lib/lens/thesis";
import { generateLensBrief } from "../src/lib/lens/generate";
import type { PortfolioRecord } from "../src/lib/portfolio/store";

function rec(name: string, holdings: { ticker: string; shares: number; costBasis?: number }[]): PortfolioRecord {
  return {
    id: "stress-" + name.toLowerCase().replace(/\s+/g, "-"),
    name,
    holdings,
    cash: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

async function main() {
  const p = rec("Growth Tech", [
    { ticker: "NVDA", shares: 10, costBasis: 110 },
    { ticker: "AAPL", shares: 15, costBasis: 180 },
    { ticker: "MSFT", shares: 8, costBasis: 400 },
    { ticker: "AMZN", shares: 12, costBasis: 170 },
    { ticker: "ZZZZINVALID", shares: 5 }, // unpriceable — edge case
  ]);

  console.log("\n========== DAILY BRIEF (DeepSeek V4 Flash) ==========");
  {
    const t0 = Date.now();
    try {
      const { brief, costUSD } = await generateLensBrief(p);
      console.log(`move=${brief.portfolioMovePct}%  $${brief.dayChangeUSD}  cost=$${costUSD.toFixed(5)}  (${Date.now() - t0}ms)`);
      console.log("whatHappened:", brief.whatHappened);
      console.log("why         :", brief.why);
      console.log("whatItMeans :", brief.whatItMeans);
      console.log("holdings    :", brief.holdings.map((h) => `${h.ticker} ${h.changePct ?? "n/a"}% "${h.note}"`).join(" | "));
      console.log("watch       :", brief.watch.map((w) => w.text).join(" | "));
      console.log("unpriced    :", brief.unpriced);
      console.log("flags       :", brief.flagged.map((f) => `${f.id}:${f.status}`).join(" | "));
    } catch (e) {
      console.error("BRIEF FAILED:", e instanceof Error ? e.message : e);
    }
  }

  console.log("\n========== DEEP THESIS (DeepSeek V4 Pro + reasoning) ==========");
  {
    const t1 = Date.now();
    try {
      const { thesis, costUSD } = await generateDeepThesis(p);
      console.log(
        `conviction=${thesis.conviction}  cost=$${costUSD.toFixed(5)}  sources=${thesis.sources.length}  ` +
          `reasoning=${thesis.reasoning ? `${thesis.reasoning.length} chars` : "none"}  (${Date.now() - t1}ms)`
      );
      console.log("\nSUMMARY:\n ", thesis.summary);
      console.log("\nDRIVERS:", thesis.drivers);
      console.log("BULL   :", thesis.bull);
      console.log("BEAR   :", thesis.bear);
      console.log("\nCRUX   :", thesis.crux);
      console.log("\nPER-HOLDING:");
      for (const h of thesis.holdings) {
        console.log(`  ${h.ticker} [${h.weightPct}%]  mom=${h.momentum ?? "—"}  val=${h.valuation ?? "—"}`);
        console.log(`    ${h.read}`);
      }
      console.log("\nSOURCES (depth receipts):");
      for (const s of thesis.sources.slice(0, 24)) console.log(`  [${s.kind}] ${s.label}${s.detail ? ` — ${s.detail}` : ""}`);
      if (thesis.reasoning) console.log("\nREASONING (first 800 chars):\n", thesis.reasoning.slice(0, 800));
    } catch (e) {
      console.error("THESIS FAILED:", e instanceof Error ? e.message : e);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
