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
import type { AlphaPick, PredictionResolution } from "./alphaTypes";

// --------------------------------------------------------------------------
// Interface
// --------------------------------------------------------------------------

export interface AlphaStore {
  fetchActive(): Promise<AlphaPick[]>;
  // Mark a position SOLD. When `resolution` is supplied (and the pick was not
  // already prediction-resolved), also grade the prediction in the same write.
  markSold(id: string, price: number, reason: string, resolution?: PredictionResolution): Promise<void>;
  updatePrice(id: string, currentPrice: number, changePct: number, date: string): Promise<void>;
  insert(pick: Omit<AlphaPick, "id" | "created_at">): Promise<void>;
  hasPicksForRunId(runId: string): Promise<boolean>;
  fetchRecentlySold(sinceDaysAgo: number): Promise<AlphaPick[]>;
  // Grade a still-open prediction whose horizon has expired (position stays
  // ACTIVE; only the prediction is resolved, for the calibration record).
  resolveHorizon(id: string, resolution: PredictionResolution): Promise<void>;
  // Resolved predictions (SOLD or horizon-graded) — the calibration sample.
  fetchResolved(limit?: number): Promise<AlphaPick[]>;
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

  async markSold(id: string, price: number, reason: string, resolution?: PredictionResolution): Promise<void> {
    const picks = readFile();
    const today = new Date().toISOString().slice(0, 10);
    const idx = picks.findIndex((p) => p.id === id);
    if (idx === -1) throw new Error(`FileAlphaStore: pick ${id} not found`);
    const prev = picks[idx];
    picks[idx] = {
      ...prev,
      status: "SOLD",
      exit_date: today,
      exit_price: price > 0 ? price : null,
      exit_reason: reason,
      // Grade the prediction in the same write, unless it was already resolved
      // at horizon (don't let a later exit flip a graded prediction).
      ...(resolution && !prev.resolved
        ? {
            resolved: true,
            resolved_date: resolution.resolvedDate,
            resolution_outcome: resolution.outcome,
            resolved_price: resolution.resolvedPrice > 0 ? resolution.resolvedPrice : null,
            prediction_correct: resolution.predictionCorrect,
            realized_return_pct: resolution.realizedReturnPct,
          }
        : {}),
    };
    writeFile(picks);
  }

  async resolveHorizon(id: string, resolution: PredictionResolution): Promise<void> {
    const picks = readFile();
    const idx = picks.findIndex((p) => p.id === id);
    if (idx === -1) throw new Error(`FileAlphaStore: pick ${id} not found for horizon resolve`);
    picks[idx] = {
      ...picks[idx],
      resolved: true,
      resolved_date: resolution.resolvedDate,
      resolution_outcome: resolution.outcome,
      resolved_price: resolution.resolvedPrice > 0 ? resolution.resolvedPrice : null,
      prediction_correct: resolution.predictionCorrect,
      realized_return_pct: resolution.realizedReturnPct,
    };
    writeFile(picks);
  }

  async fetchResolved(limit = 200): Promise<AlphaPick[]> {
    return readFile()
      .filter((p) => p.resolved === true)
      .sort((a, b) => (b.resolved_date ?? "").localeCompare(a.resolved_date ?? ""))
      .slice(0, limit);
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

// True when a PostgREST error is "this column doesn't exist" — i.e. a migration
// hasn't been applied yet. Lets writes degrade gracefully so a deploy can
// precede its migration (migrations 009 and 017 both rely on this).
function isMissingColumn(error: { code?: string; message?: string }): boolean {
  return (
    error.code === "PGRST204" ||
    error.code === "42703" ||
    /column .* does not exist/i.test(error.message ?? "")
  );
}

// Optional columns added by later migrations. Stripped from an insert if the
// table predates the migration, so the core pick still lands.
const OPTIONAL_PICK_COLUMNS = [
  // migration 009 — institutional
  "position_size_pct",
  "risk_reward",
  "lens_scores",
  "regime_stance",
  "regime_summary",
  // migration 017 — mosaic + prediction + resolution
  "edge_factors",
  "edge_summary",
  "predicted_price",
  "horizon_days",
  "target_date",
  "confidence_pct",
  "prob_of_loss_pct",
  "expected_value_pct",
  "scenarios",
  "forecast_basis",
  "resolved",
  "resolved_date",
  "resolution_outcome",
  "resolved_price",
  "prediction_correct",
  "realized_return_pct",
];

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

  async markSold(id: string, price: number, reason: string, resolution?: PredictionResolution): Promise<void> {
    const db = await this.db();
    const today = new Date().toISOString().slice(0, 10);
    const base = {
      status: "SOLD",
      exit_date: today,
      exit_price: price > 0 ? price : null,
      exit_reason: reason,
    };
    const update = resolution
      ? {
          ...base,
          resolved: true,
          resolved_date: resolution.resolvedDate,
          resolution_outcome: resolution.outcome,
          resolved_price: resolution.resolvedPrice > 0 ? resolution.resolvedPrice : null,
          prediction_correct: resolution.predictionCorrect,
          realized_return_pct: resolution.realizedReturnPct,
        }
      : base;

    const { error } = await db.from("alpha_picks").update(update).eq("id", id);
    if (!error) return;

    // Resolution columns may not exist yet (pre-migration 017). Retry with just
    // the core exit fields so the SOLD state still lands.
    if (resolution && isMissingColumn(error)) {
      console.warn(
        `[alphaStore] resolution columns missing — run migration 017. Marking ${id} SOLD without prediction grading.`
      );
      const retry = await db.from("alpha_picks").update(base).eq("id", id);
      if (retry.error) {
        throw new Error(`SupabaseAlphaStore.markSold ${id} (fallback): ${retry.error.message}`);
      }
      return;
    }
    throw new Error(`SupabaseAlphaStore.markSold ${id}: ${error.message}`);
  }

  async resolveHorizon(id: string, resolution: PredictionResolution): Promise<void> {
    const db = await this.db();
    const { error } = await db
      .from("alpha_picks")
      .update({
        resolved: true,
        resolved_date: resolution.resolvedDate,
        resolution_outcome: resolution.outcome,
        resolved_price: resolution.resolvedPrice > 0 ? resolution.resolvedPrice : null,
        prediction_correct: resolution.predictionCorrect,
        realized_return_pct: resolution.realizedReturnPct,
      })
      .eq("id", id);
    if (!error) return;
    if (isMissingColumn(error)) {
      console.warn(
        `[alphaStore] resolution columns missing — run migration 017. Skipping horizon resolve for ${id}.`
      );
      return; // no-op until the migration lands
    }
    throw new Error(`SupabaseAlphaStore.resolveHorizon ${id}: ${error.message}`);
  }

  async fetchResolved(limit = 200): Promise<AlphaPick[]> {
    const db = await this.db();
    const { data, error } = await db
      .from("alpha_picks")
      .select("*")
      .eq("resolved", true)
      .order("resolved_date", { ascending: false })
      .limit(limit);
    if (error) {
      if (isMissingColumn(error)) {
        console.warn(
          `[alphaStore] resolved column missing — run migration 017. Returning empty calibration set.`
        );
        return [];
      }
      throw new Error(`SupabaseAlphaStore.fetchResolved: ${error.message}`);
    }
    return (data ?? []) as AlphaPick[];
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
    if (!error) return;

    // If a later migration (009 institutional, 017 prediction/mosaic) hasn't
    // been applied, its columns won't exist. PostgREST surfaces this as
    // PGRST204 / 42703. Rather than dropping the whole pick, strip every
    // optional column and retry once so the core pick still lands — then warn
    // so the operator runs the migration.
    if (isMissingColumn(error)) {
      console.warn(
        `[alphaStore] optional columns missing — run migrations 009 + 017. ` +
          `Inserting ${pick.ticker} with core fields only (no sizing / lens / regime / forecast / mosaic).`
      );
      const core: Record<string, unknown> = { ...(pick as Record<string, unknown>) };
      for (const k of OPTIONAL_PICK_COLUMNS) delete core[k];
      const retry = await db.from("alpha_picks").insert(core);
      if (retry.error) {
        throw new Error(
          `SupabaseAlphaStore.insert ${pick.ticker} (fallback): ${retry.error.message}`
        );
      }
      return;
    }

    throw new Error(`SupabaseAlphaStore.insert ${pick.ticker}: ${error.message}`);
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
