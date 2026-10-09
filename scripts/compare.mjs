// Comparison pass: capture our transition at the GIF's aspect (480×270 → 960×540) at the same
// relative times as the reference frames, measure both the same way, and write design/compare.png.
//   node scripts/compare.mjs [baseUrl] [seed]
// The GIF only shows the unfold (ball → flat over 1470 ms), so GIF time t maps to p = 0.5 + 0.5·t/1470.
import { chromium } from '@playwright/test';
import sharp from 'sharp';
import fs from 'node:fs';

const [base = process.env.BASE_URL ?? 'http://localhost:4322', seed = '4242'] = process.argv.slice(2);
const REF = 'design/ref/crumple-frames';
const delays = JSON.parse(fs.readFileSync(`${REF}/delays.json`, 'utf8'));
const delayList = Array.isArray(delays) ? delays : delays.delays ?? Object.values(delays);
const times = []; let acc = 0;
for (const d of delayList) { times.push(acc); acc += Number(d.delay_ms ?? d); }
// one sample per GIF pose (it holds each pose for 4–5 frames) + the flat end
const picks = [0, 5, 10, 14, 18, 22];
const UNFOLD = 1470;

// ---------- measurement (same as crumple-measurements.json: mask = luma > 26, watermark box excluded) ----------
async function measure(buf, isGif) {
  const { data, info } = await sharp(buf).resize(480, 270, { fit: 'fill' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;
  let area = 0, minx = W, miny = H, maxx = 0, maxy = 0, lsum = 0;
  const pts = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (isGif && x > 335 && y > 232) continue;
    const i = (y * W + x) * 3;
    const l = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    if (l > 26) { area++; lsum += l; pts.push([x, y]); if (x < minx) minx = x; if (y < miny) miny = y; if (x > maxx) maxx = x; if (y > maxy) maxy = y; }
  }
  // convex hull (monotone chain) for solidity
  pts.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const p of pts) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
  const hull = lo.slice(0, -1).concat(up.slice(0, -1));
  let ha = 0; for (let i = 0; i < hull.length; i++) { const a = hull[i], b = hull[(i + 1) % hull.length]; ha += a[0] * b[1] - b[0] * a[1]; }
  ha = Math.abs(ha) / 2;
  return {
    areaFrac: +(area / (W * H)).toFixed(4),
    diam: +(Math.sqrt(4 * area / Math.PI) / H).toFixed(3),
    bbox: [+((maxx - minx + 1) / H).toFixed(2), +((maxy - miny + 1) / H).toFixed(2)],
    solidity: +(ha ? area / ha : 0).toFixed(2),
    meanLuma: Math.round(lsum / Math.max(1, area)),
  };
}

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 1 });
await page.goto(`${base}/?debug#cover`, { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__crumple, null, { timeout: 30000 });
await page.addStyleTag({ content: '.lil-gui{display:none!important} .stage__film,.stage__light,[data-gate]{display:none!important} .masthead{display:none!important}' });
await page.waitForTimeout(2500);

const rows = { gif: [], ours: [] };
const table = [];
for (const f of picks) {
  const t = Math.min(UNFOLD, times[f]);
  const p = 0.5 + 0.5 * (t / UNFOLD);
  await page.evaluate(([p, seed]) => window.__crumple.seek(p, { seed, to: 1, stage: false }), [p, +seed]);
  const ours = await page.screenshot();
  fs.mkdirSync('shots/compare', { recursive: true }); fs.writeFileSync(`shots/compare/ours-f${f}.png`, ours);
  const gif = fs.readFileSync(`${REF}/frame-${String(f).padStart(3, '0')}.png`);
  rows.gif.push(await sharp(gif).resize(320, 180, { fit: 'fill' }).png().toBuffer());
  rows.ours.push(await sharp(ours).resize(320, 180).png().toBuffer());
  const mg = await measure(gif, true), mo = await measure(ours, false);
  table.push({ frame: f, t_ms: t, p: +p.toFixed(3), gif: mg, ours: mo });
}
await browser.close();

// sheet: GIF row on top, ours below, labels in between
const n = picks.length, cw = 320, ch = 180, pad = 26;
const label = (txt, w) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${pad}"><text x="6" y="18" font-family="Arial" font-size="14" fill="#E1EFFA">${txt}</text></svg>`);
const comps = [];
rows.gif.forEach((b, i) => {
  comps.push({ input: b, left: i * cw, top: pad });
  comps.push({ input: rows.ours[i], left: i * cw, top: pad * 2 + ch });
  const m = table[i];
  comps.push({ input: label(`GIF f${m.frame} · ${m.t_ms}ms · Ø${m.gif.diam} sol ${m.gif.solidity}`, cw), left: i * cw, top: 0 });
  comps.push({ input: label(`ours p${m.p} · Ø${m.ours.diam} sol ${m.ours.solidity}`, cw), left: i * cw, top: pad + ch });
});
await sharp({ create: { width: n * cw, height: pad * 2 + ch * 2, channels: 3, background: '#101314' } }).composite(comps).png().toFile('design/compare.png');
fs.writeFileSync('design/compare.json', JSON.stringify(table, null, 1));
console.table(table.map((r) => ({ f: r.frame, p: r.p, gifØ: r.gif.diam, oursØ: r.ours.diam, gifBox: r.gif.bbox.join('×'), oursBox: r.ours.bbox.join('×'), gifSol: r.gif.solidity, oursSol: r.ours.solidity, gifL: r.gif.meanLuma, oursL: r.ours.meanLuma })));
