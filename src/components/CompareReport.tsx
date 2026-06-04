"use client";

import { useState } from "react";
import type {
  CompareEdge,
  CompareResult,
  CouncilResult,
  Verdict,
} from "@/lib/agents/types";
import CouncilReport from "./CouncilReport";
import { ConvictionRing } from "./viz/CouncilViz";

// ── Color helpers ─────────────────────────────────────────────────────────

function verdictColor(v: Verdict): string {
  if (v === "BUY") return "var(--bull)";
  if (v === "SELL") return "var(--bear)";
  return "var(--hold)";
}

// ── Side header chip ──────────────────────────────────────────────────────

function SideChip({
  side,
  result,
  isWinner,
}: {
  side: "A" | "B";
  result: CouncilResult;
  isWinner: boolean;
}) {
  const { judge, ticker, factSheet } = result;
  const vColor = verdictColor(judge.verdict);
  const convMax = judge.conviction > 10 ? 100 : 10;
  const disMax = judge.disagreement > 10 ? 100 : 10;

  return (
    <div
      className="px-4 py-4"
      style={{
        background: isWinner ? "var(--surface-3)" : "var(--surface-2)",
        borderTop: `3px solid ${isWinner ? "var(--accent)" : "var(--rule)"}`,
      }}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="caps text-[9px] text-dim">Side {side}</span>
        {isWinner && (
          <span
            className="mono text-[9px] tracking-[0.14em] uppercase px-1.5 py-px rounded"
            style={{ color: "var(--accent)", border: "1px solid var(--accent-border)" }}
          >
            Winner
          </span>
        )}
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="display text-[26px] text-foreground leading-none tracking-tight">
              {ticker}
            </span>
            <span
              className="mono text-[14px] font-bold tracking-[0.06em]"
              style={{ color: vColor }}
            >
              {judge.verdict}
            </span>
          </div>
          <div className="mono text-[10px] text-dim mt-1 truncate">{factSheet.companyName}</div>
          <div className="mono text-[9px] text-dim mt-2.5">
            disagree {judge.disagreement}/{disMax}
          </div>
        </div>
        <ConvictionRing
          value={judge.conviction}
          max={convMax}
          color={vColor}
          label="conviction"
          size={54}
        />
      </div>
    </div>
  );
}

// ── Scorecard row ─────────────────────────────────────────────────────────

function edgeStyle(edge: CompareEdge, side: "a" | "b") {
  const wins = edge === side;
  return {
    color: wins ? "var(--foreground)" : "var(--muted)",
    fontWeight: wins ? 600 : 400,
    background: wins ? "var(--surface-3)" : "transparent",
  } as const;
}

// ── Main report ───────────────────────────────────────────────────────────

export default function CompareReport({
  result,
  costUSD,
}: {
  result: CompareResult;
  costUSD?: number;
}) {
  const [showA, setShowA] = useState(false);
  const [showB, setShowB] = useState(false);
  const { tickerA, tickerB, a, b, verdict } = result;

  const winnerTicker =
    verdict.winner === "A" ? tickerA : verdict.winner === "B" ? tickerB : null;

  return (
    <article className="border border-rule overflow-hidden" style={{ background: "var(--surface)" }}>
      {/* ── Header ──────────────────────────────────────────────────── */}
      <header className="border-b border-rule px-5 py-4" style={{ background: "var(--surface-2)" }}>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-baseline gap-2.5">
            <span className="caps text-[9px] text-accent">Head-to-head</span>
            <span className="display text-[22px] text-foreground leading-none tracking-tight">
              {tickerA} <span className="text-dim">vs</span> {tickerB}
            </span>
          </div>
          <div className="mono text-[11px] text-muted">
            {winnerTicker ? (
              <>
                Verdict: <span style={{ color: "var(--accent)" }}>{winnerTicker}</span>
              </>
            ) : (
              <span style={{ color: "var(--hold)" }}>Verdict: too close to call</span>
            )}
          </div>
        </div>
      </header>

      {/* ── Headline (the shareable line) ───────────────────────────── */}
      {verdict.headline && (
        <section className="px-5 py-5 border-b border-rule">
          <p className="serif italic text-[20px] text-foreground/95 leading-snug">
            &ldquo;{verdict.headline}&rdquo;
          </p>
        </section>
      )}

      {/* ── Two-column side chips ───────────────────────────────────── */}
      <section className="border-b border-rule grid grid-cols-2 divide-x divide-rule">
        <SideChip side="A" result={a} isWinner={verdict.winner === "A"} />
        <SideChip side="B" result={b} isWinner={verdict.winner === "B"} />
      </section>

      {/* ── Scorecard ───────────────────────────────────────────────── */}
      {verdict.dimensions.length > 0 && (
        <section className="border-b border-rule">
          <div className="px-5 pt-5 pb-3 caps text-[9px] text-accent">Scorecard</div>
          {/* column heads */}
          <div className="grid grid-cols-[1fr_auto_1fr] items-center px-5 pb-2 gap-3">
            <div className="mono text-[10px] text-muted text-right truncate">{tickerA}</div>
            <div className="mono text-[9px] text-dim uppercase tracking-[0.12em] text-center w-24" />
            <div className="mono text-[10px] text-muted text-left truncate">{tickerB}</div>
          </div>
          <div>
            {verdict.dimensions.map((d, i) => (
              <div
                key={i}
                className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-5 py-2.5 border-t border-rule"
              >
                <div className="text-right">
                  <span className="mono text-[12px] px-1.5 py-0.5 rounded" style={edgeStyle(d.edge, "a")}>
                    {d.aValue}
                  </span>
                </div>
                <div className="w-24 text-center">
                  <div className="caps text-[8px] text-dim leading-tight">{d.dimension}</div>
                  <EdgeMeter edge={d.edge} />
                </div>
                <div className="text-left">
                  <span className="mono text-[12px] px-1.5 py-0.5 rounded" style={edgeStyle(d.edge, "b")}>
                    {d.bValue}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Comparative summary ─────────────────────────────────────── */}
      {verdict.summary && (
        <section className="px-5 py-5 border-b border-rule">
          <div className="caps text-[9px] text-accent mb-3">The comparison</div>
          <p className="serif text-[15px] text-foreground/90 leading-[1.72]">{verdict.summary}</p>
        </section>
      )}

      {/* ── Edge breakdown ──────────────────────────────────────────── */}
      <section className="border-b border-rule grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-rule">
        <EdgeCell title="Valuation" body={verdict.valuationEdge} />
        <EdgeCell title="Positioning" body={verdict.positioningEdge} />
        <EdgeCell title="Catalysts" body={verdict.catalystEdge} />
        <EdgeCell title="Risk / reward" body={verdict.riskRewardEdge} />
      </section>

      {/* ── Bottom line ─────────────────────────────────────────────── */}
      {verdict.bottomLine && (
        <section className="px-5 py-5 border-b border-rule" style={{ background: "var(--surface-2)" }}>
          <div className="caps text-[9px] text-accent mb-3">The trade</div>
          <p className="serif italic text-[19px] text-foreground/95 leading-snug">
            &ldquo;{verdict.bottomLine}&rdquo;
          </p>
        </section>
      )}

      {/* ── Per-side full Council reports (collapsible) ─────────────── */}
      <section className="px-5 py-3 border-b border-rule flex flex-wrap gap-x-6 gap-y-2">
        <ExpandToggle label={`${tickerA} full Council`} open={showA} onClick={() => setShowA((v) => !v)} />
        <ExpandToggle label={`${tickerB} full Council`} open={showB} onClick={() => setShowB((v) => !v)} />
      </section>
      {showA && (
        <div className="px-5 py-4 border-b border-rule">
          <CouncilReport result={a} />
        </div>
      )}
      {showB && (
        <div className="px-5 py-4 border-b border-rule">
          <CouncilReport result={b} />
        </div>
      )}

      {/* ── Footer ──────────────────────────────────────────────────── */}
      <footer className="px-5 py-3 flex flex-wrap items-center gap-4 mono text-[10px] text-dim">
        <span>asOf {new Date(result.asOf).toLocaleString()}</span>
        <span>run {(result.totalDurationMs / 1000).toFixed(1)}s</span>
        <span>cost ${(costUSD ?? result.estCostUSD).toFixed(4)}</span>
        {result.cached && <span style={{ color: "var(--hold)" }}>cached</span>}
      </footer>
    </article>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

// Diverging edge meter: a colored bar leans from the centre toward the side
// that wins this dimension (left = A, right = B). Ties stay centred and empty.
function EdgeMeter({ edge }: { edge: CompareEdge }) {
  const tie = edge === "tie";
  const a = edge === "a";
  return (
    <div className="relative mx-auto mt-1.5" style={{ width: 80, height: 6 }}>
      <div className="absolute inset-0 rounded-full" style={{ background: "var(--rule)" }} />
      {/* centre tick */}
      <div
        className="absolute"
        style={{ left: "50%", top: -2, width: 1, height: 10, background: "var(--dim)", transform: "translateX(-0.5px)" }}
      />
      {!tie && (
        <div
          className="absolute top-0 bottom-0 rounded-full slide-up"
          style={{
            background: "var(--accent)",
            boxShadow: "0 0 6px rgba(79,135,247,0.4)",
            left: a ? "14%" : "50%",
            right: a ? "50%" : "14%",
          }}
        />
      )}
    </div>
  );
}

function EdgeCell({ title, body }: { title: string; body: string }) {
  if (!body) return null;
  return (
    <div className="px-5 py-5">
      <div className="caps text-[9px] text-accent mb-2.5">{title}</div>
      <p className="serif text-[14px] text-foreground/82 leading-[1.7]">{body}</p>
    </div>
  );
}

function ExpandToggle({
  label,
  open,
  onClick,
}: {
  label: string;
  open: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 mono text-[10px] text-dim hover:text-muted transition-colors text-left"
    >
      <svg
        width="8"
        height="8"
        viewBox="0 0 8 8"
        fill="none"
        className="flex-shrink-0 transition-transform"
        style={{ transform: open ? "rotate(90deg)" : "rotate(0deg)" }}
      >
        <path d="M2 1L6 4L2 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {open ? "Hide" : "Show"} {label}
    </button>
  );
}
