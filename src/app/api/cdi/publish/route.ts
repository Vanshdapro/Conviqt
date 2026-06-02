import { NextResponse } from "next/server";
import { publishCDISnapshot } from "@/lib/cdi";

// POST|GET /api/cdi/publish
//
// Freezes this week's Conviqt Disagreement Index. Invoked by the weekly Vercel
// cron (GET with the CRON_SECRET bearer) and accepts POST for manual/scripted
// triggers. Costs nothing in Claude credits — the snapshot is composed entirely
// from data already stored (stock_reports + report blobs), so there's no daily
// budget gate here. Same bearer-auth pattern as /api/stock/refresh.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120; // ~20 stored-report reads, no model calls

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

  try {
    const snapshot = await publishCDISnapshot();
    return NextResponse.json({
      success: true,
      weekOf: snapshot.weekOf,
      count: snapshot.entries.length,
      avgDisagreement: snapshot.avgDisagreement,
      peakTicker: snapshot.peakTicker,
      peakDisagreement: snapshot.peakDisagreement,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[cdi/publish] threw:", msg);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
