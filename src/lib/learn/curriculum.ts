// Conviqt Learn — the static curriculum catalog.
//
// Tracks and lessons are fixed (the catalog rarely changes and must be stable
// for progress tracking + global lesson caching). The *content* of each lesson
// is authored on demand by Claude from the lesson's `objective` seed.
//
// Lesson ids are permanent cache keys — never renumber an existing lesson.

import type { Track, LessonMeta } from "./types";
import { LESSON_XP_BY_DIFFICULTY } from "./types";

function lesson(
  id: string,
  title: string,
  hook: string,
  difficulty: LessonMeta["difficulty"],
  objective: string,
): LessonMeta {
  return { id, title, hook, difficulty, xp: LESSON_XP_BY_DIFFICULTY[difficulty], objective };
}

export const TRACKS: Track[] = [
  {
    id: "mental-models",
    name: "Mental Models & Edge",
    tagline: "Where real edge comes from — and why most participants never have any.",
    emoji: "\u{1F9E9}",
    accent: "#818cf8",
    lessons: [
      lesson(
        "mm-variant-perception",
        "Variant Perception",
        "You only get paid for being right when the crowd is wrong.",
        "core",
        "Teach Michael Steinhardt's concept of variant perception: alpha exists only where your well-founded view differs from the embedded consensus. Explain that to make money you need (1) a differentiated view, (2) a reason the market is wrong, and (3) a catalyst that closes the gap. Contrast 'being right' with 'being right and non-consensus' — the latter is the only one that pays. Tie to how Conviqt surfaces where the Council disagrees with the tape.",
      ),
      lesson(
        "mm-second-order",
        "Second-Order Thinking",
        "First-level thinkers ask 'what?'. The paid question is 'and then what?'.",
        "core",
        "Teach Howard Marks' first- vs second-order thinking. A good company is not the same as a good investment if the good news is already in the price. Walk through 'a rate cut is bullish' (first order) vs 'everyone already positioned for the cut, so the cut itself is the sell trigger' (second order). Teach the reflexive question chain: and then what? who is on the other side? what is already priced in?",
      ),
      lesson(
        "mm-base-rates",
        "Base Rates & the Outside View",
        "The boring statistic beats your exciting story.",
        "advanced",
        "Teach base-rate neglect (Kahneman) and Michael Mauboussin's inside vs outside view. Most forecasts fail because the analyst builds a vivid bottom-up narrative and ignores what usually happens to companies in that reference class (e.g. % of hyper-growth firms that sustain 40%+ growth for 5 years, M&A success rates, IPO 3-year returns). Teach how to anchor on the base rate first, then adjust for the specific case — never the reverse.",
      ),
      lesson(
        "mm-expected-value",
        "Thinking in Bets & Expected Value",
        "Stop predicting. Start weighing probability-weighted payoffs.",
        "advanced",
        "Teach Annie Duke's 'thinking in bets' and expected value as the core decision unit. A high-probability trade can be a bad bet and a 30% shot can be a great one — it depends on the payoff. Show EV = Σ(probability × outcome) and that asymmetry (small loss / large gain) is what professionals hunt. Attach the expected_value widget so the learner builds an asymmetric bet and watches EV flip positive even with a sub-50% win rate.",
      ),
    ],
  },
  {
    id: "position-sizing",
    name: "Position Sizing & Portfolio Construction",
    tagline: "Almost no one loses money on bad picks. They lose it on bad sizing.",
    emoji: "\u{2696}",
    accent: "#34d399",
    lessons: [
      lesson(
        "ps-sizing-beats-picking",
        "Why Sizing Beats Picking",
        "Two managers, identical trades, opposite outcomes.",
        "core",
        "Teach that returns are driven more by position sizing and bet construction than by hit rate. Use the Druckenmiller principle: 'It's not whether you're right or wrong, but how much you make when right and how much you lose when wrong.' Show how the same set of trades produces wildly different equity curves under different sizing rules. Introduce risk-per-trade (1-2% of capital) as the professional default.",
      ),
      lesson(
        "ps-kelly",
        "The Kelly Criterion",
        "The math that tells you how big to bet — and why pros bet half of it.",
        "advanced",
        "Teach the Kelly Criterion: optimal fraction f* = edge/odds = (p·b − q)/b, where p = win prob, q = loss prob, b = payoff ratio. Explain that full Kelly maximizes long-run growth but is brutally volatile, so professionals run half- or quarter-Kelly to cut drawdown while keeping most of the growth. Stress that over-betting (beyond Kelly) GUARANTEES eventual ruin even with a positive edge. Attach the position_sizing widget.",
      ),
      lesson(
        "ps-correlation-diversification",
        "Correlation, Not Count",
        "Owning 30 tech stocks is owning one bet 30 times.",
        "advanced",
        "Teach that true diversification is about correlation, not the number of holdings. Thirty highly-correlated names behave like one position when it matters. Explain how portfolio variance depends on pairwise correlations, why uncorrelated return streams are the genuine free lunch, and why correlations converge toward 1 in a crisis. Attach the diversification widget and frame it as a correlation argument, not a 'more is safer' argument.",
      ),
      lesson(
        "ps-barbell-convexity",
        "Barbells & Convexity",
        "Taleb's portfolio: boring on one end, lottery tickets on the other.",
        "advanced",
        "Teach Nassim Taleb's barbell strategy: hold the bulk in maximally safe assets and a small sleeve in high-convexity, capped-downside / uncapped-upside bets — and nothing in the fragile middle. Explain convexity (asymmetric payoff curvature) and why a portfolio that's antifragile to tail events beats one optimized for the average case. Connect to options as convexity instruments and to why barbells survive regimes that blow up 'balanced' portfolios.",
      ),
    ],
  },
  {
    id: "risk-management",
    name: "Risk Management",
    tagline: "Survival first. You cannot compound from zero.",
    emoji: "\u{1F6E1}",
    accent: "#f59e0b",
    lessons: [
      lesson(
        "rm-drawdown-math",
        "The Recovery Tax",
        "Down 50% needs +100% just to get back to even.",
        "core",
        "Teach the asymmetry of losses: a drawdown of d% requires a gain of d/(1−d) to recover, so −20% needs +25%, −50% needs +100%, −80% needs +400%. Explain why protecting against deep drawdowns matters more than chasing the last few points of upside, and why this is the mathematical case for stops and sizing. Attach the drawdown_recovery widget.",
      ),
      lesson(
        "rm-first-loss-cheapest",
        "The First Loss Is the Cheapest",
        "Cut, reassess, re-enter. Never average into a falling knife.",
        "advanced",
        "Teach the professional discipline of cutting losers fast: pre-defining the invalidation level (the price/fact that proves the thesis wrong) before entering, and exiting without negotiation when it's hit. Explain why averaging down on a broken thesis is the classic account-killer, the difference between adding to a thesis vs adding to a hope, and how stops should be set on thesis invalidation, not arbitrary percentages. Tie to how Conviqt's Alpha Tracker publishes a hard stop on every pick.",
      ),
      lesson(
        "rm-tail-risk",
        "Tail Risk & Black Swans",
        "The risk that matters is the one you didn't model.",
        "advanced",
        "Teach why fat tails dominate market outcomes: returns are not normally distributed, and a handful of extreme days drive most of the long-run damage and gains. Explain VaR and its blind spot (it says nothing about losses beyond the threshold), Expected Shortfall / CVaR as the better tail measure, and the role of cheap convex hedges. Stress humility about low-probability/high-consequence events and pre-mortems.",
      ),
      lesson(
        "rm-liquidity-regime",
        "Liquidity & When Correlations Go to 1",
        "Diversification fails exactly when you need it most.",
        "advanced",
        "Teach liquidity risk and regime shifts: in a crisis, everything correlated sells off together as leverage unwinds and everyone reaches for the same exits. Explain the difference between asset liquidity and funding liquidity, why forced sellers set prices at the margin, the danger of leverage + illiquidity, and why position sizing must account for the liquidity you'll actually have in a panic, not the liquidity on a calm day.",
      ),
    ],
  },
  {
    id: "valuation-quality",
    name: "Valuation & Business Quality",
    tagline: "Price is what you pay; embedded expectations are what you're really betting against.",
    emoji: "\u{1F48E}",
    accent: "#4f87f7",
    lessons: [
      lesson(
        "vq-reverse-dcf",
        "Reverse DCF: What's Priced In",
        "Don't forecast the future. Ask what future the price already assumes.",
        "advanced",
        "Teach the reverse DCF / expectations-investing approach (Mauboussin & Rappaport): instead of building a DCF to derive a target, invert it — solve for the growth and margin path the current price already implies, then judge whether that's too optimistic or too pessimistic. This reframes the question from 'what will happen' to 'what has to happen to justify this price.' Attach the reverse_dcf widget so the learner dials growth assumptions and sees the implied valuation.",
      ),
      lesson(
        "vq-roic-compounding",
        "ROIC & the Compounding Machine",
        "A business that earns 30% on capital and reinvests is a money printer.",
        "advanced",
        "Teach Return on Invested Capital as the single best measure of business quality: value is created only when ROIC > WACC, and a high-ROIC business that can reinvest at that rate compounds intrinsic value relentlessly. Explain the difference between high-ROIC compounders and high-ROIC businesses with no reinvestment runway (cash returners), and why the market chronically under-prices long reinvestment runways. Attach the compound_interest widget reframed as intrinsic-value compounding.",
      ),
      lesson(
        "vq-owner-earnings",
        "Owner Earnings & Cash Quality",
        "Net income is an opinion. Free cash flow is closer to a fact.",
        "advanced",
        "Teach Buffett's 'owner earnings' and why cash flow beats reported EPS: net income is shaped by accruals, depreciation policy, and management discretion, while free cash flow is harder to manipulate. Explain FCF conversion (FCF/net income), red flags when earnings rise but cash doesn't (working-capital games, capitalized costs, aggressive revenue recognition), and maintenance vs growth capex. Teach the learner to reconcile the income statement to actual cash.",
      ),
      lesson(
        "vq-moats",
        "Moats: What Actually Protects Returns",
        "High returns attract competition. Only a moat keeps them.",
        "advanced",
        "Teach the economic moat framework (Porter / Greenwald): high ROIC invites competition that competes it away unless a durable structural advantage protects it. Cover the real sources — network effects, switching costs, intangibles/brand, cost advantages, and efficient scale — and how to distinguish a true moat from a temporary lead or a good product. Stress that the key question is durability: is the advantage widening or eroding?",
      ),
    ],
  },
  {
    id: "macro-reflexivity",
    name: "Macro, Cycles & Reflexivity",
    tagline: "Markets are not machines that revert to fair value. They are feedback loops.",
    emoji: "\u{1F300}",
    accent: "#a78bfa",
    lessons: [
      lesson(
        "mr-rates-gravity",
        "Rates Are Gravity",
        "Buffett: interest rates are to asset prices what gravity is to matter.",
        "core",
        "Teach why the risk-free rate is the gravitational constant of all valuation: every asset is priced off a discount rate anchored to it, so when long rates rise, the present value of distant cash flows (long-duration growth stocks) falls hardest. Explain duration as it applies to equities, why high-multiple names de-rate violently on rate moves, and how the 10-year yield drives cross-asset behavior. Connect to regime: the same company is worth different amounts in different rate worlds.",
      ),
      lesson(
        "mr-credit-cycle",
        "The Credit Cycle & Liquidity",
        "Equities tell you the story; credit tells you the truth.",
        "advanced",
        "Teach the credit cycle as the master cycle: expansion, exuberance, contraction, repair, driven by the availability and price of credit. Explain why credit spreads (IG and HY) widen before equities sell off and are a superior leading indicator, how liquidity (the marginal lender's willingness) drives risk appetite, and the Minsky idea that stability breeds the leverage that creates instability. Teach watching spreads, not just price.",
      ),
      lesson(
        "mr-reflexivity",
        "Reflexivity: Soros's Big Idea",
        "Perceptions change fundamentals, which change perceptions.",
        "advanced",
        "Teach George Soros's theory of reflexivity: prices don't just reflect fundamentals, they actively shape them through a two-way feedback loop (a rising stock lowers a company's cost of capital, enabling the growth that justifies the rise). Explain boom/bust as self-reinforcing then self-defeating, how narratives become fundamentals, and why equilibrium models miss the bubbles and crashes that reflexivity creates. Contrast with efficient-market theory.",
      ),
      lesson(
        "mr-sentiment-extremes",
        "Sentiment Extremes & Contrarianism",
        "Be greedy when others are fearful — but only at the actual extremes.",
        "advanced",
        "Teach disciplined contrarianism using measurable sentiment extremes rather than vibes: put/call ratios, AAII bull/bear spreads, VIX levels, fund-manager cash levels, and CFTC positioning. Explain that markets top on euphoria (everyone already long, no buyers left) and bottom on capitulation (forced sellers exhausted), why being early is indistinguishable from being wrong, and that contrarianism needs a catalyst and risk control — not just a strong opinion against the crowd.",
      ),
    ],
  },
  {
    id: "conviqt-engine",
    name: "The Conviqt Engine",
    tagline: "How an AI investment committee actually picks — and how to read it like a PM.",
    emoji: "\u{1F9E0}",
    accent: "#f472b6",
    lessons: [
      lesson(
        "ce-the-pipeline",
        "Inside the CIO Pipeline",
        "A macro gate, a screener, six specialists, a CIO, a risk desk.",
        "advanced",
        "Explain Conviqt's institutional pipeline modeled on a real investment process: a Macro regime gate sets the weather, a Screener surfaces candidates, six specialist lenses (Fundamental, Valuation, Catalyst, Risk, Technical, Sentiment) independently score each name, a CIO Orchestrator synthesizes the votes into a conviction, and a Portfolio Constructor sizes the position and sets the stop. Teach why a structured committee with independent inputs beats a single gut call, and that every quantitative claim is tied to a cited source.",
      ),
      lesson(
        "ce-disagreement-alpha",
        "Disagreement as a Signal",
        "When the smartest lenses split, that's information — not noise.",
        "advanced",
        "Teach why Conviqt treats the spread of opinion across its specialists as a first-class output. High agreement = high conviction; a fractured committee = genuine uncertainty that a single confident rating would hide. Connect to variant perception and second-order thinking: the disagreement score tells you where consensus is fragile and where the real debate is. Teach reading conviction and disagreement together, never in isolation.",
      ),
      lesson(
        "ce-reading-alpha-tracker",
        "Reading the Alpha Tracker Like a PM",
        "Entry, target, stop, catalyst, and the losers left in.",
        "advanced",
        "Teach the learner to read the public Alpha Tracker as a portfolio manager would: every pick ships with an entry, a price target, a hard stop, a specific catalyst, a conviction score, and a bear case — and losers are never deleted. Explain why a track record is only credible when the failures stay visible, how to evaluate a strategy by its win rate AND its average win/loss (expectancy), and why process quality matters more than any single outcome.",
      ),
      lesson(
        "ce-build-your-thesis",
        "Build Your Own Thesis (Capstone)",
        "Put every model together into one decision you could defend.",
        "mastery",
        "Capstone lesson that integrates the whole curriculum: take a real ticker and walk the full professional loop — variant perception (what's your non-consensus view?), what's priced in (reverse DCF), business quality (ROIC/moat), the catalyst and timeframe, the bear case and invalidation level, then position sizing and the stop. The output is a one-page thesis the learner could defend to an investment committee. Bridge to Chat to pressure-test it against the Council.",
      ),
    ],
  },
];

// ── Lookups ──────────────────────────────────────────────────────────────────

const LESSON_INDEX: Map<string, { lesson: LessonMeta; track: Track }> = (() => {
  const m = new Map<string, { lesson: LessonMeta; track: Track }>();
  for (const track of TRACKS) {
    for (const l of track.lessons) m.set(l.id, { lesson: l, track });
  }
  return m;
})();

export function findLesson(id: string): { lesson: LessonMeta; track: Track } | null {
  return LESSON_INDEX.get(id) ?? null;
}

export const ALL_LESSON_IDS: string[] = [...LESSON_INDEX.keys()];
export const TOTAL_LESSONS = ALL_LESSON_IDS.length;
