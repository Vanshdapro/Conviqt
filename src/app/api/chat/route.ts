import {
  classifyIntent,
  RouterMessage,
  RouterIntent,
  VALID_TICKER_RE,
} from "@/lib/agents/router";
import { runCouncil, runFocusedQuery, runCompare, runSector, type CouncilEvent, type FocusedEvent, type CompareEvent, type SectorEvent } from "@/lib/agents/orchestrator";
import { runAnalyst } from "@/lib/agents/analyst";
import { runHeadlineDecoder, type HeadlineEvent, type HeadlineResult } from "@/lib/agents/headline";
import { resolveSector, type SectorBasket } from "@/lib/agents/sectors";
import type { CouncilResult, FocusedResult, CompareResult, SectorResult } from "@/lib/agents/types";
import { quote as mdQuote, type Quote } from "@/lib/marketdata";
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
import { persistCompareReport } from "@/lib/compareReports";
import {
  deductCredits,
  grantFreeCreditsIfDue,
  CREDITS_PER_INTENT,
  type Intent,
} from "@/lib/credits";
import { getVerifiedUser } from "@/lib/auth";
import { getSubscriberByEmail, isPremium } from "@/lib/subscription";
import { getExperienceLevel, useDeepAnalysis, FREE_DEEP_LIMIT, FREE_LIMIT_MSG, FREE_METER_DEGRADED_MSG } from "@/lib/profile";
import { audienceCacheSuffix, type ExperienceLevel } from "@/lib/agents/audience";

// POST /api/chat
// Body: { messages: [...] }
//
// Auth + credit gating:
//   Requires a verified Supabase Auth session. The user's email is taken from
//   the session (never the request body), then credits are deducted from their
//   account before the pipeline runs. No anonymous access.
//
// Intents and their internal metering costs (NEVER rendered to users —
// subscription brand; "credits" is backstage vocabulary only):
//   analyze  → 30 credits  (Full Council)
//   focused  → 16 credits  (Focused query; also meters Headline Decoder)
//   general  → 36 credits  (Sonnet analyst)
//   compare  → 50 credits  (two Councils + comparative synthesis; warm sides reuse cache)
//   sector   → 80 credits  (5-8 abbreviated Council passes + thematic synthesis; warm names reuse cache)
//   cache    →  2 credits  (any cache hit)
//   pick     →  0 credits  (text redirect only)
//
// Research-surface skill runs (playbook 2.3) send { skill, params } and skip
// the intent router entirely — the mapping below is deterministic and free.
// Free-text asks still go through the router; the Council/Flash mode toggle
// biases the analyze↔focused choice.

export const runtime  = "nodejs";
export const dynamic  = "force-dynamic";
// Compare/sector worst case runs two cold Councils back-to-back; 60s clipped
// real runs. Matches the allocator/audit routes.
export const maxDuration = 120;

type ResearchMode = "council" | "flash";

interface ChatBody {
  messages?: Array<{ role: string; content: string }>;
  /** Research-surface skill id (playbook 2.3) — bypasses the intent router. */
  skill?: string;
  /** Council (deep) / Flash (fast) toggle for free-text asks. */
  mode?: string;
  /** Structured params for skill runs. */
  params?: {
    ticker?: string;
    tickerA?: string;
    tickerB?: string;
    sectorKey?: string;
    headline?: string;
  };
}

// ── Skill → pipeline mapping (playbook 2.3 "What it runs") ──────────────────
// Focus strings are fixed per skill so the 4h Council cache keys stay stable.

const SKILL_FOCUS = {
  entryExit:
    "entry and exit zones: support and resistance levels, trend and momentum — describe the price zones the analysts watch for entries and exits, framed as analysis of levels, never as instructions to the reader",
  crowdCheck:
    "crowd check: what investors are feeling versus what the data says — sentiment, positioning, hype versus fundamentals",
  bullBear:
    "scenario map: the best case, the worst case, and the base case for this stock, with what would trigger each scenario",
} as const;

function intentFromSkill(
  skill: string,
  params: NonNullable<ChatBody["params"]>
): RouterIntent | { action: "headline"; headline: string } | { error: string } {
  const ticker = (params.ticker ?? "").trim().toUpperCase();
  switch (skill) {
    case "worth-owning":
      if (!VALID_TICKER_RE.test(ticker)) return { error: "That doesn't look like a US-listed ticker." };
      return { action: "analyze", ticker };
    case "quick-take":
      if (!VALID_TICKER_RE.test(ticker)) return { error: "That doesn't look like a US-listed ticker." };
      return {
        action: "focused",
        ticker,
        question: `The 30-second read on ${ticker}: what's the setup right now and what actually matters?`,
      };
    case "entry-exit-zones":
      if (!VALID_TICKER_RE.test(ticker)) return { error: "That doesn't look like a US-listed ticker." };
      return { action: "analyze", ticker, focus: SKILL_FOCUS.entryExit };
    case "crowd-check":
      if (!VALID_TICKER_RE.test(ticker)) return { error: "That doesn't look like a US-listed ticker." };
      return { action: "analyze", ticker, focus: SKILL_FOCUS.crowdCheck };
    case "bull-bear-map":
      if (!VALID_TICKER_RE.test(ticker)) return { error: "That doesn't look like a US-listed ticker." };
      return { action: "analyze", ticker, focus: SKILL_FOCUS.bullBear };
    case "face-off": {
      const a = (params.tickerA ?? "").trim().toUpperCase();
      const b = (params.tickerB ?? "").trim().toUpperCase();
      if (!VALID_TICKER_RE.test(a) || !VALID_TICKER_RE.test(b))
        return { error: "A Face-Off needs two US-listed tickers." };
      if (a === b) return { action: "analyze", ticker: a };
      return { action: "compare", tickerA: a, tickerB: b };
    }
    case "sector-pulse": {
      const key = (params.sectorKey ?? "").trim();
      if (!key) return { error: "Pick an industry to take the pulse of." };
      return { action: "sector", sectorKey: key };
    }
    case "headline-decoder": {
      const headline = (params.headline ?? "").trim();
      if (headline.length < 12) return { error: "Paste the full headline so there's enough to decode." };
      return { action: "headline", headline };
    }
    default:
      return { error: "Unknown skill." };
  }
}

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// ── Plan gate + internal metering (Phase 7) ──────────────────────────────────
//
// The user-facing rule is plan-based: Free includes FREE_DEEP_LIMIT fresh deep
// analyses per month; Pro (active or trialing) is unlimited fair-use. Cache
// hits are near-free replays and never count. Credits keep metering every run
// INTERNALLY for cost observability, but they no longer block anyone.

// The runs that consume a Free slot: every pipeline that takes 30+ seconds of
// fresh multi-source research. Quick takes (focused/headline) stay outside the
// meter — "Flash basics" are part of the Free promise (playbook 2.4) and are
// bounded by the per-IP rate limits + the daily budget kill-switch.
const DEEP_INTENTS = new Set<Intent>(["analyze", "compare", "sector_analyze", "general"]);

// (FREE_LIMIT_MSG lives in profile.ts — route files may only export handlers.)

async function gateAndMeter(
  email:  string,
  intent: Intent,
  isCacheHit: boolean,
): Promise<Response | null> {
  const effectiveIntent: Intent = isCacheHit ? "cache" : intent;
  const needed  = CREDITS_PER_INTENT[effectiveIntent];

  // Keep the internal ledger row provisioned (harmless, observability only).
  await grantFreeCreditsIfDue(email);

  if (needed === 0) return null; // pick redirect — nothing to gate or meter

  if (!isCacheHit && DEEP_INTENTS.has(effectiveIntent)) {
    const subscriber = await getSubscriberByEmail(email);
    if (!isPremium(subscriber)) {
      const gate = await useDeepAnalysis(email, FREE_DEEP_LIMIT);
      if (!gate.allowed) {
        if (gate.degraded) {
          console.error(`[chat] usage meter degraded for ${email} — failing closed`);
          return jsonResponse(
            { type: "error", error: FREE_METER_DEGRADED_MSG, code: "meter_unavailable" },
            503
          );
        }
        console.log(`[chat] free deep limit hit for ${email} (${gate.used}/${FREE_DEEP_LIMIT})`);
        return jsonResponse(
          { type: "error", error: FREE_LIMIT_MSG, code: "plan_limit" },
          402
        );
      }
      console.log(`[chat] free deep analysis ${gate.used}/${FREE_DEEP_LIMIT} for ${email}`);
    }
  }

  // Internal metering — log-only, never a wall.
  const result = await deductCredits(email, needed, effectiveIntent, 0);
  if (!result.ok) {
    console.log(`[chat] internal meter dry for ${email} (${effectiveIntent}) — continuing, plan-gated`);
  }

  return null;
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

  // The one prompt switch (Phase 7): stored experience level → answer language
  // complexity in every pipeline. null = default (maximum plain English).
  const audience: ExperienceLevel | null = await getExperienceLevel(email);

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

  // ── Resolve intent: deterministic skill dispatch, or the router ──────────
  const skillId = typeof body.skill === "string" ? body.skill.trim() : "";
  const mode: ResearchMode = body.mode === "flash" ? "flash" : "council";

  let intent: RouterIntent | { action: "headline"; headline: string };
  let intentCostUSD = 0;

  if (skillId) {
    const mapped = intentFromSkill(skillId, body.params ?? {});
    if ("error" in mapped) {
      return jsonResponse({ type: "error", error: mapped.error }, 400);
    }
    intent = mapped;
    console.log(`[chat] skill=${skillId} → ${intent.action} email=${email}`);
  } else {
    let routerResult;
    try {
      routerResult = await classifyIntent(messages);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[chat] router failed:", msg);
      return jsonResponse({ type: "error", error: msg }, 503);
    }

    intent = routerResult.intent;
    intentCostUSD = routerResult.costUSD;
    recordSpend(intentCostUSD);

    // Mode bias (Research surface toggle): Flash answers a "full thesis" ask
    // with the lighter focused pipeline; Council upgrades a focused question
    // to the full multi-analyst run. Compare/sector/general are mode-agnostic.
    const lastUser = messages[messages.length - 1].content;
    if (mode === "flash" && intent.action === "analyze") {
      intent = {
        action: "focused",
        ticker: intent.ticker,
        question: lastUser.trim().slice(0, 300) || `What's the current setup for ${intent.ticker}?`,
      };
    } else if (mode === "council" && intent.action === "focused") {
      intent = { action: "analyze", ticker: intent.ticker, focus: intent.question.slice(0, 200) };
    }

    console.log(
      `[chat] intent=${intent.action} mode=${mode} routerCost=$${intentCostUSD.toFixed(4)} email=${email ?? "anon"}`
    );
  }

  if (intent.action === "reject") {
    return jsonResponse({ type: "error", error: intent.reason || "Off-topic for Conviqt." }, 400);
  }

  // ── ANALYZE ─────────────────────────────────────────────────────────────
  if (intent.action === "analyze") {
    const ticker   = intent.ticker;
    const focus    = intent.focus;
    const cacheKey = councilCacheKey(ticker, focus, audience);
    const cached   = cacheGet<CouncilResult>(cacheKey);
    const isCached = !!cached;

    {
      const blocked = await gateAndMeter(email, "analyze", isCached);
      if (blocked) return blocked;
    }

    try {
      ensureDailyBudget(0.07);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return jsonResponse({ type: "error", error: msg }, 503);
    }

    return streamCouncil({ ticker, focus, cached, cacheKey, intentCostUSD, audience });
  }

  // ── FOCUSED ─────────────────────────────────────────────────────────────
  if (intent.action === "focused") {
    const { ticker, question } = intent;
    const cacheKey = `focused:${ticker}:${question.slice(0, 60).toLowerCase().replace(/\W+/g, "_")}${audienceCacheSuffix(audience)}`;
    const cached   = cacheGet<FocusedResult>(cacheKey);
    const isCached = !!cached;

    {
      const blocked = await gateAndMeter(email, "focused", isCached);
      if (blocked) return blocked;
    }

    try {
      ensureDailyBudget(0.05);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return jsonResponse({ type: "error", error: msg }, 503);
    }

    return streamFocused({ ticker, question, cached, cacheKey, intentCostUSD, audience });
  }

  // ── COMPARE — head-to-head between two tickers ──────────────────────────
  if (intent.action === "compare") {
    const { tickerA, tickerB } = intent;
    const cacheKey = compareCacheKey(tickerA, tickerB, audience);
    const cached   = cacheGet<CompareResult>(cacheKey);
    const isCached = !!cached;

    {
      const blocked = await gateAndMeter(email, "compare", isCached);
      if (blocked) return blocked;
    }

    try {
      // Worst case: two cold councils (~0.07 each) + comparative synthesis.
      ensureDailyBudget(0.16);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return jsonResponse({ type: "error", error: msg }, 503);
    }

    return streamCompare({ tickerA, tickerB, cached, cacheKey, intentCostUSD, audience });
  }

  // ── SECTOR — thematic snapshot across a curated basket ──────────────────
  if (intent.action === "sector") {
    const basket = resolveSector(intent.sectorKey);
    if (!basket) {
      return jsonResponse({ type: "error", error: "Unknown sector." }, 400);
    }
    const cacheKey = sectorCacheKey(basket.key, audience);
    const cached   = cacheGet<SectorResult>(cacheKey);
    const isCached = !!cached;

    {
      const blocked = await gateAndMeter(email, "sector_analyze", isCached);
      if (blocked) return blocked;
    }

    try {
      // Worst case: every name cold (~6 × ~2.5¢ sweep+scorecard) + Sonnet synthesis.
      ensureDailyBudget(0.22);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return jsonResponse({ type: "error", error: msg }, 503);
    }

    return streamSector({ basket, cached, cacheKey, intentCostUSD, audience });
  }

  // ── HEADLINE — news-impact decode (Headline Decoder skill) ──────────────
  if (intent.action === "headline") {
    const headline = intent.headline;
    const cacheKey = `headline:${headline.toLowerCase().replace(/\W+/g, "_").slice(0, 80)}${audienceCacheSuffix(audience)}`;
    const cached   = cacheGet<HeadlineResult>(cacheKey);
    const isCached = !!cached;

    {
      // Metered under "focused" — comparable weight (Haiku + 2 searches).
      const blocked = await gateAndMeter(email, "focused", isCached);
      if (blocked) return blocked;
    }

    try {
      ensureDailyBudget(0.05);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return jsonResponse({ type: "error", error: msg }, 503);
    }

    return streamHeadline({ headline, cached, cacheKey, intentCostUSD, audience });
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
    const blocked = await gateAndMeter(email, "general", false);
    if (blocked) return blocked;
  }

  try {
    ensureDailyBudget(0.10); // Sonnet + up to 3 web searches
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonResponse({ type: "error", error: msg }, 503);
  }

  return streamAnalyst({ messages, intentCostUSD, audience });
}

// ── Stream helpers ───────────────────────────────────────────────────────────

// Guarded NDJSON writer. The header-card quote arrives on its own promise, so
// emits can race the stream close — a late enqueue on a closed controller must
// never crash the route.
function ndjsonWriter(controller: ReadableStreamDefaultController<Uint8Array>) {
  const enc = new TextEncoder();
  let closed = false;
  const emit = (obj: unknown) => {
    if (closed) return;
    try {
      controller.enqueue(enc.encode(JSON.stringify(obj) + "\n"));
    } catch {
      closed = true;
    }
  };
  const close = () => {
    if (closed) return;
    closed = true;
    try {
      controller.close();
    } catch {
      /* already closed by the runtime */
    }
  };
  return { emit, close };
}

// Fetch the verdict-header quote from the marketdata layer and emit it as its
// own event. Returns the promise so cached fast-paths can await it before
// closing. quote() never throws (provider chain catches) — null is the honest
// "price unavailable" state the UI must render as such.
function emitQuote(
  emit: (obj: unknown) => void,
  ticker: string
): Promise<void> {
  return mdQuote(ticker).then((q: Quote | null) => {
    emit({ type: "quote", ticker: ticker.toUpperCase(), quote: q });
  });
}

interface StreamFocusedArgs {
  ticker:     string;
  question:   string;
  cached?:    FocusedResult;
  cacheKey:   string;
  intentCostUSD: number;
  audience?:  ExperienceLevel | null;
}

function streamFocused({ ticker, question, cached, cacheKey, intentCostUSD, audience }: StreamFocusedArgs): Response {
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const { emit, close } = ndjsonWriter(controller);

      emit({ type: "intent", action: "focused", ticker, question, costUSD: intentCostUSD });
      const quoteDone = emitQuote(emit, ticker);

      if (cached) {
        await quoteDone;
        emit({ type: "focused_done", result: { ...cached, cached: true }, costUSD: intentCostUSD, intentCostUSD });
        emit({ type: "done" });
        close();
        return;
      }

      try {
        const result = await runFocusedQuery(ticker, question, {
          audience,
          onEvent: (event: FocusedEvent) => emit({ type: "focused", event }),
        });
        cacheSet(cacheKey, result, COUNCIL_CACHE_TTL_MS);
        recordSpend(result.estCostUSD);
        emit({ type: "focused_done", result, costUSD: result.estCostUSD + intentCostUSD, intentCostUSD });
      } catch (focusedErr) {
        const focusedMsg = focusedErr instanceof Error ? focusedErr.message : String(focusedErr);
        console.error(`[chat] focused failed for ${ticker}; falling back to analyst:`, focusedMsg);
        try {
          const fallback = await runAnalyst([{ role: "user", content: question }], { audience });
          recordSpend(fallback.costUSD);
          emit({ type: "text", text: fallback.text, costUSD: fallback.costUSD + intentCostUSD, intentCostUSD });
        } catch (analystErr) {
          const analystMsg = analystErr instanceof Error ? analystErr.message : String(analystErr);
          console.error("[chat] analyst fallback also failed:", analystMsg);
          emit({ type: "error", error: "Unable to answer this right now. Try asking me to 'analyze AAPL' instead." });
        }
      } finally {
        await quoteDone;
        emit({ type: "done" });
        close();
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
  audience?:    ExperienceLevel | null;
}

function streamAnalyst({ messages, intentCostUSD, audience }: StreamAnalystArgs): Response {
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const { emit, close } = ndjsonWriter(controller);

      emit({ type: "intent", action: "general", costUSD: intentCostUSD });

      try {
        const result = await runAnalyst(messages, {
          audience,
          onDelta: (delta: string) => emit({ type: "text_chunk", delta }),
        });
        recordSpend(result.costUSD);
        emit({ type: "text", text: result.text, costUSD: result.costUSD + intentCostUSD, intentCostUSD });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[chat] analyst failed:", msg);
        emit({ type: "error", error: "The answer couldn't be completed right now. Try again in a moment." });
      } finally {
        emit({ type: "done" });
        close();
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
  audience?: ExperienceLevel | null;
}

function streamCouncil({ ticker, focus, cached, cacheKey, intentCostUSD, audience }: StreamCouncilArgs): Response {
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const { emit, close } = ndjsonWriter(controller);

      emit({ type: "intent", action: "analyze", ticker, focus, costUSD: intentCostUSD });
      const quoteDone = emitQuote(emit, ticker);

      if (cached) {
        await quoteDone;
        emit({ type: "council_done", result: { ...cached, cached: true }, costUSD: intentCostUSD, intentCostUSD });
        emit({ type: "done" });
        close();
        return;
      }

      try {
        const result = await runCouncil(ticker, {
          focus,
          audience,
          onEvent: (event: CouncilEvent) => emit({ type: "council", event }),
        });
        cacheSet(cacheKey, result, COUNCIL_CACHE_TTL_MS);
        recordSpend(result.estCostUSD);
        // Publish canonical (unfocused, default-audience) runs to the public
        // /stock/[ticker] page — personalized phrasings stay private.
        if (!focus && !audience) void persistStockReport(result);
        emit({ type: "council_done", result, costUSD: result.estCostUSD + intentCostUSD, intentCostUSD });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[chat] council failed for ${ticker}:`, msg);
        // Internal pipeline errors carry backstage vocabulary — users get
        // honest plain English, the console gets the real message.
        emit({ type: "error", error: `We couldn't pull enough verified facts on ${ticker} just now. Give it another try in a moment.` });
      } finally {
        await quoteDone;
        emit({ type: "done" });
        close();
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
  audience?: ExperienceLevel | null;
}

function streamSector({ basket, cached, cacheKey, intentCostUSD, audience }: StreamSectorArgs): Response {
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const { emit, close } = ndjsonWriter(controller);

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
        close();
        return;
      }

      try {
        const result = await runSector(basket, {
          audience,
          onEvent: (event: SectorEvent) => emit({ type: "sector", event }),
        });
        cacheSet(cacheKey, result, COUNCIL_CACHE_TTL_MS);
        recordSpend(result.estCostUSD);
        emit({ type: "sector_done", result, costUSD: result.estCostUSD + intentCostUSD, intentCostUSD });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[chat] sector failed for ${basket.key}:`, msg);
        emit({ type: "error", error: `Couldn't score enough names in ${basket.label} just now. Give it another try in a moment.` });
      } finally {
        emit({ type: "done" });
        close();
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
  audience?: ExperienceLevel | null;
}

function streamCompare({ tickerA, tickerB, cached, cacheKey, intentCostUSD, audience }: StreamCompareArgs): Response {
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const { emit, close } = ndjsonWriter(controller);

      emit({ type: "intent", action: "compare", tickerA, tickerB, costUSD: intentCostUSD });
      const quotesDone = Promise.all([emitQuote(emit, tickerA), emitQuote(emit, tickerB)]);

      if (cached) {
        await quotesDone;
        emit({ type: "compare_done", result: { ...cached, cached: true }, costUSD: intentCostUSD, intentCostUSD });
        emit({ type: "done" });
        close();
        return;
      }

      try {
        const result = await runCompare(tickerA, tickerB, {
          audience,
          onEvent: (event: CompareEvent) => emit({ type: "compare", event }),
        });
        const { freshSides, ...compareResult } = result;
        cacheSet(cacheKey, compareResult, COUNCIL_CACHE_TTL_MS);
        recordSpend(compareResult.estCostUSD);
        // Publish to the public /stock and /compare pSEO pages — default-
        // audience runs only; personalized phrasings stay private.
        if (!audience) {
          if (freshSides.includes("a")) void persistStockReport(compareResult.a);
          if (freshSides.includes("b")) void persistStockReport(compareResult.b);
          // Fresh runs only — the cached branch above returns before reaching here.
          void persistCompareReport(compareResult);
        }
        emit({ type: "compare_done", result: compareResult, costUSD: compareResult.estCostUSD + intentCostUSD, intentCostUSD });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[chat] compare failed for ${tickerA} vs ${tickerB}:`, msg);
        emit({ type: "error", error: `The ${tickerA} vs ${tickerB} match-up couldn't be completed just now. Give it another try in a moment.` });
      } finally {
        await quotesDone;
        emit({ type: "done" });
        close();
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store, no-transform", "X-Accel-Buffering": "no" },
  });
}

interface StreamHeadlineArgs {
  headline: string;
  cached?:  HeadlineResult;
  cacheKey: string;
  intentCostUSD: number;
  audience?: ExperienceLevel | null;
}

function streamHeadline({ headline, cached, cacheKey, intentCostUSD, audience }: StreamHeadlineArgs): Response {
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const { emit, close } = ndjsonWriter(controller);

      emit({ type: "intent", action: "headline", headline, costUSD: intentCostUSD });

      // After the decode lands, attach live prices to the affected tickers
      // (marketdata layer, 15-min cache — null renders as "unavailable").
      const emitImpactQuotes = (result: HeadlineResult) =>
        Promise.all(result.impacts.map((i) => emitQuote(emit, i.ticker)));

      if (cached) {
        await emitImpactQuotes(cached);
        emit({ type: "headline_done", result: { ...cached, cached: true }, costUSD: intentCostUSD, intentCostUSD });
        emit({ type: "done" });
        close();
        return;
      }

      try {
        const result = await runHeadlineDecoder(headline, {
          audience,
          onEvent: (event: HeadlineEvent) => emit({ type: "headline", event }),
        });
        cacheSet(cacheKey, result, COUNCIL_CACHE_TTL_MS);
        recordSpend(result.estCostUSD);
        await emitImpactQuotes(result);
        emit({ type: "headline_done", result, costUSD: result.estCostUSD + intentCostUSD, intentCostUSD });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[chat] headline decode failed:`, msg);
        emit({ type: "error", error: "Couldn't decode that headline right now. Try pasting the full headline text." });
      } finally {
        emit({ type: "done" });
        close();
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store, no-transform", "X-Accel-Buffering": "no" },
  });
}
