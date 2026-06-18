// Analysis history — per-user persistence (server-only).
//
// One row per completed Research run (migration 026). The full rendered
// outcome lives in `payload` jsonb so a user can REOPEN any past analysis at
// zero cost — re-viewing is a pure DB read, never a fresh pipeline run.
//
// All access is via the service-role admin client; the route guarantees the
// email comes from the verified session, never the client. Every function
// degrades gracefully (empty / null / false) if the store is unreachable, so
// the Research surface keeps working even when history is down.

import { getSupabaseAdmin } from "../supabase";

export type HistoryKind =
  | "council"
  | "focused"
  | "compare"
  | "sector"
  | "headline"
  | "allocator"
  | "audit"
  | "skillview"
  | "text";

export const HISTORY_KINDS: HistoryKind[] = [
  "council",
  "focused",
  "compare",
  "sector",
  "headline",
  "allocator",
  "audit",
  "skillview",
  "text",
];

export function isHistoryKind(x: unknown): x is HistoryKind {
  return typeof x === "string" && (HISTORY_KINDS as string[]).includes(x);
}

/** Lightweight row for the history list (no heavy payload). */
export interface HistoryListItem {
  id: string;
  kind: HistoryKind;
  skillId: string | null;
  title: string;
  tickers: string[];
  createdAt: string;
}

/** A full row, including the stored result payload for re-rendering. */
export interface HistoryItem extends HistoryListItem {
  payload: unknown;
}

export interface SaveHistoryInput {
  kind: HistoryKind;
  skillId?: string | null;
  title: string;
  tickers?: string[];
  payload: unknown;
}

// Keep the most recent N analyses per user. Pruning is best-effort and never
// blocks a save. Generous enough that no real user hits it soon, bounded enough
// that one account can't grow jsonb storage without limit.
const MAX_PER_USER = 200;
// Result payloads are normally a few KB; cap to keep a single row sane and to
// reject anything pathological the client might POST.
const MAX_PAYLOAD_BYTES = 256 * 1024;
// List view never needs every row — the sheet shows the most recent slice.
const LIST_LIMIT = 100;

const LIST_COLS = "id, kind, skill_id, title, tickers, created_at";

interface HistoryRow {
  id: string;
  kind: string;
  skill_id: string | null;
  title: string;
  tickers: string[] | null;
  created_at: string;
  payload?: unknown;
}

function admin() {
  return getSupabaseAdmin();
}

function mapList(row: HistoryRow): HistoryListItem {
  return {
    id: row.id,
    kind: (isHistoryKind(row.kind) ? row.kind : "text"),
    skillId: row.skill_id ?? null,
    title: row.title,
    tickers: Array.isArray(row.tickers) ? row.tickers : [],
    createdAt: row.created_at,
  };
}

// ── Writes ─────────────────────────────────────────────────────────────────

/**
 * Persist one completed analysis. Returns the lightweight saved row, or null
 * if the payload is too large or the store is unreachable (the caller treats
 * null as a soft failure — the analysis still rendered; it just wasn't saved).
 */
export async function saveHistory(
  email: string,
  input: SaveHistoryInput
): Promise<HistoryListItem | null> {
  const e = email.toLowerCase().trim();

  const title = (input.title ?? "").toString().trim().slice(0, 300) || "Analysis";
  const tickers = Array.isArray(input.tickers)
    ? input.tickers
        .filter((t): t is string => typeof t === "string")
        .map((t) => t.toUpperCase().slice(0, 12))
        .slice(0, 12)
    : [];

  let payloadJson: string;
  try {
    payloadJson = JSON.stringify(input.payload ?? null);
  } catch {
    console.error("[history] saveHistory: payload not serializable");
    return null;
  }
  if (payloadJson.length > MAX_PAYLOAD_BYTES) {
    console.error(`[history] saveHistory: payload too large (${payloadJson.length}B) for ${e}`);
    return null;
  }

  try {
    const { data, error } = await admin()
      .from("analysis_history")
      .insert({
        email: e,
        kind: input.kind,
        skill_id: input.skillId ?? null,
        title,
        tickers,
        payload: input.payload ?? null,
      })
      .select(LIST_COLS)
      .single();

    if (error) {
      console.error("[history] saveHistory error:", error.message);
      return null;
    }

    // Best-effort prune of anything beyond the cap. Never blocks the save.
    void pruneOld(e);

    return mapList(data as unknown as HistoryRow);
  } catch (err) {
    console.error("[history] saveHistory threw:", err instanceof Error ? err.message : err);
    return null;
  }
}

async function pruneOld(email: string): Promise<void> {
  try {
    const { data, error } = await admin()
      .from("analysis_history")
      .select("id")
      .eq("email", email)
      .order("created_at", { ascending: false })
      .range(MAX_PER_USER, MAX_PER_USER + 100);
    if (error || !data || data.length === 0) return;
    const ids = (data as Array<{ id: string }>).map((r) => r.id);
    await admin().from("analysis_history").delete().in("id", ids);
  } catch {
    // Pruning is housekeeping — swallow failures silently.
  }
}

// ── Reads ──────────────────────────────────────────────────────────────────

export async function listHistory(email: string): Promise<HistoryListItem[]> {
  const e = email.toLowerCase().trim();
  try {
    const { data, error } = await admin()
      .from("analysis_history")
      .select(LIST_COLS)
      .eq("email", e)
      .order("created_at", { ascending: false })
      .limit(LIST_LIMIT);
    if (error) {
      console.error("[history] listHistory error:", error.message);
      return [];
    }
    return (data as unknown as HistoryRow[]).map(mapList);
  } catch (err) {
    console.error("[history] listHistory threw:", err instanceof Error ? err.message : err);
    return [];
  }
}

export async function getHistoryItem(email: string, id: string): Promise<HistoryItem | null> {
  const e = email.toLowerCase().trim();
  try {
    const { data, error } = await admin()
      .from("analysis_history")
      .select(`${LIST_COLS}, payload`)
      .eq("email", e)
      .eq("id", id)
      .single();
    if (error || !data) return null;
    const row = data as unknown as HistoryRow;
    return { ...mapList(row), payload: row.payload ?? null };
  } catch (err) {
    console.error("[history] getHistoryItem threw:", err instanceof Error ? err.message : err);
    return null;
  }
}

export async function deleteHistoryItem(email: string, id: string): Promise<boolean> {
  const e = email.toLowerCase().trim();
  try {
    const { error } = await admin()
      .from("analysis_history")
      .delete()
      .eq("email", e)
      .eq("id", id);
    if (error) {
      console.error("[history] deleteHistoryItem error:", error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[history] deleteHistoryItem threw:", err instanceof Error ? err.message : err);
    return false;
  }
}
