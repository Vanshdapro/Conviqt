// Two-layer cache for market data: in-process memory (fast, per-lambda) over
// Supabase (shared across instances and users — the layer that actually
// saves feed requests in production).
//
// TTLs (CLAUDE.md): quotes + key stats 15 min, history 24 h.
//
// Supabase table: marketdata_cache (migration 020). TTL is enforced at READ
// time in this file — the table just stores payload + fetched_at, so one
// table serves every TTL class. If the table doesn't exist yet (migration
// not applied) or Supabase is down, we log once and fall through to the
// providers: a cache must never take the data path down with it.

import { cacheGet, cacheSet } from "../cache";
import { getSupabaseAdmin } from "../supabase";

export const QUOTE_TTL_MS = 15 * 60 * 1000;
export const STATS_TTL_MS = 15 * 60 * 1000;
export const HISTORY_TTL_MS = 24 * 60 * 60 * 1000;

// Negative cache: when every provider failed we remember the miss briefly so
// a busy page doesn't hammer dead feeds on every render. Short on purpose —
// feeds recover, and we want to notice when they do.
export const UNAVAILABLE_TTL_MS = 60 * 1000;

const TABLE = "marketdata_cache";

// Warn about a broken Supabase cache once per process, not once per request.
let supabaseCacheBroken = false;

function warnSupabaseOnce(op: string, err: unknown) {
  if (supabaseCacheBroken) return;
  supabaseCacheBroken = true;
  console.warn(
    `[marketdata:cache] Supabase ${op} failed — running on in-process cache only. ` +
      `Has migration 020_marketdata_cache.sql been applied? Error: ${
        err instanceof Error ? err.message : err
      }`
  );
}

async function supabaseRead<T>(key: string, ttlMs: number): Promise<T | undefined> {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from(TABLE)
      .select("payload, fetched_at")
      .eq("cache_key", key)
      .maybeSingle();
    if (error) {
      warnSupabaseOnce("read", error.message);
      return undefined;
    }
    if (!data) return undefined;
    const age = Date.now() - new Date(data.fetched_at as string).getTime();
    if (!Number.isFinite(age) || age > ttlMs) return undefined;
    return data.payload as T;
  } catch (err) {
    warnSupabaseOnce("read", err);
    return undefined;
  }
}

function supabaseWrite(key: string, payload: unknown): void {
  // Fire-and-forget: a cache write must never add latency or failure modes
  // to the request that produced the data.
  (async () => {
    try {
      const supabase = getSupabaseAdmin();
      const { error } = await supabase
        .from(TABLE)
        .upsert({ cache_key: key, payload, fetched_at: new Date().toISOString() });
      if (error) warnSupabaseOnce("write", error.message);
    } catch (err) {
      warnSupabaseOnce("write", err);
    }
  })();
}

// Read-through cache. `fetcher` runs only on a full miss; its result is
// written to both layers. Returns undefined ONLY when fetcher throws/returns
// null — the caller decides what "unavailable" looks like.
export async function cachedFetch<T>(
  key: string,
  ttlMs: number,
  fetcher: () => Promise<T | null>
): Promise<T | null> {
  const mem = cacheGet<T | "UNAVAILABLE">(key);
  if (mem === "UNAVAILABLE") return null;
  if (mem !== undefined) return mem;

  const fromDb = await supabaseRead<T>(key, ttlMs);
  if (fromDb !== undefined) {
    // Seed memory with the REMAINING shared-cache lifetime so both layers
    // expire together (memory TTL still capped at the class TTL).
    cacheSet(key, fromDb, ttlMs);
    return fromDb;
  }

  const fresh = await fetcher();
  if (fresh === null) {
    cacheSet(key, "UNAVAILABLE", UNAVAILABLE_TTL_MS);
    return null;
  }
  cacheSet(key, fresh, ttlMs);
  supabaseWrite(key, fresh);
  return fresh;
}
