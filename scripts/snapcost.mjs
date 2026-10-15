import { chromium } from '@playwright/test';
const [base = process.env.BASE_URL ?? 'http://localhost:4322', w = '1440', h = '900', throttle = '1', dsf = '1'] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11'] });
const ctx = await browser.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: +dsf });
const page = await ctx.newPage();
await page.goto(`${base}/?debug#cover`, { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__crumple);
await page.waitForTimeout(6000);
if (+throttle > 1) { const cdp = await ctx.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: +throttle }); }
const r = await page.evaluate(async () => {
  const S = window.__crumple.snapshots, pages = Array.from(document.querySelectorAll('[data-page]'));
  const out = [];
  for (let i = 0; i < pages.length; i++) {
    S.markDirty(i, 'pre'); S.markDirty(i, 'live');
    let longest = 0, last = performance.now(), on = true;
    const loop = () => { const t = performance.now(); longest = Math.max(longest, t - last); last = t; if (on) setTimeout(loop, 0); };
    loop();
    const t0 = performance.now();
    await S.get(pages, i, i === 0 ? 'live' : 'pre');
    on = false;
    out.push({ page: pages[i].id, ms: Math.round(performance.now() - t0), longestBlock: Math.round(longest) });
  }
  return out;
});
console.table(r);
await browser.close();
