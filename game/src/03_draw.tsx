
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
  var x = -4, i = 0;
  while (x < LW) {
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
  var x = -8, i = 0;
  while (x < LW + 8) {
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
  var bands = 24, i, k;
  for (i = 0; i < bands; i++) {
    var t = i / (bands - 1);
    var col = t < 0.5 ? mixHex(sky[0], sky[1], t / 0.5) : mixHex(sky[1], sky[2], (t - 0.5) / 0.5);
    var y0 = Math.round((LH * i) / bands), y1 = Math.round((LH * (i + 1)) / bands);
    rect(ctx, 0, y0, LW, y1 - y0, col);
    if (i > 0) { ctx.fillStyle = col; for (var dx = (i % 2) * 2; dx < LW; dx += 4) ctx.fillRect(dx, y0 - 1, 2, 1); }
  }
  /* stars / plankton / embers */
  if (map === "city" || map === "space" || map === "ice" || (map === "jungle" && m > 500)) {
    var starA = map === "space" ? 0.9 : clamp(0.55 + m / 2200, 0.55, 1);
    var nStars = map === "space" ? 68 : Math.round(lerp(28, 72, clamp(m / 2500, 0, 1)));
    for (i = 0; i < nStars; i++) {
      var sx = Math.floor(hash(i) * LW);
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
  if (map === "city" || map === "space") {
    var moonA = map === "space" ? 0.95 : 1 - clamp((m - 1200) / 600, 0, 1);
    if (moonA > 0) {
      var mx = LW - 21, my = Math.max(28, Math.round(6 + alt * 0.015)); if (menu) my = Math.max(70, my);
      ctx.globalAlpha = moonA;
      var mc = map === "space" ? "#a8d8ff" : "#f8e4a8", md = map === "space" ? "#78a8e0" : "#e0c078";
      rect(ctx, mx + 3, my, 10, 16, mc); rect(ctx, mx, my + 3, 16, 10, mc); rect(ctx, mx + 1, my + 1, 14, 14, mc);
      rect(ctx, mx + 4, my + 4, 3, 3, md); rect(ctx, mx + 10, my + 8, 3, 2, md); rect(ctx, mx + 6, my + 11, 2, 2, md);
      rect(ctx, mx + 3, my + 2, 4, 1, "#ffffff");
      ctx.globalAlpha = 1;
    }
  } else if (map === "jungle" || map === "lava") {
    var sunC = map === "lava" ? "#ffdc60" : "#fff4a8", sunR = map === "lava" ? "#ff9440" : "#ffd868";
    var sx0 = LW - 24, sy0 = Math.round(14 + alt * 0.01); if (menu) sy0 = Math.max(70, sy0);
    ctx.globalAlpha = 0.25; rect(ctx, sx0 - 3, sy0 - 3, 22, 22, sunR); ctx.globalAlpha = 1;
    rect(ctx, sx0 + 3, sy0, 10, 16, sunC); rect(ctx, sx0, sy0 + 3, 16, 10, sunC); rect(ctx, sx0 + 1, sy0 + 1, 14, 14, sunC);
  }
  /* aurora (city high & ice) */
  var aur = map === "ice" ? 0.85 : map === "city" ? band(m, 900, 1400, 3200, 4200) : 0;
  if (aur > 0) {
    var acs = map === "ice" ? ["#72ffdc", "#7cd8ff", "#f288ff"] : ["#6af8c0", "#6ed4ff", "#f080e8"];
    for (k = 0; k < 3; k++) {
      ctx.globalAlpha = 0.42 * aur;
      for (var ax = 0; ax < LW; ax += 2) {
        var ay = 46 + k * 16 + Math.sin(ax * 0.045 + tick * 0.012 + k * 1.7) * 9 + Math.sin(ax * 0.11 + k) * 3;
        rect(ctx, ax, ay, 2, 7 - k, acs[k]);
      }
    }
    ctx.globalAlpha = 1;
  }
  /* vibrant nebulae & planet (space always, city high) */
  var sp = map === "space" ? 1 : map === "city" ? clamp((m - 2000) / 800, 0, 1) : 0;
  if (sp > 0) {
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
  if (map === "aqua") {
    ctx.globalAlpha = 0.18;
    for (k = 0; k < 4; k++) {
      var bx = 18 + k * 38;
      for (var by = 0; by < LH; by += 8) rect(ctx, bx + Math.floor(by * 0.14), by, 10, 8, "#c8ffff");
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
  if (map === "ice") {
    ctx.globalAlpha = 0.8;
    for (k = 0; k < 24; k++) {
      var fx = mod(Math.floor(hash(k + 700) * LW) + Math.sin(tick * 0.03 + k) * 5, LW);
      var fy = mod(Math.floor(hash(k + 800) * LH) + tick * (0.3 + (k % 3) * 0.12) + alt * 0.28, LH);
      rect(ctx, fx, fy, k % 5 === 0 ? 2 : 1, k % 5 === 0 ? 2 : 1, "#ffffff");
    }
    ctx.globalAlpha = 1;
  }
  /* lava rising embers */
  if (map === "lava") {
    for (k = 0; k < 20; k++) {
      var ex = mod(Math.floor(hash(k + 900) * LW) + Math.sin(tick * 0.06 + k) * 6, LW);
      var ey = mod(Math.floor(hash(k + 950) * LH) - tick * (0.45 + (k % 3) * 0.15) + alt * 0.3, LH);
      rect(ctx, ex, ey, k % 3 === 0 ? 2 : 1, k % 3 === 0 ? 2 : 1, k % 2 ? "#ffd850" : "#ff6830");
    }
  }
  /* clouds (city, jungle, ice, lava) */
  if (map === "city" || map === "jungle" || map === "ice" || map === "lava") {
    var cl = map === "city" ? band(m, 120, 450, 1700, 2400) : 0.85;
    if (cl > 0) {
      ctx.globalAlpha = 0.72 * cl;
      var cf = mixHex(sky[2], "#ffffff", 0.35), ch = mixHex(sky[2], "#ffffff", 0.65), cs = mixHex(sky[1], "#201840", 0.18);
      for (k = 0; k < 7; k++) {
        var cx = mod(Math.floor(hash(k + 10) * 200) + tick * (k % 2 ? 0.04 : -0.03), LW + 60) - 30;
        var cy = mod(k * 61 + alt * 0.18, LH + 60) - 30;
        drawCloud(ctx, cx, cy, 1, cf, ch, cs);
      }
      ctx.globalAlpha = 0.9 * cl;
      var nf = mixHex(sky[2], "#ffffff", 0.58), nh = "#ffffff", ns = mixHex(sky[2], "#201840", 0.12);
      for (k = 0; k < 4; k++) {
        var ncx = mod(Math.floor(hash(k + 20) * 220) + tick * (k % 2 ? 0.09 : -0.07), LW + 80) - 60;
        var ncy = mod(k * 109 + 40 + alt * 0.42, LH + 80) - 40;
        drawCloud(ctx, ncx, ncy, 2, nf, nh, ns);
      }
      ctx.globalAlpha = 1;
    }
  }
  /* map horizon silhouettes */
  var farBase = LH - 64 + alt * 0.1;
  var nearBase = LH - 40 + alt * 0.3;
  if (map === "city") {
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
  if (roofY < LH && roofY > -40) {
    if (map === "jungle") {
      rect(ctx, 0, roofY + 3, LW, LH, "#2a4e36"); rect(ctx, 0, roofY + 3, LW, 2, "#62d458");
      for (var tx = 6; tx < LW; tx += 22) { rect(ctx, tx, roofY + 8, 12, 8, "#3a6848"); rect(ctx, tx + 2, roofY + 10, 4, 2, "#80e870"); }
    } else if (map === "ice") {
      rect(ctx, 0, roofY + 3, LW, LH, "#6eb8e8"); rect(ctx, 0, roofY + 3, LW, 3, "#e8fbff");
      for (tx = 8; tx < LW; tx += 18) rect(ctx, tx, roofY + 10, 8, 4, "#9cd8fa");
    } else if (map === "lava") {
      rect(ctx, 0, roofY + 3, LW, LH, "#3a202c"); rect(ctx, 0, roofY + 3, LW, 2, "#ff7c30");
      for (tx = 10; tx < LW; tx += 26) rect(ctx, tx, roofY + 11, 10, 2, "#ff5820");
    } else if (map === "aqua") {
      rect(ctx, 0, roofY + 3, LW, LH, "#d8b46c"); rect(ctx, 0, roofY + 3, LW, 2, "#ffe49c");
      for (tx = 10; tx < LW; tx += 28) { rect(ctx, tx, roofY - 4, 2, 7, "#ff70a0"); rect(ctx, tx - 2, roofY - 2, 2, 3, "#ff70a0"); rect(ctx, tx + 8, roofY - 5, 2, 8, "#48e090"); }
    } else if (map === "space") {
      rect(ctx, 0, roofY + 3, LW, LH, "#343264"); rect(ctx, 0, roofY + 3, LW, 2, "#78f0ff");
      for (tx = 12; tx < LW; tx += 24) rect(ctx, tx, roofY + 10, 8, 3, "#6058a4");
    } else {
      rect(ctx, 0, roofY + 3, LW, LH, C.brick);
      for (var ty = roofY + 7; ty < LH; ty += 6) for (tx = 0; tx < LW; tx += 8) rect(ctx, tx + (((ty - roofY) / 6) % 2 ? 4 : 0), ty, 3, 1, C.brickL);
      rect(ctx, 0, roofY + 3, LW, 2, C.roof);
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
    rect(ctx, x + 2, y - 2, w - 4, 6, INK); rect(ctx, x, y, w, 4, INK);
    rect(ctx, x + 3, y - 1, w - 6, 4, "#ffffff"); rect(ctx, x + 1, y + 1, w - 2, 2, "#ffffff");
    rect(ctx, x + 6, y - 3, 6, 2, "#ffffff"); rect(ctx, x + w - 13, y - 3, 7, 2, "#ffffff");
    rect(ctx, x + 1, y + 3, w - 2, 1, "#a8c8f0");
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
  rect(ctx, x + 1, y + 6, w - 1, 1, "rgba(0,0,0,0.28)");
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
  if (p.spring) {
    var sx = x + Math.floor(w / 2) - 3, h = p.springT > 0 ? 3 : 6;
    rect(ctx, sx, y - 1, 6, 1, C.springD);
    for (i = 2; i <= h; i++) rect(ctx, sx + (i % 2), y - i, 5, 1, i % 2 ? C.spring : C.springD);
    rect(ctx, sx - 1, y - h - 1, 8, 1, C.coral);
    rect(ctx, sx, y - h - 2, 6, 1, "#ff8a80");
  }
}
function drawTrack(ctx: Ctx, p: any, cam: number) {
  var y = Math.round(p.y - cam) + 2;
  if (y < -10 || y > LH + 10) return;
  ctx.fillStyle = "rgba(255,216,80,0.34)";
  for (var x = 3; x < LW - 3; x += 5) ctx.fillRect(x, y, 2, 1);
}

var MOBPAL: any = {
  blob: ["#6ad86a", "#2e9a50", "#c8ffb0"], magma: ["#ff7828", "#b02818", "#ffe060"], penguin: ["#2a3048", "#f6f6ff", "#ffa030"],
  crab: ["#ff5a48", "#a82420", "#ffa898"], alien: ["#9af068", "#3a9a48", "#e0ffd0"], frog: ["#58d848", "#2a8a30", "#ffe060"],
  monkey: ["#a86a38", "#6a3a18", "#f0c890"], spitter: ["#ff6030", "#8a2010", "#ffe060"], bat: ["#8a5ad0", "#5a3aa0", "#ff5a62"],
  parrot: ["#ff4848", "#2aa8ff", "#ffd840"], owl: ["#e8f4ff", "#8ab0d8", "#ffd040"], firebat: ["#ff4848", "#881828", "#ffd040"],
  ray: ["#48b8ff", "#1a68b8", "#a8f8ff"], bob: ["#7ae0f0", "#3a9ab8", "#e0fcff"], ember: ["#ffb838", "#e04818", "#fff098"],
  snake: ["#5ac838", "#2a7a28", "#ffe048"], puffer: ["#ffd848", "#c89018", "#ffffff"], hole: ["#b050ff", "#ff70d0", "#4a1a7a"],
  whirl: ["#58f0ff", "#ffffff", "#1868a8"], wind: ["#ffffff", "#c8ecff", "#88c8f0"], ufo: ["#7ac8f0", "#c8d0d8", "#7a8090"],
  frost: ["#c8f8ff", "#58b8f0", "#ffffff"], comet: ["#ffd060", "#ff7830", "#fff8d0"]
};
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
    ctx.globalAlpha = m.squish / 10;
    rect(ctx, x, y + m.h - 3, m.w, 3, pal[1]);
    ctx.globalAlpha = 1;
    return;
  }
  var k: number, b = m.b, lk = m.vx > 0 ? 1 : 0, wb = Math.floor(t / 12) % 2;
  if (m.kind === "blob" || m.kind === "magma" || m.kind === "alien" || m.kind === "crab") {
    rect(ctx, x + 2, y - 1 + wb, 8, 1, INK); rect(ctx, x - 1, y + 3, 14, 5, INK); rect(ctx, x, y + 1 + wb, 12, 3, INK);
    rect(ctx, x + 3, y + wb, 6, 1, pal[0]); rect(ctx, x + 1, y + 1 + wb, 10, 2, pal[0]); rect(ctx, x, y + 3, 12, 4, pal[0]);
    rect(ctx, x, y + 7, 12, 1, pal[1]); rect(ctx, x + 3, y + 1 + wb, 2, 1, pal[2]);
    eyes(ctx, x + 3, y + 3, 4, lk);
    if (m.kind === "crab") { rect(ctx, x - 3, y + 1 + wb, 3, 3, INK); rect(ctx, x - 2, y + 2 + wb, 2, 1, pal[0]); rect(ctx, x + 12, y + 1 + wb, 3, 3, INK); rect(ctx, x + 12, y + 2 + wb, 2, 1, pal[0]); for (k = 0; k < 3; k++) rect(ctx, x + 2 + k * 4, y + 8, 1, 1, pal[1]); }
    if (m.kind === "alien") { rect(ctx, x + 5, y - 4 + wb, 1, 4, INK); rect(ctx, x + 4, y - 5 + wb, 3, 2, "#ff5ab0"); rect(ctx, x + 5, y + 1 + wb, 2, 2, "#fff6e8"); rect(ctx, x + 5 + lk, y + 2 + wb, 1, 1, INK); }
    if (m.kind === "magma" && t % 20 < 10) rect(ctx, x + 4 + (t % 3), y + 8, 1, 2, pal[2]);
    rect(ctx, x + 5, y + 6, 2, 1, pal[1]);
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
    if (m.kind === "ray") {
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
var ITEM_COL: any = { bigcoin: "#ffd046", shield: "#5ec8ff", magnet: "#ff5a62", x2: "#62e6be", rocket: "#ff9a3a" };
function drawItemIcon(ctx: Ctx, kind: string, x: number, y: number) {
  if (kind === "bigcoin") { rect(ctx, x + 2, y + 1, 6, 8, C.gold); rect(ctx, x + 1, y + 2, 8, 6, C.gold); rect(ctx, x + 3, y + 2, 2, 2, "#fff4c0"); rect(ctx, x + 4, y + 4, 2, 3, C.goldD); }
  else if (kind === "shield") { rect(ctx, x + 2, y + 1, 6, 5, "#5ec8ff"); rect(ctx, x + 3, y + 6, 4, 2, "#5ec8ff"); rect(ctx, x + 4, y + 8, 2, 1, "#5ec8ff"); rect(ctx, x + 3, y + 2, 2, 3, "#e8fcff"); }
  else if (kind === "magnet") { rect(ctx, x + 1, y + 1, 3, 7, "#ff5a62"); rect(ctx, x + 6, y + 1, 3, 7, "#ff5a62"); rect(ctx, x + 1, y + 6, 8, 3, "#ff5a62"); rect(ctx, x + 1, y + 1, 3, 2, "#e8ecf4"); rect(ctx, x + 6, y + 1, 3, 2, "#e8ecf4"); rect(ctx, x + 4, y + 6, 2, 1, "#a82a38"); }
  else if (kind === "x2") { rect(ctx, x, y + 3, 1, 1, "#ffffff"); rect(ctx, x + 2, y + 3, 1, 1, "#ffffff"); rect(ctx, x + 1, y + 4, 1, 1, "#ffffff"); rect(ctx, x, y + 5, 1, 1, "#ffffff"); rect(ctx, x + 2, y + 5, 1, 1, "#ffffff"); drawText(ctx, "2", x + 4, y + 1, C.gold, 1, "left"); }
  else if (kind === "rocket") { rect(ctx, x + 4, y, 2, 1, "#ff5a62"); rect(ctx, x + 3, y + 1, 4, 6, "#e8ecf4"); rect(ctx, x + 4, y + 2, 2, 2, "#5ec8ff"); rect(ctx, x + 2, y + 5, 1, 3, "#ff5a62"); rect(ctx, x + 7, y + 5, 1, 3, "#ff5a62"); rect(ctx, x + 4, y + 7, 2, 2, "#ffd046"); }
}
function drawItem(ctx: Ctx, it: any, cam: number, tick: number) {
  if (it.taken) return;
  var y = Math.round(it.y - cam + Math.sin((tick + it.x) * 0.08) * 1.5), x = it.x;
  if (y < -14 || y > LH + 4) return;
  var col = ITEM_COL[it.kind] || C.gold;
  ctx.globalAlpha = 0.3 + 0.15 * Math.sin(tick * 0.15); rect(ctx, x - 2, y - 2, 14, 14, col); ctx.globalAlpha = 1;
  rect(ctx, x, y - 1, 10, 12, INK); rect(ctx, x - 1, y, 12, 10, INK);
  rect(ctx, x, y, 10, 10, "#20244a"); rect(ctx, x, y, 10, 1, col); rect(ctx, x, y + 9, 10, 1, col); rect(ctx, x, y, 1, 10, col); rect(ctx, x + 9, y, 1, 10, col);
  drawItemIcon(ctx, it.kind, x, y);
  if ((tick >> 3) % 6 === 0) rect(ctx, x + 2, y + 1, 2, 1, "#ffffff");
}
