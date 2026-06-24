// The Radar — deterministic event gatherer (NO AI, NO predictions).
//
// This is the "what's coming" half of the Radar: it collects upcoming market
// events for a ~2-week horizon from the sources we already maintain, and hands
// a clean, de-duped, date-sorted list to the narrative step (generate.ts) which
// adds the "what's at stake / what each outcome would mean" framings.
//
// Honesty guardrail (CLAUDE.md, load-bearing): ORIENTATION, never alpha. Nothing
// here predicts anything — it only gathers dates that already exist:
//   • Earnings  — each ticker's NEXT earnings date from the shared earnings
//     cache (src/lib/earnings.ts). For a SMALL number of tickers with no cached
//     date we fetch one (web_search-backed, ~1¢ each on Claude), strictly capped.
//   • Fed/macro — the FOMC/CPI/jobs-style dates already on the cached Dashboard
//     feed (src/lib/feed/store.ts → readDashboard().events).
//
// Cost discipline (CLAUDE.md): the earnings cache is read for free; we only pay
// for at most EARNINGS_FETCH_CAP fresh fetches per gather, run a few at a time,
// and skip any that fail. Never invent a date — a source that fails is omitted.
//
// Every external read is wrapped so one dead source can never throw the whole
// gather: a failed cache read or a failed dashboard read logs and yields [].

import { getEarningsStore, fetchEarningsDate } from "../earnings";
import type { EarningsEntry } from "../earnings";
import { readDashboard } from "../feed/store";
import type { FeedEvent } from "../feed/types";
import {
  RADAR_HORIZON_DAYS,
  RADAR_MARKET_TICKERS,
  daysAwayUTC,
  radarEventId,
} from "./types";
import type { UpcomingEvent, RadarEventKind } from "./types";

// Cost control (CLAUDE.md ~1¢/fetch on Claude): never fetch more than this many
// missing earnings dates per gather, and never more than this many at once.
const EARNINGS_FETCH_CAP = 6;
const EARNINGS_FETCH_CONCURRENCY = 3;
// The web_search-backed fetch can be slow (or, on a cold cache, hang). The Radar
// must NEVER block on it: a single fetch is capped, and the whole fetch phase is
// capped. Anything not back in time is omitted this run — honest, non-blocking;
// the dates fill in once the earnings alerts cron warms the shared cache.
const EARNINGS_FETCH_TIMEOUT_MS = 15_000;
const EARNINGS_FETCH_PHASE_MS = 45_000;

// Resolve `p`, or `fallback` if it doesn't settle within `ms`. The timer is
// cleared on settle so it never keeps the event loop (or a route) alive.
function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise<T>((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms);
    p.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      () => {
        clearTimeout(timer);
        resolve(fallback);
      }
    );
  });
}

export interface GatherOptions {
  /** Days of look-ahead. Defaults to RADAR_HORIZON_DAYS (~2 weeks). */
  horizonDays?: number;
  /** Earnings universe. Defaults to RADAR_MARKET_TICKERS (liquid mega-caps). */
  tickers?: string[];
}

// ── Tiny bounded-concurrency pool ────────────────────────────────────────────
//
// Run `worker` over `items`, at most `limit` in flight, preserving nothing about
// order (callers sort afterwards). A rejected worker becomes `null` so one bad
// fetch never sinks the batch.

async function mapPool<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>
): Promise<Array<R | null>> {
  const out: Array<R | null> = new Array(items.length).fill(null);
  let next = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      try {
        out[i] = await worker(items[i]);
      } catch {
        out[i] = null; // failures are skipped silently — never invent a date
      }
    }
  });
  await Promise.all(runners);
  return out;
}

// ── Normalisation helpers ─────────────────────────────────────────────────────

/** Uppercase + dedupe a ticker list, dropping blanks. */
function normTickers(tickers: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of tickers) {
    const t = raw.trim().toUpperCase();
    if (t && !seen.has(t)) {
      seen.add(t);
      out.push(t);
    }
  }
  return out;
}

/** Build an earnings UpcomingEvent from a cache/fetched entry (date assumed set). */
function earningsEvent(ticker: string, entry: EarningsEntry): UpcomingEvent | null {
  const date = entry.nextEarningsDate;
  if (!date) return null;
  const company = entry.companyName?.trim() || undefined;
  return {
    id: radarEventId("earnings", date, ticker),
    kind: "earnings",
    date,
    daysAway: daysAwayUTC(date),
    title: `${ticker} reports earnings`,
    ticker,
    company,
    sourceUrl: entry.sourceUrl ?? undefined,
  };
}

// ── Earnings (cache first, then a tiny capped fetch for the gaps) ─────────────

async function gatherEarnings(tickers: string[]): Promise<UpcomingEvent[]> {
  if (tickers.length === 0) return [];

  // 1) Read every ticker from the shared cache in one shot (free).
  let cached: Map<string, EarningsEntry>;
  try {
    cached = await getEarningsStore().getMany(tickers);
  } catch (err) {
    console.error("[radar] earnings cache read failed:", err);
    cached = new Map();
  }

  const events: UpcomingEvent[] = [];
  const missing: string[] = [];
  for (const ticker of tickers) {
    const entry = cached.get(ticker);
    if (entry?.nextEarningsDate) {
      const ev = earningsEvent(ticker, entry);
      if (ev) events.push(ev);
    } else {
      // No cached date (or a cached miss) — a candidate for a paid fetch.
      missing.push(ticker);
    }
  }

  // 2) For the gaps, fetch at most EARNINGS_FETCH_CAP dates, a few at a time.
  //    Anything beyond the cap is simply left out this run — honest omission,
  //    not a guess. (Cost: ≤ EARNINGS_FETCH_CAP × ~1¢ on Claude.)
  const toFetch = missing.slice(0, EARNINGS_FETCH_CAP);
  if (toFetch.length > 0) {
    // Each fetch is time-boxed (a hung web_search must not stall the pool), and
    // the whole phase is time-boxed too, so the gather always returns promptly.
    const fetched = await withTimeout(
      mapPool(toFetch, EARNINGS_FETCH_CONCURRENCY, async (ticker) => {
        const res = await withTimeout(fetchEarningsDate(ticker), EARNINGS_FETCH_TIMEOUT_MS, null);
        if (!res) return null;
        return res.entry.nextEarningsDate ? earningsEvent(ticker, res.entry) : null;
      }),
      EARNINGS_FETCH_PHASE_MS,
      [] as Array<UpcomingEvent | null>
    );
    for (const ev of fetched) {
      if (ev) events.push(ev);
    }
  }

  return events;
}

// ── Fed / macro (from the cached Dashboard feed) ──────────────────────────────

async function gatherFedMacro(): Promise<UpcomingEvent[]> {
  let feedEvents: FeedEvent[] = [];
  try {
    const dash = await readDashboard();
    feedEvents = dash?.events ?? [];
  } catch (err) {
    console.error("[radar] dashboard read failed:", err);
    return [];
  }

  const out: UpcomingEvent[] = [];
  for (const fe of feedEvents) {
    // Earnings are gathered from the dedicated cache above; here we take only
    // the macro-calendar entries (FOMC, CPI, jobs…) the feed already carries.
    if (fe.kind !== "fed" && fe.kind !== "macro") continue;
    const date = fe.date?.trim();
    const title = fe.label?.trim();
    if (!date || !title) continue; // omit rather than fabricate

    const kind = fe.kind as RadarEventKind;
    out.push({
      id: radarEventId(kind, date, title),
      kind,
      date,
      daysAway: daysAwayUTC(date),
      title, // the FeedEvent label IS the plain-English title
      ticker: fe.ticker?.trim() || undefined,
      sourceUrl: fe.sourceUrl ?? undefined,
    });
  }
  return out;
}

// ── Public entry point ────────────────────────────────────────────────────────

/**
 * Gather upcoming market events within the horizon, soonest first.
 *
 * Pure data: no AI, no predictions. Earnings come from the shared cache (with a
 * tiny, capped web_search fetch for gaps); Fed/macro come from the cached
 * Dashboard feed. Events are filtered to [0, horizon] days away, de-duped by id,
 * and sorted ascending by date. The list is NOT truncated — callers cap it.
 */
export async function gatherUpcomingEvents(opts?: GatherOptions): Promise<UpcomingEvent[]> {
  const horizon = opts?.horizonDays ?? RADAR_HORIZON_DAYS;
  const tickers = normTickers(opts?.tickers ?? RADAR_MARKET_TICKERS);

  // Both reads are independent, so run them together; each already swallows its
  // own failures and returns [] so one dead source never throws the gather.
  const [earnings, fedMacro] = await Promise.all([
    gatherEarnings(tickers),
    gatherFedMacro(),
  ]);

  // Filter to the horizon, drop NaN dates (daysAwayUTC returns NaN on a bad
  // date — both comparisons are false, so it's excluded automatically).
  const inWindow = [...earnings, ...fedMacro].filter(
    (e) => e.daysAway >= 0 && e.daysAway <= horizon
  );

  // Dedupe by id (a ticker on the feed AND in the earnings cache, etc.).
  const byId = new Map<string, UpcomingEvent>();
  for (const e of inWindow) {
    if (!byId.has(e.id)) byId.set(e.id, e);
  }

  // Soonest first; tie-break by id for a stable order.
  const sorted = [...byId.values()].sort(
    (a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id)
  );

  console.log(
    `[radar] gathered ${sorted.length} event(s) within ${horizon}d ` +
      `(earnings=${earnings.length}, fed/macro=${fedMacro.length}, tickers=${tickers.length})`
  );

  return sorted;
}
