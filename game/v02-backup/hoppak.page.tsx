import { useEffect, useRef } from "grok/canvas";

type Ctx = CanvasRenderingContext2D;
type CharDef = {
  id: string;
  name: string;
  hood: string;
  cap: string;
  hair: string;
  pants: string;
  shoes: string;
  capOn: boolean;
  girl: boolean;
  bow: boolean;
};
type Plat = {
  id: number;
  x: number;
  y: number;
  w: number;
  type: string;
  vx: number;
  broken: boolean;
  breakT: number;
  hasSpring: boolean;
};
type Monster = {
  x: number;
  y: number;
  vx: number;
  w: number;
  h: number;
  alive: boolean;
  squish: number;
};
type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  col: string;
  s: number;
};
type Input = { dir: number; ax: number };
type Inputs = { [id: number]: Input };
type Player = {
  id: number;
  kind: number;
  name: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  prevY: number;
  alive: boolean;
  eliminated: boolean;
  maxH: number;
  isBot: boolean;
  skill: number;
  face: number;
  phase: number;
  squash: number;
  dir: number;
  ax: number;
  place: number;
  camY: number;
  _botDir?: number;
  _why?: string;
};
type World = {
  seed: number;
  rng: () => number;
  mode: string;
  platforms: Plat[];
  monsters: Monster[];
  particles: Particle[];
  nextY: number;
  genUpTo: number;
  cameraY: number;
  startY: number;
  tick: number;
  shake: number;
  phase: string;
  resultT: number;
  players: Player[];
  me: number;
  over: boolean;
  finishWait: number;
  newBest?: boolean;
  best?: number;
};
type Hit = { id: string; x: number; y: number; w: number; h: number };
type GameApi = {
  destroy: () => void;
  getPhase: () => string;
  getWorld: () => World | null;
  start: (m?: string, ch?: number, seed?: number) => void;
  menu: () => void;
  rematch: () => void;
  setDir: (d: number) => void;
  killMe: () => void;
  forceResults: () => void;
  getHeight: () => number;
  getMode: () => string;
  getChar: () => number;
};

function emptyApi(): GameApi {
  return {
    destroy: function () {},
    getPhase: function () { return "menu"; },
    getWorld: function () { return null; },
    start: function () {},
    menu: function () {},
    rematch: function () {},
    setDir: function (_d: number) {},
    killMe: function () {},
    forceResults: function () {},
    getHeight: function () { return 0; },
    getMode: function () { return "squad"; },
    getChar: function () { return 0; },
  };
}

  var LW = 160;
  var LH = 346;
  var PX_PER_M = 8;
  var PLAYER_W = 12;
  var PLAYER_H = 16;
  var GRAVITY = 0.19;
  var JUMP_V = -5.55;
  var JUMP_H = (JUMP_V * JUMP_V) / (2 * GRAVITY);
  var SPRING_V = -8.15;
  var MONSTER_V = -5.2;
  var MAX_VX = 3.05;
  var ACCEL = 0.28;
  var AIR_FRIC = 0.86;
  var STEP = 1 / 50; // ~17% slower game speed

  var C = {
    skyTop: "#120a2c",
    skyMid: "#4a1a68",
    skyBot: "#d45a86",
    moon: "#f0d9a0",
    star: "#efe6c8",
    build: "#16102c",
    build2: "#1c1438",
    win: "#f0c45c",
    win2: "#7ec8e8",
    roof: "#2a2438",
    brick: "#3a3050",
    brickL: "#4a4068",
    navy: "#12182e",
    cream: "#f3e6c4",
    coral: "#e85a55",
    mint: "#5ed6b4",
    ink: "#0c0818",
    wood: "#c48448",
    woodD: "#8a5a28",
    edge: "#5ee0d0",
    spring: "#c8d0d8",
    springD: "#8890a0",
    break: "#e85096",
    breakD: "#8a2860",
    breakRim: "#ffd0ea",
    move: "#3a8ec8",
    moveD: "#1e5a86",
    bat: "#7a4ac8",
    bat2: "#c89cff",
    red: "#ff5a62",
    gold: "#f0c03a",
    silver: "#b8c0d0",
    bronze: "#c48448"
  };

  var CHARS = [
    { id: "roma", name: "Рома", hood: "#e85a4f", cap: "#d4453c", hair: "#5a3318", pants: "#3a4a7a", shoes: "#8a2030", capOn: true, girl: false, bow: false },
    { id: "lera", name: "Лера", hood: "#4ec8a0", cap: "#3db38c", hair: "#2a2218", pants: "#2d4a5a", shoes: "#1e6a58", capOn: true, girl: true, bow: false },
    { id: "max", name: "Макс", hood: "#f0c03a", cap: "#e0a020", hair: "#6a4020", pants: "#4a3a28", shoes: "#8a5010", capOn: true, girl: false, bow: false },
    { id: "katya", name: "Катя", hood: "#3a7ad4", cap: "#3a7ad4", hair: "#6a3a1c", pants: "#2a3a78", shoes: "#1a3a88", capOn: false, girl: true, bow: true }
  ];

  /* 5x7 pixel font, 7 rows packed as 5-bit values */
  var FONT: { [k: string]: number[] } = {
    "0": [14, 17, 19, 21, 25, 17, 14],
    "1": [4, 12, 4, 4, 4, 4, 14],
    "2": [14, 17, 1, 2, 4, 8, 31],
    "3": [14, 17, 1, 6, 1, 17, 14],
    "4": [2, 6, 10, 18, 31, 2, 2],
    "5": [31, 16, 30, 1, 1, 17, 14],
    "6": [14, 16, 16, 30, 17, 17, 14],
    "7": [31, 1, 2, 4, 8, 8, 8],
    "8": [14, 17, 17, 14, 17, 17, 14],
    "9": [14, 17, 17, 15, 1, 1, 14],
    " ": [0, 0, 0, 0, 0, 0, 0],
    ".": [0, 0, 0, 0, 0, 12, 12],
    ":": [0, 12, 12, 0, 12, 12, 0],
    "·": [0, 0, 0, 12, 0, 0, 0],
    "-": [0, 0, 0, 14, 0, 0, 0],
    "+": [0, 4, 4, 31, 4, 4, 0],
    "?": [14, 17, 1, 2, 4, 0, 4],
    "!": [4, 4, 4, 4, 4, 0, 4],
    "<": [1, 2, 4, 8, 4, 2, 1],
    ">": [16, 8, 4, 2, 4, 8, 16],
    "*": [0, 4, 21, 14, 21, 4, 0],
    "/": [1, 1, 2, 4, 8, 16, 16],
    "м": [0, 0, 17, 27, 21, 17, 17],
    "А": [14, 17, 17, 31, 17, 17, 17],
    "Б": [30, 16, 16, 30, 17, 17, 30],
    "В": [30, 17, 17, 30, 17, 17, 30],
    "Г": [31, 16, 16, 16, 16, 16, 16],
    "Д": [7, 9, 9, 9, 9, 31, 17],
    "Е": [31, 16, 16, 30, 16, 16, 31],
    "Ё": [10, 31, 16, 30, 16, 16, 31],
    "Ж": [21, 21, 14, 4, 14, 21, 21],
    "З": [14, 17, 1, 6, 1, 17, 14],
    "И": [17, 17, 19, 21, 25, 17, 17],
    "Й": [10, 17, 19, 21, 25, 17, 17],
    "К": [17, 18, 20, 24, 20, 18, 17],
    "Л": [7, 9, 9, 9, 9, 9, 17],
    "М": [17, 27, 21, 21, 17, 17, 17],
    "Н": [17, 17, 17, 31, 17, 17, 17],
    "О": [14, 17, 17, 17, 17, 17, 14],
    "П": [31, 17, 17, 17, 17, 17, 17],
    "Р": [30, 17, 17, 30, 16, 16, 16],
    "С": [14, 17, 16, 16, 16, 17, 14],
    "Т": [31, 4, 4, 4, 4, 4, 4],
    "У": [17, 17, 17, 15, 1, 17, 14],
    "Ф": [4, 14, 21, 21, 14, 4, 4],
    "Х": [17, 17, 10, 4, 10, 17, 17],
    "Ц": [17, 17, 17, 17, 17, 31, 1],
    "Ч": [17, 17, 17, 15, 1, 1, 1],
    "Ш": [17, 17, 17, 21, 21, 21, 31],
    "Щ": [17, 21, 21, 21, 31, 1, 1],
    "Ъ": [24, 8, 14, 9, 9, 9, 14],
    "Ы": [17, 17, 17, 29, 19, 19, 29],
    "Ь": [16, 16, 16, 30, 17, 17, 30],
    "Э": [14, 17, 1, 7, 1, 17, 14],
    "Ю": [17, 21, 21, 29, 21, 21, 17],
    "Я": [15, 17, 17, 15, 5, 9, 17]
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

  function clamp(v: number, a: number, b: number) {
    return v < a ? a : v > b ? b : v;
  }
  function lerp(a: number, b: number, t: number) {
    return a + (b - a) * t;
  }
  function randInt(rng: () => number, a: number, b: number) {
    return a + Math.floor(rng() * (b - a + 1));
  }

  function placePlatformX(rng: () => number, pw: number, avoidX: number, avoidW: number) {
    var tries = 0;
    while (tries++ < 16) {
      var x = randInt(rng, 4, LW - pw - 4);
      if (x + pw < avoidX - 8 || x > avoidX + avoidW + 8) return x;
    }
    var leftMax = avoidX - 8 - pw;
    if (leftMax >= 4) return randInt(rng, 4, leftMax);
    var rightMin = avoidX + avoidW + 8;
    if (rightMin + pw <= LW - 4) return randInt(rng, rightMin, LW - pw - 4);
    return randInt(rng, 4, LW - pw - 4);
  }
  function difficultyT(heightPx: number) {
    var m = heightPx / PX_PER_M;
    if (m <= 0) return 0;
    if (m < 600) return (m / 600) * 0.28;
    if (m < 2000) return 0.28 + ((m - 600) / 1400) * 0.42;
    if (m < 3500) return 0.70 + ((m - 2000) / 1500) * 0.30;
    return 1;
  }


  function storageGet(key: string) {
    try {
      if (typeof localStorage === "undefined") return null;
      return localStorage.getItem(key);
    } catch (_e) {
      return null;
    }
  }
  function storageSet(key: string, val: string) {
    try {
      if (typeof localStorage === "undefined") return false;
      localStorage.setItem(key, val);
      return true;
    } catch (_e) {
      return false;
    }
  }

  function textWidth(s: string, sc: number) {
    return s.length * (5 * sc + sc);
  }
  function drawText(ctx: Ctx, s: string, x: number, y: number, color: string, sc?: number, align?: string) {
    sc = sc || 1;
    s = String(s).toUpperCase();
    var w = textWidth(s, sc);
    var xx = x;
    if (align === "center") xx = Math.round(x - w / 2);
    if (align === "right") xx = Math.round(x - w);
    ctx.fillStyle = color;
    for (var i = 0; i < s.length; i++) {
      var g = FONT[s[i]] || FONT["?"];
      for (var r = 0; r < 7; r++) {
        var bits = g[r];
        for (var c = 0; c < 5; c++) {
          if (bits & (1 << (4 - c))) {
            ctx.fillRect(xx + c * sc, y + r * sc, sc, sc);
          }
        }
      }
      xx += 5 * sc + sc;
    }
    return w;
  }

  function px(ctx: Ctx, x: number, y: number, color: string) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, 1, 1);
  }
  function rect(ctx: Ctx, x: number, y: number, w: number, h: number, color: string) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  }

  function drawJumper(ctx: Ctx, x: number, y: number, ch: CharDef, face: number, phase: number, alive: boolean, sc?: number) {
    /* x,y = top-left of 12x16 sprite */
    var scale = sc || 1;
    x = Math.round(x);
    y = Math.round(y);
    var skin = "#f0c8a0";
    var eye = alive ? "#1a1020" : "#5a3040";
    var hair = ch.hair;
    var hood = ch.hood;
    var cap = ch.cap;
    var pants = ch.pants;
    var shoes = ch.shoes;
    var flip = face < 0;
    function d(dx: number, dy: number, w: number, h: number, col: string) {
      ctx.fillStyle = col;
      var xx = flip ? x + (12 - dx - w) * scale : x + dx * scale;
      ctx.fillRect(xx, y + dy * scale, w * scale, h * scale);
    }
    /* legs */
    var legOff = phase ? 1 : 0;
    d(2, 12, 3, 3, pants);
    d(7, 12, 3, 3, pants);
    d(1 + (phase ? 1 : 0), 15, 4, 1, shoes);
    d(7 - (phase ? 1 : 0), 15, 4, 1, shoes);
    /* body hoodie */
    d(2, 7, 8, 6, hood);
    d(3, 8, 6, 4, shade(hood, -18));
    /* head */
    d(3, 2, 6, 6, skin);
    d(3, 2, 6, 2, hair);
    d(2, 3, 1, 3, hair);
    d(9, 3, 1, 3, hair);
    /* eyes */
    d(4, 5, 2, 2, "#fff6e8");
    d(7, 5, 2, 2, "#fff6e8");
    d(5, 5, 1, 2, eye);
    d(8, 5, 1, 2, eye);
    if (ch.capOn) {
      d(2, 1, 8, 2, cap);
      d(3, 0, 6, 1, cap);
      d(9, 2, 2, 2, shade(cap, -20)); /* visor / back */
    }
    if (ch.bow) {
      d(1, 1, 2, 2, "#f070a0");
      d(0, 2, 1, 1, "#f070a0");
    }
    if (ch.girl && !ch.capOn) {
      /* ponytail */
      d(10, 3, 2, 3, hair);
      d(11, 6, 2, 4, hair);
      d(10, 9, 2, 2, hair);
    }
    if (ch.girl && ch.capOn) {
      /* side tuft from under cap */
      d(10, 3, 2, 3, hair);
    }
    if (!alive) {
      d(4, 5, 2, 1, eye);
      d(7, 5, 2, 1, eye);
    }
  }

  function shade(hex: string, dlt: number) {
    var n = parseInt(hex.slice(1), 16);
    var r = clamp(((n >> 16) & 255) + dlt, 0, 255);
    var g = clamp(((n >> 8) & 255) + dlt, 0, 255);
    var b = clamp((n & 255) + dlt, 0, 255);
    return "rgb(" + r + "," + g + "," + b + ")";
  }

  function drawPlatform(ctx: Ctx, p: Plat, camY: number) {
    var x = Math.round(p.x);
    var y = Math.round(p.y - camY);
    var w = p.w;
    if (y < -12 || y > LH + 12) return;
    if (p.type === "break" && p.broken) {
      if (p.breakT > 0) {
        var a = p.breakT / 12;
        rect(ctx, x, y + (12 - p.breakT), w, 5, "rgba(232,80,150," + a + ")");
      }
      return;
    }
    if (p.type === "break") {
      rect(ctx, x, y, w, 5, C.break);
      rect(ctx, x, y + 4, w, 2, C.breakD);
      ctx.fillStyle = C.breakRim;
      for (var d = 0; d < w; d += 4) ctx.fillRect(x + d, y, 2, 1);
      rect(ctx, x, y + 1, 1, 4, C.breakRim);
      rect(ctx, x + w - 1, y + 1, 1, 4, C.breakRim);
      ctx.fillStyle = C.breakD;
      var cx = x + Math.floor(w * 0.3);
      ctx.fillRect(cx, y + 1, 1, 4);
      ctx.fillRect(cx + 1, y + 3, 2, 1);
      ctx.fillRect(x + Math.floor(w * 0.65), y + 1, 1, 5);
      ctx.fillRect(x + Math.floor(w * 0.5), y + 2, 3, 1);
      ctx.fillStyle = "#120a2c";
      ctx.fillRect(x + Math.floor(w / 2) - 1, y + 2, 2, 3);
    } else if (p.type === "move") {
      rect(ctx, x, y, w, 5, C.move);
      rect(ctx, x, y + 4, w, 2, C.moveD);
      rect(ctx, x, y, w, 1, C.gold);
      rect(ctx, x, y + 1, 1, 4, C.gold);
      rect(ctx, x + w - 1, y + 1, 1, 4, C.gold);
      var midy = y + 1;
      ctx.fillStyle = C.gold;
      var dir = p.vx >= 0 ? 1 : -1;
      var cx0 = dir > 0 ? x + w - 8 : x + 3;
      ctx.fillRect(cx0, midy + 1, 3, 1);
      ctx.fillRect(cx0 + dir, midy, 1, 3);
      ctx.fillRect(cx0 + 3, midy + 1, 3, 1);
      ctx.fillRect(cx0 + 3 + dir, midy, 1, 3);
    } else {
      rect(ctx, x, y, w, 5, C.wood);
      rect(ctx, x, y + 4, w, 2, C.woodD);
      rect(ctx, x, y, w, 1, C.edge);
      rect(ctx, x, y + 1, 1, 3, C.edge);
      rect(ctx, x + w - 1, y + 1, 1, 3, C.edge);
      ctx.fillStyle = C.woodD;
      for (var i = 4; i < w - 3; i += 7) ctx.fillRect(x + i, y + 2, 2, 1);
    }
    if (p.type === "spring" || p.hasSpring) {
      var sx = Math.round(p.x + p.w / 2 - 3);
      var sy = y - 6;
      rect(ctx, sx + 1, sy, 4, 1, C.spring);
      rect(ctx, sx, sy + 1, 6, 1, C.springD);
      rect(ctx, sx + 1, sy + 2, 4, 1, C.spring);
      rect(ctx, sx, sy + 3, 6, 1, C.springD);
      rect(ctx, sx + 1, sy + 4, 4, 1, C.spring);
      rect(ctx, sx, sy + 5, 6, 1, C.springD);
    }
  }

  function frameBox(ctx: Ctx, x: number, y: number, w: number, h: number, fill: string, border?: string) {
    rect(ctx, x, y, w, h, fill);
    ctx.fillStyle = border || C.cream;
    ctx.fillRect(x, y, w, 1);
    ctx.fillRect(x, y + h - 1, w, 1);
    ctx.fillRect(x, y, 1, h);
    ctx.fillRect(x + w - 1, y, 1, h);
  }

  function drawOpponentHud(ctx: Ctx, world: World, cam: number) {
    var me = world.players[0];
    if (!me) return;
    var i, p, dlt, col, label, tw;
    var yHi = me.y, yLo = me.y;
    for (i = 0; i < world.players.length; i++) {
      p = world.players[i];
      if (p.y < yHi) yHi = p.y;
      if (p.y > yLo) yLo = p.y;
    }
    yHi -= 40;
    yLo = Math.max(yLo, (me.camY != null ? me.camY : cam) + LH) + 20;
    var span = yLo - yHi;
    if (span < 80) span = 80;
    var railX = LW - 10;
    var railY = 22;
    var railH = LH - 50;
    frameBox(ctx, railX, railY, 8, railH, C.navy, C.cream);
    for (i = 0; i < world.players.length; i++) {
      p = world.players[i];
      var t = (p.y - yHi) / span;
      if (t < 0) t = 0;
      if (t > 1) t = 1;
      var ty = Math.round(railY + 2 + t * (railH - 6));
      col = p.alive ? CHARS[p.kind].hood : "#555";
      rect(ctx, railX + 1, ty, 6, p.id === 0 ? 3 : 2, col);
      if (p.id === 0) rect(ctx, railX - 1, ty, 1, 3, C.cream);
    }
    var above = [];
    var below = [];
    for (i = 1; i < world.players.length; i++) {
      p = world.players[i];
      var sy = p.y - cam;
      if (sy < 8) above.push(p);
      else if (sy > LH - 16) below.push(p);
    }
    function pill(op, y, up) {
      dlt = Math.round((me.y - op.y) / PX_PER_M);
      var sign = dlt > 0 ? "+" : "";
      label = op.name + " " + sign + dlt;
      tw = textWidth(label, 1);
      var px = 4;
      frameBox(ctx, px, y, tw + 12, 10, op.alive ? C.navy : "#3a1020", op.alive ? CHARS[op.kind].hood : "#555");
      ctx.fillStyle = op.alive ? CHARS[op.kind].hood : "#555";
      if (up) {
        ctx.fillRect(px + 3, y + 2, 1, 1);
        ctx.fillRect(px + 2, y + 3, 3, 1);
        ctx.fillRect(px + 1, y + 4, 5, 1);
      } else {
        ctx.fillRect(px + 1, y + 3, 5, 1);
        ctx.fillRect(px + 2, y + 4, 3, 1);
        ctx.fillRect(px + 3, y + 5, 1, 1);
      }
      drawText(ctx, label, px + 9, y + 2, C.cream, 1, "left");
    }
    var ay = 22;
    for (i = 0; i < above.length; i++) { pill(above[i], ay, true); ay += 12; }
    var by = LH - 36 - below.length * 12;
    for (i = 0; i < below.length; i++) { pill(below[i], by, false); by += 12; }
  }

  function drawBat(ctx: Ctx, m: Monster, camY: number, tick: number) {
    var x = Math.round(m.x);
    var y = Math.round(m.y - camY);
    if (y < -16 || y > LH + 16) return;
    var flap = Math.floor(tick / 8) % 2;
    ctx.fillStyle = C.bat;
    /* body */
    ctx.fillRect(x + 4, y + 3, 6, 6);
    ctx.fillRect(x + 5, y + 2, 4, 1);
    /* wings */
    if (flap) {
      ctx.fillRect(x, y + 3, 4, 2);
      ctx.fillRect(x, y + 1, 3, 2);
      ctx.fillRect(x + 10, y + 3, 4, 2);
      ctx.fillRect(x + 11, y + 1, 3, 2);
    } else {
      ctx.fillRect(x, y + 4, 4, 2);
      ctx.fillRect(x, y + 6, 3, 2);
      ctx.fillRect(x + 10, y + 4, 4, 2);
      ctx.fillRect(x + 11, y + 6, 3, 2);
    }
    ctx.fillStyle = C.bat2;
    ctx.fillRect(x + 5, y + 4, 1, 2);
    ctx.fillRect(x + 8, y + 4, 1, 2);
    ctx.fillStyle = "#1a1020";
    ctx.fillRect(x + 5, y + 4, 1, 1);
    ctx.fillRect(x + 8, y + 4, 1, 1);
    /* fangs */
    ctx.fillStyle = "#fff6e8";
    ctx.fillRect(x + 6, y + 7, 1, 2);
    ctx.fillRect(x + 7, y + 7, 1, 2);
  }

  function drawBg(ctx: Ctx, camY: number, tick: number) {
    /* banded sky */
    var bands = 18;
    for (var i = 0; i < bands; i++) {
      var t = i / (bands - 1);
      var col: string;
      if (t < 0.45) col = mixHex(C.skyTop, C.skyMid, t / 0.45);
      else col = mixHex(C.skyMid, C.skyBot, (t - 0.45) / 0.55);
      var y0 = Math.round((LH * i) / bands);
      var y1 = Math.round((LH * (i + 1)) / bands);
      rect(ctx, 0, y0, LW, y1 - y0, col);
    }
    /* stars (parallax, deterministic) */
    ctx.fillStyle = C.star;
    var starOff = Math.floor(camY * 0.15);
    for (var s = 0; s < 28; s++) {
      var sx = (s * 53 + 11) % LW;
      var sy = ((s * 89 + 20) - starOff) % (LH + 40);
      if (sy < 0) sy += LH + 40;
      if (sy < LH * 0.62) {
        ctx.fillRect(sx, sy, 1, 1);
        if (s % 5 === 0) ctx.fillRect(sx, sy, 2, 2);
      }
    }
    /* moon */
    var mx = LW - 22;
    var my = 44 - Math.floor(camY * 0.05) % 8;
    ctx.fillStyle = C.moon;
    ctx.fillRect(mx + 2, my, 10, 12);
    ctx.fillRect(mx, my + 2, 14, 8);
    ctx.fillStyle = "#e0c080";
    ctx.fillRect(mx + 4, my + 3, 2, 2);
    ctx.fillRect(mx + 9, my + 6, 3, 2);
    /* city silhouette, parallax */
    var cityY = LH - 48 - Math.floor(camY * 0.25);
    var roofYchk = 0 - camY;
    if (roofYchk > LH - 10) cityY = LH - 42;
    if (cityY < LH) {
      drawCity(ctx, cityY);
    }
    /* rooftop near start (camY near -LH) */
    var roofY = 0 - camY;
    if (roofY < LH && roofY > -20) {
      rect(ctx, 0, Math.round(roofY) + 2, LW, LH, C.brick);
      /* tiles */
      ctx.fillStyle = C.brickL;
      for (var tx = 0; tx < LW; tx += 8) {
        for (var ty = Math.round(roofY) + 6; ty < LH; ty += 6) {
          ctx.fillRect(tx + ((ty / 6) % 2 === 0 ? 0 : 4), ty, 3, 1);
        }
      }
      rect(ctx, 0, Math.round(roofY), LW, 3, C.roof);
    }
  }

  function drawCity(ctx: Ctx, baseY: number) {
    var hts = [22, 34, 18, 40, 26, 16, 36, 24, 30, 20, 38, 18];
    var x = 0;
    for (var i = 0; i < hts.length; i++) {
      var w = 12 + (i % 3) * 2;
      var h = hts[i];
      rect(ctx, x, baseY - h, w, h + 8, i % 2 ? C.build : C.build2);
      /* windows */
      for (var wy = baseY - h + 3; wy < baseY - 3; wy += 5) {
        for (var wx = x + 2; wx < x + w - 2; wx += 4) {
          if (((i * 13 + wx * 3 + wy) % 5) !== 0) {
            ctx.fillStyle = ((i + wx + wy) % 3 === 0) ? C.win2 : C.win;
            ctx.fillRect(wx, wy, 2, 2);
          }
        }
      }
      x += w + 1;
    }
  }

  function mixHex(a: string, b: string, t: number) {
    t = clamp(t, 0, 1);
    var na = parseInt(a.slice(1), 16);
    var nb = parseInt(b.slice(1), 16);
    var r = Math.round(((na >> 16) & 255) * (1 - t) + ((nb >> 16) & 255) * t);
    var g = Math.round(((na >> 8) & 255) * (1 - t) + ((nb >> 8) & 255) * t);
    var bl = Math.round((na & 255) * (1 - t) + (nb & 255) * t);
    return "rgb(" + r + "," + g + "," + bl + ")";
  }

  function createWorld(seed: number, mode: string, myChar: number, names?: string[]) {
    var rng = mulberry32(seed >>> 0);
    var w: World = {
      seed: seed >>> 0,
      rng: rng,
      mode: mode,
      platforms: [],
      monsters: [],
      particles: [],
      nextY: -24,
      genUpTo: 40,
      cameraY: -LH + 70,
      startY: 0,
      tick: 0,
      shake: 0,
      phase: "play",
      resultT: 0,
      players: [],
      me: 0,
      over: false,
      finishWait: 0
    };
    /* base platform */
    w.platforms.push({
      id: 0, x: 8, y: 0, w: LW - 16, type: "normal", vx: 0, broken: false, breakT: 0, hasSpring: false
    });
    var used = [myChar];
    var slots = mode === "squad" ? 4 : 1;
    var xs = mode === "squad" ? [28, 58, 90, 120] : [74];
    for (var i = 0; i < slots; i++) {
      var kind: number;
      if (i === 0) kind = myChar;
      else {
        kind = 0;
        while (used.indexOf(kind) >= 0) kind++;
        used.push(kind);
      }
      var p = {
        id: i,
        kind: kind,
        name: names && names[i] ? names[i] : CHARS[kind].name,
        x: xs[i],
        y: -PLAYER_H,
        vx: 0,
        vy: 0,
        prevY: -PLAYER_H,
        alive: true,
        eliminated: false,
        maxH: 0,
        isBot: i !== 0,
        skill: i === 1 ? 0.92 : i === 2 ? 0.78 : 0.85,
        face: 1,
        phase: 0,
        squash: 0,
        dir: 0,
        ax: 0,
        place: 0,
        camY: -LH + 70
      };
      w.players.push(p);
    }
    generateUntil(w, w.cameraY - 40);
    return w;
  }

  function generateUntil(w: World, upToY: number) {
    var jumpH = JUMP_H;
    var guard = 0;
    while (w.nextY > upToY && guard++ < 2500) {
      var height = -w.nextY;
      var heightM = height / PX_PER_M;
      var tDiff = difficultyT(height);
      var minGap = Math.floor(jumpH * lerp(0.28, 0.48, tDiff));
      var maxGap = Math.floor(jumpH * lerp(0.44, 0.74, tDiff));
      var cap = Math.floor(jumpH - 16);
      if (maxGap > cap) maxGap = cap;
      if (minGap < 18) minGap = 18;
      if (minGap > maxGap) minGap = maxGap;
      var gap = randInt(w.rng, minGap, maxGap);
      var pwMin = Math.floor(lerp(42, 28, tDiff));
      var pwMax = Math.floor(lerp(54, 38, tDiff));
      if (pwMin > pwMax) pwMin = pwMax;
      var pw = randInt(w.rng, pwMin, pwMax);
      var px = randInt(w.rng, 4, LW - pw - 4);
      var type = "normal";
      var r = w.rng();
      if (heightM > 200 && r < 0.05 + tDiff * 0.10) type = "break";
      else if (heightM > 80 && r < 0.12 + tDiff * 0.14) type = "move";
      else if (r < 0.09) type = "spring";
      w.platforms.push({
        id: w.platforms.length,
        x: px,
        y: w.nextY,
        w: pw,
        type: type,
        vx: type === "move" ? (w.rng() < 0.5 ? -0.45 : 0.45) * (1 + tDiff * 0.4) : 0,
        broken: false,
        breakT: 0,
        hasSpring: type === "spring"
      });
      var p2Chance = 1;
      if (heightM >= 600 && heightM < 2000) p2Chance = 0.98;
      else if (heightM >= 2000) p2Chance = lerp(0.9, 0.55, clamp((heightM - 2000) / 1500, 0, 1));
      var needSafe = type === "break";
      if (needSafe || w.rng() < p2Chance) {
        var pw2 = randInt(w.rng, pwMin, pwMax);
        var px2 = placePlatformX(w.rng, pw2, px, pw);
        var type2 = "normal";
        var r2 = w.rng();
        if (!needSafe && heightM > 80 && r2 < 0.18) type2 = "move";
        else if (!needSafe && r2 < 0.08) type2 = "spring";
        w.platforms.push({
          id: w.platforms.length,
          x: px2,
          y: w.nextY - randInt(w.rng, 2, 10),
          w: pw2,
          type: type2,
          vx: type2 === "move" ? (w.rng() < 0.5 ? -0.45 : 0.45) * (1 + tDiff * 0.4) : 0,
          broken: false,
          breakT: 0,
          hasSpring: type2 === "spring"
        });
      }
      if (heightM < 900 && w.rng() < (heightM < 500 ? 0.45 : 0.22)) {
        var pw3 = randInt(w.rng, pwMin, pwMax);
        var px3 = placePlatformX(w.rng, pw3, px, pw);
        w.platforms.push({
          id: w.platforms.length,
          x: px3,
          y: w.nextY - randInt(w.rng, 4, 14),
          w: pw3,
          type: "normal",
          vx: 0,
          broken: false,
          breakT: 0,
          hasSpring: false
        });
      }
      if (heightM > 450 && w.rng() < 0.035 + tDiff * 0.07) {
        w.monsters.push({
          x: randInt(w.rng, 8, LW - 22),
          y: w.nextY - 18,
          vx: w.rng() < 0.5 ? -0.5 : 0.5,
          w: 14,
          h: 10,
          alive: true,
          squish: 0
        });
      }
      w.nextY -= gap;
    }
  }

  function spawnParts(w: World, x: number, y: number, n: number, col: string, spr?: number) {
    for (var i = 0; i < n; i++) {
      w.particles.push({
        x: x,
        y: y,
        vx: (Math.random() - 0.5) * (spr || 2.2),
        vy: (Math.random() - 0.9) * (spr || 2.2),
        life: 18 + Math.floor(Math.random() * 16),
        col: col,
        s: 1 + (Math.random() < 0.4 ? 1 : 0)
      });
    }
  }

  function wrapX(x: number, width: number) {
    var wx = x % LW;
    if (wx < -width) wx += LW;
    if (wx > LW) wx -= LW;
    return wx;
  }

  function overlapsX(ax: number, aw: number, bx: number, bw: number) {
    /* including wrap */
    function hit(a: number, aw: number, b: number, bw: number) {
      return a + aw > b && a < b + bw;
    }
    return hit(ax, aw, bx, bw) || hit(ax + LW, aw, bx, bw) || hit(ax - LW, aw, bx, bw);
  }

  function botDir(p: Player, w: World) {
    if (!p.alive) return 0;
    var jumpH = (JUMP_V * JUMP_V) / (2 * GRAVITY) + 16;
    var best: Plat | null = null;
    var bestScore = -1e9;
    var cx = p.x + PLAYER_W / 2;
    for (var i = 0; i < w.platforms.length; i++) {
      var pl = w.platforms[i];
      if (pl.broken) continue;
      if (pl.y >= p.y + PLAYER_H - 1) continue;
      if (pl.y < p.y - jumpH) continue;
      var mid = pl.x + pl.w / 2;
      if (pl.type === "move") mid += pl.vx * 10;
      var dx = mid - cx;
      if (dx > LW / 2) dx -= LW;
      if (dx < -LW / 2) dx += LW;
      var score = -pl.y * 2.2 - Math.abs(dx) * 0.55;
      if (w.tick < 100) score -= Math.abs(dx) * 0.8;
      if (pl.type === "break") score -= 12;
      if (pl.type === "spring") score += 24;
      for (var m = 0; m < w.monsters.length; m++) {
        var mon = w.monsters[m];
        if (!mon.alive) continue;
        if (Math.abs(mon.y - pl.y) < 22 && Math.abs((mon.x + 7) - mid) < 18) score -= 70;
      }
      if (score > bestScore) {
        bestScore = score;
        best = pl;
      }
    }
    if (!best) return p._botDir || p.face || 0;
    var target = best.x + best.w / 2;
    if (best.type === "move") target += best.vx * 10;
    var dx = target - cx;
    if (dx > LW / 2) dx -= LW;
    if (dx < -LW / 2) dx += LW;
    p._botDir = Math.abs(dx) < 2.5 ? 0 : (dx < 0 ? -1 : 1);
    return p._botDir;
  }

  function landOn(w: World, p: Player, pl: Plat) {
    p.y = pl.y - PLAYER_H;
    p.squash = 6;
    var spring = (pl.type === "spring" || pl.hasSpring) &&
      overlapsX(p.x + 3, PLAYER_W - 6, pl.x + pl.w / 2 - 5, 10);
    if (spring) {
      p.vy = SPRING_V;
      w.shake = 7;
      spawnParts(w, p.x + 6, pl.y, 8, C.spring, 2.8);
    } else {
      p.vy = JUMP_V;
      spawnParts(w, p.x + 6, pl.y, 3, C.wood, 1.2);
    }
    if (pl.type === "break" && !pl.broken) {
      pl.broken = true;
      pl.breakT = 14;
      spawnParts(w, pl.x + pl.w / 2, pl.y, 7, C.break, 1.8);
    }
  }

  function tickWorld(w: World, inputs: Inputs) {
    w.tick++;
    if (w.shake > 0) w.shake--;
    /* move platforms */
    for (var i = 0; i < w.platforms.length; i++) {
      var pl = w.platforms[i];
      if (pl.type === "move" && !pl.broken) {
        pl.x += pl.vx;
        if (pl.x < 2) { pl.x = 2; pl.vx = Math.abs(pl.vx); }
        if (pl.x + pl.w > LW - 2) { pl.x = LW - 2 - pl.w; pl.vx = -Math.abs(pl.vx); }
      }
      if (pl.broken && pl.breakT > 0) pl.breakT--;
    }
    for (var mi = 0; mi < w.monsters.length; mi++) {
      var mon = w.monsters[mi];
      if (!mon.alive) {
        if (mon.squish > 0) mon.squish--;
        continue;
      }
      mon.x += mon.vx;
      if (mon.x < 2) { mon.x = 2; mon.vx = Math.abs(mon.vx); }
      if (mon.x + mon.w > LW - 2) { mon.x = LW - 2 - mon.w; mon.vx = -Math.abs(mon.vx); }
    }

    var leaderY = 1e9;
    for (var pi = 0; pi < w.players.length; pi++) {
      var p = w.players[pi];
      if (!p.alive) continue;
      p.prevY = p.y;
      var inp = inputs[p.id] || { dir: 0, ax: 0 };
      var dir = inp.dir || 0;
      if (inp.ax) {
        /* analog tilt */
        p.vx = lerp(p.vx, MAX_VX * clamp(inp.ax, -1, 1), 0.35);
        dir = inp.ax < -0.12 ? -1 : inp.ax > 0.12 ? 1 : 0;
      } else if (dir) {
        p.vx += dir * ACCEL;
        p.vx = clamp(p.vx, -MAX_VX, MAX_VX);
      } else {
        p.vx *= AIR_FRIC;
        if (Math.abs(p.vx) < 0.05) p.vx = 0;
      }
      if (dir) p.face = dir;
      p.vy += GRAVITY;
      if (p.vy > 6.5) p.vy = 6.5;
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < -PLAYER_W) p.x += LW;
      if (p.x > LW) p.x -= LW;
      if (p.squash > 0) p.squash--;
      p.phase = (p.phase + (dir ? 1 : 0)) % 10;

      /* land */
      if (p.vy > 0) {
        var feet = p.y + PLAYER_H;
        var prevFeet = p.prevY + PLAYER_H;
        for (var k = 0; k < w.platforms.length; k++) {
          var plat = w.platforms[k];
          if (plat.broken) continue;
          if (prevFeet <= plat.y + 3 && feet >= plat.y && prevFeet <= plat.y + 8) {
            if (overlapsX(p.x + 1, PLAYER_W - 2, plat.x, plat.w)) {
              landOn(w, p, plat);
              break;
            }
          }
        }
      }

      /* monsters */
      for (var mm = 0; mm < w.monsters.length; mm++) {
        var mo = w.monsters[mm];
        if (!mo.alive) continue;
        if (overlapsX(p.x + 2, PLAYER_W - 4, mo.x + 2, mo.w - 4) &&
            p.y + 4 < mo.y + mo.h && p.y + PLAYER_H > mo.y) {
          if (p.vy > 0 && p.y + PLAYER_H - mo.y < 8) {
            mo.alive = false;
            mo.squish = 8;
            p.vy = MONSTER_V;
            p.y = mo.y - PLAYER_H;
            spawnParts(w, mo.x + 7, mo.y + 4, 10, C.bat2, 2.4);
            w.shake = 5;
          } else {
            killPlayer(w, p, "monster");
          }
        }
      }

      var h = Math.max(0, -(p.y + PLAYER_H));
      if (h > p.maxH) p.maxH = h;
      if (p.y < leaderY) leaderY = p.y;
    }

    /* per-player cameras; world camera follows the human */
    var living = 0;
    var minCam = 1e9;
    for (var li = 0; li < w.players.length; li++) {
      var lp = w.players[li];
      if (lp.camY == null) lp.camY = w.cameraY;
      if (!lp.alive) continue;
      living++;
      var tcam = lp.y - LH * 0.42;
      if (tcam < lp.camY) lp.camY = tcam;
      if (lp.camY < minCam) minCam = lp.camY;
    }
    var meCam = w.players[0];
    if (meCam) w.cameraY = meCam.camY;
    if (minCam < 1e9) generateUntil(w, minCam - 80);

    /* elimination vs own camera / virtual screen */
    for (var ei = 0; ei < w.players.length; ei++) {
      var ep = w.players[ei];
      if (!ep.alive) continue;
      if (w.tick > 150 && ep.y > ep.camY + LH + 6) {
        killPlayer(w, ep, "fall");
      }
    }

    /* particles */
    for (var q = w.particles.length - 1; q >= 0; q--) {
      var pt = w.particles[q];
      pt.x += pt.vx;
      pt.y += pt.vy;
      pt.vy += 0.12;
      pt.life--;
      if (pt.life <= 0) w.particles.splice(q, 1);
    }

    /* cull only below every living screen */
    if (w.tick % 30 === 0) {
      var cut = -1e9;
      var anyLiv = false;
      for (var ci = 0; ci < w.players.length; ci++) {
        if (!w.players[ci].alive) continue;
        anyLiv = true;
        var cbottom = w.players[ci].camY + LH + 80;
        if (cbottom > cut) cut = cbottom;
      }
      if (!anyLiv) cut = w.cameraY + LH + 80;
      w.platforms = w.platforms.filter(function (pl: Plat) { return pl.y < cut; });
      w.monsters = w.monsters.filter(function (m: Monster) { return m.y < cut || !m.alive; });
    }

    /* finish: last survivor or all out; cap wait if the human is already gone */
    var me = w.players[0];
    var aliveCount = 0;
    for (var oi = 0; oi < w.players.length; oi++) if (w.players[oi].alive) aliveCount++;
    if (w.mode === "solo") {
      if (!me.alive) {
        w.finishWait++;
        if (w.finishWait > 70) finish(w);
      }
    } else if (aliveCount <= 1) {
      w.finishWait++;
      if (w.finishWait > 45) finish(w);
    } else if (!me.alive) {
      w.finishWait++;
      if (w.finishWait > 200) finish(w);
    } else {
      w.finishWait = 0;
    }
  }

  function killPlayer(w: World, p: Player, why: string) {
    if (!p.alive) return;
    p.alive = false;
    p.eliminated = true;
    p.vy = 1.2;
    spawnParts(w, p.x + 6, p.y + 8, 12, CHARS[p.kind].hood, 2.6);
    w.shake = 6;
    p._why = why;
  }

  function finish(w: World) {
    if (w.phase !== "play") return;
    w.phase = "results";
    var arr = w.players.slice().sort(function (a: Player, b: Player) { return b.maxH - a.maxH; });
    for (var i = 0; i < arr.length; i++) arr[i].place = i + 1;
    var meters = Math.floor(w.players[0].maxH / PX_PER_M);
    if (w.mode === "solo" || true) {
      var best = parseInt(storageGet("hoppak_best") || "0", 10) || 0;
      if (meters > best) {
        storageSet("hoppak_best", String(meters));
        w.newBest = true;
        w.best = meters;
      } else {
        w.newBest = false;
        w.best = Math.max(best, meters);
      }
    }
  }

  function metersOf(p: Player) {
    return Math.floor(p.maxH / PX_PER_M);
  }

  /* ---------------- Game shell ---------------- */
  function startHoppak(canvas: HTMLCanvasElement, _opts?: Record<string, never>): GameApi {
    var raw = canvas.getContext("2d");
    if (!raw) {
      return emptyApi();
    }
    var ctx: Ctx = raw;
    var wrap = canvas.parentElement;
    var phase = "menu"; /* menu | play | results */
    var world: World | null = null;
    var myChar = parseInt(storageGet("hoppak_char") || "0", 10) || 0;
    if (myChar < 0 || myChar > 3) myChar = 0;
    var mode = "squad";
    var tiltOn = false;
    var autoPlay = false;
    var tiltAvail = typeof window.DeviceOrientationEvent !== "undefined";
    var tiltDenied = false;
    var tiltAx = 0;
    var held = { left: false, right: false, keysL: false, keysR: false };
    var pointers: { [id: string]: { x: number; y: number } } = {};
    var acc = 0;
    var lastT = 0;
    var raf = 0;
    var running = true;
    var hover: string | null = null;

    function resize() {
      var r = (wrap || canvas).getBoundingClientRect();
      var cssW = Math.max(1, r.width);
      var cssH = Math.max(1, r.height);
      LH = Math.max(220, Math.round(LW * (cssH / cssW)));
      canvas.width = LW;
      canvas.height = LH;
      canvas.style.width = "100%";
      canvas.style.height = "100%";
      ctx.imageSmoothingEnabled = false;
    }

    function toLogic(clientX: number, clientY: number) {
      var r = canvas.getBoundingClientRect();
      return {
        x: ((clientX - r.left) / r.width) * LW,
        y: ((clientY - r.top) / r.height) * LH
      };
    }

    function currentDir() {
      var l = held.left || held.keysL;
      var r = held.right || held.keysR;
      if (l && !r) return -1;
      if (r && !l) return 1;
      return 0;
    }

    function collectInputs() {
      var inputs: Inputs = {};
      if (!world) return inputs;
      for (var i = 0; i < world.players.length; i++) {
        var p = world.players[i];
        if (p.isBot || autoPlay) {
          inputs[p.id] = { dir: botDir(p, world), ax: 0 };
        } else {
          var d = currentDir();
          var useTilt = tiltOn && !lheld() && d === 0;
          inputs[p.id] = useTilt ? { dir: 0, ax: tiltAx } : { dir: d, ax: 0 };
        }
      }
      return inputs;
    }
    function lheld() {
      return held.left || held.right || held.keysL || held.keysR;
    }

    /* menu hit boxes, computed in draw, stored here */
    var hits: Hit[] = [];

    function addHit(id: string, x: number, y: number, w: number, h: number) {
      hits.push({ id: id, x: x, y: y, w: w, h: h });
    }
    function hitAt(x: number, y: number) {
      for (var i = hits.length - 1; i >= 0; i--) {
        var h = hits[i];
        if (x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h) return h.id;
      }
      return null;
    }

    function startRun(newSeed?: number) {
      var seed = newSeed != null ? newSeed : ((Date.now() ^ (Math.random() * 0x7fffffff)) >>> 0);
      world = createWorld(seed, mode, myChar);
      phase = "play";
      acc = 0;
      try { canvas.focus(); } catch (_e) {}
    }

    function goMenu() {
      phase = "menu";
      world = null;
    }

    function rematch() {
      startRun();
    }

    function onPtrDown(e: PointerEvent) {
      e.preventDefault();
      try { canvas.focus(); } catch (_err) {}
      var id = e.pointerId != null ? e.pointerId : 1;
      var loc = toLogic(e.clientX, e.clientY);
      pointers[id] = loc;
      if (phase === "menu") {
        var hid = hitAt(loc.x, loc.y);
        activate(hid);
        return;
      }
      if (phase === "results") {
        var hid2 = hitAt(loc.x, loc.y);
        activate(hid2);
        return;
      }
      if (phase === "play") {
        if (loc.x < LW / 2) held.left = true;
        else held.right = true;
      }
    }
    function onPtrMove(e: PointerEvent) {
      if (phase !== "play") return;
      var id = e.pointerId != null ? e.pointerId : 1;
      if (pointers[id] == null && e.buttons === 0) return;
      var loc = toLogic(e.clientX, e.clientY);
      pointers[id] = loc;
      /* recompute hold from all pointers */
      recomputeHold();
    }
    function onPtrUp(e: PointerEvent) {
      e.preventDefault();
      var id = e.pointerId != null ? e.pointerId : 1;
      delete pointers[id];
      recomputeHold();
    }
    function recomputeHold() {
      if (phase !== "play") {
        held.left = held.right = false;
        return;
      }
      var l = false, r = false;
      for (var k in pointers) {
        if (pointers[k].x < LW / 2) l = true;
        else r = true;
      }
      held.left = l;
      held.right = r;
    }

    function activate(id: string | null) {
      if (!id) return;
      if (id.indexOf("char:") === 0) {
        myChar = parseInt(id.split(":")[1], 10);
        storageSet("hoppak_char", String(myChar));
        return;
      }
      if (id === "solo") { mode = "solo"; return; }
      if (id === "squad") { mode = "squad"; return; }
      if (id === "tilt") { toggleTilt(); return; }
      if (id === "start") { startRun(); return; }
      if (id === "rematch") { rematch(); return; }
      if (id === "menu") { goMenu(); return; }
    }

    function toggleTilt() {
      if (!tiltAvail || tiltDenied) return;
      if (tiltOn) {
        tiltOn = false;
        tiltAx = 0;
        return;
      }
      enableTilt();
    }

    function enableTilt() {
      function ok() {
        tiltOn = true;
        tiltDenied = false;
      }
      function fail() {
        tiltOn = false;
        tiltDenied = true;
      }
      try {
        var DOE = window.DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> };
        if (DOE && typeof DOE.requestPermission === "function") {
          DOE.requestPermission().then(function (s: string) {
            if (s === "granted") ok();
            else fail();
          }).catch(fail);
        } else {
          ok();
        }
      } catch (_e) {
        fail();
      }
    }

    function onOrient(e: DeviceOrientationEvent) {
      if (!tiltOn) return;
      var g = e.gamma;
      if (g == null || isNaN(g)) return;
      tiltAx = clamp(g / 22, -1, 1);
    }

    function onKey(e: KeyboardEvent, down: boolean) {
      var k = e.key;
      if (k === "ArrowLeft" || k === "a" || k === "A") {
        held.keysL = down;
        e.preventDefault();
      }
      if (k === "ArrowRight" || k === "d" || k === "D") {
        held.keysR = down;
        e.preventDefault();
      }
      if (down && (k === "Enter" || k === " ")) {
        e.preventDefault();
        if (phase === "menu") startRun();
        else if (phase === "results") rematch();
      }
      if (down && k === "Escape" && phase !== "menu") goMenu();
    }

    function box(ctx: Ctx, x: number, y: number, w: number, h: number, fill: string, border?: string) {
      rect(ctx, x, y, w, h, fill);
      ctx.fillStyle = border || C.cream;
      ctx.fillRect(x, y, w, 1);
      ctx.fillRect(x, y + h - 1, w, 1);
      ctx.fillRect(x, y, 1, h);
      ctx.fillRect(x + w - 1, y, 1, h);
      /* inner shadow pixel */
      ctx.fillStyle = "rgba(0,0,0,0.25)";
      ctx.fillRect(x + 1, y + h - 2, w - 2, 1);
    }

    function btn(ctx: Ctx, id: string, x: number, y: number, w: number, h: number, fill: string, label: string, sc?: number) {
      addHit(id, x, y, w, h);
      box(ctx, x, y, w, h, fill, C.cream);
      drawText(ctx, label, x + w / 2, y + Math.floor((h - 7 * (sc || 1)) / 2), C.ink, sc || 1, "center");
    }

    function drawMenu() {
      hits = [];
      drawBg(ctx, -LH + 90, 0);
      /* title */
      box(ctx, 18, 14, 124, 28, C.navy, C.cream);
      drawText(ctx, "ХОППАК", LW / 2, 22, C.cream, 2, "center");
      drawText(ctx, "ПРЫГАЙ С ДРУЗЬЯМИ", LW / 2, 46, C.cream, 1, "center");

      /* characters 2x2 */
      var cards = [
        { i: 0, x: 14, y: 62 },
        { i: 1, x: 84, y: 62 },
        { i: 2, x: 14, y: 132 },
        { i: 3, x: 84, y: 132 }
      ];
      for (var i = 0; i < 4; i++) {
        var c = cards[i];
        var ch = CHARS[c.i];
        var sel = myChar === c.i;
        addHit("char:" + c.i, c.x, c.y, 62, 62);
        box(ctx, c.x, c.y, 62, 62, sel ? shade(ch.hood, -40) : C.navy, sel ? ch.hood : C.cream);
        drawJumper(ctx, c.x + 19, c.y + 5, ch, 1, 0, true, 2);
        drawText(ctx, ch.name, c.x + 31, c.y + 39, C.cream, 1, "center");
        if (sel) {
          rect(ctx, c.x + 10, c.y + 49, 42, 11, C.mint);
          drawText(ctx, "ГОТОВ", c.x + 31, c.y + 51, C.ink, 1, "center");
        }
      }

      var by = 202;
      btn(ctx, "solo", 14, by, 62, 16, mode === "solo" ? C.mint : C.navy, "ОДИН", 1);
      if (mode !== "solo") {
        /* redraw label in cream when unselected */
        box(ctx, 14, by, 62, 16, C.navy, C.cream);
        drawText(ctx, "ОДИН", 45, by + 4, C.cream, 1, "center");
      } else {
        drawText(ctx, "ОДИН", 45, by + 4, C.ink, 1, "center");
      }
      if (mode === "squad") {
        btn(ctx, "squad", 84, by, 62, 16, C.mint, "ВЧЕТВЕРОМ", 1);
      } else {
        addHit("squad", 84, by, 62, 16);
        box(ctx, 84, by, 62, 16, C.navy, C.cream);
        drawText(ctx, "ВЧЕТВЕРОМ", 115, by + 4, C.cream, 1, "center");
      }

      var ty = 222;
      if (tiltAvail) {
        var tlab = tiltDenied ? "НАКЛОН -" : tiltOn ? "НАКЛОН ВКЛ" : "НАКЛОН";
        addHit("tilt", 14, ty, 132, 14);
        box(ctx, 14, ty, 132, 14, tiltOn ? C.mint : C.navy, C.cream);
        drawText(ctx, tlab, LW / 2, ty + 3, tiltOn ? C.ink : C.cream, 1, "center");
      }

      var best = parseInt(storageGet("hoppak_best") || "0", 10) || 0;
      drawText(ctx, "РЕКОРД " + best + " м", LW / 2, LH - 52, C.cream, 1, "center");

      btn(ctx, "start", 24, LH - 38, 112, 20, C.mint, "СТАРТ", 2);
      drawText(ctx, "ТАПАЙ ПО КРАЯМ", LW / 2, LH - 14, "#c8bca0", 1, "center");
    }

    function drawPlay() {
      if (!world) return;
      var wld: World = world;
      hits = [];
      var shx = wShake();
      ctx.save();
      ctx.translate(shx, 0);
      drawBg(ctx, world.cameraY, world.tick);
      var cam = world.cameraY;
      for (var i = 0; i < world.platforms.length; i++) drawPlatform(ctx, world.platforms[i], cam);
      for (var m = 0; m < world.monsters.length; m++) {
        if (world.monsters[m].alive || world.monsters[m].squish > 0) drawBat(ctx, world.monsters[m], cam, world.tick);
      }
      for (var q = 0; q < world.particles.length; q++) {
        var pt = world.particles[q];
        ctx.globalAlpha = clamp(pt.life / 16, 0, 1);
        rect(ctx, Math.round(pt.x), Math.round(pt.y - cam), pt.s, pt.s, pt.col);
        ctx.globalAlpha = 1;
      }
      /* players, back to front (lower first) */
      var order = world.players.slice().sort(function (a: Player, b: Player) { return a.y - b.y; });
      for (var pi = 0; pi < order.length; pi++) {
        var p = order[pi];
        var sy = p.y - cam;
        if (p.id !== 0 && (sy < -22 || sy > LH + 10)) continue;
        var sx = p.x;
        var sq = p.squash > 0 ? 1 : 0;
        function drawOne(dx: number) {
          var yoff = sq ? 1 : 0;
          drawJumper(ctx, dx, sy + yoff, CHARS[p.kind], p.face, (p.phase > 5) ? 1 : 0, p.alive);
          if (wld.mode === "squad") {
            var bw = textWidth(p.name, 1);
            var nx = dx + 6 + (p.id % 2 === 0 ? -6 : 6);
            var ny = Math.round(sy) - 10 - (p.id % 2) * 8;
            rect(ctx, Math.round(nx - bw / 2) - 2, ny, bw + 4, 9, p.alive ? C.navy : "#3a1020");
            drawText(ctx, p.name, nx, ny + 1, p.alive ? C.cream : C.red, 1, "center");
          }
          if (!p.alive && wld.mode === "squad") {
            var tw = textWidth("ВЫБЫЛ", 1);
            rect(ctx, Math.round(dx + 6 - tw / 2) - 2, Math.round(sy) + 17, tw + 4, 9, C.red);
            drawText(ctx, "ВЫБЫЛ", dx + 6, sy + 18, C.cream, 1, "center");
          }
        }
        drawOne(sx);
        if (sx < 6) drawOne(sx + LW);
        if (sx > LW - PLAYER_W - 6) drawOne(sx - LW);
      }
      ctx.restore();

      /* HUD */
      var me = world.players[0];
      var mtr = Math.floor(me.maxH / PX_PER_M);
      var label = String(mtr) + " м";
      var hw = textWidth(label, 1) + 10;
      box(ctx, Math.round(LW / 2 - hw / 2), 6, hw, 13, C.navy, C.cream);
      drawText(ctx, label, LW / 2, 9, C.cream, 1, "center");

      if (world.mode === "squad") drawOpponentHud(ctx, world, cam);

      /* touch chevrons */
      ctx.globalAlpha = 0.35;
      box(ctx, 6, LH - 20, 18, 14, C.navy, C.cream);
      drawText(ctx, "<", 15, LH - 17, C.cream, 1, "center");
      box(ctx, LW - 24, LH - 20, 18, 14, C.navy, C.cream);
      drawText(ctx, ">", LW - 15, LH - 17, C.cream, 1, "center");
      ctx.globalAlpha = 1;
    }

    function wShake() {
      if (!world || world.shake <= 0) return 0;
      return (world.tick % 2 === 0 ? 1 : -1) * Math.ceil(world.shake / 3);
    }

    function drawResults() {
      if (!world) return;
      hits = [];
      drawBg(ctx, world.cameraY, 0);
      ctx.fillStyle = "rgba(10,6,24,0.55)";
      ctx.fillRect(0, 0, LW, LH);
      box(ctx, 18, 12, 124, 20, C.navy, C.cream);
      drawText(ctx, "ИТОГИ", LW / 2, 17, C.cream, 2, "center");

      var list = world.players.slice().sort(function (a: Player, b: Player) { return a.place - b.place; });
      var top = 40;
      var rowH = world.mode === "squad" ? 36 : 50;
      for (var i = 0; i < list.length; i++) {
        var p = list[i];
        var y = top + i * rowH;
        var fill = p.place === 1 ? "#6a5210" : p.place === 2 ? "#2a3040" : p.place === 3 ? "#4a3020" : C.navy;
        box(ctx, 10, y, 140, rowH - 4, fill, C.cream);
        drawText(ctx, String(p.place), 22, y + (rowH - 4) / 2 - 6, p.place === 1 ? C.gold : C.cream, 2, "center");
        if (p.place === 1) {
          ctx.fillStyle = C.gold;
          ctx.fillRect(34, y + 6, 9, 3);
          ctx.fillRect(36, y + 4, 2, 2);
          ctx.fillRect(39, y + 3, 2, 3);
          ctx.fillRect(42, y + 4, 2, 2);
        }
        drawJumper(ctx, 44, y + (rowH - 4) / 2 - 10, CHARS[p.kind], 1, 0, true);
        drawText(ctx, p.name, 64, y + 6, C.cream, 1, "left");
        drawText(ctx, String(metersOf(p)) + " м", 64, y + 16, C.cream, 1, "left");
        if (p.eliminated && world.mode === "squad" && p.place !== 1) {
          drawText(ctx, "ВЫБЫЛ", 148, y + 11, C.red, 1, "right");
        }
      }

      if (world.newBest) {
        box(ctx, 18, LH - 62, 124, 13, C.navy, C.gold);
        drawText(ctx, "НОВЫЙ РЕКОРД!", LW / 2, LH - 59, C.gold, 1, "center");
      } else if (world.mode === "solo") {
        box(ctx, 18, LH - 62, 124, 13, C.navy, C.cream);
        drawText(ctx, "РЕКОРД " + world.best + " м", LW / 2, LH - 59, C.cream, 1, "center");
      }

      btn(ctx, "rematch", 10, LH - 42, 84, 20, C.coral, "РЕВАНШ", 1);
      /* coral button: cream text better */
      /* redraw label cream? coral is dark enough for ink... use cream */
      addHit("menu", 100, LH - 42, 50, 20);
      box(ctx, 100, LH - 42, 50, 20, C.navy, C.cream);
      drawText(ctx, "МЕНЮ", 125, LH - 36, C.cream, 1, "center");
    }

    /* fix rematch button label color — redraw in drawResults after btn which uses ink.
       I'll just not use btn for rematch and draw manually. Already mixed. Let's paint cream on coral in drawResults by overwriting. */
    function drawResultsFixed() {
      drawResults();
      /* make РЕВАНШ cream on coral */
      drawText(ctx, "РЕВАНШ", 52, LH - 36, C.cream, 1, "center");
    }

    function frame(now: number) {
      if (!running) return;
      if (!lastT) lastT = now;
      var dt = (now - lastT) / 1000;
      lastT = now;
      if (dt > 0.05) dt = 0.05;
      acc += dt;
      var steps = 0;
      if (phase === "play" && world && world.phase === "play") {
        while (acc >= STEP && steps < 5) {
          tickWorld(world, collectInputs());
          acc -= STEP;
          steps++;
        }
        if (world.phase === "results") phase = "results";
      } else {
        acc = 0;
      }
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, LW, LH);
      if (phase === "menu") drawMenu();
      else if (phase === "results") drawResultsFixed();
      else drawPlay();
      raf = requestAnimationFrame(frame);
    }

    /* events */
    resize();
    window.addEventListener("resize", resize);
    if (window.visualViewport) window.visualViewport.addEventListener("resize", resize);
    canvas.addEventListener("pointerdown", onPtrDown);
    canvas.addEventListener("pointermove", onPtrMove);
    canvas.addEventListener("pointerup", onPtrUp);
    canvas.addEventListener("pointercancel", onPtrUp);
    canvas.addEventListener("contextmenu", function (e: Event) { e.preventDefault(); });
    function onKeyDown(e: KeyboardEvent) { onKey(e, true); }
    function onKeyUp(e: KeyboardEvent) { onKey(e, false); }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("deviceorientation", onOrient);
    /* prevent scroll / pinch */
    function preventScroll(e: Event) { e.preventDefault(); }
    document.addEventListener("touchmove", preventScroll, { passive: false });
    document.addEventListener("gesturestart", preventScroll);

    raf = requestAnimationFrame(frame);

    var api = {
      destroy: function () {
        running = false;
        cancelAnimationFrame(raf);
        window.removeEventListener("resize", resize);
        if (window.visualViewport) window.visualViewport.removeEventListener("resize", resize);
        canvas.removeEventListener("pointerdown", onPtrDown);
        canvas.removeEventListener("pointermove", onPtrMove);
        canvas.removeEventListener("pointerup", onPtrUp);
        canvas.removeEventListener("pointercancel", onPtrUp);
        window.removeEventListener("keydown", onKeyDown);
        window.removeEventListener("keyup", onKeyUp);
        window.removeEventListener("deviceorientation", onOrient);
        document.removeEventListener("touchmove", preventScroll);
        document.removeEventListener("gesturestart", preventScroll);
      },
      getPhase: function () { return phase; },
      getWorld: function () { return world; },
      start: function (m?: string, ch?: number, seed?: number) {
        if (m) mode = m;
        if (ch != null) myChar = ch;
        startRun(seed);
      },
      menu: function () { goMenu(); },
      rematch: rematch,
      setDir: function (d: number) {
        held.keysL = d < 0;
        held.keysR = d > 0;
      },
      killMe: function () {
        if (world && world.players[0]) killPlayer(world, world.players[0], "debug");
      },
      forceResults: function () {
        if (world) finish(world);
        phase = "results";
      },
      getHeight: function () {
        return world ? metersOf(world.players[0]) : 0;
      },
      getMode: function () { return mode; },
      inspectMap: function (seed: number, upToM: number) {
        var w = createWorld(seed, "solo", 0);
        generateUntil(w, -(upToM * PX_PER_M) - 400);
        return {
          jumpH: JUMP_H,
          pxPerM: PX_PER_M,
          platforms: w.platforms.map(function (p: Plat) {
            return { x: p.x, y: p.y, w: p.w, type: p.type };
          })
        };
      },
      setAutoPlay: function (on: boolean) { autoPlay = !!on; },
      simTicks: function (n: number) {
        autoPlay = true;
        if (!world) return { phase: "none" };
        for (var i = 0; i < n; i++) {
          if (world.phase !== "play") break;
          tickWorld(world, collectInputs());
        }
        return {
          phase: world.phase,
          ticks: world.tick,
          players: world.players.map(function (p: Player) {
            return { name: p.name, alive: p.alive, h: Math.floor(p.maxH / PX_PER_M), why: p._why || "" };
          })
        };
      },
      getChar: function () { return myChar; }
    };
    // test hook omitted on Page
    return api;
  }



export default function App() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const game = startHoppak(canvas);
    return () => {
      game.destroy();
    };
  }, []);
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        width: "100%",
        height: "100%",
        margin: 0,
        background: "#0a0718",
        overflow: "hidden",
        touchAction: "none",
        userSelect: "none",
        WebkitUserSelect: "none",
      }}
    >
      <canvas
        ref={ref}
        tabIndex={0}
        style={{
          display: "block",
          width: "100%",
          height: "100%",
          imageRendering: "pixelated",
          touchAction: "none",
          outline: "none",
        }}
      />
    </div>
  );
}
