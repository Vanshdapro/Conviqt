"use client";

import { useState } from "react";
import type { CouncilResult, AgentOutput, Verdict, MetricSignal } from "@/lib/agents/types";

// ── Color helpers ─────────────────────────────────────────────────────────

function verdictColors(v: Verdict) {
  if (v === "BUY")
    return {
      text: "var(--bull)",
      bg: "rgba(16, 185, 129, 0.07)",
      border: "rgba(16, 185, 129, 0.22)",
      dot: "var(--bull)",
      label: "BUY",
    };
  if (v === "SELL")
    return {
      text: "var(--bear)",
      bg: "rgba(244, 63, 94, 0.07)",
      border: "rgba(244, 63, 94, 0.22)",
      dot: "var(--bear)",
      label: "SELL",
    };
  return {
    text: "var(--hold)",
    bg: "rgba(245, 158, 11, 0.07)",
    border: "rgba(245, 158, 11, 0.22)",
    dot: "var(--hold)",
    label: "HOLD",
  };
}

function signalStyle(s: MetricSignal) {
  if (s === "bullish")
    return { dot: "var(--bull)", text: "var(--bull)" };
  if (s === "bearish")
    return { dot: "var(--bear)", text: "var(--bear)" };
  return { dot: "var(--dim)", text: "var(--dim)" };
}

// ── Agent row ─────────────────────────────────────────────────────────────

function AgentRow({ a }: { a: AgentOutput }) {
  const color =
    a.confidence === 0
      ? "var(--dim)"
      : a.verdict === "BUY"
      ? "var(--bull)"
      : a.verdict === "SELL"
      ? "var(--bear)"
      : "var(--hold)";

  return (
    <div className="py-3 border-b border-rule last:border-b-0">
      <div className="flex items-center justify-between gap-4 mb-1.5">
        <div className="flex items-center gap-3">
          <span
            className="mono text-[11px] font-medium uppercase tracking-[0.14em]"
            style={{ color }}
          >
            {a.confidence === 0 ? "—" : a.verdict}
          </span>
          <span className="text-[13px] text-foreground/80 font-medium">
            {a.agent}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-16 h-[2px] bg-rule overflow-hidden">
            <div
              className="h-full"
              style={{
                width: `${(a.confidence / 10) * 100}%`,
                background: color,
              }}
            />
          </div>
          <span className="mono text-[10px] text-dim w-8 text-right">
            {a.confidence}/10
          </span>
        </div>
      </div>
      <p className="serif text-[13px] text-foreground/65 leading-[1.68]">
        {a.reasoning}
      </p>
      {a.flags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {a.flags.map((f) => (
            <span
              key={f}
              className="mono text-[10px] text-dim border border-rule rounded px-1.5 py-0.5"
            >
              {f}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main report ───────────────────────────────────────────────────────────

export default function CouncilReport({
  result,
  costUSD,
}: {
  result: CouncilResult;
  costUSD?: number;
}) {
  const [showBreakdown, setShowBreakdown] = useState(false);
  const { ticker, factSheet, agents, judge, warnings, runId } = result;
  const vc = verdictColors(judge.verdict);

  const citedSourceIds = new Set(judge.sourceIndexes);
  const citedSources = factSheet.sources
    .map((s, i) => ({ s, i }))
    .filter(({ i }) => citedSourceIds.has(i));

  const convictionPct = `${(judge.conviction / 10) * 100}%`;
  const disagreementPct = `${(judge.disagreement / 10) * 100}%`;

  return (
    <article
      className="border border-rule overflow-hidden"
      style={{ background: "var(--surface)" }}
    >
      {/* ── Header ──────────────────────────────────────────────────── */}
      <header
        className="border-b border-rule px-5 py-5"
        style={{
          background: "var(--surface-2)",
          borderLeft: `4px solid ${vc.dot}`,
        }}
      >
        <div className="flex items-start justify-between gap-4">
          {/* Ticker + company — left */}
          <div className="min-w-0">
            <div className="caps text-[9px] text-dim mb-2">Council verdict</div>
            <div className="flex items-baseline gap-2.5 flex-wrap">
              <span className="display text-[36px] text-foreground leading-none tracking-tight">
                {ticker}
              </span>
              <span className="serif text-[14px] text-muted font-normal">
                {factSheet.companyName}
              </span>
            </div>
            <div className="mono text-[10px] text-dim mt-1">{factSheet.sector}</div>
          </div>

          {/* Verdict + bars — right */}
          <div className="flex-shrink-0 text-right">
            <div
              className="mono text-[22px] font-bold tracking-[0.08em]"
              style={{ color: vc.text }}
            >
              {vc.label}
            </div>
            {/* conviction bar */}
            <div className="flex items-center gap-2 justify-end mt-2">
              <div className="w-24 h-[3px] bg-rule overflow-hidden">
                <div
                  className="h-full bar-animate"
                  style={{
                    width: convictionPct,
                    background: vc.dot,
                    ["--bar-width" as string]: convictionPct,
                  }}
                />
              </div>
              <span className="mono text-[10px] text-muted">
                conviction {judge.conviction}/10
              </span>
            </div>
            {/* disagreement bar — only if > 0 */}
            {judge.disagreement > 0 && (
              <div className="flex items-center gap-2 justify-end mt-1.5">
                <div className="w-24 h-[3px] bg-rule overflow-hidden">
                  <div
                    className="h-full bar-animate bg-dim"
                    style={{
                      width: disagreementPct,
                      ["--bar-width" as string]: disagreementPct,
                    }}
                  />
                </div>
                <span className="mono text-[10px] text-dim">
                  disagree {judge.disagreement}/10
                </span>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ── Investment case ─────────────────────────────────────────── */}
      <section className="px-5 py-5 border-b border-rule">
        <div className="caps text-[9px] text-accent mb-3">Investment case</div>
        <p className="serif text-[15px] text-foreground/90 leading-[1.72]">
          {judge.investmentCase}
        </p>
      </section>

      {/* ── Key metrics ─────────────────────────────────────────────── */}
      {judge.keyMetrics && judge.keyMetrics.length > 0 && (
        <section className="px-5 py-5 border-b border-rule">
          <div className="caps text-[9px] text-accent mb-3">Key metrics</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {judge.keyMetrics.map((m, idx) => {
              const sig = signalStyle(m.signal);
              return (
                <div
                  key={idx}
                  className="border border-rule px-3 py-2.5"
                  style={{ background: "var(--surface-2)" }}
                >
                  {/* NO rounded class */}
                  <div className="caps text-[9px] text-dim mb-1.5 leading-tight">
                    {m.label}
                  </div>
                  <div className="mono text-[15px] font-medium text-foreground mb-1.5">
                    {m.value}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span
                      className="h-1.5 w-1.5 rounded-full flex-shrink-0"
                      style={{ background: sig.dot }}
                    />
                    <span className="mono text-[9px]" style={{ color: sig.text }}>
                      {m.signal}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Bull / Bear cases ────────────────────────────────────────── */}
      <section className="border-b border-rule">
        <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-rule">
          {/* Bear — left accent */}
          <div
            className="px-5 py-5"
            style={{
              background: "var(--surface-2)",
              borderLeft: "3px solid var(--bear)",
            }}
          >
            <div className="caps text-[9px] mb-3" style={{ color: "var(--bear)" }}>
              Bear case
            </div>
            <p className="serif text-[14px] text-foreground/80 leading-[1.7]">
              {judge.bearCase}
            </p>
          </div>
          {/* Bull — left accent */}
          <div
            className="px-5 py-5"
            style={{
              background: "var(--surface-2)",
              borderLeft: "3px solid var(--bull)",
            }}
          >
            <div className="caps text-[9px] mb-3" style={{ color: "var(--bull)" }}>
              Bull case
            </div>
            <p className="serif text-[14px] text-foreground/80 leading-[1.7]">
              {judge.bullCase}
            </p>
          </div>
        </div>
      </section>

      {/* ── Catalysts ───────────────────────────────────────────────── */}
      {judge.catalysts && judge.catalysts.length > 0 && (
        <section className="px-5 py-5 border-b border-rule">
          <div className="caps text-[9px] text-accent mb-3">Catalysts to watch</div>
          <ol className="space-y-2">
            {judge.catalysts.map((c, i) => (
              <li key={i} className="flex gap-3 leading-[1.65]">
                <span className="mono text-[10px] text-dim flex-shrink-0 mt-[4px] w-4">
                  {i + 1}.
                </span>
                <span className="serif text-[14px] text-foreground/85">{c}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* ── Bottom line ─────────────────────────────────────────────── */}
      {judge.bottomLine && (
        <section
          className="px-5 py-5 border-b border-rule"
          style={{ background: "var(--surface-2)" }}
        >
          <div className="caps text-[9px] text-accent mb-3">Bottom line</div>
          <p className="serif italic text-[19px] text-foreground/95 leading-snug">
            &ldquo;{judge.bottomLine}&rdquo;
          </p>
          {judge.dissents.length > 0 && (
            <p className="mono text-[10px] text-dim mt-2.5">
              Dissenting: {judge.dissents.join(", ")}
            </p>
          )}
        </section>
      )}

      {/* ── Sources ─────────────────────────────────────────────────── */}
      {citedSources.length > 0 && (
        <section className="px-5 py-4 border-b border-rule">
          <div className="caps text-[9px] text-dim mb-3">Sources</div>
          <ol className="space-y-1.5">
            {citedSources.map(({ s, i }) => (
              <li
                key={i}
                id={`${runId}-src-${i}`}
                className="flex gap-2 text-[12px] text-muted leading-relaxed"
              >
                <span className="mono text-dim flex-shrink-0 w-5">{i + 1}.</span>
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-foreground transition-colors underline underline-offset-2 decoration-rule truncate"
                >
                  {s.title}
                </a>
                <span className="text-dim flex-shrink-0">· {s.publisher}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* ── Agent breakdown (collapsible) ───────────────────────────── */}
      <section className="px-5 py-3 border-b border-rule">
        <button
          onClick={() => setShowBreakdown((v) => !v)}
          className="flex items-center gap-2 mono text-[10px] text-dim hover:text-muted transition-colors w-full text-left"
        >
          <svg
            width="8"
            height="8"
            viewBox="0 0 8 8"
            fill="none"
            className="flex-shrink-0 transition-transform"
            style={{ transform: showBreakdown ? "rotate(90deg)" : "rotate(0deg)" }}
          >
            <path
              d="M2 1L6 4L2 7"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          {showBreakdown ? "Hide" : "Show"} agent breakdown · {agents.length} agents
        </button>
        {showBreakdown && (
          <div className="mt-3">
            {agents.map((a) => (
              <AgentRow key={a.agent} a={a} />
            ))}
          </div>
        )}
      </section>

      {/* ── Footer ──────────────────────────────────────────────────── */}
      <footer className="px-5 py-3 flex flex-wrap items-center justify-between gap-3 mono text-[10px] text-dim">
        <div className="flex flex-wrap items-center gap-4">
          <span>asOf {new Date(result.asOf).toLocaleString()}</span>
          {result.cached && (
            <span style={{ color: "var(--hold)" }}>cached</span>
          )}
        </div>
        {warnings.length > 0 && (
          <span style={{ color: "var(--hold)" }}>
            {warnings.length} warning{warnings.length > 1 ? "s" : ""}
          </span>
        )}
      </footer>
    </article>
  );
}
