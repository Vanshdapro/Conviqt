"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export function DashNav({ active }: { active?: "research" | "alpha" | "academy" | "methodology" | "pricing" }) {
  const links = [
    { label: "Research", href: "/research",    key: "research"    as const },
    { label: "Alpha",    href: "/alpha",       key: "alpha"       as const },
    { label: "Academy",  href: "/academy",     key: "academy"     as const },
    { label: "Pricing",  href: "/pricing",     key: "pricing"     as const },
    { label: "Method.",  href: "/methodology", key: "methodology" as const },
  ];

  return (
    <nav
      className="dash-nav"
      style={{
        display:              "flex",
        alignItems:           "center",
        justifyContent:       "space-between",
        gap:                  "24px",
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
      <style>{`
        @media (max-width: 760px) {
          .dash-nav {
            flex-wrap: wrap;
            align-items: center !important;
            justify-content: flex-start !important;
            padding: 18px 24px !important;
            gap: 16px !important;
            overflow-x: hidden;
            max-width: 100vw;
          }
          .dash-nav-links {
            order: 3;
            width: 100%;
            min-width: 0;
            gap: 24px !important;
            overflow-x: auto;
            scrollbar-width: none;
            padding-bottom: 2px !important;
          }
          .dash-nav-links::-webkit-scrollbar {
            display: none;
          }
          .dash-nav-account {
            margin-left: auto;
          }
        }
      `}</style>
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

      <ul className="dash-nav-links" style={{ display: "flex", gap: "44px", listStyle: "none", padding: 0, margin: 0 }}>
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
      <div className="dash-nav-account" style={{ display: "flex", alignItems: "center", gap: "12px" }}>
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
  const [email, setEmail] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/credits")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d && typeof d.credits === "number") {
          setCredits(d.credits);
          setPlan(typeof d.plan === "string" ? d.plan : "free");
          setEmail(typeof d.email === "string" ? d.email : null);
        }
      })
      .catch(() => null)
      .finally(() => setLoaded(true));
  }, []);

  // Close the menu on outside click or Escape.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (loaded && credits === null) {
    return (
      <Link
        href="/login"
        className="dn-signin"
        style={{
          fontFamily: "var(--font-serif), Georgia, serif",
          fontSize: "12px",
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "#050d1a",
          background: "#e8edf8",
          borderRadius: "100px",
          padding: "10px 24px",
          textDecoration: "none",
          fontWeight: 500,
          whiteSpace: "nowrap",
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
  const initial = (email?.trim()?.[0] ?? "C").toUpperCase();
  const planName = planLabel(plan ?? "free");

  return (
    <div ref={rootRef} style={{ position: "relative" }}>
      <style>{`
        .dn-acct { transition: background .15s ease, border-color .15s ease; }
        .dn-acct:hover { background: rgba(232,237,248,0.07); border-color: rgba(232,237,248,0.16); }
        .dn-menu-item { transition: background .12s ease, color .12s ease; }
        .dn-menu-credits:hover { background: rgba(79,135,247,0.10); }
        .dn-menu-signout:hover { background: rgba(239,68,68,0.09); color: #fca5a5 !important; }
        .dn-signin { transition: opacity .15s ease; }
        .dn-signin:hover { opacity: 0.85; }
        @keyframes dn-pop { from { opacity: 0; transform: translateY(-4px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
      `}</style>

      {/* Account trigger: avatar + credits + plan, in the editorial serif/sans system (no monospace). */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        className="dn-acct"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          background: open ? "rgba(232,237,248,0.07)" : "rgba(232,237,248,0.035)",
          border: `1px solid ${open ? "rgba(232,237,248,0.16)" : "rgba(232,237,248,0.09)"}`,
          borderRadius: "100px",
          padding: "5px 12px 5px 6px",
          cursor: "pointer",
          minHeight: 40,
        }}
      >
        <span
          aria-hidden
          style={{
            width: 30,
            height: 30,
            borderRadius: "50%",
            background: "linear-gradient(135deg, rgba(79,135,247,0.32), rgba(79,135,247,0.14))",
            border: "1px solid rgba(79,135,247,0.34)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "var(--font-serif), Georgia, serif",
            fontSize: "13px",
            fontWeight: 600,
            color: "#bcd2ff",
            flexShrink: 0,
          }}
        >
          {initial}
        </span>

        <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 1, lineHeight: 1 }}>
          <span style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
            <span style={{ fontFamily: "var(--font-sans), system-ui, sans-serif", fontSize: "14px", fontWeight: 600, color, fontVariantNumeric: "tabular-nums" }}>
              {credits.toLocaleString()}
            </span>
            <span style={{ fontFamily: "var(--font-serif), Georgia, serif", fontSize: "11px", color: "rgba(232,237,248,0.4)" }}>
              credits
            </span>
          </span>
          <span style={{ fontFamily: "var(--font-serif), Georgia, serif", fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(232,237,248,0.4)" }}>
            {planName} plan
          </span>
        </span>

        <svg width="11" height="7" viewBox="0 0 11 7" fill="none" aria-hidden style={{ flexShrink: 0, marginLeft: 1, transform: open ? "rotate(180deg)" : "none", transition: "transform .18s ease" }}>
          <path d="M1.5 1.5L5.5 5.5L9.5 1.5" stroke="rgba(232,237,248,0.45)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          style={{
            position: "absolute",
            top: "calc(100% + 10px)",
            right: 0,
            width: 248,
            background: "#091422",
            border: "1px solid rgba(232,237,248,0.11)",
            borderRadius: 14,
            padding: 6,
            boxShadow: "0 20px 54px rgba(0,0,0,0.55), 0 6px 18px rgba(0,0,0,0.35)",
            zIndex: 200,
            animation: "dn-pop .16s ease",
          }}
        >
          {/* Identity */}
          <div style={{ padding: "12px 12px 11px", borderBottom: "1px solid rgba(232,237,248,0.07)" }}>
            <div style={{ fontFamily: "var(--font-serif), Georgia, serif", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(232,237,248,0.34)", marginBottom: 4 }}>
              Signed in as
            </div>
            <div style={{ fontFamily: "var(--font-sans), system-ui, sans-serif", fontSize: 13, color: "#e8edf8", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {email ?? "Your account"}
            </div>
          </div>

          {/* Credit balance */}
          <div style={{ padding: "12px 12px 13px", borderBottom: "1px solid rgba(232,237,248,0.07)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 9 }}>
              <span style={{ fontFamily: "var(--font-serif), Georgia, serif", fontSize: 12, color: "rgba(232,237,248,0.5)" }}>
                Credit balance
              </span>
              <span style={{ fontFamily: "var(--font-sans), system-ui, sans-serif", fontSize: 16, fontWeight: 700, color, fontVariantNumeric: "tabular-nums" }}>
                {credits.toLocaleString()}
              </span>
            </div>
            {pct !== null && (
              <div style={{ height: 4, background: "rgba(232,237,248,0.08)", borderRadius: 999, overflow: "hidden" }}>
                <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 999, transition: "width .4s ease" }} />
              </div>
            )}
            {pct === null && (
              <div style={{ fontFamily: "var(--font-serif), Georgia, serif", fontSize: 11, color: "rgba(232,237,248,0.4)" }}>
                One-time credits — never expire.
              </div>
            )}
            {isLow && (
              <div style={{ fontFamily: "var(--font-serif), Georgia, serif", fontSize: 11, color: "#fca5a5", marginTop: 8 }}>
                Running low — top up to keep researching.
              </div>
            )}
          </div>

          {/* Actions */}
          <div style={{ paddingTop: 4 }}>
            <Link
              href="/pricing"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="dn-menu-item dn-menu-credits"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 9,
                padding: "10px 12px",
                borderRadius: 9,
                fontFamily: "var(--font-sans), system-ui, sans-serif",
                fontSize: 13,
                fontWeight: 500,
                color: "#7aa6f9",
                textDecoration: "none",
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              Get more credits
            </Link>

            <form action="/auth/signout" method="post" style={{ margin: 0 }}>
              <button
                type="submit"
                role="menuitem"
                className="dn-menu-item dn-menu-signout"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 9,
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 9,
                  fontFamily: "var(--font-sans), system-ui, sans-serif",
                  fontSize: 13,
                  fontWeight: 500,
                  color: "rgba(232,237,248,0.55)",
                  textAlign: "left",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Sign out
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
