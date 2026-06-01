// Conviqt Academy — Practice: per-user progress store (server-only).
//
// Progress lives in practice_progress (one row per email+drill). XP, level, and
// rank are derived from those rows so there's a single source of truth and no
// denormalized counter to desync. XP is awarded ONCE per drill (first clear);
// later attempts only raise best score/stars/P&L. Thesis grades are also kept in
// practice_thesis_feedback so a learner can see their reasoning improve.
//
// Service-role client bypasses RLS; the route guarantees the email comes from the
// verified session, never the client. Every read/write degrades to a safe value
// (rather than throwing) if the store is unreachable — e.g. local preview with no
// service-role key — so the dashboard still renders.

import { getSupabaseAdmin } from "../supabase";
import { TOTAL_DRILLS } from "./curriculum";
import { levelForXp, rankForXp, xpForAttempt } from "./types";
import type {
  PracticeStats,
  DrillProgress,
  ThesisGrade,
  ThesisSubmission,
} from "./types";

interface ProgressRow {
  drill_id: string;
  best_score: number;
  best_stars: number;
  best_pnl_pct: number | null;
  xp_awarded: number;
  attempts: number;
}

const EMPTY_STATS: PracticeStats = {
  xp: 0,
  level: 1,
  rank: rankForXp(0),
  clearedDrillIds: [],
  progress: [],
};

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));
const clampInt = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.round(n)));

function bestPnlOf(a: number | null | undefined, b: number | null | undefined): number | null {
  const vals = [a, b].filter((v): v is number => typeof v === "number");
  return vals.length ? Math.max(...vals) : null;
}

// Reads all of a user's drill progress and derives XP / level / rank.
export async function getPracticeStats(email: string): Promise<PracticeStats> {
  let rows: ProgressRow[] = [];
  try {
    const supabase = getSupabaseAdmin();
    const res = await supabase
      .from("practice_progress")
      .select("drill_id, best_score, best_stars, best_pnl_pct, xp_awarded, attempts")
      .eq("email", email.toLowerCase().trim());
    if (res.error) {
      console.error("[practice] getPracticeStats error:", res.error.message);
      return EMPTY_STATS;
    }
    rows = (res.data ?? []) as ProgressRow[];
  } catch (err) {
    console.error("[practice] getPracticeStats unavailable:", msg(err));
    return EMPTY_STATS;
  }

  const xp = rows.reduce((sum, r) => sum + (r.xp_awarded ?? 0), 0);
  const clearedDrillIds = rows.filter((r) => (r.best_stars ?? 0) >= 1).map((r) => r.drill_id);
  const progress: DrillProgress[] = rows.map((r) => ({
    drillId: r.drill_id,
    bestScore: r.best_score ?? 0,
    bestStars: r.best_stars ?? 0,
    bestPnlPct: r.best_pnl_pct,
    xpAwarded: r.xp_awarded ?? 0,
    attempts: r.attempts ?? 0,
  }));

  return { xp, level: levelForXp(xp), rank: rankForXp(xp), clearedDrillIds, progress };
}

export interface DrillResultInput {
  score: number;             // 0-100 process/grade score
  stars: number;             // 0-3
  pnlPct: number | null;     // realised P&L %, null for thesis drills
  baseXp: number;            // drill's base XP (scaled by score for the award)
}

// Records a drill result (episode or thesis). XP is awarded once, on the first
// clear (≥1 star). Returns fresh stats + how much XP this call awarded.
export async function recordDrillResult(
  email: string,
  drillId: string,
  r: DrillResultInput,
): Promise<{ awardedXp: number; stats: PracticeStats }> {
  const normalized = email.toLowerCase().trim();
  const score = clampInt(r.score, 0, 100);
  const stars = clampInt(r.stars, 0, 3);

  let supabase: ReturnType<typeof getSupabaseAdmin>;
  try {
    supabase = getSupabaseAdmin();
  } catch (err) {
    console.error("[practice] recordDrillResult unavailable:", msg(err));
    return { awardedXp: 0, stats: EMPTY_STATS };
  }

  const { data: existing } = await supabase
    .from("practice_progress")
    .select("drill_id, best_score, best_stars, best_pnl_pct, xp_awarded, attempts")
    .eq("email", normalized)
    .eq("drill_id", drillId)
    .single();

  let awardedXp = 0;

  if (existing) {
    const ex = existing as ProgressRow;
    // Award XP once: only if never awarded before AND this attempt cleared it.
    if ((ex.xp_awarded ?? 0) === 0 && stars >= 1) awardedXp = xpForAttempt(r.baseXp, score);
    const { error } = await supabase
      .from("practice_progress")
      .update({
        best_score: Math.max(ex.best_score ?? 0, score),
        best_stars: Math.max(ex.best_stars ?? 0, stars),
        best_pnl_pct: bestPnlOf(ex.best_pnl_pct, r.pnlPct),
        xp_awarded: (ex.xp_awarded ?? 0) + awardedXp,
        attempts: (ex.attempts ?? 0) + 1,
        completed_at: new Date().toISOString(),
      })
      .eq("email", normalized)
      .eq("drill_id", drillId);
    if (error) {
      console.error("[practice] recordDrillResult update:", error.message);
      awardedXp = 0;
    }
  } else {
    if (stars >= 1) awardedXp = xpForAttempt(r.baseXp, score);
    const { error } = await supabase.from("practice_progress").insert({
      email: normalized,
      drill_id: drillId,
      best_score: score,
      best_stars: stars,
      best_pnl_pct: r.pnlPct,
      xp_awarded: awardedXp,
      attempts: 1,
      completed_at: new Date().toISOString(),
    });
    if (error) {
      console.error("[practice] recordDrillResult insert:", error.message);
      awardedXp = 0;
    }
  }

  const stats = await getPracticeStats(normalized);
  console.log(
    `[practice] result ${drillId} by ${email}: score=${score} stars=${stars} ` +
      `+${awardedXp}xp total=${stats.xp}xp lvl=${stats.level} ` +
      `(${stats.clearedDrillIds.length}/${TOTAL_DRILLS} cleared)`,
  );
  return { awardedXp, stats };
}

// Persists one AI thesis grade to the feedback history.
export async function recordThesisFeedback(
  email: string,
  drillId: string,
  submission: ThesisSubmission,
  grade: ThesisGrade,
): Promise<void> {
  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("practice_thesis_feedback").insert({
      email: email.toLowerCase().trim(),
      drill_id: drillId,
      submission,
      grade,
      overall: clampInt(grade.overall, 0, 100),
    });
    if (error) console.error("[practice] recordThesisFeedback insert:", error.message);
  } catch (err) {
    console.error("[practice] recordThesisFeedback unavailable:", msg(err));
  }
}

export interface ThesisFeedbackRow {
  id: string;
  drillId: string;
  overall: number;
  grade: ThesisGrade;
  submission: ThesisSubmission;
  createdAt: string;
}

interface RawFeedbackRow {
  id: string;
  drill_id: string;
  overall: number;
  grade: ThesisGrade;
  submission: ThesisSubmission;
  created_at: string;
}

// Most recent thesis grades for a user (optionally for one drill).
export async function listThesisFeedback(
  email: string,
  drillId?: string,
  limit = 10,
): Promise<ThesisFeedbackRow[]> {
  try {
    const supabase = getSupabaseAdmin();
    let query = supabase
      .from("practice_thesis_feedback")
      .select("id, drill_id, overall, grade, submission, created_at")
      .eq("email", email.toLowerCase().trim())
      .order("created_at", { ascending: false })
      .limit(limit);
    if (drillId) query = query.eq("drill_id", drillId);
    const { data, error } = await query;
    if (error) {
      console.error("[practice] listThesisFeedback error:", error.message);
      return [];
    }
    return ((data ?? []) as RawFeedbackRow[]).map((r) => ({
      id: r.id,
      drillId: r.drill_id,
      overall: r.overall,
      grade: r.grade,
      submission: r.submission,
      createdAt: r.created_at,
    }));
  } catch (err) {
    console.error("[practice] listThesisFeedback unavailable:", msg(err));
    return [];
  }
}
