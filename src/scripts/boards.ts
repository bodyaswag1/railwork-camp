// Page 02: the three vertical pro-model boards. Drop in one by one with a landing bounce, flip to show
// the base and back, spin 360° on hover/tap. Board 1 is the easter egg: 1620° and a "1620°!" note.
import { gsap } from 'gsap';

type Board = { drop: HTMLElement; card: HTMLElement; rot: number; busy: boolean };

export function initBoards(page: HTMLElement, isActive: () => boolean, reduced: boolean, onSettle: () => void) {
  const boards: Board[] = Array.from(page.querySelectorAll<HTMLElement>('[data-drop]')).map((drop) => ({
    drop, card: drop.querySelector<HTMLElement>('[data-spin]')!, rot: 0, busy: false,
  }));
  const egg = page.querySelector<HTMLElement>('[data-egg]');
  let intro: gsap.core.Timeline | null = null;

  /** Pre-landing state: boards above the page, waiting to drop (matches the incoming snapshot). */
  const reset = () => {
    intro?.kill(); intro = null;
    boards.forEach((b) => {
      gsap.killTweensOf([b.drop, b.card]);
      b.rot = 0; b.busy = false;
      gsap.set(b.drop, { yPercent: 0, y: reduced ? 0 : -window.innerHeight * 1.2, autoAlpha: reduced ? 1 : 0 });
      gsap.set(b.card, { rotationY: 0 });
    });
    if (egg) gsap.set(egg, { autoAlpha: 0 });
  };

  const land = () => {
    if (reduced) { boards.forEach((b) => gsap.set(b.drop, { y: 0, autoAlpha: 1 })); onSettle(); return; }
    intro = gsap.timeline({ onComplete: onSettle });
    const vh = window.innerHeight;
    boards.forEach((b, i) => {
      const at = 0.15 + i * 0.23;
      b.busy = true;
      const h = b.drop.offsetHeight;
      // 950 ms: land at 60 %, bounce 6 % at 78 %, land at 90 %, 1.2 % at 95 %, land
      intro!.set(b.drop, { autoAlpha: 1 }, at)
        .fromTo(b.drop, { y: -vh * 1.2 }, { y: 0, duration: 0.57, ease: 'power2.in' }, at)
        .to(b.drop, { y: -h * 0.06, duration: 0.171, ease: 'power2.out' }, at + 0.57)
        .to(b.drop, { y: 0, duration: 0.114, ease: 'power2.in' }, at + 0.741)
        .to(b.drop, { y: -h * 0.012, duration: 0.0475, ease: 'power1.out' }, at + 0.855)
        .to(b.drop, { y: 0, duration: 0.0475, ease: 'power1.in' }, at + 0.9025)
        // flip to the base, hold, flip back
        .to(b.card, { rotationY: 180, duration: 0.68, ease: 'power2.inOut' }, at + 1.0)
        .to(b.card, { rotationY: 360, duration: 0.646, ease: 'power2.inOut', onComplete: () => { b.busy = false; gsap.set(b.card, { rotationY: 0 }); } }, at + 1.0 + 1.054);
    });
  };

  const spin = (i: number, big: boolean) => {
    const b = boards[i];
    if (!b || b.busy || !isActive()) return;
    b.busy = true;
    const d = big ? 1620 : 360;
    gsap.to(b.card, {
      rotationY: b.rot + d, duration: reduced ? 0.01 : big ? 2.3 : 0.95, ease: 'power3.out',
      onComplete: () => { b.rot += d; b.busy = false; onSettle(); },
    });
    if (big && egg) {
      // the note draws on as the spin settles (stepped mask, writing direction), holds, then fades
      gsap.timeline({ delay: reduced ? 0 : 1.5 })
        .set(egg, { autoAlpha: 1, clipPath: 'inset(0 100% 0 0)' })
        .to(egg, { clipPath: 'inset(0 0% 0 0)', duration: 0.6, ease: 'steps(6)' })
        .to(egg, { autoAlpha: 0, duration: 0.5 }, '+=2.5');
    }
  };

  boards.forEach((b, i) => {
    b.card.addEventListener('click', () => spin(i, i === 0));
    b.card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); spin(i, i === 0); }
    });
    if (i > 0) b.card.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') spin(i, false); });
  });

  reset();
  return { reset, land };
}
