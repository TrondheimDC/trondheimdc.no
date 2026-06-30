/**
 * <tdc-section> — Section wrapper with:
 * - Scroll-triggered reveal animation
 * - Lazy intersection observer
 */
class TdcSection extends HTMLElement {
  connectedCallback() {
    const section = this.querySelector("[data-animate]");
    if (!section) return;

    const reveal = () => {
      section.classList.add("is-visible");
      // Runtime fallback: some environments keep opacity at 0 despite the
      // visible class being present. Inline styles guarantee readability.
      section.style.opacity = "1";
      section.style.transform = "none";
    };

    // Respect reduced motion
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      reveal();
      return;
    }

    // Fallback for very old browsers.
    if (!("IntersectionObserver" in window)) {
      reveal();
      return;
    }

    // If the section is already in view at startup (e.g. hash navigation),
    // show it immediately so it never gets stuck hidden.
    const rect = section.getBoundingClientRect();
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    if (rect.top < viewportHeight && rect.bottom > 0) {
      reveal();
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            reveal();
            observer.unobserve(entry.target);
          }
        });
      },
      {
        threshold: 0,
        rootMargin: "0px 0px -10% 0px",
      }
    );

    observer.observe(section);
  }
}

customElements.define("tdc-section", TdcSection);
