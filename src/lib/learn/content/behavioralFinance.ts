// Track: Behavioral Finance & Psychology — the biggest obstacle to good returns
// is usually the investor in the mirror. The systematic biases that wreck
// decisions, and how to defend against them. Static, hand-authored content.

import type { RawTrack } from "../types";

export const behavioralFinance: RawTrack = {
  id: "behavioral-finance",
  name: "Behavioral Finance & Psychology",
  tagline: "The biggest obstacle to good returns is the investor in the mirror.",
  emoji: "",
  accent: "var(--accent)",
  lessons: [
    {
      id: "bf-loss-aversion",
      title: "Loss Aversion",
      hook: "Losing $100 hurts about twice as much as winning $100 feels good.",
      difficulty: "core",
      subtitle: "Why the pain of losses outweighs the pleasure of equal gains, and how that bends every decision.",
      widget: {
        type: "loss_aversion",
        title: "Feel the asymmetry",
        prompt: "Set how much losses sting and the amount at stake, and see the bent value curve that makes a fair coin flip feel like a bad deal.",
        params: { lambda: 2.25, amount: 100 },
      },
      conceptCards: [
        {
          emoji: "",
          heading: "Losses loom larger than gains",
          body: "Kahneman and Tversky's prospect theory found that people feel losses roughly twice as intensely as equivalent gains. The value function is bent: steep for losses, shallow for gains. This asymmetry, not rational calculation, drives much of how investors actually behave.",
        },
        {
          emoji: "",
          heading: "It causes real mistakes",
          body: "Loss aversion makes investors hold losers too long (to avoid 'locking in' the painful loss), sell winners too early (to lock in the pleasurable gain), and panic-sell at bottoms. The fear of loss, not the math, is steering the wheel.",
        },
        {
          emoji: "",
          heading: "Reframe to defend against it",
          body: "Defenses include focusing on the portfolio rather than individual positions, checking prices less often (frequent checking amplifies felt losses), and pre-committing to rules so a sale is a decision made calmly in advance, not a panic in the moment.",
        },
      ],
      keyTerms: [
        { term: "Loss aversion", definition: "The tendency to feel losses about twice as intensely as equal gains." },
        { term: "Prospect theory", definition: "Kahneman and Tversky's model of how people actually value gains and losses." },
        { term: "Value function", definition: "The bent curve describing felt value — steep for losses, shallow for gains." },
        { term: "Myopic loss aversion", definition: "Magnified loss aversion from checking and re-evaluating too frequently." },
        { term: "Reframing", definition: "Changing how a choice is presented to reduce a bias's grip." },
      ],
      realWorldExample: {
        scenario:
          "Offered a coin flip that pays $150 on heads and loses $100 on tails, most people decline — even though the expected value is clearly positive. The potential $100 loss feels worse than the larger $150 gain feels good, so they pass on a good bet.",
        ticker: "",
        lesson: "Loss aversion makes us reject favorable bets and cling to losers. Recognizing the bias is the first step to deciding by the math instead of the fear.",
      },
      quiz: [
        {
          question: "Loss aversion means people feel losses:",
          options: [
            "About the same as equal gains",
            "Roughly twice as intensely as equal gains",
            "Less than equal gains",
            "Not at all",
          ],
          answerIndex: 1,
          explanation: "Prospect theory found losses are felt roughly twice as strongly as equivalent gains.",
        },
        {
          question: "A classic mistake driven by loss aversion is:",
          options: [
            "Selling winners early and holding losers too long",
            "Diversifying broadly",
            "Investing regularly",
            "Reading financial statements",
          ],
          answerIndex: 0,
          explanation: "The pain of realizing a loss makes investors hold losers and lock in gains too soon.",
        },
        {
          question: "'Myopic loss aversion' is worsened by:",
          options: [
            "Checking prices less often",
            "Checking and re-evaluating prices too frequently",
            "Holding for decades",
            "Ignoring the market",
          ],
          answerIndex: 1,
          explanation: "Frequent checking surfaces more losses, amplifying the felt pain and prompting bad reactions.",
        },
      ],
      tryInChat: {
        label: "Spot the bias",
        prompt: "Help me check whether I'm holding a losing position out of loss aversion rather than a sound thesis",
      },
      takeaways: [
        "Losses are felt about twice as intensely as equal gains — the value curve is bent.",
        "This drives holding losers, selling winners early, and panic at bottoms.",
        "Defend by focusing on the portfolio, checking less often, and pre-committing to rules.",
      ],
    },
    {
      id: "bf-anchoring",
      title: "Anchoring",
      hook: "The first number you see quietly hijacks every estimate that follows.",
      difficulty: "core",
      subtitle: "Why irrelevant reference points — your cost basis, the 52-week high — distort what you think things are worth.",
      figure: "anchoring",
      conceptCards: [
        {
          emoji: "",
          heading: "The first number sticks",
          body: "When estimating an unknown value, people latch onto whatever number is in front of them and adjust insufficiently from it — even when that number is irrelevant. The anchor drags the final estimate toward itself, often without the person noticing.",
        },
        {
          emoji: "",
          heading: "Investing anchors everywhere",
          body: "Your purchase price, a stock's 52-week high, the IPO price, a round number, an analyst's old target — all become anchors. 'It's down 40% from its high, so it's cheap' anchors on the high, not on value. The anchor is usually irrelevant to what the business is worth.",
        },
        {
          emoji: "",
          heading: "Value from scratch",
          body: "The defense is to estimate value independently — from cash flows, comparables, and fundamentals — before looking at the price or any reference point. If you must use anchors, use many and treat your cost basis as a sunk fact, not a target the price 'should' return to.",
        },
      ],
      keyTerms: [
        { term: "Anchoring", definition: "Relying too heavily on the first piece of information when making estimates." },
        { term: "Cost basis anchoring", definition: "Letting your purchase price distort decisions about a holding's future." },
        { term: "52-week high/low", definition: "Common but largely irrelevant anchors for judging value." },
        { term: "Adjustment", definition: "The insufficient correction people make away from an anchor." },
        { term: "Reference point", definition: "A baseline against which outcomes are judged, often arbitrary." },
      ],
      realWorldExample: {
        scenario:
          "An investor refuses to sell a deteriorating stock until it 'gets back to' their purchase price — anchoring on a number the market neither knows nor cares about. The business kept weakening while they waited for an arbitrary level that had nothing to do with value.",
        ticker: "",
        lesson: "Your cost basis and a stock's past highs are anchors, not value. Estimate worth from fundamentals first, then compare to price — never the reverse.",
      },
      quiz: [
        {
          question: "Anchoring is the tendency to:",
          options: [
            "Ignore all numbers",
            "Rely too heavily on the first number seen when estimating a value",
            "Average many estimates",
            "Always be contrarian",
          ],
          answerIndex: 1,
          explanation: "The first number becomes a reference the estimate drifts toward, even when irrelevant.",
        },
        {
          question: "A common investing anchor is:",
          options: [
            "Discounted cash flow",
            "Your purchase price or a stock's 52-week high",
            "The company's moat",
            "The savings rate",
          ],
          answerIndex: 1,
          explanation: "Cost basis and past highs are vivid but usually irrelevant anchors for judging value.",
        },
        {
          question: "The defense against anchoring is to:",
          options: [
            "Look at the price first",
            "Estimate value independently from fundamentals before checking the price",
            "Wait for a round number",
            "Use the IPO price as a target",
          ],
          answerIndex: 1,
          explanation: "Valuing from scratch, before seeing the anchor, prevents the reference point from distorting you.",
        },
      ],
      tryInChat: {
        label: "Drop the anchor",
        prompt: "Help me value a stock I name from fundamentals, ignoring its past highs and my cost basis",
      },
      takeaways: [
        "The first number you see anchors your estimate, even when it's irrelevant.",
        "Cost basis, 52-week highs, and IPO prices are anchors, not value.",
        "Estimate value from fundamentals first, then compare to price — never the reverse.",
      ],
    },
    {
      id: "bf-disposition",
      title: "The Disposition Effect",
      hook: "We sell our flowers and water our weeds.",
      difficulty: "advanced",
      subtitle: "Why investors take small gains quickly but let losses run — exactly backwards.",
      figure: "disposition",
      conceptCards: [
        {
          emoji: "",
          heading: "Selling winners, holding losers",
          body: "The disposition effect is the documented tendency to sell winning positions too early (to enjoy a realized gain) and hold losing ones too long (to avoid a realized loss). It flows directly from loss aversion and the desire to feel right.",
        },
        {
          emoji: "",
          heading: "It hurts returns twice",
          body: "It caps your upside by cutting winners that might run further, and it lets losers fester into bigger losses. In taxable accounts it's also tax-inefficient: you realize taxable gains early and defer the losses you could have harvested.",
        },
        {
          emoji: "",
          heading: "Decide on the thesis, not the P&L",
          body: "The cure is to evaluate each position on its forward thesis, ignoring your entry price. Ask: 'Would I buy this today?' If yes, hold or add regardless of paper gain or loss; if no, sell — whether you're up or down. The cost basis is irrelevant to that decision.",
        },
      ],
      keyTerms: [
        { term: "Disposition effect", definition: "Selling winners too early and holding losers too long." },
        { term: "Realized vs paper", definition: "A loss only 'hurts' emotionally once realized — which biases holding losers." },
        { term: "Tax-loss harvesting", definition: "Realizing losses to offset gains; the disposition effect works against it." },
        { term: "Let winners run", definition: "Holding strong positions rather than cutting them for a quick gain." },
        { term: "Sunk cost", definition: "The irrecoverable entry price that shouldn't drive forward decisions." },
      ],
      realWorldExample: {
        scenario:
          "Studies of brokerage accounts found investors were far more likely to sell stocks trading above their purchase price than below — even though the stocks they held (the losers) went on to underperform the ones they sold. The instinct was precisely wrong.",
        ticker: "",
        lesson: "The disposition effect caps gains and lets losses grow. Judge positions on their forward thesis, not on whether you're up or down from your entry.",
      },
      quiz: [
        {
          question: "The disposition effect is the tendency to:",
          options: [
            "Sell losers and hold winners",
            "Sell winners too early and hold losers too long",
            "Never sell anything",
            "Trade only at random",
          ],
          answerIndex: 1,
          explanation: "Investors realize gains quickly and avoid realizing losses, holding losers too long.",
        },
        {
          question: "The disposition effect hurts returns by:",
          options: [
            "Cutting winners early and letting losers fester",
            "Diversifying too much",
            "Lowering fees",
            "Increasing dividends",
          ],
          answerIndex: 0,
          explanation: "It caps upside on winners and lets losses grow — damaging returns on both ends.",
        },
        {
          question: "The cure is to evaluate each position on:",
          options: [
            "Your purchase price",
            "Its forward thesis — would you buy it today?",
            "Whether it's up or down",
            "How long you've held it",
          ],
          answerIndex: 1,
          explanation: "Deciding by the forward thesis, ignoring cost basis, neutralizes the bias.",
        },
      ],
      tryInChat: {
        label: "Re-underwrite a holding",
        prompt: "For a position I'm up or down on, help me decide based purely on whether I'd buy it today",
      },
      takeaways: [
        "The disposition effect: sell winners too early, hold losers too long.",
        "It caps upside, lets losses grow, and is tax-inefficient.",
        "Decide on the forward thesis ('would I buy today?'), not your cost basis.",
      ],
    },
    {
      id: "bf-herding",
      title: "Herding & Social Proof",
      hook: "It feels safe to be wrong with everyone else — and it's priced accordingly.",
      difficulty: "core",
      subtitle: "Why we follow the crowd, how it inflates bubbles and deepens panics, and where the edge lies.",
      figure: "herding",
      conceptCards: [
        {
          emoji: "",
          heading: "Safety in numbers",
          body: "Humans are wired to follow the group — social proof was a survival trait. In markets it shows up as chasing what's rising and dumping what's falling, simply because others are. Being wrong alone feels far worse than being wrong with the crowd, so we herd.",
        },
        {
          emoji: "",
          heading: "Herding makes bubbles and crashes",
          body: "When buying begets buying, prices detach from value on the upside; when selling begets selling, they overshoot on the downside. Herding is the engine of the manias and panics that efficient-market models struggle to explain — and that create opportunity.",
        },
        {
          emoji: "",
          heading: "Edge requires standing apart",
          body: "Because consensus is already in the price, returns come from a well-founded view that differs from the crowd. That requires the discomfort of independence — and the discipline to size and time it. Contrarianism isn't reflexively opposing the crowd; it's not being captured by it.",
        },
      ],
      keyTerms: [
        { term: "Herding", definition: "Following the crowd's actions rather than independent analysis." },
        { term: "Social proof", definition: "Treating others' behavior as evidence of the right thing to do." },
        { term: "FOMO", definition: "Fear of missing out — the urge to chase what others are buying." },
        { term: "Bubble / panic", definition: "Self-reinforcing crowd-driven moves far above or below value." },
        { term: "Independence", definition: "Forming a view from analysis rather than the group, the basis of edge." },
      ],
      realWorldExample: {
        scenario:
          "In late-stage bubbles, people pile into rising assets precisely because everyone else is — and in crashes, they sell into the panic for the same reason. Those who could think independently bought what the herd dumped and trimmed what the herd chased.",
        ticker: "",
        lesson: "The crowd's comfort is already in the price. Durable edge comes from independent analysis and the discipline to act on it when it's uncomfortable.",
      },
      quiz: [
        {
          question: "Herding in markets means:",
          options: [
            "Analyzing independently",
            "Following the crowd's buying or selling rather than your own analysis",
            "Always doing the opposite of others",
            "Holding cash",
          ],
          answerIndex: 1,
          explanation: "Herding is acting because others are, driven by social proof rather than independent judgment.",
        },
        {
          question: "Herding contributes to:",
          options: [
            "Perfectly efficient prices",
            "Bubbles and crashes that overshoot value",
            "Lower volatility",
            "Guaranteed returns",
          ],
          answerIndex: 1,
          explanation: "Self-reinforcing buying and selling pushes prices far above and below fundamental value.",
        },
        {
          question: "Because consensus is already priced in, edge requires:",
          options: [
            "Copying the crowd faster",
            "A well-founded view that differs from the crowd, plus the discipline to act on it",
            "Avoiding the market",
            "Following analysts exactly",
          ],
          answerIndex: 1,
          explanation: "Returns come from independent, non-consensus views — not from comfortable crowd-following.",
        },
      ],
      tryInChat: {
        label: "Check the crowd",
        prompt: "For a stock I name, tell me what the crowd consensus is and where an independent view might differ",
      },
      takeaways: [
        "We herd because being wrong with the crowd feels safer than being wrong alone.",
        "Herding inflates bubbles and deepens panics — overshooting value both ways.",
        "Edge comes from independent, well-founded views, acted on with discipline.",
      ],
    },
    {
      id: "bf-overconfidence",
      title: "Overconfidence",
      hook: "Almost everyone thinks they're an above-average driver — and investor.",
      difficulty: "advanced",
      subtitle: "Why we overrate our knowledge and forecasts, and how poor calibration quietly costs returns.",
      figure: "overconfidence",
      conceptCards: [
        {
          emoji: "",
          heading: "We're more certain than we should be",
          body: "People systematically overestimate the accuracy of their knowledge and predictions. Asked for a 90% confidence range, most give ranges that contain the truth far less than 90% of the time. In investing, that miscalibration shows up as conviction the evidence doesn't support.",
        },
        {
          emoji: "",
          heading: "It drives overtrading and over-sizing",
          body: "Overconfidence leads to trading too much (each trade feels like a sure edge), under-diversifying, and betting too big on forecasts. Studies link higher trading activity — often a marker of overconfidence — to lower net returns after costs.",
        },
        {
          emoji: "",
          heading: "Calibration is a trainable skill",
          body: "The antidote is humility made concrete: track your forecasts and their outcomes, state probabilities and check them, and widen your ranges. Keeping a decision journal turns vague confidence into measurable calibration you can actually improve over time.",
        },
      ],
      keyTerms: [
        { term: "Overconfidence", definition: "Overestimating the accuracy of one's knowledge or forecasts." },
        { term: "Calibration", definition: "How well stated confidence matches actual hit rates." },
        { term: "Overtrading", definition: "Excessive trading, often from overconfidence, that erodes returns via costs." },
        { term: "Decision journal", definition: "A record of decisions, reasoning, and confidence used to improve calibration." },
        { term: "Illusion of control", definition: "Overrating one's influence over outcomes that are partly luck." },
      ],
      realWorldExample: {
        scenario:
          "Research on brokerage accounts found the most active traders — frequently the most confident — earned the lowest net returns, as trading costs and mistimed bets ate their gains. Their confidence outran their actual skill.",
        ticker: "",
        lesson: "Confidence and accuracy aren't the same. Track your calls, check your calibration, and let measured humility — not certainty — guide sizing and activity.",
      },
      quiz: [
        {
          question: "Overconfidence in investing typically means:",
          options: [
            "Underrating your knowledge",
            "Overrating the accuracy of your knowledge and forecasts",
            "Avoiding all trades",
            "Perfect calibration",
          ],
          answerIndex: 1,
          explanation: "People overestimate how accurate their predictions are, producing miscalibrated confidence.",
        },
        {
          question: "Overconfidence is commonly linked to:",
          options: [
            "Lower trading and higher returns",
            "Overtrading and under-diversification, which hurt net returns",
            "Better diversification",
            "Index investing",
          ],
          answerIndex: 1,
          explanation: "Excess confidence drives too much trading and concentration, dragging down returns after costs.",
        },
        {
          question: "A practical way to improve calibration is to:",
          options: [
            "Stop forecasting entirely",
            "Keep a decision journal tracking forecasts, probabilities, and outcomes",
            "Trade more",
            "Ignore your track record",
          ],
          answerIndex: 1,
          explanation: "Recording predictions and checking them turns vague confidence into measurable, improvable calibration.",
        },
      ],
      tryInChat: {
        label: "Calibrate a forecast",
        prompt: "Help me state a forecast for a stock I name as a probability and a range, then pressure-test my confidence",
      },
      takeaways: [
        "We're systematically more certain than the evidence justifies.",
        "Overconfidence drives overtrading and over-sizing, hurting net returns.",
        "Track forecasts and outcomes — calibration is a trainable skill.",
      ],
    },
    {
      id: "bf-confirmation",
      title: "Confirmation Bias",
      hook: "We don't seek the truth; we seek to be right.",
      difficulty: "advanced",
      subtitle: "Why we hunt for evidence that supports our view and dismiss what contradicts it.",
      conceptCards: [
        {
          emoji: "",
          heading: "Seeking agreement, not truth",
          body: "Once we hold a view, we instinctively notice and remember supporting evidence while discounting or never seeking contradicting evidence. We read the bullish thesis, follow the bullish accounts, and explain away the bear case — building false confidence in whatever we already believed.",
        },
        {
          emoji: "",
          heading: "It hardens theses into beliefs",
          body: "Confirmation bias turns a tentative investment idea into an identity. The more we publicly commit, the more we filter for confirmation and the harder it becomes to update — which is exactly how investors ride a broken thesis all the way down.",
        },
        {
          emoji: "",
          heading: "Actively seek the bear case",
          body: "The defense is deliberate disconfirmation: write the strongest bear case yourself, seek out smart people who disagree, and define in advance what evidence would change your mind. The goal is to be less wrong, not to win the argument with yourself.",
        },
      ],
      keyTerms: [
        { term: "Confirmation bias", definition: "Seeking and overweighting evidence that supports an existing view." },
        { term: "Disconfirming evidence", definition: "Information that contradicts your thesis — the most valuable kind to seek." },
        { term: "Motivated reasoning", definition: "Reasoning toward a conclusion you want rather than the truth." },
        { term: "Steelmanning", definition: "Building the strongest possible version of the opposing argument." },
        { term: "Falsification", definition: "Specifying in advance what would prove your thesis wrong." },
      ],
      realWorldExample: {
        scenario:
          "An investor convinced of a thesis reads only bullish commentary, joins communities of fellow believers, and dismisses every warning sign as noise — right up until the thesis breaks. The contradicting evidence was available all along; the filter wasn't.",
        ticker: "",
        lesson: "Confirmation bias makes a thesis feel stronger as it weakens. Actively hunt the bear case and pre-commit to what would change your mind.",
      },
      quiz: [
        {
          question: "Confirmation bias is the tendency to:",
          options: [
            "Seek evidence that contradicts your view",
            "Seek and overweight evidence that supports your existing view",
            "Ignore all evidence",
            "Always change your mind",
          ],
          answerIndex: 1,
          explanation: "We notice supporting evidence and discount contradicting evidence, reinforcing what we already believe.",
        },
        {
          question: "Confirmation bias is dangerous for investors because it:",
          options: [
            "Encourages diversification",
            "Lets a broken thesis feel stronger as the contradicting evidence is filtered out",
            "Lowers fees",
            "Improves calibration",
          ],
          answerIndex: 1,
          explanation: "Filtering for confirmation builds false confidence and helps investors ride a failing thesis down.",
        },
        {
          question: "An effective defense is to:",
          options: [
            "Only read views you agree with",
            "Build the strongest bear case yourself and define what would change your mind",
            "Avoid all research",
            "Commit publicly to be more certain",
          ],
          answerIndex: 1,
          explanation: "Deliberate disconfirmation — steelmanning the other side and pre-setting falsifiers — counters the bias.",
        },
      ],
      tryInChat: {
        label: "Build the bear case",
        prompt: "Give me the strongest bear case against a stock I'm bullish on, and what evidence should change my mind",
      },
      takeaways: [
        "We hunt for evidence that we're right and filter out what says otherwise.",
        "It hardens a tentative thesis into an identity and helps you ride it down.",
        "Defend by steelmanning the bear case and pre-committing to what would change your mind.",
      ],
    },
    {
      id: "bf-recency-fomo",
      title: "Recency Bias & FOMO",
      hook: "We assume tomorrow will look like the recent past — right up until it doesn't.",
      difficulty: "core",
      subtitle: "Why the latest results dominate our expectations, fueling chasing performance and buying tops.",
      conceptCards: [
        {
          emoji: "",
          heading: "The recent past feels like the future",
          body: "Recency bias makes us overweight what just happened. After a long rally, we extrapolate gains forever; after a crash, we expect more pain. This is why investors pour money into funds and sectors after they've already run — buying high precisely because it recently went up.",
        },
        {
          emoji: "",
          heading: "Performance chasing and FOMO",
          body: "Fear of missing out is recency bias plus social proof: a thing has gone up, others are profiting, and we jump in late. Studies consistently show investors' actual returns trail the funds they own because they buy after strong runs and sell after weak ones.",
        },
        {
          emoji: "",
          heading: "Anchor on base rates and process",
          body: "The antidote is to weight long-run base rates over the latest streak, expect mean reversion in extreme returns, and follow a pre-set process (like dollar-cost averaging and rebalancing) that automatically buys low and sells high rather than chasing the recent winner.",
        },
      ],
      keyTerms: [
        { term: "Recency bias", definition: "Overweighting recent events when forming expectations about the future." },
        { term: "FOMO", definition: "Fear of missing out — chasing an asset because it has recently risen." },
        { term: "Performance chasing", definition: "Buying funds or assets after strong runs, often near peaks." },
        { term: "Mean reversion", definition: "The tendency of extreme returns to move back toward the long-run average." },
        { term: "Behavior gap", definition: "The shortfall between investors' returns and their investments' returns from mistimed moves." },
      ],
      realWorldExample: {
        scenario:
          "Money floods into the hottest fund or sector after a banner year, then suffers when performance reverts. The widely-documented 'behavior gap' shows average investors earn less than the very funds they hold, because they buy after the run and sell after the drop.",
        ticker: "",
        lesson: "The recent past is a poor guide to the future, especially at extremes. A pre-set process beats chasing whatever just went up.",
      },
      quiz: [
        {
          question: "Recency bias leads investors to:",
          options: [
            "Weight long-run history",
            "Overweight recent results and extrapolate them forward",
            "Ignore the present",
            "Diversify automatically",
          ],
          answerIndex: 1,
          explanation: "We assume the recent past will continue, extrapolating rallies and crashes alike.",
        },
        {
          question: "The 'behavior gap' refers to:",
          options: [
            "Fees charged by funds",
            "Investors earning less than their own funds due to mistimed buying and selling",
            "The bid-ask spread",
            "A tax loophole",
          ],
          answerIndex: 1,
          explanation: "Chasing performance and selling weakness makes investors' realized returns trail the funds they hold.",
        },
        {
          question: "A defense against recency bias and FOMO is to:",
          options: [
            "Chase the hottest sector",
            "Weight base rates, expect mean reversion, and follow a pre-set process",
            "Buy whatever just rose",
            "Sell after every drop",
          ],
          answerIndex: 1,
          explanation: "A disciplined process like DCA and rebalancing counteracts the urge to chase recent winners.",
        },
      ],
      tryInChat: {
        label: "Check for chasing",
        prompt: "Help me tell whether I'm considering a stock or fund because of its fundamentals or just because it's recently surged",
      },
      takeaways: [
        "Recency bias makes the recent past feel like the future, fueling performance chasing.",
        "FOMO buys tops; the 'behavior gap' shows it costs real returns.",
        "Weight base rates, expect mean reversion, and lean on a pre-set process.",
      ],
    },
  ],
};
