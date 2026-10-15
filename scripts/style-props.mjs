// Which CSS properties do the magazine pages actually use? Page copies (modern-screenshot) normally compare
// all ~360 computed properties on every node; giving them only the ones that ever differ from a bare
// element's defaults makes each copy several times cheaper. Run after changing page CSS:
//   node scripts/style-props.mjs [baseUrl]   → writes src/scripts/crumple/style-props.ts
import { chromium } from '@playwright/test';
import fs from 'node:fs';

const base = process.argv[2] ?? 'http://localhost:4323';
const browser = await chromium.launch();
const names = new Set();
for (const [w, h, mobile] of [[390, 844, true], [768, 1024, true], [1440, 900, false]]) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, isMobile: mobile, hasTouch: mobile });
  await page.goto(`${base}/#cover`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  for (const look of ['pre', 'landed']) {
    const found = await page.evaluate((look) => {
      // every page rendered (as for a copy), in the look being measured
      document.querySelectorAll('[data-page]').forEach((p) => p.classList.add('is-snap'));
      if (look === 'landed') {
        const st = document.createElement('style'); st.id = '__landed';
        st.textContent = '[data-draw],[data-ink]{visibility:visible!important;clip-path:inset(0 0 0 0)!important;stroke-dasharray:10 0!important;stroke-dashoffset:0!important}[data-drop]{transform:translateY(0)!important;opacity:1!important;visibility:visible!important}';
        document.head.append(st);
      }
      const sandbox = document.createElement('iframe');
      sandbox.style.cssText = 'position:fixed;left:-9999px;width:10px;height:10px';
      document.body.append(sandbox);
      const sd = sandbox.contentDocument;
      sd.open(); sd.write('<!doctype html><html><body></body></html>'); sd.close();
      const defaults = new Map();
      const def = (el, pseudo) => {
        const isSvg = el instanceof SVGElement && el.tagName.toLowerCase() !== 'svg';
        const k = (isSvg ? 'svg:' : '') + el.tagName.toLowerCase() + (pseudo || '');
        if (defaults.has(k)) return defaults.get(k);
        let root, d;
        if (isSvg) { root = sd.createElementNS('http://www.w3.org/2000/svg', 'svg'); d = sd.createElementNS('http://www.w3.org/2000/svg', el.tagName); root.append(d); }
        else root = d = sd.createElement(el.tagName);
        d.textContent = ' ';
        sd.body.append(root);
        const cs = sandbox.contentWindow.getComputedStyle(d, pseudo || null);
        const m = new Map();
        for (let i = 0; i < cs.length; i++) m.set(cs.item(i), cs.getPropertyValue(cs.item(i)));
        root.remove();
        defaults.set(k, m);
        return m;
      };
      const out = new Set();
      const scan = (el, pseudo) => {
        const cs = getComputedStyle(el, pseudo || null);
        if (pseudo && (!cs.content || cs.content === 'none')) return;
        const d = def(el, pseudo);
        for (let i = 0; i < cs.length; i++) {
          const n = cs.item(i);
          if (cs.getPropertyValue(n) !== d.get(n)) out.add(n);
        }
      };
      document.querySelectorAll('[data-page], [data-page] *').forEach((el) => {
        if (!(el instanceof HTMLElement || el instanceof SVGElement)) return;
        scan(el); scan(el, '::before'); scan(el, '::after');
      });
      sandbox.remove();
      document.getElementById('__landed')?.remove();
      document.querySelectorAll('[data-page]').forEach((p) => p.classList.remove('is-snap'));
      return [...out];
    }, look);
    found.forEach((n) => names.add(n));
  }
  await page.close();
}
await browser.close();
// properties the site animates or toggles at runtime, whatever their value when measured
for (const n of ['visibility', 'opacity', 'transform', 'transform-origin', 'translate', 'rotate', 'scale', 'clip-path', 'stroke-dasharray', 'stroke-dashoffset', 'filter', 'mix-blend-mode', 'z-index', 'display', 'content-visibility', 'background-image', 'background-position', 'background-size']) names.add(n);
// never useful in a copy
for (const n of ['transition-property', 'transition-duration', 'transition-timing-function', 'transition-delay', 'cursor', 'pointer-events', 'user-select', '-webkit-user-select', 'touch-action', 'will-change', 'scroll-behavior', 'overscroll-behavior-x', 'overscroll-behavior-y', 'overscroll-behavior-block', 'overscroll-behavior-inline', 'caret-color', 'tab-size']) names.delete(n);
// resolved values are copied, so custom properties aren't needed; logical properties duplicate the
// physical ones on these left-to-right, horizontal pages
const logical = /^(inline-size|block-size|min-inline-size|max-inline-size|min-block-size|max-block-size|(border|margin|padding|inset|scroll-margin|scroll-padding)-(block|inline)(-(start|end))?(-(color|style|width))?|border-(start|end)-(start|end)-radius)$/;
const list = [...names].filter((n) => !n.startsWith('--') && !logical.test(n)).sort();
fs.writeFileSync('src/scripts/crumple/style-props.ts', `// Generated by scripts/style-props.mjs — the CSS properties the magazine pages actually use.
// Page copies only compare these (instead of every computed property). Re-run after changing page CSS.
export const styleProps: string[] = ${JSON.stringify(list, null, 0).replace(/","/g, '", "')};
`);
console.log(`${list.length} properties → src/scripts/crumple/style-props.ts`);
