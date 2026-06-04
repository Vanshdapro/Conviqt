import { NextResponse } from "next/server";
import { googleCodeFor } from "@/lib/i18n/languages";

// Conviqt Translate — server-side proxy to Google's free translate endpoint.
//
// We proxy (rather than calling from the browser) for three reasons:
//   1. dodge CORS on the unofficial endpoint,
//   2. keep a warm in-memory cache so repeat phrases across users and pages
//      never re-hit Google,
//   3. keep the endpoint detail server-side so the client just talks to us.
//
// The app is authored in English, so we always translate FROM `en`. This route
// is metadata-only (it sends UI strings, never user financial data) and uses no
// paid API — it does not touch the Claude/web_search budget.

export const runtime = "nodejs";

const ENDPOINT = "https://translate.googleapis.com/translate_a/single";
const MAX_CHUNK = 1800; // keep each GET well under URL-length limits
const CONCURRENCY = 10;
const CACHE_MAX = 5000;
const FETCH_TIMEOUT_MS = 8000;

// Module-level cache survives between requests on a warm serverless instance.
const cache = new Map<string, string>();

function cacheGet(key: string): string | undefined {
  return cache.get(key);
}

function cacheSet(key: string, value: string): void {
  if (cache.size >= CACHE_MAX) {
    // Bound memory by evicting the oldest insertion.
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, value);
}

// Split a long string into pieces under the URL-length ceiling, preferring to
// break on whitespace so we don't slice through a word.
function splitLong(text: string): string[] {
  if (text.length <= MAX_CHUNK) return [text];
  const out: string[] = [];
  let rest = text;
  while (rest.length > MAX_CHUNK) {
    let cut = rest.lastIndexOf(" ", MAX_CHUNK);
    if (cut < MAX_CHUNK * 0.5) cut = MAX_CHUNK; // no usable space — hard cut
    out.push(rest.slice(0, cut));
    rest = rest.slice(cut);
  }
  if (rest) out.push(rest);
  return out;
}

async function translateOne(text: string, google: string): Promise<string> {
  const pieces = splitLong(text);
  const translated: string[] = [];

  for (const piece of pieces) {
    const url =
      `${ENDPOINT}?client=gtx&sl=en&tl=${encodeURIComponent(google)}` +
      `&dt=t&q=${encodeURIComponent(piece)}`;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        signal: ctrl.signal,
        headers: { "User-Agent": "Mozilla/5.0 (compatible; ConviqtTranslate/1.0)" },
      });
      if (!res.ok) throw new Error(`google responded ${res.status}`);
      const data = (await res.json()) as unknown;
      // Shape: [ [ ["translated", "source", ...], ... ], ... ]
      const chunks =
        Array.isArray(data) && Array.isArray(data[0]) ? (data[0] as unknown[]) : [];
      const joined = chunks
        .map((c) => (Array.isArray(c) && typeof c[0] === "string" ? c[0] : ""))
        .join("");
      translated.push(joined || piece);
    } catch (err) {
      console.error("[translate] piece failed, falling back to source:", err);
      translated.push(piece); // graceful: better to show English than nothing
    } finally {
      clearTimeout(timer);
    }
  }

  return translated.join("");
}

// Run an async worker over `items` with a bounded number of concurrent calls.
async function pool<T>(items: T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
  const queue = items.map((_, i) => i);
  const run = async () => {
    while (queue.length) {
      const i = queue.shift();
      if (i === undefined) break;
      await fn(items[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { q?: unknown; target?: unknown };
    const target = typeof body.target === "string" ? body.target : "";
    const q = Array.isArray(body.q)
      ? body.q.filter((s): s is string => typeof s === "string")
      : [];

    // Nothing to do for the source language or an empty batch.
    if (!target || target === "en" || q.length === 0) {
      return NextResponse.json({ t: q });
    }

    const google = googleCodeFor(target);

    // Dedupe identical strings so each phrase is translated at most once.
    const unique = Array.from(new Set(q));
    const resolved = new Map<string, string>();
    const misses: string[] = [];

    for (const s of unique) {
      const hit = cacheGet(`${google}::${s}`);
      if (hit !== undefined) resolved.set(s, hit);
      else misses.push(s);
    }

    await pool(misses, CONCURRENCY, async (s) => {
      const out = await translateOne(s, google);
      cacheSet(`${google}::${s}`, out);
      resolved.set(s, out);
    });

    // Return translations aligned to the original (possibly duplicated) input.
    return NextResponse.json({ t: q.map((s) => resolved.get(s) ?? s) });
  } catch (err) {
    console.error("[translate] route error:", err);
    return NextResponse.json({ error: "translate_failed" }, { status: 500 });
  }
}
