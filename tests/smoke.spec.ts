import { test, expect } from '@playwright/test';

// One-pager: both Norwegian and English are single pages with sections
const pages = [
  { path: '/', name: 'Norwegian Home', lang: 'no' },
  { path: '/en/', name: 'English Home', lang: 'en' },
];

test.describe('Pages - Status 200', () => {
  for (const page of pages) {
    test(`${page.name} (${page.path}) should return 200`, async ({ request }) => {
      const response = await request.get(page.path);
      expect(response.status()).toBe(200);
    });
  }
});

test.describe('Norwegian Page - Content Check', () => {
  test('Home page has correct title', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/TDC/);
  });

  test('Home page has hero section', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#hero')).toBeVisible();
  });

  test('Home page has about section', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#about')).toBeVisible();
  });

  test('Home page has partner section', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#partners')).toBeVisible();
    await expect(page.locator('text=Våre partnere')).toBeVisible();
  });

  test('Home page has CFP button', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=Send inn ditt foredrag').first()).toBeVisible();
  });

  test('CFP section links to Sessionize', async ({ page }) => {
    await page.goto('/');
    const sessionizeLink = page.locator('a[href*="sessionize.com/tdc-2026"]');
    await expect(sessionizeLink.first()).toBeVisible();
  });

  test('Partner section has contact email', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('a[href="mailto:partner@trondheimdc.no"]').first()).toBeVisible();
  });

  test('Has Code of Conduct section', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#coc')).toBeVisible();
  });

  test('Has tickets section', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#tickets')).toBeVisible();
  });
});

test.describe('English Page - Content Check', () => {
  test('Home page has correct title', async ({ page }) => {
    await page.goto('/en/');
    await expect(page).toHaveTitle(/TDC/);
  });

  test('Home page has partner section', async ({ page }) => {
    await page.goto('/en/');
    await expect(page.locator('text=Our partners')).toBeVisible();
  });

  test('Home page has CFP button', async ({ page }) => {
    await page.goto('/en/');
    await expect(page.locator('text=Submit your talk').first()).toBeVisible();
  });

  test('CFP section links to Sessionize', async ({ page }) => {
    await page.goto('/en/');
    const sessionizeLink = page.locator('a[href*="sessionize.com/tdc-2026"]');
    await expect(sessionizeLink.first()).toBeVisible();
  });

  test('Partner section has contact email', async ({ page }) => {
    await page.goto('/en/');
    await expect(page.locator('a[href="mailto:partner@trondheimdc.no"]').first()).toBeVisible();
  });
});

test.describe('Navigation', () => {
  test('Can switch from Norwegian to English', async ({ page }) => {
    await page.goto('/');
    await page.click('a[hreflang="en"]');
    await expect(page).toHaveURL(/\/en\//);
  });

  test('Can switch from English to Norwegian', async ({ page }) => {
    await page.goto('/en/');
    await page.click('a[hreflang="no"]');
    await expect(page).toHaveURL(/^(?!.*\/en\/)/);
  });

  test('Nav has section links', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('nav a[href="#about"]')).toBeVisible();
    await expect(page.locator('nav a[href="#tickets"]')).toBeVisible();
    await expect(page.locator('nav a[href="#partners"]')).toBeVisible();
  });

  test('Smooth scroll to section works', async ({ page }) => {
    await page.goto('/');
    await page.click('nav a[href="#about"]');
    // Wait for the section to be in view
    await expect(page.locator('#about')).toBeInViewport();
  });
});

test.describe('Accessibility', () => {
  test('Page has lang attribute', async ({ page }) => {
    await page.goto('/');
    const lang = await page.getAttribute('html', 'lang');
    expect(lang).toBe('no');
  });

  test('English page has correct lang attribute', async ({ page }) => {
    await page.goto('/en/');
    const lang = await page.getAttribute('html', 'lang');
    expect(lang).toBe('en');
  });

  test('Has skip-to-content link', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.skip-link')).toBeAttached();
  });

  test('Main landmark exists', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('main#main')).toBeVisible();
  });

  test('Sections have aria labels', async ({ page }) => {
    await page.goto('/');
    const sections = page.locator('section[aria-labelledby]');
    expect(await sections.count()).toBeGreaterThan(0);
  });
});
