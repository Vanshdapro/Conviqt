// Conviqt Learn — per-user progress store (server-only).
//
// Progress lives in learn_progress (one row per email+lesson). XP, level, and
// streak are derived from those rows so there is a single source of truth and no
// way to desync a denormalized counter. Service-role client bypasses RLS; the
// route guarantees the email comes from the verified session, never the client.

import { getSupabaseAdmin } from "../supabase";
import { TOTAL_LESSONS } from "./curriculum";
import { levelForXp } from "./types";
import type { LearnStats } from "./types";

interface ProgressRow {
  lesson_id: string;
  xp_awarded: number;
  best_quiz_pct: number;
  completed_at: string;
}

// Reads all of a user's completed lessons and derives stats + streak.
export async function getLearnStats(email: string): Promise<LearnStats> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("learn_progress")
    .select("lesson_id, xp_awarded, best_quiz_pct, completed_at")
    .eq("email", email.toLowerCase().trim());

  if (error) {
    console.error("[learn] getLearnStats error:", error.message);
    return { xp: 0, level: 1, streakDays: 0, completedLessonIds: [] };
  }

  const rows = (data ?? []) as ProgressRow[];
  const xp = rows.reduce((sum, r) => sum + (r.xp_awarded ?? 0), 0);
  const completedLessonIds = rows.map((r) => r.lesson_id);
  const streakDays = computeStreak(rows.map((r) => r.completed_at));

  return { xp, level: levelForXp(xp), streakDays, completedLessonIds };
}

// Records a lesson completion. XP is awarded once per lesson (first completion);
// re-completing only updates the best quiz score. Returns the fresh stats and
// whether this call awarded new XP.
export async function recordCompletion(
  email: string,
  lessonId: string,
  xp: number,
  quizPct: number,
): Promise<{ awardedXp: number; stats: LearnStats }> {
  const supabase = getSupabaseAdmin();
  const normalized = email.toLowerCase().trim();
  const pct = Math.max(0, Math.min(100, Math.round(quizPct)));

  const { data: existing } = await supabase
    .from("learn_progress")
    .select("lesson_id, xp_awarded, best_quiz_pct")
    .eq("email", normalized)
    .eq("lesson_id", lessonId)
    .single();

  let awardedXp = 0;

  if (existing) {
    // Already completed — keep XP, raise best score only.
    const bestPct = Math.max(existing.best_quiz_pct ?? 0, pct);
    await supabase
      .from("learn_progress")
      .update({ best_quiz_pct: bestPct, completed_at: new Date().toISOString() })
      .eq("email", normalized)
      .eq("lesson_id", lessonId);
  } else {
    awardedXp = xp;
    const { error } = await supabase.from("learn_progress").insert({
      email: normalized,
      lesson_id: lessonId,
      xp_awarded: xp,
      best_quiz_pct: pct,
      completed_at: new Date().toISOString(),
    });
    if (error) {
      console.error("[learn] recordCompletion insert error:", error.message);
      awardedXp = 0;
    }
  }

  const stats = await getLearnStats(normalized);
  console.log(
    `[learn] completion ${lessonId} by ${email}: +${awardedXp}xp quiz=${pct}% ` +
      `total=${stats.xp}xp lvl=${stats.level} (${stats.completedLessonIds.length}/${TOTAL_LESSONS})`,
  );
  return { awardedXp, stats };
}

// Streak = consecutive days (ending today or yesterday) with at least one
// completion. A gap of more than one day breaks it.
function computeStreak(timestamps: string[]): number {
  if (timestamps.length === 0) return 0;

  const days = new Set<string>();
  for (const ts of timestamps) {
    const d = new Date(ts);
    if (!Number.isNaN(d.getTime())) days.add(dayKey(d));
  }

  const today = new Date();
  const todayKey = dayKey(today);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = dayKey(yesterday);

  // Streak only counts if the user studied today or yesterday.
  if (!days.has(todayKey) && !days.has(yesterdayKey)) return 0;

  let streak = 0;
  const cursor = new Date(today);
  // If they haven't studied today yet, start counting from yesterday.
  if (!days.has(todayKey)) cursor.setDate(cursor.getDate() - 1);

  while (days.has(dayKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
}
