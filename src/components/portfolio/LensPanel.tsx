"use client";

// The Lens — the daily money brief + on-demand deep thesis, rendered at the top
// of the Portfolio Holdings tab. Plain English, Almanac tokens only (CLAUDE.md).
//
// Daily brief loads on mount (cached server-side, 1×/day). "Go deeper" runs the
// institutional thesis (DeepSeek V4 Pro + reasoning). Free users get the teaser.

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Card, ChangePill, SkeletonText } from "@/components/ui";
import type { LensBrief, LensThesis } from "@/lib/lens/types";

type BriefState =
  | { name: "loading" }
  | { name: "brief"; brief: LensBrief }
  | { name: "pro" }
  | { name: "none" }
  | { name: "error"; message: string };

type ThesisState =
  | { name: "idle" }
  | { name: "running" }
  | { name: "done"; thesis: LensThesis }
  | { name: "error"; message: string };

function signedPct(n: number | null): string {
  return n == null ? "" : `${n >= 0 ? "+" : ""}${n}%`;
}

export function LensPanel({ portfolioId, enabled }: { portfolioId: string | null; enabled: boolean }) {
  const [state, setState] = useState<BriefState>({ name: "loading" });
  const [thesis, setThesis] = useState<ThesisState>({ name: "idle" });
  const startedRef = useRef(false);

  useEffect(() => {
    if (!enabled || startedRef.current) return;
    startedRef.current = true;
    void (async () => {
      try {
        const res = await fetch("/api/portfolio/brief", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ portfolioId }),
        });
        if (res.status === 402) return setState({ name: "pro" });
        const body = await res.json().catch(() => null);
        if (!res.ok) return setState({ name: "error", message: body?.error ?? "Couldn't load today's brief." });
        if (!body?.brief) return setState({ name: "none" });
        setState({ name: "brief", brief: body.brief as LensBrief });
      } catch {
        setState({ name: "error", message: "Couldn't load today's brief." });
      }
    })();
  }, [enabled, portfolioId]);

  const goDeep = useCallback(async () => {
    setThesis({ name: "running" });
    try {
      const res = await fetch("/api/portfolio/thesis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ portfolioId }),
      });
      const body = await res.json().catch(() => null);
      if (res.status === 402) return setThesis({ name: "error", message: "The deep thesis is a Pro feature." });
      if (!res.ok || !body?.thesis) {
        return setThesis({ name: "error", message: body?.error ?? "Couldn't build the deep thesis." });
      }
      setThesis({ name: "done", thesis: body.thesis as LensThesis });
    } catch {
      setThesis({ name: "error", message: "Couldn't build the deep thesis." });
    }
  }, [portfolioId]);

  if (!enabled || state.name === "none") return null;

  if (state.name === "loading") {
    return (
      <Card raised padding="lg" className="cvq-lens">
        <div className="cvq-lens-head">
          <h2 className="cvq-lens-title">Today</h2>
        </div>
        <SkeletonText lines={3} />
      </Card>
    );
  }

  if (state.name === "pro") {
    return (
      <Card raised padding="lg" className="cvq-lens cvq-lens--teaser">
        <div className="cvq-lens-head">
          <h2 className="cvq-lens-title">Today</h2>
        </div>
        <p className="cvq-lens-teasercopy">
          Every day, see exactly what moved your money — what happened, why, and what to watch — in plain
          English. Plus an on-demand deep thesis on your whole portfolio.
        </p>
        <Link href="/pricing" className="cvq-btn cvq-btn--primary">
          See what Pro unlocks
        </Link>
      </Card>
    );
  }

  if (state.name === "error") {
    return (
      <Card raised padding="lg" className="cvq-lens">
        <div className="cvq-lens-head">
          <h2 className="cvq-lens-title">Today</h2>
        </div>
        <p className="cvq-folio-msg">{state.message}</p>
      </Card>
    );
  }

  const b = state.brief;
  const notedHoldings = b.holdings.filter((h) => h.note);

  return (
    <Card raised padding="lg" className="cvq-lens">
      <div className="cvq-lens-head">
        <div>
          <h2 className="cvq-lens-title">The trend</h2>
          <span className="cvq-lens-date">past month · {b.dataFreshness}</span>
        </div>
        <div className="cvq-lens-horizons">
          {b.move1mPct !== null && (
            <span className="cvq-lens-horizon">
              <span className="cvq-lens-hlabel">1M</span>
              <ChangePill change={b.move1mPct} />
            </span>
          )}
          {b.move1wPct !== null && (
            <span className="cvq-lens-horizon">
              <span className="cvq-lens-hlabel">1W</span>
              <ChangePill change={b.move1wPct} />
            </span>
          )}
          {b.portfolioMovePct !== null && (
            <span className="cvq-lens-horizon cvq-lens-horizon--muted">
              <span className="cvq-lens-hlabel">1D</span>
              <ChangePill change={b.portfolioMovePct} />
            </span>
          )}
        </div>
      </div>

      <p className="cvq-lens-headline">{b.whatHappened}</p>
      {b.why && (
        <p className="cvq-lens-para">
          <span className="cvq-lens-label">Why</span> {b.why}
        </p>
      )}
      {b.whatItMeans && (
        <p className="cvq-lens-para">
          <span className="cvq-lens-label">What it means</span> {b.whatItMeans}
        </p>
      )}
      {b.sinceYesterday && <p className="cvq-lens-since">Since yesterday: {b.sinceYesterday}</p>}

      {notedHoldings.length > 0 && (
        <ul className="cvq-lens-holdings">
          {notedHoldings.map((h) => {
            const mom = [
              h.ret1wPct != null ? `1W ${signedPct(h.ret1wPct)}` : null,
              h.ret3mPct != null ? `3M ${signedPct(h.ret3mPct)}` : null,
            ]
              .filter(Boolean)
              .join(" · ");
            return (
              <li key={h.ticker} className="cvq-lens-holding">
                <div className="cvq-lens-holding-top">
                  <span className="cvq-ticker-sym">{h.ticker}</span>
                  {h.ret1mPct !== null && <ChangePill change={h.ret1mPct} />}
                  {mom && <span className="cvq-lens-hmom">{mom}</span>}
                </div>
                <span className="cvq-lens-note">{h.note}</span>
              </li>
            );
          })}
        </ul>
      )}

      {b.watch.length > 0 && (
        <div className="cvq-lens-block">
          <span className="cvq-lens-label">What to watch</span>
          <ul className="cvq-lens-list">
            {b.watch.map((w, i) => (
              <li key={i}>{w.text}</li>
            ))}
          </ul>
        </div>
      )}

      {b.flagged.length > 0 && (
        <div className="cvq-lens-block">
          <span className="cvq-lens-label">On the record</span>
          <ul className="cvq-lens-list">
            {b.flagged.map((f) => (
              <li key={f.id} className={`cvq-lens-flag cvq-lens-flag--${f.status}`}>
                {f.text}
                {f.outcomeNote ? ` — ${f.outcomeNote}` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="cvq-lens-deepwrap">
        {thesis.name !== "done" && (
          <button
            type="button"
            className="cvq-btn cvq-btn--secondary"
            onClick={() => void goDeep()}
            disabled={thesis.name === "running"}
          >
            {thesis.name === "running" ? "Thinking deeply…" : "Go deeper — full thesis"}
          </button>
        )}
        {thesis.name === "error" && <p className="cvq-folio-msg">{thesis.message}</p>}
      </div>

      {thesis.name === "done" && <ThesisView t={thesis.thesis} />}
    </Card>
  );
}

function ThesisList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="cvq-thesis-list">
      <span className="cvq-lens-label">{title}</span>
      <ul className="cvq-lens-list">
        {items.map((x, i) => (
          <li key={i}>{x}</li>
        ))}
      </ul>
    </div>
  );
}

function ThesisView({ t }: { t: LensThesis }) {
  return (
    <div className="cvq-thesis">
      <div className="cvq-thesis-head">
        <h3 className="cvq-thesis-title">The deep read</h3>
        <span className="cvq-lens-label">How sure: {t.conviction}</span>
      </div>
      <p className="cvq-thesis-summary">{t.summary}</p>

      {t.crux && (
        <div className="cvq-thesis-crux">
          <span className="cvq-lens-label">The one thing that matters</span>
          <p>{t.crux}</p>
        </div>
      )}

      <div className="cvq-thesis-cols">
        {t.drivers.length > 0 && <ThesisList title="What's driving it" items={t.drivers} />}
        {t.bull.length > 0 && <ThesisList title="In its favour" items={t.bull} />}
        {t.bear.length > 0 && <ThesisList title="The real risks" items={t.bear} />}
      </div>

      {t.holdings.length > 0 && (
        <div className="cvq-thesis-holdings">
          {t.holdings.map((h) => (
            <div key={h.ticker} className="cvq-thesis-holding">
              <div className="cvq-thesis-holding-head">
                <span className="cvq-ticker-sym">{h.ticker}</span>
                {h.weightPct !== null && <span className="cvq-lens-note">{h.weightPct}% of the book</span>}
              </div>
              {(h.momentum || h.valuation) && (
                <p className="cvq-thesis-stats">{[h.momentum, h.valuation].filter(Boolean).join(" · ")}</p>
              )}
              {h.read && <p>{h.read}</p>}
            </div>
          ))}
        </div>
      )}

      {t.reasoning && (
        <details className="cvq-thesis-details">
          <summary>How we reasoned</summary>
          <p className="cvq-thesis-reasoning">{t.reasoning}</p>
        </details>
      )}

      {t.sources.length > 0 && (
        <details className="cvq-thesis-details">
          <summary>Sources we looked at ({t.sources.length})</summary>
          <ul className="cvq-thesis-sources">
            {t.sources.map((s, i) => (
              <li key={i}>
                <span className="cvq-lens-label">{s.kind}</span>{" "}
                {s.url ? (
                  <a href={s.url} target="_blank" rel="noopener noreferrer">
                    {s.label}
                  </a>
                ) : (
                  s.label
                )}
                {s.detail ? ` — ${s.detail}` : ""}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
