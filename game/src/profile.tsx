
/* ---------------- Player profile (guest token + server sync) ----------------
   Targets feat/profile-db @ 2284797 and supports feat/profile-server-v06
   (best, runId, /api/profile/buy, POST /api/auth/telegram). Keeps local save
   working offline or on 503. Telegram Mini App login runs once per session
   when Telegram.WebApp.initData is present; errors stay on the guest profile.
   All logic lives here; 04_shell.tsx only calls PROFILE.init / finishRun / buy. */

var PROFILE: any = (function () {
  var TOKEN_KEY = "hoppak_guest_token";
  var COOKIE_FLAG = "hoppak_cookie_session";
  var QUEUE_KEY = "hoppak_profile_queue";
  var BUYS_KEY = "hoppak_profile_buys";
  var CACHE_KEY = "hoppak_profile_cache";
  var LOCK_KEY = "hoppak_profile_locked";
  var REQ_MS = 5000;
  var RUN_HEIGHT_MAX = 20000;
  var RUN_COINS_MAX = 15801;
  var RUN_BONUS_MAX = 2500;
  var HEIGHT_AWARD_MIN = 100;
  var P: any = {
    st: "idle", /* idle | syncing | ready | offline | unavailable | locked */
    profile: null as any,
    api: null as any,
    queue: null as any,
    buySupported: null as any, /* null = unknown | true | false (404 on 2284797) */
    backoffMs: 5000,
    retryTimer: 0,
    onlineBound: false,
    tgTried: false,
    live: false /* a profile was applied in this page load: the session is established */
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
  /* Forget a token only if it is still the stored one: another tab of this same browser may already have logged in
     again and stored a newer token, which must survive (that is the same client, not a second device). */
  function dropToken(used: string) { if (!used || getToken() === used) setToken(""); }
  function hasCookieSession(): boolean { return lsGet(COOKIE_FLAG) === "1"; }
  function setCookieSession(on: boolean) { lsSet(COOKIE_FLAG, on ? "1" : ""); }
  function hasSession(): boolean { return !!getToken() || hasCookieSession(); }
  /* Mini App: Telegram.WebApp.initData or tgWebAppData in the URL. Plain browser gets the Login Widget. */
  function isPlainBrowser(): boolean {
    try {
      var w: any = typeof window !== "undefined" ? window : null;
      if (!w) return true;
      var d = w.Telegram && w.Telegram.WebApp && w.Telegram.WebApp.initData;
      if (typeof d === "string" && d) return false;
      var q = String((w.location && w.location.search) || "") + String((w.location && w.location.hash) || "");
      if (/tgWebAppData|tgWebAppPlatform/i.test(q)) return false;
    } catch (_e) {}
    return true;
  }
  function appBasePath(): string {
    try {
      var path = String((window as any).location && (window as any).location.pathname || "/");
      if (/\/stage(\/|$)/.test(path)) return "/stage/";
      if (/\/play(\/|$)/.test(path)) return "/play/";
      var ver = path.match(/^(\/v\/[^/]+)\//);
      if (ver) return ver[1] + "/";
    } catch (_e) {}
    return "/";
  }
  function widgetCallbackUrl(): string {
    var origin = "";
    try { origin = String(window.location.origin || ""); } catch (_e) {}
    return origin + appBasePath().replace(/\/$/, "") + "/tg-auth";
  }
  function readWidgetAuthFromUrl(): any {
    if (!isPlainBrowser()) return null;
    try {
      var loc: any = (window as any).location;
      if (!loc) return null;
      var path = String(loc.pathname || "");
      var params = new URLSearchParams(String(loc.search || "").replace(/^\?/, ""));
      var hashStr = String(loc.hash || "");
      var fromHash = /(?:^|#|&)tgAuthResult=([A-Za-z0-9\-_=]+)/.exec(hashStr);
      if (fromHash) {
        var raw = fromHash[1].replace(/-/g, "+").replace(/_/g, "/");
        var pad = raw.length % 4;
        if (pad > 1) raw += "====".slice(0, 4 - pad);
        var obj = JSON.parse((window as any).atob(raw));
        if (obj && obj.hash && (obj.id != null) && obj.auth_date) return widgetBody(obj);
      }
      if (params.get("hash") && params.get("id") && params.get("auth_date")) {
        return widgetBody({
          id: params.get("id"),
          first_name: params.get("first_name"),
          last_name: params.get("last_name"),
          username: params.get("username"),
          photo_url: params.get("photo_url"),
          auth_date: params.get("auth_date"),
          hash: params.get("hash")
        });
      }
      if (/\/tg-auth\/?$/.test(path) && params.get("hash")) return widgetBody({
        id: params.get("id"),
        first_name: params.get("first_name"),
        last_name: params.get("last_name"),
        username: params.get("username"),
        photo_url: params.get("photo_url"),
        auth_date: params.get("auth_date"),
        hash: params.get("hash")
      });
    } catch (_e) {}
    return null;
  }
  function widgetBody(src: any): any {
    var out: any = {};
    var keys = ["id", "first_name", "last_name", "username", "photo_url", "auth_date", "hash"];
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      if (src[k] != null && src[k] !== "") out[k] = String(src[k]);
    }
    if (!out.hash || !out.id || !out.auth_date) return null;
    return out;
  }
  function cleanWidgetUrl() {
    try {
      var loc: any = (window as any).location;
      if (!loc || !loc.replaceState && !(window as any).history) return;
      var back = appBasePath();
      try {
        var stored = (window as any).sessionStorage && (window as any).sessionStorage.getItem("hoppak_tg_return");
        if (stored && stored.charAt(0) === "/") back = stored;
      } catch (_e0) {}
      (window as any).history.replaceState({}, "", back);
    } catch (_e) {}
  }

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

  function computeAward(height: number, runCoins: number, bonusCoins: number): any {
    var rawH = Math.max(0, Math.floor(Number(height) || 0));
    var rawC = Math.max(0, Math.floor(Number(runCoins) || 0));
    var rawB = Math.max(0, Math.floor(Number(bonusCoins) || 0));
    var h = Math.min(rawH, RUN_HEIGHT_MAX);
    var c = Math.min(rawC, RUN_COINS_MAX);
    var b = Math.min(rawB, RUN_BONUS_MAX);
    var heightPay = h >= HEIGHT_AWARD_MIN ? Math.floor(h / 25) : 0;
    var limited = "";
    if (rawH > RUN_HEIGHT_MAX) limited = "HEIGHT_CAP";
    else if (rawC > RUN_COINS_MAX) limited = "COINS_CAP";
    else if (rawB > RUN_BONUS_MAX) limited = "BONUS_CAP";
    else if (h < HEIGHT_AWARD_MIN) limited = "HEIGHT_MIN";
    var awarded = heightPay + c + b;
    return { want: awarded, awarded: awarded, limited: limited };
  }

  function pendingBuyKeys(): any {
    var out: any = {};
    var buys = getPendingBuys();
    for (var i = 0; i < buys.length; i++) if (buys[i] && buys[i].key) out[buys[i].key] = 1;
    return out;
  }

  function readInitData(): string {
    try {
      var w: any = typeof window !== "undefined" ? window : null;
      var d = w && w.Telegram && w.Telegram.WebApp && w.Telegram.WebApp.initData;
      if (typeof d === "string" && d) return d;
    } catch (_e) {}
    return "";
  }

  /* Once per session. 503 / 401 / 409 / network: stay on the guest profile, do not loop. */
  /* index.staging.html loads the Telegram SDK async and exposes window.__tgReady. */
  function waitTelegramSdk(): Promise<any> {
    try {
      var w: any = typeof window !== "undefined" ? window : null;
      if (w && w.__tgReady && typeof w.__tgReady.then === "function") return w.__tgReady;
    } catch (_e) {}
    return Promise.resolve(null);
  }

  function tryTelegramAuth(token: string): Promise<any> {
    if (isLocked()) return Promise.resolve(null);
    if (P.tgPending) return P.tgPending;
    if (P.tgTried) return Promise.resolve(null);
    var run = function () { return tryTelegramAuthNow(token); };
    P.tgPending = waitTelegramSdk().then(run, run).then(function (r: any) { P.tgPending = null; return r; }, function (e: any) { P.tgPending = null; throw e; });
    return P.tgPending;
  }

  function tryTelegramAuthNow(token: string): Promise<any> {
    if (P.tgTried || isLocked()) return Promise.resolve(null);
    var initData = readInitData();
    if (!initData || !token) return Promise.resolve(null);
    P.tgTried = true;
    return telegramAuth(initData, token);
  }

  function telegramAuth(initData: string, token: string) {
    return req("POST", "/api/auth/telegram", { initData: initData }, token).then(function (res: any) {
      if (!res.ok || !res.data || !res.data.ok || !res.data.profile || !res.data.token) return null;
      setToken(res.data.token);
      lsSet(LOCK_KEY, "");
      P.st = "ready";
      applyProfile(res.data.profile);
      if (P.api && P.api.sessionOk) P.api.sessionOk();
      if (res.data.merged && P.api && P.api.say) P.api.say(t('profile.merged'));
      return res.data;
    });
  }

  function adoptCookieSession(res: any) {
    if (!res || !res.ok || !res.data || !res.data.ok || !res.data.profile) return null;
    setCookieSession(true);
    dropToken(getToken());
    lsSet(LOCK_KEY, "");
    P.st = "ready";
    applyProfile(res.data.profile);
    if (P.api && P.api.sessionOk) P.api.sessionOk();
    if (res.data.merged && P.api && P.api.say) P.api.say(t('profile.merged'));
    return res.data;
  }

  function widgetAuth(token: string) {
    var payload = readWidgetAuthFromUrl();
    if (!payload) return Promise.resolve(null);
    return req("POST", "/api/auth/telegram-widget", payload, token || "").then(function (res: any) {
      cleanWidgetUrl();
      var adopted = adoptCookieSession(res);
      if (!adopted && P.api && P.api.say) {
        var err = res && res.data && res.data.error;
        P.api.say(err === "TELEGRAM_AUTH_UNAVAILABLE" ? t('profile.login_unavailable') : t('profile.login_failed'));
      }
      return adopted;
    }, function () {
      cleanWidgetUrl();
      if (P.api && P.api.say) P.api.say(t('profile.login_failed'));
      return null;
    });
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
    var opts: any = {
      method: method,
      headers: headers,
      cache: "no-store",
      mode: sameOrig ? "same-origin" : "cors",
      credentials: "include"
    };
    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
      opts.body = JSON.stringify(body);
    }
    if (ctrl) opts.signal = ctrl.signal;
    return fetch(base + path, opts).then(function (r: any) {
      clearTimeout(to);
      return r.json().catch(function () { return null; }).then(function (data: any) {
        if (replaced(r.status, data) || (r.status === 401 && data && data.error === "UNAUTHORIZED"
          && token && P.profile && P.profile.telegramId)) {
          noteReplaced(token || "", data.profile);
        }
        return { status: r.status, ok: !!r.ok, data: data };
      });
    }).catch(function () {
      clearTimeout(to);
      return { status: 0, ok: false, data: null };
    });
  }

  function isLocked(): boolean { return P.st === "locked"; }

  function replaced(status: number, data: any): boolean {
    return !!data && ((status === 409 && data.error === "DEVICE_REPLACED")
      || (status === 401 && data.error === "SESSION_REPLACED"));
  }

  function noteReplaced(usedTok: string, profile?: any) {
    if (usedTok && usedTok !== getToken()) return;
    var wasLocked = isLocked();
    P.st = "locked";
    lsSet(LOCK_KEY, "1");
    if (P.retryTimer) { clearTimeout(P.retryTimer); P.retryTimer = 0; }
    var preserved = profile || P.profile || readJson(CACHE_KEY, null);
    if (preserved) applyProfile(preserved);
    if (!wasLocked && P.api && P.api.sessionReplaced) P.api.sessionReplaced();
  }

  P.serverSaysReplaced = function () {
    noteReplaced(getToken());
    return true;
  };

  P.takeOver = function () {
    if (!isLocked() || P.takingOver) return Promise.resolve(null);
    P.takingOver = true;
    return enqueue(function () {
      return waitTelegramSdk().then(function () {
        var initData = readInitData();
        if (!initData) {
          if (P.api && P.api.say) P.api.say(t('kick.open_telegram'));
          return null;
        }
        return telegramAuth(initData, getToken()).then(function (auth: any) {
          if (!auth) {
            if (P.api && P.api.say) P.api.say(t('kick.retry'));
            return null;
          }
          return flushAll(false);
        });
      });
    }).finally(function () { P.takingOver = false; });
  };
  /* Coming back to the app (a suspended phone Mini App): ask the server once whether this login is still the active one.
     A replaced login returns a replacement error and shows the banner, instead of staying silent until the next request. */
  P.recheck = function () {
    if (!P.live || isLocked()) return;
    var tok = getToken();
    var nowMs = Date.now();
    if (!hasSession() || nowMs - (P.lastCheck || 0) < 3000) return;
    P.lastCheck = nowMs;
    req("GET", "/api/profile", undefined, tok);
  };
  /* Presence: while a session is live and the page is visible, a heartbeat every 25 s keeps last_seen_at / "online" fresh on the server.
     A replaced login returns a replacement error, so the first device also finds out here (banner through req). Hiding or closing the page
     sends an exit beacon (fetch keepalive); the next heartbeat makes the player online again. */
  var BEAT_MS = 25000;
  function tgPlatform() {
    try { var w: any = window; return w.Telegram && w.Telegram.WebApp && w.Telegram.WebApp.platform ? String(w.Telegram.WebApp.platform).slice(0, 16) : "web"; } catch (_e) { return "web"; }
  }
  P.beat = function () {
    if (!P.live || isLocked()) return;
    var tok = getToken();
    if (!hasSession()) return;
    if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
    req("POST", "/api/profile/seen", { v: "0.6rc", p: tgPlatform() }, tok);
  };
  P.exit = function () {
    if (!P.live || isLocked()) return;
    var tok = getToken();
    var base = apiOrigin();
    if (!hasSession() || !base || typeof fetch === "undefined") return;
    try {
      var headers: any = { "Content-Type": "application/json" };
      if (tok) headers["Authorization"] = "Bearer " + tok;
      fetch(base + "/api/profile/seen", {
        method: "POST", keepalive: true, cache: "no-store", credentials: "include",
        headers: headers,
        body: JSON.stringify({ exit: true }),
      }).catch(function () {});
    } catch (_eX) {}
  };
  try {
    if (typeof document !== "undefined" && document.addEventListener) {
      document.addEventListener("visibilitychange", function () {
        if (document.visibilityState === "visible") { P.recheck(); P.beat(); }
        else P.exit();
      });
      window.addEventListener("pagehide", function () { P.exit(); });
      setInterval(P.beat, BEAT_MS);
    }
  } catch (_eV) {}

  function applyProfile(prof: any, wRef?: any, awarded?: number, limited?: string) {
    if (!prof) return;
    P.profile = prof;
    P.live = true;
    writeJson(CACHE_KEY, prof);
    pruneConfirmedBuys(prof);
    var effectiveCoins = Math.max(0, (prof.coins || 0) - pendingSpend()) + queuedEst();
    if (P.api && P.api.apply) P.api.apply(prof, wRef, awarded, effectiveCoins, limited);
  }

  function handleStatus(res: any): boolean {
    if (isLocked() && (!res.ok || !res.data || !res.data.ok)) return false;
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
    if (isLocked() || typeof setTimeout === "undefined") return;
    if (P.retryTimer) { clearTimeout(P.retryTimer); P.retryTimer = 0; }
    var d = Math.max(250, delayMs);
    P.retryTimer = setTimeout(function () {
      P.retryTimer = 0;
      P.flush();
    }, d);
  }

  function localCampaign() {
    var s = P.api && P.api.save ? P.api.save() : null;
    var mapBest = (s && s.mapBest && typeof s.mapBest === "object") ? s.mapBest : {};
    var open: any = {};
    var owned = (s && s.owned && typeof s.owned === "object") ? s.owned : {};
    for (var k in owned) if (owned[k] && String(k).indexOf("map:") === 0) open[k] = 1;
    return { mapBest: mapBest, open: open };
  }
  function syncCampaign(token: string, fallback: any, bodySnap?: any) {
    var body = bodySnap || localCampaign();
    return req("POST", "/api/profile/campaign", body, token).then(function (res: any) {
      if (isLocked()) return null;
      if (!handleStatus(res) || !res.data || !res.data.profile) {
        if (fallback) { P.st = "ready"; applyProfile(fallback); }
        return fallback;
      }
      P.st = "ready";
      applyProfile(res.data.profile);
      return res.data.profile;
    });
  }
  function syncMigrate(token: string, prof: any) {
    if (isLocked()) return Promise.resolve(null);
    var s = P.api && P.api.save ? P.api.save() : null;
    var purchases = (s && s.owned && typeof s.owned === "object") ? s.owned : {};
    var best = s && typeof s.best === "number" ? Math.max(0, Math.floor(s.best)) : 0;
    var migrated = !prof || prof.migratedAt;
    var step = migrated
      ? Promise.resolve(prof)
      : req("POST", "/api/profile/migrate", { purchases: purchases, best: best }, token).then(function (res: any) {
        if (!handleStatus(res)) return null;
        return res.data.profile;
      });
    return step.then(function (ready: any) {
      if (!ready || isLocked()) return null;
      return syncCampaign(token, ready);
    });
  }

  function createGuest() {
    /* The save at the moment the request leaves. A newer save means this guest
       belongs to a wallet we already discarded, so its token must not come back. */
    var stamp = lsGet("hoppak_save");
    return req("POST", "/api/profile/guest").then(function (res: any) {
      if (!handleStatus(res)) return null;
      if (lsGet("hoppak_save") !== stamp) return null;
      if (res.data.token) setToken(res.data.token);
      return { token: res.data.token || getToken(), profile: res.data.profile };
    });
  }
  function ensureProfile(deferMigration = false) {
    if (isLocked()) return Promise.resolve(null);
    var base = apiOrigin();
    if (!base || typeof fetch === "undefined") {
      P.st = "offline";
      return Promise.resolve(null);
    }
    P.st = "syncing";
    var tok = getToken();
    var finish = function (token: string, prof: any) {
      return deferMigration ? Promise.resolve(prof) : syncMigrate(token, prof);
    };
    if (tok) {
      return req("GET", "/api/profile", undefined, tok).then(function (res: any) {
        if (isLocked()) return null;
        if (replaced(res.status, res.data) || res.status === 401) {
          var newer = getToken();
          if (newer && newer !== tok && !P.adopted) {
            /* Another tab of this browser logged in again meanwhile: use its token, don't make a second guest. */
            P.adopted = true;
            return ensureProfile(deferMigration);
          }
          if (replaced(res.status, res.data)) return null;
          var cached = P.profile || readJson(CACHE_KEY, null);
          if (cached && cached.telegramId) {
            noteReplaced(tok, cached);
            return null;
          }
          dropToken(tok);
          return createGuest().then(function (made: any) {
            if (!made) return null;
            return finish(made.token, made.profile);
          });
        }
        if (!handleStatus(res)) return null;
        return finish(tok, res.data.profile);
      });
    }
    if (isPlainBrowser()) {
      return req("GET", "/api/profile").then(function (res: any) {
        if (isLocked()) return null;
        if (res.ok && res.data && res.data.ok && res.data.profile) {
          setCookieSession(true);
          dropToken(getToken());
          return finish("", res.data.profile);
        }
        setCookieSession(false);
        return createGuest().then(function (made: any) {
          if (!made) return null;
          return finish(made.token, made.profile);
        });
      });
    }
    return createGuest().then(function (made: any) {
      if (!made) return null;
      return finish(made.token, made.profile);
    });
  }

  function syncRecords(tok: string): Promise<void> {
    if (isLocked() || (!tok && !hasCookieSession())) return Promise.resolve();
    return req("POST", "/api/profile/campaign", localCampaign(), tok).then(function (res: any) {
      if (isLocked()) return;
      if (res.status === 404 || res.status === 405 || res.status === 501) return;
      if (!handleStatus(res) || !res.data || !res.data.profile) return;
      applyProfile(res.data.profile);
    }, function () { return; });
  }
  function flushBuysOnce(tok: string): Promise<void> {
    if (isLocked() || P.buySupported === false) return Promise.resolve();
    var buys = getPendingBuys();
    if (!buys.length || (!tok && !hasCookieSession())) return Promise.resolve();
    var item = buys[0];
    return req("POST", "/api/profile/buy", { key: item.key }, tok).then(function (res: any) {
      if (isLocked() || replaced(res.status, res.data)) return;
      if (res.status === 404 || res.status === 405 || res.status === 501) {
        P.buySupported = false;
        return;
      }
      if (res.status === 401) {
        dropToken(tok);
        return;
      }
      if (res.status === 400) {
        // INVALID_ITEM or INSUFFICIENT_COINS — drop the optimistic buy and put the server wallet back.
        var cur = getPendingBuys().filter(function (x: any) { return x && x.key !== item.key; });
        setPendingBuys(cur);
        var rolled = P.profile;
        if (res.data && typeof res.data.coins === "number") {
          rolled = Object.assign({}, P.profile || {}, { coins: Math.max(0, Math.floor(res.data.coins)) });
          if (!rolled.purchases) rolled.purchases = {};
        }
        if (rolled) applyProfile(rolled);
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

  var runRefs: any = {};
  var startInflight: any = {};
  var startDone: any = {};
  function postStart(id: string, map: string, hero: number, tok: string) {
    return req("POST", "/api/run/start", { runId: id, map: map || "", hero: hero == null ? 0 : hero }, tok).then(function (res: any) {
      if (res && res.ok && res.data && res.data.ok) startDone[id] = 1;
      return res;
    });
  }
  function markStarted(runId: string) {
    startDone[runId] = 1;
    var q = getRunQueue();
    var changed = false;
    for (var i = 0; i < q.length; i++) if (q[i] && q[i].runId === runId && !q[i].started) { q[i].started = 1; changed = true; }
    if (changed) setRunQueue(q);
  }
  /** Start must land before finish, including after a reload. A 404 means an old server without the route. */
  function ensureStart(head: any, tok: string) {
    if (!head || !head.runId) return Promise.resolve("nostart");
    if (head.started) startDone[head.runId] = 1;
    if (startDone[head.runId]) return Promise.resolve("ok");
    var pending = startInflight[head.runId] || Promise.resolve(null);
    return pending.then(function (res: any) {
      if (startDone[head.runId]) { markStarted(head.runId); return "ok"; }
      if (res && (res.status === 404 || res.status === 405 || res.status === 501)) return "skip";
      if (res && res.status === 401) return "auth";
      if (isLocked()) return "locked";
      if (!tok && !hasCookieSession()) return "later";
      return postStart(head.runId, head.map || "", head.hero, tok).then(function (again: any) {
        if (startDone[head.runId]) { markStarted(head.runId); return "ok"; }
        if (again && (again.status === 404 || again.status === 405 || again.status === 501)) return "skip";
        if (again && again.status === 401) return "auth";
        return "later";
      });
    });
  }
  function worldOf(head: any) {
    if (!head) return null;
    return head._wRef || runRefs[head.runId] || null;
  }
  function markRun(head: any, code: string) {
    var w = worldOf(head);
    if (w) w.limited = code;
  }
  function markQueued(code: string) {
    var q = getRunQueue();
    for (var i = 0; i < q.length; i++) markRun(q[i], code);
  }

  function flushRunsStep(tok: string, authRetried?: boolean): Promise<any> {
    var q = getRunQueue();
    if (!q.length) return Promise.resolve(null);
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
    if (head.cause) body.cause = head.cause;
    if (head.hero != null) body.hero = head.hero;

    var start = isLocked() ? Promise.resolve("locked") : ensureStart(head, tok);
    return start.then(function (started: string) {
      if (started === "later" && !isLocked()) {
        markRun(head, "OFFLINE");
        var waitS = P.backoffMs;
        P.backoffMs = Math.min(60000, P.backoffMs * 2);
        scheduleRetry(waitS);
        return null;
      }
      return req("POST", "/api/run/finish", body, tok);
    }).then(function (res: any) {
      if (!res || replaced(res.status, res.data)) return null;
      if (res.status === 401) {
        if (isLocked()) return null;
        dropToken(tok);
        if (!authRetried) {
          return ensureProfile().then(function () {
            var nt = getToken();
            return (nt || hasCookieSession()) ? flushRunsStep(nt, true) : null;
          });
        }
        return null;
      }
      if (res.status === 429 || (res.data && res.data.error === "RATE_LIMIT")) {
        markRun(head, "FAST");
        scheduleRetry(P.backoffMs);
        return null;
      }
      if (res.status === 400) {
        var dropped = getRunQueue().filter(function (x: any) { return x && x.runId !== head.runId; });
        setRunQueue(dropped);
        if (P.profile) applyProfile(P.profile, worldOf(head), 0, "REJECTED");
        else markRun(head, "REJECTED");
        if (head && head.runId) delete runRefs[head.runId];
        return dropped.length ? flushRunsStep(tok, authRetried) : null;
      }
      if (isLocked() && (!res.ok || !res.data || !res.data.ok)) return null;
      if (!handleStatus(res)) {
        markRun(head, "OFFLINE");
        var wait = P.backoffMs;
        P.backoffMs = Math.min(60000, P.backoffMs * 2);
        scheduleRetry(wait);
        return null;
      }
      P.backoffMs = 5000;
      var curQ = getRunQueue();
      if (curQ.length && curQ[0].runId === head.runId) curQ.shift();
      else curQ = curQ.filter(function (x: any) { return x && x.runId !== head.runId; });
      setRunQueue(curQ);
      if (!isLocked()) P.st = "ready";
      var done = worldOf(head);
      if (head && head.runId) delete runRefs[head.runId];
      applyProfile(res.data.profile, done, res.data.awarded, res.data.limited || "");
      if (curQ.length) return flushRunsStep(tok, authRetried);
      return res.data;
    });
  }

  function flushAll(allowInit: boolean) {
    if (isLocked()) return hasSession() ? flushRunsStep(getToken(), true) : Promise.resolve(null);
    var base = apiOrigin();
    if (!base || typeof fetch === "undefined") {
      P.st = "offline";
      return Promise.resolve(null);
    }
    var tok = getToken();
    var ready = hasSession() ? Promise.resolve(tok) : (allowInit ? ensureProfile().then(function () { return getToken(); }) : Promise.resolve(""));
    return ready.then(function (t: string) {
      if (!t && !hasCookieSession()) {
        if (getRunQueue().length || getPendingBuys().length) {
          markQueued("OFFLINE");
          var wait = P.backoffMs;
          P.backoffMs = Math.min(60000, P.backoffMs * 2);
          scheduleRetry(wait);
        }
        return null;
      }
      /* Records land before a queued map purchase, so the goal check sees this device's best. */
      return syncRecords(t).then(function () {
        return flushBuysOnce(t).then(function () {
          return flushRunsStep(t);
        });
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
    /* Visible before the queued ensureProfile runs, so a waiter does not treat "idle" as ready. */
    if (apiOrigin() && !isLocked()) P.st = "syncing";
    if (!P.onlineBound && typeof window !== "undefined" && window.addEventListener) {
      P.onlineBound = true;
      window.addEventListener("online", function () {
        P.backoffMs = 5000;
        P.flush();
      });
      window.addEventListener("storage", function (event) {
        if (event.key !== TOKEN_KEY || !event.newValue || !isLocked() || lsGet(LOCK_KEY)) return;
        enqueue(function () {
          if (!isLocked() || lsGet(LOCK_KEY)) return;
          var token = getToken();
          return req("GET", "/api/profile", undefined, token).then(function (res: any) {
            if (!res.ok || !res.data || !res.data.profile || getToken() !== token) return;
            P.st = "ready";
            applyProfile(res.data.profile);
            if (P.api && P.api.sessionOk) P.api.sessionOk();
          });
        });
      });
    }
    return enqueue(function () {
      if (getToken() && lsGet(LOCK_KEY)) noteReplaced(getToken());
      if (isLocked()) return flushAll(false);
      var deferMigration = !!readInitData();
      var campSnap: any = null;
      try {
        campSnap = localCampaign();
      } catch (_eSnap) {}
      return ensureProfile(deferMigration).then(function (prof: any) {
        if (isLocked()) return flushAll(false);
        if (!prof) {
          var cached = readJson(CACHE_KEY, null);
          if (cached) P.profile = cached;
          if (getRunQueue().length || getPendingBuys().length) {
            scheduleRetry(P.backoffMs);
          }
          return null;
        }
        return flushAll(false).then(function () {
          if (isLocked()) return null;
          var afterAuth = function (auth: any) {
            var tok = getToken();
            if (auth && auth.merged) return syncCampaign(tok, auth.profile || P.profile, campSnap);
            return syncMigrate(tok, (auth && auth.profile) || P.profile || prof);
          };
          if (isPlainBrowser() && readWidgetAuthFromUrl()) {
            return widgetAuth(getToken()).then(afterAuth);
          }
          if (prof.telegramId || hasCookieSession()) return syncMigrate(getToken(), P.profile || prof);
          return tryTelegramAuth(getToken()).then(afterAuth);
        });
      });
    });
  };

  P.beginRun = function (map: string, hero: number) {
    if (isLocked()) return "";
    var id = makeRunId();
    var tok = getToken();
    if (tok || hasCookieSession()) startInflight[id] = postStart(id, map || "", hero, tok);
    return id;
  };

  P.finishRun = function (height: number, runCoins: number, bonusCoins: number, worldRef?: any, meta?: any) {
    var h = Math.max(0, Math.floor(Number(height) || 0));
    var c = Math.max(0, Math.floor(Number(runCoins) || 0));
    var b = Math.max(0, Math.floor(Number(bonusCoins) || 0));
    var pre = meta && typeof meta.awarded === "number" ? Math.max(0, Math.floor(meta.awarded)) : computeAward(h, c, b).awarded;
    var item: any = {
      runId: (meta && meta.runId) ? meta.runId : "",
      hero: meta && meta.hero != null ? meta.hero : 0,
      height: h,
      runCoins: c,
      bonusCoins: b,
      mode: (meta && meta.mode) || "solo",
      map: (meta && meta.map) || "",
      ver: (meta && meta.ver) || "",
      cause: (meta && meta.cause) || "",
      estAward: pre,
      createdAt: Date.now()
    };
    var q = getRunQueue();
    q.push(item);
    setRunQueue(q);
    /* Attach transient ref only on in-memory handoff for results screen coin roll-up */
    return enqueue(function () {
      if (worldRef) runRefs[item.runId] = worldRef;
      return flushAll(true);
    });
  };

  P.buy = function (key: string, price: number) {
    if (!key || isLocked()) return Promise.resolve(null);
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
      var ready = hasSession() ? Promise.resolve(tok) : ensureProfile().then(function () { return getToken(); });
      return ready.then(function (t: string) {
        if (!t && !hasCookieSession()) return null;
        return flushBuysOnce(t);
      });
    });
  };

  P.flush = function () {
    return enqueue(function () { return flushAll(true); });
  };

  P.getToken = getToken;
  P.apiOrigin = apiOrigin;
  P.cachedCoins = function () {
    var cached = hasSession() && readJson(CACHE_KEY, null);
    return cached && typeof cached.coins === "number" ? Math.max(0, cached.coins) : 0;
  };
  P.computeAward = computeAward;
  P.noteAward = function () {};
  P.pendingBuyKeys = pendingBuyKeys;
  P.getState = function () {
    var prof = P.profile;
    return {
      st: P.st,
      profile: prof,
      tokenPresent: !!getToken() || hasCookieSession(),
      queueLen: getRunQueue().length,
      pendingBuysLen: getPendingBuys().length,
      pendingSpend: pendingSpend(),
      queuedEst: queuedEst(),
      buySupported: P.buySupported,
      apiOrigin: apiOrigin(),
      tgTried: !!P.tgTried,
      telegramId: prof && prof.telegramId ? String(prof.telegramId) : "",
      cookieSession: hasCookieSession(),
      plainBrowser: isPlainBrowser()
    };
  };
  P.isPlainBrowser = isPlainBrowser;
  P.hasCookieSession = hasCookieSession;
  P.startTelegramWebLogin = function () {
    if (!isPlainBrowser() || isLocked()) return;
    if (P.tgWebStarting) return;
    P.tgWebStarting = true;
    try {
      if ((window as any).sessionStorage) (window as any).sessionStorage.setItem("hoppak_tg_return", appBasePath());
    } catch (_e) {}
    req("GET", "/api/auth/telegram-login").then(function (res: any) {
      if (!res.ok || !res.data || !res.data.botId) {
        P.tgWebStarting = false;
        if (P.api && P.api.say) P.api.say(t('profile.login_unavailable'));
        return;
      }
      var origin = "";
      try { origin = String(window.location.origin || ""); } catch (_e1) {}
      var url = "https://oauth.telegram.org/auth"
        + "?bot_id=" + encodeURIComponent(String(res.data.botId))
        + "&origin=" + encodeURIComponent(origin)
        + "&return_to=" + encodeURIComponent(widgetCallbackUrl())
        + "&request_access=write";
      (window as any).location.href = url;
    }, function () {
      P.tgWebStarting = false;
      if (P.api && P.api.say) P.api.say(t('profile.login_failed'));
    });
  };
  P.logoutWeb = function () {
    if (!isPlainBrowser() || isLocked()) return Promise.resolve(null);
    return enqueue(function () {
      return req("POST", "/api/auth/logout").then(function () {
        setCookieSession(false);
        dropToken(getToken());
        P.live = false;
        return createGuest().then(function (made: any) {
          if (!made) return null;
          P.st = "ready";
          applyProfile(made.profile);
          return made;
        });
      }, function () {
        setCookieSession(false);
        dropToken(getToken());
        return null;
      });
    });
  };
  return P;
})();
