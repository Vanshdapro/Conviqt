import type { Metadata } from "next";
import { StockBrowser } from "@/components/stock/StockBrowser";
import { PseoShell, ResearchCta } from "@/components/pseo/PseoShell";
import { getStockReportStore, type ReportSummary } from "@/lib/stockReports";
import { STOCK_UNIVERSE } from "@/lib/tickers";

// Browsable index for the public /stock/[ticker] report pages — Almanac brand
// (playbook Phase 6). Published verdicts lead; the full pre-built universe
// follows so the page is useful — and richly internally-linked for crawlers —
// even before every ticker has a cached report. The search box + list
// rendering live in <StockBrowser/> (a client island); data is fetched here so
// the full list still server-renders into the initial HTML.

export const revalidate = 3600; // refresh the published list hourly

const BASE = "https://www.conviqt.com";

export const metadata: Metadata = {
  title: "Stock Reports — the analysts' verdicts",
  description:
    "Browse Conviqt's verdicts across the S&P 500 and top Nasdaq names. Each report weighs fundamentals, technicals, sentiment, and macro — every number source-linked.",
  alternates: { canonical: `${BASE}/stock` },
  openGraph: {
    title: "Stock Reports | Conviqt AI Stock Research",
    description:
      "Plain-English stock verdicts across the S&P 500 and top Nasdaq names — conviction, how split the analysts were, and cited sources for every figure.",
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
    <PseoShell>
      <header className="mb-10 max-w-[780px]">
        <div className="caps mb-4" style={{ color: "var(--accent-hover)" }}>
          Conviqt Research · Stock Reports
        </div>
        <h1 className="display text-[40px] sm:text-[52px] text-foreground leading-[1.03] tracking-tight mb-5">
          Every verdict, on the record.
        </h1>
        <p className="text-[17px] text-muted leading-relaxed max-w-[680px]">
          The standing call on the S&amp;P 500 and top Nasdaq names. Each page shows the verdict,
          how sure the analysts were, and where they disagreed — with every number linked to a
          source. Reports refresh as people run them, and every page tracks 90 days of conviction
          history.
        </p>
      </header>

      <ConvictionTimelineCallout />

      <StockBrowser published={published} universe={remaining} />

      <ResearchCta query="analyze NVDA" label="Research any stock on Conviqt" />

      <footer
        className="mt-11 pt-4 text-[12px] leading-relaxed"
        style={{ borderTop: "1px solid var(--border)", color: "var(--text-muted)" }}
      >
        Analysis only, not personalized financial advice. Every quantitative claim links to a
        source found during live research.
      </footer>
    </PseoShell>
  );
}

// Names the Conviction Timeline as a first-class feature on the index, so the
// longitudinal conviction dataset is discoverable — not just stumbled upon at
// the bottom of a single ticker page. The mini sparkline is decorative
// (static), mirroring the real chart's conviction-down / split-up story.
// Token colors only: teal line, espresso-muted dashed line, tan rules.
function ConvictionTimelineCallout() {
  const conviction = "10,18 70,24 130,33 190,43 234,50";
  const split = "10,56 70,50 130,43 190,34 234,28";
  const dots = [
    [10, 18],
    [70, 24],
    [130, 33],
    [190, 43],
    [234, 50],
  ];
  return (
    <section
      className="flex flex-wrap items-center justify-between gap-6 mb-9 px-6 py-5 rounded-[14px]"
      style={{
        border: "1px solid var(--border)",
        borderLeft: "3px solid var(--accent)",
        background: "var(--bg-surface)",
      }}
    >
      <div className="min-w-[280px] flex-[1_1_420px]">
        <div className="caps mb-3 flex items-center gap-2" style={{ color: "var(--accent-hover)" }}>
          <span
            className="px-2 py-[2px] rounded-[4px] text-[9px]"
            style={{ border: "1px solid var(--accent)" }}
          >
            New
          </span>
          <span>Conviction Timeline</span>
        </div>
        <h2 className="display text-[24px] leading-[1.15] tracking-tight mb-2 text-foreground">
          See how conviction moved — not just where it stands.
        </h2>
        <p className="text-[14px] text-muted leading-relaxed max-w-[560px]">
          Every report charts how sure the analysts were — and how split — over the trailing 90
          days. Each dot is a research run: hover to see the verdict, the dissent, and the bull and
          bear case on that date. It deepens with every run.
        </p>
      </div>

      <svg
        viewBox="0 0 244 72"
        width={244}
        height={72}
        aria-hidden="true"
        className="flex-none overflow-visible"
      >
        {[14, 36, 58].map((y) => (
          <line key={y} x1={0} x2={244} y1={y} y2={y} stroke="var(--border)" strokeWidth={1} />
        ))}
        <polyline
          points={split}
          fill="none"
          stroke="var(--text-muted)"
          strokeWidth={1.5}
          strokeDasharray="3 3"
          opacity={0.7}
        />
        <polyline points={conviction} fill="none" stroke="var(--accent)" strokeWidth={2.25} />
        {dots.map(([x, y], i) => (
          <circle
            key={i}
            cx={x}
            cy={y}
            r={3}
            fill="var(--accent)"
            stroke="var(--bg-surface)"
            strokeWidth={1.5}
          />
        ))}
      </svg>
    </section>
  );
}
