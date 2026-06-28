"use client";

import { useState, useEffect } from "react";

interface Quote {
  price: number;
  changePct: number | null;
  freshnessLabel: string;
}

interface KeyStats {
  marketCap: number | null;
  peRatio: number | null;
}

interface TickerData {
  quote: Quote | null;
  keyStats: KeyStats | null;
}

function fmt(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtCap(n: number | null) {
  if (n === null || n === undefined) return null;
  if (n >= 1e12) return `$${(n / 1e12).toFixed(1)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  return `$${n.toLocaleString()}`;
}

function PriceBlock({
  data,
  loading,
}: {
  data: TickerData | null;
  loading: boolean;
}) {
  const q = data?.quote;

  if (loading || !q) {
    return (
      <div className="flex flex-col gap-1">
        <div className="display text-[26px] leading-none" style={{ color: "var(--text-muted)" }}>—</div>
        <div className="mono text-[9px]" style={{ color: "var(--text-muted)" }}>
          {loading ? "Loading…" : "Unavailable"}
        </div>
      </div>
    );
  }

  const isUp = (q.changePct ?? 0) >= 0;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className="display text-[26px] leading-none tracking-tight" style={{ color: "var(--text)" }}>
          ${fmt(q.price)}
        </span>
        {q.changePct !== null && (
          <span
            className="mono text-[11px] font-medium px-2 py-0.5 rounded-full"
            style={{
              background: isUp ? "var(--up-weak)" : "var(--down-weak)",
              color: isUp ? "var(--up-ink)" : "var(--down-ink)",
            }}
          >
            {isUp ? "▲" : "▼"} {Math.abs(q.changePct).toFixed(2)}%
          </span>
        )}
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        {fmtCap(data?.keyStats?.marketCap ?? null) && (
          <span className="mono text-[9px]" style={{ color: "var(--text-muted)" }}>
            Cap <span style={{ color: "var(--text-2)" }}>{fmtCap(data?.keyStats?.marketCap ?? null)}</span>
          </span>
        )}
        {data?.keyStats?.peRatio !== null && data?.keyStats?.peRatio !== undefined && (
          <span className="mono text-[9px]" style={{ color: "var(--text-muted)" }}>
            P/E <span style={{ color: "var(--text-2)" }}>{data.keyStats.peRatio.toFixed(1)}x</span>
          </span>
        )}
        <span className="mono text-[9px]" style={{ color: "var(--text-muted)" }}>
          {q.freshnessLabel}
        </span>
      </div>
    </div>
  );
}

export default function CompareMarketStrip({
  tickerA,
  tickerB,
}: {
  tickerA: string;
  tickerB: string;
}) {
  const [dataA, setDataA] = useState<TickerData | null>(null);
  const [dataB, setDataB] = useState<TickerData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const fetchBoth = async () => {
      try {
        const [ra, rb] = await Promise.allSettled([
          fetch(`/api/stock/${encodeURIComponent(tickerA.toLowerCase())}/market`, {
            cache: "no-store",
          }).then((r) => r.json()),
          fetch(`/api/stock/${encodeURIComponent(tickerB.toLowerCase())}/market`, {
            cache: "no-store",
          }).then((r) => r.json()),
        ]);
        if (cancelled) return;
        if (ra.status === "fulfilled") setDataA(ra.value);
        if (rb.status === "fulfilled") setDataB(rb.value);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchBoth();
    return () => { cancelled = true; };
  }, [tickerA, tickerB]);

  return (
    <div className="border-b border-rule" style={{ background: "var(--bg-sunken)" }}>
      <div className="grid grid-cols-[1fr_auto_1fr]">
        {/* Side A */}
        <div className="px-5 py-4">
          <div
            className="caps text-[8px] tracking-[0.12em] mb-2"
            style={{ color: "var(--text-muted)" }}
          >
            {tickerA}
          </div>
          <PriceBlock data={dataA} loading={loading} />
        </div>

        {/* Divider */}
        <div className="flex items-center px-4 py-4">
          <div
            className="h-full w-px opacity-40"
            style={{ background: "var(--border)", minHeight: 40 }}
          />
          <span
            className="mono text-[11px] font-medium px-3"
            style={{ color: "var(--text-muted)" }}
          >
            vs
          </span>
          <div
            className="h-full w-px opacity-40"
            style={{ background: "var(--border)", minHeight: 40 }}
          />
        </div>

        {/* Side B */}
        <div className="px-5 py-4">
          <div
            className="caps text-[8px] tracking-[0.12em] mb-2"
            style={{ color: "var(--text-muted)" }}
          >
            {tickerB}
          </div>
          <PriceBlock data={dataB} loading={loading} />
        </div>
      </div>
    </div>
  );
}
