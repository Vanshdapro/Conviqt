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
import { getLensStore } from "@/lib/lens/store";
import { generateLensBrief } from "@/lib/lens/generate";
import { briefDateUTC } from "@/lib/lens/types";

// POST /api/portfolio/brief
// Body: { portfolioId?: string; refresh?: boolean }
//
// The Lens — the daily personalized brief that lives inside Portfolio.
// "What happened to your money today, why, what it means, what to watch."
//
// One brief per user/portfolio/UTC-day, generated on first open and cached for
// the day (cached reads cost nothing). It's the recurring value of Pro, so
// generation is Pro-gated; Free users get a 402 and the upsell teaser. Runs on
// DeepSeek V4 Flash via the adapter (MODELS.lens) — fed data, no web_search, so
// it's ≈0.1¢ and well inside the on-demand cost ceiling.

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
    return json({ error: "Please sign in to see your brief.", code: "auth_required" }, 401);
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
    return json({ brief: null, thread: [], reason: "no_portfolio" }, 200);
  }
  if (!portfolio.holdings || portfolio.holdings.length === 0) {
    return json(
      {
        brief: null,
        thread: [],
        reason: "empty_portfolio",
        portfolioId: portfolio.id,
        portfolioName: portfolio.name,
      },
      200
    );
  }

  // Pro gate — the daily Lens is the subscription's recurring value.
  const subscriber = await getSubscriberByEmail(email);
  if (!isPremium(subscriber)) {
    return json({ brief: null, code: "plan_limit", reason: "pro_only" }, 402);
  }

  const store = getLensStore();
  const date = briefDateUTC();

  // Cached → return free (no model call). The thread powers continuity.
  if (!body.refresh) {
    const existing = await store.get(email, portfolio.id, date);
    if (existing) {
      const thread = await store.list(email, portfolio.id, 14);
      return json({ brief: existing, thread, cached: true }, 200);
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
    const priorBrief = await store.getLatest(email, portfolio.id);
    const { brief, costUSD } = await generateLensBrief(portfolio, { priorBrief });
    recordSpend(costUSD);
    try {
      await store.save(email, portfolio.id, brief);
    } catch (saveErr) {
      // Non-fatal — the user still gets today's brief; it just isn't cached.
      console.error(
        "[portfolio/brief] save failed:",
        saveErr instanceof Error ? saveErr.message : saveErr
      );
    }
    const thread = await store.list(email, portfolio.id, 14);
    return json({ brief, thread, cached: false }, 200);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[portfolio/brief] failed:", msg);
    return json({ error: "Could not build today's brief. Try again shortly.", code: "generate_failed" }, 502);
  }
}
