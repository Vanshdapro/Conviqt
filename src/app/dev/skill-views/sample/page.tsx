"use client";

// /dev/skill-views/sample — STATIC preview of the upgraded Skill Views.
//
// Renders the renderer against hand-built sample data (no AI/auth needed) so the
// new per-skill visuals + the shared forward-looking "What happens next" card +
// the entrance reveals can be eyeballed against the Almanac tokens. Throwaway —
// delete after review.

import { SkillViewRenderer } from "@/components/skillviews/SkillViewRenderer";
import type {
  SkillViewResponse,
  PriceAnchor,
  Forecast,
  WorthOwningView,
  CrowdCheckView,
  BullBearMapView,
} from "@/lib/skillViewTypes";

const AVGO: PriceAnchor = {
  ticker: "AVGO",
  companyName: null,
  price: 390.39,
  changePct: 3.63,
  week52High: 410.12,
  week52Low: 178.4,
  marketCap: 1.82e12,
  peRatio: 64.2,
  freshnessLabel: "delayed ~15 min",
  sourceUrl: null,
};

const forecast = (over: Partial<Forecast>): Forecast => ({
  setupImplies:
    "The AI-backlog story is intact, but the Q3 margin-mix guide means the next move hinges on execution, not the narrative. Expect a choppy, range-bound few weeks until guidance is de-risked.",
  likeliestPath:
    "Sideways-to-higher into the August print, then a directional break on the margin trajectory.",
  catalysts: [
    { when: "Late Aug 2026", event: "Q3 FY2026 earnings", soWhat: "First read on whether custom-accelerator margins are bottoming.", lean: "pivotal" },
    { when: "~Sep 2026", event: "Hyperscaler capex updates", soWhat: "Confirms or dents the $73B backlog narrative.", lean: "bullish" },
    { when: "Q4 2026", event: "Next-gen networking ramp", soWhat: "Mix shift back toward higher-margin silicon.", lean: "bullish" },
  ],
  watchLevel:
    "A reclaim of the 52-week high (~$410) confirms the breakout; losing ~$360 support breaks the read.",
  baseRate:
    "Premium-multiple names that miss on guidance but beat on revenue have historically chopped for a quarter before resolving with the fundamentals.",
  ...over,
});

const worthOwning: SkillViewResponse = {
  skillId: "worth-owning",
  disclaimer:
    "Conviqt is a research and education tool, not a licensed financial adviser. Nothing here is financial advice. Markets involve risk.",
  costUSD: 0.0021,
  anchors: [AVGO],
  view: {
    kind: "worth-owning",
    durabilityScore: 78,
    ownYearsVerdict:
      "A genuinely durable franchise — wide moats in networking and custom silicon — but you're paying a premium price for that quality today.",
    sureness: "High",
    pillars: [
      { name: "Moat", score: 88, note: "Entrenched in custom accelerators + networking; switching costs are real." },
      { name: "Balance sheet", score: 64, note: "Heavy debt from acquisitions, but strong free cash flow services it comfortably." },
      { name: "Growth runway", score: 84, note: "AI infrastructure demand underpins a multi-year backlog." },
      { name: "Management", score: 80, note: "Disciplined capital allocation; a credible long-term operator." },
      { name: "Valuation", score: 52, note: "64x forward earnings leaves little room for a stumble." },
    ],
    changeOurMind: "A sustained slowdown in hyperscaler AI capex would undercut the whole thesis.",
    forecast: forecast({}),
  } satisfies WorthOwningView,
};

const crowdCheck: SkillViewResponse = {
  skillId: "crowd-check",
  disclaimer: worthOwning.disclaimer,
  costUSD: 0.0014,
  anchors: [AVGO],
  view: {
    kind: "crowd-check",
    crowdMood: 38,
    dataStrength: 66,
    gapRead:
      "The crowd is cautiously greedy after the post-earnings dip, while the underlying data is meaningfully stronger — a gap that tends to close upward when fundamentals hold.",
    crowdSignals: [
      { label: "Retail chatter", read: "Cooled off after the guidance scare.", lean: "neutral" },
      { label: "Options positioning", read: "Skew still leans protective.", lean: "fear" },
      { label: "Momentum", read: "Bouncing off support, not euphoric.", lean: "neutral" },
    ],
    dataSignals: [
      { label: "Revenue trend", read: "Record quarter, AI segment up 143%.", lean: "strong" },
      { label: "Margins", read: "Near-term mix pressure flagged.", lean: "neutral" },
      { label: "Backlog", read: "$73B multi-year order book.", lean: "strong" },
    ],
    contrarianNote:
      "When sentiment lags strong-and-improving data, the historical edge has been with the data.",
    forecast: forecast({
      setupImplies:
        "Fear is doing the heavy lifting in the price, not the fundamentals — the kind of gap that has historically resolved toward the data if the next print cooperates.",
    }),
  } satisfies CrowdCheckView,
};

const bullBear: SkillViewResponse = {
  skillId: "bull-bear-map",
  disclaimer: worthOwning.disclaimer,
  costUSD: 0.0017,
  anchors: [AVGO],
  view: {
    kind: "bull-bear-map",
    axisLow: 300,
    axisHigh: 520,
    mapRead: "At $390 we sit just above the base-case territory — the market is pricing a good outcome, not a perfect one.",
    scenarios: [
      { band: "bear", priceTarget: 320, probability: 25, narrative: "Margin compression deepens and AI capex cools.", triggers: ["Weak Q3 margins", "Hyperscaler capex cut"] },
      { band: "base", priceTarget: 410, probability: 50, narrative: "Backlog executes, margins stabilize by year-end.", triggers: ["In-line Q3", "Steady capex"] },
      { band: "bull", priceTarget: 500, probability: 25, narrative: "Custom-silicon wins accelerate and mix improves fast.", triggers: ["New hyperscaler win", "Margin beat"] },
    ],
    forecast: forecast({
      setupImplies:
        "Risk/reward is roughly balanced from here: ~+28% to the bull case vs ~−18% to the bear, with the base case the most likely anchor.",
    }),
  } satisfies BullBearMapView,
};

const NVDA: PriceAnchor = { ...AVGO, ticker: "NVDA", price: 178.2, changePct: -1.1, week52High: 195.6, week52Low: 86.6, peRatio: 48.3 };
const D = worthOwning.disclaimer;

const quickTake: SkillViewResponse = {
  skillId: "quick-take", disclaimer: D, costUSD: 0.0008, anchors: [AVGO],
  view: { kind: "quick-take", stance: "Worth a look", oneLine: "Strong AI franchise on sale after a guidance scare, but the multiple leaves no room for error.", theGood: "Record AI revenue and a $73B multi-year backlog.", theRisk: "Premium 64x multiple plus near-term margin pressure.", theWatch: "The Q3 margin guide in late August.", sureness: "Medium", forecast: forecast({ setupImplies: "Likely range-bound until the August print clarifies the margin path." }) },
};
const entryExit: SkillViewResponse = {
  skillId: "entry-exit-zones", disclaimer: D, costUSD: 0.0012, anchors: [AVGO],
  view: { kind: "entry-exit-zones", accumulate: { low: 340, high: 365 }, fairValue: { low: 375, high: 405 }, trim: { low: 420, high: 450 }, supports: [360, 345], resistances: [410, 440], rationale: "Bands drawn around the real $390 price and the $178–$410 52-week range.", sureness: "Medium", forecast: forecast({ setupImplies: "The accumulate band lines up with prior support; a reclaim of $410 opens the trim zone." }) },
};
const faceOff: SkillViewResponse = {
  skillId: "face-off", disclaimer: D, costUSD: 0.0026, anchors: [AVGO, NVDA],
  view: { kind: "face-off", tickerA: "AVGO", tickerB: "NVDA", winner: "B", verdict: "NVDA edges it on raw growth and margins; AVGO wins on diversification and a cheaper relative multiple.", sureness: "Medium", rounds: [
    { dimension: "Growth", scoreA: 78, scoreB: 92, note: "NVDA's data-center growth still outruns." },
    { dimension: "Profitability", scoreA: 74, scoreB: 88, note: "NVDA's margins are best-in-class." },
    { dimension: "Valuation", scoreA: 64, scoreB: 55, note: "AVGO is cheaper relative to growth." },
    { dimension: "Momentum", scoreA: 60, scoreB: 70, note: "NVDA holds the stronger trend." },
    { dimension: "Balance sheet", scoreA: 62, scoreB: 80, note: "NVDA carries less debt." },
  ], forecast: forecast({ setupImplies: "Both ride the same AI wave; NVDA leads on quality, AVGO on value — the gap narrows if AVGO's margins stabilize." }) },
};
const sectorPulse: SkillViewResponse = {
  skillId: "sector-pulse", disclaimer: D, costUSD: 0.0014, anchors: [],
  view: { kind: "sector-pulse", sectorName: "AI chips", pulse: "Hot", pulseScore: 62, drivers: ["Hyperscaler capex", "Custom silicon", "Networking demand"], leaders: [{ ticker: "NVDA", label: "leading", heat: 80 }, { ticker: "AVGO", label: "strong", heat: 64 }], laggards: [{ ticker: "INTC", label: "lagging", heat: -40 }], rotationRead: "Money keeps rotating toward the AI-infrastructure winners and out of legacy chipmakers.", forecast: forecast({ setupImplies: "The group stays hot while capex holds; the risk is a single hyperscaler trimming spend." }) },
};
const headlineDecoder: SkillViewResponse = {
  skillId: "headline-decoder", disclaimer: D, costUSD: 0.0011, anchors: [],
  view: { kind: "headline-decoder", headline: "Major cloud provider doubles its custom-AI-chip order", plainSummary: "A big hyperscaler is sharply increasing orders for custom AI accelerators.", impacted: [{ ticker: "AVGO", direction: "up", magnitude: 80, why: "Leading custom-accelerator supplier." }, { ticker: "NVDA", direction: "down", magnitude: 40, why: "Custom chips chip away at GPU share." }, { ticker: "TSM", direction: "up", magnitude: 55, why: "Fabs the silicon either way." }], secondOrder: "More custom silicon pressures merchant-GPU pricing power over time.", timeHorizon: "This quarter", forecast: forecast({ setupImplies: "The shift toward custom accelerators is a multi-quarter tailwind for the suppliers, not a one-day pop." }) },
};
const starterPortfolio: SkillViewResponse = {
  skillId: "starter-portfolio", disclaimer: D, costUSD: 0.0016, anchors: [],
  view: { kind: "starter-portfolio", riskProfile: "Balanced", budgetUSD: 500, buckets: [{ bucket: "Broad US stocks", pct: 55, examples: ["A total-market ETF"], why: "The growth engine." }, { bucket: "International stocks", pct: 20, examples: ["A developed-markets ETF"], why: "Spreads country risk." }, { bucket: "Bonds", pct: 15, examples: ["A short-term bond ETF"], why: "Cushions the swings." }, { bucket: "Cash buffer", pct: 10, examples: ["High-yield savings"], why: "Dry powder + safety." }], expectedSwing: "In a bad year this mix could fall roughly 20–25%.", firstSteps: ["Open a brokerage account", "Set up an automatic monthly contribution"], forecast: forecast({ setupImplies: "A steady dollar-cost-averaging plan matters more than timing the first buy." }) },
};
const portfolioHealth: SkillViewResponse = {
  skillId: "portfolio-health-check", disclaimer: D, costUSD: 0.0022, anchors: [],
  view: { kind: "portfolio-health-check", healthScore: 61, vitals: [{ name: "Concentration", status: "alert", score: 38, note: "70% sits in two tech names." }, { name: "Diversification", status: "watch", score: 55, note: "Light on non-tech and bonds." }, { name: "Drawdown risk", status: "watch", score: 58, note: "High-beta tilt." }, { name: "Correlation", status: "good", score: 72, note: "Some offsetting positions." }], stressTests: [{ shock: "Tech sells off 20%", estImpactPct: -16, note: "Concentration bites here." }, { shock: "Rates jump 1%", estImpactPct: -6, note: "Growth names de-rate." }], fixes: ["Consider trimming the largest position", "Add a broad-market or bond holding for ballast"], forecast: forecast({ setupImplies: "The book is fine in a calm tape but fragile to a tech drawdown — the concentration is the thing to watch." }) },
};

const SAMPLES = [worthOwning, crowdCheck, bullBear, quickTake, entryExit, faceOff, sectorPulse, headlineDecoder, starterPortfolio, portfolioHealth];

export default function SkillViewsSamplePage() {
  return (
    <main style={{ background: "var(--bg-page)", minHeight: "100vh", padding: "var(--space-8) var(--space-6)", fontFamily: "var(--font-ui)" }}>
      <div style={{ maxWidth: 760, margin: "0 auto", display: "flex", flexDirection: "column", gap: "var(--space-8)" }}>
        <header>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: 30, color: "var(--text)", margin: "0 0 4px", letterSpacing: "-0.02em" }}>
            Skill Views — upgraded preview
          </h1>
          <p style={{ color: "var(--text-muted)", margin: 0, fontSize: 14 }}>
            Each skill keeps its own signature visual, now followed by a forward-looking “What happens next” card (dated catalysts + base-rate edge). Static sample data.
          </p>
        </header>
        {SAMPLES.map((s) => (
          <div key={s.skillId}>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--accent-hover)", marginBottom: "var(--space-3)" }}>{s.skillId}</div>
            <SkillViewRenderer data={s} />
          </div>
        ))}
      </div>
    </main>
  );
}
