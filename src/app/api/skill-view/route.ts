// POST /api/skill-view — run one specialized Skill View for the Research surface.
//
// Body: { skill: SkillViewId, params: SkillParams }. Returns the skill's own
// structured shape (src/lib/skillViewTypes.ts) plus the real market anchors the
// renderer shows alongside, AND a forward-looking forecast block. A two-step
// chain (reason → structure) on gpt-4.1-mini/flagship, grounded on the free
// marketdata layer — no web_search, so it stays cheap and on OpenAI.
//
// This is the engine behind every ticker/pair/sector/headline skill in Research
// (it replaced the old generic-Council path so each skill returns its OWN
// specialized output instead of the same verdict reworded). Auth + the Phase-7
// plan gate + caching mirror /api/chat.

import { runSkillView, type SkillParams } from "@/lib/agents/skillViews";
import type { SkillViewId, SkillViewResponse } from "@/lib/skillViewTypes";
import { getVerifiedUser } from "@/lib/auth";
import { getSubscriberByEmail, isPremium } from "@/lib/subscription";
import {
  getExperienceLevel,
  useDeepAnalysis,
  FREE_DEEP_LIMIT,
  FREE_LIMIT_MSG,
  FREE_METER_DEGRADED_MSG,
} from "@/lib/profile";
import { audienceCacheSuffix } from "@/lib/agents/audience";
import {
  checkRateLimit,
  ensureDailyBudget,
  getClientIp,
  RATE_LIMITS,
  recordSpend,
} from "@/lib/rate-limit";
import { cacheGet, cacheSet, COUNCIL_CACHE_TTL_MS } from "@/lib/cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const DISCLAIMER =
  "Conviqt is a research and education tool, not a licensed financial adviser. Nothing here is financial advice. Markets involve risk.";

const VALID: SkillViewId[] = [
  "worth-owning",
  "quick-take",
  "entry-exit-zones",
  "face-off",
  "sector-pulse",
  "headline-decoder",
  "crowd-check",
  "bull-bear-map",
  "starter-portfolio",
  "portfolio-health-check",
];

// Skills that consume a Free monthly deep slot. Quick Take and Headline Decoder
// stay outside the meter — they're the "Flash basics" part of the Free promise.
const DEEP_SKILLS = new Set<SkillViewId>([
  "worth-owning",
  "entry-exit-zones",
  "face-off",
  "sector-pulse",
  "crowd-check",
  "bull-bear-map",
  "starter-portfolio",
  "portfolio-health-check",
]);

const TICKER_RE = /^[\^]?[A-Z0-9][A-Z0-9.\-]{0,9}$/;
function cleanTicker(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.trim().toUpperCase();
  return TICKER_RE.test(t) ? t : undefined;
}

// Which params each skill requires; returns an error message or null.
function validate(skill: SkillViewId, p: SkillParams): string | null {
  switch (skill) {
    case "worth-owning":
    case "quick-take":
    case "entry-exit-zones":
    case "crowd-check":
    case "bull-bear-map":
      return cleanTicker(p.ticker) ? null : "Enter a valid ticker (e.g. NVDA).";
    case "face-off":
      return cleanTicker(p.tickerA) && cleanTicker(p.tickerB)
        ? null
        : "Enter two valid tickers to compare.";
    case "sector-pulse":
      return p.sector && p.sector.trim().length >= 2 ? null : "Name a sector or theme.";
    case "headline-decoder":
      return p.headline && p.headline.trim().length >= 12
        ? null
        : "Paste the full headline so there's enough to decode.";
    case "starter-portfolio":
      return typeof p.budgetUSD === "number" && p.budgetUSD > 0
        ? null
        : "Enter a budget above $0.";
    case "portfolio-health-check":
      return p.holdings && p.holdings.trim().length >= 3
        ? null
        : "List what you own (e.g. AAPL 40%, MSFT 30%, cash 30%).";
    default:
      return "Unknown skill.";
  }
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function skillViewCacheKey(
  skill: SkillViewId,
  params: SkillParams,
  audienceSuffix: string
): string {
  const slug = JSON.stringify({
    t: params.ticker,
    a: params.tickerA,
    b: params.tickerB,
    s: params.sector?.toLowerCase().slice(0, 40),
    h: params.headline?.toLowerCase().replace(/\W+/g, "_").slice(0, 80),
    bud: params.budgetUSD,
    g: params.goals?.toLowerCase().slice(0, 60),
    hold: params.holdings?.toLowerCase().replace(/\s+/g, "").slice(0, 80),
  });
  return `skillview:${skill}:${slug}${audienceSuffix}`;
}

export async function POST(req: Request) {
  // Identity from the verified session only (never the body) — same as /api/chat.
  const user = await getVerifiedUser();
  if (!user) {
    return json({ error: "Please sign in to use Conviqt.", code: "auth_required" }, 401);
  }
  const email = user.email;

  // DDoS gate.
  const ip = getClientIp(req);
  const gate = checkRateLimit(ip, RATE_LIMITS.chatGeneral);
  if (!gate.ok) {
    return json({ error: `Rate limit hit. Retry in ${gate.retryAfterSeconds}s.` }, 429);
  }

  let body: { skill?: string; params?: SkillParams };
  try {
    body = (await req.json()) as { skill?: string; params?: SkillParams };
  } catch {
    return json({ error: "Invalid request." }, 400);
  }

  const skill = (body.skill ?? "").trim() as SkillViewId;
  if (!VALID.includes(skill)) {
    return json({ error: "Unknown skill." }, 400);
  }

  // Normalize tickers up front so grounding gets clean symbols.
  const raw = body.params ?? {};
  const params: SkillParams = {
    ...raw,
    ticker: cleanTicker(raw.ticker),
    tickerA: cleanTicker(raw.tickerA),
    tickerB: cleanTicker(raw.tickerB),
  };

  const invalid = validate(skill, params);
  if (invalid) {
    return json({ error: invalid }, 400);
  }

  const audience = await getExperienceLevel(email);
  const cacheKey = skillViewCacheKey(skill, params, audienceCacheSuffix(audience));
  const cached = cacheGet<SkillViewResponse>(cacheKey);

  // Plan gate (Phase 7): fresh deep skills consume a Free monthly slot; cache
  // hits are free replays. Quick Take / Headline Decoder are never metered.
  if (!cached && DEEP_SKILLS.has(skill)) {
    const subscriber = await getSubscriberByEmail(email);
    if (!isPremium(subscriber)) {
      const meter = await useDeepAnalysis(email, FREE_DEEP_LIMIT);
      if (!meter.allowed) {
        if (meter.degraded) {
          console.error(`[skill-view] usage meter degraded for ${email} — failing closed`);
          return json({ error: FREE_METER_DEGRADED_MSG, code: "meter_unavailable" }, 503);
        }
        console.log(`[skill-view] free deep limit hit for ${email} (${meter.used}/${FREE_DEEP_LIMIT})`);
        return json({ error: FREE_LIMIT_MSG, code: "plan_limit" }, 402);
      }
    }
  }

  try {
    ensureDailyBudget(0.05);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return json({ error: msg }, 503);
  }

  if (cached) {
    return json({ ...cached, cached: true }, 200);
  }

  try {
    const { view, anchors, costUSD } = await runSkillView(skill, params);
    recordSpend(costUSD);
    console.log(`[skill-view] skill=${skill} cost=$${costUSD.toFixed(4)} email=${email}`);

    const payload: SkillViewResponse = {
      skillId: skill,
      view,
      anchors,
      disclaimer: DISCLAIMER,
      costUSD,
    };
    cacheSet(cacheKey, payload, COUNCIL_CACHE_TTL_MS);
    return json(payload, 200);
  } catch (err) {
    console.error("[skill-view] failed:", err);
    return json(
      { error: "Couldn't run that skill right now. Try again in a moment." },
      500
    );
  }
}
