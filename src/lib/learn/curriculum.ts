// Conviqt Learn — the static curriculum catalog.
//
// The catalog is assembled from hand-authored, in-repo content (see content/).
// Opening a lesson is a plain data read: no Anthropic call, no per-click spend,
// ever — like opening a page in a textbook. Access is plan-based since Phase 8:
// fundamentals free, the rest with Pro (see FREE_LESSON_IDS below).
//
// Lesson ids are permanent keys — they back progress tracking and the legacy
// per-lesson unlock rows. Never renumber or rename an existing lesson id.

import type { Track, CatalogLesson, LessonModule, RawTrack, StaticLesson } from "./types";
import { LESSON_XP_BY_DIFFICULTY } from "./types";

import { financialStatements } from "./content/financialStatements";
import { fundamentalAnalysis } from "./content/fundamentalAnalysis";
import { valuationQuality } from "./content/valuationQuality";
import { mentalModels } from "./content/mentalModels";
import { positionSizing } from "./content/positionSizing";
import { riskManagement } from "./content/riskManagement";
import { macroReflexivity } from "./content/macroReflexivity";
import { conviqtEngine } from "./content/conviqtEngine";
import { foundations } from "./content/foundations";
import { behavioralFinance } from "./content/behavioralFinance";
import { marketMechanics } from "./content/marketMechanics";

// Curriculum order. New tracks append to the end so existing progression holds
// (the free preview lesson stays the first lesson of the first track).
const RAW_TRACKS: RawTrack[] = [
  financialStatements,
  fundamentalAnalysis,
  valuationQuality,
  mentalModels,
  positionSizing,
  riskManagement,
  macroReflexivity,
  conviqtEngine,
  foundations,
  behavioralFinance,
  marketMechanics,
];

/** Derive a catalog lesson (xp from difficulty) from an authored static lesson. */
function toCatalogLesson(l: StaticLesson): CatalogLesson {
  return { ...l, xp: LESSON_XP_BY_DIFFICULTY[l.difficulty] };
}

export const TRACKS: Track[] = RAW_TRACKS.map((t) => ({
  id: t.id,
  name: t.name,
  tagline: t.tagline,
  emoji: t.emoji,
  accent: t.accent,
  lessons: t.lessons.map(toCatalogLesson),
}));

// ── Free tier ─────────────────────────────────────────────────────────────────
// Playbook 2.4: "Academy fundamentals" are free for everyone — the whole
// Markets & Investing Foundations track, plus the financial-statements opener
// that has been the free preview since launch. Everything else is part of Pro
// (Phase 8 retired the per-lesson credit unlock; the gate is the subscription).
// Lessons bought one-by-one in the credit era stay unlocked forever — the
// access check still honors learn_unlocks rows.
export const FREE_LESSON_IDS: Set<string> = new Set([
  "fs-three-statements",
  ...(RAW_TRACKS.find((t) => t.id === "foundations")?.lessons.map((l) => l.id) ?? []),
]);

// ── Lookups ──────────────────────────────────────────────────────────────────

const LESSON_INDEX: Map<string, { lesson: CatalogLesson; track: Track }> = (() => {
  const m = new Map<string, { lesson: CatalogLesson; track: Track }>();
  for (const track of TRACKS) {
    for (const l of track.lessons) m.set(l.id, { lesson: l, track });
  }
  return m;
})();

export function findLesson(id: string): { lesson: CatalogLesson; track: Track } | null {
  return LESSON_INDEX.get(id) ?? null;
}

/** Assemble the rendered module a lesson view consumes. Null if id is unknown. */
export function getLessonModule(id: string): LessonModule | null {
  const found = LESSON_INDEX.get(id);
  if (!found) return null;
  const l = found.lesson;
  return {
    lessonId: l.id,
    title: l.title,
    subtitle: l.subtitle,
    figure: l.figure ?? null,
    conceptCards: l.conceptCards,
    keyTerms: l.keyTerms,
    widget: l.widget ?? null,
    realWorldExample: l.realWorldExample,
    quiz: l.quiz,
    tryInChat: l.tryInChat,
    takeaways: l.takeaways,
    xp: l.xp,
  };
}

export const ALL_LESSON_IDS: string[] = [...LESSON_INDEX.keys()];
export const TOTAL_LESSONS = ALL_LESSON_IDS.length;
