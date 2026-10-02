// Phone gestures with real touch input (CDP Input.dispatchTouchEvent, so the browser scrolls natively).
import { test, expect, type Page } from '@playwright/test';

test.use({ viewport: { width: 390, height: 664 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });

/** One finger drag from y0 to y1 in `steps` moves (~16 ms apart), like a real swipe. */
async function swipe(page: Page, y0: number, y1: number, steps = 12, x = 200) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: y0 }] });
  for (let i = 1; i <= steps; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y0 + ((y1 - y0) * i) / steps }] });
    await page.waitForTimeout(16);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
}
const active = (page: Page) => page.evaluate(() => document.querySelector('.page.is-active')?.id);
const settle = (page: Page) => page.waitForFunction(() => !document.querySelector('.stage.is-on, .paper-canvas.is-on'), null, { timeout: 15000 }).then(() => page.waitForTimeout(700));

test.describe('reduced motion (fast turns)', () => {
  test.use({ reducedMotion: 'reduce' });

  test('one short swipe turns one page, both ways', async ({ page }) => {
    await page.goto('/#cover');
    await page.waitForLoadState('networkidle');
    await swipe(page, 500, 410); // 90 px
    await settle(page);
    expect(await active(page)).toBe('stats');
    // stats may scroll inside on a short phone: at its top, a swipe down goes back
    await swipe(page, 200, 300);
    await settle(page);
    expect(await active(page)).toBe('cover');
  });

  test('a long swipe never skips a page', async ({ page }) => {
    await page.goto('/#cover');
    await page.waitForLoadState('networkidle');
    await swipe(page, 600, 60, 30);
    await settle(page);
    expect(await active(page)).toBe('stats');
  });

  test('a page that scrolls inside: read to the end, keep pushing in the same swipe → next page', async ({ page }) => {
    await page.goto('/#gallery');
    await page.waitForLoadState('networkidle');
    const scroller = page.locator('#gallery [data-scroll]');
    const before = await scroller.evaluate((el) => el.scrollHeight - el.clientHeight);
    expect(before).toBeGreaterThan(100); // it does scroll on a phone
    // short swipe mid-page: just scrolls
    await swipe(page, 500, 380);
    await settle(page);
    expect(await active(page)).toBe('gallery');
    // scroll to the bottom, then one more swipe turns the page
    await scroller.evaluate((el) => { el.scrollTop = el.scrollHeight; });
    await page.waitForTimeout(400);
    await swipe(page, 500, 410);
    await settle(page);
    expect(await active(page)).toBe('training');
  });

  test('back cover → "back to the cover" button', async ({ page }) => {
    await page.goto('/#camp-ad');
    await page.waitForLoadState('networkidle');
    const btn = page.getByRole('link', { name: '↑ Back to the cover', exact: true });
    await expect(btn).toBeVisible();
    const box = (await btn.boundingBox())!;
    expect(box.y + box.height).toBeLessThanOrEqual(664);
    await btn.tap();
    await settle(page);
    expect(await active(page)).toBe('cover');
  });
});

test('phone swipes always use the paper crumple, and start promptly', async ({ page }) => {
  await page.goto('/#cover');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);
  await page.evaluate(() => {
    const w = window as any; w.__t = { kinds: [], css: false };
    const loop = () => {
      if (document.querySelector('.css-crumple')) w.__t.css = true;
      if (document.querySelector('.paper-canvas.is-on') && w.__t.kinds.at(-1) !== 'on') w.__t.kinds.push('on');
      if (!document.querySelector('.paper-canvas.is-on') && w.__t.kinds.at(-1) === 'on') w.__t.kinds.push('off');
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  });
  await swipe(page, 500, 400);
  await page.waitForFunction(() => document.querySelector('#stats.is-active'), null, { timeout: 15000 });
  const first = await page.evaluate(() => {
    const t = performance.getEntriesByName('turn:start')[0]?.startTime ?? 0;
    const m = performance.getEntriesByName('crumple:move-start')[0]?.startTime ?? 1e9;
    return Math.round(m - t);
  });
  console.log(`first swipe: turn → paper moving ${first} ms`);
  expect(first).toBeLessThan(2000); // the engine may still be loading on the very first swipe
  await settle(page);
  await page.waitForTimeout(4500); // the stats page settles, its neighbours get copied
  await page.locator('#stats [data-scroll]').evaluate((el) => { el.scrollTop = el.scrollHeight; });
  await page.waitForTimeout(400);
  await swipe(page, 500, 400);
  await page.waitForFunction(() => document.querySelector('#gallery.is-active'), null, { timeout: 15000 });
  const second = await page.evaluate(() => {
    const t = performance.getEntriesByName('turn:start').at(-1)!.startTime;
    const m = performance.getEntriesByName('crumple:move-start').at(-1)!.startTime;
    return Math.round(m - t);
  });
  console.log(`second swipe: turn → paper moving ${second} ms`);
  expect(second).toBeLessThan(400);
  const t = await page.evaluate(() => (window as any).__t);
  expect(t.css).toBe(false); // never the CSS fallback on a device with WebGL
  expect(t.kinds.filter((k: string) => k === 'on').length).toBe(2);
});

test('/camp "back to top"', async ({ page }) => {
  await page.goto('/camp');
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  const btn = page.getByRole('link', { name: /back to top/i });
  await btn.scrollIntoViewIfNeeded();
  await btn.tap();
  await page.waitForFunction(() => window.scrollY < 5, null, { timeout: 5000 });
});
