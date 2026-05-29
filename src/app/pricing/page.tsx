"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { DashNav } from "@/components/DashNav";
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

// ── Section label ─────────────────────────────────────────────────────────────

function SectionLabel({ label }: { label: string }) {
  return (
    <p style={{
      fontFamily: "var(--font-serif), Georgia, serif",
      fontSize: "11px",
      letterSpacing: "0.24em",
      textTransform: "uppercase" as const,
      color: "rgba(140,200,255,0.72)",
      margin: "0 0 16px",
    }}>
      {label}
    </p>
  );
}

function SectionHeader({ label, sub }: { label: string; sub: string }) {
  return (
    <div style={{ textAlign: "center", marginBottom: 48 }}>
      <SectionLabel label={label} />
      <p style={{
        fontFamily: "var(--font-serif), Georgia, serif",
        fontSize: "14px",
        color: "rgba(232,237,248,0.5)",
        letterSpacing: "0.01em",
        lineHeight: 1.65,
        margin: 0,
        maxWidth: 480,
        marginLeft: "auto",
        marginRight: "auto",
      }}>
        {sub}
      </p>
    </div>
  );
}

// ── Credit cost table ─────────────────────────────────────────────────────────

function CreditCosts() {
  return (
    <div style={{ maxWidth: 560, margin: "0 auto" }}>
      <div style={{ textAlign: "center", marginBottom: 40 }}>
        <SectionLabel label="Credit costs per query" />
        <p style={{
          fontFamily: "var(--font-serif), Georgia, serif",
          fontSize: "14px",
          color: "rgba(232,237,248,0.5)",
          letterSpacing: "0.01em",
          lineHeight: 1.65,
          margin: 0,
        }}>
          Each action draws a fixed number of credits based on which pipeline stages run.
        </p>
      </div>
      <div style={{
        borderRadius: 14,
        background: "rgba(10,19,35,0.6)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        border: "1px solid rgba(232,237,248,0.07)",
        overflow: "hidden",
      }}>
        {[
          { action: "Full Council analysis", credits: 15, note: "6-agent debate, all sources cited" },
          { action: "Focused stock question", credits: 8,  note: "Targeted sweep + expert answer" },
          { action: "General analyst chat",  credits: 18, note: "Sonnet + live web search" },
          { action: "Cache hit (any)",       credits: 1,  note: "Same query within 4 hours" },
        ].map((row, i, arr) => (
          <div
            key={row.action}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 16,
              padding: "16px 22px",
              borderBottom: i < arr.length - 1 ? "1px solid rgba(232,237,248,0.06)" : "none",
            }}
          >
            <div>
              <p style={{
                fontFamily: "var(--font-serif), Georgia, serif",
                fontSize: "14px",
                color: "rgba(232,237,248,0.8)",
                margin: "0 0 2px",
                letterSpacing: "0.01em",
              }}>
                {row.action}
              </p>
              <p style={{
                fontFamily: "var(--font-serif), Georgia, serif",
                fontSize: "12px",
                color: "rgba(232,237,248,0.35)",
                margin: 0,
                letterSpacing: "0.01em",
              }}>
                {row.note}
              </p>
            </div>
            <span style={{
              fontFamily: "var(--font-mono), 'JetBrains Mono', monospace",
              fontSize: "13px",
              color: "rgba(140,200,255,0.85)",
              flexShrink: 0,
              fontVariantNumeric: "tabular-nums",
            }}>
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
      initial={{ opacity: 0, y: -14 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        maxWidth: 520,
        margin: "0 auto 48px",
        borderRadius: 14,
        border: "1px solid rgba(232,237,248,0.12)",
        background: "rgba(10,19,35,0.7)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        padding: "28px 32px",
        textAlign: "center",
      }}
    >
      <p style={{
        fontFamily: "var(--font-display), Georgia, serif",
        fontWeight: 500,
        fontSize: "20px",
        letterSpacing: "-0.01em",
        color: "#e8edf8",
        margin: "0 0 8px",
      }}>
        Credits added
      </p>
      {info?.email && (
        <p style={{
          fontFamily: "var(--font-serif), Georgia, serif",
          fontSize: "13px",
          color: "rgba(232,237,248,0.55)",
          margin: "0 0 4px",
          letterSpacing: "0.01em",
        }}>
          Receipt sent to <span style={{ color: "#e8edf8" }}>{info.email}</span>
        </p>
      )}
      {info?.credits != null && (
        <p style={{
          fontFamily: "var(--font-mono), monospace",
          fontSize: "13px",
          color: "rgba(140,200,255,0.85)",
          margin: "0 0 20px",
          letterSpacing: "0.04em",
        }}>
          Balance: {info.credits.toLocaleString()} credits
        </p>
      )}
      <p style={{
        fontFamily: "var(--font-serif), Georgia, serif",
        fontSize: "13px",
        color: "rgba(232,237,248,0.45)",
        margin: "0 0 20px",
        letterSpacing: "0.01em",
      }}>
        Go to{" "}
        <a href="/chat" style={{ color: "rgba(140,200,255,0.85)", textDecoration: "underline", textUnderlineOffset: 3 }}>
          /chat
        </a>{" "}
        and enter your email to start using your credits.
      </p>
      {info?.email && (
        <div style={{ display: "flex", justifyContent: "center" }}>
          <ManageSubscriptionButton email={info.email} />
        </div>
      )}
    </motion.div>
  );
}

function CanceledBanner() {
  return (
    <motion.div
      initial={{ opacity: 0, y: -14 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        maxWidth: 520,
        margin: "0 auto 48px",
        borderRadius: 14,
        border: "1px solid rgba(232,237,248,0.07)",
        background: "rgba(10,19,35,0.4)",
        padding: "16px 24px",
        textAlign: "center",
        fontFamily: "var(--font-serif), Georgia, serif",
        fontSize: "13px",
        color: "rgba(232,237,248,0.45)",
        letterSpacing: "0.01em",
      }}
    >
      Checkout was canceled — no charge was made. Pick a plan below whenever you&apos;re ready.
    </motion.div>
  );
}

// ── Divider ───────────────────────────────────────────────────────────────────

function Divider() {
  return (
    <div style={{
      maxWidth: 960,
      margin: "0 auto 80px",
      height: 1,
      background: "linear-gradient(90deg, transparent, rgba(232,237,248,0.08), transparent)",
    }} />
  );
}

// ── Trust strip ───────────────────────────────────────────────────────────────

function TrustStrip() {
  return (
    <div style={{
      maxWidth: 640,
      margin: "0 auto",
      display: "flex",
      flexWrap: "wrap" as const,
      alignItems: "center",
      justifyContent: "center",
      gap: "8px 36px",
    }}>
      {[
        "Secured by Stripe",
        "Packs never expire",
        "Every claim cited",
        "No hallucinated data",
      ].map((label) => (
        <span
          key={label}
          style={{
            fontFamily: "var(--font-serif), Georgia, serif",
            fontSize: "11px",
            letterSpacing: "0.08em",
            color: "rgba(232,237,248,0.28)",
          }}
        >
          {label}
        </span>
      ))}
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
    <div style={{ background: "#050d1a", minHeight: "100vh" }}>
      <DashNav active="pricing" />

      <main style={{ padding: "80px clamp(20px, 5vw, 80px) 0", position: "relative" }}>

        {/* ── Hero ── */}
        <div style={{ maxWidth: 700, margin: "0 auto 80px", textAlign: "center" }}>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          >
            <p style={{
              fontFamily: "var(--font-serif), Georgia, serif",
              fontSize: "11px",
              letterSpacing: "0.24em",
              textTransform: "uppercase",
              color: "rgba(140,200,255,0.72)",
              margin: "0 0 22px",
            }}>
              Simple pricing
            </p>

            <h1 style={{
              fontFamily: "var(--font-display), Georgia, serif",
              fontWeight: 500,
              fontSize: "clamp(40px, 5.5vw, 80px)",
              lineHeight: 1.06,
              letterSpacing: "-0.018em",
              color: "#e8edf8",
              margin: "0 0 8px",
            }}>
              Pay for what you use.
            </h1>

            <h1 style={{
              fontFamily: "var(--font-display), Georgia, serif",
              fontWeight: 500,
              fontSize: "clamp(40px, 5.5vw, 80px)",
              lineHeight: 1.06,
              letterSpacing: "-0.018em",
              margin: "0 0 28px",
              background: "linear-gradient(108deg, #6eb6ff 0%, #c084fc 38%, #f472b6 65%, #67e8f9 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}>
              Nothing more.
            </h1>

            <p style={{
              fontFamily: "var(--font-serif), Georgia, serif",
              fontSize: "clamp(15px, 1.4vw, 18px)",
              color: "rgba(232,237,248,0.55)",
              lineHeight: 1.72,
              letterSpacing: "0.015em",
              maxWidth: 500,
              margin: "0 auto",
            }}>
              Credits are charged per query based on which pipeline runs.
              One-time packs never expire. Max plans reset monthly with rollover.
            </p>
          </motion.div>
        </div>

        {/* Banners */}
        {success && sessionId && <SuccessBanner sessionId={sessionId} />}
        {canceled && <CanceledBanner />}

        {/* ── Free plan ── */}
        <section style={{ maxWidth: 400, margin: "0 auto 80px" }}>
          <SectionHeader
            label="Start free"
            sub="No card required. 50 credits auto-reset on the 1st of each month."
          />
          <PricingCard plan={FREE_PLAN} />
        </section>

        <Divider />

        {/* ── Pro packs ── */}
        <section style={{ maxWidth: 980, margin: "0 auto 80px" }}>
          <SectionHeader
            label="Pro — one-time packs"
            sub="Credits never expire. Top up whenever you need more. Max $24 for a single pack."
          />
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
            gap: 16,
          }}>
            {PRO_PACKS.map((plan, i) => (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.07, duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
                style={{ height: "100%" }}
              >
                <PricingCard plan={plan} />
              </motion.div>
            ))}
          </div>
        </section>

        <Divider />

        {/* ── Max subscriptions ── */}
        <section style={{ maxWidth: 700, margin: "0 auto 80px" }}>
          <SectionHeader
            label="Max — monthly subscription"
            sub="Full monthly credit allocation with 25 % rollover. Cancel anytime — credits remain."
          />
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 16,
          }}>
            {MAX_PLANS.map((plan, i) => (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.09, duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
              >
                <PricingCard plan={plan} />
              </motion.div>
            ))}
          </div>
        </section>

        <Divider />

        {/* ── Credit cost table ── */}
        <section style={{ marginBottom: 80 }}>
          <CreditCosts />
        </section>

        <Divider />

        {/* ── Trust strip ── */}
        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          style={{ paddingBottom: 80 }}
        >
          <TrustStrip />
        </motion.section>

      </main>
    </div>
  );
}

export default function PricingPage() {
  return (
    <Suspense fallback={null}>
      <PricingContent />
    </Suspense>
  );
}
