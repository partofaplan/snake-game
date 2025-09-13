// Simple Express + WebSocket server for two-player sessions
const path = require('path');
const express = require('express');
const { WebSocketServer } = require('ws');
const { customAlphabet } = require('nanoid');

const app = express();
const PORT = process.env.PORT || 8080;

// Static files
app.use(express.static(path.join(__dirname)));

app.get('/health', (_req, res) => res.status(200).send('ok'));

const server = app.listen(PORT, () => {
  console.log(`Server listening on :${PORT}`);
});

// WebSocket signalling for controllers and host
const wss = new WebSocketServer({ server, path: '/ws' });

const nano = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 6);
const sessions = new Map();

function makeSession() {
  let code;
  do { code = nano(); } while (sessions.has(code));
  const s = { code, host: null, players: { p1: null, p2: null }, ready: { p1: false, p2: false } };
  sessions.set(code, s);
  return s;
}

function cleanupSocket(sock) {
  if (sock._role === 'host' && sock._session && sessions.get(sock._session)?.host === sock) {
    sessions.delete(sock._session);
  }
  if (sock._role && sock._session) {
    const s = sessions.get(sock._session);
    if (s) {
      if (sock._role === 'p1' && s.players.p1 === sock) { s.players.p1 = null; s.ready.p1 = false; }
      if (sock._role === 'p2' && s.players.p2 === sock) { s.players.p2 = null; s.ready.p2 = false; }
      if (!s.host && !s.players.p1 && !s.players.p2) sessions.delete(s.code);
      notifyStatus(s);
    }
  }
}

function notifyStatus(s) {
  const payload = JSON.stringify({ type: 'status', code: s.code, present: { p1: !!s.players.p1, p2: !!s.players.p2 }, ready: s.ready });
  if (s.host && s.host.readyState === 1) s.host.send(payload);
}

wss.on('connection', (ws) => {
  ws.on('message', (buf) => {
    let msg;
    try { msg = JSON.parse(buf.toString()); } catch { return; }
    const t = msg.type;
    if (t === 'create_session') {
      const s = makeSession();
      s.host = ws; ws._role = 'host'; ws._session = s.code;
      ws.send(JSON.stringify({ type: 'session_created', code: s.code }));
      notifyStatus(s);
      return;
    }
    if (t === 'join') {
      const s = sessions.get(msg.code);
      if (!s) { ws.send(JSON.stringify({ type: 'error', error: 'no_such_session' })); return; }
      const slot = !s.players.p1 ? 'p1' : (!s.players.p2 ? 'p2' : null);
      if (!slot) { ws.send(JSON.stringify({ type: 'error', error: 'full' })); return; }
      s.players[slot] = ws; s.ready[slot] = false; ws._role = slot; ws._session = s.code;
      ws.send(JSON.stringify({ type: 'joined', code: s.code, as: slot }));
      notifyStatus(s);
      return;
    }
    if (t === 'ready') {
      const s = sessions.get(msg.code);
      if (!s) return;
      if (ws === s.players.p1) s.ready.p1 = true;
      if (ws === s.players.p2) s.ready.p2 = true;
      notifyStatus(s);
      if (s.host && s.ready.p1 && s.ready.p2) {
        s.host.send(JSON.stringify({ type: 'both_ready' }));
      }
      return;
    }
    if (t === 'dir') {
      const s = sessions.get(msg.code);
      if (!s || !s.host) return;
      // forward to host
      s.host.send(JSON.stringify({ type: 'dir', player: msg.player, dir: msg.dir }));
      return;
    }
  });

  ws.on('close', () => cleanupSocket(ws));
  ws.on('error', () => cleanupSocket(ws));
});

