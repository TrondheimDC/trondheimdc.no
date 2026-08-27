/**
 * <tdc-nav> — Sticky navigation with:
 * - Mobile hamburger toggle
 * - Intersection Observer active section highlighting
 * - Smooth scroll
 * - URL hash sync
 */
class TdcNav extends HTMLElement {
  #activeSection = location.hash.slice(1) || "hero";

  connectedCallback() {
    this.toggle = this.querySelector(".site-nav__toggle");
    this.nav = this.querySelector(".site-nav");
    this.links = this.querySelectorAll(".site-nav__link[data-section]");

    // Mobile toggle
    this.toggle?.addEventListener("click", () => this.#toggleMenu());

    // Close menu on link click (mobile)
    this.links.forEach((link) => {
      link.addEventListener("click", (e) => {
        this.#closeMenu();
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
            // Update URL hash without scrolling (only when it changes).
            if (location.hash !== `#${id}`) {
              history.replaceState(null, "", `#${id}`);
            }
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

    // Hash changes made with replaceState do not create a Matomo page view by
    // themselves. Record each section as a virtual page so scrolling through
    // the single-page site is visible in the page reports.
    const tracker = window._paq = window._paq || [];
    const heading = section.querySelector("h1, h2, h3")?.textContent?.trim();
    tracker.push(["setCustomUrl", window.location.href]);
    tracker.push(["setDocumentTitle", heading ? `${document.title} — ${heading}` : document.title]);
    tracker.push(["trackPageView"]);
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
