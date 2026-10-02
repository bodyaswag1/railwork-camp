// Contrast check (npm run check:contrast, against a running server; BASE_URL defaults to the preview).
// Rules from the brief: red (Park Signal) text only on light paper; on dark pages red is decoration only;
// pink (Goggle Tint) never as text on light paper. Every visible text element must meet WCAG AA
// (4.5:1, or 3:1 for large text) against its page's base colour. Decorative marks (aria-hidden) are skipped.
import { chromium } from '@playwright/test';

const base = process.env.BASE_URL ?? 'http://localhost:4322';
const lum = ([r, g, b]) => {
  const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
const RED = [186, 20, 34], PINK = [255, 148, 227];
// the paper is Airbag Ice under a yellowing layer; checking against the darker of the two is the safe side
const LIGHT = [[225, 239, 250], [221, 230, 228], [222, 228, 225]];
const DARK = [[16, 19, 20]];
const same = (a, b) => a.every((v, i) => Math.abs(v - b[i]) < 3);

const browser = await chromium.launch();
const failures = [];
let checked = 0;
for (const [path, ids] of [['/', ['cover', 'stats', 'gallery', 'training', 'camp-ad']], ['/camp', [null]]]) {
  for (const id of ids) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    await page.goto(`${base}${path}${id ? `#${id}` : ''}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    const items = await page.evaluate((id) => {
      const scope = id ? document.getElementById(id) : document.querySelector('main');
      const rgb = (s) => (s.match(/\d+(\.\d+)?/g) || []).slice(0, 4).map(Number);
      const out = [];
      const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
      const seen = new Set();
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        const el = n.parentElement;
        if (!el || seen.has(el) || !n.textContent.trim()) continue;
        seen.add(el);
        if (el.closest('[aria-hidden="true"], .sr-only, script, style, option')) continue;
        const cs = getComputedStyle(el);
        if (cs.visibility === 'hidden' || cs.display === 'none') continue;
        // nearest ancestor with its own solid background decides what the text sits on
        let bg = null, tone = null;
        for (let a = el; a; a = a.parentElement) {
          const b = rgb(getComputedStyle(a).backgroundColor);
          if (b.length === 3 || (b.length === 4 && b[3] > 0.9)) { bg = b.slice(0, 3); break; }
          if (a.dataset?.tone) { tone = a.dataset.tone; }
        }
        const sec = el.closest('[data-tone], .sec, .hero, .strip');
        if (!tone && sec) tone = sec.dataset?.tone ?? (sec.classList.contains('dk') || sec.classList.contains('hero') ? 'D' : 'L');
        const size = parseFloat(cs.fontSize), weight = parseInt(cs.fontWeight, 10);
        out.push({ text: n.textContent.trim().slice(0, 40), color: rgb(cs.color).slice(0, 3), bg, tone, large: size >= 24 || (size >= 18.66 && weight >= 700) });
      }
      return out;
    }, id);
    for (const it of items) {
      checked++;
      const darkBg = it.bg ? lum(it.bg) < 0.2 : it.tone === 'D';
      const bgs = it.bg ? [it.bg] : darkBg ? DARK : LIGHT;
      const where = `${path}${id ? '#' + id : ''} "${it.text}"`;
      if (same(it.color, RED) && darkBg) failures.push(`${where}: red text on a dark background (red is decoration only there)`);
      if (same(it.color, PINK) && !darkBg) failures.push(`${where}: pink text on light paper`);
      const worst = Math.min(...bgs.map((b) => ratio(it.color, b)));
      const need = it.large ? 3 : 4.5;
      if (worst < need) failures.push(`${where}: ${worst.toFixed(2)}:1 < ${need}:1 (rgb ${it.color} on ${bgs.map((b) => `rgb ${b}`).join(' / ')})`);
    }
    await page.close();
  }
}
await browser.close();
console.log(`checked ${checked} text elements`);
if (failures.length) { console.log(failures.join('\n')); process.exit(1); }
console.log('contrast OK');
