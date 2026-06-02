// Watchlist persistence (Deliverable 3).
//
// One row per (email, ticker). Users track up to MAX_WATCHLIST tickers; the cap
// is enforced here so the API and UI get a clean typed error rather than a DB
// constraint violation.
//
// Auto-selects backend (same pattern as stockReports.ts / alphaStore.ts):
//   - Supabase  when NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY set
//   - JSON file (data/watchlist.json) otherwise — local dev without Supabase
//
// Also holds the alert idempotency ledger (watchlist_alert_log) helpers, since
// they share the same backend selection and are only ever used together with
// the watchlist by the alert cron.

import fs from "fs";
import path from "path";

export const MAX_WATCHLIST = 10;

export interface WatchlistEntry {
  ticker: string;
  createdAt: string; // ISO
}

export type AlertType = "earnings" | "disagreement";

export class WatchlistFullError extends Error {
  constructor() {
    super(`Watchlist is full — remove a ticker first (max ${MAX_WATCHLIST}).`);
    this.name = "WatchlistFullError";
  }
}

export interface WatchlistStore {
  list(email: string): Promise<WatchlistEntry[]>;
  add(email: string, ticker: string): Promise<WatchlistEntry[]>;
  remove(email: string, ticker: string): Promise<WatchlistEntry[]>;
  // Every distinct ticker watched by anyone — the cron's work set.
  distinctTickers(): Promise<string[]>;
  // (email, ticker) pairs across all users — who to alert about what.
  allWatchers(): Promise<Array<{ email: string; ticker: string }>>;

  // Alert ledger. recordAlert returns true if this is the FIRST time this exact
  // trigger fired for this user+ticker (i.e. we should send), false if it was
  // already logged (dedup hit). The write is atomic so concurrent cron runs
  // can't both win.
  recordAlert(
    email: string,
    ticker: string,
    type: AlertType,
    triggerKey: string
  ): Promise<boolean>;
}

// --------------------------------------------------------------------------
// File store (local dev, no Supabase required)
// --------------------------------------------------------------------------

const WATCHLIST_FILE = path.resolve(process.cwd(), "data/watchlist.json");
const ALERT_LOG_FILE = path.resolve(process.cwd(), "data/watchlist-alerts.json");

interface FileWatchRow {
  email: string;
  ticker: string;
  created_at: string;
}

function readJson<T>(file: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as T;
  } catch {
    return fallback;
  }
}

function writeJson(file: string, data: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
}

class FileWatchlistStore implements WatchlistStore {
  private rows(): FileWatchRow[] {
    return readJson<FileWatchRow[]>(WATCHLIST_FILE, []);
  }

  async list(email: string): Promise<WatchlistEntry[]> {
    const e = email.toLowerCase().trim();
    return this.rows()
      .filter((r) => r.email === e)
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((r) => ({ ticker: r.ticker, createdAt: r.created_at }));
  }

  async add(email: string, ticker: string): Promise<WatchlistEntry[]> {
    const e = email.toLowerCase().trim();
    const t = ticker.toUpperCase().trim();
    const rows = this.rows();
    const mine = rows.filter((r) => r.email === e);
    if (mine.some((r) => r.ticker === t)) return this.list(email); // idempotent
    if (mine.length >= MAX_WATCHLIST) throw new WatchlistFullError();
    rows.push({ email: e, ticker: t, created_at: new Date().toISOString() });
    writeJson(WATCHLIST_FILE, rows);
    return this.list(email);
  }

  async remove(email: string, ticker: string): Promise<WatchlistEntry[]> {
    const e = email.toLowerCase().trim();
    const t = ticker.toUpperCase().trim();
    const rows = this.rows().filter((r) => !(r.email === e && r.ticker === t));
    writeJson(WATCHLIST_FILE, rows);
    return this.list(email);
  }

  async distinctTickers(): Promise<string[]> {
    return Array.from(new Set(this.rows().map((r) => r.ticker))).sort();
  }

  async allWatchers(): Promise<Array<{ email: string; ticker: string }>> {
    return this.rows().map((r) => ({ email: r.email, ticker: r.ticker }));
  }

  async recordAlert(
    email: string,
    ticker: string,
    type: AlertType,
    triggerKey: string
  ): Promise<boolean> {
    const key = `${email.toLowerCase().trim()}|${ticker.toUpperCase()}|${type}|${triggerKey}`;
    const log = readJson<Record<string, string>>(ALERT_LOG_FILE, {});
    if (log[key]) return false;
    log[key] = new Date().toISOString();
    writeJson(ALERT_LOG_FILE, log);
    return true;
  }
}

// --------------------------------------------------------------------------
// Supabase store
// --------------------------------------------------------------------------

class SupabaseWatchlistStore implements WatchlistStore {
  private async db() {
    const { getSupabaseAdmin } = await import("./supabase");
    return getSupabaseAdmin();
  }

  async list(email: string): Promise<WatchlistEntry[]> {
    const db = await this.db();
    const { data, error } = await db
      .from("watchlist")
      .select("ticker, created_at")
      .eq("email", email.toLowerCase().trim())
      .order("created_at", { ascending: true });
    if (error) throw new Error(`watchlist.list: ${error.message}`);
    return (data ?? []).map((r) => {
      const row = r as { ticker: string; created_at: string };
      return { ticker: row.ticker, createdAt: row.created_at };
    });
  }

  async add(email: string, ticker: string): Promise<WatchlistEntry[]> {
    const db = await this.db();
    const e = email.toLowerCase().trim();
    const t = ticker.toUpperCase().trim();

    // Enforce the cap. count + insert isn't a transaction, but the worst case
    // under a race is an 11th row — acceptable, and the UI re-reads the list.
    const { count, error: countErr } = await db
      .from("watchlist")
      .select("ticker", { count: "exact", head: true })
      .eq("email", e);
    if (countErr) throw new Error(`watchlist.add count: ${countErr.message}`);

    const existing = await this.list(email);
    if (existing.some((r) => r.ticker === t)) return existing; // idempotent
    if ((count ?? existing.length) >= MAX_WATCHLIST) throw new WatchlistFullError();

    const { error } = await db
      .from("watchlist")
      .upsert({ email: e, ticker: t }, { onConflict: "email,ticker" });
    if (error) throw new Error(`watchlist.add: ${error.message}`);
    return this.list(email);
  }

  async remove(email: string, ticker: string): Promise<WatchlistEntry[]> {
    const db = await this.db();
    const { error } = await db
      .from("watchlist")
      .delete()
      .eq("email", email.toLowerCase().trim())
      .eq("ticker", ticker.toUpperCase().trim());
    if (error) throw new Error(`watchlist.remove: ${error.message}`);
    return this.list(email);
  }

  async distinctTickers(): Promise<string[]> {
    const db = await this.db();
    const { data, error } = await db.from("watchlist").select("ticker");
    if (error) throw new Error(`watchlist.distinctTickers: ${error.message}`);
    return Array.from(
      new Set((data ?? []).map((r) => (r as { ticker: string }).ticker))
    ).sort();
  }

  async allWatchers(): Promise<Array<{ email: string; ticker: string }>> {
    const db = await this.db();
    const { data, error } = await db.from("watchlist").select("email, ticker");
    if (error) throw new Error(`watchlist.allWatchers: ${error.message}`);
    return (data ?? []).map((r) => {
      const row = r as { email: string; ticker: string };
      return { email: row.email, ticker: row.ticker };
    });
  }

  async recordAlert(
    email: string,
    ticker: string,
    type: AlertType,
    triggerKey: string
  ): Promise<boolean> {
    const db = await this.db();
    // Insert; the UNIQUE(email,ticker,alert_type,trigger_key) constraint makes
    // this the atomic dedup. A duplicate insert returns code 23505 → already sent.
    const { error } = await db.from("watchlist_alert_log").insert({
      email: email.toLowerCase().trim(),
      ticker: ticker.toUpperCase().trim(),
      alert_type: type,
      trigger_key: triggerKey,
    });
    if (!error) return true;
    if (error.code === "23505") return false; // unique violation → dup
    throw new Error(`watchlist.recordAlert: ${error.message}`);
  }
}

// --------------------------------------------------------------------------
// Factory — auto-detects backend (mirrors stockReports.isSupabaseConfigured)
// --------------------------------------------------------------------------

export function isSupabaseConfigured(): boolean {
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

let _store: WatchlistStore | null = null;

export function getWatchlistStore(): WatchlistStore {
  if (_store) return _store;
  _store = isSupabaseConfigured()
    ? new SupabaseWatchlistStore()
    : new FileWatchlistStore();
  return _store;
}
