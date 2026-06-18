// Specialized Skill-View output types.
//
// Each of the 10 Skill Library skills (src/lib/skills.ts) produces its OWN
// purpose-built output shape — NOT a generic verdict. The model fills these
// shapes via a forced tool call (src/lib/agents/skillViews.ts), and a
// deterministic, token-styled SVG renderer (src/components/skillviews/*) turns
// each shape into the skill's signature visual. The model emits compact JSON;
// the renderer draws the picture. That keeps cost lowest (one structured call,
// no web_search billing — grounded on the free marketdata layer) and quality
// highest (strict shape + real price anchors).
//
// Honesty rule (CLAUDE.md): precise market numbers (price, 52w high/low) come
// from the real quote/keyStats payload, never the model. Model fields are
// ANALYSIS (scores, scenarios, sentiment reads) — qualitative where a precise
// stat would otherwise be fabricated. No imperative trade language.

export type SkillViewId =
  | "worth-owning"
  | "quick-take"
  | "entry-exit-zones"
  | "face-off"
  | "sector-pulse"
  | "headline-decoder"
  | "crowd-check"
  | "bull-bear-map"
  | "starter-portfolio"
  | "portfolio-health-check";

// "How sure" maps to CLAUDE.md's High/Medium/Low (never a raw score in UI).
export type Sureness = "High" | "Medium" | "Low";

// ── Forward-looking layer (shared by every skill) ───────────────────────────
//
// This is the "predict the market" layer the founder asked for, kept brand-safe
// (CLAUDE.md): it is the analysts' RESEARCH read of what the setup implies and
// the dated events that could move it — framed as a forward view, never an
// imperative ("buy now") or a claim that we beat the market. Probabilistic and
// catalyst-driven, exactly like the Barebone reference. Rendered as a dated
// catalyst timeline + an "what the setup implies" callout under every skill.

// One dated, forward-looking event the analysts are watching.
export interface Catalyst {
  // Plain-English date or window, e.g. "Late Aug 2026", "Next earnings",
  // "~Q3 2026". NEVER a fabricated exact day unless it is a known event.
  when: string;
  // What the event is, in plain English.
  event: string;
  // Why it matters for this stock/theme — one line.
  soWhat: string;
  // Which way it would likely push things if it breaks one way.
  lean: "bullish" | "bearish" | "pivotal";
}

export interface Forecast {
  // The forward read: what the current setup IMPLIES for the period ahead.
  // Plain English, probabilistic, framed as the analysts' view. 1-3 sentences.
  setupImplies: string;
  // The single most likely path the analysts see from here, one line.
  likeliestPath: string;
  // 2-4 dated catalysts ahead (the Barebone-style timeline).
  catalysts: Catalyst[];
  // The one number, level, or event that would confirm OR break the read.
  watchLevel: string;
  // What history / base rates suggest about setups like this — the "edge"
  // that goes beyond what's already on the screen. One or two lines.
  baseRate: string;
}

// A real market anchor we pass to the model AND show in the chrome. Sourced
// from the free marketdata layer; null when no provider could answer.
export interface PriceAnchor {
  ticker: string;
  companyName: string | null;
  price: number | null;
  changePct: number | null;
  week52High: number | null;
  week52Low: number | null;
  marketCap: number | null;
  peRatio: number | null;
  freshnessLabel: string | null;
  sourceUrl: string | null;
}

// ── 1. Worth Owning? — durability scorecard ─────────────────────────────────
export interface WorthOwningPillar {
  name: "Moat" | "Balance sheet" | "Growth runway" | "Management" | "Valuation";
  score: number; // 0-100
  note: string; // one line, plain English
}
export interface WorthOwningView {
  kind: "worth-owning";
  durabilityScore: number; // 0-100, the headline dial
  ownYearsVerdict: string; // one sentence: would you want this for years?
  sureness: Sureness;
  pillars: WorthOwningPillar[]; // exactly the 5 above, in order
  changeOurMind: string; // what fact would flip the verdict
  forecast?: Forecast; // the forward read + dated catalysts
}

// ── 2. Quick Take — 30-second read ──────────────────────────────────────────
export interface QuickTakeView {
  kind: "quick-take";
  stance: "Worth a look" | "Wait and watch" | "Probably pass";
  oneLine: string; // the headline read
  theGood: string; // strongest point in its favour
  theRisk: string; // biggest thing that could go wrong
  theWatch: string; // the one number/event to watch next
  sureness: Sureness;
  forecast?: Forecast; // the forward read + dated catalysts
}

// ── 3. Entry & Exit Zones — price ladder ────────────────────────────────────
export interface PriceZone {
  low: number;
  high: number;
}
export interface EntryExitView {
  kind: "entry-exit-zones";
  accumulate: PriceZone; // where patient buyers tend to step in
  fairValue: PriceZone; // the "no edge either way" middle band
  trim: PriceZone; // where the easy money is gone
  supports: number[]; // price levels below
  resistances: number[]; // price levels above
  rationale: string; // how these levels were drawn (around real anchors)
  sureness: Sureness;
  forecast?: Forecast; // the forward read + dated catalysts
}

// ── 4. Face-Off — head-to-head ──────────────────────────────────────────────
export type FaceOffDimension =
  | "Growth"
  | "Profitability"
  | "Valuation"
  | "Momentum"
  | "Balance sheet";
export interface FaceOffRound {
  dimension: FaceOffDimension;
  scoreA: number; // 0-100
  scoreB: number; // 0-100
  note: string; // who edges it and why, one line
}
export interface FaceOffView {
  kind: "face-off";
  tickerA: string;
  tickerB: string;
  rounds: FaceOffRound[]; // the 5 dimensions
  winner: "A" | "B" | "Tie";
  verdict: string; // the call, framed as the analysts' view
  sureness: Sureness;
  forecast?: Forecast; // the forward read + dated catalysts
}

// ── 5. Sector Pulse — industry heat ─────────────────────────────────────────
export interface SectorMover {
  ticker: string;
  label: string; // company / one-word read
  heat: number; // -100 (cold) .. 100 (hot)
}
export interface SectorPulseView {
  kind: "sector-pulse";
  sectorName: string;
  pulse: "Hot" | "Warm" | "Cooling" | "Cold";
  pulseScore: number; // -100 .. 100 — drives the gauge
  drivers: string[]; // 2-4 themes moving the whole group
  leaders: SectorMover[]; // running ahead
  laggards: SectorMover[]; // falling behind
  rotationRead: string; // money rotating in or out, plain English
  forecast?: Forecast; // the forward read + dated catalysts
}

// ── 6. Headline Decoder — impact touch-map ──────────────────────────────────
export interface HeadlineImpact {
  ticker: string;
  direction: "up" | "down" | "mixed";
  magnitude: number; // 0-100 — how hard it's touched
  why: string; // one line
}
export interface HeadlineDecoderView {
  kind: "headline-decoder";
  headline: string; // echoed (cleaned)
  plainSummary: string; // what actually happened, jargon-free
  impacted: HeadlineImpact[]; // the stocks it touches
  secondOrder: string; // the knock-on nobody mentions
  timeHorizon: "Today" | "This week" | "This quarter" | "Long-term";
  forecast?: Forecast; // the forward read + dated catalysts
}

// ── 7. Crowd Check — crowd-vs-data twin gauge ───────────────────────────────
export interface CrowdSignal {
  label: string; // e.g. "Retail chatter", "Options activity"
  read: string; // qualitative — NEVER a fabricated precise stat
  lean: "fear" | "neutral" | "greed"; // for the crowd side
}
export interface DataSignal {
  label: string; // e.g. "Revenue trend", "Margins"
  read: string;
  lean: "weak" | "neutral" | "strong"; // for the fundamentals side
}
export interface CrowdCheckView {
  kind: "crowd-check";
  crowdMood: number; // -100 (fear) .. 100 (greed) — needle 1
  dataStrength: number; // -100 (weak) .. 100 (strong) — needle 2
  gapRead: string; // what the gap between the two needles means
  crowdSignals: CrowdSignal[];
  dataSignals: DataSignal[];
  contrarianNote: string; // when crowd and data disagree, who's usually right
  forecast?: Forecast; // the forward read + dated catalysts
}

// ── 8. Bull & Bear Map — scenario territory ─────────────────────────────────
export interface Scenario {
  band: "bear" | "base" | "bull";
  priceTarget: number; // the model's target for this case
  probability: number; // 0-100; the three should roughly sum to 100
  narrative: string; // the story of this world
  triggers: string[]; // what would push us into this territory
}
export interface BullBearMapView {
  kind: "bull-bear-map";
  scenarios: Scenario[]; // bear, base, bull (in that order)
  axisLow: number; // map's left edge (price)
  axisHigh: number; // map's right edge (price)
  mapRead: string; // where on the map we sit today, plain English
  forecast?: Forecast; // the forward read + dated catalysts
}

// ── 9. Starter Portfolio — allocation plan ──────────────────────────────────
export interface AllocationBucket {
  bucket: string; // e.g. "Broad US stocks", "Bonds", "Cash buffer"
  pct: number; // 0-100; buckets sum to 100
  examples: string[]; // plain examples (ETFs/types), not hot tips
  why: string; // one line
}
export interface StarterPortfolioView {
  kind: "starter-portfolio";
  riskProfile: "Cautious" | "Balanced" | "Adventurous";
  budgetUSD: number; // echoed from input
  buckets: AllocationBucket[];
  expectedSwing: string; // honest "in a bad year this could drop ~X%"
  firstSteps: string[]; // 2-3 concrete next actions
  forecast?: Forecast; // the forward read + dated catalysts
}

// ── 10. Portfolio Health Check — vitals + stress test ───────────────────────
export interface HealthVital {
  name: "Concentration" | "Diversification" | "Drawdown risk" | "Correlation";
  status: "good" | "watch" | "alert";
  score: number; // 0-100 (higher = healthier)
  note: string;
}
export interface StressScenario {
  shock: string; // e.g. "Tech sells off 20%", "Rates jump 1%"
  estImpactPct: number; // negative = portfolio falls
  note: string;
}
export interface PortfolioHealthView {
  kind: "portfolio-health-check";
  healthScore: number; // 0-100 headline dial
  vitals: HealthVital[];
  stressTests: StressScenario[];
  fixes: string[]; // plain, non-imperative suggestions to consider
  forecast?: Forecast; // the forward read + dated catalysts
}

export type SkillView =
  | WorthOwningView
  | QuickTakeView
  | EntryExitView
  | FaceOffView
  | SectorPulseView
  | HeadlineDecoderView
  | CrowdCheckView
  | BullBearMapView
  | StarterPortfolioView
  | PortfolioHealthView;

// What /api/skill-view returns.
export interface SkillViewResponse {
  skillId: SkillViewId;
  view: SkillView;
  anchors: PriceAnchor[]; // real market chrome the renderer shows alongside
  disclaimer: string;
  costUSD: number;
  cached?: boolean;
}
