// POST /api/headline/refine
// Body: { headline: string }
//
// The AI "Sharpen this" pre-step for the Headline Decoder guided input. Takes a
// thin/ambiguous headline and rewrites it into a decode-ready prompt before the
// user runs the full decode — vague one-liners are the main reason a decode
// comes back with no usable stock impacts. Cheap pure-reasoning call
// (gpt-4.1-mini → OpenAI, sub-half-cent), same weight class as intent routing,
// so it is NOT plan-gated or credit-metered — only IP-rate-limited and counted
// against the daily budget kill-switch for observability.

import { NextResponse } from "next/server";
import { getVerifiedUser } from "@/lib/auth";
import { refineHeadline } from "@/lib/agents/headline";
import {
  checkRateLimit,
  ensureDailyBudget,
  getClientIp,
  RATE_LIMITS,
  recordSpend,
} from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

interface RefineBody {
  headline?: string;
}

export async function POST(req: Request) {
  const user = await getVerifiedUser();
  if (!user) {
    return NextResponse.json({ error: "auth_required" }, { status: 401 });
  }

  let body: RefineBody;
  try {
    body = (await req.json()) as RefineBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const headline = typeof body.headline === "string" ? body.headline.trim() : "";
  if (headline.length < 12) {
    return NextResponse.json(
      { error: "Paste the full headline so there's enough to sharpen." },
      { status: 400 }
    );
  }

  const ip = getClientIp(req);
  const gate = checkRateLimit(ip, RATE_LIMITS.chatGeneral);
  if (!gate.ok) {
    return NextResponse.json(
      { error: `Slow down a moment — try again in ${gate.retryAfterSeconds}s.` },
      { status: 429 }
    );
  }

  try {
    ensureDailyBudget(0.005);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 503 });
  }

  try {
    const { sharpened, estCostUSD } = await refineHeadline(headline);
    recordSpend(estCostUSD);
    console.log(`[headline/refine] ${user.email} cost=$${estCostUSD.toFixed(4)}`);
    return NextResponse.json({ sharpened, original: headline });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[headline/refine] failed:", msg);
    return NextResponse.json(
      { error: "Couldn't sharpen that just now. You can still run it as-is." },
      { status: 502 }
    );
  }
}
