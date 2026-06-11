"use client";

import Link from "next/link";

// The Academy sub-navigation. Sits just under the app shell chrome on every
// /academy route and lets the learner move between the hub, the Learn
// curriculum, and the Practice desk without losing the "I'm in the Academy"
// frame. Palette matches the Learn dashboard.

export type AcademyTab = "overview" | "learn" | "practice" | "leaderboard";

const TABS: { key: AcademyTab; label: string; href: string }[] = [
  { key: "overview",    label: "Overview",    href: "/academy" },
  { key: "learn",       label: "Learn",       href: "/academy/learn" },
  { key: "practice",    label: "Practice",    href: "/academy/practice" },
  { key: "leaderboard", label: "Leaderboard", href: "/academy/leaderboard" },
];

export function AcademyTabs({ active }: { active: AcademyTab }) {
  return (
    <div style={{ borderBottom: "1px solid var(--rule)", background: "rgba(5,13,26,0.6)" }}>
      <style>{`
        .subtabs {
          max-width: 1100px;
          margin: 0 auto;
          padding: 0 24px;
          display: flex;
          gap: 28px;
          align-items: center;
          overflow-x: auto;
          scrollbar-width: none;
        }
        .subtabs::-webkit-scrollbar { display: none; }
        .subtab { flex-shrink: 0; }
      `}</style>
      <nav aria-label="Academy sections" className="subtabs">
        {TABS.map(({ key, label, href }) => {
          const on = key === active;
          return (
            <Link
              key={key}
              href={href}
              className="subtab mono"
              style={{
                fontSize: 12,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: on ? "var(--foreground)" : "var(--muted)",
                textDecoration: "none",
                padding: "16px 2px",
                borderBottom: on ? "2px solid var(--accent)" : "2px solid transparent",
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
