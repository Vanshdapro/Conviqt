# Conviqt — project constitution for AI assistants

Source of truth for the rebrand: `../CONVIQT_REVIVAL_PLAYBOOK.md` (repo parent
folder). When this file and the playbook disagree, the playbook wins. When in
doubt, reread playbook Part 0.

## 🔒 HARD RULE — LOCAL ONLY, NO DEPLOYS

All rebuild work happens LOCALLY on a feature branch (current: `rebrand-almanac`).
Committing and pushing to the branch is fine — Conviqt deploys via the
`vercel --prod` CLI, not via git push, so pushing cannot deploy anything.
But NEVER run `vercel`, `vercel --prod`, `vercel deploy`, or any other
deploy/publish command until the founder explicitly says to ship. No exceptions,
no "just a preview." When a task says "commit & push," that means the git
branch only.

The pre-rebrand codebase is archived on branch `legacy-v1`. Never force-push
or delete it.

## What this is

A web app at conviqt.com: your personal team of AI analysts. Users ask
anything about any stock and get plain-English answers with live market data,
backed by a public track record we can't hide from — losses included.
We market transparency, never alpha. We never claim AI beats the market.

## Target user

Beginner-to-intermediate retail investors. Think: a 19-year-old with $500.
Plain English everywhere — no jargon, no finance-bro shorthand, no machinery
talk. Every feature name must be something that person would say out loud.
Concepts get explained (and deep-linked to Academy lessons), never assumed.

## The app — exactly 5 surfaces

Sidebar on desktop, bottom tabs on mobile (≤768px). Nothing else ships.

1. **Research** (home) — "What do you want to look into?" input, mode toggle
   **Council** (deep, ~60–90s, full multi-analyst) / **Flash** (instant take),
   plus a `Skills` button opening the Skill Library sheet.
2. **Dashboard** — Market Snapshot, Today's Trends, Early Signals, **Picks**
   (public track record, losses visible), Upcoming Events. Globally cached.
3. **Headlines** — region tabs (~10 regions + Crypto); every headline gets a
   one-line "what it could mean for traders" take. Globally cached. Tapping a
   headline runs Headline Decoder pre-filled in Research.
4. **Portfolio** — holdings (manual/CSV) + watchlist ("Watching" tab); live
   values; stats strip: Beta · Volatility · Max Drawdown · Sharpe (computed
   from free price history, costs nothing); **AI Health Check** button.
5. **Academy** — existing 11 tracks / 89 lessons + Practice + Leaderboard,
   restyled to the new brand; lessons deep-linked from analysis answers
   ("Learn why this matters →").

### Retired — do not rebuild, do not reference

API/developers surface, CDI page, standalone Watchlist page (merged into
Portfolio), Translate, Newsletter, 3D intro, particle canvas, gradient-serif
marketing pages. Old routes 301 → home. The code lives on `legacy-v1` only.

## Brand — "ALMANAC" (light, warm-editorial)

A modern financial almanac: warm paper, espresso ink, ONE teal accent.
**LIGHT theme.** This is the ENTIRE allowed palette — no color outside this
set may appear anywhere in the UI, ever.

```
/* NEUTRALS — warm paper (the field) */
--bg-page      #F5EFE1   warm off-white — the dominant background
--bg-surface   #FCFAF5   brighter warm white — cards lift off the page
--bg-sunken    #E7DFC6   Sand Dune — wells, sidebar, section bands, inputs
--border       #DED2B8   tan hairline        --border-strong #C9B991
/* INK — espresso-derived, NEVER pure black */
--text         #2A1C15   espresso-black — headlines & body
--text-2       #63372C   Espresso — secondary labels
--text-muted   #8A7866   captions, timestamps
/* ACCENT — teal (buttons, links, active nav, focus rings) */
--accent       #0E7C7B   --accent-hover #0A5F5D   --accent-weak #D6E7E5
--on-accent    #FBF7EC   cream text on teal fills (use ≥14px semibold)
--link         #0A5C5A   darker teal for small text links (stays AA on paper)
/* MARKET DATA — the only other hues; data only, never decoration */
--up           #0FA3B1   Pacific Blue (gain)   --up-weak #D5EFF1   --up-ink #0A6F79
--down         #E3655B   Coral (loss)          --down-weak #F8DEDB --down-ink #C0473D
/* DRAMA — one dark moment, used sparingly */
--espresso     #63372C   deep block for the footer (cream text on top)
```

- **Typography:** Cabinet Grotesk (display — headlines, big numbers, hero) +
  General Sans (UI, body, data tables with tabular figures ON for numbers).
  Both self-hosted via `next/font/local` from downloaded `.woff2` (Fontshare).
  Never a CDN `<link>`.
- **Radius:** 14px cards / 9px controls / 999px pills. **Spacing:** 4px base scale.
- **Elevation:** separate surfaces by TONE + 1px border, not heavy shadows.
  Max shadow: `0 2px 8px rgba(42,28,21,.06)`.
- **Motion:** 150–220ms ease-out micro-interactions only.
- **Gains/losses** render as tinted PILLS: `+2.57%` = `--up-ink` on `--up-weak`;
  `−1.4%` = `--down-ink` on `--down-weak`. Inline (no pill) uses
  `--up-ink` / `--down-ink` at ≥14px medium. Arrows (▲▼) always accompany
  color so meaning never relies on hue alone.
- Pacific Blue and Coral are reserved EXCLUSIVELY for market gains/losses.
  Teal is the only decorative accent.

### Visual bans — absolute, no exceptions

- No 3D, no WebGL, no particles, no parallax, no gradient-as-art (a flat warm
  tonal step is the only permitted "gradient").
- No pure black `#000` and no pure white `#FFF` / `#FFFFFF`, anywhere.
- No color outside the token set above — not in charts, not in illustrations,
  not in OG images, not in one-off marketing pages. A stray purple gradient or
  a pure-white card is how this brand dies.
- All colors come from `tokens.css` variables, never hardcoded hex in components.

## Copy rules

- Users NEVER see these words: **agents**, **council pipeline**, **credits**,
  **CDI**, **disagreement score**. (Also banned in user-facing copy:
  web_search, tokens, pipelines, prompts — machinery stays backstage.)
  Internal code/comments may use them; rendered UI text may not.
- Conviction is shown as "How sure: High/Medium/Low" — never a raw score.
- Citations live in a collapsed "Sources" accordion — present, never foregrounded.
- All user-facing feature names come from playbook Part 2.3 VERBATIM — copy
  from this table, never invent or paraphrase:

| Skill | One-liner | What it runs | Category |
|---|---|---|---|
| **Worth Owning?** | "Is this a company you'd want for years?" | Full Council fundamental verdict | Fundamentals |
| **Quick Take** | "The 30-second read on any ticker" | Flash pipeline | Fundamentals |
| **Entry & Exit Zones** | "Where the smart levels sit" | Technical-weighted run | Technicals |
| **Face-Off** | "Two stocks enter. One wins." | Compare pipeline | Comparisons |
| **Sector Pulse** | "What's moving a whole industry" | Sector pipeline | Discovery |
| **Headline Decoder** | "Any headline → which stocks it touches and how" | News-impact run | News |
| **Crowd Check** | "What investors are feeling vs the data" | Sentiment-weighted run | Sentiment |
| **Bull & Bear Map** | "Best case, worst case, base case" | Scenario synthesis | Fundamentals |
| **Starter Portfolio** | "From budget + goals to an actual plan" | Allocator pipeline | Portfolio |
| **Portfolio Health Check** | "Stress-test what you own" | Audit pipeline | Portfolio |

- Never use Barebone's name, logo, screenshots, or the words Nexus/Blitz.
- Disclaimer on every analysis surface + footer: *"Conviqt is a research and
  education tool, not a licensed financial adviser. Nothing here is financial
  advice. Markets involve risk."*
- No imperative trade language in outputs ("buy now") — verdicts are framed
  as research/education ("the analysts' view").

## Pricing — subscription, not credits

- **Free:** 5 deep analyses/mo + Flash basics + Academy fundamentals + full
  track-record access (transparency is free, always).
- **Pro: $16/mo annual · $25 monthly · 7-day trial** — unlimited fair-use
  analyses, full Academy, portfolio tools, priority speed.
- Credits remain as INTERNAL metering only. No user-visible credit numbers,
  no packs, no visible token math, no navbar balance.

## Data architecture

- **Free keyless price feeds are ALLOWED** (Stooq CSV, Yahoo chart endpoints)
  for quotes, history, key stats, and portfolio math — behind a
  provider-adapter interface in `src/lib/marketdata/` so a dead endpoint is a
  one-file swap, never a rewrite. Delayed data is fine but must be labeled
  ("delayed ~15 min") — honesty is brand.
- **Paid data APIs remain BANNED.** No FMP, no FRED, no Alpha Vantage, no
  NewsAPI, no Marketaux. Claude API is the only paid external API.
- Claude does REASONING only. `web_search` covers news/qualitative facts, not
  price fetching.
- Headlines/Dashboard content is generated by scheduled Haiku jobs, cached in
  Supabase, shared by all users.
- Quantitative claims are traceable: numbers come from the marketdata layer
  or carry a source URL. Never hallucinated, never synthetic.

## Cost discipline (unchanged — these are real-time targets, not averages)

- Monthly Claude budget: $30–100. Cache aggressively.
- On-demand analysis: 1–5 cents per request, soft cap 7 cents.
- Pick generation: 3–7 cents per request, soft cap 12 cents.
- Intent routing (Haiku): under 0.5 cents.
- Scheduled Dashboard/Headlines refresh: ≤ 35 cents per run all-in; log
  actual cost per run.
- If a feature blows past its soft cap, kill it or simplify before shipping.
- Caching: Supabase — analysis by ticker + 4h bucket; marketdata quotes
  15 min; history 24h; Dashboard/Headlines globally cached, refreshed on
  schedule, shared by all users.

## Stack

- Next.js 16 App Router, React 19, TypeScript, Tailwind 4.
- Anthropic SDK only for AI: Sonnet for synthesis, Haiku for specialists,
  intent routing, and scheduled content. Opus reserved for cases we
  explicitly justify.
- Supabase Postgres for caching, picks, portfolios.
- Vercel for hosting — but see the LOCAL ONLY rule: no deploy commands.
- Sentry (free) for errors — added AFTER core features work, not before.

## Internal pipeline (backstage vocabulary — never rendered to users)

1. Sweep agent (Haiku, max 5 web_searches) builds a FactSheet of sourced
   qualitative facts; price/fundamentals come from the marketdata layer.
2. Four specialists (Fundamentals, Technicals, Sentiment, Macro) run in
   parallel on the FactSheet.
3. Judge (Sonnet) synthesizes verdict + conviction + bull/bear lines,
   carrying sources through for the collapsed Sources accordion.

Agent counts can change per feature. What's sacred: (a) every quantitative
claim is traceable, (b) the verdict reads in plain English.

## Coding rules (kept)

- Every API route uses try/catch. Log errors with console.error at minimum;
  Sentry breadcrumb if Sentry is wired.
- No new files without checking if an existing one already does the job.
- No new dependencies without checking package.json first.
- Use the components/ patterns that already exist (post-rebrand: the
  `src/components/ui/` primitives — Card, StatTile, TickerChip, Sparkline,
  SkeletonLoader, EmptyState, ModeToggle, Sheet).
- No `NEXT_PUBLIC_USE_MOCK_DATA` flag. No synthetic data fallbacks. If a
  data source fails, the UI says so honestly ("data unavailable").
- No demo paths in production. To test without spending API credit, use a
  recorded fixture in `__tests__/`, not a synthetic context.
- Do NOT install Sentry via `npx @sentry/wizard` (creates broken
  instrumentation that hangs `next dev`). When we add Sentry, do it manually
  and test boot before committing.

## What "done" means for a feature

1. It works locally with `npm run dev`.
2. It looks right at 390px mobile AND desktop, judged against the Almanac
   tokens above (screenshots for the founder's review).
3. Zero non-token colors, zero banned words in rendered copy.
4. It has at least one console.log or Sentry breadcrumb so we can see when
   it broke.
5. It does not exceed the cost ceiling.
6. Every number it renders is traceable (marketdata layer or source URL).
7. Committed and pushed to the feature branch. NOT deployed.
