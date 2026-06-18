"use client";

// Specialized Skill-View renderers — one signature visual per skill.
//
// Every skill's output is drawn its OWN way: Worth Owning is a durability dial
// + pillar scorecard; Crowd Check is a twin-needle fear/greed-vs-data gauge;
// Bull & Bear Map is an actual price-territory map; Entry & Exit is a price
// ladder; Face-Off is a head-to-head tug-of-war; Headline Decoder is an impact
// touch-map; etc. Token-only colours (CLAUDE.md): blue/coral mean direction or
// gain/loss, teal is the only decorative accent.

import type {
  SkillViewResponse,
  PriceAnchor,
  WorthOwningView,
  QuickTakeView,
  EntryExitView,
  FaceOffView,
  SectorPulseView,
  HeadlineDecoderView,
  CrowdCheckView,
  BullBearMapView,
  StarterPortfolioView,
  PortfolioHealthView,
} from "@/lib/skillViewTypes";
import {
  VizCard,
  SectionLabel,
  Pill,
  SurenessPill,
  DirArrow,
  Gauge,
  ScoreBar,
  Callout,
  money,
  Reveal,
  ForecastSection,
} from "./primitives";
import type { Forecast } from "@/lib/skillViewTypes";

// ── Shared market chrome (real anchors) ──────────────────────────────────────

function AnchorChip({ a }: { a: PriceAnchor }) {
  const up = (a.changePct ?? 0) >= 0;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "var(--bg-sunken)", border: "1px solid var(--border)", borderRadius: "var(--radius-pill)", padding: "4px 12px", fontSize: 13 }}>
      <strong style={{ color: "var(--text)" }}>{a.ticker}</strong>
      <span style={{ color: "var(--text-2)", fontVariantNumeric: "tabular-nums" }}>{money(a.price)}</span>
      {a.changePct !== null && (
        <span style={{ color: up ? "var(--up-ink)" : "var(--down-ink)", fontWeight: 600 }}>
          {up ? "▲" : "▼"} {Math.abs(a.changePct).toFixed(2)}%
        </span>
      )}
    </span>
  );
}

function AnchorRow({ anchors }: { anchors: PriceAnchor[] }) {
  if (!anchors.length) return null;
  const fresh = anchors.find((a) => a.freshnessLabel)?.freshnessLabel;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: "var(--space-4)" }}>
      {anchors.map((a) => (
        <AnchorChip key={a.ticker} a={a} />
      ))}
      {fresh && <span style={{ fontSize: 11, color: "var(--text-muted)" }}>· {fresh}</span>}
    </div>
  );
}

// ── 1. Worth Owning? — durability dial + pillar scorecard ────────────────────

function WorthOwning({ v }: { v: WorthOwningView }) {
  return (
    <VizCard title="Worth Owning?" hint="Is this a company you'd want for years?">
      <div style={{ display: "flex", gap: "var(--space-6)", flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ width: 220, flexShrink: 0 }}>
          <Gauge
            needles={[{ value: v.durabilityScore, color: "var(--accent)", label: "durability" }]}
            centerLabel={`${Math.round(v.durabilityScore)}`}
            centerSub="durability"
            leftLabel="Fragile"
            rightLabel="Built to last"
            width={220}
          />
        </div>
        <div style={{ flex: 1, minWidth: 240 }}>
          <p style={{ fontSize: 16, color: "var(--text)", lineHeight: 1.5, margin: "0 0 var(--space-3)" }}>{v.ownYearsVerdict}</p>
          <SurenessPill value={v.sureness} />
        </div>
      </div>
      <SectionLabel>The five pillars</SectionLabel>
      {v.pillars.map((p) => (
        <ScoreBar key={p.name} label={p.name} score={p.score} note={p.note} tone="accent" />
      ))}
      <Callout label="What would change our mind">{v.changeOurMind}</Callout>
    </VizCard>
  );
}

// ── 2. Quick Take — stance + three crisp lines ───────────────────────────────

function QuickTake({ v }: { v: QuickTakeView }) {
  const stanceTone = v.stance === "Worth a look" ? "up" : v.stance === "Probably pass" ? "down" : "neutral";
  const rows: Array<{ label: string; text: string; mark: string; color: string }> = [
    { label: "The good", text: v.theGood, mark: "+", color: "var(--up-ink)" },
    { label: "The risk", text: v.theRisk, mark: "!", color: "var(--down-ink)" },
    { label: "The watch", text: v.theWatch, mark: "◷", color: "var(--accent-hover)" },
  ];
  return (
    <VizCard title="Quick Take" hint="The 30-second read on any ticker">
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: "var(--space-4)" }}>
        <Pill tone={stanceTone as "up" | "down" | "neutral"}>{v.stance}</Pill>
        <SurenessPill value={v.sureness} />
      </div>
      <p style={{ fontFamily: "var(--font-display)", fontSize: 20, color: "var(--text)", lineHeight: 1.4, margin: "0 0 var(--space-5)", letterSpacing: "-0.01em" }}>{v.oneLine}</p>
      {rows.map((r) => (
        <div key={r.label} style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "var(--space-3) 0", borderTop: "1px solid var(--border)" }}>
          <span style={{ width: 22, height: 22, borderRadius: "var(--radius-pill)", background: "var(--bg-sunken)", color: r.color, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, flexShrink: 0 }}>{r.mark}</span>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-muted)" }}>{r.label}</div>
            <div style={{ fontSize: 14, color: "var(--text-2)", lineHeight: 1.5 }}>{r.text}</div>
          </div>
        </div>
      ))}
    </VizCard>
  );
}

// ── 3. Entry & Exit Zones — vertical price ladder ────────────────────────────

function EntryExit({ v, anchors }: { v: EntryExitView; anchors: PriceAnchor[] }) {
  const price = anchors[0]?.price ?? null;
  const all = [
    v.accumulate.low, v.accumulate.high, v.fairValue.low, v.fairValue.high,
    v.trim.low, v.trim.high, ...v.supports, ...v.resistances,
    ...(price !== null ? [price] : []),
  ].filter((n) => Number.isFinite(n));
  const lo = Math.min(...all);
  const hi = Math.max(...all);
  const span = hi - lo || 1;
  const H = 320;
  const pad = 24;
  const y = (p: number) => pad + (1 - (p - lo) / span) * (H - 2 * pad);
  const band = (z: { low: number; high: number }) => ({ top: y(z.high), height: Math.max(2, y(z.low) - y(z.high)) });
  const acc = band(v.accumulate);
  const fair = band(v.fairValue);
  const trim = band(v.trim);

  return (
    <VizCard title="Entry & Exit Zones" hint="Where the smart levels sit">
      <div style={{ display: "flex", gap: "var(--space-6)", flexWrap: "wrap" }}>
        <svg viewBox={`0 0 320 ${H}`} width={320} style={{ maxWidth: "100%" }} role="img" aria-label="price ladder">
          {/* zone bands */}
          <rect x={70} y={trim.top} width={180} height={trim.height} fill="color-mix(in srgb, var(--border-strong) 35%, var(--bg-sunken))" rx={6} />
          <rect x={70} y={fair.top} width={180} height={fair.height} fill="var(--bg-sunken)" rx={6} />
          <rect x={70} y={acc.top} width={180} height={acc.height} fill="var(--accent-weak)" rx={6} />
          {/* zone labels */}
          <text x={160} y={trim.top + 16} textAnchor="middle" fontSize={12} fontWeight={600} fill="var(--text-2)">Trim ${v.trim.low.toFixed(0)}–${v.trim.high.toFixed(0)}</text>
          <text x={160} y={fair.top + fair.height / 2 + 4} textAnchor="middle" fontSize={12} fontWeight={600} fill="var(--text-muted)">Fair value</text>
          <text x={160} y={acc.top + acc.height - 8} textAnchor="middle" fontSize={12} fontWeight={600} fill="var(--accent-hover)">Accumulate ${v.accumulate.low.toFixed(0)}–${v.accumulate.high.toFixed(0)}</text>
          {/* supports (left) / resistances (right) */}
          {v.supports.map((s, i) => (
            <g key={`s${i}`}>
              <line x1={56} y1={y(s)} x2={70} y2={y(s)} stroke="var(--text-muted)" strokeWidth={1.5} />
              <text x={52} y={y(s) + 4} textAnchor="end" fontSize={11} fill="var(--text-muted)" style={{ fontVariantNumeric: "tabular-nums" }}>{s.toFixed(0)}</text>
            </g>
          ))}
          {v.resistances.map((s, i) => (
            <g key={`r${i}`}>
              <line x1={250} y1={y(s)} x2={264} y2={y(s)} stroke="var(--text-muted)" strokeWidth={1.5} />
              <text x={268} y={y(s) + 4} textAnchor="start" fontSize={11} fill="var(--text-muted)" style={{ fontVariantNumeric: "tabular-nums" }}>{s.toFixed(0)}</text>
            </g>
          ))}
          {/* current price marker */}
          {price !== null && (
            <g>
              <line x1={70} y1={y(price)} x2={250} y2={y(price)} stroke="var(--espresso)" strokeWidth={2} strokeDasharray="4 3" />
              <circle cx={70} cy={y(price)} r={4} fill="var(--espresso)" />
              <text x={160} y={y(price) - 6} textAnchor="middle" fontSize={11} fontWeight={700} fill="var(--espresso)">Now {money(price)}</text>
            </g>
          )}
        </svg>
        <div style={{ flex: 1, minWidth: 220 }}>
          <Callout label="How these levels were drawn">{v.rationale}</Callout>
          <div style={{ marginTop: "var(--space-3)" }}>
            <SurenessPill value={v.sureness} />
          </div>
        </div>
      </div>
    </VizCard>
  );
}

// ── 4. Face-Off — head-to-head tug-of-war ────────────────────────────────────

function FaceOff({ v }: { v: FaceOffView }) {
  const winA = v.winner === "A";
  const winB = v.winner === "B";
  return (
    <VizCard title="Face-Off" hint="Two stocks enter. One wins.">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-5)" }}>
        <div style={{ textAlign: "left" }}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 24, color: "var(--text)" }}>{v.tickerA}</div>
          {winA && <Pill tone="accent">Winner</Pill>}
        </div>
        <span style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 600 }}>VS</span>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 24, color: "var(--text)" }}>{v.tickerB}</div>
          {winB && <Pill tone="accent">Winner</Pill>}
        </div>
      </div>
      {v.rounds.map((r) => {
        const total = r.scoreA + r.scoreB || 1;
        const aPct = (r.scoreA / total) * 100;
        const aEdge = r.scoreA >= r.scoreB;
        return (
          <div key={r.dimension} style={{ marginBottom: "var(--space-4)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
              <span style={{ color: "var(--text-2)", fontVariantNumeric: "tabular-nums", fontWeight: aEdge ? 700 : 400 }}>{Math.round(r.scoreA)}</span>
              <span style={{ fontWeight: 600, color: "var(--text)" }}>{r.dimension}</span>
              <span style={{ color: "var(--text-2)", fontVariantNumeric: "tabular-nums", fontWeight: !aEdge ? 700 : 400 }}>{Math.round(r.scoreB)}</span>
            </div>
            <div style={{ display: "flex", height: 10, borderRadius: "var(--radius-pill)", overflow: "hidden", background: "var(--bg-sunken)" }}>
              <div style={{ width: `${aPct}%`, background: "var(--accent)", transition: "width 320ms var(--ease-out)" }} />
              <div style={{ width: "1px", background: "var(--bg-surface)" }} />
              <div style={{ flex: 1, background: "var(--espresso)" }} />
            </div>
            <p style={{ margin: "4px 0 0", fontSize: 12.5, color: "var(--text-muted)" }}>{r.note}</p>
          </div>
        );
      })}
      <Callout label="The analysts' view">{v.verdict}</Callout>
      <div style={{ marginTop: "var(--space-3)" }}>
        <SurenessPill value={v.sureness} />
      </div>
    </VizCard>
  );
}

// ── 5. Sector Pulse — heat gauge + leaders/laggards ──────────────────────────

function HeatStrip({ ticker, label, heat }: { ticker: string; label: string; heat: number }) {
  const up = heat >= 0;
  const pct = Math.min(100, Math.abs(heat));
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
      <span style={{ width: 56, fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{ticker}</span>
      <div style={{ flex: 1, height: 8, background: "var(--bg-sunken)", borderRadius: "var(--radius-pill)", overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: up ? "var(--up)" : "var(--down)" }} />
      </div>
      <span style={{ fontSize: 12, color: "var(--text-muted)", width: 70, textAlign: "right" }}>{label}</span>
    </div>
  );
}

function SectorPulse({ v }: { v: SectorPulseView }) {
  return (
    <VizCard title="Sector Pulse" hint={`What's moving ${v.sectorName}`}>
      <div style={{ display: "flex", gap: "var(--space-6)", flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ width: 220, flexShrink: 0 }}>
          <Gauge needles={[{ value: v.pulseScore, color: "var(--accent)", label: "pulse" }]} min={-100} max={100} centerLabel={v.pulse} leftLabel="Cold" rightLabel="Hot" width={220} />
        </div>
        <div style={{ flex: 1, minWidth: 220 }}>
          <SectionLabel>What's driving it</SectionLabel>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {v.drivers.map((d, i) => (
              <Pill key={i} tone="neutral">{d}</Pill>
            ))}
          </div>
        </div>
      </div>
      <SectionLabel>Running ahead</SectionLabel>
      {v.leaders.map((m) => (
        <HeatStrip key={m.ticker} {...m} />
      ))}
      <SectionLabel>Falling behind</SectionLabel>
      {v.laggards.map((m) => (
        <HeatStrip key={m.ticker} {...m} />
      ))}
      <Callout label="Where the money's rotating">{v.rotationRead}</Callout>
    </VizCard>
  );
}

// ── 6. Headline Decoder — impact touch-map ───────────────────────────────────

function HeadlineDecoder({ v }: { v: HeadlineDecoderView }) {
  const W = 360, Hh = 300, cx = W / 2, cy = Hh / 2, R = 110;
  const nodes = v.impacted.slice(0, 6);
  return (
    <VizCard title="Headline Decoder" hint="Which stocks it touches — and how">
      <p style={{ fontSize: 14, color: "var(--text-2)", lineHeight: 1.5, margin: "0 0 var(--space-3)", fontStyle: "italic" }}>“{v.headline}”</p>
      <p style={{ fontSize: 15, color: "var(--text)", lineHeight: 1.5, margin: "0 0 var(--space-4)" }}>{v.plainSummary}</p>
      <svg viewBox={`0 0 ${W} ${Hh}`} width="100%" role="img" aria-label="impact map">
        {nodes.map((n, i) => {
          const a = (i / nodes.length) * 2 * Math.PI - Math.PI / 2;
          const nx = cx + R * Math.cos(a);
          const ny = cy + R * Math.sin(a);
          const stroke = n.direction === "up" ? "var(--up)" : n.direction === "down" ? "var(--down)" : "var(--border-strong)";
          const rad = 18 + (n.magnitude / 100) * 16;
          return (
            <g key={n.ticker}>
              <line x1={cx} y1={cy} x2={nx} y2={ny} stroke={stroke} strokeWidth={1 + (n.magnitude / 100) * 3} opacity={0.6} />
              <circle cx={nx} cy={ny} r={rad} fill="var(--bg-surface)" stroke={stroke} strokeWidth={2} />
              <text x={nx} y={ny - 1} textAnchor="middle" fontSize={11} fontWeight={700} fill="var(--text)">{n.ticker}</text>
              <text x={nx} y={ny + 12} textAnchor="middle" fontSize={11} fill={n.direction === "up" ? "var(--up-ink)" : n.direction === "down" ? "var(--down-ink)" : "var(--text-muted)"}>
                {n.direction === "up" ? "▲" : n.direction === "down" ? "▼" : "◆"}
              </text>
            </g>
          );
        })}
        <circle cx={cx} cy={cy} r={34} fill="var(--espresso)" />
        <text x={cx} y={cy - 2} textAnchor="middle" fontSize={11} fontWeight={700} fill="var(--on-accent)">NEWS</text>
        <text x={cx} y={cy + 12} textAnchor="middle" fontSize={9} fill="var(--on-accent)">impact</text>
      </svg>
      <SectionLabel>How each is touched</SectionLabel>
      {v.impacted.map((n) => (
        <div key={n.ticker} style={{ display: "flex", gap: 10, alignItems: "baseline", padding: "6px 0", borderTop: "1px solid var(--border)" }}>
          <span style={{ fontWeight: 700, color: "var(--text)", width: 56 }}>{n.ticker}</span>
          <DirArrow dir={n.direction} />
          <span style={{ fontSize: 13.5, color: "var(--text-2)" }}>{n.why}</span>
        </div>
      ))}
      <Callout label="The knock-on most people miss">{v.secondOrder}</Callout>
      <div style={{ marginTop: "var(--space-3)" }}>
        <Pill tone="accent">Matters most: {v.timeHorizon}</Pill>
      </div>
    </VizCard>
  );
}

// ── 7. Crowd Check — twin-needle fear/greed vs data ──────────────────────────

function CrowdCheck({ v }: { v: CrowdCheckView }) {
  return (
    <VizCard title="Crowd Check" hint="What investors are feeling vs the data">
      <Gauge
        needles={[
          { value: v.crowdMood, color: "var(--text-2)", label: "crowd" },
          { value: v.dataStrength, color: "var(--accent)", label: "data" },
        ]}
        min={-100}
        max={100}
        leftLabel="Fear / Weak"
        rightLabel="Greed / Strong"
        width={300}
      />
      <div style={{ display: "flex", gap: 16, justifyContent: "center", marginTop: -8, marginBottom: "var(--space-4)" }}>
        <span style={{ fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: "var(--text-2)" }} /> The crowd</span>
        <span style={{ fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: "var(--accent)" }} /> The data</span>
      </div>
      <Callout label="What the gap means">{v.gapRead}</Callout>
      <div style={{ display: "flex", gap: "var(--space-5)", flexWrap: "wrap", marginTop: "var(--space-4)" }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <SectionLabel>What the crowd feels</SectionLabel>
          {v.crowdSignals.map((s, i) => (
            <div key={i} style={{ marginBottom: "var(--space-2)" }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text)" }}>{s.label}</span>
                <Pill tone={s.lean === "greed" ? "up" : s.lean === "fear" ? "down" : "neutral"}>{s.lean}</Pill>
              </div>
              <p style={{ margin: "2px 0 0", fontSize: 13, color: "var(--text-muted)" }}>{s.read}</p>
            </div>
          ))}
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <SectionLabel>What the data says</SectionLabel>
          {v.dataSignals.map((s, i) => (
            <div key={i} style={{ marginBottom: "var(--space-2)" }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text)" }}>{s.label}</span>
                <Pill tone={s.lean === "strong" ? "up" : s.lean === "weak" ? "down" : "neutral"}>{s.lean}</Pill>
              </div>
              <p style={{ margin: "2px 0 0", fontSize: 13, color: "var(--text-muted)" }}>{s.read}</p>
            </div>
          ))}
        </div>
      </div>
      <Callout label="When they disagree">{v.contrarianNote}</Callout>
    </VizCard>
  );
}

// ── 8. Bull & Bear Map — price territory ─────────────────────────────────────

function BullBearMap({ v, anchors }: { v: BullBearMapView; anchors: PriceAnchor[] }) {
  const price = anchors[0]?.price ?? null;
  const lo = v.axisLow;
  const hi = v.axisHigh;
  const span = hi - lo || 1;
  const W = 520, Hm = 130, pad = 36;
  const x = (p: number) => pad + ((p - lo) / span) * (W - 2 * pad);
  const bear = v.scenarios.find((s) => s.band === "bear");
  const base = v.scenarios.find((s) => s.band === "base");
  const bull = v.scenarios.find((s) => s.band === "bull");
  const fillFor = (b: string) => (b === "bear" ? "var(--down-weak)" : b === "bull" ? "var(--up-weak)" : "var(--bg-sunken)");
  const inkFor = (b: string) => (b === "bear" ? "var(--down-ink)" : b === "bull" ? "var(--up-ink)" : "var(--text-2)");
  // segment boundaries: midpoints between scenario targets
  const tBear = bear?.priceTarget ?? lo;
  const tBase = base?.priceTarget ?? (lo + hi) / 2;
  const tBull = bull?.priceTarget ?? hi;
  const b1 = (tBear + tBase) / 2;
  const b2 = (tBase + tBull) / 2;

  return (
    <VizCard title="Bull & Bear Map" hint="Best case, worst case, base case">
      <svg viewBox={`0 0 ${W} ${Hm}`} width="100%" role="img" aria-label="scenario territory map">
        {/* territories */}
        <rect x={pad} y={30} width={x(b1) - pad} height={48} fill={fillFor("bear")} rx={6} />
        <rect x={x(b1)} y={30} width={x(b2) - x(b1)} height={48} fill={fillFor("base")} />
        <rect x={x(b2)} y={30} width={W - pad - x(b2)} height={48} fill={fillFor("bull")} rx={6} />
        {/* labels */}
        {[bear, base, bull].map((s) =>
          s ? (
            <g key={s.band}>
              <text x={x(s.priceTarget)} y={22} textAnchor="middle" fontSize={11} fontWeight={700} fill={inkFor(s.band)} style={{ textTransform: "uppercase", letterSpacing: "0.06em" }}>{s.band}</text>
              <text x={x(s.priceTarget)} y={58} textAnchor="middle" fontSize={14} fontWeight={700} fill="var(--text)">{money(s.priceTarget)}</text>
              <text x={x(s.priceTarget)} y={72} textAnchor="middle" fontSize={11} fill={inkFor(s.band)}>{Math.round(s.probability)}% odds</text>
            </g>
          ) : null
        )}
        {/* axis */}
        <line x1={pad} y1={92} x2={W - pad} y2={92} stroke="var(--border-strong)" strokeWidth={1.5} />
        <text x={pad} y={108} textAnchor="middle" fontSize={11} fill="var(--text-muted)">{money(lo)}</text>
        <text x={W - pad} y={108} textAnchor="middle" fontSize={11} fill="var(--text-muted)">{money(hi)}</text>
        {/* you-are-here pin */}
        {price !== null && (
          <g>
            <line x1={x(price)} y1={30} x2={x(price)} y2={100} stroke="var(--espresso)" strokeWidth={2} />
            <circle cx={x(price)} cy={100} r={4} fill="var(--espresso)" />
            <text x={x(price)} y={124} textAnchor="middle" fontSize={11} fontWeight={700} fill="var(--espresso)">Now {money(price)}</text>
          </g>
        )}
      </svg>
      <SectionLabel>The three worlds</SectionLabel>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "var(--space-3)" }}>
        {v.scenarios.map((s) => (
          <div key={s.band} style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-control)", padding: "var(--space-3)", background: "var(--bg-surface)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <Pill tone={s.band === "bull" ? "up" : s.band === "bear" ? "down" : "neutral"}>{s.band}</Pill>
              <span style={{ fontWeight: 700, color: "var(--text)" }}>{money(s.priceTarget)}</span>
            </div>
            <p style={{ fontSize: 13, color: "var(--text-2)", lineHeight: 1.45, margin: "0 0 6px" }}>{s.narrative}</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {s.triggers.map((t, i) => (
                <span key={i} style={{ fontSize: 11, color: "var(--text-muted)", background: "var(--bg-sunken)", borderRadius: "var(--radius-pill)", padding: "2px 8px" }}>⚑ {t}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
      <Callout label="Where we sit today">{v.mapRead}</Callout>
    </VizCard>
  );
}

// ── 9. Starter Portfolio — allocation plan ───────────────────────────────────

const BUCKET_TONES = ["var(--accent)", "var(--espresso)", "var(--accent-hover)", "var(--border-strong)", "var(--text-muted)", "var(--text-2)"];

function StarterPortfolio({ v }: { v: StarterPortfolioView }) {
  return (
    <VizCard title="Starter Portfolio" hint="From budget + goals to an actual plan">
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: "var(--space-4)", flexWrap: "wrap" }}>
        <Pill tone="accent">{v.riskProfile}</Pill>
        <span style={{ fontFamily: "var(--font-display)", fontSize: 22, color: "var(--text)" }}>{money(v.budgetUSD)}</span>
        <span style={{ fontSize: 13, color: "var(--text-muted)" }}>to put to work</span>
      </div>
      {/* stacked allocation bar */}
      <div style={{ display: "flex", height: 28, borderRadius: "var(--radius-pill)", overflow: "hidden", marginBottom: "var(--space-4)" }}>
        {v.buckets.map((b, i) => (
          <div key={i} title={`${b.bucket} ${b.pct}%`} style={{ width: `${b.pct}%`, background: BUCKET_TONES[i % BUCKET_TONES.length] }} />
        ))}
      </div>
      {v.buckets.map((b, i) => (
        <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "var(--space-3) 0", borderTop: "1px solid var(--border)" }}>
          <span style={{ width: 12, height: 12, borderRadius: 3, background: BUCKET_TONES[i % BUCKET_TONES.length], marginTop: 4, flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap" }}>
              <span style={{ fontSize: 14.5, fontWeight: 600, color: "var(--text)" }}>{b.bucket}</span>
              <span style={{ fontSize: 14, color: "var(--text-2)", fontVariantNumeric: "tabular-nums" }}>{b.pct}% · {money((v.budgetUSD * b.pct) / 100)}</span>
            </div>
            <p style={{ margin: "2px 0 4px", fontSize: 13, color: "var(--text-muted)" }}>{b.why}</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {b.examples.map((e, j) => (
                <span key={j} style={{ fontSize: 11, color: "var(--text-2)", background: "var(--bg-sunken)", borderRadius: "var(--radius-pill)", padding: "2px 8px" }}>{e}</span>
              ))}
            </div>
          </div>
        </div>
      ))}
      <Callout label="In a bad year">{v.expectedSwing}</Callout>
      <SectionLabel>First steps</SectionLabel>
      <ol style={{ margin: 0, paddingLeft: 18, color: "var(--text-2)", fontSize: 14, lineHeight: 1.6 }}>
        {v.firstSteps.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ol>
    </VizCard>
  );
}

// ── 10. Portfolio Health Check — vitals + stress test ────────────────────────

function PortfolioHealth({ v }: { v: PortfolioHealthView }) {
  const statusTone = (s: "good" | "watch" | "alert") => (s === "good" ? "accent" : s === "alert" ? "down" : "up") as "accent" | "down" | "up";
  return (
    <VizCard title="Portfolio Health Check" hint="Stress-test what you own">
      <div style={{ display: "flex", gap: "var(--space-6)", flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ width: 200, flexShrink: 0 }}>
          <Gauge needles={[{ value: v.healthScore, color: "var(--accent)", label: "health" }]} centerLabel={`${Math.round(v.healthScore)}`} centerSub="health" leftLabel="Fragile" rightLabel="Resilient" width={200} />
        </div>
        <div style={{ flex: 1, minWidth: 220 }}>
          <SectionLabel>Vitals</SectionLabel>
          {v.vitals.map((vt) => (
            <ScoreBar key={vt.name} label={`${vt.name} · ${vt.status}`} score={vt.score} note={vt.note} tone={vt.status === "alert" ? "down" : "accent"} />
          ))}
        </div>
      </div>
      <SectionLabel>If the market moves against you</SectionLabel>
      {v.stressTests.map((s, i) => {
        const down = s.estImpactPct < 0;
        const mag = Math.min(100, Math.abs(s.estImpactPct) * 2.5);
        return (
          <div key={i} style={{ marginBottom: "var(--space-3)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5, marginBottom: 4 }}>
              <span style={{ color: "var(--text)", fontWeight: 600 }}>{s.shock}</span>
              <span style={{ color: down ? "var(--down-ink)" : "var(--up-ink)", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{down ? "▼" : "▲"} {Math.abs(s.estImpactPct).toFixed(1)}%</span>
            </div>
            <div style={{ height: 8, background: "var(--bg-sunken)", borderRadius: "var(--radius-pill)", overflow: "hidden" }}>
              <div style={{ width: `${mag}%`, height: "100%", background: down ? "var(--down)" : "var(--up)" }} />
            </div>
            <p style={{ margin: "3px 0 0", fontSize: 12.5, color: "var(--text-muted)" }}>{s.note}</p>
          </div>
        );
      })}
      <SectionLabel>Worth considering</SectionLabel>
      <ul style={{ margin: 0, paddingLeft: 18, color: "var(--text-2)", fontSize: 14, lineHeight: 1.6 }}>
        {v.fixes.map((f, i) => (
          <li key={i}>{f}</li>
        ))}
      </ul>
      {/* statusTone kept for future per-vital chips */}
      <span hidden>{statusTone("good")}</span>
    </VizCard>
  );
}

// ── Dispatcher ───────────────────────────────────────────────────────────────

export function SkillViewRenderer({ data }: { data: SkillViewResponse }) {
  const { view, anchors } = data;
  let body: React.ReactNode;
  switch (view.kind) {
    case "worth-owning":
      body = <WorthOwning v={view} />;
      break;
    case "quick-take":
      body = <QuickTake v={view} />;
      break;
    case "entry-exit-zones":
      body = <EntryExit v={view} anchors={anchors} />;
      break;
    case "face-off":
      body = <FaceOff v={view} />;
      break;
    case "sector-pulse":
      body = <SectorPulse v={view} />;
      break;
    case "headline-decoder":
      body = <HeadlineDecoder v={view} />;
      break;
    case "crowd-check":
      body = <CrowdCheck v={view} />;
      break;
    case "bull-bear-map":
      body = <BullBearMap v={view} anchors={anchors} />;
      break;
    case "starter-portfolio":
      body = <StarterPortfolio v={view} />;
      break;
    case "portfolio-health-check":
      body = <PortfolioHealth v={view} />;
      break;
    default:
      body = null;
  }
  // The forward-looking layer lives on every view shape; render it once, here,
  // so each skill's signature visual is always followed by the prediction block.
  const forecast = (view as { forecast?: Forecast }).forecast;

  return (
    <div>
      <AnchorRow anchors={anchors} />
      <Reveal>{body}</Reveal>
      <ForecastSection forecast={forecast} />
      <p style={{ marginTop: "var(--space-4)", fontSize: 11.5, color: "var(--text-muted)", lineHeight: 1.5 }}>{data.disclaimer}</p>
    </div>
  );
}
