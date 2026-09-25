# AGENTS.md — Trondheim Developer Conference website

Conventions, commands, and learnings for AI agents and humans working in this repo.
Keep this file up to date as the project evolves.

---

## 1. Repository overview

This repo hosts **two** sites side by side:

| Path  | Stack          | Role                                | Deploys to                          |
| ----- | -------------- | ----------------------------------- | ----------------------------------- |
| `src/`| Eleventy 3 + Bun | **Current production**            | site root, via `.github/workflows/cd.yml` (push to `main`) |
| `old/`| Jekyll (Ruby)  | **Retired** (kept for reference)    | no longer built or deployed |

Production is now the Eleventy site in `src/`, served from the site root. Notes:

- `old/` is the **legacy Jekyll site**, kept as a content/reference archive. Treat it as **read-only**; it is no longer built or deployed.
- The default git branch is **`main`** (not `master`) for this repo.

---

## 2. Commands

All commands for the new site run from `src/` using **Bun** (a `bun.lock` is committed).

```bash
# from src/
bun install            # install deps
bun run dev            # eleventy --serve --watch (local dev server)
bun run build          # eleventy -> outputs to src/_site/
bun run clean          # rm -rf _site

# optional: build under a subpath for staging (defaults to "/")
ELEVENTY_PATH_PREFIX=/staging/ bun run build
```

E2E tests run from `src/tests/` using Playwright, against the built `src/_site`:

```bash
# from src/tests/
npm install
npx playwright test            # serves ../_site on :4000 itself
```

CSS and JS are **passthrough-copied**, so rebuild (`bun run build`) before
testing or screenshotting — editing a stylesheet alone leaves `_site` stale.

**Always build and run the smoke tests before pushing.**

---

## 3. Architecture (new site)

- **Single-page** site. All content lives in **sections** on one scrolling page, reached via in-page anchors (Code of Conduct, partner info, etc. are all sections).
  - The one exception: `/program/` and `/en/program/` render `sections/program.njk` on their own, for people who would rather read the schedule without the single page around it. They are **unlisted** — nothing links to them, and `default.njk` canonicals them to the home page so they don't compete with it in search.
  - Pages that aren't a home page set `standalone: true` in front matter. That flag makes `partials/nav.njk` prefix its section anchors with the home URL (bare `#about` has no target off the home page) and promotes the program section's heading to `<h1>`. Such pages also set `noUrl`/`enUrl` so the language switch crosses to the matching translation instead of the home pages.
- **Bilingual** via directory-based i18n:
  - Norwegian (default) renders at `/` from `index.njk` (`lang: no`).
  - English renders at `/en/` from `en/index.njk` (`lang: en`).
- **Path-prefix aware**: every internal URL and asset reference must respect `ELEVENTY_PATH_PREFIX` (use the Eleventy `url` filter / `pathPrefix`), so preview deploys under a subfolder work.

### Directory layout (`src/`)

```
src/
  eleventy.config.js        # filters, plugins, passthrough, dir config
  package.json              # bun scripts
  _lib/                     # build-only helpers (not templates, not shipped)
  _data/
    site.js                 # global config + featureFlags (e.g. easterEggs)
    i18n.js                 # UI strings / labels only, keyed { no, en }
    partners.js             # partner list: [{ name, url, logo }]
  _layouts/                 # base.njk, home.njk
  _includes/
    partials/               # head, nav, footer, partner-wall, theme-toggle, language-switch
    sections/               # one .njk per homepage section
    content/no/*.md         # long-form prose (Norwegian)
    content/en/*.md         # long-form prose (English)
  index.njk                 # NO home  (permalink /)
  en/index.njk              # EN home  (permalink /en/)
  program/index.njk         # unlisted standalone program page (permalink /program/)
  en/program/index.njk      # unlisted standalone program page (permalink /en/program/)
  program-ics.11ty.js       # one .ics per session -> /program/<session-id>.ics
  assets/
    css/                    # design system (see §5)
    fonts/                  # self-hosted IBM Plex Sans (woff2)
    js/                     # main.js + components/ (active web components only)
    images/                 # logos, partners/, social, headers
  easter-eggs/              # PARKED, not imported anywhere (see §7)
```

Long-form Markdown under `_includes/content/{no,en}/` is rendered into sections via Eleventy's RenderPlugin (`{% renderFile %}`).

---

## 4. Content & i18n conventions

- **UI strings / labels** (nav items, button text, short headings) live in `_data/i18n.js` as `{ no: {...}, en: {...} }`, accessed via the `t` filter or `i18n[lang]`. Use dot-notation keys (e.g. `nav.about`).
- **Long-form prose** (about text, CoC body, practical info, volunteer info, partner pitch) lives as **Markdown** under `_includes/content/{no,en}/`, one file per section per language. Render it through the markdown filter — do not paste paragraphs into `i18n.js`.
- Keep NO and EN content in sync structurally; if a section exists in one language it should exist in the other.
- Dates/times: the conference is **Monday 19 October 2026**, venue **Clarion Hotel & Congress Trondheim, Brattørkaia 1**.

---

## 5. Design system (CSS)

The design system is documented in [`docs/design.md`](docs/design.md) (mirrors the Figma file, which is the ultimate source of truth). **Use the exact token names from that document.**

- **Token tiers (2):** *primitive* (`--color-green-1`, `--color-black`, `--spacing-4`, `--radius-md`, `--font-size-60`, `--bp-md`) → *semantic* (`--color-bg-base`, `--color-fg-brand`, …). Components use **semantic tokens only**; never hardcode hex values and never reach for primitives directly in component CSS.
- **No `--tdc-` prefix.** (The old `src/` used `--tdc-*`; that scheme is discarded.)
- **Dark mode is the default** (defined on `:root`). Light mode is the override, applied via `[data-theme="light"]` **and** `@media (prefers-color-scheme: light)`.
- **CSS cascade layers**, entry point `assets/css/main.css`:
  `@layer settings, base, primitives, layout, components, utilities;`
- **Mobile-first**, `min-width` media queries only — never `max-width`.
- **Fonts** (self-hosted woff2 in `assets/fonts/`, sourced from `@fontsource`): body = **IBM Plex Sans**, headings/display = **Space Grotesk**, mono/UI = **Space Mono** (per `docs/design.md` v7.0, which replaced the earlier Consolas/IBM Plex Mono pairing). Do **not** load Google Fonts (privacy/GDPR — the site uses Matomo, not Google Analytics).

### ⚠️ Breakpoint caveat

`docs/design.md` shows `@media (min-width: var(--bp-md))`, but **CSS media queries cannot use `var()`**. Keep the `--bp-*` tokens for JS and reference, but in `@media` rules use the **literal px** values:

| token     | px   |
| --------- | ---- |
| `--bp-sm` | 480  |
| `--bp-md` | 768  |
| `--bp-lg` | 1024 |
| `--bp-xl` | 1280 |
| `--bp-2xl`| 1440 |

(Alternatively, introduce PostCSS `custom-media` later; for now, literal px in `@media`.)

### Responsive typography

Display / H1 / Body-Lead have different desktop vs. mobile sizes (see `docs/design.md`). Use `clamp()` or `min-width` overrides — don't ship only the desktop size.

---

## 6. Web components

- We build **standalone custom elements**, **not** a component library/framework.
- Naming: `tdc-` prefix (e.g. `<tdc-nav>`, `<tdc-section>`, `<tdc-theme-toggle>`).
- **Light DOM** (no Shadow DOM) so the design-system CSS applies — components are styled by the design tokens / component CSS, not by inline `<style>` in a shadow root.
- Register active components by importing them in `assets/js/main.js`. Only import components that are actually used.
- Progressive enhancement: pages must be readable and usable if JS fails; components enhance, they don't gate content.

---

## 7. Easter eggs (active)

The interactive duck mascot **is enabled**. The clickable 8-bit duck lives in the
hero as `<tdc-duck>` (`assets/js/components/tdc-duck.js`, imported by `main.js`;
styles in `assets/css/04-components/duck.css`).

Interactions: click → quack + confetti, double-click → spin, drag → move,
five quick clicks → party mode, ten quacks → TDuckC logo combo.

The heavy eSheep-style **`duck-mate` canvas engine** (`assets/js/duck-mate.js` +
`assets/css/duck-mate.css`) is **lazy-loaded** — it is only fetched the first
time party mode spawns a companion, never on initial page load. Keep it that way
so the engine stays out of the critical render/JS path.

The smoke test `Duck mascot` guards this contract: the mascot must be visible on
load, and `duck-mate.*` must not be requested until party mode runs.

---

## 8. Calendar export

The program's "add to calendar" button offers Google Calendar and Outlook deep
links plus a downloadable `.ics`; the toolbar exports every saved talk as one
file.

- The iCalendar writer is `assets/js/calendar.js`, shared by the browser and by
  the build (`_lib/session-calendar.js`), the same way `sessionize-client.js` is
  shared — so the static per-session files and the client-side export can't drift.
- Per-session `.ics` files are **generated at build time** and served from
  `/program/<session-id>.ics`. They are real URLs on purpose: a served file is
  what lets iOS hand the event to the calendar app. Do not swap these back to a
  client-side Blob. (Android Chrome downloads `.ics` regardless — a browser
  limitation, which is why the Google link is listed first.)
- Calendar contents are **English only, in both languages**. Sessionize gives us
  titles and abstracts in whatever language the speaker submitted, so the few
  labels around them live as constants in `calendar.js`, not in `i18n.js`.
- The saved-talks export stays a Blob: favourites only exist in `localStorage`.

## 9. Program: the merged session/speaker dialog, and the live view

- There is **one** detail dialog (`[data-session-dialog]` in
  `sections/program.njk`, owned by `TdcProgram`), not a separate speaker one —
  it shows the session (meta, title, description, favorite, calendar) *and*
  every speaker on it (avatar, tagline, bio, socials — built by
  `renderSpeakers()`/`buildSpeakerBlock()` from that session's own
  `[data-speaker-open]` buttons) in one scroll. `tdc-speaker-modal.js` and
  `partials/speaker-modal.njk` are gone; don't recreate them.
  - The section heading reads singular (`t.program.speaker_singular`,
    "Foredragsholder"/"Speaker") for exactly one speaker and plural
    (`t.program.speaker_plural`, reusing the existing "Foredragsholdere"/
    "Speakers" wording) for more — `setSpeakersTitleCount()`, called from
    `renderSpeakers()`. The heading text lives in JS, not the template; the
    static Nunjucks text is only the no-JS/pre-render fallback.
  - **Clicking anywhere on a non-service card opens it** (`event.target.closest(".program-session--favoritable")`
    in `TdcProgram`'s root click handler), not just its title — the title
    button (`[data-session-open]`) still exists and still works on its own,
    it's just no longer the only way in. Service sessions never get
    `--favoritable`, so breaks etc. stay inert.
  - The **speakers wall** (`#speakers`, a separate section from `#program`)
    opens the *same* dialog via `openFromSpeaker()`, reached by a
    **document-level** click listener (the wall sits outside `TdcProgram`'s
    root-scoped one). Each wall card carries `data-session-id` (the id of
    `speaker.sessions[0]`) so it can be resolved to a real
    `[data-program-session]` in the grid; the wall card's own bio/social
    attributes are otherwise unused once that resolves — the dialog always
    reads speaker data from the *session's* nested buttons, so it's identical
    regardless of whether you opened it from the schedule or the wall.
  - **A speaker can be announced before Sessionize has them on a session** —
    `data-session-id` is then empty, and `openSpeakerOnly()` falls back to a
    bio-only view (name as the dialog title, no meta/description/favorite/
    calendar, one speaker block with the name line skipped since the title
    already gives it). Not hypothetical — real data hits this whenever
    Sessionize hasn't slotted someone in yet.
  - **`sessionById()`'s `speaker.sessions[0]` lookup was silently broken for
    every speaker** until fixed in `sessionize-client.js`. Two shapes show up
    in the wild: the Speakers embed gives `{ id: <number>, ... }`, and the
    All API CI uses gives bare numbers (`[1177297]`). Session ids everywhere
    else are strings, so a strict `===` never matched — and treating a bare
    number as an object (`session?.id`) dropped every backlink entirely.
    Accept string / number / `{id}`, then coerce to `String(...)`. Don't trust
    `apiValue()` to do it; it passes values through as-is. The Nunjucks
    `sessionById` filter and the client-side wall builder compare with
    `String(...)` on both sides for the same reason.
  - The dialog wears `.detail-modal` (`assets/css/04-components/detail-modal.css`):
    a sticky header that keeps the close button reachable, a scrolling body,
    and a sticky footer (favorite + calendar) that stays reachable too, so a
    long description or bio never buries them below the fold. Give a new
    dialog this shell by adding `detail-modal` to its own class list and
    wrapping content in `.detail-modal__header` / `.detail-modal__scroll` /
    `.detail-modal__actions`.
    - **`.detail-modal` sets its own `display: flex`, which silently
      overrides the UA stylesheet's `dialog:not([open]) { display: none }`**
      — author styles beat UA styles regardless of specificity.
      `detail-modal.css` restates `.detail-modal:not([open]) { display: none }`
      to compensate; any new dialog using this shell needs that same rule, or
      it stays in normal flow and intercepts clicks on whatever renders after
      it while "closed". The same gotcha applies to anything *inside* the
      dialog that's conditionally hidden and sets its own `display` (see
      `.program-session-modal__meta[hidden]` / `.detail-modal__actions[hidden]`,
      both needed for the bio-only fallback above).
  - On phones the dialog caps at `85dvh` (`max-height`, `height: fit-content`),
    not `100dvh` — full height read as a wall of white with the backdrop gone
    entirely; leaving room above/below (and rounding the corners back on)
    reads as a sheet, not a takeover.
  - **Press feedback starts on mouse down/tap, not on click** — a plain CSS
    `:active` scale on `.program-session--favoritable` (a `transition`, not a
    `@keyframes` animation, so it holds correctly for however long the card
    is actually pressed rather than playing to a fixed length regardless).
    The star is its own control, so
    `.program-session--favoritable:has(.program-session__favorite:active)`
    cancels that scale while the favorite is the press target — otherwise
    starring a talk would squash the whole card under the star's own pop.
    `-webkit-tap-highlight-color: transparent` is required alongside it: the
    card is the primary click target now (not just its title button), and
    without it mobile Chrome shows its own default flash *on top of* the
    custom feedback. `.program-schedule__row` clips horizontal paint
    (`overflow-x: clip`): a keynote already fills the row, so the press
    scale otherwise paints a pixel past it and the grid flashes a
    horizontal scrollbar until the transform ends.
  - **Opening/closing the dialog runs inside a View Transition**
    (`TdcProgram.withViewTransition()`), feature-detected
    (`document.startViewTransition`) and skipped under
    `prefers-reduced-motion: reduce`, so it's always safe to call — cross-
    fades the dialog + backdrop in/out instead of them just appearing.
    `.detail-modal`/`.detail-modal::backdrop` carry their own
    `view-transition-name`, and `::view-transition-old(root)` /
    `::view-transition-new(root)` are turned off (`animation: none`), so only
    the dialog itself visibly transitions — without that, the *entire page*
    (including the schedule behind it) would cross-fade as one group by
    default.
    - **The callback passed to `startViewTransition()` can run as a deferred
      microtask, not synchronously within the same call** — code the caller
      runs "after" `open()` in the same synchronous turn can execute *before*
      the callback does, and then get silently overwritten once the callback
      finally runs. `open()` takes its `returnFocusTo` override as a second
      argument for exactly this reason, applied *inside* the callback,
      instead of the caller setting `this.returnFocus` right after calling
      `open()` — that raced the transition and lost. Tests that read layout
      (`boundingBox()`) right after opening/closing need a short wait first,
      for the same reason: they can read an in-transit position otherwise.
    - **`.site-nav` (sticky, visible on every page) needs its own
      `view-transition-name` too** (`nav.css`), or it gets bundled into the
      document-wide "root" snapshot the dialog's transition still takes —
      captured at its natural, *unstuck* document position rather than its
      current on-screen one, which reads as the nav vanishing and snapping
      back the instant live rendering resumes. Any other always-visible
      sticky/fixed element added later needs the same treatment; things only
      visible *within* the dialog (its own sticky header/actions) don't,
      since they're already part of the dialog's own named, bounded snapshot.
    - **Reset the dialog's own scroll position (`.detail-modal__scroll`) on
      every open** — it's the same reused DOM node across sessions, so
      without this a session opened after a long one you'd scrolled through
      reopens partway down. Do it *after* `showModal()`, not before:
      `scrollTo()` on a still-`display: none` element (i.e. before it's
      shown) has no layout box to scroll and is a silent no-op.
- The **live ("EPG") view** (`assets/js/components/tdc-program-live.js`, owned by
  `TdcProgram`) follows the conference day in real time: finished time slots
  collapse out of the grid and a playhead creeps down the current slot.
  - It is **opt-out**: on by default while the day runs (±2h/1h either side),
    off on every other date whatever is stored, and the toolbar toggle is
    remembered in `localStorage`.
  - A search suspends the collapse — a talk you search for must be findable
    after it has been given.
  - The playhead only **creeps** through a row on the wide grid (from 1200px,
    where rooms are columns and row height is empty time). It is repositioned
    every frame there, so it keeps moving with the clock between the slower
    collapse refreshes — a 30s tick left it looking stuck. Below 1200px rooms
    stack as cards, so the same height is "how many talks run at once" — the
    line **snaps** to the row's top edge there instead of pointing into the
    stack (see the `stacked` branch in `positionPlayhead()`).
  - Preview it on any date with `?live=1`, and pick a moment with
    `?now=2026-10-19T13:00:00+02:00` (the clock then ticks on from there). The
    smoke tests use exactly this.
  - Times are formatted in **Europe/Oslo**, not the reader's timezone — the
    Trondheim clock against the Trondheim program.

## 10. Partners

- The partner logo wall renders **near the footer** (as in the old site), on every render of the page.
- It is **data-driven** from `_data/partners.js` (`[{ name, url, logo }]`) — no hardcoded `<li>` list.
- Order is **shuffled** for fairness (build-time filter or small client-side shuffle).
- Logos live in `assets/images/partners/`. Per-theme (dark/light) logo variants are a **known later task** — for now render logos on a consistent backdrop that works in both themes.

---

## 11. Learnings

- CSS `@media` can't read `var()` → use literal px for breakpoints (see §5).
- **Setting your own `display` on an element that has a UA "hidden" state
  silently defeats that state — restate it explicitly, every time.** Two
  different mechanisms, same fix:
  - The UA's `[hidden] { display: none }` loses to any author `display` rule
    at equal specificity (source order breaks the tie, and ours loads after
    the UA sheet). Bit us twice on the live view (`.program-schedule__row`
    with `display: grid`, `.program-schedule__live-earlier` with
    `display: inline-flex`) — each needed an explicit
    `.foo[hidden] { display: none }` alongside it. Test with `:visible`, not
    `:not([hidden])`, or a passing test can hide this.
  - The UA's `dialog:not([open]) { display: none }` loses outright — author
    styles beat UA styles regardless of specificity. `.detail-modal`
    (`detail-modal.css`) sets `display: flex`, so it needs
    `.detail-modal:not([open]) { display: none }` right alongside it, or the
    closed dialog stays in normal flow and intercepts clicks on whatever
    renders after it.
- **Sessionize's public embed endpoints now return JSON, not the HTML
  fragments `sessionize-client.js`'s own comments describe** — confirmed by
  fetching `.../view/Sessions` and `.../view/Speakers` directly. Build time
  (`_data/sessionize.js`) copes: it tries `JSON.parse()` first and only falls
  back to the regex fragment parsers (`parseSessions`/`parseSpeakers`) if that
  fails, so `parseApiData()` is what's actually live. **The client-side
  refresh (`tdc-speakers-refresh.js`) does not** — it calls the regex parsers
  directly against what is now JSON text, which matches nothing, so
  `refreshSpeakers()`/`refreshProgram()` silently no-op (their own "got
  nothing usable" guards catch it) on every real page load. The
  re-fetch-on-load feature this file's top comment describes has likely been
  fully inert for a while. Not fixed here — porting the client refresh to
  JSON parsing is a separate, larger job than whatever prompted you to read
  this — but don't be surprised when it doesn't do anything.
- Dark is the default theme; light is the override (don't invert this).
- `old/` is Jekyll and still production — never break it while iterating on `src/`.
- Respect `ELEVENTY_PATH_PREFIX` for all internal links/assets, or preview deploys break.
