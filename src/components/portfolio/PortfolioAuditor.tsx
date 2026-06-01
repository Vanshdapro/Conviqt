"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PortfolioAuditResult } from "@/lib/portfolio/types";
import {
  HoldingsInput,
  type DraftRow,
  rowsToHoldings,
  holdingsToRows,
} from "./HoldingsInput";
import { AuditReport } from "./AuditReport";

const BORDER = "rgba(232,237,248,0.09)";
const RULE = "rgba(232,237,248,0.075)";
const SURFACE = "#07121f";
const INK = "#e8edf8";
const MUTED = "#8aa0c2";
const FAINT = "#526684";
const ACCENT = "#4f87f7";
const GOOD = "#22c55e";
const DANGER = "#f87171";
const MONO = "var(--font-mono), 'JetBrains Mono', monospace";
const SANS = "var(--font-sans), system-ui, sans-serif";
const DISPLAY = "var(--font-display), Georgia, 'Times New Roman', serif";
const SERIF = "var(--font-serif), Georgia, serif";

const EMPTY_ROWS: DraftRow[] = [
  { ticker: "", shares: "", costBasis: "" },
  { ticker: "", shares: "", costBasis: "" },
  { ticker: "", shares: "", costBasis: "" },
];

type PortfolioListItem = {
  id: string;
  name: string;
  holdings: { ticker: string; shares: number; costBasis?: number }[];
  latestHealthScore: number | null;
  lastAuditedAt: string | null;
};

// Progress phases shown while the NDJSON stream runs.
const RISK_DIMENSIONS = [
  "Concentration",
  "Sector Overlap",
  "Macro Vulnerability",
  "Correlation",
  "Hidden Exposure",
] as const;

function healthColor(score: number | null): string {
  if (score === null) return FAINT;
  if (score >= 75) return GOOD;
  if (score >= 55) return "#f59e0b";
  return DANGER;
}

export function PortfolioAuditor({ cost }: { cost: number }) {
  const [portfolios, setPortfolios] = useState<PortfolioListItem[] | null>(null);
  const [activeId, setActiveId] = useState<string | undefined>(undefined);
  const [name, setName] = useState("My Portfolio");
  const [rows, setRows] = useState<DraftRow[]>(EMPTY_ROWS);

  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState<string>("");
  const [doneAgents, setDoneAgents] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PortfolioAuditResult | null>(null);
  const reportRef = useRef<HTMLDivElement>(null);

  // Load the user's saved portfolios on mount.
  useEffect(() => {
    fetch("/api/portfolio")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d && Array.isArray(d.portfolios)) setPortfolios(d.portfolios as PortfolioListItem[]);
        else setPortfolios([]);
      })
      .catch(() => setPortfolios([]));
  }, []);

  const loadPortfolio = useCallback((p: PortfolioListItem) => {
    setActiveId(p.id);
    setName(p.name);
    setRows(p.holdings.length ? holdingsToRows(p.holdings) : EMPTY_ROWS);
    setResult(null);
    setError(null);
  }, []);

  const newPortfolio = useCallback(() => {
    setActiveId(undefined);
    setName("My Portfolio");
    setRows(EMPTY_ROWS);
    setResult(null);
    setError(null);
  }, []);

  const runAudit = useCallback(async () => {
    const holdings = rowsToHoldings(rows);
    if (holdings.length < 2) return;

    setRunning(true);
    setError(null);
    setResult(null);
    setDoneAgents([]);
    setPhase("Fetching live prices & sectors…");

    try {
      const res = await fetch("/api/portfolio/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ portfolioId: activeId, name, holdings }),
      });

      if (!res.ok || !res.body) {
        let msg = "The audit could not be started.";
        try {
          const j = await res.json();
          if (j?.error) msg = j.error;
        } catch {
          /* non-JSON */
        }
        setError(msg);
        setRunning(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      const handle = (line: string) => {
        let msg: Record<string, unknown>;
        try {
          msg = JSON.parse(line);
        } catch {
          return;
        }
        switch (msg.type) {
          case "audit": {
            const ev = msg.event as { kind: string; agent?: { dimension: string } };
            if (ev.kind === "sweep_done") setPhase("Five risk agents stress-testing the book…");
            else if (ev.kind === "agent_done" && ev.agent)
              setDoneAgents((prev) =>
                prev.includes(ev.agent!.dimension) ? prev : [...prev, ev.agent!.dimension]
              );
            else if (ev.kind === "judge_done") setPhase("Synthesizing the verdict…");
            break;
          }
          case "audit_done": {
            const r = msg.result as PortfolioAuditResult;
            setResult(r);
            if (msg.portfolioId) setActiveId(msg.portfolioId as string);
            // Refresh the saved list so the sidebar reflects the new health score.
            fetch("/api/portfolio")
              .then((res2) => (res2.ok ? res2.json() : null))
              .then((d) => {
                if (d && Array.isArray(d.portfolios)) setPortfolios(d.portfolios as PortfolioListItem[]);
              })
              .catch(() => {});
            break;
          }
          case "error": {
            setError((msg.error as string) || "The audit failed.");
            break;
          }
          default:
            break;
        }
      };

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let nl;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (line) handle(line);
        }
      }
      if (buf.trim()) handle(buf.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : "The audit failed unexpectedly.");
    } finally {
      setRunning(false);
      setPhase("");
    }
  }, [rows, activeId, name]);

  // Scroll to the report once it lands.
  useEffect(() => {
    if (result && reportRef.current) {
      reportRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [result]);

  const validCount = rowsToHoldings(rows).length;

  return (
    <div style={{ fontFamily: SANS }}>
      <style>{`
        .pa-side-item { width: 100%; text-align: left; background: rgba(232,237,248,0.03); border: 1px solid ${BORDER}; border-radius: 10px; padding: 12px 13px; cursor: pointer; transition: border-color .15s ease, background .15s ease; display: block; }
        .pa-side-item:hover { border-color: rgba(79,135,247,.4); }
        .pa-side-item.active { border-color: rgba(79,135,247,.55); background: rgba(79,135,247,0.07); }
        .pa-new { width: 100%; background: none; border: 1px dashed ${BORDER}; border-radius: 10px; color: ${MUTED}; padding: 11px; font-family: ${MONO}; font-size: 11px; letter-spacing: .06em; text-transform: uppercase; cursor: pointer; transition: all .15s ease; }
        .pa-new:hover { border-color: rgba(79,135,247,.4); color: ${INK}; }
        .pa-layout { display: grid; grid-template-columns: 240px 1fr; gap: 28px; align-items: start; }
        @media (max-width: 820px) { .pa-layout { grid-template-columns: 1fr; } .pa-side { order: 2; } }
        @keyframes pa-pulse { 0%,100% { opacity: .4; } 50% { opacity: 1; } }
      `}</style>

      {/* Header */}
      <header style={{ marginBottom: 30, maxWidth: 760 }}>
        <div style={{ color: GOOD, fontFamily: MONO, fontSize: 10, letterSpacing: "0.24em", textTransform: "uppercase", marginBottom: 14 }}>
          Portfolio Auditor
        </div>
        <h1 style={{ color: INK, fontFamily: DISPLAY, fontSize: 42, lineHeight: 1.05, letterSpacing: "-0.02em", fontWeight: 500, margin: "0 0 14px" }}>
          Five risk agents, your whole book.
        </h1>
        <p style={{ color: MUTED, fontFamily: SERIF, fontSize: 16.5, lineHeight: 1.6, margin: 0 }}>
          Add your holdings and the Council turns on the basket — concentration, sector overlap, macro fragility, correlation, and the exposures hiding in plain sight. You get a health score, a stress test, and a ranked set of moves.
        </p>
      </header>

      <div className="pa-layout">
        {/* Saved-portfolios sidebar */}
        <aside className="pa-side" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ color: FAINT, fontFamily: MONO, fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 2 }}>
            Saved portfolios
          </div>
          {portfolios === null ? (
            <div style={{ color: FAINT, fontFamily: MONO, fontSize: 12 }}>Loading…</div>
          ) : portfolios.length === 0 ? (
            <div style={{ color: FAINT, fontFamily: SERIF, fontSize: 13, lineHeight: 1.5 }}>
              No saved portfolios yet. Add holdings and run your first audit.
            </div>
          ) : (
            portfolios.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`pa-side-item${p.id === activeId ? " active" : ""}`}
                onClick={() => loadPortfolio(p)}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  <span style={{ color: INK, fontFamily: SERIF, fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {p.name}
                  </span>
                  {p.latestHealthScore !== null && (
                    <span style={{ color: healthColor(p.latestHealthScore), fontFamily: MONO, fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                      {p.latestHealthScore}
                    </span>
                  )}
                </div>
                <div style={{ color: FAINT, fontFamily: MONO, fontSize: 10.5, marginTop: 4 }}>
                  {p.holdings.length} holding{p.holdings.length === 1 ? "" : "s"}
                </div>
              </button>
            ))
          )}
          {portfolios && portfolios.length > 0 && (
            <button type="button" className="pa-new" onClick={newPortfolio}>
              + New portfolio
            </button>
          )}
        </aside>

        {/* Input + run */}
        <div>
          <HoldingsInput
            name={name}
            onNameChange={setName}
            rows={rows}
            onRowsChange={setRows}
            onSubmit={runAudit}
            disabled={running}
            cost={cost}
          />

          {/* Running progress */}
          {running && (
            <div style={{ marginTop: 22, background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 12, padding: "18px 20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                <span style={{ width: 9, height: 9, borderRadius: "50%", background: ACCENT, animation: "pa-pulse 1.2s ease-in-out infinite" }} />
                <span style={{ color: INK, fontFamily: MONO, fontSize: 13 }}>{phase || "Working…"}</span>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {RISK_DIMENSIONS.map((d) => {
                  const done = doneAgents.includes(d);
                  return (
                    <span
                      key={d}
                      style={{
                        color: done ? GOOD : FAINT,
                        fontFamily: MONO,
                        fontSize: 11,
                        letterSpacing: "0.04em",
                        background: done ? "rgba(34,197,94,0.08)" : "rgba(232,237,248,0.03)",
                        border: `1px solid ${done ? "rgba(34,197,94,0.25)" : BORDER}`,
                        borderRadius: 6,
                        padding: "4px 9px",
                      }}
                    >
                      {done ? "✓ " : "· "}
                      {d}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* Error */}
          {error && !running && (
            <div style={{ marginTop: 20, background: "rgba(248,113,113,0.07)", border: `1px solid rgba(248,113,113,0.25)`, borderRadius: 10, padding: "14px 16px", color: DANGER, fontFamily: SERIF, fontSize: 14 }}>
              {error}
            </div>
          )}
        </div>
      </div>

      {/* Report */}
      {result && (
        <div ref={reportRef} style={{ marginTop: 44, paddingTop: 36, borderTop: `1px solid ${RULE}` }}>
          <AuditReport result={result} />
        </div>
      )}
    </div>
  );
}
