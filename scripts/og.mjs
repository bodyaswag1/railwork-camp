// Renders public/og.jpg (1200×630) from the live cover, marks drawn, debug chrome hidden.
//   node scripts/og.mjs [baseUrl]
import { chromium } from '@playwright/test';
import sharp from 'sharp';
const base = process.argv[2] ?? 'http://localhost:4322';
const browser = await chromium.launch({ args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11'] });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 2 });
await page.goto(`${base}/#cover`, { waitUntil: 'networkidle' });
await page.waitForTimeout(3500);
// a share card, not a screenshot: no navigation chrome
await page.addStyleTag({ content: '.skip,.masthead__nav,.masthead__menu,.counter,.cover__hint{display:none!important}' });
const png = await page.screenshot();
await sharp(png).resize(1200, 630).jpeg({ quality: 84, mozjpeg: true }).toFile('public/og.jpg');
await browser.close();
console.log('public/og.jpg written');
