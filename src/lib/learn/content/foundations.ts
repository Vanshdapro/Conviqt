// Track: Markets & Investing Foundations — the on-ramp. The few ideas every
// investor needs before the jargon: compounding, risk and return, diversification,
// dollar-cost averaging, index vs active, and living below your means. Static,
// hand-authored content (no model call at open).

import type { RawTrack } from "../types";

export const foundations: RawTrack = {
  id: "foundations",
  name: "Markets & Investing Foundations",
  tagline: "Start here: how investing actually works, before the jargon.",
  emoji: "",
  accent: "#fbbf24",
  lessons: [
    {
      id: "found-compounding",
      title: "The Magic of Compounding",
      hook: "The most powerful force in finance is also the most patient.",
      difficulty: "core",
      subtitle: "Why earning returns on your returns turns small, regular saving into life-changing sums over time.",
      widget: {
        type: "compound_interest",
        title: "Watch a small habit compound",
        prompt: "Set a starting amount, a monthly contribution, and a return rate — then drag the years and watch growth dwarf what you put in.",
        params: { principal: 1000, monthlyContribution: 200, years: 30, annualRatePct: 8 },
      },
      conceptCards: [
        {
          emoji: "",
          heading: "Returns on your returns",
          body: "Compounding means your gains start generating their own gains. Year one earns on your savings; year two earns on your savings plus year one's growth. That recursion is slow at first and then accelerates dramatically — most of the wealth arrives in the final years.",
        },
        {
          emoji: "",
          heading: "Time is the biggest lever",
          body: "Because growth compounds on itself, time matters more than the amount. Starting ten years earlier can beat saving twice as much later. The investor's greatest, non-renewable advantage is simply how long their money is allowed to compound.",
        },
        {
          emoji: "",
          heading: "The rule of 72",
          body: "A quick mental shortcut: divide 72 by your annual return to estimate the years it takes money to double. At 8%, money doubles roughly every 9 years. It makes the power of small rate differences and long horizons tangible.",
        },
      ],
      keyTerms: [
        { term: "Compounding", definition: "Earning returns on both your original capital and prior returns." },
        { term: "Compound annual growth rate (CAGR)", definition: "The smoothed yearly rate at which an investment grows over time." },
        { term: "Rule of 72", definition: "72 ÷ annual return ≈ the number of years for money to double." },
        { term: "Time horizon", definition: "How long money stays invested — the most powerful lever in compounding." },
        { term: "Contribution", definition: "Money you add regularly, which compounds alongside your returns." },
      ],
      realWorldExample: {
        scenario:
          "Two savers each invest the same monthly amount, but one starts at 25 and the other at 35. With a decade's head start, the early saver ends up with far more by retirement — despite contributing only ten extra years — because that early money compounds the longest.",
        ticker: "",
        lesson: "Time in the market beats the size of contributions. Starting early is the single highest-return decision most investors ever make.",
      },
      quiz: [
        {
          question: "Compounding refers to:",
          options: [
            "Earning a fixed amount each year",
            "Earning returns on both your capital and your prior returns",
            "Adding money monthly",
            "Avoiding all risk",
          ],
          answerIndex: 1,
          explanation: "Compounding is the recursion of gains generating their own gains, which accelerates over time.",
        },
        {
          question: "Using the rule of 72, an 8% return doubles money in about:",
          options: ["3 years", "9 years", "20 years", "72 years"],
          answerIndex: 1,
          explanation: "72 ÷ 8 = 9, so money roughly doubles every nine years at an 8% return.",
        },
        {
          question: "The most powerful lever in compounding is usually:",
          options: [
            "Picking the hottest stock",
            "Time — how long the money compounds",
            "Checking prices daily",
            "Using leverage",
          ],
          answerIndex: 1,
          explanation: "Because growth compounds on itself, a longer horizon often beats larger contributions.",
        },
      ],
      tryInChat: {
        label: "See compounding on a real stock",
        prompt: "Show me how a steady monthly investment in a broad index would have compounded over the past 20 years",
      },
      takeaways: [
        "Compounding earns returns on your returns — slow at first, then dramatic.",
        "Time is the biggest lever; starting early beats saving more later.",
        "Use the rule of 72 (72 ÷ return) to estimate doubling time.",
      ],
    },
    {
      id: "found-risk-return",
      title: "Risk and Return",
      hook: "There is no return without risk — only risk disguised as safety.",
      difficulty: "core",
      subtitle: "Why higher expected returns demand more risk, and how to think about the trade-off honestly.",
      figure: "risk-ladder",
      conceptCards: [
        {
          emoji: "",
          heading: "The fundamental trade-off",
          body: "Assets are priced so that higher expected returns come bundled with more risk — cash is safe and low-yielding, stocks are volatile and higher-returning. There is no free lunch: anything promising high returns with no risk is either mispriced, misunderstood, or a fraud.",
        },
        {
          emoji: "",
          heading: "Match risk to your horizon",
          body: "Risk you can ride out over decades is different from risk you face next year. A long horizon lets you accept short-term volatility for higher expected return; money you need soon belongs in safer assets. The right risk level depends on when you'll need the money.",
        },
        {
          emoji: "",
          heading: "Cash isn't risk-free either",
          body: "Holding only cash feels safe but quietly loses purchasing power to inflation. 'Safe' assets carry the risk of falling behind; 'risky' assets carry the risk of volatility. The goal isn't to avoid risk but to take the risks you're paid to take.",
        },
      ],
      keyTerms: [
        { term: "Expected return", definition: "The return you can reasonably anticipate on average, not a guarantee." },
        { term: "Risk", definition: "The chance of an outcome worse than expected; usually paired with higher return." },
        { term: "Risk tolerance", definition: "How much volatility and potential loss you can accept, financially and emotionally." },
        { term: "Time horizon", definition: "When you'll need the money, which shapes how much risk is appropriate." },
        { term: "Inflation risk", definition: "The danger that 'safe' assets lose purchasing power over time." },
      ],
      realWorldExample: {
        scenario:
          "Over long periods, stocks have delivered higher returns than bonds, which beat cash — but with bigger swings along the way. An investor who needed the money in a year and put it in stocks risked a downturn; one investing for 30 years was paid for enduring the volatility.",
        ticker: "",
        lesson: "Return is the reward for bearing risk. Choose a risk level that matches your time horizon, not your mood on a given day.",
      },
      quiz: [
        {
          question: "Higher expected returns generally require:",
          options: [
            "No risk at all",
            "Taking on more risk",
            "Insider information",
            "Frequent trading",
          ],
          answerIndex: 1,
          explanation: "Markets price assets so that higher expected return comes bundled with more risk — there's no free lunch.",
        },
        {
          question: "The appropriate level of risk depends most on:",
          options: [
            "The latest headline",
            "Your time horizon and risk tolerance",
            "The stock with the best story",
            "What your neighbor owns",
          ],
          answerIndex: 1,
          explanation: "A longer horizon can absorb more volatility; money needed soon belongs in safer assets.",
        },
        {
          question: "Holding only cash carries the risk of:",
          options: [
            "Too much volatility",
            "Losing purchasing power to inflation over time",
            "Excessive returns",
            "No risk whatsoever",
          ],
          answerIndex: 1,
          explanation: "Cash feels safe but quietly erodes in real terms when inflation outpaces its yield.",
        },
      ],
      tryInChat: {
        label: "Compare risk and return",
        prompt: "Compare the historical risk and return of stocks, bonds, and cash and explain the trade-off",
      },
      takeaways: [
        "Higher expected return comes bundled with higher risk — no free lunch.",
        "Match your risk level to your time horizon, not your mood.",
        "Cash isn't truly safe; it risks losing purchasing power to inflation.",
      ],
    },
    {
      id: "found-diversification",
      title: "Don't Bet It All on One",
      hook: "The only free lunch in investing is not putting all your eggs in one basket.",
      difficulty: "core",
      subtitle: "How spreading across many holdings reduces risk without giving up expected return.",
      widget: {
        type: "diversification",
        title: "Add holdings, lower the swings",
        prompt: "Increase the number of companies you own and watch how much the portfolio's wild swings calm down.",
        params: { holdings: 4 },
      },
      conceptCards: [
        {
          emoji: "",
          heading: "One stock is a single point of failure",
          body: "Owning one company ties your whole financial future to its specific fate — a fraud, a failed product, a single bad quarter. Spreading across many companies means no single disaster can sink you, while you still capture the market's overall growth.",
        },
        {
          emoji: "",
          heading: "Risk falls faster than return",
          body: "Combining holdings that don't all move together reduces the portfolio's swings without reducing its expected return — the closest thing to a free lunch in finance. Much of the benefit arrives within the first handful of well-chosen, different holdings.",
        },
        {
          emoji: "",
          heading: "The simplest version: an index fund",
          body: "A broad index fund is instant diversification — owning hundreds or thousands of companies in one cheap purchase. For most people, it's the most reliable way to capture market returns without betting the outcome on any single name.",
        },
      ],
      keyTerms: [
        { term: "Diversification", definition: "Spreading investments across many holdings to reduce single-name risk." },
        { term: "Idiosyncratic risk", definition: "Company-specific risk that diversification can largely remove." },
        { term: "Systematic risk", definition: "Market-wide risk that diversification cannot eliminate." },
        { term: "Index fund", definition: "A fund holding a broad basket of stocks, providing instant diversification cheaply." },
        { term: "Correlation", definition: "How closely holdings move together; lower correlation diversifies better." },
      ],
      realWorldExample: {
        scenario:
          "An employee with their entire savings in their own company's stock can lose their job and their nest egg at once if the company fails — a risk that has wiped out real people. A diversified investor who held the same company as one of hundreds barely noticed.",
        ticker: "",
        lesson: "Concentration in a single name is a hidden, avoidable risk. Diversification removes the danger that one company's fate decides yours.",
      },
      quiz: [
        {
          question: "Diversification reduces risk by:",
          options: [
            "Guaranteeing gains",
            "Spreading across holdings so no single one can sink the portfolio",
            "Eliminating all market risk",
            "Concentrating in one winner",
          ],
          answerIndex: 1,
          explanation: "Owning many different holdings removes company-specific risk while keeping expected return.",
        },
        {
          question: "Diversification is called a 'free lunch' because it:",
          options: [
            "Raises return with no risk",
            "Lowers risk without lowering expected return",
            "Costs nothing in fees",
            "Removes all losses",
          ],
          answerIndex: 1,
          explanation: "Combining holdings that don't move in lockstep cuts volatility while preserving expected return.",
        },
        {
          question: "The risk diversification cannot remove is:",
          options: [
            "Company-specific risk",
            "Broad market (systematic) risk",
            "Single-stock fraud",
            "A product recall at one firm",
          ],
          answerIndex: 1,
          explanation: "Market-wide moves affect everything; diversification removes idiosyncratic, not systematic, risk.",
        },
      ],
      tryInChat: {
        label: "Check a portfolio's spread",
        prompt: "Tell me whether a list of stocks I own is well diversified or concentrated in one type of bet",
      },
      takeaways: [
        "One stock is a single point of failure; spreading out removes that danger.",
        "Diversification lowers risk without sacrificing expected return.",
        "A broad index fund is instant, cheap diversification for most people.",
      ],
    },
    {
      id: "found-dca",
      title: "Dollar-Cost Averaging",
      hook: "Invest the same amount on a schedule and stop trying to time the market.",
      difficulty: "core",
      subtitle: "Why investing a fixed amount regularly removes timing stress and smooths your average price.",
      widget: {
        type: "dollar_cost_averaging",
        title: "Drip-feed through the dips",
        prompt: "Invest a fixed amount each month across a choppy market and see how your average cost falls as you buy more shares when prices dip.",
        params: { monthlyAmount: 200, months: 24 },
      },
      conceptCards: [
        {
          emoji: "",
          heading: "Fixed amount, fixed schedule",
          body: "Dollar-cost averaging means investing the same amount at regular intervals — say monthly — regardless of price. When prices are low your fixed amount buys more shares; when high, fewer. Mechanically, this lowers your average cost per share over a choppy market.",
        },
        {
          emoji: "",
          heading: "It removes the timing trap",
          body: "Trying to buy at the perfect moment is a losing game even for professionals. Automating regular contributions takes emotion and timing out of the decision, so you keep investing through downturns — exactly when the best long-term buys appear.",
        },
        {
          emoji: "",
          heading: "Behavior over optimization",
          body: "Investing a lump sum immediately often wins on average, since markets rise over time. But dollar-cost averaging wins where it matters most for real people: it's a habit you'll actually stick to, and it keeps you buying when fear would otherwise stop you.",
        },
      ],
      keyTerms: [
        { term: "Dollar-cost averaging (DCA)", definition: "Investing a fixed amount at regular intervals regardless of price." },
        { term: "Average cost", definition: "Your blended purchase price across all the shares you've bought." },
        { term: "Market timing", definition: "Trying to buy and sell at the best moments — notoriously hard to do consistently." },
        { term: "Automation", definition: "Setting contributions to happen automatically, removing emotion from the decision." },
        { term: "Lump-sum investing", definition: "Investing all available money at once; often wins on average but is harder to stick to." },
      ],
      realWorldExample: {
        scenario:
          "An investor who automatically put a fixed sum into an index fund every month through a volatile stretch kept buying during the scary dips — accumulating more shares cheaply — while a neighbor who waited for the 'right time' never bought at all.",
        ticker: "",
        lesson: "The biggest danger isn't buying at the wrong time; it's not investing at all. DCA turns investing into an automatic habit that survives fear.",
      },
      quiz: [
        {
          question: "Dollar-cost averaging means investing:",
          options: [
            "A different amount based on your mood",
            "A fixed amount at regular intervals regardless of price",
            "Everything at the market bottom",
            "Only when prices rise",
          ],
          answerIndex: 1,
          explanation: "DCA invests the same amount on a schedule, buying more shares when prices are low and fewer when high.",
        },
        {
          question: "A key behavioral benefit of DCA is that it:",
          options: [
            "Guarantees the highest return",
            "Removes timing decisions and keeps you investing through downturns",
            "Eliminates all risk",
            "Requires perfect forecasts",
          ],
          answerIndex: 1,
          explanation: "Automating contributions takes emotion out and keeps you buying when fear would otherwise stop you.",
        },
        {
          question: "Compared to investing a lump sum, DCA:",
          options: [
            "Always earns more",
            "Often trails on average but is easier to stick to and reduces regret",
            "Is illegal",
            "Avoids the market entirely",
          ],
          answerIndex: 1,
          explanation: "Lump sums win on average since markets rise, but DCA's real edge is being a habit people actually follow.",
        },
      ],
      tryInChat: {
        label: "Model a DCA plan",
        prompt: "Show me how dollar-cost averaging into an index fund would have worked over a recent volatile period",
      },
      takeaways: [
        "DCA invests a fixed amount on a schedule, lowering average cost in choppy markets.",
        "It removes the timing trap and keeps you buying through downturns.",
        "Its real power is behavioral: a habit you'll actually stick to.",
      ],
    },
    {
      id: "found-index-vs-active",
      title: "Index Funds vs Picking Stocks",
      hook: "Most professionals can't beat the index. The fees are why.",
      difficulty: "core",
      subtitle: "Why low-cost index funds are the sensible default, and when active stock-picking can make sense.",
      figure: "index-vs-active",
      conceptCards: [
        {
          emoji: "",
          heading: "The market is hard to beat",
          body: "Over long periods, the majority of active funds underperform a simple index after fees. The market price already reflects the collective wisdom of millions of participants, so consistently outsmarting it — net of costs — is genuinely difficult, even for professionals.",
        },
        {
          emoji: "",
          heading: "Fees compound against you",
          body: "A 1% annual fee sounds small but compounds into a large drag over decades, quietly transferring a big share of your returns to the manager. Index funds charge a tiny fraction of that, and the cost difference alone explains much of their long-run edge.",
        },
        {
          emoji: "",
          heading: "When active makes sense",
          body: "Stock-picking can add value if you have a genuine, defensible edge — deep knowledge, a longer horizon, or a temperament that exploits others' mistakes. For most people, a low-cost index core with a small active sleeve to learn and apply skill is a sensible balance.",
        },
      ],
      keyTerms: [
        { term: "Index fund", definition: "A fund that tracks a market index, holding its components at very low cost." },
        { term: "Active management", definition: "Selecting investments to try to beat the market, usually at higher fees." },
        { term: "Expense ratio", definition: "The annual fee a fund charges, expressed as a percentage of assets." },
        { term: "Passive investing", definition: "Owning the whole market via an index rather than picking winners." },
        { term: "Fee drag", definition: "The cumulative reduction in returns caused by ongoing fees." },
      ],
      realWorldExample: {
        scenario:
          "Over a typical decade, a large majority of actively managed funds trailed their benchmark index once fees were counted. The low-cost index quietly outperformed most of the experts trying to beat it — largely because it didn't charge much.",
        ticker: "",
        lesson: "Costs are one of the few things you control, and they compound. A low-cost index fund is the high-probability default; active picking needs a real edge to justify its fees.",
      },
      quiz: [
        {
          question: "Over long periods, most active funds:",
          options: [
            "Beat the index easily",
            "Underperform a simple index after fees",
            "Match the index exactly",
            "Avoid all losses",
          ],
          answerIndex: 1,
          explanation: "After costs, the majority of active managers trail the benchmark they try to beat.",
        },
        {
          question: "Why do fees matter so much over time?",
          options: [
            "They are refunded later",
            "They compound, quietly transferring a large share of returns to the manager",
            "They only apply once",
            "They raise returns",
          ],
          answerIndex: 1,
          explanation: "A seemingly small annual fee compounds into a major drag on long-run wealth.",
        },
        {
          question: "Active stock-picking is most justified when you have:",
          options: [
            "A hot tip",
            "A genuine, defensible edge — knowledge, horizon, or temperament",
            "Fear of missing out",
            "A short time horizon",
          ],
          answerIndex: 1,
          explanation: "Without a real edge, active management's fees and difficulty make the index the better bet.",
        },
      ],
      tryInChat: {
        label: "Weigh index vs active",
        prompt: "Explain whether I should index or pick stocks, and how to think about the fees and edge involved",
      },
      takeaways: [
        "Most active funds trail a low-cost index after fees.",
        "Fees compound into a major long-run drag — costs are something you control.",
        "Index as the default; pick stocks only where you have a real, defensible edge.",
      ],
    },
    {
      id: "found-budgeting",
      title: "The Money You Invest Comes First",
      hook: "You can't invest what you've already spent.",
      difficulty: "core",
      subtitle: "Why paying yourself first and living below your means is the engine behind every investing plan.",
      widget: {
        type: "budget_split",
        title: "Split your income",
        prompt: "Move the sliders to divide income between needs, wants, and saving — and see how much actually reaches your future.",
        params: { monthlyIncome: 2000, needsPct: 50, wantsPct: 30 },
      },
      conceptCards: [
        {
          emoji: "",
          heading: "Pay yourself first",
          body: "The savers who build wealth treat investing as a fixed bill paid before discretionary spending, not whatever's left over at month's end. Automating a transfer to investments on payday guarantees the seed capital that compounding needs to work on.",
        },
        {
          emoji: "",
          heading: "A simple framework: 50/30/20",
          body: "One starting split: roughly half of after-tax income on needs, a third on wants, and at least a fifth toward saving and investing. The exact numbers matter less than the principle — a deliberate, repeatable allocation that always funds your future first.",
        },
        {
          emoji: "",
          heading: "The savings rate is the real driver",
          body: "Early on, how much you save matters far more than what you earn on it — you can't compound money you never set aside. An emergency buffer plus a steady savings rate is the unglamorous foundation that makes every later investing decision possible.",
        },
      ],
      keyTerms: [
        { term: "Pay yourself first", definition: "Investing a set amount before spending on anything discretionary." },
        { term: "50/30/20 rule", definition: "A budgeting guide: ~50% needs, 30% wants, 20%+ saving and investing." },
        { term: "Savings rate", definition: "The share of income you save and invest — the main early driver of wealth." },
        { term: "Emergency fund", definition: "Cash set aside to cover unexpected expenses without selling investments." },
        { term: "Lifestyle creep", definition: "Letting spending rise with income, which quietly erodes the savings rate." },
      ],
      realWorldExample: {
        scenario:
          "Two people earn the same salary. One automates a fifth of each paycheck into investments and lives on the rest; the other spends to the limit and invests 'what's left,' which is usually nothing. A decade later, only the first has meaningful investments.",
        ticker: "",
        lesson: "Wealth is built from the gap between what you earn and what you spend. Paying yourself first turns that gap into the fuel compounding runs on.",
      },
      quiz: [
        {
          question: "'Pay yourself first' means:",
          options: [
            "Spend on wants before saving",
            "Invest a set amount before discretionary spending",
            "Take a salary advance",
            "Buy luxuries first",
          ],
          answerIndex: 1,
          explanation: "Treating investing as a fixed bill paid first guarantees the seed capital compounding needs.",
        },
        {
          question: "In the 50/30/20 framework, the 20% is for:",
          options: ["Needs", "Wants", "Saving and investing", "Taxes"],
          answerIndex: 2,
          explanation: "The framework allocates ~50% needs, 30% wants, and at least 20% to saving and investing.",
        },
        {
          question: "Early in your journey, wealth depends most on:",
          options: [
            "Your investment returns",
            "Your savings rate — how much you set aside",
            "Picking the best stock",
            "Your credit score",
          ],
          answerIndex: 1,
          explanation: "You can't compound money you never saved, so the savings rate dominates early on.",
        },
      ],
      tryInChat: {
        label: "Build the habit",
        prompt: "Help me think through a simple savings and investing plan based on paying myself first",
      },
      takeaways: [
        "Pay yourself first — invest before discretionary spending, and automate it.",
        "A framework like 50/30/20 keeps the allocation deliberate and repeatable.",
        "Early on, your savings rate matters more than your returns.",
      ],
    },
  ],
};
