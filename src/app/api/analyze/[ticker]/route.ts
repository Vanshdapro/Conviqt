import { NextResponse } from "next/server";
import { runCouncil } from "@/lib/agents/orchestrator";
import { VALID_TICKER_RE } from "@/lib/agents/router";
import {
  checkRateLimit,
  ensureDailyBudget,
  getClientIp,
  RATE_LIMITS,
  recordSpend,
} from "@/lib/rate-limit";
import {
  cacheGet,
  cacheSet,
  COUNCIL_CACHE_TTL_MS,
  councilCacheKey,
} from "@/lib/cache";
import { persistStockReport } from "@/lib/stockReports";
import { getVerifiedUser } from "@/lib/auth";
import { getSubscriberByEmail, isPremium } from "@/lib/subscription";
import {
  useDeepAnalysis,
  refundDeepAnalysis,
  FREE_DEEP_LIMIT,
  FREE_LIMIT_MSG,
  FREE_METER_DEGRADED_MSG,
} from "@/lib/profile";
import type { CouncilResult } from "@/lib/agents/types";

// GET /api/analyze/:ticker?focus=...
// Runs the Council on a US-listed equity using Claude web_search as the
// sole data source. Returns the full CouncilResult including FactSheet,
// per-agent outputs, judge verdict, and source list for the UI to render
// citations.
//
// Per CLAUDE.md: no demo path, no synthetic fallback. If sweep can't find
// real data, we 503.
//
// Protected by per-IP rate limit + daily budget kill switch + 15-min
// per-ticker cache. Same cache key as the chat route so an analyze that
// just happened in chat returns instantly here.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Council runs can take 30-60s end to end on a cold ticker (5 web searches
// inside sweep). Vercel hobby cap is 60s on the node runtime; max it out.
export const maxDuration = 60;

interface RouteContext {
  params: Promise<{ ticker: string }>;
}

export async function GET(req: Request, ctx: RouteContext) {
  // SECURITY: this runs the full paid Council. Without auth + metering it was an
  // open budget-drain (and a way to bypass the Free meter that /api/chat
  // enforces for the same pipeline). Identity comes from the verified session
  // only — never the request.
  const user = await getVerifiedUser();
  if (!user) {
    return NextResponse.json({ error: "Please sign in to use Conviqt." }, { status: 401 });
  }
  const email = user.email;

  const { ticker } = await ctx.params;

  if (!ticker || typeof ticker !== "string") {
    return NextResponse.json(
      { error: "Missing ticker param." },
      { status: 400 }
    );
  }

  const cleaned = ticker.trim().toUpperCase();
  if (!VALID_TICKER_RE.test(cleaned)) {
    return NextResponse.json(
      { error: `Invalid ticker: ${ticker}` },
      { status: 400 }
    );
  }

  const url = new URL(req.url);
  const rawFocus = url.searchParams.get("focus");
  const focus = rawFocus ? rawFocus.trim().slice(0, 200) : undefined;

  const ip = getClientIp(req);
  const gate = checkRateLimit(ip, RATE_LIMITS.apiAnalyze);
  if (!gate.ok) {
    return NextResponse.json(
      {
        error: `Rate limit hit (${RATE_LIMITS.apiAnalyze.capacity}/min). Retry in ${gate.retryAfterSeconds}s.`,
      },
      {
        status: 429,
        headers: { "Retry-After": String(gate.retryAfterSeconds) },
      }
    );
  }

  // Cache hit short-circuits before we charge the wallet check or a Free slot.
  const cacheKey = councilCacheKey(cleaned, focus);
  const cached = cacheGet<CouncilResult>(cacheKey);
  if (cached) {
    console.log(`[analyze] cache hit ${cleaned}`);
    return NextResponse.json({ ...cached, cached: true });
  }

  // Free users spend one of their monthly deep slots on a fresh run; Pro is
  // unlimited. Same gate as /api/chat so this endpoint can't bypass metering.
  let consumedSlot = false;
  const subscriber = await getSubscriberByEmail(email);
  if (!isPremium(subscriber)) {
    const meter = await useDeepAnalysis(email, FREE_DEEP_LIMIT);
    if (!meter.allowed) {
      if (meter.degraded) {
        return NextResponse.json(
          { error: FREE_METER_DEGRADED_MSG, code: "meter_unavailable" },
          { status: 503 }
        );
      }
      return NextResponse.json({ error: FREE_LIMIT_MSG, code: "plan_limit" }, { status: 402 });
    }
    consumedSlot = true;
  }

  try {
    ensureDailyBudget(0.07);
  } catch (err) {
    if (consumedSlot) await refundDeepAnalysis(email);
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 503 });
  }

  try {
    console.log(`[analyze] starting council for ${cleaned}${focus ? ` (focus: ${focus})` : ""}`);
    const result = await runCouncil(cleaned, { focus });
    cacheSet(cacheKey, result, COUNCIL_CACHE_TTL_MS);
    recordSpend(result.estCostUSD);
    // Publish canonical (unfocused) runs to the public /stock/[ticker] page.
    // Non-blocking — a persistence failure must not break the user response.
    if (!focus) {
      void persistStockReport(result);
    }
    console.log(
      `[analyze] ${cleaned} done in ${result.totalDurationMs}ms — judge=${result.judge.verdict} conviction=${result.judge.conviction} cost=$${result.estCostUSD}`
    );
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const warnings =
      err instanceof Error
        ? (err as Error & { warnings?: string[] }).warnings ?? []
        : [];
    console.error(`[analyze] ${cleaned} failed:`, msg);
    if (warnings.length) {
      console.error(`[analyze] ${cleaned} warnings:`, warnings);
    }
    // Failed run → give the Free slot back.
    if (consumedSlot) await refundDeepAnalysis(email);
    return NextResponse.json(
      { error: msg, ticker: cleaned, warnings },
      { status: 503 }
    );
  }
}
