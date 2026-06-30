// POST/GET /api/lifecycle/sweep — the day-3 re-engagement nudge (Kill #2).
//
// Once a day it finds users who:
//   • verified their email,
//   • signed up 3–10 days ago, and
//   • have never run a single analysis (zero analysis_history rows),
// and sends each a one-time re-engagement email. The CTA lands them on a live
// Quick Take, so the click delivers the product, not another login screen.
//
// Bounds & safety:
//   • The 3–10 day window means brand-new users (still in their first 3 days)
//     aren't nagged, and cold long-dormant accounts aren't surprise-blasted —
//     so the first deploy doesn't email the entire back catalogue.
//   • Idempotency is in lifecycle_email_log (kind='reengage_d3'): we claim
//     before sending, so a retry can never double-send.
//   • Email only — no model spend, so no daily-budget gate is needed. Resend's
//     free tier (3k/day) carries this comfortably.
//
// Auth: bearer CRON_SECRET (the GitHub Actions cron) or ALPHA_RUN_SECRET
// (manual). Same pattern as /api/watchlist/sweep.

import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { sendReengageOnce } from "@/lib/lifecycleEmail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const DAY_MS = 24 * 60 * 60 * 1000;
const MIN_AGE_MS = 3 * DAY_MS; // don't nag before day 3
const MAX_AGE_MS = 10 * DAY_MS; // don't surprise-blast cold accounts
const PER_PAGE = 1000;

function isAuthorized(req: Request): boolean {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  const cronSecret = process.env.CRON_SECRET;
  const alphaSecret = process.env.ALPHA_RUN_SECRET;
  if (cronSecret && token === cronSecret) return true;
  if (alphaSecret && token === alphaSecret) return true;
  return false;
}

// Has this email ever completed (and saved) an analysis? Head count keeps it a
// cheap existence check, not a row pull.
async function hasRunAnalysis(email: string): Promise<boolean> {
  const { count, error } = await getSupabaseAdmin()
    .from("analysis_history")
    .select("email", { count: "exact", head: true })
    .eq("email", email.toLowerCase().trim());
  if (error) {
    // Fail closed on the "is active" check: if we can't tell, assume active so
    // we never email someone who actually did use the product.
    console.error(`[lifecycle/sweep] history check failed for ${email}:`, error.message);
    return true;
  }
  return (count ?? 0) > 0;
}

async function handle(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = Date.now();
  let scanned = 0;
  let eligible = 0;
  let sent = 0;
  let duplicate = 0;
  let failed = 0;
  const failures: string[] = [];

  try {
    const admin = getSupabaseAdmin();

    for (let page = 1; ; page++) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: PER_PAGE });
      if (error) {
        console.error("[lifecycle/sweep] listUsers error:", error.message);
        break;
      }
      const users = data.users ?? [];
      scanned += users.length;

      for (const u of users) {
        if (!u.email || !u.email_confirmed_at) continue;
        const age = now - new Date(u.created_at).getTime();
        if (age < MIN_AGE_MS || age > MAX_AGE_MS) continue;

        if (await hasRunAnalysis(u.email)) continue;
        eligible += 1;

        const name = (u.user_metadata?.full_name as string | undefined) ?? null;
        const result = await sendReengageOnce(u.email, name);
        if (result === "sent") sent += 1;
        else if (result === "duplicate") duplicate += 1;
        else {
          failed += 1;
          failures.push(u.email);
        }
      }

      if (users.length < PER_PAGE) break;
    }

    console.log(
      `[lifecycle/sweep] done — scanned=${scanned} eligible=${eligible} ` +
        `sent=${sent} duplicate=${duplicate} failed=${failed}`
    );

    return NextResponse.json({
      success: true,
      scanned,
      eligible,
      sent,
      duplicate,
      failed,
      failures,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[lifecycle/sweep] threw:", msg);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
