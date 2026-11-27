'use strict';
/**
 * v1.0 generator check on the 180-wide field: no overlapping/intersecting platforms,
 * every row reachable with unchanged physics, wrap edges sane.
 *   cd game && bash build.sh site && node tests/gen-overlap.js [baseUrl]
 */
const assert = require('assert');
const http = require('http');
const fs = require('fs');
const path = require('path');
const pp = require('/tmp/pp/node_modules/puppeteer-core');
const SITE = path.resolve(__dirname, '..', 'site');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const SEEDS = [1, 7, 42, 1234, 99991, 2024, 31337, 555555];
const MAPS = ['city', 'jungle', 'ice', 'lava', 'aqua', 'space'];
const TARGET_ROWS = 5000;

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
  await pg.goto(base + '?api=http://127.0.0.1:9/', { waitUntil: 'load' });
  await sleep(1500);
  await pg.evaluate(() => window.__hoppak.tap('start'));
  await sleep(600);
  const size = await pg.evaluate(() => window.__hoppak.getSize());
  assert.strictEqual(size.lw, 180, 'play field is 180 wide, got ' + size.lw);
  let rowsTotal = 0, plats = 0, moves = 0, springs = 0, safetyFix = 0;
  for (const map of MAPS) {
    for (const seed of SEEDS) {
      const r = await pg.evaluate((s, m) => window.__hoppak.inspectMap(s, 9000, m), seed, map);
      assert.strictEqual(r.lw, 180);
      const LW = r.lw, XS = r.xSep;
      const rows = new Map();
      for (const p of r.platforms) { if (!rows.has(p.y)) rows.set(p.y, []); rows.get(p.y).push(p); }
      const ys = [...rows.keys()].sort((a, b) => b - a);
      rowsTotal += ys.length; plats += r.platforms.length;
      for (const p of r.platforms) {
        assert(p.x >= 2 && p.x + p.w <= LW - 2 + 1e-9, `${map}/${seed}: platform inside field x=${p.x} w=${p.w}`);
        if (p.type === 'move') moves++;
        if (p.spring) springs++;
      }
      for (let i = 0; i < ys.length; i++) {
        const row = rows.get(ys[i]).slice().sort((a, b) => a.x - b.x);
        const mv = row.filter((p) => p.type === 'move');
        if (mv.length) assert.strictEqual(row.length, 1, `${map}/${seed} y=${ys[i]}: a moving platform sweeps its row alone`);
        for (let k = 1; k < row.length; k++) {
          const gap = row[k].x - (row[k - 1].x + row[k - 1].w);
          assert(gap >= XS, `${map}/${seed} y=${ys[i]}: overlap/too close gap=${gap} (${JSON.stringify(row)})`);
        }
        if (i > 0) {
          const dy = ys[i - 1] - ys[i];
          assert(dy >= (ys[i - 1] === 0 ? 24 : r.rowSep), `${map}/${seed}: rows ${dy}px apart < ROW_SEP`); /* the start floor sits 24 px under row 1 by design */
          assert(dy <= r.gapCap, `${map}/${seed}: rows ${dy}px apart > GAP_CAP`);
          /* spring art is <= 12 game px tall, platform <= 8: boxes of different rows never intersect */
          assert(dy >= 24 && dy > 12 + 8, `${map}/${seed}: row boxes could touch`);
        }
      }
      /* reachability with unchanged physics: every stable platform of a row reaches a stable one of the next */
      const reach = (gap) => {
        const JV = -5.55, G = 0.19, MV = 2.7, JH = JV * JV / (2 * G);
        const h = Math.max(0, Math.min(gap, JH - 1));
        const t = (-JV - Math.sqrt(Math.max(0, JV * JV - 2 * G * h))) / G;
        return MV * t;
      };
      const eg = (a, b) => {
        const lin = (a0, a1, b0, b1) => (a1 >= b0 && b1 >= a0) ? 0 : (a1 < b0 ? b0 - a1 : a0 - b1);
        return Math.min(lin(a.x, a.x + a.w, b.x, b.x + b.w), lin(a.x, a.x + a.w, b.x + LW, b.x + b.w + LW), lin(a.x + LW, a.x + a.w + LW, b.x, b.x + b.w));
      };
      const stableT = (t) => t === 'normal' || t === 'ice' || t === 'grav' || t === 'bounce';
      let from = null;
      for (let i = 0; i < ys.length; i++) {
        const row = rows.get(ys[i]);
        if (row.some((p) => p.type === 'move')) { from = null; continue; }
        const st = row.filter((p) => stableT(p.type));
        if (from && i > 0) {
          const gap = ys[i - 1] - ys[i];
          for (const a of from) assert(st.some((b) => eg(a, b) <= reach(gap) + 0.01), `${map}/${seed} y=${ys[i]}: unreachable from ${JSON.stringify(a)}`);
        }
        if (st.length) from = st; 
      }
    }
  }
  /* wrap-around at the new edges: walk the hero off the right edge, it reappears on the left */
  const wrap = await pg.evaluate(async () => {
    const w = window.__hoppak.getWorld(); const p = w.players[0];
    p.x = 180 - 2; p.vx = 2.7; p.vy = -1;
    await new Promise((r) => setTimeout(r, 120));
    return { x: p.x };
  });
  assert(wrap.x < 60, 'hero wrapped from the right edge to the left, x=' + wrap.x);
  console.log(JSON.stringify({ lw: 180, maps: MAPS.length, seeds: SEEDS.length, rows: rowsTotal, platforms: plats, moving: moves, springs, wrapX: +wrap.x.toFixed(1) }));
  assert(rowsTotal >= TARGET_ROWS, 'checked rows ' + rowsTotal);
  console.log('PASS gen-overlap: no overlap, all rows reachable, wrap ok');
  await br.close(); if (srv) srv.close();
})().catch((e) => { console.error(e); process.exit(1); });
