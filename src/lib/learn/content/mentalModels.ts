// Track: Mental Models & Edge — where real edge comes from and the thinking
// habits that separate professionals from the crowd.

import type { RawTrack } from "../types";

export const mentalModels: RawTrack = {
  id: "mental-models",
  name: "Mental Models & Edge",
  tagline: "Where real edge comes from — and why most participants never have any.",
  emoji: "",
  accent: "var(--accent)",
  lessons: [
    {
      id: "mm-variant-perception",
      title: "Variant Perception",
      hook: "You only get paid for being right when the crowd is wrong.",
      difficulty: "core",
      subtitle: "Why edge exists only where your well-founded view differs from the consensus already in the price.",
      conceptCards: [
        {
          emoji: "",
          heading: "Right isn't enough",
          body: "Steinhardt's variant perception: you profit only when you hold a well-founded view that differs from the embedded consensus. Being right about something everyone already knows pays nothing — it's already in the price.",
        },
        {
          emoji: "",
          heading: "Three things you need",
          body: "A real edge requires a differentiated view, a reason the market is wrong, and a catalyst that will close the gap. Missing any one and you have an opinion, not a trade.",
        },
        {
          emoji: "",
          heading: "Map the consensus first",
          body: "Before forming a view, articulate what the market already believes. Your thesis only has value to the extent it departs from that — and you can defend why the crowd is mistaken.",
        },
      ],
      keyTerms: [
        { term: "Variant perception", definition: "A well-founded view that differs from the market consensus — the only kind that pays." },
        { term: "Consensus", definition: "The collective expectation already reflected in an asset's price." },
        { term: "Catalyst", definition: "An event or development expected to move price toward your view." },
        { term: "Edge", definition: "A durable reason to expect better-than-random outcomes from your decisions." },
      ],
      realWorldExample: {
        scenario:
          "Investors who recognized that the market had wrongly extrapolated a temporary problem at an otherwise strong company — and identified the catalyst that would correct it — profited as the gap closed. Those who merely agreed the company was 'good' earned nothing extra.",
        ticker: "",
        lesson: "Alpha lives in the gap between your view and the consensus, not in the quality of the company everyone already admires.",
      },
      quiz: [
        {
          question: "Variant perception means you make money when:",
          options: [
            "You agree with the consensus and are right",
            "Your well-founded view differs from the consensus and proves correct",
            "You buy the most popular stock",
            "You hold the longest",
          ],
          answerIndex: 1,
          explanation: "Returns come from being right and non-consensus. Agreeing with the crowd is already priced in.",
        },
        {
          question: "A complete edge requires a differentiated view, a reason the market is wrong, and:",
          options: ["A high dividend", "A catalyst to close the gap", "Low volatility", "Insider information"],
          answerIndex: 1,
          explanation: "Without a catalyst, a correct contrarian view can stay unrewarded indefinitely.",
        },
        {
          question: "Why map the consensus before forming a thesis?",
          options: [
            "To copy it",
            "Because your view only has value insofar as it departs from what's already priced in",
            "To estimate the dividend",
            "It's required by regulators",
          ],
          answerIndex: 1,
          explanation: "You can't know whether you have an edge until you know what the market already believes.",
        },
      ],
      tryInChat: {
        label: "Find the variant view",
        prompt: "For a stock I name, tell me the consensus view and where a defensible variant perception might exist",
      },
      takeaways: [
        "You're paid for being right and non-consensus — not just right.",
        "An edge needs a differentiated view, a reason the market is wrong, and a catalyst.",
        "Always articulate the consensus first; your edge is the departure from it.",
      ],
    },
    {
      id: "mm-second-order",
      title: "Second-Order Thinking",
      hook: "First-level thinkers ask 'what?'. The paid question is 'and then what?'.",
      difficulty: "core",
      subtitle: "Looking past the obvious reaction to what happens after everyone else has reacted.",
      figure: "second-order",
      conceptCards: [
        {
          emoji: "",
          heading: "Good company, good investment?",
          body: "Howard Marks' distinction: first-level thinking stops at 'this is a good company, buy it.' Second-level thinking asks whether the good news is already in the price and what happens next. The two often lead to opposite conclusions.",
        },
        {
          emoji: "",
          heading: "And then what?",
          body: "Train the reflex to extend every conclusion one step. 'Rates are being cut' (first order) becomes 'everyone already positioned for the cut, so the cut itself may be the sell trigger' (second order). The second step is where the non-obvious money is.",
        },
        {
          emoji: "",
          heading: "Who's on the other side?",
          body: "Every trade has a counterparty. Asking why a presumably rational seller is selling to you — and what they know — guards against the comfortable, crowded, first-level view that feels safe precisely because everyone shares it.",
        },
      ],
      keyTerms: [
        { term: "First-level thinking", definition: "The immediate, obvious reaction to a piece of news or data." },
        { term: "Second-level thinking", definition: "Reasoning about what happens after the obvious reaction, including what's already priced in." },
        { term: "Already priced in", definition: "Information the market has already incorporated, so it no longer moves price." },
        { term: "Consensus trade", definition: "A widely held position that may already reflect the expected outcome." },
      ],
      realWorldExample: {
        scenario:
          "Markets have repeatedly sold off on 'good' news — a long-awaited rate cut, a blowout earnings report — because the news was fully anticipated and the buyers had already bought. First-level reasoning ('good news, go up') missed it entirely.",
        ticker: "",
        lesson: "The obvious interpretation is usually already in the price. Extend the logic one more step to see what the crowd has missed.",
      },
      quiz: [
        {
          question: "Second-order thinking primarily adds the question:",
          options: ["What happened?", "And then what?", "Who reported it?", "What's the dividend?"],
          answerIndex: 1,
          explanation: "It extends the obvious conclusion to its next-order consequences, including what's already discounted.",
        },
        {
          question: "Why can a market fall on genuinely good news?",
          options: [
            "The news was fake",
            "The good outcome was already priced in and anticipated buyers had already bought",
            "Dividends were cut",
            "Volatility is illegal",
          ],
          answerIndex: 1,
          explanation: "When everyone expects and positions for the good news, its arrival can remove the last buyers rather than attract new ones.",
        },
        {
          question: "Asking 'who is on the other side of this trade?' helps because:",
          options: [
            "It's required by law",
            "It checks the comfortable first-level view by considering what the counterparty might know",
            "It raises the dividend",
            "It lowers taxes",
          ],
          answerIndex: 1,
          explanation: "Considering the rational seller's motivation guards against crowded, obvious positions.",
        },
      ],
      tryInChat: {
        label: "Think one step further",
        prompt: "Give me the first-order and second-order read on the latest news for a stock I name",
      },
      takeaways: [
        "A good company isn't a good investment if the good news is already in the price.",
        "Extend every conclusion with 'and then what?' to find the non-obvious move.",
        "Ask who's on the other side — it breaks the comfortable consensus view.",
      ],
    },
    {
      id: "mm-circle-competence",
      title: "Circle of Competence",
      hook: "You don't have to swing at every pitch — only the ones you understand.",
      difficulty: "core",
      subtitle: "Knowing what you actually understand, and having the discipline to pass on everything else.",
      conceptCards: [
        {
          emoji: "",
          heading: "Know the edge of what you know",
          body: "Buffett's circle of competence isn't about how big your circle is — it's about knowing exactly where its boundary lies. The investor who honestly knows the limit of their understanding has a real advantage over a smarter one who doesn't.",
        },
        {
          emoji: "",
          heading: "No called strikes in investing",
          body: "Unlike baseball, the market never forces you to swing. You can wait for a pitch squarely in your competence and let everything else go by without penalty. Most damage comes from acting confidently outside the circle.",
        },
        {
          emoji: "",
          heading: "Widen it slowly and honestly",
          body: "The circle can grow with genuine study, but only honestly — pretending to understand a business you don't is how good investors blow up. 'Too hard, pass' is a complete and respectable answer.",
        },
      ],
      keyTerms: [
        { term: "Circle of competence", definition: "The set of businesses and situations you genuinely understand well enough to judge." },
        { term: "Too-hard pile", definition: "Opportunities deliberately passed on because they fall outside your understanding." },
        { term: "Overconfidence bias", definition: "The tendency to overrate the accuracy of one's own knowledge and forecasts." },
        { term: "Opportunity cost", definition: "The value of the best alternative given up when capital or attention is committed." },
      ],
      realWorldExample: {
        scenario:
          "Many disciplined investors sat out the late-1990s tech mania, openly saying they couldn't value the businesses. They missed the final run-up — and also the collapse — while those who strayed outside their competence to chase it took severe losses.",
        ticker: "",
        lesson: "Staying inside the circle costs you some winners but spares you the catastrophic losses that come from pretending to understand.",
      },
      quiz: [
        {
          question: "The circle of competence is mainly about:",
          options: [
            "Making your circle as large as possible",
            "Knowing precisely where the boundary of your understanding lies",
            "Owning many stocks",
            "Trading frequently",
          ],
          answerIndex: 1,
          explanation: "What matters is honesty about the edge of your knowledge, not the size of the circle.",
        },
        {
          question: "'There are no called strikes in investing' means:",
          options: [
            "You must always be invested",
            "You can wait indefinitely for an opportunity you understand, with no penalty for passing",
            "Every trade must win",
            "You should swing at everything",
          ],
          answerIndex: 1,
          explanation: "Unlike baseball, you're never forced to act, so you can wait for pitches inside your competence.",
        },
        {
          question: "The safest way to widen your circle is to:",
          options: [
            "Pretend to understand new areas",
            "Study genuinely and admit what you still don't grasp",
            "Copy other investors",
            "Use more leverage",
          ],
          answerIndex: 1,
          explanation: "Honest study expands competence; faking it is how investors stray into blow-ups.",
        },
      ],
      tryInChat: {
        label: "Pressure-test understanding",
        prompt: "Ask me questions about a business I'm considering to test whether it's really inside my circle of competence",
      },
      takeaways: [
        "Edge comes from knowing the boundary of your competence, not from a big circle.",
        "You're never forced to act — wait for opportunities you genuinely understand.",
        "'Too hard, pass' is a complete answer; widen the circle only through honest study.",
      ],
    },
    {
      id: "mm-base-rates",
      title: "Base Rates & the Outside View",
      hook: "The boring statistic beats your exciting story.",
      difficulty: "advanced",
      subtitle: "Anchoring forecasts on what usually happens to companies like this one, before adjusting for specifics.",
      figure: "base-rate",
      conceptCards: [
        {
          emoji: "",
          heading: "Inside vs outside view",
          body: "Mauboussin's framing: the inside view builds a vivid bottom-up story about this specific company; the outside view asks what usually happens to the broad reference class it belongs to. Most forecasts fail by over-weighting the story and ignoring the base rate.",
        },
        {
          emoji: "",
          heading: "Start with the base rate",
          body: "What share of hyper-growth firms sustain 40%+ growth for five years? How often do big acquisitions create value? Anchor on these reference-class frequencies first, then adjust for the specific case — never the other way around.",
        },
        {
          emoji: "",
          heading: "Vivid stories mislead",
          body: "The more compelling and detailed a narrative, the more it tends to crowd out base rates — a known cognitive trap. A great story about why 'this time is different' is exactly when to reach hardest for the statistics.",
        },
      ],
      keyTerms: [
        { term: "Base rate", definition: "The frequency of an outcome across a broad reference class of similar cases." },
        { term: "Outside view", definition: "Forecasting from the reference class rather than the specifics of the single case." },
        { term: "Reference class", definition: "The set of comparable situations used to estimate a base rate." },
        { term: "Base-rate neglect", definition: "Ignoring statistical frequencies in favor of a vivid, case-specific story." },
      ],
      realWorldExample: {
        scenario:
          "Investors repeatedly pay up for companies expected to sustain extraordinary growth for a decade, even though the base rate of firms doing so is very low. The exciting bottom-up story consistently beats the sobering statistic — until reality reverts to the base rate.",
        ticker: "",
        lesson: "When a forecast assumes a company will defy the reference class, demand a very strong, specific reason. Usually there isn't one.",
      },
      quiz: [
        {
          question: "The 'outside view' forecasts by:",
          options: [
            "Building a detailed story about the specific company",
            "Anchoring on what usually happens to similar companies, then adjusting",
            "Asking management",
            "Reading the stock chart",
          ],
          answerIndex: 1,
          explanation: "The outside view starts from the reference-class base rate and adjusts for specifics, rather than starting from the single case.",
        },
        {
          question: "Base-rate neglect is the tendency to:",
          options: [
            "Overweight statistics",
            "Ignore reference-class frequencies in favor of a vivid case-specific narrative",
            "Forecast too conservatively",
            "Use too much data",
          ],
          answerIndex: 1,
          explanation: "A compelling story crowds out the boring-but-informative base rate, biasing the forecast.",
        },
        {
          question: "The correct order of operations is to:",
          options: [
            "Build the story, then maybe glance at base rates",
            "Anchor on the base rate first, then adjust for the specific case",
            "Ignore base rates entirely",
            "Average the two with equal weight",
          ],
          answerIndex: 1,
          explanation: "Start from the reference class and adjust — anchoring on the story first lets it dominate.",
        },
      ],
      tryInChat: {
        label: "Apply the outside view",
        prompt: "For a high-growth company I name, tell me the base rate for sustaining that growth and how it reframes the forecast",
      },
      takeaways: [
        "Anchor forecasts on the reference-class base rate first, then adjust for specifics.",
        "Vivid bottom-up stories systematically crowd out informative statistics.",
        "When a thesis requires defying the base rate, demand an unusually strong reason.",
      ],
    },
    {
      id: "mm-expected-value",
      title: "Thinking in Bets & Expected Value",
      hook: "Stop predicting. Start weighing probability-weighted payoffs.",
      difficulty: "advanced",
      subtitle: "Treating every decision as a bet with a distribution of outcomes, where asymmetry is the prize.",
      widget: {
        type: "expected_value",
        title: "Build an asymmetric bet",
        prompt: "Set a win probability below 50% but a large upside versus a small downside, and watch expected value turn positive.",
        params: { winProbPct: 40, winPct: 120, lossPct: 25 },
      },
      conceptCards: [
        {
          emoji: "",
          heading: "Outcomes are distributions",
          body: "Annie Duke's 'thinking in bets': no decision has a single certain outcome, only a range of possibilities with probabilities. The right unit of analysis is the whole distribution of payoffs, not a point prediction.",
        },
        {
          emoji: "",
          heading: "Expected value, not win rate",
          body: "Expected value = Σ(probability × outcome). A high-probability trade can be a bad bet if the payoff is poor, and a 30% shot can be excellent if the upside is large enough. Professionals optimize EV, not their hit rate.",
        },
        {
          emoji: "",
          heading: "Asymmetry is the edge",
          body: "The bets worth hunting risk a little to make a lot — small, capped downside against large, open-ended upside. With enough asymmetry, EV is positive even when you're wrong more often than you're right.",
        },
      ],
      keyTerms: [
        { term: "Expected value (EV)", definition: "The probability-weighted average of all possible outcomes of a decision." },
        { term: "Asymmetry", definition: "A payoff profile where potential gain and loss are unequal in size." },
        { term: "Win rate", definition: "The share of bets that turn out positive — not the same as profitability." },
        { term: "Resulting", definition: "Duke's term for wrongly judging a decision's quality solely by its outcome." },
      ],
      realWorldExample: {
        scenario:
          "A position that risks a modest, capped loss for a multiple-times upside can be worth taking even if it's more likely to fail than succeed — because the rare win more than pays for the frequent small losses. The math, not the hit rate, justifies it.",
        ticker: "",
        lesson: "Judge a bet by its expected value and payoff shape, not by whether any single instance won. Process over outcome.",
      },
      quiz: [
        {
          question: "Expected value is calculated as:",
          options: [
            "The most likely outcome",
            "The probability-weighted sum of all possible outcomes",
            "The best-case outcome",
            "The win rate times the price",
          ],
          answerIndex: 1,
          explanation: "EV = Σ(probability × outcome), accounting for the full distribution, not just the central case.",
        },
        {
          question: "A bet with a sub-50% win probability can still be excellent if:",
          options: [
            "It's popular",
            "The upside is large enough relative to the downside (favorable asymmetry)",
            "It has a high win rate",
            "It pays a dividend",
          ],
          answerIndex: 1,
          explanation: "Enough asymmetry makes EV positive even when you lose more often than you win.",
        },
        {
          question: "'Resulting' is the error of:",
          options: [
            "Computing EV",
            "Judging a decision's quality only by how it turned out",
            "Diversifying too much",
            "Using probabilities",
          ],
          answerIndex: 1,
          explanation: "A good decision can have a bad outcome and vice versa; judging by results alone confuses luck with skill.",
        },
      ],
      tryInChat: {
        label: "Weigh a bet",
        prompt: "Help me frame an investment as an expected-value bet with probabilities and payoffs for a stock I name",
      },
      takeaways: [
        "Every decision is a bet over a distribution of outcomes, not a single prediction.",
        "Optimize expected value, not win rate — payoff size matters as much as probability.",
        "Hunt asymmetry: small capped downside, large open-ended upside, makes EV positive even when often wrong.",
      ],
    },
    {
      id: "mm-inversion",
      title: "Inversion",
      hook: "It's easier to avoid stupidity than to seek brilliance.",
      difficulty: "core",
      subtitle: "Solving problems backwards — asking how you'd guarantee failure, then refusing to do those things.",
      figure: "inversion",
      conceptCards: [
        {
          emoji: "",
          heading: "Turn the problem around",
          body: "Munger's habit, borrowed from the mathematician Jacobi: 'invert, always invert.' Instead of asking how to succeed, ask how you'd guarantee failure — then systematically avoid every item on that list. The inverted question often has far clearer answers.",
        },
        {
          emoji: "",
          heading: "Avoiding loss compounds",
          body: "In investing, sidestepping ruin matters more than catching every winner, because you compound from the capital you keep. 'How could I permanently lose money here?' — overpaying, over-leveraging, fraud, obsolescence — is a more tractable question than 'how do I get rich?'",
        },
        {
          emoji: "",
          heading: "A pre-mortem is inversion in action",
          body: "Before committing, imagine the position has already blown up and ask why. This surfaces the failure modes you'd otherwise rationalize away, turning a vague optimism into a concrete checklist of what to monitor and avoid.",
        },
      ],
      keyTerms: [
        { term: "Inversion", definition: "Approaching a problem backwards — solving for what to avoid rather than what to achieve." },
        { term: "Pre-mortem", definition: "Imagining a future failure in advance to surface hidden risks before acting." },
        { term: "Via negativa", definition: "Improving by removal — eliminating mistakes and fragilities rather than adding." },
        { term: "Avoiding ruin", definition: "Prioritizing the elimination of catastrophic outcomes over maximizing upside." },
      ],
      realWorldExample: {
        scenario:
          "Asked how to build a great investing record, Munger reframed it: avoid the standard ways to fail — don't overpay, don't use ruinous leverage, don't lie to yourself, stay inside your competence. Dodging those reliably beat chasing brilliance.",
        ticker: "",
        lesson: "The list of ways to fail is shorter and clearer than the list of ways to win. Eliminate the failures and good outcomes take care of themselves.",
      },
      quiz: [
        {
          question: "Inversion means approaching a problem by:",
          options: [
            "Working out how to succeed directly",
            "Asking how you'd guarantee failure, then avoiding those things",
            "Copying competitors",
            "Maximizing leverage",
          ],
          answerIndex: 1,
          explanation: "Inverting asks what causes failure and systematically avoids it — often a clearer path than seeking success head-on.",
        },
        {
          question: "Why does avoiding loss matter so much in investing?",
          options: [
            "Losses are tax-free",
            "You compound from the capital you keep, so dodging ruin protects the whole record",
            "Gains are guaranteed",
            "Regulators require it",
          ],
          answerIndex: 1,
          explanation: "Catastrophic losses end the compounding; preventing them is more valuable than catching every winner.",
        },
        {
          question: "A pre-mortem applies inversion by:",
          options: [
            "Celebrating success early",
            "Assuming the decision failed and asking why, to surface risks beforehand",
            "Ignoring the downside",
            "Adding leverage",
          ],
          answerIndex: 1,
          explanation: "Imagining the failure in advance exposes failure modes you'd otherwise rationalize away.",
        },
      ],
      tryInChat: {
        label: "Invert a thesis",
        prompt: "For a stock I'm considering, list the ways this investment could permanently lose money, then how to avoid each",
      },
      takeaways: [
        "Invert: ask how you'd guarantee failure, then avoid those things.",
        "Avoiding ruin compounds, because you grow only from the capital you keep.",
        "A pre-mortem turns vague optimism into a concrete list of risks to monitor.",
      ],
    },
    {
      id: "mm-incentives",
      title: "Follow the Incentives",
      hook: "“Show me the incentive and I'll show you the outcome.”",
      difficulty: "core",
      subtitle: "Why understanding how people are paid predicts behavior better than what they say.",
      figure: "incentives",
      conceptCards: [
        {
          emoji: "",
          heading: "Incentives drive behavior",
          body: "Munger called incentives the most powerful force shaping human behavior — stronger than intelligence or stated intentions. Before trusting any forecast, rating, or recommendation, ask how the person delivering it gets paid, and what behavior that compensation rewards.",
        },
        {
          emoji: "",
          heading: "Misaligned agents",
          body: "Management paid on short-term EPS may cut research or buy back stock to hit a target; a fund paid on assets wants size, not performance; a sell-side analyst's bank may court the company's banking business. None are villains — they're responding rationally to their incentives.",
        },
        {
          emoji: "",
          heading: "Align before you trust",
          body: "Look for skin in the game: insiders who own meaningful stock, pay tied to long-term returns on capital, and founders with real downside. Incentive alignment doesn't guarantee good decisions, but its absence is a reliable warning that interests may diverge from yours.",
        },
      ],
      keyTerms: [
        { term: "Incentive", definition: "A reward structure that shapes how a person or institution behaves." },
        { term: "Principal-agent problem", definition: "When an agent (manager, fund) acts in their own interest over the principal's (owner's)." },
        { term: "Skin in the game", definition: "Having personal downside exposure that aligns one's interests with outcomes." },
        { term: "Conflict of interest", definition: "A situation where someone's incentives diverge from the advice they give." },
        { term: "Compensation structure", definition: "How pay is tied to metrics, which predicts the behavior it will produce." },
      ],
      realWorldExample: {
        scenario:
          "Executives compensated heavily on near-term earnings per share have repeatedly funded buybacks with debt to hit targets — boosting EPS while raising risk. The behavior wasn't irrational; the pay package rewarded exactly that.",
        ticker: "",
        lesson: "To predict what a company or adviser will do, study how they're paid. Stated intentions bend toward the incentive every time.",
      },
      quiz: [
        {
          question: "Munger argued that the strongest force shaping behavior is:",
          options: ["Intelligence", "Incentives", "Stated intentions", "Regulation"],
          answerIndex: 1,
          explanation: "Incentives reliably trump intelligence and good intentions in driving how people actually act.",
        },
        {
          question: "The principal-agent problem arises when:",
          options: [
            "Owners and managers share all interests",
            "An agent acts in their own interest rather than the owner's",
            "There are no managers",
            "A company has no debt",
          ],
          answerIndex: 1,
          explanation: "Agents (managers, funds) optimizing their own incentives can act against the principals they serve.",
        },
        {
          question: "'Skin in the game' aligns interests by:",
          options: [
            "Removing all risk",
            "Giving the decision-maker personal downside tied to outcomes",
            "Raising fees",
            "Guaranteeing returns",
          ],
          answerIndex: 1,
          explanation: "Real personal exposure to losses pulls an agent's incentives toward the owner's interests.",
        },
      ],
      tryInChat: {
        label: "Map the incentives",
        prompt: "For a company I name, explain how management is compensated and what behavior those incentives reward",
      },
      takeaways: [
        "Incentives predict behavior better than stated intentions.",
        "Watch for principal-agent gaps: managers, funds, and analysts paid to do something other than serve you.",
        "Favor skin in the game and pay tied to long-term returns on capital.",
      ],
    },
    {
      id: "mm-bayesian",
      title: "Updating Like a Bayesian",
      hook: "Strong opinions, weakly held — and revised the moment the facts move.",
      difficulty: "advanced",
      subtitle: "Treating beliefs as probabilities and updating them proportionally as new evidence arrives.",
      figure: "bayes",
      conceptCards: [
        {
          emoji: "",
          heading: "Beliefs are probabilities, not flags",
          body: "A Bayesian holds a view as a probability (say, 70% confident), not a yes/no flag. New evidence shifts that probability up or down by how surprising it is under the competing hypotheses — you update, you don't flip-flop or dig in.",
        },
        {
          emoji: "",
          heading: "Start from the base rate",
          body: "Your prior should be anchored on the base rate before the specifics — the reference-class frequency. Then each piece of evidence nudges the posterior. People err by ignoring the prior (base-rate neglect) or by overreacting to one vivid data point.",
        },
        {
          emoji: "",
          heading: "Strong priors need strong evidence",
          body: "The more established your prior, the more evidence it takes to move it — but it should still move. The twin failures are anchoring (never updating) and whipsawing (overupdating on noise). Good investors change their minds when, and only when, the weight of evidence warrants.",
        },
      ],
      keyTerms: [
        { term: "Prior", definition: "Your probability estimate before seeing new evidence, ideally anchored on the base rate." },
        { term: "Posterior", definition: "The updated probability after incorporating new evidence." },
        { term: "Bayesian updating", definition: "Revising a probability in proportion to how the evidence favors one hypothesis over another." },
        { term: "Base-rate neglect", definition: "Failing to anchor on the prior and overweighting case-specific information." },
        { term: "Confirmation bias", definition: "Seeking and overweighting evidence that supports a view you already hold." },
      ],
      realWorldExample: {
        scenario:
          "An investor sure a thesis was right kept buying as contradicting facts piled up, treating each as noise. A Bayesian would have lowered the probability with each disconfirming data point and cut the position long before the thesis fully broke.",
        ticker: "",
        lesson: "Hold views as probabilities and move them with the evidence. Refusing to update — or flipping on every headline — both destroy returns.",
      },
      quiz: [
        {
          question: "A Bayesian treats a belief as:",
          options: [
            "A fixed yes/no fact",
            "A probability to be updated as evidence arrives",
            "An emotion",
            "A prediction that can't change",
          ],
          answerIndex: 1,
          explanation: "Beliefs are probabilities; new evidence shifts them proportionally rather than flipping them.",
        },
        {
          question: "Your prior should ideally be anchored on:",
          options: [
            "The most recent headline",
            "The base rate of the relevant reference class",
            "Your gut feeling",
            "The stock price",
          ],
          answerIndex: 1,
          explanation: "Starting from the reference-class base rate avoids base-rate neglect before adjusting for specifics.",
        },
        {
          question: "The two opposite failures of updating are:",
          options: [
            "Buying and selling",
            "Anchoring (never updating) and whipsawing (overreacting to noise)",
            "Diversifying and concentrating",
            "Reading and ignoring",
          ],
          answerIndex: 1,
          explanation: "Good updating sits between refusing to move and overreacting to every data point.",
        },
      ],
      tryInChat: {
        label: "Update a thesis",
        prompt: "Help me state my prior probability on a thesis for a stock I name and update it given specific new evidence",
      },
      takeaways: [
        "Hold beliefs as probabilities and update them in proportion to the evidence.",
        "Anchor your prior on the base rate, then adjust for specifics.",
        "Avoid both anchoring (never updating) and whipsawing (overupdating on noise).",
      ],
    },
    {
      id: "mm-ergodicity",
      title: "Ergodicity & the Ruin Problem",
      hook: "A bet that's great on average can still wipe out everyone who takes it.",
      difficulty: "mastery",
      subtitle: "Why the average outcome across many people can differ from your outcome over time — and why ruin changes everything.",
      conceptCards: [
        {
          emoji: "",
          heading: "Ensemble vs time averages",
          body: "An ensemble average is the result across many people taking a bet once; a time average is the result for one person repeating it. When the two differ, the process is non-ergodic — and for compounding wealth, your time average is what actually happens to you, not the rosy ensemble figure.",
        },
        {
          emoji: "",
          heading: "Why ruin breaks the average",
          body: "If a bet carries any chance of total ruin and you repeat it, ruin eventually arrives — and you can't continue from zero. A positive expected value computed across a crowd is meaningless to you if a single bad draw removes you from the game permanently.",
        },
        {
          emoji: "",
          heading: "Avoid uncle points at all costs",
          body: "This is the mathematical backbone of risk management: never accept a path with a real probability of ruin, however attractive the average. Size bets so that no sequence of losses can knock you out, because survival is the precondition for compounding.",
        },
      ],
      keyTerms: [
        { term: "Ergodicity", definition: "A property where the time average for one path equals the ensemble average across many." },
        { term: "Ensemble average", definition: "The expected outcome across many participants each taking a bet once." },
        { term: "Time average", definition: "The outcome for a single participant repeating a bet over time." },
        { term: "Risk of ruin", definition: "The probability of losing enough to be permanently removed from the game." },
        { term: "Non-ergodic", definition: "A process where repeating over time can diverge sharply from the crowd average." },
      ],
      realWorldExample: {
        scenario:
          "Consider a coin flip that pays +50% or −40% of your wealth. The ensemble average looks positive, but repeated over time the multiplicative losses drag a single player's wealth toward zero. Many leveraged strategies share this shape: great on paper, ruinous when actually compounded.",
        ticker: "",
        lesson: "Positive expected value across a crowd doesn't protect you when you compound one path through time. Refuse any strategy with a real chance of ruin, however good its average.",
      },
      quiz: [
        {
          question: "A process is non-ergodic when:",
          options: [
            "Everyone gets the same result",
            "The time average for one path differs from the ensemble average across many",
            "There is no risk",
            "Returns are guaranteed",
          ],
          answerIndex: 1,
          explanation: "Non-ergodic processes make a single compounding path diverge from the crowd's average outcome.",
        },
        {
          question: "Why does a chance of ruin invalidate a positive average?",
          options: [
            "Averages are always wrong",
            "If you're removed from the game permanently, you can't continue compounding from zero",
            "Taxes increase",
            "Ruin is impossible",
          ],
          answerIndex: 1,
          explanation: "Ruin ends the sequence; the rosy ensemble average is irrelevant once you're knocked out.",
        },
        {
          question: "The practical lesson of ergodicity for investors is:",
          options: [
            "Maximize expected value regardless of risk",
            "Never accept a path with a real probability of ruin, however good the average",
            "Always use leverage",
            "Ignore position sizing",
          ],
          answerIndex: 1,
          explanation: "Survival is the precondition for compounding, so avoid any strategy that can permanently wipe you out.",
        },
      ],
      tryInChat: {
        label: "Test for ruin",
        prompt: "Help me check whether a strategy I describe has any path to ruin and how to size it so it can't wipe me out",
      },
      takeaways: [
        "The crowd's average outcome (ensemble) can differ from your outcome over time (time average).",
        "Any real chance of ruin invalidates a positive average — you can't compound from zero.",
        "Size so that no sequence of losses removes you from the game; survival comes first.",
      ],
    },
  ],
};
