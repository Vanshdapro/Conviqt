// Track-record visualization (landing Phase 6, section 5).
//
// The landing used to list the most recent picks as cards (ticker, entry price,
// date, thesis). Founder call (2026-06-14): don't hand the actual calls away on
// a public page — that gives anyone five or six free picks without ever signing
// in. The record's *existence* is the credibility signal here; the picks
// themselves live inside the app, one tap away on the Dashboard.
//
// So this fills the same space with an abstract scene instead of data: a redacted
// "sealed ledger" tilted in perspective (light CSS-3D, no WebGL), a teal seal
// stamped with the live count of public calls, and a few ambient shapes drifting
// behind it. It says "there's a real, dated, permanent record here" without
// printing a single ticker. All motion is CSS-only and fully stilled under
// prefers-reduced-motion; styling is in app.css (cvq-trk-*), tokens only.

import type { CSSProperties } from "react";

// Decorative row count for the redacted ledger — not tied to the real pick count.
const LEDGER_ROWS = [0, 1, 2, 3, 4, 5, 6];

export function TrackRecordViz({ count }: { count: number }) {
  const noun = count === 1 ? "call" : "calls";
  const label =
    `Conviqt's sealed track record: ${count} public ${noun}, each dated and ` +
    `permanent. The picks themselves aren't listed here — they live inside the app.`;

  return (
    <div className="cvq-trkviz" data-reveal="up" role="img" aria-label={label}>
      <div className="cvq-trkviz-stage" aria-hidden="true">
        {/* ambient drifting shapes */}
        <span className="cvq-trk-shape cvq-trk-shape--ring" />
        <span className="cvq-trk-shape cvq-trk-shape--dot" />
        <span className="cvq-trk-shape cvq-trk-shape--tri" />
        <span className="cvq-trk-shape cvq-trk-shape--sq" />
        <span className="cvq-trk-shape cvq-trk-shape--bar" />

        {/* the sealed ledger — a redacted register tilted back into depth */}
        <div className="cvq-trk-ledger">
          {LEDGER_ROWS.map((i) => (
            <div className="cvq-trk-row" key={i} style={{ "--row": i } as CSSProperties}>
              <span className="cvq-trk-cell cvq-trk-cell--tick" />
              <span className="cvq-trk-cell cvq-trk-cell--line" />
              <span className="cvq-trk-dot" />
            </div>
          ))}
          <div className="cvq-trk-scan" />
        </div>

        {/* the seal — flat in front, stamped with the live count */}
        <div className="cvq-trk-seal">
          <svg
            className="cvq-trk-seal-lock"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="4" y="11" width="16" height="9" rx="2" />
            <path d="M8 11V7a4 4 0 0 1 8 0v4" />
          </svg>
          <span className="cvq-trk-seal-num">{count}</span>
          <span className="cvq-trk-seal-lbl">{noun} on the record</span>
        </div>
      </div>
    </div>
  );
}
