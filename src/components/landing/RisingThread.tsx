"use client";

// LOGGED-OUT LANDING ONLY — "RisingThread".
// The Noomo "storytelling" signature beat ("a spark becomes a fire"), fully
// recoloured to the ALMANAC palette: warm paper + the one teal accent, on a
// LIGHT background (never dark). A single vertical teal thread DRAWS down the
// centre as you scroll (SVG stroke-dashoffset full→0 mapped to progress), a
// glowing teal node rides its leading edge (positioned with getPointAtLength),
// and one line of large display words cross-fades through three short phrases
// as the node passes each third — resolving in a teal burst on impact.
//
// Pure SVG + CSS + a tiny rAF scroll loop. No WebGL, no canvas, no deps, no
// external images. The decorative SVG is aria-hidden; the three phrases are
// REAL text in the DOM (a visually-hidden <h2> carries the sentence for SR/SEO).
// Self-driven off the pinned-sticky scrub pattern (same as FeatureSequence /
// ConvergeLines), smoothed by Lenis. Under prefers-reduced-motion OR on screens
// ≤860px it early-returns to a finished STATIC layout: thread drawn full, node
// at the bottom, the three phrases stacked and fully visible — no motion, no
// pinning. SSR-stable (no window reads during render). All colour via
// var(--accent) tokens + color-mix; nothing hardcoded.

import { useEffect, useRef } from "react";
import styles from "./RisingThread.module.css";

const clamp = (lo: number, hi: number, x: number) => Math.max(lo, Math.min(hi, x));
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

// The three beats of Conviqt's promise — the "spark → fire" arc.
const PHRASES = ["One question.", "Four analysts.", "One clear answer you can act on."];

// SVG viewBox geometry. A gently easing vertical thread down the centre.
const VB_W = 600;
const VB_H = 1000;
const CX = VB_W / 2;
const Y_TOP = 70;
const Y_BOTTOM = VB_H - 70;
// A hair of horizontal drift gives the line life without reading as a curve.
const THREAD_D = `M ${CX} ${Y_TOP} C ${CX + 36} ${VB_H * 0.34}, ${CX - 36} ${VB_H * 0.66}, ${CX} ${Y_BOTTOM}`;

export function RisingThread() {
  const sectionRef = useRef<HTMLElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const nodeRef = useRef<SVGGElement>(null);
  const ringRef = useRef<SVGCircleElement>(null);
  const burstRef = useRef<SVGCircleElement>(null);
  const phraseRefs = useRef<(HTMLSpanElement | null)[]>([]);

  useEffect(() => {
    const section = sectionRef.current;
    const path = pathRef.current;
    const node = nodeRef.current;
    const ring = ringRef.current;
    const burst = burstRef.current;
    if (!section || !path) return;

    const len = path.getTotalLength();
    // Prime the dash so the path can be "drawn" by shrinking the offset.
    path.style.strokeDasharray = `${len}`;

    const phrases = phraseRefs.current;

    // Place the leading node + draw the thread to a given 0..1 progress.
    const place = (p: number) => {
      path.style.strokeDashoffset = `${len * (1 - p)}`;
      if (node) {
        const pt = path.getPointAtLength(len * p);
        node.setAttribute("transform", `translate(${pt.x} ${pt.y})`);
      }
    };

    // ── Static / reduced-motion / small-screen fallback ──────────────────
    // Finished layout: thread full, node at the bottom, all phrases visible.
    if (
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      window.matchMedia("(max-width: 860px)").matches
    ) {
      section.classList.add(styles.isStatic);
      place(1);
      if (ring) ring.style.opacity = "0";
      if (burst) burst.style.opacity = "1";
      phrases.forEach((el) => {
        if (!el) return;
        el.style.opacity = "1";
        el.style.transform = "none";
      });
      return;
    }

    const n = PHRASES.length;
    let ticking = false;

    const update = () => {
      ticking = false;
      const vh = window.innerHeight;
      const rect = section.getBoundingClientRect();
      const total = section.offsetHeight - vh; // scroll distance while pinned
      const progress = clamp(0, 1, total > 0 ? -rect.top / total : 0);

      // Draw the thread + ride the node on its leading edge.
      place(easeOut(clamp(0, 1, progress)));

      // Cross-fade each phrase: phrase i is centred at (i+0.5)/n. Opacity peaks
      // at its centre and the words rise up + in as the node approaches, then
      // drift up + out as it passes.
      for (let i = 0; i < n; i++) {
        const el = phrases[i];
        if (!el) continue;
        const center = (i + 0.5) / n;
        const d = (progress - center) * n; // -1 … +1 across this phrase's band
        const ad = Math.abs(d);
        const opacity = clamp(0, 1, 1 - ad * 1.9);
        // Rise from below as it enters (d<0), lift away as it leaves (d>0).
        const ty = d < 0 ? d * 34 : d * -30;
        el.style.opacity = `${opacity.toFixed(3)}`;
        el.style.transform = `translateY(${ty.toFixed(1)}px)`;
      }

      // Impact: in the final stretch the ring expands + fades and the solid
      // dot resolves — the "spark becomes a fire" landing.
      const impact = clamp(0, 1, (progress - 0.82) / 0.18);
      const ie = easeOut(impact);
      if (ring) {
        ring.style.opacity = `${(impact * (1 - impact) * 4).toFixed(3)}`; // 0→peak→0
        ring.style.transform = `scale(${(0.2 + ie * 1.6).toFixed(3)})`;
      }
      if (burst) burst.style.opacity = `${ie.toFixed(3)}`;
      if (node) node.style.opacity = `${(1 - impact * 0.85).toFixed(3)}`;
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
    <section ref={sectionRef} className={styles.section} aria-label="How Conviqt works" data-thread-node data-thread-label="The promise">
      <div className={styles.sticky}>
        {/* Real, accessible sentence for screen readers + SEO. */}
        <h2 className={styles.srOnly}>One question. Four analysts. One clear answer you can act on.</h2>

        {/* The drawn thread + riding node + impact burst (decorative). */}
        <svg
          className={styles.svg}
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          preserveAspectRatio="xMidYMid meet"
          aria-hidden="true"
          focusable="false"
        >
          {/* Faint full-height guide so the thread reads as travelling a field. */}
          <path className={styles.guide} d={THREAD_D} />
          {/* The drawn teal thread. */}
          <path ref={pathRef} className={styles.thread} d={THREAD_D} />

          {/* Impact burst at the landing point. */}
          <circle ref={ringRef} className={styles.ring} cx={CX} cy={Y_BOTTOM} r={26} />
          <circle ref={burstRef} className={styles.burst} cx={CX} cy={Y_BOTTOM} r={9} />

          {/* Glowing node riding the leading edge. Default transform parks it
              at the bottom landing point so the no-JS / pre-hydration static
              fallback is already correct; the rAF loop overrides it each frame. */}
          <g ref={nodeRef} className={styles.node} transform={`translate(${CX} ${Y_BOTTOM})`}>
            <circle className={styles.nodeHalo} r={15} />
            <circle className={styles.nodeCore} r={6.5} />
          </g>
        </svg>

        {/* The three cross-fading display phrases (real DOM text). */}
        <div className={styles.phrases} aria-hidden="true">
          {PHRASES.map((p, i) => (
            <span
              key={p}
              className={styles.phrase}
              ref={(el) => {
                phraseRefs.current[i] = el;
              }}
            >
              {p}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

export default RisingThread;
