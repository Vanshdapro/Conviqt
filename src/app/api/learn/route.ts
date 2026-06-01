// POST /api/learn
//
// Returns one static Conviqt Learn lesson module — but only if the signed-in
// user has access to it (the free preview lesson, or one they've unlocked).
//
// Lessons are in-repo content (see lib/learn/content). Serving one is a plain
// data read: no Anthropic call and no credit charge on this path. The only paid
// moment is the one-time unlock (POST /api/learn/unlock).
//
// Body: { lessonId: string }
// Flow:
//   1. Verify the session (unauthenticated → 401).
//   2. Resolve the lesson from the static curriculum (unknown id → 404).
//   3. Unlocked (free or paid) → return the module.
//      Locked → 402 with the credit cost so the client can offer to unlock.

import { NextResponse } from "next/server";
import { getVerifiedUser } from "@/lib/auth";
import { findLesson, getLessonModule } from "@/lib/learn/curriculum";
import { isLessonUnlocked, lessonUnlockCost } from "@/lib/learn/unlock";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 10;

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

    const unlocked = await isLessonUnlocked(user.email, lessonId);
    if (!unlocked) {
      return NextResponse.json(
        { error: "locked", cost: lessonUnlockCost(lessonId) },
        { status: 402 },
      );
    }

    const module = getLessonModule(lessonId);
    if (!module) {
      // Should be impossible: findLesson matched but assembly failed.
      console.error(`[learn] module assembly failed for unlocked lesson ${lessonId}`);
      return NextResponse.json({ error: "internal_error" }, { status: 500 });
    }

    return NextResponse.json({ module, unlocked: true, cost: 0 });
  } catch (err) {
    console.error("[learn] route error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
