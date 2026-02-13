/**
 * TDC Navigation Component
 * Sticky nav with scroll-based active states and URL sync
 */

class TDCNav extends HTMLElement {
  static get observedAttributes() {
    return ['transparent'];
  }

  constructor() {
    super();
    this.isMenuOpen = false;
    this.sections = [];
    this.observer = null;
  }

  connectedCallback() {
    this.render();
    this.setupEventListeners();
    this.setupScrollObserver();
    this.setupScrollProgress();
  }

  disconnectedCallback() {
    if (this.observer) {
      this.observer.disconnect();
    }
    window.removeEventListener('scroll', this.handleScroll);
  }

  render() {
    const lang = document.documentElement.lang || 'no';
    const isTransparent = this.hasAttribute('transparent');

    this.innerHTML = `
      <nav class="nav${isTransparent ? ' nav--transparent' : ''}" role="navigation" aria-label="Main navigation">
        <div class="nav__inner">
          <a href="#hero" class="nav__logo" aria-label="TDC 2025 - Gå til forsiden">
            <img src="/assets/images/logo.svg" alt="" width="40" height="40">
            <span>TDC 2025</span>
          </a>

          <button class="nav__toggle" aria-expanded="false" aria-controls="nav-links" aria-label="Meny">
            <span class="nav__toggle-icon"></span>
          </button>

          <div id="nav-links" class="nav__links">
            <a href="#about" class="nav__link" data-section="about">
              ${lang === 'en' ? 'About' : 'Om'}
            </a>
            <a href="#speakers" class="nav__link" data-section="speakers">
              ${lang === 'en' ? 'Speakers' : 'Foredragsholdere'}
            </a>
            <a href="#program" class="nav__link" data-section="program">
              Program
            </a>
            <a href="#tickets" class="nav__link" data-section="tickets">
              ${lang === 'en' ? 'Tickets' : 'Billetter'}
            </a>
            <a href="#partners" class="nav__link" data-section="partners">
              ${lang === 'en' ? 'Partners' : 'Partnere'}
            </a>
          </div>

          <div class="nav__actions">
            <div class="nav__lang" role="group" aria-label="Språkvalg">
              <button class="nav__lang-btn${lang === 'no' ? ' nav__lang-btn--active' : ''}" 
                      data-lang="no" aria-pressed="${lang === 'no'}">NO</button>
              <button class="nav__lang-btn${lang === 'en' ? ' nav__lang-btn--active' : ''}" 
                      data-lang="en" aria-pressed="${lang === 'en'}">EN</button>
            </div>
            <a href="#tickets" class="btn btn--mascot btn--sm">
              ${lang === 'en' ? 'Get Tickets' : 'Kjøp Billetter'}
            </a>
          </div>
        </div>
        <div class="nav__progress" aria-hidden="true"></div>
      </nav>
    `;
  }

  setupEventListeners() {
    // Mobile menu toggle
    const toggle = this.querySelector('.nav__toggle');
    const links = this.querySelector('.nav__links');

    toggle?.addEventListener('click', () => {
      this.isMenuOpen = !this.isMenuOpen;
      toggle.setAttribute('aria-expanded', this.isMenuOpen);
      links.classList.toggle('nav__links--open', this.isMenuOpen);
    });

    // Close menu on link click
    this.querySelectorAll('.nav__link').forEach(link => {
      link.addEventListener('click', () => {
        this.isMenuOpen = false;
        toggle?.setAttribute('aria-expanded', 'false');
        links?.classList.remove('nav__links--open');
      });
    });

    // Language switcher
    this.querySelectorAll('.nav__lang-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const lang = btn.dataset.lang;
        this.switchLanguage(lang);
      });
    });

    // Scroll state
    this.handleScroll = this.handleScroll.bind(this);
    window.addEventListener('scroll', this.handleScroll, { passive: true });
    this.handleScroll();
  }

  handleScroll() {
    const nav = this.querySelector('.nav');
    const scrolled = window.scrollY > 50;
    nav?.classList.toggle('nav--scrolled', scrolled);
  }

  setupScrollObserver() {
    // Find all sections on the page
    this.sections = document.querySelectorAll('section[id]');

    const options = {
      rootMargin: '-50% 0px -50% 0px',
      threshold: 0
    };

    this.observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const id = entry.target.id;
          this.setActiveLink(id);
          this.updateURL(id);
        }
      });
    }, options);

    this.sections.forEach(section => {
      this.observer.observe(section);
    });
  }

  setActiveLink(sectionId) {
    this.querySelectorAll('.nav__link').forEach(link => {
      const isActive = link.dataset.section === sectionId;
      link.classList.toggle('nav__link--active', isActive);
    });
  }

  updateURL(sectionId) {
    if (sectionId === 'hero') {
      history.replaceState(null, '', window.location.pathname);
    } else {
      history.replaceState(null, '', `#${sectionId}`);
    }
  }

  setupScrollProgress() {
    const progress = this.querySelector('.nav__progress');
    if (!progress) return;

    const updateProgress = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const scrollPercent = scrollTop / docHeight;
      progress.style.transform = `scaleX(${scrollPercent})`;
    };

    window.addEventListener('scroll', updateProgress, { passive: true });
    updateProgress();
  }

  switchLanguage(lang) {
    const currentPath = window.location.pathname;
    const hash = window.location.hash;

    let newPath;
    if (lang === 'en') {
      newPath = currentPath.startsWith('/en/') ? currentPath : `/en${currentPath}`;
    } else {
      newPath = currentPath.replace(/^\/en/, '') || '/';
    }

    window.location.href = newPath + hash;
  }
}

customElements.define('tdc-nav', TDCNav);

export default TDCNav;
