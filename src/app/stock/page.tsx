import type { Metadata } from "next";
import Link from "next/link";
import { DashNav } from "@/components/DashNav";
import { ResearchTabs } from "@/components/research/ResearchTabs";
import { getStockReportStore, type ReportSummary } from "@/lib/stockReports";
import { STOCK_UNIVERSE } from "@/lib/tickers";

// Browsable index for the public /stock/[ticker] report pages. Lives inside
// the Research section (a "Stocks" tab next to Analyst / Allocator / Portfolio)
// so the SEO report surface is discoverable from the in-app nav, not just by
// typing a URL. Published verdicts lead; the full pre-built universe follows so
// the page is useful — and richly internally-linked for crawlers — even before
// every ticker has a cached Council run.

export const revalidate = 3600; // refresh the published list hourly

const BASE = "https://www.conviqt.com";

const INK = "#e8edf8";
const MUTED = "#8aa0c2";
const FAINT = "#526684";
const ACCENT = "#4f87f7";
const BORDER = "rgba(232,237,248,0.09)";
const RULE = "rgba(232,237,248,0.075)";
const SURFACE = "#07121f";
const MONO = "var(--font-mono), 'JetBrains Mono', monospace";
const SANS = "var(--font-sans), system-ui, sans-serif";
const DISPLAY = "var(--font-display), Georgia, 'Times New Roman', serif";
const SERIF = "var(--font-serif), Georgia, serif";

export const metadata: Metadata = {
  title: "Stock Reports — AI Council verdicts",
  description:
    "Browse Conviqt's AI Council verdicts across the S&P 500 and top Nasdaq names. Each report: five agents debate fundamentals, technicals, sentiment, and macro — every number source-linked.",
  alternates: { canonical: `${BASE}/stock` },
  openGraph: {
    title: "Stock Reports | Conviqt AI Equity Research",
    description:
      "AI Council verdicts across the S&P 500 and top Nasdaq names — conviction scores, disagreement signals, and cited sources for every figure.",
    url: `${BASE}/stock`,
    type: "website",
  },
};

function verdictColor(v: "BUY" | "HOLD" | "SELL"): string {
  if (v === "BUY") return "#22c55e";
  if (v === "SELL") return "#f87171";
  return "#f59e0b";
}

export default async function StockIndexPage() {
  let published: ReportSummary[] = [];
  try {
    published = await getStockReportStore().listSummaries(500);
  } catch {
    published = [];
  }

  const publishedTickers = new Set(published.map((p) => p.ticker.toUpperCase()));
  const remaining = STOCK_UNIVERSE.filter(
    (e) => !publishedTickers.has(e.ticker.toUpperCase())
  );

  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(ellipse at 15% 60%, rgba(30,90,180,0.22) 0%, transparent 55%), radial-gradient(ellipse at 85% 20%, rgba(20,70,160,0.18) 0%, transparent 55%), radial-gradient(ellipse at 50% 95%, rgba(15,60,120,0.16) 0%, transparent 50%), linear-gradient(175deg, #060b12 0%, #0b1020 60%, #07090f 100%)",
      }}
    >
      <DashNav active="research" />
      <ResearchTabs active="stocks" />

      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "48px 24px 80px", fontFamily: SANS }}>
        <style>{`
          .si-card { transition: border-color .18s ease, transform .18s ease; }
          .si-card:hover { transform: translateY(-2px); border-color: rgba(79,135,247,.32) !important; }
          .si-pill { transition: color .14s ease, border-color .14s ease; }
          .si-pill:hover { color: ${INK} !important; border-color: rgba(79,135,247,.4) !important; }
          .si-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
          .si-pills { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
          @media (max-width: 1000px) { .si-grid { grid-template-columns: 1fr 1fr !important; } .si-pills { grid-template-columns: 1fr 1fr 1fr !important; } }
          @media (max-width: 680px) { .si-grid { grid-template-columns: 1fr !important; } .si-pills { grid-template-columns: 1fr 1fr !important; } .si-title { font-size: 38px !important; } }
          @media (prefers-reduced-motion: reduce) { .si-card, .si-card:hover { transition: none; transform: none; } }
        `}</style>

        <header style={{ marginBottom: 44, maxWidth: 780 }}>
          <div style={{ color: ACCENT, fontFamily: MONO, fontSize: 10, letterSpacing: "0.26em", textTransform: "uppercase", marginBottom: 18 }}>
            Conviqt Research · Stock Reports
          </div>
          <h1 className="si-title" style={{ color: INK, fontFamily: DISPLAY, fontSize: 52, lineHeight: 1.03, letterSpacing: "-0.02em", fontWeight: 500, margin: "0 0 20px" }}>
            Every verdict, on the record.
          </h1>
          <p style={{ color: MUTED, fontFamily: SERIF, fontSize: 17.5, lineHeight: 1.64, margin: 0, maxWidth: 680 }}>
            The Council&rsquo;s standing call on the S&amp;P 500 and top Nasdaq names. Each page shows the verdict, conviction, and where the agents disagreed — with every number linked to a source. Reports refresh as users run them and on a daily cron.
          </p>
        </header>

        {/* ── Published verdicts ─────────────────────────────────────────── */}
        {published.length > 0 && (
          <section style={{ marginBottom: 48 }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 18 }}>
              <h2 style={{ color: INK, fontFamily: MONO, fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", margin: 0 }}>
                Latest Council verdicts
              </h2>
              <span style={{ color: FAINT, fontFamily: MONO, fontSize: 11 }}>{published.length} published</span>
            </div>
            <div className="si-grid">
              {published.map((p) => {
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
        <section>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 18 }}>
            <h2 style={{ color: INK, fontFamily: MONO, fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", margin: 0 }}>
              {published.length > 0 ? "Browse the universe" : "Browse coverage"}
            </h2>
            <span style={{ color: FAINT, fontFamily: MONO, fontSize: 11 }}>{remaining.length} names</span>
          </div>
          <p style={{ color: MUTED, fontFamily: SERIF, fontSize: 14, lineHeight: 1.6, margin: "0 0 18px", maxWidth: 640 }}>
            Open any name to see its latest report — or trigger a fresh Council run if none has been published yet.
          </p>
          <div className="si-pills">
            {remaining.map((e) => (
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

        <footer style={{ marginTop: 44, paddingTop: 16, borderTop: `1px solid ${RULE}`, color: FAINT, fontSize: 12, lineHeight: 1.6 }}>
          Analysis only, not personalized financial advice. Every quantitative claim links to a source produced by the Council&rsquo;s live web search.
        </footer>
      </main>
    </div>
  );
}
