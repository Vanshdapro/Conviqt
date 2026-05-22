import { NextResponse } from "next/server";
import { runPicker, type PickerResult } from "@/lib/agents/picker";
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
  PICKER_CACHE_KEY,
  PICKER_CACHE_TTL_MS,
} from "@/lib/cache";

// GET /api/pick
// Convenience endpoint for the homepage "fresh picks" button. Runs the
// picker agent and returns its raw result. Use the chat route instead if
// the call is part of a conversational flow.
//
// Protected by per-IP rate limit + daily budget kill switch + 5-min
// picker cache so a button-mashing user doesn't burn 30¢ in a minute.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const ip = getClientIp(req);
  const gate = checkRateLimit(ip, RATE_LIMITS.apiPick);
  if (!gate.ok) {
    return NextResponse.json(
      {
        error: `Rate limit hit (${RATE_LIMITS.apiPick.capacity}/min). Retry in ${gate.retryAfterSeconds}s.`,
      },
      {
        status: 429,
        headers: { "Retry-After": String(gate.retryAfterSeconds) },
      }
    );
  }

  const cached = cacheGet<PickerResult>(PICKER_CACHE_KEY);
  if (cached) {
    console.log("[pick] cache hit");
    return NextResponse.json({ ...cached, cached: true });
  }

  try {
    ensureDailyBudget(0.12);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 503 });
  }

  try {
    console.log("[pick] starting picker run");
    const result = await runPicker();
    cacheSet(PICKER_CACHE_KEY, result, PICKER_CACHE_TTL_MS);
    recordSpend(result.costUSD);
    console.log(
      `[pick] returned ${result.picks.length} picks in ${result.durationMs}ms, cost=$${result.costUSD.toFixed(4)}`
    );
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[pick] failed:", msg);
    return NextResponse.json({ error: msg }, { status: 503 });
  }
}
