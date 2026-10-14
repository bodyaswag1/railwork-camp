// Renders the two application emails (src/emails/apply.ts) with a sample rider into shots/mail/, as HTML
// and as phone + desktop screenshots. The screenshots take the images from public/mail/; the mails link them on bascamp.world.
//   npm run mail:preview [telegram|instagram]
import { build } from 'esbuild';
import { chromium } from '@playwright/test';
import fs from 'node:fs';

const chat = process.argv[2] ?? 'telegram';
const out = await build({ entryPoints: ['src/emails/apply.ts'], bundle: true, format: 'esm', platform: 'node', write: false });
const url = `data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`;
const { riderMail, iliaMail } = await import(url);

const sample = {
  name: 'Katya Smirnova', email: 'katya@example.com', chat, handle: chat === 'telegram' ? '@katya_rides' : '@katya.rides',
  discipline: 'Snowboard', level: 'beginner', msg: 'I want to finally land a 180 and try the park!', promo: '', camp: 'BAS CAMP Italy 2026',
};
fs.mkdirSync('shots/mail', { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined) });
for (const [name, mail] of [['rider', riderMail(sample)], ['ilia', iliaMail(sample, new Date('2026-10-14T15:42:00Z'))]]) {
  fs.writeFileSync(`shots/mail/${name}.html`, mail.html);
  fs.writeFileSync(`shots/mail/${name}.txt`, `Subject: ${mail.subject}\n\n${mail.text}`);
  for (const [w, tag] of [[390, 'phone'], [900, 'desktop']]) {
    const page = await browser.newPage({ viewport: { width: w, height: 800 }, deviceScaleFactor: 2 });
    fs.writeFileSync(`shots/mail/.${name}-local.html`, mail.html.replaceAll('https://bascamp.world/mail/', '../../public/mail/'));
    await page.goto(`file://${process.cwd()}/shots/mail/.${name}-local.html`, { waitUntil: 'networkidle' }).catch(() => {});
    await page.screenshot({ path: `shots/mail/${name}-${tag}.png`, fullPage: true });
    await page.close();
  }
  console.log(`${name}: ${mail.subject}`);
}
await browser.close();
