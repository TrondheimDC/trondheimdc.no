import { trackPageview } from "../analytics.js";

/**
 * <tdc-nav> — Sticky navigation with:
 * - Mobile hamburger toggle
 * - Intersection Observer active section highlighting
 * - Smooth scroll
 * - A page view per section scrolled to (a nav click is counted by its hash change)
 */
class TdcNav extends HTMLElement {
  #activeSection = location.hash.slice(1) || "hero";
  // The page as loaded: a talk dialog later puts its own page in the address bar.
  #pageUrl = location.href.split("#")[0];
  // Section a nav click is jumping to; Plausible already counted that hash change.
  #navTarget = "";

  connectedCallback() {
    this.toggle = this.querySelector(".site-nav__toggle");
    this.nav = this.querySelector(".site-nav");
    this.links = this.querySelectorAll(".site-nav__link[data-section]");

    // Mobile toggle
    this.toggle?.addEventListener("click", () => this.#toggleMenu());

    // Close menu on link click (mobile)
    this.links.forEach((link) => {
      link.addEventListener("click", () => {
        this.#closeMenu();
        if (!link.classList.contains("site-nav__link--active")) this.#navTarget = link.dataset.section;
      });
    });

    // Close on Escape
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") this.#closeMenu();
    });

    // Add a "scrolled" state for the sticky background treatment.
    this.#trackScroll();

    // Intersection Observer for active section
    this.#observeSections();
  }

  #trackScroll() {
    const onScroll = () => {
      this.nav?.toggleAttribute("data-scrolled", window.scrollY > 8);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  #toggleMenu() {
    const isOpen = this.nav.hasAttribute("data-open");
    if (isOpen) {
      this.nav.removeAttribute("data-open");
      this.toggle.setAttribute("aria-expanded", "false");
      this.toggle.setAttribute("aria-label", this.toggle.dataset.menuLabel);
    } else {
      this.nav.setAttribute("data-open", "");
      this.toggle.setAttribute("aria-expanded", "true");
      this.toggle.setAttribute("aria-label", this.toggle.dataset.menuCloseLabel);
    }
  }

  #closeMenu() {
    this.nav?.removeAttribute("data-open");
    this.toggle?.setAttribute("aria-expanded", "false");
    this.toggle?.setAttribute("aria-label", this.toggle?.dataset.menuLabel || "");
  }

  #observeSections() {
    const sections = document.querySelectorAll("section[id]");
    if (!sections.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const id = entry.target.id;
            this.#setActive(id);
            this.#trackSectionView(entry.target);
          }
        });
      },
      {
        rootMargin: "-20% 0px -60% 0px",
        threshold: 0,
      }
    );

    sections.forEach((section) => observer.observe(section));
  }

  #trackSectionView(section) {
    const id = section.id;
    if (this.#activeSection === id) return;
    this.#activeSection = id;

    // A standalone page is one URL, already counted on load.
    if (this.hasAttribute("data-standalone")) return;

    // A nav click already counted this section as a hash change.
    if (id === this.#navTarget) {
      this.#navTarget = "";
      return;
    }
    trackPageview(`${this.#pageUrl}#${id}`);
  }

  #setActive(sectionId) {
    this.links.forEach((link) => {
      const isActive = link.dataset.section === sectionId;
      link.classList.toggle("site-nav__link--active", isActive);
      if (isActive) link.setAttribute("aria-current", "location");
      else link.removeAttribute("aria-current");
    });
  }
}

customElements.define("tdc-nav", TdcNav);
