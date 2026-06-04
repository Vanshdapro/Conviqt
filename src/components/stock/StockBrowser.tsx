"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { ReportSummary } from "@/lib/stockReports";
import { VerdictDistribution } from "../viz/CouncilViz";
import type { UniverseEntry } from "@/lib/tickers";

// Client island for the /stock index: a search box over the published Council
// verdicts + the full coverage universe, so users can jump straight to a name
// instead of scrolling ~220 rows. Data is fetched server-side and passed in as
// props, so the full list still server-renders into the initial HTML (the
// internal links crawlers need) — search only filters what's already there.

const INK = "#e8edf8";
const MUTED = "#8aa0c2";
const FAINT = "#526684";
const ACCENT = "#4f87f7";
const BORDER = "rgba(232,237,248,0.09)";
const SURFACE = "#07121f";
const MONO = "var(--font-mono), 'JetBrains Mono', monospace";
const SERIF = "var(--font-serif), Georgia, serif";
const DISPLAY = "var(--font-display), Georgia, 'Times New Roman', serif";

function verdictColor(v: "BUY" | "HOLD" | "SELL"): string {
  if (v === "BUY") return "#22c55e";
  if (v === "SELL") return "#f87171";
  return "#f59e0b";
}

export function StockBrowser({
  published,
  universe,
}: {
  published: ReportSummary[];
  universe: UniverseEntry[];
}) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();

  const filteredPublished = useMemo(() => {
    if (!q) return published;
    return published.filter(
      (p) =>
        p.ticker.toLowerCase().includes(q) ||
        p.companyName.toLowerCase().includes(q)
    );
  }, [published, q]);

  const filteredUniverse = useMemo(() => {
    if (!q) return universe;
    return universe.filter(
      (e) =>
        e.ticker.toLowerCase().includes(q) || e.name.toLowerCase().includes(q)
    );
  }, [universe, q]);

  const nothing = q && filteredPublished.length === 0 && filteredUniverse.length === 0;

  return (
    <div>
      <style>{`
        .si-card { transition: border-color .18s ease, transform .18s ease; }
        .si-card:hover { transform: translateY(-2px); border-color: rgba(79,135,247,.32) !important; }
        .si-pill { transition: color .14s ease, border-color .14s ease; }
        .si-pill:hover { color: ${INK} !important; border-color: rgba(79,135,247,.4) !important; }
        .si-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
        .si-pills { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
        .si-search:focus-within { border-color: rgba(79,135,247,.5) !important; background: rgba(79,135,247,.05) !important; }
        .si-search input::placeholder { color: ${FAINT}; }
        @media (max-width: 1000px) { .si-grid { grid-template-columns: 1fr 1fr !important; } .si-pills { grid-template-columns: 1fr 1fr 1fr !important; } }
        @media (max-width: 680px) { .si-grid { grid-template-columns: 1fr !important; } .si-pills { grid-template-columns: 1fr 1fr !important; } }
        @media (prefers-reduced-motion: reduce) { .si-card, .si-card:hover { transition: none; transform: none; } }
      `}</style>

      {/* ── Search ─────────────────────────────────────────────────────── */}
      <div
        className="si-search"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          background: "rgba(232,237,248,0.018)",
          border: `1px solid ${BORDER}`,
          borderRadius: 12,
          padding: "14px 18px",
          marginBottom: 40,
          transition: "border-color .18s ease, background .18s ease",
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden style={{ flexShrink: 0 }}>
          <circle cx="11" cy="11" r="7" stroke={MUTED} strokeWidth="1.8" />
          <line x1="16.5" y1="16.5" x2="21" y2="21" stroke={MUTED} strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by ticker or company — e.g. NVDA, Apple, Tesla"
          aria-label="Search stocks by ticker or company name"
          autoComplete="off"
          spellCheck={false}
          style={{
            flex: 1,
            background: "transparent",
            border: "none",
            outline: "none",
            color: INK,
            fontFamily: SERIF,
            fontSize: 16,
          }}
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="Clear search"
            style={{
              flexShrink: 0,
              background: "none",
              border: "none",
              color: FAINT,
              cursor: "pointer",
              fontFamily: MONO,
              fontSize: 18,
              lineHeight: 1,
              padding: 2,
            }}
          >
            ×
          </button>
        )}
      </div>

      {nothing && (
        <div
          style={{
            border: `1px solid ${BORDER}`,
            borderRadius: 12,
            padding: "32px 24px",
            textAlign: "center",
            color: MUTED,
            fontFamily: SERIF,
            fontSize: 15,
          }}
        >
          No matches for &ldquo;{query}&rdquo;. Try a ticker like{" "}
          <span style={{ color: INK, fontFamily: MONO }}>NVDA</span> or a company name.
        </div>
      )}

      {/* ── Published verdicts ─────────────────────────────────────────── */}
      {filteredPublished.length > 0 && (
        <section style={{ marginBottom: 48 }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 18 }}>
            <h2 style={{ color: INK, fontFamily: MONO, fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", margin: 0 }}>
              Latest Council verdicts
            </h2>
            <span style={{ color: FAINT, fontFamily: MONO, fontSize: 11 }}>
              {filteredPublished.length}{q ? " match" + (filteredPublished.length === 1 ? "" : "es") : " published"}
            </span>
          </div>
          {/* Board-level read: how the Council's standing verdicts split across these names */}
          {(() => {
            const c = { BUY: 0, HOLD: 0, SELL: 0 } as Record<"BUY" | "HOLD" | "SELL", number>;
            filteredPublished.forEach((p) => { c[p.verdict] += 1; });
            return (
              <div style={{ marginBottom: 22 }}>
                <VerdictDistribution buy={c.BUY} hold={c.HOLD} sell={c.SELL} label="Council consensus across these names" />
              </div>
            );
          })()}
          <div className="si-grid">
            {filteredPublished.map((p) => {
              const vc = verdictColor(p.verdict);
              return (
                <Link
                  key={p.ticker}
                  href={`/stock/${p.ticker.toLowerCase()}`}
                  className="si-card"
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 14,
                    background: SURFACE,
                    border: `1px solid ${BORDER}`,
                    borderLeft: `3px solid ${vc}`,
                    borderRadius: 12,
                    padding: "18px 20px",
                    textDecoration: "none",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ color: INK, fontFamily: DISPLAY, fontSize: 24, fontWeight: 500, letterSpacing: "-0.01em", lineHeight: 1 }}>
                        {p.ticker}
                      </div>
                      <div style={{ color: MUTED, fontFamily: SERIF, fontSize: 13, marginTop: 5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {p.companyName}
                      </div>
                    </div>
                    <span style={{ color: vc, fontFamily: MONO, fontSize: 13, fontWeight: 700, letterSpacing: "0.06em", flexShrink: 0 }}>
                      {p.verdict}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ flex: 1, height: 3, background: "rgba(232,237,248,0.1)", borderRadius: 999, overflow: "hidden" }}>
                      <div style={{ width: `${p.conviction}%`, height: "100%", background: vc }} />
                    </div>
                    <span style={{ color: MUTED, fontFamily: MONO, fontSize: 10, flexShrink: 0 }}>
                      {p.conviction}/100
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Browse the universe ────────────────────────────────────────── */}
      {filteredUniverse.length > 0 && (
        <section>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 18 }}>
            <h2 style={{ color: INK, fontFamily: MONO, fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", margin: 0 }}>
              {q ? "Coverage" : published.length > 0 ? "Browse the universe" : "Browse coverage"}
            </h2>
            <span style={{ color: FAINT, fontFamily: MONO, fontSize: 11 }}>
              {filteredUniverse.length}{q ? " match" + (filteredUniverse.length === 1 ? "" : "es") : " names"}
            </span>
          </div>
          {!q && (
            <p style={{ color: MUTED, fontFamily: SERIF, fontSize: 14, lineHeight: 1.6, margin: "0 0 18px", maxWidth: 640 }}>
              Open any name to see its latest report — or trigger a fresh Council run if none has been published yet.
            </p>
          )}
          <div className="si-pills">
            {filteredUniverse.map((e) => (
              <Link
                key={e.ticker}
                href={`/stock/${e.ticker.toLowerCase()}`}
                className="si-pill"
                title={e.name}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                  border: `1px solid ${BORDER}`,
                  borderRadius: 9,
                  padding: "11px 14px",
                  textDecoration: "none",
                  color: MUTED,
                  background: "rgba(232,237,248,0.018)",
                }}
              >
                <span style={{ fontFamily: MONO, fontSize: 13, fontWeight: 600, color: INK }}>{e.ticker}</span>
                <span style={{ fontFamily: SERIF, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "right" }}>
                  {e.name}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
