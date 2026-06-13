"use client";

// LOGGED-OUT LANDING ONLY — buttery inertia scroll (Lenis), the foundation of
// the Noomo/Digilab "expensive" feel. Mounted only on `/`, so the signed-in app
// keeps native scrolling untouched. Lenis drives real scroll (so window.scrollY,
// scroll events, and position:sticky all keep working for the thread/parallax/
// pinned sequence), routes in-page anchor links through lenis.scrollTo, and is
// fully disabled under prefers-reduced-motion.

import { useEffect } from "react";

export function SmoothScroll() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let lenis: import("lenis").default | null = null;
    let raf = 0;
    let disposed = false;

    (async () => {
      const Lenis = (await import("lenis")).default;
      if (disposed) return;
      lenis = new Lenis({
        lerp: 0.09,
        wheelMultiplier: 1,
        smoothWheel: true,
      });
      const loop = (time: number) => {
        lenis?.raf(time);
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);

      // route same-page anchor links (#track-record, #pricing, …) through Lenis
      const onClick = (e: MouseEvent) => {
        const a = (e.target as HTMLElement)?.closest?.('a[href^="#"]') as HTMLAnchorElement | null;
        if (!a) return;
        const id = a.getAttribute("href");
        if (!id || id === "#") return;
        const target = document.querySelector(id);
        if (target) {
          e.preventDefault();
          lenis?.scrollTo(target as HTMLElement, { offset: -72, duration: 1.1 });
        }
      };
      document.addEventListener("click", onClick);
      (lenis as unknown as { _onClick?: (e: MouseEvent) => void })._onClick = onClick;
    })();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      const onClick = (lenis as unknown as { _onClick?: (e: MouseEvent) => void })?._onClick;
      if (onClick) document.removeEventListener("click", onClick);
      lenis?.destroy();
    };
  }, []);

  return null;
}
