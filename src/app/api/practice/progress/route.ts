// GET /api/practice/progress
//
// The signed-in user's Practice stats (xp, level, rank, cleared drills, per-drill
// progress) plus their recent AI thesis grades. Used to refresh the dashboard
// after an attempt. Identity comes from the verified session.

import { NextResponse } from "next/server";
import { getVerifiedUser } from "@/lib/auth";
import { getPracticeStats, listThesisFeedback } from "@/lib/practice/store";
import { nextRank } from "@/lib/practice/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getVerifiedUser();
    if (!user) {
      return NextResponse.json({ error: "auth_required" }, { status: 401 });
    }
    const [stats, thesisHistory] = await Promise.all([
      getPracticeStats(user.email),
      listThesisFeedback(user.email, undefined, 12),
    ]);
    return NextResponse.json({ stats, nextRank: nextRank(stats.xp), thesisHistory });
  } catch (err) {
    console.error("[practice] progress route error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
