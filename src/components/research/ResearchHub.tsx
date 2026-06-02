"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const SURFACE = "#07121f";
const BORDER = "rgba(232,237,248,0.09)";
const RULE = "rgba(232,237,248,0.075)";
const INK = "#e8edf8";
const MUTED = "#8aa0c2";
const FAINT = "#6c82a3";
const ACCENT = "#4f87f7";
const SKY = "#38bdf8";
const GOOD = "#22c55e";
const MONO = "var(--font-mono), 'JetBrains Mono', monospace";
const SANS = "var(--font-sans), system-ui, sans-serif";
const DISPLAY = "var(--font-display), Georgia, 'Times New Roman', serif";
const SERIF = "var(--font-serif), Georgia, serif";

type PortfolioListItem = {
  id: string;
  name: string;
  holdings: unknown[];
  latestHealthScore: number | null;
  lastAuditedAt: string | null;
};

function healthColor(score: number | null): string {
  if (score === null) return FAINT;
  if (score >= 75) return GOOD;
  if (score >= 55) return "#f59e0b";
  return "#f87171";
}

export function ResearchHub() {
  const [portfolios, setPortfolios] = useState<PortfolioListItem[] | null>(null);

  useEffect(() => {
    fetch("/api/portfolio")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d && Array.isArray(d.portfolios)) setPortfolios(d.portfolios as PortfolioListItem[]);
        else setPortfolios([]);
      })
      .catch(() => setPortfolios([]));
  }, []);

  const topPortfolio = portfolios && portfolios.length > 0 ? portfolios[0] : null;

  return (
    <div style={{ fontFamily: SANS }}>
      <style>{`
        .rh-card { transition: border-color .18s ease, transform .18s ease; }
        .rh-card:hover { transform: translateY(-3px); }
        .rh-analyst-card:hover { border-color: rgba(79,135,247,.35) !important; }
        .rh-allocator-card:hover { border-color: rgba(56,189,248,.35) !important; }
        .rh-portfolio-card:hover { border-color: rgba(34,197,94,.35) !important; }
        .rh-browse { transition: border-color .18s ease, background .18s ease; }
        .rh-browse:hover { border-color: rgba(79,135,247,.32) !important; background: rgba(79,135,247,.05) !important; }
        @media (max-width: 1000px) {
          .rh-paths { grid-template-columns: 1fr 1fr !important; }
        }
        @media (max-width: 760px) {
          .rh-paths { grid-template-columns: 1fr !important; }
          .rh-title { font-size: 36px !important; }
        }
        @media (prefers-reduced-motion: reduce) {
          .rh-card, .rh-card:hover { transition: none; transform: none; }
        }
      `}</style>

      <header style={{ marginBottom: 52, maxWidth: 780 }}>
        <div style={{ color: ACCENT, fontFamily: MONO, fontSize: 10, letterSpacing: "0.26em", textTransform: "uppercase", marginBottom: 18 }}>
          Conviqt Research
        </div>
        <h1 className="rh-title" style={{ color: INK, fontFamily: DISPLAY, fontSize: 52, lineHeight: 1.03, letterSpacing: "-0.02em", fontWeight: 500, margin: "0 0 20px" }}>
          One stock, or your whole book.
        </h1>
        <p style={{ color: MUTED, fontFamily: SERIF, fontSize: 17.5, lineHeight: 1.64, margin: 0, maxWidth: 680 }}>
          The same Council, pointed at three different questions.{" "}
          <strong style={{ color: INK, fontWeight: 600 }}>Analyst</strong> runs an on-demand thesis on any name.{" "}
          <strong style={{ color: INK, fontWeight: 600 }}>Allocator</strong> turns your capacity, risk, and goals into a cited allocation plan.{" "}
          <strong style={{ color: INK, fontWeight: 600 }}>Portfolio Auditor</strong> stress-tests everything you already own — and each shows you exactly where the agents disagree.
        </p>
      </header>

      <div className="rh-paths" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20, marginBottom: 36 }}>
        {/* Analyst */}
        <Link href="/chat" className="rh-card rh-analyst-card" style={cardStyle}>
          <div style={{ padding: "24px 24px 0" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
              <div>
                <div style={{ color: ACCENT, fontFamily: MONO, fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 14 }}>
                  On demand — any ticker
                </div>
                <h2 style={cardTitleStyle}>Analyst</h2>
              </div>
              <SearchGlyph accent={ACCENT} />
            </div>
            <p style={cardBodyStyle}>
              Type &ldquo;analyze NVDA&rdquo; and watch four specialists argue it out — fundamentals, technicals, sentiment, macro — then a judge synthesizes a verdict with a live disagreement score. Every number carries a source link.
            </p>
          </div>
          <div style={cardFootStyle}>
            <span style={{ color: FAINT, fontFamily: MONO, fontSize: 11 }}>Chat-first · cited</span>
            <span style={ctaStyle(ACCENT)}>Open the Analyst <ArrowSvg /></span>
          </div>
        </Link>

        {/* Allocator */}
        <Link href="/research/allocator" className="rh-card rh-allocator-card" style={cardStyle}>
          <div style={{ padding: "24px 24px 0" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
              <div>
                <div style={{ color: SKY, fontFamily: MONO, fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 14 }}>
                  Plan — from scratch
                </div>
                <h2 style={cardTitleStyle}>Allocator</h2>
              </div>
              <CompassGlyph accent={SKY} />
            </div>
            <p style={cardBodyStyle}>
              Enter how much you&rsquo;re investing, your risk tolerance, timeline, and goals. Four planning agents debate the mix and a judge reconciles them into exact tickers, dollar splits, account priority, and a SIP — every figure cited.
            </p>
          </div>
          <div style={cardFootStyle}>
            <span style={{ color: FAINT, fontFamily: MONO, fontSize: 11 }}>Capacity → cited plan</span>
            <span style={ctaStyle(SKY)}>Build my plan <ArrowSvg /></span>
          </div>
        </Link>

        {/* Portfolio Auditor */}
        <Link href="/research/portfolio" className="rh-card rh-portfolio-card" style={cardStyle}>
          <div style={{ padding: "24px 24px 0" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
              <div>
                <div style={{ color: GOOD, fontFamily: MONO, fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 14 }}>
                  Deep audit — your whole portfolio
                </div>
                <h2 style={cardTitleStyle}>Portfolio Auditor</h2>
              </div>
              <ShieldGlyph accent={GOOD} />
            </div>
            <p style={cardBodyStyle}>
              Paste a CSV or add holdings by hand. Five risk agents stress-test the basket for hidden concentration, sector overlap, macro fragility, and correlation — then model what a recession, rate shock, or tariff war would do to it.
            </p>
          </div>
          <div style={cardFootStyle}>
            {topPortfolio ? (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <span style={{ color: FAINT, fontFamily: MONO, fontSize: 11 }}>{topPortfolio.name}</span>
                {topPortfolio.latestHealthScore !== null && (
                  <span style={{ color: healthColor(topPortfolio.latestHealthScore), fontFamily: MONO, fontSize: 12, fontWeight: 700 }}>
                    {topPortfolio.latestHealthScore}/100
                  </span>
                )}
              </span>
            ) : (
              <span style={{ color: FAINT, fontFamily: MONO, fontSize: 11 }}>
                {portfolios === null ? "Loading…" : "No audits yet"}
              </span>
            )}
            <span style={ctaStyle(GOOD)}>{topPortfolio ? "Re-audit" : "Audit my portfolio"} <ArrowSvg /></span>
          </div>
        </Link>
      </div>

      {/* Browse the standing report library — the published /stock pages. */}
      <Link
        href="/stock"
        className="rh-browse"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          background: SURFACE,
          border: `1px solid ${BORDER}`,
          borderRadius: 12,
          padding: "18px 22px",
          textDecoration: "none",
          marginBottom: 36,
        }}
      >
        <span>
          <span style={{ display: "block", color: INK, fontFamily: SERIF, fontSize: 16, fontWeight: 600 }}>
            Browse standing stock reports
          </span>
          <span style={{ display: "block", color: MUTED, fontFamily: SERIF, fontSize: 14, marginTop: 3 }}>
            The Council&rsquo;s latest verdict on the S&amp;P 500 and top Nasdaq names — already run, source-linked, ready to read.
          </span>
        </span>
        <span style={ctaStyle(ACCENT)}>View all <ArrowSvg /></span>
      </Link>

      <footer style={{ marginTop: 8, paddingTop: 16, borderTop: `1px solid ${RULE}`, color: FAINT, fontSize: 12, lineHeight: 1.6 }}>
        Analysis only, not personalized financial advice. Every quantitative claim links to a source produced by the Council&rsquo;s live web search.
      </footer>
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  background: SURFACE,
  border: `1px solid ${BORDER}`,
  borderRadius: 14,
  overflow: "hidden",
  textDecoration: "none",
  minHeight: 300,
};
const cardTitleStyle: React.CSSProperties = {
  color: INK,
  fontFamily: DISPLAY,
  fontSize: 34,
  fontWeight: 500,
  margin: "0 0 12px",
  letterSpacing: "-0.01em",
};
const cardBodyStyle: React.CSSProperties = {
  color: MUTED,
  fontFamily: SERIF,
  fontSize: 15,
  lineHeight: 1.62,
  margin: 0,
};
const cardFootStyle: React.CSSProperties = {
  marginTop: "auto",
  padding: "18px 24px",
  borderTop: "1px solid rgba(232,237,248,0.06)",
  background: "rgba(232,237,248,0.018)",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
};
function ctaStyle(color: string): React.CSSProperties {
  return { color, fontFamily: SANS, fontSize: 14, fontWeight: 650, display: "inline-flex", alignItems: "center", gap: 7 };
}

function ArrowSvg() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="4" y1="12" x2="18.5" y2="12" />
      <polyline points="12.5 6 18.5 12 12.5 18" />
    </svg>
  );
}
function SearchGlyph({ accent }: { accent: string }) {
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
      <circle cx="27" cy="27" r="16" stroke={`${accent}55`} strokeWidth="2" fill={`${accent}0d`} />
      <line x1="39" y1="39" x2="52" y2="52" stroke={`${accent}66`} strokeWidth="2.4" strokeLinecap="round" />
      <polyline points="20,30 25,23 30,27 35,19" stroke={`${accent}80`} strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function CompassGlyph({ accent }: { accent: string }) {
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
      <circle cx="32" cy="32" r="22" stroke={`${accent}55`} strokeWidth="2" fill={`${accent}0d`} />
      <polygon points="32,16 38,32 32,48 26,32" fill={`${accent}33`} stroke={`${accent}88`} strokeWidth="1.6" strokeLinejoin="round" />
      <circle cx="32" cy="32" r="2.6" fill={`${accent}aa`} />
    </svg>
  );
}
function ShieldGlyph({ accent }: { accent: string }) {
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path d="M32 8 L52 16 V32 C52 44 43 52 32 56 C21 52 12 44 12 32 V16 Z" stroke={`${accent}55`} strokeWidth="2" fill={`${accent}0d`} />
      <polyline points="23,32 30,39 42,24" stroke={`${accent}88`} strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
