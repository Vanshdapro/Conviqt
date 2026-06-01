"use client";

import type {
  PortfolioAuditResult,
  RiskAgentOutput,
  Scenario,
  Hedge,
  Severity,
  Source,
} from "@/lib/portfolio/types";

const SURFACE = "#07121f";
const PANEL = "#091624";
const BORDER = "rgba(232,237,248,0.09)";
const RULE = "rgba(232,237,248,0.075)";
const INK = "#e8edf8";
const MUTED = "#8aa0c2";
const FAINT = "#526684";
const ACCENT = "#4f87f7";
const GOOD = "#22c55e";
const WARN = "#f59e0b";
const DANGER = "#f87171";
const MONO = "var(--font-mono), 'JetBrains Mono', monospace";
const SANS = "var(--font-sans), system-ui, sans-serif";
const DISPLAY = "var(--font-display), Georgia, 'Times New Roman', serif";
const SERIF = "var(--font-serif), Georgia, serif";

function severityColor(s: Severity): string {
  switch (s) {
    case "high":
      return DANGER;
    case "elevated":
      return "#fb923c";
    case "moderate":
      return WARN;
    default:
      return GOOD;
  }
}

function healthColor(score: number): string {
  if (score >= 75) return GOOD;
  if (score >= 55) return WARN;
  return DANGER;
}

// Risk heat color: high score = more risk = hotter.
function heatColor(score: number): string {
  if (score >= 70) return DANGER;
  if (score >= 50) return "#fb923c";
  if (score >= 30) return WARN;
  return GOOD;
}

const SECTION_LABEL: React.CSSProperties = {
  color: ACCENT,
  fontFamily: MONO,
  fontSize: 10,
  letterSpacing: "0.22em",
  textTransform: "uppercase",
  marginBottom: 14,
};

// Render a finding string with [#N] markers into superscript-style chips.
function CitedText({ text }: { text: string }) {
  const parts = text.split(/(\[#\d+\])/g);
  return (
    <>
      {parts.map((p, i) => {
        const m = p.match(/^\[#(\d+)\]$/);
        if (m) {
          return (
            <sup
              key={i}
              style={{ color: ACCENT, fontFamily: MONO, fontSize: 9, fontWeight: 700, padding: "0 1px" }}
            >
              {m[1]}
            </sup>
          );
        }
        return <span key={i}>{p}</span>;
      })}
    </>
  );
}

function HealthGauge({ score, grade }: { score: number; grade: string }) {
  const color = healthColor(score);
  const r = 54;
  const circ = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score)) / 100;
  const dash = circ * pct;
  return (
    <div style={{ position: "relative", width: 140, height: 140, flexShrink: 0 }}>
      <svg width="140" height="140" viewBox="0 0 140 140" style={{ transform: "rotate(-90deg)" }}>
        <circle cx="70" cy="70" r={r} fill="none" stroke="rgba(232,237,248,0.08)" strokeWidth="9" />
        <circle
          cx="70"
          cy="70"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`}
          style={{ transition: "stroke-dasharray .9s cubic-bezier(.4,0,.2,1)" }}
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
        <div style={{ color, fontFamily: DISPLAY, fontSize: 40, fontWeight: 600, lineHeight: 1 }}>{score}</div>
        <div style={{ color: FAINT, fontFamily: MONO, fontSize: 10, letterSpacing: "0.16em", marginTop: 3 }}>
          / 100
        </div>
      </div>
    </div>
  );
}

function MetricChip({ label, value, hot }: { label: string; value: string; hot?: boolean }) {
  return (
    <div style={{ background: "rgba(232,237,248,0.03)", border: `1px solid ${BORDER}`, borderRadius: 9, padding: "11px 14px" }}>
      <div style={{ color: FAINT, fontFamily: MONO, fontSize: 9.5, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 5 }}>
        {label}
      </div>
      <div style={{ color: hot ? WARN : INK, fontFamily: MONO, fontSize: 17, fontWeight: 600 }}>{value}</div>
    </div>
  );
}

function RiskHeatCard({ agent, disagreement }: { agent: RiskAgentOutput; disagreement: number }) {
  const color = heatColor(agent.score);
  return (
    <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 18, display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
        <div>
          <div style={{ color: INK, fontFamily: SANS, fontSize: 14, fontWeight: 650 }}>{agent.dimension}</div>
          <div style={{ color: severityColor(agent.severity), fontFamily: MONO, fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", marginTop: 3 }}>
            {agent.severity}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ color, fontFamily: DISPLAY, fontSize: 30, fontWeight: 600, lineHeight: 1 }}>{agent.score}</div>
        </div>
      </div>
      {/* heat bar */}
      <div style={{ height: 5, borderRadius: 3, background: "rgba(232,237,248,0.07)", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${Math.max(2, Math.min(100, agent.score))}%`, background: color, borderRadius: 3 }} />
      </div>
      <p style={{ color: MUTED, fontFamily: SERIF, fontSize: 13.5, lineHeight: 1.55, margin: 0 }}>
        <CitedText text={agent.finding} />
      </p>
      {agent.flaggedTickers.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 2 }}>
          {agent.flaggedTickers.map((t) => (
            <span key={t} style={{ color: color, fontFamily: MONO, fontSize: 11, fontWeight: 600, background: "rgba(232,237,248,0.04)", border: `1px solid ${BORDER}`, borderRadius: 5, padding: "2px 7px" }}>
              {t}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function ScenarioCard({ s }: { s: Scenario }) {
  const color = severityColor(s.severity);
  return (
    <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 18, display: "flex", flexDirection: "column", gap: 9 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
        <div style={{ color: INK, fontFamily: DISPLAY, fontSize: 19, fontWeight: 500 }}>{s.name}</div>
        <div style={{ color, fontFamily: MONO, fontSize: 16, fontWeight: 700, whiteSpace: "nowrap" }}>{s.estImpactPct}</div>
      </div>
      <p style={{ color: MUTED, fontFamily: SERIF, fontSize: 13.5, lineHeight: 1.55, margin: 0 }}>
        <CitedText text={s.narrative} />
      </p>
      {s.hardestHit.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
          <span style={{ color: FAINT, fontFamily: MONO, fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase" }}>
            Hardest hit
          </span>
          {s.hardestHit.map((t) => (
            <span key={t} style={{ color: INK, fontFamily: MONO, fontSize: 11, fontWeight: 600, background: "rgba(248,113,113,0.08)", border: `1px solid rgba(248,113,113,0.2)`, borderRadius: 5, padding: "2px 7px" }}>
              {t}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function HedgeRow({ h, rank }: { h: Hedge; rank: number }) {
  return (
    <div style={{ display: "flex", gap: 14, padding: "14px 0", borderBottom: `1px solid ${RULE}`, alignItems: "flex-start" }}>
      <div style={{ flexShrink: 0, width: 26, height: 26, borderRadius: 7, background: "rgba(79,135,247,0.12)", border: `1px solid rgba(79,135,247,0.3)`, color: ACCENT, fontFamily: MONO, fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {rank}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ color: INK, fontFamily: SANS, fontSize: 14.5, fontWeight: 650, marginBottom: 4 }}>{h.action}</div>
        <p style={{ color: MUTED, fontFamily: SERIF, fontSize: 13.5, lineHeight: 1.5, margin: 0 }}>{h.rationale}</p>
        {h.addresses.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 7 }}>
            {h.addresses.map((d) => (
              <span key={d} style={{ color: FAINT, fontFamily: MONO, fontSize: 10, letterSpacing: "0.06em", background: "rgba(232,237,248,0.04)", borderRadius: 4, padding: "2px 6px" }}>
                {d}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SourceList({ sources }: { sources: Source[] }) {
  if (!sources || sources.length === 0) return null;
  return (
    <div style={{ marginTop: 8 }}>
      <div style={SECTION_LABEL}>Sources</div>
      <ol style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 7 }}>
        {sources.map((s, i) => (
          <li key={i} style={{ display: "flex", gap: 9, alignItems: "baseline" }}>
            <span style={{ color: ACCENT, fontFamily: MONO, fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{i + 1}</span>
            <a
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: MUTED, fontFamily: MONO, fontSize: 12, lineHeight: 1.5, textDecoration: "none", wordBreak: "break-word" }}
            >
              {s.title || s.url}
            </a>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function AuditReport({ result }: { result: PortfolioAuditResult }) {
  const { metrics, agents, judge, disagreement, factSheet } = result;
  const fmtPct = (n: number) => `${n.toFixed(1)}%`;
  const fmtUsd = (n: number) =>
    n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${n.toFixed(0)}`;

  return (
    <div style={{ fontFamily: SANS, display: "flex", flexDirection: "column", gap: 40 }}>
      {/* ── Health score + assessment ───────────────────────────────── */}
      <section style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 16, padding: "28px 28px 26px" }}>
        <div style={SECTION_LABEL}>Portfolio health</div>
        <div style={{ display: "flex", gap: 28, alignItems: "center", flexWrap: "wrap" }}>
          <HealthGauge score={judge.healthScore} grade={judge.healthGrade} />
          <div style={{ flex: 1, minWidth: 260 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 10 }}>
              <span style={{ color: healthColor(judge.healthScore), fontFamily: DISPLAY, fontSize: 26, fontWeight: 600 }}>
                Grade {judge.healthGrade}
              </span>
              <span style={{ color: FAINT, fontFamily: MONO, fontSize: 11 }}>
                {result.portfolioName}
              </span>
            </div>
            <p style={{ color: INK, fontFamily: SERIF, fontSize: 16, lineHeight: 1.62, margin: 0 }}>
              {judge.assessment}
            </p>
            <p style={{ color: ACCENT, fontFamily: SERIF, fontSize: 15, lineHeight: 1.55, fontStyle: "italic", margin: "14px 0 0" }}>
              {judge.bottomLine}
            </p>
          </div>
        </div>

        {/* Concentration metric strip */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10, marginTop: 24 }}>
          <MetricChip label="Holdings" value={String(metrics.positionCount)} />
          <MetricChip label="Total value" value={fmtUsd(metrics.totalValue)} />
          <MetricChip label="Top position" value={fmtPct(metrics.topPositionPct)} hot={metrics.topPositionPct >= 25} />
          <MetricChip label="Top 5" value={fmtPct(metrics.top5Pct)} hot={metrics.top5Pct >= 60} />
          <MetricChip label="Top sector" value={fmtPct(metrics.topSectorPct)} hot={metrics.topSectorPct >= 40} />
          <MetricChip label="HHI" value={String(Math.round(metrics.hhi))} hot={metrics.hhi >= 2500} />
        </div>
        {metrics.unpricedCount > 0 && (
          <p style={{ color: FAINT, fontFamily: MONO, fontSize: 11, margin: "12px 0 0" }}>
            {metrics.unpricedCount} holding{metrics.unpricedCount === 1 ? "" : "s"} could not be priced and are excluded from weights.
          </p>
        )}
      </section>

      {/* ── Risk heat map ───────────────────────────────────────────── */}
      <section>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
          <div>
            <div style={SECTION_LABEL}>Risk heat map</div>
            <h2 style={{ color: INK, fontFamily: DISPLAY, fontSize: 26, fontWeight: 500, margin: 0 }}>
              Five agents, five lenses
            </h2>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ color: FAINT, fontFamily: MONO, fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 4 }}>
              Panel disagreement
            </div>
            <div style={{ color: disagreement >= 50 ? WARN : MUTED, fontFamily: DISPLAY, fontSize: 30, fontWeight: 600, lineHeight: 1 }}>
              {disagreement}
              <span style={{ color: FAINT, fontFamily: MONO, fontSize: 13, fontWeight: 400 }}> / 100</span>
            </div>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
          {agents.map((a) => (
            <RiskHeatCard key={a.dimension} agent={a} disagreement={disagreement} />
          ))}
        </div>
        <p style={{ color: FAINT, fontFamily: SERIF, fontSize: 13, lineHeight: 1.5, margin: "14px 0 0" }}>
          Each agent scores overall portfolio danger independently. A high disagreement score means the panel can&rsquo;t agree how risky this book is — often a sign of a non-obvious exposure worth a closer look.
        </p>
      </section>

      {/* ── What-if scenarios ───────────────────────────────────────── */}
      <section>
        <div style={SECTION_LABEL}>What-if scenarios</div>
        <h2 style={{ color: INK, fontFamily: DISPLAY, fontSize: 26, fontWeight: 500, margin: "0 0 16px" }}>
          How it bends under stress
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
          {judge.scenarios.map((s, i) => (
            <ScenarioCard key={i} s={s} />
          ))}
        </div>
      </section>

      {/* ── Ranked hedges ───────────────────────────────────────────── */}
      {judge.hedges.length > 0 && (
        <section style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 16, padding: "26px 28px" }}>
          <div style={SECTION_LABEL}>Ranked rebalancing ideas</div>
          <h2 style={{ color: INK, fontFamily: DISPLAY, fontSize: 26, fontWeight: 500, margin: "0 0 6px" }}>
            What to do about it
          </h2>
          <div>
            {judge.hedges.map((h, i) => (
              <HedgeRow key={i} h={h} rank={i + 1} />
            ))}
          </div>
        </section>
      )}

      {/* ── Sources ─────────────────────────────────────────────────── */}
      <section style={{ paddingTop: 4 }}>
        <SourceList sources={factSheet.sources} />
        <footer style={{ marginTop: 22, paddingTop: 16, borderTop: `1px solid ${RULE}`, color: FAINT, fontSize: 12, lineHeight: 1.6 }}>
          Analysis only, not personalized financial advice. Weights are computed from your own share counts times live sourced prices. As of {new Date(result.asOf).toLocaleString()} · est. cost ${result.estCostUSD.toFixed(3)}{result.cached ? " · cached" : ""}.
        </footer>
      </section>
    </div>
  );
}
