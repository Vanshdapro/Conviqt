"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { PricingCard, ManageSubscriptionButton } from "@/components/PricingCard";
import type { PricingPlan } from "@/components/PricingCard";

// ── Plan definitions ─────────────────────────────────────────────────────────

const FREE_PLAN: PricingPlan = {
  id: "free",
  kind: "free",
  name: "Free",
  price: "$0",
  period: "/ month",
  credits: 50,
  description: "50 credits every month — resets on the 1st.",
  features: [
    "50 credits / month (auto-resets)",
    "~3 full stock analyses per month",
    "Unlimited general chat (within credits)",
    "All 6 Council agents on every analysis",
    "Every claim cited with a source URL",
  ],
  cta: "Start free",
};

const PRO_PACKS: PricingPlan[] = [
  {
    id: "credits_500",
    kind: "pack",
    name: "Starter",
    price: "$5",
    period: "one-time",
    credits: 500,
    description: "Casual investor, 1–2 stocks a week.",
    features: [
      "500 credits, never expire",
      "~33 full stock analyses",
      "~62 focused questions",
      "~27 general market discussions",
    ],
    cta: "Buy 500 credits",
  },
  {
    id: "credits_1000",
    kind: "pack",
    name: "Standard",
    price: "$9",
    period: "one-time",
    credits: 1000,
    highlighted: true,
    badge: "Best value",
    description: "Active investor, daily research.",
    features: [
      "1 000 credits, never expire",
      "~66 full stock analyses",
      "~125 focused questions",
      "~55 general market discussions",
    ],
    cta: "Buy 1 000 credits",
  },
  {
    id: "credits_2000",
    kind: "pack",
    name: "Plus",
    price: "$16",
    period: "one-time",
    credits: 2000,
    description: "Heavy user, multiple portfolios.",
    features: [
      "2 000 credits, never expire",
      "~133 full stock analyses",
      "~250 focused questions",
      "~111 general market discussions",
    ],
    cta: "Buy 2 000 credits",
  },
  {
    id: "credits_3000",
    kind: "pack",
    name: "Power",
    price: "$24",
    period: "one-time",
    credits: 3000,
    description: "Power user or small fund.",
    features: [
      "3 000 credits, never expire",
      "~200 full stock analyses",
      "~375 focused questions",
      "~166 general market discussions",
    ],
    cta: "Buy 3 000 credits",
  },
];

const MAX_PLANS: PricingPlan[] = [
  {
    id: "max_monthly",
    kind: "subscription",
    name: "Max",
    price: "$28",
    period: "/ month",
    credits: 4000,
    highlighted: true,
    badge: "Most popular",
    description: "Unlimited research for the serious investor.",
    features: [
      "4 000 credits / month (incl. 500 bonus)",
      "Up to 25 % rollover on unused credits",
      "~266 full stock analyses per month",
      "Effectively unlimited daily research",
      "Cancel anytime — credits remain",
    ],
    cta: "Start Max",
  },
  {
    id: "max_pro_monthly",
    kind: "subscription",
    name: "Max Pro",
    price: "$52",
    period: "/ month",
    credits: 7500,
    description: "For professionals and power traders.",
    features: [
      "7 500 credits / month (incl. 1 500 bonus)",
      "Up to 25 % rollover on unused credits",
      "~500 full stock analyses per month",
      "Everything in Max, scaled up",
      "Ideal for multi-portfolio management",
    ],
    cta: "Start Max Pro",
  },
];

// ── Credit cost reference table ──────────────────────────────────────────────

function CreditCosts() {
  return (
    <div className="mx-auto mt-16 max-w-xl">
      <p className="text-center mono text-[10px] tracking-[0.12em] uppercase text-white/30 mb-5">
        Credit costs per query
      </p>
      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] overflow-hidden">
        {[
          { action: "Full Council analysis", credits: 15, note: "6-agent debate, all sources cited" },
          { action: "Focused stock question", credits: 8,  note: "Targeted sweep + expert answer" },
          { action: "General analyst chat",  credits: 18, note: "Sonnet + live web search" },
          { action: "Cache hit (any)",       credits: 1,  note: "Same query within 4 hours" },
        ].map((row, i, arr) => (
          <div
            key={row.action}
            className={`flex items-center justify-between gap-4 px-5 py-3.5 ${i < arr.length - 1 ? "border-b border-white/[0.06]" : ""}`}
          >
            <div>
              <p className="text-[13px] text-white/80">{row.action}</p>
              <p className="text-[11px] text-white/30 mt-0.5">{row.note}</p>
            </div>
            <span className="mono text-[13px] text-emerald-400 flex-shrink-0">
              {row.credits} cr
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Success Banner ────────────────────────────────────────────────────────────

function SuccessBanner({ sessionId }: { sessionId: string }) {
  const [info, setInfo] = useState<{ email?: string; plan?: string; credits?: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/stripe/verify?session_id=${sessionId}`)
      .then((r) => r.json())
      .then((d) => setInfo(d.ok ? d : null))
      .catch(() => setInfo(null))
      .finally(() => setLoading(false));
  }, [sessionId]);

  if (loading) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto mb-10 max-w-xl rounded-2xl border border-emerald-500/40 bg-emerald-950/40 px-6 py-5 text-center"
    >
      <p className="text-2xl mb-1">🎉</p>
      <p className="font-semibold text-white">Credits added to your account!</p>
      {info?.email && (
        <p className="mt-1 text-sm text-white/60">
          Receipt sent to <span className="text-white">{info.email}</span>
        </p>
      )}
      {info?.credits != null && (
        <p className="mt-1 text-sm text-emerald-400 font-semibold">
          Balance: {info.credits.toLocaleString()} credits
        </p>
      )}
      <p className="mt-3 text-sm text-white/50">
        Go to{" "}
        <a href="/chat" className="text-emerald-400 underline underline-offset-2">
          /chat
        </a>{" "}
        and enter your email to start using your credits.
      </p>
      {info?.email && (
        <div className="mt-4">
          <ManageSubscriptionButton email={info.email} />
        </div>
      )}
    </motion.div>
  );
}

function CanceledBanner() {
  return (
    <motion.div
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto mb-10 max-w-xl rounded-2xl border border-white/10 bg-white/5 px-6 py-4 text-center text-sm text-white/50"
    >
      Checkout was canceled — no charge was made. Pick a plan below whenever you&apos;re ready.
    </motion.div>
  );
}

// ── Section header ────────────────────────────────────────────────────────────

function SectionHeader({ label, sub }: { label: string; sub: string }) {
  return (
    <div className="mb-8 text-center">
      <p className="mono text-[10px] tracking-[0.18em] uppercase text-white/30 mb-2">{label}</p>
      <p className="text-white/50 text-sm">{sub}</p>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

function PricingContent() {
  const params    = useSearchParams();
  const success   = params.get("success") === "true";
  const canceled  = params.get("canceled") === "true";
  const sessionId = params.get("session_id") ?? "";

  return (
    <main className="min-h-screen bg-black px-4 py-20">
      {/* Header */}
      <div className="mx-auto mb-14 max-w-2xl text-center">
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-4xl font-bold text-white mb-4"
        >
          Pay for what you use.
          <br />
          <span className="text-emerald-400">Nothing more.</span>
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-white/50 text-lg leading-relaxed"
        >
          Credits are charged per query based on which pipeline runs.
          One-time packs never expire. Max plans reset monthly with rollover.
        </motion.p>
      </div>

      {/* Banners */}
      {success && sessionId && <SuccessBanner sessionId={sessionId} />}
      {canceled && <CanceledBanner />}

      {/* ── Free plan ── */}
      <div className="mx-auto max-w-sm mb-16">
        <SectionHeader label="Start free" sub="No card required. 50 credits auto-reset on the 1st of each month." />
        <PricingCard plan={FREE_PLAN} />
      </div>

      {/* ── Pro packs ── */}
      <div className="mx-auto max-w-5xl mb-16">
        <SectionHeader
          label="Pro — one-time packs"
          sub="Credits never expire. Top up whenever you need more. Max $24 for a single pack."
        />
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {PRO_PACKS.map((plan, i) => (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
            >
              <PricingCard plan={plan} />
            </motion.div>
          ))}
        </div>
      </div>

      {/* ── Max subscriptions ── */}
      <div className="mx-auto max-w-2xl mb-12">
        <SectionHeader
          label="Max — monthly subscription"
          sub="Full monthly credit allocation with 25 % rollover. Cancel anytime — credits remain."
        />
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          {MAX_PLANS.map((plan, i) => (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
            >
              <PricingCard plan={plan} />
            </motion.div>
          ))}
        </div>
      </div>

      {/* Credit cost table */}
      <CreditCosts />

      {/* Trust strip */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="mx-auto mt-16 max-w-2xl"
      >
        <div className="flex flex-wrap items-center justify-center gap-8 text-xs text-white/25">
          <span>🔒 Secured by Stripe</span>
          <span>↩ One-time packs never expire</span>
          <span>📎 Every claim cited</span>
          <span>🚫 No hallucinated data</span>
        </div>
      </motion.div>

      {/* Back nav */}
      <div className="mt-12 text-center">
        <a
          href="/"
          className="text-sm text-white/30 hover:text-white/60 transition-colors underline underline-offset-4"
        >
          ← Back to Conviqt
        </a>
      </div>
    </main>
  );
}

export default function PricingPage() {
  return (
    <Suspense fallback={null}>
      <PricingContent />
    </Suspense>
  );
}
