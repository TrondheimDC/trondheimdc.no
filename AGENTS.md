# AGENTS.md — Trondheim Developer Conference website

Conventions, commands, and learnings for AI agents and humans working in this repo.
Keep this file up to date as the project evolves.

---

## 1. Repository overview

This repo hosts **two** sites side by side:

| Path  | Stack          | Role                                | Deploys to                          |
| ----- | -------------- | ----------------------------------- | ----------------------------------- |
| `old/`| Jekyll (Ruby)  | **Current production**              | site root, via `.github/workflows/cd.yml` (push to `main`) |
| `src/`| Eleventy 3 + Bun | **New site (active development)** | preview path `/secret_new_duck_site/`, via `.github/workflows/deploy-preview.yml` (manual) |

We are **rebuilding `src/` from scratch** as a single-page site and will eventually cut production over from `old/` to `src/`. Until then:

- `old/` is the **content source of truth** for migration. Treat it as **read-only**.
- Do **not** touch the CI workflows' production behaviour without explicit instruction (the old site must keep serving).
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

# preview/staging build with a path prefix (mirrors deploy-preview.yml)
ELEVENTY_PATH_PREFIX=/secret_new_duck_site/ bun run build
```

E2E tests run from `tests/` using Playwright:

```bash
# from tests/
npm install
npx playwright test            # or: npm test
npm run test:ci                # list reporter (CI)
```

**Always build and run the smoke tests before pushing.**

---

## 3. Architecture (new site)

- **Single-page** site. All content lives in **sections** on one scrolling page. There are **no standalone content pages** (Code of Conduct, partner info, etc. are all sections, reached via in-page anchors).
- **Bilingual** via directory-based i18n:
  - Norwegian (default) renders at `/` from `index.njk` (`lang: no`).
  - English renders at `/en/` from `en/index.njk` (`lang: en`).
- **Path-prefix aware**: every internal URL and asset reference must respect `ELEVENTY_PATH_PREFIX` (use the Eleventy `url` filter / `pathPrefix`), so preview deploys under a subfolder work.

### Directory layout (`src/`)

```
src/
  eleventy.config.js        # filters, plugins, passthrough, dir config
  package.json              # bun scripts
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
- **Font:** IBM Plex Sans (self-hosted woff2 in `assets/fonts/`), mono = Consolas (system). Do **not** load Google Fonts (privacy/GDPR — the site uses Matomo, not Google Analytics).

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

## 7. Easter eggs (parked)

The interactive duck mascot and the `duck-mate` canvas engine are **disabled by default** and live in `src/easter-eggs/` (not imported by `main.js`/`main.css`, not referenced by any template).

To re-enable later:

1. Move/keep the component at `assets/js/components/tdc-duck.js` and import it in `assets/js/main.js`.
2. Add `<tdc-duck></tdc-duck>` to the hero section.
3. Ensure `duck-mate.js` / `duck-mate.css` (and `atlas.json`, `config.json`) are served (passthrough) so the component can lazy-load them.
4. Flip `featureFlags.easterEggs` in `_data/site.js` if/when wired to a flag.

Keep easter-egg code out of the critical render/JS path while parked.

---

## 8. Partners

- The partner logo wall renders **near the footer** (as in the old site), on every render of the page.
- It is **data-driven** from `_data/partners.js` (`[{ name, url, logo }]`) — no hardcoded `<li>` list.
- Order is **shuffled** for fairness (build-time filter or small client-side shuffle).
- Logos live in `assets/images/partners/`. Per-theme (dark/light) logo variants are a **known later task** — for now render logos on a consistent backdrop that works in both themes.

---

## 9. Learnings

- CSS `@media` can't read `var()` → use literal px for breakpoints (see §5).
- Dark is the default theme; light is the override (don't invert this).
- `old/` is Jekyll and still production — never break it while iterating on `src/`.
- Respect `ELEVENTY_PATH_PREFIX` for all internal links/assets, or preview deploys break.
