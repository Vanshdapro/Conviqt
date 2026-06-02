// POST /api/newsletter/subscribe  — join the Disagreement Digest (Deliverable 6).
//
// Public, no auth. Double opt-in: we create a 'pending' row and email a confirm
// link. The address is NOT on the list until they click that link, so this
// endpoint can't be abused to add someone who didn't ask.
//
// Body: { email: string, source?: string }
// Responses are intentionally uniform ("check your inbox") regardless of whether
// the address was new / pending / already-confirmed, so the endpoint can't be
// used to enumerate who is already subscribed.

import { NextResponse } from "next/server";
import { getNewsletterStore, isValidEmail } from "@/lib/newsletter";
import { buildConfirmEmail } from "@/lib/newsletterEmail";
import { sendEmail } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NEWSLETTER_FROM =
  process.env.NEWSLETTER_FROM?.trim() || "Conviqt Digest <digest@conviqt.com>";

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      email?: unknown;
      source?: unknown;
    };
    const email = typeof body.email === "string" ? body.email.trim() : "";
    const source =
      typeof body.source === "string" ? body.source.slice(0, 40) : "subscribe_api";

    if (!email || !isValidEmail(email)) {
      return NextResponse.json(
        { ok: false, error: "Enter a valid email address." },
        { status: 400 }
      );
    }

    const store = getNewsletterStore();
    const { subscriber, outcome } = await store.subscribe(email, source);

    // Already confirmed → nothing to send. Uniform success message.
    if (outcome === "confirmed") {
      console.log(`[newsletter/subscribe] ${email} already confirmed — no email`);
      return NextResponse.json({
        ok: true,
        status: "already_subscribed",
        message: "You're already on the list.",
      });
    }

    // created / pending / resubscribe → (re)send the confirmation email.
    const { subject, html, text } = buildConfirmEmail(subscriber.confirmToken);
    const res = await sendEmail({
      to: email,
      subject,
      html,
      text,
      from: NEWSLETTER_FROM,
    });

    if (!res.sent && res.skipped !== "not_configured") {
      console.error(`[newsletter/subscribe] confirm email to ${email} failed: ${res.error}`);
      return NextResponse.json(
        { ok: false, error: "Could not send the confirmation email. Try again shortly." },
        { status: 502 }
      );
    }

    console.log(
      `[newsletter/subscribe] ${email} outcome=${outcome} emailSent=${res.sent} skipped=${res.skipped ?? "-"}`
    );
    return NextResponse.json({
      ok: true,
      status: "pending_confirmation",
      message: "Check your inbox to confirm your subscription.",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[newsletter/subscribe] threw:", msg);
    return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
  }
}
