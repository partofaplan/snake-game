// Snake vs Rats — simple 2D browser game
// Controls: Arrow keys / WASD, Space to pause, R to restart

(function () {
  const canvas = document.getElementById('board');
  const ctx = canvas.getContext('2d');
  const scoreEl = document.getElementById('score');
  const bestEl = document.getElementById('best');
  const overlay = document.getElementById('overlay');
  const panel = document.getElementById('panel');
  const titleEl = document.getElementById('state-title');
  const subEl = document.getElementById('state-sub');
  const startBtn = document.getElementById('start-btn');
  const pauseBtn = document.getElementById('pause-btn');
  const restartBtn = document.getElementById('restart-btn');

  // Config
  const COLS = 32;
  const ROWS = 32;
  let TILE = canvas.width / COLS;
  const BG1 = '#0f1327';
  const BG2 = '#0c1022';
  const SNAKE = '#5dd693';
  const SNAKE_HEAD = '#8bf0b3';
  const RAT = '#ffd166';
  const GRID = 'rgba(255,255,255,0.04)';

  // State
  let snake = [];
  let dir = { x: 1, y: 0 };
  let nextDir = { x: 1, y: 0 };
  let rat = { x: 10, y: 10 };
  let score = 0;
  let best = Number(localStorage.getItem('svr_best') || 0);
  let state = 'init'; // init | running | paused | over
  let lastStep = 0;
  let stepInterval = 110; // ms per step; speeds up on eat

  bestEl.textContent = best;

  // Helpers
  function randInt(min, max) { // inclusive
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function posEq(a, b) { return a.x === b.x && a.y === b.y; }

  function placeRat() {
    while (true) {
      const p = { x: randInt(0, COLS - 1), y: randInt(0, ROWS - 1) };
      if (!snake.some(s => posEq(s, p))) { rat = p; return; }
    }
  }

  function reset() {
    snake = [ { x: Math.floor(COLS/2), y: Math.floor(ROWS/2) } ];
    dir = { x: 1, y: 0 };
    nextDir = { x: 1, y: 0 };
    score = 0;
    stepInterval = 110;
    placeRat();
    scoreEl.textContent = score;
  }

  function start() {
    reset();
    state = 'running';
    overlay.classList.add('hide');
    pauseBtn.textContent = 'Pause';
  }

  function pauseToggle() {
    if (state === 'running') { state = 'paused'; pauseBtn.textContent = 'Resume'; showOverlay('Paused', 'Press Space to resume.'); }
    else if (state === 'paused') { state = 'running'; overlay.classList.add('hide'); pauseBtn.textContent = 'Pause'; }
  }

  function gameOver() {
    state = 'over';
    if (score > best) { best = score; localStorage.setItem('svr_best', String(best)); bestEl.textContent = best; }
    showOverlay('Game Over', `Final length: ${snake.length}. Press R to retry.`);
  }

  function showOverlay(title, sub) {
    titleEl.textContent = title;
    subEl.textContent = sub;
    overlay.classList.remove('hide');
  }

  // Input
  window.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if (k === ' ' || k === 'spacebar') { e.preventDefault(); if (state !== 'init') pauseToggle(); return; }
    if (k === 'r') { e.preventDefault(); start(); return; }
    if (state !== 'running') return;

    if (k === 'arrowup' || k === 'w') setNextDir(0, -1);
    else if (k === 'arrowdown' || k === 's') setNextDir(0, 1);
    else if (k === 'arrowleft' || k === 'a') setNextDir(-1, 0);
    else if (k === 'arrowright' || k === 'd') setNextDir(1, 0);
  });

  function setNextDir(x, y) {
    // Prevent reversing directly into self
    if (snake.length > 1 && dir.x === -x && dir.y === -y) return;
    nextDir = { x, y };
  }

  startBtn.addEventListener('click', start);
  pauseBtn.addEventListener('click', () => { if (state !== 'init') pauseToggle(); });
  restartBtn.addEventListener('click', start);

  // Game loop
  function tick(dt) {
    if (state === 'running') {
      if (dt - lastStep >= stepInterval) {
        step();
        lastStep = dt;
      }
    }
    draw();
    requestAnimationFrame(tick);
  }

  function step() {
    dir = nextDir;
    const head = snake[0];
    const nx = head.x + dir.x;
    const ny = head.y + dir.y;

    // Wall collision (inside a box)
    if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) { gameOver(); return; }

    const nextHead = { x: nx, y: ny };

    // Self-collision
    if (snake.some(seg => posEq(seg, nextHead))) { gameOver(); return; }

    // Move
    snake.unshift(nextHead);

    // Eat rat?
    if (posEq(nextHead, rat)) {
      score = snake.length - 1; // base on growth
      scoreEl.textContent = score;
      // Slight speed-up, clamp to minimum interval
      stepInterval = Math.max(55, stepInterval - 3);
      placeRat();
    } else {
      snake.pop(); // maintain length
    }
  }

  function drawGrid() {
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const even = ((x + y) & 1) === 0;
        ctx.fillStyle = even ? BG1 : BG2;
        ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
      }
    }
    // Border
    ctx.strokeStyle = GRID;
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, canvas.width - 2, canvas.height - 2);
  }

  function drawSnake() {
    if (!snake.length) return;
    for (let i = 0; i < snake.length; i++) {
      const s = snake[i];
      const x = s.x * TILE; const y = s.y * TILE;
      const r = Math.floor(TILE * 0.22);
      ctx.fillStyle = i === 0 ? SNAKE_HEAD : SNAKE;
      roundRect(ctx, x+2, y+2, TILE-4, TILE-4, r);
      ctx.fill();
    }
  }

  function drawRat() {
    const x = rat.x * TILE; const y = rat.y * TILE;
    // Rat body as rounded square
    ctx.fillStyle = RAT;
    roundRect(ctx, x+6, y+6, TILE-12, TILE-12, Math.floor(TILE * 0.25));
    ctx.fill();
    // Tail
    ctx.strokeStyle = '#ffb703';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + TILE - 10, y + TILE/2);
    ctx.quadraticCurveTo(x + TILE - 2, y + TILE/2 - 6, x + TILE - 2, y + TILE/2);
    ctx.stroke();
  }

  function roundRect(ctx, x, y, w, h, r) {
    const rr = Math.min(r, w/2, h/2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  function draw() {
    // Handle HiDPI crispness
    fitCanvasToDisplay();
    // Clear full canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawGrid();
    drawRat();
    drawSnake();
  }

  function fitCanvasToDisplay() {
    const displayWidth = canvas.clientWidth;
    const displayHeight = canvas.clientHeight;
    const dpr = window.devicePixelRatio || 1;
    const desiredW = Math.floor(displayWidth * dpr);
    const desiredH = Math.floor(displayHeight * dpr);
    if (canvas.width !== desiredW || canvas.height !== desiredH) {
      canvas.width = desiredW;
      canvas.height = desiredH;
    }
    TILE = canvas.width / COLS;
    // Reset any transforms
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  // Initial overlay visible; start loop
  requestAnimationFrame(tick);
})();
