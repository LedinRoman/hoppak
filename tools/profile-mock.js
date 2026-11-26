#!/usr/bin/env node
'use strict';

/**
 * Local mock HTTP server for Хоппак v0.6 profile testing (not deployed).
 * Modes:
 *   --mode=2284797  Exact feat/profile-db @ 2284797 behavior (default)
 *   --mode=v06      Adds feat/profile-server-v06 extensions (best, runId dedup, /api/profile/buy)
 *   --mode=503      Simulates missing DATABASE_URL (503 PROFILE_UNAVAILABLE)
 *
 * Also serves static game/site/ on /, /v/<ver>/ so same-origin /api and multi-version
 * path sharing can be tested in a real browser.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const args = process.argv.slice(2);
function argVal(name, def) {
  const pref = `--${name}=`;
  const hit = args.find((a) => a.startsWith(pref));
  return hit ? hit.slice(pref.length) : def;
}

let mode = argVal('mode', '2284797');
let tgAuth = argVal('tgAuth', '503'); /* ok | 503 | 401 | 409 */
const port = Number(argVal('port', process.env.PORT || 8799));
const staticDir = path.resolve(argVal('static', path.join(__dirname, '..', 'game', 'site')));
const cooldownMs = Number(argVal('cooldown', 8000));

const ITEM_PRICES = {
  'char:0': 0, 'char:1': 150, 'char:2': 200, 'char:3': 240, 'char:4': 280, 'char:5': 320,
  'map:city': 0, 'map:jungle': 80, 'map:ice': 100, 'map:lava': 120, 'map:aqua': 140, 'map:space': 160,
};

const playersByHash = new Map();
const runsByPlayer = new Map();
const requestLog = [];

function sha256(s) {
  return crypto.createHash('sha256').update(s, 'utf8').digest('hex');
}

function clamp(n, lo, hi) {
  if (!Number.isFinite(n)) return lo;
  return Math.max(lo, Math.min(hi, n));
}

function sanitizePurchases(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  const re = /^(hero|char|map):[a-z0-9_-]+$/i;
  for (const [k, v] of Object.entries(raw)) {
    if (!re.test(k)) continue;
    const n = typeof v === 'number' ? v : v ? 1 : 0;
    if (n > 0) out[k] = 1;
  }
  return out;
}

const MAP_IDS = ['city', 'jungle', 'ice', 'lava', 'aqua', 'space'];

function sanitizeMapBest(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const id of MAP_IDS) {
    if (raw[id] == null || raw[id] === '') continue;
    const n = Math.floor(Number(raw[id]));
    if (!Number.isFinite(n) || n <= 0) continue;
    out[id] = clamp(n, 1, 20000);
  }
  return out;
}

function mergeCampaign(a, b) {
  const best = {};
  for (const src of [a, b]) {
    const part = sanitizeMapBest(src && src.best);
    for (const id of Object.keys(part)) best[id] = Math.max(best[id] || 0, part[id]);
  }
  return { best };
}

function toPublic(p) {
  const base = {
    id: p.id,
    coins: p.coins,
    purchases: { ...p.purchases },
    migratedAt: p.migratedAt,
    createdAt: p.createdAt,
    telegramId: p.telegramId,
  };
  if (mode === 'v06') {
    base.best = p.best || 0;
    base.campaign = mergeCampaign(p.campaign, { best: {} });
  }
  return base;
}

function bearer(req) {
  const h = req.headers.authorization || '';
  const m = /^Bearer\s+(\S+)/i.exec(h);
  return m ? m[1] : null;
}

function json(res, status, obj) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'Authorization, Content-Type',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
  });
  res.end(JSON.stringify(obj));
}

function readBody(req) {
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (c) => { raw += c; if (raw.length > 65536) req.destroy(); });
    req.on('end', () => {
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); } catch { resolve({}); }
    });
  });
}

function serveStatic(reqPath, res) {
  let rel = reqPath;
  const vm = /^\/v\/[^/]+(\/.*)?$/.exec(rel);
  if (vm) rel = vm[1] || '/';
  if (rel === '/' || rel === '') rel = '/index.html';
  const full = path.normalize(path.join(staticDir, rel));
  if (!full.startsWith(staticDir)) { res.writeHead(403); return res.end('forbidden'); }
  fs.readFile(full, (err, buf) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    const ct = full.endsWith('.js') ? 'text/javascript; charset=utf-8'
      : full.endsWith('.html') ? 'text/html; charset=utf-8'
      : 'application/octet-stream';
    res.writeHead(200, { 'content-type': ct, 'cache-control': 'no-store' });
    res.end(buf);
  });
}

function createServer() {
  return http.createServer(async (req, res) => {
    const urlPath = (req.url || '/').split('?')[0];
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'access-control-allow-origin': '*',
        'access-control-allow-headers': 'Authorization, Content-Type',
        'access-control-allow-methods': 'GET, POST, OPTIONS',
      });
      return res.end();
    }

    if (urlPath === '/__mock/admin' && req.method === 'POST') {
      const b = await readBody(req);
      if (b.mode) mode = b.mode;
      if (b.tgAuth) tgAuth = b.tgAuth;
      if (b.resetCooldown) {
        for (const p of playersByHash.values()) p.lastFinishAt = 0;
      }
      if (b.setCoins != null) {
        const tok = b.token;
        const pl = tok ? playersByHash.get(sha256(tok)) : null;
        if (pl) pl.coins = Math.max(0, Math.floor(Number(b.setCoins) || 0));
      }
      if (b.clearLog) requestLog.length = 0;
      return json(res, 200, { ok: true, mode, tgAuth, players: playersByHash.size, log: requestLog.slice() });
    }
    if (urlPath === '/__mock/log' && req.method === 'GET') {
      return json(res, 200, { ok: true, mode, tgAuth, log: requestLog.slice() });
    }

    if (urlPath === '/api/health' && req.method === 'GET') {
      return json(res, 200, { ok: true, mode, mock: true });
    }

    if (urlPath.startsWith('/api/')) {
      requestLog.push({ t: Date.now(), method: req.method, path: urlPath, mode });
      if (mode === '503') {
        return json(res, 503, { ok: false, error: 'PROFILE_UNAVAILABLE' });
      }

      if (urlPath === '/api/profile/guest' && req.method === 'POST') {
        const tok = bearer(req);
        if (tok) {
          const existing = playersByHash.get(sha256(tok));
          if (existing) return json(res, 201, { ok: true, token: tok, profile: toPublic(existing) });
        }
        const token = crypto.randomBytes(32).toString('hex');
        const p = {
          id: crypto.randomUUID(),
          guestTokenHash: sha256(token),
          coins: 0,
          best: 0,
          purchases: {},
          campaign: { best: {} },
          migratedAt: null,
          createdAt: new Date().toISOString(),
          lastFinishAt: 0,
          windowStartedAt: 0,
          awardedInWindow: 0,
          telegramId: null,
        };
        playersByHash.set(p.guestTokenHash, p);
        return json(res, 201, { ok: true, token, profile: toPublic(p) });
      }

      if (urlPath === '/api/auth/telegram' && req.method === 'POST') {
        if (tgAuth === '503' || mode === '503') {
          return json(res, 503, { ok: false, error: 'TELEGRAM_AUTH_UNAVAILABLE' });
        }
        if (tgAuth === '401') {
          return json(res, 401, { ok: false, error: 'INVALID_INIT_DATA' });
        }
        const b = await readBody(req);
        let telegramId = '10001';
        try {
          const params = new URLSearchParams(typeof b.initData === 'string' ? b.initData : '');
          const user = JSON.parse(params.get('user') || 'null');
          if (user && user.id != null) telegramId = String(user.id);
        } catch {}
        const tok = bearer(req);
        const guest = tok ? playersByHash.get(sha256(tok)) : null;
        if (tgAuth === '409') {
          return json(res, 409, { ok: false, error: 'GUEST_ALREADY_LINKED' });
        }
        const existing = [...playersByHash.values()].find((pl) => pl.telegramId && String(pl.telegramId) === telegramId && !pl.mergedInto);
        if (existing) {
          if (guest && guest.id === existing.id && tok) {
            return json(res, 201, { ok: true, token: tok, profile: toPublic(existing), linked: false });
          }
          let merged = false;
          let mergedCoins = 0;
          if (guest && guest.id !== existing.id && !guest.telegramId && !guest.mergedInto) {
            mergedCoins = clamp(Math.floor(Number(guest.coins) || 0), 0, 8000);
            existing.coins = (existing.coins || 0) + mergedCoins;
            existing.best = Math.max(existing.best || 0, Math.max(0, Math.floor(Number(guest.best) || 0)));
            existing.purchases = { ...existing.purchases, ...sanitizePurchases(guest.purchases) };
            existing.campaign = mergeCampaign(existing.campaign, guest.campaign);
            const bests = existing.campaign.best || {};
            for (const id of Object.keys(bests)) existing.best = Math.max(existing.best || 0, bests[id] || 0);
            guest.mergedInto = existing.id;
            guest.coins = 0;
            playersByHash.delete(guest.guestTokenHash);
            guest.guestTokenHash = sha256(crypto.randomBytes(32).toString('hex'));
            playersByHash.set(guest.guestTokenHash, guest);
            merged = true;
          }
          const nextToken = crypto.randomBytes(32).toString('hex');
          playersByHash.delete(existing.guestTokenHash);
          existing.guestTokenHash = sha256(nextToken);
          playersByHash.set(existing.guestTokenHash, existing);
          const body = { ok: true, token: nextToken, profile: toPublic(existing), linked: false };
          if (merged) { body.merged = true; body.mergedCoins = mergedCoins; }
          return json(res, 201, body);
        }
        if (guest) {
          if (guest.telegramId && String(guest.telegramId) !== telegramId) {
            return json(res, 409, { ok: false, error: 'GUEST_ALREADY_LINKED' });
          }
          const linked = !guest.telegramId;
          guest.telegramId = telegramId;
          return json(res, 201, { ok: true, token: tok, profile: toPublic(guest), linked });
        }
        const token = crypto.randomBytes(32).toString('hex');
        const pnew = {
          id: crypto.randomUUID(),
          guestTokenHash: sha256(token),
          coins: 0,
          best: 0,
          purchases: {},
          campaign: { best: {} },
          migratedAt: null,
          createdAt: new Date().toISOString(),
          lastFinishAt: 0,
          windowStartedAt: 0,
          awardedInWindow: 0,
          telegramId,
        };
        playersByHash.set(pnew.guestTokenHash, pnew);
        return json(res, 201, { ok: true, token, profile: toPublic(pnew), linked: true });
      }

      const tok = bearer(req);
      const p = tok ? playersByHash.get(sha256(tok)) : null;

      if (urlPath === '/api/profile' && req.method === 'GET') {
        if (!p) return json(res, 401, { ok: false, error: 'UNAUTHORIZED' });
        return json(res, 200, { ok: true, profile: toPublic(p) });
      }

      if (urlPath === '/api/profile/migrate' && req.method === 'POST') {
        if (!p) return json(res, 401, { ok: false, error: 'UNAUTHORIZED' });
        const b = await readBody(req);
        if (p.migratedAt) return json(res, 201, { ok: true, profile: toPublic(p) });
        const incoming = clamp(Math.floor(Number(b.coins) || 0), 0, 8000);
        p.coins = clamp(p.coins + incoming, 0, 8000);
        if (mode === 'v06') {
          p.best = Math.max(p.best || 0, clamp(Math.floor(Number(b.best) || 0), 0, 20000));
        }
        const incomingP = sanitizePurchases(b.purchases);
        for (const k of Object.keys(incomingP)) if (k.indexOf('map:') === 0) delete incomingP[k];
        p.purchases = { ...p.purchases, ...incomingP };
        p.migratedAt = new Date().toISOString();
        return json(res, 201, { ok: true, profile: toPublic(p) });
      }

      if (urlPath === '/api/run/finish' && req.method === 'POST') {
        if (!p) return json(res, 401, { ok: false, error: 'UNAUTHORIZED' });
        const b = await readBody(req);
        const runId = typeof b.runId === 'string' && /^[a-zA-Z0-9_.:-]{1,64}$/.test(b.runId.trim()) ? b.runId.trim() : null;
        if (mode === 'v06' && runId) {
          let pr = runsByPlayer.get(p.id);
          if (!pr) { pr = new Map(); runsByPlayer.set(p.id, pr); }
          if (pr.has(runId)) {
            return json(res, 201, { ok: true, awarded: pr.get(runId), duplicate: true, limited: 'DUPLICATE', profile: toPublic(p) });
          }
        }
        const rawH = Math.floor(Number(b.height) || 0);
        const rawC = Math.floor(Number(b.runCoins) || 0);
        const rawB = Math.floor(Number(b.bonusCoins) || 0);
        const h = clamp(rawH, 0, 20000);
        const c = clamp(rawC, 0, 15801);
        const bc = clamp(rawB, 0, 2500);
        const heightPay = h >= 100 ? Math.floor(h / 25) : 0;
        const awarded = heightPay + c + bc;
        let limited;
        if (rawH > 20000) limited = 'HEIGHT_CAP';
        else if (rawC > 15801) limited = 'COINS_CAP';
        else if (rawB > 2500) limited = 'BONUS_CAP';
        else if (h < 100) limited = 'HEIGHT_MIN';
        p.coins += awarded;
        if (mode === 'v06') p.best = Math.max(p.best || 0, h);
        if (mode === 'v06' && MAP_IDS.indexOf(b.map) >= 0 && h > 0) {
          p.campaign = mergeCampaign(p.campaign, { best: { [b.map]: h } });
        }
        if (mode === 'v06' && runId) runsByPlayer.get(p.id).set(runId, awarded);
        const out = { ok: true, awarded, profile: toPublic(p) };
        if (limited) out.limited = limited;
        return json(res, 201, out);
      }

      if (urlPath === '/api/profile/campaign' && req.method === 'POST') {
        if (mode !== 'v06') {
          return json(res, 404, { statusCode: 404, message: 'Cannot POST /api/profile/campaign', error: 'Not Found' });
        }
        if (!p) return json(res, 401, { ok: false, error: 'UNAUTHORIZED' });
        const b = await readBody(req);
        const before = p.coins;
        p.campaign = mergeCampaign(p.campaign, { best: sanitizeMapBest(b.mapBest) });
        const bests = p.campaign.best || {};
        for (const id of Object.keys(bests)) p.best = Math.max(p.best || 0, bests[id] || 0);
        p.coins = before;
        return json(res, 201, { ok: true, profile: toPublic(p) });
      }

      if (urlPath === '/api/profile/buy' && req.method === 'POST') {
        if (mode !== 'v06') {
          return json(res, 404, { statusCode: 404, message: 'Cannot POST /api/profile/buy', error: 'Not Found' });
        }
        if (!p) return json(res, 401, { ok: false, error: 'UNAUTHORIZED' });
        const b = await readBody(req);
        const key = typeof b.key === 'string' ? b.key.trim() : '';
        if (!Object.prototype.hasOwnProperty.call(ITEM_PRICES, key)) {
          return json(res, 400, { ok: false, error: 'INVALID_ITEM' });
        }
        if (p.purchases[key]) return json(res, 201, { ok: true, alreadyOwned: true, profile: toPublic(p) });
        if (key.indexOf('map:') === 0) {
          const order = ['city', 'jungle', 'ice', 'lava', 'aqua', 'space'];
          const goals = { city: 500, jungle: 700, ice: 900, lava: 1100, aqua: 1300, space: 0 };
          const idx = order.indexOf(key.slice(4));
          if (idx > 0) {
            const prev = order[idx - 1];
            const need = goals[prev] || 0;
            const have = Math.floor(Number(p.campaign && p.campaign.best && p.campaign.best[prev]) || 0);
            if (have < need) return json(res, 400, { ok: false, error: 'GOAL_LOCKED', map: prev, need, have });
          }
        }
        const price = ITEM_PRICES[key];
        if (p.coins < price) {
          return json(res, 400, { ok: false, error: 'INSUFFICIENT_COINS', needed: price, coins: p.coins });
        }
        p.coins -= price;
        p.purchases[key] = 1;
        return json(res, 201, { ok: true, profile: toPublic(p) });
      }

      return json(res, 404, { ok: false, error: 'NOT_FOUND' });
    }

    serveStatic(urlPath, res);
  });
}

if (require.main === module) {
  const srv = createServer();
  srv.listen(port, '127.0.0.1', () => {
    console.log(`profile-mock (${mode}) listening on http://127.0.0.1:${port}, static=${staticDir}`);
  });
}

module.exports = { createServer, ITEM_PRICES };
