"use client";

import Link from "next/link";

// The Academy sub-navigation. Sits just under the global DashNav on every
// /academy route and lets the learner move between the hub, the Learn
// curriculum, and the Practice desk without losing the "I'm in the Academy"
// frame. Palette matches the Learn dashboard.

const INK = "#e8edf8";
const MUTED = "#8aa0c2";
const ACCENT = "#4f87f7";
const BORDER = "rgba(232,237,248,0.09)";
const MONO = "var(--font-mono), 'JetBrains Mono', monospace";

export type AcademyTab = "overview" | "learn" | "practice" | "leaderboard";

const TABS: { key: AcademyTab; label: string; href: string }[] = [
  { key: "overview",    label: "Overview",    href: "/academy" },
  { key: "learn",       label: "Learn",       href: "/academy/learn" },
  { key: "practice",    label: "Practice",    href: "/academy/practice" },
  { key: "leaderboard", label: "Leaderboard", href: "/academy/leaderboard" },
];

export function AcademyTabs({ active }: { active: AcademyTab }) {
  return (
    <div
      style={{
        borderBottom: `1px solid ${BORDER}`,
        background: "rgba(5,13,26,0.6)",
      }}
    >
      <nav
        aria-label="Academy sections"
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
