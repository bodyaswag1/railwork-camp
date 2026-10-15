// Pure curve helpers shared by the clock (main thread) and the fold generator (also run in a worker).
import { config } from './config';

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
