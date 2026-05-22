import Link from "next/link";

const PIPELINE = [
  {
    step: "01",
    name: "Sweep",
    model: "Haiku 4.5",
    desc: "Runs web_search (max 5 queries) against the open web. Builds a FactSheet where every fact carries the URL it came from. No URL, no fact.",
    detail: "Price · fundamentals · technicals · news · insider activity · macro",
  },
  {
    step: "02",
    name: "Fundamentals",
    model: "Haiku 4.5",
    desc: "Reads the FactSheet and issues BUY / HOLD / SELL based on valuation, earnings quality, and balance sheet strength. Cites source indexes.",
    detail: "P/E · EPS growth · FCF · debt ratios · margins",
  },
  {
    step: "03",
    name: "Technicals",
    model: "Haiku 4.5",
    desc: "Evaluates price action, momentum, and chart structure from the FactSheet. Confidence drops when technical data is sparse.",
    detail: "Trend · RSI · MACD · support/resistance · volume",
  },
  {
    step: "04",
    name: "Sentiment",
    model: "Haiku 4.5",
    desc: "Weighs news tone, insider transactions, and short interest. Flags sentiment divergence from fundamentals.",
    detail: "News tone · insider buys/sells · short interest · analyst ratings",
  },
  {
    step: "05",
    name: "Macro",
    model: "Haiku 4.5",
    desc: "Places the ticker in macroeconomic context — rate environment, sector rotation, currency exposure. Issues a macro headwind or tailwind call.",
    detail: "Fed policy · yield curve · sector flows · FX exposure",
  },
  {
    step: "06",
    name: "Judge",
    model: "Sonnet 4.6",
    desc: "Synthesizes all four specialist reports into a final BUY / HOLD / SELL with a conviction score (0–10) and a disagreement score. High disagreement is the signal, not a failure.",
    detail: "Consensus + dissent · conviction · disagreement · catalysts",
  },
];

const PRINCIPLES = [
  {
    label: "No synthetic data",
    body: "Every quantitative claim in every report links to a public URL produced by Claude's web_search tool. If the Sweep could not find a fact, that lane gets flagged and its specialist's confidence drops to zero. There is no fallback — we say so.",
  },
  {
    label: "Disagreement is the product",
    body: "When specialists disagree, the Judge publishes the dissents alongside the verdict. A high disagreement score is not a bug — it is the most valuable signal we generate. It tells you the setup is contested, and you should price that uncertainty.",
  },
  {
    label: "We never claim to beat the market",
    body: "The Alpha Tracker is an educational exercise. We market transparency, not alpha. Every losing trade is published alongside every winner, with the same level of detail. The full track record, without omission, is the point.",
  },
];

export default function MethodologyPage() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Brand accent stripe */}
      <div
        className="h-px flex-shrink-0"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, var(--accent) 40%, var(--accent) 60%, transparent 100%)",
          opacity: 0.7,
        }}
      />

      {/* Utility bar */}
      <div className="border-b border-rule flex-shrink-0" style={{ background: "var(--surface)" }}>
        <div className="mx-auto max-w-[1400px] px-5 lg:px-10 h-8 flex items-center justify-between">
          <Link
            href="/"
            className="mono text-[10px] text-dim hover:text-muted transition-colors flex items-center gap-1.5"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path
                d="M7 2L3 5L7 8"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Chat
          </Link>
          <span className="mono text-[10px] text-dim">v0.2</span>
        </div>
      </div>

      {/* Header */}
      <header className="border-b border-rule flex-shrink-0">
        <div className="mx-auto max-w-[1400px] px-5 lg:px-10 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div
              className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0"
              style={{
                background: "var(--accent-dim)",
                border: "1px solid var(--accent-border)",
              }}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path
                  d="M2 6 L5 3 L10 3 M5 9 L10 9 M7 6 L10 6"
                  stroke="var(--accent)"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <span className="text-[15px] font-semibold text-foreground tracking-tight">
              Conviqt
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-0.5">
            <Link
              href="/"
              className="px-3 py-1.5 text-[13px] text-muted hover:text-foreground hover:bg-surface-2 rounded transition-colors"
            >
              Chat
            </Link>
            <Link
              href="/alpha"
              className="px-3 py-1.5 text-[13px] text-muted hover:text-foreground hover:bg-surface-2 rounded transition-colors"
            >
              Alpha Tracker
            </Link>
            <Link
              href="/methodology"
              className="px-3 py-1.5 text-[13px] font-medium text-foreground rounded"
              style={{ background: "var(--surface-3)" }}
            >
              Methodology
            </Link>
          </nav>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1">
        {/* Hero */}
        <section className="border-b border-rule">
          <div className="mx-auto max-w-[1400px] px-5 lg:px-10 py-16 lg:py-20">
            <div className="max-w-[760px]">
              <div className="caps text-dim mb-5">How it works</div>
              <h1 className="text-[2.4rem] lg:text-[3rem] font-semibold text-foreground leading-[1.08] tracking-[-0.02em] mb-5">
                One sweep.
                <br />
                Four specialists.
                <br />
                <span className="text-muted font-light">One judge. Every dissent published.</span>
              </h1>
              <p className="text-[15px] text-muted leading-relaxed max-w-[560px]">
                When you ask Conviqt to analyze a stock, six agents run
                sequentially. Each one only sees facts that carry a source URL.
                The final report is a synthesis of four independent verdicts —
                agreements and disagreements alike.
              </p>
            </div>
          </div>
        </section>

        {/* Pipeline */}
        <section className="border-b border-rule">
          <div className="mx-auto max-w-[1400px] px-5 lg:px-10 py-14">
            <div className="caps text-dim mb-8">Pipeline</div>
            <div className="space-y-0 divide-y divide-rule">
              {PIPELINE.map((p) => (
                <div
                  key={p.step}
                  className="py-5 grid grid-cols-12 gap-5 items-start"
                >
                  {/* Step number */}
                  <div className="col-span-1">
                    <span className="mono text-[13px] text-dim">{p.step}</span>
                  </div>

                  {/* Name + model */}
                  <div className="col-span-11 md:col-span-2">
                    <div className="text-[15px] font-semibold text-foreground">
                      {p.name}
                    </div>
                    <div
                      className="mono text-[10px] mt-1 rounded-full px-2 py-0.5 inline-block border border-rule"
                      style={{
                        color: "var(--accent)",
                        background: "var(--accent-dim)",
                        borderColor: "var(--accent-border)",
                      }}
                    >
                      {p.model}
                    </div>
                  </div>

                  {/* Description */}
                  <div className="col-span-11 md:col-span-5 col-start-2 md:col-start-auto">
                    <p className="text-[14px] text-muted leading-relaxed">
                      {p.desc}
                    </p>
                  </div>

                  {/* Detail tags */}
                  <div className="col-span-11 md:col-span-4 col-start-2 md:col-start-auto">
                    <p className="mono text-[10px] text-dim leading-relaxed">
                      {p.detail}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Principles */}
        <section className="border-b border-rule">
          <div className="mx-auto max-w-[1400px] px-5 lg:px-10 py-14">
            <div className="caps text-dim mb-8">Principles</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {PRINCIPLES.map((pr) => (
                <div
                  key={pr.label}
                  className="border border-rule rounded p-5"
                  style={{ background: "var(--surface)" }}
                >
                  <div className="text-[14px] font-semibold text-foreground mb-3">
                    {pr.label}
                  </div>
                  <p className="text-[13px] text-muted leading-relaxed">
                    {pr.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Specs sidebar */}
        <section>
          <div className="mx-auto max-w-[1400px] px-5 lg:px-10 py-14">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
              <div>
                <div className="caps text-dim mb-3">Data source</div>
                <ul className="space-y-2 text-[13px] text-muted">
                  <li>Claude web_search tool</li>
                  <li>No paid financial APIs</li>
                  <li>Every fact cites its URL</li>
                </ul>
              </div>
              <div>
                <div className="caps text-dim mb-3">Cost per query</div>
                <ul className="space-y-2 text-[13px] text-muted">
                  <li>
                    <span className="mono text-foreground/70">Analysis</span> ·
                    3–7¢
                  </li>
                  <li>
                    <span className="mono text-foreground/70">Stock pick</span>{" "}
                    · 5–12¢
                  </li>
                  <li>
                    <span className="mono text-foreground/70">General chat</span>{" "}
                    · &lt;1¢
                  </li>
                </ul>
              </div>
              <div>
                <div className="caps text-dim mb-3">Cadence</div>
                <ul className="space-y-2 text-[13px] text-muted">
                  <li>On-demand chat · 24/7</li>
                  <li>Alpha picks · 2/wk max</li>
                  <li>Disagreement board · daily</li>
                </ul>
              </div>
              <div>
                <div className="caps text-dim mb-3">Stack</div>
                <ul className="space-y-2 text-[13px] text-muted">
                  <li>Next.js · App Router</li>
                  <li>Anthropic Claude API</li>
                  <li>Supabase · Vercel</li>
                </ul>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-rule">
        <div className="mx-auto max-w-[1400px] px-5 lg:px-10 h-12 flex items-center justify-between">
          <span className="mono text-[10px] text-dim">
            Conviqt · v0.2 · Educational research only.
          </span>
          <Link
            href="/"
            className="mono text-[10px] text-dim hover:text-muted transition-colors"
          >
            ← Back to Chat
          </Link>
        </div>
      </footer>
    </div>
  );
}
