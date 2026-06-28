"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { Candle, HistoryRange } from "@/lib/marketdata";

// ── Types ──────────────────────────────────────────────────────────────────

interface MarketPayload {
  quote: { price: number; changePct: number | null; freshnessLabel: string } | null;
  history: { candles: Candle[]; range: HistoryRange } | null;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  if (n >= 1000) return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function shortDate(dateStr: string): string {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function monthYear(dateStr: string): string {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", {
    month: "short",
    year: "2-digit",
  });
}

const RANGES: { label: string; value: HistoryRange }[] = [
  { label: "1M", value: "1mo" },
  { label: "3M", value: "3mo" },
  { label: "6M", value: "6mo" },
  { label: "1Y", value: "1y" },
];

// ── Main chart ─────────────────────────────────────────────────────────────

export default function PriceChart({
  ticker,
  initialData,
}: {
  ticker: string;
  initialData?: MarketPayload | null;
}) {
  const [range, setRange] = useState<HistoryRange>("3mo");
  // rangeData caches history per range so switching back is instant
  const [rangeData, setRangeData] = useState<Partial<Record<HistoryRange, Candle[]>>>({});
  const [quote, setQuote] = useState<MarketPayload["quote"]>(initialData?.quote ?? null);
  const [loading, setLoading] = useState(!initialData);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const fetchRange = useCallback(
    async (r: HistoryRange) => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/stock/${encodeURIComponent(ticker.toLowerCase())}/market?range=${r}`
        );
        if (!res.ok) throw new Error("fetch failed");
        const json: MarketPayload & { keyStats?: unknown } = await res.json();
        if (json.quote) setQuote(json.quote);
        if (json.history?.candles) {
          setRangeData((prev) => ({ ...prev, [r]: json.history!.candles }));
        }
      } catch {
        // keep stale
      } finally {
        setLoading(false);
      }
    },
    [ticker]
  );

  // Seed from initialData on first render
  useEffect(() => {
    if (initialData?.quote) setQuote(initialData.quote);
    if (initialData?.history?.candles) {
      setRangeData({ "3mo": initialData.history.candles });
      setLoading(false);
    }
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch when range changes and we don't have cached data for it
  useEffect(() => {
    if (!rangeData[range]) fetchRange(range);
    else setLoading(false);
  }, [range, rangeData, fetchRange]);

  const candles = rangeData[range] ?? [];

  // chart goes up or down?
  const firstClose = candles[0]?.close ?? null;
  const lastClose = candles[candles.length - 1]?.close ?? null;
  const isUp = firstClose !== null && lastClose !== null ? lastClose >= firstClose : (quote?.changePct ?? 0) >= 0;
  const lineColor = isUp ? "var(--up-ink)" : "var(--down-ink)";
  const fillId = `pricefill-${ticker}`;

  // ── SVG geometry ───────────────────────────────────────────────────────
  const W = 800;
  const H = 160;
  const PAD = { top: 10, bottom: 24, left: 4, right: 4 };
  const PW = W - PAD.left - PAD.right;
  const PH = H - PAD.top - PAD.bottom;

  let points = "";
  let areaPath = "";
  let xTicks: { x: number; label: string }[] = [];

  if (candles.length > 1) {
    const prices = candles.map((c) => c.close);
    const minP = Math.min(...prices);
    const maxP = Math.max(...prices);
    const spread = maxP - minP || 1;

    const xOf = (i: number) => PAD.left + (i / (candles.length - 1)) * PW;
    const yOf = (p: number) => PAD.top + (1 - (p - minP) / spread) * PH;

    const pts = candles.map((c, i) => ({ x: xOf(i), y: yOf(c.close) }));
    points = pts.map((p) => `${p.x},${p.y}`).join(" ");

    const first = pts[0];
    const last = pts[pts.length - 1];
    areaPath = [
      `M${first.x},${first.y}`,
      ...pts.slice(1).map((p) => `L${p.x},${p.y}`),
      `L${last.x},${H - PAD.bottom}`,
      `L${first.x},${H - PAD.bottom}`,
      "Z",
    ].join(" ");

    // x-axis ticks: ~4 evenly spaced dates
    const tickCount = 4;
    xTicks = Array.from({ length: tickCount }, (_, i) => {
      const idx = Math.round((i / (tickCount - 1)) * (candles.length - 1));
      return {
        x: xOf(idx),
        label: candles.length > 90 ? monthYear(candles[idx].date) : shortDate(candles[idx].date),
      };
    });
  }

  // ── Hover state ────────────────────────────────────────────────────────
  const hoverCandle = hoverIdx !== null ? candles[hoverIdx] : null;
  const displayPrice = hoverCandle?.close ?? quote?.price ?? null;
  const displayDate = hoverCandle ? shortDate(hoverCandle.date) : null;

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (candles.length < 2) return;
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return;
      const relX = ((e.clientX - rect.left) / rect.width) * W;
      const frac = Math.max(0, Math.min(1, (relX - PAD.left) / PW));
      setHoverIdx(Math.round(frac * (candles.length - 1)));
    },
    [candles.length]
  );

  // ── Empty / loading states ─────────────────────────────────────────────
  if (loading && candles.length === 0) {
    return (
      <div
        className="border border-rule px-5"
        style={{ background: "var(--surface)", height: 220 }}
      >
        <div className="flex items-center justify-center h-full gap-2 text-dim mono text-[11px]">
          <span
            className="h-1.5 w-1.5 rounded-full animate-pulse"
            style={{ background: "var(--accent)" }}
          />
          Loading price data…
        </div>
      </div>
    );
  }

  if (!loading && candles.length === 0) {
    return (
      <div
        className="border border-rule px-5 py-6"
        style={{ background: "var(--surface)" }}
      >
        <p className="mono text-[11px] text-dim">Price chart unavailable · no data from providers</p>
      </div>
    );
  }

  // ── Hover x-line geometry (mirrors xOf) ───────────────────────────────
  const hoverX =
    hoverIdx !== null && candles.length > 1
      ? PAD.left + (hoverIdx / (candles.length - 1)) * PW
      : null;

  return (
    <div className="border border-rule" style={{ background: "var(--surface)" }}>
      {/* Header: current price + range tabs */}
      <div className="px-5 pt-4 pb-2 flex items-center justify-between gap-4 flex-wrap">
        <div>
          {displayPrice !== null ? (
            <div className="flex items-baseline gap-2.5 flex-wrap">
              <span className="display text-[28px] text-foreground leading-none tracking-tight">
                ${fmt(displayPrice)}
              </span>
              {displayDate ? (
                <span className="mono text-[11px] text-dim">{displayDate}</span>
              ) : quote?.changePct !== null && quote?.changePct !== undefined ? (
                <span
                  className="mono text-[13px] font-medium"
                  style={{ color: (quote.changePct ?? 0) >= 0 ? "var(--up-ink)" : "var(--down-ink)" }}
                >
                  {quote.changePct >= 0 ? "▲" : "▼"} {Math.abs(quote.changePct).toFixed(2)}%
                </span>
              ) : null}
            </div>
          ) : (
            <span className="mono text-[12px] text-dim">Price unavailable</span>
          )}
          {quote && !displayDate && (
            <div className="mono text-[9px] text-dim mt-1">{quote.freshnessLabel}</div>
          )}
        </div>

        {/* Range tabs */}
        <div className="flex items-center gap-1">
          {RANGES.map((r) => {
            const active = range === r.value;
            return (
              <button
                key={r.value}
                onClick={() => { setRange(r.value); setHoverIdx(null); }}
                className="mono text-[10px] px-2.5 py-1 rounded-sm transition-colors"
                style={{
                  background: active ? "var(--accent)" : "transparent",
                  color: active ? "var(--on-accent)" : "var(--text-muted)",
                  border: active ? "1px solid var(--accent)" : "1px solid var(--border)",
                }}
              >
                {r.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* SVG chart */}
      <div className="px-4 pb-3 relative">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-auto"
          style={{ display: "block", overflow: "visible" }}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverIdx(null)}
          aria-label={`${ticker} price chart`}
        >
          <defs>
            <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={lineColor} stopOpacity={0.18} />
              <stop offset="100%" stopColor={lineColor} stopOpacity={0} />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {[PAD.top, PAD.top + PH / 2, PAD.top + PH].map((y) => (
            <line
              key={y}
              x1={PAD.left}
              x2={W - PAD.right}
              y1={y}
              y2={y}
              stroke="var(--border)"
              strokeWidth={0.75}
              opacity={0.5}
            />
          ))}

          {/* Hover crosshair */}
          {hoverX !== null && (
            <line
              x1={hoverX}
              x2={hoverX}
              y1={PAD.top}
              y2={H - PAD.bottom}
              stroke="var(--border-strong)"
              strokeWidth={1}
              strokeDasharray="3 3"
            />
          )}

          {/* Area fill */}
          {areaPath && (
            <path d={areaPath} fill={`url(#${fillId})`} />
          )}

          {/* Price line */}
          {points && (
            <polyline
              points={points}
              fill="none"
              stroke={lineColor}
              strokeWidth={1.75}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}

          {/* Current price dot (rightmost point) */}
          {candles.length > 0 && (
            <circle
              cx={PAD.left + PW}
              cy={
                PAD.top +
                (1 -
                  ((candles[candles.length - 1].close - Math.min(...candles.map((c) => c.close))) /
                    (Math.max(...candles.map((c) => c.close)) -
                      Math.min(...candles.map((c) => c.close)) || 1))) *
                  PH
              }
              r={3.5}
              fill={lineColor}
              stroke="var(--surface)"
              strokeWidth={2}
            />
          )}

          {/* Hover dot */}
          {hoverIdx !== null && candles[hoverIdx] && (() => {
            const prices = candles.map((c) => c.close);
            const minP = Math.min(...prices);
            const maxP = Math.max(...prices);
            const spread = maxP - minP || 1;
            const hx = PAD.left + (hoverIdx / (candles.length - 1)) * PW;
            const hy = PAD.top + (1 - (candles[hoverIdx].close - minP) / spread) * PH;
            return (
              <circle
                cx={hx}
                cy={hy}
                r={4}
                fill={lineColor}
                stroke="var(--surface)"
                strokeWidth={2}
              />
            );
          })()}

          {/* X-axis date labels */}
          {xTicks.map((t, i) => (
            <text
              key={i}
              x={t.x}
              y={H - 4}
              fontSize={9}
              fill="var(--text-muted)"
              textAnchor={i === 0 ? "start" : i === xTicks.length - 1 ? "end" : "middle"}
              className="mono"
            >
              {t.label}
            </text>
          ))}
        </svg>
      </div>
    </div>
  );
}
