"use client";

import { useState } from "react";
import { motion } from "framer-motion";

export interface PricingPlan {
  id:          string;
  kind:        "free" | "pack" | "subscription";
  name:        string;
  price:       string;
  period:      string;
  credits:     number;
  badge?:      string;
  description: string;
  features:    string[];
  cta:         string;
  highlighted?: boolean;
}

interface PricingCardProps {
  plan: PricingPlan;
}

export function PricingCard({ plan }: PricingCardProps) {
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  // Free plan — just link to chat
  if (plan.kind === "free") {
    return (
      <FreeCard plan={plan} />
    );
  }

  async function handleCheckout() {
    setLoading(true);
    setError(null);
    try {
      const res  = await fetch("/api/stripe/checkout", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ plan: plan.id }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className={`relative flex flex-col rounded-2xl border p-7 h-full ${
        plan.highlighted
          ? "border-emerald-500/60 bg-emerald-950/30 shadow-[0_0_40px_rgba(16,185,129,0.12)]"
          : "border-white/10 bg-white/[0.03]"
      }`}
    >
      {plan.badge && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="rounded-full bg-emerald-500 px-3 py-1 text-xs font-semibold text-black tracking-wide uppercase">
            {plan.badge}
          </span>
        </div>
      )}

      {/* Header */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-base font-semibold text-white">{plan.name}</h3>
          <CreditPill credits={plan.credits} kind={plan.kind} />
        </div>
        <p className="text-xs text-white/45 leading-relaxed">{plan.description}</p>
      </div>

      {/* Price */}
      <div className="mb-6">
        <span className="text-3xl font-bold text-white">{plan.price}</span>
        <span className="ml-1.5 text-sm text-white/40">{plan.period}</span>
      </div>

      {/* Features */}
      <ul className="mb-7 flex-1 space-y-2.5">
        {plan.features.map((feature, i) => (
          <li key={i} className="flex items-start gap-2.5 text-xs text-white/65">
            <CheckIcon
              className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${plan.highlighted ? "text-emerald-400" : "text-white/35"}`}
            />
            <span className="leading-snug">{feature}</span>
          </li>
        ))}
      </ul>

      {/* CTA */}
      <button
        onClick={handleCheckout}
        disabled={loading}
        className={`w-full rounded-xl py-2.5 px-5 text-sm font-semibold transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed ${
          plan.highlighted
            ? "bg-emerald-500 text-black hover:bg-emerald-400 shadow-lg shadow-emerald-500/20"
            : "bg-white/8 text-white hover:bg-white/15 border border-white/10"
        }`}
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <SpinnerIcon className="h-4 w-4 animate-spin" />
            Redirecting…
          </span>
        ) : (
          plan.cta
        )}
      </button>

      {error && <p className="mt-3 text-center text-xs text-red-400">{error}</p>}
    </motion.div>
  );
}

// ── Free card ─────────────────────────────────────────────────────────────────

function FreeCard({ plan }: { plan: PricingPlan }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="relative flex flex-col rounded-2xl border border-white/[0.08] bg-white/[0.02] p-7"
    >
      <div className="mb-5">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-base font-semibold text-white">{plan.name}</h3>
          <CreditPill credits={plan.credits} kind="free" />
        </div>
        <p className="text-xs text-white/45 leading-relaxed">{plan.description}</p>
      </div>

      <div className="mb-6">
        <span className="text-3xl font-bold text-white">{plan.price}</span>
        <span className="ml-1.5 text-sm text-white/40">{plan.period}</span>
      </div>

      <ul className="mb-7 flex-1 space-y-2.5">
        {plan.features.map((feature, i) => (
          <li key={i} className="flex items-start gap-2.5 text-xs text-white/65">
            <CheckIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-white/30" />
            <span className="leading-snug">{feature}</span>
          </li>
        ))}
      </ul>

      <a
        href="/chat"
        className="w-full rounded-xl py-2.5 px-5 text-sm font-semibold text-center bg-white/8 text-white hover:bg-white/15 border border-white/10 transition-colors block"
      >
        {plan.cta} →
      </a>
    </motion.div>
  );
}

// ── Credit pill ───────────────────────────────────────────────────────────────

function CreditPill({ credits, kind }: { credits: number; kind: PricingPlan["kind"] }) {
  const label =
    kind === "subscription"
      ? `${credits.toLocaleString()} cr/mo`
      : `${credits.toLocaleString()} cr`;

  return (
    <span className="rounded-full bg-white/[0.06] border border-white/[0.1] px-2 py-0.5 text-[10px] font-mono text-white/50">
      {label}
    </span>
  );
}

// ── Manage Subscription Button ────────────────────────────────────────────────

interface ManageButtonProps {
  email: string;
}

export function ManageSubscriptionButton({ email }: ManageButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  async function handlePortal() {
    setLoading(true);
    setError(null);
    try {
      const res  = await fetch("/api/stripe/portal", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        setError(data.error ?? "Could not open billing portal.");
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        onClick={handlePortal}
        disabled={loading}
        className="rounded-xl border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-medium text-white hover:bg-white/10 transition-colors disabled:opacity-60"
      >
        {loading ? "Opening portal…" : "Manage subscription"}
      </button>
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </div>
  );
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none">
      <path d="M3 8l3.5 3.5L13 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SpinnerIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeDasharray="31.416" strokeDashoffset="10" opacity="0.3" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
