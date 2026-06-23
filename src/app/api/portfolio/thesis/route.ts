import { getVerifiedUser } from "@/lib/auth";
import {
  checkRateLimit,
  ensureDailyBudget,
  getClientIp,
  RATE_LIMITS,
  recordSpend,
} from "@/lib/rate-limit";
import { getSubscriberByEmail, isPremium } from "@/lib/subscription";
import { getPortfolio, listPortfolios } from "@/lib/portfolio/store";
import { generateDeepThesis } from "@/lib/lens/thesis";

// POST /api/portfolio/thesis
// Body: { portfolioId?: string }
//
// The Lens — DEEP mode. On-demand, Pro-gated, institutional-grade thesis on the
// user's portfolio (DeepSeek V4 Pro + reasoning, multi-source). Heavier than the
// daily brief, so it gets a real rate limit + budget gate and is never auto-run.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(req: Request) {
  const user = await getVerifiedUser();
  if (!user) {
    return json({ error: "Please sign in.", code: "auth_required" }, 401);
  }
  const email = user.email;

  let body: { portfolioId?: string } = {};
  try {
    body = await req.json();
  } catch {
    // empty body → fall back to most recent portfolio
  }

  const portfolio = body.portfolioId
    ? await getPortfolio(email, body.portfolioId)
    : ((await listPortfolios(email))[0] ?? null);

  if (!portfolio || !portfolio.holdings || portfolio.holdings.length === 0) {
    return json({ thesis: null, reason: "no_portfolio" }, 200);
  }

  // Pro gate — the deep thesis is a Pro feature.
  const subscriber = await getSubscriberByEmail(email);
  if (!isPremium(subscriber)) {
    return json({ thesis: null, code: "plan_limit", reason: "pro_only" }, 402);
  }

  // Heavier gates than the daily brief.
  const ip = getClientIp(req);
  const gate = checkRateLimit(ip, RATE_LIMITS.chatAnalyze);
  if (!gate.ok) {
    return json({ error: `Rate limit hit. Retry in ${gate.retryAfterSeconds}s.`, code: "rate_limited" }, 429);
  }
  try {
    ensureDailyBudget(0.15);
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err), code: "budget" }, 503);
  }

  try {
    const { thesis, costUSD } = await generateDeepThesis(portfolio);
    recordSpend(costUSD);
    return json({ thesis }, 200);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[portfolio/thesis] failed:", msg);
    return json(
      {
        error: msg.includes("could not price")
          ? "Couldn't fetch live prices for these holdings right now. Try again shortly."
          : "Couldn't build the deep thesis right now. Try again shortly.",
        code: "generate_failed",
      },
      502
    );
  }
}
