"use client";

// Tiny first-party analytics beacon (~1KB, no external script, no cookies).
// Stores a random visitor id + first-touch UTM in localStorage and POSTs events
// to /api/analytics/collect via sendBeacon (survives page unload). Every call is
// wrapped so analytics can never throw into a user interaction.

const ANON_KEY = "cvq_anon";
const UTM_KEY = "cvq_utm";
const ENDPOINT = "/api/analytics/collect";

interface StoredUtm {
  source?: string | null;
  medium?: string | null;
  campaign?: string | null;
}

function getAnonId(): string {
  try {
    let id = localStorage.getItem(ANON_KEY);
    if (!id) {
      id =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `a_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      localStorage.setItem(ANON_KEY, id);
    }
    return id;
  } catch {
    return "anon";
  }
}

// First-touch attribution: only the FIRST visit's UTM is kept, so we credit the
// channel that actually acquired the visitor, not the last page they landed on.
export function captureUtmFirstTouch(): void {
  try {
    if (localStorage.getItem(UTM_KEY)) return;
    const p = new URLSearchParams(window.location.search);
    const utm: StoredUtm = {
      source: p.get("utm_source"),
      medium: p.get("utm_medium"),
      campaign: p.get("utm_campaign"),
    };
    if (utm.source || utm.medium || utm.campaign) {
      localStorage.setItem(UTM_KEY, JSON.stringify(utm));
    }
  } catch {
    /* localStorage unavailable — skip attribution, still track events */
  }
}

function getUtm(): StoredUtm | null {
  try {
    const raw = localStorage.getItem(UTM_KEY);
    return raw ? (JSON.parse(raw) as StoredUtm) : null;
  } catch {
    return null;
  }
}

export function track(event: string, meta: Record<string, unknown> = {}): void {
  try {
    if (typeof window === "undefined") return;
    const body = JSON.stringify({
      event,
      anonId: getAnonId(),
      path: window.location.pathname,
      referrer: document.referrer || null,
      utm: getUtm(),
      meta,
    });

    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      navigator.sendBeacon(ENDPOINT, new Blob([body], { type: "application/json" }));
      return;
    }
    void fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    });
  } catch {
    /* never let analytics break a user interaction */
  }
}
