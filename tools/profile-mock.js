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

function toPublic(p) {
  const base = {
    id: p.id,
    coins: p.coins,
    purchases: { ...p.purchases },
    migratedAt: p.migratedAt,
    createdAt: p.createdAt,
    telegramId: p.telegramId,
  };
  if (mode === 'v06') base.best = p.best || 0;
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
      if (b.resetCooldown) {
        for (const p of playersByHash.values()) p.lastFinishAt = 0;
      }
      if (b.clearLog) requestLog.length = 0;
      return json(res, 200, { ok: true, mode, players: playersByHash.size, log: requestLog.slice() });
    }
    if (urlPath === '/__mock/log' && req.method === 'GET') {
      return json(res, 200, { ok: true, mode, log: requestLog.slice() });
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
        return json(res, 503, { ok: false, error: 'TELEGRAM_AUTH_UNAVAILABLE' });
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
        p.purchases = { ...p.purchases, ...sanitizePurchases(b.purchases) };
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
            return json(res, 201, { ok: true, awarded: pr.get(runId), duplicate: true, profile: toPublic(p) });
          }
        }
        const now = Date.now();
        if (p.lastFinishAt && now - p.lastFinishAt < cooldownMs) {
          return json(res, 429, { ok: false, error: 'RATE_LIMIT' });
        }
        if (!p.windowStartedAt || p.windowStartedAt < now - 3600000) {
          p.windowStartedAt = now;
          p.awardedInWindow = 0;
        }
        const h = clamp(Math.floor(Number(b.height) || 0), 0, 20000);
        const c = clamp(Math.floor(Number(b.runCoins) || 0), 0, 80);
        const bc = clamp(Math.floor(Number(b.bonusCoins) || 0), 0, 40);
        const want = clamp(Math.floor(h / 25) + c + bc, 0, 200);
        const room = Math.max(0, 400 - p.awardedInWindow);
        const awarded = Math.min(want, room);
        p.coins += awarded;
        if (mode === 'v06') p.best = Math.max(p.best || 0, h);
        p.awardedInWindow += awarded;
        p.lastFinishAt = now;
        if (mode === 'v06' && runId) runsByPlayer.get(p.id).set(runId, awarded);
        const out = { ok: true, awarded, profile: toPublic(p) };
        if (awarded < want) out.limited = 'HOUR_CAP';
        return json(res, 201, out);
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
