// Lighthouse (mobile) for / and /camp against a running server, using Playwright's Chromium.
//   node scripts/lighthouse.mjs [baseUrl]
import { chromium } from '@playwright/test';
import lighthouse from 'lighthouse';
import fs from 'node:fs';
const base = process.argv[2] ?? 'http://localhost:4322';
const browser = await chromium.launch({ args: ['--remote-debugging-port=9333'] });
fs.mkdirSync('shots', { recursive: true });
for (const path of ['/', '/camp']) {
  const out = `shots/lh${path === '/' ? '-home' : path.replace('/', '-')}.json`;
  const res = await lighthouse(base + path, { port: 9333, output: 'json', logLevel: 'error', onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'] });
  fs.writeFileSync(out, res.report);
  const r = JSON.parse(fs.readFileSync(out, 'utf8'));
  console.log(`\n${path}: ` + Object.entries(r.categories).map(([k, v]) => `${k} ${Math.round(v.score * 100)}`).join(' · '));
  console.log('  ' + ['first-contentful-paint', 'largest-contentful-paint', 'total-blocking-time', 'cumulative-layout-shift', 'speed-index'].map((id) => `${id.replace(/-/g, ' ')} ${r.audits[id].displayValue}`).join(' · '));
  const bad = Object.values(r.audits).filter((a) => a.score !== null && a.score < 0.9 && !['informative', 'notApplicable', 'manual'].includes(a.scoreDisplayMode));
  for (const a of bad) console.log(`  ✗ ${a.id}: ${a.displayValue ?? a.title}`);
}
await browser.close();
