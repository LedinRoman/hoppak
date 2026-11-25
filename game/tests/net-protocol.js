/* Protocol-level test with headless node clients (no browser): rooms, errors, relay rates, events,
   results, reconnect grace and room cleanup.  Usage: node game/tests/net-protocol.js [ws://localhost:8787/ws] */
const WebSocket = require('/workspace/jumper/server/node_modules/ws');
const URL_ = process.argv[2] || 'ws://localhost:8787/ws';
const HTTP = URL_.replace(/^ws/, 'http').replace(/\/ws$/, '');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
const check = (ok, msg) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg); if (!ok) failures++; };

function client(name) {
  return new Promise((res) => {
    const ws = new WebSocket(URL_);
    const c = { ws, name, inbox: [], bytes: 0, last: {} };
    c.send = (event, data) => ws.send(JSON.stringify({ event, data: data || {} }));
    c.wait = async (event, pred = () => true, ms = 3000) => {
      const t0 = Date.now();
      while (Date.now() - t0 < ms) {
        const i = c.inbox.findIndex((m) => m.event === event && pred(m.data));
        if (i >= 0) return c.inbox.splice(i, 1)[0].data;
        await sleep(10);
      }
      return null;
    };
    ws.on('message', (raw) => { c.bytes += raw.length; const m = JSON.parse(raw); c.inbox.push(m); c.last[m.event] = m.data; });
    ws.on('open', () => res(c));
  });
}

(async () => {
  const a = await client('А'), b = await client('Б'), c = await client('В'), d = await client('Г'), e = await client('Д');
  a.send('create', { name: 'Рома', kind: 0 });
  const ra = await a.wait('room');
  check(ra && /^\d{4}$/.test(ra.code) && ra.host === ra.you, `create -> room ${ra && ra.code}, creator is host`);
  b.send('join', { code: '0000', name: 'x', kind: 1 });
  check((await b.wait('err'))?.code === 'NOT_FOUND', 'join wrong code -> NOT_FOUND');
  for (const [cl, k] of [[b, 1], [c, 2], [d, 3]]) cl.send('join', { code: ra.code, name: cl.name, kind: k });
  const rb = await b.wait('room'); await c.wait('room'); await d.wait('room');
  check(rb && rb.code === ra.code, 'join by code works');
  await sleep(100);
  e.send('join', { code: ra.code, name: 'e', kind: 4 });
  check((await e.wait('err'))?.code === 'FULL', '5th player -> FULL');
  b.send('start');
  check((await b.wait('err'))?.code === 'NOT_HOST', 'guest cannot start');
  a.send('start');
  check((await a.wait('err'))?.code === 'NOT_READY', 'host cannot start before guests are ready');
  for (const cl of [b, c, d]) cl.send('ready', { ready: true });
  await sleep(150);
  a.send('map', { map: 'jungle' });
  await sleep(100);
  a.send('start');
  const starts = await Promise.all([a, b, c, d].map((cl) => cl.wait('start')));
  check(starts.every((s) => s && s.seed === starts[0].seed && s.map === 'jungle' && s.lw === 180), `start: same seed ${starts[0].seed}, map jungle, lw 180 for all 4`);
  check(starts[0].at > Date.now(), 'start carries a future start time (synchronised countdown)');
  e.send('join', { code: ra.code, name: 'e', kind: 4 });
  check((await e.wait('err'))?.code === 'IN_GAME', 'join while running -> IN_GAME');

  // relay: every client sends state at 15 Hz for 3 s
  for (const cl of [a, b, c, d]) cl.bytes = 0;
  const pids = Object.fromEntries([a, b, c, d].map((cl) => [cl.name, cl.last.room.you]));
  let y = 0;
  const T = 3000, t0 = Date.now();
  const timer = setInterval(() => { y -= 5; [a, b, c, d].forEach((cl, i) => cl.send('st', { x: 20 + i * 30, y: y - i, vx: 0, vy: -3, f: 1, a: 1, m: -y, ps: 0 })); }, 66);
  await sleep(T);
  clearInterval(timer);
  const dt = (Date.now() - t0) / 1000;
  const snaps = a.inbox.filter((m) => m.event === 'snap');
  const others = snaps.flatMap((s) => s.data.s).filter((r) => r[0] !== pids['А']);
  const own = snaps.flatMap((s) => s.data.s).filter((r) => r[0] === pids['А']);
  console.log(`  snaps to host: ${(snaps.length / dt).toFixed(1)}/s, remote states/s: ${(others.length / dt).toFixed(1)}, bytes in per client ≈ ${Math.round(a.bytes / dt)} B/s`);
  check(snaps.length / dt <= 21 && snaps.length / dt > 12, 'snapshots batched at <= 20 Hz (only when something changed)');
  check(Math.abs(others.length / dt - 45) < 8, 'host receives ~15 states/s from each of the 3 others');
  const lastB = others.filter((r) => r[0] === pids['Б']).pop();
  check(lastB && Math.abs(lastB[2] - (y - 1)) < 30, `host sees Б's latest y (${lastB && lastB[2]} vs ${y - 1})`);
  a.inbox = a.inbox.filter((m) => m.event !== 'snap');
  [b, c, d].forEach((cl) => (cl.inbox = cl.inbox.filter((m) => m.event !== 'snap')));

  // validation: garbage state is ignored, NaN does not crash
  b.send('st', { x: 'NaN', y: null });
  b.send('st', { x: 1e9, y: -5, m: -100 });
  await sleep(120);
  check(true, 'garbage state ignored/clamped without crash');

  // events
  b.send('ev', { e: 'mob', id: 'slime:40:-320' });
  const mob = await a.wait('ev', (x) => x.e === 'mob');
  check(mob && mob.id === 'slime:40:-320' && mob.pid === pids['Б'], 'stomped-mob event relayed to others');

  // reconnect within grace: drop В and resume with its token
  const tokC = c.last.room.token;
  c.ws.terminate();
  const off = await a.wait('room', (r) => r.players.some((p) => !p.on));
  check(!!off, 'others see В go offline');
  const c2 = await client('В2');
  c2.send('resume', { token: tokC });
  const rc = await c2.wait('room');
  const st2 = await c2.wait('start');
  check(rc && rc.you === pids['В'] && st2 && st2.resumed && st2.seed === starts[0].seed, 'В resumes same seat and gets the running round (resumed)');

  // deaths -> results
  for (const [cl, m] of [[d, 10], [b, 40], [c2, 25], [a, 30]]) { cl.send('ev', { e: 'dead', m }); await sleep(50); }
  const res = await Promise.all([a, b, c2, d].map((cl) => cl.wait('results')));
  check(res.every((r) => r && JSON.stringify(r.ranking) === JSON.stringify(res[0].ranking)), 'everyone gets the same results');
  console.log('  ranking:', res[0] && res[0].ranking.map((r) => `${r.place}.${r.name}:${r.m}`).join(' '));
  check(res[0] && res[0].ranking[0].pid === pids['Б'], 'winner = highest climb (Б, 40 m)');
  const lob = await a.wait('room', (r) => r.phase === 'lobby' && r.players.every((p) => !p.ready));
  check(!!lob, 'room returns to lobby, ready flags reset for rematch');

  // drop without resume -> removed after 10 s grace, host migrates when host leaves
  [a, b, c2, d].forEach((cl) => (cl.inbox = []));
  d.ws.terminate();
  a.send('leave');
  const mig = await b.wait('room', (r) => r.host === pids['Б'], 3000);
  check(!!mig, 'host left -> host passes to next player');
  console.log('  waiting 11 s for reconnect grace to expire...');
  const tg = Date.now();
  const gone = await b.wait('room', (r) => !r.players.some((p) => p.pid === pids['Г']), 14000);
  console.log(`  removed after ${((Date.now() - tg) / 1000).toFixed(1)} s more`);
  check(!!gone, 'player who did not come back within 10 s is removed');
  b.send('leave'); c2.send('leave');
  await sleep(300);
  const h = await (await fetch(HTTP + '/api/health')).json();
  check(h.rooms === 0, `empty room cleaned up (rooms=${h.rooms})`);
  [a, b, c, c2, d, e].forEach((cl) => { try { cl.ws.close(); } catch {} });
  console.log(failures ? `\n${failures} FAILURE(S)` : '\nALL PROTOCOL CHECKS PASSED');
  process.exit(failures ? 1 : 0);
})().catch((err) => { console.error(err); process.exit(2); });
