"use client";

import { useState } from "react";
import type { Verdict } from "@/lib/agents/types";

// Full-bleed "Share this verdict" section — the card preview image is the CTA.
// Seeing the actual card (not just a button) is what prompts users to share.

const BASE = "https://www.conviqt.com";

export default function SharePanel({
  ticker,
  companyName,
  verdict,
  conviction,
  disagreement,
  verdictColor,
  ogTimestamp,
}: {
  ticker: string;
  companyName: string;
  verdict: Verdict;
  conviction: number;
  disagreement: number;
  verdictColor: string;
  ogTimestamp: number;
}) {
  const [copied, setCopied] = useState(false);

  const url = `${BASE}/stock/${ticker.toLowerCase()}`;
  const text = `$${ticker}: ${verdict} · ${conviction}/100 conviction. See the full Conviqt research →`;
  const xHref = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
  const liHref = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
      console.log("[share] link copied", ticker);
    } catch {
      window.open(xHref, "_blank", "noopener,noreferrer");
    }
  }

  const btnBase: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 7,
    fontFamily: "var(--font-mono), 'JetBrains Mono', monospace",
    fontSize: 11,
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    textDecoration: "none",
    padding: "10px 18px",
    border: "1px solid var(--rule)",
    background: "var(--surface-3)",
    color: "var(--muted)",
    cursor: "pointer",
    transition: "border-color .15s, color .15s",
    borderRadius: 2,
  };

  return (
    <section
      className="border border-rule"
      style={{ background: "var(--surface)", borderLeft: `4px solid ${verdictColor}` }}
    >
      <div className="px-5 py-5">
        <div className="flex items-baseline justify-between flex-wrap gap-2 mb-1">
          <h2 className="caps text-[9px]" style={{ color: verdictColor }}>Share this verdict</h2>
          <span className="mono text-[10px] text-dim">conviqt.com/stock/{ticker.toLowerCase()}</span>
        </div>
        <p className="mono text-[10px] text-muted mb-5 leading-relaxed">
          This card renders when anyone pastes the link on X, LinkedIn, or Reddit.
          Every share puts the verdict in front of new investors for free.
        </p>

        {/* ── Card preview ─────────────────────────────────────────────── */}
        <div
          className="border border-rule overflow-hidden mb-5"
          style={{
            background: "var(--surface-2)",
            boxShadow: "var(--shadow-card)",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/og/${ticker.toLowerCase()}?v=${ogTimestamp}`}
            alt={`${ticker} — Conviqt verdict card: ${verdict}, ${conviction}/100 conviction`}
            width={1200}
            height={630}
            loading="lazy"
            decoding="async"
            style={{ width: "100%", height: "auto", display: "block" }}
          />
        </div>

        {/* ── Share actions ─────────────────────────────────────────────── */}
        <div className="flex flex-wrap gap-2">
          <a
            href={xHref}
            target="_blank"
            rel="noopener noreferrer"
            style={btnBase}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = "var(--border-strong)";
              (e.currentTarget as HTMLElement).style.color = "var(--foreground)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = "var(--rule)";
              (e.currentTarget as HTMLElement).style.color = "var(--muted)";
            }}
            onClick={() => console.log("[share] X intent", ticker)}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}>
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
            Post on X
          </a>

          <a
            href={liHref}
            target="_blank"
            rel="noopener noreferrer"
            style={btnBase}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = "var(--border-strong)";
              (e.currentTarget as HTMLElement).style.color = "var(--foreground)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = "var(--rule)";
              (e.currentTarget as HTMLElement).style.color = "var(--muted)";
            }}
            onClick={() => console.log("[share] LinkedIn", ticker)}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}>
              <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.34V9h3.42v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.45zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zM7.12 20.45H3.55V9h3.57zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.22.79 24 1.77 24h20.45c.98 0 1.78-.78 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z" />
            </svg>
            Post on LinkedIn
          </a>

          <button
            type="button"
            style={btnBase}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = copied
                ? `color-mix(in srgb, ${verdictColor} 40%, transparent)`
                : "var(--border-strong)";
              (e.currentTarget as HTMLElement).style.color = "var(--foreground)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = "var(--rule)";
              (e.currentTarget as HTMLElement).style.color = "var(--muted)";
            }}
            onClick={copyLink}
          >
            {copied ? (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={verdictColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
            )}
            {copied ? "Copied!" : "Copy link"}
          </button>
        </div>

        <p className="mono text-[9px] text-dim mt-4">
          Pre-filled tweet: &ldquo;{text}&rdquo;
        </p>
      </div>
    </section>
  );
}
