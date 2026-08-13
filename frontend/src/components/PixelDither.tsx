// Animated dither field in the hero margins.
//
// Layout: the field is masked out of the centre of the screen, so it lives in
// the left and right margins and never sits behind the headline. An 8x8 Bayer
// threshold decides which cells are lit, which is what gives it the dither
// texture rather than a smooth gradient.
//
// Motion, three layers that never all peak at once:
//   1. drift   - a slow diagonal wave, the ambient bed
//   2. twinkle - each star has its own phase, so nothing pulses in unison
//   3. sweep   - a soft band falls through the field every ~9s and briefly
//                brightens and enlarges the stars it passes, reading as a pass
//                over the corpus
//
// Cost control: stars are pre-rendered once into three sprite canvases (one per
// brightness tier) and blitted with drawImage. Draws are grouped by tier, so
// there are no per-star canvas state changes. Trig is table-driven.

import { useEffect, useRef } from "react";

const CELL = 10; // grid pitch in px
const STAR = 3.1; // star radius in px at rest
const FPS = 30;
const SPRITE = 32; // sprite bitmap size

// prettier-ignore
const BAYER8 = [
   0, 32,  8, 40,  2, 34, 10, 42,
  48, 16, 56, 24, 50, 18, 58, 26,
  12, 44,  4, 36, 14, 46,  6, 38,
  60, 28, 52, 20, 62, 30, 54, 22,
   3, 35, 11, 43,  1, 33,  9, 41,
  51, 19, 59, 27, 49, 17, 57, 25,
  15, 47,  7, 39, 13, 45,  5, 37,
  63, 31, 55, 23, 61, 29, 53, 21,
];

const TAU = Math.PI * 2;
const LUT_SIZE = 1024;
const SIN_LUT = new Float32Array(LUT_SIZE);
for (let i = 0; i < LUT_SIZE; i++) SIN_LUT[i] = Math.sin((i / LUT_SIZE) * TAU);

function fastSin(radians: number): number {
  const i = ((radians * (LUT_SIZE / TAU)) | 0) & (LUT_SIZE - 1);
  return SIN_LUT[i];
}

// Four-point sparkle: a diamond with concave sides.
function starPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  const waist = r * 0.2;
  ctx.beginPath();
  ctx.moveTo(cx, cy - r);
  ctx.quadraticCurveTo(cx + waist, cy - waist, cx + r, cy);
  ctx.quadraticCurveTo(cx + waist, cy + waist, cx, cy + r);
  ctx.quadraticCurveTo(cx - waist, cy + waist, cx - r, cy);
  ctx.quadraticCurveTo(cx - waist, cy - waist, cx, cy - r);
  ctx.closePath();
}

// Baked alpha per tier, so drawing never touches globalAlpha.
const TIER_ALPHA = [0.2, 0.42, 0.78];

function buildSprites(): HTMLCanvasElement[] {
  return TIER_ALPHA.map((alpha) => {
    const sprite = document.createElement("canvas");
    sprite.width = SPRITE;
    sprite.height = SPRITE;
    const sctx = sprite.getContext("2d");
    if (!sctx) return sprite;
    const mid = SPRITE / 2;
    sctx.fillStyle = `rgba(74, 74, 82, ${alpha})`;
    starPath(sctx, mid, mid, mid - 1);
    sctx.fill();
    return sprite;
  });
}

export function PixelDither() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvasEl = canvasRef.current;
    const hostEl = canvasEl?.parentElement;
    if (!canvasEl || !hostEl) return;
    const context = canvasEl.getContext("2d");
    if (!context) return;

    // TypeScript does not carry the guards above into the nested functions.
    const canvas: HTMLCanvasElement = canvasEl;
    const host: HTMLElement = hostEl;
    const ctx: CanvasRenderingContext2D = context;

    const sprites = buildSprites();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    let cols = 0;
    let rows = 0;
    let width = 0;
    let height = 0;
    // Per-cell static data: horizontal falloff, vertical falloff, twinkle phase.
    let sideMask = new Float32Array(0);
    let vertMask = new Float32Array(0);
    let phase = new Float32Array(0);
    let cellY = new Float32Array(0);
    // Draw queue, grouped by tier: [x, y, size, x, y, size, ...]
    const queue: number[][] = [[], [], []];
    let raf = 0;
    let lastDraw = 0;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    function smoothstep(edge0: number, edge1: number, x: number) {
      const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
      return t * t * (3 - 2 * t);
    }

    function resize() {
      width = Math.max(1, host.clientWidth);
      height = Math.max(1, host.clientHeight);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      cols = Math.ceil(width / CELL) + 1;
      rows = Math.ceil(height / CELL) + 1;
      const count = cols * rows;
      sideMask = new Float32Array(count);
      vertMask = new Float32Array(count);
      phase = new Float32Array(count);
      cellY = new Float32Array(rows);

      // The centre column stays empty. On a narrow screen the clear band takes
      // a larger share of the width, so the text never collides with stars.
      const clear = width < 760 ? 0.66 : 0.34;

      for (let y = 0; y < rows; y++) {
        const py = (y * CELL) / height;
        cellY[y] = py;
        // Fade in below the nav, fade out before the scroll cue.
        const vert = smoothstep(0.0, 0.22, py) * (1 - smoothstep(0.72, 1.0, py));
        for (let x = 0; x < cols; x++) {
          const px = (x * CELL) / width;
          const fromCentre = Math.abs(px - 0.5) * 2;
          const i = y * cols + x;
          sideMask[i] = smoothstep(clear, Math.min(1, clear + 0.5), fromCentre);
          vertMask[i] = vert;
          // Deterministic per-cell phase so the twinkle never synchronises.
          const h = (x * 73856093) ^ (y * 19349663);
          phase[i] = ((h >>> 0) % 1000) / 1000 * TAU;
        }
      }
    }

    function draw(t: number) {
      ctx.clearRect(0, 0, width, height);
      queue[0].length = 0;
      queue[1].length = 0;
      queue[2].length = 0;

      // Sweep falls from above the field to below it, then pauses.
      const sweepAt = ((t * 0.13) % 1.55) - 0.25;

      for (let y = 0; y < rows; y++) {
        const py = cellY[y];
        const rowBase = (y & 7) << 3;
        const rowOffset = y * cols;
        const dy = py - sweepAt;
        const sweep = Math.exp(-(dy * dy) / 0.008) * 0.55;

        for (let x = 0; x < cols; x++) {
          const i = rowOffset + x;
          const envelope = sideMask[i] * vertMask[i];
          if (envelope <= 0.01) continue;

          const drift = 0.5 + 0.5 * fastSin(x * 0.18 + y * 0.11 + t * 0.28);
          const twinkle = 0.5 + 0.5 * fastSin(t * 0.9 + phase[i]);
          const field = envelope * (0.16 + 0.34 * drift + 0.3 * twinkle + sweep);
          if (field <= 0.04) continue;

          const threshold = (BAYER8[rowBase + (x & 7)] + 0.5) / 64;
          if (field <= threshold * 0.82) continue;

          const tier = field > 0.62 ? 2 : field > 0.38 ? 1 : 0;
          // Stars swell slightly as the sweep passes over them.
          const size = STAR * (0.72 + 0.5 * field + sweep * 0.5);
          const q = queue[tier];
          q.push(x * CELL, y * CELL, size);
        }
      }

      for (let tier = 0; tier < 3; tier++) {
        const q = queue[tier];
        const sprite = sprites[tier];
        for (let k = 0; k < q.length; k += 3) {
          const s = q[k + 2];
          ctx.drawImage(sprite, q[k] - s, q[k + 1] - s, s * 2, s * 2);
        }
      }
    }

    function frame(now: number) {
      raf = requestAnimationFrame(frame);
      if (now - lastDraw < 1000 / FPS) return;
      lastDraw = now;
      if (document.hidden) return;
      draw(now / 1000);
    }

    function start() {
      cancelAnimationFrame(raf);
      resize();
      if (reduceMotion.matches) {
        draw(0);
        return;
      }
      raf = requestAnimationFrame(frame);
    }

    start();

    const observer = new ResizeObserver(start);
    observer.observe(host);
    reduceMotion.addEventListener("change", start);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      reduceMotion.removeEventListener("change", start);
    };
  }, []);

  return <canvas ref={canvasRef} className="lp-dither" aria-hidden />;
}
