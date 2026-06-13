"use client";

// LOGGED-OUT LANDING ONLY — the pinned, scroll-scrubbed feature sequence
// (Digilab DNA): one browser frame stays pinned while scrolling scrubs it
// through the product screens, captions crossfading and a step-rail tracking
// progress. Replaces the three static feature rows with a single piece of
// scroll choreography. Driven by window.scrollY (kept smooth by Lenis); under
// prefers-reduced-motion it collapses to a plain stacked list (.cvq-seq--static).

import { useEffect, useRef } from "react";
import { BrowserFrame } from "./DeviceFrame";

export type FeatureStep = {
  eyebrow: string;
  title: string;
  body: string;
  src: string;
  alt: string;
  width: number;
  height: number;
  url: string;
};

const clamp = (lo: number, hi: number, x: number) => Math.max(lo, Math.min(hi, x));

export function FeatureSequence({ steps }: { steps: FeatureStep[] }) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const section = ref.current;
    if (!section) return;
    // No pinned scrub under reduced-motion or on small screens — fall back to a
    // plain stacked list (the scrub needs height + a pointer that can hover-scroll).
    if (
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      window.matchMedia("(max-width: 860px)").matches
    ) {
      section.classList.add("cvq-seq--static");
      return;
    }
    const stepEls = Array.from(section.querySelectorAll<HTMLElement>(".cvq-seq-step"));
    const dotEls = Array.from(section.querySelectorAll<HTMLElement>(".cvq-seq-dot"));
    const fill = section.querySelector<HTMLElement>(".cvq-seq-railfill");
    const n = stepEls.length;
    let ticking = false;

    const update = () => {
      ticking = false;
      const vh = window.innerHeight;
      const rect = section.getBoundingClientRect();
      const total = section.offsetHeight - vh; // scroll distance while pinned
      const scrolled = clamp(0, total, -rect.top);
      const progress = total > 0 ? scrolled / total : 0;
      const pos = progress * (n - 1); // 0 … n-1
      stepEls.forEach((el, i) => {
        const d = pos - i;
        const ad = Math.abs(d);
        el.style.opacity = `${clamp(0, 1, 1 - ad * 1.45)}`;
        el.style.transform = `translateY(${(d * -26).toFixed(1)}px) scale(${(1 - ad * 0.04).toFixed(3)})`;
        el.style.pointerEvents = ad < 0.5 ? "auto" : "none";
        el.classList.toggle("is-active", ad < 0.5);
      });
      dotEls.forEach((dot, i) => dot.classList.toggle("is-on", Math.round(pos) === i));
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
      className="cvq-seq"
      data-thread-node
      data-thread-label="Inside"
      aria-label="What's inside"
      style={{ ["--steps" as string]: steps.length }}
    >
      <div className="cvq-seq-sticky">
        <div className="cvq-seq-track">
          {steps.map((s, i) => (
            <article className="cvq-seq-step" data-i={i} key={s.eyebrow}>
              <div className="cvq-seq-copy">
                <p className="cvq-land-eyebrow">{s.eyebrow}</p>
                <h2 className="cvq-land-h2">{s.title}</h2>
                <p className="cvq-seq-body">{s.body}</p>
              </div>
              <div className="cvq-seq-stage">
                <BrowserFrame src={s.src} alt={s.alt} width={s.width} height={s.height} url={s.url} />
              </div>
            </article>
          ))}
        </div>
        <div className="cvq-seq-rail" aria-hidden="true">
          <span className="cvq-seq-railtrack">
            <span className="cvq-seq-railfill" />
          </span>
          {steps.map((s, i) => (
            <span className="cvq-seq-dot" data-i={i} key={s.eyebrow} />
          ))}
        </div>
      </div>
    </section>
  );
}
