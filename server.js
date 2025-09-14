// Simple Express server with Server-Sent Events (SSE) leaderboard
// Serves static files and exposes:
//  - GET  /api/leaderboard?session=ID  -> JSON top leaderboard
//  - POST /api/score { name, score, ts?, session? } -> add score and broadcast
//  - GET  /api/stream?session=ID       -> SSE stream of leaderboard updates

const express = require('express');

const app = express();
const PORT = Number(process.env.PORT || 8080);

app.use(express.json());
app.disable('x-powered-by');

// In-memory leaderboards, keyed by session id
const boards = new Map(); // sessionId -> array of entries

function getBoard(sessionId) {
  const key = sessionId || 'default';
  if (!boards.has(key)) boards.set(key, []);
  return boards.get(key);
}

function setBoard(sessionId, arr) {
  const key = sessionId || 'default';
  boards.set(key, arr);
}

function sanitizeEntry(e) {
  const name = ((e.name || 'Anonymous') + '').slice(0, 20);
  const score = Math.max(0, Math.min(1000000, Number(e.score) || 0));
  const ts = Number(e.ts || Date.now());
  return { name, score, ts };
}

function topBoard(sessionId, n = 20) {
  const arr = [...getBoard(sessionId)]
    .sort((a, b) => b.score - a.score || a.ts - b.ts)
    .slice(0, n);
  return arr;
}

// SSE clients registry per session
const clients = new Map(); // sessionId -> Set(res)

function broadcast(sessionId) {
  const list = topBoard(sessionId);
  const payload = `event: leaderboard\n` +
                  `data: ${JSON.stringify({ session: sessionId || 'default', leaderboard: list })}\n\n`;
  const set = clients.get(sessionId || 'default');
  if (!set) return;
  for (const res of set) {
    try { res.write(payload); } catch {}
  }
}

app.get('/api/leaderboard', (req, res) => {
  const session = (req.query.session || 'default') + '';
  res.json({ session, leaderboard: topBoard(session) });
});

app.post('/api/score', (req, res) => {
  const session = (req.body.session || 'default') + '';
  const entry = sanitizeEntry(req.body || {});
  const board = getBoard(session);
  board.push(entry);
  // sort + cap
  board.sort((a, b) => b.score - a.score || a.ts - b.ts);
  if (board.length > 100) board.length = 100;
  setBoard(session, board);
  broadcast(session);
  res.status(202).json({ ok: true });
});

app.get('/api/stream', (req, res) => {
  const session = (req.query.session || 'default') + '';
  req.socket.setTimeout(0);
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders && res.flushHeaders();

  // Register client
  const key = session;
  if (!clients.has(key)) clients.set(key, new Set());
  const set = clients.get(key);
  set.add(res);

  // Send initial snapshot
  res.write(`event: leaderboard\n`);
  res.write(`data: ${JSON.stringify({ session: key, leaderboard: topBoard(key) })}\n\n`);

  req.on('close', () => {
    set.delete(res);
    if (set.size === 0) clients.delete(key);
  });
});

// Static files
app.use(express.static('.', { index: 'index.html', extensions: ['html'] }));

app.listen(PORT, () => {
  console.log(`Snake server listening on :${PORT}`);
});

