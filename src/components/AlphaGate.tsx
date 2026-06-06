"use client";

import { useEffect, useState, useCallback } from "react";
import type {
  AlphaAggregate,
  AlphaPick,
  AlphaPickSource,
  CalibrationStats,
  LensScore,
  MosaicEdgeFactor,
  RegimeStance,
  Scenario,
} from "@/lib/alphaTypes";

// ── Types from the APIs ─────────────────────────────────────────────────────

interface AlphaStatus {
  hasPublication: boolean;
  runId: string | null;
  publishedDate: string | null;
  unlocked: boolean;
  credits: number;
  cost: number;
  isNew: boolean;
}

interface PicksData {
  active: AlphaPick[];
  recently_exited: AlphaPick[];
  last_run: string | null;
  locked: boolean;
  aggregate: AlphaAggregate | null;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso + "T00:00:00Z").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

// ── Main gate ─────────────────────────────────────────────────────────────────

export function AlphaGate() {
  const [status, setStatus] = useState<AlphaStatus | null>(null);
  const [picks, setPicks] = useState<PicksData | null>(null);
  const [calibration, setCalibration] = useState<CalibrationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [unlocking, setUnlocking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [sRes, pRes, cRes] = await Promise.all([
        fetch("/api/alpha/status"),
        fetch("/api/alpha/picks"),
        fetch("/api/alpha/calibration"),
      ]);

      if (sRes.status === 401 || pRes.status === 401 || cRes.status === 401) {
        window.location.href = "/login?next=/alpha";
        return;
      }

      const s = (await sRes.json()) as AlphaStatus;
      const p = (await pRes.json()) as PicksData;
      setStatus(s);
      setPicks(p);
      // Calibration is a trust signal, not gated — tolerate its absence.
      if (cRes.ok) setCalibration((await cRes.json()) as CalibrationStats);
    } catch {
      setError("Could not load the Alpha Tracker. Please refresh.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleUnlock() {
    setUnlocking(true);
    setError(null);
    try {
      const res = await fetch("/api/alpha/unlock", { method: "POST" });
      const data = await res.json();

      if (res.status === 401) {
        window.location.href = "/login?next=/alpha";
        return;
      }
      if (res.status === 402) {
        setError(
          `You need ${data.cost} credits to unlock this publication but have ${data.credits}. Top up on the Pricing page.`,
        );
        return;
      }
      if (!res.ok || !data.ok) {
        setError("Unlock failed. Please try again.");
        return;
      }

      // Success — reveal the picks.
      await load();
    } catch {
      setError("Unlock failed. Please try again.");
    } finally {
      setUnlocking(false);
    }
  }

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "64px 0", justifyContent: "center" }}>
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#4f87f7" }} className="pulse" />
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: "rgba(232,237,248,0.4)" }}>
          Loading the Alpha Tracker…
        </span>
      </div>
    );
  }

  const unlocked = status?.unlocked ?? false;

  return (
    <>
      <AlphaHeader
        publishedDate={status?.publishedDate ?? picks?.last_run ?? null}
        unlocked={unlocked}
        hasPublication={status?.hasPublication ?? false}
      />

      {/* Aggregate return — ungated trust signal, shown whether or not the
          current publication is unlocked. Hidden until a position has a return. */}
      {picks?.aggregate && <AggregateBar agg={picks.aggregate} />}

      {error && (
        <div style={{
          background: "rgba(239,68,68,0.08)",
          border: "1px solid rgba(239,68,68,0.25)",
          borderRadius: 10,
          padding: "12px 16px",
          marginBottom: 24,
          fontFamily: "var(--font-serif), Georgia, serif",
          fontSize: 13,
          color: "#f87171",
        }}>
          {error}
        </div>
      )}

      {/* No publication exists at all */}
      {status && !status.hasPublication ? (
        <EmptyState />
      ) : unlocked ? (
        <ActivePicks picks={picks?.active ?? []} />
      ) : (
        <LockScreen
          cost={status?.cost ?? 60}
          credits={status?.credits ?? 0}
          publishedDate={status?.publishedDate ?? null}
          onUnlock={handleUnlock}
          unlocking={unlocking}
        />
      )}

      {/* Calibration — the self-scoring record behind every risk number */}
      {calibration && <CalibrationPanel stats={calibration} />}

      {/* Recently exited track record — always visible to signed-in users */}
      {picks && picks.recently_exited.length > 0 && (
        <RecentlyExited rows={picks.recently_exited} />
      )}

      <Disclaimer />
    </>
  );
}

// ── Page header ────────────────────────────────────────────────────────────────

function AlphaHeader({
  publishedDate,
  unlocked,
  hasPublication,
}: {
  publishedDate: string | null;
  unlocked: boolean;
  hasPublication: boolean;
}) {
  return (
    <div style={{ marginBottom: 40 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <div style={{ height: 1, width: 32, background: "rgba(232,237,248,0.3)" }} />
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(232,237,248,0.62)" }}>
          Alpha Tracker
        </span>
      </div>
      <h1 style={{
        fontFamily: "var(--font-display), Georgia, serif",
        fontWeight: 600,
        fontSize: "clamp(32px, 4vw, 52px)",
        letterSpacing: "-0.02em",
        color: "#e8edf8",
        margin: "0 0 12px",
        lineHeight: 1.1,
      }}>
        Active Positions
      </h1>
      <p style={{ fontFamily: "var(--font-serif), Georgia, serif", fontSize: 15, color: "rgba(232,237,248,0.55)", margin: 0, lineHeight: 1.7 }}>
        Full thesis for every pick. Price changes updated each run. Losses published alongside wins.
      </p>
      {hasPublication && publishedDate && (
        <div style={{ marginTop: 16, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "rgba(232,237,248,0.35)", background: "rgba(232,237,248,0.04)", border: "1px solid rgba(232,237,248,0.08)", borderRadius: 6, padding: "4px 10px" }}>
            Published: {publishedDate}
          </span>
          {unlocked && (
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "#34d399", background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.25)", borderRadius: 6, padding: "4px 10px" }}>
              Unlocked
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ── Aggregate return bar (the headline "how is the desk doing" stat) ────────

function AggStat({ label, value, color, hint }: { label: string; value: string; color: string; hint?: string }) {
  return (
    <div>
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.14em", color: "rgba(232,237,248,0.4)", textTransform: "uppercase", marginBottom: 5 }}>{label}</div>
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 19, fontWeight: 700, color }}>{value}</div>
      {hint && <div style={{ fontFamily: "var(--font-serif), Georgia, serif", fontSize: 10, color: "rgba(232,237,248,0.3)", marginTop: 1 }}>{hint}</div>}
    </div>
  );
}

function AggregateBar({ agg }: { agg: AlphaAggregate }) {
  const up = agg.avgReturnPct >= 0;
  const color = up ? "#22c55e" : "#ef4444";
  const sign = up ? "+" : "";
  // Only break out live-vs-closed when there is a genuine mix; otherwise the
  // headline already IS that single bucket and the split would just repeat it.
  const showSplit = agg.activeCount > 0 && agg.closedCount > 0;

  return (
    <section style={{ marginBottom: 32 }}>
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 24,
        background: `linear-gradient(160deg, ${up ? "rgba(16,185,129,0.08)" : "rgba(239,68,68,0.07)"} 0%, rgba(10,19,35,0.6) 62%)`,
        border: `1px solid ${up ? "rgba(16,185,129,0.22)" : "rgba(239,68,68,0.22)"}`,
        borderRadius: 16,
        padding: "20px 26px",
      }}>
        {/* Headline */}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <span className="pulse" style={{ width: 7, height: 7, borderRadius: "50%", background: color }} />
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(232,237,248,0.55)" }}>
              Aggregate Return
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 44, fontWeight: 700, color, letterSpacing: "-1.5px", lineHeight: 1 }}>
              {sign}{agg.avgReturnPct.toFixed(1)}%
            </span>
            <span style={{ fontFamily: "var(--font-serif), Georgia, serif", fontSize: 12.5, color: "rgba(232,237,248,0.45)" }}>
              avg per position
            </span>
          </div>
        </div>

        {/* Breakdown */}
        <div style={{ display: "flex", gap: 28, flexWrap: "wrap" }}>
          <AggStat label="Positions" value={`${agg.positions}`} color="#e8edf8" />
          <AggStat label="Up / Down" value={`${agg.winners} / ${agg.losers}`} color="#6eb6ff" />
          {showSplit && agg.activeAvgReturnPct !== null && (
            <AggStat
              label="Live book"
              value={`${agg.activeAvgReturnPct >= 0 ? "+" : ""}${agg.activeAvgReturnPct.toFixed(1)}%`}
              color={agg.activeAvgReturnPct >= 0 ? "#34d399" : "#f87171"}
              hint={`${agg.activeCount} open`}
            />
          )}
          {showSplit && agg.closedAvgReturnPct !== null && (
            <AggStat
              label="Closed"
              value={`${agg.closedAvgReturnPct >= 0 ? "+" : ""}${agg.closedAvgReturnPct.toFixed(1)}%`}
              color={agg.closedAvgReturnPct >= 0 ? "#34d399" : "#f87171"}
              hint={`${agg.closedCount} realized`}
            />
          )}
        </div>
      </div>
      <p style={{ fontFamily: "var(--font-serif), Georgia, serif", fontSize: 11, fontStyle: "italic", color: "rgba(232,237,248,0.3)", margin: "8px 4px 0", lineHeight: 1.5 }}>
        Equal-weighted average return across every position the Council has published — open marks and closed exits, winners and losers alike. Past performance is not indicative of future results.
      </p>
    </section>
  );
}

// ── Lock screen ─────────────────────────────────────────────────────────────────

function LockScreen({
  cost,
  credits,
  publishedDate,
  onUnlock,
  unlocking,
}: {
  cost: number;
  credits: number;
  publishedDate: string | null;
  onUnlock: () => void;
  unlocking: boolean;
}) {
  const canAfford = credits >= cost;

  return (
    <section style={{ marginBottom: 56 }}>
      <div style={{
        position: "relative",
        background: "linear-gradient(160deg, rgba(10,19,35,0.9) 0%, rgba(13,25,46,0.9) 100%)",
        border: "1px solid rgba(79,135,247,0.22)",
        borderRadius: 18,
        padding: "56px 40px",
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 18,
        overflow: "hidden",
      }}>
        {/* Lock icon */}
        <div style={{
          width: 56,
          height: 56,
          borderRadius: "50%",
          background: "rgba(79,135,247,0.12)",
          border: "1px solid rgba(79,135,247,0.3)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style={{ color: "#6eb6ff" }}>
            <rect x="5" y="11" width="14" height="9" rx="2" stroke="currentColor" strokeWidth="1.6" />
            <path d="M8 11V8a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </div>

        <div>
          <h2 style={{
            fontFamily: "var(--font-display), Georgia, serif",
            fontWeight: 600,
            fontSize: 26,
            color: "#e8edf8",
            margin: "0 0 8px",
          }}>
            This week&apos;s picks are locked
          </h2>
          <p style={{
            fontFamily: "var(--font-serif), Georgia, serif",
            fontSize: 14,
            color: "rgba(232,237,248,0.6)",
            margin: 0,
            lineHeight: 1.65,
            maxWidth: 460,
          }}>
            Unlocking reveals the full thesis, entry, target, stop, conviction
            and every source for the current Council publication
            {publishedDate ? ` (published ${publishedDate})` : ""}. Pay once —
            re-view these picks free until a new publication drops.
          </p>
        </div>

        {/* Cost callout */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          background: "rgba(232,237,248,0.03)",
          border: "1px solid rgba(232,237,248,0.08)",
          borderRadius: 12,
          padding: "14px 22px",
        }}>
          <div style={{ textAlign: "left" }}>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 22, fontWeight: 700, color: "#e8edf8" }}>
              {cost} <span style={{ fontSize: 13, fontWeight: 400, color: "rgba(232,237,248,0.5)" }}>credits</span>
            </div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "rgba(232,237,248,0.4)", marginTop: 2 }}>
              will be deducted
            </div>
          </div>
          <div style={{ width: 1, height: 36, background: "rgba(232,237,248,0.1)" }} />
          <div style={{ textAlign: "left" }}>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 22, fontWeight: 700, color: canAfford ? "#34d399" : "#f87171" }}>
              {credits.toLocaleString()}
            </div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "rgba(232,237,248,0.4)", marginTop: 2 }}>
              your balance
            </div>
          </div>
        </div>

        {canAfford ? (
          <button
            onClick={onUnlock}
            disabled={unlocking}
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 13,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "#050d1a",
              background: unlocking ? "rgba(110,182,255,0.6)" : "#6eb6ff",
              border: "none",
              borderRadius: 100,
              padding: "13px 34px",
              cursor: unlocking ? "default" : "pointer",
              fontWeight: 600,
              transition: "background 0.2s",
            }}
          >
            {unlocking ? "Unlocking…" : `Unlock for ${cost} credits`}
          </button>
        ) : (
          <a
            href="/pricing"
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 13,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "#050d1a",
              background: "#6eb6ff",
              border: "none",
              borderRadius: 100,
              padding: "13px 34px",
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            Top up credits →
          </a>
        )}

        <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "rgba(232,237,248,0.3)", margin: 0, letterSpacing: "0.04em" }}>
          One-time charge per publication · free re-views until the next run
        </p>
      </div>
    </section>
  );
}

// ── Active picks ──────────────────────────────────────────────────────────────

function ActivePicks({ picks }: { picks: AlphaPick[] }) {
  // The regime is stamped on each pick at entry. Surface the newest one that
  // carries a regime read as the desk's current macro framing.
  const regimePick = picks.find((p) => p.regime_stance);

  return (
    <section style={{ marginBottom: 64 }}>
      {regimePick?.regime_stance && (
        <RegimeBanner
          stance={regimePick.regime_stance}
          summary={regimePick.regime_summary ?? null}
        />
      )}

      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(232,237,248,0.4)", marginBottom: 20 }}>
        Active ({picks.length})
      </div>

      {picks.length === 0 ? (
        <EmptyState />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 20 }}>
          {picks.map((pick, i) => (
            <PickCard key={pick.id ?? pick.ticker} pick={pick} index={i} />
          ))}
        </div>
      )}
    </section>
  );
}

function EmptyState() {
  return (
    <section style={{ marginBottom: 56 }}>
      <div style={{
        background: "rgba(10,19,35,0.5)",
        border: "1px solid rgba(232,237,248,0.07)",
        borderRadius: 14,
        padding: "56px 48px",
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 14,
      }}>
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" style={{ color: "rgba(79,135,247,0.28)" }}>
          <path d="M2 20h20M6 20V10M10 20V4M14 20V8M18 20V13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <div>
          <p style={{ fontFamily: "var(--font-serif), Georgia, serif", fontSize: 14, color: "rgba(232,237,248,0.5)", margin: "0 0 4px" }}>
            No active positions at this time.
          </p>
          <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "rgba(232,237,248,0.25)", margin: 0, letterSpacing: "0.04em" }}>
            Check back after the next research run.
          </p>
        </div>
      </div>
    </section>
  );
}

// ── Recently exited ──────────────────────────────────────────────────────────

function RecentlyExited({ rows }: { rows: AlphaPick[] }) {
  return (
    <section style={{ marginBottom: 48 }}>
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(232,237,248,0.3)", marginBottom: 16 }}>
        Recently Exited
      </div>
      <div style={{
        background: "rgba(10,19,35,0.5)",
        border: "1px solid rgba(232,237,248,0.07)",
        borderRadius: 14,
        overflow: "hidden",
      }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 520 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(232,237,248,0.06)", background: "rgba(232,237,248,0.02)" }}>
                {["Ticker", "Company", "Added", "Exited", "Reason"].map((h) => (
                  <th key={h} style={{ textAlign: "left", padding: "10px 16px", fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(232,237,248,0.55)", fontWeight: 500 }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((pick, i) => (
                <tr key={pick.id ?? i} style={{ borderBottom: "1px solid rgba(232,237,248,0.04)" }}>
                  <td style={{ padding: "10px 16px", fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 700, color: "#e8edf8" }}>{pick.ticker}</td>
                  <td style={{ padding: "10px 16px", fontFamily: "var(--font-serif), Georgia, serif", fontSize: 13, color: "rgba(232,237,248,0.55)" }}>{pick.company_name}</td>
                  <td style={{ padding: "10px 16px", fontFamily: "'JetBrains Mono', monospace", fontSize: 11.5, color: "rgba(232,237,248,0.58)" }}>{formatDate(pick.entry_date)}</td>
                  <td style={{ padding: "10px 16px", fontFamily: "'JetBrains Mono', monospace", fontSize: 11.5, color: "rgba(232,237,248,0.58)" }}>
                    {pick.exit_date ? formatDate(pick.exit_date) : "—"}
                  </td>
                  <td style={{ padding: "10px 16px", fontFamily: "var(--font-serif), Georgia, serif", fontSize: 12, color: "rgba(232,237,248,0.45)", maxWidth: 280 }}>
                    {pick.exit_reason ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

// ── Calibration panel (the self-scoring track record) ───────────────────────

function CalStat({ label, value, color, hint }: { label: string; value: string; color: string; hint?: string }) {
  return (
    <div>
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.14em", color: "rgba(232,237,248,0.4)", textTransform: "uppercase", marginBottom: 5 }}>{label}</div>
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 22, fontWeight: 700, color }}>{value}</div>
      {hint && <div style={{ fontFamily: "var(--font-serif), Georgia, serif", fontSize: 10, color: "rgba(232,237,248,0.3)", marginTop: 1 }}>{hint}</div>}
    </div>
  );
}

function CalibrationBar({ bucket }: { bucket: { label: string; n: number; predicted: number; actual: number } }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, flexWrap: "wrap", gap: 6 }}>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "rgba(232,237,248,0.6)" }}>
          {bucket.label} <span style={{ color: "rgba(232,237,248,0.3)" }}>· n={bucket.n}</span>
        </span>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "rgba(232,237,248,0.55)" }}>
          predicted {bucket.predicted.toFixed(0)}% → actual <span style={{ color: "#34d399" }}>{bucket.actual.toFixed(0)}%</span>
        </span>
      </div>
      <div style={{ position: "relative", height: 6, borderRadius: 3, background: "rgba(232,237,248,0.06)" }}>
        <div style={{ width: `${Math.min(100, Math.max(0, bucket.actual))}%`, height: "100%", borderRadius: 3, background: "rgba(52,211,153,0.6)" }} />
        {/* predicted marker */}
        <div title={`predicted ${bucket.predicted.toFixed(0)}%`} style={{ position: "absolute", left: `${Math.min(100, Math.max(0, bucket.predicted))}%`, top: -2, width: 2, height: 10, background: "rgba(110,182,255,0.9)" }} />
      </div>
    </div>
  );
}

function CalibrationPanel({ stats }: { stats: CalibrationStats }) {
  const hasData = stats.resolved > 0;
  return (
    <section style={{ marginBottom: 48 }}>
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(232,237,248,0.4)", marginBottom: 16 }}>
        Track Record &amp; Calibration
      </div>
      <div style={{ background: "rgba(10,19,35,0.5)", border: "1px solid rgba(232,237,248,0.07)", borderRadius: 14, padding: 24 }}>
        {!hasData ? (
          <p style={{ fontFamily: "var(--font-serif), Georgia, serif", fontSize: 13.5, color: "rgba(232,237,248,0.55)", lineHeight: 1.7, margin: 0 }}>
            No predictions have resolved yet. As each pick reaches its target, stop, or horizon,
            we grade the forecast and publish our accuracy here — stated confidence versus what
            actually happened. The risk number on every pick earns its trust from this record.
          </p>
        ) : (
          <>
            <p style={{ fontFamily: "var(--font-serif), Georgia, serif", fontSize: 14, color: "rgba(232,237,248,0.78)", lineHeight: 1.7, margin: "0 0 20px" }}>
              Across <strong style={{ color: "#e8edf8" }}>{stats.resolved}</strong> resolved prediction{stats.resolved === 1 ? "" : "s"},
              an average stated confidence of <strong style={{ color: "#6eb6ff" }}>{stats.avgConfidence.toFixed(0)}%</strong> has
              translated into a <strong style={{ color: "#34d399" }}>{stats.hitRate.toFixed(0)}%</strong> hit rate.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 16, marginBottom: 24 }}>
              <CalStat label="Hit rate" value={`${stats.hitRate.toFixed(0)}%`} color="#34d399" />
              <CalStat label="Predictions" value={`${stats.resolved}`} color="#e8edf8" />
              <CalStat label="Brier score" value={stats.brier.toFixed(3)} color="#6eb6ff" hint="0 = perfect" />
              <CalStat label="Avg return" value={`${stats.avgRealizedReturnPct >= 0 ? "+" : ""}${stats.avgRealizedReturnPct.toFixed(1)}%`} color={stats.avgRealizedReturnPct >= 0 ? "#34d399" : "#f87171"} />
            </div>
            {stats.buckets.length > 0 && (
              <div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.14em", color: "rgba(232,237,248,0.4)", textTransform: "uppercase", marginBottom: 12 }}>
                  Predicted vs. actual by confidence band
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {stats.buckets.map((b) => (
                    <CalibrationBar key={b.label} bucket={b} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
        <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "rgba(232,237,248,0.3)", margin: `${hasData ? 20 : 16}px 0 0`, letterSpacing: "0.03em", lineHeight: 1.6 }}>
          Published confidence is capped at {stats.maxPublishableConfidence}% until the record earns the right to claim more.
        </p>
      </div>
    </section>
  );
}

function Disclaimer() {
  return (
    <p style={{ fontFamily: "var(--font-serif), Georgia, serif", fontSize: 12, color: "rgba(232,237,248,0.3)", lineHeight: 1.8, fontStyle: "italic" }}>
      Paper-trading exercise for educational purposes only. Nothing published here constitutes investment advice.
      Every number has a source URL. The full track record, wins and losses, is published without omission.
    </p>
  );
}

// ── Regime banner ────────────────────────────────────────────────────────────

const REGIME_THEME: Record<RegimeStance, { label: string; color: string; bg: string; border: string }> = {
  RISK_ON: { label: "Risk-On", color: "#34d399", bg: "rgba(16,185,129,0.08)", border: "rgba(16,185,129,0.28)" },
  NEUTRAL: { label: "Neutral", color: "#6eb6ff", bg: "rgba(79,135,247,0.08)", border: "rgba(79,135,247,0.28)" },
  RISK_OFF: { label: "Risk-Off", color: "#f87171", bg: "rgba(239,68,68,0.08)", border: "rgba(239,68,68,0.28)" },
};

function RegimeBanner({ stance, summary }: { stance: RegimeStance; summary: string | null }) {
  const t = REGIME_THEME[stance];
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: 16,
      background: t.bg,
      border: `1px solid ${t.border}`,
      borderRadius: 12,
      padding: "14px 18px",
      marginBottom: 24,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: t.color }} />
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: t.color }}>
          {t.label}
        </span>
      </div>
      <div style={{ width: 1, alignSelf: "stretch", background: "rgba(232,237,248,0.1)" }} />
      <div>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(232,237,248,0.35)", marginBottom: 3 }}>
          Macro regime at entry
        </div>
        <p style={{ fontFamily: "var(--font-serif), Georgia, serif", fontSize: 13, color: "rgba(232,237,248,0.75)", margin: 0, lineHeight: 1.55 }}>
          {summary || "Regime read recorded for this publication."}
        </p>
      </div>
    </div>
  );
}

// ── 6-lens council scorecard ───────────────────────────────────────────────────

const LENS_SIGNAL_COLOR: Record<string, string> = {
  bullish: "#34d399",
  neutral: "rgba(232,237,248,0.5)",
  bearish: "#f87171",
};

function LensScorecard({ lenses }: { lenses: LensScore[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {lenses.map((l) => {
        const color = LENS_SIGNAL_COLOR[l.signal] ?? "rgba(232,237,248,0.5)";
        const pct = Math.max(0, Math.min(10, l.score)) * 10;
        return (
          <div key={l.lens} title={l.note} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "rgba(232,237,248,0.55)", width: 78, flexShrink: 0 }}>
              {l.lens}
            </span>
            <div style={{ flex: 1, height: 5, borderRadius: 3, background: "rgba(232,237,248,0.06)", overflow: "hidden" }}>
              <div style={{ width: `${pct}%`, height: "100%", borderRadius: 3, background: color, opacity: 0.7 }} />
            </div>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fontWeight: 600, color, width: 30, textAlign: "right", flexShrink: 0 }}>
              {l.score.toFixed(1)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Pick card + sub-components ──────────────────────────────────────────────────

function ConvictionBar({ conviction }: { conviction: number }) {
  const filled = Math.max(0, Math.min(10, conviction));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", gap: 3 }}>
        {Array.from({ length: 10 }, (_, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              height: 4,
              borderRadius: 2,
              background: i < filled
                ? `rgba(79, 135, 247, ${0.28 + (i / 10) * 0.72})`
                : "rgba(79,135,247,0.08)",
              transition: "background 0.2s",
            }}
          />
        ))}
      </div>
      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "rgba(232,237,248,0.4)", letterSpacing: "0.08em" }}>
        {conviction}/10 conviction
      </span>
    </div>
  );
}

function PriceChange({ pick }: { pick: AlphaPick }) {
  const changePct = pick.price_change_pct;
  const currentPrice = pick.current_price;

  if (currentPrice == null || changePct == null) return null;

  const isUp = changePct >= 0;
  const color = isUp ? "#22c55e" : "#ef4444";
  const sign = isUp ? "+" : "";

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 20, fontWeight: 700, color, letterSpacing: "-0.5px" }}>
        {sign}{changePct.toFixed(2)}%
      </div>
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: "rgba(232,237,248,0.45)", marginTop: 1 }}>
        ${currentPrice.toFixed(2)} now
      </div>
      {pick.price_last_updated && (
        <div style={{ fontFamily: "var(--font-serif), Georgia, serif", fontSize: 10, color: "rgba(232,237,248,0.3)", marginTop: 2 }}>
          Updated {formatDate(pick.price_last_updated)}
        </div>
      )}
    </div>
  );
}

function SourceCitations({ sources }: { sources: AlphaPickSource[] }) {
  function domain(url: string): string {
    try { return new URL(url).hostname.replace(/^www\./, ""); }
    catch { return url.slice(0, 30); }
  }
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {sources.map((s, i) => (
        <a
          key={i}
          href={s.url}
          target="_blank"
          rel="noopener noreferrer"
          title={s.title}
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 10,
            color: "rgba(232,237,248,0.35)",
            textDecoration: "underline",
            textUnderlineOffset: 2,
          }}
        >
          [{i + 1}] {domain(s.url)}
        </a>
      ))}
    </div>
  );
}

// ── Forecast block (the headline prediction + risk) ─────────────────────────

function StatPair({ label, value, color, hint }: { label: string; value: string; color: string; hint?: string }) {
  return (
    <div>
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.14em", color: "rgba(232,237,248,0.4)", textTransform: "uppercase", marginBottom: 3 }}>{label}</div>
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 16, fontWeight: 700, color }}>{value}</div>
      {hint && <div style={{ fontFamily: "var(--font-serif), Georgia, serif", fontSize: 10, color: "rgba(232,237,248,0.3)", marginTop: 1 }}>{hint}</div>}
    </div>
  );
}

function ConfidenceGauge({ confidence, risk }: { confidence: number; risk: number }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "#34d399", fontWeight: 600 }}>
          {confidence.toFixed(0)}% confidence
        </span>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "#f59e0b", fontWeight: 600 }}>
          {risk.toFixed(0)}% risk
        </span>
      </div>
      <div style={{ display: "flex", height: 8, borderRadius: 4, overflow: "hidden", background: "rgba(232,237,248,0.06)" }}>
        <div style={{ width: `${confidence}%`, background: "linear-gradient(90deg, #4f87f7, #34d399)" }} />
        <div style={{ width: `${risk}%`, background: "rgba(245,158,11,0.55)" }} />
      </div>
      <div style={{ fontFamily: "var(--font-serif), Georgia, serif", fontSize: 10.5, color: "rgba(232,237,248,0.32)", marginTop: 5 }}>
        Modeled probability of reaching the target within the horizon.
      </div>
    </div>
  );
}

const SCENARIO_THEME: Record<string, { label: string; color: string }> = {
  bear: { label: "Bear", color: "#f87171" },
  base: { label: "Base", color: "#6eb6ff" },
  bull: { label: "Bull", color: "#34d399" },
};

function ScenarioDistribution({ scenarios }: { scenarios: Scenario[] }) {
  const order = ["bear", "base", "bull"];
  const sorted = [...scenarios].sort((a, b) => order.indexOf(a.label) - order.indexOf(b.label));
  return (
    <div>
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.14em", color: "rgba(232,237,248,0.4)", textTransform: "uppercase", marginBottom: 7 }}>
        Scenarios at horizon
      </div>
      <div style={{ display: "flex", height: 6, borderRadius: 3, overflow: "hidden", marginBottom: 10, gap: 2 }}>
        {sorted.map((s) => (
          <div
            key={s.label}
            title={`${SCENARIO_THEME[s.label]?.label}: ${s.probability}%`}
            style={{ width: `${s.probability}%`, background: SCENARIO_THEME[s.label]?.color ?? "#6eb6ff", opacity: 0.75, borderRadius: 2 }}
          />
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
        {sorted.map((s) => {
          const t = SCENARIO_THEME[s.label] ?? { label: s.label, color: "#6eb6ff" };
          return (
            <div key={s.label} style={{ borderLeft: `2px solid ${t.color}`, paddingLeft: 8 }}>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: t.color, fontWeight: 600 }}>
                {t.label} · {s.probability}%
              </div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: "#e8edf8", fontWeight: 600, marginTop: 2 }}>
                ${s.price.toFixed(2)}
              </div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: s.returnPct >= 0 ? "rgba(52,211,153,0.7)" : "rgba(248,113,113,0.7)", marginTop: 1 }}>
                {s.returnPct >= 0 ? "+" : ""}{s.returnPct.toFixed(1)}%
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ForecastBlock({ pick }: { pick: AlphaPick }) {
  if (pick.predicted_price == null || pick.confidence_pct == null) return null;
  const conf = Math.max(0, Math.min(100, pick.confidence_pct));
  const risk = Math.round((100 - conf) * 10) / 10;
  const upside =
    pick.entry_price > 0
      ? ((pick.predicted_price - pick.entry_price) / pick.entry_price) * 100
      : null;

  return (
    <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(232,237,248,0.06)", background: "linear-gradient(160deg, rgba(79,135,247,0.07), rgba(16,185,129,0.04))" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.18em", color: "rgba(110,182,255,0.85)", textTransform: "uppercase" }}>
          Forecast
        </div>
        {pick.horizon_days != null && (
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "rgba(232,237,248,0.5)", border: "1px solid rgba(232,237,248,0.12)", borderRadius: 6, padding: "2px 8px" }}>
            {pick.horizon_days}-day horizon
          </span>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap", marginBottom: 2 }}>
        <span style={{ fontFamily: "var(--font-serif), Georgia, serif", fontSize: 13, color: "rgba(232,237,248,0.55)" }}>Predicts</span>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 30, fontWeight: 700, color: "#e8edf8", letterSpacing: "-1px", lineHeight: 1 }}>
          ${pick.predicted_price.toFixed(2)}
        </span>
        {upside != null && (
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 15, fontWeight: 600, color: upside >= 0 ? "#22c55e" : "#ef4444" }}>
            {upside >= 0 ? "+" : ""}{upside.toFixed(1)}%
          </span>
        )}
      </div>
      {pick.target_date && (
        <div style={{ fontFamily: "var(--font-serif), Georgia, serif", fontSize: 12, color: "rgba(232,237,248,0.45)", marginBottom: 14 }}>
          by {formatDate(pick.target_date)}
        </div>
      )}

      <ConfidenceGauge confidence={conf} risk={risk} />

      {pick.scenarios && pick.scenarios.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <ScenarioDistribution scenarios={pick.scenarios} />
        </div>
      )}

      <div style={{ display: "flex", gap: 24, marginTop: 14, flexWrap: "wrap" }}>
        {pick.expected_value_pct != null && (
          <StatPair label="Expected value" value={`${pick.expected_value_pct >= 0 ? "+" : ""}${pick.expected_value_pct.toFixed(1)}%`} color={pick.expected_value_pct >= 0 ? "#34d399" : "#f87171"} hint="probability-weighted" />
        )}
        {pick.prob_of_loss_pct != null && (
          <StatPair label="Downside risk" value={`${pick.prob_of_loss_pct.toFixed(0)}%`} color="#f59e0b" hint="chance below entry" />
        )}
      </div>

      {pick.forecast_basis && (
        <p style={{ fontFamily: "var(--font-serif), Georgia, serif", fontSize: 12.5, color: "rgba(232,237,248,0.62)", lineHeight: 1.6, margin: "14px 0 0" }}>
          {pick.forecast_basis}
        </p>
      )}
    </div>
  );
}

// ── Edge / variant perception block (the mosaic "small factors") ────────────

const EDGE_DIR_COLOR: Record<string, string> = {
  bullish: "#34d399",
  bearish: "#f59e0b",
  neutral: "rgba(232,237,248,0.45)",
};

const LANE_LABEL: Record<string, string> = {
  insider: "Insider",
  institutional: "13F flows",
  short_interest: "Short interest",
  options: "Options",
  supply_chain: "Supply chain",
  customers: "Customers",
  management: "Management",
  hiring: "Hiring",
  regulatory: "Regulatory",
  legal: "Legal",
  social_sentiment: "Social",
  technical_microstructure: "Microstructure",
  other: "Signal",
};

function EdgeBlock({ factors, summary }: { factors: MosaicEdgeFactor[]; summary?: string | null }) {
  return (
    <div style={{ padding: "14px 20px", borderBottom: "1px solid rgba(232,237,248,0.05)" }}>
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.14em", color: "rgba(167,139,250,0.85)", textTransform: "uppercase", marginBottom: 8 }}>
        Edge · variant perception
      </div>
      {summary && (
        <p style={{ fontFamily: "var(--font-serif), Georgia, serif", fontSize: 12.5, fontStyle: "italic", color: "rgba(232,237,248,0.68)", lineHeight: 1.6, margin: "0 0 12px" }}>
          {summary}
        </p>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        {factors.map((f, i) => {
          const color = EDGE_DIR_COLOR[f.direction] ?? "rgba(232,237,248,0.45)";
          return (
            <div key={i} style={{ borderLeft: `2px solid ${color}`, paddingLeft: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 2, flexWrap: "wrap" }}>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.05em", textTransform: "uppercase", color: "rgba(232,237,248,0.55)", background: "rgba(232,237,248,0.05)", borderRadius: 4, padding: "1px 6px" }}>
                  {LANE_LABEL[f.lane] ?? f.lane}
                </span>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  {f.direction} · {f.weight} weight
                </span>
              </div>
              <div style={{ fontFamily: "var(--font-serif), Georgia, serif", fontSize: 13, color: "rgba(232,237,248,0.82)", lineHeight: 1.5 }}>
                <span style={{ fontWeight: 600 }}>{f.factor}.</span> {f.detail}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PickCard({ pick, index = 0 }: { pick: AlphaPick; index?: number }) {
  const upside = pick.entry_price > 0
    ? (((pick.target_price - pick.entry_price) / pick.entry_price) * 100).toFixed(1)
    : null;
  const downside = pick.entry_price > 0
    ? (((pick.stop_loss - pick.entry_price) / pick.entry_price) * 100).toFixed(1)
    : null;

  return (
    <article className="pick-card" style={{
      background: "rgba(10,19,35,0.7)",
      border: "1px solid rgba(232,237,248,0.08)",
      borderLeft: "2px solid rgba(79,135,247,0.5)",
      borderRadius: 14,
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
      animation: "slide-up 0.28s ease-out both",
      animationDelay: `${index * 0.06}s`,
    }}>
      <div style={{
        padding: "16px 20px",
        borderBottom: "1px solid rgba(232,237,248,0.06)",
        background: "rgba(232,237,248,0.02)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 12,
      }}>
        <div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 28, color: "#e8edf8", letterSpacing: "-1px", lineHeight: 1 }}>
            {pick.ticker}
          </div>
          <div style={{ fontFamily: "var(--font-serif), Georgia, serif", fontSize: 12, color: "rgba(232,237,248,0.5)", marginTop: 3 }}>
            {pick.company_name}
          </div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11.5, color: "rgba(232,237,248,0.58)", marginTop: 6 }}>
            Entry ${pick.entry_price.toFixed(2)} · {formatDate(pick.entry_date)}
          </div>
        </div>
        <PriceChange pick={pick} />
      </div>

      <ForecastBlock pick={pick} />

      <div style={{ padding: "14px 20px", borderBottom: "1px solid rgba(232,237,248,0.05)" }}>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.18em", color: "rgba(110,182,255,0.7)", textTransform: "uppercase", marginBottom: 6 }}>
          Catalyst
        </div>
        <div style={{ fontFamily: "var(--font-serif), Georgia, serif", fontSize: 13, color: "rgba(232,237,248,0.85)", lineHeight: 1.6 }}>
          {pick.catalyst}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", borderBottom: "1px solid rgba(232,237,248,0.05)" }}>
        <div style={{ padding: "12px 20px", borderRight: "1px solid rgba(232,237,248,0.05)" }}>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.14em", color: "rgba(232,237,248,0.35)", textTransform: "uppercase", marginBottom: 5 }}>Target</div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 15, color: "#22c55e", fontWeight: 600 }}>${pick.target_price.toFixed(2)}</div>
          {upside && <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "rgba(34,197,94,0.6)", marginTop: 2 }}>+{upside}%</div>}
        </div>
        <div style={{ padding: "12px 20px" }}>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.14em", color: "rgba(232,237,248,0.35)", textTransform: "uppercase", marginBottom: 5 }}>Stop</div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 15, color: "rgba(232,237,248,0.5)", fontWeight: 500 }}>${pick.stop_loss.toFixed(2)}</div>
          {downside && <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "rgba(232,237,248,0.3)", marginTop: 2 }}>{downside}%</div>}
        </div>
      </div>

      {(pick.position_size_pct != null || pick.risk_reward != null) && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", borderBottom: "1px solid rgba(232,237,248,0.05)" }}>
          <div style={{ padding: "12px 20px", borderRight: "1px solid rgba(232,237,248,0.05)" }}>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.14em", color: "rgba(232,237,248,0.35)", textTransform: "uppercase", marginBottom: 5 }}>Book Weight</div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 15, color: "#6eb6ff", fontWeight: 600 }}>
              {pick.position_size_pct != null ? `${pick.position_size_pct}%` : "—"}
            </div>
          </div>
          <div style={{ padding: "12px 20px" }}>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.14em", color: "rgba(232,237,248,0.35)", textTransform: "uppercase", marginBottom: 5 }}>Reward : Risk</div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 15, color: pick.risk_reward != null && pick.risk_reward >= 2 ? "#22c55e" : "rgba(232,237,248,0.7)", fontWeight: 600 }}>
              {pick.risk_reward != null ? `${pick.risk_reward.toFixed(1)} : 1` : "—"}
            </div>
          </div>
        </div>
      )}

      <div style={{ padding: "14px 20px", borderBottom: "1px solid rgba(232,237,248,0.05)" }}>
        <ConvictionBar conviction={pick.conviction} />
      </div>

      {pick.lens_scores && pick.lens_scores.length > 0 && (
        <div style={{ padding: "14px 20px", borderBottom: "1px solid rgba(232,237,248,0.05)" }}>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.14em", color: "rgba(110,182,255,0.7)", textTransform: "uppercase", marginBottom: 10 }}>
            Council scorecard
          </div>
          <LensScorecard lenses={pick.lens_scores} />
        </div>
      )}

      {pick.edge_factors && pick.edge_factors.length > 0 && (
        <EdgeBlock factors={pick.edge_factors} summary={pick.edge_summary} />
      )}

      <div style={{ padding: "14px 20px", borderBottom: "1px solid rgba(232,237,248,0.05)" }}>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.14em", color: "rgba(34,197,94,0.6)", textTransform: "uppercase", marginBottom: 6 }}>
          Bull case
        </div>
        <p style={{ fontFamily: "var(--font-serif), Georgia, serif", fontSize: 13, color: "rgba(232,237,248,0.7)", lineHeight: 1.65, margin: 0 }}>
          {pick.bull_thesis}
        </p>
      </div>

      <div style={{ padding: "14px 20px", borderBottom: "1px solid rgba(232,237,248,0.05)", boxShadow: "inset 3px 0 0 rgba(245,158,11,0.35)" }}>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.14em", color: "rgba(245,158,11,0.65)", textTransform: "uppercase", marginBottom: 6 }}>
          Bear case
        </div>
        <p style={{ fontFamily: "var(--font-serif), Georgia, serif", fontSize: 13, color: "rgba(232,237,248,0.6)", lineHeight: 1.65, margin: 0 }}>
          {pick.bear_thesis}
        </p>
      </div>

      {pick.sources && pick.sources.length > 0 && (
        <div style={{ padding: "12px 20px" }}>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.14em", color: "rgba(232,237,248,0.25)", textTransform: "uppercase", marginBottom: 6 }}>
            Sources
          </div>
          <SourceCitations sources={pick.sources} />
        </div>
      )}
    </article>
  );
}
