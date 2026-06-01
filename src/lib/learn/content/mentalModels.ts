// Track: Mental Models & Edge — where real edge comes from and the thinking
// habits that separate professionals from the crowd.

import type { RawTrack } from "../types";

export const mentalModels: RawTrack = {
  id: "mental-models",
  name: "Mental Models & Edge",
  tagline: "Where real edge comes from — and why most participants never have any.",
  emoji: "",
  accent: "#818cf8",
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
  ],
};
