// TDC website — main JS entry point. Active components only.
import "./components/tdc-nav.js";
import "./components/tdc-section.js";
import "./components/tdc-theme-toggle.js";
import "./components/tdc-program-modal.js";
import "./components/tdc-speaker-modal.js";
import "./components/tdc-faq.js";
// Clickable 8-bit duck mascot + easter eggs (lazy-loads the duck-mate engine).
import "./components/tdc-duck.js";
// Re-fetches Sessionize client-side so newly added speakers show up without a rebuild.
import "./components/tdc-speakers-refresh.js";

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
