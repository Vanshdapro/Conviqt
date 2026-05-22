import { createClient } from "@supabase/supabase-js";

// Mirror the same dev-mode .env.local fallback pattern as anthropic.ts.
// Claude Code's shell environment injects empty NEXT_PUBLIC_* vars that shadow
// what .env.local sets — so we parse the file directly when values are empty.
function readEnvLocal(): Map<string, string> {
  if (process.env.NODE_ENV !== "development") return new Map();
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require("fs") as typeof import("fs");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require("path") as typeof import("path");
    const text = fs.readFileSync(path.resolve(process.cwd(), ".env.local"), "utf8");
    const map = new Map<string, string>();
    for (const line of text.split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.+)$/);
      if (m) map.set(m[1], m[2].trim());
    }
    return map;
  } catch {
    return new Map();
  }
}

function resolveVar(name: string): string {
  const fromEnv = process.env[name] ?? "";
  if (fromEnv.trim()) return fromEnv.trim();
  return readEnvLocal().get(name) ?? fromEnv;
}

function getUrl(): string {
  const url = resolveVar("NEXT_PUBLIC_SUPABASE_URL");
  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set");
  return url;
}

// Admin client — uses service role key. Server-only. Never expose to the browser.
export function getSupabaseAdmin() {
  const key = resolveVar("SUPABASE_SERVICE_ROLE_KEY");
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  return createClient(getUrl(), key, { auth: { persistSession: false } });
}

// Anon client — uses public anon key. Safe for server-side reads.
export function getSupabaseAnon() {
  const key = resolveVar("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  if (!key) throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY is not set");
  return createClient(getUrl(), key, { auth: { persistSession: false } });
}
