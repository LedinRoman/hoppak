/* End-to-end: real game clients (headless Chrome) play one online round through the local server.
   Usage: node game/tests/net-e2e.js [baseUrl]   (server must be running, default http://localhost:8787/) */
const pp = require('/tmp/pp/node_modules/puppeteer-core');
const BASE = process.argv[2] || 'http://localhost:8787/';
const SIZES = [[390, 844], [375, 667], [430, 932], [360, 640]];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toISOString().slice(11, 23), ...a);
let failures = 0;
const check = (ok, msg) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg); if (!ok) failures++; };

async function waitFor(pg, fn, arg, ms = 8000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { if (await pg.evaluate(fn, arg)) return true; await sleep(100); }
  return false;
}

(async () => {
  const N = Number(process.env.NPLAYERS || 4);
  const browsers = [], pages = [];
  for (let i = 0; i < N; i++) {
    const b = await pp.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new',
      args: ['--no-sandbox', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'] });
    const pg = await b.newPage();
    await pg.setViewport({ width: SIZES[i][0], height: SIZES[i][1], deviceScaleFactor: 1 });
    pg.on('pageerror', (e) => { console.log(`[p${i}] pageerror ${e.message}`); failures++; });
    await pg.goto(BASE);
    await pg.evaluate((i) => { localStorage.clear(); sessionStorage.clear(); localStorage.setItem('hoppak.nick', ['РОМА', 'ДИМА', 'КАТЯ', 'ЛЁША'][i]); }, i);
    await pg.reload();
    await sleep(300);
    // give guests different heroes (all owned for the test)
    await pg.evaluate((i) => { const s = __hoppak.getSave(); for (let k = 0; k < 6; k++) s.owned['char:' + k] = 1; s.char = i; }, i);
    browsers.push(b); pages.push(pg);
  }
  const H = (i, f, a) => pages[i].evaluate(f, a);

  // host creates a room
  await H(0, () => __hoppak.tap('net:menu'));
  check(await waitFor(pages[0], () => __hoppak.net.st === 'online'), 'host connects to server');
  await H(0, () => __hoppak.tap('net:create'));
  check(await waitFor(pages[0], () => !!__hoppak.net.room), 'host created room');
  const code = await H(0, () => __hoppak.net.room.code);
  check(/^\d{4}$/.test(code), `room code is 4 digits: ${code}`);

  // guests join by typing the code on the keypad
  for (let i = 1; i < N; i++) {
    await H(i, () => __hoppak.tap('net:menu'));
    await waitFor(pages[i], () => __hoppak.net.st === 'online');
    await H(i, (code) => { __hoppak.tap('net:enter'); for (const d of code) __hoppak.tap('net:k' + d); __hoppak.tap('net:ok'); }, code);
    check(await waitFor(pages[i], () => !!__hoppak.net.room), `p${i} joined room ${code}`);
  }
  check(await waitFor(pages[0], (n) => __hoppak.net.room.players.length === n, N), `host sees ${N} players`);
  // wrong code -> error
  // start before ready must fail
  await H(0, () => __hoppak.tap('net:start'));
  await sleep(300);
  check(await H(0, () => __hoppak.getPhase()) === 'net', 'start refused while guests not ready');
  for (let i = 1; i < N; i++) await H(i, () => __hoppak.tap('net:ready'));
  check(await waitFor(pages[0], () => __hoppak.net.room.players.every((p) => p.ready || p.pid === __hoppak.net.room.host)), 'all guests ready');
  await H(0, () => __hoppak.tap('net:mnext'));
  await sleep(200);
  await pages[0].screenshot({ path: '/workspace/jumper/game/tests/net-shots/room_host.png' });
  await pages[1].screenshot({ path: '/workspace/jumper/game/tests/net-shots/room_guest.png' });
  await H(0, () => __hoppak.tap('net:start'));
  for (let i = 0; i < N; i++) check(await waitFor(pages[i], () => __hoppak.getPhase() === 'play' && __hoppak.getWorld() && __hoppak.getWorld().net), `p${i} entered online run`);
  await sleep(400);
  await pages[N - 1].screenshot({ path: '/workspace/jumper/game/tests/net-shots/countdown.png' });

  // same seed, map, width and identical generated map on every client
  const info = [];
  for (let i = 0; i < N; i++) info.push(await H(i, () => { const w = __hoppak.getWorld(); return { seed: w.seed, map: w.map, lw: __hoppak.getSize().lw, plats: JSON.stringify(w.platforms.map((p) => [p.type === 'move' ? 'm' : p.x, p.y, p.w, p.type])), mobs: JSON.stringify(w.monsters.map((m) => [m.kind, m.baseX, m.baseY])), players: w.players.length }; }));
  check(info.every((x) => x.seed === info[0].seed), `same seed on all clients: ${info.map((x) => x.seed).join(',')}`);
  check(info.every((x) => x.map === info[0].map), `same map: ${info[0].map}`);
  check(info.every((x) => x.lw === 180), `fixed world width 180 on all viewports: ${info.map((x) => x.lw).join(',')}`);
  const common = (key) => { const arrs = info.map((x) => JSON.parse(x[key])); const n = Math.min(...arrs.map((a) => a.length)); return { n, same: arrs.every((a) => JSON.stringify(a.slice(0, n)) === JSON.stringify(arrs[0].slice(0, n))) }; };
  const cp = common('plats'), cm = common('mobs');
  check(cp.same && cp.n >= 20 && cm.same, `identical generated map on all clients (${cp.n} platforms, ${cm.n} mobs compared; taller screens just generate further ahead)`);
  if (process.env.DEBUG_MAP) for (let i = 0; i < N; i++) { const a = JSON.parse(info[0].plats), b = JSON.parse(info[i].plats); a.forEach((p, k) => { if (JSON.stringify(p) !== JSON.stringify(b[k])) console.log("diff", i, k, JSON.stringify(p), JSON.stringify(b[k])); }); console.log(info[0].mobs, info[i].mobs); }
  check(info.every((x) => x.players === N), `${N} heroes in every world`);

  // play: all autopilot
  await sleep(1500);
  // different autopilot temperaments so the heroes don't move in lockstep on the shared map
  for (let i = 0; i < N; i++) await H(i, (i) => { const p = __hoppak.getWorld().players[0]; p.bias = [0, -14, 14, 6][i]; p.react = [1, 3, 4, 5][i]; __hoppak.setAutoPlay(true); }, i);
  const t0 = Date.now();
  const s0 = await Promise.all(pages.map((pg) => pg.evaluate(() => ({ ...__hoppak.net.stats }))));
  // position sync: compare host's view of each remote with that remote's own state
  const errs = [];
  for (let k = 0; k < 20; k++) {
    await sleep(300);
    const snaps = await Promise.all(pages.map((pg) => pg.evaluate(() => {
      const w = __hoppak.getWorld(), N = __hoppak.net;
      return { t: N.serverNow(), me: { pid: N.you, x: w.players[0].x, y: w.players[0].y, alive: w.players[0].alive, vy: w.players[0].vy },
        remotes: w.players.slice(1).map((p) => ({ pid: p.pid, x: p.x, y: p.y, alive: p.alive })) };
    })));
    for (const r of snaps[0].remotes) {
      const own = snaps.find((s) => s.me.pid === r.pid);
      if (own && own.me.alive && r.alive) errs.push(Math.abs(own.me.y - r.y));
    }
  }
  errs.sort((a, b) => a - b);
  const med = errs[Math.floor(errs.length / 2)], p90 = errs[Math.floor(errs.length * 0.9)];
  log(`remote-vs-own y error (px): n=${errs.length} median=${med && med.toFixed(1)} p90=${p90 && p90.toFixed(1)} max=${errs[errs.length - 1] && errs[errs.length - 1].toFixed(1)}`);
  check(errs.length > 10 && med < 40, 'remote heroes track their owners (median y error < 40 px ≈ 150 ms of motion)');
  // map still identical after several seconds of play (compare the y-range every client has generated)
  const late = await Promise.all(pages.map((pg) => pg.evaluate(() => { const w = __hoppak.getWorld(); return { p: w.platforms.map((p) => [p.type === 'move' ? 'm' : p.x, p.y, p.w, p.type]), m: w.monsters.map((m) => [m.kind, m.baseX, m.baseY]) }; })));
  const lo = Math.max(...late.map((x) => Math.min(...x.p.map((p) => p[1])))), hi = Math.min(...late.map((x) => Math.max(...x.p.map((p) => p[1]))));
  const inR = (arr, yi) => JSON.stringify(arr.filter((q) => q[yi] >= lo && q[yi] <= hi - 20).sort());
  const lp = late.map((x) => inR(x.p, 1)), lm = late.map((x) => inR(x.m, 2));
  check(lp.every((x) => x === lp[0]) && lm.every((x) => x === lm[0]), `map identical mid-run in shared range y ${hi}..${lo} (${JSON.parse(lp[0]).length} platforms, ${JSON.parse(lm[0]).length} mobs)`);
  const heights = await Promise.all(pages.map((pg) => pg.evaluate(() => ({ tick: __hoppak.getWorld().tick, m: __hoppak.getWorld().players.map((p) => Math.round(p.maxH / 8)) }))));
  log('heights seen by each client [me, remotes...]:', JSON.stringify(heights));
  await pages[0].screenshot({ path: '/workspace/jumper/game/tests/net-shots/play_p0.png' });
  await pages[3 % N].screenshot({ path: '/workspace/jumper/game/tests/net-shots/play_p3.png' });

  // reconnect: p2 loses its socket mid-run and must come back within the grace window
  if (N > 2) {
    await H(2, () => __hoppak.net.dropSocket());
    await sleep(300);
    const offSeen = await waitFor(pages[0], () => __hoppak.net.room.players.some((p) => !p.on), null, 3000);
    const back = await waitFor(pages[2], () => __hoppak.net.st === 'online' && __hoppak.net.room && __hoppak.getWorld().net, null, 8000);
    check(back, `p2 reconnected after socket drop (host saw it offline: ${offSeen})`);
    check(await waitFor(pages[0], () => __hoppak.net.room.players.every((p) => p.on), null, 4000), 'host sees p2 back online');
  }

  // rates over the measured window
  const dt = (Date.now() - t0) / 1000;
  const s1 = await Promise.all(pages.map((pg) => pg.evaluate(() => ({ ...__hoppak.net.stats }))));
  const rates = s1.map((s, i) => ({ sentHz: +((s.sent - s0[i].sent) / dt).toFixed(1), recvHz: +((s.recv - s0[i].recv) / dt).toFixed(1), snapHz: +((s.snaps - s0[i].snaps) / dt).toFixed(1) }));
  log('client message rates:', JSON.stringify(rates));

  // finish: knock everyone off the map one by one (autopilot bots rarely die fast)
  for (let i = N - 1; i >= 0; i--) {
    for (let t = 0; t < 10 && await H(i, () => __hoppak.getWorld().players[0].alive); t++) {
      await H(i, () => { const w = __hoppak.getWorld(); const p = w.players[0]; __hoppak.setAutoPlay(false); p.domeT = 0; p.domeSave = false; p.shieldT = 0; p.rocketT = 0; p.invT = 0; p.hookN = 0; p.grabT = 0; p.y = p.camY + __hoppak.getSize().lh + 40; p.vy = 5; });
      await sleep(300);
    }
    await sleep(400);
  }
  for (let i = 0; i < N; i++) check(await waitFor(pages[i], () => __hoppak.getPhase() === 'results', null, 10000), `p${i} reached results`);
  const res = await Promise.all(pages.map((pg) => pg.evaluate(() => __hoppak.getWorld().players.map((p) => ({ pid: p.id === 0 ? __hoppak.net.you : p.pid, place: p.place, m: Math.floor(p.maxH / 8) })).sort((a, b) => a.pid - b.pid))));
  log('results per client:', JSON.stringify(res.map((r) => r.map((x) => `${x.pid}:#${x.place}`).join(' '))));
  check(res.every((r) => JSON.stringify(r.map((x) => [x.pid, x.place])) === JSON.stringify(res[0].map((x) => [x.pid, x.place]))), 'identical placing on all clients');
  await pages[0].screenshot({ path: '/workspace/jumper/game/tests/net-shots/results_p0.png' });
  // rematch -> back to the room lobby, ready flags reset
  await H(1, () => __hoppak.tap('rematch'));
  check(await waitFor(pages[1], () => __hoppak.getPhase() === 'net' && __hoppak.net.sub === 'room' && !__hoppak.net.mePlayer().ready), 'rematch returns to room lobby');
  const health = await (await fetch(new URL('/api/health', BASE))).json();
  log('server health:', JSON.stringify(health));
  for (const b of browsers) await b.close();
  console.log(failures ? `\n${failures} FAILURE(S)` : '\nALL E2E CHECKS PASSED');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
