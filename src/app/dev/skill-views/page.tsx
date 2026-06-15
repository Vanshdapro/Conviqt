"use client";

// /dev/skill-views — internal playground for the specialized Skill Views.
//
// Pick a skill, give it the input it needs, and see its OWN signature visual
// rendered from a single OpenAI structured-output call (grounded on free
// market data, no web search). Lets the founder eyeball every skill's output
// against the Almanac tokens before wiring them into the Research surface.

import { useState } from "react";
import { SKILLS, type Skill } from "@/lib/skills";
import { SkillViewRenderer } from "@/components/skillviews/SkillViewRenderer";
import type { SkillViewId, SkillViewResponse } from "@/lib/skillViewTypes";
import type { SkillParams } from "@/lib/agents/skillViews";

const SECTOR_IDEAS = ["AI chips", "Big banks", "Clean energy", "Streaming", "Defense", "Biotech"];

export default function SkillViewsPlayground() {
  const [skillId, setSkillId] = useState<SkillViewId>("crowd-check");
  const [params, setParams] = useState<SkillParams>({ ticker: "NVDA" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SkillViewResponse | null>(null);

  const skill = SKILLS.find((s) => s.id === skillId) as Skill;

  function pick(id: SkillViewId) {
    setSkillId(id);
    setResult(null);
    setError(null);
    // sensible defaults per input kind
    const s = SKILLS.find((x) => x.id === id)!;
    if (s.input === "tickerPair") setParams({ tickerA: "AMD", tickerB: "NVDA" });
    else if (s.input === "ticker") setParams({ ticker: "NVDA" });
    else if (s.input === "sector") setParams({ sector: "AI chips" });
    else if (s.input === "headline") setParams({ headline: "Fed signals it may hold rates higher for longer as inflation proves sticky" });
    else if (s.input === "allocator") setParams({ budgetUSD: 500, goals: "Long-term growth, can leave it alone for 5+ years" });
    else if (s.input === "holdings") setParams({ holdings: "NVDA 45%, TSLA 25%, AAPL 20%, cash 10%" });
  }

  async function run() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/skill-view", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skill: skillId, params }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Something went wrong.");
      } else {
        setResult(json as SkillViewResponse);
      }
    } catch {
      setError("Network error. Is the dev server running?");
    } finally {
      setLoading(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    background: "var(--bg-sunken)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-control)",
    padding: "10px 12px",
    fontSize: 14,
    color: "var(--text)",
    fontFamily: "var(--font-ui)",
  };

  return (
    <main style={{ background: "var(--bg-page)", minHeight: "100vh", padding: "var(--space-8) var(--space-6)", fontFamily: "var(--font-ui)" }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: 32, color: "var(--text)", margin: "0 0 4px", letterSpacing: "-0.02em" }}>Skill Views</h1>
        <p style={{ color: "var(--text-muted)", margin: "0 0 var(--space-6)", fontSize: 14 }}>
          Each skill renders its own specialized output — one OpenAI structured-output call, grounded on free market data.
        </p>

        {/* skill picker */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: "var(--space-5)" }}>
          {SKILLS.map((s) => {
            const active = s.id === skillId;
            return (
              <button
                key={s.id}
                onClick={() => pick(s.id as SkillViewId)}
                style={{
                  border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
                  background: active ? "var(--accent-weak)" : "var(--bg-surface)",
                  color: active ? "var(--accent-hover)" : "var(--text-2)",
                  borderRadius: "var(--radius-pill)",
                  padding: "6px 14px",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {s.name}
              </button>
            );
          })}
        </div>

        {/* input form */}
        <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-card)", padding: "var(--space-5)", marginBottom: "var(--space-6)" }}>
          <p style={{ margin: "0 0 var(--space-3)", fontSize: 14, color: "var(--text-2)" }}>{skill.guidedPrompt}</p>
          {skill.input === "ticker" && (
            <input style={inputStyle} placeholder="e.g. NVDA" value={params.ticker ?? ""} onChange={(e) => setParams({ ticker: e.target.value.toUpperCase() })} />
          )}
          {skill.input === "tickerPair" && (
            <div style={{ display: "flex", gap: 12 }}>
              <input style={inputStyle} placeholder="Stock A" value={params.tickerA ?? ""} onChange={(e) => setParams({ ...params, tickerA: e.target.value.toUpperCase() })} />
              <input style={inputStyle} placeholder="Stock B" value={params.tickerB ?? ""} onChange={(e) => setParams({ ...params, tickerB: e.target.value.toUpperCase() })} />
            </div>
          )}
          {skill.input === "sector" && (
            <>
              <input style={inputStyle} placeholder="e.g. AI chips" value={params.sector ?? ""} onChange={(e) => setParams({ sector: e.target.value })} />
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                {SECTOR_IDEAS.map((s) => (
                  <button key={s} onClick={() => setParams({ sector: s })} style={{ border: "1px solid var(--border)", background: "var(--bg-sunken)", borderRadius: "var(--radius-pill)", padding: "3px 10px", fontSize: 12, color: "var(--text-2)", cursor: "pointer" }}>{s}</button>
                ))}
              </div>
            </>
          )}
          {skill.input === "headline" && (
            <textarea style={{ ...inputStyle, minHeight: 72, resize: "vertical" }} placeholder="Paste a headline…" value={params.headline ?? ""} onChange={(e) => setParams({ headline: e.target.value })} />
          )}
          {skill.input === "allocator" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <input style={inputStyle} type="number" placeholder="Budget (USD)" value={params.budgetUSD ?? ""} onChange={(e) => setParams({ ...params, budgetUSD: Number(e.target.value) })} />
              <textarea style={{ ...inputStyle, minHeight: 56, resize: "vertical" }} placeholder="Your goals / timeline…" value={params.goals ?? ""} onChange={(e) => setParams({ ...params, goals: e.target.value })} />
            </div>
          )}
          {skill.input === "holdings" && (
            <textarea style={{ ...inputStyle, minHeight: 72, resize: "vertical" }} placeholder="e.g. AAPL 40%, MSFT 30%, cash 30%" value={params.holdings ?? ""} onChange={(e) => setParams({ holdings: e.target.value })} />
          )}
          <button
            onClick={run}
            disabled={loading}
            style={{ marginTop: "var(--space-4)", background: loading ? "var(--accent-hover)" : "var(--accent)", color: "var(--on-accent)", border: "none", borderRadius: "var(--radius-control)", padding: "10px 20px", fontSize: 14, fontWeight: 600, cursor: loading ? "wait" : "pointer" }}
          >
            {loading ? "Running…" : `Run ${skill.name}`}
          </button>
          {result && (
            <span style={{ marginLeft: 12, fontSize: 12, color: "var(--text-muted)" }}>cost ≈ ${result.costUSD.toFixed(4)}</span>
          )}
        </div>

        {error && (
          <div style={{ background: "var(--down-weak)", color: "var(--down-ink)", border: "1px solid var(--down)", borderRadius: "var(--radius-control)", padding: "var(--space-3) var(--space-4)", marginBottom: "var(--space-6)", fontSize: 14 }}>{error}</div>
        )}

        {result && <SkillViewRenderer data={result} />}

        {result && (
          <details style={{ marginTop: "var(--space-6)" }}>
            <summary style={{ cursor: "pointer", fontSize: 13, color: "var(--text-muted)" }}>Raw structured output</summary>
            <pre style={{ background: "var(--bg-sunken)", border: "1px solid var(--border)", borderRadius: "var(--radius-control)", padding: "var(--space-4)", fontSize: 12, overflow: "auto", color: "var(--text-2)" }}>{JSON.stringify(result.view, null, 2)}</pre>
          </details>
        )}
      </div>
    </main>
  );
}
