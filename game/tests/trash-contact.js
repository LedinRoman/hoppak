'use strict';
/**
 * Trash can: a stomp from above kills it (16-tick death). Side or below knocks
 * the player away and leaves the can. City slime's stomp box is taller on top.
 *   node tests/trash-contact.js [baseUrl]
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
    s.mapBest = s.mapBest || {};
    s.mapBest.city = 2000;
    const PH = 16, PW = 12;
    const seeds = [1, 2, 3, 7, 11, 13, 21, 42, 77, 99, 123, 256, 512, 777, 2024, 9, 15, 33];
    function findKind(kind, map, warp) {
      for (let i = 0; i < seeds.length; i++) {
        h.start('solo', seeds[i], map);
        h.warp(warp);
        if (h.hold) h.hold(true);
        const w = h.getWorld();
        const mo = (w.monsters || []).find((m) => m.alive && m.kind === kind);
        if (mo) return { seed: seeds[i], w, p: w.players[0], mo };
      }
      return null;
    }
    function reset(p, mo) {
      p.alive = true; p.invT = 0; p.shieldT = 0; p.rocketT = 0; p.dashT = 0; p.poundT = 0; p.domeT = 0;
      p.kills = 0; p.grabT = 0; p.vx = 0;
      mo.alive = true; mo.squish = 0; mo.cool = 0;
    }

    const trash = findKind('trash', 'city', 500);
    if (!trash) return { error: 'no trash' };
    const { p, mo } = trash;

    reset(p, mo);
    p.x = mo.x + mo.w / 2 - PW / 2;
    p.y = mo.y - PH - 1;
    p.prevY = p.y - 4;
    p.vy = 2.5;
    if (h.simTicks) h.simTicks(2);
    const stomp = { alive: !!mo.alive, squish: mo.squish, kills: p.kills, playerAlive: !!p.alive, parts: (trash.w.particles || []).length };

    reset(p, mo);
    p.x = mo.x - PW + 3;
    p.y = mo.y + mo.h / 2; // feet below centre
    p.prevY = p.y;
    p.vy = 0.2;
    const xBefore = p.x, vxBefore = p.vx;
    if (h.simTicks) h.simTicks(2);
    const side = { alive: !!mo.alive, squish: mo.squish, kills: p.kills, playerAlive: !!p.alive, vx: p.vx, dx: p.x - xBefore, vxBefore };

    reset(p, mo);
    p.x = mo.x + mo.w / 2 - PW / 2;
    p.y = mo.y + mo.h - 2;
    p.prevY = p.y + 3;
    p.vy = -2;
    if (h.simTicks) h.simTicks(2);
    const below = { alive: !!mo.alive, squish: mo.squish, kills: p.kills, playerAlive: !!p.alive, vy: p.vy };

    const slime = findKind('blob', 'city', 200);
    let slimeBox = null;
    if (slime) {
      const b = slime.mo;
      // mobBox is not exposed; infer from overlap by reading x,y,w,h and the known formula via a stomp from slightly above the sprite.
      slimeBox = { x: b.x, y: b.y, w: b.w, h: b.h };
      // Probe: a falling player with feet 2 px above the sprite top should now overlap (old box started at y+1).
      reset(slime.p, slime.mo);
      slime.p.x = b.x + b.w / 2 - PW / 2;
      slime.p.y = b.y - 2 - PH; // feet at sprite top - 2
      slime.p.prevY = slime.p.y - 3;
      slime.p.vy = 2.5;
      if (h.simTicks) h.simTicks(2);
      slimeBox.stompFromAboveTop = { alive: !!slime.mo.alive, kills: slime.p.kills };
    }

    return { seed: trash.seed, stomp, side, below, slimeBox, trashSize: { w: mo.w, h: mo.h } };
  });

  console.log(JSON.stringify(out, null, 2));
  if (out.error) throw new Error(out.error);
  assert.strictEqual(out.stomp.alive, false, 'stomp must kill the can');
  assert.ok(out.stomp.squish >= 14 && out.stomp.squish <= 16, 'death should start at 16 ticks, got ' + out.stomp.squish);
  assert.ok(out.stomp.kills >= 1, 'stomp counts a kill');
  assert.strictEqual(out.stomp.playerAlive, true, 'stomper lives');
  assert.ok(out.stomp.parts >= 8, 'stomp should spawn debris, got ' + out.stomp.parts);

  assert.strictEqual(out.side.alive, true, 'side bump must not kill the can');
  assert.strictEqual(out.side.kills, 0, 'side bump is not a kill');
  assert.strictEqual(out.side.playerAlive, true, 'side bump must not hurt the player');
  assert.ok(Math.abs(out.side.vx) >= 1.5, 'side bump should knock the player away, vx=' + out.side.vx);

  assert.strictEqual(out.below.alive, true, 'below bump must not kill the can');
  assert.strictEqual(out.below.kills, 0, 'below bump is not a kill');
  assert.strictEqual(out.below.playerAlive, true, 'below bump must not hurt the player');

  if (out.slimeBox) {
    assert.strictEqual(out.slimeBox.stompFromAboveTop.alive, false, 'slime stomp from just above the sprite top should connect');
    assert.ok(out.slimeBox.stompFromAboveTop.kills >= 1, 'slime stomp counts');
  }

  console.log('PASS trash-contact: stomp kills with 16-tick death; side/below bounce; slime top stomp works');
  await br.close();
  if (srv) srv.close();
})().catch((e) => { console.error(e); process.exit(1); });
