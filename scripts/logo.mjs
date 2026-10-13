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

// icons: the logo on Night Run, square
const icon = async (size, out) => {
  const mark = await render(WHITE, RED).resize({ height: Math.round(size * 0.9) }).png().toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background: { r: 16, g: 19, b: 20, alpha: 1 } } }).composite([{ input: mark, gravity: 'centre' }]).png({ compressionLevel: 9 }).toFile(out);
};
await icon(192, 'public/favicon.png');
await icon(180, 'public/apple-touch-icon.png');
