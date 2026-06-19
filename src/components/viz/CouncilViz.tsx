"use client";

// Council data-visualisation primitives.
//
// Hand-built SVG/CSS only — no charting dependency (see CLAUDE.md: no new deps,
// match existing components/ patterns). Everything here renders data that the
// Council already produced with cited sources; nothing is synthesised. These
// turn the verdict from a wall of prose into a glanceable, interactive read.
//
// Used by CouncilReport (chat) and PublicStockReport (public /stock pages).

import { useEffect, useState } from "react";
import type { AgentOutput, Verdict } from "@/lib/agents/types";
import { howSure, dispersionWord } from "@/lib/sureness";

// ── Shared verdict palette (mirrors CouncilReport.verdictColors) ────────────

interface Hue {
  color: string;
  glow: string;
}

function verdictHue(v: Verdict): Hue {
  if (v === "BUY") return { color: "var(--bull)", glow: "color-mix(in srgb, var(--bull) 16%, transparent)" };
  if (v === "SELL") return { color: "var(--bear)", glow: "color-mix(in srgb, var(--bear) 16%, transparent)" };
  return { color: "var(--hold)", glow: "color-mix(in srgb, var(--hold) 16%, transparent)" };
}

const NEUTRAL: Hue = { color: "var(--dim)", glow: "transparent" };

// Confidence / conviction / disagreement are all 0-100 internally — the
// specialists clamp to 100 (lib/agents/_runner.ts) and the judge clamps to 100
// (lib/agents/judge.ts); types.ts annotates every field `// 0-100`. The old
// `conf > 10 ? /100 : /10` auto-detect was a bug: a genuine low score (a weak
// 1-10 call on the 0-100 scale) got divided by 10 and rendered near-full.
// Normalize against 100, and never show the raw number (CLAUDE.md / judge
// prompt: conviction is internal, shown only as a High/Medium/Low band).
function confFraction(conf: number): number {
  return Math.max(0, Math.min(1, conf / 100));
}

// ── Conviction ring ─────────────────────────────────────────────────────────
//
// Circular progress ring showing the "How sure" band. Sweeps on mount. `value`
// is the internal 0-100 conviction; the arc fills value/100 and the centre
// shows the plain band word (High/Medium/Low) — never the raw score
// (CLAUDE.md: "Conviction is shown as 'How sure: High/Medium/Low'").

export function ConvictionRing({
  value,
  color,
  label,
  size = 64,
  stroke = 5,
}: {
  value: number;
  color: string;
  label: string;
  size?: number;
  stroke?: number;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const band = howSure(value);
  const frac = Math.max(0, Math.min(1, value / 100));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - (mounted ? frac : 0));

  return (
    <div className="flex flex-col items-center gap-1">
      <div style={{ position: "relative", width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="var(--rule)"
            strokeWidth={stroke}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 0.9s cubic-bezier(0.16,1,0.3,1)" }}
          />
        </svg>
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span className="display font-bold leading-none text-center" style={{ color, fontSize: size * 0.2 }}>
            {band}
          </span>
        </div>
      </div>
      <span className="caps text-[8px] text-dim tracking-[0.14em]">{label}</span>
    </div>
  );
}

// ── Verdict distribution bar ───────────────────────────────────────────────
//
// A horizontal stacked bar showing how a set of calls splits across
// BUY / HOLD / SELL, with counts. Used for a sector basket (and reusable for
// the public Disagreement Board). Every count comes from real scored names.

export function VerdictDistribution({
  buy,
  hold,
  sell,
  label = "Basket split",
}: {
  buy: number;
  hold: number;
  sell: number;
  label?: string;
}) {
  const total = buy + hold + sell;
  if (total === 0) return null;
  const seg = (n: number) => `${(n / total) * 100}%`;

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
        <span className="caps text-[8px] text-dim tracking-[0.14em]">{label}</span>
        <div className="flex items-center gap-3 mono text-[9px]">
          {buy > 0 && (
            <span className="flex items-center gap-1" style={{ color: "var(--bull)" }}>
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--bull)" }} />
              {buy} buy
            </span>
          )}
          {hold > 0 && (
            <span className="flex items-center gap-1" style={{ color: "var(--hold)" }}>
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--hold)" }} />
              {hold} hold
            </span>
          )}
          {sell > 0 && (
            <span className="flex items-center gap-1" style={{ color: "var(--bear)" }}>
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--bear)" }} />
              {sell} sell
            </span>
          )}
        </div>
      </div>
      <div
        className="flex h-2 w-full overflow-hidden rounded-full"
        style={{ background: "var(--rule)" }}
        role="img"
        aria-label={`${buy} buy, ${hold} hold, ${sell} sell`}
      >
        {buy > 0 && <div style={{ width: seg(buy), background: "var(--bull)" }} />}
        {hold > 0 && <div style={{ width: seg(hold), background: "var(--hold)" }} />}
        {sell > 0 && <div style={{ width: seg(sell), background: "var(--bear)" }} />}
      </div>
    </div>
  );
}

// ── Agent consensus strip ─────────────────────────────────────────────────
//
// The brand promise made visible: all specialist votes shown at once, colour-
// coded by verdict, with confidence as an inner bar. Mixed colours = the
// Council fractured. Hover/tap a cell to read that agent's reasoning in the
// shared panel below (a single panel avoids tooltip clipping inside the
// overflow-hidden report card).

export function AgentConsensus({
  agents,
  judgeVerdict,
  disagreement,
  standalone = false,
}: {
  agents: AgentOutput[];
  judgeVerdict?: Verdict;
  disagreement?: number; // internal 0-100; shown only as a plain word
  // false: internal divider (border-b) for stacked report cards (chat).
  // true: a fully-bordered block for the public /stock page's space-y-px layout.
  standalone?: boolean;
}) {
  const [active, setActive] = useState<number | null>(null);

  if (!agents || agents.length === 0) return null;

  // confidence 0 == the agent abstained (no data in its lane).
  const voted = agents.filter((a) => a.confidence > 0);
  const tally: Record<Verdict, number> = { BUY: 0, HOLD: 0, SELL: 0 };
  voted.forEach((a) => {
    tally[a.verdict] += 1;
  });
  const abstained = agents.length - voted.length;
  const activeAgent = active !== null ? agents[active] : null;
  const dissenters = judgeVerdict
    ? voted.filter((a) => a.verdict !== judgeVerdict).map((a) => a.agent)
    : [];

  return (
    <section
      className={`px-5 py-4 ${standalone ? "border border-rule" : "border-b border-rule"}`}
      style={{ background: "var(--surface)" }}
    >
      {/* Header: label + live tally + disagreement read */}
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <span className="caps text-[9px] text-accent">Analyst consensus</span>
        <div className="flex items-center gap-3 mono text-[10px]">
          {(["BUY", "HOLD", "SELL"] as Verdict[]).map((v) =>
            tally[v] > 0 ? (
              <span key={v} className="flex items-center gap-1.5" style={{ color: verdictHue(v).color }}>
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: verdictHue(v).color }} />
                {tally[v]} {v}
              </span>
            ) : null
          )}
          {abstained > 0 && <span className="text-dim">{abstained} abstain</span>}
          {typeof disagreement === "number" && (
            <span className="text-dim border-l border-rule pl-3">
              {dispersionWord(disagreement)}
            </span>
          )}
        </div>
      </div>

      {/* Segmented vote bar — one cell per specialist */}
      <div
        className="grid gap-1.5"
        style={{ gridTemplateColumns: `repeat(${agents.length}, minmax(0,1fr))` }}
        onMouseLeave={() => setActive(null)}
      >
        {agents.map((a, i) => {
          const voteless = a.confidence === 0;
          const hue = voteless ? NEUTRAL : verdictHue(a.verdict);
          const frac = confFraction(a.confidence);
          const isDissent = !voteless && judgeVerdict && a.verdict !== judgeVerdict;
          const isActive = active === i;
          return (
            <button
              key={a.agent}
              type="button"
              onMouseEnter={() => setActive(i)}
              onClick={() => setActive((cur) => (cur === i ? null : i))}
              className="text-left focus:outline-none transition-transform duration-150"
              style={{ transform: isActive ? "translateY(-2px)" : "none" }}
              aria-label={`${a.agent}: ${voteless ? "no data" : `${a.verdict}, ${howSure(a.confidence).toLowerCase()} confidence`}`}
            >
              <div
                className="px-2 py-2 transition-all duration-200"
                style={{
                  borderTop: `2px solid ${hue.color}`,
                  borderLeft: `1px solid ${isActive ? hue.color : "var(--rule)"}`,
                  borderRight: `1px solid ${isActive ? hue.color : "var(--rule)"}`,
                  borderBottom: `1px solid ${isActive ? hue.color : "var(--rule)"}`,
                  background: isActive
                    ? `linear-gradient(180deg, ${hue.glow}, transparent)`
                    : "var(--surface-2)",
                }}
              >
                <div className="flex items-center justify-between gap-1 mb-1.5">
                  <span className="mono text-[8px] tracking-[0.1em] uppercase text-dim truncate">
                    {a.agent}
                  </span>
                  {isDissent && (
                    <span
                      title="Dissents from the final verdict"
                      className="mono text-[7px] leading-none px-1 py-px rounded-sm flex-shrink-0"
                      style={{ color: hue.color, border: `1px solid ${hue.color}`, opacity: 0.85 }}
                    >
                      ✕
                    </span>
                  )}
                </div>
                <div
                  className="mono text-[13px] font-bold leading-none mb-2"
                  style={{ color: hue.color }}
                >
                  {voteless ? "—" : a.verdict}
                </div>
                <div className="h-[3px] w-full overflow-hidden" style={{ background: "var(--rule)" }}>
                  <div
                    className="h-full bar-animate"
                    style={{
                      width: `${frac * 100}%`,
                      background: hue.color,
                      ["--bar-width" as string]: `${frac * 100}%`,
                    }}
                  />
                </div>
                <div className="mono text-[8px] text-dim mt-1">
                  {voteless ? "no data" : howSure(a.confidence).toLowerCase()}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Shared detail panel — reasoning for the focused agent, else the dissent read */}
      <div
        className="mt-2.5 px-3 py-2.5 border border-rule slide-up"
        style={{ background: "var(--surface-2)" }}
        key={active ?? "idle"}
      >
        {activeAgent ? (
          <>
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <span
                className="mono text-[9px] uppercase tracking-[0.12em]"
                style={{ color: activeAgent.confidence === 0 ? "var(--dim)" : verdictHue(activeAgent.verdict).color }}
              >
                {activeAgent.agent}
                {activeAgent.confidence > 0 ? ` · ${activeAgent.verdict}` : " · no data"}
              </span>
              {activeAgent.confidence > 0 && (
                <span className="mono text-[8px] text-dim">
                  how sure: {howSure(activeAgent.confidence).toLowerCase()}
                </span>
              )}
            </div>
            <p className="serif text-[12px] text-foreground/80 leading-[1.6]">{activeAgent.reasoning}</p>
            {activeAgent.flags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {activeAgent.flags.map((f) => (
                  <span
                    key={f}
                    className="mono text-[8px] text-dim border border-rule rounded px-1.5 py-px"
                  >
                    {f}
                  </span>
                ))}
              </div>
            )}
          </>
        ) : (
          <p className="mono text-[10px] text-dim leading-relaxed">
            {dissenters.length > 0 ? (
              <>
                <span style={{ color: "var(--hold)" }}>{dissenters.join(", ")}</span>
                {dissenters.length === 1 ? " dissents" : " dissent"} from the {judgeVerdict} call —
                hover any analyst to read their reasoning.
              </>
            ) : (
              <>Unanimous {judgeVerdict ? `${judgeVerdict} ` : ""}read — hover any analyst to see why.</>
            )}
          </p>
        )}
      </div>
    </section>
  );
}
