type Tone = "accent" | "up" | "down";

const STROKE: Record<Tone, string> = {
  accent: "var(--accent)",
  up: "var(--up)",
  down: "var(--down)",
};

function points(data: number[], w: number, h: number, pad: number) {
  const n = data.length;
  if (n === 0) return [];
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const innerW = w - pad * 2;
  const innerH = h - pad * 2;
  return data.map((v, i) => {
    const x = n === 1 ? w / 2 : pad + (i / (n - 1)) * innerW;
    const y = pad + innerH - ((v - min) / span) * innerH;
    return [x, y] as const;
  });
}

type SparklineProps = {
  data: number[];
  width?: number;
  height?: number;
  /** auto-color by first→last direction (up/down), overriding `tone` */
  autoTone?: boolean;
  tone?: Tone;
  strokeWidth?: number;
  /** dot on the most recent point */
  showDot?: boolean;
  className?: string;
};

/**
 * Sparkline — a tiny inline SVG trend line, teal on paper. No library, no axes.
 * Colours come only from tokens (accent / up / down).
 */
export function Sparkline({
  data,
  width = 120,
  height = 32,
  autoTone = false,
  tone = "accent",
  strokeWidth = 1.75,
  showDot = false,
  className = "",
}: SparklineProps) {
  if (!data || data.length < 2) {
    return <span className={`cvq-skeleton ${className}`} style={{ display: "inline-block", width, height }} aria-hidden />;
  }
  const pad = strokeWidth + 1;
  const pts = points(data, width, height, pad);
  const d = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const resolved: Tone = autoTone ? (data[data.length - 1] >= data[0] ? "up" : "down") : tone;
  const last = pts[pts.length - 1];

  return (
    <svg
      className={className}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      fill="none"
      aria-hidden
      style={{ display: "block", overflow: "visible" }}
    >
      <path
        d={d}
        style={{ stroke: STROKE[resolved], strokeWidth, fill: "none" }}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {showDot && (
        <circle cx={last[0]} cy={last[1]} r={strokeWidth + 0.5} style={{ fill: STROKE[resolved] }} />
      )}
    </svg>
  );
}
