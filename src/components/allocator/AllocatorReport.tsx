"use client";

import type {
  AllocatorResult,
  AllocationLine,
  SpecialistOutput,
  RiskLevel,
  Prerequisite,
  Source,
} from "@/lib/allocator/types";

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

// Color for each asset class slice of the allocation ring.
const CLASS_COLORS: Record<string, string> = {
  "Core US Equity": "#4f87f7",
  "International Equity": "#38bdf8",
  Bonds: "#a78bfa",
  "Dividend / Income": "#22c55e",
  "Satellite / Single Stocks": "#fb923c",
  "Inflation Hedge": "#eab308",
  "Cash Buffer": "#64748b",
};

function riskColor(r: RiskLevel): string {
  switch (r) {
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

const SECTION_LABEL: React.CSSProperties = {
  color: ACCENT,
  fontFamily: MONO,
  fontSize: 10,
  letterSpacing: "0.22em",
  textTransform: "uppercase",
  marginBottom: 14,
};

// The judge cites with (#N). Render those markers as superscript chips.
function CitedText({ text }: { text: string }) {
  const parts = text.split(/(\(#\d+\))/g);
  return (
    <>
      {parts.map((p, i) => {
        const m = p.match(/^\(#(\d+)\)$/);
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

const fmtUsd = (n: number) => {
  if (n <= 0) return "—";
  if (n >= 1000) return `$${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return `$${n.toFixed(0)}`;
};

// A stacked horizontal bar showing the equity/bond/cash/alt split. Deterministic
// rollups — no citation needed (they come from the user's own capacity).
function AllocationRing({ lines }: { lines: AllocationLine[] }) {
  const total = lines.reduce((s, l) => s + l.weightPct, 0) || 1;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", height: 14, borderRadius: 7, overflow: "hidden", border: `1px solid ${BORDER}` }}>
        {lines.map((l, i) => (
          <div
            key={i}
            title={`${l.assetClass} · ${l.weightPct.toFixed(1)}%`}
            style={{
              width: `${(l.weightPct / total) * 100}%`,
              background: CLASS_COLORS[l.assetClass] ?? ACCENT,
            }}
          />
        ))}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 14px" }}>
        {lines.map((l, i) => (
          <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 9, height: 9, borderRadius: 2, background: CLASS_COLORS[l.assetClass] ?? ACCENT, flexShrink: 0 }} />
            <span style={{ color: MUTED, fontFamily: MONO, fontSize: 11 }}>
              {l.vehicle} <span style={{ color: FAINT }}>{l.weightPct.toFixed(0)}%</span>
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

function PrereqBanner({ prereqs }: { prereqs: Prerequisite[] }) {
  if (!prereqs || prereqs.length === 0) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {prereqs.map((p, i) => {
        const color = p.blocking ? WARN : GOOD;
        return (
          <div
            key={i}
            style={{
              background: p.blocking ? "rgba(245,158,11,0.07)" : "rgba(34,197,94,0.06)",
              border: `1px solid ${p.blocking ? "rgba(245,158,11,0.28)" : "rgba(34,197,94,0.22)"}`,
              borderRadius: 11,
              padding: "14px 16px",
            }}
          >
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 5 }}>
              <span style={{ color, fontFamily: MONO, fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase" }}>
                {p.blocking ? "Do this first" : "Good to go"}
              </span>
              <span style={{ color: INK, fontFamily: SANS, fontSize: 14.5, fontWeight: 650 }}>{p.title}</span>
            </div>
            <p style={{ color: MUTED, fontFamily: SERIF, fontSize: 13.5, lineHeight: 1.55, margin: 0 }}>{p.detail}</p>
          </div>
        );
      })}
    </div>
  );
}

function AllocationRow({ line }: { line: AllocationLine }) {
  const color = riskColor(line.riskLevel);
  return (
    <div style={{ padding: "16px 0", borderBottom: `1px solid ${RULE}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <span style={{ color: INK, fontFamily: MONO, fontSize: 16, fontWeight: 700 }}>{line.vehicle}</span>
          <span style={{ color: MUTED, fontFamily: SERIF, fontSize: 13.5 }}>{line.vehicleName}</span>
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
          <span style={{ color: INK, fontFamily: DISPLAY, fontSize: 24, fontWeight: 600, lineHeight: 1 }}>
            {line.weightPct.toFixed(0)}
            <span style={{ color: FAINT, fontFamily: MONO, fontSize: 12, fontWeight: 400 }}>%</span>
          </span>
        </div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "5px 12px", margin: "8px 0 9px" }}>
        <span style={{ color: FAINT, fontFamily: MONO, fontSize: 10.5, letterSpacing: "0.06em" }}>{line.assetClass}</span>
        {line.amountUSD > 0 && (
          <span style={{ color: MUTED, fontFamily: MONO, fontSize: 11 }}>{fmtUsd(line.amountUSD)} now</span>
        )}
        {line.monthlyUSD > 0 && (
          <span style={{ color: MUTED, fontFamily: MONO, fontSize: 11 }}>{fmtUsd(line.monthlyUSD)}/mo</span>
        )}
        <span style={{ color, fontFamily: MONO, fontSize: 10.5, letterSpacing: "0.06em", textTransform: "uppercase" }}>
          {line.riskLevel} risk
        </span>
        <span style={{ color: GOOD, fontFamily: MONO, fontSize: 11 }}>{line.expectedReturn}</span>
      </div>

      <p style={{ color: MUTED, fontFamily: SERIF, fontSize: 14, lineHeight: 1.55, margin: 0 }}>
        <CitedText text={line.rationale} />
      </p>
    </div>
  );
}

const LANE_BLURB: Record<string, string> = {
  "Growth Architect": "Maximizes long-run compounding",
  "Risk Steward": "Guards the downside",
  "Income & Tax Strategist": "Yield and tax efficiency",
  "Goal & Liquidity Planner": "Matches money to timelines",
};

function SpecialistCard({ s }: { s: SpecialistOutput }) {
  const failed = s.durationMs === 0 || !s.stance;
  return (
    <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 18, display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
        <div>
          <div style={{ color: INK, fontFamily: SANS, fontSize: 14, fontWeight: 650 }}>{s.lane}</div>
          <div style={{ color: FAINT, fontFamily: SERIF, fontSize: 12, marginTop: 2 }}>{LANE_BLURB[s.lane] ?? ""}</div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ color: ACCENT, fontFamily: DISPLAY, fontSize: 26, fontWeight: 600, lineHeight: 1 }}>
            {s.equityPct}
            <span style={{ color: FAINT, fontFamily: MONO, fontSize: 11, fontWeight: 400 }}>% eq</span>
          </div>
        </div>
      </div>
      <p style={{ color: failed ? FAINT : MUTED, fontFamily: SERIF, fontSize: 13.5, lineHeight: 1.55, margin: 0, fontStyle: failed ? "italic" : "normal" }}>
        <CitedText text={s.stance} />
      </p>
      {s.endorses.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {s.endorses.map((e) => (
            <span
              key={e.ticker}
              title={e.reason}
              style={{ color: INK, fontFamily: MONO, fontSize: 11, fontWeight: 600, background: "rgba(79,135,247,0.08)", border: `1px solid rgba(79,135,247,0.22)`, borderRadius: 5, padding: "2px 7px" }}
            >
              {e.ticker}
            </span>
          ))}
        </div>
      )}
      {s.riskNote && !failed && (
        <p style={{ color: FAINT, fontFamily: SERIF, fontSize: 12.5, lineHeight: 1.5, margin: 0, paddingTop: 4, borderTop: `1px solid ${RULE}` }}>
          {s.riskNote}
        </p>
      )}
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

function RollupChip({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ background: "rgba(232,237,248,0.03)", border: `1px solid ${BORDER}`, borderRadius: 9, padding: "11px 14px" }}>
      <div style={{ color: FAINT, fontFamily: MONO, fontSize: 9.5, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 5 }}>
        {label}
      </div>
      <div style={{ color: color ?? INK, fontFamily: MONO, fontSize: 17, fontWeight: 600 }}>{value}</div>
    </div>
  );
}

export function AllocatorReport({ result }: { result: AllocatorResult }) {
  const { plan, specialists, disagreement, factSheet, baseline } = result;

  return (
    <div style={{ fontFamily: SANS, display: "flex", flexDirection: "column", gap: 40 }}>
      {/* ── The plan headline ───────────────────────────────────────── */}
      <section style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 16, padding: "28px 28px 26px" }}>
        <div style={SECTION_LABEL}>Your allocation plan</div>
        <p style={{ color: INK, fontFamily: SERIF, fontSize: 16.5, lineHeight: 1.62, margin: "0 0 16px", maxWidth: 760 }}>
          {plan.profileSummary}
        </p>

        <AllocationRing lines={plan.allocation} />

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10, marginTop: 22 }}>
          <RollupChip label="Equity" value={`${plan.equityPct}%`} color={CLASS_COLORS["Core US Equity"]} />
          <RollupChip label="Bonds" value={`${plan.bondPct}%`} color={CLASS_COLORS["Bonds"]} />
          <RollupChip label="Cash" value={`${plan.cashPct}%`} color={CLASS_COLORS["Cash Buffer"]} />
          {plan.altPct > 0 && <RollupChip label="Hedge" value={`${plan.altPct}%`} color={CLASS_COLORS["Inflation Hedge"]} />}
          <RollupChip label="Exp. return" value={plan.expectedReturnBand} color={GOOD} />
          <RollupChip label="Risk" value={plan.riskLevel} color={riskColor(plan.riskLevel)} />
        </div>

        <p style={{ color: ACCENT, fontFamily: SERIF, fontSize: 15.5, lineHeight: 1.55, fontStyle: "italic", margin: "20px 0 0" }}>
          {plan.bottomLine}
        </p>
      </section>

      {/* ── Prerequisites ───────────────────────────────────────────── */}
      {plan.prerequisites.length > 0 && (
        <section>
          <div style={SECTION_LABEL}>Before you deploy</div>
          <PrereqBanner prereqs={plan.prerequisites} />
        </section>
      )}

      {/* ── The allocation lines ────────────────────────────────────── */}
      <section style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 16, padding: "26px 28px 14px" }}>
        <div style={SECTION_LABEL}>Where the money goes</div>
        <h2 style={{ color: INK, fontFamily: DISPLAY, fontSize: 26, fontWeight: 500, margin: "0 0 8px" }}>
          {plan.allocation.length} positions, every dollar accounted for
        </h2>
        <div>
          {plan.allocation.map((l, i) => (
            <AllocationRow key={i} line={l} />
          ))}
        </div>
      </section>

      {/* ── The four planning agents ────────────────────────────────── */}
      <section>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
          <div>
            <div style={SECTION_LABEL}>The planning panel</div>
            <h2 style={{ color: INK, fontFamily: DISPLAY, fontSize: 26, fontWeight: 500, margin: 0 }}>
              Four agents, four lenses
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
          {specialists.map((s) => (
            <SpecialistCard key={s.lane} s={s} />
          ))}
        </div>
        <p style={{ color: FAINT, fontFamily: SERIF, fontSize: 13, lineHeight: 1.5, margin: "14px 0 0" }}>
          Each agent recommends a total equity weight independently. A high disagreement score means the panel can&rsquo;t agree how much risk your profile can carry — the judge&rsquo;s plan above is the reconciled view.
        </p>
      </section>

      {/* ── Account priority + SIP ──────────────────────────────────── */}
      <section style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 16, padding: "26px 28px" }}>
        <div style={SECTION_LABEL}>How to set it up</div>
        <h2 style={{ color: INK, fontFamily: DISPLAY, fontSize: 26, fontWeight: 500, margin: "0 0 16px" }}>
          Accounts first, then automate
        </h2>
        {plan.accountPriority.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            {plan.accountPriority.map((a, i) => (
              <div key={i} style={{ display: "flex", gap: 14, padding: "12px 0", borderBottom: `1px solid ${RULE}`, alignItems: "flex-start" }}>
                <div style={{ flexShrink: 0, width: 26, height: 26, borderRadius: 7, background: "rgba(79,135,247,0.12)", border: `1px solid rgba(79,135,247,0.3)`, color: ACCENT, fontFamily: MONO, fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {i + 1}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ color: INK, fontFamily: SANS, fontSize: 14.5, fontWeight: 650, marginBottom: 3 }}>{a.account}</div>
                  <p style={{ color: MUTED, fontFamily: SERIF, fontSize: 13.5, lineHeight: 1.5, margin: 0 }}>{a.detail}</p>
                </div>
              </div>
            ))}
          </div>
        )}
        {plan.sipPlan && (
          <div style={{ background: "rgba(34,197,94,0.06)", border: `1px solid rgba(34,197,94,0.2)`, borderRadius: 11, padding: "16px 18px" }}>
            <div style={{ color: GOOD, fontFamily: MONO, fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 7 }}>
              Your SIP — set it and forget it
            </div>
            <p style={{ color: INK, fontFamily: SERIF, fontSize: 14.5, lineHeight: 1.6, margin: 0 }}>{plan.sipPlan}</p>
          </div>
        )}
      </section>

      {/* ── Why it fits / what we left out ──────────────────────────── */}
      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
        {plan.fits.length > 0 && (
          <div>
            <div style={SECTION_LABEL}>Why this fits you</div>
            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 11 }}>
              {plan.fits.map((f, i) => (
                <li key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <span style={{ color: GOOD, fontFamily: MONO, fontSize: 13, flexShrink: 0, lineHeight: 1.5 }}>✓</span>
                  <span style={{ color: MUTED, fontFamily: SERIF, fontSize: 14, lineHeight: 1.55 }}>
                    <CitedText text={f} />
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {plan.exclusions.length > 0 && (
          <div>
            <div style={SECTION_LABEL}>What we left out, and why</div>
            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 13 }}>
              {plan.exclusions.map((e, i) => (
                <li key={i}>
                  <div style={{ color: INK, fontFamily: SANS, fontSize: 13.5, fontWeight: 650, marginBottom: 3 }}>{e.option}</div>
                  <p style={{ color: MUTED, fontFamily: SERIF, fontSize: 13.5, lineHeight: 1.5, margin: 0 }}>
                    <CitedText text={e.reason} />
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* ── Macro context ───────────────────────────────────────────── */}
      {factSheet.macroRegime && (
        <section>
          <div style={SECTION_LABEL}>The backdrop we planned against</div>
          <p style={{ color: MUTED, fontFamily: SERIF, fontSize: 14.5, lineHeight: 1.62, margin: 0, maxWidth: 760 }}>
            <CitedText text={factSheet.macroRegime} />
          </p>
        </section>
      )}

      {/* ── Sources ─────────────────────────────────────────────────── */}
      <section style={{ paddingTop: 4 }}>
        <SourceList sources={factSheet.sources} />
        {result.warnings.length > 0 && (
          <div style={{ marginTop: 16, color: FAINT, fontFamily: MONO, fontSize: 11, lineHeight: 1.6 }}>
            {result.warnings.map((w, i) => (
              <div key={i}>· {w}</div>
            ))}
          </div>
        )}
        <footer style={{ marginTop: 22, paddingTop: 16, borderTop: `1px solid ${RULE}`, color: FAINT, fontSize: 12, lineHeight: 1.6 }}>
          Educational planning only, not personalized financial advice. Allocation percentages and dollar splits are computed from the capacity you entered; every live market figure links to a source above. Capacity tier {baseline.capacityTier} · as of {new Date(result.asOf).toLocaleString()} · est. cost ${result.estCostUSD.toFixed(3)}.
        </footer>
      </section>
    </div>
  );
}
