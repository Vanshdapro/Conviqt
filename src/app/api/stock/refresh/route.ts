import { NextResponse } from "next/server";
import { runCouncil } from "@/lib/agents/orchestrator";
import { getStockReportStore, persistStockReport } from "@/lib/stockReports";
import { ensureDailyBudget, recordSpend } from "@/lib/rate-limit";

// POST /api/stock/refresh
//
// Keeps the public /stock/[ticker] pages fresh. Re-runs the Council on the
// STALEST already-published tickers (older than the freshness window) and
// re-persists them, bounded by a per-run batch cap AND the daily budget kill
// switch. We intentionally only refresh tickers that ALREADY have a report —
// per the Deliverable 1 stress test, a ticker's page exists because a user
// queried it, so refreshing the existing set tracks real demand and keeps the
// monthly spend well inside the $100 ceiling.
//
// Auth: bearer token (CRON_SECRET for Vercel cron, or ALPHA_RUN_SECRET for
// manual triggers). Same pattern as /api/alpha/run.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300; // batch of council runs

const FRESHNESS_MS = 24 * 60 * 60 * 1000; // refresh anything older than 24h
const DEFAULT_BATCH = 25; // ~$0.40/run at ~1.5¢/ticker; safely under budget
const PER_TICKER_BUDGET = 0.07; // soft cap per analyze run (CLAUDE.md)

function isAuthorized(req: Request): boolean {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  const cronSecret = process.env.CRON_SECRET;
  const alphaSecret = process.env.ALPHA_RUN_SECRET;
  if (cronSecret && token === cronSecret) return true;
  if (alphaSecret && token === alphaSecret) return true;
  return false;
}

async function handle(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const batch = Math.max(
    1,
    Math.min(100, Number(process.env.STOCK_REFRESH_BATCH) || DEFAULT_BATCH)
  );

  try {
    const store = getStockReportStore();
    const stale = await store.listStale(FRESHNESS_MS, batch);

    const refreshed: string[] = [];
    const failed: Array<{ ticker: string; error: string }> = [];
    let spentUSD = 0;
    let stoppedForBudget = false;

    for (const ticker of stale) {
      // Stop the batch cleanly the moment the daily budget can't cover one
      // more run — don't throw, just report what we managed.
      try {
        ensureDailyBudget(PER_TICKER_BUDGET);
      } catch {
        stoppedForBudget = true;
        break;
      }

      try {
        const result = await runCouncil(ticker);
        await persistStockReport(result);
        recordSpend(result.estCostUSD);
        spentUSD += result.estCostUSD;
        refreshed.push(ticker);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[stock/refresh] ${ticker} failed:`, msg);
        failed.push({ ticker, error: msg });
      }
    }

    console.log(
      `[stock/refresh] done — refreshed=${refreshed.length} failed=${failed.length} spent=$${spentUSD.toFixed(4)} stoppedForBudget=${stoppedForBudget}`
    );

    return NextResponse.json({
      success: true,
      candidates: stale.length,
      refreshed,
      failed,
      spentUSD: Number(spentUSD.toFixed(4)),
      stoppedForBudget,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[stock/refresh] threw:", msg);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

// Vercel Cron invokes the path with a GET (and attaches the CRON_SECRET as a
// bearer token). We also accept POST for manual / scripted triggers.
export const GET = handle;
export const POST = handle;
