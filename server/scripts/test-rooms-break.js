#!/usr/bin/env node
'use strict';
/* Shared red platforms: the server relays brk to the other clients and rst to everyone after 2.5s. */
const assert = require('assert');
const { RoomsService } = require('../dist/rooms.service');

function sock() {
  const s = { readyState: 1, msgs: [], send(raw) { s.msgs.push(JSON.parse(raw)); } };
  return s;
}
function events(s, name) {
  return s.msgs.filter((m) => m.event === 'ev' && m.data && m.data.e === name);
}

const rooms = new RoomsService();
const a = sock(), b = sock();
const host = rooms.create(a, 'А', 0);
rooms.setReady(host.room, host.player, true);
const guest = rooms.join(b, host.room.code, 'Б', 1);
rooms.setReady(guest.room, guest.player, true);
rooms.start(host.room, host.player);
a.msgs.length = 0;
b.msgs.length = 0;

rooms.event(host.room, host.player, { e: 'brk', id: 12 });
assert.strictEqual(events(a, 'brk').length, 0, 'the breaker already applied it locally');
assert.strictEqual(events(b, 'brk').length, 1, 'the other client hears the break');
assert.strictEqual(events(b, 'brk')[0].data.id, 12);

rooms.event(guest.room, guest.player, { e: 'brk', id: 12 });
assert.strictEqual(events(a, 'brk').length, 0, 'a second break of the same platform is ignored');
assert.strictEqual(events(b, 'brk').length, 1);

setTimeout(() => {
  const ra = events(a, 'rst'), rb = events(b, 'rst');
  assert.strictEqual(ra.length, 1, 'host hears the restore');
  assert.strictEqual(rb.length, 1, 'guest hears the restore');
  assert.strictEqual(ra[0].data.id, 12);
  rooms.event(host.room, host.player, { e: 'brk', id: 12 });
  assert.strictEqual(events(b, 'brk').length, 2, 'the platform can break again after it restores');
  rooms.onModuleDestroy();
  console.log('ALL ROOM BREAK TESTS PASS');
}, 2700);
