import Link from "next/link";
import type { AlphaPick, AlphaPickSource } from "@/lib/alphaTypes";
import { getAlphaStore } from "@/lib/alphaStore";
import { nextRunDate } from "@/lib/alphaPipeline";
import RunNowButton from "./RunNowButton";

// Never statically prerender — picks change at runtime.
export const dynamic = "force-dynamic";

interface PicksData {
  active: AlphaPick[];
  recently_exited: AlphaPick[];
  last_run: string | null;
  next_run: string;
}

async function fetchPicks(): Promise<PicksData> {
  try {
    const store = getAlphaStore();
    const [active, recently_exited, last_run] = await Promise.all([
      store.fetchActive(),
      store.fetchRecentlySold(30),
      store.lastRunDate(),
    ]);
    return { active, recently_exited, last_run, next_run: nextRunDate(new Date()) };
  } catch {
    return { active: [], recently_exited: [], last_run: null, next_run: nextRunDate(new Date()) };
  }
}

function formatDate(iso: string): string {
  return new Date(iso + "T00:00:00Z").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function ConvictionDots({ conviction }: { conviction: number }) {
  const filled = Math.max(0, Math.min(10, conviction));
  return (
    <span className="mono text-[13px] tracking-wider" aria-label={`${conviction}/10 conviction`}>
      {Array.from({ length: 10 }, (_, i) => (
        <span key={i} style={{ color: i < filled ? "var(--bull)" : "var(--dim)" }}>
          {i < filled ? "●" : "○"}
        </span>
      ))}
      <span className="text-dim ml-1.5 text-[11px]">{conviction}/10</span>
    </span>
  );
}

function SourceCitations({ sources }: { sources: AlphaPickSource[] }) {
  function domain(url: string): string {
    try {
      return new URL(url).hostname.replace(/^www\./, "");
    } catch {
      return url.slice(0, 30);
    }
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {sources.map((s, i) => (
        <a
          key={i}
          href={s.url}
          target="_blank"
          rel="noopener noreferrer"
          title={s.title}
          className="mono text-[10px] text-dim hover:text-muted underline underline-offset-2 transition-colors"
        >
          [{i + 1}] {domain(s.url)}
        </a>
      ))}
    </div>
  );
}

function PickCard({ pick }: { pick: AlphaPick }) {
  const upside =
    pick.entry_price > 0
      ? (((pick.target_price - pick.entry_price) / pick.entry_price) * 100).toFixed(1)
      : null;
  const downside =
    pick.entry_price > 0
      ? (((pick.stop_loss - pick.entry_price) / pick.entry_price) * 100).toFixed(1)
      : null;

  return (
    <article
      className="border border-rule overflow-hidden flex flex-col gap-0"
      style={{ background: "var(--surface)", borderLeft: "2px solid var(--accent)" }}
    >
      {/* Header row */}
      <div className="px-5 py-4 border-b border-rule flex items-start justify-between gap-3" style={{ background: "var(--surface-2)" }}>
        <div>
          <div className="mono text-[28px] font-bold text-foreground tracking-tight leading-none">{pick.ticker}</div>
          <div className="serif text-[13px] text-muted mt-0.5">{pick.company_name}</div>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="caps text-[9px] text-dim">Entry</div>
          <div className="mono text-[16px] font-medium text-foreground">${pick.entry_price.toFixed(2)}</div>
          <div className="mono text-[10px] text-dim mt-0.5">{formatDate(pick.entry_date)}</div>
        </div>
      </div>

      {/* Catalyst — no colored background, just caps label */}
      <div className="px-5 py-3 border-b border-rule">
        <div className="caps text-[9px] text-accent mb-1">Catalyst</div>
        <div className="serif text-[13px] text-foreground font-medium leading-snug">{pick.catalyst}</div>
      </div>

      {/* Price targets — borderless grid */}
      <div className="grid grid-cols-2 divide-x divide-rule border-b border-rule">
        <div className="px-5 py-3">
          <div className="caps text-[9px] text-dim mb-0.5">Target</div>
          <div className="mono text-[15px] font-medium" style={{ color: "var(--bull)" }}>${pick.target_price.toFixed(2)}</div>
          {upside && <div className="mono text-[10px] text-dim">+{upside}%</div>}
        </div>
        <div className="px-5 py-3">
          <div className="caps text-[9px] text-dim mb-0.5">Stop</div>
          <div className="mono text-[15px] font-medium text-muted">${pick.stop_loss.toFixed(2)}</div>
          {downside && <div className="mono text-[10px] text-dim">{downside}%</div>}
        </div>
      </div>

      {/* Conviction — use bull color for filled dots */}
      <div className="px-5 py-3 border-b border-rule">
        <div className="caps text-[9px] text-dim mb-1.5">Conviction</div>
        <ConvictionDots conviction={pick.conviction} />
      </div>

      {/* Bull case — plain serif text */}
      <div className="px-5 py-3 border-b border-rule">
        <div className="caps text-[9px] text-dim mb-1.5">Bull case</div>
        <p className="serif text-[13px] text-muted leading-relaxed">{pick.bull_thesis}</p>
      </div>

      {/* Bear case — hold left-border accent */}
      <div className="px-5 py-3 border-b border-rule" style={{ borderLeft: "3px solid var(--hold)", background: "var(--surface-2)" }}>
        <div className="caps text-[9px] mb-1.5" style={{ color: "var(--hold)" }}>Bear case</div>
        <p className="serif text-[13px] leading-relaxed" style={{ color: "#C4A054" }}>{pick.bear_thesis}</p>
      </div>

      {/* Sources */}
      {pick.sources && pick.sources.length > 0 && (
        <div className="px-5 py-3">
          <div className="caps text-[9px] text-dim mb-1.5">Sources</div>
          <SourceCitations sources={pick.sources} />
        </div>
      )}
    </article>
  );
}

export default async function AlphaPage() {
  const data = await fetchPicks();
  const { active, recently_exited, last_run, next_run } = data;

  const isAdminEnabled = process.env.NEXT_PUBLIC_ALPHA_ADMIN_ENABLED === "true";

  return (
    <div className="flex flex-col min-h-screen">
      {/* Utility bar */}
      <div className="border-b border-rule flex-shrink-0" style={{ background: "var(--surface)" }}>
        <div className="mx-auto max-w-[1400px] px-5 lg:px-10 h-7 flex items-center justify-between">
          <Link href="/" className="mono text-[10px] font-bold tracking-[0.2em] text-foreground">CONVIQT</Link>
          <span className="mono text-[10px] text-dim">Alpha Tracker</span>
        </div>
      </div>

      {/* Header */}
      <header className="border-b border-rule flex-shrink-0">
        <div className="mx-auto max-w-[1400px] px-5 lg:px-10 h-12 flex items-center justify-between">
          <Link href="/" className="mono text-[14px] font-bold tracking-[0.2em] text-foreground hover:text-muted transition-colors">CONVIQT</Link>
          <nav className="hidden md:flex items-center gap-5">
            <Link href="/" className="mono text-[12px] text-dim hover:text-foreground transition-colors px-0 py-1.5">Chat</Link>
            <Link href="/alpha" className="mono text-[12px] text-foreground px-0 py-1.5 border-b-2" style={{ borderColor: "var(--accent)" }}>Alpha Tracker</Link>
            <Link href="/methodology" className="mono text-[12px] text-dim hover:text-foreground transition-colors px-0 py-1.5">Methodology</Link>
          </nav>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 mx-auto w-full max-w-[1400px] px-5 lg:px-10 py-10 space-y-12">

        {/* Page title section */}
        <section className="py-8 border-b border-rule">
          <h1 className="text-[2rem] lg:text-[2.6rem] font-bold text-foreground leading-tight tracking-tight">
            Alpha Tracker
          </h1>
          <p className="display italic text-[1.1rem] text-muted mt-1">
            One stock. Every weekday. Full thesis. No noise.
          </p>

          <div className="flex flex-wrap items-center gap-2 mt-4">
            {last_run && (
              <span className="mono text-[10px] px-2 py-1 border border-rule text-dim" style={{ background: "var(--surface-2)" }}>
                Last run: {last_run}
              </span>
            )}
            {next_run && (
              <span className="mono text-[10px] px-2 py-1 border border-rule text-dim" style={{ background: "var(--surface-2)" }}>
                Next run: {next_run}
              </span>
            )}
            {isAdminEnabled && <RunNowButton />}
          </div>
        </section>

        {/* Active positions */}
        <section>
          <h2 className="caps text-[10px] text-accent mb-5">Active Positions ({active.length})</h2>

          {active.length === 0 ? (
            <div
              className="border border-rule p-8 text-center"
              style={{ background: "var(--surface)" }}
            >
              <p className="serif text-[14px] text-muted">
                Today&apos;s pick drops{next_run ? ` ${formatDate(next_run)}` : " soon"}.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {active.map((pick) => (
                <PickCard key={pick.id ?? pick.ticker} pick={pick} />
              ))}
            </div>
          )}
        </section>

        {/* Recently exited */}
        {recently_exited.length > 0 && (
          <section>
            <h2 className="caps text-[10px] text-accent mb-4">Recently Exited</h2>
            <div className="border border-rule overflow-hidden" style={{ background: "var(--surface)" }}>
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-rule" style={{ background: "var(--surface-2)" }}>
                    <th className="text-left px-4 py-2.5 caps text-[9px] text-dim font-medium">Ticker</th>
                    <th className="text-left px-4 py-2.5 caps text-[9px] text-dim font-medium hidden sm:table-cell">Company</th>
                    <th className="text-left px-4 py-2.5 caps text-[9px] text-dim font-medium">Added</th>
                    <th className="text-left px-4 py-2.5 caps text-[9px] text-dim font-medium">Exited</th>
                    <th className="text-left px-4 py-2.5 caps text-[9px] text-dim font-medium hidden md:table-cell">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {recently_exited.map((pick, i) => (
                    <tr
                      key={pick.id ?? i}
                      className="border-b border-rule last:border-0 hover:bg-surface-2 transition-colors"
                    >
                      <td className="px-4 py-2.5 mono text-[12px] font-medium text-foreground">{pick.ticker}</td>
                      <td className="px-4 py-2.5 text-muted hidden sm:table-cell">{pick.company_name}</td>
                      <td className="px-4 py-2.5 mono text-[11px] text-dim">{formatDate(pick.entry_date)}</td>
                      <td className="px-4 py-2.5 mono text-[11px] text-dim">
                        {pick.exit_date ? formatDate(pick.exit_date) : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-dim hidden md:table-cell max-w-xs truncate">
                        {pick.exit_reason ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Disclaimer */}
        <section>
          <p className="mono italic text-[11px] text-dim leading-relaxed">
            Paper-trading exercise for educational purposes only. Nothing published here constitutes investment advice.
            Every number shown must have a source URL. The full track record, without omission, is the point.
          </p>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-rule flex-shrink-0">
        <div className="mx-auto max-w-[1400px] px-5 lg:px-10 h-10 flex items-center justify-between">
          <span className="mono text-[10px] text-dim">CONVIQT · v0.3 · Educational research only.</span>
          <Link href="/" className="mono text-[10px] text-dim hover:text-muted transition-colors">← Chat</Link>
        </div>
      </footer>
    </div>
  );
}
