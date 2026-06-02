// /api/watchlist
//
// GET    → the signed-in user's watchlist, each ticker enriched with the latest
//          public Council verdict (if any) and next earnings date (if cached).
// POST   → add a ticker. Body: { ticker }. Enforces the 10-ticker cap.
// DELETE → remove a ticker. Body: { ticker }.
//
// Identity always comes from the verified session, never the client body, so a
// user can only ever read/write their own watchlist.

import { NextResponse } from "next/server";
import { getVerifiedUser } from "@/lib/auth";
import {
  getWatchlistStore,
  WatchlistFullError,
  MAX_WATCHLIST,
} from "@/lib/watchlist";
import { getEarningsStore } from "@/lib/earnings";
import { getStockReportStore, type ReportSummary } from "@/lib/stockReports";
import { isUniverseTicker, universeName } from "@/lib/tickers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TICKER_RE = /^[A-Z][A-Z.\-]{0,9}$/;

function cleanTicker(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const t = raw.toUpperCase().trim();
  return TICKER_RE.test(t) ? t : null;
}

interface EnrichedItem {
  ticker: string;
  companyName: string | null;
  createdAt: string;
  verdict: string | null;
  conviction: number | null;
  disagreement: number | null;
  reportUpdatedAt: string | null;
  nextEarningsDate: string | null;
  earningsConfidence: string | null;
}

async function enrich(
  entries: { ticker: string; createdAt: string }[]
): Promise<EnrichedItem[]> {
  const tickers = entries.map((e) => e.ticker);

  // Pull the latest verdicts + earnings in bulk. Both reads fail soft — a
  // missing enrichment must never break the list.
  const [summaries, earnings] = await Promise.all([
    getStockReportStore()
      .listSummaries(1000)
      .catch(() => [] as ReportSummary[]),
    getEarningsStore()
      .getMany(tickers)
      .catch(() => new Map()),
  ]);

  const byTicker = new Map(summaries.map((s) => [s.ticker.toUpperCase(), s]));

  return entries.map((e) => {
    const s = byTicker.get(e.ticker);
    const earn = earnings.get(e.ticker);
    return {
      ticker: e.ticker,
      companyName: s?.companyName ?? earn?.companyName ?? universeName(e.ticker) ?? null,
      createdAt: e.createdAt,
      verdict: s?.verdict ?? null,
      conviction: s?.conviction ?? null,
      disagreement: s?.disagreement ?? null,
      reportUpdatedAt: s?.updatedAt ?? null,
      nextEarningsDate: earn?.nextEarningsDate ?? null,
      earningsConfidence: earn?.confidence ?? null,
    };
  });
}

export async function GET() {
  try {
    const user = await getVerifiedUser();
    if (!user) {
      return NextResponse.json({ error: "auth_required" }, { status: 401 });
    }
    const entries = await getWatchlistStore().list(user.email);
    const items = await enrich(entries);
    return NextResponse.json({ items, max: MAX_WATCHLIST });
  } catch (err) {
    console.error("[watchlist] GET error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getVerifiedUser();
    if (!user) {
      return NextResponse.json({ error: "auth_required" }, { status: 401 });
    }

    let body: { ticker?: unknown };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "bad_request" }, { status: 400 });
    }

    const ticker = cleanTicker(body.ticker);
    if (!ticker) {
      return NextResponse.json({ error: "invalid_ticker" }, { status: 400 });
    }
    // Restrict to our covered universe so alerts and the stock page deep-link
    // actually resolve to a report surface.
    if (!isUniverseTicker(ticker)) {
      return NextResponse.json(
        { error: "unsupported_ticker", message: `${ticker} isn't in Conviqt's covered universe yet.` },
        { status: 422 }
      );
    }

    const entries = await getWatchlistStore().add(user.email, ticker);
    const items = await enrich(entries);
    console.log(`[watchlist] ${user.email} added ${ticker} (${entries.length}/${MAX_WATCHLIST})`);
    return NextResponse.json({ items, max: MAX_WATCHLIST });
  } catch (err) {
    if (err instanceof WatchlistFullError) {
      return NextResponse.json(
        { error: "watchlist_full", message: err.message },
        { status: 409 }
      );
    }
    console.error("[watchlist] POST error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await getVerifiedUser();
    if (!user) {
      return NextResponse.json({ error: "auth_required" }, { status: 401 });
    }

    let body: { ticker?: unknown };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "bad_request" }, { status: 400 });
    }

    const ticker = cleanTicker(body.ticker);
    if (!ticker) {
      return NextResponse.json({ error: "invalid_ticker" }, { status: 400 });
    }

    const entries = await getWatchlistStore().remove(user.email, ticker);
    const items = await enrich(entries);
    console.log(`[watchlist] ${user.email} removed ${ticker}`);
    return NextResponse.json({ items, max: MAX_WATCHLIST });
  } catch (err) {
    console.error("[watchlist] DELETE error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
