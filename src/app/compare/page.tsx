import type { Metadata } from "next";
import Link from "next/link";
import { getCompareReportStore } from "@/lib/compareReports";
import { COMPARE_UNIVERSE, comparePairToSlug, comparePairKey } from "@/lib/tickers";

// The compare hub: a published index of head-to-head verdicts plus the curated
// matchup list. Indexable (unlike the thin pair pages) — it's a real content
// surface that links into every /compare/[pair], seeding the internal link
// graph that makes the pSEO pages compound.

export const revalidate = 86400; // 24h — picks up newly-published comparisons

const BASE = "https://www.conviqt.com";

export const metadata: Metadata = {
  title: "Stock Comparisons: Head-to-Head AI Verdicts",
  description:
    "Side-by-side AI equity research. Conviqt's Council runs the full five-agent debate on both names, then a comparative judge weighs valuation, positioning, catalysts, and risk/reward — every number source-linked.",
  alternates: { canonical: `${BASE}/compare` },
  openGraph: {
    title: "Stock Comparisons — Conviqt Head-to-Head AI Verdicts",
    description:
      "Which is the better buy? Cited, accountable head-to-head stock comparisons from Conviqt's AI Council.",
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
    <div className="flex flex-col min-h-screen" style={{ background: "var(--background)" }}>
      {published.length > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(itemList) }}
        />
      )}
      <header className="border-b border-rule">
        <div className="mx-auto max-w-[1100px] px-6 lg:px-10 py-4 flex items-center justify-between">
          <Link href="/" className="serif text-[22px] text-foreground tracking-tight">
            Conviqt
          </Link>
          <nav className="flex items-center gap-5 mono text-[11px] uppercase tracking-[0.16em] text-muted">
            <Link href="/stock" className="hover:text-foreground transition-colors">Stocks</Link>
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
        <div className="mx-auto max-w-[1100px] px-6 lg:px-10 py-10">
          <div className="caps text-[9px] text-dim mb-3">Head-to-head</div>
          <h1 className="display text-[40px] sm:text-[52px] text-foreground leading-none tracking-tight">
            Stock comparisons
          </h1>
          <p className="serif text-[16px] text-muted mt-4 max-w-2xl leading-relaxed">
            Which is the better buy? The Council runs its full five-agent debate on
            both names, then a comparative judge weighs them on valuation, positioning,
            catalysts, and risk/reward — every number cited to a source URL.
          </p>

          {/* ── Published verdicts ─────────────────────────────────────────── */}
          {published.length > 0 && (
            <section className="mt-10">
              <div className="caps text-[9px] text-accent mb-4">Latest verdicts</div>
              <div className="grid sm:grid-cols-2 gap-3">
                {published.map((s) => {
                  const wt = winnerTickerOf(s);
                  return (
                    <Link
                      key={s.pairKey}
                      href={`/compare/${comparePairToSlug(s.tickerA, s.tickerB)}`}
                      className="border border-rule px-4 py-4 hover:border-accent transition-colors block"
                      style={{ background: "var(--surface)" }}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="display text-[20px] text-foreground tracking-tight">
                          {s.tickerA} <span className="text-dim text-[15px]">vs</span> {s.tickerB}
                        </span>
                        <span className="mono text-[10px] text-muted">
                          {wt ? (
                            <>
                              edge <span style={{ color: "var(--accent)" }}>{wt}</span>
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
              <div className="caps text-[9px] text-accent mb-4">
                {published.length > 0 ? "More matchups" : "Popular matchups"}
              </div>
              <div className="flex flex-wrap gap-2">
                {suggested.map((p) => (
                  <Link
                    key={comparePairKey(p.a, p.b)}
                    href={`/compare/${comparePairToSlug(p.a, p.b)}`}
                    className="mono text-[11px] text-muted border border-rule px-3 py-2 rounded-sm hover:text-foreground hover:border-accent transition-colors"
                  >
                    {p.a} vs {p.b}
                  </Link>
                ))}
              </div>
              <p className="text-[12px] text-dim mt-4 max-w-xl leading-relaxed">
                Don&rsquo;t see a matchup? Type{" "}
                <span className="mono text-muted">&ldquo;compare NVDA vs AMD&rdquo;</span> in the
                chat and the verdict publishes here.
              </p>
            </section>
          )}
        </div>
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
