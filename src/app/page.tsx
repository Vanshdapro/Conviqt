import Link from "next/link";
import Chat from "@/components/Chat";

export default function Home() {
  const date = new Date();
  const dateStr = date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

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
      <div className="border-b border-rule bg-surface/60 flex-shrink-0">
        <div className="mx-auto max-w-[1400px] px-5 lg:px-10 h-8 flex items-center justify-between">
          <div className="flex items-center gap-5 mono text-[10px]">
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-bull pulse" />
              <span className="text-muted">Live</span>
            </span>
            <span className="hidden sm:inline text-dim">{dateStr}</span>
          </div>
          <div className="flex items-center gap-5 mono text-[10px] text-dim">
            <span className="hidden md:inline">Claude · web_search</span>
            <span>v0.2</span>
          </div>
        </div>
      </div>

      {/* Main header */}
      <header className="border-b border-rule flex-shrink-0">
        <div className="mx-auto max-w-[1400px] px-5 lg:px-10 h-14 flex items-center justify-between">
          {/* Wordmark */}
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
            <span className="text-[15px] font-semibold text-foreground tracking-tight group-hover:text-foreground transition-colors">
              Conviqt
            </span>
          </Link>

          {/* Navigation */}
          <nav className="hidden md:flex items-center gap-0.5">
            <Link
              href="/"
              className="px-3 py-1.5 text-[13px] font-medium text-foreground rounded"
              style={{ background: "var(--surface-3)" }}
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
              className="px-3 py-1.5 text-[13px] text-muted hover:text-foreground hover:bg-surface-2 rounded transition-colors"
            >
              Methodology
            </Link>
          </nav>
        </div>
      </header>

      {/* Chat */}
      <Chat />

      {/* Footer */}
      <footer className="border-t border-rule flex-shrink-0">
        <div className="mx-auto max-w-[1400px] px-5 lg:px-10 py-8 grid grid-cols-12 gap-y-8 gap-x-6">
          {/* Brand */}
          <div className="col-span-12 md:col-span-5">
            <div className="flex items-center gap-2 mb-3">
              <div
                className="w-5 h-5 rounded flex items-center justify-center"
                style={{
                  background: "var(--accent-dim)",
                  border: "1px solid var(--accent-border)",
                }}
              >
                <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                  <path
                    d="M2 6 L5 3 L10 3 M5 9 L10 9 M7 6 L10 6"
                    stroke="var(--accent)"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <span className="text-sm font-semibold text-foreground">
                Conviqt
              </span>
            </div>
            <p className="text-[12px] text-dim leading-relaxed max-w-xs">
              AI-driven equity research with a transparent disagreement signal.
              Every number cites a source. Educational only — not investment
              advice.
            </p>
          </div>

          {/* Pages */}
          <div className="col-span-6 md:col-span-2 md:col-start-7">
            <div className="caps mb-3 text-dim">Pages</div>
            <div className="space-y-2">
              <Link
                href="/"
                className="block text-[12px] text-muted hover:text-foreground transition-colors"
              >
                Chat
              </Link>
              <Link
                href="/alpha"
                className="block text-[12px] text-muted hover:text-foreground transition-colors"
              >
                Alpha Tracker
              </Link>
              <Link
                href="/methodology"
                className="block text-[12px] text-muted hover:text-foreground transition-colors"
              >
                Methodology
              </Link>
            </div>
          </div>

          {/* Stack */}
          <div className="col-span-6 md:col-span-2">
            <div className="caps mb-3 text-dim">Stack</div>
            <div className="space-y-2 text-[12px] text-dim">
              <div>Sonnet 4.6</div>
              <div>Haiku 4.5</div>
              <div>Claude web_search</div>
            </div>
          </div>

          {/* Build info */}
          <div className="col-span-12 md:col-span-3 md:text-right">
            <div className="caps mb-3 text-dim md:text-right">Build</div>
            <div className="space-y-1.5 text-[11px] mono text-dim">
              <div>v0.2 · {date.getFullYear()}</div>
              <div>Chat-first. Cited every claim.</div>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-rule">
          <div className="mx-auto max-w-[1400px] px-5 lg:px-10 h-9 flex items-center justify-between">
            <span className="mono text-[10px] text-dim">
              Educational research only. Not investment advice.
            </span>
            <span className="mono text-[10px] text-dim">
              © {date.getFullYear()} Conviqt
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
