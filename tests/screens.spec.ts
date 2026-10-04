// Every magazine page at 390×844 and 1440×900 (+ a reduced-motion pass), and /camp.
// Fails on horizontal overflow (carousel slides waiting off to the side are clipped, so they don't count),
// and on any page that doesn't fit one screen at these sizes (except the career stats on a phone).
import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';

const pages = ['cover', 'ilia', 'coaching', 'progress', 'train', 'life', 'next-camp', 'next-level'];
const sizes = [
  { name: 'phone', width: 390, height: 844, dsf: 3, mobile: true },
  { name: 'desktop', width: 1440, height: 900, dsf: 1, mobile: false },
];
fs.mkdirSync('shots/screens', { recursive: true });

async function overflow(page: Page) {
  return page.evaluate(() => {
    const W = innerWidth;
    const sec = document.querySelector<HTMLElement>('.page.is-active')!;
    const sc = sec.querySelector<HTMLElement>('[data-scroll]');
    // content that pokes out sideways (decorative marks may bleed, text and controls may not)
    const wide = Array.from(sec.querySelectorAll<HTMLElement>('h1,h2,h3,p,li,a,button,figure,figcaption,dl,.btn,.opt,.path'))
      .filter((el) => el.closest('[aria-hidden="true"]') === null && el.closest('.car__track') === null)
      .map((el) => ({ el: `${el.tagName.toLowerCase()}.${el.className}`.slice(0, 60), r: el.getBoundingClientRect() }))
      .filter(({ r }) => r.width > 0 && (r.right > W + 1 || r.left < -1))
      .map(({ el, r }) => `${el} [${Math.round(r.left)}..${Math.round(r.right)}]`);
    return {
      docScroll: document.documentElement.scrollWidth - W,
      inner: sc ? sc.scrollHeight - sc.clientHeight : 0,
      wide,
    };
  });
}

for (const s of sizes) {
  for (const reduced of [false, true]) {
    test.describe(`${s.name}${reduced ? ' reduced-motion' : ''}`, () => {
      test.use({ viewport: { width: s.width, height: s.height }, deviceScaleFactor: s.dsf, isMobile: s.mobile, hasTouch: s.mobile, reducedMotion: reduced ? 'reduce' : 'no-preference' });
      for (const id of pages) {
        test(id, async ({ page }) => {
          await page.goto(`/#${id}`);
          await page.waitForLoadState('networkidle');
          await page.waitForTimeout(reduced ? 600 : 3000); // marks drawn
          await page.screenshot({ path: `shots/screens/${s.name}${reduced ? '-rm' : ''}-${id}.png` });
          const o = await overflow(page);
          expect(o.docScroll, 'page scrolls sideways').toBeLessThanOrEqual(0);
          expect(o.wide, 'content outside the viewport').toEqual([]);
          // the career-stats page (badges + the three pro boards) scrolls inside on a phone, like the first magazine
          if (!(id === 'ilia' && s.name === 'phone')) expect(o.inner, `${id} must fit one screen`).toBeLessThanOrEqual(2);
        });
      }
    });
  }
  test(`camp ${s.name}`, async ({ browser }) => {
    // full-page shots at 3× go past the GPU texture limit and tile; 1× is enough to check layout
    const ctx = await browser.newContext({ viewport: { width: s.width, height: s.height }, deviceScaleFactor: 1, isMobile: s.mobile });
    const page = await ctx.newPage();
    await page.goto('/camp');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: `shots/screens/${s.name}-camp.png`, fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
    await ctx.close();
  });
}
