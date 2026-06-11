"use client";

import { useId } from "react";

type AreaChartProps = {
  data: number[];
  /** intrinsic viewBox size; the SVG scales fluidly to its container width */
  width?: number;
  height?: number;
  strokeWidth?: number;
  /** show the most-recent value as a dot */
  showDot?: boolean;
  /** accessible label */
  ariaLabel?: string;
  className?: string;
};

/**
 * AreaChart — a lightweight SVG line + filled area, teal accent on paper.
 * Fluid width (preserveAspectRatio=none). No chart library. The fill is a
 * token tint built with color-mix, so no non-token colour ever appears.
 */
export function AreaChart({
  data,
  width = 600,
  height = 200,
  strokeWidth = 2,
  showDot = true,
  ariaLabel = "Trend chart",
  className = "",
}: AreaChartProps) {
  const gradId = useId();

  if (!data || data.length < 2) {
    return (
      <div
        className={`cvq-skeleton ${className}`}
        style={{ width: "100%", height, borderRadius: "var(--radius-card)" }}
        aria-hidden
      />
    );
  }

  const padX = 4;
  const padY = strokeWidth + 6;
  const n = data.length;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;

  const pts = data.map((v, i) => {
    const x = padX + (i / (n - 1)) * innerW;
    const y = padY + innerH - ((v - min) / span) * innerH;
    return [x, y] as const;
  });

  const line = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const area = `${line} L${pts[n - 1][0].toFixed(1)} ${height} L${pts[0][0].toFixed(1)} ${height} Z`;
  const last = pts[n - 1];

  return (
    <svg
      className={className}
      width="100%"
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={ariaLabel}
      style={{ display: "block", overflow: "visible" }}
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          {/* a flat warm tonal step from token tint → transparent (allowed) */}
          <stop offset="0%" style={{ stopColor: "color-mix(in srgb, var(--accent) 22%, transparent)" }} />
          <stop offset="100%" style={{ stopColor: "color-mix(in srgb, var(--accent) 0%, transparent)" }} />
        </linearGradient>
      </defs>
      <path d={area} style={{ fill: `url(#${gradId})` }} />
      <path
        d={line}
        style={{ stroke: "var(--accent)", strokeWidth, fill: "none" }}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      {showDot && (
        <circle
          cx={last[0]}
          cy={last[1]}
          r={strokeWidth + 1}
          style={{ fill: "var(--accent)", stroke: "var(--bg-surface)", strokeWidth: 2 }}
          vectorEffect="non-scaling-stroke"
        />
      )}
    </svg>
  );
}
