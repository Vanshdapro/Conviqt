// Conviqt Academy — Practice: the static drill catalog.
//
// Like Learn's curriculum, the catalog is fixed (ids are permanent cache keys
// and progress anchors — never renumber). Episode drills ship with their real
// historical price series baked in and a source URL, so Practice runs free and
// works on first boot without a prebuild step. More episodes can be authored
// later via /api/practice/prebuild (web_search-fetched, cached).
//
// Price convention: NOMINAL prices as traded at the time (pre-split), so the
// chart matches the episode's own narrative. Each series carries a sourceUrl.
//
// Drills are arranged into ladder tiers (boss-fight progression):
//   Tier 1  Foundations — survive a crash, hold a trend
//   Tier 2  Discipline  — cut the loser, don't chase the mania
//   Tier 3  Mastery     — write a thesis a PM would fund

import type {
  PracticeDrill,
  ThesisSectionDef,
} from "./types";
import { DRILL_XP_BY_DIFFICULTY } from "./types";

// ── Canonical PM thesis sections (reused across thesis drills) ────────────────

const SECTION: Record<string, ThesisSectionDef> = {
  variant: {
    id: "variant",
    label: "Variant perception",
    prompt: "What is your non-consensus view, and why is the market wrong?",
    placeholder: "The market thinks X. I think Y because… and the reason the crowd is mispricing it is…",
  },
  pricedIn: {
    id: "pricedIn",
    label: "What's priced in",
    prompt: "What growth / outcome does today's price already assume? Are expectations too high or too low?",
    placeholder: "At this price the stock is discounting ~__% growth for __ years. That looks too optimistic/pessimistic because…",
  },
  catalyst: {
    id: "catalyst",
    label: "Catalyst & timeframe",
    prompt: "What specific event closes the gap between price and value, and over what horizon?",
    placeholder: "The catalyst is __ (earnings, product, refi, regulatory). I expect it to play out over __ months.",
  },
  quality: {
    id: "quality",
    label: "Business quality / mechanism",
    prompt: "Why does this business earn its returns — the moat — or, for a macro/event trade, what's the mechanism?",
    placeholder: "The moat is __ (network effects, switching costs, cost advantage). It's widening/eroding because…",
  },
  bearCase: {
    id: "bearCase",
    label: "Bear case & invalidation",
    prompt: "Make the strongest case against yourself. What price or fact proves the thesis wrong?",
    placeholder: "The bear case is __. My thesis is invalidated if __ (a specific price level or data point).",
  },
  risk: {
    id: "risk",
    label: "Sizing & stop",
    prompt: "How big is the position as a % of the book, and where is the stop? Justify the risk.",
    placeholder: "I'd size this at __% with a stop at __, risking __% of capital because…",
  },
};

function drillXp(difficulty: PracticeDrill["difficulty"]): number {
  return DRILL_XP_BY_DIFFICULTY[difficulty];
}

// ── TIER 1 — FOUNDATIONS ───────────────────────────────────────────────────────

const COVID_CRASH: PracticeDrill = {
  id: "ep-covid-2020",
  kind: "episode",
  title: "The COVID Crash",
  hook: "The fastest bear market in history. Do you panic, freeze, or buy the fear?",
  difficulty: "core",
  xp: drillXp("core"),
  tier: 1,
  conceptTags: ["Drawdown math", "Sentiment extremes", "Don't sell the bottom"],
  conceptLessonIds: ["rm-drawdown-math", "mr-sentiment-extremes", "rm-first-loss-cheapest"],
  episode: {
    ticker: "SPY",
    company: "S&P 500 (SPDR ETF)",
    period: "Feb–Jun 2020",
    startingCash: 100000,
    briefing:
      "It's February 2020. The market is at all-time highs and you're fully in cash, hunting an entry on the S&P 500. A new virus is spreading beyond China. Most desks are treating it as a contained, Asia-only story. You have $100,000. Trade the index through what comes next.",
    bars: [
      { t: "Feb 21", close: 333.48 },
      { t: "Feb 28", close: 296.26 },
      { t: "Mar 06", close: 289.03 },
      { t: "Mar 13", close: 269.32 },
      { t: "Mar 20", close: 228.80 },
      { t: "Mar 23", close: 222.95 },
      { t: "Mar 27", close: 253.42 },
      { t: "Apr 03", close: 248.19 },
      { t: "Apr 09", close: 278.20 },
      { t: "Apr 17", close: 286.64 },
      { t: "Apr 24", close: 282.97 },
      { t: "May 01", close: 282.79 },
      { t: "May 08", close: 292.44 },
      { t: "May 15", close: 286.28 },
      { t: "May 22", close: 295.44 },
      { t: "May 29", close: 304.32 },
      { t: "Jun 05", close: 319.34 },
    ],
    events: [
      { atBar: 1, headline: "Worst week since 2008", detail: "COVID spreads to Italy and Iran. The S&P drops 11% in a week. 'Just a correction,' say the bulls.", tone: "bear" },
      { atBar: 3, headline: "National emergency declared", detail: "Circuit breakers halt trading repeatedly. Schools and borders close. There is no playbook for this.", tone: "bear" },
      { atBar: 5, headline: "Fed goes to zero + unlimited QE", detail: "The Fed cuts to 0% and pledges unlimited bond buying. Headlines scream 'depression.' Maximum fear.", tone: "bear" },
      { atBar: 6, headline: "$2 trillion CARES Act passes", detail: "Congress backstops the economy. Stocks rip off the lows — but most investors are too shaken to buy.", tone: "bull" },
      { atBar: 8, headline: "Fed expands lending to $2.3T", detail: "Liquidity floods in. The rebound is sharp and most who sold the bottom are now watching from the sidelines.", tone: "bull" },
      { atBar: 16, headline: "Shock jobs report beats", detail: "Payrolls surprise massively to the upside. The V-shaped recovery is undeniable now.", tone: "bull" },
    ],
    keyMoments: [
      { atBar: 5, ideal: "buy", why: "March 23 was peak capitulation: the Fed had gone all-in and sentiment was at a generational low. Being greedy when others are fearful paid within days." },
      { atBar: 1, ideal: "hold", why: "The first 11% drop felt terrifying but selling into the initial panic without a plan just locks in a loss at the worst time." },
    ],
    teachingPoint:
      "A 33% drawdown needs a 50% gain to recover — but the recovery often comes fastest right after maximum fear. Selling the bottom converts a paper loss into a permanent one and leaves you out for the snap-back.",
    idealPlay:
      "A disciplined PM doesn't catch the exact bottom. They scale in as fear peaks (the Fed's unlimited-QE bazooka was the signal), keep size sane, and hold through the rebound. The mistake the drill punishes is panic-selling into March 23 and missing the V.",
    sourceUrl: "https://en.wikipedia.org/wiki/2020_stock_market_crash",
    sourceLabel: "2020 stock market crash — Wikipedia (S&P 500 low 2,191.86 on Mar 23, 2020)",
    priceNote: "SPY weekly closes plus the Mar 23 intraweek low. Nominal, as traded.",
  },
};

const NVDA_RUN: PracticeDrill = {
  id: "ep-nvda-2023",
  kind: "episode",
  title: "Nvidia's AI Year",
  hook: "A 230% run in twelve months. Can you let a winner run without topping out early?",
  difficulty: "core",
  xp: drillXp("core"),
  tier: 1,
  conceptTags: ["Letting winners run", "Position sizing", "What's priced in"],
  conceptLessonIds: ["ps-sizing-beats-picking", "vq-reverse-dcf", "mm-second-order"],
  episode: {
    ticker: "NVDA",
    company: "NVIDIA Corp",
    period: "Jan–Dec 2023",
    startingCash: 100000,
    startingShares: 0,
    briefing:
      "January 2023. Nvidia trades around $146 after a brutal 2022 for chips. ChatGPT launched eight weeks ago and nobody is sure it matters for hardware yet. You have $100,000. This drill is monthly: one bar per month for 2023. The hard part won't be getting in — it'll be staying in.",
    bars: [
      { t: "Jan '23", close: 195.37 },
      { t: "Feb '23", close: 232.16 },
      { t: "Mar '23", close: 277.49 },
      { t: "Apr '23", close: 277.77 },
      { t: "May '23", close: 378.34 },
      { t: "Jun '23", close: 423.02 },
      { t: "Jul '23", close: 467.29 },
      { t: "Aug '23", close: 493.55 },
      { t: "Sep '23", close: 434.99 },
      { t: "Oct '23", close: 407.80 },
      { t: "Nov '23", close: 467.70 },
      { t: "Dec '23", close: 495.22 },
    ],
    events: [
      { atBar: 0, headline: "Q4 earnings: data-center holds up", detail: "Nvidia beats and talks up AI demand. The stock pops, but the street still models gaming as the core business.", tone: "bull" },
      { atBar: 4, headline: "The guide that broke the model", detail: "Nvidia guides Q2 revenue to $11B vs $7B expected. The stock gaps up ~24% in a day. This is the moment the AI thesis goes mainstream.", tone: "bull" },
      { atBar: 7, headline: "$1 trillion club, priced for perfection", detail: "NVDA crosses $1T market cap. Bears argue every bit of AI upside is now in the price. Volatility picks up.", tone: "neutral" },
      { atBar: 8, headline: "Rate fears hit high-multiple names", detail: "The 10-year yield spikes toward 5%. The most expensive growth stocks de-rate hardest. NVDA pulls back ~12%.", tone: "bear" },
      { atBar: 11, headline: "Best-performing megacap of 2023", detail: "Nvidia ends the year up ~230%, the year's defining trade — for anyone who held on.", tone: "bull" },
    ],
    keyMoments: [
      { atBar: 4, ideal: "hold", why: "After the May guidance gap, the instinct is to take the quick 25%. But this was a fundamental regime change, not a pop to fade. Letting the winner run was the whole game." },
      { atBar: 8, ideal: "hold", why: "The October rate-driven pullback was noise against the AI capex story. A trailing stop protects you; panic-selling the dip just hands back the gains." },
    ],
    teachingPoint:
      "Cutting winners early is the quiet killer of returns. Druckenmiller's rule: it's not whether you're right, it's how much you make when you're right. A trend backed by a genuine fundamental shift deserves to be ridden — with a trailing stop, not a hair-trigger.",
    idealPlay:
      "Get in early-to-mid, size so a pullback doesn't shake you out, and use a trailing stop instead of a profit target. The drill rewards holding through the Oct dip and punishes selling the May gap for a quick win and missing the back half of the run.",
    sourceUrl: "https://www.macrotrends.net/stocks/charts/NVDA/nvidia/stock-price-history",
    sourceLabel: "NVIDIA stock price history — Macrotrends (2023 +233.6%, Dec 29 close $49.49 split-adjusted)",
    priceNote: "Month-end closes. Nominal, as traded in 2023 (pre the June-2024 10:1 split).",
  },
};

// ── TIER 2 — DISCIPLINE ─────────────────────────────────────────────────────────

const SVB_COLLAPSE: PracticeDrill = {
  id: "ep-svb-2023",
  kind: "episode",
  title: "The Falling Knife",
  hook: "A bank you own just dropped 60% in a day. Buy the dip, or get out?",
  difficulty: "advanced",
  xp: drillXp("advanced"),
  tier: 2,
  conceptTags: ["First loss is cheapest", "Invalidation", "Liquidity & credit"],
  conceptLessonIds: ["rm-first-loss-cheapest", "mr-credit-cycle", "rm-liquidity-regime"],
  episode: {
    ticker: "SIVB",
    company: "SVB Financial Group",
    period: "Feb–Mar 2023",
    startingCash: 40000,
    startingShares: 225,
    startingCostBasis: 267,
    briefing:
      "Late February 2023. You hold 225 shares of SVB Financial (SIVB) at a cost of ~$267 — a 'boring' bank serving tech startups, and your position is roughly $60k. You also have $40k in cash. Rates have risen fast, but the bank looks fine on the surface. Manage the position through early March.",
    bars: [
      { t: "Feb 21", close: 296.0 },
      { t: "Feb 24", close: 287.0 },
      { t: "Mar 01", close: 290.0 },
      { t: "Mar 03", close: 284.0 },
      { t: "Mar 06", close: 282.0 },
      { t: "Mar 07", close: 268.0 },
      { t: "Mar 08", close: 267.83 },
      { t: "Mar 09", close: 106.04 },
      { t: "Mar 10", close: 0.10, halted: true },
    ],
    events: [
      { atBar: 6, headline: "The announcement that changed everything", detail: "After the close on Mar 8, SVB reveals it sold $21B of bonds at a $1.8B loss and is scrambling to raise $2.25B in equity. Moody's downgrades it. This is the thesis-breaking fact.", tone: "bear" },
      { atBar: 7, headline: "A $42 billion bank run", detail: "Depositors pull $42B in a single day as VCs tell startups to get their money out. The stock craters 60%. The 'dip' looks tempting to bargain hunters.", tone: "bear" },
      { atBar: 8, headline: "Seized by regulators", detail: "Trading is halted. The FDIC takes over SVB — the second-largest bank failure in US history. Common equity is wiped to zero.", tone: "bear" },
    ],
    keyMoments: [
      { atBar: 6, ideal: "cut", why: "The Mar 8 capital-raise-at-a-loss was the invalidation. A bank announcing a fire sale to plug a hole is a solvency red flag. The first loss — selling at ~$268 — was by far the cheapest exit available." },
      { atBar: 7, ideal: "cut", why: "After the 60% drop the instinct is 'it's too cheap to sell.' But a falling knife on a solvency scare can go to zero. It did. Never average into that." },
    ],
    teachingPoint:
      "The first loss is the cheapest. When the fact that underpins your thesis breaks — here, a bank raising emergency capital at a loss — you exit without negotiating, even at a loss. Buying the 60% 'dip' on a solvency run is how a manageable loss becomes a total one.",
    idealPlay:
      "Cut on the Mar 8 invalidation, full stop. Do NOT add on Mar 9's 60% drop. The disciplined outcome here is a ~10% loss on the position; the undisciplined one is −100%. The drill is explicitly built to punish dip-buying a falling knife and reward honoring the invalidation.",
    sourceUrl: "https://en.wikipedia.org/wiki/Collapse_of_Silicon_Valley_Bank",
    sourceLabel: "Collapse of Silicon Valley Bank — Wikipedia (Mar 8 raise, Mar 9 −60%, Mar 10 FDIC seizure)",
    priceNote: "Daily closes through the collapse; final bar marks the regulatory halt to ~$0. Nominal.",
  },
};

const GME_SQUEEZE: PracticeDrill = {
  id: "ep-gme-2021",
  kind: "episode",
  title: "The Squeeze",
  hook: "A dying retailer goes vertical on a Reddit short squeeze. Greed test.",
  difficulty: "advanced",
  xp: drillXp("advanced"),
  tier: 2,
  conceptTags: ["Reflexivity", "Sentiment extremes", "Tail & liquidity risk", "Lottery-ticket sizing"],
  conceptLessonIds: ["mr-reflexivity", "mr-sentiment-extremes", "rm-tail-risk", "ps-barbell-convexity"],
  episode: {
    ticker: "GME",
    company: "GameStop Corp",
    period: "Jan–Feb 2021",
    startingCash: 50000,
    briefing:
      "Mid-January 2021. GameStop — a brick-and-mortar game retailer everyone assumes is dying — is up sharply, and r/WallStreetBets says short interest is over 100% of the float. You have $50,000. This is daily and it moves fast. The danger here isn't being wrong about the squeeze. It's surviving your own greed.",
    bars: [
      { t: "Jan 11", close: 19.94 },
      { t: "Jan 13", close: 31.40 },
      { t: "Jan 14", close: 39.91 },
      { t: "Jan 19", close: 39.36 },
      { t: "Jan 21", close: 43.03 },
      { t: "Jan 22", close: 65.01 },
      { t: "Jan 25", close: 76.79 },
      { t: "Jan 26", close: 147.98 },
      { t: "Jan 27", close: 347.51 },
      { t: "Jan 28", close: 193.60 },
      { t: "Jan 29", close: 325.00 },
      { t: "Feb 01", close: 225.00 },
      { t: "Feb 02", close: 90.00 },
      { t: "Feb 04", close: 53.50 },
      { t: "Feb 19", close: 40.59 },
    ],
    events: [
      { atBar: 5, headline: "Short interest over 100% of float", detail: "More shares are sold short than exist. WallStreetBets piles in, betting shorts will be forced to buy back at any price.", tone: "bull" },
      { atBar: 8, headline: "+1,700% — hedge funds bleeding", detail: "GME closes at $347. Melvin Capital is reportedly down billions. This is the parabolic blow-off — euphoria everywhere.", tone: "neutral" },
      { atBar: 9, headline: "Robinhood RESTRICTS buying", detail: "Brokers halt buying of GME, only allowing sells. The plumbing fails exactly when you'd want to act. The stock whipsaws violently.", tone: "bear" },
      { atBar: 13, headline: "The unwind", detail: "The squeeze breaks. GME is down ~80% from the peak in days. Latecomers who bought the top are deeply underwater.", tone: "bear" },
    ],
    keyMoments: [
      { atBar: 8, ideal: "sell", why: "At the $347 parabolic peak with universal euphoria, the disciplined move is to take profits into strength. Parabolas end; you sell when everyone is buying, not after." },
      { atBar: 9, ideal: "hold", why: "When Robinhood halted buying, anyone who'd chased was trapped. The lesson: a position you can't exit on your terms was always too big — liquidity is a risk, not a given." },
    ],
    teachingPoint:
      "Reflexivity drives manias: buying begets buying until it doesn't. The way to play a lottery ticket is barbell-style — tiny size, capped downside, take profits into euphoria. Chasing a parabola with real size, then finding the exit closed, is the classic blow-up.",
    idealPlay:
      "If you play it at all, size it like a lottery ticket (a few % of capital), and sell into the Jan 27 euphoria — not after. The drill rewards taking profits at the top and punishes chasing the blow-off or holding the round-trip back to $40.",
    sourceUrl: "https://en.wikipedia.org/wiki/GameStop_short_squeeze",
    sourceLabel: "GameStop short squeeze — Wikipedia (Jan 27 close $347.51; Feb 19 low close $40.59)",
    priceNote: "Daily closes through the squeeze. Nominal, as traded (pre the July-2022 4:1 split).",
  },
};

// ── TIER 3 — MASTERY (thesis drills, AI-graded) ──────────────────────────────────

const THESIS_PRICED_FOR_PERFECTION: PracticeDrill = {
  id: "th-priced-for-perfection",
  kind: "thesis",
  title: "Priced for Perfection",
  hook: "A stock has tripled on a real story. Make the call — and defend what's priced in.",
  difficulty: "advanced",
  xp: drillXp("advanced"),
  tier: 3,
  conceptTags: ["Variant perception", "What's priced in", "Second-order thinking"],
  conceptLessonIds: ["mm-variant-perception", "vq-reverse-dcf", "mm-second-order"],
  thesis: {
    setup:
      "A megacap has tripled in a year on a genuine, fundamentally-driven boom (think the AI-capex trade). The story is real and consensus is now wildly bullish — every analyst has a Buy. You must decide: are you long or short from here, and why? The trap is that 'great company' and 'great stock from this price' are different questions.",
    sections: [SECTION.variant, SECTION.pricedIn, SECTION.catalyst, SECTION.bearCase, SECTION.risk],
    whatGoodLooksLike:
      "A strong answer states a clearly non-consensus view (not just 'it'll keep going up'), quantifies roughly what growth the price already assumes, names a specific catalyst and timeframe, makes a genuine bear case with a price-level invalidation, and sizes the position to the uncertainty. Second-order thinking — 'what's already in the price?' — is the whole point.",
  },
};

const THESIS_FALLEN_QUALITY: PracticeDrill = {
  id: "th-fallen-quality",
  kind: "thesis",
  title: "Falling Knife or Fat Pitch?",
  hook: "A quality compounder just dropped 35% on a guidance cut. Opportunity, or trap?",
  difficulty: "advanced",
  xp: drillXp("advanced"),
  tier: 3,
  conceptTags: ["Business quality", "Invalidation", "Owner earnings", "Moats"],
  conceptLessonIds: ["vq-moats", "rm-first-loss-cheapest", "vq-owner-earnings"],
  thesis: {
    setup:
      "A high-ROIC business with a real moat just cut guidance and fell 35% in a day. The bulls call it a generational entry into a compounder on sale. The bears say the moat is cracking and estimates have further to fall. Build the thesis: is this a fat pitch or a value trap — and how would you know you're wrong in time to get out?",
    sections: [SECTION.variant, SECTION.quality, SECTION.catalyst, SECTION.bearCase, SECTION.risk],
    whatGoodLooksLike:
      "A strong answer distinguishes a temporary stumble from structural moat erosion (with evidence), checks whether the cash flows are real (owner earnings, not just EPS), defines a concrete invalidation level so a falling knife doesn't become a round-trip to zero, and sizes for the genuine uncertainty rather than backing up the truck on conviction alone.",
  },
};

const THESIS_CAPSTONE: PracticeDrill = {
  id: "th-capstone",
  kind: "thesis",
  title: "Your Best Idea",
  hook: "Any ticker you follow. Build a full PM-grade thesis and let the desk grade it.",
  difficulty: "mastery",
  xp: drillXp("mastery"),
  tier: 3,
  conceptTags: ["Full thesis", "Variant perception", "Risk plan", "Capstone"],
  conceptLessonIds: ["ce-build-your-thesis", "mm-variant-perception", "ps-kelly"],
  thesis: {
    setup:
      "The open capstone. Pick any US-listed stock you actually have a view on, and write the complete thesis you'd defend to an investment committee. Walk the full loop: your variant view, what's priced in, the catalyst and timeframe, the business quality, the bear case and invalidation, and the position sizing with a stop. Then pressure-test it against the Council in Research.",
    ticker: undefined,
    sections: [SECTION.variant, SECTION.pricedIn, SECTION.catalyst, SECTION.quality, SECTION.bearCase, SECTION.risk],
    whatGoodLooksLike:
      "A committee-ready thesis is internally consistent: the variant view, the catalyst, and the sizing all point the same way; the bear case is honest rather than a strawman; and there's a specific, falsifiable invalidation level. The mark of a pro is that the risk plan is as detailed as the bull case.",
  },
};

// ── Catalog ───────────────────────────────────────────────────────────────────

export const DRILLS: PracticeDrill[] = [
  COVID_CRASH,
  NVDA_RUN,
  SVB_COLLAPSE,
  GME_SQUEEZE,
  THESIS_PRICED_FOR_PERFECTION,
  THESIS_FALLEN_QUALITY,
  THESIS_CAPSTONE,
];

export const TIERS: { tier: number; name: string; tagline: string }[] = [
  { tier: 1, name: "Foundations", tagline: "Survive a crash. Ride a trend. The two halves of staying in the game." },
  { tier: 2, name: "Discipline", tagline: "Cut the loser. Don't chase the mania. Where most accounts are won or lost." },
  { tier: 3, name: "Mastery", tagline: "Write a thesis a portfolio manager would actually fund." },
];

// ── Lookups ──────────────────────────────────────────────────────────────────

const DRILL_INDEX: Map<string, PracticeDrill> = (() => {
  const m = new Map<string, PracticeDrill>();
  for (const d of DRILLS) m.set(d.id, d);
  return m;
})();

export function findDrill(id: string): PracticeDrill | null {
  return DRILL_INDEX.get(id) ?? null;
}

export const ALL_DRILL_IDS: string[] = [...DRILL_INDEX.keys()];
export const TOTAL_DRILLS = ALL_DRILL_IDS.length;

// Drills in a tier, and whether a tier is unlocked given the set of cleared ids.
export function drillsInTier(tier: number): PracticeDrill[] {
  return DRILLS.filter((d) => d.tier === tier);
}

// A tier is unlocked when every drill in every earlier tier has been cleared.
export function isTierUnlocked(tier: number, clearedIds: Set<string>): boolean {
  if (tier <= 1) return true;
  for (let t = 1; t < tier; t++) {
    const drills = drillsInTier(t);
    if (drills.length > 0 && !drills.every((d) => clearedIds.has(d.id))) return false;
  }
  return true;
}
