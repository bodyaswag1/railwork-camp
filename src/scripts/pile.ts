// A pile of taped prints, one on top of another: the top one is the photo you see. Swipe it left (or tap it)
// and it goes to the bottom of the pile; swipe right and the bottom one comes back on top. ← → work too.
// Cards are placed with transforms only, so a copy of the page for the paper shows the pile as it lies, and
// "which print is on top" is a plain number the copies can be keyed on (same interface as a carousel).
import { gsap } from 'gsap';
import type { Carousel } from './carousel';

type Opts = { reduced: boolean; onChange?: (i: number) => void };

// how the prints under the top one lie: a little lower, a little turned, alternating
const POSE = [
  { x: 0, y: 0, rotation: 0 },
  { x: 7, y: 6, rotation: 4.5 },
  { x: -6, y: 10, rotation: -4 },
  { x: 10, y: 13, rotation: 7 },
];

export function initPile(el: HTMLElement, { reduced, onChange }: Opts): Carousel {
  const cards = Array.from(el.querySelectorAll<HTMLElement>('[data-slide]'));
  const count = el.querySelector<HTMLElement>('[data-car-count]');
  const n = cards.length;
  // GIF prints: the animation is fetched once the print is on top or next up (reduced motion keeps the still)
  const gifs = cards.map((c) => c.querySelector<HTMLImageElement>('img[data-gif]'));
  const wake = () => {
    if (reduced) return;
    gifs.forEach((g, i) => {
      if (!g || g.getAttribute('src') || depth(i) > 1) return;
      g.addEventListener('load', () => g.classList.add('is-loaded'), { once: true });
      g.src = g.dataset.gif!;
    });
  };
  const pad = (v: number) => String(v).padStart(2, '0');
  let top = 0;

  const depth = (i: number) => (i - top + n) % n;
  const pose = (d: number) => ({ ...(POSE[d] ?? POSE[POSE.length - 1]), autoAlpha: d < POSE.length ? 1 : 0 });

  // writes only what changed: a page being copied for the paper must not see its DOM touched for nothing
  const setAttr = (c: HTMLElement, k: string, v: string) => { if (c.getAttribute(k) !== v) c.setAttribute(k, v); };
  function layout(animate: boolean, skip?: HTMLElement) {
    cards.forEach((c, i) => {
      const d = depth(i);
      const z = String(n - d);
      if (c.style.zIndex !== z) c.style.zIndex = z;
      setAttr(c, 'aria-hidden', d ? 'true' : 'false');
      if (c === skip) return;
      if (animate && !reduced) gsap.to(c, { ...pose(d), duration: 0.38, ease: 'power2.out', overwrite: true });
      else gsap.set(c, pose(d));
    });
    wake();
    const text = `${pad(top + 1)}/${pad(n)}`;
    if (count && count.textContent !== text) count.textContent = text;
  }

  function goTo(i: number, animate = true) {
    const t = ((i % n) + n) % n;
    if (t === top) return;
    top = t;
    layout(animate);
    onChange?.(top);
  }

  /** throw the top print off to one side; it lands at the bottom of the pile */
  function next(dir = -1) {
    const card = cards[top];
    top = (top + 1) % n;
    onChange?.(top);
    if (reduced) { layout(false); return; }
    layout(true, card);
    const w = card.offsetWidth;
    gsap.to(card, {
      x: dir * w * 1.15, y: -12, rotation: dir * 16, duration: 0.24, ease: 'power2.in', overwrite: true,
      onComplete: () => { card.style.zIndex = '0'; gsap.to(card, { ...pose(depth(cards.indexOf(card))), duration: 0.34, ease: 'power2.out' }); },
    });
  }
  /** pull the bottom print back on top, from the side it was thrown to */
  function prev() {
    top = (top - 1 + n) % n;
    onChange?.(top);
    const card = cards[top];
    if (reduced) { layout(false); return; }
    gsap.set(card, { x: card.offsetWidth * 1.15, y: -12, rotation: 16, autoAlpha: 1 });
    layout(true);
  }

  // ---- drag / swipe (vertical gestures are left to the page)
  let drag: { id: number; x0: number; y0: number; t0: number; axis: '' | 'x' | 'y'; lx: number; lt: number; v: number } | null = null;
  let dragged = false;
  el.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    dragged = false;
    drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, t0: e.timeStamp, axis: '', lx: e.clientX, lt: e.timeStamp, v: 0 };
  });
  el.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
    if (!drag.axis) {
      if (Math.hypot(dx, dy) < 8) return;
      drag.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      if (drag.axis === 'y') { drag = null; return; }
      try { el.setPointerCapture(e.pointerId); } catch { /* already gone */ }
      el.classList.add('is-dragging');
    }
    gsap.set(cards[top], { x: dx, y: Math.abs(dx) * -0.04, rotation: dx * 0.06, overwrite: true });
    const dt = e.timeStamp - drag.lt;
    if (dt > 0) { drag.v = (e.clientX - drag.lx) / dt; drag.lx = e.clientX; drag.lt = e.timeStamp; }
  });
  const release = (e: PointerEvent, cancelled = false) => {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag;
    drag = null;
    el.classList.remove('is-dragging');
    // a tap on the top print turns to the next one (read from the pointer itself: after a swipe, browsers
    // sometimes don't send the click that should follow a tap)
    if (!d.axis && !cancelled && e.timeStamp - d.t0 < 600 && (e.target as Element).closest('[data-slide]')) { next(-1); return; }
    if (d.axis !== 'x') return;
    dragged = true;
    const dx = e.clientX - d.x0;
    const flick = Math.abs(d.v) > 0.35 && e.timeStamp - d.lt < 120;
    if (!cancelled && (Math.abs(dx) > 56 || flick)) {
      if ((flick ? d.v : dx) < 0) next(-1); else { gsap.to(cards[top], { ...pose(0), duration: 0.2, overwrite: true }); prev(); }
    } else gsap.to(cards[top], { ...pose(0), duration: 0.3, ease: 'back.out(2)', overwrite: true });
  };
  el.addEventListener('pointerup', (e) => release(e));
  el.addEventListener('pointercancel', (e) => release(e, true));
  // a drag that ends on a print isn't a click on it
  el.addEventListener('click', (e) => { if (dragged) { e.preventDefault(); e.stopPropagation(); dragged = false; } });
  el.addEventListener('dragstart', (e) => e.preventDefault());
  el.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); next(-1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); prev(); }
  });

  layout(false);
  return {
    el,
    index: () => top,
    goTo,
    finish: () => { gsap.getTweensOf(cards).forEach((t) => t.progress(1)); layout(false); },
    reset: () => { gsap.killTweensOf(cards); top = 0; layout(false); },
  };
}
