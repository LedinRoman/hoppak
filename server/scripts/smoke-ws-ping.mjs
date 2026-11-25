/* BUG-50 hotfix: server-side ws.ping() keepalive on the prod (2e6bfc0) server.
   Usage:
     node scripts/smoke-ws-ping.mjs          # fast intervals via env
     node scripts/smoke-ws-ping.mjs --long   # ~11 min idle socket at default 25s
*/
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import net from 'node:net';
import { writeSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SERVER_DIR = join(__dirname, '..');
const MAIN_JS = join(SERVER_DIR, 'dist', 'main.js');
const require = createRequire(import.meta.url);
const WebSocketPkg = require(join(SERVER_DIR, 'node_modules', 'ws'));
const WebSocket = WebSocketPkg.WebSocket || WebSocketPkg;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
const log = (...a) => writeSync(1, a.map(String).join(' ') + '\n');
const check = (ok, msg) => { log((ok ? 'PASS ' : 'FAIL ') + msg); if (!ok) failures++; };

function freePort() {
  return new Promise((res, rej) => {
    const s = net.createServer();
    s.unref();
    s.on('error', rej);
    s.listen(0, '127.0.0.1', () => {
      const { port } = s.address();
      s.close(() => res(port));
    });
  });
}

function startServer(port, extraEnv = {}) {
  const logs = [];
  const child = spawn(process.execPath, [MAIN_JS], {
    cwd: SERVER_DIR,
    env: {
      ...process.env,
      PORT: String(port),
      PUBLIC_DIR: '/tmp/hoppak-hotfix-ping-empty-pub',
      ...extraEnv,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (d) => logs.push(d.toString()));
  child.stderr.on('data', (d) => logs.push(d.toString()));
  return { child, logs, port };
}

async function waitHealth(port, ms = 10000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/api/health`);
      if (r.ok) return;
    } catch { /* retry */ }
    await sleep(80);
  }
  throw new Error(`server on ${port} failed to start`);
}

function killPid(child) {
  if (!child || child.killed || child.exitCode != null) return;
  try { process.kill(child.pid, 'SIGTERM'); } catch { /* ignore */ }
}

const long = process.argv.includes('--long');

async function runFast() {
  const port = await freePort();
  const srv = startServer(port, { WS_PING_MS: '60', WS_PONG_TIMEOUT_MS: '180' });
  try {
    await waitHealth(port);

    const idle = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    let idlePings = 0;
    let idleClose = null;
    idle.on('ping', () => { idlePings++; });
    idle.on('close', (code) => { idleClose = code; });
    const idleHello = new Promise((res) => idle.once('message', res));
    await new Promise((res, rej) => { idle.once('open', res); idle.once('error', rej); });
    await idleHello; // hello only; no further app frames

    const silent = new WebSocket(`ws://127.0.0.1:${port}/ws`, { autoPong: false });
    let silentPings = 0;
    const silentClosed = new Promise((res) => silent.once('close', (code) => res(code)));
    silent.on('ping', () => { silentPings++; });
    const silentHello = new Promise((res) => silent.once('message', res));
    await new Promise((res, rej) => { silent.once('open', res); silent.once('error', rej); });
    await Promise.race([silentHello, sleep(1000)]);

    await sleep(500);
    const sc = await Promise.race([silentClosed, sleep(1000).then(() => 'still-open')]);
    check(
      idle.readyState === 1 && idleClose === null && idlePings >= 4,
      `idle socket survived 500ms (>2x pong timeout) with ws.ping() (pings=${idlePings}, close=${idleClose}, state=${idle.readyState})`,
    );
    check(
      sc === 1006 && silentPings >= 2,
      `silent socket (no pong) terminated (close=${sc}, pings=${silentPings})`,
    );
    try { idle.close(); } catch { /* ignore */ }
    try { silent.terminate(); } catch { /* ignore */ }
  } finally {
    killPid(srv.child);
    await sleep(250);
    if (srv.child.exitCode == null && !srv.child.killed) {
      try { process.kill(srv.child.pid, 'SIGKILL'); } catch { /* ignore */ }
    }
  }
}

async function runLong() {
  const port = await freePort();
  const durationMs = 11 * 60 * 1000;
  const srv = startServer(port); // default WS_PING_MS=25000, WS_PONG_TIMEOUT_MS=60000
  try {
    await waitHealth(port);
    const idle = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    let pings = 0;
    let closeCode = null;
    const t0 = Date.now();
    idle.on('ping', () => { pings++; });
    idle.on('close', (code) => { closeCode = code; });
    const hello = new Promise((res) => idle.once('message', res));
    await new Promise((res, rej) => { idle.once('open', res); idle.once('error', rej); });
    await hello; // hello only; no further app frames
    log(`long idle started at ${new Date().toISOString()} on :${port}, waiting ${durationMs}ms`);
    const tick = setInterval(() => {
      const s = Math.round((Date.now() - t0) / 1000);
      log(`  ${s}s elapsed, pings=${pings}, readyState=${idle.readyState}, close=${closeCode}`);
    }, 60_000);
    tick.unref();
    await sleep(durationMs);
    clearInterval(tick);
    const elapsed = Date.now() - t0;
    check(
      idle.readyState === 1 && closeCode === null && pings >= 24,
      `idle socket stayed open ${Math.round(elapsed / 1000)}s at default 25s ping (pings=${pings}, close=${closeCode}, state=${idle.readyState})`,
    );
    try { idle.close(); } catch { /* ignore */ }
  } finally {
    killPid(srv.child);
    await sleep(250);
    if (srv.child.exitCode == null && !srv.child.killed) {
      try { process.kill(srv.child.pid, 'SIGKILL'); } catch { /* ignore */ }
    }
  }
}

try {
  if (long) await runLong();
  else await runFast();
  log(failures ? `\n${failures} FAILURE(S)` : '\nALL WS-PING CHECKS PASSED');
  process.exit(failures ? 1 : 0);
} catch (e) {
  log(String(e && e.stack || e));
  process.exit(2);
}
