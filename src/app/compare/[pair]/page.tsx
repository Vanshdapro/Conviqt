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
import { PseoShell, ResearchCta } from "@/components/pseo/PseoShell";

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
      description: `${a} vs ${b} head-to-head — Conviqt's analysts weigh both on valuation, positioning, catalysts, and risk/reward, every number source-linked.`,
      alternates: { canonical },
      robots: { index: false, follow: true },
    };
  }

  const { tickerA, tickerB, winner, headline } = stored;
  const winnerTicker = winner === "A" ? tickerA : winner === "B" ? tickerB : null;
  const verdictBit = winnerTicker
    ? `Conviqt's analysts pick ${winnerTicker}.`
    : `Conviqt's analysts call it too close to split.`;
  const title = `${tickerA} vs ${tickerB} (${year}): Which Is the Better Buy?`;
  const description = `${verdictBit} ${headline} Each side weighed on valuation, positioning, catalysts, and risk/reward — every figure source-linked.`;

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
      <PseoShell>
        <div className="mb-5 mono text-[11px] text-dim">
          <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
          <span className="mx-2">/</span>
          <Link href="/compare" className="hover:text-foreground transition-colors">Compare</Link>
          <span className="mx-2">/</span>
          <span className="text-foreground">{a} vs {b}</span>
        </div>
        <div className="caps mb-3">Head-to-head</div>
        <h1 className="display text-[44px] sm:text-[56px] text-foreground leading-none tracking-tight">
          {a} <span className="text-dim">vs</span> {b}
        </h1>
        <p className="serif text-[16px] text-muted mt-3">
          {nameA} versus {nameB}
        </p>
        <div className="border border-rule mt-8 px-5 py-6 rounded-[14px]" style={{ background: "var(--surface)" }}>
          <div className="caps mb-2" style={{ color: "var(--accent-hover)" }}>Comparison pending</div>
          <p className="serif text-[17px] text-foreground/90 leading-snug max-w-xl">
            No head-to-head verdict has been published for {a} vs {b} yet.
          </p>
          <p className="text-[14px] text-muted mt-3 max-w-xl leading-relaxed">
            Conviqt&rsquo;s analysts research both names in full, then weigh them against each
            other on valuation, positioning, catalysts, and risk/reward — every number cited to
            a source URL. Run it and it&rsquo;ll publish here.
          </p>
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
        <ResearchCta query={`compare ${a} vs ${b}`} label={`Run ${a} vs ${b} on Conviqt`} />
      </PseoShell>
    );
  }

  // ── Published comparison ──────────────────────────────────────────────────
  const { tickerA, tickerB, winner, headline } = stored;
  const canonical = `${BASE}/compare/${canonicalSlug}`;
  const winnerTicker = winner === "A" ? tickerA : winner === "B" ? tickerB : null;

  const faqAnswer = winnerTicker
    ? `${headline} Conviqt's analysts give the head-to-head edge to ${winnerTicker}. ${stored.report.verdict.bottomLine}`
    : `${headline} Conviqt's analysts call it too close to split decisively. ${stored.report.verdict.bottomLine}`;

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
    <PseoShell>
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
        {tickerA} vs {tickerB}: which is the better buy? Conviqt head-to-head.
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
      <ResearchCta
        query={`compare ${tickerA} vs ${tickerB}`}
        label={`Run ${tickerA} vs ${tickerB} on Conviqt`}
      />
    </PseoShell>
  );
}
