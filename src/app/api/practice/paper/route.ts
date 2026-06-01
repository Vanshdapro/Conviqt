// /api/practice/paper
//
// The live paper-trading desk: real tickers, real cited prices.
//
// GET  → the user's open + closed paper positions.
// POST → { action }:
//   "open"  { ticker, qty, stop?, target?, thesis? }
//            Fetches a live, cited quote (web_search) for the entry price, then
//            opens the position. Metered at paper_mark credits.
//   "mark"  { id }   Re-quotes the ticker (web_search) and marks the position to
//                    market with a fresh source. Metered at paper_mark.
//   "close" { id }   Closes at the last mark. Free (no model call).
//
// Quote fetches are metered up front and refunded if the quote can't be sourced.
// Identity comes from the verified session.

import { NextResponse } from "next/server";
import { getVerifiedUser } from "@/lib/auth";
import {
  fetchQuote,
  listPaperPositions,
  openPaperPosition,
  markPaperPosition,
  closePaperPosition,
} from "@/lib/practice/paper";
import {
  CREDITS_PER_INTENT,
  deductCredits,
  addCredits,
  getCredits,
  grantFreeCreditsIfDue,
} from "@/lib/credits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const QUOTE_COST = CREDITS_PER_INTENT.paper_mark;

async function meterQuote(email: string): Promise<{ ok: true; remaining: number } | { res: Response }> {
  await grantFreeCreditsIfDue(email);
  const balance = (await getCredits(email))?.credits ?? 0;
  if (balance < QUOTE_COST) {
    return {
      res: NextResponse.json(
        { error: "insufficient_credits", needed: QUOTE_COST, credits: balance },
        { status: 402 },
      ),
    };
  }
  const deducted = await deductCredits(email, QUOTE_COST, "paper_mark", 0);
  if (!deducted.ok) {
    return {
      res: NextResponse.json(
        { error: "insufficient_credits", needed: QUOTE_COST, credits: deducted.remaining },
        { status: 402 },
      ),
    };
  }
  return { ok: true, remaining: deducted.remaining };
}

export async function GET() {
  try {
    const user = await getVerifiedUser();
    if (!user) return NextResponse.json({ error: "auth_required" }, { status: 401 });
    const positions = await listPaperPositions(user.email);
    return NextResponse.json({ positions });
  } catch (err) {
    console.error("[practice] paper GET error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getVerifiedUser();
    if (!user) return NextResponse.json({ error: "auth_required" }, { status: 401 });

    let body: Record<string, unknown>;
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: "bad_request" }, { status: 400 });
    }

    const action = typeof body.action === "string" ? body.action : "";

    // ── OPEN ────────────────────────────────────────────────────────────────
    if (action === "open") {
      const ticker = typeof body.ticker === "string" ? body.ticker.trim().toUpperCase() : "";
      const qty = Number(body.qty);
      if (!ticker || !/^[A-Z.\-]{1,8}$/.test(ticker)) {
        return NextResponse.json({ error: "bad_ticker" }, { status: 400 });
      }
      if (!Number.isFinite(qty) || qty <= 0) {
        return NextResponse.json({ error: "bad_qty" }, { status: 400 });
      }

      const meter = await meterQuote(user.email);
      if ("res" in meter) return meter.res;

      const { quote } = await fetchQuote(ticker);
      if (!quote) {
        await addCredits(user.email, QUOTE_COST, `refund_paper_open_${ticker}`);
        return NextResponse.json({ error: "quote_unavailable", ticker }, { status: 502 });
      }

      const stop = Number(body.stop);
      const target = Number(body.target);
      const thesis = typeof body.thesis === "string" ? body.thesis.slice(0, 500) : null;

      const position = await openPaperPosition(user.email, {
        ticker,
        qty: Math.round(qty * 10000) / 10000,
        entryPrice: quote.price,
        entrySource: quote.sourceUrl,
        entryAsOf: quote.asOf,
        stopPrice: Number.isFinite(stop) && stop > 0 ? stop : null,
        targetPrice: Number.isFinite(target) && target > 0 ? target : null,
        thesis,
      });
      if (!position) {
        return NextResponse.json({ error: "open_failed" }, { status: 500 });
      }
      return NextResponse.json({ position, quote, creditsRemaining: meter.remaining });
    }

    // ── MARK ────────────────────────────────────────────────────────────────
    if (action === "mark") {
      const id = typeof body.id === "string" ? body.id : "";
      if (!id) return NextResponse.json({ error: "bad_id" }, { status: 400 });

      const positions = await listPaperPositions(user.email);
      const target = positions.find((p) => p.id === id && p.status === "open");
      if (!target) return NextResponse.json({ error: "position_not_found" }, { status: 404 });

      const meter = await meterQuote(user.email);
      if ("res" in meter) return meter.res;

      const { quote } = await fetchQuote(target.ticker);
      if (!quote) {
        await addCredits(user.email, QUOTE_COST, `refund_paper_mark_${target.ticker}`);
        return NextResponse.json({ error: "quote_unavailable", ticker: target.ticker }, { status: 502 });
      }

      const position = await markPaperPosition(user.email, id, quote);
      if (!position) return NextResponse.json({ error: "mark_failed" }, { status: 500 });
      return NextResponse.json({ position, quote, creditsRemaining: meter.remaining });
    }

    // ── CLOSE (free) ──────────────────────────────────────────────────────────
    if (action === "close") {
      const id = typeof body.id === "string" ? body.id : "";
      if (!id) return NextResponse.json({ error: "bad_id" }, { status: 400 });

      const positions = await listPaperPositions(user.email);
      const target = positions.find((p) => p.id === id && p.status === "open");
      if (!target) return NextResponse.json({ error: "position_not_found" }, { status: 404 });

      const exit = target.lastMark ?? target.entryPrice;
      const position = await closePaperPosition(user.email, id, exit);
      if (!position) return NextResponse.json({ error: "close_failed" }, { status: 500 });
      return NextResponse.json({ position });
    }

    return NextResponse.json({ error: "unknown_action" }, { status: 400 });
  } catch (err) {
    console.error("[practice] paper POST error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
