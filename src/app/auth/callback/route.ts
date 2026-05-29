// Email-confirmation / OAuth callback. Supabase redirects here with a `code`
// after the user clicks the verification link. We exchange it for a session
// cookie, then send them on to their destination.

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") || "/chat";

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.error("[auth/callback] exchange error:", error.message);
      return NextResponse.redirect(
        new URL(`/login?error=${encodeURIComponent("Verification link is invalid or expired.")}`, url.origin)
      );
    }
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
