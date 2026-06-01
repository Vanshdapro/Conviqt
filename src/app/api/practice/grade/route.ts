// POST /api/practice/grade
//
// The AI thesis grader. A learner submits a structured PM thesis; a Sonnet call
// grades it section by section like an investment-committee review and returns
// detailed feedback. Metered at thesis credits, with two safeguards:
//   1. Dedup — an identical resubmission (same drill, same text) returns the
//      last grade for free, so a learner isn't charged twice for no change.
//   2. Refund-on-failure — if the grader call throws, the credits are returned.
//
// Body: { drillId: string, submission: ThesisSubmission }. Requires a verified
// session; identity comes from the session, never the body.

import { NextResponse } from "next/server";
import { getVerifiedUser } from "@/lib/auth";
import { findDrill, isTierUnlocked } from "@/lib/practice/curriculum";
import { gradeThesis, thesisHash } from "@/lib/practice/grader";
import {
  getPracticeStats,
  recordDrillResult,
  recordThesisFeedback,
  listThesisFeedback,
} from "@/lib/practice/store";
import {
  CREDITS_PER_INTENT,
  deductCredits,
  addCredits,
  getCredits,
  grantFreeCreditsIfDue,
} from "@/lib/credits";
import { starsForScore } from "@/lib/practice/types";
import type { ThesisSubmission, ThesisSectionId } from "@/lib/practice/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const COST = CREDITS_PER_INTENT.thesis;

function sanitizeSubmission(raw: unknown): ThesisSubmission {
  if (!raw || typeof raw !== "object") return {};
  const out: ThesisSubmission = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === "string") out[k as ThesisSectionId] = v.slice(0, 4000);
  }
  return out;
}

export async function POST(req: Request) {
  try {
    const user = await getVerifiedUser();
    if (!user) {
      return NextResponse.json({ error: "auth_required" }, { status: 401 });
    }

    let body: { drillId?: unknown; submission?: unknown };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "bad_request" }, { status: 400 });
    }

    const drillId = typeof body.drillId === "string" ? body.drillId.trim() : "";
    const drill = findDrill(drillId);
    if (!drill || drill.kind !== "thesis" || !drill.thesis) {
      return NextResponse.json({ error: "unknown_thesis" }, { status: 404 });
    }

    // Tier gate.
    if (drill.tier > 1) {
      const cleared = new Set((await getPracticeStats(user.email)).clearedDrillIds);
      if (!isTierUnlocked(drill.tier, cleared)) {
        return NextResponse.json({ error: "tier_locked", tier: drill.tier }, { status: 403 });
      }
    }

    const submission = sanitizeSubmission(body.submission);
    const written = Object.values(submission).filter((s) => s.trim().length > 0);
    if (written.length === 0) {
      return NextResponse.json({ error: "empty_submission" }, { status: 400 });
    }

    // ── Dedup: identical resubmission → return the last grade, no charge. ──
    const hash = thesisHash(drillId, submission);
    const recent = await listThesisFeedback(user.email, drillId, 1);
    if (recent[0] && thesisHash(drillId, recent[0].submission) === hash) {
      const stats = await getPracticeStats(user.email);
      return NextResponse.json({
        grade: recent[0].grade,
        whatGoodLooksLike: drill.thesis.whatGoodLooksLike,
        cached: true,
        creditsCharged: 0,
        stats,
      });
    }

    // ── Meter: deduct up front, refund if the grader fails. ──
    await grantFreeCreditsIfDue(user.email);
    const balance = (await getCredits(user.email))?.credits ?? 0;
    if (balance < COST) {
      return NextResponse.json(
        { error: "insufficient_credits", needed: COST, credits: balance },
        { status: 402 },
      );
    }
    const deducted = await deductCredits(user.email, COST, "thesis", 0);
    if (!deducted.ok) {
      return NextResponse.json(
        { error: "insufficient_credits", needed: COST, credits: deducted.remaining },
        { status: 402 },
      );
    }

    let grade;
    try {
      const result = await gradeThesis(drill.thesis, drill.title, submission);
      grade = result.grade;
    } catch (err) {
      console.error("[practice] grader failed, refunding:", err instanceof Error ? err.message : err);
      await addCredits(user.email, COST, `refund_thesis_${drillId}`);
      return NextResponse.json({ error: "grader_failed" }, { status: 502 });
    }

    // Persist the feedback history + the drill progress (XP once on first clear).
    await recordThesisFeedback(user.email, drillId, submission, grade);
    const { awardedXp, stats } = await recordDrillResult(user.email, drillId, {
      score: grade.overall,
      stars: starsForScore(grade.overall),
      pnlPct: null,
      baseXp: drill.xp,
    });

    return NextResponse.json({
      grade,
      whatGoodLooksLike: drill.thesis.whatGoodLooksLike,
      cached: false,
      creditsCharged: COST,
      creditsRemaining: deducted.remaining,
      awardedXp,
      stats,
    });
  } catch (err) {
    console.error("[practice] grade route error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
