// /api/scratch/marketdata — Phase 1 verification scratch route.
//
// GET → NVDA quote + 1y history + key stats from src/lib/marketdata, plus
// portfolio math (beta vs SPY, volatility, max drawdown, Sharpe) computed
// from the same feeds. Dev-only: 404s in production. Delete once the
// Portfolio surface (Phase 5) renders these numbers for real.
//
//   ?ticker=AAPL   → any other US-listed symbol (default NVDA)

import { NextResponse } from "next/server";
import { quote, history, keyStats } from "@/lib/marketdata";
import { computePortfolioStats } from "@/lib/marketdata/portfolioMath";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  try {
    const { searchParams } = new URL(req.url);
    const ticker = (searchParams.get("ticker") ?? "NVDA").toUpperCase();

    const [q, hist, stats, spy] = await Promise.all([
      quote(ticker),
      history(ticker, "1y"),
      keyStats(ticker),
      history("SPY", "1y"),
    ]);

    const computed =
      hist && spy ? computePortfolioStats(hist.candles, spy.candles) : null;

    return NextResponse.json({
      ticker,
      // Honest unavailability: a dead feed shows up as available:false here,
      // and as "data unavailable" in any real UI — never a synthetic number.
      quote: q ?? { available: false },
      keyStats: stats ?? { available: false },
      history: hist
        ? {
            provider: hist.provider,
            freshnessLabel: hist.freshnessLabel,
            sourceUrl: hist.sourceUrl,
            range: hist.range,
            candleCount: hist.candles.length,
            first: hist.candles[0],
            last: hist.candles[hist.candles.length - 1],
          }
        : { available: false },
      statsVsSpy: computed ?? { available: false },
    });
  } catch (err) {
    console.error("[scratch/marketdata] failed:", err);
    return NextResponse.json(
      { error: "marketdata scratch route failed" },
      { status: 500 }
    );
  }
}
