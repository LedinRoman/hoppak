
/* ---------------- World ---------------- */
/* Magnet coin-attract radius, game px. Was 70; 70 × 1.7 = 119.
   The visual aura (drawMagnetCloud) is a pose cloud, not derived from this value. */
var MAGNET_RADIUS = 119;
function isPerm(t: string) { return t === "normal" || t === "move" || t === "ice" || t === "bounce" || t === "grav"; }
/* Stable = does not vanish and does not slide away. Move is permanent but leaves the jump line. */
function isStableType(t: string) { return t === "normal" || t === "ice" || t === "grav" || t === "bounce"; }
/* Horizontal pixels available while rising `gap` px, from JUMP_V / GRAVITY / MAX_VX. */
function horizReachPx(gap: number) {
  var h = Math.max(0, Math.min(gap, JUMP_H - 1));
  var disc = JUMP_V * JUMP_V - 2 * GRAVITY * h;
  if (disc < 0) disc = 0;
  var t = (-JUMP_V - Math.sqrt(disc)) / GRAVITY;
  if (!(t > 0) || !isFinite(t)) t = 1;
  return MAX_VX * t;
}
function edgeGap(ax: number, aw: number, bx: number, bw: number) {
  function lin(a0: number, a1: number, b0: number, b1: number) {
    if (a1 >= b0 && b1 >= a0) return 0;
    if (a1 < b0) return b0 - a1;
    return a0 - b1;
  }
  return Math.min(
    lin(ax, ax + aw, bx, bx + bw),
    lin(ax, ax + aw, bx + LW, bx + bw + LW),
    lin(ax + LW, ax + aw + LW, bx, bx + bw)
  );
}
/* After the row is placed: every previous stable platform must reach a stable one here. No extra RNG. */
function ensureReach(w: any, row: any[], y: number) {
  /* A moving platform sweeps the whole row (wall to wall), so it is reachable from anywhere and it is
     where the next row starts from. Never add a static safety platform into its path (prod b683155 behaviour). */
  for (var mv = 0; mv < row.length; mv++) {
    if (row[mv].type === "move") { w.reachFrom = [{ x: 2, w: LW - 4 }]; return; }
  }
  var prev = w.reachFrom && w.reachFrom.length ? w.reachFrom : [{ x: 8, w: LW - 16 }];
  var gap = w.reachGap > 0 ? w.reachGap : ROW_SEP;
  var reach = horizReachPx(gap);
  var stable: any[] = [];
  for (var i = 0; i < row.length; i++) if (isStableType(row[i].type)) stable.push(row[i]);
  for (var a = 0; a < prev.length; a++) {
    var ok = false;
    for (var b = 0; b < stable.length; b++) {
      if (edgeGap(prev[a].x, prev[a].w, stable[b].x, stable[b].w) <= reach + 0.01) { ok = true; break; }
    }
    if (ok) continue;
    var pw = 36;
    var x0 = Math.round(prev[a].x + prev[a].w / 2 - pw / 2);
    /* v1.0: never overlap a platform of this row (X_SEP clear, wrap-aware). Search outward from the
       ideal spot, keep it within reach of the previous platform. No RNG, so seeds stay deterministic. */
    var x = -1;
    for (var dxs = 0; dxs <= LW && x < 0; dxs++) {
      for (var sg = 0; sg < (dxs ? 2 : 1); sg++) {
        var cx = x0 + (sg ? -dxs : dxs);
        while (cx < 2) cx += LW;
        while (cx + pw > LW - 2) cx -= LW;
        if (cx < 2) continue;
        if (edgeGap(prev[a].x, prev[a].w, cx, pw) > reach + 0.01) continue;
        var free = true;
        for (var oi = 0; oi < row.length; oi++) if (edgeGap(cx, pw, row[oi].x, row[oi].w) < X_SEP) { free = false; break; }
        if (free) { x = cx; break; }
      }
    }
    if (x < 0) {
      /* No free spot in reach: make the nearest reachable platform of this row stable instead. */
      var bestP: any = null, bestG = 1e9;
      for (var ri = 0; ri < row.length; ri++) {
        var gg = edgeGap(prev[a].x, prev[a].w, row[ri].x, row[ri].w);
        if (gg < bestG) { bestG = gg; bestP = row[ri]; }
      }
      if (bestP && bestG <= reach + 0.01) {
        bestP.type = "normal"; bestP.broken = false;
        stable.push(bestP);
        continue;
      }
      x = Math.max(2, Math.min(LW - pw - 2, x0));
    }
    var np = mkPlat(x, y, pw, "normal", row.length ? row[0].row : w.rowN);
    row.push(np);
    w.platforms.push(stampPlat(w, np));
    stable.push(np);
  }
  var next: any[] = [];
  for (var s = 0; s < stable.length; s++) next.push({ x: stable[s].x, w: stable[s].w });
  if (next.length) w.reachFrom = next;
}

function mkPlat(x: number, y: number, w: number, type: string, row: number) {
  return { x: x, y: y, w: w, type: type, vx: 0, broken: false, breakT: 0, respawnT: 0, restoreT: 0, spring: false, springT: 0, row: row, seq: 0 };
}
function stampPlat(w: any, pl: any) {
  pl.seq = w.platSeq++;
  var pending = w.netBreaks && w.netBreaks[pl.seq];
  if (pending && (pl.type === "break" || pl.type === "lava" || pl.type === "bubble")) {
    delete w.netBreaks[pl.seq];
    if (pending === "brk") { pl.broken = true; pl.breakT = 0; }
    else { pl.broken = false; pl.restoreT = 16; }
  }
  return pl;
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

function platAlive(w: any, pl: any) {
  return !!(pl && !pl.broken && w.platforms.indexOf(pl) >= 0);
}
function hangTop(pl: any) { return pl.y + 5; }
function spaceBelow(w: any, pl: any, x: number, ww: number) {
  var best = 1e9;
  for (var i = 0; i < w.platforms.length; i++) {
    var q = w.platforms[i];
    if (q === pl || q.broken || q.y <= pl.y) continue;
    if (x + ww <= q.x || x >= q.x + q.w) continue;
    if (q.y - pl.y < best) best = q.y - pl.y;
  }
  return best;
}
function startFall(mo: any) { mo.falling = true; mo.hvy = 0.25; mo.home = null; }
function followHome(w: any, mo: any, sf: number, hang: boolean) {
  if (mo.falling) {
    mo.hvy += 0.16 * sf;
    if (hang) {
      mo.topY += mo.hvy * sf;
      mo.botY += mo.hvy * sf;
      placeSnakeHead(mo);
    } else mo.y += mo.hvy * sf;
    if (mo.y > w.cameraY + LH + 50) { mo.alive = false; mo.squish = 0; }
    return false;
  }
  var home = mo.home;
  if (!platAlive(w, home)) { startFall(mo); return followHome(w, mo, sf, hang); }
  if (hang) {
    var sc = SNAKE_DRAW_SCALE;
    var leftOff = (SNAKE_HEAD_ART_X - 32) * sc;
    var hw = SNAKE_HEAD_ART_W * sc;
    if (mo.hangX == null) mo.hangX = mo.x - leftOff;
    if (home.vx) mo.hangX += home.vx * sf;
    mo.hangX = clamp(mo.hangX, home.x - leftOff, home.x + home.w - leftOff - hw);
    mo.minX = home.x;
    mo.maxX = home.x + home.w - hw;
    mo.topY = hangTop(home);
    mo.botY = mo.topY + (mo.hangLen || 24);
    placeSnakeHead(mo);
  } else {
    if (home.vx) mo.x += home.vx * sf;
    mo.minX = home.x;
    mo.maxX = home.x + home.w - mo.w;
    if (mo.maxX < mo.minX) mo.maxX = mo.minX;
    mo.x = clamp(mo.x, mo.minX, mo.maxX);
    mo.baseY = home.y - mo.h;
    if (mo.b !== "hop") mo.y = mo.baseY;
  }
  return true;
}
function unsupportedMobs(w: any) {
  var bad: any[] = [];
  if (!w) return bad;
  for (var i = 0; i < w.monsters.length; i++) {
    var mo = w.monsters[i], M = MOBS[mo.kind];
    if (!mo.alive || mo.falling || !M) continue;
    var ok = false, j, pl;
    if (mo.b === "snake") {
      for (j = 0; j < w.platforms.length; j++) {
        pl = w.platforms[j];
        if (pl.broken) continue;
        if (mo.x + mo.w <= pl.x + 1 || mo.x >= pl.x + pl.w - 1) continue;
        if (Math.abs(hangTop(pl) - (mo.topY || mo.y)) <= 4) { ok = true; break; }
      }
      if (!ok) bad.push({ kind: mo.kind, x: mo.x, y: mo.y, why: "hang" });
    } else if (M.plat) {
      var feet = (mo.b === "hop" ? mo.baseY : mo.y) + mo.h;
      for (j = 0; j < w.platforms.length; j++) {
        pl = w.platforms[j];
        if (pl.broken) continue;
        if (mo.x + mo.w <= pl.x + 1 || mo.x >= pl.x + pl.w - 1) continue;
        if (Math.abs(pl.y - feet) <= 3) { ok = true; break; }
      }
      if (!ok) bad.push({ kind: mo.kind, x: mo.x, y: mo.y, why: "stand" });
    }
  }
  return bad;
}
/* Trash (24 wide) must leave a landable strip (PW+4) beside it, or the row must
   have another reachable solid so the can is not the only way up. Spawn height stays 400 m. */
var TRASH_SIDE = PW + 4;
function canWalkPastTrash(pl: any, M: any) { return pl.w >= (M.w + TRASH_SIDE); }
function platReachableFromPrev(w: any, pl: any) {
  if (pl.type === "move") return true;
  var prev = w.reachFrom && w.reachFrom.length ? w.reachFrom : [{ x: 8, w: LW - 16 }];
  var g = w.reachGap > 0 ? w.reachGap : ROW_SEP;
  var reach = horizReachPx(g);
  for (var i = 0; i < prev.length; i++) {
    if (edgeGap(prev[i].x, prev[i].w, pl.x, pl.w) <= reach + 0.01) return true;
  }
  return false;
}
function trashStandCands(row: any[]) {
  return row.filter(function (p: any) {
    return isPerm(p.type) && p.type !== "bounce" && !p.spring && !p.broken;
  });
}
function trashHomes(w: any, row: any[], M: any) {
  var cands = trashStandCands(row);
  var reachable: any[] = [];
  for (var i = 0; i < cands.length; i++) if (platReachableFromPrev(w, cands[i])) reachable.push(cands[i]);
  var hasAlt = reachable.length >= 2;
  var homes: any[] = [];
  for (var j = 0; j < reachable.length; j++) {
    if (hasAlt || canWalkPastTrash(reachable[j], M)) homes.push(reachable[j]);
  }
  return homes;
}
/* Vine-snake: only static green `normal` platforms, never move/bounce/break. Clearance below
   must cover hangLen + the drawn head so the extended pose never rests on a lower platform. */
function isSnakeHost(pl: any, M: any) {
  return !!(pl && pl.type === "normal" && !pl.broken && !pl.spring && pl.w >= M.w + 4);
}
function snakeNeedBelow(M: any) { return (M.gap || 32) + SNAKE_HEAD_DRAW_H; }
function snakeSlots(w: any, pl: any, M: any) {
  var need = snakeNeedBelow(M), slots: number[] = [];
  var minX = pl.x + 1, maxX = pl.x + pl.w - M.w - 1;
  if (maxX < minX) maxX = minX;
  for (var sx = minX; sx <= maxX; sx += 4) {
    if (spaceBelow(w, pl, sx, M.w) >= need) slots.push(sx);
  }
  if (spaceBelow(w, pl, maxX, M.w) >= need && slots.indexOf(maxX) < 0) slots.push(maxX);
  return slots;
}
function snakeHangs(w: any, row: any[], M: any) {
  var hangs: any[] = [];
  for (var i = 0; i < row.length; i++) {
    var pl = row[i];
    if (!isSnakeHost(pl, M)) continue;
    if (snakeSlots(w, pl, M).length) hangs.push(pl);
  }
  return hangs;
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
    if (M.b === "snake") {
      if (!snakeHangs(w, row, M).length) continue;
    } else {
      if (M.plat) {
        if (k === "trash") {
          if (!trashHomes(w, row, M).length) continue;
        } else {
          var homes0 = row.filter(function (p: any) { return isPerm(p.type) && p.type !== "bounce" && !p.spring && p.w >= 26 && !p.broken; });
          if (!homes0.length || (!isMove && solids.length < 2)) continue;
        }
      }
      if (gap < M.gap) continue;
    }
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
  if (M2.b === "snake") {
    var hangs = snakeHangs(w, row, M2);
    if (!hangs.length) return false;
    var hs = hangs[Math.floor(r() * hangs.length)];
    var slots = snakeSlots(w, hs, M2);
    if (!slots.length) return false;
    var sx = slots[Math.floor(r() * slots.length)];
    var room = spaceBelow(w, hs, sx, M2.w);
    var hangLen = Math.min(M2.gap || 32, Math.max(16, room - M2.h - 6));
    if (room < hangLen + SNAKE_HEAD_DRAW_H) return false;
    var ty = hangTop(hs);
    var hangX = sx - (SNAKE_HEAD_ART_X - 32) * SNAKE_DRAW_SCALE;
    var mo = mkMob(kind, sx, ty + SNAKE_HEAD_ART_Y * SNAKE_DRAW_SCALE, d, {
      home: hs, hangLen: hangLen, topY: ty, botY: ty + hangLen, hangX: hangX,
      minX: hs.x, maxX: hs.x + hs.w - M2.w
    });
    placeSnakeHead(mo);
    w.monsters.push(mo);
    return true;
  }
  if (M2.plat) {
    if (kind === "trash") {
      var homesT = trashHomes(w, row, M2);
      if (!homesT.length) return false;
      var tp = homesT[Math.floor(r() * homesT.length)];
      var tx: number;
      if (canWalkPastTrash(tp, M2)) {
        /* Park the can at one end so the other side stays a landable strip. */
        tx = r() < 0.5 ? tp.x + 1 : tp.x + tp.w - M2.w - 1;
        tx = clamp(tx, tp.x, tp.x + tp.w - M2.w);
      } else tx = tp.x + randInt(r, 1, Math.max(1, tp.w - M2.w - 1));
      w.monsters.push(mkMob(kind, tx, tp.y - M2.h, d, {
        home: tp, minX: tp.x, maxX: tp.x + tp.w - M2.w, vx: 0,
        jT: randInt(r, 30, 100), shootT: randInt(r, 50, 150), dir: 1, t: randInt(r, 0, 100)
      }));
      return true;
    }
    var homes = row.filter(function (p: any) { return isPerm(p.type) && p.type !== "bounce" && !p.spring && p.w >= 26 && !p.broken; });
    if (!homes.length) return false;
    var pl = homes[Math.floor(r() * homes.length)];
    var px = pl.x + randInt(r, 1, Math.max(1, pl.w - M2.w - 1));
    var wsp = M2.b === "walk" ? M2.sp * (0.85 + d * 0.6) : 0;
    w.monsters.push(mkMob(kind, px, pl.y - M2.h, d, {
      home: pl, minX: pl.x, maxX: pl.x + pl.w - M2.w, vx: r() < 0.5 ? -wsp : wsp,
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
  /* v0.59: +7% difficulty ramp past 100 m; first 100 m stay identical to v0.58. */
  var h059 = clamp((m - 100) / 200, 0, 1);
  /* Moving plats: v0.54 started at 40 m. Soften the first stretch; past 100 m ramp up move share and speed. */
  var moveP = m > 70 ? lerp(0.14, 0.45, d) + 0.06 * h059 : 0;
  var isMove = w.lastKind !== "move" && r() < moveP;
  if (isMove) {
    var mw = Math.round(lerp(40, 26, clamp(d + 0.08 * h059, 0, 1)));
    var sp = lerp(0.35, 1.15, d) * (0.85 + r() * 0.3) * (1 + 0.10 * h059);
    var mp = mkPlat(randInt(r, 4, LW - mw - 4), y, mw, "move", rowId);
    mp.vx = r() < 0.5 ? -sp : sp;
    row.push(mp);
  } else {
    var n: number;
    if (m < 160) n = r() < 0.22 ? 3 : 2;
    else if (m < 300) {
      var u1 = (m - 160) / 140;
      n = r() < lerp(0.20, 0.07, u1) ? 3 : (r() < lerp(0.12, 0.46, u1) ? 1 : 2);
    }
    else if (m < 600) n = r() < 0.07 ? 3 : (r() < 0.50 ? 1 : 2);
    else {
      n = r() < lerp(0.56, 0.11, (d - 0.28) / 0.72) ? 2 : 1;
      if (n === 2 && m < 900 && r() < 0.05) n = 3;
    }
    if (spec === "ice" && m < 260 && n === 1) n = 2;
    var dW = clamp(d + 0.08 * h059, 0, 1);
    var wmin = Math.round(lerp(42, 24, dW)), wmax = Math.round(lerp(54, 32, dW));
    var breakP054 = m > 80 ? lerp(0.10, 0.58, d) : 0;
    var breakP = m < 160 ? 0 : m < 290 ? breakP054 * ((m - 160) / 130) : Math.min(0.64, breakP054 + 0.05);
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
  for (var j = 0; j < row.length; j++) w.platforms.push(stampPlat(w, row[j]));

  /* Gap vs height. Soften the opening (min ~0.34 JUMP_H); from 300 m the values
     are identical to v0.54 (gT = m/700, 0.42–0.78 / 0.58–0.94). */
  var gT = clamp((m + 90 * h059) / 700, 0, 1);
  var minG054 = Math.max(ROW_SEP, Math.floor(JUMP_H * lerp(0.42, 0.78, gT)));
  var maxG054 = Math.min(GAP_CAP, Math.floor(JUMP_H * lerp(0.58, 0.94, gT)));
  var minG: number, maxG: number;
  if (m < 300) {
    var u = clamp(m / 300, 0, 1);
    minG = Math.round(lerp(Math.max(ROW_SEP, Math.floor(JUMP_H * 0.34)), minG054, u));
    maxG = Math.round(lerp(Math.min(GAP_CAP, Math.floor(JUMP_H * 0.50)), maxG054, u));
  } else {
    minG = minG054; maxG = maxG054;
  }
  minG = Math.min(GAP_CAP, minG + Math.round(2 * h059));
  maxG = Math.min(GAP_CAP, maxG + Math.round(2 * h059));
  if (minG > maxG) minG = maxG;
  var gap = randInt(r, minG, maxG);

  var pMon = m < 120 ? 0 : m < 400 ? 0.085 : lerp(0.13, 0.26, d);
  /* City lost the mid-air jellyfish; trash (platform-only from 400 m) and bat from 800 m
     would otherwise spawn fewer mobs than before. Boost attempts after 400 m so city
     density stays at or above the previous table. */
  if (mapInfo(w.map).id === "city" && m >= 400) pMon *= 1.18;
  var mob = r() < pMon ? spawnMob(w, row, y, gap, m, d, isMove) : false;
  var bonus = false;
  if (!mob && m >= w.nextBonusM && gap >= 26) {
    var tw = 0, bi: number;
    for (bi = 0; bi < BONUSES.length; bi++) tw += BONUSES[bi].wt;
    var bp = r() * tw, bk = BONUSES[0].id;
    for (bi = 0; bi < BONUSES.length; bi++) { bp -= BONUSES[bi].wt; if (bp <= 0) { bk = BONUSES[bi].id; break; } }
    w.items.push({ kind: bk, x: randInt(r, 10, LW - 20), y: Math.round(y - gap / 2 - 5), taken: false });
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
  /* Safety platforms are added after coins so they do not change the coin rows. */
  ensureReach(w, row, y);
  w.reachGap = gap;
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
    teleT: 0, teleN: 0, tx0: 0, ty0: 0, ttx: 0, tty: 0,
    domeT: 0, domeSave: false, kills: 0, shieldT: 0, magnetT: 0, rocketT: 0, invT: 0, freezeT: 0, grabT: 0, grabMob: null, dashT: 0, poundT: 0, wallT: 0, wall: 0, teleFx: 0, ramFx: 0, stallT: 0, stallH: 0
  };
}

/* DB run mode from who is actually in the world at start, not from the lobby type.
   One human and no bots (even if they pressed start in a coop room) is solo. */
function classifyRunMode(players: any[]): string {
  var humans = 0, bots = 0, i, p;
  if (!players) return "solo";
  for (i = 0; i < players.length; i++) {
    p = players[i];
    if (p && (p.isBot || p.bot)) bots++;
    else humans++;
  }
  if (humans >= 2 && bots > 0) return "coop_mixed";
  if (humans === 1 && bots > 0) return "coop_bots";
  if (humans >= 2) return "coop";
  return "solo";
}
function stampRunMode(w: any) {
  if (!w) return;
  w.runMode = classifyRunMode(w.players);
}
function createWorld(seed: number, mode: string, humanKind: number, humanLook: any, mapId?: string) {
  var w: any = {
    seed: seed >>> 0, rng: mulberry32(seed >>> 0), mode: mode, map: mapInfo(mapId || "city").id,
    platforms: [], monsters: [], bullets: [], coins: [], items: [], particles: [],
    nextY: -24, rowN: 1, platSeq: 0, netBreaks: {}, lastKind: "", lastMobRow: {}, cameraY: -LH + 70, tick: 0, shake: 0,
    reachFrom: [{ x: 8, w: LW - 16 }], reachGap: 24,
    phase: "play", players: [], finishWait: 0, runCoins: 0, bonusCoins: 0, paid: false, freezeMobT: 0, toast: "", toastT: 0, nextBonusM: 0, fallWarn: 0, liftWarn: 0, warnSfxT: 0
  };
  w.nextBonusM = randInt(w.rng, 160, 240);
  /* Opening row: a few normal-width platforms (early-game size), not one nearly full-width floor.
     Fixed positions (no extra RNG), ~10 px gaps so they do not read as one bar.
     Cover every solo / squad / net spawn X (22, 48, 74, 124) and mid-field solo at LW=180 (x=84). */
  var startSpecs = [
    { x: 16, w: 48 }, /* 16-64 covers 22-34 and 48-60 */
    { x: 74, w: 40 }, /* 74-114 covers 74-86 and solo 84 */
    { x: 124, w: 44 } /* 124-168 covers 124-136 */
  ];
  var startRow: any[] = [];
  for (var si = 0; si < startSpecs.length; si++) {
    var sx = startSpecs[si].x;
    var startW = startSpecs[si].w;
    if (sx < 2) sx = 2;
    if (sx + startW > LW - 2) startW = (LW - 2) - sx;
    if (startW < 24) {
      startW = Math.min(44, LW - 4);
      sx = Math.max(2, LW - 2 - startW);
    }
    var sp = stampPlat(w, mkPlat(sx, 0, startW, "normal", 0));
    w.platforms.push(sp);
    startRow.push(sp);
  }
  w.reachFrom = startRow.map(function (pl: any) { return { x: pl.x, w: pl.w }; });
  var xs = mode === "squad" ? [74, 22, 124, 48] : [Math.round(LW / 2) - 6];
  w.players.push(newPlayer(0, humanKind, humanLook, xs[0], false));
  if (mode === "squad") {
    var bk = botKinds(humanKind);
    for (var i = 1; i < 4; i++) {
      var bp = newPlayer(i, bk[i - 1], makeLook(bk[i - 1], "base", "none"), xs[i], true);
      bp.name = t('lobby.bot_number', { n: i }); /* label only: «БОТ 1..3» in game, results and spectator */
      w.players.push(bp);
    }
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
  if (p.id === 0) { w.shake = 8; hopSfx("death"); }
}
function invuln(p: any) { return p.invT > 0 || p.rocketT > 0 || p.dashT > 0 || p.poundT > 0 || p.domeT > 0; }
function useShield(w: any, p: any) {
  if (p.shieldT <= 0) return false;
  p.shieldT = 0;
  p.invT = 60;
  spawnParts(w, p.x + 6, p.y + 8, 14, "#8ae8ff", 2.6, 0.02, 2);
  if (p.id === 0) { w.shake = 4; toast(w, t('play.shield_saved')); hopSfx("shield"); }
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
  if (p.id === 0) toast(w, t('play.frozen'));
}
function grabPlayer(w: any, p: any, mo: any) {
  if (!p.alive || invuln(p) || mo.cool > 0) return;
  if (useShield(w, p)) { killMob(w, mo, p, true); return; }
  p.grabT = 45; p.grabMob = mo; mo.cool = 160;
  if (p.id === 0) toast(w, t('play.snake_caught'));
}
/* v1.0: in-game floating/intro hint texts are off (break, ability names, pickups…). */
function toast(w: any, _s: string) { /* no-op */ }
function hasLandablePlat(w: any, p: any) {
  var feet = p.y + PH, reach = 28;
  for (var i = 0; i < w.platforms.length; i++) {
    var q = w.platforms[i];
    if (q.broken) continue;
    if (p.poundT > 0 && (q.type === "break" || q.type === "cloud")) continue;
    if (q.y + 3 >= (p.prevY + PH) - 2 && q.y <= feet + reach && overlapsX(p.x + LAND_PAD_X, PW - LAND_PAD_X * 2, q.x, q.w)) return true;
  }
  return false;
}
function landOn(w: any, p: any, pl: any) {
  p.y = pl.y - PH;
  p.baseY = pl.y;
  p.squash = 7;
  var spr = pl.spring && overlapsX(p.x + LAND_PAD_X, PW - LAND_PAD_X * 2, pl.x + pl.w / 2 - 5, 10);
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
    if (w.net) { pl.netTell = 1; pl.netKind = "lava"; }
    if (p.id === 0) w.shake = 4;
    spawnParts(w, pl.x + pl.w / 2, pl.y, 10, "#ff9030", 2.6, 0.12, 2);
  } else if (pl.type === "bubble") {
    p.vy = -6.9;
    pl.broken = true;
    pl.breakT = 10;
    if (w.net) { pl.netTell = 1; pl.netKind = "bubble"; }
    else pl.respawnT = 75;
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
    p.ramFx = 20; /* render-only: knight impact / launch frames */
    p.vy = Math.min(p.vy, JUMP_V * 1.42); /* risk -> reward: ~2x normal jump height */
    if (p.id === 0) w.shake = 7;
    spawnParts(w, p.x + 6, pl.y, 14, "#ffd046", 3, 0.1, 2);
  }
    if (pl.type === "break" && !pl.broken) {
    pl.broken = true;
    pl.breakT = 14;
    if (w.net) { pl.netTell = 1; pl.netKind = "break"; }
    spawnParts(w, pl.x + pl.w / 2, pl.y + 2, 10, C.brk, 2.2, 0.22, 2);
    spawnParts(w, pl.x + pl.w / 2, pl.y + 2, 4, C.brkRim, 1.6, 0.22, 1);
  }
  /* Takeoff: every landing here is the bounce that leaves the platform. */
  if (p.id === 0) hopSfx("jump");
}
function killMob(w: any, mo: any, p: any, noBounce?: boolean) {
  if (!mo.alive) return;
  mo.alive = false;
  /* Trash gets a longer death so the lid-pop / fall can play (16 ticks). Others stay at 10. */
  mo.squish = mo.kind === "trash" ? 16 : 10;
  if (!noBounce) { p.vy = STOMP_V; p.y = mo.y - PH; }
  p.kills++;
  /* Knight charge is "1 kill". A mid-slam/dash kill must not refund the ability. */
  if (!(p.poundT > 0 || p.dashT > 0)) addCharge(p, "kills", 1);
  var pal = MOBPAL[mo.kind] || ["#ffd070"];
  var cx = mo.x + mo.w / 2, cy = mo.y + 4;
  if (mo.kind === "trash") {
    spawnParts(w, cx, cy, 8, pal[0], 2.4, 0.18, 2);
    spawnParts(w, cx, cy, 5, pal[1], 2.0, 0.18, 1);
    spawnParts(w, cx, cy, 4, pal[2], 2.8, 0.12, 1);
  } else spawnParts(w, cx, cy, 12, pal[0], 2.6, 0.15);
  if (p.id === 0) { w.shake = 5; hopSfx("hit"); }
}
function bumpOffTrash(w: any, p: any, mo: any) {
  /* Side or below: knock the player away, can stays. Brief cool so the overlap doesn't retrigger. */
  if (mo.cool > 0) return;
  var s = wrapDx((p.x + PW / 2) - (mo.x + mo.w / 2)) >= 0 ? 1 : -1;
  p.vx = s * 2.4;
  if (p.vy > -2) p.vy = -2.2;
  p.x += s * 3;
  mo.cool = 10;
  if (p.id === 0) w.shake = 2;
}
function mobBox(mo: any) {
  if (mo.b === "snake") return snakeHeadBox(mo);
  if (mo.b === "puff" && mo.big) return [mo.x - 3, mo.y - 3, mo.w + 6, mo.h + 6];
  /* Slimes: sides stay inset so a graze is not a hit. Blob top is +4 px so a stomp is fair. */
  if (mo.kind === "blob") return [mo.x + 2, mo.y - 3, mo.w - 4, mo.h + 2];
  if (mo.kind === "magma") return [mo.x + 2, mo.y + 1, mo.w - 4, mo.h - 2];
  return [mo.x, mo.y, mo.w, mo.h];
}
/* motion envelope of a mob (for tests: must not cross platforms) */
function mobEnv(mo: any) {
  var b = mo.b, M = MOBS[mo.kind];
  if (M.plat) return [mo.minX, mo.baseY - (b === "hop" ? 15 : 0), mo.maxX + mo.w, mo.baseY + mo.h];
  if (b === "fly") return [0, mo.baseY - mo.amp - (mo.amp ? 0 : 0), LW, mo.baseY + mo.h + mo.amp + 1];
  if (b === "sway") return [0, mo.baseY - 4, LW, mo.baseY + mo.h + 4];
  if (b === "snake") {
    var hb = snakeHeadBox(mo);
    var hy0 = (mo.topY != null ? mo.topY : mo.y) + SNAKE_HEAD_ART_Y * SNAKE_DRAW_SCALE;
    var hy1 = (mo.botY != null ? mo.botY : mo.y) + SNAKE_HEAD_ART_Y * SNAKE_DRAW_SCALE + hb[3];
    return [hb[0], hy0, hb[0] + hb[2], hy1];
  }
  if (b === "puff") return [0, mo.baseY - 5, LW, mo.baseY + mo.h + 5];
  if (b === "shoot") return [0, mo.baseY - (M.freeze ? 3 : 0), LW, mo.baseY + mo.h + (M.freeze ? 3 : 0)];
  if (b === "comet" || b === "wind") return [0, mo.baseY, LW, mo.baseY + mo.h];
  return [mo.x, mo.y, mo.x + mo.w, mo.y + mo.h];
}
function abCharges(H: any) { return (H && H.charges > 1) ? (H.charges | 0) : 1; }
function abChargeCap(H: any) { return H.need * abCharges(H); }
function abReady(p: any) { return p.abCharge >= CHARS[p.kind].need; }
function addCharge(p: any, kind: string, n: number) {
  var H = CHARS[p.kind];
  if (H.charge === kind) p.abCharge = Math.min(abChargeCap(H), p.abCharge + n);
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
    if (!tg) { if (p.id === 0) toast(w, t('play.no_target')); return false; }
    p.hookT = 0; p.hx0 = p.x; p.hy0 = p.y; p.htx = tg.x - PW / 2; p.hty = tg.y; p.hookPl = tg.pl; p.hookCoin = tg.coin;
    var hd = Math.sqrt(Math.pow(p.htx - p.x, 2) + Math.pow(p.hty - p.y, 2));
    p.hookN = Math.round(clamp(hd / 5, 10, 22));
    p.grabT = 0; p.poundT = 0;
  }
  else if (H.ab === "tele") {
    /* the highest SOLID platform within ~1.5 jumps above, visible, with no mob standing on it */
    generateUntil(w, p.y - JUMP_H * 1.5 - 80);
    var best: any = null;
    for (i = 0; i < w.platforms.length; i++) {
      var q = w.platforms[i];
      if (q.broken || !isPerm(q.type) || q.type === "move" || q.lifeT) continue;
      if (q.y > p.y - 24 || q.y < p.y + PH - JUMP_H * 1.5 || q.y < p.camY + 14) continue;
      var busy = false;
      for (var mi = 0; mi < w.monsters.length; mi++) { var mo = w.monsters[mi]; if (mo.alive && Math.abs(mo.y + mo.h - q.y) < 22 && overlapsX(mo.x - 4, mo.w + 8, q.x, q.w)) busy = true; }
      if (!busy && (!best || q.y < best.y)) best = q;
    }
    if (!best) { if (p.id === 0) toast(w, t('play.no_platform')); return false; }
    spawnParts(w, p.x + 6, p.y + 8, 14, "#c890ff", 2.4, 0, 2);
    /* Same destination as the old snap. Ten ticks of interpolation, then the same jump. */
    p.tx0 = p.x; p.ty0 = p.y; p.ttx = clamp(best.x + best.w / 2 - PW / 2, 0, LW - PW); p.tty = best.y - PH;
    p.teleT = 0; p.teleN = 10;
    p.invT = Math.max(p.invT, 30); p.grabT = 0; p.poundT = 0; p.teleFx = 18; p.vx = 0; p.vy = 0;
    spawnParts(w, p.ttx + 6, p.tty + 8, 8, "#e8c8ff", 1.6, 0, 1);
  }
  else if (H.ab === "wall") { p.wallT = 300; p.wall = 0; spawnParts(w, p.x + 6, p.y + 8, 10, "#d82a2a", 2, 0, 1); }
  else if (H.ab === "dash") { p.vy = Math.min(p.vy, -6.6); p.vx = clamp(p.vx + p.face * 1.6, -MAX_VX * 1.3, MAX_VX * 1.3); p.dashT = 14; p.grabT = 0; spawnParts(w, p.x + 6, p.y + PH, 12, "#7ad8ff", 2.4, 0.08, 2); }
  else if (H.ab === "dome" || H.ab === "shield") { giveBonus(w, p, "shield"); }
  else if (H.ab === "pound") { p.poundT = 1; p.vy = 7.5; p.grabT = 0; spawnParts(w, p.x + 6, p.y, 8, "#ffd046", 2, -0.05, 1); }
  p.abCharge = Math.max(0, p.abCharge - H.need);
  /* Shield ability uses the same bonus visual, so no ability-pose flash. */
  if (H.ab !== "shield" && H.ab !== "dome") p.abFx = 16;
  if (p.id === 0) toast(w, H.abName + "!");
  return true;
}
function botWantsAb(w: any, p: any) {
  if (!p.alive || !abReady(p)) return false;
  var ab = CHARS[p.kind].ab;
  if (p.grabT > 0) return ab === "dash" || ab === "hook";
  if (ab === "pound" || ab === "wall") return false;
  if (ab === "dome" || ab === "shield") return w.tick % 200 === p.id * 41;
  return p.vy > 1.2 && p.y > p.camY + LH * 0.7;
}
function giveBonus(w: any, p: any, kind: string) {
  var B: any = null;
  for (var i = 0; i < BONUSES.length; i++) if (BONUSES[i].id === kind) B = BONUSES[i];
  if (!B) return false;
  if (B.id === "bigcoin") w.bonusCoins += BIGCOIN;
  else if (B.id === "shield") p.shieldT = B.t;
  else if (B.id === "magnet") p.magnetT = Math.max(p.magnetT, B.t);
  else if (B.id === "rocket") { p.rocketT = B.t; p.grabT = 0; p.poundT = 0; p.invT = Math.max(p.invT, B.t + 40); }
  toast(w, B.id === "bigcoin" ? t('pickup.treasure', { n: BIGCOIN }) : t('pickup.collected', { name: B.name }));
  if (p.id === 0) { w.shake = 3; hopSfx(B.id === "shield" ? "shield" : "bonus"); }
  return true;
}
function pickItem(w: any, p: any, it: any) {
  it.taken = true;
  it.popT = BUBBLE.popTicks;
  giveBonus(w, p, it.kind);
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
    if (pl.restoreT > 0) pl.restoreT--;
    if (pl.respawnT > 0 && --pl.respawnT === 0) { pl.broken = false; spawnParts(w, pl.x + pl.w / 2, pl.y, 4, "#88f8ff", 1.2, -0.02, 1); }
    if (pl.springT > 0) pl.springT--;
    if (pl.lifeT > 0 && --pl.lifeT === 0) { pl.broken = true; pl.breakT = 0; }
  }
  /* Spectating (own hero is down): other runners — bots and remote players — visibly pick up coins they touch.
     Visual only: no runCoins, no charge, no netTell, so the player's award and the economy are unchanged. */
  if (w.players[0] && !w.players[0].alive) {
    for (var sp = 1; sp < w.players.length; sp++) {
      var sq = w.players[sp];
      if (!sq.alive) continue;
      for (var sc = 0; sc < w.coins.length; sc++) {
        var scn = w.coins[sc];
        if (!scn.taken && overlapsX(sq.x - 2, PW + 4, scn.x, 6) && scn.y + 6 > sq.y - 2 && scn.y < sq.y + PH + 2) {
          scn.taken = true;
          spawnParts(w, scn.x + 3, scn.y + 3, 6, "#ffe07a", 1.8, 0, 1);
        }
      }
    }
  }
  function nearPlayer(mo: any) {
    for (var q = 0; q < w.players.length; q++) if (w.players[q].alive && Math.abs(w.players[q].y - mo.y) < LH * 0.8) return true;
    return false;
  }
  for (i = 0; i < w.monsters.length; i++) {
    var mo = w.monsters[i];
    mo.t += sf;
    if (mo.fx > 0) mo.fx--;
    else if (mo.fx < 0) mo.fx++;
    if (mo.warnT > 0) mo.warnT--; else mo.warn = 0;
    if (mo.cool > 0) mo.cool -= sf;
    if (!mo.alive) { if (mo.squish > 0) mo.squish--; continue; }
    if (mobFrozen) { mo.t -= sf; continue; }
    var b = mo.b, MM = MOBS[mo.kind];
    if (b === "snake" || (MM && MM.plat) || mo.home || mo.falling) {
      if (!followHome(w, mo, sf, b === "snake")) continue;
    }
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
      /* Monkey windup is 14 ticks (fi 2, nut still in hand). Spawn the nut on the release tick, then hold fi 3. Spit still fires immediately. Same nut pos/vel/hitbox as before. */
      if (b === "throw" && mo.nutPend && mo.fx === 0) {
        mo.nutPend = 0;
        w.bullets.push({ kind: "nut", x: mo.x + 6, y: mo.y - 2, vx: 0.45 * mo.dir, vy: -3.1, g: 0.075, life: 260 });
        mo.fx = -10;
      }
      mo.shootT -= sf;
      if (mo.shootT <= 0) {
        mo.shootT = Math.round(lerp(170, 115, mo.d));
        if (nearPlayer(mo)) {
          mo.fx = 14;
          if (b === "throw") { mo.dir = -mo.dir; mo.nutPend = 1; }
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
      placeSnakeHead(mo);
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
    if (p.remote) continue; /* net: remote heroes are placed by NET.frame */
    if (!p.alive) { if (p.y < p.camY + LH + 60) { p.vy = Math.min(p.vy + GRAVITY, 5); p.y += p.vy; } continue; }
    p.prevY = p.y;
    if (p.iceT > 0) p.iceT--;
    if (p.gravT > 0) p.gravT--;
    addCharge(p, "time", 1);
    if (p.domeT > 0) p.domeT--;
    if (p.abFx > 0) p.abFx--;
    if (p.shieldT > 0) p.shieldT--;
    if (p.magnetT > 0) p.magnetT--;
    if (p.invT > 0) p.invT--;
    if (p.freezeT > 0) p.freezeT--;
    if (p.dashT > 0) p.dashT--;
    var inp = inputs[p.id] || { dir: 0, ax: 0 };
    if (p.teleFx > 0) p.teleFx--;
    if (p.ramFx > 0) p.ramFx--;
    if (p.wallT > 0) { p.wallT--; if (p.wallT === 0) p.wall = 0; }
    /* ninja on a wall: tap the ability button or press away from the wall -> kick up and away */
    if (p.wall && (inp.ab || (inp.dir || 0) === -p.wall || (inp.ax && Math.sign(inp.ax) === -p.wall && Math.abs(inp.ax) > 0.3))) {
      var wsd = p.wall;
      p.vy = JUMP_V * 0.97; p.vx = -wsd * 2.6; p.face = -wsd; p.wall = 0; p.squash = 4; p.x += -wsd * 2;
      spawnParts(w, wsd < 0 ? 1 : LW - 1, p.y + 10, 6, "#d8f0ff", 1.6, 0.05, 1);
    } else if (inp.ab) useAbility(w, p);
    if (p.teleN > 0) {
      p.teleT++;
      var tu = p.teleT / p.teleN;
      var tdx = wrapDx(p.ttx - p.tx0);
      p.x = p.tx0 + tdx * tu;
      p.y = p.ty0 + (p.tty - p.ty0) * tu;
      if (p.x < -PW) p.x += LW;
      if (p.x > LW) p.x -= LW;
      p.vx = 0; p.vy = 0;
      if (p.teleT >= p.teleN) {
        p.teleN = 0;
        p.x = p.ttx; p.y = p.tty; p.prevY = p.y; p.vy = JUMP_V; p.vx = 0; p.squash = 6;
        spawnParts(w, p.x + 6, p.y + 8, 16, "#e8c8ff", 2.6, 0, 2);
      }
      var tmh = Math.max(0, -(p.y + PH));
      if (tmh > p.maxH) { addCharge(p, "height", (tmh - p.maxH) / PX_PER_M); p.maxH = tmh; }
      continue;
    }
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
        if (!hc.taken && overlapsX(p.x - 2, PW + 4, hc.x, 6) && hc.y + 6 > p.y - 2 && hc.y < p.y + PH + 2) { hc.taken = true; hc.netTell = w.net ? 1 : 0; hc.idx = k; w.runCoins += 1; addCharge(p, "coins", 1); spawnParts(w, hc.x + 3, hc.y + 3, 6, "#ffe07a", 1.8, 0, 1); }
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
    else if (inp.ax || dir) {
      /* Touch, keys and tilt share one accel / cap path so left/right and devices match. */
      var cap = p.iceT > 0 ? MAX_VX * 1.15 : MAX_VX;
      var target: number;
      if (inp.ax) {
        target = cap * clamp(inp.ax, -1, 1);
        dir = inp.ax < -0.12 ? -1 : inp.ax > 0.12 ? 1 : 0;
      } else {
        target = dir * cap;
      }
      var want = target - p.vx;
      var acc = (target * p.vx < 0) ? TURN_ACCEL : ACCEL;
      if (Math.abs(want) <= acc) p.vx = target;
      else p.vx += (want < 0 ? -1 : 1) * acc;
      p.vx = clamp(p.vx, -cap, cap);
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
      var isHole = h.kind === "hole";
      var crx = (h.w || (isHole ? HOLE_W : 14)) / 2, cry = (h.h || (isHole ? HOLE_H : 14)) / 2;
      var hx = wrapDx(h.x + crx - (p.x + PW / 2)), hy = h.y + cry - (p.y + PH / 2);
      var dist = Math.sqrt(hx * hx + hy * hy);
      var killR = isHole ? HOLE_KILL_RADIUS : 6;
      var pullR = isHole ? crx * HOLE_PULL_RANGE_MUL : 36;
      if (dist < killR) { hurt(w, p, "hole", h); if (!p.alive) break; continue; }
      if (dist < pullR && !invuln(p)) {
        var fpull = (isHole ? HOLE_PULL_ACCEL : 0.11) * (1 - dist / pullR);
        if (isHole && fpull > HOLE_PULL_ACCEL_CAP) fpull = HOLE_PULL_ACCEL_CAP;
        p.vx += (hx / dist) * fpull;
        p.vy += (hy / dist) * fpull * (isHole ? HOLE_PULL_VY : 0.6);
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
        if (q.y > p.camY + LH) continue;
        if (pf <= q.y + 3 && feet >= q.y && overlapsX(p.x + LAND_PAD_X, PW - LAND_PAD_X * 2, q.x, q.w)) {
          if (p.poundT > 0 && (q.type === "break" || q.type === "cloud")) { q.broken = true; q.breakT = 14; if (w.net && q.type === "break") q.netTell = 1; spawnParts(w, q.x + q.w / 2, q.y + 2, 12, C.brk, 2.6, 0.22, 2); if (p.id === 0) w.shake = 3; continue; }
          landOn(w, p, q); break;
        }
      }
    }
    for (k = 0; k < w.monsters.length; k++) {
      var m2 = w.monsters[k];
      if (!m2.alive || m2.b === "pull" || m2.b === "wind") continue;
      if ((m2.kind === "blob" || m2.kind === "magma") && p.id === 0) {
        var sdx = wrapDx((m2.x + m2.w / 2) - (p.x + PW / 2));
        var sdy = (m2.y + m2.h / 2) - (p.y + PH / 2);
        var threat = Math.abs(sdx) < 36 && sdy > -28 && sdy < 40;
        if (threat && !m2.warn) { m2.warn = 1; hopSfx("warn"); hopVib(8); }
        if (threat) m2.warnT = 18;
      }
      var bb = mobBox(m2);
      if (overlapsX(p.x + HURT_PAD_X, PW - HURT_PAD_X * 2, bb[0] + 1, bb[2] - 2) && p.y + HURT_PAD_Y < bb[1] + bb[3] && p.y + PH > bb[1]) {
        var mid = bb[1] + bb[3] / 2;
        var fromAbove = p.vy > 0 && ((p.y + PH <= mid) || (p.prevY + PH <= mid) || p.y + PH - bb[1] < 9 || p.prevY + PH <= bb[1] + 5);
        if (m2.kind === "trash" && !fromAbove) { bumpOffTrash(w, p, m2); continue; }
        if (p.rocketT > 0 || p.dashT > 0 || p.poundT > 0 || p.domeT > 0) { killMob(w, m2, p, true); continue; }
        if (mobFrozen) { if (p.vy > 0 && p.prevY + PH <= bb[1] + 5) killMob(w, m2, p); continue; }
        var stompable = !(m2.b === "puff" && m2.big);
        var stomped = false;
        if (stompable && p.vy > 0) {
          if (m2.b === "snake") {
            /* Falling, feet at or above the head centre: stomp. Side or below: existing grab. */
            stomped = (p.y + PH <= mid) || (p.prevY + PH <= mid);
          } else if (m2.kind === "trash") {
            /* Use the same boundary as the bounce check so contact never hurts the player. */
            stomped = fromAbove;
          } else {
            stomped = (p.y + PH - bb[1] < 9 || p.prevY + PH <= bb[1] + 5);
          }
        }
        if (stomped) killMob(w, m2, p);
        else if (m2.b === "snake") { grabPlayer(w, p, m2); if (p.grabT > 0) break; }
        else { hurt(w, p, "mob", m2); if (!p.alive) break; }
      }
    }
    if (!p.alive) continue;
    for (k = 0; k < w.bullets.length; k++) {
      var bl = w.bullets[k];
      if (bl.life <= 0) continue;
      if (overlapsX(p.x + HURT_PAD_X, PW - HURT_PAD_X * 2, bl.x - 1, 3) && bl.y + 4 > p.y + 2 && bl.y < p.y + PH) {
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
          /* MAGNET_RADIUS was 70. Attract range only; the aura sprite is not derived from this. */
          if (md < MAGNET_RADIUS && md > 0.5) { var ms = Math.min(md, 3.4); cn.x += (mdx / md) * ms; cn.y += (mdy / md) * ms; }
        }
        if (overlapsX(p.x, PW, cn.x, 6) && cn.y + 6 > p.y && cn.y < p.y + PH) {
          cn.taken = true;
          cn.netTell = w.net ? 1 : 0;
          cn.idx = k;
          w.runCoins += 1;
          addCharge(p, "coins", 1);
          spawnParts(w, cn.x + 3, cn.y + 3, 6, "#ffe07a", 1.8, 0, 1);
          hopSfx("coin");
        }
      }
      for (k = 0; k < w.items.length; k++) {
        var it = w.items[k];
        if (!it.taken && overlapsX(p.x, PW, it.x - 2, 14) && it.y + 12 > p.y && it.y - 2 < p.y + PH) {
          it.idx = k;
          pickItem(w, p, it);
          if (w.net) it.netTell = 1;
        }
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
    /* Pressure to climb: after ~7s without a new max height, the bottom edge creeps up.
       A climber resets stallT every jump. After ~15s idle the floor catches a camper. */
    if (!cp.remote && w.tick > 80) {
      if (cp.maxH > (cp.stallH || 0) + 0.5) { cp.stallH = cp.maxH; cp.stallT = 0; }
      else cp.stallT = (cp.stallT || 0) + 1;
      if (cp.stallT > 350) cp.camY -= 0.28;
    }
    if (cp.camY < minCam) minCam = cp.camY;
  }
  w.cameraY = w.players[0].camY;
  if (minCam < 1e9) generateUntil(w, minCam - 80);
  w.fallWarn = 0; w.liftWarn = 0;
  for (i = 0; i < w.players.length; i++) {
    var ep = w.players[i];
    if (!ep.alive || ep.remote) continue;
    if (ep.stallT > 350) w.liftWarn = 1;
    /* Visible/audible warning just before falling off the bottom. */
    if (ep.vy >= 0 && ep.y + PH > ep.camY + LH - 28 && ep.y <= ep.camY + LH) {
      w.fallWarn = 1;
      if (ep.id === 0 && (w.warnSfxT || 0) <= 0) { hopSfx("warn"); w.warnSfxT = 22; }
    }
    /* Below the bottom edge is always death. Platforms below the edge no longer land.
       BUG-14: if already bouncing (vy < 0) at the rim, do not kill. */
    /* Below the bottom edge is always death. Shield (bonus or robot) does not save a fall. */
    if (w.tick > 80 && ep.vy >= 0 && ep.y > ep.camY + LH) {
      killPlayer(w, ep, "fall");
    }
  }
  if (w.warnSfxT > 0) w.warnSfxT--;
  for (i = w.particles.length - 1; i >= 0; i--) {
    var pt = w.particles[i];
    pt.x += pt.vx; pt.y += pt.vy; pt.vy += pt.g; pt.vx *= 0.97;
    if (--pt.life <= 0) w.particles.splice(i, 1);
  }
  for (i = w.items.length - 1; i >= 0; i--) {
    if (w.items[i].popT > 0) w.items[i].popT--;
    if (w.items[i].taken && !(w.items[i].popT > 0)) w.items.splice(i, 1);
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
    w.monsters = w.monsters.filter(function (a: any) { return (a.home ? a.home.y : a.y) < cut; });
    w.coins = w.coins.filter(function (a: any) { return a.y < cut && !a.taken; });
    w.items = w.items.filter(function (a: any) { return a.y < cut && (!a.taken || a.popT > 0); });
    w.bullets = w.bullets.filter(function (a: any) { return a.y < cut; });
  }
  var alive = 0;
  for (i = 0; i < w.players.length; i++) if (w.players[i].alive) alive++;
  var me = w.players[0];
  if (w.net) { /* net: the server ends the round (NET.frame calls finish) */
  } else if (w.mode === "solo") {
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

