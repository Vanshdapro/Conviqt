"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";

// ── Theme tokens (mirrors /pricing + /methodology) ───────────────────────────

const SERIF = "var(--font-serif), Georgia, serif";
const DISPLAY = "var(--font-display), Georgia, serif";
const MONO = "var(--font-mono), 'JetBrains Mono', monospace";
const INK = "#e8edf8";
const ACCENT = "rgba(140,200,255,0.85)";

// ── Static docs content ──────────────────────────────────────────────────────

const CURL_EXAMPLE = `curl https://www.conviqt.com/v1/analyze \\
  -H "Authorization: Bearer cvqt_live_your_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{"ticker": "NVDA"}'`;

const RESPONSE_EXAMPLE = `{
  "runId": "run_lz3k8_a1b2",
  "ticker": "NVDA",
  "asOf": "2026-06-02T14:21:09.882Z",
  "verdict": "BUY",
  "conviction": 74,
  "disagreement": 38,
  "bottomLine": "Datacenter demand outruns every bear case for now.",
  "bullCase": "...",
  "bearCase": "...",
  "catalysts": ["Q2 earnings 2026-08-27", "Blackwell ramp"],
  "keyMetrics": [
    { "label": "Forward P/E", "value": "31.4x", "signal": "neutral" }
  ],
  "specialists": [
    { "agent": "Fundamentals", "verdict": "BUY", "confidence": 71, "...": "" }
  ],
  "sources": [
    { "index": 0, "url": "https://...", "publisher": "Yahoo Finance" }
  ],
  "usage": { "tier": "dev_500", "remaining": 487, "quota": 500 }
}`;

const FIELDS: Array<{ field: string; type: string; desc: string }> = [
  { field: "ticker", type: "string (required)", desc: "US-listed symbol, e.g. \"NVDA\". Case-insensitive." },
  { field: "focus", type: "string (optional)", desc: "Analytical lens, e.g. \"datacenter demand\". Max 200 chars." },
];

const ERRORS: Array<{ code: string; meaning: string }> = [
  { code: "400", meaning: "Missing or invalid ticker / malformed JSON body." },
  { code: "401", meaning: "Missing or invalid API key." },
  { code: "402", meaning: "Monthly call quota exhausted — upgrade or wait for reset." },
  { code: "403", meaning: "Subscription past due or canceled." },
  { code: "429", meaning: "Per-key burst rate limit (12/min). Honor Retry-After." },
  { code: "503", meaning: "Pipeline could not source real data — never returns synthetic numbers." },
];

const TIERS: Array<{
  id: "dev_500" | "dev_2000" | null;
  name: string;
  price: string;
  period: string;
  quota: string;
  features: string[];
  cta: string;
  highlighted?: boolean;
}> = [
  {
    id: null,
    name: "Free trial",
    price: "$0",
    period: "",
    quota: "25 calls / month",
    features: ["Full Council on every call", "Every claim cited", "No card required", "Auto-granted on first key"],
    cta: "Create a key below",
  },
  {
    id: "dev_500",
    name: "Developer",
    price: "$99",
    period: "/ month",
    quota: "500 calls / month",
    features: ["~16 analyses/day", "Shared 4h cache (free repeats)", "All specialist verdicts + sources", "Burst limit 12/min"],
    cta: "Start Developer",
    highlighted: true,
  },
  {
    id: "dev_2000",
    name: "Developer Pro",
    price: "$299",
    period: "/ month",
    quota: "2 000 calls / month",
    features: ["~66 analyses/day", "Everything in Developer", "Priority pipeline budget", "Ideal for funds & RIAs"],
    cta: "Start Developer Pro",
  },
];

// ── Small UI atoms ────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontFamily: SERIF, fontSize: 11, letterSpacing: "0.24em", textTransform: "uppercase", color: ACCENT, margin: "0 0 16px" }}>
      {children}
    </p>
  );
}

function CodeBlock({ code, label }: { code: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    });
  };
  return (
    <div style={{ position: "relative", borderRadius: 12, border: "1px solid rgba(232,237,248,0.09)", background: "rgba(4,10,20,0.7)", overflow: "hidden" }}>
      {label && (
        <div style={{ padding: "9px 16px", borderBottom: "1px solid rgba(232,237,248,0.07)", fontFamily: MONO, fontSize: 11, letterSpacing: "0.06em", color: "rgba(232,237,248,0.45)" }}>
          {label}
        </div>
      )}
      <button
        type="button"
        onClick={copy}
        style={{ position: "absolute", top: label ? 40 : 10, right: 10, fontFamily: SERIF, fontSize: 11, color: copied ? "#34d399" : "rgba(232,237,248,0.5)", background: "rgba(232,237,248,0.06)", border: "1px solid rgba(232,237,248,0.12)", borderRadius: 7, padding: "4px 10px", cursor: "pointer" }}
      >
        {copied ? "Copied" : "Copy"}
      </button>
      <pre style={{ margin: 0, padding: "16px 18px", overflowX: "auto", fontFamily: MONO, fontSize: 12.5, lineHeight: 1.7, color: "rgba(232,237,248,0.86)" }}>
        {code}
      </pre>
    </div>
  );
}

// ── Key management panel ──────────────────────────────────────────────────────

interface ApiKey {
  id: number;
  key_prefix: string;
  name: string;
  created_at: string;
  last_used_at: string | null;
}
interface DevAccount {
  tier: string;
  monthly_quota: number;
  calls_used: number;
  period_end: string;
  status: string;
}

function KeyPanel() {
  const [loading, setLoading] = useState(true);
  const [authed, setAuthed] = useState(false);
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [account, setAccount] = useState<DevAccount | null>(null);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [revealed, setRevealed] = useState<string | null>(null);
  const [copiedReveal, setCopiedReveal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/keys");
      if (res.status === 401) {
        setAuthed(false);
        return;
      }
      const data = await res.json();
      setAuthed(true);
      setKeys(data.keys ?? []);
      setAccount(data.account ?? null);
    } catch {
      setError("Could not load your keys.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const create = async () => {
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName || "default" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not create key.");
        return;
      }
      setRevealed(data.key);
      setNewName("");
      await load();
    } catch {
      setError("Could not create key.");
    } finally {
      setCreating(false);
    }
  };

  const revoke = async (id: number) => {
    if (!confirm("Revoke this key? Requests using it will immediately stop working.")) return;
    await fetch(`/api/keys?id=${id}`, { method: "DELETE" });
    await load();
  };

  const panelStyle: React.CSSProperties = {
    borderRadius: 16,
    border: "1px solid rgba(232,237,248,0.1)",
    background: "rgba(10,19,35,0.6)",
    backdropFilter: "blur(16px)",
    WebkitBackdropFilter: "blur(16px)",
    padding: "28px 30px",
  };

  if (loading) {
    return <div style={{ ...panelStyle, textAlign: "center", fontFamily: SERIF, color: "rgba(232,237,248,0.4)" }}>Loading…</div>;
  }

  if (!authed) {
    return (
      <div style={{ ...panelStyle, textAlign: "center" }}>
        <p style={{ fontFamily: DISPLAY, fontSize: 22, color: INK, margin: "0 0 10px" }}>Sign in to get your API key</p>
        <p style={{ fontFamily: SERIF, fontSize: 14, color: "rgba(232,237,248,0.55)", lineHeight: 1.65, margin: "0 0 22px", maxWidth: 420, marginInline: "auto" }}>
          Your first key comes with a free 25-call/month trial. No card needed to start integrating.
        </p>
        <a href="/login?next=/developers" style={{ display: "inline-block", fontFamily: SERIF, fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", color: "#050d1a", background: INK, borderRadius: 100, padding: "12px 28px", textDecoration: "none", fontWeight: 500 }}>
          Sign in
        </a>
      </div>
    );
  }

  const used = account?.calls_used ?? 0;
  const quota = account?.monthly_quota ?? 25;
  const pct = quota > 0 ? Math.min(100, (used / quota) * 100) : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* Usage summary */}
      <div style={panelStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
          <span style={{ fontFamily: SERIF, fontSize: 13, color: "rgba(232,237,248,0.55)" }}>
            This month&apos;s usage · <span style={{ color: ACCENT }}>{account?.tier ?? "free_dev"}</span>
            {account && account.status !== "active" && (
              <span style={{ color: "#fca5a5", marginLeft: 8 }}>({account.status})</span>
            )}
          </span>
          <span style={{ fontFamily: MONO, fontSize: 14, color: INK, fontVariantNumeric: "tabular-nums" }}>
            {used.toLocaleString()} / {quota.toLocaleString()} calls
          </span>
        </div>
        <div style={{ height: 5, background: "rgba(232,237,248,0.08)", borderRadius: 999, overflow: "hidden", marginTop: 12 }}>
          <div style={{ width: `${pct}%`, height: "100%", background: pct > 90 ? "#f87171" : "#34d399", borderRadius: 999, transition: "width .4s ease" }} />
        </div>
        {account?.period_end && (
          <p style={{ fontFamily: SERIF, fontSize: 12, color: "rgba(232,237,248,0.4)", margin: "10px 0 0" }}>
            Resets {new Date(account.period_end).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}.
          </p>
        )}
      </div>

      {/* Reveal-once banner */}
      {revealed && (
        <div style={{ ...panelStyle, border: "1px solid rgba(52,211,153,0.4)" }}>
          <p style={{ fontFamily: DISPLAY, fontSize: 16, color: "#34d399", margin: "0 0 6px" }}>Key created — copy it now</p>
          <p style={{ fontFamily: SERIF, fontSize: 13, color: "rgba(232,237,248,0.6)", margin: "0 0 14px", lineHeight: 1.6 }}>
            This is the only time the full key is shown. Store it somewhere safe — we only keep a hash.
          </p>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <code style={{ flex: 1, minWidth: 240, fontFamily: MONO, fontSize: 13, color: INK, background: "rgba(4,10,20,0.8)", border: "1px solid rgba(232,237,248,0.12)", borderRadius: 8, padding: "10px 12px", overflowX: "auto", whiteSpace: "nowrap" }}>
              {revealed}
            </code>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(revealed);
                setCopiedReveal(true);
                setTimeout(() => setCopiedReveal(false), 1600);
              }}
              style={{ fontFamily: SERIF, fontSize: 12, color: "#050d1a", background: "#34d399", border: "none", borderRadius: 8, padding: "10px 16px", cursor: "pointer", fontWeight: 600 }}
            >
              {copiedReveal ? "Copied" : "Copy"}
            </button>
            <button
              type="button"
              onClick={() => setRevealed(null)}
              style={{ fontFamily: SERIF, fontSize: 12, color: "rgba(232,237,248,0.55)", background: "transparent", border: "1px solid rgba(232,237,248,0.14)", borderRadius: 8, padding: "10px 14px", cursor: "pointer" }}
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Keys list + create */}
      <div style={panelStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, flexWrap: "wrap", gap: 12 }}>
          <span style={{ fontFamily: DISPLAY, fontSize: 18, color: INK }}>Your API keys</span>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Key name (optional)"
              style={{ fontFamily: SERIF, fontSize: 13, color: INK, background: "rgba(4,10,20,0.6)", border: "1px solid rgba(232,237,248,0.12)", borderRadius: 8, padding: "9px 12px", outline: "none" }}
            />
            <button
              type="button"
              onClick={create}
              disabled={creating}
              style={{ fontFamily: SERIF, fontSize: 12, letterSpacing: "0.06em", color: "#050d1a", background: ACCENT, border: "none", borderRadius: 8, padding: "9px 18px", cursor: creating ? "default" : "pointer", fontWeight: 600, opacity: creating ? 0.6 : 1, whiteSpace: "nowrap" }}
            >
              {creating ? "Creating…" : "+ New key"}
            </button>
          </div>
        </div>

        {error && <p style={{ fontFamily: SERIF, fontSize: 13, color: "#fca5a5", margin: "0 0 14px" }}>{error}</p>}

        {keys.length === 0 ? (
          <p style={{ fontFamily: SERIF, fontSize: 14, color: "rgba(232,237,248,0.4)", margin: 0 }}>No keys yet. Create one to start calling the API.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {keys.map((k, i) => (
              <div key={k.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "14px 0", borderTop: i > 0 ? "1px solid rgba(232,237,248,0.06)" : "none" }}>
                <div>
                  <p style={{ fontFamily: SERIF, fontSize: 14, color: INK, margin: "0 0 3px" }}>{k.name}</p>
                  <p style={{ fontFamily: MONO, fontSize: 12, color: "rgba(232,237,248,0.45)", margin: 0 }}>
                    {k.key_prefix} · created {new Date(k.created_at).toLocaleDateString()}
                    {k.last_used_at ? ` · last used ${new Date(k.last_used_at).toLocaleDateString()}` : " · never used"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => revoke(k.id)}
                  style={{ fontFamily: SERIF, fontSize: 12, color: "#fca5a5", background: "transparent", border: "1px solid rgba(248,113,113,0.3)", borderRadius: 7, padding: "7px 14px", cursor: "pointer", flexShrink: 0 }}
                >
                  Revoke
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Pricing tier cards ────────────────────────────────────────────────────────

function TierCard({ tier }: { tier: (typeof TIERS)[number] }) {
  const [busy, setBusy] = useState(false);
  const checkout = async () => {
    if (!tier.id) {
      document.getElementById("keys")?.scrollIntoView({ behavior: "smooth" });
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: tier.id }),
      });
      const data = await res.json();
      if (res.status === 401) {
        window.location.href = "/login?next=/developers";
        return;
      }
      if (data.url) window.location.href = data.url;
      else alert(data.error ?? "Could not start checkout.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      style={{
        borderRadius: 16,
        border: tier.highlighted ? "1px solid rgba(140,200,255,0.4)" : "1px solid rgba(232,237,248,0.1)",
        background: tier.highlighted ? "rgba(20,40,70,0.5)" : "rgba(10,19,35,0.5)",
        padding: "28px 26px",
        display: "flex",
        flexDirection: "column",
        height: "100%",
      }}
    >
      {tier.highlighted && (
        <span style={{ alignSelf: "flex-start", fontFamily: SERIF, fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: ACCENT, background: "rgba(140,200,255,0.12)", borderRadius: 100, padding: "4px 12px", marginBottom: 16 }}>
          Most popular
        </span>
      )}
      <p style={{ fontFamily: DISPLAY, fontSize: 22, color: INK, margin: "0 0 4px" }}>{tier.name}</p>
      <p style={{ fontFamily: SERIF, fontSize: 13, color: ACCENT, margin: "0 0 16px" }}>{tier.quota}</p>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 20 }}>
        <span style={{ fontFamily: DISPLAY, fontSize: 38, color: INK }}>{tier.price}</span>
        <span style={{ fontFamily: SERIF, fontSize: 14, color: "rgba(232,237,248,0.45)" }}>{tier.period}</span>
      </div>
      <ul style={{ listStyle: "none", padding: 0, margin: "0 0 24px", display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
        {tier.features.map((f) => (
          <li key={f} style={{ display: "flex", gap: 9, fontFamily: SERIF, fontSize: 13.5, color: "rgba(232,237,248,0.72)", lineHeight: 1.5 }}>
            <span style={{ color: ACCENT, flexShrink: 0 }}>›</span>
            {f}
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={checkout}
        disabled={busy}
        style={{
          fontFamily: SERIF,
          fontSize: 13,
          letterSpacing: "0.04em",
          color: tier.highlighted ? "#050d1a" : INK,
          background: tier.highlighted ? ACCENT : "transparent",
          border: tier.highlighted ? "none" : "1px solid rgba(232,237,248,0.18)",
          borderRadius: 100,
          padding: "12px 20px",
          cursor: busy ? "default" : "pointer",
          fontWeight: 600,
          opacity: busy ? 0.6 : 1,
        }}
      >
        {busy ? "…" : tier.cta}
      </button>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DevelopersPage() {
  return (
    <div style={{ background: "#050d1a", minHeight: "100vh" }}>

      <main style={{ padding: "80px clamp(20px, 5vw, 80px) 100px", maxWidth: 920, margin: "0 auto" }}>
        {/* Hero */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }} style={{ textAlign: "center", marginBottom: 64 }}>
          <SectionLabel>Conviqt API</SectionLabel>
          <h1 style={{ fontFamily: DISPLAY, fontWeight: 500, fontSize: "clamp(38px, 5.2vw, 68px)", lineHeight: 1.07, letterSpacing: "-0.018em", color: INK, margin: "0 0 20px" }}>
            The AI research layer,
            <br />
            <span style={{ background: "linear-gradient(108deg, #6eb6ff 0%, #c084fc 45%, #67e8f9 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
              one POST request away.
            </span>
          </h1>
          <p style={{ fontFamily: SERIF, fontSize: "clamp(15px, 1.4vw, 18px)", color: "rgba(232,237,248,0.6)", lineHeight: 1.72, maxWidth: 560, margin: "0 auto" }}>
            Call the full multi-agent Council programmatically. One ticker in, a cited
            BUY / HOLD / SELL verdict, conviction, disagreement, and every specialist&apos;s
            reasoning out — as JSON. Built for quants, fintech developers, and funds.
          </p>
        </motion.div>

        {/* Quickstart */}
        <section style={{ marginBottom: 64 }}>
          <SectionLabel>Quickstart</SectionLabel>
          <p style={{ fontFamily: SERIF, fontSize: 15, color: "rgba(232,237,248,0.6)", lineHeight: 1.65, margin: "0 0 20px" }}>
            Create a key in the panel below, then call the endpoint. Every key starts on a free
            25-call/month trial — no card required.
          </p>
          <CodeBlock code={CURL_EXAMPLE} label="POST /v1/analyze" />
        </section>

        {/* Endpoint reference */}
        <section style={{ marginBottom: 48 }}>
          <SectionLabel>Request body</SectionLabel>
          <div style={{ borderRadius: 12, border: "1px solid rgba(232,237,248,0.09)", background: "rgba(10,19,35,0.5)", overflow: "hidden", marginBottom: 32 }}>
            {FIELDS.map((f, i) => (
              <div key={f.field} style={{ display: "flex", gap: 16, padding: "14px 18px", borderTop: i > 0 ? "1px solid rgba(232,237,248,0.06)" : "none", flexWrap: "wrap" }}>
                <code style={{ fontFamily: MONO, fontSize: 13, color: ACCENT, minWidth: 70 }}>{f.field}</code>
                <span style={{ fontFamily: MONO, fontSize: 12, color: "rgba(232,237,248,0.4)", minWidth: 130 }}>{f.type}</span>
                <span style={{ fontFamily: SERIF, fontSize: 13.5, color: "rgba(232,237,248,0.7)", flex: 1, minWidth: 200 }}>{f.desc}</span>
              </div>
            ))}
          </div>

          <SectionLabel>Response</SectionLabel>
          <CodeBlock code={RESPONSE_EXAMPLE} label="200 OK · application/json" />
        </section>

        {/* Errors */}
        <section style={{ marginBottom: 64 }}>
          <SectionLabel>Errors</SectionLabel>
          <div style={{ borderRadius: 12, border: "1px solid rgba(232,237,248,0.09)", background: "rgba(10,19,35,0.5)", overflow: "hidden" }}>
            {ERRORS.map((e, i) => (
              <div key={e.code} style={{ display: "flex", gap: 16, padding: "13px 18px", borderTop: i > 0 ? "1px solid rgba(232,237,248,0.06)" : "none" }}>
                <code style={{ fontFamily: MONO, fontSize: 13, color: e.code.startsWith("2") ? "#34d399" : "#f0a875", minWidth: 36 }}>{e.code}</code>
                <span style={{ fontFamily: SERIF, fontSize: 13.5, color: "rgba(232,237,248,0.7)", flex: 1 }}>{e.meaning}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Pricing tiers */}
        <section style={{ marginBottom: 64 }}>
          <div style={{ textAlign: "center", marginBottom: 36 }}>
            <SectionLabel>Developer pricing</SectionLabel>
            <p style={{ fontFamily: SERIF, fontSize: 14, color: "rgba(232,237,248,0.5)", lineHeight: 1.65, maxWidth: 460, margin: "0 auto" }}>
              Billed monthly per API call quota — separate from consumer credits. Cached repeat
              tickers within 4 hours don&apos;t count against your quota twice.
            </p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
            {TIERS.map((t) => (
              <TierCard key={t.name} tier={t} />
            ))}
          </div>
        </section>

        {/* Key management */}
        <section id="keys">
          <SectionLabel>Your keys &amp; usage</SectionLabel>
          <KeyPanel />
        </section>
      </main>
    </div>
  );
}
