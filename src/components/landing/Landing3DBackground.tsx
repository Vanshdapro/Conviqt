"use client";

// LOGGED-OUT LANDING ONLY — the WebGL interactive background (founder-approved
// exception to the no-3D/no-WebGL brand ban, scoped to `.cvq-land`). Digilab-style
// silky dot-wave, recoloured to ALMANAC teal on warm paper: a smooth undulating
// sheet of soft round points that flows with time, parallaxes toward the cursor,
// and drifts as you scroll — crests brighten, the far field fades into the paper.
//
// Driven entirely on the GPU (a ShaderMaterial computes the wave in the vertex
// shader) so it's buttery at 25k points, with no per-frame CPU loop. Points are
// position-jittered + far-faded to kill the grid moiré that makes a regular point
// field look noisy. three.js is dynamically imported (off the initial bundle/SSR);
// one static frame under prefers-reduced-motion; pauses when the tab is hidden.

import { useEffect, useRef } from "react";

const VERT = /* glsl */ `
  uniform float uTime;
  uniform float uScroll;
  uniform float uSize;
  uniform float uPixelRatio;
  attribute float aRnd;
  varying float vH;
  varying float vFade;
  varying float vRnd;
  void main() {
    vec3 p = position;
    float z = p.z + uScroll;
    // one smooth low-frequency swell + a gentle cross-swell = silky rolling hills
    float y = sin(p.x * 0.16 + uTime) * 1.2
            + sin(z * 0.14 + uTime * 0.8) * 1.05
            + sin((p.x + z) * 0.07 + uTime * 0.45) * 0.5;
    p.y = y;
    vH = y;
    vRnd = aRnd;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    float dist = -mv.z;
    vFade = smoothstep(40.0, 8.0, dist);            // fade the noisy far field into paper
    gl_PointSize = min(uSize * uPixelRatio * (210.0 / dist) * (0.7 + aRnd * 0.6), 22.0);
    gl_Position = projectionMatrix * mv;
  }
`;

const FRAG = /* glsl */ `
  precision mediump float;
  uniform vec3 uColor;
  uniform vec3 uColorHi;
  varying float vH;
  varying float vFade;
  varying float vRnd;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = dot(c, c);
    if (d > 0.25) discard;                          // round dot
    float soft = smoothstep(0.25, 0.06, d);         // crisp but soft edge
    vec3 col = mix(uColor, uColorHi, smoothstep(-1.2, 1.6, vH));  // crests brighten
    float a = soft * vFade * (0.5 + vRnd * 0.34);   // subtle per-point twinkle
    gl_FragColor = vec4(col, a);
  }
`;

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
      const color = (name: string, fallback: string) =>
        new THREE.Color((cs.getPropertyValue(name).trim() || fallback) as string);
      const paper = color("--bg-page", "#F5EFE1");
      const teal = color("--accent", "#0E7978");
      const tealHi = teal.clone().lerp(new THREE.Color("#7FE6DA"), 0.6); // luminous teal crest (not washed cream)

      let renderer: import("three").WebGLRenderer;
      try {
        renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
      } catch {
        return; // no WebGL → leave the paper background as-is
      }
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const pr = Math.min(2, window.devicePixelRatio || 1);
      renderer.setPixelRatio(pr);

      let w = window.innerWidth;
      let h = window.innerHeight;
      renderer.setSize(w, h, false);

      const scene = new THREE.Scene();
      scene.fog = new THREE.Fog(paper.getHex(), 16, 44);

      const camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 120);
      camera.position.set(0, 4.3, 11);
      camera.lookAt(0, -0.8, 0);

      // ── Point sheet ────────────────────────────────────────────────────────────
      const GRID = 160;          // 160 × 160 = 25.6k points (GPU-cheap)
      const SEP = 0.46;
      const COUNT = GRID * GRID;
      const positions = new Float32Array(COUNT * 3);
      const rnd = new Float32Array(COUNT);
      const span = (GRID * SEP) / 2;
      let i = 0;
      for (let xi = 0; xi < GRID; xi++) {
        for (let zi = 0; zi < GRID; zi++) {
          // mild jitter breaks the regular grid → no interference moiré, dots stay distinct
          positions[i * 3] = xi * SEP - span + (Math.random() - 0.5) * SEP * 0.4;
          positions[i * 3 + 1] = 0;
          positions[i * 3 + 2] = zi * SEP - span + (Math.random() - 0.5) * SEP * 0.4;
          rnd[i] = Math.random();
          i++;
        }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      geo.setAttribute("aRnd", new THREE.BufferAttribute(rnd, 1));

      const uniforms = {
        uTime: { value: 0 },
        uScroll: { value: 0 },
        uSize: { value: 0.55 },
        uPixelRatio: { value: pr },
        uColor: { value: teal },
        uColorHi: { value: tealHi },
        uFog: { value: paper },
      };
      const mat = new THREE.ShaderMaterial({
        uniforms,
        vertexShader: VERT,
        fragmentShader: FRAG,
        transparent: true,
        depthWrite: false,
        depthTest: false,
      });
      const points = new THREE.Points(geo, mat);
      scene.add(points);

      // ── Interaction ────────────────────────────────────────────────────────────
      const mouse = { x: 0, y: 0 };
      let camX = 0;
      let camY = 4.3;
      let scroll = window.scrollY;

      const render = (timeMs: number) => {
        uniforms.uTime.value = timeMs * 0.0006;
        uniforms.uScroll.value = scroll * 0.004;
        camX += (mouse.x * 1.8 - camX) * 0.04;
        camY += (4.3 - mouse.y * 1.1 - camY) * 0.04;
        camera.position.x = camX;
        camera.position.y = camY;
        camera.lookAt(0, -0.8, 0);
        renderer.render(scene, camera);
      };

      let raf = 0;
      let running = true;
      const loop = (t: number) => {
        if (!running) return;
        render(t);
        raf = requestAnimationFrame(loop);
      };
      render(0); // always paint a first frame (covers tabs that load render-throttled)
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
        if (reduce) render(0);
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
