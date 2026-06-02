import {
  classifyIntent,
  RouterMessage,
} from "@/lib/agents/router";
import { runCouncil, runFocusedQuery, runCompare, runSector, type CouncilEvent, type FocusedEvent, type CompareEvent, type SectorEvent } from "@/lib/agents/orchestrator";
import { runAnalyst } from "@/lib/agents/analyst";
import { resolveSector, type SectorBasket } from "@/lib/agents/sectors";
import type { CouncilResult, FocusedResult, CompareResult, SectorResult } from "@/lib/agents/types";
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
  compareCacheKey,
  sectorCacheKey,
} from "@/lib/cache";
import { persistStockReport } from "@/lib/stockReports";
import {
  deductCredits,
  grantFreeCreditsIfDue,
  getCredits,
  CREDITS_PER_INTENT,
  type Intent,
} from "@/lib/credits";
import { getVerifiedUser } from "@/lib/auth";

// POST /api/chat
// Body: { messages: [...] }
//
// Auth + credit gating:
//   Requires a verified Supabase Auth session. The user's email is taken from
//   the session (never the request body), then credits are deducted from their
//   account before the pipeline runs. No anonymous access.
//
// Intents and their credit costs:
//   analyze  → 15 credits  (Full Council)
//   focused  →  8 credits  (Focused query)
//   general  → 18 credits  (Sonnet analyst)
//   compare  → 25 credits  (two Councils + comparative synthesis; warm sides reuse cache)
//   sector   → 40 credits  (5-8 abbreviated Council passes + thematic synthesis; warm names reuse cache)
//   cache    →  1 credit   (any cache hit)
//   pick     →  0 credits  (text redirect only)

export const runtime  = "nodejs";
export const dynamic  = "force-dynamic";
export const maxDuration = 60;

interface ChatBody {
  messages?: Array<{ role: string; content: string }>;
}

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// ── Credit helper ────────────────────────────────────────────────────────────

async function checkAndDeductCredits(
  email:  string,
  intent: Intent,
  isCacheHit: boolean,
): Promise<Response | null> {
  const effectiveIntent: Intent = isCacheHit ? "cache" : intent;
  const needed  = CREDITS_PER_INTENT[effectiveIntent];

  // Ensure free-tier row exists / refresh monthly allocation if due
  await grantFreeCreditsIfDue(email);

  if (needed === 0) return null; // pick redirect — no deduction

  const current = await getCredits(email);
  const balance = current?.credits ?? 0;

  if (balance < needed) {
    return jsonResponse(
      {
        type:     "error",
        error:    `Insufficient credits. You need ${needed} credits but have ${balance}. Top up at /pricing.`,
        code:     "insufficient_credits",
        credits:  balance,
        needed,
      },
      402
    );
  }

  const result = await deductCredits(email, needed, effectiveIntent, 0);
  if (!result.ok) {
    return jsonResponse(
      {
        type:    "error",
        error:   `Insufficient credits. You need ${needed} credits but have ${result.remaining}. Top up at /pricing.`,
        code:    "insufficient_credits",
        credits: result.remaining,
        needed,
      },
      402
    );
  }

  return null; // deduction succeeded — proceed
}

// ── Main handler ─────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  // Identity comes from the verified session only — never the request body.
  const user = await getVerifiedUser();
  if (!user) {
    return jsonResponse(
      { type: "error", error: "Please sign in to use Conviqt.", code: "auth_required" },
      401
    );
  }
  const email = user.email;

  let body: ChatBody;
  try {
    body = (await req.json()) as ChatBody;
  } catch {
    return jsonResponse({ type: "error", error: "Invalid JSON body." }, 400);
  }

  const raw = Array.isArray(body.messages) ? body.messages : [];

  // Normalise + trim to last 20 turns to cap router context cost
  const messages: RouterMessage[] = raw
    .filter(
      (m) => m && typeof m.content === "string" &&
        (m.role === "user" || m.role === "assistant")
    )
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }))
    .slice(-20);

  if (messages.length === 0 || messages[messages.length - 1].role !== "user") {
    return jsonResponse(
      { type: "error", error: "Expected a non-empty conversation ending in a user message." },
      400
    );
  }

  const ip = getClientIp(req);

  // General DDoS gate — applies to all requests (even paid users)
  const generalGate = checkRateLimit(ip, RATE_LIMITS.chatGeneral);
  if (!generalGate.ok) {
    return jsonResponse(
      { type: "error", error: `Rate limit hit. Retry in ${generalGate.retryAfterSeconds}s.` },
      429
    );
  }

  // Daily API budget kill-switch
  try {
    ensureDailyBudget(0.005);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonResponse({ type: "error", error: msg }, 503);
  }

  // ── Intent classification ────────────────────────────────────────────────
  let routerResult;
  try {
    routerResult = await classifyIntent(messages);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[chat] router failed:", msg);
    return jsonResponse({ type: "error", error: msg }, 503);
  }

  const intent        = routerResult.intent;
  const intentCostUSD = routerResult.costUSD;
  recordSpend(intentCostUSD);
  console.log(
    `[chat] intent=${intent.action} routerCost=$${intentCostUSD.toFixed(4)} email=${email ?? "anon"}`
  );

  if (intent.action === "reject") {
    return jsonResponse({ type: "error", error: intent.reason || "Off-topic for Conviqt." }, 400);
  }

  // ── ANALYZE ─────────────────────────────────────────────────────────────
  if (intent.action === "analyze") {
    const ticker   = intent.ticker;
    const focus    = intent.focus;
    const cacheKey = councilCacheKey(ticker, focus);
    const cached   = cacheGet<CouncilResult>(cacheKey);
    const isCached = !!cached;

    {
      const blocked = await checkAndDeductCredits(email, "analyze", isCached);
      if (blocked) return blocked;
    }

    try {
      ensureDailyBudget(0.07);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return jsonResponse({ type: "error", error: msg }, 503);
    }

    return streamCouncil({ ticker, focus, cached, cacheKey, intentCostUSD });
  }

  // ── FOCUSED ─────────────────────────────────────────────────────────────
  if (intent.action === "focused") {
    const { ticker, question } = intent;
    const cacheKey = `focused:${ticker}:${question.slice(0, 60).toLowerCase().replace(/\W+/g, "_")}`;
    const cached   = cacheGet<FocusedResult>(cacheKey);
    const isCached = !!cached;

    {
      const blocked = await checkAndDeductCredits(email, "focused", isCached);
      if (blocked) return blocked;
    }

    try {
      ensureDailyBudget(0.05);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return jsonResponse({ type: "error", error: msg }, 503);
    }

    return streamFocused({ ticker, question, cached, cacheKey, intentCostUSD });
  }

  // ── COMPARE — head-to-head between two tickers ──────────────────────────
  if (intent.action === "compare") {
    const { tickerA, tickerB } = intent;
    const cacheKey = compareCacheKey(tickerA, tickerB);
    const cached   = cacheGet<CompareResult>(cacheKey);
    const isCached = !!cached;

    {
      const blocked = await checkAndDeductCredits(email, "compare", isCached);
      if (blocked) return blocked;
    }

    try {
      // Worst case: two cold councils (~0.07 each) + comparative synthesis.
      ensureDailyBudget(0.16);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return jsonResponse({ type: "error", error: msg }, 503);
    }

    return streamCompare({ tickerA, tickerB, cached, cacheKey, intentCostUSD });
  }

  // ── SECTOR — thematic snapshot across a curated basket ──────────────────
  if (intent.action === "sector") {
    const basket = resolveSector(intent.sectorKey);
    if (!basket) {
      return jsonResponse({ type: "error", error: "Unknown sector." }, 400);
    }
    const cacheKey = sectorCacheKey(basket.key);
    const cached   = cacheGet<SectorResult>(cacheKey);
    const isCached = !!cached;

    {
      const blocked = await checkAndDeductCredits(email, "sector_analyze", isCached);
      if (blocked) return blocked;
    }

    try {
      // Worst case: every name cold (~6 × ~2.5¢ sweep+scorecard) + Sonnet synthesis.
      ensureDailyBudget(0.22);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return jsonResponse({ type: "error", error: msg }, 503);
    }

    return streamSector({ basket, cached, cacheKey, intentCostUSD });
  }

  // ── PICK — redirect to Alpha Tracker ────────────────────────────────────
  if (intent.action === "pick") {
    return jsonResponse(
      {
        type:    "text",
        text:    "Stock picks live in the **[Alpha Tracker](/alpha)** — a dedicated feature built for exactly this, with a documented methodology, a full public track record, and every number sourced.\n\nOr ask me to analyze a specific ticker right here — e.g. \"analyze NVDA\" — and I'll run a full investment thesis with sourced data.",
        costUSD: intentCostUSD,
        intentCostUSD,
      },
      200
    );
  }

  // ── GENERAL — Sonnet analyst ─────────────────────────────────────────────
  {
    const blocked = await checkAndDeductCredits(email, "general", false);
    if (blocked) return blocked;
  }

  try {
    ensureDailyBudget(0.10); // Sonnet + up to 3 web searches
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonResponse({ type: "error", error: msg }, 503);
  }

  return streamAnalyst({ messages, intentCostUSD });
}

// ── Stream helpers ───────────────────────────────────────────────────────────

interface StreamFocusedArgs {
  ticker:     string;
  question:   string;
  cached?:    FocusedResult;
  cacheKey:   string;
  intentCostUSD: number;
}

function streamFocused({ ticker, question, cached, cacheKey, intentCostUSD }: StreamFocusedArgs): Response {
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const enc  = new TextEncoder();
      const emit = (obj: unknown) => controller.enqueue(enc.encode(JSON.stringify(obj) + "\n"));

      emit({ type: "intent", action: "focused", ticker, question, costUSD: intentCostUSD });

      if (cached) {
        emit({ type: "focused_done", result: { ...cached, cached: true }, costUSD: intentCostUSD, intentCostUSD });
        emit({ type: "done" });
        controller.close();
        return;
      }

      try {
        const result = await runFocusedQuery(ticker, question, {
          onEvent: (event: FocusedEvent) => emit({ type: "focused", event }),
        });
        cacheSet(cacheKey, result, COUNCIL_CACHE_TTL_MS);
        recordSpend(result.estCostUSD);
        emit({ type: "focused_done", result, costUSD: result.estCostUSD + intentCostUSD, intentCostUSD });
      } catch (focusedErr) {
        const focusedMsg = focusedErr instanceof Error ? focusedErr.message : String(focusedErr);
        console.error(`[chat] focused failed for ${ticker}; falling back to analyst:`, focusedMsg);
        try {
          const fallback = await runAnalyst([{ role: "user", content: question }]);
          recordSpend(fallback.costUSD);
          emit({ type: "text", text: fallback.text, costUSD: fallback.costUSD + intentCostUSD, intentCostUSD });
        } catch (analystErr) {
          const analystMsg = analystErr instanceof Error ? analystErr.message : String(analystErr);
          console.error("[chat] analyst fallback also failed:", analystMsg);
          emit({ type: "error", error: "Unable to answer this right now. Try asking me to 'analyze AAPL' instead." });
        }
      } finally {
        emit({ type: "done" });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store, no-transform", "X-Accel-Buffering": "no" },
  });
}

interface StreamAnalystArgs {
  messages:     Array<{ role: "user" | "assistant"; content: string }>;
  intentCostUSD: number;
}

function streamAnalyst({ messages, intentCostUSD }: StreamAnalystArgs): Response {
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const enc  = new TextEncoder();
      const emit = (obj: unknown) => controller.enqueue(enc.encode(JSON.stringify(obj) + "\n"));

      emit({ type: "intent", action: "general", costUSD: intentCostUSD });

      try {
        const result = await runAnalyst(messages, {
          onDelta: (delta: string) => emit({ type: "text_chunk", delta }),
        });
        recordSpend(result.costUSD);
        emit({ type: "text", text: result.text, costUSD: result.costUSD + intentCostUSD, intentCostUSD });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[chat] analyst failed:", msg);
        emit({ type: "error", error: msg });
      } finally {
        emit({ type: "done" });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store, no-transform", "X-Accel-Buffering": "no" },
  });
}

interface StreamCouncilArgs {
  ticker:   string;
  focus?:   string;
  cached?:  CouncilResult;
  cacheKey: string;
  intentCostUSD: number;
}

function streamCouncil({ ticker, focus, cached, cacheKey, intentCostUSD }: StreamCouncilArgs): Response {
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const enc  = new TextEncoder();
      const emit = (obj: unknown) => controller.enqueue(enc.encode(JSON.stringify(obj) + "\n"));

      emit({ type: "intent", action: "analyze", ticker, focus, costUSD: intentCostUSD });

      if (cached) {
        emit({ type: "council_done", result: { ...cached, cached: true }, costUSD: intentCostUSD, intentCostUSD });
        emit({ type: "done" });
        controller.close();
        return;
      }

      try {
        const result = await runCouncil(ticker, {
          focus,
          onEvent: (event: CouncilEvent) => emit({ type: "council", event }),
        });
        cacheSet(cacheKey, result, COUNCIL_CACHE_TTL_MS);
        recordSpend(result.estCostUSD);
        // Publish canonical (unfocused) runs to the public /stock/[ticker] page.
        if (!focus) void persistStockReport(result);
        emit({ type: "council_done", result, costUSD: result.estCostUSD + intentCostUSD, intentCostUSD });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[chat] council failed for ${ticker}:`, msg);
        emit({ type: "error", error: msg });
      } finally {
        emit({ type: "done" });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store, no-transform", "X-Accel-Buffering": "no" },
  });
}

interface StreamSectorArgs {
  basket:   SectorBasket;
  cached?:  SectorResult;
  cacheKey: string;
  intentCostUSD: number;
}

function streamSector({ basket, cached, cacheKey, intentCostUSD }: StreamSectorArgs): Response {
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const enc  = new TextEncoder();
      const emit = (obj: unknown) => controller.enqueue(enc.encode(JSON.stringify(obj) + "\n"));

      emit({
        type: "intent",
        action: "sector",
        sectorKey: basket.key,
        sectorLabel: basket.label,
        tickers: basket.constituents.map((c) => c.ticker),
        costUSD: intentCostUSD,
      });

      if (cached) {
        emit({ type: "sector_done", result: { ...cached, cached: true }, costUSD: intentCostUSD, intentCostUSD });
        emit({ type: "done" });
        controller.close();
        return;
      }

      try {
        const result = await runSector(basket, {
          onEvent: (event: SectorEvent) => emit({ type: "sector", event }),
        });
        cacheSet(cacheKey, result, COUNCIL_CACHE_TTL_MS);
        recordSpend(result.estCostUSD);
        emit({ type: "sector_done", result, costUSD: result.estCostUSD + intentCostUSD, intentCostUSD });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[chat] sector failed for ${basket.key}:`, msg);
        emit({ type: "error", error: msg });
      } finally {
        emit({ type: "done" });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store, no-transform", "X-Accel-Buffering": "no" },
  });
}

interface StreamCompareArgs {
  tickerA:  string;
  tickerB:  string;
  cached?:  CompareResult;
  cacheKey: string;
  intentCostUSD: number;
}

function streamCompare({ tickerA, tickerB, cached, cacheKey, intentCostUSD }: StreamCompareArgs): Response {
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const enc  = new TextEncoder();
      const emit = (obj: unknown) => controller.enqueue(enc.encode(JSON.stringify(obj) + "\n"));

      emit({ type: "intent", action: "compare", tickerA, tickerB, costUSD: intentCostUSD });

      if (cached) {
        emit({ type: "compare_done", result: { ...cached, cached: true }, costUSD: intentCostUSD, intentCostUSD });
        emit({ type: "done" });
        controller.close();
        return;
      }

      try {
        const result = await runCompare(tickerA, tickerB, {
          onEvent: (event: CompareEvent) => emit({ type: "compare", event }),
        });
        const { freshSides, ...compareResult } = result;
        cacheSet(cacheKey, compareResult, COUNCIL_CACHE_TTL_MS);
        recordSpend(compareResult.estCostUSD);
        // Publish each freshly-run side to its public /stock/[ticker] page —
        // a compare warms the same per-ticker reports a direct analyze would.
        if (freshSides.includes("a")) void persistStockReport(compareResult.a);
        if (freshSides.includes("b")) void persistStockReport(compareResult.b);
        emit({ type: "compare_done", result: compareResult, costUSD: compareResult.estCostUSD + intentCostUSD, intentCostUSD });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[chat] compare failed for ${tickerA} vs ${tickerB}:`, msg);
        emit({ type: "error", error: msg });
      } finally {
        emit({ type: "done" });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store, no-transform", "X-Accel-Buffering": "no" },
  });
}
