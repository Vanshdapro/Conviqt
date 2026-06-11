import type { Metadata } from "next";
import Link from "next/link";
import { ResearchTabs } from "@/components/research/ResearchTabs";
import { getDisplayCDI, type CDIEntry, type CDISnapshot } from "@/lib/cdi";

// conviqt.com/cdi — The Conviqt Disagreement Index (CDI).
//
// A weekly published ranking of the 20 stocks the AI Council fractured on hardest.
// This is a named DATA PRODUCT, not just a feature: the goal is earned media and
// backlinks. A journalist writing about market uncertainty cites the VIX or
// put/call ratios; if the CDI publishes consistently, it becomes a thing they can
// cite and link to. So this page is built for citation — fixed weekly snapshot,
// clean structured markup (schema.org Dataset + ItemList), an explicit "cite this"
// block, and a stable canonical URL.

// Rendered on demand (SSR). The page reads a frozen weekly snapshot, so per-request
// rendering is cheap. NOTE: this route was moved off the literal /index path to /cdi
// because a route folder named `index` collides with the root segment under Next
// 16.2/Turbopack and crashes Vercel's onBuildComplete (ENOENT __PAGE__.segment.rsc);
// force-dynamic alone did not fix it — the rename does. A 301 from /index lives in
// next.config.ts so existing citations and inbound links still resolve.
export const dynamic = "force-dynamic";

const BASE = "https://www.conviqt.com";

const INK = "#e8edf8";
const MUTED = "#8aa0c2";
const FAINT = "#6c82a3";
const ACCENT = "#4f87f7";
const HOT = "#f0883e"; // rising disagreement
const COOL = "#3fb27f"; // cooling disagreement
const SELL = "#e5687a";
const RULE = "rgba(232,237,248,0.075)";
const MONO = "var(--font-mono), 'JetBrains Mono', monospace";
const SANS = "var(--font-sans), system-ui, sans-serif";
const DISPLAY = "var(--font-display), Georgia, 'Times New Roman', serif";
const SERIF = "var(--font-serif), Georgia, serif";

export const metadata: Metadata = {
  title: "The Conviqt Disagreement Index (CDI) — the week's most AI-contested stocks",
  description:
    "A weekly ranking of the 20 stocks Conviqt's AI Council disagreed on most. Disagreement scores, week-over-week conviction trend, and what the agents are fighting about — the first published index of AI disagreement on public equities.",
  alternates: { canonical: `${BASE}/cdi` },
  openGraph: {
    title: "The Conviqt Disagreement Index (CDI)",
    description:
      "The 20 most AI-contested stocks this week — disagreement scores, conviction trend, and what the agents are fighting about.",
    url: `${BASE}/cdi`,
    type: "website",
  },
};

function formatWeek(weekOf: string): string {
  const d = new Date(`${weekOf}T00:00:00Z`);
  return d.toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function verdictColor(v: string): string {
  if (v === "BUY") return COOL;
  if (v === "SELL") return SELL;
  return MUTED;
}

export default async function CDIPage() {
  const snapshot = await getDisplayCDI();

  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(ellipse at 15% 60%, rgba(30,90,180,0.22) 0%, transparent 55%), radial-gradient(ellipse at 85% 20%, rgba(20,70,160,0.18) 0%, transparent 55%), radial-gradient(ellipse at 50% 95%, rgba(15,60,120,0.16) 0%, transparent 50%), linear-gradient(175deg, #060b12 0%, #0b1020 60%, #07090f 100%)",
      }}
    >
      <ResearchTabs active="index" />

      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "48px 24px 80px", fontFamily: SANS }}>
        {snapshot && snapshot.entries.length > 0 ? (
          <CDIBody snapshot={snapshot} />
        ) : (
          <EmptyState />
        )}
      </main>

      {snapshot && snapshot.entries.length > 0 && <StructuredData snapshot={snapshot} />}
    </div>
  );
}

function CDIBody({ snapshot }: { snapshot: CDISnapshot }) {
  const week = formatWeek(snapshot.weekOf);
  return (
    <>
      <header style={{ marginBottom: 36, maxWidth: 820 }}>
        <div
          style={{
            color: ACCENT,
            fontFamily: MONO,
            fontSize: 10,
            letterSpacing: "0.26em",
            textTransform: "uppercase",
            marginBottom: 18,
          }}
        >
          A Conviqt Data Product · Updated weekly
        </div>
        <h1
          style={{
            color: INK,
            fontFamily: DISPLAY,
            fontSize: 52,
            lineHeight: 1.03,
            letterSpacing: "-0.02em",
            fontWeight: 500,
            margin: "0 0 18px",
          }}
        >
          The Conviqt Disagreement Index
        </h1>
        <p style={{ color: MUTED, fontFamily: SERIF, fontSize: 17.5, lineHeight: 1.64, margin: "0 0 8px", maxWidth: 720 }}>
          Every week we rank the {snapshot.entries.length}{" "}
          stocks our five-agent AI Council fractured on hardest — where the models
          split BUY against SELL on the same
          evidence. The higher the score, the louder the fight. It&rsquo;s the first
          published index of AI disagreement on public equities, and it deepens with
          every analysis we run.
        </p>
        <div style={{ color: FAINT, fontFamily: MONO, fontSize: 11.5, letterSpacing: "0.08em", marginTop: 14 }}>
          Week of {week}
        </div>
      </header>

      <StatStrip snapshot={snapshot} />

      <CiteBlock snapshot={snapshot} week={week} />

      <Table entries={snapshot.entries} />

      <section style={{ marginTop: 44, paddingTop: 22, borderTop: `1px solid ${RULE}`, maxWidth: 760 }}>
        <h2 style={{ color: INK, fontFamily: DISPLAY, fontSize: 22, fontWeight: 500, margin: "0 0 12px" }}>
          How the index is built
        </h2>
        <p style={{ color: MUTED, fontFamily: SERIF, fontSize: 14.5, lineHeight: 1.65, margin: "0 0 10px" }}>
          For each stock, four specialist agents (Fundamentals, Technicals, Sentiment,
          Macro) independently issue a BUY / HOLD / SELL on the same source-linked
          fact sheet. The disagreement score is computed deterministically from how
          far their confidence-weighted verdicts spread — a panel that splits BUY
          against SELL scores far higher than one that splits BUY against HOLD. The
          score is the Council&rsquo;s, not a model&rsquo;s self-report.
        </p>
        <p style={{ color: FAINT, fontFamily: SERIF, fontSize: 13.5, lineHeight: 1.6, margin: 0 }}>
          The trend arrow compares each name&rsquo;s disagreement to last week&rsquo;s
          published index. Rankings are frozen weekly so they stay stable to cite.{" "}
          <Link href="/methodology" style={{ color: ACCENT, textDecoration: "none" }}>
            Read the full methodology →
          </Link>
        </p>
      </section>

      <footer style={{ marginTop: 36, paddingTop: 16, borderTop: `1px solid ${RULE}`, color: FAINT, fontSize: 12, lineHeight: 1.6 }}>
        Analysis only, not personalized financial advice. We market transparency, not
        alpha — a high disagreement score is a signal of contested evidence, not a
        trade recommendation. Every underlying number links to a source on each
        stock&rsquo;s report page.
      </footer>
    </>
  );
}

function StatStrip({ snapshot }: { snapshot: CDISnapshot }) {
  const cells: { label: string; value: string; sub?: string }[] = [
    {
      label: "Most contested",
      value: snapshot.peakTicker ?? "—",
      sub: `${snapshot.peakDisagreement}/100 disagreement`,
    },
    { label: "Index average", value: `${snapshot.avgDisagreement}`, sub: "disagreement, 0–100" },
    { label: "Names ranked", value: `${snapshot.entries.length}`, sub: "top of the universe" },
  ];
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        gap: 14,
        marginBottom: 30,
      }}
    >
      {cells.map((c) => (
        <div
          key={c.label}
          style={{
            padding: "18px 20px",
            border: `1px solid ${RULE}`,
            borderRadius: 10,
            background: "rgba(255,255,255,0.012)",
          }}
        >
          <div style={{ color: FAINT, fontFamily: MONO, fontSize: 9.5, letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 10 }}>
            {c.label}
          </div>
          <div style={{ color: INK, fontFamily: DISPLAY, fontSize: 30, fontWeight: 500, lineHeight: 1 }}>
            {c.value}
          </div>
          {c.sub && <div style={{ color: MUTED, fontFamily: MONO, fontSize: 11, marginTop: 8 }}>{c.sub}</div>}
        </div>
      ))}
    </div>
  );
}

// The press-release / citation hook — the reason this is a data product.
function CiteBlock({ snapshot, week }: { snapshot: CDISnapshot; week: string }) {
  const peak = snapshot.entries[0];
  const citation = peak
    ? `The Conviqt Disagreement Index ranked ${peak.ticker} the most AI-contested stock the week of ${week}, scoring ${peak.disagreement}/100 as the Council split ${peak.voteSplit || "across the panel"}. (Source: Conviqt Disagreement Index, ${BASE}/cdi)`
    : `The Conviqt Disagreement Index, week of ${week}. (Source: ${BASE}/cdi)`;
  return (
    <section
      style={{
        marginBottom: 34,
        padding: "20px 24px",
        border: `1px solid ${RULE}`,
        borderLeft: `3px solid ${ACCENT}`,
        borderRadius: 10,
        background: "rgba(79,135,247,0.05)",
      }}
    >
      <div style={{ color: ACCENT, fontFamily: MONO, fontSize: 9.5, letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 10 }}>
        Cite this index
      </div>
      <p style={{ color: INK, fontFamily: SERIF, fontSize: 14.5, lineHeight: 1.62, margin: 0, fontStyle: "italic" }}>
        &ldquo;{citation}&rdquo;
      </p>
      <p style={{ color: FAINT, fontFamily: SANS, fontSize: 12.5, lineHeight: 1.55, margin: "12px 0 0" }}>
        Writing about market uncertainty? The CDI is free to reference with attribution
        and a link. For licensed or historical data, reach us at{" "}
        <a href="mailto:press@conviqt.com" style={{ color: ACCENT, textDecoration: "none" }}>
          press@conviqt.com
        </a>
        .
      </p>
    </section>
  );
}

function TrendCell({ entry }: { entry: CDIEntry }) {
  if (entry.trend === "new") {
    return (
      <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.12em", color: ACCENT, border: `1px solid ${ACCENT}`, borderRadius: 4, padding: "2px 6px" }}>
        NEW
      </span>
    );
  }
  if (entry.trend === "flat") {
    return <span style={{ fontFamily: MONO, fontSize: 13, color: FAINT }}>±0</span>;
  }
  const rising = entry.trend === "up";
  const color = rising ? HOT : COOL;
  const arrow = rising ? "▲" : "▼";
  return (
    <span style={{ fontFamily: MONO, fontSize: 12.5, color }} title={`${rising ? "+" : ""}${entry.trendDelta} vs last week`}>
      {arrow} {Math.abs(entry.trendDelta)}
    </span>
  );
}

function Table({ entries }: { entries: CDIEntry[] }) {
  return (
    <div style={{ border: `1px solid ${RULE}`, borderRadius: 12, overflow: "hidden" }}>
      {/* Header row */}
      <div
        className="cdi-row cdi-head"
        style={{
          display: "grid",
          gridTemplateColumns: "44px 1.6fr 92px 78px 1fr",
          gap: 16,
          padding: "14px 20px",
          borderBottom: `1px solid ${RULE}`,
          background: "rgba(255,255,255,0.02)",
          color: FAINT,
          fontFamily: MONO,
          fontSize: 9.5,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
        }}
      >
        <div>#</div>
        <div>Stock</div>
        <div style={{ textAlign: "right" }}>Disagree</div>
        <div style={{ textAlign: "right" }}>vs Last wk</div>
        <div>What they&rsquo;re fighting about</div>
      </div>

      <style>{`
        @media (max-width: 760px) {
          .cdi-row { grid-template-columns: 32px 1fr 70px !important; }
          .cdi-col-trend, .cdi-col-fight { display: none !important; }
          .cdi-head .cdi-col-trend, .cdi-head .cdi-col-fight { display: none !important; }
        }
      `}</style>

      {entries.map((e, i) => (
        <Link
          key={e.ticker}
          href={`/stock/${e.ticker.toLowerCase()}`}
          className="cdi-row"
          style={{
            display: "grid",
            gridTemplateColumns: "44px 1.6fr 92px 78px 1fr",
            gap: 16,
            padding: "18px 20px",
            borderBottom: i === entries.length - 1 ? "none" : `1px solid ${RULE}`,
            textDecoration: "none",
            alignItems: "center",
          }}
        >
          {/* rank */}
          <div style={{ color: i < 3 ? ACCENT : FAINT, fontFamily: DISPLAY, fontSize: 22, fontWeight: 500 }}>
            {e.rank}
          </div>

          {/* stock */}
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
              <span style={{ color: INK, fontFamily: MONO, fontSize: 15, fontWeight: 600, letterSpacing: "0.04em" }}>
                {e.ticker}
              </span>
              <span
                style={{
                  color: verdictColor(e.verdict),
                  fontFamily: MONO,
                  fontSize: 10,
                  letterSpacing: "0.12em",
                  border: `1px solid ${verdictColor(e.verdict)}`,
                  borderRadius: 4,
                  padding: "1px 6px",
                }}
              >
                {e.verdict} · {e.conviction}
              </span>
            </div>
            <div style={{ color: MUTED, fontFamily: SANS, fontSize: 12.5, marginTop: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {e.companyName}
            </div>
          </div>

          {/* disagreement */}
          <div style={{ textAlign: "right" }}>
            <span style={{ color: INK, fontFamily: DISPLAY, fontSize: 26, fontWeight: 500 }}>{e.disagreement}</span>
            <span style={{ color: FAINT, fontFamily: MONO, fontSize: 10 }}>/100</span>
          </div>

          {/* trend */}
          <div className="cdi-col-trend" style={{ textAlign: "right" }}>
            <TrendCell entry={e} />
          </div>

          {/* fight */}
          <div className="cdi-col-fight" style={{ minWidth: 0 }}>
            {e.voteSplit && (
              <div style={{ color: e.dissents.length ? HOT : MUTED, fontFamily: MONO, fontSize: 10.5, letterSpacing: "0.04em", marginBottom: 5 }}>
                {e.voteSplit}
                {e.dissents.length ? ` · ${e.dissents.join(" & ")} dissent` : ""}
              </div>
            )}
            <div style={{ color: MUTED, fontFamily: SANS, fontSize: 12.5, lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
              {e.bullLine && e.bearLine
                ? `Bull: ${e.bullLine} Bear: ${e.bearLine}`
                : e.fight}
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div style={{ maxWidth: 640, padding: "60px 0" }}>
      <h1 style={{ color: INK, fontFamily: DISPLAY, fontSize: 40, fontWeight: 500, margin: "0 0 16px" }}>
        The Conviqt Disagreement Index
      </h1>
      <p style={{ color: MUTED, fontFamily: SERIF, fontSize: 16, lineHeight: 1.6, margin: 0 }}>
        The index publishes once enough Council runs are on the record this week. Run
        an analysis from the{" "}
        <Link href="/chat" style={{ color: ACCENT, textDecoration: "none" }}>
          Analyst
        </Link>{" "}
        to start filling it.
      </p>
    </div>
  );
}

// schema.org markup so finance aggregators and search engines can parse the
// index as a structured Dataset + ranked ItemList — the machine-readable half
// of "publish it so it gets picked up."
function StructuredData({ snapshot }: { snapshot: CDISnapshot }) {
  const dataset = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: "The Conviqt Disagreement Index",
    alternateName: "CDI",
    description:
      "A weekly ranking of the public-equity stocks Conviqt's multi-agent AI Council disagreed on most, scored 0–100 by confidence-weighted verdict spread.",
    url: `${BASE}/cdi`,
    creator: { "@type": "Organization", name: "Conviqt", url: BASE },
    publisher: { "@type": "Organization", name: "Conviqt", url: BASE },
    temporalCoverage: snapshot.weekOf,
    dateModified: snapshot.generatedAt,
    isAccessibleForFree: true,
    variableMeasured: "AI agent disagreement score (0–100)",
    keywords: ["AI disagreement", "equity research", "stock sentiment", "disagreement index"],
  };

  const itemList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `The Conviqt Disagreement Index — week of ${snapshot.weekOf}`,
    numberOfItems: snapshot.entries.length,
    itemListOrder: "https://schema.org/ItemListOrderDescending",
    itemListElement: snapshot.entries.map((e) => ({
      "@type": "ListItem",
      position: e.rank,
      name: `${e.ticker} — ${e.companyName}`,
      url: `${BASE}/stock/${e.ticker.toLowerCase()}`,
    })),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(dataset) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemList) }} />
    </>
  );
}
