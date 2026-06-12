// Persistence for the Dashboard + Headlines feed cache (migration 021).
//
// Rolling cache — every write OVERWRITES the row for its key. That shape is a
// Currents license obligation (no permanent copies of their data), so do not
// add history/archival here.
//
// Dual store, same pattern as alphaStore/earnings: Supabase when configured,
// a data/ JSON file otherwise (local dev). One extra dev-only kindness: if
// Supabase answers "relation feed_cache does not exist" (migration 021 not
// applied yet), development falls back to the file store with a loud warning
// instead of bricking the surfaces. Production never falls back — a missing
// table there must be visible, not papered over.

import fs from "fs";
import path from "path";
import { getSupabaseAdmin } from "../supabase";
import { isSupabaseConfigured } from "../watchlist";
import type { DashboardContent, HeadlinesRegion } from "./types";

export const DASHBOARD_KEY = "feed:dashboard";
export const headlinesKey = (region: string) => `feed:headlines:${region}`;

export interface FeedRunLog {
  kind: "dashboard" | "headlines";
  status: "ok" | "error" | "over_budget";
  costUSD: number;
  webSearches: number;
  durationMs: number;
  error?: string;
  meta?: Record<string, unknown>;
}

export interface FeedStore {
  get<T>(key: string): Promise<{ payload: T; generatedAt: string } | null>;
  set(key: string, payload: unknown): Promise<void>;
  logRun(run: FeedRunLog): Promise<void>;
}

// ── File store (local dev) ───────────────────────────────────────────────────

const FILE_PATH = path.resolve(process.cwd(), "data/feed-cache.json");

type FileShape = Record<string, { payload: unknown; generatedAt: string }>;

function readFile(): FileShape {
  try {
    return JSON.parse(fs.readFileSync(FILE_PATH, "utf8")) as FileShape;
  } catch {
    return {};
  }
}

const fileStore: FeedStore = {
  async get<T>(key: string) {
    const row = readFile()[key];
    return row ? { payload: row.payload as T, generatedAt: row.generatedAt } : null;
  },
  async set(key, payload) {
    const all = readFile();
    all[key] = { payload, generatedAt: new Date().toISOString() };
    fs.mkdirSync(path.dirname(FILE_PATH), { recursive: true });
    fs.writeFileSync(FILE_PATH, JSON.stringify(all, null, 2), "utf8");
  },
  async logRun(run) {
    console.log(
      `[feed] run kind=${run.kind} status=${run.status} cost=$${run.costUSD.toFixed(4)} ` +
        `searches=${run.webSearches} duration=${run.durationMs}ms` +
        (run.error ? ` error=${run.error}` : "")
    );
  },
};

// ── Supabase store ───────────────────────────────────────────────────────────

function isMissingTable(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  const text = `${err.code ?? ""} ${err.message ?? ""}`;
  return /42P01|PGRST205|schema cache|does not exist/i.test(text);
}

function devFallback(op: string, err: { code?: string; message?: string } | null): boolean {
  if (process.env.NODE_ENV === "production" || !isMissingTable(err)) return false;
  console.warn(
    `[feed] ${op}: feed tables missing — run supabase/migrations/021_feed_cache.sql. ` +
      `Falling back to data/feed-cache.json (development only).`
  );
  return true;
}

const supabaseStore: FeedStore = {
  async get<T>(key: string) {
    const { data, error } = await getSupabaseAdmin()
      .from("feed_cache")
      .select("payload, generated_at")
      .eq("cache_key", key)
      .maybeSingle();
    if (error) {
      if (devFallback("get", error)) return fileStore.get<T>(key);
      console.error(`[feed] get ${key} failed: ${error.message}`);
      return null;
    }
    if (!data) return null;
    return { payload: data.payload as T, generatedAt: data.generated_at as string };
  },

  async set(key, payload) {
    const { error } = await getSupabaseAdmin()
      .from("feed_cache")
      .upsert({ cache_key: key, payload, generated_at: new Date().toISOString() });
    if (error) {
      if (devFallback("set", error)) return fileStore.set(key, payload);
      throw new Error(`[feed] set ${key} failed: ${error.message}`);
    }
  },

  async logRun(run) {
    // Always echo to the server log — the ledger row is for history, the log
    // line is for "is it broken right now".
    await fileStore.logRun(run);
    const { error } = await getSupabaseAdmin().from("feed_refresh_runs").insert({
      kind: run.kind,
      status: run.status,
      cost_usd: run.costUSD,
      web_searches: run.webSearches,
      duration_ms: run.durationMs,
      error: run.error ?? null,
      meta: run.meta ?? {},
    });
    if (error && !devFallback("logRun", error)) {
      console.error(`[feed] logRun failed: ${error.message}`);
    }
  },
};

export function getFeedStore(): FeedStore {
  return isSupabaseConfigured() ? supabaseStore : fileStore;
}

// ── Typed conveniences ───────────────────────────────────────────────────────

export async function readDashboard(): Promise<DashboardContent | null> {
  const row = await getFeedStore().get<DashboardContent>(DASHBOARD_KEY);
  return row?.payload ?? null;
}

export async function readHeadlines(region: string): Promise<HeadlinesRegion | null> {
  const row = await getFeedStore().get<HeadlinesRegion>(headlinesKey(region));
  return row?.payload ?? null;
}
