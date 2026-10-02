// Landing page controller: five full-screen pages, one gesture = one page.
// Wheel / trackpad, touch swipe, ↑ ↓ PgUp PgDn Space Home End, menu links, hashes, back/forward.
// The page change itself is delegated to a Transition (WebGL crumple, CSS fallback or reduced-motion fade).
import { pages, ui } from '../content/site';
import { agePaper } from './paper';
import { drawMarks, hideMarks, showMarks } from './marks';
import { initBoards } from './boards';
import { initGallery } from './gallery';
import { fadeTransition, cssTransition, type Transition, type Hooks } from './transitions';

const root = document.querySelector<HTMLElement>('[data-mag]')!;
const secs = Array.from(root.querySelectorAll<HTMLElement>('[data-page]'));
const ids = pages.map((p) => p.id) as string[];
const total = secs.length;
const live = root.querySelector<HTMLElement>('[data-live]')!;
const counter = root.querySelector<HTMLElement>('[data-counter]')!;
const menu = root.querySelector<HTMLElement>('[data-menu]')!;
const menuBtn = root.querySelector<HTMLButtonElement>('[data-menu-open]')!;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const debug = new URLSearchParams(location.search).has('debug');

if (reduced) root.classList.add('marks-static');

// Hand-jitter for the marker layer. The design file uses feTurbulence; recomputing turbulence every frame of
// a draw-on is costly, so the same smooth noise is rendered once into a tile and fed through feImage/feTile.
// Each page carries its own copy of the filter so a snapshot of the page renders it too.
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
  s.insertAdjacentHTML('afterbegin', `<svg aria-hidden="true" width="0" height="0" style="position:absolute;width:0;height:0"><defs>${jitFilter(id)}</defs></svg>`);
  s.querySelectorAll<SVGElement>('svg.mk:not(.mk-nf), svg.marks, svg[style*="#jit"]').forEach((el) => { el.style.filter = `url(#${id})`; });
});

// ageing: the page on screen first, the rest on idle (snapshots wait for it)
const paperReady = agePaper(root, secs[Math.max(0, ids.indexOf(location.hash.slice(1)))]);

// ---------------------------------------------------------------- state
let cur = Math.max(0, ids.indexOf(location.hash.slice(1)));
let busy = false;
let lockUntil = 0;
let acc = 0, lastWheel = 0, edgeAt = 0;
let ty: number | null = null, tUp = false, tDown = false;
let lightboxOpen = false;

export const state = {
  get cur() { return cur; },
  get busy() { return busy; },
  secs, reduced, debug, paperReady,
  /** called whenever a page's live look changes (marks drawn, board spun, scrolled) */
  onDirty: (_i: number) => {},
  /** called after each landing */
  onLanded: (_i: number) => {},
};

const boards = initBoards(secs[1], () => cur === 1 && !busy, reduced, () => state.onDirty(1));
const gallery = initGallery(secs[2], (open) => { lightboxOpen = open; });

let transition: Transition = reduced ? fadeTransition : cssTransition;
export const setTransition = (t: Transition) => { if (!reduced) transition = t; };

// ---------------------------------------------------------------- page states
const scroller = (i = cur) => secs[i].querySelector<HTMLElement>('[data-scroll]');
const atEdge = (dir: number) => {
  const el = scroller();
  if (!el || el.scrollHeight <= el.clientHeight + 2) return true;
  return dir > 0 ? el.scrollTop + el.clientHeight >= el.scrollHeight - 2 : el.scrollTop <= 1;
};
const blocked = () => !menu.hidden || lightboxOpen;

/** Put a page in its pre-landing state: marks hidden, entrance animations at their start. */
export function prepare(i: number) {
  const s = secs[i];
  if (reduced) showMarks(s); else hideMarks(s);
  const sc = scroller(i);
  if (sc) sc.scrollTop = 0;
  if (i === 1) boards.reset();
}

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
};

function land(i: number, focus = true) {
  const s = secs[i];
  const tl = drawMarks(s, reduced);
  tl.eventCallback('onComplete', () => state.onDirty(i));
  if (i === 1) boards.land();
  gallery.setActive(i === 2);
  if (focus) s.querySelector<HTMLElement>('h1, h2')?.focus({ preventScroll: true });
  state.onLanded(i);
}

// ---------------------------------------------------------------- go
export async function go(n: number, push = true) {
  if (busy || n < 0 || n >= total || n === cur) return;
  busy = true;
  const from = cur, dir: 1 | -1 = n > from ? 1 : -1;
  gallery.setActive(false);
  prepare(n);
  const hooks: Hooks = {
    showIn: () => setActive(n),
    hideOut: () => secs[from].classList.remove('is-active'),
    atBall: () => setCounter(n),
  };
  try {
    if (document.hidden) throw new Error('hidden');
    // the WebGL version loads on first interaction: give it a moment rather than falling back
    if (crumpleLoading) await Promise.race([crumpleLoading, new Promise((r) => setTimeout(r, 2500))]);
    await transition.run(from, n, dir, hooks);
  } catch (err) {
    if (debug) console.warn('[transition] fell back', err);
    try { await cssTransition.run(from, n, dir, hooks); } catch { /* last resort below */ }
  }
  setActive(n); setCounter(n);
  // the page we left goes back to its pre-landing state, ready for its next snapshot
  prepare(from);
  cur = n;
  if (push) { try { history.pushState(null, '', `#${ids[n]}`); } catch { /* file:// */ } }
  live.textContent = ui.announce(n + 1, total, pages[n].title);
  lockUntil = performance.now() + 400;
  busy = false;
  land(n);
}

// ---------------------------------------------------------------- input
addEventListener('wheel', (e) => {
  if (blocked()) return;
  const now = performance.now();
  // during a transition and right after it, swallow the trackpad's inertia (the lock keeps extending)
  if (busy || now < lockUntil) { lockUntil = Math.max(lockUntil, now + 140); acc = 0; return; }
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
  else if (e.key === 'Home') { e.preventDefault(); go(0); return; }
  else if (e.key === 'End') { e.preventDefault(); go(total - 1); return; }
  if (!d) return;
  if (busy || performance.now() < lockUntil) { e.preventDefault(); return; }
  if (!atEdge(d)) return; // let the page scroll inside
  e.preventDefault();
  go(cur + d);
});

addEventListener('touchstart', (e) => {
  if (blocked()) return;
  ty = e.touches[0].clientY; tUp = atEdge(-1); tDown = atEdge(1);
}, { passive: true });
addEventListener('touchend', (e) => {
  if (blocked() || ty == null) return;
  const dy = ty - e.changedTouches[0].clientY;
  ty = null;
  if (Math.abs(dy) < 50 || busy || performance.now() < lockUntil) return;
  const d = dy > 0 ? 1 : -1;
  if (d > 0 ? !tDown : !tUp) return;
  go(cur + d);
}, { passive: true });

addEventListener('popstate', () => {
  const i = ids.indexOf(location.hash.slice(1));
  if (i >= 0) go(i, false);
});

// scrolling inside a page changes what's on screen → its snapshot needs a refresh
secs.forEach((s, i) => {
  let t = 0;
  s.querySelector('[data-scroll]')?.addEventListener('scroll', () => { clearTimeout(t); t = window.setTimeout(() => state.onDirty(i), 160); }, { passive: true });
});

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
  go(Number(a.dataset.go));
}));
root.querySelector('[data-skip]')!.addEventListener('click', (e) => {
  e.preventDefault();
  secs[cur].querySelector<HTMLElement>('h1, h2')?.focus();
});

// ---------------------------------------------------------------- start
// hidden pages start in their pre-landing state through CSS (marks hidden, boards reset in initBoards);
// measuring every marker path now would force layout on pages nobody can see yet
setActive(cur); setCounter(cur);
try { history.replaceState(null, '', `#${ids[cur]}`); } catch { /* file:// */ }
const start = () => land(cur, false);
(document.fonts?.ready ?? Promise.resolve()).then(start);

// The WebGL crumple (three.js, shader compile, page snapshots) loads on the first sign of a reader —
// pointer, touch, wheel or key — so none of it competes with the first paint. ?debug loads it right away.
let crumpleLoading: Promise<unknown> | null = null;
if (!reduced) {
  const load = () => {
    if (crumpleLoading) return;
    triggers.forEach((t) => removeEventListener(t, load, true));
    crumpleLoading = import('./crumple/index')
      .then((m) => m.install({ go, prepare, setTransition, state }))
      .catch((err) => { if (debug) console.warn('[crumple] unavailable, CSS fallback stays', err); })
      .finally(() => { crumpleLoading = null; });
  };
  const triggers = ['pointermove', 'pointerdown', 'touchstart', 'wheel', 'keydown', 'scroll'];
  triggers.forEach((t) => addEventListener(t, load, { capture: true, passive: true }));
  if (debug) addEventListener('load', () => setTimeout(load, 0), { once: true });
}

export type Mag = { go: typeof go; prepare: typeof prepare; setTransition: typeof setTransition; state: typeof state };
