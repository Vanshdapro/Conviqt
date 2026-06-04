"use client";

import { useState } from "react";
import type {
  SectorConstituent,
  SectorRankRow,
  SectorResult,
  Verdict,
} from "@/lib/agents/types";
import { ConvictionRing, VerdictDistribution } from "./viz/CouncilViz";

// ── Color helpers ─────────────────────────────────────────────────────────

function verdictColor(v: Verdict): string {
  if (v === "BUY") return "var(--bull)";
  if (v === "SELL") return "var(--bear)";
  return "var(--hold)";
}

function signalColor(s: "bullish" | "bearish" | "neutral"): string {
  if (s === "bullish") return "var(--bull)";
  if (s === "bearish") return "var(--bear)";
  return "var(--muted)";
}

function pct(value: number): string {
  return `${Math.max(0, Math.min(100, value))}%`;
}

function dispersionLabel(d: number): string {
  if (d >= 60) return "fractured";
  if (d >= 35) return "split";
  if (d >= 15) return "leaning";
  return "aligned";
}

// ── Main report ───────────────────────────────────────────────────────────

export default function SectorReport({
  result,
  costUSD,
  onAnalyze,
}: {
  result: SectorResult;
  costUSD?: number;
  onAnalyze?: (ticker: string) => void;
}) {
  const [showNames, setShowNames] = useState(false);
  const { sectorLabel, blurb, verdict, constituents, dispersion } = result;
  const stanceColor = verdictColor(verdict.stance);

  // Constituents keyed by ticker so ranking rows can pull richer detail.
  const byTicker = new Map(constituents.map((c) => [c.ticker, c]));
  const failed = constituents.filter((c) => c.error);
  const scored = constituents.filter((c) => !c.error);
  const basketCounts: Record<Verdict, number> = { BUY: 0, HOLD: 0, SELL: 0 };
  scored.forEach((c) => {
    basketCounts[c.verdict] += 1;
  });

  return (
    <article className="border border-rule overflow-hidden" style={{ background: "var(--surface)" }}>
      {/* ── Header ──────────────────────────────────────────────────── */}
      <header className="border-b border-rule px-5 py-4" style={{ background: "var(--surface-2)" }}>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-baseline gap-2.5 flex-wrap">
            <span className="caps text-[9px] text-accent">Sector Snapshot</span>
            <span className="display text-[22px] text-foreground leading-none tracking-tight">
              {sectorLabel}
            </span>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <span className="mono text-[15px] font-bold tracking-[0.06em]" style={{ color: stanceColor }}>
              {verdict.stance}
            </span>
            <ConvictionRing
              value={verdict.conviction}
              max={verdict.conviction > 10 ? 100 : 10}
              color={stanceColor}
              label="conviction"
              size={50}
            />
          </div>
        </div>
        {blurb && <p className="serif text-[12px] text-muted mt-1.5 leading-snug">{blurb}</p>}
      </header>

      {/* ── Headline (the shareable line) ───────────────────────────── */}
      {verdict.headline && (
        <section className="px-5 py-5 border-b border-rule">
          <p className="serif italic text-[20px] text-foreground/95 leading-snug">
            &ldquo;{verdict.headline}&rdquo;
          </p>
        </section>
      )}

      {/* ── Basket verdict split + dispersion ───────────────────────── */}
      <section className="px-5 py-4 border-b border-rule space-y-3">
        <VerdictDistribution
          buy={basketCounts.BUY}
          hold={basketCounts.HOLD}
          sell={basketCounts.SELL}
          label="Basket verdicts"
        />
        <div className="flex items-center gap-2">
          <span className="caps text-[8px] text-dim w-24 flex-shrink-0">Dispersion</span>
          <div className="flex-1 h-[3px] bg-rule overflow-hidden">
            <div className="h-full bg-dim" style={{ width: pct(dispersion) }} />
          </div>
          <span className="mono text-[9px] text-dim w-10 text-right">{dispersion}</span>
        </div>
        <p className="mono text-[9px] text-dim">
          The basket is <span style={{ color: "var(--muted)" }}>{dispersionLabel(dispersion)}</span> on direction
          {" "}({scored.length} names scored
          {failed.length > 0 ? `, ${failed.length} skipped` : ""}).
        </p>
      </section>

      {/* ── Summary ─────────────────────────────────────────────────── */}
      {verdict.summary && (
        <section className="px-5 py-5 border-b border-rule">
          <div className="caps text-[9px] text-accent mb-3">The read</div>
          <p className="serif text-[15px] text-foreground/90 leading-[1.72]">{verdict.summary}</p>
        </section>
      )}

      {/* ── Three thematic highlights ───────────────────────────────── */}
      <section className="border-b border-rule grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-rule">
        <HighlightCell
          title="Top subsector"
          value={verdict.topSubSector}
          body={verdict.topSubSectorRationale}
        />
        <HighlightCell
          title="Highest conviction"
          value={verdict.topPick}
          body={verdict.topPickRationale}
          onClick={onAnalyze && verdict.topPick ? () => onAnalyze(verdict.topPick) : undefined}
        />
        <HighlightCell
          title="Most divisive"
          value={verdict.mostDivisive}
          body={verdict.mostDivisiveRationale}
          onClick={onAnalyze && verdict.mostDivisive ? () => onAnalyze(verdict.mostDivisive) : undefined}
        />
      </section>

      {/* ── Macro read ──────────────────────────────────────────────── */}
      {verdict.macroRead && (
        <section className="px-5 py-5 border-b border-rule">
          <div className="caps text-[9px] text-accent mb-2.5">Macro read</div>
          <p className="serif text-[14px] text-foreground/82 leading-[1.7]">{verdict.macroRead}</p>
        </section>
      )}

      {/* ── Bull / bear case ────────────────────────────────────────── */}
      <section className="border-b border-rule grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-rule">
        <CaseCell title="Bull case" body={verdict.bullCase} accent="var(--bull)" />
        <CaseCell title="Bear case" body={verdict.bearCase} accent="var(--bear)" />
      </section>

      {/* ── Ranking table ───────────────────────────────────────────── */}
      {verdict.ranking.length > 0 && (
        <section className="border-b border-rule">
          <div className="px-5 pt-5 pb-3 caps text-[9px] text-accent">Basket ranking</div>
          <div>
            {verdict.ranking.map((row, i) => (
              <RankingRow
                key={row.ticker}
                rank={i + 1}
                row={row}
                constituent={byTicker.get(row.ticker)}
                onAnalyze={onAnalyze}
              />
            ))}
          </div>
        </section>
      )}

      {/* ── Per-name scorecards (collapsible) ───────────────────────── */}
      <section className="px-5 py-3 border-b border-rule">
        <ExpandToggle
          label={`per-name scorecards (${constituents.length})`}
          open={showNames}
          onClick={() => setShowNames((v) => !v)}
        />
      </section>
      {showNames && (
        <div className="divide-y divide-rule">
          {constituents.map((c) => (
            <ConstituentCard key={c.ticker} c={c} onAnalyze={onAnalyze} />
          ))}
        </div>
      )}

      {/* ── Bottom line ─────────────────────────────────────────────── */}
      {verdict.bottomLine && (
        <section className="px-5 py-5 border-b border-rule" style={{ background: "var(--surface-2)" }}>
          <div className="caps text-[9px] text-accent mb-3">The trade</div>
          <p className="serif italic text-[19px] text-foreground/95 leading-snug">
            &ldquo;{verdict.bottomLine}&rdquo;
          </p>
        </section>
      )}

      {/* ── Warnings ────────────────────────────────────────────────── */}
      {result.warnings.length > 0 && (
        <section className="px-5 py-3 border-b border-rule">
          {result.warnings.map((w, i) => (
            <p key={i} className="mono text-[10px] text-dim leading-relaxed">
              {w}
            </p>
          ))}
        </section>
      )}

      {/* ── Footer ──────────────────────────────────────────────────── */}
      <footer className="px-5 py-3 flex flex-wrap items-center gap-4 mono text-[10px] text-dim">
        <span suppressHydrationWarning>asOf {new Date(result.asOf).toLocaleString()}</span>
        <span>run {(result.totalDurationMs / 1000).toFixed(1)}s</span>
        <span>cost ${(costUSD ?? result.estCostUSD).toFixed(4)}</span>
        {result.cached && <span style={{ color: "var(--hold)" }}>cached</span>}
      </footer>
    </article>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function HighlightCell({
  title,
  value,
  body,
  onClick,
}: {
  title: string;
  value: string;
  body: string;
  onClick?: () => void;
}) {
  if (!value) return <div className="px-5 py-5" />;
  return (
    <div className="px-5 py-5">
      <div className="caps text-[9px] text-accent mb-2">{title}</div>
      {onClick ? (
        <button
          onClick={onClick}
          className="display text-[19px] text-foreground leading-none tracking-tight hover:text-accent transition-colors"
          title={`Analyze ${value}`}
        >
          {value}
        </button>
      ) : (
        <span className="display text-[19px] text-foreground leading-none tracking-tight">{value}</span>
      )}
      {body && <p className="serif text-[13px] text-foreground/78 leading-[1.6] mt-2">{body}</p>}
    </div>
  );
}

function CaseCell({ title, body, accent }: { title: string; body: string; accent: string }) {
  if (!body) return null;
  return (
    <div className="px-5 py-5">
      <div className="caps text-[9px] mb-2.5" style={{ color: accent }}>
        {title}
      </div>
      <p className="serif text-[14px] text-foreground/82 leading-[1.7]">{body}</p>
    </div>
  );
}

function RankingRow({
  rank,
  row,
  constituent,
  onAnalyze,
}: {
  rank: number;
  row: SectorRankRow;
  constituent?: SectorConstituent;
  onAnalyze?: (ticker: string) => void;
}) {
  const vColor = verdictColor(row.verdict);
  return (
    <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3 px-5 py-2.5 border-t border-rule">
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="mono text-[10px] text-dim w-4 text-right flex-shrink-0">{rank}</span>
        {onAnalyze ? (
          <button
            onClick={() => onAnalyze(row.ticker)}
            className="mono text-[13px] font-semibold text-foreground hover:text-accent transition-colors flex-shrink-0"
            title={`Analyze ${row.ticker}`}
          >
            {row.ticker}
          </button>
        ) : (
          <span className="mono text-[13px] font-semibold text-foreground flex-shrink-0">{row.ticker}</span>
        )}
        {constituent?.subSector && (
          <span className="caps text-[8px] text-dim truncate hidden sm:inline">{constituent.subSector}</span>
        )}
      </div>
      <p className="serif text-[12px] text-foreground/72 leading-snug truncate">{row.note}</p>
      <div className="flex items-center gap-2 flex-shrink-0">
        <div className="w-14 h-[3px] bg-rule overflow-hidden hidden sm:block">
          <div className="h-full" style={{ width: pct(row.conviction), background: vColor }} />
        </div>
        <span className="mono text-[11px] font-bold w-9 text-right" style={{ color: vColor }}>
          {row.verdict}
        </span>
      </div>
    </div>
  );
}

function ConstituentCard({
  c,
  onAnalyze,
}: {
  c: SectorConstituent;
  onAnalyze?: (ticker: string) => void;
}) {
  const vColor = verdictColor(c.verdict);
  const citedSources = c.sources
    .map((s, i) => ({ s, i }))
    .filter(({ i }) => c.sourceIndexes.includes(i));

  if (c.error) {
    return (
      <div className="px-5 py-3.5 opacity-60">
        <div className="flex items-center gap-2.5">
          <span className="mono text-[13px] font-semibold text-foreground">{c.ticker}</span>
          <span className="mono text-[10px]" style={{ color: "var(--bear)" }}>
            could not score
          </span>
        </div>
        <p className="serif text-[12px] text-dim mt-1 leading-snug">{c.thesis}</p>
      </div>
    );
  }

  return (
    <div className="px-5 py-4">
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="flex items-baseline gap-2.5 min-w-0">
          {onAnalyze ? (
            <button
              onClick={() => onAnalyze(c.ticker)}
              className="mono text-[14px] font-semibold text-foreground hover:text-accent transition-colors flex-shrink-0"
              title={`Analyze ${c.ticker}`}
            >
              {c.ticker}
            </button>
          ) : (
            <span className="mono text-[14px] font-semibold text-foreground flex-shrink-0">{c.ticker}</span>
          )}
          <span className="text-[11px] text-muted truncate">{c.companyName}</span>
          <span className="caps text-[8px] text-dim hidden sm:inline">{c.subSector}</span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="mono text-[12px] font-bold" style={{ color: vColor }}>
            {c.verdict}
          </span>
          <span className="mono text-[9px] text-dim">{c.conviction}/100</span>
          {c.cached && <span className="mono text-[8px]" style={{ color: "var(--hold)" }}>cached</span>}
        </div>
      </div>

      <p className="serif text-[13px] text-foreground/82 leading-[1.65]">{c.thesis}</p>

      {c.signals.length > 0 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
          {c.signals.map((sig, i) => (
            <span key={i} className="mono text-[10px] text-dim">
              {sig.label}{" "}
              <span style={{ color: signalColor(sig.signal) }}>{sig.value}</span>
            </span>
          ))}
        </div>
      )}

      {c.flags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {c.flags.map((f, i) => (
            <span
              key={i}
              className="mono text-[8px] tracking-[0.08em] uppercase px-1.5 py-px rounded text-dim"
              style={{ border: "1px solid var(--rule)" }}
            >
              {f}
            </span>
          ))}
        </div>
      )}

      {citedSources.length > 0 && (
        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2.5">
          {citedSources.map(({ s, i }) => (
            <a
              key={i}
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mono text-[9px] text-dim hover:text-muted border border-rule rounded px-1 py-px transition-colors"
              style={{ background: "var(--surface-2)", textDecoration: "none" }}
              title={s.title}
            >
              {s.publisher}
            </a>
          ))}
        </div>
      )}
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
