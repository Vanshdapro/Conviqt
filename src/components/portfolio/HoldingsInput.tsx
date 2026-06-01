"use client";

import { useRef, useState } from "react";
import type { Holding } from "@/lib/portfolio/types";

const SURFACE = "#07121f";
const BORDER = "rgba(232,237,248,0.09)";
const INK = "#e8edf8";
const MUTED = "#8aa0c2";
const FAINT = "#526684";
const ACCENT = "#4f87f7";
const DANGER = "#f87171";
const MONO = "var(--font-mono), 'JetBrains Mono', monospace";
const SANS = "var(--font-sans), system-ui, sans-serif";
const SERIF = "var(--font-serif), Georgia, serif";

// A single editable row in the manual-entry grid. Strings (not numbers) so the
// user can type freely; we coerce on submit.
export interface DraftRow {
  ticker: string;
  shares: string;
  costBasis: string;
}

export function rowsToHoldings(rows: DraftRow[]): Holding[] {
  const seen = new Set<string>();
  const out: Holding[] = [];
  for (const r of rows) {
    const ticker = r.ticker.trim().toUpperCase();
    const shares = Number(r.shares);
    if (!/^[A-Z][A-Z0-9.\-]{0,9}$/.test(ticker)) continue;
    if (!isFinite(shares) || shares <= 0) continue;
    if (seen.has(ticker)) continue;
    seen.add(ticker);
    const cb = Number(r.costBasis);
    out.push({ ticker, shares, costBasis: isFinite(cb) && cb > 0 ? cb : undefined });
  }
  return out;
}

export function holdingsToRows(holdings: Holding[]): DraftRow[] {
  return holdings.map((h) => ({
    ticker: h.ticker,
    shares: String(h.shares),
    costBasis: h.costBasis != null ? String(h.costBasis) : "",
  }));
}

// Lenient CSV / pasted-text parser. Accepts comma, tab, or whitespace
// separators, with or without a header row. First alpha token = ticker, first
// number = shares, second number = cost basis.
function parseCsv(text: string): DraftRow[] {
  const rows: DraftRow[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const lower = line.toLowerCase();
    if (/(ticker|symbol)/.test(lower) && /(share|qty|quantity)/.test(lower)) continue; // header
    const parts = line.split(/[,\t]+|\s{2,}|\s+/).map((p) => p.trim()).filter(Boolean);
    if (parts.length === 0) continue;
    const ticker = parts[0].replace(/[$"']/g, "").toUpperCase();
    if (!/^[A-Z][A-Z0-9.\-]{0,9}$/.test(ticker)) continue;
    const nums = parts.slice(1).map((p) => p.replace(/[$,"']/g, "")).filter((p) => /^\d*\.?\d+$/.test(p));
    if (nums.length === 0) continue;
    rows.push({ ticker, shares: nums[0], costBasis: nums[1] ?? "" });
  }
  return rows;
}

interface Props {
  name: string;
  onNameChange: (name: string) => void;
  rows: DraftRow[];
  onRowsChange: (rows: DraftRow[]) => void;
  onSubmit: () => void;
  disabled?: boolean;
  cost: number;
}

export function HoldingsInput({ name, onNameChange, rows, onRowsChange, onSubmit, disabled, cost }: Props) {
  const [csvOpen, setCsvOpen] = useState(false);
  const [csvText, setCsvText] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const validCount = rowsToHoldings(rows).length;
  const canSubmit = validCount >= 2 && !disabled;

  const setRow = (i: number, patch: Partial<DraftRow>) => {
    const next = rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r));
    onRowsChange(next);
  };
  const addRow = () => onRowsChange([...rows, { ticker: "", shares: "", costBasis: "" }]);
  const removeRow = (i: number) => onRowsChange(rows.filter((_, idx) => idx !== i));

  const applyCsv = (text: string) => {
    const parsed = parseCsv(text);
    if (parsed.length === 0) return;
    // Merge: keep any non-empty existing manual rows, then append parsed.
    const existing = rows.filter((r) => r.ticker.trim() || r.shares.trim());
    const merged = [...existing, ...parsed];
    onRowsChange(merged.slice(0, 40));
    setCsvText("");
    setCsvOpen(false);
  };

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => applyCsv(String(reader.result ?? ""));
    reader.readAsText(file);
    e.target.value = "";
  };

  return (
    <div style={{ fontFamily: SANS }}>
      <style>{`
        .pi-input { background: rgba(232,237,248,0.04); border: 1px solid ${BORDER}; border-radius: 8px; color: ${INK}; font-family: ${MONO}; font-size: 13px; padding: 9px 11px; outline: none; transition: border-color .15s ease; width: 100%; box-sizing: border-box; }
        .pi-input:focus { border-color: ${ACCENT}; }
        .pi-input::placeholder { color: ${FAINT}; }
        .pi-row-x { background: none; border: none; color: ${FAINT}; cursor: pointer; padding: 4px; border-radius: 6px; display: inline-flex; transition: color .15s ease, background .15s ease; }
        .pi-row-x:hover { color: ${DANGER}; background: rgba(248,113,113,0.1); }
        .pi-ghost { background: rgba(232,237,248,0.04); border: 1px solid ${BORDER}; color: ${MUTED}; border-radius: 8px; padding: 9px 14px; font-family: ${MONO}; font-size: 11px; letter-spacing: .08em; text-transform: uppercase; cursor: pointer; transition: all .15s ease; }
        .pi-ghost:hover { border-color: rgba(79,135,247,.4); color: ${INK}; }
        .pi-run { background: ${ACCENT}; color: #061018; border: none; border-radius: 100px; padding: 13px 30px; font-family: ${SANS}; font-size: 14px; font-weight: 700; cursor: pointer; transition: opacity .15s ease, transform .1s ease; }
        .pi-run:hover:not(:disabled) { opacity: .92; }
        .pi-run:active:not(:disabled) { transform: translateY(1px); }
        .pi-run:disabled { opacity: .4; cursor: not-allowed; }
        @media (max-width: 600px) { .pi-grid-head { display: none !important; } }
      `}</style>

      {/* Portfolio name */}
      <div style={{ marginBottom: 18 }}>
        <label style={{ display: "block", color: FAINT, fontFamily: MONO, fontSize: 10, letterSpacing: ".14em", textTransform: "uppercase", marginBottom: 7 }}>
          Portfolio name
        </label>
        <input
          className="pi-input"
          style={{ maxWidth: 360, fontFamily: SERIF, fontSize: 15 }}
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="My Portfolio"
          maxLength={80}
        />
      </div>

      {/* Toolbar */}
      <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <button className="pi-ghost" onClick={() => setCsvOpen((v) => !v)} type="button">
          Paste CSV
        </button>
        <button className="pi-ghost" onClick={() => fileRef.current?.click()} type="button">
          Upload CSV
        </button>
        <input ref={fileRef} type="file" accept=".csv,text/csv,text/plain" onChange={onFile} style={{ display: "none" }} />
        <span style={{ color: FAINT, fontFamily: MONO, fontSize: 11, alignSelf: "center" }}>
          {validCount} valid holding{validCount === 1 ? "" : "s"}
        </span>
      </div>

      {csvOpen && (
        <div style={{ marginBottom: 16 }}>
          <textarea
            className="pi-input"
            style={{ minHeight: 110, fontFamily: MONO, fontSize: 12, lineHeight: 1.5, resize: "vertical" }}
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            placeholder={"Paste rows, e.g.\nAAPL, 40, 150\nNVDA, 25, 410\nMSFT, 30"}
          />
          <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
            <button className="pi-ghost" type="button" onClick={() => applyCsv(csvText)} style={{ borderColor: "rgba(79,135,247,.4)", color: INK }}>
              Add rows
            </button>
            <span style={{ color: FAINT, fontFamily: SERIF, fontSize: 12, alignSelf: "center" }}>
              Format: ticker, shares, cost basis (optional). Headers are ignored.
            </span>
          </div>
        </div>
      )}

      {/* Holdings grid */}
      <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 12, overflow: "hidden" }}>
        <div className="pi-grid-head" style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr 40px", gap: 10, padding: "11px 16px", borderBottom: `1px solid ${BORDER}`, background: "rgba(232,237,248,0.02)" }}>
          {["Ticker", "Shares", "Avg cost (opt.)", ""].map((h, i) => (
            <span key={i} style={{ color: FAINT, fontFamily: MONO, fontSize: 10, letterSpacing: ".12em", textTransform: "uppercase" }}>{h}</span>
          ))}
        </div>
        <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
          {rows.map((r, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr 40px", gap: 10, alignItems: "center" }}>
              <input className="pi-input" value={r.ticker} placeholder="AAPL" onChange={(e) => setRow(i, { ticker: e.target.value.toUpperCase() })} maxLength={10} />
              <input className="pi-input" value={r.shares} placeholder="40" inputMode="decimal" onChange={(e) => setRow(i, { shares: e.target.value })} />
              <input className="pi-input" value={r.costBasis} placeholder="150.00" inputMode="decimal" onChange={(e) => setRow(i, { costBasis: e.target.value })} />
              <button className="pi-row-x" type="button" aria-label="Remove row" onClick={() => removeRow(i)}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" /></svg>
              </button>
            </div>
          ))}
          <button className="pi-ghost" type="button" onClick={addRow} style={{ alignSelf: "flex-start", marginTop: 2 }}>
            + Add holding
          </button>
        </div>
      </div>

      {/* Run */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 22, flexWrap: "wrap" }}>
        <button className="pi-run" type="button" disabled={!canSubmit} onClick={onSubmit}>
          {disabled ? "Auditing…" : "Run portfolio audit"}
        </button>
        <span style={{ color: FAINT, fontFamily: MONO, fontSize: 12 }}>
          {cost} credits · 5 risk agents + synthesis
        </span>
        {validCount < 2 && (
          <span style={{ color: MUTED, fontFamily: SERIF, fontSize: 13 }}>Add at least 2 holdings to run an audit.</span>
        )}
      </div>
    </div>
  );
}
