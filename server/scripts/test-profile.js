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
const { ITEM_PRICES, RUN_COINS_MAX, RUN_BONUS_MAX, HEIGHT_AWARD_MIN } = require('../dist/profile/limits');
const { AddBestBuyRunId1795642000000 } = require('../dist/db/migrations/1795642000000-AddBestBuyRunId');
const { AddMergedInto1795643000000 } = require('../dist/db/migrations/1795643000000-AddMergedInto');
const { AddCampaign1795644000000 } = require('../dist/db/migrations/1795644000000-AddCampaign');

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
        if (where.telegramId && p.telegramId === where.telegramId) return hydratePlayer(p);
      }
      return null;
    },
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

  return { playerRepo, runRepo, players, runs };
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
  const { playerRepo, runRepo, players } = makeMemoryRepos();

  class TestProfileModule {}
  Module({
    controllers: [ProfileController],
    providers: [
      {
        provide: ProfileService,
        useFactory: () => new ProfileService(playerRepo, runRepo),
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

function makeInitData(botToken, userId) {
  const user = JSON.stringify({ id: userId, first_name: 'T' });
  const auth_date = String(Math.floor(Date.now() / 1000));
  const fields = { auth_date, query_id: 'AA', user };
  const dataCheckString = Object.keys(fields).sort().map((k) => `${k}=${fields[k]}`).join('\n');
  const secret = crypto.createHmac('sha256', 'WebAppData').update(botToken, 'utf8').digest();
  const hash = crypto.createHmac('sha256', secret).update(dataCheckString, 'utf8').digest('hex');
  return new URLSearchParams({ ...fields, hash }).toString();
}

async function startTestApp() {
  const { Module } = require('@nestjs/common');
  const { playerRepo, runRepo, players } = makeMemoryRepos();
  class TestProfileModule {}
  Module({
    controllers: [ProfileController],
    providers: [{ provide: ProfileService, useFactory: () => new ProfileService(playerRepo, runRepo) }],
  })(TestProfileModule);
  const app = await NestFactory.create(TestProfileModule, { logger: false });
  await app.listen(0, '127.0.0.1');
  const port = app.getHttpServer().address().port;
  return { app, base: `http://127.0.0.1:${port}`, playerRepo, players };
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

(async () => {
  await testWithoutDb();
  await testProfileFlow();
  await testTelegramMerge();
  await testAwardSeries();
  await testMigrationSql();
  await testTwoDevices();
  await testMapPurchase();
  console.log('ALL SERVER PROFILE TESTS PASS');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
