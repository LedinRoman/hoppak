'use strict';
/**
 * Real Postgres checks: finish lock, missing start, presence, cross-process kick.
 *   DATABASE_URL=postgres://hoppak@127.0.0.1:5432/hoppak_test node scripts/test-pg-guard.js
 */
const assert = require('assert');
const crypto = require('crypto');
const path = require('path');
const { spawn } = require('child_process');
const { Client } = require('pg');
const WebSocket = require('ws');

const DATABASE_URL = process.env.DATABASE_URL || 'postgres://hoppak@127.0.0.1:5432/hoppak_test';
process.env.DATABASE_URL = DATABASE_URL;
const BOT = 'hoppak-unit-test-bot-token';
const ADMIN = crypto.randomBytes(24).toString('hex');
const root = path.join(__dirname, '..');
const GAME_PORT = Number(process.env.HOP_TEST_GAME_PORT || 8791);
const PROFILE_PORT = Number(process.env.HOP_TEST_PROFILE_PORT || 8792);

function makeInitData(userId) {
  const user = JSON.stringify({ id: userId, first_name: 'T' });
  const auth_date = String(Math.floor(Date.now() / 1000));
  const fields = { auth_date, query_id: 'AA', user };
  const dataCheckString = Object.keys(fields).sort().map((k) => `${k}=${fields[k]}`).join('\n');
  const secret = crypto.createHmac('sha256', 'WebAppData').update(BOT, 'utf8').digest();
  const hash = crypto.createHmac('sha256', secret).update(dataCheckString, 'utf8').digest('hex');
  return new URLSearchParams({ ...fields, hash }).toString();
}

async function sql(text, params) {
  const c = new Client({ connectionString: DATABASE_URL });
  await c.connect();
  try { return await c.query(text, params); }
  finally { await c.end().catch(() => {}); }
}

function startServer(port) {
  const child = spawn(process.execPath, ['dist/main.js'], {
    cwd: root,
    env: { ...process.env, PORT: String(port), DATABASE_URL, TELEGRAM_BOT_TOKEN: BOT, ADMIN_TOKEN: ADMIN },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.buf = '';
  const take = (b) => { child.buf = (child.buf + b.toString()).slice(-4000); };
  child.stdout.on('data', take);
  child.stderr.on('data', take);
  return child;
}

async function waitHealth(port) {
  const t0 = Date.now();
  while (Date.now() - t0 < 20000) {
    try {
      const r = await fetch('http://127.0.0.1:' + port + '/api/health');
      if (r.ok) return;
    } catch { /* boot */ }
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error('health timeout ' + port);
}

async function api(port, method, p, body, token) {
  const headers = {};
  if (token) headers.Authorization = 'Bearer ' + token;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const r = await fetch('http://127.0.0.1:' + port + p, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(1500),
  });
  const data = await r.json().catch(() => null);
  return { status: r.status, data };
}

function openWs(port) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket('ws://127.0.0.1:' + port + '/ws');
    const timer = setTimeout(() => reject(new Error('ws open timeout')), 4000);
    ws.once('open', () => { clearTimeout(timer); resolve(ws); });
    ws.once('error', (e) => { clearTimeout(timer); reject(e); });
  });
}

(async () => {
  const prep = new Client({ connectionString: DATABASE_URL });
  await prep.connect();
  await prep.query('DROP SCHEMA public CASCADE');
  await prep.query('CREATE SCHEMA public');
  await prep.end();
  const ds = require('../dist/db/data-source').default;
  await ds.initialize();
  const ran = await ds.runMigrations();
  await ds.destroy();
  assert.ok(ran.some((m) => /DropPlayerTelegramId/.test(m.name)), 'migration 800 applied');
  const cols = await sql(
    `SELECT column_name FROM information_schema.columns WHERE table_name = 'player_telegram' ORDER BY column_name`,
  );
  const names = cols.rows.map((r) => r.column_name);
  assert.ok(names.includes('telegram_id'), 'the Telegram identity is stored in player_telegram');
  const coreTelegramId = await sql(
    "SELECT column_name FROM information_schema.columns WHERE table_name = 'player' AND column_name = 'telegram_id'",
  );
  assert.strictEqual(coreTelegramId.rowCount, 0, 'player has no duplicate Telegram identity column');
  assert.ok(names.includes('username') && names.includes('player_id'));

  const game = startServer(GAME_PORT);
  const profile = startServer(PROFILE_PORT);
  const stop = () => { try { game.kill('SIGTERM'); } catch {} try { profile.kill('SIGTERM'); } catch {} };
  try {
    await waitHealth(GAME_PORT);
    await waitHealth(PROFILE_PORT);
    await new Promise((r) => setTimeout(r, 400));

    const g = await api(PROFILE_PORT, 'POST', '/api/profile/guest');
    assert.strictEqual(g.status, 201, JSON.stringify(g.data));
    const tok = g.data.token;
    const id = g.data.profile.id;
    await sql(
      `UPDATE player_geo SET country = 'RU', origin_language = 'ru' WHERE player_id = $1`,
      [id],
    );
    await api(PROFILE_PORT, 'GET', '/api/profile', undefined, tok);
    const geo = await sql(`SELECT country, origin_language, last_ip FROM player_geo WHERE player_id = $1`, [id]);
    assert.strictEqual(geo.rows[0].country, 'RU', 'private address keeps country');
    assert.strictEqual(geo.rows[0].origin_language, 'ru');

    await api(PROFILE_PORT, 'POST', '/api/run/start', { runId: 'big-1', map: 'city', hero: 4 }, tok);
    await sql(`UPDATE run_start SET started_at = now() - interval '1 second' WHERE run_id = 'big-1'`);
    const t0 = Date.now();
    const fin = await api(PROFILE_PORT, 'POST', '/api/run/finish', {
      runId: 'big-1', map: 'city', hero: 4, ver: '0.6rc', height: 99999, runCoins: 99999, bonusCoins: 0,
    }, tok);
    const dt = Date.now() - t0;
    assert.ok(dt < 1000, 'inflated finish took ' + dt + 'ms');
    assert.strictEqual(fin.data.awarded, 0, JSON.stringify(fin.data));
    assert.strictEqual(fin.data.limited, 'REJECTED');
    assert.ok(!fin.data.reason && !fin.data.maxCoins);
    const sus = await sql(`SELECT reason, claimed_height FROM suspicious_runs WHERE run_id = 'big-1'`);
    assert.strictEqual(sus.rows.length, 1, 'suspicious row written');
    assert.ok(sus.rows[0].reason.indexOf('height') >= 0, sus.rows[0].reason);

    const noId = await api(PROFILE_PORT, 'POST', '/api/run/finish', {
      height: 500, runCoins: 100, bonusCoins: 0, map: 'city',
    }, tok);
    assert.strictEqual(noId.data.awarded, 0);
    const noIdRow = await sql(`SELECT reason FROM suspicious_runs WHERE player_id = $1 AND reason = 'NO_RUN_ID'`, [id]);
    assert.ok(noIdRow.rows.length >= 1);

    const noStart = await api(PROFILE_PORT, 'POST', '/api/run/finish', {
      runId: 'ghost-pg', height: 300, runCoins: 10, bonusCoins: 0, map: 'city',
    }, tok);
    assert.strictEqual(noStart.data.awarded, 0);
    const ghost = await sql(`SELECT reason FROM suspicious_runs WHERE run_id = 'ghost-pg'`);
    assert.strictEqual(ghost.rows[0].reason, 'NO_RUN_START');
    const coins = await sql(`SELECT coins FROM player WHERE id = $1`, [id]);
    assert.strictEqual(Number(coins.rows[0].coins), 0, 'none of the rejected finishes paid');
    console.log('PASS postgres finish < ' + dt + 'ms, suspicious_runs, no start/id');

    const reportPath = '/api/admin/telemetry?from=2026-11-27&to=2026-11-27';
    assert.strictEqual((await api(PROFILE_PORT, 'GET', reportPath)).status, 401);
    assert.strictEqual((await api(PROFILE_PORT, 'GET', reportPath, undefined, tok)).status, 401);
    assert.strictEqual((await api(PROFILE_PORT, 'GET', '/api/admin/telemetry?from=2026-02-30', undefined, ADMIN)).status, 400);
    const empty = await api(PROFILE_PORT, 'GET', reportPath, undefined, ADMIN);
    assert.deepStrictEqual(empty.data, { days: [], causes: [], heroes: [] });
    for (const [runId, height, cause, hero, timestamp] of [
      ['utc-before', 10, 'left', 5, '2026-11-26T23:59:59.999Z'],
      ['utc-start', 0, 'exit', 0, '2026-11-27T00:00:00.000Z'],
      ['utc-middle', 90, 'exit', 3, '2026-11-27T12:00:00.000Z'],
      ['utc-end', 180, 'mob:bat', 3, '2026-11-27T23:59:59.999Z'],
      ['utc-after', 10, 'left', 5, '2026-11-28T00:00:00.000Z'],
    ]) {
      await api(PROFILE_PORT, 'POST', '/api/run/start', { runId, map: 'ice', hero }, tok);
      const finish = await api(PROFILE_PORT, 'POST', '/api/run/finish', { runId, height, cause, hero, map: 'ice', mode: 'solo' }, tok);
      assert.strictEqual(finish.status, 201);
      assert.notStrictEqual(finish.data.limited, 'REJECTED');
      await sql('UPDATE player_run SET finished_at = $1 WHERE player_id = $2 AND run_id = $3', [timestamp, id, runId]);
    }
    const report = await api(PROFILE_PORT, 'GET', reportPath, undefined, ADMIN);
    assert.strictEqual(report.status, 200);
    assert.deepStrictEqual(report.data, {
      days: [{ date: '2026-11-27', runs: 3, avgHeight: 90 }],
      causes: [{ cause: 'exit', n: 2 }, { cause: 'mob:bat', n: 1 }],
      heroes: [{ hero: 0, n: 1, pct: 33.33 }, { hero: 3, n: 2, pct: 66.67 }],
    });
    console.log('PASS telemetry aggregates and UTC date boundaries');

    const visual = await fetch(`http://127.0.0.1:${PROFILE_PORT}/api/config/visual`);
    assert.strictEqual(visual.headers.get('cache-control'), 'public, max-age=60');
    assert.deepStrictEqual(await visual.json(), { bg: 80, platforms: 92, hero: 92, mobs: 88, coins: 85 });
    const settingsPath = '/api/admin/config/visual';
    const values = { bg: 65, platforms: 92, hero: 110, mobs: 50, coins: 85 };
    assert.strictEqual((await api(PROFILE_PORT, 'PUT', settingsPath, values, tok)).status, 401);
    assert.strictEqual((await api(PROFILE_PORT, 'PUT', settingsPath, { ...values, hero: 110.1 }, ADMIN)).status, 400);
    assert.strictEqual((await api(PROFILE_PORT, 'PUT', settingsPath, { ...values, hero: 111 }, ADMIN)).status, 400);
    assert.strictEqual((await api(PROFILE_PORT, 'PUT', settingsPath, { ...values, mobs: undefined }, ADMIN)).status, 400);
    const changed = await api(PROFILE_PORT, 'PUT', settingsPath, values, ADMIN);
    assert.strictEqual(changed.status, 200);
    assert.deepStrictEqual(changed.data, values);
    const synced = await api(GAME_PORT, 'GET', '/api/config/visual');
    assert.deepStrictEqual(synced.data, values, 'the second process reads the saved setting');
    const audit = await sql("SELECT updated_by, updated_at FROM game_settings WHERE key = 'visual_contrast'");
    assert.strictEqual(audit.rows[0].updated_by, 'admin');
    assert.ok(audit.rows[0].updated_at instanceof Date);
    const adminPage = await fetch(`http://127.0.0.1:${PROFILE_PORT}/api/admin`);
    assert.strictEqual(adminPage.status, 200);
    assert.ok((await adminPage.text()).includes('id="contrast"'));
    console.log('PASS visual settings auth, validation, persistence, cache header and admin page');

    const ws = await openWs(GAME_PORT);
    const msgs = [];
    let closed = 0;
    ws.on('message', (buf) => { try { msgs.push(JSON.parse(buf.toString())); } catch {} });
    ws.on('close', (code) => { closed = code; });
    ws.send(JSON.stringify({ event: 'create', data: { pt: tok, name: 'ROMAN', kind: 0, g: '0.6', v: '0.6rc', p: 'ios' } }));
    const tSeen = Date.now();
    let online = [];
    while (Date.now() - tSeen < 3000) {
      const q = await sql(`SELECT client_version, platform, screen FROM player_online_v WHERE player_id = $1 AND room <> ''`, [id]);
      online = q.rows;
      if (online.length) break;
      await new Promise((r) => setTimeout(r, 50));
    }
    assert.strictEqual(online.length, 1, 'online row ' + JSON.stringify(online));
    assert.strictEqual(online[0].client_version, '0.6rc');
    assert.strictEqual(online[0].platform, 'ios');
    ws.send(JSON.stringify({ event: 'presence', data: { screen: 'lobby' } }));
    await new Promise((r) => setTimeout(r, 200));
    const kept = await sql(`SELECT client_version, platform FROM player_online_v WHERE player_id = $1 AND room <> ''`, [id]);
    assert.strictEqual(kept.rows[0].client_version, '0.6rc', 'empty presence keeps version');
    assert.strictEqual(kept.rows[0].platform, 'ios');
    ws.close();
    const tGone = Date.now();
    let left = 1;
    while (Date.now() - tGone < 3000) {
      const q = await sql(`SELECT 1 FROM player_online_v WHERE player_id = $1 AND room <> ''`, [id]);
      left = q.rows.length;
      if (!left) break;
      await new Promise((r) => setTimeout(r, 50));
    }
    assert.strictEqual(left, 0, 'disconnect clears the room');
    console.log('PASS presence keeps version and clears the room on close');

    const linked = await api(PROFILE_PORT, 'POST', '/api/auth/telegram', { initData: makeInitData(4242) }, tok);
    assert.strictEqual(linked.status, 201, JSON.stringify(linked.data));
    const ws2 = await openWs(GAME_PORT);
    const got = [];
    let code2 = 0;
    ws2.on('message', (buf) => { try { got.push(JSON.parse(buf.toString())); } catch {} });
    ws2.on('close', (code) => { code2 = code; });
    ws2.send(JSON.stringify({
      event: 'create',
      data: { pt: linked.data.token, name: 'ROMAN', kind: 0, g: '0.6', v: '0.6rc', p: 'ios' },
    }));
    const tRoom = Date.now();
    while (Date.now() - tRoom < 3000 && !got.some((m) => m.event === 'room')) {
      await new Promise((r) => setTimeout(r, 30));
    }
    assert.ok(got.some((m) => m.event === 'room'), 'socket joined ' + JSON.stringify(got));
    const other = await api(PROFILE_PORT, 'POST', '/api/profile/guest');
    const second = await api(PROFILE_PORT, 'POST', '/api/auth/telegram', { initData: makeInitData(4242) }, other.data.token);
    assert.strictEqual(second.status, 201, JSON.stringify(second.data));
    const tKick = Date.now();
    while (Date.now() - tKick < 3000 && code2 !== 4001) {
      await new Promise((r) => setTimeout(r, 30));
    }
    assert.ok(got.some((m) => m.event === 'replaced'), 'replaced event ' + JSON.stringify(got.map((m) => m.event)));
    assert.strictEqual(code2, 4001, 'close 4001, log ' + game.buf.slice(-500));
    console.log('PASS cross-process account_kick');
  } catch (err) {
    console.error('game log', game.buf);
    console.error('profile log', profile.buf);
    throw err;
  } finally {
    stop();
  }
  console.log('ALL POSTGRES GUARD TESTS PASS');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
