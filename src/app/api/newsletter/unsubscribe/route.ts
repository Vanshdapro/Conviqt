// GET /api/newsletter/unsubscribe?token=...  — one-click unsubscribe.
//
// Linked from the footer of every digest. No auth (the stable unsubscribe_token
// is the credential), no confirmation step — one click leaves the list, as
// good-citizen / CAN-SPAM practice requires. Redirects to /newsletter with a
// status banner.

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
    const email = await getNewsletterStore().unsubscribeByToken(token);
    if (email) {
      console.log(`[newsletter/unsubscribe] unsubscribed ${email}`);
      dest.searchParams.set("status", "unsubscribed");
    } else {
      dest.searchParams.set("status", "invalid");
    }
  } catch (err) {
    console.error(
      "[newsletter/unsubscribe] threw:",
      err instanceof Error ? err.message : err
    );
    dest.searchParams.set("status", "error");
  }

  return NextResponse.redirect(dest);
}
