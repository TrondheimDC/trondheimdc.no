import { test, expect } from '@playwright/test';

// Norwegian pages
const norwegianPages = [
  { path: '/', name: 'Home' },
  { path: '/about/', name: 'About' },
  { path: '/cfp/', name: 'CFP' },
  { path: '/coc/', name: 'Code of Conduct' },
  { path: '/courses/', name: 'Courses' },
  { path: '/info/', name: 'Info' },
  { path: '/program/', name: 'Program' },
  { path: '/speakers/', name: 'Speakers' },
  { path: '/tickets/', name: 'Tickets' },
  { path: '/vol/', name: 'Volunteer' },
];

// English pages
const englishPages = [
  { path: '/en/', name: 'Home' },
  { path: '/en/about/', name: 'About' },
  { path: '/en/cfp/', name: 'CFP' },
  { path: '/en/coc/', name: 'Code of Conduct' },
  { path: '/en/courses/', name: 'Courses' },
  { path: '/en/info/', name: 'Info' },
  { path: '/en/program/', name: 'Program' },
  { path: '/en/speakers/', name: 'Speakers' },
  { path: '/en/tickets/', name: 'Tickets' },
  { path: '/en/vol/', name: 'Volunteer' },
];

test.describe('Norwegian Pages - Status 200', () => {
  for (const page of norwegianPages) {
    test(`${page.name} (${page.path}) should return 200`, async ({ request }) => {
      const response = await request.get(page.path);
      expect(response.status()).toBe(200);
    });
  }
});

test.describe('English Pages - Status 200', () => {
  for (const page of englishPages) {
    test(`${page.name} (${page.path}) should return 200`, async ({ request }) => {
      const response = await request.get(page.path);
      expect(response.status()).toBe(200);
    });
  }
});

test.describe('Norwegian Pages - Content Check', () => {
  test('Home page has correct title', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/TDC/);
  });

  test('Home page has partner section', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=Takk til våre partnere i 2025')).toBeVisible();
  });

  test('Home page has CFP button', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=Send inn ditt foredrag')).toBeVisible();
  });

  test('CFP page links to Sessionize', async ({ page }) => {
    await page.goto('/cfp/');
    const sessionizeLink = page.locator('a[href*="sessionize.com/tdc-2026"]');
    await expect(sessionizeLink).toBeVisible();
  });
});

test.describe('English Pages - Content Check', () => {
  test('Home page has correct title', async ({ page }) => {
    await page.goto('/en/');
    await expect(page).toHaveTitle(/TDC/);
  });

  test('Home page has partner section', async ({ page }) => {
    await page.goto('/en/');
    await expect(page.locator('text=Thanks to our partners in 2025')).toBeVisible();
  });

  test('Home page has CFP button', async ({ page }) => {
    await page.goto('/en/');
    await expect(page.locator('text=Send in your talk')).toBeVisible();
  });

  test('CFP page links to Sessionize', async ({ page }) => {
    await page.goto('/en/cfp/');
    const sessionizeLink = page.locator('a[href*="sessionize.com/tdc-2026"]');
    await expect(sessionizeLink).toBeVisible();
  });
});

test.describe('Navigation', () => {
  test('Can switch from Norwegian to English', async ({ page }) => {
    await page.goto('/');
    await page.click('a:has-text("EN")');
    await expect(page).toHaveURL(/\/en\//);
  });

  test('Can switch from English to Norwegian', async ({ page }) => {
    await page.goto('/en/');
    await page.click('a:has-text("NO")');
    await expect(page).toHaveURL(/^(?!.*\/en\/)/);
  });

  test('CFP menu item exists in Norwegian', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('nav a[href="/cfp/"]')).toBeVisible();
  });

  test('CFP menu item exists in English', async ({ page }) => {
    await page.goto('/en/');
    await expect(page.locator('nav a[href="/en/cfp/"]')).toBeVisible();
  });
});
