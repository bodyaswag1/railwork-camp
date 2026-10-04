// Phone gestures with real touch input (CDP Input.dispatchTouchEvent, so the browser scrolls natively).
import { test, expect, type Page } from '@playwright/test';

test.use({ viewport: { width: 390, height: 664 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });

/** One finger drag from (x0, y0) to (x1, y1) in `steps` moves (~16 ms apart), like a real swipe. */
async function drag(page: Page, x0: number, y0: number, x1: number, y1: number, steps = 12) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y: y0 }] });
  for (let i = 1; i <= steps; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 + ((x1 - x0) * i) / steps, y: y0 + ((y1 - y0) * i) / steps }] });
    await page.waitForTimeout(16);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
}
const swipe = (page: Page, y0: number, y1: number, steps = 12, x = 200) => drag(page, x, y0, x, y1, steps);
const active = (page: Page) => page.evaluate(() => document.querySelector('.page.is-active')?.id);
const settle = (page: Page) => page.waitForFunction(() => !document.querySelector('.stage.is-on, .paper-canvas.is-on'), null, { timeout: 15000 }).then(() => page.waitForTimeout(700));

test.describe('reduced motion (fast turns)', () => {
  test.use({ reducedMotion: 'reduce' });

  test('one short swipe turns one page, both ways', async ({ page }) => {
    await page.goto('/#cover');
    await page.waitForLoadState('networkidle');
    // the cover may scroll inside on a short phone: from its bottom, a swipe up turns the page
    await page.locator('#cover [data-scroll]').evaluate((el) => { el.scrollTop = el.scrollHeight; });
    await swipe(page, 500, 410); // 90 px
    await settle(page);
    expect(await active(page)).toBe('ilia');
    // at the top of the next page, a swipe down goes back
    await swipe(page, 200, 300);
    await settle(page);
    expect(await active(page)).toBe('cover');
  });

  test('a long swipe never skips a page', async ({ page }) => {
    await page.goto('/#ilia');
    await page.waitForLoadState('networkidle');
    await page.locator('#ilia [data-scroll]').evaluate((el) => { el.scrollTop = el.scrollHeight; });
    await swipe(page, 600, 60, 30);
    await settle(page);
    expect(await active(page)).toBe('coaching');
  });

  test('a page that scrolls inside: read to the end, keep pushing in the same swipe → next page', async ({ page }) => {
    await page.goto('/#train');
    await page.waitForLoadState('networkidle');
    const scroller = page.locator('#train [data-scroll]');
    const before = await scroller.evaluate((el) => el.scrollHeight - el.clientHeight);
    expect(before).toBeGreaterThan(100); // it does scroll on a short phone
    // short swipe mid-page: just scrolls
    await swipe(page, 500, 380);
    await settle(page);
    expect(await active(page)).toBe('train');
    // scroll to the bottom, then one more swipe turns the page
    await scroller.evaluate((el) => { el.scrollTop = el.scrollHeight; });
    await page.waitForTimeout(400);
    await swipe(page, 500, 410);
    await settle(page);
    expect(await active(page)).toBe('next-camp');
  });

  test('the photo pile: a sideways swipe sends the top print to the bottom, never turns the page', async ({ page }) => {
    await page.goto('/#ilia');
    await page.waitForLoadState('networkidle');
    const pile = page.locator('#ilia [data-pile]');
    const count = page.locator('#ilia [data-car-count]');
    const box = (await pile.boundingBox())!;
    const y = box.y + Math.min(box.height / 2, 200);
    const [l, r] = [box.x + 20, box.x + box.width - 20];
    await drag(page, r, y, l, y + 18); // mostly sideways, a little downward drift
    await page.waitForTimeout(900);
    expect(await active(page)).toBe('ilia');
    expect(await count.textContent()).toBe('02/06');
    // the print that was on top is now at the bottom of the pile
    expect(await page.locator('#ilia [data-slide]').first().evaluate((el) => Number(getComputedStyle(el).zIndex))).toBe(1);
    // a swipe the other way brings it back
    await drag(page, l, y, r, y - 14);
    await page.waitForTimeout(900);
    expect(await count.textContent()).toBe('01/06');
    // a tap turns to the next print too
    await page.locator('#ilia [data-slide]').first().tap();
    await page.waitForTimeout(800);
    expect(await count.textContent()).toBe('02/06');
  });

  test('a vertical swipe on a carousel still turns the page', async ({ page }) => {
    await page.goto('/#progress');
    await page.waitForLoadState('networkidle');
    await page.locator('#progress [data-scroll]').evaluate((el) => { el.scrollTop = el.scrollHeight; });
    await page.waitForTimeout(300);
    const b2 = (await page.locator('#progress [data-car-viewport]').boundingBox())!;
    const yy = Math.max(120, Math.min(600, b2.y + b2.height - 20));
    await swipe(page, yy, yy - 90, 12, 200);
    await settle(page);
    expect(await active(page)).toBe('train');
  });

  test('back cover → "back to the cover" button', async ({ page }) => {
    await page.goto('/#next-level');
    await page.waitForLoadState('networkidle');
    const btn = page.getByRole('link', { name: '↑ Back to the cover', exact: true });
    await btn.scrollIntoViewIfNeeded();
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
  await page.locator('#cover [data-scroll]').evaluate((el) => { el.scrollTop = el.scrollHeight; });
  await swipe(page, 500, 400);
  await page.waitForFunction(() => document.querySelector('#ilia.is-active'), null, { timeout: 15000 });
  const first = await page.evaluate(() => {
    const t = performance.getEntriesByName('turn:start')[0]?.startTime ?? 0;
    const m = performance.getEntriesByName('crumple:move-start')[0]?.startTime ?? 1e9;
    return Math.round(m - t);
  });
  console.log(`first swipe: turn → paper moving ${first} ms`);
  expect(first).toBeLessThan(2000); // the engine may still be loading on the very first swipe
  await settle(page);
  await page.waitForTimeout(4500); // the page settles, its neighbours get copied
  await page.locator('#ilia [data-scroll]').evaluate((el) => { el.scrollTop = el.scrollHeight; });
  await page.waitForTimeout(400);
  await swipe(page, 500, 400);
  await page.waitForFunction(() => document.querySelector('#coaching.is-active'), null, { timeout: 15000 });
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

test('/camp without a form backend: the application goes to Ilia as an Instagram DM, never a fake "sent"', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/camp');
  await page.waitForLoadState('networkidle');
  await page.fill('#f-name', 'Test Rider');
  await page.check('input[name=discipline][value=Snowboard]', { force: true });
  await page.fill('#f-contact', '@testrider');
  await page.check('input[name=level][value=first]', { force: true });
  await page.locator('form .submit').click({ force: true });
  await expect(page.locator('[data-handoff]')).toBeVisible();
  await expect(page.locator('[data-sent]')).toBeHidden();
  const msg = await page.locator('[data-handoff-msg]').inputValue();
  expect(msg).toContain('Name: Test Rider');
  expect(msg).toContain('Level: First time');
  expect(msg).not.toContain('750');
  const popup = page.waitForEvent('popup');
  await page.locator('[data-handoff-copy]').click({ force: true });
  expect((await popup).url()).toMatch(/ig\.me\/m\/baskakov74|instagram\.com/);
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('Name: Test Rider');
});
