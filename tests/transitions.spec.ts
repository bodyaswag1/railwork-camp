// Real page turns through each transition flavour: WebGL crumple, CSS fallback (no WebGL), reduced motion.
import { test, expect, chromium, type Page } from '@playwright/test';
import fs from 'node:fs';

fs.mkdirSync('shots/transitions', { recursive: true });

/** Press ↓ and sample the page while it turns. */
async function turn(page: Page, shotPrefix: string) {
  await page.evaluate(() => {
    (window as any).__seen = { canvas: false, stage: false, cssPaper: false, t0: 0, tEnd: 0 };
    addEventListener('keydown', () => { (window as any).__seen.t0 = performance.now(); }, { capture: true, once: true });
    const loop = () => {
      const s = (window as any).__seen;
      if (!s.tEnd && s.t0 && document.querySelector('#ilia.is-active')) s.tEnd = performance.now();
      if (document.querySelector('.paper-canvas.is-on')) s.canvas = true;
      if (document.querySelector('.stage.is-on')) s.stage = true;
      if (document.querySelector('.css-crumple')) s.cssPaper = true;
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  });
  const t0 = Date.now();
  await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(450);
  await page.screenshot({ path: `${shotPrefix}-mid.png` });
  await page.waitForFunction(() => location.hash === '#ilia', null, { timeout: 15000 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${shotPrefix}-landed.png` });
  const seen = await page.evaluate(() => (window as any).__seen);
  const ms = Math.round(seen.tEnd - seen.t0); // key press → new page live, measured in the page
  void t0;
  const state = await page.evaluate(() => ({
    active: document.querySelector('.page.is-active')?.id,
    focused: document.activeElement?.id,
    live: document.querySelector('[data-live]')?.textContent,
    counter: document.querySelector('[data-counter]')?.textContent,
    canvasOff: !document.querySelector('.paper-canvas.is-on'),
    stageOff: !document.querySelector('.stage.is-on'),
  }));
  return { ms, seen, state };
}

const landedOk = (state: Awaited<ReturnType<typeof turn>>['state']) => {
  expect(state.active).toBe('ilia');
  expect(state.focused).toBe('h-ilia');
  expect(state.live).toBe('Page 2 of 6: The rider');
  expect(state.counter).toBe('02/06');
  expect(state.canvasOff).toBe(true);
  expect(state.stageOff).toBe(true);
};

test.use({ viewport: { width: 1440, height: 900 } });

test('WebGL crumple', async ({ page }) => {
  await page.goto('/#cover');
  await page.waitForLoadState('networkidle');
  await page.mouse.move(200, 200); // the engine loads on the first sign of a reader
  await page.waitForTimeout(6000); // engine loaded, snapshots warm
  const r = await turn(page, 'shots/transitions/webgl');
  expect(r.seen.canvas).toBe(true);
  expect(r.seen.stage).toBe(true);
  expect(r.ms).toBeLessThan(2500);
  landedOk(r.state);
});

test('no WebGL → CSS fallback on the black stage', async ({ baseURL }) => {
  const browser = await chromium.launch({ args: ['--disable-webgl', '--disable-webgl2', '--disable-3d-apis'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${baseURL}/#cover`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000);
  const r = await turn(page, 'shots/transitions/css');
  expect(r.seen.canvas).toBe(false);
  expect(r.seen.stage).toBe(true);
  expect(r.seen.cssPaper).toBe(true);
  landedOk(r.state);
  expect(errors).toEqual([]);
  await browser.close();
});

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });
  test('200 ms crossfade, static marks', async ({ page }) => {
    await page.goto('/#cover');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    const r = await turn(page, 'shots/transitions/reduced');
    expect(r.seen.canvas).toBe(false);
    expect(r.seen.stage).toBe(false);
    expect(r.ms).toBeLessThan(900);
    landedOk(r.state);
    // marks are there without drawing on
    const hidden = await page.evaluate(() => Array.from(document.querySelectorAll('#ilia [data-draw], #ilia [data-ink]'))
      .filter((el) => getComputedStyle(el).visibility === 'hidden').length);
    expect(hidden).toBe(0);
  });
});
