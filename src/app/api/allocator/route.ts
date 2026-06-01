import { getVerifiedUser } from "@/lib/auth";
import {
  checkRateLimit,
  ensureDailyBudget,
  getClientIp,
  RATE_LIMITS,
  recordSpend,
} from "@/lib/rate-limit";
import {
  deductCredits,
  addCredits,
  grantFreeCreditsIfDue,
  getCredits,
  CREDITS_PER_INTENT,
} from "@/lib/credits";
import { runAllocator } from "@/lib/allocator/orchestrator";
import type {
  AllocatorEvent,
  Goal,
  Guardrail,
  InvestorProfile,
  RiskTolerance,
} from "@/lib/allocator/types";

// POST /api/allocator
// Body: an investor profile { lumpSum, monthlyContribution, riskTolerance,
//   horizonYears, goals[], highInterestDebt, hasEmergencyFund, guardrails[],
//   age?, notes? }
//
// Runs the full allocation pipeline and streams progress as NDJSON. Deducts the
// `allocator` credit cost up front (40) and refunds it if the run fails to
// produce a usable plan. Mirrors the portfolio/audit route's gating: verified
// session, IP rate limit, daily budget kill switch, credit balance check.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const COST = CREDITS_PER_INTENT.allocator;

const RISK_VALUES: RiskTolerance[] = ["conservative", "balanced", "growth", "aggressive"];
const GOAL_VALUES: Goal[] = [
  "retirement",
  "wealth",
  "house",
  "income",
  "education",
  "bigPurchase",
  "preservation",
];
const GUARDRAIL_VALUES: Guardrail[] = [
  "indexOnly",
  "noBonds",
  "usOnly",
  "dividendFocus",
  "addHedge",
  "esgTilt",
];

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function toNum(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return isFinite(n) && n > 0 ? n : 0;
}

// Build a clean InvestorProfile from arbitrary JSON. Never trusts the body for
// anything beyond the profile fields. Returns null + reason if invalid.
function sanitizeProfile(body: unknown): { profile?: InvestorProfile; error?: string } {
  if (!body || typeof body !== "object") return { error: "Invalid profile body." };
  const b = body as Record<string, unknown>;

  const lumpSum = Math.min(toNum(b.lumpSum), 1_000_000_000);
  const monthlyContribution = Math.min(toNum(b.monthlyContribution), 100_000_000);
  if (lumpSum <= 0 && monthlyContribution <= 0) {
    return { error: "Enter an amount to invest now and/or a monthly contribution." };
  }

  const riskTolerance = RISK_VALUES.includes(b.riskTolerance as RiskTolerance)
    ? (b.riskTolerance as RiskTolerance)
    : null;
  if (!riskTolerance) return { error: "Pick a risk tolerance." };

  const horizonYears = Number(b.horizonYears);
  if (!isFinite(horizonYears) || horizonYears < 0.5 || horizonYears > 60) {
    return { error: "Set a time horizon between 0.5 and 60 years." };
  }

  const goals = Array.isArray(b.goals)
    ? Array.from(new Set((b.goals as unknown[]).filter((g): g is Goal => GOAL_VALUES.includes(g as Goal))))
    : [];
  if (goals.length === 0) return { error: "Pick at least one goal." };

  const guardrails = Array.isArray(b.guardrails)
    ? Array.from(
        new Set(
          (b.guardrails as unknown[]).filter((g): g is Guardrail =>
            GUARDRAIL_VALUES.includes(g as Guardrail)
          )
        )
      )
    : [];

  const age = b.age != null && isFinite(Number(b.age)) ? Math.max(0, Math.min(120, Number(b.age))) : undefined;
  const notes = typeof b.notes === "string" ? b.notes.slice(0, 280) : undefined;

  return {
    profile: {
      lumpSum,
      monthlyContribution,
      riskTolerance,
      horizonYears,
      goals,
      highInterestDebt: b.highInterestDebt === true,
      hasEmergencyFund: b.hasEmergencyFund === true,
      guardrails,
      age,
      notes,
    },
  };
}

export async function POST(req: Request) {
  const user = await getVerifiedUser();
  if (!user) {
    return json({ type: "error", error: "Please sign in to build a plan.", code: "auth_required" }, 401);
  }
  const email = user.email;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ type: "error", error: "Invalid JSON body." }, 400);
  }

  const { profile, error } = sanitizeProfile(body);
  if (!profile) {
    return json({ type: "error", error: error ?? "Invalid profile." }, 400);
  }

  // IP DDoS gate — reuse the analyze bucket (the allocator is heavier, low frequency).
  const ip = getClientIp(req);
  const gate = checkRateLimit(ip, RATE_LIMITS.chatAnalyze);
  if (!gate.ok) {
    return json({ type: "error", error: `Rate limit hit. Retry in ${gate.retryAfterSeconds}s.` }, 429);
  }

  // Daily budget kill switch — a plan can cost ~7-10¢.
  try {
    ensureDailyBudget(0.12);
  } catch (err) {
    return json({ type: "error", error: err instanceof Error ? err.message : String(err) }, 503);
  }

  // Credit gating — charge the full cost before any model call.
  await grantFreeCreditsIfDue(email);
  const current = await getCredits(email);
  const balance = current?.credits ?? 0;
  if (balance < COST) {
    return json(
      {
        type: "error",
        error: `Insufficient credits. An allocation plan costs ${COST} credits; you have ${balance}. Top up at /pricing.`,
        code: "insufficient_credits",
        credits: balance,
        needed: COST,
      },
      402
    );
  }
  const deduction = await deductCredits(email, COST, "allocator", 0);
  if (!deduction.ok) {
    return json(
      {
        type: "error",
        error: `Insufficient credits. An allocation plan costs ${COST} credits; you have ${deduction.remaining}.`,
        code: "insufficient_credits",
        credits: deduction.remaining,
        needed: COST,
      },
      402
    );
  }

  // Stream the run.
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const enc = new TextEncoder();
      const emit = (obj: unknown) => controller.enqueue(enc.encode(JSON.stringify(obj) + "\n"));

      emit({ type: "intent", action: "allocator", creditsCharged: COST });

      let creditsRefunded = false;
      try {
        const result = await runAllocator(profile, {
          onEvent: (event: AllocatorEvent) => emit({ type: "allocator", event }),
        });
        recordSpend(result.estCostUSD);

        emit({
          type: "allocator_done",
          result,
          costUSD: result.estCostUSD,
          creditsCharged: COST,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[allocator] failed:", msg);
        // Refund — the user got no usable plan.
        try {
          await addCredits(email, COST, "allocator_refund");
          creditsRefunded = true;
        } catch (refundErr) {
          console.error("[allocator] refund failed:", refundErr instanceof Error ? refundErr.message : refundErr);
        }
        emit({
          type: "error",
          error: msg.includes("source any")
            ? "Could not fetch live market data for the recommended vehicles right now. Please try again in a moment."
            : "The plan could not be completed. Your credits were not charged.",
          creditsRefunded,
        });
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
