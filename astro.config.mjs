import { defineConfig } from 'astro/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// The paper crumple (three.js and all, ~150 KB gzipped) is set up after the first paint. Its file is
// prefetched once the page has loaded (magazine.ts), so a quick first swipe on a phone network doesn't wait
// for the download. The chunk's name has a content hash, so the page learns it from a meta tag added here.
const prefetchCrumple = {
  name: 'prefetch-crumple',
  hooks: {
    'astro:build:done': ({ dir }) => {
      const root = fileURLToPath(dir);
      const chunk = fs.readdirSync(path.join(root, '_astro')).find((f) => /^crumple\.[\w-]+\.js$/.test(f));
      const file = path.join(root, 'index.html');
      if (!chunk || !fs.existsSync(file)) return;
      const html = fs.readFileSync(file, 'utf8');
      fs.writeFileSync(file, html.replace('</head>', `<meta name="crumple-chunk" content="/_astro/${chunk}"></head>`));
    },
  },
};

export default defineConfig({
  site: 'https://bascamp.world',
  output: 'static',
  trailingSlash: 'never',
  // inline the CSS: no render-blocking stylesheet requests
  build: { format: 'file', inlineStylesheets: 'always' },
  devToolbar: { enabled: false },
  integrations: [prefetchCrumple],
  // The rider area talks to Supabase from the browser. Vercel's Supabase integration names the variables
  // SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY (no PUBLIC_ prefix), so they are passed through here. Both are
  // public by design: every table is behind row-level security. Locally they come from .env.local.
  vite: {
    define: {
      'import.meta.env.PUBLIC_SUPABASE_URL': JSON.stringify(env('SUPABASE_URL')),
      'import.meta.env.PUBLIC_SUPABASE_KEY': JSON.stringify(env('SUPABASE_PUBLISHABLE_KEY') || env('SUPABASE_ANON_KEY')),
    },
  },
});

function env(name) {
  if (process.env[name]) return process.env[name];
  for (const file of ['.env.local', '.env']) {
    if (!fs.existsSync(file)) continue;
    // [ \t] not \s: an empty value must not swallow the newline and read the next line
    const m = fs.readFileSync(file, 'utf8').match(new RegExp(`^[ \\t]*${name}[ \\t]*=[ \\t]*"?([^"\\r\\n]*)"?`, 'm'));
    if (m && m[1] && m[1] !== '[SENSITIVE]') return m[1];
  }
  return '';
}
