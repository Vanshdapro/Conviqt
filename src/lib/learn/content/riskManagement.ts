// Track: Risk Management — survival first, because you cannot compound from zero.

import type { RawTrack } from "../types";

export const riskManagement: RawTrack = {
  id: "risk-management",
  name: "Risk Management",
  tagline: "Survival first. You cannot compound from zero.",
  emoji: "",
  accent: "#f59e0b",
  lessons: [
    {
      id: "rm-drawdown-math",
      title: "The Recovery Tax",
      hook: "Down 50% needs +100% just to get back to even.",
      difficulty: "core",
      subtitle: "The brutal asymmetry of losses and why avoiding deep drawdowns beats chasing the last bit of upside.",
      figure: "drawdown",
      widget: {
        type: "drawdown_recovery",
        title: "Feel the asymmetry",
        prompt: "Increase the drawdown and watch the gain required to recover rise far faster — the curve is not symmetric.",
        params: { drawdownPct: 50 },
      },
      conceptCards: [
        {
          emoji: "",
          heading: "Losses compound against you",
          body: "A drawdown of d requires a gain of d/(1−d) to recover. Down 20% needs +25%, down 50% needs +100%, down 80% needs +400%. The deeper the hole, the disproportionately larger the climb out.",
        },
        {
          emoji: "",
          heading: "Protect the downside first",
          body: "Because recovery gains balloon nonlinearly, avoiding deep losses matters more than capturing the final few points of a rally. This is the mathematical case for stops, sizing, and refusing to ride a position into a crater.",
        },
        {
          emoji: "",
          heading: "Capital is the seed",
          body: "You compound from the capital you keep. A single catastrophic loss can erase years of careful gains, so the first job of risk management is simply not to be knocked out of the game.",
        },
      ],
      keyTerms: [
        { term: "Drawdown", definition: "The peak-to-trough decline in capital, expressed as a percentage." },
        { term: "Recovery gain", definition: "The return needed to climb back to the prior peak after a drawdown: d/(1−d)." },
        { term: "Asymmetry of losses", definition: "The fact that recovering a loss requires a proportionally larger gain." },
        { term: "Capital preservation", definition: "Prioritizing the avoidance of large losses to keep compounding intact." },
      ],
      realWorldExample: {
        scenario:
          "Investors who rode high-flying stocks down 80%+ in a bust needed a fivefold gain just to break even — a climb that can take a decade or never happen. Those who cut losses earlier preserved the capital to compound elsewhere.",
        ticker: "",
        lesson: "Deep drawdowns aren't symmetric setbacks; they're disproportionately expensive. Avoiding them is the highest-return risk decision.",
      },
      quiz: [
        {
          question: "A 50% loss requires what gain to recover?",
          options: ["+50%", "+75%", "+100%", "+150%"],
          answerIndex: 2,
          explanation: "Recovery gain = d/(1−d) = 0.5/0.5 = 100%. Halving your capital means you must double it to get back.",
        },
        {
          question: "The asymmetry of losses implies that:",
          options: [
            "Upside and downside are equivalent",
            "Avoiding deep drawdowns matters more than capturing the last bit of upside",
            "Stops are useless",
            "Bigger losses are easier to recover",
          ],
          answerIndex: 1,
          explanation: "Because recovery gains grow nonlinearly with loss size, preventing deep losses is mathematically more valuable.",
        },
        {
          question: "Why is capital preservation the first job of risk management?",
          options: [
            "Regulators require it",
            "You compound from the capital you keep, and a catastrophic loss can erase years of gains",
            "It maximizes turnover",
            "It avoids taxes",
          ],
          answerIndex: 1,
          explanation: "Compounding only works on surviving capital; a knockout loss ends the game regardless of past returns.",
        },
      ],
      tryInChat: {
        label: "Run the drawdown math",
        prompt: "Show me the recovery gain needed for various drawdowns and what it means for stop placement",
      },
      takeaways: [
        "Recovery gain = d/(1−d): losses get disproportionately harder to recover as they deepen.",
        "Avoiding deep drawdowns beats squeezing the last points of upside.",
        "Preserve capital first — you can only compound from what you keep.",
      ],
    },
    {
      id: "rm-first-loss-cheapest",
      title: "The First Loss Is the Cheapest",
      hook: "Cut, reassess, re-enter. Never average into a falling knife.",
      difficulty: "advanced",
      subtitle: "The discipline of pre-defined invalidation and exiting a broken thesis without negotiation.",
      conceptCards: [
        {
          emoji: "",
          heading: "Define invalidation before you enter",
          body: "Decide in advance the price or fact that would prove your thesis wrong, and commit to exiting if it's hit. Setting the exit before you're emotionally committed is what makes it possible to actually take it.",
        },
        {
          emoji: "",
          heading: "Adding to a thesis vs adding to a hope",
          body: "Averaging down is fine when the thesis is intact and the price improved your odds; it's account-destroying when the thesis is broken and you're just lowering your average on a loser. Know which one you're doing.",
        },
        {
          emoji: "",
          heading: "Stops on facts, not feelings",
          body: "Set stops on thesis invalidation — a broken assumption, a failed catalyst — rather than an arbitrary percentage or a hopeful narrative. The first loss is cheap; the one you refuse to take keeps getting more expensive.",
        },
      ],
      keyTerms: [
        { term: "Invalidation level", definition: "The pre-defined price or event that proves a thesis wrong and triggers an exit." },
        { term: "Averaging down", definition: "Buying more as the price falls, lowering the average cost — sound only if the thesis holds." },
        { term: "Falling knife", definition: "A sharply declining asset that tempts buyers before it has stopped falling." },
        { term: "Stop discipline", definition: "Exiting without negotiation when the predefined invalidation is reached." },
      ],
      realWorldExample: {
        scenario:
          "Conviqt's public Alpha Tracker ships a hard stop on every pick and never deletes the losers. When a stop is hit, the position is closed and recorded — the thesis was wrong, and the loss is taken while it's still small.",
        ticker: "",
        lesson: "Pre-committing to an invalidation level turns the first, cheapest loss into a rule rather than a painful judgment call in the moment.",
      },
      quiz: [
        {
          question: "When should an invalidation level be defined?",
          options: [
            "After the position moves against you",
            "Before entering, while you're still objective",
            "Only for winners",
            "Never — stay flexible",
          ],
          answerIndex: 1,
          explanation: "Setting the exit before you're emotionally invested is what makes it possible to take the loss when needed.",
        },
        {
          question: "Averaging down is dangerous specifically when:",
          options: [
            "The thesis is intact and odds improved",
            "The thesis is broken and you're just lowering your average on a loser",
            "The position is small",
            "You have a stop",
          ],
          answerIndex: 1,
          explanation: "Adding to a broken thesis — 'adding to a hope' — is a classic way to turn a small loss into a catastrophic one.",
        },
        {
          question: "Stops are best anchored to:",
          options: [
            "A round-number percentage",
            "Thesis invalidation — a broken assumption or failed catalyst",
            "The all-time high",
            "Your purchase price exactly",
          ],
          answerIndex: 1,
          explanation: "A stop on the fact that disproves your thesis is more meaningful than an arbitrary percentage.",
        },
      ],
      tryInChat: {
        label: "Set an invalidation level",
        prompt: "Help me define a clear invalidation level and stop for a thesis on a stock I name",
      },
      takeaways: [
        "Define the invalidation point before entering, while you're still objective.",
        "Averaging down on a broken thesis is account-destroying; know the difference.",
        "Stop on thesis invalidation, not an arbitrary percentage — the first loss is the cheapest.",
      ],
    },
    {
      id: "rm-tail-risk",
      title: "Tail Risk & Black Swans",
      hook: "The risk that matters is the one you didn't model.",
      difficulty: "advanced",
      subtitle: "Why fat tails dominate outcomes and why standard risk measures understate the danger.",
      conceptCards: [
        {
          emoji: "",
          heading: "Markets have fat tails",
          body: "Returns aren't normally distributed; extreme days happen far more often than a bell curve predicts. A handful of those days drive most of the long-run damage and most of the gains, so the tails — not the average — dominate results.",
        },
        {
          emoji: "",
          heading: "VaR's blind spot",
          body: "Value at Risk tells you a threshold loss at some confidence, but says nothing about how bad things get beyond it. Expected Shortfall (CVaR) — the average loss in the tail — is the more honest measure of what a bad day actually costs.",
        },
        {
          emoji: "",
          heading: "Plan for the unmodeled",
          body: "The dangerous risks are the low-probability, high-consequence events you didn't put in the model. Cheap convex hedges, conservative sizing, and pre-mortems ('how could this blow up?') are how you respect what you can't forecast.",
        },
      ],
      keyTerms: [
        { term: "Fat tails", definition: "A distribution where extreme outcomes are more likely than a normal curve implies." },
        { term: "Value at Risk (VaR)", definition: "An estimated loss not exceeded with a given probability over a period." },
        { term: "Expected Shortfall (CVaR)", definition: "The average loss in the tail beyond the VaR threshold." },
        { term: "Black swan", definition: "A rare, high-impact event that is rationalized as predictable only in hindsight." },
        { term: "Pre-mortem", definition: "Imagining a failure in advance to surface hidden risks before they occur." },
      ],
      realWorldExample: {
        scenario:
          "Strategies that looked safe on standard risk models — selling options, heavy leverage on 'low-volatility' assets — periodically suffered catastrophic losses in events their models treated as near-impossible. The tails they ignored defined their fate.",
        ticker: "",
        lesson: "Risk models built on normal distributions lull you into underestimating extremes. Respect the tail, because that's where ruin lives.",
      },
      quiz: [
        {
          question: "'Fat tails' means that compared to a normal distribution:",
          options: [
            "Extreme events are rarer",
            "Extreme events are more common and more impactful",
            "Returns are perfectly predictable",
            "Volatility is zero",
          ],
          answerIndex: 1,
          explanation: "Fat-tailed markets produce extreme moves more often than a bell curve assumes, and those moves dominate outcomes.",
        },
        {
          question: "The key weakness of Value at Risk is that it:",
          options: [
            "Overstates losses",
            "Says nothing about how bad losses get beyond the threshold",
            "Ignores probability",
            "Can't be computed",
          ],
          answerIndex: 1,
          explanation: "VaR gives a threshold but is silent on the depth of the tail — which is why Expected Shortfall is preferred.",
        },
        {
          question: "A pre-mortem helps manage tail risk by:",
          options: [
            "Predicting the exact crash date",
            "Imagining failure in advance to surface hidden risks",
            "Eliminating all risk",
            "Raising leverage",
          ],
          answerIndex: 1,
          explanation: "Assuming the position blew up and asking why exposes vulnerabilities a model might miss.",
        },
      ],
      tryInChat: {
        label: "Probe the tail",
        prompt: "Run a pre-mortem on a position I name — what low-probability events could cause a catastrophic loss?",
      },
      takeaways: [
        "Markets have fat tails; a few extreme days dominate long-run results.",
        "VaR ignores the depth of the tail — Expected Shortfall is more honest.",
        "Respect unmodeled risks with convex hedges, conservative sizing, and pre-mortems.",
      ],
    },
    {
      id: "rm-liquidity-regime",
      title: "Liquidity & When Correlations Go to 1",
      hook: "Diversification fails exactly when you need it most.",
      difficulty: "advanced",
      subtitle: "How liquidity and leverage turn a diversified book into one trade during a crisis.",
      conceptCards: [
        {
          emoji: "",
          heading: "Two kinds of liquidity",
          body: "Asset liquidity is how easily you can sell something; funding liquidity is your ability to borrow or roll financing. Crises hit both at once — assets get hard to sell just as the financing you relied on disappears.",
        },
        {
          emoji: "",
          heading: "Forced sellers set the price",
          body: "In a panic, leverage unwinds and everyone reaches for the same exits. Margin calls force sales regardless of value, so prices are set by who must sell, not by fundamentals — and correlations across holdings converge toward one.",
        },
        {
          emoji: "",
          heading: "Size for the bad day",
          body: "Position sizing must reflect the liquidity you'll actually have in a panic, not the liquidity on a calm day. Leverage plus illiquidity is the combination that turns a drawdown into a forced, value-destroying liquidation.",
        },
      ],
      keyTerms: [
        { term: "Asset liquidity", definition: "How quickly and cheaply a holding can be sold without moving its price." },
        { term: "Funding liquidity", definition: "The ability to borrow or roll over financing to hold positions." },
        { term: "Forced seller", definition: "A participant compelled to sell by margin calls or redemptions, regardless of value." },
        { term: "Regime shift", definition: "An abrupt change in market behavior, often from calm to crisis." },
        { term: "Deleveraging", definition: "The system-wide unwinding of borrowed positions that drives correlated selling." },
      ],
      realWorldExample: {
        scenario:
          "In acute crises, normally uncorrelated assets have sold off together as leveraged players liquidated everything they could to raise cash. Diversification that worked for years evaporated in days as correlations spiked toward one.",
        ticker: "",
        lesson: "The diversification on your spreadsheet is a calm-day number. Leverage and a liquidity squeeze can collapse it precisely when you're counting on it.",
      },
      quiz: [
        {
          question: "During a crisis, correlations across assets tend to:",
          options: [
            "Fall toward zero",
            "Converge toward one as forced selling hits everything",
            "Stay constant",
            "Turn negative",
          ],
          answerIndex: 1,
          explanation: "Deleveraging forces correlated selling, so diversification weakens just when it's most needed.",
        },
        {
          question: "Funding liquidity refers to:",
          options: [
            "How fast you can sell an asset",
            "Your ability to borrow or roll over financing to hold positions",
            "The dividend schedule",
            "The bid-ask spread only",
          ],
          answerIndex: 1,
          explanation: "Funding liquidity is about access to financing; it can vanish in a crisis alongside asset liquidity.",
        },
        {
          question: "The most dangerous combination in a liquidity crisis is:",
          options: [
            "Cash and patience",
            "Leverage plus illiquid positions",
            "Low correlation",
            "A long time horizon",
          ],
          answerIndex: 1,
          explanation: "Leverage forces selling, and illiquidity means those sales happen at terrible prices — a destructive pairing.",
        },
      ],
      tryInChat: {
        label: "Assess liquidity risk",
        prompt: "Evaluate the liquidity and leverage risk in a portfolio I describe and how it might behave in a panic",
      },
      takeaways: [
        "Asset and funding liquidity both dry up together in a crisis.",
        "Forced sellers set prices in a panic, and correlations converge toward one.",
        "Size for the liquidity you'll have on the bad day — leverage plus illiquidity is ruin.",
      ],
    },
    {
      id: "rm-volatility-vs-risk",
      title: "Volatility Is Not Risk",
      hook: "A stock that swings isn't risky — a stock that can go to zero is.",
      difficulty: "advanced",
      subtitle: "Separating the academic definition of risk (volatility) from the one that matters: permanent loss of capital.",
      conceptCards: [
        {
          emoji: "",
          heading: "Two different things called 'risk'",
          body: "Finance often equates risk with volatility — the size of price swings — because it's easy to measure. But for a long-term owner, the real risk is the permanent loss of capital: a business impairment you don't recover from. Volatility is a feeling; permanent loss is the fact.",
        },
        {
          emoji: "",
          heading: "Volatility can be your friend",
          body: "If your thesis is intact, a falling price is an opportunity, not a danger — Mr. Market offering you more of a good business cheaper. Volatility only becomes real risk when it forces a sale (via leverage or panic) or when it reflects genuine deterioration.",
        },
        {
          emoji: "",
          heading: "Where the measures mislead",
          body: "Beta and standard deviation can label a cheap, sound business 'risky' simply because it moves a lot, and a serene, overvalued one 'safe.' Judge risk by the probability and depth of permanent loss — valuation, balance sheet, business durability — not by the wiggle of the chart.",
        },
      ],
      keyTerms: [
        { term: "Volatility", definition: "The magnitude of price fluctuations; the academic proxy for risk." },
        { term: "Permanent loss of capital", definition: "An impairment you don't recover from — the risk that actually matters to owners." },
        { term: "Beta", definition: "A stock's volatility relative to the market; often mislabeled as 'risk.'" },
        { term: "Mark-to-market risk", definition: "The danger that paper losses force a sale through leverage or redemptions." },
        { term: "Drawdown tolerance", definition: "Your real ability to hold through volatility without being forced to sell." },
      ],
      realWorldExample: {
        scenario:
          "During panics, shares of durable, well-financed businesses fell sharply alongside genuinely impaired ones. For unleveraged owners with intact theses, the volatility was opportunity; for leveraged holders forced to sell, the same swing became a permanent loss.",
        ticker: "",
        lesson: "Volatility hurts you only if it forces a sale or signals real deterioration. The risk to fear is permanent impairment, not a noisy chart.",
      },
      quiz: [
        {
          question: "For a long-term owner, the risk that truly matters is:",
          options: [
            "Daily price volatility",
            "Permanent loss of capital",
            "Beta",
            "Standard deviation",
          ],
          answerIndex: 1,
          explanation: "Volatility is recoverable noise; permanent impairment of the business is the real danger.",
        },
        {
          question: "Volatility turns into real risk primarily when:",
          options: [
            "The chart looks scary",
            "It forces a sale (via leverage or panic) or reflects genuine deterioration",
            "It is above average",
            "Beta exceeds 1",
          ],
          answerIndex: 1,
          explanation: "A swing only harms an owner who must sell or whose business is actually impaired.",
        },
        {
          question: "Beta and standard deviation can mislead because they:",
          options: [
            "Are illegal",
            "Can call a cheap sound business 'risky' and an overvalued calm one 'safe'",
            "Measure earnings",
            "Predict the future perfectly",
          ],
          answerIndex: 1,
          explanation: "They measure price movement, not the probability of permanent loss, so they can invert the real risk.",
        },
      ],
      tryInChat: {
        label: "Reassess the risk",
        prompt: "For a volatile stock I name, tell me whether its real risk is permanent loss or just price volatility",
      },
      takeaways: [
        "Volatility is the academic proxy; permanent loss of capital is the risk that matters.",
        "If the thesis holds and you aren't forced to sell, volatility is opportunity.",
        "Judge risk by the odds of permanent impairment, not by beta or the chart's wiggle.",
      ],
    },
    {
      id: "rm-sequence-risk",
      title: "Sequence-of-Returns Risk",
      hook: "Same average return, different order — and one of you runs out of money.",
      difficulty: "advanced",
      subtitle: "Why the order of returns, not just the average, decides outcomes when you're adding or withdrawing.",
      widget: {
        type: "sequence_risk",
        title: "Reorder the same returns",
        prompt: "Apply an identical set of returns in two orders while withdrawing each year, and watch the ending balances diverge.",
        params: { startBalance: 100000, withdrawalPct: 5 },
      },
      conceptCards: [
        {
          emoji: "",
          heading: "Order matters when cash flows do",
          body: "If you neither add nor withdraw, only the average compound return matters and order is irrelevant. The moment you're regularly withdrawing (retirement) or contributing (accumulation), the sequence of returns changes the outcome — sometimes dramatically — even for identical averages.",
        },
        {
          emoji: "",
          heading: "An early crash is the danger",
          body: "Withdrawing during an early downturn forces you to sell more shares at low prices, permanently shrinking the base that later gains compound on. Two retirees with the same average return can end with wildly different wealth depending on whether the bad years came first or last.",
        },
        {
          emoji: "",
          heading: "Defenses against sequence risk",
          body: "Hold a cash or bond buffer to avoid selling equities into a slump, stay flexible on withdrawal rates in bad years, and de-risk approaching the moment you start drawing down. The goal is to never be a forced seller early in a decline.",
        },
      ],
      keyTerms: [
        { term: "Sequence-of-returns risk", definition: "The risk that the order of returns hurts outcomes when adding or withdrawing capital." },
        { term: "Decumulation", definition: "The phase of drawing down a portfolio, when sequence risk bites hardest." },
        { term: "Safe withdrawal rate", definition: "A withdrawal rate intended to survive bad sequences over a retirement." },
        { term: "Cash buffer", definition: "Reserves held to avoid selling risk assets during a downturn." },
        { term: "Glide path", definition: "Gradually reducing risk as you approach and enter withdrawals." },
      ],
      realWorldExample: {
        scenario:
          "Two retirees earn the same average return over 20 years, but one hits a severe market drop in the first few years of withdrawals and the other late. The early-crash retiree can run out of money; the late-crash retiree finishes comfortably — same average, opposite fate.",
        ticker: "",
        lesson: "When you're withdrawing, the order of returns can matter more than the average. Protect against an early-downturn forced sale with buffers and flexibility.",
      },
      quiz: [
        {
          question: "Sequence-of-returns risk matters most when you are:",
          options: [
            "Never touching the portfolio",
            "Regularly withdrawing from (or contributing to) the portfolio",
            "Holding only cash",
            "Invested for one day",
          ],
          answerIndex: 1,
          explanation: "With cash flows in or out, the order of returns affects the base that compounds, unlike a buy-and-hold lump.",
        },
        {
          question: "For a retiree, the most dangerous sequence is:",
          options: [
            "Good returns early, bad late",
            "Bad returns early, while withdrawals force selling at low prices",
            "Flat returns throughout",
            "Order never matters",
          ],
          answerIndex: 1,
          explanation: "An early downturn combined with withdrawals shrinks the base permanently, crippling later compounding.",
        },
        {
          question: "A defense against sequence risk is:",
          options: [
            "Maximizing leverage",
            "Holding a cash buffer and staying flexible on withdrawals in bad years",
            "Selling everything in a slump",
            "Ignoring the downturn",
          ],
          answerIndex: 1,
          explanation: "Buffers and flexible spending let you avoid being a forced seller early in a decline.",
        },
      ],
      tryInChat: {
        label: "Stress the sequence",
        prompt: "Explain how sequence-of-returns risk would affect a withdrawal plan I describe and how to defend against it",
      },
      takeaways: [
        "With contributions or withdrawals, the order of returns — not just the average — drives outcomes.",
        "An early downturn while withdrawing is the core danger; it permanently shrinks the base.",
        "Defend with cash buffers, flexible withdrawals, and de-risking into drawdown.",
      ],
    },
    {
      id: "rm-hedging",
      title: "Hedging: When It's Worth the Cost",
      hook: "Insurance you always carry is a drag; insurance you carry at the right time is priceless.",
      difficulty: "advanced",
      subtitle: "What hedges actually do, what they cost, and the disciplined cases where they earn their keep.",
      conceptCards: [
        {
          emoji: "",
          heading: "A hedge is paid insurance",
          body: "Hedging trades some expected return for reduced risk — buying puts, holding gold or cash, shorting an index. Like insurance, it has an ongoing cost (premium, carry, opportunity cost). Permanent, always-on hedging usually bleeds away more than it saves.",
        },
        {
          emoji: "",
          heading: "Cheap insurance is the edge",
          body: "The disciplined approach buys protection when it's cheap and the asymmetry is favorable — low implied volatility, complacent markets — rather than after fear has spiked the price. Tail hedges work precisely because they're convex: small cost, large payoff in a crash.",
        },
        {
          emoji: "",
          heading: "Often the best hedge is the balance sheet",
          body: "Before buying complex protection, consider the simplest hedges: less leverage, more cash, and position sizing that survives the bad scenario. Reducing exposure costs nothing in premium and removes the risk at the source — usually superior to paying to offset risk you didn't need to take.",
        },
      ],
      keyTerms: [
        { term: "Hedge", definition: "A position taken to offset potential losses in another position." },
        { term: "Tail hedge", definition: "Cheap, convex protection that pays off in rare extreme moves." },
        { term: "Carry / cost of the hedge", definition: "The ongoing premium or opportunity cost of holding protection." },
        { term: "Implied volatility", definition: "The market's priced-in expectation of volatility; it sets option (hedge) prices." },
        { term: "Natural hedge", definition: "Reducing risk at the source via lower leverage, cash, or smaller size." },
      ],
      realWorldExample: {
        scenario:
          "Funds that bought cheap protection during calm, complacent markets paid little and were rewarded enormously when volatility exploded. Those that rushed to hedge only after the crash began paid sky-high prices for protection that no longer offered the same asymmetry.",
        ticker: "",
        lesson: "Hedging pays when protection is cheap and convex, bought before the storm. Always-on hedging bleeds; panic hedging overpays. Often the cleanest hedge is simply taking less risk.",
      },
      quiz: [
        {
          question: "A hedge fundamentally involves:",
          options: [
            "Free downside protection",
            "Trading some expected return for reduced risk — paid insurance",
            "Guaranteed profit",
            "Eliminating all risk at no cost",
          ],
          answerIndex: 1,
          explanation: "Hedges cost premium, carry, or opportunity — protection is never free.",
        },
        {
          question: "The disciplined time to buy tail protection is:",
          options: [
            "After a crash has begun and fear is high",
            "When it's cheap and markets are complacent, before the storm",
            "Never",
            "Only when fully invested",
          ],
          answerIndex: 1,
          explanation: "Buying convex protection cheaply, before volatility spikes, preserves the favorable asymmetry.",
        },
        {
          question: "Often the simplest and cheapest hedge is to:",
          options: [
            "Buy complex options",
            "Reduce leverage, hold more cash, and size to survive the bad scenario",
            "Add more risk",
            "Ignore the downside",
          ],
          answerIndex: 1,
          explanation: "Cutting exposure removes the risk at the source for no premium — usually better than paying to offset it.",
        },
      ],
      tryInChat: {
        label: "Evaluate a hedge",
        prompt: "Help me decide whether and how to hedge a portfolio I describe, weighing the cost against the protection",
      },
      takeaways: [
        "A hedge is paid insurance — always-on hedging usually bleeds away returns.",
        "Buy cheap, convex protection before the storm, not after fear spikes prices.",
        "The simplest hedge is often less leverage, more cash, and smaller size.",
      ],
    },
  ],
};
