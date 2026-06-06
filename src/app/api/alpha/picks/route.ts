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

// Portfolio return across every published position that has had time to move.
//
// Rules (permanent — enforced in code, not config):
//   1. Same-day entries are EXCLUDED. A position entered today has 0% change
//      by definition (it was just priced at entry). Including it would dilute
//      the number with a guaranteed zero and misrepresent the desk's track
//      record. Once the next pipeline run re-prices it, it joins automatically.
//   2. Return is POSITION-SIZE WEIGHTED when position_size_pct is available
//      (migration 009+). When it is null (pre-009 picks), the position gets
//      an equal share of the book alongside the others that also lack a size.
//      This is the correct treatment: equal-dollar-invested per position, not
//      a naive per-stock average that ignores book allocation.
//   3. Closed (SOLD) positions contribute their realized exit return, computed
//      from exit_price/entry_price when available, falling back to the stored
//      realized_return_pct.
//
// The result is the total return you would have earned on this portfolio —
// not a per-stock figure, but what the whole book produced.
function computeAggregate(active: AlphaPick[], resolved: AlphaPick[]): AlphaAggregate | null {
  const round1 = (n: number) => Math.round(n * 10) / 10;
  const today = new Date().toISOString().slice(0, 10);

  // --- Active positions that have had at least one price update ---
  const activeItems: Array<{ ret: number; weight: number | null }> = [];
  for (const p of active) {
    // Rule 1: skip same-day entries — they haven't moved yet.
    if (p.entry_date === today) continue;
    if (typeof p.price_change_pct !== "number") continue;
    activeItems.push({
      ret: p.price_change_pct,
      weight: typeof p.position_size_pct === "number" ? p.position_size_pct : null,
    });
  }

  // --- Closed (SOLD) positions ---
  const closedItems: Array<{ ret: number; weight: number | null }> = [];
  for (const p of resolved) {
    if (p.status !== "SOLD") continue;
    let r: number | null = null;
    if (typeof p.exit_price === "number" && p.exit_price > 0 && p.entry_price > 0) {
      r = ((p.exit_price - p.entry_price) / p.entry_price) * 100;
    } else if (typeof p.realized_return_pct === "number") {
      r = p.realized_return_pct;
    }
    if (r === null) continue;
    closedItems.push({
      ret: r,
      weight: typeof p.position_size_pct === "number" ? p.position_size_pct : null,
    });
  }

  const allItems = [...activeItems, ...closedItems];
  if (allItems.length === 0) return null;

  // --- Portfolio-weighted return (Rule 2) ---
  // If every item has an explicit weight, use it directly.
  // If any item has a null weight, treat ALL null-weight items as equal-share
  // within their group (active or closed), proportioned against the weighted items.
  // The simplest correct fallback: assign null-weight items a weight of 1 each,
  // then normalise the whole set — this gives equal-dollar treatment across the
  // book when allocation data is absent, which is identical to equal-weight.
  const totalWeight = allItems.reduce(
    (sum, x) => sum + (x.weight ?? 1),
    0
  );
  const portfolioReturn = allItems.reduce(
    (sum, x) => sum + x.ret * (x.weight ?? 1),
    0
  ) / totalWeight;

  const activeReturns = activeItems.map((x) => x.ret);
  const closedReturns = closedItems.map((x) => x.ret);
  const allReturns = allItems.map((x) => x.ret);

  const activeWeight = activeItems.reduce((s, x) => s + (x.weight ?? 1), 0);
  const closedWeight = closedItems.reduce((s, x) => s + (x.weight ?? 1), 0);

  const activePortfolioReturn = activeItems.length
    ? activeItems.reduce((s, x) => s + x.ret * (x.weight ?? 1), 0) / activeWeight
    : null;
  const closedPortfolioReturn = closedItems.length
    ? closedItems.reduce((s, x) => s + x.ret * (x.weight ?? 1), 0) / closedWeight
    : null;

  return {
    avgReturnPct: round1(portfolioReturn),
    positions: allItems.length,
    winners: allReturns.filter((r) => r >= 0).length,
    losers: allReturns.filter((r) => r < 0).length,
    activeCount: activeReturns.length,
    closedCount: closedReturns.length,
    activeAvgReturnPct: activePortfolioReturn !== null ? round1(activePortfolioReturn) : null,
    closedAvgReturnPct: closedPortfolioReturn !== null ? round1(closedPortfolioReturn) : null,
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
