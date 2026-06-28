"use client";

import { useEffect, useState } from "react";

// ── Types ──────────────────────────────────────────────────────────────────

interface QuoteData {
  price: number;
  changePct: number | null;
  prevClose: number | null;
  freshnessLabel: string;
  sourceUrl: string;
}

interface StatsData {
  marketCap: number | null;
  peRatio: number | null;
  week52High: number | null;
  week52Low: number | null;
  freshnessLabel: string;
  sourceUrl: string;
}

interface MarketData {
  quote: QuoteData | null;
  keyStats: StatsData | null;
}

// ── Formatters ─────────────────────────────────────────────────────────────

function fmtPrice(n: number): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtCap(n: number): string {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(0)}M`;
  return `$${n.toLocaleString()}`;
}

function fmtPE(n: number): string {
  return n.toFixed(1) + "x";
}

// ── 52-week range bar ─────────────────────────────────────────────────────

function RangeBar({
  low,
  high,
  current,
}: {
  low: number;
  high: number;
  current: number;
}) {
  const spread = high - low;
  if (spread <= 0) return null;
  const pct = Math.max(0, Math.min(100, ((current - low) / spread) * 100));
  const isNearHigh = pct >= 70;
  const isNearLow = pct <= 30;
  const dotColor = isNearHigh ? "var(--up-ink)" : isNearLow ? "var(--down-ink)" : "var(--accent)";

  return (
    <div className="mt-2">
      <div className="relative h-[4px] rounded-full" style={{ background: "var(--border)" }}>
        {/* Filled bar up to current */}
        <div
          className="absolute top-0 left-0 h-full rounded-full"
          style={{ width: `${pct}%`, background: dotColor, opacity: 0.5 }}
        />
        {/* Current price dot */}
        <div
          className="absolute top-1/2 h-3 w-3 rounded-full border-2"
          style={{
            left: `calc(${pct}% - 6px)`,
            transform: "translateY(-50%)",
            background: dotColor,
            borderColor: "var(--bg-surface)",
          }}
        />
      </div>
      <div className="flex justify-between mt-1.5 mono text-[9px] text-dim">
        <span>${fmtPrice(low)}</span>
        <span className="text-center text-muted">52-week range</span>
        <span>${fmtPrice(high)}</span>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export default function MarketStrip({ ticker }: { ticker: string }) {
  const [md, setMd] = useState<MarketData | null>(null);
  const [status, setStatus] = useState<"loading" | "done" | "error">("loading");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/stock/${encodeURIComponent(ticker.toLowerCase())}/market`,
          { cache: "no-store" }
        );
        if (cancelled) return;
        if (!res.ok) { setStatus("error"); return; }
        const json: MarketData = await res.json();
        if (cancelled) return;
        setMd(json);
        setStatus("done");
      } catch {
        if (!cancelled) setStatus("error");
      }
    })();
    return () => { cancelled = true; };
  }, [ticker]);

  if (status === "loading") {
    return (
      <div
        className="border border-rule px-5 py-4 flex items-center gap-3"
        style={{ background: "var(--surface)" }}
      >
        <span className="h-2 w-2 rounded-full animate-pulse" style={{ background: "var(--accent)" }} />
        <span className="mono text-[11px] text-dim">Fetching live market data…</span>
      </div>
    );
  }

  if (status === "error" || !md?.quote) {
    return null; // fail silently — the AI report still shows
  }

  const { quote, keyStats } = md;
  if (!quote) return null;

  const up = (quote.changePct ?? 0) >= 0;
  const changeColor = up ? "var(--up-ink)" : "var(--down-ink)";
  const changeBg = up ? "var(--up-weak)" : "var(--down-weak)";

  return (
    <div className="border border-rule" style={{ background: "var(--surface)" }}>
      {/* Price row */}
      <div
        className="px-5 py-4 flex flex-wrap items-center justify-between gap-4 border-b border-rule"
        style={{ background: "var(--bg-sunken)" }}
      >
        <div className="flex items-baseline gap-3 flex-wrap">
          <span className="display text-[38px] text-foreground leading-none tracking-tight">
            ${fmtPrice(quote.price)}
          </span>
          {quote.changePct !== null && (
            <span
              className="mono text-[14px] font-semibold px-2.5 py-1 rounded-[6px]"
              style={{ color: changeColor, background: changeBg }}
            >
              {up ? "▲" : "▼"} {Math.abs(quote.changePct).toFixed(2)}%
            </span>
          )}
          {quote.prevClose !== null && (
            <span className="mono text-[11px] text-dim">
              prev close ${fmtPrice(quote.prevClose)}
            </span>
          )}
        </div>
        <div className="mono text-[9px] text-dim text-right">
          <div>{quote.freshnessLabel}</div>
          <a
            href={quote.sourceUrl}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="hover:text-muted transition-colors underline underline-offset-2"
          >
            source ↗
          </a>
        </div>
      </div>

      {/* Key stats grid */}
      {keyStats && (
        <div className="px-5 py-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-4">
            {/* Market cap */}
            <div>
              <div className="mono text-[9px] text-dim uppercase tracking-[0.1em] mb-1">Market Cap</div>
              <div className="display text-[18px] text-foreground leading-none">
                {keyStats.marketCap !== null ? fmtCap(keyStats.marketCap) : "—"}
              </div>
            </div>

            {/* P/E */}
            <div>
              <div className="mono text-[9px] text-dim uppercase tracking-[0.1em] mb-1">P/E (TTM)</div>
              <div className="display text-[18px] text-foreground leading-none">
                {keyStats.peRatio !== null ? fmtPE(keyStats.peRatio) : "—"}
              </div>
            </div>

            {/* 52-week range — spans 2 columns on desktop */}
            {keyStats.week52High !== null && keyStats.week52Low !== null ? (
              <div className="col-span-2">
                <div className="mono text-[9px] text-dim uppercase tracking-[0.1em] mb-1">52-Week Range</div>
                <div className="display text-[18px] text-foreground leading-none">
                  ${fmtPrice(keyStats.week52Low)} – ${fmtPrice(keyStats.week52High)}
                </div>
                <RangeBar
                  low={keyStats.week52Low}
                  high={keyStats.week52High}
                  current={quote.price}
                />
              </div>
            ) : (
              <div className="col-span-2">
                <div className="mono text-[9px] text-dim uppercase tracking-[0.1em] mb-1">52-Week Range</div>
                <div className="display text-[18px] text-foreground">—</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
