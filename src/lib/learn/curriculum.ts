// Conviqt Learn — the static curriculum catalog.
//
// The catalog is assembled from hand-authored, in-repo content (see content/).
// Opening a lesson is a plain data read: no Anthropic call, no per-click spend,
// ever — like opening a page in a textbook. The only paid moment is the
// one-time credit unlock (see unlock.ts).
//
// Lesson ids are permanent keys — they back both progress tracking and the
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

// ── Free preview ──────────────────────────────────────────────────────────────
// The first lesson of the first track is free forever — no unlock, no charge.
// Everything else is a one-time credit unlock.
export const FREE_LESSON_IDS: Set<string> = new Set(["fs-three-statements"]);

// ── Pricing ───────────────────────────────────────────────────────────────────
// Lesson unlock pricing (1 credit ≈ 1¢). A single lesson is a one-time 10-credit
// unlock, then free forever; "Unlock everything" applies a ~20% bundle discount at
// 8 credits per still-locked lesson. These live here (a client-safe module) so the
// dashboard can render prices without importing the server-only unlock module.

/** Credits charged to unlock one lesson (one-time, then free forever). */
export const PER_LESSON_UNLOCK_COST = 10;

/** Discounted per-lesson rate when unlocking the whole remaining catalog. */
export const BUNDLE_RATE_PER_LESSON = 8;

/** Cost in credits to unlock a given lesson (0 for the free preview lesson). */
export function lessonUnlockCost(lessonId: string): number {
  return FREE_LESSON_IDS.has(lessonId) ? 0 : PER_LESSON_UNLOCK_COST;
}

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
