"use client";

// The Radar (personalized, PRO) — woven into the Portfolio surface beside the
// Lens. Same shape as the market-wide Radar, but filtered to the user's
// holdings: "what's coming for YOUR money, and what each outcome would mean for
// your book." ORIENTATION, never alpha — outcomes are framings, never calls.
// Plain English, Almanac tokens only (CLAUDE.md).
//
// Mirrors LensPanel's loading/error/Pro-upsell/empty patterns and fetch shape.
// The /api/portfolio/radar route enforces the Pro gate; a 402 with code
// "plan_limit" shows the same upsell teaser the Lens uses.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Card, SkeletonText } from "@/components/ui";
import { kindLabel, whenLabel, type PersonalRadar, type RadarItem } from "@/lib/radar/types";

// The route returns the personalized radar on success, or a null radar with a
// reason on the honest empty paths (no portfolio / empty portfolio).
type RadarResponse = {
  radar: PersonalRadar | null;
  reason?: "no_portfolio" | "empty_portfolio" | "pro_only";
  code?: "plan_limit";
  error?: string;
};

type RadarState =
  | { name: "loading" }
  | { name: "radar"; radar: PersonalRadar }
  | { name: "pro" }
  | { name: "none" }
  | { name: "error"; message: string };

function researchHref(ticker: string): string {
  return `/research?q=${encodeURIComponent(`analyze ${ticker}`)}`;
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

export default function RadarPanel({ portfolioId }: { portfolioId?: string }) {
  const [state, setState] = useState<RadarState>({ name: "loading" });
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void (async () => {
      try {
        const res = await fetch("/api/portfolio/radar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ portfolioId }),
        });
        if (res.status === 402) return setState({ name: "pro" });
        const body = (await res.json().catch(() => null)) as RadarResponse | null;
        if (!res.ok) {
          return setState({ name: "error", message: body?.error ?? "Couldn't load your radar." });
        }
        if (!body?.radar || body.radar.items.length === 0) {
          return setState({ name: "none" });
        }
        setState({ name: "radar", radar: body.radar });
      } catch {
        setState({ name: "error", message: "Couldn't load your radar." });
      }
    })();
  }, [portfolioId]);

  if (state.name === "none") return null;

  if (state.name === "loading") {
    return (
      <Card raised padding="lg" className="cvq-radar-panel">
        <div className="cvq-radar-head">
          <h2 className="cvq-radar-h2">On your radar</h2>
        </div>
        <SkeletonText lines={3} />
      </Card>
    );
  }

  if (state.name === "pro") {
    return (
      <Card raised padding="lg" className="cvq-radar-panel cvq-radar-panel--teaser">
        <div className="cvq-radar-head">
          <h2 className="cvq-radar-h2">On your radar</h2>
        </div>
        <p className="cvq-radar-teasercopy">
          See what&rsquo;s coming for the stocks you own — earnings, Fed days and key data — with what&rsquo;s
          at stake for your book and what each outcome would mean, in plain English.
        </p>
        <Link href="/pricing" className="cvq-btn cvq-btn--primary">
          See what Pro unlocks
        </Link>
      </Card>
    );
  }

  if (state.name === "error") {
    return (
      <Card raised padding="lg" className="cvq-radar-panel">
        <div className="cvq-radar-head">
          <h2 className="cvq-radar-h2">On your radar</h2>
        </div>
        <p className="cvq-folio-msg">{state.message}</p>
      </Card>
    );
  }

  const r = state.radar;
  const matched = r.matchedTickers ?? [];

  return (
    <Card raised padding="lg" className="cvq-radar-panel">
      <div className="cvq-radar-head">
        <div>
          <h2 className="cvq-radar-h2">On your radar</h2>
          <span className="cvq-radar-sub">What&rsquo;s coming for your money</span>
        </div>
      </div>

      {matched.length > 0 && (
        <p className="cvq-radar-matched">
          <span className="cvq-radar-matched-label">Touching your holdings:</span>{" "}
          {matched.map((t, i) => (
            <span key={t}>
              <Link href={researchHref(t)} className="cvq-radar-link" aria-label={`Look into ${t}`}>
                {t}
              </Link>
              {i < matched.length - 1 ? ", " : ""}
            </span>
          ))}
        </p>
      )}

      <ul className="cvq-radar-list">
        {r.items.map((item) => (
          <RadarRow key={item.id} item={item} />
        ))}
      </ul>
    </Card>
  );
}
