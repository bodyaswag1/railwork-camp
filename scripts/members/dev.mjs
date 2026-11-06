// Local stand-in for Vercel: serves the built site (dist/, clean URLs) and runs api/**/*.ts handlers, with
// .env.local loaded. `vercel dev` cannot do this here because the Supabase variables are only on Preview and
// Production and are marked sensitive.
//   npm run build && node scripts/members/dev.mjs [port=4330]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import './env.mjs';

const port = Number(process.argv[2] || 4330);
// without RESEND_API_KEY mails are printed and also saved here (tests/members.spec.ts reads them)
process.env.MAIL_DROP_DIR ??= path.join(os.tmpdir(), 'bas-mail');
const root = path.resolve('dist');
const out = fs.mkdtempSync(path.join(os.tmpdir(), 'bas-api-'));
const entries = fs.readdirSync('api', { recursive: true }).filter((f) => String(f).endsWith('.ts')).map((f) => './api/' + String(f).replaceAll('\\', '/'));
await build({ absWorkingDir: process.cwd(), entryPoints: entries, outdir: out, outbase: 'api', bundle: true, platform: 'node', format: 'esm', packages: 'external', outExtension: { '.js': '.mjs' }, logLevel: 'warning' });
// let the bundles resolve node_modules from the project
fs.symlinkSync(path.resolve('node_modules'), path.join(out, 'node_modules'), 'junction');

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.woff2': 'font/woff2', '.json': 'application/json', '.pdf': 'application/pdf', '.ico': 'image/x-icon' };

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${port}`);
  try {
    if (url.pathname.startsWith('/api/')) {
      const file = path.join(out, url.pathname.slice(5) + '.mjs');
      if (!fs.existsSync(file)) { res.writeHead(404).end(); return; }
      const mod = await import(pathToFileURL(file).href);
      const handler = mod[req.method];
      if (!handler) { res.writeHead(405).end(); return; }
      const body = await new Promise((r) => { const c = []; req.on('data', (d) => c.push(d)); req.on('end', () => r(Buffer.concat(c))); });
      const request = new Request(url, { method: req.method, headers: { ...req.headers, 'x-forwarded-for': req.socket.remoteAddress }, body: ['GET', 'HEAD'].includes(req.method) ? undefined : body });
      const response = await handler(request);
      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(Buffer.from(await response.arrayBuffer()));
      console.log(req.method, url.pathname, response.status);
      return;
    }
    let p = path.join(root, decodeURIComponent(url.pathname));
    if (!p.startsWith(root)) { res.writeHead(403).end(); return; }
    if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = fs.existsSync(p + '.html') ? p + '.html' : path.join(p, 'index.html');
    else if (!fs.existsSync(p) && fs.existsSync(p + '.html')) p += '.html';
    if (!fs.existsSync(p)) { res.writeHead(404, { 'Content-Type': 'text/plain' }).end('not found'); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] ?? 'application/octet-stream' });
    fs.createReadStream(p).pipe(res);
  } catch (e) {
    console.error(e);
    res.writeHead(500).end(String(e));
  }
}).listen(port, () => console.log(`rider area on http://localhost:${port}`));
