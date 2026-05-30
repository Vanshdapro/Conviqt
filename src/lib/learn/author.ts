// Conviqt Learn — lesson authoring agent.
//
// Given a lesson from the static curriculum, Claude (Sonnet) authors a complete
// interactive lesson module: an institutional-grade explainer, an SVG infographic, an
// interactive simulator choice, a real-world example, a quiz, and a bridge into
// the Chat/Alpha products.
//
// Cost control (CLAUDE.md): lessons are cached GLOBALLY by lessonId in
// learn_lesson_cache. Only the first learner pays full authoring cost; everyone
// else replays the cached module for a fraction of the credits. The author call
// uses NO web_search (lessons teach evergreen concepts, not live data) so cost
// is pure token cost — comfortably inside the analyze tier.

import { getAnthropic, MODELS, estimateCallCostUSD } from "../anthropic";
import { getSupabaseAdmin } from "../supabase";
import { sanitizeSvg } from "./sanitizeSvg";
import type { LessonMeta, LessonModule, Track, WidgetType } from "./types";

const ALLOWED_WIDGETS: WidgetType[] = [
  "compound_interest",
  "budget_split",
  "diversification",
  "dollar_cost_averaging",
  "position_sizing",
  "drawdown_recovery",
  "expected_value",
  "reverse_dcf",
];

const PUBLISH_LESSON_TOOL = {
  name: "publish_lesson",
  description:
    "Publish the finished interactive lesson. Call exactly once with the full module.",
  input_schema: {
    type: "object" as const,
    properties: {
      title: { type: "string", description: "Punchy lesson title, max 6 words." },
      subtitle: { type: "string", description: "One-sentence hook, max 18 words." },
      heroSvg: {
        type: "string",
        description:
          "A self-contained SVG infographic (viewBox='0 0 800 360', no width/height attrs, no <script>, no event handlers, no <foreignObject>, no external images). Use bold shapes, a few labels, and the lesson's accent color. Make it visually teach the core idea at a glance. Keep under 18000 characters.",
      },
      conceptCards: {
        type: "array",
        minItems: 3,
        maxItems: 5,
        items: {
          type: "object",
          properties: {
            emoji: { type: "string", description: "One emoji." },
            heading: { type: "string", description: "Max 5 words." },
            body: { type: "string", description: "1-3 sentences. Sharp, concrete, specific. Use real numbers or examples; define advanced jargon the first time it appears." },
          },
          required: ["emoji", "heading", "body"],
        },
      },
      keyTerms: {
        type: "array",
        minItems: 2,
        maxItems: 5,
        items: {
          type: "object",
          properties: {
            term: { type: "string" },
            definition: { type: "string", description: "Plain-language, one sentence." },
          },
          required: ["term", "definition"],
        },
      },
      widget: {
        type: ["object", "null"],
        description:
          "Optional interactive simulator. Only include if it genuinely fits the lesson. Choose type from the allowlist and give realistic starting params.",
        properties: {
          type: { type: "string", enum: ALLOWED_WIDGETS },
          title: { type: "string" },
          prompt: { type: "string", description: "One sentence telling the learner what to try." },
          params: {
            type: "object",
            description:
              "Starting numbers. compound_interest: {principal, monthlyContribution, years, annualRatePct}. budget_split: {monthlyIncome, needsPct, wantsPct, savingsPct}. diversification: {holdings}. dollar_cost_averaging: {monthlyAmount, months}. position_sizing: {winRatePct, payoffRatio, capital}. drawdown_recovery: {drawdownPct}. expected_value: {winProbPct, winPct, lossPct}. reverse_dcf: {currentPrice, currentFcfPerShare, impliedGrowthPct, discountRatePct, years}.",
            additionalProperties: { type: "number" },
          },
        },
        required: ["type", "title", "prompt", "params"],
      },
      realWorldExample: {
        type: "object",
        properties: {
          scenario: { type: "string", description: "A concrete, relatable situation (2-3 sentences)." },
          ticker: { type: "string", description: "Optional real US ticker (uppercase) if relevant — omit if not." },
          lesson: { type: "string", description: "The one-line takeaway." },
        },
        required: ["scenario", "lesson"],
      },
      quiz: {
        type: "array",
        minItems: 2,
        maxItems: 4,
        items: {
          type: "object",
          properties: {
            question: { type: "string" },
            options: { type: "array", minItems: 4, maxItems: 4, items: { type: "string" } },
            answerIndex: { type: "number", description: "0-3, index of the correct option." },
            explanation: { type: "string", description: "Why that answer is right, one or two sentences." },
          },
          required: ["question", "options", "answerIndex", "explanation"],
        },
      },
      tryInChat: {
        type: "object",
        description:
          "A bridge into Conviqt's Chat product so the learner applies the concept on a real stock.",
        properties: {
          label: { type: "string", description: "Button text, max 6 words." },
          prompt: { type: "string", description: "The exact query to drop into Chat, e.g. 'analyze NKE' or 'pick me a stock'." },
        },
        required: ["label", "prompt"],
      },
      takeaways: {
        type: "array",
        minItems: 2,
        maxItems: 4,
        items: { type: "string", description: "One-line memorable takeaway." },
      },
    },
    required: [
      "title", "subtitle", "heroSvg", "conceptCards", "keyTerms",
      "realWorldExample", "quiz", "tryInChat", "takeaways",
    ],
  },
};

function systemPrompt(track: Track): string {
  return `You are the head of research education at Conviqt — a former hedge-fund partner and CIO who now writes the masterclass curriculum that turns serious investors into professional-grade thinkers. Your learners are ambitious adults: finance students, junior analysts, active investors, and self-taught operators who already know the basics and are bored by them. They want the mental models, sizing math, risk frameworks, and market structure that an MBA and a CFA gloss over.

Voice: precise, authoritative, intellectually generous — the way a great PM teaches a sharp new analyst. Respect the reader's intelligence; never condescend, never pad. Use real institutional examples (Druckenmiller, Soros, Buffett, Marks, Taleb, Mauboussin; real episodes like the 2024 yen-carry unwind, SaaS de-ratings, the GLP-1 trade). Define advanced jargon the first time you use it, then use it freely. No teenage analogies, no allowances or sneakers. Make the reader feel they are being let into how money is actually managed.

This lesson belongs to the "${track.name}" track (${track.tagline}). The track accent color is ${track.accent} — build the SVG infographic around it.

Hard rules:
- Be rigorous and accurate. Never promise returns. Always give the bear case / the way the idea fails. Intellectual honesty is the product.
- This is education, NOT personalized financial advice. Teach frameworks; never tell the learner to buy/sell a specific security.
- The SVG must be valid, self-contained, and purely presentational (no scripts, no event handlers, no external images, no <foreignObject>). Use viewBox='0 0 800 360'. It must genuinely illustrate the concept — a real diagram, chart, payoff curve, or framework map a strategist would put on a slide, not decoration. Restrained, institutional aesthetics: clean lines, labeled axes, the accent color plus neutral greys on the dark canvas.
- When the lesson connects to Conviqt's own engine (the macro→screener→six-specialist→CIO→portfolio-constructor pipeline, the disagreement signal, the public Alpha Tracker track record, on-demand Council analysis in Chat), make the connection explicitly. The "tryInChat" bridge should feel like the obvious way to apply the model on a live name.
- Pick an interactive widget ONLY when it truly reinforces the lesson. Map: sizing/Kelly → position_sizing; loss asymmetry / recovery math → drawdown_recovery; probability-weighted asymmetric bets / expected value → expected_value; what's-priced-in / reverse DCF → reverse_dcf; intrinsic-value or capital compounding → compound_interest; correlation/diversification → diversification; cost-averaging → dollar_cost_averaging. Otherwise set widget to null. Never force a widget that doesn't fit.

Call publish_lesson exactly once with the complete lesson.`;
}

export interface AuthorResult {
  module: LessonModule;
  cached: boolean;
  costUSD: number;
}

// Reads a previously authored module from the global cache, if present.
export async function readCachedLesson(lessonId: string): Promise<LessonModule | null> {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("learn_lesson_cache")
      .select("module")
      .eq("lesson_id", lessonId)
      .single();
    if (error || !data) return null;
    return data.module as LessonModule;
  } catch (err) {
    console.error("[learn] readCachedLesson error:", err instanceof Error ? err.message : err);
    return null;
  }
}

async function writeCachedLesson(lessonId: string, module: LessonModule, costUSD: number): Promise<void> {
  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("learn_lesson_cache").upsert(
      {
        lesson_id: lessonId,
        module,
        model: MODELS.analyst,
        cost_usd: Number(costUSD.toFixed(4)),
      },
      { onConflict: "lesson_id" },
    );
    if (error) console.error("[learn] writeCachedLesson error:", error.message);
  } catch (err) {
    console.error("[learn] writeCachedLesson threw:", err instanceof Error ? err.message : err);
  }
}

// Authors a fresh lesson via Claude. Does NOT touch credits — the route owns that.
export async function authorLesson(meta: LessonMeta, track: Track): Promise<AuthorResult> {
  const anthropic = getAnthropic();

  const response = await anthropic.messages.create({
    model: MODELS.analyst, // Sonnet 4.6 — quality content + clean SVG
    max_tokens: 4000,
    system: systemPrompt(track),
    tools: [PUBLISH_LESSON_TOOL],
    tool_choice: { type: "tool", name: "publish_lesson" },
    messages: [
      {
        role: "user",
        content: `Create the lesson "${meta.title}".\n\nLearning objective: ${meta.objective}\n\nLevel: ${meta.difficulty}. Keep it tight, rigorous, and genuinely advanced — a serious investor should finish it in a few minutes and walk away with a model they can deploy, not a definition they could have Googled.`,
      },
    ],
  });

  const toolUse = response.content.find(
    (b): b is Extract<typeof b, { type: "tool_use" }> => b.type === "tool_use",
  );
  if (!toolUse) {
    throw new Error("Lesson author did not return a publish_lesson tool call.");
  }

  const raw = toolUse.input as Record<string, unknown>;
  const costUSD = estimateCallCostUSD(MODELS.analyst, response.usage);

  const module = normalizeModule(meta, raw);
  await writeCachedLesson(meta.id, module, costUSD);

  console.log(
    `[learn] authored "${meta.id}" cost=$${costUSD.toFixed(4)} ` +
      `widget=${module.widget?.type ?? "none"} svg=${module.heroSvg.length}b`,
  );

  return { module, cached: false, costUSD };
}

// Coerces the raw tool input into a safe LessonModule (sanitizes SVG, clamps quiz,
// validates widget against the allowlist).
function normalizeModule(meta: LessonMeta, raw: Record<string, unknown>): LessonModule {
  const asArray = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
  const str = (v: unknown, fallback = ""): string => (typeof v === "string" ? v : fallback);

  const widgetRaw = raw.widget as Record<string, unknown> | null | undefined;
  let widget: LessonModule["widget"] = null;
  if (
    widgetRaw &&
    typeof widgetRaw === "object" &&
    ALLOWED_WIDGETS.includes(widgetRaw.type as WidgetType)
  ) {
    const params: Record<string, number> = {};
    const p = (widgetRaw.params ?? {}) as Record<string, unknown>;
    for (const [k, v] of Object.entries(p)) {
      if (typeof v === "number" && Number.isFinite(v)) params[k] = v;
    }
    widget = {
      type: widgetRaw.type as WidgetType,
      title: str(widgetRaw.title, "Try it yourself"),
      prompt: str(widgetRaw.prompt, "Drag the controls and watch what changes."),
      params,
    };
  }

  const quiz = asArray<Record<string, unknown>>(raw.quiz)
    .map((q) => {
      const options = asArray<string>(q.options).filter((o) => typeof o === "string").slice(0, 4);
      let answerIndex = typeof q.answerIndex === "number" ? q.answerIndex : 0;
      if (answerIndex < 0 || answerIndex >= options.length) answerIndex = 0;
      return {
        question: str(q.question),
        options,
        answerIndex,
        explanation: str(q.explanation),
      };
    })
    .filter((q) => q.question && q.options.length === 4)
    .slice(0, 4);

  const rwe = (raw.realWorldExample ?? {}) as Record<string, unknown>;
  const tryInChat = (raw.tryInChat ?? {}) as Record<string, unknown>;
  const tickerRaw = str(rwe.ticker).toUpperCase().trim();
  const ticker = /^[A-Z]{1,5}(\.[A-Z])?$/.test(tickerRaw) ? tickerRaw : undefined;

  return {
    lessonId: meta.id,
    title: str(raw.title, meta.title),
    subtitle: str(raw.subtitle, meta.hook),
    heroSvg: sanitizeSvg(str(raw.heroSvg)),
    conceptCards: asArray<Record<string, unknown>>(raw.conceptCards)
      .map((c) => ({
        emoji: str(c.emoji, "✨"),
        heading: str(c.heading),
        body: str(c.body),
      }))
      .filter((c) => c.heading && c.body)
      .slice(0, 5),
    keyTerms: asArray<Record<string, unknown>>(raw.keyTerms)
      .map((t) => ({ term: str(t.term), definition: str(t.definition) }))
      .filter((t) => t.term && t.definition)
      .slice(0, 5),
    widget,
    realWorldExample: {
      scenario: str(rwe.scenario),
      ticker,
      lesson: str(rwe.lesson),
    },
    quiz,
    tryInChat: {
      label: str(tryInChat.label, "Try it in Chat"),
      prompt: str(tryInChat.prompt, "pick me a stock"),
    },
    takeaways: asArray<string>(raw.takeaways).filter((t) => typeof t === "string" && t.trim()).slice(0, 4),
    xp: meta.xp,
  };
}
