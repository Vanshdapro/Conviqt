// Durable store for the public /compare/[pair] pages.
//
// One row per canonical ticker pair holds the most recent public head-to-head
// CompareResult. Mirrors stockReports.ts exactly (File store for local dev,
// Supabase otherwise) so static generation + 24h ISR can serve a compare page
// without re-running the (expensive) two-Council Compare on every crawler hit.
//
// Canonicalization: a CompareResult is stored in alphabetically-sorted side
// order (tickerA = the alphabetically-first ticker). The chat pipeline lets the
// user name the tickers in any order, so persistCompareReport() flips sides when
// needed — swapping the two CouncilResults, the winner, and each scorecard row —
// so the stored A/B always matches the canonical /compare/aapl-vs-msft URL. The
// prose edges (valuation/positioning/…) reference tickers by name, not by A/B
// position, so they need no flipping.
//
// Writes go through persistCompareReport(result), called from the chat route
// when a fresh Compare completes (warm/cached replays don't re-persist).

import fs from "fs";
import path from "path";
import type {
  CompareResult,
  CompareWinner,
  CompareEdge,
} from "./agents/types";
import { comparePairKey } from "./tickers";
import { deepStripCitations } from "./citations";

// Public shape returned to callers (page, sitemap, OG, hub).
export interface StoredCompare {
  pairKey: string; // canonical "AAPL|MSFT"
  tickerA: string; // alphabetically-first (matches canonical slug order)
  tickerB: string;
  companyNameA: string;
  companyNameB: string;
  winner: CompareWinner;
  headline: string;
  report: CompareResult; // full, canonicalized
  estCostUSD: number | null;
  asOf: string; // ISO — when the underlying Compare run happened
  updatedAt: string; // ISO — when this row was last written
}

// Lightweight row for hub/sitemap queries (no heavy `report` blob).
export interface CompareSummary {
  pairKey: string;
  tickerA: string;
  tickerB: string;
  companyNameA: string;
  companyNameB: string;
  winner: CompareWinner;
  headline: string;
  updatedAt: string;
}

export interface CompareReportStore {
  get(tickerA: string, tickerB: string): Promise<StoredCompare | null>;
  upsert(report: StoredCompare): Promise<void>;
  // All stored compares, newest first, for the hub + sitemap.
  listSummaries(limit?: number): Promise<CompareSummary[]>;
}

// --------------------------------------------------------------------------
// Canonicalization: CompareResult → side-sorted CompareResult
// --------------------------------------------------------------------------

function flipWinner(w: CompareWinner): CompareWinner {
  return w === "A" ? "B" : w === "B" ? "A" : "TIE";
}

function flipEdge(e: CompareEdge): CompareEdge {
  return e === "a" ? "b" : e === "b" ? "a" : "tie";
}

// Return the result with side A = the alphabetically-first ticker. If the user
// ran the tickers in the other order, swap every A/B-positional field.
export function canonicalizeCompare(r: CompareResult): CompareResult {
  const x = r.tickerA.toUpperCase();
  const y = r.tickerB.toUpperCase();
  if (x <= y) return r; // already canonical

  return {
    ...r,
    tickerA: r.tickerB,
    tickerB: r.tickerA,
    a: r.b,
    b: r.a,
    verdict: {
      ...r.verdict,
      winner: flipWinner(r.verdict.winner),
      dimensions: r.verdict.dimensions.map((d) => ({
        ...d,
        aValue: d.bValue,
        bValue: d.aValue,
        edge: flipEdge(d.edge),
      })),
    },
  };
}

export function toStoredCompare(result: CompareResult): StoredCompare {
  const c = canonicalizeCompare(result);
  return {
    pairKey: comparePairKey(c.tickerA, c.tickerB),
    tickerA: c.tickerA.toUpperCase(),
    tickerB: c.tickerB.toUpperCase(),
    companyNameA: c.a.factSheet.companyName || c.tickerA.toUpperCase(),
    companyNameB: c.b.factSheet.companyName || c.tickerB.toUpperCase(),
    winner: c.verdict.winner,
    headline: c.verdict.headline,
    report: c,
    estCostUSD: c.estCostUSD ?? null,
    asOf: c.asOf,
    updatedAt: new Date().toISOString(),
  };
}

// --------------------------------------------------------------------------
// File store (local dev, no Supabase required)
// --------------------------------------------------------------------------

const FILE_PATH = path.resolve(process.cwd(), "data/compare-reports.json");

type FileShape = Record<string, StoredCompare>;

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

class FileCompareReportStore implements CompareReportStore {
  async get(tickerA: string, tickerB: string): Promise<StoredCompare | null> {
    return readFile()[comparePairKey(tickerA, tickerB)] ?? null;
  }

  async upsert(report: StoredCompare): Promise<void> {
    const map = readFile();
    map[report.pairKey] = report;
    writeFile(map);
  }

  async listSummaries(limit = 1000): Promise<CompareSummary[]> {
    return Object.values(readFile())
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, limit)
      .map(toSummary);
  }
}

function toSummary(r: StoredCompare): CompareSummary {
  return {
    pairKey: r.pairKey,
    tickerA: r.tickerA,
    tickerB: r.tickerB,
    companyNameA: r.companyNameA,
    companyNameB: r.companyNameB,
    winner: r.winner,
    headline: r.headline,
    updatedAt: r.updatedAt,
  };
}

// --------------------------------------------------------------------------
// Supabase store
// --------------------------------------------------------------------------

interface Row {
  pair_key: string;
  ticker_a: string;
  ticker_b: string;
  company_name_a: string;
  company_name_b: string;
  winner: CompareWinner;
  headline: string;
  report: CompareResult;
  est_cost_usd: number | null;
  as_of: string;
  updated_at: string;
}

function rowToStored(row: Row): StoredCompare {
  return {
    pairKey: row.pair_key,
    tickerA: row.ticker_a,
    tickerB: row.ticker_b,
    companyNameA: row.company_name_a,
    companyNameB: row.company_name_b,
    winner: row.winner,
    headline: row.headline,
    report: row.report,
    estCostUSD: row.est_cost_usd,
    asOf: row.as_of,
    updatedAt: row.updated_at,
  };
}

class SupabaseCompareReportStore implements CompareReportStore {
  private async db() {
    const { getSupabaseAdmin } = await import("./supabase");
    return getSupabaseAdmin();
  }

  async get(tickerA: string, tickerB: string): Promise<StoredCompare | null> {
    const db = await this.db();
    const { data, error } = await db
      .from("compare_reports")
      .select("*")
      .eq("pair_key", comparePairKey(tickerA, tickerB))
      .maybeSingle();
    if (error)
      throw new Error(`compareReports.get ${tickerA}/${tickerB}: ${error.message}`);
    return data ? rowToStored(data as Row) : null;
  }

  async upsert(report: StoredCompare): Promise<void> {
    const db = await this.db();
    const row: Row = {
      pair_key: report.pairKey,
      ticker_a: report.tickerA,
      ticker_b: report.tickerB,
      company_name_a: report.companyNameA,
      company_name_b: report.companyNameB,
      winner: report.winner,
      headline: report.headline,
      report: report.report,
      est_cost_usd: report.estCostUSD,
      as_of: report.asOf,
      updated_at: report.updatedAt,
    };
    const { error } = await db
      .from("compare_reports")
      .upsert(row, { onConflict: "pair_key" });
    if (error)
      throw new Error(`compareReports.upsert ${report.pairKey}: ${error.message}`);
  }

  async listSummaries(limit = 1000): Promise<CompareSummary[]> {
    const db = await this.db();
    const { data, error } = await db
      .from("compare_reports")
      .select(
        "pair_key, ticker_a, ticker_b, company_name_a, company_name_b, winner, headline, updated_at"
      )
      .order("updated_at", { ascending: false })
      .limit(limit);
    if (error) throw new Error(`compareReports.listSummaries: ${error.message}`);
    return (data ?? []).map((r) => {
      const row = r as Omit<Row, "report" | "est_cost_usd" | "as_of">;
      return {
        pairKey: row.pair_key,
        tickerA: row.ticker_a,
        tickerB: row.ticker_b,
        companyNameA: row.company_name_a,
        companyNameB: row.company_name_b,
        winner: row.winner,
        headline: row.headline,
        updatedAt: row.updated_at,
      };
    });
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

let _store: CompareReportStore | null = null;

export function getCompareReportStore(): CompareReportStore {
  if (_store) return _store;
  _store = isSupabaseConfigured()
    ? new SupabaseCompareReportStore()
    : new FileCompareReportStore();
  return _store;
}

// --------------------------------------------------------------------------
// Convenience wrappers
// --------------------------------------------------------------------------

export async function getCompareReport(
  tickerA: string,
  tickerB: string
): Promise<StoredCompare | null> {
  try {
    const stored = await getCompareReportStore().get(tickerA, tickerB);
    // Scrub any Claude web_search <cite …> markup that older cached rows baked
    // into the verdict prose, so the public page never renders raw tags.
    return stored ? deepStripCitations(stored) : stored;
  } catch (err) {
    // A store read failure must never crash a statically-generated page or the
    // build. Fail soft → "comparison pending" state.
    console.error(
      `[compareReports] get ${tickerA}/${tickerB} failed:`,
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

// Persist a fresh Compare run as this pair's public report. Fire-and-forget
// safe — a persistence failure must not break the user-facing chat response.
export async function persistCompareReport(result: CompareResult): Promise<void> {
  try {
    await getCompareReportStore().upsert(toStoredCompare(result));
    console.log(
      `[compareReports] persisted ${result.tickerA} vs ${result.tickerB}`
    );
  } catch (err) {
    console.error(
      `[compareReports] persist ${result.tickerA}/${result.tickerB} failed:`,
      err instanceof Error ? err.message : err
    );
  }
}
