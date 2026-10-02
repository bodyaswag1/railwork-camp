// Paper that folds instead of stretching.
//
// A crumple here is a tree of straight fold lines drawn on the flat sheet. No two fold lines cross,
// so every fold cuts a convex piece off its parent region, and each piece rotates rigidly about its
// own line. Applying the rotations deepest-first, each about its rest-space line, composes into a
// tear-free, stretch-free folding (each child line moves rigidly with its parent). On top of that
// rides a "crease web": a piecewise-linear height field Σ k·|distance to line| whose facets are flat
// and whose creases are straight. Only in the last third of the crumple is the folded stack scaled
// and pushed onto a lumpy ball.
//
// Everything that is per-frame (angles, crease amplitude, centre, scale, rotation) is computed here
// on the CPU and handed to the vertex shader as uniforms; `deform()` mirrors the shader so the CPU
// can measure centroid and size.
import { config } from './config';
import { rng } from '../paper';
import { clamp01, phase, smooth } from './timing';

export const MAX_FOLDS = 26;
export const MAX_LINES = 28;

export type Fold = {
  cx: number; cy: number; nx: number; ny: number; // point on the line + unit normal pointing to the folding piece
  parent: number; // index of the parent fold, -1 = root region
  theta: number; // signed full angle (radians)
  kind: 'big' | 'small' | 'tuck';
  win: [number, number]; // crumple window (τ from p = 0 to the ball)
  owin: [number, number]; // unfold window (τ from the ball to p = 1)
};
export type Line = { ux: number; uy: number; per: number; ph: number; k: number }; // one pleat family

export type FoldSet = {
  W: number; H: number; S: number; seed: number;
  folds: Fold[]; lines: Line[];
  lump: [number, number, number, number];
  ballCenter: [number, number, number];
  rq: number; // radius of the fully folded stack (before compression)
  zw: number;
};

const easeIn = (x: number, k = 1.7) => Math.pow(clamp01(x), k);
const easeOut = (x: number, k = 1.8) => 1 - Math.pow(1 - clamp01(x), k);

export function generate(W: number, H: number, seed: number): FoldSet {
  const r = rng(seed);
  const S = Math.min(W, H);
  const hw = W / 2, hh = H / 2;

  // sample grid for region bookkeeping
  const nx = 96, ny = Math.max(24, Math.round(96 * H / W));
  const pts: [number, number][] = [];
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) pts.push([((i + 0.5) / nx - 0.5) * W, ((j + 0.5) / ny - 0.5) * H]);
  const owner = new Int16Array(pts.length).fill(-1);
  const folds: Fold[] = [];
  const isDesc = (node: number, anc: number) => { // node in subtree(anc)? (anc = -1 → everything)
    if (anc < 0) return true;
    for (let n = node; n >= 0; n = folds[n].parent) if (n === anc) return true;
    return false;
  };

  const tryAdd = (kind: Fold['kind'], parent: number, minF: number, maxF: number, anchor?: [number, number]) => {
    const region = pts.map((_, k) => k).filter((k) => owner[k] === parent);
    if (region.length < 12) return false;
    const subtree = pts.map((_, k) => k).filter((k) => isDesc(owner[k], parent));
    for (let attempt = 0; attempt < 60; attempt++) {
      let [px, py] = anchor ?? pts[region[Math.floor(r() * region.length)]];
      if (anchor) { px += (r() - 0.5) * W * 0.12; py += (r() - 0.5) * H * 0.12; }
      const a = r() * Math.PI;
      let nX = Math.cos(a), nY = Math.sin(a);
      for (const flip of [1, -1]) {
        const mx = nX * flip, my = nY * flip;
        let ok = true, inChild = 0, regionChild = 0;
        for (const k of subtree) {
          const s = (pts[k][0] - px) * mx + (pts[k][1] - py) * my;
          if (s > 0) {
            if (owner[k] !== parent) { ok = false; break; } // would swallow an existing piece
            inChild++;
          }
        }
        if (!ok) continue;
        regionChild = inChild;
        const frac = regionChild / region.length;
        const fracSheet = regionChild / pts.length;
        if (kind === 'tuck' ? (fracSheet < minF || fracSheet > maxF) : (frac < minF || frac > maxF)) continue;
        if (region.length - regionChild < 8) continue;
        const idx = folds.length;
        for (const k of subtree) if ((pts[k][0] - px) * mx + (pts[k][1] - py) * my > 0) owner[k] = idx;
        const sign = r() < 0.5 ? 1 : -1;
        const deg = kind === 'big' ? config.bigAngle * (0.9 + r() * 0.1)
          : kind === 'small' ? config.smallAngle * (0.5 + r() * 0.5)
          : config.tuckAngle * (0.7 + r() * 0.3);
        folds.push({ cx: px, cy: py, nx: mx, ny: my, parent, theta: sign * deg * Math.PI / 180, kind, win: [0, 1], owin: [0, 1] });
        return true;
      }
      void nX; void nY;
    }
    return false;
  };

  // 3–6 big folds first: halve the sheet, then halve the halves (both layers, like folding a letter)
  const nBig = Math.max(3, Math.min(6, Math.round(config.bigFolds)));
  tryAdd('big', -1, 0.36, 0.5, [0, 0]);
  for (let i = 1, guard = 0; folds.length < nBig && guard < 40; guard++) {
    const parent = r() < 0.55 ? -1 : Math.floor(r() * folds.length);
    if (tryAdd('big', parent, 0.3, 0.5)) i++;
  }
  // smaller folds anywhere
  for (let i = 0, guard = 0; i < config.smallFolds && folds.length < MAX_FOLDS - config.edgeTucks && guard < 80; guard++) {
    const parent = r() < 0.4 ? -1 : Math.floor(r() * folds.length);
    if (tryAdd('small', parent, 0.1, 0.32)) i++;
  }
  // edge tucks: small pieces cut off at the outline → jagged silhouette in the first frames
  for (let i = 0, guard = 0; i < config.edgeTucks && folds.length < MAX_FOLDS && guard < 120; guard++) {
    const side = Math.floor(r() * 4), t = r() - 0.5;
    const anchor: [number, number] = side === 0 ? [t * W, hh * 0.92] : side === 1 ? [t * W, -hh * 0.92] : side === 2 ? [hw * 0.92, t * H] : [-hw * 0.92, t * H];
    // find who owns that edge point, fold within that piece
    let best = -1, bd = 1e9;
    pts.forEach((p, k) => { const d = (p[0] - anchor[0]) ** 2 + (p[1] - anchor[1]) ** 2; if (d < bd) { bd = d; best = k; } });
    if (tryAdd('tuck', owner[best], 0.004, 0.035, anchor)) i++;
  }

  // ---- timing ----
  // Each big fold roughly doubles/halves the visible area, so running them one after another
  // reproduces the GIF's area curve (7 → 13 → 20 → 27 → 47 → 100 % while opening).
  // Crumple: tucks right away (jagged outline), big folds in sequence, then smaller folds.
  const bigs = folds.map((f, i) => (f.kind === 'big' ? i : -1)).filter((i) => i >= 0);
  const nb = Math.max(1, bigs.length);
  bigs.forEach((fi, k) => {
    const s = 0.03 + k * (0.5 / nb) + (r() - 0.5) * 0.03;
    folds[fi].win = [Math.max(0, s), Math.min(0.97, s + 0.3 + r() * 0.06)];
  });
  folds.forEach((f) => {
    if (f.kind === 'small') { const s = 0.3 + r() * 0.3; f.win = [s, Math.min(0.98, s + 0.3 + r() * 0.12)]; }
    if (f.kind === 'tuck') { const s = r() * 0.04; f.win = [s, s + 0.18 + r() * 0.14]; }
  });
  // Unfold: the ball lets go first, then the big folds open one by one in a shuffled order (not the
  // crumple reversed), the last one being the big final flatten; small folds and tucks open along the way.
  const depth = (i: number) => { let d = 0; for (let n = folds[i].parent; n >= 0; n = folds[n].parent) d++; return d; };
  const order = [...bigs].sort((a, b) => depth(b) - depth(a) || r() - 0.5);
  // the first fold (half the sheet) always opens last: the big final flatten
  order.splice(order.indexOf(bigs[0]), 1); order.push(bigs[0]);
  if (order.length > 2 && order.every((v, i) => v === bigs[bigs.length - 1 - i])) [order[0], order[1]] = [order[1], order[0]];
  // targets from the GIF: fold k finishes near the k-th pose change (0.22, 0.46, 0.63, 0.82, 1.0)
  const poses = [0.46, 0.64, 0.78, 0.88, 0.98];
  order.forEach((fi, k) => {
    const end = poses[Math.min(poses.length - 1, Math.round(k * (poses.length - 1) / Math.max(1, order.length - 1)))];
    const len = k === order.length - 1 ? 0.34 : 0.2 + r() * 0.06;
    folds[fi].owin = [Math.max(0.04, end - len), end];
  });
  folds.forEach((f) => {
    if (f.kind === 'small') { const s = 0.2 + r() * 0.45; f.owin = [s, Math.min(0.97, s + 0.22 + r() * 0.1)]; }
    if (f.kind === 'tuck') { const s = 0.45 + r() * 0.25; f.owin = [s, Math.min(0.97, s + 0.2 + r() * 0.06)]; }
  });

  // ---- crease web: families of soft zig-zag pleats in random directions (bounded height, straight creases) ----
  const lines: Line[] = [];
  const nL = Math.min(MAX_LINES, Math.round(config.creaseLines));
  for (let i = 0; i < nL; i++) {
    const a = r() * Math.PI;
    const k = (0.55 + r() * 0.9) * config.creaseStrength * 2.2 / Math.sqrt(nL);
    lines.push({ ux: Math.cos(a), uy: Math.sin(a), per: S * (0.09 + r() * 0.22), ph: r(), k });
  }

  const set: FoldSet = {
    W, H, S, seed, folds, lines,
    lump: [r() * 6.28, r() * 6.28, r() * 6.28, r() * 6.28],
    ballCenter: [0, 0, 0], rq: S * 0.3, zw: S * 0.012,
  };
  // measure the fully folded stack once: its centre and radius define the ball for both halves
  const full = { angles: folds.map((f) => f.theta), crease: 1 };
  const m = measure(set, full, true);
  set.ballCenter = m.center; set.rq = Math.max(m.radius, S * config.ballSize * 0.5);
  return set;
}

// ---------------------------------------------------------------- per-frame state

export type Frame = {
  angles: number[]; crease: number; comp: number; ball: number; shade: number;
  center: [number, number, number];
  /** current ball radius and current radius of the folded sheet, px */
  ballR: number; stackR: number;
};

// Size of the loosening ball while it opens, from the GIF: equivalent diameter relative to the flat
// sheet at x = 0 (ball) … 1 (flat): 0.26, 0.365, 0.445, 0.52, 0.68, 1.
const GIF_X = [0, 0.22, 0.46, 0.63, 0.82, 1];
const GIF_R = [0.26, 0.365, 0.445, 0.52, 0.68, 1];
function gifSize(x: number, rel0: number) {
  let i = 0;
  while (i < GIF_X.length - 2 && x > GIF_X[i + 1]) i++;
  const t = clamp01((x - GIF_X[i]) / (GIF_X[i + 1] - GIF_X[i]));
  const g = GIF_R[i] + (GIF_R[i + 1] - GIF_R[i]) * t;
  // re-based onto our ball size (our sheet is the whole viewport, the GIF's isn't)
  return rel0 + (g - GIF_R[0]) / (1 - GIF_R[0]) * (1 - rel0);
}

export function frameAt(set: FoldSet, p: number): Frame {
  const { u, crumpling } = phase(p);
  const x = 1 - u; // 0 at the ball → 1 flat, on either side
  const angles = set.folds.map((f) => {
    if (crumpling) return f.theta * easeIn((u - f.win[0]) / (f.win[1] - f.win[0]));
    const k = clamp01((x - f.owin[0]) / (f.owin[1] - f.owin[0]));
    // opens with a push, settles softly (slows as it lands)
    return f.theta * (1 - (f.owin[1] >= 0.97 ? easeOut(k, 2.6) : k * k * (3 - 2 * k)));
  });
  let crease: number, comp: number;
  if (crumpling) {
    crease = easeIn((u - 0.08) / 0.92, 1.2);
    // uniform scaling only in the last third of the crumple
    comp = easeIn((u - config.compressStart) / (1 - config.compressStart), 1.6);
  } else {
    // the paper stays wrinkled until the final flatten, like the GIF
    crease = 1 - easeOut((x - 0.42) / 0.5, 1.6);
    comp = Math.pow(1 - clamp01(x / config.releaseEnd), 1.6); // first third of the unfold only
  }
  const flat = p <= 0 || p >= 1;
  if (flat) { for (let i = 0; i < angles.length; i++) angles[i] = 0; crease = 0; comp = 0; }
  const shade = clamp01(Math.max(crease, ...angles.map((a, i) => Math.abs(a / set.folds[i].theta))) * 1.6);
  const m = flat ? { center: [0, 0, 0] as [number, number, number], radius: 1e9 } : measure(set, { angles, crease }, false, true);
  // the ball loosens along the GIF's size curve (crumple: the same curve, the other way);
  // it lets go of the paper once the folded sheet itself is about as small as the ball
  const rFlat = Math.sqrt(set.W * set.H / Math.PI);
  const rBall = config.ballSize * set.S * 0.5;
  const ballR = rFlat * gifSize(Math.pow(x, crumpling ? 0.8 : 1), rBall / rFlat);
  const stackR = m.radius;
  let ball = clamp01((stackR - ballR) / (0.45 * stackR));
  ball = ball * ball * (3 - 2 * ball);
  ball *= 1 - smooth(0.45, 0.75, x); // only around the middle of the move
  ball = Math.max(ball, 1 - x / 0.12); // fully a ball right around p = 0.5
  if (flat) ball = 0;
  return { angles, crease, comp, ball, shade, center: m.center, ballR, stackR: Math.max(stackR, ballR * 0.5) };
}

// ---------------------------------------------------------------- CPU mirror of the vertex shader


function heightAt(set: FoldSet, x: number, y: number, amp: number) {
  if (amp === 0) return 0;
  let h = 0;
  const cell = Math.max(set.W, set.H) / config.segments;
  for (const l of set.lines) {
    const f = (((x * l.ux + y * l.uy) / l.per + l.ph) % 1 + 1) % 1 - 0.5;
    const e = cell / l.per;
    h += l.k * l.per * (Math.sqrt(f * f + e * e) - 0.25);
  }
  return h * amp;
}

// scratch buffers: measure() runs every film frame, so nothing here allocates
const M = new Float32Array(MAX_FOLDS);
const P3 = new Float64Array(3);
const XS = new Float64Array(2000), YS = new Float64Array(2000), DS = new Float64Array(2000);

/** rotate P3 in place about the axis through (ax, ay, az) with unit direction (dx, dy, 0) by angle t */
function rotAbout(ax: number, ay: number, az: number, dx: number, dy: number, t: number) {
  const vx = P3[0] - ax, vy = P3[1] - ay, vz = P3[2] - az;
  const c = Math.cos(t), s = Math.sin(t);
  const dot = vx * dx + vy * dy;
  const cx = dy * vz, cy = -dx * vz, cz = dx * vy - dy * vx;
  P3[0] = ax + vx * c + cx * s + dx * dot * (1 - c);
  P3[1] = ay + vy * c + cy * s + dy * dot * (1 - c);
  P3[2] = az + vz * c + cz * s;
}

/** CPU mirror of the vertex shader's folding; result in P3 */
export function deform(set: FoldSet, f: { angles: number[]; crease: number }, x: number, y: number) {
  const soft = config.foldSoftness * set.S;
  const n = set.folds.length;
  for (let i = 0; i < n; i++) {
    const F = set.folds[i];
    const s = (x - F.cx) * F.nx + (y - F.cy) * F.ny;
    let side = 1;
    if (s <= -soft) side = 0; else if (s < soft) { const t = (s + soft) / (2 * soft); side = t * t * (3 - 2 * t); }
    M[i] = (F.parent < 0 ? 1 : M[F.parent]) * side;
  }
  P3[0] = x; P3[1] = y; P3[2] = heightAt(set, x, y, f.crease);
  for (let i = n - 1; i >= 0; i--) {
    if (M[i] <= 0 || f.angles[i] === 0) continue;
    const F = set.folds[i];
    const s = (x - F.cx) * F.nx + (y - F.cy) * F.ny;
    const ax = x - s * F.nx, ay = y - s * F.ny;
    rotAbout(ax, ay, heightAt(set, ax, ay, f.crease), -F.ny, F.nx, f.angles[i] * M[i]);
  }
  return P3;
}

/** centroid and radius of the folded sheet (before ball compression) */
export function measure(set: FoldSet, f: { angles: number[]; crease: number }, full: boolean, withRadius = full) {
  const nx = full ? 40 : 22, ny = Math.max(8, Math.round(nx * set.H / set.W));
  let cx = 0, cy = 0, cz = 0, N = 0;
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const p = deform(set, f, ((i + 0.5) / nx - 0.5) * set.W, ((j + 0.5) / ny - 0.5) * set.H);
    XS[N] = p[0]; YS[N] = p[1]; N++;
    cx += p[0]; cy += p[1]; cz += p[2];
  }
  cx /= N; cy /= N; cz /= N;
  let radius = 0;
  if (withRadius) {
    for (let k = 0; k < N; k++) DS[k] = Math.hypot(XS[k] - cx, YS[k] - cy);
    const ds = DS.subarray(0, N).sort();
    radius = ds[Math.floor(N * (full ? 0.97 : 0.95))];
  }
  return { center: [cx, cy, cz] as [number, number, number], radius };
}
