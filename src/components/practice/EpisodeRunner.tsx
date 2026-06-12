"use client";

import { useMemo, useState } from "react";
import { PriceChart, type ChartMarker } from "./PriceChart";
import { Debrief, type EpisodeResult } from "./Debrief";
import { ArrowRightIcon, ArrowLeftIcon, TrendingUpIcon, TrendingDownIcon, ShieldIcon, FlagIcon } from "./icons";

const SURFACE = "var(--bg-surface)";
const SURFACE_SOFT = "var(--bg-surface)";
const BORDER = "var(--border)";
const RULE = "var(--border)";
const INK = "var(--text)";
const MUTED = "var(--text-2)";
const FAINT = "var(--text-muted)";
const ACCENT = "var(--accent)";
const GOOD = "var(--up-ink)";
const BAD = "var(--down-ink)";
const CREDIT = "var(--accent)";
const MONO = "var(--font-ui)";
const SANS = "var(--font-ui)";
const DISPLAY = "var(--font-display)";
const SERIF = "var(--font-ui)";

interface PlayEvent { atBar: number; headline: string; detail: string; tone: "bull" | "bear" | "neutral"; }
interface PlayBar { t: string; close: number; halted?: boolean; }
export interface PlayEpisode {
  ticker: string; company: string; period: string; briefing: string;
  startingCash: number; startingShares: number; startingCostBasis: number;
  bars: PlayBar[]; events: PlayEvent[];
  sourceUrl: string; sourceLabel: string; priceNote: string | null;
}
export interface PlayDrill {
  id: string; kind: "episode"; title: string; hook: string; difficulty: string;
  xp: number; tier: number; conceptTags: string[]; conceptLessonIds: string[];
  episode: PlayEpisode;
}

interface ManualAction { atBar: number; side: "buy" | "sell"; shares: number; stop?: number; target?: number; }
interface AutoFill { bar: number; kind: "stop" | "target" | "halt"; shares: number; price: number; }
interface LiveState { cash: number; shares: number; stop: number; target: number; avgCost: number; equity: number; autoFills: AutoFill[]; }

const EPS = 1e-9;

// Client mirror of lib/practice/engine.ts, but stepped to a given bar and WITHOUT
// the final force-liquidation (the live desk keeps the open position visible;
// the server liquidates only when grading). Equity matches the server at every bar.
function replayTo(ep: PlayEpisode, actions: ManualAction[], cur: number): LiveState {
  let cash = ep.startingCash;
  let shares = ep.startingShares || 0;
  let basis = (ep.startingShares || 0) * (ep.startingCostBasis || 0);
  let stop = 0, target = 0;
  const autoFills: AutoFill[] = [];
  const end = Math.max(0, Math.min(cur, ep.bars.length - 1));

  for (let b = 0; b <= end; b++) {
    const close = ep.bars[b].close;
    for (const a of actions.filter((x) => x.atBar === b)) {
      if (a.side === "buy") {
        const affordable = close > 0 ? Math.floor(cash / close) : 0;
        const qty = Math.max(0, Math.min(Math.floor(a.shares), affordable));
        if (qty > 0) { cash -= qty * close; basis += qty * close; shares += qty; }
      } else {
        const qty = Math.max(0, Math.min(Math.floor(a.shares), shares));
        if (qty > 0) {
          const ac = shares > 0 ? basis / shares : 0;
          cash += qty * close; basis -= ac * qty; shares -= qty;
          if (shares === 0) basis = 0;
        }
      }
      if (typeof a.stop === "number") stop = a.stop;
      if (typeof a.target === "number") target = a.target;
    }
    if (shares > 0 && stop > 0 && close <= stop + EPS) {
      autoFills.push({ bar: b, kind: "stop", shares, price: close }); cash += shares * close; shares = 0; basis = 0; stop = 0; target = 0;
    } else if (shares > 0 && target > 0 && close >= target - EPS) {
      autoFills.push({ bar: b, kind: "target", shares, price: close }); cash += shares * close; shares = 0; basis = 0; stop = 0; target = 0;
    }
    if (ep.bars[b].halted && shares > 0) {
      autoFills.push({ bar: b, kind: "halt", shares, price: close }); cash += shares * close; shares = 0; basis = 0;
    }
  }
  const close = ep.bars[end].close;
  const avgCost = shares > 0 ? basis / shares : 0;
  return { cash, shares, stop, target, avgCost, equity: cash + shares * close, autoFills };
}

function usd(v: number): string {
  return v.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}
function px(v: number): string {
  return `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
const TONE_COLOR = { bull: GOOD, bear: BAD, neutral: MUTED };

export function EpisodeRunner({
  drill,
  onExit,
  onGraded,
}: {
  drill: PlayDrill;
  onExit: () => void;
  onGraded?: (stats: unknown) => void;
}) {
  const ep = drill.episode;
  const lastBar = ep.bars.length - 1;

  const [phase, setPhase] = useState<"briefing" | "trading" | "debrief">("briefing");
  const [cur, setCur] = useState(0);
  const [actions, setActions] = useState<ManualAction[]>([]);
  const [buyQty, setBuyQty] = useState("");
  const [sellQty, setSellQty] = useState("");
  const [stopVal, setStopVal] = useState("");
  const [targetVal, setTargetVal] = useState("");
  const [grading, setGrading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<EpisodeResult | null>(null);

  const startingEquity = ep.startingCash + (ep.startingShares || 0) * (ep.bars[0]?.close ?? 0);
  const live = useMemo(() => replayTo(ep, actions, cur), [ep, actions, cur]);
  const price = ep.bars[cur]?.close ?? 0;
  const halted = Boolean(ep.bars[cur]?.halted);
  const affordable = price > 0 ? Math.floor(live.cash / price) : 0;
  const positionValue = live.shares * price;
  const totalReturnPct = startingEquity > 0 ? (live.equity / startingEquity - 1) * 100 : 0;
  const unrealizedPct = live.shares > 0 && live.avgCost > 0 ? (price / live.avgCost - 1) * 100 : 0;
  const bookPct = live.equity > 0 ? (positionValue / live.equity) * 100 : 0;
  const fillsHere = live.autoFills.filter((f) => f.bar === cur);

  const tradeMarkers: ChartMarker[] = useMemo(() => {
    const m: ChartMarker[] = [];
    for (const a of actions) m.push({ index: a.atBar, kind: a.side });
    for (const f of live.autoFills) m.push({ index: f.bar, kind: f.kind === "target" ? "target" : "stop" });
    for (const e of ep.events) m.push({ index: e.atBar, kind: `event-${e.tone}` as ChartMarker["kind"] });
    return m;
  }, [actions, live.autoFills, ep.events]);

  function place(side: "buy" | "sell", shares: number) {
    if (shares <= 0 || halted) return;
    const a: ManualAction = { atBar: cur, side, shares };
    if (side === "buy") {
      const s = parseFloat(stopVal); const t = parseFloat(targetVal);
      if (Number.isFinite(s) && s > 0) a.stop = s;
      if (Number.isFinite(t) && t > 0) a.target = t;
    }
    setActions((prev) => [...prev, a]);
    setBuyQty(""); setSellQty("");
  }

  function advance() {
    setError(null);
    if (cur < lastBar) setCur(cur + 1);
  }

  async function finish() {
    setGrading(true);
    setError(null);
    try {
      const res = await fetch("/api/practice/episode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ drillId: drill.id, actions }),
      });
      if (res.status === 403) { setError("This drill is locked. Clear the earlier tier first."); return; }
      if (!res.ok) { setError("Couldn't grade that run. Try again in a moment."); return; }
      const data = (await res.json()) as EpisodeResult & { stats: unknown };
      setResult(data);
      setPhase("debrief");
      onGraded?.(data.stats);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setError("Connection dropped before grading. Your trades are safe — try Finish again.");
    } finally {
      setGrading(false);
    }
  }

  function replay() {
    setActions([]); setCur(0); setResult(null);
    setBuyQty(""); setSellQty(""); setStopVal(""); setTargetVal("");
    setError(null); setPhase("trading");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // ── DEBRIEF ────────────────────────────────────────────────────────────────
  if (phase === "debrief" && result) {
    return (
      <Debrief
        episode={{ ticker: ep.ticker, company: ep.company, bars: ep.bars }}
        result={result}
        onReplay={replay}
        onExit={onExit}
      />
    );
  }

  // ── BRIEFING ─────────────────────────────────────────────────────────────────
  if (phase === "briefing") {
    return (
      <div style={{ fontFamily: SANS, maxWidth: 760 }}>
        <button onClick={onExit} style={backLink}>
          <ArrowLeftIcon size={15} /> All drills
        </button>
        <div style={{ color: ACCENT, fontFamily: MONO, fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", margin: "20px 0 12px" }}>
          Tier {drill.tier} · {drill.difficulty} · {ep.ticker}
        </div>
        <h1 style={{ color: INK, fontFamily: DISPLAY, fontSize: 40, fontWeight: 500, letterSpacing: "-0.015em", lineHeight: 1.08, margin: "0 0 10px" }}>
          {drill.title}
        </h1>
        <div style={{ color: MUTED, fontFamily: MONO, fontSize: 12.5, marginBottom: 22 }}>
          {ep.company} · {ep.period}
        </div>
        <p style={{ color: INK, fontFamily: SERIF, fontSize: 17, lineHeight: 1.66, margin: "0 0 24px" }}>{ep.briefing}</p>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 24 }}>
          {drill.conceptTags.map((t) => (
            <span key={t} style={{ fontFamily: MONO, fontSize: 11, color: MUTED, background: SURFACE_SOFT, border: `1px solid ${BORDER}`, borderRadius: 100, padding: "5px 12px" }}>
              {t}
            </span>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px,1fr))", gap: 12, marginBottom: 22 }}>
          <Brief label="Starting cash" value={usd(ep.startingCash)} />
          {ep.startingShares > 0 && <Brief label="You already hold" value={`${ep.startingShares} sh @ ${px(ep.startingCostBasis)}`} />}
          <Brief label="Decisions" value={`${ep.bars.length} bars`} />
        </div>

        {ep.priceNote && (
          <p style={{ color: FAINT, fontFamily: MONO, fontSize: 11.5, lineHeight: 1.5, margin: "0 0 8px" }}>{ep.priceNote}</p>
        )}
        <a href={ep.sourceUrl} target="_blank" rel="noopener noreferrer" style={{ color: ACCENT, fontFamily: MONO, fontSize: 11.5, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6 }}>
          Price source: {ep.sourceLabel}<ArrowRightIcon size={12} />
        </a>

        <div style={{ marginTop: 30 }}>
          <button onClick={() => setPhase("trading")} style={primaryBtn(ACCENT)}>
            Start trading <ArrowRightIcon size={16} />
          </button>
        </div>
      </div>
    );
  }

  // ── TRADING ────────────────────────────────────────────────────────────────────
  const visibleEvents = ep.events.filter((e) => e.atBar <= cur).sort((a, b) => b.atBar - a.atBar);
  const onLast = cur >= lastBar;

  return (
    <div style={{ fontFamily: SANS }}>
      <style>{`
        .pr-num { -moz-appearance: textfield; }
        .pr-num::-webkit-outer-spin-button, .pr-num::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
        @media (max-width: 820px) { .pr-grid { grid-template-columns: 1fr !important; } }
      `}</style>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
        <div>
          <button onClick={onExit} style={backLink}><ArrowLeftIcon size={15} /> Exit drill</button>
          <h1 style={{ color: INK, fontFamily: DISPLAY, fontSize: 26, fontWeight: 500, margin: "10px 0 2px", letterSpacing: "-0.01em" }}>
            {drill.title}
          </h1>
          <div style={{ color: FAINT, fontFamily: MONO, fontSize: 12 }}>{ep.ticker} · {ep.company}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ color: FAINT, fontFamily: MONO, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase" }}>
            Bar {cur + 1} / {ep.bars.length}
          </div>
          <div style={{ color: INK, fontFamily: MONO, fontSize: 24, fontWeight: 700 }}>{px(price)}</div>
          <div style={{ color: MUTED, fontFamily: MONO, fontSize: 12 }}>{ep.bars[cur]?.t}</div>
        </div>
      </div>

      {/* progress dots */}
      <div style={{ display: "flex", gap: 4, marginBottom: 18 }}>
        {ep.bars.map((_, i) => (
          <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i <= cur ? ACCENT : "var(--bg-sunken)" }} />
        ))}
      </div>

      {/* chart */}
      <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 16, marginBottom: 14 }}>
        <PriceChart
          labels={ep.bars.map((b) => b.t)}
          series={[{ values: ep.bars.map((b) => b.close), color: ACCENT, label: ep.ticker }]}
          markers={tradeMarkers}
          revealedThrough={cur}
          height={300}
        />
      </div>

      {/* auto-fill banner */}
      {fillsHere.map((f, i) => (
        <div key={i} style={{ marginBottom: 14, background: f.kind === "target" ? "var(--accent-weak)" : "var(--accent-weak)", border: `1px solid ${f.kind === "target" ? "var(--accent)" : "var(--accent)"}`, borderRadius: 10, padding: "12px 16px", color: f.kind === "target" ? ACCENT : CREDIT, fontFamily: MONO, fontSize: 13 }}>
          {f.kind === "stop" && `Stop hit — sold ${f.shares} @ ${px(f.price)}.`}
          {f.kind === "target" && `Target hit — sold ${f.shares} @ ${px(f.price)}.`}
          {f.kind === "halt" && `Trading halted — position liquidated at ${px(f.price)}.`}
        </div>
      ))}

      <div className="pr-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
        {/* event feed */}
        <section style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 18, minHeight: 180 }}>
          <div style={{ color: FAINT, fontFamily: MONO, fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: 14 }}>The tape</div>
          {visibleEvents.length === 0 ? (
            <p style={{ color: FAINT, fontSize: 13.5, lineHeight: 1.5, margin: 0 }}>Quiet so far. Watch the price and manage your risk.</p>
          ) : (
            <div style={{ display: "grid", gap: 13 }}>
              {visibleEvents.map((e, i) => (
                <div key={i} style={{ opacity: e.atBar === cur ? 1 : 0.62 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                    <span style={{ width: 7, height: 7, borderRadius: 99, background: TONE_COLOR[e.tone], flexShrink: 0 }} />
                    <span style={{ color: INK, fontFamily: SERIF, fontSize: 14.5, fontWeight: 600 }}>{e.headline}</span>
                    <span style={{ color: FAINT, fontFamily: MONO, fontSize: 10, marginLeft: "auto" }}>{ep.bars[e.atBar]?.t}</span>
                  </div>
                  <p style={{ color: MUTED, fontSize: 13, lineHeight: 1.5, margin: "0 0 0 15px" }}>{e.detail}</p>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* portfolio */}
        <section style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 18 }}>
          <div style={{ color: FAINT, fontFamily: MONO, fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: 14 }}>Your book</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <Field label="Equity" value={usd(live.equity)} />
            <Field label="Total return" value={`${totalReturnPct >= 0 ? "+" : ""}${totalReturnPct.toFixed(1)}%`} color={totalReturnPct >= 0 ? GOOD : BAD} />
            <Field label="Cash" value={usd(live.cash)} />
            <Field label="Position" value={live.shares > 0 ? `${live.shares} sh` : "—"} />
          </div>
          {live.shares > 0 && (
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${RULE}`, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <Field label="Avg cost" value={px(live.avgCost)} small />
              <Field label="Open P&L" value={`${unrealizedPct >= 0 ? "+" : ""}${unrealizedPct.toFixed(1)}%`} color={unrealizedPct >= 0 ? GOOD : BAD} small />
              <Field label="% of book" value={`${bookPct.toFixed(0)}%`} small />
              <Field label="Stop / target" value={`${live.stop > 0 ? px(live.stop) : "—"} / ${live.target > 0 ? px(live.target) : "—"}`} small />
            </div>
          )}
        </section>
      </div>

      {/* order ticket */}
      {!halted && (
        <section style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 18, marginBottom: 14 }}>
          <div style={{ color: FAINT, fontFamily: MONO, fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: 14 }}>
            Order ticket · fills at {px(price)}
          </div>

          {/* BUY row */}
          <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap", marginBottom: 12 }}>
            <Labeled label="Buy (shares)">
              <input className="pr-num" inputMode="numeric" value={buyQty} onChange={(e) => setBuyQty(e.target.value.replace(/[^\d]/g, ""))} placeholder="0" style={inputStyle} />
            </Labeled>
            <Labeled label="Stop (opt)">
              <input className="pr-num" inputMode="decimal" value={stopVal} onChange={(e) => setStopVal(e.target.value.replace(/[^\d.]/g, ""))} placeholder="—" style={{ ...inputStyle, width: 90 }} />
            </Labeled>
            <Labeled label="Target (opt)">
              <input className="pr-num" inputMode="decimal" value={targetVal} onChange={(e) => setTargetVal(e.target.value.replace(/[^\d.]/g, ""))} placeholder="—" style={{ ...inputStyle, width: 90 }} />
            </Labeled>
            <button onClick={() => setBuyQty(String(Math.floor(affordable * 0.5)))} style={chipBtn} disabled={affordable <= 0}>50%</button>
            <button onClick={() => setBuyQty(String(affordable))} style={chipBtn} disabled={affordable <= 0}>Max</button>
            <button onClick={() => place("buy", parseInt(buyQty || "0", 10))} disabled={!buyQty || parseInt(buyQty, 10) <= 0} style={actionBtn(GOOD)}>
              <TrendingUpIcon size={15} /> Buy
            </button>
            <span style={{ color: FAINT, fontFamily: MONO, fontSize: 11, marginLeft: "auto" }}>
              Buying power: {affordable.toLocaleString()} sh
            </span>
          </div>

          {/* SELL row */}
          {live.shares > 0 && (
            <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap", paddingTop: 12, borderTop: `1px solid ${RULE}` }}>
              <Labeled label="Sell (shares)">
                <input className="pr-num" inputMode="numeric" value={sellQty} onChange={(e) => setSellQty(e.target.value.replace(/[^\d]/g, ""))} placeholder="0" style={inputStyle} />
              </Labeled>
              <button onClick={() => setSellQty(String(Math.floor(live.shares * 0.5)))} style={chipBtn}>50%</button>
              <button onClick={() => place("sell", parseInt(sellQty || "0", 10))} disabled={!sellQty || parseInt(sellQty, 10) <= 0} style={actionBtn(BAD)}>
                <TrendingDownIcon size={15} /> Sell
              </button>
              <button onClick={() => place("sell", live.shares)} style={actionBtn(CREDIT)}>
                Sell all
              </button>
            </div>
          )}
        </section>
      )}

      {error && (
        <div role="alert" style={{ marginBottom: 14, background: "var(--down-weak)", border: "1px solid var(--down)", color: "var(--down-ink)", borderRadius: 10, padding: "12px 14px", fontSize: 13.5 }}>
          {error}
        </div>
      )}

      {/* advance / finish */}
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        {!onLast ? (
          <button onClick={advance} style={primaryBtn(ACCENT)}>
            {live.shares > 0 ? "Hold & advance" : "Advance"} <ArrowRightIcon size={16} />
          </button>
        ) : (
          <button onClick={finish} disabled={grading} style={{ ...primaryBtn(GOOD), opacity: grading ? 0.7 : 1, cursor: grading ? "wait" : "pointer" }}>
            <FlagIcon size={16} /> {grading ? "Grading…" : "Finish & grade"}
          </button>
        )}
        <span style={{ color: FAINT, fontFamily: MONO, fontSize: 11.5, display: "inline-flex", alignItems: "center", gap: 6 }}>
          <ShieldIcon size={13} /> Graded on process first, P&L second.
        </span>
      </div>
    </div>
  );
}

function Brief({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 10, padding: "13px 15px" }}>
      <div style={{ color: FAINT, fontFamily: MONO, fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 6 }}>{label}</div>
      <div style={{ color: INK, fontFamily: MONO, fontSize: 15, fontWeight: 650 }}>{value}</div>
    </div>
  );
}

function Field({ label, value, color = INK, small }: { label: string; value: string; color?: string; small?: boolean }) {
  return (
    <div>
      <div style={{ color: FAINT, fontFamily: MONO, fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 5 }}>{label}</div>
      <div style={{ color, fontFamily: MONO, fontSize: small ? 14 : 18, fontWeight: 650 }}>{value}</div>
    </div>
  );
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{ color: FAINT, fontFamily: MONO, fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase" }}>{label}</span>
      {children}
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  width: 110, minHeight: 40, background: "var(--bg-sunken)", border: `1px solid ${BORDER}`,
  borderRadius: 8, color: INK, fontFamily: MONO, fontSize: 15, padding: "0 12px", outline: "none",
};
const chipBtn: React.CSSProperties = {
  minHeight: 40, border: `1px solid ${BORDER}`, borderRadius: 8, background: "transparent",
  color: MUTED, fontFamily: MONO, fontSize: 12, padding: "0 12px", cursor: "pointer",
};
function actionBtn(color: string): React.CSSProperties {
  return {
    display: "inline-flex", alignItems: "center", gap: 7, minHeight: 40,
    border: `1px solid ${color}`, borderRadius: 8, background: `color-mix(in srgb, ${color} 13%, transparent)`, color,
    padding: "0 16px", fontFamily: SANS, fontSize: 14, fontWeight: 650, cursor: "pointer",
  };
}
function primaryBtn(color: string): React.CSSProperties {
  return {
    display: "inline-flex", alignItems: "center", gap: 8, minHeight: 46,
    border: `1px solid ${color}`, borderRadius: 9, background: color, color: "var(--on-accent)",
    padding: "0 22px", fontSize: 14.5, fontWeight: 700, fontFamily: SANS, cursor: "pointer",
  };
}
const backLink: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "none",
  color: MUTED, fontFamily: MONO, fontSize: 12, cursor: "pointer", padding: 0,
};
