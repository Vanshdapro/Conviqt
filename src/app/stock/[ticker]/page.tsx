import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ ticker: string }>;
}): Promise<Metadata> {
  const { ticker } = await params;
  const TICK = ticker.toUpperCase();
  return {
    title: `${TICK} Stock Analysis`,
    description: `AI equity research on ${TICK}. Five agents debate fundamentals, technicals, sentiment, and macro — every number cited.`,
    alternates: { canonical: `https://www.conviqt.com/stock/${TICK.toLowerCase()}` },
    openGraph: {
      title: `${TICK} — AI Equity Research | Conviqt`,
      description: `Five AI agents analyze ${TICK} with live web data. Every fact has a source URL.`,
      url: `https://www.conviqt.com/stock/${TICK.toLowerCase()}`,
      type: "website",
    },
  };
}

// Legacy /stock/[ticker] route. In v0.2 (chat-first) the canonical entry
// point is the homepage. Bouncing users to / with a hint preserves any
// old links without dead pages.

export default async function StockPage({
  params,
}: {
  params: Promise<{ ticker: string }>;
}) {
  const { ticker } = await params;
  const TICK = ticker.toUpperCase();

  // If you want immediate redirect uncomment the next line. For now
  // render a redirect prompt so users can keep their place if they
  // bookmarked the route.
  if (process.env.AUTO_REDIRECT_STOCK_PAGE === "1") {
    redirect("/");
  }

  return (
    <div className="flex flex-col min-h-screen">
      <div className="border-b border-rule">
        <div className="mx-auto max-w-[1400px] px-6 lg:px-10 py-2 flex items-center justify-between text-[11px] mono text-muted">
          <Link href="/" className="hover:text-foreground transition-colors">
            ← Chat
          </Link>
          <span>v0.2 · legacy route</span>
        </div>
      </div>

      <header className="border-b border-rule">
        <div className="mx-auto max-w-[1400px] px-6 lg:px-10 pt-10 pb-6">
          <Link href="/" className="block">
            <div className="serif text-4xl lg:text-5xl leading-none tracking-tight text-foreground">
              Conviqt
            </div>
            <div className="mono text-[11px] text-muted mt-3 uppercase tracking-[0.22em]">
              Legacy stock page
            </div>
          </Link>
        </div>
      </header>

      <section className="flex-1 border-b border-rule">
        <div className="mx-auto max-w-[1400px] px-6 lg:px-10 py-16 grid grid-cols-12 gap-10">
          <div className="col-span-12 lg:col-span-7">
            <div className="mono caps mb-3">Ticker</div>
            <h1 className="mono text-6xl lg:text-7xl font-medium text-foreground tracking-tight leading-none">
              {TICK}
            </h1>
            <p className="serif italic text-2xl text-foreground/90 mt-10 max-w-2xl leading-snug">
              Conviqt is chat-first now. To run the Council on {TICK}, go to
              the homepage and type &ldquo;analyze {TICK}&rdquo;.
            </p>
            <p className="text-base text-muted mt-6 max-w-2xl leading-relaxed">
              We removed the static stock detail page in v0.2 because every
              analysis is now generated on demand against live web data.
              Static rendering of stale cached results would violate our
              freshness-first rule.
            </p>
            <div className="mt-8">
              <Link
                href="/"
                className="mono text-[11px] uppercase tracking-[0.18em] border border-rule rounded-sm px-4 py-3 hover:border-foreground hover:text-foreground transition-colors"
              >
                Open chat →
              </Link>
            </div>
          </div>
          <aside className="col-span-12 lg:col-span-5 lg:pl-10 lg:border-l lg:border-rule">
            <div className="caps mb-2">What changed in v0.2</div>
            <ul className="space-y-2 text-sm text-muted">
              <li>No paid financial APIs.</li>
              <li>Claude web_search is the only data source.</li>
              <li>Every quantitative claim is cited.</li>
              <li>Reports render inside the chat thread.</li>
            </ul>
          </aside>
        </div>
      </section>

      <footer className="border-t border-rule">
        <div className="mx-auto max-w-[1400px] px-6 lg:px-10 py-6 flex items-center justify-between text-[11px] mono text-muted">
          <span>Conviqt · v0.2</span>
          <span>Educational research only.</span>
        </div>
      </footer>
    </div>
  );
}
