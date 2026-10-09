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
});
