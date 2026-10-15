// Transition flavours that need no WebGL:
//  - fadeTransition: prefers-reduced-motion → 200 ms crossfade, marks shown static
//  - cssTransition: no WebGL / failed snapshot → scale + rotate + feTurbulence/feDisplacementMap +
//    crumpled-paper texture, on the black stage with the stage graphics underneath
import { gsap } from 'gsap';
import { config } from './crumple/config';
import { phase, envelope, runClock } from './crumple/timing';
import { prepareStage, renderStage, showStage, filmGate } from './stagefx';

export type Hooks = { showIn(): void; hideOut(): void; atBall(): void };
export type Transition = { run(from: number, to: number, dir: 1 | -1, hooks: Hooks): Promise<void> };

const secs = () => Array.from(document.querySelectorAll<HTMLElement>('[data-page]'));

export const fadeTransition: Transition = {
  async run(from, to, _dir, hooks) {
    const out = secs()[from], inn = secs()[to];
    inn.classList.add('is-moving');
    inn.style.zIndex = '3';
    inn.style.visibility = 'visible';
    hooks.atBall();
    await gsap.fromTo(inn, { opacity: 0 }, { opacity: 1, duration: config.reducedFade, ease: 'none' }).then();
    hooks.hideOut(); hooks.showIn();
    inn.style.zIndex = ''; inn.style.visibility = ''; inn.style.opacity = '';
    inn.classList.remove('is-moving');
    void out;
  },
};

let filterReady = false;
function ensureFilter() {
  if (filterReady) return;
  filterReady = true;
  document.body.insertAdjacentHTML('beforeend', `<svg aria-hidden="true" width="0" height="0" style="position:absolute">
    <filter id="css-crumple" x="-10%" y="-10%" width="120%" height="120%" color-interpolation-filters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency=".011 .017" numOctaves="3" seed="3" result="n"/>
      <feDisplacementMap in="SourceGraphic" in2="n" scale="0" xChannelSelector="R" yChannelSelector="G"/>
    </filter></svg>`);
}

/** crumpled paper texture: hard facets, generated once */
let crumpleTex = '';
function texture() {
  if (crumpleTex) return crumpleTex;
  const c = document.createElement('canvas'); c.width = 600; c.height = 600;
  const x = c.getContext('2d')!;
  x.fillStyle = '#808080'; x.fillRect(0, 0, 600, 600);
  for (let i = 0; i < 260; i++) {
    const cx = Math.random() * 600, cy = Math.random() * 600, r = 30 + Math.random() * 90;
    const g = Math.round(128 + (Math.random() - 0.5) * 150);
    x.fillStyle = `rgb(${g},${g},${g})`; x.beginPath();
    for (let k = 0; k < 3; k++) { const a = Math.random() * 6.283; x.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); }
    x.fill();
  }
  crumpleTex = c.toDataURL('image/jpeg', 0.8);
  return crumpleTex;
}

export const cssTransition: Transition = {
  async run(from, to, dir, hooks) {
    ensureFilter();
    const all = secs(), out = all[from], inn = all[to];
    const disp = document.querySelector('#css-crumple feDisplacementMap')!;
    const skin = document.createElement('div');
    skin.className = 'css-crumple';
    skin.style.cssText = `position:absolute;inset:0;pointer-events:none;z-index:9;mix-blend-mode:hard-light;background:url(${texture()}) center/60% repeat;opacity:0`;
    const seed = (Math.random() * 1e9) | 0;
    const m = Math.min(innerWidth, innerHeight);
    const twist = dir * (18 + Math.random() * 14);
    prepareStage(to, seed);
    let swapped = false;
    const style = (el: HTMLElement, k: number, sgn: number) => {
      el.style.transform = `scale(${(1 - 0.72 * Math.pow(k, 1.2)).toFixed(4)}) rotate(${(sgn * twist * k).toFixed(2)}deg)`;
      el.style.filter = k > 0.01 ? 'url(#css-crumple)' : '';
      el.style.clipPath = k > 0.01 ? `inset(${(k * 6).toFixed(1)}% round ${(k * 40).toFixed(0)}%)` : '';
      disp.setAttribute('scale', (m * 0.18 * k).toFixed(1));
      skin.style.opacity = (0.95 * k).toFixed(3);
    };
    out.classList.add('is-moving'); inn.classList.add('is-moving');
    out.style.zIndex = '12'; out.style.visibility = 'visible';
    out.append(skin);
    showStage(true);
    hooks.hideOut();
    try {
      await runClock(seed, (p, _f, film) => {
        const { u, crumpling } = phase(p);
        if (!crumpling && !swapped) {
          swapped = true;
          style(out, 0, 1); out.style.zIndex = ''; out.style.visibility = '';
          inn.style.zIndex = '12'; inn.style.visibility = 'visible'; inn.append(skin);
        }
        style(crumpling ? out : inn, u, crumpling ? 1 : -1);
        renderStage(p, filmGate(envelope(p), film.rand), film.rand);
      }, hooks.atBall);
    } finally {
      [out, inn].forEach((el) => { el.style.transform = ''; el.style.filter = ''; el.style.clipPath = ''; el.style.zIndex = ''; el.style.visibility = ''; el.classList.remove('is-moving'); });
      skin.remove();
      hooks.showIn();
      showStage(false);
    }
  },
};
