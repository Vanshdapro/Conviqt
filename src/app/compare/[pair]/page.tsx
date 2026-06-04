import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { VALID_TICKER_RE } from "@/lib/agents/router";
import { getCompareReport } from "@/lib/compareReports";
import {
  slugToComparePair,
  comparePairToSlug,
  tickerToSlug,
  universeName,
} from "@/lib/tickers";
import { COMPARE_UNIVERSE } from "@/lib/tickers";
import CompareReport from "@/components/CompareReport";

// ── Static generation + ISR ────────────────────────────────────────────────
// Pre-build the curated COMPARE_UNIVERSE so those matchups are warm in the CDN.
// Re-validate every 24h: the next request after the window picks up the latest
// cached Compare verdict (populated when a user runs "X vs Y" in chat).
// dynamicParams=true lets any other valid pair render on demand from the store —
// we NEVER run the (expensive) Compare from this page, so crawlers can't burn
// the budget.

export const revalidate = 86400; // 24h
export const dynamicParams = true;

const BASE = "https://www.conviqt.com";

export function generateStaticParams() {
  return COMPARE_UNIVERSE.map((p) => ({ pair: comparePairToSlug(p.a, p.b) }));
}

// Parse + validate a slug into the canonical {a, b}. Returns null when the slug
// isn't two distinct valid tickers (→ 404).
function parsePair(slug: string): { a: string; b: string } | null {
  const pair = slugToComparePair(slug);
  if (!pair) return null;
  if (!VALID_TICKER_RE.test(pair.a) || !VALID_TICKER_RE.test(pair.b)) return null;
  return pair;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ pair: string }>;
}): Promise<Metadata> {
  const { pair: slug } = await params;
  const pair = parsePair(slug);

  if (!pair) {
    return { title: "Comparison not found", robots: { index: false, follow: false } };
  }

  const { a, b } = pair;
  // Canonical URL is always the sorted slug, even if this request used the
  // reverse order — so Google collapses both spellings onto one page.
  const canonical = `${BASE}/compare/${comparePairToSlug(a, b)}`;
  const stored = await getCompareReport(a, b);
  const year = new Date().getFullYear();

  // Thin pages (no Compare run yet) are noindex until populated, so we don't
  // dilute the domain with empty placeholders. Once a verdict lands the page
  // becomes indexable on the next revalidate.
  if (!stored) {
    return {
      title: `${a} vs ${b}: Stock Comparison`,
      description: `${a} vs ${b} head-to-head — Conviqt's AI Council weighs both on valuation, positioning, catalysts, and risk/reward, every number source-linked.`,
      alternates: { canonical },
      robots: { index: false, follow: true },
    };
  }

  const { tickerA, tickerB, winner, headline } = stored;
  const winnerTicker = winner === "A" ? tickerA : winner === "B" ? tickerB : null;
  const verdictBit = winnerTicker
    ? `Conviqt's AI Council picks ${winnerTicker}.`
    : `Conviqt's AI Council calls it too close to split.`;
  const title = `${tickerA} vs ${tickerB} (${year}): Which Is the Better Buy?`;
  const description = `${verdictBit} ${headline} Five agents debate each side on valuation, positioning, catalysts, and risk/reward — every figure source-linked.`;

  const ogImage = {
    url: `${BASE}/api/og/compare/${comparePairToSlug(a, b)}?v=${Date.parse(stored.updatedAt)}`,
    width: 1200,
    height: 630,
    alt: `${tickerA} vs ${tickerB} — Conviqt head-to-head verdict`,
  };

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title: `${tickerA} vs ${tickerB} — Conviqt Head-to-Head`,
      description,
      url: canonical,
      type: "article",
      publishedTime: stored.asOf,
      modifiedTime: stored.updatedAt,
      images: [ogImage],
    },
    twitter: {
      card: "summary_large_image",
      title: `${tickerA} vs ${tickerB} — AI head-to-head verdict`,
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
            <Link href="/compare" className="hover:text-foreground transition-colors">Compare</Link>
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

export default async function ComparePage({
  params,
}: {
  params: Promise<{ pair: string }>;
}) {
  const { pair: slug } = await params;
  const pair = parsePair(slug);
  if (!pair) notFound();

  const { a, b } = pair;

  // Send the reverse-order / wrong-case spelling to the canonical sorted slug
  // so we never serve the same comparison on two URLs.
  const canonicalSlug = comparePairToSlug(a, b);
  if (slug !== canonicalSlug) redirect(`/compare/${canonicalSlug}`);

  const stored = await getCompareReport(a, b);
  const nameA = stored?.companyNameA ?? universeName(a) ?? a;
  const nameB = stored?.companyNameB ?? universeName(b) ?? b;

  // ── Comparison pending: no cached Compare run yet ─────────────────────────
  if (!stored) {
    return (
      <Shell>
        <div className="mb-5 mono text-[11px] text-dim">
          <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
          <span className="mx-2">/</span>
          <Link href="/compare" className="hover:text-foreground transition-colors">Compare</Link>
          <span className="mx-2">/</span>
          <span className="text-foreground">{a} vs {b}</span>
        </div>
        <div className="caps text-[9px] text-dim mb-3">Head-to-head</div>
        <h1 className="display text-[44px] sm:text-[56px] text-foreground leading-none tracking-tight">
          {a} <span className="text-dim">vs</span> {b}
        </h1>
        <p className="serif text-[16px] text-muted mt-3">
          {nameA} versus {nameB}
        </p>
        <div className="border border-rule mt-8 px-5 py-6" style={{ background: "var(--surface)" }}>
          <div className="caps text-[9px] text-accent mb-2">Comparison pending</div>
          <p className="serif text-[17px] text-foreground/90 leading-snug max-w-xl">
            No head-to-head verdict has been published for {a} vs {b} yet.
          </p>
          <p className="text-[14px] text-muted mt-3 max-w-xl leading-relaxed">
            Conviqt runs the full five-agent Council on both names, then a comparative
            judge weighs them on valuation, positioning, catalysts, and risk/reward —
            every number cited to a source URL. Run it now and it&rsquo;ll publish here.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href={`/chat?q=${encodeURIComponent(`compare ${a} vs ${b}`)}`}
              className="mono text-[11px] uppercase tracking-[0.16em] px-5 py-3 rounded-sm text-white inline-block"
              style={{ background: "var(--accent)" }}
            >
              Run {a} vs {b} →
            </Link>
          </div>
        </div>
        <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 mono text-[11px] text-dim">
          <span className="text-muted">See each on its own:</span>
          <Link href={`/stock/${tickerToSlug(a)}`} className="hover:text-foreground transition-colors">
            {a} analysis →
          </Link>
          <Link href={`/stock/${tickerToSlug(b)}`} className="hover:text-foreground transition-colors">
            {b} analysis →
          </Link>
        </div>
      </Shell>
    );
  }

  // ── Published comparison ──────────────────────────────────────────────────
  const { tickerA, tickerB, winner, headline } = stored;
  const canonical = `${BASE}/compare/${canonicalSlug}`;
  const winnerTicker = winner === "A" ? tickerA : winner === "B" ? tickerB : null;

  const faqAnswer = winnerTicker
    ? `${headline} Conviqt's AI Council gives the head-to-head edge to ${winnerTicker}. ${stored.report.verdict.bottomLine}`
    : `${headline} Conviqt's AI Council calls it too close to split decisively. ${stored.report.verdict.bottomLine}`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        "@id": `${canonical}#article`,
        url: canonical,
        headline: `${tickerA} vs ${tickerB}: Which Is the Better Buy?`,
        datePublished: stored.asOf,
        dateModified: stored.updatedAt,
        author: { "@type": "Organization", name: "Conviqt", url: BASE },
        publisher: { "@type": "Organization", name: "Conviqt", url: BASE },
        about: [
          { "@type": "FinancialProduct", name: `${tickerA} — ${nameA}`, category: "Equity" },
          { "@type": "FinancialProduct", name: `${tickerB} — ${nameB}`, category: "Equity" },
        ],
        description: headline,
      },
      {
        "@type": "FAQPage",
        "@id": `${canonical}#faq`,
        mainEntity: [
          {
            "@type": "Question",
            name: `Is ${tickerA} or ${tickerB} the better buy?`,
            acceptedAnswer: { "@type": "Answer", text: faqAnswer },
          },
        ],
      },
    ],
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
        <Link href="/compare" className="hover:text-foreground transition-colors">Compare</Link>
        <span className="mx-2">/</span>
        <span className="text-foreground">{tickerA} vs {tickerB}</span>
      </div>

      <h1 className="sr-only">
        {tickerA} vs {tickerB}: which is the better buy? Conviqt AI Council head-to-head.
      </h1>

      <CompareReport result={stored.report} />

      {/* Per-side deep links — feed the internal link graph + give readers the
          single-stock report for each name. */}
      <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 mono text-[11px] text-dim">
        <span className="text-muted">Full single-stock reports:</span>
        <Link href={`/stock/${tickerToSlug(tickerA)}`} className="hover:text-foreground transition-colors">
          {tickerA} analysis →
        </Link>
        <Link href={`/stock/${tickerToSlug(tickerB)}`} className="hover:text-foreground transition-colors">
          {tickerB} analysis →
        </Link>
        <Link href="/compare" className="hover:text-foreground transition-colors">
          More head-to-heads →
        </Link>
      </div>
    </Shell>
  );
}
