import { getVerifiedUser } from "@/lib/auth";
import { getLivePortfolioView } from "@/lib/portfolio/live";
import { getLatestAudit, getPortfolio, listPortfolios } from "@/lib/portfolio/store";

// GET /api/portfolio/live[?id=<uuid>]
//
// The free half of the Portfolio surface: the signed-in user's portfolio
// (most recently updated one by default), every holding priced through the
// marketdata layer, plus the deterministic stats strip (Beta · Volatility ·
// Max Drawdown · Sharpe vs SPY) and the latest saved Health Check. No model
// calls, no credits — quotes and history come from the shared 15-min/24-h
// caches, so a refresh costs nothing.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function GET(req: Request) {
  try {
    const user = await getVerifiedUser();
    if (!user) return json({ error: "Please sign in.", code: "auth_required" }, 401);

    const id = new URL(req.url).searchParams.get("id");
    const portfolio = id
      ? await getPortfolio(user.email, id)
      : (await listPortfolios(user.email))[0] ?? null;

    if (!portfolio) return json({ portfolio: null });

    const [view, latestAudit] = await Promise.all([
      getLivePortfolioView(portfolio.holdings, portfolio.cash),
      getLatestAudit(user.email, portfolio.id),
    ]);

    console.log(
      `[portfolio/live] ${user.email} ${portfolio.id}: ${view.totals.pricedCount}/${portfolio.holdings.length} priced, stats=${view.statsStrip.stats ? "ok" : "unavailable"}`
    );

    return json({ portfolio, ...view, latestAudit });
  } catch (err) {
    console.error("[portfolio/live] failed:", err instanceof Error ? err.message : err);
    return json({ error: "Could not load your portfolio right now." }, 500);
  }
}
