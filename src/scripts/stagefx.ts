// The black stage under the paper: film scratches and dust, then the red/pink marks, splatter and note.
// Driven by p (0 → 1) and only ever updated on film frames, so it steps like the paper does.
import { gsap } from 'gsap';
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin';
import { pages } from '../content/site';
import { config } from './crumple/config';
import { rng } from './paper';

gsap.registerPlugin(DrawSVGPlugin);

const stage = document.querySelector<HTMLElement>('[data-stage]')!;
const film = stage.querySelector<HTMLElement>('[data-film]')!;
const gate = stage.querySelector<HTMLElement>('[data-gate]')!;
const note = stage.querySelector<HTMLElement>('[data-note]')!;
const splat = stage.querySelector<SVGElement>('[data-splat]')!;
const groups = Array.from(stage.querySelectorAll<SVGGElement>('g[data-set]'));
const figs = Array.from(stage.querySelectorAll<SVGSVGElement>('svg[data-fig]'));
const scratches = Array.from(film.querySelectorAll<HTMLElement>('i'));
const dust = Array.from(film.querySelectorAll<HTMLElement>('b'));

let tl: gsap.core.Timeline | null = null;
let lastSet = -1, lastSeed = NaN;
let rnd = Math.random;

export function prepareStage(to: number, seed: number) {
  rnd = rng(seed);
  tl?.kill();
  // a different composition from last time
  let set = Math.floor(rnd() * groups.length);
  if (seed === lastSeed) set = lastSet; // same transition re-prepared (debug seek)
  else if (set === lastSet) set = (set + 1) % groups.length;
  lastSet = set; lastSeed = seed;

  const strokes: SVGPathElement[] = [];
  groups.forEach((g, i) => {
    const on = i === set;
    g.style.display = on ? '' : 'none';
    if (on) {
      const ps = Array.from(g.querySelectorAll<SVGPathElement>('[data-tp]'));
      // vary which elements appear (seeded), never fewer than 2
      ps.forEach((p) => { const keep = rnd() < config.stageDensity; p.style.display = keep ? '' : 'none'; if (keep) strokes.push(p); });
      if (strokes.length < 2) ps.slice(0, 2).forEach((p) => { p.style.display = ''; if (!strokes.includes(p)) strokes.push(p); });
    }
  });
  const figMasks: SVGPathElement[] = [];
  figs.forEach((f) => {
    const on = Number(f.dataset.set) === set && rnd() < Math.max(0.6, config.stageDensity);
    f.style.display = on ? '' : 'none';
    if (on) figMasks.push(f.querySelector<SVGPathElement>('[data-tpm]')!);
  });

  // note: the destination page's word, in the upper band, clear of the ball
  note.textContent = pages[to].stageNote;
  note.style.left = `${44 + rnd() * 14}%`;
  note.style.top = `${10 + rnd() * 10}%`;
  // splatter: lower third, left or right, never centre
  splat.style.left = rnd() < 0.5 ? `${4 + rnd() * 16}%` : `calc(${62 + rnd() * 16}% - 120px)`;
  splat.style.top = `${66 + rnd() * 12}%`;
  splat.style.transform = `rotate(${(rnd() - 0.5) * 40}deg)`;

  const a = config.stageStart, b = config.stageEnd, span = b - a;
  tl = gsap.timeline({ paused: true });
  tl.set({}, {}, 1); // timeline length = 1 → progress == p
  const all = [...strokes, ...figMasks];
  gsap.set(all, { drawSVG: '0%' });
  all.forEach((p, i) => {
    const at = a + (i / Math.max(1, all.length)) * span * 0.55;
    tl!.to(p, { drawSVG: '100%', duration: span * (0.32 + rnd() * 0.12), ease: 'power1.inOut' }, at);
  });
  // splatter pops in over ~2–3 film frames
  const frames = 1 / (config.FILM_FPS * config.duration);
  gsap.set(splat, { opacity: 0, scale: 0.3, transformOrigin: '50% 50%' });
  tl.to(splat, { opacity: 1, scale: 1, duration: frames * 2.5, ease: 'steps(3)' }, a + span * (0.35 + rnd() * 0.3));
  // handwriting through a stepped mask in writing direction
  gsap.set(note, { opacity: 1, clipPath: 'inset(0 100% 0 0)' });
  tl.to(note, { clipPath: 'inset(0 0% 0 0)', duration: span * 0.45, ease: 'steps(8)' }, a + span * 0.4);
  tl.progress(0);
}

export type Gate = { x: number; y: number; exposure: number };

/** Gate weave + exposure flicker for one film frame; the same values go to the paper so the whole frame moves. */
export function filmGate(env: number, r: () => number): Gate {
  const w = config.weavePx * env;
  return { x: (r() - 0.5) * 2 * w, y: (r() - 0.5) * 2 * w, exposure: 1 + (r() - 0.5) * 2 * config.flicker * env };
}

/** Update the stage for the film frame at progress p. */
export function renderStage(p: number, g: Gate, r: () => number) {
  tl?.progress(Math.min(1, Math.max(0, p)));
  // film layer re-randomises each film frame
  scratches.forEach((s) => { s.style.left = `${(r() * 100).toFixed(1)}%`; });
  dust.forEach((d) => { d.style.left = `${(r() * 100).toFixed(1)}%`; d.style.top = `${(r() * 100).toFixed(1)}%`; });
  film.style.opacity = (0.3 + r() * 0.3).toFixed(2);
  stage.style.transform = `translate(${g.x.toFixed(2)}px, ${g.y.toFixed(2)}px)`;
  gate.style.opacity = Math.min(1, g.exposure).toFixed(3);
}

export function showStage(on: boolean) {
  stage.classList.toggle('is-on', on);
  if (!on) { stage.style.transform = ''; gate.style.opacity = ''; }
}

export const stageEl = stage;
