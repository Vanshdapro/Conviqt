// GET /api/stripe/verify?session_id=...
//
// Called from the /pricing success redirect. Verifies the Checkout Session and
// — critically — grants the purchased credits if the webhook hasn't already.
//
// This is the resilience layer: the Stripe webhook is still the primary path,
// but if it never fires (endpoint not registered, wrong signing secret, wrong
// URL) the customer would be charged and never credited. Granting here too,
// keyed on the checkout session id via addCreditsOnce, guarantees the credits
// land exactly once regardless of which path runs first.

import { NextResponse } from "next/server";
import { getStripe, CREDITS_BY_PLAN, type PlanId } from "@/lib/stripe";
import { getCredits, addCreditsOnce } from "@/lib/credits";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url       = new URL(req.url);
  const sessionId = url.searchParams.get("session_id");

  if (!sessionId) {
    return NextResponse.json({ error: "Missing session_id." }, { status: 400 });
  }

  const stripe = getStripe();

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["subscription"],
    });

    if (session.payment_status !== "paid" && session.status !== "complete") {
      return NextResponse.json({ error: "Payment not completed." }, { status: 402 });
    }

    const email = session.customer_details?.email ?? session.customer_email ?? null;
    const plan  = (session.metadata?.plan ?? null) as PlanId | null;
    const expectedCredits = plan ? CREDITS_BY_PLAN[plan] ?? null : null;

    // `credited` tracks whether the purchased credits are actually on the
    // account (either we just granted them, or a prior webhook/verify did).
    // This is what the success page trusts — we never claim success blindly.
    let credited = false;

    // Fallback grant — idempotent, so it's a no-op if the webhook already ran.
    if (email && plan && expectedCredits) {
      try {
        const result = await addCreditsOnce(
          email,
          expectedCredits,
          `stripe_session_${session.id}`,
          plan,
        );
        // granted === true  → we just credited (webhook had missed it).
        // granted === false → already credited earlier. Either way the credits
        // are on the account now.
        credited = true;
        if (result.granted) {
          console.warn(`[stripe/verify] webhook missed — granted ${expectedCredits} via fallback for ${email} (${plan})`);
        }
      } catch (grantErr) {
        // The payment succeeded but we couldn't credit. Do NOT pretend it
        // worked — surface it so the page shows a "credits pending" state and
        // we get a loud server log to act on.
        console.error("[stripe/verify] GRANT FAILED for paid session", session.id, "—", grantErr instanceof Error ? grantErr.message : grantErr);
      }
    }

    // Fetch live credit balance so the banner can show it
    const creditRow = email ? await getCredits(email) : null;
    const credits   = creditRow?.credits ?? null;

    console.log(`[stripe/verify] session ${sessionId} ok — ${email} / ${plan} / ${credits} credits / credited=${credited}`);

    return NextResponse.json({ ok: true, email, plan, mode: session.mode, credits, credited, expectedCredits });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[stripe/verify] error:", msg);
    return NextResponse.json({ error: "Failed to verify session." }, { status: 502 });
  }
}
