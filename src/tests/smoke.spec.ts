import { test, expect } from '@playwright/test';
import type { Download } from '@playwright/test';

async function readDownload(download: Download) {
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf-8');
}

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
  'faq',
  'volunteer',
  'coc',
];

const NAV_SECTIONS = ['about', 'tickets', 'program', 'speakers', 'faq', 'coc'];

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
      await expect.poll(() => page.locator('#program .program-schedule__room-label').count()).toBeGreaterThanOrEqual(6);
      await expect.poll(() => page.locator('#program [data-program-session]').count()).toBeGreaterThanOrEqual(45);
      await expect.poll(() => page.locator('#program [data-session-description]:not([data-session-description=""])').count()).toBeGreaterThanOrEqual(45);
      await expect(page.locator('#program [data-program-topic-filter] option')).not.toHaveCount(1);
      await expect(page.locator('#program [data-program-search]')).toBeVisible();
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

  test('resets its scroll position each time it opens', async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 500 });
    await page.goto('/');

    // Pick whichever session has the longest description, so there's
    // somewhere to actually scroll to.
    const sessions = page.locator('[data-program-session]:not([data-session-service="true"])');
    const count = await sessions.count();
    let longestIndex = 0, longestLength = 0;
    for (let i = 0; i < count; i++) {
      const description = await sessions.nth(i).getAttribute('data-session-description');
      if (description && description.length > longestLength) {
        longestLength = description.length;
        longestIndex = i;
      }
    }
    const session = sessions.nth(longestIndex);
    const scroll = page.locator('[data-session-dialog] .detail-modal__scroll');

    await session.locator('[data-session-open]').click();
    await scroll.evaluate((el) => el.scrollTo(0, el.scrollHeight));
    await expect.poll(() => scroll.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);

    await page.locator('[data-session-close]').click();
    await session.locator('[data-session-open]').click();
    await expect.poll(() => scroll.evaluate((el) => el.scrollTop)).toBe(0);
  });

  test('keeps the sticky nav out of the dialog\'s View Transition', async ({ page }) => {
    // Regression guard: .site-nav is position: sticky and visible on every
    // page. Left unnamed, it gets bundled into the *document-wide* "root"
    // snapshot the dialog's View Transition still takes — captured at its
    // natural, unstuck document position rather than its current on-screen
    // one, which reads as the nav vanishing and snapping back once live
    // rendering resumes. Naming it pulls it into its own, unaffected group.
    await page.goto('/');
    const viewTransitionName = await page.locator('.site-nav').evaluate((el) => getComputedStyle(el).viewTransitionName);
    expect(viewTransitionName).toBe('site-nav');
  });

  test('labels the speakers section singular or plural to match the talk', async ({ page }) => {
    await page.goto('/');
    const heading = page.locator('[data-session-modal-speakers-title]');

    const solo = page.locator('[data-program-session]').filter({ hasText: 'After the AI Hype' });
    await solo.locator('[data-session-open]').click();
    await expect(page.locator('.session-speaker')).toHaveCount(1);
    await expect(heading).toHaveText('Foredragsholder');
    await page.locator('[data-session-close]').click();

    const panel = page.locator('[data-program-session]').filter({ hasText: 'Kortslutning Live' }).first();
    await panel.locator('[data-session-open]').click();
    await expect(page.locator('.session-speaker').first()).toBeVisible();
    await expect(page.locator('.session-speaker')).toHaveCount(2);
    await expect(heading).toHaveText('Foredragsholdere');
  });

  test('never shows the browser\'s own tap highlight on a session card', async ({ page }) => {
    // The whole card is the click target now (see "makes the card clickable"),
    // so it needs the same tap-highlight reset the button-only version never
    // needed to notice was missing.
    await page.goto('/');
    const session = page.locator('[data-program-session]').filter({ hasText: 'After the AI Hype' });
    await expect(session).toHaveCSS('-webkit-tap-highlight-color', 'rgba(0, 0, 0, 0)');
  });

  test('never intercepts clicks while closed', async ({ page }) => {
    // Regression guard: .detail-modal sets its own `display`, which silently
    // beats the UA stylesheet's `dialog:not([open]) { display: none }` —
    // author styles win over UA styles regardless of specificity — unless
    // that closed state is restated explicitly (see detail-modal.css).
    await page.goto('/');
    await expect(page.locator('[data-session-dialog]')).toHaveCSS('display', 'none');
    await page.locator('[data-program-session]').filter({ hasText: 'After the AI Hype' }).locator('[data-session-open]').click();
    await expect(page.locator('[data-session-dialog]')).toBeVisible();
  });

  test('keeps the close button and actions reachable while a long description scrolls', async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 420 });
    await page.goto('/');

    // Pick whichever session has the longest description, so the dialog is
    // guaranteed to actually scroll regardless of what Sessionize returns.
    const sessions = page.locator('[data-program-session]:not([data-session-service="true"])');
    const count = await sessions.count();
    let longestIndex = 0, longestLength = 0;
    for (let i = 0; i < count; i++) {
      const description = await sessions.nth(i).getAttribute('data-session-description');
      if (description && description.length > longestLength) {
        longestLength = description.length;
        longestIndex = i;
      }
    }
    await sessions.nth(longestIndex).locator('[data-session-open]').click();

    const close = page.locator('[data-session-close]');
    const favorite = page.locator('[data-session-modal-favorite]');
    // Opening runs inside a View Transition; give its (browser-default-length)
    // animation time to settle before measuring, or this reads an in-transit
    // position rather than the dialog's actual, final one.
    await page.waitForTimeout(350);
    const closeBefore = await close.boundingBox();

    await page.locator('[data-session-dialog] .detail-modal__scroll').evaluate((el) => el.scrollTo(0, el.scrollHeight));
    await expect(favorite).toBeVisible();
    await expect(page.locator('[data-calendar-toggle]')).toBeVisible();
    const closeAfter = await close.boundingBox();
    expect(closeAfter?.y).toBeCloseTo(closeBefore?.y ?? 0, 0);
  });

  test('stars a talk and persists it across reloads', async ({ page }) => {
    await page.goto('/');
    const session = page.locator('[data-program-session]').filter({ hasText: 'After the AI Hype' });
    await session.locator('[data-session-favorite]').click();
    await expect(session.locator('[data-session-favorite]')).toHaveAttribute('aria-pressed', 'true');
    await page.reload();
    await expect(page.locator('[data-program-session]').filter({ hasText: 'After the AI Hype' }).locator('[data-session-favorite]')).toHaveAttribute('aria-pressed', 'true');
  });

  test('combines topic and saved-talk filters', async ({ page }) => {
    await page.goto('/');
    const topicFilter = page.locator('[data-program-topic-filter]');
    const sessions = page.locator('[data-program-session]');
    const firstSession = sessions.filter({ has: page.locator('[data-session-favorite]') }).first();

    // The live Sessionize API can change its topic list; seed one session with
    // a topic so this test verifies the filtering behaviour independently.
    await firstSession.evaluate((session) => { session.dataset.sessionTopics = 'Test topic'; });
    await topicFilter.evaluate((select) => {
      const option = document.createElement('option');
      option.value = 'Test topic';
      option.textContent = 'Test topic';
      select.append(option);
    });
    await topicFilter.selectOption('Test topic');
    await expect(firstSession).toBeVisible();
    await expect(page.locator('[data-program-session]:visible')).toHaveCount(1);

    await firstSession.locator('[data-session-favorite]').click();
    await page.locator('[data-program-favorites-only]').click();
    await expect(firstSession).toBeVisible();
    await expect(page.locator('[data-program-session]:visible')).toHaveCount(1);
  });

  test('searches talks across title, description, speakers, and metadata', async ({ page }) => {
    await page.goto('/');
    const search = page.locator('[data-program-search]');
    const sessions = page.locator('[data-program-session]');

    await search.fill('After the AI Hype');
    await expect(sessions.filter({ hasText: 'After the AI Hype' })).toBeVisible();
    await expect(page.locator('[data-program-session]:visible')).toHaveCount(1);

    await search.fill('this text cannot match any talk');
    await expect(page.locator('[data-program-session]:visible')).toHaveCount(0);
    await expect(page.locator('[data-program-search-empty]')).toBeVisible();
  });

  test('serves a single talk as an .ics file', async ({ page }) => {
    await page.goto('/');
    const session = page.locator('[data-program-session]').filter({ hasText: 'After the AI Hype' });
    await session.locator('[data-session-open]').click();
    await page.locator('[data-calendar-toggle]').click();

    // Served as a real file, not a Blob, so mobile hands it to the calendar app.
    const href = await page.locator('[data-calendar-link="ics"]').getAttribute('href') ?? '';
    expect(href).toBe(`/program/${await session.getAttribute('data-session-id')}.ics`);

    const response = await page.request.get(href);
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('text/calendar');
    const ics = await response.text();

    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('SUMMARY:After the AI Hype');
    expect(ics).toMatch(/LOCATION:.+/);
    expect(ics).toMatch(/DTSTART:20261019T\d{6}Z/);
    expect(ics).toMatch(/DTEND:20261019T\d{6}Z/);
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(1);
    // RFC 5545 caps content lines at 75 octets.
    for (const line of ics.split('\r\n')) {
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    }
  });

  test('offers web calendars as prefilled deep links', async ({ page }) => {
    await page.goto('/');
    const menu = page.locator('[data-calendar-list]');
    await expect(menu).toBeHidden();

    await page.locator('[data-program-session]').filter({ hasText: 'After the AI Hype' }).locator('[data-session-open]').click();
    await page.locator('[data-calendar-toggle]').click();
    await expect(menu).toBeVisible();
    await expect(page.locator('[data-calendar-toggle]')).toHaveAttribute('aria-expanded', 'true');
    // A disclosure, not a menu widget: plain links, reachable with Tab.
    await expect(page.locator('[data-calendar-list] [role]')).toHaveCount(0);

    const google = new URL(await page.locator('[data-calendar-link="google"]').getAttribute('href') ?? '');
    expect(google.hostname).toBe('calendar.google.com');
    expect(google.searchParams.get('text')).toContain('After the AI Hype');
    expect(google.searchParams.get('dates')).toBe('20261019T070000Z/20261019T074500Z');
    expect(google.searchParams.get('location')).toBe('Cosmos 1 & 2');

    const outlook = new URL(await page.locator('[data-calendar-link="outlook"]').getAttribute('href') ?? '');
    expect(outlook.hostname).toBe('outlook.office.com');
    expect(outlook.searchParams.get('startdt')).toBe('2026-10-19T07:00:00.000Z');
    await expect(page.locator('[data-calendar-list] .calendar-menu__item')).toHaveCount(3);

    // Escape dismisses the menu before it dismisses the dialog under it.
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    await expect(page.locator('[data-session-dialog]')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-session-dialog]')).toBeHidden();
  });

  test('exports every saved talk as one .ics file', async ({ page }) => {
    await page.goto('/');
    const exportButton = page.locator('[data-program-calendar-export]');
    // Always rendered, so saving a talk cannot shift the toolbar's layout.
    await expect(exportButton).toBeVisible();
    await expect(exportButton).toBeDisabled();

    const saved = page.locator('[data-program-session]').filter({ has: page.locator('[data-session-favorite]') });
    await saved.nth(0).locator('[data-session-favorite]').click();
    await saved.nth(1).locator('[data-session-favorite]').click();
    await expect(exportButton).toBeEnabled();

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      exportButton.click(),
    ]);

    const ics = await readDownload(download);
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    expect(ics).toContain('X-WR-CALNAME:');
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

    const roomLabels = page.locator('.program-schedule__room-label');
    const session = page.locator('[data-program-session]').filter({ hasText: 'Ubuntu as AI Compass' });
    const [firstRoomBox, lastRoomBox, sessionBox] = await Promise.all([
      roomLabels.first().boundingBox(),
      roomLabels.last().boundingBox(),
      session.boundingBox(),
    ]);

    expect(firstRoomBox).not.toBeNull();
    expect(lastRoomBox).not.toBeNull();
    expect(sessionBox).not.toBeNull();
    const roomsWidth = lastRoomBox!.x + lastRoomBox!.width - firstRoomBox!.x;
    expect(Math.abs(firstRoomBox!.x - sessionBox!.x)).toBeLessThan(2);
    expect(Math.abs(roomsWidth - sessionBox!.width)).toBeLessThan(2);
  });

  test('keeps Kortslutning in Andromeda while the party is running', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/#program');

    const party = page.locator('.program-session--long-service-overlay[data-session-end="23:00"]');
    const kortslutning = page.locator('[data-program-session]').filter({ hasText: 'Kortslutning Live' });
    const [partyBox, kortslutningBox] = await Promise.all([party.boundingBox(), kortslutning.boundingBox()]);

    expect(partyBox).not.toBeNull();
    expect(kortslutningBox).not.toBeNull();
    expect(partyBox!.y + partyBox!.height).toBeGreaterThan(kortslutningBox!.y + kortslutningBox!.height);
    await expect(party).toHaveAttribute('data-session-end', '23:00');
    await expect(kortslutning.locator('.program-session__room')).toHaveText('Andromeda');
    expect(partyBox!.x).toBeGreaterThan(kortslutningBox!.x);
    await expect(page.locator('.program-session--long-service-overlay[data-session-end="23:00"]')).toBeVisible();
    for (const time of ['20:00', '21:00', '22:00']) {
      await expect(page.locator(`[data-program-time$="T${time}:00+02:00"]`)).toBeVisible();
    }
    await expect(page.locator('[data-program-time$="T23:00:00+02:00"]')).toHaveCount(0);
  });

  test('orders program rooms alphabetically', async ({ page }) => {
    await page.goto('/#program');
    await expect(page.locator('.program-schedule__room-label')).toHaveText([
      'Andromeda', 'Aurora', 'Cosmos 1 & 2', 'Cosmos 3AB', 'Cosmos 3CD', 'Living room',
    ]);
  });

  test('labels lunch as taking place in the shared area and restaurant', async ({ page }) => {
    await page.goto('/#program');

    const lunch = page.locator('[data-program-session]').filter({ hasText: 'Lunch' });
    await expect(lunch.locator('.program-session__room')).toHaveText(/Fellesområde & restaurant|Shared area & restaurant/);
  });

  test('makes breaks and other service sessions non-clickable', async ({ page }) => {
    await page.goto('/#program');

    const services = page.locator('[data-program-session][data-session-service="true"]');
    await expect(services.first()).toBeVisible();
    const count = await services.count();
    for (let i = 0; i < count; i++) {
      await expect(services.nth(i).locator('[data-session-open]')).toHaveCount(0);
      await expect(services.nth(i).locator('.program-session__title')).toHaveCount(1);
    }

    // The long-service overlay (the party) is itself always a service session.
    const overlay = page.locator('.program-session--long-service-overlay');
    await expect(overlay.locator('[data-session-open]')).toHaveCount(0);
  });

  test('shows a speaker\'s own talk title on their speakers-wall card', async ({ page }) => {
    // Regression guard: speaker.sessions[0] (Sessionize's own backlink) comes
    // back as a number while every other session id is a string, so the
    // sessionById() `===` lookup silently matched nothing — this preview
    // (and data-session-id, which the merged dialog depends on to resolve a
    // wall click back to a real session) were empty for every speaker.
    await page.goto('/');
    await expect(page.locator('#speakers .speaker-card__talk').first()).not.toBeEmpty();
  });

  test('labels every talk with the language it is held in', async ({ page }) => {
    await page.goto('/#program');

    const talks = page.locator('[data-program-session][data-session-service="false"]');
    await expect(talks).not.toHaveCount(0);

    const languages = await talks.evaluateAll((cards) =>
      cards.map((card) => {
        const badges = card.querySelectorAll('[data-session-language]');
        const code = badges[0]?.getAttribute('data-session-language');
        return { count: badges.length, code, label: badges[0]?.textContent?.trim() };
      }),
    );

    for (const language of languages) {
      expect(language.count).toBe(1);
      expect(['en', 'no']).toContain(language.code);
      expect(language.label).toBe(language.code === 'en' ? 'Engelsk' : 'Norsk');
    }

    await expect(page.locator('[data-program-session][data-session-service="true"] [data-session-language]')).toHaveCount(0);
  });

  test('carries the talk language into the detail dialog', async ({ page }) => {
    await page.goto('/#program');

    const norwegian = page.locator('[data-program-session]').filter({ has: page.locator('[data-session-language="no"]') }).first();
    await norwegian.locator('[data-session-open]').click();

    const dialogFlag = page.locator('[data-session-dialog] [data-session-modal-language] [data-session-language]');
    await expect(dialogFlag).toHaveAttribute('data-session-language', 'no');
    await expect(dialogFlag).toHaveText('Norsk');

    await page.locator('[data-session-close]').click();
    const english = page.locator('[data-program-session]').filter({ has: page.locator('[data-session-language="en"]') }).first();
    await english.locator('[data-session-open]').click();
    await expect(dialogFlag).toHaveAttribute('data-session-language', 'en');

    await page.locator('[data-session-close]').click();
  });

  test('keeps the language and session length out of the topic filter', async ({ page }) => {
    await page.goto('/#program');

    const topics = await page.locator('[data-program-topic-filter] option').allTextContents();
    expect(topics).not.toContain('English');
    expect(topics).not.toContain('Norwegian');
    expect(topics.filter((topic) => /minutes$/.test(topic))).toEqual([]);
  });
});

test.describe('Standalone program page', () => {
  // /program/ and /en/program/ render the same section as the home page, on
  // their own, for anyone who would rather not scroll the single page. They
  // are deliberately unlisted — nothing on the site links to them.
  const PAGES = [
    { path: '/program/', home: '/', heading: 'Program' },
    { path: '/en/program/', home: '/en/', heading: 'Agenda' },
  ];

  for (const { path, home, heading } of PAGES) {
    test(`${path} renders the full schedule`, async ({ page }) => {
      await page.goto(path);
      await expect(page.locator('#program .program-schedule')).toBeVisible();
      await expect.poll(() => page.locator('#program [data-program-session]').count()).toBeGreaterThanOrEqual(45);
      await expect(page.locator('#program [data-program-search]')).toBeVisible();
    });

    test(`${path} owns the h1 and carries no other sections`, async ({ page }) => {
      await page.goto(path);
      await expect(page.locator('h1#program-title')).toHaveText(heading);
      const ids = await page.locator('main section[id]').evaluateAll((s) => s.map((el) => el.id));
      expect(ids).toEqual(['program']);
    });

    test(`${path} stays a duplicate of the home page for search engines`, async ({ page }) => {
      await page.goto(path);
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', new RegExp(`${home}$`));
    });

    test(`${path} points its nav and language switch somewhere real`, async ({ page }) => {
      await page.goto(path);
      for (const id of NAV_SECTIONS) {
        await expect(page.locator(`.site-nav a[href="${home}#${id}"]`)).toHaveCount(1);
      }
      await expect(page.locator('.site-nav__lang a[hreflang="no"]')).toHaveAttribute('href', '/program/');
      await expect(page.locator('.site-nav__lang a[hreflang="en"]')).toHaveAttribute('href', '/en/program/');
    });

    test(`${path} keeps the schedule readable with JavaScript off`, async ({ browser }) => {
      const context = await browser.newContext({ javaScriptEnabled: false });
      const page = await context.newPage();
      await page.goto(path);
      await expect(page.locator('#program .program-schedule')).toBeVisible();
      await expect.poll(() => page.locator('#program [data-program-session]').count()).toBeGreaterThanOrEqual(45);
      await context.close();
    });

    test(`${path} opens a speaker's session from the schedule`, async ({ page }) => {
      // Speaker bios are merged into the session dialog now — this page has
      // no separate speaker wall or dialog of its own to bring.
      await page.goto(path);
      const dialog = page.locator('[data-session-dialog]');
      await expect(dialog).toBeHidden();

      const session = page.locator('[data-program-session]').filter({ has: page.locator('[data-speaker-open]') }).first();
      const speaker = session.locator('[data-speaker-open]').first();
      const name = (await speaker.textContent())?.trim() ?? '';
      expect(name).not.toBe('');
      await speaker.click();

      await expect(dialog).toBeVisible();
      await expect(dialog.locator('[data-session-modal-title]')).toHaveText(await session.getAttribute('data-session-title') ?? '');
      await expect(dialog.locator('.session-speaker__name')).toContainText(name);
      await page.locator('[data-session-close]').click();
      await expect(dialog).toBeHidden();
    });
  }

  for (const path of ['/', '/en/']) {
    test(`${path} does not link to the standalone program page`, async ({ page }) => {
      await page.goto(path);
      await expect(page.locator('a[href$="/program/"]')).toHaveCount(0);
    });
  }
});

test.describe('Live program view', () => {
  // EPG-style "follow the day": finished slots collapse out of the grid while
  // the conference is running. ?now= fakes the clock so this is testable on any
  // date; 13:00 falls on a slot boundary with eight slots already finished.
  const DURING_THE_DAY = '/program/?now=2026-10-19T13:00:00%2B02:00';
  const rows = (page) => page.locator('.program-schedule__row');
  // :visible, not :not([hidden]) — a collapsed row has to actually be gone,
  // and .program-schedule__row sets its own `display`.
  const visibleRows = (page) => page.locator('.program-schedule__row:visible');

  test('stays out of the way on any other day', async ({ page }) => {
    await page.goto('/program/');
    await expect(page.locator('[data-program-live-toggle]')).toBeHidden();
    await expect(page.locator('[data-program-live-earlier]')).toBeHidden();
    await expect(page.locator('[data-program-now]')).toBeHidden();
    await expect(visibleRows(page)).toHaveCount(await rows(page).count());
  });

  test('collapses finished slots and tracks the current time', async ({ page }) => {
    await page.goto(DURING_THE_DAY);
    const total = await rows(page).count();

    await expect(page.locator('[data-program-live-toggle]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('[data-program-now]')).toBeVisible();
    await expect(page.locator('[data-program-now-time]')).toHaveText('13:00');

    await expect(visibleRows(page)).toHaveCount(total - 8);
    await expect(visibleRows(page).first().locator('.program-schedule__time')).toHaveText('13:00');
    await expect(page.locator('.program-session.is-live').first()).toBeVisible();
  });

  test('snaps to the row on narrow screens instead of pointing into the stack', async ({ page }) => {
    // Below 1200px rooms stack as cards instead of sitting in columns, so a
    // row's height is "how many talks run at once" there, not "time passed" —
    // creeping into it would point the line at an arbitrary card in the stack.
    await page.setViewportSize({ width: 390, height: 1400 });
    // Twelve minutes into a twenty-minute slot: on desktop this would sit well
    // inside the row, not on its top edge.
    await page.goto('/program/?now=2026-10-19T13:32:00%2B02:00');

    const currentRow = visibleRows(page).first();
    await expect(currentRow.locator('.program-schedule__time')).toHaveText('13:20');
    const rowTop = await currentRow.evaluate((el) => el.getBoundingClientRect().top);
    const lineTop = await page.locator('[data-program-now]').evaluate((el) => el.getBoundingClientRect().top);
    expect(Math.abs(lineTop - rowTop)).toBeLessThan(2);
  });

  test('can bring the earlier slots back', async ({ page }) => {
    await page.goto(DURING_THE_DAY);
    const total = await rows(page).count();
    const earlier = page.locator('[data-program-live-earlier]');

    await expect(earlier).toBeVisible();
    await earlier.click();
    await expect(earlier).toHaveAttribute('aria-expanded', 'true');
    await expect(visibleRows(page)).toHaveCount(total);
    // Back in view, but clearly done with.
    await expect(page.locator('.program-schedule__row.is-past')).toHaveCount(8);

    await earlier.click();
    await expect(visibleRows(page)).toHaveCount(total - 8);
  });

  test('can be switched off, and stays off', async ({ page }) => {
    await page.goto(DURING_THE_DAY);
    const total = await rows(page).count();

    await page.locator('[data-program-live-toggle]').click();
    await expect(page.locator('[data-program-live-toggle]')).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('[data-program-live-earlier]')).toBeHidden();
    await expect(page.locator('[data-program-now]')).toBeHidden();
    await expect(visibleRows(page)).toHaveCount(total);
    await expect(page.locator('.program-session.is-past')).toHaveCount(0);

    await page.goto(DURING_THE_DAY);
    await expect(page.locator('[data-program-live-toggle]')).toHaveAttribute('aria-pressed', 'false');
    await expect(visibleRows(page)).toHaveCount(total);
  });

  test('a search still reaches talks that have already been given', async ({ page }) => {
    await page.goto(DURING_THE_DAY);
    const total = await rows(page).count();

    await page.locator('[data-program-search]').fill('After the AI Hype');
    await expect(visibleRows(page)).toHaveCount(total);
    await expect(page.locator('[data-program-session]:visible')).toHaveCount(1);
    await expect(page.locator('[data-program-live-earlier]')).toBeHidden();

    await page.locator('[data-program-search]').fill('');
    await expect(visibleRows(page)).toHaveCount(total - 8);
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

  test('locks page scroll while the session dialog is open', async ({ page }) => {
    await page.goto('/');

    await page.locator('[data-speaker-open]').first().click();
    await expect(page.locator('body')).toHaveClass(/modal-open/);

    await page.locator('[data-session-close]').click();
    await expect(page.locator('body')).not.toHaveClass(/modal-open/);
  });

  test('opens the right session from the speakers wall, with that speaker\'s bio', async ({ page }) => {
    // tdc-speakers-refresh.js re-fetches Sessionize client-side; block it so
    // this reads the server-rendered wall, not a live API response that may
    // have moved on since the last build.
    await page.route('**sessionize.com/**', (route) => route.abort());
    await page.goto('/');

    // The wall (#speakers) sits outside the schedule (#program) entirely, so
    // this exercises the document-level listener that resolves data-session-id
    // back to a real session in the grid, not the root-scoped one.
    // Not every wall speaker has a session yet (see the fallback test below)
    // — pick one that does.
    const wallCard = page.locator('#speakers [data-speaker-open]:not([data-session-id=""])').first();
    const name = await wallCard.getAttribute('data-speaker-name');
    const sessionId = await wallCard.getAttribute('data-session-id');
    const session = page.locator(`[data-program-session][data-session-id="${sessionId}"]`);
    const expectedTitle = await session.getAttribute('data-session-title');

    await wallCard.click();

    const dialog = page.locator('[data-session-dialog]');
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('[data-session-modal-title]')).toHaveText(expectedTitle ?? '');
    await expect(dialog.locator('.session-speaker__name')).toContainText(name ?? '');
    // Came from outside the grid — closing should return focus there, not
    // into the schedule (open()'s own default).
    await page.locator('[data-session-close]').click();
    await expect(wallCard).toBeFocused();
  });

  test('falls back to a bio-only view for a speaker with no session yet', async ({ page }) => {
    await page.route('**sessionize.com/**', (route) => route.abort());
    await page.goto('/');

    // A speaker can be announced before Sessionize has them on a session,
    // which leaves data-session-id empty — seed that state rather than
    // depending on it being true of some real speaker on any given day (see
    // the topic-filter test above for the same "seed, don't rely on live
    // data" reasoning).
    const wallCard = page.locator('#speakers [data-speaker-open]').first();
    const name = await wallCard.getAttribute('data-speaker-name');
    await wallCard.evaluate((el) => { el.dataset.sessionId = ''; });

    await wallCard.click();

    const dialog = page.locator('[data-session-dialog]');
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('[data-session-modal-title]')).toHaveText(name ?? '');
    // Nothing session-specific to show or act on.
    await expect(page.locator('[data-session-modal-meta-row]')).toBeHidden();
    await expect(page.locator('.detail-modal__actions')).toBeHidden();
    // The block still carries their bio — just without repeating the name
    // the dialog title already gives.
    await expect(dialog.locator('.session-speaker__name')).toHaveCount(0);
    await expect(dialog.locator('.session-speaker__bio')).not.toBeEmpty();
  });

  test('keeps the close button and actions reachable while a long description scrolls, opened from the wall', async ({ page }) => {
    await page.route('**sessionize.com/**', (route) => route.abort());
    await page.setViewportSize({ width: 900, height: 420 });
    await page.goto('/');

    // Pick whichever wall speaker resolves to a session with the longest
    // description, so the dialog is guaranteed to actually scroll.
    const wallCards = page.locator('#speakers [data-speaker-open]');
    const count = await wallCards.count();
    let longestIndex = -1, longestLength = 0;
    for (let i = 0; i < count; i++) {
      const sessionId = await wallCards.nth(i).getAttribute('data-session-id');
      if (!sessionId) continue;
      const description = await page.locator(`[data-program-session][data-session-id="${sessionId}"]`).first().getAttribute('data-session-description');
      if (description && description.length > longestLength) {
        longestLength = description.length;
        longestIndex = i;
      }
    }
    expect(longestIndex).toBeGreaterThanOrEqual(0);
    await wallCards.nth(longestIndex).click();

    const close = page.locator('[data-session-close]');
    const favorite = page.locator('[data-session-modal-favorite]');
    // Opening runs inside a View Transition; give its (browser-default-length)
    // animation time to settle before measuring, or this reads an in-transit
    // position rather than the dialog's actual, final one.
    await page.waitForTimeout(350);
    const closeBefore = await close.boundingBox();

    await page.locator('[data-session-dialog] .detail-modal__scroll').evaluate((el) => el.scrollTo(0, el.scrollHeight));
    await expect(favorite).toBeVisible();
    await expect(page.locator('[data-calendar-toggle]')).toBeVisible();
    const closeAfter = await close.boundingBox();
    expect(closeAfter?.y).toBeCloseTo(closeBefore?.y ?? 0, 0);
  });
});
