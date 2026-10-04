// Student progress: each case's vertical video plays inline on a tap (muted, looping) and stops when the
// reader moves on. Cases without a video yet show their placeholder and have no button.
export function initCases(page: HTMLElement) {
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

  return { pauseAll: () => pauseAll() };
}
