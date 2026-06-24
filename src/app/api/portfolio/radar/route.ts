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
import { getRadarStore } from "@/lib/radar/store";
import { generatePersonalRadar } from "@/lib/radar/generate";

// POST /api/portfolio/radar
// Body: { portfolioId?: string; refresh?: boolean }
//
// The Radar — the personalized "what's coming for your money" view that lives
// inside Portfolio, woven with the Lens. For each upcoming event touching the
// user's holdings: what's at stake, and what each outcome would mean. Honest
// orientation, never a prediction; no buy/sell.
//
// One CURRENT radar per user/portfolio, generated on demand and cached until the
// next refresh (cached reads cost nothing). It's a recurring value of Pro, so
// generation is Pro-gated; Free users get a 402 and the upsell teaser. Runs on
// DeepSeek V4 Flash via the adapter (MODELS.lens) — gathered events, no
// web_search, so it's a couple cents and well inside the on-demand cost ceiling.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(req: Request) {
  const user = await getVerifiedUser();
  if (!user) {
    return json({ error: "Please sign in to see your radar.", code: "auth_required" }, 401);
  }
  const email = user.email;

  let body: { portfolioId?: string; refresh?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    // Empty body is fine — fall back to the user's most recent portfolio.
  }

  // Resolve the portfolio: explicit id, else the most recently updated one.
  const portfolio = body.portfolioId
    ? await getPortfolio(email, body.portfolioId)
    : ((await listPortfolios(email))[0] ?? null);

  if (!portfolio) {
    return json({ radar: null, reason: "no_portfolio" }, 200);
  }
  if (!portfolio.holdings || portfolio.holdings.length === 0) {
    return json(
      {
        radar: null,
        reason: "empty_portfolio",
        portfolioId: portfolio.id,
        portfolioName: portfolio.name,
      },
      200
    );
  }

  // Pro gate — the personalized Radar is part of the subscription's recurring value.
  const subscriber = await getSubscriberByEmail(email);
  if (!isPremium(subscriber)) {
    return json({ radar: null, code: "plan_limit", reason: "pro_only" }, 402);
  }

  const store = getRadarStore();

  // Cached → return free (no model call).
  if (!body.refresh) {
    const existing = await store.get(email, portfolio.id);
    if (existing) {
      return json({ radar: existing, cached: true }, 200);
    }
  }

  // Generation gates (cheap, but still respect the kill switches).
  const ip = getClientIp(req);
  const gate = checkRateLimit(ip, RATE_LIMITS.chatAnalyze);
  if (!gate.ok) {
    return json({ error: `Rate limit hit. Retry in ${gate.retryAfterSeconds}s.`, code: "rate_limited" }, 429);
  }
  try {
    ensureDailyBudget(0.05);
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err), code: "budget" }, 503);
  }

  try {
    const { radar, costUSD } = await generatePersonalRadar({
      portfolioId: portfolio.id,
      portfolioName: portfolio.name,
      tickers: portfolio.holdings.map((h) => h.ticker),
    });
    recordSpend(costUSD);
    try {
      await store.save(email, portfolio.id, radar);
    } catch (saveErr) {
      // Non-fatal — the user still gets today's radar; it just isn't cached.
      console.error(
        "[portfolio/radar] save failed:",
        saveErr instanceof Error ? saveErr.message : saveErr
      );
    }
    return json({ radar, cached: false }, 200);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[portfolio/radar] failed:", msg);
    return json({ error: "Could not build your radar. Try again shortly.", code: "generate_failed" }, 502);
  }
}
