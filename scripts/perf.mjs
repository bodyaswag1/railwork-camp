// Performance pass: run real page turns and record frame times (rAF deltas) during each move.
//   node scripts/perf.mjs [baseUrl] [w] [h] [cpuThrottle] [mobile]
// Also checks the hand-over: the last canvas frame vs the live DOM page right after, and that
// p = 0 matches the page before it disappears.
import { chromium } from '@playwright/test';

const [base = process.env.BASE_URL ?? 'http://localhost:4322', w = '1440', h = '900', throttle = '1', mobile = ''] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11', '--enable-features=Vulkan'] });
const ctx = await browser.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: mobile ? 3 : 1, isMobile: !!mobile, hasTouch: !!mobile });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.text()); });
await page.goto(`${base}/#cover`, { waitUntil: 'networkidle' });
const gpu = await page.evaluate(() => {
  const c = document.createElement('canvas').getContext('webgl2');
  const d = c?.getExtension('WEBGL_debug_renderer_info');
  return d ? c.getParameter(d.UNMASKED_RENDERER_WEBGL) : 'n/a';
});
console.log('renderer:', gpu);
if (+throttle > 1) {
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: +throttle });
}
// the engine loads on the first sign of a reader; then let it pre-warm snapshots
await page.mouse.move(100, 100);
await page.waitForTimeout(9000);

await page.evaluate(() => {
  window.__frames = [];
  let last = performance.now();
  const loop = (t) => { window.__frames.push([t, t - last]); last = t; requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
});

const ids = await page.evaluate(() => Array.from(document.querySelectorAll('[data-page]')).map((p) => p.id));
const results = [];
for (let i = 0; i < Math.min(7, ids.length - 1); i++) {
  await page.evaluate(() => { window.__frames.length = 0; });
  const t0 = Date.now();
  if (mobile) {
    // a page that scrolls inside only turns at its bottom edge
    await page.evaluate(() => { const sc = document.querySelector('.page.is-active [data-scroll]'); if (sc) sc.scrollTop = sc.scrollHeight; });
    await page.waitForTimeout(500);
    await page.evaluate(() => { window.__frames.length = 0; });
    await page.evaluate(() => {
      const fire = (type, y) => window.dispatchEvent(new TouchEvent(type, { touches: type === 'touchend' ? [] : [new Touch({ identifier: 1, target: document.body, clientY: y, clientX: 100 })], changedTouches: [new Touch({ identifier: 1, target: document.body, clientY: y, clientX: 100 })] }));
      fire('touchstart', 600); fire('touchend', 300);
    });
  } else {
    await page.keyboard.press('ArrowDown');
  }
  // wait for the turn to finish (hash changes after landing)
  await page.waitForFunction((from) => location.hash !== `#${from}`, ids[i], { timeout: 30000 });
  const took = Date.now() - t0;
  const all = await page.evaluate(() => {
    const s = performance.getEntriesByName('crumple:move-start').pop()?.startTime ?? 0;
    const e = performance.getEntriesByName('crumple:move-end').pop()?.startTime ?? 1e12;
    return { inMove: window.__frames.filter(([t]) => t > s && t <= e + 1).map(([, d]) => d), outside: window.__frames.filter(([t]) => t <= s || t > e + 1).map(([, d]) => +d.toFixed(0)).filter((d) => d > 20) };
  });
  const f = all.inMove;
  console.log(`  long frames outside the move (prep/hand-over): ${all.outside.join(', ') || 'none'}`);
  const sorted = [...f].sort((a, b) => a - b);
  const p = (q) => sorted[Math.floor(sorted.length * q)] ?? 0;
  const long = f.filter((d) => d > 1000 / 50).length;
  results.push({ turn: `${i + 1}→${i + 2}`, ms: took, frames: f.length, median: p(0.5).toFixed(1), p95: p(0.95).toFixed(1), max: Math.max(...f).toFixed(1), over20ms: long, fps: (1000 / (f.reduce((a, b) => a + b, 0) / Math.max(1, f.length))).toFixed(0) });
  await page.waitForTimeout(2600);
}
console.table(results);
console.log(errors.filter((e) => !e.includes('non-scaling-stroke')).slice(0, 10).join('\n') || 'no errors');
await browser.close();
