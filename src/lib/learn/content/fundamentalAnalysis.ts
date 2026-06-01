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
  ],
};
