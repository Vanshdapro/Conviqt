// The Conviqt Disagreement Index (CDI) — engine + store.
//
// The CDI is a published, named data product: a weekly ranking of the stocks
// the AI Council fractured on hardest. It packages Conviqt's one unique signal
// (cross-agent disagreement on public equities) into a fixed, citable artifact
// — the thing a finance journalist can link to the way they link to the VIX.
//
// Design (see migration 016_cdi_snapshots.sql):
//   - A cron computes ONE snapshot per week and freezes it. The /index page
//     reads the latest frozen snapshot, so the ranking is stable and citable.
//   - "Conviction trend vs last week" diffs this week's snapshot against the
//     prior week's frozen row — a real reference, not a guess.
//   - ZERO Claude spend. Everything here is composed deterministically from
//     data we already store: stock_reports for the disagreement ranking, and
//     each ticker's stored Council report blob for the bull/bear case +
//     dissents that become the "what they're fighting about" blurb.
//
// Backend auto-selects (same pattern as stockReports.ts / convictionHistory.ts):
//   - Supabase  when NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY set
//   - JSON file (data/cdi-snapshots.json) otherwise — local dev.

import fs from "fs";
import path from "path";
import type { Verdict } from "./agents/types";
import { getStockReport, getStockReportStore } from "./stockReports";

// How many names the published index ranks.
export const CDI_SIZE = 20;

// Movement of a ticker's disagreement vs the prior weekly snapshot.
export type CDITrend = "up" | "down" | "flat" | "new";

// One ranked row of the index.
export interface CDIEntry {
  rank: number;
  ticker: string;
  companyName: string;
  disagreement: number; // 0-100 — the contest score this ranks on
  verdict: Verdict; // the Council's net call despite the fracture
  conviction: number; // 0-100 — how strongly the Judge holds that call
  trend: CDITrend; // disagreement vs last week's snapshot
  trendDelta: number; // signed points of disagreement change (0 when new)
  prevRank: number | null; // rank in last week's snapshot, null if new entry
  // Human-readable tally of the specialist panel, e.g. "2 BUY · 1 HOLD · 1 SELL".
  voteSplit: string;
  dissents: string[]; // specialist agents that broke from the verdict
  // One-line plain-English summary of what the agents are fighting about.
  fight: string;
  bullLine: string; // the bull case in one sentence
  bearLine: string; // the bear case in one sentence
  asOf: string; // ISO — when this ticker's underlying Council run happened
}

// A frozen weekly publication of the index.
export interface CDISnapshot {
  weekOf: string; // YYYY-MM-DD (Monday, UTC)
  generatedAt: string; // ISO
  avgDisagreement: number; // 0-100 across the ranked entries
  peakTicker: string | null; // most-contested name this week
  peakDisagreement: number; // its disagreement score
  entries: CDIEntry[];
}

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

// Monday (UTC) of the week containing `d`, as YYYY-MM-DD. The canonical weekly
// bucket key — every snapshot in a given week shares it, so re-publishing
// overwrites rather than duplicates.
export function weekOfMonday(d = new Date()): string {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dow = date.getUTCDay(); // 0=Sun..6=Sat
  const diff = (dow + 6) % 7; // days since Monday
  date.setUTCDate(date.getUTCDate() - diff);
  return date.toISOString().slice(0, 10);
}

// First sentence of a blurb, trimmed to a sane length for a one-liner. Council
// bull/bear cases are 2-3 sentences; the index only has room for the punchline.
function firstSentence(text: string | undefined, max = 160): string {
  if (!text) return "";
  const clean = text.replace(/\s+/g, " ").trim();
  const stop = clean.search(/[.!?]\s/);
  let out = stop > 0 ? clean.slice(0, stop + 1) : clean;
  if (out.length > max) out = out.slice(0, max - 1).trimEnd() + "…";
  return out;
}

// --------------------------------------------------------------------------
// Store
// --------------------------------------------------------------------------

export interface CDIStore {
  getLatest(): Promise<CDISnapshot | null>;
  getByWeek(weekOf: string): Promise<CDISnapshot | null>;
  put(snapshot: CDISnapshot): Promise<void>;
  // Snapshots newest-first, capped. Used to find the prior-week reference for
  // trend, and to render the archive.
  listRecent(limit: number): Promise<CDISnapshot[]>;
}

const FILE_PATH = path.resolve(process.cwd(), "data/cdi-snapshots.json");

type FileShape = Record<string, CDISnapshot>; // weekOf -> snapshot

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

class FileCDIStore implements CDIStore {
  async getLatest(): Promise<CDISnapshot | null> {
    return (await this.listRecent(1))[0] ?? null;
  }

  async getByWeek(weekOf: string): Promise<CDISnapshot | null> {
    return readFile()[weekOf] ?? null;
  }

  async put(snapshot: CDISnapshot): Promise<void> {
    const map = readFile();
    map[snapshot.weekOf] = snapshot;
    writeFile(map);
  }

  async listRecent(limit: number): Promise<CDISnapshot[]> {
    return Object.values(readFile())
      .sort((a, b) => b.weekOf.localeCompare(a.weekOf))
      .slice(0, limit);
  }
}

interface Row {
  week_of: string;
  generated_at: string;
  avg_disagreement: number;
  entries: CDIEntry[];
  stats: { peakTicker: string | null; peakDisagreement: number } | null;
}

function rowToSnapshot(row: Row): CDISnapshot {
  return {
    weekOf: row.week_of,
    generatedAt: row.generated_at,
    avgDisagreement: row.avg_disagreement,
    peakTicker: row.stats?.peakTicker ?? null,
    peakDisagreement: row.stats?.peakDisagreement ?? 0,
    entries: row.entries ?? [],
  };
}

class SupabaseCDIStore implements CDIStore {
  private async db() {
    const { getSupabaseAdmin } = await import("./supabase");
    return getSupabaseAdmin();
  }

  async getLatest(): Promise<CDISnapshot | null> {
    return (await this.listRecent(1))[0] ?? null;
  }

  async getByWeek(weekOf: string): Promise<CDISnapshot | null> {
    const db = await this.db();
    const { data, error } = await db
      .from("cdi_snapshots")
      .select("*")
      .eq("week_of", weekOf)
      .maybeSingle();
    if (error) throw new Error(`cdi.getByWeek ${weekOf}: ${error.message}`);
    return data ? rowToSnapshot(data as Row) : null;
  }

  async put(snapshot: CDISnapshot): Promise<void> {
    const db = await this.db();
    const { error } = await db.from("cdi_snapshots").upsert(
      {
        week_of: snapshot.weekOf,
        generated_at: snapshot.generatedAt,
        avg_disagreement: snapshot.avgDisagreement,
        entries: snapshot.entries,
        stats: {
          peakTicker: snapshot.peakTicker,
          peakDisagreement: snapshot.peakDisagreement,
        },
      },
      { onConflict: "week_of" }
    );
    if (error) throw new Error(`cdi.put ${snapshot.weekOf}: ${error.message}`);
  }

  async listRecent(limit: number): Promise<CDISnapshot[]> {
    const db = await this.db();
    const { data, error } = await db
      .from("cdi_snapshots")
      .select("*")
      .order("week_of", { ascending: false })
      .limit(limit);
    if (error) throw new Error(`cdi.listRecent: ${error.message}`);
    return (data ?? []).map((r) => rowToSnapshot(r as Row));
  }
}

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

let _store: CDIStore | null = null;

export function getCDIStore(): CDIStore {
  if (_store) return _store;
  _store = isSupabaseConfigured() ? new SupabaseCDIStore() : new FileCDIStore();
  return _store;
}

// --------------------------------------------------------------------------
// Compute — build a fresh snapshot from current data
// --------------------------------------------------------------------------

// Compose the deterministic "what they're fighting about" one-liner. No Claude
// call — we already have the Judge's bull/bear case and the dissent list.
function describeFight(
  verdict: Verdict,
  voteSplit: string,
  dissents: string[],
  bullLine: string,
  bearLine: string
): string {
  const parts: string[] = [];
  if (dissents.length) {
    const who = dissents.join(" & ");
    parts.push(
      `Net ${verdict} (${voteSplit}), but ${who} dissent${dissents.length > 1 ? "" : "s"}.`
    );
  } else {
    parts.push(`Split panel (${voteSplit}) lands on ${verdict}.`);
  }
  if (bullLine && bearLine) {
    parts.push(`Bull: ${bullLine} Bear: ${bearLine}`);
  } else if (bullLine) {
    parts.push(`Bull: ${bullLine}`);
  } else if (bearLine) {
    parts.push(`Bear: ${bearLine}`);
  }
  return parts.join(" ");
}

// Enrich a ranked ticker with the panel detail (vote split, dissents, fight
// blurb) pulled from its stored Council report. Degrades gracefully to the
// summary-only fields if the full report can't be loaded.
async function enrich(
  ticker: string,
  fallback: { verdict: Verdict; conviction: number; disagreement: number }
): Promise<{
  voteSplit: string;
  dissents: string[];
  fight: string;
  bullLine: string;
  bearLine: string;
  asOf: string;
}> {
  const stored = await getStockReport(ticker);
  if (!stored) {
    return {
      voteSplit: "",
      dissents: [],
      fight: `Net ${fallback.verdict} with elevated cross-agent disagreement.`,
      bullLine: "",
      bearLine: "",
      asOf: new Date().toISOString(),
    };
  }

  const { agents, judge } = stored.report;
  const live = agents.filter((a) => a.confidence > 0);
  const counts: Record<Verdict, number> = { BUY: 0, HOLD: 0, SELL: 0 };
  for (const a of live) counts[a.verdict] += 1;
  const voteSplit = (["BUY", "HOLD", "SELL"] as Verdict[])
    .filter((v) => counts[v] > 0)
    .map((v) => `${counts[v]} ${v}`)
    .join(" · ");

  const dissents = (judge.dissents ?? []).map(String);
  const bullLine = firstSentence(judge.bullCase);
  const bearLine = firstSentence(judge.bearCase);

  return {
    voteSplit: voteSplit || `${live.length} agents`,
    dissents,
    fight: describeFight(stored.verdict, voteSplit, dissents, bullLine, bearLine),
    bullLine,
    bearLine,
    asOf: stored.asOf,
  };
}

// Build a fresh snapshot for the current week. `prev` is last week's frozen
// snapshot (or null) and is the reference for the trend arrows.
export async function computeCDISnapshot(
  prev: CDISnapshot | null,
  size = CDI_SIZE
): Promise<CDISnapshot> {
  const summaries = await getStockReportStore().listSummaries(500);

  // Rank by disagreement desc. Tie-break: lower conviction first (a contested
  // call the Judge can't commit to is "louder"), then more recently updated.
  const ranked = [...summaries]
    .sort(
      (a, b) =>
        b.disagreement - a.disagreement ||
        a.conviction - b.conviction ||
        b.updatedAt.localeCompare(a.updatedAt)
    )
    .slice(0, size);

  const prevByTicker = new Map<string, CDIEntry>();
  for (const e of prev?.entries ?? []) prevByTicker.set(e.ticker.toUpperCase(), e);

  const entries: CDIEntry[] = [];
  for (let i = 0; i < ranked.length; i++) {
    const s = ranked[i];
    const detail = await enrich(s.ticker, {
      verdict: s.verdict,
      conviction: s.conviction,
      disagreement: s.disagreement,
    });

    const prior = prevByTicker.get(s.ticker.toUpperCase());
    let trend: CDITrend;
    let trendDelta = 0;
    if (!prior) {
      trend = "new";
    } else {
      trendDelta = s.disagreement - prior.disagreement;
      trend = trendDelta > 2 ? "up" : trendDelta < -2 ? "down" : "flat";
    }

    entries.push({
      rank: i + 1,
      ticker: s.ticker.toUpperCase(),
      companyName: s.companyName,
      disagreement: s.disagreement,
      verdict: s.verdict,
      conviction: s.conviction,
      trend,
      trendDelta,
      prevRank: prior?.rank ?? null,
      voteSplit: detail.voteSplit,
      dissents: detail.dissents,
      fight: detail.fight,
      bullLine: detail.bullLine,
      bearLine: detail.bearLine,
      asOf: detail.asOf,
    });
  }

  const avg =
    entries.length > 0
      ? Math.round(entries.reduce((s, e) => s + e.disagreement, 0) / entries.length)
      : 0;
  const peak = entries[0] ?? null;

  return {
    weekOf: weekOfMonday(),
    generatedAt: new Date().toISOString(),
    avgDisagreement: avg,
    peakTicker: peak?.ticker ?? null,
    peakDisagreement: peak?.disagreement ?? 0,
    entries,
  };
}

// --------------------------------------------------------------------------
// Publish (cron) + read (page)
// --------------------------------------------------------------------------

// Compute and freeze this week's snapshot. Trend references the most recent
// snapshot from a PRIOR week (so re-running mid-week doesn't compare a week to
// itself). Returns the snapshot it wrote.
export async function publishCDISnapshot(): Promise<CDISnapshot> {
  const store = getCDIStore();
  const thisWeek = weekOfMonday();
  const recent = await store.listRecent(4);
  const prev = recent.find((s) => s.weekOf < thisWeek) ?? null;

  const snapshot = await computeCDISnapshot(prev);
  await store.put(snapshot);
  console.log(
    `[cdi] published ${snapshot.weekOf} — ${snapshot.entries.length} names, avg disagreement ${snapshot.avgDisagreement}, peak ${snapshot.peakTicker} (${snapshot.peakDisagreement})`
  );
  return snapshot;
}

// What the /index page renders. Prefers the latest frozen snapshot; if none has
// been published yet (before the first cron run), computes a live one so the
// page is never empty. Fails soft to null so a store error can't crash the page.
export async function getDisplayCDI(): Promise<CDISnapshot | null> {
  try {
    const latest = await getCDIStore().getLatest();
    if (latest && latest.entries.length > 0) return latest;
    return await computeCDISnapshot(null);
  } catch (err) {
    console.error("[cdi] getDisplayCDI failed:", err instanceof Error ? err.message : err);
    return null;
  }
}
