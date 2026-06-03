// /api/alpha/maintain
//
// Daily maintenance pass for the Alpha Tracker: re-prices open positions, fires
// stop-loss / target exits, and grades any prediction that resolved (target /
// stop / horizon). It does NOT generate new picks — publishing is a deliberate,
// manually triggered act via /api/alpha/run. This keeps the public stops honest
// without auto-publishing.
//
// Auth: bearer CRON_SECRET (Vercel cron) or ALPHA_RUN_SECRET (manual). Vercel
// Cron invokes the path with a GET and attaches CRON_SECRET as the bearer, so
// we expose GET for the scheduler and POST for manual/scripted calls.

import { NextResponse } from "next/server";
import { runAlphaPipeline } from "@/lib/alphaPipeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

function isAuthorized(req: Request): boolean {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  const alphaSecret = process.env.ALPHA_RUN_SECRET;
  const cronSecret = process.env.CRON_SECRET;
  if (alphaSecret && token === alphaSecret) return true;
  if (cronSecret && token === cronSecret) return true;
  return false;
}

async function handle(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    console.log("[alpha/maintain] starting maintenance run (no new picks)");
    const result = await runAlphaPipeline({ publish: false });
    console.log(
      `[alpha/maintain] done in ${result.durationMs}ms — sells=${result.sells.length} errors=${result.errors.length} cost=$${result.costUSD.toFixed(4)}`
    );
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[alpha/maintain] pipeline threw:", msg);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function GET(req: Request) {
  return handle(req);
}

export async function POST(req: Request) {
  return handle(req);
}
