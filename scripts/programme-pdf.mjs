// Builds public/BAS-CAMP-training-programme.pdf (the download behind "Download training programme" on /camp):
// four A4 sheets in the site's own type, colours and marker layer, printed with Playwright's Chromium.
//   node scripts/programme-pdf.mjs            → the PDF
//   node scripts/programme-pdf.mjs --shots    → also shots/programme/page-N.png to look at
import { chromium } from '@playwright/test';
import sharp from 'sharp';
import fs from 'node:fs';

const b64 = (file, mime) => `data:${mime};base64,${fs.readFileSync(file).toString('base64')}`;
const jpg = async (file, width, opts = {}) => `data:image/jpeg;base64,${(await sharp(file).resize({ width, ...opts }).jpeg({ quality: 82, mozjpeg: true }).toBuffer()).toString('base64')}`;
const font = (file) => b64(file, 'font/woff2');

const png = async (file, width) => `data:image/png;base64,${(await sharp(file).resize({ width }).png({ compressionLevel: 9 }).toBuffer()).toString('base64')}`;
const logo = await png('src/assets/brand/bas-camp-on-dark.png', 520);
const wordmark = await png('src/assets/brand/bas-camp-on-light.png', 200);
const photoCoach = await jpg('src/assets/photos/camp-coaching.jpg', 900);
// the cover photo is toned here, not with a CSS filter: a filtered image is embedded uncompressed
const photoRail = `data:image/jpeg;base64,${(await sharp('src/assets/photos/ilia-rail.jpg').resize({ width: 1100 }).grayscale().linear(1.2, -38).jpeg({ quality: 80, mozjpeg: true }).toBuffer()).toString('base64')}`;
const photoCrew = await jpg('src/assets/photos/life-crew.jpg', 900);

// hand-drawn marks, the same paths the site uses
const circleD = 'M52 6 C 90 4, 99 32, 97 56 C 95 90, 22 98, 7 70 C -3 42, 20 8, 60 10';
const dblD = 'M1 10 C 25 3, 55 15, 99 5 M6 14 C 40 9, 70 13, 94 10';
const burstD = 'M50 4 L 57 32 L 84 14 L 68 41 L 97 48 L 69 58 L 87 86 L 57 70 L 50 97 L 43 70 L 13 86 L 31 58 L 3 48 L 32 41 L 16 14 L 43 32 Z';
const xD = 'M4 6 L 24 30 M24 4 L 6 32 M34 10 L 54 34 M52 8 L 36 36';
const arrowR = 'M2 22 C 24 8, 52 30, 76 14 M64 6 L 77 14 L 66 24';
const downD = 'M20 2 C 8 20, 32 36, 18 62 M7 50 L 18 64 L 30 51';
const dot = ([x, y, r]) => `M${x - r} ${y}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;
const splat = (a, b, style) => `<svg class="splat" style="${style}" viewBox="0 0 240 170"><path fill="${a}" d="${[[58, 70, 15], [92, 44, 5], [30, 112, 4], [74, 128, 6], [176, 96, 2.5]].map(dot).join('')}"/><path fill="${b}" d="${[[104, 84, 8.5], [146, 58, 3], [126, 114, 1.8]].map(dot).join('')}"/></svg>`;
const mark = (d, style, stroke = '#BA1422', w = 3, vb = '0 0 100 100') => `<svg class="mk" style="${style}" viewBox="${vb}" preserveAspectRatio="none" fill="none" stroke="${stroke}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"><path vector-effect="non-scaling-stroke" d="${d}"/></svg>`;

const foot = (n) => `<footer class="foot"><span>bascamp.world</span><span>BAS CAMP · Training programme</span><span class="foot__n">0${n} / 04</span></footer>`;
const step = (n, title, sub, paras) => `
  <section class="step">
    <div class="step__n">${n}</div>
    <div class="step__b">
      <p class="step__k">${sub}</p>
      <h2>${title}</h2>
      ${paras.map((p) => `<p>${p}</p>`).join('')}
    </div>
  </section>`;

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>BAS CAMP — Training programme</title>
<style>
@font-face { font-family: 'Archivo'; src: url(${font('node_modules/@fontsource-variable/archivo/files/archivo-latin-wdth-normal.woff2')}) format('woff2'); font-weight: 100 900; font-stretch: 62% 125%; }
@font-face { font-family: 'Onest'; src: url(${font('node_modules/@fontsource-variable/onest/files/onest-latin-wght-normal.woff2')}) format('woff2'); font-weight: 100 900; }
@font-face { font-family: 'Most Wazted'; src: url(${font('public/fonts/MostWazted.woff2')}) format('woff2'); }
@page { size: A4; margin: 0; }
:root { --night: #101314; --tower: #474C48; --slush: #ABAAA6; --ice: #E1EFFA; --red: #BA1422; --pink: #FF94E3; --paper: #DEE4E1; }
* { box-sizing: border-box; }
html, body { margin: 0; }
body { font-family: 'Onest', system-ui, sans-serif; color: var(--night); -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.sheet { position: relative; width: 210mm; height: 297mm; overflow: hidden; page-break-after: always; break-after: page; padding: 16mm 16mm 20mm; background: var(--paper); }
.sheet:last-child { page-break-after: auto; break-after: auto; }
.sheet--dark { background: var(--night); color: var(--ice); }
.sheet > * { position: relative; }
h1, h2, h3, p { margin: 0; }
.disp { font-family: 'Archivo', sans-serif; font-weight: 900; font-stretch: 62%; text-transform: uppercase; line-height: .84; }
.wide { font-family: 'Archivo', sans-serif; font-weight: 900; font-stretch: 112%; text-transform: uppercase; letter-spacing: .1em; }
.marker { font-family: 'Most Wazted', cursive; font-weight: 400; line-height: 1; white-space: nowrap; }
.mk, .splat, .abs { position: absolute; overflow: visible; }
.stamp { position: absolute; display: inline-block; padding: 1.6mm 3.4mm 1.3mm; border: .9mm solid currentColor; outline: .3mm solid currentColor; outline-offset: .6mm; font-family: 'Archivo', sans-serif; font-weight: 900; font-stretch: 112%; font-size: 9pt; letter-spacing: .08em; text-transform: uppercase; white-space: nowrap; }
.tape { position: absolute; height: 5.4mm; background: rgba(214,194,146,.72); box-shadow: 0 .3mm .6mm rgba(16,19,20,.14); }
.crop { position: absolute; width: 5mm; height: 5mm; border: 0 solid currentColor; opacity: .5; }
.foot { position: absolute; left: 16mm; right: 16mm; bottom: 9mm; display: flex; justify-content: space-between; align-items: baseline; padding-top: 2.4mm; border-top: .5mm solid currentColor; font-family: 'Archivo', sans-serif; font-weight: 800; font-stretch: 112%; font-size: 7pt; letter-spacing: .14em; text-transform: uppercase; }
.foot__n { color: var(--red); }
.sheet--dark .foot__n { color: var(--pink); }
.print { position: absolute; margin: 0; padding: 2.4mm 2.4mm 8mm; background: #fff; box-shadow: 1.6mm 2.2mm 0 rgba(16,19,20,.28); }
.print img { display: block; width: 100%; height: 100%; object-fit: cover; }
.print figcaption { position: absolute; left: 3mm; bottom: 1.6mm; font-family: 'Most Wazted', cursive; font-size: 13pt; color: var(--night); }

/* ---- 01 cover ---- */
.cover__photo { position: absolute; right: 0; top: 0; width: 62%; height: 58%; object-fit: cover; object-position: 60% 40%; clip-path: polygon(8% 0, 100% 0, 100% 100%, 0 100%, 5% 90%, 0 79%, 6% 68%, 2% 55%, 7% 43%, 3% 30%, 8% 16%); }
.cover__tint { position: absolute; right: 0; top: 0; width: 62%; height: 58%; background: linear-gradient(200deg, rgba(186,20,34,.0) 30%, rgba(16,19,20,.85) 96%); clip-path: polygon(8% 0, 100% 0, 100% 100%, 0 100%, 5% 90%, 0 79%, 6% 68%, 2% 55%, 7% 43%, 3% 30%, 8% 16%); }
.cover__logo { width: 50mm; display: block; margin: -4mm 0 0 -3mm; rotate: -4deg; }
.cover__k { margin-top: 10mm; font-size: 9pt; color: var(--pink); }
.cover h1 { margin-top: 3mm; font-size: 96pt; letter-spacing: -.01em; }
.cover h1 span { display: block; }
.cover h1 span + span { position: relative; width: fit-content; color: var(--red); }
.cover__tag { margin-top: 9mm; max-width: 120mm; font-family: 'Archivo', sans-serif; font-weight: 900; font-stretch: 100%; font-size: 21pt; line-height: 1.08; text-transform: uppercase; }
.cover__tag em { font-style: normal; color: var(--pink); }
.cover__intro { margin-top: 8mm; display: grid; grid-template-columns: 1fr 1fr; gap: 8mm; font-size: 10.6pt; line-height: 1.5; color: #C9D3DA; }
.path { position: absolute; left: 16mm; right: 16mm; bottom: 24mm; display: grid; grid-template-columns: repeat(3, 1fr); border: .5mm solid var(--tower); }
.path div { position: relative; padding: 4mm 4mm 4.6mm; }
.path div + div { border-left: .5mm solid var(--tower); }
.path b { display: block; font-family: 'Archivo', sans-serif; font-weight: 900; font-stretch: 112%; font-size: 7.4pt; letter-spacing: .14em; text-transform: uppercase; color: var(--pink); }
.path strong { display: block; margin: 1.4mm 0 1.2mm; font-family: 'Archivo', sans-serif; font-weight: 900; font-stretch: 62%; font-size: 24pt; line-height: .9; text-transform: uppercase; }
.path span { font-size: 9pt; line-height: 1.35; color: var(--slush); }
.path i { position: absolute; right: -3.2mm; top: 50%; z-index: 2; width: 6.4mm; height: 6.4mm; margin-top: -3.2mm; border-radius: 50%; background: var(--pink); color: var(--night); display: grid; place-items: center; font: 900 9pt 'Archivo'; font-style: normal; }

/* ---- steps ---- */
.head { display: flex; justify-content: space-between; align-items: center; margin: -5mm 0 5mm; }
.head img { height: 22mm; display: block; rotate: -4deg; }
.head span { font-family: 'Archivo', sans-serif; font-weight: 800; font-stretch: 112%; font-size: 7.4pt; letter-spacing: .16em; text-transform: uppercase; color: var(--tower); }
.step { position: relative; display: grid; grid-template-columns: 30mm 1fr; column-gap: 6mm; padding: 5mm 0 6mm; border-top: 1.4mm solid var(--night); }
.step--tight { padding-bottom: 2mm; }
.step__n { font-family: 'Archivo', sans-serif; font-weight: 900; font-stretch: 62%; font-size: 76pt; line-height: .78; color: var(--red); }
.step__k { font-family: 'Archivo', sans-serif; font-weight: 900; font-stretch: 112%; font-size: 7.6pt; letter-spacing: .14em; text-transform: uppercase; color: var(--red); }
.step h2 { margin: 1.4mm 0 3.4mm; font-family: 'Archivo', sans-serif; font-weight: 900; font-stretch: 62%; font-size: 34pt; line-height: .88; text-transform: uppercase; }
.step p + p { margin-top: 2.6mm; }
.step__b > p:not(.step__k) { font-size: 10.6pt; line-height: 1.5; max-width: 132mm; }
.note { position: absolute; color: var(--red); font-size: 17pt; }
.loop { position: relative; margin: 1mm 0 5mm; padding: 4mm 6mm 5mm; background: var(--night); color: var(--ice); rotate: -.8deg; box-shadow: 2mm 2mm 0 var(--red); }
.loop b { display: block; margin-bottom: 2mm; font-family: 'Archivo', sans-serif; font-weight: 900; font-stretch: 112%; font-size: 7.4pt; letter-spacing: .14em; text-transform: uppercase; color: var(--pink); }
.loop p { font-family: 'Archivo', sans-serif; font-weight: 900; font-stretch: 62%; font-size: 19pt; white-space: nowrap; line-height: 1; text-transform: uppercase; max-width: none !important; }
.loop em { font-style: normal; color: var(--pink); padding: 0 .12em; }
.areas { display: grid; grid-template-columns: 1fr 1fr; gap: 4mm 6mm; margin-top: 4mm; }
.area { position: relative; padding: 3mm 4mm 3.6mm; border: .6mm solid var(--night); background: #EEF2F0; box-shadow: 1.4mm 1.4mm 0 var(--night); }
.area:nth-child(4) { background: var(--night); color: var(--ice); box-shadow: 1.4mm 1.4mm 0 var(--red); }
.area small { font-family: 'Archivo', sans-serif; font-weight: 900; font-size: 7.4pt; letter-spacing: .14em; color: var(--red); }
.area:nth-child(4) small { color: var(--pink); }
.area h3 { margin: .6mm 0 1.6mm; font-family: 'Archivo', sans-serif; font-weight: 900; font-stretch: 62%; font-size: 21pt; line-height: .9; text-transform: uppercase; }
.area p { font-size: 9.6pt; line-height: 1.42; }
.h-sec { margin: 3mm 0 0; font-size: 40pt; }
.h-sec span { color: var(--red); }
.lead { margin-top: 3mm; font-size: 10.6pt; line-height: 1.5; max-width: 140mm; }
.fine { margin-top: 4.5mm; font-size: 9.2pt; line-height: 1.5; color: var(--tower); max-width: 150mm; }
.checks { list-style: none; margin: 4mm 0 4mm; padding: 0; max-width: 132mm; }
.checks li { display: grid; grid-template-columns: 8mm 1fr; align-items: baseline; padding: 2.6mm 0; border-top: .4mm solid var(--night); font-family: 'Archivo', sans-serif; font-weight: 800; font-size: 11.4pt; line-height: 1.25; text-transform: uppercase; }
.checks li:last-child { border-bottom: .4mm solid var(--night); }
.checks b { color: var(--red); font-weight: 900; }
.out { position: absolute; left: 16mm; right: 16mm; bottom: 22mm; padding: 6mm 8mm 7mm; background: var(--red); color: var(--ice); rotate: -.6deg; }
.out h3 { font-size: 41pt; white-space: nowrap; }
.out p { margin-top: 2.4mm; max-width: 130mm; font-size: 10.6pt; line-height: 1.45; font-weight: 600; }
.out dl { display: flex; gap: 10mm; margin: 4.4mm 0 0; }
.out dt { font-family: 'Archivo', sans-serif; font-weight: 800; font-stretch: 112%; font-size: 6.8pt; letter-spacing: .16em; text-transform: uppercase; opacity: .85; }
.out dd { margin: .6mm 0 0; font-family: 'Archivo', sans-serif; font-weight: 900; font-stretch: 75%; font-size: 15pt; text-transform: uppercase; white-space: nowrap; }
</style></head><body>

<!-- ============ 01 cover ============ -->
<div class="sheet sheet--dark cover">
  <img class="cover__photo" src="${photoRail}" alt="">
  <div class="cover__tint"></div>
  <span class="crop" style="left:8mm;top:8mm;border-top-width:.4mm;border-left-width:.4mm"></span>
  <span class="crop" style="right:8mm;bottom:8mm;border-bottom-width:.4mm;border-right-width:.4mm"></span>
  <img class="cover__logo" src="${logo}" alt="BAS CAMP">
  <span class="stamp" style="left:66mm;top:30mm;rotate:-7deg;color:var(--pink)">Issue 01 · Winter 26/27</span>
  <p class="cover__k wide">Snowboard + ski training camp · Livigno, Italy · 23—27 Dec 2026</p>
  <h1 class="disp"><span>Training</span><span>programme.${mark(dblD, 'left:0;bottom:-3.2mm;width:100%;height:4.6mm', '#E1EFFA', 4, '0 0 100 16')}</span></h1>
  <p class="cover__tag">Understand your riding. <em>Know what to train next.</em></p>
  <div class="cover__intro">
    <p>Feeling more confident on the slope, improving your technique, getting to grips with carving or trying your first freestyle moves — everyone comes with their own goal. At BAS CAMP we start from your level and build the training around what will move you forward.</p>
    <p>Before the trip you get to know the theory. On the slope you work with a coach, see your attempts on video and use the tips in your next runs. After camp you get a personal programme for training on your own.</p>
  </div>
  <span class="marker" style="position:absolute;right:20mm;bottom:63mm;rotate:-5deg;color:var(--pink);font-size:19pt">five steps</span>
  ${mark(downD, 'right:30mm;bottom:49mm;width:7mm;height:12mm', '#FF94E3', 3, '0 0 40 70')}
  <div class="path">
    <div><b>Before camp</b><strong>Theory.</strong><span>The coach’s video library, at your own pace.</span><i>→</i></div>
    <div><b>On the slope</b><strong>Coaching.</strong><span>Your level, your group, video on every attempt.</span><i>→</i></div>
    <div><b>After camp</b><strong>Your plan.</strong><span>A personal programme to keep going.</span></div>
  </div>
  ${foot(1)}
</div>

<!-- ============ 02 steps 01–03 ============ -->
<div class="sheet">
  <div class="head"><img src="${wordmark}" alt="BAS CAMP"><span>Training programme · steps 01—03</span></div>
  ${step('01', 'Get to know the theory', 'Before camp', [
    'You’ll get access to the coach’s video library: the basics of riding technique, explanations of the exercises and breakdowns of freestyle elements.',
    'The materials help you understand in advance how the movements work, what to pay attention to and what to expect in training. Watch an explanation at your own pace and come back to the parts that raise questions.',
  ])}
  ${step('02', 'Find your starting point', 'First runs', [
    'On the slope the coach watches how you ride: what already works, where control is missing and which habits hold your progress back. If it’s your first time on a snowboard or skis, we start with the basics.',
    'What you feel while riding doesn’t always match how you actually move. Even a confident rider can go years without noticing a mistake. The coach helps you see it, explains how it affects your riding and decides what to work on first.',
  ])}
  ${step('03', 'Work in a group at your level', 'Training', [
    'First we split riders into snowboarders and skiers, then by riding level. Beginners learn the basics; more experienced riders work on their technique and new elements.',
    'The group has a shared theme and exercises you practise together. Everyone still gets feedback on their own attempts. When the coach spots a specific mistake, he picks an exercise that helps fix it.',
  ])}
  <span class="note marker" style="right:17mm;top:43mm;rotate:4deg">homework first</span>
  <span class="note marker" style="right:17mm;top:110.5mm;rotate:-3deg">honest look</span>
  <span class="note marker" style="right:17mm;top:184mm;rotate:4deg">your level</span>
  <span class="stamp" style="left:52mm;bottom:27mm;rotate:-3deg;color:var(--red)">Snowboard + ski · all levels</span>
  ${splat('#BA1422', '#101314', 'right:18mm;bottom:22mm;width:34mm;height:24mm')}
  ${foot(2)}
</div>

<!-- ============ 03 step 04 + what we work on ============ -->
<div class="sheet">
  <div class="head"><img src="${wordmark}" alt="BAS CAMP"><span>Training programme · step 04</span></div>
  ${step('04', 'See it and try again', 'Video and feedback', [
    'During training we film attempts and go through them right on the slope. You see yourself from the outside, and the coach shows which moment to look at and what to change on the next attempt.',
  ])}
  <div class="loop"><b>The loop</b><p>Attempt <em>→</em> review + feedback <em>→</em> exercise or fix <em>→</em> new attempt</p></div>
  <span class="note marker" style="right:19mm;top:79mm;rotate:-4deg;color:var(--red);font-size:17pt">again. and again.</span>
  <p class="lead">So you have a concrete task for the next run and a chance to test the tip straight away. We come back to the exercise to lock the movement in, and make the task harder as you’re ready. At the evening video review we look at what changed during the day, what still needs attention and what to focus on next.</p>
  <h2 class="disp h-sec" style="margin-top:7mm">What we’ll <span>work on.</span></h2>
  <p class="lead">The content of training depends on your level. The main areas of the programme:</p>
  <div class="areas">
    <div class="area"><small>A</small><h3>Basic technique</h3><p>Stance, balance, turns, speed and control on the slope. For beginners — first steps; for experienced riders — habits and precision.</p></div>
    <div class="area"><small>B</small><h3>Carving</h3><p>Edge work and holding a carved turn. Exercises that help you feel the arc and control it.</p></div>
    <div class="area"><small>C</small><h3>Intro to freestyle</h3><p>Lead-up exercises and first elements: step by step, from accessible moves to harder ones, as you’re ready.</p></div>
    <div class="area"><small>D</small><h3>First steps in the park</h3><p>For prepared riders — simple features and suitable elements, with a coach beside you.</p></div>
  </div>
  <p class="fine">The coach chooses the exercises, the terrain and the move to new elements based on your readiness and the conditions on the mountain. Riders of different levels don’t go through the same set of tasks.</p>
  ${mark(xD, 'right:17mm;top:129mm;width:13mm;height:9mm', '#BA1422', 3, '0 0 60 40')}
  ${foot(3)}
</div>

<!-- ============ 04 step 05 ============ -->
<div class="sheet">
  <div class="head"><img src="${wordmark}" alt="BAS CAMP"><span>Training programme · step 05</span></div>
  ${step('05', 'Keep going with your own plan', 'After camp', [
    'After camp you get a personal programme for training on your own. It includes:',
  ])}
  <ul class="checks" style="margin-left:36mm">
    <li><b>✓</b>The key points in your technique that still need fixing or locking in</li>
    <li><b>✓</b>Exercises for working on them</li>
    <li><b>✓</b>Priorities: what to focus on first and what to train next</li>
  </ul>
  <p class="lead" style="margin-left:36mm;max-width:126mm">You leave understanding your own riding, with specific exercises to come back to on your next trips.</p>
  <span class="note marker" style="right:17mm;top:39mm;rotate:6deg">take it home</span>
  <figure class="print" style="left:20mm;top:158mm;width:72mm;height:50mm;rotate:-2.5deg"><span class="tape" style="left:30%;top:-2.6mm;width:40%;rotate:3deg"></span><img src="${photoCrew}" alt=""><figcaption>same crew</figcaption></figure>
  <figure class="print" style="left:100mm;top:162mm;width:62mm;height:45mm;rotate:3deg"><span class="tape" style="left:32%;top:-2.6mm;width:36%;rotate:-4deg"></span><img src="${photoCoach}" alt=""><figcaption>on the slope</figcaption></figure>
  ${mark(burstD, 'left:170mm;top:164mm;width:17mm;height:17mm', '#BA1422', 3)}
  <span class="stamp" style="left:163mm;top:190mm;rotate:-8deg;color:var(--night);font-size:7.4pt">15 riders</span>
  <div class="out">
    <h3 class="disp">See you on the mountain.</h3>
    <p>BAS CAMP Issue 01: three coached days, video review every evening, and a plan to take home.</p>
    <dl><div><dt>When</dt><dd>23—27 Dec 2026</dd></div><div><dt>Where</dt><dd>Livigno, Italy</dd></div><div><dt>Join</dt><dd>bascamp.world/camp</dd></div></dl>
  </div>
  ${foot(4)}
</div>
</body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 794, height: 1123 }, deviceScaleFactor: 2 });
await page.setContent(html, { waitUntil: 'load' });
await page.evaluate(() => document.fonts.ready);
// nothing may spill off a sheet: report anything that does
const spill = await page.evaluate(() => [...document.querySelectorAll('.sheet')].flatMap((sh, i) => {
  const R = sh.getBoundingClientRect();
  const footTop = sh.querySelector('.foot').getBoundingClientRect().top;
  return [...sh.querySelectorAll('.step, .lead, .areas, .fine, .checks, .cover__intro, h1, .cover__tag')].filter((el) => !el.closest('.out, .path')).map((el) => el.getBoundingClientRect()).filter((r) => r.bottom > footTop - 4 || r.right > R.right - 20).map((r) => `sheet ${i + 1}: flow content reaches ${Math.round(r.bottom - R.top)} of ${Math.round(footTop - R.top)}`);
}));
if (spill.length) console.log('SPILL\n' + spill.join('\n'));
if (process.argv.includes('--shots')) {
  fs.mkdirSync('shots/programme', { recursive: true });
  const n = await page.locator('.sheet').count();
  for (let i = 0; i < n; i++) await page.locator('.sheet').nth(i).screenshot({ path: `shots/programme/page-${i + 1}.png` });
}
await page.pdf({ path: 'public/BAS-CAMP-training-programme.pdf', format: 'A4', printBackground: true, preferCSSPageSize: true });
await browser.close();
console.log('public/BAS-CAMP-training-programme.pdf', Math.round(fs.statSync('public/BAS-CAMP-training-programme.pdf').size / 1024), 'KB');
