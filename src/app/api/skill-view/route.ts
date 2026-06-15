// POST /api/skill-view — run one specialized Skill View.
//
// Body: { skill: SkillViewId, params: SkillParams }. Returns the skill's own
// structured shape (src/lib/skillViewTypes.ts) plus the real market anchors
// the renderer shows alongside. One forced-tool OpenAI call, grounded on the
// free marketdata layer — no web_search, so it stays cheap and on OpenAI.
//
// This is an ADDITIVE surface for the Research skills; it does not touch the
// existing /api/chat pipeline. Powers the /dev/skill-views playground today;
// ready for the Research surface to call per skill.

import { NextResponse } from "next/server";
import { runSkillView, type SkillParams } from "@/lib/agents/skillViews";
import type { SkillViewId, SkillViewResponse } from "@/lib/skillViewTypes";

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

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      skill?: string;
      params?: SkillParams;
    };

    const skill = (body.skill ?? "").trim() as SkillViewId;
    if (!VALID.includes(skill)) {
      return NextResponse.json({ error: "Unknown skill." }, { status: 400 });
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
      return NextResponse.json({ error: invalid }, { status: 400 });
    }

    const { view, anchors, costUSD } = await runSkillView(skill, params);
    console.log(`[skill-view] skill=${skill} cost=$${costUSD.toFixed(4)}`);

    const payload: SkillViewResponse = {
      skillId: skill,
      view,
      anchors,
      disclaimer: DISCLAIMER,
      costUSD,
    };
    return NextResponse.json(payload);
  } catch (err) {
    console.error("[skill-view] failed:", err);
    return NextResponse.json(
      { error: "Couldn't run that skill right now. Try again in a moment." },
      { status: 500 }
    );
  }
}
