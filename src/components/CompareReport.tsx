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
import { dispersionWord } from "@/lib/sureness";
import CompareMarketStrip from "./stock/CompareMarketStrip";

// ── Color helpers ─────────────────────────────────────────────────────────

function verdictColor(v: Verdict): string {
  if (v === "BUY") return "var(--up-ink)";
  if (v === "SELL") return "var(--down-ink)";
  return "var(--text-2)";
}

function VerdictPill({ v }: { v: Verdict }) {
  return (
    <span
      className="mono text-[11px] font-bold tracking-[0.07em] px-2 py-0.5 rounded"
      style={{
        background:
          v === "BUY"
            ? "var(--up-weak)"
            : v === "SELL"
            ? "var(--down-weak)"
            : "color-mix(in srgb, var(--text-2) 12%, transparent)",
        color: verdictColor(v),
      }}
    >
      {v}
    </span>
  );
}

// ── Side card ─────────────────────────────────────────────────────────────

function SideCard({
  result,
  isWinner,
  isTie,
}: {
  result: CouncilResult;
  isWinner: boolean;
  isTie: boolean;
}) {
  const { judge, ticker, factSheet } = result;
  const vColor = verdictColor(judge.verdict);

  return (
    <div
      className="px-5 py-5 flex flex-col gap-3"
      style={{
        background: isWinner
          ? "color-mix(in srgb, var(--accent) 5%, var(--bg-surface))"
          : "var(--bg-surface)",
        borderTop: `3px solid ${isWinner ? "var(--accent)" : "var(--border)"}`,
        opacity: !isWinner && !isTie ? 0.82 : 1,
      }}
    >
      {/* Winner / tie badge */}
      <div style={{ minHeight: 20 }}>
        {isWinner ? (
          <span
            className="mono text-[9px] tracking-[0.14em] uppercase px-2 py-px rounded-sm font-semibold"
            style={{ background: "var(--accent)", color: "var(--on-accent)" }}
          >
            ★ Winner
          </span>
        ) : isTie ? (
          <span
            className="mono text-[9px] tracking-[0.12em] uppercase"
            style={{ color: "var(--text-muted)" }}
          >
            Tie
          </span>
        ) : null}
      </div>

      {/* Ticker + conviction ring */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-baseline gap-2.5 flex-wrap">
            <span
              className="display leading-none tracking-tight"
              style={{
                fontSize: isWinner ? 34 : 26,
                color: "var(--text)",
              }}
            >
              {ticker}
            </span>
            <VerdictPill v={judge.verdict} />
          </div>
          <div
            className="mono text-[10px] mt-1.5 truncate"
            style={{ color: "var(--text-muted)" }}
          >
            {factSheet?.companyName ?? ""}
          </div>
          <div className="mono text-[9px] mt-2" style={{ color: "var(--text-muted)" }}>
            {dispersionWord(judge.disagreement)}
          </div>
        </div>
        <div className="flex-shrink-0">
          <ConvictionRing
            value={judge.conviction}
            color={vColor}
            label="how sure"
            size={isWinner ? 68 : 54}
          />
        </div>
      </div>
    </div>
  );
}

// ── Edge meter ────────────────────────────────────────────────────────────
// Horizontal bar that leans toward whichever side wins this dimension.

function EdgeMeter({ edge }: { edge: CompareEdge }) {
  const isTie = edge === "tie";
  const aWins = edge === "a";
  return (
    <div className="relative w-full" style={{ height: 6 }}>
      <div
        className="absolute inset-0 rounded-full"
        style={{ background: "var(--border)" }}
      />
      {/* Centre tick */}
      <div
        className="absolute"
        style={{
          left: "50%",
          top: -3,
          width: 1.5,
          height: 12,
          background: "var(--text-muted)",
          transform: "translateX(-0.75px)",
          opacity: 0.35,
        }}
      />
      {!isTie && (
        <div
          className="absolute top-0 bottom-0 rounded-full"
          style={{
            background: "var(--accent)",
            left: aWins ? "10%" : "50%",
            right: aWins ? "50%" : "10%",
          }}
        />
      )}
    </div>
  );
}

// ── Edge cell ─────────────────────────────────────────────────────────────

function EdgeCell({ title, body }: { title: string; body: string }) {
  if (!body) return null;
  return (
    <div className="px-5 py-5">
      <div
        className="caps text-[9px] mb-2.5"
        style={{ color: "var(--accent)" }}
      >
        {title}
      </div>
      <p
        className="serif text-[14px] leading-[1.7]"
        style={{ color: "var(--text)", opacity: 0.82 }}
      >
        {body}
      </p>
    </div>
  );
}

// ── Expand toggle ─────────────────────────────────────────────────────────

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
      className="flex items-center gap-2 mono text-[10px] transition-colors text-left"
      style={{ color: open ? "var(--text-2)" : "var(--text-muted)" }}
    >
      <svg
        width="8"
        height="8"
        viewBox="0 0 8 8"
        fill="none"
        className="flex-shrink-0 transition-transform"
        style={{ transform: open ? "rotate(90deg)" : "rotate(0deg)" }}
      >
        <path
          d="M2 1L6 4L2 7"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {open ? "Hide" : "Show"} {label}
    </button>
  );
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

  const isTie = verdict.winner === "TIE";
  const winnerTicker =
    verdict.winner === "A"
      ? tickerA
      : verdict.winner === "B"
      ? tickerB
      : null;

  return (
    <article
      className="border border-rule overflow-hidden"
      style={{ background: "var(--bg-surface)" }}
    >
      {/* ── Header ──────────────────────────────────────────────────── */}
      <header
        className="px-5 py-3 border-b border-rule flex items-center justify-between gap-4 flex-wrap"
        style={{ background: "var(--bg-sunken)" }}
      >
        <span className="caps text-[9px]" style={{ color: "var(--accent)" }}>
          Face-off
        </span>
        <div className="flex items-center gap-2">
          <span
            className="display text-[17px] leading-none tracking-tight"
            style={{ color: "var(--text)" }}
          >
            {tickerA}
          </span>
          <span className="mono text-[12px]" style={{ color: "var(--text-muted)" }}>
            vs
          </span>
          <span
            className="display text-[17px] leading-none tracking-tight"
            style={{ color: "var(--text)" }}
          >
            {tickerB}
          </span>
        </div>
        <div className="mono text-[10px]" style={{ color: "var(--text-muted)" }}>
          {winnerTicker ? (
            <>
              Edge:{" "}
              <span style={{ color: "var(--accent)", fontWeight: 600 }}>
                {winnerTicker}
              </span>
            </>
          ) : (
            <span style={{ color: "var(--text-2)" }}>Too close to call</span>
          )}
        </div>
      </header>

      {/* ── Two-column verdict cards ────────────────────────────────── */}
      <section className="grid grid-cols-2 divide-x divide-rule border-b border-rule">
        <SideCard result={a} isWinner={verdict.winner === "A"} isTie={isTie} />
        <SideCard result={b} isWinner={verdict.winner === "B"} isTie={isTie} />
      </section>

      {/* ── Live prices (client island) ─────────────────────────────── */}
      <CompareMarketStrip tickerA={tickerA} tickerB={tickerB} />

      {/* ── Headline ────────────────────────────────────────────────── */}
      {verdict.headline && (
        <section className="px-5 py-5 border-b border-rule">
          <p
            className="serif italic text-[19px] leading-snug"
            style={{ color: "var(--text)", opacity: 0.92 }}
          >
            &ldquo;{verdict.headline}&rdquo;
          </p>
        </section>
      )}

      {/* ── Scorecard ───────────────────────────────────────────────── */}
      {verdict.dimensions.length > 0 && (
        <section className="border-b border-rule">
          <div
            className="px-5 pt-5 pb-3 caps text-[9px]"
            style={{ color: "var(--accent)" }}
          >
            Scorecard
          </div>
          {/* Column headers */}
          <div className="grid grid-cols-[1fr_116px_1fr] items-center px-5 pb-2 gap-3">
            <div
              className="mono text-[10px] text-right truncate"
              style={{ color: "var(--text-muted)" }}
            >
              {tickerA}
            </div>
            <div />
            <div
              className="mono text-[10px] text-left truncate"
              style={{ color: "var(--text-muted)" }}
            >
              {tickerB}
            </div>
          </div>
          {/* Dimension rows */}
          <div>
            {verdict.dimensions.map((d, i) => {
              const aWins = d.edge === "a";
              const bWins = d.edge === "b";
              return (
                <div
                  key={i}
                  className="grid grid-cols-[1fr_116px_1fr] items-center gap-3 px-5 py-2.5 border-t border-rule"
                >
                  <div className="text-right">
                    <span
                      className="mono text-[11px] px-1.5 py-0.5 rounded"
                      style={{
                        color: aWins ? "var(--text)" : "var(--text-muted)",
                        fontWeight: aWins ? 600 : 400,
                        background: aWins ? "var(--bg-sunken)" : "transparent",
                      }}
                    >
                      {d.aValue}
                    </span>
                  </div>
                  <div>
                    <div
                      className="caps text-[8px] text-center mb-1.5"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {d.dimension}
                    </div>
                    <EdgeMeter edge={d.edge} />
                  </div>
                  <div className="text-left">
                    <span
                      className="mono text-[11px] px-1.5 py-0.5 rounded"
                      style={{
                        color: bWins ? "var(--text)" : "var(--text-muted)",
                        fontWeight: bWins ? 600 : 400,
                        background: bWins ? "var(--bg-sunken)" : "transparent",
                      }}
                    >
                      {d.bValue}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Comparative summary ─────────────────────────────────────── */}
      {verdict.summary && (
        <section className="px-5 py-5 border-b border-rule">
          <div
            className="caps text-[9px] mb-3"
            style={{ color: "var(--accent)" }}
          >
            The comparison
          </div>
          <p
            className="serif text-[15px] leading-[1.72]"
            style={{ color: "var(--text)", opacity: 0.88 }}
          >
            {verdict.summary}
          </p>
        </section>
      )}

      {/* ── Edge breakdown (2×2) ────────────────────────────────────── */}
      <section className="border-b border-rule grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-rule">
        <EdgeCell title="Valuation" body={verdict.valuationEdge} />
        <EdgeCell title="Positioning" body={verdict.positioningEdge} />
      </section>
      {(verdict.catalystEdge || verdict.riskRewardEdge) && (
        <section className="border-b border-rule grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-rule">
          <EdgeCell title="Catalysts" body={verdict.catalystEdge} />
          <EdgeCell title="Risk / reward" body={verdict.riskRewardEdge} />
        </section>
      )}

      {/* ── Bottom line ─────────────────────────────────────────────── */}
      {verdict.bottomLine && (
        <section
          className="px-5 py-5 border-b border-rule"
          style={{
            background: "color-mix(in srgb, var(--accent) 5%, var(--bg-surface))",
          }}
        >
          <div
            className="caps text-[9px] mb-3"
            style={{ color: "var(--accent)" }}
          >
            The trade
          </div>
          <p
            className="serif italic text-[19px] leading-snug"
            style={{ color: "var(--text)", opacity: 0.95 }}
          >
            &ldquo;{verdict.bottomLine}&rdquo;
          </p>
        </section>
      )}

      {/* ── Per-side full reports (collapsible) ──────────────────────── */}
      <section className="px-5 py-3 border-b border-rule flex flex-wrap gap-x-6 gap-y-2">
        <ExpandToggle
          label={`${tickerA} full report`}
          open={showA}
          onClick={() => setShowA((v) => !v)}
        />
        <ExpandToggle
          label={`${tickerB} full report`}
          open={showB}
          onClick={() => setShowB((v) => !v)}
        />
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
      <footer
        className="px-5 py-3 flex flex-wrap items-center gap-4 mono text-[10px]"
        style={{ color: "var(--text-muted)" }}
      >
        <span suppressHydrationWarning>
          Updated{" "}
          {new Date(result.asOf).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </span>
        <span>run {(result.totalDurationMs / 1000).toFixed(1)}s</span>
        {result.cached && (
          <span style={{ color: "var(--text-2)" }}>cached</span>
        )}
      </footer>
    </article>
  );
}
