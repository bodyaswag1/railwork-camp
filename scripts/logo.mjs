// The BAS CAMP logo (assets-src/bas-camp-logo.webp: white lettering over a red rider, on black) lifted off its
// black background into transparent PNGs — the whole rider, nothing cropped — in the three colourways the
// pages need, plus square icons.
//   on-dark   white lettering, red rider      (dark pages, /camp)
//   on-light  ink lettering, red rider        (paper pages: white lettering would vanish)
//   on-red    white lettering, ink rider      (the red poster: a red rider would vanish)
//   node scripts/logo.mjs
import sharp from 'sharp';
import fs from 'node:fs';

const src = 'assets-src/bas-camp-logo.webp';
fs.mkdirSync('src/assets/brand', { recursive: true });
const { data, info } = await sharp(src).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const { width: W, height: H } = info;

// every pixel is a mix of black, the rider's red (141,26,19) and white: solve for the two coverages
const aW = new Float32Array(W * H), aR = new Float32Array(W * H);
let x0 = W, y0 = H, x1 = 0, y1 = 0;
for (let i = 0; i < W * H; i++) {
  const r = data[i * 3], g = data[i * 3 + 1];
  const red = Math.min(1, Math.max(0, (r - g) / 104)); // the paint's own grain varies around 115: a little gain keeps it solid
  const white = Math.min(1, Math.max(0, (g - 26 * red - 8) / 236));
  aW[i] = white; aR[i] = Math.min(1 - white, red);
  if (white + aR[i] > 0.5) { const x = i % W, y = (i / W) | 0; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
}
const pad = 16;
x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(W - 1, x1 + pad); y1 = Math.min(H - 1, y1 + pad);
const cw = x1 - x0 + 1, ch = y1 - y0 + 1;

const INK = [16, 19, 20], WHITE = [255, 255, 255], RED = [186, 20, 34];
const render = (letter, rider) => {
  const out = Buffer.alloc(cw * ch * 4);
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
    const i = (y + y0) * W + (x + x0), o = (y * cw + x) * 4;
    const w = aW[i], r = aR[i], a = Math.min(1, w + r);
    if (a <= 0.004) continue;
    for (let k = 0; k < 3; k++) out[o + k] = Math.round((w * letter[k] + r * rider[k]) / (w + r));
    out[o + 3] = Math.round(a * 255);
  }
  return sharp(out, { raw: { width: cw, height: ch, channels: 4 } });
};
for (const [name, letter, rider] of [['on-dark', WHITE, RED], ['on-light', INK, RED], ['on-red', WHITE, INK]]) {
  await render(letter, rider).resize({ width: 720 }).png({ compressionLevel: 9 }).toFile(`src/assets/brand/bas-camp-${name}.png`);
}
console.log(`logo ${cw}×${ch} → src/assets/brand/bas-camp-{on-dark,on-light,on-red}.png (720 wide)`);

// home-screen icon: the logo on Night Run, square
const icon = async (size, out) => {
  const mark = await render(WHITE, RED).resize({ height: Math.round(size * 0.9) }).png().toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background: { r: 16, g: 19, b: 20, alpha: 1 } } }).composite([{ input: mark, gravity: 'centre' }]).png({ compressionLevel: 9 }).toFile(out);
};
await icon(180, 'public/apple-touch-icon.png'); // iOS fills transparency with black anyway: keep the square

// tab icon: just the rider and the lettering, no background. The SVG swaps white lettering (dark browser chrome)
// for ink (light chrome); the PNG fallback keeps white lettering with a thin ink edge so it reads on either.
const tab = (letter, rider, size) => render(letter, rider).resize({ width: size, height: size, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png({ compressionLevel: 9 }).toBuffer();
const [dark, light] = await Promise.all([tab(WHITE, RED, 96), tab(INK, RED, 96)]);
const uri = (b) => `data:image/png;base64,${b.toString('base64')}`;
fs.writeFileSync('public/favicon.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><style>.d{display:none}@media (prefers-color-scheme:dark){.l{display:none}.d{display:inline}}</style><image class="l" width="96" height="96" href="${uri(light)}"/><image class="d" width="96" height="96" href="${uri(dark)}"/></svg>`);
{
  const S = 192, mark = await tab(WHITE, RED, S - 8);
  const { data: m } = await sharp(mark).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const n = S - 8, edge = Buffer.alloc(S * S * 4);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    let a = 0;
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
      if (dx * dx + dy * dy > 10) continue;
      const sx = x - 4 + dx, sy = y - 4 + dy;
      if (sx >= 0 && sy >= 0 && sx < n && sy < n) a = Math.max(a, m[(sy * n + sx) * 4 + 3]);
    }
    const o = (y * S + x) * 4; edge[o] = INK[0]; edge[o + 1] = INK[1]; edge[o + 2] = INK[2]; edge[o + 3] = a;
  }
  await sharp(edge, { raw: { width: S, height: S, channels: 4 } }).composite([{ input: mark, left: 4, top: 4 }]).png({ compressionLevel: 9 }).toFile('public/favicon.png');
}
console.log('icons → public/favicon.svg (theme-aware), public/favicon.png (transparent), public/apple-touch-icon.png');
