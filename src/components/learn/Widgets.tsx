"use client";

// Conviqt Learn — interactive simulators.
//
// These are the "play with it" moments that make a lesson stick. The author
// model picks ONE widget type per lesson and supplies starting params; these
// trusted components own all the math and interactivity. Nothing here evals
// model output — params are numbers only.

import { useMemo, useState } from "react";
import type { LessonWidget, WidgetType } from "@/lib/learn/types";

const ACCENT = "#4f87f7";
const BULL = "#22c55e";
const HOLD = "#f59e0b";
const BEAR = "#ef4444";
const INK = "#e8edf8";
const MUTED = "#8aa0c2";
const CARD = "#071120";
const BORDER = "1px solid rgba(232,237,248,0.09)";
const MONO = "var(--font-mono), 'JetBrains Mono', monospace";
const SANS = "var(--font-sans), system-ui, sans-serif";
const SERIF = "var(--font-serif), Georgia, serif";

function fmtUSD(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

// ── Shared slider ────────────────────────────────────────────────────────────

function Slider({
  label, value, min, max, step, onChange, format, accent = ACCENT,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format: (v: number) => string;
  accent?: string;
}) {
  return (
    <label style={{ display: "block", marginBottom: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
        <span style={{ fontSize: 12.5, color: MUTED }}>{label}</span>
        <span style={{ fontFamily: MONO, fontSize: 13, color: accent, fontWeight: 650 }}>
          {format(value)}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: "100%", accentColor: accent, cursor: "pointer" }}
      />
    </label>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="learn-widget-shell"
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0,1fr) minmax(0,1.1fr)",
        gap: 24,
        alignItems: "center",
      }}
    >
      {children}
    </div>
  );
}

function Stat({ label, value, accent = INK }: { label: string; value: string; accent?: string }) {
  return (
    <div style={{ background: "rgba(232,237,248,0.03)", border: BORDER, borderRadius: 8, padding: "12px 14px" }}>
      <div style={{ fontSize: 11, color: MUTED, marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontFamily: MONO, fontSize: 18, fontWeight: 650, color: accent }}>{value}</div>
    </div>
  );
}

// ── 1. Compound interest ─────────────────────────────────────────────────────

function CompoundInterestLab({ p }: { p: Record<string, number> }) {
  const [principal, setPrincipal] = useState(clamp(p.principal ?? 100, 0, 5000));
  const [monthly, setMonthly] = useState(clamp(p.monthlyContribution ?? 20, 0, 500));
  const [years, setYears] = useState(clamp(p.years ?? 20, 1, 50));
  const [rate, setRate] = useState(clamp(p.annualRatePct ?? 8, 1, 15));

  const series = useMemo(() => {
    const r = rate / 100 / 12;
    const months = years * 12;
    const pts: { balance: number; contributed: number }[] = [];
    let bal = principal;
    let contributed = principal;
    for (let m = 1; m <= months; m++) {
      bal = bal * (1 + r) + monthly;
      contributed += monthly;
      if (m % 12 === 0) pts.push({ balance: bal, contributed });
    }
    return pts;
  }, [principal, monthly, years, rate]);

  const final = series[series.length - 1] ?? { balance: principal, contributed: principal };
  const growth = final.balance - final.contributed;

  return (
    <Shell>
      <div>
        <Slider label="Starting amount" value={principal} min={0} max={5000} step={50} onChange={setPrincipal} format={fmtUSD} />
        <Slider label="Added every month" value={monthly} min={0} max={500} step={5} onChange={setMonthly} format={fmtUSD} />
        <Slider label="Years invested" value={years} min={1} max={50} step={1} onChange={setYears} format={(v) => `${v} yr`} />
        <Slider label="Yearly growth rate" value={rate} min={1} max={15} step={0.5} onChange={setRate} format={(v) => `${v}%`} />
      </div>
      <div>
        <AreaChart series={series.map((s) => s.balance)} baseline={series.map((s) => s.contributed)} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginTop: 16 }}>
          <Stat label="You put in" value={fmtUSD(final.contributed)} />
          <Stat label="Growth" value={fmtUSD(growth)} accent={ACCENT} />
          <Stat label="Total" value={fmtUSD(final.balance)} accent={ACCENT} />
        </div>
      </div>
    </Shell>
  );
}

// Two-line area chart: total balance (accent) over contributions (muted).
function AreaChart({ series, baseline }: { series: number[]; baseline: number[] }) {
  const W = 460, H = 240, pad = 8;
  const max = Math.max(...series, 1);
  const n = series.length;
  const x = (i: number) => pad + (i / Math.max(1, n - 1)) * (W - pad * 2);
  const y = (v: number) => H - pad - (v / max) * (H - pad * 2);

  const line = (arr: number[]) => arr.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const area = (arr: number[]) => `${line(arr)} L${x(n - 1).toFixed(1)},${H - pad} L${x(0).toFixed(1)},${H - pad} Z`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }} role="img" aria-label="Growth over time">
      <defs>
        <linearGradient id="ciGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={ACCENT} stopOpacity="0.45" />
          <stop offset="100%" stopColor={ACCENT} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={area(series)} fill="url(#ciGrad)" />
      <path d={line(baseline)} fill="none" stroke="rgba(232,237,248,0.35)" strokeWidth="2" strokeDasharray="4 4" />
      <path d={line(series)} fill="none" stroke={ACCENT} strokeWidth="2.5" />
    </svg>
  );
}

// ── 2. Budget splitter (50/30/20) ────────────────────────────────────────────

function BudgetSplitter({ p }: { p: Record<string, number> }) {
  const [income, setIncome] = useState(clamp(p.monthlyIncome ?? 200, 20, 3000));
  const [needs, setNeeds] = useState(clamp(p.needsPct ?? 50, 0, 100));
  const [wants, setWants] = useState(clamp(p.wantsPct ?? 30, 0, 100));
  const savings = Math.max(0, 100 - needs - wants);
  const over = needs + wants > 100;

  const seg = (pct: number, color: string, label: string) => ({ pct, color, label });
  const segments = [
    seg(needs, ACCENT, "Needs"),
    seg(wants, HOLD, "Wants"),
    seg(savings, BULL, "Save / Invest"),
  ];

  return (
    <Shell>
      <div>
        <Slider label="Monthly money in" value={income} min={20} max={3000} step={10} onChange={setIncome} format={fmtUSD} accent={ACCENT} />
        <Slider label="Needs %" value={needs} min={0} max={100} step={1} onChange={setNeeds} format={(v) => `${v}%`} accent={ACCENT} />
        <Slider label="Wants %" value={wants} min={0} max={100} step={1} onChange={setWants} format={(v) => `${v}%`} accent={HOLD} />
        {over && (
          <div style={{ color: "#f87171", fontSize: 12.5, marginTop: -6 }}>
            That&apos;s over 100% — nothing left to save. Pull something back.
          </div>
        )}
      </div>
      <div>
        <div style={{ display: "flex", height: 46, borderRadius: 10, overflow: "hidden", border: BORDER }}>
          {segments.map((s) => (
            <div
              key={s.label}
              style={{ width: `${s.pct}%`, background: s.color, transition: "width 0.25s ease" }}
              title={`${s.label}: ${s.pct}%`}
            />
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginTop: 16 }}>
          {segments.map((s) => (
            <Stat key={s.label} label={s.label} value={fmtUSD((income * s.pct) / 100)} accent={s.color} />
          ))}
        </div>
        <p style={{ fontSize: 12.5, color: MUTED, marginTop: 12 }}>
          The classic <strong style={{ color: INK }}>50/30/20</strong> split: half on needs, a third on
          wants, a fifth straight into your future.
        </p>
      </div>
    </Shell>
  );
}

// ── 3. Diversification meter ─────────────────────────────────────────────────

function DiversificationMeter({ p }: { p: Record<string, number> }) {
  const [count, setCount] = useState(clamp(Math.round(p.holdings ?? 1), 1, 30));
  // Portfolio "swinginess" falls toward the market floor as you add holdings.
  const single = 42, floor = 14;
  const vol = floor + (single - floor) / Math.sqrt(count);
  const pct = (vol - floor) / (single - floor); // 1 = wild, 0 = calm
  const color = pct > 0.6 ? BEAR : pct > 0.3 ? HOLD : BULL;
  const label = pct > 0.6 ? "Wild ride" : pct > 0.3 ? "Bumpy" : "Steady";

  return (
    <Shell>
      <div>
        <Slider label="How many companies you own" value={count} min={1} max={30} step={1} onChange={setCount} format={(v) => `${v}`} accent={color} />
        <p style={{ fontSize: 12.5, color: MUTED, marginTop: 8 }}>
          One stock and your whole future rides on one company&apos;s news. Spread across many and a single
          bad day barely moves you — same expected reward, far less white-knuckle risk.
        </p>
        <div style={{ marginTop: 16 }}>
          <Stat label="Portfolio swing" value={`±${vol.toFixed(0)}%`} accent={color} />
        </div>
      </div>
      <div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 7 }}>
          {Array.from({ length: 30 }).map((_, i) => (
            <div
              key={i}
              style={{
                aspectRatio: "1",
                borderRadius: 7,
                background: i < count ? color : "rgba(232,237,248,0.06)",
                transition: "background 0.2s ease",
              }}
            />
          ))}
        </div>
        <div style={{ marginTop: 16, textAlign: "center" }}>
          <span style={{ fontSize: 12, color: MUTED }}>Risk feels</span>
          <div style={{ fontFamily: MONO, fontSize: 22, fontWeight: 650, color }}>{label}</div>
        </div>
      </div>
    </Shell>
  );
}

// ── 4. Dollar-cost averaging ─────────────────────────────────────────────────

function DollarCostAveraging({ p }: { p: Record<string, number> }) {
  const [monthly, setMonthly] = useState(clamp(p.monthlyAmount ?? 50, 10, 500));
  const [months, setMonths] = useState(clamp(Math.round(p.months ?? 12), 3, 36));

  const sim = useMemo(() => {
    // Deterministic choppy price path — a dip then recovery, the case DCA wins.
    const prices: number[] = [];
    for (let i = 0; i < months; i++) {
      const t = i / Math.max(1, months - 1);
      const base = 100;
      const dip = -28 * Math.sin(Math.PI * t); // down then back up
      const wobble = 6 * Math.sin(i * 1.7);
      prices.push(Math.max(20, base + dip + wobble));
    }
    let dcaShares = 0;
    for (const price of prices) dcaShares += monthly / price;
    const invested = monthly * months;
    const lumpShares = invested / prices[0];
    const last = prices[prices.length - 1];
    return {
      prices,
      invested,
      dcaValue: dcaShares * last,
      lumpValue: lumpShares * last,
      avgCost: invested / dcaShares,
    };
  }, [monthly, months]);

  const dcaWins = sim.dcaValue >= sim.lumpValue;

  return (
    <Shell>
      <div>
        <Slider label="Invested each month" value={monthly} min={10} max={500} step={10} onChange={setMonthly} format={fmtUSD} />
        <Slider label="For how many months" value={months} min={3} max={36} step={1} onChange={setMonths} format={(v) => `${v} mo`} />
        <p style={{ fontSize: 12.5, color: MUTED, marginTop: 8 }}>
          Buying a fixed amount every month means you grab <em>more</em> shares when prices dip — your
          average cost drops automatically.
        </p>
      </div>
      <div>
        <PriceBars prices={sim.prices} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 16 }}>
          <Stat label="Drip in monthly (DCA)" value={fmtUSD(sim.dcaValue)} accent={dcaWins ? ACCENT : INK} />
          <Stat label="All-in on day one" value={fmtUSD(sim.lumpValue)} accent={!dcaWins ? ACCENT : INK} />
        </div>
        <p style={{ fontSize: 12, color: MUTED, marginTop: 10 }}>
          Same {fmtUSD(sim.invested)} invested. Average buy price drip-feeding: <strong style={{ color: INK }}>{fmtUSD(sim.avgCost)}</strong>.
        </p>
      </div>
    </Shell>
  );
}

function PriceBars({ prices }: { prices: number[] }) {
  const W = 460, H = 180, pad = 6;
  const max = Math.max(...prices), min = Math.min(...prices);
  const span = Math.max(1, max - min);
  const bw = (W - pad * 2) / prices.length;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }} role="img" aria-label="Monthly price path">
      {prices.map((pr, i) => {
        const h = ((pr - min) / span) * (H - pad * 2) + 6;
        return (
          <rect
            key={i}
            x={pad + i * bw + bw * 0.15}
            y={H - pad - h}
            width={bw * 0.7}
            height={h}
            rx={2}
            fill={ACCENT}
            opacity={0.35 + 0.5 * ((pr - min) / span)}
          />
        );
      })}
    </svg>
  );
}

// ── 5. Position sizing (Kelly criterion) ─────────────────────────────────────

function PositionSizingLab({ p }: { p: Record<string, number> }) {
  const [winRate, setWinRate] = useState(clamp(p.winRatePct ?? 55, 5, 95));
  const [payoff, setPayoff] = useState(clamp(p.payoffRatio ?? 2, 0.2, 6));
  const [capital, setCapital] = useState(clamp(p.capital ?? 100000, 1000, 5_000_000));

  const wp = winRate / 100;
  const lp = 1 - wp;
  // Kelly: f* = (p*b - q) / b
  const fullKelly = (wp * payoff - lp) / payoff;
  const edge = wp * payoff - lp; // expected payoff per unit risked
  const positive = fullKelly > 0;
  const fk = Math.max(0, fullKelly);
  const halfK = fk / 2;

  const barColor = !positive ? BEAR : fk > 0.25 ? HOLD : BULL;

  return (
    <Shell>
      <div>
        <Slider label="Win rate" value={winRate} min={5} max={95} step={1} onChange={setWinRate} format={(v) => `${v}%`} accent={ACCENT} />
        <Slider label="Payoff ratio (avg win ÷ avg loss)" value={payoff} min={0.2} max={6} step={0.1} onChange={setPayoff} format={(v) => `${v.toFixed(1)}×`} accent={BULL} />
        <Slider label="Account capital" value={capital} min={1000} max={5_000_000} step={1000} onChange={setCapital} format={fmtUSD} accent={ACCENT} />
        <p style={{ fontSize: 12.5, color: MUTED, marginTop: 4 }}>
          {positive ? (
            <>You have a positive edge. <strong style={{ color: INK }}>Full Kelly</strong> maximizes long-run growth but is violently volatile — pros bet <strong style={{ color: INK }}>half</strong>.</>
          ) : (
            <>Negative edge: Kelly says bet <strong style={{ color: BEAR }}>nothing</strong>. No sizing rule rescues a losing strategy.</>
          )}
        </p>
      </div>
      <div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Stat label="Full Kelly" value={`${(fk * 100).toFixed(1)}%`} accent={barColor} />
          <Stat label="Half Kelly (use this)" value={`${(halfK * 100).toFixed(1)}%`} accent={positive ? ACCENT : BEAR} />
          <Stat label="Edge per $ risked" value={`${edge >= 0 ? "+" : ""}${(edge * 100).toFixed(0)}¢`} accent={positive ? BULL : BEAR} />
          <Stat label="Risk on this trade" value={fmtUSD(capital * halfK)} accent={positive ? ACCENT : BEAR} />
        </div>
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 12, color: MUTED, marginBottom: 8 }}>
            Bet size vs your bankroll
          </div>
          <div style={{ height: 22, borderRadius: 6, background: "rgba(232,237,248,0.06)", overflow: "hidden", border: BORDER }}>
            <div style={{ width: `${Math.min(100, fk * 100)}%`, height: "100%", background: barColor, transition: "width .25s ease" }} />
          </div>
          <p style={{ fontSize: 12, color: MUTED, marginTop: 10 }}>
            Betting more than full Kelly lowers growth <em>and</em> raises risk of ruin — over-betting an edge still goes to zero.
          </p>
        </div>
      </div>
    </Shell>
  );
}

// ── 6. Drawdown recovery (the recovery tax) ───────────────────────────────────

function DrawdownRecovery({ p }: { p: Record<string, number> }) {
  const [dd, setDd] = useState(clamp(p.drawdownPct ?? 50, 1, 95));
  const d = dd / 100;
  const recovery = d / (1 - d); // gain needed to get back to even
  const recoveryPct = recovery * 100;
  const sevColor = dd >= 50 ? BEAR : dd >= 25 ? HOLD : BULL;

  return (
    <Shell>
      <div>
        <Slider label="Drawdown (peak-to-trough loss)" value={dd} min={1} max={95} step={1} onChange={setDd} format={(v) => `−${v}%`} accent={sevColor} />
        <div style={{ marginTop: 6, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Stat label="You lost" value={`−${dd}%`} accent={BEAR} />
          <Stat label="Gain to break even" value={`+${recoveryPct.toFixed(0)}%`} accent={sevColor} />
        </div>
        <p style={{ fontSize: 12.5, color: MUTED, marginTop: 12 }}>
          Losses and gains are <strong style={{ color: INK }}>not symmetric</strong>. The deeper the hole, the
          exponentially harder the climb — which is why capping drawdowns beats chasing the last few points of upside.
        </p>
      </div>
      <div>
        <div style={{ display: "grid", gap: 14 }}>
          <RecoveryBar label="The loss" pct={dd} max={Math.max(100, recoveryPct)} color={BEAR} caption={`−${dd}%`} />
          <RecoveryBar label="The climb back" pct={recoveryPct} max={Math.max(100, recoveryPct)} color={sevColor} caption={`+${recoveryPct.toFixed(0)}%`} />
        </div>
        <p style={{ fontSize: 12, color: MUTED, marginTop: 14, textAlign: "center" }}>
          −20% → +25%　•　−50% → +100%　•　−80% → +400%
        </p>
      </div>
    </Shell>
  );
}

function RecoveryBar({ label, pct, max, color, caption }: { label: string; pct: number; max: number; color: string; caption: string }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ fontSize: 11.5, color: MUTED }}>{label}</span>
        <span style={{ fontFamily: MONO, fontSize: 13, fontWeight: 650, color }}>{caption}</span>
      </div>
      <div style={{ height: 20, borderRadius: 6, background: "rgba(232,237,248,0.06)", overflow: "hidden", border: BORDER }}>
        <div style={{ width: `${Math.min(100, (pct / max) * 100)}%`, height: "100%", background: color, transition: "width .25s ease" }} />
      </div>
    </div>
  );
}

// ── 7. Expected value (asymmetric bets) ───────────────────────────────────────

function ExpectedValueLab({ p }: { p: Record<string, number> }) {
  const [winProb, setWinProb] = useState(clamp(p.winProbPct ?? 40, 1, 99));
  const [winPct, setWinPct] = useState(clamp(p.winPct ?? 60, 1, 300));
  const [lossPct, setLossPct] = useState(clamp(p.lossPct ?? 20, 1, 100));

  const wp = winProb / 100;
  const ev = wp * winPct - (1 - wp) * lossPct; // expected % return on the position
  const payoff = winPct / lossPct;
  const positive = ev > 0;
  const evColor = positive ? BULL : BEAR;

  return (
    <Shell>
      <div>
        <Slider label="Chance you're right" value={winProb} min={1} max={99} step={1} onChange={setWinProb} format={(v) => `${v}%`} accent={ACCENT} />
        <Slider label="Upside if right" value={winPct} min={1} max={300} step={5} onChange={setWinPct} format={(v) => `+${v}%`} accent={BULL} />
        <Slider label="Downside if wrong" value={lossPct} min={1} max={100} step={1} onChange={setLossPct} format={(v) => `−${v}%`} accent={BEAR} />
        <p style={{ fontSize: 12.5, color: MUTED, marginTop: 4 }}>
          A <strong style={{ color: INK }}>{winProb}%</strong> shot can be a great bet and a <strong style={{ color: INK }}>{(100 - winProb)}%</strong> favorite can be a terrible one. Asymmetry — not your hit rate — is the edge.
        </p>
      </div>
      <div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Stat label="Expected value" value={`${ev >= 0 ? "+" : ""}${ev.toFixed(1)}%`} accent={evColor} />
          <Stat label="Payoff ratio" value={`${payoff.toFixed(1)}×`} accent={payoff >= 1 ? BULL : HOLD} />
        </div>
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 12, color: MUTED, marginBottom: 10 }}>
            Probability-weighted outcomes
          </div>
          <ProbBar label="Win" prob={wp} value={winPct} color={BULL} />
          <ProbBar label="Lose" prob={1 - wp} value={-lossPct} color={BEAR} />
        </div>
        <p style={{ fontSize: 12, color: MUTED, marginTop: 12 }}>
          {positive
            ? "Positive EV: repeat this bet enough times and you compound up — even losing more often than you win."
            : "Negative EV: the math is against you. Size it to zero or find a better asymmetry."}
        </p>
      </div>
    </Shell>
  );
}

function ProbBar({ label, prob, value, color }: { label: string; prob: number; value: number; color: string }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
        <span style={{ fontSize: 11.5, color: MUTED }}>{label} · {(prob * 100).toFixed(0)}% of the time</span>
        <span style={{ fontFamily: MONO, fontSize: 12.5, fontWeight: 650, color }}>{value >= 0 ? "+" : ""}{value}%</span>
      </div>
      <div style={{ height: 16, borderRadius: 5, background: "rgba(232,237,248,0.06)", overflow: "hidden", border: BORDER }}>
        <div style={{ width: `${prob * 100}%`, height: "100%", background: color, opacity: 0.85, transition: "width .25s ease" }} />
      </div>
    </div>
  );
}

// ── 8. Reverse DCF (what growth is priced in) ─────────────────────────────────

function ReverseDcfLab({ p }: { p: Record<string, number> }) {
  const [price, setPrice] = useState(clamp(p.currentPrice ?? 100, 5, 2000));
  const [fcf, setFcf] = useState(clamp(p.currentFcfPerShare ?? 4, 0.1, 100));
  const [growth, setGrowth] = useState(clamp(p.impliedGrowthPct ?? 12, 0, 60));
  const [discount, setDiscount] = useState(clamp(p.discountRatePct ?? 9, 5, 18));
  const years = clamp(Math.round(p.years ?? 10), 5, 15);

  const TERMINAL_G = 2.5;

  const fairValue = useMemo(() => {
    const g = growth / 100;
    const r = discount / 100;
    const tg = TERMINAL_G / 100;
    let pv = 0;
    let f = fcf;
    for (let t = 1; t <= years; t++) {
      f = f * (1 + g);
      pv += f / Math.pow(1 + r, t);
    }
    // Gordon terminal value on the final-year FCF
    if (r > tg) {
      const tv = (f * (1 + tg)) / (r - tg);
      pv += tv / Math.pow(1 + r, years);
    }
    return pv;
  }, [fcf, growth, discount, years]);

  const premium = ((price - fairValue) / fairValue) * 100;
  const overvalued = premium > 0;
  const valColor = Math.abs(premium) < 10 ? HOLD : overvalued ? BEAR : BULL;

  return (
    <Shell>
      <div>
        <Slider label="Current share price" value={price} min={5} max={2000} step={5} onChange={setPrice} format={fmtUSD} accent={ACCENT} />
        <Slider label="Free cash flow / share" value={fcf} min={0.1} max={100} step={0.1} onChange={setFcf} format={(v) => `$${v.toFixed(2)}`} accent={ACCENT} />
        <Slider label="Assumed FCF growth (next decade)" value={growth} min={0} max={60} step={1} onChange={setGrowth} format={(v) => `${v}%/yr`} accent={BULL} />
        <Slider label="Discount rate" value={discount} min={5} max={18} step={0.5} onChange={setDiscount} format={(v) => `${v}%`} accent={HOLD} />
        <p style={{ fontSize: 12.5, color: MUTED, marginTop: 4 }}>
          Don&apos;t forecast — <strong style={{ color: INK }}>invert</strong>. Drag growth until fair value meets the price: that&apos;s the growth the market is <em>already</em> paying for.
        </p>
      </div>
      <div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Stat label="Model fair value" value={fmtUSD(fairValue)} accent={ACCENT} />
          <Stat label={overvalued ? "Priced above model" : "Priced below model"} value={`${overvalued ? "+" : ""}${premium.toFixed(0)}%`} accent={valColor} />
        </div>
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 12, color: MUTED, marginBottom: 10 }}>
            Price vs intrinsic value
          </div>
          <RecoveryBar label="Market price" pct={price} max={Math.max(price, fairValue)} color={INK} caption={fmtUSD(price)} />
          <div style={{ height: 10 }} />
          <RecoveryBar label="Model value" pct={fairValue} max={Math.max(price, fairValue)} color={valColor} caption={fmtUSD(fairValue)} />
        </div>
        <p style={{ fontSize: 12, color: MUTED, marginTop: 12 }}>
          {Math.abs(premium) < 10
            ? "Roughly fairly priced for these assumptions — the debate is whether the growth is achievable."
            : overvalued
              ? "The price demands richer growth than you've assumed. Is that realistic, or is optimism embedded?"
              : "The price implies less growth than you've assumed — a potential margin of safety if you're right."}
        </p>
      </div>
    </Shell>
  );
}

// ── 9. Unit economics (LTV / CAC) ─────────────────────────────────────────────

function LtvCacLab({ p }: { p: Record<string, number> }) {
  const [cac, setCac] = useState(clamp(p.cac ?? 300, 10, 5000));
  const [arpu, setArpu] = useState(clamp(p.arpuMonthly ?? 50, 1, 1000));
  const [gm, setGm] = useState(clamp(p.grossMarginPct ?? 75, 5, 95));
  const [churn, setChurn] = useState(clamp(p.monthlyChurnPct ?? 3, 0.2, 20));

  const lifetimeMonths = 100 / churn; // 1/churn, churn in %/month
  const monthlyContribution = arpu * (gm / 100);
  const ltv = monthlyContribution * lifetimeMonths;
  const ratio = cac > 0 ? ltv / cac : Infinity;
  const payback = monthlyContribution > 0 ? cac / monthlyContribution : Infinity;
  const ratioColor = ratio >= 3 ? BULL : ratio >= 1 ? HOLD : BEAR;

  return (
    <Shell>
      <div>
        <Slider label="Cost to acquire a customer (CAC)" value={cac} min={10} max={5000} step={10} onChange={setCac} format={fmtUSD} accent={BEAR} />
        <Slider label="Revenue per customer / month" value={arpu} min={1} max={1000} step={1} onChange={setArpu} format={fmtUSD} accent={ACCENT} />
        <Slider label="Gross margin" value={gm} min={5} max={95} step={1} onChange={setGm} format={(v) => `${v}%`} accent={BULL} />
        <Slider label="Monthly churn" value={churn} min={0.2} max={20} step={0.2} onChange={setChurn} format={(v) => `${v.toFixed(1)}%`} accent={HOLD} />
        <p style={{ fontSize: 12.5, color: MUTED, marginTop: 4 }}>
          A customer is only worth acquiring if the <strong style={{ color: INK }}>lifetime value</strong> clears the cost to win them — with room to spare. Rule of thumb: <strong style={{ color: INK }}>LTV/CAC ≥ 3</strong> and payback under a year.
        </p>
      </div>
      <div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Stat label="Lifetime value" value={fmtUSD(ltv)} accent={ACCENT} />
          <Stat label="LTV / CAC" value={Number.isFinite(ratio) ? `${ratio.toFixed(1)}×` : "∞"} accent={ratioColor} />
          <Stat label="Payback" value={Number.isFinite(payback) ? `${payback.toFixed(1)} mo` : "never"} accent={payback <= 12 ? BULL : payback <= 24 ? HOLD : BEAR} />
          <Stat label="Avg customer life" value={`${lifetimeMonths.toFixed(0)} mo`} accent={INK} />
        </div>
        <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
          <RecoveryBar label="Lifetime value" pct={ltv} max={Math.max(ltv, cac)} color={ACCENT} caption={fmtUSD(ltv)} />
          <RecoveryBar label="Cost to acquire" pct={cac} max={Math.max(ltv, cac)} color={BEAR} caption={fmtUSD(cac)} />
        </div>
        <p style={{ fontSize: 12, color: MUTED, marginTop: 12 }}>
          {ratio >= 3
            ? "Strong unit economics — each customer pays back the acquisition cost several times over."
            : ratio >= 1
              ? "Marginal: customers earn back more than they cost, but there's little cushion for churn or rising CAC."
              : "Broken: you lose money on every customer you buy. Growth here burns cash faster, not slower."}
        </p>
      </div>
    </Shell>
  );
}

// ── 10. Rule of 40 (SaaS growth + margin) ────────────────────────────────────

function RuleOf40Lab({ p }: { p: Record<string, number> }) {
  const [growth, setGrowth] = useState(clamp(p.revenueGrowthPct ?? 30, -20, 120));
  const [margin, setMargin] = useState(clamp(p.fcfMarginPct ?? 10, -50, 60));
  const score = growth + margin;
  const pass = score >= 40;
  const color = pass ? BULL : score >= 25 ? HOLD : BEAR;

  return (
    <Shell>
      <div>
        <Slider label="Revenue growth (YoY)" value={growth} min={-20} max={120} step={1} onChange={setGrowth} format={(v) => `${v >= 0 ? "+" : ""}${v}%`} accent={ACCENT} />
        <Slider label="Free-cash-flow margin" value={margin} min={-50} max={60} step={1} onChange={setMargin} format={(v) => `${v >= 0 ? "+" : ""}${v}%`} accent={margin >= 0 ? BULL : BEAR} />
        <p style={{ fontSize: 12.5, color: MUTED, marginTop: 4 }}>
          The <strong style={{ color: INK }}>Rule of 40</strong>: a healthy software business&apos;s growth rate plus its profit margin should clear 40. It encodes the trade — you may burn for growth, or grow slower and print cash, but the sum has to hold.
        </p>
      </div>
      <div>
        <Stat label="Growth + margin" value={`${score >= 0 ? "+" : ""}${score.toFixed(0)}`} accent={color} />
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 12, color: MUTED, marginBottom: 8 }}>Score vs the 40 line</div>
          <div style={{ position: "relative", height: 26, borderRadius: 6, background: "rgba(232,237,248,0.06)", overflow: "hidden", border: BORDER }}>
            <div style={{ width: `${clamp(score, 0, 80) / 80 * 100}%`, height: "100%", background: color, transition: "width .25s ease" }} />
            <div style={{ position: "absolute", top: 0, bottom: 0, left: `${40 / 80 * 100}%`, width: 2, background: INK, opacity: 0.7 }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontFamily: MONO, fontSize: 10.5, color: MUTED }}>
            <span>0</span><span>40 (the bar)</span><span>80</span>
          </div>
        </div>
        <p style={{ fontSize: 12, color: MUTED, marginTop: 14 }}>
          {pass
            ? "Above 40 — the growth-vs-profitability balance is healthy by this heuristic."
            : "Below 40 — either growth or margin (or both) is too low to justify the other."}
        </p>
      </div>
    </Shell>
  );
}

// ── 11. Operating leverage ────────────────────────────────────────────────────

function OperatingLeverageLab({ p }: { p: Record<string, number> }) {
  const [revenue, setRevenue] = useState(clamp(p.revenue ?? 1000, 100, 100000));
  const [fixed, setFixed] = useState(clamp(p.fixedCosts ?? 550, 0, 100000));
  const [varPct, setVarPct] = useState(clamp(p.variableCostPct ?? 30, 0, 90));
  const [chg, setChg] = useState(clamp(p.revenueChangePct ?? 10, -50, 50));

  const cm = 1 - varPct / 100; // contribution margin
  const contribution = revenue * cm;
  const profit = contribution - fixed;
  const breakeven = cm > 0 ? fixed / cm : Infinity;
  const newProfit = revenue * (1 + chg / 100) * cm - fixed;
  const profitChangePct = profit !== 0 ? ((newProfit - profit) / Math.abs(profit)) * 100 : 0;
  const amplification = chg !== 0 ? profitChangePct / chg : 0;
  const profitColor = profit >= 0 ? BULL : BEAR;

  const variableCost = revenue * (varPct / 100);
  const total = Math.max(revenue, 1);
  const seg = [
    { label: "Fixed", val: Math.min(fixed, total), color: HOLD },
    { label: "Variable", val: variableCost, color: MUTED },
    { label: profit >= 0 ? "Profit" : "Loss", val: Math.abs(profit), color: profitColor },
  ];

  return (
    <Shell>
      <div>
        <Slider label="Revenue" value={revenue} min={100} max={100000} step={50} onChange={setRevenue} format={fmtUSD} accent={ACCENT} />
        <Slider label="Fixed costs" value={fixed} min={0} max={100000} step={50} onChange={setFixed} format={fmtUSD} accent={HOLD} />
        <Slider label="Variable cost (% of revenue)" value={varPct} min={0} max={90} step={1} onChange={setVarPct} format={(v) => `${v}%`} accent={MUTED} />
        <Slider label="If revenue changes by…" value={chg} min={-50} max={50} step={1} onChange={setChg} format={(v) => `${v >= 0 ? "+" : ""}${v}%`} accent={BULL} />
        <p style={{ fontSize: 12.5, color: MUTED, marginTop: 4 }}>
          High fixed costs mean each extra sale is mostly profit — so revenue swings get <strong style={{ color: INK }}>amplified</strong> on the way down to earnings. Past breakeven that&apos;s a tailwind; below it, a trap.
        </p>
      </div>
      <div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Stat label="Operating profit" value={fmtUSD(profit)} accent={profitColor} />
          <Stat label="Breakeven revenue" value={Number.isFinite(breakeven) ? fmtUSD(breakeven) : "—"} accent={HOLD} />
        </div>
        <div style={{ display: "flex", height: 30, borderRadius: 8, overflow: "hidden", border: BORDER, marginTop: 16 }}>
          {seg.map((s) => (
            <div key={s.label} style={{ width: `${(s.val / total) * 100}%`, background: s.color, transition: "width .25s ease" }} title={`${s.label}: ${fmtUSD(s.val)}`} />
          ))}
        </div>
        <p style={{ fontSize: 13, color: MUTED, marginTop: 14, lineHeight: 1.5 }}>
          A <strong style={{ color: INK }}>{chg >= 0 ? "+" : ""}{chg}%</strong> revenue move becomes a{" "}
          <strong style={{ color: profitChangePct >= 0 ? BULL : BEAR }}>{profitChangePct >= 0 ? "+" : ""}{Number.isFinite(profitChangePct) ? profitChangePct.toFixed(0) : "∞"}%</strong>{" "}
          move in profit — <strong style={{ color: INK }}>{Number.isFinite(amplification) ? Math.abs(amplification).toFixed(1) : "∞"}×</strong> leverage.
        </p>
      </div>
    </Shell>
  );
}

// ── 12. Dilution (stock-based comp eroding ownership) ─────────────────────────

function DilutionLab({ p }: { p: Record<string, number> }) {
  const [dilution, setDilution] = useState(clamp(p.annualDilutionPct ?? 4, 0, 15));
  const [years, setYears] = useState(clamp(Math.round(p.years ?? 10), 1, 25));
  const [stake, setStake] = useState(clamp(p.startStakePct ?? 1, 0.01, 50));

  const series = useMemo(() => {
    const pts: number[] = [];
    for (let y = 0; y <= years; y++) pts.push(stake / Math.pow(1 + dilution / 100, y));
    return pts;
  }, [dilution, years, stake]);

  const finalStake = series[series.length - 1];
  const erosion = stake > 0 ? (1 - finalStake / stake) * 100 : 0;
  const color = erosion < 15 ? BULL : erosion < 35 ? HOLD : BEAR;

  return (
    <Shell>
      <div>
        <Slider label="Net share growth / year (SBC + issuance)" value={dilution} min={0} max={15} step={0.5} onChange={setDilution} format={(v) => `${v}%`} accent={BEAR} />
        <Slider label="Years held" value={years} min={1} max={25} step={1} onChange={setYears} format={(v) => `${v} yr`} accent={ACCENT} />
        <Slider label="Your starting ownership" value={stake} min={0.01} max={50} step={0.01} onChange={setStake} format={(v) => `${v.toFixed(2)}%`} accent={ACCENT} />
        <p style={{ fontSize: 12.5, color: MUTED, marginTop: 4 }}>
          Stock-based comp isn&apos;t free — it&apos;s paid in <em>your</em> ownership. Every new share dilutes your slice of the same profits. Buybacks have to outrun this just to keep you even.
        </p>
      </div>
      <div>
        <MiniLine series={series} color={color} format={(v) => `${v.toFixed(2)}%`} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 16 }}>
          <Stat label={`Ownership after ${years} yr`} value={`${finalStake.toFixed(3)}%`} accent={color} />
          <Stat label="Of your stake, lost to dilution" value={`−${erosion.toFixed(0)}%`} accent={color} />
        </div>
        <p style={{ fontSize: 12, color: MUTED, marginTop: 12 }}>
          Same company, same earnings — but your claim on them shrank {erosion.toFixed(0)}% without you selling a share.
        </p>
      </div>
    </Shell>
  );
}

// ── 13. Earnings yield vs the risk-free rate (the Fed model) ──────────────────

function EarningsYieldLab({ p }: { p: Record<string, number> }) {
  const [pe, setPe] = useState(clamp(p.peRatio ?? 20, 4, 80));
  const [bond, setBond] = useState(clamp(p.bondYieldPct ?? 4.2, 0, 12));
  const ey = 100 / pe;
  const spread = ey - bond;
  const color = spread > 1 ? BULL : spread > -1 ? HOLD : BEAR;

  return (
    <Shell>
      <div>
        <Slider label="P/E ratio" value={pe} min={4} max={80} step={0.5} onChange={setPe} format={(v) => `${v.toFixed(1)}×`} accent={ACCENT} />
        <Slider label="10-year Treasury yield" value={bond} min={0} max={12} step={0.1} onChange={setBond} format={(v) => `${v.toFixed(1)}%`} accent={HOLD} />
        <p style={{ fontSize: 12.5, color: MUTED, marginTop: 4 }}>
          Flip the P/E and you get the <strong style={{ color: INK }}>earnings yield</strong> — what the business earns per dollar of price. Compare it to a risk-free bond: the gap is roughly what you&apos;re paid for taking equity risk.
        </p>
      </div>
      <div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Stat label="Earnings yield (1/PE)" value={`${ey.toFixed(1)}%`} accent={ACCENT} />
          <Stat label="Equity risk premium" value={`${spread >= 0 ? "+" : ""}${spread.toFixed(1)}%`} accent={color} />
        </div>
        <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
          <RecoveryBar label="Stock earnings yield" pct={ey} max={Math.max(ey, bond, 1)} color={ACCENT} caption={`${ey.toFixed(1)}%`} />
          <RecoveryBar label="Risk-free bond yield" pct={bond} max={Math.max(ey, bond, 1)} color={HOLD} caption={`${bond.toFixed(1)}%`} />
        </div>
        <p style={{ fontSize: 12, color: MUTED, marginTop: 12 }}>
          {spread > 1
            ? "Stocks out-yield bonds by a healthy margin here — you're being paid for the risk."
            : spread > -1
              ? "Thin premium: equities barely out-yield the risk-free rate, so the cushion for disappointment is small."
              : "Bonds out-yield this stock's earnings — a rich valuation that needs strong growth to make sense."}
        </p>
      </div>
    </Shell>
  );
}

// ── 14. Margin of safety (price vs conservative value) ────────────────────────

function MarginOfSafetyLab({ p }: { p: Record<string, number> }) {
  const [value, setValue] = useState(clamp(p.intrinsicValue ?? 100, 5, 1000));
  const [price, setPrice] = useState(clamp(p.price ?? 70, 1, 1000));
  const [err, setErr] = useState(clamp(p.errorPct ?? 25, 0, 60));

  const discount = value > 0 ? ((value - price) / value) * 100 : 0; // % below value
  const upside = price > 0 ? ((value - price) / price) * 100 : 0;
  const worst = value * (1 - err / 100);
  const protection = price > 0 ? ((worst - price) / price) * 100 : 0;
  const safe = price <= worst;
  const color = safe ? BULL : discount > 0 ? HOLD : BEAR;

  return (
    <Shell>
      <div>
        <Slider label="Your estimate of intrinsic value" value={value} min={5} max={1000} step={5} onChange={setValue} format={fmtUSD} accent={BULL} />
        <Slider label="Price you'd pay" value={price} min={1} max={1000} step={1} onChange={setPrice} format={fmtUSD} accent={ACCENT} />
        <Slider label="How wrong your estimate could be" value={err} min={0} max={60} step={1} onChange={setErr} format={(v) => `±${v}%`} accent={HOLD} />
        <p style={{ fontSize: 12.5, color: MUTED, marginTop: 4 }}>
          The margin of safety is the gap between price and a <em>conservative</em> value. Buy far enough below value and even a wrong estimate can still leave you whole.
        </p>
      </div>
      <div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Stat label="Price vs value" value={`${Math.abs(Math.round(discount))}% ${discount >= 0 ? "below" : "above"}`} accent={color} />
          <Stat label="Upside if right" value={`${upside >= 0 ? "+" : ""}${upside.toFixed(0)}%`} accent={upside >= 0 ? BULL : BEAR} />
        </div>
        <div style={{ marginTop: 16, display: "grid", gap: 10 }}>
          <RecoveryBar label="Your value estimate" pct={value} max={Math.max(value, price)} color={BULL} caption={fmtUSD(value)} />
          <RecoveryBar label="Conservative (haircut) value" pct={worst} max={Math.max(value, price)} color={HOLD} caption={fmtUSD(worst)} />
          <RecoveryBar label="Price paid" pct={price} max={Math.max(value, price)} color={ACCENT} caption={fmtUSD(price)} />
        </div>
        <p style={{ fontSize: 12, color: MUTED, marginTop: 12 }}>
          {safe
            ? "Even if you're too optimistic by the full haircut, the price still sits below value — that's a real margin of safety."
            : discount > 0
              ? "You're paying below your estimate, but not below the worst case — the cushion may not survive a wrong estimate."
              : "You're paying at or above your own estimate. There's no margin of safety here."}
        </p>
      </div>
    </Shell>
  );
}

// ── 15. Inflation & real return ───────────────────────────────────────────────

function InflationRealReturnLab({ p }: { p: Record<string, number> }) {
  const [nominal, setNominal] = useState(clamp(p.nominalReturnPct ?? 7, -5, 25));
  const [inflation, setInflation] = useState(clamp(p.inflationPct ?? 3, 0, 15));
  const [years, setYears] = useState(clamp(Math.round(p.years ?? 25), 1, 40));
  const start = clamp(p.startingAmount ?? 10000, 100, 1_000_000);

  const real = ((1 + nominal / 100) / (1 + inflation / 100) - 1) * 100;
  const series = useMemo(() => {
    const nom: number[] = [];
    const rl: number[] = [];
    for (let y = 0; y <= years; y++) {
      const n = start * Math.pow(1 + nominal / 100, y);
      nom.push(n);
      rl.push(n / Math.pow(1 + inflation / 100, y));
    }
    return { nom, rl };
  }, [nominal, inflation, years, start]);

  const endNom = series.nom[series.nom.length - 1];
  const endReal = series.rl[series.rl.length - 1];
  const color = real >= 0 ? BULL : BEAR;

  return (
    <Shell>
      <div>
        <Slider label="Nominal return / year" value={nominal} min={-5} max={25} step={0.5} onChange={setNominal} format={(v) => `${v}%`} accent={ACCENT} />
        <Slider label="Inflation / year" value={inflation} min={0} max={15} step={0.5} onChange={setInflation} format={(v) => `${v}%`} accent={BEAR} />
        <Slider label="Years" value={years} min={1} max={40} step={1} onChange={setYears} format={(v) => `${v} yr`} accent={ACCENT} />
        <p style={{ fontSize: 12.5, color: MUTED, marginTop: 4 }}>
          The number on your statement is <em>nominal</em>. What it buys is <strong style={{ color: INK }}>real</strong>. Inflation is a silent tax on every dollar that doesn&apos;t out-earn it.
        </p>
      </div>
      <div>
        <AreaChart series={series.nom} baseline={series.rl} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginTop: 16 }}>
          <Stat label="Nominal end value" value={fmtUSD(endNom)} accent={INK} />
          <Stat label="Real (today's $)" value={fmtUSD(endReal)} accent={color} />
          <Stat label="Real return / yr" value={`${real >= 0 ? "+" : ""}${real.toFixed(1)}%`} accent={color} />
        </div>
        <p style={{ fontSize: 12, color: MUTED, marginTop: 10 }}>
          The dashed line is what your money can actually <strong style={{ color: INK }}>buy</strong>. {real < 0 ? "Here inflation is outrunning your return — you're losing purchasing power." : "Staying above inflation is the whole game for long-term savers."}
        </p>
      </div>
    </Shell>
  );
}

// ── 16. Options payoff (call / put at expiry) ─────────────────────────────────

function OptionsPayoffLab({ p }: { p: Record<string, number> }) {
  const [isPut, setIsPut] = useState((p.isPut ?? 0) >= 1);
  const [strike, setStrike] = useState(clamp(p.strike ?? 100, 10, 500));
  const [premium, setPremium] = useState(clamp(p.premium ?? 6, 0.5, 100));

  const lo = strike * 0.4;
  const hi = strike * 1.6;
  const payoff = (spot: number) =>
    (isPut ? Math.max(strike - spot, 0) : Math.max(spot - strike, 0)) - premium;
  const breakeven = isPut ? strike - premium : strike + premium;

  const pts = useMemo(() => {
    const arr: { spot: number; pl: number }[] = [];
    const n = 48;
    for (let i = 0; i <= n; i++) {
      const spot = lo + (i / n) * (hi - lo);
      arr.push({ spot, pl: payoff(spot) });
    }
    return arr;
  }, [isPut, strike, premium]);

  return (
    <Shell>
      <div>
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          {(["Call", "Put"] as const).map((label, i) => {
            const active = (i === 1) === isPut;
            return (
              <button
                key={label}
                onClick={() => setIsPut(i === 1)}
                style={{
                  flex: 1,
                  background: active ? "rgba(79,135,247,0.16)" : "rgba(232,237,248,0.03)",
                  border: active ? "1px solid rgba(79,135,247,0.6)" : BORDER,
                  color: active ? ACCENT : MUTED,
                  borderRadius: 7, padding: "8px 0", fontFamily: MONO, fontSize: 12.5, fontWeight: 650, cursor: "pointer",
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
        <Slider label="Strike price" value={strike} min={10} max={500} step={5} onChange={setStrike} format={fmtUSD} accent={ACCENT} />
        <Slider label="Premium paid" value={premium} min={0.5} max={100} step={0.5} onChange={setPremium} format={fmtUSD} accent={HOLD} />
        <p style={{ fontSize: 12.5, color: MUTED, marginTop: 4 }}>
          A {isPut ? "put profits as the stock falls" : "call profits as the stock rises"} past the strike. Your loss is capped at the premium; the upside is {isPut ? "large" : "open-ended"}. That asymmetry is the whole point.
        </p>
      </div>
      <div>
        <PayoffChart pts={pts} breakeven={breakeven} lo={lo} hi={hi} premium={premium} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 16 }}>
          <Stat label="Max loss" value={fmtUSD(premium)} accent={BEAR} />
          <Stat label="Breakeven price" value={fmtUSD(breakeven)} accent={ACCENT} />
        </div>
        <p style={{ fontSize: 12, color: MUTED, marginTop: 10 }}>
          Below the dashed line you lose; above it the option pays. The most you can lose is the {fmtUSD(premium)} premium — no matter how wrong you are.
        </p>
      </div>
    </Shell>
  );
}

// ── 17. Loss aversion (prospect-theory value function) ────────────────────────

function LossAversionLab({ p }: { p: Record<string, number> }) {
  const [lambda, setLambda] = useState(clamp(p.lambda ?? 2.25, 1, 4));
  const [amount, setAmount] = useState(clamp(p.amount ?? 100, 10, 1000));
  const ALPHA = 0.88;
  const vGain = Math.pow(amount, ALPHA);
  const vLoss = lambda * Math.pow(amount, ALPHA);
  const feltRatio = vLoss / vGain;

  return (
    <Shell>
      <div>
        <Slider label="Loss-aversion λ (how much losses sting)" value={lambda} min={1} max={4} step={0.05} onChange={setLambda} format={(v) => `${v.toFixed(2)}×`} accent={BEAR} />
        <Slider label="Amount won or lost" value={amount} min={10} max={1000} step={10} onChange={setAmount} format={fmtUSD} accent={ACCENT} />
        <p style={{ fontSize: 12.5, color: MUTED, marginTop: 4 }}>
          Kahneman &amp; Tversky found losses hurt roughly <strong style={{ color: INK }}>2–2.5×</strong> more than equal gains feel good. The value curve is bent — and that bend drives panic-selling, holding losers, and refusing good bets.
        </p>
      </div>
      <div>
        <ValueFunctionChart lambda={lambda} alpha={ALPHA} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 16 }}>
          <Stat label={`Joy of +${fmtUSD(amount)}`} value={`+${vGain.toFixed(0)}`} accent={BULL} />
          <Stat label={`Pain of −${fmtUSD(amount)}`} value={`−${vLoss.toFixed(0)}`} accent={BEAR} />
        </div>
        <p style={{ fontSize: 12, color: MUTED, marginTop: 12 }}>
          The same {fmtUSD(amount)} feels <strong style={{ color: BEAR }}>{feltRatio.toFixed(1)}×</strong> worse to lose than to win. A 50/50 coin flip for equal stakes feels like a bad deal — even when it&apos;s fair.
        </p>
      </div>
    </Shell>
  );
}

// ── 18. Rebalancing (discipline vs drift) ─────────────────────────────────────

function RebalancingLab({ p }: { p: Record<string, number> }) {
  const [target, setTarget] = useState(clamp(p.targetStockPct ?? 60, 0, 100));
  const [swing, setSwing] = useState(clamp(p.swingPct ?? 22, 5, 45));
  const years = clamp(Math.round(p.years ?? 12), 4, 20);

  const sim = useMemo(() => {
    // Deterministic choppy stock path (mean-reverting), steady bonds.
    const stockR: number[] = [];
    for (let y = 0; y < years; y++) stockR.push((swing / 100) * Math.sin(y * 1.3) + 0.04);
    const bondR = 0.025;
    let driftS = target, driftB = 100 - target; // drift: never rebalanced
    let rebal = 100; // rebalanced total, reset to target each year
    const driftPath: number[] = [100];
    const rebalPath: number[] = [100];
    for (let y = 0; y < years; y++) {
      driftS *= 1 + stockR[y];
      driftB *= 1 + bondR;
      driftPath.push(driftS + driftB);
      const rs = rebal * (target / 100) * (1 + stockR[y]);
      const rb = rebal * (1 - target / 100) * (1 + bondR);
      rebal = rs + rb; // then conceptually reset to target next loop
      rebalPath.push(rebal);
    }
    return { driftPath, rebalPath };
  }, [target, swing, years]);

  const endDrift = sim.driftPath[sim.driftPath.length - 1];
  const endRebal = sim.rebalPath[sim.rebalPath.length - 1];
  const bonus = endRebal - endDrift;

  return (
    <Shell>
      <div>
        <Slider label="Target stock allocation" value={target} min={0} max={100} step={5} onChange={setTarget} format={(v) => `${v}%`} accent={ACCENT} />
        <Slider label="How choppy the market is" value={swing} min={5} max={45} step={1} onChange={setSwing} format={(v) => `±${v}%`} accent={HOLD} />
        <p style={{ fontSize: 12.5, color: MUTED, marginTop: 4 }}>
          Rebalancing forces you to trim what ran and add to what lagged — buying low and selling high on autopilot. In choppy, mean-reverting markets that discipline quietly adds return.
        </p>
      </div>
      <div>
        <TwoLine a={sim.rebalPath} b={sim.driftPath} aColor={ACCENT} bColor={MUTED} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 16 }}>
          <Stat label="Rebalanced" value={`${endRebal.toFixed(0)}`} accent={ACCENT} />
          <Stat label="Left to drift" value={`${endDrift.toFixed(0)}`} accent={MUTED} />
        </div>
        <p style={{ fontSize: 12, color: MUTED, marginTop: 12 }}>
          {bonus >= 0
            ? `The rebalanced book ends ${bonus.toFixed(0)} ahead — the "rebalancing bonus" from harvesting volatility.`
            : "In a strong one-way trend, letting winners run can beat rebalancing — the bonus isn't guaranteed."}
        </p>
      </div>
    </Shell>
  );
}

// ── 19. Sequence-of-returns risk ──────────────────────────────────────────────

function SequenceRiskLab({ p }: { p: Record<string, number> }) {
  const [start, setStart] = useState(clamp(p.startBalance ?? 100000, 10000, 2_000_000));
  const [withdrawPct, setWithdrawPct] = useState(clamp(p.withdrawalPct ?? 5, 0, 12));

  const sim = useMemo(() => {
    // Same multiset of returns, two orders. Crashes early vs late.
    const good = [0.22, 0.15, 0.1, 0.08, -0.12, 0.05, -0.05, 0.18, 0.12, -0.2];
    const bad = [...good].reverse();
    const draw = start * (withdrawPct / 100);
    const run = (seq: number[]) => {
      let bal = start;
      const path: number[] = [bal];
      for (const r of seq) {
        bal = bal * (1 + r) - draw;
        path.push(Math.max(0, bal));
      }
      return path;
    };
    return { goodPath: run(good), badPath: run(bad) };
  }, [start, withdrawPct]);

  const endGood = sim.goodPath[sim.goodPath.length - 1];
  const endBad = sim.badPath[sim.badPath.length - 1];

  return (
    <Shell>
      <div>
        <Slider label="Starting balance" value={start} min={10000} max={2_000_000} step={10000} onChange={setStart} format={fmtUSD} accent={ACCENT} />
        <Slider label="Withdrawn each year" value={withdrawPct} min={0} max={12} step={0.5} onChange={setWithdrawPct} format={(v) => `${v}%`} accent={HOLD} />
        <p style={{ fontSize: 12.5, color: MUTED, marginTop: 4 }}>
          Both paths have the <strong style={{ color: INK }}>identical</strong> set of returns — just in opposite order. When you&apos;re withdrawing, an early crash is far more dangerous than a late one: you sell more shares at the bottom.
        </p>
      </div>
      <div>
        <TwoLine a={sim.goodPath} b={sim.badPath} aColor={BULL} bColor={BEAR} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 16 }}>
          <Stat label="Good years first" value={fmtUSD(endGood)} accent={BULL} />
          <Stat label="Bad years first" value={fmtUSD(endBad)} accent={endBad <= 0 ? BEAR : HOLD} />
        </div>
        <p style={{ fontSize: 12, color: MUTED, marginTop: 12 }}>
          Same average return, same withdrawals — but order alone changes the outcome by{" "}
          <strong style={{ color: INK }}>{endGood > 0 ? `${(endGood / Math.max(endBad, 1)).toFixed(1)}×` : "—"}</strong>. That&apos;s sequence risk.
        </p>
      </div>
    </Shell>
  );
}

// ── Small shared charts for the new widgets ───────────────────────────────────

function MiniLine({ series, color, format }: { series: number[]; color: string; format: (v: number) => string }) {
  const W = 460, H = 200, pad = 10;
  const max = Math.max(...series, 0.0001);
  const min = Math.min(...series, 0);
  const span = Math.max(max - min, 0.0001);
  const n = series.length;
  const x = (i: number) => pad + (i / Math.max(1, n - 1)) * (W - pad * 2);
  const y = (v: number) => H - pad - ((v - min) / span) * (H - pad * 2);
  const line = series.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }} role="img" aria-label="Trend">
      <path d={`${line} L${x(n - 1).toFixed(1)},${H - pad} L${x(0).toFixed(1)},${H - pad} Z`} fill={`${color}1f`} />
      <path d={line} fill="none" stroke={color} strokeWidth={2.5} />
      <text x={x(n - 1)} y={y(series[n - 1]) - 8} fontFamily={MONO} fontSize={12} fill={color} textAnchor="end" fontWeight={650}>{format(series[n - 1])}</text>
    </svg>
  );
}

function TwoLine({ a, b, aColor, bColor }: { a: number[]; b: number[]; aColor: string; bColor: string }) {
  const W = 460, H = 210, pad = 10;
  const all = [...a, ...b];
  const max = Math.max(...all, 1);
  const n = Math.max(a.length, b.length);
  const x = (i: number) => pad + (i / Math.max(1, n - 1)) * (W - pad * 2);
  const y = (v: number) => H - pad - (v / max) * (H - pad * 2);
  const path = (arr: number[]) => arr.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }} role="img" aria-label="Comparison">
      <path d={path(b)} fill="none" stroke={bColor} strokeWidth={2.25} strokeDasharray="4 4" />
      <path d={path(a)} fill="none" stroke={aColor} strokeWidth={2.75} />
    </svg>
  );
}

function PayoffChart({ pts, breakeven, lo, hi, premium }: { pts: { spot: number; pl: number }[]; breakeven: number; lo: number; hi: number; premium: number }) {
  const W = 460, H = 220, pad = 12;
  const pls = pts.map((p) => p.pl);
  const maxPl = Math.max(...pls, premium);
  const minPl = Math.min(...pls, -premium);
  const span = Math.max(maxPl - minPl, 0.0001);
  const x = (spot: number) => pad + ((spot - lo) / (hi - lo)) * (W - pad * 2);
  const y = (pl: number) => H - pad - ((pl - minPl) / span) * (H - pad * 2);
  const zeroY = y(0);
  const line = pts.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.spot).toFixed(1)},${y(p.pl).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }} role="img" aria-label="Option payoff at expiry">
      <line x1={pad} y1={zeroY} x2={W - pad} y2={zeroY} stroke="rgba(232,237,248,0.25)" strokeWidth={1.25} strokeDasharray="4 4" />
      <line x1={x(breakeven)} y1={pad} x2={x(breakeven)} y2={H - pad} stroke={ACCENT} strokeWidth={1} strokeDasharray="3 4" opacity={0.6} />
      <path d={line} fill="none" stroke={BULL} strokeWidth={2.75} />
      <text x={x(breakeven)} y={H - 2} fontFamily={MONO} fontSize={10.5} fill={ACCENT} textAnchor="middle">breakeven</text>
    </svg>
  );
}

function ValueFunctionChart({ lambda, alpha }: { lambda: number; alpha: number }) {
  const W = 460, H = 220, pad = 14;
  const R = 100; // domain ±R
  const vmax = lambda * Math.pow(R, alpha);
  const x = (g: number) => pad + ((g + R) / (2 * R)) * (W - pad * 2);
  const y = (v: number) => H / 2 - (v / vmax) * (H / 2 - pad);
  const pts: string[] = [];
  for (let g = -R; g <= R; g += 4) {
    const v = g >= 0 ? Math.pow(g, alpha) : -lambda * Math.pow(-g, alpha);
    pts.push(`${x(g).toFixed(1)},${y(v).toFixed(1)}`);
  }
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }} role="img" aria-label="Prospect-theory value function">
      <line x1={pad} y1={H / 2} x2={W - pad} y2={H / 2} stroke="rgba(232,237,248,0.2)" strokeWidth={1.25} />
      <line x1={W / 2} y1={pad} x2={W / 2} y2={H - pad} stroke="rgba(232,237,248,0.2)" strokeWidth={1.25} />
      <polyline points={pts.join(" ")} fill="none" stroke={ACCENT} strokeWidth={2.75} />
      <text x={W - pad} y={H / 2 - 8} fontFamily={MONO} fontSize={10.5} fill={BULL} textAnchor="end">gains →</text>
      <text x={pad} y={H / 2 + 18} fontFamily={MONO} fontSize={10.5} fill={BEAR}>← losses</text>
    </svg>
  );
}

// ── Registry ─────────────────────────────────────────────────────────────────

const REGISTRY: Record<WidgetType, (props: { p: Record<string, number> }) => React.ReactElement> = {
  compound_interest: CompoundInterestLab,
  budget_split: BudgetSplitter,
  diversification: DiversificationMeter,
  dollar_cost_averaging: DollarCostAveraging,
  position_sizing: PositionSizingLab,
  drawdown_recovery: DrawdownRecovery,
  expected_value: ExpectedValueLab,
  reverse_dcf: ReverseDcfLab,
  ltv_cac: LtvCacLab,
  rule_of_40: RuleOf40Lab,
  operating_leverage: OperatingLeverageLab,
  dilution: DilutionLab,
  earnings_yield: EarningsYieldLab,
  margin_of_safety: MarginOfSafetyLab,
  inflation_real_return: InflationRealReturnLab,
  options_payoff: OptionsPayoffLab,
  loss_aversion: LossAversionLab,
  rebalancing: RebalancingLab,
  sequence_risk: SequenceRiskLab,
};

export function LessonWidgetRenderer({ widget }: { widget: LessonWidget }) {
  const Cmp = REGISTRY[widget.type];
  if (!Cmp) return null;
  return (
    <section
      style={{
        background: CARD,
        border: BORDER,
        borderRadius: 8,
        padding: "22px 24px",
        margin: "28px 0",
        fontFamily: SANS,
      }}
    >
      <style>{`
        @media (max-width: 780px) {
          .learn-widget-shell { grid-template-columns: 1fr !important; }
        }
      `}</style>
      <div style={{ color: MUTED, fontFamily: MONO, fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 8 }}>
        Interactive
      </div>
      <h3 style={{ margin: "0 0 6px", fontFamily: SERIF, fontSize: 19, fontWeight: 600, color: INK, letterSpacing: 0 }}>
        {widget.title}
      </h3>
      <p style={{ margin: "0 0 20px", fontFamily: SERIF, fontSize: 14.5, color: MUTED, lineHeight: 1.55 }}>{widget.prompt}</p>
      <Cmp p={widget.params} />
    </section>
  );
}

function clamp(v: number, min: number, max: number): number {
  if (!Number.isFinite(v)) return min;
  return Math.max(min, Math.min(max, v));
}
