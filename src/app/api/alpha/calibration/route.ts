// GET /api/alpha/calibration
//
// The Alpha Tracker's self-scoring record: hit rate, predicted-vs-actual
// calibration by confidence band, and a Brier score, derived from every
// resolved prediction. This is a trust signal (like the recently-exited table),
// not gated content — any signed-in user sees it. It is the proof behind the
// risk numbers on each pick.
//
// Response: CalibrationStats  ·  { error: "auth_required" } 401 if not signed in.

import { NextResponse } from "next/server";
import { getAlphaStore } from "@/lib/alphaStore";
import { computeCalibration } from "@/lib/alphaCalibration";
import { getVerifiedUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getVerifiedUser();
    if (!user) {
      return NextResponse.json({ error: "auth_required" }, { status: 401 });
    }

    const store = getAlphaStore();
    const resolved = await store.fetchResolved(500);
    const stats = computeCalibration(resolved);

    return NextResponse.json(stats);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[alpha/calibration] error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
