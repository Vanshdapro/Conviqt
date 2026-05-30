// Conviqt Learn — shared types for the gamified financial academy.
//
// A "lesson module" is authored on demand by Claude (see author.ts) and rendered
// by the LessonView client component. It is intentionally a closed schema: the
// model fills slots, the client renders trusted widgets. The only free-form HTML
// is heroSvg, which is sanitized server-side before it ever reaches the client.

// ── Interactive widget allowlist ─────────────────────────────────────────────
// The author model may attach ONE interactive simulator to a lesson. It chooses
// a type from this allowlist and supplies starting parameters; the actual
// interactivity (sliders, drag) lives in trusted React components. Unknown types
// render nothing — never eval'd.

export type WidgetType =
  | "compound_interest"
  | "budget_split"
  | "diversification"
  | "dollar_cost_averaging";

export interface LessonWidget {
  type: WidgetType;
  title: string;
  /** Plain-language sentence telling the learner what to try. */
  prompt: string;
  /** Starting parameters. Shape depends on type; the widget validates/defaults. */
  params: Record<string, number>;
}

export interface QuizQuestion {
  question: string;
  options: string[]; // exactly 4
  answerIndex: number; // 0-3
  explanation: string; // shown after answering, why the answer is right
}

export interface ConceptCard {
  emoji: string;
  heading: string;
  body: string; // 1-3 sentences, teen-friendly
}

export interface KeyTerm {
  term: string;
  definition: string;
}

export interface RealWorldExample {
  scenario: string;
  /** Optional US ticker the example references — bridges to Chat/Alpha. */
  ticker?: string;
  lesson: string; // the takeaway from the scenario
}

// The full authored module returned by /api/learn and rendered by LessonView.
export interface LessonModule {
  lessonId: string;
  title: string;
  subtitle: string;
  /** Sanitized SVG infographic string (server-sanitized). May be empty. */
  heroSvg: string;
  conceptCards: ConceptCard[];
  keyTerms: KeyTerm[];
  widget: LessonWidget | null;
  realWorldExample: RealWorldExample;
  quiz: QuizQuestion[];
  /** Deep-link into the Chat product to apply the concept on a real ticker. */
  tryInChat: { label: string; prompt: string };
  takeaways: string[];
  xp: number;
}

// ── Curriculum (static catalog) ──────────────────────────────────────────────

export type Difficulty = "starter" | "core" | "sharp";

export interface LessonMeta {
  id: string; // stable, also the global cache key
  title: string;
  hook: string; // one-line teaser on the card
  difficulty: Difficulty;
  xp: number;
  /** Seed objective handed to the author model. Defines what the lesson teaches. */
  objective: string;
}

export interface Track {
  id: string;
  name: string;
  tagline: string;
  emoji: string;
  accent: string; // hex accent for the track
  lessons: LessonMeta[];
}

// ── Progress ─────────────────────────────────────────────────────────────────

export interface LearnStats {
  xp: number;
  level: number;
  streakDays: number;
  completedLessonIds: string[];
}

export const LESSON_XP_BY_DIFFICULTY: Record<Difficulty, number> = {
  starter: 40,
  core: 60,
  sharp: 100,
};

// Level curve: simple, legible thresholds. Level N requires 250*(N-1) cumulative XP.
export function levelForXp(xp: number): number {
  return Math.floor(xp / 250) + 1;
}

export function xpIntoLevel(xp: number): { into: number; needed: number } {
  const into = xp % 250;
  return { into, needed: 250 };
}
