import { NextResponse } from "next/server";
import {
  generateDashboard,
  generateHeadlines,
  PER_REFRESH_BUDGET_USD,
} from "@/lib/feed/generate";
import { getFeedStore, DASHBOARD_KEY, headlinesKey } from "@/lib/feed/store";
import { ensureDailyBudget, recordSpend } from "@/lib/rate-limit";

// POST /api/feed/refresh?part=dashboard|headlines|all
//
// The 2×/day (pre-US-open, post-close) refresh of the globally cached
// Dashboard + Headlines content. NOT a Vercel cron: the project is on the
// Hobby plan, whose crons fire at most once a day — shipping one would
// silently never run twice (playbook Phase 4 explicitly forbids that). The
// trigger is the GitHub Actions workflow .github/workflows/feed-refresh.yml,
// which calls each part separately so one slow part can't starve the other.
//
// Cost: every run writes a feed_refresh_runs ledger row with the measured
// dollar cost. Budget ≤ $0.35/run all-in; a breach is logged as
// 'over_budget' so it shows up before the monthly bill does.
//
// Auth: bearer CRON_SECRET (or ALPHA_RUN_SECRET for manual pokes) — same
// pattern as /api/stock/refresh.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function isAuthorized(req: Request): boolean {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  const cronSecret = process.env.CRON_SECRET;
  const alphaSecret = process.env.ALPHA_RUN_SECRET;
  if (cronSecret && token === cronSecret) return true;
  if (alphaSecret && token === alphaSecret) return true;
  return false;
}

interface PartReport {
  status: "ok" | "error" | "over_budget";
  costUSD: number;
  webSearches: number;
  durationMs: number;
  error?: string;
  meta?: Record<string, unknown>;
}

async function refreshDashboard(): Promise<PartReport> {
  const store = getFeedStore();
  const started = Date.now();
  try {
    const { content, costUSD, webSearches } = await generateDashboard();
    await store.set(DASHBOARD_KEY, content);
    const status = costUSD > PER_REFRESH_BUDGET_USD ? "over_budget" : "ok";
    const report: PartReport = {
      status,
      costUSD,
      webSearches,
      durationMs: Date.now() - started,
      meta: { trends: content.trends.length, signals: content.signals.length, events: content.events.length },
    };
    await store.logRun({ kind: "dashboard", ...report });
    return report;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const report: PartReport = {
      status: "error",
      costUSD: 0,
      webSearches: 0,
      durationMs: Date.now() - started,
      error: message,
    };
    await store.logRun({ kind: "dashboard", ...report });
    return report;
  }
}

async function refreshHeadlines(): Promise<PartReport> {
  const store = getFeedStore();
  const started = Date.now();
  try {
    const { regions, skipped, costUSD } = await generateHeadlines();
    // Rolling cache: each region row is overwritten in place. Regions that
    // gathered nothing are skipped so the previous edition (with its honest
    // timestamp) survives a flaky wire.
    for (const region of regions) {
      await store.set(headlinesKey(region.region), region);
    }
    const status = costUSD > PER_REFRESH_BUDGET_USD ? "over_budget" : "ok";
    const report: PartReport = {
      status,
      costUSD,
      webSearches: 0,
      durationMs: Date.now() - started,
      meta: { written: regions.map((r) => r.region), skipped },
    };
    await store.logRun({ kind: "headlines", ...report });
    return report;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const report: PartReport = {
      status: "error",
      costUSD: 0,
      webSearches: 0,
      durationMs: Date.now() - started,
      error: message,
    };
    await store.logRun({ kind: "headlines", ...report });
    return report;
  }
}

export async function POST(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const part = new URL(req.url).searchParams.get("part") ?? "all";
  if (!["dashboard", "headlines", "all"].includes(part)) {
    return NextResponse.json({ error: `Unknown part "${part}"` }, { status: 400 });
  }

  try {
    // Wallet guard: refuse to start if the daily kill switch is already blown.
    ensureDailyBudget(PER_REFRESH_BUDGET_USD);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[feed] refresh refused: ${message}`);
    return NextResponse.json({ error: message }, { status: 429 });
  }

  const reports: Record<string, PartReport> = {};
  if (part === "dashboard" || part === "all") {
    reports.dashboard = await refreshDashboard();
  }
  if (part === "headlines" || part === "all") {
    reports.headlines = await refreshHeadlines();
  }

  const totalCost = Object.values(reports).reduce((s, r) => s + r.costUSD, 0);
  recordSpend(totalCost);
  console.log(
    `[feed] refresh part=${part} total=$${totalCost.toFixed(4)} ` +
      Object.entries(reports)
        .map(([k, r]) => `${k}=${r.status}`)
        .join(" ")
  );

  const failed = Object.values(reports).some((r) => r.status === "error");
  return NextResponse.json({ part, totalCostUSD: totalCost, reports }, { status: failed ? 500 : 200 });
}
