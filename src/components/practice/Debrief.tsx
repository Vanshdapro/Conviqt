"use client";

import { PriceChart, type ChartMarker } from "./PriceChart";
import { StarIcon, ReplayIcon, ArrowLeftIcon, ArrowRightIcon, BoltIcon } from "./icons";

const SURFACE = "var(--bg-surface)";
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

interface ScoreDimension { id: string; label: string; score: number; weight: number; note: string; }
interface EpisodeScore {
  overall: number; stars: 0 | 1 | 2 | 3; dimensions: ScoreDimension[];
  pnlPct: number; buyHoldPct: number; alphaPct: number; headline: string;
}
interface KeyMoment { atBar: number; ideal: "buy" | "sell" | "hold" | "cut"; why: string; }
interface ResolvedAction { atBar: number; side: "buy" | "sell"; shares: number; price: number; auto?: boolean; }
interface EquityPoint { bar: number; t: string; close: number; equity: number; }

export interface EpisodeResult {
  score: EpisodeScore;
  debrief: { teachingPoint: string; idealPlay: string; keyMoments: KeyMoment[]; sourceUrl: string; sourceLabel: string; };
  run: { equityCurve: EquityPoint[]; resolvedActions: ResolvedAction[]; startingEquity: number; finalEquity: number; buyHoldEquity: number; maxDrawdown: number; };
  awardedXp: number;
  signedIn: boolean;
}

function scoreColor(s: number): string {
  if (s >= 70) return GOOD;
  if (s >= 45) return CREDIT;
  return BAD;
}
function pnlColor(v: number): string { return v >= 0 ? GOOD : BAD; }
function signed(v: number): string { return `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`; }

const IDEAL_LABEL: Record<KeyMoment["ideal"], string> = { buy: "Buy", sell: "Take profit", hold: "Hold", cut: "Cut the loss" };
const IDEAL_COLOR: Record<KeyMoment["ideal"], string> = { buy: GOOD, sell: ACCENT, hold: MUTED, cut: BAD };

export function Debrief({
  episode,
  result,
  onReplay,
  onExit,
}: {
  episode: { ticker: string; company: string; bars: { t: string; close: number }[] };
  result: EpisodeResult;
  onReplay: () => void;
  onExit: () => void;
}) {
  const { score, debrief, run } = result;
  const labels = run.equityCurve.map((p) => p.t);
  const yours = run.equityCurve.map((p) => p.equity);
  const firstClose = episode.bars[0]?.close ?? run.equityCurve[0]?.close ?? 1;
  const bhShares = firstClose > 0 ? run.startingEquity / firstClose : 0;
  const bh = run.equityCurve.map((p) => bhShares * p.close);

  const tradeMarkers: ChartMarker[] = run.resolvedActions.map((a) => ({
    index: a.atBar,
    kind: a.auto ? (a.side === "sell" ? "stop" : "buy") : a.side,
  }));

  function actionsAt(bar: number): ResolvedAction[] {
    return run.resolvedActions.filter((a) => a.atBar === bar);
  }

  return (
    <div style={{ fontFamily: SANS }}>
      {/* ── Verdict header ────────────────────────────────────────────── */}
      <div
        style={{
          background: SURFACE,
          border: `1px solid ${BORDER}`,
          borderRadius: 14,
          padding: 26,
          marginBottom: 18,
          display: "flex",
          alignItems: "center",
          gap: 26,
          flexWrap: "wrap",
        }}
      >
        <div style={{ textAlign: "center", minWidth: 130 }}>
          <div style={{ display: "flex", gap: 4, justifyContent: "center", marginBottom: 10, color: CREDIT }}>
            {[0, 1, 2].map((i) => (
              <StarIcon key={i} size={26} filled={i < score.stars} style={{ opacity: i < score.stars ? 1 : 0.25 }} />
            ))}
          </div>
          <div style={{ fontFamily: MONO, fontSize: 44, fontWeight: 700, color: scoreColor(score.overall), lineHeight: 1 }}>
            {score.overall}
          </div>
          <div style={{ fontFamily: MONO, fontSize: 11, color: FAINT, letterSpacing: "0.14em", textTransform: "uppercase", marginTop: 6 }}>
            Process score
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 240 }}>
          <div style={{ color: ACCENT, fontFamily: MONO, fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 8 }}>
            {episode.ticker} · Debrief
          </div>
          <h2 style={{ color: INK, fontFamily: DISPLAY, fontSize: 25, fontWeight: 500, lineHeight: 1.2, margin: "0 0 10px", letterSpacing: "-0.01em" }}>
            {score.headline}
          </h2>
          {result.signedIn ? (
            result.awardedXp > 0 ? (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 7, color: GOOD, fontFamily: MONO, fontSize: 13 }}>
                <BoltIcon size={15} /> +{result.awardedXp} XP earned
              </span>
            ) : (
              <span style={{ color: FAINT, fontFamily: MONO, fontSize: 12.5 }}>Best result kept. Replays don&apos;t re-award XP.</span>
            )
          ) : (
            <span style={{ color: FAINT, fontFamily: MONO, fontSize: 12.5 }}>Sign in to save your rank and XP.</span>
          )}
        </div>
      </div>

      {/* ── P&L vs benchmark ──────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 18 }}>
        <Stat label="Your return" value={signed(score.pnlPct)} color={pnlColor(score.pnlPct)} />
        <Stat label="Buy & hold" value={signed(score.buyHoldPct)} color={MUTED} />
        <Stat label="Alpha vs hold" value={signed(score.alphaPct)} color={pnlColor(score.alphaPct)} />
        <Stat label="Max drawdown" value={`-${(run.maxDrawdown * 100).toFixed(1)}%`} color={CREDIT} />
      </div>

      {/* ── Equity curve ──────────────────────────────────────────────── */}
      <Panel title="Your equity vs buy & hold">
        <PriceChart
          labels={labels}
          series={[
            { values: yours, color: ACCENT, label: "You" },
            { values: bh, color: MUTED, label: "Buy & hold", dashed: true },
          ]}
          markers={tradeMarkers}
          height={260}
        />
      </Panel>

      {/* ── Process dimensions ────────────────────────────────────────── */}
      <Panel title="How the desk scored your process">
        <div style={{ display: "grid", gap: 14 }}>
          {score.dimensions.map((d) => (
            <div key={d.id}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6, gap: 12 }}>
                <span style={{ color: INK, fontFamily: SERIF, fontSize: 14.5, fontWeight: 600 }}>
                  {d.label}
                  <span style={{ color: FAINT, fontFamily: MONO, fontSize: 11, fontWeight: 400, marginLeft: 8 }}>×{Math.round(d.weight)}%</span>
                </span>
                <span style={{ color: scoreColor(d.score), fontFamily: MONO, fontSize: 13, fontWeight: 650 }}>{d.score}</span>
              </div>
              <div style={{ height: 5, borderRadius: 999, background: "var(--bg-sunken)", overflow: "hidden", marginBottom: 6 }}>
                <div style={{ width: `${Math.max(0, Math.min(100, d.score))}%`, height: "100%", background: scoreColor(d.score), borderRadius: 999 }} />
              </div>
              <p style={{ color: MUTED, fontSize: 13, lineHeight: 1.5, margin: 0 }}>{d.note}</p>
            </div>
          ))}
        </div>
      </Panel>

      {/* ── Key moments ───────────────────────────────────────────────── */}
      <Panel title="The decisions that mattered">
        <div style={{ display: "grid", gap: 12 }}>
          {debrief.keyMoments.map((km, i) => {
            const acts = actionsAt(km.atBar);
            const barLabel = episode.bars[km.atBar]?.t ?? `Bar ${km.atBar + 1}`;
            return (
              <div key={i} style={{ borderLeft: `2px solid ${IDEAL_COLOR[km.ideal]}`, paddingLeft: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 5, flexWrap: "wrap" }}>
                  <span style={{ fontFamily: MONO, fontSize: 11, color: FAINT }}>{barLabel}</span>
                  <span style={{ fontFamily: MONO, fontSize: 11, color: IDEAL_COLOR[km.ideal], letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 650 }}>
                    Ideal: {IDEAL_LABEL[km.ideal]}
                  </span>
                  <span style={{ fontFamily: MONO, fontSize: 11, color: MUTED }}>
                    {acts.length === 0
                      ? "· You held"
                      : `· You ${acts.map((a) => `${a.side === "buy" ? "bought" : "sold"} ${a.shares}${a.auto ? " (auto)" : ""}`).join(", ")}`}
                  </span>
                </div>
                <p style={{ color: MUTED, fontSize: 13.5, lineHeight: 1.55, margin: 0 }}>{km.why}</p>
              </div>
            );
          })}
        </div>
      </Panel>

      {/* ── Teaching + ideal play ─────────────────────────────────────── */}
      <Panel title="The lesson">
        <p style={{ color: INK, fontFamily: SERIF, fontSize: 15.5, lineHeight: 1.62, margin: "0 0 14px" }}>{debrief.teachingPoint}</p>
        <div style={{ borderTop: `1px solid ${RULE}`, paddingTop: 14 }}>
          <div style={{ color: FAINT, fontFamily: MONO, fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: 8 }}>
            What a disciplined PM would have done
          </div>
          <p style={{ color: MUTED, fontSize: 14, lineHeight: 1.6, margin: 0 }}>{debrief.idealPlay}</p>
        </div>
        <a
          href={debrief.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{ display: "inline-flex", alignItems: "center", gap: 7, marginTop: 16, color: ACCENT, fontFamily: MONO, fontSize: 12, textDecoration: "none" }}
        >
          Source: {debrief.sourceLabel}
          <ArrowRightIcon size={13} />
        </a>
      </Panel>

      {/* ── Actions ───────────────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 6 }}>
        <button onClick={onReplay} style={primaryBtn(ACCENT)}>
          <ReplayIcon size={16} /> Replay this episode
        </button>
        <button onClick={onExit} style={ghostBtn()}>
          <ArrowLeftIcon size={16} /> Back to the ladder
        </button>
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 10, padding: "14px 16px" }}>
      <div style={{ color: FAINT, fontFamily: MONO, fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 7 }}>{label}</div>
      <div style={{ color, fontFamily: MONO, fontSize: 21, fontWeight: 700 }}>{value}</div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20, marginBottom: 18 }}>
      <div style={{ color: FAINT, fontFamily: MONO, fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: 16 }}>{title}</div>
      {children}
    </section>
  );
}

function primaryBtn(color: string): React.CSSProperties {
  return {
    display: "inline-flex", alignItems: "center", gap: 8, minHeight: 44,
    border: `1px solid ${color}`, borderRadius: 9, background: color, color: "var(--on-accent)",
    padding: "0 20px", fontSize: 14, fontWeight: 700, fontFamily: SANS, cursor: "pointer",
  };
}
function ghostBtn(): React.CSSProperties {
  return {
    display: "inline-flex", alignItems: "center", gap: 8, minHeight: 44,
    border: `1px solid ${BORDER}`, borderRadius: 9, background: "transparent", color: MUTED,
    padding: "0 20px", fontSize: 14, fontWeight: 600, fontFamily: SANS, cursor: "pointer",
  };
}
