// Track: Position Sizing & Portfolio Construction — how much to bet, and how the
// pieces fit together, usually matters more than which names you pick.

import type { RawTrack } from "../types";

export const positionSizing: RawTrack = {
  id: "position-sizing",
  name: "Position Sizing & Portfolio Construction",
  tagline: "Almost no one loses money on bad picks. They lose it on bad sizing.",
  emoji: "",
  accent: "#34d399",
  lessons: [
    {
      id: "ps-sizing-beats-picking",
      title: "Why Sizing Beats Picking",
      hook: "Two managers, identical trades, opposite outcomes.",
      difficulty: "core",
      subtitle: "How position sizing and bet construction drive returns more than hit rate does.",
      conceptCards: [
        {
          emoji: "",
          heading: "It's how much, not just what",
          body: "Druckenmiller's principle: it's not whether you're right or wrong, but how much you make when right and how much you lose when wrong. The same set of picks produces wildly different results depending purely on how they were sized.",
        },
        {
          emoji: "",
          heading: "Risk per trade",
          body: "Professionals cap the loss on any single idea — commonly 1-2% of capital — so no one mistake can do lasting damage. Sizing flows from the distance to your invalidation point, not from how excited you feel about the idea.",
        },
        {
          emoji: "",
          heading: "Conviction earns size",
          body: "Bet bigger when the edge is clear and the downside is well-defined; smaller when uncertain. The portfolio's returns come disproportionately from sizing the few high-conviction, favorable-asymmetry bets correctly.",
        },
      ],
      keyTerms: [
        { term: "Position sizing", definition: "Deciding how much capital to allocate to a given trade or holding." },
        { term: "Risk per trade", definition: "The maximum loss accepted on a single position, often set as a small fraction of capital." },
        { term: "Invalidation point", definition: "The price or fact that proves the thesis wrong and defines the risk." },
        { term: "Asymmetry", definition: "A favorable ratio of potential gain to potential loss on a position." },
      ],
      realWorldExample: {
        scenario:
          "Great macro traders are often right less than half the time but still compound strongly, because they size up sharply on their highest-conviction, best-asymmetry trades and keep losers small. The sizing, not the hit rate, makes the record.",
        ticker: "",
        lesson: "You can be wrong often and still win if you make a lot when right and lose little when wrong. That's a sizing decision.",
      },
      quiz: [
        {
          question: "Druckenmiller's principle emphasizes:",
          options: [
            "Always being right",
            "How much you make when right versus lose when wrong",
            "Owning many stocks",
            "Trading frequently",
          ],
          answerIndex: 1,
          explanation: "Magnitude of wins and losses — driven by sizing — matters more than raw accuracy.",
        },
        {
          question: "Risk per trade is usually anchored to:",
          options: [
            "How confident you feel",
            "The distance to the invalidation point and a small fraction of capital",
            "The stock's popularity",
            "The dividend yield",
          ],
          answerIndex: 1,
          explanation: "Sizing comes from where the thesis breaks and a fixed risk budget, not from emotion.",
        },
        {
          question: "A trader who wins under 50% of the time can still compound because:",
          options: [
            "Win rate is irrelevant to everything",
            "Sizing up favorable-asymmetry bets and keeping losers small makes total P&L positive",
            "They use no stops",
            "They avoid all risk",
          ],
          answerIndex: 1,
          explanation: "Large gains on well-sized winners can outweigh frequent small losses.",
        },
      ],
      tryInChat: {
        label: "Size a position",
        prompt: "Help me think through how to size a position in a stock I name given a defined invalidation level",
      },
      takeaways: [
        "Returns are driven more by sizing and bet construction than by hit rate.",
        "Cap risk per trade so no single idea can do lasting damage.",
        "Size up clear, well-defined-downside edges; size down uncertainty.",
      ],
    },
    {
      id: "ps-kelly",
      title: "The Kelly Criterion",
      hook: "The math that tells you how big to bet — and why pros bet half of it.",
      difficulty: "advanced",
      subtitle: "Optimal bet sizing for long-run growth, and why fractional Kelly is the practical default.",
      figure: "kelly",
      widget: {
        type: "position_sizing",
        title: "Find the optimal fraction",
        prompt: "Adjust the win rate and payoff ratio and watch the Kelly-optimal bet size change — then imagine running half of it.",
        params: { winRatePct: 55, payoffRatio: 2, capital: 100000 },
      },
      conceptCards: [
        {
          emoji: "",
          heading: "What Kelly says",
          body: "The Kelly criterion gives the bet fraction that maximizes long-run compound growth: f* = (p·b − q)/b, where p is win probability, q is loss probability, and b is the payoff ratio. Bet that fraction of capital on each opportunity with this edge.",
        },
        {
          emoji: "",
          heading: "Full Kelly is brutal",
          body: "Full Kelly maximizes growth but produces gut-wrenching drawdowns, and it's unforgiving if your probability estimates are even slightly off. That volatility is why almost no professional runs it at full size.",
        },
        {
          emoji: "",
          heading: "Bet a fraction",
          body: "Running half- or quarter-Kelly keeps most of the long-run growth while sharply cutting drawdown and the penalty for estimation error. Crucially, over-betting beyond Kelly guarantees eventual ruin even with a real edge.",
        },
      ],
      keyTerms: [
        { term: "Kelly criterion", definition: "The bet fraction f* = (p·b − q)/b that maximizes long-run growth of capital." },
        { term: "Fractional Kelly", definition: "Betting a set fraction (e.g., half) of the Kelly amount to reduce volatility." },
        { term: "Payoff ratio (b)", definition: "The size of a win relative to the size of a loss." },
        { term: "Risk of ruin", definition: "The probability of losing enough capital to be knocked out of the game." },
        { term: "Over-betting", definition: "Sizing beyond Kelly, which lowers growth and eventually guarantees ruin." },
      ],
      realWorldExample: {
        scenario:
          "Sophisticated bettors and quant funds use Kelly logic to size positions, but almost always at a fraction of full Kelly. The reason is practical: real-world edges are estimated, not known, and full Kelly punishes overestimation severely.",
        ticker: "",
        lesson: "Even with a genuine edge, the right size is usually a fraction of the theoretical optimum — because your edge estimate is itself uncertain.",
      },
      quiz: [
        {
          question: "The Kelly criterion determines the bet size that:",
          options: [
            "Eliminates all risk",
            "Maximizes long-run compound growth of capital",
            "Guarantees a win",
            "Minimizes taxes",
          ],
          answerIndex: 1,
          explanation: "Kelly maximizes the long-run growth rate given the edge and payoff — not safety or certainty.",
        },
        {
          question: "Why do professionals typically run fractional Kelly?",
          options: [
            "It increases growth",
            "It keeps most of the growth while cutting drawdown and the cost of estimation error",
            "It's required by law",
            "It removes the edge",
          ],
          answerIndex: 1,
          explanation: "Half- or quarter-Kelly sacrifices a little growth for much lower volatility and forgiveness if probabilities are off.",
        },
        {
          question: "Betting beyond the Kelly fraction:",
          options: [
            "Increases long-run growth",
            "Lowers growth and eventually guarantees ruin even with a positive edge",
            "Has no effect",
            "Eliminates drawdowns",
          ],
          answerIndex: 1,
          explanation: "Over-betting pushes past the growth-optimal point and, taken far enough, leads to ruin despite a real edge.",
        },
      ],
      tryInChat: {
        label: "Apply Kelly sizing",
        prompt: "Given a win probability and payoff ratio I provide, compute the Kelly fraction and a sensible fractional-Kelly size",
      },
      takeaways: [
        "Kelly gives the growth-maximizing bet fraction from your edge and payoff.",
        "Full Kelly is too volatile and punishes estimation error; run a fraction of it.",
        "Over-betting beyond Kelly guarantees eventual ruin even with a true edge.",
      ],
    },
    {
      id: "ps-correlation-diversification",
      title: "Correlation, Not Count",
      hook: "Owning 30 tech stocks is owning one bet 30 times.",
      difficulty: "advanced",
      subtitle: "Why real diversification is about correlation between holdings, not the number of them.",
      figure: "correlation",
      widget: {
        type: "diversification",
        title: "See diversification decay",
        prompt: "Add holdings and watch how quickly the diversification benefit flattens once positions are correlated.",
        params: { holdings: 8 },
      },
      conceptCards: [
        {
          emoji: "",
          heading: "Correlation is the variable",
          body: "Portfolio risk depends on how holdings move together, not just how many you own. Thirty highly correlated names behave like one position when it matters most. True diversification needs return streams that don't move in lockstep.",
        },
        {
          emoji: "",
          heading: "The only free lunch",
          body: "Combining genuinely uncorrelated positive-return streams lowers volatility without lowering expected return — the closest thing to a free lunch in finance. The benefit comes from low correlation, which is far harder to find than more tickers.",
        },
        {
          emoji: "",
          heading: "Correlations spike in crises",
          body: "In a panic, leverage unwinds and almost everything sells off together — correlations converge toward one exactly when you need diversification. Size and construct portfolios for the correlation you'll have in a crisis, not the calm-day correlation.",
        },
      ],
      keyTerms: [
        { term: "Correlation", definition: "How closely two assets' returns move together, from −1 to +1." },
        { term: "Diversification", definition: "Combining low-correlation assets to reduce risk without proportionally reducing return." },
        { term: "Concentration risk", definition: "Hidden exposure from many holdings that are really the same bet." },
        { term: "Correlation convergence", definition: "The tendency of correlations to rise toward one during market stress." },
      ],
      realWorldExample: {
        scenario:
          "Portfolios that looked diversified across dozens of names but were all exposed to the same factor — say, long-duration growth — fell together when that factor turned, because the holdings were effectively one correlated bet.",
        ticker: "",
        lesson: "Count is an illusion of safety. What protects you is genuine low correlation across the things you own, especially under stress.",
      },
      quiz: [
        {
          question: "Real diversification depends mainly on:",
          options: [
            "The number of holdings",
            "How correlated the holdings are with each other",
            "The size of the largest position",
            "The dividend yield",
          ],
          answerIndex: 1,
          explanation: "Risk reduction comes from low correlation; many correlated names don't diversify.",
        },
        {
          question: "Combining uncorrelated positive-return streams is called a 'free lunch' because it:",
          options: [
            "Raises expected return with no risk",
            "Lowers volatility without lowering expected return",
            "Eliminates all losses",
            "Requires no capital",
          ],
          answerIndex: 1,
          explanation: "Low-correlation combinations cut portfolio volatility while preserving expected return.",
        },
        {
          question: "Why is diversification weakest in a crisis?",
          options: [
            "Stocks stop trading",
            "Correlations converge toward one as everything sells off together",
            "Dividends are suspended",
            "Volatility disappears",
          ],
          answerIndex: 1,
          explanation: "Forced deleveraging makes assets move together, undercutting diversification precisely when it's needed.",
        },
      ],
      tryInChat: {
        label: "Check hidden correlation",
        prompt: "Tell me whether a list of stocks I own is actually diversified or secretly one correlated bet",
      },
      takeaways: [
        "Diversification is about correlation, not the number of holdings.",
        "Uncorrelated positive-return streams are finance's closest thing to a free lunch.",
        "Correlations converge to one in crises — build for stress-day, not calm-day, correlation.",
      ],
    },
    {
      id: "ps-barbell-convexity",
      title: "Barbells & Convexity",
      hook: "Taleb's portfolio: boring on one end, lottery tickets on the other.",
      difficulty: "advanced",
      subtitle: "Combining maximum safety with a small sleeve of high-convexity bets — and nothing fragile in the middle.",
      figure: "barbell",
      conceptCards: [
        {
          emoji: "",
          heading: "Both ends, empty middle",
          body: "Taleb's barbell holds the bulk of capital in maximally safe assets and a small slice in high-upside, capped-downside bets, deliberately avoiding the fragile middle. It's robust because the safe end can't blow up and the risky end can only lose a little.",
        },
        {
          emoji: "",
          heading: "Convexity defined",
          body: "Convexity is asymmetric payoff curvature: losses are small and bounded while gains are large and open-ended. A convex position benefits from volatility and surprise rather than being hurt by it — the opposite of fragility.",
        },
        {
          emoji: "",
          heading: "Antifragile to tails",
          body: "A barbell is built to survive — and even gain from — extreme events that wreck 'balanced' portfolios optimized for the average case. You give up smoothness in normal times in exchange for resilience and upside when the unexpected hits.",
        },
      ],
      keyTerms: [
        { term: "Barbell strategy", definition: "Pairing very safe assets with a small allocation to high-convexity bets, avoiding the middle." },
        { term: "Convexity", definition: "A payoff shape with small, capped losses and large, open-ended gains." },
        { term: "Antifragility", definition: "Taleb's term for systems that benefit from volatility and disorder." },
        { term: "Tail event", definition: "A rare, extreme outcome with outsized impact on results." },
      ],
      realWorldExample: {
        scenario:
          "Tail-hedged approaches hold mostly safe assets plus a small allocation to options-like convex bets. They lag in calm markets but can pay off enormously in a crash, offsetting losses elsewhere and even profiting from the chaos.",
        ticker: "",
        lesson: "Structuring for capped downside and open-ended upside lets a portfolio survive and exploit the rare events that sink optimized-for-average strategies.",
      },
      quiz: [
        {
          question: "A barbell portfolio deliberately avoids:",
          options: [
            "Safe assets",
            "The fragile middle of moderate-risk holdings",
            "All risk",
            "High-upside bets",
          ],
          answerIndex: 1,
          explanation: "The barbell concentrates at the safe and high-convexity extremes, skipping the medium-risk middle.",
        },
        {
          question: "Convexity describes a payoff that is:",
          options: [
            "Symmetric",
            "Small capped losses with large open-ended gains",
            "Always negative",
            "Linear",
          ],
          answerIndex: 1,
          explanation: "Convex positions lose little but can gain a lot, benefiting from volatility.",
        },
        {
          question: "Why might a barbell underperform in calm markets?",
          options: [
            "It holds too much risk",
            "The convex sleeve bleeds small amounts while waiting for rare large payoffs",
            "It has no safe assets",
            "It uses too much leverage",
          ],
          answerIndex: 1,
          explanation: "Convex bets cost a little in quiet times; the payoff comes during rare extreme moves.",
        },
      ],
      tryInChat: {
        label: "Design a barbell",
        prompt: "Explain how I could structure a barbell portfolio and what would sit on each end",
      },
      takeaways: [
        "Barbell: mostly safe assets plus a small high-convexity sleeve, nothing fragile in the middle.",
        "Convexity means small capped losses and large open-ended gains.",
        "You trade smooth calm-market returns for resilience and upside in the tails.",
      ],
    },
    {
      id: "ps-concentration",
      title: "Concentration vs Diversification",
      hook: "Diversify to survive ignorance; concentrate to exploit conviction.",
      difficulty: "advanced",
      subtitle: "How many positions to hold, and why the answer depends on edge, not a magic number.",
      conceptCards: [
        {
          emoji: "",
          heading: "The trade-off, honestly stated",
          body: "Concentration maximizes the impact of your best ideas but raises the cost of being wrong; diversification smooths outcomes but dilutes your edge. The right point depends on how confident you can justifiably be and how well you can size to conviction.",
        },
        {
          emoji: "",
          heading: "Most of the benefit comes early",
          body: "Diversification's risk reduction is steep at first and flattens fast — moving from 1 to 10 uncorrelated names cuts idiosyncratic risk dramatically; 30 to 50 barely helps. Beyond a point you're adding tickers, not diversification, and diluting your best work.",
        },
        {
          emoji: "",
          heading: "Two coherent philosophies",
          body: "Buffett-style concentration ('diversification is protection against ignorance') suits those with deep, defensible edge on a few names. Broad diversification or indexing suits those who can't reliably out-analyze the market. The error is the muddled middle: a watered-down 'diworsified' book with neither edge nor real protection.",
        },
      ],
      keyTerms: [
        { term: "Concentration", definition: "Holding relatively few positions to maximize the impact of best ideas." },
        { term: "Diworsification", definition: "Peter Lynch's term for over-diversifying into mediocre positions that dilute returns." },
        { term: "Idiosyncratic risk", definition: "Company-specific risk that diversification can reduce." },
        { term: "Conviction weighting", definition: "Sizing positions by the strength and defensibility of the edge." },
        { term: "Position cap", definition: "A maximum weight per holding to bound single-name risk." },
      ],
      realWorldExample: {
        scenario:
          "Some great investors run concentrated books of a dozen names they understand deeply, while index funds hold thousands. Both can work. What rarely works is a 60-stock 'active' fund whose top ideas are too small to matter and whose tail is just the index minus fees.",
        ticker: "",
        lesson: "Choose a coherent philosophy: concentrate where you have real edge, or diversify broadly where you don't. The expensive mistake is the muddled middle.",
      },
      quiz: [
        {
          question: "Diversification's risk-reduction benefit:",
          options: [
            "Increases linearly with each new stock",
            "Is steep at first and flattens quickly after a modest number of names",
            "Never diminishes",
            "Requires hundreds of stocks to begin",
          ],
          answerIndex: 1,
          explanation: "Most idiosyncratic risk is removed by the first handful of uncorrelated holdings; additions beyond that add little.",
        },
        {
          question: "'Diworsification' refers to:",
          options: [
            "Smart diversification",
            "Over-diversifying into mediocre positions that dilute returns",
            "Concentrating in one stock",
            "Hedging with options",
          ],
          answerIndex: 1,
          explanation: "Lynch's term warns that adding weak positions for the sake of count waters down a portfolio's best ideas.",
        },
        {
          question: "The choice between concentration and diversification should hinge on:",
          options: [
            "A fixed rule of 20 stocks",
            "How much defensible edge you have and how well you can size to conviction",
            "The day of the week",
            "The dividend yield",
          ],
          answerIndex: 1,
          explanation: "Edge and the ability to size it determine where on the spectrum you belong, not an arbitrary number.",
        },
      ],
      tryInChat: {
        label: "Right-size the book",
        prompt: "Help me think through whether to run a concentrated or diversified portfolio given my level of edge",
      },
      takeaways: [
        "Concentration exploits conviction; diversification protects against ignorance.",
        "Most diversification benefit arrives within the first ~10–15 uncorrelated names.",
        "Pick a coherent philosophy — the muddled, 'diworsified' middle is the costly error.",
      ],
    },
    {
      id: "ps-rebalancing",
      title: "Rebalancing & the Volatility Harvest",
      hook: "Sell what ran, buy what lagged — discipline that pays you to be unemotional.",
      difficulty: "advanced",
      subtitle: "Why periodic rebalancing controls risk and can quietly add return in choppy markets.",
      widget: {
        type: "rebalancing",
        title: "Harvest the volatility",
        prompt: "Set a target allocation and market choppiness, then compare a rebalanced book against one left to drift.",
        params: { targetStockPct: 60, swingPct: 22, years: 12 },
      },
      conceptCards: [
        {
          emoji: "",
          heading: "Rebalancing controls risk drift",
          body: "Left alone, winners grow until they dominate the portfolio, quietly raising its risk far above your intended level. Rebalancing back to target allocations restores the risk profile you actually chose — its first job is discipline, not return.",
        },
        {
          emoji: "",
          heading: "The rebalancing bonus",
          body: "By trimming what rose and adding to what fell, rebalancing systematically sells high and buys low. In choppy, mean-reverting markets across uncorrelated assets, this can add a small 'rebalancing bonus' to return — a rare case where risk control and return point the same way.",
        },
        {
          emoji: "",
          heading: "It isn't free or always best",
          body: "Rebalancing has costs — taxes and transaction fees — and in a strong one-way trend, letting winners run beats trimming them. Use bands (rebalance when an allocation drifts past a threshold) rather than reflexive calendar trades, and mind the tax drag.",
        },
      ],
      keyTerms: [
        { term: "Rebalancing", definition: "Restoring a portfolio to its target allocations by trimming winners and adding to laggards." },
        { term: "Risk drift", definition: "The unintended rise in portfolio risk as winners grow to dominate." },
        { term: "Rebalancing bonus", definition: "Extra return from systematically selling high and buying low across volatile, uncorrelated assets." },
        { term: "Rebalancing bands", definition: "Thresholds that trigger rebalancing only when an allocation drifts far enough." },
        { term: "Tax drag", definition: "The reduction in returns from taxes triggered by selling appreciated positions." },
      ],
      realWorldExample: {
        scenario:
          "A 60/40 portfolio left untouched through a long bull market can drift to 80/20, carrying far more risk than intended — then suffer outsized losses in a downturn. A rebalanced version trimmed stocks along the way, holding the risk level its owner actually signed up for.",
        ticker: "",
        lesson: "Rebalancing's main payoff is keeping risk where you intended; the occasional return bonus in choppy markets is a welcome side effect, not the point.",
      },
      quiz: [
        {
          question: "The primary purpose of rebalancing is to:",
          options: [
            "Maximize return",
            "Keep the portfolio's risk at the level you intended as winners drift",
            "Avoid all taxes",
            "Eliminate volatility",
          ],
          answerIndex: 1,
          explanation: "Rebalancing's first job is discipline — restoring the chosen risk profile before any return bonus.",
        },
        {
          question: "The 'rebalancing bonus' arises mainly in:",
          options: [
            "Strong one-way trends",
            "Choppy, mean-reverting markets across uncorrelated assets",
            "Markets that never move",
            "Single-stock portfolios",
          ],
          answerIndex: 1,
          explanation: "Systematically buying low and selling high pays off when volatile, uncorrelated assets oscillate.",
        },
        {
          question: "A drawback of frequent rebalancing is:",
          options: [
            "It reduces diversification",
            "Taxes and transaction costs, and giving up trend-following gains",
            "It increases risk drift",
            "It has no downside",
          ],
          answerIndex: 1,
          explanation: "Rebalancing triggers costs and can cut winners early in a strong trend — bands help manage both.",
        },
      ],
      tryInChat: {
        label: "Plan a rebalance",
        prompt: "Help me design a rebalancing rule with bands for a portfolio allocation I describe, mindful of taxes",
      },
      takeaways: [
        "Rebalancing's main job is controlling risk drift as winners grow.",
        "In choppy, uncorrelated markets it can add a small return bonus by selling high and buying low.",
        "Use bands and mind taxes; in strong trends, trimming winners can cost you.",
      ],
    },
    {
      id: "ps-vol-targeting",
      title: "Sizing by Volatility",
      hook: "Equal dollars isn't equal risk — a quiet stock and a wild one don't belong at the same weight.",
      difficulty: "advanced",
      subtitle: "Sizing positions by their risk contribution rather than by equal dollar amounts.",
      conceptCards: [
        {
          emoji: "",
          heading: "Equal weight hides unequal risk",
          body: "Putting the same dollars into a placid utility and a volatile growth name gives the volatile one far more influence over portfolio swings. Risk-based sizing scales each position inversely to its volatility, so each contributes a similar amount of risk.",
        },
        {
          emoji: "",
          heading: "Risk parity, in one idea",
          body: "Risk parity allocates by risk contribution rather than capital — smaller positions in volatile assets, larger in calm ones, so no single holding dominates the portfolio's variance. The aim is a more balanced engine of risk, not equal dollars.",
        },
        {
          emoji: "",
          heading: "Volatility targeting and its limits",
          body: "Scaling total exposure to hit a target volatility can smooth the ride, but it has failure modes: volatility is not the same as the risk of permanent loss, correlations spike in crises, and mechanically cutting exposure after volatility rises can lock in losses. Use it as a tool, not an autopilot.",
        },
      ],
      keyTerms: [
        { term: "Volatility", definition: "The size of an asset's price fluctuations, a common proxy for risk." },
        { term: "Risk contribution", definition: "How much a position adds to total portfolio risk, not just its dollar weight." },
        { term: "Risk parity", definition: "Allocating so each asset contributes roughly equal risk rather than equal capital." },
        { term: "Volatility targeting", definition: "Scaling exposure up or down to keep portfolio volatility near a target." },
        { term: "Inverse-volatility weighting", definition: "Sizing positions inversely to their volatility to equalize risk." },
      ],
      realWorldExample: {
        scenario:
          "A portfolio that equal-weighted a stable dividend payer and a speculative growth stock found its returns dominated almost entirely by the volatile name. Re-sizing inversely to volatility gave each a similar say in the portfolio's swings.",
        ticker: "",
        lesson: "Position weights should reflect risk, not just dollars. Equal capital in unequal-volatility assets quietly hands control to the wildest holding.",
      },
      quiz: [
        {
          question: "Equal dollar weighting across assets of different volatility results in:",
          options: [
            "Equal risk contribution",
            "The most volatile asset dominating portfolio risk",
            "Zero risk",
            "Lower returns by definition",
          ],
          answerIndex: 1,
          explanation: "Equal dollars give the high-volatility position outsized influence over portfolio swings.",
        },
        {
          question: "Risk parity allocates so that:",
          options: [
            "Each asset gets equal capital",
            "Each asset contributes roughly equal risk",
            "The riskiest asset gets the most capital",
            "Only bonds are held",
          ],
          answerIndex: 1,
          explanation: "Risk parity balances risk contribution, holding less of volatile assets and more of calm ones.",
        },
        {
          question: "A key limitation of volatility targeting is that:",
          options: [
            "It guarantees returns",
            "Volatility isn't the same as risk of permanent loss, and correlations spike in crises",
            "It ignores prices",
            "It can't be implemented",
          ],
          answerIndex: 1,
          explanation: "Volatility is an imperfect risk proxy, and mechanical de-risking after vol rises can lock in losses.",
        },
      ],
      tryInChat: {
        label: "Size by risk",
        prompt: "Help me size a set of positions I name by their volatility so each contributes similar risk",
      },
      takeaways: [
        "Equal dollars isn't equal risk — volatile positions dominate an equal-weighted book.",
        "Risk parity sizes by risk contribution, not capital.",
        "Volatility targeting smooths the ride but isn't an autopilot — volatility ≠ permanent loss.",
      ],
    },
  ],
};
