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

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.trim().replace("#", "");
  const v =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h;
  const n = parseInt(v || "000000", 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const clamp = (lo: number, hi: number, x: number) => Math.max(lo, Math.min(hi, x));

export function LandingMotion() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
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

    // ── Interactive line-field background ─────────────────────────────────────────
    const canvas = canvasRef.current;
    if (canvas && !reduce) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        const cs = getComputedStyle(document.documentElement);
        const tan = hexToRgb(cs.getPropertyValue("--border-strong") || "#C9B991");
        const teal = hexToRgb(cs.getPropertyValue("--accent") || "#0E7978");
        let w = 0;
        let h = 0;
        let lineCount = 14;
        const mouse = { x: -9999, y: -9999, on: false };

        const size = () => {
          const dpr = Math.min(2, window.devicePixelRatio || 1);
          w = window.innerWidth;
          h = window.innerHeight;
          lineCount = w < 640 ? 9 : w < 1024 ? 12 : 16;
          canvas.width = Math.round(w * dpr);
          canvas.height = Math.round(h * dpr);
          canvas.style.width = `${w}px`;
          canvas.style.height = `${h}px`;
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        };
        size();

        let raf = 0;
        let running = true;
        const draw = (t: number) => {
          if (!running) return;
          ctx.clearRect(0, 0, w, h);
          const step = w < 640 ? 22 : 16;
          for (let i = 0; i < lineCount; i++) {
            const baseY = (h * (i + 0.5)) / lineCount;
            // proximity of this whole line to the cursor → brightness + teal blend
            const near = mouse.on
              ? Math.exp(-((baseY - mouse.y) ** 2) / (140 * 140))
              : 0;
            const blend = near * 0.85;
            const r = Math.round(tan[0] + (teal[0] - tan[0]) * blend);
            const g = Math.round(tan[1] + (teal[1] - tan[1]) * blend);
            const b = Math.round(tan[2] + (teal[2] - tan[2]) * blend);
            const alpha = 0.06 + near * 0.2;
            ctx.beginPath();
            for (let x = 0; x <= w; x += step) {
              let y =
                baseY +
                Math.sin(x * 0.004 + t * 0.0004 + i * 0.7) * 10 +
                Math.sin(x * 0.011 - t * 0.0006 + i) * 5;
              if (mouse.on) {
                const dx = x - mouse.x;
                const d2 = dx * dx + (baseY - mouse.y) ** 2;
                y -= Math.exp(-d2 / (150 * 150)) * 26; // bow toward the cursor
              }
              if (x === 0) ctx.moveTo(x, y);
              else ctx.lineTo(x, y);
            }
            ctx.strokeStyle = `rgba(${r},${g},${b},${alpha})`;
            ctx.lineWidth = 1;
            ctx.stroke();
          }
          raf = requestAnimationFrame(draw);
        };
        raf = requestAnimationFrame(draw);

        const onMouse = (e: MouseEvent) => {
          mouse.x = e.clientX;
          mouse.y = e.clientY;
          mouse.on = true;
        };
        const onMouseOut = () => {
          mouse.on = false;
        };
        const onResize = () => size();
        const onVis = () => {
          running = !document.hidden;
          if (running) raf = requestAnimationFrame(draw);
          else cancelAnimationFrame(raf);
        };
        window.addEventListener("mousemove", onMouse, { passive: true });
        window.addEventListener("mouseout", onMouseOut);
        window.addEventListener("resize", onResize);
        document.addEventListener("visibilitychange", onVis);
        cleanups.push(() => {
          cancelAnimationFrame(raf);
          running = false;
          window.removeEventListener("mousemove", onMouse);
          window.removeEventListener("mouseout", onMouseOut);
          window.removeEventListener("resize", onResize);
          document.removeEventListener("visibilitychange", onVis);
        });
      }
    }

    return () => {
      land.classList.remove("cvq-motion");
      for (const fn of cleanups) fn();
    };
  }, []);

  return (
    <>
      <canvas ref={canvasRef} className="cvq-amb" aria-hidden="true" />
      <div ref={threadRef} className="cvq-thread" aria-hidden="true">
        <div ref={fillRef} className="cvq-thread-fill" />
      </div>
    </>
  );
}
