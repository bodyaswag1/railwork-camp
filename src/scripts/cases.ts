// Student progress: each case's vertical video plays inline on a tap (muted, looping) and stops when the
// reader moves on. Cases without a video yet show their placeholder and have no button. Before/after GIFs
// are fetched only once the page comes up (reduced motion keeps the still first frame).
export function initCases(page: HTMLElement, reduced: boolean) {
  const gifs = Array.from(page.querySelectorAll<HTMLImageElement>('img[data-gif]'));
  const wake = () => {
    if (reduced) return;
    gifs.forEach((g) => {
      if (g.getAttribute('src')) return;
      g.addEventListener('load', () => g.classList.add('is-loaded'), { once: true });
      g.src = g.dataset.gif!;
    });
  };

  const cases = Array.from(page.querySelectorAll<HTMLElement>('[data-case]'))
    .map((el) => ({ el, video: el.querySelector<HTMLVideoElement>('video'), btn: el.querySelector<HTMLButtonElement>('[data-case-play]') }))
    .filter((c): c is { el: HTMLElement; video: HTMLVideoElement; btn: HTMLButtonElement } => !!c.video && !!c.btn);

  const set = (c: (typeof cases)[number], on: boolean) => {
    c.el.classList.toggle('is-playing', on);
    c.btn.setAttribute('aria-pressed', String(on));
    c.btn.setAttribute('aria-label', (on ? c.btn.dataset.pause : c.btn.dataset.play) ?? '');
  };
  const pauseAll = (except?: (typeof cases)[number]) => cases.forEach((c) => {
    if (c === except) return;
    c.video.pause();
    set(c, false);
  });

  cases.forEach((c) => {
    c.btn.addEventListener('click', () => {
      if (c.video.paused) {
        pauseAll(c);
        if (c.video.preload === 'none') c.video.preload = 'auto';
        c.video.play().then(() => set(c, true)).catch(() => set(c, false));
      } else { c.video.pause(); set(c, false); }
    });
    c.video.addEventListener('ended', () => set(c, false));
  });

  return { pauseAll: () => pauseAll(), wake };
}
