import { NextResponse } from "next/server";
import { generateMarketMap, PER_MAP_BUDGET_USD } from "@/lib/map/generate";
import { writeMarketMap } from "@/lib/map/store";
import { getFeedStore } from "@/lib/feed/store";
import { ensureDailyBudget, recordSpend } from "@/lib/rate-limit";

// POST /api/map/refresh
//
// Recomputes the deterministic market map and (best-effort) its plain-English
// narrative, then writes the combined payload to the rolling feed_cache row
// "feed:map". Part of the same 2×/day (pre-US-open, post-close) feed refresh as
// Dashboard + Headlines; triggered by the GitHub Actions workflow, NOT a Vercel
// cron (the project is on Hobby, whose crons fire at most once a day).
//
// Cost: the deterministic map is free (price history only); the narrative is one
// MODELS.lens (DeepSeek V4 Flash, NO web_search) call, ≈1–3¢. We log the
// measured dollar cost on every run; a breach of the soft cap is logged as
// 'over_budget' so it surfaces before the monthly bill does.
//
// Auth: bearer CRON_SECRET (or ALPHA_RUN_SECRET for manual pokes) — same
// pattern as /api/feed/refresh.

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

export async function POST(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Wallet guard: refuse to start if the daily kill switch is already blown.
    ensureDailyBudget(PER_MAP_BUDGET_USD);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[map] refresh refused: ${message}`);
    return NextResponse.json({ error: message }, { status: 429 });
  }

  const store = getFeedStore();
  const started = Date.now();
  try {
    const { map, costUSD } = await generateMarketMap();
    await writeMarketMap(map);
    recordSpend(costUSD);

    const status = costUSD > PER_MAP_BUDGET_USD ? "over_budget" : "ok";
    await store.logRun({
      kind: "dashboard", // feed_refresh_runs kind union is dashboard|headlines; map rides the dashboard ledger
      status,
      costUSD,
      webSearches: 0,
      durationMs: Date.now() - started,
      meta: {
        surface: "map",
        narrative: map.narrative != null,
        leaders: map.data.leaders.length,
        laggards: map.data.laggards.length,
        unpriced: map.data.unpriced.length,
      },
    });

    console.log(
      `[map] refresh status=${status} cost=$${costUSD.toFixed(4)} ` +
        `narrative=${map.narrative != null} duration=${Date.now() - started}ms`
    );

    return NextResponse.json(
      { ok: true, costUSD, generatedAt: map.generatedAt, narrative: map.narrative != null },
      { status: 200 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[map] refresh failed: ${message}`);
    await store
      .logRun({
        kind: "dashboard",
        status: "error",
        costUSD: 0,
        webSearches: 0,
        durationMs: Date.now() - started,
        error: message,
        meta: { surface: "map" },
      })
      .catch(() => {});
    return NextResponse.json({ ok: false, error: "Failed to refresh the market map." }, { status: 500 });
  }
}
