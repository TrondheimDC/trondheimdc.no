/**
 * <tdc-section> — Section wrapper with:
 * - Scroll-triggered reveal animation
 * - Lazy intersection observer
 */
class TdcSection extends HTMLElement {
  connectedCallback() {
    const section = this.querySelector("[data-animate]");
    if (!section) return;

    // Respect reduced motion
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      section.classList.add("is-visible");
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      {
        threshold: 0.1,
        rootMargin: "0px 0px -50px 0px",
      }
    );

    observer.observe(section);
  }
}

customElements.define("tdc-section", TdcSection);
