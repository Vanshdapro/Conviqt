import type { Metadata } from "next";
import Link from "next/link";
import { getCompareReportStore } from "@/lib/compareReports";
import { COMPARE_UNIVERSE, comparePairToSlug, comparePairKey } from "@/lib/tickers";
import { stripCitationTags } from "@/lib/citations";
import { PseoShell, ResearchCta } from "@/components/pseo/PseoShell";

// The compare hub: a published index of head-to-head verdicts plus the curated
// matchup list. Indexable (unlike the thin pair pages) — it's a real content
// surface that links into every /compare/[pair], seeding the internal link
// graph that makes the pSEO pages compound. Almanac brand (playbook Phase 6).

export const revalidate = 86400; // 24h — picks up newly-published comparisons

const BASE = "https://www.conviqt.com";

export const metadata: Metadata = {
  title: "Stock Comparisons: Head-to-Head Verdicts",
  description:
    "Side-by-side stock research in plain English. Conviqt's analysts research both names in full, then weigh them on valuation, positioning, catalysts, and risk/reward — every number source-linked.",
  alternates: { canonical: `${BASE}/compare` },
  openGraph: {
    title: "Stock Comparisons — Conviqt Head-to-Head Verdicts",
    description:
      "Which is the better buy? Cited, accountable head-to-head stock comparisons from Conviqt.",
    url: `${BASE}/compare`,
    type: "website",
  },
};

function winnerTickerOf(s: {
  winner: "A" | "B" | "TIE";
  tickerA: string;
  tickerB: string;
}): string | null {
  return s.winner === "A" ? s.tickerA : s.winner === "B" ? s.tickerB : null;
}

export default async function CompareHub() {
  let published: Awaited<ReturnType<ReturnType<typeof getCompareReportStore>["listSummaries"]>> = [];
  try {
    published = await getCompareReportStore().listSummaries(200);
    // Scrub Claude web_search <cite …> markup from cached verdict headlines.
    published = published.map((s) => ({ ...s, headline: stripCitationTags(s.headline) }));
  } catch {
    published = [];
  }

  // Curated matchups not yet published — shown as suggestions so every pair has
  // an inbound link even before a verdict lands.
  const publishedKeys = new Set(published.map((p) => p.pairKey));
  const suggested = COMPARE_UNIVERSE.filter(
    (p) => !publishedKeys.has(comparePairKey(p.a, p.b))
  );

  const itemList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Conviqt stock comparisons",
    itemListElement: published.slice(0, 50).map((s, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `${BASE}/compare/${comparePairToSlug(s.tickerA, s.tickerB)}`,
      name: `${s.tickerA} vs ${s.tickerB}`,
    })),
  };

  return (
    <PseoShell>
      {published.length > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(itemList) }}
        />
      )}
      <div className="caps mb-3">Head-to-head</div>
      <h1 className="display text-[40px] sm:text-[52px] text-foreground leading-none tracking-tight">
        Stock comparisons
      </h1>
      <p className="serif text-[16px] text-muted mt-4 max-w-2xl leading-relaxed">
        Which is the better buy? Conviqt&rsquo;s analysts research both names in full, then weigh
        them against each other on valuation, positioning, catalysts, and risk/reward — every
        number cited to a source URL.
      </p>

      {/* ── Published verdicts ─────────────────────────────────────────── */}
      {published.length > 0 && (
        <section className="mt-10">
          <div className="caps mb-4" style={{ color: "var(--accent-hover)" }}>Latest verdicts</div>
          <div className="grid sm:grid-cols-2 gap-3">
            {published.map((s) => {
              const wt = winnerTickerOf(s);
              return (
                <Link
                  key={s.pairKey}
                  href={`/compare/${comparePairToSlug(s.tickerA, s.tickerB)}`}
                  className="border border-rule rounded-[14px] px-4 py-4 hover:border-accent transition-colors block"
                  style={{ background: "var(--surface)" }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="display text-[20px] text-foreground tracking-tight">
                      {s.tickerA} <span className="text-dim text-[15px]">vs</span> {s.tickerB}
                    </span>
                    <span className="mono text-[10px] text-muted">
                      {wt ? (
                        <>
                          edge <span style={{ color: "var(--accent-hover)" }}>{wt}</span>
                        </>
                      ) : (
                        <span style={{ color: "var(--hold)" }}>too close</span>
                      )}
                    </span>
                  </div>
                  <p className="serif text-[13px] text-foreground/75 mt-2 leading-snug line-clamp-2">
                    {s.headline}
                  </p>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Suggested matchups ─────────────────────────────────────────── */}
      {suggested.length > 0 && (
        <section className="mt-10">
          <div className="caps mb-4" style={{ color: "var(--accent-hover)" }}>
            {published.length > 0 ? "More matchups" : "Popular matchups"}
          </div>
          <div className="flex flex-wrap gap-2">
            {suggested.map((p) => (
              <Link
                key={comparePairKey(p.a, p.b)}
                href={`/compare/${comparePairToSlug(p.a, p.b)}`}
                className="mono text-[11px] text-muted border border-rule px-3 py-2 rounded-[9px] hover:text-foreground hover:border-accent transition-colors"
              >
                {p.a} vs {p.b}
              </Link>
            ))}
          </div>
          <p className="text-[12px] text-dim mt-4 max-w-xl leading-relaxed">
            Don&rsquo;t see a matchup? Run the{" "}
            <span className="mono text-muted">Face-Off</span> skill on any two tickers and the
            verdict publishes here.
          </p>
        </section>
      )}

      <ResearchCta query="compare NVDA vs AMD" label="Run a Face-Off on Conviqt" />
    </PseoShell>
  );
}
