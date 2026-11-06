// Reads .env.local (then .env) into process.env without overriding what is already set. Shared by the
// rider-area scripts so they run with plain `node`.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// the scripts work from the project root wherever they are started
process.chdir(fileURLToPath(new URL('../..', import.meta.url)));

for (const file of ['.env.local', '.env']) {
  const p = path.resolve(file);
  if (!fs.existsSync(p)) continue;
  for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m || process.env[m[1]]) continue;
    const v = m[2].replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1');
    if (v && v !== '[SENSITIVE]') process.env[m[1]] = v;
  }
}

export function need(...names) {
  const missing = names.filter((n) => !process.env[n]);
  if (missing.length) {
    console.error(`Missing ${missing.join(', ')}. Fill them in .env.local (see the comments there).`);
    process.exit(2);
  }
}
