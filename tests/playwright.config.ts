import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  timeout: 30000,
  retries: 0,
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:4000',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'jekyll serve',
    cwd: '..',
    url: 'http://localhost:4000',
    reuseExistingServer: !process.env.CI,
    timeout: 60000,
  },
  reporter: [['list'], ['html', { open: 'never' }]],
});
