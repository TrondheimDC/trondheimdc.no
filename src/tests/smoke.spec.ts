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

// Sections rendered on the single-page layout (home.njk). The program embed is
// placed immediately before the speaker area.
const SECTION_IDS = [
  'about',
  'tickets',
  'program',
  'speakers',
  'partner',
  'faq',
  'volunteer',
  'coc',
];

const NAV_SECTIONS = ['about', 'tickets', 'program', 'speakers', 'partner', 'faq', 'coc'];

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

    test(`${path} uses the Sessionize GridSmart embed`, async ({ page }) => {
      await page.goto(path);
      await expect(
        page.locator('#program script[src="https://sessionize.com/api/v2/xx320rm2/view/GridSmart"]'),
      ).toHaveCount(1);
    });

    test(`${path} places the program directly before speakers`, async ({ page }) => {
      await page.goto(path);
      const order = await page.locator('main > tdc-section > section').evaluateAll((sections) =>
        sections.map((section) => section.id),
      );

      expect(order.indexOf('program')).toBe(order.indexOf('speakers') - 1);
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

test.describe('FAQ accordion', () => {
  test('keeps only one item open at a time', async ({ page }) => {
    await page.goto('/');

    const items = page.locator('.faq__item');
    const first = items.nth(0);
    const second = items.nth(1);

    await first.locator('.faq__q').click();
    await expect(first).toHaveJSProperty('open', true);

    // Opening another question collapses the first (accordion behaviour).
    await second.locator('.faq__q').click();
    await expect(second).toHaveJSProperty('open', true);
    await expect(first).toHaveJSProperty('open', false);
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

  test('changes the D to yellow Duck after fifteen clicks', async ({ page }) => {
    await page.goto('/');

    const duck = page.locator('#hero tdc-duck .duck');
    const dLetters = page.locator('.tdc-wordmark__letter--d');

    await expect(dLetters.first()).toHaveText('');
    for (let click = 0; click < 15; click++) {
      await duck.dispatchEvent('click');
    }

    await expect(dLetters.first()).toHaveText('Duck', { timeout: 10000 });
    await expect(dLetters.first()).toHaveClass(/is-tduckc/, { timeout: 10000 });
    await expect(page.locator('.tdc-wordmark.is-tduckc')).toHaveCount(2);
  });

  test('tracks each click with its cumulative total', async ({ page }) => {
    await page.route('**stats.trondheimdc.no/**', (route) => route.abort());
    await page.goto('/');

    const duck = page.locator('#hero tdc-duck .duck');
    await duck.dispatchEvent('click');
    await duck.dispatchEvent('click');

    const events = await page.evaluate(() =>
      ((window as Window & { _paq?: unknown[][] })._paq || []).filter(
        (entry) => entry[0] === 'trackEvent' && entry[1] === 'Duck',
      ),
    );

    expect(events).toEqual([
      ['trackEvent', 'Duck', 'Click', 'Total click 1', 1],
      ['trackEvent', 'Duck', 'Click', 'Total click 2', 2],
    ]);
  });
});

test.describe('Speaker analytics', () => {
  test('tracks the clicked speaker by name', async ({ page }) => {
    await page.route('**stats.trondheimdc.no/**', (route) => route.abort());
    await page.goto('/');

    const speaker = page.locator('[data-speaker-open]').first();
    await expect(speaker).toBeVisible();
    const name = await speaker.getAttribute('data-speaker-name');
    await speaker.dispatchEvent('click');

    const event = await page.evaluate((speakerName) =>
      ((window as Window & { _paq?: unknown[][] })._paq || []).find(
        (entry) =>
          entry[0] === 'trackEvent' &&
          entry[1] === 'Speakers' &&
          entry[2] === 'Click' &&
          entry[3] === speakerName,
      ),
      name,
    );

    expect(event).toEqual(['trackEvent', 'Speakers', 'Click', name, 1]);
  });
});
