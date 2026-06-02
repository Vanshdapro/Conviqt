// /api/leaderboard/profile
//
// The signed-in trader's own leaderboard identity + notional account.
//
// GET  → { profile, account, standing }
//          profile  — handle / display name / opt-in (null if never claimed)
//          account  — the live $100k account summary from their paper positions
//          standing — their current-week leaderboard row (rank + score), if opted in
// POST → claim/update handle + opt-in. { handle, displayName?, optedIn }
//          Validates the handle and enforces case-insensitive uniqueness.
//
// Identity always comes from the verified session — never the client. Free: no
// model spend (DB reads/writes only).

import { NextResponse } from "next/server";
import { getVerifiedUser } from "@/lib/auth";
import { listPaperPositions } from "@/lib/practice/paper";
import { summarizeAccount } from "@/lib/practice/account";
import {
  getProfile,
  upsertProfile,
  getMyWeeklyStanding,
} from "@/lib/practice/leaderboard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 15;

export async function GET() {
  try {
    const user = await getVerifiedUser();
    if (!user) return NextResponse.json({ error: "auth_required" }, { status: 401 });

    const [profile, positions] = await Promise.all([
      getProfile(user.email),
      listPaperPositions(user.email),
    ]);
    const account = summarizeAccount(positions);
    const standing =
      profile?.optedIn && profile.handle
        ? await getMyWeeklyStanding(profile.handle)
        : null;

    return NextResponse.json({ profile, account, standing });
  } catch (err) {
    console.error("[leaderboard] profile GET error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getVerifiedUser();
    if (!user) return NextResponse.json({ error: "auth_required" }, { status: 401 });

    let body: Record<string, unknown>;
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: "bad_request" }, { status: 400 });
    }

    const handle = typeof body.handle === "string" ? body.handle : "";
    const displayName = typeof body.displayName === "string" ? body.displayName : null;
    const optedIn = body.optedIn !== false; // default to opting in when claiming

    const result = await upsertProfile(user.email, { handle, displayName, optedIn });
    if (!result.ok) {
      const status = result.error === "store_error" ? 500 : 409;
      const code = result.error === "bad_handle" ? 400 : status;
      return NextResponse.json({ error: result.error }, { status: code });
    }

    const standing = result.profile.optedIn
      ? await getMyWeeklyStanding(result.profile.handle)
      : null;
    return NextResponse.json({ profile: result.profile, standing });
  } catch (err) {
    console.error("[leaderboard] profile POST error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
