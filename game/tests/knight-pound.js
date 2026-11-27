'use strict';
/**
 * Knight slam (pound): a mid-slam kill of a flying mob must not refill the 1-kill charge.
 * The flyer is killed with noBounce, same as a ground mob during the slam.
 *   node tests/knight-pound.js [baseUrl]
 */
const assert = require('assert');
const http = require('http');
const fs = require('fs');
const path = require('path');
const pp = require('/tmp/pp/node_modules/puppeteer-core');
const SITE = path.resolve(__dirname, '..', 'site');

function serve() {
  return new Promise((res) => {
    const srv = http.createServer((q, s) => {
      let f = path.join(SITE, decodeURIComponent(q.url.split('?')[0]));
      if (f.endsWith('/')) f += 'index.html';
      fs.readFile(f, (e, b) => { if (e) { s.statusCode = 404; s.end(); return; } s.end(b); });
    }).listen(0, '127.0.0.1', () => res(srv));
  });
}

(async () => {
  const srv = process.argv[2] ? null : await serve();
  const base = process.argv[2] || `http://127.0.0.1:${srv.address().port}/`;
  const br = await pp.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--disable-gpu'] });
  const pg = await br.newPage();
  await pg.setViewport({ width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  await pg.goto(base + '?t=' + Date.now(), { waitUntil: 'load', timeout: 30000 });
  await pg.waitForFunction(() => !!(window.__hoppak && window.__hoppak.start), { timeout: 20000 });

  const out = await pg.evaluate(() => {
    const h = window.__hoppak;
    const s = h.getSave();
    s.owned = s.owned || {};
    for (let i = 0; i < 6; i++) s.owned['char:' + i] = 1;
    s.owned['map:jungle'] = 1;
    s.mapBest = s.mapBest || {};
    s.mapBest.city = 2000;
    h.setHero(5); // knight, charge = kills / need 1
    const seeds = [1, 2, 3, 7, 11, 13, 21, 42, 77, 99, 123, 256];
    const flyKinds = { parrot: 1, bat: 1, ufo: 1, owl: 1, firebat: 1, ray: 1 };
    let slam = null, stomp = null;
    for (let i = 0; i < seeds.length && !slam; i++) {
      h.start('solo', seeds[i], 'jungle');
      h.warp(340);
      if (h.hold) h.hold(true);
      const w = h.getWorld();
      if (!w) continue;
      const p = w.players[0];
      const fly = (w.monsters || []).find((m) => m.alive && flyKinds[m.kind]);
      if (!fly) continue;
      p.x = fly.x;
      p.y = fly.y - 16;
      p.vy = 7.5;
      p.abCharge = 0;
      p.poundT = 1;
      p.kills = 0;
      const chargeBefore = p.abCharge;
      if (h.simTicks) h.simTicks(8);
      slam = {
        seed: seeds[i],
        kind: fly.kind,
        alive: !!fly.alive,
        chargeBefore,
        chargeAfter: p.abCharge,
        poundT: p.poundT,
        kills: p.kills,
        vy: p.vy
      };
    }
    // Control: a normal stomp (no slam) on a ground mob refills the kill charge.
    for (let i = 0; i < seeds.length && !stomp; i++) {
      h.start('solo', seeds[i], 'jungle');
      h.warp(140);
      if (h.hold) h.hold(true);
      const w = h.getWorld();
      const p = w.players[0];
      const frog = (w.monsters || []).find((m) => m.alive && m.kind === 'frog');
      if (!frog) continue;
      p.x = frog.x;
      p.y = frog.y - 16;
      p.vy = 2;
      p.abCharge = 0;
      p.poundT = 0;
      p.dashT = 0;
      p.kills = 0;
      if (h.simTicks) h.simTicks(8);
      stomp = {
        seed: seeds[i],
        alive: !!frog.alive,
        chargeAfter: p.abCharge,
        kills: p.kills
      };
    }
    return { slam, stomp };
  });

  console.log(JSON.stringify(out));
  assert(out.slam, 'need a flying mob under a mid-slam knight');
  assert.strictEqual(out.slam.alive, false, 'flyer should die mid-slam');
  assert.strictEqual(out.slam.chargeAfter, 0, 'mid-slam kill must not refill the knight charge, got ' + out.slam.chargeAfter);
  assert(out.slam.kills >= 1, 'kill is counted');
  if (out.stomp) {
    assert.strictEqual(out.stomp.alive, false, 'control stomp should kill');
    assert.ok(out.stomp.chargeAfter >= 1, 'a normal stomp still refills the 1-kill charge');
  }
  console.log('PASS knight-pound: mid-slam flyer does not refill charge; normal stomp still does');
  await br.close();
  if (srv) srv.close();
})().catch((e) => { console.error(e); process.exit(1); });
