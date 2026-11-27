'use strict';
/**
 * Trash cans (from 400 m) are only on a walk-past-wide platform or a row with a
 * reachable alternative. Vine-snakes only hang from static green `normal`
 * platforms with hangLen+head clearance below, so the extended head never sits
 * on a lower platform.
 *   node tests/trash-snake-path.js [baseUrl]
 */
const assert = require('assert');
const http = require('http');
const fs = require('fs');
const path = require('path');
const pp = require('/tmp/pp/node_modules/puppeteer-core');
const SITE = path.resolve(__dirname, '..', 'site');
const SEEDS = [1, 7, 42, 1234, 99991, 2024, 31337, 555555];
const PW = 12, TRASH_SIDE = PW + 4;
const SNAKE_HEAD_DRAW_H = 64 * 0.5 * 0.92;

function serve() {
  return new Promise((res) => {
    const srv = http.createServer((q, s) => {
      let f = path.join(SITE, decodeURIComponent(q.url.split('?')[0]));
      if (f.endsWith('/')) f += 'index.html';
      fs.readFile(f, (e, b) => { if (e) { s.statusCode = 404; s.end(); return; } s.end(b); });
    }).listen(0, '127.0.0.1', () => res(srv));
  });
}

function isPerm(t) { return t === 'normal' || t === 'move' || t === 'ice' || t === 'bounce' || t === 'grav'; }
function isStable(t) { return t === 'normal' || t === 'ice' || t === 'grav' || t === 'bounce'; }
function lin(a0, a1, b0, b1) { return (a1 >= b0 && b1 >= a0) ? 0 : (a1 < b0 ? b0 - a1 : a0 - b1); }
function edgeGap(a, b, LW) {
  return Math.min(
    lin(a.x, a.x + a.w, b.x, b.x + b.w),
    lin(a.x, a.x + a.w, b.x + LW, b.x + b.w + LW),
    lin(a.x + LW, a.x + a.w + LW, b.x, b.x + b.w)
  );
}
function reachPx(gap) {
  const JV = -5.55, G = 0.19, MV = 2.7, JH = JV * JV / (2 * G);
  const h = Math.max(0, Math.min(gap, JH - 1));
  const t = (-JV - Math.sqrt(Math.max(0, JV * JV - 2 * G * h))) / G;
  return MV * t;
}

(async () => {
  const srv = process.argv[2] ? null : await serve();
  const base = process.argv[2] || `http://127.0.0.1:${srv.address().port}/`;
  const br = await pp.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--disable-gpu'] });
  const pg = await br.newPage();
  await pg.setViewport({ width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  await pg.goto(base + '?t=' + Date.now(), { waitUntil: 'load', timeout: 30000 });
  await pg.waitForFunction(() => !!(window.__hoppak && window.__hoppak.inspectMap), { timeout: 20000 });

  let trashN = 0, trashWalk = 0, trashAlt = 0, snakeN = 0;
  const earlyTrash = [];
  for (const seed of SEEDS) {
    const city = await pg.evaluate((s) => window.__hoppak.inspectMap(s, 4000, 'city'), seed);
    const LW = city.lw;
    const plats = city.platforms;
    const byY = new Map();
    for (const p of plats) {
      if (!byY.has(p.y)) byY.set(p.y, []);
      byY.get(p.y).push(p);
    }
    const ys = [...byY.keys()].sort((a, b) => b - a);

    for (const mo of city.monsters) {
      if (mo.kind !== 'trash') continue;
      trashN++;
      const meters = -mo.y / 8;
      if (meters < 400 - 2) earlyTrash.push({ seed, meters, x: mo.x, y: mo.y });
      const row = (byY.get(plats.find((p) => Math.abs(p.y - (mo.y + mo.h)) <= 3) ? plats.find((p) => Math.abs(p.y - (mo.y + mo.h)) <= 3).y : null) || [])
        .slice();
      // host: platform whose top is at the can's feet
      let host = null;
      for (const p of plats) {
        if (Math.abs(p.y - (mo.y + mo.h)) <= 3 && mo.x + mo.w > p.x && mo.x < p.x + p.w) { host = p; break; }
      }
      assert(host, `seed ${seed}: trash has no host platform at ${mo.x},${mo.y}`);
      const leftover = Math.max(mo.x - host.x, host.x + host.w - (mo.x + mo.w));
      /* Width gate is w >= can+PW+4; 1px end parking leaves leftover = w-can-1, still >= PW. */
      const walk = host.w >= mo.w + TRASH_SIDE - 0.01 && leftover >= PW - 0.01;
      const idx = ys.indexOf(host.y);
      let alt = false;
      if (idx > 0) {
        const prevY = ys[idx - 1];
        const gap = prevY - host.y;
        const prevRow = byY.get(prevY) || [];
        const prevStable = prevRow.some((p) => p.type === 'move')
          ? [{ x: 2, w: LW - 4, type: 'move' }]
          : prevRow.filter((p) => isStable(p.type));
        const rowSolids = (byY.get(host.y) || []).filter((p) => isPerm(p.type) && p.type !== 'bounce' && !p.spring);
        const reach = reachPx(gap);
        const reachable = rowSolids.filter((p) => {
          if (p.type === 'move') return true;
          return prevStable.some((pr) => edgeGap(pr, p, LW) <= reach + 0.01);
        });
        alt = reachable.length >= 2;
      } else {
        const rowSolids = (byY.get(host.y) || []).filter((p) => isPerm(p.type) && p.type !== 'bounce' && !p.spring);
        alt = rowSolids.length >= 2;
      }
      assert(walk || alt, `seed ${seed}: trash at ${mo.x},${mo.y} host w=${host.w} leftover=${leftover} has no walk-past and no alt path`);
      if (walk) trashWalk++;
      else trashAlt++;
    }

    const jungle = await pg.evaluate((s) => window.__hoppak.inspectMap(s, 4000, 'jungle'), seed);
    const jplats = jungle.platforms;
    for (const mo of jungle.monsters) {
      if (mo.kind !== 'snake') continue;
      snakeN++;
      let host = null;
      const hangTop = (pl) => pl.y + 5;
      for (const p of jplats) {
        if (Math.abs(hangTop(p) - (mo.topY != null ? mo.topY : mo.y)) <= 4 && mo.x + mo.w > p.x + 1 && mo.x < p.x + p.w - 1) {
          host = p; break;
        }
      }
      assert(host, `seed ${seed}: snake has no host at ${mo.x},${mo.y}`);
      assert.strictEqual(host.type, 'normal', `seed ${seed}: snake on ${host.type} at y=${host.y}, must be normal green`);
      assert(!host.spring, `seed ${seed}: snake on a spring platform`);
      let best = 1e9;
      for (const q of jplats) {
        if (q === host || q.broken || q.y <= host.y) continue;
        if (mo.x + mo.w <= q.x || mo.x >= q.x + q.w) continue;
        if (q.y - host.y < best) best = q.y - host.y;
      }
      const need = 38 + SNAKE_HEAD_DRAW_H;
      assert(best >= need - 0.5, `seed ${seed}: snake clearance ${best} < ${need} (host y=${host.y})`);
    }
  }

  assert.strictEqual(earlyTrash.length, 0, 'trash before 400 m: ' + JSON.stringify(earlyTrash));
  assert(trashN > 0, 'expected some trash cans in 8 seeds to 4000 m');
  assert(snakeN > 0, 'expected some snakes in 8 jungle seeds to 4000 m');
  console.log(JSON.stringify({ trashN, trashWalk, trashAlt, snakeN, seeds: SEEDS.length }));
  console.log('PASS trash-snake-path: walk-past or alt path; snakes only on clear normal green plats');
  await br.close();
  if (srv) srv.close();
})().catch((e) => { console.error(e); process.exit(1); });
