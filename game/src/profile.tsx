
/* ---------------- Player profile (guest token + server sync) ----------------
   Targets feat/profile-db @ 2284797 and supports feat/profile-server-v06
   (best, runId, /api/profile/buy). Keeps local save working offline or on 503.
   All logic lives here; 04_shell.tsx only calls PROFILE.init / finishRun / buy. */

var PROFILE: any = (function () {
  var TOKEN_KEY = "hoppak_guest_token";
  var QUEUE_KEY = "hoppak_profile_queue";
  var BUYS_KEY = "hoppak_profile_buys";
  var CACHE_KEY = "hoppak_profile_cache";
  var REQ_MS = 5000;
  var FINISH_COOLDOWN_MS = 8200;
  var RATE_RETRY_MS = 8500;
  var P: any = {
    st: "idle", /* idle | syncing | ready | offline | unavailable */
    profile: null as any,
    api: null as any,
    queue: null as any,
    buySupported: null as any, /* null = unknown | true | false (404 on 2284797) */
    lastFinishOkAt: 0,
    nextRunAt: 0,
    backoffMs: 5000,
    retryTimer: 0,
    onlineBound: false
  };

  function lsGet(k: string): string {
    try { return (typeof localStorage !== "undefined" && localStorage.getItem(k)) || ""; } catch (_e) { return ""; }
  }
  function lsSet(k: string, v: string) {
    try {
      if (typeof localStorage === "undefined") return;
      if (v) localStorage.setItem(k, v);
      else localStorage.removeItem(k);
    } catch (_e) {}
  }
  function readJson(k: string, def: any) {
    try {
      var raw = lsGet(k);
      if (!raw) return def;
      var parsed = JSON.parse(raw);
      return parsed == null ? def : parsed;
    } catch (_e) { return def; }
  }
  function writeJson(k: string, val: any) {
    try { lsSet(k, JSON.stringify(val)); } catch (_e) {}
  }

  function getToken(): string { return lsGet(TOKEN_KEY); }
  function setToken(t: string) { lsSet(TOKEN_KEY, t); }

  function getRunQueue(): any[] {
    var q = readJson(QUEUE_KEY, []);
    return Array.isArray(q) ? q : [];
  }
  function setRunQueue(q: any[]) {
    if (q.length > 50) q = q.slice(q.length - 50);
    writeJson(QUEUE_KEY, q);
  }

  function getPendingBuys(): any[] {
    var b = readJson(BUYS_KEY, []);
    return Array.isArray(b) ? b : [];
  }
  function setPendingBuys(b: any[]) {
    writeJson(BUYS_KEY, b);
  }

  function pruneConfirmedBuys(prof: any) {
    var owned = (prof && prof.purchases) || {};
    var buys = getPendingBuys();
    var next: any[] = [];
    var seen: any = {};
    for (var i = 0; i < buys.length; i++) {
      var it = buys[i];
      if (!it || !it.key || seen[it.key] || owned[it.key]) continue;
      seen[it.key] = 1;
      next.push(it);
    }
    if (next.length !== buys.length) setPendingBuys(next);
    return next;
  }

  function pendingSpend(): number {
    var buys = getPendingBuys();
    var tot = 0;
    for (var i = 0; i < buys.length; i++) {
      tot += Math.max(0, Math.floor(Number(buys[i] && buys[i].price) || 0));
    }
    return tot;
  }

  function queuedEst(): number {
    var q = getRunQueue();
    var tot = 0;
    for (var i = 0; i < q.length; i++) {
      tot += Math.max(0, Math.floor(Number(q[i] && q[i].estAward) || 0));
    }
    return tot;
  }

  function estRunAward(height: number, runCoins: number, bonusCoins: number): number {
    var h = Math.max(0, Math.min(20000, Math.floor(Number(height) || 0)));
    var c = Math.max(0, Math.min(80, Math.floor(Number(runCoins) || 0)));
    var b = Math.max(0, Math.min(40, Math.floor(Number(bonusCoins) || 0)));
    return Math.max(0, Math.min(200, Math.floor(h / 25) + c + b));
  }

  function makeRunId(): string {
    var r = "";
    try {
      if (typeof crypto !== "undefined" && crypto.getRandomValues) {
        var u = new Uint32Array(2);
        crypto.getRandomValues(u);
        r = u[0].toString(36) + u[1].toString(36);
      }
    } catch (_e) {}
    if (!r) r = Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6);
    return "r_" + Date.now().toString(36) + "_" + r;
  }

  function normalizeOrigin(raw: string): string {
    var o = String(raw || "").trim();
    if (!o) return "";
    if (o.indexOf("wss://") === 0) o = "https://" + o.slice(6);
    else if (o.indexOf("ws://") === 0) o = "http://" + o.slice(5);
    if (o.indexOf("https://") !== 0 && o.indexOf("http://") !== 0) return "";
    o = o.replace(/\/+$/, "");
    if (o.length > 3 && o.slice(-3) === "/ws") o = o.slice(0, -3);
    if (o.length > 4 && o.slice(-4) === "/api") o = o.slice(0, -4);
    return o.replace(/\/+$/, "");
  }

  function apiOrigin(): string {
    var w: any = typeof window !== "undefined" ? window : null;
    if (!w) return "";
    try {
      var sp = new URLSearchParams(w.location.search);
      var qa = sp.get("api") || sp.get("profileApi");
      if (qa) { var qan = normalizeOrigin(qa); if (qan) return qan; }
      if (w.HOPPAK_API) { var wan = normalizeOrigin(w.HOPPAK_API); if (wan) return wan; }
      var lsa = w.localStorage && w.localStorage.getItem("hoppak.api");
      if (lsa) { var lsan = normalizeOrigin(lsa); if (lsan) return lsan; }
    } catch (_e) {}
    try {
      if (typeof HOP_API !== "undefined" && HOP_API) {
        var ban = normalizeOrigin(String(HOP_API));
        if (ban) return ban;
      }
    } catch (_e1) {}
    var isPage = false;
    try { isPage = typeof HOP_PAGE !== "undefined" && !!HOP_PAGE; } catch (_e2) {}
    if (!isPage) {
      try {
        var pr = w.location && w.location.protocol;
        if (pr === "http:" || pr === "https:") return w.location.origin;
      } catch (_e3) {}
    }
    try {
      var qs = new URLSearchParams(w.location.search).get("server");
      if (qs) { var qn = normalizeOrigin(qs); if (qn) return qn; }
      if (w.HOPPAK_SERVER) { var wn = normalizeOrigin(w.HOPPAK_SERVER); if (wn) return wn; }
      var ls = w.localStorage && w.localStorage.getItem("hoppak.server");
      if (ls) { var ln = normalizeOrigin(ls); if (ln) return ln; }
      if (isPage && typeof HOP_SERVER !== "undefined" && HOP_SERVER) {
        var bn = normalizeOrigin(String(HOP_SERVER));
        if (bn) return bn;
      }
    } catch (_e4) {}
    return "";
  }

  function req(method: string, path: string, body?: any, token?: string) {
    var base = apiOrigin();
    if (!base || typeof fetch === "undefined") {
      return Promise.resolve({ status: 0, ok: false, data: null });
    }
    var ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
    var to = setTimeout(function () { try { if (ctrl) ctrl.abort(); } catch (_e) {} }, REQ_MS);
    var headers: any = {};
    if (token) headers["Authorization"] = "Bearer " + token;
    var sameOrig = false;
    try { sameOrig = typeof window !== "undefined" && window.location && window.location.origin === base; } catch (_e0) {}
    var opts: any = { method: method, headers: headers, cache: "no-store", mode: sameOrig ? "same-origin" : "cors" };
    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
      opts.body = JSON.stringify(body);
    }
    if (ctrl) opts.signal = ctrl.signal;
    return fetch(base + path, opts).then(function (r: any) {
      clearTimeout(to);
      return r.json().catch(function () { return null; }).then(function (data: any) {
        return { status: r.status, ok: !!r.ok, data: data };
      });
    }).catch(function () {
      clearTimeout(to);
      return { status: 0, ok: false, data: null };
    });
  }

  function applyProfile(prof: any, wRef?: any, awarded?: number) {
    if (!prof) return;
    P.profile = prof;
    writeJson(CACHE_KEY, prof);
    pruneConfirmedBuys(prof);
    var effectiveCoins = Math.max(0, (prof.coins || 0) - pendingSpend()) + queuedEst();
    if (P.api && P.api.apply) P.api.apply(prof, wRef, awarded, effectiveCoins);
  }

  function handleStatus(res: any): boolean {
    if (res.status === 503 || (res.data && res.data.error === "PROFILE_UNAVAILABLE")) {
      P.st = "unavailable";
      return false;
    }
    if (!res.ok || !res.data || !res.data.ok) {
      if (res.status === 0 || res.status >= 500) P.st = "offline";
      return false;
    }
    return true;
  }

  function scheduleRetry(delayMs: number) {
    if (typeof setTimeout === "undefined") return;
    if (P.retryTimer) { clearTimeout(P.retryTimer); P.retryTimer = 0; }
    var d = Math.max(250, delayMs);
    P.retryTimer = setTimeout(function () {
      P.retryTimer = 0;
      P.flush();
    }, d);
  }

  function syncMigrate(token: string, prof: any) {
    if (!prof || prof.migratedAt) {
      P.st = "ready";
      applyProfile(prof);
      return Promise.resolve(prof);
    }
    var s = P.api && P.api.save ? P.api.save() : null;
    var rawCoins = s && typeof s.coins === "number" ? Math.max(0, Math.floor(s.coins)) : 0;
    var coins = Math.max(0, rawCoins - queuedEst());
    var purchases = (s && s.owned && typeof s.owned === "object") ? s.owned : {};
    var best = s && typeof s.best === "number" ? Math.max(0, Math.floor(s.best)) : 0;
    return req("POST", "/api/profile/migrate", { coins: coins, purchases: purchases, best: best }, token).then(function (res: any) {
      if (!handleStatus(res)) return null;
      P.st = "ready";
      applyProfile(res.data.profile);
      return res.data.profile;
    });
  }

  function createGuestAndMigrate() {
    return req("POST", "/api/profile/guest").then(function (res: any) {
      if (!handleStatus(res)) return null;
      if (res.data.token) setToken(res.data.token);
      return syncMigrate(res.data.token || getToken(), res.data.profile);
    });
  }

  function ensureProfile() {
    var base = apiOrigin();
    if (!base || typeof fetch === "undefined") {
      P.st = "offline";
      return Promise.resolve(null);
    }
    P.st = "syncing";
    var tok = getToken();
    if (tok) {
      return req("GET", "/api/profile", undefined, tok).then(function (res: any) {
        if (res.status === 401) {
          setToken("");
          return createGuestAndMigrate();
        }
        if (!handleStatus(res)) return null;
        return syncMigrate(tok, res.data.profile);
      });
    }
    return createGuestAndMigrate();
  }

  function flushBuysOnce(tok: string): Promise<void> {
    if (P.buySupported === false) return Promise.resolve();
    var buys = getPendingBuys();
    if (!buys.length || !tok) return Promise.resolve();
    var item = buys[0];
    return req("POST", "/api/profile/buy", { key: item.key }, tok).then(function (res: any) {
      if (res.status === 404 || res.status === 405 || res.status === 501) {
        P.buySupported = false;
        return;
      }
      if (res.status === 401) {
        setToken("");
        return;
      }
      if (res.status === 400) {
        // INVALID_ITEM or INSUFFICIENT_COINS — drop stale pending buy and re-sync
        var cur = getPendingBuys().filter(function (x: any) { return x && x.key !== item.key; });
        setPendingBuys(cur);
        if (P.profile) applyProfile(P.profile);
        return flushBuysOnce(tok);
      }
      if (!handleStatus(res)) return;
      P.buySupported = true;
      P.st = "ready";
      var rest = getPendingBuys().filter(function (x: any) { return x && x.key !== item.key; });
      setPendingBuys(rest);
      applyProfile(res.data.profile);
      if (rest.length) return flushBuysOnce(tok);
    });
  }

  function flushRunsStep(tok: string, authRetried?: boolean): Promise<any> {
    var q = getRunQueue();
    if (!q.length) return Promise.resolve(null);
    var now = Date.now();
    if (now < P.nextRunAt) {
      scheduleRetry(P.nextRunAt - now);
      return Promise.resolve(null);
    }
    var head = q[0];
    var body: any = {
      runId: head.runId,
      height: head.height,
      runCoins: head.runCoins,
      bonusCoins: head.bonusCoins
    };
    if (head.mode) body.mode = head.mode;
    if (head.map) body.map = head.map;
    if (head.ver) body.ver = head.ver;

    return req("POST", "/api/run/finish", body, tok).then(function (res: any) {
      if (res.status === 401) {
        setToken("");
        if (!authRetried) {
          return ensureProfile().then(function () {
            var nt = getToken();
            return nt ? flushRunsStep(nt, true) : null;
          });
        }
        return null;
      }
      if (res.status === 429 || (res.data && res.data.error === "RATE_LIMIT")) {
        P.nextRunAt = Date.now() + RATE_RETRY_MS;
        scheduleRetry(RATE_RETRY_MS);
        return null;
      }
      if (res.status === 400) {
        var dropped = getRunQueue();
        dropped.shift();
        setRunQueue(dropped);
        return dropped.length ? flushRunsStep(tok, authRetried) : null;
      }
      if (!handleStatus(res)) {
        var wait = P.backoffMs;
        P.backoffMs = Math.min(60000, P.backoffMs * 2);
        scheduleRetry(wait);
        return null;
      }
      P.backoffMs = 5000;
      P.lastFinishOkAt = Date.now();
      P.nextRunAt = P.lastFinishOkAt + FINISH_COOLDOWN_MS;
      var curQ = getRunQueue();
      if (curQ.length && curQ[0].runId === head.runId) curQ.shift();
      else curQ = curQ.filter(function (x: any) { return x && x.runId !== head.runId; });
      setRunQueue(curQ);
      P.st = "ready";
      applyProfile(res.data.profile, head._wRef, res.data.awarded);
      if (curQ.length) scheduleRetry(FINISH_COOLDOWN_MS);
      return res.data;
    });
  }

  function flushAll(allowInit: boolean) {
    var base = apiOrigin();
    if (!base || typeof fetch === "undefined") {
      P.st = "offline";
      return Promise.resolve(null);
    }
    var tok = getToken();
    var ready = tok ? Promise.resolve(tok) : (allowInit ? ensureProfile().then(function () { return getToken(); }) : Promise.resolve(""));
    return ready.then(function (t: string) {
      if (!t) {
        if (getRunQueue().length || getPendingBuys().length) {
          var wait = P.backoffMs;
          P.backoffMs = Math.min(60000, P.backoffMs * 2);
          scheduleRetry(wait);
        }
        return null;
      }
      return flushBuysOnce(t).then(function () {
        return flushRunsStep(t);
      });
    });
  }

  function enqueue(fn: any) {
    var prev = P.queue || Promise.resolve(null);
    var next = prev.then(function () { return fn(); }, function () { return fn(); });
    P.queue = next;
    return next;
  }

  P.init = function (api: any) {
    P.api = api;
    if (!P.onlineBound && typeof window !== "undefined" && window.addEventListener) {
      P.onlineBound = true;
      window.addEventListener("online", function () {
        P.backoffMs = 5000;
        P.flush();
      });
    }
    return enqueue(function () {
      return ensureProfile().then(function (prof: any) {
        if (!prof) {
          var cached = readJson(CACHE_KEY, null);
          if (cached) P.profile = cached;
          if (getRunQueue().length || getPendingBuys().length) {
            scheduleRetry(P.backoffMs);
          }
          return null;
        }
        return flushAll(false).then(function () { return P.profile; });
      });
    });
  };

  P.finishRun = function (height: number, runCoins: number, bonusCoins: number, worldRef?: any, meta?: any) {
    var h = Math.max(0, Math.floor(Number(height) || 0));
    var c = Math.max(0, Math.floor(Number(runCoins) || 0));
    var b = Math.max(0, Math.floor(Number(bonusCoins) || 0));
    var item: any = {
      runId: makeRunId(),
      height: h,
      runCoins: c,
      bonusCoins: b,
      mode: (meta && meta.mode) || "solo",
      map: (meta && meta.map) || "",
      ver: (meta && meta.ver) || "0.6",
      estAward: estRunAward(h, c, b),
      createdAt: Date.now()
    };
    var q = getRunQueue();
    q.push(item);
    setRunQueue(q);
    /* Attach transient ref only on in-memory handoff for results screen coin roll-up */
    return enqueue(function () {
      var cur = getRunQueue();
      for (var i = 0; i < cur.length; i++) {
        if (cur[i].runId === item.runId) { cur[i]._wRef = worldRef; break; }
      }
      return flushAll(true);
    });
  };

  P.buy = function (key: string, price: number) {
    if (!key) return Promise.resolve(null);
    var buys = getPendingBuys();
    var found = false;
    for (var i = 0; i < buys.length; i++) if (buys[i] && buys[i].key === key) { found = true; break; }
    if (!found) {
      buys.push({ key: key, price: Math.max(0, Math.floor(Number(price) || 0)), at: Date.now() });
      setPendingBuys(buys);
    }
    return enqueue(function () {
      if (P.buySupported === false) return null;
      var base = apiOrigin();
      if (!base || typeof fetch === "undefined") { P.st = "offline"; return null; }
      var tok = getToken();
      var ready = tok ? Promise.resolve(tok) : ensureProfile().then(function () { return getToken(); });
      return ready.then(function (t: string) {
        if (!t) return null;
        return flushBuysOnce(t);
      });
    });
  };

  P.flush = function () {
    return enqueue(function () { return flushAll(true); });
  };

  P.getToken = getToken;
  P.apiOrigin = apiOrigin;
  P.getState = function () {
    return {
      st: P.st,
      profile: P.profile,
      tokenPresent: !!getToken(),
      queueLen: getRunQueue().length,
      pendingBuysLen: getPendingBuys().length,
      pendingSpend: pendingSpend(),
      queuedEst: queuedEst(),
      buySupported: P.buySupported,
      apiOrigin: apiOrigin()
    };
  };
  return P;
})();
