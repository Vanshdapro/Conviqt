// Track: Macro, Cycles & Reflexivity — markets as feedback loops, not machines
// that quietly revert to fair value.

import type { RawTrack } from "../types";

export const macroReflexivity: RawTrack = {
  id: "macro-reflexivity",
  name: "Macro, Cycles & Reflexivity",
  tagline: "Markets are not machines that revert to fair value. They are feedback loops.",
  emoji: "",
  accent: "var(--accent)",
  lessons: [
    {
      id: "mr-rates-gravity",
      title: "Rates Are Gravity",
      hook: "Interest rates are to asset prices what gravity is to matter.",
      difficulty: "core",
      subtitle: "Why the risk-free rate anchors every valuation and hits long-duration assets hardest.",
      figure: "rates-gravity",
      conceptCards: [
        {
          emoji: "",
          heading: "The discount-rate anchor",
          body: "Every asset is valued by discounting future cash flows, and that discount rate is anchored to the risk-free rate. When rates rise, the present value of all future cash flows falls — Buffett's point that rates act on prices like gravity acts on matter.",
        },
        {
          emoji: "",
          heading: "Duration applies to stocks",
          body: "Companies whose value sits far in the future behave like long-duration bonds: their present value is most sensitive to rate moves. That's why high-multiple growth stocks de-rate violently when long yields rise, even if the business is unchanged.",
        },
        {
          emoji: "",
          heading: "Same company, different worlds",
          body: "The identical set of future cash flows is worth more in a low-rate world and less in a high-rate world. The 10-year yield drives cross-asset behavior, so the rate regime is part of every valuation, not a side issue.",
        },
      ],
      keyTerms: [
        { term: "Risk-free rate", definition: "The yield on safe government debt; the anchor for all discount rates." },
        { term: "Discount rate", definition: "The required return used to convert future cash flows to present value." },
        { term: "Duration (equity)", definition: "Sensitivity of a stock's value to changes in the discount rate, driven by how far out its cash flows lie." },
        { term: "De-rating", definition: "A fall in a valuation multiple, often triggered by rising rates." },
      ],
      realWorldExample: {
        scenario:
          "When long-term interest rates jumped in 2022, the most expensive, longest-duration growth stocks fell far more than the broad market — not because their businesses deteriorated overnight, but because their distant cash flows were suddenly discounted more harshly.",
        ticker: "",
        lesson: "Rates are the gravitational constant of valuation. A change in the discount rate re-prices everything, growth most of all.",
      },
      quiz: [
        {
          question: "When interest rates rise, asset prices generally:",
          options: [
            "Rise, because growth improves",
            "Fall, because future cash flows are discounted more heavily",
            "Stay flat",
            "Become risk-free",
          ],
          answerIndex: 1,
          explanation: "A higher discount rate lowers the present value of future cash flows — rates act like gravity on prices.",
        },
        {
          question: "Long-duration growth stocks de-rate most on rate increases because:",
          options: [
            "They pay big dividends",
            "Most of their value is in distant cash flows, which are most rate-sensitive",
            "They have no earnings",
            "They are small caps",
          ],
          answerIndex: 1,
          explanation: "Cash flows far in the future are discounted the hardest when rates rise, so high-multiple names fall most.",
        },
        {
          question: "The same future cash flows are worth more when:",
          options: ["Rates are high", "Rates are low", "Volatility is high", "The dividend is cut"],
          answerIndex: 1,
          explanation: "Lower discount rates raise the present value of identical future cash flows.",
        },
      ],
      tryInChat: {
        label: "Trace the rate sensitivity",
        prompt: "Explain how a 1% rise in long-term rates would affect a high-growth stock I name versus a stable value stock",
      },
      takeaways: [
        "The risk-free rate anchors every discount rate and therefore every valuation.",
        "Long-duration growth stocks are the most rate-sensitive and de-rate hardest when yields rise.",
        "The same cash flows are worth different amounts in different rate regimes.",
      ],
    },
    {
      id: "mr-credit-cycle",
      title: "The Credit Cycle & Liquidity",
      hook: "Equities tell you the story; credit tells you the truth.",
      difficulty: "advanced",
      subtitle: "Why the availability and price of credit is the master cycle, and why spreads lead stocks.",
      figure: "credit-cycle",
      conceptCards: [
        {
          emoji: "",
          heading: "The master cycle",
          body: "Expansion, exuberance, contraction, repair — the credit cycle is driven by the availability and price of credit. Because nearly everything runs on financing, the credit cycle tends to lead and shape the equity and economic cycles.",
        },
        {
          emoji: "",
          heading: "Spreads lead price",
          body: "Credit spreads — the extra yield demanded over safe bonds — often widen before equities sell off, as lenders sense trouble first. Watching investment-grade and high-yield spreads can give an earlier read on risk than the stock tape.",
        },
        {
          emoji: "",
          heading: "Stability breeds instability",
          body: "Minsky's insight: calm, profitable periods encourage more borrowing and risk-taking, which quietly builds the leverage that makes the system fragile. The seeds of the bust are planted during the boom.",
        },
      ],
      keyTerms: [
        { term: "Credit cycle", definition: "The recurring expansion and contraction of credit availability and its price." },
        { term: "Credit spread", definition: "The extra yield over safe bonds that compensates for default risk." },
        { term: "High yield vs investment grade", definition: "Riskier (HY) versus safer (IG) corporate debt; HY spreads are especially sensitive." },
        { term: "Minsky moment", definition: "The point where built-up leverage tips a stable system into crisis." },
        { term: "Liquidity", definition: "The marginal lender's willingness to provide credit, which drives risk appetite." },
      ],
      realWorldExample: {
        scenario:
          "Ahead of major equity downturns, credit spreads have often started widening while stocks were still near highs, as bond investors priced in deteriorating conditions first. The credit market flashed warning before the equity market broke.",
        ticker: "",
        lesson: "Watch spreads, not just price. Credit markets frequently see the turn before equities do, because lenders feel the squeeze first.",
      },
      quiz: [
        {
          question: "Credit spreads often:",
          options: [
            "Lag equities badly",
            "Widen before equities sell off, acting as a leading indicator",
            "Never move",
            "Only matter for governments",
          ],
          answerIndex: 1,
          explanation: "Lenders tend to sense deteriorating conditions early, so widening spreads can precede equity weakness.",
        },
        {
          question: "The Minsky idea 'stability breeds instability' means:",
          options: [
            "Calm markets stay calm forever",
            "Calm, profitable periods encourage leverage that makes the system fragile",
            "Volatility is always high",
            "Credit is irrelevant",
          ],
          answerIndex: 1,
          explanation: "Good times invite more borrowing and risk-taking, building the fragility that later causes the bust.",
        },
        {
          question: "Why is the credit cycle often called the master cycle?",
          options: [
            "Bonds are bigger than stocks",
            "Nearly everything runs on financing, so credit conditions shape the broader economy and markets",
            "It's set by law",
            "It never changes",
          ],
          answerIndex: 1,
          explanation: "The availability and price of credit drive investment, risk appetite, and ultimately the equity and economic cycles.",
        },
      ],
      tryInChat: {
        label: "Read the credit signal",
        prompt: "Explain what current credit spreads suggest about where we are in the credit cycle",
      },
      takeaways: [
        "The credit cycle — availability and price of credit — tends to lead the equity cycle.",
        "Spreads often widen before stocks fall; watch credit as an early signal.",
        "Stability breeds instability: booms quietly build the leverage that causes busts.",
      ],
    },
    {
      id: "mr-reflexivity",
      title: "Reflexivity: Soros's Big Idea",
      hook: "Perceptions change fundamentals, which change perceptions.",
      difficulty: "advanced",
      subtitle: "How prices and fundamentals feed back on each other, creating booms and busts equilibrium models miss.",
      figure: "reflexivity",
      conceptCards: [
        {
          emoji: "",
          heading: "A two-way feedback loop",
          body: "Soros's reflexivity: prices don't merely reflect fundamentals, they help shape them. A rising stock lowers a company's cost of capital and funds the growth that then justifies the higher price — perception and reality reinforcing each other.",
        },
        {
          emoji: "",
          heading: "Self-reinforcing, then self-defeating",
          body: "The same loop that powers a boom eventually reverses: stretched valuations and over-investment sow the bust, and falling prices then damage the fundamentals that supported them. Reflexive trends overshoot in both directions.",
        },
        {
          emoji: "",
          heading: "Narratives become fundamentals",
          body: "When a story drives enough capital, it can change the underlying reality — funding, hiring, M&A — temporarily validating itself. Recognizing when a narrative is reflexively reshaping fundamentals is where the opportunity and the danger both live.",
        },
      ],
      keyTerms: [
        { term: "Reflexivity", definition: "The two-way feedback between market prices and the fundamentals they reflect." },
        { term: "Cost of capital", definition: "The return a company must offer to raise funds; lowered by a rising stock price." },
        { term: "Boom-bust", definition: "A self-reinforcing rise followed by a self-reinforcing collapse." },
        { term: "Overshoot", definition: "A price move that runs past fundamental value in either direction." },
      ],
      realWorldExample: {
        scenario:
          "In bubbles, soaring share prices let companies raise cheap capital and make acquisitions that briefly boosted reported growth — seeming to confirm the optimism — until the loop reversed and falling prices cut off the financing that had sustained it.",
        ticker: "",
        lesson: "Price can change fundamentals, not just reflect them. Reflexive loops explain the bubbles and crashes that efficient-market models can't.",
      },
      quiz: [
        {
          question: "Reflexivity holds that prices and fundamentals:",
          options: [
            "Are unrelated",
            "Influence each other in a two-way feedback loop",
            "Always equal fair value",
            "Move randomly",
          ],
          answerIndex: 1,
          explanation: "Soros argued prices both reflect and shape fundamentals, creating self-reinforcing dynamics.",
        },
        {
          question: "A rising stock price can improve fundamentals by:",
          options: [
            "Raising taxes",
            "Lowering the cost of capital, funding growth that justifies the price",
            "Reducing revenue",
            "Cutting the dividend",
          ],
          answerIndex: 1,
          explanation: "Cheaper capital from a higher price can fund real growth, feeding the reflexive loop.",
        },
        {
          question: "Reflexivity explains market behavior that efficient-market theory struggles with, namely:",
          options: [
            "Steady fair pricing",
            "Booms and busts that overshoot fundamentals",
            "Zero volatility",
            "Constant dividends",
          ],
          answerIndex: 1,
          explanation: "Self-reinforcing feedback produces the bubbles and crashes equilibrium models don't predict.",
        },
      ],
      tryInChat: {
        label: "Spot a reflexive loop",
        prompt: "Tell me whether a stock I name shows signs of a reflexive loop between its price and its fundamentals",
      },
      takeaways: [
        "Prices and fundamentals feed back on each other — reflexivity, not one-way reflection.",
        "The loop is self-reinforcing on the way up and self-defeating on the way down.",
        "Narratives can temporarily become fundamentals when they attract enough capital.",
      ],
    },
    {
      id: "mr-sentiment-extremes",
      title: "Sentiment Extremes & Contrarianism",
      hook: "Be greedy when others are fearful — but only at the actual extremes.",
      difficulty: "advanced",
      subtitle: "Disciplined contrarianism using measurable sentiment, not vibes — and why timing needs a catalyst.",
      figure: "sentiment",
      conceptCards: [
        {
          emoji: "",
          heading: "Measure sentiment, don't feel it",
          body: "Use observable gauges — put/call ratios, bull/bear surveys, volatility indexes, fund-manager cash levels, futures positioning — rather than a vague sense of the mood. Extremes in hard data are far more reliable than a hunch about the crowd.",
        },
        {
          emoji: "",
          heading: "Tops and bottoms have a shape",
          body: "Markets top on euphoria, when everyone is already long and there are no buyers left, and bottom on capitulation, when forced sellers are exhausted. The extreme of positioning, not the news, often marks the turn.",
        },
        {
          emoji: "",
          heading: "Early is indistinguishable from wrong",
          body: "A correct contrarian view with no catalyst and no risk control just bleeds. Contrarianism requires a reason the extreme will resolve and disciplined sizing — otherwise you're right too soon, which the market treats as being wrong.",
        },
      ],
      keyTerms: [
        { term: "Contrarianism", definition: "Positioning against the crowd at sentiment extremes, with discipline and a catalyst." },
        { term: "Put/call ratio", definition: "Volume of put options versus calls; a gauge of fear or complacency." },
        { term: "Capitulation", definition: "A wave of forced selling that often marks a bottom as sellers are exhausted." },
        { term: "Positioning", definition: "How much investors are already committed to one side of a trade." },
        { term: "AAII / sentiment surveys", definition: "Polls of bullish vs bearish investors used as contrarian indicators at extremes." },
      ],
      realWorldExample: {
        scenario:
          "Major market bottoms have often coincided with extreme readings — very high put/call ratios, deeply bearish surveys, elevated cash levels — signaling that selling was exhausted. Tops formed at mirror-image euphoria when nearly everyone was already invested.",
        ticker: "",
        lesson: "Extremes in measurable positioning, paired with a catalyst, are the contrarian's signal. A strong opinion against the crowd, alone, is not.",
      },
      quiz: [
        {
          question: "Disciplined contrarianism relies on:",
          options: [
            "A gut feeling about the mood",
            "Measurable sentiment extremes plus a catalyst and risk control",
            "Always buying the most popular stock",
            "Ignoring positioning",
          ],
          answerIndex: 1,
          explanation: "Hard sentiment data at extremes, with a reason it will resolve, beats vibes and lone conviction.",
        },
        {
          question: "Markets tend to top when:",
          options: [
            "Everyone is fearful",
            "Everyone is already long and there are no buyers left (euphoria)",
            "Cash levels are high",
            "Put/call ratios spike",
          ],
          answerIndex: 1,
          explanation: "Euphoric, fully invested positioning leaves no marginal buyer — a classic topping condition.",
        },
        {
          question: "Why is 'early' often the same as 'wrong' for a contrarian?",
          options: [
            "Being early guarantees profit",
            "Without a catalyst and risk control, a correct-but-early view just loses money",
            "Markets reward patience automatically",
            "Sentiment never matters",
          ],
          answerIndex: 1,
          explanation: "A right view with no catalyst and no sizing discipline bleeds before it's vindicated, if it ever is.",
        },
      ],
      tryInChat: {
        label: "Gauge the extreme",
        prompt: "Assess whether current sentiment indicators point to a contrarian opportunity, and what catalyst would be needed",
      },
      takeaways: [
        "Use measurable sentiment gauges, not vibes, to spot true extremes.",
        "Tops form on euphoria with no buyers left; bottoms on exhausted capitulation.",
        "Contrarianism needs a catalyst and risk control — early without them is just wrong.",
      ],
    },
    {
      id: "mr-inflation-real-returns",
      title: "Inflation & Real Returns",
      hook: "The number on your statement is a lie until you subtract inflation.",
      difficulty: "core",
      subtitle: "Why purchasing power, not nominal gains, is what actually compounds — and what inflation does to asset prices.",
      figure: "inflation",
      widget: {
        type: "inflation_real_return",
        title: "Strip out inflation",
        prompt: "Set a nominal return against inflation over time and watch the gap between the headline number and what your money can actually buy.",
        params: { nominalReturnPct: 7, inflationPct: 3, years: 25, startingAmount: 10000 },
      },
      conceptCards: [
        {
          emoji: "",
          heading: "Real return is what counts",
          body: "Real return is the nominal return minus inflation — what your money can actually buy afterward. A 7% gain in a 3% inflation world is roughly 4% real. Over decades, inflation quietly halves the purchasing power of money that doesn't out-earn it.",
        },
        {
          emoji: "",
          heading: "Inflation reprices assets unevenly",
          body: "Inflation and the rate response hit assets differently: long-duration bonds and richly-valued growth stocks suffer as discount rates rise, while pricing-power businesses, real assets, and commodities can hold up. The inflation regime reshuffles which assets win.",
        },
        {
          emoji: "",
          heading: "Who has pricing power survives",
          body: "Companies that can raise prices faster than their costs protect real margins through inflation; those that can't see margins compress. The key question in an inflationary regime is simple: can this business pass rising costs on to customers?",
        },
      ],
      keyTerms: [
        { term: "Nominal vs real return", definition: "Nominal is the headline gain; real subtracts inflation to show purchasing power." },
        { term: "Purchasing power", definition: "What a unit of money can actually buy, eroded by inflation." },
        { term: "Pricing power", definition: "The ability to raise prices with costs, protecting real margins in inflation." },
        { term: "Real assets", definition: "Tangible assets (commodities, property, infrastructure) that can track inflation." },
        { term: "Money illusion", definition: "Mistaking nominal gains for real ones by ignoring inflation." },
      ],
      realWorldExample: {
        scenario:
          "In the high-inflation 1970s, nominal stock returns looked positive while real returns were dismal — investors felt richer in dollars but poorer in what those dollars bought. Businesses with genuine pricing power fared far better than those that couldn't raise prices.",
        ticker: "",
        lesson: "Always think in real terms. Inflation is a silent tax that rewards pricing power and real assets and punishes long-duration, fixed-income-like exposures.",
      },
      quiz: [
        {
          question: "Real return is:",
          options: [
            "Nominal return plus inflation",
            "Nominal return minus inflation",
            "The dividend yield",
            "The same as nominal return",
          ],
          answerIndex: 1,
          explanation: "Subtracting inflation from the nominal return shows the true change in purchasing power.",
        },
        {
          question: "In an inflationary regime, which tends to suffer most?",
          options: [
            "Pricing-power businesses",
            "Long-duration bonds and richly-valued growth stocks",
            "Commodities",
            "Real assets",
          ],
          answerIndex: 1,
          explanation: "Rising rates from inflation hit long-duration cash flows and fixed coupons hardest.",
        },
        {
          question: "'Money illusion' is the error of:",
          options: [
            "Counting inflation twice",
            "Mistaking nominal gains for real ones by ignoring inflation",
            "Using real returns",
            "Holding commodities",
          ],
          answerIndex: 1,
          explanation: "Feeling richer from nominal gains while purchasing power stagnates is money illusion.",
        },
      ],
      tryInChat: {
        label: "Check the real return",
        prompt: "Tell me how inflation would affect the real return of a stock or portfolio I name, and whether it has pricing power",
      },
      takeaways: [
        "Real return = nominal minus inflation; purchasing power is what compounds.",
        "Inflation reprices assets unevenly — long-duration and fixed-income exposures suffer most.",
        "Pricing power and real assets are the defense; always think in real terms.",
      ],
    },
    {
      id: "mr-yield-curve",
      title: "The Yield Curve",
      hook: "When short rates rise above long rates, the bond market is forecasting trouble.",
      difficulty: "advanced",
      subtitle: "Reading the shape of the yield curve and why its inversion has preceded most recessions.",
      figure: "yield-curve",
      conceptCards: [
        {
          emoji: "",
          heading: "The curve is a map of rates over time",
          body: "The yield curve plots government bond yields from short to long maturities. Normally it slopes upward — longer commitments demand more yield. Its shape encodes the market's collective expectation for growth, inflation, and the path of central-bank policy.",
        },
        {
          emoji: "",
          heading: "Inversion as a warning",
          body: "When short-term yields exceed long-term yields, the curve inverts — the market expecting rate cuts ahead, usually because it foresees a slowdown. An inverted curve has preceded most recessions, though with long and variable lags that make timing treacherous.",
        },
        {
          emoji: "",
          heading: "Why it matters beyond bonds",
          body: "The curve shapes bank lending (banks borrow short, lend long), discount rates for every asset, and risk appetite. Steepening and flattening signal shifting expectations, but the signal is probabilistic — a warning to raise your guard, not a precise timing tool.",
        },
      ],
      keyTerms: [
        { term: "Yield curve", definition: "A plot of government bond yields across maturities, from short to long." },
        { term: "Inversion", definition: "When short-term yields rise above long-term yields, often a recession signal." },
        { term: "Term premium", definition: "Extra yield demanded for the risk of holding longer-maturity bonds." },
        { term: "Steepening / flattening", definition: "Changes in the gap between short and long yields, reflecting shifting expectations." },
        { term: "2s10s spread", definition: "The yield difference between 2-year and 10-year Treasuries, a watched curve measure." },
      ],
      realWorldExample: {
        scenario:
          "Before several past recessions, the 2-year Treasury yield rose above the 10-year — an inverted curve — while equities were still near highs. The signal was real but early; downturns followed only after long and variable lags.",
        ticker: "",
        lesson: "An inverted curve is a credible warning that the bond market expects a slowdown — but its lag is long and uncertain, so treat it as a reason for caution, not a timing trigger.",
      },
      quiz: [
        {
          question: "A normal yield curve slopes:",
          options: [
            "Downward — short yields above long",
            "Upward — longer maturities yield more",
            "Flat at all maturities",
            "Randomly",
          ],
          answerIndex: 1,
          explanation: "Longer commitments normally demand higher yields, producing an upward-sloping curve.",
        },
        {
          question: "An inverted yield curve has historically:",
          options: [
            "Guaranteed an immediate crash",
            "Preceded most recessions, but with long and variable lags",
            "Signaled nothing",
            "Predicted bull markets",
          ],
          answerIndex: 1,
          explanation: "Inversion is a credible recession warning, though the timing lag makes it imprecise.",
        },
        {
          question: "Inversion reflects the market expecting:",
          options: [
            "Higher rates forever",
            "Rate cuts ahead, often due to an anticipated slowdown",
            "No change in policy",
            "Rising inflation only",
          ],
          answerIndex: 1,
          explanation: "Long yields below short yields imply the market is pricing future cuts amid expected weakness.",
        },
      ],
      tryInChat: {
        label: "Read the curve",
        prompt: "Explain what the current shape of the yield curve implies about growth and recession risk",
      },
      takeaways: [
        "The yield curve encodes market expectations for growth, inflation, and policy.",
        "Inversion (short above long) has preceded most recessions — with long, variable lags.",
        "Treat it as a probabilistic warning to raise caution, not a precise timing tool.",
      ],
    },
    {
      id: "mr-business-cycle",
      title: "The Business Cycle & Rotation",
      hook: "Different sectors lead at different points in the cycle.",
      difficulty: "advanced",
      subtitle: "How the economy moves through phases and why market leadership rotates across them.",
      figure: "business-cycle",
      conceptCards: [
        {
          emoji: "",
          heading: "Four broad phases",
          body: "Economies cycle through early recovery, mid-cycle expansion, late-cycle overheating, and recession. Each phase carries a characteristic mix of growth, inflation, and policy — and the market tends to anticipate the next phase before it arrives in the data.",
        },
        {
          emoji: "",
          heading: "Leadership rotates",
          body: "Different sectors tend to lead in different phases: rate-sensitive and cyclical names in early recovery, industrials and materials mid-cycle, energy and staples late-cycle, defensives and quality in downturns. Sector rotation is the market repositioning for the phase ahead.",
        },
        {
          emoji: "",
          heading: "Easier to see than to time",
          body: "The cycle is real but irregular — phases vary in length and intensity, and policy can extend or cut them short. Rotation patterns are clearer in hindsight than in real time, so use the framework to understand exposures, not to make precise market-timing calls.",
        },
      ],
      keyTerms: [
        { term: "Business cycle", definition: "The economy's recurring movement through expansion and contraction phases." },
        { term: "Sector rotation", definition: "The shift of market leadership across sectors as the cycle progresses." },
        { term: "Cyclical vs defensive", definition: "Cyclicals swing with the economy; defensives (staples, utilities) hold up in downturns." },
        { term: "Late cycle", definition: "The overheating phase of tight labor, rising inflation, and peaking growth." },
        { term: "Leading indicators", definition: "Data (new orders, building permits, the curve) that tend to turn before the economy." },
      ],
      realWorldExample: {
        scenario:
          "Coming out of recessions, rate-sensitive and cyclical sectors have often led as conditions improved, while defensives and quality outperformed heading into slowdowns. The rotation tracked the cycle — though the exact turns were obvious mainly in hindsight.",
        ticker: "",
        lesson: "Use the cycle to understand which exposures are favored when, but respect that timing the turns precisely is far harder than the tidy diagram suggests.",
      },
      quiz: [
        {
          question: "Sector rotation describes:",
          options: [
            "Companies changing their logos",
            "Market leadership shifting across sectors as the business cycle progresses",
            "Rotating board members",
            "Daily price noise",
          ],
          answerIndex: 1,
          explanation: "As the cycle moves through phases, different sectors tend to lead, which is sector rotation.",
        },
        {
          question: "Defensive sectors (staples, utilities) tend to outperform:",
          options: [
            "In early recovery",
            "Heading into and during downturns",
            "Only in bull markets",
            "Never",
          ],
          answerIndex: 1,
          explanation: "Defensives hold up better when growth slows, as their demand is more stable.",
        },
        {
          question: "A realistic view of the business cycle is that it's:",
          options: [
            "Perfectly regular and easy to time",
            "Real but irregular, with turns clearer in hindsight than in real time",
            "A myth",
            "Identical every time",
          ],
          answerIndex: 1,
          explanation: "Phases vary in length and intensity, so precise timing is far harder than the framework implies.",
        },
      ],
      tryInChat: {
        label: "Locate the cycle",
        prompt: "Explain where we might be in the business cycle and which sectors that phase tends to favor",
      },
      takeaways: [
        "The economy moves through recovery, expansion, late-cycle, and recession phases.",
        "Sector leadership rotates — cyclicals early, defensives into downturns.",
        "Use the framework for exposure, not precise timing; the turns are clear mainly in hindsight.",
      ],
    },
    {
      id: "mr-four-regimes",
      title: "The Four Macro Regimes",
      hook: "Growth and inflation, each up or down — four worlds, four sets of winners.",
      difficulty: "mastery",
      subtitle: "A simple two-by-two for thinking about what drives assets, and why 'diversified' depends on the regime.",
      figure: "four-regimes",
      conceptCards: [
        {
          emoji: "",
          heading: "Two variables, four quadrants",
          body: "Most asset behavior can be framed by two macro forces: growth (rising or falling) and inflation (rising or falling). The four combinations create four regimes, and different assets are built to win in each — there's no single portfolio that's optimal across all of them.",
        },
        {
          emoji: "",
          heading: "Different winners in each",
          body: "Roughly: rising growth favors equities; rising inflation favors commodities and real assets; falling growth favors long bonds and quality; falling inflation favors long bonds and growth stocks. The 'all-weather' idea is to balance exposure so no single regime can wreck you.",
        },
        {
          emoji: "",
          heading: "Why 'diversified' is regime-dependent",
          body: "A portfolio that looks diversified can actually be one big bet on a single regime — say, falling rates and rising growth. True macro diversification means holding assets that win in different quadrants, so the portfolio is robust to which regime actually shows up.",
        },
      ],
      keyTerms: [
        { term: "Macro regime", definition: "An environment defined by the direction of growth and inflation." },
        { term: "All-weather", definition: "A portfolio balanced to perform acceptably across macro regimes." },
        { term: "Real assets", definition: "Commodities, property, and infrastructure that tend to track inflation." },
        { term: "Regime bet", definition: "A portfolio implicitly positioned for one growth/inflation outcome." },
        { term: "Growth vs inflation shock", definition: "An unexpected change in growth or inflation that reprices assets." },
      ],
      realWorldExample: {
        scenario:
          "A portfolio of long-duration growth stocks and long bonds quietly bet on one regime — falling inflation and steady growth. When inflation surged instead, both legs fell together, exposing that the 'diversification' had been a single concentrated macro bet all along.",
        ticker: "",
        lesson: "Map your holdings to the four regimes. Genuine macro diversification means owning things that win in different quadrants, so no single regime can sink you.",
      },
      quiz: [
        {
          question: "The four macro regimes are defined by the direction of:",
          options: [
            "Interest rates and dividends",
            "Growth and inflation, each rising or falling",
            "Stocks and bonds",
            "Volatility and volume",
          ],
          answerIndex: 1,
          explanation: "Growth up/down and inflation up/down create the two-by-two of four regimes.",
        },
        {
          question: "Rising inflation tends to favor:",
          options: [
            "Long-duration bonds",
            "Commodities and real assets",
            "Cash only",
            "Growth stocks",
          ],
          answerIndex: 1,
          explanation: "Real assets and commodities tend to hold value when inflation rises, unlike long bonds.",
        },
        {
          question: "A portfolio can be falsely 'diversified' when it:",
          options: [
            "Owns assets that win in different regimes",
            "Is actually one concentrated bet on a single growth/inflation regime",
            "Holds cash",
            "Rebalances often",
          ],
          answerIndex: 1,
          explanation: "If all holdings win in the same regime, the portfolio is a single macro bet despite appearing diversified.",
        },
      ],
      tryInChat: {
        label: "Map the regimes",
        prompt: "Help me map a portfolio I describe to the four macro regimes and find which regime it's secretly betting on",
      },
      takeaways: [
        "Growth and inflation, each up or down, define four macro regimes with different winners.",
        "All-weather thinking balances exposure so no single regime can wreck you.",
        "Real diversification is owning assets that win in different quadrants — check your hidden regime bet.",
      ],
    },
  ],
};
