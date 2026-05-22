# Third Time's The Charm — Ruthless Autopsy + Build Plan
**For: Vansh. From: your accelerator coach. Date: 2026-05-12.**

This document is long on purpose. You said you'd read it. I'm taking you at your word.

I'm going to tell you why both attempts died with line-level evidence from your own code, then I'm going to tell you what to build, what to delete, and how to ship it without a third collapse. I'll push back on three of your ideas hard. You can still overrule me. But you'll do it knowing the trade.

---

## 0. Before anything else: stop, rotate keys

Your `.env.local` in both Alvara and Prism contains a live Anthropic key, a live FMP key, a live FRED key, a live Alpha Vantage key, a live Fiscal.ai key, and a Supabase anon key. You handed me the folder, which means anyone you ever share these folders with sees those keys. Worse, both folders are git repositories.

Do this in the next twenty minutes:

1. Anthropic Console → API Keys → revoke `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`. Generate a new one.
2. Same for FMP, FRED, Alpha Vantage, Fiscal.ai dashboards.
3. In both `Alvara` and `Prism`, run `git log --all -p -- .env.local`. If anything shows up, your old keys are in your repo history and will be scraped within hours of a public push. Even if you never pushed, treat them as burned.
4. Add `.env.local` to `.gitignore` (you have it, confirm it's there) and never put secrets in a file with `NEXT_PUBLIC_` prefix. `NEXT_PUBLIC_` means "bundled into the browser, anyone with devtools sees it."
5. From now on, secrets live in Vercel environment variables, not in your repo. Local dev uses `.env.local` which `git` never touches.

That's not optional. Move on once it's done.

---

## 1. Autopsy: what actually killed Prism and Alvara

You blamed memory, animations, free APIs, vague prompts, and your laptop. Some of those are real. Most are downstream of three structural mistakes. Here they are with the evidence pulled from your own files.

### 1.1 The 3D scene is a CPU bomb

Open `Prism/src/components/3d/SpiralScene.tsx`. You're rendering three particle clouds: 30,000 + 10,000 + 5,000 = **45,000 particles**, plus 8,000 stars from `<Stars>`. That's 53,000 GPU-tracked points. Fine in isolation.

The problem is the `useFrame` loop on lines 58 to 81. Every single frame (60 times per second on a good machine), you're iterating in JavaScript across all 45,000 particles, doing a sine and cosine per particle, recomputing positions, and pushing a new Float32Array to the GPU. That's ~2.7 million trig operations per second on the main thread, plus the cost of marking `position.needsUpdate = true` which forces the entire buffer to re-upload to GPU memory every frame.

This is the wrong way to animate particles. The right way is a custom shader where the GPU does the trig in parallel for all 45,000 particles in roughly one frame's worth of GPU time, and the JavaScript main thread just passes a time uniform. You used the standard r3f `<points>` + `<pointsMaterial>` pattern which forces CPU-driven animation.

Layer on top of this:

- `LogoAssembler.tsx`: 150 instanced shards with their own `useFrame` loop.
- `FloatingPanels.tsx`: more components doing per-frame work.
- `PostProcessing.tsx`: bloom and chromatic aberration, which are GPU-cheap but render-pass heavy when stacked.
- `Stars` with 8,000 points and `fade speed={1}`: r3f stars are also CPU-cheap individually but pile onto draw calls.
- A `<Canvas>` that is `fixed inset-0` and lives in the **root layout**, meaning it never unmounts, even on route changes.

Then `layout.tsx` adds: `CustomCursor`, `RouteProgress`, `Navigation`, `SmoothScroll` (Lenis), `cinematic-grain` overlay, plus four Google Fonts loaded with `display: swap`.

The composite effect: when you launch dev, Next.js compiles 60+ files for the first request while the 3D scene is mounting. The scene tries to start its 45,000-particle loop on a thread that's already being hammered by the TypeScript compile. Your browser tab freezes. You think "the website never loaded" — what actually happened is the first render-and-hydrate cycle never completed in a usable time. Your friend's similar laptop with a "crazy animated website" almost certainly isn't doing 45k CPU-animated particles. He's using a shader.

**Fix path:** rewrite the spiral as a GLSL shader (or use `@react-three/postprocessing` + a custom shader material), drop particle count to 6,000-12,000 for the visible band, and crucially, **make the scene a per-page component, not a layout-wide background.** Only the landing page should render the heavy 3D. The dashboard should render zero 3D and load instantly.

### 1.2 The data layer is built on free tiers that can't survive 50 users

`fmp.ts` calls Financial Modeling Prep. FMP free tier is 250 calls per day, total. Look at what one stock page costs: `quote` + `profile` + `key-metrics` + `income-statement` + `balance-sheet` + `cash-flow` + `earnings` + `historical-price-eod` + `news` + `insider-trades`. That's roughly 10 calls per stock page load.

Twenty-five stock loads exhausts your quota for the day. Twenty-five. You wanted 1,000 users a day. The math doesn't work.

Worse, your code knows this and silently falls back to a "synthetic recovery mode." Look at `data-pipeline.ts` line 73 (`syntheticMode`) and `orchestrator.ts` line 133. When real data can't be fetched, the system asks Claude to generate a fake financial profile and a fake judge opinion **from its training knowledge**. That output then flows through your UI as if it were real analysis.

Two consequences. First, when you tested and "it sort of worked for Mag 7 stocks" — those are the ones Claude's training data covers well enough to confabulate plausibly. Tiny caps fail because Claude doesn't know them well. Second, **you were shipping an institutional research tool that hallucinates financial data when rate-limited and doesn't warn the user clearly enough.** If you launch this and someone trades on it, you are exposed.

The `NEXT_PUBLIC_USE_MOCK_DATA=true` flag in your `.env.local` is even worse. `NEXT_PUBLIC_` variables are sent to the browser. You currently have a production-shipped flag that says "use fake data." This is one bug away from your entire homepage proudly serving mock TSLA data to users.

**Fix path:** I'll detail it in section 8, but the short version is: don't fetch per-user. Fetch once a day, batch, cache to Supabase, and serve from cache. The only live thing is the AI report generation, which you trigger on-demand for the specific ticker the user asked about, and which costs you maybe $0.02 per request on Claude Haiku.

### 1.3 Vibe-coding without instrumentation

You told me you can't really debug. That's the most important fact in this entire conversation, and the architecture has to be designed around it.

When something breaks in your current setup, you have no idea where. There's no Sentry, no Logflare, no structured logging anywhere except `console.error` lines in your agents. The agent orchestrator uses `Promise.all` with `.catch(() => null)` patterns that swallow errors silently. Look at `orchestrator.ts` lines 169-186: if fundamentals errors, the trace just doesn't include it. The UI sees "fundamentals: null." You see a half-finished report and have no idea why.

A debugger-fluent dev would attach to the process or wire structured logs. You can't. So your build collapses when the silent failures pile up and you don't know which prompt to give Claude Code to fix them.

**Fix path:** wire Sentry (free tier) on day one. Use Vercel's built-in log explorer. Every API route should `try/catch/log to Sentry/return a structured error code`. The frontend should display the error code prominently when the UI fails to load data. This way, when you hit a problem, you copy the Sentry error into your AI prompt and the AI has actual context.

### 1.4 The two codebases are the same project

Alvara and Prism are 95% identical. Same package.json (literally one is named "alvaro," the other "prism," but both are the same app). Same routes. Same agents. Same lib. Prism added 3D and Lenis smooth scroll. That's the only meaningful delta.

You don't have two failures. You have one project that's been incrementally restarted twice on top of mostly the same scaffolding. That's actually good news, because most of the data pipeline and agent code is salvageable.

What you should do: pick **Alvara** as the canonical name and codebase, delete Prism, and **port only the 3D directory** (`Prism/src/components/3d/`) over after the rewrites in section 7. The rest of Prism is duplicated work.

### 1.5 Summary of what really killed it

The website "never loaded" because the 3D scene blocked the main thread while Next.js was compiling and your free APIs were either rate-limited or returning fake data through a silent fallback path you didn't fully understand. The animation "interfered with the features" because the canvas lives in the root layout and applies a `mix-blend` / `backdrop-blur` chain that fights with your `glass-panel` divs. Your vague prompts didn't help, but they're not the root cause. The architecture was set up to fail. AI just executed your direction without the structural pushback you needed.

That's what you're paying me for now.

---

## 2. The vision problem — what you're actually building

You currently describe this as "AI Wall Street analysts" + "Yahoo Finance with insider trades" + "five Claude agents pick stocks" + "30-second intro animation" + "real problem nobody else is solving" + "monopoly-grade product." That's five different products in one sentence. You're not building a startup. You're building a mood board.

Here's what your target user (active retail, finance students, junior pros) actually does today. They open Koyfin or Stock Unlock for fundamentals. They open Finviz for screening. They open Seeking Alpha or X (FinTwit) for sentiment and theses. They open the company's 10-K on EDGAR for the deep read. They open Bloomberg or Tegus if they're at a fund. They paste things into ChatGPT or Claude and ask "is this thesis dumb." They keep a Notion or a spreadsheet of positions. They watch CNBC's morning show as background noise.

That's the workflow. The pain in that workflow is **fragmentation and the cost of forming a defensible thesis fast**. Not "I wish I had a 30-second animation before my dashboard." Not "I wish AI picked stocks for me," because every Robinhood user has been pitched that since 2019 and they don't trust it.

The wedge — the one thing you ship that gets you talked about — should sit on a real pain point. Let me give you three candidates ranked by realistic willingness-to-pay among your target user.

### 2.1 Candidate wedge A: "Bear-case-first" research reports

**The problem:** every research report on the internet starts with the bull case. Sell-side analysts are structurally biased to "Buy" ratings. Seeking Alpha is dominated by retail bulls promoting their bags. ChatGPT will give you a balanced view but it's not formatted as a thesis. The thing your user actually needs is a brutal bear case in the same five minutes it takes them to read the bull case.

**The product:** the user types a ticker. They get back a structured document with the bear case at the top. It includes: the three numbers most likely to disappoint next quarter, the three competitive threats most likely to compress margins, three short-thesis quotes from real bears (pulled from FinTwit + Seeking Alpha bear articles), three historical pattern-matches (companies that looked like this and went down). Then below the fold, the bull case for balance. Then a "what would change my mind in either direction" section.

**Why it works:** it's a genuinely new format. It's defensible because the LLM is doing structured analytical work, not just summarization. It generates content that is **shareable on FinTwit**, where your target users live. Every bear report you publish becomes a tweet thread.

**Cost:** one Claude Sonnet call per ticker per day, cached. Roughly $0.05 per stock. You can pre-generate it nightly for the S&P 500 + Nasdaq 100 + the top 200 most-watched names, and you serve from cache. That's ~$25-30/day of Claude spend amortized across all your users.

### 2.2 Candidate wedge B: "What's actually new in this 10-Q"

**The problem:** earnings season is hell. Every quarter, your user reads twenty 10-Q filings. Each one is 80 pages, 90% boilerplate, 10% interesting. Nobody has time. The bull case is hidden in MD&A. The bear case is buried in risk factor changes year-over-year. Even pros use ctrl-F and skim.

**The product:** when a company files a 10-Q (free, EDGAR's RSS feed gives you this within minutes), you diff it against the prior 10-Q and prior year 10-Q. You surface: changed risk factors, changed accounting policies, language in MD&A that softened or hardened, segments where revenue growth decelerated, new lawsuits, new debt, changes to share count and stock-based compensation. You output a 600-word "what changed and what it means" memo, plus a deltas table.

**Why it works:** SEC filings are free, EDGAR is reliable, and **nobody is doing the year-over-year language diff well**. Tegus and AlphaSense do something like it for $20k/year. You can do a stripped-down version for $0 in data cost. The LLM is doing real analytical work that has obvious value.

**Cost:** Claude Sonnet for the diff and synthesis, run once per filing per company. Maybe 30-100 filings per day during earnings season, each costing $0.10-0.30. So $3-30/day in peak weeks. Very cheap.

### 2.3 Candidate wedge C: "The five-agent disagreement signal"

**The problem:** when AI agents agree, it's noise. When they disagree, it's information. Single-LLM analysis tells you what the average internet vibe is. Multi-agent analysis with structured disagreement tracking tells you where the consensus is brittle.

**The product:** the five-agent system you already built, but the **headline output is not the recommendation, it's the disagreement.** You market it as: "Stock pickers tell you what to buy. Alvara tells you what no one agrees on." The user sees a "consensus score" of 0-100. Stocks where all five agents converge on STRONG_BUY have score 100. Stocks where fundamentals say BUY, technicals say SELL, macro says HOLD, sentiment says BUY, and judge says HOLD have score ~30. Low scores are the most interesting ideas.

**Why it works:** it's the only honest framing of what LLMs are actually good for in finance — they're decent at structured analysis, terrible at price prediction. By reframing the output from "what to buy" to "where consensus is fragile," you sidestep the prediction-accuracy problem while still surfacing useful information.

**Cost:** five Haiku calls + one Sonnet judge call per ticker. ~$0.03-0.05 per stock. Pre-generate nightly for ~500 names: ~$15-25/day.

### 2.4 My recommendation: combine A + C, then layer B in month two

Start with wedge A (bear-case-first reports) as the daily-active hook plus wedge C (disagreement signal) as the differentiator that makes the homepage interesting. Both run on the same agent infrastructure you already built. Both produce daily content. Both are tweetable.

Skip B for now. EDGAR parsing is finicky, and you'd be wrestling with XBRL and PDF extraction at the same time as you're trying to build a polished product. Add it in month two when you have users and feedback.

The killer Alpha Tracker idea — the five agents picking stocks publicly — survives, but in a different form. See section 4.

### 2.5 The naming

`Alvara` and `Alvaro` are confusing. You're using two spellings across your two codebases. The metadata.title in the layout says "Alvaro — AI Investment Intelligence." Your folder is `Alvara`. Pick one.

`Alvara` is better. It sounds like a word, doesn't have an existing famous association (Álvaro Morata, the footballer), and the `.com` is probably gettable for cheap. Check it. If `alvara.com` is taken, try `alvara.ai` (~$80/yr), `alvara.co`, or `alvara.so`. Don't pick a name with three-letter TLDs as your primary domain if you want investors to take you seriously, but for a launch it's fine.

**Decision: ship as Alvara. Lock the spelling everywhere. Buy the domain this week.**

---

## 3. The wedge feature, spec'd out

This is what page one of your dashboard looks like, after they click the "View Dashboard" button (which we'll get to in section 6).

### 3.1 The main view: "Today's Disagreement Board"

A grid of stock cards. Each card shows: ticker, current price, sparkline, **consensus score (0-100, where lower = more disagreement)**, the one-line bear thesis headline, and a small badge for which agent dissented hardest.

Sort by consensus score ascending. The top of the board is the most interesting stocks: the ones where your AI panel is fighting. The bottom is the boring consensus. This is the first thing the user sees. It's a fundamentally new view nobody else has.

You curate the universe daily: the S&P 500 + Nasdaq 100 + a "watchlist of the day" of 30 stocks based on volume, news flow, or earnings dates. Roughly 500-700 stocks total. Pre-generated overnight. Cached. Free to serve.

### 3.2 The detail view: stock page

Click a ticker, get the deep view. Tabs:

**Bear case** (default, first tab — this is the wedge). 600-word brutal short thesis. Three numbers to watch. Three competitive risks. Pulled FinTwit bear quotes (citation linked). Historical pattern matches.

**Bull case.** Standard bull thesis. Cheap to generate. Mostly there for completeness.

**The Agent Panel.** Shows what each of the five agents concluded with their reasoning. Highlight disagreements. This is what makes the brand. People will screenshot this.

**Financials.** Use FMP data. Just five years of revenue, EPS, margins, FCF, debt, share count. Six charts. Don't try to be Koyfin. Be focused.

**News + insider.** Last 30 days of news, color-coded by sentiment (your `sentiment` agent already does this). Insider trades table with the unusual ones (>$1M, cluster buys) flagged.

**The Diff** (later). Year-over-year 10-Q language diff. Push to month two.

### 3.3 Other top-nav routes

- **Alpha Tracker.** Live public track record of the AI picks (more on this in section 4).
- **Methodology.** This is your moat-builder. A page that says exactly how each agent works, what data it sees, what its known biases are, what it's bad at. Most stock-picking products hide this. Yours flexes it. Builds trust.
- **Methodology / Performance.** Honest stats. Hit rate, average return, max drawdown, time horizon. Even if early performance is bad, **publishing it makes you credible**. People trust transparent losers more than opaque winners.

That's the entire product. Five tabs on a stock page, three top-level pages, one homepage with a board. Don't add anything else for v1.

### 3.4 What you do NOT build for v1

Drop these from your scope. You can always add them back. You won't.

Don't build a screener. Finviz is free and better than anything you'll build in a year.
Don't build a comparison tool. Almost nobody actually uses these. It's a feature founders love and users ignore.
Don't build a portfolio tracker. Robinhood, Wealthfront, Mint all do this.
Don't build market overview / macro pages. Yahoo, CNBC, MarketWatch do this for free.
Don't build a watchlist for users. Save it for v2 when you have auth and a database.
Don't build a chatbot. You're not Perplexity. Stay focused.

Each of these I've just told you to delete already exists in your `Prism/src/app/` tree (`screener/`, `compare/`, `markets/`). Delete them.

---

## 4. The Alpha Tracker — your hook, framed honestly

You want five Claude agents to pick stocks publicly. I want to tell you why this is **brilliant content marketing and terrible alpha**, and how to thread the needle.

### 4.1 Brutal truth on whether AI stock-pickers work

LLMs do not have predictive edge in liquid public equities. They have been trained on data ending in early-to-mid 2025. They're using techniques (fundamental analysis, sentiment, news) that thousands of institutions also use. Markets are roughly efficient on the time horizons your agents are picking on (1M, 3M, 6M, 12M). The expected alpha of your five-agent system is approximately zero, with high variance. Some calls will be home runs (you'll tweet them), some will be disasters (you'll quietly remove them), the average will be slightly worse than buy-and-hold SPY after Claude API costs.

If you market this as "AI beats Wall Street," you're lying or stupid, and at some point a journalist will run your actual track record. Your 17-year-old founder narrative dies that day.

### 4.2 But it's perfect content

Here's the thing nobody else has done well: a public, real-time, **honest** track record of AI stock picks. Not a leaderboard. A diary. Every Monday at 9am ET, your `tfv-fund-manager` or "Alpha Council" picks one stock with full reasoning. Wednesday and Friday you update the thesis with new info. Stops and targets are public. Closed positions go on a permanent "trades" page. **The brand is: "the only AI fund that shows you when it's wrong."**

You will go viral when your AI calls something and gets the catalyst right. You will also go viral when it eats a 20% drawdown and your blog post about it is brutally honest. Both are good. Both build the audience.

This is exactly what some of the best finance accounts on X do (the honest ones — Howard Lindzon, Cem Karsan when he's transparent, Jack Forehand's Validea track record). Validea has 25 years of public model-portfolio data and it's a marketing engine for them, not because the models always work, but because the transparency does.

### 4.3 The five agents — concrete role assignments

You currently have: fundamentals, technicals, sentiment, macro, judge. Keep that. But re-cast them as personas so they're tweetable. Each one gets a name and a backstory you can put on the Methodology page:

- **The Quant** — fundamentals agent. Ranks DCF inputs, EPS revisions, FCF yield. Bias: ignores momentum and narrative. Most likely to be wrong when stocks are in a hype cycle.
- **The Chartist** — technicals agent. RSI, moving averages, volume. Bias: ignores fundamentals. Most likely to be wrong at major regime changes.
- **The Tape Reader** — sentiment agent. FinTwit, Reddit, news flow. Bias: late to information that's already priced in. Most likely to be wrong on contrarian setups.
- **The Macro Hawk** — macro agent. Fed, rates, sector rotation. Bias: too top-down. Most likely to be wrong on stock-specific catalysts.
- **The Judge** — synthesis agent (your most expensive call, Sonnet). Resolves disagreements, makes the final call, owns the public record.

Display them as cards with names, AI portraits (use Nano Banana Pro for this — see section 9), and individual track records per agent. This is huge for storytelling.

### 4.4 The hard rules for the Alpha Tracker

If you do this, you do it correctly:

1. **Paper-trade only.** Nothing real. Disclaim clearly. You're 17. Anything else is regulatory exposure.
2. **Every pick is timestamped on a public Git commit or a Supabase row signed with a hash.** You can't quietly edit later. This is the credibility move. (Easy: every pick writes to a Supabase row plus a public GitHub Gist via the API.)
3. **Stops and targets are pre-committed.** If the stop is $X, when it hits $X, the position closes. No "I'm letting it run." That's what your `alpha-tracker.ts` already does. Good.
4. **Performance dashboard is public.** Hit rate, average return per win, average loss per loss, total return vs SPY, max drawdown, Sharpe. Update daily. Show the ugly numbers prominently.
5. **You don't recommend specific actions.** Reports say "the Council's view." Not "you should buy."

This is your moat. The methodology is open, the performance is honest, and the brand is "we show our work." Robinhood doesn't. Bloomberg doesn't. Validea kind of does and they've built a real business on it.

### 4.5 Cost model for the Alpha Tracker

One full agent run per ticker per day, on roughly 500-700 tickers nightly = 2,500-3,500 Haiku calls + 500-700 Sonnet calls. At Anthropic pricing in May 2026 (Haiku-4.5 ~$1/$5 per Mtoken, Sonnet-4.6 ~$3/$15), each ticker's full agent set is roughly $0.03-0.05. Daily cost: $15-35. Monthly: $450-1050. **Too expensive for your budget.**

So you don't run the full panel on every ticker every day. You run a cheap pre-filter: a single Haiku call ($0.001) per ticker that decides "is this stock worth a full panel today?" based on news flow, earnings proximity, unusual volume. ~3% pass through. ~20-30 tickers per day get the full panel. Monthly cost: ~$30-60. Within budget.

Public picks happen at most twice a week. The agent council picks one new public position Monday and one Thursday. That's it. Quality over quantity. Each pick gets a full writeup, a tweet thread, a screenshot, an image generated by Nano Banana Pro of the "Council deliberating" (yes, do it, it's good content).

---

## 5. The 30-second intro animation — I'm building it, but read this first

You said it's non-negotiable. Fine. I'll spec it. But I have to put the data in front of you because if you read it and still want the gate, at least it's an informed choice.

### 5.1 What the data on forced video intros actually shows

Median time-to-first-meaningful-paint expectation in 2026 is under 2 seconds. Studies on video splash pages (Optimizely, Vercel's analytics, Nielsen Norman) show bounce rates climb above 40% after 3 seconds of "loading" and above 60% after 10 seconds of any forced delay. Forced video intros pre-dashboard have largely died for a reason. The places they still exist are luxury brands and game launchers where the **brand is the product**. Stripe doesn't have one. Linear doesn't. Notion doesn't. Robinhood doesn't. Bloomberg.com loads instantly.

The places where they survive: Apple keynotes (events, not products), F1 broadcasts (entertainment), AAA game launchers (you're already committed). The user is captive there. Yours isn't. A random user clicking your link from X is one tab among ten.

If your homepage takes 30 seconds before the user can see what your product is, 60-80% of first-time visitors leave. That's roughly true even with a beautiful animation, because beauty doesn't override impatience. Especially for finance users who are time-compressed by definition. The kind of user who clicks a link from a tweet expecting to see your AI's latest stock pick will not wait 30 seconds for a vortex animation.

### 5.2 Why you want it anyway, charitably

You're 17, you're a founder, this is partly an art project, you love beautiful websites, and the inspiration list you sent me (mont-fort, lusion, adsorb, igloo, manayerba) are all award-winning animation-first sites. You want to be in that company. You also want this for your college apps, which means the **portfolio value of the site matters as much as the conversion rate**.

That's a real and valid goal. But it conflicts with "I want 1000 users a day." Those two goals are different products. You need to pick which one you optimize for, and then build accordingly.

### 5.3 The compromise I'm willing to build for you

You get the cinematic intro. But it's not a 30-second hard gate. Here's the spec:

**First-time visitor flow:**
- Page loads. The 3D scene renders in the background. The title and a single CTA ("Enter Dashboard") appear at the bottom of the viewport, fully clickable, within 1.5 seconds.
- The intro animation auto-plays at full volume of visual drama for up to 35 seconds. During this time, scroll-driven storytelling moves the camera through the spiral, type animates in (using GSAP SplitText or Anime.js) for the headline beats.
- Three beats: (1) "Five AI analysts. One thesis." (2) "We show every disagreement." (3) "We publish every trade." Each beat is ~10 seconds with the camera moving.
- A subtle "Skip Intro" pill appears in the bottom-right at 3 seconds, persistent. Click it, you teleport to the dashboard. Default `localStorage` flag set so they never see the full intro again.
- After 35 seconds, the camera lands on the "Enter Dashboard" CTA frame, which pulses gently.

**Return-visitor flow:**
- Page loads. `localStorage` flag is set. They get a 2-second flyby version that's the final 2 seconds of the intro, then auto-lands on the CTA frame.

**Direct-link flow:**
- If they're coming from `/stock/AAPL` shared on Twitter, no intro at all. Straight to the page.

That gives you the cinematic for the homepage organic visitors while not killing your share-clicks from Twitter. The Skip button is the conversion-saver. The localStorage gate is the retention-saver.

Cost to build correctly: roughly 2-3 days of work with a real shader and pre-recorded video fallback (see section 9). Not a week. Don't let an AI vibe-code you into a multi-week 3D project. Limit scope.

### 5.4 The thing you actually need from the intro

The intro's job is **not** to look like Adsorb. Adsorb is a designer's portfolio site. Their job is to show off animation. Your job is to make a finance product credible. The intro should communicate three things in 30 seconds:

1. We have an AI panel that argues.
2. We publish our trades.
3. We're transparent about being wrong.

If the animation is gorgeous but doesn't communicate those three, it's portfolio work, not product work. The visual should be **less Lusion, more Bridgewater meets Apple Vision Pro**. Cold, institutional, slightly clinical. Not gamer-energy spiral colors.

For the actual visual: a single 3D camera dolly through a "boardroom in space" where five glowing AI nodes are debating around a holographic stock chart. Camera arcs in close on each agent for a beat. Final hero shot is the five nodes plus the judge, with the headline. This is **achievable** with a few primitive geometries + good lighting + pre-rendered Veo 3 background plates (section 9). It's not achievable in 2 weeks if you try to write a custom particle vortex shader from scratch. Pick the right scope.

---

## 6. Architecture: keep, kill, rewrite

This is the surgical pass on your two codebases. Stay in Alvara (the older one). Pull selectively from Prism.

### 6.1 Keep from current Alvara/Prism

These files are usable as-is or with light touchups:

- `src/lib/agents/*` — the 5-agent architecture is solid. The schemas are well-defined. The fallback patterns are reasonable. Keep this.
- `src/lib/data-pipeline.ts` — keep, but turn off `syntheticMode`. We're not shipping fake data. If APIs are down, the UI shows a clear "data unavailable" state.
- `src/lib/fmp.ts` — keep. The in-memory cache is decent. We'll upgrade to Supabase cache.
- `src/lib/alpha-tracker.ts` — keep. The gating rules are good (conviction >=75, target >=15% above entry, stop <=8% below). Don't loosen these.
- `src/lib/supabase-schema.sql` — keep. Use it as the source of truth.
- `src/lib/news-api.ts`, `src/lib/alpha-vantage.ts`, `src/lib/fiscal-ai.ts` — keep, but treat them as optional enrichment. The core product should work with just FMP + Claude.
- `src/components/PriceChart.tsx`, `src/components/AnimatedNumber.tsx`, the `stock/` tab components — keep, polish.
- `tailwind.config.ts` from Prism (it's more developed than Alvara's) — port over.
- `src/components/Navigation.tsx`, `Footer.tsx` — keep.

### 6.2 Kill from current Alvara/Prism

Delete these:

- `src/app/screener/` — drop the screener. Finviz wins.
- `src/app/compare/` — drop the compare. Nobody uses it.
- `src/app/markets/` — drop. Yahoo/CNBC win.
- `src/components/SectorHeatMap.tsx` — drop. Pretty but not core.
- `src/components/MarketPulseHeader.tsx` — drop.
- `src/components/EditorialMarquee.tsx`, `src/components/FeaturedResearch.tsx` — drop, they're filler.
- `src/components/CustomCursor.tsx` — drop. Custom cursors are 2018 design and they hurt accessibility. Use the OS cursor.
- `src/components/RouteProgress.tsx` — drop unless it's literally the Vercel page progress bar. The animations were probably part of why pages "felt slow."
- `src/components/SmoothScroll.tsx` (Lenis) — drop initially. Smooth scroll is the third-biggest reason your site felt janky. Add back later only if you really need it.
- `src/components/ParticleBackground.tsx` (if it's in addition to the 3D scene) — drop. Pick one.
- The "synthetic recovery" path in orchestrator — keep the function but have it return `null` and surface a clear UI error. We're not shipping hallucinated financials.
- All your existing 3D files except as reference. You're going to rewrite the scene per section 7.3.

### 6.3 Rewrite

Five rewrites, ranked:

1. **The 3D scene** — see section 7.3.
2. **The data-pipeline cache strategy** — see section 8.2.
3. **Error handling on every API route** — see section 7.5.
4. **The homepage** — see section 3.
5. **The agent pre-filter / cost gate** — see section 4.5.

---

## 7. Build plan — third time, with vibe-coder survival mode

You're a vibe-coder. That's fine if the architecture is designed for it. Vibe-coding fails when:

1. The scope is unbounded (you keep adding features, AI keeps complicating the code).
2. The error surface is invisible (you don't know what's broken).
3. Each session deletes context (you re-explain the project every time).

Here's the plan that protects against all three.

### 7.1 Set up your project memory once

Create a file at the root of Alvara called `CLAUDE.md`. This is the project memory. Every Claude Code or Antigravity session starts by reading it. Paste this exact content (edit as you learn):

```
# Alvara — project context for AI assistants

## What this is
A web app at alvara.com that publishes AI-generated stock research
with a transparent disagreement signal across five AI agents (the Council).

## Target user
Active retail investors, finance students, junior analysts.
NOT beginners. Treat them as financially literate.

## What we ship
- Daily "Disagreement Board" homepage
- Per-stock bear-case-first research reports
- Public Alpha Tracker (paper trades, full track record, all stops public)
- Methodology pages

## What we do NOT ship
- Screener, comparator, portfolio tracker, market dashboards, chatbot.
- Anything that requires more than one full Claude Sonnet call per
  user request.
- Any feature that uses real-time data per user without server-side caching.

## Hard constraints
- Monthly budget: $30-100. Cache aggressively.
- The "Council" picks at most TWO public stocks per week.
- We never claim AI beats the market. We market transparency, not alpha.
- We never ship hallucinated financial data. If real data is missing,
  the UI must show "data unavailable", never a synthetic fallback.

## Stack
- Next.js 14 App Router, TypeScript, Tailwind.
- Anthropic SDK (Sonnet 4.6 + Haiku 4.5).
- Supabase Postgres for caching + alpha picks.
- FMP Starter ($29/mo) for fundamentals.
- FRED (free) for macro.
- Sentry (free) for errors.
- Vercel for hosting.

## Coding rules
- Every API route must use try/catch and report errors to Sentry.
- No new files without checking if an existing one already does the job.
- Don't add new dependencies without checking package.json first.
- Always use the components/ patterns that already exist.
- 3D and animation lives in src/components/3d/ only and only on the
  landing page. Dashboard has zero 3D.

## What "done" means for a feature
1. It works locally with `npm run dev`.
2. It works deployed on Vercel preview.
3. It has at least one console.log or Sentry breadcrumb so we can see when it broke.
4. It does not exceed the cost ceiling.
```

This file goes at the root and you never let Claude Code rewrite it. When you start a new Antigravity session, the first message is always: "Read CLAUDE.md first, then continue." This is the single biggest leverage move for vibe-coding.

### 7.2 Use one IDE, not two

You're switching between Claude Code (CLI) and Antigravity. Pick one. They will give you different code in the same session and you will get conflicting changes.

Recommendation: **Antigravity for design and 3D, Claude Code for backend and data.** Not because one is better, but because you're already using both. The rule is: if it's a TypeScript file in `src/components/3d/`, edit in Antigravity. Otherwise Claude Code. Commit to git after every session in either.

If you want simpler, just use Claude Code. It's mature, predictable, and Anthropic's pricing on it works for your budget.

### 7.3 The 3D scene rewrite

You want cinematic. Here's how to ship it without crashing your laptop.

**Use a single shader, not 45,000 CPU-animated particles.** A shader runs on the GPU. The CPU just passes a time uniform. 100x cheaper.

Steps in priority order:

1. Strip the current SpiralScene down to **one** `<Stars>` background + ambient + the camera curve. Don't try to keep the particle effects yet. Get the camera moving smoothly first.
2. Add a single shader-based volumetric tunnel using `@react-three/postprocessing` + a fragment shader. Or use the `three-noise` library to generate a curl-noise particle field as a single draw call. Either works. Keep particle count under 8,000 visible at any time.
3. Add the "five Council nodes" as five glowing spheres positioned along the camera path, each with their own emissive material and a label.
4. Use **GSAP ScrollTrigger** for the three text beats (you already have GSAP). Each beat triggers when the camera crosses a certain z-threshold.
5. For the "boardroom in space" look, use Veo 3 to generate a background video plate (a slow-pan boardroom interior, abstracted). Display it as a `<video>` element behind the canvas. Costs you nothing at runtime. See section 9.

**Performance budget:** the scene must hit 50fps on a 4-year-old MacBook Pro. If it doesn't, cut particle count. If you can't hit it with 4,000 particles, the issue is elsewhere (probably the canvas being root-layer; move it to homepage only).

**The brutal rule:** the 3D scene only renders on `/`. The moment the user clicks "Enter Dashboard," it unmounts entirely. The dashboard route has its own clean layout with **zero** Three.js. You will be tempted to keep a "decorative" small 3D element on the dashboard. Don't. That's how performance dies again.

### 7.4 The 3D scene — exact Claude Code prompt to start

When you sit down to rebuild the 3D scene, paste this into Claude Code:

```
Read CLAUDE.md first. Then read src/components/3d/SpiralScene.tsx and
src/components/3d/Scene3D.tsx for context.

Goal: rebuild the 3D landing scene with these rules:
1. The Canvas lives ONLY on src/app/page.tsx (the landing route), NOT
   in src/app/layout.tsx. Move it.
2. Particle count must not exceed 8,000 visible at once.
3. Particle motion must be GPU-driven via a custom shader. Do NOT
   recompute positions in JavaScript per frame.
4. Use three text beats triggered by GSAP ScrollTrigger:
   - 0-33% scroll: "Five AI analysts."
   - 33-66% scroll: "One thesis."
   - 66-100% scroll: "Every disagreement, published."
5. There is a "Skip Intro" button in the bottom right at all times
   after page load.
6. After the user clicks Skip Intro OR scrolls past 100%, set
   localStorage["alvara.intro_seen"] = "true" and route to /dashboard.
7. On subsequent visits where localStorage flag is set, do a 2-second
   flyby instead of the full intro.

Do not add any new dependencies. Use only @react-three/fiber,
@react-three/drei, three, gsap. Stop and ask me before touching any
files outside src/components/3d/, src/app/page.tsx, and
src/app/layout.tsx.

When done: explain what you changed, why, and what to verify in dev.
```

This prompt is exact. Don't loosen it. The "stop and ask before touching other files" line is what protects you from the AI silently breaking your data pipeline while it's making the 3D scene pretty.

### 7.5 Error visibility — wire Sentry on day one

Free tier of Sentry handles your scale easily. Install in 15 minutes:

```
npm install --save @sentry/nextjs
npx @sentry/wizard@latest -i nextjs
```

It walks you through. After install, every API route should look like this:

```typescript
// src/app/api/analyze/[ticker]/route.ts
import * as Sentry from "@sentry/nextjs";
import { runMultiAgentPipeline } from "@/lib/agents/orchestrator";

export async function GET(req: Request, { params }: { params: { ticker: string } }) {
  try {
    const result = await runMultiAgentPipeline(params.ticker, { useCache: true });
    return Response.json(result);
  } catch (err) {
    Sentry.captureException(err, { tags: { route: "analyze", ticker: params.ticker } });
    return Response.json(
      { error: "analysis_failed", code: "ANALYZE_001" },
      { status: 500 }
    );
  }
}
```

The frontend should display the error code (`ANALYZE_001`) when things fail. Why: when you copy-paste an error into your AI prompt, the code is searchable and the AI immediately knows where to look. Without codes, every error looks identical and the AI flounders.

Make a list of error codes in `src/lib/errors.ts`. Two-letter prefix per route family (`AN` analyze, `DP` data-pipeline, `AG` agent), three-digit suffix. Update as you go. Future-you will thank you.

### 7.6 Build order, week by week

You said you don't want to fail again. Here's the calendar that doesn't fail. Each week ends with something deployable.

**Week 1: Foundations.**
- Rotate all keys (already done).
- Delete Prism folder. Rename Alvara to be canonical.
- Delete the dead routes (screener, compare, markets, sector heatmap).
- Set `NEXT_PUBLIC_USE_MOCK_DATA=false`. Remove all mock-data code paths.
- Install Sentry. Wire it into every API route.
- Set up Vercel deploy on a real domain.
- Write CLAUDE.md.
- **Deploy at end of week:** the homepage and the methodology page only. They can be static. No 3D yet.

**Week 2: Real data.**
- Upgrade FMP to Starter ($29). Or evaluate Polygon Stocks Starter ($29) — Polygon's data quality is meaningfully better and you may find their tier limits less restrictive.
- Set up Supabase schema for `cache`, `alpha_picks`, `agent_runs`, `daily_picks`.
- Build a nightly cron job (Vercel Cron) that pre-runs the agent pipeline for ~500 tickers and writes to cache.
- Test: load 10 stock pages, verify zero live FMP calls happen, everything serves from cache.
- **Deploy at end of week:** stock pages render real cached data. Dashboard shows the Disagreement Board with 50-100 stocks.

**Week 3: Agent council + Alpha Tracker.**
- Implement the cost-gating pre-filter (Haiku call per ticker).
- Implement the Alpha Council: at most 2 public picks per week, written to `alpha_picks` table with a public GitHub gist mirror.
- Build the Alpha Tracker page with the public track record.
- Build the methodology page that documents each agent.
- **Deploy at end of week:** the Alpha Tracker is live with at least one historical paper trade. The Council page shows the five agents.

**Week 4: The cinematic intro.**
- Build the 3D scene per the exact prompt in 7.4.
- Test on 3 different machines.
- Add the localStorage skip logic.
- Generate the Veo 3 background plates and Nano Banana Pro Council portraits (see section 9).
- **Deploy at end of week:** the cinematic landing page goes live. The dashboard is unchanged.

**Week 5: Polish and launch.**
- Performance pass. Lighthouse score >85 on /. >95 on dashboard.
- Tweet thread, ProductHunt prep, X bio update.
- First Alpha Council pick of the official launch.
- **Launch.**

Five weeks. Each week ends with something the world can see. Each week's scope is small enough that a vibe-coder can survive it. If any week takes two weeks, that's normal. If it takes four, stop and re-scope.

### 7.7 What you must NOT do during the build

- Don't add features mid-week. Write them in a `BACKLOG.md` and come back after launch.
- Don't refactor unless something is actually broken.
- Don't switch frameworks. Stay Next.js. Stay Tailwind. Stay Supabase.
- Don't try to build auth in v1. The product works fully anonymous.
- Don't try to integrate a payment system until you have ~500 monthly visitors.
- Don't spend more than 30 minutes debugging a problem before asking an AI for help with the Sentry error code attached.

---

## 8. API + cost strategy on $30-100/mo

You'll be tight but it works if you cache hard.

### 8.1 Recommended provider stack for v1

- **FMP Starter** ($29/mo): unlimited daily calls, all fundamentals + insider + earnings. The free tier killed you; the paid tier solves it.
- **FRED API** (free): macro data, no rate limit you'll hit.
- **Alpha Vantage free** (25 calls/day): use only for the technical indicators on the top 25 most-active tickers, cached for 24 hours. Or drop it entirely; you can compute RSI/MACD from FMP historical data yourself with 10 lines of code.
- **News API or Finnhub free tier**: for news headlines. Both have free tiers that handle 50-500 calls/day. Cache for 1 hour.
- **Anthropic API**: budget $30-50/month. Sonnet for the Judge agent only. Haiku for everything else.
- **Sentry free tier**: 5k errors/month, plenty.
- **Vercel Hobby**: $0 until you hit usage limits. You won't in month one.
- **Supabase Free**: 500MB Postgres, plenty.

Monthly cost at launch: ~$30 FMP + ~$40 Anthropic + $0 everything else = ~$70. Within your range.

### 8.2 Cache strategy — the rule that saves you

**Rule:** no API call happens on a user request. Ever. Every endpoint serves from Supabase. Supabase is filled by cron jobs that run server-side overnight.

Concretely:

- `/api/stock/[ticker]` → reads `stock_snapshots` table → never calls FMP.
- `/api/analyze/[ticker]` → reads `analysis_cache` table → never calls Anthropic on user request.
- The only live Claude call is on a "Re-analyze with latest news" button that the user explicitly clicks, and is rate-limited to once per ticker per hour per IP.

You already have most of this in your code (`analysis_cache` table, `withAgentCache`). Tighten the rule: **if cache miss, return a "data not available — refreshes overnight" message. Do not call APIs on cache miss.**

This is what keeps your bill predictable. If someone hammers your site, your costs don't move.

### 8.3 The agent cost ladder

Define this in your code as a constant and never violate it:

```typescript
// src/lib/agents/cost-ladder.ts
export const COST_LADDER = {
  // Tier 0: free, runs on every ticker every day
  preFilter: { model: "claude-haiku-4-5-20251001", maxTokens: 200 },
  // Tier 1: ~$0.005 per call, runs on ~30 tickers per day
  agents: { model: "claude-haiku-4-5-20251001", maxTokens: 1500 },
  // Tier 2: ~$0.03 per call, runs on ~30 tickers per day (just the judge)
  judge: { model: "claude-sonnet-4-6", maxTokens: 2500 },
  // Tier 3: ~$0.10 per call, runs ONLY on the 2 public picks per week
  publicReport: { model: "claude-sonnet-4-6", maxTokens: 6000 },
} as const;
```

Daily budget cap: $3. Monthly: ~$90. You wired a `SPEND_LIMIT_USD` env in `util.ts` already. Set it to 3, not 50.

### 8.4 On using Perplexity, Gemini, or other models

You asked. The honest answer: stay on Claude for v1. Reasoning:

- You have Claude credits already.
- Claude Sonnet/Haiku are the strongest at structured JSON output, which is what your agent system needs.
- Perplexity is great for **retrieval + reasoning over fresh web content**, which is a specific niche. You don't need it for v1 because FMP gives you the fundamentals and your sentiment agent reads news directly. Add it in v2 if the bear-case agent needs deeper bear-thesis sourcing from web.
- Gemini 2.5 Pro is competitive but you'd be juggling two SDKs for no clear gain.

Add a second model only when you have a specific need a single model can't cover. Most likely: Perplexity for the bear-case agent's "find me three bear quotes from FinTwit and Seeking Alpha" call. That's a single Perplexity call per public pick, twice a week. Cost: trivial.

---

## 9. Using Nano Banana Pro and Veo 3 for the 3D scene

You have Google Plus / Gemini Advanced or whatever subscription includes Nano Banana Pro + Veo 3. Use them.

### 9.1 What they're for

Nano Banana Pro (Gemini's image model) is best-in-class for stylized hero images with consistent lighting. Veo 3 produces ~8-second video clips at 1080p with passable physics.

Neither replaces a 3D scene that you can move the camera through. But they can absolutely produce:

1. **Background plates.** Veo 3 generates a slow-zoom abstract video that you place behind the 3D scene. Saves you from modeling environment detail. Loops on the homepage.
2. **The five Council portraits.** Each agent gets a portrait. Use Nano Banana Pro with a consistent prompt structure to get the five characters in the same lighting and style. These appear on the Methodology page and in the Alpha Tracker writeups.
3. **Tweet thread visuals.** Every Council pick gets a custom illustration. Nano Banana Pro at 1:1, prompts like "five glowing crystalline figures arguing around a holographic stock chart, cinematic lighting, deep blue and emerald, institutional clean design." Generate three options, pick the best, tweet it. This is huge for content.
4. **Loading-state animations.** When the user clicks "Generate Bear Case," instead of a spinner, show a 6-second Veo 3 clip of "the Council deliberating." Loops. Premium feel.

### 9.2 Cloud-Code / Antigravity image upload — what it actually does

You mentioned uploading images to "CloudCote" (probably Claude Code) or Antigravity. Here's the truth:

You can upload reference images to either tool and the AI will look at them for layout/style cues when generating code. **It cannot turn a 2D image into a 3D scene.** It can write Three.js code that approximates the visual style of your reference. It can write Tailwind that matches a screenshot's layout. It will not magically build a vortex like Adsorb's by you uploading their screenshot.

What it's actually good for:

- Upload your `Alvara logo.png` and a screenshot of mont-fort.com. Prompt: "Build a homepage layout that matches the typography and spacing of the screenshot, using my logo, with a Three.js Canvas background that we will populate later." The AI builds you a layout shell that looks like mont-fort.
- Upload a Nano Banana Pro generated image of "the five Council members." Prompt: "Build a Methodology page that displays these five characters in a grid with stats." AI builds the page with image placeholders.
- Upload a screenshot of a Bloomberg terminal. Prompt: "Match this density and information design for the stock detail page." AI builds the page.

That's the entire utility. Use it like that. Don't expect magic.

### 9.3 The exact creative pipeline for the intro

1. **Day 1 of week 4:** generate three Nano Banana Pro images of the "Council." Pick one. Generate the five individual portraits with the same style. Save to `public/council/judge.png`, `public/council/quant.png`, etc.
2. **Day 1:** generate a Veo 3 background plate. Prompt: "Slow pan through an abstract data-cathedral, deep blue and emerald light, particles drifting, institutional clean, no text." 8 seconds. Loop. Save to `public/intro-bg.mp4`.
3. **Day 2-4:** wire the 3D scene per section 7.3 with the Veo 3 plate underneath the canvas as a `<video autoplay loop muted>` element.
4. **Day 5:** wire the GSAP text beats and the Skip button.

The 3D Canvas is the foreground (5 nodes, particles). The Veo 3 video is the midground (the "room"). The Stars from r3f are the background. Three layers, each cheap, composited gives a much bigger sense of scale than any of them alone.

### 9.4 What you do NOT generate with Veo 3 or Nano Banana Pro

- Don't generate fake user testimonials or fake people's headshots. Lawsuit territory and reputation suicide.
- Don't generate fake "Bloomberg screenshots" or any imagery that implies institutional endorsement.
- Don't put generated faces of real CEOs anywhere. Not even stylized.

---

## 10. Marketing reality check: "1000 users a day in week one"

This is the part you'll like least. I'm going to be specific.

You're a 17-year-old solo founder with no following on X, no waitlist, no email list, no warm network of finance pros. Launching a new product, you will get **somewhere between 50 and 500 unique visitors in week one** if your launch is competently executed. 1,000 a day, sustained, in week one is roughly the top decile of ProductHunt launches and most of those have founders with 10k+ X followers. You don't have that yet.

This doesn't mean you fail. It means you measure success differently in the first 90 days.

### 10.1 Realistic targets

**Week 1 of public launch:** 200-500 unique visitors, 30-80 returning, 10-25 newsletter signups, 0-5 paying. (Yes, paying. See 10.3.)

**Month 1:** 1,000-3,000 unique, 200-500 returning, 100-300 newsletter, 5-30 paying.

**Month 3:** 5,000-15,000 unique, 1,000-2,500 returning, 500-1,500 newsletter, 50-150 paying.

If you 10x those, you're a viral hit. If you 0.1x them, you're a normal solo launch. Plan for the middle.

### 10.2 What gets you the 200-500 in week one

In order of impact:

1. **A tweet thread that goes mildly viral.** Quote-tweet your favorite FinTwit personality with the Council's contrarian take on a stock they just shilled. Be respectful, be substantive. If they reply, you win. If they don't, you got eyeballs anyway. Do this once a week, indefinitely.
2. **A ProductHunt launch on a Tuesday or Wednesday.** Prep the launch page two weeks in advance. Pre-line up 30 friends/classmates to upvote and comment on launch day. Aim for top 5 of the day. ProductHunt's traffic spike is real but short — be ready with the homepage and the dashboard polished.
3. **A "Show HN" post on Hacker News.** Title: "Show HN: Alvara — AI stock research where the AI shows when it disagrees." HN responds well to transparency-first finance products. Be ready for harsh feedback in comments. Respond gracefully.
4. **One Reddit post per week** in r/SecurityAnalysis, r/investing, r/StockMarket. Not promo posts. Actual contributions where you reference Alvara as the source of an interesting chart. Mods will ban you if you're spammy.
5. **DM 50 finance students** at Wharton, Stern, HBS, LBS, Booth. Yes, cold DM. Subject: "Built a tool for case competition prep, want feedback." Most ignore. Five respond. Two become evangelists. They post in their student investment club Slacks. Free distribution.
6. **A YouTube short** with your own face on camera explaining "I built an AI panel that argues about stocks." Sub-60 seconds. Vertical. Cross-post to TikTok and Reels. As a 17-year-old founder, you have a credible "kid who builds finance products" hook that adults don't have.

That's the playbook. It takes about three weeks of consistent execution to get to a few hundred users.

### 10.3 Monetization: when and how

Don't gate anything in v1. Free for everyone. Build the audience first.

In month three, when you have ~2,000 monthly visitors and a clear repeat-use pattern, soft-launch a **$15/month "Council Premium"** tier with:

- Real-time alerts when the Council issues a new pick.
- The full bear case (free tier shows the top 200 words, premium shows the full report).
- Personal watchlist that the Council scans for you.
- Discord access where you and the early users chat.

Conversion target: 2-4% of monthly visitors. So at 5k visitors, that's 100-200 paying = $1.5k-3k MRR. Plausible by month four if you execute.

Don't ever charge per-API-call or per-ticker. Subscription only. The market has been trained on Spotify/Netflix-style pricing and your target user expects it.

### 10.4 The college application angle

You mentioned this is for college apps. That's actually a big lever you're underusing. Two things:

1. **The story matters more than the product.** A working product with 100 users and a brutally honest "what I learned" essay is far stronger than a polished product with no users. Document everything. Keep a build log. Tweet your progress. Show the receipts.
2. **The honest failure narrative is your edge.** You restarted twice. Most apps will hide this. Don't. The fact that you have **specific, technical, lessons-learned receipts** from two failures is what admissions officers in technical fields actually want to see. Frame this report as exhibit A.

So even if Alvara only hits 500 users, you have an exceptional college app if you tell the story right. Do not let the user-count be the only metric of success.

---

## 11. Brutal honesty on three of your ideas

You asked me to stress-test. Here it is.

### 11.1 "The 30-second intro is non-negotiable"

I built you a compromise. But: if your bounce rate on the homepage is above 50% in week two, you need to revisit this. The Skip button has to be obvious. The "intro" beats need to actually communicate value, not just look pretty. If after two weeks of analytics, the intro is the reason people leave, you kill it. Don't be sentimental about a feature that's hurting you.

### 11.2 "I want this to be a monopoly nobody else is solving"

Nobody is a monopoly in finance research. Bloomberg, S&P, Refinitiv, AlphaSense, Tegus, Koyfin, Seeking Alpha, Yahoo, every fintwit account — they're all solving overlapping problems. What you can be is the **most credible AI-native research source** in a market where most competitors are either pre-AI legacy (Bloomberg) or LLM wrappers with no edge (50 ChatGPT-skinned "stock pickers" that launched in 2024-25 and died). Your edge is: structured multi-agent, transparent disagreement, public track record, no hallucination.

"Monopoly" is the wrong word. "Defensible niche" is the right one. Don't promise yourself a monopoly. Promise yourself a niche where you're the obvious first choice.

### 11.3 "AI agents picking stocks is something hedge funds haven't done"

False. Renaissance Technologies has been running ML on equities since the 90s. Two Sigma, DE Shaw, Citadel all have ML/LLM teams. JP Morgan's research team published a paper in 2024 on using GPT-4 to read earnings transcripts and the alpha was negligible after costs. **AI picking stocks is well-studied and the academic consensus is: a small, fragile, hard-to-realize edge that disappears after transaction costs and crowd-out.**

Your version of "AI picks stocks" is interesting **not because it's novel research**, but because nobody is publishing the receipts publicly in real time. That's the angle. Repackage as a media play with a research engine underneath, not as a research breakthrough. You'll be on much firmer ground when a skeptical journalist or admissions officer asks.

---

## 12. What I need from you next, in order

1. Rotate the keys. Confirm done.
2. Decide on the product name canonically (recommend Alvara). Buy the domain. Confirm.
3. Delete the duplicate codebase. Confirm.
4. Read this whole document. Mark anywhere you disagree. Tell me where.
5. Pick the wedge: A+C (recommended), or override me with a different combination.
6. Confirm the 5-week build timeline is realistic for your school schedule. If it's not, we stretch to 8 weeks, but we don't compress.
7. After you've done 1-6, message me with: "Done with prep, starting week 1." I'll give you the exact prompts for week 1.

---

## 13. A note on tone

You asked me to be a ruthless mentor and to stress-test everything. I just did. Some of this stings. Some of it contradicts your vision. I'm not asking you to drop the vision. I'm asking you to ship a version of it that survives contact with users.

You restarted twice. The pattern in both restarts was: ambitious scope, no instrumentation, free APIs that couldn't carry users, and a 3D scene that crashed the experience. None of that is a failure of effort. It's a failure of structure. This document is the structure.

Third time's the charm only if you treat this build like you're running a tight startup with a tiny team, not an art project with infinite scope. You can have art **and** product. But product comes first.

I'm in your corner on this. When you start week 1, ping me.

— Your ruthless mentor
