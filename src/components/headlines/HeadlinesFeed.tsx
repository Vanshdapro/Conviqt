"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { EmptyState, Skeleton, TickerChip } from "@/components/ui";
import { ATTRIBUTION } from "@/lib/news/currents";
import { FEED_REGIONS, timeAgo, type FeedHeadline } from "@/lib/feed/types";

// The Headlines surface. One tab per region (+ Crypto); each tab serves the
// globally cached edition with live ticker-chip prices resolved server-side.
// Tapping a card arms Headline Decoder in Research with the headline
// pre-filled — the no-copy-paste path is the whole point of this surface.

interface RegionPayload {
  region: string;
  headlines: FeedHeadline[];
  generatedAt: string | null;
  quotes: Record<string, { price: number; changePct: number | null } | null>;
}

type TabState =
  | { name: "loading" }
  | { name: "error"; message: string }
  | { name: "ready"; data: RegionPayload };

export function HeadlinesFeed() {
  const router = useRouter();
  const [active, setActive] = useState(FEED_REGIONS[0].id);
  const [tabs, setTabs] = useState<Record<string, TabState>>({});
  const inFlight = useRef<Set<string>>(new Set());

  const load = useCallback(async (regionId: string, force = false) => {
    if (inFlight.current.has(regionId)) return;
    inFlight.current.add(regionId);
    if (force) setTabs((t) => ({ ...t, [regionId]: { name: "loading" } }));
    try {
      const res = await fetch(`/api/headlines?region=${regionId}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as RegionPayload;
      setTabs((t) => ({ ...t, [regionId]: { name: "ready", data } }));
    } catch (err) {
      console.error(`[headlines] load ${regionId} failed:`, err);
      setTabs((t) => ({
        ...t,
        [regionId]: { name: "error", message: "Headlines are unavailable right now." },
      }));
    } finally {
      inFlight.current.delete(regionId);
    }
  }, []);

  useEffect(() => {
    if (!tabs[active]) {
      setTabs((t) => ({ ...t, [active]: { name: "loading" } }));
      void load(active);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const state = tabs[active] ?? { name: "loading" as const };

  const decode = useCallback(
    (h: FeedHeadline) => {
      router.push(`/research?skill=headline-decoder&headline=${encodeURIComponent(h.title.slice(0, 300))}`);
    },
    [router]
  );

  return (
    <div className="cvq-heads">
      <header className="cvq-dash-head">
        <h1 className="cvq-dash-h1">Headlines</h1>
        <p className="cvq-dash-sub">
          Market news from around the world — tap any story to decode which stocks it touches.
        </p>
      </header>

      <div className="cvq-heads-tabs" role="tablist" aria-label="Regions">
        {FEED_REGIONS.map((r) => (
          <button
            key={r.id}
            role="tab"
            aria-selected={active === r.id}
            className={`cvq-heads-tab${active === r.id ? " cvq-heads-tab--active" : ""}`}
            onClick={() => setActive(r.id)}
          >
            {r.label}
          </button>
        ))}
      </div>

      {state.name === "ready" && state.data.generatedAt && (
        <p className="cvq-dash-fresh">Updated {timeAgo(state.data.generatedAt)}</p>
      )}

      {state.name === "loading" && (
        <div className="cvq-heads-list" aria-busy>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="cvq-card">
              <Skeleton width="30%" height={11} />
              <Skeleton height={14} style={{ marginTop: 10 }} />
              <Skeleton width="80%" height={12} style={{ marginTop: 8 }} />
            </div>
          ))}
        </div>
      )}

      {state.name === "error" && (
        <EmptyState
          title="Headlines are unavailable right now"
          body="Something between us and the news wires broke. Your next visit — or the retry below — may catch it back up."
          action={
            <button className="cvq-btn cvq-btn--secondary" onClick={() => void load(active, true)}>
              Try again
            </button>
          }
        />
      )}

      {state.name === "ready" &&
        (state.data.headlines.length === 0 ? (
          <EmptyState
            title="No headlines for this region yet"
            body="The next scheduled refresh fills this tab. We publish only real stories from the wires — never filler."
          />
        ) : (
          <div className="cvq-heads-list">
            {state.data.headlines.map((h) => (
              <article
                key={h.id}
                className="cvq-card cvq-card--interactive cvq-heads-card"
                role="button"
                tabIndex={0}
                aria-label={`Decode: ${h.title}`}
                onClick={() => decode(h)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    decode(h);
                  }
                }}
              >
                <div className="cvq-heads-meta">
                  <span className="cvq-heads-source">
                    {h.source || "wire"}
                  </span>
                  {h.publishedAt && <span className="cvq-heads-time">{timeAgo(h.publishedAt)}</span>}
                </div>
                <h3 className="cvq-heads-title">{h.title}</h3>
                <p className="cvq-heads-take">
                  <span className="cvq-heads-take-label">Why traders care:</span> {h.take}
                </p>
                {h.tickers.length > 0 && (
                  <div className="cvq-heads-chips">
                    {h.tickers.map((t) => {
                      const q = state.data.quotes[t];
                      return (
                        <TickerChip
                          key={t}
                          symbol={t}
                          price={q?.price}
                          change={q?.changePct ?? undefined}
                          pill={false}
                        />
                      );
                    })}
                  </div>
                )}
                <div className="cvq-heads-actions">
                  <span className="cvq-btn cvq-btn--primary cvq-heads-decode">Decode this</span>
                  <a
                    href={h.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="cvq-heads-readlink"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Read the story ↗
                  </a>
                </div>
              </article>
            ))}
          </div>
        ))}

      <p className="cvq-heads-attribution">
        <a href={ATTRIBUTION.url} target="_blank" rel="noopener noreferrer">
          {ATTRIBUTION.label}
        </a>
      </p>

      <p className="cvq-disclaimer">
        Conviqt is a research and education tool, not a licensed financial adviser. Nothing here is
        financial advice. Markets involve risk.
      </p>
    </div>
  );
}
