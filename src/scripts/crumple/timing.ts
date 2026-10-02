// Shared clock for every transition flavour: one GSAP timeline drives p 0 → 1 continuously, and what
// is drawn is sampled at FILM_FPS (old-film cadence) with 1–2 held frames that never sit near the ball.
import { gsap } from 'gsap';
import { config } from './config';
import { rng } from '../paper';

export const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
export const smooth = (a: number, b: number, x: number) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };

/**
 * Distance from the ball in "phase" units: u = 0 at the flat ends, 1 at the ball (p = 0.5).
 * The turn is rounded over ±peakRound so it peaks and goes straight back without a hold.
 */
export function phase(p: number) {
  const e = config.peakRound;
  const d = p - 0.5;
  const a = Math.sqrt(d * d + e * e) - e;
  const a0 = Math.sqrt(0.25 + e * e) - e;
  return { u: clamp01(1 - a / a0), crumpling: p < 0.5 };
}

/** 0 at both ends, 1 through the middle: scales film jitter so the hand-offs stay pixel exact. */
export const envelope = (p: number) => smooth(0, 0.07, p) * smooth(1, 0.93, p);

export type Film = {
  /** film frame index for elapsed seconds, or -1 when the frame should be held */
  frameAt(t: number): number;
  /** p of the film frame (its exposure time) */
  pOf(frame: number): number;
  total: number;
  rand: () => number;
};

export function filmClock(seed: number): Film {
  const fps = config.FILM_FPS, dur = config.duration;
  const total = Math.max(2, Math.round(fps * dur));
  const r = rng(seed ^ 0x5f3759df);
  const guard = Math.ceil(config.holdGuard * fps);
  const ball = Math.round(total / 2);
  const holds = new Set<number>();
  let tries = 0;
  while (holds.size < config.holds && tries++ < 50) {
    const f = 2 + Math.floor(r() * (total - 4));
    if (Math.abs(f - ball) > guard && !holds.has(f - 1) && !holds.has(f + 1)) holds.add(f);
  }
  return {
    total,
    rand: r,
    frameAt(t) {
      const f = Math.min(total, Math.floor(t * fps));
      return holds.has(f) ? -1 : f;
    },
    pOf: (f) => clamp01(f / total),
  };
}

/** Run one transition: calls draw(p, frame) on each new film frame, always ending on p = 1 exactly. */
export function runClock(seed: number, draw: (p: number, frame: number, film: Film) => void, onBall?: () => void) {
  const film = filmClock(seed);
  const proxy = { t: 0 };
  let last = -2, ballDone = false;
  return new Promise<void>((resolve) => {
    gsap.to(proxy, {
      t: config.duration, duration: config.duration, ease: 'none',
      onUpdate() {
        const f = film.frameAt(proxy.t);
        if (f < 0 || f === last) return;
        last = f;
        const p = film.pOf(f);
        if (!ballDone && p >= 0.5) { ballDone = true; onBall?.(); }
        draw(p, f, film);
      },
      onComplete() {
        if (!ballDone) onBall?.();
        if (last !== film.total) draw(1, film.total, film);
        resolve();
      },
    });
  });
}
