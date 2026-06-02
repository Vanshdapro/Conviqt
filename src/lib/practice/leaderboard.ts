// Paper Trade Desk — public leaderboard scoring + profiles (server-only).
//
// Standings are pure SQL aggregation over practice_paper_positions — NO model
// spend, so the public board never touches the API budget (per CLAUDE.md cost
// rules). Traders are ranked by a risk-adjusted weekly return (a Sharpe-style
// score), not raw P&L: consistent sizing beats a single lucky fill. Combined
// with the 10%-per-ticker cap enforced at open, that's the anti-gaming story.
//
// Identity: emails never leave the server. Only opted-in traders appear, and the
// public projection is handle / display_name / scores only.

import { getSupabaseAdmin } from "../supabase";
import { summarizeAccount } from "./account";
import {
  LEADERBOARD_MIN_TRADES,
  LEADERBOARD_STD_FLOOR,
  PAPER_BASE_EQUITY,
  type LeaderboardRow,
  type LeaderboardWeek,
  type PaperPosition,
} from "./types";

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));
const round4 = (n: number) => Math.round(n * 10000) / 10000;

// ── Week math (ISO weeks, Monday 00:00 UTC) ──────────────────────────────────

const DAY_MS = 86_400_000;

/** Monday (UTC, midnight) of the week containing `d`. */
export function weekStartOf(d: Date): Date {
  const u = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dow = u.getUTCDay(); // 0=Sun..6=Sat
  const back = (dow + 6) % 7; // days since Monday
  return new Date(u.getTime() - back * DAY_MS);
}

export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Parse a "YYYY-MM-DD" week-start, snapped to that week's Monday. Falls back to
 *  the current week for anything malformed or in the future. */
export function resolveWeekStart(raw: string | null | undefined): Date {
  const now = new Date();
  const current = weekStartOf(now);
  if (!raw || raw === "current") return current;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw.trim());
  if (!m) return current;
  const d = new Date(`${raw.trim()}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return current;
  const ws = weekStartOf(d);
  return ws.getTime() > current.getTime() ? current : ws;
}

function weekLabel(start: Date): string {
  const end = new Date(start.getTime() + 6 * DAY_MS);
  const fmt = (d: Date, withYear: boolean) =>
    d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      ...(withYear ? { year: "numeric" } : {}),
      timeZone: "UTC",
    });
  return `${fmt(start, false)} – ${fmt(end, true)}`;
}

// ── Sharpe-style scoring ─────────────────────────────────────────────────────

// Per-position return fraction: realized for closed, mark-to-market for open,
// flat for a freshly opened (never-marked) position.
function positionReturn(p: PaperPosition): number {
  if (p.entryPrice <= 0) return 0;
  const mark = p.status === "closed" ? p.exitPrice ?? p.entryPrice : p.lastMark ?? p.entryPrice;
  return mark / p.entryPrice - 1;
}

interface ScoredTrader {
  email: string;
  sharpe: number;
  returnPct: number;
  trades: number;
}

// Scores ONE trader's set of week positions. returnPct is dollar P&L over the
// notional $100k base (ties the score to the account framing). sharpe is the
// mean per-position return over its population std, floored so a zero-variance
// (single-trade) account can't divide to infinity.
function scoreTrader(email: string, positions: PaperPosition[]): ScoredTrader {
  const trades = positions.length;
  const returns = positions.map(positionReturn);
  const totalPnl = positions.reduce(
    (s, p) => s + (positionReturn(p)) * p.entryPrice * p.qty,
    0,
  );
  const returnPct = round4((totalPnl / PAPER_BASE_EQUITY) * 100);

  if (trades === 0) return { email, sharpe: 0, returnPct, trades };
  const mean = returns.reduce((s, r) => s + r, 0) / trades;
  const variance = returns.reduce((s, r) => s + (r - mean) ** 2, 0) / trades;
  const std = Math.max(Math.sqrt(variance), LEADERBOARD_STD_FLOOR);
  const sharpe = round4(mean / std);
  return { email, sharpe, returnPct, trades };
}

// ── Position hydration ───────────────────────────────────────────────────────

interface RawRow {
  email: string;
  ticker: string;
  qty: number;
  entry_price: number;
  last_mark: number | null;
  exit_price: number | null;
  status: string;
  opened_at: string;
}

// Minimal PaperPosition (only the fields scoring/account math read) — avoids
// re-selecting the full row + citation columns the board never shows.
function hydrate(r: RawRow): PaperPosition {
  return {
    id: "",
    ticker: r.ticker,
    qty: Number(r.qty),
    entryPrice: Number(r.entry_price),
    entrySource: null,
    entryAsOf: null,
    stopPrice: null,
    targetPrice: null,
    thesis: null,
    lastMark: r.last_mark === null ? null : Number(r.last_mark),
    lastMarkSrc: null,
    lastMarkAt: null,
    status: r.status === "closed" ? "closed" : "open",
    exitPrice: r.exit_price === null ? null : Number(r.exit_price),
    closedAt: null,
    openedAt: r.opened_at,
    marketValue: null,
    unrealizedPct: null,
  };
}

// ── Rank assembly ────────────────────────────────────────────────────────────

interface OptedProfile {
  email: string;
  handle: string;
  display_name: string | null;
}

// Builds the ranked rows for a week from opted-in profiles + their week's
// positions. Qualifying traders (≥ MIN_TRADES) are ranked by sharpe, then
// return; everyone else is listed unranked (still building a track record).
function assembleRows(
  profiles: OptedProfile[],
  positionsByEmail: Map<string, PaperPosition[]>,
): LeaderboardRow[] {
  const scored = profiles.map((pr) => {
    const s = scoreTrader(pr.email, positionsByEmail.get(pr.email) ?? []);
    return { profile: pr, ...s };
  });

  const qualifying = scored
    .filter((s) => s.trades >= LEADERBOARD_MIN_TRADES)
    .sort((a, b) => b.sharpe - a.sharpe || b.returnPct - a.returnPct);
  const building = scored
    .filter((s) => s.trades < LEADERBOARD_MIN_TRADES)
    .sort((a, b) => b.returnPct - a.returnPct);

  const rows: LeaderboardRow[] = qualifying.map((s, i) => ({
    handle: s.profile.handle,
    displayName: s.profile.display_name,
    rank: i + 1,
    sharpe: s.sharpe,
    returnPct: s.returnPct,
    trades: s.trades,
    featured: i === 0,
  }));
  for (const s of building) {
    rows.push({
      handle: s.profile.handle,
      displayName: s.profile.display_name,
      rank: null,
      sharpe: s.sharpe,
      returnPct: s.returnPct,
      trades: s.trades,
      featured: false,
    });
  }
  return rows;
}

// ── Live standings (current week, computed) ──────────────────────────────────

async function computeStandings(weekStart: Date): Promise<LeaderboardRow[]> {
  try {
    const supabase = getSupabaseAdmin();
    const startISO = `${isoDate(weekStart)}T00:00:00Z`;
    const endISO = `${isoDate(new Date(weekStart.getTime() + 7 * DAY_MS))}T00:00:00Z`;

    const { data: profRows, error: profErr } = await supabase
      .from("leaderboard_profiles")
      .select("email, handle, display_name")
      .eq("opted_in", true);
    if (profErr) {
      console.error("[leaderboard] profiles error:", profErr.message);
      return [];
    }
    const profiles = (profRows ?? []) as OptedProfile[];
    if (profiles.length === 0) return [];

    const emails = profiles.map((p) => p.email);
    const { data: posRows, error: posErr } = await supabase
      .from("practice_paper_positions")
      .select("email, ticker, qty, entry_price, last_mark, exit_price, status, opened_at")
      .in("email", emails)
      .gte("opened_at", startISO)
      .lt("opened_at", endISO);
    if (posErr) {
      console.error("[leaderboard] positions error:", posErr.message);
      return [];
    }

    const byEmail = new Map<string, PaperPosition[]>();
    for (const raw of (posRows ?? []) as RawRow[]) {
      const list = byEmail.get(raw.email) ?? [];
      list.push(hydrate(raw));
      byEmail.set(raw.email, list);
    }
    return assembleRows(profiles, byEmail);
  } catch (err) {
    // Degrade to an empty board if the store is unreachable, matching the rest
    // of the desk — a 500 would just blank the public page.
    console.error("[leaderboard] computeStandings unavailable:", msg(err));
    return [];
  }
}

// ── Frozen standings (completed weeks) ───────────────────────────────────────

function rowFromFrozen(r: {
  handle: string;
  display_name: string | null;
  rank: number;
  sharpe: number;
  return_pct: number;
  trades: number;
  featured: boolean;
}): LeaderboardRow {
  return {
    handle: r.handle,
    displayName: r.display_name,
    rank: r.rank > 0 ? r.rank : null,
    sharpe: Number(r.sharpe),
    returnPct: Number(r.return_pct),
    trades: r.trades,
    featured: r.featured,
  };
}

async function readFrozen(weekStart: Date): Promise<LeaderboardRow[] | null> {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("leaderboard_weekly")
      .select("handle, display_name, rank, sharpe, return_pct, trades, featured")
      .eq("week_start", isoDate(weekStart))
      .order("rank", { ascending: true });
    if (error) {
      console.error("[leaderboard] readFrozen error:", error.message);
      return null;
    }
    if (!data || data.length === 0) return null;
    return (data as Parameters<typeof rowFromFrozen>[0][]).map(rowFromFrozen);
  } catch (err) {
    console.error("[leaderboard] readFrozen unavailable:", msg(err));
    return null;
  }
}

// Snapshots a completed week's standings into leaderboard_weekly so the
// top-trader badge and historical rankings stay stable. Idempotent (upsert).
export async function finalizeWeek(weekStart: Date): Promise<LeaderboardRow[]> {
  const rows = await computeStandings(weekStart);
  if (rows.length === 0) return [];
  try {
    const supabase = getSupabaseAdmin();
    // We need emails to key the frozen rows; re-fetch the handle→email map.
    const { data: profRows } = await supabase
      .from("leaderboard_profiles")
      .select("email, handle")
      .eq("opted_in", true);
    const emailByHandle = new Map<string, string>();
    for (const p of (profRows ?? []) as { email: string; handle: string }[]) {
      emailByHandle.set(p.handle, p.email);
    }
    const finalized_at = new Date().toISOString();
    const payload = rows
      .map((r) => ({
        week_start: isoDate(weekStart),
        email: emailByHandle.get(r.handle) ?? "",
        handle: r.handle,
        display_name: r.displayName,
        sharpe: r.sharpe,
        return_pct: r.returnPct,
        trades: r.trades,
        rank: r.rank ?? 0,
        featured: r.featured,
        finalized_at,
      }))
      .filter((p) => p.email);
    const { error } = await supabase
      .from("leaderboard_weekly")
      .upsert(payload, { onConflict: "week_start,email" });
    if (error) console.error("[leaderboard] finalizeWeek upsert:", error.message);
    else console.log(`[leaderboard] finalized ${isoDate(weekStart)}: ${payload.length} traders`);
  } catch (err) {
    console.error("[leaderboard] finalizeWeek unavailable:", msg(err));
  }
  return rows;
}

// ── Public entrypoint ────────────────────────────────────────────────────────

// Returns the standings for a week. The live (current) week is always computed
// fresh; a completed week is read from the frozen snapshot, lazily finalizing on
// first view if it was never snapshotted. `selfHandle` marks the viewer's row.
export async function getLeaderboardWeek(
  weekStart: Date,
  selfHandle?: string | null,
): Promise<LeaderboardWeek> {
  const current = weekStartOf(new Date());
  const isCurrent = weekStart.getTime() === current.getTime();

  let rows: LeaderboardRow[];
  if (isCurrent) {
    rows = await computeStandings(weekStart);
  } else {
    rows = (await readFrozen(weekStart)) ?? (await finalizeWeek(weekStart));
  }

  if (selfHandle) {
    const selfLc = selfHandle.toLowerCase();
    rows = rows.map((r) => (r.handle.toLowerCase() === selfLc ? { ...r, isSelf: true } : r));
  }

  const featured = rows.find((r) => r.featured) ?? null;
  return {
    weekStart: isoDate(weekStart),
    weekEnd: isoDate(new Date(weekStart.getTime() + 7 * DAY_MS)),
    label: weekLabel(weekStart),
    isCurrent,
    rows,
    featured,
  };
}

// ── Trader profiles (opt-in + handle) ────────────────────────────────────────

export interface LeaderboardProfile {
  handle: string;
  displayName: string | null;
  optedIn: boolean;
}

const HANDLE_RE = /^[a-zA-Z0-9_]{3,20}$/;

export function normalizeHandle(raw: string): string {
  return raw.trim().replace(/^@+/, "");
}

export function isValidHandle(handle: string): boolean {
  return HANDLE_RE.test(handle);
}

export async function getProfile(email: string): Promise<LeaderboardProfile | null> {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("leaderboard_profiles")
      .select("handle, display_name, opted_in")
      .eq("email", email.toLowerCase().trim())
      .maybeSingle();
    if (error) {
      console.error("[leaderboard] getProfile error:", error.message);
      return null;
    }
    if (!data) return null;
    return {
      handle: data.handle as string,
      displayName: (data.display_name as string | null) ?? null,
      optedIn: Boolean(data.opted_in),
    };
  } catch (err) {
    console.error("[leaderboard] getProfile unavailable:", msg(err));
    return null;
  }
}

export type UpsertProfileResult =
  | { ok: true; profile: LeaderboardProfile }
  | { ok: false; error: "bad_handle" | "handle_taken" | "store_error" };

// Claims/updates a trader's public handle + opt-in. Handle uniqueness is
// case-insensitive and enforced by a DB unique index; we surface a friendly
// "handle_taken" if someone else holds it.
export async function upsertProfile(
  email: string,
  input: { handle: string; displayName?: string | null; optedIn: boolean },
): Promise<UpsertProfileResult> {
  const normalized = email.toLowerCase().trim();
  const handle = normalizeHandle(input.handle);
  if (!isValidHandle(handle)) return { ok: false, error: "bad_handle" };
  const displayName = (input.displayName ?? "").trim().slice(0, 40) || null;

  try {
    const supabase = getSupabaseAdmin();

    // Reject if the handle is held by a DIFFERENT email.
    const { data: clash } = await supabase
      .from("leaderboard_profiles")
      .select("email")
      .ilike("handle", handle)
      .neq("email", normalized)
      .maybeSingle();
    if (clash) return { ok: false, error: "handle_taken" };

    const { data, error } = await supabase
      .from("leaderboard_profiles")
      .upsert(
        {
          email: normalized,
          handle,
          display_name: displayName,
          opted_in: input.optedIn,
        },
        { onConflict: "email" },
      )
      .select("handle, display_name, opted_in")
      .single();
    if (error) {
      // 23505 = unique_violation on the handle index (race with the clash check).
      if ((error as { code?: string }).code === "23505") return { ok: false, error: "handle_taken" };
      console.error("[leaderboard] upsertProfile error:", error.message);
      return { ok: false, error: "store_error" };
    }
    return {
      ok: true,
      profile: {
        handle: data.handle as string,
        displayName: (data.display_name as string | null) ?? null,
        optedIn: Boolean(data.opted_in),
      },
    };
  } catch (err) {
    console.error("[leaderboard] upsertProfile unavailable:", msg(err));
    return { ok: false, error: "store_error" };
  }
}

// The viewer's own current-week standing (rank + score), for the desk header /
// "share my rank" — computed from the live week so it always matches the board.
export async function getMyWeeklyStanding(handle: string): Promise<LeaderboardRow | null> {
  const week = await getLeaderboardWeek(weekStartOf(new Date()));
  const hLc = handle.toLowerCase();
  return week.rows.find((r) => r.handle.toLowerCase() === hLc) ?? null;
}
