// Bakes the punk graphics for the application emails into public/mail/ (mail apps strip SVG and web fonts,
// so the poster bits ship as images): the rider's poster header, the strip on Ilia's email, the starburst
// step numbers, the graffiti sign-off and the footer. Re-run after changing a photo, a doodle or the dates.
//   node scripts/mail-art.mjs
import { build } from 'esbuild';
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const url = (p) => `file://${path.join(root, p)}`;
const bundle = await build({ entryPoints: ['src/content/doodles.ts'], bundle: true, format: 'esm', write: false });
const { doodles } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);

const doodle = (name, color, style) => {
  const d = doodles[name], w = { 3: 3, 2: 2, 1: 1.2 };
  return `<svg viewBox="${d.vb}" fill="none" stroke="${color}" stroke-linecap="round" stroke-linejoin="round" style="position:absolute;${style}">${(d.s ?? []).map(([k, p]) => `<path d="${p}" stroke-width="${w[k] * 1.6}" vector-effect="non-scaling-stroke"/>`).join('')}${(d.f ?? []).map((p) => `<path d="${p}" fill="${color}" stroke="none"/>`).join('')}</svg>`;
};
const starburst = fs.readFileSync('src/assets/figma/punk_starburst.svg', 'utf8').replace(/style="[^"]*"/, '').replace(/width="[^"]*" height="[^"]*"/, 'width="100%" height="100%"');

// the site's torn edges (src/styles/camp.css), same zigzag
const TORN = 'polygon(0 100%, 0 40%, 2% 70%, 4% 20%, 7% 60%, 9% 30%, 12% 80%, 15% 35%, 18% 65%, 21% 15%, 24% 55%, 27% 40%, 30% 75%, 33% 25%, 36% 60%, 39% 30%, 42% 85%, 45% 40%, 48% 60%, 51% 20%, 54% 70%, 57% 45%, 60% 80%, 63% 30%, 66% 55%, 69% 15%, 72% 65%, 75% 40%, 78% 75%, 81% 25%, 84% 60%, 87% 35%, 90% 70%, 93% 20%, 96% 55%, 98% 35%, 100% 60%, 100% 100%)';
const TORN_DOWN = 'polygon(0 0, 100% 0, 100% 45%, 97% 75%, 95% 35%, 92% 70%, 89% 30%, 86% 80%, 83% 40%, 80% 65%, 77% 20%, 74% 60%, 71% 35%, 68% 75%, 65% 25%, 62% 55%, 59% 30%, 56% 85%, 53% 40%, 50% 65%, 47% 20%, 44% 70%, 41% 45%, 38% 80%, 35% 30%, 32% 60%, 29% 15%, 26% 65%, 23% 40%, 20% 75%, 17% 25%, 14% 60%, 11% 35%, 8% 70%, 5% 20%, 2% 55%, 0 35%)';

const css = `
@font-face { font-family: 'Archivo'; src: url('${url('node_modules/@fontsource-variable/archivo/files/archivo-latin-wdth-normal.woff2')}') format('woff2'); font-weight: 100 900; font-stretch: 62% 125%; }
@font-face { font-family: 'Onest'; src: url('${url('node_modules/@fontsource-variable/onest/files/onest-latin-wght-normal.woff2')}') format('woff2'); font-weight: 100 900; }
@font-face { font-family: 'Most Wazted'; src: url('${url('public/fonts/MostWazted.woff2')}') format('woff2'); }
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { background: transparent; }
.art { position: relative; overflow: hidden; color: #E1EFFA; font-family: 'Onest', sans-serif; }
.dk { background: #101314; }
.grain::after { content: ''; position: absolute; inset: 0; opacity: .5; pointer-events: none; mix-blend-mode: screen;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='220' height='220'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 .55  0 0 0 0 .6  0 0 0 0 .65  0 0 0 .35 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E"); }
.cond { font-family: 'Archivo'; font-weight: 900; font-stretch: 62%; text-transform: uppercase; line-height: .86; }
.wide { font-family: 'Archivo'; font-weight: 800; font-stretch: 112%; text-transform: uppercase; letter-spacing: .14em; }
.pk { color: #FF94E3; } .rd { color: #BA1422; } .ice { color: #E1EFFA; }
.stamp { position: absolute; padding: 6px 12px 5px; border: 4px solid currentColor; outline: 1.5px solid currentColor; outline-offset: 3px; font-family: 'Archivo'; font-weight: 900; font-stretch: 112%; text-transform: uppercase; letter-spacing: .08em; white-space: nowrap; }
.torn { position: absolute; left: 0; right: 0; bottom: -1px; height: 16px; background: #E1EFFA; clip-path: ${TORN}; }
.barcode { position: absolute; display: flex; flex-direction: column; align-items: center; gap: 3px; color: #E1EFFA; opacity: .55; }
.barcode i { display: block; width: 84px; height: 24px; background: repeating-linear-gradient(90deg, currentColor 0 2px, transparent 2px 3px, currentColor 3px 4px, transparent 4px 7px, currentColor 7px 10px, transparent 10px 11px, currentColor 11px 12px, transparent 12px 15px); }
.barcode span { font-weight: 700; font-size: 8px; letter-spacing: .2em; }
`;

const arrow = (color, style) => `<svg viewBox="0 0 80 50" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="position:absolute;${style}"><path d="M6 44 C 20 14, 46 6, 70 12 M58 4 L 72 12 L 60 24"/></svg>`;
const logo = (w, style) => `<img src="${url('public/mail/logo.png')}" style="position:absolute;width:${w}px;${style}">`;

const pieces = {
  // the rider's poster: 560 wide in the mail
  'hero.jpg': { w: 560, h: 400, html: `<div class="art dk grain" style="width:560px;height:400px">
    ${logo(48, 'left:22px;top:16px')}
    <p class="wide pk" style="position:absolute;right:22px;top:26px;font-size:10px;text-align:right;line-height:1.6">Issue 01 · Winter 26/27<br><span class="ice">Snowboard + Ski</span></p>
    <div style="position:absolute;right:22px;top:84px;width:238px;rotate:3.5deg;background:#E1EFFA;padding:7px 7px 30px;box-shadow:4px 6px 0 rgba(0,0,0,.45)">
      <img src="${url('public/mail/crew.jpg')}" style="display:block;width:100%;filter:contrast(1.05) saturate(.9)">
      <p class="marker" style="position:absolute;left:16px;bottom:5px;font-family:'Most Wazted';font-size:18px;color:#101314">the crew</p>
      <span style="position:absolute;left:72px;top:-11px;width:96px;height:22px;background:rgba(225,239,250,.78);rotate:-5deg;box-shadow:0 1px 2px rgba(0,0,0,.2)"></span>
    </div>
    <div style="position:absolute;right:-4px;top:52px;width:84px;height:84px;rotate:-12deg">${starburst}
      <p class="cond ice" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;text-align:center;font-size:19px;line-height:.85;padding-top:2px">15<br>spots</p></div>
    <h1 class="cond" style="position:absolute;left:22px;top:100px;font-size:57px"><span class="ice">See you</span><br><span class="pk">on the<br>mountain.</span></h1>
    ${doodle('horns', '#FF94E3', 'left:192px;top:92px;width:40px;height:54px;rotate:-12deg')}
    ${arrow('#FF94E3', 'left:178px;top:158px;width:62px;height:38px;rotate:-6deg')}
    <p class="cond ice" style="position:absolute;left:22px;top:282px;font-size:38px">23—27 <span class="pk">Dec</span> 2026</p>
    <p class="wide" style="position:absolute;left:22px;top:322px;font-size:10px;color:#E1EFFA;opacity:.8">Livigno · Italian Alps</p>
    <span class="stamp pk" style="left:300px;top:318px;font-size:14px;rotate:-7deg;background:rgba(16,19,20,.6)">Application in ✓</span>
    <div class="torn"></div>
  </div>` },
  // Ilia's email: a short strip
  'strip.png': { w: 560, h: 104, html: `<div class="art dk grain" style="width:560px;height:104px">
    ${logo(46, 'left:22px;top:14px')}
    <p class="cond" style="position:absolute;left:84px;top:30px;font-size:40px"><span class="ice">BAS CAMP</span> <span class="pk">Italy</span></p>
    ${doodle('horns', '#FF94E3', 'left:338px;top:24px;width:32px;height:42px;rotate:-10deg')}
    <span class="stamp pk" style="right:24px;top:30px;font-size:13px;rotate:-6deg">New rider ✓</span>
    <div class="torn"></div>
  </div>` },
  // the end of the mail: torn ice edge into night, a barcode
  'footer.png': { w: 560, h: 92, html: `<div class="art dk grain" style="width:560px;height:92px">
    <div style="position:absolute;left:0;right:0;top:-1px;height:16px;background:#E1EFFA;clip-path:${TORN_DOWN}"></div>
    <p class="wide pk" style="position:absolute;left:22px;top:40px;font-size:10px;line-height:1.7">BAS CAMP · Issue 01<br><span class="ice">Ride. Learn. Repeat.</span></p>
    <span class="barcode" style="right:22px;top:38px"><i></i><span>BAS 2026 1223 27</span></span>
  </div>` },
  // sign-off: graffiti signature on the mail's ice paper
  'sign.png': { w: 200, h: 100, html: `<div class="art" style="width:200px;height:100px;background:#E1EFFA">
    <p style="position:absolute;left:8px;top:2px;font-family:'Most Wazted';font-size:74px;line-height:1;color:#BA1422;rotate:-6deg">Ilia</p>
    ${doodle('horns', '#101314', 'left:128px;top:16px;width:52px;height:68px;rotate:12deg')}
  </div>` },
};
for (const n of [1, 2, 3]) {
  pieces[`n${n}.png`] = { w: 52, h: 52, transparent: true, html: `<div class="art" style="width:52px;height:52px;rotate:${[-8, 6, -4][n - 1]}deg">${starburst}
    <p class="cond ice" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:30px;padding:3px 0 0 1px">${n}</p></div>` };
}

const browser = await chromium.launch({ executablePath: fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
for (const [file, p] of Object.entries(pieces)) {
  const page = await browser.newPage({ viewport: { width: p.w, height: p.h }, deviceScaleFactor: 2 });
  fs.writeFileSync('shots/.mail-art.html', `<!doctype html><meta charset="utf-8"><style>${css}</style>${p.html}`);
  await page.goto(url('shots/.mail-art.html'), { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  const out = path.join('public/mail', file);
  await page.screenshot({ path: out, omitBackground: !!p.transparent, ...(file.endsWith('.jpg') ? { type: 'jpeg', quality: 82 } : {}) });
  console.log(out, `${(fs.statSync(out).size / 1024).toFixed(0)} KB`);
  await page.close();
}
fs.rmSync('shots/.mail-art.html');
await browser.close();
