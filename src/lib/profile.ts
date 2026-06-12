// User profiles + the Free-tier deep-analysis meter (Phase 7).
//
// The 3-step onboarding stores investor style + experience level here; the
// experience level is the ONE switch that sets answer language complexity in
// every pipeline (see src/lib/agents/audience.ts). The meter counts fresh deep
// analyses per calendar month for Free users — Pro users are never metered.
//
// Auto-selects backend (same pattern as watchlist.ts / stockReports.ts):
//   - Supabase  when NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY set
//   - JSON file (data/profiles.json) otherwise — local dev without Supabase

import fs from "fs";
import path from "path";
import { isSupabaseConfigured } from "./watchlist";
import type { ExperienceLevel } from "./agents/audience";

export type InvestorStyle = "steady" | "balanced" | "growth" | "bold";

/** Fresh deep analyses included per month on the Free plan (playbook 2.4). */
export const FREE_DEEP_LIMIT = 5;

// The ONE user-facing limit message, shared by every plan-gated route.
// Copy rules (CLAUDE.md): no "credits", no "Council" in rendered text.
export const FREE_LIMIT_MSG =
  "You've used this month's 5 included deep analyses. They refresh on the 1st — or Pro removes the limit entirely.";

export interface UserProfile {
  email: string;
  investorStyle: InvestorStyle | null;
  experienceLevel: ExperienceLevel | null;
  onboardedAt: string | null;
  tourDismissedAt: string | null;
}

export interface ProfilePatch {
  investorStyle?: InvestorStyle | null;
  experienceLevel?: ExperienceLevel | null;
  onboardedAt?: string;
  tourDismissedAt?: string;
}

const EMPTY = (email: string): UserProfile => ({
  email,
  investorStyle: null,
  experienceLevel: null,
  onboardedAt: null,
  tourDismissedAt: null,
});

function norm(email: string): string {
  return email.toLowerCase().trim();
}

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7); // 'YYYY-MM' UTC
}

// ── File store (local dev, no Supabase required) ────────────────────────────

const PROFILES_FILE = path.resolve(process.cwd(), "data/profiles.json");
const USAGE_FILE = path.resolve(process.cwd(), "data/analysis-usage.json");

interface FileProfileRow {
  investor_style: InvestorStyle | null;
  experience_level: ExperienceLevel | null;
  onboarded_at: string | null;
  tour_dismissed_at: string | null;
}

function readJson<T>(file: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as T;
  } catch {
    return fallback;
  }
}

function writeJson(file: string, data: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
}

function rowToProfile(email: string, r: FileProfileRow): UserProfile {
  return {
    email,
    investorStyle: r.investor_style,
    experienceLevel: r.experience_level,
    onboardedAt: r.onboarded_at,
    tourDismissedAt: r.tour_dismissed_at,
  };
}

// ── Reads ───────────────────────────────────────────────────────────────────

export async function getProfile(email: string): Promise<UserProfile> {
  const e = norm(email);

  if (!isSupabaseConfigured()) {
    const rows = readJson<Record<string, FileProfileRow>>(PROFILES_FILE, {});
    return rows[e] ? rowToProfile(e, rows[e]) : EMPTY(e);
  }

  const { getSupabaseAdmin } = await import("./supabase");
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from("user_profiles")
    .select("investor_style, experience_level, onboarded_at, tour_dismissed_at")
    .eq("email", e)
    .single();

  if (error) {
    if (error.code !== "PGRST116") {
      console.error("[profile] getProfile error:", error.message);
    }
    return EMPTY(e);
  }
  return rowToProfile(e, data as FileProfileRow);
}

/**
 * The one read the pipelines need: the stored experience level, or null when
 * the user skipped onboarding (null = the default, maximally plain English).
 * Never throws — a profile read must not take down an analysis.
 */
export async function getExperienceLevel(email: string): Promise<ExperienceLevel | null> {
  try {
    const p = await getProfile(email);
    return p.experienceLevel;
  } catch (err) {
    console.error("[profile] getExperienceLevel error:", err instanceof Error ? err.message : err);
    return null;
  }
}

// ── Writes ──────────────────────────────────────────────────────────────────

export async function upsertProfile(email: string, patch: ProfilePatch): Promise<UserProfile> {
  const e = norm(email);

  if (!isSupabaseConfigured()) {
    const rows = readJson<Record<string, FileProfileRow>>(PROFILES_FILE, {});
    const prev = rows[e] ?? {
      investor_style: null,
      experience_level: null,
      onboarded_at: null,
      tour_dismissed_at: null,
    };
    rows[e] = {
      investor_style: patch.investorStyle !== undefined ? patch.investorStyle : prev.investor_style,
      experience_level: patch.experienceLevel !== undefined ? patch.experienceLevel : prev.experience_level,
      onboarded_at: patch.onboardedAt ?? prev.onboarded_at,
      tour_dismissed_at: patch.tourDismissedAt ?? prev.tour_dismissed_at,
    };
    writeJson(PROFILES_FILE, rows);
    return rowToProfile(e, rows[e]);
  }

  const { getSupabaseAdmin } = await import("./supabase");
  const db = getSupabaseAdmin();

  const row: Record<string, unknown> = { email: e, updated_at: new Date().toISOString() };
  if (patch.investorStyle !== undefined) row.investor_style = patch.investorStyle;
  if (patch.experienceLevel !== undefined) row.experience_level = patch.experienceLevel;
  if (patch.onboardedAt !== undefined) row.onboarded_at = patch.onboardedAt;
  if (patch.tourDismissedAt !== undefined) row.tour_dismissed_at = patch.tourDismissedAt;

  const { error } = await db.from("user_profiles").upsert(row, { onConflict: "email" });
  if (error) {
    console.error("[profile] upsertProfile error:", error.message);
    throw new Error(`profile.upsert: ${error.message}`);
  }
  console.log(`[profile] upserted ${e} (${Object.keys(patch).join(", ")})`);
  return getProfile(e);
}

// ── Free-tier deep-analysis meter ───────────────────────────────────────────

export interface DeepUsage {
  used: number;
  limit: number;
  month: string;
}

/**
 * Atomically consumes one deep analysis from this month's Free allowance.
 * Returns { allowed, used }. Callers must check the plan FIRST — Pro users
 * never reach this. Fails open on storage errors: an outage must never lock
 * paying-attention users out of the product's heart.
 */
export async function useDeepAnalysis(
  email: string,
  limit = FREE_DEEP_LIMIT
): Promise<{ allowed: boolean; used: number }> {
  const e = norm(email);
  const month = currentMonth();

  if (!isSupabaseConfigured()) {
    const usage = readJson<Record<string, number>>(USAGE_FILE, {});
    const key = `${e}|${month}`;
    const used = usage[key] ?? 0;
    if (used >= limit) return { allowed: false, used };
    usage[key] = used + 1;
    writeJson(USAGE_FILE, usage);
    return { allowed: true, used: used + 1 };
  }

  try {
    const { getSupabaseAdmin } = await import("./supabase");
    const db = getSupabaseAdmin();
    const { data, error } = await db.rpc("use_deep_analysis", {
      p_email: e,
      p_limit: limit,
    });
    if (error) {
      console.error("[profile] use_deep_analysis RPC error:", error.message);
      return { allowed: true, used: 0 }; // fail open
    }
    return data as { allowed: boolean; used: number };
  } catch (err) {
    console.error("[profile] useDeepAnalysis error:", err instanceof Error ? err.message : err);
    return { allowed: true, used: 0 }; // fail open
  }
}

/**
 * Gives a deep-analysis slot back (failed run → the user got nothing).
 * Best-effort: floors at 0, never throws.
 */
export async function refundDeepAnalysis(email: string): Promise<void> {
  const e = norm(email);
  const month = currentMonth();

  try {
    if (!isSupabaseConfigured()) {
      const usage = readJson<Record<string, number>>(USAGE_FILE, {});
      const key = `${e}|${month}`;
      usage[key] = Math.max(0, (usage[key] ?? 0) - 1);
      writeJson(USAGE_FILE, usage);
      return;
    }
    const { getSupabaseAdmin } = await import("./supabase");
    const db = getSupabaseAdmin();
    const { data } = await db
      .from("analysis_usage")
      .select("deep_count")
      .eq("email", e)
      .eq("month", month)
      .single();
    const count = (data as { deep_count: number } | null)?.deep_count ?? 0;
    if (count > 0) {
      await db
        .from("analysis_usage")
        .update({ deep_count: count - 1, updated_at: new Date().toISOString() })
        .eq("email", e)
        .eq("month", month);
    }
    console.log(`[profile] refunded deep slot for ${e} (${month})`);
  } catch (err) {
    console.error("[profile] refundDeepAnalysis error:", err instanceof Error ? err.message : err);
  }
}

/** Read-only view of this month's usage, for the profile API / paywall copy. */
export async function getDeepUsage(email: string): Promise<DeepUsage> {
  const e = norm(email);
  const month = currentMonth();

  if (!isSupabaseConfigured()) {
    const usage = readJson<Record<string, number>>(USAGE_FILE, {});
    return { used: usage[`${e}|${month}`] ?? 0, limit: FREE_DEEP_LIMIT, month };
  }

  try {
    const { getSupabaseAdmin } = await import("./supabase");
    const db = getSupabaseAdmin();
    const { data, error } = await db
      .from("analysis_usage")
      .select("deep_count")
      .eq("email", e)
      .eq("month", month)
      .single();
    if (error) {
      if (error.code !== "PGRST116") {
        console.error("[profile] getDeepUsage error:", error.message);
      }
      return { used: 0, limit: FREE_DEEP_LIMIT, month };
    }
    return { used: (data as { deep_count: number }).deep_count, limit: FREE_DEEP_LIMIT, month };
  } catch {
    return { used: 0, limit: FREE_DEEP_LIMIT, month };
  }
}
