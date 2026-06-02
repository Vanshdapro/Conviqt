import type { Metadata } from "next";
import { DashNav } from "@/components/DashNav";
import { ResearchTabs } from "@/components/research/ResearchTabs";
import { StockBrowser } from "@/components/stock/StockBrowser";
import { getStockReportStore, type ReportSummary } from "@/lib/stockReports";
import { STOCK_UNIVERSE } from "@/lib/tickers";

// Browsable index for the public /stock/[ticker] report pages. Lives inside
// the Research section (a "Stocks" tab next to Analyst / Allocator / Portfolio)
// so the SEO report surface is discoverable from the in-app nav, not just by
// typing a URL. Published verdicts lead; the full pre-built universe follows so
// the page is useful — and richly internally-linked for crawlers — even before
// every ticker has a cached Council run. The search box + list rendering live
// in <StockBrowser/> (a client island); data is fetched here so the full list
// still server-renders into the initial HTML.

export const revalidate = 3600; // refresh the published list hourly

const BASE = "https://www.conviqt.com";

const INK = "#e8edf8";
const MUTED = "#8aa0c2";
const FAINT = "#526684";
const ACCENT = "#4f87f7";
const RULE = "rgba(232,237,248,0.075)";
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
        <header style={{ marginBottom: 40, maxWidth: 780 }}>
          <div style={{ color: ACCENT, fontFamily: MONO, fontSize: 10, letterSpacing: "0.26em", textTransform: "uppercase", marginBottom: 18 }}>
            Conviqt Research · Stock Reports
          </div>
          <h1 style={{ color: INK, fontFamily: DISPLAY, fontSize: 52, lineHeight: 1.03, letterSpacing: "-0.02em", fontWeight: 500, margin: "0 0 20px" }}>
            Every verdict, on the record.
          </h1>
          <p style={{ color: MUTED, fontFamily: SERIF, fontSize: 17.5, lineHeight: 1.64, margin: 0, maxWidth: 680 }}>
            The Council&rsquo;s standing call on the S&amp;P 500 and top Nasdaq names. Each page shows the verdict, conviction, and where the agents disagreed — with every number linked to a source. Reports refresh as users run them and on a daily cron, and every page tracks 90 days of conviction history.
          </p>
        </header>

        <ConvictionTimelineCallout />

        <StockBrowser published={published} universe={remaining} />

        <footer style={{ marginTop: 44, paddingTop: 16, borderTop: `1px solid ${RULE}`, color: FAINT, fontSize: 12, lineHeight: 1.6 }}>
          Analysis only, not personalized financial advice. Every quantitative claim links to a source produced by the Council&rsquo;s live web search.
        </footer>
      </main>
    </div>
  );
}

// Names the Conviction Timeline as a first-class feature on the index, so the
// longitudinal AI-consensus dataset is discoverable — not just stumbled upon
// at the bottom of a single ticker page. The mini sparkline is decorative
// (static), mirroring the real chart's conviction-down / disagreement-up story.
function ConvictionTimelineCallout() {
  const conviction = "10,18 70,24 130,33 190,43 234,50";
  const disagree = "10,56 70,50 130,43 190,34 234,28";
  const dots = [
    [10, 18],
    [70, 24],
    [130, 33],
    [190, 43],
    [234, 50],
  ];
  return (
    <section
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 24,
        marginBottom: 36,
        padding: "22px 26px",
        border: `1px solid ${RULE}`,
        borderLeft: `3px solid ${ACCENT}`,
        borderRadius: 10,
        background: "rgba(79,135,247,0.05)",
      }}
    >
      <div style={{ minWidth: 280, flex: "1 1 420px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            color: ACCENT,
            fontFamily: MONO,
            fontSize: 10,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            marginBottom: 12,
          }}
        >
          <span
            style={{
              padding: "2px 7px",
              border: `1px solid ${ACCENT}`,
              borderRadius: 4,
              fontSize: 9,
              letterSpacing: "0.16em",
            }}
          >
            New
          </span>
          <span>Conviction Timeline</span>
        </div>
        <h2 style={{ color: INK, fontFamily: DISPLAY, fontSize: 25, lineHeight: 1.15, letterSpacing: "-0.01em", fontWeight: 500, margin: "0 0 10px" }}>
          See how conviction moved — not just where it stands.
        </h2>
        <p style={{ color: MUTED, fontFamily: SERIF, fontSize: 14.5, lineHeight: 1.6, margin: 0, maxWidth: 560 }}>
          Every report now charts the Council&rsquo;s conviction and disagreement over the trailing 90 days. Each dot is an analysis run — hover to see the verdict, who dissented, and the bull/bear case on that date. It&rsquo;s the first longitudinal dataset of AI disagreement on public equities, and it deepens with every run.
        </p>
      </div>

      <svg
        viewBox="0 0 244 72"
        width={244}
        height={72}
        aria-hidden="true"
        style={{ flex: "0 0 auto", overflow: "visible" }}
      >
        {[14, 36, 58].map((y) => (
          <line key={y} x1={0} x2={244} y1={y} y2={y} stroke={RULE} strokeWidth={1} />
        ))}
        <polyline points={disagree} fill="none" stroke={MUTED} strokeWidth={1.5} strokeDasharray="3 3" opacity={0.7} />
        <polyline points={conviction} fill="none" stroke={ACCENT} strokeWidth={2.25} />
        {dots.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={3} fill={ACCENT} stroke="#0b1020" strokeWidth={1.5} />
        ))}
      </svg>
    </section>
  );
}
