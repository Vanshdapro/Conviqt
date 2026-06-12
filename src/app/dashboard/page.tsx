import type { Metadata } from "next";
import Link from "next/link";
import { Card, ChangePill, EmptyState, StatTile, TickerChip } from "@/components/ui";
import { quote } from "@/lib/marketdata";
import type { Quote } from "@/lib/marketdata";
import { readDashboard } from "@/lib/feed/store";
import { SNAPSHOT_TICKERS, timeAgo, type DashboardContent } from "@/lib/feed/types";
import { getAlphaStore } from "@/lib/alphaStore";
import type { AlphaPick } from "@/lib/alphaTypes";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Dashboard",
  robots: { index: false, follow: false },
};

// Dashboard (playbook Phase 4): Market Snapshot, Today's Trends, Early
// Signals, Picks (the public track record — losses visible), Upcoming Events.
// Trends/Signals/Events come from the globally shared 2×/day cache
// (/api/feed/refresh); snapshot + P/L prices come from the marketdata layer's
// shared 15-minute cache at view time. Server component: nothing here is
// interactive, so we render once with honest timestamps.

// ── Picks: P/L + track-record stats ─────────────────────────────────────────

interface PickView {
  pick: AlphaPick;
  open: boolean;
  /** % return — live for open picks, realized for closed. null = unavailable. */
  returnPct: number | null;
  /** Current/exit price backing returnPct. */
  price: number | null;
  /** When the price is a stored snapshot, the date it was taken. */
  priceAsOfNote: string | null;
}

async function loadPicks(): Promise<PickView[]> {
  const store = getAlphaStore();
  const [active, sold] = await Promise.all([
    store.fetchActive(),
    store.fetchRecentlySold(3650), // full history — losses included
  ]);

  const openViews = await Promise.all(
    active.map(async (pick): Promise<PickView> => {
      const q = await quote(pick.ticker);
      if (q) {
        return {
          pick,
          open: true,
          returnPct: ((q.price - pick.entry_price) / pick.entry_price) * 100,
          price: q.price,
          priceAsOfNote: null,
        };
      }
      // Live quote unavailable — fall back to the pipeline's last snapshot,
      // honestly dated. Never a guessed number.
      if (pick.current_price && pick.price_change_pct !== null && pick.price_change_pct !== undefined) {
        return {
          pick,
          open: true,
          returnPct: pick.price_change_pct,
          price: pick.current_price,
          priceAsOfNote: pick.price_last_updated
            ? `as of ${pick.price_last_updated.slice(0, 10)}`
            : "last check",
        };
      }
      return { pick, open: true, returnPct: null, price: null, priceAsOfNote: null };
    })
  );

  const soldViews = sold.map((pick): PickView => {
    const realized =
      pick.realized_return_pct ??
      (pick.exit_price ? ((pick.exit_price - pick.entry_price) / pick.entry_price) * 100 : null);
    return {
      pick,
      open: false,
      returnPct: realized,
      price: pick.exit_price ?? null,
      priceAsOfNote: null,
    };
  });

  openViews.sort((a, b) => (b.pick.entry_date || "").localeCompare(a.pick.entry_date || ""));
  soldViews.sort((a, b) => (b.pick.exit_date || "").localeCompare(a.pick.exit_date || ""));
  return [...openViews, ...soldViews];
}

function pickStats(views: PickView[]) {
  const scored = views.filter((v) => v.returnPct !== null);
  if (scored.length === 0) return null;
  const wins = scored.filter((v) => (v.returnPct as number) > 0).length;
  const avg = scored.reduce((s, v) => s + (v.returnPct as number), 0) / scored.length;
  const open = views.filter((v) => v.open).length;
  return {
    winRate: Math.round((wins / scored.length) * 100),
    avgReturn: avg,
    total: views.length,
    open,
  };
}

function thesisLine(pick: AlphaPick): string {
  const line = (pick.bull_thesis || pick.catalyst || "").trim().replace(/\s+/g, " ");
  return line.length > 150 ? `${line.slice(0, 149)}…` : line;
}

// ── Sections ─────────────────────────────────────────────────────────────────

function Snapshot({ quotes }: { quotes: Array<{ label: string; q: Quote | null }> }) {
  const anyData = quotes.some((s) => s.q);
  const freshness = quotes.find((s) => s.q)?.q?.freshnessLabel;
  return (
    <section aria-label="Market snapshot">
      <div className="cvq-dash-sechead">
        <h2 className="cvq-dash-h2">Market Snapshot</h2>
        {anyData && freshness && <span className="cvq-dash-fresh">{freshness}</span>}
      </div>
      {anyData ? (
        <div className="cvq-dash-snapshot">
          {quotes.map(({ label, q }) => (
            <Card key={label}>
              <StatTile
                label={label}
                value={
                  q
                    ? `$${q.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    : "—"
                }
                sub={q ? <ChangePill change={q.changePct ?? undefined} /> : <span className="cvq-dash-fresh">data unavailable</span>}
              />
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <EmptyState
            title="Market data unavailable"
            body="None of our price sources are answering right now. The snapshot returns as soon as one does."
          />
        </Card>
      )}
    </section>
  );
}

function Trends({ content }: { content: DashboardContent | null }) {
  return (
    <Card>
      <div className="cvq-dash-sechead">
        <h2 className="cvq-dash-h2">Today&rsquo;s Trends</h2>
        {content && <span className="cvq-dash-fresh">Updated {timeAgo(content.generatedAt)}</span>}
      </div>
      {content && content.trends.length > 0 ? (
        <ul className="cvq-dash-trends">
          {content.trends.map((t, i) => (
            <li key={i}>{t.text}</li>
          ))}
        </ul>
      ) : (
        <EmptyState
          title="No trends yet"
          body="The next scheduled refresh writes this section. If this persists past a refresh window, something upstream broke — we show nothing rather than guess."
        />
      )}
    </Card>
  );
}

function Signals({
  content,
  quotes,
}: {
  content: DashboardContent | null;
  quotes: Record<string, Quote | null>;
}) {
  return (
    <Card>
      <div className="cvq-dash-sechead">
        <h2 className="cvq-dash-h2">Early Signals</h2>
        {content && <span className="cvq-dash-fresh">Updated {timeAgo(content.generatedAt)}</span>}
      </div>
      {content && content.signals.length > 0 ? (
        <ul className="cvq-dash-signals">
          {content.signals.map((s, i) => {
            const q = quotes[s.ticker];
            return (
              <li key={i} className="cvq-dash-signal">
                <div className="cvq-dash-signal-head">
                  <TickerChip symbol={s.ticker} price={q?.price} change={q?.changePct ?? undefined} />
                </div>
                <p className="cvq-dash-signal-note">{s.note}</p>
                <p className="cvq-dash-signal-why">Why: {s.reason}</p>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState title="No signals yet" body="Unusual movers land here after the next scheduled refresh." />
      )}
    </Card>
  );
}

function Picks({ views }: { views: PickView[] | null }) {
  // null = the picks store itself failed — that is an ERROR state, not an
  // empty track record. Saying "no picks yet" when the database is down
  // would be a lie (CLAUDE.md: say so honestly).
  if (views === null) {
    return (
      <section aria-label="Picks">
        <div className="cvq-dash-sechead">
          <h2 className="cvq-dash-h2">Picks</h2>
        </div>
        <Card>
          <EmptyState
            title="Picks are unavailable right now"
            body="The track record store didn't answer. The full history — losses included — is back as soon as it does."
          />
        </Card>
      </section>
    );
  }
  const stats = pickStats(views);
  return (
    <section aria-label="Picks">
      <div className="cvq-dash-sechead">
        <h2 className="cvq-dash-h2">Picks</h2>
        <span className="cvq-dash-fresh">Full history — losses included</span>
      </div>
      {stats && (
        <p className="cvq-dash-pickstats">
          Win rate {stats.winRate}% · Average return{" "}
          <ChangePill change={stats.avgReturn} /> · {stats.total} picks ({stats.open} open)
        </p>
      )}
      {views.length > 0 ? (
        <div className="cvq-dash-picks">
          {views.map((v) => {
            const thesis = thesisLine(v.pick);
            return (
            <Card key={v.pick.id ?? `${v.pick.ticker}-${v.pick.entry_date}`} className="cvq-dash-pick">
              <div className="cvq-dash-pick-top">
                <div>
                  <span className="cvq-ticker-sym" data-no-translate>
                    {v.pick.ticker}
                  </span>
                  <span className="cvq-dash-pick-company">{v.pick.company_name}</span>
                </div>
                <span className={`cvq-chip ${v.open ? "cvq-dash-chip-open" : "cvq-dash-chip-closed"}`}>
                  {v.open ? "Open" : "Closed"}
                </span>
              </div>
              <div className="cvq-dash-pick-nums">
                <span>
                  Entry ${v.pick.entry_price.toFixed(2)} · {v.pick.entry_date}
                </span>
                <span>
                  {v.open ? "Now" : `Exit${v.pick.exit_date ? ` ${v.pick.exit_date}` : ""}`}{" "}
                  {v.price !== null ? `$${v.price.toFixed(2)}` : "price unavailable"}
                  {v.priceAsOfNote ? ` (${v.priceAsOfNote})` : ""}
                </span>
                {v.returnPct !== null ? <ChangePill change={v.returnPct} /> : <span className="cvq-dash-fresh">—</span>}
              </div>
              {thesis && <p className="cvq-dash-pick-thesis">{thesis}</p>}
            </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <EmptyState
            title="No picks published yet"
            body="When the desk publishes a pick it appears here with its entry price and stays — wins and losses alike."
          />
        </Card>
      )}
    </section>
  );
}

function Events({ content }: { content: DashboardContent | null }) {
  const events = content?.events ?? [];
  return (
    <Card>
      <div className="cvq-dash-sechead">
        <h2 className="cvq-dash-h2">Upcoming Events</h2>
        {content && <span className="cvq-dash-fresh">Updated {timeAgo(content.generatedAt)}</span>}
      </div>
      {events.length > 0 ? (
        <ul className="cvq-dash-events">
          {events.map((e, i) => (
            <li key={i} className="cvq-dash-event">
              <span className="cvq-dash-event-date" data-no-translate>
                {e.date}
              </span>
              <span className="cvq-dash-event-label">
                {e.label}
                {e.sourceUrl && (
                  <>
                    {" "}
                    <a href={e.sourceUrl} target="_blank" rel="noopener noreferrer" className="cvq-dash-event-src">
                      source
                    </a>
                  </>
                )}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title="No dates on the calendar yet" body="Earnings and Fed dates land here after the next scheduled refresh." />
      )}
    </Card>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  // All independent — fetch in parallel. Each section degrades on its own:
  // a dead price feed must not blank the trends, and vice versa.
  const [content, snapshotQuotes, picks] = await Promise.all([
    readDashboard().catch((err) => {
      console.error("[feed] dashboard read failed:", err);
      return null;
    }),
    Promise.all(
      SNAPSHOT_TICKERS.map(async ({ ticker, label }) => ({ label, q: await quote(ticker) }))
    ),
    loadPicks().catch((err): PickView[] | null => {
      console.error("[feed] picks load failed:", err);
      return null; // error state, not an empty track record
    }),
  ]);

  // Live prices for the signal chips (deduped, shared 15-min cache).
  const signalTickers = [...new Set((content?.signals ?? []).map((s) => s.ticker))];
  const signalQuotes: Record<string, Quote | null> = {};
  await Promise.all(
    signalTickers.map(async (t) => {
      signalQuotes[t] = await quote(t);
    })
  );

  return (
    <div className="cvq-dash">
      <header className="cvq-dash-head">
        <h1 className="cvq-dash-h1">Dashboard</h1>
        <p className="cvq-dash-sub">
          {content
            ? `A shared daily read on the market · updated ${timeAgo(content.generatedAt)}`
            : "A shared daily read on the market — refreshed before the US open and after the close."}
        </p>
      </header>

      <Snapshot quotes={snapshotQuotes} />

      <div className="cvq-dash-grid">
        <Trends content={content} />
        <Signals content={content} quotes={signalQuotes} />
      </div>

      <Picks views={picks} />

      <Events content={content} />

      <p className="cvq-disclaimer">
        Conviqt is a research and education tool, not a licensed financial adviser. Nothing here is
        financial advice. Markets involve risk.
      </p>

      <p className="cvq-dash-fresh" style={{ textAlign: "center" }}>
        Want to dig into any of these?{" "}
        <Link href="/research" className="cvq-dash-link">
          Look into a stock →
        </Link>
      </p>
    </div>
  );
}
