import { defineConfig } from 'astro/config';

export default defineConfig({
  // TODO: set the production domain before deploying (used for canonical + OG URLs)
  site: 'https://ilia-baskakov.vercel.app',
  output: 'static',
  trailingSlash: 'never',
  // inline the CSS: no render-blocking stylesheet requests
  build: { format: 'file', inlineStylesheets: 'always' },
  devToolbar: { enabled: false },
});
