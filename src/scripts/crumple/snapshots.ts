// Page textures for the paper. Copying the DOM (modern-screenshot) is the most expensive thing the site
// does, so each page is copied as few times as possible and never during a move:
//
//  - every page is captured twice in its life: its pre-landing state (marks hidden, boards waiting to drop:
//    what the incoming page shows) and its landed state (marks drawn, boards standing: what the outgoing
//    page shows). The landed state of a page that isn't on screen is set up for the copy and undone after.
//  - a page that scrolls inside is captured as two layers, its background and its whole content column,
//    so any scroll position is composed in a few milliseconds instead of being re-captured.
//  - the wear layers and the left-over creases are drawn on top with the same blend modes, also cheap.
//
// One capture context is reused, so fonts and photos are fetched and encoded once, in modern-screenshot's
// worker, not on every copy. Background copies only run when the reader isn't touching or scrolling, and
// give way the moment they do (or a page turn starts); they're simply redone later.
import { createContext, destroyContext, domToCanvas, type Context } from 'modern-screenshot';
// a real same-origin file: inlined as a data: URL the worker would have an opaque origin, and its fetches
// of this site's fonts and photos would be cross-origin
import workerUrl from 'modern-screenshot/worker?url&no-inline';
import { config } from './config';
import { styleProps } from './style-props';

export type Look = 'pre' | 'landed';
type Layer = { img: CanvasImageSource; w: number; h: number };
type Captured = { vw: number; vh: number; dpr: number; scroll: boolean; base: Layer; content?: Layer };

export const dpr = () => Math.min(window.devicePixelRatio || 1, config.maxDpr);
const vw = () => innerWidth, vh = () => innerHeight;
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const store = new Map<string, Captured>();
const key = (i: number, look: Look, variant = '') => `${i}:${look}:${variant}`;
export const keyOf = key;
let queue: Promise<unknown> = Promise.resolve();
const pending = new Map<string, Promise<Captured>>();

/** longest a copy may go without progress before it's given up (a stalled fetch must never block page turns) */
const COPY_TIMEOUT_MS = 9000;
/** rejects when the copy running now has stalled (copies run one at a time) */
let stalled: Promise<never> = new Promise(() => {});
let stallTimer = 0;
let stallReject: ((e: Error) => void) | null = null;
const armStall = () => {
  clearTimeout(stallTimer);
  stallTimer = window.setTimeout(() => { dropContext(); stallReject?.(new Error('copy timed out')); }, COPY_TIMEOUT_MS);
};

let ready: Promise<unknown> = Promise.resolve();
/** captures wait for this (fonts loaded, paper aged) — but never for more than a few seconds */
export const waitFor = (p: Promise<unknown>) => { ready = Promise.race([p, sleep(5000)]); };

// ------------------------------------------------------------------ giving way
// Copying walks every node; let the browser in every few milliseconds so scrolling, swipes and animations
// never wait for a copy.
const SLICE_MS = 8;
let sliceStart = 0;
const yieldToBrowser = (): Promise<void> => {
  const sch = (globalThis as any).scheduler;
  if (sch?.yield) return sch.yield();
  return new Promise((r) => { const ch = new MessageChannel(); ch.port1.onmessage = () => r(); ch.port2.postMessage(0); });
};
// A background copy steps aside while the reader touches, scrolls or presses a key, and carries on from
// where it was once they've been still for a moment. A page turn stops it, unless it's a copy the turn needs:
// that one carries on as the turn's own. A copy of a page that changed meanwhile (a board spun, the lightbox
// opened) is thrown away and redone later.
let holding = false;
const wanted = new Set<string>();
let current: { key: string; background: boolean } | null = null;
let changed = false;
let lastInput = () => 0;
/** where to read the time of the reader's last touch/scroll/key (a background copy pauses for it) */
export const setInputClock = (f: () => number) => { lastInput = f; };
let currentDone: Promise<unknown> = Promise.resolve();
class Aborted extends Error {}
const PAUSE_QUIET_MS = 400;
const PAUSE_MAX_MS = 4000;
const readerBusy = () => performance.now() - lastInput() < PAUSE_QUIET_MS;
const check = () => {
  if (!current?.background) return;
  if (holding) throw new Aborted('stopped for a page turn');
  if (changed) throw new Aborted('the page changed while it was copied');
};
async function pause() {
  const t0 = performance.now();
  clearTimeout(stallTimer); // waiting for the reader isn't a stall
  try {
    while (current?.background && readerBusy()) {
      if (performance.now() - t0 > PAUSE_MAX_MS) throw new Aborted('the reader is busy');
      await sleep(50);
      check();
    }
  } finally {
    if (current) armStall();
  }
  sliceStart = performance.now();
}
const maybeYield = async () => {
  check();
  if (current?.background && readerBusy()) await pause();
  if (performance.now() - sliceStart < SLICE_MS) return;
  await yieldToBrowser();
  sliceStart = performance.now();
  check();
};
/** await p, but let a background copy be stopped while waiting (image downloads, fonts, a frame) */
function interruptible<T>(p: Promise<T>): Promise<T> {
  if (!current?.background) return p;
  return new Promise<T>((resolve, reject) => {
    let done = false;
    p.then((v) => { done = true; resolve(v); }, (e) => { done = true; reject(e); });
    const tick = () => {
      if (done) return;
      try { check(); } catch (err) { done = true; reject(err); return; }
      setTimeout(tick, 50);
    };
    tick();
  });
}

/**
 * Stop background copies for a page turn, except the ones it `needs` (keys from keyOf): resolves once none
 * other is running (or after a short cap).
 */
export async function hold(needs: string[] = []) {
  holding = true;
  needs.forEach((k) => wanted.add(k));
  if (current && wanted.has(current.key)) { current.background = false; return; }
  await Promise.race([currentDone.catch(() => {}), sleep(1500)]);
}
/** Background copies may run again. */
export function release() { holding = false; wanted.clear(); }

// ------------------------------------------------------------------ capture context
let ctxPromise: Promise<Context> | null = null;
let ctxScale = 0;
let useWorker = true;
let broken = 0; // bumped when the context had to be dropped; a copy that saw it change is discarded

function dropContext() {
  const old = ctxPromise;
  ctxPromise = null;
  broken++;
  old?.then((c) => { c.workers.forEach((w) => w.terminate()); destroyContext(c); }).catch(() => {});
}

async function context() {
  const d = dpr();
  if (ctxPromise && ctxScale !== d) dropContext();
  if (ctxPromise) return ctxPromise;
  ctxScale = d;
  // created on a detached element: on document.body it would first wait for every image in the document,
  // including the ones on pages not shown yet (which don't load until they're needed)
  const made = createContext(document.createElement('div'), {
    scale: d, workerUrl: useWorker ? workerUrl : null, workerNumber: 1, timeout: 8000,
    // only the properties these pages use (scripts/style-props.mjs), not all ~360 per node
    includeStyleProperties: styleProps,
    features: { restoreScrollPosition: false, copyScrollbar: false },
    onCloneEachNode: maybeYield,
    // and again between the later phases
    onCloneNode: async () => { sliceStart = 0; await maybeYield(); },
    onEmbedNode: async () => { sliceStart = 0; await maybeYield(); },
    onCreateForeignObjectSvg: async () => {
      // WebKit: modern-screenshot redraws the image once per embedded image, ~100 ms apart, to let nested
      // images decode, and that tail can't give way. Two redraws are enough; let a background copy bow out first.
      const c = await made;
      c.drawImageCount = Math.min(c.drawImageCount, 2);
      sliceStart = 0;
      await maybeYield();
    },
  });
  ctxPromise = made;
  made.then((c) => {
    // a worker that fails to load would leave its fetches waiting forever: drop it, redo copies without it
    c.workers.forEach((w) => w.addEventListener('error', () => { useWorker = false; dropContext(); }));
  }).catch(() => { dropContext(); });
  return made;
}

/** faces of the 3D board cards that point away from the viewer (the copy flattens 3D and ignores backface-visibility) */
const matrixOf = (el: Element) => { const t = getComputedStyle(el).transform; return t && t !== 'none' ? new DOMMatrix(t) : new DOMMatrix(); };
const facingAway = (n: HTMLElement) => {
  try { return matrixOf(n.parentElement!).multiply(matrixOf(n)).m33 < 0; } catch { return false; }
};

const skipAlways = (n: Node) =>
  // <source> would point a cloned <picture> at a file the SVG renderer can't load; a cloned <video> waits for
  // data that a preload="none" clip never loads; the wear layers are composited separately (compositeWear);
  // the 1620° note is never part of a landed look (a turn hides it)
  n instanceof HTMLSourceElement || n instanceof HTMLVideoElement ||
  (n instanceof HTMLElement && (n.classList.contains('wear') || n.hasAttribute('data-egg') || (n.classList.contains('board__face') && facingAway(n))));

async function capture(node: HTMLElement, w: number, h: number, bg: string | null, style: Partial<CSSStyleDeclaration> | null, skip?: (n: Node) => boolean) {
  const c = await context();
  const gen = broken;
  sliceStart = performance.now();
  c.node = node; c.width = w; c.height = h;
  c.backgroundColor = bg;
  c.style = style;
  c.filter = (n: Node) => !skipAlways(n) && !(skip?.(n) ?? false);
  c.drawImageCount = 0;
  let canvas: HTMLCanvasElement;
  try {
    canvas = await Promise.race([domToCanvas(c), stalled]);
  } catch (err) {
    // an aborted copy leaves its class styles behind in the shared context: start the next one clean
    c.svgStyles.clear();
    c.svgStyleElement = document.createElement('style');
    c.svgDefsElement = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    c.drawImageCount = 0;
    throw err;
  }
  // made while the context broke (e.g. its worker died): photos may be placeholders, don't keep it
  if (gen !== broken) throw new Error('capture context was replaced');
  if (!canvas.width) throw new Error('empty snapshot');
  // keep it as an ImageBitmap where possible: GPU-friendly, and it doesn't count against Safari's canvas memory
  const img: CanvasImageSource = 'createImageBitmap' in window ? await createImageBitmap(canvas).catch(() => canvas) : canvas;
  if (img !== canvas) { canvas.width = 0; canvas.height = 0; }
  return { img, w, h };
}

async function decodeImages(el: HTMLElement) {
  const imgs = Array.from(el.querySelectorAll('img'));
  await Promise.all(imgs.map((img) => {
    if (img.loading === 'lazy') img.loading = 'eager';
    return img.complete && img.naturalWidth ? Promise.resolve() : img.decode().catch(() => {});
  }));
}

const scrollerOf = (page: HTMLElement) => page.querySelector<HTMLElement>('[data-scroll]');

/**
 * Copy a page as it is right now in the DOM. `setLook` puts a page that isn't on screen into the look
 * being captured and returns how to undo it.
 */
// (the wear layers and the left-over creases aren't part of a copy: they may change; a style written again
// with the value it already had, as when a page turn resets the page it's about to show, changes nothing)
const observer = new MutationObserver((records) => {
  if (records.some((r) => {
    const el = r.target instanceof Element ? r.target : null;
    if (el?.closest('.wear')) return false;
    return !(r.type === 'attributes' && el && el.getAttribute(r.attributeName!) === r.oldValue);
  })) changed = true;
});

async function shoot(page: HTMLElement, look: Look, setLook: (look: Look) => (() => void) | void): Promise<Captured> {
  await interruptible(ready);
  check();
  const w = vw(), h = vh(), d = dpr();
  const hidden = !page.classList.contains('is-active');
  let undo: (() => void) | void = undefined;
  if (hidden) { page.classList.add('is-snap'); undo = setLook(look); } // rendered under the active page while we copy it
  try {
    await interruptible(decodeImages(page));
    await interruptible(new Promise((r) => { requestAnimationFrame(() => r(null)); setTimeout(r, 80); }));
    check();
    // from here on, any change to the page means the copy no longer shows it as it is
    changed = false;
    observer.observe(page, { subtree: true, childList: true, attributes: true, attributeOldValue: true, characterData: true });
    const sc = scrollerOf(page);
    const scroll = !!sc && sc.scrollHeight > sc.clientHeight + 2;
    const pageBg = getComputedStyle(page).backgroundColor;
    if (!scroll) {
      const base = await capture(page, w, h, pageBg, { visibility: 'visible', inset: '0', zIndex: 'auto', contentVisibility: 'visible' });
      return { vw: w, vh: h, dpr: d, scroll, base };
    }
    // background without the scroller, then the scroller's whole content column on a transparent ground
    const base = await capture(page, w, h, pageBg, { visibility: 'visible', inset: '0', zIndex: 'auto', contentVisibility: 'visible' }, (n) => n === sc);
    const ch = sc!.scrollHeight;
    const content = await capture(sc!, sc!.clientWidth, ch, null, { overflow: 'visible', bottom: 'auto' });
    return { vw: w, vh: h, dpr: d, scroll, base, content };
  } finally {
    observer.disconnect();
    if (hidden) { undo?.(); page.classList.remove('is-snap'); }
  }
}

const fresh = (c?: Captured) => !!c && c.vw === vw() && c.vh === vh() && c.dpr === dpr();
export const has = (i: number, look: Look, variant = '') => fresh(store.get(key(i, look, variant)));

/**
 * Capture (or reuse) one look of a page. Serialised: two copies never run at once. `variant` names a
 * landed look that differs from the default one (a board left showing its base after the 1620° spin);
 * `variantNow` re-reads it when the copy is done, so a copy taken while it changed isn't kept.
 */
export function ensure(
  pages: HTMLElement[], i: number, look: Look, setLook: (i: number, look: Look) => (() => void) | void,
  variant = '', background = false, variantNow?: () => string,
): Promise<Captured> {
  const k = key(i, look, variant);
  const have = store.get(k);
  if (fresh(have)) return Promise.resolve(have!);
  const p = pending.get(k);
  // a page turn asking for a copy that's running in the background: if that one gets paused, redo it now
  if (p) return background ? p : p.catch(() => ensure(pages, i, look, setLook, variant, false, variantNow));
  const run = async () => {
    if (fresh(store.get(k))) return store.get(k)!;
    const needed = holding && wanted.has(k);
    if (background && holding && !needed) throw new Aborted('stopped for a page turn');
    current = { key: k, background: background && !needed };
    changed = false;
    const tag = `${k}${background ? ' bg' : ''}`;
    performance.mark(`snap:start ${tag}`);
    // a stalled copy drops the context (and its fetches) and gives up, undoing its look; the timer goes as
    // soon as the copy settles
    stalled = new Promise<never>((_, reject) => { stallReject = reject; });
    stalled.catch(() => {});
    armStall();
    const done = shoot(pages[i], look, (l) => setLook(i, l));
    currentDone = done;
    try {
      const c = await Promise.race([done, stalled]);
      if (variantNow && variantNow() !== variant) throw new Aborted('the page changed while it was copied');
      performance.mark(`snap:done ${tag}`);
      return c;
    } catch (err) {
      performance.mark(`snap:${err instanceof Aborted ? 'gave-way' : 'failed'} ${tag} (${String((err as Error)?.message ?? err).slice(0, 120)})`);
      throw err;
    } finally { clearTimeout(stallTimer); stallReject = null; current = null; }
  };
  const job = queue.then(run).then((c) => { store.set(k, c); return c; });
  queue = job.catch(() => {});
  pending.set(k, job);
  const clear = () => { if (pending.get(k) === job) pending.delete(k); };
  job.then(clear, clear);
  return job;
}

export function invalidateAll() { store.clear(); }

// ------------------------------------------------------------------ composition
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
const wearUrl = (el: HTMLElement) => getComputedStyle(el).backgroundImage.match(/url\("?(.*?)"?\)/)?.[1];
/**
 * Ahead of the first turn: decode every page's wear textures, then compose a light and a dark page once
 * onto an empty base. The GPU's first high-quality scaling and first use of each blend mode compile shaders
 * (a few hundred ms on a phone), which would otherwise land in the first turn.
 */
export async function warmCompose(pages: HTMLElement[]) {
  await Promise.all(pages.flatMap((page) => Array.from(page.querySelectorAll<HTMLElement>(':scope > .wear')).map((el) => {
    const src = wearUrl(el);
    return src ? loadImg(src).catch(() => { imgCache.delete(src); }) : null;
  })));
  const empty = document.createElement('canvas');
  empty.width = empty.height = 1;
  const tones = new Map(pages.map((p) => [p.dataset.tone, p]));
  for (const page of tones.values()) {
    const c = await compose(page, { vw: vw(), vh: vh(), dpr: dpr(), scroll: false, base: { img: empty, w: 1, h: 1 } }, 0, false);
    // flushes the drawing on the GPU without making this thread wait for it
    if ('createImageBitmap' in window) (await createImageBitmap(c).catch(() => null))?.close();
    c.width = 0; c.height = 0;
  }
}
const blendOp = (m: string): GlobalCompositeOperation =>
  (['multiply', 'screen', 'overlay', 'soft-light', 'hard-light'].includes(m) ? m : 'source-over') as GlobalCompositeOperation;

/**
 * The wear layers (ageing, creases, grain, left-over crumple creases) sit on top of each page with
 * plain blend modes; draw them onto the composed texture with the same modes — same pixels as the page.
 */
async function compositeWear(page: HTMLElement, ctx: CanvasRenderingContext2D, w: number, h: number, withHandled: boolean) {
  for (const el of Array.from(page.querySelectorAll<HTMLElement>(':scope > .wear'))) {
    if (!withHandled && el.dataset.handled !== undefined) continue;
    const cs = getComputedStyle(el);
    const alpha = parseFloat(cs.opacity);
    if (!alpha) continue;
    const bake = el.querySelector('canvas');
    if (bake) { // the left-over creases: a canvas, drawn as is
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.globalCompositeOperation = blendOp(cs.mixBlendMode);
      ctx.drawImage(bake, 0, 0, w, h);
      ctx.restore();
      continue;
    }
    const src = wearUrl(el);
    if (!src) continue;
    const img = await loadImg(src);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.globalCompositeOperation = blendOp(cs.mixBlendMode);
    if (el.dataset.grain !== undefined) {
      ctx.fillStyle = ctx.createPattern(img, 'repeat')!;
      ctx.fillRect(0, 0, w, h);
    } else if (el.dataset.crease !== undefined) {
      // background-size 150%, a per-page background-position and maybe a horizontal flip
      const bw = w * 1.5, bh = h * 1.5;
      const [px, py] = cs.backgroundPosition.split(' ').map((v) => parseFloat(v) / 100);
      if (cs.transform !== 'none' && new DOMMatrix(cs.transform).a < 0) { ctx.translate(w, 0); ctx.scale(-1, 1); }
      ctx.drawImage(img, (w - bw) * px, (h - bh) * py, bw, bh);
    } else {
      ctx.drawImage(img, 0, 0, w, h);
    }
    ctx.restore();
  }
}

/**
 * The texture for a page: its captured look, scrolled to `scrollTop`, with the wear layers on top
 * (and, for the outgoing page, the creases it's still carrying from its last landing).
 */
export async function compose(page: HTMLElement, cap: Captured, scrollTop: number, withHandled: boolean) {
  const { vw: w, vh: h, dpr: d } = cap;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * d); canvas.height = Math.round(h * d);
  const ctx = canvas.getContext('2d')!;
  // scale the big wear textures the way the browser does for the live page
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.scale(d, d);
  ctx.drawImage(cap.base.img, 0, 0, w, h);
  if (cap.content) {
    const top = Math.max(0, Math.min(scrollTop, cap.content.h - h));
    ctx.drawImage(cap.content.img, 0, -top, cap.content.w, cap.content.h);
  }
  await compositeWear(page, ctx, w, h, withHandled);
  return canvas;
}
