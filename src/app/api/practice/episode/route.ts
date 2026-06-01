// POST /api/practice/episode
//
// Grades an episode attempt. The client plays the simulator and sends only its
// MANUAL action log; the server re-runs the deterministic engine against the
// authoritative price path (regenerating stop/target/terminal fills), scores the
// process + P&L, persists progress (XP awarded once), and returns the score plus
// the debrief — the key moments, teaching point, and ideal play that were
// withheld during play. Free: episodes replay cached data, no model spend.
//
// Body: { drillId: string, actions: TradeAction[] }

import { NextResponse } from "next/server";
import { getVerifiedUser } from "@/lib/auth";
import { findDrill, isTierUnlocked } from "@/lib/practice/curriculum";
import { buildAttempt } from "@/lib/practice/engine";
import { scoreEpisode } from "@/lib/practice/scoring";
import { getPracticeStats, recordDrillResult } from "@/lib/practice/store";
import { starsForScore } from "@/lib/practice/types";
import type { TradeAction, TradeSide } from "@/lib/practice/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 10;

// Accept only the fields the engine trusts; everything else (including any
// client-sent `auto` fills) is recomputed server-side.
function sanitizeActions(raw: unknown): TradeAction[] {
  if (!Array.isArray(raw)) return [];
  const out: TradeAction[] = [];
  for (const a of raw) {
    if (!a || typeof a !== "object") continue;
    const o = a as Record<string, unknown>;
    const side = o.side === "buy" || o.side === "sell" ? (o.side as TradeSide) : null;
    const atBar = Number(o.atBar);
    const shares = Number(o.shares);
    if (!side || !Number.isFinite(atBar) || !Number.isFinite(shares) || shares <= 0) continue;
    out.push({
      atBar: Math.floor(atBar),
      side,
      shares: Math.floor(shares),
      price: Number(o.price) || 0, // re-priced to the bar close by the engine anyway
      stop: typeof o.stop === "number" && o.stop > 0 ? o.stop : undefined,
      target: typeof o.target === "number" && o.target > 0 ? o.target : undefined,
    });
  }
  return out;
}

export async function POST(req: Request) {
  try {
    let body: { drillId?: unknown; actions?: unknown };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "bad_request" }, { status: 400 });
    }

    const drillId = typeof body.drillId === "string" ? body.drillId.trim() : "";
    const drill = findDrill(drillId);
    if (!drill || drill.kind !== "episode" || !drill.episode) {
      return NextResponse.json({ error: "unknown_episode" }, { status: 404 });
    }

    const user = await getVerifiedUser();

    // Re-check the tier gate server-side.
    if (drill.tier > 1) {
      const cleared = new Set(user ? (await getPracticeStats(user.email)).clearedDrillIds : []);
      if (!isTierUnlocked(drill.tier, cleared)) {
        return NextResponse.json({ error: "tier_locked", tier: drill.tier }, { status: 403 });
      }
    }

    const actions = sanitizeActions(body.actions);
    const { attempt, run } = buildAttempt(drill.episode, drillId, actions);
    const score = scoreEpisode(drill.episode, attempt);

    // Persist (only for signed-in users; anon can play but not save progress).
    let awardedXp = 0;
    let stats = null;
    if (user) {
      const res = await recordDrillResult(user.email, drillId, {
        score: score.overall,
        stars: score.stars,
        pnlPct: score.pnlPct,
        baseXp: drill.xp,
      });
      awardedXp = res.awardedXp;
      stats = res.stats;
    }

    return NextResponse.json({
      score,
      // The debrief — revealed now that the attempt is graded.
      debrief: {
        teachingPoint: drill.episode.teachingPoint,
        idealPlay: drill.episode.idealPlay,
        keyMoments: drill.episode.keyMoments,
        sourceUrl: drill.episode.sourceUrl,
        sourceLabel: drill.episode.sourceLabel,
      },
      run: {
        equityCurve: run.equityCurve,
        resolvedActions: run.resolvedActions,
        startingEquity: run.startingEquity,
        finalEquity: run.finalEquity,
        buyHoldEquity: run.buyHoldEquity,
        maxDrawdown: run.maxDrawdown,
      },
      stars: starsForScore(score.overall),
      awardedXp,
      stats,
      signedIn: Boolean(user),
    });
  } catch (err) {
    console.error("[practice] episode route error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
