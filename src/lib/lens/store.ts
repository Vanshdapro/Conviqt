// Persistence for the Lens daily brief (migration 028).
//
// One row per (email, portfolio, UTC day). Same dual-store shape as feed/store:
// Supabase via the service-role admin client when configured, a data/ JSON file
// in local dev otherwise. In dev ONLY, a missing table (028 not applied yet)
// falls back to the file store with a loud warning instead of bricking
// Portfolio; production never falls back — a missing table must be visible.

import fs from "fs";
import path from "path";
import { getSupabaseAdmin } from "../supabase";
import { isSupabaseConfigured } from "../watchlist";
import type { LensBrief, LensBriefListItem } from "./types";
import { toLensListItem } from "./types";

const TABLE = "lens_daily_briefs";

export interface LensStore {
  get(email: string, portfolioId: string, date: string): Promise<LensBrief | null>;
  getLatest(email: string, portfolioId: string): Promise<LensBrief | null>;
  list(email: string, portfolioId: string, limit: number): Promise<LensBriefListItem[]>;
  save(email: string, portfolioId: string, brief: LensBrief): Promise<void>;
}

// ── File store (local dev) ────────────────────────────────────────────────────

const FILE_PATH = path.resolve(process.cwd(), "data/lens-briefs.json");
type FileRow = { email: string; portfolioId: string; date: string; brief: LensBrief };

function readFile(): FileRow[] {
  try {
    return JSON.parse(fs.readFileSync(FILE_PATH, "utf8")) as FileRow[];
  } catch {
    return [];
  }
}
function writeFile(rows: FileRow[]) {
  fs.mkdirSync(path.dirname(FILE_PATH), { recursive: true });
  fs.writeFileSync(FILE_PATH, JSON.stringify(rows, null, 2), "utf8");
}

const fileStore: LensStore = {
  async get(email, portfolioId, date) {
    const e = email.toLowerCase().trim();
    return (
      readFile().find((r) => r.email === e && r.portfolioId === portfolioId && r.date === date)
        ?.brief ?? null
    );
  },
  async getLatest(email, portfolioId) {
    const e = email.toLowerCase().trim();
    const rows = readFile()
      .filter((r) => r.email === e && r.portfolioId === portfolioId)
      .sort((a, b) => b.date.localeCompare(a.date));
    return rows[0]?.brief ?? null;
  },
  async list(email, portfolioId, limit) {
    const e = email.toLowerCase().trim();
    return readFile()
      .filter((r) => r.email === e && r.portfolioId === portfolioId)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, limit)
      .map((r) => toLensListItem(r.brief));
  },
  async save(email, portfolioId, brief) {
    const e = email.toLowerCase().trim();
    const rows = readFile().filter(
      (r) => !(r.email === e && r.portfolioId === portfolioId && r.date === brief.date)
    );
    rows.push({ email: e, portfolioId, date: brief.date, brief });
    writeFile(rows);
  },
};

// ── Supabase store ─────────────────────────────────────────────────────────────

function isMissingTable(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  const text = `${err.code ?? ""} ${err.message ?? ""}`;
  return /42P01|PGRST205|schema cache|does not exist/i.test(text);
}
function devFallback(op: string, err: { code?: string; message?: string } | null): boolean {
  if (process.env.NODE_ENV === "production" || !isMissingTable(err)) return false;
  console.warn(
    `[lens] ${op}: table missing — run supabase/migrations/028_lens_daily_brief.sql. ` +
      `Falling back to data/lens-briefs.json (development only).`
  );
  return true;
}

const supabaseStore: LensStore = {
  async get(email, portfolioId, date) {
    const { data, error } = await getSupabaseAdmin()
      .from(TABLE)
      .select("brief")
      .eq("email", email.toLowerCase().trim())
      .eq("portfolio_id", portfolioId)
      .eq("brief_date", date)
      .maybeSingle();
    if (error) {
      if (devFallback("get", error)) return fileStore.get(email, portfolioId, date);
      console.error(`[lens] get failed: ${error.message}`);
      return null;
    }
    return (data?.brief as LensBrief) ?? null;
  },

  async getLatest(email, portfolioId) {
    const { data, error } = await getSupabaseAdmin()
      .from(TABLE)
      .select("brief")
      .eq("email", email.toLowerCase().trim())
      .eq("portfolio_id", portfolioId)
      .order("brief_date", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      if (devFallback("getLatest", error)) return fileStore.getLatest(email, portfolioId);
      console.error(`[lens] getLatest failed: ${error.message}`);
      return null;
    }
    return (data?.brief as LensBrief) ?? null;
  },

  async list(email, portfolioId, limit) {
    const { data, error } = await getSupabaseAdmin()
      .from(TABLE)
      .select("brief")
      .eq("email", email.toLowerCase().trim())
      .eq("portfolio_id", portfolioId)
      .order("brief_date", { ascending: false })
      .limit(limit);
    if (error) {
      if (devFallback("list", error)) return fileStore.list(email, portfolioId, limit);
      console.error(`[lens] list failed: ${error.message}`);
      return [];
    }
    return (data ?? []).map((r) => toLensListItem(r.brief as LensBrief));
  },

  async save(email, portfolioId, brief) {
    const { error } = await getSupabaseAdmin()
      .from(TABLE)
      .upsert(
        {
          email: email.toLowerCase().trim(),
          portfolio_id: portfolioId,
          brief_date: brief.date,
          brief,
          est_cost_usd: brief.estCostUSD,
        },
        { onConflict: "email,portfolio_id,brief_date" }
      );
    if (error) {
      if (devFallback("save", error)) return fileStore.save(email, portfolioId, brief);
      throw new Error(`[lens] save failed: ${error.message}`);
    }
  },
};

export function getLensStore(): LensStore {
  return isSupabaseConfigured() ? supabaseStore : fileStore;
}
