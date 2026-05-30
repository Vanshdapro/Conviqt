"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export function DashNav({ active }: { active?: "chat" | "alpha" | "learn" | "methodology" | "pricing" }) {
  const links = [
    { label: "Research", href: "/chat",        key: "chat"        as const },
    { label: "Alpha",    href: "/alpha",       key: "alpha"       as const },
    { label: "Learn",    href: "/learn",       key: "learn"       as const },
    { label: "Pricing",  href: "/pricing",     key: "pricing"     as const },
    { label: "Method.",  href: "/methodology", key: "methodology" as const },
  ];

  return (
    <nav
      style={{
        display:              "flex",
        alignItems:           "center",
        justifyContent:       "space-between",
        padding:              "24px 52px",
        background:           "rgba(5,13,26,0.95)",
        backdropFilter:       "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderBottom:         "1px solid rgba(232,237,248,0.06)",
        position:             "sticky",
        top:                  0,
        zIndex:               50,
      }}
    >
      <Link
        href="/"
        style={{
          fontFamily:    "var(--font-display), Georgia, serif",
          fontWeight:    400,
          fontSize:      "17px",
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          color:         "#e8edf8",
          textDecoration:"none",
        }}
      >
        Conviqt
      </Link>

      <ul style={{ display: "flex", gap: "44px", listStyle: "none", padding: 0, margin: 0 }}>
        {links.map(({ label, href, key }) => (
          <li key={key}>
            <Link
              href={href}
              style={{
                fontFamily:    "var(--font-serif), Georgia, serif",
                fontSize:      "14px",
                letterSpacing: "0.04em",
                color:         "#e8edf8",
                textDecoration:"none",
                opacity:       key === active ? 1 : 0.78,
                borderBottom:  key === active ? "1px solid rgba(232,237,248,0.45)" : "none",
                paddingBottom: key === active ? "2px" : "0",
              }}
            >
              {label}
            </Link>
          </li>
        ))}
      </ul>

      {/* Right side: live credit balance + account */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <AccountControls />
      </div>
    </nav>
  );
}

// ── Credit badge + account ──────────────────────────────────────────────────
// Reads the logged-in user's balance/plan from the session-backed /api/credits.

function planLabel(plan: string): string {
  if (plan === "max_monthly") return "Max";
  if (plan === "max_pro_monthly") return "Max Pro";
  if (plan.startsWith("credits_")) return "Pro";
  return "Free";
}

function planMax(plan: string | null): number | null {
  if (!plan || plan === "free") return 50;
  if (plan === "max_monthly") return 4000;
  if (plan === "max_pro_monthly") return 7500;
  return null;
}

function AccountControls() {
  const [credits, setCredits] = useState<number | null>(null);
  const [plan, setPlan] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/credits")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d && typeof d.credits === "number") {
          setCredits(d.credits);
          setPlan(typeof d.plan === "string" ? d.plan : "free");
        }
      })
      .catch(() => null)
      .finally(() => setLoaded(true));
  }, []);

  if (loaded && credits === null) {
    return (
      <Link
        href="/login"
        style={{
          fontFamily: "var(--font-serif), Georgia, serif",
          fontSize: "11px",
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "#e8edf8",
          border: "1px solid rgba(232,237,248,0.6)",
          borderRadius: "100px",
          padding: "9px 22px",
          textDecoration: "none",
        }}
      >
        Sign in
      </Link>
    );
  }

  if (credits === null) return null;

  const isLow  = credits < 10;
  const max    = planMax(plan);
  const pct    = max !== null ? Math.max(0, Math.min(100, (credits / max) * 100)) : null;
  const isMid  = !isLow && pct !== null && pct < 35;
  const color  = isLow ? "#f87171" : isMid ? "#f59e0b" : "#34d399";
  const bgOpacity  = isLow ? "rgba(239,68,68,0.10)" : isMid ? "rgba(245,158,11,0.08)" : "rgba(16,185,129,0.08)";
  const bdrOpacity = isLow ? "rgba(239,68,68,0.22)" : isMid ? "rgba(245,158,11,0.2)" : "rgba(16,185,129,0.2)";

  return (
    <>
      <Link
        href="/pricing"
        title="View credits and pricing"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          background: bgOpacity,
          border: `1px solid ${bdrOpacity}`,
          borderRadius: "100px",
          padding: "5px 14px 5px 10px",
          textDecoration: "none",
        }}
      >
        {/* Mini progress bar */}
        {pct !== null && (
          <div style={{ width: 36, height: 3, background: "rgba(232,237,248,0.1)", borderRadius: 999, flexShrink: 0 }}>
            <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 999, transition: "width 0.4s ease" }} />
          </div>
        )}
        <span style={{ fontFamily: "monospace", fontSize: "11px", letterSpacing: "0.04em", color }}>
          {credits.toLocaleString()} cr
        </span>
        {plan && (
          <span style={{ fontFamily: "monospace", fontSize: "10px", color: "rgba(232,237,248,0.35)", letterSpacing: "0.04em" }}>
            {planLabel(plan)}
          </span>
        )}
      </Link>

      <form action="/auth/signout" method="post" style={{ margin: 0 }}>
        <button
          type="submit"
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: "10px",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "rgba(232,237,248,0.5)",
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: "4px 6px",
          }}
        >
          Sign out
        </button>
      </form>
    </>
  );
}
