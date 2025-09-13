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
  const singleBtn = document.getElementById('single-btn');
  const twoBtn = document.getElementById('two-btn');
  const modeSelect = document.getElementById('mode-select');
  const twoSetup = document.getElementById('two-setup');
  const sessCodeEl = document.getElementById('sess-code');
  const joinUrlEl = document.getElementById('join-url');
  const p1StatusEl = document.getElementById('p1-status');
  const p2StatusEl = document.getElementById('p2-status');
  const waitReadyBtn = document.getElementById('wait-ready');
  const pauseBtn = document.getElementById('pause-btn');
  const restartBtn = document.getElementById('restart-btn');

  // Config
  const COLS = 45; // ~40% larger than 32
  const ROWS = 45;
  let TILE = canvas.width / COLS;
  const BG1 = '#0f1327';
  const BG2 = '#0c1022';
  const SNAKE1 = '#5dd693';
  const SNAKE1_HEAD = '#8bf0b3';
  const SNAKE2 = '#60a5fa';
  const SNAKE2_HEAD = '#93c5fd';
  const RAT = '#ffd166';
  const GRID = 'rgba(255,255,255,0.04)';

  // State
  let mode = 'single'; // single | two
  let snake1 = [];
  let snake2 = [];
  let dir1 = { x: 1, y: 0 };
  let dir2 = { x: -1, y: 0 };
  let nextDir1 = { x: 1, y: 0 };
  let nextDir2 = { x: -1, y: 0 };
  let rats = [];
  let score = 0;
  let best = Number(localStorage.getItem('svr_best') || 0);
  let state = 'init'; // init | running | paused | over
  let lastStep = 0;
  let stepInterval = 110; // ms per step; speeds up on eat

  // WS for two-player host
  let ws = null; let sessionCode = null;

  bestEl.textContent = best;

  // Helpers
  function randInt(min, max) { // inclusive
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function posEq(a, b) { return a.x === b.x && a.y === b.y; }

  function placeRats(n) {
    rats = [];
    while (rats.length < n) {
      const p = { x: randInt(0, COLS - 1), y: randInt(0, ROWS - 1) };
      const occupied = snake1.concat(snake2).some(s => posEq(s, p)) || rats.some(r => posEq(r, p));
      if (!occupied) rats.push(p);
    }
  }

  function reset() {
    if (mode === 'single') {
      snake1 = [ { x: Math.floor(COLS/2), y: Math.floor(ROWS/2) } ];
      dir1 = { x: 1, y: 0 }; nextDir1 = { x: 1, y: 0 };
      snake2 = [];
    } else {
      snake1 = [ { x: 2, y: 2 } ];
      dir1 = { x: 1, y: 0 }; nextDir1 = { x: 1, y: 0 };
      snake2 = [ { x: COLS-3, y: ROWS-3 } ];
      dir2 = { x: -1, y: 0 }; nextDir2 = { x: -1, y: 0 };
    }
    score = 0;
    stepInterval = 110;
    placeRats(3); // always 3 rats
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

    if (k === 'arrowup' || k === 'w') setNextDir(1, 0, -1);
    else if (k === 'arrowdown' || k === 's') setNextDir(1, 0, 1);
    else if (k === 'arrowleft' || k === 'a') setNextDir(1, -1, 0);
    else if (k === 'arrowright' || k === 'd') setNextDir(1, 1, 0);
  });

  function setNextDir(player, x, y) {
    if (player === 1) {
      if (snake1.length > 1 && dir1.x === -x && dir1.y === -y) return;
      nextDir1 = { x, y };
    } else {
      if (snake2.length > 1 && dir2.x === -x && dir2.y === -y) return;
      nextDir2 = { x, y };
    }
  }

  startBtn.addEventListener('click', start);
  singleBtn?.addEventListener('click', () => { mode = 'single'; start(); });
  twoBtn?.addEventListener('click', async () => { mode = 'two'; setupTwoPlayer(); });
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
    if (mode === 'single') {
      dir1 = nextDir1;
      const head = snake1[0];
      const nx = head.x + dir1.x;
      const ny = head.y + dir1.y;
      if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) { gameOver(); return; }
      const nextHead = { x: nx, y: ny };
      if (snake1.some(seg => posEq(seg, nextHead))) { gameOver(); return; }
      snake1.unshift(nextHead);
      const ate = rats.findIndex(r => posEq(nextHead, r));
      if (ate >= 0) {
        score = snake1.length - 1; scoreEl.textContent = score;
        stepInterval = Math.max(55, stepInterval - 3);
        placeRats(3);
      } else {
        snake1.pop();
      }
    } else {
      // two-player: advance both; check collisions
      dir1 = nextDir1; dir2 = nextDir2;
      const h1 = snake1[0]; const n1 = { x: h1.x + dir1.x, y: h1.y + dir1.y };
      const h2 = snake2[0]; const n2 = { x: h2.x + dir2.x, y: h2.y + dir2.y };

      // Wall
      const out1 = n1.x < 0 || n1.y < 0 || n1.x >= COLS || n1.y >= ROWS;
      const out2 = n2.x < 0 || n2.y < 0 || n2.x >= COLS || n2.y >= ROWS;
      // Self or other collision
      const hit1 = snake1.some(seg => posEq(seg, n1)) || snake2.some(seg => posEq(seg, n1));
      const hit2 = snake2.some(seg => posEq(seg, n2)) || snake1.some(seg => posEq(seg, n2));

      if (out1 || hit1) { showOverlay('Player 2 Wins!', 'Player 1 crashed. Press R to play again.'); state='over'; return; }
      if (out2 || hit2) { showOverlay('Player 1 Wins!', 'Player 2 crashed. Press R to play again.'); state='over'; return; }

      snake1.unshift(n1); snake2.unshift(n2);
      let ate1 = rats.findIndex(r => posEq(n1, r));
      let ate2 = rats.findIndex(r => posEq(n2, r));
      if (ate1 >= 0 || ate2 >= 0) {
        // replace eaten rats; can result in 3 again
        placeRats(3);
      } else {
        snake1.pop(); snake2.pop();
      }
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

  function drawSnakes() {
    const drawSnake = (arr, cBody, cHead) => {
      if (!arr.length) return;
      for (let i = 0; i < arr.length; i++) {
        const s = arr[i];
        const x = s.x * TILE; const y = s.y * TILE;
        const r = Math.floor(TILE * 0.22);
        ctx.fillStyle = i === 0 ? cHead : cBody;
        roundRect(ctx, x+2, y+2, TILE-4, TILE-4, r);
        ctx.fill();
      }
    };
    drawSnake(snake1, SNAKE1, SNAKE1_HEAD);
    drawSnake(snake2, SNAKE2, SNAKE2_HEAD);
  }

  function drawRats() {
    for (const rat of rats) {
      const x = rat.x * TILE; const y = rat.y * TILE;
      ctx.fillStyle = RAT;
      roundRect(ctx, x+6, y+6, TILE-12, TILE-12, Math.floor(TILE * 0.25));
      ctx.fill();
      ctx.strokeStyle = '#ffb703';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + TILE - 10, y + TILE/2);
      ctx.quadraticCurveTo(x + TILE - 2, y + TILE/2 - 6, x + TILE - 2, y + TILE/2);
      ctx.stroke();
    }
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
    drawRats();
    drawSnakes();
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

  // Two-player host setup
  function setupTwoPlayer() {
    modeSelect.classList.add('hide');
    twoSetup.classList.remove('hide');
    titleEl.textContent = 'Two Player Setup';
    subEl.textContent = 'Connect two phones as controllers and tap Ready.';
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const wsUrl = `${proto}://${location.host}/ws`;
    ws = new WebSocket(wsUrl);
    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'create_session' }));
    };
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.type === 'session_created') {
        sessionCode = msg.code; sessCodeEl.textContent = sessionCode;
        joinUrlEl.textContent = location.origin + '/controller.html';
      } else if (msg.type === 'status') {
        p1StatusEl.textContent = `P1: ${msg.present.p1 ? (msg.ready.p1 ? 'ready' : 'connected') : 'not connected'}`;
        p2StatusEl.textContent = `P2: ${msg.present.p2 ? (msg.ready.p2 ? 'ready' : 'connected') : 'not connected'}`;
      } else if (msg.type === 'both_ready') {
        waitReadyBtn.textContent = 'Both ready! Starting…';
        setTimeout(() => start(), 800);
      } else if (msg.type === 'dir') {
        const d = msg.dir;
        if (msg.player === 'p1') setNextDir(1, d.x, d.y);
        else if (msg.player === 'p2') setNextDir(2, d.x, d.y);
      }
    };
  }
})();
