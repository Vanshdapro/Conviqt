// POST /api/stripe/webhook
//
// Handles Stripe events and keeps the credit ledger in sync.
//
// Events handled:
//   checkout.session.completed      — one-time pack or new subscription
//   invoice.payment_succeeded       — monthly subscription renewal
//   customer.subscription.updated   — status change, cancellation
//   customer.subscription.deleted   — hard cancellation
//   invoice.payment_failed          — mark subscription past_due
//
// Credit actions:
//   One-time pack purchase          → addCredits(email, CREDITS_BY_PLAN[plan])
//   First subscription payment      → addCredits(email, CREDITS_BY_PLAN[plan])
//   Subscription renewal (cycle)    → resetSubscriptionCredits(email, credits, plan)
//   Subscription canceled           → upsertSubscriber status only; credits remain
//
// NOTE: This uses Stripe API version 2026-05-27.dahlia.

import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripe, getWebhookSecret, CREDITS_BY_PLAN, SUBSCRIPTION_PLANS, type PlanId } from "@/lib/stripe";
import { upsertSubscriber, type Plan } from "@/lib/subscription";
import { addCreditsOnce, resetSubscriptionCredits, MAX_PLAN_MONTHLY_CREDITS } from "@/lib/credits";

export const runtime  = "nodejs";
export const dynamic  = "force-dynamic";

// ── Helpers ──────────────────────────────────────────────────────────────────

function planFromMetadata(meta: Stripe.Metadata | null): PlanId | null {
  const p = meta?.plan as string | undefined;
  if (!p) return null;
  // Map old plan names that might exist on legacy sessions
  if (p === "pro_monthly" || p === "pro_annual") return null;
  return p as PlanId;
}

function subscriptionPlanToLegacy(plan: PlanId): Plan {
  if (plan === "max_monthly" || plan === "max_pro_monthly") return plan as unknown as Plan;
  return "free";
}

function periodEndFromSub(sub: Stripe.Subscription): string | null {
  if (sub.cancel_at) return new Date(sub.cancel_at * 1000).toISOString();
  if (sub.trial_end) return new Date(sub.trial_end * 1000).toISOString();
  return null;
}

async function resolveEmail(
  customerId: string,
  stripe: Stripe
): Promise<string | null> {
  try {
    const customer = await stripe.customers.retrieve(customerId);
    if (customer.deleted) return null;
    return (customer as Stripe.Customer).email ?? null;
  } catch {
    return null;
  }
}

// ── Event handlers ───────────────────────────────────────────────────────────

async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session,
  stripe: Stripe
): Promise<void> {
  const email = session.customer_details?.email ?? session.customer_email ?? null;
  const customerId =
    typeof session.customer === "string"
      ? session.customer
      : (session.customer as Stripe.Customer | null)?.id ?? null;

  if (!email || !customerId) {
    console.error("[webhook] checkout.completed: missing email/customer", session.id);
    return;
  }

  const plan = planFromMetadata(session.metadata);
  if (!plan) {
    console.warn("[webhook] checkout.completed: unknown plan in metadata", session.metadata);
    return;
  }

  const credits = CREDITS_BY_PLAN[plan] ?? 0;
  if (credits === 0) {
    console.warn("[webhook] checkout.completed: 0 credits for plan", plan);
    return;
  }

  // Add credits (works for both one-time packs and initial subscription payment).
  // Keyed on the checkout session id so the success-page /verify fallback and
  // this webhook can both run without ever double-crediting.
  await addCreditsOnce(email, credits, `stripe_session_${session.id}`, plan);

  // For subscription plans, also track in the subscribers table
  if (SUBSCRIPTION_PLANS.has(plan) && session.subscription) {
    const subId =
      typeof session.subscription === "string"
        ? session.subscription
        : (session.subscription as Stripe.Subscription).id;
    const sub = await stripe.subscriptions.retrieve(subId);

    await upsertSubscriber({
      email,
      stripe_customer_id: customerId,
      subscription_id:    subId,
      subscription_status: sub.status,
      plan: subscriptionPlanToLegacy(plan),
      current_period_end: periodEndFromSub(sub),
    });
  }

  console.log(`[webhook] checkout.completed: +${credits} credits for ${email} (${plan})`);
}

async function handleInvoicePaymentSucceeded(
  invoice: Stripe.Invoice,
  stripe: Stripe
): Promise<void> {
  // Only handle subscription renewals (not the initial invoice — checkout handles that)
  if (invoice.billing_reason !== "subscription_cycle") return;

  const subId =
    invoice.parent?.type === "subscription_details"
      ? (invoice.parent.subscription_details as { subscription?: string } | null)?.subscription ?? null
      : null;

  if (!subId) {
    console.warn("[webhook] invoice.succeeded: no subscription ID found", invoice.id);
    return;
  }

  const sub      = await stripe.subscriptions.retrieve(subId);
  const custId   = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const email    = await resolveEmail(custId, stripe);

  if (!email) {
    console.error("[webhook] invoice.succeeded: no email for customer", custId);
    return;
  }

  const plan    = planFromMetadata(sub.metadata);
  const monthly = plan ? MAX_PLAN_MONTHLY_CREDITS[plan] : 0;

  if (!plan || !monthly) {
    console.warn("[webhook] invoice.succeeded: not a Max plan", plan);
    return;
  }

  await resetSubscriptionCredits(email, monthly, plan);
  console.log(`[webhook] invoice.succeeded: renewed ${monthly} credits for ${email} (${plan})`);
}

async function handleSubscriptionChange(
  sub: Stripe.Subscription,
  stripe: Stripe
): Promise<void> {
  const custId  = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const email   = await resolveEmail(custId, stripe);

  if (!email) {
    console.error("[webhook] subscription change: no email for customer", custId);
    return;
  }

  const plan = planFromMetadata(sub.metadata);

  await upsertSubscriber({
    email,
    stripe_customer_id:  custId,
    subscription_id:     sub.id,
    subscription_status: sub.status,
    plan: sub.status === "canceled"
      ? "free"
      : subscriptionPlanToLegacy(plan ?? "max_monthly" as PlanId),
    current_period_end: periodEndFromSub(sub),
  });

  console.log(`[webhook] subscription ${sub.status} for ${email}`);
}

// ── Main handler ─────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const rawBody = await req.text();
  const sig     = req.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ error: "Missing stripe-signature header." }, { status: 400 });
  }

  let webhookSecret: string;
  try {
    webhookSecret = getWebhookSecret();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[webhook] config error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const stripe = getStripe();
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[webhook] signature verification failed:", msg);
    return NextResponse.json({ error: `Webhook signature invalid: ${msg}` }, { status: 400 });
  }

  console.log(`[webhook] received: ${event.type}`);

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session, stripe);
        break;

      case "invoice.payment_succeeded":
        await handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice, stripe);
        break;

      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await handleSubscriptionChange(event.data.object as Stripe.Subscription, stripe);
        break;

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const subId =
          invoice.parent?.type === "subscription_details"
            ? (invoice.parent.subscription_details as { subscription?: string } | null)?.subscription ?? null
            : null;
        if (subId) {
          const sub = await stripe.subscriptions.retrieve(subId);
          await handleSubscriptionChange(sub, stripe);
        } else {
          console.warn("[webhook] invoice.payment_failed: no sub ID", invoice.id);
        }
        break;
      }

      default:
        // Unhandled events — just log, no error
        break;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[webhook] handler error for ${event.type}:`, msg);
    // Return 200 so Stripe doesn't retry DB errors in an infinite loop.
  }

  return NextResponse.json({ received: true });
}
