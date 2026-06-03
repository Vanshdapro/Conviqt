// Conviqt Learn — per-lesson unlock logic (server-only).
//
// Lessons are static, in-repo content with no per-open API cost. A user pays
// credits ONCE to unlock a lesson, then re-opens it free forever. The atomic
// deduct + unlock-row insert lives in the unlock_lesson / unlock_lessons_bulk
// Postgres functions (migration 010).
//
// Lesson unlock pricing (1 credit ≈ 1¢; credit packs: 500 credits = $5):
//   a single lesson is a one-time 10-credit unlock, then free forever.
//   "Unlock everything" is 8 credits per still-locked lesson (a ~20% bundle
//   discount). The first lesson is free.

import { getSupabaseAdmin } from "../supabase";
import {
  FREE_LESSON_IDS,
  PER_LESSON_UNLOCK_COST,
  BUNDLE_RATE_PER_LESSON,
  lessonUnlockCost,
} from "./curriculum";

// Pricing is defined in the (client-safe) catalog module so the dashboard can
// read it without bundling this server-only file. Re-exported here so existing
// server callers can keep importing pricing from "./unlock".
export { PER_LESSON_UNLOCK_COST, BUNDLE_RATE_PER_LESSON, lessonUnlockCost };

/** All lesson ids this user has paid to unlock (free lessons are implicit). */
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

/** True if the user can open this lesson (free preview or already unlocked). */
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

/**
 * Atomically unlock one lesson. Charges lessonUnlockCost unless already
 * unlocked or free. Returns { ok, already, remaining }.
 */
export async function unlockLesson(
  email: string,
  lessonId: string,
): Promise<{ ok: boolean; already: boolean; remaining: number }> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.rpc("unlock_lesson", {
    p_email: email.toLowerCase().trim(),
    p_lesson_id: lessonId,
    p_cost: lessonUnlockCost(lessonId),
  });

  if (error) {
    console.error("[learnUnlock] unlockLesson RPC error:", error.message);
    return { ok: false, already: false, remaining: 0 };
  }

  const result = data as { ok: boolean; already: boolean; remaining: number };
  console.log(
    `[learnUnlock] ${email} lesson=${lessonId} → ok=${result.ok} already=${result.already} remaining=${result.remaining}`,
  );
  return result;
}

/**
 * Atomically unlock every still-locked lesson in `lessonIds` at the bundle rate.
 * Returns { ok, unlocked, charged, remaining }.
 */
export async function unlockAllLessons(
  email: string,
  lessonIds: string[],
): Promise<{ ok: boolean; unlocked: number; charged: number; remaining: number }> {
  // The free preview lesson never needs paying for — drop it from the charge set.
  const payable = lessonIds.filter((id) => !FREE_LESSON_IDS.has(id));
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.rpc("unlock_lessons_bulk", {
    p_email: email.toLowerCase().trim(),
    p_lesson_ids: payable,
    p_rate: BUNDLE_RATE_PER_LESSON,
  });

  if (error) {
    console.error("[learnUnlock] unlockAllLessons RPC error:", error.message);
    return { ok: false, unlocked: 0, charged: 0, remaining: 0 };
  }

  const result = data as { ok: boolean; unlocked: number; charged: number; remaining: number };
  console.log(
    `[learnUnlock] ${email} unlock-all → ok=${result.ok} unlocked=${result.unlocked} charged=${result.charged} remaining=${result.remaining}`,
  );
  return result;
}
