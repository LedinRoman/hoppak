#!/usr/bin/env node
'use strict';
/* Rooms match only equal generation versions. A missing version is 0.59 and must not enter a 0.6 room. */
const assert = require('assert');
const { RoomsService, RoomError } = require('../dist/rooms.service');

function sock() {
  return { readyState: 1, msgs: [], send() {} };
}
function fails(fn) {
  try { fn(); return null; }
  catch (e) { return e; }
}

const rooms = new RoomsService();
const oldHost = rooms.create(sock(), 'СТАРЫЙ', 0);
const oldJoin = rooms.join(sock(), oldHost.room.code, 'ДРУГ', 1);
assert.strictEqual(oldJoin.room.code, oldHost.room.code, '0.59 clients still share a room');

const newHost = rooms.create(sock(), 'НОВЫЙ', 0, '0.6');
const mismatch = fails(() => rooms.join(sock(), newHost.room.code, 'СТАРЫЙ', 1));
assert.ok(mismatch instanceof RoomError);
assert.strictEqual(mismatch.code, 'GEN');
assert.strictEqual(mismatch.message, 'Обнови страницу');
assert.strictEqual(newHost.room.players.length, 1, 'the old client was not added');

const otherWay = fails(() => rooms.join(sock(), oldHost.room.code, 'НОВЫЙ', 1, '0.6'));
assert.strictEqual(otherWay && otherWay.code, 'GEN');

const peer = rooms.join(sock(), newHost.room.code, 'ПАРА', 2, '0.6');
assert.strictEqual(peer.room.players.length, 2, 'two 0.6 clients share a room');

const future = fails(() => rooms.join(sock(), newHost.room.code, 'ДАЛЬШЕ', 1, '0.7'));
assert.strictEqual(future && future.code, 'GEN');

rooms.onModuleDestroy();
console.log('ALL ROOM GENERATION TESTS PASS');
