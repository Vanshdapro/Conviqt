import { NextResponse } from "next/server";
import { VALID_TICKER_RE } from "@/lib/agents/router";
import { getSessionUser } from "@/lib/auth";
import { getStockReport } from "@/lib/stockReports";

// GET /api/stock/:ticker/report
//
// Returns the FULL cached Council report for a ticker — but only to signed-in
// users. This is the server-side enforcement behind the login gate on the
// public stock page: the static page ships the summary; the premium depth
// (key metrics, catalysts, agent breakdown) is fetched from here so it never
// lands in anonymous HTML.
//
// This route only READS the persisted report. It never runs the Council, so
// it costs nothing and is safe to hit on every page view.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ ticker: string }>;
}

export async function GET(_req: Request, ctx: RouteContext) {
  const { ticker } = await ctx.params;
  const TICK = ticker?.trim().toUpperCase() ?? "";

  if (!VALID_TICKER_RE.test(TICK)) {
    return NextResponse.json({ error: `Invalid ticker: ${ticker}` }, { status: 400 });
  }

  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json(
        { error: "Sign in to view the full research note.", gated: true },
        { status: 401 }
      );
    }

    const stored = await getStockReport(TICK);
    if (!stored) {
      return NextResponse.json(
        { error: `No published report for ${TICK} yet.` },
        { status: 404 }
      );
    }

    return NextResponse.json({ result: stored.report });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[stock/report] ${TICK} failed:`, msg);
    return NextResponse.json({ error: "Unable to load report." }, { status: 500 });
  }
}
