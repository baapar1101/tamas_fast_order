import { useEffect } from 'react';

/**
 * Refractive glass edge ("اعوجاج شیشه"), ported from the MARK workspace.
 * Each pane gets an SVG displacement filter sized to it, used as its
 * backdrop-filter, so whatever sits behind the edge bends like thick glass.
 * Chromium is the only engine that supports url() in backdrop-filter; everywhere
 * else this is a no-op and the plain frosted glass from CSS stays.
 */
const SVG_NS = 'http://www.w3.org/2000/svg';
const filters = new Map<string, string>();
let defs: SVGDefsElement | null = null;

export function lensSupported(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  return /Chrome\//.test(ua) && !/iPhone|iPad|CriOS|FxiOS/.test(ua);
}

/** Displacement map: neutral in the middle, pushing outward near the rounded edge. */
function displacementMap(width: number, height: number): string {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  const image = ctx.createImageData(width, height);
  const data = image.data;
  const radius = Math.min(26, width / 2, height / 2);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      let dist: number;
      let nx = 0;
      let ny = 0;
      if ((px < radius || px > width - radius) && (py < radius || py > height - radius)) {
        const cx = Math.min(Math.max(px, radius), width - radius);
        const cy = Math.min(Math.max(py, radius), height - radius);
        const d = Math.hypot(px - cx, py - cy) || 1;
        dist = radius - d;
        nx = (cx - px) / d;
        ny = (cy - py) / d;
      } else {
        const right = width - px;
        const bottom = height - py;
        dist = Math.min(px, right, py, bottom);
        if (dist === px) nx = 1;
        else if (dist === right) nx = -1;
        else ny = dist === py ? 1 : -1;
      }
      let strength = 0;
      if (dist < 30) {
        const t = 1 - Math.max(dist, 0) / 30;
        strength = Math.min(1, t / Math.sqrt(Math.max(1 - t * t, 0.03)) / 3.6);
      }
      const i = (y * width + x) * 4;
      data[i] = 128 + Math.max(-127, Math.min(127, nx * strength * 127));
      data[i + 1] = 128 + Math.max(-127, Math.min(127, ny * strength * 127));
      data[i + 2] = 128;
      data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  return canvas.toDataURL();
}

function set(el: Element, attrs: Record<string, string>) {
  for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, value);
}

/** One filter per pane size, shared by every pane of that size. */
function lensFilter(width: number, height: number): string {
  const key = `${width}x${height}`;
  const cached = filters.get(key);
  if (cached) return cached;
  if (!defs) {
    const svg = document.createElementNS(SVG_NS, 'svg');
    set(svg, { width: '0', height: '0', 'aria-hidden': 'true' });
    svg.style.position = 'absolute';
    defs = document.createElementNS(SVG_NS, 'defs');
    svg.appendChild(defs);
    document.body.appendChild(svg);
  }
  const id = `tamas-lens-${key}`;
  const filter = document.createElementNS(SVG_NS, 'filter');
  set(filter, { id, 'color-interpolation-filters': 'sRGB' });
  const map = document.createElementNS(SVG_NS, 'feImage');
  set(map, { href: displacementMap(width, height), x: '0', y: '0', width: String(width), height: String(height), result: 'map', preserveAspectRatio: 'none' });
  filter.appendChild(map);
  // Slightly different strength per colour channel gives the chromatic edge.
  const channels = ['1 0 0 0 0 0 0 0 0 0 0 0 0 0 0', '0 0 0 0 0 0 1 0 0 0 0 0 0 0 0', '0 0 0 0 0 0 0 0 0 0 0 0 1 0 0'];
  [130, 118, 106].forEach((scale, i) => {
    const displace = document.createElementNS(SVG_NS, 'feDisplacementMap');
    set(displace, { in: 'SourceGraphic', in2: 'map', scale: String(scale), xChannelSelector: 'R', yChannelSelector: 'G', result: `d${i}` });
    const matrix = document.createElementNS(SVG_NS, 'feColorMatrix');
    set(matrix, { in: `d${i}`, type: 'matrix', values: `${channels[i]} 0 0 0 1 0`, result: `c${i}` });
    filter.append(displace, matrix);
  });
  const blendA = document.createElementNS(SVG_NS, 'feBlend');
  set(blendA, { in: 'c0', in2: 'c1', mode: 'screen', result: 'rg' });
  const blendB = document.createElementNS(SVG_NS, 'feBlend');
  set(blendB, { in: 'rg', in2: 'c2', mode: 'screen' });
  filter.append(blendA, blendB);
  defs.appendChild(filter);
  filters.set(key, id);
  return id;
}

/** Bends the backdrop of one element; returns a cleanup. Large panes are skipped. */
export function attachLens(el: HTMLElement, blurPx: number, maxArea = 360_000): () => void {
  if (!lensSupported()) return () => {};
  const apply = () => {
    const width = Math.round(el.offsetWidth);
    const height = Math.round(el.offsetHeight);
    if (!width || !height) return;
    if (width * height > maxArea) {
      el.style.backdropFilter = '';
      return;
    }
    const value = `url(#${lensFilter(width, height)}) blur(${blurPx}px) saturate(185%) brightness(1.05)`;
    if (el.style.backdropFilter !== value) el.style.backdropFilter = value;
  };
  apply();
  let timer = 0;
  let first = true;
  const observer = new ResizeObserver(() => {
    if (first) {
      first = false;
      return;
    }
    window.clearTimeout(timer);
    timer = window.setTimeout(apply, 160);
  });
  observer.observe(el);
  return () => {
    observer.disconnect();
    window.clearTimeout(timer);
    el.style.backdropFilter = '';
  };
}

/** Widgets that get the lens: KPI cards, the dashboard hero and dashboard cards. */
const LENS_SELECTOR = ['.a-stat-card', '.admin-hero', '.dash-page .a-card:not(.a-card--flush)'].map((s) => `.admin-body-shell ${s}`).join(', ');

/**
 * While enabled, keeps the lens on every matching widget in the admin shell,
 * including ones that mount later (route changes, lazy pages).
 */
export function useGlassLens(enabled: boolean, blurPx: number) {
  useEffect(() => {
    if (!enabled || !lensSupported()) return;
    // Watch the whole body: the admin shell is replaced when sign-in finishes.
    const root = document.body;
    const attached = new Map<HTMLElement, () => void>();
    const sync = () => {
      const found = new Set<HTMLElement>(root.querySelectorAll<HTMLElement>(LENS_SELECTOR));
      for (const [el, detach] of attached) {
        if (!found.has(el) || !el.isConnected) {
          detach();
          attached.delete(el);
        }
      }
      for (const el of found) if (!attached.has(el)) attached.set(el, attachLens(el, blurPx));
    };
    sync();
    let frame = 0;
    const observer = new MutationObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(sync);
    });
    observer.observe(root, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      attached.forEach((detach) => detach());
    };
  }, [enabled, blurPx]);
}
