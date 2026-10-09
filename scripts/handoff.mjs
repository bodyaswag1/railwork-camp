// Hand-over check: at p = 0 and p = 1 the canvas must match the live DOM page.
//   node scripts/handoff.mjs [baseUrl] [w] [h] [from] [to]
import { chromium } from '@playwright/test';
import sharp from 'sharp';
const [base = process.env.BASE_URL ?? 'http://localhost:4322', w = '1440', h = '900', from = 'cover', to = '1'] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11'] });
const page = await browser.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1 });
await page.goto(`${base}/?debug#${from}`, { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__crumple);
await page.addStyleTag({ content: '.lil-gui{display:none!important}' });
await page.waitForTimeout(6000); // marks drawn, snapshots warm
const diff = async (a, b, name) => {
  const A = await sharp(a).removeAlpha().raw().toBuffer(), B = await sharp(b).removeAlpha().raw().toBuffer();
  let sum = 0, max = 0, over = 0;
  for (let i = 0; i < A.length; i++) { const d = Math.abs(A[i] - B[i]); sum += d; if (d > max) max = d; if (d > 24) over++; }
  console.log(`${name}: mean |Δ| ${(sum / A.length).toFixed(2)} / 255, max ${max}, channels off by >24: ${(100 * over / A.length).toFixed(2)}%`);
  const out = await sharp(Buffer.from(A.map((v, i) => Math.min(255, Math.abs(v - B[i]) * 4))), { raw: { width: +w, height: +h, channels: 3 } }).png().toBuffer();
  await sharp(out).toFile(`shots/handoff-${name}.png`);
};
const dom0 = await page.screenshot();
await page.evaluate((to) => window.__crumple.seek(0, { to: +to, seed: 99 }), to);
const cv0 = await page.screenshot();
await diff(dom0, cv0, 'p0');
await page.evaluate((to) => window.__crumple.seek(1, { to: +to }), to);
const cv1 = await page.screenshot();
await page.evaluate(() => window.__crumple.showDom('to'));
await page.waitForTimeout(300);
const dom1 = await page.screenshot();
await diff(dom1, cv1, 'p1');
await browser.close();
