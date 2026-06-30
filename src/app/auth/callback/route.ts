// Email-confirmation / OAuth callback. Supabase redirects here with a `code`
// after the user clicks the verification link. We exchange it for a session
// cookie, then send them on to their destination.

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { sendWelcomeOnce } from "@/lib/lifecycleEmail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") || "/research";

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.error("[auth/callback] exchange error:", error.message);
      return NextResponse.redirect(
        new URL(`/login?error=${encodeURIComponent("Verification link is invalid or expired.")}`, url.origin)
      );
    }

    // First time this user lands here verified, send the welcome email. It's
    // deduped in lifecycle_email_log, so the OAuth-login and password-reset
    // paths that also hit this callback never re-send. Awaited (one insert +
    // one Resend call, ~300ms) but fully guarded — a failure must never block
    // the user's redirect into the app.
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user?.email && user.email_confirmed_at) {
        const name = (user.user_metadata?.full_name as string | undefined) ?? null;
        await sendWelcomeOnce(user.email, name);
      }
    } catch (err) {
      console.error("[auth/callback] welcome email skipped:", err instanceof Error ? err.message : err);
    }
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
