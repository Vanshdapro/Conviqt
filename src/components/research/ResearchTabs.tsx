"use client";

import Link from "next/link";

// The Research sub-navigation. Sits under the global DashNav on every Research
// surface and lets the user move between the hub overview, the Analyst (the
// on-demand Council chat), and the Portfolio Auditor without losing the "I'm
// in Research" frame. Mirrors AcademyTabs. Note the Analyst tab keeps the
// existing /chat URL so none of the deep-links across the app break.

const INK = "#e8edf8";
const MUTED = "#8aa0c2";
const ACCENT = "#4f87f7";
const BORDER = "rgba(232,237,248,0.09)";
const MONO = "var(--font-mono), 'JetBrains Mono', monospace";

export type ResearchTab = "overview" | "analyst" | "stocks" | "watchlist" | "allocator" | "portfolio";

const TABS: { key: ResearchTab; label: string; href: string }[] = [
  { key: "overview", label: "Overview", href: "/research" },
  { key: "analyst", label: "Analyst", href: "/chat" },
  { key: "stocks", label: "Stocks", href: "/stock" },
  { key: "watchlist", label: "Watchlist", href: "/watchlist" },
  { key: "allocator", label: "Allocator", href: "/research/allocator" },
  { key: "portfolio", label: "Portfolio", href: "/research/portfolio" },
];

export function ResearchTabs({ active }: { active: ResearchTab }) {
  return (
    <div style={{ borderBottom: `1px solid ${BORDER}`, background: "rgba(5,13,26,0.6)" }}>
      <nav
        aria-label="Research sections"
        style={{
          maxWidth: 1100,
          margin: "0 auto",
          padding: "0 24px",
          display: "flex",
          gap: 28,
          alignItems: "center",
        }}
      >
        {TABS.map(({ key, label, href }) => {
          const on = key === active;
          return (
            <Link
              key={key}
              href={href}
              style={{
                fontFamily: MONO,
                fontSize: 12,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: on ? INK : MUTED,
                textDecoration: "none",
                padding: "16px 2px",
                borderBottom: on ? `2px solid ${ACCENT}` : "2px solid transparent",
                marginBottom: -1,
              }}
            >
              {label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
