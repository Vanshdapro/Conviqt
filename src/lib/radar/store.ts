// Persistence for the Radar — two layers, two stores.
//
//   • Market-wide Radar (FREE, shared): lives in feed_cache under
//     MARKET_RADAR_KEY, exactly like the Dashboard/Headlines feed content. One
//     globally-cached row, overwritten on each refresh, read by everyone.
//   • Personalized Radar (PRO, per portfolio): one CURRENT row per
//     (user_email, portfolio_id) in the `portfolio_radar` table (migration 029).
//     No history — a refresh upserts over the old radar.
//
// Both follow the house dual-store shape (Supabase via the service-role admin
// client when configured, a data/ JSON file in local dev otherwise). In dev
// ONLY, a missing personal table (029 not applied yet) falls back to the file
// store with a loud warning instead of bricking Portfolio; production never
// falls back — a missing table must be visible. deepStripCitations runs on read
// so any web_search `<cite …>` markup that ever slipped into cached prose is
// scrubbed without a cache bust.

import fs from "fs";
import path from "path";
import { getSupabaseAdmin } from "../supabase";
import { isSupabaseConfigured } from "../watchlist";
import { getFeedStore } from "../feed/store";
import { deepStripCitations } from "../citations";
import { MARKET_RADAR_KEY } from "./types";
import type { MarketRadar, PersonalRadar } from "./types";

// ── Market-wide radar (feed_cache, shared) ───────────────────────────────────

/** Read the global market-wide Radar. Mirrors readDashboard: same feed_cache
 *  store, citation-scrubbed on the way out. */
export async function readMarketRadar(): Promise<MarketRadar | null> {
  const row = await getFeedStore().get<MarketRadar>(MARKET_RADAR_KEY);
  return row?.payload ? deepStripCitations(row.payload) : null;
}

/** Overwrite the global market-wide Radar (rolling cache, no history). */
export async function writeMarketRadar(r: MarketRadar): Promise<void> {
  await getFeedStore().set(MARKET_RADAR_KEY, r);
}

// ── Personalized radar (per-user table, migration 029) ───────────────────────

const TABLE = "portfolio_radar";

export interface RadarStore {
  get(email: string, portfolioId: string): Promise<PersonalRadar | null>;
  save(email: string, portfolioId: string, radar: PersonalRadar): Promise<void>;
}

// ── File store (local dev) ────────────────────────────────────────────────────

const FILE_PATH = path.resolve(process.cwd(), "data/portfolio-radar.json");
type FileRow = { email: string; portfolioId: string; radar: PersonalRadar };

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

const fileStore: RadarStore = {
  async get(email, portfolioId) {
    const e = email.toLowerCase().trim();
    const radar = readFile().find((r) => r.email === e && r.portfolioId === portfolioId)?.radar;
    return radar ? deepStripCitations(radar) : null;
  },
  async save(email, portfolioId, radar) {
    const e = email.toLowerCase().trim();
    const rows = readFile().filter((r) => !(r.email === e && r.portfolioId === portfolioId));
    rows.push({ email: e, portfolioId, radar });
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
    `[radar] ${op}: table missing — run supabase/migrations/029_portfolio_radar.sql. ` +
      `Falling back to data/portfolio-radar.json (development only).`
  );
  return true;
}

const supabaseStore: RadarStore = {
  async get(email, portfolioId) {
    const { data, error } = await getSupabaseAdmin()
      .from(TABLE)
      .select("payload")
      .eq("user_email", email.toLowerCase().trim())
      .eq("portfolio_id", portfolioId)
      .maybeSingle();
    if (error) {
      if (devFallback("get", error)) return fileStore.get(email, portfolioId);
      console.error(`[radar] get failed: ${error.message}`);
      return null;
    }
    const payload = data?.payload as PersonalRadar | undefined;
    return payload ? deepStripCitations(payload) : null;
  },

  async save(email, portfolioId, radar) {
    const { error } = await getSupabaseAdmin()
      .from(TABLE)
      .upsert(
        {
          user_email: email.toLowerCase().trim(),
          portfolio_id: portfolioId,
          payload: radar,
          generated_at: radar.generatedAt,
        },
        { onConflict: "user_email,portfolio_id" }
      );
    if (error) {
      if (devFallback("save", error)) return fileStore.save(email, portfolioId, radar);
      throw new Error(`[radar] save failed: ${error.message}`);
    }
  },
};

export function getRadarStore(): RadarStore {
  return isSupabaseConfigured() ? supabaseStore : fileStore;
}
