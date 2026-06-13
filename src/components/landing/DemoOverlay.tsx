"use client";

// LOGGED-OUT LANDING ONLY — a scripted "someone is using it" overlay that sits
// over a real product screenshot inside the Safari-style BrowserFrame. It makes
// each of the three feature screens read like a short screen RECORDING: a
// pointer glides between two hotspots, a soft click-ripple fires at each, a
// caption crossfades two plain-English lines, and a teal "REC" badge ticks in
// the corner.
//
// Pure CSS keyframes — no JS timers. The whole sequence is PAUSED by default and
// RUNS only while its step is active (the FeatureSequence toggles `.is-active`
// on the enclosing `.cvq-seq-step`; the module CSS keys off that global class).
// When the step is inactive — or under prefers-reduced-motion / the small-screen
// static fallback, where no step is ever "active" — the pointer is hidden and a
// single static caption shows instead. Decorative, so aria-hidden; the
// screenshot's alt text remains the accessible content. Hotspot coordinates come
// in as CSS custom properties, so one keyframe set serves every screen.

import type { CSSProperties } from "react";
import styles from "./DemoOverlay.module.css";

export type DemoScript = {
  /** hotspot A / B as percentages of the frame, e.g. "52%" */
  ax: string;
  ay: string;
  bx: string;
  by: string;
  capA: string;
  capB: string;
  /** shown when the step is not actively scrubbing (static / reduced-motion) */
  capStatic: string;
};

export function DemoOverlay({ script }: { script: DemoScript }) {
  const style = {
    ["--ax" as string]: script.ax,
    ["--ay" as string]: script.ay,
    ["--bx" as string]: script.bx,
    ["--by" as string]: script.by,
  } as CSSProperties;

  return (
    <div className={styles.overlay} style={style} aria-hidden="true">
      <span className={styles.rec}>
        <span className={`${styles.recDot} ${styles.demoAnim}`} />
        REC<span className={styles.recTime}>0:08</span>
      </span>

      <span className={`${styles.rippleA} ${styles.demoAnim}`} />
      <span className={`${styles.rippleB} ${styles.demoAnim}`} />

      <span className={`${styles.cursor} ${styles.demoAnim}`}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path
            d="M4 2 L4 18.6 L8.3 14.3 L11.1 20.7 L13.6 19.6 L10.7 13.4 L16.6 13.4 Z"
            className={styles.cursorShape}
          />
        </svg>
      </span>

      <span className={styles.capStatic}>{script.capStatic}</span>
      <span className={`${styles.capA} ${styles.demoAnim}`}>{script.capA}</span>
      <span className={`${styles.capB} ${styles.demoAnim}`}>{script.capB}</span>
    </div>
  );
}
