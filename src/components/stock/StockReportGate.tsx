"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { CouncilResult, AgentOutput, MetricSignal } from "@/lib/agents/types";

// Login-gated depth for a public stock page.
//
// The summary (verdict, conviction, investment case, bull/bear, sources) is
// rendered statically by the server for SEO. THIS component holds the premium
// depth — full key metrics, catalysts, the bottom-line call, and the per-agent
// breakdown. It fetches /api/stock/[ticker]/report, which enforces auth server
// side and only returns the payload to signed-in users. So the gated data
// never ships in the static HTML — the gate is real, not cosmetic.

function signalColor(s: MetricSignal): string {
  if (s === "bullish") return "var(--bull)";
  if (s === "bearish") return "var(--bear)";
  return "var(--dim)";
}

function agentColor(a: AgentOutput): string {
  if (a.confidence === 0) return "var(--dim)";
  if (a.verdict === "BUY") return "var(--bull)";
  if (a.verdict === "SELL") return "var(--bear)";
  return "var(--hold)";
}

type Status = "loading" | "locked" | "unlocked" | "error";

export default function StockReportGate({ ticker }: { ticker: string }) {
  const [status, setStatus] = useState<Status>("loading");
  const [result, setResult] = useState<CouncilResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/stock/${encodeURIComponent(ticker.toLowerCase())}/report`,
          { cache: "no-store" }
        );
        if (cancelled) return;
        if (res.status === 401) {
          setStatus("locked");
          return;
        }
        if (!res.ok) {
          setStatus("error");
          return;
        }
        const data = (await res.json()) as { result: CouncilResult };
        if (cancelled) return;
        setResult(data.result);
        setStatus("unlocked");
      } catch {
        if (!cancelled) setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ticker]);

  if (status === "loading") {
    return (
      <div className="border border-rule" style={{ background: "var(--surface)" }}>
        <div className="px-5 py-8 flex items-center gap-3 text-muted">
          <span className="h-2 w-2 rounded-full animate-pulse" style={{ background: "var(--accent)" }} />
          <span className="mono text-[11px]">Loading full research note…</span>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="border border-rule px-5 py-6" style={{ background: "var(--surface)" }}>
        <p className="text-[13px] text-muted">
          Couldn&rsquo;t load the full report right now. Refresh to try again.
        </p>
      </div>
    );
  }

  if (status === "locked") {
    return (
      <div
        className="border border-rule relative overflow-hidden"
        style={{ background: "var(--surface)" }}
      >
        {/* Faux blurred depth behind the wall — signals there's more here. */}
        <div
          aria-hidden
          className="px-5 py-6 select-none pointer-events-none"
          style={{ filter: "blur(6px)", opacity: 0.5 }}
        >
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="border border-rule px-3 py-4" style={{ background: "var(--surface-2)" }}>
                <div className="h-2 w-12 bg-rule mb-3" />
                <div className="h-4 w-16 bg-rule mb-2" />
                <div className="h-2 w-10 bg-rule" />
              </div>
            ))}
          </div>
        </div>

        <div className="px-5 py-7 border-t border-rule text-center">
          <div className="caps text-[9px] text-accent mb-2">Full research note</div>
          <h3 className="serif text-[20px] text-foreground mb-2">
            Key metrics, catalysts & the full analyst breakdown
          </h3>
          <p className="text-[13px] text-muted max-w-md mx-auto mb-5 leading-relaxed">
            See every specialist&rsquo;s verdict, the near-term catalysts, and the
            full conviction call — free with an account.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Link
              href={`/signup?next=${encodeURIComponent(`/stock/${ticker.toLowerCase()}`)}`}
              className="mono text-[11px] uppercase tracking-[0.16em] px-5 py-3 rounded-sm"
              style={{ background: "var(--accent)", color: "var(--on-accent)" }}
            >
              Create free account
            </Link>
            <Link
              href={`/login?next=${encodeURIComponent(`/stock/${ticker.toLowerCase()}`)}`}
              className="mono text-[11px] uppercase tracking-[0.16em] px-5 py-3 rounded-sm border border-rule text-muted hover:text-foreground hover:border-foreground transition-colors"
            >
              Sign in
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // unlocked
  if (!result) return null;
  const { judge, agents, factSheet } = result;

  return (
    <div className="space-y-px">
      {/* Key metrics */}
      {judge.keyMetrics.length > 0 && (
        <section className="border border-rule px-5 py-5" style={{ background: "var(--surface)" }}>
          <div className="caps text-[9px] text-accent mb-3">Key metrics</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {judge.keyMetrics.map((m, i) => (
              <div key={i} className="border border-rule px-3 py-2.5" style={{ background: "var(--surface-2)" }}>
                <div className="caps text-[9px] text-dim mb-1.5 leading-tight">{m.label}</div>
                <div className="mono text-[15px] font-medium text-foreground mb-1.5">{m.value}</div>
                <div className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ background: signalColor(m.signal) }} />
                  <span className="mono text-[9px]" style={{ color: signalColor(m.signal) }}>{m.signal}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Catalysts */}
      {judge.catalysts.length > 0 && (
        <section className="border border-rule px-5 py-5" style={{ background: "var(--surface)" }}>
          <div className="caps text-[9px] text-accent mb-3">Catalysts to watch</div>
          <ol className="space-y-2">
            {judge.catalysts.map((c, i) => (
              <li key={i} className="flex gap-3 leading-[1.65]">
                <span className="mono text-[10px] text-dim flex-shrink-0 mt-[4px] w-4">{i + 1}.</span>
                <span className="serif text-[14px] text-foreground/85">{c}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* Bottom line */}
      {judge.bottomLine && (
        <section className="border border-rule px-5 py-5" style={{ background: "var(--surface-2)" }}>
          <div className="caps text-[9px] text-accent mb-3">Bottom line</div>
          <p className="serif italic text-[19px] text-foreground/95 leading-snug">
            &ldquo;{judge.bottomLine}&rdquo;
          </p>
          {judge.dissents.length > 0 && (
            <p className="mono text-[10px] text-dim mt-2.5">Dissenting: {judge.dissents.join(", ")}</p>
          )}
        </section>
      )}

      {/* Agent breakdown */}
      <section className="border border-rule px-5 py-5" style={{ background: "var(--surface)" }}>
        <div className="caps text-[9px] text-accent mb-1">The desk · {agents.length} analysts</div>
        <div className="mt-2">
          {agents.map((a) => {
            const color = agentColor(a);
            return (
              <div key={a.agent} className="py-3 border-b border-rule last:border-b-0">
                <div className="flex items-center justify-between gap-4 mb-1.5">
                  <div className="flex items-center gap-3">
                    <span className="mono text-[11px] font-medium uppercase tracking-[0.14em]" style={{ color }}>
                      {a.confidence === 0 ? "—" : a.verdict}
                    </span>
                    <span className="text-[13px] text-foreground/80 font-medium">{a.agent}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-[2px] bg-rule overflow-hidden">
                      <div className="h-full" style={{ width: `${a.confidence}%`, background: color }} />
                    </div>
                    <span className="mono text-[10px] text-dim w-12 text-right">{a.confidence}/100</span>
                  </div>
                </div>
                <p className="serif text-[13px] text-foreground/65 leading-[1.68]">{a.reasoning}</p>
                {a.flags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {a.flags.map((f) => (
                      <span key={f} className="mono text-[10px] text-dim border border-rule rounded px-1.5 py-0.5">{f}</span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {factSheet.sources.length > 0 && (
          <p className="mono text-[10px] text-dim mt-3">
            Synthesized from {factSheet.sources.length} cited source{factSheet.sources.length > 1 ? "s" : ""}.
          </p>
        )}
      </section>
    </div>
  );
}
