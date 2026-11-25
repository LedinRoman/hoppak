
/* ---------------- World ---------------- */
function isPerm(t: string) { return t === "normal" || t === "move" || t === "ice" || t === "bounce" || t === "grav"; }

function mkPlat(x: number, y: number, w: number, type: string, row: number) {
  return { x: x, y: y, w: w, type: type, vx: 0, broken: false, breakT: 0, respawnT: 0, spring: false, springT: 0, row: row };
}
function findX(r: any, pw: number, row: any[]) {
  for (var t = 0; t < 24; t++) {
    var x = randInt(r, 4, LW - pw - 4);
    var ok = true;
    for (var i = 0; i < row.length; i++) {
      var o = row[i];
      if (!(x + pw + X_SEP <= o.x || x >= o.x + o.w + X_SEP)) { ok = false; break; }
    }
    if (ok) return x;
  }
  return -1;
}
function mkMob(kind: string, x: number, y: number, d: number, extra: any) {
  var M = MOBS[kind];
  var m: any = { kind: kind, b: M.b, x: x, y: y, baseX: x, baseY: y, w: M.w, h: M.h, vx: 0, alive: true, squish: 0, t: 0, d: d,
    shootT: 60, minX: 2, maxX: LW - M.w - 2, hy: 0, hvy: 0, jT: 60, cool: 0, big: false, st: "wait", cT: 60, dir: 1, amp: 0, fx: 0 };
  for (var k in extra) m[k] = extra[k];
  return m;
}
function spawnMob(w: any, row: any[], y: number, gap: number, m: number, d: number, isMove: boolean) {
  var r = w.rng;
  var normals = row.filter(function (p: any) { return isPerm(p.type) && p.type !== "move" && p.type !== "bounce" && !p.spring && p.w >= 26; });
  var solids = row.filter(function (p: any) { return isPerm(p.type); });
  var roster = mapInfo(w.map).mobs;
  var elig: any[] = [], totalW = 0;
  for (var ri = 0; ri < roster.length; ri++) {
    var k = roster[ri][0], from = roster[ri][1], M = MOBS[k];
    if (m < from) continue;
    if (M.plat) { if (isMove || !normals.length || solids.length < 2) continue; }
    if (gap < M.gap) continue;
    var lastR = w.lastMobRow[k] != null ? w.lastMobRow[k] : w.rowN - 35;
    var age = Math.max(1, w.rowN - lastR);
    var wt = 1 + Math.min(5, age / 14);
    if (m < from + 450) wt *= 1.65;
    if (M.plat) wt *= 2.2; /* platform mobs get fewer chances (need a wide solid platform), so weight them up */
    elig.push({ kind: k, wt: wt });
    totalW += wt;
  }
  if (!elig.length) return false;
  var pick = r() * totalW, kind = elig[0].kind;
  for (var ei = 0; ei < elig.length; ei++) {
    pick -= elig[ei].wt;
    if (pick <= 0) { kind = elig[ei].kind; break; }
  }
  var M2 = MOBS[kind];
  w.lastMobRow[kind] = w.rowN;
  if (M2.plat) {
    var pl = normals[Math.floor(r() * normals.length)];
    var px = pl.x + randInt(r, 1, Math.max(1, pl.w - M2.w - 1));
    var wsp = M2.b === "walk" ? M2.sp * (0.85 + d * 0.6) : 0;
    w.monsters.push(mkMob(kind, px, pl.y - M2.h, d, {
      minX: pl.x, maxX: pl.x + pl.w - M2.w, vx: r() < 0.5 ? -wsp : wsp,
      jT: randInt(r, 30, 100), shootT: randInt(r, 50, 150), dir: r() < 0.5 ? -1 : 1, t: randInt(r, 0, 100)
    }));
    return true;
  }
  var my = Math.round(y - gap / 2 - M2.h / 2);
  var mx = randInt(r, 6, LW - M2.w - 6);
  var ex: any = { shootT: randInt(r, 40, 140), t: randInt(r, 0, 200), dir: r() < 0.5 ? -1 : 1 };
  if (M2.b === "pull") {
    var best = mx, bestD = -1;
    for (var t = 0; t < 8; t++) {
      var cx = randInt(r, 10, LW - M2.w - 10);
      var dmin = 1e9;
      for (var i = 0; i < row.length; i++) {
        if (!isPerm(row[i].type)) continue;
        var dd = Math.abs(cx + 7 - (row[i].x + row[i].w / 2));
        dd = Math.min(dd, LW - dd);
        if (dd < dmin) dmin = dd;
      }
      if (dmin > bestD) { bestD = dmin; best = cx; }
    }
    mx = best;
  }
  var sp = lerp(0.4, 0.95, d) * (0.8 + r() * 0.4);
  if (M2.b === "fly" || M2.b === "shoot") ex.vx = r() < 0.5 ? -sp : sp;
  if (M2.b === "fly" && M2.dive) ex.amp = clamp(Math.floor((gap - M2.h) / 2) - 6, 0, 7);
  if (M2.b === "snake") { ex.topY = y - gap + 7; ex.botY = y - M2.h - 4; my = ex.topY + 2; }
  if (M2.b === "wind") { mx = randInt(r, 0, LW - M2.w); }
  if (M2.b === "comet") { ex.cT = randInt(r, 20, 90); }
  w.monsters.push(mkMob(kind, mx, my, d, ex));
  return true;
}
function genRow(w: any) {
  var r = w.rng, y = w.nextY, m = -y / PX_PER_M, d = difficulty(m);
  var spec = mapInfo(w.map).special;
  var row: any[] = [];
  var rowId = w.rowN++;
  var moveP = m > 80 ? lerp(0.08, 0.34, d) : 0;
  var isMove = w.lastKind !== "move" && r() < moveP;
  if (isMove) {
    var mw = Math.round(lerp(40, 26, d));
    var sp = lerp(0.35, 1.15, d) * (0.85 + r() * 0.3);
    var mp = mkPlat(randInt(r, 4, LW - mw - 4), y, mw, "move", rowId);
    mp.vx = r() < 0.5 ? -sp : sp;
    row.push(mp);
  } else {
    var n: number;
    if (m < 600) n = r() < 0.4 ? 3 : 2;
    else {
      n = r() < lerp(0.95, 0.15, (d - 0.28) / 0.72) ? 2 : 1;
      if (n === 2 && m < 1200 && r() < 0.15) n = 3;
    }
    var wmin = Math.round(lerp(42, 24, d)), wmax = Math.round(lerp(54, 32, d));
    var breakP = m > 200 ? lerp(0.04, 0.5, d) : 0;
    for (var i = 0; i < n; i++) {
      var pw = randInt(r, wmin, wmax);
      var x = findX(r, pw, row);
      if (x < 0) break;
      row.push(mkPlat(x, y, pw, r() < breakP ? "break" : "normal", rowId));
    }
    var solid = 0;
    for (var k = 0; k < row.length; k++) if (isPerm(row[k].type)) solid++;
    if (!solid) row[0].type = "normal";
    if (row.length === 1 && m > 1200 && r() < breakP * 0.8) {
      var dw = randInt(r, wmin, wmax), dx0 = findX(r, dw, row);
      if (dx0 >= 0) row.push(mkPlat(dx0, y, dw, "break", rowId));
    }
    /* map-specific platforms */
    if (spec === "ice" || spec === "bounce" || spec === "grav") {
      if (m > 25) {
        for (k = 0; k < row.length; k++) {
          if (row[k].type === "normal" && r() < 0.3) row[k].type = spec;
        }
      }
    } else if (spec === "lava" || spec === "bubble") {
      if (m > 30) {
        var added = false;
        for (k = 0; k < row.length; k++) {
          if (row[k].type === "break" && r() < 0.55) { row[k].type = spec; added = true; }
        }
        if (!added && row.length >= 2 && r() < 0.36) {
          var perms = row.filter(function (p: any) { return isPerm(p.type); });
          if (perms.length >= 2) perms[Math.floor(r() * perms.length)].type = spec;
        } else if (!added && row.length === 1 && r() < 0.28) {
          var sw = randInt(r, wmin, wmax), sx0 = findX(r, sw, row);
          if (sx0 >= 0) row.push(mkPlat(sx0, y, sw, spec, rowId));
        }
      }
    }
    if (r() < lerp(0.09, 0.045, d)) {
      var cand = row.filter(function (p: any) { return p.type === "normal" || p.type === "ice" || p.type === "grav"; });
      if (cand.length) cand[Math.floor(r() * cand.length)].spring = true;
    }
  }
  w.lastKind = isMove ? "move" : "static";
  for (var j = 0; j < row.length; j++) w.platforms.push(row[j]);

  var minG = Math.max(ROW_SEP, Math.floor(JUMP_H * lerp(0.28, 0.56, d)));
  var maxG = Math.min(GAP_CAP, Math.floor(JUMP_H * lerp(0.44, 0.77, d)));
  if (minG > maxG) minG = maxG;
  var gap = randInt(r, minG, maxG);

  var pMon = m < 120 ? 0 : m < 400 ? 0.065 : lerp(0.08, 0.28, d);
  var mob = r() < pMon ? spawnMob(w, row, y, gap, m, d, isMove) : false;
  var bonus = false;
  if (!mob && m >= w.nextBonusM && gap >= 26) {
    var tw = 0, bi: number;
    for (bi = 0; bi < BONUSES.length; bi++) tw += BONUSES[bi].wt;
    var bp = r() * tw, bk = BONUSES[0].id;
    for (bi = 0; bi < BONUSES.length; bi++) { bp -= BONUSES[bi].wt; if (bp <= 0) { bk = BONUSES[bi].id; break; } }
    w.items.push({ kind: bk, x: randInt(r, 8, LW - 18), y: Math.round(y - gap / 2 - 5), taken: false });
    w.nextBonusM = m + randInt(r, 200, 300);
    bonus = true;
  }
  if (bonus) {} else if (!isMove && !mob && r() < 0.4) {
    var cps = row.filter(function (p: any) { return isPerm(p.type); });
    if (cps.length) {
      var cp = cps[Math.floor(r() * cps.length)];
      w.coins.push({ x: Math.round(cp.x + cp.w / 2 - 3), y: y - 13, taken: false });
    }
  } else if (!mob && gap >= 30 && r() < 0.12) {
    var cx = randInt(r, 6, LW - 30);
    for (var q = 0; q < 3; q++) w.coins.push({ x: cx + q * 9, y: Math.round(y - gap / 2 - 3), taken: false });
  }
  w.nextY -= gap;
}
function generateUntil(w: any, upToY: number) {
  var g = 0;
  while (w.nextY > upToY && g++ < 4000) genRow(w);
}
function botKinds(human: number) {
  var out: number[] = [];
  for (var k = 0; k < CHARS.length && out.length < 3; k++) if (k !== human) out.push(k);
  return out;
}
function newPlayer(i: number, kind: number, look: any, x: number, isBot: boolean) {
  return {
    id: i, kind: kind, name: CHARS[kind].name, look: look,
    x: x, y: -PH, vx: 0, vy: 0, prevY: -PH, alive: true, maxH: 0, isBot: isBot,
    face: 1, squash: 0, iceT: 0, gravT: 0, camY: -LH + 70, place: 0, why: "",
    bias: [0, -14, 14, 6][i], react: [1, 3, 4, 5][i], tgt: null, botDir: 0,
    abCharge: CHARS[kind].need, abFx: 0, hookT: 0, hookN: 0, hx0: 0, hy0: 0, htx: 0, hty: 0, hookPl: null, hookCoin: null,
    domeT: 0, domeSave: false, kills: 0, shieldT: 0, magnetT: 0, x2T: 0, rocketT: 0, invT: 0, freezeT: 0, grabT: 0, grabMob: null, dashT: 0, poundT: 0, wallT: 0, wall: 0, teleFx: 0
  };
}
function createWorld(seed: number, mode: string, humanKind: number, humanLook: any, mapId?: string) {
  var w: any = {
    seed: seed >>> 0, rng: mulberry32(seed >>> 0), mode: mode, map: mapInfo(mapId || "city").id,
    platforms: [], monsters: [], bullets: [], coins: [], items: [], particles: [],
    nextY: -24, rowN: 1, lastKind: "", lastMobRow: {}, cameraY: -LH + 70, tick: 0, shake: 0,
    phase: "play", players: [], finishWait: 0, runCoins: 0, bonusCoins: 0, paid: false, freezeMobT: 0, toast: "", toastT: 0, nextBonusM: 0
  };
  w.nextBonusM = randInt(w.rng, 160, 240);
  w.platforms.push(mkPlat(8, 0, LW - 16, "normal", 0));
  var xs = mode === "squad" ? [74, 22, 124, 48] : [74];
  w.players.push(newPlayer(0, humanKind, humanLook, xs[0], false));
  if (mode === "squad") {
    var bk = botKinds(humanKind);
    for (var i = 1; i < 4; i++) w.players.push(newPlayer(i, bk[i - 1], makeLook(bk[i - 1], "base", "none"), xs[i], true));
  }
  generateUntil(w, w.cameraY - 80);
  return w;
}

function spawnParts(w: any, x: number, y: number, n: number, col: string, spr: number, g: number, sz?: number) {
  for (var i = 0; i < n; i++) {
    var life = 14 + Math.floor(Math.random() * 14);
    w.particles.push({
      x: x, y: y, vx: (Math.random() - 0.5) * spr, vy: (Math.random() - 0.8) * spr,
      life: life, max: life, col: col, s: sz || (Math.random() < 0.4 ? 2 : 1), g: g
    });
  }
}
function overlapsX(ax: number, aw: number, bx: number, bw: number) {
  function hit(a: number, b: number) { return a + aw > b && a < b + bw; }
  return hit(ax, bx) || hit(ax + LW, bx) || hit(ax - LW, bx);
}
function wrapDx(dx: number) { if (dx > LW / 2) dx -= LW; if (dx < -LW / 2) dx += LW; return dx; }

function botDir(p: any, w: any) {
  if (!p.alive) return 0;
  var pcx = p.x + PW / 2;
  for (var di = 0; di < w.monsters.length; di++) {
    var dm = w.monsters[di];
    if (!dm.alive || dm.b === "pull" || dm.b === "wind") continue;
    var above = p.y - (dm.y + dm.h);
    if (above < -PH || above > (p.vy < 0 ? 84 : 30)) continue;
    if (p.vy > 0 && dm.y > p.y + PH - 6) continue;
    var tt = p.vy < 0 ? Math.min(14, Math.max(0, above) / Math.max(1, -p.vy)) : 4;
    var ddx = wrapDx(dm.x + (dm.vx || 0) * tt + dm.w / 2 - pcx);
    if (Math.abs(ddx) < dm.w / 2 + PW / 2 + 6) { p.botDir = ddx > 0 ? -1 : 1; return p.botDir; }
  }
  for (var bi = 0; bi < w.bullets.length; bi++) {
    var bu = w.bullets[bi];
    var ab = p.y - bu.y;
    if (ab > 0 && ab < 60 && Math.abs(wrapDx(bu.x - pcx)) < 10) { p.botDir = bu.x > pcx ? -1 : 1; return p.botDir; }
  }
  if (w.tick % p.react !== 0 && p.tgt && !p.tgt.broken) return p.botDir;
  var best: any = null, bestS = -1e9;
  var cx = p.x + PW / 2;
  for (var i = 0; i < w.platforms.length; i++) {
    var pl = w.platforms[i];
    if (pl.broken) continue;
    var base = p.baseY != null ? p.baseY : p.y + PH;
    if (pl.y >= base - 2 || pl.y < base - JUMP_H + 5) continue;
    if (p.vy > 0 && pl.y < p.y + PH - 2) continue;
    var mid = pl.x + pl.w / 2 + (pl.type === "move" ? pl.vx * 12 : 0);
    var dx = wrapDx(mid - cx);
    var s = -pl.y * 2.2 - Math.abs(dx + p.bias * 0.3) * 0.55;
    if (w.tick < 100) s -= Math.abs(dx) * 0.8;
    if (!isPerm(pl.type)) s -= 14;
    if (pl.type === "bounce" || pl.type === "grav") s += 14;
    if (pl.spring) s += 24;
    for (var o = 0; o < w.players.length; o++) {
      var op = w.players[o];
      if (op !== p && op.alive && op.isBot && op.tgt === pl) s -= 16;
    }
    for (var mi = 0; mi < w.monsters.length; mi++) {
      var mo = w.monsters[mi];
      if (!mo.alive || mo.b === "wind") continue;
      var near = mo.b === "pull" ? 44 : 22;
      if (Math.abs(mo.y - pl.y) < near + 6 && Math.abs(wrapDx(mo.x + mo.w / 2 - mid)) < near) s -= mo.b === "pull" ? 140 : 70;
      else if (mo.b !== "pull" && mo.y + mo.h > pl.y - 4 && mo.y < base && Math.abs(wrapDx(mo.x + mo.w / 2 - (mid + cx) / 2)) < 26) s -= 55;
    }
    if (s > bestS) { bestS = s; best = pl; }
  }
  p.tgt = best;
  if (!best) {
    var fb: any = null, fs = 1e9;
    for (var fi = 0; fi < w.platforms.length; fi++) {
      var fq = w.platforms[fi];
      if (fq.broken || fq.y < p.y + PH - 2 || fq.y > p.y + PH + 120) continue;
      var fd = Math.abs(wrapDx(fq.x + fq.w / 2 - cx)) + (fq.y - p.y) * 0.3;
      if (fd < fs) { fs = fd; fb = fq; }
    }
    best = fb;
    if (!best) return 0;
  }
  var target = best.x + best.w / 2 + (best.type === "move" ? best.vx * 12 : 0);
  var d = wrapDx(target - cx);
  p.botDir = Math.abs(d) < 2.5 ? 0 : d < 0 ? -1 : 1;
  return p.botDir;
}

function killPlayer(w: any, p: any, why: string) {
  if (!p.alive) return;
  p.alive = false;
  p.vy = -2.5;
  p.why = why;
  p.grabT = 0; p.wallT = 0; p.wall = 0;
  spawnParts(w, p.x + 6, p.y + 8, 14, p.look.hood, 2.8, 0.1);
  if (p.id === 0) w.shake = 8;
}
function invuln(p: any) { return p.invT > 0 || p.rocketT > 0 || p.dashT > 0 || p.poundT > 0 || p.domeT > 0; }
function useShield(w: any, p: any) {
  if (p.shieldT <= 0) return false;
  p.shieldT = 0;
  p.invT = 60;
  spawnParts(w, p.x + 6, p.y + 8, 14, "#8ae8ff", 2.6, 0.02, 2);
  if (p.id === 0) { w.shake = 4; toast(w, "ЩИТ СПАС!"); }
  return true;
}
/* any harmful touch: shield absorbs one hit, otherwise KO */
function hurt(w: any, p: any, why: string, mo: any) {
  if (!p.alive || invuln(p)) return;
  if (useShield(w, p)) { if (mo && mo.b !== "pull") killMob(w, mo, p, true); if (why === "hole") p.vy = JUMP_V * 1.1; return; }
  killPlayer(w, p, why === "mob" && mo && mo.kind ? "mob:" + mo.kind : why);
}
function freezePlayer(w: any, p: any) {
  if (!p.alive || invuln(p)) return;
  if (useShield(w, p)) return;
  p.freezeT = 75;
  spawnParts(w, p.x + 6, p.y + 6, 10, "#c8f8ff", 2, 0.02, 1);
  if (p.id === 0) toast(w, "ЗАМОРОЗКА!");
}
function grabPlayer(w: any, p: any, mo: any) {
  if (!p.alive || invuln(p) || mo.cool > 0) return;
  if (useShield(w, p)) { killMob(w, mo, p, true); return; }
  p.grabT = 45; p.grabMob = mo; mo.cool = 160;
  if (p.id === 0) toast(w, "ЗМЕЯ СХВАТИЛА!");
}
function toast(w: any, s: string) { w.toast = s; w.toastT = 70; }
function landOn(w: any, p: any, pl: any) {
  p.y = pl.y - PH;
  p.baseY = pl.y;
  p.squash = 7;
  var spr = pl.spring && overlapsX(p.x + 2, PW - 4, pl.x + pl.w / 2 - 5, 10);
  if (spr) {
    p.vy = SPRING_V;
    pl.springT = 10;
    if (p.id === 0) w.shake = 6;
    spawnParts(w, p.x + 6, pl.y - 4, 8, "#fff0a0", 2.6, 0.05);
  } else if (pl.type === "bounce") {
    p.vy = -7.3;
    pl.springT = 9;
    spawnParts(w, p.x + 6, pl.y - 2, 8, "#8af860", 2.4, 0.04);
  } else if (pl.type === "lava") {
    p.vy = -6.7;
    pl.broken = true;
    pl.breakT = 14;
    if (p.id === 0) w.shake = 4;
    spawnParts(w, pl.x + pl.w / 2, pl.y, 10, "#ff9030", 2.6, 0.12, 2);
  } else if (pl.type === "bubble") {
    p.vy = -6.9;
    pl.broken = true;
    pl.breakT = 10;
    pl.respawnT = 75;
    spawnParts(w, pl.x + pl.w / 2, pl.y, 10, "#88f8ff", 2.2, -0.04, 2);
  } else if (pl.type === "grav") {
    p.vy = -6.3;
    p.gravT = 36;
    pl.springT = 8;
    spawnParts(w, p.x + 6, pl.y - 2, 9, "#c088ff", 2.4, -0.02);
  } else {
    p.vy = JUMP_V;
    if (pl.type === "ice") {
      p.iceT = 32;
      if (Math.abs(p.vx) > 0.2) p.vx = clamp(p.vx * 1.15, -MAX_VX * 1.15, MAX_VX * 1.15);
      spawnParts(w, p.x + 6, pl.y, 6, "#c0f8ff", 1.8, 0.02, 1);
    } else {
      spawnParts(w, p.x + 2, pl.y, 2, "rgba(255,245,220,0.85)", 1.2, -0.01, 1);
      spawnParts(w, p.x + 10, pl.y, 2, "rgba(255,245,220,0.85)", 1.2, -0.01, 1);
    }
  }
  if (p.poundT > 0) {
    p.poundT = 0;
    p.vy = Math.min(p.vy, JUMP_V * 1.42); /* risk -> reward: ~2x normal jump height */
    if (p.id === 0) w.shake = 7;
    spawnParts(w, p.x + 6, pl.y, 14, "#ffd046", 3, 0.1, 2);
  }
  if (pl.type === "break" && !pl.broken) {
    pl.broken = true;
    pl.breakT = 14;
    spawnParts(w, pl.x + pl.w / 2, pl.y + 2, 10, C.brk, 2.2, 0.22, 2);
    spawnParts(w, pl.x + pl.w / 2, pl.y + 2, 4, C.brkRim, 1.6, 0.22, 1);
  }
}
function killMob(w: any, mo: any, p: any, noBounce?: boolean) {
  if (!mo.alive) return;
  mo.alive = false;
  mo.squish = 10;
  if (!noBounce) { p.vy = STOMP_V; p.y = mo.y - PH; }
  p.kills++;
  addCharge(p, "kills", 1);
  var pal = MOBPAL[mo.kind] || ["#ffd070"];
  spawnParts(w, mo.x + mo.w / 2, mo.y + 4, 12, pal[0], 2.6, 0.15);
  if (p.id === 0) w.shake = 5;
}
function mobBox(mo: any) {
  if (mo.b === "puff" && mo.big) return [mo.x - 3, mo.y - 3, mo.w + 6, mo.h + 6];
  return [mo.x, mo.y, mo.w, mo.h];
}
/* motion envelope of a mob (for tests: must not cross platforms) */
function mobEnv(mo: any) {
  var b = mo.b, M = MOBS[mo.kind];
  if (M.plat) return [mo.minX, mo.baseY - (b === "hop" ? 15 : 0), mo.maxX + mo.w, mo.baseY + mo.h];
  if (b === "fly") return [0, mo.baseY - mo.amp - (mo.amp ? 0 : 0), LW, mo.baseY + mo.h + mo.amp + 1];
  if (b === "sway") return [0, mo.baseY - 4, LW, mo.baseY + mo.h + 4];
  if (b === "snake") return [mo.x, mo.topY, mo.x + mo.w, mo.botY + mo.h];
  if (b === "puff") return [0, mo.baseY - 5, LW, mo.baseY + mo.h + 5];
  if (b === "shoot") return [0, mo.baseY - (M.freeze ? 3 : 0), LW, mo.baseY + mo.h + (M.freeze ? 3 : 0)];
  if (b === "comet" || b === "wind") return [0, mo.baseY, LW, mo.baseY + mo.h];
  return [mo.x, mo.y, mo.x + mo.w, mo.y + mo.h];
}
function abReady(p: any) { return p.abCharge >= CHARS[p.kind].need; }
function addCharge(p: any, kind: string, n: number) {
  var H = CHARS[p.kind];
  if (H.charge === kind) p.abCharge = Math.min(H.need, p.abCharge + n);
}
/* pirate hook: nearest platform (above feet) or coin in reach, any direction */
function hookTarget(w: any, p: any) {
  var cx = p.x + PW / 2, cy = p.y + PH / 2, best: any = null, bd = 1e9, i;
  for (i = 0; i < w.platforms.length; i++) {
    var pl = w.platforms[i];
    if (pl.broken || pl.y > p.y + PH - 6 || pl.y < cy - 125) continue;
    var dx = wrapDx(pl.x + pl.w / 2 - cx), dy = pl.y - PH / 2 - cy, d = Math.sqrt(dx * dx + dy * dy);
    if (d < 16 || d > 120) continue;
    var sc = d - Math.min(40, -dy) * 0.5;
    if (sc < bd) { bd = sc; best = { x: cx + dx, y: pl.y - PH, pl: pl, coin: null }; }
  }
  for (i = 0; i < w.coins.length; i++) {
    var cn = w.coins[i];
    if (cn.taken) continue;
    var cdx = wrapDx(cn.x + 3 - cx), cdy = cn.y + 3 - cy, cd = Math.sqrt(cdx * cdx + cdy * cdy);
    if (cd < 10 || cd > 100) continue;
    if (cd - 8 < bd) { bd = cd - 8; best = { x: cx + cdx, y: cn.y + 3 - PH / 2, pl: null, coin: cn }; }
  }
  return best;
}
function useAbility(w: any, p: any) {
  if (!p.alive || !abReady(p)) return false;
  var H = CHARS[p.kind] || CHARS[0];
  var col = p.look.hood, i;
  if (H.ab === "hook") {
    var tg = hookTarget(w, p);
    if (!tg) { if (p.id === 0) toast(w, "НЕТ ЦЕЛИ"); return false; }
    p.hookT = 0; p.hx0 = p.x; p.hy0 = p.y; p.htx = tg.x - PW / 2; p.hty = tg.y; p.hookPl = tg.pl; p.hookCoin = tg.coin;
    var hd = Math.sqrt(Math.pow(p.htx - p.x, 2) + Math.pow(p.hty - p.y, 2));
    p.hookN = Math.round(clamp(hd / 5, 10, 22));
    p.grabT = 0; p.poundT = 0;
  }
  else if (H.ab === "tele") {
    /* the highest SOLID platform within ~1.5 jumps above, visible, with no mob standing on it */
    var best: any = null;
    for (i = 0; i < w.platforms.length; i++) {
      var q = w.platforms[i];
      if (q.broken || !isPerm(q.type) || q.type === "move" || q.lifeT) continue;
      if (q.y > p.y - 24 || q.y < p.y + PH - JUMP_H * 1.5 || q.y < p.camY + 14) continue;
      var busy = false;
      for (var mi = 0; mi < w.monsters.length; mi++) { var mo = w.monsters[mi]; if (mo.alive && Math.abs(mo.y + mo.h - q.y) < 22 && overlapsX(mo.x - 4, mo.w + 8, q.x, q.w)) busy = true; }
      if (!busy && (!best || q.y < best.y)) best = q;
    }
    if (!best) { if (p.id === 0) toast(w, "НЕТ ПЛАТФОРМЫ"); return false; }
    spawnParts(w, p.x + 6, p.y + 8, 14, "#c890ff", 2.4, 0, 2);
    p.x = clamp(best.x + best.w / 2 - PW / 2, 0, LW - PW); p.y = best.y - PH; p.prevY = p.y; p.vy = JUMP_V; p.vx = 0; p.squash = 6;
    p.invT = Math.max(p.invT, 30); p.grabT = 0; p.poundT = 0; p.teleFx = 18;
    spawnParts(w, p.x + 6, p.y + 8, 16, "#e8c8ff", 2.6, 0, 2);
  }
  else if (H.ab === "wall") { p.wallT = 300; p.wall = 0; spawnParts(w, p.x + 6, p.y + 8, 10, "#d82a2a", 2, 0, 1); }
  else if (H.ab === "dash") { p.vy = Math.min(p.vy, -6.6); p.vx = clamp(p.vx + p.face * 1.6, -MAX_VX * 1.3, MAX_VX * 1.3); p.dashT = 14; p.grabT = 0; spawnParts(w, p.x + 6, p.y + PH, 12, "#7ad8ff", 2.4, 0.08, 2); }
  else if (H.ab === "dome") { p.domeT = 200; p.domeSave = true; spawnParts(w, p.x + 6, p.y + 8, 14, "#7ad8ff", 2.6, 0, 1); }
  else if (H.ab === "pound") { p.poundT = 1; p.vy = 7.5; p.grabT = 0; spawnParts(w, p.x + 6, p.y, 8, "#ffd046", 2, -0.05, 1); }
  p.abCharge = 0;
  p.abFx = 16;
  if (p.id === 0) toast(w, H.abName + "!");
  return true;
}
function botWantsAb(w: any, p: any) {
  if (!p.alive || !abReady(p)) return false;
  var ab = CHARS[p.kind].ab;
  if (p.grabT > 0) return ab === "dash" || ab === "hook";
  if (ab === "pound" || ab === "wall") return false;
  if (ab === "dome") return w.tick % 200 === p.id * 41;
  return p.vy > 1.2 && p.y > p.camY + LH * 0.7;
}
function pickItem(w: any, p: any, it: any) {
  it.taken = true;
  spawnParts(w, it.x + 5, it.y + 5, 12, "#fff4c0", 2.4, 0, 1);
  var B: any = null;
  for (var i = 0; i < BONUSES.length; i++) if (BONUSES[i].id === it.kind) B = BONUSES[i];
  if (!B) return;
  if (B.id === "bigcoin") w.bonusCoins += BIGCOIN;
  else if (B.id === "shield") p.shieldT = B.t;
  else if (B.id === "magnet") p.magnetT = Math.max(p.magnetT, B.t);
  else if (B.id === "x2") p.x2T = B.t;
  else if (B.id === "rocket") { p.rocketT = B.t; p.grabT = 0; p.poundT = 0; p.invT = Math.max(p.invT, B.t + 40); }
  toast(w, B.id === "bigcoin" ? "КЛАД +" + BIGCOIN : B.name + "!");
  if (p.id === 0) w.shake = 3;
}

function tickWorld(w: any, inputs: any) {
  w.tick++;
  if (w.shake > 0) w.shake--;
  if (w.toastT > 0) w.toastT--;
  var sf = 1;
  var mobFrozen = w.freezeMobT > 0;
  if (w.freezeMobT > 0) w.freezeMobT--;
  var i, k;
  for (i = 0; i < w.platforms.length; i++) {
    var pl = w.platforms[i];
    if (pl.type === "move") {
      pl.x += pl.vx * sf;
      if (pl.x < 2) { pl.x = 2; pl.vx = Math.abs(pl.vx); }
      if (pl.x + pl.w > LW - 2) { pl.x = LW - 2 - pl.w; pl.vx = -Math.abs(pl.vx); }
    }
    if (pl.broken && pl.breakT > 0) pl.breakT--;
    if (pl.respawnT > 0 && --pl.respawnT === 0) { pl.broken = false; spawnParts(w, pl.x + pl.w / 2, pl.y, 4, "#88f8ff", 1.2, -0.02, 1); }
    if (pl.springT > 0) pl.springT--;
    if (pl.lifeT > 0 && --pl.lifeT === 0) { pl.broken = true; pl.breakT = 0; }
  }
  function nearPlayer(mo: any) {
    for (var q = 0; q < w.players.length; q++) if (w.players[q].alive && Math.abs(w.players[q].y - mo.y) < LH * 0.8) return true;
    return false;
  }
  for (i = 0; i < w.monsters.length; i++) {
    var mo = w.monsters[i];
    mo.t += sf;
    if (mo.fx > 0) mo.fx--;
    if (mo.cool > 0) mo.cool -= sf;
    if (!mo.alive) { if (mo.squish > 0) mo.squish--; continue; }
    if (mobFrozen) { mo.t -= sf; continue; }
    var b = mo.b;
    if (b === "walk") {
      mo.x += mo.vx * sf;
      if (mo.x < mo.minX) { mo.x = mo.minX; mo.vx = Math.abs(mo.vx); }
      if (mo.x > mo.maxX) { mo.x = mo.maxX; mo.vx = -Math.abs(mo.vx); }
    } else if (b === "hop") {
      if (mo.hy === 0 && mo.hvy === 0) {
        mo.jT -= sf;
        if (mo.jT <= 0) {
          mo.hvy = -1.8; mo.jT = 60 + ((mo.t * 7) % 40);
          if (mo.x <= mo.minX + 2) mo.dir = 1; else if (mo.x >= mo.maxX - 2) mo.dir = -1; else if (((mo.t * 13) | 0) % 3 === 0) mo.dir = -mo.dir;
          mo.vx = 0.4 * mo.dir;
        }
      } else {
        mo.hy += mo.hvy * sf; mo.hvy += 0.12 * sf;
        mo.x = clamp(mo.x + mo.vx * sf, mo.minX, mo.maxX);
        if (mo.hy >= 0) { mo.hy = 0; mo.hvy = 0; mo.vx = 0; }
      }
      mo.y = mo.baseY + Math.round(mo.hy);
    } else if (b === "throw" || b === "spit") {
      mo.shootT -= sf;
      if (mo.shootT <= 0) {
        mo.shootT = Math.round(lerp(170, 115, mo.d));
        if (nearPlayer(mo)) {
          mo.fx = 14;
          if (b === "throw") { mo.dir = -mo.dir; w.bullets.push({ kind: "nut", x: mo.x + 6, y: mo.y - 2, vx: 0.45 * mo.dir, vy: -3.1, g: 0.075, life: 260 }); }
          else w.bullets.push({ kind: "fire", x: mo.x + 6, y: mo.y - 3, vx: 0, vy: -3.5, g: 0.065, life: 260 });
        }
      }
    } else if (b === "fly") {
      mo.x += mo.vx * sf;
      if (mo.x < mo.minX) { mo.x = mo.minX; mo.vx = Math.abs(mo.vx); }
      if (mo.x > mo.maxX) { mo.x = mo.maxX; mo.vx = -Math.abs(mo.vx); }
      mo.y = mo.baseY + (mo.amp ? Math.round(Math.sin(mo.t * 0.06) * mo.amp) : Math.floor(mo.t / 8) % 2);
    } else if (b === "sway") {
      mo.y = mo.baseY + Math.round(Math.sin(mo.t * 0.045) * 3.5);
      mo.x = clamp(mo.baseX + Math.sin(mo.t * 0.02) * 14, 2, LW - mo.w - 2);
    } else if (b === "snake") {
      var ph = mo.t % 170, f = 0;
      if (ph < 70) f = 0; else if (ph < 84) f = (ph - 70) / 14; else if (ph < 120) f = 1; else f = 1 - (ph - 120) / 50;
      mo.y = Math.round(mo.topY + 2 + f * (mo.botY - mo.topY - 2));
    } else if (b === "puff") {
      mo.y = mo.baseY + Math.round(Math.sin(mo.t * 0.04) * 1.5);
      mo.x = clamp(mo.baseX + Math.sin(mo.t * 0.015) * 12, 4, LW - mo.w - 4);
      mo.big = mo.t % 170 > 110;
    } else if (b === "wind") {
      mo.x = mod(mo.x + mo.dir * 0.5 * sf, LW);
    } else if (b === "shoot") {
      mo.x += mo.vx * sf;
      if (mo.x < mo.minX) { mo.x = mo.minX; mo.vx = Math.abs(mo.vx); }
      if (mo.x > mo.maxX) { mo.x = mo.maxX; mo.vx = -Math.abs(mo.vx); }
      if (MOBS[mo.kind].freeze) mo.y = mo.baseY + Math.round(Math.sin(mo.t * 0.05) * 2);
      mo.shootT -= sf;
      if (mo.shootT <= 0) {
        mo.shootT = Math.round(lerp(170, 95, mo.d));
        if (nearPlayer(mo)) {
          if (MOBS[mo.kind].freeze) w.bullets.push({ kind: "ice", x: mo.x + 6, y: mo.y + 11, vx: 0, vy: 1.2, g: 0, life: 240 });
          else w.bullets.push({ kind: "shot", x: mo.x + 6, y: mo.y + 8, vx: 0, vy: 1.3, g: 0, life: 240 });
        }
      }
    } else if (b === "comet") {
      mo.cT -= sf;
      if (mo.st === "wait") { if (mo.cT <= 0) { mo.st = "go"; mo.cT = 80; mo.vx = 2.6 * mo.dir; } }
      else {
        mo.x = mod(mo.x + mo.vx * sf + 6, LW + 12) - 6;
        if (mo.cT <= 0) { mo.st = "wait"; mo.cT = 75; mo.vx = 0; mo.dir = -mo.dir; }
      }
    }
  }
  for (i = w.bullets.length - 1; i >= 0; i--) {
    var bu = w.bullets[i];
    for (k = 0; k < w.players.length; k++) {
      var dp = w.players[k];
      if (dp.alive && dp.domeT > 0 && Math.abs(wrapDx(bu.x - (dp.x + 6))) < 20 && Math.abs(bu.y - (dp.y + 8)) < 20) { bu.life = 0; spawnParts(w, bu.x, bu.y, 4, "#7ad8ff", 1.6, 0, 1); }
    }
    bu.x += (bu.vx || 0) * sf; bu.y += bu.vy * sf; bu.vy += (bu.g || 0) * sf;
    if (--bu.life <= 0) w.bullets.splice(i, 1);
  }
  for (i = 0; i < w.items.length; i++) w.items[i].t = (w.items[i].t || 0) + 1;

  for (var pi = 0; pi < w.players.length; pi++) {
    var p = w.players[pi];
    if (!p.alive) { if (p.y < p.camY + LH + 60) { p.vy = Math.min(p.vy + GRAVITY, 5); p.y += p.vy; } continue; }
    p.prevY = p.y;
    if (p.iceT > 0) p.iceT--;
    if (p.gravT > 0) p.gravT--;
    addCharge(p, "time", 1);
    if (p.domeT > 0) p.domeT--;
    if (p.abFx > 0) p.abFx--;
    if (p.shieldT > 0) p.shieldT--;
    if (p.magnetT > 0) p.magnetT--;
    if (p.x2T > 0) p.x2T--;
    if (p.invT > 0) p.invT--;
    if (p.freezeT > 0) p.freezeT--;
    if (p.dashT > 0) p.dashT--;
    var inp = inputs[p.id] || { dir: 0, ax: 0 };
    if (p.teleFx > 0) p.teleFx--;
    if (p.wallT > 0) { p.wallT--; if (p.wallT === 0) p.wall = 0; }
    /* ninja on a wall: tap the ability button or press away from the wall -> kick up and away */
    if (p.wall && (inp.ab || (inp.dir || 0) === -p.wall || (inp.ax && Math.sign(inp.ax) === -p.wall && Math.abs(inp.ax) > 0.3))) {
      var wsd = p.wall;
      p.vy = JUMP_V * 0.97; p.vx = -wsd * 2.6; p.face = -wsd; p.wall = 0; p.squash = 4; p.x += -wsd * 2;
      spawnParts(w, wsd < 0 ? 1 : LW - 1, p.y + 10, 6, "#d8f0ff", 1.6, 0.05, 1);
    } else if (inp.ab) useAbility(w, p);
    if (p.hookN > 0) {
      p.hookT++;
      var u = p.hookT / p.hookN, hdx = p.htx - p.hx0, hdy = p.hty - p.hy0;
      var arc = Math.min(26, Math.sqrt(hdx * hdx + hdy * hdy) * 0.3) * Math.sin(Math.PI * u);
      var nx = p.hx0 + hdx * u, ny = p.hy0 + hdy * u - arc;
      p.vx = nx - p.x; p.vy = ny - p.y;
      p.x = nx; p.y = ny;
      if (p.x < -PW) p.x += LW; if (p.x > LW) p.x -= LW;
      if (hdx) p.face = hdx > 0 ? 1 : -1;
      for (k = 0; k < w.monsters.length; k++) {
        var hm = w.monsters[k];
        if (!hm.alive || hm.b === "wind") continue;
        var hb = mobBox(hm);
        if (overlapsX(p.x - 2, PW + 4, hb[0], hb[2]) && p.y - 2 < hb[1] + hb[3] && p.y + PH + 2 > hb[1]) killMob(w, hm, p, true);
      }
      if (p.hookT >= p.hookN) {
        p.hookN = 0;
        if (p.hookPl && !p.hookPl.broken) { p.x = p.htx; landOn(w, p, p.hookPl); }
        else p.vy = -3.2;
        p.vx *= 0.3;
      }
      var hmh = Math.max(0, -(p.y + PH));
      if (hmh > p.maxH) { addCharge(p, "height", (hmh - p.maxH) / PX_PER_M); p.maxH = hmh; }
      if (!p.isBot) for (k = 0; k < w.coins.length; k++) {
        var hc = w.coins[k];
        if (!hc.taken && overlapsX(p.x - 2, PW + 4, hc.x, 6) && hc.y + 6 > p.y - 2 && hc.y < p.y + PH + 2) { hc.taken = true; w.runCoins += p.x2T > 0 ? 2 : 1; addCharge(p, "coins", 1); spawnParts(w, hc.x + 3, hc.y + 3, 6, "#ffe07a", 1.8, 0, 1); }
      }
      continue;
    }
    if (p.grabT > 0) {
      var gm = p.grabMob;
      p.grabT--;
      if (gm && gm.alive) { p.x = gm.x - 1; p.y = gm.y + gm.h - 3; }
      p.vx = 0; p.vy = 0;
      if (p.grabT === 0) { p.vy = 1.2; p.invT = Math.max(p.invT, 30); }
      continue;
    }
    var dir = inp.dir || 0;
    if (p.freezeT > 0) { dir = 0; p.vx *= 0.9; }
    else if (inp.ax) {
      p.vx = lerp(p.vx, MAX_VX * clamp(inp.ax, -1, 1), 0.22);
      dir = inp.ax < -0.12 ? -1 : inp.ax > 0.12 ? 1 : 0;
    } else if (dir) {
      var acc = dir * p.vx < 0 ? TURN_ACCEL : ACCEL;
      var cap = p.iceT > 0 ? MAX_VX * 1.15 : MAX_VX;
      p.vx = clamp(p.vx + dir * acc, -cap, cap);
    } else {
      p.vx *= p.iceT > 0 ? ICE_FRIC : AIR_FRIC;
      if (Math.abs(p.vx) < 0.04) p.vx = 0;
    }
    if (dir) p.face = dir;
    for (k = 0; k < w.monsters.length; k++) {
      var h = w.monsters[k];
      if (!h.alive) continue;
      if (h.b === "wind") {
        if (!mobFrozen && Math.abs(h.baseY + 5 - (p.y + PH / 2)) < 16) p.vx = clamp(p.vx + h.dir * 0.075, -MAX_VX * 1.3, MAX_VX * 1.3);
        continue;
      }
      if (h.b !== "pull" || p.rocketT > 0 || mobFrozen) continue;
      var hx = wrapDx(h.x + 7 - (p.x + PW / 2)), hy = h.y + 7 - (p.y + PH / 2);
      var dist = Math.sqrt(hx * hx + hy * hy);
      if (dist < 6) { hurt(w, p, "hole", h); if (!p.alive) break; continue; }
      if (dist < 36 && !invuln(p)) {
        var fpull = 0.11 * (1 - dist / 36);
        p.vx += (hx / dist) * fpull;
        p.vy += (hy / dist) * fpull * 0.6;
      }
    }
    if (!p.alive) continue;
    var grav = p.gravT > 0 ? GRAVITY * 0.72 : GRAVITY;
    if (p.dashT > 0 && w.tick % 2 === 0) spawnParts(w, p.x + 6 - p.face * 4, p.y + PH, 2, w.tick % 4 ? "#7ad8ff" : "#d8f8ff", 1.2, 0.08, 2);
    if (p.rocketT > 0) {
      p.rocketT--;
      p.vy = -8.2;
      if (w.tick % 2 === 0) spawnParts(w, p.x + 6, p.y + PH + 2, 2, w.tick % 4 ? "#ffd046" : "#ff7830", 1.2, 0.1, 2);
    } else if (p.poundT > 0) p.vy = Math.max(p.vy, 7.5);
    else p.vy = Math.min(p.vy + grav, 6.5);
    p.x += p.vx;
    p.y += p.vy;
    if (p.wallT > 0) {
      /* no wrap-around while the ninja ability is on: stick to the screen edge and slide */
      if (p.x <= 0 && p.vx <= 0) { p.x = 0; if (p.wall !== -1) { p.wall = -1; p.face = -1; } }
      else if (p.x >= LW - PW && p.vx >= 0) { p.x = LW - PW; if (p.wall !== 1) { p.wall = 1; p.face = 1; } }
      else if (p.x > 1 && p.x < LW - PW - 1) p.wall = 0;
      if (p.wall) { p.vx = 0; if (p.vy > 0.9) p.vy = 0.9; if (w.tick % 5 === 0) spawnParts(w, p.wall < 0 ? 1 : LW - 2, p.y + PH - 2, 1, "#e8e0d0", 0.6, 0.02, 1); }
    } else {
      if (p.x < -PW) p.x += LW;
      if (p.x > LW) p.x -= LW;
    }
    if (p.squash > 0) p.squash--;
    if (p.vy > 0) {
      var feet = p.y + PH, pf = p.prevY + PH;
      for (k = 0; k < w.platforms.length; k++) {
        var q = w.platforms[k];
        if (q.broken) continue;
        if (pf <= q.y + 3 && feet >= q.y && overlapsX(p.x + 1, PW - 2, q.x, q.w)) {
          if (p.poundT > 0 && (q.type === "break" || q.type === "cloud")) { q.broken = true; q.breakT = 14; spawnParts(w, q.x + q.w / 2, q.y + 2, 12, C.brk, 2.6, 0.22, 2); if (p.id === 0) w.shake = 3; continue; }
          landOn(w, p, q); break;
        }
      }
    }
    for (k = 0; k < w.monsters.length; k++) {
      var m2 = w.monsters[k];
      if (!m2.alive || m2.b === "pull" || m2.b === "wind") continue;
      var bb = mobBox(m2);
      if (overlapsX(p.x + 2, PW - 4, bb[0] + 1, bb[2] - 2) && p.y + 4 < bb[1] + bb[3] && p.y + PH > bb[1]) {
        if (p.rocketT > 0 || p.dashT > 0 || p.poundT > 0 || p.domeT > 0) { killMob(w, m2, p, true); continue; }
        if (mobFrozen) { if (p.vy > 0 && p.prevY + PH <= bb[1] + 5) killMob(w, m2, p); continue; }
        var stompable = !(m2.b === "puff" && m2.big);
        if (stompable && p.vy > 0 && (p.y + PH - bb[1] < 9 || p.prevY + PH <= bb[1] + 5)) killMob(w, m2, p);
        else if (m2.b === "snake") { grabPlayer(w, p, m2); if (p.grabT > 0) break; }
        else { hurt(w, p, "mob", m2); if (!p.alive) break; }
      }
    }
    if (!p.alive) continue;
    for (k = 0; k < w.bullets.length; k++) {
      var bl = w.bullets[k];
      if (bl.life <= 0) continue;
      if (overlapsX(p.x + 2, PW - 4, bl.x - 1, 3) && bl.y + 4 > p.y + 2 && bl.y < p.y + PH) {
        if (invuln(p)) { bl.life = 0; continue; }
        bl.life = 0;
        if (bl.kind === "ice") freezePlayer(w, p);
        else hurt(w, p, "shot", null);
        if (!p.alive) break;
      }
    }
    if (!p.alive) continue;
    if (!p.isBot) {
      var pcx = p.x + PW / 2, pcy = p.y + PH / 2;
      for (k = 0; k < w.coins.length; k++) {
        var cn = w.coins[k];
        if (cn.taken) continue;
        if (p.magnetT > 0) {
          var mdx = wrapDx(pcx - (cn.x + 3)), mdy = pcy - (cn.y + 3), md = Math.sqrt(mdx * mdx + mdy * mdy);
          if (md < 70 && md > 0.5) { var ms = Math.min(md, 3.4); cn.x += (mdx / md) * ms; cn.y += (mdy / md) * ms; }
        }
        if (overlapsX(p.x, PW, cn.x, 6) && cn.y + 6 > p.y && cn.y < p.y + PH) {
          cn.taken = true;
          w.runCoins += p.x2T > 0 ? 2 : 1;
          addCharge(p, "coins", 1);
          spawnParts(w, cn.x + 3, cn.y + 3, 6, "#ffe07a", 1.8, 0, 1);
        }
      }
      for (k = 0; k < w.items.length; k++) {
        var it = w.items[k];
        if (!it.taken && overlapsX(p.x, PW, it.x, 10) && it.y + 10 > p.y && it.y < p.y + PH) pickItem(w, p, it);
      }
    }
    var mh = Math.max(0, -(p.y + PH));
    if (mh > p.maxH) { addCharge(p, "height", (mh - p.maxH) / PX_PER_M); p.maxH = mh; }
  }

  var minCam = 1e9;
  for (i = 0; i < w.players.length; i++) {
    var cp = w.players[i];
    if (!cp.alive) continue;
    var target = cp.y - LH * 0.42;
    if (target < cp.camY) cp.camY = target;
    if (cp.camY < minCam) minCam = cp.camY;
  }
  w.cameraY = w.players[0].camY;
  if (minCam < 1e9) generateUntil(w, minCam - 80);
  for (i = 0; i < w.players.length; i++) {
    var ep = w.players[i];
    if (ep.alive && w.tick > 150 && ep.y > ep.camY + LH + 6) {
      if (ep.domeT > 0 && ep.domeSave) { ep.domeSave = false; ep.y = ep.camY + LH - PH - 12; ep.vy = SPRING_V; ep.invT = 40; spawnParts(w, ep.x + 6, ep.y + 8, 16, "#a8f4ff", 3, -0.03, 2); if (ep.id === 0) toast(w, "КОСМОЩИТ СПАС!"); }
      else killPlayer(w, ep, "fall");
    }
  }
  for (i = w.particles.length - 1; i >= 0; i--) {
    var pt = w.particles[i];
    pt.x += pt.vx; pt.y += pt.vy; pt.vy += pt.g; pt.vx *= 0.97;
    if (--pt.life <= 0) w.particles.splice(i, 1);
  }
  if (w.tick % 30 === 0) {
    var cut = -1e9, any = false;
    for (i = 0; i < w.players.length; i++) {
      if (!w.players[i].alive) continue;
      any = true;
      cut = Math.max(cut, w.players[i].camY + LH + 80);
    }
    if (!any) cut = w.cameraY + LH + 80;
    w.platforms = w.platforms.filter(function (a: any) { return a.y < cut; });
    w.monsters = w.monsters.filter(function (a: any) { return a.y < cut; });
    w.coins = w.coins.filter(function (a: any) { return a.y < cut && !a.taken; });
    w.items = w.items.filter(function (a: any) { return a.y < cut && !a.taken; });
    w.bullets = w.bullets.filter(function (a: any) { return a.y < cut; });
  }
  var alive = 0;
  for (i = 0; i < w.players.length; i++) if (w.players[i].alive) alive++;
  var me = w.players[0];
  if (w.mode === "solo") {
    if (!me.alive && ++w.finishWait > 70) finish(w);
  } else if (alive <= 1) {
    if (++w.finishWait > 45) finish(w);
  } else if (!me.alive) {
    if (++w.finishWait > 200) finish(w);
  } else w.finishWait = 0;
}
function finish(w: any) {
  if (w.phase !== "play") return;
  w.phase = "results";
  var arr = w.players.slice().sort(function (a: any, b: any) { return b.maxH - a.maxH; });
  for (var i = 0; i < arr.length; i++) arr[i].place = i + 1;
}
function metersOf(p: any) { return Math.floor(p.maxH / PX_PER_M); }

