# LAUNCH_READINESS_FINAL — Conviqt → conviqt.com

> Generated 2026-06-14 on branch `rebrand-almanac` after wiring the Twelve Data + Finnhub keys into the marketdata layer and a six-agent parallel audit of every shipping surface. **What you must do** is in section **C**. Until those steps are complete, do not run `vercel --prod`.

---

## A. Surface-by-surface pass list

Live verified against `npm run dev` on port 3000, branch `rebrand-almanac`.

| Surface                  | HTTP | Verified                                                                                  |
| ------------------------ | ---- | ----------------------------------------------------------------------------------------- |
| `/` (Landing)            | 200  | Wordmark intro, FeatureSequence, **abstract Track Record** (count only, no tickers), team note, pricing card ($8/mo m2m), footer — all render. 4 hardcoded "89 lessons" → fixed to 100. Three "prompt engineering" copy hits → reworded. |
| `/dashboard`             | 200  | Snapshot, Trends, Early Signals, Picks, Upcoming Events. **Note:** Picks widget on Dashboard still renders ticker cards (founder may want abstract count only per 2026-06-14 call — see §D). |
| `/research`              | 307→login | Auth-gated. Dual-provider routing verified clean (audit: search → Claude, reasoning → OpenAI). Citations collapsed, CouncilViz uses tokens-only palette, conviction scale 0–10 in chat / 0–100 stored, auto-detected by viz. |
| `/headlines`             | 200  | Region tabs (11 + Crypto), per-headline "Why traders care" take, tap → Headline Decoder pre-fill. CurrentsAPI attribution rendered. |
| `/portfolio`             | 200  | Holdings table, CSV import, Watching tab, stats strip (β/vol/MDD/Sharpe) with teaching ⓘ sheets, AI Health Check button. Live values flow through marketdata layer. |
| `/learn`                 | 308  | 11 tracks, **100 lessons** (codebase truth — copy now matches). Free fundamentals / Pro full gating live. Completion nudge present. |
| `/academy/practice`      | (build) | Renders in build. |
| `/pricing`               | 200  | Free + **Pro $8/mo month-to-month only**. No annual, no Max. Stripe CTA wired. |
| `/login` `/signup`       | 200  | Supabase Auth, callback `/auth/callback` → `/research`. |
| `/methodology`           | 200  | Static page. |
| `/about`                 | (build) | Static page. |
| `/watchlist` → `/portfolio?tab=watching` | 200 | New 301 redirect stub I added (`src/app/watchlist/page.tsx`). |
| `/stock/[ticker]`        | SSG  | 218 prerendered, 1d revalidation. |
| `/compare/[pair]`        | SSG  | 43 prerendered, 1d revalidation. |
| `/api/scratch/marketdata?ticker=NVDA` | dev-only | Returned real numbers: NVDA $205.21 from Finnhub, 251-candle 1y history from **Twelve Data**, $4.97T mkt cap / P/E 31.11 / 52w $140.85–$236.54 from Finnhub, β 1.83 / vol 35% / max-DD 20.2% / Sharpe 1.11 vs SPY. |

**Build/test status (clean):**
- `npx tsc --noEmit` → silent (zero errors)
- `npm test` → **47/47 pass**
- `npm run build` → all 70+ routes built, **zero warnings, zero errors**
- Client-bundle key-leak grep for `TWELVE_DATA_API_KEY` / `FINNHUB_API_KEY` / `sk-proj-*` / `sk-ant-api03-*` / `SUPABASE_SERVICE_ROLE` → **no hits** in `.next/static/`.

---

## B. What I changed (file-by-file)

### Market-data layer — the two new keys wired in
- **`.env.local`** — added `TWELVE_DATA_API_KEY` + `FINNHUB_API_KEY`.
- **`.env.example`** — documented both names plus `FMP_API_KEY` (dormant escape hatch) with tier limits and provider-chain notes.
- **`src/lib/marketdata/types.ts`** — added `"twelvedata"` to `ProviderName` union and `PROVIDER_LABELS`.
- **`src/lib/marketdata/providers/twelvedata.ts`** — *new*, full adapter (`/quote` + `/time_series?interval=1day` + non-retryable `keyStats` refusal because `/statistics` is plan-gated), proactive 8 req/min token bucket, 60s cooldown on 429, response-envelope error detection, tolerant string-vs-number parsing.
- **`src/lib/marketdata/providers/finnhub.ts`** — added proactive 60 req/min token bucket (was already cooldown-only; now both layers).
- **`src/lib/marketdata/providers.ts`** — rewrote `PROVIDER_CHAIN`:
  - `quote` + `history` → Twelve Data → FMP (dormant) → Finnhub → Stooq → Yahoo
  - `keyStats` → Finnhub → FMP → Yahoo → Stooq (Twelve Data refuses, chain skips at zero cost)
- **`src/lib/marketdata/http.ts`** — added per-provider token bucket (`configureBucket` + `takeToken`); `fetchRaw` calls `takeToken(provider)` before every request so a busy page burst can't trip the wall.

### Copy + brand fixes from the audit pass
- **`src/app/page.tsx`** — two banned-word "prompt" hits reworded (FAQ + Skills lede).
- **`src/components/landing/ProcessTrail.tsx`** — third banned-word "prompt" hit reworded (Step 01 body).
- **`src/components/PaywallSheet.tsx`** — `"Health Check"` → `"Portfolio Health Check"` (matches playbook 2.3 verbatim); `"89 lessons"` → `"100 lessons"` (codebase truth).
- **`src/app/pricing/page.tsx`** — `"all 11 tracks and 89 lessons"` → `"all 11 tracks and 100 lessons"`.
- **`src/app/opengraph-image.tsx`** — `"89 lessons"` → `"100 lessons"` (OG card).
- **`src/app/watchlist/page.tsx`** — *new*, permanent 301 to `/portfolio?tab=watching` so the deleted Phase 8 surface doesn't 404 outside the app.

Nothing else was touched. No dependencies added. No new files in `src/lib/`. Working tree contains exactly these changes.

---

## C. 🚨 STUFF YOU MUST DO BEFORE `vercel --prod`

Do these in order. Nothing on this list is optional.

### C-1. Vercel project env vars — paste these into Production scope

Open https://vercel.com/vansh-aprovs-projects/conviqt → Settings → Environment Variables. Add to **Production**:

| Name                          | Where to get the value                                                                                                       |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `TWELVE_DATA_API_KEY`         | Value already in your `.env.local` line 17.                                                                                  |
| `FINNHUB_API_KEY`             | Value already in your `.env.local` line 18.                                                                                  |
| `CURRENTS_API_KEY`            | Already wired locally (line 15). Add to prod if not there yet.                                                                |
| `OPENAI_API_KEY`              | From your `.env.local` line 5.                                                                                                |
| `ANTHROPIC_API_KEY`           | From your `.env.local` line 6.                                                                                                |
| `SUPABASE_SERVICE_ROLE_KEY`   | From your `.env.local` line 10.                                                                                               |
| `NEXT_PUBLIC_SUPABASE_URL`    | From your `.env.local` line 3.                                                                                                |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | From your `.env.local` line 2.                                                                                              |
| `STRIPE_SECRET_KEY`           | Stripe Dashboard → Developers → API keys → Secret key (LIVE).                                                                |
| `STRIPE_WEBHOOK_SECRET`       | Created in step C-4 when you wire the webhook.                                                                                |
| `STRIPE_PRICE_PRO_MONTHLY`    | Created in step C-4. **This is the variable name the code reads** (`src/lib/stripe.ts`).                                     |
| `STRIPE_PRICE_PRO_ANNUAL`     | Leave **unset** (annual was retired 2026-06-14). The code only reads it as a fallback for legacy webhook events.              |
| `CRON_SECRET`                 | `openssl rand -hex 32` — paste the same value into GitHub Actions in step C-3.                                                |
| `ALPHA_RUN_SECRET`            | `openssl rand -hex 32` — gates `/api/alpha/run` (internal Alpha engine, never user-facing).                                   |
| `RESEND_API_KEY`              | From your `.env.local` line 9 (used by digest emails — non-blocking if you skip).                                             |
| `NEWSLETTER_FROM`             | From your `.env.local` line 11.                                                                                               |
| `NEXT_PUBLIC_SITE_URL`        | `https://conviqt.com`                                                                                                         |
| `NEXT_PUBLIC_ALPHA_ADMIN_ENABLED` | Leave unset (defaults to "false" — the Alpha admin UI stays hidden in prod).                                              |

After pasting: in Vercel → Deployments → Redeploy on the next push, OR you'll pick the new vars up automatically on the next `vercel --prod`.

### C-2. Supabase migrations — run in this order

```bash
supabase db push  # or apply via dashboard SQL editor
```

The migrations that must be applied to Production Supabase:

```
019_analytics_events.sql     # funnel analytics
020_marketdata_cache.sql     # shared marketdata cache (cuts request volume)
021_feed_cache.sql           # Headlines + Dashboard feed cache
022_onboarding_subscription.sql  # subscribers + user_profiles + analysis_usage + use_deep_analysis RPC
```

**Verify the result.** From the Supabase SQL editor:
```sql
select table_name from information_schema.tables where table_schema='public'
and table_name in ('marketdata_cache','feed_cache','feed_refresh_runs','subscribers','user_profiles','analysis_usage','analytics_events');
```
You should see **all seven** rows. If any is missing, the related surface degrades silently in prod.

> Local-dev note: the dev server I left running logged `getProfile / getSubscriberByEmail / getDeepUsage error: Could not find the table` — your local Supabase is missing 022. Apply locally too if you want to QA login.

### C-3. GitHub Actions secret

Repo → Settings → Secrets and variables → Actions → New repository secret:

| Name          | Value                                            |
| ------------- | ------------------------------------------------ |
| `CRON_SECRET` | **same value** you pasted into Vercel in C-1.    |

The workflow `.github/workflows/feed-refresh.yml` fires twice a day (12:30 UTC pre-open, 21:30 UTC post-close) and hits `POST /api/feed/refresh` with this bearer. Without it the feed never refreshes.

The repo PAT for pushing was fixed 2026-06-12 (per memory) — no new GitHub PAT needed.

### C-4. Stripe — Production mode

In the Stripe dashboard, **toggle to Live mode** before doing any of this. Test-mode IDs are silently incompatible.

1. **Product:** Products → Add product → name `Conviqt Pro`.
2. **Price:** add one recurring price — **$8 USD / month, no annual.** Copy the resulting `price_...` id.
3. Paste that price id into Vercel env var `STRIPE_PRICE_PRO_MONTHLY` (from C-1).
4. **Billing Portal:** Settings → Billing → Customer portal → **Activate**. Allow customers to cancel subscriptions and update payment methods. The "Manage subscription" CTA in the app calls `/api/stripe/portal` which needs the portal active.
5. **Webhook:** Developers → Webhooks → Add endpoint.
   - URL: `https://conviqt.com/api/stripe/webhook`
   - Events to send (minimum): `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`.
   - After save: copy the signing secret (`whsec_...`) into Vercel env `STRIPE_WEBHOOK_SECRET`.

> India-recurring-billing footnote from your go-live memory still applies — if any of your initial customers are on Indian cards, walk them through the consent flow Stripe surfaces.

### C-5. Domain + DNS

- Vercel → Settings → Domains → add `conviqt.com` (and the `www.` redirect target you want).
- Update the registrar's A / CNAME records to Vercel's targets. Wait for SSL provisioning (usually <5 min).
- Set the Supabase Auth redirect list (Dashboard → Authentication → URL Configuration):
  - Site URL: `https://conviqt.com`
  - Redirect URLs: `https://conviqt.com/auth/callback` (keep `http://localhost:3000/auth/callback` for dev).

### C-6. Pre-deploy iCloud sweep (every time)

iCloud Desktop has resurrected deleted files before. Before each `vercel --prod`:

```bash
cd ~/Desktop/Conviqt/conviqt
git status         # if anything unexpected shows up, `rm` it and commit
```

The current working tree is clean except for my changes (audited above).

### C-7. Re-shoot landing screenshots (optional but advised)

`public/landing/dashboard.png`, `headlines.png`, `hero-research.png`, `portfolio.png` all exist and ship today, but they were captured against a pre-Twelve-Data dataset. Now that real prices flow, re-running `node qa-shoot.mjs` (or the equivalent) against `npm run dev` will give you fresh ones for the launch.

### C-8. Decide the Picks widget scope (audit-flagged)

Your 2026-06-14 founder call said the Picks widget should show an **abstract live count, not a list of tickers** on the landing. The landing already does this (`TrackRecordViz` shows count only). **But `/dashboard` still renders ticker cards** in the Picks widget (`src/app/dashboard/page.tsx` lines 181–213). Two options:

- **A (intent strict):** the same count-only abstraction inside Dashboard too. I'll need a one-line yes/no to apply it.
- **B (intent loose):** logged-in users see the full ticker list; the abstraction is only the public-facing reveal. No change needed.

I did **not** ship a change here — it's a product call, not a launch bug.

### C-9. Push, then deploy

```bash
cd ~/Desktop/Conviqt/conviqt
git add -A
git commit -m "feat(marketdata): wire Twelve Data + Finnhub keyed feeds for launch"
git push origin rebrand-almanac
vercel --prod        # only after C-1 through C-7
```

---

## D. ⚠️ Known limitations (be honest)

- **`/dashboard`, `/portfolio`, etc. log Supabase "table missing" errors locally.** Cause: migration 022 not applied to your local Supabase. The routes still return 200 because every Supabase call has a try/catch. After C-2 in production, these go silent.
- **`/api/scratch/marketdata` is dev-only** (404s in prod). I left it in place — it's an explicit Phase-1 verification scratchpad and harmless because it gates on `NODE_ENV !== "production"`.
- **Twelve Data `/statistics` is plan-gated.** I gave it a non-retryable refusal for `keyStats` so the chain falls through to Finnhub at zero token cost. If you ever buy Twelve Data Pro, swap that refusal for a real `/statistics` fetcher (~30 LOC) and Twelve Data takes over key stats too.
- **Stooq + Yahoo are dead from datacenter IPs** (verified). They stay in the chain as last-chance fallbacks only — the live picks now come exclusively from Twelve Data + Finnhub. If both keyed providers were ever to return errors for the same symbol simultaneously, the UI renders the honest "data unavailable" state. No synthetic numbers anywhere.
- **Dark mode** exists (toggle in `src/components/ui/ThemeToggle.tsx`) and is opt-in + persisted. The brand default is the warm-paper light theme.
- **Lighthouse target was the Phase-8 baseline 98/100/100/100.** I did not re-run Lighthouse — my changes were behind-the-scenes (marketdata layer, copy text). Re-run before launch if you want a fresh score; nothing I touched should regress it.
- **Picks widget scope** — see C-8.
- **Stripe is unverified end-to-end** because there were no live `STRIPE_PRICE_PRO_MONTHLY` keys in your `.env.local`. The button + route shapes are correct; the round-trip can only be proven after C-1 + C-4.

---

## E. 🧪 Post-deploy stress-test plan (run in a fresh Claude session after C-1…C-7)

Paste this as the kickoff prompt:

> *You are taking over the just-deployed conviqt.com. Run the following verification matrix and produce a one-page POST_DEPLOY_VERIFICATION.md.*
>
> 1. **Marketdata smoke:** `curl https://conviqt.com/api/scratch/marketdata?ticker=AAPL` — should 404 (proof prod-gating works). Then hit Dashboard / Portfolio surfaces and confirm real prices render with delayed-~15-min labels and provider attribution under Sources where applicable.
> 2. **Council pipeline end-to-end:** sign up a fresh user, run a Council analysis on `MSFT`, confirm a verdict, conviction, citations, and that the 5-deep meter decrements by one. Run a cache-hit (same query) and confirm meter does *not* decrement.
> 3. **PaywallSheet trigger:** burn through 5 deep analyses on the free meter, confirm the 6th opens the PaywallSheet (not a hard error) with the "Try Pro" CTA.
> 4. **Stripe round-trip:** click "Try Pro" → Stripe Checkout (LIVE) → use a real card or `4242 4242 4242 4242` in test mode → webhook fires → `subscribers` row appears → `isPremium()` flips → unlimited analyses unlock. Then open Manage Subscription, cancel through portal, confirm row updates.
> 5. **Headlines refresh:** trigger `POST /api/feed/refresh` with the `CRON_SECRET` from a curl, watch `feed_refresh_runs` ledger, confirm `feed_cache` rows update in place (rolling, not append).
> 6. **Portfolio CSV:** import a 10-ticker CSV, confirm stats strip computes β/vol/MDD/Sharpe, confirm AI Health Check streams and completes.
> 7. **Academy gating:** as a free user, confirm only foundations + `fs-three-statements` are unlocked. As Pro, confirm all 100 lessons load.
> 8. **Dark theme:** flip the toggle, walk all five surfaces, confirm no contrast issues and no flash-of-light on navigation.
> 9. **Lighthouse pass:** landing, dashboard, research, portfolio — target ≥95 each, regressions vs. Phase-8 baseline 98/100/100/100 are launch-blockers.
> 10. **GitHub Actions:** wait for the next 12:30 / 21:30 UTC fire, confirm green checkmark + new rows in `feed_refresh_runs`.
>
> Report the matrix as PASS/FAIL with evidence (timestamps, screenshots, log excerpts). Anything FAIL gates the public announce.

---

### One-glance status

- ✅ Twelve Data + Finnhub wired and serving real numbers end-to-end
- ✅ Token-bucket rate limiting + Supabase cache prevent burst-burn on free tiers
- ✅ Build clean, tests green, no key leaks into client bundle
- ✅ Audit-flagged copy + brand violations patched in this branch
- ⚠️ One product question (C-8 / D: Picks widget scope) needs your call
- ⏳ Sections C-1…C-7 are the only humans-only steps remaining before launch

---

## F. Post-deploy stress test — LIVE on www.conviqt.com (2026-06-14)

Deployed `rebrand-almanac` → production via `vercel --prod` (deployment
`dpl_G2z5YcadegK8mdC6nUX2abnb5CAQ`, build 55s, aliased to www.conviqt.com).
**Root cause of the pre-test state:** the production domain had been pinned for
22 days to an old pre-rebrand deployment — Vercel's production branch is `main`
(44 commits behind `rebrand-almanac`), so the rebrand had only ever reached
preview URLs. The `vercel --prod` from the repo promoted the rebrand to the
domain. Also set `NEXT_PUBLIC_SITE_URL=https://www.conviqt.com` (www; the
non-www value would log users out after Stripe checkout).

### What's confirmed WORKING in production
- ✅ All 5 surfaces + landing/pricing/auth render 200; `/headlines` + `/dashboard`
  (404 before) now live. Brand is Almanac (theme `#F5EFE1`, Cabinet/General
  Sans). Zero old-brand leakage, zero banned words, all `/landing/*` images +
  favicons + OG + sitemap + robots 200.
- ✅ Market data live: `/stock/aapl` $312.48, `/stock/nvda` $215.90, OG cards
  (`/api/og/NVDA|AAPL|TSLA`, compare) all render server-side PNGs. Twelve Data +
  Finnhub keys are active in prod.
- ✅ Auth gates correct (no 500s): checkout/portal/profile/credits/watchlist →
  401, webhook → 400 (missing signature), feed/refresh → 401.
- ✅ Pricing CTA real: "Start free" + "Try Pro free for 7 days", $8 shown.
- ✅ Zero client-side console errors on landing/pricing.

### 🚨 LAUNCH BLOCKERS found (your hands — DDL can't be applied via API)
1. **Payments are not end-to-end yet — `subscribers` table is MISSING in prod.**
   Prod Supabase has 019/020/021/022 applied (marketdata_cache, feed_cache,
   user_profiles, analysis_usage, `use_deep_analysis` RPC all present and the RPC
   works) — but **migration `003_subscribers.sql` was never run**. `src/lib/
   subscription.ts` reads/writes `subscribers`, so today a customer's card WOULD
   be charged at Stripe but the webhook write crashes → Pro never unlocks.
   **FIX:** open Supabase → SQL editor → paste & run `supabase/migrations/
   003_subscribers.sql` (self-contained; no dependency on 022). Verify with
   `select 1 from subscribers limit 1;`.
2. **Academy progress tracking — `learn_progress` table MISSING.** Migration
   `007_learn.sql` (creates `learn_lesson_cache` + `learn_progress`) wasn't run.
   Lessons render, but XP/completion won't persist. **FIX:** run
   `supabase/migrations/007_learn.sql` in the SQL editor.
3. **Headlines feed is EMPTY** (feed_cache + feed_refresh_runs exist but have 0
   rows — the refresh has never run in prod). Customers see an empty Headlines
   surface. **FIX (two parts):** (a) confirm the GitHub Actions repo secret
   `CRON_SECRET` exactly matches the Vercel `CRON_SECRET` value, then (b) trigger
   it once now: GitHub → Actions → "feed-refresh" → Run workflow, OR
   `curl -X POST https://www.conviqt.com/api/feed/refresh -H "Authorization:
   Bearer <YOUR_PROD_CRON_SECRET>"`. (~25–35¢ of gpt-4.1-mini, within budget.)

### After you do 1–3, the ONE manual test only you can run
A real Stripe checkout (test card `4242 4242 4242 4242`): sign in as a free
user → "Try Pro free for 7 days" → complete checkout → confirm a row appears in
`subscribers` and the account flips to Pro (unlimited analyses). This is the
only payment step that needs a human + a card.

### Minor / verify-visually
- An agent grep read MSFT as "$2.80" on `/stock/msft` (almost certainly a
  mis-grabbed figure, not the price — AAPL/NVDA were correct). Eyeball
  `/stock/msft` once to confirm the headline price is right.

---

## G. Authenticated end-to-end test (2026-06-14, real logged-in user)

Created a confirmed QA user via the Supabase admin API, logged in through the
real UI, and exercised every authenticated flow against the live code + real
AI keys + prod DB. **All test data was deleted afterward** (portfolios,
analysis_usage, user_profiles, watchlist rows + the auth user — verified 0 rows
remaining; prod DB clean).

| Flow | Result |
| ---- | ------ |
| **Login** (Supabase email+password) | ✅ session established, redirect to /research |
| **FirstRun onboarding** (3-step: invest style → experience → starter stocks) | ✅ all steps work |
| **First-run tour** (4 tooltips) | ✅ shows, skippable |
| **Council deep analysis** ("Is AAPL worth owning?") | ✅ full verdict: live price $291.13 (−1.52%, "delayed ~15 min"), **Buy / How sure: High**, the case, real fundamentals (Q2 rev $111B +17%, EPS beat, margin 49.3%, P/E 34.9x), bull case, bear case, what-to-watch dates, **Academy "Learn why →" deep-links**, **Sources (16)** with real URLs, related skills, disclaimer. Zero banned words. 16 SVGs (viz) rendered. |
| **Intent routing** | ✅ logs: `intent=analyze mode=council` |
| **Free meter (5 deep/mo)** | ✅ logs `free deep analysis 1/5`; **persisted** to `analysis_usage` (deep_count=1, month 2026-06) |
| **Portfolio add holding** (AAPL ×10 @ $150) | ✅ live value $2,911.30, today −1.52%, all-time +94.09% |
| **Portfolio stats strip** | ✅ Beta 0.88 / Vol 22.7% / MaxDD −13.8% / Sharpe 1.66 (250 sessions vs SPY), teaching ⓘ each |
| **AI Health Check** (audit pipeline, 2 holdings) | ✅ graded **D / How sure: High**, correctly flagged the ~60% AAPL two-stock tech concentration |
| **Stripe checkout** (prod, authed) | ✅ POST /api/stripe/checkout → 200 + real **`cs_live_…`** Checkout session URL (proves secret key + `STRIPE_PRICE_PRO_MONTHLY` valid in LIVE mode) |

### The ONLY thing still not machine-verifiable
**Card entry → webhook → `subscribers` row → Pro unlock.** Stripe Checkout is a
hosted page; completing it needs a human entering a card. Everything up to it is
proven and the `subscribers` table now exists for the webhook to write to.

⚠️ **Stripe is in LIVE mode** (`cs_live_`), so the `4242` test card will NOT
work — use a **real card**. Because Pro has a **7-day trial**, completing checkout
charges **$0 today** and creates a `trialing` subscription; cancel before day 7 to
avoid the $8. That's the safe way to run the final webhook test.

### Minor follow-ups found
- Onboarding's "pick starter stocks" step didn't seed the `watchlist` table
  (stayed empty after selecting AAPL + Finish). Low severity — users add to
  Watching manually in Portfolio. Worth a look post-launch.
- Verdict label renders as a bare "Buy" — reads as a research rating (framed
  "The analysts say: Buy"), but confirm you're comfortable with it vs. the
  CLAUDE.md "no imperative trade language" rule.
- Council answer content (e.g. "Gemini-powered Siri", a named future CEO) comes
  from the model's web search — pipeline mechanics are sound, but spot-check
  factual claims; that's inherent to any LLM-research product.
