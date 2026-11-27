
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
  var abHintRun = false;
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
  var SCALE = 1, pScale = 1, pScaleY = 1, cssScale = 1, isWide = false, isPhone = false, phoneLand = false, lastBackdropMap = "";
  var cinemaOn = false, cinemaBtn: any = null;
  var fieldLocked = false, landPause = false, manualPause = false, lastFill = false;
  var resumeCd = 0, resumeAt = 0, abDenyT = 0, refuseT = 0, popT = -1, wasReady = false, coinT0 = -1, coinSkip = false;
  var pressId: any = null;
  var rankY: any = {};
  var rankHead: any = {};
  var confirmId: any = null, confirmAt = 0;
  var campCard = -1;
  var showSet = false;
  var menuLay: any = null;
  var screenLay: any[] = [];
  var resultLay: any[] = [];
  var pauseLay: any[] = [];
  var showProf = false;
  /* Tab/grid/portrait files live in game/ui/{tab,grid,portrait}. Replacing an icon is replacing that file. */
  var photoSlot: any = { url: "", cv: null, fail: false };
  var tgInsetBound = false;
  var paused = false;
  var netLW = 0;
  var WHERE = ["В ГОРОДЕ", "В ДЖУНГЛЯХ", "В ЛЕДНИКЕ", "НА ВУЛКАНЕ", "В ОКЕАНЕ", "В КОСМОСЕ"];
  var TO = ["ГОРОДА", "ДЖУНГЛЕЙ", "ЛЕДНИКА", "ВУЛКАНА", "ОКЕАНА", "КОСМОСА"];
  var HTO = ["КАПИТАНА", "ПИРАТА", "НИНДЗЯ", "РОБОТА", "МАГА", "РЫЦАРЯ"];

  warmHeroSprites();
  warmBonusSprites();
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
  /* Menu / lobby sky follows the map that is actually selected on this screen. */
  function menuMap() {
    if (world && (phase === "play" || phase === "results")) return world.map || save.bg;
    if (phase === "lobby") return lobbyMap || save.bg;
    if (phase === "net" && typeof NET !== "undefined" && NET && NET.room && NET.room.map) return NET.room.map;
    return save.bg;
  }
  /* Layout viewport (the fixed #wrap), not visualViewport: in Telegram iOS the visual viewport can be shorter
     than the webview (stripes above/below) and it shrinks while the keyboard is up. */
  var stableView: any = null, shrinkSince = 0, shrinkTimer: any = 0;
  function rawViewSize() {
    if (wrap) {
      var r = wrap.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) return { w: r.width, h: r.height, x: 0, y: 0 };
    }
    var vv = window.visualViewport;
    if (vv && vv.width > 0 && vv.height > 0) return { w: vv.width, h: vv.height, x: vv.offsetLeft || 0, y: vv.offsetTop || 0 };
    var r2 = canvas.getBoundingClientRect();
    return { w: Math.max(1, r2.width), h: Math.max(1, r2.height), x: 0, y: 0 };
  }
  function viewSize() {
    var v = rawViewSize();
    /* A phone keyboard (name prompt) shrinks the height for a moment with the width unchanged.
       Keep the last stable size; accept the new one only if it is still there 1.2 s later. */
    if (stableView && isCoarsePointer() && Math.abs(v.w - stableView.w) < 2 && v.h < stableView.h * 0.85) {
      var t = Date.now();
      if (!shrinkSince) shrinkSince = t;
      if (t - shrinkSince < 1200) {
        if (!shrinkTimer) shrinkTimer = setTimeout(function () { shrinkTimer = 0; resize(); }, 1250);
        return stableView;
      }
    }
    shrinkSince = 0;
    stableView = v;
    return v;
  }
  function isCoarsePointer() {
    try {
      if (window.matchMedia) {
        if (window.matchMedia("(pointer: coarse)").matches) return true;
        if (window.matchMedia("(any-pointer: coarse)").matches) return true;
      }
    } catch (_e) {}
    try { if (navigator && (navigator.maxTouchPoints || 0) > 0) return true; } catch (_e2) {}
    try { if ("ontouchstart" in window) return true; } catch (_e3) {}
    return false;
  }
  function cinemaAllowed() {
    try {
      var tg = (window as any).Telegram && (window as any).Telegram.WebApp;
      if (tg && tg.initData) return false;
    } catch (_e) {}
    try {
      if (window.matchMedia && window.matchMedia("(pointer: coarse)").matches) return false;
    } catch (_e2) {}
    return true;
  }
  function typingTarget(e: any) {
    var t = e && e.target;
    if (!t) return false;
    var tag = String(t.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea" || tag === "select") return true;
    return !!t.isContentEditable;
  }
  function paintCinemaBtn() {
    if (!cinemaBtn) return;
    var c = cinemaBtn.firstChild;
    var g = c && c.getContext && c.getContext("2d");
    if (!g) return;
    g.imageSmoothingEnabled = false;
    g.fillStyle = "#162040";
    g.fillRect(0, 0, 22, 22);
    g.fillStyle = "#f6ecd0";
    g.fillRect(0, 0, 22, 1); g.fillRect(0, 21, 22, 1); g.fillRect(0, 0, 1, 22); g.fillRect(21, 0, 1, 22);
    g.fillStyle = cinemaOn ? "#62e6be" : "#f6ecd0";
    g.fillRect(4, 4, 5, 1); g.fillRect(4, 4, 1, 5);
    g.fillRect(13, 4, 5, 1); g.fillRect(17, 4, 1, 5);
    g.fillRect(4, 17, 5, 1); g.fillRect(4, 13, 1, 5);
    g.fillRect(13, 17, 5, 1); g.fillRect(17, 13, 1, 5);
  }
  function ensureCinemaBtn() {
    var show = cinemaAllowed() && isWide;
    if (!show) {
      if (cinemaBtn) cinemaBtn.style.display = "none";
      return;
    }
    if (!cinemaBtn && typeof document !== "undefined") {
      cinemaBtn = document.createElement("button");
      cinemaBtn.type = "button";
      cinemaBtn.id = "cinema";
      cinemaBtn.setAttribute("aria-label", "Кино");
      cinemaBtn.style.cssText = "position:fixed;top:8px;right:8px;z-index:40;width:22px;height:22px;padding:0;border:0;background:transparent;cursor:pointer;";
      var c = document.createElement("canvas");
      c.width = 22; c.height = 22;
      c.style.cssText = "width:22px;height:22px;image-rendering:pixelated;display:block;";
      cinemaBtn.appendChild(c);
      cinemaBtn.addEventListener("click", function (ev: any) {
        ev.preventDefault();
        ev.stopPropagation();
        toggleCinema();
      });
      document.body.appendChild(cinemaBtn);
    }
    if (cinemaBtn) cinemaBtn.style.display = "block";
    paintCinemaBtn();
  }
  function enterCinema() {
    if (!cinemaAllowed()) return;
    cinemaOn = true;
    try {
      var root: any = document.documentElement;
      var req = root.requestFullscreen || root.webkitRequestFullscreen;
      if (req) {
        var p = req.call(root);
        if (p && p.catch) p.catch(function () {});
      }
    } catch (_e) {}
    resize();
  }
  function exitCinema() {
    cinemaOn = false;
    try {
      var doc: any = document;
      if (doc.fullscreenElement || doc.webkitFullscreenElement) {
        var exit = doc.exitFullscreen || doc.webkitExitFullscreen;
        if (exit) exit.call(doc);
      }
    } catch (_e) {}
    resize();
  }
  function toggleCinema() { if (cinemaOn) exitCinema(); else enterCinema(); }
  function resize() {
    var vs = viewSize();
    var cssW = Math.max(1, vs.w), cssH = Math.max(1, vs.h);
    var dpr = Math.max(1, window.devicePixelRatio || 1);
    /* Phone = coarse/touch AND the short side is below ~540. Width alone
       would treat a landscape phone (844×390) as a desktop. */
    isPhone = isCoarsePointer() && Math.min(cssW, cssH) < 540;
    isWide = cssW >= 540 && !isPhone;
    phoneLand = isPhone && cssW > cssH;
    var frameX = isWide ? 24 : 0;
    var frameY = isWide ? (cssH >= 740 ? 16 : 4) : 0;
    var availW = Math.max(160, cssW - frameX * 2);
    var availH = Math.max(240, cssH - frameY * 2);
    var lw = netFixedLW() || 160;
    var lh = 346;
    if (fieldLocked) { lw = LW; lh = LH; }
    var sx: number, sy: number, cssWpx: number, cssHpx: number;
    if (isWide) {
      if (cinemaOn) {
        var maxW = Math.max(160, cssW);
        var maxH = Math.max(240, cssH);
        var intScale = Math.max(1, Math.min(Math.floor(maxW / lw), Math.floor(maxH / lh)));
        cssScale = intScale * lh >= maxH - 1 ? intScale : Math.min(maxW / lw, maxH / lh);
        pScale = cssScale * dpr;
      } else {
        pScale = Math.max(1, Math.min(Math.floor((availW * dpr) / lw), Math.floor((availH * dpr) / lh)));
        cssScale = pScale / dpr;
      }
      sx = sy = pScale;
      canvas.width = Math.max(1, Math.round(lw * pScale));
      canvas.height = Math.max(1, Math.round(lh * pScale));
      cssWpx = lw * cssScale;
      cssHpx = lh * cssScale;
      canvas.style.position = "";
      canvas.style.left = "";
      canvas.style.top = "";
      canvas.style.boxShadow = "0 0 0 2px #f6ecd0, 0 0 0 6px #162040, 0 20px 60px rgba(0,0,0,0.7)";
      canvas.style.borderRadius = "4px";
      pScaleY = pScale;
    } else {
      /* Phone / narrow, 0.56 fractional nearest-neighbor. Menu/shop still fit
         the whole 346-tall UI (pads on the sides if the viewport is short and
         wide). During play (fieldLocked) the field fills the width so platforms
         reach the screen edges; any leftover height crops the top of the 346
         view (HUD uses hudY). Sim stays LW×LH; death and camera still use LH. */
      var fillWidth = fieldLocked && phase === "play";
      if (fillWidth) {
        /* v1.0 (Roman): integer device-px per art-px (art is 0.5 game px, so pScale is even).
           The 160-wide sim field is unchanged; leftover width is scenery padding.
           Extra height is shown ABOVE the 346 field (VIEW_CROP < 0), death line stays at the bottom. */
        var devW = Math.round(availW * dpr), devH = Math.round(availH * dpr);
        var maxPs = Math.floor(devW / lw);
        var pInt = maxPs >= 2 ? (maxPs % 2 === 0 ? maxPs : maxPs - 1) : Math.max(1, maxPs);
        var visH, tries = 0;
        while (tries < 4) {
          cssScale = pInt / dpr;
          VIEW_PAD = Math.max(0, (availW / cssScale - lw) / 2);
          visH = devH / pInt;
          if (visH >= lh) {
            VIEW_CROP = -(visH - lh);
            VIEW_BOT = 0;
            break;
          }
          VIEW_CROP = 0;
          VIEW_BOT = Math.max(0, lh - visH);
          var botMax = viewBotMax(lh);
          if (VIEW_BOT <= botMax) break;
          VIEW_CROP = Math.min(TOP_CROP_MAX, VIEW_BOT - botMax);
          VIEW_BOT = botMax;
          if (lh - VIEW_CROP - VIEW_BOT <= visH + 1e-6) break;
          /* Too short for this scale even after the crop cap: zoom out one even step. */
          if (pInt <= 2) break;
          pInt -= 2;
          tries++;
        }
        cssWpx = (lw + 2 * VIEW_PAD) * cssScale;
        cssHpx = (lh - VIEW_CROP - VIEW_BOT) * cssScale;
      } else if (!fieldLocked && phase !== "play" && availH * lw > availW * lh) {
        /* Menus on a tall phone: fill the whole screen (no stripes under the TG header or below the tab bar).
           Width sets the scale, the menu just gets taller. Runs always go back to 346 (startRun). */
        cssScale = availW / lw;
        lh = Math.max(lh, Math.floor(availH / cssScale));
        VIEW_PAD = 0;
        VIEW_CROP = 0; VIEW_BOT = 0;
        cssWpx = availW;
        cssHpx = availH;
      } else {
        cssScale = Math.min(availW / lw, availH / lh);
        VIEW_PAD = Math.max(0, (availW / cssScale - lw) / 2);
        VIEW_CROP = 0; VIEW_BOT = 0;
        cssWpx = (lw + 2 * VIEW_PAD) * cssScale;
        cssHpx = lh * cssScale;
      }
      var pxW = Math.max(1, Math.round(cssWpx * dpr));
      var pxH = Math.max(1, Math.round(cssHpx * dpr));
      canvas.width = pxW;
      canvas.height = pxH;
      var worldW = lw + 2 * VIEW_PAD;
      var worldH = lh - VIEW_CROP - VIEW_BOT;
      pScale = pxW / worldW;
      pScaleY = pxH / Math.max(1e-6, worldH);
      sx = pScale;
      sy = pScaleY;
      /* Snap the field origin to a device pixel so the clip has no 1 px sliver. */
      FIELD_OX = Math.round(VIEW_PAD * sx);
      FIELD_OY = Math.round(-VIEW_CROP * sy);
      PHONE_INT = false;
      DEV_W = pxW; DEV_H = pxH;
      canvas.style.position = "absolute";
      canvas.style.left = Math.round(vs.x + (cssW - cssWpx) / 2) + "px";
      /* Bottom-align so a short viewport keeps the death line on screen. */
      canvas.style.top = Math.round(vs.y + (cssH - cssHpx) / (VIEW_BOT > 0 || VIEW_CROP > 0 ? 1 : 2)) + "px";
      canvas.style.boxShadow = "none";
      canvas.style.borderRadius = "0px";
    }
    if (isWide) { VIEW_PAD = 0; VIEW_CROP = 0; VIEW_BOT = 0; FIELD_OX = 0; FIELD_OY = 0; PHONE_INT = false; DEV_W = canvas.width; DEV_H = canvas.height; }
    lastFill = fieldLocked && phase === "play" && !isWide;
    netLW = netFixedLW();
    LW = lw; LH = lh; SCALE = cssScale;
    canvas.style.width = cssWpx + "px";
    canvas.style.height = cssHpx + "px";
    canvas.style.imageRendering = "pixelated";
    var hintEl = document.getElementById("desk-hint");
    if (hintEl) {
      var deskHasAb = !!(CHARS[save.char] && CHARS[save.char].ab);
      hintEl.textContent = deskHasAb
        ? "← → / A D — движение · ↑ / Пробел — способность · F — кино · Esc — пауза"
        : "← → / A D — движение · F — кино · Esc — пауза";
      hintEl.style.display = (isWide && !cinemaOn && (cssH - LH * cssScale) >= 34) ? "block" : "none";
    }
    ensureCinemaBtn();
    ctx.setTransform(sx, 0, 0, sy, FIELD_OX, FIELD_OY);
    ctx.imageSmoothingEnabled = false;
    (ctx as any).webkitImageSmoothingEnabled = false;
    syncBackdrop(menuMap());
    if (wrap && cinemaOn && isWide) {
      wrap.style.background = "#000000";
      wrap.setAttribute("data-cine", "1");
    } else if (wrap && wrap.getAttribute("data-cine") === "1") {
      wrap.removeAttribute("data-cine");
      lastBackdropMap = "";
      syncBackdrop(menuMap());
    }
    if (fieldLocked && phase === "play" && phoneLand) {
      if (!landPause || resumeCd > 0) { paused = true; landPause = true; resumeCd = 0; acc = 0; uiAcc = 0; lastT = -1; }
    } else if (landPause && !phoneLand) {
      landPause = false;
      if (manualPause) { paused = true; resumeCd = 0; acc = 0; uiAcc = 0; lastT = -1; }
      else startResumeCountdown();
    }
  }
  function startResumeCountdown() {
    landPause = false;
    manualPause = false;
    paused = true;
    resumeCd = 3;
    resumeAt = (typeof performance !== "undefined" ? performance.now() : Date.now());
    acc = 0; uiAcc = 0; lastT = -1;
  }
  function heroHasAb(me: any) { var dbg: any = (window as any).__dbg; if (dbg && dbg.noAb) return false; return !!(me && CHARS[me.kind] && CHARS[me.kind].ab); }
  function showFirstTimeToast(id: string, text?: string) {
    if (!save.seen) save.seen = {};
    if (save.seen[id]) return;
    save.seen[id] = 1;
    writeSave(save);
    if (world) { toast(world, text || FIRST_TOAST[id] || id); world.toastT = 150; }
  }
  function requestAbility() {
    audioUnlock();
    if (!world || !world.players || !world.players[0] || !world.players[0].alive) return;
    if (!heroHasAb(world.players[0])) return;
    if (abReady(world.players[0])) { abTap = true; return; }
    if (abDenyT <= 0) { abDenyT = 18; hopSfx("deny"); }
  }
  function toLogic(cx: number, cy: number) {
    var r = canvas.getBoundingClientRect();
    var rw = r.width || 1, rh = r.height || 1;
    var x = ((cx - r.left) / rw * canvas.width - FIELD_OX) / pScale;
    var y = ((cy - r.top) / rh * canvas.height - FIELD_OY) / pScaleY;
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
    markBox(id, x, y, w, h);
    var on = pressId === id;
    var fill2 = on ? mixHex(fill, "#ffffff", 0.2) : fill;
    box(ctx, x, y, w, h, fill2, border || C.cream);
    if (on) rect(ctx, x + 1, y + h - 2, w - 2, 1, "rgba(0,0,0,0.35)");
    var s = sc || 1;
    drawText(ctx, label, x + w / 2, y + Math.round((h - 7 * s) / 2) + (on ? 1 : 0), tcol || C.cream, s, "center");
  }
  function telegramLinked(): boolean {
    try {
      var w: any = window as any;
      if (w.__hopTg && w.__hopTg.linked && location.protocol === "file:") return true;
      return !!(typeof PROFILE !== "undefined" && PROFILE && PROFILE.getState && PROFILE.getState().telegramId);
    } catch (_e) { return false; }
  }
  function tgName(): string {
    var raw = "";
    try {
      var w: any = window as any;
      if (w.__hopTg && w.__hopTg.name && location.protocol === "file:") raw = String(w.__hopTg.name);
      else {
        var u = w.Telegram && w.Telegram.WebApp && w.Telegram.WebApp.initDataUnsafe && w.Telegram.WebApp.initDataUnsafe.user;
        if (u && u.first_name) raw = String(u.first_name);
      }
    } catch (_e) { raw = ""; }
    raw = String(raw).toUpperCase();
    var out = "";
    for (var i = 0; i < raw.length && out.length < 10; i++) if (FONT[raw[i]]) out += raw[i];
    return out;
  }
  function coinsLabel(x: number, y: number, n: number, align?: string, _showTg?: boolean) {
    var s = String(n), w = textWidth(s, 1) + 9;
    var x0 = align === "right" ? x - w : align === "center" ? x - w / 2 : x;
    drawCoin(ctx, x0, y, ui);
    drawText(ctx, s, x0 + 9, y - 0.5, C.gold, 1, "left");
  }
  function menuTop() {
    return Math.round(insetTopCss() / Math.max(0.01, cssScale || 1)) + (testInsetTop || 0);
  }
  /* Nick uses the same 5×7 font as the rest of the UI, at scale 1. */
  function nickWidth(n: number) { return n ? n * 6 - 1 + 2 : 0; }
  function fitNick(raw: string, maxW: number) {
    var s = drawableChars(String(raw || ""));
    if (nickWidth(s.length) <= maxW) return { text: s, dots: false };
    var room = maxW - 7;
    var n = 0;
    while (n < s.length && nickWidth(n + 1) <= room) n++;
    return { text: s.slice(0, n), dots: true };
  }
  function drawNick(raw: string, x: number, y: number, maxW: number) {
    var fit = fitNick(raw, maxW);
    if (fit.text) drawTextO(ctx, fit.text, x, y, "#b8ae9a", "left", "#1a1030");
    var pen = x + (fit.text ? fit.text.length * 6 : 0);
    if (fit.dots) {
      var dy = y + 6;
      for (var i = 0; i < 3; i++) {
        var px = pen + i * 2;
        rect(ctx, px - 1, dy, 1, 1, "#1a1030");
        rect(ctx, px + 1, dy, 1, 1, "#1a1030");
        rect(ctx, px, dy - 1, 1, 1, "#1a1030");
        rect(ctx, px, dy + 1, 1, 1, "#1a1030");
        rect(ctx, px, dy, 1, 1, "#b8ae9a");
      }
      pen += 5;
    }
    return Math.max(0, pen - x);
  }
  function glyphsOf(raw: string, max: number) {
    return drawableChars(String(raw || "").replace(/@/g, "")).slice(0, max);
  }
  function tgUser(): any {
    try {
      var w: any = window as any;
      if (w.__hopTg && w.__hopTg.name && location.protocol === "file:") return { first_name: w.__hopTg.name, username: "" };
      return w.Telegram && w.Telegram.WebApp && w.Telegram.WebApp.initDataUnsafe && w.Telegram.WebApp.initDataUnsafe.user;
    } catch (_e) { return null; }
  }
  function guestTag(): string {
    var src = "";
    try {
      var st = (typeof PROFILE !== "undefined" && PROFILE && PROFILE.getState) ? PROFILE.getState() : null;
      if (st && st.profile && st.profile.id) src = String(st.profile.id);
      else if (st && st.tokenPresent) src = "";
    } catch (_e) {}
    try {
      if (!src) src = localStorage.getItem("hoppak_guest_token") || "";
    } catch (_e2) {}
    if (!src) {
      try {
        var prev = localStorage.getItem("hoppak_guest_tag") || "";
        if (/^[0-9A-F]{4}$/.test(prev)) return prev;
      } catch (_e3) {}
      return "0000";
    }
    var h = 2166136261;
    for (var i = 0; i < src.length; i++) { h ^= src.charCodeAt(i); h = Math.imul(h, 16777619); }
    var tag = ("0000" + (h >>> 0).toString(16).toUpperCase()).slice(-4);
    try { localStorage.setItem("hoppak_guest_tag", tag); } catch (_e4) {}
    return tag;
  }
  function accountName(full: boolean) {
    if (telegramLinked()) {
      var u = tgUser() || {};
      var raw = u.first_name || u.username || tgName();
      return glyphsOf(raw, full ? 16 : 24);
    }
    var tag = guestTag();
    return full ? ("GUEST HOPPER-" + tag) : ("HOP-" + tag);
  }
  var CHIP = 15, CHIP_IN = 13;
  function quantizeChip(px: any, size: number) {
    var pts: any[] = [], i;
    for (i = 0; i < size * size; i++) pts.push([px[i * 4], px[i * 4 + 1], px[i * 4 + 2]]);
    var boxes: any[] = [pts];
    function spanOf(box: any[]) {
      var mn = [255, 255, 255], mx = [0, 0, 0], ch = 0, s = 0, a;
      for (a = 0; a < box.length; a++) for (var c = 0; c < 3; c++) { if (box[a][c] < mn[c]) mn[c] = box[a][c]; if (box[a][c] > mx[c]) mx[c] = box[a][c]; }
      for (c = 0; c < 3; c++) if (mx[c] - mn[c] > s) { s = mx[c] - mn[c]; ch = c; }
      return { span: s, ch: ch };
    }
    while (boxes.length < 12) {
      var bi = 0, best = -1;
      for (var b = 0; b < boxes.length; b++) {
        var sp = spanOf(boxes[b]);
        if (sp.span > best && boxes[b].length > 1) { best = sp.span; bi = b; }
      }
      if (best < 8) break;
      var ch = spanOf(boxes[bi]).ch;
      var box = boxes[bi].slice().sort(function (p: any, q: any) { return p[ch] - q[ch]; });
      var mid = Math.max(1, Math.floor(box.length / 2));
      boxes.splice(bi, 1, box.slice(0, mid), box.slice(mid));
    }
    var pal: any[] = [];
    for (b = 0; b < boxes.length; b++) {
      var rs = 0, gs = 0, bs = 0;
      for (a = 0; a < boxes[b].length; a++) { rs += boxes[b][a][0]; gs += boxes[b][a][1]; bs += boxes[b][a][2]; }
      var n = boxes[b].length || 1;
      pal.push([Math.round(rs / n), Math.round(gs / n), Math.round(bs / n)]);
    }
    var cv = document.createElement("canvas");
    cv.width = size; cv.height = size;
    var g = cv.getContext("2d");
    if (!g) return null;
    var im = g.createImageData(size, size);
    for (i = 0; i < size * size; i++) {
      var r = px[i * 4], gg = px[i * 4 + 1], bb = px[i * 4 + 2], bd = 1e9, pick = 0;
      for (var p = 0; p < pal.length; p++) {
        var dr = r - pal[p][0], dg = gg - pal[p][1], db = bb - pal[p][2], d = dr * dr + dg * dg + db * db;
        if (d < bd) { bd = d; pick = p; }
      }
      im.data[i * 4] = pal[pick][0]; im.data[i * 4 + 1] = pal[pick][1]; im.data[i * 4 + 2] = pal[pick][2]; im.data[i * 4 + 3] = 255;
    }
    g.putImageData(im, 0, 0);
    return cv;
  }
  function pixelizeImage(img: any) {
    var sw = img.naturalWidth || img.width, sh = img.naturalHeight || img.height;
    var side = Math.min(sw, sh) || 1;
    var crop = Math.max(1, Math.round(side * 0.7));
    var sx0 = Math.floor((sw - side) / 2 + (side - crop) / 2);
    var sy0 = Math.floor((sh - side) / 2 + (side - crop) / 2);
    var tmp = document.createElement("canvas");
    tmp.width = crop; tmp.height = crop;
    var tg = tmp.getContext("2d");
    if (!tg) return null;
    tg.drawImage(img, sx0, sy0, crop, crop, 0, 0, crop, crop);
    var data = tg.getImageData(0, 0, crop, crop).data;
    var size = CHIP_IN, out = new Uint8ClampedArray(size * size * 4);
    for (var y = 0; y < size; y++) {
      var y0 = Math.floor(y * crop / size), y1 = Math.max(y0 + 1, Math.floor((y + 1) * crop / size));
      for (var x = 0; x < size; x++) {
        var x0 = Math.floor(x * crop / size), x1 = Math.max(x0 + 1, Math.floor((x + 1) * crop / size));
        var r = 0, g = 0, b = 0, n = 0;
        for (var yy = y0; yy < y1; yy++) for (var xx = x0; xx < x1; xx++) {
          var ii = (yy * crop + xx) * 4;
          r += data[ii]; g += data[ii + 1]; b += data[ii + 2]; n++;
        }
        n = n || 1; r /= n; g /= n; b /= n;
        r = (r - 128) * 1.15 + 128; g = (g - 128) * 1.15 + 128; b = (b - 128) * 1.15 + 128;
        var avg = (r + g + b) / 3;
        r = avg + (r - avg) * 1.25; g = avg + (g - avg) * 1.25; b = avg + (b - avg) * 1.25;
        var o = (y * size + x) * 4;
        out[o] = clamp(Math.round(r), 0, 255); out[o + 1] = clamp(Math.round(g), 0, 255); out[o + 2] = clamp(Math.round(b), 0, 255); out[o + 3] = 255;
      }
    }
    return quantizeChip(out, size);
  }
  function accountPhoto() {
    if (!telegramLinked()) return null;
    var u = tgUser();
    var url = u && u.photo_url ? String(u.photo_url) : "";
    if (!url) return null;
    if (photoSlot.url === url) return photoSlot.fail ? null : photoSlot.cv;
    photoSlot = { url: url, cv: null, fail: false };
    try {
      var img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = function () {
        try {
          var cv = pixelizeImage(img);
          if (!cv) { if (photoSlot.url === url) photoSlot.fail = true; return; }
          if (photoSlot.url === url) photoSlot.cv = cv;
        } catch (_err) { if (photoSlot.url === url) photoSlot.fail = true; }
      };
      img.onerror = function () { if (photoSlot.url === url) photoSlot.fail = true; };
      img.src = url;
    } catch (_e) { photoSlot.fail = true; }
    return null;
  }
  var SIL = ["..##..", ".####.", "..##..", "######", ".####.", ".#..#.", ".#..#."];
  function drawSil(x: number, y: number, sc: number) {
    for (var r = 0; r < SIL.length; r++) for (var c = 0; c < 6; c++) if (SIL[r][c] === "#") rect(ctx, x + c * sc, y + r * sc, sc, sc, "#c4b8a4");
  }
  function drawBang(x: number, y: number) {
    var stem = [[0, 0], [0, 1], [0, 3]];
    var i, k;
    for (i = 0; i < stem.length; i++) {
      var px = x + stem[i][0], py = y + stem[i][1];
      for (k = 0; k < 4; k++) rect(ctx, px + [ -1, 1, 0, 0 ][k], py + [ 0, 0, -1, 1 ][k], 1, 1, "#1a1030");
    }
    for (i = 0; i < stem.length; i++) rect(ctx, x + stem[i][0], y + stem[i][1], 1, 1, "#a89068");
  }
  function drawChip(x: number, y: number, photo: any, bang: boolean) {
    rect(ctx, x, y, CHIP, CHIP, "#1a1030");
    rect(ctx, x + 1, y + 1, CHIP - 2, CHIP - 2, "#241838");
    if (photo) {
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(photo, x + 1, y + 1, CHIP_IN, CHIP_IN);
      ctx.restore();
      rect(ctx, x, y, CHIP, 1, "#1a1030");
      rect(ctx, x, y + CHIP - 1, CHIP, 1, "#1a1030");
      rect(ctx, x, y, 1, CHIP, "#1a1030");
      rect(ctx, x + CHIP - 1, y, 1, CHIP, "#1a1030");
    } else drawSil(x + 4, y + 3, 1);
    if (bang) drawBang(x + CHIP - 4, y + 1);
  }
  /* Wallet row on every screen except the run. Coins stay top-right. Account is the quieter chip and 3×5 nick. */
  function drawWallet() {
    var top = menuTop();
    var s = String(save.coins);
    var w = textWidth(s, 1) + 9;
    var x = LW - 4 - w;
    var coinX = x - 3;
    var rowY = 1 + top;
    rect(ctx, x - 3, rowY, w + 6, CHIP, INK);
    rect(ctx, x - 2, rowY + 1, w + 4, CHIP - 2, C.navy);
    coinsLabel(LW - 4, rowY + 3, save.coins, "right");
    var linked = telegramLinked();
    var photo = accountPhoto();
    drawChip(3, rowY, linked ? photo : null, !linked);
    var nickX = 3 + CHIP + 2;
    var nickMax = Math.max(8, coinX - nickX - 2);
    var nickW = drawNick(accountName(false), nickX, rowY + 4, nickMax);
    var minSide = Math.max(24, Math.ceil(44 / Math.max(0.01, cssScale || 1)));
    var hitW = Math.min(coinX - 2, nickX + Math.max(0, nickW));
    var logoTop = phase === "menu" && menuLay && menuLay.logo ? menuLay.logo.y : belowBand();
    var hitH = Math.max(24, Math.min(minSide, logoTop - top));
    addHit("acct", 0, top, Math.max(hitH, hitW), hitH);
    menuLay = menuLay || {};
    menuLay.chip = { x: 3, y: rowY, w: CHIP, h: CHIP };
    menuLay.coins = { x: coinX, y: rowY, w: w + 6, h: CHIP };
    menuLay.hit = { x: 0, y: top, w: Math.max(hitH, hitW), h: hitH };
  }
  function drawBuy(id: string, x: number, y: number, w: number, h: number, price: number) {
    addHit(id, x, y, w, h);
    markBox(id, x, y, w, h);
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
  function abBar() {
    var coinW = 28;
    try { if (world) coinW = textWidth(String(world.runCoins || 0), 1) + 19; } catch (_e) {}
    return { x: 4 + coinW, y: hudY(5), w: 16, h: 16 };
  }
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
    /* Menus may be taller than 346 on tall phones; the field is always 160×346 before the world exists. */
    phase = "play"; fieldLocked = false; resize();
    var s = seed != null ? seed : ((Date.now() ^ Math.floor(Math.random() * 0x7fffffff)) >>> 0);
    world = createWorld(s, mode, save.char, lookNow(), mapId || (mode === "squad" ? lobbyMap : save.bg));
    var mi = mapIdx(world.map);
    world.recM = mapBest(mi);
    world.goalM = MAPS[mi].goal || 0;
    phase = "play";
    sessionNote = false;
    rankY = {};
    paused = false;
    landPause = false;
    fieldLocked = true;
    acc = 0; uiAcc = 0; lastT = -1;
    held.left = held.right = false;
    pointers = {}; abTap = false; pressId = null;
    resumeCd = 0; landPause = false; manualPause = false; abDenyT = 0; refuseT = 0; popT = -1; wasReady = false; coinT0 = -1; coinSkip = false;
    try { canvas.focus(); } catch (_e) {}
    VIEW_SHIFT = 0;
    if (typeof PROFILE !== "undefined" && PROFILE && PROFILE.beginRun) world.runId = PROFILE.beginRun(world.map, save.char);
    abHintRun = !!(world.players[0] && heroHasAb(world.players[0]) && !(save.seen && save.seen.abHint));
    if (abHintRun) {
      if (!save.seen) save.seen = {};
      save.seen.abHint = 1;
      writeSave(save);
    }
    resize();
  }
  function payout() {
    if (!world || world.paid) return;
    world.paid = true;
    var me = world.players[0];
    var mtr = metersOf(me);
    var runC = world.runCoins || 0;
    var bonC = world.bonusCoins || 0;
    var plan = (typeof PROFILE !== "undefined" && PROFILE && PROFILE.computeAward)
      ? PROFILE.computeAward(mtr, runC, bonC)
      : { awarded: (mtr >= 100 ? Math.floor(Math.max(0, Math.min(20000, mtr)) / 25) : 0) + Math.max(0, runC) + Math.max(0, bonC), limited: mtr < 100 ? "HEIGHT_MIN" : "" };
    world.earnH = mtr >= 100 ? Math.floor(Math.max(0, Math.min(20000, mtr)) / 25) : 0;
    var roomLeft = Math.max(0, plan.awarded - world.earnH);
    world.earnB = Math.min(Math.max(0, bonC), roomLeft);
    world.earnC = Math.max(0, roomLeft - world.earnB);
    world.earned = plan.awarded;
    world.limited = plan.limited || "";
    world.coinFrom = save.coins;
    var mi = mapIdx(world.map);
    world.prevMapBest = mapBest(mi);
    world.newBest = mtr > (world.prevMapBest || 0);
    if (mtr > world.prevMapBest) save.mapBest[world.map] = mtr;
    save.coins += world.earned;
    coinT0 = -1; coinSkip = false;
    if (mtr > save.best) save.best = mtr;
    world.best = save.best;
    writeSave(save);
    if (typeof PROFILE !== "undefined" && PROFILE) {
      if (mtr > 0 || runC > 0 || bonC > 0) {
        PROFILE.finishRun(mtr, runC, bonC, world, {
          mode: world.net ? "online" : mode,
          map: world.map,
          ver: "0.6rc",
          awarded: world.earned,
          runId: world.runId || "",
          hero: save.char
        });
      }
    }
  }
  var sessionNote = false;
  function goMenu() {
    /* Same payout as a finished run: map record, profile best, and the usual coins. No second pay once world.paid. */
    if (phase === "play" && world && !world.paid) payout();
    phase = "menu"; world = null; showSet = false; showProf = false; campCard = -1; paused = false; landPause = false; manualPause = false; fieldLocked = false; resize();
  }

  function shopTap(key: string) {
    if (key.indexOf("char:") !== 0) return;
    var i = parseInt(key.slice(5), 10);
    if (isNaN(i) || i < 0 || i >= CHARS.length) return;
    if (heroOwned(i)) { save.char = i; writeSave(save); }
    else tryBuy("hero:act", CHARS[i].price, function () {
      save.coins -= CHARS[i].price; save.owned["char:" + i] = 1; save.char = i; say("КУПЛЕНО!");
      if (typeof PROFILE !== "undefined" && PROFILE) PROFILE.buy("char:" + i, CHARS[i].price);
    });
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
    if (id === "hero:menu") { showSet = false; showProf = false; phase = "shop"; return; }
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
    if (id === "shop" || id === "hero:menu") { showSet = false; showProf = false; phase = "shop"; return; }
    if (id === "ency") { say("СКОРО"); return; }
    if (id === "tab:shop") { say("Скоро"); return; }
    if (id === "tab:leagues") { say("Скоро в 0.8"); return; }
    if (id === "tab:friends") { say("Скоро в 0.9"); return; }
    if (id === "tab:home") { showSet = false; showProf = false; if (phase !== "menu") goMenu(); return; }
    if (id === "mp" || id === "create") {
      if (openMaps().indexOf(lobbyMap) < 0) lobbyMap = save.bg;
      room = room || { round: 0 }; phase = "lobby"; return;
    }
    if (id === "acct") { showSet = false; showProf = !showProf; return; }
    if (id === "set:prof") { showSet = false; showProf = true; return; }
    if (id === "prof:close" || id === "prof:out") { showProf = false; return; }
    if (id === "prof:card") return;
    if (id === "set") { showSet = !showSet; showProf = false; return; }
    if (id === "tilt") { toggleTilt(); return; }
    if (id === "vol:mute") {
      setAudioOn(!audioOn);
      save.audioOn = audioOn; save.musicOn = audioOn; save.sfx = audioOn; save.vol = masterVol;
      writeSave(save);
      if (audioOn) hopSfx("tick");
      return;
    }
    if (id === "vib") { vibOn = !vibOn; save.vib = vibOn; writeSave(save); if (vibOn) hopVib(18); return; }
    if (id === "menu") { goMenu(); return; }
    if (id === "back") { showSet = false; campCard = -1; phase = "menu"; return; }
    if (id === "go") { startSquad(); return; }
    if (id === "pause") { if (phase === "play" && !paused) { paused = true; manualPause = true; acc = 0; uiAcc = 0; lastT = -1; } return; }
    if (id === "resume") { startResumeCountdown(); return; }
    if (id === "font") { phase = "font"; return; }
    if (id === "rematch") {
      if (mode === "squad") { room.round = (room.round || 0) + 1; startSquad((((Date.now() + room.round * 40503) >>> 0))); }
      else startRun();
    }
  }
  function campTap(key: string) {
    if (key === "play") return;
    if (key === "open" || key.indexOf("open:") === 0) {
      var i2 = key.indexOf("open:") === 0 ? parseInt(key.slice(5), 10) : nextClosable();
      if (i2 < 0 || isNaN(i2)) return;
      unlockMap(i2, key === "open" ? "camp:open" : ("camp:open:" + i2));
      return;
    }
    var i = parseInt(key, 10);
    if (isNaN(i) || i < 0 || i >= MAPS.length) return;
    var M = MAPS[i];
    flashT = 0;
    /* A tap only highlights an open map. ИГРАТЬ on the menu starts that map. */
    if (mapOpen(i)) { if (save.bg !== M.id) { save.bg = M.id; writeSave(save); } return; }
    if (!mapOpen(i - 1)) { say("СНАЧАЛА ОТКРОЙ " + MAPS[i - 1].name); return; }
    if (!mapGoalMet(i)) { say("ДОЙДИ ДО " + MAPS[i - 1].goal + " М " + WHERE[i - 1]); return; }
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
      if (typeof PROFILE !== "undefined" && PROFILE) PROFILE.buy("map:" + M.id, M.price);
    });
  }
  function stagingBuild(): boolean {
    try { return typeof HOP_STAGING !== "undefined" && !!HOP_STAGING; } catch (_e) { return false; }
  }
  function remoteAlpha(): number { return REMOTE_ALPHA; }
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
    if (phase === "play" && !paused) for (var k in pointers) {
      var q = pointers[k];
      var pb = pauseBox();
      if (q.x >= pb.x && q.y >= pb.y && q.y < pb.y + pb.h) continue;
      if (q.x < LW / 2) l = true; else r = true;
    }
    held.left = l; held.right = r;
  }
  var volGeom = { x: 0, w: 1 };
  function setSlider(id: string, x: number) {
    var v = Math.round(clamp((x - volGeom.x) / Math.max(1, volGeom.w), 0, 1) * 10) / 10;
    if (v > 0 && !audioOn) setAudioOn(true);
    setMasterVol(v);
    save.vol = masterVol; save.music = masterVol; save.sfxVol = masterVol;
    save.audioOn = audioOn; save.musicOn = audioOn; save.sfx = audioOn;
    writeSave(save);
  }
  function volRow(id: string, x: number, y: number, w: number, label: string, vol: number, on: boolean) {
    drawText(ctx, label, x, y, on ? C.cream : "#9a8ab8", 1, "left");
    btn(id + ":mute", x + w - 36, y - 2, 36, 12, on ? C.mint : "#1a1430", on ? "ВКЛ" : "ВЫКЛ", on ? INK : C.cream);
    var bx = x, bw = w, by = y + 12;
    addHit(id, bx, by, bw, 8);
    volGeom = { x: bx, w: bw };
    rect(ctx, bx, by, bw, 5, "#120c28");
    var fw = Math.max(0, Math.round(bw * (on ? vol : 0)));
    if (fw > 0) rect(ctx, bx, by, fw, 5, C.mint);
    rect(ctx, bx, by, bw, 1, on ? C.cream : "#5a5668");
    rect(ctx, bx + Math.min(bw - 1, fw), by - 1, 1, 7, C.gold);
  }
  function onPtrDown(e: any) {
    e.preventDefault();
    audioUnlock();
    try { canvas.focus(); } catch (_e) {}
    try { if (e.pointerId != null) (e.currentTarget || ptrRoot).setPointerCapture(e.pointerId); } catch (_e) {}
    var loc = toLogic(e.clientX, e.clientY);
    var id = hitAt(loc.x, loc.y);
    pressId = id;
    if (id === "vol") { setSlider(id, loc.x); return; }
    if (phase === "results") coinSkip = true;
    if (phase !== "play") return;
    if (paused) return;
    if (id === "ab" || id === "pause") return;
    pointers[e.pointerId != null ? e.pointerId : 1] = { x: loc.x, y: loc.y, sx: loc.x, sy: loc.y, sxCss: e.clientX, syCss: e.clientY, t0: e.timeStamp || Date.now(), swiped: false };
    recomputeHold();
  }
  function onPtrMove(e: any) {
    var loc = toLogic(e.clientX, e.clientY);
    if (pressId === "vol") { setSlider(pressId, loc.x); return; }
    if (phase !== "play" || paused) return;
    var pid = e.pointerId != null ? e.pointerId : 1;
    var p = pointers[pid];
    if (!p) return;
    p.x = loc.x; p.y = loc.y;
    if (!p.swiped) {
      var dy = (p.syCss != null ? p.syCss : e.clientY) - e.clientY;
      var dx = e.clientX - (p.sxCss != null ? p.sxCss : e.clientX);
      var dt = (e.timeStamp || Date.now()) - (p.t0 || 0);
      if (dt <= 300 && dy >= 30 && dy > 1.5 * Math.abs(dx)) {
        p.swiped = true;
        requestAbility();
      }
    }
    recomputeHold();
  }
  function onPtrUp(e: any) {
    var loc = toLogic(e.clientX, e.clientY);
    var id = hitAt(loc.x, loc.y);
    if (phase === "play") {
      var pidUp = e.pointerId != null ? e.pointerId : 1;
      var sw = pointers[pidUp];
      if (sw && world && world.net && world.players[0] && !world.players[0].alive && typeof NET !== "undefined" && NET.cycleWatch) {
        var sdx = loc.x - sw.sx, sdy = loc.y - sw.sy;
        if (Math.abs(sdx) >= 18 && Math.abs(sdx) > Math.abs(sdy)) NET.cycleWatch(world, sdx < 0 ? -1 : 1);
      }
      if (paused) { if (id === "resume" || id === "menu" || (id === "vol:mute" && pressId === id)) activate(id); }
      else if (id === "pause" && pressId === "pause") activate("pause");
      else if (id === "ab" && pressId === "ab") requestAbility();
      delete pointers[e.pointerId != null ? e.pointerId : 1];
      recomputeHold();
    } else if (pressId === "vol") {
      if (id === pressId) setSlider(pressId, loc.x);
    } else if (id && id === pressId) activate(id);
    pressId = null;
  }
  function onKey(e: any, down: boolean) {
    var k = e.key;
    if ((k === "f" || k === "F" || k === "а" || k === "А") && !typingTarget(e)) {
      if (down && cinemaAllowed()) { toggleCinema(); e.preventDefault(); }
      return;
    }
    if (k === "Escape" && cinemaOn && !typingTarget(e)) {
      if (down) { exitCinema(); e.preventDefault(); }
      return;
    }
    if (down) audioUnlock();
    if (phase === "play" && world && world.net && world.players[0] && !world.players[0].alive && (k === "ArrowLeft" || k === "ArrowRight") && typeof NET !== "undefined" && NET.cycleWatch) {
      if (down) NET.cycleWatch(world, k === "ArrowLeft" ? -1 : 1);
      e.preventDefault();
      return;
    }
    if (k === "ArrowLeft" || k === "a" || k === "A" || k === "ф" || k === "Ф") { held.kl = down; e.preventDefault(); return; }
    if (k === "ArrowRight" || k === "d" || k === "D" || k === "в" || k === "В") { held.kr = down; e.preventDefault(); return; }
    if (!down) return;
    if (phase === "play" && paused && (k === " " || k === "Enter" || k === "Escape")) {
      if (landPause || resumeCd <= 0) startResumeCountdown();
      e.preventDefault(); return;
    }
    if (phase === "play" && (k === " " || k === "ArrowUp" || k === "w" || k === "W" || k === "ц" || k === "Ц" || k === "Shift")) { requestAbility(); e.preventDefault(); return; }
    if (k === "Escape" && phase === "play") { paused = true; manualPause = true; acc = 0; uiAcc = 0; lastT = -1; return; }
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
  var TITLE = { face: "#ffe9a8", outline: "#2a1840", shadow: "#6a3cb4" };
  var MENU_CAM = function () { return -LH + 70; };
  /* Chip row is y = 1+menuTop, height CHIP. Plaques start 4 px under that, same gap as the logo. */
  function bandBottom() { return menuTop() + 1 + CHIP; }
  function belowBand() { return bandBottom() + 4; }
  function markBox(id: string, x: number, y: number, w: number, h: number) {
    screenLay.push({ id: id, x: x, y: y, w: w, h: h });
  }
  function header(title: string, sc: number) {
    var y = belowBand();
    var h = 7 * sc + 10;
    var w = textWidth(title, sc) + 16;
    var x = Math.round(LW / 2 - w / 2);
    box(ctx, x, y, w, h, C.navy, C.cream);
    drawText(ctx, title, LW / 2, y + 5, C.cream, sc, "center");
    markBox("header", x, y, w, h);
    if (phase === "results") pushRes("header", x, y, w, h);
    return { x: x, y: y, w: w, h: h, bottom: y + h };
  }
  function drawSessionNote() {
    var y = belowBand();
    box(ctx, colX(), y, 152, 26, C.navy, C.gold);
    drawText(ctx, "АККАУНТ ОТКРЫТ", LW / 2, y + 3, C.gold, 1, "center");
    drawText(ctx, "НА ДРУГОМ УСТРОЙСТВЕ", LW / 2, y + 14, C.gold, 1, "center");
    markBox("session", colX(), y, 152, 26);
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
    coinsLabel(x + 4, 51, save.coins, undefined, true);
    drawText(ctx, "РЕКОРД " + (save.best || 0) + " М", x + 148, 51, C.cream, 1, "right");
  }
  function drawProfileCard() {
    hits = [];
    screenLay = [];
    dimView(ctx, "rgba(8,6,20,0.62)");
    addHit("prof:out", -40, -40, LW + 80, LH + 80);
    var x = colX();
    var linked = telegramLinked();
    var u = tgUser() || {};
    var h = linked ? 118 : 132;
    var y = Math.max(belowBand(), menuTop() + 28, 70);
    addHit("prof:card", x, y, 152, h);
    box(ctx, x, y, 152, h, C.navy, C.cream);
    markBox("profile", x, y, 152, h);
    drawText(ctx, "ПРОФИЛЬ", LW / 2, y + 6, C.gold, 1, "center");
    var photo = linked ? accountPhoto() : null;
    var av = 28;
    if (photo) {
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(photo, x + 9, y + 23, CHIP_IN * 2, CHIP_IN * 2);
      ctx.restore();
    } else {
      rect(ctx, x + 8, y + 22, av, av, "#241838");
      drawSil(x + 16, y + 28, 2);
    }
    rect(ctx, x + 8, y + 22, av, 1, "#1a1030");
    rect(ctx, x + 8, y + 22 + av - 1, av, 1, "#1a1030");
    rect(ctx, x + 8, y + 22, 1, av, "#1a1030");
    rect(ctx, x + 8 + av - 1, y + 22, 1, av, "#1a1030");
    var name = accountName(true);
    drawText(ctx, name, x + 40, y + 24, C.cream, 1, "left");
    var lineY = y + 36;
    if (linked && u.username) {
      drawText(ctx, glyphsOf(String(u.username), 14), x + 40, lineY, "#b8ae9a", 1, "left");
      lineY += 12;
    }
    var entryY = y + 54;
    drawText(ctx, linked ? "ВХОД: TELEGRAM" : "ВХОД: ГОСТЕВОЙ", x + 8, entryY, C.cream, 1, "left");
    if (!linked) drawText(ctx, "ПРОГРЕСС НА УСТРОЙСТВЕ", x + 8, entryY + 12, "#b8ae9a", 1, "left");
    drawText(ctx, "РЕКОРД " + (save.best || 0) + " М", x + 8, y + h - 36, C.gold, 1, "left");
    btn("prof:close", x + 26, y + h - 22, 100, 16, C.navy, "ЗАКРЫТЬ");
  }
  function drawTabIcon(key: string, x: number, y: number, dim?: boolean) {
    if (dim) ctx.globalAlpha = 0.45;
    drawUiPx(ctx, "bar_" + key, x, y, 1);
    if (dim) ctx.globalAlpha = 1;
  }
  /* 5×7 padlock, meant for the top-right corner of a 16×16 tab icon — not a replacement for it. */
  function drawTabLock(x: number, y: number) {
    x = Math.round(x); y = Math.round(y);
    rect(ctx, x + 1, y, 3, 1, INK);
    rect(ctx, x, y + 1, 1, 2, INK); rect(ctx, x + 4, y + 1, 1, 2, INK);
    rect(ctx, x, y + 3, 5, 4, INK);
    rect(ctx, x + 1, y + 4, 3, 2, C.cream);
    rect(ctx, x + 2, y + 4, 1, 2, INK);
  }
  function drawGridCell(id: string, x: number, y: number, w: number, h: number, icon: string, label: string, dim?: boolean) {
    addHit(id, x, y, w, h);
    markBox(id, x, y, w, h);
    var fill = dim ? "#12101c" : C.navy;
    box(ctx, x, y, w, h, fill, dim ? "#5a4a72" : C.cream);
    var ix = x + 1, iy = y + Math.round((h - 24) / 2);
    if (dim) ctx.globalAlpha = 0.45;
    drawUiPx(ctx, icon, ix, iy, 1);
    if (dim) ctx.globalAlpha = 1;
    /* Text runs from 1 px after the icon to the inner edge of the frame: ЭНЦИКЛОПЕДИЯ (47 px) fits one line. */
    var tx = ix + 24 + 1, tw = x + w - 1 - tx;
    var col = dim ? "#9a8ab8" : C.cream;
    var lines = tinyLines(label, tw);
    var block = lines.length * 6 - 1;
    var ly = y + Math.round((h - block) / 2);
    for (var i = 0; i < lines.length; i++) drawTiny(ctx, lines[i], tx, ly + i * 6, col, "left");
  }
  /* Visible height of the menu/shop hero at scale `sc` (1 art px = 0.5 game px for 64-px sheets). */
  function heroArtH(id: string, sc: number) {
    var spr = heroSprite(id);
    if (spr && typeof HERO64 !== "undefined" && HERO64[id]) return (spr.naturalHeight || spr.height) * 0.5 * sc;
    return SPR_CH * sc;
  }
  function menuFrame() {
    var top = menuTop();
    var bot = Math.round(insetSideCss("bottom") / Math.max(0.01, cssScale || 1));
    /* ИГРАТЬ keeps the prod 34px button and at least 10px of air. Squeeze the logo and the grid, not these gaps. */
    var playGap = 10, playH = 34, pickH = 18, gridH = 26, tabH = 36, gridGap = 4;
    var logoSc = 3;
    function stack() {
      var tabY = LH - bot - tabH;
      var gridY = tabY - playGap - (gridH * 2 + gridGap);
      var playY = gridY - playGap - playH;
      var pickY = playY - playGap - pickH;
      var logoY = top + 25;
      var tagY = logoY + 7 * logoSc + 4;
      var tagBot = tagY + 9;
      var platY = pickY - 8;
      var heroVis = heroArtH((CHARS[save.char] || CHARS[0]).id, 2);
      var heroTop = platY - heroVis - 10;
      return { tabY: tabY, gridY: gridY, playY: playY, pickY: pickY, logoY: logoY, tagY: tagY, tagBot: tagBot, platY: platY, heroTop: heroTop };
    }
    var L = stack();
    if (L.heroTop < L.tagBot + 4) { logoSc = 2; L = stack(); }
    if (L.heroTop < L.tagBot + 4) { gridGap = 2; pickH = 16; L = stack(); }
    if (L.heroTop < L.tagBot + 2) L.heroTop = L.tagBot + 2;
    return {
      top: top, bot: bot, logoY: L.logoY, logoSc: logoSc, tagY: L.tagY, tagBot: L.tagBot,
      platY: L.platY, heroTop: L.heroTop, pickY: L.pickY, pickH: pickH, playY: L.playY, playH: playH,
      gridY: L.gridY, gridH: gridH, gridGap: gridGap, tabY: L.tabY, tabH: tabH, playGap: playGap
    };
  }
  function drawMenu() {
    drawBg(ctx, MENU_CAM(), ui, save.bg, true);
    dimView(ctx, "rgba(18,14,44,0.14)");
    var x = colX();
    var L = menuFrame();
    var logoW = bigWidth("ХОППАК", L.logoSc);
    drawBig(ctx, "ХОППАК", LW / 2, L.logoY, TITLE.face, L.logoSc, "center", TITLE.outline, TITLE.shadow);
    drawTextO(ctx, "ПРЫГАЙ ВЫШЕ ВСЕХ", LW / 2, L.tagY, C.cream, "center");
    menuLay = {
      chip: { x: 3, y: 1 + L.top, w: CHIP, h: CHIP },
      coins: { x: 0, y: 1 + L.top, w: 0, h: CHIP },
      logo: { x: Math.round(LW / 2 - logoW / 2) - 1, y: L.logoY - 1, w: logoW + 2, h: 7 * L.logoSc + 2 },
      tag: { x: Math.round(LW / 2 - textWidth("ПРЫГАЙ ВЫШЕ ВСЕХ", 1) / 2) - 1, y: L.tagY - 1, w: textWidth("ПРЫГАЙ ВЫШЕ ВСЕХ", 1) + 2, h: 9 },
      logoSc: L.logoSc,
      safeTop: L.top,
      safeBottom: L.bot
    };
    var mi = mapIdx(save.bg), M = MAPS[mi], bestM = mapBest(mi);
    var sub = M.goal ? (M.name + " · " + bestM + "/" + M.goal + " М") : (M.name + " · " + bestM + " М");
    var ph = (ui % 60) / 60;
    var hop = Math.round(Math.sin(ph * Math.PI) * 10);
    var pose = ph < 0.08 || ph > 0.95 ? "squash" : ph < 0.5 ? "up" : "fall";
    var platY = L.platY;
    rect(ctx, LW / 2 - 28, platY, 56, 5, C.wood); rect(ctx, LW / 2 - 28, platY + 4, 56, 2, C.woodD); rect(ctx, LW / 2 - 28, platY, 56, 1, C.edge);
    var heroId = (CHARS[save.char] || CHARS[0]).id;
    var heroVis = heroArtH(heroId, 2);
    var heroY = platY - 32 - hop;
    if (platY - heroVis - hop < L.tagBot + 2) { hop = Math.max(0, platY - heroVis - (L.tagBot + 2)); heroY = platY - 32 - hop; }
    drawJumper(ctx, jumperXForCenter(LW / 2, heroId, pose, 2), heroY, lookNow(), 1, pose, ui % 170 < 6, true, 2);
    markBox("hero", LW / 2 - 18, platY - hop - heroVis, 36, heroVis);
    markBox("plat", LW / 2 - 28, platY, 56, 7);
    var pickW = 120;
    btn("hero:menu", x + Math.round((152 - pickW) / 2), L.pickY, pickW, L.pickH, "#1a1430", "ВЫБРАТЬ ГЕРОЯ", C.cream, 1, C.gold);
    btn("start", x, L.playY, 152, L.playH, C.mint, "", INK, 2);
    /* Same face as prod b683155: BIGF scale 2, ink, no outline, 4px under the button top. */
    drawBig(ctx, "ИГРАТЬ ▶", LW / 2, L.playY + 4, INK, 2, "center");
    drawText(ctx, sub, LW / 2, L.playY + 23, INK, 1, "center");
    var hgap = 2;
    var gw = Math.floor((152 - hgap) / 2);
    var gx2 = x + gw + hgap;
    var gy2 = L.gridY + L.gridH + L.gridGap;
    /* Grid cells are ~26px tall; 24px icons leave 1px padding. Labels sit to the right, tiny 3×5. */
    drawGridCell("camp", x, L.gridY, gw, L.gridH, "grid_maps", "КАРТЫ");
    drawGridCell("net:menu", gx2, L.gridY, gw, L.gridH, "grid_multiplayer", "МУЛЬТИПЛЕЕР");
    drawGridCell("ency", x, gy2, gw, L.gridH, "grid_encyclopedia", "ЭНЦИКЛОПЕДИЯ");
    drawGridCell("soon", gx2, gy2, gw, L.gridH, "grid_quests", "ЗАДАНИЯ · СКОРО", true);
    var tabs = [
      { id: "tab:shop", key: "shop", label: "МАГАЗИН", lock: true },
      { id: "tab:leagues", key: "leagues", label: "ЛИГИ", lock: true },
      { id: "tab:home", key: "home", label: "ГЛАВНАЯ", lock: false },
      { id: "tab:friends", key: "friends", label: "ДРУЗЬЯ", lock: true },
      { id: "set", key: "settings", label: "ОПЦИИ", lock: false }
    ];
    var tw = Math.floor(LW / tabs.length);
    var homeOn = phase === "menu" && !showSet && !showProf;
    for (var ti = 0; ti < tabs.length; ti++) {
      var tb = tabs[ti];
      var tx = ti * tw;
      var on = (tb.id === "tab:home" && homeOn) || (tb.id === "set" && showSet);
      addHit(tb.id, tx, L.tabY, tw, L.tabH);
      markBox(tb.id === "set" ? "tab:settings" : tb.id, tx, L.tabY, tw, L.tabH);
      /* Fill down to the screen edge (home-indicator area) so no map background shows under the bar. */
      rect(ctx, tx, L.tabY, tw, LH - L.tabY, on ? "#24356a" : (tb.lock ? "#0c0a14" : "#100c22"));
      if (on) rect(ctx, tx, L.tabY, tw, 2, C.cream);
      rect(ctx, tx, L.tabY, tw, 1, INK);
      if (ti > 0) rect(ctx, tx, L.tabY, 1, LH - L.tabY, INK);
      var ix = tx + Math.floor((tw - 16) / 2);
      var iy = L.tabY + 3;
      drawTabIcon(tb.key, ix, iy, !!tb.lock);
      var tc = tb.lock ? "#6a6080" : (on ? C.cream : "#9a8ab8");
      drawTiny(ctx, tb.label, tx + tw / 2, L.tabY + 22, tc, "center");
      if (tb.lock) drawTabLock(ix + 11, iy - 1);
    }
    if (LH - L.tabY <= L.tabH) rect(ctx, 0, L.tabY + L.tabH - 1, LW, 1, INK);
    if (showSet) {
      hits = [];
      screenLay = [];
      dimView(ctx, "rgba(8,6,20,0.62)");
      var py0 = belowBand();
      box(ctx, x, py0, 152, 142, C.navy, C.cream);
      markBox("settings", x, py0, 152, 142);
      drawText(ctx, "НАСТРОЙКИ", LW / 2, py0 + 6, C.gold, 1, "center");
      btn("tilt", x + 8, py0 + 20, 136, 20, tiltOn ? C.mint : "#1a1430", "НАКЛОН: " + (tiltOn ? "ВКЛ" : "ВЫКЛ"), tiltOn ? INK : C.cream);
      volRow("vol", x + 8, py0 + 44, 136, "ГРОМКОСТЬ", masterVol, audioOn);
      btn("vib", x + 8, py0 + 70, 136, 20, vibOn ? C.mint : "#1a1430", "ВИБРО: " + (vibOn ? "ВКЛ" : "ВЫКЛ"), vibOn ? INK : C.cream);
      btn("set:prof", x + 8, py0 + 94, 136, 20, "#1a1430", "ПРОФИЛЬ", C.cream);
      btn("set", x + 26, py0 + 118, 100, 16, C.navy, "ЗАКРЫТЬ");
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
    var hdShop = header("МАГАЗИН", 2);
    var pw = 34, gap = 4, cols = 3, rows = 2;
    var sx = Math.round(LW / 2 - (cols * pw + (cols - 1) * gap) / 2);
    var heroY = hdShop.bottom + 4;
    markBox("heroes", sx, heroY, cols * pw + (cols - 1) * gap, rows * pw + (rows - 1) * gap);
    for (var k = 0; k < 6; k++) {
      var col = k % cols, row = Math.floor(k / cols);
      var bx = sx + col * (pw + gap), by = heroY + row * (pw + gap);
      var H = CHARS[k], own = heroOwned(k), sel = k === shopHero, on = save.char === k;
      addHit("hero:" + k, bx, by, pw, pw);
      box(ctx, bx, by, pw, pw, sel ? "#2a2050" : C.navy, sel ? C.gold : own ? C.cream : "#5a4a72");
      ctx.imageSmoothingEnabled = false;
      drawPortrait(ctx, k, bx + 1, by + 1, 1);
      if (on) {
        var qx = bx + pw - 9, qy = by + 1;
        rect(ctx, qx, qy, 7, 7, C.mint);
        rect(ctx, qx + 1, qy + 3, 2, 1, INK); rect(ctx, qx + 2, qy + 4, 2, 1, INK);
        rect(ctx, qx + 4, qy + 2, 1, 1, INK); rect(ctx, qx + 5, qy + 1, 1, 1, INK);
      }
    }
    var i = shopHero, H2 = CHARS[i], own2 = heroOwned(i), on2 = save.char === i;
    var y0 = heroY + rows * pw + (rows - 1) * gap + 4, ch = LH - y0 - 38;
    markBox("card", x, y0, 152, ch);
    box(ctx, x, y0, 152, ch, on2 ? "#2a2050" : C.navy, on2 ? C.gold : own2 ? C.cream : "#6a5a8a");
    /* Text block (name → charge line) is mid+16 … mid+85; the act button needs 22 px + 4 px air above it.
       If the card is short (TG safe-area, 360 wide), drop the bouncing hero first: the portrait above shows it. */
    var btnH = 22, btnPad = 6;
    var textBot = 85;
    var shopVis = heroArtH(H2.id, 2);
    var reserved = textBot + 4 + btnH + btnPad;
    var heroRoom = ch - reserved;
    var showHero = heroRoom >= 48;
    var mid = showHero ? y0 + heroRoom - 8 : y0 - 10;
    if (showHero) {
      rect(ctx, x + 40, mid + 8, 72, 4, C.wood); rect(ctx, x + 40, mid + 8, 72, 1, C.edge);
      var ph = (ui % 70) / 70, pose = ui % 280 > 230 ? "ability" : ph < 0.08 ? "squash" : ph < 0.5 ? "up" : "fall";
      var hop = pose === "ability" ? 6 : Math.round(Math.sin(ph * Math.PI) * 10);
      var hopMax = Math.max(0, mid + 8 - shopVis - (y0 + 1));
      if (hop > hopMax) hop = hopMax;
      drawJumper(ctx, jumperXForCenter(LW / 2, H2.id, pose, 2), mid + 8 - 32 - hop, makeLook(i, save.color, save.hat), 1, pose, ui % 170 < 6, true, 2);
    }
    drawText(ctx, H2.name, LW / 2, mid + 16, C.cream, 2, "center");
    var tw = textWidth(H2.abName, 1) + 10;
    box(ctx, Math.round(LW / 2 - tw / 2), mid + 34, tw, 12, "#3a4ac8", C.cream);
    drawText(ctx, H2.abName, LW / 2, mid + 37, C.cream, 1, "center");
    drawText(ctx, H2.abDesc[0], LW / 2, mid + 52, C.cream, 1, "center");
    drawText(ctx, H2.abDesc[1], LW / 2, mid + 62, C.cream, 1, "center");
    drawChargeLine(LW / 2, mid + 76, H2, "#9a8ab8");
    markBox("cardText", x + 4, mid + 16, 144, textBot - 16);
    var byb = Math.max(y0 + ch - btnH - btnPad, mid + textBot + 4);
    markBox("cardBtn", x + 10, byb, 132, btnH);
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
    var hdCamp = header("КАМПАНИЯ", 2);
    var tipY = hdCamp.bottom + 4;
    box(ctx, x, tipY, 152, 22, "#1a1430", C.mint);
    markBox("tip", x, tipY, 152, 22);
    drawText(ctx, "ДОЙДИ ДО ЦЕЛИ →", LW / 2, tipY + 3, C.cream, 1, "center");
    drawText(ctx, "ОТКРОЙ ЗА МОНЕТЫ", LW / 2, tipY + 13, C.mint, 1, "center");
    var top = tipY + 26, bot = LH - 40, rh = Math.min(42, Math.floor((bot - top) / MAPS.length));
    for (var i = 0; i < MAPS.length; i++) {
      var M = MAPS[i], y = top + i * rh, open = mapOpen(i), can = !open && mapGoalMet(i), locked = !open && !can;
      var bd = save.bg === M.id ? C.gold : open ? C.cream : can ? C.mint : "#4a3a6a";
      addHit("camp:" + i, x, y, 152, rh - 3);
      markBox("map" + i, x, y, 152, rh - 3);
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
    drawFlash();
  }
  function drawLobby() { /* UI only: bot lobby now, online room UI can hook here later */
    drawBg(ctx, MENU_CAM(), ui, menuMap(), true);
    dimView(ctx, "rgba(18,14,44,0.32)");
    var x = colX();
    var hdLobby = header("ЗАБЕГ С БОТАМИ", 1);
    var ps = lobbyNames();
    var row0 = hdLobby.bottom + 4;
    var slotH = 36, slotGap = 2;
    for (var i = 0; i < ps.length; i++) {
      var y = row0 + i * (slotH + slotGap);
      markBox("slot" + i, x, y, 152, slotH);
      box(ctx, x, y, 152, slotH, i === 0 ? "#2a2050" : C.navy, i === 0 ? C.gold : C.cream);
      ctx.imageSmoothingEnabled = false;
      drawPortrait(ctx, ps[i].kind, x + 2, y + 2, 1);
      drawText(ctx, ps[i].name, x + 40, y + 6, C.cream, 1, "left");
      drawText(ctx, ps[i].tag, x + 40, y + 18, i === 0 ? C.gold : "#9a8ab8", 1, "left");
      drawText(ctx, CHARS[ps[i].kind].abName, x + 148, y + 14, "#9a8ab8", 1, "right");
    }
    var my = row0 + 4 * (slotH + slotGap) + 6;
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
    for (var k = 0; k < bk.length; k++) out.push({ kind: bk[k], look: makeLook(bk[k], "base", "none"), name: "БОТ " + (k + 1), tag: CHARS[bk[k]].name.toUpperCase() });
    return out;
  }

  function poseOf(p: any) {
    if (!(p.domeT > 0) && (p.abFx > 0 || p.poundT > 0 || p.dashT > 0 || p.hookN > 0 || p.wall || p.teleFx > 10)) return "ability";
    if (p.squash > 3) return "squash";
    if (p.vy < -2.2) return "up";
    if (p.vy > 1.5) return "fall";
    return "idle";
  }
  function goalLine(y: number, label: string) {
    if (y < -8 || y > LH + 8) return;
    var yy = Math.round(y);
    for (var x = viewX0(); x < LW + VIEW_PAD; x += 4) { var on = ((x - viewX0()) >> 2) % 2 === 0; rect(ctx, x, yy, 4, 1, on ? C.cream : "#162040"); rect(ctx, x, yy + 1, 4, 1, on ? "#162040" : C.cream); }
    var tw = textWidth(label, 1) + 6;
    rect(ctx, 3, yy - 11, tw + 2, 11, INK); rect(ctx, 4, yy - 10, tw, 9, "#162040");
    drawText(ctx, label, 4 + tw / 2, yy - 9, C.gold, 1, "center");
  }
  function recLine(y: number, label: string) {
    if (y < -8 || y > LH + 8) return;
    var yy = Math.round(y);
    ctx.globalAlpha = 0.7;
    for (var x = viewX0(); x < LW + VIEW_PAD; x += 2) rect(ctx, x, yy, 1, 1, C.cream);
    ctx.globalAlpha = 1;
    var tw = textWidth(label, 1) + 6, lx = LW - tw - 5;
    rect(ctx, lx - 1, yy - 11, tw + 2, 11, INK); rect(ctx, lx, yy - 10, tw, 9, "#162040");
    drawText(ctx, label, lx + tw / 2, yy - 9, C.cream, 1, "center");
  }
  function drawReadyPip(me: any, sy: number) {
    var dbg: any = (window as any).__dbg || {}; var pp = dbg.ring && dbg.ring.pop != null ? dbg.ring.pop : popT;
    if (!heroHasAb(me) || pp < 0 || pp >= 36) return;
    var x = Math.round(me.x + PW / 2) - 2, y = Math.round(sy) - 9;
    rect(ctx, x + 1, y, 1, 1, "#3a6848"); rect(ctx, x, y + 1, 3, 1, "#3a6848"); rect(ctx, x + 1, y + 2, 1, 1, "#3a6848"); rect(ctx, x + 1, y + 1, 1, 1, "#d8e8d0");
  }
  function withWrapX(x: number, wdt: number, fn: any) {
    fn(x);
    if (x < 12) fn(x + LW);
    if (x + wdt > LW - 12) fn(x - LW);
  }
  function drawFaceMark(x: number, y: number, look: any, alive: boolean) {
    x = Math.round(x); y = Math.round(y);
    var hood = (look && look.hood) || "#c890ff";
    var skin = (look && look.skin) || "#f0c8a0";
    rect(ctx, x, y, 8, 8, "#000000");
    rect(ctx, x + 1, y + 1, 6, 3, hood);
    rect(ctx, x + 1, y + 4, 6, 3, skin);
    rect(ctx, x + 2, y + 5, 1, 1, "#000000");
    rect(ctx, x + 5, y + 5, 1, 1, "#000000");
    if (!alive) rect(ctx, x + 1, y + 1, 6, 6, "rgba(0,0,0,0.45)");
  }
  function drawRankColumn(w: any) {
    if (!w || w.mode !== "squad" || !w.players || w.players.length < 2) return;
    var list = w.players.slice().sort(function (a: any, b: any) {
      var dm = metersOf(b) - metersOf(a);
      return dm || (a.id - b.id);
    });
    var pb = pauseBox();
    var x = pb.x + pb.w - 13, y0 = hudY(26), step = 14;
    for (var i = 0; i < list.length; i++) {
      var p = list[i];
      var target = y0 + i * step;
      var cur = rankY[p.id];
      if (cur == null) cur = target;
      var next = cur + (target - cur) * 0.35;
      if (Math.abs(target - next) < 1) next = target;
      rankY[p.id] = next;
      var iy = Math.round(next);
      drawFaceMark(x, iy, p.look, !!p.alive);
      if (p.id === 0) {
        rect(ctx, x - 1, iy - 1, 10, 1, C.gold);
        rect(ctx, x - 1, iy + 8, 10, 1, C.gold);
        rect(ctx, x - 1, iy, 1, 8, C.gold);
        rect(ctx, x + 8, iy, 1, 8, C.gold);
      }
      if (!p.alive) {
        for (var d = 1; d < 11; d++) {
          rect(ctx, x + d, iy + d, 1, 1, "#a84848");
          rect(ctx, x + 11 - d, iy + d, 1, 1, "#a84848");
        }
      }
    }
  }
  function drawPlay() {
    hits = [];
    var w = world, i;
    /* Render-only: snap the camera to a device pixel, as 0.56 did with world-pixel sprite rounds, to avoid shimmer under fractional scale. Physics/camY stay untouched. */
    var me0 = w.players[0];
    if (VIEW_BOT > 0 && me0) {
      /* Look-down: keep the hero's feet >= 20 px above the visible bottom; snap down at once, ease back up 2 px/frame. */
      var lookT = Math.max(0, Math.min(VIEW_BOT, me0.y + PH - w.cameraY + 20 - viewBottom()));
      VIEW_SHIFT = lookT >= VIEW_SHIFT ? lookT : Math.max(lookT, VIEW_SHIFT - 2);
    } else VIEW_SHIFT = 0;
    var cam = Math.round((w.cameraY + VIEW_SHIFT) * pScaleY) / pScaleY;
    THREAT = w.players[0] && w.players[0].alive ? { x: w.players[0].x, y: w.players[0].y, w: PW, h: PH } : null;
    var shx = w.shake > 0 ? (w.tick % 2 ? 1 : -1) * Math.ceil(w.shake / 3) : 0;
    ctx.save();
    ctx.translate(shx, 0);
    drawBg(ctx, cam, w.tick, w.map);
    ctx.save();
    /* Clip in device pixels (ceil left / floor right) so a fractional scale cannot leak a 1 px sliver into the pads. */
    var mclip = ctx.getTransform();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    var x0 = Math.ceil(mclip.e - shx * mclip.a - 1e-9);
    var y0 = Math.ceil(mclip.f + viewY0() * mclip.d - 1e-9);
    var x1 = Math.floor(mclip.e - shx * mclip.a + LW * mclip.a + 1e-9);
    var y1 = Math.floor(mclip.f + viewY1() * mclip.d + 1e-9);
    ctx.beginPath();
    ctx.rect(x0, y0, Math.max(0, x1 - x0), Math.max(0, y1 - y0));
    ctx.clip();
    ctx.setTransform(mclip.a, mclip.b, mclip.c, mclip.d, mclip.e, mclip.f);
    for (i = 0; i < w.platforms.length; i++) drawPlatform(ctx, w.platforms[i], cam, w.map, w.tick);
    if (w.goalM) goalLine(-w.goalM * PX_PER_M - cam, "ЦЕЛЬ " + w.goalM + " М");
    if (w.recM) recLine(-w.recM * PX_PER_M - cam, "РЕКОРД " + w.recM);
    if (w.goalM) { var gy = -w.goalM * PX_PER_M - cam; if (gy > viewY0() + 8 && gy < viewY1() - 8) showFirstTimeToast("goal"); }
    if (w.recM) { var ry = -w.recM * PX_PER_M - cam; if (ry > viewY0() + 8 && ry < viewY1() - 8) showFirstTimeToast("record"); }
    for (i = 0; i < w.platforms.length; i++) {
      var brk = w.platforms[i];
      if (brk.type === "break" && !brk.broken) {
        var by2 = brk.y - cam;
        if (by2 > viewY0() + 8 && by2 < viewY1() - 8) { showFirstTimeToast("break"); break; }
      }
    }
    for (i = 0; i < w.coins.length; i++) {
      var cn = w.coins[i];
      if (!cn.taken && cn.y - cam > viewY0() - 8 && cn.y - cam < viewY1() + 4) {
        withWrapX(cn.x, 14, function (xx: number) { if (!drawCoin64(ctx, xx, Math.round(cn.y - cam), w.tick + i * 3)) drawCoin(ctx, xx, Math.round(cn.y - cam), w.tick + i * 3); });
      }
    }
    for (i = 0; i < w.items.length; i++) {
      var it = w.items[i];
      withWrapX(it.x, 14, function (xx: number) {
        var ox = it.x; it.x = xx; drawItem(ctx, it, cam, w.tick); it.x = ox;
      });
    }
    for (i = 0; i < w.monsters.length; i++) {
      var mo = w.monsters[i];
      var mw = (MOBS[mo.kind] && MOBS[mo.kind].w) || 12;
      withWrapX(mo.x, mw, function (xx: number) {
        var ox = mo.x; mo.x = xx; drawMob(ctx, mo, cam, w.map, w.freezeMobT > 0); mo.x = ox;
      });
    }
    for (i = 0; i < w.bullets.length; i++) {
      var bu = w.bullets[i];
      withWrapX(bu.x - 2, 5, function (xx: number) {
        var ox = bu.x; bu.x = xx + 2; drawBullet(ctx, bu, cam); bu.x = ox;
      });
    }
    for (i = 0; i < w.particles.length; i++) {
      var pt = w.particles[i];
      ctx.globalAlpha = clamp(pt.life / pt.max, 0, 1);
      withWrapX(pt.x, pt.s, function (xx: number) { rect(ctx, xx, pt.y - cam, pt.s, pt.s, pt.col); });
    }
    ctx.globalAlpha = 1;
    for (var wi = 0; wi < w.players.length; wi++) {
      var wp = w.players[wi];
      drawNinjaWalls(ctx, wp, wp.y - cam, cam, w.tick, wp.id === 0 && !wp.remote, LH);
    }
    var tags: any[] = [];
    for (var pi = w.players.length - 1; pi >= 0; pi--) {
      var p = w.players[pi];
      var sy = p.y - cam;
      if (sy < viewY0() - 22 || sy > viewY1() + 10) continue;
      var blink = (w.tick + p.id * 41) % 170 < 6;
      var pose = p.alive ? poseOf(p) : "fall";
      var drawHeroAt = function (xx: number) {
        var ox = p.x; p.x = xx;
        drawFxBack(p, sy, cam);
        /* Render-only: while clinging, face into the field. p.face is used by dash/kick/net, so sim stays as-is. */
        var faceDraw = p.wall === -1 ? 1 : p.wall === 1 ? -1 : p.face;
        ctx.save();
        if (p.id !== 0) ctx.globalAlpha = remoteAlpha();
        drawJumper(ctx, p.x, sy, p.look, faceDraw, pose, blink, p.alive);
        ctx.restore();
        if (p.id === 0) drawReadyPip(p, sy);
        drawFxFront(p, sy, w.tick);
        p.x = ox;
      };
      drawHeroAt(p.x);
      if (p.wallT <= 0 && p.x < 12) drawHeroAt(p.x + LW);
      if (p.wallT <= 0 && p.x > LW - PW - 12) drawHeroAt(p.x - LW);
      if (w.mode === "squad") tags.push({ p: p, x: p.x + 6, y: Math.round(sy) - 13 });
    }
    tags.sort(function (a: any, b: any) { return b.y - a.y; });
    for (i = 0; i < tags.length; i++) {
      var tg = tags[i];
      var isMe = tg.p.id === 0;
      var tgNm = String(tg.p.name || "БОТ");
      var label = !tg.p.alive ? "ВЫБЫЛ" : isMe ? "▼" : /^БОТ \d$/.test(tgNm) ? tgNm : tgNm.slice(0, 3);
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
    ctx.restore();

    var me = w.players[0];
    var wantPause = wantTouchPause();
    var meter = metersOf(me) + " М";
    var pb = pauseBox();
    coinsLabel(5, hudY(6), w.runCoins);
    drawTextO(ctx, meter, wantPause ? pb.x - 4 : LW - edgePad("right"), hudY(6), C.cream, "right");
    drawRankColumn(w);
    if (wantPause) {
      addHit("pause", pb.x, pb.y, pb.w, pb.h);
      rect(ctx, pb.x + 3, hudY(3), 15, 15, pressId === "pause" ? "#3a4a7a" : INK);
      rect(ctx, pb.x + 4, hudY(4), 13, 13, "#1a1430");
      rect(ctx, pb.x + 7, hudY(7), 2, 7, C.cream);
      rect(ctx, pb.x + 12, hudY(7), 2, 7, C.cream);
    }
    drawBonusHud(me);
    drawAbRing(me);
    if (w.toastT > 0) {
      var tw2 = textWidth(w.toast, 1) + 12;
      ctx.globalAlpha = Math.min(1, w.toastT / 15);
      box(ctx, Math.round(LW / 2 - tw2 / 2), hudY(38), tw2, 13, C.navy, C.gold);
      drawText(ctx, w.toast, LW / 2, hudY(41), C.gold, 1, "center");
      ctx.globalAlpha = 1;
    }
    if (w.tick < 170 && !(w.toastT > 0) && !paused) {
      ctx.globalAlpha = clamp((170 - w.tick) / 40, 0, 1);
      var Hn = CHARS[me.kind];
      var line1 = !isPhone ? "← → ХОД" : "ТАП СЛЕВА / СПРАВА";
      var line2 = abHintRun ? (!isPhone ? ("↑ " + Hn.abName) : ("СВАЙП ↑ " + Hn.abName)) : "";
      var htw = textWidth(line1, 1);
      if (line2) htw = Math.max(htw, textWidth(line2, 1));
      var hw = htw + 12, hh = line2 ? 23 : 12, hx = Math.round(LW / 2 - hw / 2);
      box(ctx, hx, hudY(56), hw, hh, C.navy, C.cream);
      drawText(ctx, line1, LW / 2, hudY(58), C.cream, 1, "center");
      if (line2) drawText(ctx, line2, LW / 2, hudY(68), C.cream, 1, "center");
      ctx.globalAlpha = 1;
    }
    if ((w.fallWarn || w.liftWarn) && !paused) {
      if ((ui >> 2) % 2) {
        ctx.globalAlpha = w.fallWarn ? 0.9 : 0.6;
        rect(ctx, 0, viewBottom() - 4, LW, 4, C.red);
        var cxw = Math.round(LW / 2);
        rect(ctx, cxw, viewBottom() - 12, 2, 2, C.cream);
        rect(ctx, cxw - 2, viewBottom() - 10, 6, 2, C.cream);
        rect(ctx, cxw - 4, viewBottom() - 8, 10, 2, C.cream);
        ctx.globalAlpha = 1;
      }
      if (w.liftWarn) {
        var liftLab = "ЛЕЗЬ ВВЕРХ!";
        var ltw = textWidth(liftLab, 1) + 10;
        box(ctx, Math.round(LW / 2 - ltw / 2), viewBottom() - 24, ltw, 13, C.navy, C.gold);
        drawText(ctx, liftLab, LW / 2, viewBottom() - 21, C.gold, 1, "center");
      }
    }
    if (paused) {
      dimView(ctx, "rgba(8,6,20,0.55)");
      var px = colX();
      var land = !!(landPause && resumeCd <= 0);
      var top = Math.round(LH / 2 - (resumeCd > 0 ? 62 : land ? 78 : 64));
      var panelH = resumeCd > 0 ? 124 : land ? 150 : 128;
      box(ctx, px, top, 152, panelH, C.navy, C.gold);
      drawBig(ctx, "ПАУЗА", LW / 2, top + 8, C.gold, 2, "center", INK);
      var py = top + 28;
      if (resumeCd > 0) {
        drawText(ctx, String(resumeCd), LW / 2, py, C.gold, 3, "center");
        py += 26;
      } else if (land) {
        drawText(ctx, "ПОВЕРНИ ТЕЛЕФОН", LW / 2, py, C.cream, 1, "center");
        py += 14;
      }
      volRow("vol", px + 8, py, 136, "ГРОМКОСТЬ", masterVol, audioOn);
      py += 28;
      if (resumeCd > 0) btn("menu", px + 10, py, 132, 22, C.navy, "МЕНЮ");
      else {
        btn("resume", px + 10, py, 132, 22, C.mint, "ПРОДОЛЖИТЬ", INK);
        btn("menu", px + 10, py + 26, 132, 22, C.navy, "МЕНЮ");
      }
      pauseLay = hits.filter(function (h: any) {
        return h.id === "vol" || h.id === "vol:mute" || h.id === "resume" || h.id === "menu";
      });
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
  /* Robot shield: a solid violet band from the first tick. Render only; domeT is unchanged. */
  function drawDome(p: any, cx: number, cy: number, _tick: number) {
    if (!(p.domeT > 0)) return;
    var left = p.domeT;
    if (left <= 55 && ((left >> 2) % 2) === 0) return;
    var rad = 16, ysc = 1.4;
    solidRing(cx, cy, rad + 1, ysc, "#2a1048");
    solidRing(cx, cy, rad, ysc, "#f4e8ff");
    solidRing(cx, cy, rad - 1, ysc, "#7a4ec8");
  }
  function solidRing(cx: number, cy: number, r: number, ysc: number, col: string) {
    var n = Math.max(8, Math.round(r * 8 * Math.max(1, ysc)));
    for (var k = 0; k < n; k++) {
      var a = (k / n) * Math.PI * 2;
      rect(ctx, Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r * ysc), 1, 1, col);
    }
  }
  function drawFxFront(p: any, sy: number, tick: number) {
    if (!p.alive) return;
    var cx = Math.round(p.x + 6), cy = Math.round(sy + 6);
    if (p.shieldT > 0) drawShieldAura(ctx, p, sy, tick);
    drawDome(p, cx, cy, tick);
    if (p.freezeT > 0) { ctx.globalAlpha = 0.45; rect(ctx, p.x - 2, sy - 6, PW + 4, PH + 6, "#c8f8ff"); ctx.globalAlpha = 1; }
    if (p.rocketT > 0) { rect(ctx, cx - 2, sy + PH, 4, 3 + (ui % 3), "#ffd046"); rect(ctx, cx - 1, sy + PH + 3, 2, 3, "#ff7830"); }
  }
  var BON_HUD: any[] = [["shieldT", "shield", 500], ["magnetT", "magnet", 450], ["rocketT", "rocket", 85], ["domeT", "shield", 200], ["wallT", "rocket", 300]];
  function drawBonusHud(me: any) {
    var x = 3, y = hudY(36);
    for (var i = 0; i < BON_HUD.length; i++) {
      var b = BON_HUD[i], t = me[b[0]];
      if (!(t > 0)) continue;
      if (b[0] === "domeT" || b[0] === "wallT") continue;
      rect(ctx, x, y, 16, 18, INK); rect(ctx, x + 1, y + 1, 14, 16, "#1a1430");
      drawHudIcon(ctx, b[1], x + 3, y + 2);
      var f = clamp(t / b[2], 0, 1);
      rect(ctx, x + 3, y + 14, 10, 2, "#2c2a52"); rect(ctx, x + 3, y + 14, Math.max(1, Math.round(10 * f)), 2, ITEM_COL[b[1]] || C.cream);
      y += 20;
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
  function ruCount(n: number, one: string, few: string, many: string) {
    var k = Math.abs(Math.floor(n));
    var m100 = k % 100, m10 = k % 10;
    var w = (m100 >= 11 && m100 <= 14) ? many : m10 === 1 ? one : (m10 >= 2 && m10 <= 4) ? few : many;
    return k + " " + w;
  }
  function drawChargeLine(cx: number, y: number, H: any, col: string) {
    var ic = H.charge;
    var chg = ic === "time" ? Math.round(H.need / 50) + " СЕК"
      : ic === "coins" ? ruCount(H.need, "МОНЕТА", "МОНЕТЫ", "МОНЕТ")
      : ic === "height" ? H.need + " М"
      : ruCount(H.need, "МОБ", "МОБА", "МОБОВ");
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
  function drawAbRing(me: any) {
    if (!heroHasAb(me)) return;
    var H = CHARS[me.kind], dbg: any = (window as any).__dbg || {}, rs = dbg.ring || {};
    var f = rs.f != null ? rs.f : clamp(me.abCharge / H.need, 0, 1);
    var ready = rs.state ? rs.state === "ready" : (me.alive && me.abCharge >= H.need);
    var active = rs.state ? rs.state === "active" : !!(me.dashT > 0 || me.wall || me.domeT > 0 || me.poundT > 0);
    var rf = rs.refuse != null ? rs.refuse : abDenyT;
    var b = abBar();
    var shx = rf > 0 ? ((rf % 4 < 2) ? 1 : -1) : 0;
    var cx = b.x + 8 + shx, cy = b.y + 8;
    addHit("ab", b.x, b.y, b.w, b.h);
    fillDisc(cx, cy, 8, INK);
    fillDisc(cx, cy, 7, ready ? "#3a6848" : "#3a4a7a");
    fillDisc(cx, cy, 6, "#1a1430");
    if (active) strokeArc(cx, cy, 6, C.cream, rs.f != null ? rs.f : 1);
    else if (ready) strokeArc(cx, cy, 8, "#4e8a58", 1);
    else strokeArc(cx, cy, 6, "#5ec8ff", f);
    ctx.globalAlpha = ready || active || rf > 0 ? 1 : 0.55;
    drawAbIcon(H.ab, cx - 6, cy - 6);
    ctx.globalAlpha = 1;
  }
  function whyText(p: any) {
    var m = metersOf(p), w = p.why || "";
    if (w === "fall") return "СОРВАЛСЯ · " + m + " М";
    if (w === "shot") return "СБИЛ ВЫСТРЕЛ · " + m + " М";
    if (w === "hole") return "ЗАТЯНУЛА ДЫРА · " + m + " М";
    if (w === "left") return "ВЫШЕЛ · " + m + " М";
    if (w.indexOf("mob:") === 0) {
      var mk = w.slice(4);
      var mo = MOBS[mk] || {};
      var nm = mo.name || "МОБ";
      if (mk === "hole") nm = "ДЫРА";
      if (m >= 10000) {
        if (mk === "snake") nm = "ЛИАНА";
        if (mk === "frost") nm = "ДУХ";
      }
      return ((mo.g === "f") ? "СБИЛА " : "СБИЛ ") + nm + " · " + m + " М";
    }
    return w ? w + " · " + m + " М" : "";
  }
  function nextHeroNeed() {
    for (var i = 0; i < CHARS.length; i++) if (!heroOwned(i)) return { i: i, H: CHARS[i], left: Math.max(0, CHARS[i].price - save.coins) };
    return null;
  }
  function limitLabel(code: string) {
    if (code === "HEIGHT_MIN") return "ЗА ВЫСОТУ · С 100 М";
    if (code === "HEIGHT_CAP") return "ВЫСОТА СРЕЗАНА";
    if (code === "COINS_CAP") return "МОНЕТЫ СРЕЗАНЫ";
    if (code === "BONUS_CAP") return "БОНУС СРЕЗАН";
    if (code === "DUPLICATE") return "УЖЕ ЗАСЧИТАН";
    if (code === "OFFLINE") return "НЕТ СЕТИ";
    if (code === "FAST") return "СЛИШКОМ БЫСТРО";
    if (code === "REJECTED") return "НЕ ПРИНЯТО";
    return "";
  }
  function pushRes(id: string, x: number, y: number, w: number, h: number) {
    resultLay.push({ id: id, x: x, y: y, w: w, h: h });
  }
  function eveningCount() {
    try {
      var S = (typeof NET !== "undefined" && NET.session) ? NET.session : null;
      if (!world.net || !S || !S.rounds || !S.rounds.length) return 0;
      var n = 0, k;
      for (k in S.names) n++;
      if (!n) { for (k in S.wins) n++; }
      return n;
    } catch (_e) { return 0; }
  }
  function drawEveningCompact(x: number, y: number) {
    var S = NET.session, pids: any[] = [], k;
    for (k in S.names) pids.push(k);
    if (!pids.length) for (k in S.wins) if (pids.indexOf(k) < 0) pids.push(k);
    pids.sort(function (a: any, b: any) { return (S.wins[b] || 0) - (S.wins[a] || 0); });
    var h = 11 + pids.length * 9;
    box(ctx, x, y, 152, h, C.navy, C.gold);
    pushRes("evening", x, y, 152, h);
    var roundNo = 0;
    for (var ri = 0; ri < S.rounds.length; ri++) roundNo = Math.max(roundNo, Number(S.rounds[ri] && S.rounds[ri].round) || 0);
    if (!roundNo) roundNo = S.rounds.length;
    drawText(ctx, "СЧЁТ ВЕЧЕРА · РАУНД " + roundNo, LW / 2, y + 2, C.gold, 1, "center");
    for (var i = 0; i < pids.length; i++) {
      var pid = pids[i];
      var lineY = y + 11 + i * 9;
      drawText(ctx, String(S.names[pid] || "ИГРОК").slice(0, 8), x + 6, lineY, C.cream, 1, "left");
      drawText(ctx, (S.wins[pid] || 0) + "П  " + (S.best[pid] || 0) + "М", x + 146, lineY, C.cream, 1, "right");
    }
    return y + h + 3;
  }
  function drawResults() {
    hits = [];
    resultLay = [];
    drawBg(ctx, world.cameraY, ui, world.map);
    dimView(ctx, "rgba(18,14,44,0.36)");
    var x = colX();
    var bot = Math.round(insetSideCss("bottom") / Math.max(0.01, cssScale || 1));
    var hdRes = header("ИТОГИ", 2);
    var list = world.players.slice().sort(function (a: any, b: any) { return a.place - b.place; });
    var squad = world.mode === "squad";
    var me = world.players[0], mtr = metersOf(me), why = whyText(me);
    var note = limitLabel(world.limited);
    var mi2 = mapIdx(world.map), M2 = MAPS[mi2];
    /* Only talk about the next map while it is still locked. «МОЖНО ОТКРЫТЬ» only when the goal is met AND coins suffice. */
    var hasGoal = !!(M2.goal && mi2 + 1 < MAPS.length && !mapOpen(mi2 + 1));
    var met = hasGoal && mapBest(mi2) >= M2.goal;
    if (met && save.coins < (MAPS[mi2 + 1].price || 0)) hasGoal = false;
    var evN = eveningCount();
    /* Roman: no permanent «ДО ПИРАТА ● N» line on the results screen. */
    var nh: any = null;
    var y0 = hdRes.bottom + 4;
    var btnY = LH - 64 - bot;
    var resVis = 0;
    for (var ri = 0; ri < list.length; ri++) { var rv = heroArtH((list[ri].look && list[ri].look.id) || "pilot", 1); if (rv > resVis) resVis = rv; }
    var resRow = Math.max(33, Math.ceil(resVis + 4)), resStep = resRow + 3;
    var full = list.length * (squad ? Math.max(28, resStep) : resStep) + (why ? 18 : 0) + (hasGoal ? (met ? 26 : 32) : 0) + (note ? 72 : 60) + (evN ? (13 + evN * 11 + 6) : 0) + 16 + (nh ? 26 : 0);
    var compact = full > btnY - 4 - y0;
    var y = y0;
    var limitY = btnY - 4;
    for (var i = 0; i < list.length; i++) {
      var p = list[i];
      var rowH = compact ? 13 : (squad ? Math.max(25, resRow) : resRow);
      var step = compact ? 14 : (squad ? Math.max(28, resStep) : resStep);
      if (y + step > limitY) break;
      var fill = p.place === 1 ? "#6a4a10" : p.place === 2 ? "#3a4050" : p.place === 3 ? "#4a3020" : C.navy;
      box(ctx, x, y, 152, rowH, fill, p.id === 0 ? C.gold : C.cream);
      pushRes("place" + p.place, x, y, 152, rowH);
      if (compact) {
        drawText(ctx, String(p.place), x + 8, y + 3, p.place === 1 ? C.gold : C.cream, 1, "center");
        drawFaceMark(x + 16, y + 1, p.look, !!p.alive);
        drawText(ctx, String(p.name || "").slice(0, 8) + " " + metersOf(p) + " М", x + 30, y + 3, C.cream, 1, "left");
      } else {
        drawText(ctx, String(p.place), x + 10, y + rowH / 2 - 6, p.place === 1 ? C.gold : C.cream, 2, "center");
        drawJumper(ctx, x + 22, y + rowH - 16, p.look, 1, "idle", false, true);
        drawText(ctx, p.name + (p.id === 0 && squad ? " (ТЫ)" : ""), x + 42, y + 4, C.cream, 1, "left");
        drawText(ctx, metersOf(p) + " М", x + 42, y + 14, C.cream, 1, "left");
      }
      y += step;
    }
    if (why && y + (compact ? 13 : 18) <= limitY) {
      var wh = compact ? 12 : 14;
      box(ctx, x, y, 152, wh, "#201838", "#8a7ab8");
      pushRes("why", x, y, 152, wh);
      drawText(ctx, why, LW / 2, y + (compact ? 3 : 4), "#d8c8f0", 1, "center");
      y += compact ? 13 : 18;
    }
    if (hasGoal && y + (compact ? 16 : (met ? 26 : 32)) <= limitY) {
      var nxt = MAPS[mi2 + 1], b = mapBest(mi2);
      if (met) {
        var gh = compact ? 14 : 22;
        addHit("camp", x, y, 152, gh);
        box(ctx, x, y, 152, gh, C.navy, C.mint);
        pushRes("goal", x, y, 152, gh);
        drawText(ctx, nxt.name + ": МОЖНО ОТКРЫТЬ", LW / 2, y + (compact ? 4 : 7), C.mint, 1, "center");
        y += compact ? 16 : 26;
      } else if (!compact) {
        box(ctx, x, y, 152, 28, C.navy, C.gold);
        pushRes("goal", x, y, 152, 28);
        drawText(ctx, "ДО " + TO[mi2 + 1], x + 6, y + 3, C.cream, 1, "left");
        drawText(ctx, b + "/" + M2.goal + " М", x + 146, y + 3, C.cream, 1, "right");
        bar(x + 6, y + 16, 140, 6, b / M2.goal, C.gold);
        y += 32;
      } else {
        box(ctx, x, y, 152, 14, C.navy, C.gold);
        pushRes("goal", x, y, 152, 14);
        drawText(ctx, "ДО " + TO[mi2 + 1] + " " + b + "/" + M2.goal, LW / 2, y + 4, C.cream, 1, "center");
        y += 16;
      }
    }
    var rec = save.mapBest[world.map] || world.best || 0;
    var ah = compact ? (note ? 50 : 42) : (note ? 82 : 70);
    if (y + ah + 4 <= limitY) {
      box(ctx, x, y, 152, ah, C.navy, C.gold);
      pushRes("award", x, y, 152, ah);
      drawText(ctx, "ВЫСОТА " + mtr + " М", x + 6, y + 3, C.cream, 1, "left"); coinsLabel(x + 146, y + 3, world.earnH || 0, "right");
      drawText(ctx, "СОБРАНО", x + 6, y + (compact ? 12 : 15), C.cream, 1, "left"); coinsLabel(x + 146, y + (compact ? 12 : 15), world.earnC || 0, "right");
      drawText(ctx, "КЛАДЫ", x + 6, y + (compact ? 21 : 27), C.cream, 1, "left"); coinsLabel(x + 146, y + (compact ? 21 : 27), world.earnB || 0, "right");
      var dur = 700, nowA = (typeof performance !== "undefined" ? performance.now() : Date.now());
      if (coinT0 < 0) coinT0 = nowA;
      var kk = coinSkip ? 1 : Math.max(0, Math.min(1, (nowA - coinT0) / dur));
      kk = 1 - (1 - kk) * (1 - kk);
      var shownEarn = Math.round((world.earned || 0) * kk);
      var shownTot = (world.coinFrom != null ? world.coinFrom : (save.coins - (world.earned || 0))) + shownEarn;
      if (kk < 1 && (ui % 4 === 0)) hopSfx("tick");
      if (compact) {
        drawText(ctx, "+" + shownEarn + " → " + shownTot, LW / 2, y + 30, C.gold, 1, "center");
        if (note) drawText(ctx, note, LW / 2, y + 39, C.cream, 1, "center");
      } else {
        rect(ctx, x + 6, y + 37, 140, 1, "#5a4a7a");
        drawText(ctx, "+" + shownEarn + " → " + shownTot, LW / 2, y + 42, C.gold, 2, "center");
        if (note) drawText(ctx, note, LW / 2, y + 62, C.cream, 1, "center");
      }
      y += compact ? ah + 3 : (note ? 72 : 60);
    }
    if (evN && y + 16 <= limitY) {
      var ey = y;
      y = NET.drawEvening(ctx, x, y, limitY);
      pushRes("evening", x, ey, 152, Math.max(12, y - ey - 4));
    }
    var recH = world.newBest ? 13 : 11;
    if (y + recH <= limitY) {
      if (world.newBest) {
        box(ctx, x, y, 152, 13, C.navy, C.gold);
        pushRes("record", x, y, 152, 13);
        drawText(ctx, "НОВЫЙ РЕКОРД КАРТЫ " + rec + " М", LW / 2, y + 3, C.gold, 1, "center");
        y += 15;
      } else {
        pushRes("record", x, y, 152, 9);
        drawText(ctx, "РЕКОРД КАРТЫ " + rec + " М", LW / 2, y + 1, C.cream, 1, "center");
        y += 12;
      }
    }
    if (nh && y + (compact ? 14 : 22) <= limitY) {
      var nhH = compact ? 12 : 22;
      if (nh.left === 0 && !compact) {
        addHit("shop", x, y, 152, 22);
        box(ctx, x, y, 152, 22, C.navy, C.mint);
        pushRes("need", x, y, 152, 22);
        drawText(ctx, "ХВАТАЕТ НА " + HTO[nh.i] + "!", LW / 2, y + 7, C.mint, 1, "center");
      } else if (!compact) {
        box(ctx, x, y, 152, 22, C.navy, C.coral);
        pushRes("need", x, y, 152, 22);
        drawText(ctx, "ДО " + HTO[nh.i] + " ОСТАЛОСЬ ● " + nh.left, LW / 2, y + 3, C.cream, 1, "center");
        var runsLeft = Math.max(1, Math.ceil(nh.left / Math.max(8, world.earned || 8)));
        drawText(ctx, "ЕЩЁ " + ruCount(runsLeft, "ЗАБЕГ", "ЗАБЕГА", "ЗАБЕГОВ"), LW / 2, y + 12, C.gold, 1, "center");
      } else {
        box(ctx, x, y, 152, nhH, C.navy, C.coral);
        pushRes("need", x, y, 152, nhH);
        drawText(ctx, "ДО " + HTO[nh.i] + " ● " + nh.left, LW / 2, y + 3, C.cream, 1, "center");
      }
    }
    var lab = squad ? "РЕВАНШ ▶" : "ЕЩЁ РАЗ ▶";
    btn("rematch", x, btnY, 152, 28, C.mint, lab, INK, 2);
    btn("menu", x, btnY + 32, 72, 22, C.navy, "МЕНЮ");
    btn("shop", x + 80, btnY + 32, 72, 22, C.navy, "МАГАЗИН");
    pushRes("rematch", x, btnY, 152, 28);
    pushRes("menu", x, btnY + 32, 72, 22);
    pushRes("shop", x + 80, btnY + 32, 72, 22);
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
      if (abDenyT > 0) abDenyT--;
      if (refuseT > 0) refuseT--;
      if (world && world.players && world.players[0]) {
        var rdyNow = heroHasAb(world.players[0]) && world.players[0].alive && world.players[0].abCharge >= CHARS[world.players[0].kind].need;
        if (rdyNow && !wasReady) popT = 0;
        wasReady = rdyNow;
        if (popT >= 0) popT++;
        if (popT > 36) popT = -1;
      }
      uiAcc -= UI_STEP;
      uSteps++;
    }
    if (resumeCd > 0 && paused) {
      if (now - resumeAt >= 1000) {
        resumeCd--;
        resumeAt = now;
        if (resumeCd <= 0) { paused = false; landPause = false; manualPause = false; acc = 0; uiAcc = 0; lastT = now; }
      }
    }
    bindTgInsets();
    HUD_INSET = phase === "play" ? Math.round(insetTopCss() / Math.max(0.01, cssScale || 1)) : 0;
    syncBackdrop(menuMap());
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
    screenLay = [];
    if (phase === "menu") { drawMenu(); if (sessionNote) drawSessionNote(); }
    else if (phase === "shop") drawShop();
    else if (phase === "camp") drawCamp();
    else if (phase === "lobby") drawLobby();
    else if (phase === "results") drawResults();
    else if (phase === "font") drawFontSheet();
    else if (phase === "net") { hits = []; NET.draw(netApi); drawFlash(); }
    if (phase !== "play") drawWallet();
    else { drawPlay(); if (world && world.net) NET.overlay(netApi, world); }
    if (showProf && phase !== "play") drawProfileCard();
    if (phoneLand && phase !== "play") {
      dimView(ctx, "rgba(8,6,20,0.55)");
      box(ctx, colX(), LH / 2 - 28, 152, 40, C.navy, C.gold);
      drawText(ctx, "ПОВЕРНИ ТЕЛЕФОН", LW / 2, LH / 2 - 14, C.cream, 1, "center");
      hits = [];
    }
    if (PHONE_INT && FIELD_OY > 0) {
      var lb = mixHex(skyAt(menuMap(), 0)[0], INK, LETTERBOX_MIX);
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = lb;
      ctx.fillRect(0, 0, DEV_W, FIELD_OY); ctx.fillRect(0, FIELD_OY + LH * pScale, DEV_W, DEV_H - FIELD_OY - LH * pScale);
      ctx.restore();
    }
    if (netFixedLW() !== netLW || (fieldLocked && phase === "play" && !isWide) !== lastFill) resize();
    hopMusicTick();
    if (audioUnlocked) hopMusic(musicCue(phase, (phase === "play" && world && world.map) || save.bg || "city"));
    if (running && !driving) raf = requestAnimationFrame(frame);
  }

  /* net: what the online module may use from the shell */
  var netApi: any = {
    ctx: ctx, btn: btn, header: header, belowBand: belowBand, markBox: markBox, colX: colX, say: say, openMaps: openMaps, heroOwned: heroOwned, accountName: accountName, relayout: function () { resize(); },
    sessionReplaced: function () { sessionNote = true; goMenu(); },
    sessionOk: function () { sessionNote = false; },
    bg: function () { drawBg(ctx, MENU_CAM(), ui, menuMap(), true); dimView(ctx, "rgba(18,14,44,0.32)"); },
    ui: function () { return ui; }, save: function () { return save; }, saveNow: function () { writeSave(save); },
    world: function () { return world; }, phase: function () { return phase; },
    setPhase: function (p: string) { phase = p; }, goMenu: goMenu,
    bots: function () { activate("mp"); }, startNet: startNet
  };
  NET.bind(netApi);
  NET.tryResume(netApi);
  var profileApi: any = {
    save: function () { return save; },
    saveNow: function () { writeSave(save); },
    say: function (s: string) { say(s); },
    sessionReplaced: function () { sessionNote = true; goMenu(); },
    sessionOk: function () { sessionNote = false; },
    apply: function (prof: any, wRef?: any, awarded?: number, effectiveCoins?: number, limited?: string) {
      if (!prof) return;
      if (typeof effectiveCoins === "number" && effectiveCoins >= 0) save.coins = effectiveCoins;
      else if (typeof prof.coins === "number" && prof.coins >= 0) save.coins = prof.coins;
      if (typeof prof.best === "number" && prof.best > (save.best || 0)) save.best = prof.best;
      if (prof.campaign && prof.campaign.best && typeof prof.campaign.best === "object") {
        if (!save.mapBest || typeof save.mapBest !== "object") save.mapBest = {};
        for (var mk in prof.campaign.best) {
          var mv = Math.floor(Number(prof.campaign.best[mk]) || 0);
          if (mv > (save.mapBest[mk] || 0)) save.mapBest[mk] = mv;
        }
      }
      if (prof.purchases && typeof prof.purchases === "object") {
        for (var k in prof.purchases) if (prof.purchases[k]) save.owned[k] = 1;
        var pend: any = {};
        try { if (typeof PROFILE !== "undefined" && PROFILE && PROFILE.pendingBuyKeys) pend = PROFILE.pendingBuyKeys() || {}; } catch (_e) {}
        for (var ok in save.owned) {
          if (save.owned[ok] && !prof.purchases[ok] && !pend[ok]) delete save.owned[ok];
        }
        if (!heroOwned(save.char)) save.char = 0;
        var bi = mapIdx(save.bg);
        if (bi > 0 && !mapOpen(bi)) save.bg = MAPS[0].id;
      }
      if (wRef && world === wRef && typeof awarded === "number") {
        wRef.earned = awarded;
        wRef.coinFrom = Math.max(0, save.coins - awarded);
        wRef.best = save.best;
        if (typeof limited === "string") wRef.limited = limited;
      }
      writeSave(save);
    }
  };
  if (typeof PROFILE !== "undefined" && PROFILE) PROFILE.init(profileApi);
  function onVis() {
    acc = 0; uiAcc = 0; lastT = -1;
    if (!document.hidden && audioUnlocked) {
      ensureCtx();
      if (audioOn && masterVol > 0) {
        var id = musicCur || musicCue(phase === "play" ? "play" : "menu", (save && save.bg) || "city");
        musicCur = "";
        stopMusic();
        hopMusic(id);
      } else applyMaster();
    }
    if (document.hidden && phase === "play") paused = true;
  }
  var envSide: any = {};
  var testInsetTop = 0;
  function insetSideCss(side: string) {
    var sum = 0;
    try {
      var tg = (window as any).Telegram && (window as any).Telegram.WebApp;
      if (tg) {
        var c = tg.contentSafeAreaInset, s = tg.safeAreaInset;
        var jsSum = ((s && Number(s[side])) || 0) + ((c && Number(c[side])) || 0);
        var cssSum = 0;
        try {
          var cs = getComputedStyle(document.documentElement);
          cssSum = (parseFloat(cs.getPropertyValue("--tg-safe-area-inset-" + side)) || 0)
            + (parseFloat(cs.getPropertyValue("--tg-content-safe-area-inset-" + side)) || 0);
        } catch (_eCss) {}
        sum = Math.max(jsSum, cssSum);
      }
    } catch (_e) {}
    if (sum > 0) return sum;
    if (envSide[side] == null) {
      envSide[side] = 0;
      try {
        var cap = side.charAt(0).toUpperCase() + side.slice(1);
        var probe = document.createElement("div");
        probe.style.cssText = "position:absolute;padding-" + side + ":env(safe-area-inset-" + side + ")";
        document.body.appendChild(probe);
        envSide[side] = parseFloat((getComputedStyle(probe) as any)["padding" + cap]) || 0;
        probe.remove();
      } catch (_e2) { envSide[side] = 0; }
    }
    return envSide[side];
  }
  function insetTopCss() { return insetSideCss("top"); }
  function edgePad(side: string) {
    return 5 + Math.round(insetSideCss(side) / Math.max(0.01, cssScale || 1));
  }
  function pauseBox() {
    return { x: LW - edgePad("right") - 22, y: hudY(0), w: 22, h: 22 };
  }
  function bindTgInsets() {
    if (tgInsetBound) return;
    var w: any = window as any;
    var tg = w.Telegram && w.Telegram.WebApp;
    if (!tg) {
      if (w.__tgReady && w.__tgReady.then && !w.__hopInsetWait) {
        w.__hopInsetWait = true;
        w.__tgReady.then(function () { bindTgInsets(); });
      }
      return;
    }
    tgInsetBound = true;
    var bump = function () { resize(); };
    try {
      if (tg.onEvent) {
        tg.onEvent("safeAreaChanged", bump);
        tg.onEvent("contentSafeAreaChanged", bump);
        tg.onEvent("fullscreenChanged", bump);
      }
    } catch (_e) {}
    try {
      var bb = tg.BackButton;
      if (bb && bb.onClick) bb.onClick(function () { if (showProf) showProf = false; });
    } catch (_e2) {}
  }
  function wantTouchPause() {
    if (isPhone || !isWide) return true;
    try { return !!(navigator && navigator.maxTouchPoints); } catch (_e) { return false; }
  }
  var ptrRoot: any = wrap || canvas;
  resize();
  window.addEventListener("resize", resize);
  document.addEventListener("fullscreenchange", function () {
    if (cinemaOn && !document.fullscreenElement) { cinemaOn = false; resize(); }
  });
  var onOrientationChange = function () { resize(); setTimeout(resize, 300); setTimeout(resize, 800); };
  window.addEventListener("orientationchange", onOrientationChange);
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
  var onTouch = function (e: any) { audioUnlock(); noScroll(e); };
  canvas.addEventListener("touchstart", onTouch, { passive: false });
  if (ptrRoot !== canvas) ptrRoot.addEventListener("touchstart", noScroll, { passive: false });
  raf = requestAnimationFrame(frame);

  return {
    destroy: function () {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("orientationchange", onOrientationChange);
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
      canvas.removeEventListener("touchstart", onTouch);
    },
    getPhase: function () { return phase; },
    dbgToast: function (s: string) { if (world) { world.toast = s; world.toastT = 70; } },
    getWorld: function () { return world; },
    net: NET,
    profile: typeof PROFILE !== "undefined" ? PROFILE : null,
    getSave: function () { return save; },
    getFlash: function () { return flash; },
    getSize: function () { return { lw: LW, lh: LH, scale: SCALE, pScale: pScale, pScaleY: pScaleY, cssScale: cssScale, dpr: Math.max(1, window.devicePixelRatio || 1), isWide: isWide, isPhone: isPhone, phoneLand: phoneLand, paused: paused, landPause: landPause, manualPause: manualPause, resumeCd: resumeCd, cw: canvas.width, ch: canvas.height, viewPad: VIEW_PAD, viewCrop: VIEW_CROP, viewBot: VIEW_BOT, viewShift: VIEW_SHIFT, fieldOx: FIELD_OX, fieldOy: FIELD_OY, phoneInt: PHONE_INT, devW: DEV_W, devH: DEV_H }; },
    tap: function (id: string) { activate(id); },
    audioUnlock: function () { audioUnlock(); },
    sfxPlay: function (k: string) { hopSfx(k); },
    sfxStats: function () { return sfxStat; },
    sfxReady: function (k: string) { return !!sfxBuf[k]; },
    screen: function (s: string) { phase = s; },
    start: function (m: string, seed?: number, mapId?: string) { mode = m || "solo"; if (mapId) save.bg = mapId; startRun(seed); },
    setDir: function (d: number) { held.kl = d < 0; held.kr = d > 0; },
    setAutoPlay: function (on: boolean) { autoPlay = !!on; },
    ability: function () { abTap = true; },
    setHero: function (k: number) { save.char = k; },
    addCoins: function (n: number) { save.coins += n; writeSave(save); },
    forceResults: function () { if (world) { finish(world); payout(); phase = "results"; } },
    setVolume: function (v: number) { setMasterVol(v); save.vol = masterVol; save.music = masterVol; save.sfxVol = masterVol; writeSave(save); },
    audioProbe: function () { return readAudioProbe(); },
    menuLayout: function () { return menuLay; },
    heroAlign: function (where: string) {
      var poses = where === "shop" ? ["squash", "up", "fall", "ability"] : ["squash", "up", "fall"];
      var rows: any[] = [];
      for (var k = 0; k < CHARS.length; k++) {
        for (var p = 0; p < poses.length; p++) {
          var pose = poses[p];
          var cv = document.createElement("canvas");
          cv.width = LW; cv.height = 80;
          var g = cv.getContext("2d");
          if (!g) continue;
          var x = jumperXForCenter(LW / 2, CHARS[k].id, pose, 2);
          drawJumper(g, x, 40, makeLook(k, "base", "none"), 1, pose, false, true, 2);
          var img = g.getImageData(0, 0, LW, 80).data;
          var minX = LW, maxX = -1;
          for (var yy = 0; yy < 80; yy++) for (var xx = 0; xx < LW; xx++) {
            if (img[(yy * LW + xx) * 4 + 3] > 20) {
              if (xx < minX) minX = xx;
              if (xx > maxX) maxX = xx;
            }
          }
          var mid = maxX < 0 ? LW / 2 : (minX + maxX + 1) / 2;
          rows.push({ where: where || "menu", kind: k, pose: pose, dx: mid - LW / 2 });
        }
      }
      return rows;
    },
    tabIconsReady: function () { return uiReady("bar_", 5, 16); },
    resultsBoxes: function () { return resultLay; },
    sessionNote: function () { return sessionNote; },
    screenLayout: function () {
      var w: any[] = [];
      if (menuLay && menuLay.chip && menuLay.chip.w) w.push({ id: "chip", x: menuLay.chip.x, y: menuLay.chip.y, w: menuLay.chip.w, h: menuLay.chip.h });
      if (menuLay && menuLay.coins && menuLay.coins.w) w.push({ id: "coins", x: menuLay.coins.x, y: menuLay.coins.y, w: menuLay.coins.w, h: menuLay.coins.h });
      return { phase: phase, wallet: w, boxes: screenLay.slice() };
    },
    pauseLayout: function () { return pauseLay; },
    pixelize: function (img: any) {
      var cv = pixelizeImage(img);
      return cv ? cv.toDataURL("image/png") : "";
    },
    pause: function (on: boolean) { paused = !!on; manualPause = !!on; acc = 0; uiAcc = 0; lastT = -1; },
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
    auditReach: function (seed: number, toM: number, mapId?: string, lw?: number) {
      var prev = LW;
      if (lw) LW = lw;
      var w = createWorld(seed >>> 0, "solo", 4, makeLook(4, "base", "none"), mapId || "city");
      generateUntil(w, -toM * PX_PER_M);
      var byY: any = {};
      var ys: number[] = [];
      function add(y: number, p: any) {
        var k = String(y);
        if (!byY[k]) { byY[k] = []; ys.push(y); }
        byY[k].push(p);
      }
      add(0, { x: 8, w: (lw || prev) - 16, type: "normal" });
      for (var i = 0; i < w.platforms.length; i++) {
        var pl = w.platforms[i];
        if (pl.y === 0) continue;
        add(pl.y, pl);
      }
      ys.sort(function (a, b) { return b - a; });
      var fails = 0, example: any = null;
      for (var r = 1; r < ys.length; r++) {
        var gap = ys[r - 1] - ys[r];
        /* A moving row counts as a wall-to-wall stable span: it sweeps the whole width. */
        var sweep = function (list: any[]) {
          for (var q = 0; q < list.length; q++) if (list[q].type === "move") return [{ x: 2, w: (lw || prev) - 4, type: "move" }];
          return list.filter(function (p: any) { return isStableType(p.type); });
        };
        var prevS = sweep(byY[String(ys[r - 1])]);
        var curS = sweep(byY[String(ys[r])]);
        if (!prevS.length || !curS.length) { fails++; if (!example) example = { y: ys[r], gap: gap, why: "empty" }; continue; }
        var reach = horizReachPx(gap);
        for (var a = 0; a < prevS.length; a++) {
          var ok = false;
          for (var b = 0; b < curS.length; b++) if (edgeGap(prevS[a].x, prevS[a].w, curS[b].x, curS[b].w) <= reach + 0.5) ok = true;
          if (!ok) { fails++; if (!example) example = { y: ys[r], gap: gap, reach: reach }; }
        }
      }
      LW = prev;
      return { fails: fails, example: example, rows: ys.length };
    },
    /* Rows that hold a moving platform must hold nothing else (no static platform in its sweep). */
    auditMoveRows: function (seed: number, toM: number, mapId?: string) {
      var w = createWorld(seed >>> 0, "solo", 4, makeLook(4, "base", "none"), mapId || "city");
      generateUntil(w, -toM * PX_PER_M);
      var rows: any = {}, bad = 0, moves = 0;
      for (var i = 0; i < w.platforms.length; i++) { var pl = w.platforms[i]; (rows[pl.y] = rows[pl.y] || []).push(pl); }
      for (var k in rows) {
        var list = rows[k], hasMove = false;
        for (var j = 0; j < list.length; j++) if (list[j].type === "move") hasMove = true;
        if (hasMove) { moves++; if (list.length > 1) bad++; }
      }
      return { moves: moves, bad: bad };
    },
    mageProbe: function () {
      mode = "solo";
      save.char = 4;
      startRun(7, "city");
      var p = world.players[0];
      p.abCharge = CHARS[4].need;
      var y0 = p.y;
      tickWorld(world, { 0: { dir: 0, ab: true } });
      var y1 = p.y, n = p.teleN, tty = p.tty;
      for (var i = 0; i < 4; i++) tickWorld(world, { 0: { dir: 0 } });
      var y2 = p.y;
      return { y0: y0, y1: y1, y2: y2, n: n, tty: tty };
    },
    lobbyProbe: function (inset: number) {
      testInsetTop = inset || 0;
      phase = "net";
      NET.sub = "room";
      NET.st = "online";
      NET.you = 1;
      NET.room = { code: "1234", you: 1, host: 1, map: "city", players: [
        { pid: 1, slot: 0, name: "ROMAN", kind: 1, ready: true, on: true },
        { pid: 2, slot: 1, name: "АННА", kind: 0, ready: true, on: true },
        { pid: 3, slot: 2, name: "БОТ", kind: 2, ready: true, on: true, bot: true },
        { pid: 4, slot: 3, name: "МИРА", kind: 3, ready: false, on: true }
      ] };
      NET.session = { rounds: [{ round: 1 }, { round: 2 }, { round: 3 }, { round: 4 }, { round: 5 }], names: { 1: "ROMAN", 2: "АННА", 3: "БОТ", 4: "МИРА" }, wins: { 1: 2, 2: 1, 3: 1, 4: 1 }, best: { 1: 10, 2: 9, 3: 8, 4: 7 } };
      screenLay = [];
      hits = [];
      NET.draw(netApi);
      var boxes = screenLay.slice();
      testInsetTop = 0;
      return { lw: LW, lh: LH, boxes: boxes, evening: NET.eveningState || null };
    },
    eveningProbe: function (count: number) {
      testInsetTop = 0;
      phase = "net";
      NET.sub = "room";
      NET.st = "online";
      NET.you = 1;
      NET.evOff = 0;
      var players: any[] = [];
      var names: any = {};
      var wins: any = {};
      var best: any = {};
      var n = Math.max(1, Math.min(8, count || 1));
      for (var i = 1; i <= Math.min(4, n); i++) {
        players.push({ pid: i, slot: i - 1, name: "P" + i, kind: 0, ready: true, on: true });
      }
      for (var j = 1; j <= n; j++) { names[j] = "P" + j; wins[j] = n - j; best[j] = 100 - j; }
      NET.room = { code: "1234", you: 1, host: 1, map: "city", players: players };
      NET.session = {
        rounds: [{ round: 1 }, { round: 2 }, { round: 3 }, { round: 4 }, { round: 5 }],
        names: names, wins: wins, best: best,
      };
      var seen: any = {};
      var pages = 0;
      var state: any = null;
      while (pages < 8) {
        screenLay = [];
        hits = [];
        NET.draw(netApi);
        state = NET.eveningState;
        if (!state) break;
        for (var s = 0; s < state.fit; s++) seen[state.off + s] = 1;
        pages++;
        if (state.off + state.fit >= state.total) break;
        NET.evOff = state.off + state.fit;
      }
      var covered = 0;
      for (var k in seen) covered++;
      var boxes = screenLay.slice();
      testInsetTop = 0;
      return { round: state && state.round, title: state && state.title, total: state && state.total, covered: covered, pages: pages, boxes: boxes, lh: LH };
    },
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
