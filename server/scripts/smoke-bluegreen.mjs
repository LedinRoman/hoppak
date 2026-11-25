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
const INTERNAL_TOKEN = process.env.INTERNAL_TOKEN || 'smoke-secret-token';
const INT_HEADERS = { 'x-internal-token': INTERNAL_TOKEN };

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
      INTERNAL_HOST: '127.0.0.1',
      INTERNAL_TOKEN,
      ...extraEnv,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (d) => logs.push(d.toString()));
  child.stderr.on('data', (d) => logs.push(d.toString()));
  return { name, pubPort, intPort, version, child, logs };
}

/** Spawn a server that is expected to exit on its own; collect its output. */
function runToExit(env, ms = 8000) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [MAIN_JS], { cwd: SERVER_DIR, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { out += d; });
    const t = setTimeout(() => { child.kill('SIGKILL'); resolve({ code: 'timeout', out }); }, ms);
    child.once('exit', (code) => { clearTimeout(t); resolve({ code, out }); });
  });
}

async function waitHealth(port, ms = 8000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    try { const h = await fetch(`http://127.0.0.1:${port}/api/health`); if (h.ok) return await h.json(); } catch {}
    await sleep(80);
  }
  return null;
}

async function waitReady(slot) {
  const t0 = Date.now();
  while (Date.now() - t0 < 10000) {
    try {
      const [h, s] = await Promise.all([
        fetch(`http://127.0.0.1:${slot.pubPort}/api/health`),
        fetch(`http://127.0.0.1:${slot.intPort}/internal/stats`, { headers: INT_HEADERS }),
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
      all: [],
      token: null,
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
      const m = JSON.parse(raw.toString());
      if (m.event === 'room' && m.data?.token) c.token = m.data.token;
      c.all.push(m);
      c.inbox.push(m);
    });
    ws.on('close', (code, reason) => {
      c.closed = { code, reason: reason.toString() };
    });
    ws.once('open', () => resolve(c));
    ws.once('error', reject);
  });
}

const qTokenOf = (c) => c.token;
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
  check(helloC2 && helloC2.v === 2 && helloC2.node === 'blue' && helloC2.version === '0.57.0' && helloC2.field?.w === 160 && helloC2.field?.h === 346 && helloC2.field?.pxPerM === 8, `/ws?p=2 receives hello v:2, node:'blue', version:'0.57.0', field=${JSON.stringify(helloC2?.field)}`);

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
  check(!!code1 && /^\d{4}$/.test(code1) && rA1.lw === 180, `v1 client created room ${code1} on blue with lw=180`);

  b1.send('join', { code: code1, name: 'OldB', kind: 1 });
  const rB1 = await b1.wait('room');
  await a1.wait('room', (r) => r.players.length === 2);
  check(rB1?.players?.length === 2, `v1 client B joined room ${code1} on blue`);

  const d2 = track(await openWs(`ws://127.0.0.1:${BLUE_PUB}/ws?p=2`, 'D_v2'));
  await d2.wait('hello');
  d2.send('create', { name: 'HostV2', kind: 0 });
  const rD2 = await d2.wait('room');
  const code2 = rD2?.code;
  check(!!code2 && code2 !== code1 && rD2.lw === 160 && rD2.field?.w === 160 && rD2.field?.h === 346 && rD2.field?.pxPerM === 8, `v2 client created lobby room ${code2} on blue with lw=160, field=${JSON.stringify(rD2.field)}`);

  // Second v1 lobby room on blue to test BUG-29 (v1->v1 cross-slot join) & mixed-protocol checks
  const v1Host2 = track(await openWs(`ws://127.0.0.1:${BLUE_PUB}/ws`, 'V1_host2'));
  await v1Host2.wait('hello');
  v1Host2.send('create', { name: 'V1H2', kind: 0 });
  const rV1H2 = await v1Host2.wait('room');
  const codeV1Lobby = rV1H2?.code;
  check(!!codeV1Lobby && rV1H2.lw === 180, `v1 lobby room ${codeV1Lobby} created on blue with lw=180`);

  // Local mixed-protocol checks (both directions)
  v1Host2.send('join', { code: code2, name: 'Mix12', kind: 0 });
  const mixLocal12 = await v1Host2.wait('err');
  check(
    mixLocal12?.code === 'PROTOCOL_MISMATCH' && mixLocal12?.msg === 'Другая версия. Обновите!' && mixLocal12.msg.length <= 24,
    `local v1 join into v2 room rejected with v1-safe message ("${mixLocal12?.msg}")`,
  );
  c2Menu.send('join', { code: codeV1Lobby, name: 'Mix21', kind: 0 });
  const mixLocal21Pre = await c2Menu.wait('err');
  check(
    mixLocal21Pre?.code === 'PROTOCOL_MISMATCH' && mixLocal21Pre?.msg === 'У друга другая версия игры — обновите страницу',
    `local v2 join into v1 room rejected with v2 message ("${mixLocal21Pre?.msg}")`,
  );

  const statsPreDrain = await (await fetch(`http://127.0.0.1:${BLUE_INT}/internal/stats`, { headers: INT_HEADERS })).json();
  check(
    statsPreDrain.rooms === 3 && statsPreDrain.players === 4 && statsPreDrain.draining === false && statsPreDrain.node === 'blue',
    `blue /internal/stats before drain: rooms=${statsPreDrain.rooms}, players=${statsPreDrain.players}, draining=${statsPreDrain.draining}`
  );

  const roomCheck = await (await fetch(`http://127.0.0.1:${BLUE_INT}/internal/rooms/${code1}`, { headers: INT_HEADERS })).json();
  const roomMissing = await fetch(`http://127.0.0.1:${BLUE_INT}/internal/rooms/0000`, { headers: INT_HEADERS });
  check(roomCheck.exists === true && roomCheck.node === 'blue' && roomMissing.status === 404, `internal room check: ${code1}->200, 0000->404`);

  // Start the match in room 1 (v1 clients)
  b1.send('ready', { ready: true });
  await sleep(50);
  a1.send('start', {});
  const [stA, stB] = await Promise.all([a1.wait('start'), b1.wait('start')]);
  check(stA && stB && stA.seed === stB.seed && stA.lw === 180, `v1 match started on blue (seed=${stA?.seed}, lw=180)`);

  // 4. Drain blue WITH version -> v2 clients get {event:'update', data:{version:'0.58.0'}}, v1 clients do NOT
  const drainRes = await (await fetch(`http://127.0.0.1:${BLUE_INT}/internal/drain`, {
    method: 'POST', headers: { ...INT_HEADERS, 'content-type': 'application/json' },
    body: JSON.stringify({ version: '0.58.0' }),
  })).json();
  check(
    drainRes.ok === true && drainRes.draining === true && drainRes.updateVersion === '0.58.0' && drainRes.notified >= 2,
    `POST /internal/drain on blue with version -> draining=true, updateVersion=0.58.0, notified=${drainRes.notified}`
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
  const v1MenuRoom = await v1Menu.wait('room');
  check(Number(v1MenuRoom?.code) >= 5500 && v1MenuRoom?.lw === 180 && !v1Menu.inbox.some((m) => m.event === 'err'),
    `BUG-43: v1 create on draining blue is proxied to green (room ${v1MenuRoom?.code}, lw=${v1MenuRoom?.lw}), no DRAINING`);
  v1Menu.send('leave');

  // Create new room on green (active slot)
  const g2 = track(await openWs(`ws://127.0.0.1:${GREEN_PUB}/ws?p=2`, 'G_v2'));
  await g2.wait('hello');
  g2.send('create', { name: 'GreenHost', kind: 2 });
  const rG2 = await g2.wait('room');
  check(!!rG2?.code && rG2.lw === 160, `new room ${rG2?.code} created on green after blue drained (lw=160)`);
  const g2b = track(await openWs(`ws://127.0.0.1:${GREEN_PUB}/ws?p=2`, 'G_v2_guest'));
  await g2b.wait('hello');
  g2b.send('join', { code: rG2.code, name: 'GGuest', kind: 1 });
  await g2b.wait('room');
  g2b.send('ready', { ready: true }); await sleep(40);
  g2.send('start', {});
  const gStart = await g2.wait('start');
  check(gStart && gStart.lw === 160, `v2 match start on green uses lw=160`);

  // Also check POST /internal/announce-update on green
  const annRes = await (await fetch(`http://127.0.0.1:${GREEN_INT}/internal/announce-update`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...INT_HEADERS },
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
  check(rF2Blue?.code === code2 && rF2Blue?.lw === 160 && rF2Blue?.players?.length === 2 && updOnReconnect?.version === '0.58.0', `v2 client followed redirect to blue, joined existing room ${code2} (lw=160) while draining, and got update notice`);

  // Mixed-protocol cross-slot checks (both directions)
  const mix1 = track(await openWs(`ws://127.0.0.1:${GREEN_PUB}/ws`, 'Mix_v1_to_v2'));
  await mix1.wait('hello');
  mix1.send('join', { code: code2, name: 'Mix1', kind: 0 });
  const mixCross12 = await mix1.wait('err');
  check(
    mixCross12?.code === 'PROTOCOL_MISMATCH' && mixCross12?.msg === 'Другая версия. Обновите!' && mixCross12.msg.length <= 24,
    `cross-slot v1 join into v2 room ${code2} rejected with v1-safe message ("${mixCross12?.msg}")`,
  );

  const mix2 = track(await openWs(`ws://127.0.0.1:${GREEN_PUB}/ws?p=2`, 'Mix_v2_to_v1'));
  await mix2.wait('hello');
  mix2.send('join', { code: codeV1Lobby, name: 'Mix2', kind: 0 });
  const redirMix2 = await mix2.wait('redirect');
  const mix2Blue = track(await openWs(`ws://127.0.0.1:${BLUE_PUB}/ws?p=2`, 'Mix_v2_to_v1_blue'));
  await mix2Blue.wait('hello');
  mix2Blue.send('join', { code: redirMix2.code, name: 'Mix2', kind: 0 });
  const mixCross21 = await mix2Blue.wait('err');
  check(
    mixCross21?.code === 'PROTOCOL_MISMATCH' && mixCross21?.msg === 'У друга другая версия игры — обновите страницу',
    `cross-slot v2 join into v1 room ${codeV1Lobby} rejected with full v2 message ("${mixCross21?.msg}")`,
  );

  // BUG-29: v1 client joins blue's v1 room via green (transparently proxied)
  const f1Green = track(await openWs(`ws://127.0.0.1:${GREEN_PUB}/ws`, 'F_v1_green'));
  await f1Green.wait('hello');
  f1Green.send('join', { code: codeV1Lobby, name: 'JoinerV1', kind: 1 });
  const rF1Proxied = await f1Green.wait('room');
  check(rF1Proxied?.code === codeV1Lobby && rF1Proxied?.lw === 180 && rF1Proxied?.players?.length === 2,
    `BUG-29: v1 join ${codeV1Lobby} via green transparently proxied to blue (lw=180, players=${rF1Proxied?.players?.length})`);
  f1Green.send('leave');
  await v1Host2.wait('room', (r) => r.players.length === 1);

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
  // the old client keeps sending its 15 Hz state while the blind resume is still in flight (BUG-36)
  b1Re.send('st', { x: 81, y: -180, vx: 0, vy: -3, f: 1, a: 1, m: 180, ps: 0 });
  b1Re.send('resume', { token: b1Token });
  b1Re.send('st', { x: 81, y: -181, vx: 0, vy: -3, f: 1, a: 1, m: 181, ps: 0 });
  const b1ReRoom = await b1Re.wait('room');
  const b1ReStart = await b1Re.wait('start');
  await sleep(150);
  check(!b1Re.all.some((m) => m.event === 'err'), `BUG-36: no err (NO_ROOM «Ты не в комнате») for state frames around a blind v1 resume`);
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

  // BUG-25 + BUG-32: a rematch on draining blue starts no round there; the whole room moves to green instead.
  const pidsBefore = lobA.players.map((p) => p.pid).sort().join(',');
  b1Re.send('ready', { ready: true });
  await sleep(30);
  a1.send('start', {});
  const movedA = await a1.wait('room', (r) => r.code !== code1, 4000);
  const startOnBlue = a1.inbox.some((m) => m.event === 'start');
  // b1Re fronts B through green -> blue; blue closes that tunnel so green closes B, which resumes blindly on green
  const b1ReClosed = await b1Re.waitClose(3000);
  const b1Again = track(await openWs(`ws://127.0.0.1:${GREEN_PUB}/ws`, 'B_v1_again'));
  await b1Again.wait('hello');
  b1Again.send('resume', { token: b1Token });
  const movedB = await b1Again.wait('room', () => true, 3000);
  check(!startOnBlue && Number(movedA?.code) >= 5500 && movedA?.code === movedB?.code && movedA?.round === 1 && movedA?.lw === 180 &&
    movedA.players.map((p) => p.pid).sort().join(',') === pidsBefore && movedA.host === lobA.host && movedB?.you === rB1.you && !!b1ReClosed,
    `BUG-25/32: rematch on draining blue moved v1 room ${code1} -> ${movedA?.code} on green (same pids/host/round, A proxied, B resumed after tunnel close ${b1ReClosed?.code})`);
  // rematch now really happens on green, through A's proxy on blue
  b1Again.send('ready', { ready: true });
  await a1.wait('room', (r) => r.players.every((p) => p.pid === r.host || p.ready));
  a1.send('start', {});
  const [reA, reB] = await Promise.all([a1.wait('start', () => true, 4000), b1Again.wait('start', () => true, 4000)]);
  check(reA?.round === 2 && reB?.round === 2 && reA?.seed === reB?.seed, `BUG-32: rematch round 2 runs on green for both v1 players (seed ${reA?.seed})`);
  a1.send('ev', { e: 'dead', m: 3 }); b1Again.send('ev', { e: 'dead', m: 4 });
  await Promise.all([a1.wait('results'), b1Again.wait('results')]);
  // BUG-44: A (still proxied blue->green) leaves and creates: the new room must not be stuck on draining blue
  a1.send('leave'); await sleep(50);
  a1.inbox.length = 0;
  a1.send('create', { name: 'OldA2', kind: 0 });
  const a1New = await a1.wait('room', (r) => r.code !== movedA?.code, 3000);
  check(Number(a1New?.code) >= 5500 && !a1.inbox.some((m) => m.event === 'err' && m.data?.code === 'DRAINING'),
    `BUG-44: after leave, v1 create from draining blue lands on green (${a1New?.code}), no DRAINING`);
  a1.send('leave'); b1Again.send('leave');

  // BUG-25: drain completes to 0 rooms WITHOUT clients sending leave!
  let statsEnd = null;
  const tDrain = Date.now();
  while (Date.now() - tDrain < 6000) {
    statsEnd = await (await fetch(`http://127.0.0.1:${BLUE_INT}/internal/stats`, { headers: INT_HEADERS })).json();
    if (statsEnd.rooms === 0) break;
    await sleep(150);
  }
  check(statsEnd && statsEnd.rooms === 0 && statsEnd.players === 0 && statsEnd.draining === true,
    `BUG-25: blue auto-drained to 0 rooms/0 players without client leave (in ${Date.now() - tDrain}ms)`);
  g2b.send('leave'); g2.send('leave');

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
  const undrainRes = await (await fetch(`http://127.0.0.1:${BLUE_INT}/internal/undrain`, { method: 'POST', headers: INT_HEADERS })).json();
  check(undrainRes.ok && undrainRes.draining === false, `POST /internal/undrain resets draining=false on blue`);

  // 9b. BUG-32: 4 x v2 on blue finish a round, blue drains -> the room moves to green as ONE room
  await sleep(200);
  const q = [];
  for (let i = 0; i < 4; i++) { q.push(track(await openWs(`ws://127.0.0.1:${BLUE_PUB}/ws?p=2`, `Q${i}`))); await q[i].wait('hello'); }
  q[0].send('create', { name: 'Q0', kind: 0 });
  const qRoom = await q[0].wait('room');
  for (let i = 1; i < 4; i++) { q[i].send('join', { code: qRoom.code, name: `Q${i}`, kind: i }); await q[i].wait('room'); }
  for (let i = 1; i < 4; i++) q[i].send('ready', { ready: true });
  await q[0].wait('room', (r) => r.players.length === 4 && r.players.every((p) => p.pid === r.host || p.ready));
  q[0].send('start', {});
  const qStarts = await Promise.all(q.map((c) => c.wait('start')));
  // drain blue mid-round, finish the round
  await fetch(`http://127.0.0.1:${BLUE_INT}/internal/drain`, { method: 'POST', headers: INT_HEADERS });
  q.forEach((c, i) => c.send('ev', { e: 'dead', m: 10 + i }));
  const qRes = await Promise.all(q.map((c) => c.wait('results', () => true, 3000)));
  check(qStarts.every((x) => x?.round === 1) && qRes.every((r) => r?.round === 1 && r.ranking.length === 4), `BUG-32: 4 v2 clients finished round 1 on draining blue`);
  // BUG-35: one client's socket blinks inside the results-close window and comes back to blue
  const q3Token = qTokenOf(q[3]);
  q[3].ws.terminate();
  const qRedirs = await Promise.all(q.slice(0, 3).map((c) => c.wait('redirect', () => true, 4000)));
  const newCode = qRedirs[0]?.code;
  check(qRedirs.every((r) => r?.node === 'green' && r?.resume === true && r?.code === newCode) && Number(newCode) >= 5500,
    `BUG-32: all 3 connected v2 clients got the SAME redirect {node:green, code:${newCode}, resume:true}`);
  const q3Back = track(await openWs(`ws://127.0.0.1:${BLUE_PUB}/ws?p=2`, 'Q3_back'));
  await q3Back.wait('hello');
  q3Back.send('resume', { token: q3Token });
  const q3Redir = await q3Back.wait('redirect', () => true, 3000);
  check(q3Redir?.node === 'green' && q3Redir?.code === newCode && q3Redir?.resume === true,
    `BUG-35: a client that reconnects to blue after the move gets redirect to ${newCode} (not NO_SESSION)`);
  // everybody resumes on green with their old token
  const qg = [];
  const allTokens = [...q.slice(0, 3).map((c) => qTokenOf(c)), q3Token];
  for (let i = 0; i < 4; i++) {
    const c = track(await openWs(`ws://127.0.0.1:${GREEN_PUB}/ws?p=2`, `QG${i}`));
    await c.wait('hello');
    c.send('resume', { token: allTokens[i] });
    qg.push(c);
  }
  const qgRooms = await Promise.all(qg.map((c) => c.wait('room', () => true, 3000)));
  const youSet = new Set(qgRooms.map((r) => r?.you));
  check(qgRooms.every((r) => r?.code === newCode && r?.round === 1 && r?.players?.length === 4 && r?.host === qRoom.host && r?.field?.w === 160) && youSet.size === 4,
    `BUG-32: 4/4 resumed into ONE room ${newCode} on green (same host, round 1, 4 distinct pids, field 160)`);
  for (let i = 1; i < 4; i++) qg[i].send('ready', { ready: true });
  const hostIdx = qgRooms.findIndex((r) => r.you === r.host);
  await qg[hostIdx].wait('room', (r) => r.players.every((p) => p.on && (p.pid === r.host || p.ready)), 3000);
  // make sure everybody (incl. the host) is ready-or-host
  qg.forEach((c, i) => { if (i !== hostIdx) c.send('ready', { ready: true }); });
  await sleep(80);
  qg[hostIdx].send('start', {});
  const qgStarts = await Promise.all(qg.map((c) => c.wait('start', () => true, 3000)));
  check(qgStarts.every((x) => x?.round === 2 && x?.seed === qgStarts[0].seed), `BUG-32: rematch on green = round 2 for all 4 (party kept, evening score continues)`);
  const blueAfter = await (await fetch(`http://127.0.0.1:${BLUE_INT}/internal/stats`, { headers: INT_HEADERS })).json();
  check(blueAfter.rooms === 0, `BUG-32: blue has 0 rooms after the move (${blueAfter.rooms})`);
  qg.forEach((c) => c.send('leave'));

  // 9c. BUG-32 lobby TTL: a v2 lobby on draining blue moves as one room too
  const l0 = track(await openWs(`ws://127.0.0.1:${BLUE_PUB}/ws?p=2`, 'L0'));
  const l1 = track(await openWs(`ws://127.0.0.1:${BLUE_PUB}/ws?p=2`, 'L1'));
  await Promise.all([l0.wait('hello'), l1.wait('hello')]);
  await fetch(`http://127.0.0.1:${BLUE_INT}/internal/undrain`, { method: 'POST', headers: INT_HEADERS });
  l0.send('create', { name: 'L0', kind: 0 });
  const lRoom = await l0.wait('room');
  l1.send('join', { code: lRoom.code, name: 'L1', kind: 1 });
  await l1.wait('room');
  await fetch(`http://127.0.0.1:${BLUE_INT}/internal/drain`, { method: 'POST', headers: INT_HEADERS });
  const [lr0, lr1] = await Promise.all([l0.wait('redirect', () => true, 6000), l1.wait('redirect', () => true, 6000)]);
  check(lr0?.code && lr0.code === lr1?.code && lr0.resume === true && lr0.node === 'green', `BUG-32: lobby on draining blue moved after DRAIN_LOBBY_TTL as one room (${lRoom.code} -> ${lr0?.code})`);

  // 9d. BUG-44 (direct): v1 on green joins a blue room via proxy, gets PROTOCOL_MISMATCH, then creates -> room on green
  await fetch(`http://127.0.0.1:${BLUE_INT}/internal/undrain`, { method: 'POST', headers: INT_HEADERS });
  const v2Blue = track(await openWs(`ws://127.0.0.1:${BLUE_PUB}/ws?p=2`, 'V2_blue_room'));
  await v2Blue.wait('hello');
  v2Blue.send('create', { name: 'V2B', kind: 0 });
  const v2BlueRoom = await v2Blue.wait('room');
  const v1Pin = track(await openWs(`ws://127.0.0.1:${GREEN_PUB}/ws`, 'V1_pin'));
  await v1Pin.wait('hello');
  v1Pin.send('join', { code: v2BlueRoom.code, name: 'Pin', kind: 0 });
  const v1PinErr = await v1Pin.wait('err');
  v1Pin.send('create', { name: 'Pin', kind: 0 });
  const v1PinRoom = await v1Pin.wait('room');
  const greenRoomCheck = await fetch(`http://127.0.0.1:${GREEN_INT}/internal/rooms/${v1PinRoom?.code}`, { headers: INT_HEADERS });
  check(v1PinErr?.code === 'PROTOCOL_MISMATCH' && Number(v1PinRoom?.code) >= 5500 && greenRoomCheck.status === 200,
    `BUG-44: after a proxied PROTOCOL_MISMATCH the v1 socket creates its room on green (${v1PinRoom?.code}), not on blue`);
  v1Pin.send('leave'); v2Blue.send('leave');

  // 10. BUG-28: Internal auth & bind checks
  const noAuth = await fetch(`http://127.0.0.1:${BLUE_INT}/internal/stats`);
  const badAuth = await fetch(`http://127.0.0.1:${BLUE_INT}/internal/drain`, { method: 'POST', headers: { 'x-internal-token': 'wrong' } });
  const badWs = await new Promise((res) => {
    const ws = new WebSocket(`ws://127.0.0.1:${BLUE_INT}/internal/ws?p=1`);
    ws.once('unexpected-response', (_req, r) => res(r.statusCode));
    ws.once('open', () => { ws.close(); res(200); });
    ws.once('error', () => res(-1)); // any other failure must NOT count as 401
  });
  check(noAuth.status === 401 && badAuth.status === 401 && badWs === 401,
    `BUG-28: internal HTTP/WS rejects missing/wrong INTERNAL_TOKEN (${noAuth.status}, ${badAuth.status}, ws=${badWs})`);

  // BUG-48: 0.0.0.0 without INTERNAL_TOKEN refuses to start (clear FATAL in the log, exit 1)
  const fc = await runToExit({ NODE_ENV: 'production', APP_VERSION: '0.58.0', PORT: String(await freePort()), INTERNAL_PORT: String(await freePort()), INTERNAL_HOST: '0.0.0.0', INTERNAL_TOKEN: '' });
  check(fc.code === 1 && /FATAL: INTERNAL_TOKEN is required/.test(fc.out),
    `BUG-48: INTERNAL_HOST=0.0.0.0 without INTERNAL_TOKEN refuses to start (exit ${fc.code})`);
  // BUG-34: blue/green or production without APP_VERSION refuses to start
  const nv = await runToExit({ NODE_ENV: 'production', NODE_NAME: 'blue', APP_VERSION: '', PORT: String(await freePort()), INTERNAL_PORT: 'off' });
  check(nv.code === 1 && /FATAL: APP_VERSION is required/.test(nv.out), `BUG-34: NODE_NAME=blue without APP_VERSION refuses to start (exit ${nv.code})`);

  // 11. BUG-27: Disjoint room codes across slots (400 blue + 1500 green -> 0 collisions)
  await fetch(`http://127.0.0.1:${BLUE_INT}/internal/undrain`, { method: 'POST', headers: INT_HEADERS });
  const batchCreate = async (pubPort, count) => {
    const codes = [];
    const conns = await Promise.all(Array.from({ length: 50 }, (_, i) => openWs(`ws://127.0.0.1:${pubPort}/ws`, `batch${i}`)));
    await Promise.all(conns.map((c) => c.wait('hello')));
    let made = 0;
    while (made < count) {
      const chunk = conns.slice(0, Math.min(50, count - made));
      await Promise.all(chunk.map(async (c, idx) => {
        c.send('create', { name: `R${made + idx}`, kind: 0 });
        const rm = await c.wait('room');
        if (rm?.code) codes.push(rm.code);
      }));
      made += chunk.length;
    }
    for (const c of conns) { try { c.ws.close(); } catch {} }
    return codes;
  };
  // both slots create concurrently (the real switch-over case), and both ranges are checked
  const [blueCodes, greenCodes] = await Promise.all([batchCreate(BLUE_PUB, 400), batchCreate(GREEN_PUB, 1500)]);
  const greenSet = new Set(greenCodes);
  const overlap = blueCodes.filter((c) => greenSet.has(c));
  const blueInRange = blueCodes.every((c) => Number(c) >= 1000 && Number(c) <= 5499);
  const greenInRange = greenCodes.every((c) => Number(c) >= 5500 && Number(c) <= 9999);
  check(blueCodes.length === 400 && greenCodes.length === 1500 && overlap.length === 0 && blueInRange && greenInRange,
    `BUG-27: ${blueCodes.length} blue (1000..5499) + ${greenCodes.length} green (5500..9999) rooms created with ${overlap.length} collisions`);

  // 12. BUG-26: when peer is dead, v2 create on draining blue returns DRAINING (not redirect to dead peer)
  await fetch(`http://127.0.0.1:${BLUE_INT}/internal/drain`, { method: 'POST', headers: INT_HEADERS });
  green.child.kill('SIGKILL');
  await sleep(250);
  const v2DeadPeer = track(await openWs(`ws://127.0.0.1:${BLUE_PUB}/ws?p=2`, 'V2_dead_peer'));
  await v2DeadPeer.wait('hello');
  v2DeadPeer.send('create', { name: 'NoPeer', kind: 0 });
  const deadPeerErr = await v2DeadPeer.wait('err');
  const deadPeerRedir = v2DeadPeer.inbox.find((m) => m.event === 'redirect');
  check(deadPeerErr?.code === 'DRAINING' && !deadPeerRedir,
    `BUG-26: create on draining slot with dead peer returns DRAINING (no redirect to dead peer)`);

  // 13. Configurable field config (FIELD_W, FIELD_H, FIELD_PX_PER_M) without hardcoding; v1 stays at 180
  const cfgPub = await freePort();
  const cfgSrv = spawn(process.execPath, [MAIN_JS], {
    cwd: SERVER_DIR,
    env: {
      ...process.env,
      NODE_ENV: 'production',
      PORT: String(cfgPub),
      INTERNAL_PORT: 'off',
      NODE_NAME: 'blue',
      APP_VERSION: '0.58.0',
      FIELD_W: '208',
      FIELD_H: '416',
      FIELD_PX_PER_M: '10',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  try {
    const t0 = Date.now();
    while (Date.now() - t0 < 8000) {
      try { const h = await fetch(`http://127.0.0.1:${cfgPub}/api/health`); if (h.ok) break; } catch {}
      await sleep(80);
    }
    const c2 = track(await openWs(`ws://127.0.0.1:${cfgPub}/ws?p=2`, 'cfg_v2'));
    const ch2 = await c2.wait('hello');
    c2.send('create', { name: 'Cfg2', kind: 0 });
    const cr2 = await c2.wait('room');
    c2.send('start', {});
    const cs2 = await c2.wait('start');
    const c1 = track(await openWs(`ws://127.0.0.1:${cfgPub}/ws`, 'cfg_v1'));
    const ch1 = await c1.wait('hello');
    c1.send('create', { name: 'Cfg1', kind: 0 });
    const cr1 = await c1.wait('room');
    check(
      ch2?.field?.w === 208 && ch2?.field?.h === 416 && ch2?.field?.pxPerM === 10 &&
      cr2?.lw === 208 && cr2?.field?.w === 208 && cr2?.field?.h === 416 && cr2?.field?.pxPerM === 10 &&
      cs2?.lw === 208 && cs2?.field?.w === 208 && cs2?.field?.h === 416 && cs2?.field?.pxPerM === 10,
      `custom FIELD_W=208, FIELD_H=416, FIELD_PX_PER_M=10 propagated to hello/room/start (${JSON.stringify(cs2?.field)})`,
    );
    check(
      ch1?.v === 1 && ch1?.field === undefined && cr1?.lw === 180 && cr1?.field === undefined,
      `custom v2 field config does not break v1 clients (hello.v=${ch1?.v}, lw=${cr1?.lw})`,
    );
  } finally {
    cfgSrv.kill('SIGTERM');
  }

  // 14. BUG-47: field config validation and logging
  {
    const { writeFileSync, mkdtempSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const dir = mkdtempSync(join(tmpdir(), 'hop-field-'));
    const broken = join(dir, 'broken.json'); writeFileSync(broken, '{"w": 160,');
    const huge = join(dir, 'huge.json'); writeFileSync(huge, JSON.stringify({ w: 100000, h: 2.6, pxPerM: 1e9 }));
    const cases = [
      { name: 'broken JSON', env: { FIELD_CONFIG_PATH: broken }, re: /not valid JSON/, w: 160, h: 346, px: 8, v1: 180 },
      { name: 'missing file', env: { FIELD_CONFIG_PATH: join(dir, 'nope.json') }, re: /does not exist/, w: 160, h: 346, px: 8, v1: 180 },
      { name: 'out-of-range file', env: { FIELD_CONFIG_PATH: huge }, re: /invalid w=100000/, w: 160, h: 346, px: 8, v1: 180 },
      { name: 'bad env', env: { FIELD_W: 'abc', FIELD_W_V1: '99999' }, re: /invalid w="abc".*|invalid w="99999"/s, w: 160, h: 346, px: 8, v1: 180 },
      { name: 'valid env', env: { FIELD_W: '176', FIELD_W_V1: '200' }, re: /v2 field: \{"w":176,"h":346,"pxPerM":8\}/, w: 176, h: 346, px: 8, v1: 200 },
    ];
    for (const cs of cases) {
      const pub = await freePort();
      const child = spawn(process.execPath, [MAIN_JS], { cwd: SERVER_DIR, env: { ...process.env, NODE_ENV: 'production', APP_VERSION: '0.58.0', PORT: String(pub), INTERNAL_PORT: 'off', ...cs.env }, stdio: ['ignore', 'pipe', 'pipe'] });
      let out = ''; child.stdout.on('data', (d) => { out += d; }); child.stderr.on('data', (d) => { out += d; });
      try {
        await waitHealth(pub);
        const c2 = await openWs(`ws://127.0.0.1:${pub}/ws?p=2`, 'f2'); const h2 = await c2.wait('hello');
        const c1 = await openWs(`ws://127.0.0.1:${pub}/ws`, 'f1'); await c1.wait('hello');
        c1.send('create', { name: 'F1', kind: 0 }); const r1 = await c1.wait('room');
        c1.ws.close(); c2.ws.close();
        check(cs.re.test(out) && /v2 field: /.test(out) && h2?.field?.w === cs.w && h2?.field?.h === cs.h && h2?.field?.pxPerM === cs.px && r1?.lw === cs.v1,
          `BUG-47: ${cs.name}: logged, effective field ${JSON.stringify(h2?.field)}, v1 lw=${r1?.lw}`);
      } finally { child.kill('SIGTERM'); }
    }
  }

  // 15. BUG-48: different INTERNAL_TOKENs between slots are visible in both logs and in /api/health.peerAuth
  {
    const bp = await freePort(), bi = await freePort(), rp = await freePort(), ri = await freePort();
    const b = startSlot({ name: 'blue', pubPort: bp, intPort: bi, version: '0.57.0', peerIntPort: ri });
    const r = startSlot({ name: 'green', pubPort: rp, intPort: ri, version: '0.58.0', peerIntPort: bi, extraEnv: { INTERNAL_TOKEN: 'other-token' } });
    try {
      await waitHealth(bp); await waitHealth(rp);
      const host = await openWs(`ws://127.0.0.1:${bp}/ws`, 'tok_host'); await host.wait('hello');
      host.send('create', { name: 'TH', kind: 0 }); const hr = await host.wait('room');
      const j = await openWs(`ws://127.0.0.1:${rp}/ws`, 'tok_join'); await j.wait('hello');
      j.send('join', { code: hr.code, name: 'TJ', kind: 0 }); const je = await j.wait('err');
      await sleep(200);
      const hh = await (await fetch(`http://127.0.0.1:${rp}/api/health`)).json();
      const rLog = r.logs.join(''), bLog = b.logs.join('');
      check(je?.code === 'NOT_FOUND' && /rejected INTERNAL_TOKEN \(401\)/.test(rLog) && /rejected GET \/internal\/(stats|rooms\/\d+) .*unauthorized/.test(bLog) && hh.peerAuth === 'unauthorized',
        `BUG-48: token mismatch -> ERROR in green log (401 from peer), ERROR in blue log (rejected), health.peerAuth=${hh.peerAuth}`);
      host.ws.close(); j.ws.close();
    } finally { b.child.kill('SIGTERM'); r.child.kill('SIGTERM'); }
  }

  // 16. BUG-45: 2nd and 3rd SIGTERM (mid-round and in lobby) are ignored; everybody gets results/SERVER_SHUTDOWN, nobody 1006
  for (const phase of ['round', 'lobby']) {
    const pub = await freePort(), int = await freePort();
    const sl = startSlot({ name: 'blue', pubPort: pub, intPort: int, version: '0.57.0', peerIntPort: await freePort(), extraEnv: { GRACEFUL_SHUTDOWN_MS: '2500' } });
    const exited = new Promise((res) => sl.child.once('exit', (code, sig) => res({ code, sig, at: Date.now() })));
    await waitReady(sl);
    const a = await openWs(`ws://127.0.0.1:${pub}/ws`, 'm1a'); await a.wait('hello');
    const b = await openWs(`ws://127.0.0.1:${pub}/ws`, 'm1b'); await b.wait('hello');
    const l = await openWs(`ws://127.0.0.1:${pub}/ws?p=2`, 'm2l'); await l.wait('hello');
    a.send('create', { name: 'MA', kind: 0 }); const ra = await a.wait('room');
    b.send('join', { code: ra.code, name: 'MB', kind: 1 }); await b.wait('room');
    l.send('create', { name: 'ML', kind: 0 }); await l.wait('room');
    if (phase === 'round') {
      b.send('ready', { ready: true }); await sleep(40); a.send('start', {});
      await Promise.all([a.wait('start'), b.wait('start')]);
      a.send('st', { x: 50, y: -80, vx: 0, vy: -3, f: 1, a: 1, m: 80, ps: 0 });
      await a.wait('snap');
    }
    const t0 = Date.now();
    // in a round the 2nd/3rd signal come 300 ms apart (the slot must keep running until the timeout);
    // in a pure lobby the shutdown itself takes ~0.3 s, so the repeats come 20 ms apart to land inside it
    const gap = phase === 'round' ? 300 : 20;
    sl.child.kill('SIGTERM'); await sleep(gap);
    sl.child.kill('SIGTERM'); await sleep(gap);
    sl.child.kill('SIGTERM');
    await sleep(phase === 'round' ? 400 : 0);
    const aliveAfterRepeats = phase !== 'round' || (sl.child.exitCode === null && sl.child.signalCode === null);
    const ex = await exited;
    await sleep(100);
    const got = (c, ev, code) => c.all.some((m) => m.event === ev && (!code || m.data?.code === code));
    const roundOk = phase !== 'round' || (got(a, 'results') && got(b, 'results') && got(a, 'err', 'SERVER_SHUTDOWN') && got(b, 'err', 'SERVER_SHUTDOWN'));
    const lobbyOk = got(l, 'err', 'SERVER_SHUTDOWN') && (phase === 'round' || (got(a, 'err', 'SERVER_SHUTDOWN') && got(b, 'err', 'SERVER_SHUTDOWN')));
    const closes = [a, b, l].map((c) => c.closed?.code);
    check(aliveAfterRepeats && ex.code === 0 && roundOk && lobbyOk && closes.every((c) => c === 1000 || c === 1001) &&
      /ignored repeated SIGTERM/.test(sl.logs.join('')) && (phase !== 'round' || ex.at - t0 >= 2400),
      `BUG-45: 3x SIGTERM in ${phase}: process kept running (${ex.at - t0}ms, exit ${ex.code}), results+SERVER_SHUTDOWN delivered, closes ${closes.join('/')}`);
  }

  // 17. Drain without version (rollback) must NOT send update; drain with version must
  {
    const bp = await freePort(), bi = await freePort(), gp = await freePort(), gi = await freePort();
    const b = startSlot({ name: 'blue', pubPort: bp, intPort: bi, version: '0.57.0', peerIntPort: gi });
    const g = startSlot({ name: 'green', pubPort: gp, intPort: gi, version: '0.58.0', peerIntPort: bi });
    try {
      await waitReady(b); await waitReady(g);
      const v2 = await openWs(`ws://127.0.0.1:${bp}/ws?p=2`, 'drain_v2'); await v2.wait('hello');
      const v1 = await openWs(`ws://127.0.0.1:${bp}/ws`, 'drain_v1'); await v1.wait('hello');
      const noVer = await (await fetch(`http://127.0.0.1:${bi}/internal/drain`, { method: 'POST', headers: INT_HEADERS })).json();
      await sleep(150);
      const updNone = v2.inbox.find((m) => m.event === 'update') || v1.inbox.find((m) => m.event === 'update');
      check(noVer.ok && noVer.draining === true && noVer.updateVersion == null && noVer.notified === 0 && !updNone,
        `drain without version (rollback): no update (updateVersion=${noVer.updateVersion}, notified=${noVer.notified}, frame=${updNone ? updNone.data?.version : 'none'})`);
      const withVer = await (await fetch(`http://127.0.0.1:${bi}/internal/drain`, {
        method: 'POST', headers: { ...INT_HEADERS, 'content-type': 'application/json' },
        body: JSON.stringify({ version: '0.58.0' }),
      })).json();
      const upd = await v2.wait('update');
      await sleep(80);
      const updV1 = v1.inbox.find((m) => m.event === 'update');
      check(withVer.ok && withVer.updateVersion === '0.58.0' && withVer.notified >= 1 && upd?.version === '0.58.0' && !updV1,
        `drain with version: v2 got update(0.58.0), v1 did not (notified=${withVer.notified})`);
      v2.ws.close(); v1.ws.close();
    } finally { b.child.kill('SIGKILL'); g.child.kill('SIGKILL'); }
  }

  // 18. peerAuth is live: same token -> ok; wrong token -> unauthorized; peer down -> unreachable; flips within a few seconds
  {
    const waitAuth = async (port, want, ms = 8000) => {
      const t0 = Date.now();
      let last = null;
      while (Date.now() - t0 < ms) {
        try {
          const h = await (await fetch(`http://127.0.0.1:${port}/api/health`)).json();
          last = h.peerAuth;
          if (h.peerAuth === want) return h.peerAuth;
        } catch { /* retry */ }
        await sleep(200);
      }
      return last;
    };
    const bp = await freePort(), bi = await freePort(), gp = await freePort(), gi = await freePort();
    const b = startSlot({ name: 'blue', pubPort: bp, intPort: bi, version: '0.57.0', peerIntPort: gi, extraEnv: { PEER_AUTH_TTL_MS: '2000', PEER_TIMEOUT_MS: '400' } });
    const g = startSlot({ name: 'green', pubPort: gp, intPort: gi, version: '0.58.0', peerIntPort: bi, extraEnv: { PEER_AUTH_TTL_MS: '2000', PEER_TIMEOUT_MS: '400' } });
    try {
      await waitReady(b); await waitReady(g);
      const okB = await waitAuth(bp, 'ok');
      const okG = await waitAuth(gp, 'ok');
      check(okB === 'ok' && okG === 'ok', `peerAuth live: both slots ok when peer is up and tokens match (blue=${okB}, green=${okG})`);
      g.child.kill('SIGKILL');
      const down = await waitAuth(bp, 'unreachable');
      check(down === 'unreachable', `peerAuth live: blue -> unreachable within a few seconds after green is killed (got ${down})`);
    } finally { try { b.child.kill('SIGKILL'); } catch {} try { g.child.kill('SIGKILL'); } catch {} }

    const bp2 = await freePort(), bi2 = await freePort(), gp2 = await freePort(), gi2 = await freePort();
    const b2 = startSlot({ name: 'blue', pubPort: bp2, intPort: bi2, version: '0.57.0', peerIntPort: gi2, extraEnv: { PEER_AUTH_TTL_MS: '2000', PEER_TIMEOUT_MS: '400' } });
    const g2 = startSlot({ name: 'green', pubPort: gp2, intPort: gi2, version: '0.58.0', peerIntPort: bi2, extraEnv: { INTERNAL_TOKEN: 'other-token', PEER_AUTH_TTL_MS: '2000', PEER_TIMEOUT_MS: '400' } });
    try {
      await waitHealth(bp2); await waitHealth(gp2);
      const unauth = await waitAuth(bp2, 'unauthorized');
      const unauthG = await waitAuth(gp2, 'unauthorized');
      check(unauth === 'unauthorized' && unauthG === 'unauthorized',
        `peerAuth live: both slots unauthorized when tokens differ (blue=${unauth}, green=${unauthG})`);
    } finally { b2.child.kill('SIGKILL'); g2.child.kill('SIGKILL'); }
  }

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
