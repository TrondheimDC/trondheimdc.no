// <tdc-theme-toggle> — light-DOM custom element that flips between dark and
// light themes, persists the choice in localStorage, and falls back to the
// OS preference. UI labels are localised by the template via data-* attrs:
//   <tdc-theme-toggle data-label-light="Bytt til lyst tema"
//                     data-label-dark="Bytt til mørkt tema"></tdc-theme-toggle>
const STORAGE_KEY = "tdc-theme";

function systemTheme() {
  return window.matchMedia("(prefers-color-scheme: light)").matches
    ? "light"
    : "dark";
}

function storedTheme() {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    /* storage unavailable (private mode) — theme still applies for the session */
  }
}

const SUN = `<svg class="theme-toggle__sun" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>`;
const MOON = `<svg class="theme-toggle__moon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;

class TdcThemeToggle extends HTMLElement {
  connectedCallback() {
    this._theme =
      document.documentElement.dataset.theme || storedTheme() || systemTheme();

    this.innerHTML = `<button type="button" class="theme-toggle">${SUN}${MOON}<span class="visually-hidden" data-label></span></button>`;
    this._button = this.querySelector("button");
    this._label = this.querySelector("[data-label]");
    this._button.addEventListener("click", () => this._toggle());
    this._sync();
  }

  _toggle() {
    this._theme = this._theme === "light" ? "dark" : "light";
    applyTheme(this._theme);
    this._sync();
  }

  _sync() {
    const isLight = this._theme === "light";
    this._button.setAttribute("aria-pressed", String(isLight));
    this.dataset.theme = this._theme;
    // Label describes the action (what clicking will switch to).
    const fallback = isLight ? "Switch to dark mode" : "Switch to light mode";
    this._label.textContent =
      (isLight ? this.dataset.labelDark : this.dataset.labelLight) || fallback;
    this._button.setAttribute("aria-label", this._label.textContent);
    this._button.setAttribute("title", this._label.textContent);
  }
}

customElements.define("tdc-theme-toggle", TdcThemeToggle);
