"use client";

// Paper Desk — public weekly leaderboard (client).
//
// Reads /api/leaderboard?week=… (pure SQL aggregation upstream, no model spend).
// Traders are ranked by a risk-adjusted weekly return (Sharpe-style), not raw
// P&L, so consistent sizing beats a single lucky fill. The live week computes on
// the fly; completed weeks read a frozen snapshot. Anyone can read the board —
// the claim CTA only shows for signed-in traders without a handle yet.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { TrophyIcon, ShieldIcon, ArrowLeftIcon, ArrowRightIcon } from "./icons";

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
const GOLD = "#e0a23b";
const MONO = "var(--font-mono), 'JetBrains Mono', monospace";
const SANS = "var(--font-sans), system-ui, sans-serif";
const DISPLAY = "var(--font-display), Georgia, 'Times New Roman', serif";
const SERIF = "var(--font-serif), Georgia, serif";

interface LbRow {
  handle: string;
  displayName: string | null;
  rank: number | null;
  sharpe: number;
  returnPct: number;
  trades: number;
  featured: boolean;
  isSelf?: boolean;
}
interface LbWeek {
  weekStart: string;
  weekEnd: string;
  label: string;
  isCurrent: boolean;
  rows: LbRow[];
  featured: LbRow | null;
}

const DAY_MS = 86_400_000;

function shiftWeek(weekStart: string, deltaWeeks: number): string {
  const d = new Date(`${weekStart}T00:00:00Z`);
  return new Date(d.getTime() + deltaWeeks * 7 * DAY_MS).toISOString().slice(0, 10);
}

function signedPct(v: number): string {
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
}

export function Leaderboard({ signedIn, hasHandle }: { signedIn: boolean; hasHandle: boolean }) {
  const [week, setWeek] = useState<LbWeek | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  // null = current week (server default); otherwise an explicit Monday ISO date.
  const [weekParam, setWeekParam] = useState<string | null>(null);

  const load = useCallback(async (param: string | null) => {
    setLoading(true);
    setError(false);
    try {
      const qs = param ? `?week=${encodeURIComponent(param)}` : "";
      const res = await fetch(`/api/leaderboard${qs}`);
      if (!res.ok) { setError(true); return; }
      const d = (await res.json()) as { week: LbWeek };
      setWeek(d.week);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(weekParam); }, [load, weekParam]);

  const ranked = week ? week.rows.filter((r) => r.rank != null) : [];
  const building = week ? week.rows.filter((r) => r.rank == null) : [];

  return (
    <section style={{ fontFamily: SANS }}>
      <style>{`@media (max-width:640px){ .lb-row-side { display:none !important; } }`}</style>

      {/* header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10, flexWrap: "wrap" }}>
        <TrophyIcon size={24} style={{ color: GOLD }} />
        <h1 style={{ color: INK, fontFamily: DISPLAY, fontSize: 30, fontWeight: 500, letterSpacing: "-0.01em", margin: 0 }}>
          Paper Desk Leaderboard
        </h1>
      </div>
      <p style={{ color: MUTED, fontFamily: SERIF, fontSize: 15.5, lineHeight: 1.6, margin: "0 0 24px", maxWidth: 720 }}>
        Every trader runs a notional <strong style={{ color: INK, fontWeight: 600 }}>$100,000</strong> account on real,
        cited prices. Standings rank by a <strong style={{ color: INK, fontWeight: 600 }}>risk-adjusted return</strong>{" "}
        (a Sharpe-style score) — not raw P&amp;L — so disciplined sizing beats a single lucky fill. No single ticker may
        exceed 10% of the account, and a trader needs at least three positions in a week to be ranked.
      </p>

      {/* week switcher */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 22 }}>
        <button
          onClick={() => setWeekParam(week ? shiftWeek(week.weekStart, -1) : null)}
          disabled={loading || !week}
          aria-label="Previous week"
          style={navBtn(!loading && !!week)}
        >
          <ArrowLeftIcon size={15} />
        </button>
        <div style={{ textAlign: "center", minWidth: 200 }}>
          <div style={{ color: INK, fontFamily: MONO, fontSize: 14, fontWeight: 650 }}>
            {week ? week.label : "—"}
          </div>
          <div style={{ color: week?.isCurrent ? GOOD : FAINT, fontFamily: MONO, fontSize: 10.5, letterSpacing: "0.12em", textTransform: "uppercase", marginTop: 3 }}>
            {week?.isCurrent ? "Live · in progress" : "Final"}
          </div>
        </div>
        <button
          onClick={() => setWeekParam(week ? shiftWeek(week.weekStart, 1) : null)}
          disabled={loading || !week || week.isCurrent}
          aria-label="Next week"
          style={navBtn(!loading && !!week && !week.isCurrent)}
        >
          <ArrowRightIcon size={15} />
        </button>
      </div>

      {/* claim CTA — only for signed-in traders without a handle */}
      {signedIn && !hasHandle && (
        <div style={{ background: `linear-gradient(180deg, rgba(224,162,59,0.10), rgba(224,162,59,0.02))`, border: `1px solid rgba(224,162,59,0.3)`, borderRadius: 12, padding: "16px 18px", marginBottom: 22, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <ShieldIcon size={18} style={{ color: GOLD }} />
          <span style={{ color: INK, fontFamily: SERIF, fontSize: 14.5, lineHeight: 1.5 }}>
            You&apos;re trading but not on the board yet. Claim a handle on the desk to start a public track record.
          </span>
          <Link href="/academy/practice" style={{ ...claimBtn, marginLeft: "auto", textDecoration: "none" }}>
            Claim your handle <ArrowRightIcon size={14} />
          </Link>
        </div>
      )}

      {loading ? (
        <p style={{ color: FAINT, fontFamily: MONO, fontSize: 12.5 }}>Loading standings…</p>
      ) : error ? (
        <p style={{ color: BAD, fontFamily: MONO, fontSize: 13 }}>Couldn&apos;t load the leaderboard. Refresh to try again.</p>
      ) : !week || week.rows.length === 0 ? (
        <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 26, textAlign: "center" }}>
          <p style={{ color: MUTED, fontFamily: SERIF, fontSize: 15, lineHeight: 1.6, margin: 0 }}>
            No ranked traders this week yet. {week?.isCurrent ? "Be the first — " : "The board was quiet. "}
            <Link href="/academy/practice" style={{ color: ACCENT, textDecoration: "none", fontWeight: 600 }}>open positions on the desk</Link> to put your name up.
          </p>
        </div>
      ) : (
        <>
          {/* featured top trader */}
          {week.featured && (
            <article style={{ background: `linear-gradient(180deg, rgba(224,162,59,0.13), rgba(224,162,59,0.02))`, border: `1px solid rgba(224,162,59,0.34)`, borderRadius: 14, padding: "20px 22px", marginBottom: 18, display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <TrophyIcon size={28} style={{ color: GOLD }} />
                <div>
                  <div style={{ color: GOLD, fontFamily: MONO, fontSize: 10.5, letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: 4 }}>
                    {week.isCurrent ? "Leading this week" : "Top trader"}
                  </div>
                  <div style={{ color: INK, fontFamily: DISPLAY, fontSize: 23, fontWeight: 600, lineHeight: 1.1 }}>
                    @{week.featured.handle}
                    {week.featured.isSelf && <span style={{ color: ACCENT, fontFamily: MONO, fontSize: 12, marginLeft: 10 }}>you</span>}
                  </div>
                  {week.featured.displayName && (
                    <div style={{ color: MUTED, fontFamily: SERIF, fontSize: 13.5, marginTop: 2 }}>{week.featured.displayName}</div>
                  )}
                </div>
              </div>
              <div style={{ marginLeft: "auto", display: "flex", gap: 26, flexWrap: "wrap" }}>
                <Stat label="Risk-adj." value={week.featured.sharpe.toFixed(2)} tone={week.featured.sharpe >= 0 ? GOOD : BAD} />
                <Stat label="Return" value={signedPct(week.featured.returnPct)} tone={week.featured.returnPct >= 0 ? GOOD : BAD} />
                <Stat label="Trades" value={String(week.featured.trades)} tone={INK} />
              </div>
            </article>
          )}

          {/* ranked table */}
          <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 12, overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "11px 18px", borderBottom: `1px solid ${RULE}`, color: FAINT, fontFamily: MONO, fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase" }}>
              <span style={{ width: 32 }}>#</span>
              <span style={{ flex: 1 }}>Trader</span>
              <span className="lb-row-side" style={{ width: 92, textAlign: "right" }}>Risk-adj.</span>
              <span style={{ width: 92, textAlign: "right" }}>Return</span>
              <span className="lb-row-side" style={{ width: 64, textAlign: "right" }}>Trades</span>
            </div>
            {ranked.map((r) => (
              <Row key={r.handle} r={r} />
            ))}
          </div>

          {/* building a track record (unranked) */}
          {building.length > 0 && (
            <div style={{ marginTop: 24 }}>
              <div style={{ color: FAINT, fontFamily: MONO, fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 10 }}>
                Building a track record · fewer than 3 trades this week
              </div>
              <div style={{ display: "grid", gap: 7 }}>
                {building.map((r) => (
                  <div key={r.handle} style={{ display: "flex", alignItems: "center", gap: 12, background: SURFACE_SOFT, border: `1px solid ${r.isSelf ? "rgba(79,135,247,0.4)" : RULE}`, borderRadius: 9, padding: "10px 15px", flexWrap: "wrap" }}>
                    <span style={{ color: INK, fontFamily: MONO, fontSize: 13.5, fontWeight: 650 }}>
                      @{r.handle}
                      {r.isSelf && <span style={{ color: ACCENT, fontSize: 11, marginLeft: 8 }}>you</span>}
                    </span>
                    <span style={{ marginLeft: "auto", color: r.returnPct >= 0 ? GOOD : BAD, fontFamily: MONO, fontSize: 13 }}>{signedPct(r.returnPct)}</span>
                    <span style={{ color: FAINT, fontFamily: MONO, fontSize: 12, width: 64, textAlign: "right" }}>{r.trades}/3</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <p style={{ color: FAINT, fontFamily: MONO, fontSize: 11, lineHeight: 1.6, marginTop: 24 }}>
        Paper trading only — no real money, not investment advice. Prices are web-sourced and cited on the desk.
      </p>
    </section>
  );
}

function Row({ r }: { r: LbRow }) {
  const medal = r.rank === 1 ? GOLD : r.rank === 2 ? "#c0c7d4" : r.rank === 3 ? "#cd7f4e" : FAINT;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "13px 18px", borderBottom: `1px solid ${RULE}`, background: r.isSelf ? "rgba(79,135,247,0.08)" : "transparent" }}>
      <span style={{ width: 32, color: medal, fontFamily: MONO, fontSize: 15, fontWeight: 700 }}>{r.rank}</span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ color: INK, fontFamily: MONO, fontSize: 14.5, fontWeight: 650 }}>@{r.handle}</span>
        {r.isSelf && <span style={{ color: ACCENT, fontFamily: MONO, fontSize: 11, marginLeft: 8 }}>you</span>}
        {r.displayName && (
          <span style={{ display: "block", color: MUTED, fontFamily: SERIF, fontSize: 12.5, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.displayName}</span>
        )}
      </span>
      <span className="lb-row-side" style={{ width: 92, textAlign: "right", color: r.sharpe >= 0 ? GOOD : BAD, fontFamily: MONO, fontSize: 14, fontWeight: 650 }}>{r.sharpe.toFixed(2)}</span>
      <span style={{ width: 92, textAlign: "right", color: r.returnPct >= 0 ? GOOD : BAD, fontFamily: MONO, fontSize: 14, fontWeight: 650 }}>{signedPct(r.returnPct)}</span>
      <span className="lb-row-side" style={{ width: 64, textAlign: "right", color: MUTED, fontFamily: MONO, fontSize: 13 }}>{r.trades}</span>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div style={{ textAlign: "right" }}>
      <div style={{ color: FAINT, fontFamily: MONO, fontSize: 9.5, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 4 }}>{label}</div>
      <div style={{ color: tone, fontFamily: MONO, fontSize: 19, fontWeight: 700 }}>{value}</div>
    </div>
  );
}

function navBtn(enabled: boolean): React.CSSProperties {
  return {
    display: "inline-flex", alignItems: "center", justifyContent: "center", width: 38, height: 38,
    border: `1px solid ${BORDER}`, borderRadius: 9, background: SURFACE_SOFT,
    color: enabled ? INK : FAINT, cursor: enabled ? "pointer" : "not-allowed", opacity: enabled ? 1 : 0.5,
  };
}

const claimBtn: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 7, minHeight: 38,
  border: `1px solid ${GOLD}`, borderRadius: 9, background: GOLD, color: "#1a1206",
  padding: "0 16px", fontSize: 13, fontWeight: 700, fontFamily: SANS,
};
