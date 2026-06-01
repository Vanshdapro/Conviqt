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
            The Council&rsquo;s standing call on the S&amp;P 500 and top Nasdaq names. Each page shows the verdict, conviction, and where the agents disagreed — with every number linked to a source. Reports refresh as users run them and on a daily cron.
          </p>
        </header>

        <StockBrowser published={published} universe={remaining} />

        <footer style={{ marginTop: 44, paddingTop: 16, borderTop: `1px solid ${RULE}`, color: FAINT, fontSize: 12, lineHeight: 1.6 }}>
          Analysis only, not personalized financial advice. Every quantitative claim links to a source produced by the Council&rsquo;s live web search.
        </footer>
      </main>
    </div>
  );
}
