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

// CUMULATIVE return across every published position — the SUM of each
// position's return, never an average.
//
// Two permanent rules, enforced here in code (not config, not a flag):
//   1. We SUM the returns. We do NOT divide by the number of positions.
//      Dividing gives a "per stock" average (e.g. four picks at +12.4% total
//      would read as +3.1%) — that is explicitly not what we report. The
//      headline is the total return the Council's picks have generated.
//   2. Positions entered TODAY are EXCLUDED. A pick entered today sits at
//      exactly 0% (it was just priced at entry) and would add nothing but
//      noise. It joins automatically once the next pipeline run re-prices it.
//
// Active positions contribute their unrealized price_change_pct; closed (SOLD)
// positions contribute their realized exit return (from exit_price/entry_price,
// falling back to the stored realized_return_pct).
function computeAggregate(active: AlphaPick[], resolved: AlphaPick[]): AlphaAggregate | null {
  const round1 = (n: number) => Math.round(n * 10) / 10;
  const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
  const today = new Date().toISOString().slice(0, 10);

  // --- Active positions (Rule 2: skip same-day entries — they haven't moved) ---
  const activeReturns: number[] = [];
  for (const p of active) {
    if (p.entry_date === today) continue;
    if (typeof p.price_change_pct === "number") activeReturns.push(p.price_change_pct);
  }

  // --- Closed (SOLD) positions ---
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

  const allReturns = [...activeReturns, ...closedReturns];
  if (allReturns.length === 0) return null;

  // Rule 1: SUM, do not average.
  return {
    totalReturnPct: round1(sum(allReturns)),
    positions: allReturns.length,
    winners: allReturns.filter((r) => r >= 0).length,
    losers: allReturns.filter((r) => r < 0).length,
    activeCount: activeReturns.length,
    closedCount: closedReturns.length,
    activeTotalReturnPct: activeReturns.length ? round1(sum(activeReturns)) : null,
    closedTotalReturnPct: closedReturns.length ? round1(sum(closedReturns)) : null,
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
