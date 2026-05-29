// POST /api/stripe/checkout
//
// Creates a Stripe Checkout Session for:
//   - One-time credit packs  (credits_500 | credits_1000 | credits_2000 | credits_3000)
//   - Recurring subscriptions (max_monthly | max_pro_monthly)
//
// Body:   { plan: PlanId }
// Returns: { url: string }  — Stripe-hosted checkout URL to redirect to.
//
// The email is ALWAYS the verified session email — never client-supplied —
// so the webhook credits the account that actually paid.

import { NextResponse } from "next/server";
import {
  getStripe,
  getPriceId,
  getSiteUrl,
  SUBSCRIPTION_PLANS,
  ALL_PLANS,
  type PlanId,
} from "@/lib/stripe";
import { getVerifiedUser } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const user = await getVerifiedUser();
  if (!user) {
    return NextResponse.json({ error: "auth_required" }, { status: 401 });
  }
  const email = user.email;

  let body: { plan?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { plan } = body;

  if (!plan || !ALL_PLANS.has(plan)) {
    return NextResponse.json(
      { error: `Invalid plan "${plan}". Valid plans: ${[...ALL_PLANS].join(", ")}` },
      { status: 400 }
    );
  }

  let priceId: string;
  try {
    priceId = getPriceId(plan as PlanId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[stripe/checkout] price ID missing:", msg);
    return NextResponse.json(
      { error: "This plan is not yet configured for payment. Try again soon." },
      { status: 503 }
    );
  }

  const stripe   = getStripe();
  const siteUrl  = getSiteUrl();
  const isSub    = SUBSCRIPTION_PLANS.has(plan as PlanId);

  try {
    const session = await stripe.checkout.sessions.create({
      mode:       isSub ? "subscription" : "payment",
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: email,
      success_url: `${siteUrl}/pricing?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${siteUrl}/pricing?canceled=true`,
      allow_promotion_codes:      true,
      billing_address_collection: "auto",
      metadata: { plan },
      ...(isSub
        ? { subscription_data: { metadata: { plan } } }
        : { payment_intent_data: { metadata: { plan } } }),
    });

    console.log(`[stripe/checkout] created session ${session.id} plan=${plan}`);
    return NextResponse.json({ url: session.url });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[stripe/checkout] Stripe error:", msg);
    return NextResponse.json({ error: "Failed to create checkout session." }, { status: 502 });
  }
}
