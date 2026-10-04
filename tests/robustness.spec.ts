// Failure modes found in review: none of them may freeze navigation or put the wrong picture on the paper.
import { test, expect, type Page } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });

async function swipe(page: Page, y0 = 600, y1 = 470) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 200, y: y0 }] });
  for (let i = 1; i <= 10; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 200, y: y0 + ((y1 - y0) * i) / 10 }] });
    await page.waitForTimeout(16);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
}
const activeId = (page: Page) => page.evaluate(() => document.querySelector('.page.is-active')?.id);
const unhandled = (page: Page) => {
  const errs: string[] = [];
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('console', (m) => { if (/Uncaught|Unhandled/i.test(m.text())) errs.push(m.text()); });
  return errs;
};
const meanDiff = async (a: Buffer, b: Buffer) => {
  const sharp = (await import('sharp')).default;
  const A = await sharp(a).removeAlpha().raw().toBuffer(), B = await sharp(b).removeAlpha().raw().toBuffer();
  let sum = 0, off = 0;
  for (let i = 0; i < A.length; i++) { const d = Math.abs(A[i] - B[i]); sum += d; if (d > 40) off++; }
  return { mean: sum / A.length, off: off / A.length };
};

for (const file of ['folds.worker', 'paper.worker', '_astro/worker.']) {
  test(`a worker that fails to load (${file}) never freezes page turns`, async ({ page }) => {
    await page.route((u) => u.pathname.includes(file), (r) => r.abort());
    await page.goto('/#cover');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3500);
    for (const want of ['ilia', 'cover']) {
      await page.waitForTimeout(600); // past the post-landing lock that swallows trackpad inertia
      await page.keyboard.press(want === 'ilia' ? 'ArrowDown' : 'ArrowUp');
      await page.waitForFunction((w) => document.querySelector('.page.is-active')?.id === w && !document.querySelector('.stage.is-on, .paper-canvas.is-on, .page.is-next'), want, { timeout: 15000 });
    }
    expect(await activeId(page)).toBe('cover');
  });
}

test('a lost WebGL context gives a fade, not a blank sheet, and the paper comes back after', async ({ page }) => {
  await page.goto('/#cover');
  await page.waitForLoadState('networkidle');
  await page.mouse.move(100, 100);
  await page.waitForTimeout(5000);
  const ext = await page.evaluateHandle(() => (document.querySelector('[data-paper-canvas]') as HTMLCanvasElement).getContext('webgl2')!.getExtension('WEBGL_lose_context'));
  await page.evaluate((x) => x!.loseContext(), ext);
  await page.evaluate(() => { (window as any).__canvasSeen = false; const l = () => { if (document.querySelector('.paper-canvas.is-on')) (window as any).__canvasSeen = true; requestAnimationFrame(l); }; requestAnimationFrame(l); });
  await page.keyboard.press('ArrowDown');
  await page.waitForFunction(() => document.querySelector('#ilia.is-active') && !document.querySelector('.page.is-moving, .page.is-next'), null, { timeout: 15000 });
  expect(await page.evaluate(() => (window as any).__canvasSeen)).toBe(false);
  await page.evaluate((x) => x!.restoreContext(), ext);
  await page.waitForTimeout(5500);
  await page.evaluate(() => { (window as any).__canvasSeen = false; });
  await page.locator('#ilia [data-scroll]').evaluate((el) => { el.scrollTop = el.scrollHeight; });
  await page.waitForTimeout(400);
  await page.keyboard.press('ArrowDown');
  await page.waitForFunction(() => document.querySelector('#coaching.is-active') && !document.querySelector('.paper-canvas.is-on'), null, { timeout: 15000 });
  expect(await page.evaluate(() => (window as any).__canvasSeen)).toBe(true);
});

test('a copy of a page shows its photo pile with the print the reader left on top', async ({ page }) => {
  await page.goto('/?debug#ilia');
  await page.waitForFunction(() => !!(window as any).__crumple);
  await page.addStyleTag({ content: '.lil-gui{display:none!important}' });
  await page.waitForTimeout(3000); // marks drawn
  const pile = page.locator('#ilia [data-pile]');
  await pile.focus();
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(700);
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(3000); // prints settled, the page copied again once quiet
  expect(await page.locator('#ilia [data-car-count]').textContent()).toMatch(/^03\//);
  const box = (await page.locator('#ilia .pics__stack').boundingBox())!;
  const x = Math.max(0, box.x), y = Math.max(0, box.y);
  const clip = { x, y, width: Math.min(box.width, 390 - x), height: Math.min(box.height, 844 - y) };
  const dom = await page.screenshot({ clip });
  await page.evaluate(() => (window as any).__crumple.seek(0, { to: 2, seed: 5 }));
  expect(await page.evaluate(() => !!document.querySelector('.paper-canvas.is-on'))).toBe(true);
  const cv = await page.screenshot({ clip });
  const { mean } = await meanDiff(dom, cv);
  console.log(`photo pile on print 3, canvas vs page: mean diff ${mean.toFixed(2)}`);
  expect(mean).toBeLessThan(6);
});

test('a swipe made before the fonts arrive still leaves a copy with the marks', async ({ page }) => {
  // hold the web fonts back for 4 s
  await page.route(/\.woff2$/, async (r) => { await new Promise((x) => setTimeout(x, 4000)); await r.continue(); });
  await page.goto('/?debug#cover');
  await page.waitForFunction(() => !!(window as any).__crumple, null, { timeout: 30000 });
  await page.keyboard.press('ArrowDown');
  await page.waitForFunction(() => document.querySelector('#ilia.is-active') && !document.querySelector('.paper-canvas.is-on'), null, { timeout: 30000 });
  // the cached landed copy of the cover must show its marks: after a turn back, the canvas at p=0
  // matches the page
  await page.waitForTimeout(6000);
  await page.keyboard.press('ArrowUp');
  await page.waitForFunction(() => document.querySelector('#cover.is-active') && !document.querySelector('.paper-canvas.is-on'), null, { timeout: 30000 });
  await page.waitForTimeout(5000);
  const dom = await page.screenshot();
  await page.evaluate(() => (window as any).__crumple.seek(0, { to: 1, seed: 3 }));
  expect(await page.evaluate(() => !!document.querySelector('.paper-canvas.is-on'))).toBe(true);
  const cv = await page.screenshot();
  const { off } = await meanDiff(dom, cv);
  console.log(`cover p=0 vs page: ${(100 * off).toFixed(2)}% channels off by >40`);
  expect(off).toBeLessThan(0.02);
});

test('back pressed twice quickly ends with the page and the address bar agreeing', async ({ page }) => {
  await page.goto('/#cover');
  await page.waitForLoadState('networkidle');
  await page.mouse.move(100, 100);
  await page.waitForTimeout(4000);
  for (const t of ['ilia', 'coaching']) {
    if (t === 'coaching') await page.locator('#ilia [data-scroll]').evaluate((el) => { el.scrollTop = el.scrollHeight; });
    await page.keyboard.press('ArrowDown');
    await page.waitForFunction((w) => document.querySelector(`#${w}.is-active`) && !document.querySelector('.paper-canvas.is-on'), t, { timeout: 15000 });
    await page.waitForTimeout(800);
  }
  await page.goBack({ waitUntil: 'commit' });
  await page.waitForTimeout(150);
  await page.goBack({ waitUntil: 'commit' });
  await page.waitForFunction(() => location.hash === '#cover' && document.querySelector('#cover.is-active') && !document.querySelector('.paper-canvas.is-on, .page.is-next'), null, { timeout: 20000 });
  expect(await activeId(page)).toBe('cover');
});

test('reading and turning pages raises no unhandled errors', async ({ page }) => {
  const errs = unhandled(page);
  await page.goto('/#cover');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3500);
  await swipe(page);
  await page.waitForFunction(() => document.querySelector('#ilia.is-active') && !document.querySelector('.paper-canvas.is-on'), null, { timeout: 15000 });
  // touch around while background copies run, so some give way
  for (let i = 0; i < 6; i++) { await page.waitForTimeout(900); await page.mouse.move(50 + i * 10, 300); await page.touchscreen.tap(20, 700); }
  await page.waitForTimeout(1500);
  expect(errs).toEqual([]);
});
