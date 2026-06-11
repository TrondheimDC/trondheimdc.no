/**
 * <tdc-duck> — The TDC rubber duck mascot 🐤
 *
 * Interactions:
 *  • Click   → quack! (speech bubble + squish animation)
 *  • Dblclick → spin trick
 *  • Drag    → move the duck around the page
 *  • 5 rapid clicks → party mode (rainbow disco duck)
 *  • Hover   → glow boost
 *
 * Each quack picks a random phrase. Keeps a click counter for combos.
 */

const QUACKS_NO = [
  'Kvakk!',
  'Kvakk kvakk!',
  'Hei på deg!',
  'Kode kode kode! 🖥️',
  'Trondheim! 💚',
  'TDC 2026! 🎉',
  'Kvaaaaakk!!',
  'Og-en-to-tre-kvakk!',
  'Quack overflow! 🐛',
  'git push --duck 🦆',
  '404 Bread Not Found 🍞',
  'npm install duck 📦',
  'Husk å ta pause! ☕',
  'Eg e ei and! 🦆',
  'console.log("kvakk")',
];

const QUACKS_EN = [
  'Quack!',
  'Quack quack!',
  'Hey there!',
  'Code code code! 🖥️',
  'Trondheim! 💚',
  'TDC 2026! 🎉',
  'Quaaaaack!!',
  'One-two-three-quack!',
  'Quack overflow! 🐛',
  'git push --duck 🦆',
  '404 Bread Not Found 🍞',
  'npm install duck 📦',
  'Remember to take breaks! ☕',
  "I'm a duck! 🦆",
  'console.log("quack")',
];

const CONFETTI_COLORS = ['#5CB85C', '#BDA9DD', '#FF6B6B', '#FFCC00', '#FF8FB3', '#3D9EFF'];

/** Resolve the site path prefix (set via <meta name="path-prefix">) */
function getPathPrefix() {
  const meta = document.querySelector('meta[name="path-prefix"]');
  const prefix = meta ? meta.content.replace(/\/$/, '') : '';
  return prefix;
}

/** Total clicks needed to trigger the TDuckC logo swap */
const TDUCKC_THRESHOLD = 10;

/** Lazy-load duck-mate engine (script + CSS) once, then return initDuckMate */
let _duckMateReady = null;
function loadDuckMate() {
  if (_duckMateReady) return _duckMateReady;
  _duckMateReady = new Promise((resolve) => {
    // CSS
    const prefix = getPathPrefix();
    if (!document.querySelector('link[href*="duck-mate.css"]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = `${prefix}/assets/css/duck-mate.css`;
      document.head.appendChild(link);
    }
    // JS
    if (window.initDuckMate) { resolve(window.initDuckMate); return; }
    const s = document.createElement('script');
    s.src = `${prefix}/assets/js/duck-mate.js`;
    s.onload = () => resolve(window.initDuckMate);
    document.head.appendChild(s);
  });
  return _duckMateReady;
}

/** Track how many Duck Mate instances have been spawned */
let _duckMateCount = 0;

/** Inline SVG for the TDuckC logo — T + 🦆 + C */
const TDUCKC_SVG = `<svg viewBox="0 0 440 121" fill="none" xmlns="http://www.w3.org/2000/svg" class="hero__logo hero__logo--tduckc" id="hero-logo-tduckc">
  <!-- T -->
  <path d="M92.6294 0H0V40.2024H92.6294V0Z" fill="white"/>
  <path d="M69.3354 40.0204H22.9297V80.2229H69.3354V40.0204Z" fill="white"/>
  <path d="M69.3354 80.0411H22.9297V120.244H69.3354V80.0411Z" fill="white"/>
  <!-- Duck replacing D -->
  <g transform="translate(101, 2) scale(0.78)">
    <!-- body -->
    <ellipse cx="75" cy="100" rx="55" ry="42" fill="#FFCC00"/>
    <!-- head -->
    <circle cx="105" cy="48" r="32" fill="#FFCC00"/>
    <!-- eye -->
    <circle cx="115" cy="42" r="5" fill="#333"/>
    <circle cx="116.5" cy="40.5" r="1.5" fill="white"/>
    <!-- beak -->
    <path d="M130 52 L155 48 L130 60Z" fill="#FF8C00"/>
    <!-- wing -->
    <ellipse cx="55" cy="90" rx="28" ry="18" fill="#E6B800" transform="rotate(-15 55 90)"/>
    <!-- crown -->
    <path d="M82 22 L78 8 L88 16 L95 0 L102 16 L112 8 L108 22Z" fill="#5CB85C"/>
    <!-- water ripple -->
    <ellipse cx="75" cy="140" rx="60" ry="8" fill="rgba(61,158,255,0.3)"/>
  </g>
  <!-- C -->
  <g transform="translate(203, 0)">
    <path d="M40.675 0H93.087V40.2024H0.457C0.275 18.0092 18.473 0 40.675 0Z" fill="white"/>
    <path d="M46.681 40.0204H0.275V80.2229H46.681V40.0204Z" fill="white"/>
    <path d="M0.275 80.0411H92.905V120.244H40.493C18.473 120.425 0.275 102.416 0.275 80.0411Z" fill="white"/>
  </g>
</svg>`;

export class TdcDuck extends HTMLElement {
  connectedCallback() {
    const lang = document.documentElement.lang || 'no';
    this.quacks = lang === 'en' ? QUACKS_EN : QUACKS_NO;
    this.clickCount = 0;
    this.clickTimer = null;
    this.totalClicks = 0;
    this.isTduckc = false;
    this.isPartyMode = false;
    this.isDragging = false;
    this.dragOffset = { x: 0, y: 0 };

    this.innerHTML = `
      <div class="duck" role="img" aria-label="${lang === 'en' ? 'TDC mascot rubber duck' : 'TDC maskot gummiand'}" tabindex="0">
        <img class="duck__img" src="${getPathPrefix()}/assets/images/logos/duck.svg" alt="" draggable="false">
        <span class="duck__quack" aria-live="polite"></span>
        <svg class="duck__splash" viewBox="0 0 120 30">
          <ellipse cx="60" cy="15" rx="50" ry="10" fill="#3D9EFF" opacity="0.4"/>
          <ellipse cx="60" cy="15" rx="35" ry="6" fill="#70B8FF" opacity="0.3"/>
        </svg>
      </div>
    `;

    this.duck = this.querySelector('.duck');
    this.bubble = this.querySelector('.duck__quack');
    this.splash = this.querySelector('.duck__splash');

    // Click → quack
    this.duck.addEventListener('click', (e) => {
      e.stopPropagation();
      this.quack();
      this.trackClicks();
    });

    // Double-click → spin
    this.duck.addEventListener('dblclick', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.spin();
    });

    // Keyboard: Enter/Space → quack
    this.duck.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.quack();
        this.trackClicks();
      }
    });

    // Drag support
    this.duck.addEventListener('pointerdown', (e) => this.startDrag(e));
    document.addEventListener('pointermove', (e) => this.onDrag(e));
    document.addEventListener('pointerup', () => this.endDrag());
  }

  quack() {
    // Pick random quack
    const msg = this.quacks[Math.floor(Math.random() * this.quacks.length)];
    this.bubble.textContent = msg;

    // Track total clicks for TDuckC Easter egg
    this.totalClicks++;
    if (this.totalClicks === TDUCKC_THRESHOLD) {
      this.activateTduckc();
    }

    // Show bubble
    this.bubble.classList.add('is-visible');

    // Squish animation
    this.duck.classList.remove('is-quacking');
    void this.duck.offsetWidth; // force reflow
    this.duck.classList.add('is-quacking');

    // Splash
    this.splash.classList.remove('is-splashing');
    void this.splash.offsetWidth;
    this.splash.classList.add('is-splashing');

    // Spawn confetti
    this.spawnConfetti(3);

    // Clear after delay
    clearTimeout(this._quackTimeout);
    this._quackTimeout = setTimeout(() => {
      this.bubble.classList.remove('is-visible');
      this.duck.classList.remove('is-quacking');
      this.splash.classList.remove('is-splashing');
    }, 1800);
  }

  spin() {
    this.duck.classList.remove('is-spinning');
    void this.duck.offsetWidth;
    this.duck.classList.add('is-spinning');
    this.spawnConfetti(8);

    setTimeout(() => {
      this.duck.classList.remove('is-spinning');
    }, 800);
  }

  trackClicks() {
    this.clickCount++;
    clearTimeout(this.clickTimer);

    if (this.clickCount >= 5) {
      this.toggleParty();
      this.clickCount = 0;
      return;
    }

    this.clickTimer = setTimeout(() => {
      this.clickCount = 0;
    }, 1500);
  }

  toggleParty() {
    this.isPartyMode = !this.isPartyMode;
    this.duck.classList.toggle('is-partying', this.isPartyMode);

    if (this.isPartyMode) {
      this.bubble.textContent = '🎉 PARTY MODE! 🎉';
      this.bubble.classList.add('is-visible');
      this.spawnConfetti(15);

      // Spawn a new Duck Mate! 🦆
      this.spawnDuckMate();

      // Auto-off after 5s
      this._partyTimeout = setTimeout(() => {
        this.isPartyMode = false;
        this.duck.classList.remove('is-partying');
        this.bubble.classList.remove('is-visible');
      }, 5000);
    } else {
      clearTimeout(this._partyTimeout);
      this.bubble.classList.remove('is-visible');
    }
  }

  async spawnDuckMate() {
    const init = await loadDuckMate();
    if (!init) return;
    _duckMateCount++;
    init({ debug: false, multiInstance: true, scale: 0.8 + Math.random() * 0.4, speed: 0.8 + Math.random() * 0.6 });
  }

  /**
   * 🦆 TDuckC Easter egg!
   * The duck walks up to the logo, a cartoon poof cloud appears,
   * and the logo transforms into TDuckC.
   */
  activateTduckc() {
    if (this.isTduckc) return;
    this.isTduckc = true;

    const heroLogo = document.getElementById('hero-logo');
    if (!heroLogo) return;

    const originalHeight = heroLogo.getBoundingClientRect().height;
    const lang = document.documentElement.lang || 'no';

    // 1) Show determination message
    this.bubble.textContent = lang === 'en'
      ? '🦆 I have an idea...'
      : '🦆 Eg har ein idé...';
    this.bubble.classList.add('is-visible');

    // 2) Walk toward the logo
    const duckRect = this.getBoundingClientRect();
    const logoRect = heroLogo.getBoundingClientRect();
    const targetX = logoRect.left + logoRect.width / 2 - duckRect.width / 2;
    const targetY = logoRect.top + logoRect.height / 2 - duckRect.height / 2;
    const deltaX = targetX - duckRect.left;
    const deltaY = targetY - duckRect.top;

    this.duck.style.animation = 'none';
    this.style.transition = 'transform 1.5s cubic-bezier(0.34, 1.56, 0.64, 1)';
    this.style.zIndex = '100';
    this.classList.add('duck--walking');

    requestAnimationFrame(() => {
      this.style.transform = `translate(${deltaX}px, ${deltaY}px) scale(0.6)`;
    });

    // 3) After walk, show cloud poof and swap logo
    setTimeout(() => {
      this.bubble.classList.remove('is-visible');
      this.classList.remove('duck--walking');

      // Create cartoon working cloud
      const cloud = document.createElement('div');
      cloud.className = 'tduckc-cloud';
      cloud.innerHTML = `
        <div class="tduckc-cloud__poof">💭</div>
        <div class="tduckc-cloud__text">${lang === 'en' ? '🔧 Working... 🔧' : '🔧 Jobber... 🔧'}</div>
        <div class="tduckc-cloud__stars">✨🐥🌟☁️✨</div>
      `;
      heroLogo.parentElement.insertBefore(cloud, heroLogo);
      this.style.opacity = '0';
      this.style.transition = 'opacity 0.3s ease';
      requestAnimationFrame(() => cloud.classList.add('is-active'));

      // 4) Swap logo
      setTimeout(() => {
        const newLogo = document.createElement('img');
        newLogo.src = `${getPathPrefix()}/assets/images/logos/TDuckC_yellow.svg`;
        newLogo.alt = 'TDuckC 2026 logo';
        newLogo.className = heroLogo.className;
        newLogo.classList.add('hero__logo--tduckc');
        newLogo.id = 'hero-logo-tduckc';
        newLogo.style.height = `${originalHeight}px`;
        newLogo.style.width = 'auto';
        newLogo.style.opacity = '0';
        newLogo.style.transform = 'scale(0.8)';
        newLogo.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        heroLogo.replaceWith(newLogo);

        cloud.classList.add('is-fading');
        requestAnimationFrame(() => {
          newLogo.style.opacity = '1';
          newLogo.style.transform = 'scale(1)';
        });
        this.spawnConfetti(25);

        // Move duck back
        setTimeout(() => {
          cloud.remove();
          this.style.transition = 'transform 0.8s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.4s ease';
          this.style.transform = '';
          this.style.opacity = '1';
          this.style.zIndex = '';
          this.duck.style.animation = '';

          this.bubble.textContent = lang === 'en'
            ? '🦆 TDuckC! Nailed it! 🎉'
            : '🦆 TDuckC! Nailed it! 🎉';
          this.bubble.classList.add('is-visible');
          this.spawnConfetti(15);
        }, 600);

        document.title = document.title.replace('TDC', 'TDuckC');
        setTimeout(() => { this.bubble.classList.remove('is-visible'); }, 4000);
      }, 1800);
    }, 1600);
  }

  spawnConfetti(count) {
    for (let i = 0; i < count; i++) {
      const dot = document.createElement('span');
      dot.classList.add('duck__confetti');
      dot.style.setProperty('--confetti-x', `${(Math.random() - 0.5) * 120}px`);
      dot.style.setProperty('--confetti-y', `${-30 - Math.random() * 80}px`);
      dot.style.background = CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)];
      dot.style.left = `${40 + Math.random() * 20}%`;
      dot.style.top = `${20 + Math.random() * 40}%`;
      this.duck.appendChild(dot);

      requestAnimationFrame(() => dot.classList.add('is-popping'));
      setTimeout(() => dot.remove(), 900);
    }
  }

  startDrag(e) {
    // Only start drag if held for a bit (distinguish from click)
    this._dragStartTime = Date.now();
    this._dragStartX = e.clientX;
    this._dragStartY = e.clientY;
    this._potentialDrag = true;
    this.duck.setPointerCapture(e.pointerId);
  }

  onDrag(e) {
    if (!this._potentialDrag) return;

    const dx = e.clientX - this._dragStartX;
    const dy = e.clientY - this._dragStartY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Only enter drag mode after moving 8px
    if (!this.isDragging && dist > 8) {
      this.isDragging = true;
      this.duck.classList.add('is-dragging');
      const rect = this.getBoundingClientRect();
      this.dragOffset.x = e.clientX - rect.left;
      this.dragOffset.y = e.clientY - rect.top;
      this.style.position = 'fixed';
      this.style.zIndex = '9999';
      this.style.pointerEvents = 'none';
      this.duck.style.pointerEvents = 'auto';
    }

    if (this.isDragging) {
      this.style.left = `${e.clientX - this.dragOffset.x}px`;
      this.style.top = `${e.clientY - this.dragOffset.y}px`;
    }
  }

  endDrag() {
    if (this.isDragging) {
      this.isDragging = false;
      this.duck.classList.remove('is-dragging');
      // Keep position where dropped
      this.style.pointerEvents = '';
    }
    this._potentialDrag = false;
  }
}

customElements.define('tdc-duck', TdcDuck);
