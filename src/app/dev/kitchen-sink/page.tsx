"use client";

import { useState } from "react";
import {
  Card,
  StatTile,
  TickerChip,
  ChangePill,
  Sparkline,
  AreaChart,
  Skeleton,
  SkeletonText,
  SkeletonLoader,
  EmptyState,
  ModeToggle,
  Sheet,
} from "@/components/ui";
import { OnboardingSheet, Tour } from "@/components/onboarding/FirstRun";
import { PaywallSheet } from "@/components/PaywallSheet";

// Phase 2 kitchen sink — every Almanac primitive on one page, inside the live
// shell, for founder review. Strict rule: only tokens.css colours appear; this
// page references var(--token) and component classes exclusively.

const SPARK_UP = [12, 13, 12.4, 14, 13.6, 15.2, 15, 16.4, 17.1, 16.8, 18.2, 19];
const SPARK_DOWN = [22, 21.4, 21.8, 20.1, 20.6, 19.2, 18.4, 18.9, 17.2, 16.5, 16.8, 15.1];
const AREA = [42, 44, 43.2, 47, 46.1, 49, 52, 51.3, 55, 58, 56.4, 60, 63, 62.1, 67];

const TOKEN_GROUPS: { title: string; tokens: string[] }[] = [
  { title: "Neutrals — warm paper", tokens: ["--bg-page", "--bg-surface", "--bg-sunken", "--border", "--border-strong"] },
  { title: "Ink — espresso", tokens: ["--text", "--text-2", "--text-muted"] },
  { title: "Accent — teal", tokens: ["--accent", "--accent-hover", "--accent-weak", "--link"] },
  { title: "Market — gain / loss", tokens: ["--up", "--up-weak", "--up-ink", "--down", "--down-weak", "--down-ink"] },
  { title: "Drama", tokens: ["--espresso"] },
];

const SKILLS = [
  { name: "Worth Owning?", line: "Is this a company you'd want for years?" },
  { name: "Quick Take", line: "The 30-second read on any ticker" },
  { name: "Entry & Exit Zones", line: "Where the smart levels sit" },
  { name: "Face-Off", line: "Two stocks enter. One wins." },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: "var(--space-12)" }}>
      <h2
        style={{
          fontFamily: "var(--font-display)",
          fontWeight: 700,
          fontSize: "13px",
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "var(--text-muted)",
          margin: "0 0 var(--space-5)",
          paddingBottom: "var(--space-3)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

const grid = (min: number): React.CSSProperties => ({
  display: "grid",
  gap: "var(--space-4)",
  gridTemplateColumns: `repeat(auto-fill, minmax(${min}px, 1fr))`,
});

export default function KitchenSink() {
  const [mode, setMode] = useState<"council" | "flash">("council");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [obOpen, setObOpen] = useState(false);
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);

  return (
    <div style={{ maxWidth: 1040, margin: "0 auto", padding: "var(--space-10) var(--space-6) var(--space-16)" }}>
      {/* Page header */}
      <header style={{ marginBottom: "var(--space-12)" }}>
        <div style={{ fontSize: "12px", letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--accent-hover)", marginBottom: "var(--space-3)" }}>
          Almanac · Phase 2
        </div>
        <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "clamp(32px, 6vw, 48px)", lineHeight: 1.05, margin: 0, color: "var(--text)" }}>
          Kitchen Sink
        </h1>
        <p style={{ fontSize: "16px", color: "var(--text-2)", marginTop: "var(--space-3)", maxWidth: "56ch", lineHeight: 1.5 }}>
          Every brand primitive on warm paper. Cabinet Grotesk for display, General
          Sans for UI &amp; data. One teal accent; Pacific-blue and coral only ever
          touch market gains and losses.
        </p>
      </header>

      {/* Colour tokens */}
      <Section title="Colour tokens">
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
          {TOKEN_GROUPS.map((group) => (
            <div key={group.title}>
              <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "var(--space-3)" }}>{group.title}</div>
              <div style={grid(120)}>
                {group.tokens.map((tk) => (
                  <div key={tk} style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-control)", overflow: "hidden", background: "var(--bg-surface)" }}>
                    <div style={{ height: 52, background: `var(${tk})`, borderBottom: "1px solid var(--border)" }} />
                    <div style={{ padding: "8px 10px", fontSize: "11.5px", color: "var(--text-2)", fontVariantNumeric: "tabular-nums" }} data-no-translate>
                      {tk}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Typography */}
      <Section title="Typography">
        <Card>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "44px", lineHeight: 1, color: "var(--text)" }}>
            Cabinet Grotesk
          </div>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "30px", color: "var(--text)", marginTop: "var(--space-3)" }}>
            $1,203.50 &nbsp; +3.87% &nbsp; 24.8%
          </div>
          <p style={{ fontFamily: "var(--font-ui)", fontSize: "16px", lineHeight: 1.6, color: "var(--text-2)", marginTop: "var(--space-4)", marginBottom: 0 }}>
            General Sans carries the UI and body copy. Numbers use tabular figures so
            columns of prices and percentages line up cleanly:
            <span style={{ fontVariantNumeric: "tabular-nums", display: "block", marginTop: 6, color: "var(--text)" }}>
              0123456789 · 1,000,000 · 12.34% · −4.10%
            </span>
          </p>
        </Card>
      </Section>

      {/* Cards */}
      <Section title="Card — tone + 1px border (not heavy shadow)">
        <div style={grid(220)}>
          <Card><CardLabel>surface</CardLabel></Card>
          <Card tone="sunken"><CardLabel>sunken (Sand Dune)</CardLabel></Card>
          <Card raised><CardLabel>raised (max shadow)</CardLabel></Card>
          <Card interactive><CardLabel>interactive — hover me</CardLabel></Card>
        </div>
      </Section>

      {/* StatTiles */}
      <Section title="StatTile — the stats strip">
        <div style={grid(180)}>
          <StatTile label="Beta vs SPY" value="1.12" sub="moves a bit more than the market" />
          <StatTile label="Volatility" value="24.8%" sub="annualized" />
          <StatTile
            label="Max Drawdown"
            value={<span style={{ color: "var(--down-ink)" }}>−31.4%</span>}
            sub="worst peak-to-trough"
            onInfo={() => setInfoOpen(true)}
            infoLabel="What is max drawdown?"
          />
          <StatTile label="Sharpe" value="0.86" sub="return per unit of risk" />
        </div>
      </Section>

      {/* Ticker chips + pills */}
      <Section title="TickerChip — price + change as a tinted pill (▲▼)">
        <Card>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
            <TickerChip symbol="AAPL" price={214.29} change={1.24} />
            <TickerChip symbol="NVDA" price={1203.5} change={3.87} />
            <TickerChip symbol="TSLA" price={178.02} change={-2.15} />
            <TickerChip symbol="SPY" price={548.1} change={0.42} />
            <TickerChip symbol="DELL" price={132.4} change={0} />
            <div style={{ borderTop: "1px solid var(--border)", paddingTop: "var(--space-4)", display: "flex", gap: "var(--space-3)", flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>Standalone pills:</span>
              <ChangePill change={2.57} />
              <ChangePill change={-1.4} />
              <ChangePill change={0} />
              <span style={{ fontSize: "13px", color: "var(--text-muted)", marginLeft: "var(--space-3)" }}>Inline (no pill):</span>
              <TickerChip symbol="MSFT" price={441.2} change={0.93} pill={false} />
              <TickerChip symbol="AMD" price={162.7} change={-3.1} pill={false} />
            </div>
          </div>
        </Card>
      </Section>

      {/* Charts */}
      <Section title="Sparkline + AreaChart — lightweight SVG, teal on paper">
        <div style={{ ...grid(240), marginBottom: "var(--space-4)" }}>
          <Card>
            <CardLabel>Sparkline · auto-tone up</CardLabel>
            <div style={{ marginTop: "var(--space-3)" }}>
              <Sparkline data={SPARK_UP} width={200} height={44} autoTone showDot />
            </div>
          </Card>
          <Card>
            <CardLabel>Sparkline · auto-tone down</CardLabel>
            <div style={{ marginTop: "var(--space-3)" }}>
              <Sparkline data={SPARK_DOWN} width={200} height={44} autoTone showDot />
            </div>
          </Card>
          <Card>
            <CardLabel>Sparkline · teal accent</CardLabel>
            <div style={{ marginTop: "var(--space-3)" }}>
              <Sparkline data={AREA.slice(0, 10)} width={200} height={44} showDot />
            </div>
          </Card>
        </div>
        <Card padding="lg">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "var(--space-4)" }}>
            <CardLabel>AreaChart · NVDA 1Y (illustrative)</CardLabel>
            <TickerChip price={63.0} change={50.0} />
          </div>
          <AreaChart data={AREA} height={200} ariaLabel="Illustrative price trend" />
        </Card>
      </Section>

      {/* Mode toggle + buttons */}
      <Section title="ModeToggle + buttons">
        <Card>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-5)", alignItems: "center" }}>
            <ModeToggle value={mode} onChange={setMode} />
            <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>
              selected: <strong style={{ color: "var(--text)" }}>{mode}</strong>
            </span>
            <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap", marginLeft: "auto" }}>
              <button className="cvq-btn cvq-btn--primary" type="button">Primary</button>
              <button className="cvq-btn cvq-btn--secondary" type="button">Secondary</button>
              <button className="cvq-btn cvq-btn--ghost" type="button">Ghost</button>
            </div>
          </div>
        </Card>
      </Section>

      {/* Skeletons */}
      <Section title="SkeletonLoader">
        <div style={grid(260)}>
          <SkeletonLoader />
          <Card>
            <CardLabel>Skeleton lines</CardLabel>
            <div style={{ marginTop: "var(--space-4)" }}>
              <SkeletonText lines={4} />
            </div>
            <div style={{ display: "flex", gap: "var(--space-3)", marginTop: "var(--space-5)", alignItems: "center" }}>
              <Skeleton width={40} height={40} circle />
              <Skeleton width="50%" height={14} />
            </div>
          </Card>
        </div>
      </Section>

      {/* Empty + Sheet */}
      <Section title="EmptyState + Sheet">
        <div style={grid(300)}>
          <EmptyState
            title="No holdings yet"
            body="Add a ticker to start tracking value, day P/L, and risk stats — no fake data, ever."
            action={<button className="cvq-btn cvq-btn--primary" type="button">Add your first holding</button>}
          />
          <Card>
            <CardLabel>Sheet — side panel (desktop) / bottom sheet (mobile)</CardLabel>
            <p style={{ fontSize: "14px", color: "var(--text-2)", lineHeight: 1.5, margin: "var(--space-3) 0 var(--space-4)" }}>
              The Sheet hosts the Skill Library, the AI Health Check, and Academy
              lesson pop-overs.
            </p>
            <button className="cvq-btn cvq-btn--secondary" type="button" onClick={() => setSheetOpen(true)}>
              Open Skill Library
            </button>
          </Card>
        </div>
      </Section>

      {/* Phase 7 — onboarding, soft paywall, first-run tour */}
      <Section title="Phase 7 — onboarding & subscription">
        <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-3)" }}>
          <button className="cvq-btn cvq-btn--primary" type="button" onClick={() => setObOpen(true)}>
            Open onboarding (3 steps)
          </button>
          <button className="cvq-btn cvq-btn--secondary" type="button" onClick={() => setPaywallOpen(true)}>
            Open soft paywall
          </button>
          <button className="cvq-btn cvq-btn--secondary" type="button" onClick={() => setTourOpen(true)}>
            Run first-run tour
          </button>
        </div>
      </Section>

      {obOpen && <OnboardingSheet onClose={() => setObOpen(false)} />}
      <PaywallSheet open={paywallOpen} onClose={() => setPaywallOpen(false)} />
      {tourOpen && <Tour name="Vansh Agarwal" onDone={() => setTourOpen(false)} />}

      {/* Sheets */}
      <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="Skill Library">
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          {SKILLS.map((s) => (
            <Card key={s.name} interactive>
              <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "16px", color: "var(--text)" }}>{s.name}</div>
              <div style={{ fontSize: "14px", color: "var(--text-2)", marginTop: 4 }}>{s.line}</div>
            </Card>
          ))}
        </div>
      </Sheet>

      <Sheet open={infoOpen} onClose={() => setInfoOpen(false)} title="Max Drawdown">
        <p style={{ fontSize: "15px", lineHeight: 1.6, color: "var(--text-2)", margin: 0 }}>
          Max drawdown is the worst drop from a peak to a later low — how much you
          would have been down at the scariest moment if you bought at the top. In
          Portfolio, this ⓘ opens the matching Academy lesson.
        </p>
      </Sheet>
    </div>
  );
}

function CardLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: "12px", letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-muted)" }}>
      {children}
    </div>
  );
}
