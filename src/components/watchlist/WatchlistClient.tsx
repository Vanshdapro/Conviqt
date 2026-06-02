"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

// The Watchlist surface (Deliverable 3). Add up to 10 tickers; each row shows
// the latest Council verdict + next earnings date and links to the full report.
// This is the retention loop's home base — the page the alert emails link back
// to for management.

const INK = "#e8edf8";
const MUTED = "#8aa0c2";
const FAINT = "#526684";
const ACCENT = "#4f87f7";
const CARD = "rgba(232,237,248,0.025)";
const RULE = "rgba(232,237,248,0.085)";
const MONO = "var(--font-mono), 'JetBrains Mono', monospace";
const SANS = "var(--font-sans), system-ui, sans-serif";
const DISPLAY = "var(--font-display), Georgia, serif";
const SERIF = "var(--font-serif), Georgia, serif";

interface Item {
  ticker: string;
  companyName: string | null;
  createdAt: string;
  verdict: string | null;
  conviction: number | null;
  disagreement: number | null;
  reportUpdatedAt: string | null;
  nextEarningsDate: string | null;
  earningsConfidence: string | null;
}

function verdictColor(v: string | null): string {
  if (v === "BUY") return "#34d399";
  if (v === "SELL") return "#f87171";
  if (v === "HOLD") return "#f59e0b";
  return FAINT;
}

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const ms = new Date(iso + "T13:30:00Z").getTime() - Date.now();
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
}

function earningsLabel(item: Item): { text: string; soon: boolean } | null {
  if (!item.nextEarningsDate) return null;
  const d = daysUntil(item.nextEarningsDate);
  const dateStr = new Date(item.nextEarningsDate + "T00:00:00Z").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
  if (d === null || d < 0) return { text: `Earnings ${dateStr}`, soon: false };
  if (d <= 2) return { text: `Earnings in ${d === 0 ? "<1" : d} day${d === 1 ? "" : "s"}`, soon: true };
  return { text: `Earnings ${dateStr} (${d}d)`, soon: false };
}

export function WatchlistClient() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [max, setMax] = useState(10);
  const [authed, setAuthed] = useState(true);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/watchlist");
      if (res.status === 401) {
        setAuthed(false);
        setItems([]);
        return;
      }
      const data = await res.json();
      setItems(data.items ?? []);
      if (typeof data.max === "number") setMax(data.max);
    } catch {
      setItems([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const mutate = useCallback(
    async (method: "POST" | "DELETE", ticker: string) => {
      setBusy(true);
      setError(null);
      try {
        const res = await fetch("/api/watchlist", {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ticker }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data.message || data.error || "Something went wrong.");
          return;
        }
        setItems(data.items ?? []);
        if (method === "POST") setInput("");
      } catch {
        setError("Network error — try again.");
      } finally {
        setBusy(false);
      }
    },
    []
  );

  const onAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const t = input.toUpperCase().trim();
    if (t) mutate("POST", t);
  };

  const full = items !== null && items.length >= max;

  const sorted = useMemo(() => {
    if (!items) return [];
    // Soonest earnings first, then highest disagreement, then alphabetically.
    return [...items].sort((a, b) => {
      const da = daysUntil(a.nextEarningsDate);
      const db = daysUntil(b.nextEarningsDate);
      const ea = da !== null && da >= 0 ? da : 9999;
      const eb = db !== null && db >= 0 ? db : 9999;
      if (ea !== eb) return ea - eb;
      const dis = (b.disagreement ?? -1) - (a.disagreement ?? -1);
      if (dis !== 0) return dis;
      return a.ticker.localeCompare(b.ticker);
    });
  }, [items]);

  if (!authed) {
    return (
      <div style={{ background: CARD, border: `1px solid ${RULE}`, borderRadius: 16, padding: "40px 32px", textAlign: "center" }}>
        <div style={{ fontFamily: DISPLAY, fontSize: 24, color: INK, marginBottom: 12 }}>
          Sign in to build your watchlist
        </div>
        <p style={{ fontFamily: SERIF, fontSize: 15.5, color: MUTED, lineHeight: 1.6, maxWidth: 460, margin: "0 auto 24px" }}>
          Track up to {max} tickers and get an email the moment one reports earnings within 48 hours — or the moment the Council fractures on it.
        </p>
        <Link
          href="/login"
          style={{ display: "inline-block", background: ACCENT, color: "#06101f", fontFamily: SANS, fontSize: 13, fontWeight: 600, textDecoration: "none", padding: "12px 28px", borderRadius: 100 }}
        >
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <div>
      {/* Add bar */}
      <form
        onSubmit={onAdd}
        style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Add a ticker (e.g. NVDA)"
          aria-label="Add a ticker to your watchlist"
          disabled={busy || full}
          maxLength={10}
          style={{
            flex: "1 1 220px",
            minWidth: 0,
            background: "rgba(232,237,248,0.04)",
            border: `1px solid ${RULE}`,
            borderRadius: 100,
            padding: "13px 20px",
            color: INK,
            fontFamily: MONO,
            fontSize: 14,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            outline: "none",
          }}
        />
        <button
          type="submit"
          disabled={busy || full || !input.trim()}
          style={{
            background: full || !input.trim() ? "rgba(79,135,247,0.25)" : ACCENT,
            color: "#06101f",
            fontFamily: SANS,
            fontSize: 13,
            fontWeight: 600,
            border: "none",
            borderRadius: 100,
            padding: "13px 26px",
            cursor: busy || full || !input.trim() ? "not-allowed" : "pointer",
            whiteSpace: "nowrap",
          }}
        >
          {busy ? "…" : "Add"}
        </button>
      </form>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 20 }}>
        <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.1em", color: FAINT, textTransform: "uppercase" }}>
          {items === null ? "Loading…" : `${items.length} / ${max} tracked`}
        </span>
        {full && (
          <span style={{ fontFamily: SERIF, fontSize: 12.5, color: "#f59e0b" }}>
            Watchlist full — remove one to add another.
          </span>
        )}
      </div>

      {error && (
        <div style={{ fontFamily: SERIF, fontSize: 13.5, color: "#fca5a5", marginBottom: 16, padding: "10px 14px", background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)", borderRadius: 10 }}>
          {error}
        </div>
      )}

      {/* Empty state */}
      {items !== null && items.length === 0 && (
        <div style={{ background: CARD, border: `1px dashed ${RULE}`, borderRadius: 16, padding: "36px 28px", textAlign: "center" }}>
          <div style={{ fontFamily: DISPLAY, fontSize: 21, color: INK, marginBottom: 10 }}>
            Your watchlist is empty
          </div>
          <p style={{ fontFamily: SERIF, fontSize: 15, color: MUTED, lineHeight: 1.6, maxWidth: 480, margin: "0 auto" }}>
            Add a ticker above. We&rsquo;ll email you when it reports earnings within 48 hours, or when a fresh Council run fractures on it (40%+ disagreement) — the exact moments to check the bear case.
          </p>
        </div>
      )}

      {/* List */}
      {sorted.map((item) => {
        const earn = earningsLabel(item);
        return (
          <div
            key={item.ticker}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              background: CARD,
              border: `1px solid ${RULE}`,
              borderRadius: 14,
              padding: "16px 20px",
              marginBottom: 10,
              flexWrap: "wrap",
            }}
          >
            <div style={{ minWidth: 92 }}>
              <div style={{ fontFamily: MONO, fontSize: 16, fontWeight: 600, color: INK, letterSpacing: "0.04em" }}>
                {item.ticker}
              </div>
              {item.companyName && (
                <div style={{ fontFamily: SERIF, fontSize: 11.5, color: FAINT, marginTop: 2, maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {item.companyName}
                </div>
              )}
            </div>

            {/* Verdict */}
            <div style={{ minWidth: 96 }}>
              {item.verdict ? (
                <>
                  <span style={{ fontFamily: SANS, fontSize: 13, fontWeight: 700, color: verdictColor(item.verdict), letterSpacing: "0.04em" }}>
                    {item.verdict}
                  </span>
                  {item.conviction !== null && (
                    <span style={{ fontFamily: MONO, fontSize: 11, color: FAINT, marginLeft: 6 }}>
                      {Math.round(item.conviction / 10)}/10
                    </span>
                  )}
                </>
              ) : (
                <span style={{ fontFamily: SERIF, fontSize: 12.5, color: FAINT }}>No report yet</span>
              )}
            </div>

            {/* Disagreement */}
            <div style={{ minWidth: 78 }}>
              {item.disagreement !== null ? (
                <span
                  style={{
                    fontFamily: MONO,
                    fontSize: 12,
                    color: item.disagreement >= 40 ? "#f59e0b" : MUTED,
                  }}
                  title="Council disagreement"
                >
                  {item.disagreement}% split
                </span>
              ) : (
                <span style={{ color: "transparent" }}>—</span>
              )}
            </div>

            {/* Earnings chip */}
            <div style={{ flex: "1 1 120px" }}>
              {earn && (
                <span
                  style={{
                    fontFamily: MONO,
                    fontSize: 10.5,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: earn.soon ? "#06101f" : MUTED,
                    background: earn.soon ? "#f59e0b" : "rgba(232,237,248,0.06)",
                    border: earn.soon ? "none" : `1px solid ${RULE}`,
                    borderRadius: 100,
                    padding: "5px 11px",
                    fontWeight: earn.soon ? 700 : 400,
                  }}
                >
                  {earn.text}
                </span>
              )}
            </div>

            {/* Actions */}
            <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
              <Link
                href={`/stock/${encodeURIComponent(item.ticker)}`}
                style={{ fontFamily: SANS, fontSize: 12.5, fontWeight: 500, color: ACCENT, textDecoration: "none", whiteSpace: "nowrap" }}
              >
                Report →
              </Link>
              <button
                type="button"
                onClick={() => mutate("DELETE", item.ticker)}
                disabled={busy}
                aria-label={`Remove ${item.ticker}`}
                style={{ background: "none", border: "none", color: FAINT, cursor: busy ? "wait" : "pointer", fontSize: 18, lineHeight: 1, padding: 4 }}
              >
                ×
              </button>
            </div>
          </div>
        );
      })}

      {/* How alerts work */}
      {items !== null && items.length > 0 && (
        <div style={{ marginTop: 22, padding: "16px 20px", background: "rgba(79,135,247,0.05)", border: "1px solid rgba(79,135,247,0.16)", borderRadius: 12 }}>
          <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: ACCENT, marginBottom: 8 }}>
            How alerts work
          </div>
          <p style={{ fontFamily: SERIF, fontSize: 13.5, color: MUTED, lineHeight: 1.6, margin: 0 }}>
            We email you when a watched ticker reports earnings within 48 hours, or when a fresh Council run breaks 40% disagreement. One digest per day, max — never spam.
          </p>
        </div>
      )}
    </div>
  );
}
