"use client";

// Answer renderers for the Research surface (playbook Phase 3).
//
// Every pipeline result renders the same way: a verdict header card (ticker,
// live price from the marketdata layer, a plain-English verdict line,
// "How sure: High/Medium/Low"), then plain-English sections, then "Learn
// why →" Academy links, with citations demoted to a collapsed Sources
// accordion at the bottom — present, never foregrounded.
//
// Copy rules (CLAUDE.md): no agents/council/credits/disagreement/pipeline
// words anywhere in rendered text. Conviction is NEVER a raw score here.

import Link from "next/link";
import type { ReactNode } from "react";
import { Card, ChangePill } from "@/components/ui";
import type { Quote } from "@/lib/marketdata/types";
import type {
  CouncilResult,
  FocusedResult,
  CompareResult,
  SectorResult,
  Source,
  Verdict,
  KeyMetric,
} from "@/lib/agents/types";
import type { HeadlineResult } from "@/lib/agents/headline";
import type { AllocatorResult } from "@/lib/allocator/types";
import type { PortfolioAuditResult } from "@/lib/portfolio/types";
import { learnLinksFor, lessonHref } from "./learnLinks";

/** ticker → quote. undefined = still loading; null = honestly unavailable. */
export type QuoteMap = Record<string, Quote | null | undefined>;

// ── Shared helpers ───────────────────────────────────────────────────────────

/** Strip internal [#N]/(#N) citation markers — sources live in the accordion. */
function stripCites(text: string): string {
  return text.replace(/\s*[\[(]#\d+(?:\s*,\s*#?\d+)*[\])]/g, "").trim();
}

export type HowSureLevel = "High" | "Medium" | "Low";

export function howSure(conviction: number): HowSureLevel {
  if (conviction >= 70) return "High";
  if (conviction >= 45) return "Medium";
  return "Low";
}

function HowSureChip({ conviction }: { conviction: number }) {
  const level = howSure(conviction);
  return (
    <span className="cvq-howsure" data-level={level.toLowerCase()}>
      How sure: <strong>{level}</strong>
    </span>
  );
}

const VERDICT_LABEL: Record<Verdict, string> = {
  BUY: "Buy",
  HOLD: "Hold",
  SELL: "Sell",
};

function VerdictChip({ verdict }: { verdict: Verdict }) {
  return (
    <span className={`cvq-verdict cvq-verdict--${verdict.toLowerCase()}`}>
      The analysts say: <strong>{VERDICT_LABEL[verdict]}</strong>
    </span>
  );
}

/** Live price line for the header card — honest when no feed answered. */
function QuoteLine({ quote }: { quote: Quote | null | undefined }) {
  if (quote === undefined) {
    return <span className="cvq-skeleton" style={{ width: 120, height: 18, display: "inline-block" }} />;
  }
  if (quote === null) {
    return <span className="cvq-quote-unavailable">Live price unavailable right now</span>;
  }
  return (
    <span className="cvq-quoteline">
      <span className="cvq-quote-price">
        ${quote.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </span>
      {quote.changePct !== null && <ChangePill change={quote.changePct} />}
      <span className="cvq-quote-fresh">{quote.freshnessLabel}</span>
    </span>
  );
}

function HeaderCard({
  eyebrow,
  title,
  right,
  verdictRow,
  line,
}: {
  eyebrow: string;
  title: ReactNode;
  right?: ReactNode;
  verdictRow?: ReactNode;
  line?: string;
}) {
  return (
    <Card raised padding="lg" className="cvq-answer-header">
      <div className="cvq-answer-header-top">
        <div>
          <div className="cvq-answer-eyebrow">{eyebrow}</div>
          <h2 className="cvq-answer-title">{title}</h2>
        </div>
        {right && <div className="cvq-answer-right">{right}</div>}
      </div>
      {verdictRow && <div className="cvq-answer-verdictrow">{verdictRow}</div>}
      {line && <p className="cvq-answer-line">{line}</p>}
    </Card>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="cvq-answer-section">
      <h3 className="cvq-section-title">{title}</h3>
      {children}
    </section>
  );
}

/** Minimal prose renderer: paragraphs, bullets, ## headings, **bold**,
    [text](url). Horizontal rules and inline-code backticks are stripped —
    the longer analyst answers use full markdown. */
export function Prose({ text }: { text: string }) {
  const blocks = stripCites(text.replace(/`([^`]+)`/g, "$1"))
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter((b) => b && !/^[-*_]{3,}$/.test(b));
  return (
    <div className="cvq-prose">
      {blocks.map((block, i) => {
        const heading = block.match(/^#{2,4}\s+(.+)$/);
        if (heading) {
          return (
            <h4 key={i} className="cvq-prose-heading">
              {inline(heading[1])}
            </h4>
          );
        }
        const lines = block.split("\n").filter((l) => l.trim());
        const isList = lines.length > 0 && lines.every((l) => /^\s*[-•*]\s+/.test(l));
        if (isList) {
          return (
            <ul key={i}>
              {lines.map((l, j) => (
                <li key={j}>{inline(l.replace(/^\s*[-•*]\s+/, ""))}</li>
              ))}
            </ul>
          );
        }
        return <p key={i}>{inline(block)}</p>;
      })}
    </div>
  );
}

function inline(text: string): ReactNode[] {
  // **bold** and [label](url) only — anything fancier renders as plain text.
  const parts: ReactNode[] = [];
  const re = /\*\*([^*]+)\*\*|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    if (m[1] !== undefined) parts.push(<strong key={k++}>{m[1]}</strong>);
    else
      parts.push(
        <a key={k++} href={m[3]} target="_blank" rel="noopener noreferrer">
          {m[2]}
        </a>
      );
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

/** "Learn why →" — Academy lessons matching concepts in the answer prose. */
function LearnWhy({ corpus }: { corpus: string }) {
  const links = learnLinksFor(corpus);
  if (links.length === 0) return null;
  return (
    <section className="cvq-answer-section">
      <h3 className="cvq-section-title">Go deeper</h3>
      <div className="cvq-learnwhy">
        {links.map((l) => (
          <Link key={l.lessonId} href={lessonHref(l.lessonId)} className="cvq-learnwhy-chip">
            Learn why → <strong>{l.title}</strong>
          </Link>
        ))}
      </div>
    </section>
  );
}

/** Collapsed Sources accordion — present, never foregrounded. */
function SourcesAccordion({ sources, extra }: { sources: Source[]; extra?: Quote | null }) {
  const count = sources.length + (extra ? 1 : 0);
  if (count === 0) return null;
  return (
    <details className="cvq-sources">
      <summary>Sources ({count})</summary>
      <ul>
        {extra && (
          <li>
            <a href={extra.sourceUrl} target="_blank" rel="noopener noreferrer">
              {extra.ticker} price — {extra.freshnessLabel}
            </a>
          </li>
        )}
        {sources.map((s, i) => (
          <li key={i}>
            <a href={s.url} target="_blank" rel="noopener noreferrer">
              {s.publisher} — {s.title}
            </a>
          </li>
        ))}
      </ul>
    </details>
  );
}

/** Key numbers grid. Signals are market-direction data → up/down pills OK. */
function MetricsGrid({ metrics }: { metrics: KeyMetric[] }) {
  if (metrics.length === 0) return null;
  return (
    <div className="cvq-metrics">
      {metrics.map((m, i) => (
        <div key={i} className="cvq-metric">
          <span className="cvq-metric-label">{m.label}</span>
          <span className="cvq-metric-value" data-signal={m.signal}>
            {m.signal === "bullish" && <span className="cvq-pill cvq-pill--up"><span className="cvq-pill-arrow" aria-hidden>▲</span>{m.value}</span>}
            {m.signal === "bearish" && <span className="cvq-pill cvq-pill--down"><span className="cvq-pill-arrow" aria-hidden>▼</span>{m.value}</span>}
            {m.signal === "neutral" && <span className="cvq-pill cvq-pill--flat">{m.value}</span>}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Council (Worth Owning? / Entry & Exit Zones / Crowd Check / Bull & Bear) ─

export function CouncilAnswer({ result, quotes }: { result: CouncilResult; quotes: QuoteMap }) {
  const j = result.judge;
  const quote = quotes[result.ticker];
  const corpus = [j.investmentCase, j.bullCase, j.bearCase, j.catalysts.join(" ")].join(" ");
  return (
    <div className="cvq-answer">
      <HeaderCard
        eyebrow={result.factSheet.companyName || "Stock check"}
        title={result.ticker}
        right={<QuoteLine quote={quote} />}
        verdictRow={
          <>
            <VerdictChip verdict={j.verdict} />
            <HowSureChip conviction={j.conviction} />
          </>
        }
        line={stripCites(j.bottomLine)}
      />
      <Section title="The case">
        <Prose text={j.investmentCase} />
      </Section>
      <Section title="The numbers that matter">
        <MetricsGrid metrics={j.keyMetrics} />
      </Section>
      <Section title="If things go right">
        <Prose text={j.bullCase} />
      </Section>
      <Section title="If things go wrong">
        <Prose text={j.bearCase} />
      </Section>
      {j.catalysts.length > 0 && (
        <Section title="What to watch next">
          <ul className="cvq-watchlist">
            {j.catalysts.map((c, i) => (
              <li key={i}>{stripCites(c)}</li>
            ))}
          </ul>
        </Section>
      )}
      <LearnWhy corpus={corpus} />
      <SourcesAccordion sources={result.factSheet.sources} extra={quote ?? undefined} />
    </div>
  );
}

// ── Focused / Quick Take ─────────────────────────────────────────────────────

export function FocusedAnswer({ result, quotes }: { result: FocusedResult; quotes: QuoteMap }) {
  const quote = quotes[result.ticker];
  // The takeaway is already the header line — only render the body when it
  // adds something beyond it (older cached runs can carry an empty answer).
  const body = stripCites(result.answer);
  const hasBody = body.length > 0 && body !== stripCites(result.keyTakeaway);
  return (
    <div className="cvq-answer">
      <HeaderCard
        eyebrow={result.companyName || "Quick read"}
        title={result.ticker}
        right={<QuoteLine quote={quote} />}
        line={stripCites(result.keyTakeaway)}
      />
      {hasBody && (
        <Section title="The read">
          <Prose text={result.answer} />
        </Section>
      )}
      <LearnWhy corpus={`${result.answer} ${result.keyTakeaway}`} />
      <SourcesAccordion sources={result.sources} extra={quote ?? undefined} />
    </div>
  );
}

// ── Face-Off (compare) ───────────────────────────────────────────────────────

export function CompareAnswer({ result, quotes }: { result: CompareResult; quotes: QuoteMap }) {
  const v = result.verdict;
  const winnerTicker =
    v.winner === "A" ? result.tickerA : v.winner === "B" ? result.tickerB : null;
  const winnerSide = v.winner === "A" ? result.a : v.winner === "B" ? result.b : null;
  const corpus = [v.summary, v.valuationEdge, v.positioningEdge, v.catalystEdge, v.riskRewardEdge].join(" ");

  return (
    <div className="cvq-answer">
      <HeaderCard
        eyebrow="Face-Off"
        title={`${result.tickerA} vs ${result.tickerB}`}
        verdictRow={
          <>
            <span className="cvq-verdict cvq-verdict--buy">
              {winnerTicker ? (
                <>The pick: <strong>{winnerTicker}</strong></>
              ) : (
                <strong>Too close to call</strong>
              )}
            </span>
            {winnerSide && <HowSureChip conviction={winnerSide.judge.conviction} />}
          </>
        }
        line={stripCites(v.headline)}
      />

      <div className="cvq-faceoff-sides">
        {([["a", result.tickerA], ["b", result.tickerB]] as const).map(([side, ticker]) => {
          const council = result[side];
          return (
            <Card key={side} className="cvq-faceoff-side">
              <div className="cvq-faceoff-side-head">
                <span className="cvq-ticker-sym" data-no-translate>{ticker}</span>
                <QuoteLine quote={quotes[ticker]} />
              </div>
              <div className="cvq-answer-verdictrow">
                <VerdictChip verdict={council.judge.verdict} />
                <HowSureChip conviction={council.judge.conviction} />
              </div>
              <p className="cvq-faceoff-side-line">{stripCites(council.judge.bottomLine)}</p>
            </Card>
          );
        })}
      </div>

      <Section title="How it was decided">
        <Prose text={v.summary} />
      </Section>

      {v.dimensions.length > 0 && (
        <Section title="Head to head">
          <div className="cvq-h2h">
            <div className="cvq-h2h-row cvq-h2h-row--head">
              <span data-no-translate>{result.tickerA}</span>
              <span />
              <span data-no-translate>{result.tickerB}</span>
            </div>
            {/* Defense in depth: older cached verdicts (and the odd model
                slip) can still carry internal score rows — never render them. */}
            {v.dimensions.filter((d) => !/conviction|disagreement/i.test(d.dimension)).map((d, i) => (
              <div key={i} className="cvq-h2h-row">
                <span className={d.edge === "a" ? "cvq-h2h-win" : ""}>{d.aValue}</span>
                <span className="cvq-h2h-dim">{d.dimension}</span>
                <span className={d.edge === "b" ? "cvq-h2h-win" : ""}>{d.bValue}</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      <Section title="Value for your money">
        <Prose text={v.valuationEdge} />
      </Section>
      <Section title="Who's winning the business">
        <Prose text={v.positioningEdge} />
      </Section>
      <Section title="What could move them next">
        <Prose text={v.catalystEdge} />
      </Section>
      <Section title="Risk and reward">
        <Prose text={v.riskRewardEdge} />
      </Section>
      <Section title="Bottom line">
        <Prose text={v.bottomLine} />
      </Section>

      <LearnWhy corpus={corpus} />
      <SourcesAccordion
        sources={[...result.a.factSheet.sources, ...result.b.factSheet.sources]}
      />
    </div>
  );
}

// ── Sector Pulse ─────────────────────────────────────────────────────────────

export function SectorAnswer({ result }: { result: SectorResult }) {
  const v = result.verdict;
  const corpus = [v.summary, v.macroRead, v.bullCase, v.bearCase].join(" ");
  return (
    <div className="cvq-answer">
      <HeaderCard
        eyebrow="Sector Pulse"
        title={result.sectorLabel}
        verdictRow={
          <>
            <VerdictChip verdict={v.stance} />
            <HowSureChip conviction={v.conviction} />
          </>
        }
        line={stripCites(v.headline)}
      />
      <Section title="The big picture">
        <Prose text={v.summary} />
      </Section>
      <Section title="Where the strength is">
        <Prose text={`**${v.topSubSector}.** ${v.topSubSectorRationale}`} />
      </Section>
      <Section title="The standout">
        <Prose text={`**${v.topPick}.** ${v.topPickRationale}`} />
      </Section>
      <Section title="The contrarian call">
        <Prose text={`**${v.mostDivisive}.** ${v.mostDivisiveRationale}`} />
      </Section>
      <Section title="The bigger forces at work">
        <Prose text={v.macroRead} />
      </Section>
      <Section title="If the theme works">
        <Prose text={v.bullCase} />
      </Section>
      <Section title="If it doesn't">
        <Prose text={v.bearCase} />
      </Section>
      {v.ranking.length > 0 && (
        <Section title="The field, ranked">
          <div className="cvq-ranking">
            {v.ranking.map((r, i) => (
              <div key={r.ticker} className="cvq-ranking-row">
                <span className="cvq-ranking-pos">{i + 1}</span>
                <span className="cvq-ticker-sym" data-no-translate>{r.ticker}</span>
                <span className={`cvq-verdict cvq-verdict--${r.verdict.toLowerCase()} cvq-verdict--mini`}>
                  {VERDICT_LABEL[r.verdict]}
                </span>
                <HowSureChip conviction={r.conviction} />
                <span className="cvq-ranking-note">{stripCites(r.note)}</span>
              </div>
            ))}
          </div>
        </Section>
      )}
      <Section title="Bottom line">
        <Prose text={v.bottomLine} />
      </Section>
      <LearnWhy corpus={corpus} />
      <SourcesAccordion sources={result.constituents.flatMap((c) => c.sources)} />
    </div>
  );
}

// ── Headline Decoder ─────────────────────────────────────────────────────────

export function HeadlineAnswer({ result, quotes }: { result: HeadlineResult; quotes: QuoteMap }) {
  const corpus = [result.summary, result.impacts.map((i) => i.why).join(" ")].join(" ");
  const DIRECTION_LABEL = { up: "Could help", down: "Could hurt", unclear: "Cuts both ways" } as const;
  return (
    <div className="cvq-answer">
      <HeaderCard
        eyebrow="Headline Decoder"
        title={<span className="cvq-headline-quote">“{result.headline}”</span>}
        line={stripCites(result.takeaway)}
      />
      <Section title="What happened">
        <Prose text={result.summary} />
      </Section>
      <Section title="The stocks it touches">
        <div className="cvq-impacts">
          {result.impacts.map((imp) => {
            const q = quotes[imp.ticker];
            return (
              <Card key={imp.ticker} className="cvq-impact">
                <div className="cvq-impact-head">
                  <span className="cvq-ticker-sym" data-no-translate>{imp.ticker}</span>
                  <span className="cvq-impact-name">{imp.companyName}</span>
                  <QuoteLine quote={q} />
                </div>
                <div className="cvq-impact-dir">
                  {imp.direction === "up" && <ChangePill change={1} label={DIRECTION_LABEL.up} />}
                  {imp.direction === "down" && <ChangePill change={-1} label={DIRECTION_LABEL.down} />}
                  {imp.direction === "unclear" && <span className="cvq-pill cvq-pill--flat">{DIRECTION_LABEL.unclear}</span>}
                </div>
                <p className="cvq-impact-why">{stripCites(imp.why)}</p>
              </Card>
            );
          })}
        </div>
      </Section>
      {result.watchFor.length > 0 && (
        <Section title="What to watch next">
          <ul className="cvq-watchlist">
            {result.watchFor.map((w, i) => (
              <li key={i}>{stripCites(w)}</li>
            ))}
          </ul>
        </Section>
      )}
      <LearnWhy corpus={corpus} />
      <SourcesAccordion sources={result.sources} />
    </div>
  );
}

// ── Starter Portfolio (allocator) ────────────────────────────────────────────

export function AllocatorAnswer({ result }: { result: AllocatorResult }) {
  const plan = result.plan;
  const corpus = [plan.sipPlan, plan.fits.join(" "), plan.allocation.map((a) => a.rationale).join(" ")].join(" ");
  const riskLabel = plan.riskLevel.charAt(0).toUpperCase() + plan.riskLevel.slice(1);
  return (
    <div className="cvq-answer">
      <HeaderCard
        eyebrow="Starter Portfolio"
        title="Your plan"
        right={
          <span className="cvq-quoteline">
            <span className="cvq-pill cvq-pill--flat">Risk: {riskLabel}</span>
            <span className="cvq-pill cvq-pill--flat">{plan.expectedReturnBand}</span>
          </span>
        }
        line={stripCites(plan.profileSummary)}
      />

      {plan.prerequisites.length > 0 && (
        <Section title="Before you invest a dollar">
          <ul className="cvq-watchlist">
            {plan.prerequisites.map((p, i) => (
              <li key={i}>
                <strong>{p.title}.</strong> {stripCites(p.detail)}
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="The mix">
        <div className="cvq-alloc">
          {plan.allocation.map((line, i) => (
            <div key={i} className="cvq-alloc-row">
              <div className="cvq-alloc-head">
                <span className="cvq-ticker-sym" data-no-translate>{line.vehicle}</span>
                <span className="cvq-alloc-name">{line.vehicleName}</span>
                <span className="cvq-alloc-weight">{line.weightPct}%</span>
              </div>
              <div className="cvq-alloc-bar" aria-hidden>
                <span style={{ width: `${Math.min(100, Math.max(0, line.weightPct))}%` }} />
              </div>
              <div className="cvq-alloc-sub">
                {line.amountUSD > 0 && <span>${line.amountUSD.toLocaleString()} now</span>}
                {line.monthlyUSD > 0 && <span>${line.monthlyUSD.toLocaleString()}/month</span>}
                <span>{line.expectedReturn}</span>
              </div>
              <p className="cvq-alloc-why">{stripCites(line.rationale)}</p>
            </div>
          ))}
        </div>
      </Section>

      {plan.accountPriority.length > 0 && (
        <Section title="Where to put it, in order">
          <ol className="cvq-steps">
            {plan.accountPriority.map((s, i) => (
              <li key={i}>
                <strong>{s.account}.</strong> {stripCites(s.detail)}
              </li>
            ))}
          </ol>
        </Section>
      )}

      <Section title="The monthly habit">
        <Prose text={plan.sipPlan} />
      </Section>

      {plan.fits.length > 0 && (
        <Section title="Why this fits you">
          <ul className="cvq-watchlist">
            {plan.fits.map((f, i) => (
              <li key={i}>{stripCites(f)}</li>
            ))}
          </ul>
        </Section>
      )}

      {plan.exclusions.length > 0 && (
        <Section title="What we left out, and why">
          <ul className="cvq-watchlist">
            {plan.exclusions.map((e, i) => (
              <li key={i}>
                <strong>{e.option}.</strong> {stripCites(e.reason)}
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="Bottom line">
        <Prose text={plan.bottomLine} />
      </Section>

      <LearnWhy corpus={corpus} />
      <SourcesAccordion sources={result.factSheet.sources} />
    </div>
  );
}

// ── Portfolio Health Check (audit) ───────────────────────────────────────────

const SEVERITY_LABEL = {
  low: "Low risk",
  moderate: "Worth watching",
  elevated: "Needs attention",
  high: "Serious",
} as const;

export function AuditAnswer({ result }: { result: PortfolioAuditResult }) {
  const j = result.judge;
  const corpus = [j.assessment, result.agents.map((a) => a.finding).join(" ")].join(" ");
  return (
    <div className="cvq-answer">
      <HeaderCard
        eyebrow="Portfolio Health Check"
        title={result.portfolioName || "Your portfolio"}
        right={
          <span className="cvq-grade" aria-label={`Health grade ${j.healthGrade}`}>
            {j.healthGrade}
          </span>
        }
        verdictRow={<HowSureChip conviction={100 - result.disagreement} />}
        line={stripCites(j.bottomLine)}
      />

      <Section title="The overall read">
        <Prose text={j.assessment} />
      </Section>

      {result.agents.length > 0 && (
        <Section title="Where the risk hides">
          <div className="cvq-riskdims">
            {result.agents.map((a) => (
              <div key={a.dimension} className="cvq-riskdim">
                <div className="cvq-riskdim-head">
                  <strong>{a.dimension}</strong>
                  <span className="cvq-pill cvq-pill--flat">{SEVERITY_LABEL[a.severity]}</span>
                </div>
                <p>{stripCites(a.finding)}</p>
                {a.flaggedTickers.length > 0 && (
                  <p className="cvq-riskdim-flags" data-no-translate>
                    {a.flaggedTickers.join(" · ")}
                  </p>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      {j.scenarios.length > 0 && (
        <Section title="If markets get rough">
          <div className="cvq-riskdims">
            {j.scenarios.map((s, i) => (
              <div key={i} className="cvq-riskdim">
                <div className="cvq-riskdim-head">
                  <strong>{s.name}</strong>
                  <span className="cvq-pill cvq-pill--down">
                    <span className="cvq-pill-arrow" aria-hidden>▼</span>
                    {s.estImpactPct}
                  </span>
                </div>
                <p>{stripCites(s.narrative)}</p>
              </div>
            ))}
          </div>
        </Section>
      )}

      {j.hedges.length > 0 && (
        <Section title="How to shore it up">
          <ol className="cvq-steps">
            {[...j.hedges]
              .sort((a, b) => a.priority - b.priority)
              .map((h, i) => (
                <li key={i}>
                  <strong>{h.action}.</strong> {stripCites(h.rationale)}
                </li>
              ))}
          </ol>
        </Section>
      )}

      <LearnWhy corpus={corpus} />
      <SourcesAccordion sources={result.factSheet.sources} />
    </div>
  );
}

// ── Plain text (general questions) ───────────────────────────────────────────

export function TextAnswer({ text }: { text: string }) {
  return (
    <div className="cvq-answer">
      <Card padding="lg">
        <Prose text={text} />
      </Card>
      <LearnWhy corpus={text} />
    </div>
  );
}
