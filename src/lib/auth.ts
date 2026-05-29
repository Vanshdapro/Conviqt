// Server-only auth helpers. The session user's email is the single source of
// truth for credits and gating — it is verified against Supabase on every call
// (getUser validates the JWT), so it can never be spoofed by the client.

import { createSupabaseServerClient } from "./supabase/server";

export interface SessionUser {
  id: string;
  email: string;
  emailVerified: boolean;
  name: string | null;
}

export async function getSessionUser(): Promise<SessionUser | null> {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user || !user.email) return null;

    return {
      id: user.id,
      email: user.email.toLowerCase().trim(),
      emailVerified: !!user.email_confirmed_at,
      name: (user.user_metadata?.full_name as string | undefined) ?? null,
    };
  } catch (err) {
    // Misconfigured env or transient Supabase failure → treat as logged out
    // (fail-closed). Callers return 401 / redirect to login, never a 500.
    console.error("[auth] getSessionUser error:", err instanceof Error ? err.message : err);
    return null;
  }
}

// Returns the user only if they are signed in AND email-verified.
// Verified-only access is what prevents fake-email free-credit farming.
export async function getVerifiedUser(): Promise<SessionUser | null> {
  const user = await getSessionUser();
  if (!user || !user.emailVerified) return null;
  return user;
}
