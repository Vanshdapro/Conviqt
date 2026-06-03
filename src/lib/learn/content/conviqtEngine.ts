// Track: The Conviqt Engine — how the product's AI investment process works and
// how to read its outputs like a portfolio manager. Aligned to the real
// pipeline: a cited FactSheet, independent specialist lenses, a synthesizing
// judge, a visible disagreement signal, and a fully public track record.

import type { RawTrack } from "../types";

export const conviqtEngine: RawTrack = {
  id: "conviqt-engine",
  name: "The Conviqt Engine",
  tagline: "How an AI investment committee actually picks — and how to read it like a PM.",
  emoji: "",
  accent: "#f472b6",
  lessons: [
    {
      id: "ce-the-pipeline",
      title: "Inside the Pipeline",
      hook: "A cited fact sheet, independent lenses, and a judge that has to show its work.",
      difficulty: "advanced",
      subtitle: "How Conviqt turns a ticker into a verdict every number of which is traceable to a source.",
      figure: "pipeline",
      conceptCards: [
        {
          emoji: "",
          heading: "Facts before opinions",
          body: "A sweep agent gathers the data first, building a structured FactSheet where every quantitative claim carries a source URL. No fact without a source ever gets rendered — opinions are only allowed to stand on cited evidence.",
        },
        {
          emoji: "",
          heading: "Independent lenses, then synthesis",
          body: "Specialist lenses — fundamentals, technicals, sentiment, macro — each score the same FactSheet independently and produce a BUY/HOLD/SELL with cited reasons. A judge then synthesizes them into a final verdict, a conviction, and a disagreement score.",
        },
        {
          emoji: "",
          heading: "Why a committee beats a guru",
          body: "Independent inputs synthesized by a structured process reduce single-point bias and make the reasoning auditable. The goal isn't to sound certain — it's to show where the evidence is strong, where it conflicts, and to cite all of it.",
        },
      ],
      keyTerms: [
        { term: "FactSheet", definition: "The structured set of source-cited facts the sweep agent assembles before any analysis." },
        { term: "Specialist lens", definition: "An independent agent scoring one dimension (fundamentals, technicals, sentiment, or macro)." },
        { term: "Judge / synthesis", definition: "The step that combines the lenses into a verdict, conviction, and disagreement score." },
        { term: "Citation discipline", definition: "The rule that every rendered number must trace to a source URL." },
        { term: "Conviction", definition: "How strongly the synthesized evidence supports the verdict." },
      ],
      realWorldExample: {
        scenario:
          "Ask Conviqt to analyze a ticker and it first builds a cited FactSheet, then runs independent lenses that may disagree, then a judge that synthesizes them — surfacing not just a rating but how confident and how contested it is, with sources attached.",
        ticker: "NVDA",
        lesson: "A structured, cited, multi-lens process is designed for transparency, not false certainty. You can audit every claim back to its source.",
      },
      quiz: [
        {
          question: "What does the sweep agent produce before any opinion is formed?",
          options: [
            "A price target",
            "A structured FactSheet where every claim carries a source URL",
            "A buy order",
            "A chart",
          ],
          answerIndex: 1,
          explanation: "Facts come first: a source-cited FactSheet grounds everything downstream, and no uncited fact is rendered.",
        },
        {
          question: "Why do the specialist lenses score the FactSheet independently?",
          options: [
            "To save money",
            "To reduce single-point bias and make disagreement visible",
            "To agree faster",
            "To avoid citations",
          ],
          answerIndex: 1,
          explanation: "Independent inputs lower correlated bias and let genuine disagreement surface rather than being averaged away early.",
        },
        {
          question: "The pipeline's core transparency rule is:",
          options: [
            "Always output BUY",
            "Every rendered number must trace to a source URL",
            "Never show disagreement",
            "Use one agent only",
          ],
          answerIndex: 1,
          explanation: "Citation discipline — no fact without a source — is what makes the output auditable.",
        },
      ],
      tryInChat: {
        label: "Run the pipeline",
        prompt: "Analyze NVDA and show me the cited facts, the specialist views, and where they disagree",
      },
      takeaways: [
        "Facts first: a source-cited FactSheet grounds the whole process.",
        "Independent specialist lenses are synthesized into a verdict, conviction, and disagreement score.",
        "Every rendered number traces to a source URL — transparency over false certainty.",
      ],
    },
    {
      id: "ce-disagreement-alpha",
      title: "Disagreement as a Signal",
      hook: "When the smartest lenses split, that's information — not noise.",
      difficulty: "advanced",
      subtitle: "Why Conviqt treats the spread of opinion across its lenses as a first-class output.",
      figure: "disagreement",
      conceptCards: [
        {
          emoji: "",
          heading: "Spread is a measurement",
          body: "Conviqt reports how much its lenses agree or split on a name. High agreement signals high conviction; a fractured committee signals genuine uncertainty that a single confident rating would hide. The disagreement score makes that uncertainty explicit.",
        },
        {
          emoji: "",
          heading: "Where consensus is fragile",
          body: "Disagreement points to exactly the places where the embedded consensus is most contestable — the ground variant perception is built on. A name everyone's lens loves is likely already priced; a contested one may hold an edge.",
        },
        {
          emoji: "",
          heading: "Read conviction and disagreement together",
          body: "Neither number means much alone. A high-conviction, low-disagreement BUY is a clean signal; a high-disagreement one is a flag to dig into the bear case. Always read the two side by side.",
        },
      ],
      keyTerms: [
        { term: "Disagreement score", definition: "A measure of how much the specialist lenses diverge on a given name." },
        { term: "Conviction", definition: "How strongly the synthesized evidence supports the verdict." },
        { term: "Consensus fragility", definition: "How contestable the prevailing view is — where disagreement is highest." },
        { term: "Signal vs noise", definition: "Distinguishing informative divergence from random variation." },
      ],
      realWorldExample: {
        scenario:
          "On a contested stock, Conviqt's fundamentals lens might score BUY on cheap cash flows while its macro and sentiment lenses score SELL on cycle and positioning risk. The high disagreement score flags a real debate worth investigating rather than papering over.",
        ticker: "",
        lesson: "A split committee is telling you where the genuine uncertainty — and potential edge — lives. Treat disagreement as information, not a defect.",
      },
      quiz: [
        {
          question: "A high disagreement score across the lenses indicates:",
          options: [
            "The data is wrong",
            "Genuine uncertainty and a contestable consensus worth investigating",
            "A guaranteed sell",
            "Nothing useful",
          ],
          answerIndex: 1,
          explanation: "Divergence flags real debate and fragile consensus — exactly where edge may exist — not a flaw to hide.",
        },
        {
          question: "Conviction and disagreement should be read:",
          options: [
            "Conviction alone",
            "Together, since each is misleading in isolation",
            "Disagreement alone",
            "Never",
          ],
          answerIndex: 1,
          explanation: "A clean BUY pairs high conviction with low disagreement; high disagreement is a prompt to examine the bear case.",
        },
        {
          question: "Disagreement connects to variant perception because it highlights:",
          options: [
            "The most popular stocks",
            "Where the embedded consensus is most contestable",
            "The highest dividend",
            "The lowest volatility",
          ],
          answerIndex: 1,
          explanation: "Contested names are where consensus is fragile — the ground on which a differentiated, non-consensus view can be built.",
        },
      ],
      tryInChat: {
        label: "Find the disagreement",
        prompt: "Show me stocks where Conviqt's lenses disagree most right now and explain what's driving the split",
      },
      takeaways: [
        "Disagreement is a first-class output, not noise — it measures genuine uncertainty.",
        "High disagreement marks fragile consensus, where variant-perception edge can live.",
        "Always read conviction and disagreement together, never in isolation.",
      ],
    },
    {
      id: "ce-reading-alpha-tracker",
      title: "Reading the Alpha Tracker Like a PM",
      hook: "Entry, target, stop, catalyst — and the losers left in.",
      difficulty: "advanced",
      subtitle: "Evaluating a track record the way a professional does: by process and expectancy, not cherry-picked wins.",
      conceptCards: [
        {
          emoji: "",
          heading: "Every pick is fully specified",
          body: "Each Alpha Tracker pick ships with an entry, a price target, a hard stop, a specific catalyst, a conviction score, and a written bear case. A claim you can't falsify isn't a thesis; full specification is what makes the record honest.",
        },
        {
          emoji: "",
          heading: "Losers stay visible",
          body: "Picks that hit their stop are never deleted. A track record is only credible when the failures remain on the page — a record showing only winners is a marketing document, not a measurement.",
        },
        {
          emoji: "",
          heading: "Judge by expectancy",
          body: "Evaluate a strategy by win rate and average win versus average loss together — its expectancy — not by any single trade. A modest hit rate with large winners and small losers can be excellent; a high hit rate with rare huge losers can be a disaster.",
        },
      ],
      keyTerms: [
        { term: "Entry / target / stop", definition: "The price you start at, where you aim, and where you admit the thesis failed." },
        { term: "Catalyst", definition: "The specific event expected to move the stock toward the target." },
        { term: "Expectancy", definition: "Average outcome per trade = (win rate × avg win) − (loss rate × avg loss)." },
        { term: "Track record integrity", definition: "Keeping losers visible so the record measures process honestly." },
        { term: "Bear case", definition: "The pre-stated reasons the thesis could be wrong." },
      ],
      realWorldExample: {
        scenario:
          "Conviqt's public Alpha Tracker keeps every pick — winners and losers — with its entry, target, hard stop, and catalyst on display. You can compute the strategy's expectancy yourself rather than trusting a highlight reel.",
        ticker: "",
        lesson: "A credible record shows its scars. Judge the process and the expectancy, never a hand-picked winner.",
      },
      quiz: [
        {
          question: "Why does a credible track record keep its losers visible?",
          options: [
            "To look modest",
            "Because a record showing only winners measures marketing, not process",
            "It's legally required to delete winners",
            "To raise the win rate",
          ],
          answerIndex: 1,
          explanation: "Honest measurement requires the failures to stay on the page; hiding them makes the record meaningless.",
        },
        {
          question: "Expectancy is best described as:",
          options: [
            "The win rate alone",
            "Average outcome per trade, combining win rate with average win and loss sizes",
            "The largest win",
            "The number of trades",
          ],
          answerIndex: 1,
          explanation: "Expectancy blends how often you win with how much you win and lose — the true measure of a strategy.",
        },
        {
          question: "A strategy with a modest win rate can still be excellent if:",
          options: [
            "It never loses",
            "Its winners are large and its losers are small (high expectancy)",
            "It trades constantly",
            "It avoids stops",
          ],
          answerIndex: 1,
          explanation: "Favorable average win/loss can make a sub-50% hit rate highly profitable.",
        },
      ],
      tryInChat: {
        label: "Evaluate a track record",
        prompt: "Walk me through how to judge an investing track record by expectancy rather than cherry-picked wins",
      },
      takeaways: [
        "Every credible pick is fully specified: entry, target, hard stop, catalyst, bear case.",
        "Keeping losers visible is what makes a track record honest.",
        "Judge by expectancy — win rate and average win/loss together — not single trades.",
      ],
    },
    {
      id: "ce-lesson-to-research",
      title: "From Lesson to Live Research",
      hook: "Every concept here has a button that turns it into real analysis.",
      difficulty: "advanced",
      subtitle: "Turning what you've learned into a repeatable research workflow using the Conviqt products.",
      conceptCards: [
        {
          emoji: "",
          heading: "Each lesson bridges into the product",
          body: "Every lesson ends with a 'try in research' prompt that opens Chat pre-loaded to apply the concept to a real ticker. The Academy isn't separate from the product — it's the on-ramp that teaches you what to ask the Council and how to read the answer.",
        },
        {
          emoji: "",
          heading: "A repeatable loop",
          body: "Run the same sequence every time: analyze a ticker for the cited FactSheet and verdict, read where the lenses disagree, pull the bear case, then check the Alpha Tracker for how similar setups have played out. Concept → query → cited evidence → decision.",
        },
        {
          emoji: "",
          heading: "Let the citations do the work",
          body: "Because every number in a Conviqt verdict traces to a source URL, you can verify rather than trust. Use the lessons to know which claims to interrogate — margins, growth assumptions, leverage — and click through to the sources before you act.",
        },
      ],
      keyTerms: [
        { term: "Try-in-research prompt", definition: "The deep-link at the end of each lesson that opens Chat to apply the concept." },
        { term: "Research loop", definition: "The repeatable cycle of query, cited evidence, disagreement, and decision." },
        { term: "Citation trail", definition: "The source URLs behind every rendered number, enabling verification." },
        { term: "Alpha Tracker", definition: "The public record of picks with entry, target, stop, and outcome." },
      ],
      realWorldExample: {
        scenario:
          "After the unit-economics lesson, a learner opens Chat to analyze a SaaS name, reads the cited growth and margin facts, notes where the sentiment and fundamentals lenses split, and checks the Alpha Tracker for how comparable setups resolved — a full loop from concept to decision.",
        ticker: "",
        lesson: "The Academy and the Council are one system. Lessons teach the question; the product supplies cited evidence; the Tracker shows the track record. Run the loop.",
      },
      quiz: [
        {
          question: "The 'try in research' prompt at the end of each lesson:",
          options: [
            "Posts to social media",
            "Opens Chat pre-loaded to apply the concept to a real ticker",
            "Buys the stock",
            "Closes the lesson",
          ],
          answerIndex: 1,
          explanation: "It deep-links into the Council so you can immediately apply what you just learned to live data.",
        },
        {
          question: "The repeatable research loop runs:",
          options: [
            "Buy, hope, sell",
            "Concept → query → cited evidence → decision, then check the track record",
            "Read news, then guess",
            "Only analyze, never decide",
          ],
          answerIndex: 1,
          explanation: "The loop ties a lesson concept to a cited query, the disagreement signal, and the Alpha Tracker's record.",
        },
        {
          question: "Citations let you:",
          options: [
            "Skip the analysis",
            "Verify each number against its source rather than trust it",
            "Avoid reading filings",
            "Guarantee a profit",
          ],
          answerIndex: 1,
          explanation: "Every rendered number traces to a URL, so you can click through and verify the key claims.",
        },
      ],
      tryInChat: {
        label: "Run the full loop",
        prompt: "Analyze a ticker I name, show me the cited facts, where the lenses disagree, and the bear case",
      },
      takeaways: [
        "Each lesson deep-links into Chat to apply the concept to a real ticker.",
        "Run a repeatable loop: concept → cited query → disagreement → decision → track record.",
        "Use citations to verify the key claims rather than trust them.",
      ],
    },
    {
      id: "ce-build-your-thesis",
      title: "Build Your Own Thesis",
      hook: "Put every model together into one decision you could defend.",
      difficulty: "mastery",
      subtitle: "The capstone: integrate the whole curriculum into a one-page thesis you could take to a committee.",
      conceptCards: [
        {
          emoji: "",
          heading: "Walk the full loop",
          body: "Take a real ticker and run the professional sequence end to end: variant perception (your non-consensus view), what's priced in (a reverse DCF), business quality (ROIC, moat, cash conversion), the catalyst and timeframe, and the bear case with an explicit invalidation level.",
        },
        {
          emoji: "",
          heading: "Then size and protect it",
          body: "A view isn't a position until you've sized it to your conviction and the distance to invalidation, and set the stop. Risk management and position sizing convert an opinion into a decision you can actually live with.",
        },
        {
          emoji: "",
          heading: "Defend it, then pressure-test it",
          body: "The output is a one-page thesis you could defend to an investment committee — and then hand to Conviqt's Council to attack. If the bear case survives scrutiny and the asymmetry still holds, you have something real.",
        },
      ],
      keyTerms: [
        { term: "Thesis", definition: "A defensible, falsifiable case for a position, with view, catalyst, risks, and sizing." },
        { term: "Invalidation level", definition: "The pre-set price or fact that would prove the thesis wrong." },
        { term: "Pressure-test", definition: "Deliberately attacking your own thesis to find what could break it." },
        { term: "One-page discipline", definition: "Forcing a thesis to fit a page so the core logic is explicit and checkable." },
      ],
      realWorldExample: {
        scenario:
          "A complete thesis reads: here's my non-consensus view, here's what the price already assumes, here's why the business quality supports (or doesn't) the view, here's the catalyst and timeframe, here's the bear case and the level that proves me wrong, and here's how I'd size and stop it.",
        ticker: "",
        lesson: "Every concept in this curriculum is a component of one coherent decision. The capstone is assembling them into a thesis you could defend — and then trying to break it.",
      },
      quiz: [
        {
          question: "A complete investment thesis must include:",
          options: [
            "Only a price target",
            "A non-consensus view, what's priced in, quality, catalyst, bear case, and sizing",
            "Just a chart",
            "A single rating",
          ],
          answerIndex: 1,
          explanation: "The full loop ties variant perception, valuation, quality, catalyst, risk, and sizing into one defensible case.",
        },
        {
          question: "A view becomes a position only once you've:",
          options: [
            "Told someone about it",
            "Sized it to conviction and invalidation distance and set a stop",
            "Read the news",
            "Checked the dividend",
          ],
          answerIndex: 1,
          explanation: "Sizing and stop placement convert an opinion into an executable, survivable decision.",
        },
        {
          question: "Pressure-testing a thesis means:",
          options: [
            "Seeking only confirming views",
            "Deliberately attacking it to find what could break it",
            "Ignoring the bear case",
            "Raising leverage",
          ],
          answerIndex: 1,
          explanation: "Actively trying to falsify your own thesis is how you find its weak points before the market does.",
        },
      ],
      tryInChat: {
        label: "Build and test a thesis",
        prompt: "Help me build a one-page thesis on a ticker I name — view, what's priced in, quality, catalyst, bear case, and sizing — then attack it",
      },
      takeaways: [
        "Integrate the whole curriculum: view, what's priced in, quality, catalyst, bear case, sizing.",
        "A view isn't a position until it's sized to conviction and given a stop.",
        "Write it to one page, defend it, then pressure-test it against the Council.",
      ],
    },
  ],
};
