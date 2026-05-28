"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export function DashNav({ active }: { active?: "chat" | "alpha" | "methodology" | "pricing" }) {
  const links = [
    { label: "Research", href: "/chat",        key: "chat"        as const },
    { label: "Alpha",    href: "/alpha",       key: "alpha"       as const },
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

      {/* Right side: credit badge (if email stored) + CTA */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <CreditBadge />
        <Link
          href="/chat"
          style={{
            fontFamily:    "var(--font-serif), Georgia, serif",
            fontSize:      "11px",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color:         "#e8edf8",
            background:    "transparent",
            border:        "1px solid rgba(232,237,248,0.6)",
            borderRadius:  "100px",
            padding:       "11px 26px",
            display:       "flex",
            alignItems:    "center",
            gap:           "9px",
            textDecoration:"none",
          }}
        >
          Analyze a Stock{" "}
          <span style={{ fontSize: "18px", lineHeight: "0" }}>•</span>
        </Link>
      </div>
    </nav>
  );
}

// ── Credit badge ──────────────────────────────────────────────────────────────
// Shows "X credits" for users who have stored their email in localStorage.

function CreditBadge() {
  const [credits, setCredits] = useState<number | null>(null);

  useEffect(() => {
    const email = localStorage.getItem("conviqt_email");
    if (!email) return;

    fetch(`/api/credits?email=${encodeURIComponent(email)}`)
      .then((r) => r.json())
      .then((d) => {
        if (typeof d.credits === "number") setCredits(d.credits);
      })
      .catch(() => null);
  }, []);

  if (credits === null) return null;

  return (
    <Link
      href="/pricing"
      title="View pricing and top up"
      style={{
        display:       "flex",
        alignItems:    "center",
        gap:           "5px",
        background:    credits < 10 ? "rgba(239,68,68,0.12)" : "rgba(16,185,129,0.1)",
        border:        `1px solid ${credits < 10 ? "rgba(239,68,68,0.25)" : "rgba(16,185,129,0.25)"}`,
        borderRadius:  "100px",
        padding:       "5px 11px",
        textDecoration:"none",
        fontSize:      "11px",
        fontFamily:    "monospace",
        letterSpacing: "0.04em",
        color:         credits < 10 ? "#f87171" : "#34d399",
      }}
    >
      <span
        style={{
          display:      "inline-block",
          width:        "5px",
          height:       "5px",
          borderRadius: "50%",
          background:   credits < 10 ? "#f87171" : "#34d399",
          flexShrink:   0,
        }}
      />
      {credits.toLocaleString()} cr
    </Link>
  );
}
