// GET /api/stripe/verify?session_id=...
//
// Called from the /pricing success redirect. Verifies the Checkout Session and
// — critically — applies the entitlement if the webhook hasn't already:
// Pro subscriptions get their plan state upserted, legacy packs get their
// credits granted (idempotent via addCreditsOnce).
//
// This is the resilience layer: the Stripe webhook is still the primary path,
// but if it never fires (endpoint not registered, wrong signing secret, wrong
// URL) the customer would be charged and never upgraded. Both paths are
// idempotent, so it's safe regardless of which runs first.

import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripe, CREDITS_BY_PLAN, PRO_PLANS, type PlanId } from "@/lib/stripe";
import { getCredits, addCreditsOnce } from "@/lib/credits";
import { upsertSubscriber, type Plan } from "@/lib/subscription";

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

    // Pro subscription → plan state fallback (mirror of the webhook upsert;
    // upsertSubscriber is a plain upsert, so double-running is harmless).
    let proActive = false;
    if (email && plan && PRO_PLANS.has(plan)) {
      const sub = session.subscription as Stripe.Subscription | null;
      const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id ?? null;
      if (sub && customerId) {
        try {
          await upsertSubscriber({
            email,
            stripe_customer_id: customerId,
            subscription_id: sub.id,
            subscription_status: sub.status,
            plan: plan as Plan,
            current_period_end: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
          });
          proActive = ["active", "trialing"].includes(sub.status);
        } catch (subErr) {
          console.error("[stripe/verify] PRO upsert failed for paid session", session.id, "—", subErr instanceof Error ? subErr.message : subErr);
        }
      }
    }

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

    return NextResponse.json({ ok: true, email, plan, mode: session.mode, credits, credited, expectedCredits, proActive });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[stripe/verify] error:", msg);
    return NextResponse.json({ error: "Failed to verify session." }, { status: 502 });
  }
}
