// TDC website — main JS entry point. Active components only.
import { trackEvent } from "./analytics.js";
import "./components/tdc-nav.js";
import "./components/tdc-section.js";
import "./components/tdc-theme-toggle.js";
// The session dialog also renders speaker bios (merged, no separate modal) —
// see the "Program: the merged session/speaker dialog" note in AGENTS.md.
import "./components/tdc-program.js";
import "./components/tdc-faq.js";
// Right-click menu on the logo (copy SVG, download brand assets) + /brand/ copy buttons.
import "./components/tdc-brand.js";
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

  const EVENT_NAMES = {
    "ticket-click": "Ticket click",
    "interest-click": "Interest click",
    "video-click": "Video click",
  };

  document.addEventListener("click", (event) => {
    const tracked = event.target.closest("[data-analytics-event]");
    if (!tracked) return;

    const name = EVENT_NAMES[tracked.dataset.analyticsEvent];
    if (!name) return;

    const label = tracked.textContent.trim() || tracked.getAttribute("aria-label") || "";
    trackEvent(name, { label });
  });
});
