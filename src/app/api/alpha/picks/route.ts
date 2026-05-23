import { NextResponse } from "next/server";
import { getAlphaStore } from "@/lib/alphaStore";
import { nextRunDate } from "@/lib/alphaPipeline";

// GET /api/alpha/picks
// Public, no auth required.
// Returns active positions and recently exited picks (last 30 days),
// plus metadata for last_run and next_run dates.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const store = getAlphaStore();

    const [active, recently_exited, last_run] = await Promise.all([
      store.fetchActive(),
      store.fetchRecentlySold(30),
      store.lastRunDate(),
    ]);

    return NextResponse.json({
      active,
      recently_exited,
      last_run,
      next_run: nextRunDate(new Date()),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[alpha/picks] error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
