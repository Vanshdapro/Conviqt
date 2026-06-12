// Shared shell for the public pSEO surfaces (/stock, /stock/[ticker],
// /compare, /compare/[pair]) — Almanac brand (playbook Phase 6). The
// `cvq-pseo` wrapper class remaps the legacy dark-theme CSS variables
// (--background/--surface/--rule/--bull/--bear/…) onto the Almanac tokens, so
// the report components restyle without rewriting their markup (see app.css).
//
// Every page ends in <ResearchCta/> — the "Research this on Conviqt" close.

import Link from "next/link";

export function PseoShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="cvq-pseo flex flex-col min-h-screen">
      <header className="cvq-pseo-header">
        <Link href="/" className="cvq-land-wordmark">
          CONVI<span className="cvq-land-wordmark-q">Q</span>T
        </Link>
        <nav className="cvq-pseo-nav">
          <Link href="/stock">Stocks</Link>
          <Link href="/compare">Compare</Link>
          <Link href="/login">Log in</Link>
          <Link href="/signup" className="cvq-btn cvq-btn--primary cvq-pseo-nav-cta">
            Start free
          </Link>
        </nav>
      </header>
      <main className="flex-1">
        <div className="mx-auto max-w-[1100px] px-6 lg:px-10 py-10">{children}</div>
      </main>
      <footer className="cvq-pseo-footer">
        <div className="cvq-pseo-footer-row">
          <span>© {new Date().getFullYear()} Conviqt</span>
          <Link href="/methodology">How it works</Link>
        </div>
        <p>
          Conviqt is a research and education tool, not a licensed financial adviser. Nothing here
          is financial advice. Markets involve risk.
        </p>
      </footer>
    </div>
  );
}

// The closing CTA every pSEO page ends with. `query` prefills the Research
// surface (e.g. "analyze NVDA", "compare NVDA vs AMD").
export function ResearchCta({ query, label }: { query: string; label?: string }) {
  return (
    <section className="cvq-pseo-cta">
      <h2>Research this on Conviqt</h2>
      <p>
        Ask anything about any stock — plain-English answers with live market data, and a public
        track record we can&rsquo;t hide from.
      </p>
      <div className="cvq-pseo-cta-row">
        <Link
          href={`/research?q=${encodeURIComponent(query)}`}
          className="cvq-btn cvq-btn--primary"
        >
          {label ?? "Research this on Conviqt"}
        </Link>
        <Link href="/signup" className="cvq-btn cvq-btn--secondary">
          Start free
        </Link>
      </div>
    </section>
  );
}
