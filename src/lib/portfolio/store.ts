// Portfolio Auditor — per-user persistence (server-only).
//
// portfolios       — saved baskets (holdings jsonb). One user can have many.
// portfolio_audits — append-only audit history per portfolio, with a
//                    denormalized health_score for charting health over time.
//
// All access is via the service-role admin client; the route guarantees the
// email comes from the verified session, never the client. Degrades to empty
// (rather than throwing) if the store is unreachable, so the UI still loads.

import { getSupabaseAdmin } from "../supabase";
import type { Holding, PortfolioAuditResult } from "./types";

export interface PortfolioRecord {
  id: string;
  name: string;
  holdings: Holding[];
  cash: number; // uninvested dollars held in the account (dry powder)
  createdAt: string;
  updatedAt: string;
}

export interface AuditRecord {
  id: string;
  portfolioId: string;
  healthScore: number;
  createdAt: string;
  result: PortfolioAuditResult;
}

interface PortfolioRow {
  id: string;
  name: string;
  holdings: Holding[];
  cash: number | string | null;
  created_at: string;
  updated_at: string;
}

interface AuditRow {
  id: string;
  portfolio_id: string;
  health_score: number;
  est_cost_usd: number;
  created_at: string;
  result: PortfolioAuditResult;
}

function admin() {
  return getSupabaseAdmin();
}

// ── Cash-column resilience ───────────────────────────────────────────────────
// The `cash` column ships in migration 023. Because dev and prod share one
// Supabase project, this code can run for a window before that migration lands.
// Rather than let a missing column break EVERY portfolio read (which would make
// a user's holdings vanish from the UI), we detect it once — PostgREST raises
// code 42703 — and degrade cash to 0 until the column exists. The flag resets
// on each cold start, so the feature lights up on its own once the migration is
// applied; no redeploy needed.
let cashColumnMissing = false;
const COLS_CASH = "id, name, holdings, cash, created_at, updated_at";
const COLS_NO_CASH = "id, name, holdings, created_at, updated_at";
function portfolioCols(): string {
  return cashColumnMissing ? COLS_NO_CASH : COLS_CASH;
}
function isMissingCashColumn(error: { code?: string; message?: string } | null): boolean {
  if (!error || !/cash/i.test(error.message ?? "")) return false;
  // 42703 = SELECT on an unknown column; PGRST204 = INSERT/UPDATE payload
  // references a column PostgREST can't find in its schema cache.
  return error.code === "42703" || error.code === "PGRST204";
}

// ── Reads ────────────────────────────────────────────────────────────────────

export async function listPortfolios(email: string): Promise<PortfolioRecord[]> {
  const e = email.toLowerCase().trim();
  const run = () =>
    admin().from("portfolios").select(portfolioCols()).eq("email", e).order("updated_at", { ascending: false });
  try {
    let { data, error } = await run();
    if (isMissingCashColumn(error)) {
      cashColumnMissing = true;
      ({ data, error } = await run());
    }
    if (error) {
      console.error("[portfolio] listPortfolios error:", error.message);
      return [];
    }
    return (data as unknown as PortfolioRow[]).map(mapPortfolio);
  } catch (err) {
    console.error("[portfolio] listPortfolios unavailable:", err instanceof Error ? err.message : err);
    return [];
  }
}

export async function getPortfolio(email: string, id: string): Promise<PortfolioRecord | null> {
  const e = email.toLowerCase().trim();
  const run = () =>
    admin().from("portfolios").select(portfolioCols()).eq("email", e).eq("id", id).single();
  try {
    let { data, error } = await run();
    if (isMissingCashColumn(error)) {
      cashColumnMissing = true;
      ({ data, error } = await run());
    }
    if (error || !data) return null;
    return mapPortfolio(data as unknown as PortfolioRow);
  } catch {
    return null;
  }
}

// Most recent audit for a portfolio (the one the dashboard shows by default).
export async function getLatestAudit(email: string, portfolioId: string): Promise<AuditRecord | null> {
  try {
    const { data, error } = await admin()
      .from("portfolio_audits")
      .select("id, portfolio_id, health_score, est_cost_usd, created_at, result")
      .eq("email", email.toLowerCase().trim())
      .eq("portfolio_id", portfolioId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data) return null;
    return mapAudit(data as AuditRow);
  } catch {
    return null;
  }
}

// Lightweight history (no full result payload) for the health-over-time chart.
export async function getAuditHistory(
  email: string,
  portfolioId: string,
  limit = 12
): Promise<Array<{ id: string; healthScore: number; createdAt: string }>> {
  try {
    const { data, error } = await admin()
      .from("portfolio_audits")
      .select("id, health_score, created_at")
      .eq("email", email.toLowerCase().trim())
      .eq("portfolio_id", portfolioId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error || !data) return [];
    return (data as Array<{ id: string; health_score: number; created_at: string }>).map((r) => ({
      id: r.id,
      healthScore: r.health_score,
      createdAt: r.created_at,
    }));
  } catch {
    return [];
  }
}

// ── Writes ───────────────────────────────────────────────────────────────────

// Create a new portfolio or update an existing one's holdings/name.
export async function savePortfolio(
  email: string,
  input: { id?: string; name: string; holdings: Holding[]; cash?: number }
): Promise<PortfolioRecord | null> {
  const normalized = email.toLowerCase().trim();
  const name = input.name.trim().slice(0, 80) || "My Portfolio";
  const holdings = sanitizeHoldings(input.holdings);
  // cash is optional on a save — only touch the column when the caller sent a
  // value, so a holdings-only edit never clobbers an existing cash balance.
  const wantCash = input.cash !== undefined ? sanitizeCash(input.cash) : undefined;
  // Re-built on retry so it drops cash once we learn the column is missing.
  const payload = () => ({
    name,
    holdings,
    ...(wantCash !== undefined && !cashColumnMissing ? { cash: wantCash } : {}),
  });

  try {
    const supabase = admin();
    const run = () =>
      input.id
        ? supabase
            .from("portfolios")
            .update(payload())
            .eq("email", normalized)
            .eq("id", input.id)
            .select(portfolioCols())
            .single()
        : supabase
            .from("portfolios")
            .insert({ email: normalized, ...payload() })
            .select(portfolioCols())
            .single();

    let { data, error } = await run();
    if (isMissingCashColumn(error)) {
      cashColumnMissing = true;
      ({ data, error } = await run());
    }
    if (error || !data) {
      console.error(`[portfolio] ${input.id ? "update" : "insert"} error:`, error?.message);
      return null;
    }
    return mapPortfolio(data as unknown as PortfolioRow);
  } catch (err) {
    console.error("[portfolio] savePortfolio unavailable:", err instanceof Error ? err.message : err);
    return null;
  }
}

export async function deletePortfolio(email: string, id: string): Promise<boolean> {
  try {
    const { error } = await admin()
      .from("portfolios")
      .delete()
      .eq("email", email.toLowerCase().trim())
      .eq("id", id);
    if (error) {
      console.error("[portfolio] delete error:", error.message);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export async function recordAudit(
  email: string,
  portfolioId: string,
  result: PortfolioAuditResult
): Promise<void> {
  try {
    const { error } = await admin().from("portfolio_audits").insert({
      email: email.toLowerCase().trim(),
      portfolio_id: portfolioId,
      result,
      health_score: result.judge.healthScore,
      est_cost_usd: result.estCostUSD,
    });
    if (error) console.error("[portfolio] recordAudit error:", error.message);
  } catch (err) {
    console.error("[portfolio] recordAudit unavailable:", err instanceof Error ? err.message : err);
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────────

export function sanitizeHoldings(raw: unknown): Holding[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: Holding[] = [];
  for (const r of raw) {
    if (!r || typeof r !== "object") continue;
    const rec = r as Record<string, unknown>;
    const ticker = String(rec.ticker ?? "").trim().toUpperCase();
    const shares = Number(rec.shares);
    if (!/^[A-Z][A-Z0-9.\-]{0,9}$/.test(ticker)) continue;
    if (!isFinite(shares) || shares <= 0) continue;
    if (seen.has(ticker)) continue;
    seen.add(ticker);
    const costBasisRaw = Number(rec.costBasis);
    const costBasis = isFinite(costBasisRaw) && costBasisRaw > 0 ? costBasisRaw : undefined;
    out.push({ ticker, shares, costBasis });
    if (out.length >= 40) break; // hard cap — cost + sweep coverage guard
  }
  return out;
}

// Cash is a single non-negative dollar amount, rounded to cents. A hard cap
// keeps a fat-fingered entry from producing a nonsense total. NaN/negatives
// collapse to 0 rather than throwing — the UI validates before this, this is
// the server-side backstop (mirrors sanitizeHoldings' tolerant style).
const MAX_CASH = 1_000_000_000_000; // $1T — well past any real account

export function sanitizeCash(raw: unknown): number {
  const n = Number(raw);
  if (!isFinite(n) || n <= 0) return 0;
  return Math.min(Math.round(n * 100) / 100, MAX_CASH);
}

function mapPortfolio(row: PortfolioRow): PortfolioRecord {
  return {
    id: row.id,
    name: row.name,
    holdings: Array.isArray(row.holdings) ? row.holdings : [],
    cash: sanitizeCash(row.cash),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapAudit(row: AuditRow): AuditRecord {
  return {
    id: row.id,
    portfolioId: row.portfolio_id,
    healthScore: row.health_score,
    createdAt: row.created_at,
    result: row.result,
  };
}
