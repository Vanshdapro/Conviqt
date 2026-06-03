// Track: Fundamental Analysis — turning raw statements into judgments about
// profitability, returns on capital, balance-sheet safety, and growth quality.

import type { RawTrack } from "../types";

export const fundamentalAnalysis: RawTrack = {
  id: "fundamental-analysis",
  name: "Fundamental Analysis",
  tagline: "Statements are the raw material. Analysis is turning them into judgment.",
  emoji: "",
  accent: "#2dd4bf",
  lessons: [
    {
      id: "fa-margins",
      title: "Margins: Gross to Net",
      hook: "Margins tell you what kind of business you're actually looking at.",
      difficulty: "core",
      subtitle: "Reading gross, operating, and net margins to understand pricing power, efficiency, and cost structure.",
      figure: "margins",
      conceptCards: [
        {
          emoji: "",
          heading: "Each margin answers a question",
          body: "Gross margin asks how much pricing power you have over your direct costs. Operating margin asks how efficiently you run the whole operation. Net margin asks what survives after financing and taxes. Reading all three locates where profit is made or lost.",
        },
        {
          emoji: "",
          heading: "High gross margin = optionality",
          body: "A high gross margin gives a company room to spend on R&D, marketing, or price cuts and still profit. Low-gross-margin businesses have almost no slack — a small cost shock can wipe out the bottom line.",
        },
        {
          emoji: "",
          heading: "Trends beat levels",
          body: "A single margin number means little without context. Rising margins suggest scale or pricing power; falling margins suggest competition or cost pressure. Always compare a company to its own history and to close peers.",
        },
      ],
      keyTerms: [
        { term: "Gross margin", definition: "(Revenue − COGS) / Revenue; profit left after direct production costs." },
        { term: "Operating margin", definition: "Operating income / Revenue; profitability of the core business before interest and taxes." },
        { term: "Net margin", definition: "Net income / Revenue; the share of each sales dollar that reaches the bottom line." },
        { term: "Operating leverage", definition: "How profit scales as revenue grows when fixed costs stay roughly flat." },
        { term: "Pricing power", definition: "The ability to raise prices without losing enough volume to hurt profit." },
      ],
      realWorldExample: {
        scenario:
          "A luxury brand and a discount retailer can both be excellent businesses, but the luxury name carries far higher gross margins, giving it room to weather a weak quarter that would push a thin-margin retailer into a loss.",
        ticker: "COST",
        lesson: "Margin structure defines the playbook. A thin-margin operator wins on volume and efficiency; a high-margin one wins on pricing power and brand.",
      },
      quiz: [
        {
          question: "A company with a very high gross margin generally has:",
          options: [
            "No competition by definition",
            "Room to invest or cut prices and still make money",
            "Guaranteed high net income",
            "Lower revenue than peers",
          ],
          answerIndex: 1,
          explanation: "High gross margin creates slack to fund R&D, marketing, or price cuts while staying profitable — strategic optionality.",
        },
        {
          question: "Operating margin differs from net margin because operating margin excludes:",
          options: ["Revenue", "Cost of goods sold", "Interest and taxes", "Operating expenses"],
          answerIndex: 2,
          explanation: "Operating margin stops at operating income, before interest and taxes, isolating core operating efficiency.",
        },
        {
          question: "Why are margin trends more informative than a single year's margin?",
          options: [
            "Single years are always wrong",
            "Trends reveal whether pricing power and efficiency are improving or eroding",
            "Margins never change",
            "Only net margin matters",
          ],
          answerIndex: 1,
          explanation: "Direction over time — versus a company's own history and peers — signals competitive position far better than one static number.",
        },
      ],
      tryInChat: {
        label: "Compare margin structures",
        prompt: "Compare the gross, operating, and net margins of Costco and a luxury retailer and tell me what each structure implies",
      },
      takeaways: [
        "Gross, operating, and net margins each isolate a different layer of profitability.",
        "High gross margin buys strategic optionality; thin margin demands volume and efficiency.",
        "Judge margins by trend and against peers, not as a single number.",
      ],
    },
    {
      id: "fa-dupont",
      title: "DuPont: Decomposing ROE",
      hook: "Two companies can have the same ROE for completely different reasons.",
      difficulty: "advanced",
      subtitle: "Breaking return on equity into margin, asset turnover, and leverage to see what's really driving returns.",
      figure: "dupont",
      conceptCards: [
        {
          emoji: "",
          heading: "Three levers behind one number",
          body: "DuPont splits ROE into net margin (profit per sale) × asset turnover (sales per dollar of assets) × financial leverage (assets per dollar of equity). The same ROE can come from fat margins, fast turnover, or heavy borrowing.",
        },
        {
          emoji: "",
          heading: "Leverage flatters ROE",
          body: "Because leverage multiplies the result, a mediocre business can show a flattering ROE simply by borrowing more. Decomposing the ratio tells you whether returns come from operating excellence or just from a risky balance sheet.",
        },
        {
          emoji: "",
          heading: "Diagnose, then compare",
          body: "Use DuPont to see which lever a company pulls — and whether that lever is sustainable. A retailer wins on turnover, a software firm on margin, a bank on leverage. Mismatched levers across peers reveal different strategies and risks.",
        },
      ],
      keyTerms: [
        { term: "Return on equity (ROE)", definition: "Net income / shareholders' equity; profit generated per dollar owners put in." },
        { term: "Asset turnover", definition: "Revenue / total assets; how efficiently assets generate sales." },
        { term: "Financial leverage (equity multiplier)", definition: "Total assets / equity; how much the balance sheet is funded by debt versus owners." },
        { term: "DuPont analysis", definition: "ROE = net margin × asset turnover × leverage; a framework to source returns." },
      ],
      realWorldExample: {
        scenario:
          "A discount retailer and a software company might both report a 25% ROE. The retailer gets there with thin margins and rapid asset turnover; the software firm with huge margins and low turnover. Same headline, opposite businesses.",
        ticker: "WMT",
        lesson: "ROE alone hides the strategy. DuPont reveals whether returns are earned through operations or manufactured through leverage.",
      },
      quiz: [
        {
          question: "DuPont decomposes ROE into:",
          options: [
            "Revenue, costs, and taxes",
            "Net margin, asset turnover, and financial leverage",
            "Price, earnings, and growth",
            "Cash, debt, and equity",
          ],
          answerIndex: 1,
          explanation: "ROE = net margin × asset turnover × equity multiplier — profitability, efficiency, and leverage.",
        },
        {
          question: "A company raises its ROE purely by taking on more debt. DuPont would show this as a rise in:",
          options: ["Net margin", "Asset turnover", "Financial leverage", "Revenue"],
          answerIndex: 2,
          explanation: "More debt raises the equity multiplier (assets/equity), lifting ROE without any operating improvement — and adding risk.",
        },
        {
          question: "Why is DuPont useful when comparing two firms with identical ROE?",
          options: [
            "It changes the ROE",
            "It reveals whether returns come from margins, turnover, or leverage",
            "It predicts the stock price",
            "It eliminates taxes",
          ],
          answerIndex: 1,
          explanation: "Identical ROE can mask very different — and differently risky — sources of return, which the decomposition exposes.",
        },
      ],
      tryInChat: {
        label: "Run a DuPont breakdown",
        prompt: "Do a DuPont decomposition of Walmart's ROE and tell me whether margin, turnover, or leverage drives it",
      },
      takeaways: [
        "ROE = net margin × asset turnover × leverage; the same ROE can come from very different places.",
        "Leverage mechanically inflates ROE without improving the underlying business.",
        "Use DuPont to identify which lever a company pulls and whether it's sustainable.",
      ],
    },
    {
      id: "fa-roic-wacc",
      title: "ROIC vs the Cost of Capital",
      hook: "Value is created only when returns beat the cost of the money used.",
      difficulty: "advanced",
      subtitle: "Why the spread between return on invested capital and the cost of capital is the real test of a business.",
      figure: "roic-spread",
      conceptCards: [
        {
          emoji: "",
          heading: "The spread is everything",
          body: "Return on invested capital (ROIC) measures profit per dollar of capital actually deployed. If ROIC exceeds the weighted average cost of capital (WACC), each dollar reinvested creates value; if it's below, growth destroys value. The spread, not growth alone, decides.",
        },
        {
          emoji: "",
          heading: "ROIC beats ROE for quality",
          body: "ROE can be juiced with leverage; ROIC looks at all the capital (debt and equity) and isn't fooled by borrowing. It's the cleaner measure of how good the business is at turning capital into profit.",
        },
        {
          emoji: "",
          heading: "Growth without a spread is a treadmill",
          body: "A company can grow revenue for years and create no value if it earns below its cost of capital. Plenty of capital-intensive industries fall here. Always ask: is this growth earning more than the capital it consumes?",
        },
      ],
      keyTerms: [
        { term: "ROIC", definition: "Net operating profit after tax / invested capital; return on all capital deployed in the business." },
        { term: "WACC", definition: "Weighted average cost of capital; the blended required return of debt and equity holders." },
        { term: "Economic spread", definition: "ROIC minus WACC; positive means value creation, negative means value destruction." },
        { term: "Invested capital", definition: "Debt plus equity put to work in operations, net of non-operating cash." },
        { term: "Value creation", definition: "Reinvesting at a return above the cost of capital, compounding owner value." },
      ],
      realWorldExample: {
        scenario:
          "Some airlines and commodity producers have grown for decades while routinely earning returns below their cost of capital, creating little lasting shareholder value. High-ROIC franchises with reinvestment runways did the opposite.",
        ticker: "V",
        lesson: "Growth is only good when ROIC exceeds WACC. Otherwise the company is busily converting capital into less value.",
      },
      quiz: [
        {
          question: "A company creates economic value when:",
          options: [
            "Revenue grows every year",
            "ROIC exceeds its cost of capital (WACC)",
            "It pays a dividend",
            "Its stock price rises",
          ],
          answerIndex: 1,
          explanation: "Value creation requires earning more on invested capital than that capital costs — a positive ROIC − WACC spread.",
        },
        {
          question: "ROIC is generally preferred to ROE for judging business quality because ROIC:",
          options: [
            "Is always higher",
            "Considers all capital and isn't inflated by leverage",
            "Ignores taxes",
            "Equals the stock return",
          ],
          answerIndex: 1,
          explanation: "ROIC looks at debt and equity together, so it isn't flattered by borrowing the way ROE can be.",
        },
        {
          question: "A firm grows fast but earns below its cost of capital. That growth is:",
          options: [
            "Creating value",
            "Destroying value despite the growth",
            "Irrelevant to value",
            "Always a buy signal",
          ],
          answerIndex: 1,
          explanation: "Reinvesting below the cost of capital destroys value; more of it just destroys value faster.",
        },
      ],
      tryInChat: {
        label: "Test the spread",
        prompt: "Estimate Visa's ROIC versus its cost of capital and tell me whether its growth is creating value",
      },
      takeaways: [
        "Value is created only when ROIC exceeds WACC — the spread, not growth, is the test.",
        "ROIC is harder to fake than ROE because it accounts for all capital.",
        "Growth below the cost of capital destroys value, no matter how fast.",
      ],
    },
    {
      id: "fa-leverage-coverage",
      title: "Leverage & Coverage",
      hook: "Debt magnifies everything — including the mistakes.",
      difficulty: "advanced",
      subtitle: "The ratios that tell you whether a balance sheet is a launchpad or a landmine.",
      conceptCards: [
        {
          emoji: "",
          heading: "Stock vs flow of debt",
          body: "Leverage ratios (debt/equity, net debt/EBITDA) measure how much is owed; coverage ratios (interest coverage, fixed-charge coverage) measure the ability to service it from earnings. You need both: a big debt load is fine if cash flow comfortably covers it.",
        },
        {
          emoji: "",
          heading: "Liquidity is survival",
          body: "Current and quick ratios test whether short-term assets can cover short-term liabilities. A profitable company can still be forced into a fire sale or dilution if it can't meet obligations that come due before its assets convert to cash.",
        },
        {
          emoji: "",
          heading: "Leverage cuts both ways",
          body: "Borrowing amplifies returns in good times and losses in bad. The danger isn't debt itself but the combination of high leverage with volatile cash flows — that's what turns an ordinary downturn into insolvency.",
        },
      ],
      keyTerms: [
        { term: "Net debt / EBITDA", definition: "Debt minus cash, divided by operating earnings; how many years of earnings it would take to repay debt." },
        { term: "Interest coverage", definition: "EBIT / interest expense; how many times earnings cover the interest bill." },
        { term: "Current ratio", definition: "Current assets / current liabilities; a basic liquidity test." },
        { term: "Quick ratio", definition: "Liquid current assets (excluding inventory) / current liabilities; a stricter liquidity test." },
        { term: "Covenant", definition: "A lender's condition (e.g., a max leverage ratio) that, if breached, can trigger default." },
      ],
      realWorldExample: {
        scenario:
          "Companies that paired heavy debt with cyclical revenue — some retailers and energy producers — breached covenants when a downturn hit, forcing restructurings even though the underlying business still had customers.",
        ticker: "",
        lesson: "It's rarely debt alone that kills a company. It's leverage stacked on cash flows that can suddenly drop.",
      },
      quiz: [
        {
          question: "Interest coverage measures:",
          options: [
            "Total debt outstanding",
            "How many times earnings cover the interest expense",
            "The dividend yield",
            "Cash in the bank",
          ],
          answerIndex: 1,
          explanation: "Interest coverage (EBIT / interest) shows the cushion between earnings and the interest the company must pay.",
        },
        {
          question: "Why use the quick ratio instead of the current ratio?",
          options: [
            "It includes more assets",
            "It excludes inventory, which may not convert to cash quickly",
            "It ignores liabilities",
            "It's the same thing",
          ],
          answerIndex: 1,
          explanation: "The quick ratio strips out inventory to test liquidity under stress, when inventory may be hard to sell at full value.",
        },
        {
          question: "The most dangerous combination is high leverage paired with:",
          options: [
            "Stable, recurring cash flow",
            "Volatile, cyclical cash flow",
            "A large cash balance",
            "Low interest rates",
          ],
          answerIndex: 1,
          explanation: "Fixed debt payments against swinging cash flows is what turns a normal downturn into a solvency crisis.",
        },
      ],
      tryInChat: {
        label: "Stress-test the balance sheet",
        prompt: "Assess a company's leverage and coverage ratios and tell me how it would hold up in a downturn",
      },
      takeaways: [
        "Measure both the size of debt (leverage) and the ability to service it (coverage).",
        "Liquidity ratios test whether a profitable company can still meet near-term bills.",
        "Leverage plus volatile cash flow is the combination that causes insolvency.",
      ],
    },
    {
      id: "fa-good-vs-bad-growth",
      title: "Good Growth vs Bad Growth",
      hook: "Not all growth is worth paying for. Some isn't worth having.",
      difficulty: "advanced",
      subtitle: "Separating durable, high-return growth from growth that burns capital or rents revenue.",
      conceptCards: [
        {
          emoji: "",
          heading: "Growth has a cost",
          body: "Revenue growth consumes capital — for capacity, working capital, acquisitions. Good growth earns a return well above that capital's cost and can be repeated; bad growth buys revenue at or below cost and stops the moment spending stops.",
        },
        {
          emoji: "",
          heading: "Organic vs bought",
          body: "Growth from winning customers with a better product is more durable than growth stapled together through serial acquisitions. Acquisitive roll-ups can mask weak organic trends and pile on integration risk and goodwill that may later be written down.",
        },
        {
          emoji: "",
          heading: "Durability is the real question",
          body: "Ask whether the growth is recurring (subscriptions, repeat purchase, network effects) or one-off (a fad, a stimulus, a pull-forward). Durable revenue deserves a premium; rented revenue deserves skepticism, however fast it looks today.",
        },
      ],
      keyTerms: [
        { term: "Organic growth", definition: "Revenue growth from the existing business, excluding acquisitions and currency effects." },
        { term: "Incremental ROIC", definition: "The return earned specifically on newly invested capital — the economics of the next dollar." },
        { term: "Reinvestment runway", definition: "How much capital a company can deploy at high returns before opportunities run out." },
        { term: "Revenue durability", definition: "How likely current revenue is to recur rather than fade." },
        { term: "Roll-up", definition: "A growth strategy built on serial acquisitions rather than organic expansion." },
      ],
      realWorldExample: {
        scenario:
          "Companies that grew by repeatedly acquiring rivals sometimes posted dazzling headline growth while organic revenue stagnated and goodwill ballooned — and later took large write-downs when the acquired businesses underperformed.",
        ticker: "",
        lesson: "Strip out acquisitions and one-offs and ask what the core business is really doing. Bought growth and durable growth are not the same asset.",
      },
      quiz: [
        {
          question: "Growth creates value only when:",
          options: [
            "Revenue rises at all",
            "The capital funding it earns a return above its cost",
            "The company is large",
            "It comes from acquisitions",
          ],
          answerIndex: 1,
          explanation: "Growth funded by capital that earns below its cost destroys value; the return on the incremental capital is what matters.",
        },
        {
          question: "Why is heavily acquisition-driven growth treated with more skepticism?",
          options: [
            "Acquisitions are illegal",
            "It can mask weak organic trends and carries integration risk and goodwill",
            "It always fails",
            "It lowers revenue",
          ],
          answerIndex: 1,
          explanation: "Serial acquisitions can hide a stagnant core, add integration risk, and create goodwill that may later be impaired.",
        },
        {
          question: "Durable revenue (subscriptions, repeat purchase) deserves a premium because:",
          options: [
            "It is tax-free",
            "It is more likely to recur, making future cash flows more predictable",
            "It grows faster by law",
            "It needs no investment",
          ],
          answerIndex: 1,
          explanation: "Recurring revenue raises the odds that today's sales repeat, which makes the cash-flow stream more valuable.",
        },
      ],
      tryInChat: {
        label: "Judge growth quality",
        prompt: "Tell me whether a company's recent growth is organic and durable or bought and one-off, and what it's worth",
      },
      takeaways: [
        "Growth consumes capital; good growth earns well above that capital's cost and repeats.",
        "Organic growth is more durable than acquisition-driven growth, which can hide a weak core.",
        "Recurring revenue earns a premium; one-off or rented revenue earns skepticism.",
      ],
    },
    {
      id: "fa-unit-economics",
      title: "Unit Economics: LTV & CAC",
      hook: "Before the whole business can work, one customer has to.",
      difficulty: "advanced",
      subtitle: "Reducing a business to a single customer to see whether growth creates value or just burns cash.",
      figure: "unit-economics",
      widget: {
        type: "ltv_cac",
        title: "Test one customer's economics",
        prompt: "Set the cost to acquire a customer against what they spend, your margin, and churn — and watch the LTV/CAC ratio decide whether growth makes money.",
        params: { cac: 300, arpuMonthly: 50, grossMarginPct: 75, monthlyChurnPct: 3 },
      },
      conceptCards: [
        {
          emoji: "",
          heading: "Shrink the business to one customer",
          body: "Unit economics ask a simple question: across one customer's lifetime, do they generate more gross profit than it cost to acquire them? If yes, scaling prints money; if no, scaling just sets cash on fire faster.",
        },
        {
          emoji: "",
          heading: "LTV, CAC, and the ratio",
          body: "Lifetime value (LTV) is the gross profit a customer delivers before churning; customer acquisition cost (CAC) is what it took to win them. The rule of thumb: LTV/CAC of 3 or more, with payback under a year, signals durable, fundable growth.",
        },
        {
          emoji: "",
          heading: "Churn is the silent killer",
          body: "Lifetime value depends on how long customers stay — so small changes in churn swing the math enormously. A leaky bucket with great CAC still fails; retention, not just acquisition, is where the best businesses win.",
        },
      ],
      keyTerms: [
        { term: "Customer acquisition cost (CAC)", definition: "The fully-loaded sales and marketing cost to win one new customer." },
        { term: "Lifetime value (LTV)", definition: "The gross profit a customer generates over their entire relationship." },
        { term: "LTV/CAC ratio", definition: "Lifetime value divided by acquisition cost; ≥ 3 is a common health bar." },
        { term: "Payback period", definition: "How many months of contribution it takes to recoup the CAC." },
        { term: "Churn", definition: "The rate at which customers leave; its inverse sets the average lifetime." },
      ],
      realWorldExample: {
        scenario:
          "Two subscription startups spend the same on marketing. One keeps customers for years at high margin; the other churns them in months. Identical CAC, but only the first has LTV/CAC above 3 — and only the first should pour money into growth.",
        ticker: "",
        lesson: "Growth is only good when the unit economics work. The same marketing spend builds a compounding machine for one company and a cash bonfire for the other.",
      },
      quiz: [
        {
          question: "Healthy unit economics generally require an LTV/CAC ratio of at least:",
          options: ["0.5", "1", "3", "10"],
          answerIndex: 2,
          explanation: "A ratio of roughly 3 or more, with payback under a year, signals each customer pays back acquisition cost with room to spare.",
        },
        {
          question: "Why does churn matter so much to lifetime value?",
          options: [
            "It changes the tax rate",
            "Customer lifetime is the inverse of churn, so small churn changes swing LTV dramatically",
            "It lowers CAC",
            "It has no effect",
          ],
          answerIndex: 1,
          explanation: "Average lifetime ≈ 1/churn, so even a small rise in churn can collapse LTV and break the economics.",
        },
        {
          question: "If LTV/CAC is below 1, faster growth will:",
          options: [
            "Create value",
            "Burn cash faster, since each customer loses money",
            "Reduce churn",
            "Increase margins",
          ],
          answerIndex: 1,
          explanation: "Acquiring customers who never repay their cost means scaling multiplies the losses.",
        },
      ],
      tryInChat: {
        label: "Run the unit economics",
        prompt: "Estimate the LTV, CAC, and payback period for a subscription company I name and tell me if the economics work",
      },
      takeaways: [
        "Unit economics test whether a single customer is profitable before judging the whole business.",
        "Aim for LTV/CAC ≥ 3 with payback under a year.",
        "Retention drives LTV — churn is the silent killer of otherwise good economics.",
      ],
    },
    {
      id: "fa-rule-of-40",
      title: "The Rule of 40",
      hook: "Grow fast or print cash — but the sum has to clear 40.",
      difficulty: "advanced",
      subtitle: "The heuristic that balances a software company's growth against its profitability.",
      widget: {
        type: "rule_of_40",
        title: "Balance growth against margin",
        prompt: "Trade off revenue growth and free-cash-flow margin and see whether the business clears the Rule of 40 bar.",
        params: { revenueGrowthPct: 30, fcfMarginPct: 10 },
      },
      conceptCards: [
        {
          emoji: "",
          heading: "Growth plus margin ≥ 40",
          body: "For a software business, revenue growth rate plus profit (often free-cash-flow) margin should sum to at least 40. It encodes a real trade: it's fine to burn cash if you're growing fast, or to grow slowly if you're highly profitable — but not to do neither.",
        },
        {
          emoji: "",
          heading: "It catches the worst of both worlds",
          body: "The rule flags the danger zone: slowing growth and thin margins together. A company decelerating from hyper-growth without a path to profitability fails the test — exactly the profile that de-rates hardest when sentiment turns.",
        },
        {
          emoji: "",
          heading: "A heuristic, not a law",
          body: "Forty isn't sacred, and the rule fits recurring-revenue software best. Use it as a quick screen and a conversation starter about the growth-versus-profitability balance — then dig into durability, unit economics, and what the margin would be at maturity.",
        },
      ],
      keyTerms: [
        { term: "Rule of 40", definition: "The heuristic that growth rate + profit margin should be ≥ 40 for a healthy software firm." },
        { term: "FCF margin", definition: "Free cash flow as a percentage of revenue; the profitability input to the rule." },
        { term: "Growth-profitability trade-off", definition: "The choice to spend for growth or harvest profit — the rule balances the two." },
        { term: "Durable growth", definition: "Revenue growth likely to persist, which makes a high score more meaningful." },
      ],
      realWorldExample: {
        scenario:
          "A SaaS company growing 50% while burning a 10% margin scores 40 and passes; a peer growing 15% at a 5% margin scores 20 and fails. The market rewarded the first and punished the second as growth expectations reset.",
        ticker: "CRM",
        lesson: "The Rule of 40 captures whether the growth-versus-profit balance is healthy. Failing it — slow and unprofitable — is the profile most exposed to a de-rating.",
      },
      quiz: [
        {
          question: "The Rule of 40 says a healthy software company's growth plus margin should be:",
          options: ["≥ 10", "≥ 25", "≥ 40", "≥ 80"],
          answerIndex: 2,
          explanation: "Growth rate plus profit margin summing to 40 or more is the heuristic bar.",
        },
        {
          question: "A company can pass the Rule of 40 by:",
          options: [
            "Only by being highly profitable",
            "Growing fast even while burning cash, or growing slowly while very profitable",
            "Only by growing fast",
            "Paying a dividend",
          ],
          answerIndex: 1,
          explanation: "The rule trades growth against margin — either lever can carry the score, as long as the sum clears 40.",
        },
        {
          question: "The most concerning profile under the Rule of 40 is:",
          options: [
            "Fast growth, low margin",
            "Slow growth combined with thin or negative margin",
            "Slow growth, high margin",
            "Fast growth, high margin",
          ],
          answerIndex: 1,
          explanation: "Decelerating growth with no profitability fails the test and is most vulnerable to a valuation reset.",
        },
      ],
      tryInChat: {
        label: "Score the Rule of 40",
        prompt: "Calculate the Rule of 40 score for a software company I name and tell me what it implies about the growth-profit balance",
      },
      takeaways: [
        "Growth rate + profit margin ≥ 40 is the health bar for software businesses.",
        "Either fast growth or strong margin can carry the score — but not neither.",
        "It's a screen, not a law; pair it with durability and unit economics.",
      ],
    },
    {
      id: "fa-operating-leverage",
      title: "Operating Leverage",
      hook: "When most costs are fixed, every extra sale is almost pure profit — or pure pain.",
      difficulty: "advanced",
      subtitle: "How a company's cost structure amplifies revenue swings into much larger earnings swings.",
      figure: "operating-leverage",
      widget: {
        type: "operating_leverage",
        title: "Amplify a revenue move",
        prompt: "Set fixed and variable costs, then change revenue — watch how the same percentage move becomes a much bigger swing in profit.",
        params: { revenue: 1000, fixedCosts: 550, variableCostPct: 30, revenueChangePct: 10 },
      },
      conceptCards: [
        {
          emoji: "",
          heading: "Fixed costs are a lever",
          body: "A business with high fixed costs and low variable costs keeps almost all of each incremental sale as profit once it's past breakeven. That's operating leverage: revenue changes get amplified into much larger profit changes, up and down.",
        },
        {
          emoji: "",
          heading: "The double-edged sword",
          body: "Above breakeven, operating leverage is a tailwind — small revenue gains drive outsized earnings growth. Below it, the same fixed base becomes a millstone, turning a modest revenue dip into a steep loss. The structure cuts both ways.",
        },
        {
          emoji: "",
          heading: "Why margins expand with scale",
          body: "High operating leverage is the engine behind 'margin expansion' stories: as revenue grows against a fixed cost base, margins widen automatically. It's also why analysts watch the incremental margin — the profit kept on each new dollar of revenue.",
        },
      ],
      keyTerms: [
        { term: "Operating leverage", definition: "The degree to which fixed costs amplify revenue changes into larger profit changes." },
        { term: "Contribution margin", definition: "Revenue minus variable costs; what each sale contributes toward fixed costs and profit." },
        { term: "Breakeven point", definition: "The revenue level at which contribution exactly covers fixed costs." },
        { term: "Incremental margin", definition: "The share of each new dollar of revenue that drops through to operating profit." },
        { term: "Margin expansion", definition: "Rising margins as revenue grows against a relatively fixed cost base." },
      ],
      realWorldExample: {
        scenario:
          "A software platform with mostly fixed engineering costs saw profits balloon far faster than revenue once it cleared breakeven — each new subscription was almost pure margin. A factory with the same revenue, but heavy variable inputs, saw profits barely budge.",
        ticker: "",
        lesson: "Cost structure decides how revenue translates to earnings. High operating leverage magnifies the upside past breakeven — and the downside below it.",
      },
      quiz: [
        {
          question: "A company with high operating leverage has:",
          options: [
            "Mostly variable costs",
            "A high proportion of fixed costs, so profit swings more than revenue",
            "No costs",
            "Only debt",
          ],
          answerIndex: 1,
          explanation: "High fixed costs mean each revenue change is amplified into a larger profit change.",
        },
        {
          question: "Above breakeven, high operating leverage tends to:",
          options: [
            "Shrink margins as revenue grows",
            "Expand margins as revenue grows against a fixed cost base",
            "Have no effect on margins",
            "Reduce revenue",
          ],
          answerIndex: 1,
          explanation: "Once fixed costs are covered, incremental revenue is mostly profit, so margins widen with scale.",
        },
        {
          question: "The danger of high operating leverage is that:",
          options: [
            "Profits never change",
            "Below breakeven, a small revenue drop causes a large loss",
            "Taxes rise",
            "It eliminates risk",
          ],
          answerIndex: 1,
          explanation: "The fixed cost base that amplifies gains also amplifies losses when revenue falls below breakeven.",
        },
      ],
      tryInChat: {
        label: "Gauge the leverage",
        prompt: "Assess a company's operating leverage and what a 10% revenue change would do to its operating profit",
      },
      takeaways: [
        "Operating leverage amplifies revenue swings into larger profit swings.",
        "It's a tailwind above breakeven and a millstone below it.",
        "High fixed-cost businesses expand margins with scale — watch the incremental margin.",
      ],
    },
    {
      id: "fa-capital-allocation",
      title: "Capital Allocation",
      hook: "Over a decade, where the cash goes matters more than what the business sells.",
      difficulty: "advanced",
      subtitle: "Judging management by the returns they earn on every dollar of free cash flow they deploy.",
      figure: "capital-allocation",
      conceptCards: [
        {
          emoji: "",
          heading: "The CEO's real job",
          body: "Every dollar of free cash flow has five doors: reinvest in the business, make acquisitions, pay down debt, pay dividends, or buy back stock. Capital allocation is the discipline of sending each dollar to its highest-returning use — and it compounds for decades.",
        },
        {
          emoji: "",
          heading: "Reinvestment is the highest bar",
          body: "If the business can reinvest at high returns, that usually beats everything else — a compounder retaining cash. When it can't, returning cash via buybacks (only when the stock is cheap) or dividends is wiser than empire-building acquisitions that destroy value.",
        },
        {
          emoji: "",
          heading: "Watch what they do, not what they say",
          body: "Management's capital-allocation record — the returns earned on past acquisitions and the prices paid for buybacks — predicts future value creation far better than the narrative in the letter to shareholders. Track the decisions and their outcomes.",
        },
      ],
      keyTerms: [
        { term: "Capital allocation", definition: "How management deploys free cash flow across reinvestment, M&A, debt, dividends, and buybacks." },
        { term: "Buyback discipline", definition: "Repurchasing shares only when they trade below intrinsic value, not reflexively." },
        { term: "Empire-building", definition: "Growth-for-its-own-sake acquisitions that expand the company but destroy value." },
        { term: "Return on incremental capital", definition: "The return earned on the next dollar deployed — the test of good allocation." },
        { term: "Outsider CEO", definition: "Thorndike's term for managers who excel at disciplined, value-focused capital allocation." },
      ],
      realWorldExample: {
        scenario:
          "Two companies with similar operations diverged over a decade purely on capital allocation: one reinvested at high returns and bought back stock only when cheap, while the other overpaid for splashy acquisitions. Their per-share value gap widened year after year.",
        ticker: "AAPL",
        lesson: "The same business can compound or stagnate based on where the cash goes. Capital allocation is the quiet decision that dominates long-run returns.",
      },
      quiz: [
        {
          question: "Capital allocation refers to:",
          options: [
            "Setting employee salaries",
            "How management deploys free cash flow across reinvestment, M&A, debt, dividends, and buybacks",
            "Choosing the auditor",
            "Pricing the product",
          ],
          answerIndex: 1,
          explanation: "It's the decision of where each dollar of cash flow goes — the core driver of long-run per-share value.",
        },
        {
          question: "Buybacks create value for remaining owners only when:",
          options: [
            "They happen every quarter",
            "The stock is repurchased below intrinsic value",
            "The company is large",
            "The dividend is also cut",
          ],
          answerIndex: 1,
          explanation: "Buying back overvalued shares destroys value; disciplined buybacks happen when the stock is cheap.",
        },
        {
          question: "The best predictor of future capital-allocation skill is:",
          options: [
            "The CEO's charisma",
            "The track record of returns on past deployments and prices paid",
            "The company's logo",
            "The press coverage",
          ],
          answerIndex: 1,
          explanation: "Past decisions and their realized returns reveal allocation skill far better than the narrative.",
        },
      ],
      tryInChat: {
        label: "Grade the allocation",
        prompt: "Evaluate a company's capital allocation over the past decade — reinvestment, acquisitions, buybacks, and dividends",
      },
      takeaways: [
        "Free cash flow has five uses; sending each dollar to its best use compounds for decades.",
        "Reinvesting at high returns usually beats acquisitions; buy back stock only when it's cheap.",
        "Judge management by the realized returns on past capital decisions, not the narrative.",
      ],
    },
    {
      id: "fa-forensic-scores",
      title: "Forensic Scores: F, M & Z",
      hook: "Three quick scores that flag improving quality, manipulation, and distress.",
      difficulty: "mastery",
      subtitle: "Using the Piotroski, Beneish, and Altman scores as fast screens for earnings quality and survival.",
      figure: "forensic",
      conceptCards: [
        {
          emoji: "",
          heading: "Piotroski F-Score: is quality improving?",
          body: "The F-Score adds up nine yes/no tests across profitability, leverage, and efficiency, scoring 0–9. A high score means the fundamentals are strengthening — useful for separating genuinely improving cheap stocks from value traps.",
        },
        {
          emoji: "",
          heading: "Beneish M-Score: are the books cooked?",
          body: "The M-Score combines eight ratios that tend to shift when companies manipulate earnings — receivables growth, margin changes, accruals, and more. A score above the threshold flags a higher probability of manipulation and earns a closer look.",
        },
        {
          emoji: "",
          heading: "Altman Z-Score: will it survive?",
          body: "The Z-Score blends profitability, leverage, liquidity, and solvency into one bankruptcy-risk gauge. A low score warns of financial distress. Together these scores are fast screens — not verdicts — that point you to what to investigate.",
        },
      ],
      keyTerms: [
        { term: "Piotroski F-Score", definition: "A 0–9 score of nine fundamental signals; higher means improving quality." },
        { term: "Beneish M-Score", definition: "A formula combining eight ratios to flag likely earnings manipulation." },
        { term: "Altman Z-Score", definition: "A weighted blend of ratios estimating bankruptcy risk; low scores warn of distress." },
        { term: "Earnings manipulation", definition: "Distorting reported results through aggressive or fraudulent accounting choices." },
        { term: "Screening signal", definition: "A quick quantitative flag that directs deeper research, not a conclusion by itself." },
      ],
      realWorldExample: {
        scenario:
          "Several accounting blowups would have triggered an elevated Beneish M-Score — surging receivables, deteriorating margins, and heavy accruals — quarters before the fraud surfaced. The score didn't prove fraud, but it pointed straight at where to dig.",
        ticker: "",
        lesson: "Forensic scores are tripwires, not verdicts. They cheaply surface the names where earnings quality or solvency deserves a hard, skeptical look.",
      },
      quiz: [
        {
          question: "The Piotroski F-Score primarily measures:",
          options: [
            "Bankruptcy risk",
            "Whether a company's fundamentals are improving across nine tests",
            "Earnings manipulation",
            "The stock's momentum",
          ],
          answerIndex: 1,
          explanation: "The F-Score scores nine fundamental signals 0–9; a high score flags strengthening quality.",
        },
        {
          question: "A high Beneish M-Score suggests:",
          options: [
            "Strong cash flow",
            "An elevated probability of earnings manipulation",
            "Low leverage",
            "Imminent growth",
          ],
          answerIndex: 1,
          explanation: "The M-Score combines ratios that tend to shift when earnings are being manipulated.",
        },
        {
          question: "Forensic scores are best treated as:",
          options: [
            "Definitive proof of fraud",
            "Fast screens that direct deeper investigation",
            "Buy signals",
            "Dividend forecasts",
          ],
          answerIndex: 1,
          explanation: "They flag where to look harder; they don't replace judgment or prove anything on their own.",
        },
      ],
      tryInChat: {
        label: "Run the forensic screens",
        prompt: "Walk me through the Piotroski F-Score, Beneish M-Score, and Altman Z-Score for a company I name",
      },
      takeaways: [
        "F-Score flags improving quality; M-Score flags possible manipulation; Z-Score flags distress.",
        "They're fast screens that point you to what to investigate, not verdicts.",
        "Use them to separate improving cheap stocks from value traps and to surface accounting risk.",
      ],
    },
  ],
};
