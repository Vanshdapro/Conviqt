// Track: Macro, Cycles & Reflexivity — markets as feedback loops, not machines
// that quietly revert to fair value.

import type { RawTrack } from "../types";

export const macroReflexivity: RawTrack = {
  id: "macro-reflexivity",
  name: "Macro, Cycles & Reflexivity",
  tagline: "Markets are not machines that revert to fair value. They are feedback loops.",
  emoji: "",
  accent: "#a78bfa",
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
  ],
};
