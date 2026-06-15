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
  CREDITS_PER_INTENT,
} from "@/lib/credits";
import { getSubscriberByEmail, isPremium } from "@/lib/subscription";
import { getExperienceLevel, useDeepAnalysis, refundDeepAnalysis, FREE_DEEP_LIMIT, FREE_LIMIT_MSG, FREE_METER_DEGRADED_MSG } from "@/lib/profile";
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
// Runs the full allocation pipeline and streams progress as NDJSON. Phase 7
// gating: a Starter Portfolio is a deep analysis — Free users spend one of
// their 5 monthly slots (refunded if the run fails), Pro is unlimited
// fair-use. Credits keep metering internally but never block. Mirrors the
// portfolio/audit route: verified session, IP rate limit, budget kill switch.

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

  // Plan gate (Phase 7): one of the Free tier's 5 monthly deep analyses.
  await grantFreeCreditsIfDue(email);
  const subscriber = await getSubscriberByEmail(email);
  const isPro = isPremium(subscriber);
  if (!isPro) {
    const gate = await useDeepAnalysis(email, FREE_DEEP_LIMIT);
    if (!gate.allowed) {
      if (gate.degraded) {
        console.error(`[allocator] usage meter degraded for ${email} — failing closed`);
        return json({ type: "error", error: FREE_METER_DEGRADED_MSG, code: "meter_unavailable" }, 503);
      }
      return json({ type: "error", error: FREE_LIMIT_MSG, code: "plan_limit" }, 402);
    }
  }

  // Internal metering — log-only, never a wall.
  void deductCredits(email, COST, "allocator", 0).catch((err) =>
    console.error("[allocator] internal meter error:", err instanceof Error ? err.message : err)
  );

  const audience = await getExperienceLevel(email);

  // Stream the run.
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const enc = new TextEncoder();
      const emit = (obj: unknown) => controller.enqueue(enc.encode(JSON.stringify(obj) + "\n"));

      emit({ type: "intent", action: "allocator", creditsCharged: COST });

      let creditsRefunded = false;
      try {
        const result = await runAllocator(profile, {
          audience,
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
        // Refund — the user got no usable plan. Free users get their monthly
        // deep-analysis slot back; the internal ledger gets its mirror entry.
        try {
          if (!isPro) await refundDeepAnalysis(email);
          await addCredits(email, COST, "allocator_refund");
          creditsRefunded = true;
        } catch (refundErr) {
          console.error("[allocator] refund failed:", refundErr instanceof Error ? refundErr.message : refundErr);
        }
        emit({
          type: "error",
          error: msg.includes("source any")
            ? "Could not fetch live market data for the recommended vehicles right now. Please try again in a moment."
            : "The plan could not be completed. This run doesn't count against your month.",
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
