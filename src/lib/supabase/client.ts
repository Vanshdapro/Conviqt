"use client";

import { createBrowserClient } from "@supabase/ssr";

// Browser-side Supabase client for auth (login, signup, logout).
// NEXT_PUBLIC_* vars are inlined at build time, so they must be present in the
// build environment (locally in .env.local and on Vercel).
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
