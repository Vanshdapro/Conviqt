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
  ],
};
