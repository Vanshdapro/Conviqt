// POST /api/stripe/webhook
//
// Handles Stripe events and keeps PLAN STATE (subscribers table) in sync.
// Since Phase 7 the consumer offer is the Pro subscription (pro_monthly /
// pro_annual, 7-day trial): webhook → upsertSubscriber → isPremium() gates.
// Credits stay as INTERNAL metering; Pro grants no credits.
//
// Events handled:
//   checkout.session.completed      — new Pro subscription (or legacy pack/dev)
//   invoice.payment_succeeded       — subscription renewal
//   customer.subscription.updated   — status change, cancellation, trial → active
//   customer.subscription.deleted   — hard cancellation
//   invoice.payment_failed          — mark subscription past_due
//
// Legacy actions still honored (plans no longer sold, but live ones work):
//   One-time pack purchase          → addCreditsOnce(email, CREDITS_BY_PLAN[plan])
//   Max renewal (cycle)             → resetSubscriptionCredits(email, credits, plan)
//   Developer plans                 → setDeveloperTier / setDeveloperStatus
//
// NOTE: This uses Stripe API version 2026-05-27.dahlia.

import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripe, getWebhookSecret, CREDITS_BY_PLAN, SUBSCRIPTION_PLANS, DEVELOPER_PLANS, PRO_PLANS, API_QUOTA_BY_PLAN, type PlanId, type DeveloperPlan } from "@/lib/stripe";
import { upsertSubscriber, getSubscriberByCustomerId, type Plan } from "@/lib/subscription";
import { addCreditsOnce, resetSubscriptionCredits, MAX_PLAN_MONTHLY_CREDITS } from "@/lib/credits";
import { setDeveloperTier, setDeveloperStatus } from "@/lib/apiKeys";
import { recordServerEvent } from "@/lib/analytics/server";

export const runtime  = "nodejs";
export const dynamic  = "force-dynamic";

// ── Helpers ──────────────────────────────────────────────────────────────────

function planFromMetadata(meta: Stripe.Metadata | null): PlanId | null {
  const p = meta?.plan as string | undefined;
  if (!p) return null;
  return p as PlanId;
}

// Plan id → the plan value stored on the subscribers row.
function subscriberPlan(plan: PlanId): Plan {
  if (
    plan === "pro_monthly" ||
    plan === "pro_annual" ||
    plan === "max_monthly" ||
    plan === "max_pro_monthly"
  ) {
    return plan;
  }
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

  // Authoritative `paid` funnel event — recorded straight from Stripe so the
  // funnel dashboard counts real conversions (covers dev, pack, and subscription).
  void recordServerEvent("paid", {
    email,
    meta: {
      plan,
      mode: session.mode,
      amount: session.amount_total != null ? session.amount_total / 100 : null,
      currency: session.currency,
    },
  });

  // Developer (API) plans grant a call quota, not credits, and live in a
  // separate table. Provision the entitlement and return early.
  if (DEVELOPER_PLANS.has(plan)) {
    const devPlan = plan as DeveloperPlan;
    const subId =
      typeof session.subscription === "string"
        ? session.subscription
        : (session.subscription as Stripe.Subscription | null)?.id ?? null;
    await setDeveloperTier(email, devPlan, API_QUOTA_BY_PLAN[devPlan], subId);
    console.log(`[webhook] checkout.completed: dev tier ${devPlan} (${API_QUOTA_BY_PLAN[devPlan]}/mo) for ${email}`);
    return;
  }

  // Subscription plans → plan state FIRST. This is the whole entitlement for
  // Pro (no credit grant), so it must never sit behind a credits early-return.
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
      plan: subscriberPlan(plan),
      current_period_end: periodEndFromSub(sub),
    });
    console.log(`[webhook] checkout.completed: plan state ${plan}/${sub.status} for ${email}`);
  }

  // Credit grant — legacy packs and Max plans only; Pro grants none.
  // Keyed on the checkout session id so the success-page /verify fallback and
  // this webhook can both run without ever double-crediting.
  const credits = CREDITS_BY_PLAN[plan] ?? 0;
  if (credits > 0) {
    await addCreditsOnce(email, credits, `stripe_session_${session.id}`, plan);
    console.log(`[webhook] checkout.completed: +${credits} credits for ${email} (${plan})`);
  }
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

  // Developer-plan renewal: reset the API call window for the new cycle.
  if (plan && DEVELOPER_PLANS.has(plan)) {
    const devPlan = plan as DeveloperPlan;
    await setDeveloperTier(email, devPlan, API_QUOTA_BY_PLAN[devPlan], sub.id);
    console.log(`[webhook] invoice.succeeded: renewed dev tier ${devPlan} for ${email}`);
    return;
  }

  // Pro renewal: refresh plan state (status + period end). No credits — Pro
  // is unlimited fair-use, gated by isPremium(), not a balance.
  if (plan && PRO_PLANS.has(plan)) {
    await upsertSubscriber({
      email,
      stripe_customer_id: custId,
      subscription_id:    sub.id,
      subscription_status: sub.status,
      plan: subscriberPlan(plan),
      current_period_end: periodEndFromSub(sub),
    });
    console.log(`[webhook] invoice.succeeded: renewed ${plan} for ${email}`);
    return;
  }

  const monthly = plan ? MAX_PLAN_MONTHLY_CREDITS[plan] : 0;

  if (!plan || !monthly) {
    console.warn("[webhook] invoice.succeeded: not a Pro/Max plan", plan);
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

  // Developer (API) plan billing-state change: suspend or restore API access.
  // We don't write to the subscribers table for these — they're tracked in
  // developer_accounts. A canceled/past_due account fails closed in the API.
  if (plan && DEVELOPER_PLANS.has(plan)) {
    const devStatus =
      sub.status === "active" || sub.status === "trialing"
        ? "active"
        : sub.status === "past_due" || sub.status === "unpaid"
          ? "past_due"
          : "canceled";
    await setDeveloperStatus(email, devStatus);
    console.log(`[webhook] dev subscription ${sub.status} → ${devStatus} for ${email}`);
    return;
  }

  // Never assume Pro from missing metadata. Canceled → free. With plan metadata
  // → that plan. Without metadata on a live subscription (legacy/manually-created
  // sub, or an event Stripe sends without subscription_data.metadata) → preserve
  // the existing stored plan, defaulting to free. The old `plan ?? "pro_monthly"`
  // fallback silently upgraded any metadata-less subscriber to Pro.
  let resolvedPlan: Plan;
  if (sub.status === "canceled") {
    resolvedPlan = "free";
  } else if (plan) {
    resolvedPlan = subscriberPlan(plan);
  } else {
    const existing = await getSubscriberByCustomerId(custId);
    // Subscriber.plan is typed `string` in the store, but this table is only
    // ever written with Plan values by this webhook, so the cast is safe.
    resolvedPlan = (existing?.plan as Plan | undefined) ?? "free";
    console.warn(
      `[webhook] subscription ${sub.id} has no plan metadata — preserving "${resolvedPlan}" for ${email}`
    );
  }

  await upsertSubscriber({
    email,
    stripe_customer_id:  custId,
    subscription_id:     sub.id,
    subscription_status: sub.status,
    plan: resolvedPlan,
    current_period_end: periodEndFromSub(sub),
  });

  console.log(`[webhook] subscription ${sub.status} (${resolvedPlan}) for ${email}`);
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
