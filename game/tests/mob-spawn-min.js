#!/usr/bin/env node
/* Cheap check: every campaign mob's "from metres" is >= 120. No browser. */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const MIN = 120;
const src = fs.readFileSync(path.join(__dirname, '../src/01_core.tsx'), 'utf8');
const start = src.indexOf('var MAPS');
const end = src.indexOf('];', start);
assert.ok(start >= 0 && end > start, 'MAPS table not found in 01_core.tsx');
const block = src.slice(start, end + 2);
const mobsBlocks = [...block.matchAll(/mobs:\s*\[((?:\s*\[[^\]]+\]\s*,?)*)\]/g)];
assert.ok(mobsBlocks.length >= 6, 'expected at least 6 map rosters, got ' + mobsBlocks.length);

const rows = [];
for (const m of mobsBlocks) {
  for (const pair of m[1].matchAll(/\["([a-z]+)",\s*(\d+)\]/g)) {
    rows.push({ kind: pair[1], from: Number(pair[2]) });
  }
}
assert.ok(rows.length >= 6, 'no mob rows parsed');
const early = rows.filter((r) => r.from < MIN);
assert.deepStrictEqual(early, [], 'mobs below ' + MIN + ' m: ' + JSON.stringify(early));
assert.ok(rows.some((r) => r.kind === 'frog' && r.from === 120), 'jungle frog must start at 120 m');
console.log('PASS mob-spawn-min: ' + rows.length + ' roster entries, all from >= ' + MIN + ' m');
