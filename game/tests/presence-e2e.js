'use strict';
/* last_seen_at / online flag against a real server + Postgres (needs DATABASE_URL to read player_presence / player_online_v):
 *   docker exec -e BASE=https://host -e WSU=wss://host/ws hs-profile node /tmp/presence-e2e.js
 * Cases: login creates the presence row (online); heartbeat refreshes it; version/platform stored;
 *        exit beacon -> offline, the next heartbeat -> online again; a replaced token cannot heartbeat (401);
 *        WS: room sets screen=lobby+room, leaving goes back to menu; crashed process = stale row ages out to offline;
 *        writes are throttled (many pings in a burst -> last_seen_at moves at most once per 20 s). */
const req = (n, paths) => { for (const r of paths) { try { return require(require.resolve(n, { paths: [r] })); } catch (e) {} } return require(n); };
const roots = ['/app/node_modules', '/app/server/node_modules', __dirname + '/../../server/node_modules'];
const WS = req('ws', roots), { Client } = req('pg', roots);
const BASE = process.env.BASE || 'http://127.0.0.1:8787', WSU = process.env.WSU || 'ws://game_green:8787/ws';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0;
const check = (name, ok, extra) => { if (!ok) fails++; console.log((ok ? 'PASS ' : 'FAIL ') + name + (extra ? ' ' + JSON.stringify(extra) : '')); };
async function call(method, path, body, tok) {
  const h = { 'content-type': 'application/json' }; if (tok) h.authorization = 'Bearer ' + tok;
  const r = await fetch(BASE + path, { method, headers: h, body: body ? JSON.stringify(body) : undefined });
  let d = null; try { d = await r.json(); } catch (e) {} return { s: r.status, d };
}
(async () => {
  const db = new Client({ connectionString: process.env.DATABASE_URL }); await db.connect();
  const row = async (id) => (await db.query(`SELECT *, extract(epoch FROM (now() - last_seen_at)) AS age FROM player_online_v WHERE player_id = $1`, [id])).rows[0];
  const g = await call('POST', '/api/profile/guest'); const T = g.d.token, id = g.d.profile.id;
  await sleep(500);
  let r = await row(id);
  check('login creates a presence row and the player is online', !!r && r.is_online === true && r.screen === 'menu', r && { online: r.is_online, screen: r.screen });
  // throttle: ten profile loads in a burst move last_seen_at at most once
  await db.query(`UPDATE player_presence SET last_seen_at = now() - interval '10 seconds' WHERE player_id = $1`, [id]);
  for (let i = 0; i < 10; i++) await call('GET', '/api/profile', null, T);
  await sleep(300);
  r = await row(id);
  check('burst of requests inside 20 s does not write again (throttle)', r.age > 8, { age: Math.round(r.age) });
  // heartbeat after the gap refreshes last_seen_at and stores version/platform (a new version bypasses the gate)
  const hb = await call('POST', '/api/profile/seen', { v: '0.6.1-rc.9', p: 'ios' }, T);
  await sleep(300);
  r = await row(id);
  check('heartbeat 200, last_seen_at fresh, version and platform stored', hb.s === 201 && r.age < 3 && r.client_version === '0.6.1-rc.9' && r.platform === 'ios', { s: hb.s, age: Math.round(r.age), v: r.client_version, p: r.platform });
  // exit beacon
  const ex = await call('POST', '/api/profile/seen', { exit: true }, T);
  await sleep(300);
  r = await row(id);
  check('exit beacon: left_at set, last_seen_at fresh, is_online=false', ex.s === 201 && r.left_at && r.age < 3 && r.is_online === false, { online: r.is_online });
  await call('POST', '/api/profile/seen', {}, T);
  await sleep(300);
  r = await row(id);
  check('next heartbeat after exit: online again', r.is_online === true);
  // stale row (a crashed process never writes again) ages out without any cleanup
  await db.query(`UPDATE player_presence SET last_seen_at = now() - interval '90 seconds', left_at = NULL WHERE player_id = $1`, [id]);
  r = await row(id);
  check('crash: last_seen_at 90 s old, no exit written -> offline', r.is_online === false);
  await db.query(`UPDATE player_presence SET last_seen_at = now() - interval '30 seconds' WHERE player_id = $1`, [id]);
  r = await row(id);
  check('30 s old -> still online', r.is_online === true);
  // WS room
  const ws = new WS(WSU); const ev = [];
  await new Promise((res, rej) => { ws.on('open', () => { ws.send(JSON.stringify({ event: 'create', data: { name: 'PRESE2E', kind: 0, pt: T } })); setTimeout(res, 900); }); ws.on('error', rej); ws.on('message', (b) => { try { ev.push(JSON.parse(String(b)).event); } catch (e) {} }); });
  r = await row(id);
  check('in a room: screen=lobby, room code set, online', r.screen === 'lobby' && r.room && r.is_online === true, { screen: r.screen, room: r.room });
  ws.send(JSON.stringify({ event: 'leave', data: {} })); await sleep(700);
  r = await row(id);
  check('left the room: back to menu, room empty', r.screen === 'menu' && r.room === '', { screen: r.screen, room: r.room });
  ws.close();
  // clean up this test's player (no Telegram row, so it is a plain guest)
  await db.query(`DELETE FROM player WHERE id = $1`, [id]);
  await db.end();
  console.log(fails ? 'PRESENCE E2E FAILED ' + fails : 'PRESENCE E2E OK');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error('PRESENCE E2E ERROR', e && e.message); process.exit(2); });
