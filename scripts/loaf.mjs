// Which scripts make the long frames during start-up? (Long Animation Frames API, 4× CPU throttle)
import { chromium } from '@playwright/test';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 412, height: 823 }, deviceScaleFactor: 1.75, isMobile: true });
const page = await ctx.newPage();
const cdp = await ctx.newCDPSession(page);
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
await page.addInitScript(() => {
  window.__loaf = [];
  new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__loaf.push({
    t: Math.round(e.startTime), d: Math.round(e.duration), blocking: Math.round(e.blockingDuration), render: Math.round(e.renderStart ? e.startTime + e.duration - e.renderStart : 0), style: Math.round(e.styleAndLayoutStart ? e.startTime + e.duration - e.styleAndLayoutStart : 0),
    scripts: e.scripts.map((s) => `${s.invokerType}:${s.invoker} ${s.sourceFunctionName}@${(s.sourceURL || '').slice(-30)}:${s.sourceCharPosition} ${Math.round(s.duration)}ms`),
  }))).observe({ type: 'long-animation-frame', buffered: true });
});
await page.goto(`${process.argv[2] ?? 'http://localhost:4322'}/#cover`, { waitUntil: 'load' });
await page.waitForTimeout(7000);
const l = await page.evaluate(() => window.__loaf.filter((f) => f.blocking > 0));
for (const f of l) console.log(`${f.t}ms dur ${f.d} blocking ${f.blocking} (render ${f.render}, style/layout ${f.style})\n   ${f.scripts.join('\n   ')}`);
await browser.close();
