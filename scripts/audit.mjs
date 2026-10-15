// Layout audit: every magazine page and every /camp section at several screen sizes, saved as PNGs
// (shots/audit/<what>-<width>.png), plus a list of decoration that points at nothing or lies on top of copy.
//   node scripts/audit.mjs [base] [home|camp|both] [widths…]
import { chromium } from '@playwright/test';
import fs from 'node:fs';

const [base = 'http://localhost:4323', which = 'both', ...ws] = process.argv.slice(2);
const sizes = (ws.length ? ws.map(Number) : [360, 390, 768, 1024, 1440, 1920]).map((w) => ({ w, h: w < 500 ? 780 : w < 900 ? 1024 : w < 1100 ? 768 : w < 1600 ? 900 : 1080 }));
const out = 'shots/audit';
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });

// decoration (aria-hidden marks, notes, stamps, stickers) whose box overlaps real copy or leaves the screen
const clashes = (scopeSel) => {
  const scope = document.querySelector(scopeSel);
  if (!scope) return [];
  const W = innerWidth;
  const vis = (el) => { const cs = getComputedStyle(el); return cs.visibility !== 'hidden' && cs.display !== 'none' && +cs.opacity > 0.05; };
  const decor = [...scope.querySelectorAll('.marker[aria-hidden="true"], [aria-hidden="true"] .marker, .stamp, .sticker, svg.mk, .splat, svg.doodle, img.logo'), ...document.querySelectorAll('.masthead img.logo, .topbar img.logo')].filter(vis);
  const copy = [...scope.querySelectorAll('h1,h2,h3,p,li,dt,dd,a,button,time,figcaption,label,summary,span.nextcamp__issue'), ...document.querySelectorAll('.masthead .counter, .topbar__issue')].filter((el) => !el.closest('[aria-hidden="true"]') && vis(el) && el.children.length === [...el.children].filter((c) => c.matches('svg,span,b,strong,em,br,small,i')).length);
  const res = [];
  for (const d of decor) {
    const r = d.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    const name = `${d.tagName.toLowerCase()}.${(d.getAttribute('class') || '').split(' ').filter((c) => c && c !== 'mk' && c !== 'marker').slice(0, 2).join('.')} "${(d.textContent || '').trim().slice(0, 18)}"`;
    if (r.right > W + 2 || r.left < -2) res.push(`OFFSCREEN ${name} [${Math.round(r.left)}..${Math.round(r.right)}] of ${W}`);
    if (d.matches('svg.mk') || d.matches('.splat')) continue; // strokes are meant to circle / underline copy
    for (const c of copy) {
      if (c.contains(d) || d.contains(c)) continue;
      // the rects of the copy a reader can see (screen-reader-only text reports a box it doesn't paint)
      const rects = [], tw = document.createTreeWalker(c, NodeFilter.SHOW_TEXT);
      for (let n = tw.nextNode(); n; n = tw.nextNode()) {
        if (!n.textContent.trim() || n.parentElement.closest('.sr-only, [aria-hidden="true"]')) continue;
        const range = document.createRange(); range.selectNodeContents(n); rects.push(...range.getClientRects());
      }
      for (const q of rects) {
        const ox = Math.min(r.right, q.right) - Math.max(r.left, q.left), oy = Math.min(r.bottom, q.bottom) - Math.max(r.top, q.top);
        if (ox > 6 && oy > 6 && ox * oy > (d.matches('img.logo') ? 0.01 : 0.12) * r.width * r.height) { res.push(`OVERLAP ${name} on "${(c.textContent || '').trim().slice(0, 24)}"`); break; }
      }
    }
  }
  return [...new Set(res)];
};

for (const { w, h } of sizes) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, isMobile: w < 800, hasTouch: w < 800 });
  const page = await ctx.newPage();
  if (which !== 'camp') {
    await page.goto(`${base}/`, { waitUntil: 'networkidle' });
    const ids = await page.evaluate(() => [...document.querySelectorAll('[data-page]')].map((s) => s.id));
    for (const id of ids) {
      await page.goto(`${base}/#${id}`, { waitUntil: 'networkidle' });
      await page.reload({ waitUntil: 'networkidle' });
      await page.waitForTimeout(3600);
      await page.screenshot({ path: `${out}/home-${id}-${w}.png` });
      const c = await page.evaluate(clashes, `#${id}`); // before any scrolling: the header overlays scrolled copy by design
      const inner = await page.evaluate(() => { const sc = document.querySelector('.page.is-active [data-scroll]'); return sc ? sc.scrollHeight - sc.clientHeight : 0; });
      if (inner > 4) { await page.evaluate(() => { const sc = document.querySelector('.page.is-active [data-scroll]'); sc.scrollTop = sc.scrollHeight; }); await page.waitForTimeout(250); await page.screenshot({ path: `${out}/home-${id}-${w}-end.png` }); }
      console.log(`home ${id} @${w}: scrolls ${inner}px${c.length ? '\n   ' + c.join('\n   ') : ''}`);
    }
  }
  if (which !== 'home') {
    await page.goto(`${base}/camp`, { waitUntil: 'networkidle' });
    await page.addStyleTag({ content: '.ticket,.poster__scroll{display:none!important}.topbar{position:static!important}' });
    const n = await page.locator('main > *').count();
    for (let i = 0; i < n; i++) {
      const el = page.locator('main > *').nth(i);
      await page.evaluate((k) => document.querySelectorAll('main > *')[k].scrollIntoView({ block: 'start', behavior: 'instant' }), i);
      await page.waitForTimeout(1500);
      await el.screenshot({ path: `${out}/camp-${String(i).padStart(2, '0')}-${w}.png` });
      const c = await page.evaluate((k) => { document.querySelectorAll('main > *')[k].id ||= `sec-${k}`; return document.querySelectorAll('main > *')[k].id; }, i).then((id) => page.evaluate(clashes, `#${id}`));
      if (c.length) console.log(`camp ${i} @${w}:\n   ${c.join('\n   ')}`);
    }
    console.log(`camp @${w}: sideways overflow ${await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)}px`);
  }
  await ctx.close();
}
await browser.close();
