// GET /api/alpha/status
//
// Tells the logged-in user everything the Alpha gate UI needs:
//   - is there a current publication, and when was it published
//   - have they already unlocked it (→ free re-view)
//   - their live credit balance + the unlock cost
//   - whether a NEW publication has dropped since their last unlock
//
// Identity comes from the verified session — never a client param.
//
// Response:
//   { hasPublication, runId, publishedDate, unlocked, credits, cost, isNew }
//   { error: "auth_required" } 401 if not signed in / not verified

import { NextResponse } from "next/server";
import { getVerifiedUser } from "@/lib/auth";
import { getAlphaStore } from "@/lib/alphaStore";
import { getCredits, grantFreeCreditsIfDue } from "@/lib/credits";
import { isUnlocked, ALPHA_UNLOCK_COST } from "@/lib/alphaUnlock";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getVerifiedUser();
    if (!user) {
      return NextResponse.json({ error: "auth_required" }, { status: 401 });
    }

    // Make sure the free tier is provisioned so the balance is accurate.
    await grantFreeCreditsIfDue(user.email);

    const store = getAlphaStore();
    const [publication, creditRow] = await Promise.all([
      store.currentPublication(),
      getCredits(user.email),
    ]);

    const credits = creditRow?.credits ?? 0;

    if (!publication) {
      return NextResponse.json({
        hasPublication: false,
        runId: null,
        publishedDate: null,
        unlocked: false,
        credits,
        cost: ALPHA_UNLOCK_COST,
        isNew: false,
      });
    }

    const unlocked = await isUnlocked(user.email, publication.runId);

    return NextResponse.json({
      hasPublication: true,
      runId: publication.runId,
      publishedDate: publication.publishedDate,
      unlocked,
      credits,
      cost: ALPHA_UNLOCK_COST,
      // A publication the user hasn't paid for is "new" to them.
      isNew: !unlocked,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[alpha/status] error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
