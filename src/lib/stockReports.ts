// Durable store for the public /stock/[ticker] pages.
//
// One row per ticker holds the most recent public Council report. Unlike the
// in-process cache (src/lib/cache.ts), this survives across Vercel lambdas and
// builds, which is what lets static generation + 24h ISR serve a ticker page
// without re-running the expensive Council on every crawler hit.
//
// Auto-selects backend (same pattern as alphaStore.ts):
//   - Supabase  when NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY set
//   - JSON file (data/stock-reports.json) otherwise — local dev without Supabase
//
// Writes go through upsertStockReport(result) which derives the flat summary
// columns from a full CouncilResult and stores the result verbatim in `report`.

import fs from "fs";
import path from "path";
import type { CouncilResult, Verdict } from "./agents/types";

// Public shape returned to callers (page, sitemap, gate API).
export interface StoredReport {
  ticker: string;
  companyName: string;
  sector: string | null;
  verdict: Verdict;
  conviction: number;
  disagreement: number;
  report: CouncilResult;
  estCostUSD: number | null;
  asOf: string; // ISO — when the underlying Council run happened
  updatedAt: string; // ISO — when this row was last written
}

// Lightweight row for list/sitemap queries (no heavy `report` blob).
export interface ReportSummary {
  ticker: string;
  companyName: string;
  verdict: Verdict;
  conviction: number;
  disagreement: number;
  updatedAt: string;
}

export interface StockReportStore {
  get(ticker: string): Promise<StoredReport | null>;
  upsert(report: StoredReport): Promise<void>;
  // Tickers whose report is older than `olderThanMs`, oldest first, capped.
  // Used by the refresh cron to spend the daily budget on the stalest pages.
  listStale(olderThanMs: number, limit: number): Promise<string[]>;
  // All tickers that have a stored report, for the sitemap. Newest first.
  listSummaries(limit?: number): Promise<ReportSummary[]>;
  // Reports run within the last `sinceMs`, most-contested first, capped.
  // Full StoredReport (incl. the report blob) so callers can pull bear/bull
  // cases. Powers the weekly Disagreement Digest (Deliverable 6).
  listContested(sinceMs: number, limit: number): Promise<StoredReport[]>;
}

// --------------------------------------------------------------------------
// Derivation: CouncilResult → StoredReport
// --------------------------------------------------------------------------

export function toStoredReport(result: CouncilResult): StoredReport {
  return {
    ticker: result.ticker.toUpperCase(),
    companyName: result.factSheet.companyName || result.ticker.toUpperCase(),
    sector: result.factSheet.sector || null,
    verdict: result.judge.verdict,
    conviction: result.judge.conviction,
    disagreement: result.judge.disagreement,
    report: result,
    estCostUSD: result.estCostUSD ?? null,
    asOf: result.asOf,
    updatedAt: new Date().toISOString(),
  };
}

// --------------------------------------------------------------------------
// File store (local dev, no Supabase required)
// --------------------------------------------------------------------------

const FILE_PATH = path.resolve(process.cwd(), "data/stock-reports.json");

type FileShape = Record<string, StoredReport>;

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

class FileStockReportStore implements StockReportStore {
  async get(ticker: string): Promise<StoredReport | null> {
    return readFile()[ticker.toUpperCase()] ?? null;
  }

  async upsert(report: StoredReport): Promise<void> {
    const map = readFile();
    map[report.ticker.toUpperCase()] = report;
    writeFile(map);
  }

  async listStale(olderThanMs: number, limit: number): Promise<string[]> {
    const cutoff = Date.now() - olderThanMs;
    return Object.values(readFile())
      .filter((r) => new Date(r.updatedAt).getTime() < cutoff)
      .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt))
      .slice(0, limit)
      .map((r) => r.ticker);
  }

  async listSummaries(limit = 1000): Promise<ReportSummary[]> {
    return Object.values(readFile())
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, limit)
      .map((r) => ({
        ticker: r.ticker,
        companyName: r.companyName,
        verdict: r.verdict,
        conviction: r.conviction,
        disagreement: r.disagreement,
        updatedAt: r.updatedAt,
      }));
  }

  async listContested(sinceMs: number, limit: number): Promise<StoredReport[]> {
    const cutoff = Date.now() - sinceMs;
    return Object.values(readFile())
      .filter((r) => new Date(r.updatedAt).getTime() >= cutoff)
      .sort(
        (a, b) =>
          b.disagreement - a.disagreement ||
          b.updatedAt.localeCompare(a.updatedAt)
      )
      .slice(0, limit);
  }
}

// --------------------------------------------------------------------------
// Supabase store
// --------------------------------------------------------------------------

interface Row {
  ticker: string;
  company_name: string;
  sector: string | null;
  verdict: Verdict;
  conviction: number;
  disagreement: number;
  report: CouncilResult;
  est_cost_usd: number | null;
  as_of: string;
  updated_at: string;
}

function rowToStored(row: Row): StoredReport {
  return {
    ticker: row.ticker,
    companyName: row.company_name,
    sector: row.sector,
    verdict: row.verdict,
    conviction: row.conviction,
    disagreement: row.disagreement,
    report: row.report,
    estCostUSD: row.est_cost_usd,
    asOf: row.as_of,
    updatedAt: row.updated_at,
  };
}

class SupabaseStockReportStore implements StockReportStore {
  private async db() {
    const { getSupabaseAdmin } = await import("./supabase");
    return getSupabaseAdmin();
  }

  async get(ticker: string): Promise<StoredReport | null> {
    const db = await this.db();
    const { data, error } = await db
      .from("stock_reports")
      .select("*")
      .eq("ticker", ticker.toUpperCase())
      .maybeSingle();
    if (error) throw new Error(`stockReports.get ${ticker}: ${error.message}`);
    return data ? rowToStored(data as Row) : null;
  }

  async upsert(report: StoredReport): Promise<void> {
    const db = await this.db();
    const row: Row = {
      ticker: report.ticker.toUpperCase(),
      company_name: report.companyName,
      sector: report.sector,
      verdict: report.verdict,
      conviction: report.conviction,
      disagreement: report.disagreement,
      report: report.report,
      est_cost_usd: report.estCostUSD,
      as_of: report.asOf,
      updated_at: report.updatedAt,
    };
    const { error } = await db
      .from("stock_reports")
      .upsert(row, { onConflict: "ticker" });
    if (error) throw new Error(`stockReports.upsert ${report.ticker}: ${error.message}`);
  }

  async listStale(olderThanMs: number, limit: number): Promise<string[]> {
    const db = await this.db();
    const cutoff = new Date(Date.now() - olderThanMs).toISOString();
    const { data, error } = await db
      .from("stock_reports")
      .select("ticker")
      .lt("updated_at", cutoff)
      .order("updated_at", { ascending: true })
      .limit(limit);
    if (error) throw new Error(`stockReports.listStale: ${error.message}`);
    return (data ?? []).map((r) => (r as { ticker: string }).ticker);
  }

  async listSummaries(limit = 1000): Promise<ReportSummary[]> {
    const db = await this.db();
    const { data, error } = await db
      .from("stock_reports")
      .select("ticker, company_name, verdict, conviction, disagreement, updated_at")
      .order("updated_at", { ascending: false })
      .limit(limit);
    if (error) throw new Error(`stockReports.listSummaries: ${error.message}`);
    return (data ?? []).map((r) => {
      const row = r as Pick<
        Row,
        "ticker" | "company_name" | "verdict" | "conviction" | "disagreement" | "updated_at"
      >;
      return {
        ticker: row.ticker,
        companyName: row.company_name,
        verdict: row.verdict,
        conviction: row.conviction,
        disagreement: row.disagreement,
        updatedAt: row.updated_at,
      };
    });
  }

  async listContested(sinceMs: number, limit: number): Promise<StoredReport[]> {
    const db = await this.db();
    const cutoff = new Date(Date.now() - sinceMs).toISOString();
    const { data, error } = await db
      .from("stock_reports")
      .select("*")
      .gte("updated_at", cutoff)
      .order("disagreement", { ascending: false })
      .order("updated_at", { ascending: false })
      .limit(limit);
    if (error) throw new Error(`stockReports.listContested: ${error.message}`);
    return (data ?? []).map((r) => rowToStored(r as Row));
  }
}

// --------------------------------------------------------------------------
// Factory — auto-detects backend (mirrors alphaStore.isSupabaseConfigured)
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

let _store: StockReportStore | null = null;

export function getStockReportStore(): StockReportStore {
  if (_store) return _store;
  _store = isSupabaseConfigured()
    ? new SupabaseStockReportStore()
    : new FileStockReportStore();
  return _store;
}

// --------------------------------------------------------------------------
// Convenience wrappers
// --------------------------------------------------------------------------

export async function getStockReport(ticker: string): Promise<StoredReport | null> {
  try {
    return await getStockReportStore().get(ticker);
  } catch (err) {
    // A store read failure must never crash a statically-generated page or
    // the build. Fail soft → "report pending" state.
    console.error(
      `[stockReports] get ${ticker} failed:`,
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

// Persist a fresh Council run as this ticker's public report. Fire-and-forget
// safe — callers should not let a persistence failure break the user-facing
// response. Only canonical (unfocused) runs should be persisted.
export async function persistStockReport(result: CouncilResult): Promise<void> {
  try {
    await getStockReportStore().upsert(toStoredReport(result));
    console.log(`[stockReports] persisted public report for ${result.ticker}`);
  } catch (err) {
    console.error(
      `[stockReports] persist ${result.ticker} failed:`,
      err instanceof Error ? err.message : err
    );
  }

  // Same funnel feeds the Conviction Timeline (the append-only history moat).
  // Independent of the upsert above — a stock_reports failure shouldn't skip
  // the history point, and vice versa.
  const { appendConvictionPoint } = await import("./convictionHistory");
  void appendConvictionPoint(result);
}
