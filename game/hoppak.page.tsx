import { useEffect, useRef } from "grok/canvas";

/* Хоппак v0.5 — pixel-art jumper for friends.
   Single source of truth: this file. hoppak.js is generated from it (build.sh). */
type Ctx = CanvasRenderingContext2D;

var LW = 160;
var LH = 346;
/* v1.0: canonical play-field width for solo and online (server NET_LW is 180). Menus stay 160. */
var FIELD_W = 180;
var VIEW_PAD = 0; /* extra scenery px on each side; not part of the world */
var VIEW_CROP = 0; /* world px cropped from the top (positive) or extra world shown above the 346 field (negative); render-only */
var HUD_INSET = 0; /* world px pushed down so the play HUD clears the notch and the Telegram bar */
function viewX0() { return -VIEW_PAD; }
function viewW() { return LW + VIEW_PAD * 2; }
function viewY0() { return VIEW_CROP; }
function viewY1() { return LH - VIEW_BOT; }
function hudY(y: number) { return y + VIEW_CROP + HUD_INSET; }
var VIEW_TOPPAD = 0; /* v1.0: game px above the view under the phone/Telegram top safe area: sky only, no play */
var VIEW_BOT = 0; /* v0.59: world px hidden at the BOTTOM when play fills the phone width; render-only (sim view stays LH) */
var VIEW_SHIFT = 0; /* v0.59: render-only look-down offset (0..VIEW_BOT) so a falling hero stays on screen until the sim death line */
function viewBottom() { return LH - VIEW_BOT; } /* screen y (world px) of the visible bottom edge during play */
/* Bottom crop cap: with the hero top on the camera line (LH*0.42) a normal bounce lands at most JUMP_H below the apex
   feet; keep that plus 12 px visible without any look-down. Past it the rest is cropped from the top (max TOP_CROP_MAX),
   then narrow side strips. 346 -> bottom <= 91, top <= 80 world px. */
function viewBotMax(lh: number) { return Math.max(0, Math.floor(lh - (lh * 0.42 + PH + JUMP_H + 12))); }
var TOP_CROP_MAX = 80;
function dimView(ctx: Ctx, col: string) { rect(ctx, -VIEW_PAD, 0, LW + VIEW_PAD * 2, LH, col); }
var PX_PER_M = 8;
/* Online and bots. Fixed: the staging slider is gone. */
var REMOTE_ALPHA = 0.84;
var PW = 12;
var PH = 16;
/* v1.0 hitbox tweak: PW×PH itself does not change (wrap, wall-cling, feet at y+PH,
   sprite anchor at x+6 / y+16), so jump, gravity and controls stay the same.
   Only the collision rectangles move a little towards the 64 px art:
   visible feet are ~12 game px (landing was a 10 px box); solid torso is ~12–13
   (hurt was 8 px wide). Landing uses the full PW. Hurt/stomp/bullets stay 1 px
   inside the body. Bonus pickups, coins, mob sizes and mobBox() are unchanged. */
var LAND_PAD_X = 0; /* was 1: land with PW-2 */
var HURT_PAD_X = 1; /* was 2: hurt with PW-4 */
var HURT_PAD_Y = 4; /* top inset, unchanged */
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
var ROW_SEP = 28; /* min vertical distance between platform rows */
var GAP_CAP = Math.floor(JUMP_H - 6); /* hard max gap, ~75 px: still one-jump reachable */
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


/* Fixed UI type scale. Sizes are integer multipliers of the 5×7 pixel-font step
   (S uses the 3×5 TINY face at 1×). Same at any window width / dpr — the canvas
   scale maps these game pixels to the screen. */
var TYPE: any = { XL: 3, L: 2, M: 1, S: 1 };
var TYPEFACE: any = { XL: "pixel", L: "pixel", M: "pixel", S: "tiny" };
var TYPECOL: any = {
  primary: C.cream,
  accent: C.gold,
  muted: "#9a8ab8",
  ink: INK,
  mint: C.mint,
  danger: C.red
};

/* Heroes: look + ability. Each ability has its own TYPE (no repeats) and its own CHARGE:
   charge: time (ticks, 50/s) | coins (coins picked) | height (metres climbed) | kills (mobs stomped) */
var CHARS: any[] = [
  { id: "pilot", name: "Капитан", hood: "#2c3a5c", price: 0, ab: "dash", abName: "РЫВОК", type: "БАЗОВЫЙ", abDesc: ["КОРОТКИЙ БЫСТРЫЙ", "ВЗЛЁТ НА РАНЦЕ"], charge: "time", need: 400 },
  { id: "pirate", name: "Пират", hood: "#a8282c", price: 150, ab: "hook", abName: "КРЮК", type: "МАНЁВР", abDesc: ["КРЮК К ПЛАТФОРМЕ", "ИЛИ МОНЕТЕ, БЬЁТ МОБОВ"], charge: "time", need: 400 },
  { id: "ninja", name: "Ниндзя", hood: "#26305a", price: 200, ab: "wall", abName: "СТЕНЫ", type: "ПАРКУР", abDesc: ["6 СЕК ЦЕПЛЯЕТСЯ ЗА КРАЙ,", "ТАП - ПРЫЖОК ОТ СТЕНЫ"], charge: "time", need: 500 },
  { id: "robot", name: "Робот", hood: "#d8dce8", price: 240, ab: "dome", abName: "КОСМОЩИТ", type: "ЗАЩИТА", abDesc: ["ЩИТ 4 СЕК, СПАСЁТ", "ОТ ПАДЕНИЯ"], charge: "height", need: 200 },
  { id: "mage", name: "Маг", hood: "#7a3ac8", price: 280, ab: "tele", abName: "ТЕЛЕПОРТ", type: "ТЕЛЕПОРТ", abDesc: ["МИГОМ НА НАДЁЖНУЮ", "ПЛАТФОРМУ ВЫШЕ"], charge: "coins", need: 5 },
  { id: "knight", name: "Рыцарь", hood: "#c02a2a", price: 320, ab: "pound", abName: "ТАРАН", type: "АТАКА", abDesc: ["ПИКЕ ЩИТОМ ВНИЗ,", "С ПЛАТФОРМЫ СУПЕРПРЫЖОК"], charge: "kills", need: 1 }
];
/* Hero sprite sheets (made by /workspace/jumper/sprites_tool: make_sheet.py + unify.py).
   One row of 7 cells: idle, squash (landing), up, fall, ability, ko, blink. Facing RIGHT, hard alpha.
   Cell = 36x32 game px stored at 1.5 art px per game px (54x48 px), drawn x2 nearest on the x3 canvas.
   Head centre at x=16 game px (24 art px) of the cell, feet on the bottom edge, shared 48-colour palette,
   1-px dark outline #140c1c. */
var SPR_SC = 3;
var SPR_CW = 36, SPR_CH = 32, SPR_AX = 16;
var SPRITE_POSES = ["idle", "squash", "up", "fall", "ability", "ko", "blink"];
/* 64-px heroes carry 3 extra transition cells (crouch, apex, fstart); old sheets fall back to the 7 base poses. */
function posesFor(id: string): string[] { return (typeof HERO64 !== "undefined" && HERO64[id] && typeof HERO64_POSES !== "undefined") ? HERO64_POSES : SPRITE_POSES; }
var POSE_FALLBACK: any = { crouch: "squash", apex: "up", fstart: "fall" };
var HERO_SPRITES: any = {
  pilot: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAXoAAAAwCAMAAAAoykEcAAAAw1BMVEXp6+rf0NbwyaLus4PutVeU4vHFuL61pKpLxOvak2OulI/olSTDaxKph22QiJ2HdYEtldBqY3y8bkLLPTCFU56GYlBiVGGFTjRoRDhwOidwRIZRPHBNQ1Iha6U4O1tONzhdNiw5NUUjTXevLyWPJiRUKyBqHB1CLzBGJR83IyRPFB0rMVItKjQoIUQqHiQaHjk6FhYpFBcoCQcYKU4eGSQUDBwaEhYaCg4XEi4PDBULDCYNDAwLBRISBAQFBBwUDBwAAADH/NxIAAAAQXRSTlP/////////////////////////////////////////////////////////////////////////////////////ADBV7McAAAm6SURBVHja7ZoNc6LKEoblcAOiBCNbflBriGyCwg4wuNhGcJza//+rbo8YN5pNaLLnnFt1y66Iu1W2MzzT/XYzTufn1f5H1rkiuKK/or/aFf0V/dWu6K/or3ZFf0V/tSv6K/qrXdFf0V+tLXpAu9L5M2tg2HnHR1RSXuH/GfcGhp3fOVUamqNpg38FPsD/X4pRGL5FXztpGmN4qf55JFClQRJI+JvT+d+Ujs8xfIMegqNXp+Pjm4B/lgeAowabaWZbPylUOsMfZhvtgwKtxVg0hpfoYVx7aR2fGS3DHidXVlXZhgeoqWnpcIjhAW0XzDA1bQufBi+3nAfNcwUYGIbRcwxjTRyLyPACPRi1U1nuhHoHQeaI93IcUSOrB9QznAl0NegxXC+Y5nxtHRu//qUdtbhp7SAwlA1meCEmCZHhOXoYaL9swg5XIo8X8Cmjs6/vX3s6DlgUe9q9iTqdayltkWL393A2WVMzTc2Hj8c6kE+MRC0BZSwyw845PkOt2FY7sw1Q4smsP+zXPEjsX3xeGaW0/HI73Bc57OFe0+7gdVxqLG2YKzjG0RKDFvZ0hufoTfx6k798fl2/2aTxjj7OkBUqnigID05VevSsiOhPSorGFfycKlM3+GEV98jzCGS300zjA02FmXGytYK/ai4NZIadMxamaTh86p80m4zeNH6x16joVURV6ezoOBe0bHmbKyFR3ro1ejDr2Z5KUzJ57wugZ1zYsqk00Bmeo3ccR05nhTjekqf+8QQ0iEZdtjTOt1vz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",
  pirate: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAXoAAAAwCAMAAAAoykEcAAAAw1BMVEXp6+rf0NbwyaLus4PutVeU4vHFuL61pKpLxOvak2OulI/olSTDaxKph22QiJ2HdYEtldBqY3y8bkLLPTCFU56GYlBiVGGFTjRoRDhwOidwRIZRPHBNQ1Iha6U4O1tONzhdNiw5NUUjTXevLyWPJiRUKyBqHB1CLzBGJR83IyRPFB0rMVItKjQoIUQqHiQaHjk6FhYpFBcoCQcYKU4eGSQUDBwaEhYaCg4XEi4PDBULDCYNDAwLBRISBAQFBBwUDBwAAADH/NxIAAAAQXRSTlP/////////////////////////////////////////////////////////////////////////////////////ADBV7McAAAmGSURBVHja7Zt/i9s6FoYzsZlge3yHq+CxBQVp8Q9JIQh7iGSElGW//6faoyRt78zNxccD7cISdUz7R1XJj97zniNZ3fzn0f5HbfNA8ED/QP9oD/QP9I/2QP9A/2gP9A/0j/ZA/0D/aA/0D/SPthK9+d4ehL7clhjeR29kkqbwU9sH+y+TX2J4F71J05TFlqbmt8nj/438IsPN/V6MNazZMiEK8+vBVw1Ms18L/3eu1/qxEAw3d0axcbm2bAtNSPIFImvVkV7EkZlVw9gsy36PHxrjyrxcMRaO4Wf0xgqRZjFQSrYVW8bWyd6YNEmSFfCjOgSMJgRbY25mmyagKQjmXw/f7PKcsW95jh0LyXDzGZ0S9upRccUASY1/OVhsSCzbJMEKOEZIeh0pqgO/yubqo7BmYFS/mnyZi2srlcG9FY7hR/RmDnq8pYfYZ6sEKzh2sUNyGxCZno1hIuWXscSTgnc7Y0eS6S2aK/GrCwGjSiF24vn5+e1Yot4Ky/AT+qJI0+qKTykRcTBBCJJjDeNVkFlyhgJijBD1dYrlRR0QmDhZiZREzWugz0S20hHXpUxzLCugcNTPwB/FHs3wA3pDNPzN2EeHrusoHebYExNnRjAdMeavQDEvEeZhnBJVehlNXNTBhCoQngNrfLp2u65XOq8hqWJWT9GBbJjNj9Fsdrsd5KPSL46FZ7j5kB5etI7LpLt2v+84pbTug1LaYOxNZek1xnKGyc4gDlLcDEppDfoA9IhVhhym0ttIsNIVE0WKLj4g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",
  ninja: "data:image/png;base64,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",
  robot: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAXoAAAAwCAMAAAAoykEcAAAAw1BMVEXp6+rf0NbwyaLus4PutVeU4vHFuL61pKpLxOvak2OulI/olSTDaxKph22QiJ2HdYEtldBqY3y8bkLLPTCFU56GYlBiVGGFTjRoRDhwOidwRIZRPHBNQ1Iha6U4O1tONzhdNiw5NUUjTXevLyWPJiRUKyBqHB1CLzBGJR83IyRPFB0rMVItKjQoIUQqHiQaHjk6FhYpFBcoCQcYKU4eGSQUDBwaEhYaCg4XEi4PDBULDCYNDAwLBRISBAQFBBwUDBwAAADH/NxIAAAAQXRSTlP/////////////////////////////////////////////////////////////////////////////////////ADBV7McAAAtdSURBVHja7ZsNc6M4EoYhtiXHJMLiythTAiVQtTV7J7BqD3oWsJaa//+rrgXOzI7HNsrsZGdv16p8O4rgofX225Lifby1H9S8G4Ib+hv6W7uhv6G/tRv6G/pbu6H/xgbYbuh/CPYc21+DvvdPAp9+ajnc0P+JAZ+mC89bYLMf0x8f+f8Q9Mjd85bL5WL50rwfHvnePyTivRH6emz28xIj/y+JHv46TuAPk89RahafuA9ab9HjHHjbW5xg6F3oZMKQ8b8FfCTvDeSXL9wH9mmK379l4E8y9M52kjJnvk+o+hvAhyP5tRqhK9O1B3SYFv96DW8GfpLhGfTQUuJ7ee5hR8nh70I+v7tPkXifMp8x1g/wMfTfJrhcGH6NHgw+LA/7cNvPZ/B/Tn4xkk/z+RZxS0pIjvdFRDuyX7yF0XFieIoePoJc3WM/f3z36Z+AHt4sqX8mn6YUyQti7wrZ+4IeA3/x3Qd2ZHiCHji0IZ3N8Hl1DfR91wsXJn+MGwjCGDfwNnKDRmZIrzmTeYdEbDBaIITbNQX70nce2JXh1+gNZ5SIDq9VqarSuusmLw3uAvgcvfDaiNfVIAGla0/49GmqA+To59c25vO8YrnklCARnw+NwRj2S/guY72aoXeiURw4TpBQ58PVYtNVOY0+CJ7AuilDKVPmNfCHfDRKAHXM6eB9es4THdBXLqyntDGfa6F6Floi+XBnWguLHt+usAd/HKsFiF0Dw5XhCXqPy1XgyWa99NZDL7zCaSWA7bMlHxLLkFBW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",
  mage: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAXoAAAAwCAMAAAAoykEcAAAAw1BMVEXp6+rf0NbwyaLus4PutVeU4vHFuL61pKpLxOvak2OulI/olSTDaxKph22QiJ2HdYEtldBqY3y8bkLLPTCFU56GYlBiVGGFTjRoRDhwOidwRIZRPHBNQ1Iha6U4O1tONzhdNiw5NUUjTXevLyWPJiRUKyBqHB1CLzBGJR83IyRPFB0rMVItKjQoIUQqHiQaHjk6FhYpFBcoCQcYKU4eGSQUDBwaEhYaCg4XEi4PDBULDCYNDAwLBRISBAQFBBwUDBwAAADH/NxIAAAAQXRSTlP/////////////////////////////////////////////////////////////////////////////////////ADBV7McAAAoLSURBVHja7Zptc6M4EscdcOLALmHgeBASg6HqWENAPB1t4xhS+/0/1TVO7uomzsXNTNXevbBSrrzqaumn7r9aLVZ/3sb/aKxuCG7ob+hv44b+hv42buhv6G/jhv6G/jZu6G/ob+OG/ob+NujoAceNy68NEsML9DAI4d3g/xp5EsOP6IE7quPw/sb+F8jTGK4+7pfDdQcHh/+fzPzUCv4ib8t9URn+iB5GHgk0UtS/hD1gfMC4GAecOOfjT0DkPNnDUl+e552WGJEZfkA/8DpCM3NOmOVIFgYIhM6cmcJcGFXgOJrjJEuD0Tt7GxZZwdGyDMsqF/giM/yAXkiYd+ycLvy0jCXsHcdaEiDABUdHquksoQgWP89v4xyXUXSE8zSbLVmS51nz0Besi8zwA/oQQLytTOVClFVfkkPy3Z8krwwSPsw2KoZHuQBH4hT8nM/OEvWAmg/vZq/wHxl0xZeVIPyNbllkX2SGqwvNEDMKLnGWa9vzEjsFap5xx5x3OgRy0L+8R4eGRtQMA1G8zH7wJOMRLEmx8S1ZHOffvuD+O3yNsYQ57k3L8hKg6y6J4UVxObqGHvE5Ftu2qaSUDKhLE287Tc1oiMq9mCE6QoqQrddaByTBwV0+VxA65zV9x2o8//i72YgDzeB+9fg1eg96z5wlx/S8nuqLyPASPXJAI61qsowFu4MUtJVJLt/Q028FAD1fqyjBjqHt2qMsIp+0MhgsPB8cPMuMtapptkebIS4NvXHhbNbGIKU9ATw+PsK1KXo6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",
  knight: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAXoAAAAwCAMAAAAoykEcAAAAw1BMVEXp6+rf0NbwyaLus4PutVeU4vHFuL61pKpLxOvak2OulI/olSTDaxKph22QiJ2HdYEtldBqY3y8bkLLPTCFU56GYlBiVGGFTjRoRDhwOidwRIZRPHBNQ1Iha6U4O1tONzhdNiw5NUUjTXevLyWPJiRUKyBqHB1CLzBGJR83IyRPFB0rMVItKjQoIUQqHiQaHjk6FhYpFBcoCQcYKU4eGSQUDBwaEhYaCg4XEi4PDBULDCYNDAwLBRISBAQFBBwUDBwAAADH/NxIAAAAQXRSTlP/////////////////////////////////////////////////////////////////////////////////////ADBV7McAAApkSURBVHja7ZoNj5s6FoZJGmGNSbBIhCFaSzNWKJkgyoWIA+OxE93//6v2OO1qdWemw6Gr25Wu4lHVqqp74PF7Pk3w5339n1ZwR3BHf0d/X3f0d/T3dUd/R39fd/R39Pd1R39Hf1939Hf09zULPfh1Z/M/rWmGwUebDrvdywv881j8TmPTDIP3m667A+7b/aPYI/eu634XfBrDt+jhded34U/5D2IPry87vxz8Hmskhu/QH/wqC/zVz3XRX00Rf3soANj9WL9F90SGwdsDQ1cpy6qq1tHeLGY9Kby6rpvtKvhsp9PL33pi/yV/KH/xmOdsozJ8p/ryUJRVax55IoXgZo7Fwoe3w0xPef3jcJPjr1QQA20XFB46oiiyyJoBfgG8GWZsIzJ8h77Ah2yBM8UWjHFJjo5Q3QIcop/1avAjKjZzg9v1lsdIm6C5qbAzTiodh7MDPlzzPE0z8jYiw+DN8b76A3M8VpyFod9nicrKbigwxhUwNyyiHKsOzKx9mTdGYg83I4gCeJwwXImG/7gNzVaeZZn/RfznVIbBX+XRexAvXEgRMxZmq+XqmSasK+68+TSG0znh5uD1eIVEqpjThQ+vJZ4x5rFiUsKAmc6HG3Ahj8Nw4dnDDSguIKF8zrKnpzzLSe5CZxi8eSPEd3IiUSLZRsuA8STOgSjfwqOvLtaR09+f3wUC7F/hImShJAsfGnw9dOq2u0wZA39IJaZXFguO3MV2FaVoebVco5aBYivPT8+npuss5cXoDN8GnK69gpMi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"
};
var spriteCache: any = {};
/* Decode an 8-bit indexed PNG (our hero sheets) into a canvas synchronously.
   The Canvas Page CSP blocks Image() + data: URIs, so we never use those. */
function pngInflate(src: Uint8Array) {
  var i = 0, bits = 0, nbit = 0, out: number[] = [], outI = 0;
  function nbits(n: number) { while (nbit < n) { bits |= src[i++] << nbit; nbit += 8; } var v = bits & ((1 << n) - 1); bits >>>= n; nbit -= n; return v; }
  function drop() { bits = 0; nbit = 0; }
  if (src[0] === 0x78 && ((src[0] << 8) + src[1]) % 31 === 0) i = 2;
  var lenBase = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258];
  var lenExtra = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0];
  var distBase = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577];
  var distExtra = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13];
  var order = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];
  function build(lens: Uint8Array | number[]) {
    var counts = new Uint16Array(16), next = new Uint16Array(16), codes = new Uint16Array(lens.length), k: number, l: number, root: any = {}, node: any, bit: number, code: number;
    for (k = 0; k < lens.length; k++) counts[lens[k]]++;
    counts[0] = 0; next[1] = 0;
    for (k = 1; k < 15; k++) next[k + 1] = (next[k] + counts[k]) << 1;
    for (k = 0; k < lens.length; k++) {
      l = lens[k]; if (!l) continue;
      code = next[l]++;
      node = root;
      for (bit = l - 1; bit >= 0; bit--) {
        var b = (code >> bit) & 1;
        if (!node[b]) node[b] = {};
        node = node[b];
      }
      node.s = k;
    }
    return root;
  }
  function decode(t: any) { var node = t; while (node.s == null) node = node[nbits(1)]; return node.s; }
  function fixedLit() {
    var l = new Uint8Array(288), k;
    for (k = 0; k <= 143; k++) l[k] = 8;
    for (k = 144; k <= 255; k++) l[k] = 9;
    for (k = 256; k <= 279; k++) l[k] = 7;
    for (k = 280; k <= 287; k++) l[k] = 8;
    return build(l);
  }
  function fixedDist() { var l = new Uint8Array(32), k; for (k = 0; k < 32; k++) l[k] = 5; return build(l); }
  function put(v: number) { out[outI++] = v; }
  for (;;) {
    var bfinal = nbits(1), btype = nbits(2), lit: any, dist: any, k: number;
    if (btype === 0) {
      drop();
      var len = src[i] | (src[i + 1] << 8); i += 4;
      for (k = 0; k < len; k++) put(src[i++]);
    } else if (btype === 1 || btype === 2) {
      if (btype === 1) { lit = fixedLit(); dist = fixedDist(); }
      else {
        var nlit = nbits(5) + 257, ndist = nbits(5) + 1, nclen = nbits(4) + 4;
        var clens = new Uint8Array(19);
        for (k = 0; k < nclen; k++) clens[order[k]] = nbits(3);
        var ct = build(clens), all = new Uint8Array(nlit + ndist), p = 0, prev = 0, sym: number, r: number;
        while (p < all.length) {
          sym = decode(ct);
          if (sym < 16) { all[p++] = sym; prev = sym; }
          else if (sym === 16) { r = 3 + nbits(2); while (r--) all[p++] = prev; }
          else if (sym === 17) { r = 3 + nbits(3); while (r--) all[p++] = 0; prev = 0; }
          else { r = 11 + nbits(7); while (r--) all[p++] = 0; prev = 0; }
        }
        lit = build(all.subarray(0, nlit)); dist = build(all.subarray(nlit));
      }
      for (;;) {
        var s0 = decode(lit);
        if (s0 < 256) put(s0);
        else if (s0 === 256) break;
        else {
          var li = s0 - 257, ln = lenBase[li] + nbits(lenExtra[li]);
          var di = decode(dist), dn = distBase[di] + nbits(distExtra[di]);
          for (k = 0; k < ln; k++) put(out[outI - dn]);
        }
      }
    } else break;
    if (bfinal) break;
  }
  return Uint8Array.from(out);
}
function u32be(u: Uint8Array, i: number) { return ((u[i] << 24) | (u[i + 1] << 16) | (u[i + 2] << 8) | u[i + 3]) >>> 0; }
function pngToCanvas(b64: string) {
  try {
    var raw = b64.indexOf(",") >= 0 ? b64.split(",")[1] : b64;
    var bin = atob(raw), u = new Uint8Array(bin.length), i: number;
    for (i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    if (u[0] !== 0x89 || u[1] !== 0x50) return null;
    var p = 8, w = 0, h = 0, pal: Uint8Array | null = null, tr: Uint8Array | null = null, idat = new Uint8Array(0), ctype = 0;
    while (p < u.length) {
      var len = u32be(u, p), typ = String.fromCharCode(u[p + 4], u[p + 5], u[p + 6], u[p + 7]), d = u.subarray(p + 8, p + 8 + len);
      if (typ === "IHDR") { w = u32be(d, 0); h = u32be(d, 4); ctype = d[9]; if (d[8] !== 8 || (ctype !== 3 && ctype !== 2 && ctype !== 6)) return null; }
      else if (typ === "PLTE") pal = d;
      else if (typ === "tRNS") tr = d;
      else if (typ === "IDAT") { var n = new Uint8Array(idat.length + d.length); n.set(idat); n.set(d, idat.length); idat = n; }
      else if (typ === "IEND") break;
      p += 12 + len;
    }
    if (!w || !h) return null;
    if (ctype === 3 && !pal) return null;
    var data = pngInflate(idat);
    var bpp = ctype === 6 ? 4 : ctype === 2 ? 3 : 1;
    var stride = 1 + w * bpp, pix = new Uint8ClampedArray(w * h * 4);
    var prev = new Uint8Array(w * bpp), cur = new Uint8Array(w * bpp);
    function paeth(a: number, b: number, c: number) { var q = a + b - c, pa = Math.abs(q - a), pb = Math.abs(q - b), pc = Math.abs(q - c); return pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
    var y: number, x: number;
    for (y = 0; y < h; y++) {
      var f = data[y * stride], off = y * stride + 1;
      for (x = 0; x < w * bpp; x++) {
        var v = data[off + x], a = x >= bpp ? cur[x - bpp] : 0, b = prev[x], c = x >= bpp ? prev[x - bpp] : 0;
        if (f === 1) v = (v + a) & 255;
        else if (f === 2) v = (v + b) & 255;
        else if (f === 3) v = (v + ((a + b) >> 1)) & 255;
        else if (f === 4) v = (v + paeth(a, b, c)) & 255;
        cur[x] = v;
      }
      for (x = 0; x < w; x++) {
        var o = (y * w + x) * 4;
        if (ctype === 3) {
          var idx = cur[x], ci = idx * 3;
          pix[o] = pal![ci]; pix[o + 1] = pal![ci + 1]; pix[o + 2] = pal![ci + 2];
          pix[o + 3] = tr && idx < tr.length ? tr[idx] : 255;
        } else if (ctype === 6) {
          var s6 = x * 4;
          pix[o] = cur[s6]; pix[o + 1] = cur[s6 + 1]; pix[o + 2] = cur[s6 + 2]; pix[o + 3] = cur[s6 + 3];
        } else {
          var s2 = x * 3;
          pix[o] = cur[s2]; pix[o + 1] = cur[s2 + 1]; pix[o + 2] = cur[s2 + 2]; pix[o + 3] = 255;
        }
      }
      prev.set(cur);
    }
    var cv = document.createElement("canvas");
    cv.width = w; cv.height = h;
    var g = cv.getContext("2d");
    if (!g) return null;
    g.putImageData(new ImageData(pix, w, h), 0, 0);
    return cv;
  } catch (_e) { return null; }
}
function heroSprite(id: string) {
  if (spriteCache[id]) return spriteCache[id];
  var src = HERO_SPRITES[id];
  if (!src) return null;
  var cv = pngToCanvas(src);
  if (cv) spriteCache[id] = cv;
  return cv;
}
function warmHeroSprites() { for (var k in HERO_SPRITES) heroSprite(k); }
var spriteBoxCache: any = {};
/** Opaque pixels of one pose, in art pixels of that cell. */
function spriteFrameBox(id: string, pose: string) {
  var spr = heroSprite(id);
  if (!spr) return null;
  var key = id + ":" + pose;
  if (spriteBoxCache[key]) return spriteBoxCache[key];
  var PL = posesFor(id);
  var fw = Math.floor(spr.width / PL.length);
  var fh = spr.height;
  var fi = PL.indexOf(pose);
  if (fi < 0 && POSE_FALLBACK[pose]) fi = PL.indexOf(POSE_FALLBACK[pose]);
  if (fi < 0) fi = 0;
  var g = spr.getContext("2d");
  if (!g || fw < 1 || fh < 1) return null;
  var data = g.getImageData(fi * fw, 0, fw, fh).data;
  var minX = fw, maxX = -1, minY = fh, maxY = -1;
  for (var y = 0; y < fh; y++) for (var x = 0; x < fw; x++) {
    if (data[(y * fw + x) * 4 + 3] > 20) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) { minX = 0; maxX = fw - 1; minY = 0; maxY = fh - 1; }
  var box = { minX: minX, maxX: maxX, minY: minY, maxY: maxY, fw: fw, fh: fh };
  spriteBoxCache[key] = box;
  return box;
}
/** x for drawJumper so the visible sprite bbox is centred on targetX. */
function jumperXForCenter(targetX: number, id: string, pose: string, sc: number) {
  var s = sc || 1;
  var box = spriteFrameBox(id, pose);
  var mid = SPR_AX;
  if (box && box.fw) mid = ((box.minX + box.maxX + 1) / 2) * (SPR_CW / box.fw);
  var shift = (mid - SPR_AX) * s;
  function centerAt(x: number) { return x + 6 * s + shift; }
  var best = Math.round(targetX - shift - 6 * s);
  if (Math.abs(centerAt(best - 1) - targetX) < Math.abs(centerAt(best) - targetX)) best -= 1;
  if (Math.abs(centerAt(best + 1) - targetX) < Math.abs(centerAt(best) - targetX)) best += 1;
  return best;
}
var BONUS_SPRITES: any = {
  bigcoin: { src: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAABqElEQVR4nJ1UO0jDUBQ9kdChlAwSHSQ4iRQnIZAhk0MnF9fQwVEci0MHhw4dikiRjh06dZDQqRQpDplK6SBmKVVCKKWU0CmIlOAgYhxinvk1TTzTfcm555773n2PggeCWLTpxRBpoL9/w7QMyl2TQBCLdrV2jQO9lkrw7lVAp1UnonSQMHnWUgkiK/iWW2lyOWYJjlnGckIOh5MViSXRAl9pQK2WAAB8pQHoTUDWII9yDslvMOywP89AEi305xkiwEt556fe9BWTRGuzw3bxDbyURxsa1GoJvJSHKms4v99GG3/7S4rIN+h4ZEKCLpEk/MYvEgDsQpXjD40GnJGZjQdQSg9gC9mwiwi4wrLyAYABm+Ns0zIoyp2/XlfB1dFTbPV1mB46+Z1W3d9y1Aye1cuA3iSOjNUeAP80FDx3YfMcek42CXwOb/tm2OEFg52TKQAaj5dfkZzCOsHyKRsiO606Yl6Ot+W1DqNIkggiFifkItVdTgKfw9HiM0QYLTKBL2GObw9n4wF6XeeGi/vB5GTodZXkDpPg2PPiUADA5jj7X0oBmJZB/QA/ZZzVyENwRwAAAABJRU5ErkJggg==", w: 20, h: 20, k: 1 },
  shield: { src: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAABdElEQVR4nJ3UIWjDQBgF4JdRWddQFTUqBoPJiDLGxEQZZXKiVE5MljE1qiamKqZGxeQoVSGMioiJEVFCWE2gUMYoExUVWYmImLuJ9NK75O4S9kxz4c/Hu5SLBgBms0MgiT8daeyanV0GLjcbxiutYjY75P7hTuah23bJ/tFJumZnX20zvf7wfSBwSUUqbfMycYpGEmwbDjw2DwAALStK7/WNNffwzfM3s2og8iwY9d2dXEMWuz6rIUQNw7cfAMDG8Qrb7qkwACkmSuRZalCFlWknBf+LSUERNn+KuRnRdpUNOaw3AD6Hya8CAwT/MotRgM28N8BsvMCFfV7csG+ssXG8tNnh4y03PBsvcphR/+VBfzrSuu2WdAsUyuLZLAMXYbzS0oOvVw1Cjxl/GpKI3httRzGA2TL7ATjVv0pj2XCfJr1qkMur3dbew0YhxrbLgSIUAOxJIGyVxYQgRQH+NWQhADlMCrJwFhW1Kg2ybWlUGAD8AUwxtRHyLrL4AAAAAElFTkSuQmCC", w: 20, h: 20, k: 1 },
  magnet: { src: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABUAAAAVCAYAAACpF6WWAAABR0lEQVR4nOWVMUvDQBTHfw0ZJHSSghlCEQcHJwcJ0imjQ76AxQ/g0Nmho4OTo9/BVcShY8lYOoVODhkkQwQRKVI65RzSC9frXVDqIv6n3Mu93/vnHXnXAgh7fcFKWZrIR94+8xYWNeW4Ya8vrm+GdfDxIWQ6mVSLNBEmsCkHqPLSRDg2J9von0Pdw+eM46vLOvBRlMwXJQCZJcmUAzBflGS6073zk19x+nd6aoTG3s9rPa3OwQrdVq66eL2fEvkO46Ik9hxir8sABFT/9EXnVADcHrgmVq0WQKcdiNnRfh0cF+XGxsH7C+oeda/89NEyrwaKDop8h8jf7MrMNwOtTqXbu93u2ksTXAfqLkHrqS1Rhavu1BM3OpVuAXTHulTYaJkD6wPdONk77UCc7QSNYAk0DXHrdSFdA6gFpDPd3begtgJN95bUF+MSk1paqG+DAAAAAElFTkSuQmCC", w: 21, h: 21, k: 1 },
  rocket: { src: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA0AAAAWCAYAAAAb+hYkAAABUklEQVR4nK1TPUjDQBh9EQeRTOGQDkcGR+nSItIpZOzQQVzNGKGDg0MQ6aJTJgcHkYJrXUSkg0JnJ4ei4hCKlQ41QwnSSYqD8DnEi7n02uLPm3Lf3bv37nv5NCjgsBIBQOs9xOtbqGX351WEw+W4XBmY2AYoS5xTKc2CREqrCJQXOJjO6c9K0rX9fB7DUz9Zn2zV4o92qGZbtktBN6KgGxHTOTUGREznZNkuWbZLaYtj9qxCEUfPLwCApfU6gnZruj0B37ue+qYxpZv7O0TNKgAgalaxslpWkxxWovNRRyJe7K9h168ntWPDTFr/u3BVgU6CUJNOG5sb0qHH3gdMsVj8NiWRhmeXEqkvwgWAXqAmWYUiAKBxFWdTO9iBU/nqnpFoQgOQdEWMQDr9bE01X2A6J/JyRKNbIi9H2T8c+I95kvC097ObmM6JHmyltZnESXufOrN6Mf6iw4AAAAAASUVORK5CYII=", w: 13, h: 22, k: 1 },
};
var bonusCache: any = {};
function bonusSprite(kind: string) {
  if (bonusCache[kind]) return bonusCache[kind];
  var m = BONUS_SPRITES[kind];
  if (!m) return null;
  var cv = pngToCanvas(m.src);
  if (cv) bonusCache[kind] = cv;
  return cv;
}
function warmBonusSprites() { for (var k in BONUS_SPRITES) bonusSprite(k); }
var BONUS64: any = {
  bigcoin: { src: "data:image/png;base64,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", fw: 42, fh: 42, n: 4, timing: [40, 6, 6, 6], ax: 21, ay: 21 },
  shield: { src: "data:image/png;base64,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", fw: 42, fh: 42, n: 4, timing: [40, 5, 5, 5], ax: 21, ay: 21 },
  magnet: { src: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAKgAAAAuCAYAAAC8olJxAAAGhklEQVR4nO2cP0xbRxzHv8aOKwXbcgJuIDVIURhopVJFaRgDHbIwZOqUMaqYvHTqxsDajskWRQwVU4cOEWMbMrqpWjHQVqFFoi4QOUEIPyNhbF8H+8733rv3/+xnjvtKFo/ne7/73N3vfu/e3T0DWlpaWlrhlIgbQEuexjNFQo/fGZVIbSvTVhSNxJXxRdJ4pkjoZ5hsiVQtLw2lLV5B6kAZB71QDX/0WnieL4NTOTzLObMqjdPJVhBGpzROdWCVMg4K9K/Hy5K1sfj/6XG1vMTK4ZRe9H2/OqYbpxejH04vbqUcVGr06IpVYNd2VEegjcY3nrXRAXuEsaah3/M81fISDtYXI3PSaw/WF01MjKGbt5OT8uxu5fQTUJRw0H5ED7cKDZOf6BqbQwo6mI2DSyNy0slHL6VwVstLmHz00n6e7zgzq0IHNGlmVeiwojyVFK0Ysr1MSOPQc+wTxC7ZXmZ22Wd7OZTt8UzRbKdri9rfX5sl+2uzjH1/bdacrntM0+yvzdrZZHF62DUxuDDSNCydqD67bebEkwpagGEUH1loby1c/zyy3cL8hn0wP7MKYCOUvYP1RVNU4s/PlQzTubmSgS1008+sAjsrOCi/YunmSgaqZbBb+uT8/b4McQCwvGk+PMMWFk15W8tCj1k6iyi/ky78PKjo1kOdU9ZcIOsAOysozG+Esk1tbT3JdJxuZ6XDOt9zdt4mn/dB+RUm5++b8raN++itc2bV5CT94LQyODFabcrkvFBit3nuFj+Mtnlb9BbsZo/ebv1O61iHOYPg5Nm8hhVhOIVee6e44Fm43yqboTzey/a/x3/77k2qc/pZzRkGTsCbNSyna6XwmsrfNhlzAnGT1TZvk7frx7bmvByctoekqfxtfP/j18KMfvqlil83/8Nn+AIvXjwLwuhpGwC+/e53APBlW3NeDk7fT/EUMor4nmK1LUuaUy3OSBP1fsYsvKyhHZBbmU7SnHI1SM5IDhr2AWTQ0pxyNUjOQA56d+GjfnFIlQqc1h1BcS4HetVnP1mVWItXRdYGrpaXUD16bVtbj9th+fzdWGVwagcdItEtatWj12xl7GB90bYpg6aNk9PG0l0ZAsD4+S13YRWLgw5iIC9DsXHurLAlxrmSYWt4q+LitHYktgbP8fMKwymcqP/505u2hHsnnaSbRy0AwPPaYagJ2zcPb2F76xTHpDPDlU802fHmUQsn7XP8UH/va2JZNU4qGnX49W96jt8wAgBxcm49ybANICJW/lxYTtcIelJrsePpXGcoUUAbBbTdLvOlfKKJfKLJjqntMFKFkzZOYX7DtumC/u+0uSIOTsoiYnXaVBOU09VBc9kkirc+8Fms+KQS5zujkuA/9Bxgd4S4OUVMIv4oCrUftJ64GBugVeIchu1oVs5BMAV+SFKp0YdBmtNdviNoZ1ySwijpX6eRUQmasycVOH1H0Fw2KQXGTaMkgdzIlUg2NGdPKnAGusXnE01Mp+X3pEoNMIymNHuaUx3OgU3Uey151dEeivGY5pSrqJyBHDSXTaKYBetNYdZZK7tntnOZTAqjEvuK5lSH07MUld0z05wYhX06dgOPsxO+YMczRVLKFfDm4S3TJDDQC/N1tHFKkjhpn3uZ05yXiFPooE//ObMZ5EUHznfThIGIgPnz966lhb0I6IT5vXMErkzNqT6n4xt6pVwBD66POD7FndRaOCYpvDUa+LORZGupVpVyBdy7lsZ0jtgKf0xSMIwm/jjv9SI/68aa8/Jwus6DHpMUUGsKYXPZJHIgANKA0cDeuT0Yf5P9EF8tjqKyK+6ZNMRHleZUl9P1HeenYzcAAMWsfT7MmrFo/dYJEOiMQepos14IgPXEID1ec6rN6Qh+p7hAHrTqbLxRzPa+OyYpthMljP6qtTGKEew1CKoYMd0mgq7vak61OV2f4p/XDrHX6IBWar3PW6PB0gRdaajUOn/5+a+wlak51ef09WsTpVwBAPDxFbE/f3Iz6RjS6YCYFx0cA4jU2zWn+pyeBeBh6YaBsTRxnWAVDYDfNzrX1hPENO8VtTI1p9qcgQbPX46OYSI5YtrZMp1O+Hoi2zsHDlu9dPzUhKx9hZpTPc7A7+rQsA8ApySJq4kWC9tUVxPmsC8K61P52337AQDNqQ5n4AJZVw4eZydY2HbaMiWazO33bmzNKVdxcUYaRIfVoF5f0JxyFQdnpILdKS4Qp18usyrOd2o0p1wNkvN/d459qbRObaQAAAAASUVORK5CYII=", fw: 42, fh: 46, n: 4, timing: [30, 6, 8, 8], ax: 21, ay: 29 },
  rocket: { src: "data:image/png;base64,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", fw: 30, fh: 56, n: 4, timing: [6, 6, 6, 6], ax: 15, ay: 22 },
};
var SHIELD_A2_SRC = "data:image/png;base64,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";

var bonus64Cache: any = {};
function bonus64Sheet(kind: string) {
  if (bonus64Cache[kind] !== undefined) return bonus64Cache[kind];
  var m = BONUS64[kind];
  if (!m || !m.src) return bonus64Cache[kind] = null;
  var cv = pngToCanvas(m.src);
  return bonus64Cache[kind] = cv || null;
}
function bonus64Frame(kind: string, tick: number): number {
  var m = BONUS64[kind];
  if (!m || !m.timing) return 0;
  var tm = m.timing, cycle = tm[0] + tm[1] + tm[2] + tm[3], u = ((tick % cycle) + cycle) % cycle;
  for (var i = 0; i < tm.length; i++) { if (u < tm[i]) return i; u -= tm[i]; }
  return 0;
}
function drawBonusSprite(ctx: Ctx, kind: string, cx: number, cy: number, tick?: number) {
  var m64 = BONUS64[kind], cv64 = m64 ? bonus64Sheet(kind) : null;
  if (m64 && cv64) {
    var fw = m64.fw, fh = m64.fh, fi = bonus64Frame(kind, tick || 0);
    if (fi < 0 || fi >= (m64.n || 1)) fi = 0;
    ctx.imageSmoothingEnabled = false;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(0.5, 0.5);
    ctx.drawImage(cv64, fi * fw, 0, fw, fh, -m64.ax, -m64.ay, fw, fh);
    ctx.restore();
    return true;
  }
  if (m64 && !cv64) return false;
  var m = BONUS_SPRITES[kind], cv = bonusSprite(kind);
  if (!m || !cv) return false;
  var kk = m.k;
  var dw = Math.round(m.w * kk), dh = Math.round(m.h * kk);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(cv, 0, 0, m.w, m.h, Math.round(cx - dw / 2), Math.round(cy - dh / 2), dw, dh);
  return true;
}
/* v1.0 w13: Design bonus HUD icons, bubble pop, rocket flame, and brighter v1 ability glyphs. */
var FX64: any = {
  hudIcons: { src: "data:image/png;base64,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", fw: 20, fh: 20, n: 3 },
  bubblePop: { src: "data:image/png;base64,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", fw: 80, fh: 80, n: 4 },
  rocketFlame: { src: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGAAAAAkCAYAAAB2UT9CAAACFklEQVR4nO2Xr2/CQBTHX5dlqgJxdU2WLEgkQZAKJEGjUEjEFGICNTWBRiz8AVPohT+AIJYK/gCyAMGBIAQ18ya6g7Zpe9e7lh/Z+5hr0/bdu+/73l0PgLgohugFZtq4mRS9m6fX04Nv79py5rA9rIVxKH40d6odE9lwn+rtv6reEtvD2rAcOLnUh677s0BYgLMOIIcCB5aIUPzNpAiWA5jZGBTyv/gS5BV4HvksiwLnHV8X+SXo68drKw+n61sio/z7vQECALy8PRsA+itEbAHCHeWOQKDJ2EUAAKdevqhjsyayAFx8zvawNqwuoNsswGOFwXK6h/JoF6huq9HBj893KXHOXtwMic1Z0UCRewDvRFagVqOD/jaJcHFlceplI437J2MX+aA9A60Cz63u6migfm+AqnnpErsJR4lfHu0CLYc7X3YGhOOLBFKFF4yZNrrNAiynewAAWE734DYLwEw7lfCtRgdlTBaXSybLJzPtXJzCTBsX7RLirIaLdgmj+lEdvGz8JLj4cTkw00YcVhFnNcRhVTp+6t9QXVfquIh/rxo/bgbLoDLLZUh3EtaEC6M6CNF3ScXhxtE5eIn6X073x5+UpBz9cc56EBMNQMeh/vhJ/YjE152hotj+9irJa4+RRVaccKFk95irFv+WCAvJTBuZaSPOasivL5Xbv4aEJwiCIAiCIAiCIAiCIAiCIAiCIAg/vyzJaGDCd4VAAAAAAElFTkSuQmCC", fw: 24, fh: 36, n: 4 },
  abIcons: { src: "data:image/png;base64,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", fw: 24, fh: 24, n: 6 },
};
var fx64Cache: any = {};
function fx64Sheet(key: string) {
  if (fx64Cache[key] !== undefined) return fx64Cache[key];
  var m = FX64[key];
  fx64Cache[key] = (m && m.src) ? (pngToCanvas(m.src) || null) : null;
  return fx64Cache[key];
}
var BONUSES: any[] = [
  { id: "bigcoin", name: "КЛАД", wt: 25 },
  { id: "shield", name: "ЩИТ", wt: 22, t: 500 },
  { id: "magnet", name: "МАГНИТ", wt: 20, t: 450 },
  { id: "rocket", name: "РАКЕТА", wt: 15, t: 85 }
];
var BIGCOIN = 25;
/* Visual-only bubble around floating pickups. Pickup hitbox stays it.x-2 / 14 × it.y-2 / 14.
   Sizes live here so 2.0 can restyle without touching draw or overlap. */
var BUBBLE = {
  r: 14,
  bobAmp: 1,
  bobShift: 4,
  popTicks: 10,
  fillA: 0.22,
  fill: "#e8fcff",
  rim: "#e8ecf4",
  hi: "#ffffff"
};

/* Phone scale is the 0.56 fractional nearest-neighbor fill. World stays 160×346, LW/NET_LW unchanged. */
/* Campaign maps: open the next one by reaching `goal` m here AND paying its price.
   mobs: [kind, from metres] */
var MAPS: any[] = [
  { id: "city", name: "ГОРОД", price: 0, goal: 500, special: "", mobs: [["blob", 180], ["bat", 400], ["bob", 800], ["hole", 1500], ["ufo", 2200]] },
  { id: "jungle", name: "ДЖУНГЛИ", price: 80, goal: 700, special: "bounce", mobs: [["frog", 100], ["parrot", 300], ["snake", 550], ["monkey", 900], ["bat", 1400]] },
  { id: "ice", name: "ЛЕДНИК", price: 100, goal: 900, special: "ice", mobs: [["penguin", 120], ["owl", 400], ["frost", 750], ["wind", 1200], ["blob", 1700]] },
  { id: "lava", name: "ВУЛКАН", price: 120, goal: 1100, special: "lava", mobs: [["magma", 120], ["spitter", 380], ["firebat", 700], ["ember", 1100]] },
  { id: "aqua", name: "ОКЕАН", price: 140, goal: 1300, special: "bubble", mobs: [["crab", 120], ["ray", 350], ["bob", 700], ["puffer", 1100], ["whirl", 1600]] },
  { id: "space", name: "КОСМОС", price: 160, goal: 0, special: "grav", mobs: [["alien", 120], ["ufo", 400], ["comet", 800], ["hole", 1300]] }
];
/* mob kinds. b = behaviour; plat = stands on a platform; gap = min vertical gap (px) it needs */
var MOBS: any = {
  blob: { b: "walk", w: 12, h: 8, gap: 0, plat: true, sp: 0.16, name: "СЛИЗЕНЬ", g: "m" },
  magma: { b: "walk", w: 12, h: 8, gap: 0, plat: true, sp: 0.3, name: "ЛАВОСЛИЗЬ", g: "f" },
  penguin: { b: "walk", w: 10, h: 11, gap: 0, plat: true, sp: 0.55, name: "ПИНГВИН", g: "m" },
  crab: { b: "walk", w: 14, h: 8, gap: 0, plat: true, sp: 0.42, name: "КРАБ", g: "m" },
  alien: { b: "walk", w: 12, h: 9, gap: 0, plat: true, sp: 0.3, name: "ПРИШЕЛЕЦ", g: "m" },
  frog: { b: "hop", w: 12, h: 8, gap: 31, plat: true, name: "ЛЯГУШКА", g: "f" },
  monkey: { b: "throw", w: 12, h: 11, gap: 0, plat: true, name: "ОБЕЗЬЯНА", g: "f" },
  spitter: { b: "spit", w: 12, h: 10, gap: 0, plat: true, name: "ПЛЕВУН", g: "m" },
  bat: { b: "fly", w: 14, h: 10, gap: 34, name: "МЫШЬ", g: "f" },
  parrot: { b: "fly", w: 14, h: 10, gap: 38, dive: true, name: "ПОПУГАЙ", g: "m" },
  owl: { b: "fly", w: 14, h: 10, gap: 34, name: "СОВА", g: "f" },
  firebat: { b: "fly", w: 14, h: 10, gap: 34, name: "ОГНЕМЫШЬ", g: "f" },
  ray: { b: "fly", w: 16, h: 8, gap: 34, dive: true, name: "СКАТ", g: "m" },
  bob: { b: "sway", w: 12, h: 12, gap: 34, name: "МЕДУЗА", g: "f" },
  ember: { b: "sway", w: 12, h: 12, gap: 34, name: "ОГНЕШАР", g: "m" },
  snake: { b: "snake", w: 10, h: 8, gap: 38, name: "ЗМЕЯ-ЛИАНА", g: "f" },
  puffer: { b: "puff", w: 12, h: 12, gap: 40, name: "РЫБА-ЁЖ", g: "f" },
  hole: { b: "pull", w: 14, h: 14, gap: 44, name: "ЧЁРНАЯ ДЫРА", g: "f" },
  whirl: { b: "pull", w: 14, h: 14, gap: 44, name: "ВОДОВОРОТ", g: "m" },
  wind: { b: "wind", w: 24, h: 10, gap: 40, name: "ВЬЮГА", g: "f" },
  ufo: { b: "shoot", w: 14, h: 8, gap: 34, name: "НЛО", g: "m" },
  frost: { b: "shoot", w: 12, h: 12, gap: 38, freeze: true, name: "ЛЕДЯНОЙ ДУХ", g: "m" },
  comet: { b: "comet", w: 12, h: 8, gap: 34, name: "КОМЕТА", g: "f" }
};

var FONT: any = {
  "0": [14, 17, 19, 21, 25, 17, 14], "1": [4, 12, 4, 4, 4, 4, 14], "2": [14, 17, 1, 2, 4, 8, 31],
  "3": [14, 17, 1, 6, 1, 17, 14], "4": [2, 6, 10, 18, 31, 2, 2], "5": [31, 16, 30, 1, 1, 17, 14],
  "6": [14, 16, 16, 30, 17, 17, 14], "7": [31, 1, 2, 4, 8, 8, 8], "8": [14, 17, 17, 14, 17, 17, 14],
  "9": [14, 17, 17, 15, 1, 1, 14],
  "A": [14, 17, 17, 31, 17, 17, 17], "B": [30, 17, 17, 30, 17, 17, 30], "C": [14, 17, 16, 16, 16, 17, 14],
  "D": [30, 17, 17, 17, 17, 17, 30], "E": [31, 16, 16, 30, 16, 16, 31], "F": [31, 16, 16, 30, 16, 16, 16],
  "G": [14, 17, 16, 23, 17, 17, 14], "H": [17, 17, 17, 31, 17, 17, 17], "I": [14, 4, 4, 4, 4, 4, 14],
  "J": [7, 2, 2, 2, 18, 18, 12], "K": [17, 18, 20, 24, 20, 18, 17], "L": [16, 16, 16, 16, 16, 16, 31],
  "M": [17, 27, 21, 21, 17, 17, 17], "N": [17, 25, 21, 19, 17, 17, 17], "O": [14, 17, 17, 17, 17, 17, 14],
  "P": [30, 17, 17, 30, 16, 16, 16], "Q": [14, 17, 17, 17, 21, 18, 13], "R": [30, 17, 17, 30, 20, 18, 17],
  "S": [14, 17, 16, 14, 1, 17, 14], "T": [31, 4, 4, 4, 4, 4, 4], "U": [17, 17, 17, 17, 17, 17, 14],
  "V": [17, 17, 17, 17, 17, 10, 4], "W": [17, 17, 17, 21, 21, 27, 17], "X": [17, 17, 10, 4, 10, 17, 17],
  "Y": [17, 17, 10, 4, 4, 4, 4], "Z": [31, 1, 2, 4, 8, 16, 31],
  " ": [0, 0, 0, 0, 0, 0, 0], ".": [0, 0, 0, 0, 0, 12, 12],
  ":": [0, 12, 12, 0, 12, 12, 0], ",": [0, 0, 0, 0, 12, 4, 8], "-": [0, 0, 0, 14, 0, 0, 0],
  "+": [0, 4, 4, 31, 4, 4, 0], "?": [14, 17, 1, 2, 4, 0, 4], "!": [4, 4, 4, 4, 4, 0, 4],
  "<": [1, 2, 4, 8, 4, 2, 1], ">": [16, 8, 4, 2, 4, 8, 16], "/": [1, 1, 2, 4, 8, 16, 16], "(": [2, 4, 8, 8, 8, 4, 2], ")": [8, 4, 2, 2, 2, 4, 8],
  "А": [14, 17, 17, 31, 17, 17, 17], "Б": [30, 16, 16, 30, 17, 17, 30], "В": [30, 17, 17, 30, 17, 17, 30],
  "Г": [31, 16, 16, 16, 16, 16, 16], "Д": [15, 9, 9, 9, 9, 31, 17], "Е": [31, 16, 16, 30, 16, 16, 31],
  "Ё": [10, 31, 16, 30, 16, 16, 31], "Ж": [21, 21, 14, 4, 14, 21, 21], "З": [14, 17, 1, 6, 1, 17, 14],
  "И": [17, 17, 19, 21, 25, 17, 17], "Й": [10, 17, 19, 21, 25, 17, 17], "К": [17, 18, 20, 24, 20, 18, 17],
  "Л": [7, 9, 9, 9, 9, 9, 17], "М": [17, 27, 21, 21, 17, 17, 17], "Н": [17, 17, 17, 31, 17, 17, 17],
  "О": [14, 17, 17, 17, 17, 17, 14], "П": [31, 17, 17, 17, 17, 17, 17], "Р": [30, 17, 17, 30, 16, 16, 16],
  "С": [14, 17, 16, 16, 16, 17, 14], "Т": [31, 4, 4, 4, 4, 4, 4], "У": [17, 17, 17, 15, 1, 17, 14],
  "Ф": [4, 14, 21, 21, 14, 4, 4], "Х": [17, 17, 10, 4, 10, 17, 17], "Ц": [17, 17, 17, 17, 17, 31, 1],
  "Ч": [17, 17, 17, 15, 1, 1, 1], "Ш": [17, 17, 17, 21, 21, 21, 31], "Щ": [21, 21, 21, 21, 21, 31, 3],
  "Ъ": [24, 8, 14, 9, 9, 9, 14], "Ы": [17, 17, 17, 29, 19, 19, 29], "Ь": [16, 16, 16, 30, 17, 17, 30],
  "Э": [14, 17, 1, 7, 1, 17, 14], "Ю": [23, 21, 21, 27, 21, 21, 23], "Я": [15, 17, 17, 15, 5, 9, 17],
  "%": [25, 21, 2, 4, 8, 21, 19], "●": [0, 14, 31, 31, 31, 14, 0], "→": [0, 4, 2, 31, 2, 4, 0], "←": [0, 4, 8, 31, 8, 4, 0],
  "✓": [0, 1, 2, 18, 8, 4, 0], "▶": [16, 24, 28, 30, 28, 24, 16], "↑": [4, 14, 21, 4, 4, 4, 4], "·": [0, 0, 0, 12, 12, 0, 0], "▼": [0, 0, 31, 14, 4, 0, 0]
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
  var had = !!(s && typeof s === "object") || storageGet("hoppak_char") != null;
  if (!s || typeof s !== "object") s = {};
  if (!s.v5) s.hadSave = had;
  if (typeof s.coins !== "number") s.coins = 0;
  if (!s.owned || typeof s.owned !== "object") s.owned = {};
  if (typeof s.char !== "number") {
    var c = parseInt(storageGet("hoppak_char") || "0", 10) || 0;
    s.char = c >= 0 && c < 4 ? c : 0;
  }
  if (!s.v5) {
    /* v0.5 replaced the 4 old free heroes (Рома, Лера, Макс, Катя) with a new roster: everyone starts as Капитан */
    s.char = 0;
    for (var ok in s.owned) if (ok.indexOf("char:") === 0) delete s.owned[ok];
    s.v5 = 1;
  }
  if (s.char < 0 || s.char >= CHARS.length) s.char = 0;
  if (!s.mapBest || typeof s.mapBest !== "object") s.mapBest = {};
  if (!s.color) s.color = "base";
  if (!s.hat) s.hat = "none";
  if (s.owned["bg:sunset"]) s.owned["map:lava"] = 1;
  if (s.owned["bg:neon"]) s.owned["map:space"] = 1;
  if (!s.bg || s.bg === "night") s.bg = "city";
  else if (s.bg === "sunset") s.bg = "lava";
  else if (s.bg === "neon") s.bg = "space";
  if (mapInfo(s.bg).id !== s.bg) s.bg = "city";
  if (typeof s.best !== "number") s.best = parseInt(storageGet("hoppak_best") || "0", 10) || 0;
  if (typeof s.mapBest.city !== "number") s.mapBest.city = s.best;
  if (s.sfx !== false) s.sfx = true; else s.sfx = false;
  if (s.vib !== false) s.vib = true; else s.vib = false;
  if (!s.seen || typeof s.seen !== "object") s.seen = {};
  vibOn = !!s.vib;
  /* One slider. Old music and sfx volumes become the louder of the two. */
  if (typeof s.vol !== "number") {
    var mv = typeof s.music === "number" ? clamp(s.music, 0, 1) : 0.55;
    var sv = typeof s.sfxVol === "number" ? clamp(s.sfxVol, 0, 1) : 0.8;
    s.vol = clamp(Math.max(mv, sv), 0, 1);
  }
  s.vol = clamp(s.vol, 0, 1);
  if (s.audioOn !== true && s.audioOn !== false) s.audioOn = (s.musicOn !== false) || (s.sfx !== false);
  s.music = s.vol; s.sfxVol = s.vol; s.musicOn = s.audioOn; s.sfx = s.audioOn;
  masterVol = s.vol; audioOn = !!s.audioOn;
  sfxVol = masterVol; musicVol = masterVol; sfxOn = audioOn; musicOn = audioOn;
  /* TEMPORARY: background contrast (Settings). Invalid / missing → 100. */
  if (typeof s.bgContrast !== "number") s.bgContrast = 100;
  s.bgContrast = snapBgContrast(s.bgContrast);
  bgContrastPct = s.bgContrast;
  return s;
}
function writeSave(s: any) { storageSet("hoppak_save", JSON.stringify(s)); }

/* ---- audio: files under audio/, started only after a gesture. Beeps remain if a file cannot play. ---- */
var audioCtx: any = null, sfxOn = true, vibOn = true, sfxVol = 0.8, musicOn = true, musicVol = 0.55;
var masterVol = 0.8, audioOn = true;
var audioUnlocked = false, audioExt = "";
/* Relative loudness. Jump and the results tick fire constantly, so they stay quieter than a coin. */
var SFX_GAIN: any = { jump: 0.32, coin: 0.7, bonus: 0.75, shield: 0.7, death: 0.8, warn: 0.5, deny: 0.48, tick: 0.22, hit: 0.6 };
/* Track id -> files. Add a row here, then a row in MUSIC_CUES, to bring in another loop. */
var MUSIC_TRACKS: any = {
  hush: { ogg: "audio/hush.ogg", mp3: "audio/hush.mp3" }
};
/* First matching row wins. "*" matches every screen or every map. Crossfade runs when the chosen id changes. */
var MUSIC_CUES: any[] = [
  { track: "hush", screens: ["*"], maps: ["*"] }
];
var musicCur = "";
var masterGain: any = null, musicGain: any = null, musicNode: any = null;
var musicBuf: any = {}, musicLoading: any = {};
var audioProbe: any = { sfxToMaster: false, musicToMaster: false };

var sfxBuf: any = {}, sfxLoading: any = {}, sfxLive: any[] = [];
var sfxStat: any = { calls: {}, sources: {} };
var SFX_CAP = 6;
function ensureCtx() {
  try {
    var AC: any = (typeof window !== "undefined") && ((window as any).AudioContext || (window as any).webkitAudioContext);
    if (!AC) return null;
    if (!audioCtx) audioCtx = new AC();
    if (audioCtx.state === "suspended" || audioCtx.state === "interrupted") {
      var resumed = audioCtx.resume();
      if (resumed && resumed.catch) resumed.catch(function () {});
    }
    return audioCtx;
  } catch (_e) { return null; }
}
function ensureMaster() {
  var ctx = ensureCtx();
  if (!ctx) return null;
  if (!masterGain) {
    masterGain = ctx.createGain();
    masterGain.gain.value = audioOn ? masterVol : 0;
    masterGain.connect(ctx.destination);
  }
  return masterGain;
}
function applyMaster() {
  var g = ensureMaster();
  if (g) g.gain.value = audioOn ? masterVol : 0;
}
function ensureMusicGain() {
  var m = ensureMaster();
  var ctx = ensureCtx();
  if (!ctx || !m) return null;
  if (!musicGain) {
    musicGain = ctx.createGain();
    musicGain.gain.value = 1;
    musicGain.connect(m);
    audioProbe.musicToMaster = true;
  }
  return musicGain;
}
function loadSfx(kind: string) {
  if (sfxBuf[kind] || sfxLoading[kind] || !audioCtx || typeof fetch === "undefined") return;
  sfxLoading[kind] = 1;
  var ctx = audioCtx;
  var src = "audio/" + kind + "." + pickAudioExt();
  fetch(src).then(function (r: any) {
    if (!r.ok) throw 0;
    return r.arrayBuffer();
  }).then(function (b: any) { return ctx.decodeAudioData(b); }).then(function (buf: any) {
    sfxBuf[kind] = buf;
    sfxLoading[kind] = 0;
  }).catch(function () { sfxLoading[kind] = 0; });
}
function preloadSfx() {
  var kinds = ["jump", "coin", "bonus", "shield", "death", "warn", "deny", "tick", "hit"];
  for (var i = 0; i < kinds.length; i++) loadSfx(kinds[i]);
}
function audioUnlock() {
  audioUnlocked = true;
  ensureCtx();
  preloadSfx();
  hopMusic(musicCur || musicCue("menu", "city"));
}
function hopVib(ms: any) {
  if (!vibOn) return;
  try { if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(ms); } catch (_e) {}
}
function pickAudioExt() {
  if (audioExt) return audioExt;
  audioExt = "mp3";
  try {
    var ua = (typeof navigator !== "undefined" && navigator.userAgent) || "";
    if (/iPhone|iPad|iPod/i.test(ua)) return audioExt;
    var a = (typeof document !== "undefined") && document.createElement("audio");
    /* "maybe" is a lie in some WebViews: they advertise ogg and then drop it. */
    if (a && a.canPlayType && a.canPlayType('audio/ogg; codecs="vorbis"') === "probably") audioExt = "ogg";
  } catch (_e) {}
  return audioExt;
}
function makeAudio(src: string) {
  try {
    if (typeof Audio === "undefined") return null;
    var a = new Audio();
    a.preload = "none";
    a.src = src;
    return a;
  } catch (_e) { return null; }
}
function beep(freq: number, dur: number, vol: number, type: string, slide?: number) {
  if (!sfxOn || !audioCtx) return;
  try {
    var t0 = audioCtx.currentTime, osc = audioCtx.createOscillator(), g = audioCtx.createGain();
    osc.type = type || "square";
    osc.frequency.setValueAtTime(freq, t0);
    if (slide) osc.frequency.linearRampToValueAtTime(Math.max(40, freq + slide), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g); g.connect(ensureMaster() || audioCtx.destination);
    if (masterGain) audioProbe.sfxToMaster = true;
    osc.start(t0); osc.stop(t0 + dur + 0.02);
  } catch (_e) {}
}
function hopSfx(kind: string) {
  if (!sfxOn || sfxVol <= 0) return;
  if (kind === "bonus") hopVib(18);
  else if (kind === "hit") hopVib(30);
  else if (kind === "death") hopVib([40, 40, 60]);
  else if (kind === "deny") hopVib(12);
  sfxStat.calls[kind] = (sfxStat.calls[kind] || 0) + 1;
  if (!audioUnlocked) return;
  var ctx = ensureCtx();
  if (!ctx) { beepFallback(kind); return; }
  var buf = sfxBuf[kind];
  if (!buf) { loadSfx(kind); beepFallback(kind); return; }
  /* A fresh buffer source per play. iOS will not reliably rewind one HTMLAudioElement. */
  var now = ctx.currentTime, i;
  for (i = sfxLive.length - 1; i >= 0; i--) if (sfxLive[i].until <= now) sfxLive.splice(i, 1);
  if (sfxLive.length >= SFX_CAP) {
    if (kind !== "jump") return;
    var idx = 0;
    for (i = 0; i < sfxLive.length; i++) if (sfxLive[i].kind !== "jump") { idx = i; break; }
    try { sfxLive[idx].node.stop(); } catch (_e) {}
    sfxLive.splice(idx, 1);
  }
  try {
    var node = ctx.createBufferSource();
    var g = ctx.createGain();
    node.buffer = buf;
    var vol = clamp(SFX_GAIN[kind] != null ? SFX_GAIN[kind] : 0.5, 0, 1);
    g.gain.setValueAtTime(Math.max(0.0001, vol), now);
    node.connect(g); g.connect(ensureMaster() || ctx.destination);
    if (masterGain) audioProbe.sfxToMaster = true;
    node.start(now);
    sfxStat.sources[kind] = (sfxStat.sources[kind] || 0) + 1;
    sfxLive.push({ node: node, kind: kind, until: now + (buf.duration || 0.25) + 0.02 });
  } catch (_e2) { beepFallback(kind); }
}
function beepFallback(kind: string) {
  if (kind === "jump") beep(200, 0.045, 0.045, "sine", 40);
  else if (kind === "coin") { beep(880, 0.04, 0.05, "square"); beep(1170, 0.06, 0.04, "square"); }
  else if (kind === "bonus" || kind === "shield") beep(520, 0.06, 0.06, "triangle", 200);
  else if (kind === "hit") beep(140, 0.1, 0.08, "sawtooth", -80);
  else if (kind === "death") beep(220, 0.22, 0.08, "sawtooth", -160);
  else if (kind === "warn") beep(160, 0.08, 0.05, "square", -20);
  else if (kind === "deny") beep(110, 0.07, 0.05, "square");
  else if (kind === "tick") beep(940, 0.02, 0.03, "square");
}
function musicCue(screen: string, map: string) {
  for (var i = 0; i < MUSIC_CUES.length; i++) {
    var c = MUSIC_CUES[i];
    var scr = c.screens || ["*"];
    var maps = c.maps || ["*"];
    if ((scr.indexOf("*") >= 0 || scr.indexOf(screen) >= 0) && (maps.indexOf("*") >= 0 || maps.indexOf(map) >= 0)) return c.track;
  }
  return "";
}
function musicSrc(id: string) {
  var t = MUSIC_TRACKS[id];
  if (!t) return "";
  return pickAudioExt() === "ogg" ? t.ogg : t.mp3;
}
function stopMusic() {
  if (!musicNode) return;
  try { musicNode.stop(); } catch (_e) {}
  musicNode = null;
}
function startMusicBuf(buf: any) {
  var ctx = ensureCtx();
  var g = ensureMusicGain();
  if (!ctx || !g || !buf) return;
  stopMusic();
  try {
    var node = ctx.createBufferSource();
    node.buffer = buf;
    node.loop = true;
    node.connect(g);
    node.start();
    musicNode = node;
    audioProbe.musicToMaster = true;
  } catch (_e) {}
}
function loadMusic(src: string) {
  if (!src) return;
  if (musicBuf[src]) { startMusicBuf(musicBuf[src]); return; }
  if (musicLoading[src] || typeof fetch === "undefined") return;
  var ctx = ensureCtx();
  if (!ctx) return;
  musicLoading[src] = 1;
  fetch(src).then(function (r: any) {
    if (!r.ok) throw 0;
    return r.arrayBuffer();
  }).then(function (b: any) { return ctx.decodeAudioData(b); }).then(function (buf: any) {
    musicBuf[src] = buf;
    musicLoading[src] = 0;
    if (musicCur && musicSrc(musicCur) === src) startMusicBuf(buf);
  }).catch(function () { musicLoading[src] = 0; });
}
function hopMusic(id: string) {
  applyMaster();
  if (!audioUnlocked) { musicCur = id || ""; return; }
  var want = audioOn && masterVol > 0 ? (id || "") : "";
  if (want === musicCur && (musicNode || !want)) return;
  musicCur = want;
  if (!want) { stopMusic(); return; }
  loadMusic(musicSrc(want));
}
function hopMusicTick() { applyMaster(); }
function setMasterVol(v: number) {
  masterVol = clamp(Math.round(clamp(v, 0, 1) * 10) / 10, 0, 1);
  sfxVol = masterVol; musicVol = masterVol;
  applyMaster();
  if (audioUnlocked && audioOn) hopMusic(musicCur || musicCue("menu", "city"));
}
function setAudioOn(on: boolean) {
  audioOn = !!on; sfxOn = audioOn; musicOn = audioOn;
  applyMaster();
  if (!audioOn) stopMusic();
  else if (audioUnlocked) hopMusic(musicCur || musicCue("menu", "city"));
}
function readAudioProbe() {
  applyMaster();
  return { gain: masterGain ? masterGain.gain.value : null, sfxToMaster: !!audioProbe.sfxToMaster, musicToMaster: !!audioProbe.musicToMaster };
}

var FIRST_TOAST: any = {
  break: "ЛОМАЕТСЯ ПОСЛЕ ПРЫЖКА",
  goal: "ДОПРЫГНИ ДО ЦЕЛИ",
  record: "ТВОЙ РЕКОРД - ПОБЕЙ!"
};


/* Uppercase, then drop any glyph the font does not have. Never substitute '?'. */
function drawableChars(s: string) {
  s = String(s).toUpperCase();
  var out = "";
  for (var i = 0; i < s.length; i++) if (FONT[s[i]]) out += s[i];
  return out;
}
function textWidth(s: string, sc: number) {
  var n = drawableChars(s).length;
  return n ? n * 6 * sc : 0;
}
function drawText(ctx: Ctx, s: string, x: number, y: number, color: string, sc?: number, align?: string) {
  var k = sc || 1;
  s = drawableChars(s);
  var w = s.length ? textWidth(s, k) - k : 0;
  var xx = Math.round(align === "center" ? x - w / 2 : align === "right" ? x - w : x);
  y = Math.round(y);
  ctx.fillStyle = color;
  for (var i = 0; i < s.length; i++) {
    var g = FONT[s[i]];
    for (var r = 0; r < 7; r++) for (var c = 0; c < 5; c++) if (g[r] & (1 << (4 - c))) ctx.fillRect(xx + c * k, y + r * k, k, k);
    xx += 6 * k;
  }
  return w;
}
/* 3×5 caps for tight UI labels (tab bar, grid). Pitch 4, no word-wrap needed at 32px tabs. */
var TINY: any = {
  "А": [2,5,7,5,5], "Б": [6,4,6,5,6], "В": [6,5,6,5,6], "Г": [7,4,4,4,4], "Д": [3,5,5,5,7],
  "Е": [7,4,6,4,7], "Ё": [5,7,4,6,7], "Ж": [5,7,2,7,5], "З": [6,1,2,1,6], "И": [5,7,7,5,5],
  "Й": [2,5,7,5,5], "К": [5,6,4,6,5], "Л": [3,5,5,5,5], "М": [5,7,5,5,5], "Н": [5,5,7,5,5],
  "О": [2,5,5,5,2], "П": [7,5,5,5,5], "Р": [6,5,6,4,4], "С": [3,4,4,4,3], "Т": [7,2,2,2,2],
  "У": [5,5,5,1,6], "Ф": [2,7,2,2,2], "Х": [5,2,2,2,5], "Ц": [5,5,5,5,7], "Ч": [5,5,3,1,1],
  "Ш": [5,5,7,5,7], "Щ": [5,5,7,7,1], "Ъ": [6,2,6,2,6], "Ы": [5,5,7,5,7], "Ь": [4,4,6,5,6],
  "Э": [7,1,3,1,7], "Ю": [5,7,7,5,5], "Я": [3,5,3,6,5],
  " ": [0,0,0,0,0], "·": [0,0,2,0,0], "-": [0,0,7,0,0], ".": [0,0,0,2,2], "/": [1,1,2,4,4],
  "0": [7,5,5,5,7], "1": [2,6,2,2,7], "2": [6,1,2,4,7], "3": [6,1,6,1,6], "4": [5,5,7,1,1],
  "5": [7,4,6,1,6], "6": [3,4,6,5,2], "7": [7,1,2,2,2], "8": [2,5,2,5,2], "9": [2,5,3,1,6]
};
function tinyChars(s: string) {
  s = String(s).toUpperCase();
  var out = "";
  for (var i = 0; i < s.length; i++) if (TINY[s[i]]) out += s[i];
  return out;
}
function tinyWidth(s: string) {
  var n = tinyChars(s).length;
  return n ? n * 4 - 1 : 0;
}
function drawTiny(ctx: Ctx, s: string, x: number, y: number, color: string, align?: string) {
  s = tinyChars(s);
  var w = s.length ? tinyWidth(s) : 0;
  var xx = Math.round(align === "center" ? x - w / 2 : align === "right" ? x - w : x);
  y = Math.round(y);
  ctx.fillStyle = color;
  for (var i = 0; i < s.length; i++) {
    var g = TINY[s[i]];
    for (var r = 0; r < 5; r++) for (var c = 0; c < 3; c++) if (g[r] & (1 << (2 - c))) ctx.fillRect(xx + c, y + r, 1, 1);
    xx += 4;
  }
  return w;
}

function typeH(role: string) { return role === "S" ? 5 : 7 * (TYPE[role] || 1); }
function uiWidth(s: string, role: string) {
  return role === "S" ? tinyWidth(s) : textWidth(s, TYPE[role] || 1);
}
function uiText(ctx: Ctx, s: string, x: number, y: number, color: string, role: string, align?: string) {
  if (role === "S") return drawTiny(ctx, s, x, y, color, align);
  return drawText(ctx, s, x, y, color, TYPE[role] || 1, align);
}

/* TEMPORARY (Nov 2026): Settings "Контраст фона" / Background contrast.
   Roman wants to try quieter backgrounds. Remove once the test is done.
   Affects only drawBg layers (sky, parallax, horizons, floor). Heroes, platforms,
   mobs, bonuses and UI stay untouched. Default 100 = current look. */
var BG_CONTRAST_STEPS = [40, 55, 70, 85, 100];
var bgContrastPct = 100;
function applyBgContrast(ctx: Ctx, fn: any) {
  var p = bgContrastPct;
  if (!(p < 100)) { fn(); return; }
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.filter = "saturate(" + p + "%) contrast(" + p + "%)";
  fn();
  ctx.restore();
}
function snapBgContrast(pct: number) {
  var best = 100, bd = 1e9;
  for (var i = 0; i < BG_CONTRAST_STEPS.length; i++) {
    var d = Math.abs(BG_CONTRAST_STEPS[i] - pct);
    if (d < bd) { bd = d; best = BG_CONTRAST_STEPS[i]; }
  }
  return best;
}

function tinyLines(s: string, maxW: number) {
  s = tinyChars(s);
  if (tinyWidth(s) <= maxW) return [s];
  var parts = s.split(" ");
  if (parts.length > 1) {
    var lines: string[] = [], cur = parts[0];
    for (var i = 1; i < parts.length; i++) {
      var try_ = cur + " " + parts[i];
      if (tinyWidth(try_) <= maxW) cur = try_;
      else { lines.push(cur); cur = parts[i]; }
    }
    lines.push(cur);
    return lines;
  }
  var a = "", b = s;
  for (var k = 1; k < s.length; k++) {
    if (tinyWidth(s.slice(0, k)) <= maxW) a = s.slice(0, k), b = s.slice(k);
  }
  return a && b ? [a, b] : [s];
}

var UI_IMGS: any = {};
function loadUiImage(key: string, src: string) {
  var im = new Image();
  im.onload = function () { UI_IMGS[key] = im; };
  im.src = src;
}
function warmUiImages() {
  var tabs = ["shop", "leagues", "home", "friends", "settings"];
  var grids = ["maps", "multiplayer", "encyclopedia", "quests"];
  var ports = ["pilot", "pirate", "ninja", "robot", "mage", "knight"];
  var i;
  for (i = 0; i < tabs.length; i++) loadUiImage("bar_" + tabs[i], "ui/tab/bar_" + tabs[i] + ".png");
  for (i = 0; i < grids.length; i++) loadUiImage("grid_" + grids[i], "ui/grid/grid_" + grids[i] + ".png");
  for (i = 0; i < ports.length; i++) {
    loadUiImage("portrait_" + ports[i], "ui/portrait/portrait_" + ports[i] + ".png");
    loadUiImage("portrait64_" + ports[i], "ui/portrait/portrait64_" + ports[i] + ".png");
  }
}
warmUiImages();
/* Nearest-neighbour only, dest size an integer multiple of the source. */
function drawUiPx(ctx: Ctx, key: string, x: number, y: number, mul?: number) {
  x = Math.round(x); y = Math.round(y);
  var im = UI_IMGS[key];
  var k = mul && mul >= 1 ? Math.round(mul) : 1;
  if (k < 1) k = 1;
  ctx.imageSmoothingEnabled = false;
  if ((ctx as any).webkitImageSmoothingEnabled !== undefined) (ctx as any).webkitImageSmoothingEnabled = false;
  if (im && im.complete && im.naturalWidth) {
    ctx.drawImage(im, x, y, im.naturalWidth * k, im.naturalHeight * k);
    return im.naturalWidth * k;
  }
  var ph = 16 * k;
  ctx.fillStyle = "#241838";
  ctx.fillRect(x, y, ph, ph);
  return ph;
}
/* v1.0: portraits are drawn on the DEVICE pixel grid with an integer scale (menus are 7.31 device px per
   game px, so game-px scaling would smear them). Uses the 64 px file when 64*k still fills >= 80% of the
   slot, else the 32 px one. Falls back to the plain game-px path if the transform is not available. */
function portraitSnap(ctx: Ctx, id: string, x: number, y: number, size: number, crop: boolean) {
  var g: any = ctx as any;
  var im64 = UI_IMGS["portrait64_" + id], im32 = UI_IMGS["portrait_" + id];
  if (!g.getTransform || !(im64 || im32)) return -1;
  var m = g.getTransform(), sc = m.a;
  if (!(sc > 0) || Math.abs(m.b) > 1e-6 || Math.abs(m.c) > 1e-6) return -1;
  var dev = size * sc, im: any = null, k = 0, srcN = 0, best = -1;
  /* v1.0: the portrait fills ~85-100% of its slot at any window width / dpr. Whole device px per art px
     (round, not floor); if that overflows the slot the edge rows are cropped (at most ~15%); the 64 px
     portrait wins when it fills >= 85%, else whichever source fills more. */
  var cand = [[im64, 64], [im32, 32]];
  for (var i = 0; i < cand.length; i++) {
    var c: any = cand[i][0], n = cand[i][1] as number;
    if (!(c && c.complete && c.naturalWidth)) continue;
    var base = crop ? n * 0.66 : n;
    var kk = Math.max(1, Math.round(dev / base));
    while (kk > 1 && n * kk > dev * (crop ? 1.6 : 1.2)) kk--;
    var fill = Math.min(1, (crop ? base : n) * kk / dev);
    var score = fill + (n === 64 && fill >= 0.85 ? 1 : 0);
    if (score > best) { best = score; im = c; k = kk; srcN = n; }
  }
  if (!im) return -1;
  var side = Math.min(srcN, Math.floor(dev / k));
  var sx = Math.round((srcN - side) / 2), sy = crop ? Math.max(0, Math.round((srcN - side) / 2) - Math.round(srcN / 16)) : Math.round((srcN - side) / 2);
  var w = side * k;
  var dx = Math.round(m.e + x * sc + (dev - w) / 2), dy = Math.round(m.f + y * m.d + (size * m.d - w) / 2);
  g.save();
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.imageSmoothingEnabled = false;
  g.drawImage(im, sx, sy, side, side, dx, dy, w, w);
  g.restore();
  return size;
}
function drawPortrait(ctx: Ctx, kind: number, x: number, y: number, mul?: number) {
  var id = (CHARS[kind] && CHARS[kind].id) || "pilot";
  var r = portraitSnap(ctx, id, Math.round(x), Math.round(y), 32 * (mul || 1), false);
  if (r > 0) return r;
  return drawUiPx(ctx, "portrait_" + id, x, y, mul || 1);
}
function drawPortraitCrop(ctx: Ctx, kind: number, x: number, y: number, size: number) {
  x = Math.round(x); y = Math.round(y); size = Math.round(size);
  var id = (CHARS[kind] && CHARS[kind].id) || "pilot";
  var r = portraitSnap(ctx, id, x, y, size, true);
  if (r > 0) return r;
  var im = UI_IMGS["portrait_" + id];
  ctx.imageSmoothingEnabled = false;
  if ((ctx as any).webkitImageSmoothingEnabled !== undefined) (ctx as any).webkitImageSmoothingEnabled = false;
  if (im && im.complete && im.naturalWidth) {
    var nw = im.naturalWidth, nh = im.naturalHeight;
    var sw = Math.min(size, nw), sh = Math.min(size, nh);
    var sx = Math.round((nw - sw) / 2), sy = Math.max(0, Math.round((nh - sh) / 2) - 2);
    ctx.drawImage(im, sx, sy, sw, sh, x, y, sw, sh);
    return sw;
  }
  ctx.fillStyle = "#241838";
  ctx.fillRect(x, y, size, size);
  return size;
}
function uiReady(kind: string, n: number, w: number) {
  var c = 0;
  for (var k in UI_IMGS) {
    if (k.indexOf(kind) === 0 && UI_IMGS[k] && UI_IMGS[k].naturalWidth === w) c++;
  }
  return c >= n;
}

function rect(ctx: Ctx, x: number, y: number, w: number, h: number, col: string) {
  ctx.fillStyle = col;
  ctx.fillRect(Math.round(x), Math.round(y), w, h);
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
function makeLook(kind: number, _color?: string, _hat?: string) {
  var b = CHARS[kind] || CHARS[0];
  return { id: b.id, name: b.name, hood: b.hood, kind: kind };
}
function drawJumper(ctx: Ctx, x: number, y: number, lk: any, face: number, pose: string, blink: boolean, alive: boolean, sc?: number, fine?: boolean) {
  var s = sc || 1;
  var mt: any = fine && ctx.getTransform ? ctx.getTransform() : null;
  if (!mt || !(mt.a > 0) || !(mt.d > 0) || mt.b || mt.c) { mt = null; x = Math.round(x); y = Math.round(y); }
  var flip = face < 0;
  var spr = heroSprite(lk.id);
  if (spr) {
    var pn = !alive ? "ko" : pose === "idle" || !pose ? (blink ? "blink" : "idle") : pose;
    var PL = posesFor(lk.id);
    var fi = PL.indexOf(pn);
    if (fi < 0 && POSE_FALLBACK[pn]) fi = PL.indexOf(POSE_FALLBACK[pn]);
    if (fi < 0) fi = 0;
    var fw = (spr.naturalWidth || spr.width) / PL.length, fh = spr.naturalHeight || spr.height;
    var is64 = typeof HERO64 !== "undefined" && HERO64[lk.id];
    /* 64-px sheets: 1 art px = 0.5 game px, no stretch (cell may be 65 art tall). Feet at the hitbox bottom. */
    var dw = is64 ? fw * 0.5 * s : SPR_CW * s, dh = is64 ? fh * 0.5 * s : SPR_CH * s, cx = x + 6 * s, by = y + 16 * s;
    if (mt) {
      /* UI heroes (menu, shop, lobby, results): drawn on the DEVICE grid with a whole number of device px
         per art px (floor(scale x dpr)), anchor rounded to a device pixel - like the portraits. The fractional
         menu scale (~7.31) otherwise gives art pixels of mixed size (eaten / doubled pixels). */
      var gpa = dw / fw; /* game px per art px */
      /* whole device px per art px, rounded (not floored) so the hero is ~85-115% of its slot on any dpr */
      var k = Math.max(1, Math.round(mt.a * gpa));
      var dcx = Math.round(mt.a * cx + mt.e), dby = Math.round(mt.d * by + mt.f);
      var ax = Math.round((SPR_AX * s) / gpa);
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.imageSmoothingEnabled = false;
      if (flip) { ctx.translate(dcx, 0); ctx.scale(-1, 1); ctx.drawImage(spr, fi * fw, 0, fw, fh, -ax * k, dby - fh * k, fw * k, fh * k); }
      else ctx.drawImage(spr, fi * fw, 0, fw, fh, dcx - ax * k, dby - fh * k, fw * k, fh * k);
      ctx.restore();
      return;
    }
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    if (flip) { ctx.translate(cx, 0); ctx.scale(-1, 1); ctx.drawImage(spr, fi * fw, 0, fw, fh, -SPR_AX * s, by - dh, dw, dh); }
    else ctx.drawImage(spr, fi * fw, 0, fw, fh, cx - SPR_AX * s, by - dh, dw, dh);
    ctx.restore();
    return;
  }
}

/* ===== v0.57 visual helpers (Hopper Design) — integer base pixels ===== */
var LETTERBOX_MIX = 0.5;
var FIELD_OX = 0, FIELD_OY = 0, DEV_W = 0, DEV_H = 0, PHONE_INT = false;
var THREAT: any = null;
var HUD_PAL: any = { k: "#140c1c", S: "#f4f6fc", s: "#b8c0d4", m: "#6a7090", L: "#a4e8ff", B: "#3ca4ec", b: "#2a5cb4", g: "#ffcc40", G: "#cc7418",
  R: "#ff8f70", r: "#e8363c", d: "#a81e3a", W: "#ffffff", w: "#d6dbea", v: "#8a92b4", f: "#ff7418", F: "#ffd040" };
var HUD_ICONS: any = {
  shield: [".kkkkkkkk.", "kSSssssssk", "kSLLBBBbmk", "ksLBBgBbmk", "ksBBgggbmk", "ksBBBgbbmk", ".ksBBbbmk.", ".kssbbmmk.", "..kssmmk..", "...kkkk..."],
  magnet: ["kkkk..kkkk", "kSsk..kSsk", "kmmk..kmmk", "kRrk..kRdk", "kRrk..kRdk", "kRrkkkkrdk", "kRRrrrrrdk", ".kRrrrrdk.", "..kkkkkk..", ".........."],
  rocket: ["....kk....", "...kRrk...", "...kWwk...", "..kWBbwk..", "..kWbbvk..", "..kWwwvk..", ".kRkWvkRk.", ".kdkrdkdk.", "..kkFfkk..", "....ff...."],
  bigcoin: [".kkkkkkkk.", "kGggggggGk", "kgFgggggGk", "kgggkkggGk", "kggkFgkgGk", "kggkFgkgGk", "kgggkkggGk", "kGggggggGk", ".kGGGGGGk.", "..kkkkkk.."]
};
function drawHudIcon(ctx: Ctx, kind: string, x: number, y: number) {
  var ic = HUD_ICONS[kind]; if (!ic) return;
  for (var r = 0; r < ic.length; r++) for (var c = 0; c < ic[r].length; c++) { var ch = ic[r][c]; if (ch !== ".") rect(ctx, x + c, y + r, 1, 1, HUD_PAL[ch]); }
}
var BIGF: any = { 2: {}, 3: {} };
function bigGlyph(ch: string, k: number) {
  if (BIGF[k][ch]) return BIGF[k][ch];
  var g = FONT[ch];
  if (!g) return [];
  function P(r: number, c: number) { return r >= 0 && r < 7 && c >= 0 && c < 5 && !!(g[r] & (1 << (4 - c))) ? 1 : 0; }
  var W = 5 * k, H = 7 * k, out: number[][] = [];
  for (var y = 0; y < H; y++) { out.push([]); for (var x = 0; x < W; x++) out[y].push(0); }
  for (var r = 0; r < 7; r++) for (var c = 0; c < 5; c++) {
    var A = P(r - 1, c - 1), B = P(r - 1, c), C2 = P(r - 1, c + 1), D = P(r, c - 1), E = P(r, c), F = P(r, c + 1), G = P(r + 1, c - 1), Hh = P(r + 1, c), I = P(r + 1, c + 1);
    var e: number[];
    if (k === 2) {
      e = [(D === B && D !== Hh && B !== F) ? B : E, (B === F && B !== D && F !== Hh) ? F : E, (D === Hh && D !== B && Hh !== F) ? D : E, (Hh === F && Hh !== D && F !== B) ? F : E];
    } else {
      var c1 = D === B && D !== Hh && B !== F, c2 = B === F && B !== D && F !== Hh, c3 = D === Hh && D !== B && Hh !== F, c4 = Hh === F && Hh !== D && F !== B;
      e = [c1 ? D : E, ((c1 && E !== C2) || (c2 && E !== A)) ? B : E, c2 ? F : E,
           ((c1 && E !== G) || (c3 && E !== A)) ? D : E, E, ((c2 && E !== I) || (c4 && E !== C2)) ? F : E,
           c3 ? D : E, ((c3 && E !== I) || (c4 && E !== G)) ? Hh : E, c4 ? F : E];
    }
    for (var j = 0; j < k * k; j++) out[r * k + Math.floor(j / k)][c * k + (j % k)] = e[j];
  }
  BIGF[k][ch] = out; return out;
}
function bigWidth(s: string, k: number) {
  var n = drawableChars(s).length;
  return n ? n * 6 * k - k : 0;
}
function drawBig(ctx: Ctx, s: string, x: number, y: number, face: string, k: number, align: string, outline?: string, shadow?: string) {
  s = drawableChars(s);
  var w = bigWidth(s, k);
  var x0 = Math.round(align === "center" ? x - w / 2 : align === "right" ? x - w : x); y = Math.round(y);
  function pass(dx: number, dy: number, col: string) {
    ctx.fillStyle = col;
    var xx = x0;
    for (var i = 0; i < s.length; i++) {
      var m = bigGlyph(s[i], k);
      for (var r = 0; r < m.length; r++) for (var c = 0; c < m[r].length; c++) if (m[r][c]) ctx.fillRect(xx + c + dx, y + r + dy, 1, 1);
      xx += 6 * k;
    }
  }
  if (shadow) { pass(0, 2, shadow); pass(1, 2, shadow); pass(-1, 2, shadow); }
  if (outline) { pass(-1, 0, outline); pass(1, 0, outline); pass(0, -1, outline); pass(0, 1, outline); }
  pass(0, 0, face);
  return w;
}
function drawTextO(ctx: Ctx, s: string, x: number, y: number, col: string, align?: string, oc?: string) {
  var o = oc || "#1a1030";
  drawText(ctx, s, x - 1, y, o, TYPE.M, align); drawText(ctx, s, x + 1, y, o, TYPE.M, align);
  drawText(ctx, s, x, y - 1, o, TYPE.M, align); drawText(ctx, s, x, y + 1, o, TYPE.M, align);
  drawText(ctx, s, x, y, col, TYPE.M, align);
}
var BRK = { base: "#d46c98", dark: "#8a2e5e", light: "#f6b4d0", crack: "#4a1438" };
function brkSegs(w: number) {
  var n = Math.max(2, Math.round(w / 12)), avail = w - (n - 1), out: any[] = [], x = 0;
  for (var i = 0; i < n; i++) { var sw = Math.floor(avail / n) + (i < avail % n ? 1 : 0); out.push({ x: x, w: sw }); x += sw + 1; }
  return out;
}
function drawBrkSeg(ctx: Ctx, x: number, y: number, w: number, i: number) {
  var c = x + Math.floor(w * 0.5) - 1 + (i % 2);
  rect(ctx, x + 1, y, c - x - 1, 1, BRK.light); rect(ctx, c + 2, y, x + w - 1 - c - 2, 1, BRK.light);
  rect(ctx, x, y + 1, w, 3, BRK.base);
  rect(ctx, x, y + 1, 1, 3, BRK.dark); rect(ctx, x + w - 1, y + 1, 1, 3, BRK.dark);
  rect(ctx, x + 1, y + 4, w - 2, 1, BRK.dark);
  rect(ctx, c, y + 1, 1, 2, BRK.crack); rect(ctx, c + 1, y + 3, 1, 2, BRK.crack);
  if (w >= 9) rect(ctx, x + 2, y + 1, 1, 1, BRK.light);
}
function drawBreakPlat(ctx: Ctx, p: any, x: number, y: number, tk: number) {
  var segs = brkSegs(p.w), n = segs.length, i;
  if (p.broken) {
    if (!(p.breakT > 0)) return;
    var fr = p.breakT > 10 ? 0 : p.breakT > 5 ? 1 : 2;
    for (i = 0; i < n; i++) {
      var s = segs[i], side = (s.x + s.w / 2) < p.w / 2 ? -1 : 1;
      if (fr === 0) drawBrkSeg(ctx, x + s.x + side, y + 1, s.w, i);
      else if (fr === 1) { drawBrkSeg(ctx, x + s.x + side * 2, y + 4, s.w, i); }
      else { var hw = Math.max(2, Math.floor(s.w / 2) - 1);
        rect(ctx, x + s.x + side * 3, y + 9, hw, 3, BRK.base); rect(ctx, x + s.x + side * 3, y + 11, hw, 1, BRK.dark);
        rect(ctx, x + s.x + s.w - hw + side * 4, y + 11, hw, 3, BRK.dark); }
    }
    return;
  }
  rect(ctx, x + 1, y + 6, p.w - 1, 1, "rgba(0,0,0,0.28)");
  for (i = 0; i < n; i++) {
    var sg = segs[i], sag = (n >= 3 && i > 0 && i < n - 1) ? 1 : 0;
    drawBrkSeg(ctx, x + sg.x, y + sag, sg.w, i);
    if (i < n - 1) { var gx = x + sg.x + sg.w; var ph = ((tk + p.x * 7 + i * 13) % 48); if (ph < 24) rect(ctx, gx, y + 6 + (ph >> 2), 1, 1, BRK.dark); }
  }
}
function slimeAlert(m: any) {
  if (!THREAT || !m.alive) return false;
  var dy = THREAT.y - m.y;
  var dx = (THREAT.x + THREAT.w / 2) - (m.x + m.w / 2); if (dx > LW / 2) dx -= LW; if (dx < -LW / 2) dx += LW;
  return dy > -6 && dy <= 96 && Math.abs(dx) <= 28;
}
function drawWalkerAlert(ctx: Ctx, m: any, x: number, y: number, pal: string[], t: number) {
  var dbg: any = (typeof window !== "undefined") ? (window as any).__dbg : null;
  var at = dbg && dbg.alertT != null ? dbg.alertT : (m.alertT || 0);
  var ol = at < 16 && ((at >> 2) % 2 === 0) ? "#ff645e" : INK;
  rect(ctx, x + 2, y, 8, 1, ol); rect(ctx, x - 1, y + 3, 14, 5, ol); rect(ctx, x, y + 1, 12, 3, ol); rect(ctx, x - 2, y + 6, 16, 2, ol);
  rect(ctx, x + 3, y + 1, 6, 1, pal[0]); rect(ctx, x + 1, y + 2, 10, 2, pal[0]); rect(ctx, x, y + 3, 12, 4, pal[0]); rect(ctx, x - 1, y + 6, 14, 1, pal[0]);
  rect(ctx, x - 1, y + 7, 14, 1, pal[1]);
  var lk = THREAT && (THREAT.x + 6) > (m.x + m.w / 2) ? 1 : 0;
  rect(ctx, x + 2, y + 2, 2, 1, INK); rect(ctx, x + 4, y + 3, 1, 1, INK);
  rect(ctx, x + 8, y + 2, 2, 1, INK); rect(ctx, x + 7, y + 3, 1, 1, INK);
  rect(ctx, x + 2, y + 4, 2, 2, "#fff6e8"); rect(ctx, x + 8, y + 4, 2, 2, "#fff6e8");
  rect(ctx, x + 2 + lk, y + 5, 1, 1, INK); rect(ctx, x + 8 + lk, y + 5, 1, 1, INK);
  rect(ctx, x + 4, y + 6, 4, 1, INK); rect(ctx, x + 4, y + 7, 1, 1, "#fff6e8"); rect(ctx, x + 7, y + 7, 1, 1, "#fff6e8");
}
function ringPix(ctx: Ctx, cx: number, cy: number, r0: number, r1: number, col: string, frac?: number) {
  for (var dy = -r1; dy <= r1; dy++) for (var dx = -r1; dx <= r1; dx++) {
    var d = Math.sqrt(dx * dx + dy * dy); if (d > r1 + 0.5 || d <= r0 + 0.5) continue;
    if (frac != null) { var a = Math.atan2(dx, -dy); if (a < 0) a += Math.PI * 2; if (a / (Math.PI * 2) > frac) continue; }
    rect(ctx, cx + dx, cy + dy, 1, 1, col);
  }
}
/* v1.0 wave 1: 64 px art, generated by game/tools64/build_art64.py from /workspace/studio. Do not edit. */
var ART64: any = {"hero":{"pilot":"data:image/png;base64,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","ninja":"data:image/png;base64,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","robot":"data:image/png;base64,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","mage":"data:image/png;base64,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","knight":"data:image/png;base64,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","pirate":"data:image/png;base64,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"},"plat":{"bounce":{"src":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGAAAAATCAYAAABvLghXAAABH0lEQVR42mNkwANEeGT+M4wCisCbL08Y8ckzjQY+bQGhcMSIHSUFpf+f3vxiYGBgYHhRqTMaghQCifYreHMDI7bYGg142kUEeiSwYFV95TOijJpZiiH9L70bd5mGph6fWmqoJ9U9tFaPS+0LX3kGic0PcdcBo2X+wNQJjMiCkcc1Gfrbvo2GEo1AYRUXw3LL6yhFERNy4MMUjQLagcjjmgyRxzXhiZ4FV0yNAvoAptEgGNj6YDQCRnPAaASMAjqDvQteYXbEYILOCWJ4NcAANnXkqCfVbGq5h9r2EKsWWd2bL08YUfoBYunCo8mTxuDVzLcoEcCEbXxiFNAewMKcEVsXeTQn0Cf1o0QArrGKUUCblI+zFTRaHNEv8BkYGBgAyX+DtknZ7CMAAAAASUVORK5CYII=","w":96,"h":19,"land":2},"break":{"src":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGAAAAASCAYAAACkctvyAAABfElEQVR42u2ZIU/DUBDHf6+pLAaKGXUjICb6AZog+AATS/CwLPsC2AWxDENCgkIszZhGVFSQ4DAVyAkMYW5bEANVXwwNHWyMEG5tQ/+qyb27d+/+d/fSe4oETMOKKCCOaThS8bdWhCNdKIDxWSuy230ABieHAISTVwCM0vpcxWXyg1OXXrPG2ubv9H8qP7ry5u6TVf/jOAeNKrsXl0o3DSuy232CRnVG8bOhRUhbvmxd1vyP4+y4PqZhRXpSOH4c/klZtYIBvWaNycNQtHwl9+k4NvWuJ2J/a6dM7u+AVZEsDREC4uwpVcrkneB616MVDMTOokk7L+G4dPYn7XccWzShtKI1pFvVWt6cznt1iRKwytYgmTSL7EsklCbtvFTppnXRf0dQ5lpQ1g+fFhzX/0qA4/ozPwh5yNY8E3K9V2EajpQeT+ZMw4q8u0B84/vJM/8Z508vAOzf3Cp4H8bFBAAcb29QQDb48DGSVskFxXvAarDwPSApKCAffIA3Kq39AQNddl0AAAAASUVORK5CYII=","w":96,"h":18,"land":2},"bubble":{"src":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGAAAAARCAYAAAAi5qlcAAABz0lEQVR42u1ZsU7DMBA9W6kKVRekdkER6lAWBsTSoTtDJyYW/oPPYikzEhsLC0Jqpwh1KDAExIKsRESEoVzrunbixE5A4CdViq53z/bZdxdfCEjQafspOFjHy/uciDLqnF8tWBJn+nZtR1pb3RQA4OzpGRpUTfrxuXrO0lPZymx4ThlEG5U+6uXxqbjRTodHdyzUu/B7wJIYWBSSjQjotP205TXXJiIjFmV5gyMP/opumIqvQbO58D/T8XTmoztnjAY+EogoOJ3PlKehTCSIE9TlUtkVjZQijjKJIl3bBl1EAtYEkpd2TBxRZgFlYOKwn8J4b7EJVEw7VTimaqjSpa012F4Hz+fxVVonZGVy2Wk3cYjN6DHl0rE1iUCPjwAZUdHca8Nxqk0uw19HWir6csHPycN31TyCrJNU1yJ/M8oUeZbEsCzCAACDq/ulUnA3c7coi+gf9aB/0IVgGsLt8eHqJsyikGzv7gOfihyqQTANl887wyGwKCQUAOD14YY499SLx+tLstaKwFSEacilIPt4Oz9Z9Yi+2xGUF7S8JkxGA5iMBs5bFYLvBW2kHmxLsCT+83UB70C665Tpq/ykkostaWnu/08t6ToPmux7wBd2VuNivhMc1gAAAABJRU5ErkJggg==","w":96,"h":17,"land":1},"cloud":{"src":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGAAAAAVCAYAAAC5d+tKAAACX0lEQVR42u1ZT2vbMBR/CqlwHBNY8PqPUMjozTB22U7NoffBbvsApR+oH2BfYseeethxl17aU0dYGd3chhXiyDGGRTsEqZIjp5FiuW7xDwxBsfJ+7/ek954UBAXA93pU5/3R5BeCCkLXjyJ8aTwXR8viNEnj5+OL7/Wo7/Wog7s0IgmdzWbSE5GEP+IYm1OFQDAuDu5yflk/VE9EEj4vCAbGfqAiVkycjLTmuo7PPyfpX/TUAWCrXtcPMk3h9atdAADwsGuUjpo629LDrpT3huGVkdNxMgIyTaG/tQ8edulT1AVx9+kKz9BuYbi7v4H+1r5Ss6xeWgFYlh7E79otbEz+dnzNA5FdkYx80RDFGIZXxvxV/ou6iPx9r0fzgtBcJjBb4cwImaYAAJJgRWCSxhAEAxr+HEpjNoLAxNAttqv6cXd/I+nFUlQQDOjFxTf0aA1g4t+Or5fmcNNtq8qjLKCmudgkZ9u0o7KZVyMWBhzcpWWRE0nmbWubtmzayWKzsweTNF5oOpp5BZdM09IIlilEmbZUcHCXikFA67aUNVbfee0Whs3OntQMoHX64Br6cB1fak9RXsdTw24NYo0HrwFfz+dp6dO7+QuXfzakie/7euek78PFY0QY/YOPb5tr/c4qPFS2dfir5ptqwOaw3wyjBowJ5bW2kb2AYoGoKvLEqTJfkfOYUH5Q87D7UAO+nP2u84NldNqIB+D4cGcegOwR+uT0R62UxQAcHbyRrkUa2fuR48OdWilL+PxhWxKf1wBxwNYlWA1YEF95FVHFf6teqvjSDsh7oYY98QEA/gONoJuZfh5sigAAAABJRU5ErkJggg==","w":96,"h":21,"land":7},"grav":{"src":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGAAAAARCAYAAAAi5qlcAAAAv0lEQVR42mNkQAIiPDL/GUYBzcGbL08YYWym0cCnP0AOa0Z0AY9X50dDiIZgh5ghSk5ghAX+aMAPTESwwAT4nO+NhsoAAKbRIBhYwEKswolzdFH4+SmXaaJnIPQNpN7RHDCciyBSUsJIBfBWUJju2tHQoCNYdTl4tAgaFDkAuSNmKFI6GiJ0AOffdMM7YkzoYxOjgD4AFuZM2GJmFNA+9eNsBY1GAv0CH14HwMDoiCh9ix+MHDBaF9A38BkYGBgA3N5KDhgGYeIAAAAASUVORK5CYII=","w":96,"h":17,"land":1},"ice":{"src":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGAAAAAQCAYAAADpunr5AAABsklEQVR42u1YsUoDQRB9swmE4wRTiMHgJcFaSOmP+AliZ5tOC+1s7fINNrb+gXaitSZGIohFBI+QwqxFmGOz2b27GPYE3QcHR3b2Zua9ydzcEjRsrG1LeDjF++cL8b1QFzZ39jz5BUAt8kSJMKxLABh9DDxDjlFdjxDWIrw93hCxIq+jvmemQGxVm7MW5Hv+76LMN8eD6dzC5CvpTjhvkfUBnZ5Zv0pJ4iwSqc7Zp+ory5/JZ6Ukc8er5qn7XSVXAKn5dnoysQOAsZzFQfwPOLh/sgpgItQUjE6ELTHeywHl2ZNGgC0OfX8W+cvkahPBJIS6n+0udpvzU9Dki5KLDfnKCjhPUjb7tD15Cc8iRH2W7lO3+0keJv5s8bBNQAIBCRBPP0cP/UxSlxEjLYD/CD3/bruBgARE3opWK8VUNatW+18jW+0etsIbyymSMXQspzi8e04Wr69u/YjiCL2TfQBAHA+pzJ/GYViX3XYDrdNLz1ABiOMhLRxFqOp4uK3+hbMgVsSL4J78sBZh4SzIdFjEHwsebtqPsQXxO2EVBwEJ50kU4WMZPzzXm+zV31TyAeAbdmLSIzKXJ1gAAAAASUVORK5CYII=","w":96,"h":16,"land":1},"lava":{"src":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGAAAAARCAYAAAAi5qlcAAABwElEQVR42u1XzUrDQBCeJEtoICBC6EGiN6++gZd6yTFP4yuIPk2Pnrz3BXyAtlSQ1B8SUGJLPO12u53902w8uB8Ews7km9lvsjNsAAKyNO8+ty2Mohhk0Nn/G0z0AgDmUzXLgNpCTHwZicz2FxvuK5e+eUQ+jP8yP+/oe8CL/3ST+N95ABxfv8MoiqFqlgHJ0rzbVcoXYEhkad4FaTLuAABe7468IgOfAgAAQgdDcUuYsYUNxECMyVrYsHeT73T+1K7iUnHwNh6yWKZ7NdmnSe48CPahjfgmwWSbxISzjS/jlcUU1zFfWxFt9dgrwG5Kq/v//fTkYK0oVz/yxxIU/WXcVJyH6dmBbVLOGTcfQ5e7mA/GXZQro7x1ulDQzhPySdhWHAuuagHYegsbdF3GHQNBBdK1sz72ZMtlgtDFgNH1btuZ4SIXmof4TMr5r2OaFIreZdgQnq3XcBpHik/wP2NVvxn7V3VjtREbbte5yP3tuRftlrWhkL8W2+Li6tHZn6vixmyucqlfvpxw04sYEz9Nxp36BHj0hUW7hebjOTiYAfRoeLgVHx3CtCIe7sXntSa6Cnm4xV4L8qfAPUSNvwH8m+zlootjlwAAAABJRU5ErkJggg==","w":96,"h":17,"land":1},"move":{"src":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGAAAAASCAYAAACkctvyAAAA+klEQVR42mNkQAMiPDL/GUYBTcGbL08YYWym0eAYWMCILfU/P6QwGjI0ApJ2D1ByASNy4I8GPP0jgmW0zB9YwAJjIKd+w02NoyFDA3Derx53BIwC4gMPPYHikyMERltBZKZcYuQ6os0YOqLNRiOAmoGPnMLxyZFcB4wCwgBfAGOTq1h6arQIGgxFEd6OGLbOl3Sz02hoI4GntftQ+Mjhg08OnzmwfsBoDiAC4AtUShMrSh1w99a30dCmYSRgC18m2JgELEuMAtoDm5RXDAwMkPEglLEgeKy4Jo2GEg3Av93z4GyMwTj0SBgFtAM45wOQJUYB7QOfgYGBAQChsl2javWWbwAAAABJRU5ErkJggg==","w":96,"h":18,"land":1},"normal_aqua":{"src":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGAAAAASCAYAAACkctvyAAABH0lEQVR42u2ZsQrCMBCG/wRBUREHcXISxNFVwU0cfQLBXV/AxdHFF9Bd8AkcxU3Q1dm1YwaRKjrpdCVtrWIxrch9U0h6oXyXS0gr4KGQLd3BGEXZlqC2ZPnxIrzyu+oAADjers5D+WSKTYXkeLu6/C0KFVcViHKxej9dztDlM2ahJACAZPnRo7tOUKPZGgAANuspJqM5WzLAcNxzPC+eHcIAWL5BSL6OZC3xwgmImUSYoOV25+vrNOofx7yL+7eYlxXQ36+ciYMmDyOY8UOuAUAq2xK5dMY38E3RvxwT1TtQPzlWtiWUbQnfTXhWa/MSjWD1003YdQizfPN4HcugvYkxv/+7EkAlwUmIbvsBtK+h+jnAmCXwf4A+wJiXDwAPyq2DsRcfxFYAAAAASUVORK5CYII=","w":96,"h":18,"land":1},"normal_city":{"src":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGAAAAARCAYAAAAi5qlcAAABoElEQVR42u1YvU7DMBD+EhxVrVAXGBlYuqBKCHVmQOo78Bo8BTNDX4WtKgNzxIK6dOnACAtC/KhNYaguulxtxzFJuviTIiXx2Xf+7sc/ERiOD09+EdA4Xj9eInqPAx3tgwd6JH+M354DQw1jejTMM0ER+YH4/WRCKEF7AA92RS/D63MAwOXFIDDUIB6fFtsyJB0Q0A7Wm+J3zBtkY0D96HcTqFjjgID20Osku2sAAKgYSOdLjM5OS2sYZQt507Z2UB+OsrWG6yEdvU5itS2dL/H5s/LSpcv+q9GgVh4e0gX63aRYguhUNplluJtm+URcoFrKn/+URte+PnPhY7vqef9a4fb+Oz8HRPJ0djM+2BlMxUUFNmN5xLoaL+V1kyEZGXEuem3k8D4mOanb9K/MqevNNtD5dYQyGetimG8k2cbTOd/VDhcypIxJX1l0k8NlcJq4NMns0DWZZd7k+zqJdmCmifJ+9LhmU1W7quwGy2SlMyn6tQ7gN3Q2QqoYYOtjIrNKRtVFlosdvs7UgXMdybuJsElsHsbraN4Q0Dz5APAHrdLWD97VCm0AAAAASUVORK5CYII=","w":96,"h":17,"land":1},"normal_ice":{"src":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGAAAAARCAYAAAAi5qlcAAAB2UlEQVR42u2YP0vDQBjGn4Q0BrlDB8FFdHB2kw4uWlzqUPwA+gE6OugiCE4udZB+Bv0EDnWR6uIgro4OiotFB0mopS2tg9x5F+/aJG1ShHsg0Fzvzb35vX+OnAVBc2ShD6PU9R68Wuy3LcL324Ghk4HERLfCAWh+fRhCKWt+ZolXgsWi8fb5bMhMIAiOQTEZsXbvsJuVoxoAoFgqGDohdbo95XjOsSPZifOuLusAAOqS302Y3YRVyXuo5D2tA7oFo87/L8o5Nr/i6mxtmjNRceFP9AiFR6gEPwx3EFjxvySOjisrVePDEoK9W5R5SeCHWSoDwHRTf4id8aM4qYMx7kqL8txh9mJiqZJsWCCva7fqPQAAXk52sHh4gVbgAwD27ppS+bHgAOBzRBVLBQmMqu+ppNtzOt2e5LDKRnxZtl7OsbXreYRio7CqrVqd3ebWuhK8bj7z7+C+Jdl5hP5hZ7OvMr8d4PF4m0dK1fNaga+Er+qVo2Zc1N4cp/JE3+O0zKT9X6wIlrwA0KiWQV3y8x3ABqfc2T4ALO+f871gEGyj5GpUy/w4grcg6hLelwz47CTVFXUJnk53DZWUs18ZAPGEzigdseQWWUvQzXF0NlIeR5sqyB4+AHwD88QOwnkP1RwAAAAASUVORK5CYII=","w":96,"h":17,"land":1},"normal_jungle":{"src":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGAAAAARCAYAAAAi5qlcAAABgElEQVR42mNkQAMiPDL/GUYBzcCbL08YkflMo4FPX4AexozoEpveeo2GEg2Bn/A2lJzAiBwjo4FP30hAKYJGA59+ADmsWWCM+IKjDCwczAyWQXKjIUQjcHzdIwYGBgaGPz/+YkYAusQooD7AFr5Mg8Vxh5fdJ1sfJXrp7V50AK+EBWP5GRgYGBhsoxRRFDy5+hHOvn/xHZyNrg6fo7CpxaWHhYOZgYGBgWBRiC07w/Tj04tLHyF3IutF149LH0w9zD3Ifn2/+CNmEQTThOwBGW1+qsU2tkBn4WBG8cyfH3/hkUBIHy79+PTiMptYt6K7G1uCvX/xHdEJiRG9cyCaKoSi8fi6R0O2boAFDql+gOnDlfCQIwLdXEV9IYbHNz+iiFkGycFzw+vZ71B6xSgdMVjgj7QKGT0XUcM8jNYOVAwWAbCOGAuxtfVIa53QyzxGbGMUsAp5FFA3l6EXPyjNUPRRulFAu1yGHNYogT46GkofgBwBTLgkRgHtA5+BgYEBAPSizCuIRI58AAAAAElFTkSuQmCC","w":96,"h":17,"land":1},"normal_lava":{"src":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGAAAAARCAYAAAAi5qlcAAABEElEQVR42u2YuwrCMBiFT0IXoReQChXUWQdHX05w9QF8NQd11SIFXXqZWmidUlJbS1tJuvzfVHLnnOQklEHCNRcFCOW8E5+Jb05yjAsDgPl0VWRpjuBokiKK8fZJ5RRw11wUWZqTMpoQm1zEPf+uINRzO7ilCYYo3J0mAIDtekMKKSKMYtyffqWMLmENoodRDABwbKtWTwaMjNHFQdm58/VSa9MWW03tu0Rd33nG7jM0vnnXwYcsaCi/xmubR1efvji2Bce2EEZx47hcvEcfwau2AJFdxP+Iy/cRvEqt34nPmPwbYunNSCnFyOLXIkg+BYQe6BU0wu5vNKDpLiDUIP8NNbo6RWiIINkZQv3uB4APJ6qHJrcykNcAAAAASUVORK5CYII=","w":96,"h":17,"land":1},"normal_space":{"src":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGAAAAARCAYAAAAi5qlcAAABfklEQVR42u2YP2sCMRjGn5y62U2EgoUutxXRtrNLv0Whc8Ev0rGb0C/Qb9EObh2sIgWHG7zBQVSQuzo1ynWQXINJ7jy55IbmBwfHm7z587zJe7kQcNSqjQgW7aw2M8LeHStHsRAAOL+4jeh6jvuFbxUxwGv9Mt4FTq3aiOh6jvAnsMoYwm1343RP2Mvjl4fvesWqY4CzBcXLlQsAKDPj+8MzAKDZ6uwLSn/B2O6oYMsC89eFbKwmyKrR5+BNsDlJorEnqYyvo6qrm6Sxmu73cAx8+fXNnRhEVVSPFbNcqqQGgdX5z2x3FONRPz0AaULJGmFpK8vWS/OT9aPD59Q5JfmoNGy2OoKfkILCYIkwWMYrl89pqgmq7CY59fuU55zGo750HMwma9Nh51Fv2AMA+NMJ/OmkUDHZAsiLvBdIWnuyIDAfb9iLtV5tZoTw1xBuu2vPiJrhxbdXEQX9hB11DLXoYfDxJN4F8WlIFiWLnvSjDIBFH7z4Qgo6LLTo5xfXceEP6PpUhgAAAABJRU5ErkJggg==","w":96,"h":17,"land":1},"spring":{"src":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAARCAYAAADdRIy+AAAAlUlEQVR42mNkQAIiPDL/GcgAb748YYSxGZENel2XwsDAwMAg2jSHAZlPCMDUv/nyhJFRhEfmP7EaiTGYhYGBgYHh1j0GagEUL28x0SHLEJ8zVxBepnaksKBLHrhwiihDHAzMUAzCaeCyVVsoD0N0QMjr2FyG04VEev0/Lq/jNJBcrzPikyTH6yzoBpASy0SF4WgskwwAB9RKuPaJUBoAAAAASUVORK5CYII=","w":20,"h":17,"land":1},"spring_compressed":{"src":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAALCAYAAAB/Ca1DAAAAg0lEQVR42mNkQAIiPDL/GcgAb748YYSxGZENel2XwsDAwMAg2jSHAZlPCMDUv/nyhJFRhEfmP7EaiTGYhYGBgYHh1j0GagEUL28x0SHLEJ8zVxBepnaksKBLHrhwiihDHAzMUAzCaeCyVVsoD0N0QMjr2FyG04VEev0/Lq/jNJBcrwMABAIznwSCybsAAAAASUVORK5CYII=","w":20,"h":11,"land":1},"spring_extended":{"src":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAAmElEQVR42mNkQAIiPDL/GcgAb748YYSxGZENel2XwsDAwMAg2jSHAZlPCMDUv/nyhJFRhEfmP7EaiTGYhYGBgYHh1j0GagEUL28x0SHLEJ8zVxBepnaksKBLHrhwiihDHAzMUAzCaeCyVVsoD0N0QMjr2FyG04VEev0/Lq/jNJBcrzPikyTH6yzoBpASy0SF4Wgsj8YyYQAAwCNVADd6m/cAAAAASUVORK5CYII=","w":20,"h":20,"land":1}},"bg":{"city":{"L":{"aurora":{"src":"data:image/png;base64,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","x":0,"y":32,"w":160,"h":65,"m":2000},"clouds_big":{"src":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAKAAAAFaCAYAAACZsVbmAAADbUlEQVR42u3Zva3iQBSA0TEiowtCAkJqoAP6gDp4fdABLUCIBCFVQDwbWVo97Rpj8M+Mz4ltYeOPubYJAQAAAAAAAAAAclGkcqAxxvjWiRVFUWe/cjv6MU0pvtv52SjYqv3K7YRoBfxafE0sVjMRjjHAOqO17fhEOMIA647IrolwBAF2NVY/idDDSuYBDjU+K2O3JkO85xui2/mZ7LELsKeHChEKMDup/ngECH0GeD094vX0yGJ85XIeo1wBjTD+1tl/wcfDPYQQwnozT/oLK8+DxAJ0AfmXzl+s7reXpO+fdj9LL6MBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACA9hS+gnGIMcbKEIqieLVN1b5Nj2vq0ownvNv5+XK7qm2q9m0aoRVwBPE1iepdi9Ws0UooQPF9NcJ3x7QAxddpnL9DFGCmDxZDiq9qVHsIscp16vfxTlxK8fW5cgtQfL2uggJM/AKmToAIkHqup0fM7VwEaPz2ymuYhBwP9xBCCOvNPIvzEGAGFzB1/glJ0H57SfpecPez1B0AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACfKnwFeYsxxreCKIpOm5i6RPnHdzs/39qnywitgJmtaGU8TeIrLVazzlZKK2CC4VVFVXe7KnX2Kz/n0xCtgJmO0q4sVrOPIpy4vOL7xKfHJUDxdf6kbQQnFODQ4/vfg0vdsewhhFZGcd3XOUYwvd4bCpDWXE+Pl/eGRnCCFy0nVsAMxljKrIADczzcQwghrDfzLM5DgJlfwNR5DzhQ++0l6XvB3c9SWwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACMRtH2B8QY41sHVBRFnf3K7UjbtIv4budno2Cr9iu3E6IV8GvxNbFYzUQ4xgDrjNa24xPhCAOsOyK7JsIRBNjVWP0kQg8rmQc41PisjGmafPOeb4hu52eyxy7Anh4qRCjA7KT64xEg9Bng9fSI19Mji/GVy3mMcgU0wmjDy/+Cj4d7CCGE9Wae9ImW50FiAbqAtKn2C9r99pL0/dPuZ+llNAAAAAAAAAB04A/rpK4WpDO93QAAAABJRU5ErkJggg==","x":0,"y":0,"w":160,"h":346,"m":700},"clouds_small":{"src":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAKAAAAFaCAYAAACZsVbmAAAC8ElEQVR42u3dMW7iQBQG4BghIdHlAHRIdL5DDsEp6DkEPYW5Qg5AGc7gDsmdD0CHROWtrEUbQuzxbGLL31clxjNBb349TxrPywsAAGOTfPVBkV+rkAmX6TxRVoIDeB+88nxrPeFiNRNEwgJYhy8keI+CKIR8Z1L/sN3k0cJXz1PPCd8GMGb4IOgR/PF+idqx3tavHsE8Nb3/5XgqVYTfewQDAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADAU4kS0EaRX6sm9y3TeaNsTZWUtqErz7egcY9CqQPSKEBNQ1dbrGafxtXX7oOoA/JU2+A9G/fo2kSJ+cohK6LPeTyVAoj/ghmI7SavYs6326eJDggAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAECYpOmNRX6tQv/IMp0nSs0j0zbhK883FSOqyU+Er0v3ZOQBPGRF5853yAqVJnwP+PF+6dTB3tav9oCEdUD4tQ643eRR9267faoTogMCAAAAAAAAAAAAAAAAAAAAAAAAAPCXN5aOUOipBf/jvBcBHGnwQk4+WKxm0YMogCMLX4zDhharWbQQekf0CNQvm4910lV5vkV7gb0AjkRfj1nzCB6JrocN/SvW4UNTSzMOx1PZy+/lEQwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEBziRIMQ5Ffqyb3LdP5oNZ0ammHE7ryfAsa1+dQ6oA9D17T0NUWq9mncfW1PgZRB+yptsF7Ni50rp8wsdT9c8iK6HMeT6UAgj3gQGw3eRVzvt0+7eVa64AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA0l8SYpMivVejYZTpPLMN4TWOFrzzfVJPWJr8dvi7dk5EH8JAVnTvfISusgj1guI/3S6cO9rZ+tQfUAWFgHXC7yaPu3Xb7VCfUAQEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABgKP4AygvkI+g3SFoAAAAASUVORK5CYII=","x":0,"y":0,"w":160,"h":346,"m":700},"stars":{"src":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAKAAAAFaCAYAAACZsVbmAAABr0lEQVR42u3cwRGEIAwAQIb+C7QSv9zjfvdQ8QQk7JaQwYAhJCUAAAAAAIDllH0rogAAAAAAAAAAAAAAAAAAAMApD9QBAAAAAAAAAACgitY7AAAAIJiyb0XJ4ysLAQAAAAAAADCpme993VkDgC0VAAAAAADgNa48wPcwHQCAIQdVUQAAAAAAAAAAAAAAAAAAAAAAAAAAAACoZ84zd+WnFp9FiAwIAACAn0kAGQmAx7cJWwV3ZSEAAAAAAAAAAAAgIL2VAAAAAABwQjEdqxqAlhlZVp6f4UQAAAAA8anjAQAAAAAAAB25ogQAAAAACECxFwAAAAAABug9/N2QcgAAAAAAAIA4PAoDAFj3TJcFh6fiK874yAFkRQAAAAAA4A+9p0hFZToWAMQ4F4kCQ86AumKRAQEARxEEk7n/gv3ZIgMCADgyAQAAAAAAAMCruCgHgOqt0/ZJC8azAQAAAAAAAABwjQ4mAAAAACClMbVC9UkAAAAAAAAAAID4TORfiyn5AAAAAAAAAAC/dM8AYGcAAAAAAAAAjrlHpId8tPgsQmRAAAAAAAAAAKA5fQIAML0PtYnvT658bsUAAAAASUVORK5CYII=","x":0,"y":0,"w":160,"h":346,"m":700},"sun_moon":{"src":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAs0lEQVR42mNkQAP/v135z4AHMHLpMCLzWdA1/Xx3BZ9+FLWMXDqMLMRqRFf34s4FiCH/v135T0gzTLGEigGKOLuQDqYBR7dsZFDWkEfRwC6kg9WVL+5cYGBBtw2mGZuzsQEmBgoBhgvkzWIYSAlYFmKdiy1sSPICtrDB6gJc0YbLayzEugCX17AaALONmEBkhKVvYpMysjcVHDoQeQFXcsUVPiguQM9tD08twWmAgkMHih4AFslfdyiFq3QAAAAASUVORK5CYII=","x":139,"y":90,"w":16,"h":16,"m":700}},"far":"data:image/png;base64,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","farW":160,"farH":127,"farFill":"#372c70","farY0":219,"near":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAKAAAAB2CAYAAABPqJgfAAAJxElEQVR42u1dTWgbRxgdmyUHycEG2wqKbajAJVAsF5/SQw4luLS+hRZaSE49hBwMKb24UHpsC80lNJBD8KHkEEMCBd/S0GByyKE5GazQSwIKOEZEcqhEIh1MYHtQZjUaz+zO7M7O/ug9MMijlXbmm7ffz5vZ1RgJgaP1DZe+PnHz2hgBgJAYj/oFLBkBwDoBASBRAiIEA4ngaH3DnZmYR/gFkvGAH23XYD0AOSAwogQsFmbJXPk8LAjAAwIjSsBurwULAvYJuDi3huoXsEfAzz75AYQD0uMBnx/ch/gM2CUgLzqXpsuwHoAqOGs4Wt9wbWzgsHWeqAgMpaznO3z7ckzWBqiRgv0/rnV0W+cxASdoPffK5Rvk1uZVYRgWtYGQgBYBr1y+EXiQyjEM3F+ufwkSAsgB0wYaCk/f3oo1LJ64eW3s9O2t1IdfQghxCCHkxbO6sS988Oi61QGobAlLU1pAiZG3c4WdKyfLHmVxbs395uvLgcfdvbfppkW7XFm6RHaf3rF2rr//+S3Vc+XcvbeZWfLxbS+e1ckHH1ZS3/epySo5fPsy9nMgB4wR7U6NsFeUyTQCsJwD5gF+nq/dScfubZoDtTs1YT7Eeq2glIGNAKLxtTs1QhaWyczEvJuGHFg2B5km4K3Nq8oSUVomgiVaZWGZEEJI83VDq78zE/NusTDr/V8s9DcG0+XR+v5e6osPIQG/2r7lvf7zwhVCCCG724M135ULA0PJ2m0Pgorkqt/Behl6VaoQ0+TN+PS8TYZEJkCJ7Hmb9wQPC90x0zkS2Vg2V5nygJ9/+r3hb1wlT3YfkqnJqm+VzC9tHa1vuLokTPIOwjDeX3fMNCU4u7J6zMa5yQGbh82h/0szJel7QSjNlLQ/E5VsU5NVUt/fI1OTVdLu1MhBY+fYMXPl814777FZj3LQ2Bk6Nuhcoj7FkZI0D5tatj1GwDP//Ws9D2Ddtk5YjEIgnc+euHltTDUc0XEGe2u5Z1g687Hy5/yPlZ/rwaPrvp5RZ8xRbDsWx/Z6PpzNTMy7quGTdn736Z0hEsbRTx2ys33wC9czE/PuytKlTEQU3sZhxhuUA1qXYeKWPIoGE/diQR7CgHDQvVXXSg7IXhFPdh96ryshqrTSdFkoW9hAsTA7cncCFg1X6okWIaIiQpQvsMUF61mzsLz0PqS5zdeN1JK1WJglpelyKjZppGYprr6/R+r7e0LyZQ1pE4LT3EfPA1ZOvRt07tXAMeq2B0kf9f3+67Mrq0Lv92T3oW9oZsNv6WT/dfPNQBRnvQ4bPuix/PG6GwPSsqxnA+1OzVtl0U21/GzOzpHxECya0P6krXrEE4datXyQ5oDs4GxgcW7NTSqkUtInkYJ0ey2yOLcW23Y2J67J4jtsQvSlC+xJVO3UK9f7eV5sSb4uyaN+PsiZ0HE/P7hv3GMOEbD+yhkKq0HtKiRkJ5jdhClbK+TBrgTQIqS+vxd7ZWYaKuvp5y6+U0pvZO893qKvy4mu2UfygLJcTtQuamt3amRl6RIXWlf9vZ+qR2OOa75ueDmFaihmcxDWW6QlB/TzXH6hd/A58w8K0I04U5NV0u21PAchsrmVKrh52Bz6Mw1WPOYHWSzMen9GvVjANvrFuTWX9/ppLzD4focde5i0g/4lthmBVrMqj/iIS3guFmbJQWNHa6fKe2/kiiZ0arJKsvTcbJ0Nsirjandq2ishRteCbYrFpjxct9cy3u/KwnLqtUDTfaQ21J0X45sRbJDQZHilOVRlYdnLXU2lDWklYcWQksDai45Vd24cUbXEVkyyKiqMEG0aOkK0rJ0uS5kknumLjfY9bWvRrL0qC8vHUiWVuXBYclGyRSnXbYVgU0J0v6A5L81H/fJP/vihVRoDj68TeRNTJPTrq86Y2ePpJtnQMsyo4qCx09cYNSeWP56tfg8a0S9GnmimvB9f1XZ71dBjFo09MgF3t8uhvWBWdq2wMPVzE3QVgBJalN6wdv3xj++8179++7tSeiN7T/ZdonPTbfomf2Yj7N5KR5T3BbXp5H0yg8kmRXRnnjCEvClHDsNUiAbMgBeicxmC2fVGkdIuG7zN5bswpKb9i7oWnKZcXWUukAOmBGHzu6zv0M4NAUvT5cAlI/7OuwGqsXpLWRrD5mqq6Y3sPdl3xbkBoSspwtqdIHsPMJbFH50REURH9vCTIMIKqnF5pTh1QBNj5EVtXSnKESX/bAGgK0TbqoJ5kTPserHsc+ykUwy2PA22T/GEKBZmM6EE0Fxa1H/ZWEXj9bO7ypzk5hG9ef3dEnbC83hHXuYIGCR4dnst0u21hq5gtl00ifjRxXiKKJnNH285XrvDhlw+DGcVNG14vOVINca/Lv40ZDhd/UoHujd2+e1i1k2JbKzZi2z4xdbPQ+kcPYb2ny52OKK8T6WKiipEhzE+W1nFqevJvpvNheKqmNNQ0MnGyh9vInLgZxqARJE7IZq/otkVBtbD0/Y4tjhlYXkvjj6ytuejqWxnTy5XQvxCpYhscYdRnZu9/NKeMCmRjb2afvbj3+PnxhHla6JOV069C5XcmjS+TlIcVWSN8vks6YAmq94wNhY+mkNWRORJKvAjWX/Mx3dbix410e21hNV1VsBXq9QmssdqeO0n5U5E1c6ZLkL8dD2VK5YNydABzc2HKOz62TeWZ8Mkib4ArfckgihhN+syjImxiAjGy2m8DkjnaDwNSWyUsM8bzcbjJ2R3/Gct/Pr1WeWpBlFxTIiO+mgOEXR/Z4SSjy96RPKJypUYRmaRGT8s8UyuXpgW9nVJONwWffOs8RxQtlab5INxbIfJUdUBw8xBrnRAOshzF98JvR57EcgEa1MXYd5lmKAowzsc+v7KhcFnUiFE63rGMPeeysiF6jeealj2cCiRvZUI6CdQhyVY1E0OusSTyTC84fopRDXwO1Taw47VprCvOya2XbapVWZv0WrUuCr50gJV75cneSRvyP1dcbLQSi8mWsmJchfd3C1PYVxXCxXZilUp6KpJ/ZUjVSjGR418qILt91Fm+6Ed0X45R5rCcNBVqqL7lU42jAmted2QGhUqT61QroJ1CoMsXP398bS0J2WU8koVG/gVH/WemuNy8mq8Y7cPBij4KFrM2jvI5tTe43m5MunVJ9uRYTMMZekh5UmEclaOyZwH1BGi6ZUZ56oHoGZX2VzgpiQgUYCAAAgIgIAAAAICICAAgIAACAgAICAAAgIACAiAgAAAAgIgIACAgAAICAAgIAACAgAICICAAAACAiAgAICAAAgIACAgAAICAAgIgIAAAAICICAAgIAACAgAICAAAgIgIACAgAAICAAgIAACAgAICIwI/gegeLoFyHDH5QAAAABJRU5ErkJggg==","nearW":160,"nearH":118,"nearFill":"#241b49","nearY0":228,"floor":"data:image/png;base64,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","floorW":160,"floorH":90,"floorFill":"#51416e","floorRow":23},"jungle":{"L":{"clouds_big":{"src":"data:image/png;base64,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","x":0,"y":0,"w":160,"h":346,"m":700},"clouds_small":{"src":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAKAAAAFaCAYAAACZsVbmAAAD/ElEQVR42u3Yv2ucdRwH8M+VaEwwIjfEQUHjEBEaxcXRTLVLxcG6FAIlW9JMQuoQcZEsDTjlxxYtQZd2KXSJk9E/QDABIVLOYEvpDVkilx4UHody4e5yP55c75rmntcLDu7u+XF3z/Pm8/l8LwIAAAAAAAAAAAAAAAAAzopcP/+48en5pN0+u+tLOTEQwJ6Eb3ttNtW+g4NjQnhKBrJQ5dKcQyUUwJ5WuXpb+wctgyyQAti1KlcftnrLi1MxmR+peW8iIhFEM2BN+Kqr3cTMarSqfu1C18hkfuTouLmFDdUwywHspL12Ero05hY2hDDrM+D9x4c1r++Vnpzo+JXNnZrX1y6ed/cFsLVLN25HRMTd65fjrVeGYuHX7WP7fPrBO8eCVh+u+vCdtPqR4RnwwndLyYcfv9dw298P/3su3+HO1Svab1YDWAnhXqF4Kp9t9gMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAOpdzCWqNT88nrbbvri+5Zl004BLU2l6bbbl9IiIRwu455xKkr34n3Q8VsK1yuZBcunE7IiL2CsW2+3/19WcREfG9SiiA3ap4d69fbrvv1v5Bw+OFUAtGBTxbc13aqtWo6r372usREbG8OBUREXMRHZ+fPg9guVxImq1kWx13//Fh3Cs9SfUZlSBO5keslLXg9uHrherwVUJppZxOLuvBa9RmOwnfrQePIiJidGj4aWte2NCOsxbA8en5pNkfyZWgFQ9L8eWbb3QlfBXFw1LD92/+9HvsFYpCmOVFSHV1QgB77od//j16/upLL58okKNDw7GyudPy/Ncunk/9XdL8sa0F95n64f/9Tz461e/z129/aMFZWgW/aDdb+DJWAdtVROEDAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAPpHrp9+zPj0fNLo/d31pZxbLYA9VS4XkmbbBgfHBPAFda7fw1fZ/svDPxO3WwC73nKbtd1qW/sHLVs0p2fgrM53lblue222YeAm8yNHwWt2HrOhAKZWHbSJmdWm1awSukbhq3h7bPTpOcuFxHxoEfLMM167wFWbzI/UvJ6YWVUJzYDN226a8J3ErQePah5mQwHs2Nb+wdGjU99+84UQmgGfvbW2UzwsHT0fHRo+9h4C2NDcwkYsL07FyuaOu2URcjo+//HnnrfHO1evWIgIYOsFSa/ObRUMAAAAAAAAAAAAAAAAAAAAAAAAAGTZ/+vzW8uDqmdKAAAAAElFTkSuQmCC","x":0,"y":0,"w":160,"h":346,"m":700},"sun_moon":{"src":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYAAADgdz34AAACDElEQVR42q2Wv27aUBTGf1AUJMxwXaZEbTLWiBe4T2Cp6hrRN2AkLlO3iBdIKWOkPEBp1ix+Ai8dq7K2zZ8psYcYYVBEF1/LvvFNoOFIVxdb9ved7/M59wBrRhCNnLL9RZEDcw27s03wvmF3XwLeB+i6+6uytQ5JpQxcCm8aRKP+SffkK8Dxl4+lLw8/fQNg4v+pBNHIlcLznyTQwQ97kk77gIZlF16axSENy2YWh/z89Zvz08BIUjOBq6x18Py9hmXTaQM9AFZSeI9Iak+Bq9ipW4XrRRJnSgA67QMjSRUgBXel8MZ6pgq8Xreype41LDtTs7fbUk70pfB8VSivVBVI4fldd3+VtyYPXvC1tgPAw8MSgOVyzny+4O27Fmefv78/+zEMpfAugmjkVFN7fFVym0ReiS2amQopvHGa9LRaZo/+YZMkJkl9V9fP9FFmU6mCWRwyi0Oiu0uiu0sj0SKJs2fzsZEC8frNowwXOZKGZRNG94TR/WYKVIUskrgAqH7rpQpwfXNrVOBI4Y0Hk8GRan9dtk5UZk1ZR5f2gZJ8dfU3A9KXHip7vQ/0syjrh/7xBwBs0SytlLzn1ze3nJ8GDCaDo9QeRwpvajpNM5LDnmRvt4UtmgVAPXMTeOGwy5WYn5JUgBWAUqPHeHgBYAR/rlmySWYaONpkc/5nsq01Lrc9m7c3+Lfxl+Uf9z3sRb8QTp8AAAAASUVORK5CYII=","x":131,"y":65,"w":24,"h":24,"m":700}},"far":"data:image/png;base64,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","farW":160,"farH":102,"farFill":"#295e70","farY0":244,"near":"data:image/png;base64,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","nearW":160,"nearH":99,"nearFill":"#1a3541","nearY0":247,"floor":"data:image/png;base64,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","floorW":160,"floorH":67,"floorFill":"#3a1d29","floorRow":0},"ice":{"L":{"aurora":{"src":"data:image/png;base64,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","x":0,"y":45,"w":160,"h":38,"m":700},"clouds_big":{"src":"data:image/png;base64,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","x":0,"y":0,"w":160,"h":346,"m":700},"clouds_small":{"src":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAKAAAAFaCAYAAACZsVbmAAAEcUlEQVR42u3ZPUtkVxwH4P91xlmVVcQgROwkxZJtEggkZLFMsV/AJq1FyhRpg9jnI9imiGC9ECGNyO5CCiHJkspkIaIgilnfwrzdFJPRO+PMODpqdp3ngcVx773nDnN//s45GgEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABA/0h8BP3r2VYpjYgYK5zH4MlkPhFAbl25UknbHcvncneWiwGPQviare+WUw3InQcvIuLl/vkpz1+X45tPhm41IxoQmxBur+Wy67lWDbi6U23YhGT9+HsxIiK+/fzBra0RBbAPpth8Lpe0O9YpgJ9OJLe+Scl7bPd/fdd8LLvOaxe+y+61ulONp9ODPQdRA77jFtZO0uYp8tVRLWCHxYg//66e/f/EcNJV8GZGa1839hozPf2wds3kg/NjK+vHsTQ3fu0cacB76LAYLUPXrY29ND567/Lr9k97/22NAN4DqzvVK53/YrPU8fhnM4MX2i8i4pfd6o2/d1PwPZmG7/qeW9u1mu1l+hVAQbyWxdkRu2BaB2N++SD1SQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA74bkpgcsVyppu2P5XC7xkZM1cFfhg1ttwG7C98MflbPXX35Q0IbcTAN2E77VnWpMDCcxMSx3ZJZl1w1ZfT3XLnyrO9WW44wVkhjLlF/2emtEU3DPAXy535jHN8W0IXwREc9flyMi4uuPB21SBPBmNhbNwesUwIiI0cL5OR8+TBrGeTKZF0QBvDx8rabZesiywWsVwMsIYZ+vARfWTtLdUi1Ek4PJWcO1Cla7xms2M3r+evOw8xtbWDtJF2dHhLCfNyE//VWN7YNqxwEeT+Uavl9ZP2577kpEPJoZ6uqNbW0XPZ0+0PbXMNdpn07hu6qluXHtZxNSM798cKd/4RA+AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADgrbCwdpKWK5UL/+aXD1KfTv9I/o+bliuVtiFb3alGRMTT6cHE47n/Bt6m8LU7/6rXoAEbwpbP5ZJOAay3XrMv3r/485EdCw3YVdN1M+V269lWSRveI/m7mmKv0nytzhkrJC3H2i2lMTWU14qm4O5Clg1SKzOjta8be+2Lrj4172bKUAhNwV15U+x9Bt0tpQ3h+/7Xcnz38z+m5n5uwHr7vTqq5WDr6PI8NG8y6m25f9p47cTwxbeZbdJ6qFfWj2NpblwT9uMa8KuVw4iImJ4qxOjwxWJ9PJU7e/1is/Rf0C7evlXYVtaPY3qqcPZ98/iHp1VP0hTcGIjmUPy2XbmRsbPha3Uf+ngTEhHR/Ke0enNtbRcjIuLRzFBPzVUfp5mpVwC7srB2kja3WLcWZ0eEzBrwZqZoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAOjNvwrorthR0B51AAAAAElFTkSuQmCC","x":0,"y":0,"w":160,"h":346,"m":700},"snow":{"src":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAKAAAAFaCAYAAACZsVbmAAADwUlEQVR42u3dvU7rMBQA4Cap1IGBneFKTAy8CI/Bo/WlOjBV4g0YGCqR5g4ICFVLf5Lajv19S0XLAOnR8XFsn8xmAAAAMHXLVdstV2137Pdql4qYBCCQ7zDsKpBM3bfvs8pl4xrZ7vmxqU75TA3I6PoBtvvz7mcQtQaUAYk6ARGAQNlZEAAAAAAAACBV7WbbtZuttc8z2Q0DAFCeJA6IrN9/Ni6+vH2+Pt05vGISAqUF4MOtL6Uk8xT+iK9hFxkQAAAAAAAAAAAAAAAAAAAAAIBMadbNqUZvAtlvNnl/o8kkfxu1O9Zu5usHI1w1AA8Nu4ZjggRgs6irZlFX+953mTnkah1S1X+YBQMAKI32MVEoRKoLBB7TUGDmS2mBQAAWOuymMhwLwMylvkAw9xXFy0oxgsACAbN2s+1iDIEWCAAAAKBosW5JkAYrIQAAAAAAAAAAAAAAAADAQKUcV/3uD9hv2/ry9vn6dKeXHIECkLSU8oizvQfTH24FAIEz4NewC9EzIAAAAAAAAACTNtktP/Yv5sFmBATgUPYvTtdkd0TbvygDAgAAAADHLVdtt1y1UfvPuA/ITAAC5Q7DrgLJ1H2hA9L+uYKz3fPjz/7Jvz5TAzK63QDr/xwq+LLJgHZHD8uKIQNOBiSpCUh2AWh39LRk0SPa7ujL60ArISQ1GQEAAAAAAEjPVB9wbSkOAAAAAAAAAAAAoHBDN8LakAoAcN16K0VqQACA8upJNSAAAAAAAAAAAAAAAECmcjwQTRocSiKqyiVIz/q9/R5tXt4+X5/umiy/KxkQAchhD7d5/39zX3F6vobdEkwqAGPWRu1m2zWLWs0sA8YJ/NePbrZ+b7v7m+sHfK4TjqxqwFC10e79z34WprAMGLo2OnTz3XAsAwbRLOpqX6AJPoLXgIZeorIWDgAAAABwGUtKhUh1m7+1YAQgYaW0zd+G1EKkus1fBgQAKI/7gJGV1IbDJAQByGFTbsNx6ZEF9wEjy6ENx5CD+zIgo2a+c08PmoQwOPheP37H3L95dfLZaRmQi41xcF8NyGhCNG6CUWfBAEAUoxeNpa9tch63Ycg3AHN/xADDjX4fsKRHDGAIBgAAAAAAAAAAABJpzeEcSblsSEUA9jlHUpYkesM4RyIDAgAAAAAAAAAAAAAAAAAAAJdqN9vOVbgOHaiO6Hfuur/RsWtsWnOckfn6wYgAjDLsGo4FYBDNoq6aRV3te9/VGc/cJTiN+g+zYAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIDU/QdV247MCMB5mwAAAABJRU5ErkJggg==","x":0,"y":0,"w":160,"h":346,"m":700}},"far":"data:image/png;base64,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","farW":160,"farH":98,"farFill":"#437ed3","farY0":248,"near":"data:image/png;base64,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","nearW":160,"nearH":90,"nearFill":"#71a0cf","nearY0":256,"floor":"data:image/png;base64,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","floorW":160,"floorH":66,"floorFill":"#315f82","floorRow":-1},"lava":{"L":{"clouds_big":{"src":"data:image/png;base64,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","x":0,"y":0,"w":160,"h":346,"m":700},"clouds_small":{"src":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAKAAAAFaCAYAAACZsVbmAAAEuElEQVR42u3dv2uUdxzA8U+q4A2h4XJQxwROJUHoEOwUOlWwBYdOOvgH1KGlgtBF6FBwEQRLHdqpUwY3hw4Vkqk4NMgVCkZjEniOkiHS54Jygcsg6aB33O+7JHcp5l6vKX7vueeJPm++n3vikAgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAN4fY0d9wTeFR3vt1k/MXRpzOwT4v8QnRAEeWXjp4+cdj8vNz4hQgMOJr1t47Xz0zbciFODhR+x+w2veDY3m4+2Do/x810smm4k0KUealGNnJRn4+TmmAQ4rjvoIXyw8iWc3b4vQCO4c3s5KEpXtSstxaVJ+O1anxzueq3pMz9H87hw+I45wgM3hVT/nZbKZiIiWCIuFNCIipuZyBw6vk9m7t4Q4igE2f0Zrt/M1B1a/A3YLr1zajfHJUy3rGxuvIiIin59oWLv88I4I31Mn9/uG+59e33ux8ORAFysW0rZh1YfX7uuIiK26wKshRkQsrhXdxVEKMCLil9//bln76vOPIyJiafmf2tp07sOIiDj9bjQ3x1O/k3UK7nQ2EwvLq22/j4tnp9zBURzBN85fbXkaPTOZ7fm+9dJ2QzRJ+rrlmGq09a+tl7Y7nvPe0wfG76g+BfcT5qAIDQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADozq9AHaA3hUd9/braE3OX/LsLcHjxpY+fdzwuNz8jQgEOL8Bu8dVH+GLhSUREnLt2YaRjFOAAx+3OShIREZXtSs/3p0m5FuAoj2cBHiK8nZWkFlualCM3Pd7XOarxteyM0+OxvLQZlx/eGZn7clJSB48vIiKTzbxd6BBVvWIhjYiI8clTXY97dvN27Tqzd28d6xjtgId4uKjFFxGrS5sxNZfreJ7lpc3a1/n8xL6+h+McoQB7ePnTjz1/tFLd2arqd7iNjVdd33u6LuJOFpZX497TB8fyXhnBXfz25Xd7B3lfubTbc8z2stXHg4wAj7nFtWIsrhVb1i+enRpIQEn6OpL0dcv6emnbUzCtbpy/undU1zquIxcAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADgPTU2qn/xN4VHe/0cd2Lu0phMBDj08NLHzxv+nJufEaEAhxdgc3DtiFCAR7Lb9bK8tBkREV98/5nxPGAnxdddmpQjn59Qih3wYPHtrCS19cp2Zd/xtYzl6fGG12bv3rILCrB1x6sPrz6+NCnXIuoVXrm0GxER45Onaq+1Wzt37YKRPMoBdtrxmm3+9W/DTpbJZhriLBbStsFtbVdqY7hdgPXKpd345NcfhDgqAd7/9PrelSuzkZuf6bjrtRup1ZAiIqbmcg0Bbu1jVOfzEw3nioj4c/1lfP3HzyIcpYeQfh4umkOphrb17in3IJrPubC8Gmcms8oapRF84/zVrv+rcfHs1ECvt7hW7Pr6vacP7H6j/BTcb5iHITIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABg+P4D9mHEU0FmvQEAAAAASUVORK5CYII=","x":0,"y":0,"w":160,"h":346,"m":700},"embers":{"src":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAKAAAAFaCAYAAACZsVbmAAADF0lEQVR42u3dP04qURQH4ANSkFjSuQRLt0BMZgNsAGsbtmI9bsDaZBL3AB0LeAU7mIQG7it8zPPFaMS8Ga7M91XiNPfP4XdmcglEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwE+yK4tkFfIxtASc0qhPk92vFikm09iVkSIiLu6qgRI4rV5swK4s0uDm+vXFZBoREenlobmuELXg1qXlOtJy/a74kIAneQCRehKwc4qOrFIQALQ+PIRA9zo5CXEC8f2Oce5rNWx7EferRdN6B7f3zf+1ZDppwU4g+Ewn8e4E4shbll/PzXqd+5l1Jw8hiu7rb9SPbk221ZUWrBBPtz6XT4/WjjzSUAICAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAPAtu7JIOY+trfHlPO82jJT6cerZPG0r63DWBbhfLVJMprErI0VEXNxVg3xSeRPb6irGxSbqmKfLp8fBuc+7TcPcWtt+tWha0OD2vvWW9x3jYtPLefciAdNy/WcTppFeHrIa2yGR6tk8RUT8z/TLed5tyjLi377r+9CG+jzvYY6D6lPRmfcPSAPzBgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAICv2JVF2pVFynV8I1t0vurZPG2rvMc4tE3nm3zjYhMREeNiE/VsnhQgnTsUIZysDeeafgAAAAAAAAAAAAAAAAAAAAAAAAAAABwl958d4Di+pBwFSH/9qB+q2f96Tn9bcTR/X9xVA1upAFu97/vo2ra6sotacLs+S7jLp0fph6dgPIQAAAAAAAAAeXLG3D1nwZzUyBK82q8WKSbT5oOuPuTajd4v8q4s0uDm+vXFZBoREenlobmuELXg1qXlOtJy/a74kIAneQCRehKwc4qOrFIQAADo8EbczThd+ecorp7N07ayKHRn+Db5xsUmIiLGxSbq2VwK0l0BHhyKEE6ins2T9AMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA+NRv5u4vx9AOWJYAAAAASUVORK5CYII=","x":0,"y":0,"w":160,"h":346,"m":700},"sun_moon":{"src":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABYAAAAWCAYAAADEtGw7AAABxUlEQVR42rWVv2rCUBTGvxtCKg6lhDyCg4oglG6dxCUOhQw+hJOFzo7OBTvlIRyEDrpIp26lIBR18BFCEIeiIp4unnjv7Y2mLT0QkpuE3/nOn3sucMZo0Cqa7n8yCean3FOdiBNQXwThqF3xyPS91202RBCOaNAqiiCcZwLToOXfd/pDAOje3Rgdd57fAABPH5EwwUUatF4qo1bIw9EEbyMBxyNsI4GXxSfGs6kRbpugrNIxZIHfOR6hhjyAMoApiSBU4HYaNAnpSg2KlpQoB4BawQy3uLoiCEe6MoaKS/t4Hd45HiXqq25OLvgcACz20K54JKdAhioRSHDZ6qUy7jv9IbeiJYJwzoufmKzcda1ENbegpadBLxitdqDVTlmf2VS+CML5N8XbSGAbCWwWwGZxwsGSkn+VSLIovigYFC1JKXAc7xHH+2yKueK0JAXEz3rLAcAkXquKedHrNhu8TfXwdAemFOg70Jb7uF3xjmHFgOtamTqE1fLgUmaF3M8Pt9cA0sFyTifxGuPZNJl2xiEkw+ulMqpuDq5rKSBdqQmaNt0SOACwet0eX9+VuZx1Hhe5W3gu63YolG+C/tux9BsnmQ/ULyoEYRPlam0+AAAAAElFTkSuQmCC","x":132,"y":66,"w":22,"h":22,"m":700}},"far":"data:image/png;base64,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","farW":160,"farH":108,"farFill":"#782957","farY0":238,"near":"data:image/png;base64,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","nearW":160,"nearH":108,"nearFill":"#491e44","nearY0":238,"floor":"data:image/png;base64,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","floorW":160,"floorH":67,"floorFill":"#341530","floorRow":0},"aqua":{"L":{"bubbles":{"src":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAKAAAAFaCAYAAACZsVbmAAACVklEQVR42u3dsa6CMBQG4MpzMPgYvv/kIzg6OBrToenaO5EQY+K9F+EAft+i8+EPLW05pAQAAAAAAAAAAAAAAAAAANuSa2mqQIjz7drGvxAWQgAAAAAA2I1cS7MATohx8KJC2LkMQOhd0BAMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMwj1+IrScQYPtHlU12EhxAAAAAAAHbpoASfNeytXh73lFJKp/6oxizj1baWrS7CwieE73VKgAAigICHkK9jiWDmEFqGAQAAAAAA+FaLbhPlWpqTwoR43iO1SU9KjmMhgJgDBgzD5oAAAAAAAAAAAAAAAAAAAAAwk1xL20tvHa05NmjoMAYAAACsVa5FW2ZiDOuWeoMTHkIAAAAAAAAAANYq19KccyPE+HiRo0aEhU8I/8+L6WAIhgkhFD4AAAAAAFipgxLEybW0oeH4qT+6FiznefvuW7fznIZBADEHJHgYNgcEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAYE65lna+XZtKsLhx8IRwmzolgIl3QXc/AGAlKwOqQOjKgHkx4SEEAFjbU5p5CikFbcVdHneVBwAAAAAAAAAAVmbq0TqdEZjE0ToAAFjJk6EXrwjxHDohJCx8QviedUAEEDAHDHFQgnlDeOqPagwAAAAAAAAAAAAAAAAAAPBXWpcxCOkNo7E1AAAAAAAAAAAAAAAAAAAAAADADulyRphx8KaEsFNKYLN3QUMwAADMKNfSci0m3cQ88b36D4uGTwg/y0I0GILhlyEUPgA+4weGKVQskcpU9AAAAABJRU5ErkJggg==","x":0,"y":0,"w":160,"h":346,"m":700},"sunbeams":{"src":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIgAAAFaCAYAAADFOxXCAAAD3UlEQVR42u3VsQ0AIAzEwJ+O/UtGSJkR6BkAiejSUNuynuyulST3+/vhIhPXCy4ScZGJi0RcZOISCS7fjDgsiEgsCIkWhExcJOIiExeZuHwzuCwILgsiDgtCpgUh0YKQiYtEXGTiIhOXbwaXBcFlQcRhQci0ICRaEDJxkYiLTFxk4vLN4LIgIrEg4rAgZFoQEnGRiYtMXCTiIhOXBcFlQURiQcRhQci0ICTiIhMXmbhIxGVBcFkQXBZEJBZEHBaETAtCIi4ycZGJi0RcFgSXBRGHBRGJBSHRgpApEjJxkYiLTFwk4rIguCyIOCyISCwIiRaETFxk4iIRF5m4SMRlQXBZEHFYEJFYEBItCJm4yMRFIi4ycVkQXBYElwURhwUhUyRk+mZIxEUmLhJxkYnLguCyILgsiDgsCJkiIdM3QyIuMnGRiItMXBYElwURiQURhwUhUyRk4iIRF5m4SMRFJi4LgsuCiEQkZPpmSLQgZOIiEReZuEjEZUFwWRBcFkQkIiHTN0OiBSETF4m4yMRFIi4LgsuC4LIgIhEJmb4ZEi0ImbhIxEUmLhJxWRBcIhGJb0YcFoRMC0IiLjJxkYiLTFwk4rIguEQiEt+MOCwImRaERFxk4iIRF5m4LAguC4JLJCLxzYjDgpBpQUjERSYuEnGRiUskuHwz4rAgIrEgJFoQMi0IibjIxEUiLjJxiQSXb0YcFkQkFoREC0KmBSERF5m4SMRFJi6R4PLNiMOCiMSCkGhByMRFIi4ycZGJi0RcFgSXBRGHBSHTgojDgpBpQcSBi0wLQiYuC4LLguCyIOKwICKxIOKwICIRiTjEQaZIyMQlDlwWBJcFEYcFEYkFEYcFEYkFIVMkJIqDTFwWBJcFwWVBxGFBRGJBxCEOkYiEzKlcJOKyILhIxGVBRGJBcFkQkThxWBAyLQiZuEjERSYuEnGJBJc4cDmROJGIhERxkImLRFxk4iIRl0hwiUMcTiSOTJGQKA4ycZGIi0xcJOISCS5xiMOJxJEpEhLFQSYuEnGRiYtEXCLB5UTixCEOMkVCIi4ycZGIi0xc4sAlElxOJE4c4iBTJCTiIhMXibjIxCUOXCIRiROJI1EcZIqERFxk4iIRF5m4RIJLHOJwIhEJieIgUyQk4iITF4m4RIJLJLjEIQ4nEpGQKA4ycZGIi0xcJOISCS6R4HLicCIRCYniIBMXibjIxEUmLnHgEolInDgcmSIhURxk4iIRF5m4yMQlDlwiEYkThyNTJCSKg0xcJOIiE5dIcIkDlxOJE4c4yBQJibjIxEUmLhJxiQSXOHA5kThxiINMkZA4kusAH3ZFPHaXXt8AAAAASUVORK5CYII=","x":24,"y":0,"w":136,"h":346,"m":700}},"far":"data:image/png;base64,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","farW":160,"farH":101,"farFill":"#17518d","farY0":245,"near":"data:image/png;base64,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","nearW":160,"nearH":127,"nearFill":"#1d3c75","nearY0":219,"floor":"data:image/png;base64,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","floorW":160,"floorH":84,"floorFill":"#9f743d","floorRow":17},"space":{"L":{"asteroids":{"src":"data:image/png;base64,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","x":0,"y":0,"w":160,"h":346,"m":0},"nebulae":{"src":"data:image/png;base64,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","x":0,"y":0,"w":160,"h":346,"m":0},"planet":{"src":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEQAAAAtCAYAAAAX6M0gAAAEpElEQVR42t2az0sUYRjHv2NDK4bFxparC8naUlISpUUlUVFUBv0DEdEhMCrqIHRIgiiibh0qDAIPHroFHeqQRWIR/YAtO1Rk6EqBZrUYFYUbxnaIZ33nnfedeWfmnVntgUV39p3Z9/m83+fHvDsGymCJykxRdWx+csiIcm5GOQB8uLzT9ZxfH3+g8fyTyOFUhA2CYDTVxNFUE3eFQC8WHJ3LXm/WKYSduKoixkcLAIBkKoaq2mrbmCXH7oauFqPcIERAGtYmHMeGCUZ7yJC8vcDIZfMlGCrg3nZu9JWgI1fI1vp1RQC40pYuHZOtdi6btx1zUwYLhazx/BOtKjF0hsmHyzuFjqqYCgwWBGtUjXSAMcLIGV6gOIG4ev295f2BbQttYyjUtva80AJFCxBZvmDBqIYDDyO9wLQc39wyXwiEoAQFYobZcXqF4AYDAKpqq5HL5pFMxYSJOFGZKQaBUhEWDD+Wy+ZLqmJhLEvGSi+RMsj6DzQHnpsZ1Im3nRstyU7UUDkBEBkPgz8nmXIGE3kOSVRmik01cdw42BjKpJKpGB4+/y4EwsKQffe78QLae1/7yiemLgf8rhjvIJs8ebXxZbenbwK7ls+zgAhqpu48IHPQj8n6DtZ6B38Kk29kIcM2YbKJsyur4pRfo7CSmZ+w8YWWEik57pRIq2qrQ4Wi23wBGR8tIJmKWaCIusvPhSkAwIndiwNN0i0vUbMmUozXvsRUDRHZJJOMEq5ef2+J5zRMjHybQk/fBA7vq3dViteE3LYnVQpLHsbItymhD25wTBUAI4+PlP4/d7RX6EQDp5RlyRjejReQXmCWJqe7POeyeWFloe9rqonj1s291h6ntcviHw/IFIFgAQDAoztvPE2Uegf+r25zgiGa+6a2FRbf0q1dNvWYicpMkQfAEbUd27+q2TaZBklnGTYIHgBrrz59xf6z/dMHzvZbgPB+p1u7io45RARDtjJ3bo+W+gK2WXJr04MogoVBCVxk+ckhg5RAPslE4AiEPenemQcAgB2ntwAArnXcV2qWwlIMweBBLI79+972i9txavpwcc7zIQDAn5aMc2PmlDvcjIfSfnG7EJRIMUGt/tAG22KR0aJ5termDsNQSar/s1EIUbUx3MruyOMjwiqzZdFcy3s3KUZhFBZkD778thcENskKyq5rB+e02XJwzVLpec/GJgAA6+sWanPYyzW7B4alCTZQpyq6gMqOlE4Qfq/pZz+k4n/MCzJ1hL4f0j0wjGu7Vk5L+vOkVseohKr0GqLxkeyH8KHDAtFpPFxyVgaFPr/wdNB3uISyY6bb+FVn3xMcHcrQBqS99zVOblgurvEetvac7knoOqIxOmEEDhlR2Dg55qlhEsDc3DIfPX0T0nMuPB0s7y93FKuXXsaLAHB8dZ3FET9wZKrif8LkQcyYkKHb7H9WZ3NOBYoMAp17eF89APv2JB8uM+LX/zCrjhNMSqjdA8Nanw/RXmUuvRwDhU9QCLJb+6DNV2QK4dt6FbVQvyGqFiwQ/vOg/UZkQGT3O3xpdlp92ThWFbPmKURVOKpA2Aoy6x/cVS2TKjCiMqMcQGbys+5/ASxUZJ4YO9p9AAAAAElFTkSuQmCC","x":0,"y":8,"w":68,"h":45,"m":0},"sun_moon":{"src":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAB0AAAAgCAYAAADud3N8AAACL0lEQVR42q1Xv0sjQRh9swQrIXAeFtEQNmB3zXGFTQhnkz9AG23srK/PH2DlFfZWwnEWF/+AIFwIAbHwrrEQhAzLblKEVQgsCBI4q28zNzs/k3zVwM7Mm/d933szy+AZH9e3/5m+p1nCbHuwRUDO+0/a+d+aO9ZDBL5MTYCuwVzYLQqkY20FXQUzAteC/vjzWqjh/qe1fHz98GYE2Nos5ePRZFYAT7OEMZmhzEwEtAFfXfbycaVeQ7MRAgB4PAUAxNELOu2WuZFUgLqQAU0RuOrPNaUmwGrtAwCgJAL+euSFOrikVQakzSnCahk8niKOXnBw2kXJtIkNRNUwMqAYzUaI/oD7m4MuDo+/ar9RI+XmQKlV6dHU/rbaqtb0B3xeU50BfD+7cWJiO5jMNLBJoFKvoVKvoT/gBSaLRuCSJlNz2EJmmafXJAEC9AEWD81j+IEuGmIv7O59zi3QmN7RZFZonLBatnbw1WXvPzsEgLvff9H4suHO9Gh/x0syKncaDyN1eum+k6XjC6TyX5UXl9IsYcuYvQ5MtL6lGknUrmpD8laxPKPJDD+vn+w65fG0oC+SgchG1jOPpwVpiYcAML/E0yxhaZYwqm1YLWvBSbO0Oc0R59E3maE1vXQHzjeea45icP9cWCfq0dkGia2cFvEwlAlXwPEwwngYodNuIc0SFqjepfJ71VZvF4a3Fyd+j+2D0663fMgURDDjY3uZA3TardX/y6wimO+CVfwqvgPO2BFwT9mQTgAAAABJRU5ErkJggg==","x":131,"y":20,"w":29,"h":32,"m":0}},"far":"data:image/png;base64,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","farW":160,"farH":104,"farFill":"#3d2f90","farY0":242,"near":"data:image/png;base64,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","nearW":160,"nearH":105,"nearFill":"#2d2268","nearY0":241,"floor":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAKAAAABGCAYAAABL0p+yAAAGd0lEQVR42u1dX0gcRxj/nSwEejaHNppSDo1ie5Ez0kopyRkIkmBDLYEeFEn7Elsk0Ifa5qEQCEVCoNCH0OatSDBPDVJQkAZEIpKH2hKClHCiUrGXICl3Vg9b96FP9kFnXe9m/93Nzuye3+9Jd27mm++b335/ZvZuI8dq4zuQjL+31yIgHICKdQjCukQG7z6Wori+sQ4AiL7SAAAY+fQdIuEePvr2wY7ZNqqgb6zjx6/6pK5L5Gzvl1LvvPb+y8bfREKAOQB9Yx3PHz5UNo+mCxcAANM3r0r1hJpsRRfH7hskHLz7eGdiKK00tAQh9AFQSr5i+TJtoqlQdnHsPgBgae4n49rJ1IclHlIEJobSOFYb3+GR0M7QH3w/bjtmOf2s+jJ7BBFO+lSyLkpCsJswwO5IJzLaLRzr68bDMiPLIkKxnrz0RI9ucvtG9XpuW1SvLysKWRGj9+sfhHvo9v7Lho2ZDbhFiPGhT971rJxb7ycLzMuaDTp986rxv+rQZ5UfP7o1XNJ+7sbwgba3v/kcT67fOdDmBNbX6vMTQ2kjGkkpQt5oec+TBzx3Y7gsEpmNqyTk/PPfwf+PHglUqDtgn5F7lVe0+tau84jGStryuSyitXXc9qXMJOobOtH4ekIeARuPn5Bj5MErwSFhgAjIIs3z7yalyMvnsgAA3rrLJqAmi3zmO7t98IrwYiPM0LEpTVa8NYl8Lgurda9v6HQdzkWgRkkVLCDEVBOeXL8jzft5yROrdhuGR0KWs3j2HtuF/dyUiF0xGo+fQD6XxaNbw0aeyGzMrcr3PhM6ApYowkmWvRAwzOSTmQaVMx+rtcnnstC3CxXNv6Ya7tqL5wfQ1dEDAOjpTkPXt8r2qATvtlfiAUsq2r0Ks+mLS8Z12XkNIyEAvN87gNlfxokhkuwei+2G4rHx2+hPX3Nte+EhWOSmtVtMzYzi4vkBzGdmjS0GAh/zvz4QP2Zm1gjJoc0BRRmhP30NAMj7Kcwdvdi+bAIujtzb38wtPmWQXBR0nelD40uNmM/MCiOebE8qqxBhVW5QUJkHVEw8v8AWiHlTGRgbvx24ajj4BAxQXiN68Rj5fn/6m2/zfrPztJKCYSo3Gpi1qwHBEn6ST8b4YUDVENC8BUMktwbbLglkCHaTnFo9xiMLur6lRPbyyhzXDrZz5RxhsX7xV9uNa1tbhUPrATXzJmJxUmyViP88PaqECOx0I5/LGvt+spBoS1XFggeN7BpQum8Tb02i60wfAOCPv5aN62urC4i3JpE4lcLa6oIR9mQRIRqNcb10pcdBhwVLmcnApSoajzxrqwuWHcxt85lZxFuTiLcmbfuIBKt2ZXo/XggOske1S6WmZkZdp1ub609LrtU3dHLHM69N2TlgWMGO4vwMVWELwebUyayLOd0qNxyzMYr7MzJ6IWLFBFxbXTDuJtmh0OwFp2ZGlRdIqsHWIdGWUrLFk2hLYXllzvaJa188IDveMbtjJ5jJyohU9/JrxrVCZGN/i6UphT+f7eeiLc0Jo4+s04Ogh2CzEzDbKvBVsOjczK2xYrG6kuKn8O8LR08HAIXMCyl5ZthCsFUEWl6ZkzZ/5gVDkQP2dKcD+dRKPpcFOuTLraRCtTpeE+25eWPzyM3ThbfdVzWPY8kOwU7fl3Bqt/JIIqv7luYEWpp3v17pR1hmHpc3tls9lBAwjE99hCEEF+8G+J0LihifHkYgKIUSAuZzWeOojyAGvE1jIiBBGk52XArlvJXlgD3daWKN6MqdPCCB4A2Rs6c/2yEzEMgDEoiABAIRkEAEJBCIgAQiIIFABCQQAQmEcBDw6JHAvX+DdAu2XpowJYD9X8uy+dk2YTJ4bQx+yhWtm5u5+2FPNq6MNbPRTROqRLEgEUpZEcBOMT/k8nSrdLF4Y9jpJ4okvHH8XDMb3TRHQ5o78d40ZNfXjjRuvJUdue3gliTlzou1O4UuqzHsbOfFnk7jl6ObnQw3a25nc64HNBuSRxir11t5uUPckMCrom7l+j2+V08gwnPa3WAixnfigt01j7I1T4OIzkHckD7o46vWzc/8142XrvBm1nwnmChvEvTxVclWqZcA+bQPSFAKIiCBCEggAhIIREACEZBAkIqyj+LcvA7Vrx+KJNnVI1sTOQG7PpUYhmRXr2xN9CTcjuU0QZJ9OGRH3jr1MX0xnUBFCIEISCAQAQlEQAKBCEggAhIIvuN/hA80vYYhthIAAAAASUVORK5CYII=","floorW":160,"floorH":70,"floorFill":"#312d5b","floorRow":3}},"cell":{"w":72,"h":68,"ax":32},"anchor":{"pirate":{"ability":[66,10],"ab2":[68,2],"ab3":[60,0],"ab4":[64,25]}},"coin":{"src":"data:image/png;base64,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","n":8,"cw":28,"ch":28}};
HERO_SPRITES.pilot = ART64.hero.pilot; HERO_SPRITES.ninja = ART64.hero.ninja; HERO_SPRITES.robot = ART64.hero.robot; HERO_SPRITES.mage = ART64.hero.mage; HERO_SPRITES.knight = ART64.hero.knight; HERO_SPRITES.pirate = ART64.hero.pirate; 
var HERO64: any = { pilot: 1, ninja: 1, robot: 1, mage: 1, knight: 1, pirate: 1 };
var HERO64_POSES = ["idle", "squash", "up", "fall", "ability", "ko", "blink", "crouch", "apex", "fstart", "ab2", "ab3", "ab4"];
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

/* ---------------- World ---------------- */
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
    mo.y += mo.hvy * sf;
    if (hang) { mo.topY += mo.hvy * sf; mo.botY += mo.hvy * sf; }
    if (mo.y > w.cameraY + LH + 50) { mo.alive = false; mo.squish = 0; }
    return false;
  }
  var home = mo.home;
  if (!platAlive(w, home)) { startFall(mo); return followHome(w, mo, sf, hang); }
  if (home.vx) mo.x += home.vx * sf;
  mo.minX = home.x;
  mo.maxX = home.x + home.w - mo.w;
  if (mo.maxX < mo.minX) mo.maxX = mo.minX;
  mo.x = clamp(mo.x, mo.minX, mo.maxX);
  if (hang) {
    mo.topY = hangTop(home);
    mo.botY = mo.topY + (mo.hangLen || 24);
  } else {
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
      var canHang = false;
      for (var hi = 0; hi < row.length; hi++) {
        var hp = row[hi];
        if (!isPerm(hp.type) || hp.broken || hp.w < M.w + 4) continue;
        if (spaceBelow(w, hp, hp.x + 2, M.w) >= 22) { canHang = true; break; }
      }
      if (!canHang) continue;
    } else {
      if (M.plat) {
        var homes0 = row.filter(function (p: any) { return isPerm(p.type) && p.type !== "bounce" && !p.spring && p.w >= 26 && !p.broken; });
        if (!homes0.length || (!isMove && solids.length < 2)) continue;
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
    var hangs = row.filter(function (p: any) { return isPerm(p.type) && !p.broken && p.w >= M2.w + 4 && spaceBelow(w, p, p.x + 2, M2.w) >= 22; });
    if (!hangs.length) return false;
    var hs = hangs[Math.floor(r() * hangs.length)];
    var sx = hs.x + randInt(r, 1, Math.max(1, hs.w - M2.w - 1));
    var room = spaceBelow(w, hs, sx, M2.w);
    var hangLen = Math.min(M2.gap || 32, Math.max(16, room - M2.h - 6));
    var ty = hangTop(hs);
    w.monsters.push(mkMob(kind, sx, ty + 2, d, {
      home: hs, hangLen: hangLen, topY: ty, botY: ty + hangLen,
      minX: hs.x, maxX: hs.x + hs.w - M2.w
    }));
    return true;
  }
  if (M2.plat) {
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

  var pMon = m < 180 ? 0 : m < 400 ? 0.045 : lerp(0.07, 0.26, d);
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
function createWorld(seed: number, mode: string, humanKind: number, humanLook: any, mapId?: string) {
  var w: any = {
    seed: seed >>> 0, rng: mulberry32(seed >>> 0), mode: mode, map: mapInfo(mapId || "city").id,
    platforms: [], monsters: [], bullets: [], coins: [], items: [], particles: [],
    nextY: -24, rowN: 1, platSeq: 0, netBreaks: {}, lastKind: "", lastMobRow: {}, cameraY: -LH + 70, tick: 0, shake: 0,
    reachFrom: [{ x: 8, w: LW - 16 }], reachGap: 24,
    phase: "play", players: [], finishWait: 0, runCoins: 0, bonusCoins: 0, paid: false, freezeMobT: 0, toast: "", toastT: 0, nextBonusM: 0, fallWarn: 0, liftWarn: 0, warnSfxT: 0
  };
  w.nextBonusM = randInt(w.rng, 160, 240);
  w.platforms.push(stampPlat(w, mkPlat(8, 0, LW - 16, "normal", 0)));
  var xs = mode === "squad" ? [74, 22, 124, 48] : [Math.round(LW / 2) - 6];
  w.players.push(newPlayer(0, humanKind, humanLook, xs[0], false));
  if (mode === "squad") {
    var bk = botKinds(humanKind);
    for (var i = 1; i < 4; i++) {
      var bp = newPlayer(i, bk[i - 1], makeLook(bk[i - 1], "base", "none"), xs[i], true);
      bp.name = "БОТ " + i; /* label only: «БОТ 1..3» in game, results and spectator */
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
  if (p.id === 0) { w.shake = 4; toast(w, "ЩИТ СПАС!"); hopSfx("shield"); }
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
  mo.squish = 10;
  if (!noBounce) { p.vy = STOMP_V; p.y = mo.y - PH; }
  p.kills++;
  addCharge(p, "kills", 1);
  var pal = MOBPAL[mo.kind] || ["#ffd070"];
  spawnParts(w, mo.x + mo.w / 2, mo.y + 4, 12, pal[0], 2.6, 0.15);
  if (p.id === 0) { w.shake = 5; hopSfx("hit"); }
}
function mobBox(mo: any) {
  if (mo.b === "puff" && mo.big) return [mo.x - 3, mo.y - 3, mo.w + 6, mo.h + 6];
  /* slimes: slightly tighter box so a graze at the edge is not a hit */
  if (mo.kind === "blob" || mo.kind === "magma") return [mo.x + 2, mo.y + 1, mo.w - 4, mo.h - 2];
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
    if (!best) { if (p.id === 0) toast(w, "НЕТ ПЛАТФОРМЫ"); return false; }
    spawnParts(w, p.x + 6, p.y + 8, 14, "#c890ff", 2.4, 0, 2);
    /* Same destination as the old snap. Ten ticks of interpolation, then the same jump. */
    p.tx0 = p.x; p.ty0 = p.y; p.ttx = clamp(best.x + best.w / 2 - PW / 2, 0, LW - PW); p.tty = best.y - PH;
    p.teleT = 0; p.teleN = 10;
    p.invT = Math.max(p.invT, 30); p.grabT = 0; p.poundT = 0; p.teleFx = 18; p.vx = 0; p.vy = 0;
    spawnParts(w, p.ttx + 6, p.tty + 8, 8, "#e8c8ff", 1.6, 0, 1);
  }
  else if (H.ab === "wall") { p.wallT = 300; p.wall = 0; spawnParts(w, p.x + 6, p.y + 8, 10, "#d82a2a", 2, 0, 1); }
  else if (H.ab === "dash") { p.vy = Math.min(p.vy, -6.6); p.vx = clamp(p.vx + p.face * 1.6, -MAX_VX * 1.3, MAX_VX * 1.3); p.dashT = 14; p.grabT = 0; spawnParts(w, p.x + 6, p.y + PH, 12, "#7ad8ff", 2.4, 0.08, 2); }
  else if (H.ab === "dome") { p.domeT = 200; p.domeSave = true; spawnParts(w, p.x + 6, p.y + 8, 14, "#c89bff", 2.6, 0, 1); }
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
  it.popT = BUBBLE.popTicks;
  var B: any = null;
  for (var i = 0; i < BONUSES.length; i++) if (BONUSES[i].id === it.kind) B = BONUSES[i];
  if (!B) return;
  if (B.id === "bigcoin") w.bonusCoins += BIGCOIN;
  else if (B.id === "shield") p.shieldT = B.t;
  else if (B.id === "magnet") p.magnetT = Math.max(p.magnetT, B.t);
  else if (B.id === "rocket") { p.rocketT = B.t; p.grabT = 0; p.poundT = 0; p.invT = Math.max(p.invT, B.t + 40); }
  toast(w, B.id === "bigcoin" ? "КЛАД +" + BIGCOIN : B.name + "!");
  if (p.id === 0) { w.shake = 3; hopSfx(B.id === "shield" ? "shield" : "bonus"); }
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
          if (md < 70 && md > 0.5) { var ms = Math.min(md, 3.4); cn.x += (mdx / md) * ms; cn.y += (mdy / md) * ms; }
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
    if (w.tick > 80 && ep.vy >= 0 && ep.y > ep.camY + LH) {
      if (ep.domeT > 0 && ep.domeSave) { ep.domeSave = false; ep.y = ep.camY + LH - PH - 12; ep.vy = SPRING_V; ep.invT = 40; spawnParts(w, ep.x + 6, ep.y + 8, 16, "#a8f4ff", 3, -0.03, 2); if (ep.id === 0) toast(w, "КОСМОЩИТ СПАС!"); }
      else killPlayer(w, ep, "fall");
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
  /* v1.0 w13: hand-drawn 80×80 pop at the same scale(0.5) as the rest bubble. popTicks=10. */
  var max = BUBBLE.popTicks;
  var sheet = typeof fx64Sheet === "function" ? fx64Sheet("bubblePop") : null;
  var frame = Math.max(0, Math.min(3, Math.floor((max - t) * 4 / max)));
  if (sheet) {
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.translate(cx, cy);
    ctx.scale(0.5, 0.5);
    ctx.drawImage(sheet, frame * 80, 0, 80, 80, -40, -40, 80, 80);
    ctx.restore();
    return;
  }
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


/* ---------------- Online multiplayer (net) ----------------
   Realtime rooms for up to 4 friends via the Хоппак server (server/, NestJS + ws).
   Protocol: server/src/protocol.ts. Everything online lives here; the shell only calls
   NET.* through small hooks (search "NET." in 04_shell.tsx and "w.net" / "p.remote" in 02_world.tsx).
   Model: every client simulates the same seeded map and only its own hero; remote heroes are
   drawn from server-relayed snapshots (20 Hz) with ~150 ms interpolation. Bots are the squad
   AI, simulated by the host client and relayed like a remote hero (`sb`). Stomped mobs and
   deaths are relayed as events; the server decides when the round ends (everybody fell). */
/* Must match server PROTOCOL_VERSION in net @ 2e6bfc0 (hello { v, s }). */
var NET_PROTO = 1;
/* Room generation. 0.59 clients omit this and only meet each other. */
var NET_GEN = "1.0"; /* v1.0: 180-wide field + new generator; rooms never mix with 0.6rc (server GEN check) */
var NET_SEND_MS = 66; /* own state ~15 Hz */
var NET_DELAY_MS = 150; /* interpolation buffer */
var NET_GRACE_MS = 10000;
var NET_XS = [74, 22, 124, 48]; /* start x by slot (same as the bot squad) */
var NET_TAGS: any = { host: "ХОСТ", ready: "ГОТОВ", wait: "ЖДЁМ", off: "НЕТ СВЯЗИ" };

var NET: any = (function () {
  var N: any = {
    ws: null, st: "off", /* off | connecting | online | reconnecting | error | unsupported */
    room: null, you: -1, token: "", err: "", sub: "home", code: "", startInfo: null, results: null,
    off: 0, rtt: 0, pingT: 0, lastSend: 0, reconUntil: 0, reconTimer: 0, onOpen: null as any, probing: false,
    stats: { sent: 0, recv: 0, snaps: 0, startedAt: 0 },
    buf: {} as any, /* pid -> samples [{t,x,y,vx,vy,f,a,m,ps}] */
    events: [] as any[], api: null as any
  };
  function now() { return Date.now(); }
  function serverNow() { return now() + N.off; }
  /* Build-time origin, e.g. --define:HOP_SERVER="https://76-13-250-251.sslip.io".
     From it we derive wss://host/ws and https://host/api/health. */
  function builtinOrigin() {
    try { if (typeof HOP_SERVER !== "undefined" && HOP_SERVER) return String(HOP_SERVER).replace(/\/$/, ""); } catch (_e) {}
    return "";
  }
  function toWs(origin: string) {
    var o = String(origin || "").trim();
    if (!o) return "";
    if (o.indexOf("ws://") === 0 || o.indexOf("wss://") === 0) {
      return /\/ws\/?$/.test(o) ? o.replace(/\/$/, "") : o.replace(/\/$/, "") + "/ws";
    }
    if (o.indexOf("https://") === 0) return "wss://" + o.slice(8).replace(/\/$/, "") + "/ws";
    if (o.indexOf("http://") === 0) return "ws://" + o.slice(7).replace(/\/$/, "") + "/ws";
    return "";
  }
  function toHealth(wsUrl: string) {
    try {
      var s = String(wsUrl || "");
      if (s.indexOf("wss://") === 0) s = "https://" + s.slice(6);
      else if (s.indexOf("ws://") === 0) s = "http://" + s.slice(5);
      var u = new URL(s);
      var path = u.pathname || "";
      if (path.lastIndexOf("/ws") === path.length - 3) path = path.slice(0, -3);
      if (path.charAt(path.length - 1) === "/") path = path.slice(0, -1);
      u.pathname = path + "/api/health";
      u.search = ""; u.hash = "";
      return u.toString();
    } catch (_e) { return ""; }
  }
  function url() {
    var w: any = typeof window !== "undefined" ? window : null;
    if (!w) return "";
    try {
      var q = new URLSearchParams(w.location.search).get("server");
      if (q) return toWs(q);
      if (w.HOPPAK_SERVER) return toWs(w.HOPPAK_SERVER);
      var ls = w.localStorage && w.localStorage.getItem("hoppak.server");
      if (ls) return toWs(ls);
    } catch (_e) {}
    var built = builtinOrigin();
    if (built) return toWs(built);
    var pr = w.location && w.location.protocol;
    /* file:// (and anything that isn't http/https) has no same-host server. */
    if (pr !== "http:" && pr !== "https:") return "";
    return (pr === "https:" ? "wss://" : "ws://") + w.location.host + "/ws";
  }
  function store(k: string, v: any) { try { if (v == null) sessionStorage.removeItem(k); else sessionStorage.setItem(k, v); } catch (_e) {} }
  function load(k: string) { try { return sessionStorage.getItem(k); } catch (_e) { return null; } }
  function nick() {
    var s = ""; try { s = localStorage.getItem("hoppak.nick") || ""; } catch (_e) {}
    return s;
  }
  function cleanText(s: string, max: number) {
    s = String(s || "").toUpperCase();
    var out = "";
    for (var i = 0; i < s.length && out.length < max; i++) if (FONT[s[i]] || s[i] === " ") out += s[i];
    return out.trim();
  }
  function cleanNick(s: string) { return cleanText(s, 10); }
  /* Default = the player's own nickname (Telegram first name / @username, else the guest HOP-xxxx), never the hero. */
  function defaultNick() {
    var s = "";
    try { if (N.api && N.api.accountName) s = cleanNick(N.api.accountName(false)); } catch (_e) {}
    return s || CHARS[N.api ? N.api.save().char : 0].name.toUpperCase();
  }
  function typedNick() { return cleanNick(nick()); }
  function shownNick() { return typedNick() || defaultNick(); }
  N.shownNick = shownNick;
  /* Timers that survive a blocked JS thread (iOS window.prompt, app in background): if the callback runs far later than
     scheduled, the socket/fetch events that queued meanwhile get one more full window before we call it a failure. */
  function lateSafe(fn: any, ms: number) {
    var due = now() + ms, rearmed = false, h: any = 0;
    function tick() {
      if (!rearmed && now() - due > 1500) { rearmed = true; due = now() + ms; h = setTimeout(tick, ms); return; }
      fn();
    }
    h = setTimeout(tick, ms);
    return { cancel: function () { clearTimeout(h); } };
  }
  function send(event: string, data: any) {
    if (!N.ws || N.ws.readyState !== 1) return false;
    N.ws.send(JSON.stringify({ event: event, data: data || {} }));
    N.stats.sent++;
    return true;
  }
  N.send = send;
  N.serverNow = serverNow;

  /* ---------- connection ---------- */
  function failLink(cb?: any) {
    N.st = "error"; N.err = "НЕТ СВЯЗИ"; N.linkTry = 0;
    var f = cb || N.onOpen; N.onOpen = null; if (f) f(false);
  }
  function probeHealth(hu: string, cb: any) {
    if (!hu || typeof fetch === "undefined") { cb(false); return; }
    var ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
    var to = lateSafe(function () { try { if (ctrl) ctrl.abort(); } catch (_e) {} }, 5000);
    var done = false;
    function finish(ok: boolean) {
      if (done) return;
      done = true; to.cancel(); cb(!!ok);
    }
    var opts: any = { method: "GET", cache: "no-store", mode: "cors" };
    if (ctrl) opts.signal = ctrl.signal;
    fetch(hu, opts).then(function (r: any) { finish(!!r && r.ok); }).catch(function () { finish(false); });
  }
  function openSocket(u: string) {
    var ws: any;
    try { ws = new WebSocket(u); } catch (_e) { failLink(); return; }
    N.ws = ws;
    var opened = false;
    var to = lateSafe(function () { if (!opened) { try { ws.close(); } catch (_e) {} } }, 5000);
    ws.onopen = function () {
      opened = true; to.cancel();
      /* Stay in connecting until hello confirms the protocol version.
         Old site builds at /v/<ver>/ share the same /ws; a mismatch must not crash. */
      if (N.helloTimer) N.helloTimer.cancel();
      N.helloTimer = lateSafe(function () {
        N.helloTimer = 0;
        if (N.ws === ws && N.st !== "online" && N.st !== "unsupported") rejectVersion();
      }, 2000);
    };
    ws.onmessage = function (e: any) { N.stats.recv++; var m: any; try { m = JSON.parse(e.data); } catch (_e2) { return; } onMsg(m.event, m.data || {}); };
    ws.onclose = function () {
      to.cancel();
      if (N.helloTimer) { N.helloTimer.cancel(); N.helloTimer = 0; }
      if (N.ws !== ws) return;
      N.ws = null;
      if (N.st === "unsupported") return;
      if (!opened && N.st !== "reconnecting") { if (!retryLink()) failLink(); return; }
      if (N.room) startReconnect(); else if (N.st !== "error") N.st = "off";
    };
    ws.onerror = function () {};
  }
  N.connect = function (cb?: any) {
    if (N.ws && N.ws.readyState === 1) { if (cb) cb(true); return; }
    var u = url();
    if (!u || typeof WebSocket === "undefined") { failLink(cb); return; }
    if (N.ws && N.ws.readyState === 0) { N.onOpen = cb || N.onOpen; return; }
    if (N.probing) { N.onOpen = cb || N.onOpen; return; }
    N.st = N.st === "reconnecting" ? "reconnecting" : "connecting";
    N.onOpen = cb || null;
    N.probing = true;
    probeHealth(toHealth(u), function (ok: boolean) {
      N.probing = false;
      if (N.st !== "connecting" && N.st !== "reconnecting") return;
      if (!ok) { if (!retryLink()) failLink(); return; }
      openSocket(u);
    });
  };
  /* A single stalled TLS handshake / probe (seen on mobile and long routes to the VPS) must not end in «НЕТ СВЯЗИ»:
     try a fresh connection twice more before giving up. linkTry resets once the server says hello. */
  function retryLink() {
    if (N.st === "reconnecting" || (N.linkTry | 0) >= 2) return false;
    N.linkTry = (N.linkTry | 0) + 1;
    var cb = N.onOpen; N.onOpen = null;
    N.st = "off";
    setTimeout(function () { N.connect(cb); }, 300);
    return true;
  }
  function startReconnect() {
    if (N.st !== "reconnecting") { N.st = "reconnecting"; N.reconUntil = now() + NET_GRACE_MS; }
    if (N.reconTimer) return;
    N.reconTimer = setTimeout(function () {
      N.reconTimer = 0;
      if (N.st !== "reconnecting") return;
      if (now() > N.reconUntil) { giveUp("СВЯЗЬ ПОТЕРЯНА"); return; }
      N.connect();
      setTimeout(function () { if (N.st === "reconnecting" && !N.ws) startReconnect(); }, 1200);
    }, 800);
  }
  function rejectVersion() {
    if (N.helloTimer) { N.helloTimer.cancel(); N.helloTimer = 0; }
    N.st = "unsupported";
    N.err = "МУЛЬТИПЛЕЕР НЕДОСТУПЕН В ЭТОЙ ВЕРСИИ";
    N.room = null;
    var ws = N.ws;
    N.ws = null;
    try { if (ws) ws.close(); } catch (_e) {}
    var f = N.onOpen; N.onOpen = null; if (f) f(false);
    if (N.api && N.api.phase() === "net") N.sub = "home";
  }
  function giveUp(msg: string) {
    N.st = "error"; N.err = msg; N.room = null; N.token = ""; store("hoppak.net.token", null);
    var w = N.api && N.api.world();
    if (w && w.net && w.phase === "play") { w.net = false; w.netLost = true; }
    if (N.api && N.api.phase() === "net") N.sub = "home";
  }
  function ping() {
    N.pingT = now();
    send("ping", { c: N.pingT });
  }
  /** Test/debug hook: drop the socket as if the network blinked. */
  N.dropSocket = function () { if (N.ws) { try { N.ws.close(); } catch (_e) {} } };

  function onMsg(ev: string, d: any) {
    if (ev === "pong") {
      var t = now(), rtt = t - d.c, off = d.s + rtt / 2 - t;
      if (!N.rtt || rtt < N.rtt * 1.5) N.off = N.rtt ? N.off * 0.7 + off * 0.3 : off;
      N.rtt = N.rtt ? N.rtt * 0.8 + rtt * 0.2 : rtt;
    } else if (ev === "hello") {
      if (N.helloTimer) { N.helloTimer.cancel(); N.helloTimer = 0; }
      if (d.v !== NET_PROTO) { rejectVersion(); return; }
      ping();
      var tok = N.token || load("hoppak.net.token");
      if (N.st === "reconnecting" && tok) send("resume", { token: tok });
      else { N.st = "online"; N.linkTry = 0; var f = N.onOpen; N.onOpen = null; if (f) f(true); }
      if (d.s && !N.rtt) N.off = d.s - now();
    } else if (ev === "room") {
      var wasRecon = N.st === "reconnecting";
      N.room = d; N.you = d.you; N.token = d.token; store("hoppak.net.token", d.token); N.st = "online";
      sessionFor(d.code);
      if (wasRecon) { var f = N.onOpen; N.onOpen = null; if (f) f(true); }
      if (N.api && N.api.phase() === "net" && N.sub !== "room") N.sub = "room";
    } else if (ev === "start") {
      N.startInfo = d; N.results = null; N.buf = {};
      var w0 = N.api && N.api.world();
      if (d.resumed && w0 && w0.net && w0.netRound === d.round) return; /* our run survived the blink */
      if (d.resumed) { /* page reloaded mid-run: sit this round out, the room continues */
        send("ev", { e: "dead", m: 0, why: "left" }); N.sub = "room"; return;
      }
      if (N.api) N.api.startNet(d);
    } else if (ev === "snap") {
      N.stats.snaps++;
      for (var i = 0; i < d.s.length; i++) {
        var a = d.s[i], pid = a[0];
        if (pid === N.you) continue;
        var b = N.buf[pid] || (N.buf[pid] = []);
        b.push({ t: d.ts, x: a[1], y: a[2], vx: a[3], vy: a[4], f: a[5], a: a[6], m: a[7], ps: a[8] });
        if (b.length > 40) b.splice(0, b.length - 40);
      }
    } else if (ev === "ev") {
      N.events.push(d);
    } else if (ev === "results") {
      N.results = d;
      noteResults(d);
    } else if (ev === "err") {
      if (d.code === "GEN") {
        N.st = "update";
        N.err = "ОБНОВИ СТРАНИЦУ";
        N.room = null;
        N.sub = "update";
        return;
      }
      N.err = d.msg || d.code;
      if (d.code === "NO_SESSION") giveUp("КОМНАТА ЗАКРЫТА");
      if (N.api) N.api.say(cleanText(N.err, 24) || "ОШИБКА");
    } else if (ev === "replaced") {
      N.leave();
      /* A newer token in storage = another tab of this same browser logged in again: same client, no banner. */
      var storedTok = "";
      try { storedTok = (typeof PROFILE !== "undefined" && PROFILE && PROFILE.getToken) ? (PROFILE.getToken() || "") : ""; } catch (_e) {}
      if (storedTok && N.sessTok && storedTok !== N.sessTok) { if (N.api) N.api.goMenu(); }
      else if (typeof PROFILE !== "undefined" && PROFILE && PROFILE.serverSaysReplaced && PROFILE.serverSaysReplaced()) { /* banner + menu via profile */ }
      else if (N.api && N.api.sessionReplaced) N.api.sessionReplaced();
      else if (N.api) N.api.goMenu();
    } else if (ev === "kicked") {
      var code = (d && d.code) || (N.room && N.room.code) || "";
      rememberKick(code);
      N.room = null; N.you = null; N.token = ""; N.startInfo = null;
      store("hoppak.net.token", null);
      N.sub = "home";
      N.st = N.ws ? "online" : "off";
      if (N.api) { N.api.goMenu(); N.api.say("ТЕБЯ ВЫГНАЛИ"); }
    }
  }
  function kickedCodes(): string[] {
    try { var raw = sessionStorage.getItem("hoppak.net.kicked"); var a = raw ? JSON.parse(raw) : []; return Array.isArray(a) ? a : []; }
    catch (_e) { return []; }
  }
  function rememberKick(code: string) {
    if (!code) return;
    var a = kickedCodes();
    if (a.indexOf(code) < 0) a.push(code);
    try { sessionStorage.setItem("hoppak.net.kicked", JSON.stringify(a)); } catch (_e) {}
  }
  function wasKicked(code: string) { return kickedCodes().indexOf(String(code || "")) >= 0; }

  /* ---------- room actions ---------- */
  function me() {
    var tok = "";
    try { tok = (typeof PROFILE !== "undefined" && PROFILE && PROFILE.getToken) ? (PROFILE.getToken() || "") : ""; } catch (_e) {}
    var plat = "web";
    try {
      var tg = (window as any).Telegram && (window as any).Telegram.WebApp;
      if (tg && tg.platform) plat = String(tg.platform).slice(0, 16);
    } catch (_e2) {}
    if (tok) N.sessTok = tok; /* the login this socket belongs to */
    return { name: shownNick(), cn: typedNick() ? 1 : 0, kind: N.api ? N.api.save().char : 0, g: NET_GEN, pt: tok, v: "1.0", p: plat };
  }
  function screenNow() {
    var w = N.api && N.api.world && N.api.world();
    if (w && w.phase === "play") return (w.players && w.players[0] && !w.players[0].alive) ? "spectator" : "game";
    if (N.room) return "lobby";
    return "menu";
  }
  N.presence = function () {
    if (!N.ws) return;
    var m = me();
    send("presence", { screen: screenNow(), v: m.v, p: m.p, pt: m.pt });
  };
  if (typeof setInterval !== "undefined") setInterval(function () { try { N.presence(); } catch (_e) {} }, 30000);
  N.create = function () { N.connect(function (ok: boolean) { if (ok) { var m = me(); send("create", m); } }); };
  N.join = function (code: string) {
    if (wasKicked(code)) { if (N.api) { N.api.goMenu(); N.api.say("ТЕБЯ ВЫГНАЛИ"); } return; }
    N.connect(function (ok: boolean) { if (ok) { var m: any = me(); m.code = code; send("join", m); } });
  };
  N.leave = function () {
    if (N.room) send("leave", {});
    N.room = null; N.token = ""; N.startInfo = null; N.results = null; N.session = emptySession(""); store("hoppak.net.token", null);
    if (N.reconTimer) { clearTimeout(N.reconTimer); N.reconTimer = 0; }
    if (N.st === "reconnecting") N.st = N.ws ? "online" : "off";
  };
  N.inRoom = function () { return !!N.room; };
  N.isHost = function () { return !!N.room && N.room.host === N.you; };
  N.mePlayer = function () { if (!N.room) return null; for (var i = 0; i < N.room.players.length; i++) if (N.room.players[i].pid === N.you) return N.room.players[i]; return null; };
  /** Online rooms pin the logical width: the map generator depends on LW. */
  N.fixedLW = function () { return N.room ? N.room.lw : 0; };
  /* Evening score is client-side from `results` broadcasts (same session, same room).
     Server NET_LW is 180; width parity with solo (160) needs a one-line server change via Devops. */
  function emptySession(code: string) { return { code: code || "", rounds: [], wins: {}, best: {}, names: {} }; }
  N.session = emptySession("");
  function sessionFor(code: string) {
    if (!N.session || N.session.code !== (code || "")) N.session = emptySession(code);
  }
  function noteResults(d: any) {
    sessionFor(N.room ? N.room.code : (N.session && N.session.code) || "");
    if (!d || !d.ranking) return;
    for (var i = 0; i < N.session.rounds.length; i++) if (N.session.rounds[i].round === d.round) return;
    N.session.rounds.push({ round: d.round, ranking: d.ranking });
    for (var j = 0; j < d.ranking.length; j++) {
      var r = d.ranking[j];
      if (r.name) N.session.names[r.pid] = r.name;
      if (r.place === 1) N.session.wins[r.pid] = (N.session.wins[r.pid] || 0) + 1;
      var hm = r.m || 0;
      if (hm > (N.session.best[r.pid] || 0)) N.session.best[r.pid] = hm;
    }
  }
  function eveningRoundNo(S: any) {
    var n = 0;
    for (var i = 0; i < S.rounds.length; i++) {
      var r = Number(S.rounds[i] && S.rounds[i].round);
      if (r > n) n = r;
    }
    return n || S.rounds.length;
  }
  N.drawEvening = function (ctx: any, x: number, y: number) {
    var S = N.session;
    if (!S || !S.rounds || !S.rounds.length) return y;
    var pids: any[] = [];
    for (var k in S.names) pids.push(k);
    if (!pids.length) {
      for (var k2 in S.wins) if (pids.indexOf(k2) < 0) pids.push(k2);
      for (var k3 in S.best) if (pids.indexOf(k3) < 0) pids.push(k3);
    }
    pids.sort(function (a: any, b: any) {
      var wa = S.wins[a] || 0, wb = S.wins[b] || 0;
      if (wb !== wa) return wb - wa;
      return (S.best[b] || 0) - (S.best[a] || 0);
    });
    /* Round number, not the number of name rows. 9px rows so five and six names fit the lobby gap. */
    var roundNo = eveningRoundNo(S);
    var head = 12, rowH = 9, maxY = arguments.length > 3 ? arguments[3] : 0;
    var fit = pids.length;
    if (maxY > y + head) fit = Math.max(1, Math.min(pids.length, Math.floor((maxY - y - head) / rowH)));
    else if (maxY) fit = 0;
    var maxOff = Math.max(0, pids.length - fit);
    if ((N.evOff || 0) > maxOff) N.evOff = maxOff;
    if ((N.evOff || 0) < 0) N.evOff = 0;
    var off = N.evOff || 0;
    var h = head + fit * rowH;
    N.eveningState = { round: roundNo, title: "РАУНД " + roundNo, total: pids.length, fit: fit, off: off };
    box(ctx, x, y, 152, h, C.navy, C.gold);
    if (N.api && N.api.markBox) N.api.markBox("evening", x, y, 152, h);
    /* With the ↑ scroll button the header moves left and shortens so the button never covers it. */
    if (maxOff > 0) drawText(ctx, "СЧЁТ · РАУНД " + roundNo, x + 6, y + 2, C.gold, 1, "left");
    else drawText(ctx, "СЧЁТ ВЕЧЕРА · РАУНД " + roundNo, LW / 2, y + 2, C.gold, 1, "center");
    for (var i2 = 0; i2 < fit; i2++) {
      var pid = pids[off + i2], nm = drawableChars(String(S.names[pid] || "ИГРОК")).slice(0, 10);
      var lineY = y + 12 + i2 * 9;
      drawText(ctx, nm || "HOPP", x + 6, lineY, C.cream, 1, "left");
      drawText(ctx, (S.wins[pid] || 0) + "П  " + (S.best[pid] || 0) + "М", x + 146, lineY, C.cream, 1, "right");
    }
    if (maxOff > 0 && N.api && N.api.btn) {
      N.api.btn("net:evup", x + 132, y + 1, 18, 11, "#1a1430", "↑", C.cream);
      N.evScroll = true;
    }
    return y + h + 4;
  };

  /* ---------- world integration ---------- */
  function lookOf(k: number) { return makeLook(k, "base", "none"); }
  function mobId(mo: any) { return mo.kind + ":" + Math.round(mo.baseX) + ":" + Math.round(mo.baseY); }
  /** Called by the shell right after createWorld(seed, "solo", ...) for an online start. */
  N.attachWorld = function (w: any, info: any) {
    w.net = true; w.mode = "squad"; w.netRound = info.round; w.netAt = info.at; w.netDead = false;
    var mine: any = null, others: any[] = [];
    for (var i = 0; i < info.players.length; i++) { if (info.players[i].pid === N.you) mine = info.players[i]; else others.push(info.players[i]); }
    var me0 = w.players[0];
    if (mine) { me0.x = NET_XS[mine.slot % 4]; me0.name = mine.name; me0.pid = mine.pid; }
    var hostSim = N.isHost();
    for (var k = 0; k < others.length; k++) {
      var o = others[k];
      var mineBot = !!(o.bot && hostSim);
      var p: any = newPlayer(k + 1, o.kind, lookOf(o.kind), NET_XS[o.slot % 4], mineBot);
      p.remote = !mineBot; p.pid = o.pid; p.name = o.name; p.react = 1; p.bias = 0;
      w.players.push(p);
    }
    N.lastSend = 0; N.lastBot = 0; N.events = []; N.buf = {};
    N.stats.startedAt = now();
  };
  /** True while waiting for the synchronized start moment (shell skips ticks). */
  N.waiting = function (w: any) { return !!(w && w.net && w.tick === 0 && serverNow() < w.netAt); };
  function flags(p: any) {
    return (p.abFx > 0 || p.teleFx > 10 ? 1 : 0) | (p.squash > 3 ? 2 : 0) | (p.domeT > 0 ? 4 : 0) | (p.shieldT > 0 ? 8 : 0) |
      (p.rocketT > 0 ? 16 : 0) | (p.wall ? 32 : 0) | (p.dashT > 0 ? 64 : 0) | (p.poundT > 0 ? 128 : 0) | (p.hookN > 0 ? 256 : 0) |
      (p.freezeT > 0 ? 512 : 0) | (p.magnetT > 0 ? 1024 : 0) | (p.wall < 0 ? 2048 : 0) |
      (p.shieldT > 0 && p.shieldT <= SHIELD_BLINK_T ? 4096 : 0) |
      /* v0.59: ninja wall ability on (8192) and its last-1.2 s blink (16384); old clients ignore both */
      (p.wallT > 0 ? 8192 : 0) | (p.wallT > 0 && p.wallT <= WALL_BLINK_T ? 16384 : 0);
  }
  function applyFlags(p: any, ps: number) {
    p.abFx = ps & 1 ? 5 : 0; p.squash = ps & 2 ? 4 : 0; p.domeT = ps & 4 ? 100 : 0;
    p.shieldT = ps & 8 ? (ps & 4096 ? 40 : 120) : 0;
    p.rocketT = ps & 16 ? 10 : 0; p.wall = ps & 32 ? (ps & 2048 ? -1 : 1) : 0; p.wallT = ps & 8192 ? (ps & 16384 ? 30 : 120) : (p.wall ? 10 : 0); p.dashT = ps & 64 ? 5 : 0;
    p.poundT = ps & 128 ? 5 : 0; p.hookN = 0; p.freezeT = ps & 512 ? 5 : 0; p.magnetT = ps & 1024 ? 100 : 0;
  }
  function lerpX(a: number, b: number, t: number) {
    var d = b - a; if (d > LW / 2) d -= LW; if (d < -LW / 2) d += LW;
    var x = a + d * t; if (x < -PW) x += LW; if (x > LW) x -= LW; return x;
  }
  function interp(p: any, b: any[], rt: number) {
    if (!b || !b.length) return;
    var s0 = b[0], s1: any = null;
    for (var i = 0; i < b.length; i++) { if (b[i].t <= rt) s0 = b[i]; else { s1 = b[i]; break; } }
    var x, y, vx = s0.vx, vy = s0.vy;
    if (s1 && s1.t > s0.t && s0.t <= rt) {
      var u = (rt - s0.t) / (s1.t - s0.t);
      x = lerpX(s0.x, s1.x, u); y = s0.y + (s1.y - s0.y) * u; vx = s0.vx + (s1.vx - s0.vx) * u; vy = s0.vy + (s1.vy - s0.vy) * u;
    } else if (!s1) { /* extrapolate a little (max 100 ms) using velocity in px/tick (50 ticks/s) */
      var dt = Math.min(0.1, Math.max(0, (rt - s0.t) / 1000)) * 50;
      x = lerpX(s0.x, s0.x + s0.vx * dt, 1); y = s0.y + s0.vy * dt;
    } else { x = s0.x; y = s0.y; }
    var last = b[b.length - 1];
    p.x = x; p.y = y; p.vx = vx; p.vy = vy; p.face = s0.f;
    p.maxH = Math.max(p.maxH, last.m);
    if (p.alive && !last.a) p.alive = false;
    applyFlags(p, s0.ps);
    var cy = p.y - LH * 0.42; if (cy < p.camY) p.camY = cy;
  }
  /** Per frame, after the local ticks: send own state, place remote heroes, apply relayed events, end the round. */
  N.frame = function (w: any) {
    if (!w || !w.net) return;
    var t = now(), me0 = w.players[0];
    if (t - N.pingT > 2000) ping();
    if (!w.netDead && t - N.lastSend >= NET_SEND_MS && w.tick > 0) {
      N.lastSend = t;
      send("st", { x: Math.round(me0.x * 10) / 10, y: Math.round(me0.y * 10) / 10, vx: Math.round(me0.vx * 100) / 100, vy: Math.round(me0.vy * 100) / 100, f: me0.face, a: me0.alive ? 1 : 0, m: Math.round(me0.maxH), ps: flags(me0), tk: w.tick });
    }
    if (!me0.alive && !w.netDead) {
      w.netDead = true;
      send("st", { x: me0.x, y: me0.y, vx: 0, vy: me0.vy, f: me0.face, a: 0, m: Math.round(me0.maxH), ps: 0, tk: w.tick });
      send("ev", { e: "dead", m: metersOf(me0), why: me0.why });
    }
    if (N.isHost() && t - N.lastBot >= NET_SEND_MS && w.tick > 0) {
      N.lastBot = t;
      var rows: any[] = [];
      for (var bpi = 0; bpi < w.players.length; bpi++) {
        var bp2 = w.players[bpi];
        if (!bp2.isBot || bp2.remote) continue;
        rows.push({ b: bp2.pid, x: Math.round(bp2.x * 10) / 10, y: Math.round(bp2.y * 10) / 10, vx: Math.round(bp2.vx * 100) / 100, vy: Math.round(bp2.vy * 100) / 100, f: bp2.face, a: bp2.alive ? 1 : 0, m: Math.round(bp2.maxH), ps: flags(bp2) });
        if (!bp2.alive && !bp2.netDead) { bp2.netDead = true; send("ev", { e: "dead", b: bp2.pid, m: metersOf(bp2), why: bp2.why || "fall" }); }
      }
      if (rows.length) send("sb", { s: rows });
    }
    for (var bi = 0; bi < w.platforms.length; bi++) {
      var bp = w.platforms[bi];
      if (bp.netTell) { bp.netTell = 0; send("ev", { e: "brk", id: bp.seq, k: bp.netKind || "break" }); }
    }
    for (var ci = 0; ci < w.coins.length; ci++) {
      var cn0 = w.coins[ci];
      if (cn0.netTell) { cn0.netTell = 0; send("ev", { e: "coin", i: cn0.idx != null ? cn0.idx : ci }); }
    }
    for (var ii = 0; ii < w.items.length; ii++) {
      var it0 = w.items[ii];
      if (it0.netTell) { it0.netTell = 0; send("ev", { e: "item", i: it0.idx != null ? it0.idx : ii }); }
    }
    for (var k = 0; k < w.monsters.length; k++) {
      var mo = w.monsters[k];
      if (!mo.alive && !mo.netSent) { mo.netSent = true; if (!mo.netRemote) send("ev", { e: "mob", id: mobId(mo) }); }
    }
    var rt = serverNow() - NET_DELAY_MS;
    for (var i = 1; i < w.players.length; i++) { var p = w.players[i]; if (p.remote) interp(p, N.buf[p.pid], rt); }
    while (N.events.length) {
      var e = N.events.shift(), rp = byPid(w, e.pid);
      if (e.e === "mob") {
        for (var j = 0; j < w.monsters.length; j++) {
          var m2 = w.monsters[j];
          if (m2.alive && mobId(m2) === e.id) { m2.alive = false; m2.squish = 10; m2.netRemote = true; m2.netSent = true; spawnParts(w, m2.x + m2.w / 2, m2.y + 4, 10, "#ffd070", 2.4, 0.15); }
        }
      } else if (e.e === "dead" && rp) {
        if (rp.alive) { rp.alive = false; rp.why = e.why || "fall"; spawnParts(w, rp.x + 6, rp.y + 8, 10, rp.look.hood, 2.6, 0.1); }
        rp.maxH = Math.max(rp.maxH, (e.m || 0) * PX_PER_M);
        toast(w, rp.name + " ВЫБЫЛ");
      }       else if (e.e === "left" && rp) { rp.alive = false; rp.why = "left"; }
      else if (e.e === "brk" || e.e === "rst") applyPlatNet(w, e.id, e.e);
      else if (e.e === "coin") {
        var ci2 = e.i | 0, cn2 = w.coins[ci2];
        if (cn2 && !cn2.taken) { cn2.taken = true; spawnParts(w, cn2.x + 3, cn2.y + 3, 6, "#ffe07a", 1.8, 0, 1); }
      } else if (e.e === "item") {
        var ii2 = e.i | 0, it2 = w.items[ii2];
        if (it2 && !it2.taken) { it2.taken = true; it2.popT = 8; spawnParts(w, it2.x + 4, it2.y + 4, 6, "#ffd046", 1.6, 0, 1); }
      }
    }
    /* After death, follow the watched player: their camera, and the events above (coins, mobs, platforms). */
    if (!me0.alive) {
      var tgt = watchOf(w);
      if (tgt) { w.cameraY = tgt.camY; w.watchName = tgt.name || ""; w.watchM = metersOf(tgt); generateUntil(w, w.cameraY - 80); }
    }
    if (N.results && N.results.round === w.netRound && w.phase === "play") {
      var R = N.results.ranking;
      for (var r = 0; r < R.length; r++) { var pp = byPid(w, R[r].pid); if (pp) pp.maxH = Math.max(pp.maxH, R[r].m * PX_PER_M); }
      finish(w);
      for (var r2 = 0; r2 < R.length; r2++) { var p3 = byPid(w, R[r2].pid); if (p3) p3.place = R[r2].place; }
    }
  };
  function applyPlatNet(w: any, id: number, kind: string) {
    var idn = id | 0;
    if (idn < 0) return;
    var pl: any = null;
    for (var i = 0; i < w.platforms.length; i++) if (w.platforms[i].seq === idn) { pl = w.platforms[i]; break; }
    if (!pl) {
      if (!w.netBreaks) w.netBreaks = {};
      w.netBreaks[idn] = kind === "rst" ? "rst" : "brk";
      return;
    }
    if (pl.type !== "break" && pl.type !== "lava" && pl.type !== "bubble") return;
    if (kind === "brk") {
      if (pl.broken) return;
      pl.broken = true;
      pl.breakT = 14;
      spawnParts(w, pl.x + pl.w / 2, pl.y + 2, 8, C.brk, 2, 0.2, 2);
    } else {
      pl.broken = false;
      pl.breakT = 0;
      pl.restoreT = 16;
      spawnParts(w, pl.x + pl.w / 2, pl.y, 6, C.brkRim, 1.4, -0.04, 1);
    }
  }
  function byPid(w: any, pid: number) {
    if (pid === N.you) return w.players[0];
    for (var i = 1; i < w.players.length; i++) if (w.players[i].pid === pid) return w.players[i];
    return null;
  }
  /** Countdown / connection overlay on top of the play screen. */
  N.overlay = function (api: any, w: any) {
    var ctx = api.ctx;
    if (w.tick === 0 && w.netAt) {
      var left = Math.max(0, w.netAt - serverNow());
      var n = Math.ceil(left / 500);
      box(ctx, LW / 2 - 30, LH / 2 - 24, 60, 40, C.navy, C.gold);
      drawText(ctx, n > 0 ? String(n) : "ВПЕРЁД", LW / 2, LH / 2 - 14, C.gold, n > 0 ? 3 : 1, "center");
    }
    if (N.st === "reconnecting") {
      box(ctx, LW / 2 - 60, 24, 120, 13, "#4a1020", C.red);
      drawText(ctx, "ПЕРЕПОДКЛЮЧАЕМСЯ...", LW / 2, 27, C.cream, 1, "center");
    } else if (!w.players[0].alive && w.phase === "play") {
      var wn = w.watchName ? drawableChars(String(w.watchName)).slice(0, 10) : "";
      if (wn) {
        /* Who we watch and how high they are right now. */
        box(ctx, LW / 2 - 64, 24, 128, 22, C.navy, C.cream);
        if (N.api && N.api.markBox) N.api.markBox("watch", LW / 2 - 64, 24, 128, 22);
        drawText(ctx, "СМОТРИМ " + wn, LW / 2, 27, C.cream, 1, "center");
        drawText(ctx, (w.watchM || 0) + " М", LW / 2, 36, C.gold, 1, "center");
      } else {
        box(ctx, LW / 2 - 64, 24, 128, 13, C.navy, C.cream);
        drawText(ctx, "ЖДЁМ ОСТАЛЬНЫХ", LW / 2, 27, C.cream, 1, "center");
      }
    }
  };

  /* ---------- online screens (shell phase "net") ---------- */
  N.open = function (api: any) {
    N.api = api; N.err = "";
    if (N.st === "update") N.st = N.ws ? "online" : "off";
    if (N.room) { N.sub = "room"; return; }
    N.sub = "home";
    N.connect(function (ok: boolean) { if (!ok) N.sub = "home"; });
  };
  N.bind = function (api: any) { N.api = api; };
  function statusLine() {
    if (N.st === "online") return { t: "СЕРВЕР НА СВЯЗИ", c: C.mint };
    if (N.st === "connecting") return { t: "ПОДКЛЮЧАЕМСЯ...", c: C.gold };
    if (N.st === "reconnecting") return { t: "ПЕРЕПОДКЛЮЧАЕМСЯ...", c: C.gold };
    if (N.st === "off") return { t: "ПОДКЛЮЧАЕМСЯ...", c: C.gold };
    if (N.st === "unsupported") return { t: N.err || "МУЛЬТИПЛЕЕР НЕДОСТУПЕН В ЭТОЙ ВЕРСИИ", c: C.red, two: true };
    return { t: N.err || "НЕТ СВЯЗИ", c: C.red };
  }
  /* An idle socket that simply closed (iOS suspends the Mini App while you're in the chat; the server's 25 s ping
     then drops it) is not a network failure: reconnect quietly instead of showing a red «НЕТ СВЯЗИ». */
  function quietReconnect() {
    if (N.room || N.ws || N.probing) return;
    if (N.st === "off" || (N.st === "error" && N.sub === "home")) N.connect();
  }
  N.quietReconnect = quietReconnect;
  try {
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "visible" && N.api && N.api.phase() === "net") quietReconnect();
    });
  } catch (_e) {}
  N.draw = function (api: any) {
    N.api = api;
    if (N.sub === "home" && N.st === "off") quietReconnect();
    var ctx = api.ctx, x = api.colX(), sl = statusLine();
    api.bg();
    if (N.sub === "update" || N.st === "update") return drawUpdate(api, x);
    if (N.sub === "room" && N.room) return drawRoom(api, x);
    if (N.sub === "code") return drawCode(api, x);
    var hd = api.header("МУЛЬТИПЛЕЕР", 1);
    var subY = hd.bottom + 4;
    drawText(ctx, "ДО 4 ИГРОКОВ НА КАРТЕ", LW / 2, subY, C.cream, 1, "center");
    if (sl.two) {
      box(ctx, x, subY + 14, 152, 24, C.navy, sl.c);
      if (api.markBox) api.markBox("status", x, subY + 14, 152, 24);
      drawText(ctx, "МУЛЬТИПЛЕЕР НЕДОСТУПЕН", LW / 2, subY + 17, sl.c, 1, "center");
      drawText(ctx, "В ЭТОЙ ВЕРСИИ", LW / 2, subY + 27, sl.c, 1, "center");
    } else {
      box(ctx, x, subY + 14, 152, 13, C.navy, sl.c);
      if (api.markBox) api.markBox("status", x, subY + 14, 152, 13);
      drawText(ctx, sl.t, LW / 2, subY + 17, sl.c, 1, "center");
    }
    var y = subY + (sl.two ? 48 : 38);
    api.btn("net:name", x, y, 152, 20, "#1a1430", "ИМЯ: " + shownNick(), C.cream, 1, C.gold);
    y += 28;
    var ok = N.st === "online";
    api.btn("net:create", x, y, 152, 30, ok ? C.mint : "#3a3450", "СОЗДАТЬ КОМНАТУ", INK, 1);
    api.btn("net:enter", x, y + 36, 152, 30, ok ? C.gold : "#3a3450", "ВОЙТИ ПО КОДУ", INK, 1);
    if (!ok && N.st !== "connecting") api.btn("net:retry", x + 26, y + 72, 100, 20, C.navy, "ЕЩЁ РАЗ");
    api.btn("net:back", x + 26, LH - 34, 100, 22, C.navy, "НАЗАД");
  };
  function drawUpdate(api: any, x: number) {
    var ctx = api.ctx;
    api.header("МУЛЬТИПЛЕЕР", 1);
    box(ctx, x, Math.round(LH / 2 - 40), 152, 64, C.navy, C.gold);
    drawText(ctx, "ОБНОВИ", LW / 2, Math.round(LH / 2 - 28), C.gold, 2, "center");
    drawText(ctx, "СТРАНИЦУ", LW / 2, Math.round(LH / 2 - 10), C.gold, 2, "center");
    api.btn("net:back", x + 26, LH - 34, 100, 22, C.navy, "НАЗАД");
  }
  function drawCode(api: any, x: number) {
    var ctx = api.ctx;
    var hdCode = api.header("КОД КОМНАТЫ", 1);
    var codeY = hdCode.bottom + 4;
    for (var i = 0; i < 4; i++) {
      box(ctx, x + 14 + i * 32, codeY, 26, 30, C.navy, i === N.code.length ? C.gold : C.cream);
      if (api.markBox) api.markBox("digit" + i, x + 14 + i * 32, codeY, 26, 30);
      if (N.code[i]) drawText(ctx, N.code[i], x + 27 + i * 32, codeY + 8, C.cream, 2, "center");
    }
    var ky = codeY + 40, keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "<", "0", "OK"];
    for (var k = 0; k < 12; k++) {
      var cx = x + (k % 3) * 52, cy = ky + Math.floor(k / 3) * 34;
      var id = keys[k] === "<" ? "net:del" : keys[k] === "OK" ? "net:ok" : "net:k" + keys[k];
      api.btn(id, cx, cy, 48, 30, keys[k] === "OK" ? (N.code.length === 4 ? C.mint : "#3a3450") : "#1a1430", keys[k] === "OK" ? "ВОЙТИ" : keys[k], keys[k] === "OK" ? INK : C.cream, keys[k] === "OK" ? 1 : 2);
    }
    if (N.err) drawText(ctx, cleanText(N.err, 24), LW / 2, ky + 140, C.red, 1, "center");
    api.btn("net:home", x + 26, LH - 34, 100, 22, C.navy, "НАЗАД");
  }
  function drawRoom(api: any, x: number) {
    var ctx = api.ctx, R = N.room, host = N.isHost(), mine = N.mePlayer();
    var y0 = api.belowBand ? api.belowBand() : 20;
    box(ctx, x, y0, 152, 34, C.navy, C.gold);
    if (api.markBox) api.markBox("room", x, y0, 152, 34);
    drawText(ctx, "КОМНАТА", LW / 2, y0 + 4, C.cream, 1, "center");
    drawText(ctx, R.code, LW / 2, y0 + 14, C.gold, 2, "center");
    drawText(ctx, "СКАЖИ КОД ДРУЗЬЯМ", LW / 2, y0 + 38, "#9a8ab8", 1, "center");
    var sorted = R.players.slice().sort(function (a: any, b: any) { return a.slot - b.slot; });
    var row0 = y0 + 50;
    /* Keep 23px rows so the evening table still fits 6 names. Portrait is a 1:1 21×21 crop, no scale. */
    for (var i = 0; i < 4; i++) {
      var y = row0 + i * 26, p = sorted[i];
      if (!p) {
        if (host) api.btn("net:addbot", x, y, 152, 23, "#1a1430", "БОТ +", C.cream);
        else { box(ctx, x, y, 152, 23, "#141030", "#3a3450"); drawText(ctx, "СВОБОДНО", LW / 2, y + 8, "#5a4c82", 1, "center"); }
        continue;
      }
      var isMe = p.pid === N.you;
      var rim = isMe ? C.gold : p.ready || p.bot ? C.mint : !p.on ? C.red : C.cream;
      box(ctx, x, y, 152, 23, isMe ? "#2a2050" : C.navy, rim);
      if (api.markBox) api.markBox("slot" + i, x, y, 152, 23);
      drawPortraitCrop(ctx, p.kind, x + 1, y + 1, 21);
      var heroNm = (CHARS[p.kind] && CHARS[p.kind].name || "").toUpperCase();
      var slotLab = p.bot ? slotLabel(p.name || "БОТ", heroNm, host ? 84 : 104) : slotLabel(p.name, heroNm, host && !isMe ? 84 : 104);
      drawText(ctx, slotLab, x + 26, y + 8, C.cream, 1, "left");
      if (host && !isMe) api.btn("net:kick" + p.pid, x + 128, y + 4, 18, 15, "#1a1430", "X", C.cream);
    }
    var my = row0 + 4 * 26 + 4;
    if (host) {
      api.btn("net:mprev", x, my, 20, 18, "#1a1430", "<", C.cream);
      api.btn("net:mnext", x + 132, my, 20, 18, "#1a1430", ">", C.cream);
    }
    box(ctx, x + 22, my, 108, 18, C.navy, C.cream);
    drawText(ctx, "КАРТА: " + mapInfo(R.map).name, LW / 2, my + 6, C.gold, 1, "center");
    api.btn("net:hero", x, my + 22, 152, 18, "#1a1430", "ГЕРОЙ: " + CHARS[api.save().char].name.toUpperCase() + " ▶", C.cream, 1, C.gold);
    var leaveY = LH - 26;
    var by = leaveY - 30;
    if (N.session && N.session.rounds && N.session.rounds.length && my + 44 < by - 16) N.drawEvening(ctx, x, my + 44, by - 2);
    if (host) {
      var others = R.players.filter(function (q: any) { return q.pid !== R.host && q.on && !q.bot; });
      var allReady = others.every(function (q: any) { return q.ready; });
      var lab = R.players.length < 2 ? "НАЧАТЬ ОДНОМУ" : allReady ? "НАЧАТЬ" : "ЖДЁМ ГОТОВНОСТИ";
      api.btn("net:start", x, by, 152, 26, allReady ? C.mint : "#3a3450", lab, INK, 1);
    } else {
      var rd = mine && mine.ready;
      api.btn("net:ready", x, by, 152, 26, rd ? C.mint : C.gold, rd ? "ГОТОВ ✓" : "Я ГОТОВ", INK, 1);
    }
    if (N.st === "reconnecting") drawText(ctx, "ПЕРЕПОДКЛЮЧАЕМСЯ...", LW / 2, by - 10, C.gold, 1, "center");
    api.btn("net:leave", x, leaveY, 152, 22, C.navy, "ВЫЙТИ");
  }
  function slotLabel(name: string, hero: string, maxW: number) {
    var suffix = hero ? " · " + hero : "";
    var room = maxW - textWidth(suffix, 1);
    var nm = drawableChars(String(name || ""));
    while (nm.length > 1 && textWidth(nm, 1) > room) nm = nm.slice(0, -1);
    if (!nm) nm = "HOPP";
    return nm + suffix;
  }
  function watchOf(w: any) {
    var list: any[] = [];
    for (var i = 1; i < w.players.length; i++) if (w.players[i].alive) list.push(w.players[i]);
    if (!list.length) return null;
    if (w.watchP && w.watchP.alive && list.indexOf(w.watchP) >= 0) return w.watchP;
    w.watchP = list[0];
    return w.watchP;
  }
  N.cycleWatch = function (w: any, dir: number) {
    var list: any[] = [];
    for (var i = 1; i < w.players.length; i++) if (w.players[i].alive) list.push(w.players[i]);
    if (!list.length) return;
    var cur = list.indexOf(w.watchP);
    if (cur < 0) cur = 0;
    else cur = (cur + (dir < 0 ? list.length - 1 : 1)) % list.length;
    w.watchP = list[cur];
  };
  N.tap = function (id: string, api: any) {
    N.api = api;
    if (id === "net:menu") { api.setPhase("net"); N.open(api); return; }
    if (id === "net:back") { api.goMenu(); return; }
    if (id === "net:retry") { N.err = ""; N.connect(); return; }
    if (id === "net:evup") { N.evOff = Math.max(0, (N.evOff || 0) - 1); return; }
    if (id === "net:addbot") { send("bot", {}); return; }
    if (id.indexOf("net:kick") === 0) { send("kick", { pid: parseInt(id.slice(8), 10) }); return; }
    if (id === "net:name") {
      var cur = shownNick();
      var v = typeof window !== "undefined" && window.prompt ? window.prompt("Имя для друзей (до 10 букв)", cur) : null;
      if (v != null) {
        var c = cleanNick(v);
        /* Saving the default back unchanged keeps following the Telegram name; anything else is the player's own. */
        var keep = c && c !== defaultNick() ? c : "";
        try { localStorage.setItem("hoppak.nick", keep); } catch (_e) {}
        if (!c && v) api.say("ТАКИЕ БУКВЫ НЕ ПОДХОДЯТ");
      }
      /* The keyboard may have resized the webview: settle the layout once it is gone. */
      if (api.relayout) { setTimeout(api.relayout, 300); setTimeout(api.relayout, 1300); }
      return;
    }
    if (id === "net:create") { if (N.st !== "online") { N.connect(); return; } N.create(); return; }
    if (id === "net:enter") { if (N.st !== "online") { N.connect(); return; } N.code = ""; N.err = ""; N.sub = "code"; return; }
    if (id === "net:home") { N.sub = "home"; N.err = ""; return; }
    if (id.indexOf("net:k") === 0) { if (N.code.length < 4) N.code += id.slice(5); N.err = ""; return; }
    if (id === "net:del") { N.code = N.code.slice(0, -1); return; }
    if (id === "net:ok") { if (N.code.length === 4) N.join(N.code); return; }
    if (id === "net:ready") { var m = N.mePlayer(); send("ready", { ready: !(m && m.ready) }); return; }
    if (id === "net:start") {
      /* The button already says ЖДЁМ ГОТОВНОСТИ; don't fire a start the server will refuse (its toast covered the lobby). */
      var R0 = N.room, notReady = R0 && R0.players.some(function (q: any) { return q.pid !== R0.host && q.on && !q.bot && !q.ready; });
      if (notReady) return;
      send("start", {}); return;
    }
    if (id === "net:mprev" || id === "net:mnext") {
      var om = api.openMaps(), li = Math.max(0, om.indexOf(N.room.map));
      if (om.indexOf(N.room.map) < 0) om = om.concat([N.room.map]);
      send("map", { map: om[mod(li + (id === "net:mnext" ? 1 : -1), om.length)] }); return;
    }
    if (id === "net:hero") {
      var s = api.save(), k = s.char;
      for (var n = 1; n <= CHARS.length; n++) { var kk = mod(s.char + n, CHARS.length); if (api.heroOwned(kk)) { k = kk; break; } }
      s.char = k; api.saveNow(); send("hero", { kind: k }); return;
    }
    if (id === "net:leave") { N.leave(); N.sub = "home"; return; }
    if (id === "net:rematch") { api.setPhase("net"); N.sub = N.room ? "room" : "home"; return; }
  };
  /* resume a session after a page reload (iOS likes to reload backgrounded tabs) */
  N.tryResume = function (api: any) {
    N.api = api;
    if (!load("hoppak.net.token")) return;
    N.st = "reconnecting"; N.reconUntil = now() + NET_GRACE_MS;
    N.connect();
  };
  return N;
})();

/* ---------------- Player profile (guest token + server sync) ----------------
   Targets feat/profile-db @ 2284797 and supports feat/profile-server-v06
   (best, runId, /api/profile/buy, POST /api/auth/telegram). Keeps local save
   working offline or on 503. Telegram Mini App login runs once per session
   when Telegram.WebApp.initData is present; errors stay on the guest profile.
   All logic lives here; 04_shell.tsx only calls PROFILE.init / finishRun / buy. */

var PROFILE: any = (function () {
  var TOKEN_KEY = "hoppak_guest_token";
  var QUEUE_KEY = "hoppak_profile_queue";
  var BUYS_KEY = "hoppak_profile_buys";
  var CACHE_KEY = "hoppak_profile_cache";
  var REQ_MS = 5000;
  var RUN_HEIGHT_MAX = 20000;
  var RUN_COINS_MAX = 15801;
  var RUN_BONUS_MAX = 2500;
  var HEIGHT_AWARD_MIN = 100;
  var P: any = {
    st: "idle", /* idle | syncing | ready | offline | unavailable */
    profile: null as any,
    api: null as any,
    queue: null as any,
    buySupported: null as any, /* null = unknown | true | false (404 on 2284797) */
    backoffMs: 5000,
    retryTimer: 0,
    onlineBound: false,
    tgTried: false,
    live: false /* a profile was applied in this page load: the session is established */
  };

  function lsGet(k: string): string {
    try { return (typeof localStorage !== "undefined" && localStorage.getItem(k)) || ""; } catch (_e) { return ""; }
  }
  function lsSet(k: string, v: string) {
    try {
      if (typeof localStorage === "undefined") return;
      if (v) localStorage.setItem(k, v);
      else localStorage.removeItem(k);
    } catch (_e) {}
  }
  function readJson(k: string, def: any) {
    try {
      var raw = lsGet(k);
      if (!raw) return def;
      var parsed = JSON.parse(raw);
      return parsed == null ? def : parsed;
    } catch (_e) { return def; }
  }
  function writeJson(k: string, val: any) {
    try { lsSet(k, JSON.stringify(val)); } catch (_e) {}
  }

  function getToken(): string { return lsGet(TOKEN_KEY); }
  function setToken(t: string) { lsSet(TOKEN_KEY, t); }
  /* Forget a token only if it is still the stored one: another tab of this same browser may already have logged in
     again and stored a newer token, which must survive (that is the same client, not a second device). */
  function dropToken(used: string) { if (!used || getToken() === used) setToken(""); }

  function getRunQueue(): any[] {
    var q = readJson(QUEUE_KEY, []);
    return Array.isArray(q) ? q : [];
  }
  function setRunQueue(q: any[]) {
    if (q.length > 50) q = q.slice(q.length - 50);
    writeJson(QUEUE_KEY, q);
  }

  function getPendingBuys(): any[] {
    var b = readJson(BUYS_KEY, []);
    return Array.isArray(b) ? b : [];
  }
  function setPendingBuys(b: any[]) {
    writeJson(BUYS_KEY, b);
  }

  function pruneConfirmedBuys(prof: any) {
    var owned = (prof && prof.purchases) || {};
    var buys = getPendingBuys();
    var next: any[] = [];
    var seen: any = {};
    for (var i = 0; i < buys.length; i++) {
      var it = buys[i];
      if (!it || !it.key || seen[it.key] || owned[it.key]) continue;
      seen[it.key] = 1;
      next.push(it);
    }
    if (next.length !== buys.length) setPendingBuys(next);
    return next;
  }

  function pendingSpend(): number {
    var buys = getPendingBuys();
    var tot = 0;
    for (var i = 0; i < buys.length; i++) {
      tot += Math.max(0, Math.floor(Number(buys[i] && buys[i].price) || 0));
    }
    return tot;
  }

  function queuedEst(): number {
    var q = getRunQueue();
    var tot = 0;
    for (var i = 0; i < q.length; i++) {
      tot += Math.max(0, Math.floor(Number(q[i] && q[i].estAward) || 0));
    }
    return tot;
  }

  function computeAward(height: number, runCoins: number, bonusCoins: number): any {
    var rawH = Math.max(0, Math.floor(Number(height) || 0));
    var rawC = Math.max(0, Math.floor(Number(runCoins) || 0));
    var rawB = Math.max(0, Math.floor(Number(bonusCoins) || 0));
    var h = Math.min(rawH, RUN_HEIGHT_MAX);
    var c = Math.min(rawC, RUN_COINS_MAX);
    var b = Math.min(rawB, RUN_BONUS_MAX);
    var heightPay = h >= HEIGHT_AWARD_MIN ? Math.floor(h / 25) : 0;
    var limited = "";
    if (rawH > RUN_HEIGHT_MAX) limited = "HEIGHT_CAP";
    else if (rawC > RUN_COINS_MAX) limited = "COINS_CAP";
    else if (rawB > RUN_BONUS_MAX) limited = "BONUS_CAP";
    else if (h < HEIGHT_AWARD_MIN) limited = "HEIGHT_MIN";
    var awarded = heightPay + c + b;
    return { want: awarded, awarded: awarded, limited: limited };
  }

  function pendingBuyKeys(): any {
    var out: any = {};
    var buys = getPendingBuys();
    for (var i = 0; i < buys.length; i++) if (buys[i] && buys[i].key) out[buys[i].key] = 1;
    return out;
  }

  function readInitData(): string {
    try {
      var w: any = typeof window !== "undefined" ? window : null;
      var d = w && w.Telegram && w.Telegram.WebApp && w.Telegram.WebApp.initData;
      if (typeof d === "string" && d) return d;
    } catch (_e) {}
    return "";
  }

  /* Once per session. 503 / 401 / 409 / network: stay on the guest profile, do not loop. */
  /* index.staging.html loads the Telegram SDK async and exposes window.__tgReady. */
  function waitTelegramSdk(): Promise<any> {
    try {
      var w: any = typeof window !== "undefined" ? window : null;
      if (w && w.__tgReady && typeof w.__tgReady.then === "function") return w.__tgReady;
    } catch (_e) {}
    return Promise.resolve(null);
  }

  function tryTelegramAuth(token: string): Promise<any> {
    if (P.tgPending) return P.tgPending;
    if (P.tgTried) return Promise.resolve(null);
    var run = function () { return tryTelegramAuthNow(token); };
    P.tgPending = waitTelegramSdk().then(run, run).then(function (r: any) { P.tgPending = null; return r; }, function (e: any) { P.tgPending = null; throw e; });
    return P.tgPending;
  }

  function tryTelegramAuthNow(token: string): Promise<any> {
    if (P.tgTried) return Promise.resolve(null);
    var initData = readInitData();
    if (!initData || !token) return Promise.resolve(null);
    P.tgTried = true;
    return req("POST", "/api/auth/telegram", { initData: initData }, token).then(function (res: any) {
      if (!res || !res.ok || !res.data || !res.data.ok || !res.data.profile) return null;
      if (res.data.token) setToken(res.data.token);
      P.st = "ready";
      applyProfile(res.data.profile);
      if (P.api && P.api.sessionOk) P.api.sessionOk();
      if (res.data.merged && P.api && P.api.say) P.api.say("ПРОГРЕСС ОБЪЕДИНЁН");
      return res.data;
    });
  }

  function makeRunId(): string {
    var r = "";
    try {
      if (typeof crypto !== "undefined" && crypto.getRandomValues) {
        var u = new Uint32Array(2);
        crypto.getRandomValues(u);
        r = u[0].toString(36) + u[1].toString(36);
      }
    } catch (_e) {}
    if (!r) r = Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6);
    return "r_" + Date.now().toString(36) + "_" + r;
  }

  function normalizeOrigin(raw: string): string {
    var o = String(raw || "").trim();
    if (!o) return "";
    if (o.indexOf("wss://") === 0) o = "https://" + o.slice(6);
    else if (o.indexOf("ws://") === 0) o = "http://" + o.slice(5);
    if (o.indexOf("https://") !== 0 && o.indexOf("http://") !== 0) return "";
    o = o.replace(/\/+$/, "");
    if (o.length > 3 && o.slice(-3) === "/ws") o = o.slice(0, -3);
    if (o.length > 4 && o.slice(-4) === "/api") o = o.slice(0, -4);
    return o.replace(/\/+$/, "");
  }

  function apiOrigin(): string {
    var w: any = typeof window !== "undefined" ? window : null;
    if (!w) return "";
    try {
      var sp = new URLSearchParams(w.location.search);
      var qa = sp.get("api") || sp.get("profileApi");
      if (qa) { var qan = normalizeOrigin(qa); if (qan) return qan; }
      if (w.HOPPAK_API) { var wan = normalizeOrigin(w.HOPPAK_API); if (wan) return wan; }
      var lsa = w.localStorage && w.localStorage.getItem("hoppak.api");
      if (lsa) { var lsan = normalizeOrigin(lsa); if (lsan) return lsan; }
    } catch (_e) {}
    try {
      if (typeof HOP_API !== "undefined" && HOP_API) {
        var ban = normalizeOrigin(String(HOP_API));
        if (ban) return ban;
      }
    } catch (_e1) {}
    var isPage = false;
    try { isPage = typeof HOP_PAGE !== "undefined" && !!HOP_PAGE; } catch (_e2) {}
    if (!isPage) {
      try {
        var pr = w.location && w.location.protocol;
        if (pr === "http:" || pr === "https:") return w.location.origin;
      } catch (_e3) {}
    }
    try {
      var qs = new URLSearchParams(w.location.search).get("server");
      if (qs) { var qn = normalizeOrigin(qs); if (qn) return qn; }
      if (w.HOPPAK_SERVER) { var wn = normalizeOrigin(w.HOPPAK_SERVER); if (wn) return wn; }
      var ls = w.localStorage && w.localStorage.getItem("hoppak.server");
      if (ls) { var ln = normalizeOrigin(ls); if (ln) return ln; }
      if (isPage && typeof HOP_SERVER !== "undefined" && HOP_SERVER) {
        var bn = normalizeOrigin(String(HOP_SERVER));
        if (bn) return bn;
      }
    } catch (_e4) {}
    return "";
  }

  function req(method: string, path: string, body?: any, token?: string) {
    var base = apiOrigin();
    if (!base || typeof fetch === "undefined") {
      return Promise.resolve({ status: 0, ok: false, data: null });
    }
    var ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
    var to = setTimeout(function () { try { if (ctrl) ctrl.abort(); } catch (_e) {} }, REQ_MS);
    var headers: any = {};
    if (token) headers["Authorization"] = "Bearer " + token;
    var sameOrig = false;
    try { sameOrig = typeof window !== "undefined" && window.location && window.location.origin === base; } catch (_e0) {}
    var opts: any = { method: method, headers: headers, cache: "no-store", mode: sameOrig ? "same-origin" : "cors" };
    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
      opts.body = JSON.stringify(body);
    }
    if (ctrl) opts.signal = ctrl.signal;
    return fetch(base + path, opts).then(function (r: any) {
      clearTimeout(to);
      return r.json().catch(function () { return null; }).then(function (data: any) {
        if (r.status === 401 && data && data.error === "SESSION_REPLACED") noteReplaced(token || "");
        return { status: r.status, ok: !!r.ok, data: data };
      });
    }).catch(function () {
      clearTimeout(to);
      return { status: 0, ok: false, data: null };
    });
  }

  /* SESSION_REPLACED = this token was rotated by a login somewhere else.
     - The stored token is newer than the one used: another tab of this same browser already logged in again.
       Same client, not a second device: no banner, the next request just uses the stored token.
     - The page has not established a session yet (the app was just opened with an old token): opening it is an
       explicit take-over, so log in again quietly (ensureProfile does) and show nothing.
     - Only a session that was running and then got replaced shows the banner. */
  function noteReplaced(usedTok: string) {
    var cur = getToken();
    if (usedTok && cur && cur !== usedTok) return;
    if (!P.live) return;
    if (P.replaced) return;
    P.replaced = true;
    var tok = getToken();
    if (P.api && P.api.sessionReplaced) P.api.sessionReplaced();
    var done = tok ? flushRunsStep(tok, true) : Promise.resolve(null);
    Promise.resolve(done).then(function () { dropToken(tok); return ensureProfile(); }).then(function () { P.replaced = false; }, function () { P.replaced = false; });
  }
  /* The game server refused a socket because its login was replaced (another device took the account). */
  P.serverSaysReplaced = function () {
    if (!P.live || P.replaced) return false;
    noteReplaced(getToken());
    return true;
  };
  /* Coming back to the app (a suspended phone Mini App): ask the server once whether this login is still the active one.
     A replaced login answers SESSION_REPLACED and shows the banner, instead of staying silent until the next request. */
  P.recheck = function () {
    if (!P.live || P.replaced) return;
    var tok = getToken();
    var t = Date.now();
    if (!tok || t - (P.lastCheck || 0) < 3000) return;
    P.lastCheck = t;
    req("GET", "/api/profile", undefined, tok);
  };
  /* Presence: while a session is live and the page is visible, a heartbeat every 25 s keeps last_seen_at / "online" fresh on the server.
     A replaced login answers SESSION_REPLACED, so the first device also finds out here (banner through req). Hiding or closing the page
     sends an exit beacon (fetch keepalive); the next heartbeat makes the player online again. */
  var BEAT_MS = 25000;
  function tgPlatform() {
    try { var w: any = window; return w.Telegram && w.Telegram.WebApp && w.Telegram.WebApp.platform ? String(w.Telegram.WebApp.platform).slice(0, 16) : "web"; } catch (_e) { return "web"; }
  }
  P.beat = function () {
    if (!P.live || P.replaced) return;
    var tok = getToken();
    if (!tok) return;
    if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
    req("POST", "/api/profile/seen", { v: "0.6rc", p: tgPlatform() }, tok);
  };
  P.exit = function () {
    if (!P.live || P.replaced) return;
    var tok = getToken();
    var base = apiOrigin();
    if (!tok || !base || typeof fetch === "undefined") return;
    try {
      fetch(base + "/api/profile/seen", {
        method: "POST", keepalive: true, cache: "no-store",
        headers: { "Authorization": "Bearer " + tok, "Content-Type": "application/json" },
        body: JSON.stringify({ exit: true }),
      }).catch(function () {});
    } catch (_eX) {}
  };
  try {
    if (typeof document !== "undefined" && document.addEventListener) {
      document.addEventListener("visibilitychange", function () {
        if (document.visibilityState === "visible") { P.recheck(); P.beat(); }
        else P.exit();
      });
      window.addEventListener("pagehide", function () { P.exit(); });
      setInterval(P.beat, BEAT_MS);
    }
  } catch (_eV) {}

  function applyProfile(prof: any, wRef?: any, awarded?: number, limited?: string) {
    if (!prof) return;
    P.profile = prof;
    P.live = true;
    writeJson(CACHE_KEY, prof);
    pruneConfirmedBuys(prof);
    var effectiveCoins = Math.max(0, (prof.coins || 0) - pendingSpend()) + queuedEst();
    if (P.api && P.api.apply) P.api.apply(prof, wRef, awarded, effectiveCoins, limited);
  }

  function handleStatus(res: any): boolean {
    if (res.status === 503 || (res.data && res.data.error === "PROFILE_UNAVAILABLE")) {
      P.st = "unavailable";
      return false;
    }
    if (!res.ok || !res.data || !res.data.ok) {
      if (res.status === 0 || res.status >= 500) P.st = "offline";
      return false;
    }
    return true;
  }

  function scheduleRetry(delayMs: number) {
    if (typeof setTimeout === "undefined") return;
    if (P.retryTimer) { clearTimeout(P.retryTimer); P.retryTimer = 0; }
    var d = Math.max(250, delayMs);
    P.retryTimer = setTimeout(function () {
      P.retryTimer = 0;
      P.flush();
    }, d);
  }

  function localCampaign() {
    var s = P.api && P.api.save ? P.api.save() : null;
    var mapBest = (s && s.mapBest && typeof s.mapBest === "object") ? s.mapBest : {};
    var open: any = {};
    var owned = (s && s.owned && typeof s.owned === "object") ? s.owned : {};
    for (var k in owned) if (owned[k] && String(k).indexOf("map:") === 0) open[k] = 1;
    return { mapBest: mapBest, open: open };
  }
  function syncCampaign(token: string, fallback: any, bodySnap?: any) {
    var body = bodySnap || localCampaign();
    return req("POST", "/api/profile/campaign", body, token).then(function (res: any) {
      if (!handleStatus(res) || !res.data || !res.data.profile) {
        if (fallback) { P.st = "ready"; applyProfile(fallback); }
        return fallback;
      }
      P.st = "ready";
      applyProfile(res.data.profile);
      return res.data.profile;
    });
  }
  function syncMigrate(token: string, prof: any, coinSnap?: number) {
    var s = P.api && P.api.save ? P.api.save() : null;
    var rawCoins = typeof coinSnap === "number"
      ? coinSnap
      : (s && typeof s.coins === "number" ? Math.max(0, Math.floor(s.coins)) : 0);
    var coins = Math.max(0, rawCoins - queuedEst());
    var purchases = (s && s.owned && typeof s.owned === "object") ? s.owned : {};
    var best = s && typeof s.best === "number" ? Math.max(0, Math.floor(s.best)) : 0;
    var migrated = !prof || prof.migratedAt;
    var step = migrated
      ? Promise.resolve(prof)
      : req("POST", "/api/profile/migrate", { coins: coins, purchases: purchases, best: best }, token).then(function (res: any) {
        if (!handleStatus(res)) return null;
        return res.data.profile;
      });
    return step.then(function (ready: any) {
      if (!ready) return null;
      return syncCampaign(token, ready);
    });
  }

  function createGuest() {
    /* The save at the moment the request leaves. A newer save means this guest
       belongs to a wallet we already discarded, so its token must not come back. */
    var stamp = lsGet("hoppak_save");
    return req("POST", "/api/profile/guest").then(function (res: any) {
      if (!handleStatus(res)) return null;
      if (lsGet("hoppak_save") !== stamp) return null;
      if (res.data.token) setToken(res.data.token);
      return { token: res.data.token || getToken(), profile: res.data.profile };
    });
  }
  function ensureProfile(deferCoins: boolean) {
    var base = apiOrigin();
    if (!base || typeof fetch === "undefined") {
      P.st = "offline";
      return Promise.resolve(null);
    }
    P.st = "syncing";
    var tok = getToken();
    var finish = function (token: string, prof: any) {
      return deferCoins ? Promise.resolve(prof) : syncMigrate(token, prof);
    };
    if (tok) {
      return req("GET", "/api/profile", undefined, tok).then(function (res: any) {
        if (res.status === 401) {
          var newer = getToken();
          if (newer && newer !== tok && !P.adopted) {
            /* Another tab of this browser logged in again meanwhile: use its token, don't make a second guest. */
            P.adopted = true;
            return ensureProfile(deferCoins);
          }
          dropToken(tok);
          return createGuest().then(function (made: any) {
            if (!made) return null;
            return finish(made.token, made.profile);
          });
        }
        if (!handleStatus(res)) return null;
        return finish(tok, res.data.profile);
      });
    }
    return createGuest().then(function (made: any) {
      if (!made) return null;
      return finish(made.token, made.profile);
    });
  }

  function syncRecords(tok: string): Promise<void> {
    if (!tok) return Promise.resolve();
    return req("POST", "/api/profile/campaign", localCampaign(), tok).then(function (res: any) {
      if (res.status === 404 || res.status === 405 || res.status === 501) return;
      if (!handleStatus(res) || !res.data || !res.data.profile) return;
      applyProfile(res.data.profile);
    }, function () { return; });
  }
  function flushBuysOnce(tok: string): Promise<void> {
    if (P.buySupported === false) return Promise.resolve();
    var buys = getPendingBuys();
    if (!buys.length || !tok) return Promise.resolve();
    var item = buys[0];
    return req("POST", "/api/profile/buy", { key: item.key }, tok).then(function (res: any) {
      if (res.status === 404 || res.status === 405 || res.status === 501) {
        P.buySupported = false;
        return;
      }
      if (res.status === 401) {
        dropToken(tok);
        return;
      }
      if (res.status === 400) {
        // INVALID_ITEM or INSUFFICIENT_COINS — drop the optimistic buy and put the server wallet back.
        var cur = getPendingBuys().filter(function (x: any) { return x && x.key !== item.key; });
        setPendingBuys(cur);
        var rolled = P.profile;
        if (res.data && typeof res.data.coins === "number") {
          rolled = Object.assign({}, P.profile || {}, { coins: Math.max(0, Math.floor(res.data.coins)) });
          if (!rolled.purchases) rolled.purchases = {};
        }
        if (rolled) applyProfile(rolled);
        return flushBuysOnce(tok);
      }
      if (!handleStatus(res)) return;
      P.buySupported = true;
      P.st = "ready";
      var rest = getPendingBuys().filter(function (x: any) { return x && x.key !== item.key; });
      setPendingBuys(rest);
      applyProfile(res.data.profile);
      if (rest.length) return flushBuysOnce(tok);
    });
  }

  var runRefs: any = {};
  var startInflight: any = {};
  var startDone: any = {};
  function postStart(id: string, map: string, hero: number, tok: string) {
    return req("POST", "/api/run/start", { runId: id, map: map || "", hero: hero == null ? 0 : hero }, tok).then(function (res: any) {
      if (res && res.ok && res.data && res.data.ok) startDone[id] = 1;
      return res;
    });
  }
  function markStarted(runId: string) {
    startDone[runId] = 1;
    var q = getRunQueue();
    var changed = false;
    for (var i = 0; i < q.length; i++) if (q[i] && q[i].runId === runId && !q[i].started) { q[i].started = 1; changed = true; }
    if (changed) setRunQueue(q);
  }
  /** Start must land before finish, including after a reload. A 404 means an old server without the route. */
  function ensureStart(head: any, tok: string) {
    if (!head || !head.runId) return Promise.resolve("nostart");
    if (head.started) startDone[head.runId] = 1;
    if (startDone[head.runId]) return Promise.resolve("ok");
    var pending = startInflight[head.runId] || Promise.resolve(null);
    return pending.then(function (res: any) {
      if (startDone[head.runId]) { markStarted(head.runId); return "ok"; }
      if (res && (res.status === 404 || res.status === 405 || res.status === 501)) return "skip";
      if (res && res.status === 401) return "auth";
      if (!tok) return "later";
      return postStart(head.runId, head.map || "", head.hero, tok).then(function (again: any) {
        if (startDone[head.runId]) { markStarted(head.runId); return "ok"; }
        if (again && (again.status === 404 || again.status === 405 || again.status === 501)) return "skip";
        if (again && again.status === 401) return "auth";
        return "later";
      });
    });
  }
  function worldOf(head: any) {
    if (!head) return null;
    return head._wRef || runRefs[head.runId] || null;
  }
  function markRun(head: any, code: string) {
    var w = worldOf(head);
    if (w) w.limited = code;
  }
  function markQueued(code: string) {
    var q = getRunQueue();
    for (var i = 0; i < q.length; i++) markRun(q[i], code);
  }

  function flushRunsStep(tok: string, authRetried?: boolean): Promise<any> {
    var q = getRunQueue();
    if (!q.length) return Promise.resolve(null);
    var head = q[0];
    var body: any = {
      runId: head.runId,
      height: head.height,
      runCoins: head.runCoins,
      bonusCoins: head.bonusCoins
    };
    if (head.mode) body.mode = head.mode;
    if (head.map) body.map = head.map;
    if (head.ver) body.ver = head.ver;
    if (head.hero != null) body.hero = head.hero;

    return ensureStart(head, tok).then(function (started: string) {
      if (started === "later") {
        markRun(head, "OFFLINE");
        var waitS = P.backoffMs;
        P.backoffMs = Math.min(60000, P.backoffMs * 2);
        scheduleRetry(waitS);
        return null;
      }
      return req("POST", "/api/run/finish", body, tok);
    }).then(function (res: any) {
      if (!res) return null;
      if (res.status === 401) {
        dropToken(tok);
        if (!authRetried) {
          return ensureProfile().then(function () {
            var nt = getToken();
            return nt ? flushRunsStep(nt, true) : null;
          });
        }
        return null;
      }
      if (res.status === 429 || (res.data && res.data.error === "RATE_LIMIT")) {
        markRun(head, "FAST");
        scheduleRetry(P.backoffMs);
        return null;
      }
      if (res.status === 400) {
        var dropped = getRunQueue().filter(function (x: any) { return x && x.runId !== head.runId; });
        setRunQueue(dropped);
        if (P.profile) applyProfile(P.profile, worldOf(head), 0, "REJECTED");
        else markRun(head, "REJECTED");
        if (head && head.runId) delete runRefs[head.runId];
        return dropped.length ? flushRunsStep(tok, authRetried) : null;
      }
      if (!handleStatus(res)) {
        markRun(head, "OFFLINE");
        var wait = P.backoffMs;
        P.backoffMs = Math.min(60000, P.backoffMs * 2);
        scheduleRetry(wait);
        return null;
      }
      P.backoffMs = 5000;
      var curQ = getRunQueue();
      if (curQ.length && curQ[0].runId === head.runId) curQ.shift();
      else curQ = curQ.filter(function (x: any) { return x && x.runId !== head.runId; });
      setRunQueue(curQ);
      P.st = "ready";
      var done = worldOf(head);
      if (head && head.runId) delete runRefs[head.runId];
      applyProfile(res.data.profile, done, res.data.awarded, res.data.limited || "");
      if (curQ.length) return flushRunsStep(tok, authRetried);
      return res.data;
    });
  }

  function flushAll(allowInit: boolean) {
    var base = apiOrigin();
    if (!base || typeof fetch === "undefined") {
      P.st = "offline";
      return Promise.resolve(null);
    }
    var tok = getToken();
    var ready = tok ? Promise.resolve(tok) : (allowInit ? ensureProfile().then(function () { return getToken(); }) : Promise.resolve(""));
    return ready.then(function (t: string) {
      if (!t) {
        if (getRunQueue().length || getPendingBuys().length) {
          markQueued("OFFLINE");
          var wait = P.backoffMs;
          P.backoffMs = Math.min(60000, P.backoffMs * 2);
          scheduleRetry(wait);
        }
        return null;
      }
      /* Records land before a queued map purchase, so the goal check sees this device's best. */
      return syncRecords(t).then(function () {
        return flushBuysOnce(t).then(function () {
          return flushRunsStep(t);
        });
      });
    });
  }

  function enqueue(fn: any) {
    var prev = P.queue || Promise.resolve(null);
    var next = prev.then(function () { return fn(); }, function () { return fn(); });
    P.queue = next;
    return next;
  }

  P.init = function (api: any) {
    P.api = api;
    /* Visible before the queued ensureProfile runs, so a waiter does not treat "idle" as ready. */
    if (apiOrigin()) P.st = "syncing";
    if (!P.onlineBound && typeof window !== "undefined" && window.addEventListener) {
      P.onlineBound = true;
      window.addEventListener("online", function () {
        P.backoffMs = 5000;
        P.flush();
      });
    }
    return enqueue(function () {
      var deferCoins = !!readInitData();
      var coinSnap = 0;
      var campSnap: any = null;
      try {
        var early = P.api && P.api.save ? P.api.save() : null;
        if (early && typeof early.coins === "number") coinSnap = Math.max(0, Math.floor(early.coins));
        campSnap = localCampaign();
      } catch (_eSnap) {}
      return ensureProfile(deferCoins).then(function (prof: any) {
        if (!prof) {
          var cached = readJson(CACHE_KEY, null);
          if (cached) P.profile = cached;
          if (getRunQueue().length || getPendingBuys().length) {
            scheduleRetry(P.backoffMs);
          }
          return null;
        }
        return flushAll(false).then(function () {
          return tryTelegramAuth(getToken()).then(function (auth: any) {
            /* A merge already moved the guest server wallet. Do not also add the local coin cache. */
            if (auth && auth.merged) return syncCampaign(getToken(), auth.profile || P.profile, campSnap);
            return syncMigrate(getToken(), (auth && auth.profile) || P.profile || prof, coinSnap);
          });
        });
      });
    });
  };

  P.beginRun = function (map: string, hero: number) {
    var id = makeRunId();
    var tok = getToken();
    if (tok) startInflight[id] = postStart(id, map || "", hero, tok);
    return id;
  };

  P.finishRun = function (height: number, runCoins: number, bonusCoins: number, worldRef?: any, meta?: any) {
    var h = Math.max(0, Math.floor(Number(height) || 0));
    var c = Math.max(0, Math.floor(Number(runCoins) || 0));
    var b = Math.max(0, Math.floor(Number(bonusCoins) || 0));
    var pre = meta && typeof meta.awarded === "number" ? Math.max(0, Math.floor(meta.awarded)) : computeAward(h, c, b).awarded;
    var item: any = {
      runId: (meta && meta.runId) ? meta.runId : "",
      hero: meta && meta.hero != null ? meta.hero : 0,
      height: h,
      runCoins: c,
      bonusCoins: b,
      mode: (meta && meta.mode) || "solo",
      map: (meta && meta.map) || "",
      ver: (meta && meta.ver) || "0.6",
      estAward: pre,
      createdAt: Date.now()
    };
    var q = getRunQueue();
    q.push(item);
    setRunQueue(q);
    /* Attach transient ref only on in-memory handoff for results screen coin roll-up */
    return enqueue(function () {
      if (worldRef) runRefs[item.runId] = worldRef;
      return flushAll(true);
    });
  };

  P.buy = function (key: string, price: number) {
    if (!key) return Promise.resolve(null);
    var buys = getPendingBuys();
    var found = false;
    for (var i = 0; i < buys.length; i++) if (buys[i] && buys[i].key === key) { found = true; break; }
    if (!found) {
      buys.push({ key: key, price: Math.max(0, Math.floor(Number(price) || 0)), at: Date.now() });
      setPendingBuys(buys);
    }
    return enqueue(function () {
      if (P.buySupported === false) return null;
      var base = apiOrigin();
      if (!base || typeof fetch === "undefined") { P.st = "offline"; return null; }
      var tok = getToken();
      var ready = tok ? Promise.resolve(tok) : ensureProfile().then(function () { return getToken(); });
      return ready.then(function (t: string) {
        if (!t) return null;
        return flushBuysOnce(t);
      });
    });
  };

  P.flush = function () {
    return enqueue(function () { return flushAll(true); });
  };

  P.getToken = getToken;
  P.apiOrigin = apiOrigin;
  P.computeAward = computeAward;
  P.noteAward = function () {};
  P.pendingBuyKeys = pendingBuyKeys;
  P.getState = function () {
    var prof = P.profile;
    return {
      st: P.st,
      profile: prof,
      tokenPresent: !!getToken(),
      queueLen: getRunQueue().length,
      pendingBuysLen: getPendingBuys().length,
      pendingSpend: pendingSpend(),
      queuedEst: queuedEst(),
      buySupported: P.buySupported,
      apiOrigin: apiOrigin(),
      tgTried: !!P.tgTried,
      telegramId: prof && prof.telegramId ? String(prof.telegramId) : ""
    };
  };
  return P;
})();

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
  var simHold = false; /* test hook: sim frozen (no overlay), stepped with simTicks */
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
    var lw = netFixedLW() || (phase === "play" ? FIELD_W : 160);
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
        /* v1.0 (Roman 15:18): the 180 field fills the full screen width (fractional scale, positions snapped
           to device pixels; on 360 px phones it is exactly 6). The top safe area (status bar + Telegram
           buttons) is not part of the play view: VIEW_TOPPAD game px there show sky only, the HUD and the
           first visible platform start below it. Extra height is shown ABOVE the 346 field (VIEW_CROP < 0). */
        var devW = Math.round(availW * dpr), devH = Math.round(availH * dpr);
        var pF = devW / lw, visH;
        var insetCss = insetTopCss();
        for (var tries = 0; tries < 3; tries++) {
          cssScale = pF / dpr;
          VIEW_PAD = Math.max(0, (availW / cssScale - lw) / 2);
          VIEW_TOPPAD = Math.max(0, Math.round(insetCss / cssScale));
          visH = devH / pF - VIEW_TOPPAD;
          if (visH >= lh) { VIEW_CROP = -(visH - lh); VIEW_BOT = 0; break; }
          VIEW_CROP = 0;
          VIEW_BOT = Math.max(0, lh - visH);
          var botMax = viewBotMax(lh);
          if (VIEW_BOT <= botMax) break;
          VIEW_CROP = Math.min(TOP_CROP_MAX, VIEW_BOT - botMax);
          VIEW_BOT = botMax;
          if (lh - VIEW_CROP - VIEW_BOT <= visH + 1e-6) break;
          /* Too short even after the crop cap: zoom out so the cropped field fits the height (side pads). */
          pF = devH / (lh - VIEW_CROP - VIEW_BOT + VIEW_TOPPAD);
        }
        cssWpx = (lw + 2 * VIEW_PAD) * cssScale;
        cssHpx = (lh - VIEW_CROP - VIEW_BOT + VIEW_TOPPAD) * cssScale;
      } else if (!fieldLocked && phase !== "play" && availH * lw > availW * lh) {
        /* Menus on a tall phone: fill the whole screen (no stripes under the TG header or below the tab bar).
           Width sets the scale, the menu just gets taller. Runs always go back to 346 (startRun). */
        cssScale = availW / lw;
        lh = Math.max(lh, Math.floor(availH / cssScale));
        VIEW_PAD = 0; VIEW_TOPPAD = 0;
        VIEW_CROP = 0; VIEW_BOT = 0;
        cssWpx = availW;
        cssHpx = availH;
      } else {
        cssScale = Math.min(availW / lw, availH / lh);
        VIEW_PAD = Math.max(0, (availW / cssScale - lw) / 2); VIEW_TOPPAD = 0;
        VIEW_CROP = 0; VIEW_BOT = 0;
        cssWpx = (lw + 2 * VIEW_PAD) * cssScale;
        cssHpx = lh * cssScale;
      }
      var pxW = Math.max(1, Math.round(cssWpx * dpr));
      var pxH = Math.max(1, Math.round(cssHpx * dpr));
      canvas.width = pxW;
      canvas.height = pxH;
      var worldW = lw + 2 * VIEW_PAD;
      var worldH = lh - VIEW_CROP - VIEW_BOT + VIEW_TOPPAD;
      pScale = pxW / worldW;
      pScaleY = pxH / Math.max(1e-6, worldH);
      sx = pScale;
      sy = pScaleY;
      /* Snap the field origin to a device pixel so the clip has no 1 px sliver. */
      FIELD_OX = Math.round(VIEW_PAD * sx);
      FIELD_OY = Math.round((-VIEW_CROP + VIEW_TOPPAD) * sy);
      PHONE_INT = false;
      DEV_W = pxW; DEV_H = pxH;
      canvas.style.position = "absolute";
      canvas.style.left = Math.round(vs.x + (cssW - cssWpx) / 2) + "px";
      /* Bottom-align so a short viewport keeps the death line on screen. */
      canvas.style.top = Math.round(vs.y + (cssH - cssHpx) / (VIEW_BOT > 0 || VIEW_CROP > 0 ? 1 : 2)) + "px";
      canvas.style.boxShadow = "none";
      canvas.style.borderRadius = "0px";
    }
    if (isWide) { VIEW_PAD = 0; VIEW_TOPPAD = 0; VIEW_CROP = 0; VIEW_BOT = 0; FIELD_OX = 0; FIELD_OY = 0; PHONE_INT = false; DEV_W = canvas.width; DEV_H = canvas.height; }
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
    var s = sc == null ? TYPE.M : sc;
    drawText(ctx, label, x + w / 2, y + Math.round((h - 7 * s) / 2) + (on ? 1 : 0), tcol || TYPECOL.primary, s, "center");
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
    var s = String(n), w = textWidth(s, TYPE.M) + 9;
    var x0 = align === "right" ? x - w : align === "center" ? x - w / 2 : x;
    drawCoin(ctx, x0, y, ui);
    drawText(ctx, s, x0 + 9, y - 0.5, TYPECOL.accent, TYPE.M, "left");
  }
  function menuTop() {
    return Math.round(insetTopCss() / Math.max(0.01, cssScale || 1)) + (testInsetTop || 0);
  }
  /* Nick uses the same 5×7 font as the rest of the UI, at TYPE.M. */
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
    if (fit.text) drawTextO(ctx, fit.text, x, y, TYPECOL.muted, "left", "#1a1030");
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
    var w = textWidth(s, TYPE.M) + 9;
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
    drawText(ctx, lab, x + w / 2, y + Math.round((h - 7 * TYPE.M) / 2) + (on ? 1 : 0), lack ? TYPECOL.muted : TYPECOL.ink, TYPE.M, "center");
  }
  function tryBuy(id: string, price: number, apply: any) {
    if (save.coins < price) return;
    if (confirmId === id && Date.now() < confirmAt) { confirmId = null; apply(); writeSave(save); }
    else { confirmId = id; confirmAt = Date.now() + 2000; }
  }
  function abBar() {
    var coinW = 28;
    try { if (world) coinW = textWidth(String(world.runCoins || 0), TYPE.M) + 19; } catch (_e) {}
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
    /* Menus may be taller than 346 on tall phones; the field is always FIELD_W×346 before the world exists. */
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
  var bgcGeom = { x: 0, w: 1 };
  function setSlider(id: string, x: number) {
    if (id === "bgc") {
      var t = clamp((x - bgcGeom.x) / Math.max(1, bgcGeom.w), 0, 1);
      var p = snapBgContrast(40 + t * 60);
      if (p === bgContrastPct) return;
      bgContrastPct = p;
      save.bgContrast = p;
      writeSave(save);
      return;
    }
    var v = Math.round(clamp((x - volGeom.x) / Math.max(1, volGeom.w), 0, 1) * 10) / 10;
    if (v > 0 && !audioOn) setAudioOn(true);
    setMasterVol(v);
    save.vol = masterVol; save.music = masterVol; save.sfxVol = masterVol;
    save.audioOn = audioOn; save.musicOn = audioOn; save.sfx = audioOn;
    writeSave(save);
  }
  function volRow(id: string, x: number, y: number, w: number, label: string, vol: number, on: boolean) {
    drawText(ctx, label, x, y, on ? TYPECOL.primary : TYPECOL.muted, TYPE.M, "left");
    btn(id + ":mute", x + w - 36, y - 2, 36, 12, on ? C.mint : "#1a1430", on ? "ВКЛ" : "ВЫКЛ", on ? TYPECOL.ink : TYPECOL.primary);
    var bx = x, bw = w, by = y + 12;
    addHit(id, bx, by, bw, 8);
    volGeom = { x: bx, w: bw };
    rect(ctx, bx, by, bw, 5, "#120c28");
    var fw = Math.max(0, Math.round(bw * (on ? vol : 0)));
    if (fw > 0) rect(ctx, bx, by, fw, 5, C.mint);
    rect(ctx, bx, by, bw, 1, on ? C.cream : "#5a5668");
    rect(ctx, bx + Math.min(bw - 1, fw), by - 1, 1, 7, C.gold);
  }
  /* TEMPORARY: background contrast row (Settings only). Five snap steps: 40/55/70/85/100. */
  function contrastRow(x: number, y: number, w: number) {
    drawText(ctx, "КОНТРАСТ ФОНА", x, y, TYPECOL.primary, TYPE.M, "left");
    drawText(ctx, bgContrastPct + "%", x + w, y, TYPECOL.muted, TYPE.M, "right");
    var bx = x, bw = w, by = y + 12;
    addHit("bgc", bx, by, bw, 8);
    bgcGeom = { x: bx, w: bw };
    rect(ctx, bx, by, bw, 5, "#120c28");
    var t = (bgContrastPct - 40) / 60;
    var fw = Math.max(0, Math.round(bw * clamp(t, 0, 1)));
    if (fw > 0) rect(ctx, bx, by, fw, 5, C.gold);
    rect(ctx, bx, by, bw, 1, C.cream);
    for (var sj = 0; sj < BG_CONTRAST_STEPS.length; sj++) {
      var tick = bx + Math.round(sj / (BG_CONTRAST_STEPS.length - 1) * (bw - 1));
      rect(ctx, tick, by - 1, 1, 7, C.cream);
    }
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
    if (id === "vol" || id === "bgc") { setSlider(id, loc.x); return; }
    if (phase === "results") coinSkip = true;
    if (phase !== "play") return;
    if (paused) return;
    if (id === "ab" || id === "pause") return;
    pointers[e.pointerId != null ? e.pointerId : 1] = { x: loc.x, y: loc.y, sx: loc.x, sy: loc.y, sxCss: e.clientX, syCss: e.clientY, t0: e.timeStamp || Date.now(), swiped: false };
    recomputeHold();
  }
  function onPtrMove(e: any) {
    var loc = toLogic(e.clientX, e.clientY);
    if (pressId === "vol" || pressId === "bgc") { setSlider(pressId, loc.x); return; }
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
    } else if (pressId === "vol" || pressId === "bgc") {
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
    drawText(ctx, title, LW / 2, y + 5, TYPECOL.primary, sc, "center");
    markBox("header", x, y, w, h);
    if (phase === "results") pushRes("header", x, y, w, h);
    return { x: x, y: y, w: w, h: h, bottom: y + h };
  }
  function drawSessionNote() {
    var y = belowBand();
    box(ctx, colX(), y, 152, 26, C.navy, C.gold);
    drawText(ctx, "АККАУНТ ОТКРЫТ", LW / 2, y + 3, TYPECOL.accent, TYPE.M, "center");
    drawText(ctx, "НА ДРУГОМ УСТРОЙСТВЕ", LW / 2, y + 14, TYPECOL.accent, TYPE.M, "center");
    markBox("session", colX(), y, 152, 26);
  }
  function drawFlash() {
    if (flashT <= 0) return;
    if (phase !== flashPh) { flashT = 0; return; }
    var unlock = flash.indexOf("ОТКРЫТ") >= 0;
    var sc = TYPE.M, fy = LH - 64, fh = 13;
    if (unlock && phase === "camp") {
      if (campCard >= 0) { fy = Math.round(LH / 2 - 70) + 84; fh = 16; }
      else { fy = 36; fh = 22; } /* under the title, in the tip-plaque row */
    } else if (unlock) { fy = 36; fh = 16; }
    var w = Math.min(LW - 8, textWidth(flash, sc) + 16);
    ctx.globalAlpha = Math.min(1, flashT / 20);
    box(ctx, Math.round(LW / 2 - w / 2), fy, w, fh, C.navy, C.gold);
    drawText(ctx, flash, LW / 2, fy + 4, TYPECOL.accent, sc, "center");
    ctx.globalAlpha = 1;
  }
  function plaque() {
    var x = colX();
    box(ctx, x, 48, 152, 14, C.navy, C.gold);
    coinsLabel(x + 4, 51, save.coins, undefined, true);
    drawText(ctx, "РЕКОРД " + (save.best || 0) + " М", x + 148, 51, TYPECOL.primary, TYPE.M, "right");
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
    drawText(ctx, "ПРОФИЛЬ", LW / 2, y + 6, TYPECOL.accent, TYPE.M, "center");
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
    drawText(ctx, name, x + 40, y + 24, TYPECOL.primary, TYPE.M, "left");
    var lineY = y + 36;
    if (linked && u.username) {
      drawText(ctx, glyphsOf(String(u.username), 14), x + 40, lineY, TYPECOL.muted, TYPE.M, "left");
      lineY += 12;
    }
    var entryY = y + 54;
    drawText(ctx, linked ? "ВХОД: TELEGRAM" : "ВХОД: ГОСТЕВОЙ", x + 8, entryY, TYPECOL.primary, TYPE.M, "left");
    if (!linked) drawText(ctx, "ПРОГРЕСС НА УСТРОЙСТВЕ", x + 8, entryY + 12, TYPECOL.muted, TYPE.M, "left");
    drawText(ctx, "РЕКОРД " + (save.best || 0) + " М", x + 8, y + h - 36, TYPECOL.accent, TYPE.M, "left");
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
    var col = dim ? TYPECOL.muted : TYPECOL.primary;
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
  function heroCellH() {
    var sprH = 0;
    try {
      var spr = heroSprite((CHARS[save.char] || CHARS[0]).id);
      if (spr) sprH = spr.naturalHeight || spr.height || 0;
    } catch (_e) {}
    if (typeof ART64 !== "undefined" && ART64.cell && ART64.cell.h) return Math.max(ART64.cell.h, sprH);
    return sprH || 68;
  }
  /* Canvas scale in device px per game px (drawJumper's fine path uses getTransform().a). */
  function menuScaleA() {
    var mt: any = ctx.getTransform ? ctx.getTransform() : null;
    if (mt && mt.a > 0) return mt.a;
    return pScale || ((cssScale || 1) * Math.max(1, (typeof window !== "undefined" ? window.devicePixelRatio : 1) || 1));
  }
  /* Pick the largest whole device-px-per-art-px size that still leaves a visible jump (minHop)
     inside budget. Prefer a readable hero (do not spend the whole budget on hop and leave a speck)
     and cap hop at 26, the start-screen amplitude. Same k rounding as drawJumper(..., fine). */
  function heroFitHop(budget: number) {
    var a = menuScaleA(), fh = heroCellH();
    var kCap = Math.max(1, Math.round(a * 0.5 * 2));
    function hh(k: number) { return fh * k / a; }
    var minHop = 16, targetHop = 26;
    var k = kCap;
    while (k > 1 && hh(k) + minHop > budget) k--;
    /* Prefer a readable hero: k=2 with a 12 px hop beats a 10 px speck with a 26 px hop. */
    if (k === 1 && kCap >= 2 && hh(2) + 10 <= budget) k = 2;
    var hop = Math.min(targetHop, Math.max(0, budget - hh(k)));
    if (hop < 8) hop = Math.max(8, budget - hh(k));
    return { sc: (2 * k) / a, k: k, h: hh(k), hop: hop };
  }
  function heroFit(budget: number, roomHop: number) {
    var r = heroFitHop(Math.max(0, budget));
    if (roomHop > r.hop && r.k > 1) {
      var r2 = heroFitHop(budget); /* already prefers minHop=16 */
      return r2;
    }
    return r;
  }
  var lastHop: any = { where: "", hop: 0, room: 0, sc: 2, k: 1, h: 0, platY: 0, budget: 0 };
  /* In-game 64 px grass platform (drawPlat64), tinted for the current world.
     Visual height below the landing row is ~8 game px (aqua 8.5). */
  function menuPlatBelow(map?: string) {
    var id = mapInfo(map || (save && save.bg) || "city").id;
    var key = "normal_" + (typeof ART64 !== "undefined" && ART64.plat && ART64.plat["normal_" + id] ? id : "city");
    var m = (typeof ART64 !== "undefined" && ART64.plat) ? ART64.plat[key] : null;
    return m ? Math.round((m.h - (m.land || 1)) * 0.5) : 8;
  }
  function menuPlatW(sc: number) {
    var cellW = (typeof ART64 !== "undefined" && ART64.cell && ART64.cell.w) ? ART64.cell.w : 72;
    var heroW = cellW * 0.5 * sc;
    return Math.round(Math.min(120, Math.max(24, heroW + 6)));
  }
  function drawMenuPlat(x: number, y: number, w: number, map?: string) {
    var id = mapInfo(map || (save && save.bg) || "city").id;
    if (typeof drawPlat64 === "function" && drawPlat64(ctx, { type: "normal", w: w }, x, y, w, id, 0)) return true;
    rect(ctx, x, y, w, 5, C.wood); rect(ctx, x, y + 4, w, 2, C.woodD); rect(ctx, x, y, w, 1, C.edge);
    return false;
  }
  function menuFrame() {
    var top = menuTop();
    var bot = Math.round(insetBottomUiCss() / Math.max(0.01, cssScale || 1));
    /* ИГРАТЬ keeps the prod 34px button and at least 10px of air. Squeeze the logo and the grid, not these gaps. */
    var playGap = 10, playH = 34, pickH = 18, gridH = 26, tabH = 36, gridGap = 4;
    var logoSc = TYPE.XL;
    function stack() {
      var tabY = LH - bot - tabH;
      var gridY = tabY - playGap - (gridH * 2 + gridGap);
      var playY = gridY - playGap - playH;
      var pickY = playY - playGap - pickH;
      var logoY = top + 25;
      var tagY = logoY + 7 * logoSc + 4;
      var tagBot = tagY + 9;
      var platY = pickY - (menuPlatBelow() + 3);
      return { tabY: tabY, gridY: gridY, playY: playY, pickY: pickY, logoY: logoY, tagY: tagY, tagBot: tagBot, platY: platY };
    }
    var L = stack();
    /* Need a real jump (the hero must leave the ground), not just pose frames in place.
       Telegram safe-area + content-safe-area insets on a phone used to leave platY - cellH
       <= tagBot, so demoHop's room was clamped to 0. Squeeze the logo/grid first, then
       shrink the hero to a smaller whole device-px size rather than killing the hop. */
    function gap() { return L.platY - (L.tagBot + 2); }
    function need() { var f = heroFitHop(1000); return f.h + 26; }
    if (gap() < need()) { logoSc = TYPE.L; L = stack(); }
    if (gap() < need()) { gridGap = 2; pickH = 16; L = stack(); }
    var g = Math.max(16, gap());
    var fit = heroFitHop(g);
    var hopRoom = fit.hop;
    return {
      top: top, bot: bot, logoY: L.logoY, logoSc: logoSc, tagY: L.tagY, tagBot: L.tagBot,
      platY: L.platY, heroTop: L.platY - fit.h - hopRoom, heroSc: fit.sc, heroK: fit.k, heroH: fit.h, hopRoom: hopRoom,
      pickY: L.pickY, pickH: pickH, playY: L.playY, playH: playH,
      gridY: L.gridY, gridH: gridH, gridGap: gridGap, tabY: L.tabY, tabH: tabH, playGap: playGap
    };
  }
  function drawMenu() {
    applyBgContrast(ctx, function () { drawBg(ctx, MENU_CAM(), ui, save.bg, true); });
    dimView(ctx, "rgba(18,14,44,0.14)");
    var x = colX();
    var L = menuFrame();
    var logoW = bigWidth("ХОППАК", L.logoSc);
    drawBig(ctx, "ХОППАК", LW / 2, L.logoY, TITLE.face, L.logoSc, "center", TITLE.outline, TITLE.shadow);
    drawTextO(ctx, "ПРЫГАЙ ВЫШЕ ВСЕХ", LW / 2, L.tagY, TYPECOL.primary, "center");
    menuLay = {
      chip: { x: 3, y: 1 + L.top, w: CHIP, h: CHIP },
      coins: { x: 0, y: 1 + L.top, w: 0, h: CHIP },
      logo: { x: Math.round(LW / 2 - logoW / 2) - 1, y: L.logoY - 1, w: logoW + 2, h: 7 * L.logoSc + 2 },
      tag: { x: Math.round(LW / 2 - textWidth("ПРЫГАЙ ВЫШЕ ВСЕХ", TYPE.M) / 2) - 1, y: L.tagY - 1, w: textWidth("ПРЫГАЙ ВЫШЕ ВСЕХ", TYPE.M) + 2, h: 9 },
      logoSc: L.logoSc,
      safeTop: L.top,
      safeBottom: L.bot
    };
    var mi = mapIdx(save.bg), M = MAPS[mi], bestM = mapBest(mi);
    var sub = M.goal ? (M.name + " · " + bestM + "/" + M.goal + " М") : (M.name + " · " + bestM + " М");
    var platY = L.platY;
    var mPlatW = menuPlatW(L.heroSc), mPlatX = Math.round(LW / 2 - mPlatW / 2), mPlatH = menuPlatBelow();
    drawMenuPlat(mPlatX, platY, mPlatW);
    var heroId = (CHARS[save.char] || CHARS[0]).id;
    var mh = demoHop(lookNow(), L.hopRoom), hop = mh.hop, pose = mh.pose;
    var heroY = platY - 16 * L.heroSc - hop;
    drawJumper(ctx, jumperXForCenter(LW / 2, heroId, pose, L.heroSc), heroY, lookNow(), 1, pose, ui % 170 < 6, true, L.heroSc, true);
    lastHop = { where: "menu", hop: hop, room: L.hopRoom, sc: L.heroSc, k: L.heroK, h: L.heroH, platY: platY, budget: platY - (L.tagBot + 2), platW: mPlatW };
    markBox("hero", LW / 2 - 18, platY - hop - L.heroH, 36, L.heroH);
    markBox("plat", mPlatX, platY, mPlatW, mPlatH);
    var pickW = 120;
    btn("hero:menu", x + Math.round((152 - pickW) / 2), L.pickY, pickW, L.pickH, "#1a1430", "ВЫБРАТЬ ГЕРОЯ", TYPECOL.primary, TYPE.M, C.gold);
    btn("start", x, L.playY, 152, L.playH, C.mint, "", TYPECOL.ink, TYPE.L);
    /* Same face as prod b683155: BIGF scale 2, ink, no outline, 4px under the button top. */
    drawBig(ctx, "ИГРАТЬ ▶", LW / 2, L.playY + 4, TYPECOL.ink, TYPE.L, "center");
    drawText(ctx, sub, LW / 2, L.playY + 23, TYPECOL.ink, TYPE.M, "center");
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
      var tc = tb.lock ? "#6a6080" : (on ? TYPECOL.primary : TYPECOL.muted);
      drawTiny(ctx, tb.label, tx + tw / 2, L.tabY + 22, tc, "center");
      if (tb.lock) drawTabLock(ix + 11, iy - 1);
    }
    if (LH - L.tabY <= L.tabH) rect(ctx, 0, L.tabY + L.tabH - 1, LW, 1, INK);
    if (showSet) {
      hits = [];
      screenLay = [];
      dimView(ctx, "rgba(8,6,20,0.62)");
      var py0 = belowBand();
      var setH = 168;
      box(ctx, x, py0, 152, setH, C.navy, C.cream);
      markBox("settings", x, py0, 152, setH);
      drawText(ctx, "НАСТРОЙКИ", LW / 2, py0 + 6, TYPECOL.accent, TYPE.M, "center");
      btn("tilt", x + 8, py0 + 20, 136, 20, tiltOn ? C.mint : "#1a1430", "НАКЛОН: " + (tiltOn ? "ВКЛ" : "ВЫКЛ"), tiltOn ? TYPECOL.ink : TYPECOL.primary);
      volRow("vol", x + 8, py0 + 44, 136, "ГРОМКОСТЬ", masterVol, audioOn);
      contrastRow(x + 8, py0 + 70, 136);
      btn("vib", x + 8, py0 + 96, 136, 20, vibOn ? C.mint : "#1a1430", "ВИБРО: " + (vibOn ? "ВКЛ" : "ВЫКЛ"), vibOn ? TYPECOL.ink : TYPECOL.primary);
      btn("set:prof", x + 8, py0 + 120, 136, 20, "#1a1430", "ПРОФИЛЬ", TYPECOL.primary);
      btn("set", x + 26, py0 + 144, 100, 16, C.navy, "ЗАКРЫТЬ");
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
    applyBgContrast(ctx, function () { drawBg(ctx, MENU_CAM(), ui, save.bg, true); });
    dimView(ctx, "rgba(18,14,44,0.32)");
    var x = colX();
    /* If the card would be too short for a readable jumping hero, tighten the title and grid first. */
    var shopBotPeek = Math.round(insetBottomUiCss() / Math.max(0.01, cssScale || 1));
    var backPeek = LH - 34 - shopBotPeek;
    var y0est = belowBand() + (7 * TYPE.L + 10) + 4 + (34 * 2 + 4) + 4;
    var tightShop = backPeek - 6 - y0est < 140;
    var hdShop = header("МАГАЗИН", tightShop ? TYPE.M : TYPE.L);
    var pw = 34, gap = tightShop ? 2 : 4, cols = 3, rows = 2;
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
    var shopBot = Math.round(insetBottomUiCss() / Math.max(0.01, cssScale || 1));
    var backY = LH - 34 - shopBot;
    var y0 = heroY + rows * pw + (rows - 1) * gap + 4, ch = Math.max(90, backY - 6 - y0);
    markBox("card", x, y0, 152, ch);
    box(ctx, x, y0, 152, ch, on2 ? "#2a2050" : C.navy, on2 ? C.gold : own2 ? C.cream : "#6a5a8a");
    /* Shop hero size comes from the card box, not a leftover after a fixed 69-px text block.
       On a tall iPhone (LW=160, pScale≈8) that leftover was only ~36 game px, so heroFitHop
       picked k=2 / sc≈0.5 — half the in-game size — and the platform stayed a fixed 72-px bar.
       Target a hero around 30–40% of the card (at least the in-game sc=1 size when it fits),
       integer device-px per art-px, and a platform just wider than the sprite. */
    var btnH = 22, btnPad = 6, platH = menuPlatBelow() + 2;
    var chrome = 4 + btnH + btnPad + platH + 2;
    var minTextH = 38;
    var aShop = menuScaleA();
    if (pScale && pScale > aShop) aShop = pScale;
    if (!(aShop > 0)) aShop = 1;
    var fhShop = heroCellH();
    var avail = Math.max(16, ch - minTextH - chrome);
    /* minHop 10 still leaves a visible jump; 16 used to force a half-size hero on iPhone. */
    var minHop = 10, targetHop = 26;
    var maxH = Math.min(avail - minHop, Math.max(8, Math.round(ch * 0.40)));
    var wantH = Math.round(ch * 0.35);
    if (wantH > maxH) wantH = maxH;
    var ingameH = fhShop * 0.5;
    if (ingameH <= maxH && wantH < ingameH) wantH = ingameH;
    var kCap = Math.max(1, Math.round(aShop * 0.5 * 2));
    function shopHh(kShop: number) { return fhShop * kShop / aShop; }
    var kShop = kCap;
    while (kShop > 1 && shopHh(kShop) > maxH) kShop--;
    /* Never pick a k smaller than what actually fits in the card. */
    while (kShop < kCap && shopHh(kShop + 1) <= maxH && shopHh(kShop + 1) + minHop <= avail) kShop++;
    var hopRoom = Math.min(targetHop, Math.max(minHop, avail - shopHh(kShop)));
    if (shopHh(kShop) + hopRoom > avail) hopRoom = Math.max(8, avail - shopHh(kShop));
    var fit = { sc: (2 * kShop) / aShop, k: kShop, h: shopHh(kShop), hop: hopRoom };
    var band = fit.h + hopRoom + 2;
    var textH = Math.min(42, Math.max(minTextH, ch - chrome - band));
    var byb = y0 + ch - btnH - btnPad;
    var textTop = byb - 4 - textH;
    var platTop = textTop - platH;
    var budget = platTop - (y0 + 1);
    if (budget > fit.h + hopRoom) hopRoom = Math.min(targetHop, budget - fit.h);
    if (hopRoom < 8 && budget > fit.h) hopRoom = Math.max(8, budget - fit.h);
    var cellW = (typeof ART64 !== "undefined" && ART64.cell && ART64.cell.w) ? ART64.cell.w : 72;
    var heroW = cellW * 0.5 * fit.sc;
    var platW = Math.round(Math.min(152 - 16, Math.max(20, heroW + 6)));
    var platX = Math.round(LW / 2 - platW / 2);
    drawMenuPlat(platX, platTop, platW);
    var mh = demoHop(makeLook(i, save.color, save.hat), hopRoom), pose = mh.pose, hop = mh.hop;
    if (hop > hopRoom) hop = hopRoom;
    drawJumper(ctx, jumperXForCenter(LW / 2, H2.id, pose, fit.sc), platTop - 16 * fit.sc - hop, makeLook(i, save.color, save.hat), 1, pose, ui % 170 < 6, true, fit.sc, true);
    lastHop = { where: "shop", hop: hop, room: hopRoom, sc: fit.sc, k: fit.k, h: fit.h, platY: platTop, budget: budget, platW: platW };
    /* Card type is fixed: name TYPE.M, ability + description TYPE.S (tiny), charge TYPE.M muted.
       No larger title on wide screens — the hero keeps the leftover space. */
    var ny = textTop + 1;
    var by0 = ny + typeH("M") + 1;
    var badgeH = typeH("S") + 4;
    var tw = uiWidth(H2.abName, "S") + 10;
    box(ctx, Math.round(LW / 2 - tw / 2), by0, tw, badgeH, "#3a4ac8", C.cream);
    uiText(ctx, H2.name, LW / 2, ny, TYPECOL.primary, "M", "center");
    uiText(ctx, H2.abName, LW / 2, by0 + 2, TYPECOL.primary, "S", "center");
    var desc1 = by0 + badgeH + 1;
    var desc2 = desc1 + typeH("S") + 1;
    uiText(ctx, H2.abDesc[0], LW / 2, desc1, TYPECOL.primary, "S", "center");
    uiText(ctx, H2.abDesc[1], LW / 2, desc2, TYPECOL.primary, "S", "center");
    var chgY = Math.min(textTop + textH - typeH("M") - 1, desc2 + typeH("S") + 2);
    drawChargeLine(LW / 2, chgY, H2, TYPECOL.muted);
    markBox("cardText", x + 4, textTop, 144, textH);
    markBox("cardBtn", x + 10, byb, 132, btnH);
    if (on2) btn("hero:act", x + 10, byb, 132, 22, "#2a2050", "ВЫБРАН", TYPECOL.accent, TYPE.M, TYPECOL.accent);
    else if (own2) btn("hero:act", x + 10, byb, 132, 22, C.mint, "ВЫБРАТЬ", TYPECOL.ink);
    else drawBuy("hero:act", x + 10, byb, 132, 22, H2.price);
    btn("back", x + 26, backY, 100, 22, C.navy, "НАЗАД");
    drawFlash();
  }
  function bar(x: number, y: number, w: number, h: number, f: number, col: string) {
    rect(ctx, x, y, w, h, "#1a1430");
    rect(ctx, x, y, Math.max(0, Math.round(w * clamp(f, 0, 1))), h, col);
  }
  function drawCamp() {
    applyBgContrast(ctx, function () { drawBg(ctx, MENU_CAM(), ui, save.bg, true); });
    dimView(ctx, "rgba(18,14,44,0.34)");
    var x = colX();
    var hdCamp = header("КАМПАНИЯ", TYPE.L);
    var tipY = hdCamp.bottom + 4;
    box(ctx, x, tipY, 152, 22, "#1a1430", C.mint);
    markBox("tip", x, tipY, 152, 22);
    drawText(ctx, "ДОЙДИ ДО ЦЕЛИ →", LW / 2, tipY + 3, TYPECOL.primary, TYPE.M, "center");
    drawText(ctx, "ОТКРОЙ ЗА МОНЕТЫ", LW / 2, tipY + 13, TYPECOL.mint, TYPE.M, "center");
    var top = tipY + 26, bot = LH - 40, rh = Math.min(42, Math.floor((bot - top) / MAPS.length));
    for (var i = 0; i < MAPS.length; i++) {
      var M = MAPS[i], y = top + i * rh, open = mapOpen(i), can = !open && mapGoalMet(i), locked = !open && !can;
      var bd = save.bg === M.id ? C.gold : open ? C.cream : can ? C.mint : "#4a3a6a";
      addHit("camp:" + i, x, y, 152, rh - 3);
      markBox("map" + i, x, y, 152, rh - 3);
      box(ctx, x, y, 152, rh - 3, open ? (save.bg === M.id ? "#2a2050" : C.navy) : "#1a1430", bd);
      drawBgSwatch(x + 3, y + 3, 20, rh - 9, M.id);
      if (!open) { ctx.globalAlpha = 0.55; rect(ctx, x + 3, y + 3, 20, rh - 9, "#0c0818"); ctx.globalAlpha = 1; }
      drawText(ctx, (i + 1) + ". " + M.name, x + 28, y + 3, open || can ? TYPECOL.primary : TYPECOL.muted, TYPE.M, "left");
      if (open) {
        var b = mapBest(i);
        if (M.goal) {
          drawText(ctx, (b >= M.goal ? "✓ " : "") + "ЦЕЛЬ " + M.goal + " М", x + 28, y + 13, b >= M.goal ? TYPECOL.mint : TYPECOL.accent, TYPE.M, "left");
          drawText(ctx, b + "/" + M.goal, x + 148, y + 3, TYPECOL.primary, TYPE.M, "right");
          bar(x + 28, y + rh - 11, 107, 5, b / M.goal, b >= M.goal ? C.mint : C.gold);
        } else drawText(ctx, "РЕКОРД " + b + " М", x + 28, y + 15, TYPECOL.accent, TYPE.M, "left");
      } else if (can) {
        drawBuy("camp:open:" + i, x + 28, y + rh - 20, 120, 16, M.price);
      } else {
        drawText(ctx, MAPS[i - 1].goal + " М " + WHERE[i - 1], x + 28, y + 13, TYPECOL.muted, TYPE.M, "left");
        drawText(ctx, "● " + M.price, x + 28, y + 23, TYPECOL.accent, TYPE.M, "left");
      }
    }
    btn("back", x + 26, LH - 34, 100, 22, C.navy, "НАЗАД");
    drawFlash();
  }
  function drawLobby() { /* UI only: bot lobby now, online room UI can hook here later */
    applyBgContrast(ctx, function () { drawBg(ctx, MENU_CAM(), ui, menuMap(), true); });
    dimView(ctx, "rgba(18,14,44,0.32)");
    var x = colX();
    var hdLobby = header("ЗАБЕГ С БОТАМИ", TYPE.M);
    var ps = lobbyNames();
    var row0 = hdLobby.bottom + 4;
    var slotH = 36, slotGap = 2;
    for (var i = 0; i < ps.length; i++) {
      var y = row0 + i * (slotH + slotGap);
      markBox("slot" + i, x, y, 152, slotH);
      box(ctx, x, y, 152, slotH, i === 0 ? "#2a2050" : C.navy, i === 0 ? C.gold : C.cream);
      ctx.imageSmoothingEnabled = false;
      drawPortrait(ctx, ps[i].kind, x + 2, y + 2, 1);
      drawText(ctx, ps[i].name, x + 40, y + 6, TYPECOL.primary, TYPE.M, "left");
      drawText(ctx, ps[i].tag, x + 40, y + 18, i === 0 ? TYPECOL.accent : TYPECOL.muted, TYPE.M, "left");
      drawText(ctx, CHARS[ps[i].kind].abName, x + 148, y + 14, TYPECOL.muted, TYPE.M, "right");
    }
    var my = row0 + 4 * (slotH + slotGap) + 6;
    btn("lmap:prev", x, my, 20, 18, "#1a1430", "<", TYPECOL.primary);
    btn("lmap:next", x + 132, my, 20, 18, "#1a1430", ">", TYPECOL.primary);
    box(ctx, x + 22, my, 108, 18, C.navy, C.cream);
    drawText(ctx, "КАРТА: " + mapInfo(lobbyMap).name, LW / 2, my + 6, TYPECOL.accent, TYPE.M, "center");
    btn("go", x, Math.max(my + 28, LH - 66), 152, 26, C.mint, "НАЧАТЬ", TYPECOL.ink, TYPE.L);
    btn("back", x + 26, LH - 34, 100, 22, C.navy, "НАЗАД");
  }
  function lobbyNames() {
    var out: any[] = [{ kind: save.char, look: lookNow(), name: CHARS[save.char].name, tag: "ТЫ" }];
    var bk = botKinds(save.char);
    for (var k = 0; k < bk.length; k++) out.push({ kind: bk[k], look: makeLook(bk[k], "base", "none"), name: "БОТ " + (k + 1), tag: CHARS[bk[k]].name.toUpperCase() });
    return out;
  }

  /* v1.0 menu hop (start screen, shop): time-based, float height (drawJumper snaps it to the device pixel),
     ground beat squash -> crouch, then a parabola with the 64-px transition frames up -> apex -> fstart -> fall. */
  function menuNow() { return (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now(); }
  /* v1.0 menu demo jump: the game's own jump on a tiny demo platform - 50 Hz sim with GRAVITY / JUMP_V and the
     landing squash, poses from animPose (same 64-px state machine and frames as in play). Only the height is
     scaled to the room the menu has (shape and timing are the game's); drawn interpolated between sim ticks
     and snapped to device pixels by drawJumper. */
  var demoP: any = { x: 0, y: 0, prevY: 0, vy: JUMP_V, squash: 0, alive: true, face: 1, look: null }, demoAcc = 0, demoLast = -1;
  function demoHop(look: any, room: number) {
    var now = menuNow();
    if (demoLast < 0 || now - demoLast > 250) { demoLast = now; demoAcc = 0; }
    demoAcc += (now - demoLast) / 1000; demoLast = now;
    if (!demoP.look || demoP.look.id !== look.id) demoP.look = look;
    var n = 0;
    while (demoAcc >= STEP && n < 10) {
      demoAcc -= STEP; n++;
      demoP.prevY = demoP.y;
      demoP.vy = Math.min(demoP.vy + GRAVITY, 6.5);
      demoP.y += demoP.vy;
      if (demoP.squash > 0) demoP.squash--;
      if (demoP.vy > 0 && demoP.y >= 0) { demoP.y = 0; demoP.squash = 7; demoP.vy = JUMP_V; }
    }
    var yi = demoP.prevY + (demoP.y - demoP.prevY) * clamp(demoAcc / STEP, 0, 1);
    return { hop: Math.max(0, -yi) / JUMP_H * room, pose: animPose(demoP) };
  }
  function menuHop(periodMs: number, H: number) {
    var t = (menuNow() % periodMs) / periodMs, G = 0.14;
    if (t < G) return { hop: 0, pose: t < G * 0.5 ? "squash" : "crouch" };
    var sF = (t - G) / (1 - G), v = 1 - 2 * sF;
    return { hop: H * 4 * sF * (1 - sF), pose: v > 0.4 ? "up" : v > -0.2 ? "apex" : v > -0.5 ? "fstart" : "fall" };
  }
  function poseOf(p: any) {
    if (!(p.domeT > 0) && (p.abFx > 0 || p.poundT > 0 || p.dashT > 0 || p.hookN > 0 || p.wall || p.teleFx > 10)) return "ability";
    if (p.squash > 3) return "squash";
    if (p.vy < -2.2) return "up";
    if (p.vy > 1.5) return "fall";
    return "idle";
  }
  /* v1.0 render-only animation state machine for the 64-px heroes (physics untouched; whole-frame swaps).
     land: squash(land) ~35 ms -> crouch ~35 ms -> up(rise);  rising: up while vy < -0.6 (enter at < -1.2);
     top: apex (|vy| small) -> fstart ~80 ms -> fall (enter at vy > 0.9, leave below 0.3);
     every non-forced change waits ANIM_HOLD ms; landing and abilities switch at once. */
  var ANIM_HOLD = 70, ANIM_SQ = 35, ANIM_CR = 35, ANIM_FS = 80;
  var animSt: any = typeof WeakMap !== "undefined" ? new WeakMap() : null;
  /* v1.0 ability phases (render-only, frames ability/ab2/ab3/ab4 of the 64-px sheet):
     pirate hook: throw -> grab -> pull -> hit (by hookT/hookN); mage tele: cast -> out -> in (teleT) -> land (teleFx);
     knight pound: ram_up (first ticks) -> ram_dive; on impact ram_hit ~110 ms -> ram_jump while rising (~330 ms). */
  function abSub(p: any, a: any, now: number) {
    var id = p.look && p.look.id;
    if (id === "pirate") {
      if (p.hookN > 0) { var u = p.hookT / p.hookN; return u < 0.22 ? "ability" : u < 0.45 ? "ab2" : u < 0.85 ? "ab3" : "ab4"; }
      return "none";
    }
    if (id === "mage") {
      if (p.teleN > 0) return p.teleT <= 3 ? "ability" : p.teleT <= 6 ? "ab2" : "ab3";
      if (p.teleFx > 0) return "ab4";
      return "none";
    }
    if (id === "knight") {
      if (p.poundT > 0) return (p.abFx || 0) > 13 ? "ab2" : "ability";
      if (p.ramFx > 14) return "ab3";
      if (p.ramFx > 0 && (p.vy || 0) < -1) return "ab4";
      return "none";
    }
    return null;
  }
  function animPose(p: any) {
    var raw = poseOf(p);
    var id = p.look && p.look.id;
    if (!animSt || !(typeof HERO64 !== "undefined" && HERO64[id])) return raw;
    var now = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
    var a = animSt.get(p);
    if (!a) { a = { pose: raw === "idle" ? "apex" : raw, t: now, sq: p.squash || 0 }; animSt.set(p, a); return a.pose; }
    var dt = now - a.t, vy = p.vy || 0;
    var landed = (p.squash || 0) > a.sq && (p.squash || 0) >= 4;
    a.sq = p.squash || 0;
    var air = vy < -1.2 ? "up" : vy > 0.9 ? "fstart" : "apex";
    var next = a.pose, forced = false;
    /* "none": a phased-ability hero with nothing running - the generic abFx 'ability' flash is skipped */
    var sub = abSub(p, a, now);
    if (sub === "none" && raw === "ability") raw = (p.squash || 0) > 3 ? "squash" : "idle";
    if (sub && sub !== "none") { next = sub; forced = true; }
    else if (raw === "ability") { next = "ability"; forced = true; }
    else if (landed) { next = "squash"; forced = true; }
    else switch (a.pose) {
      case "ability": case "ab2": case "ab3": case "ab4": next = air; forced = true; break;
      case "squash": if (dt >= ANIM_SQ) { next = "crouch"; forced = true; } break;
      case "crouch": if (dt >= ANIM_CR) { next = air; forced = true; } break;
      case "up": if (vy > -0.6) next = vy > 0.9 ? "fstart" : "apex"; break;
      case "apex": if (vy > 0.9) next = "fstart"; else if (vy < -1.2) next = "up"; break;
      case "fstart": if (dt >= ANIM_FS) { next = vy > 0.3 ? "fall" : vy < -1.2 ? "up" : "apex"; forced = true; } break;
      case "fall": if (vy < -1.2) next = "up"; else if (vy < 0.3) next = "apex"; break;
      default: next = air;
    }
    if (next !== a.pose && (forced || dt >= ANIM_HOLD)) { a.pose = next; a.t = now; }
    return a.pose;
  }
  function goalLine(y: number, label: string) {
    if (y < -8 || y > LH + 8) return;
    var yy = Math.round(y);
    for (var x = viewX0(); x < LW + VIEW_PAD; x += 4) { var on = ((x - viewX0()) >> 2) % 2 === 0; rect(ctx, x, yy, 4, 1, on ? C.cream : "#162040"); rect(ctx, x, yy + 1, 4, 1, on ? "#162040" : C.cream); }
    var tw = textWidth(label, TYPE.M) + 6;
    rect(ctx, 3, yy - 11, tw + 2, 11, INK); rect(ctx, 4, yy - 10, tw, 9, "#162040");
    drawText(ctx, label, 4 + tw / 2, yy - 9, TYPECOL.accent, TYPE.M, "center");
  }
  function recLine(y: number, label: string) {
    if (y < -8 || y > LH + 8) return;
    var yy = Math.round(y);
    ctx.globalAlpha = 0.7;
    for (var x = viewX0(); x < LW + VIEW_PAD; x += 2) rect(ctx, x, yy, 1, 1, C.cream);
    ctx.globalAlpha = 1;
    var tw = textWidth(label, TYPE.M) + 6, lx = LW - tw - 5;
    rect(ctx, lx - 1, yy - 11, tw + 2, 11, INK); rect(ctx, lx, yy - 10, tw, 9, "#162040");
    drawText(ctx, label, lx + tw / 2, yy - 9, TYPECOL.primary, TYPE.M, "center");
  }
  function drawReadyPip(me: any, sy: number) {
    var dbg: any = (window as any).__dbg || {}; var pp = dbg.ring && dbg.ring.pop != null ? dbg.ring.pop : popT;
    if (!heroHasAb(me) || pp < 0 || pp >= 36) return;
    var x = Math.round(me.x + PW / 2) - 2, y = Math.round(sy) - 9;
    rect(ctx, x + 1, y, 1, 1, "#3a6848"); rect(ctx, x, y + 1, 3, 1, "#3a6848"); rect(ctx, x + 1, y + 2, 1, 1, "#3a6848"); rect(ctx, x + 1, y + 1, 1, 1, "#d8e8d0");
  }
  /* v1.0: one copy only, placed by its centre; near an edge it overhangs into the side pad / off screen
     instead of showing two halves (left + right) at once. Render-only, sim wrap unchanged. */
  function wrapDrawX(x: number, wdt: number) {
    var c = x + wdt / 2;
    return c < 0 ? x + LW : c >= LW ? x - LW : x;
  }
  function withWrapX(x: number, wdt: number, fn: any) { fn(wrapDrawX(x, wdt)); }
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
    applyBgContrast(ctx, function () { drawBg(ctx, cam, w.tick, w.map); });
    ctx.save();
    /* Clip in device pixels (ceil left / floor right) so a fractional scale cannot leak a 1 px sliver into the pads. */
    var mclip = ctx.getTransform();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    var x0 = Math.ceil(mclip.e - shx * mclip.a + viewX0() * mclip.a - 1e-9);
    var y0 = Math.ceil(mclip.f + viewY0() * mclip.d - 1e-9);
    var x1 = Math.floor(mclip.e - shx * mclip.a + (LW + VIEW_PAD) * mclip.a + 1e-9);
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
      var pose = p.alive ? animPose(p) : "fall";
      var drawHeroAt = function (xx: number) {
        var ox = p.x; p.x = xx;
        /* Render-only: while clinging, face into the field. p.face is used by dash/kick/net, so sim stays as-is. */
        var faceDraw = p.wall === -1 ? 1 : p.wall === 1 ? -1 : p.face;
        drawFxBack(p, sy, cam, pose, faceDraw, w.tick);
        ctx.save();
        ctx.globalAlpha = p.id !== 0 ? remoteAlpha() : 1; /* own hero always opaque */
        drawJumper(ctx, p.x, sy, p.look, faceDraw, pose, blink, p.alive);
        ctx.restore();
        if (p.id === 0) drawReadyPip(p, sy);
        drawFxFront(p, sy, w.tick);
        p.x = ox;
      };
      drawHeroAt(p.wallT > 0 ? p.x : wrapDrawX(p.x, PW));
      if (w.mode === "squad") tags.push({ p: p, x: p.x + 6, y: Math.round(sy) - 13 });
    }
    tags.sort(function (a: any, b: any) { return b.y - a.y; });
    for (i = 0; i < tags.length; i++) {
      var tg = tags[i];
      var isMe = tg.p.id === 0;
      var tgNm = String(tg.p.name || "БОТ");
      var label = !tg.p.alive ? "ВЫБЫЛ" : isMe ? "▼" : /^БОТ \d$/.test(tgNm) ? tgNm : tgNm.slice(0, 3);
      tg.w = textWidth(label, TYPE.M) + 4;
      for (var j = 0; j < i; j++) {
        var o = tags[j];
        if (Math.abs(o.x - tg.x) < (o.w + tg.w) / 2 + 1 && Math.abs(o.y - tg.y) < 10) tg.y = o.y - 10;
      }
      var lx = clamp(tg.x, tg.w / 2 + 1, LW - 12 - tg.w / 2);
      ctx.globalAlpha = isMe ? 0.85 : 0.5;
      if (!isMe) rect(ctx, Math.round(lx - tg.w / 2), tg.y, tg.w, 9, tg.p.alive ? C.navy : "#4a1020");
      drawText(ctx, label, lx, tg.y + (isMe ? 2 : 1), tg.p.alive ? (isMe ? TYPECOL.accent : TYPECOL.primary) : TYPECOL.danger, TYPE.M, "center");
      ctx.globalAlpha = 1;
    }
    ctx.restore();
    ctx.restore();

    var me = w.players[0];
    var wantPause = wantTouchPause();
    var meter = metersOf(me) + " М";
    var pb = pauseBox();
    coinsLabel(5, hudY(6), w.runCoins);
    drawTextO(ctx, meter, wantPause ? pb.x - 4 : LW - edgePad("right"), hudY(6), TYPECOL.primary, "right");
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
      var tw2 = textWidth(w.toast, TYPE.M) + 12;
      ctx.globalAlpha = Math.min(1, w.toastT / 15);
      box(ctx, Math.round(LW / 2 - tw2 / 2), hudY(38), tw2, 13, C.navy, C.gold);
      drawText(ctx, w.toast, LW / 2, hudY(41), TYPECOL.accent, TYPE.M, "center");
      ctx.globalAlpha = 1;
    }
    if (w.tick < 170 && !(w.toastT > 0) && !paused) {
      ctx.globalAlpha = clamp((170 - w.tick) / 40, 0, 1);
      var Hn = CHARS[me.kind];
      var line1 = !isPhone ? "← → ХОД" : "ТАП СЛЕВА / СПРАВА";
      var line2 = abHintRun ? (!isPhone ? ("↑ " + Hn.abName) : ("СВАЙП ↑ " + Hn.abName)) : "";
      var htw = textWidth(line1, TYPE.M);
      if (line2) htw = Math.max(htw, textWidth(line2, TYPE.M));
      var hw = htw + 12, hh = line2 ? 23 : 12, hx = Math.round(LW / 2 - hw / 2);
      box(ctx, hx, hudY(56), hw, hh, C.navy, C.cream);
      drawText(ctx, line1, LW / 2, hudY(58), TYPECOL.primary, TYPE.M, "center");
      if (line2) drawText(ctx, line2, LW / 2, hudY(68), TYPECOL.primary, TYPE.M, "center");
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
        var ltw = textWidth(liftLab, TYPE.M) + 10;
        box(ctx, Math.round(LW / 2 - ltw / 2), viewBottom() - 24, ltw, 13, C.navy, C.gold);
        drawText(ctx, liftLab, LW / 2, viewBottom() - 21, TYPECOL.accent, TYPE.M, "center");
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
        drawText(ctx, String(resumeCd), LW / 2, py, TYPECOL.accent, TYPE.XL, "center");
        py += 26;
      } else if (land) {
        drawText(ctx, "ПОВЕРНИ ТЕЛЕФОН", LW / 2, py, TYPECOL.primary, TYPE.M, "center");
        py += 14;
      }
      volRow("vol", px + 8, py, 136, "ГРОМКОСТЬ", masterVol, audioOn);
      py += 28;
      if (resumeCd > 0) btn("menu", px + 10, py, 132, 22, C.navy, "МЕНЮ");
      else {
        btn("resume", px + 10, py, 132, 22, C.mint, "ПРОДОЛЖИТЬ", TYPECOL.ink);
        btn("menu", px + 10, py + 26, 132, 22, C.navy, "МЕНЮ");
      }
      pauseLay = hits.filter(function (h: any) {
        return h.id === "vol" || h.id === "vol:mute" || h.id === "resume" || h.id === "menu";
      });
    }
  }
  function drawFxBack(p: any, sy: number, cam: number, pose?: string, faceDraw?: number, tick?: number) {
    var cx = Math.round(p.x + 6), cy = Math.round(sy + 8), k;
    if (p.hookN > 0) {
      var hx = Math.round(p.htx + 6), hy = Math.round(p.hty - cam);
      /* Rope start: the 64-px pirate's own rope end (grab / pull: the sprite rope runs to the frame edge, the code
         rope continues from that exact art pixel, so it is neither doubled nor broken). Throw: the hook is still in
         the hand in the art, no code rope. Hit (no rope in the art): from the hand. Other sprites: from the body. */
      var anc = typeof ART64 !== "undefined" && ART64.anchor && ART64.anchor[p.look && p.look.id];
      var rx = cx, ry = sy + 2, drawRope = true;
      if (anc && pose === "ability") drawRope = false;
      else if (anc && (pose === "ab2" || pose === "ab3") && anc[pose]) {
        var px0 = Math.round(p.x), cell = ART64.cell, fh2 = cell.h * 0.5;
        var ax2 = anc[pose][0] * 0.5 + 0.25, ay2 = anc[pose][1] * 0.5 + 0.25;
        rx = (faceDraw || 1) < 0 ? px0 + 6 + SPR_AX - ax2 : px0 + 6 - SPR_AX + ax2;
        ry = Math.round(sy) + 16 - fh2 + ay2;
      } else if (anc && pose === "ab4") { rx = cx + (faceDraw || 1) * 3; ry = sy + 5; }
      if (drawRope) {
        var ddx = hx + 0.5 - rx, ddy = hy - ry, n = Math.max(2, Math.ceil(Math.max(Math.abs(ddx), Math.abs(ddy)) * 2));
        for (k = 0; k <= n; k++) {
          ctx.fillStyle = (k >> 2) % 2 ? "#c8a070" : "#7a5030";
          ctx.fillRect(Math.floor((rx + ddx * k / n) * 2) / 2 - 0.25, Math.floor((ry + ddy * k / n) * 2) / 2 - 0.25, 1, 1);
        }
        rect(ctx, hx - 2, hy - 1, 5, 2, "#b8c4d0"); rect(ctx, hx - 2, hy - 3, 1, 2, "#b8c4d0"); rect(ctx, hx + 2, hy - 3, 1, 2, "#b8c4d0");
        rect(ctx, hx - 2, hy + 1, 5, 1, INK);
      }
    }
    if (p.grabT > 0 && p.grabMob) { for (k = 0; k < 4; k++) rect(ctx, cx - 5 + k * 3, cy - 2 + (k % 2) * 3, 3, 2, "#3a9a2a"); }
    if (p.magnetT > 0) drawMagnetCloud(ctx, p, sy, pose || "idle", faceDraw || 1, tick || 0);
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
    if (p.rocketT > 0) {
      /* v1.0 w13: flame + baked smoke, anchored at the feet. -1 closes a 1 px boot gap. */
      var flame = typeof fx64Sheet === "function" ? fx64Sheet("rocketFlame") : null;
      if (flame) {
        var fi = Math.floor(tick / 6) % 4;
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        ctx.translate(Math.round(p.x + PW / 2), Math.round(sy + PH - 1));
        ctx.scale(0.5, 0.5);
        ctx.drawImage(flame, fi * 24, 0, 24, 36, -12, 0, 24, 36);
        ctx.restore();
      } else {
        var flick = (ui % 3);
        rect(ctx, cx - 1, sy + PH, 2, 2, "#fff2c0");
        rect(ctx, cx - 2, sy + PH + 1, 4, 2 + flick, "#ffd040");
        rect(ctx, cx - 2, sy + PH + 3 + flick, 4, 2, "#ff9a3a");
        rect(ctx, cx - 1, sy + PH + 5 + flick, 2, 2, "#e0602c");
        rect(ctx, cx + 3 + (ui % 2), sy + PH + 6 + flick, 2, 2, "#6a6a78");
        rect(ctx, cx - 4, sy + PH + 8 + (ui % 3), 2, 2, "#8a8a98");
        rect(ctx, cx + 2, sy + PH + 10 + flick, 1, 1, "#5a5a68");
      }
    }
  }
  var BON_HUD: any[] = [["shieldT", "shield", 500], ["magnetT", "magnet", 450], ["rocketT", "rocket", 85], ["domeT", "shield", 200], ["wallT", "rocket", 300]];
  function drawBonusHud(me: any) {
    /* v1.0 w13: 16×18 game (32×36 art) plates, hand-drawn 20×20 icons, timer bar 20×4.
       Slot size unchanged. Bar blinks for the last 1.8 s (90 ticks). */
    var x = 3, y = hudY(36);
    var icons = typeof fx64Sheet === "function" ? fx64Sheet("hudIcons") : null;
    var BAR: any = { shield: "#3e6eb4", magnet: "#c03a3a", rocket: "#e0602a" };
    var IDX: any = { shield: 0, magnet: 1, rocket: 2 };
    for (var i = 0; i < BON_HUD.length; i++) {
      var b = BON_HUD[i], t = me[b[0]];
      if (!(t > 0)) continue;
      if (b[0] === "domeT" || b[0] === "wallT") continue;
      var f = clamp(t / b[2], 0, 1);
      var blink = t <= 90 && (((t >> 2) % 2) === 0);
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.translate(x, y);
      ctx.scale(0.5, 0.5);
      rect(ctx, 0, 0, 32, 36, "#140c1c");
      rect(ctx, 2, 2, 28, 32, "#1a1430");
      if (icons && IDX[b[1]] != null) ctx.drawImage(icons, IDX[b[1]] * 20, 0, 20, 20, 6, 3, 20, 20);
      rect(ctx, 6, 28, 20, 4, "#2c2a52");
      if (!blink) rect(ctx, 6, 28, Math.max(1, Math.round(20 * f)), 4, BAR[b[1]] || "#f6ecd0");
      ctx.restore();
      if (!icons) drawHudIcon(ctx, b[1], x + 3, y + 2);
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
  var AB_FI: any = { dash: 0, hook: 1, wall: 2, dome: 3, tele: 4, pound: 5 };
  function drawAbIcon(ab: string, x: number, y: number) {
    /* v1.0 w13: brighter v1 glyphs only. Disc, rings and states stay in drawAbRing. */
    var sheet = typeof fx64Sheet === "function" ? fx64Sheet("abIcons") : null;
    var fi = AB_FI[ab];
    if (sheet && fi != null) {
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.translate(x + 6, y + 6);
      ctx.scale(0.5, 0.5);
      ctx.drawImage(sheet, fi * 24, 0, 24, 24, -12, -12, 24, 24);
      ctx.restore();
      return;
    }
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
    var pre = "ЗАРЯД: ", iw = 8, gap = 2, tw = textWidth(pre, TYPE.M) + iw + gap + textWidth(chg, TYPE.M);
    var x0 = Math.round(cx - tw / 2);
    drawText(ctx, pre, x0, y, col, TYPE.M, "left");
    var ix = x0 + textWidth(pre, TYPE.M);
    if (ic === "time") icoClock(ix, y, col);
    else if (ic === "coins") drawCoin(ctx, ix, y + 1, ui);
    else if (ic === "height") drawText(ctx, "↑", ix, y, TYPECOL.mint, TYPE.M, "left");
    else icoSkull(ix, y, col);
    drawText(ctx, chg, ix + iw + gap, y, col, TYPE.M, "left");
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
    drawText(ctx, "СЧЁТ ВЕЧЕРА · РАУНД " + roundNo, LW / 2, y + 2, TYPECOL.accent, TYPE.M, "center");
    for (var i = 0; i < pids.length; i++) {
      var pid = pids[i];
      var lineY = y + 11 + i * 9;
      drawText(ctx, String(S.names[pid] || "ИГРОК").slice(0, 8), x + 6, lineY, TYPECOL.primary, TYPE.M, "left");
      drawText(ctx, (S.wins[pid] || 0) + "П  " + (S.best[pid] || 0) + "М", x + 146, lineY, TYPECOL.primary, TYPE.M, "right");
    }
    return y + h + 3;
  }
  function drawResults() {
    hits = [];
    resultLay = [];
    applyBgContrast(ctx, function () { drawBg(ctx, world.cameraY, ui, world.map); });
    dimView(ctx, "rgba(18,14,44,0.36)");
    var x = colX();
    var bot = Math.round(insetBottomUiCss() / Math.max(0.01, cssScale || 1));
    var hdRes = header("ИТОГИ", TYPE.L);
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
        drawText(ctx, String(p.place), x + 8, y + 3, p.place === 1 ? TYPECOL.accent : TYPECOL.primary, TYPE.M, "center");
        drawFaceMark(x + 16, y + 1, p.look, !!p.alive);
        drawText(ctx, String(p.name || "").slice(0, 8) + " " + metersOf(p) + " М", x + 30, y + 3, TYPECOL.primary, TYPE.M, "left");
      } else {
        drawText(ctx, String(p.place), x + 10, y + rowH / 2 - 6, p.place === 1 ? TYPECOL.accent : TYPECOL.primary, TYPE.L, "center");
        drawJumper(ctx, x + 22, y + rowH - 16, p.look, 1, "idle", false, true, 1, true);
        drawText(ctx, p.name + (p.id === 0 && squad ? " (ТЫ)" : ""), x + 42, y + 4, TYPECOL.primary, TYPE.M, "left");
        drawText(ctx, metersOf(p) + " М", x + 42, y + 14, TYPECOL.primary, TYPE.M, "left");
      }
      y += step;
    }
    if (why && y + (compact ? 13 : 18) <= limitY) {
      var wh = compact ? 12 : 14;
      box(ctx, x, y, 152, wh, "#201838", "#8a7ab8");
      pushRes("why", x, y, 152, wh);
      drawText(ctx, why, LW / 2, y + (compact ? 3 : 4), TYPECOL.muted, TYPE.M, "center");
      y += compact ? 13 : 18;
    }
    if (hasGoal && y + (compact ? 16 : (met ? 26 : 32)) <= limitY) {
      var nxt = MAPS[mi2 + 1], b = mapBest(mi2);
      if (met) {
        var gh = compact ? 14 : 22;
        addHit("camp", x, y, 152, gh);
        box(ctx, x, y, 152, gh, C.navy, C.mint);
        pushRes("goal", x, y, 152, gh);
        drawText(ctx, nxt.name + ": МОЖНО ОТКРЫТЬ", LW / 2, y + (compact ? 4 : 7), TYPECOL.mint, TYPE.M, "center");
        y += compact ? 16 : 26;
      } else if (!compact) {
        box(ctx, x, y, 152, 28, C.navy, C.gold);
        pushRes("goal", x, y, 152, 28);
        drawText(ctx, "ДО " + TO[mi2 + 1], x + 6, y + 3, TYPECOL.primary, TYPE.M, "left");
        drawText(ctx, b + "/" + M2.goal + " М", x + 146, y + 3, TYPECOL.primary, TYPE.M, "right");
        bar(x + 6, y + 16, 140, 6, b / M2.goal, C.gold);
        y += 32;
      } else {
        box(ctx, x, y, 152, 14, C.navy, C.gold);
        pushRes("goal", x, y, 152, 14);
        drawText(ctx, "ДО " + TO[mi2 + 1] + " " + b + "/" + M2.goal, LW / 2, y + 4, TYPECOL.primary, TYPE.M, "center");
        y += 16;
      }
    }
    var rec = save.mapBest[world.map] || world.best || 0;
    var ah = compact ? (note ? 50 : 42) : (note ? 82 : 70);
    if (y + ah + 4 <= limitY) {
      box(ctx, x, y, 152, ah, C.navy, C.gold);
      pushRes("award", x, y, 152, ah);
      drawText(ctx, "ВЫСОТА " + mtr + " М", x + 6, y + 3, TYPECOL.primary, TYPE.M, "left"); coinsLabel(x + 146, y + 3, world.earnH || 0, "right");
      drawText(ctx, "СОБРАНО", x + 6, y + (compact ? 12 : 15), TYPECOL.primary, TYPE.M, "left"); coinsLabel(x + 146, y + (compact ? 12 : 15), world.earnC || 0, "right");
      drawText(ctx, "КЛАДЫ", x + 6, y + (compact ? 21 : 27), TYPECOL.primary, TYPE.M, "left"); coinsLabel(x + 146, y + (compact ? 21 : 27), world.earnB || 0, "right");
      var dur = 700, nowA = (typeof performance !== "undefined" ? performance.now() : Date.now());
      if (coinT0 < 0) coinT0 = nowA;
      var kk = coinSkip ? 1 : Math.max(0, Math.min(1, (nowA - coinT0) / dur));
      kk = 1 - (1 - kk) * (1 - kk);
      var shownEarn = Math.round((world.earned || 0) * kk);
      var shownTot = (world.coinFrom != null ? world.coinFrom : (save.coins - (world.earned || 0))) + shownEarn;
      if (kk < 1 && (ui % 4 === 0)) hopSfx("tick");
      if (compact) {
        drawText(ctx, "+" + shownEarn + " → " + shownTot, LW / 2, y + 30, TYPECOL.accent, TYPE.M, "center");
        if (note) drawText(ctx, note, LW / 2, y + 39, TYPECOL.primary, TYPE.M, "center");
      } else {
        rect(ctx, x + 6, y + 37, 140, 1, "#5a4a7a");
        drawText(ctx, "+" + shownEarn + " → " + shownTot, LW / 2, y + 42, TYPECOL.accent, TYPE.L, "center");
        if (note) drawText(ctx, note, LW / 2, y + 62, TYPECOL.primary, TYPE.M, "center");
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
        drawText(ctx, "НОВЫЙ РЕКОРД КАРТЫ " + rec + " М", LW / 2, y + 3, TYPECOL.accent, TYPE.M, "center");
        y += 15;
      } else {
        pushRes("record", x, y, 152, 9);
        drawText(ctx, "РЕКОРД КАРТЫ " + rec + " М", LW / 2, y + 1, TYPECOL.primary, TYPE.M, "center");
        y += 12;
      }
    }
    if (nh && y + (compact ? 14 : 22) <= limitY) {
      var nhH = compact ? 12 : 22;
      if (nh.left === 0 && !compact) {
        addHit("shop", x, y, 152, 22);
        box(ctx, x, y, 152, 22, C.navy, C.mint);
        pushRes("need", x, y, 152, 22);
        drawText(ctx, "ХВАТАЕТ НА " + HTO[nh.i] + "!", LW / 2, y + 7, TYPECOL.mint, TYPE.M, "center");
      } else if (!compact) {
        box(ctx, x, y, 152, 22, C.navy, C.coral);
        pushRes("need", x, y, 152, 22);
        drawText(ctx, "ДО " + HTO[nh.i] + " ОСТАЛОСЬ ● " + nh.left, LW / 2, y + 3, TYPECOL.primary, TYPE.M, "center");
        var runsLeft = Math.max(1, Math.ceil(nh.left / Math.max(8, world.earned || 8)));
        drawText(ctx, "ЕЩЁ " + ruCount(runsLeft, "ЗАБЕГ", "ЗАБЕГА", "ЗАБЕГОВ"), LW / 2, y + 12, TYPECOL.accent, TYPE.M, "center");
      } else {
        box(ctx, x, y, 152, nhH, C.navy, C.coral);
        pushRes("need", x, y, 152, nhH);
        drawText(ctx, "ДО " + HTO[nh.i] + " ● " + nh.left, LW / 2, y + 3, TYPECOL.primary, TYPE.M, "center");
      }
    }
    var lab = squad ? "РЕВАНШ ▶" : "ЕЩЁ РАЗ ▶";
    btn("rematch", x, btnY, 152, 28, C.mint, lab, TYPECOL.ink, TYPE.L);
    btn("menu", x, btnY + 32, 72, 22, C.navy, "МЕНЮ");
    btn("shop", x + 80, btnY + 32, 72, 22, C.navy, "МАГАЗИН");
    pushRes("rematch", x, btnY, 152, 28);
    pushRes("menu", x, btnY + 32, 72, 22);
    pushRes("shop", x + 80, btnY + 32, 72, 22);
  }
  function drawFontSheet() {
    hits = [];
    dimView(ctx, "#120c28");
    drawText(ctx, "ШРИФТ", LW / 2, 6, TYPECOL.accent, TYPE.L, "center");
    var words = ["НИНДЗЯ", "МЕНЮ", "КОСМОЩИТ", "ЗАРЯД 40%", "КУПИТЬ ● 80", "ДОЙДИ ДО ЦЕЛИ →", "ИГРАТЬ ▶", "ЕЩЁ РАЗ ▶", "С БОТАМИ", "✓ ЦЕЛЬ 500 М"];
    for (var i = 0; i < words.length; i++) drawText(ctx, words[i], 6, 28 + i * 12, TYPECOL.primary, TYPE.M, "left");
    var keys = Object.keys(FONT), x = 6, y = 28 + words.length * 12 + 8;
    for (var k = 0; k < keys.length; k++) {
      drawText(ctx, keys[k], x, y, TYPECOL.mint, TYPE.M, "left");
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
    HUD_INSET = phase === "play" ? Math.max(0, Math.round(insetTopCss() / Math.max(0.01, cssScale || 1)) - VIEW_TOPPAD) : 0;
    syncBackdrop(menuMap());
    if (phase === "play" && world && world.phase === "play" && !paused && !simHold) {
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
      drawText(ctx, "ПОВЕРНИ ТЕЛЕФОН", LW / 2, LH / 2 - 14, TYPECOL.primary, TYPE.M, "center");
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
    bg: function () { applyBgContrast(ctx, function () { drawBg(ctx, MENU_CAM(), ui, menuMap(), true); }); dimView(ctx, "rgba(18,14,44,0.32)"); },
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
    if (!document.hidden) lockTgSwipes();
  }
  var envSide: any = {};
  var testInsetTop = 0;
  function insetSideCss(side: string) {
    var sum = 0;
    var tov = (window as any).__hopTestInset;
    if (tov && tov[side] != null) return Number(tov[side]) || 0;
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
  /* Bottom UI (tab bar, НАЗАД): only the system home-indicator inset.
     contentSafeAreaInset.bottom is the Telegram pull-bar, which we disable;
     counting it too left a huge empty band and crushed the shop hero. */
  function insetBottomUiCss() {
    var tov = (window as any).__hopTestInset;
    if (tov && tov.bottomUi != null) return Number(tov.bottomUi) || 0;
    if (tov && tov.bottom != null && tov.safeBottom == null) {
      /* tests that pass a single bottom value: treat as the system bar if small, else cap */
      var b = Number(tov.bottom) || 0;
      return Math.min(b, 40);
    }
    try {
      var tg = (window as any).Telegram && (window as any).Telegram.WebApp;
      if (tg && tg.safeAreaInset && tg.safeAreaInset.bottom != null) {
        var sys = Number(tg.safeAreaInset.bottom) || 0;
        if (sys > 0) return sys;
      }
    } catch (_e) {}
    return insetSideCss("bottom");
  }
  function edgePad(side: string) {
    return 5 + Math.round(insetSideCss(side) / Math.max(0.01, cssScale || 1));
  }
  function pauseBox() {
    return { x: LW - edgePad("right") - 22, y: hudY(0), w: 22, h: 22 };
  }
  /* Expand the Mini App and turn off Telegram's own swipe-to-collapse (the white bottom pull bar).
     Version-guarded; does not touch the in-game upward swipe that fires the hero ability (onPtrMove).
     Never logs initData or the token. */
  function lockTgSwipes() {
    try {
      var tg = (window as any).Telegram && (window as any).Telegram.WebApp;
      if (!tg) return;
      try { if (tg.expand) tg.expand(); } catch (_e1) {}
      try {
        var ok = !(tg.isVersionAtLeast) || tg.isVersionAtLeast("7.7");
        if (ok && tg.disableVerticalSwipes) tg.disableVerticalSwipes();
      } catch (_e2) {}
    } catch (_e3) {}
  }
  function bindTgInsets() {
    if (tgInsetBound) return;
    var w: any = window as any;
    var tg = w.Telegram && w.Telegram.WebApp;
    if (!tg) {
      if (w.__tgReady && w.__tgReady.then && !w.__hopInsetWait) {
        w.__hopInsetWait = true;
        w.__tgReady.then(function () { bindTgInsets(); lockTgSwipes(); });
      }
      return;
    }
    tgInsetBound = true;
    lockTgSwipes();
    var bump = function () { lockTgSwipes(); resize(); };
    try {
      if (tg.onEvent) {
        tg.onEvent("safeAreaChanged", bump);
        tg.onEvent("contentSafeAreaChanged", bump);
        tg.onEvent("fullscreenChanged", bump);
        tg.onEvent("viewportChanged", bump);
        tg.onEvent("activated", bump);
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
    heroPose: function () { var p0 = world && world.players[0]; var a = p0 && animSt && animSt.get(p0); return a ? a.pose : null; },
    net: NET,
    profile: typeof PROFILE !== "undefined" ? PROFILE : null,
    getSave: function () { return save; },
    getFlash: function () { return flash; },
    getSize: function () { return { lw: LW, lh: LH, scale: SCALE, pScale: pScale, pScaleY: pScaleY, cssScale: cssScale, dpr: Math.max(1, window.devicePixelRatio || 1), isWide: isWide, isPhone: isPhone, phoneLand: phoneLand, paused: paused, landPause: landPause, manualPause: manualPause, resumeCd: resumeCd, cw: canvas.width, ch: canvas.height, viewPad: VIEW_PAD, viewCrop: VIEW_CROP, viewBot: VIEW_BOT, viewShift: VIEW_SHIFT, fieldOx: FIELD_OX, fieldOy: FIELD_OY, viewTopPad: VIEW_TOPPAD, hudInset: HUD_INSET, phoneInt: PHONE_INT, devW: DEV_W, devH: DEV_H }; },
    hopInfo: function () { return lastHop; },
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
    /* TEMPORARY: hook for the background-contrast setting (and screenshots). */
    setBgContrast: function (p: number) {
      bgContrastPct = snapBgContrast(typeof p === "number" ? p : 100);
      save.bgContrast = bgContrastPct;
      writeSave(save);
      return bgContrastPct;
    },
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
    hold: function (on: boolean) { simHold = !!on; acc = 0; },
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
        jumpH: JUMP_H, gapCap: GAP_CAP, rowSep: ROW_SEP, xSep: X_SEP, lw: LW,
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
