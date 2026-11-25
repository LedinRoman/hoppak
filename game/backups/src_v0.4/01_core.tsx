import { useEffect, useRef } from "grok/canvas";

/* Хоппак v0.4 — pixel-art jumper for friends.
   Single source of truth: this file. hoppak.js is generated from it (build.sh). */
type Ctx = CanvasRenderingContext2D;

var LW = 160;
var LH = 346;
var PX_PER_M = 8;
var PW = 12;
var PH = 16;
var GRAVITY = 0.19;
var JUMP_V = -5.55;
var JUMP_H = (JUMP_V * JUMP_V) / (2 * GRAVITY); /* ~81 px */
var SPRING_V = -8.15;
var STOMP_V = -5.2;
var MAX_VX = 2.7;
var ACCEL = 0.16;
var TURN_ACCEL = 0.24;
var AIR_FRIC = 0.91;
var ICE_FRIC = 0.975;
var STEP = 1 / 50; /* slowed in v0.1.1, keep */
var ROW_SEP = 22; /* min vertical distance between platform rows */
var GAP_CAP = Math.floor(JUMP_H - 18); /* hard max gap, ~63 px: always reachable with margin */
var X_SEP = 10; /* min horizontal gap between platforms of one row */
var INK = "#0c0818";

var C: any = {
  navy: "#162040", cream: "#f6ecd0", coral: "#ff645e", mint: "#62e6be", ink: INK,
  wood: "#c48448", woodD: "#8a5a28", woodL: "#e0a868", edge: "#5ee0d0",
  spring: "#d4dce6", springD: "#7a869a",
  brk: "#e85096", brkD: "#8a2860", brkRim: "#ffd0ea",
  mov: "#3a8ec8", movD: "#1e5a86",
  red: "#ff5a62", gold: "#ffd046", goldD: "#b07a10", silver: "#b8c0d0", bronze: "#c48448",
  brick: "#463a64", brickL: "#5a4c82", roof: "#342a4e"
};

var CHARS: any[] = [
  { name: "Рома", hood: "#e85a4f", cap: "#d4453c", hair: "#5a3318", pants: "#3a4a7a", shoes: "#8a2030", capOn: true, girl: false, bow: false },
  { name: "Лера", hood: "#4ec8a0", cap: "#3db38c", hair: "#2a2218", pants: "#2d4a5a", shoes: "#1e6a58", capOn: true, girl: true, bow: false },
  { name: "Макс", hood: "#f0c03a", cap: "#e0a020", hair: "#6a4020", pants: "#4a3a28", shoes: "#8a5010", capOn: true, girl: false, bow: false },
  { name: "Катя", hood: "#3a7ad4", cap: "#3a7ad4", hair: "#6a3a1c", pants: "#2a3a78", shoes: "#1a3a88", capOn: false, girl: true, bow: true }
];
var COLORS: any[] = [
  { id: "base", name: "РОДНОЙ", price: 0, hood: "" },
  { id: "mint", name: "МЯТА", price: 40, hood: "#5ed6b4" },
  { id: "pink", name: "НЕОН", price: 60, hood: "#ff5ab0" },
  { id: "night", name: "НОЧЬ", price: 80, hood: "#4c4478" },
  { id: "gold", name: "ЗОЛОТО", price: 150, hood: "#f0c03a" }
];
var HATS: any[] = [
  { id: "none", name: "РОДНАЯ", price: 0 },
  { id: "horns", name: "РОЖКИ", price: 50 },
  { id: "phones", name: "ПЛЕЕР", price: 60 },
  { id: "wizard", name: "КОЛПАК", price: 80 },
  { id: "crown", name: "КОРОНА", price: 120 }
];
var MAPS: any[] = [
  { id: "city", name: "ГОРОД", price: 0, special: "" },
  { id: "jungle", name: "ДЖУНГЛИ", price: 80, special: "bounce" },
  { id: "ice", name: "ЛЕДНИК", price: 100, special: "ice" },
  { id: "lava", name: "ВУЛКАН", price: 120, special: "lava" },
  { id: "aqua", name: "ОКЕАН", price: 140, special: "bubble" },
  { id: "space", name: "КОСМОС", price: 160, special: "grav" }
];
/* mob kinds: appear from height (m), need a vertical gap to fit */
var MOBS: any = {
  blob: { from: 120, w: 12, h: 8, gap: 0 },
  bat: { from: 400, w: 14, h: 10, gap: 34 },
  bob: { from: 800, w: 12, h: 12, gap: 34 },
  hole: { from: 1500, w: 14, h: 14, gap: 44 },
  ufo: { from: 2200, w: 14, h: 8, gap: 34 }
};

var FONT: any = {
  "0": [14, 17, 19, 21, 25, 17, 14], "1": [4, 12, 4, 4, 4, 4, 14], "2": [14, 17, 1, 2, 4, 8, 31],
  "3": [14, 17, 1, 6, 1, 17, 14], "4": [2, 6, 10, 18, 31, 2, 2], "5": [31, 16, 30, 1, 1, 17, 14],
  "6": [14, 16, 16, 30, 17, 17, 14], "7": [31, 1, 2, 4, 8, 8, 8], "8": [14, 17, 17, 14, 17, 17, 14],
  "9": [14, 17, 17, 15, 1, 1, 14], " ": [0, 0, 0, 0, 0, 0, 0], ".": [0, 0, 0, 0, 0, 12, 12],
  ":": [0, 12, 12, 0, 12, 12, 0], ",": [0, 0, 0, 0, 12, 4, 8], "-": [0, 0, 0, 14, 0, 0, 0],
  "+": [0, 4, 4, 31, 4, 4, 0], "?": [14, 17, 1, 2, 4, 0, 4], "!": [4, 4, 4, 4, 4, 0, 4],
  "<": [1, 2, 4, 8, 4, 2, 1], ">": [16, 8, 4, 2, 4, 8, 16], "/": [1, 1, 2, 4, 8, 16, 16], "(": [2, 4, 8, 8, 8, 4, 2], ")": [8, 4, 2, 2, 2, 4, 8],
  "А": [14, 17, 17, 31, 17, 17, 17], "Б": [30, 16, 16, 30, 17, 17, 30], "В": [30, 17, 17, 30, 17, 17, 30],
  "Г": [31, 16, 16, 16, 16, 16, 16], "Д": [7, 9, 9, 9, 9, 31, 17], "Е": [31, 16, 16, 30, 16, 16, 31],
  "Ё": [10, 31, 16, 30, 16, 16, 31], "Ж": [21, 21, 14, 4, 14, 21, 21], "З": [14, 17, 1, 6, 1, 17, 14],
  "И": [17, 17, 19, 21, 25, 17, 17], "Й": [10, 17, 19, 21, 25, 17, 17], "К": [17, 18, 20, 24, 20, 18, 17],
  "Л": [7, 9, 9, 9, 9, 9, 17], "М": [17, 27, 21, 21, 17, 17, 17], "Н": [17, 17, 17, 31, 17, 17, 17],
  "О": [14, 17, 17, 17, 17, 17, 14], "П": [31, 17, 17, 17, 17, 17, 17], "Р": [30, 17, 17, 30, 16, 16, 16],
  "С": [14, 17, 16, 16, 16, 17, 14], "Т": [31, 4, 4, 4, 4, 4, 4], "У": [17, 17, 17, 15, 1, 17, 14],
  "Ф": [4, 14, 21, 21, 14, 4, 4], "Х": [17, 17, 10, 4, 10, 17, 17], "Ц": [17, 17, 17, 17, 17, 31, 1],
  "Ч": [17, 17, 17, 15, 1, 1, 1], "Ш": [17, 17, 17, 21, 21, 21, 31], "Щ": [17, 21, 21, 21, 31, 1, 1],
  "Ъ": [24, 8, 14, 9, 9, 9, 14], "Ы": [17, 17, 17, 29, 19, 19, 29], "Ь": [16, 16, 16, 30, 17, 17, 30],
  "Э": [14, 17, 1, 7, 1, 17, 14], "Ю": [17, 21, 21, 29, 21, 21, 17], "Я": [15, 17, 17, 15, 5, 9, 17]
};

function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    var t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function clamp(v: number, a: number, b: number) { return v < a ? a : v > b ? b : v; }
function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }
function randInt(r: any, a: number, b: number) { return a + Math.floor(r() * (b - a + 1)); }
function mod(a: number, n: number) { return ((a % n) + n) % n; }
function band(v: number, a: number, b: number, c: number, d: number) {
  if (v <= a || v >= d) return 0;
  if (v < b) return (v - a) / (b - a);
  if (v <= c) return 1;
  return (d - v) / (d - c);
}
function difficulty(m: number) {
  if (m <= 0) return 0;
  if (m < 600) return (0.28 * m) / 600;
  return 0.28 + 0.72 * (1 - Math.exp(-(m - 600) / 1800));
}
function mapInfo(id: string) {
  for (var i = 0; i < MAPS.length; i++) if (MAPS[i].id === id) return MAPS[i];
  return MAPS[0];
}
function storageGet(k: string) {
  try { return typeof localStorage === "undefined" ? null : localStorage.getItem(k); } catch (_e) { return null; }
}
function storageSet(k: string, v: string) {
  try { if (typeof localStorage !== "undefined") localStorage.setItem(k, v); } catch (_e) {}
}
function loadSave() {
  var s: any = null;
  try { s = JSON.parse(storageGet("hoppak_save") || "null"); } catch (_e) { s = null; }
  if (!s || typeof s !== "object") s = {};
  if (typeof s.coins !== "number") s.coins = 0;
  if (!s.owned || typeof s.owned !== "object") s.owned = {};
  if (typeof s.char !== "number") {
    var c = parseInt(storageGet("hoppak_char") || "0", 10) || 0;
    s.char = c >= 0 && c < 4 ? c : 0;
  }
  if (!s.color) s.color = "base";
  if (!s.hat) s.hat = "none";
  if (s.owned["bg:sunset"]) s.owned["map:lava"] = 1;
  if (s.owned["bg:neon"]) s.owned["map:space"] = 1;
  if (!s.bg || s.bg === "night") s.bg = "city";
  else if (s.bg === "sunset") s.bg = "lava";
  else if (s.bg === "neon") s.bg = "space";
  if (mapInfo(s.bg).id !== s.bg) s.bg = "city";
  if (typeof s.best !== "number") s.best = parseInt(storageGet("hoppak_best") || "0", 10) || 0;
  return s;
}
function writeSave(s: any) { storageSet("hoppak_save", JSON.stringify(s)); }

function textWidth(s: string, sc: number) { return String(s).length * 6 * sc; }
function drawText(ctx: Ctx, s: string, x: number, y: number, color: string, sc?: number, align?: string) {
  var k = sc || 1;
  s = String(s).toUpperCase();
  var w = textWidth(s, k) - k;
  var xx = Math.round(align === "center" ? x - w / 2 : align === "right" ? x - w : x);
  y = Math.round(y);
  ctx.fillStyle = color;
  for (var i = 0; i < s.length; i++) {
    var g = FONT[s[i]] || FONT["?"];
    for (var r = 0; r < 7; r++) for (var c = 0; c < 5; c++) if (g[r] & (1 << (4 - c))) ctx.fillRect(xx + c * k, y + r * k, k, k);
    xx += 6 * k;
  }
  return w;
}
function rect(ctx: Ctx, x: number, y: number, w: number, h: number, col: string) {
  ctx.fillStyle = col;
  ctx.fillRect(Math.round(x), Math.round(y), w, h);
}
function shade(hex: string, dl: number) {
  var n = parseInt(hex.slice(1), 16);
  var r = clamp(((n >> 16) & 255) + dl, 0, 255), g = clamp(((n >> 8) & 255) + dl, 0, 255), b = clamp((n & 255) + dl, 0, 255);
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}
function mixHex(a: string, b: string, t: number) {
  var x = parseInt(a.slice(1), 16), y = parseInt(b.slice(1), 16);
  var r = Math.round(lerp((x >> 16) & 255, (y >> 16) & 255, t));
  var g = Math.round(lerp((x >> 8) & 255, (y >> 8) & 255, t));
  var bl = Math.round(lerp(x & 255, y & 255, t));
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + bl).toString(16).slice(1);
}
function box(ctx: Ctx, x: number, y: number, w: number, h: number, fill: string, border?: string) {
  rect(ctx, x + 1, y + h, w, 1, "rgba(0,0,0,0.35)");
  rect(ctx, x, y, w, h, fill);
  ctx.fillStyle = border || C.cream;
  ctx.fillRect(x, y, w, 1); ctx.fillRect(x, y + h - 1, w, 1); ctx.fillRect(x, y, 1, h); ctx.fillRect(x + w - 1, y, 1, h);
  rect(ctx, x + 1, y + h - 2, w - 2, 1, "rgba(0,0,0,0.2)");
}
function drawCoin(ctx: Ctx, x: number, y: number, t: number) {
  var ws = [6, 4, 2, 4];
  var w = ws[Math.floor(t / 7) % 4];
  var xx = Math.round(x + (6 - w) / 2);
  rect(ctx, xx, y, w, 6, C.gold);
  rect(ctx, xx, y + 5, w, 1, C.goldD);
  if (w > 2) { rect(ctx, xx, y, w, 1, "#ffe07a"); rect(ctx, xx + 1, y + 1, 1, 2, "#fff4c0"); }
}
function makeLook(kind: number, color: string, hat: string) {
  var b = CHARS[kind] || CHARS[0];
  var o: any = {};
  for (var k in b) o[k] = b[k];
  for (var i = 0; i < COLORS.length; i++) if (COLORS[i].id === color && COLORS[i].hood) o.hood = COLORS[i].hood;
  o.hat = hat || "none";
  return o;
}
function drawJumper(ctx: Ctx, x: number, y: number, lk: any, face: number, pose: string, blink: boolean, alive: boolean, sc?: number) {
  var s = sc || 1;
  x = Math.round(x); y = Math.round(y);
  var flip = face < 0;
  var parts: any[] = [];
  function P(dx: number, dy: number, w: number, h: number, col: string) { parts.push([dx, dy, w, h, col]); }
  var sq = pose === "squash", up = pose === "up", fall = pose === "fall";
  var o = sq ? 2 : 0;
  var skin = "#f0c8a0", skinD = "#d09870", white = "#fff6e8";
  var hood = lk.hood, hoodL = shade(hood, 34), hoodD = shade(hood, -38);
  var hair = lk.hair;
  if (sq) { P(2, 14, 3, 1, lk.pants); P(7, 14, 3, 1, lk.pants); P(1, 15, 4, 1, lk.shoes); P(7, 15, 4, 1, lk.shoes); }
  else if (up) { P(4, 13, 2, 2, lk.pants); P(6, 13, 2, 2, shade(lk.pants, -18)); P(3, 15, 3, 1, lk.shoes); P(6, 15, 3, 1, lk.shoes); }
  else if (fall) { P(2, 13, 2, 2, lk.pants); P(8, 13, 2, 2, lk.pants); P(1, 15, 3, 1, lk.shoes); P(8, 15, 3, 1, lk.shoes); }
  else { P(3, 13, 2, 2, lk.pants); P(7, 13, 2, 2, lk.pants); P(2, 15, 3, 1, lk.shoes); P(7, 15, 3, 1, lk.shoes); }
  if (up) { P(1, 5, 1, 4, hood); P(10, 5, 1, 4, hood); P(1, 4, 1, 1, skin); P(10, 4, 1, 1, skin); }
  else if (fall) { P(0, 8, 2, 1, hood); P(10, 8, 2, 1, hood); P(0, 7, 1, 1, skin); P(11, 7, 1, 1, skin); }
  else if (sq) { P(0, 11, 1, 2, hood); P(11, 11, 1, 2, hood); P(0, 13, 1, 1, skin); P(11, 13, 1, 1, skin); }
  else { P(1, 9, 1, 3, hood); P(10, 9, 1, 3, hood); P(1, 12, 1, 1, skin); P(10, 12, 1, 1, skin); }
  if (sq) { P(1, 10, 10, 4, hood); P(2, 10, 1, 3, hoodL); P(9, 11, 1, 3, hoodD); P(4, 12, 4, 1, hoodD); }
  else { P(2, 8, 8, 5, hood); P(3, 9, 1, 3, hoodL); P(8, 9, 1, 4, hoodD); P(4, 11, 4, 1, hoodD); P(5, 8, 2, 1, hoodD); }
  if (lk.girl && !lk.capOn) { P(1, 3 + o, 2, 2, hair); P(0, 5 + o, 2, 3, hair); P(1, 8 + o, 1, 2, hair); }
  if (lk.girl && lk.capOn) P(1, 3 + o, 2, 4, hair);
  P(3, 2 + o, 6, 6, skin); P(3, 7 + o, 6, 1, skinD);
  P(3, 1 + o, 6, 2, hair); P(2, 2 + o, 1, 4, hair); P(3, 3 + o, 1, 1, hair);
  if (!alive) { P(4, 4 + o, 1, 1, INK); P(5, 5 + o, 1, 1, INK); P(7, 4 + o, 1, 1, INK); P(8, 5 + o, 1, 1, INK); }
  else if (blink) { P(4, 5 + o, 2, 1, INK); P(7, 5 + o, 2, 1, INK); }
  else { P(4, 4 + o, 2, 2, white); P(7, 4 + o, 2, 2, white); P(5, 4 + o, 1, 2, INK); P(8, 4 + o, 1, 2, INK); }
  P(6, 6 + o, 2, 1, up ? "#6a2030" : "#c06060");
  var hat = lk.hat || "none";
  if (hat === "none") {
    if (lk.capOn) { P(2, 1 + o, 8, 2, lk.cap); P(3, 0 + o, 6, 1, lk.cap); P(9, 2 + o, 3, 1, shade(lk.cap, -30)); P(4, 0 + o, 2, 1, shade(lk.cap, 30)); }
    if (lk.bow) { P(1, 0 + o, 2, 2, "#f070a0"); P(0, 1 + o, 1, 1, "#f070a0"); P(3, 1 + o, 1, 1, "#ff9ac0"); }
  } else if (hat === "crown") {
    P(3, -1 + o, 6, 2, C.gold); P(3, -2 + o, 1, 1, C.gold); P(5, -3 + o, 2, 2, C.gold); P(8, -2 + o, 1, 1, C.gold); P(5, -1 + o, 2, 1, C.red);
  } else if (hat === "wizard") {
    P(2, 0 + o, 8, 2, "#6a3ac8"); P(3, -2 + o, 6, 2, "#6a3ac8"); P(4, -4 + o, 4, 2, "#6a3ac8"); P(5, -6 + o, 2, 2, "#6a3ac8"); P(5, -2 + o, 1, 1, C.gold); P(7, -4 + o, 1, 1, C.gold);
  } else if (hat === "phones") {
    P(3, 0 + o, 6, 1, "#2a2a3a"); P(2, 1 + o, 1, 1, "#2a2a3a"); P(9, 1 + o, 1, 1, "#2a2a3a"); P(1, 3 + o, 2, 3, C.red); P(9, 3 + o, 2, 3, C.red);
  } else if (hat === "horns") {
    P(3, 0 + o, 2, 1, "#f0e0d0"); P(7, 0 + o, 2, 1, "#f0e0d0"); P(2, -1 + o, 2, 1, "#f0e0d0"); P(8, -1 + o, 2, 1, "#f0e0d0"); P(2, -2 + o, 1, 1, "#d0c0b0"); P(9, -2 + o, 1, 1, "#d0c0b0");
  }
  var pass, i, p, xx;
  for (pass = 0; pass < 2; pass++) {
    for (i = 0; i < parts.length; i++) {
      p = parts[i];
      xx = flip ? x + (12 - p[0] - p[2]) * s : x + p[0] * s;
      if (pass === 0) { ctx.fillStyle = INK; ctx.fillRect(xx - s, y + p[1] * s - s, (p[2] + 2) * s, (p[3] + 2) * s); }
      else { ctx.fillStyle = p[4]; ctx.fillRect(xx, y + p[1] * s, p[2] * s, p[3] * s); }
    }
  }
}
