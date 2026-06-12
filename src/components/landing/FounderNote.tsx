// Founder note (playbook Phase 6, section 7) — wired to swap in the real
// assets the moment they land in /public/founder/ (playbook Part 1, Jobs 4/5):
//
//   public/founder/photo.jpg|png|webp   the real photo
//   public/founder/story.md             the story, one paragraph per line
//                                       (first line starting "# " = name line)
//
// Until then this renders an honest placeholder block — no stock photo, no
// invented quotes. Faces are the cheapest anti-scam signal there is, which is
// exactly why we never fake one. Server component: fs checks happen at render
// time, so dropping the files in is a deploy-free swap on the next revalidate.

import fs from "fs";
import path from "path";
import Image from "next/image";

const FOUNDER_DIR = path.join(process.cwd(), "public", "founder");
const PHOTO_CANDIDATES = ["photo.jpg", "photo.png", "photo.webp"];

function founderPhoto(): string | null {
  for (const name of PHOTO_CANDIDATES) {
    if (fs.existsSync(path.join(FOUNDER_DIR, name))) return `/founder/${name}`;
  }
  return null;
}

function founderStory(): { name: string | null; paragraphs: string[] } | null {
  const file = path.join(FOUNDER_DIR, "story.md");
  try {
    const raw = fs.readFileSync(file, "utf8").trim();
    if (!raw) return null;
    const lines = raw.split(/\n+/).map((l) => l.trim()).filter(Boolean);
    const name = lines[0]?.startsWith("# ") ? lines[0].slice(2).trim() : null;
    const paragraphs = (name ? lines.slice(1) : lines).filter((l) => !l.startsWith("#"));
    return paragraphs.length > 0 ? { name, paragraphs } : null;
  } catch {
    return null;
  }
}

// The standing promise stays even while the personal story is being written —
// it is the one line of this section that is already true and non-negotiable.
const PROMISE =
  "Every pick we make stays public — including the ones that go wrong.";

export function FounderNote() {
  const photo = founderPhoto();
  const story = founderStory();

  return (
    <section className="cvq-land-section" aria-labelledby="founder-h">
      <p className="cvq-land-eyebrow">From the founder</p>
      <div className="cvq-founder">
        <div className="cvq-founder-photo">
          {photo ? (
            <Image
              src={photo}
              alt={story?.name ? `${story.name}, founder of Conviqt` : "The founder of Conviqt"}
              width={320}
              height={320}
              className="cvq-founder-img"
            />
          ) : (
            // Honest placeholder — a monogram, not a stock face.
            <div className="cvq-founder-img cvq-founder-placeholder" aria-hidden="true">
              <span>Q</span>
            </div>
          )}
        </div>
        <div className="cvq-founder-text">
          <h2 id="founder-h" className="cvq-land-h2">
            Why I built this
          </h2>
          {story ? (
            story.paragraphs.map((p, i) => <p key={i}>{p}</p>)
          ) : (
            <>
              <p>
                I run Conviqt&rsquo;s research desk and write everything you see here. I built it
                because serious stock research shouldn&rsquo;t require a Bloomberg terminal or a
                finance degree — and because most apps that promise &ldquo;AI investing&rdquo; show
                you their wins and quietly bury their losses.
              </p>
              <p>
                So the deal is simple: {PROMISE} You can check the math on every call we&rsquo;ve
                ever made, right on this page.
              </p>
            </>
          )}
          {story && <p className="cvq-founder-promise">{PROMISE}</p>}
          {story?.name && <p className="cvq-founder-name">— {story.name}</p>}
        </div>
      </div>
    </section>
  );
}
