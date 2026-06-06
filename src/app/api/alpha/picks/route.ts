// GET /api/alpha/picks
//
// Requires a verified session. The ACTIVE picks are paid content: they are
// only returned once the user has unlocked the current publication (run_id).
// The recently-exited track record stays visible to any signed-in user — the
// historical record is a trust signal, not gated content.
//
// Response:
//   { active, recently_exited, last_run, next_run, locked, aggregate }
//   { error: "auth_required" } 401 if not signed in / not verified

import { NextResponse } from "next/server";
import { getAlphaStore } from "@/lib/alphaStore";
import { nextRunDate } from "@/lib/alphaPipeline";
import { getVerifiedUser } from "@/lib/auth";
import { isUnlocked } from "@/lib/alphaUnlock";
import type { AlphaAggregate, AlphaPick } from "@/lib/alphaTypes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Equal-weighted average return across the full published book. Active picks
// contribute their unrealized mark (price_change_pct); closed (SOLD) picks
// contribute their realized exit return. Deliberately simple — one mean plus a
// winners/losers split — so a visitor can read "what has the average pick done"
// at a glance. Computed from the ungated position set so it survives the unlock
// gate (only these blended numbers cross it, never the picks). null when no
// position carries a usable return yet.
function computeAggregate(active: AlphaPick[], resolved: AlphaPick[]): AlphaAggregate | null {
  const round1 = (n: number) => Math.round(n * 10) / 10;
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

  const activeReturns: number[] = [];
  for (const p of active) {
    if (typeof p.price_change_pct === "number") activeReturns.push(p.price_change_pct);
  }

  // Closed positions: realized return. Prefer recomputing from the exit print
  // (most faithful to the actual round-trip); fall back to the stored grade.
  // Skip horizon-graded picks that are still open — they count as active above.
  const closedReturns: number[] = [];
  for (const p of resolved) {
    if (p.status !== "SOLD") continue;
    let r: number | null = null;
    if (typeof p.exit_price === "number" && p.exit_price > 0 && p.entry_price > 0) {
      r = ((p.exit_price - p.entry_price) / p.entry_price) * 100;
    } else if (typeof p.realized_return_pct === "number") {
      r = p.realized_return_pct;
    }
    if (r !== null) closedReturns.push(r);
  }

  const all = [...activeReturns, ...closedReturns];
  if (all.length === 0) return null;

  return {
    avgReturnPct: round1(mean(all)),
    positions: all.length,
    winners: all.filter((r) => r >= 0).length,
    losers: all.filter((r) => r < 0).length,
    activeCount: activeReturns.length,
    closedCount: closedReturns.length,
    activeAvgReturnPct: activeReturns.length ? round1(mean(activeReturns)) : null,
    closedAvgReturnPct: closedReturns.length ? round1(mean(closedReturns)) : null,
  };
}

export async function GET() {
  try {
    const user = await getVerifiedUser();
    if (!user) {
      return NextResponse.json({ error: "auth_required" }, { status: 401 });
    }

    const store = getAlphaStore();

    const [active, recently_exited, resolved, last_run, publication] = await Promise.all([
      store.fetchActive(),
      store.fetchRecentlySold(30),
      store.fetchResolved(200),
      store.lastRunDate(),
      store.currentPublication(),
    ]);

    const unlocked = publication
      ? await isUnlocked(user.email, publication.runId)
      : false;

    // Computed from the FULL active list (pre-gate) so the headline return is a
    // trust signal visible whether or not this publication is unlocked.
    const aggregate = computeAggregate(active, resolved);

    return NextResponse.json({
      // Gate the active picks behind the unlock.
      active: unlocked ? active : [],
      recently_exited,
      last_run,
      next_run: nextRunDate(new Date()),
      locked: !unlocked,
      aggregate,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[alpha/picks] error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
