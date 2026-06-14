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
import { getExperienceLevel, useDeepAnalysis, refundDeepAnalysis, FREE_DEEP_LIMIT, FREE_LIMIT_MSG } from "@/lib/profile";
import { runAudit, type AuditEvent } from "@/lib/portfolio/orchestrator";
import { savePortfolio, recordAudit, sanitizeHoldings, sanitizeCash } from "@/lib/portfolio/store";
import type { Holding } from "@/lib/portfolio/types";

// POST /api/portfolio/audit
// Body: { portfolioId?, name?, holdings: [{ ticker, shares, costBasis? }] }
//
// Runs a full portfolio audit and streams progress as NDJSON. Phase 7 gating:
// an AI Health Check is a deep analysis — Free users spend one of their 5
// monthly slots (refunded if the run fails), Pro is unlimited fair-use.
// Credits keep metering internally but never block. On success, the portfolio
// is upserted and the audit appended to its history so re-viewing is free.
//
// Mirrors the chat route's gating: verified session, IP rate limit, daily
// budget kill switch, plan gate before any model call.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const COST = CREDITS_PER_INTENT.portfolio_audit;

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(req: Request) {
  const user = await getVerifiedUser();
  if (!user) {
    return json({ type: "error", error: "Please sign in to run an audit.", code: "auth_required" }, 401);
  }
  const email = user.email;

  let body: { portfolioId?: string; name?: string; holdings?: unknown; cash?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ type: "error", error: "Invalid JSON body." }, 400);
  }

  const holdings: Holding[] = sanitizeHoldings(body.holdings);
  const cash = sanitizeCash(body.cash);
  if (holdings.length < 2) {
    return json(
      { type: "error", error: "Add at least 2 holdings (ticker + share count) to audit a portfolio." },
      400
    );
  }
  const name = (body.name ?? "My Portfolio").toString().trim().slice(0, 80) || "My Portfolio";

  // IP DDoS gate — reuse the analyze bucket (audits are heavier, low frequency).
  const ip = getClientIp(req);
  const gate = checkRateLimit(ip, RATE_LIMITS.chatAnalyze);
  if (!gate.ok) {
    return json({ type: "error", error: `Rate limit hit. Retry in ${gate.retryAfterSeconds}s.` }, 429);
  }

  // Daily budget kill switch — an audit can cost ~10-15¢.
  try {
    ensureDailyBudget(0.15);
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
      return json({ type: "error", error: FREE_LIMIT_MSG, code: "plan_limit" }, 402);
    }
  }

  // Internal metering — log-only, never a wall.
  void deductCredits(email, COST, "portfolio_audit", 0).catch((err) =>
    console.error("[portfolio/audit] internal meter error:", err instanceof Error ? err.message : err)
  );

  const audience = await getExperienceLevel(email);

  // Stream the audit.
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const enc = new TextEncoder();
      const emit = (obj: unknown) => controller.enqueue(enc.encode(JSON.stringify(obj) + "\n"));

      emit({ type: "intent", action: "portfolio_audit", holdings: holdings.length, creditsCharged: COST });

      let creditsRefunded = false;
      try {
        const result = await runAudit(holdings, {
          name,
          audience,
          cash,
          onEvent: (event: AuditEvent) => emit({ type: "audit", event }),
        });
        recordSpend(result.estCostUSD);

        // Persist: upsert the portfolio, then append the audit to its history.
        let portfolioId = body.portfolioId;
        try {
          const saved = await savePortfolio(email, { id: portfolioId, name, holdings, cash });
          if (saved) {
            portfolioId = saved.id;
            await recordAudit(email, saved.id, result);
          }
        } catch (persistErr) {
          console.error("[portfolio/audit] persist failed:", persistErr instanceof Error ? persistErr.message : persistErr);
          // Non-fatal — the user still gets their audit; it just isn't saved.
        }

        emit({
          type: "audit_done",
          result,
          portfolioId,
          costUSD: result.estCostUSD,
          creditsCharged: COST,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[portfolio/audit] failed:", msg);
        // Refund — the user got no usable audit. Free users get their monthly
        // deep-analysis slot back; the internal ledger gets its mirror entry.
        try {
          if (!isPro) await refundDeepAnalysis(email);
          await addCredits(email, COST, "portfolio_audit_refund");
          creditsRefunded = true;
        } catch (refundErr) {
          console.error("[portfolio/audit] refund failed:", refundErr instanceof Error ? refundErr.message : refundErr);
        }
        emit({
          type: "error",
          error: msg.includes("price any")
            ? "Could not fetch live prices for these tickers right now. Double-check the symbols and try again."
            : "The health check could not be completed. This run doesn't count against your month.",
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
