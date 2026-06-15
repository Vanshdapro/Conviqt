// Specialized Skill-View engine.
//
// One forced-tool OpenAI call per skill → the skill's own structured shape
// (src/lib/skillViewTypes.ts). Routed through the single AI chokepoint
// (getOpenAI().messages) so the OpenAI Responses path + cost tracking apply
// exactly as every other agent. NO web_search tool is attached, so every call
// stays on OpenAI (per openai.ts routing) and costs only tokens — grounding
// comes from the free marketdata layer, not paid search.
//
// Each skill gets: a tailored tool (input_schema = its output shape), a tight
// system prompt in Conviqt's plain-English beginner voice, a model (mini for
// most; flagship only for the two deep comparative reads), and a max_tokens
// budget. Add a skill = add one entry to SKILL_SPECS + its type.

import { getOpenAI, MODELS, estimateCallCostUSD } from "../openai";
import { quote, keyStats } from "../marketdata";
import type {
  PriceAnchor,
  SkillView,
  SkillViewId,
} from "../skillViewTypes";

// ─── Grounding: real market anchors (free feeds, never the model) ────────────

export async function buildAnchor(ticker: string): Promise<PriceAnchor> {
  const t = ticker.trim().toUpperCase();
  const [q, s] = await Promise.all([quote(t), keyStats(t)]);
  return {
    ticker: t,
    companyName: null, // marketdata layer carries no name; kept null (honest)
    price: q?.price ?? null,
    changePct: q?.changePct ?? null,
    week52High: s?.week52High ?? null,
    week52Low: s?.week52Low ?? null,
    marketCap: s?.marketCap ?? null,
    peRatio: s?.peRatio ?? null,
    freshnessLabel: q?.freshnessLabel ?? s?.freshnessLabel ?? null,
    sourceUrl: q?.sourceUrl ?? s?.sourceUrl ?? null,
  };
}

function fmtNum(n: number | null, prefix = ""): string {
  if (n === null || !Number.isFinite(n)) return "unavailable";
  if (Math.abs(n) >= 1e9) return `${prefix}${(n / 1e9).toFixed(1)}B`;
  if (Math.abs(n) >= 1e6) return `${prefix}${(n / 1e6).toFixed(1)}M`;
  return `${prefix}${n.toFixed(2)}`;
}

function anchorText(a: PriceAnchor): string {
  return [
    `Ticker: ${a.ticker}`,
    `Last price: ${fmtNum(a.price, "$")}${a.freshnessLabel ? ` (${a.freshnessLabel})` : ""}`,
    `Day change: ${a.changePct === null ? "unavailable" : `${a.changePct.toFixed(2)}%`}`,
    `52-week range: ${fmtNum(a.week52Low, "$")} – ${fmtNum(a.week52High, "$")}`,
    `Market cap: ${fmtNum(a.marketCap, "$")}`,
    `P/E (ttm): ${fmtNum(a.peRatio)}`,
  ].join("\n");
}

// ─── Shared voice ────────────────────────────────────────────────────────────

const VOICE = `You write for a beginner-to-intermediate retail investor — picture a 19-year-old with $500. Plain English only: no jargon, no finance-bro shorthand, no "machinery" talk (never mention agents, pipelines, tokens, or web search). Never use imperative trade language like "buy now" — frame everything as the analysts' research view. You are a research and education tool, not a financial adviser. Where a precise market statistic isn't given to you, describe it qualitatively rather than inventing a number — never fabricate a precise figure (short interest, exact revenue, etc.). Use the real price anchors you are given for any price-based field.`;

// ─── Per-skill specs ─────────────────────────────────────────────────────────

type Grounding = "ticker" | "tickerPair" | "sector" | "headline" | "allocator" | "holdings";

interface SkillSpec {
  grounding: Grounding;
  model: string;
  maxTokens: number;
  toolName: string;
  toolDescription: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  inputSchema: Record<string, any>;
  system: string;
  buildUser: (params: SkillParams, anchors: PriceAnchor[]) => string;
}

export interface SkillParams {
  ticker?: string;
  tickerA?: string;
  tickerB?: string;
  sector?: string;
  headline?: string;
  budgetUSD?: number;
  goals?: string;
  holdings?: string; // free-text or "AAPL 40%, MSFT 30%, cash 30%"
}

const STR = (description: string) => ({ type: "string", description });
const NUM = (description: string, minimum?: number, maximum?: number) => ({
  type: "number",
  description,
  ...(minimum !== undefined ? { minimum } : {}),
  ...(maximum !== undefined ? { maximum } : {}),
});
const ENUM = (values: string[], description: string) => ({
  type: "string",
  enum: values,
  description,
});

const SURENESS = ENUM(["High", "Medium", "Low"], "How sure the analysts are.");

export const SKILL_SPECS: Record<SkillViewId, SkillSpec> = {
  // 1 ── Worth Owning? — durability scorecard
  "worth-owning": {
    grounding: "ticker",
    model: MODELS.cio, // flagship — this is the deep ownership call
    maxTokens: 650,
    toolName: "report_worth_owning",
    toolDescription: "Score whether this is a business worth owning for years across five durability pillars.",
    inputSchema: {
      type: "object",
      properties: {
        durabilityScore: NUM("0-100. How durable the business is over a multi-year horizon.", 0, 100),
        ownYearsVerdict: STR("One sentence: would a long-term owner want this, and why."),
        sureness: SURENESS,
        pillars: {
          type: "array",
          description: "Exactly five pillars, in this order: Moat, Balance sheet, Growth runway, Management, Valuation.",
          items: {
            type: "object",
            properties: {
              name: ENUM(["Moat", "Balance sheet", "Growth runway", "Management", "Valuation"], "Pillar name."),
              score: NUM("0-100 for this pillar.", 0, 100),
              note: STR("One plain-English line on this pillar."),
            },
            required: ["name", "score", "note"],
          },
        },
        changeOurMind: STR("The one development that would flip the verdict."),
      },
      required: ["durabilityScore", "ownYearsVerdict", "sureness", "pillars", "changeOurMind"],
    },
    system: `${VOICE}\n\nYou assess whether a company is worth OWNING for years — durability, not this week's price. Score five pillars (Moat, Balance sheet, Growth runway, Management, Valuation) 0-100, give an overall durability score, and name the one thing that would change your mind.`,
    buildUser: (p, a) => `Assess ${a[0]?.ticker ?? p.ticker} as a long-term holding.\n\nReal market anchors:\n${anchorText(a[0])}\n\nFill report_worth_owning.`,
  },

  // 2 ── Quick Take — 30-second read
  "quick-take": {
    grounding: "ticker",
    model: MODELS.judge, // mini — fast, cheap
    maxTokens: 350,
    toolName: "report_quick_take",
    toolDescription: "A 30-second read on the ticker: stance plus the good, the risk, and the one thing to watch.",
    inputSchema: {
      type: "object",
      properties: {
        stance: ENUM(["Worth a look", "Wait and watch", "Probably pass"], "The headline stance."),
        oneLine: STR("The 30-second read in one sentence."),
        theGood: STR("Strongest point in its favour."),
        theRisk: STR("Biggest thing that could go wrong."),
        theWatch: STR("The one number or event to watch next."),
        sureness: SURENESS,
      },
      required: ["stance", "oneLine", "theGood", "theRisk", "theWatch", "sureness"],
    },
    system: `${VOICE}\n\nYou give the fastest honest read on a ticker — a stance and three crisp lines (the good, the risk, the watch). No hedging walls of text.`,
    buildUser: (p, a) => `Give the quick take on ${a[0]?.ticker ?? p.ticker}.\n\nReal market anchors:\n${anchorText(a[0])}\n\nFill report_quick_take.`,
  },

  // 3 ── Entry & Exit Zones — price ladder
  "entry-exit-zones": {
    grounding: "ticker",
    model: MODELS.judge,
    maxTokens: 500,
    toolName: "report_entry_exit",
    toolDescription: "Draw accumulate / fair-value / trim price bands plus supports and resistances around the real current price.",
    inputSchema: {
      type: "object",
      properties: {
        accumulate: { type: "object", properties: { low: NUM("Lower bound, $."), high: NUM("Upper bound, $.") }, required: ["low", "high"], description: "Where patient buyers tend to step in (below current price)." },
        fairValue: { type: "object", properties: { low: NUM("Lower bound, $."), high: NUM("Upper bound, $.") }, required: ["low", "high"], description: "The no-edge-either-way middle band, bracketing the current price." },
        trim: { type: "object", properties: { low: NUM("Lower bound, $."), high: NUM("Upper bound, $.") }, required: ["low", "high"], description: "Where the easy gains are likely gone (above current price)." },
        supports: { type: "array", items: NUM("A support price level, $."), description: "1-3 support levels below current price." },
        resistances: { type: "array", items: NUM("A resistance price level, $."), description: "1-3 resistance levels above current price." },
        rationale: STR("How these levels were drawn, referencing the real price and 52-week range."),
        sureness: SURENESS,
      },
      required: ["accumulate", "fairValue", "trim", "supports", "resistances", "rationale", "sureness"],
    },
    system: `${VOICE}\n\nYou map sensible price ZONES around the REAL current price and 52-week range you are given: an accumulate band below, a fair-value band around it, a trim band above, plus a few support/resistance levels. All prices must be anchored to the real numbers provided — these are levels to think about, not predictions.`,
    buildUser: (p, a) => `Map entry & exit zones for ${a[0]?.ticker ?? p.ticker}. Anchor every level to these real numbers:\n${anchorText(a[0])}\n\nFill report_entry_exit.`,
  },

  // 4 ── Face-Off — head-to-head
  "face-off": {
    grounding: "tickerPair",
    model: MODELS.comparativeJudge, // flagship
    maxTokens: 700,
    toolName: "report_face_off",
    toolDescription: "Score two stocks head-to-head across five dimensions and call a winner.",
    inputSchema: {
      type: "object",
      properties: {
        tickerA: STR("First ticker."),
        tickerB: STR("Second ticker."),
        rounds: {
          type: "array",
          description: "Exactly five rounds: Growth, Profitability, Valuation, Momentum, Balance sheet.",
          items: {
            type: "object",
            properties: {
              dimension: ENUM(["Growth", "Profitability", "Valuation", "Momentum", "Balance sheet"], "Dimension."),
              scoreA: NUM("0-100 for ticker A.", 0, 100),
              scoreB: NUM("0-100 for ticker B.", 0, 100),
              note: STR("Who edges this round and why, one line."),
            },
            required: ["dimension", "scoreA", "scoreB", "note"],
          },
        },
        winner: ENUM(["A", "B", "Tie"], "Overall winner."),
        verdict: STR("The call, framed as the analysts' view."),
        sureness: SURENESS,
      },
      required: ["tickerA", "tickerB", "rounds", "winner", "verdict", "sureness"],
    },
    system: `${VOICE}\n\nTwo stocks enter, one wins. Score both across five dimensions (Growth, Profitability, Valuation, Momentum, Balance sheet) 0-100 each, then call an overall winner with a plain reason.`,
    buildUser: (p, a) => `Face-off: ${a[0]?.ticker} vs ${a[1]?.ticker}.\n\n${a[0]?.ticker} anchors:\n${anchorText(a[0])}\n\n${a[1]?.ticker} anchors:\n${anchorText(a[1])}\n\nFill report_face_off (tickerA=${a[0]?.ticker}, tickerB=${a[1]?.ticker}).`,
  },

  // 5 ── Sector Pulse — industry heat
  "sector-pulse": {
    grounding: "sector",
    model: MODELS.judge,
    maxTokens: 600,
    toolName: "report_sector_pulse",
    toolDescription: "Read the heat of a whole industry: pulse level, drivers, leaders, laggards, and where money is rotating.",
    inputSchema: {
      type: "object",
      properties: {
        sectorName: STR("The sector / theme name."),
        pulse: ENUM(["Hot", "Warm", "Cooling", "Cold"], "Overall heat."),
        pulseScore: NUM("-100 (cold) to 100 (hot).", -100, 100),
        drivers: { type: "array", items: STR("A theme moving the whole group."), description: "2-4 drivers." },
        leaders: { type: "array", items: { type: "object", properties: { ticker: STR("Ticker."), label: STR("One-word read."), heat: NUM("-100..100.", -100, 100) }, required: ["ticker", "label", "heat"] }, description: "2-4 names running ahead." },
        laggards: { type: "array", items: { type: "object", properties: { ticker: STR("Ticker."), label: STR("One-word read."), heat: NUM("-100..100.", -100, 100) }, required: ["ticker", "label", "heat"] }, description: "2-4 names falling behind." },
        rotationRead: STR("Is money rotating into or out of this group, in plain English."),
      },
      required: ["sectorName", "pulse", "pulseScore", "drivers", "leaders", "laggards", "rotationRead"],
    },
    system: `${VOICE}\n\nYou read what's moving a whole industry right now: an overall pulse, the themes driving it, the names leading and lagging, and where money is rotating. Use well-known representative tickers for the sector.`,
    buildUser: (p) => `Read the pulse of this sector/theme: "${p.sector}".\n\nFill report_sector_pulse.`,
  },

  // 6 ── Headline Decoder — impact touch-map
  "headline-decoder": {
    grounding: "headline",
    model: MODELS.judge,
    maxTokens: 600,
    toolName: "report_headline_decode",
    toolDescription: "Decode a news headline: plain summary, which stocks it touches and how hard, and the second-order effect.",
    inputSchema: {
      type: "object",
      properties: {
        headline: STR("The headline, echoed and lightly cleaned."),
        plainSummary: STR("What actually happened, jargon-free."),
        impacted: {
          type: "array",
          description: "2-6 stocks the headline touches.",
          items: {
            type: "object",
            properties: {
              ticker: STR("Ticker."),
              direction: ENUM(["up", "down", "mixed"], "Likely direction of impact."),
              magnitude: NUM("0-100 — how hard it's touched.", 0, 100),
              why: STR("One line on why."),
            },
            required: ["ticker", "direction", "magnitude", "why"],
          },
        },
        secondOrder: STR("The knock-on effect most people miss."),
        timeHorizon: ENUM(["Today", "This week", "This quarter", "Long-term"], "When this matters most."),
      },
      required: ["headline", "plainSummary", "impacted", "secondOrder", "timeHorizon"],
    },
    system: `${VOICE}\n\nYou turn any news headline into a map of which stocks it touches and how hard, plus the second-order effect most people miss. Pick real, well-known tickers connected to the headline.`,
    buildUser: (p) => `Decode this headline:\n"${p.headline}"\n\nFill report_headline_decode.`,
  },

  // 7 ── Crowd Check — crowd-vs-data twin gauge
  "crowd-check": {
    grounding: "ticker",
    model: MODELS.judge,
    maxTokens: 600,
    toolName: "report_crowd_check",
    toolDescription: "Compare what the crowd FEELS about a stock against what the DATA says, on two needles.",
    inputSchema: {
      type: "object",
      properties: {
        crowdMood: NUM("-100 (extreme fear) to 100 (extreme greed) — the crowd needle.", -100, 100),
        dataStrength: NUM("-100 (weak fundamentals) to 100 (strong fundamentals) — the data needle.", -100, 100),
        gapRead: STR("What the gap between crowd mood and data strength means here."),
        crowdSignals: {
          type: "array",
          description: "2-4 crowd-sentiment signals. Describe qualitatively — never fabricate precise stats.",
          items: { type: "object", properties: { label: STR("Signal name, e.g. 'Retail chatter'."), read: STR("Qualitative read."), lean: ENUM(["fear", "neutral", "greed"], "Which way it leans.") }, required: ["label", "read", "lean"] },
        },
        dataSignals: {
          type: "array",
          description: "2-4 fundamentals signals.",
          items: { type: "object", properties: { label: STR("Signal name, e.g. 'Revenue trend'."), read: STR("Qualitative read."), lean: ENUM(["weak", "neutral", "strong"], "Which way it leans.") }, required: ["label", "read", "lean"] },
        },
        contrarianNote: STR("When the crowd and the data disagree, what history suggests."),
      },
      required: ["crowdMood", "dataStrength", "gapRead", "crowdSignals", "dataSignals", "contrarianNote"],
    },
    system: `${VOICE}\n\nYou measure the GAP between what investors FEEL about a stock (the crowd: fear↔greed) and what the DATA actually says (fundamentals: weak↔strong). Place each on a -100..100 needle and explain the gap. Crowd-sentiment signals are qualitative reads — do NOT invent precise figures like an exact short-interest percentage.`,
    buildUser: (p, a) => `Crowd-check ${a[0]?.ticker ?? p.ticker}: what the crowd feels vs what the data says.\n\nReal market anchors (the data side starts here):\n${anchorText(a[0])}\n\nFill report_crowd_check.`,
  },

  // 8 ── Bull & Bear Map — scenario territory
  "bull-bear-map": {
    grounding: "ticker",
    model: MODELS.judge,
    maxTokens: 650,
    toolName: "report_bull_bear_map",
    toolDescription: "Lay out bear / base / bull scenarios as territory on a price map, each with a target, odds, story, and triggers.",
    inputSchema: {
      type: "object",
      properties: {
        scenarios: {
          type: "array",
          description: "Exactly three, in order: bear, base, bull.",
          items: {
            type: "object",
            properties: {
              band: ENUM(["bear", "base", "bull"], "Which territory."),
              priceTarget: NUM("Price target for this case, $."),
              probability: NUM("0-100. The three should roughly sum to 100.", 0, 100),
              narrative: STR("The story of this world, one or two lines."),
              triggers: { type: "array", items: STR("A development that pushes us into this territory."), description: "1-3 triggers." },
            },
            required: ["band", "priceTarget", "probability", "narrative", "triggers"],
          },
        },
        axisLow: NUM("Left edge of the map (lowest price to show, $) — at or below the bear target."),
        axisHigh: NUM("Right edge of the map (highest price to show, $) — at or above the bull target."),
        mapRead: STR("Where on this map we sit today vs the real current price, plain English."),
      },
      required: ["scenarios", "axisLow", "axisHigh", "mapRead"],
    },
    system: `${VOICE}\n\nYou draw a MAP of the future as three territories along a price axis — bear (left), base (middle), bull (right). Each gets a price target, rough odds, a short story, and the triggers that would move us into it. Anchor targets and the axis to the REAL current price and 52-week range given. The probabilities should roughly sum to 100.`,
    buildUser: (p, a) => `Draw the bull & bear map for ${a[0]?.ticker ?? p.ticker}. Anchor to:\n${anchorText(a[0])}\n\nFill report_bull_bear_map.`,
  },

  // 9 ── Starter Portfolio — allocation plan
  "starter-portfolio": {
    grounding: "allocator",
    model: MODELS.judge,
    maxTokens: 650,
    toolName: "report_starter_portfolio",
    toolDescription: "Turn a budget and goals into a simple, diversified starter allocation plan.",
    inputSchema: {
      type: "object",
      properties: {
        riskProfile: ENUM(["Cautious", "Balanced", "Adventurous"], "Inferred risk profile."),
        budgetUSD: NUM("The budget, echoed from input, $."),
        buckets: {
          type: "array",
          description: "3-6 buckets whose pct sum to 100.",
          items: {
            type: "object",
            properties: {
              bucket: STR("Bucket name, e.g. 'Broad US stocks', 'Bonds', 'Cash buffer'."),
              pct: NUM("0-100 share of the budget.", 0, 100),
              examples: { type: "array", items: STR("Plain example (broad ETF or type), not a hot stock tip."), description: "1-3 examples." },
              why: STR("One line on why this bucket exists."),
            },
            required: ["bucket", "pct", "examples", "why"],
          },
        },
        expectedSwing: STR("Honest plain-English note: in a bad year this could fall roughly X%."),
        firstSteps: { type: "array", items: STR("A concrete next action."), description: "2-3 first steps." },
      },
      required: ["riskProfile", "budgetUSD", "buckets", "expectedSwing", "firstSteps"],
    },
    system: `${VOICE}\n\nYou turn a budget and goals into a simple, diversified STARTER plan — buckets that sum to 100%, plain examples (broad ETFs/types, never hot single-stock tips), and an honest note on how much it could swing in a bad year. This is education, not a recommendation to buy specific securities.`,
    buildUser: (p) => `Build a starter portfolio. Budget: $${p.budgetUSD ?? 0}. Goals: ${p.goals || "general long-term growth"}.\n\nFill report_starter_portfolio (echo budgetUSD=${p.budgetUSD ?? 0}).`,
  },

  // 10 ── Portfolio Health Check — vitals + stress test
  "portfolio-health-check": {
    grounding: "holdings",
    model: MODELS.cio, // flagship — the audit reasons over the whole book
    maxTokens: 700,
    toolName: "report_portfolio_health",
    toolDescription: "Stress-test a set of holdings: a health score, vitals, what-if shocks, and fixes to consider.",
    inputSchema: {
      type: "object",
      properties: {
        healthScore: NUM("0-100 overall portfolio health (higher = healthier).", 0, 100),
        vitals: {
          type: "array",
          description: "Exactly four vitals: Concentration, Diversification, Drawdown risk, Correlation.",
          items: {
            type: "object",
            properties: {
              name: ENUM(["Concentration", "Diversification", "Drawdown risk", "Correlation"], "Vital."),
              status: ENUM(["good", "watch", "alert"], "Status."),
              score: NUM("0-100 (higher = healthier).", 0, 100),
              note: STR("One plain line."),
            },
            required: ["name", "status", "score", "note"],
          },
        },
        stressTests: {
          type: "array",
          description: "2-4 what-if shocks.",
          items: { type: "object", properties: { shock: STR("The scenario, e.g. 'Tech sells off 20%'."), estImpactPct: NUM("Estimated portfolio impact %, negative = a fall."), note: STR("One line.") }, required: ["shock", "estImpactPct", "note"] },
        },
        fixes: { type: "array", items: STR("A non-imperative suggestion to consider."), description: "2-4 fixes." },
      },
      required: ["healthScore", "vitals", "stressTests", "fixes"],
    },
    system: `${VOICE}\n\nYou stress-test what someone owns: an overall health score, four vitals (Concentration, Diversification, Drawdown risk, Correlation), a few what-if shock scenarios with rough estimated impact, and plain fixes to consider. Frame fixes as things to think about, never orders.`,
    buildUser: (p) => `Stress-test these holdings:\n${p.holdings || "(none provided)"}\n\nFill report_portfolio_health.`,
  },
};

// ─── Which tickers a skill needs grounded ────────────────────────────────────

function tickersFor(skillId: SkillViewId, p: SkillParams): string[] {
  switch (SKILL_SPECS[skillId].grounding) {
    case "ticker":
      return p.ticker ? [p.ticker] : [];
    case "tickerPair":
      return [p.tickerA, p.tickerB].filter((t): t is string => !!t);
    default:
      return []; // sector / headline / allocator / holdings need no price anchor
  }
}

export interface RunSkillViewResult {
  view: SkillView;
  anchors: PriceAnchor[];
  costUSD: number;
}

// ─── The one call ────────────────────────────────────────────────────────────

export async function runSkillView(
  skillId: SkillViewId,
  params: SkillParams
): Promise<RunSkillViewResult> {
  const spec = SKILL_SPECS[skillId];
  if (!spec) throw new Error(`Unknown skill view: ${skillId}`);

  const anchors = await Promise.all(tickersFor(skillId, params).map(buildAnchor));

  const ai = getOpenAI();
  const response = await ai.messages.create({
    model: spec.model,
    max_tokens: spec.maxTokens,
    system: [{ type: "text", text: spec.system, cache_control: { type: "ephemeral" } }],
    tools: [
      {
        name: spec.toolName,
        description: spec.toolDescription,
        input_schema: spec.inputSchema,
      },
    ],
    tool_choice: { type: "tool", name: spec.toolName },
    messages: [{ role: "user", content: spec.buildUser(params, anchors) }],
  });

  const toolUse = response.content.find(
    (b) => b.type === "tool_use" && b.name === spec.toolName
  );
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error(
      `[skill:${skillId}] no tool_use returned. Got: ${JSON.stringify(response.content).slice(0, 200)}`
    );
  }

  const costUSD = estimateCallCostUSD(
    spec.model as keyof typeof import("../openai").PRICING_PER_TOKEN,
    response.usage
  );

  // Tag the parsed shape with its `kind` so the renderer can discriminate.
  const view = { kind: skillId, ...(toolUse.input as object) } as SkillView;
  return { view, anchors, costUSD };
}
