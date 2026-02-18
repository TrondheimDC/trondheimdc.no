/**
 * Duck Mate — A non-intrusive web mascot inspired by eSheep
 * Framework-free, accessible, canvas-based animated duck companion.
 *
 * @license MIT
 * @version 1.0.0
 */
;(function (global) {
  'use strict';

  // ═══════════════════════════════════════════════════════════════
  //  §1  Constants & Default Configuration
  // ═══════════════════════════════════════════════════════════════

  const VERSION = '1.0.0';
  const FRAME_W = 64;
  const FRAME_H = 64;
  const GUTTER = 2;
  const CELL = FRAME_W + GUTTER;        // 66 px pitch
  const ATLAS_COLS = 15;
  const GRAVITY = 600;                   // px / s²
  const MAX_PARTICLES = 60;
  const STORAGE_KEY = 'duck-mate-prefs';
  const PERCH_SCAN_MS = 4000;

  let _instanceCount = 0;
  /** Global registry of all live DuckMate instances for collision detection. */
  const _instances = [];

  const DUCK_COLORS = ['#FFCC00','#FF8FB3','#7B68EE','#5CB85C','#3D9EFF','#FF6B6B','#1ABC9C','#DA70D6'];

  const DEF_OPTS = Object.freeze({
    scale: 1,
    speed: 1,
    theme: 'default',
    gagWeights: {},
    perchSelectors: [],
    reducedMotion: 'auto',   // 'auto' | 'on' | 'off'
    sounds: { quackUrl: '', splashUrl: '', enabled: true },
    debug: false,
    position: 'bottom-right',
    multiInstance: false,
    duckColor: null, // null = auto-pick from palette; or '#RRGGBB'
    onStateChange: null,
    onGagPlayed: null,
  });

  const DEF_TIMING = Object.freeze({
    walkSpeed: 60,
    runSpeed: 140,
    idleMinMs: 3000,
    idleMaxMs: 8000,
    napDurationMs: 12000,
    preenDurationMs: 4000,
    mediumGagCooldownMs: 90000,
    bigGagCooldownMs: 180000,
    interactionCooldownMs: 5000,
    gagSuppressDuringFocus: true,
    perchDurationMs: 6000,
    dragThrowMul: 0.3,
    eggWobbleSpeed: 4,
    blinkIntervalMs: 3500,
    blinkDurationMs: 200,
  });

  const GROUP_WEIGHTS = { ambient: 3, medium_gag: 0.8, big_gag: 0.4, interaction: 1.5 };

  // ═══════════════════════════════════════════════════════════════
  //  §2  Utilities
  // ═══════════════════════════════════════════════════════════════

  const clamp  = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const lerp   = (a, b, t) => a + (b - a) * t;
  const rand   = (lo, hi) => lo + Math.random() * (hi - lo);
  const randI  = (lo, hi) => Math.floor(rand(lo, hi + 1));
  const pick   = (a) => a[randI(0, a.length - 1)];

  function weightedPick(items, wFn) {
    let tot = 0;
    const ws = items.map(it => { const w = wFn(it); tot += w; return w; });
    let r = Math.random() * tot;
    for (let i = 0; i < items.length; i++) { r -= ws[i]; if (r <= 0) return items[i]; }
    return items[items.length - 1];
  }

  function loadPrefs()     { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch { return {}; } }
  function savePrefs(p)    { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(p)); } catch { /* */ } }

  // ═══════════════════════════════════════════════════════════════
  //  §3  EventBus
  // ═══════════════════════════════════════════════════════════════

  class EventBus {
    constructor() { this._m = {}; }
    on(e, f)  { (this._m[e] || (this._m[e] = [])).push(f); }
    off(e, f) { const a = this._m[e]; if (a) { const i = a.indexOf(f); if (i >= 0) a.splice(i, 1); } }
    emit(e, d){ (this._m[e] || []).forEach(f => f(d)); }
    clear()   { this._m = {}; }
  }

  // ═══════════════════════════════════════════════════════════════
  //  §4  Placeholder Atlas Generator
  // ═══════════════════════════════════════════════════════════════

  const SEQ_DEFS = [
    ['walk_right', 8, 120, true],
    ['idle_preen', 6, 120, true],
    ['idle_nap',   4, 400, true],
    ['run_panic',  6, 80,  true],
    ['dragged',    2, 200, true],
    ['land_recover', 4, 150, false],
    ['ufo_abduct_drop', 8, 140, true],
    ['shower_cloud', 8, 140, true],
    ['bathtub_flop', 8, 140, true],
    ['bread_heist',  6, 120, true],
    ['paper_plane_chase', 6, 100, true],
    ['camera_shy',   4, 120, false],
    ['fishbowl_moment', 6, 140, true],
    ['umbrella_pop', 6, 120, true],
    ['click_emote',  3, 120, false],
    ['peek_a_boo',   4, 150, false],
    ['perch_idle',   4, 200, true],
    ['puddle_hop',   4, 120, true],
    ['stage_performance', 8, 120, true],
    ['clone_parade', 6, 120, true],
    ['curiosity_cone', 4, 140, true],
    ['shoo_response', 4, 100, false],
    ['scroll_wave',  4, 150, true],
    ['read_newspaper', 6, 250, true],
    ['eat_seeds',    6, 140, true],
    ['duck_fight',   8, 100, true],
    ['sunbathe',     4, 300, true],
    ['butterfly_chase', 8, 110, true],
    ['do_pushups',   6, 160, true],
    ['banana_slip',  6, 120, false],
  ];

  /** Build atlas data mapping from the ordered sequence definitions. */
  function buildAtlasData() {
    const sequences = {};
    let idx = 0;
    for (const [name, count, dur, loop] of SEQ_DEFS) {
      const frames = [];
      for (let f = 0; f < count; f++) {
        const col = idx % ATLAS_COLS;
        const row = Math.floor(idx / ATLAS_COLS);
        frames.push({ x: col * CELL, y: row * CELL, w: FRAME_W, h: FRAME_H });
        idx++;
      }
      sequences[name] = { frameCount: count, frameDurationMs: dur, loop, frames };
    }
    return { frameSize: FRAME_W, gutter: GUTTER, columns: ATLAS_COLS, totalFrames: idx, sequences };
  }

  /** Render placeholder atlas canvas — detailed animated duck, single consistent color. */
  function generatePlaceholderAtlas(ad, bodyColor) {
    const cv = document.createElement('canvas');
    cv.width = 1024; cv.height = 1024;
    const c = cv.getContext('2d');
    const col = bodyColor || '#FFCC00';
    const bodyDark = darkenHex(col, 0.18);    // shadow
    const bodyLight = lightenHex(col, 0.25);  // highlight

    let fi = 0;
    for (const [name, seq] of Object.entries(ad.sequences)) {
      for (let f = 0; f < seq.frameCount; f++) {
        const cx = (fi % ATLAS_COLS) * CELL;
        const cy = Math.floor(fi / ATLAS_COLS) * CELL;
        const midX = cx + 32, bodyY = cy + 36, headY = cy + 18;
        const t = f / Math.max(seq.frameCount - 1, 1); // 0→1 normalized frame

        // --- Determine pose parameters from animation name ---
        let bodyTilt = 0;    // radians
        let wingAngle = 0;   // wing flap angle (radians, 0 = resting)
        let squish = 1;      // body vertical squish (< 1 = squashed)
        let legPhase = -1;   // -1 = static legs, else walk cycle phase
        let headBob = 0;     // head vertical offset
        let eyeState = 'open'; // 'open' | 'closed' | 'wide' | 'dizzy'
        let beakOpen = 0;    // 0 = closed, 1 = wide open
        let cheekBlush = false;
        let sweatDrop = false;
        let hasHat = '';     // '' | 'cone' | 'umbrella'
        let zzzs = false;

        // Walk / run animations
        if (name === 'walk_right' || name === 'puddle_hop' || name === 'clone_parade') {
          legPhase = t * Math.PI * 2;
          headBob = Math.sin(t * Math.PI * 2) * 2;
          wingAngle = Math.sin(t * Math.PI * 2) * 0.15;
        } else if (name === 'run_panic') {
          legPhase = t * Math.PI * 4;  // double speed legs
          headBob = Math.sin(t * Math.PI * 4) * 3;
          wingAngle = Math.sin(t * Math.PI * 4) * 0.4; // frantic flapping
          bodyTilt = Math.sin(t * Math.PI * 2) * 0.08;
          eyeState = 'wide';
          sweatDrop = true;
          beakOpen = 0.5;
        }
        // Idle & preen
        else if (name === 'idle_preen') {
          wingAngle = Math.sin(t * Math.PI * 2) * 0.3 + 0.2;
          headBob = Math.sin(t * Math.PI) * -4; // dips head
          bodyTilt = Math.sin(t * Math.PI) * 0.05;
        }
        // Nap
        else if (name === 'idle_nap') {
          eyeState = 'closed';
          headBob = -3;
          bodyTilt = 0.05;
          squish = 0.95;
          zzzs = true;
        }
        // Dragged
        else if (name === 'dragged') {
          wingAngle = 0.5 + Math.sin(t * Math.PI * 4) * 0.3;
          eyeState = 'wide';
          legPhase = t * Math.PI * 6; // flailing
          bodyTilt = Math.sin(t * Math.PI * 2) * 0.15;
          beakOpen = 0.7;
        }
        // Land recover
        else if (name === 'land_recover') {
          if (t < 0.5) {
            squish = 0.7 + t * 0.6; // squash on impact
            wingAngle = 0.6 * (1 - t * 2);
            eyeState = 'dizzy';
          } else {
            squish = 1;
            eyeState = t > 0.75 ? 'open' : 'dizzy';
            headBob = (1 - t) * -3;
          }
        }
        // UFO abduct
        else if (name === 'ufo_abduct_drop') {
          wingAngle = Math.sin(t * Math.PI * 6) * 0.6; // wild flapping
          bodyTilt = Math.sin(t * Math.PI * 2) * 0.2;
          eyeState = 'wide';
          beakOpen = 0.8;
          legPhase = t * Math.PI * 8;
        }
        // Shower
        else if (name === 'shower_cloud') {
          wingAngle = Math.sin(t * Math.PI) * 0.2;
          squish = 0.92;
          headBob = -2;
          eyeState = t > 0.5 ? 'closed' : 'open';
        }
        // Bathtub
        else if (name === 'bathtub_flop') {
          squish = 0.85;
          wingAngle = Math.sin(t * Math.PI * 2) * 0.25;
          headBob = Math.sin(t * Math.PI) * 3;
          cheekBlush = true;
        }
        // Bread heist
        else if (name === 'bread_heist') {
          legPhase = t * Math.PI * 3;
          headBob = Math.sin(t * Math.PI * 3) * 2;
          beakOpen = t < 0.3 ? 0.6 : 0;
          bodyTilt = -0.06;
        }
        // Paper plane chase
        else if (name === 'paper_plane_chase') {
          legPhase = t * Math.PI * 3;
          headBob = Math.abs(Math.sin(t * Math.PI * 2)) * 3;
          wingAngle = Math.sin(t * Math.PI * 2) * 0.2;
          eyeState = 'wide';
        }
        // Camera shy
        else if (name === 'camera_shy') {
          wingAngle = 0.8 + Math.sin(t * Math.PI) * 0.2; // wings up covering
          headBob = -2;
          bodyTilt = -0.1;
          cheekBlush = true;
        }
        // Fishbowl
        else if (name === 'fishbowl_moment') {
          headBob = Math.sin(t * Math.PI * 2) * 2;
          eyeState = 'wide';
          wingAngle = 0.1;
        }
        // Umbrella
        else if (name === 'umbrella_pop') {
          wingAngle = -0.3 + t * 0.6;
          headBob = -2 + t * 4;
          hasHat = 'umbrella';
        }
        // Click emote
        else if (name === 'click_emote') {
          squish = 0.85 + Math.sin(t * Math.PI * 2) * 0.1;
          wingAngle = Math.sin(t * Math.PI * 2) * 0.4;
          cheekBlush = true;
          beakOpen = 0.4;
        }
        // Peek-a-boo
        else if (name === 'peek_a_boo') {
          wingAngle = t < 0.5 ? 0.8 : 0.2;
          eyeState = t < 0.5 ? 'closed' : 'wide';
          headBob = t < 0.5 ? -5 : 0;
        }
        // Perch idle
        else if (name === 'perch_idle') {
          headBob = Math.sin(t * Math.PI * 2) * 1.5;
          wingAngle = Math.sin(t * Math.PI) * 0.1;
          bodyTilt = Math.sin(t * Math.PI * 2) * 0.03;
        }
        // Stage performance
        else if (name === 'stage_performance') {
          wingAngle = Math.sin(t * Math.PI * 4) * 0.5;
          legPhase = t * Math.PI * 2;
          headBob = Math.sin(t * Math.PI * 3) * 3;
          beakOpen = Math.abs(Math.sin(t * Math.PI * 3)) * 0.5;
        }
        // Curiosity cone
        else if (name === 'curiosity_cone') {
          headBob = Math.sin(t * Math.PI) * -3;
          bodyTilt = Math.sin(t * Math.PI) * 0.08;
          hasHat = 'cone';
        }
        // Shoo response
        else if (name === 'shoo_response') {
          if (t < 0.5) { eyeState = 'wide'; beakOpen = 0.6; }
          else { legPhase = t * Math.PI * 4; wingAngle = 0.3; bodyTilt = -0.1; }
        }
        // Scroll wave
        else if (name === 'scroll_wave') {
          wingAngle = -0.3 + Math.sin(t * Math.PI * 2) * 0.8; // waving
          headBob = Math.sin(t * Math.PI) * 2;
          beakOpen = 0.3;
        }
        // Read newspaper — sitting, looking down
        else if (name === 'read_newspaper') {
          squish = 0.88;
          headBob = -5 + Math.sin(t * Math.PI * 2) * 1; // slight nod
          bodyTilt = 0.06;
          wingAngle = 0.3; // wings forward holding paper
          eyeState = t > 0.7 ? 'wide' : 'open'; // surprised by headline
          beakOpen = t > 0.7 ? 0.4 : 0;
        }
        // Eat seeds — deep pecking at ground, head goes all the way down
        else if (name === 'eat_seeds') {
          const peck = Math.sin(t * Math.PI * 3);
          // Deep forward tilt — duck bends way down to reach seeds
          bodyTilt = peck > 0 ? 0.35 + peck * 0.25 : 0.1; // heavy lean forward
          headBob = peck > 0 ? -14 * peck : -2; // head plunges down to ground
          squish = peck > 0 ? 0.88 : 1; // body compresses on peck
          beakOpen = peck > 0.4 ? 0.7 : 0; // beak opens wide to grab seed
          legPhase = t * Math.PI * 1.5; // slow step between pecks
          wingAngle = peck > 0 ? -0.15 : 0; // wings tuck back on peck
        }
        // Duck fight — frantic flailing
        else if (name === 'duck_fight') {
          wingAngle = Math.sin(t * Math.PI * 8) * 0.7;
          legPhase = t * Math.PI * 6;
          bodyTilt = Math.sin(t * Math.PI * 4) * 0.15;
          headBob = Math.sin(t * Math.PI * 6) * 4;
          beakOpen = 0.8;
          eyeState = 'wide';
          sweatDrop = true;
        }
        // Sunbathe — lounging with shades
        else if (name === 'sunbathe') {
          squish = 0.8;
          bodyTilt = -0.08;
          headBob = -1 + Math.sin(t * Math.PI * 0.5) * 1;
          eyeState = 'closed';
          wingAngle = -0.2; // relaxed arms out
          cheekBlush = true;
        }
        // Butterfly chase — eager running
        else if (name === 'butterfly_chase') {
          legPhase = t * Math.PI * 4;
          headBob = 3 + Math.sin(t * Math.PI * 3) * 3; // looking up
          wingAngle = Math.sin(t * Math.PI * 3) * 0.2;
          eyeState = 'wide';
          beakOpen = 0.3;
          bodyTilt = -0.05; // leaning forward
        }
        // Do pushups — lying horizontal, wings push body up and down
        else if (name === 'do_pushups') {
          const pushPhase = Math.sin(t * Math.PI * 2);
          bodyTilt = Math.PI / 2 * 0.85; // nearly horizontal (face-down)
          squish = 0.85; // slightly flattened from effort
          wingAngle = 0.8 + pushPhase * 0.45; // wings push out, flex down/up
          headBob = -2 + pushPhase * 4; // head bobs with effort
          eyeState = pushPhase < -0.3 ? 'closed' : 'open'; // strain on push
          sweatDrop = true;
          beakOpen = pushPhase < -0.3 ? 0.4 : 0;
          legPhase = 0; // legs still, extended behind
        }
        // Banana slip — slipping and falling
        else if (name === 'banana_slip') {
          if (t < 0.3) { // walking
            legPhase = t * Math.PI * 4;
          } else if (t < 0.5) { // slip!
            bodyTilt = (t - 0.3) * 4; // tilting back
            wingAngle = 0.8;
            eyeState = 'wide';
            beakOpen = 0.8;
            legPhase = t * Math.PI * 10; // flailing
          } else { // on the ground
            bodyTilt = 0.4;
            squish = 0.7;
            eyeState = 'dizzy';
            wingAngle = 0.5;
            headBob = -4;
          }
        }

        // === DRAW THE DUCK ===
        c.save();
        c.translate(midX, bodyY);
        c.rotate(bodyTilt);

        // Shadow on ground
        c.fillStyle = 'rgba(0,0,0,0.08)';
        c.beginPath();
        c.ellipse(0, 16 * squish, 18, 4, 0, 0, Math.PI * 2);
        c.fill();

        // Body (with squish)
        c.fillStyle = col;
        c.beginPath();
        c.ellipse(0, 0, 20, 16 * squish, 0, 0, Math.PI * 2);
        c.fill();
        // Body shadow (bottom)
        c.fillStyle = bodyDark;
        c.beginPath();
        c.ellipse(0, 4 * squish, 18, 8 * squish, 0, 0, Math.PI);
        c.fill();
        // Body highlight (top)
        c.fillStyle = bodyLight;
        c.beginPath();
        c.ellipse(-4, -6 * squish, 8, 5 * squish, -0.3, 0, Math.PI * 2);
        c.fill();

        // Wing (left/back wing — simple)
        c.save();
        c.translate(-6, -2);
        c.rotate(wingAngle);
        c.fillStyle = bodyDark;
        c.beginPath();
        c.ellipse(0, 8, 10, 7, 0.2, 0, Math.PI);
        c.fill();
        c.restore();

        // Wing (right/front wing — detailed)
        c.save();
        c.translate(2, -2);
        c.rotate(-wingAngle);
        c.fillStyle = col;
        c.beginPath();
        c.ellipse(0, 8, 11, 8, -0.2, 0, Math.PI);
        c.fill();
        c.strokeStyle = bodyDark;
        c.lineWidth = 0.8;
        c.stroke();
        // Wing feather lines
        c.strokeStyle = 'rgba(0,0,0,0.12)';
        c.lineWidth = 0.5;
        for (let i = 0; i < 3; i++) {
          c.beginPath();
          c.moveTo(-4 + i * 4, 4);
          c.quadraticCurveTo(-2 + i * 4, 10, i * 4, 15);
          c.stroke();
        }
        c.restore();

        // Tail
        c.fillStyle = col;
        c.beginPath();
        c.moveTo(-18, -4 * squish);
        c.quadraticCurveTo(-28, -12 * squish, -24, -16 * squish);
        c.quadraticCurveTo(-20, -10 * squish, -18, 2 * squish);
        c.closePath();
        c.fill();
        c.fillStyle = bodyDark;
        c.beginPath();
        c.moveTo(-18, -2 * squish);
        c.quadraticCurveTo(-26, -8 * squish, -24, -14 * squish);
        c.lineWidth = 0.5;
        c.stroke();

        // Legs
        c.strokeStyle = '#FF8C00';
        c.lineWidth = 2.2;
        c.lineCap = 'round';
        if (legPhase >= 0) {
          // Animated walking legs
          const lx1 = -7, lx2 = 7;
          const footY = 14 * squish + 10;
          const swing1 = Math.sin(legPhase) * 6;
          const swing2 = Math.sin(legPhase + Math.PI) * 6;
          c.beginPath();
          c.moveTo(lx1, 14 * squish);
          c.lineTo(lx1 + swing1, footY);
          c.stroke();
          c.beginPath();
          c.moveTo(lx2, 14 * squish);
          c.lineTo(lx2 + swing2, footY);
          c.stroke();
          // Feet (little triangles)
          c.fillStyle = '#FF8C00';
          drawFoot(c, lx1 + swing1, footY, swing1 > 0 ? 1 : -1);
          drawFoot(c, lx2 + swing2, footY, swing2 > 0 ? 1 : -1);
        } else {
          // Static standing legs
          c.beginPath();
          c.moveTo(-7, 14 * squish); c.lineTo(-7, 14 * squish + 10);
          c.moveTo(7, 14 * squish); c.lineTo(7, 14 * squish + 10);
          c.stroke();
          c.fillStyle = '#FF8C00';
          drawFoot(c, -7, 14 * squish + 10, 1);
          drawFoot(c, 7, 14 * squish + 10, 1);
        }

        // Head
        const hRel = headY - bodyY + headBob;
        c.fillStyle = col;
        c.beginPath();
        c.arc(0, hRel, 13, 0, Math.PI * 2);
        c.fill();
        // Head highlight
        c.fillStyle = bodyLight;
        c.beginPath();
        c.arc(-3, hRel - 4, 5, 0, Math.PI * 2);
        c.fill();

        // Cheek blush
        if (cheekBlush) {
          c.fillStyle = 'rgba(255,100,100,0.25)';
          c.beginPath();
          c.ellipse(8, hRel + 3, 4, 3, 0, 0, Math.PI * 2);
          c.fill();
          c.beginPath();
          c.ellipse(-6, hRel + 3, 4, 3, 0, 0, Math.PI * 2);
          c.fill();
        }

        // Beak
        c.fillStyle = '#FF8C00';
        c.beginPath();
        if (beakOpen > 0) {
          // Open beak (upper + lower)
          c.moveTo(13, hRel - 1);
          c.lineTo(22, hRel - 1 - beakOpen * 2);
          c.lineTo(14, hRel + 1);
          c.closePath();
          c.fill();
          c.fillStyle = '#E07000';
          c.beginPath();
          c.moveTo(13, hRel + 1);
          c.lineTo(20, hRel + 3 + beakOpen * 2);
          c.lineTo(14, hRel + 3);
          c.closePath();
          c.fill();
        } else {
          c.moveTo(13, hRel);
          c.lineTo(22, hRel + 3);
          c.lineTo(13, hRel + 5);
          c.closePath();
          c.fill();
        }

        // Eye
        if (eyeState === 'closed') {
          c.strokeStyle = '#111';
          c.lineWidth = 1.5;
          c.beginPath();
          c.moveTo(3, hRel - 2);
          c.lineTo(8, hRel - 2);
          c.stroke();
        } else if (eyeState === 'dizzy') {
          // X eyes
          c.strokeStyle = '#111';
          c.lineWidth = 1.2;
          c.beginPath();
          c.moveTo(3.5, hRel - 4); c.lineTo(7.5, hRel);
          c.moveTo(7.5, hRel - 4); c.lineTo(3.5, hRel);
          c.stroke();
        } else {
          // Open or wide
          const eyeR = eyeState === 'wide' ? 3.5 : 2.5;
          c.fillStyle = '#fff';
          c.beginPath(); c.arc(5.5, hRel - 2, eyeR + 0.5, 0, Math.PI * 2); c.fill();
          c.fillStyle = '#111';
          c.beginPath(); c.arc(5.5, hRel - 2, eyeR, 0, Math.PI * 2); c.fill();
          // Highlight
          c.fillStyle = '#fff';
          c.beginPath(); c.arc(6.5, hRel - 3, 1, 0, Math.PI * 2); c.fill();
        }

        // Sweat drop
        if (sweatDrop) {
          c.fillStyle = 'rgba(100,180,255,0.6)';
          c.beginPath();
          c.moveTo(-10, hRel - 6);
          c.quadraticCurveTo(-12, hRel - 2, -10, hRel);
          c.quadraticCurveTo(-8, hRel - 2, -10, hRel - 6);
          c.fill();
        }

        // Zzz for sleeping
        if (zzzs) {
          c.fillStyle = 'rgba(0,0,0,0.25)';
          c.font = '8px sans-serif';
          const zOff = Math.sin(t * Math.PI * 2) * 3;
          c.fillText('z', 12, hRel - 10 + zOff);
          c.font = '6px sans-serif';
          c.fillText('z', 18, hRel - 16 + zOff);
          c.font = '5px sans-serif';
          c.fillText('z', 22, hRel - 20 + zOff);
        }

        // Hat accessories
        if (hasHat === 'cone') {
          c.fillStyle = '#FFA500';
          c.beginPath();
          c.moveTo(0, hRel - 13);
          c.lineTo(-7, hRel - 2);
          c.lineTo(7, hRel - 2);
          c.closePath();
          c.fill();
          c.fillStyle = '#fff';
          c.beginPath();
          c.ellipse(0, hRel - 2, 8, 2, 0, 0, Math.PI * 2);
          c.fill();
        } else if (hasHat === 'umbrella') {
          c.strokeStyle = '#E74C3C';
          c.lineWidth = 1.5;
          c.beginPath();
          c.moveTo(0, hRel - 8);
          c.lineTo(0, hRel - 22);
          c.stroke();
          c.fillStyle = '#E74C3C';
          c.beginPath();
          c.arc(0, hRel - 22, 12, Math.PI, 0);
          c.fill();
        }

        c.restore();

        fi++;
      }
    }
    return cv;
  }

  /** Darken a hex color by ratio (0-1). */
  function darkenHex(hex, ratio) {
    const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
    return '#' + [r,g,b].map(v => Math.max(0, Math.round(v * (1 - ratio))).toString(16).padStart(2,'0')).join('');
  }
  /** Lighten a hex color by ratio (0-1). */
  function lightenHex(hex, ratio) {
    const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
    return '#' + [r,g,b].map(v => Math.min(255, Math.round(v + (255 - v) * ratio)).toString(16).padStart(2,'0')).join('');
  }
  /** Draw a small webbed foot. */
  function drawFoot(c, x, y, dir) {
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x + dir * 5, y + 2);
    c.lineTo(x + dir * 3, y + 4);
    c.lineTo(x, y + 2);
    c.lineTo(x - dir * 2, y + 4);
    c.lineTo(x - dir * 1, y + 2);
    c.closePath();
    c.fill();
  }

  // ═══════════════════════════════════════════════════════════════
  //  §5  AudioManager
  // ═══════════════════════════════════════════════════════════════

  class AudioManager {
    constructor(cfg) {
      this._actx = null; this._gain = null;
      this._enabled = cfg.enabled !== false;
      this._urls = { quack: cfg.quackUrl || '', splash: cfg.splashUrl || '' };
      this._bufs = {};
      this._ready = false;
      this._muted = false;
      this._vol = 0.4;
      const p = loadPrefs();
      if (p.muted != null) this._muted = p.muted;
      if (p.volume != null) this._vol = p.volume;
    }

    _init() {
      if (this._ready || !this._enabled) return;
      try {
        this._actx = new (window.AudioContext || window.webkitAudioContext)();
        this._gain = this._actx.createGain();
        this._gain.connect(this._actx.destination);
        this._applyVol();
        this._ready = true;
      } catch { this._enabled = false; }
    }

    _applyVol() {
      if (!this._gain) return;
      const v = this._muted ? 0 : this._vol * this._vol; // exponential curve
      this._gain.gain.setTargetAtTime(v, this._actx.currentTime, 0.05);
    }

    playQuack() {
      this._init();
      if (!this._actx || this._muted) return;
      const ac = this._actx, t = ac.currentTime;
      const osc = ac.createOscillator(), g = ac.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, t);
      osc.frequency.exponentialRampToValueAtTime(400, t + 0.12);
      g.gain.setValueAtTime(0.25, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
      osc.connect(g); g.connect(this._gain);
      osc.start(t); osc.stop(t + 0.15);
    }

    playSplash() {
      this._init();
      if (!this._actx || this._muted) return;
      const ac = this._actx, t = ac.currentTime;
      const len = ac.sampleRate * 0.2;
      const buf = ac.createBuffer(1, len, ac.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (len * 0.15));
      const src = ac.createBufferSource(); src.buffer = buf;
      const filt = ac.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = 2000;
      const g = ac.createGain();
      g.gain.setValueAtTime(0.15, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      src.connect(filt); filt.connect(g); g.connect(this._gain);
      src.start(t);
    }

    setVolume(v) { this._vol = clamp(v, 0, 1); this._applyVol(); savePrefs({ ...loadPrefs(), volume: this._vol }); }
    toggleMute() { this._muted = !this._muted; this._applyVol(); savePrefs({ ...loadPrefs(), muted: this._muted }); return this._muted; }
    get muted() { return this._muted; }
    get volume() { return this._vol; }

    destroy() {
      if (this._actx && this._actx.state !== 'closed') try { this._actx.close(); } catch {}
      this._actx = null; this._gain = null; this._bufs = {};
    }
  }

  // ═══════════════════════════════════════════════════════════════
  //  §6  Particle Pool
  // ═══════════════════════════════════════════════════════════════

  class Particle {
    constructor() { this.reset(); }
    reset() {
      this.alive = false;
      this.x = 0; this.y = 0; this.vx = 0; this.vy = 0;
      this.life = 0; this.maxLife = 1; this.size = 4;
      this.color = '#fff'; this.alpha = 1; this.gravity = 0;
      this.type = 'circle'; // circle | star | drop | text
      this.text = '';
    }
  }

  class ParticlePool {
    constructor(max) {
      this._p = []; for (let i = 0; i < max; i++) this._p.push(new Particle());
    }
    spawn(o) {
      const p = this._p.find(p => !p.alive);
      if (!p) return null;
      p.alive = true; p.life = 0; p.alpha = 1;
      p.x = o.x||0; p.y = o.y||0; p.vx = o.vx||0; p.vy = o.vy||0;
      p.maxLife = o.maxLife||1; p.size = o.size||4;
      p.color = o.color||'#fff'; p.gravity = o.gravity||0;
      p.type = o.type||'circle'; p.text = o.text||'';
      return p;
    }
    update(dt) {
      for (const p of this._p) {
        if (!p.alive) continue;
        p.life += dt;
        if (p.life >= p.maxLife) { p.alive = false; continue; }
        p.vy += p.gravity * dt;
        p.x += p.vx * dt; p.y += p.vy * dt;
        p.alpha = clamp(1 - p.life / p.maxLife, 0, 1);
      }
    }
    /** Draw particles in absolute page coords. Caller must set up transforms. */
    draw(ctx, offX, offY) {
      for (const p of this._p) {
        if (!p.alive) continue;
        const px = p.x + offX, py = p.y + offY;
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        if (p.type === 'drop') {
          ctx.beginPath(); ctx.ellipse(px, py, p.size * 0.5, p.size, 0, 0, Math.PI * 2); ctx.fill();
        } else if (p.type === 'star') {
          ctx.beginPath();
          for (let i = 0; i < 5; i++) {
            const a = (i * 4 * Math.PI) / 5 - Math.PI / 2;
            ctx[i ? 'lineTo' : 'moveTo'](px + p.size * Math.cos(a), py + p.size * Math.sin(a));
          }
          ctx.closePath(); ctx.fill();
        } else if (p.type === 'text') {
          ctx.font = `bold ${p.size}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.fillText(p.text, px, py);
        } else {
          ctx.beginPath(); ctx.arc(px, py, p.size, 0, Math.PI * 2); ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    }
    get aliveCount() { let n = 0; for (const p of this._p) if (p.alive) n++; return n; }
    clear() { for (const p of this._p) p.alive = false; }
  }

  // ═══════════════════════════════════════════════════════════════
  //  §7  Renderer (Canvas 2D, double-buffer, OffscreenCanvas)
  // ═══════════════════════════════════════════════════════════════

  class Renderer {
    constructor(parentEl, opts) {
      this._scale = opts.scale || 1;
      this._dpr = window.devicePixelRatio || 1;
      this._recomputeSizes();

      // Visible canvas
      this.canvas = document.createElement('canvas');
      this._applySizes(this.canvas);
      this.canvas.style.imageRendering = 'pixelated';
      this.canvas.setAttribute('aria-hidden', 'true');
      this.ctx = this.canvas.getContext('2d');
      this.ctx.imageSmoothingEnabled = false;

      // Double-buffer
      const useOff = typeof OffscreenCanvas !== 'undefined';
      this._buf = useOff
        ? new OffscreenCanvas(this._pw, this._ph)
        : (() => { const c = document.createElement('canvas'); c.width = this._pw; c.height = this._ph; return c; })();
      this._bc = this._buf.getContext('2d');
      this._bc.imageSmoothingEnabled = false;

      parentEl.appendChild(this.canvas);
      this._atlas = null;
      this._ad = null;
    }

    _recomputeSizes() {
      this._cw = Math.ceil(FRAME_W * this._scale * 2.5);
      this._ch = Math.ceil(FRAME_H * this._scale * 2.5);
      this._pw = this._cw * this._dpr;
      this._ph = this._ch * this._dpr;
    }

    _applySizes(cv) {
      cv.width = this._pw; cv.height = this._ph;
      cv.style.width = this._cw + 'px'; cv.style.height = this._ch + 'px';
    }

    setAtlas(img, ad) { this._atlas = img; this._ad = ad; }

    setScale(s) {
      this._scale = s; this._recomputeSizes();
      this._applySizes(this.canvas);
      this.ctx = this.canvas.getContext('2d'); this.ctx.imageSmoothingEnabled = false;
      this._buf.width = this._pw; this._buf.height = this._ph;
      this._bc = this._buf.getContext('2d'); this._bc.imageSmoothingEnabled = false;
    }

    get W()  { return this._cw; }
    get H()  { return this._ch; }
    get fS() { return FRAME_W * this._scale; } // scaled frame size

    clear() { this._bc.setTransform(this._dpr, 0, 0, this._dpr, 0, 0); this._bc.clearRect(0, 0, this._cw, this._ch); }

    /** Draw a sprite frame into the buffer. ox/oy are buffer-local CSS coords. */
    drawFrame(seq, fi, ox, oy, flipX) {
      if (!this._atlas || !this._ad) return;
      const s = this._ad.sequences[seq]; if (!s) return;
      const fr = s.frames[fi % s.frameCount];
      const dw = FRAME_W * this._scale, dh = FRAME_H * this._scale;
      this._bc.save();
      if (flipX) { this._bc.translate(ox + dw, oy); this._bc.scale(-1, 1); this._bc.drawImage(this._atlas, fr.x, fr.y, fr.w, fr.h, 0, 0, dw, dh); }
      else this._bc.drawImage(this._atlas, fr.x, fr.y, fr.w, fr.h, ox, oy, dw, dh);
      this._bc.restore();
    }

    /** Draw egg-wobble placeholder. */
    drawEgg(t) {
      const cx = this._cw / 2, cy = this._ch / 2, s = this._scale;
      const w = Math.sin(t * DEF_TIMING.eggWobbleSpeed) * 0.15;
      this._bc.save(); this._bc.translate(cx, cy); this._bc.rotate(w);
      this._bc.fillStyle = '#FFFDE7';
      this._bc.beginPath(); this._bc.ellipse(0, 0, 14 * s, 18 * s, 0, 0, Math.PI * 2); this._bc.fill();
      this._bc.strokeStyle = '#FFD54F'; this._bc.lineWidth = 1.5 * s; this._bc.stroke();
      this._bc.strokeStyle = '#FFC107'; this._bc.lineWidth = s;
      this._bc.beginPath(); this._bc.moveTo(-4*s, -2*s); this._bc.lineTo(0, 3*s); this._bc.lineTo(4*s, 0); this._bc.stroke();
      this._bc.restore();
    }

    /** Get buffer context for custom drawing by behaviors. */
    get bc() { return this._bc; }

    /** Blit buffer → visible. */
    present() {
      this.ctx.setTransform(1, 0, 0, 1, 0, 0);
      this.ctx.clearRect(0, 0, this._pw, this._ph);
      this.ctx.drawImage(this._buf, 0, 0);
    }

    destroy() { this.canvas.remove(); this._atlas = null; this._ad = null; }
  }

  // ═══════════════════════════════════════════════════════════════
  //  §8  Blackboard (shared cross-state variables)
  // ═══════════════════════════════════════════════════════════════

  class Blackboard {
    constructor() {
      // duck physics
      this.x = 200; this.y = 400; this.vx = 0; this.vy = 0;
      this.onGround = true; this.facingR = true;
      // viewport
      this.vpW = window.innerWidth; this.vpH = window.innerHeight;
      this.scrollY = window.scrollY; this.scrollProg = 0;
      this.scrollVel = 0; // px/s scroll velocity (positive = down)
      this.scrolling = false; // true while actively scrolling
      // cursor
      this.curX = -1; this.curY = -1; this.curNear = false;
      // input focus
      this.inputFocused = false;
      // accessibility
      this.reducedMotion = false;
      // tab
      this.tabHidden = false;
      // gag tracking
      this.lastMedGag  = -Infinity;
      this.lastBigGag  = -Infinity;
      this.lastInteraction = -Infinity;
      this.lastGagName = '';
      // time
      this.tod = 'day'; // dawn | day | dusk | night
      this.netSlow = false;
      // perches
      this.perches = []; this.curPerch = null;
      // surfaces — DOM elements the duck can walk on
      this.surfaces = [];
      // drag
      this.dragging = false;
      // misc
      this.paused = false; this.elapsed = 0; this.frames = 0; this.fps = 60;
    }
    updateTOD() {
      const h = new Date().getHours();
      this.tod = h < 5 ? 'night' : h < 8 ? 'dawn' : h < 18 ? 'day' : h < 21 ? 'dusk' : 'night';
    }
    /** Ground Y for the duck's feet (bottom of viewport minus frame). */
    groundY(fS) { return this.vpH - fS; }

    /**
     * Find the nearest walkable surface at the duck's current x position.
     * Returns { y, el, left, right } or null.
     */
    surfaceAt(x, fS) {
      let best = null;
      for (const s of this.surfaces) {
        if (x + fS * 0.3 >= s.left && x + fS * 0.7 <= s.right) {
          const sy = s.top - fS;
          if (!best || sy > best.y) best = { y: sy, el: s.el, left: s.left, right: s.right };
        }
      }
      return best;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  //  §9  Hierarchical State Machine
  // ═══════════════════════════════════════════════════════════════

  /** Base class for all behavior states. */
  class State {
    /**
     * @param {string} id
     * @param {string} group  ambient | medium_gag | big_gag | interaction | drag_drop | safety
     */
    constructor(id, group) {
      this.id = id;
      this.group = group;
      this.elapsed = 0;
      this.fTimer = 0;   // frame timer (seconds accumulated)
      this.frame = 0;     // current frame index
    }
    /** Called when entering this state. */
    enter(bb, cx) { this.elapsed = 0; this.fTimer = 0; this.frame = 0; }
    /** Called every tick. Return nothing; call cx.sched.next() to leave. */
    update(dt, bb, cx) { this.elapsed += dt; }
    /** Called when leaving this state. */
    exit(bb, cx) {}
    /** Draw overlay on top of the duck sprite (called after _drawState). */
    postDraw(bb, cx) {}
    /** Whether this state may start given blackboard conditions. */
    canStart(bb) { return true; }
    /** Minimum ms between activations (checked by scheduler). */
    get cooldownMs() { return 0; }
    /** Default animation sequence name. */
    get seq() { return 'idle_preen'; }
  }

  /** Advance the frame counter for a sequence, returns frame index or -1 if non-loop ended. */
  function advFrame(state, dt, ad, seqName) {
    const s = ad.sequences[seqName]; if (!s) return 0;
    state.fTimer += dt;
    const durS = s.frameDurationMs / 1000;
    if (state.fTimer >= durS) {
      state.fTimer -= durS;
      state.frame++;
      if (state.frame >= s.frameCount) {
        if (s.loop) state.frame = 0;
        else { state.frame = s.frameCount - 1; return -1; }
      }
    }
    return state.frame;
  }

  class HSM {
    constructor(bus) { this._s = {}; this._cur = null; this._def = null; this._bus = bus; this._lock = false; }
    register(s) { this._s[s.id] = s; }
    setDefault(id) { this._def = id; }
    get current() { return this._cur; }
    get id() { return this._cur ? this._cur.id : null; }
    get states() { return this._s; }

    go(id, bb, cx) {
      if (this._lock) return false;
      const ns = this._s[id]; if (!ns) return false;
      if (this._cur) this._cur.exit(bb, cx);
      this._cur = ns; ns.enter(bb, cx);
      this._bus.emit('stateChange', { stateId: id, group: ns.group });
      return true;
    }
    update(dt, bb, cx) { if (this._cur) this._cur.update(dt, bb, cx); }
    lock() { this._lock = true; }
    unlock() { this._lock = false; }
    goDefault(bb, cx) { if (this._def) this.go(this._def, bb, cx); }
  }

  // ═══════════════════════════════════════════════════════════════
  //  §10  Behavior Definitions
  // ═══════════════════════════════════════════════════════════════

  /** Shared helper: draw flapping wings overlay on the buffer canvas during flight. */
  function _drawFlappingWings(bc, ren, elapsed, bodyColor) {
    const mid = ren.W / 2, cy = ren.H / 2;
    const wingFlap = Math.sin(elapsed * 18) * 0.8; // 18 rad/s ≈ 3 Hz flap
    const wingCol = bodyColor ? bodyColor + '99' : 'rgba(255,200,0,0.5)';
    bc.save();
    bc.translate(mid, cy - 2);
    // Left wing
    bc.save();
    bc.translate(-11, -3);
    bc.rotate(-Math.abs(wingFlap) - 0.4);
    bc.fillStyle = wingCol;
    bc.beginPath(); bc.ellipse(0, 0, 15, 7, 0, 0, Math.PI); bc.fill();
    bc.restore();
    // Right wing
    bc.save();
    bc.translate(11, -3);
    bc.rotate(Math.abs(wingFlap) + 0.4);
    bc.fillStyle = wingCol;
    bc.beginPath(); bc.ellipse(0, 0, 15, 7, 0, 0, -Math.PI); bc.fill();
    bc.restore();
    bc.restore();
  }

  // ─── Ambient ───

  class WalkEdgeFollow extends State {
    constructor() { super('walk_edge_follow', 'ambient'); this._tx = 0; this._done = false; }
    enter(bb, cx) {
      super.enter(bb, cx);
      this._done = false;
      const m = cx.ren.fS;
      this._tx = rand(m, bb.vpW - m);
      bb.facingR = this._tx > bb.x;
      bb.onGround = true;
      if (bb.y !== bb.groundY(cx.ren.fS)) bb.y = bb.groundY(cx.ren.fS);
    }
    update(dt, bb, cx) {
      super.update(dt, bb, cx);
      if (this._done) { if (this.elapsed > 5) cx.sched.next(bb, cx); return; }
      const spd = cx.tim.walkSpeed * cx.opts.speed;
      const dir = this._tx > bb.x ? 1 : -1;
      bb.facingR = dir > 0;
      bb.x += dir * spd * dt;
      if (Math.abs(bb.x - this._tx) < 4) this._done = true;
      advFrame(this, dt, cx.ad, 'walk_right');
    }
    canStart(bb) { return bb.onGround && !bb.inputFocused; }
    get seq() { return 'walk_right'; }
  }

  class PerchAndPeer extends State {
    constructor() { super('perch_and_peer', 'ambient'); this._el = null; this._arriving = true; this._startX = 0; this._startY = 0; this._targetX = 0; this._targetY = 0; this._arriveT = 0; this._flightDur = 1.2; }
    enter(bb, cx) {
      super.enter(bb, cx);
      this._el = bb.perches.length ? pick(bb.perches) : null;
      this._arriving = false;
      if (this._el) {
        const r = this._el.getBoundingClientRect();
        this._targetX = r.left + r.width / 2 - cx.ren.fS / 2;
        this._targetY = r.top - cx.ren.fS;
        this._startX = bb.x;
        this._startY = bb.y;
        this._arriveT = 0;
        this._arriving = true;
        // Flight duration scales with distance
        const dist = Math.sqrt(Math.pow(this._targetX - this._startX, 2) + Math.pow(this._targetY - this._startY, 2));
        this._flightDur = clamp(dist / 250, 0.8, 2.0);
        bb.curPerch = this._el;
        bb.onGround = false;
        bb.facingR = this._targetX > this._startX;
      }
    }
    update(dt, bb, cx) {
      super.update(dt, bb, cx);
      if (this._arriving) {
        this._arriveT += dt;
        const t = clamp(this._arriveT / this._flightDur, 0, 1);
        const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; // ease-in-out
        bb.x = lerp(this._startX, this._targetX, ease);
        bb.y = lerp(this._startY, this._targetY, ease);
        // Arc: rise higher in the middle of flight
        const arcHeight = Math.abs(this._targetY - this._startY) * 0.4 + 40;
        bb.y -= Math.sin(t * Math.PI) * arcHeight;
        // Draw flapping wings
        _drawFlappingWings(cx.ren.bc, cx.ren, this._arriveT, this._duckColor || cx.opts.duckColor);
        // Trail particles
        if (Math.random() < dt * 12) {
          const fS = cx.ren.fS;
          cx.parts.spawn({ x: bb.x + fS/2 + rand(-8,8), y: bb.y + fS, vx: rand(-15,15), vy: rand(5,20), maxLife: 0.4, size: rand(2,4), color: 'rgba(255,255,255,0.5)', type: 'circle', gravity: -10 });
        }
        advFrame(this, dt, cx.ad, 'walk_right');
        if (t >= 1) this._arriving = false;
        return;
      }
      // Track perch if it moves (e.g. sticky header)
      if (this._el) {
        const r = this._el.getBoundingClientRect();
        bb.x = r.left + r.width / 2 - cx.ren.fS / 2;
        bb.y = r.top - cx.ren.fS;
      }
      advFrame(this, dt, cx.ad, 'perch_idle');
      if ((this.elapsed - this._flightDur) * 1000 > cx.tim.perchDurationMs) cx.sched.next(bb, cx);
    }
    exit(bb, cx) { bb.curPerch = null; bb.onGround = false; }
    canStart(bb) { return bb.perches.length > 0; }
    get cooldownMs() { return 10000; }
    get seq() { return 'perch_idle'; }
  }

  class IdlePreen extends State {
    constructor() { super('idle_preen', 'ambient'); }
    update(dt, bb, cx) {
      super.update(dt, bb, cx);
      advFrame(this, dt, cx.ad, 'idle_preen');
      if (this.elapsed * 1000 > cx.tim.preenDurationMs) cx.sched.next(bb, cx);
    }
    canStart(bb) { return bb.onGround; }
    get cooldownMs() { return 5000; }
    get seq() { return 'idle_preen'; }
  }

  class IdleNap extends State {
    constructor() { super('idle_nap', 'ambient'); }
    update(dt, bb, cx) {
      super.update(dt, bb, cx);
      advFrame(this, dt, cx.ad, 'idle_nap');
      // Zzz particles
      if (Math.random() < dt * 0.8) {
        const fS = cx.ren.fS;
        cx.parts.spawn({ x: bb.x + fS * 0.7, y: bb.y - 5, vx: rand(5, 15), vy: rand(-25, -15), maxLife: 2.2, size: rand(8, 13), color: '#7B68EE', type: 'text', text: 'z', gravity: -5 });
      }
      if (this.elapsed * 1000 > cx.tim.napDurationMs) cx.sched.next(bb, cx);
    }
    canStart(bb) { return bb.onGround && !bb.curNear; }
    get cooldownMs() { return 15000; }
    get seq() { return 'idle_nap'; }
  }

  class PuddleHop extends State {
    constructor() { super('puddle_hop', 'ambient'); this._ph = 0; this._by = 0; }
    enter(bb, cx) { super.enter(bb, cx); this._ph = 0; this._by = bb.y; }
    update(dt, bb, cx) {
      super.update(dt, bb, cx);
      this._ph += dt * 4;
      const hop = Math.abs(Math.sin(this._ph)) * 20 * cx.opts.scale;
      bb.y = this._by - hop;
      bb.x += (bb.facingR ? 1 : -1) * 30 * dt * cx.opts.speed;
      // splash on landing
      const prev = Math.sin(this._ph - dt * 4);
      const cur  = Math.sin(this._ph);
      if (cur < 0.05 && prev >= 0.05) {
        for (let i = 0; i < 5; i++)
          cx.parts.spawn({ x: bb.x + cx.ren.fS/2, y: this._by + cx.ren.fS, vx: rand(-40,40), vy: rand(-60,-20), maxLife: 0.6, size: 3, color: '#4682B4', type: 'drop', gravity: 200 });
        cx.audio.playSplash();
      }
      advFrame(this, dt, cx.ad, 'puddle_hop');
      if (this._ph > Math.PI * 6) { bb.y = this._by; cx.sched.next(bb, cx); }
    }
    canStart(bb) { return bb.onGround; }
    get cooldownMs() { return 12000; }
    get seq() { return 'puddle_hop'; }
  }

  // ─── Ambient: Read Newspaper ───

  class ReadNewspaper extends State {
    constructor() { super('read_newspaper', 'ambient'); }
    enter(bb, cx) {
      super.enter(bb, cx);
      cx.audio.playQuack();
    }
    update(dt, bb, cx) {
      super.update(dt, bb, cx);
      const fS = cx.ren.fS;

      advFrame(this, dt, cx.ad, 'read_newspaper');

      // Occasional surprised reaction (page turn)
      if (this.elapsed > 3 && Math.floor(this.elapsed * 2) % 4 === 0) {
        if (Math.random() < dt * 0.5) {
          cx.parts.spawn({ x: bb.x + fS / 2, y: bb.y - 5, vx: 0, vy: -15, maxLife: 1.2, size: 12, color: '#FF3333', type: 'text', text: '!', gravity: 0 });
        }
      }

      if (this.elapsed > 6) cx.sched.next(bb, cx);
    }
    postDraw(bb, cx) {
      const bc = cx.ren.bc;
      const mid = cx.ren.W / 2;
      const baseY = cx.ren.H / 2;
      const sg = cx.opts.scale;
      const dir = bb.facingR ? 1 : -1;

      // Draw newspaper held in front of duck
      bc.save();
      bc.translate(mid + dir * 12 * sg, baseY - 2 * sg);
      bc.rotate(dir * -0.08);
      const pw = 22 * sg, ph = 18 * sg;
      // Paper background
      bc.fillStyle = '#FFF8DC';
      bc.fillRect(-pw / 2, -ph / 2, pw, ph);
      // Border
      bc.strokeStyle = '#C0B89A';
      bc.lineWidth = 0.8 * sg;
      bc.strokeRect(-pw / 2, -ph / 2, pw, ph);
      // Fold line
      bc.strokeStyle = '#DDD';
      bc.lineWidth = 0.5;
      bc.beginPath(); bc.moveTo(0, -ph / 2); bc.lineTo(0, ph / 2); bc.stroke();
      // Headline text bars
      bc.fillStyle = '#333';
      bc.fillRect(-pw / 2 + 2, -ph / 2 + 2, pw * 0.4, 2 * sg); // big headline
      bc.fillRect(-pw / 2 + 2, -ph / 2 + 5 * sg, pw - 4, 1 * sg);
      bc.fillRect(-pw / 2 + 2, -ph / 2 + 7 * sg, pw * 0.8, 1 * sg);
      bc.fillRect(-pw / 2 + 2, -ph / 2 + 9 * sg, pw - 4, 1 * sg);
      // Photo block
      bc.fillStyle = '#AAA';
      bc.fillRect(pw / 2 - 8 * sg, -ph / 2 + 2, 6 * sg, 5 * sg);
      bc.restore();
    }
    canStart(bb) { return bb.onGround && !bb.curNear; }
    get cooldownMs() { return 20000; }
    get seq() { return 'read_newspaper'; }
  }

  // ─── Ambient: Eat Seeds ───

  class EatSeeds extends State {
    constructor() { super('eat_seeds', 'ambient'); this._seeds = []; this._eaten = 0; }
    enter(bb, cx) {
      super.enter(bb, cx);
      // Scatter seeds on the ground near the duck
      this._seeds = [];
      this._eaten = 0;
      const fS = cx.ren.fS;
      for (let i = 0; i < 8; i++) {
        this._seeds.push({
          x: bb.x + fS / 2 + rand(-40, 40),
          y: bb.y + fS - rand(0, 4),
          alive: true,
          size: rand(2, 4),
        });
      }
    }
    update(dt, bb, cx) {
      super.update(dt, bb, cx);
      const fS = cx.ren.fS;
      const bc = cx.ren.bc;

      // Draw seeds (in buffer-local coords)
      const offX = -(bb.x - (cx.ren.W - fS) / 2);
      const offY = -(bb.y - (cx.ren.H - fS) / 2);
      bc.save();
      for (const s of this._seeds) {
        if (!s.alive) continue;
        bc.fillStyle = '#8B6914';
        bc.beginPath();
        bc.ellipse(s.x + offX, s.y + offY, s.size, s.size * 0.6, 0.3, 0, Math.PI * 2);
        bc.fill();
      }
      bc.restore();

      // Duck pecks at nearest alive seed
      const peckCycle = Math.sin(this.elapsed * Math.PI * 2.5);
      if (peckCycle > 0.95 && this._seeds.some(s => s.alive)) {
        // Find nearest seed
        let best = null, bestD = Infinity;
        for (const s of this._seeds) {
          if (!s.alive) continue;
          const d = Math.abs(s.x - (bb.x + fS / 2));
          if (d < bestD) { bestD = d; best = s; }
        }
        if (best && bestD < 50) {
          best.alive = false;
          this._eaten++;
          // Crumb particles
          cx.parts.spawn({ x: best.x, y: best.y, vx: rand(-15, 15), vy: rand(-20, -5), maxLife: 0.4, size: 2, color: '#D4A017', type: 'circle', gravity: 100 });
          cx.parts.spawn({ x: best.x, y: best.y, vx: rand(-10, 10), vy: rand(-15, -5), maxLife: 0.3, size: 1.5, color: '#C49B0A', type: 'circle', gravity: 120 });
        }
      }

      // Walk slowly toward seeds
      const aliveSeeds = this._seeds.filter(s => s.alive);
      if (aliveSeeds.length > 0) {
        const nearest = aliveSeeds.reduce((a, b) =>
          Math.abs(a.x - (bb.x + fS / 2)) < Math.abs(b.x - (bb.x + fS / 2)) ? a : b
        );
        const dir = nearest.x > bb.x + fS / 2 ? 1 : -1;
        bb.facingR = dir > 0;
        bb.x += dir * 15 * dt;
      }

      advFrame(this, dt, cx.ad, 'eat_seeds');

      if (aliveSeeds.length === 0 || this.elapsed > 8) {
        // Happy quack after eating
        if (this._eaten > 0) cx.audio.playQuack();
        cx.sched.next(bb, cx);
      }
    }
    canStart(bb) { return bb.onGround && !bb.curNear; }
    get cooldownMs() { return 15000; }
    get seq() { return 'eat_seeds'; }
  }

  // ─── Ambient: Sunbathe ───

  class Sunbathe extends State {
    constructor() { super('sunbathe', 'ambient'); }
    update(dt, bb, cx) {
      super.update(dt, bb, cx);

      // Sun rays from top
      if (Math.random() < dt * 3) {
        cx.parts.spawn({ x: bb.x + rand(-20, cx.ren.fS + 20), y: bb.y - 20, vx: 0, vy: 15, maxLife: 1.5, size: rand(1, 2), color: 'rgba(255,220,50,0.4)', type: 'circle', gravity: 0 });
      }

      // Content sigh bubbles
      if (this.elapsed > 2 && Math.random() < dt * 0.3) {
        cx.parts.spawn({ x: bb.x + cx.ren.fS * 0.7, y: bb.y - 5, vx: rand(3, 8), vy: rand(-12, -6), maxLife: 1.5, size: 10, color: '#FF69B4', type: 'text', text: '♥', gravity: -5 });
      }

      advFrame(this, dt, cx.ad, 'sunbathe');
      if (this.elapsed > 8) cx.sched.next(bb, cx);
    }
    postDraw(bb, cx) {
      const bc = cx.ren.bc;
      const mid = cx.ren.W / 2;
      const baseY = cx.ren.H / 2;
      const sg = cx.opts.scale;
      const dir = bb.facingR ? 1 : -1;

      // Draw large sunglasses on top of duck's face
      bc.save();
      bc.translate(mid + dir * 3 * sg, baseY - 12 * sg);
      const lW = 11 * sg, lH = 7 * sg, gap = 3 * sg;
      // Lens shadows for depth
      bc.fillStyle = 'rgba(0,0,0,0.15)';
      bc.beginPath(); bc.roundRect(-lW - gap / 2 + 1, -lH / 2 + 1, lW, lH, 3 * sg); bc.fill();
      bc.beginPath(); bc.roundRect(gap / 2 + 1, -lH / 2 + 1, lW, lH, 3 * sg); bc.fill();
      // Dark lenses
      bc.fillStyle = '#1a1a1a';
      bc.beginPath(); bc.roundRect(-lW - gap / 2, -lH / 2, lW, lH, 3 * sg); bc.fill();
      bc.beginPath(); bc.roundRect(gap / 2, -lH / 2, lW, lH, 3 * sg); bc.fill();
      // Bright glare highlights
      bc.fillStyle = 'rgba(255,255,255,0.4)';
      bc.beginPath(); bc.roundRect(-lW - gap / 2 + 2 * sg, -lH / 2 + 1.5 * sg, 4 * sg, 2.5 * sg, 1.5 * sg); bc.fill();
      bc.beginPath(); bc.roundRect(gap / 2 + 2 * sg, -lH / 2 + 1.5 * sg, 4 * sg, 2.5 * sg, 1.5 * sg); bc.fill();
      // Thick frame outline
      bc.strokeStyle = '#222';
      bc.lineWidth = 1.8 * sg;
      bc.beginPath(); bc.roundRect(-lW - gap / 2, -lH / 2, lW, lH, 3 * sg); bc.stroke();
      bc.beginPath(); bc.roundRect(gap / 2, -lH / 2, lW, lH, 3 * sg); bc.stroke();
      // Bridge
      bc.lineWidth = 2 * sg;
      bc.beginPath(); bc.moveTo(-gap / 2, 0); bc.lineTo(gap / 2, 0); bc.stroke();
      // Arms extending to sides of head
      bc.beginPath(); bc.moveTo(-lW - gap / 2, 0); bc.lineTo(-lW - gap / 2 - 7 * sg, -1 * sg); bc.stroke();
      bc.beginPath(); bc.moveTo(lW + gap / 2, 0); bc.lineTo(lW + gap / 2 + 7 * sg, -1 * sg); bc.stroke();
      bc.restore();
    }
    canStart(bb) { return bb.onGround && !bb.curNear && bb.tod === 'day'; }
    get cooldownMs() { return 30000; }
    get seq() { return 'sunbathe'; }
  }

  // ─── Ambient: Do Pushups ───

  class DoPushups extends State {
    constructor() { super('do_pushups', 'ambient'); this._count = 0; this._lastPush = 0; }
    enter(bb, cx) {
      super.enter(bb, cx);
      this._count = 0; this._lastPush = 0;
    }
    update(dt, bb, cx) {
      super.update(dt, bb, cx);
      const fS = cx.ren.fS;
      const bc = cx.ren.bc;
      const mid = cx.ren.W / 2;
      const baseY = cx.ren.H / 2;

      // Count pushups — push phase goes down = body lifts up
      const pushPhase = Math.sin(this.elapsed * Math.PI * 2);
      if (pushPhase < -0.9 && this.elapsed - this._lastPush > 0.4) {
        this._count++;
        this._lastPush = this.elapsed;
        // Ground dust puff under wings
        const dustX = bb.x + fS / 2;
        const dustY = bb.y + fS;
        cx.parts.spawn({ x: dustX - 12, y: dustY, vx: rand(-15, -5), vy: rand(-8, -2), maxLife: 0.35, size: rand(3, 5), color: 'rgba(180,160,120,0.4)', type: 'circle', gravity: 30 });
        cx.parts.spawn({ x: dustX + 12, y: dustY, vx: rand(5, 15), vy: rand(-8, -2), maxLife: 0.35, size: rand(3, 5), color: 'rgba(180,160,120,0.4)', type: 'circle', gravity: 30 });
      }

      // Draw ground shadow under the horizontal duck
      bc.save();
      bc.fillStyle = 'rgba(0,0,0,0.1)';
      bc.beginPath();
      bc.ellipse(mid, baseY + fS * 0.45, fS * 0.45, 3, 0, 0, Math.PI * 2);
      bc.fill();
      bc.restore();

      // Draw count above head (offset to the right since duck is horizontal)
      if (this._count > 0) {
        bc.save();
        bc.font = `bold ${12 * cx.opts.scale}px sans-serif`;
        bc.fillStyle = '#FF4444';
        bc.textAlign = 'center';
        bc.fillText(this._count.toString(), mid + (bb.facingR ? 18 : -18), baseY - 20);
        bc.textAlign = 'start';
        bc.restore();
      }

      // Sweat drops — more frequent since it's hard work
      if (this._count > 2 && Math.random() < dt * 5) {
        cx.parts.spawn({ x: bb.x + fS / 2 + rand(-8, 8), y: bb.y - 5, vx: rand(-15, 15), vy: rand(-25, -10), maxLife: 0.6, size: rand(2, 4), color: '#87CEEB', type: 'circle', gravity: 80 });
      }

      // Effort face emoji at counts 5 and 8
      if ((this._count === 5 || this._count === 8) && this.elapsed - this._lastPush < 0.15) {
        cx.parts.spawn({ x: bb.x + fS / 2, y: bb.y - 15, vx: 0, vy: -15, maxLife: 1.2, size: 12, color: '#FF6347', type: 'text', text: '💪', gravity: -5 });
      }

      advFrame(this, dt, cx.ad, 'do_pushups');
      if (this._count >= 8 || this.elapsed > 7) cx.sched.next(bb, cx);
    }
    canStart(bb) { return bb.onGround && !bb.curNear; }
    get cooldownMs() { return 25000; }
    get seq() { return 'do_pushups'; }
  }

  // ─── Medium Gags ───

  function medGagOK(bb, tm) { return !bb.inputFocused && (bb.elapsed - bb.lastMedGag) * 1000 > tm.mediumGagCooldownMs; }
  function bigGagOK(bb, tm) { return !bb.inputFocused && (bb.elapsed - bb.lastBigGag) * 1000 > tm.bigGagCooldownMs; }

  class BreadHeist extends State {
    constructor() { super('bread_heist', 'medium_gag'); this._ph = 0; }
    enter(bb, cx) { super.enter(bb, cx); this._ph = 0; bb.lastMedGag = bb.elapsed; bb.lastGagName = this.id; }
    update(dt, bb, cx) {
      super.update(dt, bb, cx); this._ph += dt;
      if (this._ph < 2) { bb.x += (bb.facingR?1:-1) * 20 * dt; advFrame(this,dt,cx.ad,'bread_heist'); }
      else if (this._ph < 2.5) { advFrame(this,dt,cx.ad,'bread_heist'); }
      else if (this._ph < 5) { bb.x += (bb.facingR?1:-1) * cx.tim.runSpeed * dt; advFrame(this,dt,cx.ad,'run_panic'); }
      else cx.sched.next(bb,cx);
      // draw bread crumb prop near duck
      if (this._ph > 1.8 && this._ph < 5) {
        const bc = cx.ren.bc, ox = cx.ren.W/2, oy = cx.ren.H/2 - 5;
        bc.fillStyle = '#D2691E'; bc.fillRect(ox + (bb.facingR?10:-18), oy, 8, 5);
      }
    }
    canStart(bb) { return medGagOK(bb, DEF_TIMING); }
    get cooldownMs() { return DEF_TIMING.mediumGagCooldownMs; }
    get seq() { return 'bread_heist'; }
  }

  class PaperPlaneChase extends State {
    constructor() { super('paper_plane_chase', 'medium_gag'); this._px = 0; this._py = 0; }
    enter(bb, cx) {
      super.enter(bb, cx); bb.lastMedGag = bb.elapsed; bb.lastGagName = this.id;
      this._px = 60; this._py = -30;
    }
    update(dt, bb, cx) {
      super.update(dt, bb, cx);
      this._px += 80 * dt; this._py += Math.sin(this.elapsed * 3) * 30 * dt;
      bb.x += cx.tim.runSpeed * 0.7 * dt * (bb.facingR?1:-1);
      advFrame(this,dt,cx.ad,'paper_plane_chase');
      // draw paper plane relative to duck center on buffer
      const bc = cx.ren.bc;
      const px = cx.ren.W/2 + this._px * (bb.facingR?1:-1), py = cx.ren.H/2 + this._py;
      bc.fillStyle = '#ECF0F1';
      bc.beginPath(); bc.moveTo(px,py); bc.lineTo(px+16,py+4); bc.lineTo(px,py+8); bc.closePath(); bc.fill();
      if (this.elapsed > 4) cx.sched.next(bb,cx);
    }
    canStart(bb) { return medGagOK(bb, DEF_TIMING); }
    get cooldownMs() { return DEF_TIMING.mediumGagCooldownMs; }
    get seq() { return 'paper_plane_chase'; }
  }

  class CameraShy extends State {
    constructor() { super('camera_shy', 'medium_gag'); this._flashed = false; }
    enter(bb, cx) { super.enter(bb, cx); bb.lastMedGag = bb.elapsed; bb.lastGagName = this.id; this._flashed = false; cx.audio.playQuack(); }
    update(dt, bb, cx) {
      super.update(dt, bb, cx); advFrame(this,dt,cx.ad,'camera_shy');
      if (this.elapsed > 0.4 && !this._flashed) {
        this._flashed = true;
        // flash overlay
        const bc = cx.ren.bc;
        bc.fillStyle = 'rgba(255,255,255,0.6)'; bc.fillRect(0, 0, cx.ren.W, cx.ren.H);
      }
      if (this.elapsed > 3) cx.sched.next(bb,cx);
    }
    canStart(bb) { return medGagOK(bb, DEF_TIMING); }
    get cooldownMs() { return DEF_TIMING.mediumGagCooldownMs; }
    get seq() { return 'camera_shy'; }
  }

  class FishbowlMoment extends State {
    constructor() { super('fishbowl_moment', 'medium_gag'); }
    enter(bb, cx) { super.enter(bb, cx); bb.lastMedGag = bb.elapsed; bb.lastGagName = this.id; }
    update(dt, bb, cx) {
      super.update(dt, bb, cx); advFrame(this,dt,cx.ad,'fishbowl_moment');
      // fishbowl circle on buffer
      const bc = cx.ren.bc, mid = cx.ren.W/2, fS = cx.ren.fS;
      bc.strokeStyle = 'rgba(0,206,209,0.5)'; bc.lineWidth = 2;
      bc.beginPath(); bc.arc(mid, cx.ren.H/2 - fS*0.1, fS*0.5, 0, Math.PI*2); bc.stroke();
      // bubbles
      if (Math.random() < dt * 3) {
        cx.parts.spawn({ x: bb.x + fS/2 + rand(-10,10), y: bb.y + rand(0,fS*0.4), vx: rand(-5,5), vy: rand(-25,-10), maxLife: 1.5, size: rand(2,4), color: '#00CED1', type: 'circle' });
      }
      if (this.elapsed > 5) cx.sched.next(bb,cx);
    }
    canStart(bb) { return medGagOK(bb, DEF_TIMING); }
    get cooldownMs() { return DEF_TIMING.mediumGagCooldownMs; }
    get seq() { return 'fishbowl_moment'; }
  }

  class UmbrellaPop extends State {
    constructor() { super('umbrella_pop', 'medium_gag'); this._open = false; }
    enter(bb, cx) { super.enter(bb, cx); this._open = false; bb.lastMedGag = bb.elapsed; bb.lastGagName = this.id; }
    update(dt, bb, cx) {
      super.update(dt, bb, cx); advFrame(this,dt,cx.ad,'umbrella_pop');
      if (this.elapsed > 1 && !this._open) { this._open = true; cx.audio.playQuack(); }
      if (this._open) {
        // draw umbrella arc
        const bc = cx.ren.bc, mid = cx.ren.W/2;
        bc.strokeStyle = '#FF1493'; bc.lineWidth = 2;
        bc.beginPath(); bc.arc(mid, cx.ren.H/2 - cx.ren.fS*0.3, cx.ren.fS*0.4, Math.PI, 0); bc.stroke();
        bc.beginPath(); bc.moveTo(mid, cx.ren.H/2 - cx.ren.fS*0.3); bc.lineTo(mid, cx.ren.H/2 + cx.ren.fS*0.1); bc.stroke();
        // rain
        if (Math.random() < dt * 8) {
          cx.parts.spawn({ x: bb.x + rand(-20, cx.ren.fS+20), y: bb.y - 30, vx: rand(-5,5), vy: rand(60,120), maxLife: 0.8, size: 2, color: '#70B8FF', type: 'drop', gravity: 100 });
        }
      }
      if (this.elapsed > 5) cx.sched.next(bb,cx);
    }
    canStart(bb) { return medGagOK(bb, DEF_TIMING); }
    get cooldownMs() { return DEF_TIMING.mediumGagCooldownMs; }
    get seq() { return 'umbrella_pop'; }
  }

  // ─── Medium Gag: Butterfly Chase ───

  class ButterflyChase extends State {
    constructor() { super('butterfly_chase', 'medium_gag'); this._bx = 0; this._by = 0; this._bvx = 0; this._bvy = 0; this._caught = false; }
    enter(bb, cx) {
      super.enter(bb, cx);
      bb.lastMedGag = bb.elapsed; bb.lastGagName = this.id;
      const fS = cx.ren.fS;
      // Butterfly starts near the duck and floats around
      this._bx = bb.x + (bb.facingR ? fS + 30 : -30);
      this._by = bb.y - 30;
      this._bvx = (bb.facingR ? 1 : -1) * rand(40, 80);
      this._bvy = rand(-30, -10);
      this._caught = false;
    }
    update(dt, bb, cx) {
      super.update(dt, bb, cx);
      const fS = cx.ren.fS;
      const bc = cx.ren.bc;

      if (!this._caught) {
        // Move butterfly in gentle floaty path
        this._bvy += Math.sin(this.elapsed * 3) * 200 * dt;
        this._bvx += Math.sin(this.elapsed * 1.7) * 100 * dt;
        // Keep butterfly vaguely on screen
        if (this._bx < 20) this._bvx = Math.abs(this._bvx) + 20;
        if (this._bx > bb.vpW - 20) this._bvx = -Math.abs(this._bvx) - 20;
        if (this._by < 20) this._bvy = Math.abs(this._bvy) + 10;
        if (this._by > bb.vpH - 60) this._bvy = -Math.abs(this._bvy) - 10;
        // Damping
        this._bvx *= 0.98; this._bvy *= 0.98;
        this._bx += this._bvx * dt;
        this._by += this._bvy * dt;

        // Duck chases butterfly
        const dir = this._bx > bb.x + fS / 2 ? 1 : -1;
        bb.facingR = dir > 0;
        bb.x += dir * cx.tim.runSpeed * cx.opts.speed * dt;
        bb.x = clamp(bb.x, 0, bb.vpW - fS);

        // Draw butterfly (world coords → buffer coords)
        const offX = -(bb.x - (cx.ren.W - fS) / 2);
        const offY = -(bb.y - (cx.ren.H - fS) / 2);
        const bsx = this._bx + offX;
        const bsy = this._by + offY;
        const wingFlap = Math.sin(this.elapsed * 14) * 0.6;
        bc.save();
        bc.translate(bsx, bsy);
        // Wings
        bc.fillStyle = '#FF69B4';
        bc.beginPath();
        bc.ellipse(-5, 0, 7, 5 * Math.abs(Math.cos(wingFlap)), wingFlap * 0.3, 0, Math.PI * 2);
        bc.fill();
        bc.fillStyle = '#DA70D6';
        bc.beginPath();
        bc.ellipse(5, 0, 7, 5 * Math.abs(Math.cos(wingFlap)), -wingFlap * 0.3, 0, Math.PI * 2);
        bc.fill();
        // Body
        bc.fillStyle = '#333';
        bc.beginPath(); bc.ellipse(0, 0, 2, 4, 0, 0, Math.PI * 2); bc.fill();
        bc.restore();

        // Check catch
        const dx = this._bx - (bb.x + fS / 2);
        const dy = this._by - (bb.y + fS / 2);
        if (Math.sqrt(dx * dx + dy * dy) < 25) {
          this._caught = true;
          cx.audio.playQuack();
          // Surprise stars
          for (let i = 0; i < 5; i++)
            cx.parts.spawn({ x: this._bx, y: this._by, vx: rand(-40, 40), vy: rand(-40, -10), maxLife: 0.6, size: rand(3, 6), color: pick(['#FF69B4', '#FFD700', '#DA70D6']), type: 'star', gravity: 60 });
        }
      }

      advFrame(this, dt, cx.ad, this._caught ? 'click_emote' : 'butterfly_chase');

      // Butterfly escapes after time, or end after catch celebration
      if (this.elapsed > 6 || (this._caught && this.elapsed > 4)) cx.sched.next(bb, cx);
    }
    canStart(bb) { return bb.onGround && medGagOK(bb, DEF_TIMING); }
    get cooldownMs() { return DEF_TIMING.mediumGagCooldownMs; }
    get seq() { return 'butterfly_chase'; }
  }

  // ─── Medium Gag: Banana Slip ───

  class BananaSlip extends State {
    constructor() { super('banana_slip', 'medium_gag'); this._phase = 'walk'; this._startX = 0; this._bananaX = 0; }
    enter(bb, cx) {
      super.enter(bb, cx);
      bb.lastMedGag = bb.elapsed; bb.lastGagName = this.id;
      this._phase = 'walk';
      this._startX = bb.x;
      // Place banana ahead
      this._bananaX = bb.x + (bb.facingR ? rand(60, 120) : -rand(60, 120));
      this._bananaX = clamp(this._bananaX, cx.ren.fS, bb.vpW - cx.ren.fS);
    }
    update(dt, bb, cx) {
      super.update(dt, bb, cx);
      const fS = cx.ren.fS;
      const bc = cx.ren.bc;
      const offX = -(bb.x - (cx.ren.W - fS) / 2);
      const offY = -(bb.y - (cx.ren.H - fS) / 2);
      const gy = bb.groundY(fS);

      // Draw banana peel on the ground
      if (this._phase === 'walk' || this._phase === 'slip') {
        bc.save();
        const bpx = this._bananaX + offX;
        const bpy = gy + fS + offY - 4;
        bc.translate(bpx, bpy);
        bc.fillStyle = '#FFD700';
        // Banana peel shape
        bc.beginPath();
        bc.moveTo(-6, 0); bc.quadraticCurveTo(-8, -5, -4, -3);
        bc.lineTo(0, -1);
        bc.lineTo(4, -3); bc.quadraticCurveTo(8, -5, 6, 0);
        bc.closePath();
        bc.fill();
        bc.fillStyle = '#B8860B';
        bc.beginPath(); bc.arc(0, -1, 1.5, 0, Math.PI * 2); bc.fill();
        bc.restore();
      }

      if (this._phase === 'walk') {
        // Walk toward banana
        const dir = this._bananaX > bb.x + fS / 2 ? 1 : -1;
        bb.facingR = dir > 0;
        bb.x += dir * cx.tim.walkSpeed * cx.opts.speed * dt;
        advFrame(this, dt, cx.ad, 'walk_right');
        // Reached banana?
        if (Math.abs(bb.x + fS / 2 - this._bananaX) < 10) {
          this._phase = 'slip';
        }
      } else if (this._phase === 'slip') {
        advFrame(this, dt, cx.ad, 'banana_slip');
        // Slide forward
        bb.x += (bb.facingR ? 1 : -1) * 80 * dt;
        if (this.elapsed > 1.5) {
          this._phase = 'fallen';
          cx.audio.playSplash();
          // Impact stars
          for (let i = 0; i < 6; i++)
            cx.parts.spawn({ x: bb.x + fS / 2, y: bb.y + fS, vx: rand(-50, 50), vy: rand(-40, -10), maxLife: 0.5, size: rand(3, 5), color: '#FFD700', type: 'star', gravity: 150 });
        }
      } else {
        // Fallen — dizzy on ground
        const starA = this.elapsed * 5;
        const mid = cx.ren.W / 2;
        for (let i = 0; i < 3; i++) {
          const a = starA + i * (Math.PI * 2 / 3);
          bc.fillStyle = '#FFD700';
          bc.font = `${7 * cx.opts.scale}px sans-serif`;
          bc.fillText('★', mid + Math.cos(a) * 12 - 3, cx.ren.H / 2 - 18 + Math.sin(a) * 5);
        }
        advFrame(this, dt, cx.ad, 'banana_slip');
        if (this.elapsed > 4) cx.sched.next(bb, cx);
      }
    }
    canStart(bb) { return bb.onGround && medGagOK(bb, DEF_TIMING); }
    get cooldownMs() { return DEF_TIMING.mediumGagCooldownMs; }
    get seq() { return 'banana_slip'; }
  }

  // ─── Big Gags ───

  class UfoAbductDrop extends State {
    constructor() { super('ufo_abduct_drop', 'big_gag'); this._ph = 0; this._by = 0; }
    enter(bb, cx) { super.enter(bb, cx); this._ph = 0; this._by = bb.y; bb.lastBigGag = bb.elapsed; bb.lastGagName = this.id; bb.onGround = false; }
    update(dt, bb, cx) {
      super.update(dt, bb, cx); this._ph += dt;
      const bc = cx.ren.bc, mid = cx.ren.W/2, fS = cx.ren.fS;
      if (this._ph < 2) {
        bb.y = lerp(this._by, this._by - 180, this._ph / 2);
        // beam
        bc.fillStyle = 'rgba(180,255,100,0.18)';
        bc.beginPath(); bc.moveTo(mid-8,0); bc.lineTo(mid-30,cx.ren.H); bc.lineTo(mid+30,cx.ren.H); bc.lineTo(mid+8,0); bc.fill();
        // UFO shape
        bc.fillStyle = '#888'; bc.beginPath(); bc.ellipse(mid, 12, 20, 8, 0, 0, Math.PI*2); bc.fill();
        bc.fillStyle = '#aaa'; bc.beginPath(); bc.arc(mid, 8, 10, Math.PI, 0); bc.fill();
      } else if (this._ph < 4) {
        bb.y = this._by - 180;
        bc.fillStyle = '#888'; bc.beginPath(); bc.ellipse(mid, 12, 20, 8, 0, 0, Math.PI*2); bc.fill();
      } else if (this._ph < 5.5) {
        const t = (this._ph - 4) / 1.5;
        bb.y = lerp(this._by - 180, this._by, t * t);
      } else {
        bb.y = this._by; bb.onGround = true;
        if (this._ph < 5.7) {
          for (let i = 0; i < 8; i++)
            cx.parts.spawn({ x: bb.x+fS/2, y: bb.y+fS, vx: rand(-60,60), vy: rand(-80,-30), maxLife: 0.8, size: 3, color: '#FFD700', type: 'star', gravity: 200 });
          cx.audio.playSplash();
        }
        if (this._ph > 7) cx.sched.next(bb,cx);
      }
      advFrame(this,dt,cx.ad,'ufo_abduct_drop');
    }
    canStart(bb) { return bigGagOK(bb, DEF_TIMING); }
    get cooldownMs() { return DEF_TIMING.bigGagCooldownMs; }
    get seq() { return 'ufo_abduct_drop'; }
  }

  class ShowerCloud extends State {
    constructor() { super('shower_cloud', 'big_gag'); }
    enter(bb, cx) { super.enter(bb, cx); bb.lastBigGag = bb.elapsed; bb.lastGagName = this.id; }
    update(dt, bb, cx) {
      super.update(dt, bb, cx); advFrame(this,dt,cx.ad,'shower_cloud');
      const bc = cx.ren.bc, mid = cx.ren.W/2;
      // cloud
      bc.fillStyle = '#B0C4DE';
      bc.beginPath(); bc.arc(mid,10,16,0,Math.PI*2); bc.arc(mid-12,15,10,0,Math.PI*2); bc.arc(mid+12,15,10,0,Math.PI*2); bc.fill();
      // rain
      if (Math.random() < dt * 12)
        cx.parts.spawn({ x: bb.x+cx.ren.fS/2+rand(-22,22), y: bb.y-15, vx:0, vy: rand(80,140), maxLife: 0.5, size: 2, color: '#70B8FF', type: 'drop', gravity: 80 });
      if (this.elapsed > 7) cx.sched.next(bb,cx);
    }
    canStart(bb) { return bigGagOK(bb, DEF_TIMING); }
    get cooldownMs() { return DEF_TIMING.bigGagCooldownMs; }
    get seq() { return 'shower_cloud'; }
  }

  class BathtubFlop extends State {
    constructor() { super('bathtub_flop', 'big_gag'); this._splashed = false; }
    enter(bb, cx) { super.enter(bb, cx); this._splashed = false; bb.lastBigGag = bb.elapsed; bb.lastGagName = this.id; }
    update(dt, bb, cx) {
      super.update(dt, bb, cx); advFrame(this,dt,cx.ad,'bathtub_flop');
      const bc = cx.ren.bc, mid = cx.ren.W/2, fS = cx.ren.fS;
      // tub
      bc.strokeStyle = '#1ABC9C'; bc.lineWidth = 2;
      bc.beginPath(); bc.ellipse(mid, cx.ren.H/2 + fS*0.25, fS*0.55, 12, 0, 0, Math.PI); bc.stroke();
      // water surface
      bc.fillStyle = 'rgba(26,188,156,0.15)';
      bc.fillRect(mid - fS*0.5, cx.ren.H/2 + fS*0.2, fS, 10);
      if (this.elapsed > 2 && !this._splashed) {
        this._splashed = true;
        for (let i = 0; i < 10; i++)
          cx.parts.spawn({ x: bb.x+fS/2, y: bb.y+fS*0.5, vx: rand(-70,70), vy: rand(-90,-30), maxLife: 0.7, size: 4, color: '#1ABC9C', type: 'drop', gravity: 300 });
        cx.audio.playSplash();
      }
      if (this.elapsed > 7) cx.sched.next(bb,cx);
    }
    canStart(bb) { return bigGagOK(bb, DEF_TIMING); }
    get cooldownMs() { return DEF_TIMING.bigGagCooldownMs; }
    get seq() { return 'bathtub_flop'; }
  }

  class StagePerformance extends State {
    constructor() { super('stage_performance', 'big_gag'); }
    enter(bb, cx) { super.enter(bb, cx); bb.lastBigGag = bb.elapsed; bb.lastGagName = this.id; }
    update(dt, bb, cx) {
      super.update(dt, bb, cx); advFrame(this,dt,cx.ad,'stage_performance');
      const bc = cx.ren.bc, mid = cx.ren.W/2;
      // spotlight
      const a = 0.12 + Math.sin(this.elapsed * 2) * 0.04;
      bc.fillStyle = `rgba(255,255,200,${a})`;
      bc.beginPath(); bc.moveTo(mid,0); bc.lineTo(mid-40,cx.ren.H); bc.lineTo(mid+40,cx.ren.H); bc.fill();
      // confetti
      if (Math.random() < dt * 5)
        cx.parts.spawn({ x: bb.x+rand(-30,cx.ren.fS+30), y: bb.y-rand(20,60), vx: rand(-30,30), vy: rand(10,40), maxLife: 2, size: rand(3,6), color: pick(['#FF6B6B','#FFCC00','#5CB85C','#3D9EFF','#FF69B4']), type: 'star', gravity: 30 });
      if (this.elapsed > 8) cx.sched.next(bb,cx);
    }
    canStart(bb) { return bigGagOK(bb, DEF_TIMING); }
    get cooldownMs() { return DEF_TIMING.bigGagCooldownMs; }
    get seq() { return 'stage_performance'; }
  }

  class CloneParade extends State {
    constructor() { super('clone_parade', 'big_gag'); this._cl = []; }
    enter(bb, cx) {
      super.enter(bb, cx);
      this._cl = []; for (let i = 0; i < 4; i++) this._cl.push({ off: -(i+1)*50, f: 0, t: 0 });
      bb.lastBigGag = bb.elapsed; bb.lastGagName = this.id; bb.facingR = true;
    }
    update(dt, bb, cx) {
      super.update(dt, bb, cx);
      const spd = cx.tim.walkSpeed * 1.2 * cx.opts.speed;
      bb.x += spd * dt; bb.facingR = true;
      advFrame(this,dt,cx.ad,'clone_parade');
      // draw trailing clones
      const seq = cx.ad.sequences['walk_right'];
      if (seq) {
        const bc = cx.ren.bc;
        for (const cl of this._cl) {
          cl.t += dt;
          const durS = seq.frameDurationMs / 1000;
          if (cl.t >= durS) { cl.t -= durS; cl.f = (cl.f + 1) % seq.frameCount; }
          bc.globalAlpha = 0.35;
          const ox = cx.ren.W/2 - cx.ren.fS/2 + cl.off;
          const oy = cx.ren.H/2 - cx.ren.fS/2;
          cx.ren.drawFrame('walk_right', cl.f, ox, oy, false);
          bc.globalAlpha = 1;
        }
      }
      if (this.elapsed > 7) cx.sched.next(bb,cx);
    }
    canStart(bb) { return bigGagOK(bb, DEF_TIMING); }
    get cooldownMs() { return DEF_TIMING.bigGagCooldownMs; }
    get seq() { return 'walk_right'; }
  }

  // ─── Interaction ───

  class CuriosityCone extends State {
    constructor() { super('curiosity_cone', 'interaction'); }
    enter(bb, cx) { super.enter(bb, cx); bb.facingR = bb.curX > bb.x; }
    update(dt, bb, cx) {
      super.update(dt, bb, cx); advFrame(this,dt,cx.ad,'curiosity_cone');
      const bc = cx.ren.bc, mid = cx.ren.W/2;
      bc.font = `bold ${14*cx.opts.scale}px sans-serif`; bc.fillStyle = '#FFD700'; bc.textAlign = 'center';
      bc.fillText('?', mid, 12 + Math.sin(this.elapsed*4)*3);
      if (this.elapsed > 3) cx.sched.next(bb,cx);
    }
    canStart(bb) { return bb.curNear && !bb.inputFocused; }
    get cooldownMs() { return 8000; }
    get seq() { return 'curiosity_cone'; }
  }

  class ShooResponse extends State {
    constructor() { super('shoo_response', 'interaction'); }
    enter(bb, cx) { super.enter(bb, cx); cx.audio.playQuack(); }
    update(dt, bb, cx) {
      super.update(dt, bb, cx);
      if (this.elapsed < 0.5) advFrame(this,dt,cx.ad,'shoo_response');
      else { bb.x += (bb.facingR?-1:1) * cx.tim.runSpeed * dt; advFrame(this,dt,cx.ad,'run_panic'); }
      if (this.elapsed > 3) cx.sched.next(bb,cx);
    }
    get cooldownMs() { return 5000; }
    get seq() { return 'shoo_response'; }
  }

  class PickUpDragDrop extends State {
    constructor() { super('pick_up_drag_drop', 'drag_drop'); }
    enter(bb, cx) { super.enter(bb, cx); bb.dragging = true; }
    update(dt, bb, cx) {
      super.update(dt, bb, cx);
      if (bb.dragging) {
        bb.x = lerp(bb.x, bb.curX - cx.ren.fS/2, 0.3);
        bb.y = lerp(bb.y, bb.curY - cx.ren.fS/2, 0.3);
        advFrame(this,dt,cx.ad,'dragged');
      }
    }
    exit(bb, cx) { bb.dragging = false; }
    get seq() { return 'dragged'; }
  }

  class LandRecover extends State {
    constructor() { super('land_recover', 'safety'); this._falling = true; this._gy = 0; this._rot = 0; }
    enter(bb, cx) { super.enter(bb, cx); this._falling = true; this._gy = bb.groundY(cx.ren.fS); bb.vy = 0; bb.onGround = false; this._rot = 0; }
    update(dt, bb, cx) {
      super.update(dt, bb, cx);
      if (this._falling) {
        bb.vy += GRAVITY * dt; bb.y += bb.vy * dt;
        // Wobble rotation while falling
        this._rot = Math.sin(this.elapsed * 12) * 0.2;
        // Draw flapping wings overlay
        const bc = cx.ren.bc, mid = cx.ren.W / 2, fS = cx.ren.fS;
        const wingFlap = Math.sin(this.elapsed * 16) * 0.7;
        bc.save();
        bc.translate(mid, cx.ren.H / 2);
        bc.rotate(this._rot);
        // Left wing (flapping up/down)
        bc.save();
        bc.translate(-12, -4);
        bc.rotate(-Math.abs(wingFlap) - 0.3);
        bc.fillStyle = 'rgba(255,200,0,0.5)';
        bc.beginPath();
        bc.ellipse(0, 0, 14, 6, 0, 0, Math.PI);
        bc.fill();
        bc.restore();
        // Right wing
        bc.save();
        bc.translate(12, -4);
        bc.rotate(Math.abs(wingFlap) + 0.3);
        bc.fillStyle = 'rgba(255,200,0,0.5)';
        bc.beginPath();
        bc.ellipse(0, 0, 14, 6, 0, 0, -Math.PI);
        bc.fill();
        bc.restore();
        bc.restore();
        // Air puff particles while falling
        if (Math.random() < dt * 8)
          cx.parts.spawn({ x: bb.x + fS/2 + rand(-15,15), y: bb.y + fS + 5, vx: rand(-20,20), vy: rand(-10,10), maxLife: 0.3, size: rand(2,4), color: 'rgba(255,255,255,0.5)', type: 'circle', gravity: -20 });

        if (bb.y >= this._gy) {
          bb.y = this._gy; bb.vy = 0; this._falling = false; bb.onGround = true;
          cx.audio.playSplash();
          // Big impact splash
          for (let i = 0; i < 10; i++)
            cx.parts.spawn({ x: bb.x+fS/2, y: bb.y+fS, vx: rand(-80,80), vy: rand(-60,-15), maxLife: 0.6, size: rand(2,5), color: '#FFD700', type: 'star', gravity: 250 });
          // Dust cloud
          for (let i = 0; i < 5; i++)
            cx.parts.spawn({ x: bb.x+fS/2+rand(-20,20), y: bb.y+fS, vx: rand(-40,40), vy: rand(-20,-5), maxLife: 0.4, size: rand(4,8), color: 'rgba(180,160,120,0.4)', type: 'circle', gravity: 30 });
        }
        advFrame(this,dt,cx.ad,'dragged');
      } else {
        // Draw dizzy stars above head after landing
        const bc = cx.ren.bc, mid = cx.ren.W / 2;
        if (this.elapsed < 2.5) {
          const starAngle = this.elapsed * 4;
          for (let i = 0; i < 3; i++) {
            const a = starAngle + i * (Math.PI * 2 / 3);
            const sx = mid + Math.cos(a) * 14;
            const sy = 8 + Math.sin(a) * 6;
            bc.fillStyle = '#FFD700';
            bc.font = `${8 * cx.opts.scale}px sans-serif`;
            bc.fillText('★', sx - 4, sy + 4);
          }
        }
        const r = advFrame(this,dt,cx.ad,'land_recover');
        if (this.elapsed > 2.5) cx.sched.next(bb,cx);
      }
    }
    get seq() { return 'land_recover'; }
  }

  class CollisionBounce extends State {
    constructor() { super('collision_bounce', 'safety'); }
    enter(bb, cx) {
      super.enter(bb, cx);
      bb.onGround = false;
      cx.audio.playQuack();
    }
    update(dt, bb, cx) {
      super.update(dt, bb, cx);
      const fS = cx.ren.fS;
      // Apply velocity with gravity
      bb.vy += GRAVITY * 0.6 * dt;
      bb.x += bb.vx * dt;
      bb.y += bb.vy * dt;
      // Friction on vx
      bb.vx *= (1 - 2 * dt);
      // Draw dizzy/surprise effect
      const bc = cx.ren.bc, mid = cx.ren.W / 2;
      // Impact stars around duck
      const starAngle = this.elapsed * 8;
      for (let i = 0; i < 4; i++) {
        const a = starAngle + i * (Math.PI / 2);
        const r = 18 + Math.sin(this.elapsed * 6 + i) * 5;
        const sx = mid + Math.cos(a) * r;
        const sy = cx.ren.H / 2 - 10 + Math.sin(a) * r * 0.5;
        bc.fillStyle = i % 2 === 0 ? '#FFD700' : '#FF6B6B';
        bc.font = `${(7 + Math.sin(this.elapsed * 10 + i) * 2) * cx.opts.scale}px sans-serif`;
        bc.fillText(i % 2 === 0 ? '★' : '✦', sx - 4, sy + 4);
      }
      // Exclamation
      if (this.elapsed < 0.5) {
        bc.font = `bold ${16 * cx.opts.scale}px sans-serif`;
        bc.fillStyle = '#FF3333';
        bc.textAlign = 'center';
        bc.fillText('!', mid, 8);
        bc.textAlign = 'start';
      }
      // Ground check
      const gy = bb.groundY(fS);
      if (bb.y >= gy) {
        bb.y = gy; bb.vy = 0; bb.vx = 0; bb.onGround = true;
      }
      // Clamp x
      bb.x = clamp(bb.x, 0, bb.vpW - fS);

      advFrame(this, dt, cx.ad, 'shoo_response');
      if (this.elapsed > 1.2 && bb.onGround) cx.sched.next(bb, cx);
      if (this.elapsed > 2.5) cx.sched.next(bb, cx); // failsafe
    }
    get seq() { return 'shoo_response'; }
  }

  class DuckFight extends State {
    constructor() { super('duck_fight', 'safety'); this._otherBB = null; this._cloudX = 0; this._cloudY = 0; }
    enter(bb, cx) {
      super.enter(bb, cx);
      bb.onGround = true;
      cx.audio.playQuack();
    }
    setOpponent(otherBB) { this._otherBB = otherBB; }
    update(dt, bb, cx) {
      super.update(dt, bb, cx);
      const fS = cx.ren.fS;
      const bc = cx.ren.bc;
      const mid = cx.ren.W / 2;
      const baseY = cx.ren.H / 2;

      // Keep ducks close together
      if (this._otherBB) {
        const midX = (bb.x + this._otherBB.x) / 2;
        bb.x = lerp(bb.x, midX - 5, dt * 3);
      }

      // Draw cartoon fight cloud
      const cloudScale = Math.min(this.elapsed * 3, 1); // grows in
      const shake = Math.sin(this.elapsed * 30) * 3;
      bc.save();
      bc.translate(mid + shake, baseY + 5);
      bc.scale(cloudScale, cloudScale);

      // Big puffy cloud shape
      bc.fillStyle = 'rgba(220,220,220,0.85)';
      bc.beginPath();
      bc.arc(0, 0, 22, 0, Math.PI * 2);
      bc.arc(-12, -8, 14, 0, Math.PI * 2);
      bc.arc(12, -6, 13, 0, Math.PI * 2);
      bc.arc(-8, 10, 12, 0, Math.PI * 2);
      bc.arc(10, 8, 14, 0, Math.PI * 2);
      bc.fill();

      // Action words and symbols rotating around
      const symbols = ['★', '💥', '!', '✦', '#', '☆', '!?'];
      bc.font = `bold ${9 * cx.opts.scale}px sans-serif`;
      for (let i = 0; i < 5; i++) {
        const a = this.elapsed * 6 + i * (Math.PI * 2 / 5);
        const r = 16 + Math.sin(this.elapsed * 8 + i) * 6;
        const sx = Math.cos(a) * r;
        const sy = Math.sin(a) * r * 0.6;
        bc.fillStyle = pick(['#FF3333', '#FFD700', '#FF6B6B', '#333']);
        bc.fillText(symbols[i % symbols.length], sx - 4, sy + 4);
      }

      // Limbs poking out of cloud
      const limbT = this.elapsed * 8;
      // Wing poking out left
      bc.fillStyle = cx.opts.duckColor || '#FFCC00';
      bc.save();
      bc.translate(-22, Math.sin(limbT) * 5);
      bc.rotate(Math.sin(limbT * 1.3) * 0.5);
      bc.beginPath(); bc.ellipse(0, 0, 8, 4, 0.3, 0, Math.PI); bc.fill();
      bc.restore();
      // Foot poking out right
      bc.fillStyle = '#FF8C00';
      bc.save();
      bc.translate(20, 10 + Math.sin(limbT + 1) * 4);
      bc.rotate(Math.sin(limbT * 0.9) * 0.4);
      bc.beginPath(); bc.ellipse(0, 0, 5, 3, 0, 0, Math.PI * 2); bc.fill();
      bc.restore();

      bc.restore();

      // Feather particles flying out
      if (Math.random() < dt * 8) {
        const col = pick(['#FFCC00', '#FFE44D', '#FFF', '#FF8C00']);
        cx.parts.spawn({ x: bb.x + fS / 2 + rand(-20, 20), y: bb.y + fS / 2 + rand(-15, 15), vx: rand(-60, 60), vy: rand(-60, -20), maxLife: 0.8, size: rand(3, 6), color: col, type: 'circle', gravity: 80 });
      }

      advFrame(this, dt, cx.ad, 'duck_fight');

      // Fight ends — both ducks bounce apart
      if (this.elapsed > 2.5) {
        bb.vx = (bb.facingR ? -1 : 1) * 100;
        bb.vy = -120;
        bb.onGround = false;
        cx.sched.force('collision_bounce', bb, cx);
      }
    }
    get seq() { return 'duck_fight'; }
  }

  class PeekABoo extends State {
    constructor() { super('peek_a_boo', 'interaction'); }
    enter(bb, cx) {
      super.enter(bb, cx);
      // start off-screen
      bb.x = bb.facingR ? bb.vpW + 10 : -cx.ren.fS - 10;
    }
    update(dt, bb, cx) {
      super.update(dt, bb, cx);
      const fS = cx.ren.fS;
      if (this.elapsed < 1) {
        const t = this.elapsed;
        bb.x = bb.facingR ? lerp(bb.vpW+10, bb.vpW-fS*0.6, t) : lerp(-fS-10, -fS*0.4, t);
      } else if (this.elapsed < 2.5) {
        advFrame(this,dt,cx.ad,'peek_a_boo');
      } else if (this.elapsed < 3.5) {
        const t = this.elapsed - 2.5;
        bb.x = bb.facingR ? lerp(bb.vpW-fS*0.6, bb.vpW+10, t) : lerp(-fS*0.4, -fS-10, t);
      } else cx.sched.next(bb,cx);
    }
    canStart(bb) { return !bb.inputFocused; }
    get cooldownMs() { return 15000; }
    get seq() { return 'peek_a_boo'; }
  }

  class ClickEmote extends State {
    constructor() { super('click_emote', 'interaction'); }
    enter(bb, cx) {
      super.enter(bb, cx); cx.audio.playQuack();
      for (let i = 0; i < 5; i++)
        cx.parts.spawn({ x: bb.x+cx.ren.fS/2, y: bb.y, vx: rand(-30,30), vy: rand(-60,-20), maxLife: 1, size: rand(4,7), color: pick(['#FF69B4','#FFD700','#FF6B6B']), type: 'star', gravity: 20 });
    }
    update(dt, bb, cx) {
      super.update(dt, bb, cx); advFrame(this,dt,cx.ad,'click_emote');
      if (this.elapsed > 1.5) cx.sched.next(bb,cx);
    }
    get cooldownMs() { return 1000; }
    get seq() { return 'click_emote'; }
  }

  // ─── Contextual ───

  class WalkOnSurface extends State {
    constructor() { super('walk_on_surface', 'ambient'); this._tx = 0; this._surf = null; this._done = false; this._arriving = true; this._startX = 0; this._startY = 0; this._targetX = 0; this._targetY = 0; this._arriveT = 0; this._flightDur = 1.0; }
    enter(bb, cx) {
      super.enter(bb, cx);
      this._done = false;
      this._arriving = false;
      if (bb.surfaces.length === 0) { this._done = true; return; }
      this._surf = pick(bb.surfaces);
      const fS = cx.ren.fS;
      this._targetY = this._surf.top - fS;
      this._targetX = clamp(bb.x, this._surf.left, this._surf.right - fS);
      this._startX = bb.x;
      this._startY = bb.y;
      this._arriveT = 0;
      this._arriving = true;
      const dist = Math.sqrt(Math.pow(this._targetX - this._startX, 2) + Math.pow(this._targetY - this._startY, 2));
      this._flightDur = clamp(dist / 250, 0.6, 1.8);
      bb.onGround = false;
      this._tx = rand(this._surf.left + fS * 0.5, this._surf.right - fS * 0.5);
      bb.facingR = this._tx > bb.x;
    }
    update(dt, bb, cx) {
      super.update(dt, bb, cx);
      if (this._done || !this._surf) { cx.sched.next(bb, cx); return; }
      // Flapping flight arrival phase
      if (this._arriving) {
        this._arriveT += dt;
        const t = clamp(this._arriveT / this._flightDur, 0, 1);
        const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        bb.x = lerp(this._startX, this._targetX, ease);
        bb.y = lerp(this._startY, this._targetY, ease);
        const arcHeight = Math.abs(this._targetY - this._startY) * 0.35 + 30;
        bb.y -= Math.sin(t * Math.PI) * arcHeight;
        _drawFlappingWings(cx.ren.bc, cx.ren, this._arriveT, this._duckColor || cx.opts.duckColor);
        if (Math.random() < dt * 10) {
          const fS = cx.ren.fS;
          cx.parts.spawn({ x: bb.x + fS/2 + rand(-8,8), y: bb.y + fS, vx: rand(-12,12), vy: rand(5,15), maxLife: 0.35, size: rand(2,3), color: 'rgba(255,255,255,0.4)', type: 'circle', gravity: -10 });
        }
        advFrame(this, dt, cx.ad, 'walk_right');
        if (t >= 1) this._arriving = false;
        return;
      }
      // Re-read the surface position (it may have moved via scroll)
      const r = this._surf.el.getBoundingClientRect();
      const fS = cx.ren.fS;
      bb.y = r.top - fS;
      // Walk toward target
      const spd = cx.tim.walkSpeed * cx.opts.speed * 0.8;
      const dir = this._tx > bb.x ? 1 : -1;
      bb.facingR = dir > 0;
      bb.x += dir * spd * dt;
      bb.x = clamp(bb.x, r.left, r.right - fS);
      if (Math.abs(bb.x - this._tx) < 4) this._done = true;
      advFrame(this, dt, cx.ad, 'walk_right');
      // If surface scrolled out of view, bail
      if (r.top < -fS || r.top > bb.vpH) { this._done = true; }
      if (this._done || this.elapsed > 6) { cx.sched.next(bb, cx); }
    }
    exit(bb, cx) { bb.onGround = false; }
    canStart(bb) { return bb.surfaces.length > 0 && !bb.inputFocused; }
    get cooldownMs() { return 8000; }
    get seq() { return 'walk_right'; }
  }

  class ClimbToSurface extends State {
    constructor() { super('climb_to_surface', 'ambient'); this._surf = null; this._startX = 0; this._startY = 0; this._targetX = 0; this._targetY = 0; this._ph = 0; this._flightDur = 1.5; }
    enter(bb, cx) {
      super.enter(bb, cx);
      this._ph = 0;
      if (bb.surfaces.length === 0) return;
      this._surf = pick(bb.surfaces);
      const fS = cx.ren.fS;
      this._startX = bb.x;
      this._startY = bb.y;
      this._targetY = this._surf.top - fS;
      this._targetX = clamp(this._surf.left + this._surf.width / 2 - fS / 2, this._surf.left, this._surf.right - fS);
      const dist = Math.sqrt(Math.pow(this._targetX - this._startX, 2) + Math.pow(this._targetY - this._startY, 2));
      this._flightDur = clamp(dist / 200, 0.8, 2.0);
      bb.facingR = this._targetX > bb.x;
      bb.onGround = false;
    }
    update(dt, bb, cx) {
      super.update(dt, bb, cx);
      if (!this._surf) { cx.sched.next(bb, cx); return; }
      this._ph += dt;
      const t = clamp(this._ph / this._flightDur, 0, 1);
      const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      bb.x = lerp(this._startX, this._targetX, ease);
      bb.y = lerp(this._startY, this._targetY, ease);
      const arcHeight = Math.abs(this._targetY - this._startY) * 0.3 + 30;
      bb.y -= Math.sin(t * Math.PI) * arcHeight;
      _drawFlappingWings(cx.ren.bc, cx.ren, this._ph, this._duckColor || cx.opts.duckColor);
      if (Math.random() < dt * 8) {
        const fS = cx.ren.fS;
        cx.parts.spawn({ x: bb.x + fS/2 + rand(-8,8), y: bb.y + fS, vx: rand(-10,10), vy: rand(5,15), maxLife: 0.3, size: rand(2,3), color: 'rgba(255,255,255,0.4)', type: 'circle', gravity: -10 });
      }
      advFrame(this, dt, cx.ad, 'walk_right');
      if (t >= 1) {
        bb.y = this._targetY;
        cx.sched.next(bb, cx);
      }
    }
    exit(bb, cx) { /* leave onGround false — next state will set it */ }
    canStart(bb) { return bb.surfaces.length > 0 && bb.onGround && !bb.inputFocused; }
    get cooldownMs() { return 12000; }
    get seq() { return 'walk_right'; }
  }

  class LadderClimb extends State {
    // Phases: 'walk' → walk to ladder base x, 'place' → ladder pops up, 'climb' → climb rung by rung, 'settle' → idle on top
    constructor() {
      super('ladder_climb', 'medium_gag');
      this._tgt = null; this._phase = 'walk';
      this._ladderX = 0; this._baseY = 0; this._topY = 0;
      this._ph = 0; this._climbDur = 0; this._placeDur = 0.6;
      this._rungSpacing = 14; this._ladderW = 18;
      this._ladderProgress = 0; // 0-1 how much ladder is placed
    }
    enter(bb, cx) {
      super.enter(bb, cx);
      this._ph = 0; this._phase = 'walk'; this._ladderProgress = 0;
      // Gather targets: surfaces, perches, AND interactive elements (buttons, links, etc.)
      const targets = [];
      const fS = cx.ren.fS;
      if (bb.surfaces.length) bb.surfaces.forEach(s => targets.push({ x: s.left + s.width / 2, y: s.top }));
      if (bb.perches.length) bb.perches.forEach(p => { const r = p.getBoundingClientRect(); targets.push({ x: r.left + r.width / 2, y: r.top }); });
      // Scan for buttons, links, and other interactive edges
      const interSel = 'button, a.btn, a.button, [role="button"], .btn, input[type="submit"], input[type="button"], .cta, .tag, .badge, .chip, .tab, [data-perch]';
      try {
        document.querySelectorAll(interSel).forEach(el => {
          const r = el.getBoundingClientRect();
          if (r.width > 30 && r.height > 10 && r.top > 20 && r.top < bb.vpH - 30)
            targets.push({ x: r.left + r.width / 2, y: r.top });
        });
      } catch {}
      // Filter to targets above the duck (at least 40px above)
      const above = targets.filter(t => t.y < bb.y - 40);
      if (above.length === 0) { this._tgt = null; return; }
      const tgt = pick(above);
      this._tgt = tgt;
      // Ladder base is at the duck's feet, directly below the target
      this._ladderX = tgt.x - fS / 2;
      this._baseY = bb.y + fS; // feet level
      this._topY = tgt.y;      // top edge of target
      const dist = Math.abs(this._baseY - this._topY);
      this._climbDur = clamp(dist / 70, 2.0, 5.0); // ~70px/s climb
      const rungCount = Math.max(3, Math.round(dist / 14));
      this._rungSpacing = dist / rungCount;
      bb.facingR = this._ladderX > bb.x;
    }
    update(dt, bb, cx) {
      super.update(dt, bb, cx);
      if (!this._tgt) { cx.sched.next(bb, cx); return; }
      const fS = cx.ren.fS;

      // ── Phase 1: Walk to ladder base position ──
      if (this._phase === 'walk') {
        const spd = cx.tim.walkSpeed * cx.opts.speed;
        const dir = this._ladderX > bb.x ? 1 : -1;
        bb.facingR = dir > 0;
        bb.x += dir * spd * dt;
        if (Math.abs(bb.x - this._ladderX) < 5) {
          bb.x = this._ladderX;
          this._phase = 'place'; this._ph = 0;
        }
        advFrame(this, dt, cx.ad, 'walk_right');
        return;
      }

      // ── Phase 2: Place ladder (it rises up from duck position) ──
      if (this._phase === 'place') {
        this._ph += dt;
        this._ladderProgress = clamp(this._ph / this._placeDur, 0, 1);
        // Duck watches the ladder go up — idle animation, looking up
        advFrame(this, dt, cx.ad, 'idle_preen');
        // Draw the ladder growing upward
        this._drawLadder(cx, bb, this._ladderProgress, 0);
        if (this._ladderProgress >= 1) {
          this._phase = 'climb'; this._ph = 0;
          bb.onGround = false;
        }
        return;
      }

      // ── Phase 3: Climb rung by rung ──
      if (this._phase === 'climb') {
        this._ph += dt;
        const t = clamp(this._ph / this._climbDur, 0, 1);
        // Duck moves up the ladder
        const climbY = lerp(this._baseY - fS, this._topY - fS, t);
        bb.y = climbY;
        // Slight side-to-side wobble
        bb.x = this._ladderX + Math.sin(t * Math.PI * 10) * 2.5;
        // Draw full ladder (duck is partway up)
        this._drawLadder(cx, bb, 1, t);
        // Alternate sprite for climbing motion
        const rungPhase = Math.floor(this._ph * 3.5) % 2;
        advFrame(this, dt, cx.ad, rungPhase ? 'walk_right' : 'idle_preen');
        // Sweat particles
        if (Math.random() < dt * 3) {
          cx.parts.spawn({ x: bb.x + fS/2 + rand(-10,10), y: bb.y + fS * 0.3, vx: rand(-20,20), vy: rand(-15,-5), maxLife: 0.5, size: rand(3,5), color: '#87CEEB', type: 'circle', gravity: 60 });
        }
        if (t >= 1) {
          bb.y = this._topY - fS;
          this._phase = 'settle'; this._ph = 0;
        }
        return;
      }

      // ── Phase 4: Settled on top ──
      advFrame(this, dt, cx.ad, 'perch_idle');
      this._ph += dt;
      if (this._ph > 2) cx.sched.next(bb, cx);
    }

    /** Draw the ladder from the base to the top. ladderProg=0..1 how much is visible, climbT=0..1 where duck is. */
    _drawLadder(cx, bb, ladderProg, climbT) {
      const bc = cx.ren.bc;
      const fS = cx.ren.fS;
      const mid = cx.ren.W / 2;
      const totalH = Math.abs(this._baseY - this._topY);
      // The ladder extends in world-space from baseY down to topY (upward).
      // In the buffer, the duck is centered. We need to draw the ladder
      // relative to the duck's current position.
      const duckWorldY = bb.y + fS / 2; // center of duck in world
      const bufCenterY = cx.ren.H / 2;  // center of buffer

      // World-to-buffer Y conversion: bufY = bufCenterY + (worldY - duckWorldY)
      const ladderTopBuf  = bufCenterY + (this._topY - duckWorldY);
      const ladderBaseBuf = bufCenterY + (this._baseY - duckWorldY);
      // How much ladder is visible (during place phase it grows from bottom)
      const visibleH = totalH * ladderProg;
      const visTopBuf = ladderBaseBuf - visibleH;

      const lW = this._ladderW * cx.opts.scale;
      const rungS = this._rungSpacing * cx.opts.scale;

      bc.save();
      bc.strokeStyle = '#8B5E3C';
      bc.lineWidth = 2.5 * cx.opts.scale;
      // Left rail
      bc.beginPath();
      bc.moveTo(mid - lW/2, visTopBuf);
      bc.lineTo(mid - lW/2, ladderBaseBuf);
      bc.stroke();
      // Right rail
      bc.beginPath();
      bc.moveTo(mid + lW/2, visTopBuf);
      bc.lineTo(mid + lW/2, ladderBaseBuf);
      bc.stroke();
      // Rungs
      bc.strokeStyle = '#A0724A';
      bc.lineWidth = 2 * cx.opts.scale;
      const rungCount = Math.round(totalH / this._rungSpacing);
      for (let i = 0; i <= rungCount; i++) {
        const ry = ladderBaseBuf - (i * rungS);
        if (ry < visTopBuf - 1) break; // above visible portion
        bc.beginPath();
        bc.moveTo(mid - lW/2, ry);
        bc.lineTo(mid + lW/2, ry);
        bc.stroke();
      }
      bc.restore();
    }

    exit(bb, cx) { bb.onGround = false; }
    canStart(bb) {
      if (bb.inputFocused || !bb.onGround) return false;
      // Need at least one target above the duck (40px minimum gap)
      for (const s of bb.surfaces) { if (s.top < bb.y - 40) return true; }
      for (const p of bb.perches) { if (p.getBoundingClientRect().top < bb.y - 40) return true; }
      // Also check buttons/interactive elements
      try {
        const btns = document.querySelectorAll('button, a.btn, a.button, [role="button"], .btn, .cta');
        for (const el of btns) { const r = el.getBoundingClientRect(); if (r.top > 20 && r.top < bb.y - 40 && r.width > 30) return true; }
      } catch {}
      return false;
    }
    get cooldownMs() { return 25000; }
    get seq() { return 'walk_right'; }
  }

  class ScrollAwareWave extends State {
    constructor() { super('scroll_aware_wave', 'ambient'); }
    update(dt, bb, cx) { super.update(dt, bb, cx); advFrame(this,dt,cx.ad,'scroll_wave'); if (this.elapsed > 2) cx.sched.next(bb,cx); }
    canStart(bb) { return bb.scrollProg > 0.15 && bb.scrollProg < 0.85; }
    get cooldownMs() { return 20000; }
    get seq() { return 'scroll_wave'; }
  }

  class SectionPerch extends State {
    constructor() { super('section_perch', 'ambient'); this._el = null; this._arriving = true; this._startX = 0; this._startY = 0; this._targetX = 0; this._targetY = 0; this._arriveT = 0; this._flightDur = 1.2; }
    enter(bb, cx) {
      super.enter(bb, cx);
      this._el = bb.perches.length ? pick(bb.perches) : null;
      this._arriving = false;
      if (this._el) {
        const r = this._el.getBoundingClientRect();
        this._targetX = r.left + r.width/2 - cx.ren.fS/2;
        this._targetY = r.top - cx.ren.fS;
        this._startX = bb.x;
        this._startY = bb.y;
        this._arriveT = 0;
        this._arriving = true;
        const dist = Math.sqrt(Math.pow(this._targetX - this._startX, 2) + Math.pow(this._targetY - this._startY, 2));
        this._flightDur = clamp(dist / 250, 0.8, 2.0);
        bb.curPerch = this._el; bb.onGround = false;
        bb.facingR = this._targetX > this._startX;
      }
    }
    update(dt, bb, cx) {
      super.update(dt, bb, cx);
      if (this._arriving) {
        this._arriveT += dt;
        const t = clamp(this._arriveT / this._flightDur, 0, 1);
        const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        bb.x = lerp(this._startX, this._targetX, ease);
        bb.y = lerp(this._startY, this._targetY, ease);
        const arcHeight = Math.abs(this._targetY - this._startY) * 0.4 + 40;
        bb.y -= Math.sin(t * Math.PI) * arcHeight;
        _drawFlappingWings(cx.ren.bc, cx.ren, this._arriveT, this._duckColor || cx.opts.duckColor);
        if (Math.random() < dt * 12) {
          const fS = cx.ren.fS;
          cx.parts.spawn({ x: bb.x + fS/2 + rand(-8,8), y: bb.y + fS, vx: rand(-15,15), vy: rand(5,20), maxLife: 0.4, size: rand(2,4), color: 'rgba(255,255,255,0.5)', type: 'circle', gravity: -10 });
        }
        advFrame(this, dt, cx.ad, 'walk_right');
        if (t >= 1) this._arriving = false;
        return;
      }
      if (this._el) { const r = this._el.getBoundingClientRect(); bb.x = r.left+r.width/2-cx.ren.fS/2; bb.y = r.top-cx.ren.fS; }
      advFrame(this,dt,cx.ad,'perch_idle');
      if ((this.elapsed - this._flightDur) * 1000 > cx.tim.perchDurationMs * 1.5) cx.sched.next(bb,cx);
    }
    exit(bb, cx) { bb.curPerch = null; bb.onGround = false; }
    canStart(bb) { return bb.perches.length > 0 && !bb.inputFocused; }
    get cooldownMs() { return 15000; }
    get seq() { return 'perch_idle'; }
  }

  // ═══════════════════════════════════════════════════════════════
  //  §11  Behavior Scheduler
  // ═══════════════════════════════════════════════════════════════

  class Scheduler {
    constructor(hsm, bus, opts) {
      this._hsm = hsm; this._bus = bus; this._opts = opts;
      this._cd = {};  // stateId → last-used elapsed
      this._last = null;
    }

    next(bb, cx) {
      if (bb.paused || bb.tabHidden) return;

      // If duck is elevated (not on ground), fall gracefully first
      const fS = cx.ren ? cx.ren.fS : FRAME_W;
      if (!bb.onGround && bb.y < bb.groundY(fS) - 2) {
        this._go('land_recover', bb, cx);
        return;
      }
      // Snap to ground if slightly off (sub-pixel drift)
      if (!bb.onGround) { bb.y = bb.groundY(fS); bb.onGround = true; }

      // Reduced-motion: only calm states
      if (bb.reducedMotion) {
        const ids = ['idle_preen','perch_and_peer','idle_nap'];
        const ok = ids.filter(id => { const s = this._hsm.states[id]; return s && s.canStart(bb) && this._offCD(id, bb); });
        this._go(ok.length ? pick(ok) : 'idle_preen', bb, cx);
        return;
      }

      // Gather candidates (exclude manual-only states)
      const skip = new Set(['pick_up_drag_drop','land_recover','collision_bounce','duck_fight']);
      const cands = [];
      for (const [id, st] of Object.entries(this._hsm.states)) {
        if (skip.has(id)) continue;
        if (!st.canStart(bb)) continue;
        if (!this._offCD(id, bb)) continue;
        cands.push(st);
      }
      if (!cands.length) { this._go('idle_preen', bb, cx); return; }

      const gw = this._opts.gagWeights || {};
      const chosen = weightedPick(cands, s => {
        let w = gw[s.id] != null ? gw[s.id] : 1;
        if (s.id === this._last) w *= 0.15; // recency penalty
        w *= (GROUP_WEIGHTS[s.group] || 1);
        if (bb.tod === 'night' && s.id === 'idle_nap') w *= 3;
        return Math.max(w, 0.01);
      });
      this._go(chosen.id, bb, cx);
    }

    _go(id, bb, cx) {
      this._cd[id] = bb.elapsed;
      this._last = id;
      this._hsm.go(id, bb, cx);
      const st = this._hsm.states[id];
      if (st && (st.group === 'medium_gag' || st.group === 'big_gag'))
        this._bus.emit('gagPlayed', { stateId: id, group: st.group });
    }

    _offCD(id, bb) {
      const last = this._cd[id]; if (last == null) return true;
      const st = this._hsm.states[id]; if (!st) return true;
      return (bb.elapsed - last) * 1000 >= st.cooldownMs;
    }

    force(id, bb, cx) { this._go(id, bb, cx); }
  }

  // ═══════════════════════════════════════════════════════════════
  //  §12  DOM Observer
  // ═══════════════════════════════════════════════════════════════

  class DOMObserver {
    constructor(extra) {
      this._sel = [
        'header','[role="banner"]','nav','.navbar','.nav',
        'footer','[role="contentinfo"]','.dock','[data-perch]',
        ...(extra || []),
      ];
      this._surfaceSel = [
        'header','nav','[role="banner"]','[data-perch]','.navbar',
        'section','article','.card','.panel','footer','[role="contentinfo"]',
        'h1','h2','h3','.hero','main > div','aside',
        ...(extra || []),
      ];
    }
    findPerches() {
      const out = [], seen = new Set();
      for (const sel of this._sel) {
        try {
          document.querySelectorAll(sel).forEach(el => {
            if (seen.has(el)) return; seen.add(el);
            const r = el.getBoundingClientRect();
            if (r.width > 50 && r.height > 8) out.push(el);
          });
        } catch {}
      }
      return out;
    }
    /**
     * Scan for walkable surfaces — DOM elements whose top edge is visible
     * in the viewport and wide enough to walk on.
     */
    findSurfaces(vpW, vpH) {
      const out = [], seen = new Set();
      for (const sel of this._surfaceSel) {
        try {
          document.querySelectorAll(sel).forEach(el => {
            if (seen.has(el)) return; seen.add(el);
            const r = el.getBoundingClientRect();
            // Top edge must be within viewport and element wide enough
            if (r.top > 30 && r.top < vpH - 20 && r.width > 80 && r.height > 20) {
              out.push({ el, top: r.top, left: r.left, right: r.right, width: r.width });
            }
          });
        } catch {}
      }
      // Sort by top position (highest first for priority)
      out.sort((a, b) => a.top - b.top);
      // Limit to top 12 surfaces to avoid performance issues
      return out.slice(0, 12);
    }
    isInputFocused() {
      const el = document.activeElement; if (!el) return false;
      const t = el.tagName;
      return t === 'INPUT' || t === 'TEXTAREA' || t === 'SELECT' || el.isContentEditable;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  //  §13  Controls UI
  // ═══════════════════════════════════════════════════════════════

  class ControlsUI {
    constructor(parent, bus) {
      this._bus = bus;
      this._el = document.createElement('div');
      this._el.className = 'duck-mate-controls';
      this._el.setAttribute('role', 'toolbar');
      this._el.setAttribute('aria-label', 'Duck Mate controls');

      // sr-only announcer
      this._ann = document.createElement('div');
      this._ann.setAttribute('aria-live', 'polite');
      this._ann.setAttribute('aria-atomic', 'true');
      this._ann.className = 'duck-mate-sr';
      this._el.appendChild(this._ann);

      this._pauseBtn = this._btn('⏸', 'Pause duck', () => bus.emit('togglePause'));
      this._muteBtn  = this._btn('🔊', 'Mute sounds', () => bus.emit('toggleMute'));
      this._removeBtn = this._btn('✕', 'Remove duck', () => bus.emit('remove'));
      this._removeBtn.classList.add('duck-mate-btn--rm');

      this._el.appendChild(this._pauseBtn);
      this._el.appendChild(this._muteBtn);
      this._el.appendChild(this._removeBtn);
      parent.appendChild(this._el);

      bus.on('paused', p => {
        this._pauseBtn.textContent = p ? '▶' : '⏸';
        this._pauseBtn.setAttribute('aria-label', p ? 'Resume duck' : 'Pause duck');
        this._pauseBtn.title = p ? 'Resume' : 'Pause';
        this._say(p ? 'Duck paused' : 'Duck resumed');
      });
      bus.on('muted', m => {
        this._muteBtn.textContent = m ? '🔇' : '🔊';
        this._muteBtn.setAttribute('aria-label', m ? 'Unmute sounds' : 'Mute sounds');
        this._muteBtn.title = m ? 'Unmute' : 'Mute';
        this._say(m ? 'Duck muted' : 'Duck unmuted');
      });
    }

    _btn(txt, label, fn) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'duck-mate-btn';
      b.textContent = txt; b.title = label;
      b.setAttribute('aria-label', label);
      b.addEventListener('click', fn);
      return b;
    }

    _say(msg) { this._ann.textContent = ''; requestAnimationFrame(() => { this._ann.textContent = msg; }); }

    destroy() { this._el.remove(); }
  }

  // ═══════════════════════════════════════════════════════════════
  //  §14  Debug Overlay
  // ═══════════════════════════════════════════════════════════════

  class DebugOverlay {
    constructor(parent) {
      this._el = document.createElement('div');
      this._el.className = 'duck-mate-debug';
      this._el.setAttribute('aria-hidden', 'true');
      parent.appendChild(this._el);
    }
    update(bb, sid) {
      this._el.textContent =
        `FPS: ${bb.fps.toFixed(0)} | State: ${sid||'—'} | ` +
        `Pos: ${bb.x.toFixed(0)},${bb.y.toFixed(0)} | ` +
        `Time: ${bb.tod} | Focus: ${bb.inputFocused} | RM: ${bb.reducedMotion} | ` +
        `Particles: ${0}`;
    }
    set particleCount(n) { this._partCount = n; }
    destroy() { this._el.remove(); }
  }

  // ═══════════════════════════════════════════════════════════════
  //  §15  DuckMate Core
  // ═══════════════════════════════════════════════════════════════

  class DuckMate {
    constructor(opts) {
      this._opts = { ...DEF_OPTS, ...opts };
      this._tim  = { ...DEF_TIMING };
      this._bus   = new EventBus();
      this._bb    = new Blackboard();
      this._dead  = false;
      this._paused = false;
      this._rafId = 0;
      this._lastT = 0;
      this._fpsN = 0; this._fpsA = 0;
      this._loaded = false;

      // Reduced motion detection
      this._mq = window.matchMedia('(prefers-reduced-motion: reduce)');
      if (this._opts.reducedMotion === 'auto') this._bb.reducedMotion = this._mq.matches;
      else this._bb.reducedMotion = this._opts.reducedMotion === 'on';
      this._onMQ = e => { if (this._opts.reducedMotion === 'auto') this._bb.reducedMotion = e.matches; };
      this._mq.addEventListener('change', this._onMQ);

      // Container (fixed fullscreen, pointer-events: none)
      this._container = document.createElement('div');
      this._container.className = 'duck-mate-container';
      document.body.appendChild(this._container);

      // Duck wrapper (receives pointer events)
      this._duckEl = document.createElement('div');
      this._duckEl.className = 'duck-mate-duck';
      this._duckEl.setAttribute('role', 'img');
      this._duckEl.setAttribute('aria-label', 'Animated duck mascot');
      this._duckEl.tabIndex = 0;
      this._container.appendChild(this._duckEl);

      // Renderer
      this._ren = new Renderer(this._duckEl, this._opts);

      // Audio
      this._audio = new AudioManager(this._opts.sounds || {});

      // Particles
      this._parts = new ParticlePool(MAX_PARTICLES);

      // Atlas
      this._ad = buildAtlasData();

      // DOM observer
      this._domObs = new DOMObserver(this._opts.perchSelectors);

      // HSM + Scheduler
      this._hsm = new HSM(this._bus);
      this._registerStates();
      this._sched = new Scheduler(this._hsm, this._bus, this._opts);

      // Context object for states
      this._cx = {
        ren: this._ren, audio: this._audio, parts: this._parts,
        ad: this._ad, tim: this._tim, opts: this._opts,
        hsm: this._hsm, sched: this._sched, bus: this._bus,
      };

      // Controls
      this._ctrlBox = document.createElement('div');
      this._ctrlBox.className = 'duck-mate-ctrl-box';
      const pos = this._opts.position || 'bottom-right';
      if (pos.includes('bottom')) this._ctrlBox.style.bottom = '16px'; else this._ctrlBox.style.top = '16px';
      if (pos.includes('right'))  this._ctrlBox.style.right  = '16px'; else this._ctrlBox.style.left = '16px';
      document.body.appendChild(this._ctrlBox);
      this._ctrlUI = new ControlsUI(this._ctrlBox, this._bus);

      // Debug
      this._dbg = null;
      if (this._opts.debug) this._dbg = new DebugOverlay(this._ctrlBox);

      // Events
      this._bindEvents();

      // Load atlas
      this._loadAtlas();

      // Start loop
      this._lastT = performance.now();
      this._loop(this._lastT);

      // Register in global instance list for collision detection
      this._instanceId = _instances.length;
      _instances.push(this);
    }

    _registerStates() {
      [
        new WalkEdgeFollow(), new PerchAndPeer(), new IdlePreen(), new IdleNap(), new PuddleHop(),
        new BreadHeist(), new PaperPlaneChase(), new CameraShy(), new FishbowlMoment(), new UmbrellaPop(),
        new ButterflyChase(), new BananaSlip(),
        new UfoAbductDrop(), new ShowerCloud(), new BathtubFlop(), new StagePerformance(), new CloneParade(),
        new CuriosityCone(), new ShooResponse(), new PickUpDragDrop(), new LandRecover(),
        new CollisionBounce(), new DuckFight(),
        new ReadNewspaper(), new EatSeeds(), new Sunbathe(), new DoPushups(),
        new PeekABoo(), new ClickEmote(), new ScrollAwareWave(), new SectionPerch(),
        new WalkOnSurface(), new ClimbToSurface(), new LadderClimb(),
      ].forEach(s => this._hsm.register(s));
      this._hsm.setDefault('idle_preen');
    }

    _loadAtlas() {
      // Pick a consistent color for this instance
      const duckColor = this._opts.duckColor || DUCK_COLORS[_instanceCount % DUCK_COLORS.length];
      this._duckColor = duckColor;
      const cv = generatePlaceholderAtlas(this._ad, duckColor);
      const img = new Image();
      img.onload = () => {
        this._ren.setAtlas(img, this._ad);
        this._loaded = true;
        this._bb.x = this._bb.vpW / 2;
        this._bb.y = this._bb.groundY(this._ren.fS);
        this._bb.onGround = true;
        this._sched.next(this._bb, this._cx);
      };
      img.src = cv.toDataURL();
    }

    _bindEvents() {
      const bb = this._bb;

      // Visibility
      this._hVis = () => { bb.tabHidden = document.hidden; if (!document.hidden) { this._lastT = performance.now(); this._loop(this._lastT); } };
      document.addEventListener('visibilitychange', this._hVis);

      // Resize
      this._hResize = () => { bb.vpW = window.innerWidth; bb.vpH = window.innerHeight; };
      window.addEventListener('resize', this._hResize);

      // Scroll — track velocity for levitation
      this._lastScrollY = window.scrollY;
      this._lastScrollT = performance.now();
      this._scrollTimer = null;
      this._hScroll = () => {
        const now = performance.now();
        const dy = window.scrollY - this._lastScrollY;
        const dtMs = Math.max(now - this._lastScrollT, 1);
        bb.scrollVel = (dy / dtMs) * 1000; // px/s
        bb.scrolling = true;
        this._lastScrollY = window.scrollY;
        this._lastScrollT = now;
        bb.scrollY = window.scrollY;
        const max = document.documentElement.scrollHeight - window.innerHeight;
        bb.scrollProg = max > 0 ? window.scrollY / max : 0;
        // Debounce scroll-stop detection
        clearTimeout(this._scrollTimer);
        this._scrollTimer = setTimeout(() => { bb.scrolling = false; bb.scrollVel = 0; }, 120);
      };
      window.addEventListener('scroll', this._hScroll, { passive: true });

      // Mouse
      this._hMouse = e => {
        bb.curX = e.clientX; bb.curY = e.clientY;
        const dx = e.clientX - bb.x - this._ren.fS/2;
        const dy = e.clientY - bb.y - this._ren.fS/2;
        bb.curNear = Math.sqrt(dx*dx + dy*dy) < 100;
      };
      window.addEventListener('mousemove', this._hMouse);

      // Focus
      this._hFocIn  = () => { bb.inputFocused = this._domObs.isInputFocused(); };
      this._hFocOut = () => { setTimeout(() => { bb.inputFocused = this._domObs.isInputFocused(); }, 0); };
      document.addEventListener('focusin', this._hFocIn);
      document.addEventListener('focusout', this._hFocOut);

      // Drag
      this._isDrag = false;
      this._dragOX = 0; this._dragOY = 0;
      this._dragMoved = false;

      this._hDown = e => {
        if (e.button !== 0) return;
        this._isDrag = true; this._dragMoved = false;
        this._dragOX = e.clientX - bb.x; this._dragOY = e.clientY - bb.y;
        this._duckEl.style.cursor = 'grabbing';
        this._duckEl.setPointerCapture(e.pointerId);
        this._hsm.go('pick_up_drag_drop', bb, this._cx);
        e.preventDefault();
      };
      this._duckEl.addEventListener('pointerdown', this._hDown);

      this._hMove = e => {
        if (!this._isDrag) return;
        bb.curX = e.clientX; bb.curY = e.clientY;
        this._dragMoved = true;
      };
      window.addEventListener('pointermove', this._hMove);

      this._hUp = e => {
        if (!this._isDrag) return;
        this._isDrag = false;
        this._duckEl.style.cursor = 'grab';
        bb.dragging = false;
        this._hsm.go('land_recover', bb, this._cx);
      };
      window.addEventListener('pointerup', this._hUp);

      // Click → emote (only if not dragged)
      this._hClick = e => {
        if (this._dragMoved) return;
        const sid = this._hsm.id;
        if (sid !== 'pick_up_drag_drop' && sid !== 'land_recover')
          this._hsm.go('click_emote', bb, this._cx);
      };
      this._duckEl.addEventListener('click', this._hClick);

      // Keyboard on duck
      this._hKey = e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this._hsm.go('click_emote', bb, this._cx); }
      };
      this._duckEl.addEventListener('keydown', this._hKey);

      // Double-click → shoo
      this._hDbl = () => this._hsm.go('shoo_response', bb, this._cx);
      this._duckEl.addEventListener('dblclick', this._hDbl);

      // Bus events
      this._bus.on('togglePause', () => this.togglePause());
      this._bus.on('toggleMute',  () => this.toggleMute());
      this._bus.on('remove',      () => this.remove());

      // Hooks
      if (this._opts.onStateChange) this._bus.on('stateChange', this._opts.onStateChange);
      if (this._opts.onGagPlayed)   this._bus.on('gagPlayed',   this._opts.onGagPlayed);

      // Periodic perch + surface scanning
      this._perchInt = setInterval(() => {
        bb.perches = this._domObs.findPerches();
        bb.surfaces = this._domObs.findSurfaces(bb.vpW, bb.vpH);
        bb.updateTOD();
        if (navigator.connection) bb.netSlow = navigator.connection.effectiveType === '2g' || !!navigator.connection.saveData;
      }, PERCH_SCAN_MS);
      bb.perches = this._domObs.findPerches();
      bb.surfaces = this._domObs.findSurfaces(bb.vpW, bb.vpH);
      bb.updateTOD();
    }

    // ─── Main Loop ───

    _loop(ts) {
      if (this._dead || this._bb.tabHidden) return;
      this._rafId = requestAnimationFrame(t => this._loop(t));

      const rawDt = (ts - this._lastT) / 1000;
      this._lastT = ts;
      const dt = Math.min(rawDt, 0.1);
      const bb = this._bb;

      // FPS
      this._fpsN++; this._fpsA += dt;
      if (this._fpsA >= 1) { bb.fps = this._fpsN / this._fpsA; this._fpsN = 0; this._fpsA = 0; }
      bb.elapsed += dt; bb.frames++;
      bb.inputFocused = this._domObs.isInputFocused();

      this._ren.clear();

      if (!this._loaded) {
        this._ren.drawEgg(bb.elapsed);
        this._ren.present();
        this._positionDuck();
        return;
      }

      if (!this._paused) {
        // ─── Scroll levitation ───
        this._applyScrollLevitation(dt);

        this._hsm.update(dt, bb, this._cx);
        this._parts.update(dt);
        this._checkCollisions(dt);
        this._clampPos();
      }

      // Draw current state sprite
      this._drawState();

      // Draw overlays on top of the duck sprite
      if (this._hsm.current && this._hsm.current.postDraw) {
        this._hsm.current.postDraw(bb, this._cx);
      }

      // Draw particles (transform to buffer-local coords)
      const bc = this._ren.bc;
      const offX = -(bb.x - (this._ren.W - this._ren.fS) / 2);
      const offY = -(bb.y - (this._ren.H - this._ren.fS) / 2);
      this._parts.draw(bc, offX, offY);

      this._ren.present();
      this._positionDuck();

      if (this._dbg) {
        this._dbg.update(bb, this._hsm.id);
      }
    }

    _drawState() {
      const st = this._hsm.current; if (!st) return;
      const fS = this._ren.fS;
      const ox = (this._ren.W - fS) / 2;
      const oy = (this._ren.H - fS) / 2;
      this._ren.drawFrame(st.seq, st.frame, ox, oy, !this._bb.facingR);
    }

    _positionDuck() {
      const fS = this._ren.fS;
      const x = this._bb.x - (this._ren.W - fS) / 2;
      const y = this._bb.y - (this._ren.H - fS) / 2;
      this._duckEl.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px)`;
      this._duckEl.style.width  = this._ren.W + 'px';
      this._duckEl.style.height = this._ren.H + 'px';
    }

    _clampPos() {
      const st = this._hsm.current;
      if (st && st.id === 'peek_a_boo') return; // allow off-screen
      const fS = this._ren.fS;
      this._bb.x = clamp(this._bb.x, 0, this._bb.vpW - fS);
      this._bb.y = clamp(this._bb.y, 0, this._bb.vpH - fS);
    }

    /**
     * Scroll levitation: while the user scrolls, ducks float up gently.
     * When scrolling stops, gravity kicks back in via the scheduler auto-fall.
     */
    _applyScrollLevitation(dt) {
      const bb = this._bb;
      const st = this._hsm.current;
      // Don't levitate during drag, safety states, or while already flying to a perch
      if (!st || bb.dragging) return;
      const skip = ['pick_up_drag_drop', 'collision_bounce', 'land_recover', 'perch_and_peer', 'section_perch', 'ladder_climb'];
      if (skip.includes(st.id)) return;
      // Also skip if the state is in its flying/arriving phase
      if (st._arriving) return;

      if (bb.scrolling && Math.abs(bb.scrollVel) > 30) {
        const fS = this._ren.fS;
        if (bb.scrollVel > 0) {
          // Scrolling DOWN → ducks levitate upward
          const lift = clamp(bb.scrollVel * 0.35, 20, 200);
          bb.y -= lift * dt;
          bb.onGround = false;
          // Floaty upward particles
          if (Math.random() < dt * 6) {
            this._parts.spawn({ x: bb.x + fS/2 + rand(-12,12), y: bb.y + fS + 4, vx: rand(-10,10), vy: rand(10,30), maxLife: 0.4, size: rand(2,4), color: 'rgba(200,220,255,0.6)', type: 'circle', gravity: 20 });
          }
        } else {
          // Scrolling UP → ducks get pushed downward
          const push = clamp(Math.abs(bb.scrollVel) * 0.3, 15, 160);
          const groundY = bb.groundY(fS);
          bb.y = Math.min(bb.y + push * dt, groundY);
          if (bb.y >= groundY) { bb.y = groundY; bb.onGround = true; }
          else { bb.onGround = false; }
          // Downward swoosh particles
          if (Math.random() < dt * 4) {
            this._parts.spawn({ x: bb.x + fS/2 + rand(-10,10), y: bb.y - 4, vx: rand(-8,8), vy: rand(-30,-10), maxLife: 0.3, size: rand(2,3), color: 'rgba(180,200,220,0.4)', type: 'circle', gravity: 40 });
          }
        }
      }
      // When scrolling stops and duck is in the air, the scheduler's auto-fall
      // (in Scheduler.next()) will route it through LandRecover automatically
      // when the current state ends. No additional logic needed.
    }

    /** Check collisions with other DuckMate instances. */
    _checkCollisions(dt) {
      if (_instances.length < 2) return;
      const bb = this._bb;
      const fS = this._ren.fS;
      const st = this._hsm.current;
      // Don't collide during drag, landing, or already bouncing
      if (!st || bb.dragging || st.id === 'collision_bounce' || st.id === 'land_recover' || st.id === 'pick_up_drag_drop' || st.id === 'duck_fight') return;

      const myCx = bb.x + fS / 2;
      const myCy = bb.y + fS / 2;
      const hitR = fS * 0.4; // collision radius

      for (const other of _instances) {
        if (other === this || other._dead || other._paused) continue;
        const ob = other._bb;
        const oSt = other._hsm.current;
        if (!oSt || ob.dragging || oSt.id === 'collision_bounce' || oSt.id === 'land_recover' || oSt.id === 'duck_fight') continue;

        const oCx = ob.x + other._ren.fS / 2;
        const oCy = ob.y + other._ren.fS / 2;
        const dx = myCx - oCx;
        const dy = myCy - oCy;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < hitR + other._ren.fS * 0.4) {
          // 30% chance of a full cartoon fight instead of just bouncing
          if (Math.random() < 0.3 && bb.onGround && ob.onGround) {
            // Duck fight!
            this._sched.force('duck_fight', bb, this._cx);
            other._sched.force('duck_fight', ob, other._cx);
            // Tell both fight states about their opponent
            const myFight = this._hsm.current;
            const otherFight = other._hsm.current;
            if (myFight && myFight.setOpponent) myFight.setOpponent(ob);
            if (otherFight && otherFight.setOpponent) otherFight.setOpponent(bb);
          } else {
            // Normal bounce
            const nx = dist > 0 ? dx / dist : (Math.random() > 0.5 ? 1 : -1);
            const ny = dist > 0 ? dy / dist : 0;
            const bounceSpeed = 120 + Math.random() * 80;

            bb.vx = nx * bounceSpeed;
            bb.vy = ny * bounceSpeed - 80;
            this._sched.force('collision_bounce', bb, this._cx);

            ob.vx = -nx * bounceSpeed;
            ob.vy = -ny * bounceSpeed - 80;
            other._sched.force('collision_bounce', ob, other._cx);
          }

          // Spawn collision particles at midpoint
          const px = (bb.x + ob.x) / 2 + fS / 2;
          const py = (bb.y + ob.y) / 2 + fS / 2;
          for (let i = 0; i < 8; i++) {
            const col = pick(['#FFD700', '#FF6B6B', '#fff', '#FFA500']);
            this._parts.spawn({ x: px, y: py, vx: rand(-90, 90), vy: rand(-90, 10), maxLife: 0.5, size: rand(3, 6), color: col, type: 'star', gravity: 150 });
          }

          break; // one collision per frame is enough
        }
      }
    }

    // ─── Public API ───

    pause()       { this._paused = true;  this._bus.emit('paused', true); }
    resume()      { this._paused = false; this._bus.emit('paused', false); }
    togglePause() { this._paused ? this.resume() : this.pause(); }
    toggleMute()  { const m = this._audio.toggleMute(); this._bus.emit('muted', m); }
    setSpeed(x)   { this._opts.speed = clamp(x, 0.1, 3); }
    setVolume(v)  { this._audio.setVolume(v); }
    setScale(s)   { this._opts.scale = clamp(s, 0.5, 4); this._ren.setScale(this._opts.scale); }
    setTheme(n)   { this._opts.theme = n; this._bus.emit('themeChange', n); }
    setMode(m)    { this._bb.reducedMotion = m === 'reduced'; }
    debugForce(id){ this._sched.force(id, this._bb, this._cx); }

    remove() {
      if (this._dead) return;
      this._dead = true;
      cancelAnimationFrame(this._rafId);
      clearInterval(this._perchInt);
      // Remove all listeners
      document.removeEventListener('visibilitychange', this._hVis);
      window.removeEventListener('resize', this._hResize);
      window.removeEventListener('scroll', this._hScroll);
      window.removeEventListener('mousemove', this._hMouse);
      document.removeEventListener('focusin', this._hFocIn);
      document.removeEventListener('focusout', this._hFocOut);
      this._duckEl.removeEventListener('pointerdown', this._hDown);
      window.removeEventListener('pointermove', this._hMove);
      window.removeEventListener('pointerup', this._hUp);
      this._duckEl.removeEventListener('click', this._hClick);
      this._duckEl.removeEventListener('keydown', this._hKey);
      this._duckEl.removeEventListener('dblclick', this._hDbl);
      this._mq.removeEventListener('change', this._onMQ);
      // Destroy sub-systems
      this._ren.destroy();
      this._audio.destroy();
      this._parts.clear();
      this._bus.clear();
      this._ctrlUI.destroy();
      if (this._dbg) this._dbg.destroy();
      this._ctrlBox.remove();
      // Remove from global instance registry
      const idx = _instances.indexOf(this);
      if (idx >= 0) _instances.splice(idx, 1);
      this._container.remove();
      _instanceCount--;
    }

    get isDestroyed() { return this._dead; }
  }

  // ═══════════════════════════════════════════════════════════════
  //  §16  DuckController & initDuckMate
  // ═══════════════════════════════════════════════════════════════

  class DuckController {
    constructor(m) { this._m = m; }
    pause()         { this._m.pause(); }
    resume()        { this._m.resume(); }
    remove()        { this._m.remove(); }
    setSpeed(x)     { this._m.setSpeed(x); }
    setVolume(v)    { this._m.setVolume(v); }
    setScale(s)     { this._m.setScale(s); }
    toggleMute()    { this._m.toggleMute(); }
    setTheme(n)     { this._m.setTheme(n); }
    setMode(m)      { this._m.setMode(m); }
    debugForce(id)  { this._m.debugForce(id); }
  }

  /**
   * Initialize a Duck Mate instance.
   * @param {object} [options]
   * @returns {DuckController|null}
   */
  function initDuckMate(options) {
    const opts = { ...DEF_OPTS, ...(options || {}) };

    if (_instanceCount > 0 && !opts.multiInstance) {
      // Politely wave and leave
      const tmp = document.createElement('div');
      tmp.style.cssText = 'position:fixed;bottom:60px;right:60px;z-index:999999;font-size:48px;pointer-events:none;animation:duck-mate-wave 1.5s ease-out forwards;';
      tmp.textContent = '🦆👋';
      document.body.appendChild(tmp);
      setTimeout(() => tmp.remove(), 1600);
      return null;
    }

    _instanceCount++;
    return new DuckController(new DuckMate(opts));
  }

  // ═══════════════════════════════════════════════════════════════
  //  §17  Export (UMD)
  // ═══════════════════════════════════════════════════════════════

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { initDuckMate, VERSION };
  } else {
    global.initDuckMate = initDuckMate;
    global.DuckMateVersion = VERSION;
  }

})(typeof window !== 'undefined' ? window : this);
