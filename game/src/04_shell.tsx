
/* ---------------- Game shell: screens, input, loop ---------------- */
function startHoppak(canvas: HTMLCanvasElement): any {
  var raw = canvas.getContext("2d");
  var noop = function () {};
  if (!raw) return { destroy: noop };
  var ctx: Ctx = raw;
  var wrap = canvas.parentElement;
  var phase = "menu"; /* menu | shop | camp | lobby | play | results | font */
  var world: any = null;
  var save = loadSave();
  var mode = "solo";
  var room: any = { round: 0 };
  var shopHero = save.char;
  var abTap = false;
  var lobbyMap = save.bg;
  var flash = "", flashT = 0, flashPh = "";
  var tiltOn = false, tiltDenied = false, tiltAx = 0;
  var tiltAvail = typeof window.DeviceOrientationEvent !== "undefined";
  var autoPlay = false;
  var held: any = { left: false, right: false, kl: false, kr: false };
  var pointers: any = {};
  var acc = 0, uiAcc = 0, UI_STEP = 1 / 60, lastT = -1, raf = 0, running = true, driving = false, ui = 0;
  var hits: any[] = [];
  var SCALE = 1, pScale = 1, cssScale = 1, isWide = false, lastBackdropMap = "";
  var fieldLocked = false, landPause = false;
  var pressId: any = null;
  var confirmId: any = null, confirmAt = 0;
  var campCard = -1;
  var showSet = false;
  var paused = false;
  var netLW = 0;
  var WHERE = ["В ГОРОДЕ", "В ДЖУНГЛЯХ", "В ЛЕДНИКЕ", "НА ВУЛКАНЕ", "В ОКЕАНЕ", "В КОСМОСЕ"];
  var TO = ["ГОРОДА", "ДЖУНГЛЕЙ", "ЛЕДНИКА", "ВУЛКАНА", "ОКЕАНА", "КОСМОСА"];
  var HTO = ["КАПИТАНА", "ПИРАТА", "НИНДЗЯ", "РОБОТА", "МАГА", "РЫЦАРЯ"];

  warmHeroSprites();
  function isPageBuild() { return typeof HOP_PAGE !== "undefined" && !!HOP_PAGE; }
  function netFixedLW() {
    return (typeof NET !== "undefined" && NET && typeof NET.fixedLW === "function") ? (NET.fixedLW() || 0) : 0;
  }
  function syncBackdrop(mapId: string) {
    if (!wrap) return;
    if (mapId === lastBackdropMap) return;
    lastBackdropMap = mapId || "";
    var cols = skyAt(mapId, 0);
    wrap.style.background = "linear-gradient(" + cols[0] + " 0%, " + cols[1] + " 50%, " + cols[2] + " 100%)";
  }
  function viewSize() {
    var vv = window.visualViewport;
    if (vv && vv.width > 0 && vv.height > 0) return { w: vv.width, h: vv.height, x: vv.offsetLeft || 0, y: vv.offsetTop || 0 };
    var r = (wrap || canvas).getBoundingClientRect();
    return { w: Math.max(1, r.width), h: Math.max(1, r.height), x: 0, y: 0 };
  }
  function resize() {
    var vs = viewSize();
    var cssW = Math.max(1, vs.w), cssH = Math.max(1, vs.h);
    var dpr = Math.max(1, window.devicePixelRatio || 1);
    isWide = cssW >= 540;
    var frameX = isWide ? 24 : 0;
    var frameY = isWide ? (cssH >= 740 ? 16 : 4) : 0;
    var availW = Math.max(160, cssW - frameX * 2);
    var availH = Math.max(240, cssH - frameY * 2);
    var lw = netFixedLW() || 160;
    var lh = 346;
    if (fieldLocked) { lw = LW; lh = LH; }
    var sx: number, sy: number, cssWpx: number, cssHpx: number;
    if (isWide) {
      pScale = Math.max(1, Math.min(Math.floor((availW * dpr) / lw), Math.floor((availH * dpr) / lh)));
      cssScale = pScale / dpr;
      sx = sy = pScale;
      canvas.width = lw * pScale;
      canvas.height = lh * pScale;
      cssWpx = lw * cssScale;
      cssHpx = lh * cssScale;
      canvas.style.position = "";
      canvas.style.left = "";
      canvas.style.top = "";
      canvas.style.boxShadow = "0 0 0 2px #f6ecd0, 0 0 0 6px #162040, 0 20px 60px rgba(0,0,0,0.7)";
      canvas.style.borderRadius = "4px";
    } else {
      /* Fractional nearest-neighbor scale so 160×346 fills the short side. Side pads continue the map sky. */
      cssScale = Math.min(availW / lw, availH / lh);
      VIEW_PAD = Math.max(0, (availW / cssScale - lw) / 2);
      cssWpx = (lw + 2 * VIEW_PAD) * cssScale;
      cssHpx = lh * cssScale;
      var pxW = Math.max(1, Math.round(cssWpx * dpr));
      var pxH = Math.max(1, Math.round(cssHpx * dpr));
      canvas.width = pxW;
      canvas.height = pxH;
      var worldW = lw + 2 * VIEW_PAD;
      pScale = pxW / worldW;
      sx = pxW / worldW;
      sy = pxH / lh;
      canvas.style.position = "absolute";
      canvas.style.left = Math.round(vs.x + (cssW - cssWpx) / 2) + "px";
      canvas.style.top = Math.round(vs.y + (cssH - cssHpx) / 2) + "px";
      canvas.style.boxShadow = "none";
      canvas.style.borderRadius = "0px";
    }
    if (isWide) VIEW_PAD = 0;
    netLW = netFixedLW();
    LW = lw; LH = lh; SCALE = cssScale;
    canvas.style.width = cssWpx + "px";
    canvas.style.height = cssHpx + "px";
    canvas.style.imageRendering = "pixelated";
    var hintEl = document.getElementById("desk-hint");
    if (hintEl) hintEl.style.display = (isWide && (cssH - LH * cssScale) >= 34) ? "block" : "none";
    ctx.setTransform(sx, 0, 0, sy, VIEW_PAD * sx, 0);
    ctx.imageSmoothingEnabled = false;
    (ctx as any).webkitImageSmoothingEnabled = false;
    syncBackdrop(world ? world.map : save.bg);
    if (fieldLocked && phase === "play" && !paused && !isWide && cssW > cssH) {
      paused = true; landPause = true; acc = 0; uiAcc = 0; lastT = -1;
    }
  }
  function toLogic(cx: number, cy: number) {
    var r = canvas.getBoundingClientRect();
    var rw = r.width || 1, rh = r.height || 1;
    var x = (cx - r.left) / rw * (LW + 2 * VIEW_PAD) - VIEW_PAD;
    var y = (cy - r.top) / rh * LH;
    if (phase === "play" && cy >= r.top && cy <= r.bottom && (cx < r.left || cx > r.right)) {
      x = cx < r.left ? 0 : LW;
      y = Math.max(0, Math.min(LH, y));
    }
    return { x: x, y: y };
  }
  function colX() { return Math.round((LW - 152) / 2); }
  function lookNow() { return makeLook(save.char, save.color, save.hat); }
  function mapIdx(id: string) { for (var i = 0; i < MAPS.length; i++) if (MAPS[i].id === id) return i; return 0; }
  function mapOpen(i: number) { return i === 0 || !!save.owned["map:" + MAPS[i].id]; }
  function mapBest(i: number) { return save.mapBest[MAPS[i].id] || 0; }
  function mapGoalMet(i: number) { return i > 0 && mapOpen(i - 1) && mapBest(i - 1) >= MAPS[i - 1].goal; }
  function openMaps() { var o: string[] = []; for (var i = 0; i < MAPS.length; i++) if (mapOpen(i)) o.push(MAPS[i].id); return o; }
  function heroOwned(i: number) { return CHARS[i].price === 0 || !!save.owned["char:" + i]; }
  function mapTip(id: string) {
    var s = mapInfo(id).special;
    return s === "ice" ? "ЛЁД: СКОЛЬЗКО" : s === "bounce" ? "ПРУЖИНЫ ЧАЩЕ" : s === "lava" ? "ЖАРКИЕ ПЛАТФОРМЫ" : s === "bubble" ? "ПУЗЫРИ" : s === "grav" ? "СЛАБАЯ ГРАВИТАЦИЯ" : "";
  }
  function mapOpened(M: any) { return M.id === "jungle" ? "ДЖУНГЛИ ОТКРЫТЫ!" : M.name + " ОТКРЫТ!"; }
  function say(s: string) { flash = s; flashT = 90; flashPh = phase; }
  function addHit(id: string, x: number, y: number, w: number, h: number) { hits.push({ id: id, x: x, y: y, w: w, h: h }); }
  function hitAt(x: number, y: number) {
    for (var i = hits.length - 1; i >= 0; i--) { var h = hits[i]; if (x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h) return h.id; }
    return null;
  }
  function btn(id: string, x: number, y: number, w: number, h: number, fill: string, label: string, tcol?: string, sc?: number, border?: string) {
    addHit(id, x, y, w, h);
    var on = pressId === id;
    var fill2 = on ? mixHex(fill, "#ffffff", 0.2) : fill;
    box(ctx, x, y, w, h, fill2, border || C.cream);
    if (on) rect(ctx, x + 1, y + h - 2, w - 2, 1, "rgba(0,0,0,0.35)");
    var s = sc || 1;
    drawText(ctx, label, x + w / 2, y + Math.round((h - 7 * s) / 2) + (on ? 1 : 0), tcol || C.cream, s, "center");
  }
  function coinsLabel(x: number, y: number, n: number, align?: string) {
    var s = String(n), w = textWidth(s, 1) + 9;
    var x0 = align === "right" ? x - w : align === "center" ? x - w / 2 : x;
    drawCoin(ctx, x0, y, ui);
    drawText(ctx, s, x0 + 9, y - 0.5, C.gold, 1, "left");
  }
  function drawBuy(id: string, x: number, y: number, w: number, h: number, price: number) {
    addHit(id, x, y, w, h);
    var on = pressId === id;
    var lack = save.coins < price;
    var wait = !lack && confirmId === id && Date.now() < confirmAt;
    var fill = lack ? "#5a5668" : C.mint;
    if (on) fill = mixHex(fill, "#ffffff", 0.2);
    box(ctx, x, y, w, h, fill, lack ? "#8a8498" : C.cream);
    if (on) rect(ctx, x + 1, y + h - 2, w - 2, 1, "rgba(0,0,0,0.35)");
    var lab = lack ? ("НУЖНО ЕЩЁ ● " + (price - save.coins)) : wait ? ("ТОЧНО? ● " + price) : ("КУПИТЬ ● " + price);
    drawText(ctx, lab, x + w / 2, y + Math.round((h - 7) / 2) + (on ? 1 : 0), lack ? "#d8d0e0" : INK, 1, "center");
  }
  function tryBuy(id: string, price: number, apply: any) {
    if (save.coins < price) return;
    if (confirmId === id && Date.now() < confirmAt) { confirmId = null; apply(); writeSave(save); }
    else { confirmId = id; confirmAt = Date.now() + 2000; }
  }
  function abBar() { return { x: colX(), y: LH - 30, w: 152, h: 26 }; }
  function startSquad(seed?: number) {
    /* Bot-only run. Online rooms will call a net start later; keep this off the lobby draw path. */
    mode = "squad";
    startRun(seed != null ? seed : (((Date.now() + ((room && room.round) || 0) * 40503) >>> 0)));
  }
  function startNet(info: any) { /* net: synchronized online run, seed + map come from the server */
    mode = "solo"; resize();
    startRun(info.seed, info.map);
    NET.attachWorld(world, info);
  }
  function startRun(seed?: number, mapId?: string) {
    var s = seed != null ? seed : ((Date.now() ^ Math.floor(Math.random() * 0x7fffffff)) >>> 0);
    world = createWorld(s, mode, save.char, lookNow(), mapId || (mode === "squad" ? lobbyMap : save.bg));
    var mi = mapIdx(world.map);
    world.recM = mapBest(mi);
    world.goalM = MAPS[mi].goal || 0;
    phase = "play";
    paused = false;
    landPause = false;
    fieldLocked = true;
    acc = 0; uiAcc = 0; lastT = -1;
    held.left = held.right = false;
    pointers = {}; abTap = false; pressId = null;
    try { canvas.focus(); } catch (_e) {}
  }
  function payout() {
    if (!world || world.paid) return;
    world.paid = true;
    var me = world.players[0];
    var mtr = metersOf(me);
    world.earnH = Math.floor(mtr / 25);
    world.earnC = world.runCoins + (world.bonusCoins || 0);
    world.earned = world.earnH + world.earnC;
    var mi = mapIdx(world.map);
    world.prevMapBest = mapBest(mi);
    world.newBest = mtr > (world.prevMapBest || 0);
    if (mtr > world.prevMapBest) save.mapBest[world.map] = mtr;
    save.coins += world.earned;
    if (mtr > save.best) save.best = mtr;
    world.best = save.best;
    writeSave(save);
  }
  function goMenu() { phase = "menu"; world = null; showSet = false; campCard = -1; paused = false; landPause = false; fieldLocked = false; resize(); }

  function shopTap(key: string) {
    if (key.indexOf("char:") !== 0) return;
    var i = parseInt(key.slice(5), 10);
    if (isNaN(i) || i < 0 || i >= CHARS.length) return;
    if (heroOwned(i)) { save.char = i; writeSave(save); say("ВЫБРАН"); }
    else tryBuy("hero:act", CHARS[i].price, function () { save.coins -= CHARS[i].price; save.owned["char:" + i] = 1; save.char = i; say("КУПЛЕНО!"); });
  }

  function activate(id: string | null) {
    if (!id) return;
    if (id.indexOf("net:") === 0) { NET.tap(id, netApi); return; }
    if (world && world.netRound && (id === "rematch" || id === "menu")) { if (id === "menu") { NET.leave(); goMenu(); } else NET.tap("net:rematch", netApi); return; }
    if (id === "start") { mode = "solo"; startRun(); return; }
    if (id === "camp") { phase = "camp"; campCard = -1; return; }
    if (id.indexOf("camp:") === 0) { campTap(id.slice(5)); return; }
    if (id === "hero:prev") { shopHero = mod(shopHero - 1, CHARS.length); return; }
    if (id === "hero:next") { shopHero = mod(shopHero + 1, CHARS.length); return; }
    if (id.indexOf("hero:") === 0 && id !== "hero:act") {
      var hi = parseInt(id.slice(5), 10);
      if (!isNaN(hi) && hi >= 0 && hi < CHARS.length) shopHero = hi;
      return;
    }
    if (id === "hero:act") { shopTap("char:" + shopHero); return; }
    if (id === "lmap:prev" || id === "lmap:next") {
      var om = openMaps(), li = Math.max(0, om.indexOf(lobbyMap));
      lobbyMap = om[mod(li + (id === "lmap:next" ? 1 : -1), om.length)]; return;
    }
    if (id === "shop") { phase = "shop"; return; }
    if (id === "mp" || id === "create") {
      if (openMaps().indexOf(lobbyMap) < 0) lobbyMap = save.bg;
      room = room || { round: 0 }; phase = "lobby"; return;
    }
    if (id === "set") { showSet = !showSet; return; }
    if (id === "tilt") { toggleTilt(); return; }
    if (id === "menu") { goMenu(); return; }
    if (id === "back") { showSet = false; campCard = -1; phase = "menu"; return; }
    if (id === "go") { startSquad(); return; }
    if (id === "pause") { if (phase === "play" && !paused) { paused = true; acc = 0; uiAcc = 0; lastT = -1; } return; }
    if (id === "resume") { paused = false; landPause = false; acc = 0; uiAcc = 0; lastT = -1; return; }
    if (id === "font") { phase = "font"; return; }
    if (id === "rematch") {
      if (mode === "squad") { room.round = (room.round || 0) + 1; startSquad((((Date.now() + room.round * 40503) >>> 0))); }
      else startRun();
    }
  }
  function campTap(key: string) {
    if (key === "play") {
      if (campCard >= 0 && mapOpen(campCard)) { save.bg = MAPS[campCard].id; writeSave(save); mode = "solo"; startRun(); }
      return;
    }
    if (key === "open" || key.indexOf("open:") === 0) {
      var i2 = key.indexOf("open:") === 0 ? parseInt(key.slice(5), 10) : (campCard >= 0 ? campCard : nextClosable());
      if (i2 < 0 || isNaN(i2)) return;
      /* Row buy keeps the list; only the card's own button leaves campCard as-is. */
      if (key === "open" && campCard < 0) campCard = i2;
      unlockMap(i2, key === "open" ? "camp:open" : ("camp:open:" + i2));
      return;
    }
    var i = parseInt(key, 10);
    if (isNaN(i) || i < 0 || i >= MAPS.length) return;
    var M = MAPS[i];
    flashT = 0;
    if (mapOpen(i)) { campCard = i; return; }
    if (!mapOpen(i - 1)) { say("СНАЧАЛА ОТКРОЙ " + MAPS[i - 1].name); return; }
    if (!mapGoalMet(i)) { say("ДОЙДИ ДО " + MAPS[i - 1].goal + " М " + WHERE[i - 1]); return; }
    campCard = i;
  }
  function nextClosable() {
    for (var i = 1; i < MAPS.length; i++) if (!mapOpen(i) && mapGoalMet(i)) return i;
    return -1;
  }
  function unlockMap(i: number, buyId?: string) {
    var M = MAPS[i];
    if (mapOpen(i) || !mapGoalMet(i)) return;
    tryBuy(buyId || ("camp:open:" + i), M.price, function () {
      save.coins -= M.price; save.owned["map:" + M.id] = 1; save.bg = M.id; say(mapOpened(M));
    });
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
    var l = false, r = false, bar = abBar();
    if (phase === "play" && !paused) for (var k in pointers) {
      var q = pointers[k];
      if (q.y >= bar.y) continue;
      if (q.x < LW / 2) l = true; else r = true;
    }
    held.left = l; held.right = r;
  }
  function onPtrDown(e: any) {
    e.preventDefault();
    try { canvas.focus(); } catch (_e) {}
    try { if (e.pointerId != null) (e.currentTarget || ptrRoot).setPointerCapture(e.pointerId); } catch (_e) {}
    var loc = toLogic(e.clientX, e.clientY);
    var id = hitAt(loc.x, loc.y);
    pressId = id;
    if (phase !== "play") return;
    if (paused) return;
    if (id === "ab" || id === "pause") return;
    pointers[e.pointerId != null ? e.pointerId : 1] = { x: loc.x, y: loc.y, sx: loc.x, sy: loc.y };
    recomputeHold();
  }
  function onPtrMove(e: any) {
    var loc = toLogic(e.clientX, e.clientY);
    if (phase !== "play" || paused) return;
    var pid = e.pointerId != null ? e.pointerId : 1;
    var p = pointers[pid];
    if (!p) return;
    p.x = loc.x; p.y = loc.y;
    if (p.sy - loc.y >= 18) { abTap = true; delete pointers[pid]; }
    recomputeHold();
  }
  function onPtrUp(e: any) {
    var loc = toLogic(e.clientX, e.clientY);
    var id = hitAt(loc.x, loc.y);
    if (phase === "play") {
      if (paused) { if (id === "resume" || id === "menu") activate(id); }
      else if (id === "pause" && pressId === "pause") activate("pause");
      else if (id === "ab" && pressId === "ab") abTap = true;
      delete pointers[e.pointerId != null ? e.pointerId : 1];
      recomputeHold();
    } else if (id && id === pressId) activate(id);
    pressId = null;
  }
  function onKey(e: any, down: boolean) {
    var k = e.key;
    if (k === "ArrowLeft" || k === "a" || k === "A" || k === "ф" || k === "Ф") { held.kl = down; e.preventDefault(); return; }
    if (k === "ArrowRight" || k === "d" || k === "D" || k === "в" || k === "В") { held.kr = down; e.preventDefault(); return; }
    if (!down) return;
    if (phase === "play" && paused && (k === " " || k === "Enter" || k === "Escape")) { paused = false; e.preventDefault(); return; }
    if (phase === "play" && (k === " " || k === "ArrowUp" || k === "w" || k === "W" || k === "ц" || k === "Ц" || k === "Shift")) { abTap = true; e.preventDefault(); return; }
    if (k === "Escape" && phase === "play") { paused = true; acc = 0; uiAcc = 0; lastT = -1; return; }
    if (k === "Escape" && phase !== "menu" && phase !== "play") activate(phase === "results" ? "menu" : "back");
    if (phase === "shop" && (k === "ArrowLeft" || k === "ArrowRight")) activate(k === "ArrowLeft" ? "hero:prev" : "hero:next");
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
      if (p.isBot || autoPlay) inputs[p.id] = { dir: botDir(p, world), ax: 0, ab: botWantsAb(world, p) };
      else {
        var d = dirNow();
        inputs[p.id] = tiltOn && d === 0 ? { dir: 0, ax: tiltAx } : { dir: d, ax: 0 };
      }
      if (!p.isBot && abTap) { inputs[p.id].ab = true; abTap = false; }
    }
    return inputs;
  }

  /* ---------- screens ---------- */
  var MENU_CAM = function () { return -LH + 70; };
  function header(title: string, sc: number) {
    var w = textWidth(title, sc) + 16;
    box(ctx, Math.round(LW / 2 - w / 2), 8, w, 7 * sc + 10, C.navy, C.cream);
    drawText(ctx, title, LW / 2, 13, C.cream, sc, "center");
  }
  function drawFlash() {
    if (flashT <= 0) return;
    if (phase !== flashPh) { flashT = 0; return; }
    var unlock = flash.indexOf("ОТКРЫТ") >= 0;
    var sc = 1, fy = LH - 64, fh = 13;
    if (unlock && phase === "camp") {
      if (campCard >= 0) { fy = Math.round(LH / 2 - 70) + 84; fh = 16; }
      else { fy = 36; fh = 22; } /* under the title, in the tip-plaque row */
    } else if (unlock) { fy = 36; fh = 16; }
    var w = Math.min(LW - 8, textWidth(flash, sc) + 16);
    ctx.globalAlpha = Math.min(1, flashT / 20);
    box(ctx, Math.round(LW / 2 - w / 2), fy, w, fh, C.navy, C.gold);
    drawText(ctx, flash, LW / 2, fy + 4, C.gold, sc, "center");
    ctx.globalAlpha = 1;
  }
  function plaque() {
    var x = colX();
    box(ctx, x, 48, 152, 14, C.navy, C.gold);
    coinsLabel(x + 4, 51, save.coins);
    drawText(ctx, "РЕКОРД " + (save.best || 0) + " М", x + 148, 51, C.cream, 1, "right");
  }
  function gear(x: number, y: number) {
    addHit("set", x, y, 18, 18);
    var on = pressId === "set";
    box(ctx, x, y, 18, 18, on ? "#3a4a7a" : C.navy, C.cream);
    rect(ctx, x + 7, y + 3, 4, 12, C.cream); rect(ctx, x + 3, y + 7, 12, 4, C.cream);
    rect(ctx, x + 6, y + 6, 6, 6, C.navy); rect(ctx, x + 8, y + 8, 2, 2, C.cream);
  }
  function drawMenu() {
    drawBg(ctx, MENU_CAM(), ui, save.bg, true);
    dimView(ctx, "rgba(18,14,44,0.14)");
    var x = colX();
    box(ctx, x + 6, 10, 122, 28, C.navy, C.cream);
    drawText(ctx, "ХОППАК", x + 67, 15, C.coral, 3, "center");
    drawText(ctx, "ХОППАК", x + 66, 14, C.cream, 3, "center");
    gear(x + 134, 8);
    drawText(ctx, "ПРЫГАЙ ВЫШЕ ВСЕХ", LW / 2, 39, C.cream, 1, "center");
    plaque();
    var mi = mapIdx(save.bg), M = MAPS[mi], b = mapBest(mi);
    var sub = M.goal ? (M.name + " · " + b + "/" + M.goal + " М") : (M.name + " · " + b + " М");
    var by = LH - 118;
    var py = Math.min(by - 40, Math.max(148, Math.round((70 + by) * 0.5)));
    var ph = (ui % 60) / 60;
    var hop = Math.round(Math.sin(ph * Math.PI) * 10);
    var pose = ph < 0.08 || ph > 0.95 ? "squash" : ph < 0.5 ? "up" : "fall";
    rect(ctx, LW / 2 - 28, py + 2, 56, 5, C.wood); rect(ctx, LW / 2 - 28, py + 6, 56, 2, C.woodD); rect(ctx, LW / 2 - 28, py + 2, 56, 1, C.edge);
    drawJumper(ctx, LW / 2 - 12, py + 2 - 32 - hop, lookNow(), 1, pose, ui % 170 < 6, true, 2);
    btn("shop", x + 36, py + 16, 80, 16, "#1a1430", "ГЕРОЙ ▶", C.cream, 1, C.gold);
    by = Math.max(py + 40, by);
    btn("start", x, by, 152, 34, C.mint, "", INK, 2);
    drawText(ctx, "ИГРАТЬ ▶", LW / 2, by + 4, INK, 2, "center");
    drawText(ctx, sub, LW / 2, by + 22, INK, 1, "center");
    if (isPageBuild()) {
      btn("camp", x, by + 40, 152, 22, C.navy, "КАРТЫ");
      btn("shop", x, by + 66, 72, 22, C.navy, "МАГАЗИН");
      btn("mp", x + 80, by + 66, 72, 22, C.navy, "С БОТАМИ");
    } else {
      btn("camp", x, by + 40, 72, 22, C.navy, "КАРТЫ");
      btn("net:menu", x + 80, by + 40, 72, 22, C.navy, "ОНЛАЙН", C.cream, 1, C.mint);
      btn("shop", x, by + 66, 72, 22, C.navy, "МАГАЗИН");
      btn("mp", x + 80, by + 66, 72, 22, C.navy, "С БОТАМИ");
    }
    if (showSet) {
      box(ctx, x, 70, 152, 86, C.navy, C.cream);
      drawText(ctx, "НАСТРОЙКИ", LW / 2, 76, C.gold, 1, "center");
      btn("tilt", x + 8, 94, 136, 22, tiltOn ? C.mint : "#1a1430", "НАКЛОН: " + (tiltOn ? "ВКЛ" : "ВЫКЛ"), tiltOn ? INK : C.cream);
      drawText(ctx, "ЗВУК И ВИБРО - СКОРО", LW / 2, 124, "#9a8ab8", 1, "center");
      btn("set", x + 26, 136, 100, 16, C.navy, "ЗАКРЫТЬ");
    }
    drawFlash();
  }
  function drawBgSwatch(x: number, y: number, w: number, h: number, id: string) {
    var sk = skyAt(id, 0);
    for (var i = 0; i < h; i += 2) rect(ctx, x, y + i, w, 2, i < h / 2 ? mixHex(sk[0], sk[1], i / (h / 2)) : mixHex(sk[1], sk[2], (i - h / 2) / (h / 2)));
    var pt = MAP_PLAT[id] || MAP_PLAT.city;
    rect(ctx, x + 4, y + 18, 16, 3, pt.n); rect(ctx, x + 4, y + 18, 16, 1, pt.edge);
    if (id === "city") {
      rect(ctx, x + 2, y + h - 9, 5, 9, "#221852"); rect(ctx, x + 8, y + h - 13, 6, 13, "#1c1444"); rect(ctx, x + 15, y + h - 8, 6, 8, "#221852");
      rect(ctx, x + 10, y + h - 10, 1, 1, "#ffd060");
    } else if (id === "jungle") {
      rect(ctx, x, y + h - 6, w, 6, "#2a4e36"); rect(ctx, x + 5, y + 11, 14, 3, "#ff6848");
    } else if (id === "ice") {
      rect(ctx, x, y + h - 7, w, 7, "#6eb8e8"); rect(ctx, x, y + h - 7, w, 2, "#ffffff");
    } else if (id === "lava") {
      rect(ctx, x, y + h - 6, w, 6, "#4a1830"); rect(ctx, x + 3, y + h - 6, w - 6, 2, "#ff7828");
    } else if (id === "aqua") {
      rect(ctx, x, y + h - 5, w, 5, "#d8b46c"); rect(ctx, x + 6, y + 10, 5, 5, "#ff6ec8");
    } else {
      rect(ctx, x + 5, y + 7, 6, 6, "#e88a62"); rect(ctx, x + 3, y + 10, 10, 1, "#fff0b4");
    }
  }
  function drawShop() {
    drawBg(ctx, MENU_CAM(), ui, save.bg, true);
    dimView(ctx, "rgba(18,14,44,0.32)");
    var x = colX();
    header("МАГАЗИН", 2);
    coinsLabel(LW - 6, 12, save.coins, "right");
    var pw = 22, gap = 4, sx = Math.round(LW / 2 - (6 * pw + 5 * gap) / 2);
    for (var k = 0; k < 6; k++) {
      var bx = sx + k * (pw + gap), by = 36, H = CHARS[k], own = heroOwned(k), sel = k === shopHero, on = save.char === k;
      addHit("hero:" + k, bx, by, pw, 22);
      box(ctx, bx, by, pw, 22, sel ? "#2a2050" : C.navy, sel ? C.gold : own ? C.cream : "#5a4a72");
      ctx.save(); ctx.beginPath(); ctx.rect(bx + 1, by + 1, pw - 2, 20); ctx.clip();
      drawJumper(ctx, bx + 3, by + 4, makeLook(k, "base", "none"), 1, "idle", false, true, 1);
      ctx.restore();
      if (on) {
        var qx = bx + pw - 8, qy = by + 1;
        rect(ctx, qx, qy, 7, 7, C.mint);
        rect(ctx, qx + 1, qy + 3, 2, 1, INK); rect(ctx, qx + 2, qy + 4, 2, 1, INK);
        rect(ctx, qx + 4, qy + 2, 1, 1, INK); rect(ctx, qx + 5, qy + 1, 1, 1, INK);
      }
    }
    var i = shopHero, H2 = CHARS[i], own2 = heroOwned(i), on2 = save.char === i;
    var y0 = 64, ch = LH - y0 - 42;
    box(ctx, x, y0, 152, ch, on2 ? "#2a2050" : C.navy, on2 ? C.gold : own2 ? C.cream : "#6a5a8a");
    var mid = y0 + 52;
    rect(ctx, x + 40, mid + 8, 72, 4, C.wood); rect(ctx, x + 40, mid + 8, 72, 1, C.edge);
    var ph = (ui % 70) / 70, pose = ui % 280 > 230 ? "ability" : ph < 0.08 ? "squash" : ph < 0.5 ? "up" : "fall";
    var hop = pose === "ability" ? 6 : Math.round(Math.sin(ph * Math.PI) * 10);
    drawJumper(ctx, LW / 2 - 12, mid + 8 - 32 - hop, makeLook(i, save.color, save.hat), 1, pose, ui % 170 < 6, true, 2);
    drawText(ctx, H2.name, LW / 2, mid + 16, C.cream, 2, "center");
    var tw = textWidth(H2.abName, 1) + 10;
    box(ctx, Math.round(LW / 2 - tw / 2), mid + 34, tw, 12, "#3a4ac8", C.cream);
    drawText(ctx, H2.abName, LW / 2, mid + 37, C.cream, 1, "center");
    drawText(ctx, H2.type, LW / 2, mid + 50, C.gold, 1, "center");
    drawText(ctx, H2.abDesc[0], LW / 2, mid + 62, C.cream, 1, "center");
    drawText(ctx, H2.abDesc[1], LW / 2, mid + 72, C.cream, 1, "center");
    drawChargeLine(LW / 2, mid + 84, H2, "#9a8ab8");
    var byb = y0 + ch - 28;
    if (on2) btn("hero:act", x + 10, byb, 132, 22, "#2a2050", "ВЫБРАН", C.gold, 1, C.gold);
    else if (own2) btn("hero:act", x + 10, byb, 132, 22, C.mint, "ВЫБРАТЬ", INK);
    else drawBuy("hero:act", x + 10, byb, 132, 22, H2.price);
    btn("back", x + 26, LH - 34, 100, 22, C.navy, "НАЗАД");
    drawFlash();
  }
  function bar(x: number, y: number, w: number, h: number, f: number, col: string) {
    rect(ctx, x, y, w, h, "#1a1430");
    rect(ctx, x, y, Math.max(0, Math.round(w * clamp(f, 0, 1))), h, col);
  }
  function drawCamp() {
    drawBg(ctx, MENU_CAM(), ui, save.bg, true);
    dimView(ctx, "rgba(18,14,44,0.34)");
    var x = colX();
    header("КАМПАНИЯ", 2);
    coinsLabel(LW - 6, 12, save.coins, "right");
    box(ctx, x, 36, 152, 22, "#1a1430", C.mint);
    drawText(ctx, "ДОЙДИ ДО ЦЕЛИ →", LW / 2, 39, C.cream, 1, "center");
    drawText(ctx, "ОТКРОЙ ЗА МОНЕТЫ", LW / 2, 49, C.mint, 1, "center");
    var top = 62, bot = LH - 40, rh = Math.min(42, Math.floor((bot - top) / MAPS.length));
    for (var i = 0; i < MAPS.length; i++) {
      var M = MAPS[i], y = top + i * rh, open = mapOpen(i), can = !open && mapGoalMet(i), locked = !open && !can;
      var bd = save.bg === M.id ? C.gold : open ? C.cream : can ? C.mint : "#4a3a6a";
      addHit("camp:" + i, x, y, 152, rh - 3);
      box(ctx, x, y, 152, rh - 3, open ? (save.bg === M.id ? "#2a2050" : C.navy) : "#1a1430", bd);
      drawBgSwatch(x + 3, y + 3, 20, rh - 9, M.id);
      if (!open) { ctx.globalAlpha = 0.55; rect(ctx, x + 3, y + 3, 20, rh - 9, "#0c0818"); ctx.globalAlpha = 1; }
      drawText(ctx, (i + 1) + ". " + M.name, x + 28, y + 3, open || can ? C.cream : "#9a8ab8", 1, "left");
      if (open) {
        var b = mapBest(i);
        if (M.goal) {
          drawText(ctx, (b >= M.goal ? "✓ " : "") + "ЦЕЛЬ " + M.goal + " М", x + 28, y + 13, b >= M.goal ? C.mint : C.gold, 1, "left");
          drawText(ctx, b + "/" + M.goal, x + 148, y + 3, C.cream, 1, "right");
          bar(x + 28, y + rh - 11, 107, 5, b / M.goal, b >= M.goal ? C.mint : C.gold);
        } else drawText(ctx, "РЕКОРД " + b + " М", x + 28, y + 15, C.gold, 1, "left");
      } else if (can) {
        drawBuy("camp:open:" + i, x + 28, y + rh - 20, 120, 16, M.price);
      } else {
        drawText(ctx, MAPS[i - 1].goal + " М " + WHERE[i - 1], x + 28, y + 13, "#9a8ab8", 1, "left");
        drawText(ctx, "● " + M.price, x + 28, y + 23, C.gold, 1, "left");
      }
    }
    btn("back", x + 26, LH - 34, 100, 22, C.navy, "НАЗАД");
    if (campCard >= 0) drawCampCard();
    drawFlash();
  }
  function drawCampCard() {
    var i = campCard, M = MAPS[i], open = mapOpen(i), can = !open && mapGoalMet(i);
    var x = colX(), y = Math.round(LH / 2 - 70);
    dimView(ctx, "rgba(8,6,20,0.55)");
    box(ctx, x, y, 152, 140, C.navy, open ? C.gold : can ? C.mint : C.cream);
    drawBgSwatch(x + 8, y + 8, 36, 28, M.id);
    drawText(ctx, M.name, x + 50, y + 10, C.cream, 2, "left");
    var tip = mapTip(M.id);
    if (tip) drawText(ctx, tip, x + 50, y + 26, C.gold, 1, "left");
    drawText(ctx, "РЕКОРД " + mapBest(i) + " М", x + 8, y + 42, C.cream, 1, "left");
    if (M.goal) {
      var b = mapBest(i);
      drawText(ctx, "ЦЕЛЬ " + M.goal + " М", x + 8, y + 54, C.gold, 1, "left");
      bar(x + 8, y + 66, 136, 6, b / M.goal, b >= M.goal ? C.mint : C.gold);
      drawText(ctx, b + "/" + M.goal, x + 144, y + 54, C.cream, 1, "right");
    }
    if (open) btn("camp:play", x + 8, y + 104, 136, 26, C.mint, "ИГРАТЬ ▶", INK, 2);
    else if (can) drawBuy("camp:open", x + 8, y + 104, 136, 26, M.price);
    else drawText(ctx, "СНАЧАЛА " + MAPS[i - 1].goal + " М " + WHERE[i - 1], LW / 2, y + 112, "#c8b8e0", 1, "center");
    addHit("back", 0, 0, LW, y);
    addHit("back", 0, y + 140, LW, LH - y - 140);
  }
  function drawLobby() { /* UI only: bot lobby now, online room UI can hook here later */
    drawBg(ctx, MENU_CAM(), ui, save.bg, true);
    dimView(ctx, "rgba(18,14,44,0.32)");
    var x = colX();
    header("ЗАБЕГ С БОТАМИ", 1);
    var ps = lobbyNames();
    for (var i = 0; i < ps.length; i++) {
      var y = 44 + i * 26;
      box(ctx, x, y, 152, 23, i === 0 ? "#2a2050" : C.navy, i === 0 ? C.gold : C.cream);
      drawJumper(ctx, x + 6, y + 5, ps[i].look, 1, "idle", (ui + i * 50) % 170 < 6, true, 1);
      drawText(ctx, ps[i].name, x + 28, y + 3, C.cream, 1, "left");
      drawText(ctx, ps[i].tag, x + 28, y + 13, i === 0 ? C.gold : "#9a8ab8", 1, "left");
      drawText(ctx, CHARS[ps[i].kind].abName, x + 148, y + 8, "#9a8ab8", 1, "right");
    }
    var my = 44 + 4 * 26 + 6;
    btn("lmap:prev", x, my, 20, 18, "#1a1430", "<", C.cream);
    btn("lmap:next", x + 132, my, 20, 18, "#1a1430", ">", C.cream);
    box(ctx, x + 22, my, 108, 18, C.navy, C.cream);
    drawText(ctx, "КАРТА: " + mapInfo(lobbyMap).name, LW / 2, my + 6, C.gold, 1, "center");
    btn("go", x, Math.max(my + 28, LH - 66), 152, 26, C.mint, "НАЧАТЬ", INK, 2);
    btn("back", x + 26, LH - 34, 100, 22, C.navy, "НАЗАД");
  }
  function lobbyNames() {
    var out: any[] = [{ kind: save.char, look: lookNow(), name: CHARS[save.char].name, tag: "ТЫ" }];
    var bk = botKinds(save.char);
    for (var k = 0; k < bk.length; k++) out.push({ kind: bk[k], look: makeLook(bk[k], "base", "none"), name: CHARS[bk[k]].name, tag: "БОТ" });
    return out;
  }

  function poseOf(p: any) {
    if (p.abFx > 0 || p.poundT > 0 || p.dashT > 0 || p.hookN > 0 || p.wall || p.teleFx > 10 || p.domeT > 170) return "ability";
    if (p.squash > 3) return "squash";
    if (p.vy < -2.2) return "up";
    if (p.vy > 1.5) return "fall";
    return "idle";
  }
  function dashLine(y: number, label: string, col: string, right: boolean) {
    if (y < -8 || y > LH + 8) return;
    var yy = Math.round(y);
    for (var x = 0; x < LW; x += 6) rect(ctx, x, yy, 3, 1, col);
    var tw = textWidth(label, 1) + 6;
    var lx = right ? LW - tw - 4 : 4;
    box(ctx, lx, yy - 6, tw, 11, "#0c0818", col);
    drawText(ctx, label, lx + tw / 2, yy - 4, col, 1, "center");
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
    if (w.goalM) dashLine(-w.goalM * PX_PER_M - cam, "ЦЕЛЬ " + w.goalM + " М", C.gold, false);
    if (w.recM) dashLine(-w.recM * PX_PER_M - cam, "РЕКОРД " + w.recM, C.cream, true);
    for (i = 0; i < w.coins.length; i++) {
      var cn = w.coins[i];
      if (!cn.taken && cn.y - cam > -8 && cn.y - cam < LH + 4) drawCoin(ctx, cn.x, Math.round(cn.y - cam), w.tick + i * 3);
    }
    for (i = 0; i < w.items.length; i++) drawItem(ctx, w.items[i], cam, w.tick);
    for (i = 0; i < w.monsters.length; i++) drawMob(ctx, w.monsters[i], cam, w.map, w.freezeMobT > 0);
    for (i = 0; i < w.bullets.length; i++) drawBullet(ctx, w.bullets[i], cam);
    for (i = 0; i < w.particles.length; i++) {
      var pt = w.particles[i];
      ctx.globalAlpha = clamp(pt.life / pt.max, 0, 1);
      rect(ctx, pt.x, pt.y - cam, pt.s, pt.s, pt.col);
    }
    ctx.globalAlpha = 1;
    var tags: any[] = [];
    for (var pi = w.players.length - 1; pi >= 0; pi--) {
      var p = w.players[pi];
      var sy = p.y - cam;
      if (sy < -22 || sy > LH + 10) continue;
      var blink = (w.tick + p.id * 41) % 170 < 6;
      var pose = p.alive ? poseOf(p) : "fall";
      drawFxBack(p, sy, cam);
      drawJumper(ctx, p.x, sy, p.look, p.face, pose, blink, p.alive);
      drawFxFront(p, sy);
      if (p.wallT > 0) {} else if (p.x < 6) drawJumper(ctx, p.x + LW, sy, p.look, p.face, pose, blink, p.alive);
      if (p.wallT <= 0 && p.x > LW - PW - 6) drawJumper(ctx, p.x - LW, sy, p.look, p.face, pose, blink, p.alive);
      if (w.mode === "squad") tags.push({ p: p, x: p.x + 6, y: Math.round(sy) - 13 });
    }
    tags.sort(function (a: any, b: any) { return b.y - a.y; });
    for (i = 0; i < tags.length; i++) {
      var tg = tags[i];
      var isMe = tg.p.id === 0;
      var label = !tg.p.alive ? "ВЫБЫЛ" : isMe ? "▼" : (tg.p.name || "БОТ").slice(0, 3);
      tg.w = textWidth(label, 1) + 4;
      for (var j = 0; j < i; j++) {
        var o = tags[j];
        if (Math.abs(o.x - tg.x) < (o.w + tg.w) / 2 + 1 && Math.abs(o.y - tg.y) < 10) tg.y = o.y - 10;
      }
      var lx = clamp(tg.x, tg.w / 2 + 1, LW - 12 - tg.w / 2);
      ctx.globalAlpha = isMe ? 0.85 : 0.5;
      if (!isMe) rect(ctx, Math.round(lx - tg.w / 2), tg.y, tg.w, 9, tg.p.alive ? C.navy : "#4a1020");
      drawText(ctx, label, lx, tg.y + (isMe ? 2 : 1), tg.p.alive ? (isMe ? C.gold : C.cream) : C.red, 1, "center");
      ctx.globalAlpha = 1;
    }
    ctx.restore();

    var me = w.players[0];
    var label = metersOf(me) + " М";
    var hw = textWidth(label, 1) + 10;
    box(ctx, Math.round(LW / 2 - hw / 2), 6, hw, 13, C.navy, C.cream);
    drawText(ctx, label, LW / 2, 9, C.cream, 1, "center");
    box(ctx, 4, 6, textWidth(String(w.runCoins), 1) + 15, 13, C.navy, C.gold);
    coinsLabel(7, 9, w.runCoins);
    var wantPause = wantTouchPause();
    if (w.mode === "squad") {
      var place = 1;
      for (i = 0; i < w.players.length; i++) if (w.players[i] !== me && metersOf(w.players[i]) > metersOf(me)) place++;
      var pl = place + "/" + w.players.length;
      var pw2 = textWidth(pl, 1) + 8;
      var pr = wantPause ? LW - 22 : LW - 4;
      box(ctx, pr - pw2, 6, pw2, 13, C.navy, C.cream);
      drawText(ctx, pl, pr - 4, 9, C.cream, 1, "right");
    }
    if (wantPause) {
      addHit("pause", LW - 20, 4, 16, 16);
      box(ctx, LW - 20, 4, 16, 16, pressId === "pause" ? "#3a4a7a" : C.navy, C.cream);
      rect(ctx, LW - 15, 8, 2, 8, C.cream);
      rect(ctx, LW - 11, 8, 2, 8, C.cream);
    }
    drawBonusHud(me);
    drawAbBar(me);
    if (w.toastT > 0) {
      var tw2 = textWidth(w.toast, 1) + 12;
      ctx.globalAlpha = Math.min(1, w.toastT / 15);
      box(ctx, Math.round(LW / 2 - tw2 / 2), 38, tw2, 13, C.navy, C.gold);
      drawText(ctx, w.toast, LW / 2, 41, C.gold, 1, "center");
      ctx.globalAlpha = 1;
    }
    if (w.tick < 170) {
      ctx.globalAlpha = clamp((170 - w.tick) / 40, 0, 1);
      var hx2 = colX();
      box(ctx, hx2, LH - 46, 152, 12, C.navy, C.cream);
      drawText(ctx, (typeof window !== "undefined" && window.innerWidth >= 540) ? "← → ХОД · ↑ СПОСОБНОСТЬ" : "ТАПАЙ СЛЕВА И СПРАВА", LW / 2, LH - 44, C.cream, 1, "center");
      ctx.globalAlpha = 1;
    }
    if (paused) {
      dimView(ctx, "rgba(8,6,20,0.55)");
      box(ctx, colX(), LH / 2 - 48, 152, 100, C.navy, C.gold);
      drawText(ctx, "ПАУЗА", LW / 2, LH / 2 - 38, C.gold, 2, "center");
      if (landPause) drawText(ctx, "ПОВЕРНИ ТЕЛЕФОН", LW / 2, LH / 2 - 16, C.cream, 1, "center");
      btn("resume", colX() + 10, LH / 2 - (landPause ? 4 : 8), 132, 22, C.mint, "ПРОДОЛЖИТЬ", INK);
      btn("menu", colX() + 10, LH / 2 + 18, 132, 22, C.navy, "МЕНЮ");
    }
  }
  function drawFxBack(p: any, sy: number, cam: number) {
    var cx = Math.round(p.x + 6), cy = Math.round(sy + 8), k;
    if (p.hookN > 0) {
      var hx = Math.round(p.htx + 6), hy = Math.round(p.hty - cam);
      var n = Math.max(2, Math.round(Math.abs(hy - sy) / 3));
      for (k = 0; k <= n; k++) rect(ctx, Math.round(cx + (hx - cx) * k / n), Math.round(sy + 2 + (hy - sy - 2) * k / n), 1, 1, k % 2 ? "#c8a070" : "#7a5030");
      rect(ctx, hx - 2, hy - 1, 5, 2, "#d8dce8"); rect(ctx, hx - 2, hy - 3, 1, 2, "#d8dce8"); rect(ctx, hx + 2, hy - 3, 1, 2, "#d8dce8");
    }
    if (p.grabT > 0 && p.grabMob) { for (k = 0; k < 4; k++) rect(ctx, cx - 5 + k * 3, cy - 2 + (k % 2) * 3, 3, 2, "#3a9a2a"); }
    if (p.magnetT > 0 && (ui >> 2) % 2) { ctx.globalAlpha = 0.35; for (k = 0; k < 8; k++) { var a = k * 0.785 + ui * 0.05; rect(ctx, cx + Math.cos(a) * 15, cy + Math.sin(a) * 15, 1, 1, "#ff5a62"); } ctx.globalAlpha = 1; }
    if (p.teleFx > 0) { ctx.globalAlpha = p.teleFx / 18; for (k = 0; k < 10; k++) { var a2 = k * 0.63 + ui * 0.2, r2 = 18 - p.teleFx * 0.6; rect(ctx, cx + Math.cos(a2) * r2, cy + Math.sin(a2) * r2, 2, 2, k % 2 ? "#e8c8ff" : "#a060ff"); } ctx.globalAlpha = 1; }
  }
  function ring(cx: number, cy: number, r: number, col: string, alpha: number) {
    ctx.globalAlpha = alpha;
    for (var k = 0; k < 28; k++) { var a = (k / 28) * Math.PI * 2; rect(ctx, Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r), 1, 1, col); }
    ctx.globalAlpha = 1;
  }
  function drawFxFront(p: any, sy: number) {
    if (!p.alive) return;
    var cx = Math.round(p.x + 6), cy = Math.round(sy + 6);
    if (p.domeT > 0 && (p.domeT > 50 || (p.domeT >> 2) % 2)) { ring(cx, cy, 15, "#7ad8ff", 0.9); ring(cx, cy, 14, "#c8f4ff", 0.35); ctx.globalAlpha = 0.12; rect(ctx, cx - 10, cy - 10, 20, 20, "#7ad8ff"); ctx.globalAlpha = 1; }
    else if (p.shieldT > 0 && (p.shieldT > 80 || (p.shieldT >> 2) % 2)) ring(cx, cy, 13, "#5ec8ff", 0.7);
    if (p.freezeT > 0) { ctx.globalAlpha = 0.45; rect(ctx, p.x - 2, sy - 6, PW + 4, PH + 6, "#c8f8ff"); ctx.globalAlpha = 1; }
    if (p.rocketT > 0) { rect(ctx, cx - 2, sy + PH, 4, 3 + (ui % 3), "#ffd046"); rect(ctx, cx - 1, sy + PH + 3, 2, 3, "#ff7830"); }
    if (p.wallT > 0 && p.id === 0 && !p.wall) { ctx.globalAlpha = 0.5 + 0.3 * Math.sin(ui * 0.3); rect(ctx, 0, 0, 1, LH, "#d82a2a"); rect(ctx, LW - 1, 0, 1, LH, "#d82a2a"); ctx.globalAlpha = 1; }
  }
  var BON_HUD: any[] = [["shieldT", "shield", 500], ["magnetT", "magnet", 450], ["x2T", "x2", 500], ["rocketT", "rocket", 85], ["domeT", "shield", 200], ["wallT", "rocket", 300]];
  function drawBonusHud(me: any) {
    var x = 4, y = 22;
    for (var i = 0; i < BON_HUD.length; i++) {
      var b = BON_HUD[i], t = me[b[0]];
      if (!(t > 0)) continue;
      box(ctx, x, y, 14, 18, C.navy, ITEM_COL[b[1]] || C.cream);
      if (b[0] === "domeT") { rect(ctx, x + 3, y + 3, 8, 6, "#7ad8ff"); rect(ctx, x + 5, y + 2, 4, 1, "#7ad8ff"); }
      else if (b[0] === "wallT") { rect(ctx, x + 2, y + 2, 2, 9, "#a8a8b8"); rect(ctx, x + 5, y + 4, 6, 2, "#d82a2a"); rect(ctx, x + 6, y + 6, 4, 4, "#26305a"); }
      else drawItemIcon(ctx, b[1], x + 2, y + 1);
      var f = clamp(t / b[2], 0, 1);
      rect(ctx, x + 2, y + 14, 10, 2, "#1a1430"); rect(ctx, x + 2, y + 14, Math.max(1, Math.round(10 * f)), 2, ITEM_COL[b[1]] || C.cream);
      x += 16;
    }
  }
  function fillDisc(cx: number, cy: number, r: number, col: string) {
    for (var y = -r; y <= r; y++) { var hw = Math.floor(Math.sqrt(r * r - y * y)); rect(ctx, cx - hw, cy + y, hw * 2 + 1, 1, col); }
  }
  function strokeArc(cx: number, cy: number, r: number, col: string, frac: number) {
    if (frac <= 0) return;
    var n = Math.max(20, r * 10), steps = Math.max(1, Math.round(n * Math.min(1, frac))), i;
    for (i = 0; i <= steps; i++) {
      var a = -Math.PI / 2 + (i / n) * Math.PI * 2;
      rect(ctx, Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r), 1, 1, col);
    }
  }
  function drawAbIcon(ab: string, x: number, y: number) {
    if (ab === "dash") {
      rect(ctx, x + 5, y + 1, 2, 1, "#7ad8ff"); rect(ctx, x + 4, y + 2, 4, 2, "#7ad8ff"); rect(ctx, x + 5, y + 4, 2, 3, "#c8f4ff");
      rect(ctx, x + 4, y + 7, 4, 2, "#ffd046"); rect(ctx, x + 5, y + 9, 2, 2, "#ff7830"); rect(ctx, x + 3, y + 8, 1, 2, "#ff7830"); rect(ctx, x + 8, y + 8, 1, 2, "#ff7830");
    } else if (ab === "hook") {
      rect(ctx, x + 6, y + 1, 1, 7, "#c8a070"); rect(ctx, x + 5, y + 1, 3, 1, "#c8a070");
      rect(ctx, x + 7, y + 8, 3, 1, "#d8dce8"); rect(ctx, x + 9, y + 6, 1, 2, "#d8dce8"); rect(ctx, x + 4, y + 8, 2, 2, "#d8dce8");
    } else if (ab === "wall") {
      rect(ctx, x + 1, y + 2, 2, 8, "#a8a8b8"); rect(ctx, x + 9, y + 2, 2, 8, "#a8a8b8");
      rect(ctx, x + 4, y + 5, 4, 1, "#d82a2a"); rect(ctx, x + 6, y + 3, 1, 5, "#d82a2a"); rect(ctx, x + 5, y + 4, 3, 1, "#d82a2a");
    } else if (ab === "dome") {
      rect(ctx, x + 4, y + 2, 4, 1, "#7ad8ff"); rect(ctx, x + 3, y + 3, 6, 1, "#7ad8ff");
      rect(ctx, x + 2, y + 4, 1, 5, "#7ad8ff"); rect(ctx, x + 9, y + 4, 1, 5, "#7ad8ff"); rect(ctx, x + 3, y + 9, 6, 1, "#7ad8ff");
      rect(ctx, x + 5, y + 5, 2, 2, "#c8f4ff");
    } else if (ab === "tele") {
      rect(ctx, x + 5, y + 2, 2, 2, "#e8c8ff"); rect(ctx, x + 3, y + 5, 6, 2, "#a060ff"); rect(ctx, x + 5, y + 8, 2, 2, "#e8c8ff");
      rect(ctx, x + 1, y + 5, 1, 1, "#e8c8ff"); rect(ctx, x + 10, y + 6, 1, 1, "#e8c8ff");
      rect(ctx, x + 2, y + 2, 1, 1, "#c890ff"); rect(ctx, x + 9, y + 9, 1, 1, "#c890ff");
    } else if (ab === "pound") {
      rect(ctx, x + 4, y + 1, 4, 1, "#d8dce8"); rect(ctx, x + 3, y + 2, 6, 5, "#c02a2a");
      rect(ctx, x + 4, y + 3, 4, 3, "#ffd046"); rect(ctx, x + 5, y + 7, 2, 1, "#c02a2a");
      rect(ctx, x + 4, y + 8, 4, 1, "#ffd046"); rect(ctx, x + 5, y + 9, 2, 2, "#ffd046");
    }
  }
  function icoClock(x: number, y: number, col: string) {
    rect(ctx, x + 1, y, 5, 1, col); rect(ctx, x, y + 1, 7, 5, col); rect(ctx, x + 1, y + 6, 5, 1, col);
    rect(ctx, x + 1, y + 1, 5, 5, "#0c0818");
    rect(ctx, x + 3, y + 2, 1, 3, col); rect(ctx, x + 3, y + 4, 2, 1, col);
  }
  function drawChargeLine(cx: number, y: number, H: any, col: string) {
    var ic = H.charge, chg = ic === "time" ? Math.round(H.need / 50) + " СЕК" : ic === "coins" ? String(H.need) : ic === "height" ? H.need + " М" : H.need + " МОБА";
    var pre = "ЗАРЯД: ", iw = 8, gap = 2, tw = textWidth(pre, 1) + iw + gap + textWidth(chg, 1);
    var x0 = Math.round(cx - tw / 2);
    drawText(ctx, pre, x0, y, col, 1, "left");
    var ix = x0 + textWidth(pre, 1);
    if (ic === "time") icoClock(ix, y, col);
    else if (ic === "coins") drawCoin(ctx, ix, y + 1, ui);
    else if (ic === "height") drawText(ctx, "↑", ix, y, C.mint, 1, "left");
    else icoSkull(ix, y, col);
    drawText(ctx, chg, ix + iw + gap, y, col, 1, "left");
  }
  function icoSkull(x: number, y: number, col: string) {
    rect(ctx, x + 1, y, 5, 4, col); rect(ctx, x + 2, y + 4, 3, 2, col); rect(ctx, x + 2, y + 1, 1, 1, "#0c0818"); rect(ctx, x + 4, y + 1, 1, 1, "#0c0818");
  }
  function drawAbBar(me: any) {
    var H = CHARS[me.kind], b = abBar();
    addHit("ab", b.x, b.y, b.w, b.h);
    var ready = me.alive && me.abCharge >= H.need, active = !!(me.wall);
    var f = clamp(me.abCharge / H.need, 0, 1);
    box(ctx, b.x, b.y, b.w, b.h, "#12101c", ready ? C.gold : C.cream);
    var rad = 9, cx = b.x + 14, cy = b.y + 13;
    var rim = ready ? ((ui >> 3) % 2 ? C.gold : C.cream) : active ? "#d82a2a" : "#3a4a7a";
    fillDisc(cx, cy, rad + 1, rim);
    fillDisc(cx, cy, rad, "#1a1430");
    strokeArc(cx, cy, rad, ready ? C.gold : (active ? "#ff5a62" : "#5ec8ff"), ready ? 1 : f);
    ctx.globalAlpha = ready || active ? 1 : 0.55;
    drawAbIcon(H.ab, cx - 6, cy - 6);
    ctx.globalAlpha = 1;
    var lab = me.wall ? "ПРЫЖОК" : H.abName;
    var ic = H.charge, chg = ic === "time" ? Math.round(f * 100) + "%" : Math.min(H.need, Math.floor(me.abCharge)) + "/" + H.need;
    var tcol = ready ? C.gold : C.cream, ty = b.y + 9;
    drawText(ctx, lab, b.x + 28, ty, tcol, 1, "left");
    var rw = textWidth(chg, 1), rx = b.x + b.w - 6;
    var ix = rx - rw - 9;
    if (ic === "time") icoClock(ix, ty, tcol);
    else if (ic === "coins") drawCoin(ctx, ix, ty + 1, ui);
    else if (ic === "height") drawText(ctx, "↑", ix, ty, C.mint, 1, "left");
    else icoSkull(ix, ty, tcol);
    drawText(ctx, chg, rx, ty, tcol, 1, "right");
  }
  function whyText(p: any) {
    var m = metersOf(p), w = p.why || "";
    if (w === "fall") return "УПАЛ НА " + m + " М";
    if (w === "shot") return "СБИЛ ВЫСТРЕЛ НА " + m + " М";
    if (w === "hole") return "ЗАТЯНУЛА ДЫРА НА " + m + " М";
    if (w.indexOf("mob:") === 0) {
      var mo = MOBS[w.slice(4)] || {};
      var nm = mo.name || "МОБ";
      return ((mo.g === "f") ? "СБИЛА " : "СБИЛ ") + nm + " НА " + m + " М";
    }
    return w ? w + " " + m + " М" : "";
  }
  function nextHeroNeed() {
    for (var i = 0; i < CHARS.length; i++) if (!heroOwned(i)) return { i: i, H: CHARS[i], left: Math.max(0, CHARS[i].price - save.coins) };
    return null;
  }
  function drawResults() {
    hits = [];
    drawBg(ctx, world.cameraY, ui, world.map);
    dimView(ctx, "rgba(18,14,44,0.36)");
    var x = colX();
    header("ИТОГИ", 2);
    var list = world.players.slice().sort(function (a: any, b: any) { return a.place - b.place; });
    var squad = world.mode === "squad";
    var rowH = squad ? 28 : 36;
    var y = 36;
    for (var i = 0; i < list.length; i++) {
      var p = list[i];
      var fill = p.place === 1 ? "#6a4a10" : p.place === 2 ? "#3a4050" : p.place === 3 ? "#4a3020" : C.navy;
      box(ctx, x, y, 152, rowH - 3, fill, p.id === 0 ? C.gold : C.cream);
      drawText(ctx, String(p.place), x + 10, y + (rowH - 3) / 2 - 6, p.place === 1 ? C.gold : C.cream, 2, "center");
      drawJumper(ctx, x + 22, y + Math.round((rowH - 3) / 2 - 8), p.look, 1, "idle", false, true);
      drawText(ctx, p.name + (p.id === 0 && squad ? " (ТЫ)" : ""), x + 42, y + 4, C.cream, 1, "left");
      drawText(ctx, metersOf(p) + " М", x + 42, y + 14, C.cream, 1, "left");
      y += rowH;
    }
    var me = world.players[0], mtr = metersOf(me), why = whyText(me);
    if (why) { box(ctx, x, y, 152, 14, "#201838", "#8a7ab8"); drawText(ctx, why, LW / 2, y + 4, "#d8c8f0", 1, "center"); y += 18; }
    var mi2 = mapIdx(world.map), M2 = MAPS[mi2];
    if (M2.goal && mi2 + 1 < MAPS.length) {
      var nxt = MAPS[mi2 + 1], b = mapBest(mi2), met = b >= M2.goal;
      if (met) {
        addHit("camp", x, y, 152, 22);
        box(ctx, x, y, 152, 22, C.navy, C.mint);
        drawText(ctx, nxt.name + ": МОЖНО ОТКРЫТЬ", LW / 2, y + 7, C.mint, 1, "center");
        y += 26;
      } else {
        box(ctx, x, y, 152, 28, C.navy, C.gold);
        drawText(ctx, "ДО " + TO[mi2 + 1], x + 6, y + 3, C.cream, 1, "left");
        drawText(ctx, b + "/" + M2.goal + " М", x + 146, y + 3, C.cream, 1, "right");
        bar(x + 6, y + 16, 140, 6, b / M2.goal, C.gold);
        y += 32;
      }
    }
    var rec = save.mapBest[world.map] || world.best || 0;
    box(ctx, x, y, 152, 44, C.navy, C.gold);
    drawText(ctx, "ВЫСОТА " + mtr + " М", x + 6, y + 4, C.cream, 1, "left"); coinsLabel(x + 146, y + 4, world.earnH || 0, "right");
    drawText(ctx, "СОБРАНО", x + 6, y + 15, C.cream, 1, "left"); coinsLabel(x + 146, y + 15, world.earnC || 0, "right");
    rect(ctx, x + 6, y + 25, 140, 1, "#5a4a7a");
    drawText(ctx, "ИТОГО", x + 6, y + 29, C.gold, 1, "left"); coinsLabel(x + 146, y + 29, world.earned || 0, "right");
    y += 48;
    if (world.newBest) { box(ctx, x, y, 152, 13, C.navy, C.gold); drawText(ctx, "НОВЫЙ РЕКОРД КАРТЫ " + rec + " М", LW / 2, y + 3, C.gold, 1, "center"); y += 16; }
    else { drawText(ctx, "РЕКОРД КАРТЫ " + rec + " М", LW / 2, y + 2, C.cream, 1, "center"); y += 14; }
    var nh = nextHeroNeed();
    if (nh) {
      if (nh.left === 0) {
        addHit("shop", x, y, 152, 22);
        box(ctx, x, y, 152, 22, C.navy, C.mint);
        drawText(ctx, "ХВАТАЕТ НА " + HTO[nh.i] + "!", LW / 2, y + 7, C.mint, 1, "center");
      } else {
        box(ctx, x, y, 152, 22, C.navy, C.coral);
        drawText(ctx, "ДО " + HTO[nh.i] + " ОСТАЛОСЬ ● " + nh.left, LW / 2, y + 3, C.cream, 1, "center");
        var runs = "ЕЩЁ " + Math.max(1, Math.ceil(nh.left / Math.max(8, world.earned || 8))) + " ЗАБЕГА";
        drawText(ctx, runs, LW / 2, y + 12, C.gold, 1, "center");
      }
    }
    var lab = squad ? "РЕВАНШ ▶" : "ЕЩЁ РАЗ ▶";
    btn("rematch", x, LH - 64, 152, 28, C.mint, lab, INK, 2);
    btn("menu", x, LH - 32, 72, 22, C.navy, "МЕНЮ");
    btn("shop", x + 80, LH - 32, 72, 22, C.navy, "МАГАЗИН");
  }
  function drawFontSheet() {
    hits = [];
    dimView(ctx, "#120c28");
    drawText(ctx, "ШРИФТ", LW / 2, 6, C.gold, 2, "center");
    var words = ["НИНДЗЯ", "МЕНЮ", "КОСМОЩИТ", "ЗАРЯД 40%", "КУПИТЬ ● 80", "ДОЙДИ ДО ЦЕЛИ →", "ИГРАТЬ ▶", "ЕЩЁ РАЗ ▶", "С БОТАМИ", "✓ ЦЕЛЬ 500 М"];
    for (var i = 0; i < words.length; i++) drawText(ctx, words[i], 6, 28 + i * 12, C.cream, 1, "left");
    var keys = Object.keys(FONT), x = 6, y = 28 + words.length * 12 + 8;
    for (var k = 0; k < keys.length; k++) {
      drawText(ctx, keys[k], x, y, C.mint, 1, "left");
      x += 12; if (x > LW - 12) { x = 6; y += 12; }
    }
    btn("back", colX() + 26, LH - 28, 100, 20, C.navy, "НАЗАД");
  }

  function frame(now: number) {
    if (!running) return;
    if (lastT < 0) lastT = now;
    var dt = Math.min(0.05, Math.max(0, (now - lastT) / 1000));
    lastT = now;
    uiAcc += dt;
    var uSteps = 0;
    while (uiAcc + 1e-9 >= UI_STEP && uSteps < 5) {
      ui++;
      if (flashT > 0) flashT--;
      uiAcc -= UI_STEP;
      uSteps++;
    }
    syncBackdrop(world ? world.map : save.bg);
    if (phase === "play" && world && world.phase === "play" && !paused) {
      acc += dt;
      var steps = 0;
      if (world.net && NET.waiting && NET.waiting(world)) acc = 0;
      while (acc + 1e-9 >= STEP && steps < 5) {
        tickWorld(world, collectInputs());
        acc -= STEP;
        steps++;
      }
      if (world.net && NET.frame) NET.frame(world);
      if (world.phase === "results") { payout(); phase = "results"; }
    } else acc = 0;
    ctx.imageSmoothingEnabled = false;
    hits = [];
    if (phase === "menu") drawMenu();
    else if (phase === "shop") drawShop();
    else if (phase === "camp") drawCamp();
    else if (phase === "lobby") drawLobby();
    else if (phase === "results") drawResults();
    else if (phase === "font") drawFontSheet();
    else if (phase === "net") { hits = []; NET.draw(netApi); drawFlash(); }
    else { drawPlay(); if (world && world.net) NET.overlay(netApi, world); }
    if (netFixedLW() !== netLW) resize();
    if (running && !driving) raf = requestAnimationFrame(frame);
  }

  /* net: what the online module may use from the shell */
  var netApi: any = {
    ctx: ctx, btn: btn, header: header, colX: colX, say: say, openMaps: openMaps, heroOwned: heroOwned,
    bg: function () { drawBg(ctx, MENU_CAM(), ui, save.bg, true); dimView(ctx, "rgba(18,14,44,0.32)"); },
    ui: function () { return ui; }, save: function () { return save; }, saveNow: function () { writeSave(save); },
    world: function () { return world; }, phase: function () { return phase; },
    setPhase: function (p: string) { phase = p; }, goMenu: goMenu,
    bots: function () { activate("mp"); }, startNet: startNet
  };
  NET.bind(netApi);
  NET.tryResume(netApi);
  function onVis() {
    acc = 0; uiAcc = 0; lastT = -1;
    if (document.hidden && phase === "play") paused = true;
  }
  function wantTouchPause() {
    if (!isWide) return true;
    try { return !!(navigator && navigator.maxTouchPoints); } catch (_e) { return false; }
  }
  var ptrRoot: any = wrap || canvas;
  resize();
  window.addEventListener("resize", resize);
  window.addEventListener("orientationchange", resize);
  if (window.visualViewport) window.visualViewport.addEventListener("resize", resize);
  var onCtx = function (e: any) { e.preventDefault(); };
  var onKD = function (e: any) { onKey(e, true); };
  var onKU = function (e: any) { onKey(e, false); };
  var noScroll = function (e: any) { e.preventDefault(); };
  ptrRoot.addEventListener("pointerdown", onPtrDown);
  ptrRoot.addEventListener("pointermove", onPtrMove);
  ptrRoot.addEventListener("pointerup", onPtrUp);
  ptrRoot.addEventListener("pointercancel", onPtrUp);
  canvas.addEventListener("contextmenu", onCtx);
  window.addEventListener("keydown", onKD);
  window.addEventListener("keyup", onKU);
  window.addEventListener("deviceorientation", onOrient);
  document.addEventListener("visibilitychange", onVis);
  document.addEventListener("touchmove", noScroll, { passive: false });
  document.addEventListener("gesturestart", noScroll);
  document.addEventListener("selectstart", noScroll);
  document.addEventListener("dragstart", noScroll);
  canvas.addEventListener("touchstart", noScroll, { passive: false });
  if (ptrRoot !== canvas) ptrRoot.addEventListener("touchstart", noScroll, { passive: false });
  raf = requestAnimationFrame(frame);

  return {
    destroy: function () {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("orientationchange", resize);
      if (window.visualViewport) window.visualViewport.removeEventListener("resize", resize);
      ptrRoot.removeEventListener("pointerdown", onPtrDown);
      ptrRoot.removeEventListener("pointermove", onPtrMove);
      ptrRoot.removeEventListener("pointerup", onPtrUp);
      ptrRoot.removeEventListener("pointercancel", onPtrUp);
      if (ptrRoot !== canvas) ptrRoot.removeEventListener("touchstart", noScroll);
      canvas.removeEventListener("contextmenu", onCtx);
      window.removeEventListener("keydown", onKD);
      window.removeEventListener("keyup", onKU);
      window.removeEventListener("deviceorientation", onOrient);
      document.removeEventListener("visibilitychange", onVis);
      document.removeEventListener("touchmove", noScroll);
      document.removeEventListener("gesturestart", noScroll);
      document.removeEventListener("selectstart", noScroll);
      document.removeEventListener("dragstart", noScroll);
      canvas.removeEventListener("touchstart", noScroll);
    },
    getPhase: function () { return phase; },
    getWorld: function () { return world; },
    net: NET,
    getSave: function () { return save; },
    getSize: function () { return { lw: LW, lh: LH, scale: SCALE, pScale: pScale, cssScale: cssScale, dpr: Math.max(1, window.devicePixelRatio || 1), isWide: isWide, cw: canvas.width, ch: canvas.height, viewPad: VIEW_PAD }; },
    tap: function (id: string) { activate(id); },
    screen: function (s: string) { phase = s; },
    start: function (m: string, seed?: number, mapId?: string) { mode = m || "solo"; if (mapId) save.bg = mapId; startRun(seed); },
    setDir: function (d: number) { held.kl = d < 0; held.kr = d > 0; },
    setAutoPlay: function (on: boolean) { autoPlay = !!on; },
    ability: function () { abTap = true; },
    setHero: function (k: number) { save.char = k; },
    addCoins: function (n: number) { save.coins += n; writeSave(save); },
    forceResults: function () { if (world) { finish(world); payout(); phase = "results"; } },
    pause: function (on: boolean) { paused = !!on; acc = 0; uiAcc = 0; lastT = -1; },
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
      var was = paused; paused = false;
      for (var i = 0; i < n && world.phase === "play"; i++) tickWorld(world, collectInputs());
      paused = was;
      if (world.phase === "results") { payout(); phase = "results"; }
      return { phase: world.phase, tick: world.tick, players: world.players.map(function (p: any) { return { name: p.name, alive: p.alive, m: metersOf(p), why: p.why }; }) };
    },
    advanceTime: function (seconds: number, hz: number) {
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
      driving = true;
      acc = 0; uiAcc = 0; lastT = 0;
      var ui0 = ui;
      var n = Math.max(0, Math.round(seconds * hz));
      var step = 1000 / hz;
      for (var i = 0; i < n; i++) frame((i + 1) * step);
      driving = false;
      if (running) raf = requestAnimationFrame(frame);
      ui0 = ui - ui0;
      var me = world && world.players[0];
      var platVx = 0;
      if (world) for (var j = 0; j < world.platforms.length; j++) if (world.platforms[j].type === "move") { platVx = world.platforms[j].vx; break; }
      return {
        tick: world ? world.tick : 0, ui: ui0, flashT: flashT,
        m: me ? metersOf(me) : 0, x: me ? me.x : 0, y: me ? me.y : 0,
        charge: me ? me.abCharge : 0, platVx: platVx, phase: phase
      };
    },
    checkGroundMobs: function () { return unsupportedMobs(world); },
    inspectMap: function (seed: number, toM: number, mapId?: string) {
      var w = createWorld(seed, "solo", 0, makeLook(0, "base", "none"), mapId || save.bg);
      generateUntil(w, -toM * PX_PER_M - 200);
      return {
        jumpH: JUMP_H, gapCap: GAP_CAP, rowSep: ROW_SEP, xSep: X_SEP,
        platforms: w.platforms.map(function (p: any) { return { x: p.x, y: p.y, w: p.w, type: p.type, spring: p.spring, row: p.row, vx: p.vx }; }),
        monsters: w.monsters.map(function (m: any) { return { kind: m.kind, x: m.x, y: m.y, w: m.w, h: m.h, b: m.b, topY: m.topY, home: !!m.home }; }),
        unsupported: unsupportedMobs(w),
        coins: w.coins.map(function (c: any) { return { x: c.x, y: c.y }; }),
        items: w.items.map(function (c: any) { return { kind: c.kind, x: c.x, y: c.y }; })
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
    <div style={{ position: "fixed", inset: 0, width: "100%", height: "100%", margin: 0, background: "#070510", overflow: "hidden", touchAction: "none", userSelect: "none", WebkitUserSelect: "none", WebkitTouchCallout: "none", WebkitTapHighlightColor: "transparent", display: "flex", alignItems: "center", justifyContent: "center", padding: "env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)" } as any}>
      <canvas ref={ref} tabIndex={0} style={{ display: "block", imageRendering: "pixelated", touchAction: "none", outline: "none", userSelect: "none", WebkitUserSelect: "none", WebkitTouchCallout: "none", WebkitTapHighlightColor: "transparent" } as any} />
      <div id="desk-hint" style={{ display: "none", position: "fixed", bottom: 6, left: 0, right: 0, textAlign: "center", font: "600 11px/1 monospace", color: "#9a8ab8", letterSpacing: "0.4px", pointerEvents: "none" }}>← → / A D — движение · ↑ / Пробел — способность · Esc — пауза</div>
    </div>
  );
}
