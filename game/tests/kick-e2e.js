'use strict';
/* Two devices, one Telegram account, against a real server with a database (staging profile container):
 *   docker exec -e WSU=wss://host/ws -e BASE=https://host hs-profile node /tmp/kick-e2e.js
 * Needs TELEGRAM_BOT_TOKEN in the environment (it signs test initData for a throw-away test user; nothing is printed).
 * Cases:  same device never kicks itself (reopen, second tab/socket, reconnect);
 *         a second device kicks the first from the menu (HTTP) and from a room (WS closed 4001);
 *         the replaced device cannot slip back in with its old token (WS refused 4001, no seat);
 *         one account = one seat in a room. */
const crypto = require('crypto');
const WS = (() => { for (const r of ['/app/node_modules', '/app/server/node_modules', __dirname + '/../../server/node_modules']) { try { return require(require.resolve('ws', { paths: [r] })); } catch (e) {} } return require('ws'); })();
const BASE = process.env.BASE || 'http://127.0.0.1:8787', WSU = process.env.WSU || 'ws://game_green:8787/ws';
const TGID = Number(process.env.TGID || 999000018);
const token = process.env.TELEGRAM_BOT_TOKEN;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0;
const check = (name, ok, extra) => { if (!ok) fails++; console.log((ok ? 'PASS ' : 'FAIL ') + name + (extra ? ' ' + JSON.stringify(extra) : '')); };
function initData(user) {
  const f = { auth_date: String(Math.floor(Date.now() / 1000)), query_id: 'kick-e2e', user: JSON.stringify(user) };
  const dcs = Object.keys(f).sort().map((k) => `${k}=${f[k]}`).join('\n');
  const sec = crypto.createHmac('sha256', 'WebAppData').update(token, 'utf8').digest();
  return new URLSearchParams({ ...f, hash: crypto.createHmac('sha256', sec).update(dcs, 'utf8').digest('hex') }).toString();
}
async function call(method, path, body, tok) {
  const h = { 'content-type': 'application/json' }; if (tok) h.authorization = 'Bearer ' + tok;
  const r = await fetch(BASE + path, { method, headers: h, body: body ? JSON.stringify(body) : undefined });
  let d = null; try { d = await r.json(); } catch (e) {} return { s: r.status, d };
}
function sock(action, pt, extra) {
  return new Promise((res, rej) => {
    const ws = new WS(WSU); const st = { ws, events: [], closed: null, room: null };
    ws.on('message', (b) => { try { const m = JSON.parse(String(b)); st.events.push(m.event); if (m.event === 'room') st.room = m.data; } catch (e) {} });
    ws.on('close', (c) => { st.closed = c; });
    ws.on('open', () => { ws.send(JSON.stringify({ event: action, data: Object.assign({ name: 'KICKE2E', kind: 0, pt }, extra || {}) })); setTimeout(() => res(st), 800); });
    ws.on('error', rej);
  });
}
const U = { id: TGID, first_name: 'Kick' };
const login = (bearer) => call('POST', '/api/auth/telegram', { initData: initData(U) }, bearer);
(async () => {
  // device P (phone) logs in and sits in a room
  const p = await login(); const TP = p.d.token;
  const sp = await sock('create', TP);
  check('P in a room', !!sp.room);
  // same device: reopen with its own token, second tab/socket on the same token, reconnect
  const re = await login(TP);
  check('P reopen keeps its token (no rotation)', re.s === 201 && re.d.token === TP);
  const sp2 = await sock('join', TP, { code: sp.room && sp.room.code });
  await sleep(1200);
  check('same device: second socket joins the same room, nobody told "replaced" by the device itself', !sp2.events.includes('replaced'));
  const seatsP = (sp2.room && sp2.room.players || []).filter((x) => !x.bot);
  check('one account = one seat in the room after the second socket', seatsP.length === 1, { seats: seatsP.length });
  check('the first socket of the same account was replaced by the second (seat is single)', sp.events.includes('replaced') || sp.closed !== null);
  // device D (desktop) logs in with no token (its own storage): P must be kicked from room and menu
  const d = await login(); const TD = d.d.token;
  check('D got a new token', d.s === 201 && TD !== TP);
  await sleep(2500);
  const oldProf = await call('GET', '/api/profile', null, TP);
  check('P menu: old token gets SESSION_REPLACED over HTTP', oldProf.s === 401 && oldProf.d.error === 'SESSION_REPLACED', { s: oldProf.s, e: oldProf.d && oldProf.d.error });
  const oldBeat = await call('POST', '/api/profile/seen', { v: 'x' }, TP);
  check('P heartbeat with the replaced token gets SESSION_REPLACED (first device learns within one beat)', oldBeat.s === 401 && oldBeat.d.error === 'SESSION_REPLACED', { s: oldBeat.s });
  check('P room: socket told "replaced" and closed 4001', (sp2.events.includes('replaced')) && sp2.closed === 4001, { closed: sp2.closed });
  // P (stale token, e.g. a suspended phone app) tries to enter multiplayer anyway: refused, no seat
  const stale = await sock('create', TP);
  check('P with a replaced token is refused over WS (replaced, 4001, no room)', stale.events.includes('replaced') && stale.closed === 4001 && !stale.room, { ev: stale.events, closed: stale.closed });
  const stale2 = await sock('join', TP, { code: '0000' });
  check('P join with replaced token refused too', stale2.events.includes('replaced') && stale2.closed === 4001 && !stale2.room);
  // D works
  const sd = await sock('create', TD);
  check('D enters a room', !!sd.room);
  const sd2 = await sock('create', TD); // same device, another room attempt on same token: allowed (another tab)
  await sleep(500);
  check('D is not kicked by its own second tab', !sd.events.includes('replaced') && sd.closed === null);
  // a third device kicks D from the room
  const e = await login(); const TE = e.d.token;
  await sleep(2500);
  check('D (in a room) is kicked when a third device logs in', sd.events.includes('replaced') && sd.closed === 4001, { closed: sd.closed });
  const se = await sock('create', TE);
  check('E enters and is not kicked', !!se.room && !se.events.includes('replaced'));
  [sp, sp2, stale, stale2, sd, sd2, se].forEach((s) => { try { s.ws.send(JSON.stringify({ event: 'leave', data: {} })); s.ws.close(); } catch (er) {} });
  console.log(fails ? 'KICK E2E FAIL (' + fails + ')' : 'KICK E2E OK');
  setTimeout(() => process.exit(fails ? 1 : 0), 300);
})().catch((err) => { console.error('KICK_E2E_ERR ' + err.message); process.exit(1); });
