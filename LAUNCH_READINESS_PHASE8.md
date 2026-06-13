# Conviqt — Phase 8 Launch-Readiness Report

**Branch:** `rebrand-almanac` · **Date:** 2026-06-13 · **Scope:** Phase 8 — Academy weave, retirement sweep, full QA, SEO, security & code review.

Phase 8 is the final build phase of the ALMANAC rebrand. This report is the go/no-go record: what shipped, how it was verified, and exactly what remains before `vercel --prod`.

> **Status: code-complete and green.** All local gates pass. Ship is gated only on the prod-infra checklist in §7 (migrations + env vars) — none of which is code.

---

## 1. Executive summary

| Gate | Result |
|---|---|
| Production build (`next build`) | ✅ 289 routes compiled clean |
| Typecheck (`tsc --noEmit`) | ✅ 0 errors |
| Unit tests (`npm test`) | ✅ 47/47 pass (incl. learnLinks + statInfo drift tests) |
| Lighthouse — landing (desktop) | ✅ **Perf 98 · A11y 100 · Best-practices 100 · SEO 100** |
| Every surface renders (16 surfaces × mobile 390px + desktop) | ✅ all HTTP 200, zero console errors |
| Retired routes | ✅ pages 308-redirect, APIs 404 |
| Banned machinery words in rendered copy | ✅ none |
| Non-token colors in shipped code | ✅ none (tokens + email/OG literals only) |
| WCAG AA on pills / accent / muted ink | ✅ math-verified, tokens adjusted |
| Security review | ✅ no findings |
| Code review (high) | ✅ 2 cleanup findings, both fixed; 0 correctness/security bugs |

Net diff vs Phase 7 (`f5ae247`): **107 files, +1,617 / −8,634** — a deletion-heavy phase, as a retirement should be.

---

## 2. What shipped

### Academy weave (`bed7124`)
- **Restyled to Almanac tokens, content untouched.** The dark-navy palette across `learn/`, `academy/`, and `practice/` was mapped to warm-paper tokens; alpha-suffixed hex tints (`${c}1f`) became `color-mix()`; mono labels became General Sans; gradient washes were removed from page wrappers (gradient-as-art is banned).
- **Free-fundamentals / Pro-full gating** replaced the per-lesson credit unlock. `FREE_LESSON_IDS` now = the whole Foundations track + the financial-statements opener; everything else needs Pro. `/api/learn` gates on `isPremium()`. Credit-era one-off unlocks are honored forever (the `learn_unlocks` read survives). The spend route (`/api/learn/unlock`) and RPC call paths were deleted; `PaywallSheet` was parameterized for the Academy's "part of Pro" copy.
- **"Learn why →" deep links** (from analysis answers) and **Portfolio stat ⓘ → lesson** hand-offs were already wired; the deep-link opener now waits for plan state before opening so a Pro lesson opens directly instead of bouncing off the paywall.
- **Lesson completion nudge:** after the quiz, a **"Try it on a real stock →"** button sends the reader back to Research pre-filled with the lesson's example ticker. All lesson links now point at `/research` (not the retired `/chat`).

### Retirement sweep (`61fb7e6`, `851ccea`)
- **Deleted:** `/developers`, `/v1/analyze`, `/api/keys`, `/cdi` (+`/api/cdi`), `/newsletter` (+4 API routes), `/api/translate`, the i18n components, `lib/cdi` + newsletter libs, the legacy `/alpha` page + `AlphaGate`, and the legacy v1 research sub-pages (`/research/allocator`, `/research/portfolio`) with their component clusters.
- **301s** (Next emits 308 — Google treats it identically): `/developers`, `/cdi`, `/newsletter`, `/index` → `/`; `/alpha` → `/dashboard`; `/research/allocator` → `/research`; `/research/portfolio` → `/portfolio`; `/watchlist` → `/portfolio?tab=watching`.
- **Engines that stay:** the Alpha engine (`/api/alpha/*`) still powers the Dashboard's public track record — only the user-facing `/alpha` *page* retired. The allocator/audit *skills* still run from the Research Skills sheet — only their standalone v1 pages retired. CDI's gauge concept is available to live on as a Dashboard widget (not built this phase; no surface references it).
- `layout.tsx` dropped `TranslationProvider` and the Noto CDN font links; `AppShell` nav/shell-prefixes dropped `/cdi` and `/alpha`; Stripe dev plans are no longer purchasable (webhook still honors any live legacy subscription).
- **⚠️ Resurrection caught:** the swept files reappeared on disk as untracked after the commit (the Desktop is iCloud-synced — note the `600` perms). `/api/cdi`, `/api/keys`, `/api/translate`, `/api/newsletter` have **no redirect covering `/api/*`** and would have shipped **live**. Re-deleted and re-verified (pages 308, APIs 404). **See §8 — this is a real ship-time risk.**

### Light-theme sweep + WCAG AA (`4f242ff`, `dae1830`)
- `globals.css` became a **legacy-variable bridge**: old dark var names (`--background`, `--surface`, `--bull`…) now resolve to Almanac tokens, so pre-rebrand pages inherit the warm theme without a rewrite. `gradient-text`/`glow`/`glass` were neutered to flat warm equivalents; reveal motion tightened to the ≤220ms budget.
- `about` / `methodology` / `AuthShell` / `CouncilReport` literals → tokens; watchlist alert email → warm-paper literals (emails can't read CSS vars); OG brand palette synced.
- **WCAG AA on real math:** `--down-ink` `#C0473D→#AF4138` (4.53:1 on pills), `--accent` `#0E7C7B→#0E7978` (4.55:1 as text on paper), `--text-muted` `#8A7866→#7A6A5A` (4.54:1). Minimal in-hue shifts, mirrored in tokens / OG / email / CLAUDE.md. Up/down pills always pair color with a ▲▼ arrow, so meaning never relies on hue.

### Copy + SEO (`0683cb0`)
- Banned machinery words removed from rendered copy: "agents"/"disagreement score"/dead-API refs → plain English ("analysts", "how sure the team is"). About-page audience corrected from "investors, not beginners" to the real beginner-to-intermediate audience.
- `sitemap.ts`: dropped `/cdi`, `/developers`, `/alpha`; added `/academy/leaderboard`. `robots.ts`: `/dev/` disallowed. Layout keywords: "alpha tracker" → "stock track record".

### Code-review cleanup (`791055b`)
- Deleted two dead modules orphaned by the retirement: `lib/i18n/languages.ts` (0 importers) and `lib/data/news.ts` (self-marked "safe to delete").

---

## 3. QA — surfaces & honest states

Every surface was loaded against a **production build** at desktop (1440px) and mobile (390px), logged in as a fresh free-tier test user. All returned HTTP 200 with zero console errors. Screenshots: `qa-shots/<surface>-<desktop|mobile>.png` (35 images).

**Surfaces verified:** landing, pricing, about, methodology, login, signup, public stock page, public compare page, Research, Dashboard, Headlines, Portfolio, Academy (Overview / Learn / Practice / Leaderboard), an open lesson, and the first-run onboarding sheet.

**Honest empty/error/loading states** (verified with local feeds intentionally cold):
- **Dashboard → Market Snapshot:** *"Market data unavailable — None of our price sources are answering right now. The snapshot returns as soon as one does."*
- **Dashboard → Today's Trends:** *"No trends yet — … if this persists past a refresh window, something upstream broke — we show nothing rather than guess."*
- **Headlines:** *"No headlines for this region yet … We publish only real stories from the wires — never filler."* + the required **"Powered by Currents News API"** attribution link.
- **Portfolio:** honest *"What do you own?"* empty state; AI Health Check correctly disabled until ≥2 holdings.

No synthetic fallbacks anywhere — matches the constitution's "say so honestly" rule. The research-and-education disclaimer is present on the analysis/feed/portfolio surfaces and the footer.

---

## 4. Lighthouse — landing (desktop preset)

| Category | Score | Target |
|---|---|---|
| Performance | **98** | ≥ 90 ✅ |
| Accessibility | **100** | ≥ 95 ✅ |
| Best Practices | **100** | — ✅ |
| SEO | **100** | — ✅ |

A11y started at 92 (footer cream-on-espresso labels at 4.0–4.5:1 and a color-only inline link). Fixed by raising footer text to 72% cream (5.45:1) and underlining inline body links → **100**.

---

## 5. Security review

**No findings.** The branch is overwhelmingly deletions (reduced attack surface), token restyling, and copy. The one piece of new authorization logic — the `/api/learn` Pro/free gate — authenticates via the verified session (never client body), resolves `lessonId` against the static curriculum, and gates on legacy-unlock OR `isPremium`. All Supabase access in changed libs uses the parameterized query-builder / RPC (no string-built SQL). The two `dangerouslySetInnerHTML` sinks serialize static JSON-LD constants, not user input. The `proxy.ts` change only drops a guard for `/alpha`, which now 308-redirects before the proxy runs.

---

## 6. Code review (high effort)

| # | Finding | Severity | Status |
|---|---|---|---|
| 1 | `lib/i18n/languages.ts` orphaned (0 importers post-retirement) | cleanup | ✅ deleted |
| 2 | `lib/data/news.ts` dead (`export {}`, self-marked safe to delete) | cleanup | ✅ deleted |
| 3 | *Hypothesis:* `color-mix()`/`var()` in 72 SVG `fill=`/`stroke=` attributes wouldn't render | — | ❌ **refuted** by live-browser test (Chromium resolves both; open-lesson screenshot confirms figures render) |

No correctness or security bugs survived verification.

---

## 7. Go-live checklist (prod infra — NOT code; required before `vercel --prod`)

These are the same items the founder ops checklist tracks; Phase 8 does not change them except where noted.

- [ ] **Supabase migrations** applied in prod through **022** (`020_marketdata_cache`, `021_feed_cache`, `022_onboarding_subscription`). Until 022 runs, onboarding state can't persist and `/api/profile` POST 500s (observed locally — graceful, pages still load).
- [ ] **Vercel prod env vars:** `STRIPE_PRICE_PRO_MONTHLY`, `STRIPE_PRICE_PRO_ANNUAL`; `CURRENTS_API_KEY`; `FMP_API_KEY` (optional but unlocks real market data — free feeds 404/429 from non-residential IPs); `CRON_SECRET`.
- [ ] **Stripe:** Pro Monthly + Pro Annual products created; **Billing Portal enabled** (the account menu's "Manage subscription" depends on it); webhook endpoint live.
- [ ] **GitHub Actions secret** `CRON_SECRET` set (feed-refresh + daily-maintenance workflows).
- [ ] **Landing screenshots** in `public/landing/` re-captured once `FMP_API_KEY` exists, so the device mockup shows real numbers.
- [ ] Deploy via `vercel --prod` (never git push — see CLAUDE.md hard rule).

---

## 8. Known limitations & ship-time risks

1. **🔴 iCloud file resurrection.** Retired files reappeared on disk after being committed-deleted. They are deleted again and verified, but **immediately before `vercel --prod`, run `git status` and confirm none of `src/app/{alpha,cdi,developers,newsletter,v1}`, `src/app/api/{cdi,keys,translate,newsletter}`, `src/components/{AlphaGate.tsx,i18n,allocator}` have reappeared as untracked.** `vercel --prod` uploads the working directory, so a resurrected `/api/keys` or `/api/cdi` would ship live even though git shows them deleted. This is the single highest ship-time risk in this phase.
2. **Local feeds are cold.** Dashboard/Headlines show honest empty states locally because `feed_cache` (migration 021) isn't in the local Supabase and free price feeds 404/429 from this IP. In prod with migrations + the Currents key + the 2×/day refresh, these populate. The empty states shown are exactly what a user sees if a refresh genuinely fails — verified honest.
3. **Onboarding overlay locally.** Without migration 022, the first-run sheet can't persist "dismissed" and re-shows; QA screenshots hid it via injected CSS. In prod (022 applied) it shows once then stays dismissed.
4. **SVG `color-mix()` on legacy browsers.** Lesson figures use `color-mix()`/`var()` in SVG presentation attributes. Verified rendering in current Chromium (and the open-lesson screenshot). On 3+ year-old engines (e.g. Safari < 16.2) these decorative tints may fall back to a default fill — graceful degradation, not breakage. Low priority; if it matters, switch those fills to `fill="var(--accent)" fill-opacity={…}`.

---

## 9. Screenshot index

All under `qa-shots/` (git-ignored QA scratch). Every surface at desktop + mobile 390px:

```
landing · pricing · about · methodology · login · signup
stock-public · compare-public
research · dashboard · headlines · portfolio
academy · academy-learn · academy-practice · academy-leaderboard
academy-lesson-open (figure + nudge) · onboarding (first-run sheet)
```

---

*Prepared at the close of Phase 8. The rebrand is code-complete; the remaining gates are infrastructure, owned by the founder ops checklist.*
