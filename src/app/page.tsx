import type { Metadata } from "next";
import Link from "next/link";
import { WordmarkIntro } from "@/components/landing/WordmarkIntro";
import { SmoothScroll } from "@/components/landing/SmoothScroll";
import { LandingMotion } from "@/components/landing/LandingMotion";
import { FeatureSequence, type FeatureStep } from "@/components/landing/FeatureSequence";
import { PhoneFrame } from "@/components/landing/DeviceFrame";
import { FounderNote } from "@/components/landing/FounderNote";
import { ChangePill } from "@/components/ui";
import { loadPicks, pickStats, thesisLine, type PickView } from "@/lib/picksView";
import { SKILLS } from "@/lib/skills";
import { TRACKS, TOTAL_LESSONS } from "@/lib/learn/curriculum";

// The public landing (playbook Phase 6). Server-rendered with a 15-minute
// revalidate so the TRACK RECORD section embeds live picks data — losses
// visible — while the page itself stays static-fast. The intro is a single
// 1.0s CSS wordmark reveal (WordmarkIntro), once per session, no WebGL.

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

// ── Track record helpers ─────────────────────────────────────────────────────

// The section's whole point is "losses visible": take the most recent picks,
// and if none of those happens to be a loser while the history has one, swap
// the most recent loss in. All real picks, never curated to look good.
function selectShowcase(views: PickView[], count = 6): PickView[] {
  const shown = views.slice(0, count);
  const hasLoss = shown.some((v) => v.returnPct !== null && v.returnPct < 0);
  if (!hasLoss) {
    const loser = views.find((v) => v.returnPct !== null && v.returnPct < 0);
    if (loser && !shown.includes(loser)) shown[shown.length - 1] = loser;
  }
  return shown;
}

function PickCard({ v }: { v: PickView }) {
  const thesis = thesisLine(v.pick);
  return (
    <article className="cvq-card cvq-land-pick" data-reveal="up">
      <div className="cvq-land-pick-top">
        <div>
          <span className="cvq-ticker-sym">
            {v.pick.ticker}
          </span>
          <span className="cvq-land-pick-company">{v.pick.company_name}</span>
        </div>
        <span className={`cvq-chip ${v.open ? "cvq-dash-chip-open" : "cvq-dash-chip-closed"}`}>
          {v.open ? "Open" : "Closed"}
        </span>
      </div>
      <div className="cvq-land-pick-nums">
        <span>
          Entry ${v.pick.entry_price.toFixed(2)} · {v.pick.entry_date}
        </span>
        {v.returnPct !== null ? (
          <ChangePill change={v.returnPct} />
        ) : (
          <span className="cvq-land-pick-na">price unavailable</span>
        )}
      </div>
      {thesis && <p className="cvq-land-pick-thesis">{thesis}</p>}
      {v.priceAsOfNote && <p className="cvq-land-pick-asof">{v.priceAsOfNote}</p>}
    </article>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function Home() {
  // Snapshot prices only (honestly dated) — live quote() fetches are no-store
  // and would force this route dynamic; the landing stays static + ISR.
  const views = await loadPicks({ live: false }).catch((err): PickView[] | null => {
    console.error("[landing] picks load failed:", err);
    return null; // error state, not an empty track record
  });
  const stats = views ? pickStats(views) : null;
  const showcase = views ? selectShowcase(views) : [];

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
        <section className="cvq-land-hero" data-thread-node>
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

        {/* ── 3 · Skill grid ──────────────────────────────────────────────── */}
        <section className="cvq-land-section" aria-labelledby="skills-h" data-thread-node>
          <p className="cvq-land-eyebrow" data-reveal="up">Skills</p>
          <h2 id="skills-h" className="cvq-land-h2" data-reveal="clip">
            One tap. A real piece of research.
          </h2>
          <p className="cvq-land-lede" data-reveal="up">
            Skills turn the questions you&rsquo;d actually ask into deep research — no prompt
            engineering, no jargon.
          </p>
          <div className="cvq-land-skillgrid" data-reveal-group>
            {gridSkills.map((s) => (
              <Link key={s.id} href={`/research?skill=${s.id}`} className="cvq-card cvq-card--interactive cvq-land-skill" data-reveal="up">
                <span className="cvq-land-skill-cat">{s.category}</span>
                <span className="cvq-land-skill-name">{s.name}</span>
                <span className="cvq-land-skill-line">{s.oneLiner}</span>
              </Link>
            ))}
          </div>
        </section>

        {/* ── 4 · Pinned scroll-scrubbed feature sequence ─────────────────── */}
        <FeatureSequence steps={FEATURE_STEPS} />

        {/* ── 5 · Track record (live data) ────────────────────────────────── */}
        <section className="cvq-land-section cvq-land-track" id="track-record" aria-labelledby="track-h" data-thread-node>
          <p className="cvq-land-eyebrow" data-reveal="up">Track record</p>
          <h2 id="track-h" className="cvq-land-h2" data-reveal="clip">
            We publish everything. Even the misses.
          </h2>
          <p className="cvq-land-lede" data-reveal="up">
            Every pick goes on the record with its entry price and stays there — wins and losses
            alike. No quiet deletions, ever.
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
              {stats && (
                <p className="cvq-land-track-stats" data-reveal="up">
                  Win rate{" "}
                  <span data-countup={String(stats.winRate)} data-count-suffix="%">
                    {stats.winRate}%
                  </span>{" "}
                  · Average return <ChangePill change={stats.avgReturn} /> ·{" "}
                  <span data-countup={String(stats.total)}>{stats.total}</span> picks (
                  <span data-countup={String(stats.open)}>{stats.open}</span> open)
                </p>
              )}
              <div className="cvq-land-picks" data-reveal-group>
                {showcase.map((v) => (
                  <PickCard key={v.pick.id ?? `${v.pick.ticker}-${v.pick.entry_date}`} v={v} />
                ))}
              </div>
              <p className="cvq-land-track-note">
                Live prices where a source answers; otherwise the last verified check, dated. Past
                results never guarantee future returns.{" "}
                <Link href="/dashboard">See the full history →</Link>
              </p>
            </>
          )}
        </section>

        {/* ── 6 · Academy ─────────────────────────────────────────────────── */}
        <section className="cvq-land-section cvq-land-academy" id="academy" aria-labelledby="academy-h" data-thread-node>
          <p className="cvq-land-eyebrow" data-reveal="up">Academy</p>
          <h2 id="academy-h" className="cvq-land-h2" data-reveal="clip">
            Learn what the numbers mean.
          </h2>
          <p className="cvq-land-lede" data-reveal="up">
            {TRACKS.length} tracks, {TOTAL_LESSONS} bite-size lessons — woven into the app, so every
            stat you meet links to the lesson that explains it. You&rsquo;re not just following
            calls; you&rsquo;re learning to make your own.
          </p>
          <div className="cvq-land-trackchips" aria-label="Some of the tracks" data-reveal-group>
            {TRACKS.slice(0, 6).map((t) => (
              <span key={t.id} className="cvq-chip" data-reveal="up">
                {t.name}
              </span>
            ))}
          </div>
          <Link href="/academy" className="cvq-btn cvq-btn--secondary cvq-land-academy-cta" data-reveal="up">
            Explore the Academy
          </Link>
        </section>

        {/* ── 7 · Founder note ────────────────────────────────────────────── */}
        <FounderNote />

        {/* ── 8 · Pricing (playbook 2.4) ──────────────────────────────────── */}
        <section className="cvq-land-section" id="pricing" aria-labelledby="pricing-h" data-thread-node>
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
                <span>$16</span>
                <span className="cvq-land-plan-per">/month billed annually</span>
              </p>
              <p className="cvq-land-plan-alt">or $25 month-to-month · 7-day free trial</p>
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
          <p className="cvq-land-fineprint" data-reveal="up">Prices in USD. Cancel anytime.</p>
        </section>

        {/* ── 9 · FAQ ─────────────────────────────────────────────────────── */}
        <section className="cvq-land-section cvq-land-faq" aria-labelledby="faq-h" data-thread-node>
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

        {/* ── 10 · Finale — dark CTA + giant wordmark wipe ─────────────────── */}
        <section className="cvq-finale" data-thread-node aria-labelledby="finale-h">
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
