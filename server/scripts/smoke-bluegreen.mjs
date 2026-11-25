import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const WebSocket = require('ws');

const __dirname = dirname(fileURLToPath(import.meta.url));
const SERVER_DIR = join(__dirname, '..');
const MAIN_JS = join(SERVER_DIR, 'dist', 'main.js');

const BLUE_PUB = 8901;
const BLUE_INT = 3901;
const GREEN_PUB = 8902;
const GREEN_INT = 3902;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let failures = 0;
function check(ok, msg) {
  console.log((ok ? 'PASS ' : 'FAIL ') + msg);
  if (!ok) failures++;
}

function startSlot({ name, pubPort, intPort, version, peerIntPort }) {
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
  console.log('Both slots ready: blue (:8901/:3901) & green (:8902/:3902)');

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

  const f1Green = track(await openWs(`ws://127.0.0.1:${GREEN_PUB}/ws`, 'F_v1_green'));
  await f1Green.wait('hello');
  f1Green.send('join', { code: code2, name: 'JoinerV1', kind: 1 });
  const errWrongNode = await f1Green.wait('err');
  check(errWrongNode?.code === 'WRONG_NODE', `join ${code2} on green -> v1 client gets err WRONG_NODE`);

  f2.send('join', { code: '9999', name: 'Missing', kind: 0 });
  const errNotFound = await f2.wait('err');
  check(errNotFound?.code === 'NOT_FOUND', `join nonexistent 9999 on green -> NOT_FOUND`);

  // 7. Match on draining blue continues (state snap + events) and finishes cleanly
  a1.send('st', { x: 50, y: -120, vx: 0, vy: -3, f: 1, a: 1, m: 120, ps: 0 });
  b1.send('st', { x: 80, y: -180, vx: 0, vy: -4, f: -1, a: 1, m: 180, ps: 0 });
  const snapA = await a1.wait('snap');
  check(Array.isArray(snapA?.s) && snapA.s.length >= 1, `match on draining blue still relays 20Hz state snapshots`);

  a1.send('ev', { e: 'mob', id: 'slime:40:-100' });
  const mobB = await b1.wait('ev', (e) => e.e === 'mob');
  check(mobB?.id === 'slime:40:-100', `match on draining blue relays mob events`);

  a1.send('ev', { e: 'dead', m: 15 });
  b1.send('ev', { e: 'dead', m: 23 });
  const [resA, resB] = await Promise.all([a1.wait('results'), b1.wait('results')]);
  const lobA = await a1.wait('room', (r) => r.phase === 'lobby');
  check(resA && resB && resA.ranking[0].m === 23 && !!lobA, `match on draining blue finished cleanly (winner m=23) and returned to lobby`);

  // Leave all rooms -> blue stats reach 0 rooms, 0 players
  a1.send('leave'); b1.send('leave'); d2.send('leave'); f2Blue.send('leave'); g2.send('leave');
  await sleep(200);
  const statsEnd = await (await fetch(`http://127.0.0.1:${BLUE_INT}/internal/stats`)).json();
  check(statsEnd.rooms === 0 && statsEnd.players === 0 && statsEnd.draining === true, `blue drained to 0 rooms, 0 players`);

  // 8. Undrain rollback test
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
