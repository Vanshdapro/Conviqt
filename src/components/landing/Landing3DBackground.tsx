"use client";

// LOGGED-OUT LANDING ONLY — the WebGL interactive background (founder-approved
// exception to the no-3D/no-WebGL brand ban, scoped to `.cvq-land`). Recoloured
// Noomo/Digilab DNA: a flowing 3D point-terrain in teal on warm paper that
// recedes into depth fog, parallaxes toward the cursor, and morphs as you
// scroll — the "fly over a living data surface" feel.
//
// three.js is dynamically imported inside the effect so it never touches the
// initial bundle or SSR. Degrades to a single static frame under
// prefers-reduced-motion, and pauses when the tab is hidden. Colours are read
// from the ALMANAC CSS vars at runtime so the field can never drift off-brand.

import { useEffect, useRef } from "react";

export function Landing3DBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let disposed = false;
    let cleanup = () => {};

    (async () => {
      const THREE = await import("three");
      if (disposed) return;

      const cs = getComputedStyle(document.documentElement);
      const hex = (name: string, fallback: string) =>
        new THREE.Color((cs.getPropertyValue(name).trim() || fallback) as string);
      const paper = hex("--bg-page", "#F5EFE1");
      const teal = hex("--accent", "#0E7978");
      const tealDeep = hex("--accent-hover", "#0A5F5D");

      let renderer: import("three").WebGLRenderer;
      try {
        renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
      } catch {
        return; // no WebGL → leave the paper background as-is
      }
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));

      let w = window.innerWidth;
      let h = window.innerHeight;
      renderer.setSize(w, h, false);

      const scene = new THREE.Scene();
      scene.fog = new THREE.Fog(paper.getHex(), 9, 30);

      const camera = new THREE.PerspectiveCamera(52, w / h, 0.1, 100);
      camera.position.set(0, 4.4, 11);
      camera.lookAt(0, -0.6, 0);

      // ── Point terrain ────────────────────────────────────────────────────────
      const GRID = 150;          // 150 × 150 = 22.5k points
      const SEP = 0.42;
      const COUNT = GRID * GRID;
      const positions = new Float32Array(COUNT * 3);
      const colors = new Float32Array(COUNT * 3);
      const baseX = new Float32Array(COUNT);
      const baseZ = new Float32Array(COUNT);
      const span = (GRID * SEP) / 2;
      let p = 0;
      for (let xi = 0; xi < GRID; xi++) {
        for (let zi = 0; zi < GRID; zi++) {
          const x = xi * SEP - span;
          const z = zi * SEP - span;
          baseX[p] = x;
          baseZ[p] = z;
          positions[p * 3] = x;
          positions[p * 3 + 1] = 0;
          positions[p * 3 + 2] = z;
          // subtle teal→deep-teal gradient across the field for life
          const t = (xi + zi) / (GRID * 2);
          const c = teal.clone().lerp(tealDeep, t);
          colors[p * 3] = c.r;
          colors[p * 3 + 1] = c.g;
          colors[p * 3 + 2] = c.b;
          p++;
        }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));

      // soft round sprite so points read as premium dots, not square pixels
      const dot = (() => {
        const c = document.createElement("canvas");
        c.width = c.height = 64;
        const g = c.getContext("2d")!;
        const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
        grad.addColorStop(0, "rgba(255,255,255,1)");
        grad.addColorStop(0.45, "rgba(255,255,255,0.55)");
        grad.addColorStop(1, "rgba(255,255,255,0)");
        g.fillStyle = grad;
        g.fillRect(0, 0, 64, 64);
        return new THREE.CanvasTexture(c);
      })();

      const mat = new THREE.PointsMaterial({
        size: 0.5,
        map: dot,
        vertexColors: true,
        transparent: true,
        opacity: 0.62,
        sizeAttenuation: true,
        depthWrite: false,
      });
      const points = new THREE.Points(geo, mat);
      scene.add(points);

      // ── Interaction state ──────────────────────────────────────────────────────
      const pos = geo.attributes.position.array as Float32Array;
      const mouse = { x: 0, y: 0 };
      let camX = 0;
      let camY = 4.4;
      let scroll = window.scrollY;

      const wave = (time: number) => {
        const sFlow = scroll * 0.006; // scrolling flows the terrain toward you
        for (let k = 0; k < COUNT; k++) {
          const x = baseX[k];
          const z = baseZ[k] + sFlow;
          pos[k * 3 + 1] =
            Math.sin(x * 0.3 + time) * 0.45 +
            Math.cos(z * 0.4 + time * 0.85) * 0.4 +
            Math.sin((x + z) * 0.2 + time * 0.5) * 0.28;
        }
        geo.attributes.position.needsUpdate = true;
      };

      const draw = (time: number) => {
        wave(time);
        // ease camera toward cursor for a 3D parallax tilt
        camX += (mouse.x * 1.6 - camX) * 0.045;
        camY += (4.4 - mouse.y * 1.1 - camY) * 0.045;
        camera.position.x = camX;
        camera.position.y = camY;
        camera.lookAt(0, -0.6, 0);
        renderer.render(scene, camera);
      };

      let raf = 0;
      let running = true;
      const loop = (t: number) => {
        if (!running) return;
        draw(t * 0.001);
        raf = requestAnimationFrame(loop);
      };

      draw(0); // always paint a first frame (covers tabs that load render-throttled)
      if (!reduce) raf = requestAnimationFrame(loop);

      // ── Listeners ────────────────────────────────────────────────────────────
      const onMouse = (e: MouseEvent) => {
        mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
        mouse.y = (e.clientY / window.innerHeight) * 2 - 1;
      };
      const onScroll = () => {
        scroll = window.scrollY;
      };
      const onResize = () => {
        w = window.innerWidth;
        h = window.innerHeight;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h, false);
        if (reduce) draw(0);
      };
      const onVis = () => {
        running = !document.hidden && !reduce;
        if (running) raf = requestAnimationFrame(loop);
        else cancelAnimationFrame(raf);
      };
      window.addEventListener("mousemove", onMouse, { passive: true });
      window.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("resize", onResize);
      document.addEventListener("visibilitychange", onVis);

      cleanup = () => {
        running = false;
        cancelAnimationFrame(raf);
        window.removeEventListener("mousemove", onMouse);
        window.removeEventListener("scroll", onScroll);
        window.removeEventListener("resize", onResize);
        document.removeEventListener("visibilitychange", onVis);
        geo.dispose();
        mat.dispose();
        dot.dispose();
        renderer.dispose();
      };
    })();

    return () => {
      disposed = true;
      cleanup();
    };
  }, []);

  return <canvas ref={canvasRef} className="cvq-amb" aria-hidden="true" />;
}
