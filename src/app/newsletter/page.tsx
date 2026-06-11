"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useSearchParams } from "next/navigation";

// The public home of the Disagreement Digest (Deliverable 6). Subscribe form
// posts to /api/newsletter/subscribe (double opt-in); the confirm + unsubscribe
// routes redirect back here with ?status=… which we surface as a banner.

const ACCENT = "#4f87f7";
const INK = "#e8edf8";

type SubmitState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "done"; message: string }
  | { kind: "error"; message: string };

// ── Status banner (from confirm / unsubscribe redirects) ────────────────────

const STATUS_COPY: Record<
  string,
  { tone: "good" | "bad"; title: string; body: string }
> = {
  confirmed: {
    tone: "good",
    title: "You're in.",
    body: "Your subscription is confirmed. The next issue lands Monday morning.",
  },
  unsubscribed: {
    tone: "good",
    title: "You've been unsubscribed.",
    body: "You won't receive any more issues. No hard feelings — resubscribe below any time.",
  },
  invalid: {
    tone: "bad",
    title: "That link didn't work.",
    body: "The link may have expired or already been used. Enter your email below to get a fresh one.",
  },
  error: {
    tone: "bad",
    title: "Something went wrong.",
    body: "We couldn't process that link. Try again, or re-enter your email below.",
  },
};

function StatusBanner({ status }: { status: string }) {
  const copy = STATUS_COPY[status];
  if (!copy) return null;
  const good = copy.tone === "good";
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      style={{
        background: good ? "rgba(52,211,153,0.08)" : "rgba(248,113,113,0.08)",
        border: `1px solid ${good ? "rgba(52,211,153,0.3)" : "rgba(248,113,113,0.3)"}`,
        borderRadius: 12,
        padding: "16px 20px",
        marginBottom: 36,
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-display), Georgia, serif",
          fontSize: 15,
          color: good ? "#5eecb3" : "#fca5a5",
          marginBottom: 4,
        }}
      >
        {copy.title}
      </div>
      <div
        style={{
          fontFamily: "var(--font-serif), Georgia, serif",
          fontSize: 13,
          lineHeight: 1.6,
          color: "rgba(232,237,248,0.62)",
        }}
      >
        {copy.body}
      </div>
    </motion.div>
  );
}

// ── Subscribe form ──────────────────────────────────────────────────────────

function SubscribeForm() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<SubmitState>({ kind: "idle" });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (state.kind === "loading") return;
    setState({ kind: "loading" });

    try {
      const res = await fetch("/api/newsletter/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), source: "newsletter_page" }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        status?: string;
        message?: string;
        error?: string;
      };

      if (!res.ok || !data.ok) {
        setState({
          kind: "error",
          message: data.error || "Couldn't sign you up — try again shortly.",
        });
        return;
      }

      setState({
        kind: "done",
        message:
          data.status === "already_subscribed"
            ? "You're already on the list — see you Monday."
            : "Check your inbox to confirm your subscription.",
      });
      setEmail("");
    } catch {
      setState({ kind: "error", message: "Network error — check your connection and try again." });
    }
  }

  const loading = state.kind === "loading";

  if (state.kind === "done") {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        style={{
          background: "rgba(79,135,247,0.06)",
          border: "1px solid rgba(79,135,247,0.25)",
          borderRadius: 14,
          padding: "22px 24px",
          display: "flex",
          alignItems: "center",
          gap: 14,
        }}
      >
        <span
          style={{
            flexShrink: 0,
            width: 34,
            height: 34,
            borderRadius: "50%",
            background: "rgba(79,135,247,0.16)",
            border: "1px solid rgba(79,135,247,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#9cc0ff",
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <span
          style={{
            fontFamily: "var(--font-serif), Georgia, serif",
            fontSize: 15,
            color: INK,
            lineHeight: 1.5,
          }}
        >
          {state.message}
        </span>
      </motion.div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="nl-form-row" style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (state.kind === "error") setState({ kind: "idle" });
          }}
          placeholder="you@email.com"
          autoComplete="email"
          aria-label="Email address"
          style={{
            flex: "1 1 240px",
            minWidth: 0,
            background: "rgba(232,237,248,0.04)",
            border: "1px solid rgba(232,237,248,0.14)",
            borderRadius: 100,
            padding: "14px 22px",
            fontFamily: "var(--font-serif), Georgia, serif",
            fontSize: 15,
            color: INK,
            outline: "none",
          }}
        />
        <button
          type="submit"
          disabled={loading}
          style={{
            flexShrink: 0,
            background: ACCENT,
            color: "#06101f",
            border: "none",
            borderRadius: 100,
            padding: "14px 30px",
            fontFamily: "var(--font-sans), system-ui, sans-serif",
            fontSize: 14,
            fontWeight: 600,
            letterSpacing: "0.02em",
            cursor: loading ? "default" : "pointer",
            opacity: loading ? 0.6 : 1,
            transition: "opacity .15s ease",
          }}
        >
          {loading ? "Signing up…" : "Subscribe free →"}
        </button>
      </div>

      {state.kind === "error" && (
        <p
          style={{
            fontFamily: "var(--font-sans), system-ui, sans-serif",
            fontSize: 12.5,
            color: "#f87171",
            margin: "12px 4px 0",
          }}
        >
          {state.message}
        </p>
      )}

      <p
        style={{
          fontFamily: "var(--font-serif), Georgia, serif",
          fontSize: 12,
          color: "rgba(232,237,248,0.4)",
          margin: "14px 4px 0",
          lineHeight: 1.6,
        }}
      >
        Free forever · One email a week · Double opt-in · Unsubscribe in one click.
      </p>
    </form>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

const WHAT_YOU_GET = [
  {
    label: "The 5 most contested",
    body: "Each Monday, the five stocks the Council's AI analysts split on hardest last week — ranked by disagreement score, not by hype.",
  },
  {
    label: "The crux of each fight",
    body: "One sharp line per stock on exactly what the bulls and bears can't reconcile. The disagreement is the signal.",
  },
  {
    label: "A link to the full analysis",
    body: "Every issue links straight to the cited Council report, where each number carries the source URL it came from.",
  },
];

function NewsletterInner() {
  const params = useSearchParams();
  const status = params.get("status") ?? "";

  return (
    <div style={{ minHeight: "100vh", background: "#050d1a", overflowX: "hidden" }}>

      <main style={{ maxWidth: 720, margin: "0 auto", padding: "60px 24px 100px" }}>
        {status && <StatusBanner status={status} />}

        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
            <div style={{ height: 1, width: 32, background: "rgba(232,237,248,0.2)" }} />
            <span
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 11,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "rgba(232,237,248,0.45)",
              }}
            >
              Free weekly newsletter
            </span>
          </div>
          <h1
            style={{
              fontFamily: "var(--font-display), Georgia, serif",
              fontWeight: 600,
              fontSize: "clamp(34px, 5vw, 56px)",
              letterSpacing: "-0.02em",
              lineHeight: 1.1,
              color: INK,
              margin: "0 0 20px",
            }}
          >
            The Disagreement Digest
          </h1>
          <p
            style={{
              fontFamily: "var(--font-serif), Georgia, serif",
              fontSize: 17,
              color: "rgba(232,237,248,0.6)",
              lineHeight: 1.7,
              margin: "0 0 36px",
              maxWidth: 560,
            }}
          >
            Every Monday, the five stocks Conviqt&apos;s AI research council fractured on hardest —
            and the one thing the bulls and bears can&apos;t agree on. No price targets, no hype.
            We report where smart analysts diverge, because that&apos;s where the real questions are.
          </p>
        </motion.div>

        {/* Subscribe */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15 }}
          style={{ marginBottom: 56 }}
        >
          <SubscribeForm />
        </motion.div>

        {/* What you get */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
        >
          <div
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 10,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "rgba(232,237,248,0.3)",
              marginBottom: 22,
            }}
          >
            What lands in your inbox
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {WHAT_YOU_GET.map((item, i) => (
              <motion.div
                key={item.label}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.5, delay: i * 0.08 }}
                style={{
                  background: "rgba(10,19,35,0.5)",
                  border: "1px solid rgba(232,237,248,0.06)",
                  borderLeft: `2px solid ${ACCENT}`,
                  borderRadius: 12,
                  padding: "20px 24px",
                  display: "grid",
                  gridTemplateColumns: "minmax(150px, 190px) 1fr",
                  gap: 24,
                  alignItems: "start",
                }}
                className="nl-feature"
              >
                <div
                  style={{
                    fontFamily: "var(--font-display), Georgia, serif",
                    fontWeight: 500,
                    fontSize: 15,
                    color: INK,
                    letterSpacing: "-0.01em",
                  }}
                >
                  {item.label}
                </div>
                <p
                  style={{
                    fontFamily: "var(--font-serif), Georgia, serif",
                    fontSize: 13.5,
                    color: "rgba(232,237,248,0.55)",
                    lineHeight: 1.7,
                    margin: 0,
                  }}
                >
                  {item.body}
                </p>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* See it live */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.6 }}
          style={{ marginTop: 44, textAlign: "center" }}
        >
          <Link
            href="/cdi"
            style={{
              fontFamily: "var(--font-serif), Georgia, serif",
              fontSize: 14,
              color: "#7aa6f9",
              textDecoration: "none",
              borderBottom: "1px solid rgba(122,166,249,0.3)",
              paddingBottom: 2,
            }}
          >
            See this week&apos;s live Disagreement Index →
          </Link>
        </motion.div>

        {/* Legal */}
        <p
          style={{
            fontFamily: "var(--font-serif), Georgia, serif",
            fontSize: 11.5,
            color: "rgba(232,237,248,0.32)",
            lineHeight: 1.7,
            margin: "56px 0 0",
            textAlign: "center",
            maxWidth: 520,
            marginLeft: "auto",
            marginRight: "auto",
          }}
        >
          The Disagreement Digest contains AI-generated research for educational purposes only — it
          is not personalized financial advice. Conviqt never claims to beat the market; we publish
          transparency, not alpha.
        </p>
      </main>

      <style>{`
        @media (max-width: 560px) {
          .nl-feature { grid-template-columns: 1fr !important; gap: 8px !important; }
        }
      `}</style>
    </div>
  );
}

export default function NewsletterPage() {
  return (
    <Suspense fallback={null}>
      <NewsletterInner />
    </Suspense>
  );
}
