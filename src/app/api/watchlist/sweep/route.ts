// POST/GET /api/watchlist/sweep  — the daily watchlist alert engine (Deliverable 3).
//
// Runs once a day (Vercel cron). Two triggers per watched ticker:
//   1. EARNINGS      — next earnings date is within 48h.
//   2. DISAGREEMENT  — the ticker's latest public Council report is FRESH
//                      (re-run within the last 24h) AND disagreement ≥ 40%.
//
// Cost discipline (CLAUDE.md):
//   - Earnings dates come from ONE Haiku+web_search per ticker (~1.5¢), cached
//     app-wide in earnings_calendar and only refreshed when stale. A ticker on
//     N watchlists is priced once, not N times.
//   - The disagreement trigger reads ALREADY-cached stock_reports — zero new
//     Council runs, zero marginal model cost.
//   - Every search is gated by the daily budget kill switch; the batch stops
//     cleanly when the wallet is tapped.
//
// Idempotency: watchlist_alert_log dedupes per (user, ticker, type, triggerKey)
// so re-running the cron (or a retry) never double-emails.
//
// Auth: bearer CRON_SECRET (Vercel cron) or ALPHA_RUN_SECRET (manual). Same
// pattern as /api/alpha/run and /api/stock/refresh.

import { NextResponse } from "next/server";
import { getWatchlistStore } from "@/lib/watchlist";
import {
  getEarningsStore,
  fetchEarningsDate,
  type EarningsEntry,
} from "@/lib/earnings";
import { getStockReportStore, type ReportSummary } from "@/lib/stockReports";
import { ensureDailyBudget, recordSpend } from "@/lib/rate-limit";
import { sendEmail } from "@/lib/email";
import {
  buildWatchlistEmail,
  type WatchlistAlertCard,
} from "@/lib/watchlistEmail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const EARNINGS_WINDOW_MS = 48 * 60 * 60 * 1000; // "within 48 hours"
const EARNINGS_STALE_MS = 20 * 60 * 60 * 1000; // re-price a ticker once/day
const DISAGREEMENT_THRESHOLD = 40; // ≥ 40% (CLAUDE.md / deliverable spec)
const REPORT_FRESH_MS = 24 * 60 * 60 * 1000; // "fresh Council analysis" = last 24h
const PER_TICKER_BUDGET = 0.02; // soft cap per earnings web_search

function isAuthorized(req: Request): boolean {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  const cronSecret = process.env.CRON_SECRET;
  const alphaSecret = process.env.ALPHA_RUN_SECRET;
  if (cronSecret && token === cronSecret) return true;
  if (alphaSecret && token === alphaSecret) return true;
  return false;
}

// Refresh the earnings cache for the work set, oldest/missing first, bounded by
// the daily budget. Returns the up-to-date earnings map for all tickers.
async function refreshEarnings(
  tickers: string[]
): Promise<{ map: Map<string, EarningsEntry>; spentUSD: number; refreshed: number; stoppedForBudget: boolean }> {
  const store = getEarningsStore();
  const map = await store.getMany(tickers);
  const now = Date.now();

  // Stalest (or missing) first so a budget stop still makes forward progress.
  const needsRefresh = tickers
    .map((t) => ({ t, entry: map.get(t.toUpperCase()) }))
    .filter(({ entry }) => !entry || now - new Date(entry.updatedAt).getTime() > EARNINGS_STALE_MS)
    .sort((a, b) => {
      const at = a.entry ? new Date(a.entry.updatedAt).getTime() : 0;
      const bt = b.entry ? new Date(b.entry.updatedAt).getTime() : 0;
      return at - bt;
    });

  let spentUSD = 0;
  let refreshed = 0;
  let stoppedForBudget = false;

  for (const { t } of needsRefresh) {
    try {
      ensureDailyBudget(PER_TICKER_BUDGET);
    } catch {
      stoppedForBudget = true;
      break;
    }
    try {
      const { entry, costUSD } = await fetchEarningsDate(t);
      await store.upsert(entry);
      recordSpend(costUSD);
      spentUSD += costUSD;
      refreshed += 1;
      map.set(t.toUpperCase(), entry);
    } catch (err) {
      console.error(`[watchlist/sweep] earnings ${t} failed:`, err instanceof Error ? err.message : err);
    }
  }

  return { map, spentUSD, refreshed, stoppedForBudget };
}

async function handle(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const watchStore = getWatchlistStore();
    const watchers = await watchStore.allWatchers();

    if (watchers.length === 0) {
      console.log("[watchlist/sweep] no watchers — nothing to do.");
      return NextResponse.json({ success: true, watchers: 0, alertsSent: 0 });
    }

    const distinctTickers = Array.from(
      new Set(watchers.map((w) => w.ticker.toUpperCase()))
    );

    // 1. Refresh earnings dates (the only model spend in this cron).
    const { map: earnings, spentUSD, refreshed, stoppedForBudget } =
      await refreshEarnings(distinctTickers);

    // 2. Pull the latest public reports in bulk (free — already cached).
    const summaries = await getStockReportStore()
      .listSummaries(2000)
      .catch(() => [] as ReportSummary[]);
    const reportByTicker = new Map(
      summaries.map((s) => [s.ticker.toUpperCase(), s])
    );

    const now = Date.now();

    // 3. Evaluate triggers per watcher, dedup, and group into per-user digests.
    const byUser = new Map<string, WatchlistAlertCard[]>();
    let earningsTriggers = 0;
    let disagreementTriggers = 0;

    for (const { email, ticker: rawTicker } of watchers) {
      const ticker = rawTicker.toUpperCase();
      const earn = earnings.get(ticker);
      const report = reportByTicker.get(ticker);

      // ── Earnings trigger ──────────────────────────────────────────────
      if (earn?.nextEarningsDate) {
        const ms = new Date(earn.nextEarningsDate + "T13:30:00Z").getTime(); // ~US market open
        const delta = ms - now;
        if (delta >= -6 * 60 * 60 * 1000 && delta <= EARNINGS_WINDOW_MS) {
          const first = await watchStore.recordAlert(
            email,
            ticker,
            "earnings",
            earn.nextEarningsDate
          );
          if (first) {
            earningsTriggers += 1;
            pushCard(byUser, email, {
              ticker,
              companyName: report?.companyName ?? earn.companyName ?? null,
              kind: "earnings",
              verdict: report?.verdict ?? null,
              conviction: report?.conviction ?? null,
              disagreement: report?.disagreement ?? null,
              earningsDate: earn.nextEarningsDate,
              hoursToEarnings: Math.round(delta / (60 * 60 * 1000)),
            });
          }
        }
      }

      // ── Disagreement trigger ─────────────────────────────────────────
      if (
        report &&
        report.disagreement >= DISAGREEMENT_THRESHOLD &&
        now - new Date(report.updatedAt).getTime() <= REPORT_FRESH_MS
      ) {
        const first = await watchStore.recordAlert(
          email,
          ticker,
          "disagreement",
          report.updatedAt // each fresh run is a distinct trigger
        );
        if (first) {
          disagreementTriggers += 1;
          pushCard(byUser, email, {
            ticker,
            companyName: report.companyName,
            kind: "disagreement",
            verdict: report.verdict,
            conviction: report.conviction,
            disagreement: report.disagreement,
            earningsDate: null,
            hoursToEarnings: null,
          });
        }
      }
    }

    // 4. Send one digest per user.
    let alertsSent = 0;
    const sendFailures: string[] = [];
    for (const [email, cards] of byUser) {
      const { subject, html, text } = buildWatchlistEmail(email, cards);
      const res = await sendEmail({ to: email, subject, html, text });
      if (res.sent) alertsSent += 1;
      else if (res.error) sendFailures.push(`${email}: ${res.error}`);
    }

    console.log(
      `[watchlist/sweep] done — watchers=${watchers.length} tickers=${distinctTickers.length} ` +
        `earningsRefreshed=${refreshed} spent=$${spentUSD.toFixed(4)} ` +
        `earningsTriggers=${earningsTriggers} disagreementTriggers=${disagreementTriggers} ` +
        `emails=${alertsSent} stoppedForBudget=${stoppedForBudget}`
    );

    return NextResponse.json({
      success: true,
      watchers: watchers.length,
      distinctTickers: distinctTickers.length,
      earningsRefreshed: refreshed,
      spentUSD: Number(spentUSD.toFixed(4)),
      earningsTriggers,
      disagreementTriggers,
      usersAlerted: byUser.size,
      emailsSent: alertsSent,
      sendFailures,
      stoppedForBudget,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[watchlist/sweep] threw:", msg);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

function pushCard(
  map: Map<string, WatchlistAlertCard[]>,
  email: string,
  card: WatchlistAlertCard
): void {
  const list = map.get(email) ?? [];
  list.push(card);
  map.set(email, list);
}

export const GET = handle;
export const POST = handle;
