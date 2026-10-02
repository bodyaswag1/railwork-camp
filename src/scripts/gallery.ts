// Page 03: contact-sheet tiles open a lightbox (swipe, ← →, Esc, captions). Clips are muted, looping,
// lazy and only play while the gallery page is the active page.
import { gallery as copy } from '../content/site';

export function initGallery(page: HTMLElement, onOpenChange: (open: boolean) => void) {
  const box = document.querySelector<HTMLElement>('[data-lightbox]')!;
  const stage = box.querySelector<HTMLElement>('[data-lb-stage]')!;
  const cap = box.querySelector<HTMLElement>('[data-lb-cap]')!;
  const tiles = Array.from(page.querySelectorAll<HTMLButtonElement>('[data-tile]'));
  const clips = Array.from(page.querySelectorAll<HTMLVideoElement>('video[data-clip]'));
  let at = -1;
  let lastFocus: HTMLElement | null = null;
  let tx: number | null = null;

  const render = () => {
    const t = tiles[at].dataset;
    stage.replaceChildren();
    if (t.kind === 'Clip') {
      if (t.video) {
        const v = document.createElement('video');
        Object.assign(v, { src: t.video, muted: true, loop: true, playsInline: true, autoplay: true, controls: true });
        v.setAttribute('aria-label', t.cap ?? '');
        stage.append(v);
      } else {
        const d = document.createElement('div');
        d.className = 'lightbox__clip'; d.textContent = copy.clipPlaceholder;
        stage.append(d);
      }
    } else {
      const img = new Image();
      img.src = t.full ?? ''; img.alt = t.cap ?? ''; img.decoding = 'async';
      stage.append(img);
    }
    cap.innerHTML = '';
    const b = document.createElement('b'); b.textContent = t.f ?? '';
    cap.append(b, ` — ${t.cap ?? ''}`);
  };

  const open = (i: number) => {
    lastFocus = document.activeElement as HTMLElement;
    at = i; render();
    box.hidden = false;
    onOpenChange(true);
    box.querySelector<HTMLElement>('[data-lb-close]')!.focus();
  };
  const close = () => {
    if (box.hidden) return;
    box.hidden = true; stage.replaceChildren(); at = -1;
    onOpenChange(false);
    lastFocus?.focus({ preventScroll: true });
  };
  const step = (d: number) => { at = (at + d + tiles.length) % tiles.length; render(); };

  tiles.forEach((t, i) => t.addEventListener('click', () => open(i)));
  box.querySelector('[data-lb-close]')!.addEventListener('click', close);
  box.querySelector('[data-lb-prev]')!.addEventListener('click', (e) => { e.stopPropagation(); step(-1); });
  box.querySelector('[data-lb-next]')!.addEventListener('click', (e) => { e.stopPropagation(); step(1); });
  box.addEventListener('click', (e) => { if (e.target === box) close(); });
  box.addEventListener('touchstart', (e) => { tx = e.touches[0].clientX; }, { passive: true });
  box.addEventListener('touchend', (e) => {
    if (tx == null) return;
    const dx = e.changedTouches[0].clientX - tx; tx = null;
    if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1);
  }, { passive: true });
  box.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'ArrowRight') step(1);
    else if (e.key === 'ArrowLeft') step(-1);
    else if (e.key === 'Tab') {
      // keep focus inside the dialog
      const f = Array.from(box.querySelectorAll<HTMLElement>('button, video[controls]'));
      const i = f.indexOf(document.activeElement as HTMLElement);
      const n = e.shiftKey ? (i <= 0 ? f.length - 1 : i - 1) : (i + 1) % f.length;
      e.preventDefault(); f[n].focus();
    }
  });

  /** clips play only while the page is active */
  const setActive = (on: boolean) => {
    clips.forEach((v) => {
      if (on) { if (v.preload === 'none') v.preload = 'auto'; v.play().catch(() => {}); }
      else v.pause();
    });
    if (!on) close();
  };

  return { setActive, close, isOpen: () => !box.hidden };
}
