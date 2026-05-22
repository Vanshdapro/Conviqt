import { NextResponse } from "next/server";
import { getSupabaseAnon } from "@/lib/supabase";
import { nextRunDate } from "@/lib/alphaPipeline";

// GET /api/alpha/picks
// Public, no auth required.
// Returns active positions and recently exited picks (last 30 days),
// plus metadata for last_run and next_run dates.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = getSupabaseAnon();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    const [activeRes, recentRes, lastRunRes] = await Promise.all([
      db.from("alpha_picks").select("*").eq("status", "ACTIVE").order("created_at", { ascending: false }),
      db
        .from("alpha_picks")
        .select("*")
        .eq("status", "SOLD")
        .gte("exit_date", thirtyDaysAgo)
        .order("exit_date", { ascending: false }),
      db
        .from("alpha_picks")
        .select("created_at")
        .order("created_at", { ascending: false })
        .limit(1),
    ]);

    if (activeRes.error) throw new Error(activeRes.error.message);
    if (recentRes.error) throw new Error(recentRes.error.message);
    if (lastRunRes.error) throw new Error(lastRunRes.error.message);

    const lastRunRaw = lastRunRes.data?.[0]?.created_at;
    const last_run = lastRunRaw ? lastRunRaw.slice(0, 10) : null;
    const next_run = nextRunDate(new Date());

    return NextResponse.json({
      active: activeRes.data ?? [],
      recently_exited: recentRes.data ?? [],
      last_run,
      next_run,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[alpha/picks] error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
