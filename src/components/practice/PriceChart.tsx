// A small, dependency-free SVG line chart for Practice. Plots one or two series
// (price; price + a benchmark/equity overlay), with trade and event markers and
// an optional "revealed through" cursor so the live episode never draws the
// future. Pure presentational — no 3D, per CLAUDE.md (charts on the dashboard
// stay flat SVG).

const INK = "var(--text)";
const FAINT = "var(--text-muted)";
const GRID = "var(--border)";
const MONO = "var(--font-ui)";

export type MarkerKind =
  | "buy" | "sell" | "stop" | "target"
  | "event-bull" | "event-bear" | "event-neutral";

export interface ChartSeries {
  values: number[];
  color: string;
  label?: string;
  dashed?: boolean;
}

export interface ChartMarker {
  index: number;
  kind: MarkerKind;
  label?: string;
}

const EVENT_COLOR: Record<string, string> = {
  "event-bull": "var(--up-ink)",
  "event-bear": "var(--down-ink)",
  "event-neutral": "var(--text-2)",
};

function fmt(v: number): string {
  if (Math.abs(v) >= 1000) return v.toLocaleString(undefined, { maximumFractionDigits: 0 });
  if (Math.abs(v) >= 100) return v.toFixed(1);
  return v.toFixed(2);
}

export function PriceChart({
  labels,
  series,
  markers = [],
  revealedThrough,
  height = 300,
  valuePrefix = "$",
}: {
  labels: string[];
  series: ChartSeries[];
  markers?: ChartMarker[];
  revealedThrough?: number;
  height?: number;
  valuePrefix?: string;
}) {
  const W = 800;
  const H = height;
  const padL = 14, padR = 66, padT = 20, padB = 30;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const n = labels.length;
  const last = n - 1;
  const revealed = Math.max(0, Math.min(revealedThrough ?? last, last));

  const xFor = (i: number) => padL + (n <= 1 ? plotW / 2 : (i / last) * plotW);

  // y-domain across all series, only over revealed indices.
  let lo = Infinity, hi = -Infinity;
  for (const s of series) {
    for (let i = 0; i <= revealed; i++) {
      const v = s.values[i];
      if (typeof v === "number" && Number.isFinite(v)) {
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }
    }
  }
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) { lo = 0; hi = 1; }
  if (lo === hi) { lo -= 1; hi += 1; }
  const pad = (hi - lo) * 0.08;
  lo -= pad; hi += pad;
  const yFor = (v: number) => padT + (1 - (v - lo) / (hi - lo)) * plotH;

  const gridVals = [0, 0.25, 0.5, 0.75, 1].map((f) => lo + f * (hi - lo));

  // x labels: show ~5, evenly spaced over revealed range.
  const labelIdx: number[] = [];
  const stepCount = Math.min(5, revealed + 1);
  for (let k = 0; k < stepCount; k++) {
    labelIdx.push(stepCount === 1 ? 0 : Math.round((k / (stepCount - 1)) * revealed));
  }

  const primary = series[0];
  const lastVal = primary?.values[revealed];

  function pathFor(s: ChartSeries): string {
    let d = "";
    for (let i = 0; i <= revealed; i++) {
      const v = s.values[i];
      if (typeof v !== "number" || !Number.isFinite(v)) continue;
      d += `${d ? "L" : "M"} ${xFor(i).toFixed(1)} ${yFor(v).toFixed(1)} `;
    }
    return d.trim();
  }

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      style={{ width: "100%", height: "auto", display: "block" }}
      role="img"
      aria-label="Price chart"
    >
      {/* gridlines + y labels */}
      {gridVals.map((gv, i) => {
        const y = yFor(gv);
        return (
          <g key={i}>
            <line x1={padL} y1={y} x2={padL + plotW} y2={y} stroke={GRID} strokeWidth={1} />
            <text x={padL + plotW + 8} y={y + 3.5} fill={FAINT} fontFamily={MONO} fontSize={11}>
              {valuePrefix}{fmt(gv)}
            </text>
          </g>
        );
      })}

      {/* event guidelines */}
      {markers.filter((m) => m.kind.startsWith("event") && m.index <= revealed).map((m, i) => {
        const x = xFor(m.index);
        const c = EVENT_COLOR[m.kind] ?? FAINT;
        return (
          <g key={`ev-${i}`}>
            <line x1={x} y1={padT} x2={x} y2={padT + plotH} stroke={c} strokeWidth={1} strokeDasharray="2 4" opacity={0.32} />
            <circle cx={x} cy={padT + 2} r={2.6} fill={c} />
          </g>
        );
      })}

      {/* series */}
      {series.map((s, i) => (
        <path
          key={i}
          d={pathFor(s)}
          fill="none"
          stroke={s.color}
          strokeWidth={i === 0 ? 2 : 1.6}
          strokeDasharray={s.dashed ? "5 5" : undefined}
          strokeLinejoin="round"
          strokeLinecap="round"
          opacity={i === 0 ? 1 : 0.7}
        />
      ))}

      {/* trade markers on the primary series */}
      {primary && markers.filter((m) => !m.kind.startsWith("event") && m.index <= revealed).map((m, i) => {
        const v = primary.values[m.index];
        if (typeof v !== "number") return null;
        const x = xFor(m.index);
        const y = yFor(v);
        if (m.kind === "buy") {
          return <polygon key={`mk-${i}`} points={`${x},${y + 5} ${x - 5},${y + 14} ${x + 5},${y + 14}`} fill="var(--up-ink)" />;
        }
        if (m.kind === "sell") {
          return <polygon key={`mk-${i}`} points={`${x},${y - 5} ${x - 5},${y - 14} ${x + 5},${y - 14}`} fill="var(--down-ink)" />;
        }
        // stop / target auto-fills: hollow markers
        const c = m.kind === "target" ? "var(--accent)" : "var(--accent)";
        return <polygon key={`mk-${i}`} points={`${x},${y - 5} ${x - 5},${y - 14} ${x + 5},${y - 14}`} fill="none" stroke={c} strokeWidth={1.5} />;
      })}

      {/* last revealed point + value */}
      {primary && typeof lastVal === "number" && (
        <>
          <circle cx={xFor(revealed)} cy={yFor(lastVal)} r={3.5} fill={primary.color} />
          <circle cx={xFor(revealed)} cy={yFor(lastVal)} r={7} fill="none" stroke={primary.color} strokeWidth={1} opacity={0.35} />
        </>
      )}

      {/* x labels */}
      {labelIdx.map((idx, i) => (
        <text
          key={`xl-${i}`}
          x={xFor(idx)}
          y={H - 9}
          fill={FAINT}
          fontFamily={MONO}
          fontSize={11}
          textAnchor={i === 0 ? "start" : i === labelIdx.length - 1 ? "end" : "middle"}
        >
          {labels[idx]}
        </text>
      ))}

      {/* legend for overlay series */}
      {series.length > 1 && (
        <g>
          {series.map((s, i) => (
            <g key={`lg-${i}`} transform={`translate(${padL + 4 + i * 150}, ${padT - 6})`}>
              <line x1={0} y1={0} x2={16} y2={0} stroke={s.color} strokeWidth={2} strokeDasharray={s.dashed ? "5 5" : undefined} />
              <text x={21} y={3.5} fill={INK} fontFamily={MONO} fontSize={11}>{s.label}</text>
            </g>
          ))}
        </g>
      )}
    </svg>
  );
}
