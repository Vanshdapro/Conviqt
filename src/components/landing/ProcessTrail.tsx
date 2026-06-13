"use client";

// LOGGED-OUT LANDING ONLY — "The flow": a Digilab-style numbered split-scroll
// of how the product works, recoloured to Conviqt's Almanac brand. A LEFT
// column carries a dotted vertical rail (three lit stations + a teal fill that
// descends with scroll) and a crossfading copy block whose big numeral lives
// INSIDE the active step — so the 01/02/03 numerals can never stack or bleed
// through the text (the old bug). A RIGHT column holds one consistently-framed
// "stage" whose three line-art states crossfade as the active step changes:
//   01 — a real Ask composer: a typed plain-English question + an Ask button
//        + one-tap skill chips (replaces the old lone question-mark glyph)
//   02 — four named research lines converging on one center node
//   03 — a plain-English verdict card: a check, a "How sure: High" pill, sources
//
// Self-contained: pure SVG + CSS + a tiny rAF scroll loop. NO deps, NO canvas.
// Pinned-scrub on desktop; under prefers-reduced-motion OR ≤860px it sets
// data-static and falls back to a clean stacked layout (each step shows its own
// inline diagram, no pinning, no blinking caret). All colour comes from global
// tokens via the CSS module. Decorative SVG is aria-hidden; real headings live
// in the DOM. SSR-stable — no Math.random / Date at render.

import { useEffect, useRef } from "react";
import styles from "./ProcessTrail.module.css";

type Step = {
  n: string;
  title: string;
  body: string;
};

const STEPS: Step[] = [
  {
    n: "01",
    title: "Ask anything",
    body: "Type a question about any stock in plain English — no jargon, no perfect prompt to engineer. Just ask what you actually want to know.",
  },
  {
    n: "02",
    title: "The analysts go to work",
    body: "Four lines of research run at once on live market data — the fundamentals, the chart, the mood, and the bigger picture, all at the same time.",
  },
  {
    n: "03",
    title: "One clear answer",
    body: "A plain-English verdict with a How-sure rating and the sources behind it, ready to open. Read it in seconds, dig in when you want.",
  },
];

const clamp = (lo: number, hi: number, x: number) => Math.max(lo, Math.min(hi, x));

// The three diagram states as line-art SVG, drawn on one 360×300 stage so they
// crossfade in place. Reused by BOTH the shared pinned stage and the per-step
// inline static diagrams.
function DiagPaths({ i }: { i: number }) {
  if (i === 0) {
    // 01 — a believable "Ask" composer: typed question + Ask button + skill chips
    return (
      <>
        <text x="30" y="86" className={styles.dLabel}>
          Ask anything, in plain English
        </text>
        <rect x="30" y="104" width="300" height="60" rx="14" className={styles.dField} />
        <text x="48" y="140" className={styles.dType}>
          Is NVDA worth owning?
        </text>
        <rect x="208" y="124" width="2" height="22" className={`${styles.dInk} ${styles.caret}`} />
        <rect x="270" y="116" width="46" height="36" rx="10" className={styles.dBtn} />
        <text x="293" y="139" className={styles.dBtnText} textAnchor="middle">
          Ask
        </text>
        {/* one-tap skills under the field */}
        <rect x="30" y="184" width="92" height="26" rx="13" className={styles.dChip} />
        <text x="76" y="201" className={styles.dChipText} textAnchor="middle">
          Worth Owning?
        </text>
        <rect x="130" y="184" width="74" height="26" rx="13" className={styles.dChip} />
        <text x="167" y="201" className={styles.dChipText} textAnchor="middle">
          Quick Take
        </text>
        <rect x="212" y="184" width="64" height="26" rx="13" className={styles.dChip} />
        <text x="244" y="201" className={styles.dChipText} textAnchor="middle">
          Face-Off
        </text>
      </>
    );
  }
  if (i === 1) {
    // 02 — four named research lines converging on one center node
    return (
      <>
        <line x1="44" y1="74" x2="172" y2="146" className={styles.dInk} />
        <line x1="316" y1="74" x2="188" y2="146" className={styles.dInk} />
        <line x1="44" y1="226" x2="172" y2="154" className={styles.dInk} />
        <line x1="316" y1="226" x2="188" y2="154" className={styles.dInk} />
        <circle cx="44" cy="74" r="4" className={styles.dDot} />
        <text x="40" y="60" className={styles.dTick} textAnchor="start">
          Fundamentals
        </text>
        <circle cx="316" cy="74" r="4" className={styles.dDot} />
        <text x="320" y="60" className={styles.dTick} textAnchor="end">
          The chart
        </text>
        <circle cx="44" cy="226" r="4" className={styles.dDot} />
        <text x="40" y="248" className={styles.dTick} textAnchor="start">
          The mood
        </text>
        <circle cx="316" cy="226" r="4" className={styles.dDot} />
        <text x="320" y="248" className={styles.dTick} textAnchor="end">
          Big picture
        </text>
        <circle cx="180" cy="150" r="24" className={`${styles.dShape} ${styles.pulse}`} />
        <circle cx="180" cy="150" r="24" className={styles.dShape} />
        <circle cx="180" cy="150" r="7" className={styles.dFill} />
      </>
    );
  }
  // 03 — a plain-English verdict card
  return (
    <>
      <circle cx="62" cy="92" r="22" className={styles.dShape} />
      <circle cx="62" cy="92" r="9" className={styles.dFill} />
      <path d="M55 92 60 97 70 85" className={styles.dCheck} />
      <rect x="98" y="80" width="150" height="11" rx="5.5" className={styles.dBar} />
      <rect x="98" y="99" width="104" height="8" rx="4" className={styles.dBarFaint} />
      <rect x="30" y="146" width="152" height="34" rx="17" className={styles.dPill} />
      <circle cx="50" cy="163" r="4.5" className={styles.dFill} />
      <text x="64" y="168" className={styles.dPillText}>
        How sure: High
      </text>
      <rect x="196" y="148" width="92" height="30" rx="9" className={styles.dChip} />
      <text x="242" y="167" className={styles.dChipText} textAnchor="middle">
        3 sources
      </text>
      <rect x="30" y="202" width="258" height="8" rx="4" className={styles.dBarFaint} />
      <rect x="30" y="218" width="182" height="8" rx="4" className={styles.dBarFaint} />
    </>
  );
}

export function ProcessTrail() {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const section = ref.current;
    if (!section) return;

    // No pinned scrub under reduced-motion or on small screens — fall through to
    // the static stacked layout (CSS via the data-static attribute).
    if (
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      window.matchMedia("(max-width: 860px)").matches
    ) {
      section.setAttribute("data-static", "true");
      return;
    }
    section.removeAttribute("data-static");

    const copyEls = Array.from(section.querySelectorAll<HTMLElement>(`.${styles.copy}`));
    const stageEls = Array.from(section.querySelectorAll<HTMLElement>(`.${styles.stageState}`));
    const stationEls = Array.from(section.querySelectorAll<HTMLElement>(`.${styles.station}`));
    const fill = section.querySelector<HTMLElement>(`.${styles.railFill}`);
    const n = STEPS.length;
    let ticking = false;

    const update = () => {
      ticking = false;
      const vh = window.innerHeight;
      const rect = section.getBoundingClientRect();
      const total = section.offsetHeight - vh; // scroll distance while pinned
      const progress = total > 0 ? clamp(0, 1, -rect.top / total) : 0;
      const pos = progress * (n - 1); // 0 … n-1

      copyEls.forEach((el, i) => {
        const ad = Math.abs(pos - i);
        const active = ad < 0.5;
        el.style.opacity = `${clamp(0, 1, 1 - ad * 1.9)}`;
        el.style.transform = `translateY(${((pos - i) * -18).toFixed(1)}px)`;
        el.style.pointerEvents = active ? "auto" : "none";
        el.classList.toggle(styles.isActive, active);
      });

      stageEls.forEach((el, i) => {
        const ad = Math.abs(pos - i);
        el.style.opacity = `${clamp(0, 1, 1 - ad * 1.9)}`;
        el.style.transform = `scale(${(1 - ad * 0.04).toFixed(3)})`;
        el.classList.toggle(styles.isActive, ad < 0.5);
      });

      stationEls.forEach((el, i) => el.classList.toggle(styles.isOn, pos >= i - 0.001));
      if (fill) fill.style.transform = `scaleY(${progress.toFixed(3)})`;
    };

    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <section
      ref={ref}
      className={styles.root}
      aria-label="How it works, from question to verdict"
      data-thread-node
      data-thread-label="The flow"
    >
      <div className={styles.sticky}>
        <div className={styles.header}>
          <p className="cvq-land-eyebrow">The flow</p>
          <h2 className="cvq-land-h2">From question to verdict, in one tap.</h2>
        </div>

        <div className={styles.grid}>
          {/* ── LEFT: dotted rail + crossfading numbered copy ───────────── */}
          <div className={styles.left}>
            <div className={styles.rail} aria-hidden="true">
              <span className={styles.railTrack}>
                <span className={styles.railFill} />
              </span>
              {STEPS.map((s) => (
                <span className={styles.station} key={s.n}>
                  <span className={styles.stationDot} />
                </span>
              ))}
            </div>

            <div className={styles.copyStack}>
              {STEPS.map((s, i) => (
                <div
                  className={`${styles.copy}${i === 0 ? " " + styles.isActive : ""}`}
                  key={s.n}
                >
                  <span className={styles.copyNum} aria-hidden="true">
                    {s.n}
                  </span>
                  <h3 className={styles.copyTitle}>{s.title}</h3>
                  <p className={styles.copyBody}>{s.body}</p>

                  {/* Inline per-step diagram — shown ONLY in the static / mobile
                      fallback (hidden in pinned mode by CSS). */}
                  <div className={styles.copyDiagram} aria-hidden="true">
                    <svg viewBox="0 0 360 300" fill="none" className={styles.copyDiagramSvg}>
                      <DiagPaths i={i} />
                    </svg>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── RIGHT: one framed stage, three crossfading states ───────── */}
          <div className={styles.right}>
            <div className={styles.stage}>
              <svg className={styles.stageSvg} viewBox="0 0 360 300" fill="none" aria-hidden="true">
                {STEPS.map((s, i) => (
                  <g
                    className={`${styles.stageState}${i === 0 ? " " + styles.isActive : ""}`}
                    key={s.n}
                  >
                    <DiagPaths i={i} />
                  </g>
                ))}
              </svg>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
