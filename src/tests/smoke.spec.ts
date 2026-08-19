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

    test(`${path} renders the custom program schedule`, async ({ page }) => {
      await page.goto(path);
      await expect(page.locator('#program .program-schedule')).toBeVisible();
      await expect(page.locator('#program .program-schedule__room-label')).toHaveCount(6);
      await expect(page.locator('#program [data-program-session]')).toHaveCount(55);
      await expect(page.locator('#program [data-session-description]:not([data-session-description=""])')).toHaveCount(45);
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

test.describe('Program schedule', () => {
  test('opens a talk detail dialog', async ({ page }) => {
    await page.goto('/');
    const session = page.locator('[data-program-session]').filter({ hasText: 'After the AI Hype' });
    await session.locator('[data-session-open]').click();
    await expect(page.locator('[data-session-dialog]')).toBeVisible();
    await expect(page.locator('[data-session-modal-title]')).toHaveText('After the AI Hype – What’s Real, and What’s Next');
    await expect(page.locator('[data-session-modal-description]')).not.toBeEmpty();
  });

  test('stars a talk and persists it across reloads', async ({ page }) => {
    await page.goto('/');
    const session = page.locator('[data-program-session]').filter({ hasText: 'After the AI Hype' });
    await session.locator('[data-session-favorite]').click();
    await expect(session.locator('[data-session-favorite]')).toHaveAttribute('aria-pressed', 'true');
    await page.reload();
    await expect(page.locator('[data-program-session]').filter({ hasText: 'After the AI Hype' }).locator('[data-session-favorite]')).toHaveAttribute('aria-pressed', 'true');
  });

  test('keeps schedule content readable in both themes', async ({ page }) => {
    await page.goto('/');
    const session = page.locator('[data-program-session]').first();
    const darkColors = await session.evaluate((element) => {
      const style = getComputedStyle(element);
      return { background: style.backgroundColor, color: style.color };
    });
    expect(darkColors.background).not.toBe(darkColors.color);

    await page.locator('tdc-theme-toggle button').click();
    const lightColors = await session.evaluate((element) => {
      const style = getComputedStyle(element);
      return { background: style.backgroundColor, color: style.color };
    });
    expect(lightColors.background).not.toBe(lightColors.color);
  });

  test('places regular talks under their room columns on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/#program');
    const positions = await page.locator('[data-program-session][data-session-start="10:00"]')
      .evaluateAll((sessions) => sessions.map((session) => ({
        room: session.querySelector('.program-session__room')?.textContent?.trim(),
        left: session.getBoundingClientRect().left,
      })));

    expect(new Set(positions.filter((item) => item.room !== 'Fellesareal').map((item) => item.left)).size).toBeGreaterThan(2);
  });

  test('aligns each session under its own room header column', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/#program');

    for (const roomName of ['Living room', 'Andromeda', 'Aurora']) {
      const header = page.locator('.program-schedule__room-label', { hasText: roomName });
      const session = page.locator('[data-program-session]').filter({ has: page.locator('.program-session__room', { hasText: roomName }) }).first();
      const [headerBox, sessionBox] = await Promise.all([header.boundingBox(), session.boundingBox()]);

      expect(headerBox).not.toBeNull();
      expect(sessionBox).not.toBeNull();
      expect(Math.abs(headerBox!.x - sessionBox!.x)).toBeLessThan(2);
    }
  });

  test('spans a single session across the full desktop schedule row', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/#program');

    const grid = page.locator('.program-schedule__grid');
    const session = page.locator('[data-program-session]').filter({ hasText: 'Ubuntu as AI Compass' });
    const [gridBox, sessionBox] = await Promise.all([grid.boundingBox(), session.boundingBox()]);

    expect(gridBox).not.toBeNull();
    expect(sessionBox).not.toBeNull();
    expect(Math.abs(gridBox!.x - sessionBox!.x)).toBeLessThan(2);
    expect(Math.abs(gridBox!.width - sessionBox!.width)).toBeLessThan(2);
  });
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

  test('shows a label above a duck after it is named', async ({ page }) => {
    await page.goto('/');
    await page.addStyleTag({ url: '/assets/css/duck-mate.css' });
    await page.addScriptTag({ url: '/assets/js/duck-mate.js' });
    await page.evaluate(() => {
      (window as Window & { testDuck?: { rename: () => boolean } }).testDuck = window.initDuckMate({ id: 'named-duck' });
    });

    page.once('dialog', (dialog) => dialog.accept('Ada'));
    await page.evaluate(() => (window as Window & { testDuck: { rename: () => boolean } }).testDuck.rename());

    const label = page.locator('.duck-mate-name-label');
    await expect(label).toBeVisible();
    await expect(label).toHaveText('Ada');
    await expect(page.locator('.duck-mate-duck')).toHaveAttribute('aria-label', /named Ada/);
  });

  test('keeps generated duck names hidden, including after persistence', async ({ page }) => {
    await page.goto('/');
    const restoredLifecycles = await page.evaluate(() => {
      localStorage.setItem('duck-mate-flock', JSON.stringify({
        version: 2,
        ducks: [{ id: 'default-name-duck', name: 'Duck 1' }],
        lifecycles: [],
        children: [],
      }));
    });
    await page.addStyleTag({ url: '/assets/css/duck-mate.css' });
    await page.addScriptTag({ url: '/assets/js/duck-mate.js' });
    await page.evaluate(() => window.initDuckMate({ id: 'default-name-duck' }));

    await expect(page.locator('.duck-mate-name-label')).toBeHidden();
    await expect(page.locator('.duck-mate-duck')).toHaveAttribute('aria-label', 'Animated duck mascot');
    const storedDuck = await page.evaluate(() => JSON.parse(localStorage.getItem('duck-mate-flock')!).ducks[0]);
    expect(storedDuck).toMatchObject({ customName: false, name: null });
  });

  test('close-all clears eggs, persisted flock state, and the five-click counter', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      const now = Date.now();
      localStorage.setItem('duck-mate-flock', JSON.stringify({
        version: 3,
        ducks: [{ id: 'close-host', name: 'Parent', customName: true }],
        children: [],
        lifecycles: [{
          id: 'close-egg', parentA: 'close-host', parentB: 'missing', state: 'egg',
          eggAt: now - 1000, hatchAt: now + 60000, eggX: 120, eggY: 120,
          hostId: 'close-host', crackSeed: 3, seed: 3,
        }],
      }));
    });
    await page.addStyleTag({ url: '/assets/css/duck-mate.css' });
    await page.addScriptTag({ url: '/assets/js/duck-mate.js' });
    await page.evaluate(() => {
      const duck = window.initDuckMate({ id: 'close-host' });
      return duck?.debugLifecycleSnapshot();
    });
    await expect(page.locator('.duck-mate-egg')).toHaveCount(1);

    page.once('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: 'Close all ducks' }).click();

    await expect(page.locator('.duck-mate-egg')).toHaveCount(0);
    await expect(page.locator('.duck-mate-duck')).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('duck-mate-flock')!).lifecycles)).toEqual([]);

    // Five clicks after close must be the first four clicks of a new sequence,
    // not an immediate party-mode activation from the previous flock.
    const heroDuck = page.locator('#hero tdc-duck .duck');
    for (let click = 0; click < 4; click++) await heroDuck.dispatchEvent('click');
    await expect(heroDuck).not.toHaveClass(/is-partying/);
  });

  test('renders an egg in its own uncropped overlay canvas', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      const now = Date.now();
      localStorage.setItem('duck-mate-flock', JSON.stringify({
        version: 2,
        ducks: [{ id: 'egg-host', name: 'Parent' }],
        children: [],
        lifecycles: [{
          id: 'egg-test', parentA: 'egg-host', parentB: 'missing-parent', state: 'egg',
          eggAt: now - 1000, hatchAt: now + 60000, eggX: 10, eggY: 120,
          hostId: 'egg-host', crackSeed: 7, seed: 7,
        }],
      }));
    });
    await page.addStyleTag({ url: '/assets/css/duck-mate.css' });
    await page.addScriptTag({ url: '/assets/js/duck-mate.js' });
    await page.evaluate(() => window.initDuckMate({ id: 'egg-host' }));

    const egg = page.locator('.duck-mate-egg');
    await expect(egg).toBeVisible();
    const bounds = await egg.boundingBox();
    expect(bounds).toMatchObject({ width: 56, height: 64 });
    expect(bounds!.x).toBeGreaterThanOrEqual(0);

    const transparentEdge = await egg.evaluate((canvas: HTMLCanvasElement) => {
      const context = canvas.getContext('2d')!;
      const { width, height } = canvas;
      const top = context.getImageData(0, 0, width, 1).data;
      const bottom = context.getImageData(0, height - 1, width, 1).data;
      const left = context.getImageData(0, 0, 1, height).data;
      const right = context.getImageData(width - 1, 0, 1, height).data;
      return [top, bottom, left, right].every(edge => {
        for (let alpha = 3; alpha < edge.length; alpha += 4) if (edge[alpha] !== 0) return false;
        return true;
      });
    });
    expect(transparentEdge).toBe(true);
  });

  test('does not let baby ducks start a new egg lifecycle', async ({ page }) => {
    await page.goto('/');
    await page.addStyleTag({ url: '/assets/css/duck-mate.css' });
    await page.addScriptTag({ url: '/assets/js/duck-mate.js' });

    const result = await page.evaluate(() => {
      const adult = window.initDuckMate({ id: 'adult-duck' });
      const baby = window.initDuckMate({
        id: 'baby-duck',
        multiInstance: true,
        isBaby: true,
        breedingMatureAt: Date.now() + 180000,
        growthStartedAt: Date.now(),
        growthDurationMs: 180000,
      });
      return {
        started: baby.debugStartCourtship(adult.id),
        lifecycles: baby.debugLifecycleSnapshot(),
      };
    });

    expect(result.started).toBe(false);
    expect(result.lifecycles).toEqual([]);
    await expect(page.locator('.duck-mate-duck[data-courtship-stage]')).toHaveCount(0);
  });

  test('starts synchronized staged animation when two adult ducks fall in love', async ({ page }) => {
    await page.goto('/');
    await page.addStyleTag({ url: '/assets/css/duck-mate.css' });
    await page.addScriptTag({ url: '/assets/js/duck-mate.js' });

    const courtship = await page.evaluate(() => {
      const first = window.initDuckMate({ id: 'love-duck-a' });
      const second = window.initDuckMate({ id: 'love-duck-b', multiInstance: true });
      const started = first.debugStartCourtship(second.id);
      const lifecycle = first.debugLifecycleSnapshot()[0];
      return { started, duration: lifecycle.eggAt - lifecycle.startedAt };
    });

    expect(courtship.started).toBe(true);
    expect(courtship.duration).toBeGreaterThanOrEqual(12000);
    expect(courtship.duration).toBeLessThanOrEqual(20000);
    const courting = page.locator('.duck-mate-duck[data-courtship-stage="approach"]');
    await expect(courting).toHaveCount(2);
    await expect(courting.first()).toHaveAttribute('aria-label', /Animated duck mascot/);
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

  test('locks page scroll while the speaker modal is open', async ({ page }) => {
    await page.goto('/');

    await page.locator('[data-speaker-open]').first().click();
    await expect(page.locator('body')).toHaveClass(/modal-open/);

    await page.locator('[data-speaker-close]').click();
    await expect(page.locator('body')).not.toHaveClass(/modal-open/);
  });
});
