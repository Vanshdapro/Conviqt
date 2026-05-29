// Alpha Tracker unlock logic — server-only.
//
// Users pay credits ONCE per publication (run_id) to reveal that batch of
// picks. After unlocking they re-view those same picks for free, forever.
// When a NEW publication (new run_id) drops, they must unlock again — but
// only for the new content. The atomic deduct + unlock-row insert lives in
// the unlock_alpha() Postgres function (migration 005).

import { getSupabaseAdmin } from "./supabase";

/** Credits charged to reveal one Alpha publication. */
export const ALPHA_UNLOCK_COST = 30;

/** True if the user has already paid to unlock this publication. */
export async function isUnlocked(email: string, runId: string): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("alpha_unlocks")
    .select("run_id")
    .eq("email", email.toLowerCase().trim())
    .eq("run_id", runId)
    .limit(1);

  if (error) {
    console.error("[alphaUnlock] isUnlocked error:", error.message);
    return false;
  }
  return (data ?? []).length > 0;
}

/**
 * Atomically unlock a publication for a user. Charges ALPHA_UNLOCK_COST unless
 * already unlocked (free re-view). Returns the RPC result:
 *   { ok, already, remaining }
 */
export async function unlockAlpha(
  email: string,
  runId: string,
): Promise<{ ok: boolean; already: boolean; remaining: number }> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.rpc("unlock_alpha", {
    p_email:  email.toLowerCase().trim(),
    p_run_id: runId,
    p_cost:   ALPHA_UNLOCK_COST,
  });

  if (error) {
    console.error("[alphaUnlock] unlockAlpha RPC error:", error.message);
    return { ok: false, already: false, remaining: 0 };
  }

  const result = data as { ok: boolean; already: boolean; remaining: number };
  console.log(
    `[alphaUnlock] ${email} run=${runId} → ok=${result.ok} already=${result.already} remaining=${result.remaining}`,
  );
  return result;
}
