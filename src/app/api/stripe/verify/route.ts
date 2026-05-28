// GET /api/stripe/verify?session_id=...
//
// Called from the /pricing success redirect. Verifies the Checkout Session
// and returns the email, plan, and current credit balance so the UI can
// show a personalised confirmation message.

import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { getCredits } from "@/lib/credits";

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
    const plan  = session.metadata?.plan ?? null;

    // Fetch live credit balance so the banner can show it
    const creditRow = email ? await getCredits(email) : null;
    const credits   = creditRow?.credits ?? null;

    console.log(`[stripe/verify] session ${sessionId} ok — ${email} / ${plan} / ${credits} credits`);

    return NextResponse.json({ ok: true, email, plan, mode: session.mode, credits });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[stripe/verify] error:", msg);
    return NextResponse.json({ error: "Failed to verify session." }, { status: 502 });
  }
}
