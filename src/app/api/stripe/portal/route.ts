// POST /api/stripe/portal
//
// Creates a Stripe Customer Portal session so subscribers can manage their
// plan, update payment method, or cancel.
//
// No body — the email is the verified session email.
// Returns: { url: string }
//
// Requires the Billing Portal to be configured in the Stripe Dashboard:
// Settings → Billing → Customer portal

import { NextResponse } from "next/server";
import { getStripe, getSiteUrl } from "@/lib/stripe";
import { getSubscriberByEmail } from "@/lib/subscription";
import { getVerifiedUser } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST() {
  const user = await getVerifiedUser();
  if (!user) {
    return NextResponse.json({ error: "auth_required" }, { status: 401 });
  }
  const email = user.email;

  const subscriber = await getSubscriberByEmail(email);
  if (!subscriber) {
    return NextResponse.json(
      { error: "No subscription found for this email." },
      { status: 404 }
    );
  }

  const stripe = getStripe();
  const siteUrl = getSiteUrl();

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: subscriber.stripe_customer_id,
      return_url: `${siteUrl}/pricing`,
    });

    console.log(`[stripe/portal] created portal session for ${email}`);
    return NextResponse.json({ url: session.url });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[stripe/portal] Stripe error:", msg);
    return NextResponse.json(
      { error: "Failed to create billing portal session." },
      { status: 502 }
    );
  }
}
