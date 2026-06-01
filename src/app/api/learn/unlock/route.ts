// POST /api/learn/unlock
//
// Pays credits ONCE to unlock Conviqt Learn content. After unlocking, the
// lesson opens free forever (static, in-repo content — no per-open API cost).
//
// Body (one of):
//   { lessonId: string }  → unlock a single lesson (PER_LESSON_UNLOCK_COST)
//   { all: true }         → unlock every still-locked lesson at the bundle rate
//
// Identity comes from the verified session — never a client param. The "unlock
// all" set is the authoritative catalog id list resolved server-side, so the
// client can never choose what it pays for. Lessons added later are fresh
// unlocks, never retroactively granted.
//
// Response:
//   single → { ok, already, remaining }
//   all    → { ok, unlocked, charged, remaining }
//   { error: "auth_required" }                       401   not signed in
//   { error: "bad_request" }                         400   malformed body
//   { error: "unknown_lesson" }                      404   no such lesson
//   { error: "insufficient_credits", credits, cost } 402   not enough credits

import { NextResponse } from "next/server";
import { getVerifiedUser } from "@/lib/auth";
import { findLesson, ALL_LESSON_IDS } from "@/lib/learn/curriculum";
import {
  unlockLesson,
  unlockAllLessons,
  lessonUnlockCost,
} from "@/lib/learn/unlock";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const user = await getVerifiedUser();
    if (!user) {
      return NextResponse.json({ error: "auth_required" }, { status: 401 });
    }

    let body: { lessonId?: unknown; all?: unknown };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "bad_request" }, { status: 400 });
    }

    // ── Unlock everything still locked ──
    if (body.all === true) {
      const result = await unlockAllLessons(user.email, ALL_LESSON_IDS);
      if (!result.ok) {
        return NextResponse.json(
          { error: "insufficient_credits", credits: result.remaining, cost: result.charged },
          { status: 402 },
        );
      }
      return NextResponse.json(result);
    }

    // ── Unlock a single lesson ──
    const lessonId = typeof body.lessonId === "string" ? body.lessonId.trim() : "";
    if (!lessonId) {
      return NextResponse.json({ error: "bad_request" }, { status: 400 });
    }
    if (!findLesson(lessonId)) {
      return NextResponse.json({ error: "unknown_lesson" }, { status: 404 });
    }

    const result = await unlockLesson(user.email, lessonId);
    if (!result.ok) {
      return NextResponse.json(
        { error: "insufficient_credits", credits: result.remaining, cost: lessonUnlockCost(lessonId) },
        { status: 402 },
      );
    }
    return NextResponse.json(result);
  } catch (err) {
    console.error("[learn/unlock] error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
