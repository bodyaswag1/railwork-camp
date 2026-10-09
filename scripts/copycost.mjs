// Wall time of one warm page copy (pre and landed) for every magazine page, phone size, CPU throttled.
//   node scripts/copycost.mjs [baseUrl] [throttle=4]
import { chromium } from '@playwright/test';
const [base = 'http://localhost:4323', throttle = '4'] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
await page.goto(`${base}/?debug#cover`, { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__crumple, null, { timeout: 30000 });
await page.waitForTimeout(3000);
const copy = (i, l) => page.evaluate(async ([i, l]) => {
  const S = window.__crumple.snapshots, pages = Array.from(document.querySelectorAll('[data-page]'));
  const t0 = performance.now();
  await S.ensure(pages, i, l, () => {}, `cost${Math.random()}`);
  return Math.round(performance.now() - t0);
}, [i, l]);
await copy(1, 'pre'); // warm the shared context
const cdp = await ctx.newCDPSession(page);
await cdp.send('Emulation.setCPUThrottlingRate', { rate: +throttle });
const n = await page.evaluate(() => document.querySelectorAll('[data-page]').length);
const rows = [];
for (let i = 0; i < n; i++) rows.push({ page: i, pre: await copy(i, 'pre'), landed: await copy(i, 'landed') });
console.table(rows);
console.log('total', rows.reduce((a, r) => a + r.pre + r.landed, 0), 'ms');
await browser.close();
