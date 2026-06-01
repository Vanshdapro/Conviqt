"use client";

import { useEffect, useRef, useState } from "react";
import type { Verdict } from "@/lib/agents/types";

// The viral loop. A reader hits Share → posts the verdict card to X / LinkedIn
// → their followers see the OG image and ask "what is Conviqt?" → click through
// to /stock/[ticker]. Stateless, zero acquisition cost. The card itself is
// rendered by /api/og/[ticker] and wired into the page's OG/Twitter metadata.

const BASE = "https://www.conviqt.com";

export default function ShareButton({
  ticker,
  companyName,
  verdict,
  conviction,
  disagreement,
}: {
  ticker: string;
  companyName: string;
  verdict: Verdict;
  conviction: number;
  disagreement: number;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const url = `${BASE}/stock/${ticker.toLowerCase()}`;
  const text = `$${ticker}: ${verdict} · ${conviction}/100 conviction · ${disagreement}/100 agent disagreement. See the full Conviqt Council debate →`;

  const xHref = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
    text,
  )}&url=${encodeURIComponent(url)}`;
  const liHref = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(
    url,
  )}`;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
      console.log("[share] link copied", ticker);
    } catch {
      // Clipboard blocked (insecure context / permissions) — fall back to the
      // X intent so the user can still share.
      window.open(xHref, "_blank", "noopener,noreferrer");
    }
  }

  function shareNative() {
    if (typeof navigator !== "undefined" && "share" in navigator) {
      navigator
        .share({ title: `${ticker} — ${companyName}`, text, url })
        .catch(() => setOpen(true));
      console.log("[share] native sheet", ticker);
    } else {
      setOpen((v) => !v);
    }
  }

  const itemCls =
    "flex items-center gap-2.5 w-full text-left px-3.5 py-2.5 mono text-[11px] uppercase tracking-[0.12em] text-muted hover:text-foreground hover:bg-[var(--surface-3)] transition-colors";

  return (
    <div ref={ref} className="relative flex-shrink-0">
      <button
        type="button"
        onClick={shareNative}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 mono text-[10px] uppercase tracking-[0.16em] px-3.5 py-2 rounded-sm border border-rule text-muted hover:text-foreground hover:border-[var(--accent-border)] transition-colors"
        style={{ background: "var(--surface)" }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="18" cy="5" r="3" />
          <circle cx="6" cy="12" r="3" />
          <circle cx="18" cy="19" r="3" />
          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
          <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
        </svg>
        Share card
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-1.5 w-52 border border-rule rounded-sm overflow-hidden z-20 shadow-xl"
          style={{ background: "var(--surface-2)" }}
        >
          <a
            href={xHref}
            target="_blank"
            rel="noopener noreferrer"
            role="menuitem"
            className={itemCls}
            onClick={() => {
              console.log("[share] X intent", ticker);
              setOpen(false);
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
            Post on X
          </a>
          <a
            href={liHref}
            target="_blank"
            rel="noopener noreferrer"
            role="menuitem"
            className={itemCls}
            onClick={() => {
              console.log("[share] LinkedIn", ticker);
              setOpen(false);
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.34V9h3.42v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.45zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zM7.12 20.45H3.55V9h3.57zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.22.79 24 1.77 24h20.45c.98 0 1.78-.78 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z" />
            </svg>
            Post on LinkedIn
          </a>
          <button type="button" role="menuitem" className={itemCls} onClick={copyLink}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
            {copied ? "Link copied" : "Copy link"}
          </button>
        </div>
      )}
    </div>
  );
}
