// A reader on a phone: reads, scrolls pages that scroll inside, swipes on — with real touch input
// (CDP Input.dispatchTouchEvent, so the browser scrolls natively) and the CPU slowed down.
// Reports, per page turn: which effect ran (WebGL paper / CSS fallback / fade), how long the reader
// waited for it, and frame times during the move; plus jank while scrolling.
//   node scripts/mobile-journey.mjs [baseUrl] [cpuThrottle=4] [label]
import { chromium } from '@playwright/test';

const [base = process.env.BASE_URL ?? 'http://localhost:4322', throttle = '4', label = '', pace = 'reader'] = process.argv.slice(2);
// 'reader' reads each page; 'skim' swipes on as soon as a page has landed
const R = pace === 'skim' ? { cover: 900, glance: 250, land: 1300 } : { cover: 2500, glance: 1200, land: 2000 };
const browser = await chromium.launch({ args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const cdp = await ctx.newCDPSession(page);
if (+throttle > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: +throttle });

await page.addInitScript(() => {
  const w = window;
  w.__log = { frames: [], longtasks: [], turns: [] };
  let last = 0;
  const loop = (t) => {
    if (last) w.__log.frames.push([t, t - last]);
    last = t;
    const canvasOn = !!document.querySelector('.paper-canvas.is-on');
    const stageOn = !!document.querySelector('.stage.is-on');
    const css = !!document.querySelector('.css-crumple');
    const fading = !!document.querySelector('.page.is-moving') && !stageOn;
    const moving = stageOn || fading;
    const cur = w.__log.turns[w.__log.turns.length - 1];
    if (moving && (!cur || cur.end)) w.__log.turns.push({ start: t, kind: canvasOn ? 'webgl' : css ? 'css' : fading ? 'fade' : 'stage', end: 0 });
    else if (moving && cur && !cur.end) { if (canvasOn) cur.kind = 'webgl'; else if (css && cur.kind !== 'webgl') cur.kind = 'css'; }
    else if (!moving && cur && !cur.end) cur.end = t;
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  new PerformanceObserver((l) => l.getEntries().forEach((e) => w.__log.longtasks.push([Math.round(e.startTime), Math.round(e.duration)]))).observe({ type: 'longtask', buffered: true });
  w.__log.loaf = {};
  try {
    new PerformanceObserver((l) => l.getEntries().forEach((e) => {
      if (e.blockingDuration < 50) return;
      const top = [...e.scripts].sort((a, b) => b.duration - a.duration)[0];
      const key = top ? `${top.invokerType}:${top.invoker || ''} ${top.sourceFunctionName || '(anon)'}@${(top.sourceURL || '').split('/').pop().slice(0, 28)}:${top.sourceCharPosition}` : `(no script: render ${Math.round(e.duration - (e.renderStart ? e.renderStart - e.startTime : 0))}ms)`;
      (w.__log.loafList ??= []).push([Math.round(e.startTime), Math.round(e.duration), key.slice(0, 110), e.scripts.slice(0, 4).map((x) => `${x.sourceFunctionName || 'anon'}@${(x.sourceURL || '').split('/').pop().slice(0, 14)}:${x.sourceCharPosition}:${Math.round(x.duration)}`).join(' ')]);
      const k = w.__log.loaf[key] ?? (w.__log.loaf[key] = { n: 0, blocking: 0 });
      k.n++; k.blocking += e.blockingDuration;
    })).observe({ type: 'long-animation-frame', buffered: true });
  } catch {}
});

const now = () => page.evaluate(() => performance.now());
async function drag(y0, y1, steps = 14, x = 195) {
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: y0 }] });
  for (let i = 1; i <= steps; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y0 + ((y1 - y0) * i) / steps }] });
    await page.waitForTimeout(16);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}
const activeId = () => page.evaluate(() => document.querySelector('.page.is-active')?.id);
const canScroll = () => page.evaluate(() => { const s = document.querySelector('.page.is-active [data-scroll]'); return s ? s.scrollHeight - s.clientHeight : 0; });

await page.goto(`${base}/#cover`, { waitUntil: 'load' });
await page.waitForTimeout(R.cover); // the reader looks at the cover

const scrolls = [];
const gestures = [];
for (let turn = 0; turn < 4; turn++) {
  // read the page: scroll it down if it scrolls inside
  let room = await canScroll();
  let guard = 0;
  while (room > 4 && guard++ < 6) {
    const t0 = await now();
    await drag(640, 260, 16);
    await page.waitForTimeout(700);
    const t1 = await now();
    scrolls.push({ page: await activeId(), t0, t1 });
    const left = await page.evaluate(() => { const s = document.querySelector('.page.is-active [data-scroll]'); return s ? s.scrollHeight - s.clientHeight - s.scrollTop : 0; });
    if (left <= 2) break;
    room = left;
  }
  await page.waitForTimeout(R.glance); // glance at the end of the page
  const from = await activeId();
  const g0 = await now();
  await drag(620, 470, 10); // a normal swipe up
  const g1 = await now();
  gestures.push({ from, g0, g1 });
  await page.waitForFunction((f) => document.querySelector('.page.is-active')?.id !== f && !document.querySelector('.stage.is-on, .paper-canvas.is-on, .page.is-moving'), from, { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(R.land); // the new page lands, marks draw on
}

const log = await page.evaluate(() => window.__log);
const marks = await page.evaluate(() => performance.getEntriesByType('mark').filter((m) => /^(turn:start|prep:|ahead:|crumple:move-start|snap:)/.test(m.name)).map((m) => [m.name, Math.round(m.startTime)]));
let prev = 0;
console.log('turn timeline (ms since previous mark):', marks.map(([n, t]) => { const d = n === 'turn:start' ? '' : `+${t - prev}`; prev = t; return n === 'turn:start' ? `
  ${n}@${t}` : `${n} ${d}`; }).join('  '));
const frameStats = (a, b) => {
  const fr = log.frames.filter(([t]) => t > a && t <= b);
  const f = fr.map(([, d]) => d);
  const worst = fr.reduce((m, x) => (x[1] > m[1] ? x : m), [0, 0]);
  const s = [...f].sort((x, y) => x - y);
  return { maxAt: Math.round(worst[0] - a), n: f.length, median: +(s[Math.floor(s.length / 2)] ?? 0).toFixed(1), p95: +(s[Math.floor(s.length * 0.95)] ?? 0).toFixed(1), max: +(Math.max(0, ...f)).toFixed(0), over33: f.filter((d) => d > 33.4).length };
};
const turns = gestures.map((g, i) => {
  const t = log.turns.find((x) => x.start >= g0Guard(g)) ?? {};
  function g0Guard(gg) { return gg.g0 - 50; }
  const fs = t.start ? frameStats(t.start, t.end || t.start + 3000) : {};
  const land = t.end ? frameStats(t.end, t.end + 2000) : {};
  // from the moment the swipe counted as a turn (48 px into it) to the paper moving: what the reader waits
  const trig = marks.find(([n, at]) => n === 'turn:start' && at >= g.g0 - 50);
  return { turn: `${g.from}→`, kind: t.kind ?? 'none', latency: t.start && trig ? Math.round(t.start - trig[1]) : null, waitAfterSwipe: t.start ? Math.round(t.start - g.g1) : null, moveMs: t.end ? Math.round(t.end - t.start) : null, ...fs, landingMax: land.max, landingOver33: land.over33 };
});
console.log(`\n=== ${label || base} · 390×844 @3x · CPU ${throttle}× ===`);
console.table(turns);
const scrollRows = scrolls.map((s) => ({ page: s.page, ...frameStats(s.t0, s.t1), longtasks: log.longtasks.filter(([t, d]) => t >= s.t0 && t <= s.t1).map(([, d]) => d).join(',') }));
console.log('scrolling (drag + 700 ms):');
console.table(scrollRows);
const lt = log.longtasks.filter(([, d]) => d >= 100);
console.log(`long tasks ≥100 ms: ${lt.length}, total ${lt.reduce((a, [, d]) => a + d, 0)} ms, worst ${Math.max(0, ...lt.map(([, d]) => d))} ms`);
for (const t of log.turns) {
  const inMove = (log.loafList ?? []).filter(([st, d]) => st + d > t.start && st < t.end);
  const inLand = (log.loafList ?? []).filter(([st, d]) => st >= t.end - 50 && st < t.end + 2000);
  console.log(`turn @${Math.round(t.start)}: long frames in move: ${inMove.map(([st, d, k, sc]) => `[+${st - Math.round(t.start)} ${d}ms ${sc || k}]`).join(' ') || 'none'}`);
  console.log(`   landing: ${inLand.map(([st, d, k, sc]) => `[+${st - Math.round(t.end)} ${d}ms ${sc || k}]`).join(' ') || 'none'}`);
}
console.log('longest frames:', [...(log.loafList ?? [])].sort((x, y) => y[1] - x[1]).slice(0, 6).map(([st, d, k, sc]) => `[@${st} ${d}ms ${sc || k}]`).join(' '));
console.log('blocking by source (long animation frames):');
Object.entries(log.loaf).sort((a, b) => b[1].blocking - a[1].blocking).slice(0, 12).forEach(([k, v]) => console.log(`  ${String(Math.round(v.blocking)).padStart(6)} ms  ×${v.n}  ${k}`));
if (errors.length) console.log('errors:', errors.slice(0, 5).join(' | '));
await browser.close();
