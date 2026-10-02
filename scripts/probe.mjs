// Dev helper: freeze transition frames via window.__crumple.seek and save screenshots.
// node scripts/probe.mjs [baseUrl] [w] [h] [p1,p2,...] [seed] [to]
import { chromium } from '@playwright/test';
import fs from 'node:fs';

const [base = process.env.BASE_URL ?? 'http://localhost:4322', w = '1440', h = '900', ps = '0,0.1,0.2,0.3,0.4,0.5,0.6,0.7,0.8,0.9,1', seed = '777', to = '1'] = process.argv.slice(2);
const out = 'shots/probe';
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11'] });
const page = await browser.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1 });
const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
await page.goto(`${base}/?debug#cover`, { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__crumple, null, { timeout: 30000 });
await page.evaluate(() => { document.querySelector('.lil-gui')?.remove(); });
await page.waitForTimeout(2500);
for (const p of ps.split(',').map(Number)) {
  const t0 = Date.now();
  await page.evaluate(([p, seed, to]) => window.__crumple.seek(p, { seed, to }), [p, +seed, +to]);
  await page.screenshot({ path: `${out}/${w}x${h}-p${p.toFixed(2)}.png` });
  console.log(`p=${p} ${Date.now() - t0}ms`);
}
console.log(logs.filter((l) => !l.includes('[vite]')).join('\n'));
await browser.close();
