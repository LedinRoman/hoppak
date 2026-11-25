
/* ---------------- Player profile (guest token + server sync) ----------------
   Keeps local save working smoothly when offline or when the server has no DB (503).
   All logic lives here; 04_shell.tsx only calls PROFILE.init and PROFILE.finishRun. */

var PROFILE: any = (function () {
  var TOKEN_KEY = "hoppak_guest_token";
  var REQ_MS = 5000;
  var P: any = {
    st: "idle", /* idle | syncing | ready | offline | unavailable */
    profile: null as any,
    api: null as any,
    queue: null as any
  };

  function getToken(): string {
    try { return (typeof localStorage !== "undefined" && localStorage.getItem(TOKEN_KEY)) || ""; } catch (_e) { return ""; }
  }
  function setToken(t: string) {
    try {
      if (typeof localStorage === "undefined") return;
      if (t) localStorage.setItem(TOKEN_KEY, t);
      else localStorage.removeItem(TOKEN_KEY);
    } catch (_e) {}
  }

  function normalizeOrigin(raw: string): string {
    var o = String(raw || "").trim();
    if (!o) return "";
    if (o.indexOf("wss://") === 0) o = "https://" + o.slice(6);
    else if (o.indexOf("ws://") === 0) o = "http://" + o.slice(5);
    if (o.indexOf("https://") !== 0 && o.indexOf("http://") !== 0) return "";
    o = o.replace(/\/+$/, "");
    if (o.length > 3 && o.slice(-3) === "/ws") o = o.slice(0, -3);
    return o.replace(/\/+$/, "");
  }

  function apiOrigin(): string {
    var w: any = typeof window !== "undefined" ? window : null;
    if (!w) return "";
    try {
      var q = new URLSearchParams(w.location.search).get("server");
      if (q) { var qn = normalizeOrigin(q); if (qn) return qn; }
      if (w.HOPPAK_SERVER) { var wn = normalizeOrigin(w.HOPPAK_SERVER); if (wn) return wn; }
      var ls = w.localStorage && w.localStorage.getItem("hoppak.server");
      if (ls) { var ln = normalizeOrigin(ls); if (ln) return ln; }
    } catch (_e) {}
    try {
      if (typeof HOP_SERVER !== "undefined" && HOP_SERVER) {
        var bn = normalizeOrigin(String(HOP_SERVER));
        if (bn) return bn;
      }
    } catch (_e2) {}
    try {
      var pr = w.location && w.location.protocol;
      if (pr === "http:" || pr === "https:") return w.location.origin;
    } catch (_e3) {}
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
    var opts: any = { method: method, headers: headers, cache: "no-store", mode: "cors" };
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

  function handleStatus(res: any): boolean {
    if (res.status === 503 || (res.data && res.data.error === "PROFILE_UNAVAILABLE")) {
      P.st = "unavailable";
      return false;
    }
    if (!res.ok || !res.data || !res.data.ok) {
      if (res.status === 0) P.st = "offline";
      return false;
    }
    return true;
  }

  function syncMigrate(token: string, prof: any) {
    if (!prof || prof.migratedAt) {
      P.profile = prof;
      P.st = "ready";
      if (P.api && P.api.apply) P.api.apply(prof);
      return Promise.resolve(prof);
    }
    var s = P.api && P.api.save ? P.api.save() : null;
    var coins = s && typeof s.coins === "number" ? Math.max(0, Math.floor(s.coins)) : 0;
    var purchases = (s && s.owned && typeof s.owned === "object") ? s.owned : {};
    return req("POST", "/api/profile/migrate", { coins: coins, purchases: purchases }, token).then(function (res: any) {
      if (!handleStatus(res)) return null;
      P.profile = res.data.profile;
      P.st = "ready";
      if (P.api && P.api.apply) P.api.apply(res.data.profile);
      return res.data.profile;
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

  function createGuestAndMigrate() {
    return req("POST", "/api/profile/guest", {}).then(function (res: any) {
      if (!handleStatus(res)) return null;
      if (res.data.token) setToken(res.data.token);
      return syncMigrate(res.data.token || getToken(), res.data.profile);
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
    return enqueue(function () { return ensureProfile(); });
  };

  P.finishRun = function (height: number, runCoins: number, bonusCoins: number, worldRef?: any) {
    return enqueue(function () {
      var base = apiOrigin();
      if (!base || typeof fetch === "undefined") {
        P.st = "offline";
        return Promise.resolve(null);
      }
      var tok = getToken();
      var ready = tok ? Promise.resolve(tok) : ensureProfile().then(function () { return getToken(); });
      return ready.then(function (t: string) {
        if (!t) return null;
        return req("POST", "/api/run/finish", {
          height: Math.max(0, Math.floor(Number(height) || 0)),
          runCoins: Math.max(0, Math.floor(Number(runCoins) || 0)),
          bonusCoins: Math.max(0, Math.floor(Number(bonusCoins) || 0))
        }, t).then(function (res: any) {
          if (res.status === 401) {
            setToken("");
            return null;
          }
          if (!handleStatus(res)) return null;
          P.profile = res.data.profile;
          P.st = "ready";
          if (P.api && P.api.apply) P.api.apply(res.data.profile, worldRef, res.data.awarded);
          return res.data;
        });
      });
    });
  };

  P.getToken = getToken;
  return P;
})();
