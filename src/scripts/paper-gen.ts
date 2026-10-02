// Generated paper ageing, ported from the design file's makeTextures() / makeAge().
// Pure drawing: runs in a worker (OffscreenCanvas) or on the main thread.

export const rng = (seed: number) => {
  let s = (seed >>> 0) % 2147483647 || 1;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
};

export type AnyCanvas = HTMLCanvasElement | OffscreenCanvas;
type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

/** Canvas factory: OffscreenCanvas in the worker, a DOM canvas on the main thread. */
let make = (w: number, h: number): AnyCanvas => {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas'); c.width = w; c.height = h; return c;
};
const canvas = (w: number, h: number) => {
  const c = make(w, h);
  return [c, c.getContext('2d') as Ctx] as const;
};
export const useDomCanvas = () => { make = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }; };

export function noise(rgb: [number, number, number], alpha: number, seed: number) {
  const r = rng(seed);
  const [c, x] = canvas(180, 180);
  const d = x.createImageData(180, 180);
  for (let i = 0; i < d.data.length; i += 4) {
    const v = r();
    d.data[i] = rgb[0]; d.data[i + 1] = rgb[1]; d.data[i + 2] = rgb[2];
    d.data[i + 3] = v > 0.5 ? Math.round((v - 0.5) * 2 * alpha) : 0;
  }
  x.putImageData(d, 0, 0);
  return c;
}

export function creaseFacets(seed: number) {
  const r = rng(seed);
  const W = 1200, H = 760;
  const [c, x] = canvas(W, H);
  x.fillStyle = '#808080'; x.fillRect(0, 0, W, H);
  const cols = 28, rows = 18;
  const pts: [number, number][][] = [];
  for (let i = 0; i <= rows; i++) {
    pts.push([]);
    for (let k = 0; k <= cols; k++) {
      const edge = i === 0 || i === rows || k === 0 || k === cols;
      pts[i].push([k * W / cols + (edge ? 0 : (r() - 0.5) * W / cols * 0.8), i * H / rows + (edge ? 0 : (r() - 0.5) * H / rows * 0.8)]);
    }
  }
  const tri = (a: number[], b: number[], d: number[]) => {
    const g = Math.round(128 + (r() - 0.5) * 120);
    x.fillStyle = `rgb(${g},${g},${g})`;
    x.beginPath(); x.moveTo(a[0], a[1]); x.lineTo(b[0], b[1]); x.lineTo(d[0], d[1]); x.closePath(); x.fill();
  };
  for (let i = 0; i < rows; i++) for (let k = 0; k < cols; k++) {
    const A = pts[i][k], B = pts[i][k + 1], C = pts[i + 1][k + 1], D = pts[i + 1][k];
    if (r() > 0.5) { tri(A, B, C); tri(A, C, D); } else { tri(A, B, D); tri(B, C, D); }
  }
  x.lineCap = 'round';
  for (let i = 0; i < 4; i++) for (let k = 0; k < 6; k++) {
    x.globalAlpha = 0.28;
    const A = pts[Math.round(i * rows / 4)][Math.round(k * cols / 6)], B = pts[Math.round(i * rows / 4)][Math.round((k + 1) * cols / 6)];
    const C = pts[Math.round((i + 1) * rows / 4)][Math.round((k + 1) * cols / 6)], D = pts[Math.round((i + 1) * rows / 4)][Math.round(k * cols / 6)];
    tri(A, B, C); tri(A, C, D);
    x.globalAlpha = 1;
  }
  for (let i = 0; i < 80; i++) {
    const x0 = r() * W, y0 = r() * H, ang = r() * Math.PI, len = 80 + r() * 600;
    const x1 = x0 + Math.cos(ang) * len, y1 = y0 + Math.sin(ang) * len;
    x.lineWidth = 2; x.strokeStyle = 'rgba(0,0,0,.35)'; x.beginPath(); x.moveTo(x0, y0); x.lineTo(x1, y1); x.stroke();
    x.strokeStyle = 'rgba(255,255,255,.4)'; x.beginPath(); x.moveTo(x0 + 2, y0 + 2); x.lineTo(x1 + 2, y1 + 2); x.stroke();
  }
  return c;
}

export function age(dark: boolean, seed: number) {
  const rnd = rng(seed);
  const W = 1600, H = 1000;
  const [c, x] = canvas(W, H);
  x.fillStyle = dark ? '#000' : '#fff'; x.fillRect(0, 0, W, H);
  const ink = (a: number) => dark ? `rgba(225,239,250,${a})` : `rgba(92,66,34,${a})`;
  const fold = (pos: number, vertical: boolean, w: number, k: number, ang = 0) => {
    x.save(); x.translate(W / 2, H / 2); x.rotate(ang); x.translate(-W / 2, -H / 2);
    const g = vertical ? x.createLinearGradient(pos - w, 0, pos + w, 0) : x.createLinearGradient(0, pos - w, 0, pos + w);
    g.addColorStop(0, ink(0)); g.addColorStop(0.46, ink(0.08 * k)); g.addColorStop(0.5, ink(0.3 * k)); g.addColorStop(0.54, ink(0.03 * k)); g.addColorStop(1, ink(0));
    x.fillStyle = g;
    if (vertical) x.fillRect(pos - w, -H * 0.3, 2 * w, H * 1.6); else x.fillRect(-W * 0.3, pos - w, W * 1.6, 2 * w);
    x.strokeStyle = ink(0.38 * k); x.lineWidth = 1.3; x.beginPath();
    let wob = 0;
    for (let i = 0; i <= 60; i++) {
      const t = i / 60 * 1.6 - 0.3; wob += (rnd() - 0.5) * 2.2; wob *= 0.9;
      const px = vertical ? pos + wob + (rnd() - 0.5) * 1.6 : t * W, py = vertical ? t * H : pos + wob + (rnd() - 0.5) * 1.6;
      if (i) x.lineTo(px, py); else x.moveTo(px, py);
    }
    x.stroke();
    for (let i = 0; i < 140; i++) {
      const t = rnd(), px = vertical ? pos + (rnd() - 0.5) * 10 : t * W, py = vertical ? t * H : pos + (rnd() - 0.5) * 10;
      x.fillStyle = ink((0.12 + rnd() * 0.3) * k); x.fillRect(px, py, 1 + rnd() * 3, 1 + rnd() * 2);
    }
    x.restore();
  };
  const K = dark ? 0.32 : 1, J = () => rnd() - 0.5;
  const fx1 = W * (0.5 + J() * 0.12), fy1 = H * (0.33 + J() * 0.1), fy2 = H * (0.67 + J() * 0.1);
  fold(fx1, true, 30, K, J() * 0.05); fold(fy1, false, 20, 0.85 * K, J() * 0.06); fold(fy2, false, 20, 0.85 * K, J() * 0.06);
  if (rnd() > 0.35) fold(W * (0.2 + rnd() * 0.15), true, 14, 0.45 * K, J() * 0.12);
  if (rnd() > 0.35) fold(W * (0.68 + rnd() * 0.15), true, 14, 0.45 * K, J() * 0.12);
  if (rnd() > 0.5) fold(H * (0.1 + rnd() * 0.8), false, 12, 0.35 * K, J() * 0.5);
  for (const [cx, cy] of [[fx1, fy1], [fx1, fy2]]) {
    const g = x.createRadialGradient(cx, cy, 0, cx, cy, 40); g.addColorStop(0, ink(0.28 * K)); g.addColorStop(1, ink(0));
    x.fillStyle = g; x.fillRect(cx - 40, cy - 40, 80, 80);
  }
  const e = 70;
  for (const [x0, y0, x1, y1, rx, ry, rw, rh] of [[0, 0, e, 0, 0, 0, e, H], [W, 0, W - e, 0, W - e, 0, e, H], [0, 0, 0, e, 0, 0, W, e], [0, H, 0, H - e, 0, H - e, W, e]]) {
    const g = x.createLinearGradient(x0, y0, x1, y1); g.addColorStop(0, ink(0.3)); g.addColorStop(1, ink(0)); x.fillStyle = g; x.fillRect(rx, ry, rw, rh);
  }
  for (let i = 0; i < 700; i++) {
    const side = Math.floor(rnd() * 4), t = rnd(), d = Math.pow(rnd(), 2.5) * 30;
    const px = side === 0 ? d : side === 1 ? W - d : t * W, py = side === 2 ? d : side === 3 ? H - d : t * H;
    x.fillStyle = ink(0.1 + rnd() * 0.3); x.fillRect(px, py, 1 + rnd() * 3, 1 + rnd() * 3);
  }
  const cx = rnd() > 0.5 ? W : 0, cy = rnd() > 0.5 ? H : 0, sz = 90 + rnd() * 70, sx = cx ? -1 : 1, sy = cy ? -1 : 1;
  x.fillStyle = ink(0.14); x.beginPath(); x.moveTo(cx, cy + sy * sz); x.lineTo(cx + sx * sz, cy); x.lineTo(cx, cy); x.closePath(); x.fill();
  x.strokeStyle = ink(0.4); x.lineWidth = 1.5; x.beginPath(); x.moveTo(cx, cy + sy * sz); x.lineTo(cx + sx * sz, cy); x.stroke();
  const rx = 200 + rnd() * (W - 400), ry = 150 + rnd() * (H - 300), rr = 70 + rnd() * 50;
  x.strokeStyle = ink(dark ? 0.1 : 0.16); x.lineWidth = 6; x.beginPath(); x.arc(rx, ry, rr, rnd() * 6, rnd() * 6 + 4.6); x.stroke();
  x.lineWidth = 2; x.beginPath(); x.arc(rx + 3, ry + 2, rr - 6, rnd() * 6, rnd() * 6 + 3.5); x.stroke();
  for (let i = 0; i < 60; i++) {
    const x0 = rnd() * W, y0 = rnd() * H, a = rnd() * Math.PI * 2, l = 20 + rnd() * 160;
    x.strokeStyle = ink(0.08 + rnd() * 0.2); x.lineWidth = 0.5 + rnd() * 0.9; x.beginPath(); x.moveTo(x0, y0);
    x.quadraticCurveTo(x0 + Math.cos(a) * l / 2 + (rnd() - 0.5) * 20, y0 + Math.sin(a) * l / 2 + (rnd() - 0.5) * 20, x0 + Math.cos(a) * l, y0 + Math.sin(a) * l); x.stroke();
  }
  for (let i = 0; i < 70; i++) {
    const px = rnd() * W, py = rnd() * H, r = 2 + rnd() * 9;
    const g = x.createRadialGradient(px, py, 0, px, py, r); g.addColorStop(0, ink(0.1 + rnd() * 0.2)); g.addColorStop(1, ink(0));
    x.fillStyle = g; x.fillRect(px - r, py - r, 2 * r, 2 * r);
  }
  for (let i = 0; i < 2; i++) {
    x.save(); x.translate(rnd() * W, rnd() < 0.5 ? 20 + rnd() * 60 : H - 20 - rnd() * 60); x.rotate((rnd() - 0.5) * 0.6);
    x.fillStyle = dark ? 'rgba(225,239,250,.07)' : 'rgba(196,160,80,.18)'; x.fillRect(-70, -16, 140, 32); x.restore();
  }
  return c;
}

