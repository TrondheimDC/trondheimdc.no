/**
 * TDC Duck Mascot Component 🦆
 * Animated rubber duck with personality
 */

class TDCDuck extends HTMLElement {
  static get observedAttributes() {
    return ['size', 'animation', 'mood'];
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
    this.setupInteraction();
  }

  get size() {
    return this.getAttribute('size') || 'md';
  }

  get animation() {
    return this.getAttribute('animation') || 'float';
  }

  get mood() {
    return this.getAttribute('mood') || 'happy';
  }

  render() {
    const sizeMap = {
      sm: 40,
      md: 80,
      lg: 120,
      xl: 200
    };

    const duckSize = sizeMap[this.size] || sizeMap.md;
    const animationClass = this.animation ? `duck-${this.animation}` : '';

    // Duck moods affect colors/expression
    const moodStyles = {
      happy: { beak: '#FF9500', cheeks: '#FFB6C1' },
      excited: { beak: '#FF6B00', cheeks: '#FF69B4' },
      cool: { beak: '#FF9500', cheeks: 'transparent' },
      sleepy: { beak: '#FFB347', cheeks: '#FFD1DC' }
    };

    const mood = moodStyles[this.mood] || moodStyles.happy;

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: inline-block;
          cursor: pointer;
        }

        .duck {
          width: ${duckSize}px;
          height: ${duckSize}px;
          position: relative;
          transition: transform 0.3s ease;
        }

        .duck:hover {
          transform: scale(1.1);
        }

        .duck:active {
          transform: scale(0.95);
        }

        /* Animation classes */
        .duck-float {
          animation: float 3s ease-in-out infinite;
        }

        .duck-waddle {
          animation: waddle 0.5s ease-in-out infinite;
        }

        .duck-bounce {
          animation: bounce 1s cubic-bezier(0.68, -0.55, 0.265, 1.55) infinite;
        }

        .duck-swim {
          animation: swim 2s ease-in-out infinite;
        }

        @keyframes float {
          0%, 100% { transform: translateY(0) rotate(-2deg); }
          50% { transform: translateY(-10px) rotate(2deg); }
        }

        @keyframes waddle {
          0%, 100% { transform: rotate(-5deg); }
          50% { transform: rotate(5deg); }
        }

        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-20px); }
        }

        @keyframes swim {
          0%, 100% { transform: translateX(0) rotate(0deg); }
          25% { transform: translateX(5px) rotate(3deg); }
          75% { transform: translateX(-5px) rotate(-3deg); }
        }

        @keyframes quack {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.2) rotate(5deg); }
        }

        .duck--quack {
          animation: quack 0.3s ease-in-out;
        }

        /* SVG styling */
        .duck-body { fill: var(--duck-body, #FFD700); }
        .duck-beak { fill: ${mood.beak}; }
        .duck-eye { fill: #1a1a1a; }
        .duck-wing { fill: var(--duck-wing, #FFC107); }
        .duck-cheek { fill: ${mood.cheeks}; }

        @media (prefers-reduced-motion: reduce) {
          .duck-float,
          .duck-waddle,
          .duck-bounce,
          .duck-swim {
            animation: none;
          }
        }
      </style>

      <div class="duck ${animationClass}" role="img" aria-label="TDC rubber duck mascot">
        <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
          <!-- Body -->
          <ellipse class="duck-body" cx="50" cy="60" rx="35" ry="30"/>
          
          <!-- Wing -->
          <ellipse class="duck-wing" cx="55" cy="65" rx="15" ry="12" transform="rotate(-20 55 65)"/>
          
          <!-- Head -->
          <circle class="duck-body" cx="45" cy="30" r="22"/>
          
          <!-- Beak -->
          <ellipse class="duck-beak" cx="25" cy="32" rx="10" ry="6"/>
          
          <!-- Eye -->
          <circle class="duck-eye" cx="40" cy="26" r="4"/>
          <circle fill="white" cx="38" cy="24" r="1.5"/>
          
          <!-- Cheek -->
          <circle class="duck-cheek" cx="48" cy="35" r="4" opacity="0.6"/>
          
          ${this.mood === 'cool' ? `
            <!-- Sunglasses -->
            <rect fill="#1a1a1a" x="30" y="22" width="20" height="8" rx="2"/>
          ` : ''}
          
          ${this.mood === 'sleepy' ? `
            <!-- Closed eye -->
            <path stroke="#1a1a1a" stroke-width="2" fill="none" d="M36 26 Q40 28 44 26"/>
          ` : ''}
        </svg>
      </div>
    `;
  }

  setupInteraction() {
    const duck = this.shadowRoot.querySelector('.duck');

    duck.addEventListener('click', () => {
      this.quack();
    });

    duck.addEventListener('mouseenter', () => {
      this.dispatchEvent(new CustomEvent('duck-hover', { bubbles: true }));
    });
  }

  quack() {
    const duck = this.shadowRoot.querySelector('.duck');
    duck.classList.add('duck--quack');

    // Play quack sound (if audio element exists)
    const audio = document.getElementById('quack-sound');
    if (audio) {
      audio.currentTime = 0;
      audio.play().catch(() => {}); // Ignore autoplay restrictions
    }

    setTimeout(() => {
      duck.classList.remove('duck--quack');
    }, 300);

    this.dispatchEvent(new CustomEvent('duck-quack', { bubbles: true }));
  }

  // Public method to change mood
  setMood(mood) {
    this.setAttribute('mood', mood);
    this.render();
  }
}

customElements.define('tdc-duck', TDCDuck);

export default TDCDuck;
