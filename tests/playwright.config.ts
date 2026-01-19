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
  webServer: {
    command: isCI ? 'npx serve ../_site -l 4000' : 'bundle exec jekyll serve',
    cwd: '..',
    url: 'http://localhost:4000',
    reuseExistingServer: !isCI,
    timeout: 120000,
  },
  reporter: [['list'], ['html', { open: 'never' }]],
});
