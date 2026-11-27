/* v1.0 wave 1: draw helpers for the 64 px art (ART64 from 01b_art64.tsx).
   One art pixel = 0.5 game px everywhere (hero sheets, platforms, spring, coin), so these share one pixel grid.
   Map backgrounds (city, jungle) are 1 px = 1 game px (= 2 art px): the studio has no 320-grid version yet.
   Pure drawing: no physics, hitbox, spawn or balance data is read or written here. */
var art64Cache: any = {};
function art64Cv(key: string, src: string) {
  if (art64Cache[key] === undefined) art64Cache[key] = src ? pngToCanvas(src) || null : null;
  return art64Cache[key];
}
function art64Plat(p: any, map: string) {
  var t = p.type;
  if (t === "break" || t === "move" || t === "bounce" || t === "ice" || t === "lava" || t === "bubble" || t === "grav" || t === "cloud") return t;
  return "normal_" + (ART64.plat["normal_" + map] ? map : "city");
}
/** 9-slice platform sprite: 8 art px caps, middle tiled 1:1. Landing row sits on the platform's top y. */
function drawPlat64(ctx: Ctx, p: any, x: number, y: number, w: number, map: string, dy: number): boolean {
  var key = art64Plat(p, map), m = ART64.plat[key];
  if (!m) return false;
  var cv = art64Cv("p:" + key, m.src);
  if (!cv) return false;
  var aw = w * 2, cap = 8, mid = m.w - cap * 2;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.translate(x, y + dy - m.land * 0.5);
  ctx.scale(0.5, 0.5);
  if (key === "move" && p.vx > 0) { ctx.translate(aw, 0); ctx.scale(-1, 1); }
  ctx.drawImage(cv, 0, 0, cap, m.h, 0, 0, cap, m.h);
  for (var ax = cap; ax < aw - cap; ax += mid) {
    var cw = Math.min(mid, aw - cap - ax);
    ctx.drawImage(cv, cap, 0, cw, m.h, ax, 0, cw, m.h);
  }
  ctx.drawImage(cv, m.w - cap, 0, cap, m.h, aw - cap, 0, cap, m.h);
  ctx.restore();
  return true;
}
/** Spring on top of a platform: centred, its bottom row on the platform's top outline row. */
function drawSpring64(ctx: Ctx, p: any, x: number, y: number, w: number): boolean {
  var key = p.springT > 0 ? "spring_compressed" : "spring", m = ART64.plat[key];
  if (!m) return false;
  var cv = art64Cv("p:" + key, m.src);
  if (!cv) return false;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.translate(x, y);
  ctx.scale(0.5, 0.5);
  ctx.drawImage(cv, Math.round(w - m.w / 2), 1 - m.h);
  ctx.restore();
  return true;
}
/** World coin (pickup box unchanged: the old 6x6 coin centre is kept, the art is 14x14 game px). */
function drawCoin64(ctx: Ctx, x: number, y: number, t: number): boolean {
  var m = ART64.coin, cv = art64Cv("coin", m.src);
  if (!cv) return false;
  var f = Math.floor(t / 7) % m.n;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.translate(x + 3 - m.cw / 4, y + 3 - m.ch / 4);
  ctx.scale(0.5, 0.5);
  ctx.drawImage(cv, f * m.cw, 0, m.cw, m.ch, 0, 0, m.cw, m.ch);
  ctx.restore();
  return true;
}
function bg64(map: string) { return (ART64 && ART64.bg && ART64.bg[map]) ? ART64.bg[map] : null; }
/** A full-width background strip (160 px tile), tiled over the side padding; below it, the bottom colour. */
function drawBgStrip64(ctx: Ctx, b: any, k: string, top: number) {
  var cv = art64Cv("bg:" + b.__id + k, b[k]);
  if (!cv) return;
  top = Math.round(top);
  if (top >= viewY1()) return;
  var w = b[k + "W"], h = b[k + "H"];
  ctx.imageSmoothingEnabled = false;
  /* v1.0: the strips are 160-wide panels drawn on a 180+ wide view. Centre one on the field and mirror its
     neighbours, so the joins are continuous instead of a hard vertical seam. Art is unchanged. */
  var xc = Math.round((LW - w) / 2);
  var n0 = Math.floor((viewX0() - xc) / w);
  var y1v = viewY1();
  if (top + h < y1v) rect(ctx, viewX0(), top + h, viewW(), y1v - top - h, b[k + "Fill"]);
  for (var n = n0; xc + n * w < LW + VIEW_PAD; n++) {
    var tx = xc + n * w;
    if ((n & 1) === 0) ctx.drawImage(cv, tx, top);
    else { ctx.save(); ctx.translate(tx + w, top); ctx.scale(-1, 1); ctx.drawImage(cv, 0, 0); ctx.restore(); }
  }
}
/* First strip row (from the top) that is opaque across the whole width: anything stacked behind may end
   there and stay hidden. Measured once from the packed art. */
function stripSolidRow64(b: any, k: string) {
  var key = "__solid" + k;
  if (b[key] != null) return b[key];
  var cv: any = art64Cv("bg:" + b.__id + k, b[k]);
  var h = b[k + "H"] || 0, w = b[k + "W"] || 0, row = h;
  try {
    var d = cv.getContext("2d").getImageData(0, 0, w, h).data;
    for (var y = 0; y < h && row === h; y++) {
      var ok = true;
      for (var x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] < 250) { ok = false; break; }
      if (ok) row = y;
    }
  } catch (_e) { row = h; }
  b[key] = row;
  return row;
}
function drawBgSprite64(ctx: Ctx, b: any, k: string, src: string, x: number, y: number) {
  var cv = art64Cv("bg:" + b.__id + k, src);
  if (!cv) return;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(cv, Math.round(x), Math.round(y));
}
if (typeof ART64 !== "undefined" && ART64.bg) { for (var _bgk in ART64.bg) if (ART64.bg[_bgk]) ART64.bg[_bgk].__id = _bgk; }
/* v1.0 final backgrounds: Design's layers (160x346, 1 px = 1 game px), placed as they look at their "shown"
   height (L[name].m). Pure drawing; positions follow the old procedural formulas (README anchors). */
function bgL(map: string, name: string) { var b = bg64(map); return b && b.L ? b.L[name] || null : null; }
function bgLCv(map: string, name: string) { var l = bgL(map, name); return l ? art64Cv("bgL:" + map + name, l.src) : null; }
/** Object layer (sun, moon, planet) at its box position moved by dy. */
function drawBgObj64(ctx: Ctx, map: string, name: string, dy: number) {
  var l = bgL(map, name), cv = bgLCv(map, name);
  if (!l || !cv) return;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(cv, l.x, Math.round(l.y + dy));
}
/** Full-width band (aurora, sunbeams): centred on the field, neighbours mirrored over the side margins. */
function drawBgBand64(ctx: Ctx, map: string, name: string, dy: number) {
  var l = bgL(map, name), cv = bgLCv(map, name);
  if (!l || !cv) return;
  ctx.imageSmoothingEnabled = false;
  var W = 160, xc = Math.round((LW - W) / 2), y = Math.round(l.y + dy);
  for (var n = Math.floor((viewX0() - xc) / W); xc + n * W < LW + VIEW_PAD; n++) {
    var tx = xc + n * W;
    if ((n & 1) === 0) ctx.drawImage(cv, tx + l.x, y);
    else { ctx.save(); ctx.translate(tx + W, y); ctx.scale(-1, 1); ctx.drawImage(cv, l.x, 0); ctx.restore(); }
  }
}
/** Moving field (stars, clouds, snow, embers, bubbles, nebulae, asteroids): a 160x346 tile repeated every
   `cycle` rows and every 160 columns; `off` is the vertical scroll and `xo` the horizontal drift. */
function drawBgTile64(ctx: Ctx, map: string, name: string, off: number, cycle: number, xo: number) {
  var l = bgL(map, name), cv = bgLCv(map, name);
  if (!l || !cv) return;
  ctx.imageSmoothingEnabled = false;
  var W = l.w, H = l.h, y0 = Math.round(mod(off, cycle)), x0 = Math.round(mod(xo, W));
  var top = viewY0() - VIEW_TOPPAD, bot = viewY1();
  for (var y = y0 - cycle * Math.ceil((y0 + H - top) / cycle); y < bot; y += cycle) {
    if (y + H <= top) continue;
    for (var x = x0 - W * Math.ceil((x0 - viewX0()) / W); x < LW + VIEW_PAD; x += W) ctx.drawImage(cv, x, y);
  }
}
