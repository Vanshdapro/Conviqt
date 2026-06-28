import type { StoredReport } from "@/lib/stockReports";
import type { ConvictionPoint } from "@/lib/convictionHistory";
import type { Verdict } from "@/lib/agents/types";
import StockReportGate from "./StockReportGate";
import SharePanel from "./SharePanel";
import ConvictionTimeline from "./ConvictionTimeline";
import MarketStrip from "./MarketStrip";
import PriceChart from "./PriceChart";
import { AgentConsensus, ConvictionRing } from "../viz/CouncilViz";
import { howSure } from "@/lib/sureness";
import { universeName } from "@/lib/tickers";

// ── Helpers ────────────────────────────────────────────────────────────────

function verdictColor(v: Verdict): string {
  if (v === "BUY") return "var(--up-ink)";
  if (v === "SELL") return "var(--down-ink)";
  return "var(--text-2)";
}

function verdictBg(v: Verdict): string {
  if (v === "BUY") return "var(--up-weak)";
  if (v === "SELL") return "var(--down-weak)";
  return "var(--bg-sunken)";
}

function freshness(asOf: string): string {
  return new Date(asOf).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// ── Verdict hero ────────────────────────────────────────────────────────────
// The first thing you see: ticker, name, verdict pill, conviction band.
// Market price comes from MarketStrip (client island) below this.

function VerdictHero({ data }: { data: StoredReport }) {
  const { ticker, companyName, sector, verdict, conviction, disagreement, report } = data;
  const vc = verdictColor(verdict);
  const vbg = verdictBg(verdict);
  const sureWord = howSure(conviction);

  // Prefer stored name; fall back to universe lookup; hide if still just the ticker
  const displayName = (companyName && companyName !== ticker)
    ? companyName
    : (universeName(ticker) ?? null);
  // Hide generic/bad sector values
  const displaySector =
    sector && sector.toLowerCase() !== "unknown" && sector.toLowerCase() !== ticker.toLowerCase()
      ? sector
      : null;

  return (
    <header
      className="px-5 py-6 border border-rule"
      style={{ background: "var(--bg-surface)", borderLeft: `4px solid ${vc}` }}
    >
      <div className="flex flex-wrap items-start justify-between gap-5">
        {/* Left: ticker + name + verdict */}
        <div className="min-w-0 flex-1">
          <div className="mono text-[9px] text-dim mb-2 uppercase tracking-[0.12em]">
            The analysts&rsquo; verdict
          </div>

          <div className="flex items-center gap-3 flex-wrap mb-1.5">
            <h1 className="display text-[48px] text-foreground leading-none tracking-tight">
              {ticker}
            </h1>
            <span
              className="mono text-[15px] font-bold tracking-[0.1em] px-3 py-1.5 rounded-[8px]"
              style={{ color: vc, background: vbg }}
            >
              {verdict}
            </span>
          </div>

          {displayName && (
            <div className="serif text-[15px] text-muted font-normal">{displayName}</div>
          )}
          {displaySector && (
            <div className="mono text-[9px] text-dim mt-1.5 uppercase tracking-[0.1em]">
              {displaySector}
            </div>
          )}

          {/* Analyst count + disagreement inline */}
          {report.agents.length > 0 && (
            <div className="flex items-center gap-3 mt-3 flex-wrap">
              <span className="mono text-[10px] text-muted">
                {report.agents.length} analysts weighed in
              </span>
              {typeof disagreement === "number" && (
                <span
                  className="mono text-[10px] px-2 py-0.5 rounded"
                  style={{ background: "var(--bg-sunken)", color: "var(--text-muted)" }}
                >
                  {disagreement < 30 ? "unanimous" : disagreement < 60 ? "some disagreement" : "split call"}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Right: conviction ring */}
        <div className="flex-shrink-0">
          <ConvictionRing value={conviction} color={vc} label="how sure" size={80} stroke={6} />
          <div className="mono text-[9px] text-center text-dim mt-1">{sureWord}</div>
        </div>
      </div>
    </header>
  );
}

// ── Bull / Bear ─────────────────────────────────────────────────────────────
// Tight two-column cards — no walls of text.

function BullBear({ bull, bear }: { bull: string; bear: string }) {
  return (
    <section className="border border-rule" style={{ background: "var(--surface)" }}>
      <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-rule">
        <div className="px-5 py-5" style={{ borderLeft: "3px solid var(--bear)" }}>
          <div
            className="mono text-[9px] font-semibold uppercase tracking-[0.14em] mb-3 flex items-center gap-2"
            style={{ color: "var(--bear)" }}
          >
            <span
              className="h-5 w-5 rounded flex items-center justify-center text-[10px]"
              style={{ background: "var(--down-weak)", color: "var(--down-ink)" }}
            >
              ↓
            </span>
            Bear case
          </div>
          <p className="serif text-[14px] text-foreground/80 leading-[1.7]">{bear}</p>
        </div>
        <div className="px-5 py-5" style={{ borderLeft: "3px solid var(--bull)" }}>
          <div
            className="mono text-[9px] font-semibold uppercase tracking-[0.14em] mb-3 flex items-center gap-2"
            style={{ color: "var(--bull)" }}
          >
            <span
              className="h-5 w-5 rounded flex items-center justify-center text-[10px]"
              style={{ background: "var(--up-weak)", color: "var(--up-ink)" }}
            >
              ↑
            </span>
            Bull case
          </div>
          <p className="serif text-[14px] text-foreground/80 leading-[1.7]">{bull}</p>
        </div>
      </div>
    </section>
  );
}

// ── Sources accordion ──────────────────────────────────────────────────────

function Sources({ sources }: { sources: Array<{ url: string; title: string; publisher: string }> }) {
  if (sources.length === 0) return null;
  return (
    <section className="border border-rule px-5 py-4" style={{ background: "var(--surface)" }}>
      <details className="group">
        <summary className="mono text-[10px] text-dim cursor-pointer list-none flex items-center gap-2 select-none">
          <svg
            width="8"
            height="8"
            viewBox="0 0 8 8"
            fill="none"
            className="transition-transform group-open:rotate-90"
          >
            <path d="M2 1L6 4L2 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Sources · {sources.length} cited
        </summary>
        <ol className="space-y-1.5 mt-3">
          {sources.map((s, i) => (
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
      </details>
    </section>
  );
}

// ── Main export ────────────────────────────────────────────────────────────

export default function PublicStockReport({
  data,
  history = [],
}: {
  data: StoredReport;
  history?: ConvictionPoint[];
}) {
  const { report, verdict, conviction, disagreement, ticker, companyName } = data;
  const { judge, factSheet } = report;
  const vc = verdictColor(verdict);

  const citedIds = new Set(judge.sourceIndexes);
  const citedSources = factSheet.sources
    .map((s, i) => ({ s, i }))
    .filter(({ i }) => citedIds.has(i))
    .map(({ s }) => s);

  return (
    <article className="space-y-px">
      {/* 1. Verdict hero ─────────────────────────────────────────────────── */}
      <VerdictHero data={data} />

      {/* 2. Live market data: price + key stats (client island) ─────────── */}
      <MarketStrip ticker={ticker} />

      {/* 3. Price chart (client island) ──────────────────────────────────── */}
      <PriceChart ticker={ticker} />

      {/* 4. Agent consensus — every specialist vote made visible ─────────── */}
      {report.agents.length > 0 && (
        <AgentConsensus
          agents={report.agents}
          judgeVerdict={verdict}
          disagreement={disagreement}
          standalone
        />
      )}

      {/* 5. Investment case ───────────────────────────────────────────────── */}
      <section className="border border-rule px-5 py-5" style={{ background: "var(--surface)" }}>
        <h2
          className="mono text-[9px] uppercase tracking-[0.14em] mb-3"
          style={{ color: "var(--accent-hover)" }}
        >
          Investment case
        </h2>
        <p className="serif text-[15px] text-foreground/90 leading-[1.72]">
          {judge.investmentCase}
        </p>
      </section>

      {/* 6. Bull / Bear ───────────────────────────────────────────────────── */}
      <BullBear bull={judge.bullCase} bear={judge.bearCase} />

      {/* 7. Conviction timeline ──────────────────────────────────────────── */}
      <ConvictionTimeline history={history} windowDays={90} />

      {/* 8. Gated depth (key metrics, catalysts, bottom line, breakdown) ─── */}
      <StockReportGate ticker={ticker} />

      {/* 9. Share this verdict ───────────────────────────────────────────── */}
      <SharePanel
        ticker={ticker}
        companyName={companyName}
        verdict={verdict}
        conviction={conviction}
        disagreement={disagreement}
        verdictColor={vc}
        ogTimestamp={Date.parse(data.updatedAt)}
      />

      {/* 10. Sources ─────────────────────────────────────────────────────── */}
      <Sources sources={citedSources} />

      {/* 11. Footer ──────────────────────────────────────────────────────── */}
      <footer
        className="border border-rule px-5 py-3 flex flex-wrap items-center justify-between gap-3 mono text-[10px] text-dim"
        style={{ background: "var(--surface)" }}
      >
        <span>Last researched · {freshness(data.asOf)}</span>
        <span style={{ color: "var(--accent)" }}>
          Refreshes with every research run · educational only
        </span>
      </footer>
    </article>
  );
}
