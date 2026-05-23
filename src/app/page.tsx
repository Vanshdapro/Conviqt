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
      {/* Utility bar */}
      <div className="h-7 border-b border-rule bg-surface flex-shrink-0">
        <div className="mx-auto max-w-[1400px] px-5 lg:px-10 h-full flex items-center justify-between">
          <span className="mono text-[10px] font-bold tracking-[0.2em] text-foreground">
            CONVIQT
          </span>
          <span className="mono text-[10px] text-dim">{dateStr}</span>
        </div>
      </div>

      {/* Main header */}
      <header className="h-12 border-b border-rule flex-shrink-0">
        <div className="mx-auto max-w-[1400px] px-5 lg:px-10 h-full flex items-center justify-between">
          {/* Wordmark */}
          <Link href="/">
            <span className="mono text-[14px] font-bold tracking-[0.2em] text-foreground">
              CONVIQT
            </span>
          </Link>

          {/* Navigation */}
          <nav className="hidden md:flex items-center">
            <Link
              href="/"
              className="mono text-[12px] text-foreground border-b-2 pb-px px-3 py-1.5"
              style={{ borderColor: "var(--accent)" }}
            >
              Chat
            </Link>
            <Link
              href="/alpha"
              className="mono text-[12px] text-dim hover:text-foreground transition-colors px-3 py-1.5"
            >
              Alpha Tracker
            </Link>
            <Link
              href="/methodology"
              className="mono text-[12px] text-dim hover:text-foreground transition-colors px-3 py-1.5"
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
        <div className="mx-auto max-w-[1400px] px-5 lg:px-10 h-10 flex items-center justify-between">
          <span className="mono text-[10px] text-dim">
            CONVIQT · v0.3 · Educational research only. Not investment advice.
          </span>
          <div className="flex items-center gap-5 mono text-[10px] text-dim">
            <Link href="/alpha" className="hover:text-muted transition-colors">
              Alpha Tracker
            </Link>
            <Link
              href="/methodology"
              className="hover:text-muted transition-colors"
            >
              Methodology
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
