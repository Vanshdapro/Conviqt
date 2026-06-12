// Track: Market Mechanics & Instruments — the plumbing. How trades actually
// execute, what spreads and liquidity cost you, how short selling and options
// work, and how ETFs and index flows move prices. Static, hand-authored content.

import type { RawTrack } from "../types";

export const marketMechanics: RawTrack = {
  id: "market-mechanics",
  name: "Market Mechanics & Instruments",
  tagline: "How trades, instruments, and the plumbing of markets actually work.",
  emoji: "",
  accent: "var(--accent)",
  lessons: [
    {
      id: "mkt-how-trades-execute",
      title: "How a Trade Actually Executes",
      hook: "Behind every price is a queue of buyers and sellers waiting to match.",
      difficulty: "core",
      subtitle: "The order book, the bid and the ask, and what really happens when you hit 'buy.'",
      figure: "order-book",
      conceptCards: [
        {
          emoji: "",
          heading: "The order book is two queues",
          body: "Every stock has an order book: a list of buy orders (bids) and sell orders (asks), each at a price and size. The highest bid and lowest ask are the quoted price. A trade happens when a buyer and seller agree — when an order crosses the gap between them.",
        },
        {
          emoji: "",
          heading: "Price is where supply meets demand",
          body: "The 'price' you see is just the last trade or the current best bid/ask. It moves as orders arrive and the book changes. There's no central authority setting it — it's the continuous result of buyers and sellers matching at the margin.",
        },
        {
          emoji: "",
          heading: "Market makers keep it liquid",
          body: "Market makers post both bids and asks, standing ready to trade and earning the small spread between them. They provide liquidity — the ability to trade quickly — and in return profit from the gap, while bearing the risk of holding inventory.",
        },
      ],
      keyTerms: [
        { term: "Order book", definition: "The live list of outstanding buy and sell orders at each price and size." },
        { term: "Bid / ask", definition: "The highest price buyers offer and the lowest price sellers accept." },
        { term: "Liquidity", definition: "How easily an asset can be traded without moving its price much." },
        { term: "Market maker", definition: "A participant who quotes both bid and ask, providing liquidity for the spread." },
        { term: "Depth", definition: "How much size sits in the book near the current price." },
      ],
      realWorldExample: {
        scenario:
          "A large, heavily-traded stock has a deep book with tight bids and asks, so a normal order fills instantly at a known price. A thinly-traded small cap has a sparse book, so the same order can move the price noticeably just by being placed.",
        ticker: "",
        lesson: "Price is the live output of an order book, not a fixed label. Depth and liquidity determine whether your trade fills cleanly or moves the market.",
      },
      quiz: [
        {
          question: "The order book consists of:",
          options: [
            "A single fixed price",
            "Queues of buy orders (bids) and sell orders (asks) at various prices",
            "Only the last trade",
            "The company's earnings",
          ],
          answerIndex: 1,
          explanation: "The book is the live list of bids and asks; the best of each forms the quoted price.",
        },
        {
          question: "A stock's price is set by:",
          options: [
            "A central authority",
            "Buyers and sellers continuously matching in the order book",
            "The company's CFO",
            "The exchange at random",
          ],
          answerIndex: 1,
          explanation: "Price is the ongoing result of supply and demand meeting at the margin, not a set figure.",
        },
        {
          question: "Market makers profit primarily from:",
          options: [
            "Dividends",
            "The spread between the bid and ask they quote",
            "Long-term capital gains",
            "Management fees",
          ],
          answerIndex: 1,
          explanation: "By quoting both sides and providing liquidity, they earn the small bid-ask spread.",
        },
      ],
      tryInChat: {
        label: "Understand a stock's liquidity",
        prompt: "Explain how liquid a stock I name is and what that means for trading it without moving the price",
      },
      takeaways: [
        "Every price sits atop an order book of bids and asks waiting to match.",
        "Price is the continuous output of supply and demand, not a fixed label.",
        "Market makers provide liquidity and earn the bid-ask spread.",
      ],
    },
    {
      id: "mkt-spreads-liquidity",
      title: "Spreads, Liquidity & Slippage",
      hook: "You buy at the ask and sell at the bid — the gap is a tax you pay every trade.",
      difficulty: "core",
      subtitle: "How the bid-ask spread, depth, and slippage make trading cost more than the headline price.",
      figure: "bid-ask",
      conceptCards: [
        {
          emoji: "",
          heading: "The spread is a real cost",
          body: "You typically buy at the higher ask and sell at the lower bid, so you lose the spread on a round trip even if the price never moves. For liquid large caps the spread is tiny; for illiquid names it can be a meaningful chunk of your return.",
        },
        {
          emoji: "",
          heading: "Slippage on bigger orders",
          body: "A large order eats through the book — filling the best prices first, then worse ones — so the average fill is worse than the quoted price. This slippage grows with order size relative to the stock's liquidity, and it's a hidden cost active traders underestimate.",
        },
        {
          emoji: "",
          heading: "Liquidity is a feature, not a given",
          body: "Liquidity can evaporate exactly when you need it — in a panic, spreads widen and depth vanishes. Sizing positions to the liquidity you'll actually have under stress, not on a calm day, is part of risk management, especially for smaller or exotic securities.",
        },
      ],
      keyTerms: [
        { term: "Bid-ask spread", definition: "The gap between the buy price (ask) and sell price (bid); a per-trade cost." },
        { term: "Slippage", definition: "The difference between expected and actual fill price, often from large orders." },
        { term: "Market impact", definition: "How much your own trading moves the price against you." },
        { term: "Liquidity", definition: "The ease of trading without materially moving the price." },
        { term: "Round-trip cost", definition: "The total cost of buying and later selling, including spread and slippage." },
      ],
      realWorldExample: {
        scenario:
          "A trader frequently flipping a thinly-traded stock paid the wide spread on every entry and exit, and moved the price against themselves on bigger orders. The cumulative trading costs quietly consumed much of what their stock-picking earned.",
        ticker: "",
        lesson: "Trading isn't free even with zero commissions. Spreads, slippage, and market impact are real costs that punish overtrading and illiquid names.",
      },
      quiz: [
        {
          question: "On a round-trip trade with no price change, you still lose:",
          options: [
            "Nothing",
            "The bid-ask spread",
            "The dividend",
            "Your entire position",
          ],
          answerIndex: 1,
          explanation: "Buying at the ask and selling at the bid means you pay the spread even if the price is flat.",
        },
        {
          question: "Slippage tends to be worse when:",
          options: [
            "Orders are tiny relative to liquidity",
            "Orders are large relative to the stock's liquidity",
            "The stock is highly liquid",
            "Commissions are zero",
          ],
          answerIndex: 1,
          explanation: "Big orders consume successive levels of the book, worsening the average fill price.",
        },
        {
          question: "Liquidity is dangerous to rely on because it:",
          options: [
            "Never changes",
            "Can evaporate in a panic, widening spreads and thinning depth",
            "Only matters for bonds",
            "Increases in crises",
          ],
          answerIndex: 1,
          explanation: "Under stress, spreads widen and depth disappears — exactly when you may need to trade.",
        },
      ],
      tryInChat: {
        label: "Estimate trading costs",
        prompt: "Explain the likely spread and slippage costs of trading a stock I name and how to minimize them",
      },
      takeaways: [
        "The bid-ask spread is a cost you pay on every round trip.",
        "Large orders cause slippage and market impact, worsening your fill.",
        "Liquidity can vanish in a panic — size for the stress-day, not the calm-day.",
      ],
    },
    {
      id: "mkt-order-types",
      title: "Market vs Limit Orders",
      hook: "One guarantees you trade; the other guarantees your price. You can't have both.",
      difficulty: "core",
      subtitle: "Choosing the right order type to control price, certainty of execution, and cost.",
      conceptCards: [
        {
          emoji: "",
          heading: "Market orders: speed over price",
          body: "A market order executes immediately at the best available price — you're guaranteed to trade, but not at what price. In liquid stocks that's fine; in illiquid ones a market order can fill far from the last quote, a costly surprise.",
        },
        {
          emoji: "",
          heading: "Limit orders: price over speed",
          body: "A limit order sets the worst price you'll accept and only fills at that price or better. You control the cost and avoid nasty fills, but you risk not executing at all if the market never reaches your limit. It's the default for anything but the most liquid names.",
        },
        {
          emoji: "",
          heading: "Stops and the gap risk",
          body: "A stop order becomes a market order once a trigger price is hit — useful for exits, but in a fast drop it can fill far below the trigger (gap risk). Stop-limit orders cap that, at the cost of possibly not filling. Match the order type to whether price or certainty matters more.",
        },
      ],
      keyTerms: [
        { term: "Market order", definition: "An order to trade immediately at the best available price." },
        { term: "Limit order", definition: "An order that fills only at a specified price or better." },
        { term: "Stop order", definition: "An order that becomes a market order once a trigger price is reached." },
        { term: "Stop-limit order", definition: "A stop that becomes a limit order, capping the fill price but risking no fill." },
        { term: "Fill", definition: "The execution of an order, in whole or in part." },
      ],
      realWorldExample: {
        scenario:
          "An investor placed a market order on a thinly-traded stock and filled well above the last quote because the book was sparse. A limit order would have capped the price — at the risk of not filling — and saved the unpleasant surprise.",
        ticker: "",
        lesson: "Market orders prioritize certainty of execution; limit orders prioritize price. In illiquid names, defaulting to limits protects you from ugly fills.",
      },
      quiz: [
        {
          question: "A market order guarantees:",
          options: [
            "A specific price",
            "Execution, but not the price",
            "Both price and execution",
            "A profit",
          ],
          answerIndex: 1,
          explanation: "Market orders fill immediately at the best available price, which may differ from the quote.",
        },
        {
          question: "A limit order guarantees:",
          options: [
            "Immediate execution",
            "Your price (or better), but not that it fills",
            "Both speed and price",
            "A dividend",
          ],
          answerIndex: 1,
          explanation: "Limit orders only fill at your specified price or better, risking no execution.",
        },
        {
          question: "A stop order's 'gap risk' is that:",
          options: [
            "It never triggers",
            "In a fast move it can fill far beyond the trigger price",
            "It guarantees the trigger price",
            "It pays no dividends",
          ],
          answerIndex: 1,
          explanation: "Once triggered it becomes a market order, so a fast drop can fill well below the stop.",
        },
      ],
      tryInChat: {
        label: "Pick the right order",
        prompt: "Help me choose between a market, limit, or stop order for a trade I describe in a stock I name",
      },
      takeaways: [
        "Market orders guarantee execution; limit orders guarantee price — not both.",
        "Default to limit orders in illiquid names to avoid ugly fills.",
        "Stops become market orders and carry gap risk; stop-limits cap price but may not fill.",
      ],
    },
    {
      id: "mkt-short-selling",
      title: "Short Selling",
      hook: "Selling first and buying back later — with the math running the opposite way.",
      difficulty: "advanced",
      subtitle: "How shorting works, why its risk is asymmetric, and what a short squeeze is.",
      figure: "short-selling",
      conceptCards: [
        {
          emoji: "",
          heading: "Borrow, sell, buy back, return",
          body: "To short, you borrow shares, sell them now, and hope to buy them back cheaper later to return to the lender — profiting from the decline. It's the mirror of going long: you make money when the price falls and lose when it rises.",
        },
        {
          emoji: "",
          heading: "Asymmetric risk",
          body: "A long position can only fall to zero (−100%), but a short can lose far more, because a stock's price can rise without limit. Capped gain, unlimited loss — the opposite shape of a long — which is why shorting demands tight risk control and small sizing.",
        },
        {
          emoji: "",
          heading: "Squeezes and borrow costs",
          body: "When a heavily-shorted stock rises, shorts rushing to cover add buying pressure that pushes it higher still — a short squeeze. Shorts also pay a borrow fee that can be steep for hard-to-borrow names, so even a correct thesis can lose money if the timing is wrong.",
        },
      ],
      keyTerms: [
        { term: "Short selling", definition: "Borrowing and selling shares to profit from a price decline." },
        { term: "Covering", definition: "Buying back shorted shares to close the position and return the borrow." },
        { term: "Short squeeze", definition: "A sharp rise forcing shorts to cover, amplifying the move upward." },
        { term: "Borrow fee", definition: "The cost of borrowing shares to short, high for hard-to-borrow names." },
        { term: "Asymmetric risk", definition: "A short's capped gain versus theoretically unlimited loss." },
      ],
      realWorldExample: {
        scenario:
          "A heavily-shorted stock spiked dramatically as shorts scrambled to buy back shares, each purchase pushing the price higher and forcing more covering. Some short sellers with correct long-term theses were wiped out by the squeeze before they could be proven right.",
        ticker: "",
        lesson: "Shorting inverts the payoff: capped upside, unlimited downside, plus borrow costs and squeeze risk. Being right eventually isn't enough if the timing ruins you first.",
      },
      quiz: [
        {
          question: "A short seller profits when the stock:",
          options: [
            "Rises",
            "Falls, so they buy it back cheaper than they sold it",
            "Pays a dividend",
            "Stays flat forever",
          ],
          answerIndex: 1,
          explanation: "Shorts borrow and sell high, aiming to buy back lower and return the shares for a profit.",
        },
        {
          question: "The risk of a short position is:",
          options: [
            "Capped at the amount invested",
            "Theoretically unlimited, since the price can rise without limit",
            "Always zero",
            "The same as a long position",
          ],
          answerIndex: 1,
          explanation: "A rising price has no ceiling, so a short's potential loss is unbounded — unlike a long.",
        },
        {
          question: "A short squeeze occurs when:",
          options: [
            "Shorts buy more shares to short",
            "A rising price forces shorts to cover, pushing the price higher still",
            "The company issues a dividend",
            "Volatility falls to zero",
          ],
          answerIndex: 1,
          explanation: "Shorts rushing to buy back shares add buying pressure that amplifies the upward move.",
        },
      ],
      tryInChat: {
        label: "Assess a short",
        prompt: "Explain the risks of shorting a stock I name, including borrow costs and squeeze potential",
      },
      takeaways: [
        "Shorting borrows and sells high to buy back lower — profiting as the price falls.",
        "Risk is asymmetric: capped gain, theoretically unlimited loss.",
        "Borrow fees and short squeezes can punish even a correct thesis with bad timing.",
      ],
    },
    {
      id: "mkt-options-basics",
      title: "Options: Calls & Puts",
      hook: "Pay a small premium for a big, asymmetric bet — with a hard floor on your loss.",
      difficulty: "advanced",
      subtitle: "What calls and puts are, how their payoffs work at expiry, and why the loss is capped at the premium.",
      figure: "options-payoff",
      widget: {
        type: "options_payoff",
        title: "Shape a payoff",
        prompt: "Toggle call or put, set a strike and premium, and watch the payoff line — your loss is capped at the premium no matter how wrong you are.",
        params: { isPut: 0, strike: 100, premium: 6 },
      },
      conceptCards: [
        {
          emoji: "",
          heading: "The right, not the obligation",
          body: "A call gives you the right to buy a stock at a set strike price; a put gives the right to sell at a strike. You pay a premium for that right. If the move doesn't go your way, you simply let the option expire — your maximum loss is the premium paid.",
        },
        {
          emoji: "",
          heading: "Asymmetric by design",
          body: "Options bundle capped downside with leveraged upside. A call profits as the stock rises above the strike plus premium; a put profits as it falls below strike minus premium. That convex payoff — small fixed cost, large potential gain — is the core appeal.",
        },
        {
          emoji: "",
          heading: "Time decay and the cost of being early",
          body: "Options expire, and their value erodes as expiry approaches (time decay). You can be right about direction yet lose if the move comes too late or is too small. Buying options is a bet on magnitude and timing, not just direction — and most expire worthless.",
        },
      ],
      keyTerms: [
        { term: "Call option", definition: "The right to buy a stock at the strike price before expiry." },
        { term: "Put option", definition: "The right to sell a stock at the strike price before expiry." },
        { term: "Premium", definition: "The price paid for the option, and the maximum loss for a buyer." },
        { term: "Strike price", definition: "The fixed price at which the option can be exercised." },
        { term: "Time decay (theta)", definition: "The erosion of an option's value as expiration approaches." },
      ],
      realWorldExample: {
        scenario:
          "An investor expecting a big move bought a call for a small premium. The stock rallied past the strike and the call multiplied in value — far more than the stock itself rose in percentage terms — while the most they could have lost was the premium they paid.",
        ticker: "",
        lesson: "Options offer convex payoffs: a capped, known loss against a large potential gain. But time decay means you must be right on direction, magnitude, and timing.",
      },
      quiz: [
        {
          question: "A call option gives the holder the right to:",
          options: [
            "Sell the stock at the strike",
            "Buy the stock at the strike price before expiry",
            "Receive a dividend",
            "Short the stock for free",
          ],
          answerIndex: 1,
          explanation: "A call is the right (not obligation) to buy at the strike; a put is the right to sell.",
        },
        {
          question: "The maximum loss for an option buyer is:",
          options: [
            "Unlimited",
            "The premium paid",
            "The strike price",
            "The stock's full value",
          ],
          answerIndex: 1,
          explanation: "If the bet fails, the buyer simply lets it expire, losing only the premium.",
        },
        {
          question: "Time decay means an option buyer can lose even if:",
          options: [
            "The direction is right but the move is too small or too late",
            "The premium is zero",
            "The stock pays a dividend",
            "Volatility is high",
          ],
          answerIndex: 0,
          explanation: "Options erode toward expiry, so being right on direction isn't enough without magnitude and timing.",
        },
      ],
      tryInChat: {
        label: "Frame an options bet",
        prompt: "Explain how a call or put on a stock I name would pay off and what its breakeven and max loss are",
      },
      takeaways: [
        "Calls and puts are the right (not obligation) to buy or sell at a strike, for a premium.",
        "Loss is capped at the premium; the payoff is convex and asymmetric.",
        "Time decay means you must be right on direction, magnitude, and timing.",
      ],
    },
    {
      id: "mkt-implied-volatility",
      title: "Implied Volatility",
      hook: "Options don't just price direction — they price how much the market expects things to move.",
      difficulty: "advanced",
      subtitle: "What implied volatility is, why it makes options cheap or expensive, and how fear shows up in its price.",
      conceptCards: [
        {
          emoji: "",
          heading: "The market's expected move",
          body: "Implied volatility (IV) is the level of future volatility the option's price implies. High IV means the market expects big moves, so options are expensive; low IV means calm is expected, so they're cheap. IV, not just direction, drives what you pay for an option.",
        },
        {
          emoji: "",
          heading: "Fear has a price",
          body: "IV spikes when fear rises — demand for protective puts surges in selloffs, lifting option prices. The VIX, the market's headline 'fear gauge,' is essentially the implied volatility of S&P 500 options. Buying protection after fear spikes means paying up for it.",
        },
        {
          emoji: "",
          heading: "Buy low IV, sell high IV",
          body: "Because IV mean-reverts, options are best bought when IV is low (cheap insurance, favorable asymmetry) and are richest to sell when IV is high. Being right on direction but wrong on IV — overpaying when fear is elevated — is a common way to lose on a correct view.",
        },
      ],
      keyTerms: [
        { term: "Implied volatility (IV)", definition: "The future volatility an option's price implies; sets how expensive it is." },
        { term: "VIX", definition: "The implied volatility of S&P 500 options, the market's 'fear gauge.'" },
        { term: "Historical volatility", definition: "How much a stock has actually moved in the past." },
        { term: "Volatility premium", definition: "The tendency of implied to exceed realized volatility, rewarding sellers." },
        { term: "Mean reversion (of IV)", definition: "The tendency of implied volatility to return toward normal levels." },
      ],
      realWorldExample: {
        scenario:
          "During a market panic, implied volatility (and the VIX) spiked, making puts very expensive just as frightened investors rushed to buy them. Those who had bought cheap protection earlier, when IV was low, profited; those who chased it during the spike overpaid.",
        ticker: "",
        lesson: "Implied volatility is the price of expected movement and of fear. Buy options when IV is low; selling or avoiding them when IV is elevated avoids overpaying for a correct view.",
      },
      quiz: [
        {
          question: "Implied volatility represents:",
          options: [
            "The stock's dividend",
            "The future volatility the option's price implies",
            "The strike price",
            "The bid-ask spread",
          ],
          answerIndex: 1,
          explanation: "IV is the level of expected future movement baked into an option's price.",
        },
        {
          question: "The VIX is essentially:",
          options: [
            "The S&P 500's dividend yield",
            "The implied volatility of S&P 500 options — the 'fear gauge'",
            "A bond index",
            "A measure of trading volume",
          ],
          answerIndex: 1,
          explanation: "The VIX summarizes the implied volatility of index options, rising with market fear.",
        },
        {
          question: "Because IV mean-reverts, options are best bought when IV is:",
          options: [
            "High, after fear spikes",
            "Low, when protection is cheap",
            "Irrelevant",
            "At the strike price",
          ],
          answerIndex: 1,
          explanation: "Buying when IV is low gives cheaper, more favorable options; chasing high IV means overpaying.",
        },
      ],
      tryInChat: {
        label: "Read the volatility",
        prompt: "Explain whether options on a stock I name look cheap or expensive based on implied volatility",
      },
      takeaways: [
        "Implied volatility is the expected move priced into options — it sets their cost.",
        "Fear lifts IV; the VIX is the index's implied-volatility fear gauge.",
        "IV mean-reverts: buy options when it's low, avoid overpaying when it's high.",
      ],
    },
    {
      id: "mkt-etfs",
      title: "ETFs & How They Trade",
      hook: "A single ticker that holds hundreds of stocks — and tracks their value all day.",
      difficulty: "advanced",
      subtitle: "How exchange-traded funds work, why their price stays near NAV, and what to watch for.",
      figure: "etf-mechanics",
      conceptCards: [
        {
          emoji: "",
          heading: "A basket that trades like a stock",
          body: "An ETF holds a basket of securities — say, every stock in an index — but trades on an exchange like a single share, all day long. It combines a fund's diversification with a stock's tradability, usually at very low cost for broad index ETFs.",
        },
        {
          emoji: "",
          heading: "Arbitrage keeps price near value",
          body: "Special firms (authorized participants) can create new ETF shares by delivering the underlying basket, or redeem shares for the basket. If the ETF drifts from the value of its holdings (NAV), they arbitrage the gap — which continuously pulls the ETF's price back toward its true value.",
        },
        {
          emoji: "",
          heading: "Know what's inside",
          body: "ETFs vary enormously: a broad index ETF is cheap and diversified, but niche, leveraged, or thinly-traded ETFs carry hidden risks — wide spreads, tracking error, daily-reset decay. Always check the holdings, expense ratio, and liquidity, not just the catchy name.",
        },
      ],
      keyTerms: [
        { term: "ETF", definition: "An exchange-traded fund holding a basket of assets that trades like a stock." },
        { term: "Net asset value (NAV)", definition: "The per-share value of an ETF's underlying holdings." },
        { term: "Authorized participant", definition: "A firm that creates/redeems ETF shares, enabling the arbitrage that tracks NAV." },
        { term: "Tracking error", definition: "How much an ETF's return deviates from its index." },
        { term: "Leveraged/inverse ETF", definition: "An ETF that amplifies or inverts daily returns, often decaying over time." },
      ],
      realWorldExample: {
        scenario:
          "A broad index ETF trades within pennies of the value of its holdings all day, because arbitrageurs instantly create or redeem shares to capture any gap. A thinly-traded niche ETF, by contrast, can carry wide spreads and drift further from NAV.",
        ticker: "",
        lesson: "The creation/redemption mechanism keeps mainstream ETFs tracking their value cheaply. But exotic ETFs hide real risks — read the holdings and costs, not the name.",
      },
      quiz: [
        {
          question: "An ETF is best described as:",
          options: [
            "A single company's stock",
            "A basket of assets that trades on an exchange like a stock",
            "A type of bond",
            "A savings account",
          ],
          answerIndex: 1,
          explanation: "ETFs hold a basket (often an index) but trade intraday like a single share.",
        },
        {
          question: "An ETF's price stays close to its NAV because:",
          options: [
            "The exchange fixes it",
            "Authorized participants arbitrage gaps via creation and redemption",
            "It never moves",
            "The fund manager sets it daily",
          ],
          answerIndex: 1,
          explanation: "Create/redeem arbitrage continuously pulls the ETF price toward the value of its holdings.",
        },
        {
          question: "Which ETFs carry the most hidden risk?",
          options: [
            "Broad, low-cost index ETFs",
            "Niche, leveraged, or thinly-traded ETFs",
            "Total-market ETFs",
            "All ETFs are identical",
          ],
          answerIndex: 1,
          explanation: "Leveraged, inverse, and illiquid ETFs carry tracking error, decay, and wide spreads.",
        },
      ],
      tryInChat: {
        label: "Look inside an ETF",
        prompt: "Tell me what's inside an ETF I name, its expense ratio, and any risks beyond its headline strategy",
      },
      takeaways: [
        "ETFs hold a basket but trade like a stock, usually cheaply for broad index funds.",
        "Creation/redemption arbitrage keeps the price near the value of the holdings (NAV).",
        "Exotic ETFs hide risks — check holdings, costs, and liquidity, not just the name.",
      ],
    },
    {
      id: "mkt-index-effects",
      title: "Index Inclusion & Passive Flows",
      hook: "Getting added to a big index can move a stock before a single fundamental changes.",
      difficulty: "advanced",
      subtitle: "How index membership and the rise of passive investing create flows that move prices.",
      conceptCards: [
        {
          emoji: "",
          heading: "Index funds must buy what's added",
          body: "When a stock joins a major index, every fund tracking that index has to buy it to match the benchmark — a wave of mechanical, price-insensitive demand. Removal forces the reverse. These flows can move a stock around inclusion regardless of its fundamentals.",
        },
        {
          emoji: "",
          heading: "Passive flows are price-insensitive",
          body: "Index funds buy and sell to track weights, not because a stock is cheap or dear. As passive investing has grown to a huge share of the market, these valuation-blind flows increasingly shape prices — pushing money into the largest index members by weight, irrespective of value.",
        },
        {
          emoji: "",
          heading: "Opportunity and distortion",
          body: "Mechanical flows can create both distortions to exploit (a stock pushed up purely by inclusion may be overvalued) and risks (crowded passive ownership can amplify moves both ways). Understanding who is forced to trade, and why, is an underrated edge.",
        },
      ],
      keyTerms: [
        { term: "Index inclusion", definition: "A stock being added to an index, forcing index funds to buy it." },
        { term: "Passive investing", definition: "Owning the market via index funds rather than picking stocks." },
        { term: "Price-insensitive flow", definition: "Buying or selling driven by tracking rules, not valuation." },
        { term: "Rebalance date", definition: "When an index updates members and weights, triggering fund trades." },
        { term: "Float weighting", definition: "Weighting index members by tradable market value, concentrating in the largest." },
      ],
      realWorldExample: {
        scenario:
          "Stocks added to a flagship index have often jumped in the run-up to inclusion, as index funds and front-runners bought ahead of the mechanical demand — a move driven by flows, not by any change in the underlying business.",
        ticker: "",
        lesson: "Index membership creates forced, valuation-blind buying and selling. Knowing who must trade — and when — reveals both distortions to exploit and risks to respect.",
      },
      quiz: [
        {
          question: "When a stock is added to a major index, index funds:",
          options: [
            "Ignore it",
            "Must buy it to match the benchmark, creating mechanical demand",
            "Short it",
            "Sell their other holdings",
          ],
          answerIndex: 1,
          explanation: "Tracking the index forces funds to buy the new member regardless of its valuation.",
        },
        {
          question: "Passive flows are 'price-insensitive' because they:",
          options: [
            "Only buy cheap stocks",
            "Buy and sell to track weights, not because a stock is cheap or dear",
            "Depend on earnings",
            "Avoid large companies",
          ],
          answerIndex: 1,
          explanation: "Index funds trade to match the benchmark's weights, ignoring valuation entirely.",
        },
        {
          question: "Understanding index flows is useful because they can create:",
          options: [
            "Perfectly efficient prices",
            "Both distortions to exploit and risks from crowded ownership",
            "Guaranteed profits",
            "No effect on prices",
          ],
          answerIndex: 1,
          explanation: "Mechanical, valuation-blind flows can misprice stocks and amplify moves both ways.",
        },
      ],
      tryInChat: {
        label: "Trace the flows",
        prompt: "Explain how index inclusion or passive flows might be affecting a stock I name beyond its fundamentals",
      },
      takeaways: [
        "Index inclusion forces index funds to buy, creating mechanical, valuation-blind demand.",
        "Passive flows track weights, not value, and increasingly shape prices.",
        "Knowing who is forced to trade reveals both distortions to exploit and risks to respect.",
      ],
    },
  ],
};
