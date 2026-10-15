// /camp layout check at a phone and a desktop size: text or controls poking out sideways (the page clips
// overflow, so it wouldn't scroll — it would just cut words off), and where the sticky ticket shows.
// node scripts/camp-check.mjs <base>
import { chromium } from '@playwright/test';

const base = process.argv[2] ?? 'http://localhost:4323';
const browser = await chromium.launch();
let bad = 0;
for (const vp of [{ width: 360, height: 740 }, { width: 390, height: 844 }, { width: 1024, height: 768 }, { width: 1440, height: 900 }]) {
  const page = await browser.newPage({ viewport: vp, isMobile: vp.width < 900, hasTouch: vp.width < 900 });
  await page.goto(`${base}/camp`, { waitUntil: 'networkidle' });
  const out = await page.evaluate(() => {
    const W = innerWidth;
    return Array.from(document.querySelectorAll('main h1, main h2, main h3, main p, main li, main a, main button, main dd, main dt, main summary, main label, main input, footer a'))
      .filter((el) => !el.closest('[aria-hidden="true"], .sr-only, [data-strip]'))
      .map((el) => ({ el: `${el.tagName.toLowerCase()}.${el.className}`.slice(0, 50), t: (el.textContent ?? '').trim().slice(0, 30), r: el.getBoundingClientRect() }))
      .filter(({ r }) => r.width > 0 && (r.right > W + 1 || r.left < -1))
      .map(({ el, t, r }) => `${el} "${t}" [${Math.round(r.left)}..${Math.round(r.right)}]`);
  });
  const ticket = await page.evaluate(async () => {
    const t = document.querySelector('[data-sticky]');
    const on = () => t?.classList.contains('is-on');
    const r = [on()];
    scrollTo({ top: innerHeight * 2, behavior: "instant" }); await new Promise((f) => setTimeout(f, 1500)); r.push(on());
    document.querySelector('#apply')?.scrollIntoView({ behavior: "instant" }); await new Promise((f) => setTimeout(f, 1500)); r.push(on());
    return r;
  });
  console.log(`${vp.width}×${vp.height}: ${out.length} sticking out; ticket at top/middle/form: ${ticket.join('/')}`);
  out.forEach((o) => console.log('   ', o));
  bad += out.length;
  await page.close();
}
await browser.close();
process.exit(bad ? 1 : 0);
