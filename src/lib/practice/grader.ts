// Conviqt Academy — Practice: the AI thesis grader (server-only).
//
// A learner writes a structured PM thesis (variant view, what's priced in,
// catalyst, quality, bear case, sizing). This grades it the way a portfolio
// manager grades an analyst's pitch: section by section, honest and specific,
// rewarding a genuine non-consensus view and a real invalidation level — not
// confident-sounding consensus.
//
// One Sonnet call (MODELS.analyst) keeps it well under the cost ceiling. The
// per-section scores are the model's judgment; the overall, letter grade, and
// verdict are derived deterministically in code so they can never contradict the
// section scores. Metered at thesis = 20 credits, refunded on failure upstream.

import { getAnthropic, MODELS, estimateCallCostUSD } from "../anthropic";
import type {
  ThesisSpec,
  ThesisSubmission,
  ThesisGrade,
  SectionScore,
  ThesisVerdict,
} from "./types";

const SYSTEM = `You are a buy-side Portfolio Manager grading an analyst's written investment thesis, the way you would in a real investment-committee review. You are demanding but fair, and your feedback is specific — never generic praise.

You receive: the drill setup, "what a strong answer looks like," and the analyst's written answer for each requested section. Grade ONLY the sections that were requested.

For EACH requested section, assign a score 0-10 and write a one-line critique:
- 0-2: blank, evasive, or a non-answer.
- 3-4: vague consensus restated; no real edge, no specifics.
- 5-6: a reasonable answer with a gap (asserts without evidence, hand-wavy numbers, or no invalidation).
- 7-8: a genuine, specific, internally-consistent argument with real numbers or a concrete level.
- 9-10: PM-grade — a true variant view, quantified, with an honest bear case and a falsifiable invalidation.

What you reward:
- Variant perception: a clearly NON-consensus view, with a reason the crowd is wrong. "It'll keep going up" is not a thesis.
- Second-order thinking: engaging with what's ALREADY priced in, not just whether the company is good.
- A concrete, falsifiable invalidation (a price level or a specific data point), not a vague "if the story changes."
- A risk plan — position size and stop — as detailed as the bull case.
- Internal consistency: the variant view, catalyst, and sizing all point the same way.

What you penalise:
- Confident consensus dressed up as insight. Strawman bear cases. No invalidation level. Sizing pulled from thin air. Hindsight.

Be concrete in every critique — quote or name what they wrote. Strengths and gaps must be things THIS analyst actually did or missed, not boilerplate. The rewrite hint is the single most valuable next step.

Call publish_grade exactly once. Do not output any other text.`;

const PUBLISH_GRADE_TOOL = {
  name: "publish_grade",
  description:
    "Emit the structured grade for the analyst's thesis: a score and critique per requested section, plus strengths, gaps, and one rewrite hint.",
  input_schema: {
    type: "object" as const,
    properties: {
      sections: {
        type: "array",
        description: "One entry per REQUESTED section. Use the exact section id given.",
        items: {
          type: "object",
          properties: {
            id: { type: "string", description: "The section id (e.g. 'variant', 'risk')." },
            score: { type: "number", description: "0-10 for this section." },
            critique: {
              type: "string",
              description: "One specific line — quote or name what they wrote and why it earned this score.",
            },
          },
          required: ["id", "score", "critique"],
        },
      },
      strengths: {
        type: "array",
        items: { type: "string" },
        description: "1-3 things THIS analyst genuinely did well. Specific, not boilerplate.",
      },
      gaps: {
        type: "array",
        items: { type: "string" },
        description: "1-3 things a PM would push back on. The most important weaknesses.",
      },
      rewrite_hint: {
        type: "string",
        description: "The single most valuable next step to upgrade this thesis.",
      },
    },
    required: ["sections", "strengths", "gaps", "rewrite_hint"],
  },
};

export interface GradeResult {
  grade: ThesisGrade;
  costUSD: number;
  durationMs: number;
}

interface PublishGradeInput {
  sections: Array<{ id: string; score: number; critique: string }>;
  strengths: string[];
  gaps: string[];
  rewrite_hint: string;
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

function letterForScore(score: number): string {
  if (score >= 97) return "A+";
  if (score >= 93) return "A";
  if (score >= 90) return "A-";
  if (score >= 87) return "B+";
  if (score >= 83) return "B";
  if (score >= 80) return "B-";
  if (score >= 77) return "C+";
  if (score >= 73) return "C";
  if (score >= 70) return "C-";
  if (score >= 67) return "D+";
  if (score >= 63) return "D";
  if (score >= 60) return "D-";
  return "F";
}

function verdictForScore(score: number): ThesisVerdict {
  if (score >= 78) return "would_fund";
  if (score >= 55) return "needs_work";
  return "back_to_drawing_board";
}

// Stable hash of a submission, used by the route to dedup an identical
// resubmission (so a learner isn't charged twice for grading the same text).
export function thesisHash(drillId: string, submission: ThesisSubmission): string {
  const keys = Object.keys(submission).sort();
  const normalized = keys
    .map((k) => `${k}:${(submission[k as keyof ThesisSubmission] ?? "").trim()}`)
    .join("");
  const payload = `${drillId}${normalized}`;
  let h = 5381;
  for (let i = 0; i < payload.length; i++) h = ((h << 5) + h + payload.charCodeAt(i)) | 0;
  return `t${(h >>> 0).toString(36)}_${payload.length.toString(36)}`;
}

function renderSubmission(spec: ThesisSpec, submission: ThesisSubmission): string {
  return spec.sections
    .map((s) => {
      const answer = (submission[s.id] ?? "").trim();
      return `### Section: ${s.label} (id: ${s.id})
Prompt: ${s.prompt}
Analyst's answer: ${answer || "(left blank)"}`;
    })
    .join("\n\n");
}

export async function gradeThesis(
  spec: ThesisSpec,
  drillTitle: string,
  submission: ThesisSubmission,
): Promise<GradeResult> {
  const t0 = Date.now();
  const anthropic = getAnthropic();

  const userMessage = `DRILL: ${drillTitle}

SETUP:
${spec.setup}

WHAT A STRONG ANSWER LOOKS LIKE (for your reference — do not just check boxes against it):
${spec.whatGoodLooksLike}

THE ANALYST'S THESIS:
${renderSubmission(spec, submission)}

Grade every requested section, then call publish_grade once.`;

  const response = await anthropic.messages.create({
    model: MODELS.analyst,
    max_tokens: 1600,
    system: SYSTEM,
    tools: [PUBLISH_GRADE_TOOL],
    tool_choice: { type: "tool" as const, name: PUBLISH_GRADE_TOOL.name },
    messages: [{ role: "user", content: userMessage }],
  });

  const toolUse = response.content.find(
    (b) => b.type === "tool_use" && b.name === PUBLISH_GRADE_TOOL.name,
  );
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error(`[grader] no publish_grade call. stop_reason=${response.stop_reason}`);
  }

  const input = toolUse.input as PublishGradeInput;

  // Map the model's per-section scores back onto the REQUESTED sections, in the
  // spec's order. A section the model skipped scores 0 (a blank answer should
  // never silently pass).
  const byId = new Map<string, { score: number; critique: string }>();
  for (const s of input.sections ?? []) {
    if (typeof s?.id === "string") {
      byId.set(s.id, {
        score: clamp(Math.round(Number(s.score) || 0), 0, 10),
        critique: typeof s.critique === "string" ? s.critique.trim() : "",
      });
    }
  }

  const sections: SectionScore[] = spec.sections.map((def) => {
    const got = byId.get(def.id);
    return {
      id: def.id,
      label: def.label,
      score: got?.score ?? 0,
      critique: got?.critique || "No assessment returned for this section.",
    };
  });

  // Overall is derived from the section scores — never the model's free guess —
  // so the headline grade can't contradict the breakdown.
  const avg = sections.length
    ? sections.reduce((sum, s) => sum + s.score, 0) / sections.length
    : 0;
  const overall = clamp(Math.round(avg * 10), 0, 100);

  const grade: ThesisGrade = {
    overall,
    letter: letterForScore(overall),
    verdict: verdictForScore(overall),
    sections,
    strengths: (input.strengths ?? []).map((s) => String(s).trim()).filter(Boolean).slice(0, 3),
    gaps: (input.gaps ?? []).map((s) => String(s).trim()).filter(Boolean).slice(0, 3),
    rewriteHint: String(input.rewrite_hint ?? "").trim(),
  };

  const costUSD = estimateCallCostUSD(MODELS.analyst, response.usage, 0);
  console.log(
    `[grader] ${drillTitle}: overall=${overall} (${grade.letter}, ${grade.verdict}) cost=$${costUSD.toFixed(4)}`,
  );

  return { grade, costUSD, durationMs: Date.now() - t0 };
}
