// POST /api/learn
//
// Generates (or replays from cache) one interactive Conviqt Learn lesson and
// meters it against the user's credits.
//
// Body: { lessonId: string }
// Flow:
//   1. Verified user only (free-tier provisioning happens lazily).
//   2. Resolve the lesson from the static curriculum (unknown id → 404).
//   3. Cache hit  → deduct learn_cached (3 cr), return the stored module.
//      Cache miss → deduct learn (14 cr), author via Claude, cache it.
//                   If authoring throws AFTER deduction, refund the credits.
//   4. Insufficient credits → 402 so the client can prompt an upgrade.
//
// Lessons are cached globally by lessonId, so only the first learner pays full
// authoring cost — this keeps us inside the per-request cost ceiling (CLAUDE.md).

import { NextResponse } from "next/server";
import { getVerifiedUser } from "@/lib/auth";
import {
  CREDITS_PER_INTENT,
  deductCredits,
  addCredits,
  grantFreeCreditsIfDue,
} from "@/lib/credits";
import { findLesson } from "@/lib/learn/curriculum";
import { authorLesson, readCachedLesson } from "@/lib/learn/author";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const user = await getVerifiedUser();
    if (!user) {
      return NextResponse.json({ error: "auth_required" }, { status: 401 });
    }

    let body: { lessonId?: unknown };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "bad_request" }, { status: 400 });
    }

    const lessonId = typeof body.lessonId === "string" ? body.lessonId.trim() : "";
    const found = findLesson(lessonId);
    if (!found) {
      return NextResponse.json({ error: "unknown_lesson" }, { status: 404 });
    }

    // Make sure free-tier credits exist before we try to charge.
    await grantFreeCreditsIfDue(user.email);

    const cached = await readCachedLesson(lessonId);

    if (cached) {
      const cost = CREDITS_PER_INTENT.learn_cached;
      const deduct = await deductCredits(user.email, cost, `learn_cached:${lessonId}`);
      if (!deduct.ok) {
        return NextResponse.json(
          { error: "insufficient_credits", needed: cost, remaining: deduct.remaining },
          { status: 402 },
        );
      }
      return NextResponse.json({
        module: cached,
        cached: true,
        cost,
        remaining: deduct.remaining,
      });
    }

    // Cache miss → charge full, then author. Refund if authoring fails.
    const cost = CREDITS_PER_INTENT.learn;
    const deduct = await deductCredits(user.email, cost, `learn:${lessonId}`);
    if (!deduct.ok) {
      return NextResponse.json(
        { error: "insufficient_credits", needed: cost, remaining: deduct.remaining },
        { status: 402 },
      );
    }

    try {
      const { module } = await authorLesson(found.lesson, found.track);
      return NextResponse.json({
        module,
        cached: false,
        cost,
        remaining: deduct.remaining,
      });
    } catch (authorErr) {
      // Refund — the learner shouldn't pay for a generation that never landed.
      console.error(
        "[learn] authoring failed, refunding:",
        authorErr instanceof Error ? authorErr.message : authorErr,
      );
      try {
        await addCredits(user.email, cost, `learn_refund:${lessonId}`);
      } catch (refundErr) {
        console.error(
          "[learn] refund failed:",
          refundErr instanceof Error ? refundErr.message : refundErr,
        );
      }
      return NextResponse.json({ error: "author_failed" }, { status: 502 });
    }
  } catch (err) {
    console.error("[learn] route error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
