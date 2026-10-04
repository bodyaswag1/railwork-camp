// Horizontal carousels inside the magazine pages: drag or swipe, prev/next buttons, ← → keys, trackpad
// sideways scroll. The track moves with a transform rather than native scrolling, so a copy of the page for
// the paper shows exactly what's on screen, and "which slide" is a plain number copies can be keyed on.
// A vertical drag is left alone: on a phone it turns the page (or scrolls it).
import { gsap } from 'gsap';

export type Carousel = {
  el: HTMLElement;
  /** index of the current stop */
  index(): number;
  goTo(i: number, animate?: boolean): void;
  /** jump a running slide animation to its end */
  finish(): void;
  /** back to the first slide, no animation */
  reset(): void;
};

type Opts = { reduced: boolean; onChange?: (i: number) => void };

export function initCarousel(el: HTMLElement, { reduced, onChange }: Opts): Carousel {
  const viewport = el.querySelector<HTMLElement>('[data-car-viewport]')!;
  const track = el.querySelector<HTMLElement>('[data-car-track]')!;
  const slides = Array.from(track.querySelectorAll<HTMLElement>('[data-slide]'));
  const prev = el.querySelector<HTMLButtonElement>('[data-car-prev]');
  const next = el.querySelector<HTMLButtonElement>('[data-car-next]');
  const count = el.querySelector<HTMLElement>('[data-car-count]');
  const pad = (n: number) => String(n).padStart(2, '0');

  let stops: number[] = [0];
  let at = 0;
  let x = 0;
  let tween: gsap.core.Tween | null = null;

  // writes only what changed: a page being copied for the paper must not see its DOM touched for nothing
  // (a hidden page laid out for a copy re-measures its carousels)
  const setX = (v: number) => { if (v === x && track.style.transform) return; x = v; gsap.set(track, { x: -v }); };

  function measure() {
    const max = Math.max(0, track.scrollWidth - viewport.clientWidth);
    const first = slides[0]?.offsetLeft ?? 0;
    // one stop per slide, the last few clamped so the final slide lines up with the right edge
    const s = slides.map((sl) => Math.round(Math.min(sl.offsetLeft - first, max)));
    stops = s.filter((v, i) => i === 0 || v > s[i - 1]);
    if (!stops.length) stops = [0];
    if (el.classList.contains('is-static') !== max <= 1) el.classList.toggle('is-static', max <= 1);
    at = Math.min(at, stops.length - 1);
  }

  function render() {
    const text = `${pad(at + 1)}/${pad(stops.length)}`;
    if (count && count.textContent !== text) count.textContent = text;
    if (prev && prev.disabled !== (at === 0)) prev.disabled = at === 0;
    if (next && next.disabled !== (at === stops.length - 1)) next.disabled = at === stops.length - 1;
  }

  function goTo(i: number, animate = true) {
    const t = Math.max(0, Math.min(stops.length - 1, i));
    const changed = t !== at;
    at = t;
    tween?.kill();
    if (!animate || reduced) { setX(stops[at]); tween = null; }
    else {
      const o = { v: x };
      tween = gsap.to(o, { v: stops[at], duration: 0.55, ease: 'power3.out', onUpdate: () => setX(o.v), onComplete: () => { tween = null; } });
    }
    render();
    if (changed) onChange?.(at);
  }
  const nearest = (v: number) => stops.reduce((b, s, i) => (Math.abs(s - v) < Math.abs(stops[b] - v) ? i : b), 0);

  prev?.addEventListener('click', () => goTo(at - 1));
  next?.addEventListener('click', () => goTo(at + 1));

  // ---- drag / swipe
  let drag: { id: number; x0: number; y0: number; base: number; from: number; axis: '' | 'x' | 'y'; lx: number; lt: number; v: number } | null = null;
  let dragged = false;
  viewport.addEventListener('pointerdown', (e) => {
    if ((e.pointerType === 'mouse' && e.button !== 0) || el.classList.contains('is-static')) return;
    dragged = false;
    tween?.kill(); tween = null;
    drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, base: x, from: at, axis: '', lx: e.clientX, lt: e.timeStamp, v: 0 };
  });
  viewport.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
    if (!drag.axis) {
      if (Math.hypot(dx, dy) < 8) return;
      drag.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      if (drag.axis === 'y') { drag = null; return; }
      try { viewport.setPointerCapture(e.pointerId); } catch { /* already gone */ }
      el.classList.add('is-dragging');
    }
    const max = stops[stops.length - 1];
    let nx = drag.base - dx;
    if (nx < 0) nx /= 3; else if (nx > max) nx = max + (nx - max) / 3; // a little give past the ends
    setX(nx);
    const dt = e.timeStamp - drag.lt;
    if (dt > 0) { drag.v = (e.clientX - drag.lx) / dt; drag.lx = e.clientX; drag.lt = e.timeStamp; }
  });
  const release = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag;
    drag = null;
    el.classList.remove('is-dragging');
    if (d.axis !== 'x') return;
    dragged = true;
    const dx = e.clientX - d.x0;
    let t = nearest(x);
    // a flick or a decent push moves at least one slide
    if (Math.abs(d.v) > 0.3 && e.timeStamp - d.lt < 120) t = d.from + (d.v < 0 ? 1 : -1);
    else if (t === d.from && Math.abs(dx) > 40) t = d.from + (dx < 0 ? 1 : -1);
    goTo(t);
  };
  viewport.addEventListener('pointerup', release);
  viewport.addEventListener('pointercancel', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag;
    drag = null;
    el.classList.remove('is-dragging');
    if (d.axis === 'x') goTo(nearest(x));
  });
  // a drag that ends on a photo isn't a tap on it
  viewport.addEventListener('click', (e) => { if (dragged) { e.preventDefault(); e.stopPropagation(); dragged = false; } }, true);
  viewport.addEventListener('dragstart', (e) => e.preventDefault());

  // ---- keys, trackpads, focus
  el.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); goTo(at + 1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); goTo(at - 1); }
  });
  let acc = 0, lastWheel = 0, wheelLock = 0;
  viewport.addEventListener('wheel', (e) => {
    if (Math.abs(e.deltaX) <= Math.abs(e.deltaY) || el.classList.contains('is-static')) return;
    const now = performance.now();
    if (now < wheelLock) { wheelLock = now + 160; return; } // swallow the trackpad's inertia
    if (now - lastWheel > 200) acc = 0;
    lastWheel = now;
    acc += e.deltaX;
    if (Math.abs(acc) > 40) { goTo(at + Math.sign(acc)); acc = 0; wheelLock = now + 350; }
  }, { passive: true });
  el.addEventListener('focusin', (e) => {
    const i = slides.findIndex((s) => s.contains(e.target as Node));
    if (i < 0) return;
    const r = slides[i].getBoundingClientRect(), v = viewport.getBoundingClientRect();
    if (r.left < v.left - 1 || r.right > v.right + 1) goTo(nearest(Math.min(slides[i].offsetLeft - slides[0].offsetLeft, stops[stops.length - 1])));
  });

  new ResizeObserver(() => { measure(); setX(stops[at]); render(); }).observe(viewport);
  measure(); render();

  return {
    el,
    index: () => at,
    goTo,
    finish: () => { if (tween) { tween.progress(1); tween = null; } },
    reset: () => { tween?.kill(); tween = null; at = 0; setX(0); render(); },
  };
}
