// Server-side analytics writer.
//
// Backed by Supabase (analytics_events). No file-store fallback: analytics is a
// production/Supabase feature, and a high-volume JSON file would be a footgun.
// When Supabase isn't configured (local dev) every write is a silent no-op, so
// the beacon route and the Stripe webhook never break because analytics is off.
//
// Every write fails soft — recording an event must NEVER break the user path it
// instruments (a page view, a signup, a Stripe webhook).

import fs from "fs";
import path from "path";

export interface UtmInput {
  source?: string | null;
  medium?: string | null;
  campaign?: string | null;
}

export interface EventInput {
  event: string;
  anonId?: string | null;
  path?: string | null;
  referrer?: string | null;
  utm?: UtmInput | null;
  email?: string | null;
  meta?: Record<string, unknown>;
}

function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (url && key) return true;

  if (process.env.NODE_ENV === "development") {
    try {
      const raw = fs.readFileSync(path.resolve(process.cwd(), ".env.local"), "utf8");
      const get = (name: string) =>
        raw.match(new RegExp(`^${name}=(.+)$`, "m"))?.[1]?.trim();
      return !!(get("NEXT_PUBLIC_SUPABASE_URL") && get("SUPABASE_SERVICE_ROLE_KEY"));
    } catch {
      return false;
    }
  }
  return false;
}

// Cap free-text fields so a hostile/garbage beacon can't write huge rows.
function clip(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (!s) return null;
  return s.slice(0, max);
}

export async function recordEvent(input: EventInput): Promise<void> {
  try {
    if (!input.event || !isSupabaseConfigured()) return;
    const { getSupabaseAdmin } = await import("../supabase");
    const db = getSupabaseAdmin();
    const { error } = await db.from("analytics_events").insert({
      event: clip(input.event, 64),
      anon_id: clip(input.anonId, 64),
      path: clip(input.path, 512),
      referrer: clip(input.referrer, 1024),
      utm_source: clip(input.utm?.source, 128),
      utm_medium: clip(input.utm?.medium, 128),
      utm_campaign: clip(input.utm?.campaign, 128),
      user_email: clip(input.email, 320)?.toLowerCase() ?? null,
      meta: input.meta && typeof input.meta === "object" ? input.meta : {},
    });
    if (error) console.error("[analytics] insert failed:", error.message);
  } catch (err) {
    console.error(
      "[analytics] recordEvent failed:",
      err instanceof Error ? err.message : err
    );
  }
}

// Convenience for trusted server-side funnel events (e.g. the Stripe webhook's
// authoritative `paid`). These never come from the client beacon.
export async function recordServerEvent(
  event: string,
  opts: { email?: string | null; meta?: Record<string, unknown> } = {}
): Promise<void> {
  return recordEvent({ event, email: opts.email, meta: opts.meta });
}
