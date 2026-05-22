import { NextResponse } from "next/server";
import { runAlphaPipeline } from "@/lib/alphaPipeline";

// POST /api/alpha/trigger
// Admin "Run Now" button endpoint. Calls the pipeline directly (no HTTP
// round-trip) so there's no timeout amplification from self-fetching.
//
// The endpoint is intentionally open — no session auth is implemented in
// this codebase yet. Security comes from: (a) the button only renders when
// NEXT_PUBLIC_ALPHA_ADMIN_ENABLED=true, and (b) a malicious trigger call
// costs at most ~$0.35 and the pipeline is idempotent per run_id.
//
// If you need harder auth: move the ALPHA_RUN_SECRET check here and expose
// NEXT_PUBLIC_ALPHA_ADMIN_ENABLED only when the secret is known to the admin.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST() {
  try {
    console.log("[alpha/trigger] starting pipeline run via admin button");
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
