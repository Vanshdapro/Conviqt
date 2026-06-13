"use client";

// LOGGED-OUT LANDING ONLY — the signature scroll-scrubbed "convergence".
// Founder's brief, verbatim-ish: lines "come from all different directions …
// and then they reunite / come together." That is literally Conviqt's pitch —
// four analysts (Fundamentals · Technicals · Sentiment · Macro) each follow
// their own line in from a different edge, signal pulses ride those lines, and
// they all reunite at one verdict node that ignites into a single clear answer.
//
// Pure SVG, recoloured to ALMANAC tokens (teal lines/nodes on warm paper — no
// WebGL, no colour outside the set). Self-driven off window.scrollY (smoothed by
// Lenis) using the same pinned-sticky scrub pattern as FeatureSequence. Under
// prefers-reduced-motion or on small screens it renders the finished diagram,
// statically, no pinning. Styling lives in app.css under "LANDING MOTION".

import { useEffect, useRef } from "react";

const clamp = (lo: number, hi: number, x: number) => Math.max(lo, Math.min(hi, x));
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

type Lane = {
  id: string;
  label: string;
  blurb: string;
  // path control points in the 1200×620 viewBox (start at an edge → curve to centre)
  d: string;
};

// Centre of convergence.
const CX = 600;
const CY = 312;

const LANES: Lane[] = [
  {
    id: "fundamentals",
    label: "Fundamentals",
    blurb: "Is the business actually worth owning?",
    d: `M 96 86 C 300 150, 360 300, ${CX} ${CY}`,
  },
  {
    id: "technicals",
    label: "Technicals",
    blurb: "Where the smart levels sit.",
    d: `M 1104 86 C 900 150, 840 300, ${CX} ${CY}`,
  },
  {
    id: "sentiment",
    label: "Sentiment",
    blurb: "What the crowd is feeling vs the data.",
    d: `M 96 538 C 300 474, 360 324, ${CX} ${CY}`,
  },
  {
    id: "macro",
    label: "Macro",
    blurb: "The weather the whole market trades in.",
    d: `M 1104 538 C 900 474, 840 324, ${CX} ${CY}`,
  },
];

export function ConvergeLines() {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const section = ref.current;
    if (!section) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const small = window.matchMedia("(max-width: 860px)").matches;

    const paths = Array.from(section.querySelectorAll<SVGPathElement>("path[data-lane]"));
    const pulses = Array.from(section.querySelectorAll<SVGCircleElement>("circle[data-pulse]"));
    const labels = Array.from(section.querySelectorAll<HTMLElement>("[data-lane-label]"));
    const core = section.querySelector<SVGGElement>("[data-core]");
    const verdict = section.querySelector<HTMLElement>("[data-verdict]");

    // Prime each path so it can be "drawn" by stroke-dashoffset.
    const lens = paths.map((p) => {
      const L = p.getTotalLength();
      p.style.strokeDasharray = `${L}`;
      return L;
    });

    // Static (no scrub): show the finished, reunited diagram and stop.
    if (reduce || small) {
      section.classList.add("cvq-cv--static");
      paths.forEach((p) => (p.style.strokeDashoffset = "0"));
      pulses.forEach((c, i) => {
        const pt = paths[i].getPointAtLength(lens[i]);
        c.setAttribute("cx", `${pt.x}`);
        c.setAttribute("cy", `${pt.y}`);
        c.style.opacity = "0";
      });
      labels.forEach((l) => l.classList.add("is-in"));
      core?.classList.add("is-on");
      verdict?.classList.add("is-in");
      return;
    }

    let ticking = false;
    const update = () => {
      ticking = false;
      const vh = window.innerHeight;
      const rect = section.getBoundingClientRect();
      const total = section.offsetHeight - vh; // scroll distance while pinned
      const progress = total > 0 ? clamp(0, 1, -rect.top / total) : 0;

      // Phase map: lines draw + pulses ride in over 0–0.72, then the core
      // ignites and the verdict resolves over 0.6–1.0.
      const draw = easeOut(clamp(0, 1, progress / 0.72));
      const ignite = clamp(0, 1, (progress - 0.6) / 0.4);

      paths.forEach((p, i) => {
        // Stagger lanes a touch so they don't all land on the exact same frame.
        const local = easeOut(clamp(0, 1, (draw - i * 0.04) / (1 - i * 0.04)));
        p.style.strokeDashoffset = `${(lens[i] * (1 - local)).toFixed(1)}`;
        const pt = p.getPointAtLength(lens[i] * local);
        const c = pulses[i];
        c.setAttribute("cx", `${pt.x.toFixed(1)}`);
        c.setAttribute("cy", `${pt.y.toFixed(1)}`);
        // pulse is brightest mid-journey, fades as it merges into the core
        c.style.opacity = `${(clamp(0, 1, local * 1.6) * (1 - ignite)).toFixed(2)}`;
        const lbl = labels[i];
        if (lbl) lbl.classList.toggle("is-in", local > 0.12);
      });

      if (core) {
        core.style.setProperty("--ignite", ignite.toFixed(3));
        core.classList.toggle("is-on", ignite > 0.02);
      }
      if (verdict) verdict.classList.toggle("is-in", ignite > 0.55);
      section.classList.toggle("cvq-cv--reunited", progress > 0.82);
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
    <section ref={ref} className="cvq-cv" data-thread-node data-thread-label="Your team" aria-labelledby="cv-h">
      <div className="cvq-cv-sticky">
        <div className="cvq-cv-head">
          <p className="cvq-land-eyebrow">Your team</p>
          <h2 id="cv-h" className="cvq-land-h2">
            Four analysts. One clear answer.
          </h2>
          <p className="cvq-land-lede">
            Every question runs four lines of research at once — then they reunite into a single
            plain-English verdict, with sources you can open.
          </p>
        </div>

        <div className="cvq-cv-stage">
          <svg className="cvq-cv-svg" viewBox="0 0 1200 620" role="img" aria-label="Four research lines converging into one verdict" preserveAspectRatio="xMidYMid meet">
            {/* faint full tracks the signal lines draw over */}
            {LANES.map((l) => (
              <path key={`${l.id}-track`} className="cvq-cv-track" d={l.d} />
            ))}
            {/* the drawn signal lines */}
            {LANES.map((l) => (
              <path key={l.id} data-lane={l.id} className="cvq-cv-line" d={l.d} />
            ))}
            {/* travelling signal pulses that ride each line into the centre */}
            {LANES.map((l) => (
              <circle key={`${l.id}-pulse`} data-pulse={l.id} className="cvq-cv-pulse" r="6" cx="0" cy="0" />
            ))}
            {/* the verdict core that ignites once the lines reunite */}
            <g data-core className="cvq-cv-core">
              <circle className="cvq-cv-core-halo" cx={CX} cy={CY} r="58" />
              <circle className="cvq-cv-core-ring" cx={CX} cy={CY} r="30" />
              <circle className="cvq-cv-core-dot" cx={CX} cy={CY} r="11" />
            </g>
          </svg>

          {/* lane labels, positioned over the four corners */}
          <div className="cvq-cv-labels" aria-hidden="true">
            {LANES.map((l) => (
              <span key={l.id} data-lane-label className={`cvq-cv-label cvq-cv-label--${l.id}`}>
                <b>{l.label}</b>
                <i>{l.blurb}</i>
              </span>
            ))}
          </div>

          {/* the reunited verdict, revealed at the centre */}
          <div data-verdict className="cvq-cv-verdict" aria-hidden="true">
            <span className="cvq-cv-verdict-q">Worth owning?</span>
            <span className="cvq-cv-verdict-a">How sure: High</span>
          </div>
        </div>
      </div>
    </section>
  );
}
