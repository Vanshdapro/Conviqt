"use client";

import Link from "next/link";
import { Sheet } from "@/components/ui";

// The soft paywall (Phase 7). Shown when a Free user runs out of this month's
// 5 included deep analyses. Friendly, never dark-pattern: it states the fact,
// shows what Pro unlocks, and closes from anywhere — no countdown timers, no
// guilt copy, no buried dismissal. The limit message itself comes from the
// route (FREE_LIMIT_MSG); this sheet is the "what now" answer.

const PRO_PERKS = [
  { title: "Unlimited deep analyses", sub: "Full multi-angle reports on any stock, whenever you want." },
  { title: "Every skill, no caps", sub: "Face-Off, Sector Pulse, Health Check, Starter Portfolio — all open." },
  { title: "Full Academy", sub: "All 89 lessons, practice drills, and the leaderboard." },
  { title: "Priority speed", sub: "Your runs go to the front of the line." },
] as const;

export function PaywallSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="That's your 5 for this month">
      <div className="cvq-paywall">
        <p className="cvq-paywall-lead">
          Free includes 5 deep analyses every month — they refresh on the 1st.
          Quick takes, Headlines, and your track record access stay free, always.
        </p>

        <ul className="cvq-paywall-perks">
          {PRO_PERKS.map((p) => (
            <li key={p.title}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="m5 12.5 4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span>
                <strong>{p.title}</strong>
                <em>{p.sub}</em>
              </span>
            </li>
          ))}
        </ul>

        <div className="cvq-paywall-actions">
          <Link href="/pricing" className="cvq-btn cvq-btn--primary">
            Try Pro free for 7 days
          </Link>
          <button type="button" className="cvq-btn cvq-btn--secondary" onClick={onClose}>
            Maybe later
          </button>
        </div>
        <p className="cvq-paywall-fine">Cancel anytime during the trial — you won&apos;t be charged.</p>
      </div>
    </Sheet>
  );
}
