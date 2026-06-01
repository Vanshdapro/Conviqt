// Track: Valuation & Business Quality — what a business is worth, what the price
// already assumes, and what makes high returns durable.

import type { RawTrack } from "../types";

export const valuationQuality: RawTrack = {
  id: "valuation-quality",
  name: "Valuation & Business Quality",
  tagline: "Price is what you pay; embedded expectations are what you're really betting against.",
  emoji: "",
  accent: "#4f87f7",
  lessons: [
    {
      id: "vq-multiples",
      title: "Multiples: The Shorthand",
      hook: "A P/E is a compressed forecast, not a verdict.",
      difficulty: "core",
      subtitle: "What valuation multiples actually encode, when they mislead, and how to compare them honestly.",
      figure: "multiples",
      conceptCards: [
        {
          emoji: "",
          heading: "A multiple is an embedded forecast",
          body: "P/E, EV/EBITDA, and P/FCF compress assumptions about growth, risk, and returns into one number. A high multiple isn't 'expensive' and a low one isn't 'cheap' until you ask what future each one is pricing in.",
        },
        {
          emoji: "",
          heading: "Use enterprise value for capital structure",
          body: "P/E ignores debt. EV/EBITDA and EV/EBIT compare the whole business (debt + equity) to its operating profit, so they let you compare companies with different leverage on an apples-to-apples basis.",
        },
        {
          emoji: "",
          heading: "Cheap can be a trap",
          body: "Low multiples often reflect real problems — declining demand, a melting moat, accounting risk. A 'value trap' is a stock that stays cheap because it deserves to. The multiple is a question to investigate, not an answer.",
        },
      ],
      keyTerms: [
        { term: "P/E ratio", definition: "Price per share / earnings per share; what you pay per dollar of annual earnings." },
        { term: "EV/EBITDA", definition: "Enterprise value / operating earnings before D&A; a leverage-neutral valuation measure." },
        { term: "Enterprise value (EV)", definition: "Market cap plus net debt; the cost to buy the whole business." },
        { term: "Value trap", definition: "A stock that looks cheap on multiples but stays cheap because the business is deteriorating." },
        { term: "Multiple expansion", definition: "A rising valuation multiple lifting the price even without earnings growth." },
      ],
      realWorldExample: {
        scenario:
          "Declining-industry stocks frequently trade at low single-digit P/Es for years. Buyers anchored on the 'cheap' multiple, but earnings kept shrinking, so the low multiple was a warning, not a bargain.",
        ticker: "INTC",
        lesson: "A low multiple is a hypothesis about mispricing. Test it against the trajectory of the business before calling it cheap.",
      },
      quiz: [
        {
          question: "A valuation multiple like P/E is best understood as:",
          options: [
            "A guarantee of return",
            "A compressed set of assumptions about growth and risk",
            "The company's profit",
            "A measure of debt",
          ],
          answerIndex: 1,
          explanation: "Multiples encode expectations. Interpreting one means unpacking the growth and risk it implies, not reading it as cheap or dear at face value.",
        },
        {
          question: "Why might you prefer EV/EBITDA to P/E when comparing two firms?",
          options: [
            "It is always lower",
            "It accounts for differences in debt and capital structure",
            "It ignores earnings",
            "It includes the dividend",
          ],
          answerIndex: 1,
          explanation: "Enterprise-value multiples compare the whole business to operating profit, neutralizing different leverage levels.",
        },
        {
          question: "A 'value trap' is a stock that:",
          options: [
            "Is expensive and overhyped",
            "Looks cheap on multiples but stays cheap as the business deteriorates",
            "Has no earnings",
            "Pays no dividend",
          ],
          answerIndex: 1,
          explanation: "Some stocks are cheap for good reason. If fundamentals keep eroding, the low multiple persists and the 'value' never materializes.",
        },
      ],
      tryInChat: {
        label: "Interrogate a multiple",
        prompt: "Intel trades at a low P/E — tell me whether that's a bargain or a value trap and what the multiple is pricing in",
      },
      takeaways: [
        "A multiple is a compressed forecast of growth and risk, not a cheap/expensive label.",
        "Enterprise-value multiples let you compare businesses with different debt loads.",
        "Cheap multiples can be value traps; treat them as a question, not a conclusion.",
      ],
    },
    {
      id: "vq-dcf-basics",
      title: "DCF: Where Value Comes From",
      hook: "A business is worth the cash it will hand you, discounted back to today.",
      difficulty: "advanced",
      subtitle: "The logic of discounted cash flow — and why its inputs matter more than its output.",
      figure: "dcf-bridge",
      conceptCards: [
        {
          emoji: "",
          heading: "Three ingredients",
          body: "A DCF needs the cash flows a business will produce, a discount rate that reflects their risk and the time value of money, and a terminal value for everything beyond the forecast. Intrinsic value is the present value of all of it.",
        },
        {
          emoji: "",
          heading: "The terminal value dominates",
          body: "In most DCFs the majority of the value sits in the terminal value — the part you can least forecast. Small changes in the assumed long-run growth or discount rate swing the answer enormously, which is why DCFs are precise but not accurate.",
        },
        {
          emoji: "",
          heading: "Use it to frame, not to pinpoint",
          body: "A DCF's value is in forcing you to state your assumptions explicitly. Don't trust the single number it spits out — vary the inputs, see the range, and understand which assumption the whole thesis rests on.",
        },
      ],
      keyTerms: [
        { term: "Discounted cash flow (DCF)", definition: "Valuing a business as the present value of its future free cash flows." },
        { term: "Discount rate", definition: "The required return used to translate future cash into today's value; higher for riskier flows." },
        { term: "Terminal value", definition: "The estimated value of all cash flows beyond the explicit forecast period." },
        { term: "Present value", definition: "What a future cash flow is worth today after discounting for time and risk." },
        { term: "Sensitivity analysis", definition: "Re-running a model across input ranges to see how much the answer moves." },
      ],
      realWorldExample: {
        scenario:
          "Long-duration growth stocks swung violently when discount rates rose in 2022. Nothing about the businesses changed overnight; the same future cash flows were simply worth less when discounted at a higher rate.",
        ticker: "",
        lesson: "The output of a DCF is hostage to its inputs. The discount rate and terminal assumptions, not the spreadsheet's precision, drive the answer.",
      },
      quiz: [
        {
          question: "Intrinsic value in a DCF equals:",
          options: [
            "Next year's earnings times a multiple",
            "The present value of future free cash flows plus terminal value",
            "Total assets minus liabilities",
            "The current stock price",
          ],
          answerIndex: 1,
          explanation: "A DCF discounts all expected future cash flows, including a terminal value, back to today.",
        },
        {
          question: "Why are DCFs described as 'precise but not accurate'?",
          options: [
            "They use too few decimals",
            "Small changes in discount rate and terminal growth swing the result dramatically",
            "They ignore cash flows",
            "They can't be computed",
          ],
          answerIndex: 1,
          explanation: "The output looks exact, but it's extremely sensitive to a few hard-to-forecast assumptions, especially terminal value.",
        },
        {
          question: "When rates rise, long-duration growth stocks fall hardest because:",
          options: [
            "Their earnings disappear",
            "Their distant cash flows are discounted more heavily",
            "They pay higher dividends",
            "They have no terminal value",
          ],
          answerIndex: 1,
          explanation: "Most of a growth stock's value is far in the future, so a higher discount rate cuts its present value the most.",
        },
      ],
      tryInChat: {
        label: "Frame a DCF",
        prompt: "Sketch a simple DCF for a company I name and show me which assumption the valuation hinges on",
      },
      takeaways: [
        "Value = present value of future free cash flows, including a terminal value.",
        "Terminal value usually dominates and is the least forecastable piece.",
        "Use a DCF to expose assumptions and ranges, not to pinpoint a single 'true' price.",
      ],
    },
    {
      id: "vq-reverse-dcf",
      title: "Reverse DCF: What's Priced In",
      hook: "Don't forecast the future. Ask what future the price already assumes.",
      difficulty: "advanced",
      subtitle: "Inverting the DCF to read the growth and margins the current price implies — then judging whether they're realistic.",
      widget: {
        type: "reverse_dcf",
        title: "Solve for the implied growth",
        prompt: "Dial the growth rate until the model's value matches the market price — that's what the stock is already assuming.",
        params: { currentPrice: 180, currentFcfPerShare: 6, impliedGrowthPct: 12, discountRatePct: 9, years: 10 },
      },
      conceptCards: [
        {
          emoji: "",
          heading: "Flip the question",
          body: "Instead of building a forecast to derive a price, take the price and solve for the growth and margins it requires. This reframes valuation from 'what will happen' to 'what has to happen to justify this price.'",
        },
        {
          emoji: "",
          heading: "Judge the embedded expectations",
          body: "Once you know the implied path — say, 15% growth for a decade — you can ask whether that's plausible given the market size, competition, and base rates. The bet becomes about expectations versus reality, not your forecast versus theirs.",
        },
        {
          emoji: "",
          heading: "Edge lives in the gap",
          body: "You make money when the expectations baked into the price are wrong and you can see why. A great company priced for perfection can be a poor investment; a mediocre one priced for disaster can be a great one.",
        },
      ],
      keyTerms: [
        { term: "Reverse DCF", definition: "Solving for the growth/margin assumptions implied by the current price instead of forecasting to a target." },
        { term: "Embedded expectations", definition: "The future performance the market price already assumes." },
        { term: "Expectations investing", definition: "Mauboussin and Rappaport's approach of betting on revisions to embedded expectations." },
        { term: "Priced for perfection", definition: "A price that requires flawless execution, leaving no room for disappointment." },
      ],
      realWorldExample: {
        scenario:
          "At its peak valuation, a high-flying growth stock's price implied that revenue would compound at extraordinary rates for many years. A reverse DCF made that assumption explicit — and obviously fragile — well before the multiple compressed.",
        ticker: "TSLA",
        lesson: "The price is a forecast. Make it explicit, and you can judge whether you're being asked to bet on the plausible or the heroic.",
      },
      quiz: [
        {
          question: "A reverse DCF asks:",
          options: [
            "What is the company worth from my forecast?",
            "What growth and margins does the current price already imply?",
            "What is the dividend yield?",
            "What multiple do peers trade at?",
          ],
          answerIndex: 1,
          explanation: "It inverts the usual DCF: rather than forecasting to a value, it solves for the expectations embedded in today's price.",
        },
        {
          question: "Why is 'what's priced in' a more useful question than 'what will happen'?",
          options: [
            "It's easier to compute",
            "It locates your edge in the gap between embedded expectations and reality",
            "It removes all risk",
            "It ignores growth",
          ],
          answerIndex: 1,
          explanation: "You profit when embedded expectations are wrong and you can see why — so the expectations, not raw forecasts, are the thing to judge.",
        },
        {
          question: "A company 'priced for perfection' is risky because:",
          options: [
            "It has no earnings",
            "Even good results can disappoint the heroic expectations in the price",
            "It pays no dividend",
            "Its multiple is low",
          ],
          answerIndex: 1,
          explanation: "When the price already assumes flawless execution, anything less than perfect triggers a de-rating.",
        },
      ],
      tryInChat: {
        label: "Reverse-engineer the price",
        prompt: "Run a reverse DCF on a stock I name and tell me what growth rate the market is already assuming",
      },
      takeaways: [
        "Invert the DCF: solve for the growth the price requires, then judge if it's plausible.",
        "Your edge is in the gap between embedded expectations and likely reality.",
        "Great companies priced for perfection can be bad bets; hated ones priced for disaster can be good ones.",
      ],
    },
    {
      id: "vq-owner-earnings",
      title: "Owner Earnings & Cash Quality",
      hook: "Net income is an opinion. Free cash flow is closer to a fact.",
      difficulty: "advanced",
      subtitle: "Reconciling reported earnings to the cash an owner could actually take out of the business.",
      conceptCards: [
        {
          emoji: "",
          heading: "What owner earnings means",
          body: "Buffett's owner earnings start from reported profit, add back non-cash charges, and subtract the maintenance capital the business truly needs to hold its position. It approximates the cash an owner could extract without weakening the company.",
        },
        {
          emoji: "",
          heading: "Maintenance vs growth capex",
          body: "Not all capex is equal. Maintenance capex keeps the lights on; growth capex funds expansion. Owner earnings only charge for maintenance, so separating the two reveals how much a company is spending to grow versus just to stand still.",
        },
        {
          emoji: "",
          heading: "Watch the conversion",
          body: "Healthy businesses convert most reported earnings into free cash flow over time. When earnings rise but cash conversion stays weak year after year, suspect working-capital games, aggressive recognition, or capitalized costs.",
        },
      ],
      keyTerms: [
        { term: "Owner earnings", definition: "Reported profit + non-cash charges − maintenance capex; an estimate of distributable cash." },
        { term: "Maintenance capex", definition: "Capital spending required to sustain current operations and competitive position." },
        { term: "Free cash flow conversion", definition: "Free cash flow as a percentage of net income over time." },
        { term: "Non-cash charges", definition: "Expenses like depreciation and amortization that reduce profit without using cash." },
      ],
      realWorldExample: {
        scenario:
          "Capital-light franchises can convert reported earnings into cash at very high rates because they need little maintenance capex. Capital-heavy businesses with the same reported profit hand owners far less, because much of the 'profit' must be reinvested just to stay in place.",
        ticker: "MCO",
        lesson: "Two companies with identical net income can deliver wildly different cash to owners. Owner earnings, not EPS, tells you which is the better business.",
      },
      quiz: [
        {
          question: "Owner earnings differ from net income mainly by:",
          options: [
            "Ignoring revenue",
            "Adding back non-cash charges and subtracting maintenance capex",
            "Doubling depreciation",
            "Removing taxes",
          ],
          answerIndex: 1,
          explanation: "Owner earnings adjust profit toward the cash an owner could withdraw, charging only for the capex needed to maintain the business.",
        },
        {
          question: "Why separate maintenance capex from growth capex?",
          options: [
            "They're taxed differently",
            "Only maintenance capex is needed to sustain the business; growth capex is discretionary",
            "Growth capex isn't real",
            "It changes revenue",
          ],
          answerIndex: 1,
          explanation: "Distinguishing the two shows how much spending merely holds position versus funds expansion — central to estimating distributable cash.",
        },
        {
          question: "Persistently weak free-cash-flow conversion despite rising earnings suggests:",
          options: [
            "A high-quality business",
            "Possible working-capital, recognition, or capitalization issues",
            "A tax refund",
            "Nothing notable",
          ],
          answerIndex: 1,
          explanation: "If profit keeps rising but little of it becomes cash, the quality of those earnings is suspect.",
        },
      ],
      tryInChat: {
        label: "Estimate owner earnings",
        prompt: "Estimate the owner earnings and free-cash-flow conversion for a company I name",
      },
      takeaways: [
        "Owner earnings approximate the cash an owner could take out without weakening the business.",
        "Separating maintenance from growth capex reveals true distributable cash.",
        "Weak cash conversion alongside rising earnings is an earnings-quality warning.",
      ],
    },
    {
      id: "vq-roic-compounding",
      title: "ROIC & the Compounding Machine",
      hook: "A business that earns 30% on capital and can reinvest is a money printer.",
      difficulty: "advanced",
      subtitle: "Why a high return on capital plus a long reinvestment runway is the most powerful force in investing.",
      widget: {
        type: "compound_interest",
        title: "Watch intrinsic value compound",
        prompt: "Treat the rate as a business's return on reinvested capital and watch how a long runway dwarfs the starting base.",
        params: { principal: 10000, monthlyContribution: 0, years: 25, annualRatePct: 18 },
      },
      conceptCards: [
        {
          emoji: "",
          heading: "Return × runway",
          body: "A high ROIC matters only if the company can keep reinvesting at that rate. Return on capital tells you how good each dollar is; the reinvestment runway tells you how many dollars can be deployed. The product is what compounds intrinsic value.",
        },
        {
          emoji: "",
          heading: "Compounders vs cash returners",
          body: "A high-ROIC business with nowhere to reinvest becomes a cash returner — fine, but not a compounder. The rare, valuable case is high returns plus a long runway, where retained earnings keep earning the same high rate for years.",
        },
        {
          emoji: "",
          heading: "The market underprices duration",
          body: "Investors routinely underestimate how long a great business can keep compounding. The biggest long-run winners are usually those that sustained high reinvestment returns far longer than the market dared to assume.",
        },
      ],
      keyTerms: [
        { term: "Reinvestment runway", definition: "The amount of capital a company can deploy at high returns before opportunities run out." },
        { term: "Compounder", definition: "A business that reinvests at high rates of return for a long time, compounding intrinsic value." },
        { term: "Cash returner", definition: "A high-return business with limited reinvestment options that returns cash to shareholders." },
        { term: "Incremental ROIC", definition: "The return earned on each new dollar of invested capital." },
      ],
      realWorldExample: {
        scenario:
          "A handful of franchises sustained high returns on capital and kept finding places to reinvest for decades, and their intrinsic value compounded far beyond what early multiples implied. The duration of the compounding, not a single year's growth, did the heavy lifting.",
        ticker: "MA",
        lesson: "The rare prize is high ROIC plus a long runway. When both hold, time turns a good business into an extraordinary investment.",
      },
      quiz: [
        {
          question: "A high ROIC compounds intrinsic value only when the company can also:",
          options: [
            "Pay a large dividend",
            "Reinvest capital at that high rate (a reinvestment runway)",
            "Buy back stock",
            "Lower its tax rate",
          ],
          answerIndex: 1,
          explanation: "Without a runway to redeploy capital at the same high return, a high-ROIC business returns cash rather than compounding.",
        },
        {
          question: "A 'cash returner' differs from a 'compounder' because it:",
          options: [
            "Earns low returns",
            "Has high returns but limited reinvestment opportunities",
            "Has no earnings",
            "Pays no taxes",
          ],
          answerIndex: 1,
          explanation: "Cash returners earn well but can't reinvest much, so they distribute cash instead of compounding it internally.",
        },
        {
          question: "The biggest long-run winners usually share:",
          options: [
            "A low stock price",
            "High reinvestment returns sustained far longer than the market expected",
            "Frequent stock splits",
            "Zero debt",
          ],
          answerIndex: 1,
          explanation: "Underestimated duration of high-return compounding is the common thread among the greatest long-term performers.",
        },
      ],
      tryInChat: {
        label: "Spot a compounder",
        prompt: "Assess whether a company I name is a true compounder — high ROIC with a long reinvestment runway",
      },
      takeaways: [
        "Compounding intrinsic value = high return on capital × a long reinvestment runway.",
        "High ROIC without a runway makes a cash returner, not a compounder.",
        "The market chronically underprices how long great businesses keep compounding.",
      ],
    },
    {
      id: "vq-moats",
      title: "Moats: What Protects Returns",
      hook: "High returns attract competition. Only a moat keeps them.",
      difficulty: "advanced",
      subtitle: "The structural advantages that let a business defend high returns on capital over time.",
      figure: "moat",
      conceptCards: [
        {
          emoji: "",
          heading: "Why moats exist",
          body: "High returns on capital invite competitors who compete those returns away — unless something structural stops them. A moat is that durable barrier, and its presence is what separates a temporarily good business from a lastingly great one.",
        },
        {
          emoji: "",
          heading: "The real sources",
          body: "Genuine moats come from network effects, high switching costs, intangible assets like brands and patents, cost advantages from scale or process, and efficient scale in limited markets. A nice product or a current lead is not, by itself, a moat.",
        },
        {
          emoji: "",
          heading: "Durability is the question",
          body: "The key isn't whether a moat exists today but whether it's widening or eroding. Technology, regulation, and shifting customer behavior can fill a moat fast. Assess the trajectory of the advantage, not just its current width.",
        },
      ],
      keyTerms: [
        { term: "Economic moat", definition: "A durable structural advantage that protects a company's returns from competition." },
        { term: "Network effect", definition: "A product that gets more valuable as more people use it, reinforcing the leader." },
        { term: "Switching costs", definition: "The money, time, or risk that deters customers from leaving for a rival." },
        { term: "Efficient scale", definition: "A market just large enough for a few players, deterring new entrants." },
        { term: "Intangible assets", definition: "Brands, patents, and licenses that confer pricing power or legal protection." },
      ],
      realWorldExample: {
        scenario:
          "Payment networks benefit from a powerful two-sided network effect — more merchants attract more cardholders and vice versa — which has protected their high returns on capital for decades against well-funded challengers.",
        ticker: "V",
        lesson: "The strongest moats are structural, not product-deep. Ask what would have to happen for a competitor to break in — and how likely that is.",
      },
      quiz: [
        {
          question: "Why do high returns on capital tend to fade without a moat?",
          options: [
            "Taxes rise",
            "Competition is attracted and competes the returns away",
            "Customers stop buying",
            "Depreciation increases",
          ],
          answerIndex: 1,
          explanation: "Abnormal profits draw entrants. Only a durable structural barrier keeps competitors from eroding the returns.",
        },
        {
          question: "Which is a genuine source of a moat?",
          options: [
            "A currently popular product",
            "High customer switching costs",
            "A recent earnings beat",
            "A low share price",
          ],
          answerIndex: 1,
          explanation: "Switching costs are structural and durable; a popular product or a good quarter is neither.",
        },
        {
          question: "The most important question about a moat is whether it is:",
          options: [
            "Mentioned by management",
            "Widening or eroding over time",
            "Visible in the stock price",
            "Tax-advantaged",
          ],
          answerIndex: 1,
          explanation: "Moats can fill in. What matters is the trajectory of the advantage, not just its existence today.",
        },
      ],
      tryInChat: {
        label: "Assess a moat",
        prompt: "Tell me whether Visa has a durable economic moat, what kind, and whether it's widening or eroding",
      },
      takeaways: [
        "Moats are durable structural barriers that defend high returns from competition.",
        "Real sources: network effects, switching costs, intangibles, cost advantages, efficient scale.",
        "Judge the trajectory — a moat widening beats one quietly eroding.",
      ],
    },
    {
      id: "vq-margin-of-safety",
      title: "Margin of Safety",
      hook: "Be approximately right with room to be wrong.",
      difficulty: "core",
      subtitle: "Why the gap between price and value is your protection against error, bad luck, and the unknown.",
      figure: "margin-of-safety",
      conceptCards: [
        {
          emoji: "",
          heading: "Buy value at a discount",
          body: "Graham's margin of safety is the gap between a conservative estimate of intrinsic value and the price you pay. Buying well below value means even a wrong estimate or an unlucky outcome may still leave you whole.",
        },
        {
          emoji: "",
          heading: "It's humility, quantified",
          body: "Your value estimate will sometimes be too high. The margin of safety acknowledges that fallibility up front: the bigger the uncertainty, the bigger the discount you should demand before committing capital.",
        },
        {
          emoji: "",
          heading: "Price paid sets the return",
          body: "The same business bought cheaply or dearly produces very different returns. A great company at too high a price can be a poor investment; the entry price, not just the quality, determines the outcome.",
        },
      ],
      keyTerms: [
        { term: "Margin of safety", definition: "The discount of purchase price to conservatively estimated intrinsic value." },
        { term: "Intrinsic value", definition: "What a business is fundamentally worth, independent of its market price." },
        { term: "Mr. Market", definition: "Graham's metaphor for a moody market that offers wildly varying prices day to day." },
        { term: "Downside protection", definition: "Features of a position that limit losses if the thesis is wrong." },
      ],
      realWorldExample: {
        scenario:
          "Investors who bought sound businesses at deeply depressed prices during market panics earned strong returns partly because the low entry price left enormous room for error. Those who paid peak prices for the same companies waited years to break even.",
        ticker: "",
        lesson: "The discount to value is what protects you when you're wrong — and you will sometimes be wrong. Demand it.",
      },
      quiz: [
        {
          question: "A margin of safety is:",
          options: [
            "A stop-loss order",
            "The discount of price to a conservative estimate of intrinsic value",
            "A type of dividend",
            "A leverage ratio",
          ],
          answerIndex: 1,
          explanation: "It's the cushion between what you pay and what the business is conservatively worth — protection against error and bad luck.",
        },
        {
          question: "The riskier or less certain your value estimate, the margin of safety should be:",
          options: ["Smaller", "Larger", "Zero", "Unchanged"],
          answerIndex: 1,
          explanation: "Greater uncertainty demands a bigger discount, because your estimate is more likely to be off.",
        },
        {
          question: "A great company can still be a poor investment when:",
          options: [
            "It pays a dividend",
            "You pay a price far above its intrinsic value",
            "It grows quickly",
            "It has a moat",
          ],
          answerIndex: 1,
          explanation: "Quality doesn't override price. Overpaying for even an excellent business can produce poor returns.",
        },
      ],
      tryInChat: {
        label: "Size up the discount",
        prompt: "Estimate a rough intrinsic value for a stock I name and tell me whether there's a margin of safety at today's price",
      },
      takeaways: [
        "Margin of safety = the discount of price to conservative intrinsic value.",
        "Bigger uncertainty demands a bigger discount; it's humility made quantitative.",
        "Entry price drives returns — a great company overpaid for is a poor investment.",
      ],
    },
  ],
};
