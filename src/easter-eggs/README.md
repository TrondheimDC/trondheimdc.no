# Easter eggs (parked) 🥚🦆

This folder holds the TDC easter eggs. They are **disabled by default** and are
**not part of the build**: nothing here is imported by `assets/js/main.js` or
`assets/css/main.css`, and this folder is intentionally excluded from the
Eleventy passthrough copy (see `eleventy.config.js`). So none of this ships or
makes any network requests until you deliberately re-enable it.

## What's here

| File | What it is |
| --- | --- |
| `components/tdc-duck.js` | `<tdc-duck>` web component — the clickable TDC rubber-duck mascot (quacks, drag, party mode, TDuckC logo combo). |
| `duck-mate.js` | Framework-free canvas "duck mate" companion engine (eSheep-style). |
| `duck-mate.css` | Styles for the duck-mate companion. |

The duck-mate **sprite + data** (`atlas.json`, `config.json`, sprite sheet)
are not stored here; see the repo-root `duck-mate/` folder for reference assets.

## How to re-enable

1. **Move the files back into the build tree:**
   - `easter-eggs/duck-mate.js` → `assets/js/duck-mate.js`
   - `easter-eggs/components/tdc-duck.js` → `assets/js/components/tdc-duck.js`
   - `easter-eggs/duck-mate.css` → `assets/css/duck-mate.css`

2. **Re-add the imports:**
   - In `assets/js/main.js`: `import "./components/tdc-duck.js";`
   - In `assets/css/main.css`: `@import "duck-mate.css";`

3. **Restore the path-prefix hint** that `tdc-duck.js` reads for asset URLs.
   Add this back to `<head>` in `_layouts/default.njk`:
   ```njk
   <meta name="path-prefix" content="{{ '/' | url }}">
   ```

4. **Place the mascot** where you want it, e.g. in `_includes/sections/hero.njk`:
   ```html
   <tdc-duck></tdc-duck>
   ```

5. **Provide the duck-mate assets.** Ensure the engine can load its
   `atlas.json` / `config.json` / sprite (use the repo-root `duck-mate/` as the
   source) and adjust the loader path in `duck-mate.js` if needed.

6. **Build and verify:** `bun run build`, then load the page and confirm the
   duck appears and the related network requests resolve.

> Keep easter eggs out of `eleventy.config.js` passthrough while parked — that
> single exclusion is what keeps them from shipping. See AGENTS.md §7.
