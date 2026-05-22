# Conviqt — project context for AI assistants

## What this is

A web app at conviqt.com that publishes AI-generated stock research
with a transparent disagreement signal across multiple AI agents.

Conviqt is chat-first. Users type "analyze AAPL" or "pick me a stock"
and the Council runs on demand against live web-sourced data. Published
picks (the Disagreement Board, Alpha Tracker) are derived from the same
pipeline, just cached and curated.

## Target user

Active retail investors, finance students, junior analysts.
NOT beginners. Treat them as financially literate.

## What we ship

- Chat-driven on-demand stock analysis (any ticker, any time)
- A daily "Disagreement Board" surfacing the top picks the Council
  fractured on most
- Per-stock bear-case-first research reports
- Public Alpha Tracker (paper trades, full track record, all stops public)
- Methodology pages

## What we do NOT ship

- Screener, comparator, portfolio tracker, market dashboards.
- Any number in a published report that does not have a clickable source URL.
- Anything that exceeds the per-query cost ceiling without explicit caching.

## Hard constraints

- Monthly budget: $30-100. Cache aggressively.
- The "Council" picks at most TWO public stocks per week for the Alpha
  Tracker. On-demand chat analysis is uncapped but each query is metered.
- We never claim AI beats the market. We market transparency, not alpha.
- We never ship hallucinated financial data. Every quantitative claim must
  cite a source URL produced by Claude's web_search tool. If a fact has no
  source it does not get rendered.
- Claude API is the ONLY paid external API. No FMP, no FRED, no Alpha
  Vantage, no NewsAPI, no Marketaux. If we need a number, the sweep agent
  fetches it via web_search.

## Cost targets per request

- On-demand chat stock analysis: 1-5 cents per request. Soft cap 7 cents.
- Stock pick generation: 3-7 cents per request. Soft cap 12 cents.
- Intent routing (cheap Haiku call): under 0.5 cents.
- These are real-time targets, not averages. If a feature blows past the
  soft cap, kill it or simplify before shipping it.

## Stack

- Next.js 16 App Router, React 19, TypeScript, Tailwind 4.
- Anthropic SDK only for AI: Sonnet 4.6 for synthesis, Haiku 4.5 for
  specialists and intent routing. Opus 4.6 available but reserved for
  cases we explicitly justify.
- Claude web_search tool ($10 / 1000 searches) as our sole data source.
- Supabase Postgres for caching + alpha picks (cache by ticker + 4h bucket).
- Sentry (free) for errors — added AFTER core features work, not before.
- Vercel for hosting.

## Agent pipeline

1. Sweep agent (Haiku + web_search, max 5 searches) builds a FactSheet:
   structured facts with source URLs covering price, fundamentals,
   technicals, sentiment, macro.
2. Four specialist agents (Fundamentals, Technicals, Sentiment, Macro) run
   in parallel on the same FactSheet. Each produces BUY/HOLD/SELL with
   cited source indexes.
3. Judge (Sonnet) synthesizes the four into a final verdict, conviction,
   disagreement score, bull line, bear line. Carries through the union of
   sources for citation rendering.

Agent counts can change per feature. The number isn't sacred. What's
sacred is: (a) every quantitative claim has a URL, (b) disagreement is
visible to the reader.

## Coding rules

- Every API route must use try/catch. Log errors with console.error at
  minimum; Sentry breadcrumb if Sentry is wired.
- No new files without checking if an existing one already does the job.
- Don't add new dependencies without checking package.json first.
- Always use the components/ patterns that already exist.
- 3D and animation lives in src/components/3d/ only and only on the
  landing page. Dashboard has zero 3D.
- Do NOT install Sentry via `npx @sentry/wizard`. The wizard creates broken
  instrumentation files that hang `next dev`. When we add Sentry, do it
  manually: install the package, create the three config files by hand,
  test boot before committing.
- No `NEXT_PUBLIC_USE_MOCK_DATA` flag. No synthetic data fallbacks. If
  the API fails, the UI says so.
- No demo paths in production. The `?demo=1` escape hatch is gone. If you
  need to test without spending API credit, use a recorded fixture in
  __tests__/, not a synthetic context.

## What "done" means for a feature

1. It works locally with `npm run dev`.
2. It works deployed on Vercel preview.
3. It has at least one console.log or Sentry breadcrumb so we can see when it broke.
4. It does not exceed the cost ceiling.
5. Every number it renders is traceable to a URL in the response payload.
