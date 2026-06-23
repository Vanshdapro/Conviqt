# The Map & The Radar — build plan (the Lens trilogy)

> **Conviqt = situational awareness for your money.** Three surfaces of one idea:
> **The Map** (what the market is doing) → **The Lens** (what it means for *your*
> money — **BUILT**) → **The Radar** (what's coming next).
>
> All three run on the cheap **DeepSeek path** in `src/lib/openai.ts`
> (`MODELS.lens` = V4 Flash, `MODELS.lensPro` = V4 Pro + reasoning), **fed data we
> already fetch** (`marketdata` + Currents) — no web_search. Honest orientation,
> **never alpha/prediction** (see Honesty guardrail). **No new top-level surfaces**
> — CLAUDE.md locks the app to 5.

## Status
- ✅ **The Lens** — built. Medium-term + per-stock daily read + on-demand deep
  thesis (Pro + visible reasoning + sources). Lives in **Portfolio**.
  Files: `src/lib/lens/{types,generate,store,thesis}.ts`,
  `src/app/api/portfolio/{brief,thesis}/route.ts`,
  `src/components/portfolio/LensPanel.tsx`, migration `028_lens_daily_brief.sql`.
- ⬜ **The Map** — partially exists as the Dashboard feed. Plan below.
- ⬜ **The Radar** — partially exists as Dashboard "Upcoming Events". Plan below.

## Surface mapping (respect the 5-surface rule)
| Piece | Lives in | Audience | Gate |
|---|---|---|---|
| The Map | **Dashboard** (home market view) | everyone | Free (top-of-funnel) |
| The Lens | **Portfolio** (done) | holders | Pro (daily read + deep thesis) |
| The Radar | **Dashboard** (market) + **Portfolio** (personal) | both | Free market / Pro personal |

## Honesty guardrail (load-bearing — do not break)
Orientation, never alpha. The Map says *"capital has rotated **into** energy this
month, here's the story"* — never *"buy energy."* The Radar says *"NVDA reports
Tuesday; here's what's at stake and what each outcome would mean for your book"* —
never *"NVDA will beat."* No predictions sold as edge. (Selling alpha is
unsellable + off-brand; this is the whole strategic thesis.)

---

## THE MAP — "what the market is doing, and where the money is moving"

**Problem.** Retail has no honest, plain-English read on what's actually moving
across markets over a meaningful horizon. News is noise; terminals are jargon.

**What exists.** `src/lib/feed/` generates the Dashboard today: `DashboardContent`
= 3 trends + 3 signals + events, on `gpt-4.1-mini` + web_search, cached in
`feed_cache`, refreshed 2×/day (GitHub Actions `feed-refresh.yml`, behind
`CRON_SECRET`). Rendered at `/dashboard`. It's surface-level and day-shaped.

**The upgrade — a medium-term market map:**
1. **Sector/theme rotation (deterministic).** Pull 1w/1m/3m returns for a fixed
   set of sector ETFs (XLK, XLF, XLE, XLV, XLY, XLP, XLI, XLU, XLB, XLRE, XLC) +
   SPY/QQQ/IWM via `marketdata.history`. Compute leaders/laggards over weeks =
   "where capital is rotating," honestly, from price (no web_search, no
   hallucinated fund-flow numbers).
2. **The story (DeepSeek).** One `MODELS.lens` call fed the sector table +
   Currents macro headlines + existing feed events → plain English: what's
   leading, what's lagging, the narrative, what to watch.
3. **Optional deep "market thesis"** (`MODELS.lensPro` + reasoning) — the
   market-wide analogue of the Lens deep thesis, on-demand.

**Data / model / cost.** Data = `marketdata.history` on ~14 ETFs (free/cached) +
Currents + feed events; no FMP needed. Model = `MODELS.lens` (Flash), **global +
cached + shared by all users → ~$0/user**; dropping web_search makes it cheaper
than today and keeps it under the $0.35 feed ceiling. Deep market thesis =
`MODELS.lensPro`, on-demand.

**Gating / cadence.** FREE (top-of-funnel, the ad engine). Refresh daily (reuse
the feed cron). Globally cached.

**Build steps.**
1. `src/lib/map/sectors.ts` — ETF universe + deterministic 1w/1m/3m rotation
   table (reuse the Lens `closeNAgo`/`pctFrom` helpers from `lens/generate.ts`).
2. `src/lib/map/generate.ts` — clone the Lens `generate.ts` pattern: feed sector
   table + news + events → `MODELS.lens` → `MarketMap` (leaders, laggards,
   narrative, watch). New `src/lib/map/types.ts` (or extend `feed/types.ts`).
3. Persist in `feed_cache` (reuse `feed/store.ts`); add to `POST /api/feed/refresh`.
4. Render in `/dashboard` (extend the existing surface; reuse `cvq-*` tokens).
5. Cross-link: "See what this means for your money → Portfolio (the Lens)."

---

## THE RADAR — "what's coming, what's at stake, what it means for you"

**Problem.** People get blindsided by events (Fed, CPI, earnings) and don't know
what's at stake or what each outcome means for what they own.

**What exists.** Dashboard "Upcoming Events" (`FeedEvent`: earnings/fed/macro
dates). Watchlist tracks next-earnings dates; `src/lib/earnings.ts` exists. The
Lens already emits a forward-looking `watch` list + a `flagged` receipts thread.

**The build — two layers:**
1. **Market-wide Radar (free, Dashboard).** Upcoming market-moving events
   (Fed/CPI/jobs + big earnings), each with **what's at stake** + **what each
   outcome would mean** — honest framing, not a prediction. One `MODELS.lens`
   call over the event list + context, cached, shared.
2. **Personalized Radar (Pro, Portfolio — woven with the Lens).** "What's coming
   for *your* holdings" — your stocks' earnings dates, events touching your
   sectors — each with what's at stake for your book. **Seeds the Lens `watch`
   list; when an event resolves, it ages a Lens `flag` (the receipt).** This is
   the retention hook — a reason to come back *before* the event.

**Data / model / cost.** Data = `src/lib/earnings.ts` + watchlist earnings dates
+ `FeedEvent` (Fed/macro) + marketdata. (Confirm earnings source: FMP earnings
calendar if `FMP_API_KEY` is set, else the existing `earnings.ts`.) Model =
`MODELS.lens` (Flash); market-wide shared/cached (~$0/user), personalized
per-user + cached + Pro-gated.

**Gating / cadence.** Market-wide events FREE (Dashboard). Personalized "what's
coming for your holdings + what it means" = **Pro** (part of the Lens
subscription value — the retention driver). Refresh daily / on portfolio change.

**Build steps.**
1. `src/lib/radar/events.ts` — gather upcoming events for a ~2-week horizon
   (earnings via `earnings.ts`/FMP + Fed/macro from feed).
2. `src/lib/radar/generate.ts` — `MODELS.lens` → per-event "stakes + what each
   outcome means." Market-wide + a per-portfolio variant (filtered to the user's
   tickers/sectors).
3. Market-wide → `feed_cache` + Dashboard. Personalized → reuse the `lens_*`
   storage pattern (migration like `028`) + a Portfolio section beside the Lens;
   `POST /api/portfolio/radar` (Pro-gated, mirrors `/brief`).
4. Wire Radar → Lens: Radar items populate the Lens `watch`; resolved events age
   Lens `flags`. **This closes the loop that makes Conviqt sticky.**

---

## Shared engine (all three)
- **AI:** DeepSeek path in `src/lib/openai.ts` (`MODELS.lens` / `lensPro`), fed
  data, no web_search → cheap + one consistent voice. Routed by `usesOpenRouter()`.
- **Data:** `src/lib/marketdata` (quote/history/keyStats) + `src/lib/news/currents`
  + `src/lib/feed` cache.
- **Storage:** `feed_cache` for global/shared (Map, market Radar); per-user tables
  (the migration-028 pattern, RLS service-role only) for personalized (Lens,
  personal Radar).
- **Copy:** plain English, no jargon, no buy/sell, conviction as a word (CLAUDE.md).

## The loop (why this is sticky)
**Map** (free, what the market is doing) pulls users in → **Lens** (Pro, what it
means for *your* money) converts → **Radar** (what's next for your money) gives a
reason to return → resolved events become **receipts** in the Lens ("we flagged
X, here's how it aged") → trust compounds. Map = acquisition, Lens = conversion,
Radar = retention.

## Open decisions
1. **Map model:** migrate the existing Dashboard feed off `gpt-4.1-mini`+web_search
   onto the DeepSeek + fed-data path (recommended — cheaper, consistent), or leave
   the current feed and add the Map layer beside it?
2. **Earnings source** for the Radar: `earnings.ts` (free) vs require `FMP_API_KEY`
   for a fuller calendar?
3. **Radar horizon:** 1 vs 2 weeks; how many events to surface.
4. **Deep "market thesis"** for the Map — build now or later?

## Guardrails
- No new top-level surfaces (CLAUDE.md = 5).
- No alpha/prediction framing — orientation only.
- No deploys until the founder says ship. Per-user features need: migration
  applied in Supabase, `OPENROUTER_API_KEY` in Vercel prod, key rotated.
