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
  comparePairsFor,
  comparePairToSlug,
} from "@/lib/tickers";
import PublicStockReport from "@/components/stock/PublicStockReport";
import { PseoShell, ResearchCta } from "@/components/pseo/PseoShell";

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
      description: `AI stock research on ${TICK} (${name}): fundamentals, technicals, sentiment, and macro weighed in plain English — every number cited.`,
      alternates: { canonical },
      robots: { index: false, follow: true },
    };
  }

  const verdict = verdictPhrase(stored.verdict);
  const title = `${TICK} Stock Analysis ${year}: ${verdict} — ${name}`;
  const description = `Conviqt's analysts rate ${TICK} a ${stored.verdict} with ${stored.conviction}/100 conviction. ${stored.report.judge.bottomLine} Every figure is source-linked.`;

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
      title: `${TICK} — ${verdict} | Conviqt AI Stock Research`,
      description,
      url: canonical,
      type: "article",
      publishedTime: stored.asOf,
      modifiedTime: stored.updatedAt,
      images: [ogImage],
    },
    twitter: {
      card: "summary_large_image",
      title: `${TICK} — the analysts' verdict: ${stored.verdict}`,
      description,
      images: [ogImage],
    },
  };
}

// Cross-link this ticker into the head-to-head graph: curated matchups that
// include it. Internal links both ways (ticker ⇄ compare) are what make the
// pSEO pages compound. Renders nothing when the ticker has no curated rival.
function RelatedCompares({ ticker }: { ticker: string }) {
  const pairs = comparePairsFor(ticker);
  if (pairs.length === 0) return null;
  return (
    <section className="mt-10 border-t border-rule pt-6">
      <div className="caps text-[9px] text-accent mb-3">Head-to-head</div>
      <div className="flex flex-wrap gap-2">
        {pairs.map((p) => {
          const other = p.a === ticker.toUpperCase() ? p.b : p.a;
          return (
            <Link
              key={`${p.a}-${p.b}`}
              href={`/compare/${comparePairToSlug(p.a, p.b)}`}
              className="mono text-[11px] text-muted border border-rule px-3 py-2 rounded-sm hover:text-foreground transition-colors"
            >
              {ticker.toUpperCase()} vs {other}
            </Link>
          );
        })}
        <Link
          href="/compare"
          className="mono text-[11px] text-dim px-3 py-2 hover:text-foreground transition-colors"
        >
          all comparisons →
        </Link>
      </div>
    </section>
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

  // ── Report pending: no cached research run yet ────────────────────────────
  if (!stored) {
    const known = isUniverseTicker(TICK);
    return (
      <PseoShell>
        <div className="caps mb-3">Ticker</div>
        <h1 className="display text-[56px] text-foreground leading-none tracking-tight">{TICK}</h1>
        {known && <p className="serif text-[16px] text-muted mt-3">{name}</p>}
        <div className="border border-rule mt-8 px-5 py-6 rounded-[14px]" style={{ background: "var(--surface)" }}>
          <div className="caps mb-2" style={{ color: "var(--accent-hover)" }}>Report pending</div>
          <p className="serif text-[17px] text-foreground/90 leading-snug max-w-xl">
            No verdict has been published for {TICK} yet.
          </p>
          <p className="text-[14px] text-muted mt-3 max-w-xl leading-relaxed">
            Conviqt&rsquo;s analysts weigh {name}&rsquo;s fundamentals, technicals, sentiment, and
            macro over live web data — every number cited to a source URL. Run the research and
            it&rsquo;ll publish here.
          </p>
        </div>
        <RelatedCompares ticker={TICK} />
        <ResearchCta query={`analyze ${TICK}`} label={`Research ${TICK} on Conviqt`} />
      </PseoShell>
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
    name: `${TICK} Stock Analysis — Conviqt analysts' verdict: ${stored.verdict}`,
    reviewBody: stored.report.judge.investmentCase,
  };

  return (
    <PseoShell>
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
      <RelatedCompares ticker={TICK} />
      <ResearchCta query={`analyze ${TICK}`} label={`Research ${TICK} on Conviqt`} />
    </PseoShell>
  );
}
