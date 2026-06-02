// GET /api/newsletter/confirm?token=...  — double opt-in confirmation.
//
// Clicked from the confirmation email. Flips a 'pending' row to 'confirmed'
// and redirects to the /newsletter page with a status banner. No auth: the
// one-time confirm_token IS the proof of intent.

import { NextResponse } from "next/server";
import { getNewsletterStore } from "@/lib/newsletter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token") ?? "";
  const dest = new URL("/newsletter", url.origin);

  if (!token) {
    dest.searchParams.set("status", "invalid");
    return NextResponse.redirect(dest);
  }

  try {
    const email = await getNewsletterStore().confirmByToken(token);
    if (email) {
      console.log(`[newsletter/confirm] confirmed ${email}`);
      dest.searchParams.set("status", "confirmed");
    } else {
      console.log("[newsletter/confirm] no match for token");
      dest.searchParams.set("status", "invalid");
    }
  } catch (err) {
    console.error(
      "[newsletter/confirm] threw:",
      err instanceof Error ? err.message : err
    );
    dest.searchParams.set("status", "error");
  }

  return NextResponse.redirect(dest);
}
