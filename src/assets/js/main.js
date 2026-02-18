// TDC 2026 — Main JS entry point
import "./components/tdc-nav.js";
import "./components/tdc-section.js";
import "./components/tdc-duck.js";

// Shuffle partner logos on load
document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("[data-shuffle]").forEach((container) => {
    const children = Array.from(container.children);
    for (let i = children.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      container.appendChild(children[j]);
    }
  });
});
