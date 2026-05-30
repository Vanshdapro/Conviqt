"use client";

// Conviqt Learn — interactive simulators.
//
// These are the "play with it" moments that make a lesson stick. The author
// model picks ONE widget type per lesson and supplies starting params; these
// trusted components own all the math and interactivity. Nothing here evals
// model output — params are numbers only.

import { useMemo, useState } from "react";
import type { LessonWidget, WidgetType } from "@/lib/learn/types";

const ACCENT = "#4f87f7"; // Conviqt electric blue
const BULL = "#22c55e";
const HOLD = "#f59e0b";
const BEAR = "#ef4444";
const INK = "#e8edf8";
const MUTED = "#7a92b8";
const CARD = "rgba(255,255,255,0.022)";
const BORDER = "1px solid rgba(232,237,248,0.08)";
const MONO = "var(--font-mono), 'JetBrains Mono', monospace";
const SERIF = "var(--font-serif), 'Source Serif 4', Georgia, serif";
const DISPLAY = "var(--font-display), 'Playfair Display', Georgia, serif";

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
        <span style={{ fontSize: 12.5, letterSpacing: "0.04em", color: MUTED }}>{label}</span>
        <span style={{ fontFamily: "monospace", fontSize: 13, color: accent, fontWeight: 600 }}>
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
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0,1fr) minmax(0,1.1fr)",
        gap: 28,
        alignItems: "center",
      }}
    >
      {children}
    </div>
  );
}

function Stat({ label, value, accent = INK }: { label: string; value: string; accent?: string }) {
  return (
    <div style={{ background: CARD, border: BORDER, borderRadius: 12, padding: "12px 14px" }}>
      <div style={{ fontSize: 10.5, letterSpacing: "0.1em", textTransform: "uppercase", color: MUTED, marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontFamily: "monospace", fontSize: 19, fontWeight: 700, color: accent }}>{value}</div>
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
          <span style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: MUTED }}>Risk feels</span>
          <div style={{ fontFamily: "monospace", fontSize: 22, fontWeight: 700, color }}>{label}</div>
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
          <div style={{ fontSize: 10.5, letterSpacing: "0.1em", textTransform: "uppercase", color: MUTED, marginBottom: 8 }}>
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
        <span style={{ fontFamily: "monospace", fontSize: 13, fontWeight: 700, color }}>{caption}</span>
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
          <div style={{ fontSize: 10.5, letterSpacing: "0.1em", textTransform: "uppercase", color: MUTED, marginBottom: 10 }}>
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
        <span style={{ fontFamily: "monospace", fontSize: 12.5, fontWeight: 700, color }}>{value >= 0 ? "+" : ""}{value}%</span>
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
          <div style={{ fontSize: 10.5, letterSpacing: "0.1em", textTransform: "uppercase", color: MUTED, marginBottom: 10 }}>
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
};

export function LessonWidgetRenderer({ widget }: { widget: LessonWidget }) {
  const Cmp = REGISTRY[widget.type];
  if (!Cmp) return null;
  return (
    <section
      style={{
        background: "linear-gradient(180deg, rgba(79,135,247,0.05), rgba(255,255,255,0.012))",
        border: "1px solid rgba(79,135,247,0.2)",
        borderRadius: 16,
        padding: "26px 28px",
        margin: "28px 0",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", color: ACCENT }}>
          Interactive
        </span>
      </div>
      <h3 style={{ margin: "2px 0 4px", fontSize: 20, fontWeight: 500, color: INK, fontFamily: DISPLAY, letterSpacing: "-0.01em" }}>
        {widget.title}
      </h3>
      <p style={{ fontFamily: SERIF, margin: "0 0 20px", fontSize: 14, color: MUTED }}>{widget.prompt}</p>
      <Cmp p={widget.params} />
    </section>
  );
}

function clamp(v: number, min: number, max: number): number {
  if (!Number.isFinite(v)) return min;
  return Math.max(min, Math.min(max, v));
}
