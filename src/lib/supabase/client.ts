"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

// Browser-side Supabase client for auth (login, signup, logout).
//
// IMPORTANT: this MUST be a singleton. createBrowserClient() spins up a
// GoTrueClient that coordinates token refresh across tabs via the Web Locks
// API (navigator.locks). Creating a fresh client on every sign-in call (as the
// login/signup forms used to) produces multiple GoTrueClient instances that
// contend for the same lock — signInWithPassword() then hangs indefinitely
// ("Signing in…" forever) until a full page reload tears down the duplicates.
// Memoizing one instance per browser session eliminates the deadlock.
//
// NEXT_PUBLIC_* vars are inlined at build time, so they must be present in the
// build environment (locally in .env.local and on Vercel).
let browserClient: SupabaseClient | null = null;

export function createSupabaseBrowserClient(): SupabaseClient {
  if (browserClient) return browserClient;
  browserClient = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  return browserClient;
}
