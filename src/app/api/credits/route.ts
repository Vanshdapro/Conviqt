// GET /api/credits?email=user@example.com
//
// Returns the current credit balance for the given email.
// Used by the chat UI to show the live credit indicator.
//
// Response:
//   { email, credits, plan, credits_reset_at } on success
//   { error: "not_found" } with 404 if the email has no row yet
//   { error: "email required" } with 400 if email is missing

import { NextResponse } from "next/server";
import { getCredits } from "@/lib/credits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url   = new URL(req.url);
  const email = url.searchParams.get("email");

  if (!email || typeof email !== "string" || !email.includes("@")) {
    return NextResponse.json({ error: "email required" }, { status: 400 });
  }

  const row = await getCredits(email.toLowerCase().trim());

  if (!row) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json(row);
}
