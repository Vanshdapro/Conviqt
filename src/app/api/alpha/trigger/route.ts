import { NextResponse } from "next/server";
import { runAlphaPipeline } from "@/lib/alphaPipeline";

// POST /api/alpha/trigger
// Admin "Run Now" endpoint. Calls the pipeline directly (no HTTP round-trip)
// so there's no timeout amplification from self-fetching.
//
// SECURITY: this writes to the PUBLIC prod track record and spends ~$0.35/run,
// so it requires the bearer secret — same gate as /api/alpha/run. A
// NEXT_PUBLIC_ flag only hides a button; it is NOT an access control, so the
// secret check lives here on the server. The admin caller must send
// `Authorization: Bearer <ALPHA_RUN_SECRET>` (or CRON_SECRET).

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

export async function POST(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    console.log("[alpha/trigger] starting pipeline run via admin trigger");
    const result = await runAlphaPipeline();
    console.log(
      `[alpha/trigger] done — sells=${result.sells.length} new_picks=${result.new_picks.length} cost=$${result.costUSD.toFixed(4)}`
    );
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[alpha/trigger] pipeline threw:", msg);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
