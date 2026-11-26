#!/usr/bin/env node
'use strict';
/* Host-only bots: add, kick a bot, kick a human, refuse a guest, start a solo+bots round. */
const assert = require('assert');
const { RoomsService, RoomError } = require('../dist/rooms.service');

function sock() {
  const s = { readyState: 1, msgs: [], sess: {}, send(raw) { s.msgs.push(JSON.parse(raw)); } };
  return s;
}
function ev(s, name) { return s.msgs.filter((m) => m.event === name); }
function fails(fn) {
  try { fn(); return null; }
  catch (e) { return e; }
}

const rooms = new RoomsService();
const hostSock = sock();
const guestSock = sock();
const host = rooms.create(hostSock, 'Хост', 0, '0.6');
hostSock.sess = { room: host.room, player: host.player };
const guest = rooms.join(guestSock, host.room.code, 'Гость', 1, '0.6');
guestSock.sess = { room: guest.room, player: guest.player };

const bot = rooms.addBot(host.room, host.player);
assert.strictEqual(bot.bot, true);
assert.strictEqual(bot.ready, true);
assert.strictEqual(host.room.players.length, 3);
assert.strictEqual(bot.ws, null);

const guestAdd = fails(() => rooms.addBot(host.room, guest.player));
assert.ok(guestAdd instanceof RoomError);
assert.strictEqual(guestAdd.code, 'NOT_HOST');

const guestKick = fails(() => rooms.kick(host.room, guest.player, bot.pid));
assert.strictEqual(guestKick && guestKick.code, 'NOT_HOST');
assert.strictEqual(host.room.players.length, 3, 'a guest cannot remove anyone');

rooms.kick(host.room, host.player, bot.pid);
assert.ok(!host.room.players.some((p) => p.pid === bot.pid), 'host removed the bot');

guestSock.msgs.length = 0;
rooms.kick(host.room, host.player, guest.player.pid);
const kicked = ev(guestSock, 'kicked');
assert.strictEqual(kicked.length, 1);
assert.strictEqual(kicked[0].data.msg, 'Тебя выгнали из комнаты');
assert.strictEqual(host.room.players.length, 1);
assert.strictEqual(guestSock.sess.room, undefined);
const back = fails(() => rooms.resume(guestSock, guest.player.token));
assert.strictEqual(back && back.code, 'NO_SESSION', 'the kicked token cannot resume');

const again = rooms.addBot(host.room, host.player);
assert.strictEqual(again.bot, true);
const old = fails(() => rooms.join(sock(), host.room.code, 'Старый', 2));
assert.strictEqual(old && old.code, 'GEN', 'bots do not open the room to another generation');

rooms.start(host.room, host.player);
assert.strictEqual(host.room.phase, 'play');
const started = ev(hostSock, 'start').pop();
assert.ok(started, 'solo + bot run starts');
assert.strictEqual(started.data.players.length, 2);
assert.ok(started.data.players.some((p) => p.bot));

rooms.botsState(host.room, host.player, { s: [{ b: again.pid, x: 40, y: -80, vx: 1, vy: -2, f: 1, a: 1, m: 16, ps: 0 }] });
assert.ok(again.st && again.st[0] === 40, 'host bot state is accepted');
const before = again.st[0];
rooms.state(host.room, guest.player, { b: again.pid, x: 9, y: -10, a: 1, m: 0 });
assert.strictEqual(again.st[0], before, 'a guest cannot write a bot');

rooms.onModuleDestroy();
console.log('ALL ROOM BOT TESTS PASS');
