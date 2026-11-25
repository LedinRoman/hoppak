
/* ---------------- Game shell: screens, input, loop ---------------- */
function startHoppak(canvas: HTMLCanvasElement): any {
  var raw = canvas.getContext("2d");
  var noop = function () {};
  if (!raw) return { destroy: noop };
  var ctx: Ctx = raw;
  var wrap = canvas.parentElement;
  var phase = "menu"; /* menu | shop | mp | lobby | join | play | results */
  var world: any = null;
  var save = loadSave();
  var mode = "solo";
  var room: any = null;
  var joinCode = "";
  var shopTab = "char";
  var flash = "", flashT = 0, flashPh = "";
  var tiltOn = false, tiltDenied = false, tiltAx = 0;
  var tiltAvail = typeof window.DeviceOrientationEvent !== "undefined";
  var autoPlay = false;
  var held: any = { left: false, right: false, kl: false, kr: false };
  var pointers: any = {};
  var acc = 0, lastT = 0, raf = 0, running = true, ui = 0;
  var hits: any[] = [];

  function resize() {
    var r = (wrap || canvas).getBoundingClientRect();
    LH = Math.max(240, Math.round(LW * (Math.max(1, r.height) / Math.max(1, r.width))));
    canvas.width = LW;
    canvas.height = LH;
    ctx.imageSmoothingEnabled = false;
  }
  function toLogic(cx: number, cy: number) {
    var r = canvas.getBoundingClientRect();
    return { x: ((cx - r.left) / r.width) * LW, y: ((cy - r.top) / r.height) * LH };
  }
  function lookNow() { return makeLook(save.char, save.color, save.hat); }
  function say(s: string) { flash = s; flashT = 90; flashPh = phase; }
  function addHit(id: string, x: number, y: number, w: number, h: number) { hits.push({ id: id, x: x, y: y, w: w, h: h }); }
  function hitAt(x: number, y: number) {
    for (var i = hits.length - 1; i >= 0; i--) { var h = hits[i]; if (x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h) return h.id; }
    return null;
  }
  function btn(id: string, x: number, y: number, w: number, h: number, fill: string, label: string, tcol?: string, sc?: number, border?: string) {
    addHit(id, x, y, w, h);
    box(ctx, x, y, w, h, fill, border || C.cream);
    var s = sc || 1;
    drawText(ctx, label, x + w / 2, y + Math.round((h - 7 * s) / 2), tcol || C.cream, s, "center");
  }
  function coinsLabel(x: number, y: number, n: number, align?: string) {
    var s = String(n), w = textWidth(s, 1) + 9;
    var x0 = align === "right" ? x - w : align === "center" ? x - w / 2 : x;
    drawCoin(ctx, x0, y, ui);
    drawText(ctx, s, x0 + 9, y - 0.5, C.gold, 1, "left");
  }
  function roomSeed() { return (((parseInt(room.code, 10) + 1) * 2654435761 + room.round * 40503) >>> 0); }
  function startRun(seed?: number) {
    var s = seed != null ? seed : ((Date.now() ^ Math.floor(Math.random() * 0x7fffffff)) >>> 0);
    world = createWorld(s, mode, save.char, lookNow(), save.bg);
    phase = "play";
    acc = 0;
    held.left = held.right = false;
    pointers = {};
    try { canvas.focus(); } catch (_e) {}
  }
  function payout() {
    if (!world || world.paid) return;
    world.paid = true;
    var me = world.players[0];
    var mtr = metersOf(me);
    world.earned = world.runCoins + Math.floor(mtr / 25);
    save.coins += world.earned;
    world.newBest = mtr > save.best;
    if (world.newBest) save.best = mtr;
    world.best = save.best;
    writeSave(save);
  }
  function goMenu() { phase = "menu"; world = null; room = null; }

  function shopList() {
    var out: any[] = [], i;
    if (shopTab === "char") for (i = 0; i < CHARS.length; i++) out.push({ key: "char:" + i, name: CHARS[i].name, price: 0, look: makeLook(i, save.color, save.hat), on: save.char === i });
    if (shopTab === "color") for (i = 0; i < COLORS.length; i++) out.push({ key: "color:" + COLORS[i].id, name: COLORS[i].name, price: COLORS[i].price, look: makeLook(save.char, COLORS[i].id, save.hat), on: save.color === COLORS[i].id });
    if (shopTab === "hat") for (i = 0; i < HATS.length; i++) out.push({ key: "hat:" + HATS[i].id, name: HATS[i].name, price: HATS[i].price, look: makeLook(save.char, save.color, HATS[i].id), on: save.hat === HATS[i].id });
    if (shopTab === "map") for (i = 0; i < MAPS.length; i++) out.push({ key: "map:" + MAPS[i].id, name: MAPS[i].name, price: MAPS[i].price, map: MAPS[i].id, on: save.bg === MAPS[i].id });
    return out;
  }
  function owns(it: any) { return it.price === 0 || !!save.owned[it.key]; }
  function equip(key: string) {
    var a = key.split(":");
    if (a[0] === "char") save.char = parseInt(a[1], 10);
    if (a[0] === "color") save.color = a[1];
    if (a[0] === "hat") save.hat = a[1];
    if (a[0] === "map" || a[0] === "bg") save.bg = a[1];
  }
  function shopTap(key: string) {
    var list = shopList(), it: any = null;
    for (var i = 0; i < list.length; i++) if (list[i].key === key) it = list[i];
    if (!it) return;
    if (owns(it)) { equip(key); say("НАДЕТО"); }
    else if (save.coins >= it.price) { save.coins -= it.price; save.owned[key] = 1; equip(key); say("КУПЛЕНО!"); }
    else { say("МАЛО МОНЕТ"); return; }
    writeSave(save);
  }

  function activate(id: string | null) {
    if (!id) return;
    if (id === "start") { mode = "solo"; room = null; startRun(); return; }
    if (id === "shop") { phase = "shop"; return; }
    if (id === "mp") { phase = "mp"; return; }
    if (id === "tilt") { toggleTilt(); return; }
    if (id === "menu") { goMenu(); return; }
    if (id === "back") { phase = phase === "lobby" || phase === "join" ? "mp" : "menu"; return; }
    if (id === "create") { room = { code: String(1000 + Math.floor(Math.random() * 9000)), joined: false, round: 0 }; phase = "lobby"; return; }
    if (id === "join") { joinCode = ""; phase = "join"; return; }
    if (id === "go") { mode = "squad"; startRun(roomSeed()); return; }
    if (id.indexOf("key:") === 0) {
      var k = id.slice(4);
      if (k === "del") joinCode = joinCode.slice(0, -1);
      else if (k === "ok") {
        if (joinCode.length === 4) { room = { code: joinCode, joined: true, round: 0 }; phase = "lobby"; }
        else say("НУЖНО 4 ЦИФРЫ");
      } else if (joinCode.length < 4) joinCode += k;
      return;
    }
    if (id.indexOf("tab:") === 0) { shopTab = id.slice(4); return; }
    if (id.indexOf("item:") === 0) { shopTap(id.slice(5)); return; }
    if (id === "rematch") {
      if (room) { room.round++; mode = "squad"; startRun(roomSeed()); }
      else startRun();
    }
  }
  function toggleTilt() {
    if (!tiltAvail || tiltDenied) { say("НАКЛОН НЕДОСТУПЕН"); return; }
    if (tiltOn) { tiltOn = false; tiltAx = 0; return; }
    var ok = function () { tiltOn = true; };
    var fail = function () { tiltOn = false; tiltDenied = true; say("НАКЛОН НЕДОСТУПЕН"); };
    try {
      var DOE: any = window.DeviceOrientationEvent;
      if (DOE && typeof DOE.requestPermission === "function") DOE.requestPermission().then(function (s: string) { if (s === "granted") ok(); else fail(); }).catch(fail);
      else ok();
    } catch (_e) { fail(); }
  }
  function onOrient(e: any) {
    if (!tiltOn || e.gamma == null || isNaN(e.gamma)) return;
    tiltAx = clamp(e.gamma / 22, -1, 1);
  }
  function recomputeHold() {
    var l = false, r = false;
    if (phase === "play") for (var k in pointers) { if (pointers[k].x < LW / 2) l = true; else r = true; }
    held.left = l; held.right = r;
  }
  function onPtrDown(e: any) {
    e.preventDefault();
    try { canvas.focus(); } catch (_e) {}
    var loc = toLogic(e.clientX, e.clientY);
    if (phase !== "play") { activate(hitAt(loc.x, loc.y)); return; }
    pointers[e.pointerId != null ? e.pointerId : 1] = loc;
    recomputeHold();
  }
  function onPtrMove(e: any) {
    if (phase !== "play") return;
    var id = e.pointerId != null ? e.pointerId : 1;
    if (pointers[id] == null) return;
    pointers[id] = toLogic(e.clientX, e.clientY);
    recomputeHold();
  }
  function onPtrUp(e: any) {
    delete pointers[e.pointerId != null ? e.pointerId : 1];
    recomputeHold();
  }
  function onKey(e: any, down: boolean) {
    var k = e.key;
    if (k === "ArrowLeft" || k === "a" || k === "A" || k === "ф" || k === "Ф") { held.kl = down; e.preventDefault(); return; }
    if (k === "ArrowRight" || k === "d" || k === "D" || k === "в" || k === "В") { held.kr = down; e.preventDefault(); return; }
    if (!down) return;
    if (phase === "join") {
      if (k >= "0" && k <= "9") activate("key:" + k);
      else if (k === "Backspace") activate("key:del");
      else if (k === "Enter") activate("key:ok");
    }
    if (k === "Escape" && phase !== "menu" && phase !== "play") activate(phase === "results" ? "menu" : "back");
    if ((k === "Enter" || k === " ") && phase === "menu") activate("start");
    if ((k === "Enter" || k === " ") && phase === "results") activate("rematch");
  }
  function dirNow() {
    var l = held.left || held.kl, r = held.right || held.kr;
    return l && !r ? -1 : r && !l ? 1 : 0;
  }
  function collectInputs() {
    var inputs: any = {};
    for (var i = 0; i < world.players.length; i++) {
      var p = world.players[i];
      if (p.isBot || autoPlay) inputs[p.id] = { dir: botDir(p, world), ax: 0 };
      else {
        var d = dirNow();
        inputs[p.id] = tiltOn && d === 0 ? { dir: 0, ax: tiltAx } : { dir: d, ax: 0 };
      }
    }
    return inputs;
  }

  /* ---------- screens ---------- */
  var MENU_CAM = function () { return -LH + 70; };
  function header(title: string, sc: number) {
    var w = textWidth(title, sc) + 16;
    box(ctx, Math.round(LW / 2 - w / 2), 10, w, 7 * sc + 12, C.navy, C.cream);
    drawText(ctx, title, LW / 2, 16, C.cream, sc, "center");
  }
  function drawFlash() {
    if (flashT <= 0) return;
    if (phase !== flashPh) { flashT = 0; return; }
    flashT--;
    var w = textWidth(flash, 1) + 12;
    ctx.globalAlpha = Math.min(1, flashT / 20);
    box(ctx, Math.round(LW / 2 - w / 2), LH - 64, w, 13, C.navy, C.gold);
    drawText(ctx, flash, LW / 2, LH - 61, C.gold, 1, "center");
    ctx.globalAlpha = 1;
  }
  function drawMenu() {
    drawBg(ctx, MENU_CAM(), ui, save.bg);
    rect(ctx, 0, 0, LW, LH, "rgba(18,14,44,0.14)");
    box(ctx, 14, 14, 132, 32, C.navy, C.cream);
    drawText(ctx, "ХОППАК", LW / 2 + 1, 20, C.coral, 3, "center");
    drawText(ctx, "ХОППАК", LW / 2, 19, C.cream, 3, "center");
    drawText(ctx, "ПРЫГАЙ С ДРУЗЬЯМИ", LW / 2, 52, C.cream, 1, "center");
    /* hero preview: hops on a little platform */
    var ph = (ui % 60) / 60;
    var hop = Math.round(Math.sin(ph * Math.PI) * 14);
    var pose = ph < 0.08 || ph > 0.95 ? "squash" : ph < 0.5 ? "up" : "fall";
    var py = 118;
    rect(ctx, 52, py + 2, 56, 5, C.wood); rect(ctx, 52, py + 6, 56, 2, C.woodD); rect(ctx, 52, py + 2, 56, 1, C.edge); rect(ctx, 53, py + 3, 54, 1, C.woodL);
    drawJumper(ctx, 68, py + 2 - 32 - hop, lookNow(), 1, pose, ui % 170 < 6, true, 2);
    coinsLabel(LW / 2, 134, save.coins, "center");
    drawText(ctx, "РЕКОРД " + save.best + " М", LW / 2, 146, C.cream, 1, "center");
    var by = Math.max(164, LH - 158);
    btn("start", 20, by, 120, 30, C.mint, "СТАРТ", INK, 2);
    btn("shop", 20, by + 38, 120, 22, C.navy, "МАГАЗИН");
    btn("mp", 20, by + 66, 120, 22, C.navy, "МУЛЬТИПЛЕЕР");
    btn("tilt", 20, by + 94, 120, 16, tiltOn ? C.mint : "#1a1430", "НАКЛОН: " + (tiltOn ? "ВКЛ" : "ВЫКЛ"), tiltOn ? INK : C.cream);
    drawText(ctx, "ТАПАЙ ПО КРАЯМ ЭКРАНА", LW / 2, LH - 14, "#c8b8e0", 1, "center");
    drawFlash();
  }
  function drawBgSwatch(x: number, y: number, w: number, h: number, id: string) {
    var sk = skyAt(id, 0);
    for (var i = 0; i < h; i += 2) rect(ctx, x, y + i, w, 2, i < h / 2 ? mixHex(sk[0], sk[1], i / (h / 2)) : mixHex(sk[1], sk[2], (i - h / 2) / (h / 2)));
    var pt = MAP_PLAT[id] || MAP_PLAT.city;
    rect(ctx, x + 4, y + 18, 16, 3, pt.n); rect(ctx, x + 4, y + 18, 16, 1, pt.edge);
    if (id === "city") {
      rect(ctx, x + 2, y + h - 9, 5, 9, "#221852"); rect(ctx, x + 8, y + h - 13, 6, 13, "#1c1444"); rect(ctx, x + 15, y + h - 8, 6, 8, "#221852");
      rect(ctx, x + 10, y + h - 10, 1, 1, "#ffd060"); rect(ctx, x + w - 7, y + 3, 4, 4, "#f8e4a8");
    } else if (id === "jungle") {
      rect(ctx, x, y + h - 6, w, 6, "#2a4e36"); rect(ctx, x + 5, y + 11, 14, 3, "#ff6848"); rect(ctx, x + 7, y + 10, 10, 1, "#ffa858");
    } else if (id === "ice") {
      rect(ctx, x, y + h - 7, w, 7, "#6eb8e8"); rect(ctx, x, y + h - 7, w, 2, "#ffffff"); rect(ctx, x + 5, y + 11, 14, 3, "#8ef4ff");
    } else if (id === "lava") {
      rect(ctx, x, y + h - 6, w, 6, "#4a1830"); rect(ctx, x + 3, y + h - 6, w - 6, 2, "#ff7828"); rect(ctx, x + w - 7, y + 3, 4, 4, "#ffdc60");
    } else if (id === "aqua") {
      rect(ctx, x, y + h - 5, w, 5, "#d8b46c"); rect(ctx, x + 6, y + 10, 5, 5, "#ff6ec8"); rect(ctx, x + 15, y + 7, 3, 3, "#a8f8ff");
    } else {
      rect(ctx, x + 5, y + 7, 6, 6, "#e88a62"); rect(ctx, x + 3, y + 10, 10, 1, "#fff0b4"); rect(ctx, x + 16, y + 5, 2, 2, "#88f4ff");
    }
  }
  function drawShop() {
    drawBg(ctx, MENU_CAM(), ui, save.bg);
    rect(ctx, 0, 0, LW, LH, "rgba(18,14,44,0.32)");
    header("МАГАЗИН", 2);
    coinsLabel(LW - 8, 40, save.coins, "right");
    drawJumper(ctx, 18, 38, lookNow(), 1, "idle", ui % 170 < 6, true, 2);
    drawText(ctx, CHARS[save.char].name, 54, 46, C.cream, 1, "left");
    drawText(ctx, "МОНЕТЫ ЗА ЗАБЕГ", 54, 58, "#c8b8e0", 1, "left");
    drawText(ctx, "+ ЗА ВЫСОТУ", 54, 68, "#c8b8e0", 1, "left");
    var tabs = [["char", "ГЕРОИ"], ["color", "ЦВЕТ"], ["hat", "ШЛЯПЫ"], ["map", "КАРТЫ"]];
    for (var t = 0; t < tabs.length; t++) {
      var on = shopTab === tabs[t][0];
      btn("tab:" + tabs[t][0], 4 + t * 38, 84, 37, 15, on ? C.gold : C.navy, tabs[t][1], on ? INK : C.cream);
    }
    var list = shopList();
    for (var i = 0; i < list.length; i++) {
      var it = list[i];
      var cx = 4 + (i % 2) * 78, cy = 106 + Math.floor(i / 2) * 50;
      var own = owns(it);
      addHit("item:" + it.key, cx, cy, 74, 46);
      box(ctx, cx, cy, 74, 46, it.on ? "#2a2050" : C.navy, it.on ? C.gold : own ? C.cream : "#6a5a8a");
      if (it.map) drawBgSwatch(cx + 3, cy + 5, 22, 36, it.map);
      else drawJumper(ctx, cx + 4, cy + 7, it.look, 1, "idle", false, true, 2);
      drawText(ctx, it.name, cx + 28, cy + 10, C.cream, 1, "left");
      if (it.on) drawText(ctx, "НАДЕТО", cx + 28, cy + 26, C.gold, 1, "left");
      else if (own) drawText(ctx, "ЕСТЬ", cx + 28, cy + 26, C.mint, 1, "left");
      else coinsLabel(cx + 28, cy + 26, it.price);
    }
    btn("back", 30, LH - 34, 100, 22, C.navy, "НАЗАД");
    drawFlash();
  }
  function soonNote(y: number) {
    box(ctx, 8, y, 144, 30, "#2a1a10", C.gold);
    drawText(ctx, "ОНЛАЙН СКОРО", LW / 2, y + 5, C.gold, 1, "center");
    drawText(ctx, "СЕЙЧАС ИГРАЕМ С БОТАМИ", LW / 2, y + 17, C.cream, 1, "center");
  }
  function drawMp() {
    drawBg(ctx, MENU_CAM(), ui, save.bg);
    rect(ctx, 0, 0, LW, LH, "rgba(18,14,44,0.30)");
    header("МУЛЬТИПЛЕЕР", 1);
    drawText(ctx, "ДО 4 ИГРОКОВ", LW / 2, 42, C.cream, 1, "center");
    drawText(ctx, "НА ОДНОЙ КАРТЕ", LW / 2, 52, C.cream, 1, "center");
    for (var i = 0; i < 4; i++) drawJumper(ctx, 22 + i * 32, 70 + (Math.floor(ui / 15 + i) % 2), makeLook(i, i === save.char ? save.color : "base", i === save.char ? save.hat : "none"), 1, "idle", (ui + i * 40) % 170 < 6, true, 1);
    var by = 104;
    btn("create", 14, by, 132, 26, C.mint, "СОЗДАТЬ КОМНАТУ", INK);
    btn("join", 14, by + 34, 132, 26, C.navy, "ВОЙТИ ПО КОДУ");
    soonNote(by + 72);
    btn("back", 30, LH - 34, 100, 22, C.navy, "НАЗАД");
    drawFlash();
  }
  function lobbyNames() {
    var out: any[] = [{ kind: save.char, look: lookNow(), name: CHARS[save.char].name, tag: "ТЫ" }];
    for (var k = 0; k < 4; k++) if (k !== save.char) out.push({ kind: k, look: makeLook(k, "base", "none"), name: CHARS[k].name, tag: "БОТ" });
    return out;
  }
  function drawLobby() {
    drawBg(ctx, MENU_CAM(), ui, save.bg);
    rect(ctx, 0, 0, LW, LH, "rgba(18,14,44,0.32)");
    header(room.joined ? "ТЫ В КОМНАТЕ" : "КОМНАТА", 1);
    drawText(ctx, "КОД КОМНАТЫ", LW / 2, 40, "#c8b8e0", 1, "center");
    box(ctx, 26, 50, 108, 38, C.navy, C.gold);
    drawText(ctx, room.code, LW / 2, 57, C.gold, 4, "center");
    drawText(ctx, room.joined ? "ЖДЁМ СТАРТА" : "ДАЙ КОД ДРУЗЬЯМ", LW / 2, 94, C.cream, 1, "center");
    var ps = lobbyNames();
    for (var i = 0; i < ps.length; i++) {
      var y = 108 + i * 24;
      box(ctx, 14, y, 132, 21, i === 0 ? "#2a2050" : C.navy, i === 0 ? C.gold : C.cream);
      drawJumper(ctx, 20, y + 3, ps[i].look, 1, "idle", (ui + i * 50) % 170 < 6, true, 1);
      drawText(ctx, ps[i].name, 38, y + 7, C.cream, 1, "left");
      drawText(ctx, ps[i].tag, 140, y + 7, i === 0 ? C.gold : "#9a8ab8", 1, "right");
    }
    soonNote(208);
    btn("go", 14, Math.max(246, LH - 66), 132, 26, C.mint, "НАЧАТЬ", INK, 2);
    btn("back", 30, LH - 34, 100, 22, C.navy, "НАЗАД");
  }
  function drawJoin() {
    drawBg(ctx, MENU_CAM(), ui, save.bg);
    rect(ctx, 0, 0, LW, LH, "rgba(18,14,44,0.32)");
    header("ВОЙТИ", 2);
    drawText(ctx, "ВВЕДИ КОД КОМНАТЫ", LW / 2, 42, C.cream, 1, "center");
    for (var i = 0; i < 4; i++) {
      var x = 22 + i * 30;
      box(ctx, x, 54, 26, 32, C.navy, i === joinCode.length ? C.gold : C.cream);
      if (joinCode[i]) drawText(ctx, joinCode[i], x + 13, 59, C.gold, 3, "center");
      else if (i === joinCode.length && Math.floor(ui / 20) % 2) rect(ctx, x + 8, 78, 10, 2, C.gold);
    }
    var keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "del", "0", "ok"];
    for (var k = 0; k < keys.length; k++) {
      var kx = 14 + (k % 3) * 45, ky = 98 + Math.floor(k / 3) * 34;
      var lab = keys[k] === "del" ? "<" : keys[k] === "ok" ? "ВОЙТИ" : keys[k];
      btn("key:" + keys[k], kx, ky, 42, 30, keys[k] === "ok" ? (joinCode.length === 4 ? C.mint : "#2a3a3a") : C.navy, lab, keys[k] === "ok" && joinCode.length === 4 ? INK : C.cream, keys[k].length === 1 ? 2 : 1);
    }
    btn("back", 30, LH - 34, 100, 22, C.navy, "НАЗАД");
    drawFlash();
  }

  function poseOf(p: any) {
    if (p.squash > 3) return "squash";
    if (p.vy < -2.2) return "up";
    if (p.vy > 1.5) return "fall";
    return "idle";
  }
  function drawPlay() {
    hits = [];
    var w = world, cam = w.cameraY, i;
    var shx = w.shake > 0 ? (w.tick % 2 ? 1 : -1) * Math.ceil(w.shake / 3) : 0;
    ctx.save();
    ctx.translate(shx, 0);
    drawBg(ctx, cam, w.tick, w.map);
    for (i = 0; i < w.platforms.length; i++) if (w.platforms[i].type === "move") drawTrack(ctx, w.platforms[i], cam);
    for (i = 0; i < w.platforms.length; i++) drawPlatform(ctx, w.platforms[i], cam, w.map, w.tick);
    for (i = 0; i < w.coins.length; i++) {
      var cn = w.coins[i];
      if (!cn.taken && cn.y - cam > -8 && cn.y - cam < LH + 4) drawCoin(ctx, cn.x, Math.round(cn.y - cam), w.tick + i * 3);
    }
    for (i = 0; i < w.monsters.length; i++) drawMob(ctx, w.monsters[i], cam, w.map);
    for (i = 0; i < w.bullets.length; i++) drawBullet(ctx, w.bullets[i], cam);
    for (i = 0; i < w.particles.length; i++) {
      var pt = w.particles[i];
      ctx.globalAlpha = clamp(pt.life / pt.max, 0, 1);
      rect(ctx, pt.x, pt.y - cam, pt.s, pt.s, pt.col);
    }
    ctx.globalAlpha = 1;
    /* players: bots first, me on top; off-screen bots are not drawn */
    var tags: any[] = [];
    for (var pi = w.players.length - 1; pi >= 0; pi--) {
      var p = w.players[pi];
      var sy = p.y - cam;
      if (sy < -22 || sy > LH + 10) continue;
      var blink = (w.tick + p.id * 41) % 170 < 6;
      var pose = p.alive ? poseOf(p) : "fall";
      drawJumper(ctx, p.x, sy, p.look, p.face, pose, blink, p.alive);
      if (p.x < 6) drawJumper(ctx, p.x + LW, sy, p.look, p.face, pose, blink, p.alive);
      if (p.x > LW - PW - 6) drawJumper(ctx, p.x - LW, sy, p.look, p.face, pose, blink, p.alive);
      if (w.mode === "squad") tags.push({ p: p, x: p.x + 6, y: Math.round(sy) - 13 });
    }
    /* name tags without overlaps */
    tags.sort(function (a: any, b: any) { return b.y - a.y; });
    for (i = 0; i < tags.length; i++) {
      var tg = tags[i];
      tg.w = textWidth(tg.p.alive ? tg.p.name : "ВЫБЫЛ", 1) + 3;
      for (var j = 0; j < i; j++) {
        var o = tags[j];
        if (Math.abs(o.x - tg.x) < (o.w + tg.w) / 2 + 1 && Math.abs(o.y - tg.y) < 10) tg.y = o.y - 10;
      }
      var lx = clamp(tg.x, tg.w / 2 + 1, LW - 12 - tg.w / 2);
      rect(ctx, Math.round(lx - tg.w / 2), tg.y, tg.w, 9, tg.p.alive ? (tg.p.id === 0 ? "#3a2a10" : C.navy) : "#4a1020");
      drawText(ctx, tg.p.alive ? tg.p.name : "ВЫБЫЛ", lx, tg.y + 1, tg.p.alive ? (tg.p.id === 0 ? C.gold : C.cream) : C.red, 1, "center");
    }
    ctx.restore();

    /* HUD */
    var me = w.players[0];
    var label = metersOf(me) + " М";
    var hw = textWidth(label, 1) + 10;
    box(ctx, Math.round(LW / 2 - hw / 2), 6, hw, 13, C.navy, C.cream);
    drawText(ctx, label, LW / 2, 9, C.cream, 1, "center");
    box(ctx, 4, 6, textWidth(String(w.runCoins), 1) + 15, 13, C.navy, C.gold);
    coinsLabel(7, 9, w.runCoins);
    if (w.mode === "squad") drawRivals(w, cam);
    if (w.tick < 170) {
      ctx.globalAlpha = clamp((170 - w.tick) / 40, 0, 1);
      box(ctx, 14, LH - 30, 132, 14, C.navy, C.cream);
      drawText(ctx, "ТАПАЙ СЛЕВА И СПРАВА", LW / 2, LH - 27, C.cream, 1, "center");
      ctx.globalAlpha = 1;
    }
  }
  /* rail on the right + arrows on top for rivals above the screen (no bottom arrows) */
  function drawRivals(w: any, cam: number) {
    var me = w.players[0], i, p;
    var hi = me.y, lo = me.y;
    for (i = 0; i < w.players.length; i++) { p = w.players[i]; hi = Math.min(hi, p.y); lo = Math.max(lo, p.y); }
    hi -= 40;
    lo = Math.max(lo, me.camY + LH) + 20;
    var span = Math.max(80, lo - hi);
    var rx = LW - 9, ry = 24, rh = LH - 56;
    box(ctx, rx, ry, 7, rh, C.navy, C.cream);
    for (i = 0; i < w.players.length; i++) {
      p = w.players[i];
      var ty = Math.round(ry + 2 + clamp((p.y - hi) / span, 0, 1) * (rh - 6));
      rect(ctx, rx + 1, ty, 5, p.id === 0 ? 3 : 2, p.alive ? p.look.hood : "#555");
      if (p.id === 0) rect(ctx, rx - 2, ty, 2, 3, C.gold);
    }
    var ay = 24;
    for (i = 1; i < w.players.length; i++) {
      p = w.players[i];
      if (p.y - cam >= 8) continue;
      var dm = Math.round((me.y - p.y) / PX_PER_M);
      var lab = p.name + " +" + dm;
      var tw = textWidth(lab, 1);
      box(ctx, 4, ay, tw + 12, 11, p.alive ? C.navy : "#3a1020", p.alive ? p.look.hood : "#555");
      ctx.fillStyle = p.alive ? p.look.hood : "#777";
      ctx.fillRect(7, ay + 2, 1, 1); ctx.fillRect(6, ay + 3, 3, 1); ctx.fillRect(5, ay + 4, 5, 1); ctx.fillRect(7, ay + 5, 1, 3);
      drawText(ctx, lab, 13, ay + 2, C.cream, 1, "left");
      ay += 13;
    }
  }
  function drawResults() {
    hits = [];
    drawBg(ctx, world.cameraY, ui, world.map);
    rect(ctx, 0, 0, LW, LH, "rgba(18,14,44,0.36)");
    header("ИТОГИ", 2);
    var list = world.players.slice().sort(function (a: any, b: any) { return a.place - b.place; });
    var squad = world.mode === "squad";
    var rowH = squad ? 34 : 46;
    for (var i = 0; i < list.length; i++) {
      var p = list[i], y = 42 + i * rowH;
      var fill = p.place === 1 ? "#6a4a10" : p.place === 2 ? "#3a4050" : p.place === 3 ? "#4a3020" : C.navy;
      box(ctx, 8, y, 144, rowH - 4, fill, p.id === 0 ? C.gold : C.cream);
      drawText(ctx, String(p.place), 20, y + (rowH - 4) / 2 - 7, p.place === 1 ? C.gold : C.cream, 2, "center");
      drawJumper(ctx, 36, y + Math.round((rowH - 4) / 2 - 8), p.look, 1, "idle", false, true);
      if (p.place === 1 && squad) { rect(ctx, 37, y + 2, 10, 2, C.gold); rect(ctx, 37, y + 1, 1, 1, C.gold); rect(ctx, 41, y, 2, 2, C.gold); rect(ctx, 46, y + 1, 1, 1, C.gold); }
      drawText(ctx, p.name + (p.id === 0 && squad ? " (ТЫ)" : ""), 56, y + 6, C.cream, 1, "left");
      drawText(ctx, metersOf(p) + " М", 56, y + 17, C.cream, 1, "left");
    }
    var cy = 42 + list.length * rowH + 4;
    box(ctx, 8, cy, 144, 32, C.navy, C.gold);
    drawText(ctx, "МОНЕТЫ", 16, cy + 5, C.cream, 1, "left");
    coinsLabel(144, cy + 5, world.earned || 0, "right");
    drawText(ctx, "+", 144 - textWidth(String(world.earned || 0), 1) - 15, cy + 5, C.gold, 1, "right");
    drawText(ctx, "ВСЕГО", 16, cy + 18, "#c8b8e0", 1, "left");
    coinsLabel(144, cy + 18, save.coins, "right");
    if (world.newBest) { box(ctx, 18, cy + 38, 124, 13, C.navy, C.gold); drawText(ctx, "НОВЫЙ РЕКОРД!", LW / 2, cy + 41, C.gold, 1, "center"); }
    else { drawText(ctx, "РЕКОРД " + world.best + " М", LW / 2, cy + 41, C.cream, 1, "center"); }
    btn("rematch", 8, LH - 38, 74, 24, C.coral, "РЕВАНШ", C.cream);
    btn("menu", 86, LH - 38, 66, 24, C.navy, "МЕНЮ");
  }

  function frame(now: number) {
    if (!running) return;
    if (!lastT) lastT = now;
    var dt = Math.min(0.05, (now - lastT) / 1000);
    lastT = now;
    ui++;
    if (phase === "play" && world && world.phase === "play") {
      acc += dt;
      var steps = 0;
      while (acc >= STEP && steps < 5) { tickWorld(world, collectInputs()); acc -= STEP; steps++; }
      if (world.phase === "results") { payout(); phase = "results"; }
    } else acc = 0;
    ctx.imageSmoothingEnabled = false;
    hits = [];
    if (phase === "menu") drawMenu();
    else if (phase === "shop") drawShop();
    else if (phase === "mp") drawMp();
    else if (phase === "lobby") drawLobby();
    else if (phase === "join") drawJoin();
    else if (phase === "results") drawResults();
    else drawPlay();
    raf = requestAnimationFrame(frame);
  }

  resize();
  window.addEventListener("resize", resize);
  if (window.visualViewport) window.visualViewport.addEventListener("resize", resize);
  var onCtx = function (e: any) { e.preventDefault(); };
  var onKD = function (e: any) { onKey(e, true); };
  var onKU = function (e: any) { onKey(e, false); };
  var noScroll = function (e: any) { e.preventDefault(); };
  canvas.addEventListener("pointerdown", onPtrDown);
  canvas.addEventListener("pointermove", onPtrMove);
  canvas.addEventListener("pointerup", onPtrUp);
  canvas.addEventListener("pointercancel", onPtrUp);
  canvas.addEventListener("contextmenu", onCtx);
  window.addEventListener("keydown", onKD);
  window.addEventListener("keyup", onKU);
  window.addEventListener("deviceorientation", onOrient);
  document.addEventListener("touchmove", noScroll, { passive: false });
  document.addEventListener("gesturestart", noScroll);
  raf = requestAnimationFrame(frame);

  return {
    destroy: function () {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      if (window.visualViewport) window.visualViewport.removeEventListener("resize", resize);
      canvas.removeEventListener("pointerdown", onPtrDown);
      canvas.removeEventListener("pointermove", onPtrMove);
      canvas.removeEventListener("pointerup", onPtrUp);
      canvas.removeEventListener("pointercancel", onPtrUp);
      canvas.removeEventListener("contextmenu", onCtx);
      window.removeEventListener("keydown", onKD);
      window.removeEventListener("keyup", onKU);
      window.removeEventListener("deviceorientation", onOrient);
      document.removeEventListener("touchmove", noScroll);
      document.removeEventListener("gesturestart", noScroll);
    },
    /* test hooks */
    getPhase: function () { return phase; },
    getWorld: function () { return world; },
    getSave: function () { return save; },
    tap: function (id: string) { activate(id); },
    screen: function (s: string) { phase = s; },
    start: function (m: string, seed?: number, mapId?: string) { mode = m || "solo"; if (mapId) save.bg = mapId; startRun(seed); },
    setDir: function (d: number) { held.kl = d < 0; held.kr = d > 0; },
    setAutoPlay: function (on: boolean) { autoPlay = !!on; },
    addCoins: function (n: number) { save.coins += n; writeSave(save); },
    forceResults: function () { if (world) { finish(world); payout(); phase = "results"; } },
    warp: function (m: number) {
      if (!world) return;
      generateUntil(world, -m * PX_PER_M - LH);
      for (var i = 0; i < world.players.length; i++) {
        var p = world.players[i];
        p.y = -m * PX_PER_M - PH - i * 30; p.vy = -6; p.maxH = -(p.y + PH);
        p.camY = p.y - LH * 0.42;
      }
      world.cameraY = world.players[0].camY;
      world.tick = Math.max(world.tick, 200);
      var cut = world.cameraY + LH + 80;
      world.platforms = world.platforms.filter(function (a: any) { return a.y < cut; });
      world.monsters = world.monsters.filter(function (a: any) { return a.y < cut; });
      world.coins = world.coins.filter(function (a: any) { return a.y < cut; });
    },
    simTicks: function (n: number) {
      if (!world) return null;
      for (var i = 0; i < n && world.phase === "play"; i++) tickWorld(world, collectInputs());
      if (world.phase === "results") { payout(); phase = "results"; }
      return { phase: world.phase, tick: world.tick, players: world.players.map(function (p: any) { return { name: p.name, alive: p.alive, m: metersOf(p), why: p.why }; }) };
    },
    inspectMap: function (seed: number, toM: number, mapId?: string) {
      var w = createWorld(seed, "solo", 0, makeLook(0, "base", "none"), mapId || save.bg);
      generateUntil(w, -toM * PX_PER_M - 200);
      return {
        jumpH: JUMP_H, gapCap: GAP_CAP, rowSep: ROW_SEP, xSep: X_SEP,
        platforms: w.platforms.map(function (p: any) { return { x: p.x, y: p.y, w: p.w, type: p.type, spring: p.spring, row: p.row, vx: p.vx }; }),
        monsters: w.monsters.map(function (m: any) { return { kind: m.kind, x: m.x, y: m.y, w: m.w, h: m.h }; }),
        coins: w.coins.map(function (c: any) { return { x: c.x, y: c.y }; })
      };
    }
  };
}

/* @@APP */
export default function App() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const game = startHoppak(cv);
    return () => { game.destroy(); };
  }, []);
  return (
    <div style={{ position: "fixed", inset: 0, width: "100%", height: "100%", margin: 0, background: "#0a0718", overflow: "hidden", touchAction: "none", userSelect: "none", WebkitUserSelect: "none" }}>
      <canvas ref={ref} tabIndex={0} style={{ display: "block", width: "100%", height: "100%", imageRendering: "pixelated", touchAction: "none", outline: "none" }} />
    </div>
  );
}
