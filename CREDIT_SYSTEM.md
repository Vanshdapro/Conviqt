# Credit / usage system — how it works & how to keep it enforcing

Conviqt does **not** sell credits to users. The wallet is protected by two
independent layers. If the live site ever feels "unlimited," one of the
operational steps below was skipped — the code enforces both layers.

## The two layers

### 1. Per-user monthly limit (the real product gate)

- **Free:** 5 fresh **deep** analyses per calendar month.
- **Pro ($8/mo):** unlimited fair-use — never metered.

Deep = the expensive ~30–90s runs: `analyze` (Worth Owning / Entry & Exit /
Crowd Check / Bull & Bear), `compare` (Face-Off), `sector_analyze`
(Sector Pulse), `general`, plus Starter Portfolio (allocator) and Portfolio
Health Check (audit). Quick Take and Headline Decoder are **Flash** — fast,
free, never metered (part of the Free promise).

- Counted by the `use_deep_analysis` Postgres RPC (migration **022**), one
  atomic check-and-increment per fresh run. **Cache hits don't count.** Failed
  runs are refunded.
- Wired in: `src/lib/profile.ts` (`useDeepAnalysis`), gated in
  `src/app/api/chat/route.ts`, `.../allocator/route.ts`,
  `.../portfolio/audit/route.ts`. Pro check (`isPremium`) runs FIRST.
- **Fails CLOSED** (changed 2026-06-15): if the meter can't be reached (DB
  outage, or migration 022 not run in this environment), Free users get a
  503 + "try again in a moment" — NOT unlimited access. This is why running
  migration 022 in prod is mandatory: until it exists, every free deep run
  returns 503. Pro users are unaffected.
- Hitting the limit → 402 `plan_limit` → `PaywallSheet`. Meter unreachable →
  503 `meter_unavailable` → retry message (no paywall).

### 2. Global daily $ kill-switch (catastrophic backstop)

- `DAILY_BUDGET_USD` (default **$5/day**) caps total estimated AI spend across
  ALL users per UTC day. Once crossed, every AI route throws "try again
  tomorrow."
- **Now durable** (changed 2026-06-15): the running total lives in the
  `daily_spend` table + `add_daily_spend` RPC (migration **024**), so it
  accumulates globally across Vercel's serverless instances. (The old version
  was an in-process variable that reset on every cold start and never actually
  fired.) `src/lib/rate-limit.ts`.
- Per-IP rate limits (`RATE_LIMITS`) remain a per-instance stop-gap on top.

## Go-live checklist (founder — prod, can't be done from code)

The fix is committed on `rebrand-almanac`. These steps make it live in prod:

1. **Run migration `022_onboarding_subscription.sql`** in the prod Supabase SQL
   editor (creates `analysis_usage` + `use_deep_analysis`). **Almost certainly
   the missing step** behind "no limit." Until done, free deep runs return 503.
2. **Run migration `024_daily_spend.sql`** (creates `daily_spend` +
   `add_daily_spend`).
3. **Set env vars in Vercel prod:**
   - `DAILY_BUDGET_USD` — your real daily ceiling (e.g. `25`). Default is $5.
   - `STRIPE_PRICE_PRO_MONTHLY` — the $8/mo Stripe price id (so Pro can be
     bought; without it everyone is stuck on Free).
   - Confirm `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
     `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` are present.
4. **Stripe:** Pro product + $8/mo price, Billing Portal enabled, webhook live.
5. **Deploy** (`vercel --prod`) — only when you decide to ship.

## Verify it's working (after deploy)

- As a free user, run 5 deep analyses → the 6th shows the paywall (402).
- In Supabase: `SELECT * FROM analysis_usage WHERE month = to_char(now() AT TIME ZONE 'utc','YYYY-MM') ORDER BY deep_count DESC;`
- Daily spend today: `SELECT * FROM daily_spend WHERE day = to_char(now() AT TIME ZONE 'utc','YYYY-MM-DD');`
- If free runs return 503 "try again," migration 022 isn't applied in that env.
