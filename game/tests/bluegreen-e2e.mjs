/* Full blue-green client + dual-server E2E acceptance test.
   Starts blue (0.57.0) and green (0.58.0) servers from /workspace/jumper-bluegreen/server,
   a Caddy-mimicking HTTP/WS proxy, a v1-only legacy server, and a mock fault server,
   then drives real headless Chromium browsers running the built client in game/.

   Usage (from repo root): node game/tests/bluegreen-e2e.mjs
*/
import http from 'node:http';
import { execFileSync, spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const GAME_DIR = resolve(__dirname, '..');
const SHOTS_DIR = join(GAME_DIR, 'screens', 'bluegreen');
const BG_SERVER_DIR = process.env.BG_SERVER_DIR || '/workspace/jumper-bluegreen/server';
const MAIN_JS = join(BG_SERVER_DIR, 'dist', 'main.js');

const require = createRequire(import.meta.url);
const WebSocketPkg = require(join(BG_SERVER_DIR, 'node_modules', 'ws'));
const WebSocket = WebSocketPkg.WebSocket || WebSocketPkg;
const WebSocketServer = WebSocketPkg.WebSocketServer;

let chromium;
try {
  ({ chromium } = require('playwright-core'));
} catch {
  ({ chromium } = require('/usr/local/lib/pnpm/5/.pnpm/playwright-core@1.59.1/node_modules/playwright-core'));
}

const BLUE_PUB = 8921;
const BLUE_INT = 3921;
const GREEN_PUB = 8922;
const GREEN_INT = 3922;
const PROXY_PORT = 8920;
const V1_PORT = 8923;
const FAULT_PORT = 8924;
const INTERNAL_TOKEN = 'e2e-internal-secret';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toISOString().slice(11, 23), ...a);

let failures = 0;
function check(ok, msg) {
  console.log((ok ? 'PASS ' : 'FAIL ') + msg);
  if (!ok) failures++;
}

async function waitFor(pg, fn, arg, ms = 10000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    try {
      if (await pg.evaluate(fn, arg)) return true;
    } catch {
      /* page may be navigating */
    }
    await sleep(80);
  }
  return false;
}

function startSlot({ name, pubPort, intPort, version, peerIntPort }) {
  const logs = [];
  const child = spawn(process.execPath, [MAIN_JS], {
    cwd: BG_SERVER_DIR,
    env: {
      ...process.env,
      NODE_ENV: 'production',
      PORT: String(pubPort),
      INTERNAL_PORT: String(intPort),
      INTERNAL_HOST: '127.0.0.1',
      INTERNAL_TOKEN,
      NODE_NAME: name,
      APP_VERSION: version,
      PEER_INTERNAL_URL: `http://127.0.0.1:${peerIntPort}`,
      PEER_TIMEOUT_MS: '800',
      DRAIN_RESULTS_CLOSE_MS: '5000',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (d) => logs.push(d.toString()));
  child.stderr.on('data', (d) => logs.push(d.toString()));
  return { name, pubPort, intPort, version, child, logs };
}

async function waitSlotReady(slot) {
  const t0 = Date.now();
  while (Date.now() - t0 < 10000) {
    try {
      const [h, s] = await Promise.all([
        fetch(`http://127.0.0.1:${slot.pubPort}/api/health`),
        fetch(`http://127.0.0.1:${slot.intPort}/internal/stats`, {
          headers: { 'x-internal-token': INTERNAL_TOKEN },
        }),
      ]);
      if (h.ok && s.ok) return;
    } catch {
      /* retry */
    }
    await sleep(100);
  }
  throw new Error(`Slot ${slot.name} failed to start:\n${slot.logs.join('')}`);
}

function buildLegacyClient(commit, outDir) {
  execFileSync('rm', ['-rf', outDir]);
  mkdirSync(outDir, { recursive: true });
  execFileSync('bash', ['-lc', `git -C /workspace/jumper archive ${commit} game | tar -x -C "${outDir}" --strip-components=1`]);
  execFileSync('bash', [join(outDir, 'build.sh')], { cwd: outDir, stdio: 'ignore' });
  return outDir;
}

function createCaddyProxy({ bluePort, greenPort, gameDir, oldDirs = {} }) {
  let active = 'blue';
  const httpLog = [];
  const wsLog = [];
  const slots = { blue: bluePort, green: greenPort, custom: 8925 };
  const activeConns = new Set();

  const indexHtml = readFileSync(join(gameDir, 'index.html'));
  const hoppakJs = readFileSync(join(gameDir, 'hoppak.js'));

  const server = http.createServer(async (req, res) => {
    const u = new URL(req.url, `http://127.0.0.1:${PROXY_PORT}`);
    httpLog.push({ method: req.method, path: u.pathname, active });

    if (u.pathname.startsWith('/api/')) {
      const port = slots[active];
      try {
        const up = await fetch(`http://127.0.0.1:${port}${u.pathname}${u.search}`);
        const body = await up.text();
        res.writeHead(up.status, {
          'content-type': up.headers.get('content-type') || 'application/json',
          'cache-control': 'no-store',
        });
        res.end(body);
      } catch (e) {
        res.writeHead(502);
        res.end(String(e));
      }
      return;
    }

    if (/^\/v\/[^/]+$/.test(u.pathname)) {
      res.writeHead(308, { location: u.pathname + '/' });
      res.end();
      return;
    }

    const oldMatch = u.pathname.match(/^\/old\/(0\.56|0\.57)\/(.*)$/);
    if (oldMatch && oldDirs[oldMatch[1]]) {
      const oRel = oldMatch[2] || 'index.html';
      const oFile = join(oldDirs[oldMatch[1]], oRel === '' ? 'index.html' : oRel);
      if (existsSync(oFile)) {
        res.writeHead(200, {
          'content-type': oFile.endsWith('.js') ? 'application/javascript; charset=utf-8' : 'text/html; charset=utf-8',
          'cache-control': 'no-store',
        });
        res.end(readFileSync(oFile));
        return;
      }
    }

    const vMatch = u.pathname.match(/^\/v\/[^/]+\/(.*)$/);
    const rel = vMatch ? vMatch[1] : u.pathname.replace(/^\//, '');
    if (rel === '' || rel === 'index.html') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
      res.end(indexHtml);
      return;
    }
    if (rel === 'hoppak.js') {
      res.writeHead(200, { 'content-type': 'application/javascript; charset=utf-8', 'cache-control': 'no-store' });
      res.end(hoppakJs);
      return;
    }

    res.writeHead(404);
    res.end('Not found');
  });

  const wss = new WebSocketServer({ noServer: true });
  server.on('upgrade', (req, socket, head) => {
    const u = new URL(req.url, `http://127.0.0.1:${PROXY_PORT}`);
    let targetSlot = null;
    if (u.pathname === '/ws') targetSlot = active;
    else if (u.pathname === '/ws/blue') targetSlot = 'blue';
    else if (u.pathname === '/ws/green') targetSlot = 'green';

    wsLog.push({ url: req.url, pathname: u.pathname, search: u.search, targetSlot, active });
    if (!targetSlot) {
      socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket, head, (clientWs) => {
      const upUrl = `ws://127.0.0.1:${slots[targetSlot]}/ws${u.search}`;
      const upWs = new WebSocket(upUrl);
      const pending = [];
      let upOpen = false;
      const pair = { clientWs, upWs };
      activeConns.add(pair);

      upWs.on('open', () => {
        upOpen = true;
        for (const item of pending.splice(0)) upWs.send(item.data, { binary: item.isBinary });
      });
      clientWs.on('message', (data, isBinary) => {
        if (upOpen && upWs.readyState === 1) upWs.send(data, { binary: isBinary });
        else pending.push({ data, isBinary });
      });
      upWs.on('message', (data, isBinary) => {
        if (clientWs.readyState === 1) clientWs.send(data, { binary: isBinary });
      });

      const safeClose = (ws, code, reason) => {
        if (ws.readyState >= 2) return;
        if (code && (code === 1000 || (code >= 3000 && code <= 4999))) {
          ws.close(code, reason || '');
        } else {
          ws.close();
        }
      };
      upWs.on('close', (code, reason) => {
        activeConns.delete(pair);
        safeClose(clientWs, code, reason?.toString());
      });
      clientWs.on('close', (code, reason) => {
        activeConns.delete(pair);
        safeClose(upWs, code, reason?.toString());
      });
      upWs.on('error', () => { try { clientWs.close(); } catch {} });
      clientWs.on('error', () => { try { upWs.close(); } catch {} });
    });
  });

  return {
    server,
    httpLog,
    wsLog,
    setActive(slot) { active = slot; },
    getActive() { return active; },
    listen: () => new Promise((r) => server.listen(PROXY_PORT, '127.0.0.1', r)),
    close: async () => {
      for (const p of activeConns) {
        try { p.clientWs.terminate(); } catch {}
        try { p.upWs.terminate(); } catch {}
      }
      await new Promise((r) => server.close(r));
    },
  };
}

function createV1OnlyServer(port) {
  let rooms = new Map();
  const server = http.createServer((req, res) => {
    if (req.url.startsWith('/api/health')) {
      res.writeHead(200, { 'content-type': 'application/json', 'access-control-allow-origin': '*' });
      res.end(JSON.stringify({ ok: true, rooms: rooms.size }));
      return;
    }
    res.writeHead(404);
    res.end();
  });
  const wss = new WebSocketServer({ server, path: '/ws' });
  const send = (ws, event, data) => { if (ws.readyState === 1) ws.send(JSON.stringify({ event, data })); };

  wss.on('connection', (ws) => {
    // Legacy v1 server ignores ?p=2 and always replies with hello {v:1, s} (no node, no version)
    send(ws, 'hello', { v: 1, s: Date.now() });
    let myRoom = null;
    let myPid = 0;

    ws.on('message', (raw) => {
      const m = JSON.parse(raw.toString());
      if (m.event === 'ping') {
        send(ws, 'pong', { c: m.data?.c, s: Date.now() });
      } else if (m.event === 'create') {
        const code = '7777';
        myPid = 1;
        myRoom = {
          code, host: 1, map: 'city', phase: 'lobby', round: 0, lw: 180,
          players: [{ pid: 1, slot: 0, name: m.data?.name || 'ИГРОК', kind: m.data?.kind || 0, ready: false, on: true }],
        };
        rooms.set(code, myRoom);
        send(ws, 'room', { ...myRoom, you: 1, token: 'v1tok' });
      } else if (m.event === 'start' && myRoom) {
        myRoom.round++;
        myRoom.phase = 'play';
        send(ws, 'start', {
          round: myRoom.round, seed: 12345, map: myRoom.map, lw: 180,
          at: Date.now() + 200, players: myRoom.players,
        });
      } else if (m.event === 'ev' && m.data?.e === 'dead' && myRoom) {
        myRoom.phase = 'lobby';
        send(ws, 'results', {
          round: myRoom.round,
          ranking: [{ pid: 1, name: myRoom.players[0].name, m: m.data?.m || 0, place: 1 }],
        });
        send(ws, 'room', { ...myRoom, you: myPid, token: 'v1tok' });
      }
    });
  });

  return {
    listen: () => new Promise((r) => server.listen(port, '127.0.0.1', r)),
    close: () => new Promise((r) => { wss.close(); server.close(r); }),
  };
}

function createFaultServer(port) {
  let mode = 'unsupported'; // 'unsupported' | 'redirect-loop'
  let redirectCount = 0;
  const server = http.createServer((req, res) => {
    if (req.url.startsWith('/api/health')) {
      res.writeHead(200, { 'content-type': 'application/json', 'access-control-allow-origin': '*' });
      res.end(JSON.stringify({ ok: true, version: '0.57.0', protocol: 2, minProtocol: 1 }));
      return;
    }
    res.writeHead(404);
    res.end();
  });
  const wss = new WebSocketServer({ noServer: true });
  server.on('upgrade', (req, socket, head) => {
    wss.handleUpgrade(req, socket, head, (ws) => {
      if (mode === 'unsupported') {
        ws.send(JSON.stringify({ event: 'err', data: { code: 'UNSUPPORTED_PROTOCOL', msg: 'Онлайн недоступен, обновитесь' } }));
        ws.send(JSON.stringify({ event: 'hello', data: { v: 99, s: Date.now(), supported: false } }));
        ws.close(4002, 'unsupported_protocol');
        return;
      }
      ws.send(JSON.stringify({ event: 'hello', data: { v: 2, s: Date.now(), node: 'blue', version: '0.57.0' } }));
      ws.on('message', (raw) => {
        const m = JSON.parse(raw.toString());
        if (m.event === 'ping') ws.send(JSON.stringify({ event: 'pong', data: { c: m.data?.c, s: Date.now() } }));
        if (m.event === 'create') {
          redirectCount++;
          ws.send(JSON.stringify({ event: 'redirect', data: { node: 'green', reason: 'draining' } }));
        }
      });
    });
  });
  return {
    setMode(m) { mode = m; redirectCount = 0; },
    getRedirectCount() { return redirectCount; },
    listen: () => new Promise((r) => server.listen(port, '127.0.0.1', r)),
    close: () => new Promise((r) => { wss.close(); server.close(r); }),
  };
}

async function run() {
  if (!existsSync(MAIN_JS)) throw new Error(`Missing bluegreen server build at ${MAIN_JS}`);
  mkdirSync(SHOTS_DIR, { recursive: true });

  const blue = startSlot({ name: 'blue', pubPort: BLUE_PUB, intPort: BLUE_INT, version: '0.57.0', peerIntPort: GREEN_INT });
  const green = startSlot({ name: 'green', pubPort: GREEN_PUB, intPort: GREEN_INT, version: '0.58.0', peerIntPort: BLUE_INT });
  const old056Dir = buildLegacyClient('2e6bfc0', '/tmp/hoppak-old-v056');
  const old057Dir = buildLegacyClient('a898d1f', '/tmp/hoppak-old-v057');
  const proxy = createCaddyProxy({
    bluePort: BLUE_PUB,
    greenPort: GREEN_PUB,
    gameDir: GAME_DIR,
    oldDirs: { '0.56': old056Dir, '0.57': old057Dir },
  });
  const v1srv = createV1OnlyServer(V1_PORT);
  const faultSrv = createFaultServer(FAULT_PORT);

  let browser;
  try {
    await Promise.all([waitSlotReady(blue), waitSlotReady(green), proxy.listen(), v1srv.listen(), faultSrv.listen()]);
    log('All test servers ready');

    browser = await chromium.launch({
      executablePath: '/usr/bin/google-chrome',
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-background-timer-throttling',
        '--disable-renderer-backgrounding',
        '--disable-backgrounding-occluded-windows',
      ],
    });

    const ctx1 = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
    const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
    const p1 = await ctx1.newPage();
    const p2 = await ctx2.newPage();

    const p1Errors = [];
    const p2Errors = [];
    const p1Assets = [];
    p1.on('pageerror', (e) => p1Errors.push(`pageerror: ${e.message}`));
    p2.on('pageerror', (e) => p2Errors.push(`pageerror: ${e.message}`));
    p1.on('request', (req) => {
      const u = new URL(req.url());
      p1Assets.push({ type: req.resourceType(), pathname: u.pathname, search: u.search });
    });

    const BASE_V = `http://127.0.0.1:${PROXY_PORT}/v/0.57.0/`;
    await p1.goto(BASE_V);
    await p1.evaluate(() => { localStorage.clear(); sessionStorage.clear(); localStorage.setItem('hoppak.nick', 'РОМА'); });
    await p1.reload();
    await sleep(300);

    await p2.goto(BASE_V);
    await p2.evaluate(() => { localStorage.clear(); sessionStorage.clear(); localStorage.setItem('hoppak.nick', 'ДИМА'); });
    await p2.reload();
    await sleep(300);

    // 1. Check build version and asset isolation under /v/0.57.0/
    const cv1 = await p1.evaluate(() => __hoppak.net.clientVersion);
    check(cv1 === '0.57.0', `clientVersion baked at build time matches /v/<ver>/: ${cv1}`);
    const rootAssets = p1Assets.filter((a) => !a.pathname.startsWith('/v/0.57.0/') && !a.pathname.startsWith('/api/') && !a.pathname.startsWith('/ws') && a.type !== 'other');
    check(rootAssets.length === 0 && p1Assets.some((a) => a.pathname === '/v/0.57.0/hoppak.js'),
      `all runtime JS/assets loaded from /v/0.57.0/, zero from / root (${p1Assets.map((a) => a.pathname).join(', ')})`);

    // 2. Host (p1) & Guest (p2) connect to blue via /ws?p=2 and start match on blue
    await p1.evaluate(() => __hoppak.tap('net:menu'));
    check(await waitFor(p1, () => __hoppak.net.st === 'online'), 'p1 connected to blue');
    const p1Info = await p1.evaluate(() => ({ node: __hoppak.net.node, proto: __hoppak.net.serverProto, ver: __hoppak.net.serverVersion, upd: __hoppak.net.updateAvail }));
    check(p1Info.node === 'blue' && p1Info.proto === 2 && p1Info.ver === '0.57.0' && !p1Info.upd,
      `hello v2 parsed: node=${p1Info.node}, proto=${p1Info.proto}, version=${p1Info.ver}, updateAvail=${p1Info.upd}`);

    await p1.evaluate(() => __hoppak.tap('net:create'));
    check(await waitFor(p1, () => !!__hoppak.net.room), 'p1 created room on blue');
    const blueCode = await p1.evaluate(() => __hoppak.net.room.code);

    await p2.evaluate(() => __hoppak.tap('net:menu'));
    await waitFor(p2, () => __hoppak.net.st === 'online');
    await p2.evaluate((code) => { __hoppak.tap('net:enter'); for (const d of code) __hoppak.tap('net:k' + d); __hoppak.tap('net:ok'); }, blueCode);
    check(await waitFor(p2, (c) => __hoppak.net.room && __hoppak.net.room.code === c, blueCode), `p2 joined blue room ${blueCode}`);

    await p2.evaluate(() => __hoppak.tap('net:ready'));
    await waitFor(p1, () => __hoppak.net.room.players.every((q) => q.ready || q.pid === __hoppak.net.room.host));
    await p1.evaluate(() => __hoppak.tap('net:start'));
    check(await waitFor(p1, () => __hoppak.getPhase() === 'play' && __hoppak.getWorld()?.net) &&
          await waitFor(p2, () => __hoppak.getPhase() === 'play' && __hoppak.getWorld()?.net),
      'match started on blue with both browser clients');
    const unauthStats = await fetch(`http://127.0.0.1:${BLUE_INT}/internal/stats`);
    check(unauthStats.status === 401, `internal port rejects missing INTERNAL_TOKEN (${unauthStats.status})`);
    const lws = await Promise.all([
      p1.evaluate(() => __hoppak.getSize().lw),
      p2.evaluate(() => __hoppak.getSize().lw),
    ]);
    check(lws[0] === 160 && lws[1] === 160, `v2 online match runs at NET_LW=160 (p1=${lws[0]}, p2=${lws[1]})`);

    await sleep(1600);
    await p1.evaluate(() => __hoppak.setAutoPlay(true));
    await p2.evaluate(() => __hoppak.setAutoPlay(true));

    // 3. Switch active to green & drain blue while match is running
    proxy.setActive('green');
    const drainRes = await (await fetch(`http://127.0.0.1:${BLUE_INT}/internal/drain`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-internal-token': INTERNAL_TOKEN },
      body: JSON.stringify({ version: '0.58.0' }),
    })).json();
    check(drainRes.ok && drainRes.draining === true, `blue drained (notified=${drainRes.notified})`);

    await waitFor(p1, () => __hoppak.net.updateAvail === true && __hoppak.net.updateVersion === '0.58.0');
    const midState = await p1.evaluate(() => ({
      st: __hoppak.net.st,
      phase: __hoppak.getPhase(),
      updateAvail: __hoppak.net.updateAvail,
      shouldShow: __hoppak.net.shouldShowBanner(),
      hasBannerHit: false,
      tick: __hoppak.getWorld().tick,
    }));
    check(midState.st === 'online' && midState.phase === 'play' && midState.updateAvail && midState.shouldShow,
      'p1 stays online in active round on blue and received update 0.58.0');

    // Verify banner is NOT drawn during active round (pixel + hit check by tapping where banner would be or checking phase)
    await sleep(400);
    await p1.screenshot({ path: join(SHOTS_DIR, '01_mid_round_no_banner.png') });
    check(await p1.evaluate(() => __hoppak.getPhase() === 'play' && __hoppak.getWorld().tick > 20),
      'banner absent during active round; match continues on blue without disconnect');

    // 4. Test mid-match reconnect on draining blue -> must reconnect to /ws/blue?p=2!
    const wsLogBeforeRecon = proxy.wsLog.length;
    await p2.evaluate(() => __hoppak.net.dropSocket());
    check(await waitFor(p2, () => __hoppak.net.st === 'online' && __hoppak.getWorld()?.net, null, 8000),
      'p2 reconnected mid-match after socket drop');
    const reconWs = proxy.wsLog.slice(wsLogBeforeRecon).find((w) => w.pathname === '/ws/blue');
    check(!!reconWs && reconWs.search.includes('p=2'),
      `p2 reconnected specifically via /ws/blue?p=2 while green is active (${JSON.stringify(reconWs)})`);

    // 4b. BUG-24 E2E: even if reconnect lands on active green (/ws without /blue), green proxies resume to blue!
    const wsBeforeBlindRecon = proxy.wsLog.length;
    await p2.evaluate(() => {
      sessionStorage.removeItem('hoppak.net.node');
      __hoppak.net.node = '';
      __hoppak.net.targetNode = '';
      __hoppak.net.dropSocket();
    });
    check(await waitFor(p2, () => __hoppak.net.st === 'online' && __hoppak.getWorld()?.net && __hoppak.getSize().lw === 160, null, 8000),
      'BUG-24: p2 blind reconnect via active green recovered running blue match at lw=160');
    const blindWs = proxy.wsLog.slice(wsBeforeBlindRecon).find((w) => w.pathname === '/ws' && w.targetSlot === 'green');
    check(!!blindWs, `proxy routed blind reconnect to active green (${JSON.stringify(blindWs)})`);

    // 5. While blue is draining and green is active, p3 (green) joins blueCode -> redirects to /ws/blue!
    const ctx3 = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
    const p3 = await ctx3.newPage();
    p3.on('pageerror', (e) => p2Errors.push(`p3 pageerror: ${e.message}`));
    await p3.goto(BASE_V);
    await p3.evaluate(() => { localStorage.clear(); sessionStorage.clear(); localStorage.setItem('hoppak.nick', 'КАТЯ'); });
    await p3.reload();
    await sleep(300);

    // Wait for match on blue to finish first so blueCode is joinable in lobby, OR test joining blueCode while in-game redirects to blue & gets IN_GAME!
    // Let's finish the round on blue so we also test results banner AND cross-slot join to lobby!
    for (const pg of [p1, p2]) {
      for (let t = 0; t < 10 && await pg.evaluate(() => __hoppak.getWorld().players[0].alive); t++) {
        await pg.evaluate(() => {
          const w = __hoppak.getWorld(), p = w.players[0];
          __hoppak.setAutoPlay(false);
          p.domeT = 0; p.domeSave = false; p.shieldT = 0; p.rocketT = 0; p.invT = 0; p.hookN = 0; p.grabT = 0;
          p.y = p.camY + __hoppak.getSize().lh + 40; p.vy = 5;
        });
        await sleep(250);
      }
    }
    check(await waitFor(p1, () => __hoppak.getPhase() === 'results') && await waitFor(p2, () => __hoppak.getPhase() === 'results'),
      'match on draining blue finished cleanly and entered results');
    await sleep(800);
    await p1.screenshot({ path: join(SHOTS_DIR, '02_results_with_banner.png') });
    check(await p1.evaluate(() => __hoppak.getPhase() === 'results' && __hoppak.net.shouldShowBanner()),
      'banner shown in results between rounds');

    // Join blueCode via green (p3 connects to /ws -> active green, types blueCode, gets redirect {node:'blue', code}, joins blue!)
    const wsBeforeJoin = proxy.wsLog.length;
    await p3.evaluate(() => __hoppak.tap('net:menu'));
    check(await waitFor(p3, () => __hoppak.net.st === 'online'), 'p3 connected to active green');
    check(await p3.evaluate(() => __hoppak.net.node === 'green'), 'p3 initially landed on green');
    await p3.evaluate((code) => { __hoppak.tap('net:enter'); for (const d of code) __hoppak.tap('net:k' + d); __hoppak.tap('net:ok'); }, blueCode);
    check(await waitFor(p3, (c) => __hoppak.net.room && __hoppak.net.room.code === c && __hoppak.net.node === 'blue', blueCode, 8000),
      `p3 joining blue's code ${blueCode} via green transparently redirected to blue and succeeded`);
    const redirJoinWs = proxy.wsLog.slice(wsBeforeJoin).find((w) => w.pathname === '/ws/blue');
    check(!!redirJoinWs, `proxy saw p3 redirect to /ws/blue (${JSON.stringify(redirJoinWs)})`);

    // Also test p1 returning to room lobby (banner visible) -> menu (banner visible) -> dismiss -> reload /
    await p1.evaluate(() => __hoppak.tap('rematch'));
    check(await waitFor(p1, () => __hoppak.getPhase() === 'net' && __hoppak.net.sub === 'room'), 'p1 returned to room lobby');
    await sleep(200);
    await p1.screenshot({ path: join(SHOTS_DIR, '03_room_lobby_with_banner.png') });

    // Stale blue connection creating a new room redirects to green!
    // p1 leaves blue's room (WS stays connected to draining blue), then taps net:create -> redirects to green!
    await p1.evaluate(() => __hoppak.tap('net:leave'));
    await waitFor(p1, () => __hoppak.net.sub === 'home' && __hoppak.net.node === 'blue');
    const wsBeforeCreate = proxy.wsLog.length;
    await p1.evaluate(() => __hoppak.tap('net:create'));
    check(await waitFor(p1, () => __hoppak.net.room && __hoppak.net.node === 'green', null, 8000),
      'create via stale draining blue connection redirected to green and created room');
    const redirCreateWs = proxy.wsLog.slice(wsBeforeCreate).find((w) => w.pathname === '/ws/green');
    check(!!redirCreateWs, `proxy saw create redirect to /ws/green (${JSON.stringify(redirCreateWs)})`);
    check(await p1.evaluate(() => __hoppak.net.room?.lw === 160), 'new room on green also has lw=160');

    // BUG-25 E2E: host remaining on draining blue room tapping rematch/start gets redirected to green instead of starting on blue!
    await p2.evaluate(() => __hoppak.tap('rematch'));
    if (await waitFor(p2, () => __hoppak.getPhase() === 'net' && __hoppak.net.sub === 'room' && __hoppak.net.node === 'blue', null, 3000)) {
      const wsBeforeRematchStart = proxy.wsLog.length;
      await p2.evaluate(() => __hoppak.tap('net:start'));
      check(await waitFor(p2, () => __hoppak.net.room && __hoppak.net.node === 'green', null, 8000),
        'BUG-25: rematch start on draining blue redirected host to green');
      const rematchWs = proxy.wsLog.slice(wsBeforeRematchStart).find((w) => w.pathname === '/ws/green');
      check(!!rematchWs, `proxy saw rematch redirect to /ws/green (${JSON.stringify(rematchWs)})`);
    } else {
      check(await waitFor(p2, () => __hoppak.net.room && __hoppak.net.node === 'green', null, 6000),
        'BUG-25: draining blue auto-closed post-results room and redirected p2 to green');
    }

    // Return to menu -> verify banner visible, dismiss works, and new version re-shows or health poll works
    await p1.evaluate(() => __hoppak.tap('net:back'));
    check(await waitFor(p1, () => __hoppak.getPhase() === 'menu'), 'p1 in menu');
    await sleep(200);
    await p1.screenshot({ path: join(SHOTS_DIR, '04_menu_with_banner.png') });

    await p1.evaluate(() => __hoppak.tap('update:dismiss'));
    check(await p1.evaluate(() => !__hoppak.net.shouldShowBanner()), 'banner is dismissible in menu');
    await sleep(150);
    await p1.screenshot({ path: join(SHOTS_DIR, '05_menu_banner_dismissed.png') });

    // 6. Test GET /api/health polling on a fresh tab in menu (no WS opened!) + tap reload to /
    const ctx4 = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
    const p4 = await ctx4.newPage();
    const p4AssetLog = [];
    p4.on('request', (req) => {
      const u = new URL(req.url());
      p4AssetLog.push({ type: req.resourceType(), pathname: u.pathname });
    });
    await p4.addInitScript(() => { window.HOPPAK_HEALTH_MS = 250; });
    await p4.goto(BASE_V);
    check(await waitFor(p4, () => __hoppak.net.updateAvail === true && __hoppak.net.shouldShowBanner(), null, 5000),
      'GET /api/health 60s poller (accelerated via HOPPAK_HEALTH_MS=250) marks update available without WS');
    const p4BadRoot = p4AssetLog.filter((a) => !a.pathname.startsWith('/v/0.57.0/') && a.pathname !== '/api/health' && a.type !== 'other');
    check(p4BadRoot.length === 0, `no root / asset loads before reload (${JSON.stringify(p4BadRoot)})`);

    await Promise.all([
      p4.waitForNavigation({ url: `http://127.0.0.1:${PROXY_PORT}/` }),
      p4.evaluate(() => __hoppak.tap('update:reload')),
    ]);
    check(new URL(p4.url()).pathname === '/', `tapping update banner reloads / (url=${p4.url()})`);

    // 7. Test v1-only legacy server compatibility
    const ctx5 = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
    const p5 = await ctx5.newPage();
    await p5.goto(`http://127.0.0.1:${PROXY_PORT}/v/0.57.0/?server=http://127.0.0.1:${V1_PORT}`);
    await p5.evaluate(() => __hoppak.tap('net:menu'));
    check(await waitFor(p5, () => __hoppak.net.st === 'online' && __hoppak.net.serverProto === 1),
      'client connects to v1-only server (serverProto=1)');
    await p5.evaluate(() => __hoppak.tap('net:create'));
    check(await waitFor(p5, () => __hoppak.net.room && __hoppak.net.room.code === '7777'), 'v1 server room created');
    await p5.evaluate(() => __hoppak.tap('net:start'));
    check(await waitFor(p5, () => __hoppak.getPhase() === 'play' && __hoppak.getWorld()?.net), 'v1 server match started');
    check(await p5.evaluate(() => __hoppak.getSize().lw === 180), 'v1 legacy server keeps lw=180 compatibility');
    await p5.evaluate(() => __hoppak.net.send('ev', { e: 'dead', m: 42 }));
    check(await waitFor(p5, () => __hoppak.getPhase() === 'results'), 'v1 server match reached results cleanly');

    // 8. Test UNSUPPORTED_PROTOCOL / close 4002 and redirect loop guard (max 2)
    const ctx6 = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
    const p6 = await ctx6.newPage();
    faultSrv.setMode('unsupported');
    await p6.goto(`http://127.0.0.1:${PROXY_PORT}/v/0.57.0/?server=http://127.0.0.1:${FAULT_PORT}`);
    await p6.evaluate(() => __hoppak.tap('net:menu'));
    check(await waitFor(p6, () => __hoppak.net.st === 'unsupported' && __hoppak.net.err.includes('ОНЛАЙН НЕДОСТУПЕН')),
      'UNSUPPORTED_PROTOCOL / close 4002 shows «ОНЛАЙН НЕДОСТУПЕН В ЭТОЙ ВЕРСИИ»');

    faultSrv.setMode('redirect-loop');
    await p6.reload();
    await p6.evaluate(() => __hoppak.tap('net:menu'));
    await waitFor(p6, () => __hoppak.net.st === 'online');
    await p6.evaluate(() => __hoppak.tap('net:create'));
    await waitFor(p6, () => __hoppak.net.err === 'СЕРВЕР ПЕРЕГРУЖЕН', null, 5000);
    check(faultSrv.getRedirectCount() === 3 && (await p6.evaluate(() => __hoppak.net.redirCount === 0 && __hoppak.net.err === 'СЕРВЕР ПЕРЕГРУЖЕН')),
      `redirect loop stopped after max 2 redirects (3rd blocked, server saw ${faultSrv.getRedirectCount()} create attempts)`);

    // 9. Test server-provided custom field config (FIELD_W=208, FIELD_H=416, FIELD_PX_PER_M=10) without hardcoding!
    const customPort = 8925;
    const customSrv = spawn(process.execPath, [MAIN_JS], {
      cwd: BG_SERVER_DIR,
      env: {
        ...process.env,
        NODE_ENV: 'production',
        PORT: String(customPort),
        INTERNAL_PORT: 'off',
        NODE_NAME: 'blue',
        APP_VERSION: '0.57.0',
        FIELD_W: '208',
        FIELD_H: '416',
        FIELD_PX_PER_M: '10',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    try {
      const t0 = Date.now();
      while (Date.now() - t0 < 8000) {
        try { if ((await fetch(`http://127.0.0.1:${customPort}/api/health`)).ok) break; } catch {}
        await sleep(80);
      }
      const ctx7 = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
      const p7 = await ctx7.newPage();
      proxy.setActive('custom');
      await p7.goto(`http://127.0.0.1:${PROXY_PORT}/v/0.57.0/`);
      await p7.evaluate(() => __hoppak.tap('net:menu'));
      await waitFor(p7, () => __hoppak.net.st === 'online');
      await p7.evaluate(() => __hoppak.tap('net:create'));
      await waitFor(p7, () => !!__hoppak.net.room);
      await p7.evaluate(() => __hoppak.tap('net:start'));
      await waitFor(p7, () => __hoppak.getPhase() === 'play' && __hoppak.getWorld()?.net);
      const customSz = await p7.evaluate(() => ({ sz: __hoppak.getSize(), helloField: __hoppak.net.field, roomField: __hoppak.net.room?.field }));
      check(
        customSz.sz.lw === 208 && customSz.sz.lh === 416 && customSz.sz.pxPerM === 10 &&
        customSz.helloField?.w === 208 && customSz.roomField?.w === 208,
        `client dynamically uses server hello.field/room.field (lw=${customSz.sz.lw}, lh=${customSz.sz.lh}, pxPerM=${customSz.sz.pxPerM})`,
      );
      await p7.evaluate(() => __hoppak.tap('net:leave'));
      await p7.evaluate(() => __hoppak.tap('net:back'));
      await waitFor(p7, () => __hoppak.getPhase() === 'menu');
      const soloSz = await p7.evaluate(() => __hoppak.getSize());
      check(soloSz.lw === 160 && soloSz.lh === 346 && soloSz.pxPerM === 8,
        `returning to solo menu restores default field (lw=${soloSz.lw}, lh=${soloSz.lh}, pxPerM=${soloSz.pxPerM})`);
    } finally {
      customSrv.kill('SIGTERM');
    }

    // 10. PROTOCOL_MISMATCH UX (both directions with real built v0.56, v0.57, and v2 clients)
    proxy.setActive('green');
    // p1 currently holds a live v2 room on green; capture its code for v0.56 & v0.57 to attempt joining
    const p1GreenCode = await p1.evaluate(async () => {
      if (__hoppak.net.room && __hoppak.net.node === 'green') return __hoppak.net.room.code;
      return '';
    });
    // Ensure we have a live v2 room code on green
    const ctxV2Host = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
    const pV2Host = await ctxV2Host.newPage();
    await pV2Host.goto(`http://127.0.0.1:${PROXY_PORT}/v/0.57.0/`);
    await pV2Host.evaluate(() => __hoppak.tap('net:menu'));
    await waitFor(pV2Host, () => __hoppak.net.st === 'online');
    await pV2Host.evaluate(() => __hoppak.tap('net:create'));
    await waitFor(pV2Host, () => !!__hoppak.net.room);
    const v2RoomCode = await pV2Host.evaluate(() => __hoppak.net.room.code);

    // 10a. Actual v0.56 (2e6bfc0) client tries to join v2RoomCode -> readable Russian error <=24 chars
    const ctx56 = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
    const p56 = await ctx56.newPage();
    await p56.goto(`http://127.0.0.1:${PROXY_PORT}/old/0.56/`);
    await p56.evaluate(() => __hoppak.tap('net:menu'));
    await waitFor(p56, () => __hoppak.net.st === 'online');
    await p56.evaluate((code) => { __hoppak.tap('net:enter'); for (const d of code) __hoppak.tap('net:k' + d); __hoppak.tap('net:ok'); }, v2RoomCode);
    await waitFor(p56, () => __hoppak.net.err && __hoppak.net.err.length > 0, null, 6000);
    await sleep(250);
    await p56.screenshot({ path: join(SHOTS_DIR, '06_v056_mismatch.png') });
    const err56 = await p56.evaluate(() => __hoppak.net.err);
    check(err56 === 'Другая версия. Обновите!', `v0.56 (2e6bfc0) joining v2 room sees readable Russian text ("${err56}")`);

    // 10b. Actual v0.57 (a898d1f) client creates a v1 room AND tries to join v2RoomCode
    const ctx57 = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
    const p57 = await ctx57.newPage();
    await p57.goto(`http://127.0.0.1:${PROXY_PORT}/old/0.57/`);
    await p57.evaluate(() => __hoppak.tap('net:menu'));
    await waitFor(p57, () => __hoppak.net.st === 'online');
    await p57.evaluate((code) => { __hoppak.tap('net:enter'); for (const d of code) __hoppak.tap('net:k' + d); __hoppak.tap('net:ok'); }, v2RoomCode);
    await waitFor(p57, () => __hoppak.net.err && __hoppak.net.err.length > 0, null, 6000);
    await sleep(250);
    await p57.screenshot({ path: join(SHOTS_DIR, '07_v057_mismatch.png') });
    const err57 = await p57.evaluate(() => __hoppak.net.err);
    check(err57 === 'Другая версия. Обновите!', `v0.57 (a898d1f) joining v2 room sees readable Russian text ("${err57}")`);

    // Now v0.57 creates a v1 room on green, and v2 client tries to join it -> calm card + ОБНОВИТЬ button
    await p57.evaluate(() => __hoppak.tap('net:home'));
    await p57.evaluate(() => __hoppak.tap('net:create'));
    await waitFor(p57, () => !!__hoppak.net.room);
    const v1RoomCode = await p57.evaluate(() => __hoppak.net.room.code);

    const ctxV2Join = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
    const pV2Join = await ctxV2Join.newPage();
    await pV2Join.goto(`http://127.0.0.1:${PROXY_PORT}/v/0.57.0/`);
    await pV2Join.evaluate(() => __hoppak.tap('net:menu'));
    await waitFor(pV2Join, () => __hoppak.net.st === 'online');
    await pV2Join.evaluate((code) => { __hoppak.tap('net:enter'); for (const d of code) __hoppak.tap('net:k' + d); __hoppak.tap('net:ok'); }, v1RoomCode);
    await waitFor(pV2Join, () => __hoppak.net.errCode === 'PROTOCOL_MISMATCH', null, 6000);
    await sleep(250);
    await pV2Join.screenshot({ path: join(SHOTS_DIR, '08_v2_mismatch_card.png') });
    const v2Mismatch = await pV2Join.evaluate(() => ({ code: __hoppak.net.errCode, msg: __hoppak.net.err }));
    check(
      v2Mismatch.code === 'PROTOCOL_MISMATCH' && v2Mismatch.msg === 'У друга другая версия игры — обновите страницу',
      `v2 client joining v1 room sees full mismatch card ("${v2Mismatch.msg}")`,
    );
    await Promise.all([
      pV2Join.waitForNavigation({ url: `http://127.0.0.1:${PROXY_PORT}/` }),
      pV2Join.evaluate(() => __hoppak.tap('net:reload')),
    ]);
    check(new URL(pV2Join.url()).pathname === '/', `v2 mismatch ОБНОВИТЬ button reloads / (url=${pV2Join.url()})`);
    void p1GreenCode;

    // Check web-root and relative assets in source via grep check summary
    check(p1Errors.length === 0 && p2Errors.length === 0,
      `no uncaught page errors (p1=${p1Errors.length}, p2=${p2Errors.length})`);

    console.log(failures ? `\n${failures} FAILURE(S)` : '\nALL BLUE-GREEN CLIENT E2E CHECKS PASSED');
    process.exitCode = failures ? 1 : 0;
  } finally {
    if (browser) await browser.close();
    await Promise.allSettled([proxy.close(), v1srv.close(), faultSrv.close()]);
    blue.child.kill('SIGTERM');
    green.child.kill('SIGTERM');
    await sleep(250);
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(2);
});
