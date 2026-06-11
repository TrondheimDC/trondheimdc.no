import { defineConfig } from '@playwright/test';

const isCI = !!process.env.CI;

// The new Eleventy site builds to ../src/_site. Tests run against that output.
export default defineConfig({
  testDir: '.',
  testIgnore: ['_site/**', 'node_modules/**'],
  timeout: 30000,
  retries: isCI ? 2 : 0,
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:4000',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'npx serve ../src/_site -l 4000',
    url: 'http://localhost:4000',
    reuseExistingServer: !isCI,
    timeout: 120000,
  },
  reporter: [['list'], ['html', { open: 'never' }]],
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
});
