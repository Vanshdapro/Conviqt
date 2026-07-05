"use client";

// /pricing — the subscription model (Phase 7, playbook 2.4; pricing updated
// 2026-06-14 by founder call).
//
// Two plans, month-to-month only — no annual billing, no packs, no credit math:
//   Free — 5 deep analyses/mo + quick takes + Academy fundamentals + the full
//          public track record (transparency is free, always).
//   Pro  — $8/month, month to month · 7-day free trial.
//
// Soft sell only: clear prices, cancel-anytime copy, and a FAQ that answers the
// real questions. Nothing counts down, nothing guilts.

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { track } from "@/lib/analytics/track";
import { isSignupPromoActive } from "@/lib/promo";

const PRO_FEATURES = [
  "Unlimited deep analyses — fair use, no monthly cap",
  "Every skill open: Face-Off, Sector Pulse, Headline Decoder…",
  "Portfolio tools + AI Health Check on what you own",
  "Full Academy — all 11 tracks and 100 lessons",
  "Priority speed — your runs go first",
];

const FREE_FEATURES = [
  "5 deep analyses every month",
  "Quick takes on any ticker",
  "Dashboard + Headlines, refreshed twice a day",
  "Our full public track record — losses included",
  "Academy fundamentals",
];

const FAQ: Array<{ q: string; a: string }> = [
  {
    q: "Is this financial advice?",
    a: "No. Conviqt is a research and education tool. We show you what the data says and teach you what it means — what you do with it is yours. Markets involve risk.",
  },
  {
    q: "What does \"fair use\" mean?",
    a: "Use Conviqt as much as a person reasonably can. The limit exists only to stop bots and scripts — no real reader has ever hit it.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes — two taps from your account menu, no email, no phone call. Cancel during the trial and you won't be charged at all.",
  },
  {
    q: "What's actually free, forever?",
    a: "Our entire public track record, the Dashboard, Headlines, quick takes, and 5 full deep analyses a month. Transparency is free, always — that's the point of it.",
  },
];

function CheckIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="m5 12.5 4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PricingInner() {
  const params = useSearchParams();
  const success = params.get("success") === "true";
  const canceled = params.get("canceled") === "true";
  const sessionId = params.get("session_id");

  const [plan, setPlan] = useState<"free" | "pro" | null>(null); // null = logged out / unknown
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/profile")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive) return;
        if (d && typeof d.plan === "string") {
          setAuthed(true);
          setPlan(d.plan === "pro" ? "pro" : "free");
        } else {
          setAuthed(false);
        }
      })
      .catch(() => alive && setAuthed(false));
    return () => {
      alive = false;
    };
  }, [success]);

  // Returning from checkout: confirm the session server-side (webhook fallback).
  useEffect(() => {
    if (!success || !sessionId) return;
    fetch(`/api/stripe/verify?session_id=${encodeURIComponent(sessionId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.proActive) setPlan("pro");
      })
      .catch(() => null);
  }, [success, sessionId]);

  async function startCheckout() {
    if (authed === false) {
      window.location.href = "/signup?next=/pricing";
      return;
    }
    setBusy(true);
    setNotice(null);
    track("checkout_start", { plan: "pro_monthly" });
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: "pro_monthly" }),
      });
      const d = await res.json().catch(() => null);
      if (res.status === 401) {
        window.location.href = "/signup?next=/pricing";
        return;
      }
      if (res.ok && d?.url) {
        window.location.href = d.url as string;
        return;
      }
      setNotice(
        res.status === 503
          ? "Payments are almost ready — check back in a little while."
          : "Checkout couldn't start. Try again in a moment."
      );
    } catch {
      setNotice("Checkout couldn't start. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function openPortal() {
    setBusy(true);
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const d = await res.json().catch(() => null);
      if (d?.url) {
        window.location.href = d.url as string;
        return;
      }
      setNotice("Couldn't open billing right now. Try again in a moment.");
    } catch {
      setNotice("Couldn't open billing right now. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  const isPro = plan === "pro";
  // Signup-week promo audience: only people who haven't signed up yet — an
  // existing free-plan user's account necessarily predates the window
  // (otherwise the server-side grant would already show them as Pro).
  const showSignupPromo = isSignupPromoActive() && authed === false;

  return (
    <div className="cvq-price-page">
      <header className="cvq-price-top">
        <Link href="/" className="cvq-wordmark">
          CONVI<span className="cvq-wordmark-tick">Q</span>T
        </Link>
        <Link href="/research" className="cvq-btn cvq-btn--secondary">
          Open the app
        </Link>
      </header>

      <main className="cvq-price-main">
        {success && (
          <div className="cvq-price-banner cvq-price-banner--good" role="status">
            {isPro
              ? "Your free week of Pro has started. Everything is open — enjoy."
              : "Payment received — your account is updating. Give it a few seconds and refresh."}
          </div>
        )}
        {canceled && (
          <div className="cvq-price-banner" role="status">
            Checkout canceled — nothing was charged.
          </div>
        )}

        <h1 className="cvq-price-h1">Simple pricing. No surprises.</h1>
        <p className="cvq-price-sub">
          Start free. Upgrade when you want more. Month to month — cancel anytime, it takes two taps.
        </p>

        <div className="cvq-price-grid">
          {/* Free */}
          <section className="cvq-price-card" aria-label="Free plan">
            <h2>Free</h2>
            <p className="cvq-price-amount">
              $0 <span>forever</span>
            </p>
            <p className="cvq-price-tag">Real research, on the house.</p>
            <ul className="cvq-price-list">
              {FREE_FEATURES.map((f) => (
                <li key={f}>
                  <CheckIcon />
                  {f}
                </li>
              ))}
            </ul>
            {authed === false ? (
              <Link href="/signup" className="cvq-btn cvq-btn--secondary cvq-price-cta">
                Start free
              </Link>
            ) : (
              <span className="cvq-price-current">
                {isPro ? "Included in Pro" : "Your current plan"}
              </span>
            )}
          </section>

          {/* Pro */}
          <section className="cvq-price-card cvq-price-card--pro" aria-label="Pro plan">
            <span className="cvq-price-badge cvq-price-badge--offer">
              {showSignupPromo ? "Free first month · new signups only" : "50% off · Limited time"}
            </span>
            <h2>Pro</h2>
            <p className="cvq-price-amount">
              {showSignupPromo ? (
                <>$0 <span>first month, then $4/mo</span></>
              ) : (
                <>
                  <s className="cvq-price-was">$8</s>
                  {" "}$4 <span>/ month</span>
                </>
              )}
            </p>
            <p className="cvq-price-tag">
              {showSignupPromo
                ? "Sign up by Jul 12 and your first month is completely free — no card needed."
                : "Limited-time offer. Billed monthly — cancel anytime."}
            </p>
            <ul className="cvq-price-list">
              {PRO_FEATURES.map((f) => (
                <li key={f}>
                  <CheckIcon />
                  {f}
                </li>
              ))}
            </ul>
            {showSignupPromo ? (
              <Link href="/signup?next=/research" className="cvq-btn cvq-btn--primary cvq-price-cta">
                Sign up — first month free
              </Link>
            ) : isPro ? (
              <button type="button" className="cvq-btn cvq-btn--secondary cvq-price-cta" onClick={openPortal} disabled={busy}>
                Manage subscription
              </button>
            ) : (
              <button type="button" className="cvq-btn cvq-btn--primary cvq-price-cta" onClick={startCheckout} disabled={busy}>
                {busy ? "Opening checkout…" : "Try Pro free for 7 days"}
              </button>
            )}
            <p className="cvq-price-fine">
              {showSignupPromo
                ? "No card needed. After your free month, Pro is $4/mo — cancel anytime."
                : "Cancel during the trial and you won't be charged."}
            </p>
          </section>
        </div>

        {notice && (
          <p className="cvq-price-notice" role="status">
            {notice}
          </p>
        )}

        <section className="cvq-price-faq" aria-label="Common questions">
          <h2>Fair questions</h2>
          {FAQ.map((item) => (
            <details key={item.q}>
              <summary>{item.q}</summary>
              <p>{item.a}</p>
            </details>
          ))}
        </section>

        <p className="cvq-disclaimer" style={{ textAlign: "center" }}>
          Conviqt is a research and education tool, not a licensed financial adviser. Nothing here is
          financial advice. Markets involve risk.
        </p>
      </main>
    </div>
  );
}

export default function PricingPage() {
  return (
    <Suspense fallback={null}>
      <PricingInner />
    </Suspense>
  );
}
