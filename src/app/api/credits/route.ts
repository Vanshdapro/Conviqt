// GET /api/credits
//
// Returns the current credit balance + plan for the LOGGED-IN user.
// Identity comes from the Supabase session — there is no email query param,
// so a user can only ever read their own balance.
//
// Also lazily provisions the free tier: a verified user with no credit row yet
// gets their 50 free credits here (and the monthly refresh if due).
//
// Response:
//   { email, credits, plan, credits_reset_at } on success
//   { error: "auth_required" } with 401 if not signed in / not verified

import { NextResponse } from "next/server";
import { getCredits, grantFreeCreditsIfDue } from "@/lib/credits";
import { getVerifiedUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getVerifiedUser();
  if (!user) {
    return NextResponse.json({ error: "auth_required" }, { status: 401 });
  }

  // Provision 50 free credits on first access (only verified users reach here).
  await grantFreeCreditsIfDue(user.email);

  const row = await getCredits(user.email);
  if (!row) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json(row);
}
