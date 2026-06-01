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

// ── Reads ────────────────────────────────────────────────────────────────────

export async function listPortfolios(email: string): Promise<PortfolioRecord[]> {
  try {
    const { data, error } = await admin()
      .from("portfolios")
      .select("id, name, holdings, created_at, updated_at")
      .eq("email", email.toLowerCase().trim())
      .order("updated_at", { ascending: false });
    if (error) {
      console.error("[portfolio] listPortfolios error:", error.message);
      return [];
    }
    return (data as PortfolioRow[]).map(mapPortfolio);
  } catch (err) {
    console.error("[portfolio] listPortfolios unavailable:", err instanceof Error ? err.message : err);
    return [];
  }
}

export async function getPortfolio(email: string, id: string): Promise<PortfolioRecord | null> {
  try {
    const { data, error } = await admin()
      .from("portfolios")
      .select("id, name, holdings, created_at, updated_at")
      .eq("email", email.toLowerCase().trim())
      .eq("id", id)
      .single();
    if (error || !data) return null;
    return mapPortfolio(data as PortfolioRow);
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
  input: { id?: string; name: string; holdings: Holding[] }
): Promise<PortfolioRecord | null> {
  const normalized = email.toLowerCase().trim();
  const name = input.name.trim().slice(0, 80) || "My Portfolio";
  const holdings = sanitizeHoldings(input.holdings);

  try {
    const supabase = admin();
    if (input.id) {
      const { data, error } = await supabase
        .from("portfolios")
        .update({ name, holdings })
        .eq("email", normalized)
        .eq("id", input.id)
        .select("id, name, holdings, created_at, updated_at")
        .single();
      if (error || !data) {
        console.error("[portfolio] update error:", error?.message);
        return null;
      }
      return mapPortfolio(data as PortfolioRow);
    }
    const { data, error } = await supabase
      .from("portfolios")
      .insert({ email: normalized, name, holdings })
      .select("id, name, holdings, created_at, updated_at")
      .single();
    if (error || !data) {
      console.error("[portfolio] insert error:", error?.message);
      return null;
    }
    return mapPortfolio(data as PortfolioRow);
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

function mapPortfolio(row: PortfolioRow): PortfolioRecord {
  return {
    id: row.id,
    name: row.name,
    holdings: Array.isArray(row.holdings) ? row.holdings : [],
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
