import type { Metadata } from "next";
import Link from "next/link";
import { Card, ChangePill, EmptyState, Sparkline, StatTile, TickerChip } from "@/components/ui";
import { history, quote } from "@/lib/marketdata";
import type { Quote } from "@/lib/marketdata";
import { readDashboard } from "@/lib/feed/store";
import { SNAPSHOT_TICKERS, timeAgo, type DashboardContent } from "@/lib/feed/types";
import { loadPicks, pickStats, thesisLine, type PickView } from "@/lib/picksView";
import { getVerifiedUser } from "@/lib/auth";
import { getWatchlistStore } from "@/lib/watchlist";

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
//
// Every ticker the page names is a LINK into Research (one tap = a full read on
// that stock), and every priced ticker carries a 30-day sparkline drawn from
// the marketdata layer's history (24h-cached, free feeds). The sparkline is
// real data or it is absent — never a synthetic line.

// A sparkline is decorative-but-real: missing history just means no line, never
// a guessed one. Sparks is a ticker→closes map, deduped and fetched in parallel.
type Sparks = Record<string, number[]>;

function researchHref(ticker: string): string {
  return `/research?q=${encodeURIComponent(`analyze ${ticker}`)}`;
}

async function loadSparklines(tickers: string[]): Promise<Sparks> {
  const uniq = [...new Set(tickers.map((t) => t.trim().toUpperCase()).filter(Boolean))];
  const out: Sparks = {};
  await Promise.all(
    uniq.map(async (t) => {
      try {
        const h = await history(t, "1mo");
        if (h && h.candles.length >= 2) out[t] = h.candles.map((c) => c.close);
      } catch (err) {
        console.error(
          `[dashboard] sparkline history failed for ${t}:`,
          err instanceof Error ? err.message : err
        );
      }
    })
  );
  return out;
}

// ── Sections ─────────────────────────────────────────────────────────────────
// (Picks loading/stats live in src/lib/picksView.ts — shared with the landing
// page's TRACK RECORD section.)

function Snapshot({
  quotes,
  sparks,
}: {
  quotes: Array<{ ticker: string; label: string; q: Quote | null }>;
  sparks: Sparks;
}) {
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
          {quotes.map(({ ticker, label, q }) => {
            const spark = sparks[ticker];
            return (
              <Link key={label} href={researchHref(ticker)} className="cvq-dash-snaptile">
                <Card interactive>
                  <StatTile
                    label={label}
                    value={
                      q
                        ? `$${q.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                        : "—"
                    }
                    sub={
                      q ? (
                        <ChangePill change={q.changePct ?? undefined} />
                      ) : (
                        <span className="cvq-dash-fresh">data unavailable</span>
                      )
                    }
                  />
                  {spark && (
                    <Sparkline
                      data={spark}
                      autoTone
                      width={240}
                      height={44}
                      showDot
                      className="cvq-dash-spark"
                    />
                  )}
                </Card>
              </Link>
            );
          })}
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

// Your stocks (Phase 7): the Watching list seeded by onboarding, priced from
// the shared 15-min quote cache. Logged-out or empty → renders nothing; the
// Dashboard stays fully usable without it.
function YourStocks({
  rows,
  sparks,
}: {
  rows: Array<{ ticker: string; q: Quote | null }>;
  sparks: Sparks;
}) {
  if (rows.length === 0) return null;
  return (
    <section aria-label="Your stocks">
      <div className="cvq-dash-sechead">
        <h2 className="cvq-dash-h2">Your Stocks</h2>
        <Link href="/portfolio" className="cvq-dash-link">
          Manage in Portfolio →
        </Link>
      </div>
      <div className="cvq-dash-yourstocks">
        {rows.map(({ ticker, q }) => {
          const spark = sparks[ticker];
          return (
            <Link key={ticker} href={researchHref(ticker)} className="cvq-yourstock">
              <TickerChip symbol={ticker} price={q?.price} change={q?.changePct ?? undefined} />
              {spark && (
                <Sparkline data={spark} autoTone width={160} height={28} className="cvq-dash-spark" />
              )}
            </Link>
          );
        })}
      </div>
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
        <>
          <ul className="cvq-dash-trends">
            {content.trends.map((t, i) => (
              <li key={i}>{t.text}</li>
            ))}
          </ul>
          <Link href="/headlines" className="cvq-dash-cardfoot">
            See the headlines behind these →
          </Link>
        </>
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
  sparks,
}: {
  content: DashboardContent | null;
  quotes: Record<string, Quote | null>;
  sparks: Sparks;
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
            const spark = sparks[s.ticker];
            return (
              <li key={i}>
                <Link href={researchHref(s.ticker)} className="cvq-dash-signal">
                  <div className="cvq-dash-signal-head">
                    <TickerChip symbol={s.ticker} price={q?.price} change={q?.changePct ?? undefined} />
                    {spark && (
                      <Sparkline data={spark} autoTone width={120} height={30} className="cvq-dash-signal-spark" />
                    )}
                  </div>
                  <p className="cvq-dash-signal-note">{s.note}</p>
                  <p className="cvq-dash-signal-why">Why: {s.reason}</p>
                  <span className="cvq-dash-more">Look into {s.ticker} →</span>
                </Link>
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

function Picks({ views, sparks }: { views: PickView[] | null; sparks: Sparks }) {
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
          Win rate {stats.winRate}% · Total return{" "}
          <ChangePill change={stats.avgReturn} /> · {stats.total} picks ({stats.open} open)
        </p>
      )}
      {views.length > 0 ? (
        <div className="cvq-dash-picks">
          {views.map((v) => {
            const thesis = thesisLine(v.pick);
            const spark = sparks[v.pick.ticker];
            return (
              <Link
                key={v.pick.id ?? `${v.pick.ticker}-${v.pick.entry_date}`}
                href={researchHref(v.pick.ticker)}
                className="cvq-dash-picklink"
              >
                <Card interactive className="cvq-dash-pick">
                  <div className="cvq-dash-pick-top">
                    <div>
                      <span className="cvq-ticker-sym">{v.pick.ticker}</span>
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
                    {v.returnPct !== null ? (
                      <ChangePill change={v.returnPct} />
                    ) : (
                      <span className="cvq-dash-fresh">—</span>
                    )}
                  </div>
                  {spark && (
                    <Sparkline data={spark} autoTone width={300} height={40} className="cvq-dash-spark" />
                  )}
                  {thesis && <p className="cvq-dash-pick-thesis">{thesis}</p>}
                </Card>
              </Link>
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
              <span className="cvq-dash-event-date">{e.date}</span>
              <span className="cvq-dash-event-label">
                {e.ticker ? (
                  <Link href={researchHref(e.ticker)} className="cvq-dash-link">
                    {e.label}
                  </Link>
                ) : (
                  e.label
                )}
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
  const [content, snapshotQuotes, picks, watching] = await Promise.all([
    readDashboard().catch((err) => {
      console.error("[feed] dashboard read failed:", err);
      return null;
    }),
    Promise.all(
      SNAPSHOT_TICKERS.map(async ({ ticker, label }) => ({ ticker, label, q: await quote(ticker) }))
    ),
    loadPicks().catch((err): PickView[] | null => {
      console.error("[feed] picks load failed:", err);
      return null; // error state, not an empty track record
    }),
    // Personalization (Phase 7): the user's Watching list, max 8 chips.
    (async () => {
      try {
        const user = await getVerifiedUser();
        if (!user) return [];
        const list = await getWatchlistStore().list(user.email);
        return list.slice(0, 8).map((w) => w.ticker);
      } catch (err) {
        console.error("[dashboard] watching load failed:", err instanceof Error ? err.message : err);
        return [];
      }
    })(),
  ]);

  // Live prices for the Watching chips (deduped via the shared 15-min cache).
  const watchingRows = await Promise.all(
    watching.map(async (ticker) => ({ ticker, q: await quote(ticker) }))
  );

  // Live prices for the signal chips (deduped, shared 15-min cache).
  const signalTickers = [...new Set((content?.signals ?? []).map((s) => s.ticker))];
  const signalQuotes: Record<string, Quote | null> = {};
  await Promise.all(
    signalTickers.map(async (t) => {
      signalQuotes[t] = await quote(t);
    })
  );

  // 30-day sparklines for every ticker the page names, deduped into one fetch
  // pass (24h-cached, free feeds). Snapshot + watching + signals + picks.
  const sparks = await loadSparklines([
    ...SNAPSHOT_TICKERS.map((s) => s.ticker),
    ...watching,
    ...signalTickers,
    ...(picks ?? []).map((v) => v.pick.ticker),
  ]);

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

      <Snapshot quotes={snapshotQuotes} sparks={sparks} />

      <YourStocks rows={watchingRows} sparks={sparks} />

      <div className="cvq-dash-grid">
        <Trends content={content} />
        <Signals content={content} quotes={signalQuotes} sparks={sparks} />
      </div>

      <Picks views={picks} sparks={sparks} />

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
