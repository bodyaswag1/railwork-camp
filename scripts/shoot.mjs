// Screenshots of chosen magazine pages (and /camp) for a quick look while working.
// node scripts/shoot.mjs <base> <out-dir> <phone|desk|both> [ids…]   (ids: cover ilia … or "camp")
import { chromium } from '@playwright/test';
import fs from 'node:fs';

const [base = 'http://localhost:4323', out = 'shots/work', which = 'both', ...ids] = process.argv.slice(2);
const list = ids.length ? ids : ['cover', 'ilia', 'coaching', 'progress', 'train', 'life', 'next-camp', 'next-level'];
fs.mkdirSync(out, { recursive: true });
const sizes = [
  { name: 'phone', viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  { name: 'desk', viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
].filter((s) => which === 'both' || s.name === which);

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
for (const s of sizes) {
  const { name, ...opts } = s;
  for (const id of list) {
    const ctx = await browser.newContext(opts);
    const page = await ctx.newPage();
    page.on('pageerror', (e) => console.log(`[${name} ${id}] pageerror`, e.message));
    if (id === 'camp') {
      await page.goto(`${base}/camp`, { waitUntil: 'networkidle' });
      await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 60)); } scrollTo(0, 0); });
      await page.waitForTimeout(800);
      await page.screenshot({ path: `${out}/${name}-camp.png`, fullPage: true });
    } else {
      await page.goto(`${base}/#${id}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(4200);
      await page.screenshot({ path: `${out}/${name}-${id}.png` });
      const inner = await page.evaluate(() => { const sc = document.querySelector('.page.is-active [data-scroll]'); return sc ? sc.scrollHeight - sc.clientHeight : 0; });
      if (inner > 2) {
        await page.evaluate(() => { const sc = document.querySelector('.page.is-active [data-scroll]'); sc.scrollTop = sc.scrollHeight; });
        await page.waitForTimeout(300);
        await page.screenshot({ path: `${out}/${name}-${id}-end.png` });
      }
      console.log(`${name} ${id}: scrolls ${inner}px`);
    }
    await ctx.close();
  }
}
await browser.close();
