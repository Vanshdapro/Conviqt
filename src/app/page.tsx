import type { Metadata } from "next";
import Link from "next/link";
import { WordmarkIntro } from "@/components/landing/WordmarkIntro";
import { SmoothScroll } from "@/components/landing/SmoothScroll";
import { LandingMotion } from "@/components/landing/LandingMotion";
import { FeatureSequence, type FeatureStep } from "@/components/landing/FeatureSequence";
import { ConvergeLines } from "@/components/landing/ConvergeLines";
import { ProcessTrail } from "@/components/landing/ProcessTrail";
import { SignalField } from "@/components/landing/SignalField";
import { RisingThread } from "@/components/landing/RisingThread";
import { PhoneFrame } from "@/components/landing/DeviceFrame";
import { FounderNote } from "@/components/landing/FounderNote";
import { TrackRecordViz } from "@/components/landing/TrackRecordViz";
import { loadPicks, type PickView } from "@/lib/picksView";
import { SKILLS } from "@/lib/skills";
import { TRACKS, TOTAL_LESSONS } from "@/lib/learn/curriculum";

// The public landing (playbook Phase 6). Server-rendered with a 15-minute
// revalidate so the TRACK RECORD section reflects the live count of public
// calls — while the page itself stays static-fast. The picks themselves are
// NOT enumerated here (founder call 2026-06-14): the landing shows that a real,
// dated, permanent record exists (an abstract sealed-ledger viz + the live
// count) but the actual calls live one tap inside the app, so visitors can't
// lift free picks off a public page. The intro is a single 1.0s CSS wordmark
// reveal (WordmarkIntro), once per session, no WebGL.

export const revalidate = 900;

export const metadata: Metadata = {
  alternates: { canonical: "https://www.conviqt.com" },
};

// ── Copy (playbook Part 2 — verbatim where the playbook speaks) ─────────────

const HERO_H1 = "Your personal team of AI analysts.";
const HERO_SUB =
  "Ask anything about any stock. Plain-English answers, and a public track record we can’t hide from.";

const DISCLAIMER =
  "Conviqt is a research and education tool, not a licensed financial adviser. Nothing here is financial advice. Markets involve risk.";

// The 6-card skill grid — names and one-liners come from the registry
// (playbook Part 2.3 verbatim), never retyped here.
const GRID_SKILL_IDS = [
  "worth-owning",
  "quick-take",
  "face-off",
  "entry-exit-zones",
  "headline-decoder",
  "bull-bear-map",
];

// The pinned scroll-scrubbed feature sequence (replaces the static feature rows).
const FEATURE_STEPS: FeatureStep[] = [
  {
    eyebrow: "Dashboard",
    title: "Start the day already caught up.",
    body:
      "A shared daily read on the market — snapshot, today’s trends, early signals, upcoming earnings and Fed dates, and the picks. Refreshed before the US open and after the close.",
    src: "/landing/dashboard.png",
    alt: "The Conviqt Dashboard: today's trends, early signals, and the public picks — losses included",
    width: 2064,
    height: 1720,
    url: "conviqt.com/dashboard",
  },
  {
    eyebrow: "Headlines",
    title: "Every headline, decoded.",
    body:
      "Markets news from ten regions plus crypto — and under each headline, one line on what it could mean for traders. Tap any of them and Conviqt decodes which stocks it touches and how.",
    src: "/landing/headlines.png",
    alt: "Conviqt Headlines: region tabs and headlines, each with a one-line read on why traders care",
    width: 2560,
    height: 1720,
    url: "conviqt.com/headlines",
  },
  {
    eyebrow: "Portfolio",
    title: "Know what you actually own.",
    body:
      "Your holdings and watchlist with live values — plus the risk numbers the pros use (Beta, Volatility, Max Drawdown, Sharpe), each one tap away from the lesson that explains it. Run an AI Health Check when you want the hard look.",
    src: "/landing/portfolio.png",
    alt: "Conviqt Portfolio: add holdings by ticker or CSV, with the AI Health Check one tap away",
    width: 2560,
    height: 1546,
    url: "conviqt.com/portfolio",
  },
];

const FAQ: Array<{ q: string; a: string }> = [
  {
    q: "Why not just use ChatGPT?",
    a: "ChatGPT is a great generalist — but it isn’t wired into the market. Conviqt has live market data built in, so answers come with real prices instead of guesses. Skills run a full piece of research in one tap, so you never have to engineer the perfect prompt. Every pick we publish stays public — wins and losses — which is a track record ChatGPT can’t have. And the Academy teaches you what the numbers actually mean, so you get smarter with every answer.",
  },
  {
    q: "Is this financial advice?",
    a: "No. Conviqt is a research and education tool, not a licensed financial adviser. We show you the research — the verdicts, the numbers, and where they came from — and teach you how to read it. What you do with it is your decision, and markets always involve risk.",
  },
  {
    q: "How is Conviqt different from other stock apps?",
    a: "Three things. Plain English — answers a beginner can actually use, no jargon walls. A public track record — every pick we make stays on the site with its entry price, including the ones that go wrong. And a built-in Academy — the app explains its own numbers, so you’re learning to invest, not just following calls.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. Pro is a simple subscription — cancel in a couple of taps from your account and you keep access until the end of the period you paid for. The free plan is free forever, and the public track record is open to everyone, always.",
  },
];

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function Home() {
  // We load the picks only to surface their COUNT — never to enumerate them on
  // this public page (founder call 2026-06-14). Snapshot mode (no live quotes)
  // keeps the route static + ISR; live quote() fetches would force it dynamic.
  const views = await loadPicks({ live: false }).catch((err): PickView[] | null => {
    console.error("[landing] picks load failed:", err);
    return null; // error state, not an empty track record
  });

  const gridSkills = GRID_SKILL_IDS.map((id) => SKILLS.find((s) => s.id === id)).filter(
    (s): s is NonNullable<typeof s> => Boolean(s)
  );

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ.map(({ q, a }) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    })),
  };

  return (
    <div className="cvq-land">
      <WordmarkIntro />
      <SmoothScroll />
      <LandingMotion />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />

      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <header className="cvq-land-topbar">
        <Link href="/" className="cvq-land-wordmark">
          CONVI<span className="cvq-land-wordmark-q">Q</span>T
        </Link>
        <nav className="cvq-land-nav" aria-label="Landing">
          <a href="#track-record">Track record</a>
          <a href="#academy">Academy</a>
          <a href="#pricing">Pricing</a>
          <Link href="/login" className="cvq-land-nav-login">
            Log in
          </Link>
          <Link href="/signup" className="cvq-btn cvq-btn--primary cvq-land-nav-cta">
            Start free
          </Link>
        </nav>
      </header>

      <main>
        {/* ── 1 · Hero ────────────────────────────────────────────────────── */}
        <section className="cvq-land-hero" data-thread-node data-thread-label="Welcome">
          <div className="cvq-land-hero-copy">
            <h1 className="cvq-land-h1" data-intro>{HERO_H1}</h1>
            <p className="cvq-land-sub" data-intro>{HERO_SUB}</p>
            <div className="cvq-land-cta-row" data-intro>
              <Link href="/signup" className="cvq-btn cvq-btn--primary cvq-land-cta" data-magnetic>
                Start free
              </Link>
              <a href="#track-record" className="cvq-btn cvq-btn--secondary">
                See the track record
              </a>
            </div>
            <p className="cvq-land-fineprint" data-intro>Free plan · No card needed · Works in your browser</p>
          </div>
          <div className="cvq-land-hero-shot" data-fade data-parallax="0.05">
            <PhoneFrame
              src="/landing/hero-research.png"
              alt="The Conviqt Research screen on a phone: “What do you want to look into?” with one-tap skills"
              width={780}
              height={1600}
              priority
            />
          </div>
        </section>

        {/* ── 2 · Credibility strip ───────────────────────────────────────── */}
        <section className="cvq-land-strip" aria-label="Why trust Conviqt" data-reveal="up">
          <span>Every pick public</span>
          <span aria-hidden="true">·</span>
          <span>{TOTAL_LESSONS} lessons</span>
          <span aria-hidden="true">·</span>
          <span>No download needed</span>
        </section>

        {/* ── 2b · Convergence — four signal lines reunite into one verdict ─── */}
        <ConvergeLines />

        {/* ── 3 · Skill grid ──────────────────────────────────────────────── */}
        <section className="cvq-land-section" aria-labelledby="skills-h" data-thread-node data-thread-label="Skills">
          <p className="cvq-land-eyebrow" data-reveal="up">Skills</p>
          <h2 id="skills-h" className="cvq-land-h2" data-reveal="clip">
            One tap. A real piece of research.
          </h2>
          <p className="cvq-land-lede" data-reveal="up">
            Skills turn the questions you&rsquo;d actually ask into deep research — no prompt
            engineering, no jargon.
          </p>
          <div className="cvq-skills" data-reveal="up" aria-label="Skills">
            {gridSkills.map((s, i) => (
              <Link key={s.id} href={`/research?skill=${s.id}`} className="cvq-skill">
                <span className="cvq-skill-head">
                  <span className="cvq-skill-idx" aria-hidden="true">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="cvq-skill-cat">{s.category}</span>
                </span>
                <span className="cvq-skill-name">{s.name}</span>
                <span className="cvq-skill-line">{s.oneLiner}</span>
                <span className="cvq-skill-run" aria-hidden="true">
                  Run skill
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                </span>
              </Link>
            ))}
          </div>
        </section>

        {/* ── 3b · Process trail — numbered Ask → Research → Verdict (Digilab) ── */}
        <ProcessTrail />

        {/* ── 4 · Pinned scroll-scrubbed feature sequence ─────────────────── */}
        <FeatureSequence steps={FEATURE_STEPS} />

        {/* ── 5 · Track record (live data) ────────────────────────────────── */}
        <section className="cvq-land-section cvq-land-track" id="track-record" aria-labelledby="track-h" data-thread-node data-thread-label="Track record">
          <p className="cvq-land-eyebrow" data-reveal="up">Track record</p>
          <h2 id="track-h" className="cvq-land-h2" data-reveal="clip">
            Every call, on the record.
          </h2>
          <p className="cvq-land-lede" data-reveal="up">
            The moment we make a pick it goes public — the ticker, the entry price, the date, and
            the reasoning behind it — and it stays there for good. Nothing is quietly edited or
            deleted. The full history is always one tap away.
          </p>

          {views === null ? (
            <div className="cvq-card cvq-land-track-error">
              <p>
                The track record store didn&rsquo;t answer just now. The full history — losses
                included — is one tap away on the{" "}
                <Link href="/dashboard">Dashboard</Link>.
              </p>
            </div>
          ) : views.length === 0 ? (
            <div className="cvq-card cvq-land-track-error">
              <p>
                No picks published yet. When the desk publishes one it appears here with its entry
                price and stays — wins and losses alike.
              </p>
            </div>
          ) : (
            <>
              <ul className="cvq-track-trust" data-reveal="up" aria-label="How the record works">
                <li>
                  <strong>Public</strong>
                  <span>Every call is visible to everyone, the day we make it.</span>
                </li>
                <li>
                  <strong>Time-stamped</strong>
                  <span>The entry price and date are locked in — no rewriting history.</span>
                </li>
                <li>
                  <strong>Permanent</strong>
                  <span>Calls stay up for good. Never quietly edited, never deleted.</span>
                </li>
              </ul>
              <TrackRecordViz count={views.length} />
              <p className="cvq-land-track-note">
                We don&rsquo;t print the calls themselves on this page — the complete record, wins
                and losses alike, opens the moment you&rsquo;re inside. Past results never guarantee
                future returns. <Link href="/dashboard">Open the record →</Link>
              </p>
            </>
          )}
        </section>

        {/* ── 5b · Signal field — "always watching" data-field (Digilab) ───── */}
        <SignalField />

        {/* ── 6 · Academy ─────────────────────────────────────────────────── */}
        <section className="cvq-land-section cvq-land-academy" id="academy" aria-labelledby="academy-h" data-thread-node data-thread-label="Academy">
          <p className="cvq-land-eyebrow" data-reveal="up">Academy</p>
          <h2 id="academy-h" className="cvq-land-h2" data-reveal="clip">
            Learn what the numbers mean.
          </h2>
          <p className="cvq-land-lede" data-reveal="up">
            Most apps just hand you a verdict. Conviqt teaches you to read it — every track and
            lesson woven into the app, so the moment you meet a number you can tap straight to the
            lesson behind it. You&rsquo;re not just following calls; you&rsquo;re learning to make
            your own.
          </p>

          <div className="cvq-acad" data-reveal="up">
            <div className="cvq-acad-pitch">
              <div className="cvq-acad-stats" aria-label="The Academy at a glance">
                <div className="cvq-acad-stat">
                  <span className="cvq-acad-statnum" data-countup={String(TRACKS.length)}>
                    {TRACKS.length}
                  </span>
                  <span className="cvq-acad-statlbl">Tracks</span>
                </div>
                <div className="cvq-acad-stat">
                  <span className="cvq-acad-statnum" data-countup={String(TOTAL_LESSONS)}>
                    {TOTAL_LESSONS}
                  </span>
                  <span className="cvq-acad-statlbl">Lessons</span>
                </div>
                <div className="cvq-acad-stat">
                  <span className="cvq-acad-statnum">Free</span>
                  <span className="cvq-acad-statlbl">Fundamentals</span>
                </div>
              </div>

              <div className="cvq-acad-weave">
                <span className="cvq-acad-weave-cap">Woven into every answer</span>
                <p className="cvq-acad-weave-line">
                  See a term like <b>Sharpe</b>, <b>Beta</b> or <b>Drawdown</b>? Tap it — and read
                  the two-minute lesson that explains exactly what it means for you.
                </p>
                <Link href="/academy" className="cvq-acad-weave-link">
                  Learn what it means
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                </Link>
              </div>

              <Link href="/academy" className="cvq-btn cvq-btn--secondary cvq-land-academy-cta" data-magnetic>
                Explore the Academy
              </Link>
            </div>

            <ul className="cvq-acad-tracks" aria-label="Academy tracks">
              {TRACKS.slice(0, 6).map((t) => (
                <li key={t.id} className="cvq-acad-track">
                  <span className="cvq-acad-track-name">{t.name}</span>
                  <span className="cvq-acad-track-tag">{t.tagline}</span>
                  <span className="cvq-acad-track-count">{t.lessons.length} lessons</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ── 7 · Founder note ────────────────────────────────────────────── */}
        <FounderNote />

        {/* ── 8 · Pricing (playbook 2.4) ──────────────────────────────────── */}
        <section className="cvq-land-section" id="pricing" aria-labelledby="pricing-h" data-thread-node data-thread-label="Pricing">
          <p className="cvq-land-eyebrow" data-reveal="up">Pricing</p>
          <h2 id="pricing-h" className="cvq-land-h2" data-reveal="clip">
            Start free. Upgrade when it earns it.
          </h2>
          <div className="cvq-land-pricing" data-reveal-group>
            <div className="cvq-card cvq-card--pad-lg cvq-land-plan" data-reveal="up">
              <h3>Free</h3>
              <p className="cvq-land-plan-price">
                <span>$0</span>
              </p>
              <ul>
                <li>5 deep analyses a month</li>
                <li>Quick takes on any ticker</li>
                <li>Academy fundamentals</li>
                <li>The full public track record — transparency is free, always</li>
              </ul>
              <Link href="/signup" className="cvq-btn cvq-btn--secondary">
                Start free
              </Link>
            </div>
            <div className="cvq-card cvq-card--pad-lg cvq-land-plan cvq-land-plan--pro" data-reveal="up">
              <h3>Pro</h3>
              <p className="cvq-land-plan-price">
                <span>$8</span>
                <span className="cvq-land-plan-per">/month</span>
              </p>
              <p className="cvq-land-plan-alt">Month to month · cancel anytime · 7-day free trial</p>
              <ul>
                <li>Unlimited fair-use analyses</li>
                <li>The full Academy — every track, every lesson</li>
                <li>Portfolio tools and the AI Health Check</li>
                <li>Priority speed</li>
              </ul>
              <Link href="/signup" className="cvq-btn cvq-btn--primary">
                Start the 7-day trial
              </Link>
            </div>
          </div>
          <p className="cvq-land-fineprint" data-reveal="up">Prices in USD. Month to month — cancel anytime.</p>
        </section>

        {/* ── 9 · FAQ ─────────────────────────────────────────────────────── */}
        <section className="cvq-land-section cvq-land-faq" aria-labelledby="faq-h" data-thread-node data-thread-label="Questions">
          <p className="cvq-land-eyebrow" data-reveal="up">FAQ</p>
          <h2 id="faq-h" className="cvq-land-h2" data-reveal="clip">
            Fair questions.
          </h2>
          <div className="cvq-land-faqlist" data-reveal-group>
            {FAQ.map(({ q, a }) => (
              <details key={q} className="cvq-land-faqitem" data-reveal="up">
                <summary>{q}</summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* ── 9b · Rising thread — Noomo "spark becomes a fire" lead-in ────── */}
        <RisingThread />

        {/* ── 10 · Finale — dark CTA + giant wordmark wipe ─────────────────── */}
        <section className="cvq-finale" data-thread-node data-thread-label="Get started" aria-labelledby="finale-h">
          <div className="cvq-finale-inner">
            <p className="cvq-finale-eyebrow" data-reveal="up">Get started</p>
            <h2 id="finale-h" className="cvq-finale-head" data-reveal="clip">
              Ask your first question, free.
            </h2>
            <div className="cvq-finale-cta" data-reveal="up">
              <Link href="/signup" className="cvq-btn cvq-btn--primary cvq-land-cta" data-magnetic>
                Start free
              </Link>
              <a href="#track-record" className="cvq-btn cvq-btn--secondary">
                See the track record
              </a>
            </div>
          </div>
          <div className="cvq-bigmark" aria-hidden="true">
            <span className="cvq-bigmark-word" data-reveal="wipe">
              CONVI<b>Q</b>T
            </span>
          </div>
        </section>
      </main>

      {/* ── Footer — the one dark moment ──────────────────────────────────── */}
      <footer className="cvq-land-footer">
        <div className="cvq-land-footer-inner">
          <div className="cvq-land-footer-brand">
            <span className="cvq-land-wordmark cvq-land-wordmark--footer">
              CONVI<span className="cvq-land-wordmark-q">Q</span>T
            </span>
            <p>Your personal team of AI analysts.</p>
          </div>
          <nav className="cvq-land-footer-cols" aria-label="Footer">
            <div>
              <h3>Product</h3>
              <Link href="/research">Research</Link>
              <Link href="/dashboard">Dashboard</Link>
              <Link href="/headlines">Headlines</Link>
              <Link href="/academy">Academy</Link>
              <a href="#pricing">Pricing</a>
            </div>
            <div>
              <h3>Reports</h3>
              <Link href="/stock">Stock reports</Link>
              <Link href="/compare">Comparisons</Link>
              <a href="#track-record">Track record</a>
            </div>
            <div>
              <h3>Company</h3>
              <Link href="/about">About</Link>
              <Link href="/methodology">How it works</Link>
              <Link href="/login">Log in</Link>
            </div>
          </nav>
        </div>
        <p className="cvq-land-footer-disclaimer">{DISCLAIMER}</p>
        <p className="cvq-land-footer-copy">© {new Date().getFullYear()} Conviqt</p>
      </footer>
    </div>
  );
}
