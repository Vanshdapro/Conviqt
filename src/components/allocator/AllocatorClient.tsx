"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AllocatorResult } from "@/lib/allocator/types";
import { ProfileForm, emptyDraft, draftToProfile, type ProfileDraft } from "./ProfileForm";
import { AllocatorReport } from "./AllocatorReport";

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

// The four planning lanes, in the order they're shown while running.
const LANES = [
  "Growth Architect",
  "Risk Steward",
  "Income & Tax Strategist",
  "Goal & Liquidity Planner",
] as const;

export function AllocatorClient({ cost }: { cost: number }) {
  const [draft, setDraft] = useState<ProfileDraft>(emptyDraft);

  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState<string>("");
  const [doneLanes, setDoneLanes] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AllocatorResult | null>(null);
  const reportRef = useRef<HTMLDivElement>(null);

  const run = useCallback(async () => {
    const profile = draftToProfile(draft);
    if (!profile) return;

    setRunning(true);
    setError(null);
    setResult(null);
    setDoneLanes([]);
    setPhase("Building your deterministic baseline…");

    try {
      const res = await fetch("/api/allocator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });

      if (!res.ok || !res.body) {
        let msg = "The plan could not be started.";
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
          case "allocator": {
            const ev = msg.event as { kind: string; specialist?: { lane: string } };
            if (ev.kind === "baseline_done") setPhase("Sourcing live fund prices, yields & macro…");
            else if (ev.kind === "sweep_done") setPhase("Four planning agents debating your mix…");
            else if (ev.kind === "specialist_done" && ev.specialist)
              setDoneLanes((prev) =>
                prev.includes(ev.specialist!.lane) ? prev : [...prev, ev.specialist!.lane]
              );
            else if (ev.kind === "judge_done") setPhase("Synthesizing your plan…");
            break;
          }
          case "allocator_done": {
            setResult(msg.result as AllocatorResult);
            break;
          }
          case "error": {
            setError((msg.error as string) || "The plan failed.");
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
      setError(err instanceof Error ? err.message : "The plan failed unexpectedly.");
    } finally {
      setRunning(false);
      setPhase("");
    }
  }, [draft]);

  useEffect(() => {
    if (result && reportRef.current) {
      reportRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [result]);

  return (
    <div style={{ fontFamily: SANS }}>
      <style>{`
        @keyframes al-pulse { 0%,100% { opacity: .4; } 50% { opacity: 1; } }
        .al-layout { display: grid; grid-template-columns: 1fr; gap: 28px; align-items: start; }
      `}</style>

      {/* Header */}
      <header style={{ marginBottom: 30, maxWidth: 780 }}>
        <div style={{ color: ACCENT, fontFamily: MONO, fontSize: 10, letterSpacing: "0.24em", textTransform: "uppercase", marginBottom: 14 }}>
          The Allocator
        </div>
        <h1 style={{ color: INK, fontFamily: DISPLAY, fontSize: 42, lineHeight: 1.05, letterSpacing: "-0.02em", fontWeight: 500, margin: "0 0 14px" }}>
          Your money and goals, turned into a real plan.
        </h1>
        <p style={{ color: MUTED, fontFamily: SERIF, fontSize: 16.5, lineHeight: 1.6, margin: 0 }}>
          Tell the Council how much you&rsquo;re investing, your risk appetite, your timeline, and your goals. Four planning agents argue out the mix, a judge reconciles them, and you get a specific, cited allocation — exact tickers, dollar splits, the accounts to use, and a clear read on what fits your profile and what doesn&rsquo;t.
        </p>
      </header>

      <div className="al-layout">
        <div>
          <ProfileForm draft={draft} onChange={setDraft} onSubmit={run} disabled={running} cost={cost} />

          {/* Running progress */}
          {running && (
            <div style={{ marginTop: 22, background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 12, padding: "18px 20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                <span style={{ width: 9, height: 9, borderRadius: "50%", background: ACCENT, animation: "al-pulse 1.2s ease-in-out infinite" }} />
                <span style={{ color: INK, fontFamily: MONO, fontSize: 13 }}>{phase || "Working…"}</span>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {LANES.map((d) => {
                  const done = doneLanes.includes(d);
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
          <AllocatorReport result={result} />
        </div>
      )}
    </div>
  );
}
