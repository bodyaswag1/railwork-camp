// The page marker layer: strokes draw on with DrawSVG, handwritten notes appear through a stepped
// left→right mask (writing direction), and it all redraws every time a page lands.
import { gsap } from 'gsap';
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin';

gsap.registerPlugin(DrawSVGPlugin);

const tls = new WeakMap<Element, gsap.core.Timeline>();

const strokes = (page: Element) => Array.from(page.querySelectorAll<SVGGeometryElement>('[data-draw]'));
const inks = (page: Element) => Array.from(page.querySelectorAll<HTMLElement>('[data-ink]'));

// visibility and the starting clip are plain style writes: going through GSAP's CSS plugin would read
// computed styles for every mark on every landing
const setStyle = (els: Element[], prop: 'visibility' | 'clipPath', v: string) => els.forEach((el) => { (el as HTMLElement).style[prop] = v; });

/** Pre-landing state: everything hidden (this is what the incoming snapshot shows). */
export function hideMarks(page: Element) {
  tls.get(page)?.kill();
  tls.delete(page);
  const s = strokes(page), n = inks(page);
  setStyle(s, 'visibility', 'hidden');
  setStyle(n, 'visibility', 'hidden');
  setStyle(n, 'clipPath', 'inset(0 100% 0 0)');
}

/** Fully drawn, no motion (reduced motion). */
export function showMarks(page: Element) {
  tls.get(page)?.kill();
  const s = strokes(page), n = inks(page);
  s.forEach((p) => { p.style.strokeDasharray = ''; p.style.strokeDashoffset = ''; });
  setStyle(s, 'visibility', 'visible');
  setStyle(n, 'visibility', 'visible');
  setStyle(n, 'clipPath', 'none');
}

/**
 * Draw the marks on: strokes staggered over ~600 ms, then the notes write themselves in.
 * Returns the timeline so callers can wait for it.
 */
export function drawMarks(page: Element, reduced: boolean) {
  if (reduced) { showMarks(page); return gsap.timeline(); }
  hideMarks(page);
  const s = strokes(page), n = inks(page);
  const tl = gsap.timeline();
  if (s.length) {
    gsap.set(s, { drawSVG: '0%' });
    tl.call(() => setStyle(s, 'visibility', 'visible'), [], 0);
    // each mark wobbles a little in speed, like a hand
    s.forEach((p, i) => tl.to(p, { drawSVG: '100%', duration: 0.42 + Math.random() * 0.16, ease: 'power2.out' }, 0.04 + i * (0.6 / Math.max(6, s.length))));
  }
  n.forEach((el, i) => {
    const at = 0.25 + Math.min(0.45, s.length * 0.035) + i * 0.12;
    tl.call(() => { el.style.visibility = 'visible'; }, [], at);
    tl.fromTo(el, { clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)', duration: 0.48, ease: 'steps(7)', immediateRender: false }, at);
  });
  tls.set(page, tl);
  return tl;
}
