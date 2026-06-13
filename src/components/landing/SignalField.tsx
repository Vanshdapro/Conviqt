"use client";

// LOGGED-OUT LANDING ONLY — "SignalField", the decorative "the desk is always
// watching the market" field. Digilab.co "data field" aesthetic recoloured to
// ALMANAC tokens: a top-down scatter of small teal nodes on warm paper; a few
// "featured" nodes grow a thin vertical stem up to a small monospace-feel
// readout card; faint concentric sonar rings pulse outward; dotted bracket
// frames draw in around two regions.
//
// Pure SVG + CSS + a tiny rAF scroll loop — NO WebGL/canvas/three.js, no new
// deps, no external images, no colour outside the token set (tints via
// color-mix from var(--accent)). NON-pinned reveal: progress is driven by the
// section passing through the viewport. Under prefers-reduced-motion OR on
// viewports ≤860px it renders the finished field statically (nodes in, stems
// up, cards visible) and the infinite sonar is disabled. Decorative SVG is
// aria-hidden; the real heading text stays in the DOM. All coordinates are
// hardcoded so SSR and client agree (never Math.random at render).

import { useEffect, useRef } from "react";
import styles from "./SignalField.module.css";

const clamp = (lo: number, hi: number, x: number) => Math.max(lo, Math.min(hi, x));
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

// ── The scattered field ────────────────────────────────────────────────────
// Hardcoded pseudo-random positions inside the 1200×560 viewBox. `f` marks a
// featured node (gets a stem + readout card); `s` marks a sonar source.
type Node = { x: number; y: number; r: number; o: number };
const NODES: Node[] = [
  { x: 78, y: 96, r: 3, o: 0.55 },
  { x: 168, y: 240, r: 4, o: 0.7 },
  { x: 132, y: 392, r: 3, o: 0.5 },
  { x: 246, y: 142, r: 5, o: 0.85 },
  { x: 300, y: 320, r: 3, o: 0.6 },
  { x: 360, y: 452, r: 4, o: 0.65 },
  { x: 430, y: 208, r: 3, o: 0.55 },
  { x: 486, y: 360, r: 4, o: 0.7 },
  { x: 548, y: 120, r: 3, o: 0.5 },
  { x: 612, y: 286, r: 5, o: 0.9 },
  { x: 668, y: 430, r: 3, o: 0.55 },
  { x: 726, y: 170, r: 4, o: 0.7 },
  { x: 792, y: 332, r: 3, o: 0.6 },
  { x: 858, y: 96, r: 3, o: 0.5 },
  { x: 906, y: 256, r: 4, o: 0.75 },
  { x: 966, y: 408, r: 3, o: 0.55 },
  { x: 1032, y: 156, r: 4, o: 0.7 },
  { x: 1086, y: 326, r: 3, o: 0.6 },
  { x: 1128, y: 224, r: 3, o: 0.5 },
  { x: 1140, y: 452, r: 3, o: 0.45 },
];

// ── Featured nodes → stem + readout card ────────────────────────────────────
// `stemH` is the vertical stem length (upward); the card sits above the stem.
// NO synthetic prices/percentages — ticker + skill name + conviction WORD only.
type Featured = {
  nx: number; // node x in viewBox units
  ny: number; // node y in viewBox units
  stemH: number; // stem height in viewBox units
  ticker: string;
  skill: string;
  conviction: "High" | "Medium" | "Low";
  // card placement as % of the stage box (HTML overlay, responsive)
  cardLeft: number;
  cardTop: number;
};
const FEATURED: Featured[] = [
  { nx: 246, ny: 142, stemH: 70, ticker: "AAPL", skill: "Worth owning?", conviction: "High", cardLeft: 14.5, cardTop: 3 },
  { nx: 612, ny: 286, stemH: 86, ticker: "NVDA", skill: "Entry & exit zones", conviction: "Medium", cardLeft: 47.5, cardTop: 22.5 },
  { nx: 906, ny: 256, stemH: 78, ticker: "MSFT", skill: "Worth owning?", conviction: "High", cardLeft: 70, cardTop: 17 },
  { nx: 1032, ny: 156, stemH: 66, ticker: "TSM", skill: "Crowd check", conviction: "Low", cardLeft: 80.5, cardTop: 4 },
];

// Sonar sources (subset of featured nodes that pulse rings).
const SONAR = [
  { x: 246, y: 142 },
  { x: 612, y: 286 },
  { x: 906, y: 256 },
];

// Dotted bracket-corner frames around two regions (viewBox units).
type Frame = { x: number; y: number; w: number; h: number };
const FRAMES: Frame[] = [
  { x: 56, y: 64, w: 360, h: 372 },
  { x: 700, y: 100, w: 416, h: 332 },
];
const BRACKET = 30; // corner arm length

export function SignalField() {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const section = ref.current;
    if (!section) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const small = window.matchMedia("(max-width: 860px)").matches;

    // Static finished state: nodes in, stems up, cards visible, no sonar.
    if (reduce || small) {
      section.classList.add(styles.isStatic);
      section.style.setProperty("--p", "1");
      return;
    }

    let ticking = false;
    const update = () => {
      ticking = false;
      const vh = window.innerHeight;
      const rect = section.getBoundingClientRect();
      // Non-pinned reveal: animates as the section passes through the viewport.
      const progress = clamp(0, 1, (vh - rect.top) / (vh + rect.height));
      // A gentle ease so the field "settles" near the centre of its pass.
      const p = easeOut(clamp(0, 1, (progress - 0.12) / 0.6));
      section.style.setProperty("--p", p.toFixed(4));
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
    <section ref={ref} className={styles.signal} aria-labelledby="signal-h" data-thread-node data-thread-label="Always watching">
      <div className={styles.head}>
        <p className="cvq-land-eyebrow">Always watching</p>
        <h2 id="signal-h" className="cvq-land-h2">
          A constant read on the market.
        </h2>
        <p className="cvq-land-lede">
          Your analysts keep a quiet eye on the names that matter — so the moment you ask, the read is already taking shape.
        </p>
      </div>

      <div className={styles.stage}>
        {/* ── Decorative field ─────────────────────────────────────────── */}
        <svg
          className={styles.svg}
          viewBox="0 0 1200 560"
          preserveAspectRatio="xMidYMid meet"
          aria-hidden="true"
          focusable="false"
        >
          {/* dotted bracket-corner frames */}
          {FRAMES.map((f, i) => {
            const r = f.x + f.w;
            const b = f.y + f.h;
            const d = [
              // top-left
              `M ${f.x} ${f.y + BRACKET} L ${f.x} ${f.y} L ${f.x + BRACKET} ${f.y}`,
              // top-right
              `M ${r - BRACKET} ${f.y} L ${r} ${f.y} L ${r} ${f.y + BRACKET}`,
              // bottom-right
              `M ${r} ${b - BRACKET} L ${r} ${b} L ${r - BRACKET} ${b}`,
              // bottom-left
              `M ${f.x + BRACKET} ${b} L ${f.x} ${b} L ${f.x} ${b - BRACKET}`,
            ].join(" ");
            return (
              <path
                key={`frame-${i}`}
                className={styles.frame}
                style={{ ["--i" as string]: i }}
                d={d}
              />
            );
          })}

          {/* faint dotted connector lines between a few nodes */}
          <path className={styles.connector} d="M 246 142 L 612 286" />
          <path className={styles.connector} d="M 612 286 L 906 256" />
          <path className={styles.connector} d="M 906 256 L 1032 156" />

          {/* sonar rings — subtle CSS keyframe loop, disabled when static */}
          {SONAR.map((s, i) => (
            <g key={`sonar-${i}`} className={styles.sonar} style={{ ["--d" as string]: `${i * 1.1}s` }}>
              <circle className={styles.ring} cx={s.x} cy={s.y} r="10" />
              <circle className={`${styles.ring} ${styles.ring2}`} cx={s.x} cy={s.y} r="10" />
            </g>
          ))}

          {/* vertical stems from featured nodes up to their card anchor */}
          {FEATURED.map((f, i) => (
            <line
              key={`stem-${i}`}
              className={styles.stem}
              style={{ ["--i" as string]: i }}
              x1={f.nx}
              y1={f.ny}
              x2={f.nx}
              y2={f.ny - f.stemH}
            />
          ))}

          {/* the scattered nodes */}
          {NODES.map((n, i) => (
            <circle
              key={`node-${i}`}
              className={styles.node}
              style={{
                ["--o" as string]: n.o,
                // stagger by horizontal position so the field "wipes" in
                ["--delay" as string]: (n.x / 1200).toFixed(3),
              }}
              cx={n.x}
              cy={n.y}
              r={n.r}
            />
          ))}

          {/* bright halo on the featured node heads */}
          {FEATURED.map((f, i) => (
            <circle
              key={`head-${i}`}
              className={styles.head2}
              style={{ ["--i" as string]: i }}
              cx={f.nx}
              cy={f.ny}
              r="5.5"
            />
          ))}
        </svg>

        {/* ── Readout cards (HTML overlay, positioned over the stage) ───── */}
        <div className={styles.cards} aria-hidden="true">
          {FEATURED.map((f, i) => (
            <div
              key={`card-${i}`}
              className={styles.card}
              style={{
                left: `${f.cardLeft}%`,
                top: `${f.cardTop}%`,
                ["--i" as string]: i,
              }}
            >
              <span className={styles.cardMeta}>Readout</span>
              <span className={styles.cardTicker}>{f.ticker}</span>
              <span className={styles.cardSkill}>{f.skill}</span>
              <span className={styles.pill}>How sure: {f.conviction}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
