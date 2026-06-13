"use client";

// LOGGED-OUT LANDING ONLY — "ProcessTrail": Digilab.co's numbered split-scroll
// process, recolored to Conviqt's Almanac brand. A LEFT column carries a dotted
// vertical rail with three lit stations, big 01/02/03 numerals, a per-step
// line-icon glyph, and a crossfading heading + paragraph. A RIGHT column holds
// one line-art SVG whose three groups crossfade as the active step changes:
//   01 — an input line with a blinking cursor + question-mark glyph
//   02 — four short lines converging on a center node ("the analysts")
//   03 — one solid node with a small "How sure: High" pill
//
// Self-contained: pure SVG + CSS + a tiny rAF scroll loop. NO deps, NO canvas.
// Pinned-scrub on desktop; under prefers-reduced-motion OR ≤860px it early-returns
// to a clean static stacked layout (no pinning) where each step shows its own
// inline diagram. All colour comes from global tokens via the CSS module
// (var(--accent), color-mix tints). Decorative SVG is aria-hidden; the real
// headings live in the DOM. SSR-stable — no Math.random at render.

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

// Per-step line-icon glyph (small stroke-only line art; coloured by CSS).
function StepGlyph({ i }: { i: number }) {
  const common = {
    width: 26,
    height: 26,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  if (i === 0) {
    return (
      <svg {...common}>
        <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7a2.5 2.5 0 0 1-2.5 2.5H9l-4 3.5v-3.5H6.5A2.5 2.5 0 0 1 4 13.5Z" />
        <path d="M9 9.5h6M9 12h3.5" />
      </svg>
    );
  }
  if (i === 1) {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="2.4" />
        <path d="M3.5 5.5 9.7 10.4M20.5 5.5 14.3 10.4M3.5 18.5 9.7 13.6M20.5 18.5 14.3 13.6" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="8" />
      <path d="M8.5 12.2 11 14.6 15.6 9.6" />
    </svg>
  );
}

// The three diagram states as line-art SVG groups. Reused by BOTH the shared
// pinned SVG (overlapping/crossfading) and the per-step inline static diagrams.
function DiagPaths({ i }: { i: number }) {
  if (i === 0) {
    // input line + blinking cursor + question-mark glyph
    return (
      <>
        <rect x="40" y="118" width="280" height="64" rx="14" className={styles.dShape} />
        <line x1="68" y1="150" x2="180" y2="150" className={styles.dInk} />
        <line x1="190" y1="138" x2="190" y2="162" className={`${styles.dInk} ${styles.cursor}`} />
        <path
          d="M258 138c0-9 7-16 16-16s16 6 16 15c0 9-9 12-13 16-2 2-3 5-3 9"
          className={styles.dInk}
        />
        <circle cx="274" cy="172" r="1.7" className={styles.dDot} />
      </>
    );
  }
  if (i === 1) {
    // four lines converging on a center node ("the analysts")
    return (
      <>
        <line x1="48" y1="60" x2="170" y2="142" className={styles.dInk} />
        <line x1="312" y1="60" x2="190" y2="142" className={styles.dInk} />
        <line x1="48" y1="240" x2="170" y2="158" className={styles.dInk} />
        <line x1="312" y1="240" x2="190" y2="158" className={styles.dInk} />
        <circle cx="42" cy="56" r="4" className={styles.dDot} />
        <circle cx="318" cy="56" r="4" className={styles.dDot} />
        <circle cx="42" cy="244" r="4" className={styles.dDot} />
        <circle cx="318" cy="244" r="4" className={styles.dDot} />
        <circle cx="180" cy="150" r="22" className={styles.dShape} />
        <circle cx="180" cy="150" r="7" className={styles.dFill} />
      </>
    );
  }
  // one solid node + "How sure: High" pill
  return (
    <>
      <circle cx="132" cy="150" r="26" className={styles.dShape} />
      <circle cx="132" cy="150" r="11" className={styles.dFill} />
      <path d="M124 150 130 156 142 143" className={styles.dCheck} />
      <rect x="186" y="134" width="138" height="34" rx="17" className={styles.dPill} />
      <circle cx="206" cy="151" r="4.5" className={styles.dFill} />
      <text x="222" y="156" className={styles.dPillText}>
        How sure: High
      </text>
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

    const numEls = Array.from(section.querySelectorAll<HTMLElement>(`.${styles.numeral}`));
    const stationEls = Array.from(section.querySelectorAll<HTMLElement>(`.${styles.station}`));
    const copyEls = Array.from(section.querySelectorAll<HTMLElement>(`.${styles.copy}`));
    const diagEls = Array.from(section.querySelectorAll<HTMLElement>(`.${styles.diagState}`));
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
        el.style.transform = `translateY(${((pos - i) * -16).toFixed(1)}px)`;
        el.style.pointerEvents = active ? "auto" : "none";
        el.classList.toggle(styles.isActive, active);
      });

      diagEls.forEach((el, i) => {
        const ad = Math.abs(pos - i);
        el.style.opacity = `${clamp(0, 1, 1 - ad * 1.9)}`;
        el.style.transform = `scale(${(1 - ad * 0.05).toFixed(3)})`;
        el.classList.toggle(styles.isActive, ad < 0.5);
      });

      const activeIdx = Math.round(pos);
      numEls.forEach((el, i) => el.classList.toggle(styles.isActive, i === activeIdx));
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
          {/* ── LEFT: dotted rail + numerals + crossfading copy ─────────── */}
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

            <ol className={styles.numerals} aria-hidden="true">
              {STEPS.map((s) => (
                <li className={styles.numeral} key={s.n}>
                  {s.n}
                </li>
              ))}
            </ol>

            <div className={styles.copyStack}>
              {STEPS.map((s, i) => (
                <div
                  className={`${styles.copy}${i === 0 ? " " + styles.isActive : ""}`}
                  key={s.n}
                >
                  <span className={styles.glyph} aria-hidden="true">
                    <StepGlyph i={i} />
                  </span>
                  <h3 className={styles.copyTitle}>
                    <span className={styles.copyNum} aria-hidden="true">
                      {s.n}
                    </span>
                    {s.title}
                  </h3>
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

          {/* ── RIGHT: one shared line-art SVG, three crossfading states ─── */}
          <div className={styles.right}>
            <div className={styles.diagram}>
              <svg className={styles.diagSvg} viewBox="0 0 360 300" fill="none" aria-hidden="true">
                {STEPS.map((s, i) => (
                  <g
                    className={`${styles.diagState}${i === 0 ? " " + styles.isActive : ""}`}
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
