/**
 * TDC Section Component
 * Lazy-loaded section with scroll animations
 */

class TDCSection extends HTMLElement {
  static get observedAttributes() {
    return ['id', 'variant', 'lazy'];
  }

  constructor() {
    super();
    this.observer = null;
    this.isLoaded = false;
  }

  connectedCallback() {
    this.setupSection();
    this.setupLazyLoading();
    this.setupAnimations();
  }

  disconnectedCallback() {
    if (this.observer) {
      this.observer.disconnect();
    }
  }

  get variant() {
    return this.getAttribute('variant') || '';
  }

  get isLazy() {
    return this.hasAttribute('lazy');
  }

  setupSection() {
    // Add section class
    this.classList.add('section');

    // Add variant class if specified
    if (this.variant) {
      this.classList.add(`section--${this.variant}`);
    }

    // Set role for accessibility
    if (!this.hasAttribute('role')) {
      this.setAttribute('role', 'region');
    }

    // Ensure aria-labelledby if there's a heading
    const heading = this.querySelector('h1, h2, h3');
    if (heading && !this.hasAttribute('aria-labelledby')) {
      if (!heading.id) {
        heading.id = `${this.id}-heading`;
      }
      this.setAttribute('aria-labelledby', heading.id);
    }
  }

  setupLazyLoading() {
    if (!this.isLazy) return;

    // Hide content initially
    this.style.opacity = '0';

    const options = {
      rootMargin: '200px 0px',
      threshold: 0
    };

    this.observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && !this.isLoaded) {
          this.loadContent();
          this.observer.disconnect();
        }
      });
    }, options);

    this.observer.observe(this);
  }

  loadContent() {
    this.isLoaded = true;

    // Load lazy images
    const lazyImages = this.querySelectorAll('img[data-src]');
    lazyImages.forEach(img => {
      img.src = img.dataset.src;
      img.removeAttribute('data-src');
    });

    // Load lazy iframes
    const lazyIframes = this.querySelectorAll('iframe[data-src]');
    lazyIframes.forEach(iframe => {
      iframe.src = iframe.dataset.src;
      iframe.removeAttribute('data-src');
    });

    // Fade in section
    this.style.transition = 'opacity 0.5s ease';
    this.style.opacity = '1';

    // Dispatch loaded event
    this.dispatchEvent(new CustomEvent('section-loaded', {
      bubbles: true,
      detail: { sectionId: this.id }
    }));
  }

  setupAnimations() {
    // Find all elements with data-animate attribute
    const animatedElements = this.querySelectorAll('[data-animate]');

    if (animatedElements.length === 0) return;

    const options = {
      rootMargin: '-10% 0px',
      threshold: 0.1
    };

    const animationObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          animationObserver.unobserve(entry.target);
        }
      });
    }, options);

    animatedElements.forEach(el => {
      animationObserver.observe(el);
    });

    // Handle staggered animations
    const staggerContainers = this.querySelectorAll('[data-animate-stagger]');
    
    const staggerObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          staggerObserver.unobserve(entry.target);
        }
      });
    }, options);

    staggerContainers.forEach(el => {
      staggerObserver.observe(el);
    });
  }
}

customElements.define('tdc-section', TDCSection);

export default TDCSection;
