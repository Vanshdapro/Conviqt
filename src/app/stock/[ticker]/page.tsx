import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { VALID_TICKER_RE } from "@/lib/agents/router";
import { getStockReport } from "@/lib/stockReports";
import { getConvictionHistory } from "@/lib/convictionHistory";
import {
  STOCK_UNIVERSE,
  universeName,
  isUniverseTicker,
  slugToTicker,
} from "@/lib/tickers";
import PublicStockReport from "@/components/stock/PublicStockReport";

// ── Static generation + ISR ────────────────────────────────────────────────
// Pre-build the S&P 500 + top Nasdaq universe so those pages are warm in the
// CDN. Re-validate every 24h: the next request after the window picks up the
// latest cached Council report (populated by user queries + the refresh cron).
// dynamicParams=true lets any other valid ticker render on demand from the
// store — we never run the (expensive) Council from this page, so crawlers
// can't burn the budget.

export const revalidate = 86400; // 24h
export const dynamicParams = true;

const BASE = "https://www.conviqt.com";

export function generateStaticParams() {
  return STOCK_UNIVERSE.map((e) => ({ ticker: e.ticker.toLowerCase() }));
}

function verdictPhrase(v: "BUY" | "HOLD" | "SELL"): string {
  if (v === "BUY") return "Buy";
  if (v === "SELL") return "Sell";
  return "Hold";
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ ticker: string }>;
}): Promise<Metadata> {
  const { ticker } = await params;
  const TICK = slugToTicker(ticker);

  if (!VALID_TICKER_RE.test(TICK)) {
    return { title: "Stock not found", robots: { index: false, follow: false } };
  }

  const canonical = `${BASE}/stock/${TICK.toLowerCase()}`;
  const stored = await getStockReport(TICK);
  const name = stored?.companyName ?? universeName(TICK) ?? TICK;
  const year = new Date().getFullYear();

  // Thin pages (no Council report yet) are noindex until populated, so we
  // don't dilute the domain with empty placeholders. Once a report lands the
  // page becomes indexable on the next revalidate.
  if (!stored) {
    return {
      title: `${TICK} Stock Analysis — ${name}`,
      description: `AI equity research on ${TICK} (${name}). Five agents debate fundamentals, technicals, sentiment, and macro — every number cited.`,
      alternates: { canonical },
      robots: { index: false, follow: true },
    };
  }

  const verdict = verdictPhrase(stored.verdict);
  const title = `${TICK} Stock Analysis ${year}: ${verdict} — ${name}`;
  const description = `Conviqt's AI Council rates ${TICK} a ${stored.verdict} with ${stored.conviction}/100 conviction. ${stored.report.judge.bottomLine} Every figure is source-linked.`;

  // The shareable verdict card — its mtime busts crawler/CDN caches so the
  // image tracks the latest Council run rather than a stale snapshot.
  const ogImage = {
    url: `${BASE}/api/og/${TICK.toLowerCase()}?v=${Date.parse(stored.updatedAt)}`,
    width: 1200,
    height: 630,
    alt: `${TICK} — Conviqt Council verdict: ${stored.verdict}, ${stored.conviction}/100 conviction`,
  };

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title: `${TICK} — ${verdict} | Conviqt AI Equity Research`,
      description,
      url: canonical,
      type: "article",
      publishedTime: stored.asOf,
      modifiedTime: stored.updatedAt,
      images: [ogImage],
    },
    twitter: {
      card: "summary_large_image",
      title: `${TICK} — AI Council verdict: ${stored.verdict}`,
      description,
      images: [ogImage],
    },
  };
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen" style={{ background: "var(--background)" }}>
      <header className="border-b border-rule">
        <div className="mx-auto max-w-[1100px] px-6 lg:px-10 py-4 flex items-center justify-between">
          <Link href="/" className="serif text-[22px] text-foreground tracking-tight">
            Conviqt
          </Link>
          <nav className="flex items-center gap-5 mono text-[11px] uppercase tracking-[0.16em] text-muted">
            <Link href="/alpha" className="hover:text-foreground transition-colors">Alpha</Link>
            <Link href="/methodology" className="hover:text-foreground transition-colors">Method</Link>
            <Link
              href="/"
              className="px-3 py-2 rounded-sm text-white"
              style={{ background: "var(--accent)" }}
            >
              Open chat
            </Link>
          </nav>
        </div>
      </header>
      <main className="flex-1">
        <div className="mx-auto max-w-[1100px] px-6 lg:px-10 py-10">{children}</div>
      </main>
      <footer className="border-t border-rule">
        <div className="mx-auto max-w-[1100px] px-6 lg:px-10 py-6 flex items-center justify-between text-[11px] mono text-muted">
          <span>Conviqt · AI equity research</span>
          <span>Not investment advice.</span>
        </div>
      </footer>
    </div>
  );
}

export default async function StockPage({
  params,
}: {
  params: Promise<{ ticker: string }>;
}) {
  const { ticker } = await params;
  const TICK = slugToTicker(ticker);

  if (!VALID_TICKER_RE.test(TICK)) {
    notFound();
  }

  const [stored, history] = await Promise.all([
    getStockReport(TICK),
    getConvictionHistory(TICK, 90),
  ]);
  const name = stored?.companyName ?? universeName(TICK) ?? TICK;

  // ── Report pending: no cached Council run yet ─────────────────────────────
  if (!stored) {
    const known = isUniverseTicker(TICK);
    return (
      <Shell>
        <div className="caps text-[9px] text-dim mb-3">Ticker</div>
        <h1 className="display text-[56px] text-foreground leading-none tracking-tight">{TICK}</h1>
        {known && <p className="serif text-[16px] text-muted mt-3">{name}</p>}
        <div className="border border-rule mt-8 px-5 py-6" style={{ background: "var(--surface)" }}>
          <div className="caps text-[9px] text-accent mb-2">Report pending</div>
          <p className="serif text-[17px] text-foreground/90 leading-snug max-w-xl">
            No Council verdict has been published for {TICK} yet.
          </p>
          <p className="text-[14px] text-muted mt-3 max-w-xl leading-relaxed">
            Conviqt runs five AI agents over live web data to debate {name}&rsquo;s
            fundamentals, technicals, sentiment, and macro — every number cited to a
            source URL. Run one now and it&rsquo;ll publish here.
          </p>
          <div className="mt-6">
            <Link
              href={`/chat?q=${encodeURIComponent(`analyze ${TICK}`)}`}
              className="mono text-[11px] uppercase tracking-[0.16em] px-5 py-3 rounded-sm text-white inline-block"
              style={{ background: "var(--accent)" }}
            >
              Run the Council on {TICK} →
            </Link>
          </div>
        </div>
      </Shell>
    );
  }

  // ── Published report ──────────────────────────────────────────────────────
  const canonical = `${BASE}/stock/${TICK.toLowerCase()}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Review",
    url: canonical,
    datePublished: stored.asOf,
    dateModified: stored.updatedAt,
    author: { "@type": "Organization", name: "Conviqt", url: BASE },
    publisher: { "@type": "Organization", name: "Conviqt", url: BASE },
    itemReviewed: {
      "@type": "FinancialProduct",
      name: `${TICK} — ${name}`,
      category: "Equity",
      ...(stored.sector ? { description: `${name} (${stored.sector})` } : {}),
    },
    reviewRating: {
      "@type": "Rating",
      ratingValue: stored.conviction,
      bestRating: 100,
      worstRating: 0,
      alternateName: `${stored.verdict} (conviction ${stored.conviction}/100)`,
    },
    name: `${TICK} Stock Analysis — Conviqt AI Council verdict: ${stored.verdict}`,
    reviewBody: stored.report.judge.investmentCase,
  };

  return (
    <Shell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="mb-5 mono text-[11px] text-dim">
        <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
        <span className="mx-2">/</span>
        <Link href="/stock" className="hover:text-foreground transition-colors">Stock</Link>
        <span className="mx-2">/</span>
        <span className="text-foreground">{TICK}</span>
      </div>
      <PublicStockReport data={stored} history={history} />
    </Shell>
  );
}
