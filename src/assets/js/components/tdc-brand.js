import { trackEvent } from "../analytics.js";

/**
 * Brand assets: the logo's right-click menu and the copy buttons on /brand/.
 *
 * Right-clicking the logo (any [data-brand-target]: the nav and the footer)
 * opens #brand-menu instead of the browser's menu: copy the logo or wordmark
 * as SVG, download the zip, or go to /brand/. The copied SVG is the colour
 * on screen: green in the dark theme, red in the light one. Shift + right-click
 * still gives the browser's own menu, for "open link in new tab".
 */

const menu = document.querySelector("[data-brand-menu]");
const status = document.querySelector("[data-brand-status]");
let opener = null;

const items = () => [...menu.querySelectorAll('[role="menuitem"]')];

function lightTheme() {
  const theme = document.documentElement.dataset.theme;
  if (theme) return theme === "light";
  return matchMedia("(prefers-color-scheme: light)").matches;
}

// Safari only lets a clipboard write through if it starts inside the click,
// so hand ClipboardItem the fetch as a promise rather than awaiting it first.
async function copyText(textOrPromise) {
  if (window.ClipboardItem && navigator.clipboard?.write) {
    const blob = Promise.resolve(textOrPromise).then((text) => new Blob([text], { type: "text/plain" }));
    await navigator.clipboard.write([new ClipboardItem({ "text/plain": blob })]);
  } else {
    await navigator.clipboard.writeText(await textOrPromise);
  }
}

function fetchText(url) {
  return fetch(url).then((response) => {
    if (!response.ok) throw new Error(`${response.status} ${url}`);
    return response.text();
  });
}

function announce(text) {
  if (!status) return;
  status.textContent = "";
  requestAnimationFrame(() => { status.textContent = text; });
}

// ── The menu ──────────────────────────────────────────────────────────────
function openMenu(target, x, y) {
  opener = target;
  menu.showPopover();
  const { width, height } = menu.getBoundingClientRect();
  const left = Math.max(8, Math.min(x, innerWidth - width - 8));
  const top = y + height + 8 > innerHeight ? Math.max(8, y - height) : y;
  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;
  items()[0]?.focus();
}

function closeMenu() {
  if (menu.matches(":popover-open")) menu.hidePopover();
}

if (menu) {
  document.addEventListener("contextmenu", (event) => {
    const target = event.target.closest("[data-brand-target]");
    if (!target || event.shiftKey) return;
    event.preventDefault();
    // The keyboard's menu key (or Shift+F10) gives no pointer position.
    if (event.clientX === 0 && event.clientY === 0) {
      const rect = target.getBoundingClientRect();
      openMenu(target, rect.left, rect.bottom + 4);
    } else {
      openMenu(target, event.clientX, event.clientY);
    }
    trackEvent("Brand menu");
  });

  // popover="manual": an "auto" popover light-dismisses on the very mouseup
  // of the right-click that opened it, so outside clicks, Escape, scrolling
  // and resizing close it here instead.
  document.addEventListener("pointerdown", (event) => {
    if (!menu.contains(event.target)) closeMenu();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeMenu();
  });
  addEventListener("scroll", closeMenu, { passive: true });
  addEventListener("resize", closeMenu);
  addEventListener("blur", closeMenu);

  menu.addEventListener("toggle", (event) => {
    // Give focus back to the logo if the menu had it (Escape, or a choice).
    if (event.newState === "closed" && menu.contains(document.activeElement)) opener?.focus();
  });

  menu.addEventListener("keydown", (event) => {
    const list = items();
    const index = list.indexOf(document.activeElement);
    const move = { ArrowDown: index + 1, ArrowUp: index - 1, Home: 0, End: list.length - 1 }[event.key];
    if (move !== undefined) {
      event.preventDefault();
      list[(move + list.length) % list.length].focus();
    } else if (event.key === "Tab") {
      closeMenu();
    }
  });

  menu.addEventListener("click", async (event) => {
    const item = event.target.closest('[role="menuitem"]');
    if (!item) return;
    const kind = item.dataset.brandMenuCopy;
    if (!kind) {
      if (item.hasAttribute("download")) trackEvent("Brand download", { label: "zip" });
      closeMenu();
      return;
    }
    const color = lightTheme() ? "red" : "green";
    const url = `${menu.dataset.brandBase}tdc-${kind}-${color}.svg`;
    try {
      await copyText(fetchText(url));
      announce(menu.dataset.labelDone);
      trackEvent("Brand copy", { label: kind });
    } catch {
      // No clipboard (insecure context, refused): open the file instead.
      window.open(url, "_blank", "noopener");
    }
    closeMenu();
  });
}

// ── Copy buttons on /brand/ ──────────────────────────────────────────────
document.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-brand-copy], [data-brand-copy-text]");
  if (!button) return;
  const label = button.querySelector("[data-brand-copy-label]") ?? button;
  const original = label.dataset.original ?? label.textContent;
  label.dataset.original = original;
  let ok = true;
  try {
    await copyText(button.dataset.brandCopyText ?? fetchText(button.dataset.brandCopy));
  } catch {
    ok = false;
  }
  label.textContent = ok ? button.dataset.labelDone : button.dataset.labelFailed;
  announce(label.textContent);
  clearTimeout(button.brandTimer);
  button.brandTimer = setTimeout(() => { label.textContent = original; }, 1600);
});
