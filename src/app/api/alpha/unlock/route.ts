// POST /api/alpha/unlock
//
// Charges ALPHA_UNLOCK_COST credits to reveal the CURRENT Alpha publication
// for the logged-in user. Idempotent per publication: re-unlocking a run the
// user already paid for is free. The run_id is resolved server-side from the
// active picks — the client never chooses what it pays for.
//
// Identity comes from the verified session — never a client param.
//
// Response:
//   { ok, already, remaining, runId }                      on success
//   { error: "auth_required" }                       401   not signed in
//   { error: "no_publication" }                      404   nothing to unlock
//   { error: "insufficient_credits", credits, cost } 402   not enough credits

import { NextResponse } from "next/server";
import { getVerifiedUser } from "@/lib/auth";
import { getAlphaStore } from "@/lib/alphaStore";
import { unlockAlpha, ALPHA_UNLOCK_COST } from "@/lib/alphaUnlock";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const user = await getVerifiedUser();
    if (!user) {
      return NextResponse.json({ error: "auth_required" }, { status: 401 });
    }

    const publication = await getAlphaStore().currentPublication();
    if (!publication) {
      return NextResponse.json({ error: "no_publication" }, { status: 404 });
    }

    const result = await unlockAlpha(user.email, publication.runId);

    if (!result.ok) {
      return NextResponse.json(
        {
          error: "insufficient_credits",
          credits: result.remaining,
          cost: ALPHA_UNLOCK_COST,
        },
        { status: 402 },
      );
    }

    return NextResponse.json({
      ok: true,
      already: result.already,
      remaining: result.remaining,
      runId: publication.runId,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[alpha/unlock] error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
