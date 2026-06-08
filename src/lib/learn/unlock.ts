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

// Returns true when a PostgREST / Postgres error indicates the function doesn't exist.
function isMissingFnError(code: string | undefined, message: string | undefined): boolean {
  return (
    code === "PGRST202" ||
    code === "42883" ||
    /function .* does not exist/i.test(message ?? "") ||
    /unlock_lesson/.test(message ?? "")
  );
}

/**
 * Fallback for unlock_lesson when migration 010 hasn't been applied.
 * Uses the migration-004 deduct_credits function + a direct learn_unlocks insert.
 */
async function unlockLessonFallback(
  email: string,
  lessonId: string,
  cost: number,
): Promise<{ ok: boolean; already: boolean; remaining: number }> {
  console.warn("[learnUnlock] unlock_lesson RPC missing — using deduct_credits fallback");
  const normalizedEmail = email.toLowerCase().trim();
  const supabase = getSupabaseAdmin();

  // Already unlocked? A read error here (e.g. the learn_unlocks table doesn't
  // exist yet) MUST abort before we touch credits — otherwise we'd charge the
  // user and then be unable to record the unlock, leaving them paid-but-locked.
  const { data: existing, error: existingErr } = await supabase
    .from("learn_unlocks")
    .select("lesson_id")
    .eq("email", normalizedEmail)
    .eq("lesson_id", lessonId)
    .limit(1);

  if (existingErr) {
    throw new Error(`learn_unlocks unavailable (pre-charge check): ${existingErr.message}`);
  }

  if (existing && existing.length > 0) {
    const { data: row } = await supabase
      .from("user_credits")
      .select("credits")
      .eq("email", normalizedEmail)
      .single();
    return { ok: true, already: true, remaining: (row as { credits: number } | null)?.credits ?? 0 };
  }

  // Deduct credits atomically (migration 004 — always present).
  const { data: deductData, error: deductErr } = await supabase.rpc("deduct_credits", {
    p_email: normalizedEmail,
    p_credits: cost,
    p_reason: "learn_unlock",
    p_cost_usd: 0,
  });

  if (deductErr) throw new Error(`deduct_credits RPC failed: ${deductErr.message}`);

  const deduct = deductData as { ok: boolean; remaining: number };
  if (!deduct.ok) return { ok: false, already: false, remaining: deduct.remaining };

  // Record the unlock row (upsert so a concurrent race doesn't double-error).
  // CRITICAL: if this insert fails, the credits we just deducted bought the
  // user nothing — so we refund them and surface the failure as a 500 instead
  // of returning a misleading "ok". This is the exact bug that let users pay
  // repeatedly for a lesson that never unlocked.
  const { error: insertErr } = await supabase
    .from("learn_unlocks")
    .upsert({ email: normalizedEmail, lesson_id: lessonId, credits_paid: cost }, { onConflict: "email,lesson_id" });

  if (insertErr) {
    console.error("[learnUnlock] unlock insert failed after charge — refunding:", insertErr.message);
    const { error: refundErr } = await supabase.rpc("add_credits", {
      p_email: normalizedEmail,
      p_credits: cost,
      p_reason: "learn_unlock_refund",
    });
    if (refundErr) {
      console.error("[learnUnlock] REFUND ALSO FAILED — manual credit owed:", normalizedEmail, cost, refundErr.message);
    }
    throw new Error(`learn_unlocks insert failed (refunded ${cost}cr): ${insertErr.message}`);
  }

  return { ok: true, already: false, remaining: deduct.remaining };
}

/**
 * Atomically unlock one lesson. Charges lessonUnlockCost unless already
 * unlocked or free. Returns { ok, already, remaining }.
 * Throws on unexpected RPC errors so the caller returns 500, not a misleading 402.
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
    console.error("[learnUnlock] unlockLesson RPC error:", error.code, error.message);
    if (isMissingFnError(error.code, error.message)) {
      return unlockLessonFallback(email, lessonId, lessonUnlockCost(lessonId));
    }
    throw new Error(`unlock_lesson RPC failed: ${error.message}`);
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
 * Throws on unexpected RPC errors so the caller returns 500, not a misleading 402.
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
    console.error("[learnUnlock] unlockAllLessons RPC error:", error.code, error.message);
    throw new Error(`unlock_lessons_bulk RPC failed: ${error.message}`);
  }

  const result = data as { ok: boolean; unlocked: number; charged: number; remaining: number };
  console.log(
    `[learnUnlock] ${email} unlock-all → ok=${result.ok} unlocked=${result.unlocked} charged=${result.charged} remaining=${result.remaining}`,
  );
  return result;
}
