// POST /api/redeem
//
// Redeems an Edge founding-member promo code (EDGE-XXXXXX) for free Conviqt Pro.
// The signed-in user enters their code from Edge; we validate + burn it against
// Edge's redemption service, and on success grant this account Pro at no cost
// (the Edge membership bundles Conviqt Pro). Everyone else pays $4/mo.
//
// Body:   { code: string }
// Returns 200 { ok: true, granted?: true, alreadyPro?: true }
//         4xx  { error: string }

import { NextResponse } from "next/server";
import { getVerifiedUser } from "@/lib/auth";
import {
  getSubscriberByEmail,
  upsertSubscriber,
  isPremium,
} from "@/lib/subscription";

export const runtime = "nodejs";

const EDGE_REDEEM_URL = "https://edge.thefinancialview.org/api/redeem";
const BUNDLE_MS = 365 * 24 * 60 * 60 * 1000; // Pro free for a year, renewable

export async function POST(req: Request) {
  const user = await getVerifiedUser();
  if (!user) {
    return NextResponse.json({ error: "auth_required" }, { status: 401 });
  }

  let body: { code?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const code = (body.code || "").trim().toUpperCase();
  if (!/^EDGE-[A-Z0-9]{6}$/.test(code)) {
    return NextResponse.json(
      { error: "That doesn't look like a valid Edge code." },
      { status: 400 }
    );
  }

  const secret = process.env.EDGE_REDEEM_SECRET;
  if (!secret) {
    console.error("[redeem] EDGE_REDEEM_SECRET not set");
    return NextResponse.json(
      { error: "Redemption isn't available right now." },
      { status: 503 }
    );
  }

  // Already Pro? Nothing to do — don't waste the code.
  const existing = await getSubscriberByEmail(user.email);
  if (isPremium(existing)) {
    return NextResponse.json({ ok: true, alreadyPro: true }, { status: 200 });
  }

  // Validate + burn the code against Edge.
  let result: { status?: string } | null = null;
  try {
    const res = await fetch(EDGE_REDEEM_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify({ code, redeemer: user.email }),
    });
    result = await res.json().catch(() => null);
  } catch (err) {
    console.error("[redeem] Edge request failed:", err);
    return NextResponse.json(
      { error: "Couldn't reach the redemption service. Please try again." },
      { status: 502 }
    );
  }

  if (result?.status === "redeemed") {
    await upsertSubscriber({
      email: user.email,
      stripe_customer_id: `edge_${user.id ?? user.email}`,
      subscription_status: "active",
      plan: "promo_free_month",
      current_period_end: new Date(Date.now() + BUNDLE_MS).toISOString(),
    });
    console.log(`[redeem] granted Conviqt Pro to ${user.email} via ${code}`);
    return NextResponse.json({ ok: true, granted: true }, { status: 200 });
  }

  if (result?.status === "already_redeemed") {
    return NextResponse.json(
      { error: "That code has already been redeemed." },
      { status: 409 }
    );
  }

  return NextResponse.json(
    { error: "That code isn't valid." },
    { status: 404 }
  );
}
