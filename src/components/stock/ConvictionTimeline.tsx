"use client";

import { useState } from "react";
import type { ConvictionPoint } from "@/lib/convictionHistory";
import type { Verdict } from "@/lib/agents/types";

// Conviction Timeline — a dependency-free SVG sparkline of the Council's
// conviction and disagreement scores over the trailing window. Each dot is one
// cached analysis run; hovering tells that run's story (verdict, dissents,
// bull/bear case). This is the proprietary AI-consensus dataset rendered.

const W = 720;
const H = 180;
const PAD = { left: 10, right: 10, top: 14, bottom: 22 };
const PLOT_W = W - PAD.left - PAD.right;
const PLOT_H = H - PAD.top - PAD.bottom;

const VERDICT_VAR: Record<Verdict, string> = {
  BUY: "var(--bull)",
  SELL: "var(--bear)",
  HOLD: "var(--hold)",
};

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function ConvictionTimeline({
  history,
  windowDays = 90,
}: {
  history: ConvictionPoint[];
  windowDays?: number;
}) {
  const [active, setActive] = useState<number | null>(null);

  // ── Empty state ───────────────────────────────────────────────────────────
  // History accumulates forward from the day the feature shipped; be honest
  // about that rather than faking a line.
  if (history.length === 0) {
    return (
      <section className="border border-rule px-5 py-5" style={{ background: "var(--surface)" }}>
        <h2 className="caps text-[9px] text-accent mb-2">Conviction timeline</h2>
        <p className="text-[13px] text-muted leading-relaxed max-w-xl">
          No history yet. Conviqt records the Council&rsquo;s conviction and disagreement
          on every run — once this ticker has been analyzed a few times, a
          {" "}{windowDays}-day time-series of how the verdict evolved will appear here.
        </p>
      </section>
    );
  }

  // ── Time domain ─────────────────────────────────────────────────────────────
  // Anchor the axis to the data itself (NOT Date.now()) so server and client
  // render identical coordinates — otherwise hydration mismatches. Right edge =
  // latest run; left edge = earlier of the first run and (latest − window), so a
  // young history spreads across the axis instead of bunching on the right.
  const firstRun = new Date(history[0].asOf).getTime();
  const lastRun = new Date(history[history.length - 1].asOf).getTime();
  const t0 = Math.min(firstRun, lastRun - windowDays * 86_400_000);
  const t1 = lastRun;
  const span = Math.max(t1 - t0, 1);

  const xOf = (iso: string) =>
    PAD.left + ((new Date(iso).getTime() - t0) / span) * PLOT_W;
  const yOf = (score: number) =>
    PAD.top + (1 - Math.max(0, Math.min(100, score)) / 100) * PLOT_H;

  const pts = history.map((p, i) => ({
    p,
    i,
    x: xOf(p.asOf),
    cy: yOf(p.conviction),
    dy: yOf(p.disagreement),
  }));

  const convLine = pts.map((q) => `${q.x},${q.cy}`).join(" ");
  const disagLine = pts.map((q) => `${q.x},${q.dy}`).join(" ");

  const latest = history[history.length - 1];
  const latestColor = VERDICT_VAR[latest.verdict];
  const activePt = active !== null ? pts[active] : null;

  return (
    <section className="border border-rule px-5 py-5" style={{ background: "var(--surface)" }}>
      <div className="flex items-baseline justify-between gap-3 mb-1">
        <h2 className="caps text-[9px] text-accent">Conviction timeline</h2>
        <div className="flex items-center gap-4 mono text-[9px] text-dim">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-[2px]" style={{ background: latestColor }} />
            conviction
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-[2px] border-t border-dashed" style={{ borderColor: "var(--muted)" }} />
            disagreement
          </span>
        </div>
      </div>
      <p className="text-[11px] text-dim mb-3">
        History from {shortDate(history[0].asOf)} · {history.length} run
        {history.length === 1 ? "" : "s"} · each dot is a Council analysis
      </p>

      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-auto"
          role="img"
          aria-label={`Conviction and disagreement timeline for ${latest.ticker}`}
          onMouseLeave={() => setActive(null)}
        >
          {/* gridlines at 0 / 50 / 100 */}
          {[0, 50, 100].map((g) => (
            <g key={g}>
              <line
                x1={PAD.left}
                x2={W - PAD.right}
                y1={yOf(g)}
                y2={yOf(g)}
                stroke="var(--rule)"
                strokeWidth={1}
                strokeDasharray={g === 0 || g === 100 ? undefined : "2 4"}
                opacity={0.5}
              />
              <text x={2} y={yOf(g) + 3} fontSize={8} fill="var(--dim)" className="mono">
                {g}
              </text>
            </g>
          ))}

          {/* disagreement (dashed, muted) */}
          {pts.length > 1 && (
            <polyline
              points={disagLine}
              fill="none"
              stroke="var(--muted)"
              strokeWidth={1.25}
              strokeDasharray="3 3"
              opacity={0.8}
            />
          )}
          {/* conviction (solid, verdict-colored) */}
          {pts.length > 1 && (
            <polyline points={convLine} fill="none" stroke={latestColor} strokeWidth={2} />
          )}

          {/* dots + hover targets */}
          {pts.map((q) => {
            const isActive = active === q.i;
            return (
              <g key={q.i}>
                <circle cx={q.x} cy={q.dy} r={isActive ? 3 : 2} fill="var(--muted)" opacity={0.85} />
                <circle
                  cx={q.x}
                  cy={q.cy}
                  r={isActive ? 4.5 : 3}
                  fill={VERDICT_VAR[q.p.verdict]}
                  stroke="var(--surface)"
                  strokeWidth={1}
                />
                {isActive && (
                  <line
                    x1={q.x}
                    x2={q.x}
                    y1={PAD.top}
                    y2={H - PAD.bottom}
                    stroke="var(--rule)"
                    strokeWidth={1}
                  />
                )}
                {/* fat invisible hit area */}
                <circle
                  cx={q.x}
                  cy={(q.cy + q.dy) / 2}
                  r={Math.max(12, Math.abs(q.cy - q.dy) / 2 + 8)}
                  fill="transparent"
                  onMouseEnter={() => setActive(q.i)}
                  style={{ cursor: "pointer" }}
                />
              </g>
            );
          })}

          {/* x-axis end labels */}
          <text x={PAD.left} y={H - 6} fontSize={8} fill="var(--dim)" className="mono">
            {shortDate(new Date(t0).toISOString())}
          </text>
          <text x={W - PAD.right} y={H - 6} fontSize={8} fill="var(--dim)" textAnchor="end" className="mono">
            {shortDate(new Date(t1).toISOString())}
          </text>
        </svg>

        {/* hover tooltip — positioned in the same fractional space as the SVG */}
        {activePt && (
          <div
            className="absolute z-10 pointer-events-none border border-rule px-3 py-2 shadow-lg w-[230px]"
            style={{
              background: "var(--surface-2)",
              left: `${(activePt.x / W) * 100}%`,
              top: `${(Math.min(activePt.cy, activePt.dy) / H) * 100}%`,
              transform:
                activePt.x > W / 2 ? "translate(-100%, -100%)" : "translate(0, -100%)",
            }}
          >
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <span className="mono text-[10px] text-dim">{shortDate(activePt.p.asOf)}</span>
              <span
                className="mono text-[11px] font-bold tracking-[0.06em]"
                style={{ color: VERDICT_VAR[activePt.p.verdict] }}
              >
                {activePt.p.verdict}
              </span>
            </div>
            <div className="flex items-center justify-between mono text-[10px] text-muted">
              <span>conviction</span>
              <span className="text-foreground">{activePt.p.conviction}/100</span>
            </div>
            <div className="flex items-center justify-between mono text-[10px] text-muted mb-1.5">
              <span>disagreement</span>
              <span className="text-foreground">{activePt.p.disagreement}/100</span>
            </div>
            {activePt.p.dissents.length > 0 && (
              <div className="mono text-[9px] text-dim mb-1.5 leading-snug">
                dissent: <span className="text-muted">{activePt.p.dissents.join(", ")}</span>
              </div>
            )}
            {activePt.p.bullLine && (
              <p className="text-[10px] text-foreground/70 leading-snug border-t border-rule pt-1.5">
                <span style={{ color: "var(--bull)" }}>Bull:</span> {activePt.p.bullLine}
              </p>
            )}
            {activePt.p.bearLine && (
              <p className="text-[10px] text-foreground/70 leading-snug mt-1">
                <span style={{ color: "var(--bear)" }}>Bear:</span> {activePt.p.bearLine}
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
