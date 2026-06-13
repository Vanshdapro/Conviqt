"use client";

// Landing scroll choreography — LOGGED-OUT LANDING ONLY (playbook Phase 6+).
// A single client island that powers four founder-approved, landing-scoped
// effects, all recoloured to ALMANAC tokens (read from CSS vars at runtime so
// they can never drift from the brand):
//
//   1. Interactive line-field background — faint teal/tan signal waves on warm
//      paper that drift and bow toward the cursor (recoloured Noomo/Digilab DNA).
//   2. A teal "thread" that draws down the page as you scroll, with a glowing
//      leading dot and stations (data-thread-node) that light as it passes —
//      the connective line the founder wanted, revealing each screen in turn.
//   3. Scroll reveals (data-reveal / data-fade) + subtle parallax (data-parallax)
//      via one rAF scroll loop.
//   4. Magnetic primary CTAs (data-magnetic).
//
// Everything is no-op under prefers-reduced-motion (also enforced in CSS), runs
// only after mount (no SSR/hydration cost), and tears itself down on unmount.
// Styling lives in app.css under "LANDING MOTION".

import { useEffect, useRef } from "react";

const clamp = (lo: number, hi: number, x: number) => Math.max(lo, Math.min(hi, x));

export function LandingMotion() {
  const threadRef = useRef<HTMLDivElement>(null);
  const fillRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const land = document.querySelector<HTMLElement>(".cvq-land");
    if (!land) return;

    const cleanups: Array<() => void> = [];
    // Arm CSS motion states. Under reduce, the CSS media query neutralises them.
    land.classList.add("cvq-motion");

    // ── Stagger delays ────────────────────────────────────────────────────────
    // Hero intro children + any [data-reveal-group] cascade their --rd offset.
    land
      .querySelectorAll<HTMLElement>(".cvq-land-hero [data-intro]")
      .forEach((el, i) => el.style.setProperty("--rd", `${i * 110}ms`));
    land.querySelectorAll<HTMLElement>("[data-reveal-group]").forEach((group) => {
      group
        .querySelectorAll<HTMLElement>("[data-reveal], [data-fade]")
        .forEach((el, i) => el.style.setProperty("--rd", `${i * 90}ms`));
    });

    // ── Scroll reveals ──────────────────────────────────────────────────────────
    const revealEls = land.querySelectorAll<HTMLElement>("[data-reveal], [data-fade]");
    if (reduce) {
      revealEls.forEach((el) => el.classList.add("is-in"));
    } else {
      const io = new IntersectionObserver(
        (entries, obs) => {
          for (const e of entries) {
            if (e.isIntersecting) {
              e.target.classList.add("is-in");
              obs.unobserve(e.target);
            }
          }
        },
        { rootMargin: "0px 0px -10% 0px", threshold: 0.12 }
      );
      revealEls.forEach((el) => io.observe(el));
      cleanups.push(() => io.disconnect());
    }

    // ── Count-ups ────────────────────────────────────────────────────────────────
    const countEls = land.querySelectorAll<HTMLElement>("[data-countup]");
    const runCount = (el: HTMLElement) => {
      const to = parseFloat(el.dataset.countup || "0");
      const dec = parseInt(el.dataset.countDecimals || "0", 10);
      const suffix = el.dataset.countSuffix || "";
      const fmt = (n: number) => n.toFixed(dec) + suffix;
      if (reduce) {
        el.textContent = fmt(to);
        return;
      }
      const dur = 1100;
      const start = performance.now();
      const tick = (now: number) => {
        const p = clamp(0, 1, (now - start) / dur);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = fmt(to * eased);
        if (p < 1) requestAnimationFrame(tick);
        else el.textContent = fmt(to);
      };
      requestAnimationFrame(tick);
    };
    if (countEls.length) {
      const cio = new IntersectionObserver(
        (entries, obs) => {
          for (const e of entries) {
            if (e.isIntersecting) {
              runCount(e.target as HTMLElement);
              obs.unobserve(e.target);
            }
          }
        },
        { threshold: 0.6 }
      );
      countEls.forEach((el) => cio.observe(el));
      cleanups.push(() => cio.disconnect());
    }

    // ── Magnetic CTAs ─────────────────────────────────────────────────────────────
    if (!reduce && !window.matchMedia("(pointer: coarse)").matches) {
      land.querySelectorAll<HTMLElement>("[data-magnetic]").forEach((el) => {
        const onMove = (ev: MouseEvent) => {
          const r = el.getBoundingClientRect();
          const mx = clamp(-6, 6, (ev.clientX - (r.left + r.width / 2)) * 0.3);
          const my = clamp(-6, 6, (ev.clientY - (r.top + r.height / 2)) * 0.3);
          el.style.setProperty("--mx", `${mx.toFixed(1)}px`);
          el.style.setProperty("--my", `${my.toFixed(1)}px`);
        };
        const onLeave = () => {
          el.style.setProperty("--mx", "0px");
          el.style.setProperty("--my", "0px");
        };
        el.addEventListener("mousemove", onMove);
        el.addEventListener("mouseleave", onLeave);
        cleanups.push(() => {
          el.removeEventListener("mousemove", onMove);
          el.removeEventListener("mouseleave", onLeave);
        });
      });
    }

    // ── Scroll thread + parallax (one shared rAF scroll loop) ────────────────────
    const thread = threadRef.current;
    const fill = fillRef.current;
    const parallaxEls = Array.from(land.querySelectorAll<HTMLElement>("[data-parallax]"));
    let nodes: Array<{ el: HTMLElement; y: number }> = [];

    if (thread && !reduce) {
      const markers = Array.from(land.querySelectorAll<HTMLElement>("[data-thread-node]"));
      const dots = markers.map(() => {
        const d = document.createElement("span");
        d.className = "cvq-thread-node";
        thread.appendChild(d);
        return d;
      });
      const measure = () => {
        const landTop = land.getBoundingClientRect().top + window.scrollY;
        nodes = markers.map((m, i) => {
          const y = m.getBoundingClientRect().top + window.scrollY - landTop;
          dots[i].style.top = `${y}px`;
          return { el: dots[i], y };
        });
      };
      measure();
      // Re-measure when layout shifts (images decoding, font swap, resize).
      const ro = new ResizeObserver(() => measure());
      ro.observe(land);
      cleanups.push(() => ro.disconnect());
    }

    if (!reduce) {
      let ticking = false;
      const update = () => {
        ticking = false;
        const vh = window.innerHeight;
        const scrollY = window.scrollY;
        const readLine = vh * 0.6; // the dot rides ~60% down the viewport

        if (fill && thread) {
          const drawn = clamp(0, thread.clientHeight, scrollY + readLine);
          fill.style.height = `${drawn}px`;
          for (const n of nodes) n.el.classList.toggle("is-on", drawn >= n.y - 2);
        }
        for (const el of parallaxEls) {
          const r = el.getBoundingClientRect();
          const fromCenter = r.top + r.height / 2 - vh / 2;
          const factor = parseFloat(el.dataset.parallax || "0.08");
          el.style.setProperty("--py", `${clamp(-48, 48, -fromCenter * factor).toFixed(1)}px`);
        }
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
      cleanups.push(() => {
        window.removeEventListener("scroll", onScroll);
        window.removeEventListener("resize", onScroll);
      });
    }

    // (The interactive background now lives in <Landing3DBackground/> — WebGL.)

    return () => {
      land.classList.remove("cvq-motion");
      for (const fn of cleanups) fn();
    };
  }, []);

  return (
    <div ref={threadRef} className="cvq-thread" aria-hidden="true">
      <div ref={fillRef} className="cvq-thread-fill" />
    </div>
  );
}
