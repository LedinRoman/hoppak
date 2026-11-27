'use strict';
/**
 * Client profile e2e. Always rebuilds the prod site first (same-origin /api, title v0.6).
 * A staging build (HOP_STAGING, baked remote origin) is the wrong page for this script.
 *
 *   cd game && bash build.sh site && node tests/profile-e2e.js
 */
const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const { execFileSync } = require('child_process');
const pp = require(process.env.HOP_PUPPETEER || '/tmp/pp/node_modules/puppeteer-core');
const path = require('path');
const os = require('os');
const { once } = require('events');
const { pathToFileURL } = require('url');
const { createServer, seenLog } = require('../../tools/profile-mock');

execFileSync('bash', ['build.sh', 'site'], {
  cwd: path.resolve(__dirname, '..'),
  stdio: 'inherit',
});

async function newRussianPage(context) {
  const page = await context.newPage();
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'language', { get: () => 'ru-RU' });
    Object.defineProperty(navigator, 'languages', { get: () => ['ru-RU', 'ru'] });
  });
  return page;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function settle(pg) {
  await pg.waitForFunction(() => {
    const p = window.__hoppak && window.__hoppak.profile;
    return !!(p && p.getState().st !== 'syncing');
  }, { timeout: 4000 }).catch(() => {});
}

const WAIT_MS = 8000;
const WAIT_OPTIONS = { timeout: WAIT_MS, polling: 50 };
const PROFILE_PREFIX = 'hoppak-profile-e2e-';
const OWNER_FILE = 'e2e-owner.json';

async function waitForState(pg, label, predicate, ...args) {
  try {
    const handle = await pg.waitForFunction(predicate, WAIT_OPTIONS, ...args);
    await handle.dispose();
  } catch (error) {
    throw new Error(label + ' (' + WAIT_MS + ' ms)', { cause: error });
  }
}

function waitCoins(pg, coins, label, telegramId = '', best = 0) {
  return waitForState(pg, label, (coins, telegramId, best) => {
    const g = window.__hoppak;
    const state = g?.profile?.getState();
    return state?.st === 'ready' && state.profile?.migratedAt
      && state.profile.coins === coins && g.getSave().coins === coins
      && (best === 0 || state.profile.best >= best) && state.telegramId === telegramId
      && state.queueLen === 0 && state.pendingBuysLen === 0;
  }, coins, telegramId, best);
}

async function seedSave(pg, origin, { coins, best = 0, owned = {}, char = 0 }) {
  await pg.evaluateOnNewDocument((expectedOrigin, save) => {
    if (location.origin === expectedOrigin && !localStorage.getItem('hoppak_save')) {
      localStorage.setItem('hoppak_save', save);
    }
  }, origin, JSON.stringify({
    v5: 1, coins, best, mapBest: { city: best }, owned, char,
    bg: 'city', sfx: true, vib: true,
  }));
}

async function waitSeen(playerId, since, exit, label) {
  const deadline = Date.now() + WAIT_MS;
  do {
    const entry = seenLog.slice(since).find((entry) => entry.playerId === playerId && entry.exit === exit);
    if (entry) return entry;
    await sleep(25);
  } while (Date.now() < deadline);
  throw new Error(label + ' (' + WAIT_MS + ' ms)');
}

function closeServer(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => error && error.code !== 'ERR_SERVER_NOT_RUNNING' ? reject(error) : resolve());
    server.closeAllConnections();
  });
}

function reapOrphanedBrowsers() {
  if (process.platform !== 'linux') return;
  const temp = os.tmpdir();
  for (const entry of fs.readdirSync(temp, { withFileTypes: true })) {
    if (!entry.isDirectory() || !entry.name.startsWith(PROFILE_PREFIX)) continue;
    const profile = path.join(temp, entry.name);
    try {
      if (fs.statSync(profile).uid !== process.getuid()) continue;
      const { runnerPid, chromePid } = JSON.parse(fs.readFileSync(path.join(profile, OWNER_FILE), 'utf8'));
      if (![runnerPid, chromePid].every(pid => Number.isInteger(pid) && pid > 1)) continue;
      try {
        process.kill(runnerPid, 0);
        continue;
      } catch (error) {
        if (error.code !== 'ESRCH') continue;
      }
      const args = fs.readFileSync('/proc/' + chromePid + '/cmdline', 'utf8').split('\0');
      if (args.includes('--user-data-dir=' + profile)) process.kill(chromePid, 'SIGTERM');
    } catch {
      // The directory might lack a marker, or the recorded process may already have exited.
    }
  }
}

async function admin(base, body) {
  const r = await fetch(base + '/__mock/admin', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return r.json();
}

(async () => {
  const servers = [];
  reapOrphanedBrowsers();
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), PROFILE_PREFIX));
  let launch;
  let cleanupPromise;
  let interrupted = false;
  function cleanup() {
    cleanupPromise ??= (async () => {
      try {
        const browser = await launch?.catch(() => undefined);
        await browser?.close();
      } finally {
        try {
          await Promise.all(servers.map(closeServer));
        } finally {
          fs.rmSync(userDataDir, { recursive: true, force: true, maxRetries: 3 });
        }
      }
    })();
    return cleanupPromise;
  }

  async function startMock() {
    const server = createServer();
    servers.push(server);
    const listening = once(server, 'listening');
    server.listen(0, '127.0.0.1');
    await listening;
    return `http://127.0.0.1:${server.address().port}`;
  }

  const interrupt = () => {
    interrupted = true;
    cleanup().then(() => process.exit(130), () => process.exit(130));
  };
  process.once('SIGINT', interrupt);
  const errs = [];
  try {
    const base = await startMock();
    if (interrupted) return;
    const base2 = await startMock();
    if (interrupted) return;
    launch = pp.launch({
      executablePath: '/usr/bin/google-chrome',
      args: ['--no-sandbox', '--allow-file-access-from-files'],
      headless: 'new',
      userDataDir,
      handleSIGINT: false,
    });
    const browser = await launch;
    fs.writeFileSync(path.join(userDataDir, OWNER_FILE),
      JSON.stringify({ runnerPid: process.pid, chromePid: browser.process()?.pid }));
    // 1. file:// offline fallback
    {
      const pg = await newRussianPage(browser);
      pg.on('pageerror', (e) => errs.push('file pageerror: ' + e.message));
      const fileUrl = pathToFileURL(path.resolve(__dirname, '..', 'index.html')).href;
      await pg.goto(fileUrl);
      await pg.evaluate(() => localStorage.clear());
      await pg.reload();
      await sleep(350);
      const st = await pg.evaluate(() => window.__hoppak.profile.getState());
      assert.strictEqual(st.apiOrigin, '');
      assert.strictEqual(st.st, 'offline');
      await pg.close();
      console.log('PASS 1: file:// offline fallback');
    }

    // 2. Same-origin /api across /v/0.58/ and /v/0.6/ on mode=2284797
    {
      await admin(base, { mode: '2284797', clearLog: true });
      const ctx = await browser.createBrowserContext();
      const pg = await newRussianPage(ctx);
      await pg.setViewport({ width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
      pg.on('pageerror', (e) => errs.push('v058 pageerror: ' + e.message));

      // Pre-seed an existing local save before visiting /v/0.58/
      await seedSave(pg, base, { coins: 120, best: 240, owned: { 'char:1': 1 }, char: 1 });
      await pg.goto(base + '/v/0.58/index.html');
      await waitCoins(pg, 120, '2 legacy save migrates before the first run');

      const st1 = await pg.evaluate(async () => {
        await window.__hoppak.profile.flush();
        return { st: window.__hoppak.profile.getState(), save: window.__hoppak.getSave() };
      });
      assert.strictEqual(st1.st.apiOrigin, base);
      assert.strictEqual(st1.st.st, 'ready');
      assert.strictEqual(st1.st.profile.coins, 120);
      assert.strictEqual(st1.st.profile.purchases['char:1'], 1);
      assert.strictEqual(st1.save.coins, 120);
      const guestId = st1.st.profile.id;
      const tok1 = await pg.evaluate(() => window.__hoppak.profile.getToken());
      assert.ok(tok1.length === 64);

      // Finish a run on /v/0.58/ -> 150m (6 coins) + 4 runCoins = +10 -> 130
      await pg.evaluate(() => {
        const g = window.__hoppak;
        g.start('solo', 7, 'city');
        const w = g.getWorld();
        w.players[0].maxH = 150 * 8;
        w.runCoins = 4;
        g.forceResults();
      });
      await sleep(350);
      const st2 = await pg.evaluate(async () => {
        await window.__hoppak.profile.flush();
        return { st: window.__hoppak.profile.getState(), save: window.__hoppak.getSave() };
      });
      assert.strictEqual(st2.st.profile.coins, 130);
      assert.strictEqual(st2.save.coins, 130);
      assert.strictEqual(st2.st.queueLen, 0);

      // Open /v/0.6/ on the SAME origin -> shares guest token, coins, best, owned
      await pg.goto(base + '/v/0.6/index.html');
      await sleep(400);
      const st3 = await pg.evaluate(() => ({
        st: window.__hoppak.profile.getState(),
        save: window.__hoppak.getSave(),
        tok: window.__hoppak.profile.getToken(),
      }));
      assert.ok(st3.tok === tok1, '2 the same origin keeps the same guest session');
      assert.strictEqual(st3.st.profile.id, guestId);
      assert.strictEqual(st3.st.profile.coins, 130);
      assert.strictEqual(st3.save.coins, 130);
      assert.strictEqual(st3.save.best, 240);
      assert.strictEqual(st3.save.owned['char:1'], 1);

      // Buy map:jungle (price 80) under mode=2284797 (server returns 404 on /buy)
      await pg.evaluate(() => {
        const s = window.__hoppak.getSave();
        s.mapBest.city = 600;
        window.__hoppak.tap('camp');
        window.__hoppak.tap('camp:1');
        window.__hoppak.tap('camp:open');
        window.__hoppak.tap('camp:open'); // 2nd tap confirms purchase
      });
      await sleep(300);
      const afterBuy = await pg.evaluate(() => ({
        st: window.__hoppak.profile.getState(),
        save: window.__hoppak.getSave(),
      }));
      assert.strictEqual(afterBuy.save.coins, 50);
      assert.strictEqual(afterBuy.save.owned['map:jungle'], 1);
      assert.strictEqual(afterBuy.st.buySupported, false);
      assert.strictEqual(afterBuy.st.pendingSpend, 80);

      // Reload /v/0.6/ under mode=2284797 -> coins MUST remain 50 (not reverted to 130!)
      await pg.reload();
      await sleep(400);
      const afterReload = await pg.evaluate(() => ({
        st: window.__hoppak.profile.getState(),
        save: window.__hoppak.getSave(),
      }));
      assert.strictEqual(afterReload.st.profile.coins, 130);
      assert.strictEqual(afterReload.save.coins, 50);
      assert.strictEqual(afterReload.save.owned['map:jungle'], 1);

      // Simulate 503 outage while finishing 2 runs offline -> queued, no coin loss
      await admin(base, { mode: '503', resetCooldown: true });
      await pg.evaluate(() => {
        const g = window.__hoppak;
        g.start('solo', 8, 'city');
        let w = g.getWorld();
        w.players[0].maxH = 200 * 8; // +8
        w.runCoins = 4; // +4 => +12 (coins 50 -> 62)
        g.forceResults();

        g.start('solo', 9, 'city');
        w = g.getWorld();
        w.players[0].maxH = 100 * 8; // +4
        w.runCoins = 4; // +4 => +8 (coins 62 -> 70)
        g.forceResults();
      });
      await sleep(400);
      const offlineState = await pg.evaluate(() => ({
        st: window.__hoppak.profile.getState(),
        save: window.__hoppak.getSave(),
      }));
      assert.strictEqual(offlineState.st.st, 'unavailable');
      assert.strictEqual(offlineState.st.queueLen, 2);
      assert.strictEqual(offlineState.save.coins, 70);

      // Server recovers in v06 mode -> flushes pendingBuy (map:jungle -80) and both queued runs (+12, +8)!
      await admin(base, { mode: 'v06', resetCooldown: true });
      await pg.evaluate(async () => {
        // Clear session buySupported=false as a fresh reload would, then flush first run
        window.__hoppak.profile.buySupported = null;
        await window.__hoppak.profile.flush();
      });
      const finalState = await pg.evaluate(() => ({
        st: window.__hoppak.profile.getState(),
        save: window.__hoppak.getSave(),
      }));
      // Buy (-80 => 50) and both queued runs (+12 and +8) land in one flush. No 8s gap.
      assert.strictEqual(finalState.st.profile.coins, 70);
      assert.strictEqual(finalState.st.profile.purchases['map:jungle'], 1);
      assert.strictEqual(finalState.st.queueLen, 0);
      assert.strictEqual(finalState.st.pendingBuysLen, 0);
      assert.strictEqual(finalState.save.coins, 70);
      assert.strictEqual(finalState.st.profile.best, 600);
      assert.strictEqual(finalState.save.best, 600);

      await pg.evaluate(async () => {
        const g = window.__hoppak;
        g.start('solo', 10, 'city');
        const w = g.getWorld();
        w.players[0].maxH = 350 * 8; // +14
        w.runCoins = 1; // +15 => 85
        g.forceResults();
        await g.profile.flush();
      });
      const bestState = await pg.evaluate(() => window.__hoppak.profile.getState());
      assert.strictEqual(bestState.queueLen, 0);
      assert.strictEqual(bestState.profile.best, 600);
      assert.strictEqual(bestState.profile.coins, 85);

      await ctx.close();
      console.log('PASS 2: /v/0.58 <-> /v/0.6 sharing, 2284797 compat, offline queue, 503->v06 recovery, best & buy sync');
    }

    // 2b. Fresh guest directly on v06 server migrates best=240 & buys hero char:2 (200)
    {
      await admin(base2, { mode: 'v06', clearLog: true });
      const ctx = await browser.createBrowserContext();
      const pg = await newRussianPage(ctx);
      pg.on('pageerror', (e) => errs.push('v06-fresh pageerror: ' + e.message));
      await seedSave(pg, base2, { coins: 250, best: 240 });
      await pg.goto(base2 + '/v/0.6/index.html');
      await waitCoins(pg, 250, '2b seed migrates with the original record', '', 240);
      await pg.evaluate(() => {
        window.__hoppak.tap('shop');
        window.__hoppak.tap('hero:2');
        window.__hoppak.tap('hero:act');
        window.__hoppak.tap('hero:act'); // confirm buy ninja (200)
      });
      await waitCoins(pg, 50, '2b purchase settles', '', 240);
      await waitForState(pg, '2b char:2 appears in server purchases and local owned', () => {
        const g = window.__hoppak;
        const state = g.profile.getState();
        return state?.profile?.purchases?.['char:2'] === 1 && g.getSave().owned?.['char:2'] === 1;
      });
      await pg.reload();
      await waitCoins(pg, 50, '2b purchased hero balance survives reload', '', 240);
      await waitForState(pg, '2b char:2 purchase survives reload', () => {
        const g = window.__hoppak;
        const state = g.profile.getState();
        return state?.profile?.purchases?.['char:2'] === 1 && g.getSave().owned?.['char:2'] === 1;
      });
      const v06st = await pg.evaluate(() => ({
        st: window.__hoppak.profile.getState(),
        save: window.__hoppak.getSave(),
      }));
      assert.strictEqual(v06st.st.profile.best, 240);
      assert.strictEqual(v06st.st.profile.coins, 50);
      assert.strictEqual(v06st.st.profile.purchases['char:2'], 1);
      assert.strictEqual(v06st.save.coins, 50);
      assert.strictEqual(v06st.save.owned['char:2'], 1);
      await ctx.close();
      console.log('PASS 2b: fresh v06 guest migrates best & buys char:2 server-side');
    }

    // 3. Configurable ?api= override pointing to base2
    {
      await admin(base2, { mode: 'v06', clearLog: true });
      const ctx = await browser.createBrowserContext();
      const pg = await newRussianPage(ctx);
      pg.on('pageerror', (e) => errs.push('override pageerror: ' + e.message));
      await pg.goto(base + '/index.html?api=' + encodeURIComponent(base2));
      await settle(pg);
      await pg.evaluate(() => localStorage.clear());
      await pg.reload();
      await sleep(350);
      const st = await pg.evaluate(() => window.__hoppak.profile.getState());
      assert.strictEqual(st.apiOrigin, base2);
      assert.strictEqual(st.st, 'ready');
      const log2 = await (await fetch(base2 + '/__mock/log')).json();
      assert.ok(log2.log.some((x) => x.path === '/api/profile/guest'));
      await ctx.close();
      console.log('PASS 3: configurable ?api= base URL override');
    }

    // 4. Built-site sanity: Hz invariance + inspectMap determinism (unchanged by profile)
    {
      const pg = await newRussianPage(browser);
      pg.on('pageerror', (e) => errs.push('verify pageerror: ' + e.message));
      await pg.goto(base + '/index.html');
      await sleep(300);
      const hz = await pg.evaluate(() => {
        const out = {};
        for (const h of [60, 120, 144]) {
          window.__hoppak.setHero(0);
          window.__hoppak.start('solo', 4242, 'city');
          window.__hoppak.setDir(1);
          out[h] = window.__hoppak.advanceTime(5, h);
        }
        const m1 = window.__hoppak.inspectMap(7, 200, 'city');
        const m2 = window.__hoppak.inspectMap(7, 200, 'city');
        return { out, n1: m1.platforms.length, n2: m2.platforms.length };
      });
      assert.strictEqual(hz.n1, hz.n2);
      assert.ok(Math.abs(hz.out[60].m - hz.out[120].m) <= 2);
      assert.ok(Math.abs(hz.out[60].m - hz.out[144].m) <= 2);
      await pg.close();
      console.log('PASS 4: simulation determinism & Hz invariance untouched', hz.out[60].m, hz.out[120].m, hz.out[144].m);
    }

    // 5. Telegram Mini App login: success, 503, 401 — once per session, guest fallback
    {
      const initData = 'user=' + encodeURIComponent(JSON.stringify({ id: 4242 })) + '&auth_date=1&hash=00';
      async function openTg(origin, seed) {
        const ctx = await browser.createBrowserContext();
        const pg = await newRussianPage(ctx);
        pg.on('pageerror', (e) => errs.push('tg pageerror: ' + e.message));
        await pg.evaluateOnNewDocument((d) => {
          window.Telegram = { WebApp: { initData: d } };
        }, initData);
        await pg.goto(origin + '/index.html');
        await settle(pg);
        await pg.evaluate((s) => {
          localStorage.clear();
          if (s) localStorage.setItem('hoppak_save', JSON.stringify(s));
        }, seed || null);
        await fetch(origin + '/__mock/admin', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ clearLog: true }),
        });
        await pg.reload();
        await sleep(500);
        await pg.evaluate(async () => { await window.__hoppak.profile.flush(); });
        return { ctx, pg };
      }

      await admin(base, { mode: 'v06', tgAuth: 'ok', clearLog: true });
      const a = await openTg(base);
      const stOk = await a.pg.evaluate(() => window.__hoppak.profile.getState());
      assert.strictEqual(stOk.st, 'ready');
      assert.strictEqual(String(stOk.profile.telegramId), '4242');
      assert.strictEqual(stOk.telegramId, '4242');
      assert.strictEqual(stOk.tgTried, true);
      const tokOk = await a.pg.evaluate(() => window.__hoppak.profile.getToken());
      assert.ok(tokOk && tokOk.length === 64);
      await a.pg.evaluate(async () => { await window.__hoppak.profile.flush(); });
      const logOk = await (await fetch(base + '/__mock/log')).json();
      const tgCalls = logOk.log.filter((x) => x.path === '/api/auth/telegram');
      assert.strictEqual(tgCalls.length, 1, 'telegram auth must run once per session, got ' + tgCalls.length);
      await a.ctx.close();
      console.log('PASS 5a: Telegram initData links guest, telegramId set, no retry loop');

      await admin(base, { mode: 'v06', tgAuth: '503', clearLog: true });
      const b = await openTg(base);
      const st503 = await b.pg.evaluate(() => window.__hoppak.profile.getState());
      assert.strictEqual(st503.st, 'ready', '503 TELEGRAM_AUTH_UNAVAILABLE must not break guest profile');
      assert.ok(!st503.profile.telegramId);
      assert.strictEqual(st503.tgTried, true);
      await b.pg.evaluate(async () => { await window.__hoppak.profile.flush(); });
      const log503 = await (await fetch(base + '/__mock/log')).json();
      assert.strictEqual(log503.log.filter((x) => x.path === '/api/auth/telegram').length, 1);
      await b.ctx.close();
      console.log('PASS 5b: 503 TELEGRAM_AUTH_UNAVAILABLE falls back to guest, no retry');

      await admin(base, { mode: 'v06', tgAuth: '401', clearLog: true });
      const c = await openTg(base);
      const st401 = await c.pg.evaluate(() => window.__hoppak.profile.getState());
      assert.strictEqual(st401.st, 'ready');
      assert.ok(!st401.profile.telegramId);
      await c.pg.evaluate(async () => { await window.__hoppak.profile.flush(); });
      const log401 = await (await fetch(base + '/__mock/log')).json();
      assert.strictEqual(log401.log.filter((x) => x.path === '/api/auth/telegram').length, 1);
      await c.ctx.close();
      console.log('PASS 5c: 401 INVALID_INIT_DATA falls back to guest, no retry');
    }

    // 6. Height threshold, no per-run 200 cap, offline failure is labelled
    {
      await admin(base, { mode: '503', clearLog: true });
      const ctx = await browser.createBrowserContext();
      const pg = await newRussianPage(ctx);
      pg.on('pageerror', (e) => errs.push('cap pageerror: ' + e.message));
      await pg.goto(base + '/index.html');
      await settle(pg);
      await pg.evaluate(() => localStorage.clear());
      await pg.reload();
      await sleep(400);
      const caps = await pg.evaluate(async () => {
        const g = window.__hoppak;
        const formula = {
          low: g.profile.computeAward(99, 3, 0),
          edge: g.profile.computeAward(100, 0, 0),
          long: g.profile.computeAward(7500, 0, 0),
          coins: g.profile.computeAward(100, 20000, 0),
        };
        g.start('solo', 1, 'city');
        const w = g.getWorld();
        w.players[0].maxH = 99 * 8;
        w.runCoins = 3;
        g.forceResults();
        await g.profile.flush();
        return { formula, earned: g.getWorld().earned, limited: g.getWorld().limited, coins: g.getSave().coins };
      });
      assert.strictEqual(caps.formula.low.awarded, 3);
      assert.strictEqual(caps.formula.low.limited, 'HEIGHT_MIN');
      assert.strictEqual(caps.formula.edge.awarded, 4);
      assert.strictEqual(caps.formula.edge.limited, '');
      assert.strictEqual(caps.formula.long.awarded, 300);
      assert.strictEqual(caps.formula.coins.limited, 'COINS_CAP');
      assert.strictEqual(caps.formula.coins.awarded, 4 + 15801);
      assert.strictEqual(caps.earned, 3);
      assert.strictEqual(caps.coins, 3);
      assert.strictEqual(caps.limited, 'OFFLINE');
      await ctx.close();
      console.log('PASS 6: height threshold, full long award, offline reason');
    }

    // 7. 400 from /buy rolls back optimistic owned flag and restores coins
    {
      await admin(base, { mode: 'v06', tgAuth: '503', clearLog: true });
      const ctx = await browser.createBrowserContext();
      const pg = await newRussianPage(ctx);
      pg.on('pageerror', (e) => errs.push('buy400 pageerror: ' + e.message));
      await seedSave(pg, base, { coins: 50 });
      await pg.goto(base + '/v/0.6/index.html');
      await waitCoins(pg, 50, '7 seed migrates before attempting the purchase');
      const [rejection] = await Promise.all([
        pg.waitForResponse((response) => response.url() === base + '/api/profile/buy'
          && response.request().method() === 'POST', { timeout: WAIT_MS })
          .catch(error => { throw new Error('7 purchase response did not arrive', { cause: error }); }),
        pg.evaluate(async () => {
          const g = window.__hoppak;
          const s = g.getSave();
          s.coins = 0;
          s.owned['char:2'] = 1;
          s.char = 2;
          await g.profile.buy('char:2', 200);
        }),
      ]);
      assert.strictEqual(rejection.status(), 400, '7 purchase is rejected by the server');
      assert.strictEqual((await rejection.json()).error, 'INSUFFICIENT_COINS');
      await waitCoins(pg, 50, '7 rejection rolls back the optimistic balance');
      const st = await pg.evaluate(() => ({
        st: window.__hoppak.profile.getState(),
        save: window.__hoppak.getSave(),
      }));
      assert.strictEqual(st.st.st, 'ready');
      assert.ok(!st.save.owned['char:2']);
      assert.strictEqual(st.save.char, 0);
      assert.strictEqual(st.save.coins, 50);
      assert.strictEqual(st.st.pendingBuysLen, 0);
      await ctx.close();
      console.log('PASS 7: 400 INSUFFICIENT_COINS rolls back optimistic owned');
    }

    // 8. Balance already >= 100, then a run like Roman's and eleven more, guest and Telegram.
    {
      async function series(label, origin, tg) {
        const ctx = await browser.createBrowserContext();
        const pg = await newRussianPage(ctx);
        pg.on('pageerror', (e) => errs.push(label + ' pageerror: ' + e.message));
        await seedSave(pg, origin, { coins: 100 });
        if (tg) {
          const initData = 'user=' + encodeURIComponent(JSON.stringify({ id: 7771, first_name: 'Roman' })) + '&auth_date=1&hash=00';
          await pg.evaluateOnNewDocument((d) => {
            window.Telegram = { WebApp: { initData: d } };
          }, initData);
        }
        await pg.goto(origin + '/index.html');
        await waitCoins(pg, 100, '8 ' + label + ' seed migrates', tg ? '7771' : '');
        const seeded = await pg.evaluate(() => window.__hoppak.profile.getState());
        assert.strictEqual(seeded.st, 'ready', label + ' profile');
        assert.strictEqual(seeded.profile.coins, 100, label + ' start coins');
        if (tg) assert.strictEqual(String(seeded.profile.telegramId), '7771');
        else assert.ok(!seeded.profile.telegramId);
        await pg.evaluate(async () => {
          const g = window.__hoppak;
          function finish(h, coins) {
            g.start('solo', 3, 'city');
            const w = g.getWorld();
            w.players[0].maxH = h * 8;
            w.runCoins = coins;
            w.bonusCoins = 0;
            g.forceResults();
          }
          for (let i = 0; i < 10; i++) finish(2500, 0);
          finish(7500, 0);
          finish(100, 0);
          finish(99, 5);
          /* Room start (startNet/startRun) calls the same beginRun as solo. */
          g.profile.beginRun('city', 0);
          await g.profile.flush();
        });
        await waitCoins(pg, 1409, '8 ' + label + ' all run rewards settle', tg ? '7771' : '');
        if (!tg) {
          const started = await (await fetch(origin + '/__mock/log')).json();
          const order = started.log.map((x) => x.path).filter((p) => p === '/api/run/start' || p === '/api/run/finish');
          const firstFin = order.indexOf('/api/run/finish');
          const starts = order.filter((p) => p === '/api/run/start').length;
          const fins = order.filter((p) => p === '/api/run/finish').length;
          assert.ok(firstFin > 0, 'run_start is posted before finish ' + order.join(','));
          assert.ok(order.slice(0, firstFin).every((p) => p === '/api/run/start'));
          assert.strictEqual(fins, 13, 'solo finishes ' + order.join(','));
          assert.strictEqual(starts, 14, 'each finish has a start, plus the extra beginRun');
        }
        const last = await pg.evaluate(() => {
          const st = window.__hoppak.profile.getState();
          const w = window.__hoppak.getWorld();
          return { q: st.queueLen, coins: st.profile && st.profile.coins, save: window.__hoppak.getSave().coins, earned: w && w.earned, limited: w && w.limited };
        });
        assert.strictEqual(last.q, 0, label + ' queue ' + JSON.stringify(last));
        assert.strictEqual(last.coins, 1409, label + ' coins ' + JSON.stringify(last));
        assert.strictEqual(last.save, 1409, label + ' save');
        assert.strictEqual(last.earned, 5, label + ' 99m keeps pickup coins');
        assert.strictEqual(last.limited, 'HEIGHT_MIN', label);
        const tok = await pg.evaluate(() => window.__hoppak.profile.getToken());
        const post = (runId) => fetch(origin + '/api/run/finish', {
          method: 'POST',
          headers: { authorization: 'Bearer ' + tok, 'content-type': 'application/json' },
          body: JSON.stringify({ runId, height: 2500, runCoins: 0, bonusCoins: 0 }),
        }).then((r) => r.json());
        const first = await post(label + '-dup');
        const again = await post(label + '-dup');
        assert.strictEqual(first.awarded, 100, label + ' dup first');
        assert.strictEqual(again.duplicate, true, label);
        assert.strictEqual(again.limited, 'DUPLICATE');
        assert.strictEqual(again.profile.coins, first.profile.coins);
        await ctx.close();
        console.log('PASS 8 ' + label + ': 10x100 + 300 + 4 + 5, duplicate ignored');
      }
      await admin(base, { mode: 'v06', tgAuth: 'ok', clearLog: true });
      await series('guest', base, false);
      await series('telegram', base, true);
    }

    // 9. Menu-quit records the map (solo and online), one volume slider, logo clears the chip.
    {
      await admin(base, { mode: 'v06', tgAuth: 'ok', clearLog: true });
      const ctx = await browser.createBrowserContext();
      const pg = await newRussianPage(ctx);
      await pg.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
      pg.on('pageerror', (e) => errs.push('r8 pageerror: ' + e.message));
      await pg.evaluateOnNewDocument(() => {
        localStorage.setItem('hoppak_save', JSON.stringify({
          v5: 1, coins: 100, best: 10, mapBest: { city: 10, lava: 20 },
          owned: { 'char:0': 1 }, char: 0, bg: 'city', sfx: true, vib: true,
          music: 0.2, sfxVol: 0.7, musicOn: true,
        }));
        window.Telegram = {
          WebApp: {
            initData: 'user=' + encodeURIComponent(JSON.stringify({ id: 42, first_name: 'Roman' })) + '&auth_date=1&hash=00',
            safeAreaInset: { top: 100, bottom: 34, left: 0, right: 0 },
            contentSafeAreaInset: { top: 0, bottom: 0, left: 0, right: 0 },
            onEvent() {}, offEvent() {},
            BackButton: { isVisible: false, onClick() {} },
          },
        };
      });
      await pg.goto(base + '/index.html');
      await settle(pg);
      await pg.evaluate(async () => { await window.__hoppak.profile.flush(); });
      const migrated = await pg.evaluate(() => window.__hoppak.getSave().vol);
      assert.strictEqual(migrated, 0.7, 'volume migrates to the louder slider');
      const audio = await pg.evaluate(async () => {
        const g = window.__hoppak;
        g.audioUnlock();
        g.setVolume(0.3);
        g.sfxPlay('tick');
        const low = g.audioProbe();
        g.setVolume(0.9);
        const high = g.audioProbe();
        const t0 = Date.now();
        let music = high;
        while (!music.musicToMaster && Date.now() - t0 < 3000) {
          await new Promise((r) => setTimeout(r, 100));
          music = g.audioProbe();
        }
        return { low, high: music };
      });
      assert.ok(Math.abs(audio.low.gain - 0.3) < 0.02, 'gain 0.3 ' + JSON.stringify(audio));
      assert.ok(Math.abs(audio.high.gain - 0.9) < 0.02, 'gain 0.9 ' + JSON.stringify(audio));
      assert.strictEqual(audio.high.sfxToMaster, true, 'sfx into master');
      assert.strictEqual(audio.high.musicToMaster, true, 'music into master');
      const solo = await pg.evaluate(async () => {
        const g = window.__hoppak;
        const startCoins = g.profile.getState().profile.coins;
        g.start('solo', 4, 'city');
        const w = g.getWorld();
        w.players[0].maxH = 250 * 8;
        w.runCoins = 0; w.bonusCoins = 0;
        g.pause(true);
        g.tap('menu');
        await g.profile.flush();
        const s = g.getSave();
        const st = g.profile.getState();
        return { map: s.mapBest.city, best: s.best, coins: s.coins, startCoins, server: st.profile && st.profile.best, serverCoins: st.profile && st.profile.coins };
      });
      assert.strictEqual(solo.map, 250, 'solo map best ' + JSON.stringify(solo));
      assert.strictEqual(solo.best, 250, 'solo profile local');
      assert.strictEqual(solo.server, 250, 'solo profile server');
      assert.strictEqual(solo.coins, solo.startCoins + 10, 'solo coins follow the normal award ' + JSON.stringify(solo));
      const net = await pg.evaluate(async () => {
        const g = window.__hoppak;
        g.start('solo', 5, 'lava');
        const w = g.getWorld();
        w.net = true;
        w.players[0].maxH = 400 * 8;
        w.runCoins = 0; w.bonusCoins = 0;
        g.pause(true);
        g.tap('menu');
        await g.profile.flush();
        const s = g.getSave();
        const st = g.profile.getState();
        return { map: s.mapBest.lava, city: s.mapBest.city, best: s.best, coins: s.coins, server: st.profile && st.profile.best };
      });
      assert.strictEqual(net.map, 400, 'online map best ' + JSON.stringify(net));
      assert.strictEqual(net.city, 250, 'city best stays');
      assert.strictEqual(net.best, 400);
      assert.strictEqual(net.server, 400);
      assert.strictEqual(net.coins, solo.startCoins + 10 + 16, '400m pays 16 ' + JSON.stringify(net));
      const lay = await pg.evaluate(async () => {
        const g = window.__hoppak;
        g.tap('menu');
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        return g.menuLayout();
      });
      function hit(a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; }
      assert.ok(lay && lay.logo && lay.chip, 'menu layout ' + JSON.stringify(lay));
      assert.ok(lay.logo.y >= lay.chip.y + lay.chip.h + 4, 'logo gap ' + JSON.stringify(lay));
      assert.ok(!hit(lay.logo, lay.chip), 'logo/chip');
      assert.ok(!hit(lay.logo, lay.coins), 'logo/coins');
      const boxes = await pg.evaluate(async () => {
        const g = window.__hoppak;
        g.getSave().coins = 1107;
        g.start('squad', 9, 'lava');
        const w = g.getWorld();
        w.players.pop();
        const hs = [939, 700, 400];
        for (let i = 0; i < w.players.length; i++) { w.players[i].maxH = hs[i] * 8; w.players[i].why = i === 0 ? 'mob:owl' : ''; }
        w.net = true;
        g.net.session = { code: 'ABCD', rounds: [{ round: 1 }], wins: { a: 1, b: 0, c: 0 }, best: { a: 939, b: 700, c: 400 }, names: { a: 'РОМАН', b: 'ЛЕНА', c: 'ОЛЕГ' } };
        g.forceResults();
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        return g.resultsBoxes();
      });
      const bad = [];
      for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) if (hit(boxes[i], boxes[j])) bad.push(boxes[i].id + '/' + boxes[j].id);
      assert.strictEqual(bad.length, 0, 'results overlap ' + bad.join(',') + ' ' + JSON.stringify(boxes));
      const pause = await pg.evaluate(async () => {
        const g = window.__hoppak;
        g.setVolume(0);
        const z = g.audioProbe();
        g.setVolume(0.8);
        g.start('solo', 2, 'city');
        g.pause(true);
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        return { gain: z.gain, boxes: g.pauseLayout() };
      });
      assert.strictEqual(pause.gain, 0, 'volume 0 is silence ' + JSON.stringify(pause));
      const pbad = [];
      const pb = pause.boxes || [];
      for (let i = 0; i < pb.length; i++) for (let j = i + 1; j < pb.length; j++) if (hit(pb[i], pb[j])) pbad.push(pb[i].id + '/' + pb[j].id);
      assert.strictEqual(pbad.length, 0, 'pause overlap ' + pbad.join(',') + ' ' + JSON.stringify(pb));
      assert.ok(pb.some((b) => b.id === 'vol'), 'pause has the volume slider');
      function overlaps(a, b) {
        return a && b && a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
      }
      function contains(a, b) {
        return b.x >= a.x - 0.5 && b.y >= a.y - 0.5 && b.x + b.w <= a.x + a.w + 0.5 && b.y + b.h <= a.y + a.h + 0.5;
      }
      for (const vp of [[390, 844], [360, 640]]) {
        await pg.setViewport({ width: vp[0], height: vp[1], deviceScaleFactor: 2, isMobile: true, hasTouch: true });
        const plates = await pg.evaluate(async () => {
          window.Telegram = {
            WebApp: {
              safeAreaInset: { top: 100, bottom: 34, left: 0, right: 0 },
              contentSafeAreaInset: { top: 0, bottom: 0, left: 0, right: 0 },
              onEvent() {}, offEvent() {},
              BackButton: { isVisible: false, onClick() {} },
            },
          };
          const g = window.__hoppak;
          const frames = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
          const grab = async (setup) => { setup(); await frames(); return { lay: g.screenLayout(), results: g.resultsBoxes() }; };
          const out = {};
          out.results = await grab(() => {
            g.screen('menu');
            g.start('squad', 3, 'city');
            const w = g.getWorld();
            w.net = true;
            w.players[0].maxH = 400 * 8;
            g.forceResults();
          });
          out.shop = await grab(() => { g.screen('shop'); });
          out.camp = await grab(() => { g.screen('camp'); });
          out.lobby = await grab(() => { g.screen('lobby'); });
          out.net = await grab(() => { g.screen('net'); });
          out.settings = await grab(() => { g.screen('menu'); g.tap('set'); });
          out.profile = await grab(() => { g.tap('set:prof'); });
          g.tap('prof:close');
          return out;
        });
        for (const name of Object.keys(plates)) {
          const lay = plates[name].lay;
          const chip = (lay.wallet || []).find((b) => b.id === 'chip');
          const coins = (lay.wallet || []).find((b) => b.id === 'coins');
          assert.ok(chip && coins, vp.join('x') + ' ' + name + ' wallet ' + JSON.stringify(lay.wallet));
          const boxes = lay.boxes || [];
          const plaque = boxes.find((b) => b.id === 'header' || b.id === 'settings' || b.id === 'profile' || b.id === 'room');
          assert.ok(plaque, vp.join('x') + ' ' + name + ' plaque ' + boxes.map((b) => b.id).join(','));
          assert.ok(plaque.y >= chip.y + chip.h + 4, vp.join('x') + ' ' + name + ' gap ' + JSON.stringify({ plaque, chip }));
          for (const b of boxes) {
            assert.ok(!overlaps(b, chip), vp.join('x') + ' ' + name + ' ' + b.id + '/chip');
            assert.ok(!overlaps(b, coins), vp.join('x') + ' ' + name + ' ' + b.id + '/coins');
          }
          for (let i = 0; i < boxes.length; i++) {
            for (let j = i + 1; j < boxes.length; j++) {
              if (contains(boxes[i], boxes[j]) || contains(boxes[j], boxes[i])) continue;
              assert.ok(!overlaps(boxes[i], boxes[j]), vp.join('x') + ' ' + name + ' ' + boxes[i].id + '/' + boxes[j].id);
            }
          }
          if (name === 'results') {
            const rb = plates[name].results || [];
            for (const b of rb) {
              assert.ok(!overlaps(b, chip), 'results ' + b.id + '/chip');
              assert.ok(!overlaps(b, coins), 'results ' + b.id + '/coins');
            }
          }
        }
      }
      await ctx.close();
      console.log('PASS 9: record on quit, master gain, logo gap, results boxes');
    }

    // 10. Two devices, one Telegram profile: map records take the max, coins stay server-side.
    {
      await admin(base2, { mode: 'v06', tgAuth: 'ok', clearLog: true });
      const seedDoc = (raw) => {
        window.Telegram = {
          WebApp: {
            initData: 'user=' + encodeURIComponent(JSON.stringify({ id: 5150, first_name: 'Roman' })) + '&auth_date=1&hash=00',
            safeAreaInset: { top: 0, bottom: 0, left: 0, right: 0 },
            contentSafeAreaInset: { top: 0, bottom: 0, left: 0, right: 0 },
            onEvent() {}, offEvent() {},
            BackButton: { isVisible: false, onClick() {} },
          },
        };
        try {
          if (!localStorage.getItem('hoppak_guest_token')) localStorage.setItem('hoppak_save', raw);
        } catch (e) {}
      };
      const saveA = JSON.stringify({
        v5: 1, coins: 50, best: 207, mapBest: { city: 207, jungle: 0, space: 0 },
        owned: { 'char:0': 1 }, char: 0, bg: 'city', sfx: true, vib: true,
      });
      const saveB = JSON.stringify({
        v5: 1, coins: 9999, best: 80, mapBest: { city: 10, aqua: 30, space: 80 },
        owned: { 'char:0': 1, 'map:aqua': 1 }, char: 0, bg: 'aqua', sfx: true, vib: true,
      });
      const ctxA = await browser.createBrowserContext();
      const a = await newRussianPage(ctxA);
      a.on('pageerror', (e) => errs.push('devA pageerror: ' + e.message));
      await a.evaluateOnNewDocument(seedDoc, saveA);
      await a.goto(base2 + '/index.html');
      await settle(a);
      await a.evaluate(async () => { await window.__hoppak.profile.flush(); });
      const left = await a.evaluate(() => {
        const s = window.__hoppak.getSave();
        const p = window.__hoppak.profile.getState().profile;
        return { coins: s.coins, city: s.mapBest.city, server: p && p.coins, camp: p && p.campaign && p.campaign.best };
      });
      assert.strictEqual(left.city, 207, JSON.stringify(left));
      assert.strictEqual(left.server, 50, 'server coins, not a second wallet ' + JSON.stringify(left));
      assert.strictEqual(left.camp.city, 207);

      const ctxB = await browser.createBrowserContext();
      const b = await newRussianPage(ctxB);
      b.on('pageerror', (e) => errs.push('devB pageerror: ' + e.message));
      await b.evaluateOnNewDocument(seedDoc, saveB);
      await b.goto(base2 + '/index.html');
      await settle(b);
      await b.evaluate(async () => { await window.__hoppak.profile.flush(); });
      const right = await b.evaluate(() => {
        const s = window.__hoppak.getSave();
        const p = window.__hoppak.profile.getState().profile;
        return {
          coins: s.coins, city: s.mapBest.city, aqua: s.mapBest.aqua, space: s.mapBest.space,
          owned: !!s.owned['map:aqua'], server: p && p.coins, camp: p && p.campaign && p.campaign.best,
        };
      });
      assert.strictEqual(right.city, 207, 'max city ' + JSON.stringify(right));
      assert.strictEqual(right.aqua, 30, JSON.stringify(right));
      assert.strictEqual(right.space, 80, JSON.stringify(right));
      assert.strictEqual(right.owned, false, 'local map open is not a purchase ' + JSON.stringify(right));
      assert.strictEqual(right.coins, 50, 'local 9999 must not be added ' + JSON.stringify(right));
      assert.strictEqual(right.server, 50);
      await a.reload();
      await settle(a);
      await a.evaluate(async () => { await window.__hoppak.profile.flush(); });
      const back = await a.evaluate(() => {
        const s = window.__hoppak.getSave();
        return { city: s.mapBest.city, aqua: s.mapBest.aqua, space: s.mapBest.space, coins: s.coins, aquaOpen: !!s.owned['map:aqua'] };
      });
      assert.strictEqual(back.city, 207, JSON.stringify(back));
      assert.strictEqual(back.aqua, 30, JSON.stringify(back));
      assert.strictEqual(back.space, 80, JSON.stringify(back));
      assert.strictEqual(back.aquaOpen, false, 'device A must not inherit an unpaid open');
      assert.strictEqual(back.coins, 50);
      await ctxA.close();
      await ctxB.close();
      console.log('PASS 10: two devices share one profile, max records, server coins');
    }

    // 11. Prod page: guests never touch telegram.org; a Mini App hash + mock SDK still links.
    {
      function mockSdk(version, platform) {
        return [
          '(function () {',
          '  var q = String(location.hash || "").replace(/^#/, "");',
          '  var params = new URLSearchParams(q);',
          '  var data = params.get("tgWebAppData") || "";',
          '  var user = null;',
          '  try { user = JSON.parse(new URLSearchParams(data).get("user") || "null"); } catch (e) {}',
          '  window.__tgCalls = [];',
          '  window.__sdkBooted = false;',
          '  function mark(name) { window.__tgCalls.push({ n: name, after: window.__sdkBooted }); }',
          '  var ver = ' + JSON.stringify(version) + ';',
          '  var platform = ' + JSON.stringify(platform || 'ios') + ';',
          '  function atLeast(need) {',
          '    var pa = String(ver).split("."), pb = String(need).split(".");',
          '    for (var i = 0; i < 3; i++) {',
          '      var d = (parseInt(pa[i], 10) || 0) - (parseInt(pb[i], 10) || 0);',
          '      if (d) return d > 0;',
          '    }',
          '    return true;',
          '  }',
          '  var app = {',
          '    initData: data, platform: platform, version: ver,',
          '    isVersionAtLeast: atLeast,',
          '    initDataUnsafe: { user: user },',
          '    ready: function () { mark("ready"); },',
          '    expand: function () { mark("expand"); },',
          '    onEvent: function () {}, offEvent: function () {},',
          '    BackButton: { isVisible: false, onClick: function () {} }',
          '  };',
          '  app.requestFullscreen = function () { mark("requestFullscreen"); };',
          '  app.disableVerticalSwipes = function () { mark("disableVerticalSwipes"); };',
          '  window.Telegram = { WebApp: app };',
          '  window.__sdkBooted = true;',
          '})();',
        ].join('\n');
      }
      function callCounts(calls) {
        const out = {};
        for (const c of calls || []) {
          assert.strictEqual(c.after, true, c.n + ' ran before the SDK script finished');
          out[c.n] = (out[c.n] || 0) + 1;
        }
        return out;
      }

      const pageHtml = await (await fetch(base + '/index.html')).text();
      const ver = pageHtml.match(/src="tg-boot\.js\?v=([0-9a-f]{8})"/);
      assert.ok(ver, 'prod index must cache-bust tg-boot.js with ?v=');
      const bootBytes = Buffer.from(await (await fetch(base + '/tg-boot.js')).arrayBuffer());
      const bootHash = crypto.createHash('sha1').update(bootBytes).digest('hex').slice(0, 8);
      assert.strictEqual(ver[1], bootHash, 'tg-boot.js ?v= must be the short SHA-1 of the file');
      console.log('PASS 11: tg-boot.js link carries ?v=' + ver[1]);

      await admin(base, { mode: 'v06', tgAuth: 'ok', clearLog: true });
      const ctxA = await browser.createBrowserContext();
      const a = await newRussianPage(ctxA);
      a.on('pageerror', (e) => errs.push('tgboot-a pageerror: ' + e.message));
      const hitsA = [];
      a.on('request', (rq) => { if (/telegram\.org/i.test(rq.url())) hitsA.push(rq.url()); });
      const t0 = Date.now();
      await a.goto(base + '/index.html', { waitUntil: 'domcontentloaded' });
      const guest = await a.evaluate(async () => {
        const ready = await Promise.race([
          window.__tgReady,
          new Promise(function (r) { setTimeout(function () { r('timeout'); }, 50); }),
        ]);
        await window.__hoppak.profile.flush();
        const st = window.__hoppak.profile.getState();
        return { ready: ready, st: st.st, tg: st.telegramId || (st.profile && st.profile.telegramId) || null };
      });
      assert.strictEqual(hitsA.length, 0, 'browser guest must not request telegram.org: ' + hitsA.join(' '));
      assert.strictEqual(guest.ready, false);
      assert.strictEqual(guest.st, 'ready');
      assert.ok(!guest.tg, 'guest must stay unlinked ' + JSON.stringify(guest));
      assert.ok(Date.now() - t0 < 3000, 'guest start waited on the SDK');
      await ctxA.close();
      console.log('PASS 11a: prod page without tgWebApp stays a guest and skips telegram.org');

      const initData = 'user=' + encodeURIComponent(JSON.stringify({ id: 9091, first_name: 'Roman' })) + '&auth_date=1&hash=00';
      await admin(base, { mode: 'v06', tgAuth: 'ok', clearLog: true });
      const ctxB = await browser.createBrowserContext();
      const b = await newRussianPage(ctxB);
      b.on('pageerror', (e) => errs.push('tgboot-b pageerror: ' + e.message));
      const hitsB = [];
      await b.setRequestInterception(true);
      b.on('request', (rq) => {
        const u = rq.url();
        if (/telegram\.org/i.test(u)) {
          hitsB.push(u);
          if (/telegram-web-app\.js/.test(u)) {
            rq.respond({ status: 200, contentType: 'application/javascript', body: mockSdk('8.0', 'ios') });
          } else rq.abort();
          return;
        }
        rq.continue();
      });
      await b.goto(base + '/index.html#tgWebAppData=' + encodeURIComponent(initData), { waitUntil: 'domcontentloaded' });
      const linked = await b.evaluate(async () => {
        const ready = await Promise.race([
          window.__tgReady,
          new Promise(function (r) { setTimeout(function () { r('timeout'); }, 2000); }),
        ]);
        await window.__hoppak.profile.flush();
        const st = window.__hoppak.profile.getState();
        const calls = window.__tgCalls || [];
        return {
          ready: ready, st: st.st,
          tg: String(st.telegramId || (st.profile && st.profile.telegramId) || ''),
          calls: calls,
        };
      });
      assert.ok(hitsB.some((u) => /telegram-web-app\.js/.test(u)), 'hash must load the SDK');
      assert.strictEqual(linked.ready, true);
      assert.strictEqual(linked.st, 'ready');
      assert.strictEqual(linked.tg, '9091', JSON.stringify(linked));
      assert.deepStrictEqual(callCounts(linked.calls), {
        ready: 1, expand: 1, requestFullscreen: 1, disableVerticalSwipes: 1,
      });
      const logB = await (await fetch(base + '/__mock/log')).json();
      assert.strictEqual(logB.log.filter((x) => x.path === '/api/auth/telegram').length, 1);
      await ctxB.close();

      const ctxOld = await browser.createBrowserContext();
      const old = await newRussianPage(ctxOld);
      old.on('pageerror', (e) => errs.push('tgboot-old pageerror: ' + e.message));
      await old.setRequestInterception(true);
      old.on('request', (rq) => {
        const u = rq.url();
        if (/telegram\.org/i.test(u)) {
          if (/telegram-web-app\.js/.test(u)) {
            rq.respond({ status: 200, contentType: 'application/javascript', body: mockSdk('6.9') });
          } else rq.abort();
          return;
        }
        rq.continue();
      });
      await old.goto(base + '/index.html#tgWebAppData=' + encodeURIComponent(initData), { waitUntil: 'domcontentloaded' });
      const oldCalls = await old.evaluate(async () => {
        await window.__tgReady;
        return window.__tgCalls || [];
      });
      assert.deepStrictEqual(callCounts(oldCalls), { ready: 1, expand: 1 });
      await ctxOld.close();

      async function desk(platform) {
        const ctx = await browser.createBrowserContext();
        const pg = await newRussianPage(ctx);
        pg.on('pageerror', (e) => errs.push('tgboot-' + platform + ' pageerror: ' + e.message));
        await pg.setRequestInterception(true);
        pg.on('request', (rq) => {
          const u = rq.url();
          if (/telegram\.org/i.test(u)) {
            if (/telegram-web-app\.js/.test(u)) {
              rq.respond({ status: 200, contentType: 'application/javascript', body: mockSdk('8.0', platform) });
            } else rq.abort();
            return;
          }
          rq.continue();
        });
        await pg.goto(base + '/index.html#tgWebAppData=' + encodeURIComponent(initData), { waitUntil: 'domcontentloaded' });
        const calls = await pg.evaluate(async () => {
          await window.__tgReady;
          return window.__tgCalls || [];
        });
        assert.deepStrictEqual(callCounts(calls), { ready: 1, expand: 1 }, platform);
        await ctx.close();
      }
      await desk('tdesktop');
      await desk('macos');
      console.log('PASS 11b: ios fullscreen once; tdesktop and macos only ready and expand');
    }

    {
      const ctx = await browser.createBrowserContext();
      const pg = await newRussianPage(ctx);
      await pg.setViewport({ width: 390, height: 600, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
      pg.on('pageerror', (e) => errs.push('v061 pageerror: ' + e.message));
      await pg.goto(base + '/index.html');
      await pg.waitForFunction(() => window.__hoppak && window.__hoppak.auditReach);
    const reach = await pg.evaluate(async () => {
      const maps = ['city', 'jungle', 'ice', 'lava', 'aqua', 'space'];
      const widths = [160, 180];
      let bad = 0;
      const samples = [];
      for (const map of maps) {
        for (const lw of widths) {
          for (let seed = 1; seed <= 8; seed++) {
            const r = window.__hoppak.auditReach(seed, 900, map, lw);
            bad += r.fails;
            if (r.fails && samples.length < 3) samples.push({ map, lw, seed, ex: r.example });
          }
        }
      }
      return { bad, samples };
    });
    assert.strictEqual(reach.bad, 0, 'reach ' + JSON.stringify(reach.samples));
    console.log('PASS 12: every stable row is within jump reach');

    const tele = await pg.evaluate(() => window.__hoppak.mageProbe());
    assert.ok(tele.n > 0, 'teleport is interpolated');
    assert.ok(Math.abs(tele.y1 - tele.tty) > 2, 'first tick is not a snap');
    assert.ok(Math.abs(tele.y2 - tele.y0) > 0, 'mage moves during the blend');
    console.log('PASS 13: mage teleport blends');

    const flash = await pg.evaluate(() => {
      window.__hoppak.setHero(0);
      window.__hoppak.screen('shop');
      window.__hoppak.tap('hero:act');
      return window.__hoppak.getFlash();
    });
    assert.ok(!flash || flash.indexOf('ВЫБРАН') < 0, 'no selected popup');
    console.log('PASS 14: hero select has no popup');

    function overlap(a, b) {
      return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
    }
    for (const inset of [0, 36]) {
      const lay = await pg.evaluate((n) => window.__hoppak.lobbyProbe(n), inset);
      const start = lay.boxes.find((b) => b.id === 'net:start' || b.id === 'net:ready');
      const leave = lay.boxes.find((b) => b.id === 'net:leave');
      assert.ok(start && leave, 'buttons ' + inset);
      assert.ok(start.y + start.h <= leave.y + 0.5, 'start above leave ' + inset);
      assert.ok(!overlap(start, leave), 'no overlap ' + inset);
      for (const b of lay.boxes) {
        if (b === start || b === leave) continue;
        if (b.id === 'net:start' || b.id === 'net:leave' || b.id === 'net:ready') continue;
        assert.ok(!overlap(start, b), inset + ' start vs ' + b.id);
        assert.ok(!overlap(leave, b), inset + ' leave vs ' + b.id);
        assert.ok(b.y + b.h <= lay.lh + 1 && b.y >= -1, b.id);
      }
      assert.ok(leave.y + leave.h <= lay.lh + 1);
    }
    console.log('PASS 15: lobby buttons stay clear of the evening score');

    for (const n of [5, 6]) {
      const ev = await pg.evaluate((count) => window.__hoppak.eveningProbe(count), n);
      assert.strictEqual(ev.round, 5, n + ' players header is the round, not the row count ' + JSON.stringify(ev));
      assert.strictEqual(ev.title, 'РАУНД 5', JSON.stringify(ev));
      assert.strictEqual(ev.total, n);
      assert.strictEqual(ev.covered, n, n + ' evening rows are reachable ' + JSON.stringify(ev));
      const start = ev.boxes.find((b) => b.id === 'net:start' || b.id === 'net:ready');
      const leave = ev.boxes.find((b) => b.id === 'net:leave');
      const evening = ev.boxes.find((b) => b.id === 'evening');
      assert.ok(start && leave && evening, 'evening layout ' + n);
      assert.ok(!overlap(evening, start) && !overlap(evening, leave), 'evening overlaps buttons ' + n);
      assert.ok(evening.y + evening.h <= start.y + 0.5, 'evening above start ' + n);
    }
    console.log('PASS 15b: evening header is the round; 5 and 6 names fit');
      await pg.setViewport({ width: 360, height: 560, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
      const narrow = await pg.evaluate(() => window.__hoppak.lobbyProbe(36));
      const ns = narrow.boxes.find((b) => b.id === 'net:start');
      const nl = narrow.boxes.find((b) => b.id === 'net:leave');
      assert.ok(ns && nl && ns.y + ns.h <= nl.y + 0.5);
      await ctx.close();
    }

    // 16. Main menu: no overlapping controls, inside the view, safe-area included.
    {
      const shots = path.resolve(__dirname, 'screens');
      fs.mkdirSync(shots, { recursive: true });
      const views = [
        { w: 390, h: 844, file: 'menu-390x844.png', inset: 0 },
        { w: 390, h: 640, file: 'menu-390x640.png', inset: 0 },
        { w: 360, h: 560, file: 'menu-360x560.png', inset: 47 },
      ];
      for (const v of views) {
        const ctx = await browser.createBrowserContext();
        const pg = await newRussianPage(ctx);
        await pg.setViewport({ width: v.w, height: v.h, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
        pg.on('pageerror', (e) => errs.push('menu ' + v.w + ' pageerror: ' + e.message));
        const top = v.inset, bot = v.inset ? 34 : 0;
        await pg.evaluateOnNewDocument((t, b) => {
          window.Telegram = {
            WebApp: {
              safeAreaInset: { top: t, bottom: b, left: 0, right: 0 },
              contentSafeAreaInset: { top: 0, bottom: 0, left: 0, right: 0 },
              onEvent() {}, offEvent() {},
            },
          };
          var root = document.documentElement;
          if (root) {
            root.style.setProperty('--tg-safe-area-inset-top', t + 'px');
            root.style.setProperty('--tg-safe-area-inset-bottom', b + 'px');
          }
        }, top, bot);
        await pg.goto(base + '/index.html');
        await settle(pg);
        await pg.waitForFunction(() => window.__hoppak.tabIconsReady(), { timeout: 4000 });
        await pg.evaluate(() => window.__hoppak.screen('menu'));
        await sleep(50);
        const fit = await pg.evaluate(() => {
          const g = window.__hoppak;
          const lay = g.menuLayout();
          const boxes = g.screenLayout().boxes.slice();
          if (lay.logo) boxes.push(Object.assign({ id: 'logo' }, lay.logo));
          if (lay.tag) boxes.push(Object.assign({ id: 'tag' }, lay.tag));
          if (lay.chip) boxes.push(Object.assign({ id: 'chip' }, lay.chip));
          if (lay.coins) boxes.push(Object.assign({ id: 'coins' }, lay.coins));
          const size = g.getSize();
          return { boxes, lw: size.lw, lh: size.lh, top: lay.safeTop || 0, bot: lay.safeBottom || 0 };
        });
        function over(a, b) {
          return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
        }
        const skip = { hero: { plat: 1 }, plat: { hero: 1 } };
        for (let i = 0; i < fit.boxes.length; i++) {
          const a = fit.boxes[i];
          assert.ok(a.x >= -1 && a.y >= fit.top - 1, v.file + ' ' + a.id + ' above safe area ' + JSON.stringify(a));
          assert.ok(a.x + a.w <= fit.lw + 1, v.file + ' ' + a.id + ' past right');
          assert.ok(a.y + a.h <= fit.lh - fit.bot + 1, v.file + ' ' + a.id + ' under safe bottom ' + JSON.stringify(fit));
          for (let j = i + 1; j < fit.boxes.length; j++) {
            const b = fit.boxes[j];
            if (skip[a.id] && skip[a.id][b.id]) continue;
            assert.ok(!over(a, b), v.file + ' overlap ' + a.id + ' ' + b.id + ' ' + JSON.stringify([a, b]));
          }
        }
        const ids = fit.boxes.map((b) => b.id);
        for (const id of ['hero:menu', 'start', 'camp', 'net:menu', 'ency', 'soon', 'tab:shop', 'tab:leagues', 'tab:home', 'tab:friends', 'tab:settings', 'logo', 'chip']) {
          assert.ok(ids.indexOf(id) >= 0, v.file + ' missing ' + id);
        }
        const play = fit.boxes.find((b) => b.id === 'start');
        const pick = fit.boxes.find((b) => b.id === 'hero:menu');
        const gridTop = Math.min.apply(null, fit.boxes.filter((b) => b.id === 'camp' || b.id === 'net:menu' || b.id === 'ency' || b.id === 'soon').map((b) => b.y));
        const above = play.y - (pick.y + pick.h);
        const below = gridTop - (play.y + play.h);
        assert.ok(above >= 8 && above <= 12, v.file + ' play gap above ' + above);
        assert.ok(below >= 8 && below <= 12, v.file + ' play gap below ' + below);
        const canvas = await pg.$('canvas');
        const box = await canvas.boundingBox();
        await pg.screenshot({ path: path.join(shots, v.file), clip: { x: box.x, y: box.y, width: box.width, height: box.height } });
        await ctx.close();
      }
      const soon = await (async () => {
        const ctx = await browser.createBrowserContext();
        const pg = await newRussianPage(ctx);
        await pg.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
        await pg.goto(base + '/index.html');
        await settle(pg);
        const flash = await pg.evaluate(() => {
          const g = window.__hoppak;
          g.tap('ency');
          const a = g.getFlash();
          g.tap('tab:shop');
          const shopTab = g.getFlash();
          const shopTabPhase = g.getPhase();
          g.tap('tab:leagues');
          const b = g.getFlash();
          g.tap('tab:friends');
          const c = g.getFlash();
          g.tap('hero:menu');
          const shop = g.getPhase();
          g.tap('back');
          g.tap('shop');
          const shop2 = g.getPhase();
          g.tap('back');
          g.tap('set');
          return { a, b, c, shop, shop2, shopTab, shopTabPhase };
        });
        await pg.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
        flash.setOn = await pg.evaluate(() => window.__hoppak.screenLayout().boxes.some((x) => x.id === 'settings'));
        flash.camp = await pg.evaluate(() => {
          const g = window.__hoppak;
          g.tap('set');
          g.tap('camp');
          return g.getPhase();
        });
        await ctx.close();
        return flash;
      })();
      assert.strictEqual(soon.a, 'СКОРО');
      assert.strictEqual(soon.shopTab, 'Скоро');
      assert.strictEqual(soon.shopTabPhase, 'menu');
      assert.strictEqual(soon.b, 'Скоро в 0.8');
      assert.strictEqual(soon.c, 'Скоро в 0.9');
      assert.strictEqual(soon.shop, 'shop');
      assert.strictEqual(soon.shop2, 'shop');
      assert.strictEqual(soon.setOn, true);
      assert.strictEqual(soon.camp, 'camp');
      const aligned = await (async () => {
        const ctx = await browser.createBrowserContext();
        const pg = await newRussianPage(ctx);
        await pg.goto(base + '/index.html');
        await settle(pg);
        const rows = await pg.evaluate(() => {
          const g = window.__hoppak;
          return g.heroAlign('menu').concat(g.heroAlign('shop'));
        });
        await ctx.close();
        return rows;
      })();
      assert.ok(aligned.length >= 6 * 3 + 6 * 4, 'hero samples ' + aligned.length);
      for (const r of aligned) {
        assert.ok(Math.abs(r.dx) <= 1, r.where + ' hero ' + r.kind + ' ' + r.pose + ' off by ' + r.dx);
      }
      console.log('PASS 16: menu boxes fit 390×844, 390×640 and 360×560; hero centred');
    }

    // 17. A replaced device keeps its profile and must explicitly switch back.
    {
      await admin(base2, { mode: 'v06', tgAuth: 'ok', clearLog: true });
      const seedTg = (tgId, tok) => {
        window.Telegram = {
          WebApp: {
            initData: 'user=' + encodeURIComponent(JSON.stringify({ id: tgId, first_name: 'Roman' })) + '&auth_date=1&hash=00',
            safeAreaInset: { top: 0, bottom: 0, left: 0, right: 0 },
            contentSafeAreaInset: { top: 0, bottom: 0, left: 0, right: 0 },
            onEvent() {}, offEvent() {},
            BackButton: { isVisible: false, onClick() {} },
          },
        };
        try { if (tok && !localStorage.getItem('hoppak_guest_token')) localStorage.setItem('hoppak_guest_token', tok); } catch (e) {}
      };
      const note = (pg) => pg.evaluate(() => !!window.__hoppak.sessionNote());
      const who = (pg) => pg.evaluate(() => {
        const p = window.__hoppak.profile.getState();
        return { id: p.profile.id, tg: p.telegramId, name: p.profile.displayName, state: p.st };
      });
      const open = async (ctx, tok) => {
        const pg = await newRussianPage(ctx);
        pg.on('pageerror', (e) => errs.push('17 pageerror: ' + e.message));
        await pg.evaluateOnNewDocument(seedTg, 6101, tok || '');
        await pg.goto(base2 + '/index.html');
        await settle(pg);
        await sleep(300);
        return pg;
      };
      const tokenOf = (pg) => pg.evaluate(() => localStorage.getItem('hoppak_guest_token'));
      const poke = async (pg) => { await pg.evaluate(async () => { await window.__hoppak.profile.flush(); }); await sleep(300); };

      // a) the same browser, two tabs: nobody is kicked
      const ctxA = await browser.createBrowserContext();
      const a1 = await open(ctxA);
      const idA = (await who(a1)).id;
      const a2 = await open(ctxA);
      await poke(a1); await poke(a2);
      assert.strictEqual(await note(a1), false, '17a tab 1 must not show the banner');
      assert.strictEqual(await note(a2), false, '17a tab 2 must not show the banner');
      assert.strictEqual((await who(a2)).id, idA, '17a same account');
      assert.ok((await tokenOf(a1)) === (await tokenOf(a2)), '17a one token per browser');

      // b) a really different client logs in: the first one is told, once
      const ctxB = await browser.createBrowserContext();
      const b1 = await open(ctxB);
      assert.strictEqual((await who(b1)).id, idA, '17b same Telegram account on device B');
      const tokB = await tokenOf(b1);
      assert.strictEqual(await note(b1), false, '17b the device that just logged in shows no banner');
      await poke(a1);
      assert.strictEqual(await note(a1), true, '17b device A must be told it was replaced');

      const tokA = await tokenOf(a1);
      assert.deepStrictEqual(await who(a1), { id: idA, tg: '6101', name: 'SERVER ROMAN', state: 'locked' });
      assert.strictEqual((await who(a2)).id, idA);

      // Opening a replaced token, including on a fresh tab with no cache, never takes over.
      await admin(base2, { clearLog: true });
      const ctxD = await browser.createBrowserContext();
      const d1 = await open(ctxD, tokA);
      assert.strictEqual(await note(d1), true);
      assert.strictEqual((await who(d1)).name, 'SERVER ROMAN');
      await a1.reload(); await settle(a1); await sleep(300);
      assert.strictEqual(await tokenOf(a1), tokA);
      assert.strictEqual(await note(a1), true);
      const blocked = await a1.evaluate(async () => {
        const game = window.__hoppak;
        game.tap('start');
        game.tap('camp');
        await game.profile.buy('char:1', 100);
        return { phase: game.getPhase(), buys: game.profile.getState().pendingBuysLen };
      });
      assert.deepStrictEqual(blocked, { phase: 'menu', buys: 0 });
      const noLogin = await (await fetch(base2 + '/__mock/log')).json();
      assert.ok(!noLogin.log.some((r) => ['/api/profile/guest', '/api/auth/telegram', '/api/profile/buy', '/api/run/start'].includes(r.path)));

      await a1.bringToFront();
      await a1.evaluate(() => window.__hoppak.tap('session:takeover'));
      await a1.waitForFunction(() => window.__hoppak.profile.getState().st === 'ready', { polling: 50 });
      assert.strictEqual(await note(a1), false);
      assert.notStrictEqual(await tokenOf(a1), tokA);
      assert.strictEqual((await who(a1)).id, idA);

      // The previous 401 protocol is still accepted by the client during rollout.
      await admin(base2, { replacementStatus: 401 });
      await poke(b1);
      assert.strictEqual(await note(b1), true);
      assert.strictEqual(await tokenOf(b1), tokB);
      assert.strictEqual((await who(b1)).name, 'SERVER ROMAN');
      await admin(base2, { replacementStatus: 409 });
      // f) a suspended app comes back: no takeover = nothing; after a takeover it learns it without any user action
      const ctxF = await browser.createBrowserContext();
      const f1 = await open(ctxF);
      const wake = async (pg) => { await pg.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); await sleep(500); };
      await wake(f1);
      assert.strictEqual(await note(f1), false, '17f returning to the app with the active login: no banner');
      const ctxG = await browser.createBrowserContext();
      await open(ctxG);
      await sleep(3200);
      await wake(f1);
      assert.strictEqual(await note(f1), true, '17f returning to a replaced app shows the banner');
      for (const c of [ctxA, ctxB, ctxD, ctxF, ctxG]) await c.close();
      console.log('PASS 17: two devices, reload stays locked, explicit takeover, legacy 401');
    }

    // 18. Presence: heartbeat while visible, exit beacon when the page is hidden/closed, takeover learned from the heartbeat.
    {
      await admin(base2, { mode: 'v06', tgAuth: 'ok', clearLog: true });
      const seedTg2 = (tgId) => {
        window.Telegram = {
          WebApp: {
            initData: 'user=' + encodeURIComponent(JSON.stringify({ id: tgId, first_name: 'Roman' })) + '&auth_date=1&hash=00',
            platform: 'android',
            safeAreaInset: { top: 0, bottom: 0, left: 0, right: 0 },
            contentSafeAreaInset: { top: 0, bottom: 0, left: 0, right: 0 },
            onEvent() {}, offEvent() {},
            BackButton: { isVisible: false, onClick() {} },
          },
        };
      };
      const open2 = async (ctx) => {
        const pg = await newRussianPage(ctx);
        pg.on('pageerror', (e) => errs.push('18 pageerror: ' + e.message));
        await pg.evaluateOnNewDocument(seedTg2, 6102);
        await pg.goto(base2 + '/index.html');
        await waitForState(pg, '18 Telegram login becomes ready', () => {
          const state = window.__hoppak?.profile?.getState();
          return state?.st === 'ready' && state.telegramId === '6102';
        });
        return pg;
      };
      const ctxH = await browser.createBrowserContext();
      const h1 = await open2(ctxH);
      const playerId = await h1.evaluate(() => window.__hoppak.profile.getState().profile.id);
      const heartbeatStart = seenLog.length;
      await h1.evaluate(() => window.__hoppak.profile.beat());
      const heartbeat = await waitSeen(playerId, heartbeatStart, false, '18 heartbeat reaches the server');
      assert.strictEqual(heartbeat.p, 'android', '18 heartbeat carries the Telegram platform');
      const exitStart = seenLog.length;
      await h1.evaluate(() => window.__hoppak.profile.exit());
      await waitSeen(playerId, exitStart, true, '18 exit beacon reaches the server');
      // another device takes the account over: the next heartbeat of the first one shows the banner
      const ctxI = await browser.createBrowserContext();
      await open2(ctxI);
      await Promise.all([
        h1.waitForResponse((response) => response.url() === base2 + '/api/profile/seen'
          && response.request().method() === 'POST' && response.status() === 401, { timeout: WAIT_MS })
          .catch(error => { throw new Error('18 old device heartbeat was not rejected', { cause: error }); }),
        h1.evaluate(() => window.__hoppak.profile.beat()),
      ]);
      await waitForState(h1, '18 the old device shows the takeover banner',
        () => !!window.__hoppak?.sessionNote());
      for (const c of [ctxH, ctxI]) await c.close();
      console.log('PASS 18: heartbeat, exit beacon, takeover learned from the heartbeat');
    }

    // 19. Contrast is applied before the first draw and zero-metre exits are reported.
    {
      const contrast = { bg: 70, platforms: 75, hero: 110, mobs: 50, coins: 85 };
      await admin(base2, { mode: 'v06', visualContrast: contrast });
      const ctx = await browser.createBrowserContext();
      const pg = await ctx.newPage();
      await pg.evaluateOnNewDocument(() => {
        const proto = CanvasRenderingContext2D.prototype;
        const filter = Object.getOwnPropertyDescriptor(proto, 'filter');
        window.__contrast = [];
        Object.defineProperty(proto, 'filter', {
          ...filter,
          set(value) {
            if (value.startsWith('saturate(')) window.__contrast.push(value);
            filter.set.call(this, value);
          },
        });
      });
      await pg.goto(base2 + '/index.html');
      await pg.waitForFunction(() => window.__contrast.length > 0);
      assert.strictEqual(await pg.evaluate(() => window.__contrast[0]), 'saturate(70%) contrast(70%)');
      await settle(pg);

      const finish = pg.waitForRequest((request) => new URL(request.url()).pathname === '/api/run/finish');
      await pg.evaluate(() => {
        const game = window.__hoppak;
        game.start('solo', 7, 'city');
        game.tap('menu');
      });
      const body = JSON.parse((await finish).postData());
      assert.deepStrictEqual([body.height, body.cause, body.mode, body.ver], [0, 'exit', 'solo', '1.0']);

      await admin(base2, { visualContrast: null });
      await pg.reload();
      await pg.waitForFunction(() => window.__contrast.length > 0);
      assert.strictEqual(await pg.evaluate(() => window.__contrast[0]), 'saturate(80%) contrast(80%)');
      await ctx.close();
      console.log('PASS 19: contrast before first draw, unavailable fallback, zero-metre telemetry');
    }

    assert.strictEqual(errs.length, 0, 'pageerrors: ' + errs.join('; '));
    console.log('ALL CLIENT PROFILE E2E TESTS PASS');
  } finally {
    try {
      await cleanup();
    } finally {
      process.removeListener('SIGINT', interrupt);
    }
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
