// /api/leaderboard
//
// GET → the public weekly standings. Anyone can read (it's a public board); the
// live week is computed on the fly, completed weeks read from the frozen
// snapshot. Pure DB aggregation — no model spend.
//
//   ?week=current            → the live week (default)
//   ?week=YYYY-MM-DD         → a specific week (snapped to that week's Monday)
//
// If the viewer is signed in AND has a leaderboard handle, their own row is
// flagged isSelf so the UI can highlight it.

import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import {
  getLeaderboardWeek,
  resolveWeekStart,
  getProfile,
} from "@/lib/practice/leaderboard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 15;

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const weekStart = resolveWeekStart(searchParams.get("week"));

    // Best-effort self-highlight: never blocks the public read.
    let selfHandle: string | null = null;
    try {
      const user = await getSessionUser();
      if (user) selfHandle = (await getProfile(user.email))?.handle ?? null;
    } catch {
      selfHandle = null;
    }

    const week = await getLeaderboardWeek(weekStart, selfHandle);
    return NextResponse.json({ week });
  } catch (err) {
    console.error("[leaderboard] GET error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
