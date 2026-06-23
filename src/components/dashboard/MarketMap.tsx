"use client";

// The Map — marquee visual of the Dashboard "Lens" trilogy.
//
// A 2D, hand-rolled force-directed graph of the market on <canvas>: index nodes
// pinned at the center, the 11 sector SPDRs orbiting, edges = co-movement. Sized
// by momentum, tinted by direction (always paired with ▲▼ so meaning never relies
// on hue alone — CLAUDE.md). Orientation, never alpha: the panel says "capital
// rotated into energy this month, here's the story" — never "buy energy."
//
// Brand rules honoured here:
//   • 2D only. No WebGL / three.js / particles / parallax / gradient-as-art.
//   • Colours come from the Almanac tokens, read ONCE from :root via
//     getComputedStyle and cached (canvas can't read CSS vars). No hex, no #000/#FFF.
//   • prefers-reduced-motion → settle instantly to a static layout, no idle drift.
//   • No new dependencies — the simulation is a plain requestAnimationFrame loop.

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import type {
  MarketMap,
  MapNode,
  MapEdge,
  MomentumTone,
  RotationEntry,
} from "@/lib/map/types";
import { retForHorizon } from "@/lib/map/types";

// ── Sim state ────────────────────────────────────────────────────────────────
// SimNode extends the contract MapNode with mutable layout state. We never store
// `any` for sim state — this is the one internal shape the loop mutates.
interface SimNode extends MapNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** World-space radius in px (derived from weight + kind). */
  r: number;
  /** Index anchors are strongly pinned near the center. */
  anchored: boolean;
}

interface Palette {
  accent: string;
  up: string;
  down: string;
  text: string;
  textMuted: string;
  border: string;
}

// Tunables for the force model. Calm by design — settles, then barely breathes.
const REPULSION = 5200; // Coulomb-style node-node push
const SPRING = 0.018; // base edge spring stiffness
const SPRING_LEN = 150; // edge rest length (px, world space)
const GRAVITY = 0.0016; // mild pull toward the canvas center
const ANCHOR_PULL = 0.05; // how hard index nodes hold the center
const DAMPING = 0.86; // velocity damping (smooth settle)
const IDLE_DAMPING = 0.93; // gentler damping once settled (calm drift)
const MIN_R = 12;
const MAX_R = 34;
const INDEX_BONUS = 8; // index anchors render a touch larger

function toneColor(tone: MomentumTone, pal: Palette): string {
  if (tone === "up") return pal.up;
  if (tone === "down") return pal.down;
  return pal.accent; // neutral leans on the teal accent, not a flat grey
}

function arrowFor(tone: MomentumTone): string {
  if (tone === "up") return "▲";
  if (tone === "down") return "▼";
  return "•";
}

function fmtPct(pct: number | null): string {
  if (pct == null) return "—";
  const sign = pct > 0 ? "+" : pct < 0 ? "−" : "";
  return `${sign}${Math.abs(pct).toFixed(1)}%`;
}

function toneFromPctLocal(pct: number | null): MomentumTone {
  if (pct == null || Math.abs(pct) < 0.1) return "neutral";
  return pct > 0 ? "up" : "down";
}

/** color-mix-free alpha blend: returns rgba() from a hex token + alpha. */
function withAlpha(hex: string, alpha: number): string {
  const h = hex.trim().replace("#", "");
  const full =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h;
  const n = parseInt(full || "000000", 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export default function MarketMap({ map }: { map: MarketMap }) {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  // Tooltip is the only piece of sim feedback that crosses into React render.
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{
    node: MapNode;
    x: number;
    y: number;
  } | null>(null);

  const { data, narrative } = map;

  // Stable derived bits for the textual panel.
  const nodeById = useMemo(() => {
    const m = new Map<string, MapNode>();
    for (const n of data.nodes) m.set(n.id, n);
    return m;
  }, [data.nodes]);

  const ariaLabel = useMemo(() => {
    const leaders = data.leaders
      .slice(0, 2)
      .map((l) => l.label)
      .join(", ");
    const laggards = data.laggards
      .slice(0, 2)
      .map((l) => l.label)
      .join(", ");
    const horizonWord =
      data.horizon === "1w" ? "1 week" : data.horizon === "3m" ? "3 months" : "1 month";
    return `Market map of ${data.nodes.length} indices and sectors over the last ${horizonWord}. Leading: ${leaders || "none"}. Lagging: ${laggards || "none"}. ${data.freshnessLabel}.`;
  }, [data]);

  // Latest hover id, readable inside the rAF closure without re-running the effect.
  const hoverRef = useRef<string | null>(null);
  useEffect(() => {
    hoverRef.current = hoverId;
  }, [hoverId]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // ── Cache token colours ONCE (canvas can't read CSS vars). ────────────────
    const root = getComputedStyle(document.documentElement);
    const readVar = (name: string, fallback: string) =>
      (root.getPropertyValue(name).trim() || fallback).trim();
    const pal: Palette = {
      accent: readVar("--accent", "#0E7978"),
      up: readVar("--up", "#0FA3B1"),
      down: readVar("--down", "#E3655B"),
      text: readVar("--text", "#2A1C15"),
      textMuted: readVar("--text-muted", "#7A6A5A"),
      border: readVar("--border", "#DED2B8"),
    };

    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    let W = wrap.clientWidth || 600;
    let H = wrap.clientHeight || 420;

    // View transform (pan + zoom), in world→screen space.
    let scale = 1;
    let panX = 0;
    let panY = 0;

    // ── Build sim nodes. Indices anchored near center; sectors seeded on a ring.
    const nodes: SimNode[] = data.nodes.map((n, i) => {
      const isIndex = n.kind === "index";
      const baseR = MIN_R + n.weight * (MAX_R - MIN_R) + (isIndex ? INDEX_BONUS : 0);
      const cx = W / 2;
      const cy = H / 2;
      let x: number;
      let y: number;
      if (isIndex) {
        // small cluster at the very center
        const a = (i / Math.max(1, data.nodes.length)) * Math.PI * 2;
        x = cx + Math.cos(a) * 26;
        y = cy + Math.sin(a) * 26;
      } else {
        const a = (i / Math.max(1, data.nodes.length)) * Math.PI * 2;
        const ring = Math.min(W, H) * 0.32;
        x = cx + Math.cos(a) * ring;
        y = cy + Math.sin(a) * ring;
      }
      return {
        ...n,
        x,
        y,
        vx: 0,
        vy: 0,
        r: Math.max(MIN_R, Math.min(MAX_R + INDEX_BONUS, baseR)),
        anchored: isIndex,
      };
    });
    const idIndex = new Map<string, number>();
    nodes.forEach((n, i) => idIndex.set(n.id, i));

    // Neighbour adjacency for hover highlight + spring forces.
    const neighbours = new Map<string, Set<string>>();
    for (const n of nodes) neighbours.set(n.id, new Set());
    const edges: MapEdge[] = data.edges.filter(
      (e) => idIndex.has(e.source) && idIndex.has(e.target)
    );
    for (const e of edges) {
      neighbours.get(e.source)?.add(e.target);
      neighbours.get(e.target)?.add(e.source);
    }

    function resize() {
      W = wrap!.clientWidth || 600;
      H = wrap!.clientHeight || 420;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas!.width = Math.round(W * dpr);
      canvas!.height = Math.round(H * dpr);
      canvas!.style.width = `${W}px`;
      canvas!.style.height = `${H}px`;
    }
    resize();

    // ── Interaction state ─────────────────────────────────────────────────────
    let draggingNode: SimNode | null = null;
    let panning = false;
    let lastPx = 0;
    let lastPy = 0;
    let movedSincePress = false;
    let activePointer: number | null = null;
    let energy = 1; // 1 = settling, decays toward idle

    // screen → world
    function toWorld(sx: number, sy: number) {
      return { x: (sx - panX) / scale, y: (sy - panY) / scale };
    }
    function pointerToCanvas(ev: PointerEvent) {
      const rect = canvas!.getBoundingClientRect();
      return { x: ev.clientX - rect.left, y: ev.clientY - rect.top };
    }
    function nodeAt(wx: number, wy: number): SimNode | null {
      // reverse so topmost (drawn last) wins
      for (let i = nodes.length - 1; i >= 0; i--) {
        const n = nodes[i];
        const dx = wx - n.x;
        const dy = wy - n.y;
        if (dx * dx + dy * dy <= n.r * n.r) return n;
      }
      return null;
    }

    function onPointerDown(ev: PointerEvent) {
      if (activePointer !== null) return;
      activePointer = ev.pointerId;
      canvas!.setPointerCapture(ev.pointerId);
      const p = pointerToCanvas(ev);
      const w = toWorld(p.x, p.y);
      lastPx = p.x;
      lastPy = p.y;
      movedSincePress = false;
      const hit = nodeAt(w.x, w.y);
      if (hit) {
        draggingNode = hit;
        energy = 1;
      } else {
        panning = true;
      }
    }

    function onPointerMove(ev: PointerEvent) {
      const p = pointerToCanvas(ev);
      const w = toWorld(p.x, p.y);

      if (activePointer === ev.pointerId) {
        const ddx = p.x - lastPx;
        const ddy = p.y - lastPy;
        if (Math.abs(ddx) + Math.abs(ddy) > 2) movedSincePress = true;
        if (draggingNode) {
          draggingNode.x = w.x;
          draggingNode.y = w.y;
          draggingNode.vx = 0;
          draggingNode.vy = 0;
          energy = 1; // re-settle neighbours
        } else if (panning) {
          panX += ddx;
          panY += ddy;
        }
        lastPx = p.x;
        lastPy = p.y;
      }

      // Hover detection (only when not dragging the background/node)
      if (!draggingNode && !panning) {
        const hit = nodeAt(w.x, w.y);
        const id = hit ? hit.id : null;
        setHoverId(id);
        canvas!.style.cursor = hit ? "pointer" : "grab";
        if (hit) {
          setTooltip({ node: hit, x: p.x, y: p.y });
        } else {
          setTooltip(null);
        }
      }
    }

    function endPointer(ev: PointerEvent) {
      if (activePointer !== ev.pointerId) return;
      const wasNode = draggingNode;
      const moved = movedSincePress;
      try {
        canvas!.releasePointerCapture(ev.pointerId);
      } catch {
        /* capture may already be gone */
      }
      activePointer = null;
      draggingNode = null;
      panning = false;
      // A press with no drag on a node = click → open Research.
      if (wasNode && !moved) {
        const ticker = wasNode.ticker;
        router.push(`/research?q=${encodeURIComponent("analyze " + ticker)}`);
      }
    }

    function onWheel(ev: WheelEvent) {
      ev.preventDefault();
      const rect = canvas!.getBoundingClientRect();
      const sx = ev.clientX - rect.left;
      const sy = ev.clientY - rect.top;
      const before = toWorld(sx, sy);
      const factor = Math.exp(-ev.deltaY * 0.0012);
      scale = Math.max(0.45, Math.min(2.6, scale * factor));
      // keep the cursor anchored to the same world point
      panX = sx - before.x * scale;
      panY = sy - before.y * scale;
    }

    // ── Force step ─────────────────────────────────────────────────────────────
    function step() {
      const cx = W / 2;
      const cy = H / 2;
      const n = nodes.length;

      // O(n²) repulsion — fine for ≤14 nodes.
      for (let i = 0; i < n; i++) {
        const a = nodes[i];
        for (let j = i + 1; j < n; j++) {
          const b = nodes[j];
          let dx = a.x - b.x;
          let dy = a.y - b.y;
          let d2 = dx * dx + dy * dy;
          if (d2 < 0.01) {
            dx = (Math.random() - 0.5) * 0.5;
            dy = (Math.random() - 0.5) * 0.5;
            d2 = dx * dx + dy * dy + 0.01;
          }
          const d = Math.sqrt(d2);
          // soft floor so big nodes don't overlap
          const minSep = a.r + b.r + 10;
          const force = REPULSION / d2 + (d < minSep ? (minSep - d) * 0.04 : 0);
          const fx = (dx / d) * force;
          const fy = (dy / d) * force;
          a.vx += fx;
          a.vy += fy;
          b.vx -= fx;
          b.vy -= fy;
        }
      }

      // Edge springs — stiffer for higher weight.
      for (const e of edges) {
        const a = nodes[idIndex.get(e.source)!];
        const b = nodes[idIndex.get(e.target)!];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 0.001;
        const k = SPRING * (0.4 + e.weight); // weight scales stiffness
        const disp = d - SPRING_LEN;
        const fx = (dx / d) * disp * k;
        const fy = (dy / d) * disp * k;
        a.vx += fx;
        a.vy += fy;
        b.vx -= fx;
        b.vy -= fy;
      }

      // Gravity + anchoring.
      for (const a of nodes) {
        a.vx += (cx - a.x) * GRAVITY;
        a.vy += (cy - a.y) * GRAVITY;
        if (a.anchored) {
          a.vx += (cx - a.x) * ANCHOR_PULL;
          a.vy += (cy - a.y) * ANCHOR_PULL;
        }
      }

      // Integrate (skip the node being dragged).
      const damp = energy > 0.05 ? DAMPING : IDLE_DAMPING;
      for (const a of nodes) {
        if (a === draggingNode) continue;
        a.vx *= damp;
        a.vy *= damp;
        // Calm idle drift once settled — tiny, breathing, never jitter.
        if (energy <= 0.05 && !reduceMotion && !a.anchored) {
          const t = performance.now() * 0.0005;
          a.vx += Math.cos(t + a.x * 0.01) * 0.012;
          a.vy += Math.sin(t + a.y * 0.01) * 0.012;
        }
        a.x += a.vx;
        a.y += a.vy;
      }
      energy *= 0.985;
    }

    // ── Render ───────────────────────────────────────────────────────────────
    function draw(hovered: string | null) {
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx!.clearRect(0, 0, W, H);
      ctx!.save();
      ctx!.translate(panX, panY);
      ctx!.scale(scale, scale);

      const neigh = hovered ? neighbours.get(hovered) : null;
      const isDimmed = (id: string) =>
        hovered != null && id !== hovered && !(neigh && neigh.has(id));

      // Edges UNDER nodes.
      ctx!.lineCap = "round";
      for (const e of edges) {
        const a = nodes[idIndex.get(e.source)!];
        const b = nodes[idIndex.get(e.target)!];
        const active =
          hovered != null && (e.source === hovered || e.target === hovered);
        const dim = hovered != null && !active;
        const baseAlpha = 0.1 + e.weight * 0.32;
        const alpha = dim ? baseAlpha * 0.25 : active ? Math.min(0.8, baseAlpha + 0.3) : baseAlpha;
        ctx!.strokeStyle = active ? withAlpha(pal.accent, alpha) : withAlpha(pal.border, alpha + 0.15);
        ctx!.lineWidth = (0.6 + e.weight * 2.4) * (active ? 1.4 : 1);
        ctx!.beginPath();
        ctx!.moveTo(a.x, a.y);
        ctx!.lineTo(b.x, b.y);
        ctx!.stroke();
      }

      // Nodes.
      for (const nd of nodes) {
        const dim = isDimmed(nd.id);
        const col = toneColor(nd.tone, pal);
        const fillAlpha = dim ? 0.12 : nd.kind === "index" ? 0.9 : 0.78;
        const ringAlpha = dim ? 0.25 : 1;

        // soft tonal halo (a flat tint, not a gradient-as-art)
        if (!dim && (nd.id === hovered || (neigh && neigh.has(nd.id)))) {
          ctx!.beginPath();
          ctx!.fillStyle = withAlpha(col, 0.16);
          ctx!.arc(nd.x, nd.y, nd.r + 9, 0, Math.PI * 2);
          ctx!.fill();
        }

        // body
        ctx!.beginPath();
        ctx!.fillStyle = withAlpha(col, fillAlpha);
        ctx!.arc(nd.x, nd.y, nd.r, 0, Math.PI * 2);
        ctx!.fill();

        // ring — index nodes get a heavier, accent-toned ring
        ctx!.lineWidth = nd.kind === "index" ? 2.4 : 1.4;
        ctx!.strokeStyle = withAlpha(
          nd.kind === "index" ? pal.text : col,
          ringAlpha * (nd.kind === "index" ? 0.55 : 0.85)
        );
        ctx!.beginPath();
        ctx!.arc(nd.x, nd.y, nd.r, 0, Math.PI * 2);
        ctx!.stroke();

        // arrow glyph at center — meaning never relies on hue alone
        if (!dim) {
          ctx!.fillStyle = withAlpha(pal.text, 0.92);
          ctx!.font = `${Math.max(10, nd.r * 0.7)}px ui-sans-serif, system-ui, sans-serif`;
          ctx!.textAlign = "center";
          ctx!.textBaseline = "middle";
          ctx!.fillText(arrowFor(nd.tone), nd.x, nd.y);
        }

        // Label: big nodes always; small nodes on hover only.
        const showLabel =
          !dim &&
          (nd.kind === "index" || nd.r >= 20 || nd.id === hovered || (neigh && neigh.has(nd.id)));
        if (showLabel) {
          const label = nd.ticker;
          ctx!.font = "600 11px ui-sans-serif, system-ui, sans-serif";
          ctx!.textAlign = "center";
          ctx!.textBaseline = "top";
          ctx!.fillStyle = withAlpha(pal.text, 0.9);
          ctx!.fillText(label, nd.x, nd.y + nd.r + 4);
          if (nd.r >= 24 || nd.id === hovered) {
            ctx!.font = "400 9.5px ui-sans-serif, system-ui, sans-serif";
            ctx!.fillStyle = withAlpha(pal.textMuted, 0.95);
            ctx!.fillText(nd.label, nd.x, nd.y + nd.r + 17);
          }
        }
      }

      ctx!.restore();
    }

    // ── Loop ───────────────────────────────────────────────────────────────────
    let raf = 0;
    let stopped = false;

    function frame() {
      if (stopped) return;
      step();
      draw(hoverRef.current);
      raf = requestAnimationFrame(frame);
    }

    if (reduceMotion) {
      // Settle instantly: run many silent steps, then a single static draw.
      energy = 1;
      for (let i = 0; i < 600; i++) step();
      draw(hoverRef.current);
      // Still allow hover redraws without animating layout.
      const staticRedraw = () => {
        if (stopped) return;
        draw(hoverRef.current);
        raf = requestAnimationFrame(staticRedraw);
      };
      raf = requestAnimationFrame(staticRedraw);
    } else {
      raf = requestAnimationFrame(frame);
    }

    // Listeners
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", endPointer);
    canvas.addEventListener("pointercancel", endPointer);
    canvas.addEventListener("pointerleave", () => {
      if (!draggingNode && !panning) {
        setHoverId(null);
        setTooltip(null);
      }
    });
    canvas.addEventListener("wheel", onWheel, { passive: false });

    const ro = new ResizeObserver(() => resize());
    ro.observe(wrap);

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", endPointer);
      canvas.removeEventListener("pointercancel", endPointer);
      canvas.removeEventListener("wheel", onWheel);
      ro.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.nodes, data.edges, router]);

  const horizonWord =
    data.horizon === "1w" ? "1 week" : data.horizon === "3m" ? "3 months" : "1 month";

  return (
    <div className="cvq-map-root">
      {/* ── Canvas stage ─────────────────────────────────────────────────── */}
      <div ref={wrapRef} className="cvq-map-stage">
        <canvas
          ref={canvasRef}
          className="cvq-map-canvas"
          role="img"
          aria-label={ariaLabel}
        />
        {tooltip && (
          <div
            className="cvq-map-tooltip"
            style={{ left: tooltip.x + 14, top: tooltip.y + 14 }}
            aria-hidden="true"
          >
            <div className="cvq-map-tip-head">
              <span className="cvq-map-tip-ticker">{tooltip.node.ticker}</span>
              <span className="cvq-map-tip-label">{tooltip.node.label}</span>
            </div>
            <div className="cvq-map-tip-rows">
              {(["1w", "1m", "3m"] as const).map((h) => {
                const v = retForHorizon(tooltip.node, h);
                const t = toneFromPctLocal(v);
                return (
                  <div key={h} className="cvq-map-tip-row">
                    <span className="cvq-map-tip-h">
                      {h === "1w" ? "1 week" : h === "3m" ? "3 months" : "1 month"}
                    </span>
                    <span className={`cvq-map-tip-ret cvq-map-tone-${t}`}>
                      {arrowFor(t)} {fmtPct(v)}
                    </span>
                  </div>
                );
              })}
            </div>
            {tooltip.node.freshnessLabel && (
              <div className="cvq-map-tip-fresh">{tooltip.node.freshnessLabel}</div>
            )}
          </div>
        )}
        <div className="cvq-map-hint" aria-hidden="true">
          Hover to focus · scroll to zoom · drag to move · tap a node to research it
        </div>
      </div>

      {/* ── Textual panel (carries the real content for screen readers) ───── */}
      <motion.aside
        className="cvq-map-panel"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
      >
        {narrative ? (
          <>
            <h3 className="cvq-map-headline">{narrative.headline}</h3>
            <p className="cvq-map-story">{narrative.story}</p>
          </>
        ) : (
          <>
            <h3 className="cvq-map-headline">
              How the market moved over the last {horizonWord}
            </h3>
            <p className="cvq-map-note">
              The plain-English narrative isn&apos;t available right now. The leaders and
              laggards below are computed straight from price history.
            </p>
          </>
        )}

        <div className="cvq-map-rotation">
          <RotationColumn
            title="Leading"
            rows={data.leaders.slice(0, 4)}
            horizon={data.horizon}
            nodeById={nodeById}
            onPick={(t) =>
              router.push(`/research?q=${encodeURIComponent("analyze " + t)}`)
            }
          />
          <RotationColumn
            title="Lagging"
            rows={data.laggards.slice(0, 4)}
            horizon={data.horizon}
            nodeById={nodeById}
            onPick={(t) =>
              router.push(`/research?q=${encodeURIComponent("analyze " + t)}`)
            }
          />
        </div>

        {narrative && (narrative.leadersNote || narrative.laggardsNote) && (
          <div className="cvq-map-notes">
            {narrative.leadersNote && <p className="cvq-map-subnote">{narrative.leadersNote}</p>}
            {narrative.laggardsNote && <p className="cvq-map-subnote">{narrative.laggardsNote}</p>}
          </div>
        )}

        {narrative && narrative.watch.length > 0 && (
          <div className="cvq-map-watch">
            <h4 className="cvq-map-watch-title">What to watch</h4>
            <ul className="cvq-map-watch-list">
              {narrative.watch.map((w, i) => (
                <li key={i} className="cvq-map-watch-item">
                  {w}
                </li>
              ))}
            </ul>
          </div>
        )}

        {data.unpriced.length > 0 && (
          <p className="cvq-map-unpriced">
            Couldn&apos;t price this run: {data.unpriced.join(", ")}.
          </p>
        )}

        <a className="cvq-map-crosslink" href="/portfolio">
          See what this means for your money → Portfolio
        </a>

        <p className="cvq-map-asof">{data.freshnessLabel}</p>
      </motion.aside>
    </div>
  );
}

// ── Leaders / laggards column ──────────────────────────────────────────────────
function RotationColumn({
  title,
  rows,
  horizon,
  nodeById,
  onPick,
}: {
  title: string;
  rows: RotationEntry[];
  horizon: MarketMap["data"]["horizon"];
  nodeById: Map<string, MapNode>;
  onPick: (ticker: string) => void;
}) {
  return (
    <div className="cvq-map-rot-col">
      <h4 className="cvq-map-rot-title">{title}</h4>
      {rows.length === 0 ? (
        <p className="cvq-map-rot-empty">No data yet.</p>
      ) : (
        <ul className="cvq-map-rot-list">
          {rows.map((r) => {
            const v = retForHorizon(r, horizon);
            const t = toneFromPctLocal(v);
            return (
              <li key={r.id} className="cvq-map-rot-row">
                <button
                  type="button"
                  className="cvq-map-rot-btn"
                  onClick={() => onPick(r.ticker)}
                  aria-label={`Research ${r.label} (${r.ticker}), ${fmtPct(v)} over ${
                    horizon === "1w" ? "one week" : horizon === "3m" ? "three months" : "one month"
                  }`}
                >
                  <span className="cvq-map-rot-ticker">{r.ticker}</span>
                  <span className="cvq-map-rot-label">{r.label}</span>
                  <span className={`cvq-map-rot-ret cvq-map-tone-${t}`}>
                    {arrowFor(t)} {fmtPct(v)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
