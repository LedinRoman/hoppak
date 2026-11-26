'use strict';
require('reflect-metadata');
const assert = require('assert');
const crypto = require('crypto');
const { NestFactory } = require('@nestjs/core');
const { WsAdapter } = require('@nestjs/platform-ws');
const { AppModule } = require('../dist/app.module');
const { ProfileController } = require('../dist/profile/profile.controller');
const { ProfileService } = require('../dist/profile/profile.service');
const { Player } = require('../dist/profile/player.entity');
const { PlayerRun } = require('../dist/profile/player-run.entity');
const { PlayerTelegram } = require('../dist/profile/player-telegram.entity');
const { PlayerGeo } = require('../dist/profile/player-geo.entity');
const { RunStart } = require('../dist/profile/run-start.entity');
const { SuspiciousRun } = require('../dist/profile/suspicious-run.entity');
const { plausBuckets, bucketFor } = require('../dist/profile/plausibility');
const { clientAddress } = require('../dist/profile/client-ip');
const { displayName } = require('../dist/profile/display-name');
const { ITEM_PRICES, RUN_COINS_MAX, RUN_BONUS_MAX, HEIGHT_AWARD_MIN } = require('../dist/profile/limits');
const { AddBestBuyRunId1795642000000 } = require('../dist/db/migrations/1795642000000-AddBestBuyRunId');
const { AddMergedInto1795643000000 } = require('../dist/db/migrations/1795643000000-AddMergedInto');
const { AddCampaign1795644000000 } = require('../dist/db/migrations/1795644000000-AddCampaign');
const { AddTelegramProfile1795645000000 } = require('../dist/db/migrations/1795645000000-AddTelegramProfile');
const { CommentProfileSchema1795646000000 } = require('../dist/db/migrations/1795646000000-CommentProfileSchema');
const { SplitTelegramGeoOnlinePlausibility1795647000000 } = require('../dist/db/migrations/1795647000000-SplitTelegramGeoOnlinePlausibility');
const { parseAndVerifyInitData, clipTelegramField } = require('../dist/profile/telegram');

function clone(v) {
  return v == null ? v : JSON.parse(JSON.stringify(v));
}

function makeMemoryRepos() {
  const players = new Map();
  const runs = new Map();
  let seq = 1;

  function hydratePlayer(row) {
    const p = Object.assign(new Player(), clone(row));
    p.migratedAt = row.migratedAt ? new Date(row.migratedAt) : null;
    p.createdAt = row.createdAt ? new Date(row.createdAt) : new Date();
    p.lastFinishAt = row.lastFinishAt ? new Date(row.lastFinishAt) : null;
    p.windowStartedAt = row.windowStartedAt ? new Date(row.windowStartedAt) : null;
    p.telegramLinkedAt = row.telegramLinkedAt ? new Date(row.telegramLinkedAt) : null;
    p.mergedAt = row.mergedAt ? new Date(row.mergedAt) : null;
    p.previousTokenAt = row.previousTokenAt ? new Date(row.previousTokenAt) : null;
    return p;
  }

  /** Per-id write locks so two overlapping auth calls behave like SELECT FOR UPDATE. */
  const lockTails = new Map();
  function withLock(id) {
    const prev = lockTails.get(id) || Promise.resolve();
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    const tail = prev.then(() => gate);
    lockTails.set(id, tail.then(() => {}, () => {}));
    return prev.then(() => release);
  }

  const playerRepo = {
    create(obj) {
      const p = Object.assign(new Player(), obj);
      if (!p.id) p.id = `00000000-0000-4000-8000-${String(seq++).padStart(12, '0')}`;
      p.assignId();
      if (!p.createdAt) p.createdAt = new Date();
      return p;
    },
    async save(p) {
      if (!p.id) p.id = `00000000-0000-4000-8000-${String(seq++).padStart(12, '0')}`;
      if (!p.createdAt) p.createdAt = new Date();
      players.set(p.id, hydratePlayer(p));
      return players.get(p.id);
    },
    async findOne({ where }) {
      for (const p of players.values()) {
        if (where.id && p.id === where.id) return hydratePlayer(p);
        if (where.guestTokenHash && p.guestTokenHash === where.guestTokenHash) return hydratePlayer(p);
        if (where.telegramId && String(p.telegramId) === String(where.telegramId)) return hydratePlayer(p);
        if (where.previousTokenHash && p.previousTokenHash === where.previousTokenHash) return hydratePlayer(p);
      }
      return null;
    },
  };

  const telegrams = new Map();
  const telegramRepo = {
    create(obj) { return Object.assign(new PlayerTelegram(), obj); },
    async findOne({ where }) { return telegrams.get(where.playerId) || null; },
    async save(row) { telegrams.set(row.playerId, Object.assign(new PlayerTelegram(), row)); return telegrams.get(row.playerId); },
  };
  const geos = new Map();
  const geoRepo = {
    create(obj) { return Object.assign(new PlayerGeo(), obj); },
    async findOne({ where }) { return geos.get(where.playerId) || null; },
    async save(row) { geos.set(row.playerId, Object.assign(new PlayerGeo(), row)); return geos.get(row.playerId); },
  };
  const starts = new Map();
  const startRepo = {
    create(obj) { return Object.assign(new RunStart(), obj); },
    async findOne({ where }) { return starts.get(`${where.playerId}:${where.runId}`) || null; },
    async save(row) {
      const rec = Object.assign(new RunStart(), row);
      starts.set(`${rec.playerId}:${rec.runId}`, rec);
      return rec;
    },
  };
  const suspicious = [];
  const suspiciousRepo = {
    create(obj) { return Object.assign(new SuspiciousRun(), obj); },
    async save(row) { const rec = Object.assign(new SuspiciousRun(), row); suspicious.push(rec); return rec; },
  };
  const rulesRepo = {
    async find() { return plausBuckets(); },
  };

  const runRepo = {
    create(obj) {
      return Object.assign(new PlayerRun(), obj, { createdAt: new Date() });
    },
    async findOne({ where }) {
      const key = `${where.playerId}:${where.runId}`;
      const r = runs.get(key);
      return r ? Object.assign(new PlayerRun(), r) : null;
    },
    async insert(rec) {
      const key = `${rec.playerId}:${rec.runId}`;
      if (runs.has(key)) {
        const err = new Error('duplicate key');
        err.code = '23505';
        throw err;
      }
      runs.set(key, Object.assign(new PlayerRun(), rec, { createdAt: rec.createdAt || new Date() }));
    },
  };

  playerRepo.manager = {
    async transaction(fn) {
      const held = [];
      const txPlayer = {
        create: playerRepo.create.bind(playerRepo),
        save: playerRepo.save.bind(playerRepo),
        manager: playerRepo.manager,
        async findOne(q) {
          let release = null;
          if (q && q.lock && q.where && q.where.id) {
            release = await withLock(q.where.id);
            held.push(release);
          }
          return playerRepo.findOne(q);
        },
      };
      try {
        return await fn({
          getRepository(ent) {
            if (ent === Player) return txPlayer;
            if (ent === PlayerRun) return runRepo;
            throw new Error('unexpected entity');
          },
        });
      } finally {
        while (held.length) held.pop()();
      }
    },
  };

  return { playerRepo, runRepo, players, runs, telegramRepo, geoRepo, startRepo, rulesRepo, suspiciousRepo, telegrams, geos, starts, suspicious };
}

async function req(base, method, path, body, token) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const r = await fetch(base + path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await r.json().catch(() => null);
  return { status: r.status, data };
}

async function testWithoutDb() {
  delete process.env.DATABASE_URL;
  delete process.env.TELEGRAM_BOT_TOKEN;
  const app = await NestFactory.create(AppModule, { logger: false });
  app.useWebSocketAdapter(new WsAdapter(app));
  await app.listen(0, '127.0.0.1');
  const port = app.getHttpServer().address().port;
  const base = `http://127.0.0.1:${port}`;
  try {
    const h = await req(base, 'GET', '/api/health');
    assert.strictEqual(h.status, 200);
    assert.strictEqual(h.data.ok, true);

    const g = await req(base, 'POST', '/api/profile/guest');
    assert.strictEqual(g.status, 503);
    assert.strictEqual(g.data.error, 'PROFILE_UNAVAILABLE');

    const b = await req(base, 'POST', '/api/profile/buy', { key: 'char:1' }, 'abc');
    assert.strictEqual(b.status, 503);
    assert.strictEqual(b.data.error, 'PROFILE_UNAVAILABLE');
  } finally {
    await app.close();
  }
  console.log('PASS no-DB 503 mode');
}

async function testProfileFlow() {
  const { Module } = require('@nestjs/common');
  const { playerRepo, runRepo, players, telegramRepo, geoRepo, startRepo, rulesRepo, suspiciousRepo } = makeMemoryRepos();

  class TestProfileModule {}
  Module({
    controllers: [ProfileController],
    providers: [
      {
        provide: ProfileService,
        useFactory: () => new ProfileService(playerRepo, runRepo, telegramRepo, geoRepo, startRepo, rulesRepo, suspiciousRepo),
      },
    ],
  })(TestProfileModule);

  const app = await NestFactory.create(TestProfileModule, { logger: false });
  await app.listen(0, '127.0.0.1');
  const port = app.getHttpServer().address().port;
  const base = `http://127.0.0.1:${port}`;

  try {
    // 1. Unauthorized GET
    const unauth = await req(base, 'GET', '/api/profile');
    assert.strictEqual(unauth.status, 401);
    assert.strictEqual(unauth.data.error, 'UNAUTHORIZED');

    // 2. Create guest
    const g1 = await req(base, 'POST', '/api/profile/guest');
    assert.strictEqual(g1.status, 201);
    assert.strictEqual(g1.data.ok, true);
    assert.match(g1.data.token, /^[0-9a-f]{64}$/);
    assert.strictEqual(g1.data.profile.coins, 0);
    assert.strictEqual(g1.data.profile.best, 0);
    const token = g1.data.token;

    // Same Bearer returns same guest
    const g2 = await req(base, 'POST', '/api/profile/guest', undefined, token);
    assert.strictEqual(g2.status, 201);
    assert.strictEqual(g2.data.profile.id, g1.data.profile.id);

    // 3. Migrate once with caps & best
    const m1 = await req(base, 'POST', '/api/profile/migrate', {
      coins: 200,
      best: 310,
      purchases: { 'char:1': 1, 'bad:key': 1 },
    }, token);
    assert.strictEqual(m1.status, 201);
    assert.strictEqual(m1.data.profile.coins, 200);
    assert.strictEqual(m1.data.profile.best, 310);
    assert.deepStrictEqual(m1.data.profile.purchases, { 'char:1': 1 });
    assert.ok(m1.data.profile.migratedAt);

    // Second migrate is idempotent
    const m2 = await req(base, 'POST', '/api/profile/migrate', {
      coins: 5000,
      best: 9999,
      purchases: { 'map:jungle': 1 },
    }, token);
    assert.strictEqual(m2.status, 201);
    assert.strictEqual(m2.data.profile.coins, 200);
    assert.strictEqual(m2.data.profile.best, 310);
    assert.deepStrictEqual(m2.data.profile.purchases, { 'char:1': 1 });

    // 4. Run finish updates coins + best, idempotent on runId even within 8s
    const r1 = await req(base, 'POST', '/api/run/finish', {
      runId: 'run-abc-1',
      height: 500,
      runCoins: 10,
      bonusCoins: 5,
    }, token);
    assert.strictEqual(r1.status, 201);
    assert.strictEqual(r1.data.awarded, 35); // floor(500/25)=20 + 10 + 5
    assert.strictEqual(r1.data.profile.coins, 235);
    assert.strictEqual(r1.data.profile.best, 500);

    // Immediate retry with same runId -> idempotent duplicate, NOT 429, NO double-credit
    const r1Dup = await req(base, 'POST', '/api/run/finish', {
      runId: 'run-abc-1',
      height: 500,
      runCoins: 10,
      bonusCoins: 5,
    }, token);
    assert.strictEqual(r1Dup.status, 201);
    assert.strictEqual(r1Dup.data.duplicate, true);
    assert.strictEqual(r1Dup.data.awarded, 35);
    assert.strictEqual(r1Dup.data.profile.coins, 235);

    // A second finish in the same second is credited. There is no 8s gap.
    const r2 = await req(base, 'POST', '/api/run/finish', {
      runId: 'run-abc-2',
      height: 250,
      runCoins: 5,
      bonusCoins: 0,
    }, token);
    assert.strictEqual(r2.status, 201);
    assert.strictEqual(r2.data.awarded, 15);
    assert.strictEqual(r2.data.profile.coins, 250);
    assert.strictEqual(r2.data.profile.best, 500);

    // 5. Buy validation & deduction
    const badKey = await req(base, 'POST', '/api/profile/buy', { key: 'char:99' }, token);
    assert.strictEqual(badKey.status, 400);
    assert.strictEqual(badKey.data.error, 'INVALID_ITEM');

    const tooExp = await req(base, 'POST', '/api/profile/buy', { key: 'char:5' }, token); // knight = 320 > 250
    assert.strictEqual(tooExp.status, 400);
    assert.strictEqual(tooExp.data.error, 'INSUFFICIENT_COINS');

    // Buy ninja (char:2 = 200) -> leaves 50 coins
    const buyNinja = await req(base, 'POST', '/api/profile/buy', { key: 'char:2' }, token);
    assert.strictEqual(buyNinja.status, 201);
    assert.strictEqual(buyNinja.data.profile.coins, 250 - ITEM_PRICES['char:2']);
    assert.strictEqual(buyNinja.data.profile.purchases['char:2'], 1);

    // Idempotent repeat buy -> alreadyOwned: true, no double charge
    const buyDup = await req(base, 'POST', '/api/profile/buy', { key: 'char:2' }, token);
    assert.strictEqual(buyDup.status, 201);
    assert.strictEqual(buyDup.data.alreadyOwned, true);
    assert.strictEqual(buyDup.data.profile.coins, 50);

    // GET /api/profile reflects persisted best, coins, purchases
    const got = await req(base, 'GET', '/api/profile', undefined, token);
    assert.strictEqual(got.status, 200);
    assert.strictEqual(got.data.profile.coins, 50);
    assert.strictEqual(got.data.profile.best, 500);
    assert.strictEqual(got.data.profile.purchases['char:2'], 1);

    // Telegram endpoint still returns 503 when TELEGRAM_BOT_TOKEN unset
    const tg = await req(base, 'POST', '/api/auth/telegram', { initData: 'x' }, token);
    assert.strictEqual(tg.status, 503);
    assert.strictEqual(tg.data.error, 'TELEGRAM_AUTH_UNAVAILABLE');
  } finally {
    await app.close();
  }
  console.log('PASS profile flow (guest, migrate, run/finish + best + runId, buy)');
}

/** Fake bot token for unit tests only — not a real Telegram secret. */
const TEST_BOT_TOKEN = 'hoppak-unit-test-bot-token';

function makeInitData(botToken, userId, extra = {}) {
  const user = JSON.stringify({ id: userId, first_name: 'T', ...extra });
  const auth_date = String(Math.floor(Date.now() / 1000));
  const fields = { auth_date, query_id: 'AA', user };
  const dataCheckString = Object.keys(fields).sort().map((k) => `${k}=${fields[k]}`).join('\n');
  const secret = crypto.createHmac('sha256', 'WebAppData').update(botToken, 'utf8').digest();
  const hash = crypto.createHmac('sha256', secret).update(dataCheckString, 'utf8').digest('hex');
  return new URLSearchParams({ ...fields, hash }).toString();
}

async function startTestApp() {
  const { Module } = require('@nestjs/common');
  const bag = makeMemoryRepos();
  const { playerRepo, runRepo, players, telegramRepo, geoRepo, startRepo, rulesRepo, suspiciousRepo } = bag;
  class TestProfileModule {}
  Module({
    controllers: [ProfileController],
    providers: [{ provide: ProfileService, useFactory: () => new ProfileService(playerRepo, runRepo, telegramRepo, geoRepo, startRepo, rulesRepo, suspiciousRepo) }],
  })(TestProfileModule);
  const app = await NestFactory.create(TestProfileModule, { logger: false });
  await app.listen(0, '127.0.0.1');
  const port = app.getHttpServer().address().port;
  return { app, base: `http://127.0.0.1:${port}`, playerRepo, players, ...bag };
}

async function testTelegramMerge() {
  process.env.TELEGRAM_BOT_TOKEN = TEST_BOT_TOKEN;
  const { app, base, players } = await startTestApp();
  const init = (uid) => makeInitData(TEST_BOT_TOKEN, uid);
  try {
    const pGuest = await req(base, 'POST', '/api/profile/guest');
    const pTok0 = pGuest.data.token;
    const pId = pGuest.data.profile.id;
    await req(base, 'POST', '/api/profile/migrate', {
      coins: 7000, best: 200, purchases: { 'char:1': 1, 'hero:frog': 1 },
    }, pTok0);
    const linked = await req(base, 'POST', '/api/auth/telegram', { initData: init(4242) }, pTok0);
    assert.strictEqual(linked.status, 201, 'link P: ' + JSON.stringify(linked.data));
    assert.strictEqual(linked.data.linked, true);
    assert.strictEqual(linked.data.profile.telegramId, '4242');
    assert.strictEqual(linked.data.token, pTok0);

    const gGuest = await req(base, 'POST', '/api/profile/guest');
    const gTok = gGuest.data.token;
    const gId = gGuest.data.profile.id;
    await req(base, 'POST', '/api/profile/migrate', {
      coins: 2000, best: 900, purchases: { 'map:jungle': 1, 'skin:gold': 1 },
    }, gTok);
    const gBefore = players.get(gId);
    assert.ok(!gBefore.purchases['map:jungle'], 'local map open is not a purchase');
    gBefore.purchases = Object.assign({}, gBefore.purchases, { 'map:jungle': 1 });

    const merged = await req(base, 'POST', '/api/auth/telegram', { initData: init(4242) }, gTok);
    assert.strictEqual(merged.status, 201, 'merge: ' + JSON.stringify(merged.data));
    assert.strictEqual(merged.data.merged, true);
    assert.strictEqual(merged.data.linked, false);
    // Guest server wallet transfers once, capped. 7000 + 2000.
    assert.strictEqual(merged.data.mergedCoins, 2000);
    assert.strictEqual(merged.data.profile.coins, 9000);
    assert.strictEqual(merged.data.profile.best, 900);
    assert.strictEqual(merged.data.profile.id, pId);
    assert.strictEqual(merged.data.profile.purchases['char:1'], 1);
    assert.strictEqual(merged.data.profile.purchases['hero:frog'], 1);
    assert.strictEqual(merged.data.profile.purchases['map:jungle'], 1);
    assert.ok(!merged.data.profile.purchases['skin:gold']);
    const pTok2 = merged.data.token;
    assert.ok(pTok2 && pTok2 !== gTok);

    const dead = await req(base, 'GET', '/api/profile', undefined, gTok);
    assert.strictEqual(dead.status, 401);
    assert.strictEqual(dead.data.error, 'UNAUTHORIZED');
    const deadBuy = await req(base, 'POST', '/api/profile/buy', { key: 'char:0' }, gTok);
    assert.strictEqual(deadBuy.status, 401);

    const live = await req(base, 'GET', '/api/profile', undefined, pTok2);
    assert.strictEqual(live.status, 200);
    assert.strictEqual(live.data.profile.coins, 9000);
    assert.strictEqual(live.data.profile.id, pId);

    const gRow = players.get(gId);
    assert.ok(gRow);
    assert.strictEqual(gRow.mergedInto, pId);
    assert.ok(gRow.mergedAt);
    assert.strictEqual(gRow.coins, 0);

    const again = await req(base, 'POST', '/api/auth/telegram', { initData: init(4242) }, gTok);
    assert.strictEqual(again.status, 201);
    assert.ok(again.data.merged !== true);
    const againLive = await req(base, 'GET', '/api/profile', undefined, again.data.token);
    assert.strictEqual(againLive.data.profile.coins, 9000);
    assert.strictEqual(againLive.data.profile.best, 900);
    assert.strictEqual(againLive.data.profile.id, pId);

    // Guest part capped at 8000. Telegram coins above that stay.
    const p2g = await req(base, 'POST', '/api/profile/guest');
    await req(base, 'POST', '/api/profile/migrate', { coins: 100, best: 10, purchases: {} }, p2g.data.token);
    const p2link = await req(base, 'POST', '/api/auth/telegram', { initData: init(777) }, p2g.data.token);
    assert.strictEqual(p2link.data.linked, true);
    const rich = players.get(p2link.data.profile.id);
    rich.coins = 10000;
    await req(base, 'GET', '/api/profile', undefined, p2link.data.token);
    const g2 = await req(base, 'POST', '/api/profile/guest');
    await req(base, 'POST', '/api/profile/migrate', { coins: 8000, best: 5, purchases: { 'char:2': 1 } }, g2.data.token);
    const g2row = players.get(g2.data.profile.id);
    g2row.coins = 9000;
    const mCap = await req(base, 'POST', '/api/auth/telegram', { initData: init(777) }, g2.data.token);
    assert.strictEqual(mCap.status, 201);
    assert.strictEqual(mCap.data.merged, true);
    assert.strictEqual(mCap.data.mergedCoins, 8000);
    assert.strictEqual(mCap.data.profile.coins, 18000);
    assert.strictEqual(mCap.data.profile.best, 10);
    assert.strictEqual(mCap.data.profile.purchases['char:2'], 1);

    const linkedGuest = await req(base, 'POST', '/api/profile/guest');
    const lgLink = await req(base, 'POST', '/api/auth/telegram', { initData: init(888) }, linkedGuest.data.token);
    assert.strictEqual(lgLink.data.linked, true);
    const conflict = await req(base, 'POST', '/api/auth/telegram', { initData: init(4242) }, lgLink.data.token);
    assert.strictEqual(conflict.status, 409);
    assert.strictEqual(conflict.data.error, 'GUEST_ALREADY_LINKED');

    const p3g = await req(base, 'POST', '/api/profile/guest');
    await req(base, 'POST', '/api/profile/migrate', { coins: 100, best: 1, purchases: {} }, p3g.data.token);
    await req(base, 'POST', '/api/auth/telegram', { initData: init(999) }, p3g.data.token);
    const g3 = await req(base, 'POST', '/api/profile/guest');
    await req(base, 'POST', '/api/profile/migrate', { coins: 400, best: 50, purchases: { 'map:ice': 1 } }, g3.data.token);
    const g3Row = players.get(g3.data.profile.id);
    assert.ok(!g3Row.purchases['map:ice'], 'migrate does not accept a local map open');
    g3Row.purchases = Object.assign({}, g3Row.purchases, { 'map:ice': 1 });
    const g3Tok = g3.data.token;
    const [rA, rB] = await Promise.all([
      req(base, 'POST', '/api/auth/telegram', { initData: init(999) }, g3Tok),
      req(base, 'POST', '/api/auth/telegram', { initData: init(999) }, g3Tok),
    ]);
    assert.strictEqual(rA.status, 201);
    assert.strictEqual(rB.status, 201);
    const mergedFlags = [rA.data.merged === true, rB.data.merged === true].filter(Boolean);
    assert.ok(mergedFlags.length <= 1, 'at most one request should report merged');
    const tokA = rA.data.token;
    const tokB = rB.data.token;
    const liveA = await req(base, 'GET', '/api/profile', undefined, tokA);
    const liveB = await req(base, 'GET', '/api/profile', undefined, tokB);
    const lives = [liveA, liveB].filter((g) => g.status === 200).map((g) => g.data.profile);
    // The later auth rotates the Telegram token, so one Bearer may already be 401.
    assert.ok(lives.length >= 1, 'a returned token must still open the merged profile');
    for (const p of lives) {
      assert.strictEqual(p.coins, 500);
      assert.strictEqual(p.purchases['map:ice'], 1);
    }
    const dead3 = await req(base, 'GET', '/api/profile', undefined, g3Tok);
    assert.strictEqual(dead3.status, 401);

    const liveTok = liveA.status === 200 ? tokA : tokB;
    const poorRow = players.get(lives[0].id);
    poorRow.coins = 10;
    // 400 must not charge. The client rolls the optimistic purchase back.
    const poor = await req(base, 'POST', '/api/profile/buy', { key: 'char:5' }, liveTok);
    assert.strictEqual(poor.status, 400);
    assert.strictEqual(poor.data.error, 'INSUFFICIENT_COINS');
    const afterPoor = await req(base, 'GET', '/api/profile', undefined, liveTok);
    assert.strictEqual(afterPoor.data.profile.coins, 10);
  } finally {
    delete process.env.TELEGRAM_BOT_TOKEN;
    await app.close();
  }
  console.log('PASS telegram merge (guest cap, union, max best, repeat, race, 400 buy)');
}

async function testAwardSeries() {
  const { app, base } = await startTestApp();
  process.env.TELEGRAM_BOT_TOKEN = TEST_BOT_TOKEN;
  try {
    assert.strictEqual(HEIGHT_AWARD_MIN, 100);
    assert.strictEqual(RUN_COINS_MAX, 15801);
    assert.strictEqual(RUN_BONUS_MAX, 2500);
    async function prove(label, token) {
      let coins = 100;
      for (let i = 0; i < 10; i++) {
        const r = await req(base, 'POST', '/api/run/finish', {
          runId: label + '-s' + i, height: 2500, runCoins: 0, bonusCoins: 0,
        }, token);
        assert.strictEqual(r.status, 201, label + ' ' + i + ' ' + JSON.stringify(r.data));
        assert.strictEqual(r.data.awarded, 100);
        assert.ok(!r.data.limited);
        coins += 100;
        assert.strictEqual(r.data.profile.coins, coins);
      }
      const long = await req(base, 'POST', '/api/run/finish', {
        runId: label + '-long', height: 7500, runCoins: 0, bonusCoins: 0,
      }, token);
      assert.strictEqual(long.data.awarded, 300);
      coins += 300;
      assert.strictEqual(long.data.profile.coins, coins);
      const low = await req(base, 'POST', '/api/run/finish', {
        runId: label + '-99', height: 99, runCoins: 5, bonusCoins: 0,
      }, token);
      assert.strictEqual(low.data.awarded, 5);
      assert.strictEqual(low.data.limited, 'HEIGHT_MIN');
      coins += 5;
      const edge = await req(base, 'POST', '/api/run/finish', {
        runId: label + '-100', height: 100, runCoins: 0, bonusCoins: 0,
      }, token);
      assert.strictEqual(edge.data.awarded, 4);
      assert.ok(!edge.data.limited);
      coins += 4;
      assert.strictEqual(edge.data.profile.coins, coins);
      const cut = await req(base, 'POST', '/api/run/finish', {
        runId: label + '-cut', height: 100, runCoins: RUN_COINS_MAX + 50, bonusCoins: 0,
      }, token);
      assert.strictEqual(cut.data.limited, 'COINS_CAP');
      assert.strictEqual(cut.data.awarded, 4 + RUN_COINS_MAX);
      const dup = await req(base, 'POST', '/api/run/finish', {
        runId: label + '-long', height: 7500, runCoins: 0, bonusCoins: 0,
      }, token);
      assert.strictEqual(dup.data.duplicate, true);
      assert.strictEqual(dup.data.limited, 'DUPLICATE');
      assert.strictEqual(dup.data.profile.coins, cut.data.profile.coins);
    }
    const g = await req(base, 'POST', '/api/profile/guest');
    await req(base, 'POST', '/api/profile/migrate', { coins: 100, best: 0, purchases: {} }, g.data.token);
    await prove('guest', g.data.token);
    const g2 = await req(base, 'POST', '/api/profile/guest');
    await req(base, 'POST', '/api/profile/migrate', { coins: 100, best: 0, purchases: {} }, g2.data.token);
    const linked = await req(base, 'POST', '/api/auth/telegram', {
      initData: makeInitData(TEST_BOT_TOKEN, 5150),
    }, g2.data.token);
    assert.strictEqual(String(linked.data.profile.telegramId), '5150');
    assert.strictEqual(linked.data.profile.coins, 100);
    await prove('tg', linked.data.token);
  } finally {
    delete process.env.TELEGRAM_BOT_TOKEN;
    await app.close();
  }
  console.log('PASS award series, no hour/run/interval caps, guest and telegram');
}

async function testMigrationSql() {
  const m = new AddBestBuyRunId1795642000000();
  const upSql = [];
  const downSql = [];
  await m.up({ query: async (q) => upSql.push(q) });
  await m.down({ query: async (q) => downSql.push(q) });
  assert.ok(upSql.some(q => /ADD COLUMN "best"/i.test(q)));
  assert.ok(upSql.some(q => /CREATE TABLE "player_run"/i.test(q)));
  assert.ok(downSql.some(q => /DROP TABLE "player_run"/i.test(q)));
  assert.ok(downSql.some(q => /DROP COLUMN "best"/i.test(q)));

  const m2 = new AddMergedInto1795643000000();
  const up2 = [];
  const down2 = [];
  await m2.up({ query: async (q) => up2.push(q) });
  await m2.down({ query: async (q) => down2.push(q) });
  assert.ok(up2.some(q => /ADD COLUMN "merged_into"/i.test(q)));
  assert.ok(up2.some(q => /ADD COLUMN "merged_at"/i.test(q)));
  assert.ok(up2.some(q => /FK_player_merged_into/i.test(q)));
  assert.ok(down2.some(q => /DROP CONSTRAINT "FK_player_merged_into"/i.test(q)));
  assert.ok(down2.some(q => /DROP COLUMN "merged_into"/i.test(q)));
  console.log('PASS additive migration SQL');

  const m3 = new AddCampaign1795644000000();
  const up3 = [];
  const down3 = [];
  await m3.up({ query: async (q) => up3.push(q) });
  await m3.down({ query: async (q) => down3.push(q) });
  assert.ok(up3.some(q => /ADD COLUMN "campaign" jsonb/i.test(q)));
  assert.ok(down3.some(q => /DROP COLUMN "campaign"/i.test(q)));
  console.log('PASS campaign migration SQL');

  const m4 = new AddTelegramProfile1795645000000();
  const up4 = [];
  const down4 = [];
  await m4.up({ query: async (q) => up4.push(q) });
  await m4.down({ query: async (q) => down4.push(q) });
  for (const col of [
    'telegram_username',
    'telegram_first_name',
    'telegram_last_name',
    'telegram_language',
    'telegram_is_premium',
    'telegram_profile_updated_at',
  ]) {
    assert.ok(up4.some((q) => new RegExp('ADD COLUMN IF NOT EXISTS "' + col + '"', 'i').test(q)), 'up ' + col);
    assert.ok(down4.some((q) => new RegExp('DROP COLUMN IF EXISTS "' + col + '"', 'i').test(q)), 'down ' + col);
  }
  assert.ok(up4.every((q) => /ADD COLUMN/i.test(q) && !/DROP COLUMN|ALTER COLUMN|UPDATE /i.test(q)));
  console.log('PASS telegram profile migration SQL');

  const m5 = new CommentProfileSchema1795646000000();
  const up5 = [];
  const down5 = [];
  await m5.up({ query: async (q) => up5.push(q) });
  await m5.down({ query: async (q) => down5.push(q) });
  const tables = ['migrations', 'player', 'player_run'];
  const cols = {
    migrations: ['id', 'timestamp', 'name'],
    player: [
      'id', 'guest_token_hash', 'coins', 'best', 'purchases', 'campaign',
      'migrated_at', 'created_at', 'last_finish_at', 'window_started_at', 'awarded_in_window',
      'telegram_id', 'telegram_linked_at', 'merged_into', 'merged_at',
      'telegram_username', 'telegram_first_name', 'telegram_last_name',
      'telegram_language', 'telegram_is_premium', 'telegram_profile_updated_at',
    ],
    player_run: ['player_id', 'run_id', 'awarded', 'created_at'],
  };
  for (const table of tables) {
    assert.ok(up5.some((q) => new RegExp('COMMENT ON TABLE "' + table + '" IS ').test(q)), 'table ' + table);
    for (const col of cols[table]) {
      assert.ok(up5.some((q) => new RegExp('COMMENT ON COLUMN "' + table + '"."' + col + '" IS ').test(q)), 'col ' + table + '.' + col);
    }
  }
  assert.strictEqual(up5.filter((q) => /COMMENT ON TABLE /.test(q)).length, 3);
  assert.strictEqual(up5.filter((q) => /COMMENT ON COLUMN /.test(q)).length, 28);
  assert.ok(up5.every((q) => /^COMMENT ON (TABLE|COLUMN) /.test(q)));
  assert.ok(!up5.some((q) => /^(ALTER TABLE|ADD COLUMN|DROP COLUMN|UPDATE |DELETE |INSERT )/i.test(q)));
  assert.ok(down5.every((q) => /COMMENT ON (TABLE|COLUMN) .+ IS NULL/.test(q)));
  console.log('PASS profile schema comments migration SQL');

  const m6 = new SplitTelegramGeoOnlinePlausibility1795647000000();
  const up6 = [];
  const down6 = [];
  await m6.up({ query: async (q) => up6.push(q) });
  await m6.down({ query: async (q) => down6.push(q) });
  assert.ok(up6.some((q) => /INSERT INTO "player_telegram"/i.test(q)));
  assert.ok(up6.some((q) => /DROP COLUMN IF EXISTS "telegram_username"/i.test(q)));
  assert.ok(up6.some((q) => /INSERT INTO "rules_plausibility"/i.test(q)));
  assert.ok(up6.some((q) => /CREATE TABLE IF NOT EXISTS "suspicious_runs"/i.test(q)));
  assert.ok(up6.some((q) => /CREATE TABLE IF NOT EXISTS "online_now"/i.test(q)));
  assert.ok(up6.some((q) => /CREATE TABLE IF NOT EXISTS "player_geo"/i.test(q)));
  const newCols = [
    ['player', 'previous_token_hash'], ['player', 'previous_token_at'],
    ['player_telegram', 'player_id'], ['player_telegram', 'telegram_id'], ['player_telegram', 'username'],
    ['player_telegram', 'first_name'], ['player_telegram', 'last_name'], ['player_telegram', 'language'],
    ['player_telegram', 'is_premium'], ['player_telegram', 'updated_at'],
    ['player_geo', 'player_id'], ['player_geo', 'last_ip'], ['player_geo', 'country'],
    ['player_geo', 'origin_language'], ['player_geo', 'first_seen'], ['player_geo', 'last_seen'],
    ['online_now', 'player_id'], ['online_now', 'room'], ['online_now', 'screen'],
    ['online_now', 'client_version'], ['online_now', 'platform'], ['online_now', 'last_seen'],
    ['online_snapshots', 'id'], ['online_snapshots', 'ts'], ['online_snapshots', 'count'],
    ['run_start', 'player_id'], ['run_start', 'run_id'], ['run_start', 'map'], ['run_start', 'hero'], ['run_start', 'started_at'],
    ['rules_plausibility', 'map'], ['rules_plausibility', 't_seconds'], ['rules_plausibility', 'max_coins'],
    ['rules_plausibility', 'max_height_m'], ['rules_plausibility', 'max_treasures'], ['rules_plausibility', 'margin'],
    ['rules_plausibility', 'version'], ['rules_plausibility', 'updated_at'],
    ['suspicious_runs', 'id'], ['suspicious_runs', 'player_id'], ['suspicious_runs', 'run_id'],
    ['suspicious_runs', 'map'], ['suspicious_runs', 'hero'], ['suspicious_runs', 'duration_s'],
    ['suspicious_runs', 'claimed_coins'], ['suspicious_runs', 'claimed_height'], ['suspicious_runs', 'claimed_treasures'],
    ['suspicious_runs', 'max_coins'], ['suspicious_runs', 'max_height'], ['suspicious_runs', 'max_treasures'],
    ['suspicious_runs', 'reason'], ['suspicious_runs', 'client_version'], ['suspicious_runs', 'created_at'],
  ];
  for (const [table, col] of newCols) {
    assert.ok(up6.some((q) => q.indexOf('COMMENT ON COLUMN "' + table + '"."' + col + '"') >= 0), table + '.' + col);
  }
  for (const table of ['player_telegram', 'player_geo', 'online_now', 'online_snapshots', 'run_start', 'rules_plausibility', 'suspicious_runs']) {
    assert.ok(up6.some((q) => q.indexOf('COMMENT ON TABLE "' + table + '"') >= 0), table);
  }
  assert.ok(down6.some((q) => /UPDATE "player" p SET/i.test(q)));
  assert.ok(down6.some((q) => /DROP TABLE IF EXISTS "player_telegram"/i.test(q)));
  const seed = up6.find((q) => /INSERT INTO "rules_plausibility"/i.test(q));
  for (const b of plausBuckets()) {
    assert.ok(seed.indexOf("'" + b.map + "', " + b.tSeconds + ", " + b.maxCoins + ", " + b.maxHeightM + ", " + b.maxTreasures) >= 0, b.map + ' ' + b.tSeconds);
  }
  console.log('PASS telegram split, geo, online, plausibility migration SQL');
}

async function testPlausibilityAndSession() {
  process.env.TELEGRAM_BOT_TOKEN = TEST_BOT_TOKEN;
  assert.strictEqual(clientAddress('1.2.3.4, 5.6.7.8', '127.0.0.1'), '5.6.7.8');
  assert.strictEqual(clientAddress('', '::ffff:10.0.0.9'), '10.0.0.9');
  assert.strictEqual(displayName('Roman', 'other', 'abcd1234'), 'ROMAN');
  assert.strictEqual(displayName('😀', 'okname', 'abcd1234'), 'OKNAME');
  assert.strictEqual(displayName('😀', '🔥', 'abcd1234-ffff'), 'hopp-abcd');
  const rule = bucketFor(plausBuckets(), 'city', 1);
  assert.strictEqual(rule.tSeconds, 30);

  const { app, base, players, starts, suspicious } = await startTestApp();
  try {
    const g = await req(base, 'POST', '/api/profile/guest', undefined, undefined);
    const tok = g.data.token;
    const id = g.data.profile.id;
    const geo = await req(base, 'GET', '/api/profile', undefined, tok);
    assert.strictEqual(geo.status, 200);

    const run = 'honest-1';
    const started = await req(base, 'POST', '/api/run/start', { runId: run, map: 'city', hero: 4 }, tok);
    assert.strictEqual(started.status, 201, JSON.stringify(started.data));
    const row = starts.get(id + ':' + run);
    row.startedAt = new Date(Date.now() - 1000);
    const coinsBefore = g.data.profile.coins;
    const ok = await req(base, 'POST', '/api/run/finish', {
      runId: run, map: 'city', hero: 4, ver: '0.6rc', height: 40, runCoins: 10, bonusCoins: 25,
    }, tok);
    assert.strictEqual(ok.data.ok, true, JSON.stringify(ok.data));
    assert.ok(ok.data.awarded > 0, 'honest run is awarded');
    assert.ok(!ok.data.maxCoins && !ok.data.maxHeight && !ok.data.maxTreasures, 'response hides the ceilings');
    assert.strictEqual(suspicious.length, 0);

    async function reject(field) {
      const rid = 'bad-' + field;
      await req(base, 'POST', '/api/run/start', { runId: rid, map: 'lava', hero: 4 }, tok);
      starts.get(id + ':' + rid).startedAt = new Date(Date.now() - 1000);
      const cap = bucketFor(plausBuckets(), 'lava', 1);
      const body = { runId: rid, map: 'lava', hero: 4, ver: '0.6rc', height: 10, runCoins: 1, bonusCoins: 0 };
      if (field === 'height') body.height = cap.maxHeightM + 1;
      if (field === 'coins') body.runCoins = cap.maxCoins + 1;
      if (field === 'treasures') body.bonusCoins = (cap.maxTreasures + 1) * 25;
      const before = (await req(base, 'GET', '/api/profile', undefined, tok)).data.profile.coins;
      const res = await req(base, 'POST', '/api/run/finish', body, tok);
      assert.strictEqual(res.data.awarded, 0, field);
      assert.strictEqual(res.data.limited, 'REJECTED', field);
      assert.ok(!res.data.reason && !res.data.maxCoins, field);
      const hit = suspicious.filter((s) => s.runId === rid);
      assert.strictEqual(hit.length, 1, field);
      assert.ok(hit[0].reason.indexOf(field) >= 0, hit[0].reason);
      const after = (await req(base, 'GET', '/api/profile', undefined, tok)).data.profile.coins;
      assert.strictEqual(after, before, field + ' does not pay');
      const again = await req(base, 'POST', '/api/run/finish', body, tok);
      assert.strictEqual(again.data.duplicate, true, field);
      assert.strictEqual(again.data.awarded, 0, field);
      assert.strictEqual(suspicious.filter((s) => s.runId === rid).length, 1, 'one suspicious row');
    }
    await reject('height');
    await reject('coins');
    await reject('treasures');
    assert.ok((await req(base, 'GET', '/api/profile', undefined, tok)).data.profile.coins > coinsBefore);

    const init = (uid) => makeInitData(TEST_BOT_TOKEN, 9001);
    const linked = await req(base, 'POST', '/api/auth/telegram', { initData: init() }, tok);
    assert.strictEqual(linked.status, 201, JSON.stringify(linked.data));
    const kept = 'still-counts';
    const startedKept = await req(base, 'POST', '/api/run/start', { runId: kept, map: 'city', hero: 0 }, tok);
    assert.strictEqual(startedKept.status, 201, JSON.stringify(startedKept.data));
    const other = await req(base, 'POST', '/api/profile/guest');
    const second = await req(base, 'POST', '/api/auth/telegram', { initData: init() }, other.data.token);
    assert.strictEqual(second.status, 201);
    const oldGet = await req(base, 'GET', '/api/profile', undefined, tok);
    assert.strictEqual(oldGet.status, 401);
    assert.strictEqual(oldGet.data.error, 'SESSION_REPLACED');
    const paid = await req(base, 'POST', '/api/run/finish', {
      runId: kept, map: 'city', hero: 0, height: 120, runCoins: 2, bonusCoins: 0,
    }, tok);
    assert.ok(paid.data.awarded > 0, JSON.stringify(paid.data));
    const dup = await req(base, 'POST', '/api/run/finish', {
      runId: kept, map: 'city', hero: 0, height: 120, runCoins: 2, bonusCoins: 0,
    }, second.data.token);
    assert.strictEqual(dup.data.duplicate, true);
    assert.strictEqual(dup.data.awarded, paid.data.awarded);
    assert.ok(players.get(second.data.profile.id));
  } finally {
    delete process.env.TELEGRAM_BOT_TOKEN;
    await app.close();
  }
  console.log('PASS plausibility and last-login session');
}

async function testTwoDevices() {
  process.env.TELEGRAM_BOT_TOKEN = TEST_BOT_TOKEN;
  const { app, base, players } = await startTestApp();
  const init = (uid) => makeInitData(TEST_BOT_TOKEN, uid);
  try {
    const pc = await req(base, 'POST', '/api/profile/guest');
    const pcTok = pc.data.token;
    await req(base, 'POST', '/api/profile/migrate', { coins: 1415, best: 207, purchases: {} }, pcTok);
    const upPc = await req(base, 'POST', '/api/profile/campaign', {
      mapBest: { city: 207, space: 0, lava: 999999 },
      open: { 'map:jungle': 1, 'map:nope': 1 },
    }, pcTok);
    assert.strictEqual(upPc.status, 201, JSON.stringify(upPc.data));
    assert.strictEqual(upPc.data.profile.coins, 1415);
    assert.strictEqual(upPc.data.profile.campaign.best.city, 207);
    assert.strictEqual(upPc.data.profile.campaign.best.lava, 20000);
    assert.ok(!upPc.data.profile.campaign.best.space);
    assert.ok(!upPc.data.profile.purchases['map:jungle'], 'campaign must not open maps');
    assert.ok(!upPc.data.profile.purchases['map:nope']);
    players.get(pc.data.profile.id).purchases = { 'map:jungle': 1 };
    const linked = await req(base, 'POST', '/api/auth/telegram', { initData: init(4242) }, pcTok);
    assert.strictEqual(linked.data.profile.coins, 1415);

    const phone = await req(base, 'POST', '/api/profile/guest');
    const phTok = phone.data.token;
    // 99999 is only a localStorage cache. It is not posted, so it cannot become a guest wallet.
    const upPh = await req(base, 'POST', '/api/profile/campaign', {
      mapBest: { aqua: 40, city: 10, space: 900 },
      open: { 'map:aqua': 1 },
    }, phTok);
    assert.strictEqual(upPh.data.profile.coins, 0);
    const merged = await req(base, 'POST', '/api/auth/telegram', { initData: init(4242) }, phTok);
    assert.strictEqual(merged.data.merged, true);
    assert.strictEqual(merged.data.mergedCoins, 0);
    const prof = merged.data.profile;
    assert.strictEqual(prof.coins, 1415);
    assert.strictEqual(prof.campaign.best.city, 207);
    assert.strictEqual(prof.campaign.best.aqua, 40);
    assert.strictEqual(prof.campaign.best.space, 900);
    assert.strictEqual(prof.purchases['map:jungle'], 1);
    assert.ok(!prof.purchases['map:aqua'], 'a local open does not travel with the merge');
    assert.strictEqual(prof.best, 20000);

    const richGuest = await req(base, 'POST', '/api/profile/guest');
    await req(base, 'POST', '/api/profile/migrate', { coins: 200, best: 1, purchases: {} }, richGuest.data.token);
    const moved = await req(base, 'POST', '/api/auth/telegram', { initData: init(4242) }, richGuest.data.token);
    assert.strictEqual(moved.data.merged, true);
    assert.strictEqual(moved.data.mergedCoins, 200);
    assert.strictEqual(moved.data.profile.coins, 1615);
    const closed = players.get(richGuest.data.profile.id);
    assert.strictEqual(closed.coins, 0);
    assert.strictEqual(closed.mergedInto, prof.id);
    const repeat = await req(base, 'POST', '/api/auth/telegram', { initData: init(4242) }, richGuest.data.token);
    assert.ok(repeat.data.merged !== true);
    const repeatLive = await req(base, 'GET', '/api/profile', undefined, repeat.data.token);
    assert.strictEqual(repeatLive.data.profile.coins, 1615);

    const fin = await req(base, 'POST', '/api/run/finish', {
      height: 400, runCoins: 0, bonusCoins: 0, runId: 'map-lava-1', map: 'lava',
    }, repeat.data.token);
    assert.strictEqual(fin.data.profile.campaign.best.lava, 20000);
    const coinsAfter = fin.data.profile.coins;
    const again = await req(base, 'POST', '/api/run/finish', {
      height: 18000, runCoins: 0, bonusCoins: 0, runId: 'map-lava-1', map: 'lava',
    }, repeat.data.token);
    assert.strictEqual(again.data.duplicate, true);
    assert.strictEqual(again.data.profile.coins, coinsAfter);
    assert.strictEqual(again.data.profile.campaign.best.lava, 20000);

    const live = await req(base, 'POST', '/api/run/finish', {
      height: 250, runCoins: 0, bonusCoins: 0, runId: 'map-city-2', map: 'city',
    }, repeat.data.token);
    assert.strictEqual(live.data.profile.campaign.best.city, 250);
    assert.strictEqual(live.data.profile.campaign.best.space, 900);
  } finally {
    delete process.env.TELEGRAM_BOT_TOKEN;
    await app.close();
  }
  console.log('PASS two devices (max map records, server coins, no free opens)');
}

async function testMapPurchase() {
  const { app, base, players } = await startTestApp();
  try {
    const g = await req(base, 'POST', '/api/profile/guest');
    const tok = g.data.token;
    const id = g.data.profile.id;
    await req(base, 'POST', '/api/profile/migrate', { coins: 100, best: 0, purchases: { 'map:space': 1, 'char:1': 1 } }, tok);
    const seeded = await req(base, 'GET', '/api/profile', undefined, tok);
    assert.strictEqual(seeded.data.profile.purchases['char:1'], 1);
    assert.ok(!seeded.data.profile.purchases['map:space'], 'migrate dropped the local map open');
    assert.strictEqual(seeded.data.profile.coins, 100);

    players.get(id).purchases = Object.assign({}, players.get(id).purchases, { 'map:lava': 1 });
    const kept = await req(base, 'POST', '/api/profile/campaign', {
      mapBest: { city: 100 },
      open: { 'map:jungle': 1, 'map:space': 1 },
    }, tok);
    assert.strictEqual(kept.status, 201, JSON.stringify(kept.data));
    assert.strictEqual(kept.data.profile.campaign.best.city, 100);
    assert.strictEqual(kept.data.profile.purchases['map:lava'], 1, 'an old DB open stays');
    assert.ok(!kept.data.profile.purchases['map:jungle']);
    assert.ok(!kept.data.profile.purchases['map:space']);
    assert.strictEqual(kept.data.profile.coins, 100);

    const early = await req(base, 'POST', '/api/profile/buy', { key: 'map:jungle' }, tok);
    assert.strictEqual(early.status, 400);
    assert.strictEqual(early.data.error, 'GOAL_LOCKED');
    assert.strictEqual(early.data.profile ? early.data.profile.coins : 100, 100);
    const afterEarly = await req(base, 'GET', '/api/profile', undefined, tok);
    assert.ok(!afterEarly.data.profile.purchases['map:jungle']);
    assert.strictEqual(afterEarly.data.profile.coins, 100);

    const ready = await req(base, 'POST', '/api/profile/campaign', { mapBest: { city: 500 }, open: { 'map:jungle': 1 } }, tok);
    assert.strictEqual(ready.data.profile.campaign.best.city, 500);
    assert.ok(!ready.data.profile.purchases['map:jungle']);
    players.get(id).coins = 10;
    const poor = await req(base, 'POST', '/api/profile/buy', { key: 'map:jungle' }, tok);
    assert.strictEqual(poor.status, 400);
    assert.strictEqual(poor.data.error, 'INSUFFICIENT_COINS');
    assert.ok(!poor.data.profile || !poor.data.profile.purchases || !poor.data.profile.purchases['map:jungle']);
    const stillPoor = await req(base, 'GET', '/api/profile', undefined, tok);
    assert.strictEqual(stillPoor.data.profile.coins, 10);
    assert.ok(!stillPoor.data.profile.purchases['map:jungle']);

    players.get(id).coins = 100;
    await req(base, 'POST', '/api/profile/campaign', { mapBest: { jungle: 700 } }, tok);
    const [a, b] = await Promise.all([
      req(base, 'POST', '/api/profile/buy', { key: 'map:ice' }, tok),
      req(base, 'POST', '/api/profile/buy', { key: 'map:ice' }, tok),
    ]);
    assert.strictEqual(a.status, 201, JSON.stringify(a.data));
    assert.strictEqual(b.status, 201, JSON.stringify(b.data));
    const ownedFlags = [a.data.alreadyOwned, b.data.alreadyOwned].filter(Boolean);
    assert.strictEqual(ownedFlags.length, 1, 'exactly one of the parallel buys is a repeat');
    const live = await req(base, 'GET', '/api/profile', undefined, tok);
    assert.strictEqual(live.data.profile.purchases['map:ice'], 1);
    assert.strictEqual(live.data.profile.coins, 0, 'price 100 charged once');
    assert.strictEqual(live.data.profile.purchases['map:lava'], 1);
    const again = await req(base, 'POST', '/api/profile/buy', { key: 'map:ice' }, tok);
    assert.strictEqual(again.data.alreadyOwned, true);
    assert.strictEqual(again.data.profile.coins, 0);
  } finally {
    await app.close();
  }
  console.log('PASS map purchase (no free open, goal, coins, one charge, old opens stay)');
}

const TG_PROFILE_LEAK_KEYS = [
  'telegramUsername', 'telegramFirstName', 'telegramLastName',
  'telegramLanguage', 'telegramIsPremium', 'telegramProfileUpdatedAt',
  'username', 'first_name', 'last_name', 'language_code', 'is_premium',
];

function assertNoTelegramProfileLeak(payload, uniqueMarker) {
  const profile = payload && payload.profile;
  assert.ok(profile, 'profile present');
  for (const k of TG_PROFILE_LEAK_KEYS) {
    assert.strictEqual(profile[k], undefined, 'profile must not expose ' + k);
  }
  const raw = JSON.stringify(payload);
  if (uniqueMarker) {
    assert.ok(!raw.includes(uniqueMarker), 'API must not include telegram username');
  }
}

async function testTelegramProfileFields() {
  process.env.TELEGRAM_BOT_TOKEN = TEST_BOT_TOKEN;
  const { app, base, players, telegrams } = await startTestApp();
  const init = (uid, extra) => makeInitData(TEST_BOT_TOKEN, uid, extra);
  try {
    assert.strictEqual(clipTelegramField('abc', 2), 'ab');
    assert.strictEqual(clipTelegramField('', 8), null);
    assert.strictEqual(clipTelegramField(1, 8), null);

    const longName = 'N'.repeat(200);
    const longUser = 'u'.repeat(80);
    const signed = init(424201, {
      username: longUser,
      first_name: longName,
      last_name: 'Ledin',
      language_code: 'ru-RU-extra-longer',
      is_premium: true,
    });
    const parsed = parseAndVerifyInitData(signed, TEST_BOT_TOKEN);
    assert.strictEqual(parsed.username, 'u'.repeat(64));
    assert.strictEqual(parsed.firstName, 'N'.repeat(128));
    assert.strictEqual(parsed.lastName, 'Ledin');
    assert.strictEqual(parsed.languageCode, 'ru-RU-extra-longer'.slice(0, 16));
    assert.strictEqual(parsed.isPremium, true);

    const guest = await req(base, 'POST', '/api/profile/guest');
    const tok = guest.data.token;
    const linked = await req(base, 'POST', '/api/auth/telegram', {
      initData: init(424201, {
        username: 'unit_tg_nick_xyz',
        first_name: 'Roman',
        last_name: 'L',
        language_code: 'ru',
        is_premium: true,
      }),
    }, tok);
    assert.strictEqual(linked.status, 201, JSON.stringify(linked.data));
    assert.strictEqual(linked.data.linked, true);
    assertNoTelegramProfileLeak(linked.data, 'unit_tg_nick_xyz');
    const row = [...players.values()].find((p) => String(p.telegramId) === '424201');
    assert.ok(row);
    assert.strictEqual(row.telegramUsername, undefined);
    const tg = telegrams.get(row.id);
    assert.strictEqual(tg.username, 'unit_tg_nick_xyz');
    assert.strictEqual(tg.firstName, 'Roman');
    assert.strictEqual(tg.lastName, 'L');
    assert.strictEqual(tg.language, 'ru');
    assert.strictEqual(tg.isPremium, true);
    assert.ok(tg.updatedAt instanceof Date);

    const again = await req(base, 'POST', '/api/auth/telegram', {
      initData: init(424201, {
        username: 'unit_tg_nick_v2',
        first_name: 'Ro',
        language_code: 'en',
      }),
    }, tok);
    assert.strictEqual(again.status, 201, JSON.stringify(again.data));
    assertNoTelegramProfileLeak(again.data, 'unit_tg_nick_v2');
    const row2 = [...players.values()].find((p) => String(p.telegramId) === '424201');
    const tg2 = telegrams.get(row2.id);
    assert.strictEqual(tg2.username, 'unit_tg_nick_v2');
    assert.strictEqual(tg2.firstName, 'Ro');
    assert.strictEqual(tg2.lastName, null);
    assert.strictEqual(tg2.language, 'en');
    assert.strictEqual(tg2.isPremium, null);

    const created = await req(base, 'POST', '/api/auth/telegram', {
      initData: init(424202, { username: 'fresh_tg_user', first_name: 'A', is_premium: false }),
    });
    assert.strictEqual(created.status, 201, JSON.stringify(created.data));
    assertNoTelegramProfileLeak(created.data, 'fresh_tg_user');
    const fresh = [...players.values()].find((p) => String(p.telegramId) === '424202');
    assert.strictEqual(telegrams.get(fresh.id).username, 'fresh_tg_user');
    assert.strictEqual(telegrams.get(fresh.id).isPremium, false);

    const g2 = await req(base, 'POST', '/api/profile/guest');
    const merged = await req(base, 'POST', '/api/auth/telegram', {
      initData: init(424202, { username: 'fresh_tg_merged', first_name: 'B' }),
    }, g2.data.token);
    assert.strictEqual(merged.status, 201, JSON.stringify(merged.data));
    assert.strictEqual(merged.data.merged, true);
    assertNoTelegramProfileLeak(merged.data, 'fresh_tg_merged');
    const afterMerge = [...players.values()].find((p) => String(p.telegramId) === '424202');
    assert.strictEqual(telegrams.get(afterMerge.id).username, 'fresh_tg_merged');
    assert.strictEqual(telegrams.get(afterMerge.id).firstName, 'B');
  } finally {
    await app.close();
  }
  console.log('PASS telegram profile fields (clip, persist, no API leak, login/merge update)');
}

(async () => {
  await testWithoutDb();
  await testProfileFlow();
  await testTelegramMerge();
  await testTelegramProfileFields();
  await testAwardSeries();
  await testMigrationSql();
  await testPlausibilityAndSession();
  await testTwoDevices();
  await testMapPurchase();
  console.log('ALL SERVER PROFILE TESTS PASS');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
