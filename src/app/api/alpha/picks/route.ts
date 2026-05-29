// GET /api/alpha/picks
//
// Requires a verified session. The ACTIVE picks are paid content: they are
// only returned once the user has unlocked the current publication (run_id).
// The recently-exited track record stays visible to any signed-in user — the
// historical record is a trust signal, not gated content.
//
// Response:
//   { active, recently_exited, last_run, next_run, locked }
//   { error: "auth_required" } 401 if not signed in / not verified

import { NextResponse } from "next/server";
import { getAlphaStore } from "@/lib/alphaStore";
import { nextRunDate } from "@/lib/alphaPipeline";
import { getVerifiedUser } from "@/lib/auth";
import { isUnlocked } from "@/lib/alphaUnlock";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getVerifiedUser();
    if (!user) {
      return NextResponse.json({ error: "auth_required" }, { status: 401 });
    }

    const store = getAlphaStore();

    const [active, recently_exited, last_run, publication] = await Promise.all([
      store.fetchActive(),
      store.fetchRecentlySold(30),
      store.lastRunDate(),
      store.currentPublication(),
    ]);

    const unlocked = publication
      ? await isUnlocked(user.email, publication.runId)
      : false;

    return NextResponse.json({
      // Gate the active picks behind the unlock.
      active: unlocked ? active : [],
      recently_exited,
      last_run,
      next_run: nextRunDate(new Date()),
      locked: !unlocked,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[alpha/picks] error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
