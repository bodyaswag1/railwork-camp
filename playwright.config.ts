import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests',
  timeout: 120_000,
  workers: 2,
  reporter: [['list']],
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:4322',
    launchOptions: { args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11'] },
  },
  webServer: process.env.BASE_URL ? undefined : {
    command: 'npm run build && npx astro preview --port 4322',
    port: 4322,
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
