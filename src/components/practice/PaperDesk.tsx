"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CoinsIcon, ArrowRightIcon, ShieldIcon, TargetIcon } from "./icons";

const SURFACE = "#071120";
const SURFACE_SOFT = "rgba(232,237,248,0.035)";
const BORDER = "rgba(232,237,248,0.09)";
const RULE = "rgba(232,237,248,0.075)";
const INK = "#e8edf8";
const MUTED = "#8aa0c2";
const FAINT = "#526684";
const ACCENT = "#4f87f7";
const GOOD = "#22c55e";
const BAD = "#f87171";
const CREDIT = "#e0a23b";
const MONO = "var(--font-mono), 'JetBrains Mono', monospace";
const SANS = "var(--font-sans), system-ui, sans-serif";
const DISPLAY = "var(--font-display), Georgia, 'Times New Roman', serif";
const SERIF = "var(--font-serif), Georgia, serif";

interface PaperPosition {
  id: string; ticker: string; qty: number;
  entryPrice: number; entrySource: string | null; entryAsOf: string | null;
  stopPrice: number | null; targetPrice: number | null; thesis: string | null;
  lastMark: number | null; lastMarkSrc: string | null; lastMarkAt: string | null;
  status: "open" | "closed";
  exitPrice: number | null; closedAt: string | null; openedAt: string;
  marketValue: number | null; unrealizedPct: number | null;
}

function px(v: number | null): string {
  if (v == null) return "—";
  return `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function signed(v: number | null): string {
  if (v == null) return "—";
  return `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;
}
function realizedPct(p: PaperPosition): number | null {
  if (p.exitPrice == null || p.entryPrice <= 0) return null;
  return (p.exitPrice / p.entryPrice - 1) * 100;
}

export function PaperDesk({ signedIn }: { signedIn: boolean }) {
  const [positions, setPositions] = useState<PaperPosition[]>([]);
  const [loading, setLoading] = useState(signedIn);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCta, setErrorCta] = useState<{ href: string; label: string } | null>(null);
  const [credits, setCredits] = useState<number | null>(null);

  // open form
  const [ticker, setTicker] = useState("");
  const [qty, setQty] = useState("");
  const [stop, setStop] = useState("");
  const [target, setTarget] = useState("");
  const [thesis, setThesis] = useState("");
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    if (!signedIn) return;
    let alive = true;
    fetch("/api/practice/paper")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (alive && d && Array.isArray(d.positions)) setPositions(d.positions); })
      .catch(() => null)
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [signedIn]);

  function fail(msg: string, cta?: { href: string; label: string }) {
    setError(msg);
    setErrorCta(cta ?? null);
  }

  function upsert(p: PaperPosition) {
    setPositions((prev) => {
      const i = prev.findIndex((x) => x.id === p.id);
      if (i === -1) return [p, ...prev];
      const next = [...prev];
      next[i] = p;
      return next;
    });
  }

  async function openPosition() {
    setError(null); setErrorCta(null);
    const tk = ticker.trim().toUpperCase();
    if (!/^[A-Z.\-]{1,8}$/.test(tk)) { fail("Enter a valid ticker (1–8 letters, e.g. AAPL)."); return; }
    const q = Number(qty);
    if (!Number.isFinite(q) || q <= 0) { fail("Enter how many shares to buy."); return; }

    setOpening(true);
    try {
      const res = await fetch("/api/practice/paper", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "open",
          ticker: tk,
          qty: q,
          stop: stop ? Number(stop) : undefined,
          target: target ? Number(target) : undefined,
          thesis: thesis.trim() || undefined,
        }),
      });
      if (res.status === 401) { fail("Sign in to trade the live desk.", { href: "/login", label: "Sign in" }); return; }
      if (res.status === 402) {
        const d = (await res.json().catch(() => null)) as { needed?: number; credits?: number } | null;
        fail(d?.needed != null && d?.credits != null ? `A live quote costs ${d.needed} credits and you have ${d.credits}.` : "Not enough credits for a live quote.", { href: "/pricing", label: "View pricing" });
        return;
      }
      if (res.status === 502) { fail(`Couldn't source a live price for ${tk} right now — you weren't charged. Try again shortly.`); return; }
      if (res.status === 400) { fail("Check the ticker and share count and try again."); return; }
      if (!res.ok) { fail("Couldn't open that position. Try again shortly."); return; }

      const d = (await res.json()) as { position: PaperPosition; creditsRemaining?: number };
      upsert(d.position);
      if (typeof d.creditsRemaining === "number") setCredits(d.creditsRemaining);
      setTicker(""); setQty(""); setStop(""); setTarget(""); setThesis("");
      setShowForm(false);
    } catch {
      fail("Connection dropped. Try opening the position again.");
    } finally {
      setOpening(false);
    }
  }

  async function mark(id: string) {
    setError(null); setErrorCta(null);
    setBusyId(id);
    try {
      const res = await fetch("/api/practice/paper", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark", id }),
      });
      if (res.status === 402) {
        const d = (await res.json().catch(() => null)) as { needed?: number; credits?: number } | null;
        fail(d?.needed != null && d?.credits != null ? `A fresh mark costs ${d.needed} credits and you have ${d.credits}.` : "Not enough credits to mark to market.", { href: "/pricing", label: "View pricing" });
        return;
      }
      if (res.status === 502) { fail("Couldn't source a fresh quote right now — you weren't charged."); return; }
      if (!res.ok) { fail("Couldn't mark that position. Try again shortly."); return; }
      const d = (await res.json()) as { position: PaperPosition; creditsRemaining?: number };
      upsert(d.position);
      if (typeof d.creditsRemaining === "number") setCredits(d.creditsRemaining);
    } catch {
      fail("Connection dropped while marking. Try again.");
    } finally {
      setBusyId(null);
    }
  }

  async function close(id: string) {
    setError(null); setErrorCta(null);
    setBusyId(id);
    try {
      const res = await fetch("/api/practice/paper", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "close", id }),
      });
      if (!res.ok) { fail("Couldn't close that position. Try again shortly."); return; }
      const d = (await res.json()) as { position: PaperPosition };
      upsert(d.position);
    } catch {
      fail("Connection dropped while closing. Try again.");
    } finally {
      setBusyId(null);
    }
  }

  const open = positions.filter((p) => p.status === "open");
  const closed = positions.filter((p) => p.status === "closed");

  return (
    <section style={{ marginTop: 40, fontFamily: SANS }}>
      <style>{`
        .pd-num { -moz-appearance: textfield; }
        .pd-num::-webkit-outer-spin-button, .pd-num::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
        @media (max-width: 720px){ .pd-form-row { flex-direction: column !important; align-items: stretch !important; } .pd-pos-head { flex-wrap: wrap; } }
      `}</style>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8, flexWrap: "wrap" }}>
        <CoinsIcon size={22} style={{ color: CREDIT }} />
        <h2 style={{ color: INK, fontFamily: DISPLAY, fontSize: 26, fontWeight: 500, letterSpacing: "-0.01em", margin: 0 }}>
          Live paper desk
        </h2>
        {credits != null && (
          <span style={{ marginLeft: "auto", color: CREDIT, fontFamily: MONO, fontSize: 12.5 }}>{credits.toLocaleString()} cr left</span>
        )}
      </div>
      <p style={{ color: MUTED, fontFamily: SERIF, fontSize: 15, lineHeight: 1.6, margin: "0 0 20px", maxWidth: 720 }}>
        Beyond the historical drills: take real positions in real tickers at live, <strong style={{ color: INK, fontWeight: 600 }}>cited</strong> prices.
        Opening and re-marking pull a fresh web-sourced quote and cost a credit each; closing is free. Paper only — no real money, not advice.
      </p>

      {!signedIn ? (
        <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 22, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <span style={{ color: MUTED, fontFamily: SERIF, fontSize: 15 }}>Sign in to open live paper positions and keep a track record.</span>
          <Link href="/login" style={{ ...primaryBtn(ACCENT), marginLeft: "auto", textDecoration: "none" }}>Sign in <ArrowRightIcon size={15} /></Link>
        </div>
      ) : (
        <>
          {/* open ticket toggle */}
          {!showForm ? (
            <button onClick={() => setShowForm(true)} style={primaryBtn(GOOD)}>
              <TargetIcon size={16} /> Open a position
            </button>
          ) : (
            <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 18, marginBottom: 18 }}>
              <div style={{ color: FAINT, fontFamily: MONO, fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: 14 }}>
                New position · fills at a live web-sourced quote
              </div>
              <div className="pd-form-row" style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
                <Labeled label="Ticker">
                  <input className="pd-num" value={ticker} onChange={(e) => setTicker(e.target.value.toUpperCase().replace(/[^A-Z.\-]/g, "").slice(0, 8))} placeholder="AAPL" style={{ ...inputStyle, width: 100, textTransform: "uppercase" }} />
                </Labeled>
                <Labeled label="Shares">
                  <input className="pd-num" inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value.replace(/[^\d]/g, ""))} placeholder="0" style={{ ...inputStyle, width: 90 }} />
                </Labeled>
                <Labeled label="Stop (opt)">
                  <input className="pd-num" inputMode="decimal" value={stop} onChange={(e) => setStop(e.target.value.replace(/[^\d.]/g, ""))} placeholder="—" style={{ ...inputStyle, width: 84 }} />
                </Labeled>
                <Labeled label="Target (opt)">
                  <input className="pd-num" inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value.replace(/[^\d.]/g, ""))} placeholder="—" style={{ ...inputStyle, width: 84 }} />
                </Labeled>
              </div>
              <Labeled label="Thesis (optional)" style={{ marginTop: 12 }}>
                <input value={thesis} onChange={(e) => setThesis(e.target.value.slice(0, 240))} placeholder="One line on why you're in." style={{ ...inputStyle, width: "100%", maxWidth: 520 }} />
              </Labeled>
              <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 16, flexWrap: "wrap" }}>
                <button onClick={openPosition} disabled={opening} style={{ ...primaryBtn(GOOD), opacity: opening ? 0.6 : 1, cursor: opening ? "wait" : "pointer" }}>
                  {opening ? "Sourcing quote…" : "Buy at live price"}
                </button>
                <button onClick={() => { setShowForm(false); setError(null); }} style={ghostBtn()}>Cancel</button>
                <span style={{ color: FAINT, fontFamily: MONO, fontSize: 11, display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <ShieldIcon size={13} /> Costs 1 quote credit · refunded if no price can be sourced
                </span>
              </div>
            </div>
          )}

          {error && (
            <div role="alert" style={{ marginTop: 16, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.26)", color: "#fca5a5", borderRadius: 10, padding: "12px 14px", fontSize: 13.5, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <span>{error}</span>
              {errorCta && <Link href={errorCta.href} style={{ color: ACCENT, fontFamily: MONO, fontSize: 12.5, fontWeight: 650, textDecoration: "none", marginLeft: "auto" }}>{errorCta.label} →</Link>}
            </div>
          )}

          {/* open positions */}
          <div style={{ marginTop: 22 }}>
            {loading ? (
              <p style={{ color: FAINT, fontFamily: MONO, fontSize: 12.5 }}>Loading your positions…</p>
            ) : open.length === 0 ? (
              <p style={{ color: FAINT, fontFamily: SERIF, fontSize: 14.5, lineHeight: 1.5 }}>No open positions yet. Open one above to start a live track record.</p>
            ) : (
              <div style={{ display: "grid", gap: 12 }}>
                {open.map((p) => {
                  const pnl = p.unrealizedPct;
                  return (
                    <article key={p.id} style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 18 }}>
                      <div className="pd-pos-head" style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 14 }}>
                        <span style={{ color: INK, fontFamily: DISPLAY, fontSize: 22, fontWeight: 600 }}>{p.ticker}</span>
                        <span style={{ color: MUTED, fontFamily: MONO, fontSize: 13 }}>{p.qty} sh</span>
                        <span style={{ marginLeft: "auto", color: pnl == null ? MUTED : pnl >= 0 ? GOOD : BAD, fontFamily: MONO, fontSize: 20, fontWeight: 700 }}>
                          {signed(pnl)}
                        </span>
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px,1fr))", gap: 14, marginBottom: 14 }}>
                        <Cell label="Entry" value={px(p.entryPrice)} sub={p.entryAsOf} src={p.entrySource} />
                        <Cell label="Last mark" value={px(p.lastMark)} sub={p.lastMarkAt} src={p.lastMarkSrc} />
                        <Cell label="Market value" value={p.marketValue != null ? `$${p.marketValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : "—"} />
                        <Cell label="Stop / target" value={`${px(p.stopPrice)} / ${px(p.targetPrice)}`} />
                      </div>

                      {p.thesis && (
                        <p style={{ color: MUTED, fontFamily: SERIF, fontSize: 13.5, lineHeight: 1.5, margin: "0 0 14px", paddingLeft: 12, borderLeft: `2px solid ${RULE}` }}>
                          {p.thesis}
                        </p>
                      )}

                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                        <button onClick={() => mark(p.id)} disabled={busyId === p.id} style={{ ...actionBtn(ACCENT), opacity: busyId === p.id ? 0.6 : 1, cursor: busyId === p.id ? "wait" : "pointer" }}>
                          {busyId === p.id ? "Marking…" : "Mark to market"}
                        </button>
                        <button onClick={() => close(p.id)} disabled={busyId === p.id} style={ghostBtn()}>
                          Close (free)
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>

          {/* closed history */}
          {closed.length > 0 && (
            <div style={{ marginTop: 26 }}>
              <div style={{ color: FAINT, fontFamily: MONO, fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: 12 }}>
                Closed · track record
              </div>
              <div style={{ display: "grid", gap: 8 }}>
                {closed.map((p) => {
                  const r = realizedPct(p);
                  return (
                    <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 12, background: SURFACE_SOFT, border: `1px solid ${RULE}`, borderRadius: 9, padding: "11px 15px", flexWrap: "wrap" }}>
                      <span style={{ color: INK, fontFamily: MONO, fontSize: 14, fontWeight: 650, minWidth: 56 }}>{p.ticker}</span>
                      <span style={{ color: MUTED, fontFamily: MONO, fontSize: 12 }}>{p.qty} sh · {px(p.entryPrice)} → {px(p.exitPrice)}</span>
                      <span style={{ marginLeft: "auto", color: r == null ? MUTED : r >= 0 ? GOOD : BAD, fontFamily: MONO, fontSize: 14, fontWeight: 700 }}>{signed(r)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function Cell({ label, value, sub, src }: { label: string; value: string; sub?: string | null; src?: string | null }) {
  return (
    <div>
      <div style={{ color: FAINT, fontFamily: MONO, fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 5 }}>{label}</div>
      <div style={{ color: INK, fontFamily: MONO, fontSize: 15, fontWeight: 650 }}>{value}</div>
      {sub && (
        src ? (
          <a href={src} target="_blank" rel="noopener noreferrer" style={{ color: ACCENT, fontFamily: MONO, fontSize: 10.5, textDecoration: "none" }}>
            {sub} ↗
          </a>
        ) : (
          <span style={{ color: FAINT, fontFamily: MONO, fontSize: 10.5 }}>{sub}</span>
        )
      )}
    </div>
  );
}

function Labeled({ label, children, style }: { label: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6, ...style }}>
      <span style={{ color: FAINT, fontFamily: MONO, fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase" }}>{label}</span>
      {children}
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  minHeight: 40, boxSizing: "border-box", background: "rgba(232,237,248,0.04)", border: `1px solid ${BORDER}`,
  borderRadius: 8, color: INK, fontFamily: MONO, fontSize: 15, padding: "0 12px", outline: "none",
};
function actionBtn(color: string): React.CSSProperties {
  return {
    display: "inline-flex", alignItems: "center", gap: 7, minHeight: 40,
    border: `1px solid ${color}`, borderRadius: 8, background: `${color}22`, color,
    padding: "0 16px", fontFamily: SANS, fontSize: 13.5, fontWeight: 650, cursor: "pointer",
  };
}
function primaryBtn(color: string): React.CSSProperties {
  return {
    display: "inline-flex", alignItems: "center", gap: 8, minHeight: 44,
    border: `1px solid ${color}`, borderRadius: 9, background: color, color: "#04101f",
    padding: "0 20px", fontSize: 14, fontWeight: 700, fontFamily: SANS, cursor: "pointer",
  };
}
function ghostBtn(): React.CSSProperties {
  return {
    display: "inline-flex", alignItems: "center", gap: 8, minHeight: 44,
    border: `1px solid ${BORDER}`, borderRadius: 9, background: "transparent", color: MUTED,
    padding: "0 18px", fontSize: 13.5, fontWeight: 600, fontFamily: SANS, cursor: "pointer",
  };
}
