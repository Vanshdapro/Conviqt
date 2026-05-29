// Storage abstraction for the Alpha Tracker.
//
// Auto-selects backend:
//   - Supabase  when NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are set
//   - JSON file (data/alpha-picks.json) otherwise — for local dev without Supabase
//
// Both backends expose the same interface so the pipeline and API routes are
// oblivious to which one is in use.

import fs from "fs";
import path from "path";
import type { AlphaPick } from "./alphaTypes";

// --------------------------------------------------------------------------
// Interface
// --------------------------------------------------------------------------

export interface AlphaStore {
  fetchActive(): Promise<AlphaPick[]>;
  markSold(id: string, price: number, reason: string): Promise<void>;
  updatePrice(id: string, currentPrice: number, changePct: number, date: string): Promise<void>;
  insert(pick: Omit<AlphaPick, "id" | "created_at">): Promise<void>;
  hasPicksForRunId(runId: string): Promise<boolean>;
  fetchRecentlySold(sinceDaysAgo: number): Promise<AlphaPick[]>;
  lastRunDate(): Promise<string | null>;
  /**
   * The most recent active publication: the run_id shared by the newest batch
   * of active picks, plus the date it was created. Used to gate Alpha unlocks
   * per-publication. Returns null when there are no active picks.
   */
  currentPublication(): Promise<{ runId: string; publishedDate: string } | null>;
}

// --------------------------------------------------------------------------
// File store (local dev, no Supabase required)
// --------------------------------------------------------------------------

const FILE_PATH = path.resolve(process.cwd(), "data/alpha-picks.json");

function readFile(): AlphaPick[] {
  try {
    const raw = fs.readFileSync(FILE_PATH, "utf8");
    return JSON.parse(raw) as AlphaPick[];
  } catch {
    return [];
  }
}

function writeFile(picks: AlphaPick[]): void {
  fs.mkdirSync(path.dirname(FILE_PATH), { recursive: true });
  fs.writeFileSync(FILE_PATH, JSON.stringify(picks, null, 2), "utf8");
}

function makeId(): string {
  return (crypto as { randomUUID?(): string }).randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

class FileAlphaStore implements AlphaStore {
  async fetchActive(): Promise<AlphaPick[]> {
    return readFile().filter((p) => p.status === "ACTIVE");
  }

  async markSold(id: string, price: number, reason: string): Promise<void> {
    const picks = readFile();
    const today = new Date().toISOString().slice(0, 10);
    const idx = picks.findIndex((p) => p.id === id);
    if (idx === -1) throw new Error(`FileAlphaStore: pick ${id} not found`);
    picks[idx] = {
      ...picks[idx],
      status: "SOLD",
      exit_date: today,
      exit_price: price > 0 ? price : null,
      exit_reason: reason,
    };
    writeFile(picks);
  }

  async updatePrice(id: string, currentPrice: number, changePct: number, date: string): Promise<void> {
    const picks = readFile();
    const idx = picks.findIndex((p) => p.id === id);
    if (idx === -1) throw new Error(`FileAlphaStore: pick ${id} not found for price update`);
    picks[idx] = {
      ...picks[idx],
      current_price: currentPrice,
      price_change_pct: changePct,
      price_last_updated: date,
    };
    writeFile(picks);
  }

  async insert(pick: Omit<AlphaPick, "id" | "created_at">): Promise<void> {
    const picks = readFile();
    picks.unshift({
      ...pick,
      id: makeId(),
      created_at: new Date().toISOString(),
    });
    writeFile(picks);
  }

  async hasPicksForRunId(runId: string): Promise<boolean> {
    return readFile().some((p) => p.run_id === runId);
  }

  async fetchRecentlySold(sinceDaysAgo: number): Promise<AlphaPick[]> {
    const cutoff = new Date(Date.now() - sinceDaysAgo * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    return readFile().filter(
      (p) => p.status === "SOLD" && p.exit_date && p.exit_date >= cutoff
    );
  }

  async lastRunDate(): Promise<string | null> {
    const picks = readFile();
    if (picks.length === 0) return null;
    const sorted = [...picks].sort((a, b) =>
      (b.created_at ?? "").localeCompare(a.created_at ?? "")
    );
    return sorted[0].created_at?.slice(0, 10) ?? null;
  }

  async currentPublication(): Promise<{ runId: string; publishedDate: string } | null> {
    const active = readFile().filter((p) => p.status === "ACTIVE");
    if (active.length === 0) return null;
    const newest = [...active].sort((a, b) =>
      (b.created_at ?? "").localeCompare(a.created_at ?? "")
    )[0];
    return {
      runId: newest.run_id,
      publishedDate: (newest.created_at ?? newest.entry_date).slice(0, 10),
    };
  }
}

// --------------------------------------------------------------------------
// Supabase store
// --------------------------------------------------------------------------

class SupabaseAlphaStore implements AlphaStore {
  private async db() {
    const { getSupabaseAdmin } = await import("./supabase");
    return getSupabaseAdmin();
  }

  async fetchActive(): Promise<AlphaPick[]> {
    const db = await this.db();
    const { data, error } = await db
      .from("alpha_picks")
      .select("*")
      .eq("status", "ACTIVE")
      .order("created_at", { ascending: false });
    if (error) throw new Error(`SupabaseAlphaStore.fetchActive: ${error.message}`);
    return (data ?? []) as AlphaPick[];
  }

  async markSold(id: string, price: number, reason: string): Promise<void> {
    const db = await this.db();
    const today = new Date().toISOString().slice(0, 10);
    const { error } = await db
      .from("alpha_picks")
      .update({
        status: "SOLD",
        exit_date: today,
        exit_price: price > 0 ? price : null,
        exit_reason: reason,
      })
      .eq("id", id);
    if (error) throw new Error(`SupabaseAlphaStore.markSold ${id}: ${error.message}`);
  }

  async updatePrice(id: string, currentPrice: number, changePct: number, date: string): Promise<void> {
    const db = await this.db();
    const { error } = await db
      .from("alpha_picks")
      .update({
        current_price: currentPrice,
        price_change_pct: changePct,
        price_last_updated: date,
      })
      .eq("id", id);
    if (error) throw new Error(`SupabaseAlphaStore.updatePrice ${id}: ${error.message}`);
  }

  async insert(pick: Omit<AlphaPick, "id" | "created_at">): Promise<void> {
    const db = await this.db();
    const { error } = await db.from("alpha_picks").insert(pick);
    if (error) throw new Error(`SupabaseAlphaStore.insert ${pick.ticker}: ${error.message}`);
  }

  async hasPicksForRunId(runId: string): Promise<boolean> {
    const db = await this.db();
    const { data, error } = await db
      .from("alpha_picks")
      .select("id")
      .eq("run_id", runId)
      .limit(1);
    if (error) throw new Error(`SupabaseAlphaStore.hasPicksForRunId: ${error.message}`);
    return (data ?? []).length > 0;
  }

  async fetchRecentlySold(sinceDaysAgo: number): Promise<AlphaPick[]> {
    const db = await this.db();
    const cutoff = new Date(Date.now() - sinceDaysAgo * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    const { data, error } = await db
      .from("alpha_picks")
      .select("*")
      .eq("status", "SOLD")
      .gte("exit_date", cutoff)
      .order("exit_date", { ascending: false });
    if (error) throw new Error(`SupabaseAlphaStore.fetchRecentlySold: ${error.message}`);
    return (data ?? []) as AlphaPick[];
  }

  async lastRunDate(): Promise<string | null> {
    const db = await this.db();
    const { data, error } = await db
      .from("alpha_picks")
      .select("created_at")
      .order("created_at", { ascending: false })
      .limit(1);
    if (error) throw new Error(`SupabaseAlphaStore.lastRunDate: ${error.message}`);
    return data?.[0]?.created_at?.slice(0, 10) ?? null;
  }

  async currentPublication(): Promise<{ runId: string; publishedDate: string } | null> {
    const db = await this.db();
    const { data, error } = await db
      .from("alpha_picks")
      .select("run_id, created_at, entry_date")
      .eq("status", "ACTIVE")
      .order("created_at", { ascending: false })
      .limit(1);
    if (error) throw new Error(`SupabaseAlphaStore.currentPublication: ${error.message}`);
    const row = data?.[0];
    if (!row) return null;
    return {
      runId: row.run_id as string,
      publishedDate: ((row.created_at as string) ?? (row.entry_date as string)).slice(0, 10),
    };
  }
}

// --------------------------------------------------------------------------
// Factory — auto-detects which backend to use
// --------------------------------------------------------------------------

function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (url && key) return true;

  if (process.env.NODE_ENV === "development") {
    try {
      const raw = fs.readFileSync(
        path.resolve(process.cwd(), ".env.local"),
        "utf8"
      );
      const get = (name: string) => raw.match(new RegExp(`^${name}=(.+)$`, "m"))?.[1]?.trim();
      return !!(get("NEXT_PUBLIC_SUPABASE_URL") && get("SUPABASE_SERVICE_ROLE_KEY"));
    } catch {
      return false;
    }
  }
  return false;
}

let _store: AlphaStore | null = null;

export function getAlphaStore(): AlphaStore {
  if (_store) return _store;
  if (isSupabaseConfigured()) {
    console.log("[alphaStore] using Supabase backend");
    _store = new SupabaseAlphaStore();
  } else {
    console.log("[alphaStore] Supabase not configured — using local file store (data/alpha-picks.json)");
    _store = new FileAlphaStore();
  }
  return _store;
}
