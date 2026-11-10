/**
 * Duck Kong 🦆 — a Donkey Kong-style mini game.
 * The tdc-duck-05 boss throws barrels from the top girder; the 8-bit duck
 * climbs the ladders to reach the bread. Opened from the duck's right-click menu.
 */

const LOGICAL_W = 224;
const LOGICAL_H = 256;
const STEP_MS = 1000 / 60;
const GRAVITY = 0.28;
const PLAYER_SPEED = 1;
const CLIMB_SPEED = 0.9;
const JUMP_VY = -3.3;
const PLAYER_HALF_W = 5;
const PLAYER_H = 14;
const PLAYER_DRAW = 16;
const BARREL = 8;
const LIVES = 3;
const WALL_L = 8;
const WALL_R = 216;
const TOP_Y = 56;
const BOSS = { x: 44, w: 26, h: 30 };
const THROW_FRAMES = 24;
const BREAD_X = 196;
const PLAYER_START = { x: 24, y: 232 };
const GIRDER_Y = [56, 100, 144, 188, 232];
const LADDERS = [
  { x: 40, top: 188, bottom: 232 },
  { x: 176, top: 144, bottom: 188 },
  { x: 56, top: 100, bottom: 144 },
  { x: 168, top: 56, bottom: 100 },
];
const STARS = Array.from({ length: 28 }, (_, i) => [(i * 67) % LOGICAL_W, (i * 41) % 200]);

const KEY_MAP = {
  ArrowLeft: 'left', a: 'left', A: 'left',
  ArrowRight: 'right', d: 'right', D: 'right',
  ArrowUp: 'up', w: 'up', W: 'up',
  ArrowDown: 'down', s: 'down', S: 'down',
  ' ': 'jump', z: 'jump', Z: 'jump',
};

const spawnInterval = (level) => Math.max(60, 150 - (level - 1) * 15);
const barrelSpeed = (level) => 0.7 + (level - 1) * 0.1;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

function createSfx() {
  let ctx = null;
  let on = true;
  const ensure = () => {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  };
  const blip = (freq, to, dur, { type = 'square', vol = 0.05, delay = 0 } = {}) => {
    if (!on) return;
    const c = ensure();
    if (!c) return;
    const t = c.currentTime + delay;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (to) osc.frequency.exponentialRampToValueAtTime(to, t + dur);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(c.destination);
    osc.start(t);
    osc.stop(t + dur);
  };
  return {
    unlock: ensure,
    jump: () => blip(330, 660, 0.12),
    throw: () => blip(180, 140, 0.1),
    score: () => blip(880, 1320, 0.08),
    hit: () => blip(260, 60, 0.45, { type: 'sawtooth', vol: 0.08 }),
    win: () => [523, 659, 784, 1046].forEach((f, i) => blip(f, 0, 0.14, { delay: i * 0.11 })),
    toggle() { on = !on; return on; },
    get on() { return on; },
  };
}
const sfx = createSfx();

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function newPlayer() {
  return { x: PLAYER_START.x, y: PLAYER_START.y, vy: 0, grounded: true, onLadder: false, ladder: null, facing: 1, stride: 0 };
}

/** Nearest girder directly below prevY that the feet crossed while falling. */
function landingY(prevY, newY) {
  for (const gy of GIRDER_Y) {
    if (prevY < gy && gy <= newY) return gy;
  }
  return null;
}

function hitsPlayer(p, b) {
  return Math.abs(p.x - b.x) < PLAYER_HALF_W + BARREL / 2 - 1
    && p.y > b.y - BARREL
    && p.y - PLAYER_H < b.y;
}

export function openDuckKong({ duckSrc, bossSrc } = {}) {
  if (document.querySelector('.duck-kong')) return;
  const returnFocus = document.activeElement;

  const root = document.createElement('div');
  root.className = 'duck-kong';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-label', 'Duck Kong');
  root.innerHTML = `
    <div class="duck-kong__panel">
      <header class="duck-kong__hud">
        <span data-hud="score">SCORE 000000</span>
        <span data-hud="lives"></span>
        <span data-hud="level">LVL 1</span>
        <span class="duck-kong__spacer"></span>
        <button type="button" data-action="sound" aria-label="Sound on/off">🔊</button>
        <button type="button" data-action="close" aria-label="Close">✕</button>
      </header>
      <div class="duck-kong__stage">
        <canvas width="${LOGICAL_W}" height="${LOGICAL_H}"></canvas>
        <div class="duck-kong__msg" hidden>
          <h2 data-msg="title"></h2>
          <p data-msg="text"></p>
          <button type="button" data-action="primary"></button>
        </div>
      </div>
      <div class="duck-kong__controls">
        <button type="button" data-key="left" aria-label="Left">◀</button>
        <button type="button" data-key="up" aria-label="Climb up">▲</button>
        <button type="button" data-key="down" aria-label="Climb down">▼</button>
        <button type="button" data-key="right" aria-label="Right">▶</button>
        <button type="button" data-key="jump">JUMP</button>
      </div>
    </div>`;
  document.body.appendChild(root);

  const canvas = root.querySelector('canvas');
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const el = {
    score: root.querySelector('[data-hud="score"]'),
    lives: root.querySelector('[data-hud="lives"]'),
    level: root.querySelector('[data-hud="level"]'),
    sound: root.querySelector('[data-action="sound"]'),
    msg: root.querySelector('.duck-kong__msg'),
    title: root.querySelector('[data-msg="title"]'),
    text: root.querySelector('[data-msg="text"]'),
    primary: root.querySelector('[data-action="primary"]'),
  };

  const state = {
    mode: 'loading', // loading | start | playing | dying | cleared | over
    score: 0,
    lives: LIVES,
    level: 1,
    frame: 0,
    timer: 0,
    player: newPlayer(),
    barrels: [],
    spawnTimer: 0,
    bossSay: 0,
    bossThrow: 0,
  };
  const keys = { left: false, right: false, up: false, down: false, jumpQueued: false };
  let sprites = null;
  let rafId = 0;
  let last = 0;
  let acc = 0;

  const showMsg = (title, text, label, onClick) => {
    el.title.textContent = title;
    el.text.textContent = text;
    el.primary.hidden = !label;
    el.primary.textContent = label || '';
    el.primary.onclick = () => onClick?.();
    el.msg.hidden = false;
    if (label) el.primary.focus();
  };
  const hideMsg = () => { el.msg.hidden = true; };

  const resetLevel = () => {
    state.player = newPlayer();
    state.barrels = [];
    state.spawnTimer = spawnInterval(state.level);
    state.bossSay = 0;
    state.bossThrow = 0;
  };

  const releaseAll = () => {
    keys.left = keys.right = keys.up = keys.down = false;
    keys.jumpQueued = false;
  };

  const startGame = () => {
    sfx.unlock();
    state.score = 0;
    state.lives = LIVES;
    state.level = 1;
    resetLevel();
    releaseAll();
    state.mode = 'playing';
    hideMsg();
  };

  const press = (key) => {
    if ((state.mode === 'start' || state.mode === 'over') && key === 'jump') {
      startGame();
      return;
    }
    if (key === 'jump') keys.jumpQueued = true;
    else keys[key] = true;
  };
  const release = (key) => {
    if (key !== 'jump') keys[key] = false;
  };

  const startClimb = (p, ladder) => {
    p.onLadder = true;
    p.ladder = ladder;
    p.x = ladder.x;
    p.vy = 0;
    p.grounded = false;
  };

  const stepPlayer = (p) => {
    const jump = keys.jumpQueued;
    keys.jumpQueued = false;

    if (p.onLadder) {
      if (jump) {
        p.onLadder = false;
        p.ladder = null;
        p.grounded = false;
        p.vy = JUMP_VY * 0.8;
        return;
      }
      if (keys.up) p.y -= CLIMB_SPEED;
      else if (keys.down) p.y += CLIMB_SPEED;
      if (p.y <= p.ladder.top) {
        p.y = p.ladder.top;
        p.onLadder = false;
        p.ladder = null;
        p.grounded = true;
      } else if (p.y >= p.ladder.bottom) {
        p.y = p.ladder.bottom;
        p.onLadder = false;
        p.ladder = null;
        p.grounded = true;
      }
      return;
    }

    const moving = keys.left !== keys.right;
    if (keys.left) { p.x -= PLAYER_SPEED; p.facing = -1; }
    if (keys.right) { p.x += PLAYER_SPEED; p.facing = 1; }
    p.x = clamp(p.x, WALL_L + PLAYER_HALF_W, WALL_R - PLAYER_HALF_W);
    p.stride = moving && p.grounded ? p.stride + 0.35 : 0;

    if (p.grounded) {
      const up = LADDERS.find((l) => Math.abs(p.x - l.x) <= 4 && l.bottom === p.y);
      const down = LADDERS.find((l) => Math.abs(p.x - l.x) <= 4 && l.top === p.y);
      if (keys.up && up) { startClimb(p, up); return; }
      if (keys.down && down) { startClimb(p, down); return; }
      if (jump) {
        p.vy = JUMP_VY;
        p.grounded = false;
        sfx.jump();
      }
      return;
    }

    p.vy += GRAVITY;
    const prevY = p.y;
    p.y += p.vy;
    if (p.vy >= 0) {
      const ly = landingY(prevY, p.y);
      if (ly !== null) {
        p.y = ly;
        p.vy = 0;
        p.grounded = true;
      }
    }
  };

  const throwBarrel = () => {
    state.barrels.push({ x: BOSS.x + 8, y: TOP_Y, vy: 0, dir: 1, falling: false, scored: false, dead: false });
    state.bossSay = 40;
    state.bossThrow = THROW_FRAMES;
    sfx.throw();
  };

  const stepBarrel = (b, speed) => {
    if (b.falling) {
      b.vy += GRAVITY * 0.9;
      const prevY = b.y;
      b.y += b.vy;
      const ly = landingY(prevY, b.y);
      if (ly !== null) {
        b.y = ly;
        b.vy = 0;
        b.falling = false;
        b.dir = b.x > 112 ? -1 : 1;
      } else if (b.y > LOGICAL_H) {
        b.dead = true;
      }
      return;
    }
    b.x += b.dir * speed;
    if (b.x <= WALL_L || b.x >= WALL_R) {
      b.x = clamp(b.x, WALL_L, WALL_R);
      b.falling = true;
      b.vy = 0.5;
    }
  };

  const loseLife = () => {
    sfx.hit();
    state.lives--;
    releaseAll();
    state.mode = 'dying';
    state.timer = 90;
  };

  const afterDeath = () => {
    if (state.lives <= 0) {
      state.mode = 'over';
      showMsg('GAME OVER', `Score ${state.score}`, 'Play again', startGame);
      return;
    }
    resetLevel();
    state.mode = 'playing';
  };

  const winLevel = () => {
    state.mode = 'cleared';
    state.timer = 150;
    state.score += 1000;
    sfx.win();
    showMsg('LEVEL CLEAR!', `Bonus +1000 · next: level ${state.level + 1}`, null);
  };

  const nextLevel = () => {
    state.level++;
    resetLevel();
    state.mode = 'playing';
    hideMsg();
  };

  const update = () => {
    state.frame++;
    if (state.bossSay > 0) state.bossSay--;
    if (state.bossThrow > 0) state.bossThrow--;

    if (state.mode === 'dying') {
      state.timer--;
      if (state.timer <= 0) afterDeath();
      return;
    }
    if (state.mode === 'cleared') {
      state.timer--;
      if (state.timer <= 0) nextLevel();
      return;
    }
    if (state.mode !== 'playing') return;

    const p = state.player;
    stepPlayer(p);

    state.spawnTimer--;
    if (state.spawnTimer <= 0) {
      throwBarrel();
      state.spawnTimer = spawnInterval(state.level);
    }
    const speed = barrelSpeed(state.level);
    for (const b of state.barrels) stepBarrel(b, speed);
    state.barrels = state.barrels.filter((b) => !b.dead);

    if (state.barrels.some((b) => hitsPlayer(p, b))) {
      loseLife();
      return;
    }
    for (const b of state.barrels) {
      if (!b.scored && !p.grounded && !p.onLadder && Math.abs(p.x - b.x) < 9 && p.y <= b.y - BARREL) {
        b.scored = true;
        state.score += 100;
        sfx.score();
      }
    }
    if (p.grounded && Math.abs(p.x - BREAD_X) < 10 && p.y === TOP_Y) winLevel();
  };

  const render = () => {
    ctx.fillStyle = '#0b1026';
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
    ctx.fillStyle = '#26315e';
    for (const [sx, sy] of STARS) ctx.fillRect(sx, sy, 1, 1);

    for (const gy of GIRDER_Y) {
      ctx.fillStyle = '#d9482b';
      ctx.fillRect(WALL_L, gy - 4, WALL_R - WALL_L, 4);
      ctx.fillStyle = '#ffb347';
      ctx.fillRect(WALL_L, gy - 4, WALL_R - WALL_L, 1);
      ctx.fillStyle = '#7a1f12';
      for (let x = WALL_L + 6; x < WALL_R; x += 16) ctx.fillRect(x, gy - 2, 2, 2);
    }

    ctx.fillStyle = '#7fe8ff';
    for (const l of LADDERS) {
      const h = l.bottom - l.top;
      ctx.fillRect(l.x - 4, l.top, 1, h);
      ctx.fillRect(l.x + 3, l.top, 1, h);
      for (let y = l.top + 3; y < l.bottom; y += 4) ctx.fillRect(l.x - 4, y, 8, 1);
    }

    ctx.fillStyle = '#c98a3a';
    ctx.fillRect(BREAD_X - 7, TOP_Y - 6, 14, 6);
    ctx.fillStyle = '#ffd27a';
    ctx.fillRect(BREAD_X - 5, TOP_Y - 8, 10, 2);
    ctx.fillStyle = '#fff1c1';
    ctx.fillRect(BREAD_X - 4, TOP_Y - 7, 3, 1);

    if (sprites) {
      const bob = Math.sin(state.frame * 0.12);
      ctx.save();
      ctx.translate(BOSS.x, TOP_Y);
      if (state.bossThrow > 0) {
        // Wind up (lean back, squash), then swing forward to release, then settle.
        const t = 1 - state.bossThrow / THROW_FRAMES;
        let angle;
        if (t < 0.4) angle = -0.35 * (t / 0.4);
        else if (t < 0.7) angle = -0.35 + 0.5 * ((t - 0.4) / 0.3);
        else angle = 0.15 * (1 - (t - 0.7) / 0.3);
        const squash = t < 0.4 ? 1 - 0.08 * (t / 0.4) : 1;
        ctx.rotate(angle);
        ctx.scale(1 / squash, squash);
      }
      ctx.drawImage(sprites.boss, -BOSS.w / 2, -BOSS.h + bob, BOSS.w, BOSS.h);
      ctx.restore();
      if (state.bossSay > 0) {
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 7px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('KVAKK!', BOSS.x, TOP_Y - BOSS.h - 4);
      }
    }

    for (const b of state.barrels) {
      ctx.fillStyle = '#b5652b';
      ctx.fillRect(b.x - 4, b.y - BARREL, BARREL, BARREL);
      ctx.fillStyle = '#5a3211';
      ctx.fillRect(b.x - 4, b.y - 6, BARREL, 1);
      ctx.fillRect(b.x - 4, b.y - 3, BARREL, 1);
      ctx.fillStyle = '#ffb347';
      ctx.fillRect(b.x - 3 + ((state.frame >> 2) % 3), b.y - BARREL, 1, BARREL);
    }

    const p = state.player;
    const blink = state.mode === 'dying' && Math.floor(state.timer / 6) % 2 === 0;
    if (sprites && !blink) {
      ctx.save();
      ctx.translate(Math.round(p.x), Math.round(p.y));
      ctx.scale(p.facing, 1);
      // Walk: bigger hop and waddle while on a girder. Jump: stretch on the way
      // up, squash on the way down, and lean into the jump.
      const airborne = !p.grounded && !p.onLadder;
      const walking = p.stride && p.grounded && !p.onLadder;
      let hop = 0, tilt = 0, sx = 1, sy = 1;
      if (walking) {
        hop = Math.abs(Math.sin(p.stride)) * 3;
        tilt = Math.sin(p.stride) * 0.2;
      } else if (airborne) {
        const rising = p.vy < 0;
        sy = rising ? 1.15 : 0.9;
        sx = rising ? 0.9 : 1.1;
        tilt = rising ? -0.25 : 0.15;
      }
      ctx.translate(0, -Math.round(hop));
      ctx.rotate(tilt);
      ctx.scale(sx, sy);
      ctx.drawImage(sprites.duck, -PLAYER_DRAW / 2, -PLAYER_DRAW, PLAYER_DRAW, PLAYER_DRAW);
      ctx.restore();
    }

    el.score.textContent = `SCORE ${String(state.score).padStart(6, '0')}`;
    el.lives.textContent = '🦆'.repeat(Math.max(0, state.lives));
    el.level.textContent = `LVL ${state.level}`;
  };

  const loop = (ts) => {
    if (!last) last = ts;
    acc += Math.min(ts - last, 100);
    last = ts;
    while (acc >= STEP_MS) {
      update();
      acc -= STEP_MS;
    }
    render();
    rafId = requestAnimationFrame(loop);
  };

  const close = () => {
    cancelAnimationFrame(rafId);
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('blur', releaseAll);
    root.remove();
    returnFocus?.focus?.();
  };

  const onKeyDown = (e) => {
    if (e.key === 'Escape') { close(); return; }
    if (e.key === 'm' || e.key === 'M') { el.sound.textContent = sfx.toggle() ? '🔊' : '🔇'; return; }
    const action = KEY_MAP[e.key];
    if (!action) return;
    e.preventDefault();
    if (!e.repeat) press(action);
  };
  const onKeyUp = (e) => {
    const action = KEY_MAP[e.key];
    if (!action) return;
    e.preventDefault();
    release(action);
  };

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', releaseAll);

  root.querySelector('[data-action="close"]').addEventListener('click', close);
  el.sound.addEventListener('click', () => { el.sound.textContent = sfx.toggle() ? '🔊' : '🔇'; });
  el.sound.textContent = sfx.on ? '🔊' : '🔇';
  root.querySelectorAll('[data-key]').forEach((btn) => {
    const key = btn.dataset.key;
    btn.addEventListener('pointerdown', (e) => { e.preventDefault(); press(key); });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach((type) => {
      btn.addEventListener(type, () => release(key));
    });
  });

  showMsg('Loading…', '', null);
  Promise.all([loadImage(duckSrc), loadImage(bossSrc)])
    .then(([duck, boss]) => {
      sprites = { duck, boss };
      state.mode = 'start';
      showMsg(
        'DUCK KONG',
        'The duck boss throws barrels. Climb the ladders and reach the bread.\nSpace / JUMP to jump · arrows / buttons to move and climb',
        'Start',
        startGame,
      );
      rafId = requestAnimationFrame(loop);
    })
    .catch(() => {
      showMsg('Oops', 'Could not load the sprites.', 'Close', close);
    });
}
