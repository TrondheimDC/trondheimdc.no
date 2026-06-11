import { test, expect } from '@playwright/test';

// Norwegian pages
const norwegianPages = [
  { path: '/', name: 'Home' },
  { path: '/about/', name: 'About' },
  { path: '/cfp/', name: 'CFP' },
  { path: '/coc/', name: 'Code of Conduct' },
  { path: '/courses/', name: 'Courses' },
  { path: '/info/', name: 'Info' },
  { path: '/partner/', name: 'Partner' },
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
  { path: '/en/partner/', name: 'Partner' },
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
    await expect(page.locator('text=Våre partnere')).toBeVisible();
  });

  test('Home page has ticket button', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=Kjøp billetter').first()).toBeVisible();
  });

  test('CFP page shows deadline passed', async ({ page }) => {
    await page.goto('/cfp/');
    await expect(page.locator('text=stengt')).toBeVisible();
  });

  test('Partner page has CTA button', async ({ page }) => {
    await page.goto('/partner/');
    await expect(page.locator('text=Bli partner').first()).toBeVisible();
  });

  test('Partner page has contact email', async ({ page }) => {
    await page.goto('/partner/');
    await expect(page.locator('a[href="mailto:partner@trondheimdc.no"]').first()).toBeVisible();
  });
});

test.describe('English Pages - Content Check', () => {
  test('Home page has correct title', async ({ page }) => {
    await page.goto('/en/');
    await expect(page).toHaveTitle(/TDC/);
  });

  test('Home page has partner section', async ({ page }) => {
    await page.goto('/en/');
    await expect(page.locator('text=Our partners:')).toBeVisible();
  });

  test('Home page has ticket button', async ({ page }) => {
    await page.goto('/en/');
    await expect(page.locator('text=Buy tickets').first()).toBeVisible();
  });

  test('CFP page shows deadline passed', async ({ page }) => {
    await page.goto('/en/cfp/');
    await expect(page.locator('text=closed')).toBeVisible();
  });

  test('Partner page has CTA button', async ({ page }) => {
    await page.goto('/en/partner/');
    await expect(page.locator('text=Become a partner').first()).toBeVisible();
  });

  test('Partner page has contact email', async ({ page }) => {
    await page.goto('/en/partner/');
    await expect(page.locator('a[href="mailto:partner@trondheimdc.no"]').first()).toBeVisible();
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

  test('Tickets menu item exists in Norwegian', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('nav a[href*="tickets"]').first()).toBeVisible();
  });

  test('Tickets menu item exists in English', async ({ page }) => {
    await page.goto('/en/');
    await expect(page.locator('nav a[href*="tickets"]').first()).toBeVisible();
  });
});
