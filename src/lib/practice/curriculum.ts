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
//   Tier 1  Foundations       — survive a crash, hold a trend
//   Tier 2  Discipline        — cut the loser, don't chase the mania
//   Tier 3  Cycles & Regimes  — the GFC, a megacap de-rating, the macro regime
//   Tier 4  The Analyst's Desk — underwrite a SaaS grower, a compounder, a short
//   Tier 5  Mastery           — write and red-team a thesis a PM would fund

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
  tier: 5,
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
  tier: 5,
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
  tier: 5,
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

// ── TIER 3 — CYCLES & REGIMES ────────────────────────────────────────────────

const GFC_2008: PracticeDrill = {
  id: "ep-gfc-2008",
  kind: "episode",
  title: "The Great Financial Crisis",
  hook: "The worst drawdown since the Depression. Survive it — then buy the generational bottom.",
  difficulty: "advanced",
  xp: drillXp("advanced"),
  tier: 3,
  conceptTags: ["Credit cycle", "Liquidity & deleveraging", "Drawdown math", "Buying max fear"],
  conceptLessonIds: ["mr-credit-cycle", "rm-liquidity-regime", "rm-drawdown-math", "mr-sentiment-extremes", "found-risk-return"],
  episode: {
    ticker: "SPX",
    company: "S&P 500 Index",
    period: "Aug 2008 – Dec 2009",
    startingCash: 100000,
    briefing:
      "August 2008. You're in cash, watching the S&P 500 near 1,280. Housing has wobbled for a year and Bear Stearns failed in March, but consensus says the damage is contained. You have $100,000 to deploy in the index. What follows is the worst financial crisis since 1929. This drill is monthly: survival first, then the hardest buy of your career.",
    bars: [
      { t: "Aug '08", close: 1282.83 },
      { t: "Sep '08", close: 1166.36 },
      { t: "Oct '08", close: 968.75 },
      { t: "Nov 20", close: 752.44 },
      { t: "Nov 28", close: 896.24 },
      { t: "Dec '08", close: 903.25 },
      { t: "Jan '09", close: 825.88 },
      { t: "Feb '09", close: 735.09 },
      { t: "Mar 09", close: 676.53 },
      { t: "Mar 31", close: 797.87 },
      { t: "Apr '09", close: 872.81 },
      { t: "May '09", close: 919.14 },
      { t: "Jun '09", close: 919.32 },
      { t: "Sep '09", close: 1057.08 },
      { t: "Dec '09", close: 1115.10 },
    ],
    events: [
      { atBar: 1, headline: "Lehman Brothers files for bankruptcy", detail: "Sep 15, 2008: the largest bankruptcy in US history. Interbank credit seizes; banks stop trusting each other. The crisis goes systemic overnight.", tone: "bear" },
      { atBar: 2, headline: "TARP passes after a record crash", detail: "Congress approves a $700B bank bailout — but only after the House first voted it down and the market fell ~9% in a day. Forced deleveraging hits everything at once.", tone: "bear" },
      { atBar: 3, headline: "Capitulation: down ~52% from the high", detail: "Nov 20 touches 752, a multi-year low. Hedge funds liquidate whatever they can sell to meet redemptions. Correlations go to one.", tone: "bear" },
      { atBar: 7, headline: "New lows — 'the system is insolvent'", detail: "Feb–Mar 2009: bank stocks trade like options on zero and nationalization fears swirl. The bear market grinds to its final, terrifying low.", tone: "bear" },
      { atBar: 8, headline: "The bottom: 666 intraday on March 6", detail: "Mar 9 closes at 676. The Fed's backstops and the coming bank stress tests quietly mark the turn — though almost no one can see it through the fear.", tone: "neutral" },
      { atBar: 9, headline: "+25% off the lows in three weeks", detail: "The sharpest rally in decades begins. Most who sold the bottom are frozen, waiting for a 're-test' that never comes.", tone: "bull" },
      { atBar: 13, headline: "Credit thaws, recovery underway", detail: "By late 2009 spreads have collapsed and the index is back above 1,100 — up more than 60% from the March low.", tone: "bull" },
    ],
    keyMoments: [
      { atBar: 8, ideal: "buy", why: "March 2009 was a generational bottom: maximum fear, forced selling exhausted, and credit spreads quietly peaking. You never catch the exact low, but scaling in near 700 was the buy of the decade." },
      { atBar: 3, ideal: "hold", why: "November's capitulation felt like the end — but the index fell another ~10% into March. Don't go all-in on the first wave of panic; keep dry powder for the real low." },
    ],
    teachingPoint:
      "The credit cycle is the master cycle: when financing seizes, forced sellers — not fundamentals — set the price and correlations go to one. A ~57% peak-to-trough drawdown needs a ~130% gain to recover, and that recovery comes fastest at the point of maximum fear. Survival first; then buy when there's blood in the streets and credit is starting to thaw.",
    idealPlay:
      "Preserve capital through the autumn-2008 deleveraging (stay mostly cash, resist averaging into the first crash), then scale into the Feb–Mar 2009 capitulation as credit spreads peak. The drill rewards holding firepower through the worst of it and deploying near the March bottom — and punishes both panic-selling the lows and going all-in too early in November.",
    sourceUrl: "https://en.wikipedia.org/wiki/United_States_bear_market_of_2007%E2%80%932009",
    sourceLabel: "United States bear market of 2007–2009 — Wikipedia (peak 1,565 Oct 2007; closing low 676.53 on Mar 9, 2009)",
    priceNote: "S&P 500 index month-end closes, plus the Nov 20 2008 and Mar 9 2009 capitulation closes. Index points, not dollars.",
  },
};

const META_2022: PracticeDrill = {
  id: "ep-meta-2022",
  kind: "episode",
  title: "The De-Rating",
  hook: "The most-owned megacap just broke its growth story. You hold a full position. Now what?",
  difficulty: "advanced",
  xp: drillXp("advanced"),
  tier: 3,
  conceptTags: ["What's priced in", "Disposition effect", "Capital allocation", "First loss is cheapest"],
  conceptLessonIds: ["vq-reverse-dcf", "bf-disposition", "bf-recency-fomo", "fa-capital-allocation", "rm-first-loss-cheapest"],
  episode: {
    ticker: "META",
    company: "Meta Platforms (Facebook)",
    period: "Jan–Dec 2022",
    startingCash: 30000,
    startingShares: 200,
    startingCostBasis: 330,
    briefing:
      "January 2022. You own 200 shares of Meta at a ~$330 cost basis — a ~$62k position in the consensus 'can't-lose' megacap — plus $30k in cash. Every analyst has a Buy and the stock trades near $311. This drill is monthly. The question isn't whether Meta is a good company. It's what happens to a great company's stock when a flawless story develops its first crack.",
    bars: [
      { t: "Jan '22", close: 311.00 },
      { t: "Feb '22", close: 211.00 },
      { t: "Mar '22", close: 222.36 },
      { t: "Apr '22", close: 200.47 },
      { t: "May '22", close: 192.13 },
      { t: "Jun '22", close: 161.25 },
      { t: "Jul '22", close: 159.10 },
      { t: "Aug '22", close: 162.93 },
      { t: "Sep '22", close: 135.68 },
      { t: "Oct '22", close: 93.16 },
      { t: "Nov '22", close: 118.10 },
      { t: "Dec '22", close: 120.34 },
    ],
    events: [
      { atBar: 1, headline: "−26% in a day: the story cracks", detail: "Feb 2 earnings: daily active users SHRINK for the first time ever, Apple's privacy change blows a ~$10B hole in ad targeting, and guidance disappoints. Meta loses ~$230B of value in a day — the largest one-day loss in market history.", tone: "bear" },
      { atBar: 5, headline: "Rates crush the multiple", detail: "The Fed hikes aggressively. Every high-multiple growth name de-rates, and Meta — now pouring tens of billions into the 'metaverse' — is squarely in the crosshairs.", tone: "bear" },
      { atBar: 9, headline: "−25% again: the capex revolt", detail: "Oct Q3: revenue declines and management guides to even heavier Reality Labs spending. Investors revolt at the capital allocation; the stock breaks below $90, an eight-year low.", tone: "bear" },
      { atBar: 9, headline: "Priced for death", detail: "Near $93, Meta trades around 9× earnings with $40B+ of net cash and a still-dominant ad franchise. The narrative is total despair — exactly when embedded expectations have collapsed to nothing.", tone: "neutral" },
      { atBar: 10, headline: "The turn: 'Year of Efficiency' looms", detail: "Sentiment bottoms. Within weeks Meta will pivot hard on costs, and the stock begins one of the great megacap recoveries off the lows.", tone: "bull" },
    ],
    keyMoments: [
      { atBar: 1, ideal: "cut", why: "The February DAU decline was a genuine thesis-breaker: 'unstoppable grower' was the thesis, and it just stopped. Cutting near $237 — the first loss — beat riding a consensus darling 60% lower out of loyalty and the disposition effect." },
      { atBar: 9, ideal: "buy", why: "By October the de-rating had overshot: ~9× earnings, huge net cash, despair everywhere. When a quality franchise is priced for death and expectations have reset to zero, that's the asymmetric entry — the mirror image of January's froth." },
    ],
    teachingPoint:
      "'Great company' and 'great stock from here' are different questions. At $311 Meta was priced for flawless growth; when the growth cracked, the de-rating was brutal — and the disposition effect (holding a loser to avoid realizing the loss) turned a thesis break into a ~70% drawdown. The same math cuts the other way: when expectations collapse to despair (≈9× earnings, net cash), the embedded bar is so low the asymmetry flips to the buyer.",
    idealPlay:
      "Honor the February invalidation and cut the consensus position when the growth story breaks — don't anchor to your $330 basis. Then, when the de-rating overshoots into October's capex-revolt bottom and the name is priced for disaster, that's the disciplined re-entry. The drill punishes loyally riding the whole de-rating down, and rewards both cutting on the thesis break and recognizing the priced-for-death bottom.",
    sourceUrl: "https://www.macrotrends.net/stocks/charts/META/meta-platforms/stock-price-history",
    sourceLabel: "Meta Platforms stock price history — Macrotrends (Feb 3 2022 −26%, a record one-day value loss; Oct 2022 low ~$88)",
    priceNote: "Month-end closes; the February bar reflects the post-earnings crash within the month. Nominal, as traded.",
  },
};

const THESIS_RATES_REGIME: PracticeDrill = {
  id: "th-rates-regime",
  kind: "thesis",
  title: "Trading the Regime",
  hook: "Rates are gravity. Position a book for the macro regime you actually believe in.",
  difficulty: "advanced",
  xp: drillXp("advanced"),
  tier: 3,
  conceptTags: ["Rates as gravity", "Four regimes", "Real returns", "Mechanism"],
  conceptLessonIds: ["mr-rates-gravity", "mr-four-regimes", "mr-inflation-real-returns", "mr-yield-curve"],
  thesis: {
    setup:
      "Forget single stocks for a moment. State your view on the macro regime over the next 6–12 months — growth and inflation, each rising or falling — and build the trade that expresses it. The discipline being tested: tie an asset-allocation or single-name bet explicitly to a rate/inflation mechanism, not a vibe. Which quadrant are we in, what does that do to discount rates, and what wins or loses because of it?",
    sections: [SECTION.variant, SECTION.pricedIn, SECTION.catalyst, SECTION.quality, SECTION.bearCase, SECTION.risk],
    whatGoodLooksLike:
      "A strong answer names the growth/inflation quadrant and the non-consensus part of that call, explains the mechanism (how the regime moves real rates and therefore long-duration valuations), identifies what the curve and breakevens already imply, picks the asset whose duration/sensitivity expresses it, and defines what data would prove the regime call wrong. The 'quality' section here is the macro mechanism, not a moat.",
  },
};

const THESIS_CONTRARIAN_BOTTOM: PracticeDrill = {
  id: "th-contrarian-bottom",
  kind: "thesis",
  title: "Blood in the Streets",
  hook: "Everyone is capitulating. Make the disciplined contrarian buy — with a catalyst, not a hunch.",
  difficulty: "advanced",
  xp: drillXp("advanced"),
  tier: 3,
  conceptTags: ["Sentiment extremes", "Herding", "Loss aversion", "Drawdown math"],
  conceptLessonIds: ["mr-sentiment-extremes", "bf-herding", "bf-loss-aversion", "rm-drawdown-math"],
  thesis: {
    setup:
      "A high-quality asset (an index, sector, or franchise you understand) has fallen 40%+ and sentiment is washed out — put/call ratios spiked, surveys deeply bearish, the financial press calling for more pain. Make the contrarian case to buy. The trap this drill targets: 'cheap and hated' is not a thesis. You need measurable sentiment extremes, a reason the fear is overdone, and a catalyst — because early without a catalyst is indistinguishable from wrong.",
    sections: [SECTION.variant, SECTION.pricedIn, SECTION.catalyst, SECTION.bearCase, SECTION.risk],
    whatGoodLooksLike:
      "A strong answer cites observable sentiment/positioning extremes (not just 'people are scared'), explains why the consensus fear is mispriced, names a specific catalyst and timeframe that resolves the extreme, makes an honest bear case with a level that says 'I'm wrong / it's a value trap,' and sizes for the fact that bottoms are a process — scaling in, not backing up the truck on day one.",
  },
};

// ── TIER 4 — THE ANALYST'S DESK ──────────────────────────────────────────────

const THESIS_SAAS_GROWTH: PracticeDrill = {
  id: "th-saas-growth",
  kind: "thesis",
  title: "Growth at What Price?",
  hook: "A hot software name. Prove the unit economics work before you pay the multiple.",
  difficulty: "advanced",
  xp: drillXp("advanced"),
  tier: 4,
  conceptTags: ["Unit economics", "Rule of 40", "What's priced in", "Operating leverage"],
  conceptLessonIds: ["fa-unit-economics", "fa-rule-of-40", "vq-reverse-dcf", "fa-operating-leverage"],
  thesis: {
    setup:
      "A fast-growing SaaS company trades at a rich revenue multiple on a compelling story. Build the long (or short) thesis grounded in the actual economics: is a single customer profitable, does the Rule-of-40 math hold, and what growth does the multiple already assume? The discipline: separate a great business from a great stock by interrogating LTV/CAC, retention, and the path to real free cash flow — not the TAM slide.",
    sections: [SECTION.variant, SECTION.pricedIn, SECTION.quality, SECTION.catalyst, SECTION.bearCase, SECTION.risk],
    whatGoodLooksLike:
      "A strong answer reasons about the unit economics (LTV/CAC, payback, net retention), checks the growth-vs-margin balance against the Rule of 40, reverse-engineers the growth the multiple is pricing in and judges whether it's plausible, and identifies where operating leverage turns growth into cash — or where cash burn never inflects. The bear case names a churn/CAC level that breaks it.",
  },
};

const THESIS_COMPOUNDER: PracticeDrill = {
  id: "th-compounder",
  kind: "thesis",
  title: "The Compounder",
  hook: "High returns on capital, a real moat, a long runway. Make the multi-year ownership case.",
  difficulty: "advanced",
  xp: drillXp("advanced"),
  tier: 4,
  conceptTags: ["ROIC & compounding", "Capital allocation", "Moats", "Owner earnings"],
  conceptLessonIds: ["vq-roic-compounding", "fa-capital-allocation", "vq-moats", "vq-owner-earnings"],
  thesis: {
    setup:
      "Forget the next quarter. Identify a business that earns high returns on capital and can reinvest them for years, and write the thesis for owning it through cycles. The discipline being tested is duration: the market chronically underprices how long a great business keeps compounding. Prove the moat is widening, the reinvestment runway is real, and management allocates capital well — and decide what valuation you'd actually pay for that durability.",
    sections: [SECTION.variant, SECTION.quality, SECTION.pricedIn, SECTION.bearCase, SECTION.risk],
    whatGoodLooksLike:
      "A strong answer shows the ROIC is high AND reinvestable (return × runway), evidences a widening moat rather than a current lead, judges management's capital allocation by its track record, checks that reported earnings convert to owner earnings, and is honest about the price — a wonderful business overpaid for is still a poor investment. The bear case is moat erosion or a reinvestment runway that's shorter than the market assumes.",
  },
};

const THESIS_FORENSIC_SHORT: PracticeDrill = {
  id: "th-forensic-short",
  kind: "thesis",
  title: "The Short Case",
  hook: "Earnings look too good. Build the forensic short — and respect the asymmetry.",
  difficulty: "mastery",
  xp: drillXp("mastery"),
  tier: 4,
  conceptTags: ["Forensic accounting", "Accruals vs cash", "Short selling", "Asymmetric risk"],
  conceptLessonIds: ["fa-forensic-scores", "fs-accruals", "mkt-short-selling", "vq-multiples"],
  thesis: {
    setup:
      "A company's reported earnings look pristine, but something is off — earnings outrunning cash flow, receivables ballooning, margins defying the industry, serial 'one-time' charges, or acquisitions blurring the organic trend. Build the short thesis. This drill is hard on purpose: shorting inverts the payoff (capped gain, unbounded loss), so you must make the forensic case AND respect borrow cost, squeeze risk, and timing — being right too early on a short can still ruin you.",
    sections: [SECTION.variant, SECTION.quality, SECTION.catalyst, SECTION.bearCase, SECTION.risk],
    whatGoodLooksLike:
      "A strong answer points to specific forensic red flags (the earnings-vs-cash gap, accrual quality, a stretched balance sheet) rather than 'it's expensive,' explains the mechanism by which reality catches up, names a catalyst that forces the re-rate (a refi, a covenant, an earnings miss), and — crucially — sizes for the asymmetric risk of a short with a hard plan for a squeeze. The 'bear case' here is the bull case that would squeeze you, and the invalidation that makes you cover.",
  },
};

// ── TIER 5 — MASTERY ─────────────────────────────────────────────────────────

const THESIS_RED_TEAM: PracticeDrill = {
  id: "th-red-team",
  kind: "thesis",
  title: "Red-Team Your Own Thesis",
  hook: "Take a position you actually hold — and try your hardest to destroy it.",
  difficulty: "mastery",
  xp: drillXp("mastery"),
  tier: 5,
  conceptTags: ["Confirmation bias", "Overconfidence", "Inversion", "Incentives"],
  conceptLessonIds: ["bf-confirmation", "bf-overconfidence", "mm-inversion", "mm-incentives"],
  thesis: {
    setup:
      "Pick a stock you currently own or genuinely want to buy — a view you're attached to. Now invert: your job is to write the most honest, most dangerous bear case against your own position, as if a rival PM were paid to take you apart. The discipline being tested is the hardest one in investing: defeating your own confirmation bias and overconfidence before the market does it for you.",
    sections: [SECTION.bearCase, SECTION.variant, SECTION.quality, SECTION.catalyst, SECTION.risk],
    whatGoodLooksLike:
      "A strong answer steelmans the other side — the bear case is genuinely threatening, not a strawman you can easily knock down. It surfaces the disconfirming evidence you'd normally filter out, checks whose incentives are shaping the bull narrative (including your own), states a specific, falsifiable level that would prove you wrong, and ends with an honest verdict: does the position survive its own red team, and at what size?",
  },
};

// ── Catalog ───────────────────────────────────────────────────────────────────

export const DRILLS: PracticeDrill[] = [
  // Tier 1 — Foundations
  COVID_CRASH,
  NVDA_RUN,
  // Tier 2 — Discipline
  SVB_COLLAPSE,
  GME_SQUEEZE,
  // Tier 3 — Cycles & Regimes
  GFC_2008,
  META_2022,
  THESIS_RATES_REGIME,
  THESIS_CONTRARIAN_BOTTOM,
  // Tier 4 — The Analyst's Desk
  THESIS_SAAS_GROWTH,
  THESIS_COMPOUNDER,
  THESIS_FORENSIC_SHORT,
  // Tier 5 — Mastery
  THESIS_PRICED_FOR_PERFECTION,
  THESIS_FALLEN_QUALITY,
  THESIS_RED_TEAM,
  THESIS_CAPSTONE,
];

export const TIERS: { tier: number; name: string; tagline: string }[] = [
  { tier: 1, name: "Foundations", tagline: "Survive a crash. Ride a trend. The two halves of staying in the game." },
  { tier: 2, name: "Discipline", tagline: "Cut the loser. Don't chase the mania. Where most accounts are won or lost." },
  { tier: 3, name: "Cycles & Regimes", tagline: "Trade the credit cycle, the de-rating, and the macro regime — not just single names." },
  { tier: 4, name: "The Analyst's Desk", tagline: "Underwrite a SaaS grower, a compounder, and a forensic short like a real analyst." },
  { tier: 5, name: "Mastery", tagline: "Write — and red-team — a thesis a portfolio manager would actually fund." },
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
