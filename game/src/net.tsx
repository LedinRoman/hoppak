
/* ---------------- Online multiplayer (net) ----------------
   Realtime rooms for up to 4 friends via the Хоппак server (server/, NestJS + ws).
   Protocol: server/src/protocol.ts. Everything online lives here; the shell only calls
   NET.* through small hooks (search "NET." in 04_shell.tsx and "w.net" / "p.remote" in 02_world.tsx).
   Model: every client simulates the same seeded map and only its own hero; remote heroes are
   drawn from server-relayed snapshots (20 Hz) with ~150 ms interpolation. Stomped mobs and
   deaths are relayed as events; the server decides when the round ends (everybody fell). */
/* Must match server PROTOCOL_VERSION in net @ 2e6bfc0 (hello { v, s }). */
var NET_PROTO = 1;
var NET_SEND_MS = 66; /* own state ~15 Hz */
var NET_DELAY_MS = 150; /* interpolation buffer */
var NET_GRACE_MS = 10000;
var NET_XS = [74, 22, 124, 48]; /* start x by slot (same as the bot squad) */
var NET_TAGS: any = { host: "ХОСТ", ready: "ГОТОВ", wait: "ЖДЁМ", off: "НЕТ СВЯЗИ" };

var NET: any = (function () {
  var N: any = {
    ws: null, st: "off", /* off | connecting | online | reconnecting | error | unsupported */
    room: null, you: -1, token: "", err: "", sub: "home", code: "", startInfo: null, results: null,
    off: 0, rtt: 0, pingT: 0, lastSend: 0, reconUntil: 0, reconTimer: 0, onOpen: null as any, probing: false,
    stats: { sent: 0, recv: 0, snaps: 0, startedAt: 0 },
    buf: {} as any, /* pid -> samples [{t,x,y,vx,vy,f,a,m,ps}] */
    events: [] as any[], api: null as any
  };
  function now() { return Date.now(); }
  function serverNow() { return now() + N.off; }
  /* Build-time origin, e.g. --define:HOP_SERVER="https://76-13-250-251.sslip.io".
     From it we derive wss://host/ws and https://host/api/health. */
  function builtinOrigin() {
    try { if (typeof HOP_SERVER !== "undefined" && HOP_SERVER) return String(HOP_SERVER).replace(/\/$/, ""); } catch (_e) {}
    return "";
  }
  function toWs(origin: string) {
    var o = String(origin || "").trim();
    if (!o) return "";
    if (o.indexOf("ws://") === 0 || o.indexOf("wss://") === 0) {
      return /\/ws\/?$/.test(o) ? o.replace(/\/$/, "") : o.replace(/\/$/, "") + "/ws";
    }
    if (o.indexOf("https://") === 0) return "wss://" + o.slice(8).replace(/\/$/, "") + "/ws";
    if (o.indexOf("http://") === 0) return "ws://" + o.slice(7).replace(/\/$/, "") + "/ws";
    return "";
  }
  function toHealth(wsUrl: string) {
    try {
      var s = String(wsUrl || "");
      if (s.indexOf("wss://") === 0) s = "https://" + s.slice(6);
      else if (s.indexOf("ws://") === 0) s = "http://" + s.slice(5);
      var u = new URL(s);
      var path = u.pathname || "";
      if (path.lastIndexOf("/ws") === path.length - 3) path = path.slice(0, -3);
      if (path.charAt(path.length - 1) === "/") path = path.slice(0, -1);
      u.pathname = path + "/api/health";
      u.search = ""; u.hash = "";
      return u.toString();
    } catch (_e) { return ""; }
  }
  function url() {
    var w: any = typeof window !== "undefined" ? window : null;
    if (!w) return "";
    try {
      var q = new URLSearchParams(w.location.search).get("server");
      if (q) return toWs(q);
      if (w.HOPPAK_SERVER) return toWs(w.HOPPAK_SERVER);
      var ls = w.localStorage && w.localStorage.getItem("hoppak.server");
      if (ls) return toWs(ls);
    } catch (_e) {}
    var built = builtinOrigin();
    if (built) return toWs(built);
    var pr = w.location && w.location.protocol;
    /* file:// (and anything that isn't http/https) has no same-host server. */
    if (pr !== "http:" && pr !== "https:") return "";
    return (pr === "https:" ? "wss://" : "ws://") + w.location.host + "/ws";
  }
  function store(k: string, v: any) { try { if (v == null) sessionStorage.removeItem(k); else sessionStorage.setItem(k, v); } catch (_e) {} }
  function load(k: string) { try { return sessionStorage.getItem(k); } catch (_e) { return null; } }
  function nick() {
    var s = ""; try { s = localStorage.getItem("hoppak.nick") || ""; } catch (_e) {}
    return s;
  }
  function cleanText(s: string, max: number) {
    s = String(s || "").toUpperCase();
    var out = "";
    for (var i = 0; i < s.length && out.length < max; i++) if (FONT[s[i]] || s[i] === " ") out += s[i];
    return out.trim();
  }
  function cleanNick(s: string) { return cleanText(s, 10); }
  function send(event: string, data: any) {
    if (!N.ws || N.ws.readyState !== 1) return false;
    N.ws.send(JSON.stringify({ event: event, data: data || {} }));
    N.stats.sent++;
    return true;
  }
  N.send = send;
  N.serverNow = serverNow;

  /* ---------- connection ---------- */
  function failLink(cb?: any) {
    N.st = "error"; N.err = "НЕТ СВЯЗИ";
    var f = cb || N.onOpen; N.onOpen = null; if (f) f(false);
  }
  function probeHealth(hu: string, cb: any) {
    if (!hu || typeof fetch === "undefined") { cb(false); return; }
    var ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
    var to = setTimeout(function () { try { if (ctrl) ctrl.abort(); } catch (_e) {} }, 5000);
    var done = false;
    function finish(ok: boolean) {
      if (done) return;
      done = true; clearTimeout(to); cb(!!ok);
    }
    var opts: any = { method: "GET", cache: "no-store", mode: "cors" };
    if (ctrl) opts.signal = ctrl.signal;
    fetch(hu, opts).then(function (r: any) { finish(!!r && r.ok); }).catch(function () { finish(false); });
  }
  function openSocket(u: string) {
    var ws: any;
    try { ws = new WebSocket(u); } catch (_e) { failLink(); return; }
    N.ws = ws;
    var opened = false;
    var to = setTimeout(function () { if (!opened) { try { ws.close(); } catch (_e) {} } }, 5000);
    ws.onopen = function () {
      opened = true; clearTimeout(to);
      /* Stay in connecting until hello confirms the protocol version.
         Old site builds at /v/<ver>/ share the same /ws; a mismatch must not crash. */
      if (N.helloTimer) clearTimeout(N.helloTimer);
      N.helloTimer = setTimeout(function () {
        N.helloTimer = 0;
        if (N.ws === ws && N.st !== "online" && N.st !== "unsupported") rejectVersion();
      }, 2000);
    };
    ws.onmessage = function (e: any) { N.stats.recv++; var m: any; try { m = JSON.parse(e.data); } catch (_e2) { return; } onMsg(m.event, m.data || {}); };
    ws.onclose = function () {
      clearTimeout(to);
      if (N.helloTimer) { clearTimeout(N.helloTimer); N.helloTimer = 0; }
      if (N.ws !== ws) return;
      N.ws = null;
      if (N.st === "unsupported") return;
      if (!opened && N.st !== "reconnecting") { failLink(); return; }
      if (N.room) startReconnect(); else if (N.st !== "error") N.st = "off";
    };
    ws.onerror = function () {};
  }
  N.connect = function (cb?: any) {
    if (N.ws && N.ws.readyState === 1) { if (cb) cb(true); return; }
    var u = url();
    if (!u || typeof WebSocket === "undefined") { failLink(cb); return; }
    if (N.ws && N.ws.readyState === 0) { N.onOpen = cb || N.onOpen; return; }
    if (N.probing) { N.onOpen = cb || N.onOpen; return; }
    N.st = N.st === "reconnecting" ? "reconnecting" : "connecting";
    N.onOpen = cb || null;
    N.probing = true;
    probeHealth(toHealth(u), function (ok: boolean) {
      N.probing = false;
      if (N.st !== "connecting" && N.st !== "reconnecting") return;
      if (!ok) { failLink(); return; }
      openSocket(u);
    });
  };
  function startReconnect() {
    if (N.st !== "reconnecting") { N.st = "reconnecting"; N.reconUntil = now() + NET_GRACE_MS; }
    if (N.reconTimer) return;
    N.reconTimer = setTimeout(function () {
      N.reconTimer = 0;
      if (N.st !== "reconnecting") return;
      if (now() > N.reconUntil) { giveUp("СВЯЗЬ ПОТЕРЯНА"); return; }
      N.connect();
      setTimeout(function () { if (N.st === "reconnecting" && !N.ws) startReconnect(); }, 1200);
    }, 800);
  }
  function rejectVersion() {
    if (N.helloTimer) { clearTimeout(N.helloTimer); N.helloTimer = 0; }
    N.st = "unsupported";
    N.err = "ОНЛАЙН НЕДОСТУПЕН В ЭТОЙ ВЕРСИИ";
    N.room = null;
    var ws = N.ws;
    N.ws = null;
    try { if (ws) ws.close(); } catch (_e) {}
    var f = N.onOpen; N.onOpen = null; if (f) f(false);
    if (N.api && N.api.phase() === "net") N.sub = "home";
  }
  function giveUp(msg: string) {
    N.st = "error"; N.err = msg; N.room = null; N.token = ""; store("hoppak.net.token", null);
    var w = N.api && N.api.world();
    if (w && w.net && w.phase === "play") { w.net = false; w.netLost = true; }
    if (N.api && N.api.phase() === "net") N.sub = "home";
  }
  function ping() {
    N.pingT = now();
    send("ping", { c: N.pingT });
  }
  /** Test/debug hook: drop the socket as if the network blinked. */
  N.dropSocket = function () { if (N.ws) { try { N.ws.close(); } catch (_e) {} } };

  function onMsg(ev: string, d: any) {
    if (ev === "pong") {
      var t = now(), rtt = t - d.c, off = d.s + rtt / 2 - t;
      if (!N.rtt || rtt < N.rtt * 1.5) N.off = N.rtt ? N.off * 0.7 + off * 0.3 : off;
      N.rtt = N.rtt ? N.rtt * 0.8 + rtt * 0.2 : rtt;
    } else if (ev === "hello") {
      if (N.helloTimer) { clearTimeout(N.helloTimer); N.helloTimer = 0; }
      if (d.v !== NET_PROTO) { rejectVersion(); return; }
      ping();
      var tok = N.token || load("hoppak.net.token");
      if (N.st === "reconnecting" && tok) send("resume", { token: tok });
      else { N.st = "online"; var f = N.onOpen; N.onOpen = null; if (f) f(true); }
      if (d.s && !N.rtt) N.off = d.s - now();
    } else if (ev === "room") {
      var wasRecon = N.st === "reconnecting";
      N.room = d; N.you = d.you; N.token = d.token; store("hoppak.net.token", d.token); N.st = "online";
      sessionFor(d.code);
      if (wasRecon) { var f = N.onOpen; N.onOpen = null; if (f) f(true); }
      if (N.api && N.api.phase() === "net" && N.sub !== "room") N.sub = "room";
    } else if (ev === "start") {
      N.startInfo = d; N.results = null; N.buf = {};
      var w0 = N.api && N.api.world();
      if (d.resumed && w0 && w0.net && w0.netRound === d.round) return; /* our run survived the blink */
      if (d.resumed) { /* page reloaded mid-run: sit this round out, the room continues */
        send("ev", { e: "dead", m: 0, why: "left" }); N.sub = "room"; return;
      }
      if (N.api) N.api.startNet(d);
    } else if (ev === "snap") {
      N.stats.snaps++;
      for (var i = 0; i < d.s.length; i++) {
        var a = d.s[i], pid = a[0];
        if (pid === N.you) continue;
        var b = N.buf[pid] || (N.buf[pid] = []);
        b.push({ t: d.ts, x: a[1], y: a[2], vx: a[3], vy: a[4], f: a[5], a: a[6], m: a[7], ps: a[8] });
        if (b.length > 40) b.splice(0, b.length - 40);
      }
    } else if (ev === "ev") {
      N.events.push(d);
    } else if (ev === "results") {
      N.results = d;
      noteResults(d);
    } else if (ev === "err") {
      N.err = d.msg || d.code;
      if (d.code === "NO_SESSION") giveUp("КОМНАТА ЗАКРЫТА");
      if (N.api) N.api.say(cleanText(N.err, 24) || "ОШИБКА");
    }
  }

  /* ---------- room actions ---------- */
  function me() { return { name: cleanNick(nick()) || CHARS[N.api ? N.api.save().char : 0].name.toUpperCase(), kind: N.api ? N.api.save().char : 0 }; }
  N.create = function () { N.connect(function (ok: boolean) { if (ok) { var m = me(); send("create", m); } }); };
  N.join = function (code: string) { N.connect(function (ok: boolean) { if (ok) { var m: any = me(); m.code = code; send("join", m); } }); };
  N.leave = function () {
    if (N.room) send("leave", {});
    N.room = null; N.token = ""; N.startInfo = null; N.results = null; N.session = emptySession(""); store("hoppak.net.token", null);
    if (N.reconTimer) { clearTimeout(N.reconTimer); N.reconTimer = 0; }
    if (N.st === "reconnecting") N.st = N.ws ? "online" : "off";
  };
  N.inRoom = function () { return !!N.room; };
  N.isHost = function () { return !!N.room && N.room.host === N.you; };
  N.mePlayer = function () { if (!N.room) return null; for (var i = 0; i < N.room.players.length; i++) if (N.room.players[i].pid === N.you) return N.room.players[i]; return null; };
  /** Online rooms pin the logical width: the map generator depends on LW. */
  N.fixedLW = function () { return N.room ? N.room.lw : 0; };
  /* Evening score is client-side from `results` broadcasts (same session, same room).
     Server NET_LW is 180; width parity with solo (160) needs a one-line server change via Devops. */
  function emptySession(code: string) { return { code: code || "", rounds: [], wins: {}, best: {}, names: {} }; }
  N.session = emptySession("");
  function sessionFor(code: string) {
    if (!N.session || N.session.code !== (code || "")) N.session = emptySession(code);
  }
  function noteResults(d: any) {
    sessionFor(N.room ? N.room.code : (N.session && N.session.code) || "");
    if (!d || !d.ranking) return;
    for (var i = 0; i < N.session.rounds.length; i++) if (N.session.rounds[i].round === d.round) return;
    N.session.rounds.push({ round: d.round, ranking: d.ranking });
    for (var j = 0; j < d.ranking.length; j++) {
      var r = d.ranking[j];
      if (r.name) N.session.names[r.pid] = r.name;
      if (r.place === 1) N.session.wins[r.pid] = (N.session.wins[r.pid] || 0) + 1;
      var hm = r.m || 0;
      if (hm > (N.session.best[r.pid] || 0)) N.session.best[r.pid] = hm;
    }
  }
  N.drawEvening = function (ctx: any, x: number, y: number) {
    var S = N.session;
    if (!S || !S.rounds || !S.rounds.length) return y;
    var pids: any[] = [];
    for (var k in S.names) pids.push(k);
    if (!pids.length) {
      for (var k2 in S.wins) if (pids.indexOf(k2) < 0) pids.push(k2);
      for (var k3 in S.best) if (pids.indexOf(k3) < 0) pids.push(k3);
    }
    pids.sort(function (a: any, b: any) {
      var wa = S.wins[a] || 0, wb = S.wins[b] || 0;
      if (wb !== wa) return wb - wa;
      return (S.best[b] || 0) - (S.best[a] || 0);
    });
    var h = 13 + pids.length * 11;
    box(ctx, x, y, 152, h, C.navy, C.gold);
    drawText(ctx, "СЧЁТ ВЕЧЕРА · " + S.rounds.length + " РАУНД", LW / 2, y + 3, C.gold, 1, "center");
    for (var i2 = 0; i2 < pids.length; i2++) {
      var pid = pids[i2], nm = String(S.names[pid] || "ИГРОК").slice(0, 8);
      var lineY = y + 13 + i2 * 11;
      drawText(ctx, nm, x + 6, lineY, C.cream, 1, "left");
      drawText(ctx, (S.wins[pid] || 0) + "П  " + (S.best[pid] || 0) + "М", x + 146, lineY, C.cream, 1, "right");
    }
    return y + h + 6;
  };

  /* ---------- world integration ---------- */
  function lookOf(k: number) { return makeLook(k, "base", "none"); }
  function mobId(mo: any) { return mo.kind + ":" + Math.round(mo.baseX) + ":" + Math.round(mo.baseY); }
  /** Called by the shell right after createWorld(seed, "solo", ...) for an online start. */
  N.attachWorld = function (w: any, info: any) {
    w.net = true; w.mode = "squad"; w.netRound = info.round; w.netAt = info.at; w.netDead = false;
    var mine: any = null, others: any[] = [];
    for (var i = 0; i < info.players.length; i++) { if (info.players[i].pid === N.you) mine = info.players[i]; else others.push(info.players[i]); }
    var me0 = w.players[0];
    if (mine) { me0.x = NET_XS[mine.slot % 4]; me0.name = mine.name; me0.pid = mine.pid; }
    for (var k = 0; k < others.length; k++) {
      var o = others[k];
      var p: any = newPlayer(k + 1, o.kind, lookOf(o.kind), NET_XS[o.slot % 4], false);
      p.remote = true; p.pid = o.pid; p.name = o.name; p.react = 1; p.bias = 0;
      w.players.push(p);
    }
    N.lastSend = 0; N.events = []; N.buf = {};
    N.stats.startedAt = now();
  };
  /** True while waiting for the synchronized start moment (shell skips ticks). */
  N.waiting = function (w: any) { return !!(w && w.net && w.tick === 0 && serverNow() < w.netAt); };
  function flags(p: any) {
    return (p.abFx > 0 || p.teleFx > 10 ? 1 : 0) | (p.squash > 3 ? 2 : 0) | (p.domeT > 0 ? 4 : 0) | (p.shieldT > 0 ? 8 : 0) |
      (p.rocketT > 0 ? 16 : 0) | (p.wall ? 32 : 0) | (p.dashT > 0 ? 64 : 0) | (p.poundT > 0 ? 128 : 0) | (p.hookN > 0 ? 256 : 0) |
      (p.freezeT > 0 ? 512 : 0) | (p.magnetT > 0 ? 1024 : 0) | (p.wall < 0 ? 2048 : 0) |
      (p.shieldT > 0 && p.shieldT <= SHIELD_BLINK_T ? 4096 : 0) |
      /* v0.59: ninja wall ability on (8192) and its last-1.2 s blink (16384); old clients ignore both */
      (p.wallT > 0 ? 8192 : 0) | (p.wallT > 0 && p.wallT <= WALL_BLINK_T ? 16384 : 0);
  }
  function applyFlags(p: any, ps: number) {
    p.abFx = ps & 1 ? 5 : 0; p.squash = ps & 2 ? 4 : 0; p.domeT = ps & 4 ? 100 : 0;
    p.shieldT = ps & 8 ? (ps & 4096 ? 40 : 120) : 0;
    p.rocketT = ps & 16 ? 10 : 0; p.wall = ps & 32 ? (ps & 2048 ? -1 : 1) : 0; p.wallT = ps & 8192 ? (ps & 16384 ? 30 : 120) : (p.wall ? 10 : 0); p.dashT = ps & 64 ? 5 : 0;
    p.poundT = ps & 128 ? 5 : 0; p.hookN = 0; p.freezeT = ps & 512 ? 5 : 0; p.magnetT = ps & 1024 ? 100 : 0;
  }
  function lerpX(a: number, b: number, t: number) {
    var d = b - a; if (d > LW / 2) d -= LW; if (d < -LW / 2) d += LW;
    var x = a + d * t; if (x < -PW) x += LW; if (x > LW) x -= LW; return x;
  }
  function interp(p: any, b: any[], rt: number) {
    if (!b || !b.length) return;
    var s0 = b[0], s1: any = null;
    for (var i = 0; i < b.length; i++) { if (b[i].t <= rt) s0 = b[i]; else { s1 = b[i]; break; } }
    var x, y, vx = s0.vx, vy = s0.vy;
    if (s1 && s1.t > s0.t && s0.t <= rt) {
      var u = (rt - s0.t) / (s1.t - s0.t);
      x = lerpX(s0.x, s1.x, u); y = s0.y + (s1.y - s0.y) * u; vx = s0.vx + (s1.vx - s0.vx) * u; vy = s0.vy + (s1.vy - s0.vy) * u;
    } else if (!s1) { /* extrapolate a little (max 100 ms) using velocity in px/tick (50 ticks/s) */
      var dt = Math.min(0.1, Math.max(0, (rt - s0.t) / 1000)) * 50;
      x = lerpX(s0.x, s0.x + s0.vx * dt, 1); y = s0.y + s0.vy * dt;
    } else { x = s0.x; y = s0.y; }
    var last = b[b.length - 1];
    p.x = x; p.y = y; p.vx = vx; p.vy = vy; p.face = s0.f;
    p.maxH = Math.max(p.maxH, last.m);
    if (p.alive && !last.a) p.alive = false;
    applyFlags(p, s0.ps);
    var cy = p.y - LH * 0.42; if (cy < p.camY) p.camY = cy;
  }
  /** Per frame, after the local ticks: send own state, place remote heroes, apply relayed events, end the round. */
  N.frame = function (w: any) {
    if (!w || !w.net) return;
    var t = now(), me0 = w.players[0];
    if (t - N.pingT > 2000) ping();
    if (!w.netDead && t - N.lastSend >= NET_SEND_MS && w.tick > 0) {
      N.lastSend = t;
      send("st", { x: Math.round(me0.x * 10) / 10, y: Math.round(me0.y * 10) / 10, vx: Math.round(me0.vx * 100) / 100, vy: Math.round(me0.vy * 100) / 100, f: me0.face, a: me0.alive ? 1 : 0, m: Math.round(me0.maxH), ps: flags(me0), tk: w.tick });
    }
    if (!me0.alive && !w.netDead) {
      w.netDead = true;
      send("st", { x: me0.x, y: me0.y, vx: 0, vy: me0.vy, f: me0.face, a: 0, m: Math.round(me0.maxH), ps: 0, tk: w.tick });
      send("ev", { e: "dead", m: metersOf(me0), why: me0.why });
    }
    for (var bi = 0; bi < w.platforms.length; bi++) {
      var bp = w.platforms[bi];
      if (bp.netTell) { bp.netTell = 0; send("ev", { e: "brk", id: bp.seq }); }
    }
    for (var k = 0; k < w.monsters.length; k++) {
      var mo = w.monsters[k];
      if (!mo.alive && !mo.netSent) { mo.netSent = true; if (!mo.netRemote) send("ev", { e: "mob", id: mobId(mo) }); }
    }
    var rt = serverNow() - NET_DELAY_MS;
    for (var i = 1; i < w.players.length; i++) { var p = w.players[i]; if (p.remote) interp(p, N.buf[p.pid], rt); }
    while (N.events.length) {
      var e = N.events.shift(), rp = byPid(w, e.pid);
      if (e.e === "mob") {
        for (var j = 0; j < w.monsters.length; j++) {
          var m2 = w.monsters[j];
          if (m2.alive && mobId(m2) === e.id) { m2.alive = false; m2.squish = 10; m2.netRemote = true; m2.netSent = true; spawnParts(w, m2.x + m2.w / 2, m2.y + 4, 10, "#ffd070", 2.4, 0.15); }
        }
      } else if (e.e === "dead" && rp) {
        if (rp.alive) { rp.alive = false; rp.why = e.why || "fall"; spawnParts(w, rp.x + 6, rp.y + 8, 10, rp.look.hood, 2.6, 0.1); }
        rp.maxH = Math.max(rp.maxH, (e.m || 0) * PX_PER_M);
        toast(w, rp.name + " ВЫБЫЛ");
      } else if (e.e === "left" && rp) { rp.alive = false; rp.why = "left"; }
      else if (e.e === "brk" || e.e === "rst") applyPlatNet(w, e.id, e.e);
    }
    /* spectate the leader after falling */
    if (!me0.alive) {
      var best: any = null;
      for (var q = 1; q < w.players.length; q++) { var o = w.players[q]; if (o.alive && (!best || o.maxH > best.maxH)) best = o; }
      if (best) { w.specCam = w.specCam == null ? w.cameraY : w.specCam + (best.camY - w.specCam) * 0.15; w.cameraY = w.specCam; generateUntil(w, w.cameraY - 80); }
    }
    if (N.results && N.results.round === w.netRound && w.phase === "play") {
      var R = N.results.ranking;
      for (var r = 0; r < R.length; r++) { var pp = byPid(w, R[r].pid); if (pp) pp.maxH = Math.max(pp.maxH, R[r].m * PX_PER_M); }
      finish(w);
      for (var r2 = 0; r2 < R.length; r2++) { var p3 = byPid(w, R[r2].pid); if (p3) p3.place = R[r2].place; }
    }
  };
  function applyPlatNet(w: any, id: number, kind: string) {
    var idn = id | 0;
    if (idn < 0) return;
    var pl: any = null;
    for (var i = 0; i < w.platforms.length; i++) if (w.platforms[i].seq === idn) { pl = w.platforms[i]; break; }
    if (!pl) {
      if (!w.netBreaks) w.netBreaks = {};
      w.netBreaks[idn] = kind === "rst" ? "rst" : "brk";
      return;
    }
    if (pl.type !== "break") return;
    if (kind === "brk") {
      if (pl.broken) return;
      pl.broken = true;
      pl.breakT = 14;
      spawnParts(w, pl.x + pl.w / 2, pl.y + 2, 8, C.brk, 2, 0.2, 2);
    } else {
      pl.broken = false;
      pl.breakT = 0;
      pl.restoreT = 16;
      spawnParts(w, pl.x + pl.w / 2, pl.y, 6, C.brkRim, 1.4, -0.04, 1);
    }
  }
  function byPid(w: any, pid: number) {
    if (pid === N.you) return w.players[0];
    for (var i = 1; i < w.players.length; i++) if (w.players[i].pid === pid) return w.players[i];
    return null;
  }
  /** Countdown / connection overlay on top of the play screen. */
  N.overlay = function (api: any, w: any) {
    var ctx = api.ctx;
    if (w.tick === 0 && w.netAt) {
      var left = Math.max(0, w.netAt - serverNow());
      var n = Math.ceil(left / 500);
      box(ctx, LW / 2 - 30, LH / 2 - 24, 60, 40, C.navy, C.gold);
      drawText(ctx, n > 0 ? String(n) : "ВПЕРЁД", LW / 2, LH / 2 - 14, C.gold, n > 0 ? 3 : 1, "center");
    }
    if (N.st === "reconnecting") {
      box(ctx, LW / 2 - 60, 24, 120, 13, "#4a1020", C.red);
      drawText(ctx, "ПЕРЕПОДКЛЮЧАЕМСЯ...", LW / 2, 27, C.cream, 1, "center");
    } else if (!w.players[0].alive && w.phase === "play") {
      box(ctx, LW / 2 - 64, 24, 128, 13, C.navy, C.cream);
      drawText(ctx, "ЖДЁМ ОСТАЛЬНЫХ", LW / 2, 27, C.cream, 1, "center");
    }
  };

  /* ---------- online screens (shell phase "net") ---------- */
  N.open = function (api: any) {
    N.api = api; N.err = "";
    if (N.room) { N.sub = "room"; return; }
    N.sub = "home";
    N.connect(function (ok: boolean) { if (!ok) N.sub = "home"; });
  };
  N.bind = function (api: any) { N.api = api; };
  function statusLine() {
    if (N.st === "online") return { t: "СЕРВЕР НА СВЯЗИ", c: C.mint };
    if (N.st === "connecting") return { t: "ПОДКЛЮЧАЕМСЯ...", c: C.gold };
    if (N.st === "reconnecting") return { t: "ПЕРЕПОДКЛЮЧАЕМСЯ...", c: C.gold };
    if (N.st === "unsupported") return { t: N.err || "ОНЛАЙН НЕДОСТУПЕН В ЭТОЙ ВЕРСИИ", c: C.red, two: true };
    return { t: N.err || "НЕТ СВЯЗИ", c: C.red };
  }
  N.draw = function (api: any) {
    N.api = api;
    var ctx = api.ctx, x = api.colX(), sl = statusLine();
    api.bg();
    if (N.sub === "room" && N.room) return drawRoom(api, x);
    if (N.sub === "code") return drawCode(api, x);
    api.header("ОНЛАЙН С ДРУЗЬЯМИ", 1);
    drawText(ctx, "ДО 4 ИГРОКОВ НА ОДНОЙ КАРТЕ", LW / 2, 34, C.cream, 1, "center");
    if (sl.two) {
      box(ctx, x, 48, 152, 24, C.navy, sl.c);
      drawText(ctx, "ОНЛАЙН НЕДОСТУПЕН", LW / 2, 51, sl.c, 1, "center");
      drawText(ctx, "В ЭТОЙ ВЕРСИИ", LW / 2, 61, sl.c, 1, "center");
    } else {
      box(ctx, x, 48, 152, 13, C.navy, sl.c);
      drawText(ctx, sl.t, LW / 2, 51, sl.c, 1, "center");
    }
    var y = sl.two ? 82 : 72;
    api.btn("net:name", x, y, 152, 20, "#1a1430", "ИМЯ: " + (cleanNick(nick()) || CHARS[api.save().char].name.toUpperCase()), C.cream, 1, C.gold);
    y += 28;
    var ok = N.st === "online";
    api.btn("net:create", x, y, 152, 30, ok ? C.mint : "#3a3450", "СОЗДАТЬ КОМНАТУ", INK, 1);
    api.btn("net:enter", x, y + 36, 152, 30, ok ? C.gold : "#3a3450", "ВОЙТИ ПО КОДУ", INK, 1);
    if (!ok && N.st !== "connecting") api.btn("net:retry", x, y + 72, 72, 20, C.navy, "ЕЩЁ РАЗ");
    if (!ok && N.st !== "connecting") api.btn("net:bots", x + 80, y + 72, 72, 20, C.navy, "С БОТАМИ");
    api.btn("net:back", x + 26, LH - 34, 100, 22, C.navy, "НАЗАД");
  };
  function drawCode(api: any, x: number) {
    var ctx = api.ctx;
    api.header("КОД КОМНАТЫ", 1);
    for (var i = 0; i < 4; i++) {
      box(ctx, x + 14 + i * 32, 36, 26, 30, C.navy, i === N.code.length ? C.gold : C.cream);
      if (N.code[i]) drawText(ctx, N.code[i], x + 27 + i * 32, 44, C.cream, 2, "center");
    }
    var ky = 76, keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "<", "0", "OK"];
    for (var k = 0; k < 12; k++) {
      var cx = x + (k % 3) * 52, cy = ky + Math.floor(k / 3) * 34;
      var id = keys[k] === "<" ? "net:del" : keys[k] === "OK" ? "net:ok" : "net:k" + keys[k];
      api.btn(id, cx, cy, 48, 30, keys[k] === "OK" ? (N.code.length === 4 ? C.mint : "#3a3450") : "#1a1430", keys[k] === "OK" ? "ВОЙТИ" : keys[k], keys[k] === "OK" ? INK : C.cream, keys[k] === "OK" ? 1 : 2);
    }
    if (N.err) drawText(ctx, cleanText(N.err, 24), LW / 2, ky + 140, C.red, 1, "center");
    api.btn("net:home", x + 26, LH - 34, 100, 22, C.navy, "НАЗАД");
  }
  function drawRoom(api: any, x: number) {
    var ctx = api.ctx, R = N.room, host = N.isHost(), mine = N.mePlayer();
    box(ctx, x, 6, 152, 34, C.navy, C.gold);
    drawText(ctx, "КОМНАТА", LW / 2, 10, C.cream, 1, "center");
    drawText(ctx, R.code, LW / 2, 20, C.gold, 2, "center");
    drawText(ctx, "СКАЖИ КОД ДРУЗЬЯМ", LW / 2, 44, "#9a8ab8", 1, "center");
    var sorted = R.players.slice().sort(function (a: any, b: any) { return a.slot - b.slot; });
    for (var i = 0; i < 4; i++) {
      var y = 56 + i * 26, p = sorted[i];
      if (!p) {
        box(ctx, x, y, 152, 23, "#141030", "#3a3450");
        drawText(ctx, "СВОБОДНО", LW / 2, y + 8, "#5a4c82", 1, "center");
        continue;
      }
      var isMe = p.pid === N.you;
      box(ctx, x, y, 152, 23, isMe ? "#2a2050" : C.navy, isMe ? C.gold : C.cream);
      drawJumper(ctx, x + 6, y + 5, lookOf(p.kind), 1, "idle", (api.ui() + i * 50) % 170 < 6, true, 1);
      drawText(ctx, cleanNick(p.name) || "ИГРОК", x + 28, y + 3, C.cream, 1, "left");
      var tag = !p.on ? NET_TAGS.off : p.pid === R.host ? NET_TAGS.host : p.ready ? NET_TAGS.ready : NET_TAGS.wait;
      var tc = !p.on ? C.red : p.pid === R.host ? C.gold : p.ready ? C.mint : "#9a8ab8";
      drawText(ctx, tag + (isMe ? " · ТЫ" : ""), x + 28, y + 13, tc, 1, "left");
      drawText(ctx, CHARS[p.kind].abName, x + 148, y + 8, "#9a8ab8", 1, "right");
    }
    var my = 56 + 4 * 26 + 4;
    if (host) {
      api.btn("net:mprev", x, my, 20, 18, "#1a1430", "<", C.cream);
      api.btn("net:mnext", x + 132, my, 20, 18, "#1a1430", ">", C.cream);
    }
    box(ctx, x + 22, my, 108, 18, C.navy, C.cream);
    drawText(ctx, "КАРТА: " + mapInfo(R.map).name, LW / 2, my + 6, C.gold, 1, "center");
    api.btn("net:hero", x, my + 22, 152, 18, "#1a1430", "ГЕРОЙ: " + CHARS[api.save().char].name.toUpperCase() + " ▶", C.cream, 1, C.gold);
    var evY = my + 44;
    if (N.session && N.session.rounds && N.session.rounds.length) evY = N.drawEvening(ctx, x, evY);
    var by = Math.max(evY + 4, LH - 66);
    if (host) {
      var others = R.players.filter(function (q: any) { return q.pid !== R.host && q.on; });
      var allReady = others.every(function (q: any) { return q.ready; });
      var lab = R.players.length < 2 ? "НАЧАТЬ ОДНОМУ" : allReady ? "НАЧАТЬ" : "ЖДЁМ ГОТОВНОСТИ";
      api.btn("net:start", x, by, 152, 26, allReady ? C.mint : "#3a3450", lab, INK, 1);
    } else {
      var rd = mine && mine.ready;
      api.btn("net:ready", x, by, 152, 26, rd ? C.mint : C.gold, rd ? "ГОТОВ ✓" : "Я ГОТОВ", INK, 1);
    }
    if (N.st === "reconnecting") drawText(ctx, "ПЕРЕПОДКЛЮЧАЕМСЯ...", LW / 2, by - 10, C.gold, 1, "center");
    api.btn("net:leave", x + 26, LH - 34, 100, 22, C.navy, "ВЫЙТИ");
  }
  N.tap = function (id: string, api: any) {
    N.api = api;
    if (id === "net:menu") { api.setPhase("net"); N.open(api); return; }
    if (id === "net:back") { api.goMenu(); return; }
    if (id === "net:retry") { N.err = ""; N.connect(); return; }
    if (id === "net:bots") { api.bots(); return; }
    if (id === "net:name") {
      var cur = cleanNick(nick());
      var v = typeof window !== "undefined" && window.prompt ? window.prompt("Имя для друзей (по-русски, до 10 букв)", cur) : null;
      if (v != null) { var c = cleanNick(v); try { localStorage.setItem("hoppak.nick", c); } catch (_e) {} if (!c && v) api.say("ТОЛЬКО РУССКИЕ БУКВЫ"); }
      return;
    }
    if (id === "net:create") { if (N.st !== "online") { N.connect(); return; } N.create(); return; }
    if (id === "net:enter") { if (N.st !== "online") { N.connect(); return; } N.code = ""; N.err = ""; N.sub = "code"; return; }
    if (id === "net:home") { N.sub = "home"; N.err = ""; return; }
    if (id.indexOf("net:k") === 0) { if (N.code.length < 4) N.code += id.slice(5); N.err = ""; return; }
    if (id === "net:del") { N.code = N.code.slice(0, -1); return; }
    if (id === "net:ok") { if (N.code.length === 4) N.join(N.code); return; }
    if (id === "net:ready") { var m = N.mePlayer(); send("ready", { ready: !(m && m.ready) }); return; }
    if (id === "net:start") { send("start", {}); return; }
    if (id === "net:mprev" || id === "net:mnext") {
      var om = api.openMaps(), li = Math.max(0, om.indexOf(N.room.map));
      if (om.indexOf(N.room.map) < 0) om = om.concat([N.room.map]);
      send("map", { map: om[mod(li + (id === "net:mnext" ? 1 : -1), om.length)] }); return;
    }
    if (id === "net:hero") {
      var s = api.save(), k = s.char;
      for (var n = 1; n <= CHARS.length; n++) { var kk = mod(s.char + n, CHARS.length); if (api.heroOwned(kk)) { k = kk; break; } }
      s.char = k; api.saveNow(); send("hero", { kind: k }); return;
    }
    if (id === "net:leave") { N.leave(); N.sub = "home"; return; }
    if (id === "net:rematch") { api.setPhase("net"); N.sub = N.room ? "room" : "home"; return; }
  };
  /* resume a session after a page reload (iOS likes to reload backgrounded tabs) */
  N.tryResume = function (api: any) {
    N.api = api;
    if (!load("hoppak.net.token")) return;
    N.st = "reconnecting"; N.reconUntil = now() + NET_GRACE_MS;
    N.connect();
  };
  return N;
})();
