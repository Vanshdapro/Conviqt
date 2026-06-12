import type { Metadata } from "next";
import { getSessionUser } from "@/lib/auth";
import { findLesson } from "@/lib/learn/curriculum";
import { PortfolioSurface } from "@/components/portfolio/PortfolioSurface";
import {
  STAT_INFO,
  STAT_KEYS,
  STAT_LESSON_IDS,
  type StatLessonMap,
} from "@/components/portfolio/statInfo";

// Portfolio (playbook Phase 5) — holdings + watching, live values, the
// teaching stats strip, and the AI Health Check. Server component: resolves
// the session and plucks the 4 stat lessons' teasers from the curriculum so
// the client bundle never imports all 89 lessons (same rule as learnLinks).

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Portfolio",
  description:
    "Track what you own and what you're watching — live values, plain-English risk stats, and an AI Health Check.",
  // Logged-in app surface — keep it out of the index.
  robots: { index: false, follow: false },
};

function lessonTeasers(): StatLessonMap {
  const out = {} as StatLessonMap;
  for (const key of STAT_KEYS) {
    const lessonId = STAT_LESSON_IDS[key];
    const found = findLesson(lessonId);
    if (!found) {
      // Curriculum drift — the test in __tests__/statInfo.test.ts should have
      // caught this. Degrade to a generic teaser rather than crashing.
      console.error(`[portfolio] stat lesson missing from curriculum: ${lessonId}`);
      out[key] = {
        lessonId,
        title: `${STAT_INFO[key].label} in the Academy`,
        hook: "The lesson behind this number.",
        subtitle: "",
      };
      continue;
    }
    out[key] = {
      lessonId,
      title: found.lesson.title,
      hook: found.lesson.hook,
      subtitle: found.lesson.subtitle,
    };
  }
  return out;
}

export default async function PortfolioPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const tab = sp.tab === "watching" ? "watching" : "holdings";
  const user = await getSessionUser();

  return (
    <main>
      <PortfolioSurface
        initialTab={tab}
        signedIn={user !== null}
        lessons={lessonTeasers()}
      />
    </main>
  );
}
