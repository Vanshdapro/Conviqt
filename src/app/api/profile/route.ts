// GET  /api/profile — identity + plan + onboarding state for the logged-in user.
// POST /api/profile — save onboarding answers / dismiss the tour.
//
// This is the shell's one identity endpoint (Phase 7): the account menu reads
// the plan label here, the onboarding sheet reads/writes its state here, and
// the first-run tour marks itself dismissed-forever here. No credit numbers
// in the response — metering is internal.
//
// POST body (all optional):
//   { investorStyle, experienceLevel, watchTickers: string[],
//     onboarded: true, tourDismissed: true }
// watchTickers seeds the Watching list (idempotent, capped at MAX_WATCHLIST).

import { NextResponse } from "next/server";
import { getVerifiedUser } from "@/lib/auth";
import {
  getProfile,
  upsertProfile,
  getDeepUsage,
  type InvestorStyle,
  type ProfilePatch,
} from "@/lib/profile";
import type { ExperienceLevel } from "@/lib/agents/audience";
import { getSubscriberByEmail, isPremium, isTrialing, grantFreeMonthIfEligible } from "@/lib/subscription";
import { getWatchlistStore, MAX_WATCHLIST, WatchlistFullError } from "@/lib/watchlist";
import { VALID_TICKER_RE } from "@/lib/agents/router";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STYLES = new Set<InvestorStyle>(["steady", "balanced", "growth", "bold"]);
const LEVELS = new Set<ExperienceLevel>(["new", "learning", "experienced"]);

async function profilePayload(user: { id: string; email: string; name: string | null; createdAt: string }) {
  await grantFreeMonthIfEligible(user);

  const [profile, subscriber, usage] = await Promise.all([
    getProfile(user.email),
    getSubscriberByEmail(user.email),
    getDeepUsage(user.email),
  ]);

  const pro = isPremium(subscriber);
  return {
    email: user.email,
    name: user.name,
    investorStyle: profile.investorStyle,
    experienceLevel: profile.experienceLevel,
    onboarded: !!profile.onboardedAt,
    tourDismissed: !!profile.tourDismissedAt,
    plan: pro ? "pro" : "free",
    trialing: isTrialing(subscriber),
    // Free-tier meter for the paywall sheet ("X of 5 used this month").
    deepUsed: usage.used,
    deepLimit: usage.limit,
  };
}

export async function GET() {
  const user = await getVerifiedUser();
  if (!user) {
    return NextResponse.json({ error: "auth_required" }, { status: 401 });
  }

  try {
    return NextResponse.json(await profilePayload(user));
  } catch (err) {
    console.error("[profile] GET error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "profile_unavailable" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const user = await getVerifiedUser();
  if (!user) {
    return NextResponse.json({ error: "auth_required" }, { status: 401 });
  }

  let body: {
    investorStyle?: string;
    experienceLevel?: string;
    watchTickers?: unknown;
    onboarded?: boolean;
    tourDismissed?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  try {
    const patch: ProfilePatch = {};
    if (body.investorStyle !== undefined && STYLES.has(body.investorStyle as InvestorStyle)) {
      patch.investorStyle = body.investorStyle as InvestorStyle;
    }
    if (body.experienceLevel !== undefined && LEVELS.has(body.experienceLevel as ExperienceLevel)) {
      patch.experienceLevel = body.experienceLevel as ExperienceLevel;
    }
    if (body.onboarded === true) patch.onboardedAt = new Date().toISOString();
    if (body.tourDismissed === true) patch.tourDismissedAt = new Date().toISOString();

    if (Object.keys(patch).length > 0) {
      await upsertProfile(user.email, patch);
    }

    // Seed the Watching list from onboarding step 3. Idempotent — re-adding a
    // watched ticker is a no-op; the 10-ticker cap just stops the seeding.
    const rawTickers = Array.isArray(body.watchTickers) ? body.watchTickers : [];
    const tickers = Array.from(
      new Set(
        rawTickers
          .filter((t): t is string => typeof t === "string")
          .map((t) => t.toUpperCase().trim())
          .filter((t) => VALID_TICKER_RE.test(t))
      )
    ).slice(0, MAX_WATCHLIST);

    if (tickers.length > 0) {
      const store = getWatchlistStore();
      for (const ticker of tickers) {
        try {
          await store.add(user.email, ticker);
        } catch (err) {
          if (err instanceof WatchlistFullError) break;
          console.error(`[profile] watchlist seed failed for ${ticker}:`, err instanceof Error ? err.message : err);
        }
      }
      console.log(`[profile] seeded ${tickers.length} watch ticker(s) for ${user.email}`);
    }

    return NextResponse.json(await profilePayload(user));
  } catch (err) {
    console.error("[profile] POST error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "profile_save_failed" }, { status: 500 });
  }
}
