import {
  classifyIntent,
  RouterMessage,
} from "@/lib/agents/router";
import { runCouncil, runFocusedQuery, type CouncilEvent, type FocusedEvent } from "@/lib/agents/orchestrator";
import { runAnalyst } from "@/lib/agents/analyst";
import type { CouncilResult, FocusedResult } from "@/lib/agents/types";
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

// POST /api/chat
// Body: { messages: [{ role: "user" | "assistant", content: string }, ...] }
//
// Pipeline:
//   1. Router (Haiku) classifies the LAST user message into:
//      analyze | pick | general | reject
//   2. analyze  → runCouncil(ticker, { focus }) streamed as NDJSON events
//      pick     → runPicker() returned as a single event
//      general  → cheap Sonnet response in plain text, post-processed with
//                 stripLiveNumerics so we never ship a hallucinated price
//      reject   → 400 with reason
//
// Streaming wire format (newline-delimited JSON, one event per line):
//   { type: "intent", action, ticker?, focus?, costUSD }
//   { type: "council", event: CouncilEvent }   // multiple, in order
//   { type: "council_done", result, costUSD }
//   { type: "picks", result, costUSD }
//   { type: "text", text, costUSD }
//   { type: "error", error }
//   { type: "done" }                           // always last on success
//
// The chat client parses one JSON object per newline. Errors during a
// council run are emitted as the final event before { type: "done" }.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
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

export async function POST(req: Request) {
  let body: ChatBody;
  try {
    body = (await req.json()) as ChatBody;
  } catch {
    return jsonResponse({ type: "error", error: "Invalid JSON body." }, 400);
  }

  const raw = Array.isArray(body.messages) ? body.messages : [];
  // Normalize + filter to known roles. Trim to last 20 turns to cap router
  // context cost.
  const messages: RouterMessage[] = raw
    .filter(
      (m) =>
        m &&
        typeof m.content === "string" &&
        (m.role === "user" || m.role === "assistant")
    )
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }))
    .slice(-20);

  if (messages.length === 0 || messages[messages.length - 1].role !== "user") {
    return jsonResponse(
      {
        type: "error",
        error: "Expected a non-empty conversation ending in a user message.",
      },
      400
    );
  }

  const ip = getClientIp(req);

  // The router is cheap but still calls Haiku. Gate it on the general
  // bucket first so we never even pay for routing if the caller is
  // hammering us.
  const generalGate = checkRateLimit(ip, RATE_LIMITS.chatGeneral);
  if (!generalGate.ok) {
    return jsonResponse(
      {
        type: "error",
        error: `Rate limit hit. Retry in ${generalGate.retryAfterSeconds}s.`,
      },
      429
    );
  }

  // Daily wallet kill switch.
  try {
    ensureDailyBudget(0.005); // cheap router worst case
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonResponse({ type: "error", error: msg }, 503);
  }

  let routerResult;
  try {
    routerResult = await classifyIntent(messages);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[chat] router failed:", msg);
    return jsonResponse({ type: "error", error: msg }, 503);
  }

  const intent = routerResult.intent;
  const intentCostUSD = routerResult.costUSD;
  recordSpend(intentCostUSD);
  console.log(
    `[chat] intent=${intent.action} routerCost=$${intentCostUSD.toFixed(4)} in ${routerResult.durationMs}ms`
  );

  if (intent.action === "reject") {
    return jsonResponse(
      { type: "error", error: intent.reason || "Off-topic for Conviqt." },
      400
    );
  }

  // ── ANALYZE ──────────────────────────────────────────────────────────
  if (intent.action === "analyze") {
    const analyzeGate = checkRateLimit(ip, RATE_LIMITS.chatAnalyze);
    if (!analyzeGate.ok) {
      return jsonResponse(
        {
          type: "error",
          error: `Council rate limit hit (${RATE_LIMITS.chatAnalyze.capacity}/min). Retry in ${analyzeGate.retryAfterSeconds}s.`,
        },
        429
      );
    }
    try {
      ensureDailyBudget(0.07); // soft cap per CLAUDE.md
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return jsonResponse({ type: "error", error: msg }, 503);
    }

    const ticker = intent.ticker;
    const focus = intent.focus;
    const cacheKey = councilCacheKey(ticker, focus);
    const cached = cacheGet<CouncilResult>(cacheKey);

    return streamCouncil({
      ticker,
      focus,
      cached,
      cacheKey,
      intentCostUSD,
    });
  }

  // ── FOCUSED ──────────────────────────────────────────────────────────
  // Specific stock question — not a full BUY/HOLD/SELL thesis.
  // Lighter pipeline: sweep + focused judge. No 4-agent breakdown.
  if (intent.action === "focused") {
    const analyzeGate = checkRateLimit(ip, RATE_LIMITS.chatAnalyze);
    if (!analyzeGate.ok) {
      return jsonResponse(
        {
          type: "error",
          error: `Rate limit hit. Retry in ${analyzeGate.retryAfterSeconds}s.`,
        },
        429
      );
    }
    try {
      ensureDailyBudget(0.05);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return jsonResponse({ type: "error", error: msg }, 503);
    }

    const { ticker, question } = intent;
    const cacheKey = `focused:${ticker}:${question.slice(0, 60).toLowerCase().replace(/\W+/g, "_")}`;
    const cached = cacheGet<FocusedResult>(cacheKey);

    return streamFocused({ ticker, question, cached, cacheKey, intentCostUSD });
  }

  // ── PICK → redirect to Alpha Tracker ────────────────────────────────
  // The picker pipeline is not part of the chat feature. Stock selection
  // is handled by the Alpha Tracker (coming soon). Redirect users there.
  if (intent.action === "pick") {
    return jsonResponse(
      {
        type: "text",
        text: "Stock picks live in the **Alpha Tracker** — a dedicated feature built for exactly this, with a documented methodology, full track record, and every number sourced. It's coming soon.\n\nIn the meantime, ask me to analyze a specific ticker — e.g. \"analyze NVDA\" — and I'll run a full investment thesis with sourced data.",
        costUSD: intentCostUSD,
        intentCostUSD,
      },
      200
    );
  }

  // ── GENERAL — streaming institutional analyst (Sonnet + web_search) ──
  // Deep knowledge base covering equities, macro, options, fixed income,
  // international markets, commodities, crypto, and geopolitics. The model
  // autonomously searches for live data when needed and streams text deltas
  // so the UI renders progressively instead of waiting for the full response.
  try {
    ensureDailyBudget(0.10); // Sonnet + up to 3 web searches
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonResponse({ type: "error", error: msg }, 503);
  }

  return streamAnalyst({ messages, intentCostUSD });
}

interface StreamFocusedArgs {
  ticker: string;
  question: string;
  cached?: FocusedResult;
  cacheKey: string;
  intentCostUSD: number;
}

function streamFocused({
  ticker,
  question,
  cached,
  cacheKey,
  intentCostUSD,
}: StreamFocusedArgs): Response {
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const enc = new TextEncoder();
      const emit = (obj: unknown) =>
        controller.enqueue(enc.encode(JSON.stringify(obj) + "\n"));

      emit({ type: "intent", action: "focused", ticker, question, costUSD: intentCostUSD });

      if (cached) {
        console.log(`[chat] focused cache hit for ${ticker}`);
        emit({
          type: "focused_done",
          result: { ...cached, cached: true },
          costUSD: intentCostUSD,
          intentCostUSD,
        });
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
        emit({
          type: "focused_done",
          result,
          costUSD: result.estCostUSD + intentCostUSD,
          intentCostUSD,
        });
      } catch (focusedErr) {
        const focusedMsg = focusedErr instanceof Error ? focusedErr.message : String(focusedErr);
        console.error(`[chat] focused failed for ${ticker}; falling back to analyst:`, focusedMsg);
        // Fall back to the analyst so the user always gets a useful answer.
        try {
          const fallback = await runAnalyst([{ role: "user", content: question }]);
          recordSpend(fallback.costUSD);
          emit({
            type: "text",
            text: fallback.text,
            costUSD: fallback.costUSD + intentCostUSD,
            intentCostUSD,
          });
        } catch (analystErr) {
          const analystMsg = analystErr instanceof Error ? analystErr.message : String(analystErr);
          console.error(`[chat] analyst fallback also failed:`, analystMsg);
          emit({ type: "error", error: "Unable to answer this right now. Try asking me to 'analyze AMD' for a full breakdown." });
        }
      } finally {
        emit({ type: "done" });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}

interface StreamAnalystArgs {
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  intentCostUSD: number;
}

function streamAnalyst({ messages, intentCostUSD }: StreamAnalystArgs): Response {
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const enc = new TextEncoder();
      const emit = (obj: unknown) =>
        controller.enqueue(enc.encode(JSON.stringify(obj) + "\n"));

      emit({ type: "intent", action: "general", costUSD: intentCostUSD });

      try {
        const result = await runAnalyst(messages, {
          onDelta: (delta: string) => emit({ type: "text_chunk", delta }),
        });
        recordSpend(result.costUSD);
        emit({
          type: "text",
          text: result.text,
          costUSD: result.costUSD + intentCostUSD,
          intentCostUSD,
        });
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
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}

interface StreamCouncilArgs {
  ticker: string;
  focus?: string;
  cached?: CouncilResult;
  cacheKey: string;
  intentCostUSD: number;
}

// Streams an analyze run as NDJSON. Each event is one JSON object on its
// own line. The client reads until { type: "done" }.
function streamCouncil({
  ticker,
  focus,
  cached,
  cacheKey,
  intentCostUSD,
}: StreamCouncilArgs): Response {
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const enc = new TextEncoder();
      const emit = (obj: unknown) =>
        controller.enqueue(enc.encode(JSON.stringify(obj) + "\n"));

      emit({
        type: "intent",
        action: "analyze",
        ticker,
        focus,
        costUSD: intentCostUSD,
      });

      if (cached) {
        console.log(`[chat] council cache hit for ${ticker}`);
        const tagged: CouncilResult = { ...cached, cached: true };
        emit({
          type: "council_done",
          result: tagged,
          costUSD: intentCostUSD, // user only pays the router on a cache hit
          intentCostUSD,
        });
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
        emit({
          type: "council_done",
          result,
          costUSD: result.estCostUSD + intentCostUSD,
          intentCostUSD,
        });
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
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
