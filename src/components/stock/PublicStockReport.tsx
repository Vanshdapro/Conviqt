import type { StoredReport } from "@/lib/stockReports";
import type { ConvictionPoint } from "@/lib/convictionHistory";
import type { Verdict } from "@/lib/agents/types";
import StockReportGate from "./StockReportGate";
import SharePanel from "./SharePanel";
import ConvictionTimeline from "./ConvictionTimeline";
import { AgentConsensus, ConvictionRing } from "../viz/CouncilViz";

// Server-rendered public summary for /stock/[ticker]. Everything here ships in
// the static HTML — it's the SEO surface Googlebot indexes. The login-gated
// depth lives in <StockReportGate/> (a client island).

function verdictColor(v: Verdict): string {
  if (v === "BUY") return "var(--bull)";
  if (v === "SELL") return "var(--bear)";
  return "var(--hold)";
}

function freshness(asOf: string): string {
  const d = new Date(asOf);
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function PublicStockReport({
  data,
  history = [],
}: {
  data: StoredReport;
  history?: ConvictionPoint[];
}) {
  const { report, verdict, conviction, disagreement, ticker, companyName, sector } = data;
  const { judge, factSheet } = report;
  const vc = verdictColor(verdict);

  // Only cited sources (the union the Judge actually relied on).
  const citedIds = new Set(judge.sourceIndexes);
  const citedSources = factSheet.sources
    .map((s, i) => ({ s, i }))
    .filter(({ i }) => citedIds.has(i));

  return (
    <article className="space-y-px">
      {/* ── Verdict header ─────────────────────────────────────────────── */}
      <header
        className="border border-rule px-5 py-6"
        style={{ background: "var(--surface-2)", borderLeft: `4px solid ${vc}` }}
      >
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="min-w-0">
            <div className="caps text-[9px] text-dim mb-2">The analysts&rsquo; verdict</div>
            <h1 className="flex items-baseline gap-3 flex-wrap">
              <span className="display text-[44px] text-foreground leading-none tracking-tight">{ticker}</span>
              <span className="serif text-[16px] text-muted font-normal">{companyName} stock analysis</span>
            </h1>
            {sector && <div className="mono text-[10px] text-dim mt-1.5">{sector}</div>}
          </div>

          <div className="flex-shrink-0 flex items-center gap-4">
            <div className="text-right">
              <div className="mono text-[26px] font-bold tracking-[0.08em]" style={{ color: vc }}>
                {verdict}
              </div>
              {report.agents.length > 0 && (
                <div className="mono text-[10px] text-dim mt-1.5">
                  {report.agents.length} analysts weighed in
                </div>
              )}
            </div>
            <ConvictionRing
              value={conviction}
              color={vc}
              label="how sure"
              size={68}
            />
          </div>
        </div>
      </header>

      {/* ── Agent consensus — every specialist vote, made visible ──────── */}
      {report.agents.length > 0 && (
        <AgentConsensus
          agents={report.agents}
          judgeVerdict={verdict}
          disagreement={disagreement}
          standalone
        />
      )}

      {/* ── Conviction timeline (the historical AI-consensus moat) ──────── */}
      <ConvictionTimeline history={history} windowDays={90} />

      {/* ── Investment case ────────────────────────────────────────────── */}
      <section className="border border-rule px-5 py-5" style={{ background: "var(--surface)" }}>
        <h2 className="caps text-[9px] text-accent mb-3">Investment case</h2>
        <p className="serif text-[15px] text-foreground/90 leading-[1.72]">{judge.investmentCase}</p>
      </section>

      {/* ── Bull / Bear ────────────────────────────────────────────────── */}
      <section className="border border-rule" style={{ background: "var(--surface)" }}>
        <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-rule">
          <div className="px-5 py-5" style={{ background: "var(--surface-2)", borderLeft: "3px solid var(--bear)" }}>
            <h2 className="caps text-[9px] mb-3" style={{ color: "var(--bear)" }}>Bear case</h2>
            <p className="serif text-[14px] text-foreground/80 leading-[1.7]">{judge.bearCase}</p>
          </div>
          <div className="px-5 py-5" style={{ background: "var(--surface-2)", borderLeft: "3px solid var(--bull)" }}>
            <h2 className="caps text-[9px] mb-3" style={{ color: "var(--bull)" }}>Bull case</h2>
            <p className="serif text-[14px] text-foreground/80 leading-[1.7]">{judge.bullCase}</p>
          </div>
        </div>
      </section>

      {/* ── Gated depth ────────────────────────────────────────────────── */}
      <StockReportGate ticker={ticker} />

      {/* ── Share this verdict ─────────────────────────────────────────── */}
      <SharePanel
        ticker={ticker}
        companyName={companyName}
        verdict={verdict}
        conviction={conviction}
        disagreement={disagreement}
        verdictColor={vc}
        ogTimestamp={Date.parse(data.updatedAt)}
      />

      {/* ── Sources (public — the citation moat) ───────────────────────── */}
      {citedSources.length > 0 && (
        <section className="border border-rule px-5 py-4" style={{ background: "var(--surface)" }}>
          <h2 className="caps text-[9px] text-dim mb-3">Sources</h2>
          <ol className="space-y-1.5">
            {citedSources.map(({ s, i }) => (
              <li key={i} className="flex gap-2 text-[12px] text-muted leading-relaxed">
                <span className="mono text-dim flex-shrink-0 w-5">{i + 1}.</span>
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="hover:text-foreground transition-colors underline underline-offset-2 decoration-rule truncate"
                >
                  {s.title}
                </a>
                <span className="text-dim flex-shrink-0">· {s.publisher}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* ── Footer / freshness ─────────────────────────────────────────── */}
      <footer className="border border-rule px-5 py-3 flex flex-wrap items-center justify-between gap-3 mono text-[10px] text-dim">
        <span>Last researched · {freshness(data.asOf)}</span>
        <span>Refreshed every 24h · educational research only</span>
      </footer>
    </article>
  );
}
