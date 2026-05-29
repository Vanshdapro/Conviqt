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

  if (plan.kind === "free") {
    return <FreeCard plan={plan} />;
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
      if (res.status === 401 || data.error === "auth_required") {
        window.location.href = "/signup?next=/pricing";
        return;
      }
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
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        height: "100%",
        borderRadius: 14,
        background: plan.highlighted ? "rgba(10,19,35,0.88)" : "rgba(10,19,35,0.5)",
        backdropFilter: "blur(18px)",
        WebkitBackdropFilter: "blur(18px)",
        border: `1px solid ${plan.highlighted ? "rgba(232,237,248,0.18)" : "rgba(232,237,248,0.07)"}`,
        padding: "28px 24px",
        overflow: "hidden",
      }}
    >
      {/* Subtle top line for highlighted */}
      {plan.highlighted && (
        <div style={{
          position: "absolute",
          top: 0, left: 0, right: 0, height: 1,
          background: "linear-gradient(90deg, transparent, rgba(140,200,255,0.5), transparent)",
        }} />
      )}

      {/* Badge */}
      {plan.badge && (
        <div style={{ position: "absolute", top: -1, right: 18 }}>
          <span style={{
            display: "inline-flex",
            alignItems: "center",
            background: "rgba(10,19,35,0.95)",
            border: "1px solid rgba(232,237,248,0.14)",
            borderRadius: 999,
            padding: "3px 12px",
            fontFamily: "var(--font-serif), Georgia, serif",
            fontSize: 10,
            letterSpacing: "0.14em",
            textTransform: "uppercase" as const,
            color: "rgba(140,200,255,0.8)",
          }}>
            {plan.badge}
          </span>
        </div>
      )}

      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <h3 style={{
            fontFamily: "var(--font-display), Georgia, serif",
            fontWeight: 500,
            fontSize: "16px",
            letterSpacing: "-0.02em",
            color: "#e8edf8",
            margin: 0,
          }}>
            {plan.name}
          </h3>
          <CreditPill credits={plan.credits} kind={plan.kind} />
        </div>
        <p style={{
          fontFamily: "var(--font-serif), Georgia, serif",
          fontSize: "13px",
          color: "rgba(232,237,248,0.45)",
          lineHeight: 1.55,
          letterSpacing: "0.01em",
          margin: 0,
        }}>
          {plan.description}
        </p>
      </div>

      {/* Price */}
      <div style={{ marginBottom: 24 }}>
        <span style={{
          fontFamily: "var(--font-display), Georgia, serif",
          fontWeight: 500,
          fontSize: "40px",
          letterSpacing: "-0.03em",
          color: "#e8edf8",
          lineHeight: 1,
        }}>
          {plan.price}
        </span>
        <span style={{
          marginLeft: 8,
          fontFamily: "var(--font-serif), Georgia, serif",
          fontSize: "13px",
          color: "rgba(232,237,248,0.38)",
          letterSpacing: "0.02em",
        }}>
          {plan.period}
        </span>
      </div>

      {/* Features */}
      <ul style={{
        flex: 1,
        listStyle: "none",
        padding: 0,
        margin: "0 0 24px 0",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}>
        {plan.features.map((feature, i) => (
          <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
            <svg
              viewBox="0 0 16 16"
              fill="none"
              style={{
                width: 13,
                height: 13,
                flexShrink: 0,
                marginTop: 2,
                color: plan.highlighted ? "rgba(140,200,255,0.7)" : "rgba(232,237,248,0.25)",
              }}
            >
              <path
                d="M3 8l3.5 3.5L13 5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span style={{
              fontFamily: "var(--font-serif), Georgia, serif",
              fontSize: "13px",
              color: "rgba(232,237,248,0.6)",
              lineHeight: 1.55,
              letterSpacing: "0.01em",
            }}>
              {feature}
            </span>
          </li>
        ))}
      </ul>

      {/* CTA */}
      <button
        onClick={handleCheckout}
        disabled={loading}
        style={{
          width: "100%",
          borderRadius: 100,
          padding: "11px 20px",
          fontFamily: "var(--font-serif), Georgia, serif",
          fontSize: "11px",
          letterSpacing: "0.14em",
          textTransform: "uppercase" as const,
          cursor: loading ? "not-allowed" : "pointer",
          opacity: loading ? 0.55 : 1,
          transition: "opacity 0.2s, border-color 0.2s",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          background: "transparent",
          color: "#e8edf8",
          border: `1px solid ${plan.highlighted ? "rgba(232,237,248,0.6)" : "rgba(232,237,248,0.22)"}`,
        }}
      >
        {loading ? (
          <>
            <SpinnerIcon style={{ width: 13, height: 13 }} />
            Redirecting…
          </>
        ) : (
          <>
            {plan.cta}
            <span style={{ fontSize: "18px", lineHeight: "0" }}>•</span>
          </>
        )}
      </button>

      {error && (
        <p style={{
          marginTop: 10,
          textAlign: "center",
          fontFamily: "var(--font-serif), Georgia, serif",
          fontSize: "12px",
          color: "rgba(239,68,68,0.8)",
          letterSpacing: "0.01em",
        }}>
          {error}
        </p>
      )}
    </motion.div>
  );
}

// ── Free card ─────────────────────────────────────────────────────────────────

function FreeCard({ plan }: { plan: PricingPlan }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        borderRadius: 14,
        background: "rgba(10,19,35,0.5)",
        backdropFilter: "blur(18px)",
        WebkitBackdropFilter: "blur(18px)",
        border: "1px solid rgba(232,237,248,0.07)",
        padding: "28px 24px",
      }}
    >
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <h3 style={{
            fontFamily: "var(--font-display), Georgia, serif",
            fontWeight: 500,
            fontSize: "16px",
            letterSpacing: "-0.02em",
            color: "#e8edf8",
            margin: 0,
          }}>
            {plan.name}
          </h3>
          <CreditPill credits={plan.credits} kind="free" />
        </div>
        <p style={{
          fontFamily: "var(--font-serif), Georgia, serif",
          fontSize: "13px",
          color: "rgba(232,237,248,0.45)",
          lineHeight: 1.55,
          letterSpacing: "0.01em",
          margin: 0,
        }}>
          {plan.description}
        </p>
      </div>

      <div style={{ marginBottom: 24 }}>
        <span style={{
          fontFamily: "var(--font-display), Georgia, serif",
          fontWeight: 500,
          fontSize: "40px",
          letterSpacing: "-0.03em",
          color: "#e8edf8",
          lineHeight: 1,
        }}>
          {plan.price}
        </span>
        <span style={{
          marginLeft: 8,
          fontFamily: "var(--font-serif), Georgia, serif",
          fontSize: "13px",
          color: "rgba(232,237,248,0.38)",
          letterSpacing: "0.02em",
        }}>
          {plan.period}
        </span>
      </div>

      <ul style={{
        flex: 1,
        listStyle: "none",
        padding: 0,
        margin: "0 0 24px 0",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}>
        {plan.features.map((feature, i) => (
          <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
            <svg
              viewBox="0 0 16 16"
              fill="none"
              style={{ width: 13, height: 13, flexShrink: 0, marginTop: 2, color: "rgba(232,237,248,0.25)" }}
            >
              <path
                d="M3 8l3.5 3.5L13 5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span style={{
              fontFamily: "var(--font-serif), Georgia, serif",
              fontSize: "13px",
              color: "rgba(232,237,248,0.6)",
              lineHeight: 1.55,
              letterSpacing: "0.01em",
            }}>
              {feature}
            </span>
          </li>
        ))}
      </ul>

      <a
        href="/chat"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          textAlign: "center",
          borderRadius: 100,
          padding: "11px 20px",
          fontFamily: "var(--font-serif), Georgia, serif",
          fontSize: "11px",
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "#e8edf8",
          background: "transparent",
          border: "1px solid rgba(232,237,248,0.22)",
          textDecoration: "none",
          transition: "border-color 0.2s",
        }}
      >
        {plan.cta}
        <span style={{ fontSize: "18px", lineHeight: "0" }}>•</span>
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
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      borderRadius: 999,
      background: "transparent",
      border: "1px solid rgba(232,237,248,0.12)",
      padding: "2px 10px",
      fontFamily: "var(--font-mono), 'JetBrains Mono', monospace",
      fontSize: "10px",
      letterSpacing: "0.06em",
      color: "rgba(232,237,248,0.38)",
    }}>
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
        style={{
          borderRadius: 100,
          border: "1px solid rgba(232,237,248,0.22)",
          background: "transparent",
          padding: "10px 24px",
          fontFamily: "var(--font-serif), Georgia, serif",
          fontSize: "11px",
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "#e8edf8",
          cursor: loading ? "not-allowed" : "pointer",
          opacity: loading ? 0.55 : 1,
          transition: "opacity 0.2s",
        }}
      >
        {loading ? "Opening portal…" : "Manage subscription"}
      </button>
      {error && (
        <p style={{
          marginTop: 8,
          fontFamily: "var(--font-serif), Georgia, serif",
          fontSize: "12px",
          color: "rgba(239,68,68,0.8)",
        }}>
          {error}
        </p>
      )}
    </div>
  );
}

// ── Spinner ───────────────────────────────────────────────────────────────────

function SpinnerIcon({ style }: { style?: React.CSSProperties }) {
  return (
    <svg style={style} viewBox="0 0 24 24" fill="none">
      <circle
        cx="12" cy="12" r="10"
        stroke="currentColor" strokeWidth="2.5"
        strokeLinecap="round" strokeDasharray="31.416" strokeDashoffset="10"
        opacity="0.3"
      />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}
