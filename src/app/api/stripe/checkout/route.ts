// POST /api/stripe/checkout
//
// Creates a Stripe Checkout Session. Since Phase 7 the consumer offer is the
// Pro subscription only (pro_monthly | pro_annual, both with a 7-day trial).
// Credit packs and the Max plans are retired — not purchasable here anymore.
// Developer plans remain purchasable until the /developers surface retires
// in Phase 8.
//
// Body:   { plan: PlanId }
// Returns: { url: string }  — Stripe-hosted checkout URL to redirect to.
//
// The email is ALWAYS the verified session email — never client-supplied —
// so the webhook upgrades the account that actually paid.

import { NextResponse } from "next/server";
import {
  getStripe,
  getPriceId,
  getSiteUrl,
  SUBSCRIPTION_PLANS,
  PURCHASABLE_PLANS,
  PRO_PLANS,
  TRIAL_DAYS,
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

  if (!plan || !PURCHASABLE_PLANS.has(plan as PlanId)) {
    return NextResponse.json(
      { error: `Invalid plan "${plan}". Valid plans: ${[...PURCHASABLE_PLANS].join(", ")}` },
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
  const isPro    = PRO_PLANS.has(plan as PlanId);

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
        ? {
            subscription_data: {
              metadata: { plan },
              // Pro starts with a free week (playbook 2.4). Card up front,
              // first charge after the trial — Stripe emails the reminder.
              ...(isPro ? { trial_period_days: TRIAL_DAYS } : {}),
            },
          }
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
