import { NextResponse } from "next/server";
import { VALID_TICKER_RE } from "@/lib/agents/router";
import { quote, keyStats, history } from "@/lib/marketdata";

// GET /api/stock/:ticker/market
//
// Public (no auth). Returns quote + keyStats + 3-month price history for the
// report page hero and price chart. The front-end fetches this on mount so the
// static pSEO HTML is still cacheable by crawlers — real numbers arrive client-
// side and never stale-serve from Next.js ISR cache.
//
// All three calls run in parallel. Null fields mean no provider answered
// (rendered as "—" in the UI per CLAUDE.md).

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_RANGES = new Set(["1mo", "3mo", "6mo", "1y", "2y", "5y"]);

interface RouteContext {
  params: Promise<{ ticker: string }>;
}

export async function GET(req: Request, ctx: RouteContext) {
  const { ticker } = await ctx.params;
  const TICK = ticker?.trim().toUpperCase() ?? "";

  if (!VALID_TICKER_RE.test(TICK)) {
    return NextResponse.json({ error: `Invalid ticker: ${ticker}` }, { status: 400 });
  }

  const url = new URL(req.url);
  const rangeParam = url.searchParams.get("range") ?? "3mo";
  const range = VALID_RANGES.has(rangeParam) ? rangeParam as import("@/lib/marketdata").HistoryRange : "3mo";

  try {
    const [q, stats, hist] = await Promise.allSettled([
      quote(TICK),
      keyStats(TICK),
      history(TICK, range),
    ]);

    return NextResponse.json(
      {
        ticker: TICK,
        quote: q.status === "fulfilled" ? q.value : null,
        keyStats: stats.status === "fulfilled" ? stats.value : null,
        history: hist.status === "fulfilled" ? hist.value : null,
      },
      {
        headers: {
          // Cache 15 min at CDN, allow stale for 30 min while revalidating
          "Cache-Control": "public, s-maxage=900, stale-while-revalidate=1800",
        },
      }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[market] ${TICK} failed:`, msg);
    return NextResponse.json({ error: "Market data unavailable." }, { status: 500 });
  }
}
