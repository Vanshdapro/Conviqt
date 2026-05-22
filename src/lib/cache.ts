// In-process TTL cache. Used for:
// - Council results by ticker (15-minute TTL by default, configurable)
// - Picker results (5-minute TTL)
// - Recently surfaced pick tickers (24-hour memory) so the picker can
//   avoid repeating itself
//
// Like the rate limiter, this is per-server-instance. On Vercel each
// lambda gets its own cache. Worth migrating to Supabase for global
// consistency, but per-instance still cuts cost on warm function reuse.

interface Entry<T> {
  value: T;
  expiresAt: number;
}

const STORE = new Map<string, Entry<unknown>>();

function now() {
  return Date.now();
}

export function cacheGet<T>(key: string): T | undefined {
  const e = STORE.get(key) as Entry<T> | undefined;
  if (!e) return undefined;
  if (e.expiresAt < now()) {
    STORE.delete(key);
    return undefined;
  }
  return e.value;
}

export function cacheSet<T>(key: string, value: T, ttlMs: number) {
  STORE.set(key, { value, expiresAt: now() + ttlMs });
}

export function cacheDelete(key: string) {
  STORE.delete(key);
}

// Picker memory: a rolling 24h record of tickers we've surfaced. Stored
// as a single cache entry with a Set of {ticker, atMs}.
const PICKER_MEMORY_KEY = "picker:recent";
const PICKER_MEMORY_TTL_MS = 7 * 24 * 60 * 60 * 1000; // keep the entry around a week
const PICKER_RECENT_WINDOW_MS = 24 * 60 * 60 * 1000;

interface PickerMemoryEntry {
  ticker: string;
  atMs: number;
}

export function pickerRecentTickers(): string[] {
  const list = cacheGet<PickerMemoryEntry[]>(PICKER_MEMORY_KEY) ?? [];
  const cutoff = now() - PICKER_RECENT_WINDOW_MS;
  return list.filter((e) => e.atMs >= cutoff).map((e) => e.ticker);
}

export function pickerRecordTickers(tickers: string[]) {
  if (tickers.length === 0) return;
  const list = cacheGet<PickerMemoryEntry[]>(PICKER_MEMORY_KEY) ?? [];
  const t = now();
  const next: PickerMemoryEntry[] = [
    ...list,
    ...tickers.map((ticker) => ({ ticker, atMs: t })),
  ];
  // Trim to last 200 entries to bound memory.
  cacheSet(PICKER_MEMORY_KEY, next.slice(-200), PICKER_MEMORY_TTL_MS);
}

// Convenience builders for council / pick cache keys.
export function councilCacheKey(ticker: string, focus?: string) {
  // 4-hour buckets. The bucket determines the key — requests for the same
  // ticker within a 4h window share a key and hit cache after the first run.
  // Combined with the 4h TTL this effectively gives a per-ticker result for
  // the entire trading session without re-running the expensive council.
  const bucket = Math.floor(now() / (4 * 60 * 60 * 1000));
  const focusSig = focus
    ? `:f=${focus.slice(0, 40).toLowerCase().replace(/\s+/g, "_")}`
    : "";
  return `council:${ticker.toUpperCase()}:${bucket}${focusSig}`;
}

export const COUNCIL_CACHE_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours

export const PICKER_CACHE_TTL_MS = 5 * 60 * 1000;
export const PICKER_CACHE_KEY = "picker:result";
