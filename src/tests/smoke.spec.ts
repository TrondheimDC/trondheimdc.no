import { test, expect } from '@playwright/test';

/**
 * Smoke tests for the rebuilt TDC 2026 site.
 *
 * The site is now a single page per language — Norwegian at "/" and English
 * at "/en/" — where the old standalone pages (about, info, partner, CoC, …)
 * live as in-page sections. These tests verify the migrated structure, the
 * language switch, dark/light theming, the partner wall near the footer, and
 * that the parked easter eggs never load.
 */

const SECTION_IDS = [
  'about',
  'tickets',
  'program',
  'speakers',
  'info',
  'partner',
  'faq',
  'volunteer',
  'cfp',
  'coc',
];

const NAV_SECTIONS = ['about', 'tickets', 'program', 'speakers', 'info', 'partner', 'faq', 'coc'];

test.describe('Pages load', () => {
  for (const path of ['/', '/en/']) {
    test(`${path} returns 200`, async ({ request }) => {
      const res = await request.get(path);
      expect(res.status()).toBe(200);
    });

    test(`${path} has a TDC title`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveTitle(/TDC/);
    });
  }
});

test.describe('Single-page sections', () => {
  for (const path of ['/', '/en/']) {
    test(`${path} contains every migrated section`, async ({ page }) => {
      await page.goto(path);
      for (const id of SECTION_IDS) {
        await expect(page.locator(`section#${id}`)).toBeAttached();
      }
    });

    test(`${path} nav links point to in-page sections`, async ({ page }) => {
      await page.goto(path);
      for (const id of NAV_SECTIONS) {
        await expect(page.locator(`.site-nav a[href="#${id}"]`)).toHaveCount(1);
      }
    });
  }
});

test.describe('Hero', () => {
  test('Norwegian hero shows venue and ticket CTA', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#hero')).toContainText('Clarion Hotel Trondheim');
    await expect(page.locator('#hero a', { hasText: 'Kjøp billetter' })).toBeVisible();
  });

  test('English hero shows ticket CTA', async ({ page }) => {
    await page.goto('/en/');
    await expect(page.locator('#hero a', { hasText: 'Buy tickets' })).toBeVisible();
  });
});

test.describe('Language switching', () => {
  test('Norwegian -> English', async ({ page }) => {
    await page.goto('/');
    await page.locator('.site-nav__lang a', { hasText: 'EN' }).click();
    await expect(page).toHaveURL(/\/en\/$/);
  });

  test('English -> Norwegian', async ({ page }) => {
    await page.goto('/en/');
    await page.locator('.site-nav__lang a', { hasText: 'NO' }).click();
    await expect(page).toHaveURL(/localhost:4000\/$/);
  });
});

test.describe('Theme toggle', () => {
  test('flips the theme and persists the choice', async ({ page }) => {
    await page.goto('/');
    const html = page.locator('html');
    const toggle = page.locator('tdc-theme-toggle button');

    await toggle.click();
    const first = await html.getAttribute('data-theme');
    expect(['light', 'dark']).toContain(first);

    const stored = await page.evaluate(() => localStorage.getItem('tdc-theme'));
    expect(stored).toBe(first);

    await toggle.click();
    const second = await html.getAttribute('data-theme');
    expect(second).not.toBe(first);
  });

  test('remembers the chosen theme across reloads', async ({ page }) => {
    await page.goto('/');
    await page.locator('tdc-theme-toggle button').click();
    const chosen = await page.locator('html').getAttribute('data-theme');

    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', chosen!);
  });
});

test.describe('Partners', () => {
  test('partner wall renders between the main content and the footer', async ({ page }) => {
    await page.goto('/');

    const wall = page.locator('.partner-wall');
    await expect(wall).toBeVisible();
    await expect(wall.locator('.partner-wall__item').first()).toBeVisible();

    const positions = await page.evaluate(() => {
      const main = document.querySelector('main');
      const wallEl = document.querySelector('.partner-wall');
      const footer = document.querySelector('.site-footer');
      if (!main || !wallEl || !footer) return null;
      return {
        afterMain: !!(main.compareDocumentPosition(wallEl) & Node.DOCUMENT_POSITION_FOLLOWING),
        beforeFooter: !!(wallEl.compareDocumentPosition(footer) & Node.DOCUMENT_POSITION_FOLLOWING),
      };
    });

    expect(positions).not.toBeNull();
    expect(positions!.afterMain).toBe(true);
    expect(positions!.beforeFooter).toBe(true);
  });
});

test.describe('Duck mascot', () => {
  test('hero shows the interactive duck without eagerly loading the engine', async ({ page }) => {
    const duckMateRequests: string[] = [];
    page.on('request', (req) => {
      if (/duck-mate/i.test(req.url())) duckMateRequests.push(req.url());
    });

    await page.goto('/', { waitUntil: 'load' });

    // The clickable mascot is mounted in the hero and upgraded by its component.
    const duck = page.locator('#hero tdc-duck .duck');
    await expect(duck).toBeVisible();

    // The heavy eSheep-style "duck-mate" engine must stay lazy — it should only
    // load after the user triggers party mode, never on initial page load.
    expect(duckMateRequests).toEqual([]);
  });
});
