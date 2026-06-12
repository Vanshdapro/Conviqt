// Conviqt Learn — lesson access reads (server-only).
//
// Phase 8 retired the per-lesson credit unlock: access is plan-based now
// (fundamentals free for everyone, the full catalog with Pro — see
// FREE_LESSON_IDS in curriculum.ts and the gate in /api/learn). What remains
// here is the READ side: lessons users bought one-by-one in the credit era
// live in learn_unlocks and stay theirs forever, so the access check and the
// progress payload still honor those rows. The spend RPCs (unlock_lesson /
// unlock_lessons_bulk, migration 010) are no longer called from app code.

import { getSupabaseAdmin } from "../supabase";
import { FREE_LESSON_IDS } from "./curriculum";

/** All lesson ids this user unlocked in the credit era (free ids are implicit). */
export async function getUnlockedLessonIds(email: string): Promise<string[]> {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("learn_unlocks")
      .select("lesson_id")
      .eq("email", email.toLowerCase().trim());
    if (error) {
      console.error("[learnUnlock] getUnlockedLessonIds error:", error.message);
      return [];
    }
    return (data ?? []).map((r) => r.lesson_id as string);
  } catch (err) {
    console.error("[learnUnlock] getUnlockedLessonIds unavailable:", err instanceof Error ? err.message : err);
    return [];
  }
}

/** True if the user can open this lesson without Pro (free tier or legacy unlock). */
export async function isLessonUnlocked(email: string, lessonId: string): Promise<boolean> {
  if (FREE_LESSON_IDS.has(lessonId)) return true;
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("learn_unlocks")
      .select("lesson_id")
      .eq("email", email.toLowerCase().trim())
      .eq("lesson_id", lessonId)
      .limit(1);
    if (error) {
      console.error("[learnUnlock] isLessonUnlocked error:", error.message);
      return false;
    }
    return (data ?? []).length > 0;
  } catch (err) {
    console.error("[learnUnlock] isLessonUnlocked unavailable:", err instanceof Error ? err.message : err);
    return false;
  }
}
