"use client";

import { useState } from "react";
import type {
  Goal,
  Guardrail,
  InvestorProfile,
  RiskTolerance,
} from "@/lib/allocator/types";

const SURFACE = "#07121f";
const BORDER = "rgba(232,237,248,0.09)";
const INK = "#e8edf8";
const MUTED = "#8aa0c2";
const FAINT = "#526684";
const ACCENT = "#4f87f7";
const GOOD = "#22c55e";
const MONO = "var(--font-mono), 'JetBrains Mono', monospace";
const SANS = "var(--font-sans), system-ui, sans-serif";
const SERIF = "var(--font-serif), Georgia, serif";

const RISK_OPTIONS: { value: RiskTolerance; label: string; blurb: string }[] = [
  { value: "conservative", label: "Conservative", blurb: "Protect capital, low swings" },
  { value: "balanced", label: "Balanced", blurb: "Steady growth, moderate swings" },
  { value: "growth", label: "Growth", blurb: "Long-term upside, rides drawdowns" },
  { value: "aggressive", label: "Aggressive", blurb: "Max growth, high volatility" },
];

const GOAL_OPTIONS: { value: Goal; label: string }[] = [
  { value: "retirement", label: "Retirement" },
  { value: "wealth", label: "Build wealth" },
  { value: "house", label: "House down payment" },
  { value: "income", label: "Passive income" },
  { value: "education", label: "Education" },
  { value: "bigPurchase", label: "Big purchase" },
  { value: "preservation", label: "Preserve capital" },
];

const GUARDRAIL_OPTIONS: { value: Guardrail; label: string }[] = [
  { value: "indexOnly", label: "Index funds only" },
  { value: "noBonds", label: "No bonds" },
  { value: "usOnly", label: "US only" },
  { value: "dividendFocus", label: "Dividend / income tilt" },
  { value: "addHedge", label: "Add inflation hedge" },
  { value: "esgTilt", label: "ESG / sustainable" },
];

const HORIZON_PRESETS = [
  { years: 2, label: "~2y" },
  { years: 5, label: "~5y" },
  { years: 10, label: "~10y" },
  { years: 20, label: "~20y" },
  { years: 35, label: "30y+" },
];

export interface ProfileDraft {
  lumpSum: string;
  monthlyContribution: string;
  riskTolerance: RiskTolerance | null;
  horizonYears: number;
  goals: Goal[];
  highInterestDebt: boolean;
  hasEmergencyFund: boolean;
  guardrails: Guardrail[];
  notes: string;
}

export function emptyDraft(): ProfileDraft {
  return {
    lumpSum: "",
    monthlyContribution: "",
    riskTolerance: null,
    horizonYears: 10,
    goals: [],
    highInterestDebt: false,
    hasEmergencyFund: false,
    guardrails: [],
    notes: "",
  };
}

export function draftToProfile(d: ProfileDraft): InvestorProfile | null {
  const lumpSum = Math.max(0, Number(d.lumpSum) || 0);
  const monthlyContribution = Math.max(0, Number(d.monthlyContribution) || 0);
  if (lumpSum <= 0 && monthlyContribution <= 0) return null;
  if (!d.riskTolerance) return null;
  if (d.goals.length === 0) return null;
  return {
    lumpSum,
    monthlyContribution,
    riskTolerance: d.riskTolerance,
    horizonYears: d.horizonYears,
    goals: d.goals,
    highInterestDebt: d.highInterestDebt,
    hasEmergencyFund: d.hasEmergencyFund,
    guardrails: d.guardrails,
    notes: d.notes.trim() || undefined,
  };
}

interface Props {
  draft: ProfileDraft;
  onChange: (d: ProfileDraft) => void;
  onSubmit: () => void;
  disabled?: boolean;
  /** Legacy prop — metering is internal now; kept so callers don't break. */
  cost?: number;
}

function Chip({
  active,
  onClick,
  children,
  accent = ACCENT,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  accent?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        fontFamily: MONO,
        fontSize: 12,
        letterSpacing: "0.04em",
        padding: "9px 14px",
        borderRadius: 100,
        cursor: "pointer",
        background: active ? `${accent}1f` : "rgba(232,237,248,0.04)",
        border: `1px solid ${active ? accent : BORDER}`,
        color: active ? INK : MUTED,
        transition: "all .15s ease",
      }}
    >
      {children}
    </button>
  );
}

const LABEL: React.CSSProperties = {
  display: "block",
  color: FAINT,
  fontFamily: MONO,
  fontSize: 10,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  marginBottom: 10,
};

export function ProfileForm({ draft, onChange, onSubmit, disabled }: Props) {
  const [touched, setTouched] = useState(false);
  const set = (patch: Partial<ProfileDraft>) => onChange({ ...draft, ...patch });
  const toggle = <T,>(arr: T[], v: T): T[] => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  const valid = draftToProfile(draft) !== null;
  const canSubmit = valid && !disabled;

  return (
    <div style={{ fontFamily: SANS }}>
      <style>{`
        .af-input { background: rgba(232,237,248,0.04); border: 1px solid ${BORDER}; border-radius: 9px; color: ${INK}; font-family: ${MONO}; font-size: 15px; padding: 12px 14px; outline: none; transition: border-color .15s ease; width: 100%; box-sizing: border-box; }
        .af-input:focus { border-color: ${ACCENT}; }
        .af-input::placeholder { color: ${FAINT}; }
        .af-run { background: ${ACCENT}; color: #061018; border: none; border-radius: 100px; padding: 14px 34px; font-family: ${SANS}; font-size: 14.5px; font-weight: 700; cursor: pointer; transition: opacity .15s ease, transform .1s ease; }
        .af-run:hover:not(:disabled) { opacity: .92; }
        .af-run:active:not(:disabled) { transform: translateY(1px); }
        .af-run:disabled { opacity: .4; cursor: not-allowed; }
        .af-card { background: ${SURFACE}; border: 1px solid ${BORDER}; border-radius: 14px; padding: 22px 22px 24px; }
        .af-slider { width: 100%; accent-color: ${ACCENT}; }
        @media (max-width: 720px) { .af-grid2 { grid-template-columns: 1fr !important; } }
      `}</style>

      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {/* Capacity */}
        <div className="af-card">
          <label style={LABEL}>How much are you investing?</label>
          <div className="af-grid2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div>
              <div style={{ color: MUTED, fontFamily: SERIF, fontSize: 13, marginBottom: 6 }}>Lump sum, now (USD)</div>
              <input
                className="af-input"
                inputMode="numeric"
                placeholder="10000"
                value={draft.lumpSum}
                onChange={(e) => set({ lumpSum: e.target.value.replace(/[^0-9.]/g, "") })}
              />
            </div>
            <div>
              <div style={{ color: MUTED, fontFamily: SERIF, fontSize: 13, marginBottom: 6 }}>Monthly contribution (USD)</div>
              <input
                className="af-input"
                inputMode="numeric"
                placeholder="500"
                value={draft.monthlyContribution}
                onChange={(e) => set({ monthlyContribution: e.target.value.replace(/[^0-9.]/g, "") })}
              />
            </div>
          </div>
        </div>

        {/* Risk */}
        <div className="af-card">
          <label style={LABEL}>Risk tolerance</label>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
            {RISK_OPTIONS.map((r) => {
              const on = draft.riskTolerance === r.value;
              return (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => set({ riskTolerance: r.value })}
                  style={{
                    textAlign: "left",
                    background: on ? `${ACCENT}1a` : "rgba(232,237,248,0.03)",
                    border: `1px solid ${on ? ACCENT : BORDER}`,
                    borderRadius: 11,
                    padding: "13px 15px",
                    cursor: "pointer",
                    transition: "all .15s ease",
                  }}
                >
                  <div style={{ color: on ? INK : MUTED, fontFamily: SANS, fontSize: 14.5, fontWeight: 650 }}>{r.label}</div>
                  <div style={{ color: FAINT, fontFamily: SERIF, fontSize: 12.5, marginTop: 3, lineHeight: 1.4 }}>{r.blurb}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Horizon */}
        <div className="af-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
            <label style={{ ...LABEL, marginBottom: 0 }}>Time horizon</label>
            <span style={{ color: INK, fontFamily: MONO, fontSize: 15, fontWeight: 700 }}>
              {draft.horizonYears} {draft.horizonYears === 1 ? "year" : "years"}
            </span>
          </div>
          <input
            className="af-slider"
            type="range"
            min={1}
            max={40}
            step={1}
            value={draft.horizonYears}
            onChange={(e) => set({ horizonYears: Number(e.target.value) })}
          />
          <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
            {HORIZON_PRESETS.map((p) => (
              <Chip key={p.years} active={draft.horizonYears === p.years} onClick={() => set({ horizonYears: p.years })}>
                {p.label}
              </Chip>
            ))}
          </div>
        </div>

        {/* Goals */}
        <div className="af-card">
          <label style={LABEL}>Goals (pick any)</label>
          <div style={{ display: "flex", gap: 9, flexWrap: "wrap" }}>
            {GOAL_OPTIONS.map((g) => (
              <Chip key={g.value} active={draft.goals.includes(g.value)} onClick={() => set({ goals: toggle(draft.goals, g.value) })}>
                {g.label}
              </Chip>
            ))}
          </div>
        </div>

        {/* Prerequisites */}
        <div className="af-card">
          <label style={LABEL}>Before we deploy a dollar</label>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <ToggleRow
              label="I have debt above ~7% APR (credit cards, etc.)"
              value={draft.highInterestDebt}
              onChange={(v) => set({ highInterestDebt: v })}
              warnWhenTrue
            />
            <ToggleRow
              label="I already have a 3-6 month emergency fund"
              value={draft.hasEmergencyFund}
              onChange={(v) => set({ hasEmergencyFund: v })}
              warnWhenTrue={false}
            />
          </div>
        </div>

        {/* Guardrails */}
        <div className="af-card">
          <label style={LABEL}>Guardrails (optional)</label>
          <div style={{ display: "flex", gap: 9, flexWrap: "wrap" }}>
            {GUARDRAIL_OPTIONS.map((g) => (
              <Chip
                key={g.value}
                active={draft.guardrails.includes(g.value)}
                onClick={() => set({ guardrails: toggle(draft.guardrails, g.value) })}
                accent={GOOD}
              >
                {g.label}
              </Chip>
            ))}
          </div>
          <div style={{ marginTop: 16 }}>
            <div style={{ color: MUTED, fontFamily: SERIF, fontSize: 13, marginBottom: 6 }}>Anything else? (optional)</div>
            <input
              className="af-input"
              style={{ fontFamily: SERIF }}
              placeholder="e.g. avoid energy, prefer Fidelity funds…"
              maxLength={280}
              value={draft.notes}
              onChange={(e) => set({ notes: e.target.value })}
            />
          </div>
        </div>

        {/* Run */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", marginTop: 4 }}>
          <button
            className="af-run"
            type="button"
            disabled={!canSubmit}
            onClick={() => {
              setTouched(true);
              if (canSubmit) onSubmit();
            }}
          >
            {disabled ? "Building your plan…" : "Build my allocation plan"}
          </button>
          <span style={{ color: FAINT, fontFamily: MONO, fontSize: 12 }}>
            From your goals to an actual plan · ~60–90s
          </span>
          {touched && !valid && (
            <span style={{ color: MUTED, fontFamily: SERIF, fontSize: 13 }}>
              Add an amount, a risk level, and at least one goal.
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  value,
  onChange,
  warnWhenTrue,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  warnWhenTrue: boolean;
}) {
  const activeColor = warnWhenTrue ? "#f59e0b" : GOOD;
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14 }}>
      <span style={{ color: MUTED, fontFamily: SERIF, fontSize: 14.5, lineHeight: 1.4 }}>{label}</span>
      <div style={{ display: "flex", gap: 7, flexShrink: 0 }}>
        <Chip active={value} onClick={() => onChange(true)} accent={activeColor}>
          Yes
        </Chip>
        <Chip active={!value} onClick={() => onChange(false)}>
          No
        </Chip>
      </div>
    </div>
  );
}
