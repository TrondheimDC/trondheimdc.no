/**
 * <tdc-nav> — Sticky navigation with:
 * - Mobile hamburger toggle
 * - Intersection Observer active section highlighting
 * - Smooth scroll
 * - URL hash sync
 */
class TdcNav extends HTMLElement {
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

    // Intersection Observer for active section
    this.#observeSections();
  }

  #toggleMenu() {
    const isOpen = this.nav.hasAttribute("data-open");
    if (isOpen) {
      this.nav.removeAttribute("data-open");
      this.toggle.setAttribute("aria-expanded", "false");
    } else {
      this.nav.setAttribute("data-open", "");
      this.toggle.setAttribute("aria-expanded", "true");
    }
  }

  #closeMenu() {
    this.nav?.removeAttribute("data-open");
    this.toggle?.setAttribute("aria-expanded", "false");
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
            // Update URL hash without scrolling
            history.replaceState(null, "", `#${id}`);
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

  #setActive(sectionId) {
    this.links.forEach((link) => {
      const isActive = link.dataset.section === sectionId;
      link.classList.toggle("site-nav__link--active", isActive);
    });
  }
}

customElements.define("tdc-nav", TdcNav);
