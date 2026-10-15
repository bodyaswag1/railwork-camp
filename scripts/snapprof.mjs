// Profile single page copies (CPU throttled), self time by function, plus the copy's wall time.
//   node scripts/snapprof.mjs [baseUrl] [page=2] [look=pre] [throttle=4]
import { chromium } from '@playwright/test';
const [base = 'http://localhost:4323', pageIdx = '2', look = 'pre', throttle = '4'] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
await page.goto(`${base}/?debug#cover`, { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__crumple, null, { timeout: 30000 });
await page.waitForTimeout(3000);
const cdp = await ctx.newCDPSession(page);
await cdp.send('Emulation.setCPUThrottlingRate', { rate: +throttle });
// first copy warms the shared context (fonts/photos fetched once); profile the second and third
const copy = (i, l) => page.evaluate(async ([i, l]) => {
  const S = window.__crumple.snapshots, pages = Array.from(document.querySelectorAll('[data-page]'));
  const t0 = performance.now();
  await S.ensure(pages, i, l, () => {}, `prof${Math.random()}`);
  return Math.round(performance.now() - t0);
}, [i, l]);
console.log('first copy (cold context):', await copy(+pageIdx, look), 'ms');
await cdp.send('Profiler.enable');
await cdp.send('Profiler.setSamplingInterval', { interval: 200 });
await cdp.send('Profiler.start');
const t1 = await copy(+pageIdx, look);
const t2 = await copy(3, 'pre');
const { profile } = await cdp.send('Profiler.stop');
console.log('warm copies:', t1, 'ms (page', pageIdx, look + ') ·', t2, 'ms (page 3 pre)');
const byId = new Map(profile.nodes.map((n) => [n.id, n]));
const self = new Map();
profile.samples.forEach((id, i) => {
  const f = byId.get(id).callFrame;
  const k = `${f.functionName || '(anon)'} ${f.url.split('/').pop().slice(0, 30)}:${f.lineNumber}:${f.columnNumber}`;
  self.set(k, (self.get(k) ?? 0) + (profile.timeDeltas[i] ?? 0) / 1000);
});
[...self.entries()].filter(([k]) => !/^\((idle|program)\)/.test(k)).sort((a, b) => b[1] - a[1]).slice(0, 22)
  .forEach(([k, v]) => console.log(String(Math.round(v)).padStart(6), 'ms', k));
await browser.close();
