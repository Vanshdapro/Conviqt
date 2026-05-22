import { NextResponse } from "next/server";
import { runAlphaPipeline } from "@/lib/alphaPipeline";

// POST /api/alpha/run
// Executes the full Alpha Tracker pipeline: sell checks → picker → sweep → alpha judge → Supabase writes.
// Protected by bearer token (ALPHA_RUN_SECRET env var). Also accepts Vercel's
// CRON_SECRET so the scheduled cron job can call this route directly.
//
// Returns AlphaRunResult JSON.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120; // pipeline can take up to 2 minutes

function isAuthorized(req: Request): boolean {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

  const alphaSecret = process.env.ALPHA_RUN_SECRET;
  const cronSecret = process.env.CRON_SECRET;

  if (alphaSecret && token === alphaSecret) return true;
  if (cronSecret && token === cronSecret) return true;
  return false;
}

export async function POST(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    console.log("[alpha/run] starting pipeline run");
    const result = await runAlphaPipeline();
    console.log(
      `[alpha/run] done in ${result.durationMs}ms — sells=${result.sells.length} new_picks=${result.new_picks.length} errors=${result.errors.length} cost=$${result.costUSD.toFixed(4)}`
    );
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[alpha/run] pipeline threw:", msg);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
