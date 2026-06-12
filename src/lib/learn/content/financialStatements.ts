// Track: Financial Statements — how to actually read the three documents every
// public company files. Static, hand-authored content (no model call at open).
// The first lesson (fs-three-statements) is the free preview for the whole app.

import type { RawTrack } from "../types";

export const financialStatements: RawTrack = {
  id: "financial-statements",
  name: "Financial Statements",
  tagline: "Before you value a business, you have to be able to read it.",
  emoji: "",
  accent: "var(--accent)",
  lessons: [
    {
      id: "fs-three-statements",
      title: "The Three Statements",
      hook: "Every company tells its story in three linked documents.",
      difficulty: "core",
      subtitle:
        "How the income statement, balance sheet, and cash flow statement connect into one picture of a business.",
      figure: "three-statements",
      conceptCards: [
        {
          emoji: "",
          heading: "Three views, one business",
          body: "The income statement shows profitability over a period, the balance sheet shows what the company owns and owes at a single moment, and the cash flow statement shows where cash actually moved. Each answers a different question about the same company.",
        },
        {
          emoji: "",
          heading: "They are linked, not separate",
          body: "Net income from the income statement flows into retained earnings on the balance sheet and is the first line of the cash flow statement. Change one and the others have to move — the system is built to tie out.",
        },
        {
          emoji: "",
          heading: "Why you need all three",
          body: "Profit is an accounting opinion shaped by timing rules; cash is closer to a fact; the balance sheet is the running tally of every past decision. A company can be profitable and still run out of cash, so one statement alone can mislead you.",
        },
      ],
      keyTerms: [
        { term: "Income statement", definition: "A period report (a quarter or a year) of revenue minus expenses, ending in net income." },
        { term: "Balance sheet", definition: "A snapshot at a point in time, governed by Assets = Liabilities + Shareholders' Equity." },
        { term: "Cash flow statement", definition: "A period report reconciling net income to the actual change in cash, split into operating, investing, and financing." },
        { term: "Retained earnings", definition: "Cumulative net income kept in the business rather than paid out; the bridge from the income statement to equity." },
      ],
      realWorldExample: {
        scenario:
          "For years Amazon reported thin or negative net income while its cash flow statement showed large and growing operating cash flow. The income statement alone made it look unimpressive; it was deliberately reinvesting profits into growth.",
        ticker: "AMZN",
        lesson: "Reading a single statement would have badly misled you. The three together revealed a cash machine reinvesting hard.",
      },
      quiz: [
        {
          question: "Which statement best tells you whether a company can survive a year of losses?",
          options: [
            "The income statement, because it shows profit",
            "The balance sheet, because it shows cash and obligations",
            "The cash flow statement only",
            "None — you can't tell from the filings",
          ],
          answerIndex: 1,
          explanation: "Liquidity and obligations (cash on hand, debt coming due) live on the balance sheet. Profit alone doesn't tell you whether the company can pay its bills.",
        },
        {
          question: "Net income links the income statement to the balance sheet primarily through:",
          options: ["Goodwill", "Retained earnings", "Accounts payable", "Treasury stock"],
          answerIndex: 1,
          explanation: "Net income that isn't paid out as dividends accumulates in retained earnings inside shareholders' equity.",
        },
        {
          question: "A company reports record profits but its cash balance is falling. Where do you look first?",
          options: [
            "The income statement's tax line",
            "The cash flow statement, especially operating cash flow",
            "The count of shares outstanding",
            "The dividend footnote",
          ],
          answerIndex: 1,
          explanation: "The cash flow statement reconciles profit to cash and reveals whether earnings are converting to cash or getting trapped in receivables, inventory, or capex.",
        },
      ],
      tryInChat: {
        label: "Break down a company's statements",
        prompt: "Walk me through Apple's three financial statements and how they connect",
      },
      takeaways: [
        "Income statement = profitability over time; balance sheet = position at a moment; cash flow = where cash actually moved.",
        "The three are mechanically linked — net income feeds equity and starts the cash flow statement.",
        "Profitable on paper and out of cash is a real failure mode; only all three together reveal it.",
      ],
    },
    {
      id: "fs-income-statement",
      title: "Reading the Income Statement",
      hook: "Revenue is vanity, margin is sanity, net income is reality.",
      difficulty: "core",
      subtitle: "Walking from the top line to the bottom line and learning what each layer of profit actually means.",
      figure: "income-statement",
      conceptCards: [
        {
          emoji: "",
          heading: "It's a waterfall",
          body: "Start at revenue, subtract the cost of goods sold to get gross profit, subtract operating expenses to get operating income (EBIT), then subtract interest and taxes to reach net income. Each step strips out a different kind of cost.",
        },
        {
          emoji: "",
          heading: "Operating vs non-operating",
          body: "Operating income reflects the core business. Below it sit interest (a financing choice) and taxes (a jurisdiction choice). Two identical businesses can show very different net income purely from debt loads and tax structures.",
        },
        {
          emoji: "",
          heading: "Watch what management emphasizes",
          body: "Companies love to highlight 'adjusted' figures that add back real costs like stock compensation or restructuring. Always reconcile the adjusted number back to GAAP net income and decide for yourself which add-backs are legitimate.",
        },
      ],
      keyTerms: [
        { term: "Revenue (top line)", definition: "Total sales recognized in the period, before any costs are subtracted." },
        { term: "COGS", definition: "Cost of goods sold — the direct costs of producing what was sold." },
        { term: "Operating income / EBIT", definition: "Earnings before interest and taxes; profit from core operations." },
        { term: "Net income (bottom line)", definition: "What's left after every expense, including interest and taxes — the basis for EPS." },
        { term: "EPS", definition: "Earnings per share — net income divided by shares outstanding." },
      ],
      realWorldExample: {
        scenario:
          "A software company and a grocery chain can post the same revenue, but the software firm keeps most of it as gross profit while the grocer keeps only a few cents on the dollar. Their income statements look nothing alike below the top line.",
        ticker: "MSFT",
        lesson: "Two companies with identical revenue can be completely different businesses. The margin structure, not the top line, tells you which is which.",
      },
      quiz: [
        {
          question: "Operating income (EBIT) is calculated before subtracting:",
          options: ["Cost of goods sold", "Operating expenses", "Interest and taxes", "Research and development"],
          answerIndex: 2,
          explanation: "EBIT is earnings before interest and taxes — it isolates operating performance from financing and tax decisions.",
        },
        {
          question: "Why be skeptical of 'adjusted' or non-GAAP earnings?",
          options: [
            "They are illegal to report",
            "They often add back real, recurring costs to flatter the result",
            "They always understate profit",
            "They ignore revenue",
          ],
          answerIndex: 1,
          explanation: "Adjusted figures can be useful, but management chooses the add-backs. Costs like stock comp are real; always reconcile to GAAP.",
        },
        {
          question: "Two companies have identical revenue but very different net income. The single most likely driver is:",
          options: [
            "One has a higher stock price",
            "Differences in cost structure, interest, and taxes",
            "One files quarterly and one annually",
            "Random accounting noise",
          ],
          answerIndex: 1,
          explanation: "The journey from revenue to net income is all about costs, financing, and taxes — that's where identical top lines diverge.",
        },
      ],
      tryInChat: {
        label: "Analyze an income statement",
        prompt: "Break down Microsoft's income statement from revenue to net income and tell me where the margin is",
      },
      takeaways: [
        "The income statement is a waterfall: revenue → gross profit → operating income → net income.",
        "Operating income shows the core business; interest and taxes sit below it.",
        "Reconcile every 'adjusted' number back to GAAP and judge the add-backs yourself.",
      ],
    },
    {
      id: "fs-balance-sheet",
      title: "The Balance Sheet",
      hook: "What a company owns, what it owes, and what's left for owners.",
      difficulty: "core",
      subtitle: "Reading the snapshot of a company's financial position and the one equation that must always hold.",
      figure: "balance-sheet",
      conceptCards: [
        {
          emoji: "",
          heading: "The equation that always balances",
          body: "Assets = Liabilities + Shareholders' Equity. Everything the company controls was financed either by borrowing (liabilities) or by owners (equity). Equity is the residual — what owners would have if every asset were sold and every debt repaid.",
        },
        {
          emoji: "",
          heading: "Current vs non-current",
          body: "Assets and liabilities are split by time horizon. Current means within a year (cash, receivables, payables, short-term debt); non-current is longer (property, long-term debt). The split is how you judge near-term solvency.",
        },
        {
          emoji: "",
          heading: "Leverage lives here",
          body: "The mix of debt to equity tells you how fragile the company is. Modest leverage amplifies returns; too much turns an ordinary downturn into a solvency crisis. The balance sheet is where you see whether a business can take a punch.",
        },
      ],
      keyTerms: [
        { term: "Assets", definition: "Resources the company controls that are expected to produce future economic benefit." },
        { term: "Liabilities", definition: "Obligations the company owes to others — debt, payables, deferred items." },
        { term: "Shareholders' equity", definition: "Assets minus liabilities; the owners' residual claim, including retained earnings." },
        { term: "Working capital", definition: "Current assets minus current liabilities; a quick read on short-term liquidity." },
        { term: "Goodwill", definition: "The premium paid over fair value in an acquisition; an intangible that can be written down later." },
      ],
      realWorldExample: {
        scenario:
          "Highly leveraged companies entered the 2020 shock with thin equity cushions and large current liabilities. When revenue paused, some couldn't cover near-term obligations and had to raise capital on punishing terms or restructure.",
        ticker: "DAL",
        lesson: "A balance sheet with too little equity and too much short-term debt is a business with no margin for error when conditions turn.",
      },
      quiz: [
        {
          question: "The fundamental balance sheet identity is:",
          options: [
            "Revenue − Expenses = Profit",
            "Assets = Liabilities + Shareholders' Equity",
            "Cash In − Cash Out = Net Cash",
            "Price = Earnings × Multiple",
          ],
          answerIndex: 1,
          explanation: "Every asset is financed by either a liability or owners' equity, so the two sides must always balance.",
        },
        {
          question: "Shareholders' equity is best described as:",
          options: [
            "The market value of the stock",
            "Total assets minus total liabilities (the residual claim)",
            "The company's annual profit",
            "Cash in the bank",
          ],
          answerIndex: 1,
          explanation: "Equity is what's left for owners after all liabilities — a residual, not the market cap and not the cash balance.",
        },
        {
          question: "Why does the current vs non-current split matter most?",
          options: [
            "It determines the tax rate",
            "It shows whether the company can meet obligations due within a year",
            "It sets the dividend",
            "It changes revenue recognition",
          ],
          answerIndex: 1,
          explanation: "Comparing current assets to current liabilities is the fastest read on near-term solvency.",
        },
      ],
      tryInChat: {
        label: "Read a balance sheet",
        prompt: "Analyze Delta Air Lines' balance sheet and tell me how leveraged and liquid it is",
      },
      takeaways: [
        "Assets = Liabilities + Equity, always; equity is the owners' residual.",
        "The current/non-current split is your fastest read on near-term solvency.",
        "Leverage is visible on the balance sheet — it's where you see if a business can survive a shock.",
      ],
    },
    {
      id: "fs-cash-flow",
      title: "The Cash Flow Statement",
      hook: "Profit is an opinion. Cash is a fact.",
      difficulty: "core",
      subtitle: "The statement that strips away accounting choices and shows where money actually came from and went.",
      figure: "cash-flow",
      conceptCards: [
        {
          emoji: "",
          heading: "Three buckets of cash",
          body: "Operating cash flow comes from running the business, investing cash flow from buying or selling assets (mostly capex), and financing cash flow from debt and equity (borrowing, repaying, dividends, buybacks). Together they explain the change in the cash balance.",
        },
        {
          emoji: "",
          heading: "Why it's the hardest to fake",
          body: "Accruals let management shift profit between periods, but cash is cash. Comparing operating cash flow to net income over time is one of the best lie detectors in finance — persistent gaps deserve an explanation.",
        },
        {
          emoji: "",
          heading: "Free cash flow is the prize",
          body: "Operating cash flow minus capital expenditures is free cash flow — the cash actually available to pay down debt, return to shareholders, or reinvest. Most valuation ultimately rests on FCF, not reported earnings.",
        },
      ],
      keyTerms: [
        { term: "Operating cash flow (CFO)", definition: "Cash generated by the core business after working-capital changes." },
        { term: "Capital expenditures (capex)", definition: "Cash spent on long-lived assets like property, plant, and equipment." },
        { term: "Free cash flow (FCF)", definition: "Operating cash flow minus capex — the cash truly available to owners and creditors." },
        { term: "Financing activities", definition: "Cash from issuing or repaying debt and equity, plus dividends and buybacks." },
        { term: "FCF conversion", definition: "Free cash flow divided by net income; how much reported profit becomes real cash." },
      ],
      realWorldExample: {
        scenario:
          "During its growth years Netflix reported positive net income while burning cash, because it was capitalizing huge content spending. Its cash flow statement showed deeply negative free cash flow funded by debt — a very different story than the income statement told.",
        ticker: "NFLX",
        lesson: "When net income and free cash flow diverge for years, the cash flow statement is usually telling the truer story.",
      },
      quiz: [
        {
          question: "Free cash flow is defined as:",
          options: [
            "Net income plus depreciation",
            "Operating cash flow minus capital expenditures",
            "Revenue minus operating expenses",
            "Cash minus debt",
          ],
          answerIndex: 1,
          explanation: "FCF is operating cash flow less the capex needed to sustain and grow the asset base — the cash genuinely free to deploy.",
        },
        {
          question: "Why is operating cash flow harder to manipulate than net income?",
          options: [
            "It's audited and net income isn't",
            "Accruals can shift reported profit between periods, but cash movement is concrete",
            "It excludes taxes",
            "It only includes financing",
          ],
          answerIndex: 1,
          explanation: "Net income is shaped by accrual timing choices; cash flow tracks money that actually moved, making it a useful cross-check.",
        },
        {
          question: "A company shows rising net income but flat or negative operating cash flow for several years. This most likely signals:",
          options: [
            "A bargain stock",
            "Earnings that aren't converting to cash — worth investigating",
            "A tax error",
            "Nothing; the two are unrelated",
          ],
          answerIndex: 1,
          explanation: "A persistent gap between profit and cash is a classic red flag for aggressive recognition, working-capital build, or capitalized costs.",
        },
      ],
      tryInChat: {
        label: "Trace the cash",
        prompt: "Analyze Netflix's cash flow statement and compare its free cash flow to its net income over time",
      },
      takeaways: [
        "Three buckets — operating, investing, financing — explain every change in the cash balance.",
        "Operating cash flow vs net income is one of finance's best lie detectors.",
        "Free cash flow (CFO − capex) is what most valuation actually rests on.",
      ],
    },
    {
      id: "fs-accruals",
      title: "Accruals vs Cash",
      hook: "The gap between earnings and cash is where the bodies are buried.",
      difficulty: "advanced",
      subtitle: "Why accrual accounting exists, how it can be abused, and how to spot low-quality earnings.",
      figure: "accruals",
      conceptCards: [
        {
          emoji: "",
          heading: "Accrual accounting, briefly",
          body: "Revenue is booked when earned and costs when incurred, not when cash changes hands. This matches effort to reward and usually gives a truer picture than raw cash — but it hands management real discretion over timing.",
        },
        {
          emoji: "",
          heading: "The accrual ratio",
          body: "The bigger net income is relative to operating cash flow, the more of reported profit is 'accrual' rather than cash. Academic work (Sloan) found that high-accrual firms tend to underperform — the market over-trusts non-cash earnings.",
        },
        {
          emoji: "",
          heading: "Common levers",
          body: "Channel-stuffing to pull revenue forward, stretching depreciation schedules, capitalizing costs that should be expensed, and releasing reserves all boost reported earnings without boosting cash. Each leaves a footprint in the accruals.",
        },
      ],
      keyTerms: [
        { term: "Accrual", definition: "The non-cash portion of earnings — revenue or expense recognized without matching cash movement." },
        { term: "Revenue recognition", definition: "The rules governing when a sale can be counted as revenue." },
        { term: "Capitalizing vs expensing", definition: "Recording a cost as a long-lived asset (spread over years) instead of an immediate expense." },
        { term: "Earnings quality", definition: "How well reported profit reflects sustainable, cash-backed economic reality." },
        { term: "Accrual ratio", definition: "(Net income − operating cash flow) scaled by assets; high values flag aggressive accounting." },
      ],
      realWorldExample: {
        scenario:
          "Classic accounting blowups — from Enron to a string of later restatements — shared a pattern: reported earnings marched upward while operating cash flow lagged or declined. The accrual gap was visible quarters before the collapse.",
        ticker: "",
        lesson: "You rarely need inside information to see trouble. A widening, persistent gap between earnings and cash is the public warning.",
      },
      quiz: [
        {
          question: "High accruals relative to cash flow have historically been associated with:",
          options: [
            "Higher future stock returns",
            "Lower future stock returns and reversal of earnings",
            "No effect on returns",
            "Guaranteed fraud",
          ],
          answerIndex: 1,
          explanation: "Sloan's accrual anomaly: firms whose earnings are mostly accruals rather than cash tend to underperform as the accruals reverse.",
        },
        {
          question: "Capitalizing a cost that should be expensed will, in the near term:",
          options: [
            "Lower reported earnings",
            "Raise reported earnings by moving the cost off the income statement",
            "Have no effect",
            "Raise operating cash flow only",
          ],
          answerIndex: 1,
          explanation: "Capitalizing pushes a cost onto the balance sheet to be depreciated slowly, flattering current earnings versus expensing it now.",
        },
        {
          question: "The simplest first check on earnings quality is to compare net income with:",
          options: ["Revenue", "Operating cash flow", "The share price", "Total assets"],
          answerIndex: 1,
          explanation: "If profit consistently outruns operating cash flow, much of the 'earnings' isn't backed by cash — a quality warning.",
        },
      ],
      tryInChat: {
        label: "Check earnings quality",
        prompt: "Compare a company's net income to its operating cash flow over five years and tell me if the earnings look cash-backed",
      },
      takeaways: [
        "Accrual accounting is usually truer than cash, but it hands management timing discretion.",
        "High accruals (profit far above cash flow) tend to predict weaker future returns.",
        "A widening earnings-vs-cash gap is a public, early warning sign you don't need insider info to see.",
      ],
    },
    {
      id: "fs-working-capital",
      title: "Working Capital & the Cash Cycle",
      hook: "Growth eats cash. Working capital is where it gets eaten.",
      difficulty: "advanced",
      subtitle: "How receivables, inventory, and payables tie up or release cash as a business grows.",
      figure: "working-capital",
      conceptCards: [
        {
          emoji: "",
          heading: "The cash conversion cycle",
          body: "Cash goes out to build inventory, sits in receivables until customers pay, and is partly financed by payables to suppliers. The cash conversion cycle measures, in days, how long a dollar is tied up before it returns.",
        },
        {
          emoji: "",
          heading: "Growth can be a cash trap",
          body: "A fast-growing company often has to fund ever-larger inventory and receivables before the cash comes back. Profitable growth can still drain the bank — which is exactly why some healthy-looking companies need constant financing.",
        },
        {
          emoji: "",
          heading: "Negative working capital is a superpower",
          body: "Some businesses collect from customers before paying suppliers, so growth generates cash instead of consuming it. Subscription and certain retail models run on this float — a structural advantage hiding in the balance sheet.",
        },
      ],
      keyTerms: [
        { term: "Days sales outstanding (DSO)", definition: "Average days to collect cash from customers after a sale." },
        { term: "Days inventory outstanding (DIO)", definition: "Average days inventory sits before it's sold." },
        { term: "Days payable outstanding (DPO)", definition: "Average days the company takes to pay its suppliers." },
        { term: "Cash conversion cycle", definition: "DSO + DIO − DPO; net days cash is tied up in operations." },
        { term: "Float", definition: "Money a business holds and can use before it must be paid out — effectively interest-free funding." },
      ],
      realWorldExample: {
        scenario:
          "Dell historically ran a negative cash conversion cycle: it collected from customers fast and paid suppliers slowly, so scaling the business actually freed up cash. Many capital-hungry manufacturers have the opposite, cash-draining cycle.",
        ticker: "DELL",
        lesson: "Two profitable companies can have opposite cash dynamics. The working-capital cycle decides whether growth funds itself or demands outside money.",
      },
      quiz: [
        {
          question: "The cash conversion cycle is calculated as:",
          options: ["DSO + DIO + DPO", "DSO + DIO − DPO", "DPO − DSO − DIO", "DIO − DSO + DPO"],
          answerIndex: 1,
          explanation: "You add the days cash is tied up in receivables and inventory, then subtract the days of free financing from payables.",
        },
        {
          question: "A negative cash conversion cycle means:",
          options: [
            "The company is losing money",
            "The company collects from customers before it pays suppliers, so growth generates cash",
            "The company has no inventory",
            "The company is insolvent",
          ],
          answerIndex: 1,
          explanation: "Negative CCC is a structural advantage: customers fund the business, turning growth into a source of cash rather than a use of it.",
        },
        {
          question: "Why can a profitable, fast-growing company still run short of cash?",
          options: [
            "Taxes rise with growth",
            "Growing receivables and inventory tie up cash faster than profits replenish it",
            "Depreciation increases",
            "Dividends are mandatory",
          ],
          answerIndex: 1,
          explanation: "Funding ever-larger working capital can outpace the cash that profits bring in, forcing the company to raise money despite being profitable.",
        },
      ],
      tryInChat: {
        label: "Map the cash cycle",
        prompt: "Calculate and interpret the cash conversion cycle for a retailer I name and tell me if growth funds itself",
      },
      takeaways: [
        "The cash conversion cycle (DSO + DIO − DPO) measures how long cash is trapped in operations.",
        "Profitable growth can still drain cash when working capital balloons.",
        "A negative cycle is a structural edge — customers finance the company's growth.",
      ],
    },
    {
      id: "fs-revenue-recognition",
      title: "When Is a Sale a Sale?",
      hook: "The same dollar of cash can be one quarter of revenue — or twelve.",
      difficulty: "advanced",
      subtitle: "How revenue recognition rules decide when a sale hits the income statement, and where the games are played.",
      conceptCards: [
        {
          emoji: "",
          heading: "Earned, not collected",
          body: "Under accrual rules (ASC 606), revenue is recognized when the company delivers the goods or service the customer paid for — not when cash arrives. A year of software prepaid up front is recognized one month at a time as the service is delivered.",
        },
        {
          emoji: "",
          heading: "Deferred revenue is a promise, not profit",
          body: "Cash collected before delivery sits on the balance sheet as deferred revenue — a liability, because the company still owes the service. A growing deferred-revenue balance is often a bullish sign of demand booked but not yet recognized.",
        },
        {
          emoji: "",
          heading: "Where the games live",
          body: "Pulling revenue forward (channel-stuffing, aggressive percentage-of-completion, bundling tricks) inflates the current period at the expense of the future. The footnotes on revenue policy are where you check whether the timing is honest.",
        },
      ],
      keyTerms: [
        { term: "Revenue recognition (ASC 606)", definition: "The standard governing when and how much revenue a company may record as it satisfies its obligations." },
        { term: "Deferred revenue", definition: "Cash received before the service is delivered; a liability until earned." },
        { term: "Bookings vs revenue", definition: "Bookings are contracts signed; revenue is the portion delivered and recognized." },
        { term: "Performance obligation", definition: "A distinct promise in a contract that triggers revenue as it's satisfied." },
        { term: "Channel stuffing", definition: "Pushing excess product to distributors to book revenue early." },
      ],
      realWorldExample: {
        scenario:
          "A subscription company collects a full year of cash upfront but can only recognize it month by month. Its deferred-revenue balance swells with growth — a signal of demand that the income statement alone, recognizing slowly, understates.",
        ticker: "ADBE",
        lesson: "Cash timing and revenue timing are different things. Deferred revenue and bookings often tell you more about momentum than the recognized top line.",
      },
      quiz: [
        {
          question: "Under accrual accounting, revenue is recognized when:",
          options: [
            "Cash is received",
            "The good or service is delivered to the customer",
            "The contract is signed",
            "The quarter ends",
          ],
          answerIndex: 1,
          explanation: "Revenue follows delivery of the performance obligation, not the movement of cash — that's the core of ASC 606.",
        },
        {
          question: "A large and growing deferred-revenue balance usually signals:",
          options: [
            "Imminent bankruptcy",
            "Cash collected upfront for services not yet delivered — often a demand positive",
            "An accounting error",
            "Falling sales",
          ],
          answerIndex: 1,
          explanation: "Deferred revenue is prepaid demand sitting as a liability until earned; rising balances often reflect strong booked growth.",
        },
        {
          question: "Channel stuffing inflates current results by:",
          options: [
            "Delaying revenue",
            "Pushing extra product to distributors to pull revenue forward",
            "Cutting prices",
            "Raising deferred revenue",
          ],
          answerIndex: 1,
          explanation: "Forcing product into the channel books revenue early, borrowing from future periods and often reversing later.",
        },
      ],
      tryInChat: {
        label: "Check the revenue policy",
        prompt: "Explain how a subscription company I name recognizes revenue and what its deferred revenue balance implies",
      },
      takeaways: [
        "Revenue is recognized on delivery, not on cash collection.",
        "Deferred revenue is a liability — prepaid demand, not profit yet.",
        "Watch the recognition footnotes for revenue pulled forward.",
      ],
    },
    {
      id: "fs-stock-comp",
      title: "Stock-Based Comp & Dilution",
      hook: "“Adjusted” earnings add it back. Your ownership doesn't.",
      difficulty: "advanced",
      subtitle: "Why stock-based compensation is a real expense paid in shares, and how dilution quietly shrinks your claim.",
      figure: "stock-comp",
      widget: {
        type: "dilution",
        title: "Watch your slice shrink",
        prompt: "Set an annual share-count growth and a holding period, and see how much of your ownership stock comp quietly transfers away.",
        params: { annualDilutionPct: 4, years: 10, startStakePct: 1 },
      },
      conceptCards: [
        {
          emoji: "",
          heading: "It's compensation, not a non-cash freebie",
          body: "Stock-based comp (SBC) pays employees in equity instead of cash. Companies love to exclude it from 'adjusted' earnings because it doesn't touch cash — but it's a genuine cost, settled in the one currency that belongs to you: ownership.",
        },
        {
          emoji: "",
          heading: "Dilution is the real bill",
          body: "Every share granted is a slightly smaller slice of the same profits for existing owners. Persistent high SBC steadily raises the share count, so per-share value has to climb just to offset it. Watch diluted shares outstanding over time.",
        },
        {
          emoji: "",
          heading: "Buybacks that just mop up SBC",
          body: "Many companies buy back stock and tout it as 'returning capital' — when in reality the buybacks barely offset the dilution from SBC. Net share count, not gross buyback dollars, tells you whether owners are actually getting more of the company.",
        },
      ],
      keyTerms: [
        { term: "Stock-based compensation (SBC)", definition: "Employee pay issued as shares or options rather than cash." },
        { term: "Dilution", definition: "The reduction in existing owners' percentage stake as new shares are issued." },
        { term: "Diluted shares outstanding", definition: "Share count including options and convertibles that could become shares." },
        { term: "Net buyback", definition: "Shares repurchased minus shares issued (often via SBC) — the true change in count." },
        { term: "Non-GAAP adjustment", definition: "A company-chosen exclusion (like SBC) from reported earnings; treat with skepticism." },
      ],
      realWorldExample: {
        scenario:
          "Several high-growth tech firms reported strong 'adjusted' profits while their share counts crept up several percent a year from heavy stock comp. Owners who ignored the dilution overstated how much of the growing business they actually held.",
        ticker: "",
        lesson: "Add SBC back and you flatter the earnings; you don't undo the dilution. Track net share count to see what you really own.",
      },
      quiz: [
        {
          question: "Why is excluding stock-based comp from 'adjusted' earnings misleading?",
          options: [
            "SBC is illegal",
            "It's a real cost of compensation, just paid in dilutive shares rather than cash",
            "It lowers revenue",
            "It only affects taxes",
          ],
          answerIndex: 1,
          explanation: "SBC compensates employees with equity — a genuine economic cost to owners, even though no cash leaves the business.",
        },
        {
          question: "The truest measure of whether buybacks benefit owners is:",
          options: [
            "Gross dollars spent on buybacks",
            "The change in net (diluted) shares outstanding over time",
            "The dividend yield",
            "The stock price",
          ],
          answerIndex: 1,
          explanation: "If buybacks only offset SBC, the share count is flat and owners gain nothing — net count reveals it.",
        },
        {
          question: "Heavy, persistent stock-based comp tends to:",
          options: [
            "Reduce the share count",
            "Raise the share count, diluting each existing owner's claim",
            "Have no effect on ownership",
            "Increase cash flow",
          ],
          answerIndex: 1,
          explanation: "Granting shares year after year steadily increases the count, shrinking each holder's slice of the profits.",
        },
      ],
      tryInChat: {
        label: "Measure the dilution",
        prompt: "Show me a company's stock-based comp and how its diluted share count has changed over five years",
      },
      takeaways: [
        "SBC is a real expense paid in ownership; adding it back flatters earnings without undoing dilution.",
        "Track net (diluted) shares outstanding to see what you actually own.",
        "Judge buybacks by the change in share count, not the headline dollars.",
      ],
    },
    {
      id: "fs-leases-obligations",
      title: "Leases & Hidden Obligations",
      hook: "“We just rent it” used to keep billions of debt off the books.",
      difficulty: "advanced",
      subtitle: "Why committed future payments are leverage, and how off-balance-sheet items distort the picture.",
      figure: "leases",
      conceptCards: [
        {
          emoji: "",
          heading: "A lease is debt by another name",
          body: "A long-term lease is a stream of mandatory payments — economically the same as borrowing to buy the asset. Pre-2019 rules let companies keep operating leases off the balance sheet, making leverage look far lower than it really was.",
        },
        {
          emoji: "",
          heading: "What ASC 842 changed",
          body: "Modern rules put a right-of-use asset and a matching lease liability on the balance sheet, so most lease obligations are now visible. But you still have to read the maturity schedule in the footnotes to see the true size and timing of the commitments.",
        },
        {
          emoji: "",
          heading: "Hunt the other commitments",
          body: "Leases aren't the only off-balance-sheet exposure. Purchase commitments, pension shortfalls, guarantees, and contingent liabilities all sit in the footnotes. A balance sheet that looks clean can hide large fixed obligations a page later.",
        },
      ],
      keyTerms: [
        { term: "Operating lease", definition: "A rental of an asset; now largely capitalized onto the balance sheet under ASC 842." },
        { term: "Right-of-use asset / lease liability", definition: "The asset and matching obligation recorded for a capitalized lease." },
        { term: "Off-balance-sheet", definition: "Obligations not shown as debt on the balance sheet but disclosed in footnotes." },
        { term: "Contingent liability", definition: "A potential obligation that depends on a future event, like litigation." },
        { term: "Commitment schedule", definition: "The footnote table of future required payments by year." },
      ],
      realWorldExample: {
        scenario:
          "Retailers and airlines with vast leased footprints once reported modest balance-sheet debt while owing billions in future lease payments. Capitalizing those leases revealed leverage far higher than the headline debt figure suggested.",
        ticker: "",
        lesson: "Add capitalized leases and other committed payments to debt before judging leverage. The footnotes, not the balance sheet alone, hold the real obligations.",
      },
      quiz: [
        {
          question: "Economically, a long-term operating lease is most like:",
          options: [
            "Equity",
            "Debt — a stream of mandatory future payments",
            "Revenue",
            "A dividend",
          ],
          answerIndex: 1,
          explanation: "Committed lease payments behave like debt service, which is why modern rules bring them onto the balance sheet.",
        },
        {
          question: "ASC 842 improved transparency by:",
          options: [
            "Eliminating leases",
            "Recording a right-of-use asset and lease liability on the balance sheet",
            "Hiding leases in revenue",
            "Banning operating leases",
          ],
          answerIndex: 1,
          explanation: "It capitalizes most leases, making the previously off-balance-sheet obligation visible.",
        },
        {
          question: "Beyond leases, where do other fixed obligations usually hide?",
          options: [
            "The income statement headline",
            "The footnotes — purchase commitments, pensions, guarantees, contingencies",
            "The dividend announcement",
            "The press release",
          ],
          answerIndex: 1,
          explanation: "Off-balance-sheet commitments are disclosed in the footnotes, not the face of the statements.",
        },
      ],
      tryInChat: {
        label: "Capitalize the leases",
        prompt: "Adjust a company's leverage for capitalized leases and any large off-balance-sheet commitments in the footnotes",
      },
      takeaways: [
        "A long-term lease is economically debt — committed future payments.",
        "ASC 842 capitalizes most leases, but the footnote schedule shows the true size.",
        "Read the footnotes for pensions, guarantees, and other hidden obligations.",
      ],
    },
    {
      id: "fs-goodwill-intangibles",
      title: "Goodwill & Intangibles",
      hook: "The price paid over book value has to live somewhere on the balance sheet.",
      difficulty: "advanced",
      subtitle: "What goodwill really represents, why impairments matter, and how intangible-heavy balance sheets mislead.",
      figure: "goodwill",
      conceptCards: [
        {
          emoji: "",
          heading: "Goodwill is the acquisition premium",
          body: "When a company buys another for more than the fair value of its net assets, the excess is recorded as goodwill. It's not a productive asset — it's a record of how much was paid above tangible worth, and big goodwill balances mean an acquisitive history.",
        },
        {
          emoji: "",
          heading: "Impairments tell on bad deals",
          body: "If an acquisition underperforms, accounting rules force a goodwill write-down — a non-cash charge that admits the company overpaid. A history of large impairments is a track record of value-destroying M&A, even if each was 'one-time.'",
        },
        {
          emoji: "",
          heading: "Tangible book vs reported equity",
          body: "Equity stuffed with goodwill and intangibles can overstate the real, sellable asset base. Subtracting them gives tangible book value — a more conservative floor, especially for banks and serial acquirers.",
        },
      ],
      keyTerms: [
        { term: "Goodwill", definition: "The premium paid in an acquisition over the fair value of net identifiable assets." },
        { term: "Intangible assets", definition: "Non-physical assets like patents, brands, and customer lists, often from acquisitions." },
        { term: "Impairment", definition: "A write-down when an asset's carrying value exceeds its recoverable value." },
        { term: "Tangible book value", definition: "Equity minus goodwill and intangibles — the hard asset base." },
        { term: "Purchase price allocation", definition: "How an acquisition's cost is split across assets, intangibles, and goodwill." },
      ],
      realWorldExample: {
        scenario:
          "A serial acquirer booked huge goodwill from a string of pricey deals, then took multibillion-dollar impairments when those businesses disappointed. Each write-down was labeled non-recurring, yet together they revealed a pattern of overpaying.",
        ticker: "",
        lesson: "Goodwill is a ledger of prices paid. Recurring impairments are a confession of bad capital allocation — read them as a pattern, not a series of one-offs.",
      },
      quiz: [
        {
          question: "Goodwill on the balance sheet represents:",
          options: [
            "Cash reserves",
            "The premium paid in acquisitions over the fair value of net assets",
            "Retained earnings",
            "Future revenue",
          ],
          answerIndex: 1,
          explanation: "Goodwill captures what an acquirer paid above the identifiable net assets of the businesses it bought.",
        },
        {
          question: "A goodwill impairment is essentially:",
          options: [
            "A cash dividend",
            "A non-cash admission that an acquisition was overvalued",
            "A revenue increase",
            "A tax credit",
          ],
          answerIndex: 1,
          explanation: "Impairment writes the carrying value down to reality, signaling the deal underperformed expectations.",
        },
        {
          question: "Tangible book value is calculated by:",
          options: [
            "Adding goodwill to equity",
            "Subtracting goodwill and intangibles from equity",
            "Multiplying equity by the P/E",
            "Ignoring liabilities",
          ],
          answerIndex: 1,
          explanation: "Stripping out goodwill and intangibles leaves the hard, sellable asset base — a more conservative measure.",
        },
      ],
      tryInChat: {
        label: "Inspect the goodwill",
        prompt: "Tell me how much of a company's equity is goodwill and intangibles, and whether it has a history of impairments",
      },
      takeaways: [
        "Goodwill records the premium paid over net assets in acquisitions.",
        "Impairments are non-cash confessions that a deal was overpriced — watch for patterns.",
        "Tangible book value strips out goodwill and intangibles for a harder floor.",
      ],
    },
    {
      id: "fs-segments-footnotes",
      title: "Segments & the Footnotes",
      hook: "The most important numbers are rarely on the front page.",
      difficulty: "advanced",
      subtitle: "Why blended results hide the real story and how segment data and footnotes reveal it.",
      figure: "segment",
      conceptCards: [
        {
          emoji: "",
          heading: "Blended numbers lie by omission",
          body: "A single company can house a high-margin cash machine and a money-losing experiment. The consolidated income statement averages them into one bland figure. Segment reporting breaks revenue and profit out by business so you can see which part actually works.",
        },
        {
          emoji: "",
          heading: "Follow the segment margins",
          body: "Find which segment earns the profit and which consumes it. A great business subsidizing a weak one is both a risk (the drag) and an opportunity (the hidden gem the market may be ignoring inside a mediocre blended multiple).",
        },
        {
          emoji: "",
          heading: "The footnotes are the real disclosure",
          body: "Revenue policy, debt maturities, segment detail, related-party deals, customer concentration, and stock comp all live in the footnotes and MD&A — not the headline statements. Skipping them is reading the cover and skipping the book.",
        },
      ],
      keyTerms: [
        { term: "Segment reporting", definition: "Disclosure of revenue and profit broken out by business line or geography." },
        { term: "MD&A", definition: "Management's Discussion and Analysis — narrative context on results and risks." },
        { term: "Customer concentration", definition: "Reliance on a few customers for much of revenue; a footnote-disclosed risk." },
        { term: "Related-party transaction", definition: "A deal with insiders or affiliated entities, disclosed for conflict-of-interest reasons." },
        { term: "Geographic mix", definition: "The split of revenue across regions, affecting currency and growth exposure." },
      ],
      realWorldExample: {
        scenario:
          "A conglomerate trading at an unremarkable blended multiple turned out to contain a fast-growing, high-margin segment hidden inside slower legacy businesses. Investors who read the segment footnotes saw the gem the headline numbers buried.",
        ticker: "AMZN",
        lesson: "Consolidated results average away the truth. Segment data and footnotes are where mispricings and risks are most often found.",
      },
      quiz: [
        {
          question: "Why can a company's consolidated income statement mislead?",
          options: [
            "It's audited",
            "It blends very different businesses into one average that hides the real drivers",
            "It excludes revenue",
            "It's always wrong",
          ],
          answerIndex: 1,
          explanation: "Averaging a great business with a weak one obscures which segment creates or destroys value.",
        },
        {
          question: "Segment reporting is most useful for:",
          options: [
            "Computing the dividend",
            "Seeing which business line earns the profit and which consumes it",
            "Finding the share price",
            "Ignoring geography",
          ],
          answerIndex: 1,
          explanation: "Breaking out revenue and margin by segment reveals the true profit engine and any hidden drags or gems.",
        },
        {
          question: "Key disclosures like customer concentration and debt maturities are usually found in:",
          options: [
            "The press release",
            "The footnotes and MD&A",
            "The income statement headline",
            "The ticker symbol",
          ],
          answerIndex: 1,
          explanation: "The most decision-relevant detail lives in the footnotes and management's discussion, not the face of the statements.",
        },
      ],
      tryInChat: {
        label: "Break out the segments",
        prompt: "Break down a company's results by segment and tell me which business actually drives the profit",
      },
      takeaways: [
        "Consolidated results average away the real story; segments reveal it.",
        "Find which segment earns the money and which one drags — gems and risks both hide there.",
        "The footnotes and MD&A hold the disclosures that matter most.",
      ],
    },
  ],
};
