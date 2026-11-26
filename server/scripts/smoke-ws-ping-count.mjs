/* BUG-50: exactly ONE server ws.ping() per WS_PING_MS per socket (no double heartbeat).
   Usage: node scripts/smoke-ws-ping-count.mjs [seconds=60]   (needs `npm run build`)
   Two slots (blue+green), WS_PING_MS=1000: counts pings received by v1, v2 and proxied-v1 (blue->green) clients. */
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import net from 'node:net';

const SERVER_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
const MAIN_JS = join(SERVER_DIR, 'dist', 'main.js');
const WebSocket = createRequire(import.meta.url)(join(SERVER_DIR, 'node_modules', 'ws'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const SECONDS = Number(process.argv[2]) || 60;
const PING_MS = 1000;
const TOKEN = 'ping-count-token';
let failures = 0;
const check = (ok, msg) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg); if (!ok) failures++; };
const freePort = () => new Promise((res, rej) => {
  const s = net.createServer(); s.on('error', rej);
  s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => res(port)); });
});

function slot(name, pub, int, peerInt) {
  const child = spawn(process.execPath, [MAIN_JS], {
    cwd: SERVER_DIR,
    env: {
      ...process.env, NODE_ENV: 'production', PORT: String(pub), INTERNAL_PORT: String(int), NODE_NAME: name,
      APP_VERSION: '0.58.0', PEER_INTERNAL_URL: `http://127.0.0.1:${peerInt}`, INTERNAL_HOST: '127.0.0.1',
      INTERNAL_TOKEN: TOKEN, WS_PING_MS: String(PING_MS), WS_PONG_TIMEOUT_MS: '60000',
    },
    stdio: 'ignore',
  });
  return { name, pub, int, child };
}
async function ready(s) {
  for (let i = 0; i < 100; i++) {
    try {
      const [a, b] = await Promise.all([
        fetch(`http://127.0.0.1:${s.pub}/api/health`),
        fetch(`http://127.0.0.1:${s.int}/internal/stats`, { headers: { 'x-internal-token': TOKEN } }),
      ]);
      if (a.ok && b.ok) return;
    } catch { /* retry */ }
    await sleep(100);
  }
  throw new Error(`slot ${s.name} not ready`);
}
function open(url) {
  return new Promise((res, rej) => {
    const ws = new WebSocket(url);
    const c = { ws, pings: 0, frames: [] };
    ws.on('ping', () => { c.pings++; });
    ws.on('message', (d) => { try { c.frames.push(JSON.parse(d.toString())); } catch { /* ignore */ } });
    ws.once('open', () => res(c)); ws.once('error', rej);
  });
}
async function wait(c, ev, ms = 3000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const f = c.frames.find((x) => x.event === ev);
    if (f) return f.data;
    await sleep(30);
  }
  throw new Error('timeout waiting ' + ev);
}

const b = slot('blue', await freePort(), await freePort(), 0);
const g = slot('green', await freePort(), await freePort(), b.int);
b.child.kill('SIGKILL'); // restart blue with correct peer url
const b2 = slot('blue', b.pub, b.int, g.int);
const all = [b2, g];
try {
  await Promise.all([ready(b2), ready(g)]);
  const v2 = await open(`ws://127.0.0.1:${b2.pub}/ws?p=2`);
  const v1 = await open(`ws://127.0.0.1:${b2.pub}/ws`);
  const gv2 = await open(`ws://127.0.0.1:${g.pub}/ws?p=2`);
  const host = await open(`ws://127.0.0.1:${g.pub}/ws`);
  await wait(host, 'hello');
  host.ws.send(JSON.stringify({ event: 'create', data: { name: 'H', kind: 0 } }));
  const room = await wait(host, 'room');
  const prox = await open(`ws://127.0.0.1:${b2.pub}/ws`);
  await wait(prox, 'hello');
  prox.ws.send(JSON.stringify({ event: 'join', data: { code: room.code, name: 'J', kind: 0 } }));
  await wait(prox, 'room');
  await Promise.all([v2, v1, gv2].map((c) => wait(c, 'hello')));
  const socks = { 'v2@blue': v2, 'v1@blue': v1, 'v2@green': gv2, 'v1 proxied blue->green': prox, 'v1 room host@green': host };
  await sleep(300);
  for (const c of Object.values(socks)) c.pings = 0;
  const t0 = Date.now();
  console.log(`counting pings for ${SECONDS}s at WS_PING_MS=${PING_MS} ...`);
  await sleep(SECONDS * 1000);
  const el = (Date.now() - t0) / 1000;
  const exp = el * 1000 / PING_MS;
  for (const [n, c] of Object.entries(socks)) {
    check(c.ws.readyState === 1 && c.pings >= exp - 2 && c.pings <= exp + 2,
      `${n}: ${c.pings} pings in ${el.toFixed(1)}s (expected ~${Math.round(exp)}, double would be ~${Math.round(exp * 2)})`);
  }
  for (const c of Object.values(socks)) { try { c.ws.close(); } catch { /* ignore */ } }
} finally {
  for (const s of all) { try { s.child.kill('SIGKILL'); } catch { /* ignore */ } }
  try { g.child.kill('SIGKILL'); } catch { /* ignore */ }
}
console.log(failures ? `\n${failures} FAILURE(S)` : '\nALL PING-COUNT CHECKS PASSED');
process.exit(failures ? 1 : 0);
