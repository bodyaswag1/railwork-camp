// Landing page controller: eight full-screen pages, one gesture = one page.
// Wheel / trackpad, touch swipe, ↑ ↓ PgUp PgDn Space Home End, menu and nav links, hashes, back/forward.
// The page change itself is delegated to a Transition (WebGL crumple, CSS fallback or reduced-motion fade).
// Sideways drags belong to the carousels inside the pages, never to page turns.
import { pages, ui } from '../content/site';
import { agePaper } from './paper';
import { drawMarks, hideMarks, showMarks, finishMarks } from './marks';
import { initCarousel, type Carousel } from './carousel';
import { initPile } from './pile';
import { initCases } from './cases';
import { initBoards } from './boards';
import { fadeTransition, cssTransition, type Transition, type Hooks } from './transitions';

const root = document.querySelector<HTMLElement>('[data-mag]')!;
const secs = Array.from(root.querySelectorAll<HTMLElement>('[data-page]'));
const ids = pages.map((p) => p.id) as string[];
const total = secs.length;
const live = root.querySelector<HTMLElement>('[data-live]')!;
const counter = root.querySelector<HTMLElement>('[data-counter]')!;
const masthead = root.querySelector<HTMLElement>('[data-chrome]')!;
const menu = root.querySelector<HTMLElement>('[data-menu]')!;
const menuBtn = root.querySelector<HTMLButtonElement>('[data-menu-open]')!;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const debug = new URLSearchParams(location.search).has('debug');

if (reduced) root.classList.add('marks-static');

// Hand-jitter for the marker layer. The design file uses feTurbulence; recomputing turbulence every frame of
// a draw-on is costly, so the same smooth noise is rendered once into a tile and fed through feImage/feTile.
// Each page carries its own copy of the filter so a snapshot of the page renders it too — inside the scroll
// column on pages that scroll, since that column is copied on its own.
const jitterTile = (() => {
  const N = 64, cell = 16, g = N / cell; // ~ baseFrequency .035 → features every ~28 units
  const grid = (seed: number) => { let x = seed; return Array.from({ length: (g + 1) ** 2 }, () => { x = (x * 16807) % 2147483647; return x / 2147483647; }); };
  const gr = grid(5), gg = grid(17);
  const c = document.createElement('canvas'); c.width = c.height = N;
  const ctx = c.getContext('2d')!, img = ctx.createImageData(N, N);
  const at = (G: number[], x: number, y: number) => {
    const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const v = (a: number, b: number) => G[(b % g) * (g + 1) + (a % g)];
    return v(i, j) * (1 - sx) * (1 - sy) + v(i + 1, j) * sx * (1 - sy) + v(i, j + 1) * (1 - sx) * sy + v(i + 1, j + 1) * sx * sy;
  };
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const k = (y * N + x) * 4;
    img.data[k] = 255 * at(gr, x / cell, y / cell); img.data[k + 1] = 255 * at(gg, x / cell, y / cell); img.data[k + 2] = 128; img.data[k + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return c.toDataURL();
})();
const jitFilter = (id: string) => `<filter id="${id}" x="-10%" y="-10%" width="120%" height="120%" color-interpolation-filters="sRGB"><feImage href="${jitterTile}" x="0" y="0" width="64" height="64" result="t"/><feTile in="t" result="j"/><feDisplacementMap in="SourceGraphic" in2="j" scale="3.5" xChannelSelector="R" yChannelSelector="G"/></filter>`;
root.querySelector('#jit')?.replaceWith(document.createRange().createContextualFragment(`<svg xmlns="http://www.w3.org/2000/svg">${jitFilter('jit')}</svg>`).querySelector('filter')!);
secs.forEach((s) => {
  const id = `jit-${s.id}`;
  (s.querySelector('[data-scroll]') ?? s).insertAdjacentHTML('afterbegin', `<svg aria-hidden="true" width="0" height="0" style="position:absolute;width:0;height:0"><defs>${jitFilter(id)}</defs></svg>`);
  s.querySelectorAll<SVGElement>('svg.mk:not(.mk-nf), svg.marks, svg[style*="#jit"]').forEach((el) => { el.style.filter = `url(#${id})`; });
});

// ageing: the page on screen first, the rest on idle (snapshots wait for it)
const paperReady = agePaper(root, secs[Math.max(0, ids.indexOf(location.hash.slice(1)))]);

// ---------------------------------------------------------------- state
let cur = Math.max(0, ids.indexOf(location.hash.slice(1)));
let busy = false;
let lockUntil = 0;
let acc = 0, lastWheel = 0, edgeAt = 0;
let ty: number | null = null, tx = 0, tUp = false, tDown = false, swiped = false, axis: '' | 'x' | 'y' = '';
let lastInput = 0;
const settled = new Set<number>(); // pages whose entrance animations have finished
const marked = new Set<number>(); // pages whose marks have finished drawing on

export const state = {
  get cur() { return cur; },
  get busy() { return busy; },
  secs, reduced, debug, paperReady,
  /** ms since the reader last touched, scrolled, clicked or pressed a key */
  quietFor: () => performance.now() - lastInput,
  /** the page's entrance animations are done (its DOM shows the landed look) */
  isSettled: (i: number) => settled.has(i),
  /** the page's busy entrance animations are over: marks drawn, boards landed and not spinning (slow intro flips may still run) */
  isCalm: (i: number) => marked.has(i) && (i !== BOARDS || boards.landed()),
  /** which landed look a page has right now ('' = the default one): the slide each of its carousels is on,
      and a board left showing its base */
  variant: (i: number) => {
    const at = (carousels.get(i) ?? []).map((c) => c.index());
    const slides = at.some((n) => n > 0) ? at.join('.') : '';
    const spun = i === BOARDS ? boards.variant() : '';
    return [slides, spun].filter(Boolean).join('|');
  },
  /** jump a page's entrance animations to their end, so its DOM shows the landed look */
  finishLanding: (i: number) => {
    finishMarks(secs[i]);
    // a page left before it ever drew its marks (a swipe before the fonts arrived) still shows them now
    if (!marked.has(i)) showMarks(secs[i]);
    carousels.get(i)?.forEach((c) => c.finish());
    if (i === BOARDS) { boards.finish(); if (!boards.introRan()) boards.landedPose(); }
    marked.add(i); settled.add(i);
  },
  /** put an off-screen page into a look for a copy; returns how to undo it */
  setLook: (i: number, look: 'pre' | 'landed'): (() => void) | void => {
    if (look === 'pre') return;
    showMarks(secs[i]);
    if (i === BOARDS) boards.landedPose();
    return () => prepare(i);
  },
  /** called when a page's look changes after landing (marks done, a board spun) */
  onDirty: (_i: number) => {},
  /** called after each landing */
  onLanded: (_i: number) => {},
};

// carousels, per page: the slide they're on is part of the page's look
const carousels = new Map<number, Carousel[]>();
secs.forEach((s, i) => {
  const list = Array.from(s.querySelectorAll<HTMLElement>('[data-carousel]')).map((el) => (el.hasAttribute('data-pile') ? initPile : initCarousel)(el, {
    reduced,
    // a new slide is a new look for the page (copied again once the reader is quiet)
    onChange: () => { lastInput = performance.now(); if (i === cur) state.onDirty(i); },
  }));
  if (list.length) carousels.set(i, list);
});
// page 02: the three pro boards drop in, flip, and spin on hover or tap
const BOARDS = secs.findIndex((s) => s.querySelector('[data-drop]'));
const boards = initBoards(secs[BOARDS], () => cur === BOARDS && !busy, reduced,
  () => { settled.add(BOARDS); state.onDirty(BOARDS); },
  // a spin changes the page: it isn't settled until it stops, and a copy running now gives way
  () => { settled.delete(BOARDS); lastInput = performance.now(); });
const casesPage = secs.find((s) => s.querySelector('[data-case]'));
const cases = casesPage ? initCases(casesPage) : null;

let transition: Transition = reduced ? fadeTransition : cssTransition;
export const setTransition = (t: Transition) => { if (!reduced) transition = t; };

// ---------------------------------------------------------------- page states
const scroller = (i = cur) => secs[i].querySelector<HTMLElement>('[data-scroll]');
const atEdge = (dir: number) => {
  const el = scroller();
  if (!el || el.scrollHeight <= el.clientHeight + 2) return true;
  return dir > 0 ? el.scrollTop + el.clientHeight >= el.scrollHeight - 2 : el.scrollTop <= 1;
};
const blocked = () => !menu.hidden;

/** Put a page in its pre-landing state: marks hidden, entrance animations at their start. */
export function prepare(i: number) {
  const s = secs[i];
  if (reduced) showMarks(s); else hideMarks(s);
  const sc = scroller(i);
  if (sc) sc.scrollTop = 0;
  carousels.get(i)?.forEach((c) => c.reset());
  if (s === casesPage) cases?.pauseAll();
  if (i === BOARDS) boards.reset();
}

/** the masthead takes the colours of the page under it ('dark' while the paper is on the black stage) */
const setHead = (tone: string) => { masthead.dataset.head = tone; };
const setAt = (i: number) => { masthead.dataset.at = ids[i]; };

function setActive(i: number) {
  secs.forEach((s, k) => {
    const on = k === i;
    s.classList.toggle('is-active', on);
    s.inert = !on;
    if (on) s.removeAttribute('aria-hidden'); else s.setAttribute('aria-hidden', 'true');
  });
}

const setCounter = (i: number) => {
  counter.textContent = `${String(i + 1).padStart(2, '0')}/${String(total).padStart(2, '0')}`;
  menu.querySelectorAll('[data-go]').forEach((a, k) => {
    if (k === i) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  masthead.querySelectorAll<HTMLElement>('[data-nav]').forEach((a) => {
    if (a.dataset.nav === ids[i]) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
  });
};

let landedOnce = false;
function land(i: number, focus = true) {
  landedOnce = true;
  const s = secs[i];
  settled.delete(i); marked.delete(i);
  const tl = drawMarks(s, reduced);
  tl.eventCallback('onComplete', () => { marked.add(i); if (i !== BOARDS) settled.add(i); state.onDirty(i); });
  if (i === BOARDS) boards.land();
  if (focus) s.querySelector<HTMLElement>('h1, h2')?.focus({ preventScroll: true });
  state.onLanded(i);
}

// ---------------------------------------------------------------- go
// A menu link, Home/End or back/forward pressed during a turn is kept and followed once it lands
// (swipes and wheel aren't: a gesture during a turn must not turn a second page).
let queued: [number, boolean] | null = null;
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
export async function go(n: number, push = true, explicit = false) {
  if (busy) { if (explicit) queued = [n, push]; return; }
  if (n < 0 || n >= total || n === cur) return;
  busy = true;
  landedOnce = true;
  performance.mark('turn:start');
  const from = cur, dir: 1 | -1 = n > from ? 1 : -1;
  cases?.pauseAll();
  prepare(n);
  // the arriving page renders underneath from now on, so it's ready to take over the moment the paper lands
  secs[n].classList.add('is-next');
  const hooks: Hooks = {
    showIn: () => { setActive(n); setHead(secs[n].dataset.head ?? 'dark'); },
    hideOut: () => { secs[from].classList.remove('is-active'); setHead('dark'); setAt(n); },
    atBall: () => setCounter(n),
  };
  try {
    if (document.hidden) throw new Error('hidden');
    // the paper crumple may still be loading (first gesture right after load): wait for it, it's the turn —
    // but not forever (a stalled download): then this one turn is a quiet fade
    let t = transition;
    if (crumpleLoading) {
      const ready = await Promise.race([crumpleLoading.then(() => true), sleep(3000).then(() => false)]);
      t = ready ? transition : fadeTransition;
    }
    await t.run(from, n, dir, hooks);
  } catch (err) {
    if (debug) console.warn('[transition] fell back', err);
    // without WebGL the CSS paper version is the page turn; if the WebGL turn itself fails, a quiet fade
    try { await (transition === cssTransition ? cssTransition : fadeTransition).run(from, n, dir, hooks); } catch { /* last resort below */ }
  }
  setActive(n); setCounter(n); setHead(secs[n].dataset.head ?? 'dark'); setAt(n);
  secs[n].classList.remove('is-next');
  // the page we left goes back to its pre-landing state, ready for its next snapshot
  prepare(from);
  cur = n;
  if (push) { try { history.pushState(null, '', `#${ids[n]}`); } catch { /* file:// */ } }
  live.textContent = ui.announce(n + 1, total, pages[n].title);
  lockUntil = performance.now() + 400;
  busy = false;
  land(n);
  if (queued) {
    const [q, p] = queued;
    queued = null;
    if (q !== cur) go(q, p, true);
  }
}

// ---------------------------------------------------------------- input
addEventListener('wheel', (e) => {
  if (blocked()) return;
  const now = performance.now();
  // during a transition and right after it, swallow the trackpad's inertia (the lock keeps extending)
  if (busy || now < lockUntil) { lockUntil = Math.max(lockUntil, now + 140); acc = 0; return; }
  if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return; // sideways: a carousel's
  const dir = Math.sign(e.deltaY);
  if (!dir) return;
  if (!atEdge(dir)) { edgeAt = now; acc = 0; return; }
  if (now - edgeAt < 300) { edgeAt = now; return; }
  if (now - lastWheel > 220) acc = 0;
  lastWheel = now;
  acc += e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
  if (Math.abs(acc) > 50) { acc = 0; go(cur + dir); }
}, { passive: true });

addEventListener('keydown', (e) => {
  if (blocked()) {
    if (!menu.hidden && e.key === 'Escape') closeMenu();
    return;
  }
  const t = e.target as HTMLElement | null;
  if (t?.closest('input, textarea, select, video')) return;
  const onControl = t?.closest('button, a, [role=button]');
  let d = 0;
  if (e.key === 'ArrowDown' || e.key === 'PageDown' || (e.key === ' ' && !onControl)) d = 1;
  else if (e.key === 'ArrowUp' || e.key === 'PageUp') d = -1;
  else if (e.key === 'Home') { e.preventDefault(); go(0, true, true); return; }
  else if (e.key === 'End') { e.preventDefault(); go(total - 1, true, true); return; }
  if (!d) return;
  if (busy || performance.now() < lockUntil) { e.preventDefault(); return; }
  if (!atEdge(d)) return; // let the page scroll inside
  e.preventDefault();
  go(cur + d);
});

// Touch: the turn is decided while the finger moves, not on touchend — mobile browsers often send
// touchcancel instead (address bar, pull-to-refresh), which used to swallow the swipe.
// On a page that scrolls inside, a swipe turns the page only if it starts at that edge: scrolling to the
// end of a page never flips it by itself.
// A gesture that starts sideways is a carousel's (or nothing), never a page turn.
const SWIPE = 48;
addEventListener('touchstart', (e) => {
  if (blocked() || e.touches.length > 1) { ty = null; return; }
  ty = e.touches[0].clientY; tx = e.touches[0].clientX;
  tUp = atEdge(-1); tDown = atEdge(1);
  swiped = false; axis = '';
}, { passive: true });
addEventListener('touchmove', (e) => {
  if (ty == null || swiped || blocked() || e.touches.length > 1) return;
  const y = e.touches[0].clientY;
  if (!axis) {
    const dx = e.touches[0].clientX - tx, dy = y - ty;
    if (Math.hypot(dx, dy) < 10) return;
    axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
  }
  if (axis === 'x') return;
  const d = y < ty ? 1 : -1; // finger moving up → next page
  if (d > 0 ? !tDown : !tUp) return;
  if (Math.abs(y - ty) < SWIPE) return;
  swiped = true;
  if (busy || performance.now() < lockUntil) return;
  go(cur + d);
}, { passive: true });
const endTouch = () => { ty = null; };
addEventListener('touchend', endTouch, { passive: true });
addEventListener('touchcancel', endTouch, { passive: true });

addEventListener('popstate', () => {
  const i = ids.indexOf(location.hash.slice(1));
  if (i >= 0) go(i, false, true);
});

// page copies for the paper wait until the reader is quiet, so they never stutter scrolling or a swipe
const touched = () => { lastInput = performance.now(); };
for (const t of ['touchstart', 'touchmove', 'wheel', 'pointerdown', 'keydown']) addEventListener(t, touched, { capture: true, passive: true });
secs.forEach((s) => s.querySelector('[data-scroll]')?.addEventListener('scroll', touched, { passive: true }));

// ---------------------------------------------------------------- menu + links
function openMenu() {
  menu.hidden = false;
  menuBtn.setAttribute('aria-expanded', 'true');
  menu.querySelector<HTMLElement>('[aria-current="page"], [data-go]')?.focus();
}
function closeMenu(refocus = true) {
  if (menu.hidden) return;
  menu.hidden = true;
  menuBtn.setAttribute('aria-expanded', 'false');
  if (refocus) menuBtn.focus();
}
menuBtn.addEventListener('click', openMenu);
menu.querySelector('[data-menu-close]')!.addEventListener('click', () => closeMenu());
menu.addEventListener('keydown', (e) => {
  if (e.key !== 'Tab') return;
  const f = Array.from(menu.querySelectorAll<HTMLElement>('a, button'));
  const i = f.indexOf(document.activeElement as HTMLElement);
  const n = e.shiftKey ? (i <= 0 ? f.length - 1 : i - 1) : (i + 1) % f.length;
  e.preventDefault(); f[n].focus();
});
root.querySelectorAll<HTMLAnchorElement>('[data-go]').forEach((a) => a.addEventListener('click', (e) => {
  e.preventDefault();
  closeMenu(false);
  go(Number(a.dataset.go), true, true);
}));
root.querySelector('[data-skip]')!.addEventListener('click', (e) => {
  e.preventDefault();
  secs[cur].querySelector<HTMLElement>('h1, h2')?.focus();
});

// ---------------------------------------------------------------- start
// hidden pages start in their pre-landing state through CSS (marks hidden, carousels on their first slide,
// boards reset in initBoards);
// measuring every marker path now would force layout on pages nobody can see yet
setActive(cur); setCounter(cur); setHead(secs[cur].dataset.head ?? 'dark'); setAt(cur);
try { history.replaceState(null, '', `#${ids[cur]}`); } catch { /* file:// */ }
// the first landing waits for the fonts; if the reader has already turned the page by then, skip it
const start = () => { if (!landedOnce && !busy) land(cur, false); };
(document.fonts?.ready ?? Promise.resolve()).then(start);

// The WebGL crumple (three.js, shader compile, page copies) loads once the page has painted and settled,
// or at the first sign of a reader, whichever comes first — so it's ready by the first swipe without
// competing with the first paint. A gesture made while it loads waits for it.
let crumpleLoading: Promise<unknown> | null = null;
let crumpleStarted = false;
if (!reduced) {
  const load = () => {
    if (crumpleStarted) return;
    crumpleStarted = true;
    triggers.forEach((t) => removeEventListener(t, load, true));
    crumpleLoading = import('./crumple/index')
      .then((m) => m.install({ go, prepare, setTransition, state }))
      .catch((err) => { if (debug) console.warn('[crumple] unavailable, CSS fallback stays', err); })
      .finally(() => { crumpleLoading = null; });
  };
  const triggers = ['pointermove', 'pointerdown', 'touchstart', 'wheel', 'keydown', 'scroll'];
  triggers.forEach((t) => addEventListener(t, load, { capture: true, passive: true }));
  const idleLoad = () => ('requestIdleCallback' in window ? (window as any).requestIdleCallback(load, { timeout: 1000 }) : load());
  // the file itself downloads (only downloads: nothing runs) as soon as the page has loaded, so a quick
  // first swipe on a phone network doesn't wait for it
  const prefetch = () => {
    const src = document.querySelector<HTMLMetaElement>('meta[name="crumple-chunk"]')?.content;
    if (!src) return;
    const l = document.createElement('link');
    l.rel = 'prefetch'; l.href = src; l.crossOrigin = 'anonymous'; // the same request mode as import()
    document.head.append(l);
  };
  const soon = () => {
    prefetch();
    setTimeout(idleLoad, debug ? 0 : 2500);
  };
  if (document.readyState === 'complete') soon(); else addEventListener('load', soon, { once: true });
}

export type Mag = { go: typeof go; prepare: typeof prepare; setTransition: typeof setTransition; state: typeof state };
