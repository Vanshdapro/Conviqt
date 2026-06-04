// POST /api/analytics/collect
//
// The first-party beacon endpoint. The client (src/lib/analytics/track.ts) posts
// page_view + funnel events here via navigator.sendBeacon. We stamp the
// signed-in email server-side for funnel events (never trusting the client for
// identity), then insert via the service role. Always returns 204 and never
// throws — a failed analytics write must not surface to the user.
//
// Disallowed for crawlers by robots.ts (/api/), so bots never inflate counts.

import { recordEvent } from "@/lib/analytics/server";
import { getVerifiedUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Payload {
  event?: string;
  anonId?: string;
  path?: string;
  referrer?: string | null;
  utm?: { source?: string | null; medium?: string | null; campaign?: string | null } | null;
  meta?: Record<string, unknown>;
}

export async function POST(req: Request) {
  try {
    // sendBeacon may send as text/plain; parse the raw body either way.
    const raw = await req.text();
    const data = (raw ? JSON.parse(raw) : {}) as Payload;

    const event = typeof data.event === "string" ? data.event.slice(0, 64) : "";
    if (!event) return new Response(null, { status: 204 });

    // Attach the verified email only for low-volume funnel events. page_view is
    // the hot path — skip the Supabase auth round-trip there to keep it cheap.
    let email: string | null = null;
    if (event !== "page_view") {
      try {
        email = (await getVerifiedUser())?.email ?? null;
      } catch {
        email = null;
      }
    }

    await recordEvent({
      event,
      anonId: data.anonId ?? null,
      path: data.path ?? null,
      referrer: data.referrer ?? null,
      utm: data.utm ?? null,
      email,
      meta: data.meta && typeof data.meta === "object" ? data.meta : {},
    });

    return new Response(null, { status: 204 });
  } catch (err) {
    console.error("[analytics/collect] failed:", err instanceof Error ? err.message : err);
    return new Response(null, { status: 204 });
  }
}
