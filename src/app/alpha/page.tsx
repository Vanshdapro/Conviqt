import Link from "next/link";
import type { AlphaPick, AlphaPickSource } from "@/lib/alphaTypes";
import { getSupabaseAnon } from "@/lib/supabase";
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

// Read directly from Supabase on the server side — no self-fetch needed.
async function fetchPicks(): Promise<PicksData> {
  try {
    const db = getSupabaseAnon();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    const [activeRes, recentRes, lastRunRes] = await Promise.all([
      db.from("alpha_picks").select("*").eq("status", "ACTIVE").order("created_at", { ascending: false }),
      db.from("alpha_picks").select("*").eq("status", "SOLD").gte("exit_date", thirtyDaysAgo).order("exit_date", { ascending: false }),
      db.from("alpha_picks").select("created_at").order("created_at", { ascending: false }).limit(1),
    ]);

    const last_run = lastRunRes.data?.[0]?.created_at?.slice(0, 10) ?? null;
    return {
      active: (activeRes.data ?? []) as AlphaPick[],
      recently_exited: (recentRes.data ?? []) as AlphaPick[],
      last_run,
      next_run: nextRunDate(new Date()),
    };
  } catch {
    // Supabase not configured yet or credentials wrong — render empty state.
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
        <span key={i} style={{ color: i < filled ? "var(--accent)" : "var(--dim)" }}>
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
      className="border border-rule rounded-lg p-5 flex flex-col gap-4"
      style={{ background: "var(--surface)" }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[1.6rem] font-semibold text-foreground tracking-tight leading-none">
            {pick.ticker}
          </div>
          <div className="text-[13px] text-muted mt-0.5">{pick.company_name}</div>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="text-[11px] text-dim caps">Entry</div>
          <div className="text-[15px] font-medium text-foreground">
            ${pick.entry_price.toFixed(2)}
          </div>
          <div className="text-[11px] text-dim mt-0.5">{formatDate(pick.entry_date)}</div>
        </div>
      </div>

      {/* Catalyst badge */}
      <div
        className="rounded px-3 py-2"
        style={{ background: "var(--accent-dim)", border: "1px solid var(--accent-border)" }}
      >
        <div className="caps text-[10px] mb-0.5" style={{ color: "var(--accent)" }}>
          Catalyst
        </div>
        <div className="text-[13px] text-foreground font-medium leading-snug">
          {pick.catalyst}
        </div>
      </div>

      {/* Price targets row */}
      <div className="grid grid-cols-2 gap-3">
        <div
          className="rounded px-3 py-2"
          style={{ background: "var(--surface-2)", border: "1px solid var(--rule)" }}
        >
          <div className="caps text-[10px] text-dim mb-0.5">Target</div>
          <div className="text-[14px] font-medium" style={{ color: "var(--bull)" }}>
            ${pick.target_price.toFixed(2)}
          </div>
          {upside && (
            <div className="text-[11px] text-dim">+{upside}%</div>
          )}
        </div>
        <div
          className="rounded px-3 py-2"
          style={{ background: "var(--surface-2)", border: "1px solid var(--rule)" }}
        >
          <div className="caps text-[10px] text-dim mb-0.5">Stop</div>
          <div className="text-[14px] font-medium text-muted">
            ${pick.stop_loss.toFixed(2)}
          </div>
          {downside && (
            <div className="text-[11px] text-dim">{downside}%</div>
          )}
        </div>
      </div>

      {/* Conviction */}
      <div>
        <div className="caps text-[10px] text-dim mb-1.5">Conviction</div>
        <ConvictionDots conviction={pick.conviction} />
      </div>

      {/* Bull case */}
      <div>
        <div className="caps text-[10px] text-dim mb-1.5">Bull Case</div>
        <p className="text-[13px] text-muted leading-relaxed">{pick.bull_thesis}</p>
      </div>

      {/* Bear case — amber-tinted treatment */}
      <div
        className="rounded px-3 py-3"
        style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.18)" }}
      >
        <div
          className="caps text-[10px] mb-1.5"
          style={{ color: "var(--hold)" }}
        >
          Bear Case
        </div>
        <p className="text-[13px] leading-relaxed" style={{ color: "#C4A054" }}>
          {pick.bear_thesis}
        </p>
      </div>

      {/* Sources */}
      {pick.sources && pick.sources.length > 0 && (
        <div>
          <div className="caps text-[10px] text-dim mb-1.5">Sources</div>
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
          <span className="mono text-[10px] text-dim">v0.3</span>
        </div>
      </div>

      {/* Header */}
      <header className="border-b border-rule flex-shrink-0">
        <div className="mx-auto max-w-[1400px] px-5 lg:px-10 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
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
              className="px-3 py-1.5 text-[13px] font-medium text-foreground rounded"
              style={{ background: "var(--surface-3)" }}
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

      {/* Main content */}
      <main className="flex-1 mx-auto w-full max-w-[1400px] px-5 lg:px-10 py-10 space-y-12">

        {/* Page title + meta */}
        <section className="space-y-4">
          <div>
            <h1 className="text-[2rem] lg:text-[2.4rem] font-semibold text-foreground leading-tight tracking-tight">
              Alpha Tracker
            </h1>
            <p className="text-[15px] text-muted mt-2">
              Two stocks. Twice a week. Full thesis. No noise.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {last_run && (
              <span
                className="mono text-[11px] px-2.5 py-1 rounded"
                style={{ background: "var(--surface-2)", border: "1px solid var(--rule)", color: "var(--muted)" }}
              >
                Last run: {last_run}
              </span>
            )}
            {next_run && (
              <span
                className="mono text-[11px] px-2.5 py-1 rounded"
                style={{ background: "var(--surface-2)", border: "1px solid var(--rule)", color: "var(--muted)" }}
              >
                Next run: {next_run}
              </span>
            )}
            {isAdminEnabled && <RunNowButton />}
          </div>

          <p className="text-[11px] text-dim">
            Not financial advice. Educational AI research only.
          </p>
        </section>

        {/* Active positions */}
        <section>
          <h2 className="text-[1rem] font-semibold text-foreground mb-5">
            Active Positions ({active.length})
          </h2>

          {active.length === 0 ? (
            <div
              className="border border-rule rounded-lg p-8 text-center"
              style={{ background: "var(--surface)" }}
            >
              <p className="text-[14px] text-muted">
                Next picks drop{next_run ? ` ${formatDate(next_run)}` : " soon"}.
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
            <h2 className="text-[1rem] font-semibold text-foreground mb-5">
              Recently Exited
            </h2>
            <div
              className="border border-rule rounded-lg overflow-hidden"
              style={{ background: "var(--surface)" }}
            >
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-rule">
                    <th className="text-left px-4 py-3 text-dim caps text-[10px] font-medium">Ticker</th>
                    <th className="text-left px-4 py-3 text-dim caps text-[10px] font-medium hidden sm:table-cell">Company</th>
                    <th className="text-left px-4 py-3 text-dim caps text-[10px] font-medium">Added</th>
                    <th className="text-left px-4 py-3 text-dim caps text-[10px] font-medium">Exited</th>
                    <th className="text-left px-4 py-3 text-dim caps text-[10px] font-medium hidden md:table-cell">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {recently_exited.map((pick, i) => (
                    <tr
                      key={pick.id ?? i}
                      className="border-b border-rule last:border-0"
                    >
                      <td className="px-4 py-3 font-medium text-foreground">{pick.ticker}</td>
                      <td className="px-4 py-3 text-muted hidden sm:table-cell">{pick.company_name}</td>
                      <td className="px-4 py-3 text-dim">{formatDate(pick.entry_date)}</td>
                      <td className="px-4 py-3 text-dim">
                        {pick.exit_date ? formatDate(pick.exit_date) : "—"}
                      </td>
                      <td className="px-4 py-3 text-dim hidden md:table-cell max-w-xs truncate">
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
          <div
            className="border border-rule rounded px-5 py-4 flex items-start gap-3"
            style={{ background: "var(--surface)" }}
          >
            <span
              className="caps text-[10px] flex-shrink-0 mt-0.5"
              style={{ color: "var(--hold)" }}
            >
              Disclaimer
            </span>
            <p className="text-[12px] text-dim leading-relaxed">
              This is a paper-trading exercise for educational purposes only. Nothing
              published here constitutes investment advice. Past simulated performance
              has no bearing on future real returns. Every number shown must have a
              source URL — if no sources appear on a card, the pick was rejected before
              publication.
            </p>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-rule">
        <div className="mx-auto max-w-[1400px] px-5 lg:px-10 h-12 flex items-center justify-between">
          <span className="mono text-[10px] text-dim">
            Conviqt · v0.3 · Educational research only.
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
