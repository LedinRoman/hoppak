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
const root = path.join(__dirname, '..');

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
    env: { ...process.env, PORT: String(port), DATABASE_URL, TELEGRAM_BOT_TOKEN: BOT },
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
  assert.ok(!names.includes('telegram_id'), 'player_telegram.telegram_id is gone: ' + names.join(','));
  assert.ok(names.includes('username') && names.includes('player_id'));

  const game = startServer(8791);
  const profile = startServer(8792);
  const stop = () => { try { game.kill('SIGTERM'); } catch {} try { profile.kill('SIGTERM'); } catch {} };
  try {
    await waitHealth(8791);
    await waitHealth(8792);
    await new Promise((r) => setTimeout(r, 400));

    const g = await api(8792, 'POST', '/api/profile/guest');
    assert.strictEqual(g.status, 201, JSON.stringify(g.data));
    const tok = g.data.token;
    const id = g.data.profile.id;
    await sql(
      `UPDATE player_geo SET country = 'RU', origin_language = 'ru' WHERE player_id = $1`,
      [id],
    );
    await api(8792, 'GET', '/api/profile', undefined, tok);
    const geo = await sql(`SELECT country, origin_language, last_ip FROM player_geo WHERE player_id = $1`, [id]);
    assert.strictEqual(geo.rows[0].country, 'RU', 'private address keeps country');
    assert.strictEqual(geo.rows[0].origin_language, 'ru');

    await api(8792, 'POST', '/api/run/start', { runId: 'big-1', map: 'city', hero: 4 }, tok);
    await sql(`UPDATE run_start SET started_at = now() - interval '1 second' WHERE run_id = 'big-1'`);
    const t0 = Date.now();
    const fin = await api(8792, 'POST', '/api/run/finish', {
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

    const noId = await api(8792, 'POST', '/api/run/finish', {
      height: 500, runCoins: 100, bonusCoins: 0, map: 'city',
    }, tok);
    assert.strictEqual(noId.data.awarded, 0);
    const noIdRow = await sql(`SELECT reason FROM suspicious_runs WHERE player_id = $1 AND reason = 'NO_RUN_ID'`, [id]);
    assert.ok(noIdRow.rows.length >= 1);

    const noStart = await api(8792, 'POST', '/api/run/finish', {
      runId: 'ghost-pg', height: 300, runCoins: 10, bonusCoins: 0, map: 'city',
    }, tok);
    assert.strictEqual(noStart.data.awarded, 0);
    const ghost = await sql(`SELECT reason FROM suspicious_runs WHERE run_id = 'ghost-pg'`);
    assert.strictEqual(ghost.rows[0].reason, 'NO_RUN_START');
    const coins = await sql(`SELECT coins FROM player WHERE id = $1`, [id]);
    assert.strictEqual(Number(coins.rows[0].coins), 0, 'none of the rejected finishes paid');
    console.log('PASS postgres finish < ' + dt + 'ms, suspicious_runs, no start/id');

    const ws = await openWs(8791);
    const msgs = [];
    let closed = 0;
    ws.on('message', (buf) => { try { msgs.push(JSON.parse(buf.toString())); } catch {} });
    ws.on('close', (code) => { closed = code; });
    ws.send(JSON.stringify({ event: 'create', data: { pt: tok, name: 'ROMAN', kind: 0, g: '0.6', v: '0.6rc', p: 'ios' } }));
    const tSeen = Date.now();
    let online = [];
    while (Date.now() - tSeen < 3000) {
      const q = await sql(`SELECT client_version, platform, screen FROM online_now WHERE player_id = $1`, [id]);
      online = q.rows;
      if (online.length) break;
      await new Promise((r) => setTimeout(r, 50));
    }
    assert.strictEqual(online.length, 1, 'online row ' + JSON.stringify(online));
    assert.strictEqual(online[0].client_version, '0.6rc');
    assert.strictEqual(online[0].platform, 'ios');
    ws.send(JSON.stringify({ event: 'presence', data: { screen: 'lobby' } }));
    await new Promise((r) => setTimeout(r, 200));
    const kept = await sql(`SELECT client_version, platform FROM online_now WHERE player_id = $1`, [id]);
    assert.strictEqual(kept.rows[0].client_version, '0.6rc', 'empty presence keeps version');
    assert.strictEqual(kept.rows[0].platform, 'ios');
    ws.close();
    const tGone = Date.now();
    let left = 1;
    while (Date.now() - tGone < 3000) {
      const q = await sql(`SELECT 1 FROM online_now WHERE player_id = $1`, [id]);
      left = q.rows.length;
      if (!left) break;
      await new Promise((r) => setTimeout(r, 50));
    }
    assert.strictEqual(left, 0, 'disconnect deletes online_now');
    console.log('PASS online_now keeps version and drops on close');

    const linked = await api(8792, 'POST', '/api/auth/telegram', { initData: makeInitData(4242) }, tok);
    assert.strictEqual(linked.status, 201, JSON.stringify(linked.data));
    const ws2 = await openWs(8791);
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
    const other = await api(8792, 'POST', '/api/profile/guest');
    const second = await api(8792, 'POST', '/api/auth/telegram', { initData: makeInitData(4242) }, other.data.token);
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
