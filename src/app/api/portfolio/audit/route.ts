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
import { runAudit, type AuditEvent } from "@/lib/portfolio/orchestrator";
import { savePortfolio, recordAudit, sanitizeHoldings } from "@/lib/portfolio/store";
import type { Holding } from "@/lib/portfolio/types";

// POST /api/portfolio/audit
// Body: { portfolioId?, name?, holdings: [{ ticker, shares, costBasis? }] }
//
// Runs a full portfolio audit and streams progress as NDJSON. Deducts the
// portfolio_audit credit cost up front (45). On success, the portfolio is
// upserted and the audit is appended to its history so the user can re-view it
// for free and chart health over time.
//
// Mirrors the chat route's gating: verified session, IP rate limit, daily
// budget kill switch, credit balance check before any model call.

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

  let body: { portfolioId?: string; name?: string; holdings?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ type: "error", error: "Invalid JSON body." }, 400);
  }

  const holdings: Holding[] = sanitizeHoldings(body.holdings);
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

  // Credit gating — charge the full audit cost before any model call.
  await grantFreeCreditsIfDue(email);
  const current = await getCredits(email);
  const balance = current?.credits ?? 0;
  if (balance < COST) {
    return json(
      {
        type: "error",
        error: `Insufficient credits. A portfolio audit costs ${COST} credits; you have ${balance}. Top up at /pricing.`,
        code: "insufficient_credits",
        credits: balance,
        needed: COST,
      },
      402
    );
  }
  const deduction = await deductCredits(email, COST, "portfolio_audit", 0);
  if (!deduction.ok) {
    return json(
      {
        type: "error",
        error: `Insufficient credits. A portfolio audit costs ${COST} credits; you have ${deduction.remaining}.`,
        code: "insufficient_credits",
        credits: deduction.remaining,
        needed: COST,
      },
      402
    );
  }

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
          onEvent: (event: AuditEvent) => emit({ type: "audit", event }),
        });
        recordSpend(result.estCostUSD);

        // Persist: upsert the portfolio, then append the audit to its history.
        let portfolioId = body.portfolioId;
        try {
          const saved = await savePortfolio(email, { id: portfolioId, name, holdings });
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
        // Refund the credits — the user got no usable audit.
        try {
          await addCredits(email, COST, "portfolio_audit_refund");
          creditsRefunded = true;
        } catch (refundErr) {
          console.error("[portfolio/audit] refund failed:", refundErr instanceof Error ? refundErr.message : refundErr);
        }
        emit({
          type: "error",
          error: msg.includes("price any")
            ? "Could not fetch live prices for these tickers right now. Double-check the symbols and try again."
            : "The audit could not be completed. Your credits were not charged.",
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
