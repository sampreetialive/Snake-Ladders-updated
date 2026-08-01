/* ============================================================
   SNAKE & LADDERS DELUXE — GAME SCRIPT (vanilla JS, no framework)
   Organized into clearly labeled sections:
     1. CANVAS SETUP
     2. GAME STATE & CONFIG
     3. ASSETS  (snake/ladder PNG generation, sound synthesis)
     4. BOARD GEOMETRY
     5. PLAYERS
     6. SNAKES & LADDERS  (definitions + placement math)
     7. RENDERING
     8. MOVEMENT  (tile-by-tile + snake/ladder animations)
     9. DICE
    10. WIN LOGIC
    11. UI  (sidebar, log, toast, winner popup, confetti)
    12. INIT & EVENT BINDING
   ============================================================ */

/* ============================================================
   1. CANVAS SETUP
   ============================================================ */

const BOARD_SIZE = 760;          // logical board resolution (px)
const GRID = 10;                 // 10 x 10 = 100 tiles
const TILE = BOARD_SIZE / GRID;  // size of one tile (76px)

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');

// Scale the backing store by devicePixelRatio for crisp rendering on
// retina/HiDPI screens, then keep all drawing in logical coordinates.
function setupCanvas() {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = BOARD_SIZE * dpr;
  canvas.height = BOARD_SIZE * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
setupCanvas();

/* ============================================================
   2. GAME STATE & CONFIG
   ============================================================ */

// --- Customizable snake & ladder definitions ---
// Each entry only needs {start, end}; width/height/rotation/offsetX/offsetY
// are auto-computed so the image always connects the two tiles correctly.
// You may override any of those fields per-entry (see normalizeSnakes).
const snakes = [
  { start: 83, end: 65 },
  { start: 62, end: 39 },
  { start: 48, end: 8  },
  { start: 95, end: 77 },
  { start: 33, end: 5  },
  { start: 17, end: 7  },
];

const ladders = [
  { start: 4,  end: 37 },
  { start: 29, end: 52 },
  { start: 73, end: 95 },
  { start: 11, end: 49 },
  { start: 60, end: 88 },
];

// --- Player definitions ---
const PLAYER_DEFS = [
  { name: 'Player 1', color: '#d6453f' },
  { name: 'Player 2', color: '#3b7dd8' },
];

// --- Central game state ---
const state = {
  players: [],
  current: 0,         // index of player whose turn it is
  rolling: false,     // dice roll / animation in progress
  over: false,        // game won
  soundOn: true,
  assetsReady: false,
};

/* ============================================================
   3. ASSETS
   ============================================================ */

// --- 3a. Generate a snake PNG image (head at top, tail at bottom) ---
// Returns an HTMLImageElement loaded from a PNG data URL.
function createSnakeImage() {
  const w = 64, h = 280;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');

  // Wavy body path: horizontal sine offset as we move down.
  const amp = 9, segs = 60;
  g.lineCap = 'round';
  g.lineJoin = 'round';

  // Body fill (thick stroke with green gradient)
  const grad = g.createLinearGradient(0, 0, w, 0);
  grad.addColorStop(0, '#3f8c3a');
  grad.addColorStop(0.5, '#5fbf57');
  grad.addColorStop(1, '#2f6e2b');
  g.strokeStyle = grad;
  g.lineWidth = 20;

  g.beginPath();
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const y = 26 + t * (h - 52);
    const x = w / 2 + Math.sin(t * Math.PI * 3) * amp;
    if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
  }
  g.stroke();

  // Belly highlight
  g.strokeStyle = 'rgba(220,255,210,0.35)';
  g.lineWidth = 6;
  g.beginPath();
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const y = 26 + t * (h - 52) - 4;
    const x = w / 2 + Math.sin(t * Math.PI * 3) * amp;
    if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
  }
  g.stroke();

  // Scale diamonds down the body
  g.fillStyle = 'rgba(20,60,18,0.55)';
  for (let i = 1; i < segs; i += 4) {
    const t = i / segs;
    const y = 26 + t * (h - 52);
    const x = w / 2 + Math.sin(t * Math.PI * 3) * amp;
    g.beginPath();
    g.ellipse(x, y, 3, 6, 0, 0, Math.PI * 2);
    g.fill();
  }

  // Head (oval at top)
  g.fillStyle = '#5fbf57';
  g.beginPath();
  g.ellipse(w / 2, 20, 17, 21, 0, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = '#2f6e2b';
  g.lineWidth = 2;
  g.stroke();

  // Eyes
  g.fillStyle = '#fff';
  g.beginPath(); g.arc(w / 2 - 7, 15, 5, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(w / 2 + 7, 15, 5, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#1a1a1a';
  g.beginPath(); g.arc(w / 2 - 7, 16, 2.4, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(w / 2 + 7, 16, 2.4, 0, Math.PI * 2); g.fill();

  // Forked tongue
  g.strokeStyle = '#d6453f';
  g.lineWidth = 2;
  g.beginPath(); g.moveTo(w / 2, 40); g.lineTo(w / 2, 52); g.stroke();
  g.beginPath(); g.moveTo(w / 2, 52); g.lineTo(w / 2 - 5, 58); g.stroke();
  g.beginPath(); g.moveTo(w / 2, 52); g.lineTo(w / 2 + 5, 58); g.stroke();

  return loadImage(c.toDataURL('image/png'));
}

// --- 3b. Generate a ladder PNG image (vertical, wooden) ---
function createLadderImage() {
  const w = 56, h = 280;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');

  const railW = 11, inset = 8;
  const rungCount = 7;

  // Two vertical rails
  const railGrad = g.createLinearGradient(0, 0, w, 0);
  railGrad.addColorStop(0, '#9c6b35');
  railGrad.addColorStop(0.5, '#c9974f');
  railGrad.addColorStop(1, '#7a4f24');
  g.fillStyle = railGrad;
  roundRect(g, inset, 4, railW, h - 8, 5); g.fill();
  roundRect(g, w - inset - railW, 4, railW, h - 8, 5); g.fill();

  // Rail shading
  g.fillStyle = 'rgba(255,225,170,0.35)';
  g.fillRect(inset + 2, 6, 3, h - 12);
  g.fillRect(w - inset - railW + 2, 6, 3, h - 12);

  // Rungs
  for (let i = 0; i < rungCount; i++) {
    const y = 18 + i * ((h - 36) / (rungCount - 1));
    g.fillStyle = railGrad;
    roundRect(g, inset, y - 5, w - inset * 2, 10, 4); g.fill();
    g.fillStyle = 'rgba(0,0,0,0.18)';
    g.fillRect(inset, y + 3, w - inset * 2, 2);
  }

  return loadImage(c.toDataURL('image/png'));
}

// Helper: load a data URL into an Image element (returns the Image).
function loadImage(src) {
  const img = new Image();
  img.src = src;
  return img;
}

// Helper: rounded-rectangle path (does not fill/stroke on its own).
function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

// --- 3c. Sound effects (synthesized via Web Audio, no files needed) ---
const Sound = {
  ctx: null,
  ensure() {
    if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (this.ctx.state === 'suspended') this.ctx.resume();
  },
  // Play a short tone with a given frequency, duration, type and volume.
  tone(freq, dur, type = 'sine', vol = 0.15) {
    if (!state.soundOn) return;
    this.ensure();
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(vol, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain); gain.connect(this.ctx.destination);
    osc.start(t); osc.stop(t + dur);
  },
  click()  { this.tone(420, 0.07, 'square', 0.08); },
  dice()   { this.tone(180, 0.05, 'square', 0.1); this.tone(260, 0.05, 'square', 0.08); },
  snake()  { this.tone(300, 0.18, 'sawtooth', 0.12); setTimeout(() => this.tone(160, 0.22, 'sawtooth', 0.12), 120); },
  ladder() { this.tone(440, 0.12, 'triangle', 0.12); setTimeout(() => this.tone(660, 0.16, 'triangle', 0.12), 110); },
  win()    {
    [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.tone(f, 0.25, 'triangle', 0.14), i * 140));
  },
};

// --- 3d. Preload all generated images, then flag assets ready ---
const Assets = { snake: null, ladder: null };
function preloadAssets() {
  Assets.snake = createSnakeImage();
  Assets.ladder = createLadderImage();
  let loaded = 0;
  const done = () => { if (++loaded === 2) { state.assetsReady = true; render(); } };
  [Assets.snake, Assets.ladder].forEach(img => {
    if (img.complete) done(); else img.addEventListener('load', done);
  });
}

/* ============================================================
   4. BOARD GEOMETRY
   ============================================================ */

// Convert a tile number (1..100) into its pixel center on the board.
// Uses the standard boustrophedon (snake) numbering:
//   bottom row 1->10 (L->R), next row 20<-11 (R->L), and so on.
function tileCenter(n) {
  const pos = n - 1;
  const row = Math.floor(pos / GRID);        // 0 = bottom row
  const colInRow = pos % GRID;
  const col = (row % 2 === 0) ? colInRow : (GRID - 1 - colInRow);
  const screenRow = (GRID - 1) - row;        // row 0 is at the bottom on screen
  return {
    x: col * TILE + TILE / 2,
    y: screenRow * TILE + TILE / 2,
  };
}

/* ============================================================
   5. PLAYERS
   ============================================================ */

function createPlayers() {
  state.players = PLAYER_DEFS.map((def, i) => ({
    index: i,
    name: def.name,
    color: def.color,
    position: 1,         // everyone starts on tile 1
    drawX: 0,
    drawY: 0,
  }));
  // Place tokens at tile 1 immediately.
  state.players.forEach(p => {
    const c = tileCenter(p.position);
    p.drawX = c.x; p.drawY = c.y;
  });
  state.current = 0;
}

/* ============================================================
   6. SNAKES & LADDERS  (definitions + placement math)
   ============================================================ */

// Fill in width/height/rotation/offsetX/offsetY defaults so every snake
// object "has" those fields, while letting callers override any of them.
function normalizeEntities(list, isSnake) {
  return list.map(e => {
    const s = tileCenter(e.start);
    const en = tileCenter(e.end);
    const dist = Math.hypot(en.x - s.x, en.y - s.y);
    // Align the image so head(top)->start, tail(bottom)->end (snake)
    // or bottom->start, top->end (ladder). See rotation math below.
    const baseAngle = Math.atan2(en.y - s.y, en.x - s.x);
    const autoRotation = isSnake ? baseAngle - Math.PI / 2
                                 : baseAngle + Math.PI / 2;
    return {
      start: e.start,
      end: e.end,
      width:  e.width  ?? (isSnake ? 64 : 56),
      height: e.height ?? dist,
      rotation: e.rotation ?? autoRotation,
      offsetX: e.offsetX ?? 0,
      offsetY: e.offsetY ?? 0,
    };
  });
}

// Quick lookup: tile -> entity that starts there.
function buildJumpMap() {
  const map = {};
  snakes.forEach(s => { map[s.start] = { type: 'snake', end: s.end }; });
  ladders.forEach(l => { map[l.start] = { type: 'ladder', end: l.end }; });
  return map;
}

let snakeData = [];
let ladderData = [];
let jumpMap = {};

/* ============================================================
   7. RENDERING
   ============================================================ */

// --- 7a. Draw the 100-tile board with numbers + alternating colors ---
function drawBoard() {
  for (let n = 1; n <= 100; n++) {
    const pos = n - 1;
    const row = Math.floor(pos / GRID);
    const colInRow = pos % GRID;
    const col = (row % 2 === 0) ? colInRow : (GRID - 1 - colInRow);
    const screenRow = (GRID - 1) - row;

    const x = col * TILE, y = screenRow * TILE;

    // Alternating tile colors
    const light = (row + colInRow) % 2 === 0;
    ctx.fillStyle = light ? '#f0dcb4' : '#d8c08a';
    ctx.fillRect(x, y, TILE, TILE);

    // Soft inner border
    ctx.strokeStyle = 'rgba(60,40,20,0.18)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);

    // Tile number in the bottom-left corner
    ctx.fillStyle = 'rgba(60,40,20,0.72)';
    ctx.font = '600 13px Quicksand, sans-serif';
    ctx.textBaseline = 'bottom';
    ctx.textAlign = 'left';
    ctx.fillText(String(n), x + 5, y + TILE - 5);
  }
}

// --- 7b. Draw a single entity (snake or ladder) image between its tiles ---
function drawEntity(e, img) {
  if (!img || !img.naturalWidth) return;   // skip until the PNG has decoded
  const s = tileCenter(e.start);
  const en = tileCenter(e.end);
  const mid = { x: (s.x + en.x) / 2, y: (s.y + en.y) / 2 };

  ctx.save();
  ctx.translate(mid.x + e.offsetX, mid.y + e.offsetY);
  ctx.rotate(e.rotation);
  // Soft drop shadow under the image
  ctx.shadowColor = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 3;
  ctx.drawImage(img, -e.width / 2, -e.height / 2, e.width, e.height);
  ctx.restore();
}

// --- 7c. Draw all snakes and ladders ---
function drawSnakes()  { snakeData.forEach(s  => drawEntity(s,  Assets.snake));  }
function drawLadders() { ladderData.forEach(l => drawEntity(l, Assets.ladder)); }

// --- 7d. Draw player tokens (offset when sharing a tile) ---
function drawPlayers() {
  // Group players by tile so we can offset co-located tokens.
  const byTile = {};
  state.players.forEach(p => {
    (byTile[p.position] ||= []).push(p);
  });

  // Compute a per-player horizontal offset for shared tiles.
  const offsetFor = {};
  Object.values(byTile).forEach(group => {
    group.forEach((p, i) => {
      offsetFor[p.index] = group.length > 1
        ? (i - (group.length - 1) / 2) * (TILE * 0.22)
        : 0;
    });
  });

  // Draw each token at its animated (drawX, drawY) plus any shared-tile offset.
  state.players.forEach(p =>
    drawToken(p.drawX + (offsetFor[p.index] || 0), p.drawY, p.color, p.index)
  );
}

// Draw one circular token with a glossy highlight and gold ring.
function drawToken(x, y, color, idx) {
  const r = TILE * 0.30;
  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.ellipse(x, y + r * 0.7, r * 0.9, r * 0.4, 0, 0, Math.PI * 2); ctx.fill();
  // Gold ring
  ctx.fillStyle = '#d9a441';
  ctx.beginPath(); ctx.arc(x, y, r + 2, 0, Math.PI * 2); ctx.fill();
  // Body
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  // Glossy highlight
  const hg = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
  hg.addColorStop(0, 'rgba(255,255,255,0.65)');
  hg.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = hg;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  // Player number
  ctx.fillStyle = '#fff';
  ctx.font = '700 14px Cinzel, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(idx + 1), x, y + 1);
}

// --- 7e. Master render: board -> ladders -> snakes -> players ---
function render() {
  ctx.clearRect(0, 0, BOARD_SIZE, BOARD_SIZE);
  drawBoard();
  drawLadders();
  drawSnakes();
  drawPlayers();
}

/* ============================================================
   8. MOVEMENT
   ============================================================ */

const delay = (ms) => new Promise(r => setTimeout(r, ms));

// Animate a player one tile forward, stepping 1..target.
async function moveStepByStep(player, steps) {
  for (let i = 0; i < steps; i++) {
    const next = player.position + 1;
    if (next > 100) break;            // cannot overshoot 100
    await animateToTile(player, next);
    player.position = next;
  }
}

// Smoothly glide a token to a given tile center.
async function animateToTile(player, tile) {
  const dest = tileCenter(tile);
  await animateToPoint(player, dest.x, dest.y, 220);
}

// Animate token to an arbitrary point with easing.
async function animateToPoint(player, dx, dy, duration) {
  const sx = player.drawX, sy = player.drawY;
  const start = performance.now();
  return new Promise(resolve => {
    function step(now) {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);      // easeOutCubic
      player.drawX = sx + (dx - sx) * eased;
      player.drawY = sy + (dy - sy) * eased;
      render();
      if (t < 1) requestAnimationFrame(step);
      else resolve();
    }
    requestAnimationFrame(step);
  });
}

// After landing, check for a snake or ladder and animate the jump.
async function checkAndAnimateJump(player) {
  const jump = jumpMap[player.position];
  if (!jump) return null;

  const dest = tileCenter(jump.end);
  // Snakes slide down (a bit faster + wobble), ladders climb up.
  const dur = jump.type === 'snake' ? 650 : 700;
  await animateToPoint(player, dest.x, dest.y, dur);
  player.position = jump.end;
  return jump.type;
}

/* ============================================================
   9. DICE
   ============================================================ */

const PIP_LAYOUT = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

const diceEl   = document.getElementById('dice');
const diceFace = document.getElementById('diceFace');
const lastRoll = document.getElementById('lastRoll');
const rollBtn  = document.getElementById('rollBtn');

// Render a dice value (1..6) as pips in the CSS-grid face.
function renderDice(value) {
  diceFace.innerHTML = '';
  const on = new Set(PIP_LAYOUT[value]);
  for (let i = 0; i < 9; i++) {
    const cell = document.createElement('div');
    if (on.has(i)) cell.className = 'pip';
    diceFace.appendChild(cell);
  }
}

// Roll animation: cycle random faces, then settle on the final value.
async function rollDice() {
  if (state.rolling || state.over) return;
  state.rolling = true;
  rollBtn.disabled = true;
  Sound.dice();

  diceEl.classList.remove('rolling');
  void diceEl.offsetWidth;            // restart animation
  diceEl.classList.add('rolling');

  // Shuffle faces during the roll for a tumbling feel.
  for (let i = 0; i < 6; i++) {
    renderDice(1 + Math.floor(Math.random() * 6));
    await delay(80);
  }
  const value = 1 + Math.floor(Math.random() * 6);
  renderDice(value);
  lastRoll.textContent = value;
  await delay(220);                   // let final face settle
  diceEl.classList.remove('rolling');
  return value;
}

/* ============================================================
   10. WIN LOGIC
   ============================================================ */

function checkWin(player) {
  return player.position === 100;
}

/* ============================================================
   11. UI  (sidebar, log, toast, winner popup, confetti)
   ============================================================ */

// --- 11a. Sidebar: player cards + current-turn indicator ---
const playerCardsEl = document.getElementById('playerCards');
const currentDot    = document.getElementById('currentDot');
const currentName   = document.getElementById('currentName');

function buildPlayerCards() {
  playerCardsEl.innerHTML = '';
  state.players.forEach(p => {
    const card = document.createElement('div');
    card.className = 'player-card';
    card.dataset.index = p.index;
    card.innerHTML = `
      <span class="player-dot" style="background:${p.color}"></span>
      <span class="player-name">${p.name}</span>
      <span class="player-pos" data-pos>Tile 1</span>`;
    playerCardsEl.appendChild(card);
  });
  updateSidebar();
}

function updateSidebar() {
  // Highlight the active player's card and indicator.
  const cur = state.players[state.current];
  currentName.textContent = cur.name;
  currentDot.style.background = cur.color;

  [...playerCardsEl.children].forEach(card => {
    const p = state.players[+card.dataset.index];
    card.classList.toggle('active', p.index === state.current);
    card.querySelector('[data-pos]').textContent = `Tile ${p.position}`;
  });
}

// --- 11b. Game log ---
const logEl = document.getElementById('log');
function logMessage(msg, accent = false) {
  const line = document.createElement('div');
  line.className = 'log-line';
  if (accent) line.style.borderLeftColor = 'var(--gold-light)';
  line.textContent = msg;
  logEl.appendChild(line);
  logEl.scrollTop = logEl.scrollHeight;
}

// --- 11c. Toast (transient banner for "Rolled 5", "Snake!", "Ladder!") ---
let toastTimer = null;
function toast(msg) {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 1600);
}

// --- 11d. Winner popup + confetti ---
const winnerOverlay = document.getElementById('winnerOverlay');
const winnerTitle   = document.getElementById('winnerTitle');
const winnerSub     = document.getElementById('winnerSub');
const confettiCanvas = document.getElementById('confetti');
const confettiCtx   = confettiCanvas.getContext('2d');
let confettiActive = false;

function showWinner(player) {
  state.over = true;
  winnerTitle.textContent = `${player.name} Wins!`;
  winnerTitle.style.color = player.color;
  winnerSub.textContent = `Reached tile 100 and claimed the throne.`;
  winnerOverlay.classList.add('show');
  Sound.win();
  startConfetti();
  logMessage(`${player.name} Wins!`, true);
}

function hideWinner() {
  winnerOverlay.classList.remove('show');
  confettiActive = false;
}

// Confetti particle burst on win.
function startConfetti() {
  confettiCanvas.width = window.innerWidth;
  confettiCanvas.height = window.innerHeight;
  const colors = ['#d9a441', '#f3d27a', '#d6453f', '#3b7dd8', '#5fbf57', '#fff'];
  const parts = [];
  for (let i = 0; i < 160; i++) {
    parts.push({
      x: confettiCanvas.width / 2 + (Math.random() - 0.5) * 200,
      y: confettiCanvas.height / 2,
      vx: (Math.random() - 0.5) * 14,
      vy: Math.random() * -16 - 4,
      g: 0.35,
      size: 5 + Math.random() * 7,
      color: colors[(Math.random() * colors.length) | 0],
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
      life: 1,
    });
  }
  confettiActive = true;

  function frame() {
    if (!confettiActive) return;
    confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
    let alive = false;
    parts.forEach(p => {
      p.vy += p.g;
      p.x += p.vx; p.y += p.vy;
      p.rot += p.vr;
      p.life -= 0.006;
      if (p.life > 0 && p.y < confettiCanvas.height + 20) {
        alive = true;
        confettiCtx.save();
        confettiCtx.translate(p.x, p.y);
        confettiCtx.rotate(p.rot);
        confettiCtx.globalAlpha = Math.max(0, p.life);
        confettiCtx.fillStyle = p.color;
        confettiCtx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        confettiCtx.restore();
      }
    });
    if (alive) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

/* ============================================================
   12. INIT & EVENT BINDING
   ============================================================ */

// Full turn flow: roll -> move -> resolve snake/ladder -> check win -> next.
async function takeTurn() {
  const player = state.players[state.current];
  const value = await rollDice();
  toast(`Rolled ${value}`);
  logMessage(`${player.name} rolled ${value}.`);

  const target = player.position + value;
  if (target > 100) {
    // Overshoot: player stays put, turn passes.
    logMessage(`${player.name} needs exactly ${100 - player.position} to win — stays on tile ${player.position}.`);
    endTurn();
    return;
  }

  await moveStepByStep(player, value);
  updateSidebar();

  // Resolve snake / ladder after landing.
  const jumped = await checkAndAnimateJump(player);
  if (jumped === 'snake')  { toast('Snake!');  logMessage('Snake! Slid down.', true);  Sound.snake();  }
  if (jumped === 'ladder') { toast('Ladder!'); logMessage('Ladder! Climbed up.', true); Sound.ladder(); }
  updateSidebar();

  if (checkWin(player)) { showWinner(player); return; }
  endTurn();
}

// Pass the turn to the next player and re-enable the dice.
function endTurn() {
  state.current = (state.current + 1) % state.players.length;
  state.rolling = false;
  rollBtn.disabled = false;
  updateSidebar();
}

// Reset everything for a fresh game (keeps the same players & board).
function restartGame() {
  state.over = false;
  state.rolling = false;
  hideWinner();
  createPlayers();
  snakeData  = normalizeEntities(snakes, true);
  ladderData = normalizeEntities(ladders, false);
  jumpMap = buildJumpMap();
  buildPlayerCards();
  logEl.innerHTML = '';
  logMessage('New game started. Player 1 goes first!');
  rollBtn.disabled = false;
  renderDice(1);
  lastRoll.textContent = '—';
  render();
}

// --- Event bindings ---
rollBtn.addEventListener('click', () => { Sound.click(); takeTurn(); });

document.getElementById('restartBtn').addEventListener('click', () => {
  Sound.click(); restartGame();
});

document.getElementById('playAgainBtn').addEventListener('click', () => {
  Sound.click(); restartGame();
});

const soundBtn = document.getElementById('soundBtn');
soundBtn.addEventListener('click', () => {
  state.soundOn = !state.soundOn;
  soundBtn.textContent = `Sound: ${state.soundOn ? 'On' : 'Off'}`;
  if (state.soundOn) Sound.click();
});

// Keep confetti canvas sized to the viewport.
window.addEventListener('resize', () => {
  if (confettiActive) {
    confettiCanvas.width = window.innerWidth;
    confettiCanvas.height = window.innerHeight;
  }
});

// --- Boot the game ---
restartGame();
preloadAssets();
