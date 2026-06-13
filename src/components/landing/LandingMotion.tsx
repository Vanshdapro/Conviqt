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
  const labelRef = useRef<HTMLSpanElement>(null);

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

    // ── Scroll tracker rail + parallax (one shared rAF scroll loop) ──────────────
    // The rail is position:fixed (100vh). Its teal fill grows top→bottom with
    // whole-document scroll progress; each [data-thread-node] section gets a
    // station tick placed at the progress fraction where its top reaches mid-
    // viewport, lit as the leading node arrives; a label rides the node calling
    // out the current section. This is the founder's "line that gets further
    // down as I scroll" — now fixed, on top, and impossible to occlude.
    const thread = threadRef.current;
    const fill = fillRef.current;
    const label = labelRef.current;
    const parallaxEls = Array.from(land.querySelectorAll<HTMLElement>("[data-parallax]"));
    let nodes: Array<{ el: HTMLElement; frac: number; label: string }> = [];
    let railH = window.innerHeight;
    let docScroll = 1;

    if (thread && !reduce) {
      const markers = Array.from(land.querySelectorAll<HTMLElement>("[data-thread-node]"));
      const dots = markers.map(() => {
        const d = document.createElement("span");
        d.className = "cvq-thread-node";
        thread.appendChild(d);
        return d;
      });
      // The dots are created imperatively, so remove them on teardown — otherwise
      // StrictMode's double-invoke and every HMR re-run would stack duplicates.
      cleanups.push(() => dots.forEach((d) => d.remove()));
      const measure = () => {
        railH = window.innerHeight;
        docScroll = Math.max(1, document.documentElement.scrollHeight - railH);
        nodes = markers.map((m, i) => {
          const docTop = m.getBoundingClientRect().top + window.scrollY;
          const frac = clamp(0, 1, (docTop - railH * 0.5) / docScroll);
          dots[i].style.top = `${(frac * railH).toFixed(1)}px`;
          return {
            el: dots[i],
            frac,
            label: m.dataset.threadLabel || m.getAttribute("aria-label") || "",
          };
        });
      };
      measure();
      // Re-measure when layout shifts (images decoding, font swap, resize).
      const ro = new ResizeObserver(() => measure());
      ro.observe(land);
      cleanups.push(() => ro.disconnect());
      // expose so the scroll loop can trigger a re-measure on resize
      (thread as HTMLElement & { _measure?: () => void })._measure = measure;
    }

    if (!reduce) {
      let ticking = false;
      const update = () => {
        ticking = false;
        const vh = window.innerHeight;
        const scrollY = window.scrollY;

        if (fill && thread) {
          const progress = clamp(0, 1, scrollY / docScroll);
          const drawn = progress * railH;
          fill.style.height = `${drawn.toFixed(1)}px`;
          let current = "";
          for (const n of nodes) {
            const on = progress >= n.frac - 0.001;
            n.el.classList.toggle("is-on", on);
            if (on && n.label) current = n.label;
          }
          if (label) {
            label.style.top = `${drawn.toFixed(1)}px`;
            const slot = label.firstElementChild;
            if (slot && slot.textContent !== current) slot.textContent = current;
            label.classList.toggle("is-on", current !== "" && progress < 0.992);
          }
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
      const onResize = () => {
        (thread as (HTMLElement & { _measure?: () => void }) | null)?._measure?.();
        onScroll();
      };
      update();
      window.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("resize", onResize);
      cleanups.push(() => {
        window.removeEventListener("scroll", onScroll);
        window.removeEventListener("resize", onResize);
      });
    }

    return () => {
      land.classList.remove("cvq-motion");
      for (const fn of cleanups) fn();
    };
  }, []);

  return (
    <div ref={threadRef} className="cvq-thread" aria-hidden="true">
      <div ref={fillRef} className="cvq-thread-fill" />
      <span ref={labelRef} className="cvq-thread-label">
        <span />
      </span>
    </div>
  );
}
