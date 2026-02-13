/**
 * TDC Main JavaScript
 * Initializes components and scroll behavior
 */

// Import components
import './components/tdc-nav.js';
import './components/tdc-duck.js';
import './components/tdc-section.js';

/**
 * Scroll Router
 * Syncs URL with current section on scroll
 */
class ScrollRouter {
  constructor() {
    this.sections = [];
    this.currentSection = null;
    this.observer = null;
  }

  init() {
    this.sections = Array.from(document.querySelectorAll('tdc-section[id], section[id]'));

    if (this.sections.length === 0) return;

    // Handle initial hash
    this.handleInitialHash();

    // Setup intersection observer
    const options = {
      rootMargin: '-40% 0px -40% 0px',
      threshold: 0
    };

    this.observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          this.setCurrentSection(entry.target.id);
        }
      });
    }, options);

    this.sections.forEach(section => {
      this.observer.observe(section);
    });

    // Handle hash changes (browser back/forward)
    window.addEventListener('hashchange', () => {
      const hash = window.location.hash.slice(1);
      if (hash && hash !== this.currentSection) {
        this.scrollToSection(hash);
      }
    });
  }

  handleInitialHash() {
    const hash = window.location.hash.slice(1);
    if (hash) {
      // Small delay to ensure layout is complete
      requestAnimationFrame(() => {
        this.scrollToSection(hash);
      });
    }
  }

  setCurrentSection(sectionId) {
    if (sectionId === this.currentSection) return;

    this.currentSection = sectionId;

    // Update URL (without scrolling)
    const url = sectionId === 'hero' 
      ? window.location.pathname 
      : `${window.location.pathname}#${sectionId}`;
    
    history.replaceState(null, '', url);

    // Dispatch event for other components
    document.dispatchEvent(new CustomEvent('section-change', {
      detail: { sectionId }
    }));
  }

  scrollToSection(sectionId) {
    const section = document.getElementById(sectionId);
    if (section) {
      section.scrollIntoView({ behavior: 'smooth' });
    }
  }
}

/**
 * Smooth scroll for anchor links
 */
function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', (e) => {
      const targetId = anchor.getAttribute('href').slice(1);
      const target = document.getElementById(targetId);

      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });
}

/**
 * Scroll snap for sections
 */
function initScrollSnap() {
  // Only enable scroll snap on larger screens
  if (window.innerWidth >= 768) {
    document.documentElement.style.scrollSnapType = 'y proximity';
  }

  // Update on resize
  window.addEventListener('resize', () => {
    if (window.innerWidth >= 768) {
      document.documentElement.style.scrollSnapType = 'y proximity';
    } else {
      document.documentElement.style.scrollSnapType = 'none';
    }
  });
}

/**
 * Initialize everything
 */
document.addEventListener('DOMContentLoaded', () => {
  // Initialize scroll router
  const router = new ScrollRouter();
  router.init();

  // Initialize smooth scroll
  initSmoothScroll();

  // Initialize scroll snap
  initScrollSnap();

  // Duck easter egg - Konami code
  let konamiIndex = 0;
  const konamiCode = [38, 38, 40, 40, 37, 39, 37, 39, 66, 65]; // ↑↑↓↓←→←→BA

  document.addEventListener('keydown', (e) => {
    if (e.keyCode === konamiCode[konamiIndex]) {
      konamiIndex++;
      if (konamiIndex === konamiCode.length) {
        activateDuckMode();
        konamiIndex = 0;
      }
    } else {
      konamiIndex = 0;
    }
  });

  console.log('🦆 TDC 2025 - Trondheim Developer Conference');
  console.log('Hint: There might be some hidden ducks around...');
});

/**
 * Duck Mode Easter Egg 🦆
 */
function activateDuckMode() {
  document.body.classList.add('duck-mode');

  // Create swimming duck
  const swimDuck = document.createElement('tdc-duck');
  swimDuck.setAttribute('size', 'lg');
  swimDuck.setAttribute('animation', 'swim');
  swimDuck.style.cssText = `
    position: fixed;
    bottom: 20px;
    left: -150px;
    z-index: 9999;
    animation: swim-across 10s linear forwards;
  `;

  // Add swim animation
  const style = document.createElement('style');
  style.textContent = `
    @keyframes swim-across {
      to { left: calc(100vw + 150px); }
    }
    .duck-mode {
      --tdc-brand-primary: var(--tdc-brand-mascot);
    }
  `;
  document.head.appendChild(style);
  document.body.appendChild(swimDuck);

  // Remove after animation
  setTimeout(() => {
    swimDuck.remove();
    style.remove();
    document.body.classList.remove('duck-mode');
  }, 10000);

  console.log('🦆 QUACK! Duck mode activated!');
}

// Export for use in modules
export { ScrollRouter, initSmoothScroll, initScrollSnap };
