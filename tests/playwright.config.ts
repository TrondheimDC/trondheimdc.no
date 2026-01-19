import { defineConfig } from '@playwright/test';

const isCI = !!process.env.CI;

export default defineConfig({
  testDir: '.',
  timeout: 30000,
  retries: isCI ? 2 : 0,
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:4000',
    trace: 'on-first-retry',
  },
  webServer: isCI ? {
    command: 'npx serve _site -l 4000',
    url: 'http://localhost:4000',
    reuseExistingServer: false,
    timeout: 120000,
  } : {
    command: 'bundle exec jekyll serve',
    cwd: '..',
    url: 'http://localhost:4000',
    reuseExistingServer: true,
    timeout: 120000,
  },
  reporter: [['list'], ['html', { open: 'never' }]],
});
