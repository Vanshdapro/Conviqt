"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { EpisodeRunner, type PlayDrill } from "./EpisodeRunner";
import { ThesisRunner, type PlayThesisDrill } from "./ThesisRunner";
import { PaperDesk } from "./PaperDesk";
import { StarIcon, LockIcon, ChartIcon, PenIcon, TrophyIcon, ChevronRightIcon } from "./icons";

const SURFACE = "#071120";
const BORDER = "rgba(232,237,248,0.09)";
const RULE = "rgba(232,237,248,0.075)";
const INK = "#e8edf8";
const MUTED = "#8aa0c2";
const FAINT = "#526684";
const ACCENT = "#4f87f7";
const GOOD = "#22c55e";
const CREDIT = "#e0a23b";
const VIOLET = "#a78bfa";
const MONO = "var(--font-mono), 'JetBrains Mono', monospace";
const SANS = "var(--font-sans), system-ui, sans-serif";
const DISPLAY = "var(--font-display), Georgia, 'Times New Roman', serif";
const SERIF = "var(--font-serif), Georgia, serif";

interface CardProgress { bestScore: number; bestStars: number; bestPnlPct: number | null; attempts: number; }
interface DrillCard {
  id: string; kind: "episode" | "thesis"; title: string; hook: string;
  difficulty: "core" | "advanced" | "mastery"; xp: number; tier: number;
  conceptTags: string[]; conceptLessonIds: string[];
  ticker?: string | null; period?: string | null;
  progress: CardProgress | null;
}
interface TierBlock { tier: number; name: string; tagline: string; unlocked: boolean; drills: DrillCard[]; }
interface Rank { id: string; title: string; minXp: number; }
interface Dashboard {
  tiers: TierBlock[];
  stats: { xp: number; level: number; rank: Rank; clearedDrillIds: string[] };
  nextRank: Rank | null;
  totals: { totalDrills: number; cleared: number };
  signedIn: boolean;
}

const DIFFICULTY: Record<DrillCard["difficulty"], { label: string; color: string }> = {
  core: { label: "Core", color: ACCENT },
  advanced: { label: "Advanced", color: CREDIT },
  mastery: { label: "Mastery", color: VIOLET },
};

export function PracticeDashboard() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState(false);
  const [active, setActive] = useState<PlayDrill | PlayThesisDrill | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [cardErr, setCardErr] = useState<string | null>(null);

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await fetch("/api/practice");
      if (!res.ok) { setLoadErr(true); return; }
      const d = (await res.json()) as Dashboard;
      setData(d);
      setLoadErr(false);
    } catch {
      setLoadErr(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

  async function openDrill(card: DrillCard, tierUnlocked: boolean) {
    if (!tierUnlocked) return;
    setCardErr(null);
    setOpeningId(card.id);
    try {
      const res = await fetch("/api/practice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ drillId: card.id }),
      });
      if (res.status === 403) { setCardErr("That drill is still locked — clear the earlier tier first."); return; }
      if (!res.ok) { setCardErr("Couldn't load that drill. Try again in a moment."); return; }
      const d = (await res.json()) as { drill: PlayDrill | PlayThesisDrill };
      setActive(d.drill);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setCardErr("Connection dropped while loading the drill. Try again.");
    } finally {
      setOpeningId(null);
    }
  }

  function exitDrill() {
    setActive(null);
    fetchDashboard();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // ── Active drill takes over the page ────────────────────────────────────────────
  if (active) {
    if (active.kind === "episode") {
      return <EpisodeRunner drill={active} onExit={exitDrill} onGraded={() => fetchDashboard()} />;
    }
    return <ThesisRunner drill={active} onExit={exitDrill} onGraded={() => fetchDashboard()} />;
  }

  if (loading) {
    return <p style={{ color: FAINT, fontFamily: MONO, fontSize: 13 }}>Loading the desk…</p>;
  }
  if (loadErr || !data) {
    return (
      <div style={{ fontFamily: SANS }}>
        <p style={{ color: MUTED, fontFamily: SERIF, fontSize: 15.5, lineHeight: 1.6 }}>
          The desk couldn&apos;t load right now. Refresh to try again.
        </p>
        <button onClick={() => { setLoading(true); fetchDashboard(); }} style={primaryBtn(ACCENT)}>Retry</button>
      </div>
    );
  }

  const { stats, nextRank, totals, signedIn } = data;
  const rankFloor = stats.rank.minXp;
  const rankCeil = nextRank?.minXp ?? stats.xp;
  const rankPct = nextRank ? Math.max(0, Math.min(100, ((stats.xp - rankFloor) / Math.max(1, rankCeil - rankFloor)) * 100)) : 100;

  return (
    <div style={{ fontFamily: SANS }}>
      <style>{`
        .pr-card { transition: border-color .16s ease, background .16s ease, transform .16s ease; text-align: left; }
        .pr-card:not(:disabled):hover { transform: translateY(-2px); border-color: rgba(79,135,247,.32); background: rgba(232,237,248,.05); }
        .pr-card:focus-visible { outline: 2px solid rgba(79,135,247,.6); outline-offset: 3px; }
        @media (max-width: 760px) { .pr-cards { grid-template-columns: 1fr !important; } .pr-hero { font-size: 38px !important; } }
        @media (prefers-reduced-motion: reduce) { .pr-card { transition: none; } .pr-card:hover { transform: none; } }
      `}</style>

      {/* ── Header ─────────────────────────────────────────────────────────────── */}
      <header style={{ marginBottom: 32 }}>
        <div style={{ color: GOOD, fontFamily: MONO, fontSize: 10, letterSpacing: "0.24em", textTransform: "uppercase", marginBottom: 16 }}>
          Conviqt Academy · The desk
        </div>
        <h1 className="pr-hero" style={{ color: INK, fontFamily: DISPLAY, fontSize: 46, lineHeight: 1.05, letterSpacing: "-0.018em", fontWeight: 500, margin: "0 0 14px", maxWidth: 720 }}>
          Prove you can run the model.
        </h1>
        <p style={{ color: MUTED, fontFamily: SERIF, fontSize: 17, lineHeight: 1.6, margin: "0 0 26px", maxWidth: 700 }}>
          Trade real historical episodes bar by bar, then write theses an AI grades like an investment committee.
          Clear a tier to unlock the next and climb the PM career ladder.
        </p>

        {/* rank + progress strip */}
        <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 14, padding: "20px 22px", display: "flex", gap: 24, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <span style={{ width: 46, height: 46, borderRadius: 12, background: "rgba(79,135,247,0.1)", border: "1px solid rgba(79,135,247,0.25)", display: "flex", alignItems: "center", justifyContent: "center", color: ACCENT }}>
              <TrophyIcon size={24} />
            </span>
            <div>
              <div style={{ color: FAINT, fontFamily: MONO, fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: 4 }}>Rank</div>
              <div style={{ color: INK, fontFamily: DISPLAY, fontSize: 22, fontWeight: 600, letterSpacing: "-0.01em" }}>{stats.rank.title}</div>
            </div>
          </div>

          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 7 }}>
              <span style={{ color: MUTED, fontFamily: MONO, fontSize: 12 }}>{stats.xp.toLocaleString()} XP</span>
              <span style={{ color: FAINT, fontFamily: MONO, fontSize: 11 }}>
                {nextRank ? `${(rankCeil - stats.xp).toLocaleString()} XP to ${nextRank.title}` : "Top rank reached"}
              </span>
            </div>
            <div style={{ height: 6, borderRadius: 999, background: "rgba(232,237,248,0.08)", overflow: "hidden" }}>
              <div style={{ width: `${rankPct}%`, height: "100%", background: `linear-gradient(90deg, ${ACCENT}, ${GOOD})`, borderRadius: 999, transition: "width .4s ease" }} />
            </div>
          </div>

          <div style={{ textAlign: "right" }}>
            <div style={{ color: FAINT, fontFamily: MONO, fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: 4 }}>Cleared</div>
            <div style={{ color: INK, fontFamily: MONO, fontSize: 20, fontWeight: 700 }}>{totals.cleared} / {totals.totalDrills}</div>
          </div>
        </div>

        {!signedIn && (
          <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", color: FAINT, fontFamily: MONO, fontSize: 12 }}>
            Episodes are free to play.
            <Link href="/login" style={{ color: ACCENT, fontWeight: 650, textDecoration: "none" }}>Sign in</Link>
            to save your rank, XP, and progress.
          </div>
        )}
      </header>

      {cardErr && (
        <div role="alert" style={{ marginBottom: 18, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.26)", color: "#fca5a5", borderRadius: 10, padding: "12px 14px", fontSize: 13.5 }}>
          {cardErr}
        </div>
      )}

      {/* ── Tier ladder ─────────────────────────────────────────────────────────── */}
      <div style={{ display: "grid", gap: 28 }}>
        {data.tiers.map((tier) => (
          <section key={tier.tier}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 4, flexWrap: "wrap" }}>
              <span style={{ color: tier.unlocked ? ACCENT : FAINT, fontFamily: MONO, fontSize: 11, fontWeight: 650, letterSpacing: "0.1em" }}>
                TIER {tier.tier}
              </span>
              <h2 style={{ color: tier.unlocked ? INK : MUTED, fontFamily: DISPLAY, fontSize: 24, fontWeight: 500, letterSpacing: "-0.01em", margin: 0 }}>
                {tier.name}
              </h2>
              {!tier.unlocked && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: FAINT, fontFamily: MONO, fontSize: 11 }}>
                  <LockIcon size={13} /> Clear Tier {tier.tier - 1} to unlock
                </span>
              )}
            </div>
            <p style={{ color: MUTED, fontFamily: SERIF, fontSize: 14.5, lineHeight: 1.5, margin: "0 0 16px", maxWidth: 640 }}>{tier.tagline}</p>

            <div className="pr-cards" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, opacity: tier.unlocked ? 1 : 0.62 }}>
              {tier.drills.map((card) => (
                <DrillCardView
                  key={card.id}
                  card={card}
                  locked={!tier.unlocked}
                  busy={openingId === card.id}
                  onOpen={() => openDrill(card, tier.unlocked)}
                />
              ))}
            </div>
          </section>
        ))}
      </div>

      {/* ── Live paper desk ───────────────────────────────────────────────────────── */}
      <PaperDesk signedIn={signedIn} />

      <footer style={{ marginTop: 40, paddingTop: 16, borderTop: `1px solid ${RULE}`, color: FAINT, fontSize: 12, lineHeight: 1.6 }}>
        Educational material only, not financial advice. Episode prices are real historical closes, each with a source link;
        live desk quotes are web-sourced and cited at the moment you trade.
      </footer>
    </div>
  );
}

function DrillCardView({ card, locked, busy, onOpen }: { card: DrillCard; locked: boolean; busy: boolean; onOpen: () => void }) {
  const diff = DIFFICULTY[card.difficulty];
  const isEpisode = card.kind === "episode";
  const cleared = (card.progress?.bestStars ?? 0) > 0;

  return (
    <button
      className="pr-card"
      onClick={onOpen}
      disabled={locked || busy}
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        gap: 12,
        background: SURFACE,
        border: `1px solid ${cleared ? "rgba(34,197,94,0.28)" : BORDER}`,
        borderRadius: 12,
        padding: 20,
        cursor: locked ? "default" : busy ? "wait" : "pointer",
        minHeight: 196,
        font: "inherit",
      }}
    >
      {/* top row: kind + difficulty */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: isEpisode ? GOOD : ACCENT, fontFamily: MONO, fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 650 }}>
          {isEpisode ? <ChartIcon size={14} /> : <PenIcon size={14} />}
          {isEpisode ? "Trade" : "Write"}
        </span>
        <span style={{ color: diff.color, fontFamily: MONO, fontSize: 10, letterSpacing: "0.06em", textTransform: "uppercase", border: `1px solid ${diff.color}44`, borderRadius: 100, padding: "2px 8px" }}>
          {diff.label}
        </span>
        <span style={{ marginLeft: "auto", color: FAINT, fontFamily: MONO, fontSize: 11 }}>+{card.xp} XP</span>
      </div>

      {/* title + hook */}
      <div>
        <h3 style={{ color: locked ? MUTED : INK, fontFamily: DISPLAY, fontSize: 20, fontWeight: 550, letterSpacing: "-0.01em", margin: "0 0 6px" }}>
          {card.title}
        </h3>
        <p style={{ color: MUTED, fontFamily: SERIF, fontSize: 13.5, lineHeight: 1.5, margin: 0 }}>{card.hook}</p>
      </div>

      {/* meta footer */}
      <div style={{ marginTop: "auto", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        {isEpisode && card.ticker && (
          <span style={{ color: FAINT, fontFamily: MONO, fontSize: 11 }}>{card.ticker} · {card.period}</span>
        )}
        {card.progress && card.progress.bestStars > 0 ? (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 3, color: CREDIT, marginLeft: isEpisode && card.ticker ? "auto" : 0 }}>
            {[0, 1, 2].map((i) => (
              <StarIcon key={i} size={14} filled={i < card.progress!.bestStars} style={{ opacity: i < card.progress!.bestStars ? 1 : 0.25 }} />
            ))}
            <span style={{ color: FAINT, fontFamily: MONO, fontSize: 11, marginLeft: 5 }}>best {card.progress.bestScore}</span>
          </span>
        ) : (
          <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 5, color: locked ? FAINT : ACCENT, fontFamily: SANS, fontSize: 13, fontWeight: 650 }}>
            {locked ? <LockIcon size={14} /> : busy ? "Loading…" : <>Start <ChevronRightIcon size={14} /></>}
          </span>
        )}
      </div>

      {locked && (
        <span style={{ position: "absolute", inset: 0, borderRadius: 12, background: "rgba(5,13,26,0.35)", display: "flex", alignItems: "center", justifyContent: "center", color: FAINT }}>
          <LockIcon size={22} />
        </span>
      )}
    </button>
  );
}

function primaryBtn(color: string): React.CSSProperties {
  return {
    display: "inline-flex", alignItems: "center", gap: 8, minHeight: 44,
    border: `1px solid ${color}`, borderRadius: 9, background: color, color: "#04101f",
    padding: "0 20px", fontSize: 14, fontWeight: 700, fontFamily: SANS, cursor: "pointer",
  };
}
