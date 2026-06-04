import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getVerifiedUser } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";

// Owned funnel dashboard: visitor → signup → checkout → paid, from our own
// analytics_events + the Stripe-fed `paid` event. Gated to ADMIN_EMAILS, always
// noindex, and read live (no caching) so it reflects the latest events.

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Funnel",
  robots: { index: false, follow: false },
};

interface FunnelRow {
  visitors: number;
  signups: number;
  checkouts: number;
  paid: number;
}
interface DailyRow {
  day: string;
  visitors: number;
  signups: number;
  paid: number;
}
interface SourceRow {
  source: string;
  visitors: number;
}

function adminEmails(): Set<string> {
  return new Set(
    (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
  );
}

function pct(n: number, d: number): string {
  if (!d) return "—";
  return `${((n / d) * 100).toFixed(1)}%`;
}

function Stat({
  label,
  value,
  conv,
}: {
  label: string;
  value: number;
  conv?: string;
}) {
  return (
    <div className="border border-rule px-5 py-5 flex-1 min-w-[150px]" style={{ background: "var(--surface)" }}>
      <div className="caps text-[9px] text-dim">{label}</div>
      <div className="display text-[40px] text-foreground leading-none mt-2">
        {value.toLocaleString()}
      </div>
      {conv && (
        <div className="mono text-[10px] text-accent mt-2">{conv} of prior step</div>
      )}
    </div>
  );
}

export default async function FunnelDashboard({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  // ── Gate ──────────────────────────────────────────────────────────────────
  const user = await getVerifiedUser();
  const allow = adminEmails();
  if (!user || allow.size === 0 || !allow.has(user.email)) {
    // 404 rather than 403 — don't reveal the dashboard exists.
    notFound();
  }

  const { days: daysParam } = await searchParams;
  const days = [7, 30, 90].includes(Number(daysParam)) ? Number(daysParam) : 30;

  let funnel: FunnelRow = { visitors: 0, signups: 0, checkouts: 0, paid: 0 };
  let daily: DailyRow[] = [];
  let sources: SourceRow[] = [];
  let dbError: string | null = null;

  try {
    const db = getSupabaseAdmin();
    const [f, d, s] = await Promise.all([
      db.rpc("analytics_funnel", { p_days: days }),
      db.rpc("analytics_daily", { p_days: days }),
      db.rpc("analytics_top_sources", { p_days: days, p_limit: 10 }),
    ]);
    if (f.error) throw new Error(f.error.message);
    const row = (f.data as FunnelRow[] | null)?.[0];
    if (row) {
      funnel = {
        visitors: Number(row.visitors) || 0,
        signups: Number(row.signups) || 0,
        checkouts: Number(row.checkouts) || 0,
        paid: Number(row.paid) || 0,
      };
    }
    daily = ((d.data as DailyRow[] | null) ?? []).map((r) => ({
      day: r.day,
      visitors: Number(r.visitors) || 0,
      signups: Number(r.signups) || 0,
      paid: Number(r.paid) || 0,
    }));
    sources = ((s.data as SourceRow[] | null) ?? []).map((r) => ({
      source: r.source,
      visitors: Number(r.visitors) || 0,
    }));
  } catch (err) {
    dbError = err instanceof Error ? err.message : String(err);
  }

  const maxDailyVisitors = Math.max(1, ...daily.map((d) => d.visitors));

  return (
    <div className="flex flex-col min-h-screen" style={{ background: "var(--background)" }}>
      <header className="border-b border-rule">
        <div className="mx-auto max-w-[1100px] px-6 lg:px-10 py-4 flex items-center justify-between">
          <Link href="/" className="serif text-[22px] text-foreground tracking-tight">Conviqt</Link>
          <div className="flex items-center gap-4 mono text-[11px] uppercase tracking-[0.16em] text-muted">
            <span className="text-dim">Funnel ·</span>
            {[7, 30, 90].map((d) => (
              <Link
                key={d}
                href={`/admin/funnel?days=${d}`}
                className={d === days ? "text-accent" : "hover:text-foreground transition-colors"}
              >
                {d}d
              </Link>
            ))}
          </div>
        </div>
      </header>

      <main className="flex-1">
        <div className="mx-auto max-w-[1100px] px-6 lg:px-10 py-10">
          <div className="caps text-[9px] text-dim mb-3">Last {days} days</div>
          <h1 className="display text-[40px] text-foreground leading-none tracking-tight">
            Acquisition funnel
          </h1>
          <p className="serif text-[15px] text-muted mt-3 max-w-2xl">
            First-party, cookieless. Visitors are distinct anonymous IDs; paid is the
            authoritative Stripe checkout event.
          </p>

          {dbError && (
            <div className="border border-rule mt-6 px-5 py-4 mono text-[12px] text-hold" style={{ background: "var(--surface)" }}>
              Analytics store unavailable: {dbError}. Run migration 019 and set
              Supabase env vars.
            </div>
          )}

          {/* Funnel */}
          <section className="mt-8 flex flex-wrap gap-3">
            <Stat label="Visitors" value={funnel.visitors} />
            <Stat label="Signups" value={funnel.signups} conv={pct(funnel.signups, funnel.visitors)} />
            <Stat label="Checkouts" value={funnel.checkouts} conv={pct(funnel.checkouts, funnel.signups)} />
            <Stat label="Paid" value={funnel.paid} conv={pct(funnel.paid, funnel.checkouts)} />
          </section>
          <div className="mono text-[11px] text-dim mt-3">
            Visitor → paid: <span className="text-foreground">{pct(funnel.paid, funnel.visitors)}</span>
          </div>

          {/* Daily */}
          <section className="mt-10">
            <div className="caps text-[9px] text-accent mb-4">Daily</div>
            {daily.length === 0 ? (
              <p className="mono text-[12px] text-dim">No events recorded yet.</p>
            ) : (
              <div className="border border-rule" style={{ background: "var(--surface)" }}>
                {daily.map((d) => (
                  <div key={d.day} className="grid grid-cols-[100px_1fr_auto] items-center gap-3 px-4 py-2 border-b border-rule last:border-b-0">
                    <span className="mono text-[11px] text-muted">{d.day}</span>
                    <div className="h-[6px] bg-rule overflow-hidden">
                      <div className="h-full" style={{ width: `${(d.visitors / maxDailyVisitors) * 100}%`, background: "var(--accent)" }} />
                    </div>
                    <span className="mono text-[11px] text-dim w-44 text-right">
                      {d.visitors.toLocaleString()} vis · {d.signups} sign · {d.paid} paid
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Sources */}
          <section className="mt-10">
            <div className="caps text-[9px] text-accent mb-4">Top sources (first-touch)</div>
            {sources.length === 0 ? (
              <p className="mono text-[12px] text-dim">No sources yet.</p>
            ) : (
              <div className="border border-rule" style={{ background: "var(--surface)" }}>
                {sources.map((s) => (
                  <div key={s.source} className="flex items-center justify-between px-4 py-2.5 border-b border-rule last:border-b-0">
                    <span className="mono text-[12px] text-foreground/85">{s.source}</span>
                    <span className="mono text-[12px] text-muted">{s.visitors.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
