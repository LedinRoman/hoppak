import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const WebSocket = require('ws');

const __dirname = dirname(fileURLToPath(import.meta.url));
const SERVER_DIR = join(__dirname, '..');
const MAIN_JS = join(SERVER_DIR, 'dist', 'main.js');

import net from 'node:net';
const freePort = () => new Promise((res, rej) => {
  const srv = net.createServer();
  srv.listen(0, '127.0.0.1', () => { const { port } = srv.address(); srv.close(() => res(port)); });
  srv.on('error', rej);
});
const BLUE_PUB = Number(process.env.BLUE_PUB || await freePort());
const BLUE_INT = Number(process.env.BLUE_INT || await freePort());
const GREEN_PUB = Number(process.env.GREEN_PUB || await freePort());
const GREEN_INT = Number(process.env.GREEN_INT || await freePort());

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let failures = 0;
function check(ok, msg) {
  console.log((ok ? 'PASS ' : 'FAIL ') + msg);
  if (!ok) failures++;
}

function startSlot({ name, pubPort, intPort, version, peerIntPort, extraEnv = {} }) {
  const logs = [];
  const child = spawn(process.execPath, [MAIN_JS], {
    cwd: SERVER_DIR,
    env: {
      ...process.env,
      NODE_ENV: 'production',
      PORT: String(pubPort),
      INTERNAL_PORT: String(intPort),
      NODE_NAME: name,
      APP_VERSION: version,
      PEER_INTERNAL_URL: `http://127.0.0.1:${peerIntPort}`,
      PEER_TIMEOUT_MS: '800',
      ...extraEnv,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (d) => logs.push(d.toString()));
  child.stderr.on('data', (d) => logs.push(d.toString()));
  return { name, pubPort, intPort, version, child, logs };
}

async function waitReady(slot) {
  const t0 = Date.now();
  while (Date.now() - t0 < 10000) {
    try {
      const [h, s] = await Promise.all([
        fetch(`http://127.0.0.1:${slot.pubPort}/api/health`),
        fetch(`http://127.0.0.1:${slot.intPort}/internal/stats`),
      ]);
      if (h.ok && s.ok) return;
    } catch {
      /* retry */
    }
    await sleep(100);
  }
  throw new Error(`Slot ${slot.name} failed to start:\n${slot.logs.join('')}`);
}

function openWs(url, name) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    const c = {
      name,
      ws,
      inbox: [],
      closed: null,
      send(event, data = {}) {
        ws.send(JSON.stringify({ event, data }));
      },
      async wait(event, pred = () => true, ms = 3000) {
        const t0 = Date.now();
        while (Date.now() - t0 < ms) {
          const idx = c.inbox.findIndex((m) => m.event === event && pred(m.data));
          if (idx >= 0) return c.inbox.splice(idx, 1)[0].data;
          await sleep(10);
        }
        return null;
      },
      async waitClose(ms = 3000) {
        if (c.closed) return c.closed;
        const t0 = Date.now();
        while (Date.now() - t0 < ms) {
          if (c.closed) return c.closed;
          await sleep(10);
        }
        return null;
      },
    };
    ws.on('message', (raw) => {
      c.inbox.push(JSON.parse(raw.toString()));
    });
    ws.on('close', (code, reason) => {
      c.closed = { code, reason: reason.toString() };
    });
    ws.once('open', () => resolve(c));
    ws.once('error', reject);
  });
}

const sockets = [];
const track = (c) => {
  sockets.push(c);
  return c;
};

const blue = startSlot({
  name: 'blue',
  pubPort: BLUE_PUB,
  intPort: BLUE_INT,
  version: '0.57.0',
  peerIntPort: GREEN_INT,
  extraEnv: { DRAIN_LOBBY_TTL_MS: '3500', DRAIN_RESULTS_CLOSE_MS: '800' },
});
const green = startSlot({
  name: 'green',
  pubPort: GREEN_PUB,
  intPort: GREEN_INT,
  version: '0.58.0',
  peerIntPort: BLUE_INT,
});

try {
  await Promise.all([waitReady(blue), waitReady(green)]);
  console.log(`Both slots ready: blue (:${BLUE_PUB}/:${BLUE_INT}) & green (:${GREEN_PUB}/:${GREEN_INT})`);

  // 1. /api/health & public vs internal isolation
  const hBlue = await (await fetch(`http://127.0.0.1:${BLUE_PUB}/api/health`)).json();
  const hGreen = await (await fetch(`http://127.0.0.1:${GREEN_PUB}/api/health`)).json();
  check(
    hBlue.ok === true && hBlue.version === '0.57.0' && hBlue.protocol === 2 && hBlue.minProtocol === 1 && hBlue.node === 'blue',
    `blue /api/health returns version/protocol/minProtocol/node (${JSON.stringify({ version: hBlue.version, protocol: hBlue.protocol, minProtocol: hBlue.minProtocol, node: hBlue.node })})`
  );
  check(
    hGreen.ok === true && hGreen.version === '0.58.0' && hGreen.protocol === 2 && hGreen.minProtocol === 1 && hGreen.node === 'green',
    `green /api/health returns version/protocol/minProtocol/node`
  );

  const pubIntStats = await fetch(`http://127.0.0.1:${BLUE_PUB}/internal/stats`);
  const pubIntDrain = await fetch(`http://127.0.0.1:${BLUE_PUB}/internal/drain`, { method: 'POST' });
  const pubIntRoom = await fetch(`http://127.0.0.1:${GREEN_PUB}/internal/rooms/1234`);
  check(
    pubIntStats.status === 404 && pubIntDrain.status === 404 && pubIntRoom.status === 404,
    `public ports return 404 for /internal/* (${pubIntStats.status}, ${pubIntDrain.status}, ${pubIntRoom.status})`
  );

  // 2. Protocol negotiation (v1 default, v1 explicit, v2, unsupported)
  const a1 = track(await openWs(`ws://127.0.0.1:${BLUE_PUB}/ws`, 'A_v1'));
  const helloA1 = await a1.wait('hello');
  check(helloA1 && helloA1.v === 1 && helloA1.node === 'blue' && typeof helloA1.s === 'number', `v0.56/v0.57 default /ws receives hello v:1, node:'blue'`);

  const b1 = track(await openWs(`ws://127.0.0.1:${BLUE_PUB}/ws?p=1`, 'B_v1'));
  const helloB1 = await b1.wait('hello');
  check(helloB1 && helloB1.v === 1 && helloB1.node === 'blue', `/ws?p=1 receives hello v:1, node:'blue'`);

  const c2Menu = track(await openWs(`ws://127.0.0.1:${BLUE_PUB}/ws?p=2`, 'C_v2_menu'));
  const helloC2 = await c2Menu.wait('hello');
  check(helloC2 && helloC2.v === 2 && helloC2.node === 'blue' && helloC2.version === '0.57.0', `/ws?p=2 receives hello v:2, node:'blue', version:'0.57.0'`);

  const badOld = track(await openWs(`ws://127.0.0.1:${BLUE_PUB}/ws?p=0`, 'Bad_p0'));
  const errOld = await badOld.wait('err');
  const closeOld = await badOld.waitClose();
  check(
    errOld?.code === 'UNSUPPORTED_PROTOCOL' && /обновитесь/i.test(errOld?.msg || '') && closeOld?.code === 4002,
    `?p=0 rejected with UNSUPPORTED_PROTOCOL ("${errOld?.msg}") and close 4002`
  );

  const badStr = track(await openWs(`ws://127.0.0.1:${BLUE_PUB}/ws?p=abc`, 'Bad_pabc'));
  const errStr = await badStr.wait('err');
  const closeStr = await badStr.waitClose();
  check(
    errStr?.code === 'UNSUPPORTED_PROTOCOL' && closeStr?.code === 4002,
    `?p=abc rejected with UNSUPPORTED_PROTOCOL and close 4002`
  );

  const badFuture = track(await openWs(`ws://127.0.0.1:${GREEN_PUB}/ws?p=99`, 'Bad_p99'));
  const errFuture = await badFuture.wait('err');
  const closeFuture = await badFuture.waitClose();
  check(
    errFuture?.code === 'UNSUPPORTED_PROTOCOL' && closeFuture?.code === 4002,
    `?p=99 rejected with UNSUPPORTED_PROTOCOL and close 4002`
  );

  // 3. Match running on blue (v0.56 protocol v1 clients), plus second v2 lobby room on blue
  a1.send('create', { name: 'OldA', kind: 'human' });
  const rA1 = await a1.wait('room');
  const code1 = rA1?.code;
  check(!!code1 && /^\d{4}$/.test(code1), `v1 client created room ${code1} on blue`);

  b1.send('join', { code: code1, name: 'OldB', kind: 1 });
  const rB1 = await b1.wait('room');
  await a1.wait('room', (r) => r.players.length === 2);
  check(rB1?.players?.length === 2, `v1 client B joined room ${code1} on blue`);

  const d2 = track(await openWs(`ws://127.0.0.1:${BLUE_PUB}/ws?p=2`, 'D_v2'));
  await d2.wait('hello');
  d2.send('create', { name: 'HostV2', kind: 0 });
  const rD2 = await d2.wait('room');
  const code2 = rD2?.code;
  check(!!code2 && code2 !== code1, `v2 client created lobby room ${code2} on blue`);

  const statsPreDrain = await (await fetch(`http://127.0.0.1:${BLUE_INT}/internal/stats`)).json();
  check(
    statsPreDrain.rooms === 2 && statsPreDrain.players === 3 && statsPreDrain.draining === false && statsPreDrain.node === 'blue',
    `blue /internal/stats before drain: rooms=${statsPreDrain.rooms}, players=${statsPreDrain.players}, draining=${statsPreDrain.draining}`
  );

  const roomCheck = await (await fetch(`http://127.0.0.1:${BLUE_INT}/internal/rooms/${code1}`)).json();
  const roomMissing = await fetch(`http://127.0.0.1:${BLUE_INT}/internal/rooms/0000`);
  check(roomCheck.exists === true && roomCheck.node === 'blue' && roomMissing.status === 404, `internal room check: ${code1}->200, 0000->404`);

  // Start the match in room 1 (v1 clients)
  b1.send('ready', { ready: true });
  await sleep(50);
  a1.send('start', {});
  const [stA, stB] = await Promise.all([a1.wait('start'), b1.wait('start')]);
  check(stA && stB && stA.seed === stB.seed && stA.lw === 180, `v1 match started on blue (seed=${stA?.seed})`);

  // 4. Drain blue -> v2 clients get {event:'update', data:{version:'0.58.0'}}, v1 clients do NOT
  const drainRes = await (await fetch(`http://127.0.0.1:${BLUE_INT}/internal/drain`, { method: 'POST' })).json();
  check(
    drainRes.ok === true && drainRes.draining === true && drainRes.updateVersion === '0.58.0' && drainRes.notified >= 2,
    `POST /internal/drain on blue -> draining=true, updateVersion=0.58.0, notified=${drainRes.notified}`
  );

  const [updMenu, updD2] = await Promise.all([c2Menu.wait('update'), d2.wait('update')]);
  await sleep(100);
  const updV1 = a1.inbox.find((m) => m.event === 'update') || b1.inbox.find((m) => m.event === 'update');
  check(updMenu?.version === '0.58.0' && updD2?.version === '0.58.0' && !updV1, `v2 clients received update(0.58.0); v1 clients did not`);

  // 5. Creating room after drain
  c2Menu.send('create', { name: 'MenuV2', kind: 0 });
  const redirCreate = await c2Menu.wait('redirect');
  check(redirCreate?.node === 'green' && redirCreate?.reason === 'draining', `create on draining blue -> v2 client redirected to green`);

  const v1Menu = track(await openWs(`ws://127.0.0.1:${BLUE_PUB}/ws`, 'V1_menu'));
  await v1Menu.wait('hello');
  v1Menu.send('create', { name: 'MenuV1', kind: 0 });
  const errDrainV1 = await v1Menu.wait('err');
  check(errDrainV1?.code === 'DRAINING', `create on draining blue -> v1 client gets err DRAINING ("${errDrainV1?.msg}")`);

  // Create new room on green (active slot)
  const g2 = track(await openWs(`ws://127.0.0.1:${GREEN_PUB}/ws?p=2`, 'G_v2'));
  await g2.wait('hello');
  g2.send('create', { name: 'GreenHost', kind: 2 });
  const rG2 = await g2.wait('room');
  check(!!rG2?.code, `new room ${rG2?.code} created on green after blue drained`);

  // Also check POST /internal/announce-update on green
  const annRes = await (await fetch(`http://127.0.0.1:${GREEN_INT}/internal/announce-update`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ version: '0.58.1' }),
  })).json();
  const updG2 = await g2.wait('update');
  check(annRes.ok && annRes.notified >= 1 && updG2?.version === '0.58.1', `POST /internal/announce-update pushes update(0.58.1) to green's v2 client`);

  // 6. Join blue's room via green -> redirect for v2, WRONG_NODE for v1, and joining existing room on draining blue still works
  const f2 = track(await openWs(`ws://127.0.0.1:${GREEN_PUB}/ws?p=2`, 'F_v2'));
  await f2.wait('hello');
  f2.send('join', { code: code2, name: 'JoinerV2', kind: 1 });
  const redirJoin = await f2.wait('redirect');
  check(redirJoin?.node === 'blue' && redirJoin?.code === code2, `join ${code2} on green -> v2 client gets redirect to blue`);

  const f2Blue = track(await openWs(`ws://127.0.0.1:${BLUE_PUB}/ws?p=2`, 'F_v2_blue'));
  await f2Blue.wait('hello');
  const updOnReconnect = await f2Blue.wait('update');
  f2Blue.send('join', { code: code2, name: 'JoinerV2', kind: 1 });
  const rF2Blue = await f2Blue.wait('room');
  check(rF2Blue?.code === code2 && rF2Blue?.players?.length === 2 && updOnReconnect?.version === '0.58.0', `v2 client followed redirect to blue, joined existing room ${code2} while draining, and got update notice`);

  // BUG-29: v1 client joins blue's room via green (transparently proxied)
  const f1Green = track(await openWs(`ws://127.0.0.1:${GREEN_PUB}/ws`, 'F_v1_green'));
  await f1Green.wait('hello');
  f1Green.send('join', { code: code2, name: 'JoinerV1', kind: 1 });
  const rF1Proxied = await f1Green.wait('room');
  check(rF1Proxied?.code === code2 && rF1Proxied?.players?.length === 3, `BUG-29: v1 join ${code2} via green transparently proxied to blue (players=${rF1Proxied?.players?.length})`);
  f1Green.send('leave');
  await d2.wait('room', (r) => r.players.length === 2);

  f2.send('join', { code: '0000', name: 'Missing', kind: 0 });
  const errNotFound = await f2.wait('err');
  check(errNotFound?.code === 'NOT_FOUND', `join nonexistent 0000 on green -> NOT_FOUND`);

  // 7. Match on draining blue continues (state snap + events) and finishes cleanly
  a1.send('st', { x: 50, y: -120, vx: 0, vy: -3, f: 1, a: 1, m: 120, ps: 0 });
  b1.send('st', { x: 80, y: -180, vx: 0, vy: -4, f: -1, a: 1, m: 180, ps: 0 });
  const snapA = await a1.wait('snap');
  check(Array.isArray(snapA?.s) && snapA.s.length >= 1, `match on draining blue still relays 20Hz state snapshots`);

  a1.send('ev', { e: 'mob', id: 'slime:40:-100' });
  const mobB = await b1.wait('ev', (e) => e.e === 'mob');
  check(mobB?.id === 'slime:40:-100', `match on draining blue relays mob events`);

  // BUG-24: v1 client B drops during drain and reconnects via green (/ws -> active slot)
  const b1Token = rB1.token;
  b1.ws.terminate();
  await a1.wait('room', (r) => r.players.some((p) => !p.on));
  const b1Re = track(await openWs(`ws://127.0.0.1:${GREEN_PUB}/ws`, 'B_v1_re'));
  await b1Re.wait('hello');
  b1Re.send('resume', { token: b1Token });
  const b1ReRoom = await b1Re.wait('room');
  const b1ReStart = await b1Re.wait('start');
  check(b1ReRoom?.code === code1 && b1ReStart?.resumed === true && b1ReStart?.seed === stA.seed, `BUG-24: v1 resume via green recovered seat and running match on draining blue`);
  b1Re.send('st', { x: 82, y: -180, vx: 0, vy: -3, f: 1, a: 1, m: 180, ps: 0 });
  await a1.wait('snap');

  // BUG-24: v2 client also recovers via green if it hits /ws with resume
  const d2Token = rD2.token;
  d2.ws.terminate();
  await f2Blue.wait('room', (r) => r.players.some((p) => !p.on));
  const d2Re = track(await openWs(`ws://127.0.0.1:${GREEN_PUB}/ws?p=2`, 'D_v2_re'));
  await d2Re.wait('hello');
  d2Re.send('resume', { token: d2Token });
  const d2ReRoom = await d2Re.wait('room');
  check(d2ReRoom?.code === code2 && d2ReRoom?.you === rD2.you, `BUG-24: v2 resume via green recovered seat on draining blue`);
  d2Re.send('leave');

  a1.send('ev', { e: 'dead', m: 15 });
  b1Re.send('ev', { e: 'dead', m: 23 });
  const [resA, resB] = await Promise.all([a1.wait('results'), b1Re.wait('results')]);
  const lobA = await a1.wait('room', (r) => r.phase === 'lobby');
  check(resA && resB && resA.ranking[0].m === 23 && !!lobA, `match on draining blue finished cleanly (winner m=23) and returned to lobby`);

  // BUG-25: rematch on draining blue must be blocked (no round 2)
  b1Re.send('ready', { ready: true });
  await sleep(30);
  a1.send('start', {});
  const errRematch = await a1.wait('err');
  check(errRematch?.code === 'DRAINING', `BUG-25: rematch start on draining blue blocked (${errRematch?.code})`);

  // BUG-25: drain completes to 0 rooms WITHOUT clients sending leave!
  let statsEnd = null;
  const tDrain = Date.now();
  while (Date.now() - tDrain < 6000) {
    statsEnd = await (await fetch(`http://127.0.0.1:${BLUE_INT}/internal/stats`)).json();
    if (statsEnd.rooms === 0) break;
    await sleep(150);
  }
  check(statsEnd && statsEnd.rooms === 0 && statsEnd.players === 0 && statsEnd.draining === true,
    `BUG-25: blue auto-drained to 0 rooms/0 players without client leave (in ${Date.now() - tDrain}ms)`);
  g2.send('leave');

  // 8. BUG-25 Graceful SIGTERM tests (timeout force-finish + natural finish before timeout)
  const sigPub1 = await freePort(), sigInt1 = await freePort();
  const sig1 = startSlot({ name: 'blue', pubPort: sigPub1, intPort: sigInt1, version: '0.57.0', peerIntPort: GREEN_INT, extraEnv: { GRACEFUL_SHUTDOWN_MS: '1200' } });
  const sig1Exit = new Promise((res) => sig1.child.once('exit', (code) => res(code)));
  await waitReady(sig1);
  const s1a = track(await openWs(`ws://127.0.0.1:${sigPub1}/ws`, 'sig1a')); await s1a.wait('hello');
  const s1b = track(await openWs(`ws://127.0.0.1:${sigPub1}/ws`, 'sig1b')); await s1b.wait('hello');
  s1a.send('create', { name: 'SA', kind: 0 });
  const sr1 = await s1a.wait('room');
  s1b.send('join', { code: sr1.code, name: 'SB', kind: 1 });
  await s1b.wait('room');
  s1b.send('ready', { ready: true }); await sleep(40);
  s1a.send('start', {});
  await Promise.all([s1a.wait('start'), s1b.wait('start')]);
  s1a.send('st', { x: 50, y: -160, vx: 0, vy: -3, f: 1, a: 1, m: 160, ps: 0 });
  await s1a.wait('snap');
  const tSig1 = Date.now();
  sig1.child.kill('SIGTERM');
  const [sigRes1, sigCode1] = await Promise.all([s1a.wait('results', () => true, 4000), sig1Exit]);
  const sig1Ms = Date.now() - tSig1;
  check(sigCode1 === 0 && sigRes1?.ranking?.[0]?.m === 20 && sig1Ms >= 1000,
    `BUG-25: SIGTERM force-finished match at timeout (${sig1Ms}ms), sent results (m=20), exited 0`);

  const sigPub2 = await freePort(), sigInt2 = await freePort();
  const sig2 = startSlot({ name: 'blue', pubPort: sigPub2, intPort: sigInt2, version: '0.57.0', peerIntPort: GREEN_INT, extraEnv: { GRACEFUL_SHUTDOWN_MS: '6000' } });
  const sig2Exit = new Promise((res) => sig2.child.once('exit', (code) => res(code)));
  await waitReady(sig2);
  const s2a = track(await openWs(`ws://127.0.0.1:${sigPub2}/ws`, 'sig2a')); await s2a.wait('hello');
  const s2b = track(await openWs(`ws://127.0.0.1:${sigPub2}/ws`, 'sig2b')); await s2b.wait('hello');
  s2a.send('create', { name: 'S2A', kind: 0 });
  const sr2 = await s2a.wait('room');
  s2b.send('join', { code: sr2.code, name: 'S2B', kind: 1 });
  await s2b.wait('room');
  s2b.send('ready', { ready: true }); await sleep(40);
  s2a.send('start', {});
  await Promise.all([s2a.wait('start'), s2b.wait('start')]);
  const tSig2 = Date.now();
  sig2.child.kill('SIGTERM');
  await sleep(250);
  s2a.send('ev', { e: 'dead', m: 12 });
  s2b.send('ev', { e: 'dead', m: 31 });
  const [sigRes2, sigCode2] = await Promise.all([s2a.wait('results', () => true, 4000), sig2Exit]);
  const sig2Ms = Date.now() - tSig2;
  check(sigCode2 === 0 && sigRes2?.ranking?.[0]?.m === 31 && sig2Ms < 2500,
    `BUG-25: SIGTERM let running match finish naturally (${sig2Ms}ms < 6000ms), sent results (m=31), exited 0`);

  // 9. Undrain rollback test
  const undrainRes = await (await fetch(`http://127.0.0.1:${BLUE_INT}/internal/undrain`, { method: 'POST' })).json();
  check(undrainRes.ok && undrainRes.draining === false, `POST /internal/undrain resets draining=false on blue`);

  console.log(failures ? `\n${failures} FAILURE(S)` : '\nALL BLUE-GREEN SMOKE CHECKS PASSED');
  process.exitCode = failures ? 1 : 0;
} finally {
  for (const c of sockets) {
    try { c.ws.close(); } catch {}
  }
  blue.child.kill('SIGTERM');
  green.child.kill('SIGTERM');
  await sleep(250);
}
