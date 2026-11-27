'use strict';
/**
 * Vine-snake: damage box is the drawn skull only. A falling stomp with feet
 * at or above the head centre kills it; side or below still grabs (not hurt).
 * The vine is not a trigger. Both retracted and extended poses.
 *   node tests/snake-stomp.js [baseUrl]
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
    const seeds = [1, 2, 3, 7, 11, 13, 21, 42, 77, 99, 123, 256, 512, 777, 2024];
    let snake = null, seedUsed = null;
    for (let i = 0; i < seeds.length && !snake; i++) {
      h.start('solo', seeds[i], 'jungle');
      h.warp(700);
      if (h.hold) h.hold(true);
      const w = h.getWorld();
      snake = (w.monsters || []).find((m) => m.alive && m.kind === 'snake');
      if (snake) seedUsed = seeds[i];
    }
    if (!snake) return { error: 'no snake' };
    const PH = 16, PW = 12;

    function pose(mo, tick) {
      mo.t = tick;
      mo.alive = true;
      mo.squish = 0;
      mo.cool = 0;
      if (h.simTicks) h.simTicks(1);
    }
    function resetPlayer(p, mo) {
      p.alive = true;
      p.grabT = 0;
      p.grabMob = null;
      p.invT = 0;
      p.shieldT = 0;
      p.rocketT = 0;
      p.dashT = 0;
      p.poundT = 0;
      p.domeT = 0;
      p.kills = 0;
      p.hp = p.hp || 1;
      mo.alive = true;
      mo.squish = 0;
      mo.cool = 0;
    }
    function box(mo) {
      return { x: mo.x, y: mo.y, w: mo.w, h: mo.h, topY: mo.topY, botY: mo.botY, hangX: mo.hangX, mid: mo.y + mo.h / 2 };
    }
    function runCase(mo, p, tick, setup) {
      pose(mo, tick);
      resetPlayer(p, mo);
      setup(p, mo, box(mo));
      const before = { alive: mo.alive, grabT: p.grabT, kills: p.kills, box: box(mo), p: { x: p.x, y: p.y, vy: p.vy } };
      if (h.simTicks) h.simTicks(2);
      return {
        before,
        after: { alive: !!mo.alive, grabT: p.grabT, kills: p.kills, playerAlive: !!p.alive, box: box(mo) }
      };
    }

    const w = h.getWorld();
    const p = w.players[0];
    const mo = snake;
    const cases = {};

    for (const [name, tick] of [['retracted', 10], ['extended', 90]]) {
      pose(mo, tick);
      const b0 = box(mo);
      const headTop = b0.y;
      const headBot = b0.y + b0.h;
      const vineClear = (mo.topY != null) ? (headTop - mo.topY) : 0;
      cases[name + '_box'] = {
        w: b0.w, h: b0.h, y: b0.y, topY: b0.topY, botY: b0.botY,
        headBelowNeck: headTop - (mo.topY + (name === 'extended' ? (mo.botY - mo.topY) : 0)),
        vineClear,
        mid: b0.mid
      };

      // Stomp: falling, feet just above head centre.
      cases[name + '_stomp'] = runCase(mo, p, tick, (pl, m, b) => {
        pl.x = b.x + b.w / 2 - PW / 2;
        pl.y = b.y + b.h / 2 - PH - 1;
        pl.prevY = pl.y - 4;
        pl.vy = 2.4;
      });

      // Side: overlapping the head horizontally from the side, feet below centre, small/zero downward vel? 
      // Parent: side or below = grab. Use vy=0 (not falling) at mid-body height — or vy>0 with feet below centre.
      cases[name + '_side'] = runCase(mo, p, tick, (pl, m, b) => {
        pl.x = b.x - PW + 3;
        pl.y = b.y + b.h / 2 + 1; // feet well below centre
        pl.prevY = pl.y;
        pl.vy = 0.2;
      });

      // Below: jumping up into the chin (vy < 0) or standing under with upward motion.
      cases[name + '_below'] = runCase(mo, p, tick, (pl, m, b) => {
        pl.x = b.x + b.w / 2 - PW / 2;
        pl.y = b.y + b.h - 2;
        pl.prevY = pl.y + 3;
        pl.vy = -2;
      });

      // Vine (extended only): overlap vine x, y between hangTop and head top, should be a no-op.
      if (name === 'extended') {
        cases[name + '_vine'] = runCase(mo, p, tick, (pl, m, b) => {
          pl.x = (m.hangX != null ? m.hangX : b.x + b.w / 2) - PW / 2;
          pl.y = m.topY + 6;
          pl.prevY = pl.y;
          pl.vy = 0.5;
        });
      }
    }

    return { seed: seedUsed, w: mo.w, h: mo.h, cases };
  });

  console.log(JSON.stringify(out, null, 2));
  if (out.error) throw new Error(out.error);
  assert(out.w > 15 && out.w < 25, 'head width should be the scaled skull, got ' + out.w);
  assert(out.h > 14 && out.h < 22, 'head height should be the scaled skull, got ' + out.h);

  for (const pose of ['retracted', 'extended']) {
    const box = out.cases[pose + '_box'];
    assert(box.vineClear > 4, pose + ': skull should sit below the neck/leaf, vineClear=' + box.vineClear);
    const st = out.cases[pose + '_stomp'].after;
    assert.strictEqual(st.alive, false, pose + ': stomp from above must kill, alive=' + st.alive + ' grab=' + st.grabT);
    assert(st.kills >= 1, pose + ': stomp should count a kill');
    assert.strictEqual(st.grabT, 0, pose + ': stomp must not grab');
    const side = out.cases[pose + '_side'].after;
    assert.strictEqual(side.alive, true, pose + ': side contact must not kill');
    assert(side.grabT > 0, pose + ': side contact must grab, grabT=' + side.grabT);
    const below = out.cases[pose + '_below'].after;
    assert.strictEqual(below.alive, true, pose + ': contact from below must not kill');
    assert(below.grabT > 0, pose + ': contact from below must grab, grabT=' + below.grabT);
  }
  const vine = out.cases.extended_vine.after;
  assert.strictEqual(vine.alive, true, 'vine must not kill');
  assert.strictEqual(vine.grabT, 0, 'vine must not grab, grabT=' + vine.grabT);

  console.log('PASS snake-stomp: head-only box; stomp from above kills; side/below grab; vine inert; both poses');
  await br.close();
  if (srv) srv.close();
})().catch((e) => { console.error(e); process.exit(1); });
