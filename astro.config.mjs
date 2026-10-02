import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://bascamp.world',
  output: 'static',
  trailingSlash: 'never',
  // inline the CSS: no render-blocking stylesheet requests
  build: { format: 'file', inlineStylesheets: 'always' },
  devToolbar: { enabled: false },
});
