// Page snapshots for the paper texture. Never taken during a move.
//  - 'pre'  = the page's pre-landing state (marks hidden, boards waiting to drop). Cached per page.
//  - 'live' = exactly what's on screen for the current page (drawn marks, scroll position, spun boards).
// Neighbours are pre-warmed on idle; everything is refreshed after fonts/images load and on resize.
import { domToCanvas } from 'modern-screenshot';
import { config } from './config';

type Kind = 'pre' | 'live';
type Snap = { canvas: HTMLCanvasElement; w: number; h: number; dpr: number; at: number };

const cache = new Map<string, Snap>();
const dirty = new Set<string>();
const pending = new Map<string, Promise<Snap>>();
let queue: Promise<unknown> = Promise.resolve();

const key = (i: number, k: Kind) => `${i}:${k}`;
export const dpr = () => Math.min(window.devicePixelRatio || 1, config.maxDpr);

const idle = (fn: () => void) =>
  ('requestIdleCallback' in window ? (window as any).requestIdleCallback(fn, { timeout: 1500 }) : setTimeout(fn, 200));

async function decodeImages(el: HTMLElement) {
  const imgs = Array.from(el.querySelectorAll('img'));
  await Promise.all(imgs.map((img) => {
    if (img.loading === 'lazy') img.loading = 'eager';
    return img.complete && img.naturalWidth ? Promise.resolve() : img.decode().catch(() => {});
  }));
}

const imgCache = new Map<string, Promise<HTMLImageElement>>();
const loadImg = (src: string) => {
  let p = imgCache.get(src);
  if (!p) {
    const img = new Image(); img.src = src;
    p = img.decode().then(() => img);
    imgCache.set(src, p);
  }
  return p;
};
const blendOp = (m: string): GlobalCompositeOperation =>
  (['multiply', 'screen', 'overlay', 'soft-light', 'hard-light'].includes(m) ? m : 'source-over') as GlobalCompositeOperation;

/**
 * The wear layers (ageing, creases, grain, left-over crumple creases) sit on top of each page with
 * plain blend modes. Rather than inlining their big textures into the DOM clone, draw them onto the
 * snapshot here with the same blend modes — same pixels, a fraction of the cost.
 */
async function compositeWear(page: HTMLElement, canvas: HTMLCanvasElement, w: number, h: number, d: number, kind: Kind) {
  const ctx = canvas.getContext('2d')!;
  ctx.save();
  ctx.scale(d, d);
  for (const el of Array.from(page.querySelectorAll<HTMLElement>(':scope > .wear'))) {
    if (kind === 'pre' && el.dataset.handled !== undefined) continue;
    const cs = getComputedStyle(el);
    const m = cs.backgroundImage.match(/url\("?(.*?)"?\)/);
    const alpha = parseFloat(cs.opacity);
    if (!m || !alpha) continue;
    const img = await loadImg(m[1]);
    ctx.globalAlpha = alpha;
    ctx.globalCompositeOperation = blendOp(cs.mixBlendMode);
    if (el.dataset.grain !== undefined) {
      ctx.fillStyle = ctx.createPattern(img, 'repeat')!;
      ctx.fillRect(0, 0, w, h);
    } else if (el.dataset.crease !== undefined) {
      // background-size 150%, a per-page background-position and maybe a horizontal flip
      const bw = w * 1.5, bh = h * 1.5;
      const [px, py] = cs.backgroundPosition.split(' ').map((v) => parseFloat(v) / 100);
      ctx.save();
      if (cs.transform !== 'none' && new DOMMatrix(cs.transform).a < 0) { ctx.translate(w, 0); ctx.scale(-1, 1); }
      ctx.drawImage(img, (w - bw) * px, (h - bh) * py, bw, bh);
      ctx.restore();
    } else {
      ctx.drawImage(img, 0, 0, w, h);
    }
  }
  ctx.restore();
}

let paperReady: Promise<unknown> = Promise.resolve();
export const waitForPaper = (p: Promise<unknown>) => { paperReady = p; };

async function shoot(page: HTMLElement, kind: Kind): Promise<Snap> {
  await paperReady; // the wear layers must be painted before a page is copied
  const w = innerWidth, h = innerHeight, d = dpr();
  const hidden = !page.classList.contains('is-active');
  if (hidden) page.classList.add('is-snap'); // rendered under the active page while we copy it
  try {
    await decodeImages(page);
    await new Promise((r) => { requestAnimationFrame(() => r(null)); setTimeout(r, 60); });
    const canvas = await domToCanvas(page, {
      width: w, height: h, scale: d,
      backgroundColor: getComputedStyle(page).backgroundColor,
      features: { restoreScrollPosition: true },
      style: { visibility: 'visible', inset: '0', zIndex: 'auto' },
      // <source> would point the cloned <picture> at an external file the SVG renderer can't load;
      // the wear layers are composited separately (compositeWear)
      filter: (n) => !(n instanceof HTMLSourceElement) && !(n instanceof HTMLElement && n.classList.contains('wear')),
      timeout: 8000,
    });
    if (!canvas.width) throw new Error('empty snapshot');
    await compositeWear(page, canvas, w, h, d, kind);
    return { canvas, w, h, dpr: d, at: performance.now() };
  } finally {
    if (hidden) page.classList.remove('is-snap');
  }
}

/** Get a snapshot, taking it if missing/stale. Serialised so two never run at once. */
export function get(pages: HTMLElement[], i: number, kind: Kind): Promise<Snap> {
  const k = key(i, kind);
  const have = cache.get(k);
  if (have && !dirty.has(k) && have.w === innerWidth && have.h === innerHeight && have.dpr === dpr()) return Promise.resolve(have);
  const p = pending.get(k);
  if (p) return p;
  const job = queue.then(() => shoot(pages[i], kind)).then((s) => { cache.set(k, s); dirty.delete(k); return s; });
  queue = job.catch(() => {});
  pending.set(k, job);
  job.finally(() => pending.delete(k));
  return job;
}

export const has = (i: number, kind: Kind) => {
  const s = cache.get(key(i, kind));
  return !!s && !dirty.has(key(i, kind)) && s.w === innerWidth && s.h === innerHeight;
};

export function markDirty(i: number, kind: Kind = 'live') { dirty.add(key(i, kind)); }
export function invalidateAll() { cache.forEach((_, k) => dirty.add(k)); }

/** Warm the cache on idle: the live page first, then its neighbours' pre-landing states, then the rest. */
export function prewarm(pages: HTMLElement[], cur: number, isBusy: () => boolean) {
  const order: [number, Kind][] = [[cur, 'live']];
  for (const d of [1, -1, 2, -2, 3, -3, 4, -4]) {
    const n = cur + d;
    if (n >= 0 && n < pages.length) order.push([n, 'pre']);
  }
  const next = () => {
    if (isBusy()) return;
    const job = order.find(([i, k]) => !has(i, k));
    if (!job) return;
    idle(() => { if (!isBusy()) get(pages, job[0], job[1]).catch(() => {}).finally(() => idle(next)); });
  };
  next();
}
