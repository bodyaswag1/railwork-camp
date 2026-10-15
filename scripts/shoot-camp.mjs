// /camp, one screenshot per section (phone and desktop), for a quick look while working.
// node scripts/shoot-camp.mjs <base> <out-dir> <phone|desk|both> [section indexes…]
import { chromium } from '@playwright/test';
import fs from 'node:fs';

const [base = 'http://localhost:4323', out = 'shots/work', which = 'both', ...only] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const sizes = [
  { name: 'phone', viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  { name: 'desk', viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
].filter((s) => which === 'both' || s.name === which);

const browser = await chromium.launch();
for (const s of sizes) {
  const { name, ...opts } = s;
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log(`[${name}] pageerror`, e.message));
  page.on('console', (m) => { if (m.type() === 'error') console.log(`[${name}] console`, m.text()); });
  await page.goto(`${base}/camp`, { waitUntil: 'networkidle' });
  const n = await page.locator('main > *').count();
  for (let i = 0; i < n; i++) {
    if (only.length && !only.includes(String(i))) continue;
    const el = page.locator('main > *').nth(i);
    await el.scrollIntoViewIfNeeded();
    await page.evaluate((k) => document.querySelectorAll('main > *')[k].scrollIntoView({ block: 'start' }), i);
    await page.waitForTimeout(1600);
    await el.screenshot({ path: `${out}/${name}-camp-${String(i).padStart(2, '0')}.png` });
  }
  const over = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  console.log(`${name}: ${n} sections, sideways overflow ${over}px, height ${await page.evaluate(() => document.body.scrollHeight)}`);
  await ctx.close();
}
await browser.close();
