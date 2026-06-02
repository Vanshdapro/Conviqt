// POST /v1/analyze  — the public programmatic entry point to the Council.
//
// Deliverable 10: lets developers, quants, and institutional users run the
// full Council pipeline over HTTP. Auth is a bearer API key (not a session
// cookie); billing is a per-developer monthly CALL quota (not consumer
// credits). The response is the same CouncilResult JSON the web app renders,
// minus internal cost fields the caller doesn't need.
//
// Request:
//   POST /v1/analyze
//   Authorization: Bearer cvqt_live_…        (or  x-api-key: cvqt_live_…)
//   Content-Type: application/json
//   { "ticker": "NVDA", "focus": "datacenter demand" }   // focus optional
//
// Response 200: { runId, ticker, asOf, verdict, conviction, disagreement,
//                 bullCase, bearCase, investmentCase, bottomLine, catalysts,
//                 keyMetrics, specialists[], sources[], cached, usage{} }
//
// Errors: 400 bad ticker · 401 missing/invalid key · 402 quota exhausted ·
//         403 subscription suspended · 429 rate limit · 503 pipeline failure.
//
// Per CLAUDE.md: no synthetic fallback. If sweep can't find real data we 503.
// Reuses the same 4h Council cache as the web app, so an API call for a ticker
// a consumer just analyzed is free on our side and instant for the developer.

import { NextResponse } from "next/server";
import { runCouncil } from "@/lib/agents/orchestrator";
import { VALID_TICKER_RE } from "@/lib/agents/router";
import {
  checkRateLimit,
  ensureDailyBudget,
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
import {
  extractApiKey,
  consumeApiCall,
  logApiCall,
} from "@/lib/apiKeys";
import type { CouncilResult } from "@/lib/agents/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Public developer API → permissive CORS so it's callable from browser apps.
const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, x-api-key",
  "Access-Control-Max-Age": "86400",
};

function json(body: unknown, status: number, extra?: Record<string, string>) {
  return NextResponse.json(body as object, {
    status,
    headers: { ...CORS_HEADERS, ...extra },
  });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

// Strip internal-only fields and reshape the CouncilResult into a stable,
// documented public contract. We intentionally do NOT leak estCostUSD or raw
// per-agent durations — the developer pays per call, not per token.
function toPublicResult(
  r: CouncilResult,
  usage: { tier?: string; remaining?: number; quota?: number; reset_at?: string }
) {
  return {
    runId: r.runId,
    ticker: r.ticker,
    asOf: r.asOf,
    focus: r.focus ?? null,
    cached: r.cached ?? false,
    company: {
      name: r.factSheet.companyName,
      sector: r.factSheet.sector,
      assetType: r.factSheet.assetType,
    },
    verdict: r.judge.verdict,
    conviction: r.judge.conviction,
    disagreement: r.judge.disagreement,
    investmentCase: r.judge.investmentCase,
    bullCase: r.judge.bullCase,
    bearCase: r.judge.bearCase,
    bottomLine: r.judge.bottomLine,
    catalysts: r.judge.catalysts,
    keyMetrics: r.judge.keyMetrics,
    dissents: r.judge.dissents,
    specialists: r.agents.map((a) => ({
      agent: a.agent,
      verdict: a.verdict,
      confidence: a.confidence,
      reasoning: a.reasoning,
      flags: a.flags,
      sourceIndexes: a.sourceIndexes,
    })),
    sources: r.factSheet.sources.map((s, i) => ({
      index: i,
      url: s.url,
      title: s.title,
      publisher: s.publisher,
    })),
    warnings: r.warnings,
    usage,
  };
}

export async function POST(req: Request) {
  const t0 = Date.now();

  // 1. Authenticate.
  const key = extractApiKey(req);
  if (!key) {
    return json(
      {
        error: "missing_api_key",
        message:
          "Provide your key via 'Authorization: Bearer <key>' or the 'x-api-key' header. Generate one at https://www.conviqt.com/developers.",
      },
      401,
      { "WWW-Authenticate": "Bearer" }
    );
  }

  // 2. Parse + validate the body.
  let body: { ticker?: unknown; focus?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json", message: "Request body must be JSON." }, 400);
  }

  const rawTicker = typeof body.ticker === "string" ? body.ticker.trim().toUpperCase() : "";
  if (!rawTicker) {
    return json({ error: "missing_ticker", message: 'Body must include a "ticker" string, e.g. {"ticker":"NVDA"}.' }, 400);
  }
  if (!VALID_TICKER_RE.test(rawTicker)) {
    return json({ error: "invalid_ticker", message: `"${rawTicker}" is not a valid US-listed ticker symbol.` }, 400);
  }
  const focus =
    typeof body.focus === "string" && body.focus.trim()
      ? body.focus.trim().slice(0, 200)
      : undefined;

  // 3. Per-key rate limit (burst protection, separate from monthly quota).
  // Keyed on the raw key string so each developer gets their own bucket.
  const rl = checkRateLimit(`apikey:${key.slice(0, 24)}`, RATE_LIMITS.apiAnalyze);
  if (!rl.ok) {
    return json(
      { error: "rate_limited", message: `Too many requests. Retry in ${rl.retryAfterSeconds}s.` },
      429,
      { "Retry-After": String(rl.retryAfterSeconds) }
    );
  }

  // 4. Bill one call against the developer's monthly quota (atomic in the DB).
  const billed = await consumeApiCall(key);
  if (!billed.ok) {
    if (billed.reason === "invalid_key") {
      return json({ error: "invalid_api_key", message: "This API key is invalid or has been revoked." }, 401);
    }
    if (billed.reason === "account_suspended") {
      return json(
        { error: "account_suspended", message: "Your developer subscription is past due or canceled. Update billing to resume API access." },
        403
      );
    }
    // quota_exceeded
    await logApiCall({ keyId: billed.key_id ?? 0, email: billed.email ?? "unknown", ticker: rawTicker, status: "quota_exceeded" });
    return json(
      {
        error: "quota_exceeded",
        message: `Monthly API call quota (${billed.quota}) exhausted. Resets ${billed.reset_at}. Upgrade at https://www.conviqt.com/developers.`,
        usage: { tier: billed.tier, remaining: 0, quota: billed.quota, reset_at: billed.reset_at },
      },
      402
    );
  }

  const usage = {
    tier: billed.tier,
    remaining: billed.remaining,
    quota: billed.quota,
    reset_at: billed.reset_at,
  };

  // 5. Serve from the shared 4h Council cache when warm — costs us nothing.
  const cacheKey = councilCacheKey(rawTicker, focus);
  const cached = cacheGet<CouncilResult>(cacheKey);
  if (cached) {
    console.log(`[v1/analyze] cache hit ${rawTicker} for ${billed.email}`);
    await logApiCall({ keyId: billed.key_id!, email: billed.email!, ticker: rawTicker, status: "ok", latencyMs: Date.now() - t0 });
    return json(toPublicResult({ ...cached, cached: true }, usage), 200);
  }

  // 6. Wallet kill switch, then run the pipeline.
  try {
    ensureDailyBudget(0.07);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return json({ error: "budget_exceeded", message: msg }, 503);
  }

  try {
    console.log(`[v1/analyze] council ${rawTicker} for ${billed.email}${focus ? ` (focus: ${focus})` : ""}`);
    const result = await runCouncil(rawTicker, { focus });
    cacheSet(cacheKey, result, COUNCIL_CACHE_TTL_MS);
    recordSpend(result.estCostUSD);
    if (!focus) void persistStockReport(result);

    await logApiCall({
      keyId: billed.key_id!,
      email: billed.email!,
      ticker: rawTicker,
      status: "ok",
      costUSD: result.estCostUSD,
      latencyMs: Date.now() - t0,
    });

    console.log(
      `[v1/analyze] ${rawTicker} done in ${result.totalDurationMs}ms — ${result.judge.verdict}/${result.judge.conviction} cost=$${result.estCostUSD} remaining=${billed.remaining}`
    );
    return json(toPublicResult(result, usage), 200);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[v1/analyze] ${rawTicker} failed:`, msg);
    await logApiCall({ keyId: billed.key_id!, email: billed.email!, ticker: rawTicker, status: "error", latencyMs: Date.now() - t0 });
    // The call was billed but the pipeline failed. Refund-on-failure would be
    // ideal; for now we surface the failure clearly and rely on the daily
    // budget + cache to keep abuse-via-error cheap.
    return json({ error: "pipeline_failed", message: msg, ticker: rawTicker }, 503);
  }
}
