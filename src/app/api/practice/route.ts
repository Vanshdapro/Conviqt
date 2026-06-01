// /api/practice
//
// GET  → the Practice dashboard payload: the drill ladder (cards + per-drill
//        progress + tier lock state), the tiers, and the signed-in user's stats.
//        Anon-friendly: logged-out visitors see the catalog with empty stats.
// POST → load ONE playable drill by id. Episode answer keys (key moments,
//        teaching point, ideal play) and the thesis "what good looks like" are
//        withheld here — they're only revealed on grading. Free, no model call.
//
// Identity (for progress overlay) always comes from the verified session.

import { NextResponse } from "next/server";
import { getVerifiedUser } from "@/lib/auth";
import {
  DRILLS,
  TIERS,
  TOTAL_DRILLS,
  findDrill,
  drillsInTier,
  isTierUnlocked,
} from "@/lib/practice/curriculum";
import { getPracticeStats } from "@/lib/practice/store";
import { nextRank } from "@/lib/practice/types";
import type { PracticeDrill, DrillProgress } from "@/lib/practice/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 10;

function cardFor(d: PracticeDrill, progress?: DrillProgress) {
  return {
    id: d.id,
    kind: d.kind,
    title: d.title,
    hook: d.hook,
    difficulty: d.difficulty,
    xp: d.xp,
    tier: d.tier,
    conceptTags: d.conceptTags,
    conceptLessonIds: d.conceptLessonIds,
    ticker: d.episode?.ticker,
    period: d.episode?.period,
    progress: progress
      ? {
          bestScore: progress.bestScore,
          bestStars: progress.bestStars,
          bestPnlPct: progress.bestPnlPct,
          attempts: progress.attempts,
        }
      : null,
  };
}

export async function GET() {
  try {
    const user = await getVerifiedUser();
    const stats = user
      ? await getPracticeStats(user.email)
      : { xp: 0, level: 1, rank: { id: "intern", title: "Intern", minXp: 0 }, clearedDrillIds: [], progress: [] };

    const progressById = new Map(stats.progress.map((p) => [p.drillId, p]));
    const cleared = new Set(stats.clearedDrillIds);

    const tiers = TIERS.map((t) => ({
      ...t,
      unlocked: isTierUnlocked(t.tier, cleared),
      drills: drillsInTier(t.tier).map((d) => cardFor(d, progressById.get(d.id))),
    }));

    return NextResponse.json({
      tiers,
      stats,
      nextRank: nextRank(stats.xp),
      totals: {
        totalDrills: TOTAL_DRILLS,
        cleared: stats.clearedDrillIds.length,
      },
      signedIn: Boolean(user),
    });
  } catch (err) {
    console.error("[practice] GET route error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    let body: { drillId?: unknown };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "bad_request" }, { status: 400 });
    }

    const drillId = typeof body.drillId === "string" ? body.drillId.trim() : "";
    const drill = findDrill(drillId);
    if (!drill) {
      return NextResponse.json({ error: "unknown_drill" }, { status: 404 });
    }

    // Gate locked tiers server-side too, so the answer-free spec isn't loadable
    // until the prior tier is cleared.
    const user = await getVerifiedUser();
    if (drill.tier > 1) {
      const cleared = new Set(user ? (await getPracticeStats(user.email)).clearedDrillIds : []);
      if (!isTierUnlocked(drill.tier, cleared)) {
        return NextResponse.json({ error: "tier_locked", tier: drill.tier }, { status: 403 });
      }
    }

    if (drill.kind === "episode" && drill.episode) {
      const e = drill.episode;
      return NextResponse.json({
        drill: {
          id: drill.id,
          kind: "episode" as const,
          title: drill.title,
          hook: drill.hook,
          difficulty: drill.difficulty,
          xp: drill.xp,
          tier: drill.tier,
          conceptTags: drill.conceptTags,
          conceptLessonIds: drill.conceptLessonIds,
          episode: {
            ticker: e.ticker,
            company: e.company,
            period: e.period,
            briefing: e.briefing,
            startingCash: e.startingCash,
            startingShares: e.startingShares ?? 0,
            startingCostBasis: e.startingCostBasis ?? 0,
            bars: e.bars,
            events: e.events,
            sourceUrl: e.sourceUrl,
            sourceLabel: e.sourceLabel,
            priceNote: e.priceNote ?? null,
            // keyMoments / teachingPoint / idealPlay are withheld until debrief.
          },
        },
      });
    }

    if (drill.kind === "thesis" && drill.thesis) {
      const t = drill.thesis;
      return NextResponse.json({
        drill: {
          id: drill.id,
          kind: "thesis" as const,
          title: drill.title,
          hook: drill.hook,
          difficulty: drill.difficulty,
          xp: drill.xp,
          tier: drill.tier,
          conceptTags: drill.conceptTags,
          conceptLessonIds: drill.conceptLessonIds,
          thesis: {
            setup: t.setup,
            ticker: t.ticker ?? null,
            sections: t.sections,
            // whatGoodLooksLike is withheld until after grading.
          },
        },
      });
    }

    return NextResponse.json({ error: "malformed_drill" }, { status: 500 });
  } catch (err) {
    console.error("[practice] POST route error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
