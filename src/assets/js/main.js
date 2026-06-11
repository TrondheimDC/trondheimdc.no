// TDC website — main JS entry point. Active components only.
// Easter eggs (duck / duck-mate) are PARKED in src/easter-eggs/ and are
// intentionally NOT imported here — see AGENTS.md §7 to re-enable.
import "./components/tdc-nav.js";
import "./components/tdc-section.js";
import "./components/tdc-theme-toggle.js";

// Shuffle partner logos on load so no single partner is always first.
document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("[data-shuffle]").forEach((container) => {
    const children = Array.from(container.children);
    for (let i = children.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      container.appendChild(children[j]);
    }
  });
});
