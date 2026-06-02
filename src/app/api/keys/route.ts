// Authenticated developer API-key management (session-cookie auth, not bearer).
// Powers the dashboard panel on /developers.
//
//   GET    /api/keys            → { account, keys[] }   (plaintext never returned)
//   POST   /api/keys            → { id, key, prefix }   (plaintext shown ONCE)
//   DELETE /api/keys?id=<id>    → { revoked: true }
//
// Every handler resolves the email from the verified session — never the
// client — so a user can only ever see or mutate their own keys.

import { NextResponse } from "next/server";
import { getVerifiedUser } from "@/lib/auth";
import {
  createApiKey,
  revokeApiKey,
  listApiKeys,
  getDeveloperAccount,
} from "@/lib/apiKeys";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getVerifiedUser();
  if (!user) return NextResponse.json({ error: "auth_required" }, { status: 401 });

  try {
    const [keys, account] = await Promise.all([
      listApiKeys(user.email),
      getDeveloperAccount(user.email),
    ]);
    return NextResponse.json({ account, keys });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[api/keys] GET error:", msg);
    return NextResponse.json({ error: "Could not load API keys." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const user = await getVerifiedUser();
  if (!user) return NextResponse.json({ error: "auth_required" }, { status: 401 });

  let name = "default";
  try {
    const body = (await req.json()) as { name?: unknown };
    if (typeof body.name === "string" && body.name.trim()) name = body.name.trim();
  } catch {
    // No body is fine — fall back to the default label.
  }

  // Cap keys per developer to keep the table tidy and bound abuse.
  const existing = await listApiKeys(user.email);
  if (existing.length >= 10) {
    return NextResponse.json(
      { error: "Key limit reached (10 active). Revoke one before creating another." },
      { status: 409 }
    );
  }

  try {
    const created = await createApiKey(user.email, name);
    return NextResponse.json({
      id: created.id,
      key: created.plaintext, // shown exactly once — the client must copy it now
      prefix: created.prefix,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[api/keys] POST error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const user = await getVerifiedUser();
  if (!user) return NextResponse.json({ error: "auth_required" }, { status: 401 });

  const id = Number(new URL(req.url).searchParams.get("id"));
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Valid key id required." }, { status: 400 });
  }

  const revoked = await revokeApiKey(user.email, id);
  if (!revoked) {
    return NextResponse.json({ error: "Key not found or already revoked." }, { status: 404 });
  }
  return NextResponse.json({ revoked: true });
}
