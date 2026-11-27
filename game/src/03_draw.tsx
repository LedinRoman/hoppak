
/* ---------------- Drawing: world ---------------- */
var SKY: any = {
  city: [[0, "#2a1868", "#622c9a", "#e66e9a"], [700, "#222c7c", "#4854ba", "#9c7ee6"], [1600, "#1e2678", "#3444aa", "#666ce0"], [3000, "#1a1860", "#3a2898", "#7a3ec8"]],
  jungle: [[0, "#185c74", "#2ca098", "#96e896"], [700, "#1e709e", "#38b4c8", "#a8f0c8"], [1600, "#205898", "#4290d8", "#92d4ff"], [3000, "#263888", "#5064c4", "#86a8f8"]],
  ice: [[0, "#2c68a8", "#58ace8", "#c4f2ff"], [700, "#2658a4", "#4ea2e6", "#b2e8ff"], [1600, "#264c9e", "#4e80d4", "#a8c8ff"], [3000, "#2c3c94", "#5a5ec4", "#b096f4"]],
  lava: [[0, "#5a1c36", "#b83a38", "#ff9648"], [700, "#642248", "#c84644", "#ffaa58"], [1600, "#562468", "#a83e68", "#f67c68"], [3000, "#482278", "#8e3a92", "#e8648c"]],
  aqua: [[0, "#126096", "#2098c8", "#68e6e8"], [700, "#16589c", "#268cd0", "#58d4f0"], [1600, "#204ea4", "#367ce0", "#68b8ff"], [3000, "#2a44a8", "#4e66e4", "#8a9eff"]],
  space: [[0, "#242078", "#4838b8", "#8264f4"], [700, "#1e2e8c", "#3a56d0", "#64a4f8"], [1600, "#2a2284", "#5a34be", "#a458e8"], [3000, "#24248a", "#4844c4", "#7888f8"]]
};
function skyAt(skin: string, m: number) {
  var ks = SKY[skin] || SKY.city;
  if (m <= ks[0][0]) return ks[0].slice(1);
  for (var i = 1; i < ks.length; i++) {
    if (m < ks[i][0]) {
      var t = (m - ks[i - 1][0]) / (ks[i][0] - ks[i - 1][0]);
      return [mixHex(ks[i - 1][1], ks[i][1], t), mixHex(ks[i - 1][2], ks[i][2], t), mixHex(ks[i - 1][3], ks[i][3], t)];
    }
  }
  return ks[ks.length - 1].slice(1);
}
function hash(n: number) { var x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }

function drawCloud(ctx: Ctx, x: number, y: number, s: number, col: string, hl: string, sh: string) {
  rect(ctx, x + 6 * s, y, 9 * s, 2 * s, col);
  rect(ctx, x + 2 * s, y + 2 * s, 19 * s, 2 * s, col);
  rect(ctx, x, y + 4 * s, 26 * s, 3 * s, col);
  rect(ctx, x + 7 * s, y, 5 * s, s, hl);
  rect(ctx, x + 3 * s, y + 2 * s, 4 * s, s, hl);
  rect(ctx, x + 2 * s, y + 7 * s, 22 * s, s, sh);
}
function drawBuildings(ctx: Ctx, baseY: number, seed: number, far: boolean, tick: number) {
  var x = viewX0() - 4, i = 0;
  while (x < LW + VIEW_PAD) {
    var bw = (far ? 10 : 14) + Math.floor(hash(seed + i) * (far ? 8 : 10));
    var bh = (far ? 22 : 30) + Math.floor(hash(seed + i * 3.1) * (far ? 30 : 34));
    var top = Math.round(baseY - bh);
    var col = far ? (i % 2 ? "#281e5c" : "#30246c") : (i % 2 ? "#1c1444" : "#221852");
    rect(ctx, x, top, bw, bh + 200, col);
    rect(ctx, x, top, bw, 1, far ? "#423484" : "#3a2c74");
    if (!far && hash(seed + i * 7) > 0.6) { rect(ctx, x + 3, top - 5, 1, 5, "#3a2c74"); if (Math.floor(tick / 30 + i) % 2) rect(ctx, x + 3, top - 6, 1, 1, C.red); }
    if (!far && hash(seed + i * 9) > 0.7) rect(ctx, x + bw - 7, top - 4, 5, 4, "#3a2c74");
    for (var wy = top + 3; wy < baseY - 2; wy += far ? 5 : 6) {
      for (var wx = x + 2; wx < x + bw - 2; wx += far ? 4 : 5) {
        var hv = hash(wx * 13.7 + wy * 7.3 + seed);
        if (hv > (far ? 0.7 : 0.58)) {
          var lit = far ? "#8a7ac8" : hv > 0.92 ? "#7ee0f8" : "#ffd060";
          if (!far && hv > 0.985 && Math.floor(tick / 40 + wx) % 3 === 0) lit = "#7a6a44";
          rect(ctx, wx, wy, far ? 1 : 2, far ? 1 : 2, lit);
        }
      }
    }
    x += bw + (far ? 1 : 2);
    i++;
  }
}
function drawPeaks(ctx: Ctx, baseY: number, seed: number, col: string, capCol: string, far: boolean) {
  var x = viewX0() - 8, i = 0;
  while (x < LW + VIEW_PAD + 8) {
    var w = (far ? 22 : 28) + Math.floor(hash(seed + i) * 14);
    var h = (far ? 26 : 36) + Math.floor(hash(seed + i * 2.3) * 26);
    for (var r = 0; r < h; r += 2) {
      var rw = Math.max(2, Math.round((w * (r + 2)) / h));
      rect(ctx, x + Math.floor((w - rw) / 2), baseY - h + r, rw, 2, r < h * 0.35 ? capCol : col);
    }
    rect(ctx, x, baseY, w, 120, col);
    x += w - 6;
    i++;
  }
}
function drawBg(ctx: Ctx, camY: number, tick: number, skin: string, menu?: boolean) {
  var map = mapInfo(skin).id;
  var alt = Math.max(0, -camY - (LH - 70));
  var m = alt / PX_PER_M;
  var sky = skyAt(map, m);
  var i, k;
  /* v1.0: smooth sky (no 24 dashed bands)
     so layers meet a continuous gradient. */
  var skyTop = Math.floor(viewY0() - VIEW_TOPPAD), skyBot = Math.ceil(viewY1()), skyH = skyBot - skyTop;
  /* One gradient fill: separate 1-px rows leave faint seams once the phone scale is fractional (anti-aliased edges). */
  var skyG = ctx.createLinearGradient(0, skyTop, 0, skyBot);
  skyG.addColorStop(0, sky[0]); skyG.addColorStop(0.5, sky[1]); skyG.addColorStop(1, sky[2]);
  ctx.fillStyle = skyG;
  ctx.fillRect(Math.floor(viewX0()) - 1, skyTop, Math.ceil(viewW()) + 2, skyH);
  /* v1.0 final layers: s(name, speed) = scroll at this height relative to the layer's shown height */
  var LS = function (name: string, speed: number) { var l = bgL(map, name); return l ? speed * (alt - l.m * PX_PER_M) : 0; };
  /* stars / plankton / embers */
  if (bgL(map, "stars")) {
    ctx.globalAlpha = clamp(0.55 + m / 2200, 0.55, 1);
    drawBgTile64(ctx, map, "stars", LS("stars", 0.065), LH, 0);
    ctx.globalAlpha = 1;
  } else if (map === "city" || map === "space" || map === "ice" || (map === "jungle" && m > 500)) {
    var starA = map === "space" ? 0.9 : clamp(0.55 + m / 2200, 0.55, 1);
    var nStars = map === "space" ? 68 : Math.round(lerp(28, 72, clamp(m / 2500, 0, 1)));
    for (i = 0; i < nStars; i++) {
      var sx = Math.floor(hash(i) * viewW()) + viewX0();
      var sy = mod(Math.floor(hash(i + 50) * (LH + 40)) + alt * (0.04 + hash(i + 90) * 0.05), LH + 40) - 20;
      if (map !== "space" && m < 300 && sy > LH * 0.65) continue;
      var tw = (Math.floor(tick / 14) + i) % 9 === 0;
      ctx.globalAlpha = starA * (tw ? 0.5 : 1);
      var scol = map === "space" && i % 5 === 0 ? "#88f4ff" : map === "space" && i % 7 === 0 ? "#ffa8f8" : "#fff6d8";
      rect(ctx, sx, sy, 1, 1, scol);
      if (i % 7 === 0 && !tw) { rect(ctx, sx - 1, sy, 3, 1, scol); rect(ctx, sx, sy - 1, 1, 3, scol); }
    }
    ctx.globalAlpha = 1;
  }
  /* sun / moon */
  if (bgL(map, "sun_moon")) {
    /* same height rule as before (README): moon 6 + alt*0.015, sun 14 + alt*0.01, never above 28 (70 in menus) */
    var smY = function (a: number) {
      var y = map === "city" || map === "space" ? Math.max(28, Math.round(6 + a * 0.015)) : Math.max(28, Math.round(14 + a * 0.01));
      return menu ? Math.max(70, y) : y;
    };
    var smA = map === "city" ? 1 - clamp((m - 1200) / 600, 0, 1) : 1;
    if (smA > 0) {
      ctx.globalAlpha = smA;
      drawBgObj64(ctx, map, "sun_moon", smY(alt) - smY(bgL(map, "sun_moon").m * PX_PER_M));
      ctx.globalAlpha = 1;
    }
  } else if (map === "city" || map === "space") {
    var moonA = map === "space" ? 0.95 : 1 - clamp((m - 1200) / 600, 0, 1);
    if (moonA > 0) {
      var mx = LW - 21, my = Math.max(28, Math.round(6 + alt * 0.015)); if (menu) my = Math.max(70, my);
      ctx.globalAlpha = moonA;
      var b64m = bg64(map);
      if (b64m) { drawBgSprite64(ctx, b64m, "moon", b64m.moon, mx, my); ctx.globalAlpha = 1; } else {
      var mc = map === "space" ? "#a8d8ff" : "#f8e4a8", md = map === "space" ? "#78a8e0" : "#e0c078";
      rect(ctx, mx + 3, my, 10, 16, mc); rect(ctx, mx, my + 3, 16, 10, mc); rect(ctx, mx + 1, my + 1, 14, 14, mc);
      rect(ctx, mx + 4, my + 4, 3, 3, md); rect(ctx, mx + 10, my + 8, 3, 2, md); rect(ctx, mx + 6, my + 11, 2, 2, md);
      rect(ctx, mx + 3, my + 2, 4, 1, "#ffffff");
      ctx.globalAlpha = 1;
      }
    }
  } else if (map === "jungle" || map === "lava") {
    var sunC = map === "lava" ? "#ffdc60" : "#fff4a8", sunR = map === "lava" ? "#ff9440" : "#ffd868";
    var sx0 = LW - 24, sy0 = Math.max(28, Math.round(14 + alt * 0.01)); if (menu) sy0 = Math.max(70, sy0);
    var b64s = bg64(map);
    if (b64s) drawBgSprite64(ctx, b64s, "sun", b64s.sun, 130, sy0 - 6) /* studio G2w 26x26, layer (130,64) at m=700 when sy0=70 */; else {
    ctx.globalAlpha = 0.25; rect(ctx, sx0 - 3, sy0 - 3, 22, 22, sunR); ctx.globalAlpha = 1;
    rect(ctx, sx0 + 3, sy0, 10, 16, sunC); rect(ctx, sx0, sy0 + 3, 16, 10, sunC); rect(ctx, sx0 + 1, sy0 + 1, 14, 14, sunC);
    }
  }
  /* aurora (city high & ice) */
  var aur = map === "ice" ? 0.85 : map === "city" ? band(m, 900, 1400, 3200, 4200) : 0;
  if (aur > 0 && bgL(map, "aurora")) {
    ctx.globalAlpha = map === "ice" ? 0.6 : 0.55 * aur;
    drawBgBand64(ctx, map, "aurora", 0);
    ctx.globalAlpha = 1;
  } else if (aur > 0) {
    var acs = map === "ice" ? ["#72ffdc", "#7cd8ff", "#f288ff"] : ["#6af8c0", "#6ed4ff", "#f080e8"];
    for (k = 0; k < 3; k++) {
      ctx.globalAlpha = 0.42 * aur;
      for (var ax = viewX0(); ax < LW + VIEW_PAD; ax += 2) {
        var ay = 46 + k * 16 + Math.sin(ax * 0.045 + tick * 0.012 + k * 1.7) * 9 + Math.sin(ax * 0.11 + k) * 3;
        rect(ctx, ax, ay, 2, 7 - k, acs[k]);
      }
    }
    ctx.globalAlpha = 1;
  }
  /* vibrant nebulae & planet (space always, city high) */
  var sp = map === "space" ? 1 : map === "city" ? clamp((m - 2000) / 800, 0, 1) : 0;
  if (sp > 0 && map === "space" && bgL(map, "nebulae")) {
    drawBgTile64(ctx, map, "nebulae", LS("nebulae", 0.03), LH + 120, 0);
    var plY = function (a: number) { return mod(70 + a * 0.02, LH + 80) - 40; };
    var plL = bgL(map, "planet");
    if (plL) {
      var pdy = plY(alt) - plY(plL.m * PX_PER_M);
      /* the cycle wraps at LH+80: keep the drawn box inside the old -40..LH+40 window */
      if (plL.y + pdy > LH + 40) pdy -= LH + 80;
      drawBgObj64(ctx, map, "planet", pdy);
    }
    drawBgTile64(ctx, map, "asteroids", LS("asteroids", 0.35), LH, tick * 0.06);
  } else if (sp > 0) {
    var nebs = [[32, 0.2, "#b44ee0"], [120, 0.7, "#3e8ce8"], [72, 1.3, "#e84ea0"]];
    for (k = 0; k < nebs.length; k++) {
      var nx = nebs[k][0] as number, ny = mod(Math.floor((nebs[k][1] as number) * 200) + alt * 0.03, LH + 120) - 60;
      ctx.globalAlpha = 0.42 * sp;
      for (var yy = -24; yy <= 24; yy += 2) for (var xx = -30; xx <= 30; xx += 2) {
        if ((xx * xx) / 900 + (yy * yy) / 576 < 1 - hash(xx * 3 + yy * 7 + k) * 0.45 && ((xx + yy) / 2) % 2 === 0) rect(ctx, nx + xx, ny + yy, 2, 2, nebs[k][2] as string);
      }
    }
    ctx.globalAlpha = sp;
    var py = map === "space" ? mod(70 + alt * 0.02, LH + 80) - 40 : Math.round(70 + (alt - 2300 * PX_PER_M) * 0.015);
    if (py > -40 && py < LH + 40) {
      var px0 = 34;
      for (var ry = -11; ry <= 11; ry++) {
        var hw = Math.floor(Math.sqrt(121 - ry * ry));
        rect(ctx, px0 - hw, py + ry, hw * 2 + 1, 1, ry < -4 ? "#ffb884" : ry < 3 ? "#e88a62" : "#b85a48");
      }
      rect(ctx, px0 - 20, py + 1, 41, 1, "#fff0b4"); rect(ctx, px0 - 17, py + 2, 35, 1, "#e0c88c"); rect(ctx, px0 - 14, py - 3, 6, 2, "#ffd09c");
    }
    for (k = 0; k < 6; k++) {
      var asx = mod(Math.floor(hash(k + 300) * LW) + tick * (0.05 + k * 0.01), LW + 10) - 5;
      var asy = mod(Math.floor(hash(k + 400) * LH) + alt * 0.35, LH + 20) - 10;
      rect(ctx, asx, asy, 4, 3, "#968cb4"); rect(ctx, asx + 1, asy - 1, 2, 1, "#bab0d8"); rect(ctx, asx + 1, asy + 1, 1, 1, "#6a6088");
    }
    ctx.globalAlpha = 1;
  }
  /* aqua sunbeams + bubbles + floating corals */
  if (map === "aqua" && bgL(map, "sunbeams")) {
    drawBgBand64(ctx, map, "sunbeams", 0); /* static; the PNG carries its own alpha */
    drawBgTile64(ctx, map, "bubbles", LS("bubbles", 0.25) - tick * 0.45, LH, 0);
  } else if (map === "aqua") {
    ctx.globalAlpha = 0.18;
    for (k = 0; k < 4; k++) {
      var bx = 18 + k * 38;
      for (var by = viewY0(); by < viewY1(); by += 8) rect(ctx, bx + Math.floor(by * 0.14), by, 10, 8, "#c8ffff");
    }
    ctx.globalAlpha = 0.65;
    for (k = 0; k < 16; k++) {
      var ux = mod(Math.floor(hash(k + 500) * LW) + Math.sin(tick * 0.05 + k) * 4, LW);
      var uy = mod(Math.floor(hash(k + 600) * LH) - tick * (0.35 + (k % 3) * 0.15) + alt * 0.25, LH);
      var sz = k % 4 === 0 ? 3 : 2;
      rect(ctx, ux, uy, sz, sz, "#a8f8ff");
      if (sz === 3) rect(ctx, ux, uy, 1, 1, "#ffffff");
    }
    ctx.globalAlpha = 1;
  }
  /* ice falling snowflakes */
  if (map === "ice" && bgL(map, "snow")) {
    ctx.globalAlpha = 0.8;
    drawBgTile64(ctx, map, "snow", LS("snow", 0.28) + tick * 0.4, LH, Math.sin(tick * 0.03) * 2);
    ctx.globalAlpha = 1;
  } else if (map === "ice") {
    ctx.globalAlpha = 0.8;
    for (k = 0; k < 24; k++) {
      var fx = mod(Math.floor(hash(k + 700) * LW) + Math.sin(tick * 0.03 + k) * 5, LW);
      var fy = mod(Math.floor(hash(k + 800) * LH) + tick * (0.3 + (k % 3) * 0.12) + alt * 0.28, LH);
      rect(ctx, fx, fy, k % 5 === 0 ? 2 : 1, k % 5 === 0 ? 2 : 1, "#ffffff");
    }
    ctx.globalAlpha = 1;
  }
  /* lava rising embers */
  if (map === "lava" && bgL(map, "embers")) {
    ctx.globalAlpha = 0.9;
    drawBgTile64(ctx, map, "embers", LS("embers", 0.3) - tick * 0.6, LH, Math.sin(tick * 0.04) * 2);
    ctx.globalAlpha = 1;
  } else if (map === "lava") {
    for (k = 0; k < 20; k++) {
      var ex = mod(Math.floor(hash(k + 900) * LW) + Math.sin(tick * 0.06 + k) * 6, LW);
      var ey = mod(Math.floor(hash(k + 950) * LH) - tick * (0.45 + (k % 3) * 0.15) + alt * 0.3, LH);
      rect(ctx, ex, ey, k % 3 === 0 ? 2 : 1, k % 3 === 0 ? 2 : 1, k % 2 ? "#ffd850" : "#ff6830");
    }
  }
  /* clouds (city, jungle, ice, lava) */
  if (map === "city" || map === "jungle" || map === "ice" || map === "lava") {
    var cl = map === "city" ? band(m, 120, 450, 1700, 2400) : 0.85;
    if (cl > 0 && bgL(map, "clouds_small")) {
      /* README: small 0.18 / cycle LH+60, big 0.42 / cycle LH+80; city keeps its 0.72 / 0.9 band alpha */
      ctx.globalAlpha = map === "city" ? 0.72 * cl : 1;
      drawBgTile64(ctx, map, "clouds_small", LS("clouds_small", 0.18), LH + 60, tick * 0.035);
      ctx.globalAlpha = map === "city" ? 0.9 * cl : 1;
      drawBgTile64(ctx, map, "clouds_big", LS("clouds_big", 0.42), LH + 80, -tick * 0.07);
      ctx.globalAlpha = 1;
    } else if (cl > 0) {
      ctx.globalAlpha = 0.72 * cl;
      var cf = mixHex(sky[2], "#ffffff", 0.35), ch = mixHex(sky[2], "#ffffff", 0.65), cs = mixHex(sky[1], "#201840", 0.18);
      for (k = 0; k < 7; k++) {
        var cx = mod(Math.floor(hash(k + 10) * 200) + tick * (k % 2 ? 0.04 : -0.03), LW + 60) - 30;
        var cy = mod(k * 61 + alt * 0.18, LH + 60) - 30;
        var b64c = bg64(map);
        if (b64c) { if (b64c.cloudAlpha) ctx.globalAlpha = b64c.cloudAlpha; drawBgSprite64(ctx, b64c, "cs" + (k % b64c.cs.length), b64c.cs[k % b64c.cs.length], cx, cy); }
        else drawCloud(ctx, cx, cy, 1, cf, ch, cs);
      }
      ctx.globalAlpha = 0.9 * cl;
      var nf = mixHex(sky[2], "#ffffff", 0.58), nh = "#ffffff", ns = mixHex(sky[2], "#201840", 0.12);
      for (k = 0; k < 4; k++) {
        var ncx = mod(Math.floor(hash(k + 20) * 220) + tick * (k % 2 ? 0.09 : -0.07), LW + 80) - 60;
        var ncy = mod(k * 109 + 40 + alt * 0.42, LH + 80) - 40;
        var b64n = bg64(map);
        if (b64n) { if (b64n.cloudAlpha) ctx.globalAlpha = b64n.cloudAlpha; drawBgSprite64(ctx, b64n, "cb" + (k % b64n.cb.length), b64n.cb[k % b64n.cb.length], ncx, ncy); }
        else drawCloud(ctx, ncx, ncy, 2, nf, nh, ns);
      }
      ctx.globalAlpha = 1;
    }
  }
  /* map horizon silhouettes */
  var farBase = LH - 64 + alt * 0.1;
  var nearBase = LH - 40 + alt * 0.3;
  var b64h = bg64(map);
  if (b64h) {
    /* v1.0 seam fix (code only): the three layers scroll at 0.1 / 0.3 / 1.0 of the climb, so a slower layer's
       bottom used to come apart from the faster one in front and its flat fill colour showed as a hard band.
       Keep them stacked: a layer is pushed down just enough that its bottom stays behind the solid part of
       the layer in front (floor -> near -> far). Parallax is unchanged while they overlap anyway. */
    /* final strips run from their top row to the layer bottom (346): top = layer top + parallax */
    var nearTop = b64h.nearY0 + alt * 0.3;
    var roofY0 = Math.round(-camY);
    /* pushes are capped at "bottom edge = screen bottom", so a layer is carried by the one in front only
       until it rests on the screen edge, then waits there for its own parallax; continuous at every step */
    var yBot = viewY1();
    if (b64h.floor) {
      var floorTop = roofY0 + 3 - b64h.floorRow;
      nearTop = Math.max(nearTop, Math.min(floorTop + stripSolidRow64(b64h, "floor") - b64h.nearH, yBot - b64h.nearH));
    }
    var farTop = Math.max(b64h.farY0 + alt * 0.1, Math.min(nearTop + stripSolidRow64(b64h, "near") - b64h.farH, yBot - b64h.farH));
    drawBgStrip64(ctx, b64h, "far", farTop);
    drawBgStrip64(ctx, b64h, "near", nearTop);
  } else if (map === "city") {
    if (farBase - 60 < LH) drawBuildings(ctx, farBase, 3, true, tick);
    if (nearBase - 70 < LH) drawBuildings(ctx, nearBase, 17, false, tick);
  } else if (map === "ice") {
    if (farBase - 60 < LH) drawPeaks(ctx, farBase, 31, "#5298d8", "#d8f8ff", true);
    if (nearBase - 70 < LH) drawPeaks(ctx, nearBase, 47, "#3a78b8", "#b8ecff", false);
  } else if (map === "lava") {
    if (farBase - 60 < LH) drawPeaks(ctx, farBase, 53, "#782644", "#ff7c3a", true);
    if (nearBase - 70 < LH) drawPeaks(ctx, nearBase, 61, "#4a1830", "#ff5628", false);
  } else if (map === "jungle") {
    if (farBase - 60 < LH) drawPeaks(ctx, farBase, 71, "#1e6868", "#48c088", true);
    if (nearBase - 70 < LH) drawPeaks(ctx, nearBase, 79, "#164e54", "#34a474", false);
  } else if (map === "aqua") {
    if (farBase - 60 < LH) drawPeaks(ctx, farBase, 83, "#14548a", "#2684b4", true);
    if (nearBase - 70 < LH) drawPeaks(ctx, nearBase, 89, "#0f4270", "#1e6c9e", false);
  } else if (map === "space") {
    if (farBase - 60 < LH) drawPeaks(ctx, farBase, 97, "#32288a", "#6858d4", true);
    if (nearBase - 70 < LH) drawPeaks(ctx, nearBase, 101, "#241c68", "#5040b4", false);
  }
  /* start floor */
  var roofY = Math.round(-camY);
  if (roofY < viewY1() && roofY > viewY0() - 40) {
    var b64f = bg64(map);
    if (b64f) {
      drawBgStrip64(ctx, b64f, "floor", roofY + 3 - b64f.floorRow);
    } else if (map === "jungle") {
      rect(ctx, viewX0(), roofY + 3, viewW(), LH, "#2a4e36"); rect(ctx, viewX0(), roofY + 3, viewW(), 2, "#62d458");
      for (var tx = 6; tx < LW; tx += 22) { rect(ctx, tx, roofY + 8, 12, 8, "#3a6848"); rect(ctx, tx + 2, roofY + 10, 4, 2, "#80e870"); }
    } else if (map === "ice") {
      rect(ctx, viewX0(), roofY + 3, viewW(), LH, "#6eb8e8"); rect(ctx, viewX0(), roofY + 3, viewW(), 3, "#e8fbff");
      for (tx = 8; tx < LW; tx += 18) rect(ctx, tx, roofY + 10, 8, 4, "#9cd8fa");
    } else if (map === "lava") {
      rect(ctx, viewX0(), roofY + 3, viewW(), LH, "#3a202c"); rect(ctx, viewX0(), roofY + 3, viewW(), 2, "#ff7c30");
      for (tx = 10; tx < LW; tx += 26) rect(ctx, tx, roofY + 11, 10, 2, "#ff5820");
    } else if (map === "aqua") {
      rect(ctx, viewX0(), roofY + 3, viewW(), LH, "#d8b46c"); rect(ctx, viewX0(), roofY + 3, viewW(), 2, "#ffe49c");
      for (tx = 10; tx < LW; tx += 28) { rect(ctx, tx, roofY - 4, 2, 7, "#ff70a0"); rect(ctx, tx - 2, roofY - 2, 2, 3, "#ff70a0"); rect(ctx, tx + 8, roofY - 5, 2, 8, "#48e090"); }
    } else if (map === "space") {
      rect(ctx, viewX0(), roofY + 3, viewW(), LH, "#343264"); rect(ctx, viewX0(), roofY + 3, viewW(), 2, "#78f0ff");
      for (tx = 12; tx < LW; tx += 24) rect(ctx, tx, roofY + 10, 8, 3, "#6058a4");
    } else {
      rect(ctx, viewX0(), roofY + 3, viewW(), LH, C.brick);
      for (var ty = roofY + 7; ty < LH; ty += 6) for (tx = viewX0(); tx < LW + VIEW_PAD; tx += 8) rect(ctx, tx + (((ty - roofY) / 6) % 2 ? 4 : 0), ty, 3, 1, C.brickL);
      rect(ctx, viewX0(), roofY + 3, viewW(), 2, C.roof);
      rect(ctx, 6, roofY + 12, 18, 10, "#342a52"); rect(ctx, 8, roofY + 14, 14, 1, "#706498"); rect(ctx, 8, roofY + 17, 14, 1, "#706498");
      rect(ctx, 132, roofY + 10, 2, 16, "#706498"); rect(ctx, 127, roofY + 10, 12, 1, "#706498");
    }
  }
}

var MAP_PLAT: any = {
  city: { n: "#c48448", nD: "#8a5a28", nL: "#e0a868", edge: "#5ee0d0" },
  jungle: { n: "#4ca848", nD: "#286830", nL: "#82dc6a", edge: "#b8ff70" },
  ice: { n: "#6ec4f0", nD: "#3884b8", nL: "#a8e6ff", edge: "#ffffff" },
  lava: { n: "#584858", nD: "#322834", nL: "#826c7e", edge: "#ff8c38" },
  aqua: { n: "#f07898", nD: "#a84468", nL: "#ffa8c0", edge: "#78fff0" },
  space: { n: "#6468b4", nD: "#3c4080", nL: "#98a0e8", edge: "#6ef4ff" }
};
function drawPlatform(ctx: Ctx, p: any, cam: number, mapId?: string, tick?: number) {
  var map = mapInfo(mapId || "city").id;
  var tk = tick || 0;
  var x = Math.round(p.x), y = Math.round(p.y - cam), w = p.w;
  if (y < -16 || y > LH + 12) return;
  if (p.type === "cloud") {
    if (p.broken) return;
    ctx.globalAlpha = p.lifeT < 60 && (p.lifeT >> 3) % 2 ? 0.5 : 1;
    if (drawPlat64(ctx, p, x, y, w, map, 0)) { ctx.globalAlpha = 1; return; }
    rect(ctx, x + 2, y - 2, w - 4, 6, INK); rect(ctx, x, y, w, 4, INK);
    rect(ctx, x + 3, y - 1, w - 6, 4, "#ffffff"); rect(ctx, x + 1, y + 1, w - 2, 2, "#ffffff");
    rect(ctx, x + 6, y - 3, 6, 2, "#ffffff"); rect(ctx, x + w - 13, y - 3, 7, 2, "#ffffff");
    rect(ctx, x + 1, y + 3, w - 2, 1, "#a8c8f0");
    ctx.globalAlpha = 1;
    return;
  }
  if (p.restoreT > 0) {
    var u = 1 - p.restoreT / 16;
    var gap = Math.round((1 - u) * 8);
    var mid = Math.floor(w / 2);
    ctx.globalAlpha = 0.45 + 0.55 * u;
    rect(ctx, x - gap, y, Math.max(2, mid - 1), 5, C.brk);
    rect(ctx, x + mid + 1 + gap, y, Math.max(2, w - mid - 1), 5, C.brkD);
    rect(ctx, x - gap, y, Math.max(2, mid - 1), 1, C.brkRim);
    rect(ctx, x + mid + 1 + gap, y, Math.max(2, w - mid - 1), 1, C.brkRim);
    ctx.globalAlpha = 1;
    return;
  }
  if (p.broken) {
    if (p.type === "bubble" && p.respawnT > 0) {
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = "#88f8ff";
      for (var bx = 2; bx < w - 2; bx += 5) ctx.fillRect(x + bx, y + 2, 2, 1);
      ctx.globalAlpha = 1;
      return;
    }
    if (p.breakT > 0) {
      var f = 14 - p.breakT;
      ctx.globalAlpha = p.breakT / 14;
      var bc = p.type === "lava" ? "#ff7828" : C.brk;
      var bcd = p.type === "lava" ? "#8a2810" : C.brkD;
      rect(ctx, x - f, y + f * 1.5, Math.floor(w / 2) - 1, 4, bc);
      rect(ctx, x + Math.ceil(w / 2) + 1 + f, y + f * 1.8, Math.floor(w / 2) - 1, 4, bcd);
      ctx.globalAlpha = 1;
    }
    return;
  }
  if (drawPlat64(ctx, p, x, y, w, map, p.type === "bounce" && p.springT > 0 ? 1 : 0)) {
    if (p.spring && drawSpring64(ctx, p, x, y, w)) return;
  } else {
  if (p.type !== "break") rect(ctx, x + 1, y + 6, w - 1, 1, "rgba(0,0,0,0.28)");
  var i;
  if (p.type === "break") {
    rect(ctx, x, y, w, 5, C.brk); rect(ctx, x, y + 4, w, 2, C.brkD);
    ctx.fillStyle = C.brkRim;
    for (i = 0; i < w; i += 4) ctx.fillRect(x + i, y, 2, 1);
    rect(ctx, x, y + 1, 1, 4, C.brkRim); rect(ctx, x + w - 1, y + 1, 1, 4, C.brkRim);
    ctx.fillStyle = C.brkD;
    var c1 = x + Math.floor(w * 0.3);
    ctx.fillRect(c1, y + 1, 1, 4); ctx.fillRect(c1 + 1, y + 3, 2, 1);
    ctx.fillRect(x + Math.floor(w * 0.68), y + 1, 1, 5); ctx.fillRect(x + Math.floor(w * 0.5), y + 2, 3, 1);
    rect(ctx, x + Math.floor(w / 2) - 1, y + 2, 2, 3, "#120a2c");
  } else if (p.type === "move") {
    rect(ctx, x, y, w, 5, C.mov); rect(ctx, x, y + 4, w, 2, C.movD);
    rect(ctx, x, y, w, 1, C.gold); rect(ctx, x, y + 1, 1, 4, C.gold); rect(ctx, x + w - 1, y + 1, 1, 4, C.gold);
    rect(ctx, x + 2, y + 2, 1, 1, "#9ad0f0"); rect(ctx, x + w - 3, y + 2, 1, 1, "#9ad0f0");
    var dr = p.vx >= 0 ? 1 : -1, cx = dr > 0 ? x + w - 10 : x + 4;
    ctx.fillStyle = C.gold;
    for (i = 0; i < 2; i++) {
      var bx2 = cx + i * 3;
      ctx.fillRect(bx2, y + 2, 2, 1); ctx.fillRect(bx2 + dr, y + 1, 1, 1); ctx.fillRect(bx2 + dr, y + 3, 1, 1);
    }
  } else if (p.type === "bounce") {
    /* Jungle bouncy mushroom-vine pad */
    var dy = p.springT > 0 ? 1 : 0;
    rect(ctx, x, y + dy, w, 5, "#6ad850"); rect(ctx, x, y + 4 + dy, w, 2, "#2a7838");
    rect(ctx, x + 1, y - 1 + dy, w - 2, 2, "#ff6848");
    rect(ctx, x + 2, y - 2 + dy, w - 4, 1, "#ffa858");
    for (i = 3; i < w - 3; i += 6) rect(ctx, x + i, y - 1 + dy, 2, 1, "#fff6d0");
  } else if (p.type === "ice") {
    /* Glacier slippery ice block */
    rect(ctx, x, y, w, 5, "#8ef4ff"); rect(ctx, x, y + 4, w, 2, "#46a8dc");
    rect(ctx, x, y, w, 1, "#ffffff");
    for (i = 3; i < w - 4; i += 8) { rect(ctx, x + i, y + 1, 3, 1, "#ffffff"); rect(ctx, x + i + 1, y + 2, 2, 1, "#d8ffff"); }
  } else if (p.type === "lava") {
    /* Volcano hot crumbling magma ledge */
    var pulse = Math.floor(tk / 8) % 2;
    rect(ctx, x, y, w, 5, "#422430"); rect(ctx, x, y + 4, w, 2, "#28141c");
    rect(ctx, x, y, w, 1, pulse ? "#ffdc58" : "#ff9030");
    for (i = 4; i < w - 4; i += 6) rect(ctx, x + i, y + 2, 3, 2, pulse ? "#ff7828" : "#ffc040");
  } else if (p.type === "bubble") {
    /* Ocean giant bubble cluster */
    rect(ctx, x + 1, y, w - 2, 5, "#56e4ff"); rect(ctx, x, y + 1, w, 3, "#7ef4ff");
    rect(ctx, x + 2, y + 4, w - 4, 2, "#2aa8d8");
    for (i = 3; i < w - 3; i += 6) rect(ctx, x + i, y + 1, 2, 1, "#ffffff");
  } else if (p.type === "grav") {
    /* Space anti-gravity neon pad */
    rect(ctx, x, y, w, 5, "#7848dc"); rect(ctx, x, y + 4, w, 2, "#482898");
    rect(ctx, x, y, w, 1, "#80ffe0");
    var up = Math.floor(tk / 6) % 2;
    for (i = 4; i < w - 4; i += 7) rect(ctx, x + i, y + 2 - up, 2, 1, "#ffd0ff");
  } else {
    var th = MAP_PLAT[map] || MAP_PLAT.city;
    rect(ctx, x, y, w, 5, th.n); rect(ctx, x, y + 4, w, 2, th.nD);
    rect(ctx, x + 1, y + 1, w - 2, 1, th.nL);
    rect(ctx, x, y, w, 1, th.edge);
    rect(ctx, x, y + 1, 1, 4, th.nD); rect(ctx, x + w - 1, y + 1, 1, 4, th.nD);
    ctx.fillStyle = th.nD;
    for (i = 5; i < w - 4; i += 7) ctx.fillRect(x + i, y + 3, 3, 1);
    rect(ctx, x + 2, y + 2, 1, 1, "#ffffff"); rect(ctx, x + w - 3, y + 2, 1, 1, "#ffffff");
  }
  }
  if (p.spring) {
    var sx = x + Math.floor(w / 2) - 3, h = p.springT > 0 ? 3 : 6;
    rect(ctx, sx, y - 1, 6, 1, C.springD);
    for (i = 2; i <= h; i++) rect(ctx, sx + (i % 2), y - i, 5, 1, i % 2 ? C.spring : C.springD);
    rect(ctx, sx - 1, y - h - 1, 8, 1, C.coral);
    rect(ctx, sx, y - h - 2, 6, 1, "#ff8a80");
  }
}
function drawTrack(ctx: Ctx, p: any, cam: number) {
  /* v0.58: no track line under moving platforms (Roman, prod feedback). */
}

var MOBPAL: any = {
  blob: ["#547dcb", "#263568", "#85a2da"], magma: ["#ff7828", "#b02818", "#ffe060"], penguin: ["#2a3048", "#f6f6ff", "#ffa030"],
  crab: ["#ff5a48", "#a82420", "#ffa898"], alien: ["#9af068", "#3a9a48", "#e0ffd0"], frog: ["#58d848", "#2a8a30", "#ffe060"],
  monkey: ["#a86a38", "#6a3a18", "#f0c890"], spitter: ["#ff6030", "#8a2010", "#ffe060"], bat: ["#8a5ad0", "#5a3aa0", "#ff5a62"],
  parrot: ["#ff4848", "#2aa8ff", "#ffd840"], owl: ["#e8f4ff", "#8ab0d8", "#ffd040"], firebat: ["#ff4848", "#881828", "#ffd040"],
  ray: ["#ffa040", "#c05a20", "#ffe0a0"], bob: ["#7ae0f0", "#3a9ab8", "#e0fcff"], ember: ["#ffb838", "#e04818", "#fff098"],
  snake: ["#5ac838", "#2a7a28", "#ffe048"], puffer: ["#ffd848", "#c89018", "#ffffff"], hole: ["#b050ff", "#ff70d0", "#4a1a7a"],
  whirl: ["#58f0ff", "#ffffff", "#1868a8"], wind: ["#ffffff", "#c8ecff", "#88c8f0"], ufo: ["#7ac8f0", "#c8d0d8", "#7a8090"],
  frost: ["#c8f8ff", "#58b8f0", "#ffffff"], comet: ["#ffd060", "#ff7830", "#fff8d0"]
};
/* v0.59 mob sprite swap point. To drop in Design's fish: set src to a data-URI PNG strip of `n` frames, each fw×fh,
   facing RIGHT, frames left-to-right (flap 0,1,2 = the same 6-tick cycle as the procedural ray). The frame's (ox,oy)
   offset places it relative to the mob's hitbox top-left (MOBS.ray: 16×8). Hitbox and sim never read this. */
var MOB_SPRITES: any = {
  ray: { src: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEgAAAAMCAYAAADBJPs9AAABSklEQVR4nGNggAIRHpn/yDQyEOGR+b/BQ+L/Bg+J/9jkqQFgdtDKfIoAcgDgcqQIjwxNHU/rgCE3AlhEeGT+z7H5g9XAMyk8cP6FGx8YHGZsYDiQEfDfQEMARa182wEGUTEThjdfnjAScuQcmz8MKUdYGBgYGBgwzT/x/0BGAAO55hMCATtekKyf5c2XJ4wpR7AHEjEA5vgzKTwMJnNk/mPzBCISSLeDGPPR7aFmBLAwMDAwvPnyhDFgB7JHIEBAQwGh8sYF7OIEAK4USi3zUe2gfgSwIHNgAQWzlBgLHlY5MNzp0WFQKbmCNQYoTaGEzKd1BOBNrkSbwsBAVPmAngWoZT56IMHMv9OjAxc7sOECrAxlcAgwgIt/uPGAQUBDAWcEkFXowRxETqFHivkpR1iILphhEUpsBKCro7QCGFZgULa1RsEoGJkAAJpO3YuHkGJqAAAAAElFTkSuQmCC", fw: 24, fh: 12, n: 3, ox: -4, oy: -2 }
,
  /* v1.0 city slime (Advisor, approved): 8 cells 64×64, 1 art px = 0.5 game px, no stretch.
     Anchor: bottom-centre of the cell on the 12×8 hitbox bottom-centre (ox=-10, oy=-24).
     Frames 0-3 walk, 4 alert1, 5 alert2, 6 squish1, 7 squish2. Hitbox unchanged. */
  blob: { src: "data:image/png;base64,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", fw: 64, fh: 64, n: 8, ox: -10, oy: -24, scale: 0.5 },
  /* v1.0 city bat (also jungle from 1400 m): 4 cells 64×64, scale 0.5.
     Order fly1, base, fly2, hit. Anchor: eye centre (31.5, 31.5) on the 14×10 hitbox centre.
     Hitbox and behaviour unchanged; eyes are in the sprite. */
  bat: { src: "data:image/png;base64,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", fw: 64, fh: 64, n: 4, ox: -8.75, oy: -10.75, scale: 0.5 },
  /* v1.0 city UFO: 4 cells 64×64, scale 0.5. Order base, idle2, shoot, hit.
     Anchor: hull centre (31.5, 31) on the 14×8 hitbox centre. Hitbox/behaviour unchanged. */
  ufo: { src: "data:image/png;base64,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", fw: 64, fh: 64, n: 4, ox: -8.75, oy: -11.5, scale: 0.5 }
,
  /* v1.0 city black hole v3 (also used in space): 8 cells 64×64, scale 0.5, no stretch.
     Order 0°…315° clockwise (hole_base, spin2–spin8). Anchor: core centre (31.5, 31.5)
     on the 14×14 hitbox centre (ox=oy=-8.75). 80 ms/frame = 4 ticks at 50 Hz. Loop.
     Particle aura is baked in; procedural orbit dots are not drawn. Hitbox/behaviour unchanged. */
  hole: { src: "data:image/png;base64,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", fw: 64, fh: 64, n: 8, ox: -8.75, oy: -8.75, scale: 0.5 }
};
var mobSprCache: any = {};
function drawMobSprite(ctx: Ctx, kind: string, x: number, y: number, frame: number, flip: boolean) {
  var m = MOB_SPRITES[kind];
  if (!m || !m.src) return false;
  var cv = mobSprCache[kind];
  if (cv === undefined) { cv = mobSprCache[kind] = pngToCanvas(m.src) || null; }
  if (!cv) return false;
  var f = Math.max(0, Math.min(m.n - 1, frame | 0));
  var sc = m.scale != null ? m.scale : 1;
  var dw = m.fw * sc, dh = m.fh * sc, dx = x + (m.ox || 0), dy = y + (m.oy || 0);
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  if (flip) {
    /* 64-px sheets flip about the sprite's own centre. The ray keeps its original pivot (hitbox 16 + ox). */
    if (sc !== 1) { ctx.translate(dx + dw, dy); ctx.scale(-1, 1); ctx.drawImage(cv, f * m.fw, 0, m.fw, m.fh, 0, 0, dw, dh); }
    else { ctx.translate(x + 16 - m.ox, y + m.oy); ctx.scale(-1, 1); ctx.drawImage(cv, f * m.fw, 0, m.fw, m.fh, 0, 0, m.fw, m.fh); }
  } else ctx.drawImage(cv, f * m.fw, 0, m.fw, m.fh, dx, dy, dw, dh);
  ctx.restore();
  return true;
}
function blobFrame(m: any) {
  /* 50 Hz ticks. Walk 150 ms/frame; slimeAlert → alert1; warnT flash → alert2;
     death: squish1 then squish2 held until despawn (sim squish 10 ticks, unchanged). */
  if (!m.alive) return m.squish > 3 ? 6 : 7;
  if (m.warnT > 0) return 5;
  if (slimeAlert(m)) return 4;
  return Math.floor((m.t || 0) * 2 / 15) % 4;
}
function batFrame(m: any) {
  /* fl=floor(t/6)%3: 0 fly1, 1 base, 2 fly2; hit on death. Hitbox 14×10 unchanged. */
  if (!m.alive) return 3;
  return Math.floor((m.t || 0) / 6) % 3;
}
function ufoFrame(m: any) {
  /* idle2 swaps hull lights instead of the old t/8 blink; shoot while shootT<18; hit on death.
     Hitbox 14×8 unchanged. */
  if (!m.alive) return 3;
  if ((m.shootT || 99) < 18) return 2;
  return Math.floor((m.t || 0) / 8) % 2;
}
function holeFrame(m: any) {
  /* 80 ms/frame at the game's 50 Hz tick = 4 ticks; 8-frame clockwise loop. Hitbox 14×14 unchanged. */
  return Math.floor((m.t || 0) / 4) % 8;
}
function eyes(ctx: Ctx, x: number, y: number, gap: number, look: number) {
  rect(ctx, x, y, 2, 2, "#fff6e8"); rect(ctx, x + gap, y, 2, 2, "#fff6e8");
  rect(ctx, x + look, y + 1, 1, 1, INK); rect(ctx, x + gap + look, y + 1, 1, 1, INK);
}
function drawMob(ctx: Ctx, m: any, cam: number, mapId?: string, frozen?: boolean) {
  var map = mapInfo(mapId || "city").id;
  var pal = MOBPAL[m.kind] || MOBPAL.blob;
  if (m.kind === "bob" && map === "aqua") pal = ["#ff6ec8", "#b83088", "#ffc8ec"];
  var x = Math.round(m.x), y = Math.round(m.y - cam), t = Math.floor(m.t);
  if (y < -60 || y > LH + 40) return;
  if (!m.alive) {
    if (m.squish <= 0) return;
    if (m.kind === "blob" && drawMobSprite(ctx, "blob", x, y, blobFrame(m), (m.vx || 0) < 0)) return;
    if (m.kind === "bat" && drawMobSprite(ctx, "bat", x, y, batFrame(m), (m.vx || 0) < 0)) return;
    if (m.kind === "ufo" && drawMobSprite(ctx, "ufo", x, y, ufoFrame(m), (m.vx || 0) < 0)) return;
    if (m.kind === "hole" && drawMobSprite(ctx, "hole", x, y, holeFrame(m), false)) return;
    ctx.globalAlpha = m.squish / 10;
    rect(ctx, x, y + m.h - 3, m.w, 3, pal[1]);
    ctx.globalAlpha = 1;
    return;
  }
  var k: number, b = m.b, lk = m.vx > 0 ? 1 : 0, wb = Math.floor(t / 12) % 2;
  if (m.kind === "blob" && drawMobSprite(ctx, "blob", x, y, blobFrame(m), (m.vx || 0) < 0)) {
    /* v1.0 64-px city slime: eyes are in the sprite, no procedural overlay. Hitbox 12×8 unchanged. */
    return;
  }
  if (m.kind === "bat" && drawMobSprite(ctx, "bat", x, y, batFrame(m), (m.vx || 0) < 0)) return;
  if (m.kind === "ufo" && drawMobSprite(ctx, "ufo", x, y, ufoFrame(m), (m.vx || 0) < 0)) return;
  if (m.kind === "hole" && drawMobSprite(ctx, "hole", x, y, holeFrame(m), false)) return;
  if ((m.kind === "blob" || m.kind === "magma" || m.kind === "alien" || m.kind === "crab") && slimeAlert(m)) {
    drawWalkerAlert(ctx, m, x, y, pal, t);
  } else if (m.kind === "blob" || m.kind === "magma" || m.kind === "alien" || m.kind === "crab") {
    rect(ctx, x + 2, y - 1 + wb, 8, 1, INK); rect(ctx, x - 1, y + 3, 14, 5, INK); rect(ctx, x, y + 1 + wb, 12, 3, INK);
    rect(ctx, x + 3, y + wb, 6, 1, pal[0]); rect(ctx, x + 1, y + 1 + wb, 10, 2, pal[0]); rect(ctx, x, y + 3, 12, 4, pal[0]);
    rect(ctx, x, y + 7, 12, 1, pal[1]); rect(ctx, x + 3, y + 1 + wb, 2, 1, pal[2]);
    eyes(ctx, x + 3, y + 3, 4, lk);
    if (m.kind === "crab") { rect(ctx, x - 3, y + 1 + wb, 3, 3, INK); rect(ctx, x - 2, y + 2 + wb, 2, 1, pal[0]); rect(ctx, x + 12, y + 1 + wb, 3, 3, INK); rect(ctx, x + 12, y + 2 + wb, 2, 1, pal[0]); for (k = 0; k < 3; k++) rect(ctx, x + 2 + k * 4, y + 8, 1, 1, pal[1]); }
    if (m.kind === "alien") { rect(ctx, x + 5, y - 4 + wb, 1, 4, INK); rect(ctx, x + 4, y - 5 + wb, 3, 2, "#ff5ab0"); rect(ctx, x + 5, y + 1 + wb, 2, 2, "#fff6e8"); rect(ctx, x + 5 + lk, y + 2 + wb, 1, 1, INK); }
    if (m.kind === "magma" && t % 20 < 10) rect(ctx, x + 4 + (t % 3), y + 8, 1, 2, pal[2]);
    rect(ctx, x + 5, y + 6, 2, 1, pal[1]);
    if ((m.kind === "blob" || m.kind === "magma") && m.warnT > 0 && ((t >> 2) % 2)) {
      ctx.globalAlpha = 0.75;
      rect(ctx, x, y + wb, 12, 8, pal[2]);
      ctx.globalAlpha = 1;
    }
  } else if (m.kind === "penguin") {
    var wd = Math.floor(t / 8) % 2;
    rect(ctx, x - 1, y - 1, 12, 13, INK);
    rect(ctx, x, y, 10, 11, pal[0]); rect(ctx, x + 2, y + 3, 6, 7, pal[1]);
    eyes(ctx, x + 2, y + 1, 4, lk); rect(ctx, x + 4, y + 3, 2, 1, pal[2]);
    rect(ctx, x + (wd ? 1 : 2), y + 11, 3, 1, pal[2]); rect(ctx, x + (wd ? 6 : 5), y + 11, 3, 1, pal[2]);
    rect(ctx, x - 1 - wd, y + 4, 1, 4, pal[0]); rect(ctx, x + 10 + wd, y + 4, 1, 4, pal[0]);
  } else if (m.kind === "frog") {
    var air = m.hy < 0;
    rect(ctx, x - 1, y + 1, 14, 7, INK); rect(ctx, x + 1, y - 2, 4, 4, INK); rect(ctx, x + 7, y - 2, 4, 4, INK);
    rect(ctx, x, y + 2, 12, 5, pal[0]); rect(ctx, x + 1, y + 6, 10, 1, pal[1]); rect(ctx, x + 3, y + 4, 6, 2, pal[2]);
    rect(ctx, x + 2, y - 1, 2, 2, "#fff6e8"); rect(ctx, x + 8, y - 1, 2, 2, "#fff6e8"); rect(ctx, x + 2 + lk, y, 1, 1, INK); rect(ctx, x + 8 + lk, y, 1, 1, INK);
    rect(ctx, x + 4, y + 3, 4, 1, "#c03040");
    if (air) { rect(ctx, x - 1, y + 7, 2, 3, pal[1]); rect(ctx, x + 11, y + 7, 2, 3, pal[1]); }
    else { rect(ctx, x - 2, y + 6, 3, 2, pal[1]); rect(ctx, x + 11, y + 6, 3, 2, pal[1]); }
  } else if (m.kind === "monkey") {
    var arm = m.fx > 0;
    rect(ctx, x - 1, y - 1, 14, 12, INK);
    rect(ctx, x + 1, y, 10, 10, pal[0]); rect(ctx, x - 1, y + 2, 2, 3, pal[0]); rect(ctx, x + 11, y + 2, 2, 3, pal[0]);
    rect(ctx, x + 3, y + 3, 6, 5, pal[2]); eyes(ctx, x + 3, y + 2, 4, lk); rect(ctx, x + 5, y + 6, 2, 1, pal[1]);
    if (arm) { rect(ctx, x + 10, y - 5, 2, 5, pal[0]); rect(ctx, x + 9, y - 8, 4, 3, "#6a4020"); }
    else { rect(ctx, x + 11, y + 6, 3, 3, "#6a4020"); }
    rect(ctx, x + 1, y + 10, 3, 1, pal[1]); rect(ctx, x + 8, y + 10, 3, 1, pal[1]);
  } else if (m.kind === "spitter") {
    var open = m.fx > 0 || m.shootT < 20;
    rect(ctx, x - 1, y + 2, 14, 9, INK);
    rect(ctx, x, y + 3, 12, 7, pal[1]); rect(ctx, x + 2, y + 1, 8, 3, INK); rect(ctx, x + 3, y + 2, 6, 2, open ? pal[2] : pal[0]);
    rect(ctx, x + 1, y + 5, 10, 2, pal[0]); eyes(ctx, x + 2, y + 6, 6, lk);
    if (open) { ctx.globalAlpha = 0.6; rect(ctx, x + 4, y - 3, 4, 4, "#ffd040"); ctx.globalAlpha = 1; }
  } else if (b === "fly") {
    var fl = Math.floor(t / 6) % 3;
    if (m.kind === "ray" && drawMobSprite(ctx, "ray", x, y, fl, m.vx < 0)) {
      /* v0.59: Design sprite (MOB_SPRITES.ray) replaces the procedural ray; hitbox (MOBS.ray 16×8) unchanged. */
    } else if (m.kind === "ray") {
      /* Fallback if the Design sprite fails to decode; coral-orange so it still stands out from the ocean. */
      var up = fl === 0 ? -1 : fl === 2 ? 1 : 0;
      rect(ctx, x + 2, y + 2 + up, 12, 4, INK); rect(ctx, x - 1, y + 3 + up * 2, 18, 2, INK);
      rect(ctx, x + 3, y + 3 + up, 10, 2, pal[0]); rect(ctx, x, y + 3 + up * 2, 4, 1, pal[0]); rect(ctx, x + 12, y + 3 + up * 2, 4, 1, pal[0]);
      rect(ctx, x + 5, y + 2 + up, 1, 1, "#fff6e8"); rect(ctx, x + 10, y + 2 + up, 1, 1, "#fff6e8");
      rect(ctx, m.vx > 0 ? x - 4 : x + 16, y + 4, 4, 1, pal[1]);
    } else {
      rect(ctx, x + 4, y + 2, 6, 7, INK);
      rect(ctx, x + 5, y + 3, 4, 5, pal[0]); rect(ctx, x + 5, y + 2, 1, 1, pal[0]); rect(ctx, x + 8, y + 2, 1, 1, pal[0]);
      var wc = m.kind === "parrot" ? pal[1] : m.kind === "owl" ? pal[1] : pal[1];
      if (fl === 0) { rect(ctx, x, y + 1, 5, 2, wc); rect(ctx, x + 9, y + 1, 5, 2, wc); rect(ctx, x, y, 2, 1, wc); rect(ctx, x + 12, y, 2, 1, wc); }
      else if (fl === 1) { rect(ctx, x, y + 4, 5, 2, wc); rect(ctx, x + 9, y + 4, 5, 2, wc); }
      else { rect(ctx, x + 1, y + 6, 4, 2, wc); rect(ctx, x + 9, y + 6, 4, 2, wc); rect(ctx, x, y + 8, 2, 1, wc); rect(ctx, x + 12, y + 8, 2, 1, wc); }
      if (m.kind === "owl") { rect(ctx, x + 5, y + 3, 2, 2, pal[2]); rect(ctx, x + 7, y + 3, 2, 2, pal[2]); rect(ctx, x + 6, y + 4, 1, 1, INK); rect(ctx, x + 7, y + 4, 1, 1, INK); rect(ctx, x + 6, y + 6, 2, 1, "#e0a020"); }
      else { rect(ctx, x + 5, y + 4, 1, 1, pal[2]); rect(ctx, x + 8, y + 4, 1, 1, pal[2]); }
      if (m.kind === "parrot") { rect(ctx, x + (m.vx > 0 ? 9 : 3), y + 5, 2, 2, pal[2]); rect(ctx, x + (m.vx > 0 ? 3 : 9), y + 8, 2, 3, pal[1]); }
      if (m.kind === "bat") { rect(ctx, x + 6, y + 7, 1, 1, "#fff6e8"); rect(ctx, x + 7, y + 7, 1, 1, "#fff6e8"); }
      if (m.kind === "firebat" && t % 10 < 5) { rect(ctx, x + 1, y - 1, 1, 2, pal[2]); rect(ctx, x + 12, y - 1, 1, 2, pal[2]); }
    }
  } else if (b === "sway") {
    rect(ctx, x + 2, y - 1, 8, 1, INK); rect(ctx, x - 1, y + 2, 14, 5, INK); rect(ctx, x, y, 12, 3, INK);
    rect(ctx, x + 3, y, 6, 1, pal[0]); rect(ctx, x + 1, y + 1, 10, 2, pal[0]); rect(ctx, x, y + 3, 12, 3, pal[0]); rect(ctx, x, y + 6, 12, 1, pal[1]);
    rect(ctx, x + 2, y + 1, 3, 1, pal[2]);
    rect(ctx, x + 4, y + 3, 1, 2, INK); rect(ctx, x + 7, y + 3, 1, 2, INK);
    for (k = 0; k < 5; k++) {
      var len = 3 + ((Math.floor(t / 7) + k) % 2) * 2, off = (Math.floor(t / 10) + k) % 2;
      rect(ctx, x + 1 + k * 2 + off, y + 7, 1, len, k % 2 ? pal[1] : pal[0]);
    }
    if (m.kind === "ember") { var fy = (t % 8) < 4 ? 1 : 0; rect(ctx, x + 3, y - 3 - fy, 2, 2, pal[2]); rect(ctx, x + 7, y - 4 + fy, 2, 3, "#ff8030"); }
  } else if (b === "snake") {
    var top = Math.round(m.topY - cam);
    for (var vy = top; vy < y; vy += 2) { rect(ctx, x + 4, vy, 2, 2, (vy >> 1) % 2 ? pal[1] : "#3a8a2a"); if (((vy - top) % 8) === 4) rect(ctx, x + (((vy >> 3) % 2) ? 6 : 1), vy, 3, 2, "#7ae050"); }
    rect(ctx, x - 1, y - 1, 12, 10, INK);
    rect(ctx, x, y, 10, 8, pal[0]); rect(ctx, x + 1, y + 6, 8, 1, pal[1]);
    rect(ctx, x + 1, y + 2, 3, 2, pal[2]); rect(ctx, x + 6, y + 2, 3, 2, pal[2]); rect(ctx, x + 2, y + 2, 1, 2, INK); rect(ctx, x + 7, y + 2, 1, 2, INK);
    if (t % 30 < 12) { rect(ctx, x + 4, y + 8, 2, 3, "#ff3048"); rect(ctx, x + 3, y + 11, 1, 1, "#ff3048"); rect(ctx, x + 6, y + 11, 1, 1, "#ff3048"); }
  } else if (b === "puff") {
    var bg = m.big, r = bg ? 8 : 6, cx = x + 6, cy = y + 6;
    for (var dy = -r - 1; dy <= r + 1; dy++) { var hw = Math.floor(Math.sqrt(Math.max(0, (r + 1) * (r + 1) - dy * dy))); rect(ctx, cx - hw, cy + dy, hw * 2 + 1, 1, INK); }
    for (dy = -r; dy <= r; dy++) { var hw2 = Math.floor(Math.sqrt(Math.max(0, r * r - dy * dy))); rect(ctx, cx - hw2, cy + dy, hw2 * 2 + 1, 1, dy > r / 3 ? pal[2] : pal[0]); }
    if (bg) for (k = 0; k < 8; k++) { var aa = (k * Math.PI) / 4; rect(ctx, cx + Math.cos(aa) * (r + 2) - 1, cy + Math.sin(aa) * (r + 2) - 1, 2, 2, pal[1]); }
    eyes(ctx, cx - 3 + lk, cy - 2, 4, lk); rect(ctx, cx - 1, cy + 2, 3, 1, pal[1]);
    rect(ctx, m.vx > 0 || Math.sin(m.t * 0.015) < 0 ? cx - r - 3 : cx + r + 1, cy - 1, 2, 3, pal[1]);
  } else if (b === "pull") {
    /* v1.0 hole v3: sprite already returned above. This branch is now whirl only;
       keep the procedural body + orbit dots for the whirlpool. */
    var hl = pal;
    var hx = x + 7, hy = y + 7, a: number;
    ctx.globalAlpha = 0.35;
    for (k = 0; k < 18; k++) { a = (k * Math.PI) / 9 + t * 0.015; rect(ctx, hx + Math.cos(a) * 32, hy + Math.sin(a) * 32, 1, 1, hl[0]); }
    ctx.globalAlpha = 0.65;
    for (k = 0; k < 12; k++) { a = (k * Math.PI) / 6 - t * 0.04; rect(ctx, hx + Math.cos(a) * 18, hy + Math.sin(a) * 18, 1, 1, hl[1]); }
    ctx.globalAlpha = 1;
    for (k = 0; k < 12; k++) { a = k * 0.52 + t * (m.kind === "whirl" ? -0.12 : 0.09); var rr = 8 + (k % 3); rect(ctx, hx + Math.cos(a) * rr - 1, hy + Math.sin(a) * rr - 1, 2, 2, k % 2 ? hl[0] : hl[1]); }
    for (var dy2 = -6; dy2 <= 6; dy2++) { var hw3 = Math.floor(Math.sqrt(36 - dy2 * dy2)); rect(ctx, hx - hw3, hy + dy2, hw3 * 2 + 1, 1, Math.abs(dy2) > 4 ? hl[2] : m.kind === "whirl" ? "#0a3a6a" : "#0c0618"); }
  } else if (b === "wind") {
    ctx.globalAlpha = 0.55;
    for (k = 0; k < 9; k++) {
      var sx = mod(Math.floor(hash(k * 3.3 + m.baseY) * LW) + t * m.dir * 1.6, LW), sy = y + (k % 4) * 3;
      rect(ctx, sx, sy, 8 + (k % 3) * 3, 1, k % 2 ? pal[0] : pal[1]);
    }
    ctx.globalAlpha = 1;
    rect(ctx, x + 2, y, 18, 9, INK); rect(ctx, x, y + 2, 22, 5, INK);
    rect(ctx, x + 3, y + 1, 16, 7, pal[0]); rect(ctx, x + 1, y + 3, 20, 3, pal[0]); rect(ctx, x + 4, y + 6, 14, 1, pal[2]);
    rect(ctx, x + 7, y + 3, 1, 1, INK); rect(ctx, x + 13, y + 3, 1, 1, INK);
    rect(ctx, m.dir > 0 ? x + 17 : x + 3, y + 4, 2, 2, "#88a8d8");
  } else if (m.kind === "ufo") {
    rect(ctx, x + 3, y - 1, 8, 4, INK); rect(ctx, x - 1, y + 2, 16, 5, INK);
    rect(ctx, x + 4, y, 6, 1, "#e8fcff"); rect(ctx, x + 3, y + 1, 8, 2, pal[0]);
    rect(ctx, x + 6, y + 1, 2, 1, "#5ed6b4");
    rect(ctx, x, y + 3, 14, 2, pal[1]); rect(ctx, x + 1, y + 5, 12, 1, pal[2]);
    for (k = 0; k < 4; k++) rect(ctx, x + 1 + k * 4, y + 4, 1, 1, (Math.floor(t / 8) + k) % 2 ? C.gold : C.red);
    if (m.shootT < 18) { ctx.globalAlpha = 0.4; rect(ctx, x + 5, y + 6, 4, 5, "#ff8a3a"); ctx.globalAlpha = 1; }
  } else if (m.kind === "frost") {
    rect(ctx, x + 3, y - 1, 6, 14, INK); rect(ctx, x - 1, y + 3, 14, 6, INK);
    rect(ctx, x + 4, y, 4, 12, pal[0]); rect(ctx, x, y + 4, 12, 4, pal[0]); rect(ctx, x + 2, y + 2, 8, 8, pal[0]);
    rect(ctx, x + 5, y + 1, 2, 2, pal[2]); eyes(ctx, x + 3, y + 5, 4, lk);
    for (k = 0; k < 3; k++) rect(ctx, x + 3 + k * 3, y + 12, 1, 2 + (k % 2), pal[1]);
    if (m.shootT < 20) { ctx.globalAlpha = 0.5; rect(ctx, x + 4, y + 12, 4, 4, "#e8ffff"); ctx.globalAlpha = 1; }
  } else if (b === "comet") {
    var go = m.st === "go";
    if (!go) {
      ctx.globalAlpha = 0.3;
      for (var px = 0; px < LW; px += 6) rect(ctx, px, y + 4, 3, 1, pal[1]);
      ctx.globalAlpha = (t % 10 < 5) ? 0.5 : 0.25; rect(ctx, x - 2, y - 2, 16, 12, pal[2]); ctx.globalAlpha = 1;
    } else {
      for (k = 1; k < 6; k++) { ctx.globalAlpha = 0.6 - k * 0.1; rect(ctx, x + (m.vx > 0 ? -k * 4 : 10 + k * 4 - 4), y + 2 + (k % 2), 4, 4 - (k > 3 ? 1 : 0), k % 2 ? pal[1] : pal[0]); }
      ctx.globalAlpha = 1;
    }
    rect(ctx, x, y - 1, 12, 10, INK); rect(ctx, x + 1, y, 10, 8, "#8a7a6a"); rect(ctx, x + 2, y + 1, 4, 2, "#b0a090"); rect(ctx, x + 7, y + 4, 2, 2, "#5a4a3a");
    rect(ctx, x + 1, y, 10, 1, pal[0]);
  }
  if (frozen) { ctx.globalAlpha = 0.45; rect(ctx, x - 1, y - 1, m.w + 2, m.h + 2, "#c8f8ff"); ctx.globalAlpha = 1; }
}
function drawBullet(ctx: Ctx, b: any, cam: number) {
  var y = Math.round(b.y - cam), x = Math.round(b.x);
  if (y < -8 || y > LH + 8 || b.life <= 0) return;
  if (b.kind === "ice") { rect(ctx, x - 1, y, 3, 6, "#58b8f0"); rect(ctx, x, y + 1, 1, 4, "#ffffff"); rect(ctx, x, y + 6, 1, 1, "#58b8f0"); }
  else if (b.kind === "nut") { rect(ctx, x - 2, y - 1, 4, 4, INK); rect(ctx, x - 1, y, 3, 3, "#7a4a20"); rect(ctx, x - 1, y, 1, 1, "#c08850"); }
  else if (b.kind === "fire") { rect(ctx, x - 2, y - 1, 4, 5, "#ff4818"); rect(ctx, x - 1, y, 2, 3, "#ffd040"); if ((b.life >> 2) % 2) rect(ctx, x - 1, y + 4, 2, 2, "#ff8030"); }
  else { rect(ctx, x - 1, y, 3, 5, "#ff6a2a"); rect(ctx, x, y + 1, 1, 3, "#fff0a0"); }
}
var ITEM_COL: any = { bigcoin: "#f0b428", shield: "#3d8ad8", magnet: "#e03848", rocket: "#ff6a3a" };
function drawItemIcon(ctx: Ctx, kind: string, x: number, y: number) {
  if (HUD_ICONS[kind]) { drawHudIcon(ctx, kind, x, y); return; }
  if (kind === "bigcoin") { rect(ctx, x + 2, y + 1, 6, 8, C.gold); rect(ctx, x + 1, y + 2, 8, 6, C.gold); rect(ctx, x + 3, y + 2, 2, 2, "#fff4c0"); rect(ctx, x + 4, y + 4, 2, 3, C.goldD); }
  else if (kind === "shield") { rect(ctx, x + 2, y + 1, 6, 5, "#5ec8ff"); rect(ctx, x + 3, y + 6, 4, 2, "#5ec8ff"); rect(ctx, x + 4, y + 8, 2, 1, "#5ec8ff"); rect(ctx, x + 3, y + 2, 2, 3, "#e8fcff"); }
  else if (kind === "magnet") { rect(ctx, x + 1, y + 1, 3, 7, "#ff5a62"); rect(ctx, x + 6, y + 1, 3, 7, "#ff5a62"); rect(ctx, x + 1, y + 6, 8, 3, "#ff5a62"); rect(ctx, x + 1, y + 1, 3, 2, "#e8ecf4"); rect(ctx, x + 6, y + 1, 3, 2, "#e8ecf4"); rect(ctx, x + 4, y + 6, 2, 1, "#a82a38"); }
  else if (kind === "rocket") { rect(ctx, x + 4, y, 2, 1, "#ff5a62"); rect(ctx, x + 3, y + 1, 4, 6, "#e8ecf4"); rect(ctx, x + 4, y + 2, 2, 2, "#5ec8ff"); rect(ctx, x + 2, y + 5, 1, 3, "#ff5a62"); rect(ctx, x + 7, y + 5, 1, 3, "#ff5a62"); rect(ctx, x + 4, y + 7, 2, 2, "#ffd046"); }
}
function fillDisk(ctx: Ctx, cx: number, cy: number, r: number, col: string) {
  for (var dy = -r; dy <= r; dy++) {
    var hw = Math.floor(Math.sqrt(r * r - dy * dy));
    rect(ctx, cx - hw, cy + dy, hw * 2 + 1, 1, col);
  }
}
function strokeDisk(ctx: Ctx, cx: number, cy: number, r: number, col: string) {
  var r2 = (r - 1) * (r - 1);
  for (var dy = -r; dy <= r; dy++) {
    var hw = Math.floor(Math.sqrt(r * r - dy * dy));
    var inner = (dy * dy >= r2) ? -1 : Math.floor(Math.sqrt(r2 - dy * dy));
    if (inner < 0) rect(ctx, cx - hw, cy + dy, hw * 2 + 1, 1, col);
    else {
      rect(ctx, cx - hw, cy + dy, hw - inner, 1, col);
      rect(ctx, cx + inner + 1, cy + dy, hw - inner, 1, col);
    }
  }
}
function drawBubble(ctx: Ctx, cx: number, cy: number) {
  /* 64-px bubble: drawn in art space at scale(0.5), opaque 2-art-px rim, no fill. */
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.translate(cx, cy);
  ctx.scale(0.5, 0.5);
  var R = 28, dx, dy, d, col;
  for (dy = -R; dy <= R; dy++) {
    for (dx = -R; dx <= R; dx++) {
      d = Math.sqrt(dx * dx + dy * dy);
      col = null;
      if (d >= 27 && d < 28.5) col = "#140c1c";
      else if (d >= 25 && d < 27) col = (dx + dy < 0) ? "#e4f0f8" : "#8aa8c8";
      if (d >= 24 && d < 26 && dx >= -18 && dx <= -6 && dy >= -18 && dy <= -8) col = "#ffffff";
      if (col) rect(ctx, dx, dy, 1, 1, col);
    }
  }
  ctx.restore();
}
function drawBubblePop(ctx: Ctx, cx: number, cy: number, t: number) {
  var max = BUBBLE.popTicks;
  var frame = Math.max(0, Math.min(3, Math.floor((max - t) * 4 / max)));
  var col = BUBBLE.rim, r = BUBBLE.r, i, ox, oy;
  if (frame === 0) {
    strokeDisk(ctx, cx, cy, r, col);
    rect(ctx, cx - r - 1, cy, 2, 1, col);
    rect(ctx, cx + r, cy, 2, 1, col);
    rect(ctx, cx, cy - r - 1, 1, 2, col);
    rect(ctx, cx, cy + r, 1, 2, col);
  } else if (frame === 1) {
    strokeDisk(ctx, cx, cy, r + 1, col);
  } else {
    var d = frame === 2 ? 4 : 7;
    var pts = [
      [-r - d, 0], [r + d, 0], [0, -r - d], [0, r + d],
      [-r, -r], [r, -r], [-r, r], [r, r]
    ];
    for (i = 0; i < (frame === 2 ? 8 : 6); i++) {
      ox = cx + pts[i][0]; oy = cy + pts[i][1];
      if (frame === 2) { rect(ctx, ox, oy, 2, 2, col); rect(ctx, ox + 1, oy - 1, 1, 1, BUBBLE.hi); }
      else rect(ctx, ox, oy, 1, 1, col);
    }
  }
}
function drawItem(ctx: Ctx, it: any, cam: number, tick: number) {
  if (it.taken && !(it.popT > 0)) return;
  var by = (it.popT > 0) ? 0 : ((((tick + it.x) >> BUBBLE.bobShift) & 1) ? -BUBBLE.bobAmp : 0);
  var y = Math.round(it.y - cam) + by, x = Math.round(it.x);
  if (y < -28 || y > LH + 12) return;
  var cx = x + 5, cy = y + 5;
  if (it.popT > 0) { drawBubblePop(ctx, cx, cy, it.popT); return; }
  drawBubble(ctx, cx, cy);
  if (drawBonusSprite(ctx, it.kind, cx, cy, tick)) return;
  drawItemIcon(ctx, it.kind, x, y);
}

var SHIELD_BLINK_T = 90; /* last 1.8 s at 50 ticks/s */
var WALL_BLINK_T = 60; /* v0.59: ninja walls blink for the last 1.2 s before they vanish */
/* v0.59 ninja walls: Design's 8×16 brick tile (left wall, x=0 = outer edge, x=7 = #140c1c).
   Right wall is a horizontal mirror. Tiles are locked to world y so they scroll with the camera.
   Own hero: full-height columns. Other players: a short segment with 8×4 caps (1 px overlap).
   Blink and net flags are unchanged. */
var NINJA_WALL_TILE = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAQCAYAAAArij59AAAAxElEQVR4nJWRrQrCABSFv8GaCwaLYDT6AD6EYWXFZzD6GEafwWIxGCwaBGGI4ISBoks6VESHuA1EBxrGfhWcN13uOZdz7rlCQSq9+r0W36omNxEBJG2AszESYGeyB/AJ2nAOgH5wqRRzCaIIMN3Z4SDeAwiZPNBt+xOlEfVxidnyjHnzkBU4Xu4AjFZWRFhbj3AjAP7z8DMHQ9VRjSvVch7HfX6aDHTT+tk9JG5PZSECjBcnAEzHo66AsbXDyMUAiFf8H28u114h4LlTRwAAAABJRU5ErkJggg==";
var NINJA_WALL_CAP = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAECAYAAACzzX7wAAAAS0lEQVR4nGMU4ZH5z4AHsDAwMDDsKLNg4ODiYfhy+w5CQlqCwaPrBETBnSvPGBgYGBj+fP7KcOX5VwYDNTGGY0fPMTAwMDAwErICANZaE3BP+jYWAAAAAElFTkSuQmCC";
var ninjaWallCache: any = {};
function ninjaWallSprite(kind: string) {
  if (ninjaWallCache[kind] !== undefined) return ninjaWallCache[kind];
  var src = kind === "cap" ? NINJA_WALL_CAP : NINJA_WALL_TILE;
  var cv = pngToCanvas(src);
  ninjaWallCache[kind] = cv || null;
  return ninjaWallCache[kind];
}
function drawNinjaWallCapAt(ctx: Ctx, left: boolean, y: number, flipV: boolean) {
  var cap = ninjaWallSprite("cap");
  if (!cap) return;
  ctx.save();
  if (!left) { ctx.translate(LW, 0); ctx.scale(-1, 1); }
  if (flipV) { ctx.translate(0, y + 4); ctx.scale(1, -1); ctx.drawImage(cap, 0, 0); }
  else ctx.drawImage(cap, 0, y);
  ctx.restore();
}
function drawNinjaWallCol(ctx: Ctx, left: boolean, y0: number, y1: number, camI: number, withCaps: boolean) {
  var tile = ninjaWallSprite("tile");
  y0 = Math.floor(y0); y1 = Math.ceil(y1);
  if (y1 <= y0) return;
  ctx.save();
  if (!left) { ctx.translate(LW, 0); ctx.scale(-1, 1); }
  ctx.beginPath(); ctx.rect(0, y0, 8, y1 - y0); ctx.clip();
  if (tile) {
    var sy = Math.floor((y0 + camI) / 16) * 16 - camI;
    while (sy < y1) { ctx.drawImage(tile, 0, sy); sy += 16; }
  } else {
    /* decode fallback: cream/red stripes, same world-anchored period */
    var yy = y0;
    while (yy < y1) {
      var wy = yy + camI, seg = Math.floor(wy / 4), next = Math.min(y1, (seg + 1) * 4 - camI);
      rect(ctx, 0, yy, 8, next - yy, (seg & 1) ? "#d82a2a" : C.cream);
      yy = next;
    }
    rect(ctx, 0, y0, 1, y1 - y0, INK); rect(ctx, 7, y0, 1, y1 - y0, INK);
  }
  ctx.restore();
  if (withCaps) {
    drawNinjaWallCapAt(ctx, left, y0 - 3, false);
    drawNinjaWallCapAt(ctx, left, y1 - 1, true);
  }
}
function drawNinjaWalls(ctx: Ctx, p: any, sy: number, cam: number, tick: number, full: boolean, bottom: number) {
  if (!(p.wallT > 0) || !p.alive) return;
  if (p.wallT <= WALL_BLINK_T && (((p.remote ? tick : p.wallT) >> 2) % 2)) return;
  var camI = Math.round(cam);
  var y0 = full ? 0 : Math.max(0, Math.round(sy) - 36), y1 = full ? bottom : Math.min(bottom, Math.round(sy) + PH + 36);
  drawNinjaWallCol(ctx, true, y0, y1, camI, !full);
  drawNinjaWallCol(ctx, false, y0, y1, camI, !full);
}
var SHIELD_FRAMES: any = null;
function buildShieldFrames() {
  var frames: any[] = [];
  /* Four pulsing frames: alternating radius, ring thickness, palette tones, and crest glints.
     Colours come strictly from the game's shield/hero palette; alpha is always 0 or 1. */
  var specs = [
    { r0: 12.1, r1: 13.7, cHi: "#ffffff", cMid: "#a4e8ff", cLow: "#3ca4ec", sparks: [[0, -15, "#a4e8ff"], [0, 15, "#3ca4ec"], [-15, 0, "#a4e8ff"], [15, 0, "#3ca4ec"]] },
    { r0: 12.7, r1: 14.5, cHi: "#ffffff", cMid: "#a4e8ff", cLow: "#5ec8ff", sparks: [[-11, -11, "#ffffff"], [11, -11, "#a4e8ff"], [-11, 11, "#a4e8ff"], [11, 11, "#3ca4ec"]] },
    { r0: 13.4, r1: 15.2, cHi: "#ffffff", cMid: "#c8f4ff", cLow: "#5ec8ff", sparks: [[0, -16, "#ffffff"], [0, 16, "#a4e8ff"], [-16, 0, "#ffffff"], [16, 0, "#a4e8ff"]] },
    { r0: 12.7, r1: 14.3, cHi: "#a4e8ff", cMid: "#5ec8ff", cLow: "#3ca4ec", sparks: [[-10, -12, "#a4e8ff"], [12, -10, "#a4e8ff"], [-12, 10, "#3ca4ec"], [10, 12, "#3ca4ec"]] }
  ];
  /* v1.0: procedural ring kept only as a fallback. Sprite A2 is used for drawing.
     If the math is reused: YSC=1.7, N=61, H=30, cy = round(sy). */
  var YSC = 1.7, N = 61, H = 30;
  for (var fi = 0; fi < specs.length; fi++) {
    var sp = specs[fi];
    var grid: any[] = [];
    for (var i = 0; i < N * N; i++) grid.push(null);
    function idx(dx: number, dy: number) { return (dy + H) * N + (dx + H); }
    var yLo = -Math.ceil(16 * YSC), yHi = Math.ceil(16 * YSC);
    for (var dy = yLo; dy <= yHi; dy++) {
      for (var dx = -16; dx <= 16; dx++) {
        var d = Math.sqrt(dx * dx + (dy / YSC) * (dy / YSC));
        if (d >= sp.r0 && d <= sp.r1) {
          var diag = dx + dy / YSC;
          grid[idx(dx, dy)] = diag < -7 ? sp.cHi : diag < 7 ? sp.cMid : sp.cLow;
        }
      }
    }
    for (var si = 0; si < sp.sparks.length; si++) {
      var sx = sp.sparks[si][0] as number, sy2 = Math.round((sp.sparks[si][1] as number) * YSC);
      if (sy2 < -H) sy2 = -H; if (sy2 > H) sy2 = H;
      grid[idx(sx, sy2)] = sp.sparks[si][2];
    }
    /* 1-px dark outline (#140c1c, hero sprite outline) around the outside of the bright aura */
    var out: any[] = [];
    var dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (dy = yLo - 1; dy <= yHi + 1; dy++) {
      for (dx = -17; dx <= 17; dx++) {
        var c = grid[idx(dx, dy)];
        if (c) { out.push([dx, dy, c]); continue; }
        var d2 = Math.sqrt(dx * dx + (dy / YSC) * (dy / YSC));
        if (d2 <= sp.r0) continue;
        for (var di = 0; di < 4; di++) {
          var nx = dx + dirs[di][0], ny = dy + dirs[di][1];
          if (nx >= -H && nx <= H && ny >= -H && ny <= H && grid[idx(nx, ny)]) {
            out.push([dx, dy, "#140c1c"]);
            break;
          }
        }
      }
    }
    frames.push(out);
  }
  return frames;
}
var shieldA2Cv: any = undefined;
function shieldA2Sheet() {
  if (shieldA2Cv !== undefined) return shieldA2Cv;
  shieldA2Cv = (typeof SHIELD_A2_SRC !== "undefined" && SHIELD_A2_SRC) ? (pngToCanvas(SHIELD_A2_SRC) || null) : null;
  return shieldA2Cv;
}
function drawShieldAura(ctx: Ctx, p: any, sy: number, tick: number) {
  if (!(p.shieldT > 0)) return;
  if (p.shieldT <= SHIELD_BLINK_T) {
    var bt = p.remote ? tick : p.shieldT;
    if (((bt >> 2) % 2) === 0) return;
  }
  var cx = Math.round(p.x + 6), cy = Math.round(sy);
  var sheet = shieldA2Sheet();
  if (sheet) {
    var fi = Math.floor(tick / 6) % 4;
    ctx.imageSmoothingEnabled = false;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(0.5, 0.5);
    ctx.drawImage(sheet, fi * 64, 0, 64, 106, -32, -53, 64, 106);
    ctx.restore();
    return;
  }
  if (!SHIELD_FRAMES) SHIELD_FRAMES = buildShieldFrames();
  var ph = Math.floor(tick / 6) % SHIELD_FRAMES.length;
  var pts = SHIELD_FRAMES[ph];
  ctx.globalAlpha = 1;
  for (var i = 0; i < pts.length; i++) {
    var pt = pts[i];
    rect(ctx, cx + pt[0], cy + pt[1], 1, 1, pt[2]);
  }
}

/* Magnet aura: JS port of tools/magnet_aura_cloud.py cloud_aura. Built from the current
   pose alpha mask (4 frames × 6 ticks), drawn behind the hero. No ring, no coin threads. */
var MAGNET_CLOUD: any = {};
function mcMulberry(seed: number) {
  var s = (seed >>> 0) || 1;
  return function () {
    s = (s + 0x6D2B79F5) >>> 0;
    var t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function mcEdt(mask: Uint8Array, H: number, W: number) {
  var INF = 1e6, d = new Float64Array(H * W), i, y, x, v;
  for (i = 0; i < H * W; i++) d[i] = mask[i] ? 0 : INF;
  for (y = 0; y < H; y++) {
    for (x = 0; x < W; x++) {
      i = y * W + x; v = d[i];
      if (x > 0) v = Math.min(v, d[i - 1] + 3);
      if (y > 0) v = Math.min(v, d[i - W] + 3);
      if (x > 0 && y > 0) v = Math.min(v, d[i - W - 1] + 4);
      if (x + 1 < W && y > 0) v = Math.min(v, d[i - W + 1] + 4);
      d[i] = v;
    }
  }
  for (y = H - 1; y >= 0; y--) {
    for (x = W - 1; x >= 0; x--) {
      i = y * W + x; v = d[i];
      if (x + 1 < W) v = Math.min(v, d[i + 1] + 3);
      if (y + 1 < H) v = Math.min(v, d[i + W] + 3);
      if (x + 1 < W && y + 1 < H) v = Math.min(v, d[i + W + 1] + 4);
      if (x > 0 && y + 1 < H) v = Math.min(v, d[i + W - 1] + 4);
      d[i] = v;
    }
  }
  for (i = 0; i < H * W; i++) d[i] /= 3;
  return d;
}
function mcNoise(H: number, W: number, f: number, scale: number, ox: number, oy: number) {
  var gh = (H / scale | 0) + 4, gw = (W / scale | 0) + 4;
  var rng = mcMulberry(2000 + f * 17 + ox), g = new Float64Array(gh * gw), i, y, x;
  for (i = 0; i < g.length; i++) g[i] = rng();
  var n = new Float64Array(H * W);
  for (y = 0; y < H; y++) {
    for (x = 0; x < W; x++) {
      var fx = (x + ox + f * 1.4) / scale, fy = (y + oy - f * 0.8) / scale;
      var x0 = Math.floor(fx), y0 = Math.floor(fy);
      var tx = fx - x0, ty = fy - y0;
      tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty);
      if (x0 < 0) x0 = 0; if (y0 < 0) y0 = 0;
      if (x0 >= gw - 1) x0 = gw - 2; if (y0 >= gh - 1) y0 = gh - 2;
      var a = g[y0 * gw + x0], b = g[y0 * gw + x0 + 1], c = g[(y0 + 1) * gw + x0], ev = g[(y0 + 1) * gw + x0 + 1];
      n[y * W + x] = a * (1 - tx) * (1 - ty) + b * tx * (1 - ty) + c * (1 - tx) * ty + ev * tx * ty;
    }
  }
  return n;
}
function mcHash(x: number, y: number, f: number) {
  return (((Math.imul(x, 73856093) ^ Math.imul(y, 19349663) ^ Math.imul(f, 83492791)) >>> 0) % 1000) / 1000;
}
function mcMorph(src: Uint8Array, H: number, W: number, mode: string, four: boolean) {
  var o = new Uint8Array(H * W), y, x, dy, dx, yy, xx, i;
  for (y = 0; y < H; y++) {
    for (x = 0; x < W; x++) {
      i = y * W + x;
      if (mode === "dilate") {
        if (!src[i]) continue;
        for (dy = -1; dy <= 1; dy++) for (dx = -1; dx <= 1; dx++) {
          if (four && dy && dx) continue;
          yy = y + dy; xx = x + dx;
          if (yy >= 0 && yy < H && xx >= 0 && xx < W) o[yy * W + xx] = 1;
        }
      } else {
        var ok = 1;
        for (dy = -1; dy <= 1 && ok; dy++) for (dx = -1; dx <= 1; dx++) {
          if (four && dy && dx) continue;
          yy = y + dy; xx = x + dx;
          if (yy < 0 || yy >= H || xx < 0 || xx >= W || !src[yy * W + xx]) { ok = 0; break; }
        }
        o[i] = ok;
      }
    }
  }
  return o;
}
function mcDropFlecks(pix: Uint8ClampedArray, H: number, W: number) {
  var seen = new Uint8Array(H * W), y, x, i, q;
  for (y = 0; y < H; y++) {
    for (x = 0; x < W; x++) {
      i = y * W + x;
      if (seen[i] || pix[i * 4 + 3] === 0) continue;
      var cells = [i];
      seen[i] = 1;
      for (var p = 0; p < cells.length; p++) {
        var ci = cells[p], cx = ci % W, cy = (ci / W) | 0;
        var nbs = [cy * W + cx - 1, cy * W + cx + 1, (cy - 1) * W + cx, (cy + 1) * W + cx];
        for (var ni = 0; ni < 4; ni++) {
          var n = nbs[ni], nx = n % W, ny = (n / W) | 0;
          if (n < 0 || n >= H * W) continue;
          if (ni < 2 && ny !== cy) continue;
          if (!seen[n] && pix[n * 4 + 3] > 0) { seen[n] = 1; cells.push(n); }
        }
      }
      if (cells.length <= 2) {
        for (q = 0; q < cells.length; q++) {
          var o = cells[q] * 4;
          pix[o] = pix[o + 1] = pix[o + 2] = pix[o + 3] = 0;
        }
      }
    }
  }
}
function magnetCloudCv(id: string, pose: string, fi: number) {
  var key = id + ":" + pose + ":" + fi;
  if (MAGNET_CLOUD[key] !== undefined) return MAGNET_CLOUD[key];
  var spr = heroSprite(id);
  if (!spr) return MAGNET_CLOUD[key] = null;
  var PL = posesFor(id);
  var pn = pose || "idle";
  var idx = PL.indexOf(pn);
  if (idx < 0) idx = 0;
  var fw = (spr.naturalWidth || spr.width) / PL.length, fh = spr.naturalHeight || spr.height;
  var PAD = 16, H = fh + 2 * PAD, W = fw + 2 * PAD;
  var g = spr.getContext("2d");
  if (!g) return MAGNET_CLOUD[key] = null;
  var src = g.getImageData(idx * fw, 0, fw, fh).data;
  var mask = new Uint8Array(H * W), xs = 0, ys = 0, nmask = 0, y, x, i;
  for (y = 0; y < fh; y++) for (x = 0; x < fw; x++) {
    if (src[(y * fw + x) * 4 + 3] > 0) {
      i = (y + PAD) * W + (x + PAD);
      mask[i] = 1; xs += x + PAD; ys += y + PAD; nmask++;
    }
  }
  var core = mcMorph(mask, H, W, "dilate", false);
  core = mcMorph(core, H, W, "erode", false);
  core = mcMorph(core, H, W, "dilate", true);
  core = mcMorph(core, H, W, "dilate", true);
  var d = mcEdt(core, H, W), dh = mcEdt(mask, H, W);
  var pulse = [0.0, 1.4, 0.2, -1.1][fi & 3];
  var noise = mcNoise(H, W, fi, 6, 0, 0);
  var noise2 = mcNoise(H, W, fi + 3, 11, 4, 0);
  var cxm = nmask ? xs / nmask : W / 2, cym = nmask ? ys / nmask : H / 2;
  var lobes = [
    [-0.4, 3.2, 14], [1.2, 2.6, 11], [2.5, 3.0, 13], [3.8, 2.2, 10]
  ];
  var cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  var cg = cv.getContext("2d");
  if (!cg) return MAGNET_CLOUD[key] = null;
  var img = cg.createImageData(W, H), pix = img.data;
  var C0 = [0x8c, 0x24, 0x30], C1 = [0xc8, 0x3c, 0x3c], C2 = [0xe8, 0x60, 0x60], OK = [0x14, 0x0c, 0x1c];
  function put(ii: number, c: number[]) { pix[ii] = c[0]; pix[ii + 1] = c[1]; pix[ii + 2] = c[2]; pix[ii + 3] = 255; }
  for (y = 0; y < H; y++) {
    for (x = 0; x < W; x++) {
      i = y * W + x;
      if (mask[i]) continue;
      if (dh[i] < 1.2) continue;
      var lobe = 0, k;
      for (k = 0; k < 4; k++) {
        var ang = lobes[k][0] + fi * 0.35;
        var lx = cxm + Math.cos(ang) * 10, ly = cym + Math.sin(ang) * 14;
        var sig = lobes[k][2];
        lobe += lobes[k][1] * Math.exp(-((x - lx) * (x - lx) + (y - ly) * (y - ly)) / (2 * sig * sig));
      }
      var deff = d[i] - pulse - 3.2 * (noise[i] - 0.5) - 1.6 * (noise2[i] - 0.5) - lobe;
      var chk = ((x + y + fi) % 2) === 0;
      var r = mcHash(x, y, fi);
      var o = i * 4;
      if (deff <= 3.0) {
        put(o, C0);
        if (deff > 1.8 && !chk) put(o, C1);
      } else if (deff <= 6.0) {
        if (chk) put(o, C1);
        else if (r < 0.20) put(o, C0);
      } else if (deff <= 9.0) {
        if ((((x >> 1) + (y >> 1) + fi) % 2) === 0 && r < 0.35) put(o, C2);
      }
    }
  }
  mcDropFlecks(pix, H, W);
  for (y = 0; y < H; y++) {
    for (x = 0; x < W; x++) {
      i = y * W + x;
      if (pix[i * 4 + 3] === 0) continue;
      var edge = false;
      if (x === 0 || y === 0 || x === W - 1 || y === H - 1) edge = true;
      else if (pix[(i - 1) * 4 + 3] === 0 || pix[(i + 1) * 4 + 3] === 0 || pix[(i - W) * 4 + 3] === 0 || pix[(i + W) * 4 + 3] === 0) edge = true;
      if (edge && dh[i] <= 3.5 && dh[i] >= 1.2 && mcHash(x, y, fi) < 0.08) put(i * 4, OK);
    }
  }
  if (nmask) {
    var xmin = W, xmax = 0, ymin = H;
    for (y = 0; y < H; y++) for (x = 0; x < W; x++) if (mask[y * W + x]) {
      if (x < xmin) xmin = x; if (x > xmax) xmax = x; if (y < ymin) ymin = y;
    }
    var sparks = [
      [xmin - 3, Math.round(cym - 8 - fi * 3)],
      [xmax + 2, Math.round(cym - 16 - fi * 3)],
      [Math.round(cxm + 6), Math.round(ymin - 2 - fi * 2)]
    ];
    for (var si = 0; si < 3; si++) {
      if (si === 2 && (fi % 2)) continue;
      var sx = sparks[si][0], sy0 = sparks[si][1];
      var cols = [C2, C1];
      for (var sd = 0; sd < 2; sd++) {
        var Y = sy0 + sd;
        if (sx >= 0 && sx < W && Y >= 0 && Y < H && !mask[Y * W + sx]) put((Y * W + sx) * 4, cols[sd]);
      }
    }
  }
  for (i = 0; i < H * W; i++) if (mask[i]) {
    var o2 = i * 4;
    pix[o2] = pix[o2 + 1] = pix[o2 + 2] = pix[o2 + 3] = 0;
  }
  cg.putImageData(img, 0, 0);
  MAGNET_CLOUD[key] = cv;
  return cv;
}
function drawMagnetCloud(ctx: Ctx, p: any, sy: number, pose: string, face: number, tick: number) {
  if (!(p.magnetT > 0) || !p.alive) return;
  var id = (p.look && p.look.id) || "pilot";
  var fi = Math.floor(tick / 6) % 4;
  var cv = magnetCloudCv(id, pose || "idle", fi);
  if (!cv) return;
  var spr = heroSprite(id);
  if (!spr) return;
  var PL = posesFor(id);
  var fw = (spr.naturalWidth || spr.width) / PL.length, fh = spr.naturalHeight || spr.height;
  var s = 1, PAD = 16;
  var hcx = p.x + 6, by = sy + 16 * s;
  var dh = fh * 0.5 * s;
  var dx = hcx - SPR_AX * s - PAD * 0.5 * s;
  var dy = by - dh - PAD * 0.5 * s;
  var dw = cv.width * 0.5 * s, dhh = cv.height * 0.5 * s;
  ctx.imageSmoothingEnabled = false;
  ctx.save();
  if (face < 0) {
    ctx.translate(hcx, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(cv, dx - hcx, dy, dw, dhh);
  } else {
    ctx.drawImage(cv, dx, dy, dw, dhh);
  }
  ctx.restore();
}

