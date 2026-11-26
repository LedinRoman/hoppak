'use strict';
const assert = require('assert');
const pp = require('/tmp/pp/node_modules/puppeteer-core');
const path = require('path');
const { createServer } = require('../../tools/profile-mock');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function admin(base, body) {
  const r = await fetch(base + '/__mock/admin', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return r.json();
}

(async () => {
  const srv = createServer();
  await new Promise((res) => srv.listen(0, '127.0.0.1', res));
  const port = srv.address().port;
  const base = `http://127.0.0.1:${port}`;

  const srv2 = createServer();
  await new Promise((res) => srv2.listen(0, '127.0.0.1', res));
  const port2 = srv2.address().port;
  const base2 = `http://127.0.0.1:${port2}`;

  const browser = await pp.launch({
    executablePath: '/usr/bin/google-chrome',
    args: ['--no-sandbox', '--allow-file-access-from-files'],
    headless: 'new',
  });

  const errs = [];
  try {
    // 1. file:// offline fallback
    {
      const pg = await browser.newPage();
      pg.on('pageerror', (e) => errs.push('file pageerror: ' + e.message));
      const fileUrl = 'file://' + path.resolve(__dirname, '..', 'index.html');
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
      const pg = await ctx.newPage();
      await pg.setViewport({ width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
      pg.on('pageerror', (e) => errs.push('v058 pageerror: ' + e.message));

      // Pre-seed an existing local save before visiting /v/0.58/
      await pg.goto(base + '/v/0.58/index.html');
      await pg.evaluate(() => {
        localStorage.clear();
        localStorage.setItem('hoppak_save', JSON.stringify({
          v5: 1, coins: 120, best: 240, mapBest: { city: 240 },
          owned: { 'char:1': 1 }, char: 1, bg: 'city', sfx: true, vib: true
        }));
      });
      await pg.reload();
      await sleep(400);

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
      assert.strictEqual(st3.tok, tok1);
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
      const midFlush = await pg.evaluate(() => ({
        st: window.__hoppak.profile.getState(),
        save: window.__hoppak.getSave(),
      }));
      // After buy (-80 => 50) + first queued run (+12 => 62), 1 run (+8) still in queue => effective save.coins = 70!
      assert.strictEqual(midFlush.st.profile.coins, 62);
      assert.strictEqual(midFlush.st.profile.purchases['map:jungle'], 1);
      assert.strictEqual(midFlush.st.queueLen, 1);
      assert.strictEqual(midFlush.save.coins, 70);

      // Verify 429 RATE_LIMIT keeps item in queue, then after cooldown resets it flushes cleanly
      await pg.evaluate(async () => { await window.__hoppak.profile.flush(); });
      assert.strictEqual((await pg.evaluate(() => window.__hoppak.profile.getState())).queueLen, 1);

      await admin(base, { resetCooldown: true });
      // Reload to clear nextRunAt client timer and flush remaining queued run cleanly
      await pg.reload();
      await sleep(500);
      const finalState = await pg.evaluate(() => ({
        st: window.__hoppak.profile.getState(),
        save: window.__hoppak.getSave(),
      }));
      assert.strictEqual(finalState.st.queueLen, 0);
      assert.strictEqual(finalState.st.pendingBuysLen, 0);
      assert.strictEqual(finalState.st.profile.coins, 70);
      assert.strictEqual(finalState.save.coins, 70);
      assert.strictEqual(finalState.st.profile.best, 200); // migrated under 2284797 (no best), then 200m synced under v06
      assert.strictEqual(finalState.save.best, 240); // local best preserved monotonically

      // Finish one higher run (350m) -> updates server best=350 and local best=350
      await admin(base, { resetCooldown: true });
      await pg.evaluate(() => {
        const g = window.__hoppak;
        g.start('solo', 10, 'city');
        const w = g.getWorld();
        w.players[0].maxH = 350 * 8; // +14
        w.runCoins = 1; // +15 => 85
        g.forceResults();
      });
      await sleep(300);
      const queuedFast = await pg.evaluate(() => window.__hoppak.profile.getState());
      assert.strictEqual(queuedFast.queueLen, 1); // client defers <8.2s finish instead of spamming 429
      await pg.reload();
      await sleep(500);
      const bestState = await pg.evaluate(() => window.__hoppak.profile.getState());
      assert.strictEqual(bestState.queueLen, 0);
      assert.strictEqual(bestState.profile.best, 350);
      assert.strictEqual(bestState.profile.coins, 85);

      await ctx.close();
      console.log('PASS 2: /v/0.58 <-> /v/0.6 sharing, 2284797 compat, offline queue, 503->v06 recovery, best & buy sync');
    }

    // 2b. Fresh guest directly on v06 server migrates best=240 & buys hero char:2 (200)
    {
      await admin(base2, { mode: 'v06', clearLog: true });
      const ctx = await browser.createBrowserContext();
      const pg = await ctx.newPage();
      pg.on('pageerror', (e) => errs.push('v06-fresh pageerror: ' + e.message));
      await pg.goto(base2 + '/v/0.6/index.html');
      await pg.evaluate(() => {
        localStorage.clear();
        localStorage.setItem('hoppak_save', JSON.stringify({
          v5: 1, coins: 250, best: 240, mapBest: { city: 240 },
          owned: {}, char: 0, bg: 'city', sfx: true, vib: true
        }));
      });
      await pg.reload();
      await sleep(400);
      await pg.evaluate(() => {
        window.__hoppak.tap('shop');
        window.__hoppak.tap('hero:2');
        window.__hoppak.tap('hero:act');
        window.__hoppak.tap('hero:act'); // confirm buy ninja (200)
      });
      await sleep(400);
      await pg.reload();
      await sleep(400);
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
      const pg = await ctx.newPage();
      pg.on('pageerror', (e) => errs.push('override pageerror: ' + e.message));
      await pg.goto(base + '/index.html?api=' + encodeURIComponent(base2));
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
      const pg = await browser.newPage();
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
        const pg = await ctx.newPage();
        pg.on('pageerror', (e) => errs.push('tg pageerror: ' + e.message));
        await pg.evaluateOnNewDocument((d) => {
          window.Telegram = { WebApp: { initData: d } };
        }, initData);
        await pg.goto(origin + '/index.html');
        await pg.evaluate((s) => {
          localStorage.clear();
          if (s) localStorage.setItem('hoppak_save', JSON.stringify(s));
        }, seed || null);
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

    // 6. Offline local payout respects 200/run and 400/hour caps
    {
      await admin(base, { mode: '503', clearLog: true });
      const ctx = await browser.createBrowserContext();
      const pg = await ctx.newPage();
      pg.on('pageerror', (e) => errs.push('cap pageerror: ' + e.message));
      await pg.goto(base + '/index.html');
      await pg.evaluate(() => localStorage.clear());
      await pg.reload();
      await sleep(400);
      const caps = await pg.evaluate(() => {
        const g = window.__hoppak;
        const out = [];
        function bigRun() {
          g.start('solo', 1, 'city');
          const w = g.getWorld();
          w.players[0].maxH = 20000 * 8;
          w.runCoins = 80;
          w.bonusCoins = 40;
          g.forceResults();
          const save = g.getSave();
          const world = g.getWorld();
          out.push({ coins: save.coins, earned: world && world.earned, limited: world && world.limited });
        }
        bigRun();
        bigRun();
        bigRun();
        return out;
      });
      assert.strictEqual(caps[0].earned, 200);
      assert.strictEqual(caps[0].coins, 200);
      assert.strictEqual(caps[1].earned, 200);
      assert.strictEqual(caps[1].coins, 400);
      assert.strictEqual(caps[2].earned, 0);
      assert.strictEqual(caps[2].coins, 400);
      assert.strictEqual(caps[2].limited, 'HOUR_CAP');
      await ctx.close();
      console.log('PASS 6: offline payout caps 200/run and 400/hour');
    }

    // 7. 400 from /buy rolls back optimistic owned flag and restores coins
    {
      await admin(base, { mode: 'v06', tgAuth: '503', clearLog: true });
      const ctx = await browser.createBrowserContext();
      const pg = await ctx.newPage();
      pg.on('pageerror', (e) => errs.push('buy400 pageerror: ' + e.message));
      await pg.goto(base + '/v/0.6/index.html');
      await pg.evaluate(() => {
        localStorage.clear();
        localStorage.setItem('hoppak_save', JSON.stringify({
          v5: 1, coins: 50, best: 0, mapBest: { city: 0 },
          owned: {}, char: 0, bg: 'city', sfx: true, vib: true
        }));
      });
      await pg.reload();
      await sleep(400);
      await pg.evaluate(async () => {
        await window.__hoppak.profile.flush();
        const s = window.__hoppak.getSave();
        s.coins = 0;
        s.owned['char:2'] = 1;
        s.char = 2;
        window.__hoppak.profile.buy('char:2', 200);
        await window.__hoppak.profile.flush();
      });
      await sleep(300);
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

    assert.strictEqual(errs.length, 0, 'pageerrors: ' + errs.join('; '));
    console.log('ALL CLIENT PROFILE E2E TESTS PASS');
  } finally {
    await browser.close();
    srv.close();
    srv2.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
