// /api/learn/progress
//
// GET  → the logged-in user's Learn stats (xp, level, streak, completed ids).
// POST → record a lesson completion. Body: { lessonId, quizPct }.
//        XP is awarded once per lesson; replays only raise the best quiz score.
//
// Identity always comes from the verified session, never the client body, so a
// user can only ever read/write their own progress.

import { NextResponse } from "next/server";
import { getVerifiedUser } from "@/lib/auth";
import { findLesson } from "@/lib/learn/curriculum";
import { getLearnStats, recordCompletion } from "@/lib/learn/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getVerifiedUser();
  if (!user) {
    return NextResponse.json({ error: "auth_required" }, { status: 401 });
  }
  const stats = await getLearnStats(user.email);
  return NextResponse.json(stats);
}

export async function POST(req: Request) {
  try {
    const user = await getVerifiedUser();
    if (!user) {
      return NextResponse.json({ error: "auth_required" }, { status: 401 });
    }

    let body: { lessonId?: unknown; quizPct?: unknown };
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

    const quizPct = typeof body.quizPct === "number" ? body.quizPct : 0;
    const { awardedXp, stats } = await recordCompletion(
      user.email,
      lessonId,
      found.lesson.xp,
      quizPct,
    );

    return NextResponse.json({ awardedXp, stats });
  } catch (err) {
    console.error("[learn] progress route error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
