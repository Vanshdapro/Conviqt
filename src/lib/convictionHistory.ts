// Conviction Timeline store — the longitudinal AI-consensus dataset.
//
// Append-only history of canonical Council runs per ticker. This is the data
// behind the time-series chart on /stock/[ticker] and the proprietary moat:
// every day Conviqt runs analyses, the history deepens. We accumulate FORWARD
// from the day migration 015 shipped — we never replay history.
//
// Auto-selects backend (same pattern as stockReports.ts / alphaStore.ts):
//   - Supabase  when NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY set
//   - JSON file (data/conviction-history.json) otherwise — local dev
//
// Writes go through appendConvictionPoint(result), which is fired
// fire-and-forget from persistStockReport so every canonical run contributes a
// point. Reads go through getConvictionHistory(ticker, days) for the chart.

import fs from "fs";
import path from "path";
import type { CouncilResult, Verdict } from "./agents/types";

// One dot on the timeline = one cached Council run.
export interface ConvictionPoint {
  ticker: string;
  asOf: string; // ISO — when the underlying run happened
  verdict: Verdict;
  conviction: number; // 0-100
  disagreement: number; // 0-100
  dissents: string[]; // specialist agents that dissented from the verdict
  bullLine: string;
  bearLine: string;
}

export interface ConvictionHistoryStore {
  append(point: ConvictionPoint): Promise<void>;
  // Points for a ticker within the last `days`, oldest first.
  list(ticker: string, days: number): Promise<ConvictionPoint[]>;
}

// --------------------------------------------------------------------------
// Derivation: CouncilResult → ConvictionPoint
// --------------------------------------------------------------------------

export function toConvictionPoint(result: CouncilResult): ConvictionPoint {
  const { judge } = result;
  return {
    ticker: result.ticker.toUpperCase(),
    asOf: result.asOf,
    verdict: judge.verdict,
    conviction: judge.conviction,
    disagreement: judge.disagreement,
    dissents: judge.dissents ?? [],
    bullLine: judge.bullCase || "",
    bearLine: judge.bearCase || "",
  };
}

// --------------------------------------------------------------------------
// File store (local dev, no Supabase required)
// --------------------------------------------------------------------------

const FILE_PATH = path.resolve(process.cwd(), "data/conviction-history.json");

// Map of TICKER → chronological list of points.
type FileShape = Record<string, ConvictionPoint[]>;

function readFile(): FileShape {
  try {
    return JSON.parse(fs.readFileSync(FILE_PATH, "utf8")) as FileShape;
  } catch {
    return {};
  }
}

function writeFile(map: FileShape): void {
  fs.mkdirSync(path.dirname(FILE_PATH), { recursive: true });
  fs.writeFileSync(FILE_PATH, JSON.stringify(map, null, 2), "utf8");
}

class FileConvictionHistoryStore implements ConvictionHistoryStore {
  async append(point: ConvictionPoint): Promise<void> {
    const map = readFile();
    const key = point.ticker.toUpperCase();
    (map[key] ??= []).push(point);
    writeFile(map);
  }

  async list(ticker: string, days: number): Promise<ConvictionPoint[]> {
    const cutoff = Date.now() - days * 86_400_000;
    return (readFile()[ticker.toUpperCase()] ?? [])
      .filter((p) => new Date(p.asOf).getTime() >= cutoff)
      .sort((a, b) => a.asOf.localeCompare(b.asOf));
  }
}

// --------------------------------------------------------------------------
// Supabase store
// --------------------------------------------------------------------------

interface Row {
  ticker: string;
  verdict: Verdict;
  conviction: number;
  disagreement: number;
  dissents: string[] | null;
  bull_line: string | null;
  bear_line: string | null;
  as_of: string;
}

function rowToPoint(row: Row): ConvictionPoint {
  return {
    ticker: row.ticker,
    asOf: row.as_of,
    verdict: row.verdict,
    conviction: row.conviction,
    disagreement: row.disagreement,
    dissents: row.dissents ?? [],
    bullLine: row.bull_line ?? "",
    bearLine: row.bear_line ?? "",
  };
}

class SupabaseConvictionHistoryStore implements ConvictionHistoryStore {
  private async db() {
    const { getSupabaseAdmin } = await import("./supabase");
    return getSupabaseAdmin();
  }

  async append(point: ConvictionPoint): Promise<void> {
    const db = await this.db();
    const { error } = await db.from("conviction_history").insert({
      ticker: point.ticker.toUpperCase(),
      verdict: point.verdict,
      conviction: point.conviction,
      disagreement: point.disagreement,
      dissents: point.dissents,
      bull_line: point.bullLine || null,
      bear_line: point.bearLine || null,
      as_of: point.asOf,
    });
    if (error) throw new Error(`convictionHistory.append ${point.ticker}: ${error.message}`);
  }

  async list(ticker: string, days: number): Promise<ConvictionPoint[]> {
    const db = await this.db();
    const cutoff = new Date(Date.now() - days * 86_400_000).toISOString();
    const { data, error } = await db
      .from("conviction_history")
      .select("ticker, verdict, conviction, disagreement, dissents, bull_line, bear_line, as_of")
      .eq("ticker", ticker.toUpperCase())
      .gte("as_of", cutoff)
      .order("as_of", { ascending: true });
    if (error) throw new Error(`convictionHistory.list ${ticker}: ${error.message}`);
    return (data ?? []).map((r) => rowToPoint(r as Row));
  }
}

// --------------------------------------------------------------------------
// Factory — auto-detects backend (mirrors stockReports.isSupabaseConfigured)
// --------------------------------------------------------------------------

function isSupabaseConfigured(): boolean {
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

let _store: ConvictionHistoryStore | null = null;

export function getConvictionHistoryStore(): ConvictionHistoryStore {
  if (_store) return _store;
  _store = isSupabaseConfigured()
    ? new SupabaseConvictionHistoryStore()
    : new FileConvictionHistoryStore();
  return _store;
}

// --------------------------------------------------------------------------
// Convenience wrappers
// --------------------------------------------------------------------------

// Read history for the chart. Fails soft → empty array so a store error never
// crashes a statically-generated stock page.
export async function getConvictionHistory(
  ticker: string,
  days = 90
): Promise<ConvictionPoint[]> {
  try {
    return await getConvictionHistoryStore().list(ticker, days);
  } catch (err) {
    console.error(
      `[convictionHistory] list ${ticker} failed:`,
      err instanceof Error ? err.message : err
    );
    return [];
  }
}

// Append a run to the timeline. Fire-and-forget safe — a persistence failure
// must never break the user-facing response. Only canonical (unfocused) runs
// should be appended.
export async function appendConvictionPoint(result: CouncilResult): Promise<void> {
  try {
    await getConvictionHistoryStore().append(toConvictionPoint(result));
    console.log(`[convictionHistory] appended point for ${result.ticker}`);
  } catch (err) {
    console.error(
      `[convictionHistory] append ${result.ticker} failed:`,
      err instanceof Error ? err.message : err
    );
  }
}
