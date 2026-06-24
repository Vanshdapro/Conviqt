import Link from "next/link";
import { Card, EmptyState } from "@/components/ui";
import { kindLabel, whenLabel, type MarketRadar, type RadarItem } from "@/lib/radar/types";

// The Radar (market-wide, FREE) — the Dashboard's "what's coming, what's at
// stake, what it means" section. ORIENTATION, never alpha: each outcome is a
// framing of what a result would MEAN for you, never a prediction. Plain
// English, Almanac tokens only (CLAUDE.md). Server-renderable: nothing here is
// interactive, so it renders once with an honest "Updated …" stamp.
//
// Items arrive already soonest-first and capped upstream (RADAR_MAX_ITEMS).

function researchHref(ticker: string): string {
  return `/research?q=${encodeURIComponent(`analyze ${ticker}`)}`;
}

// "Updated 2 hours ago"-style relative stamp from an ISO timestamp. Kept local
// (no extra import) and defensive: a bad timestamp just yields no stamp.
function updatedLabel(iso: string): string | null {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return null;
  const mins = Math.max(0, Math.round((Date.now() - then) / 60_000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function RadarRow({ item }: { item: RadarItem }) {
  return (
    <li className="cvq-radar-item">
      <div className="cvq-radar-item-head">
        <span className="cvq-radar-kind">{kindLabel(item.kind)}</span>
        <span className="cvq-radar-when">{whenLabel(item.daysAway, item.date)}</span>
      </div>

      <h3 className="cvq-radar-title">
        {item.ticker ? (
          <Link href={researchHref(item.ticker)} className="cvq-radar-link" aria-label={`Look into ${item.ticker}`}>
            {item.title}
          </Link>
        ) : (
          item.title
        )}
      </h3>

      <p className="cvq-radar-stakes">{item.stakes}</p>

      {item.outcomes.length > 0 && (
        <ul className="cvq-radar-outcomes">
          {item.outcomes.map((o, i) => (
            <li key={i} className="cvq-radar-outcome">
              <span className="cvq-radar-outcome-label">{o.label}</span>
              <span className="cvq-radar-outcome-arrow" aria-hidden>
                {" → "}
              </span>
              <span className="cvq-radar-outcome-meaning">{o.meaning}</span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

export default function MarketRadar({ radar }: { radar: MarketRadar | null }) {
  const items = radar?.items ?? [];
  const updated = radar ? updatedLabel(radar.generatedAt) : null;

  return (
    <Card>
      <div className="cvq-radar-head">
        <h2 className="cvq-radar-h2">The Radar</h2>
        {radar && updated && (
          <span className="cvq-radar-fresh">
            What&rsquo;s coming &middot; updated {updated}
          </span>
        )}
      </div>

      {items.length > 0 ? (
        <ul className="cvq-radar-list">
          {items.map((item) => (
            <RadarRow key={item.id} item={item} />
          ))}
        </ul>
      ) : (
        <EmptyState
          title="Nothing on the radar yet"
          body="Upcoming earnings, Fed days and key data land here after the next scheduled refresh — each with what's at stake and what every outcome would mean."
        />
      )}
    </Card>
  );
}
