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
function drawBonusSprite(ctx: Ctx, kind: string, cx: number, cy: number, k?: number) {
  var m = BONUS_SPRITES[kind], cv = bonusSprite(kind);
  if (!m || !cv) return false;
  var kk = k != null ? k : m.k;
  var dw = Math.round(m.w * kk), dh = Math.round(m.h * kk);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(cv, 0, 0, m.w, m.h, Math.round(cx - dw / 2), Math.round(cy - dh / 2), dw, dh);
  return true;
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
  var dev = size * sc, im: any = null, k = 0, srcN = 0;
  var cand = [[im64, 64], [im32, 32]];
  for (var i = 0; i < cand.length && !im; i++) {
    var c: any = cand[i][0], n = cand[i][1] as number;
    if (!(c && c.complete && c.naturalWidth)) continue;
    var kk = crop ? Math.max(1, Math.round(dev / (n * 0.66))) : Math.floor(dev / n);
    if (kk < 1) continue;
    if (!crop && n * kk < dev * 0.8 && i === 0 && im32 && im32.naturalWidth && Math.floor(dev / 32) * 32 > n * kk) continue;
    im = c; k = kk; srcN = n;
  }
  if (!im) return -1;
  var side = crop ? Math.min(srcN, Math.floor(dev / k)) : srcN;
  var sx = crop ? Math.round((srcN - side) / 2) : 0, sy = crop ? Math.max(0, Math.round((srcN - side) / 2) - Math.round(srcN / 16)) : 0;
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
  if (fine && ctx.getTransform) {
    /* Menu heroes: sub-game-pixel motion snapped to the DEVICE pixel (a menu game px is ~7 device px). */
    var mt = ctx.getTransform();
    x = mt.a ? (Math.round(mt.a * x + mt.e) - mt.e) / mt.a : Math.round(x);
    y = mt.d ? (Math.round(mt.d * y + mt.f) - mt.f) / mt.d : Math.round(y);
  } else { x = Math.round(x); y = Math.round(y); }
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
  drawText(ctx, s, x - 1, y, o, 1, align); drawText(ctx, s, x + 1, y, o, 1, align);
  drawText(ctx, s, x, y - 1, o, 1, align); drawText(ctx, s, x, y + 1, o, 1, align);
  drawText(ctx, s, x, y, col, 1, align);
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
var ART64: any = {"hero":{"pilot":"data:image/png;base64,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","ninja":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAtAAAABBCAYAAAD48pNTAABxZElEQVR42u29eXgUx701fKq6R0KAIWxmkxAgJGGEjDa0zWgXYOMtjm+SNwEv97Wxk3zXMV6TGIwdG+zEC+A4N4lNcuPEJvcmeR1fJ7HNIs1oJI321UJYC0IsYjVLwICQZrrr+6O7St0zI8CJgRmheh4eNKtmStVVp06d3znAcBtuw224DbfhNtwu2CyyzACY/pGBn4fbcBtu11ijV/KXbSlvYhSEURAmEWL6efhPMdyG23C7ChMgM/0jhFFC2JiwsOE5abj5NEIIJEqQmZyJzORMxM6OAiEEY8NGsrmzo9jc2VHD42a4DbdrpMlX6hfdd9e3GACo+ma9MDNfPFZS5QQUxTjxkOE/zXAbbsPtcjeJUrhVFYuzCgEAqqqCShK2lW7HmLAw1tvXB7eqDs9Jww1uj4foLDSopHFPEydORdvuLpw+34tTu7tgkWU/Y4wwlQGMseExNNyG21DaUF8usPzo1+aL2xv+sgMA8OjX5mPDX3bgnb/8D+aEz8aMyJliV69qixSKXXbce9e38OjX5mPBslXi88mSxDyKMjwBDTefZpFl5lEUMMZMA1qWZbg9nmAeM2JTSQgBY+wLX7NLchcPyohtLdl2TVxPzZvXsd+V7Dfd19qxGwAQFzMb6zf9CmPCwpCeYgUIgaookGQZiscDAHBWlsCtqmSQv83wnDTE5hK3/ncfbMHkf/jstCyo2jUJSghUxlBeUw6LNu8Yx8bwWBniTQaYom2WoKoM6vDf+6JrGwURF5ROrAZdf12WDywRwhTGLvqLC6z5AhwAAGMMtY01AIBT5854f77hSWi4XXDhy0rLBmMM/f39AABXnYuPRyjByf6wv8XGiht3dHZAVb/YREMIYfnWPFAqaQs9JRw841q5nijAclIyAQAho0b7fc525zaMDgtDalIGqCTpvc+gqiokWUb/2TNw1FWI/rJQygD4A9ZBtzm73OtBMM4lAJCRnKF1CtXYZqaqUBmDJElwVjohUYKMFKt5rOlAulKfexSVEYkSlpaYgerGSijqMAs9VOeY92NixO1fnj6LoqMH4bnEvzcH4N6Ahw3Ra9JCJfaHufNM9319Z0vQzUHkMr4xi4mIwozImWCMgfJJiDFx217hgC3FCovFYmTYBJA+de4stDoNYOzI0exsXy+GWehrt0mEMFUfHwaAKG4TAJkpVoSEhJheV1pZAhWArAMjzkrrG72AHk+UEvZBdIzpvts7Or7QcbAsSawgqwCqygzXmApnpRMeRbkmgJMFhOVY80ApFTKNgZWKwd17DvWtjQCA5LhEWMJGglAKpp+MAYC79xycdRVYueI72PjrN5GfmQeny4GHVzyE9Zt+FVR9SAlhi+bFme7b2rpjGETzuYZqdTnWhTYBoMVwUVV4PAoq6itgkWUBtAFAZUyAaFetC2AMIARZqTZ4PMowiB7iAHqE11hZ0tZ2ydeUDLAc64C01VnpADTCBKo2psjQ6S/C3ouLF7c9+rr0zZ07oCJ4vudl/aASISzfmq8drRNiYpr5Qr5/315Ezpzl81ou6Sip0hb5sSNHIzE+Cc7q0iG7KxtuF21MIgTpyZl+H6xpqobb4wEhBLkZuT6P9/f3o6ap2giig+FUg706Px6x7n5xx527dvlsJDc99zhb8dxrfr/HpuceZw89vx65k6dDir7BgBsZes+dQ0VDJd569jEM9vqhtMhxJtoycpTPBswIpNMX2sR9hFLTc6p0djE9xSpAtRp8cxK7eX68CfgNg2jtxEaWJC7BgEQJKJWQlpQOSoipvyRJAlNV00ar+ZN6LLgxWTynuqEKCxekauNPonDVuoa10EOwybrOnTKGD+fO9QugBctMCMCYafEx/pxnANGAdgJiLyvSHB8oAVSGv5c3AQButSXAE6DXq4VKzK0q4FINrw0Ao4TgvXnxptfc1doyDKAJwAgI+BCJiYjC1GnTERISIsC0N4vI29493QCAyJmzoKoqPB4PSqvLkG/NEz8HUwcPty9/4bf6YZmNzVHhQPjk6YiZE2saZ8bHLbIMj8eDzBSrAN4BDBxMUg5/ABoAo7r+zt91xfvBmpyJ0deNFs/jINpVX4FNzz1uBNFDQjJlAWFu/atwbmh0WBiS4xKFnEOcYBDfr8oYQ1VtuQDMAFBV59JY6pGjoCoK7C57QAJoSghTzePfRxJnBNEA8PGOlqD/m/+rADojKUMUCXr1p2CYjeDGCKJVxtDS0oCEhIVgqorS6jLYUm3iNaXVZdd0/wZ7G2GxsH59c6V61aTIlDBFZfhfg5Tjqx0dgvCj+hxtS8sWj0tUMr2/3WVHTkYOZNliOv3i48tR4QBlDOVVmtQ1PT01oNet9+NuFOzyt9t2wq0qxACuiYVK7E83aCdhHsYgE4JvfNoqnhfwG6d/ndUhjM8nqr6rooQg32sXxVlno4TDKNngLXLmLOzd0y2A9IzImQKIy7IMNmy5eU03a4oVVfUVSE/OFCDaeLJBCEH45OkXfI/wydPRc+QALLKMkJAQTJ4wGT1HDlz9i1ErlDV+H23ipZc2lzAGFNjyQankAwo5uN5euh2LsheJ25JEMSJsBAqzCrHiuddAKWGqygilBJRQ/PKZlSyYmWk3GBZnFWqyDePxKiFigSIGeZk/IJ2alCF00JawkQJ8i3lLZ5QCramM4eb58YJd3r6zlXEWSAeDZGvrDrYkbr7p+VtbdzD1GmFJCSGMzxtgDJQAlhAzeOF9w8GxsXG2mYNoqqpISFiIpqZaJCQshC3V5v37wBgTOusgL3IetD/93B/UzPsIi4UBgEfx4GMDmbGkrY29+tRKPPHyRuJRGaGG2oIRlJrQigqQ+Oj5TPJ4gJBQc//oAPnG2HhUabUWsKXnDMzt+vjKy8yDo8KB1U8+jZsy5kPWGGkWgCw0s1BJgGKfeVkHyG5VwTc+bQUH0QCgeF17AT3e/9U34B7OBbYCHzDMJwvjfbxIEACmTJjs834RMyJBKTUx0UbW2u6yQ2GM3HfXt9i7//unYU30tdOYRAi8Ly0u1fAG0caNGwB0dnUIRpoQAkeFQ7y2s6uDA+irNpb4wuNdNMg0+yvT/be1tw/2WRkBUJi9aGCD6wd8F5cVi2NCDqS161RnOAiFR1FQYMtHcbk9qBgzC6UMKoOiL10SCGwpGUKyIXYahoWrsqZM3M5IzdLGDJduGCbzqjoX0hfafMZXUel2wUBTgAUIG80oIVg0L06wn1tbd/jTUTJKCJbEzRfs6jXGQjNvHbO/jUhLSwPOufuRkZwhNiRcwgFo0g3e4uOTAEAw0bwdOdKD9t1d3B3oS1uDA6lJEmWKoiI9KR1hoSPE/Y7KEtNmXlGCq/iWAuxjXZpxXlUxglLx/x1dXTjvdguZxns6A31HRwdkSuBRGXn1qZUMALZU7kCJqxhQGeJi4zFx4iQfjf1nR4+gfXebANAcPBtbSVkRFGhofYTFgvNud8CMpTUrH2cv/WyjCRTz5i3RWLPycbb29fX44w0Drm3BpIP+Uj6kLEkMAPIz87wYsQHgu2/vHhw+fgSpSWl+AQ8HzIePH0FacjoAs5yD3+7Y3yUmLp3xHgbQQ3RhM27CACAvM89H/uPNGPoD0Px2x652AEDMnFiUVZeCu3YEAoCGl0yDtzt37YKiqvir4VhwEAmHqd/yp4bDEjvPFwwYpBuSfkxtlH0AQFHpdjAMsNkO/VixuNwe8NeahVJmS0qHFDrCh3H2Bs9VdS4NMHstUIwxqIqCmoZKABDOHPy+jNQs8dz+s2fgrK80ve/VBtBLl9zEtmzbCs4sG5s3OF665Cb20dYtpudeazpoopNA2enZJsaPt+ZP6oUkw5+Ew1npRE5Gjs9rCaU4cqQHADB5crgGoLt3g0tEymvKh2Q/SxJlCxekIix0BKiknYb17NurzcH7uyBJ1AdAF2YVsvrGGpw8czog+4MAjEszvAsFz6sq7uzsxPhR03Gm7wj+OGuWANAw6J9tGTmQqARFVbR+0uUb3uDYX/vs6BEAwKTrNdLR43GjvNKJ3KxC8XOgsNCUEPbHG+b7ZZ49jJmkHNqcrTly8Od7g2wLlfwe7wWCzONLCVIZFRqGz8+dxbayIsiShKhpMxE5c5YALjUNWuHWwsRUH+DMWWVAY7FnRM4Ux60RMyKxf99e7N3TLTyjKSHITc8BIQRFLntAHp0Oty+nWXXNqT+9s3EccWAMANFRMYOC6+ioGHR2dQAAbAYQ5AeAXvEL05/+FgDenzOHM84XBQFGJYHj8AFkTpuBkaNG+bDQ2m3tPnf7TpQePYTs66eCzpkLSaJYnLsYW0u2gRBNZqUyFbIsB8WYcasqcdRVsMVZhQPSCuP/+s9VdS6kp1i1zZg+D6mKAqXvPADAWV+JRdmLTMWDkiwjfaENlTVlAngDgMSAvOxFQg99tZs3IDa2JXHzTVKOj7ZuIVQHkHSQMUgHSYodKjIP7s7jrHRibNhIE4MMDDDK3n2k65lNoJl7QYtrmjHEzo4SQDo7PVu4eAQzQFYU1e8cxhiDqjLUNtcgNyNPn28oInQ3rq6D3dBfy4xA2lFh99nIBxrTOOIiQPfvRX9Bbpa2Zt3V0cFrLsSXKq0qRb6tALIfVxfjaZc/QD1x4iQBpPnP0Od1iUoItNH07bad2toty3g3eoAYkgmBWzV/2hDD2vKNT1t92Ge3qiBxSgTGzpot1q+TXV1oPtLDwiwhONvfd9XmoS9lVTx17oz4AoqeKLh3TzcOHz8inpOWnC6cNQBg3949pl18XkaueNxR4RBAQAUQGzFbLGRGqQhhGFZED2FiqKq+guVk5g3KOHP2OGZOrGlTZmwc0EiEIDsjF9FRMejY1W6Sc4iFwY9N3pVqjDHc1t4OSgm8besG3elTwrjEgxAg31rgl1VWVSakGsb/AcASOw950Tdge+l2FETFQFWJeEwcuRKKf8uNN3pHB3SzUIqi8mIBfHNSMmEZOUp8n8rachOLzBiD+9xZAEB9ayPO9PZC4guaDoIcZcUQfAdjYKoKd+85AEB+jiaZMVnjXeW2fWerDnYkFM69wQQAvQoLIRk+tz/2WWUMU8ZPwJgJE8S4OHXsGA6fOM4swR9WZPz8bMGNyfB4FLTubAIATJ06FZIkQVEU8X91QxV4rQKfQ3ifcv9nMR8BaNMTCjOSM0RhoUWWMTZsJE7pYyjoJmedyOIMs3FOBgCHy479e/dghn56zB/PzcgTNVCOCjsAsHGjxwAATp45zaVsATeeVAhHDciAyWnDH7BW9X+FesLpoPO+Dp65bCN29lzBMpv6m1IBpI8d+wyTrp+MXGuBX8DN6YKr1leMEZXpINkDdtfOFpPbBgURidQWKomizLt2tgy2KSc7jh5kGTNnafOXyjB21mzkRkWhurbyqm+svlQcQEEQHTEbh48fwZQJk4X7BgfHXN/cdXAPPIoCWZLgURQUWvM1bWplibjfAMohSZKQiFTXV+FM71kQSoc10EO7iZXeIsvI0quX/emajQwIIQR9fX1w1blgkWUT28wf27t/D2LmxKJjVzuOHD8Ct8cDa4qVh69c1TFFCGFGycZt7e0wWtnd3t4OBhBKCcvXJ1FJoj4MDqUExWXFoiiDMQZZklCQVWCe8PTXKZ2fgkTFCLaZa6NLKhziOluSu5gFWYIhy9Ot68obqpCfVSg0ztCtNStrynDm/HlIDHhfB5vf3tuN1CRNF1vksuPvXqb/d7Z9CjcY8lIyhZvHVue2qz52fDZZuhOH0W3DKOPg7PKieXEXlG5QQlhU1BzThpMQgt27u4ZKIRwzzh+MMcydHYXJk8PF+tPUVIvTvefEpCRRgg+iYnBrZztsqTZIkoTy6lJ8EOW7Ab5DP/nKSLHCVesCJQh2P2iWb803mQHwzSVP83RUliAmIkqAaD4HCfMAVUVv33lUNVSZQHlJlRNfGXVdwMo5cjNyWGlVqamY8JaOdnxl5HQcO9NDALAPYmJwV0cHci8AoJmqwqXXX1hTs0yOLsbmLd/g9xlvF5UVcb21KBAOHEJjwGmDs8xuVSGjQkJZzPjr8fT4r+DrO1uwZuXj+Nv//AnNR3pMCZ88qZASYpJZqYyhr68PDc11gqm+0vPvl/rLJELEtRQdodHtU6dNhyzL2K9roNr3d0GWJPxh5myM0UHyrV2dyMvIhaOyxHS/sZ1WFHyjqxOL9QVwu8YwDa0KZh0wDuYfRoaYmboxgvtiY1IiRLDRXIZhlGt4s9I9Rw74+EGXVpaAJ2Ryp47IiJkABmQijgpHIIwrHz30be3t8JdKKEuSj2+ocbGyu4p17Tj1ceTwYQ5UBc5Kpw/ALi7T2FwDEL/qY1BUuxt0KxII3IbjPwowiVItjIAS2JLSYQkbqX9XFUrfeTj1ive/egHk10Z/BZaRo+AoL8b7MXP9foY7O9oAlSE/ZxGYqqKorAiNm9dhwbJVAQeivTXOKmPEIstswpixWDB1Kra27sDSJTehobYWh08cH/S9YgynI4wxeNwe7N23RyxoQTwni5qLWP2omLeufXvh9nggUYLfzIjSmEDLwBp1a2c7cjJyBgXPxnZrZzuy07Jw9LODaNvdFdT9xTcaMRFRiJgRKTakxiLcfXodU0TkTJOpgBF4NzTV4uSZ0wCAvIxcNLU04HTvmYAuNBxhsbAPoqLE7Zva2hCqFfORERYL8ygevDcnGnft6gRUBtli8WGXy6ucJqcN71Ze5QQAUzEh+vuAkFDBQvNW4ipGTnImFFkOKD20N4A2WtSNCgllb8/RrpdvfqrNSYlTIthYw/VnDCYqry6DRCgyUq1CSqUyBlmisLtKYNE15dweL0SWL7u84/L4QBPCYsLNk9Cunt1QGMMWP4vRTR1tgoneMshixYE2Z6trG2tw+tyZIVVEKEsSU1UVeTZzMebJEycAAJ+0tQw1xp1tnmlecJbt6fAXvc0kQjD1+mnoOXIA4ZOn+9U6G+Uain58mqufWpTXlGFlfDISTp4EANyztxMKY0LaEUDg2S+A9gbR7ZYQPKExiQD8Fw1uLdmGJbmLBVg2aqEVRRUhKoB21EgpgcfjQXG5A0tyB5w8tjm3ozCrEKqqXHVXDgs0xvR9gyzB2G7XtXcqQCyUsrDQUJzp7QUPUJFCRwjgLFEKt6r6sMucgT7T2+sDrP3OS207sSRnMRSPJyA9oY0A2ujEYZFllh87V9wPgEwZP4FxqQYHyRz4dO7qBCUERiaag6H2jnbjokYoIUzSAkmCLmBm7mwNGLV37xbf8e2Zc8QTjOAZAG7b1QHGGP4eHXvxsdLZfkXW4Mu90eAfnAHgEozkxFTRX8ax4d04qJ6hZz0wVUVJZYkgOw707Oda6aAB0OdVFd/s1r4Xd+Tg6YR3dnQgPnbgBKh9d5uJdfZunHFu7dwBW1o2JCoJdtpZ6UCutcCHlTbqqItdgeWcNBiANsZ5f7ttJzjgtVCJZWVk+Sd5dCC9MCEVYSNGmB471b0bjYf3w0IlKEyFRKgA1EEFoCkI4wx05/7dUMHwp6hoAPDLLt/c2Q42CLj2B7YJNN2eqqhDLlSFH7kuyikUshe+gDnKHQNRxEEsX+HWhypjeHemf8bmnr2doJKEV556HI+/9LIAu1Ovn+bDPpfXlEFVFFBJwtuGjduyPR3It+ajY1c7fho2yu/vWbanQ8g8+vv74apzBUSfypLE3p8zxy+INl68r8yPxxM7WpA/NVxjIo4cgKoy4fVsbB6PB0xn70t03+s8fYPBujpAomJAqYRzZ88ibORIFJcXY3HOIk0fbQsMAE0BdjFQ+8658/jzvt3IScnExkdvQcqy1bClZKC+tRGne3th0Zhqv8D5n2kctEuUQlHVoAHQxjjv7TtbwQEvJYRFR8f4rQXgQHpW5CxYQiymx04fP47DJ477BI4E2qkZd90Q0i8ATZvXAQAWLFsloKERNA8Gnr9ou61Tk18Z6n0Ddg43ejob3Y+EdMNQ9Oav/sS4AfO+jzGGxuY6JOk2f/byYuRb86GqatACaAC4s6MDL+u+0K8+tZI9+fJGEJ280A/CEBc936/OmYPi9t1t8LjdUAkR8zOhFCVlRfDoA0YCEGcA5ZOun4zyKic8bnfAJRNeiIE+299nxI1msAxmKh7017xdcXrPnxdWybb0LJRWlV5esvjL2o0a35OHq6iM4Y86cOZtjCThpo42SPqXJpRCVdSLZhEwMJAB8Tm5765vsbff++9g3MGDGsz7xW7d64/CACzKKTQ9wPvg+PFjaGhtMv0NDaljgTshG77NYMDZH4hWFUX4P0/XAXTMnFg4KxyCafb3fpzN/n1k9AV/z309u+H2eJCXmYeSypKAMfynlLDBCgrbLZrk5IkdLVr869RwOA4fQN6U6T5M9JnPzyD04D5toTrUow0QQkRBLgCucxZsNgDhzmGJnQdF0SQKuvzjivePBYR9bcYs3D1yxBd63TvnzuOP+3bDoks5/DHXt7ftBJd6KGBcCsKv1QtOTBIIFDDBeLu1hTRoGGiDH7HfZiwe9DsvewEkd78b3Xs1Ji56TjQ6d3UGGtPK8hNS8djZU6Y77+zuGthk6vf5A9AAcN+eXfqGSZdC+ZF9+L1mu3fz+T5Y1iwmSRTZqdnmMe/Hkcc4Dup1AJOcmOpX06uqqnju/r17ED4jEkwnhRiAnn17BYAeN3oMAxBwemhvAM1B9AhKcVNbm5hjYQhbYozhRh30Trp+MjwetzhdbunYIeK9GYAPdOY6z5oPQimKyorwQUyMqWBxwz8+R9HhAwAloqDQXlYUcBt4bw20l00dy07PNoFgo8SQSzSMp6imAnnG8PmeboyLioKqMsFQ29K0uqe+vj5UN1YHFoDmWuf/iZojQPFpRcEYScLSjnY+XnwA9De7OkFAQCUKm25RVlpdBkIAhTE06yzAYC1h2SpQ3+P9oGtGqYa/XTsBwfbSIgDAYsNROlMZCCVQdKDjKHcIhsdoNRXAOmkfyQYHyjzFEgCeTEzD+qYaNLy71vS8Wx77BQAIfTNjDJtnxnwpH2zZng4j0xIQcdY8mVCWJGRfPxWPjhnlA6AB4InWFnAtU97UcEjRN0BVFbCuDpQePaQBA0UBTxfkt3mFuN1VbABbuosHU0EJRUFWATwejzFg5ar0xYWY51t1Btii/5n8geR3zp3HX3r2mPTMnDkGBuK9AcBRVyEAd93mtRf8XInLVulsSeCCIm8NtJcXNIueE+1THOh9DO+PieSPf37iBMZOnCiYxc5dnYieo837HreHA+qr1j8SJUzV3WouRWZxzK1gRc8ebAqfCQB45MhB4ZZBCEGGXlxa2VCJpnfXYsGyVSCEQJYk1P3ux37fc4E+TnTnjaAC0ACEJR3REzy9fdN5MzpveAPs/QbnrenhEaCShP1794if+Vjbt6dbAGiDZV7A9dlgINpfu6OjA5QQxMcMXIdGpvn96AGcxEHyTW1tKMgqRFFZEbbO9X86f15V8cvTZ7HtyEHkZeZBUZWA00BztvntOTHC6/nO1k8EV5ibkTNoXQ4HzdW1lYgZf712DRns7PhrauurkLZQuy7LKsuQlZEFj261qLPQgQGg+fH7hxeYiE7rAO9bu3fhv2fPwTe6OvlroQLISc0Slf61jTU429erLUKaJMN0pAYA2StewulzZziiGSKSDcJkiSInM0eTo+i7cuMCVeQs0txHsvJNExVfqAghKC4tFiivICsf9jJ7IPeRD4Dm7K/XWGQWWfZZjBytp7HyxZ8Oyjjfs7cT3jZ0orLeCxHz8aiDH1CAb8yY9jLCmnQAn3Lvsxq7dpX1nLIkMZWpJrD7kxvmCSaaM8e8cbb5FYODhwCP7e0ozF4Eh8sOf1IR3m5rb0f+1HCQqBjYy6/e2LKAMG9gzNll49ixgDDFz8HY12fMxp/3d+OvsTcMAGdChF7eGAJV5LKjefM6ZD2wFmfOn4fKGCyU4uH7H8S9uRHamLj7GS7XCApGkeudOdNjANEsJjrGb0CR8RravbsLE8aM1QgTg50df013927M1rXDnZ0diI6OERI0nYW+Kn1ECGFgDH8bZL3SJRWmBZEamGXOCnJyJ+nu1UhL1IJQXLUu8DliwbJVsMgyPB4PKCVoeGetCTxL+hF+kMZZs8KsQigejwno+gPI/sAzZ5179u3FZyc/E7INI2AOnxGpkSP6c3RLO9H/AX6NMRlA4ZTp+O6YUYM+6a6ODsTFxuOTdq12RQLwXox5HTMyzDe3tYHCbJnHWW5vEH2H7jutQpxgB1y09/txN5ruWN7ZjrP9faAgCAsJQdrCDB92uZ5niOjhekbQbJQoehQV9Q3VSFuYgZNdXbjOMA4DBkDzxMG/e8kybulsFxpV/sW5Z2ZMRBS6Du5B/e+fN00ouWnZcNaUYUzYKJRu+hEORd6iDRpbAkAIKCAYyAXLVomFDkMEQHPJBSUE40aNQXJKqg/LY7ztoyNTGRi059jL7FiUu0gw08VlARu/zC5lHBrBqxE858WNQcq9z5p0zsv3dIiUubzMPPT19aGqvgKv/egprHzxp5AI8WGy/bFDXswznkxMY8ufuF08J+XeZ/0B/aven6/q9mQcQNsP9Yix8oqBdfQHoJl2TV8QQAPA7R0dyLfmXVX9s8l1Q1t9/TK/epQ2AJg0zhw082JCZ10FGnVQlLhsFSRKkZORC3uFA6p+GsbnpKVZiVqQCqWoe+cFAaDDQkPR23ve5PwRyIu80coOAIraPhWR0hZZxuzZUT7s8h694GuWzvoYQbNxTlJVFXv2dGP27CicOnYM140fLx67mgAaABuMdb61sx0SJcJOTqKERc+cjR+qBCt69kBVFaQlZqCivkIAaA6Gve83rl9NXiepKfc+i5GWEM5iByWABjSrzKhpGjAJnxEpTiYIIahvrEFSwkK/44MxhuLyYhRY802bEqLb3R3o2Q8AIjgNALoOdiMnPRdUly8ESb8xrzUelAAeleEDHSh/taMDoRaLSCv0B5z9gWQj22xs3x0zCiMoxc3t7QDTpGQywAJRB80DVEaFhOLd6Fh49HHy9Z0tSJwSYXp+x4mjAOADqo0gura+CjHjr0fHiaNIW5gBj6Kir68Po0aG6XOS9rqSSidGhYSit7//S6+Zu+QgFUIIUxTFR9N8U0ebGNwqwCggnvONrl062DMfazRvXofHf1EMCqB004+8kJSmlG3wc3TKnTqCvDHucW28RI599hkmTppkYn2ME5BJY1ZXg8SkFCGHIYSYfLYJAjZghlzSBGRYxB2tur1R3BgT08yZY70aCOGTp4MxhpCQEGFV17x5HRKWr0bC8tWmDZk3KCYwM0MWWWbLn7hdgHYAqPvdj8Ux7FUBkFQvvBwIQyEAyFM7dwjMIxjnQVLovDuaUnJR8MzHn6PCccFjtsvdBFC+gB6ZEsIkBvx1EIcOGDehXIP5wmY0bl6HlLufAaUUEiFoHGTDxcEzAIwdOQ3HzvQEDSCihHDWGRZZRuHcG2B04JgwZixOHTsmnn/8tKYR9geqOUjirPTx06cwe3YUZs6chf6+foydOFE813hNBdIGVHfDIIo+ni2yzDaFzwQ/UvBjr2maU2Bgpb3H2O+cB3BvznRxl9vjwTnggix/gDefAzwezc1bUsJCU+rnfsPjn538TLyY6M9p1K3rjFZ4/DXjJ01CxIzIgeJEBE1gmk8AEZ8u7+zoYCEWCxjgA545OL6rowMeHZTxtc17M/bTweboZasg6a/zBOCcZHTC6Pd42Dc+bQV34PCXgBoz/nqMnTXbpIWmhJjAMwBcN3MWkmfOwsmuLoyLisLnhw4idOYsyBI1uXL0ezwivOWqAGgK4EMvlwwjeObP+e/Zc3Tw3Gk6IvduRS67eNy8UDKf+zlwDFLXCWb0LCQAcq25AuwylYkzF+PO/dhn2qTDQbWR7UlOSUV9XY1grbVJhoBQDUgH2xRtkWWmKooo9lu2pwNJy1ej4d21AsCm3PusFrVs8HHuOXLAxAxFR8Wgv78fhBDkxY2Bo/U0Pi5r1MaqLQEp9z6LV556XLzn30rqcJMtYdDPxd/DCN6v3hii2FH6IQDAtuQBHD97gEm6EwvXSgOaXMNfu6293TSrEgMTPehqoGumr1bh4BfvJYb3vXTSvEBQBchjDzzEGhs/wWBA3OGyA342CBKPAA/iZqyLUBSFbW3dAe7A4a9NGDMWYyZMMMnGjBKzbt3i7brx43Hd+PE4dewYxk6ciN7PT0O2jAel1OTKoVxF4uMJxVwo2ba7yxvMsvdnReGYW/uMK3r2XBDojhkRhurGSgC3iPum7tWuzSY/m6/mzeuQ/cA6nPIEvPbZ9KWNUdvEK86962A3oqbNwvhJkzAybKRJ1sGBcMf+Lr+/wFnp0I0DiJiLug52C3IgXAfPxeXFoJQMCdmmChCP4mEfGCQbd3R0QNZOQMAA5GZofs/OSieaNq9D8rJVSFy2SiPaKEH9O75jK/nu1VrgFUA8QdIXHEzft6uDvT0nRjvxO9IDMM3JaP7104QEw5iaygExBUGuNceUqBsydZrQPPOiQp35RkaqVm9XXlX2pYPoSx6YFIR9FBM7KICOjYhir4cN2BpxWUdsRJRIJfzTT/6v6fULlq26aOGg8bkIwguJAKwgu8CUkudLWnDzeaChodYElC9kD9RQX6sx0Xpaj1HSESyTDmem/PlB6zHBgjV75anHNQ00IZh+/TQcOnoQDe+uFSD3lsd+gciImfjFo0sFez136bcEgM635mPD9wacJw5F3oJbshK9pUHihnH3fzV10IQQ9mn5x+J22fbtyFq0CPOzb/HeVJokHUbmhuuYnZVOKKoqHF2M7+vd5lpvAgAsyV2MrSXbCAjYpmcfBwB894WNV3VDSwEmeQ1xb430nW2fApTArWog4LEV32G/fvd3SI5LRLmefmZklS/WVm74EPWt2obs5klT8ed9uwO6ePBSrr382LncA1qwQdeP00CxN2P6+YkTImQlNibWNDf19/VDtsj4XHcVGDtxIk4dO4ajJ08gSi82vxpSDossM1U/OqZUMrLC4nNIlDAegHLMreDf93bxEykGAHNnR6Fzz26TrvliLWH5alP/BHDyoPgDfzh3HqikuWJRieLWtp0wFPAx43zC5RzTwyOE//CBnv3o2D+wOfk4bj5UHdTc2rYTuRm5kGQZxeXF+HvsDaCSlzuHouKWtp2QJIqc9FzYXXYTiA/2JgOscMp0bDl8AERf9/lpV/KyVbDpALqk0onmzeuwvfkzPPHyRu+EQYGZEvQTUQIE7TxEQdiCKeEijZBLOUKmTsMO3WmMW90lTonAmgnjcGfrJ2KzQSlBicsJFQwWKsGtKiY5CHfnqK2v4u9zdSQcVKK4tatzUADedXAPoEs3OLCWJYm17+9CbEQUdvXsxtpX/orVTw7oSj+tKdEm306XeVd1zxrOOAsGyKCBDi76GSBFpcWsMLvAByzzHuQFhBw8e+uh/ZNtDJGRs9DYUKc9H0xjs72epsteAq6ggOg6d//guROEELg9Hmx8+gemx8InT8ehowf5rt7Ueo4cwJHjRwAs9btJ8de8wTP/fU++/BoSlq+GrHtR6/ZWV70fOXiel3WzaXcOaBInHq7irUUkUTEgmosGNj33OAfAmGu9CbIkCXabt3lZN+uMI7C1ZBshhDCJUmQt0lxhPD9+jfvEkis74YJ9fcbsi9rZ3dnRZgLPALB+06/I4uxFrKh0u7CtS7n7mUtkTVQszl4k4r2PA4BWwBi0ze3xkK2tO9iU8RNEGuH14zTtssftQc+B/fx5ADRLu5vnx+PjHS0mYN2uOy/xBX7K+AlCDsL9pDljfTW+o7jWVR+OjllkGe/PGnBSmGiRNLCrXzoSJUxPDETS3asv6XcqKoMt1WYChpX1FQEJnCWJ4u9z5wnQzNd6AOL+W9s/ZYwxTkEzAEILzfXLHDgTwASO+f8Mmv1dUVkRPh5EYkYlio/j5uPm1h1wVpUgLyMXJVXOqzLPXCYWGlsPH8AC3cqOFxMefuEd1OuMsy0jx0QqbinXQORX8xai3+02PfZxeROWZiUGqyxI7xNGxkVFsW9Xlon7dhw9CBw9KCQeAIR7B59nOPNcXVuJ9+K0/uSaapkQfOPTVszXLW8pJei/TPKxSwbQ3iBMliTGiwqjps2EkX3mYJcfL3fs7wIBwXtNNfh/y6rFcWhM+GxEzIiEx8uLNNcr3tLj8cBZXRq0g4QSghJXibidn5Uv2GICDehwIMzBsfF/Qgjq62pM75mUtBATdK2hMXDlxPHjfCJj40aNwaneM4HFyOtHge9ewJtZ0mwNiUQIe/yll/Haj54CAPzVWYsn7l+usYG6GwcwoI9u1mKUxfvkxY0BLnC0yo9djeD5r85a3J6zEK889bj4PStf/OkVZ868N0uPrFqP19c9hqxFizDXehM2PSeYYC7fIIqqCicO+6EetLm2AABusN0Mu8uBAlsBKCXIWrQIvwQQUXi3YOfnZd2MnWUaGz0/+xbNzo7whQ3MoyjYUfohyrZvBwC0lW8RDPUVHkCX5gWtMr/FfdtKt2sFY4Dm1mHYdHIrOyl0hAgs8vpDiGNqVVUhDfjSB3MjYydOZNt3too7jp48AZw8YZJ40EFkdbt3d4EXJ/INHSXEBMbJgIQjIFI+JUpAqYSRlhBsDjcXL93a2W7abBsLDBXVpOnGwgWpJpA4WF9BopANp2kB8mfHx3FxJvA6GKj9aF4cbm7dwfjfz9g/3sB5sPcihMBRYRes9GC/DwA+jpuPpfqpSG56DhyVJUOBgIYKkAWx8cyHfTS0qroKAIu/ALYAPCy4JS52VwnhbHTj4f348zyzDFEmBB7GxP8AUFLhhMoYuLMHf5z//Ie58/Dttp2YD1wwiOWKAWgjcOZFgd5uHIAWt230aebAm2naZk0FbEiPIYQISztj0ZyJdaspQ0xEFNr9aKqC4sJhTFRfqYzh2GefYdx4TSfYUF9rAkpcZ6goijBZb2htwoTRmoVUUrJmAXT82DGMGz8ee/XQgomTJpl0hgXZBVBVFc4KZ8D1x7sXCTZJT86Eq84lQDQHtbfnLDQtYB6Px0cGdCFJkJebizjZyM7IZXfkaovh7TkLBYgGgI1P/wArX/zp1Z6gyNaSbaxsezween69AM8AUJBVgG3O7ZAoZf4KbMu2b8en5R9jrvUmMKYKkOzdvO83vJc4uZ2XdTPeXPOYaVG84uzHRX7fO+fO48/7u03V1hYQxpMIe/v64FZVwpnpMWFh7ExvL0AIenvPo7yhCmGhoUhPsQ5YdXmFqaiqCqfLESzuGxdt7R3t4gTm8InjWOLFEBqTBTlI5qyzETwbaz0WzYsDB+UXCmK50k2iBB9E+feOv7O7i8vGTH/XLeVN7CZbwkA4hsZso7qxEhl6noERNHuno/HnByABfWnrl6Liw7nzcGvbTgbDNd+xvwsfXkKap6qoAlxfDDxzyQcDUFLlRFpiWjAXX0KmA9pxj8rIxDFjYK914cbYeGEiMOUZjcio37xOyDIAYNGCSYIAqn77Of8EkBqc/UIJYWGWEPR7PEITLVEKLrfi7cUT/xCFgG5VASUECyaHo+PEUZOThz/A/Ye58/D1nS2wHD0IhalXH0DHRkSx9v1d+FNUtN9I7ps62pCblo2S6lIBtEeHjcKpc2dEoVOhNX+AVa4pQ8f+LsRERCFy5iy/XsicnW7f3xXUi5XKGHl25WPs57/+DQDg5IkTAvwCQGJSiglINzXWIzJylkgc5I9zcM3vp4QAhvfhDLeqqmhqrA+4frjYRLhsTwewp2Pg2JUxE3AGgMdfehnpyZkICQmBo8Jxye4YeZl5PpOxo8IBR4UDpZUlgunmINrusmPi6PCAoYxWPPeacHABgP9X0oJ/y43Hv+XGY8Vzr3nxS/52+g4AT/nbFPu9z1igyEH7Q8+vx6LsRXjwx+uhFzFetQ65tW0nvJdinRUeAM+UsgGd8y3IemAt3L29DAAeW/EdNDZ+Ail0gNFW+s7DWVcBh8sugLQ3aHe6HFCCn3lmFlmGoijGaG8fWVDzoUOmeG5Ak3IcP30KhXNv8Hm+8X0WzYvD1tYdOHryhN/nXcnGay1+MyPK7+N3dHWAUi3K3CLLzAB8BeuakZQhNMK1zTVwezxw1ZRr8gRKkJFi1a3LBvrq2LFD6Nq31+d0LFDbI6d7fYr/OEj++9x5WN7Tg3+c/dxvgaDxulRV5tdB42K3vdYKUt1YHcwXGqt/Zy22N3+Got//GSXHj7LiWhfhoDouNh6Jy1YJO03A13XDuyUvWwUPABrkc4/R6Sjl7jXMrSrErSqEQuubb7ftFIA5cUoEQqZqcozqxmrsOHoQucnpuKuuApIe/KUwVVxzo0JCAUAEr+gA/bKMI/IFn8w+jvGfiHNLZztGh43ClAmT0bl/Nxp1G7rke9aIhRgA8jJyTeC4vM4FRVFAQBAdMRtTp02HLMuaBtbthrOmjC/UQQWg+ff1w+iZFpqEeQswzuCZylnpk2dPQ2UMP5qXip9+WovCnELNYYMxOCuceG/uPIQQgn7GcFfbTq0PCRHphieOH0dja1NAGqoPlh54z95OvymTxshhnTE2AWCLLJscOqwpVoSEhIgNhxG8ewPoksoS5Gbkor+/HxX1Fdigg+hXf/Mueo4cIIE4rgqyND39v+Vq7N+DP16PfGseZFnGNud2MMaQPzUcpUcPmbTNXD/tr93//edF3HfftBlw6ZpNDpw5WAfAwfpV8/XlgQGX8hksIIynCS5YtgpjDImD9a2NSE3KQJHLjsVZhSbJBgfSMLCOYFrMN4BgZ5/Zow/dJ268/tbvjC4dbEncfGzf2WoCzGHXaTKp7r3doIQgevYctHd1mlhnw/UKQHPy0IsORUDRVWSe2W9mRGGixXezyC3t9PlCeNAnLF8tiv90HS4AIDstCx6PAipRHDt2CJ17dg8ErwCDpTYG3DzsCwWY36I9HkbzkaEoEABuadtpYqBvbf9UzLF5mXlgqgpHZYnYPEgSRcPvL160a9hokJce+z4DgB+t/1nQXW+UEPbyk48AAJ58eSMYgFefWoknXt6ol/0bBoXhlIvBf81Ovq0AHo97YEx7PCiudQXi2Lpwv4Cwxs1rkfnvzyM5KY27Y4j5J3FKBJqP9IgCywXLViE7PRt9fX3oP3RQOHFIlCJEllHx2zV+xxAlBBKhJgu9qwqgKQj7n6g5gn3msd2qYSzIksR4aErS8tWiQleFRtHzZkuxwmKxiAmm2GXX9MAYiHTmzFgwgecJo8ey42dOISkuAc9iADTfuXMHqMF27Ma5Zp3P3r3dgnGmhOAHNyxENj0PALjt01bkZ+VDURQTeOat37B43dW2EzmZmoa8qbEep3rPBFr/sc0zY4TLhrEN5nDBbe6oJMGWmmV6jAPfPD1JzlnhgKqPnckTJiNmTqxfY38OvvMMCXQAUFLhANNBwNVOHhz0OqSEcSnFd1/YCEVVkW/NMzHN3kz/xY5BrcmZGBE2wMTqoSmQJQm/fGalANGKoqK4vDhoEtWW5Cxm253btAVIP/0yguTyhio8fP+DeGPTm1AIUGgrEEDaBKL11qiBgWCXbrBHH7oPP//Nu5g5c5a3OwabMn4CDp84Dg6yN7z5NqLnRMPj9qD389PCiYMSAkmS8B96XYKxbXjzbSMbfdX7yxtA66CZPwZFZcQiy4ynnybdvRq2tGw4KzUJ3GMPfm/gu731C8iyjLSkdME2t7Q04PT5XgGCHtWf/1HRVrTt7gp6qY9RxMRB8y1tOzFu9Bj848xpY008cjNyxbrvqCzBS499H09veEP4RDODk4R34+4lGALWdbIOkmWLBdYETSLorHUJn+YRFgvr93hMJ1x5C61QvNZFiUpQVP8nfYEY232pWHJhYipCQ0PR19eHhuY68KCVtMQ01DbWCBIWAB5+YytKq0pNwUVfkc4jPSPdx52Eb8B02Qe5vN/jC21ZtT/0rV2duLmjDSoY0XcO4kPyHWryPWuQlZoFm64RGxM2Csu/+g3U//551P/+ecwMn47t5cUC1BRY8wXRQ0EgSxKWf/UbPiEswdA+nn+jAM8c6L4/T+gK/WpVT/WeQdPOZgAwgWfeipxFAjx7g2Zje2/uPBSX2dHUWI+k5IW+hVBXuVlkGff17BYA1fjvQkwJlSS4PR7095sT9UJCQpCboVkeAUB2Ri5yM3KhKgp6jhyAo8IhXmNMdyytLDGF1fD/p0+efkEwHwhNVZlJspFvzQPRj7IIofpt88fPmzId+VPDUWDLR4EtH4VZheLnAls+wkaOFO/B7b4KbPlQDONna8m2oALPFhBmLytCvjVfgGdjBLEUOgJ5+v0Pr3gIKx94CNvKiiDpC5gUOgKjw7RUq0U5iyGBIGXZagyBRja8+TbCp2sFdLMiZ4Fqxb0MgGCbeeNAuntvN7719dvw6EP34akfrcaPnn4abo8HG958WwDmQATPvK3o2YPbOtuNjDOBFqZCvEGcdaEN7n43cnS7rJqmTwb648HvIXOhFZV1Lo2JJgTx8UkYMyKM+xaLdujQoeAcIPp4IPq/v8+dhw/1f5xtJoSYwHPz5nVo2rwOpTWlONd7TlxHS5Mn48VHH8bH5U34uKwRkkSxYNkqEUgDAEn3PIOke54JakcJ7+YBSG5WITxuN46d1gLBchZaAS36m9nSc/Dyk49A1YFz3kIrnPUVKK8uhcRPXC8EnqtLgxI866Qr4TZ1/YcOCvCcOCUCoaGhPs/X47hN7R+KRvh4g+eqyipQkMsOnr8wgCYg+GZXp5bSNMgfTgUjC5atEsAZALJSs5AYn4S33/tvYVH36Nfmo3nzOthddrGo5WXmiSPB+t8/j0e/Nh+MAZKXiXsgt1O9ZwS45eCZ//+3G+LwQVw8KCFC/9zQ2oRP2lrgURT84IaF+NG8VB9m+b258/BhXLwAz8bH+xkzsdG8nThzCkXOoquuPfRulwCYTcxz8+Z1qPvdj7k2EXv370FnV4dPvLlECOwuuwDL2Rm5GrvMGCrqK4TWuaTCgZLKElBJQq5BTsQYQ2dXB3qOHAgG9oNQSrDiudeQlpBmAs+8FdgKIEsSNj33uFYBf/iA9j11rScHyoRQ0+sAYHvpdmETlG/NM4H1YADPzZvXscdWfIeFhY2A22sDqfq5/camN7F+0680pnHFd1BZM2CpdOb8eaxc8R3ExcyGAoa87EJYIOYj9s0Zs9k3Z8xmhvuCBiNxm7rez0+b5Bqyxbc0Rmepzdey4aTfyFavWrWKL2wBM1YUlRG3x0PYAHD2OzdlP7AOjDGojMESYoGz0glbqg2qouL1X/8Sb/zXW3jjv95CcnwcHnngu6htrkFZTTkAID4+CdEzzRX/p8/3wqipDmSwbPz399gb8HHcfPx97jz83Wvd4VINAEhLSgchBM2b1+Gj+iP4qP4IACAsdAQUj+eCRd3ezkjjwqYNajcaZI3JmtSMlZQVwQOgtXMHimtdXHIBDwB7eTEATdbB789JzoQtLRvFtS6UVzpR7LJDopJf8KwXEIrfFSzMMyWEURDW29+P+oZqhEydhsQpEZg4OhyNh/ejr68PCxNTkXL3GuOc7jexkD8mMAOVkJ6RfsXckS7naBXG61xfyAsCy2rKTLHKC5atEs8pqXKCS0AA4Bs//C/MiJyJIpc94BdvSggzMM0IIQRLd3ximhQ+jIsXumVVVYXO2bu90l4vFnvGmM9w8MlWHWB8uOCQPLvyMfbC6xsCaiG71CYRwhqMWkRo1nZcDx0+eTqiDdX0vAjwyZc1sGeUejgqSkRPbXz6B3jy5deQmpAmdNLacxyCiQ4WhpUX+BFCBAvNmApKJaiqAlmWsbVkm9AxexcaypKEgqwCeDwe8VpnpRMeRUGBLd/nvk3PPY4Vz70WDH3DHlvxHXFj/aZfieJlca3oNnVK33mU11XClpKB8rpKPLziIW2cbPoVVB1Q87Zx06+Qb82H3WXH6LAw9Pb1mYJYUu5+xuQ7Hah947VJRfj0CPR+fhpnzrtx5txpzIrUPH737tuDRx6818Qsc6BsGa8V17780lr40VNfifXlsvYRD3HKTssykRCSJKGpqRbn3P14+P8+KO7/zTtvIz4+CceOHcLSwiW4N2c6FixbhczkTFTUV2Bs2Eic6j0XkDroizlpUIni5tYdRgkcSU9KZ9WN1UhLTEN1YzWa3l0rwPPS5MlIuucZjAkbjZI3NV/9j+qPIPFrWpDaLTlJUBTVBHyS7nkG48Km4diZnmAbN0wGoACQdGAsU4KfPKFpn1dv+E+kp2RC8nh8pBkllU7IAH7y1EoAwA9f3ghQgpzkTCiyDGelU8RzU/13QP89AETwirPSiVDLgI3webc7oPpwzcrH2dqN6wECSISKZMC+vj7UNtaIEJQffV/rh5d+ttF08smlv3XvPH9Jvy/l7jVXhH2+rJ1sdN3wLuQCNM2zJEkmsOxtScZtx/Iy8+CocPgtMAsU4MwYw//GxYvCvhBCcEtrC1TGCNdFG9sHcfGoYmF4aWeNANCvtNeLYkOqFwSePHECv33660jUtWEMF7dqC/LFSwyV5s3rkHLvs0hNSAMAVNVXDAqijS4aAPDoSy9rhSwGyQZ/3NvFI5D1zpc0/ihhqspQYMv3eYxrOH/5zEp894WNSEtIQ0VDpcmZTWjE9RXVCJ5ZVwfsh4JqUTOBZwB44zdvIScjF0rfedS3NoLb1kmEICw0VHg/88cfWH4v3vjNWwgLDcUDy+8V7wEAOXoBq9PlQN3mtV4Td2AC6KVLbmIfbd0i5hWeDOhxe9Ctn4RRQnDT4iUAgC3btppAI2d+jGD6Qs2rKDFo5x8Ono3MF6EU7n43qERR3VAlQPSGTb/Eoyu+O7DZ2PRLABDOHdUNVYE4x7Bxo8fgD5Ez/D5oTCQEYEwlRHpSOqtqqOJFh37XpITlq/3671+oBUvisEwJg8pQb/jeyXevFsDZ2J56eSOyM3L8vk95pRMKgFd0EL16w3/Co3iQk5wJAHA11aDP7QYBEGKxwON2Iy423mQ8UFrpxMv667dU7sBNGfNNCYYjLBacd7uvSp/mW3NZWWWZAMdrX18PW1qWD+lXWlWKUSGhePx7/wEAeH7ja0ILDQC29CwBuI3AOkSW0dvfL0C2W1WuiPb5soGssSNHMwA429cLW4rVx+MZALaXFyM3LRuyLKPIZcd9d30Lv/vL/5gutqTlq5GVmgVndSlyBqzxAq6gkADso/mambe3Lvln4yehuMxOZEli3vKLO1oHopaNPqu85dkGisLWf6dATC7GcnbjBkR3OxHsM4ZAa968jiUsX43M5Ezs3b8HkREz4apz6cNJ27SE65pl/hiP/Aa0NMGstGyUVZeK+wDg0Rd/iumTp6PnyIGgBc+EEPbWswOezJxd9i4G5CCaFwKueO41LMrWnDiUzk85OBbphIqqIjMpAyPCRoBSCcXlRVDV4NE8cwbZ2NZv+hXGhIWht/c83GDEeNw5OixMpAsCeuFgfSVWPvCQCYDbktKFa4fSdx6JiTfijd+8hbp3XsD+FzYj4pllAQmgY2NiWWdnhwDHH23dgug50cZxpMmXdnXCIstYVFAonjcrcpYA2LyIsNtgmcmLCN0ej8mNI9C0z/9Mkyhh1oU2AZqZqoJQitKqUmQYxkttcw0e/r8P4vVf/xKPPKAB6Nd//UtkpFjhqnWZADQQcLUVbLBUQAAizCQtKR1VDVU+n/ulx77Pnt7wBtIS01DVUHVBYsdfS7rHNwXUCNIDmrQgxGTFxlvi8tV4+clHBJDlzLJtEAAteTxw1LpADUz06g3/ifNuN3IzciB5PHDWusRjT728EfGx8Zg4ZgwUWUZpVSkogQ9wX7Rgkvg57b7nrgYrzQAIZrm8th62hcka4K+uM4Uu8Z/Lq8uw+pGBNY2D6IbmOiiqilxrDjzKxWu6dL10cAJoWZLYqFCt8GZhYqoXU0Zhr3BAVTTXgMEkHUnLVwt3hGKXHQX68WuAstDsA515Nk0+Oz4RQPaDuHgTsjY4cggru4bWJjEBJd+zBoqiID8rH8VldlPlKaAlx3kDaG7bog6RCmYBimSZTZ4wGZERM8V9VfUVoqiQf9lM3brOUeEwxX+vfPGnPrcBTTOtv0dQ9pUsSYyDYgOAJpQSlpGoAWBnpRM5GTmwuxwwgu3vvrARORk5YF0dcBzqwVsGiUf+1HD0TZuB0IP7UHr0UNA44FhAmBsMFkrx8P0aK9jasRv2siJtYdZ0rUL5ZAFBWNgIAZ65pMNZWSJebwTPzvpK5CRnwDJyFNznziIx8Uas3/QrfHPGbDz90v3IemCtCGkJlHnJyCx3dXcjapYmzdi1e7dfq7XOXZ1YumQgXZKD6L379kBlDLExsZdUlOzl6hF0zPPc2VEYP24yqEQHAr8oxZEjPejatxeZC61Q9LlbZQzlNeXCpaOm6RO0tDQgPj7JBKAlSUJFrSvgADSXbyzv6cE/zpw2r9cSxZiw0Th55jQpzCpkjgq7eCxq2ix07O8ikkSZoqg+Lj8+fs9e62NaYhrCQn0TRfXUwaAF0AuWrcKrT63EOx8UY9L1kwEAJWVFJgBdWukECEF8zHzBJJfrScscCP/w1dchSzL6PR5wK7zVG/4TfW43boyNR/vuNsTOnovW9hbkZmmb3s+OHsGk6yejvMrpE7ySsGzVFSHWEqdEsB1HDwq5Rea/Py9YZQ6iy2vr4VFUvxaYpVWlWLNygOx67Rc/x/y4BDQ01wEA5l8/zZQs6H1S5qouv2LsM/BPJBFebFEHgMT4JBPz7Ha7Icsy9u7phqqoiI6YLRIIi1x2H9mGUa8oSZK4OAmlwFUMbrjUHcgtrS1IjEvglnQm8HxX206ojBFV+x7CW9TIPtf//nlRbOkv5ML4PNNs6Me4Ptib2+MhR44fYUeOH0FqQhqq6ivEZitp+WohxeAtLzNPgOTwydNN4PnRl16GNcWKmqZquD0eogRcOtilNy71+e4LG43jhHkUBa76Cs2LdYrGzudb8/DdFzYKFvqXz6zEiudew5LcxXjroW8K8EypVmzIDvVAliSTDi3QQY+3nOJCUiaqXXBIjksUVnYA8PD9D+LGeTGCtS605sOWlI7yukqoYEIrnZionTg9tuI72LjpV/jz8tWQCAkI8Dxl/AR29OQJIbf4+W/e1QDPrFkCRIv51AvURM+JxkdbtwgQvXTJTdheXITIGTOxd98edHZ24Ppx403JgibQRAh2BSl4fuzB77H6llaUVpVi4sSpJnaM6uFVbbu7MHd2lHjM41FQ21xjsrgrrymHLdUGSZIAxiDLkpB9BGq7vbNNAGYvNpic1EG1o8KOtY/8h3hs9es/F88xrmNiLEVo/TRDD0jjDD7/XwwSfSwa7w/Wtr35MwDAx65P0NzeAtLeAokSxMXGi1Th9t1t/MJBS3sLsnWW2ZaWjdKqUvzw1dfxkycewU+eeAQ/fPV1AZ4BTdtMALS2t0C2WLTfAaC4rAgEula6vWXAt94Lp1wJXNB8uMdkP1fx2zVIuXuNkHAAWgy3RDT5xfy4BJPrRnZ6Np7f+JoA0f0eD0JDQ5GRakVljQvNh3sgHT2IjFSrT1HhlQbPX/pER0FYtq5vkQ2CeY/Hg0MHNRcAnjw4I3ImHJUlPhporplmjKHIZcfYkaMxZcJkRMyIRJHLftmY83+hA5lxh029Ql+MhYV3te30YfQoISxh3gI0tjaZUojyH3oZp3rP+AXKg7Vg0Y/9syDJIssQPq3LV0PRJRwxc2J9FnNvJvrRl15Grq5f1d02hkI/MUIIMnUWtbKxUsgtCCHMaG/HmIpilx2bnn0cD/54vQ8jzUF5IMqkLoV9/gJ6ZEYJwV9jb8A7587jj/t2D4AoXTu9ftOvkJeSKe7nko43Nr2JsLAR6O3rEyz1xl+/GWhyBVNICqBpko0s9Edbtwj5Rfj0CB/XDSMTvWXbVqGZ7uraJQBlVNQcH9ZRfzworyvulJGWlO6PbURpdRkIgNjZA0mGvFjwd84DuDdnOpLuXi2ivV26M8eYsJGIm5cAWZagMsaTCwOijySJMiNYHnSNI4S9+OjDWJqsMaoJy1cLl54xYaMBACfPnEaMDpq7DnZDVRmiwzWmcHp4BKi+oYBX0jD0uh7uGe0vyCVQ2wiLhXGmd3vzZ/jhq6/jKyOn44ff+zc88fJGcdo1wlDgp82zHqgqAwV89Mw8HGWExYK1j/5/AxsWvRiRFxYC8GthV5hVyEr0U7f6zeu0z/XyRniuEG6yUIl5F/ul3L0GIbLGpgMiGRAUhHEdMw9UAQHCLCGCtQYGdNNGv2jq9VUkSqGoqimFNugANAFYTlq2iRHkR34lVU5x7DUnfDZ29ezG3V/7P3j0a/Ox4S878Lv3/hsF1nxhaccYg91lF7vS3PQceDwelFaXXfFO+mfaxNHh7B+9h0zWcwYAzWRJ4i4cIi5Z9iqq/KJtKANoY8jBgmWrsPHpH2Dliz9F+OTpiIyYKcZcaWUJVMawwQCeH3/pZZFeWFLhQGaKFa4611DpJwZAFBDqASgEAOP3GUG0UQ8NaOEoxWXFyMnIMb42KPvA+yQLfsxqxoSF4UxvL/46iPPAt/d2o7evT7OIogRQGRQwqPp7WShlgpkPQK0vJYR5F/u9/tbvIEkSFP3Uwihl4UDaEKhi0kIDA7ppj9sj5Bz+QGYwy8eMaadGxo4TQqXVZf5eA1XlfWocjeZUwpyMHCiKAkmSeFFvUPURl2kAECAZADp7duPFRx8GAHxQUoOqhirk6fNsaU2pANiTxml63IjImaa+4X2l6uyzs6okaMCz97wCAAti49Hc3nKpn59RQpCXkmly5zh54gSa21vw6lMDc/QPX31dOHOUVpVe6pxjTGy9omPOCKITl6++aBogBWFhISHo7e+HLV273vr6+rAkR6tBeOlnGwUD7VYVrFn5ONZuXC/cO7irR7l+jV7JOflL/UXNm9expOWrTXrm5HvWwJZiRXmdC6NCw3D63BkMFgfur93S2S5CEIpcdmFnFohXU1JcAvukrcWUFOidErjq4UfwtYUTTP3DGT+iM4rU6yhLA9rG65WAEqAgeyA1TZIkbCvZPmQBtEQIU/UFaeLocKz+/jIAA5pmiyzDoyjIy8zD7TkLxetWvvhT5FvzwRhDue7vG8yOG/7aktzFbJtzuyj+Ky63w5qcibCRI8GYKoC1MVUQ0GQbvOjwfO95jL5uNLaWbAta7SoH0N7s82MrvsPuzY3Ayg1arLmzrmJQAO3ddJY6uKJyDSB6w5tvX0pRn7Bt4wWGHrcHN8zVTnY4C80Z6KVLboI/Vw+DV3RQjiGJEsYLAQGgvqUVFbUuRM2IRNvuLlhkGSMtIXh98jS/keDebVnPfkydOhWTJ4fjyJEetHfvFtHgwXRdGRljI8us66Dx0mPfF0/+0fqfCRDd23ce1Y3VPq+dMXOWiYEmlKJIY02H6unpoH0rQ2OhWzt3wKMyE3DmrDNvpVWlCJHlq+ao8YXmIBAGcnEwa6Ga7NeaZvPZmBuLCl/7xc9NrPTzG19DbkaOqRixpNKJNSsfx0s/26it81dAzvGl/wKjf68AlvpxOwAiEcI+jI696Puc1tmSb+3ehTnhs9F1cA88ioL77voW3n7vvwMWQK8jqt9wk9s+bQUAAaAXLFuNgiytUNJR7gClVDBEvOVneXnX8sAMSgRw5vHnBATFZcVDwT7qUnf9JN+az+4/0OP3SU3jxgEAEk6eFPfd17NbLzwkuo0bCyrf5ws1Xn+gMhWqypA/NRxEt/jzB54ffO415OnPIYSi99w53HdbRrD4PPu0x1Z8h3GrubDQUJzu7SXGjT0AZD2wFqd7e4U8o7yuEgoYJErx/iCb+tvbP9VCNUDgBgtGdoxcDGwDwJw50T4pcEYpx/biIh9WOiY6xlSM2NHZgaVLbsKWbVuvOBN0OQA0oEVxd+7ZDVtaNipqXQJA8+YPSB9za/P4ip49gqHm77v+rV8ERZ8QQhilBNmp2YM/h1L07NtrYqKNIJpQCkIIivXEYT5WuPXd5cYiAd/HupMo1S/WUM1uDiMsFiHzUKH5SkNlV0yGcSU3+ipjSEtMEzpoWaLwKCrKq8sgEWrSTvO2duN6LJii+dBfN3OW2FysWfm4KFR8fuNrV2RcfalvPnbkaHbq3Bk0b16HDX/ZgUe/pml/N/xlhxH0sj9FRZteN2aQQrnTioJv79ltkjV4vVdAAmjvtnzPXpzqPWPUljJZkpCTmYOTJ06gsbUJDMCE0WPxHw/cDwDQA1CQFJcAAJgwcSJUVYUkSeaFjmkR640NdUhOScW2ku3XwkTELLKMyRMm46dhoy75Rcv2dMCqu3Xw1t/fL6zxgr1T8qeGs2899E1haWcsFuMaMY30YQOPaU8EYyyYglIuuVlA2NjR03HPt27FvbkRSLn7GdiS0hEyajT6z55BfWsjAOBMby++PmM2/rhvNyx6X0mUCt9nHriSn7MIW53bhpT8Z1bkLKGD5m4knbs6Td7QJlC5dQumjNdO0a7T9ZscbBt11sEEjLgGmvs617e0Cg91/h0sssyiZkTih14qA28QzQH0I0cO4v677xP335szHdkPrAvEQBXzRkKXbIwbPQYJ8UkCLBP4Jnke6NmP8ZMmoba5xqfIkIPv3r7zaO/YiZNnTqNQd4woKisGwK450GwiPQD2XoxGcoygFOf1vh1hOIE23ndTW9uQsKgdFRLKKn67BguWrcKf58UDAL7dthOKqsKWnoXc9IU+rymvrYfdVQKLnsrI5+eMVCtkiQp3D9vCZKx9fT24Q0rK3Wsw//ppaDy8/7L025deRGiswPzGD/8L7fu7MHF0OI6d6RHCcRVMiMD5z5yw1ZL0tNsqY8KqbcNfNE/Kd//3TwFb5MQBdKk6Aq+014v7dccE4s0Yct1zTqZmcVNcpjGFqx7WKm//tt2Opp3N4jUJ8xZg/IQJIPytdBaVUgp7mT3oir/+1cVfIgRc1gEAm2fGXBA8c2tEQ6KWtnutLAlYWdAXaZuee5wBwIM/Xo9X4uYj1t1/ya+9o7MjaPyev8gYmTg6HFuK/ow//OZ3puJAS9hIAQaclSU+DPRro78CSbfZ4qAS0AJU3EG+8Ftkmf3H/cux4c23sUT3Ad6+sxUqY4ieE43oqCif13R1d6O9o93H7zkqag4opSaXj4+2bhHphK+/9TtcP248Dp84HvAJjUY3DQBY/9YvxAmVHncNxhgkygvGJcEwUyqJItyRlhCc6j0HAuDRB7+He3Om4/s/34bk+Di88V9vBbqEjAEQsozVr/8cOem5pmICo6PGgZ79CJ8RCYfLjq+MHoOnHhzYMHCPaC7jML6nqrIhcfL3T4NnSpiiamPpPYMvOwfP5/04IN3R0XFVQ1G+rLZooZW9unIpMv/9ebw9Jway4bR+eWc7zvb3CRcOrnXOTtc2Y+XVZeJky0IlpjAtzZk//7Vf/BwVv11j+n0PvvpXVDdWBy6A5swzBYEKBokQ3P21/4PKmhq07+8Sv0MihBFKkZeRK4AfAFTXV2FhYiocFQ7892xNT/fn68bjvaYaUEnzS+b6xg1/2YF3//dPyM/Mw7ayooAaSElxCYyzyRfqW350UZDlmxxXXGbHsysHHBLK65tACIG9zA6VMc1eTFHE+SwH3D/euP5anIwYZ5T7+/uxd/8eAMChowfx+0htUrpnbyemXj/NVGjonYzZ2dWBA0cPBv2Eboz2fsUQkHAhIN1u0frkiR0tQcMWflHwbOmyI3HZKlFLIa5DSkEohd25He/PvUHcf3v7p8hJzoAUOsJUj8BBtN1lF0WFwdhio6LZ0kIrfv6bd5EfO9dkB1XU9incHo+QbnAmmWujjR7PfB4DYJJ6/Mf9y02/73+3ONG9tztg+0uihKnMfDLz2IPfw+u//qXQK3O3pdjZUZg4caopAOLYsUOYOHEqymvK8fZMbf26f18XFJWJ2gyeUrj+rV9cFvLqS+kHiTJVUfGiQdMMaJKMAlsBVEXRrheXA4DWV0Y/Z0dliUkP/fSGN0zAGdCKDU989hk6e3bz+fea0z3zsZObkYPy6lJRr1x4vSYN+u4Y7VT1l6fPYuvhA5CgxXjzsclvBxsbzV03AC2Wm1uNvh+n2YJ6GBNg+q7WFhH9HSLLiBl/PZoP9wxqIEEJYWCaG4e3C8jlBNBfmg+0t4NEwvLV8HZ1ZAyYM22mADGqqmL/vr0icIUxTc5xWlFw/7lTOKmHrZTXubh0QzDX23WrlkBqDa1Nl1Qda0wZBMxH7QTA8xvXY40Oop0VTuRk5iDPlgdHuUOkDeqDBh5FIT/euP6aQ86EEJZp8IDm//Nob94UxhAzJ1YA5UNHDyI7I9fHA5ex4HfP9igKkSWJKaqKJ/UUsbwp04EJ4wYF0bHuftze0cHt64bE2KCEsPGjpmNL0Z9xU+HXceJMjw945q2ypswEnvWNvpB2ZKRmgenA2chEB/Pi3bl7FwAr3B4PtrbuwM3ztWNUlTEU6n1hLBKUJAmfnziBwyeOm4CfUeP80dYtIrgl2JqiMp8UvZR7n+UAmLk9HjImbCROn+/1C56vnzRN3J5okXDMrYBSCWmJqahurBTv+cZ/vQWL7rigqgoLpGLClx77PvvR+p/hpce+j9Wv/1zIMYprtRjv/Xs1cqJjfxcIIfjKqDGYNG6SKQwlLyMXT294Ay8++jB+++cPQSnB2kcGtNG//fOH6DrYjYULUkEPdmPtI/+Bpze8wQpsBSgKMDLscl1/BdZ8KKoCiUpQVAW2NI1ZLa0qxZbDB0AAlBy3CM/nJVOmY8vhAxhhsZgKCk+eOIGWjh0sGOoMeLiKoqpC05y4bDVyM3LQe/48fgKg/9BBrJkwTgDpP87zTcj85uGeQX8H7wcJYAuWrULilAhMjJiBkvqqy1pM+KW8sSxJzJ/9mp5+I35Roa3AxDwDwN493YiYEakXG9jxUUwsTisKxkgSbulsR15mHhwVDqjQdhde0dVBcdHJksQ4a5wUlyB8H72lBCdPnEDTzmbk2fLgrHAKKce6N14HANPtnMwcOModGDdqDI6fOXXN7OI3Pv0DZvR05q2zqwMxc2LhcNnxrkHKsXxvp4gC7zlyAHmZeT7guWNXOw4cOTBUItAZD1HpmzYDrvoKAEQvzlDMHqwEQg40VJigiaPD2T3fuhXfvl9zocjItPKiQlNAE2/+5Bu3t+1ETkomLGEjjTs2qIoCKklwlBYFlYyDh6twBw0OkGOiY0TAR+/np5E4bZoA0v7aVm1TdtGiRJUxTBk/AWPHjUfn7qDwhmYXiqFOWL4aY0aEIT4+yRSucvSzgyZAXV5Tjr9Hx+KYW8FEi4Q7ujpgXWhDaXUZJErQ8M6AvDGQLEeN4Jk3DoRXv/5zUfDH6yW+Muo6YU03PTxCvEZPEQQhxFRUCEC8T0xElE/Rof7YkC9+z83IEcAZgOlnIzBu7dyBD2NihYzjro4OxMVqm1yjZzQAVNVVBLSkgxLCJEIxduRUfO+Bb2LpN7+OLKtVWM99vqcbO44ehDXNhtr6Kpzt74OFSvjD3HkmacddrS0BaV8sX643Tlq+2hQMkrR8tYnlY4xh3949mBE580K7Co2pNmihxeuDiAnyKIqQZfx443osyi4UzhkqG/geRr2z9+snjB47wJjoTGGeLY/rptm1oH8OnzydPfnyaz7gGYBgmakfZplLOySvDYsZTPKa6OBveVOmg0TFIIxQFGYVgjEVrKsDpUcPQWUqXonTJuMnd7QgMzkDrvoKUErYUNBAnzh7QIDnmwq/DreqIm+hDaqiwFlZAqhMRHjXNFR6GfgOtPrWRqQmZQxs9hmDJMvYXro9KHzojZfA0ZMnMDLsOmRnZSIxJRkvvfgionXXjd7PT+PoyROYMydayDcoIVg0L850LX18iRIfDpYPnzjOGeuAbxbZdxlcsGyViZWeOnWqeU72KFrcN9eEG1wleFGhojJt7dLBc+Oq3yJx3b8H3Pd/esMbkCRqYp5ffPRhPL3hDR6Yokl29OLCf5z9XADoAz37NVYamruGsZAQAF5+622c7j0jwHPXwW4f8Nzw+xeQsHw1o5QMSSA9wmJh/W63PiYUHxANAMeOfeb/tV6WtidPnMDEiZNMwFvftAZmvzFg7Cjt2ln6za8jMyMDtnQtFKW2qQa5mTmw6tHcC5O1ECNXtRZC9Pzxk2g8vN/r3RAwG88vDUB7FAUJy1ejSa98TL5njckLOnHZamFID0BIN2ZEzhRSjmKXXUxGRlcOt9uNAms+HBWOoLtwZEliqqqCUoqKhk+QmXQjnl35mADRxouisbUJkqGgMCczBz/euB6yJJk00eveeF2MIke5Q2igX3h9A/NOQRyKLTUhzXSbEIKOXe2IjooBIYTbJZrakeNHoCoKFMZQorMkAAQb3XPkQEBdlP9sy58azvqmzYA0asCZROn8VAMJsfOQO2cuisqLEOvuR7slBH+NjcVt9RUosOVzgB30G7HRI7Qj5YxMq3AdUfUNJ3fUqGmoFJ7y3n7Qd3a0Id+aD2dlCZwuB3KseZBkGUxVNfAchEz9yLDrtHk4JRnr1q0ToSjde7sRGxMrorln6QuZHseNxoMHvUFwwC1gX0bLXGg1rV9G8Lxg2SpIlJiYZlVRceLkEVw/acDOrqK+YtD358f0pnkLVyZa+VIgTnT4bPz5J/8XAPDQa39DdWO12DQqysB4V1WGBxekAAA2fVIvyIiXvDTTgCbX6NjfhfSkdFQ3VAGA8Iwurt2JgoXzRBw4ADS9uxZJ9zwzJNcsj9uN7IycgTlZVQTTrDIgPmZArvBJewu2zJ2L86o64MxBfS83Drx5OmGgNi7PBYBHvvcIFiamorLGhRBZhi0tC6ofAiMj1Ypv17jwpxvi4Bn/FciE4BuftiJpQQoamusQIsvsbH9fQMxBXxYDTRhjLEFnmWUDAP7GD/8LjZvXIvmeNcJgnTEmmGeu/fXXKCGQZRkeQ0IUb1mpWSipLg3oC0dRFKFlBjRXjdsW5UOWJBD9opAgobG1CQAwNmy0CETxBs4vvL4BlFLkZObAWaFdMJRSIet45pFH+fOGJJDmNlNGCzpv8FxWXerXiYOPH+7Cwa3rOna1D6mJuvToIeRExUBVNQ0mpUQrPomKgarq1xkD7ty1C+/P0YqdXp0fjx9WOpGTkQMcPcRBUtCOnQeW34v8vHzBLPuTbaSnWKGqKpwu3025WwfdORm5kGQZdud28JLd0WFhON3bG1T9MStylvj5D+/+AbMiZ6GraxckSRIstHeLipqD7TtbsSRuPtSpGnDc2roDkTNmYu++PZAkiQ2lMCJnpZPoYJkRDCRaJuhAOuXeZzWGWaJ+wbO/lEIN5BBQQuDud+PRVz4AvjIev3/lA9ibajB3dhTadncFxPfn4BkA3nz8NgC3+UhMuLXdpuY6rFiQgr/H3gAqaezorbqrBo/l5i8khKCqoQovPfZ9/Gj9zwghhHHQ7Kiwo+H3L+BaaIoR9Pb34djp0xg3fjxsadmalrm9ZaDfCBHgGdAYaFVlaG1vAQAh5TCNMwCeAP3u/or3LFRiyUlpphMuSokPmOZFhR7GoKgq+g8dREaqFaVVgYP7vkwJBzFMxgzQtGMTRk0HANT/Xqu6XJxV6CPdsLvsfnfjH0bH4iaXHYtsBVAZE1WbwcCCcEEAZ5FXPfwIbluUj5//+jdQVRXbS7aLjYMkSXgyNhk/2VmD7VqaIDyKIrTPHj0CXVVVEbpSXGbH4txFqGxqQUZCvAlk68VgrCArH8Vl9iGz0EVGzDTdNoJnAHD72WgZLBRZeU0ZbKlZCAkJgTXFipqmar8Wg0E7UYtiN80r3N3+KaToG3xAkrFYMNbdL2REORk5/KQnaOUcb/zmLQ6CCQ8J4ZvNASZt4Lj9zjaNoXeDYUxYGCyUwl7h0Oo1VBUKEVicBBt4BuDX/YISwmbOnGUiLkxyJt5PuiRKZZoUoffz04iKmmNMHBxqjTB97Uq591lMGK2FNdT97sdIufdZZC60Qhoks2AwQOzxaNeao6nGtMa17e4KiOvL+0N8VH8ES5MnewefsDFho5GUsBCqouCtyhK8BeDBBSm4o+8c/hptriHgwPp9eQTeaq7Dj9b/jOhkGVEUBkmi7P75SbhWGgNIaVUpy8vMw7HTp/1vtgCTJavRxo6PGyN45lKQ0qpSH7OGQG8hsoz6hmoh2dDmZDYApBUGhakCPMuE4I/z5uObn+6AbeYsZKdno7yqjAWClO5yfQAm6cfpsRFROH6yD8VvajY+C5atgixJJiu7bWVFiI2IQsf+Lp+Y75s62lBozcf+fXtNlniB3ighrNEgaeE6aN0xgyzOXcT06G0kxSXgWZiLCUIGYeWX7vhEUIQ89ttYXGjUiQdSocq/2iyyzFIT0gQD3dnVIRw3OBCwu+zmwa17uEqEsGz99KO8pkzIOTDEbNuM6YPne89j5KhRpp39ubNnUdFQCca0pMJHdbukO3ftgkdRUGDL54zckDjBsIAw/i3yM/P8gmjd1xkWShEWGorkuERIoSPEWJIoNcWCD5VrCRiQbHhfMzxI5eb58SYQvbV1h187uyGFoAlhxlPRCaOmi7Ur6e7VmrtGUrrJiaO8phxzZ0ehvXs3/jZn4ARsWc9+xM1LAJUoKrWwpkCM8WZcu7w0ebL2PXUphaKohBDC0hLTMFIvqDWGqTgqSyBJFH+NnitAM6DpwT8IHYlNzXVirWJemIMAzFgjtWDZKowbPQYnz5wekhJEGWAeAAsMILi1vQUKBINMAM0f2ugL/dWODvAtm2yxIHa2GR/pEeBB1WcWKjFuTcfbWH0uMq5Xj5zWUoTvbP2Ev05EfpdWlSLfmgu7q+SqfvfL9sslQtic8NnY1bMbhFJ8JWyqmIiS71mD3HRNE8S1zSpjiNFBNDF8LBUMi3T3jmKNqQ74wSJLEuOR3bxxEG2cTyaMHovIyFnYu7ebJxXig7h4AZ55JHipOmAV9NLOGizOXSQmMb5jdZQ7RPrOUATQAiRa89HX1+fX07mvr89fqiCzyDJsqQMa/KESnOK98BfYCsCYKhhob5eXkgqHcOKQKBUyDkALUuESlyEDoCllYaGh6O09D1ACRVVRmL1IFIsSSmEvK8LYkdNw6txB2JLSUd5QhTxbAdznziIx8Uas3/SrIbegU0KYJEmYMGagMJnroI3MY5Qer6sXEIISIiK/O3d1IjYmFu0d7UMR8DBjP0wcHS7WrpR7n8XCBQO6Tq59njtbC59p795tYPIJcjKyRfCIrlUN1P5ikqTJBaLDZ6NjfxcxxnnzJEJ4nVQYSQtinpDAGBOyTW4BWVLlFI4/fLMCiHjvIV2/I1PCPCoTjLEKoDCrEEVlRZApgUdlZITFIjq3z+2GBCBXT28sLisSHtCcsQ5mP3ru0KEwFWGWECxMTudFq/p65dSxpJY4SAkxAeySALieLiuAzkrNgizLKHJpCXtGEJ20fDVUbXUHCAEFoDCAQNNRcdBsBAF2lyMoKuC9d9dGQMv14TmZOT6BHtpFok1IH8+/0QSi+xnDnTt3oDCnELwwkalMHL9LkgR7md3EQAeT1d+lMmeqooCzyf7s6HqOHPD+viwvMw/9/f2oqq+AwrSgH2XoGfhr8fAZOQJA8z6ilKC4rBhpCWmobKxE7uTpKDlyAC/Pm48ffqpFqOZb80AIRZHmrz4k+obqGy7jYq8CsIDo0gztFGLi6HDWrxxHclyieK6zvhLjR00XCapDtIlQB4ssY9as2aZrqr2jXQDnqKg5mk+9AUB1dHYMtQ06JEoYpVqaYNy8BAGQjSA66e7VGB0ahjN9vVBU5jMXZadnm1yiiH7yEeAA2u86ZnQ8opQKRln1SiPs3N+FFXqB4R1953BL204f73X+OkdlCdKT0lHVUHXNhahAB83GVqJnWni804oBphKCfFuB6fn28mIxdwVrR+Rbc1lJhRM23Vzi8z3daDy8H2mJaRg1MgwlLqeI6uZaaW+ddGll6VXHg5dNwpGblg1ZtwfyeDworS7DdSNHwUK/YgLRAKDox+zGqGU+IXGwCABFZcVBAaCN8g0jmAW0QsHEpBRhYUcJBQMTO3TGmHDl4BINQCtITIxL0KK8vRYyxpjG0Ovgm4P0oejIQQhh06+fZtI+Axr7XFHn8jmhIISYFgH9xGNITtwEYItzF8Pj8UCWZWwt2SaOOwps+Tjfex6u+gpYkzNR3VQNlalQVaAwS5uge8+dQ7WmCw/6/qFaVBoKbQWmOcTdew6OugrTGHhsxXfYr9/9HVKTMqD0nYcUOgI3zosZkuwzb7Exsay9o11IMnhQyqzIWQgJDRGx3Rw483nZyD4ORQBNCGFZqTZ4PAqoXjRYUV8Biyxj7IgpJimicQ0lALOm2sSGwxs8u/vdqG6sDEQJx6BreJ4fu1AjiOYjoWffXnQd7Mbf587D+/II3NF3Drd3tgnm2jhIjPKPoToPX6gtiI1nze0tmu2fzrba0rL9samMAgjRortNoLu8yhn0cd7cL55HdPM1vLaxBiqYiICnhJiew0F0SYBsRi+LDzQFQWNLg7AwkWUZ2Wmaa8bYkUDBQ79E8ZvfRcO7awWI5p7P3pM0pRTF5cXac4LEf5UXPBp9RHkhYEJisvb9CEAJ1cIsGEF9XQ0iI2dhwoSJGD9hAhiAj+LiUaqOQDY9j6U7PvFhOopLi1GQPcDUJ8Ul4JO2liEb7c3TB111Lhw6ehCqBpSM1nU+39kYzzvkGyHY5tyuM2kUS3IXQ1FUMKbCUeHQD3sIqpuqNdcNaAWHvJ8q6iuEO0zQM4kgACHaAq6qwue7XLPU8vmSvb3nBXi2VzjQ1NwxpIcKZ5d5u278eIRdNwbde7sBaO4d3Xu70bmrEzHRMT7X0lAEz4LZqi5DZrKW+kYlCluqDaqiorqxUqxdzZvXmYraGbRTQO7Rz7XjTFVRVlPO55+g6q8DPfsxftIknPhM8ygOnxFpAs+UUih64bbRB5vroakkoaGpFv84+zmiw2cjYkYkqKTLyxAwNn5XtDW3txCZEsatDWXZwjf8oJrEwzRGbLrU9bOjR9Dc3iKkHsFNbmjSDVuaFeXVZVAZQ+KUCO75TABo4Fl/XmllKcJCNImHqjLU1lcFEml1+XawPHabYz5+fF5ZXYul+V9F8ZvfFbIGHkOsKqrGyHIGWp+Igu3Ineg6OlWfLAgh4BHeRkbHOCM1NNTiVO8Z3Dg3Ho2tTfho/o0mAC1JEm6cqxUhNLY2YVHuIrGwMcbQ2FDHtdRDdWcvTil4K6ksudjiJI7xdYnHUGY+GADkTw2HFH2DaRNRXF4sABAPWpFlWRyJqaqC4nI7Nj33OFY891rwM9CEsPzMPBF+IhFNA60OMu9RgEkgwo3jdG/vkJduGB01poyf4BPVDT8SDwDo7t7NHW+GZB/p8d3GjTuYHohCqYSxI6ZoBMab30XS3avR8M5aLFi2isBLO81Bov5/0K1fDEBMRJS4L2JGJFRdsjF+0iSMHjUa+/Z0o7NnN6LDZ2PDqFB8EDoSd3rOY+nOVtEPMRFRCJ8Rqa2DlGLfnm507O8ayvPwhVlLSlhOciYUWUZVXQU8bjfiYuPR0rEDKmNEpoTFRc9Ha3sL4mLjMen6yZpOGr4yj2AF0Lb0LNQ3VCM5Sct1KK8qQ1hICIz+zhYqMZ5YWFnjgsJUgAELpoSj8fD+gHSx+fIYIL2oydiKde0Og6Yp45MQ1+rmpmWzkupSxEZEIXLmLHEB2l32YNessoKsfMPirjPPRmaUASpT0dRYjxNnToFB00H364+HEGJy4EiMS8CEiRO199BB0PbSoiuxMbp6rCIhLCczz8Qml9eU4WKetNx1AACGkn+t3wuaEJZvzRPMMjRmA1tLtgEA0VMrzfpx/ZrUj8eGhmsLCMvLLgQY07SajMFRXjzkHDX+2fkoek409uzpxsyZmk90565OWGTZdH1QQlhUlFZo2tW1S7hO6GB7SG8wjMFfhFIoigJXrQtgDJQSjBup2bMeO9NDdMBNoBcsc5cOTgC5al2icC6o5luJMkVhYm9O9FOcr4weI5IIO3u0osmP4+YLFppKFEt3tgKMIdoAwHnTX3NNX4cEYDfGxmPimDHaODp9WgBoSgjj4Sot7S1QgSEDnjmAzrXmwKOoKK0qxaiQUPT29wuFwZqVj7O1G9cDBEIjzUF2rjXnqjtvXHYATUGYCobFXmJ5g4aZEUD4bALAybMHOEhmHEDzti34C5vYhNFjkZiUIqz7/HGHKlNhL7OL+HLuyMFB9FdbNcP1JB08G4ssHeUOqKoalElpX6QfrSlWuOpc4nvLkjTkQfEXYjd0gOzNnhmvd0IIy5syHXTOXB0/q7C7HENmUbOAMO66AUIwesQIpKdY4XDZhwG0fh3FxsQKuzodOIvxsXTJTeyjrVsAQGikOcgews4bYgPK2WZt86ltRKNmRHKfZzI2bCQ709eL0aFh4nWnes/xPuEWE4b9adAWfPnVQTsMaa58Hv5oXpy2YVBUUIni5tYdfoEGuwLkXXCASDBjOmFJpVOcVHAGmrdPtKCVIVf0zrXNBu2zGCaJUyIQMnUaahtrAKI5cbjVwDtZly/PJATIVBLaZUCTb8iSxGN1CQPwj95DzLjLh6JAliR0HdzjDcihBrFiihKCE2dOoai02CTn4JpvVVVx8sQJNO1sFuCZt37Dz5x9bmxtMjHRDXqS4RCflEQSIZdxXAr7fK22Als+CKFguktLcbndtKBz8Kxdr3TIaMQtlDKoDLakdEihmv2j0nd+GDx7TdHtHe0sek60Kdabt4+2bsGU8RMQdt0YIfHQGVXirZ0ecpMMY7Cl2iBJEphGSKCyzoV2Q0jKqd5zZO7sKOYvOIUQAqseuML10OU15UG7kSitKUV26kARlyTLJss5fd5gHDhTieLWtp2iL6LDZyMicuaA3WqF45pnnwcDYoMxzENRK04NXzU0NFTonEaFhLKz/X3YcfQgrLNmw5aehfKqsoBFNvLleuO8jFwvCzq7jzbXn1bXoygYO3K0iYFu398VvANFn4jyDRKO4jI7HOUOJMxbIO5r2tlssqbhKWp3tLYI035ZkpCTmSMmJ3uZHY2tTUJDPpRZoVxDEIrH4wEDsPHpH2Dliz8dnn29rinNv5V7QVOf4lwCoKisyMcnekg0lcGWkjE8EL7IImAZWAa4/vfoyROYM2ECoudED+XkwUEJDwEYJUlnoRWTg8ZgSYKMMZFWaATRQbkJt+YDhHDSCyVVTv4dfb77LTpo5msTDEYdfJ4pqXRcG8Xcl9BCLBaUVDqRm5EDZ6XTByS3tLcgPjYezVqE95Bb21UwUl5VxmzpWfh8TzfCLCE429+HXnc/0hLTEDZiBEorSyFxFxs1MPHNZbOxoyC88F13dr7kQgomiYVdu6Mwq0Cw2cGkhU6KS2BNO5tF8SCfTE4cP47GAdZY3G+UX1BCmB7LTQCwpLgEAMDESZOgKAqcFc5rQbLhA6B5G8p2dP8yAKDEIK1nA/nE+qJGKUG+dSB0ZXvp9iHTlxYQZgTQ9a2NMERwD48Xr7k2ek40Pj9xAsdPn+KnOWxW5CxYQizo6OwwJu5dE31nDPfg8/IXlGCYCwk5GNe108FgYydJlKmq/nmFuwZfzy/t82v6aVX0n1c0+JAPTblE8MV4pYo3+0z1KVsd4qfKnInm8g1KCLOlZZmTPqvKAtaBTb4cExAPQeETSH9/P8rrXPBcZDe+OKuQFZcXgwewGP2g8zLz4PF4UFZTxoIFRDe0NoESAke5Q9jNnTh+HE07m42ARjAXph0aY4Tv/CkhaNrZDEop8iZoYNyjKCAQforX1GTU398/DH0uNCsxiGAUfv0UlRXp+nuCvEwuHxr6llLJcYkob6galm8M0gzssugfzkh7xXZfE+A5S/dy5v7FTFVRWl12yZce8fKtNT2ovRcL9M2IoqjIt+aLBEXejKmDl/Ie3ESA6HZ+AFDsskMH1uxal3IwgHgGeUy9NjasxJ80V9YTMUXyYACvTvRL3bkSwnL0yGQj+AWAqGkzQS6yTvf392N02CiEhISAUmp6PaUUFosFc8Jng2oS6mDYYSLPloc8W54ISRk3frymf8aATOOCfyDdcDw/Kx+51lxNUC9JKMjKR35WPiill/Q+Q2BxEz/v3b8HG5/+wTD6Gew61GODjX1GCGBNzvR7gjrUBk99a6P42VlfOTwgLjxFEW9Ax4ucjUFO1xJ4NgJeALBp91/SZWJdaB38d1DK/aVZIPdDTESUtj5RalqH9TCPS/nsLD0p3fuNAWiykHxrPqLDZw/FqWe4/YtNZYzYXSUacGYMJa7ATu/8UmdHxoBDBw8IX2Kxo9ATCSm5cD/w5/X39wvA6f1eQbbDHLQlxiWYigUH71OGCaPHmuzumDoQOsM10UN6p84YyqpLxW3dy3m4DdI8ikJ4xDul2i5+UbbuGQ4Gu8sBVdVONySJQpYkkCGyCXODkd7e8wObCYZh9vkLYqj2jnZx5K4XDZJrYY4hlIp/HPASSiFp18cl7Ua4/nmwZgmxBHRnMsYQETlTrF+qqgotpeLxXPJnHxk2UryOMSasMnmbHh5xSX063K7NOaikwhnQ0g3jNf8lonHCGBgICJgXfOTg+ULyi0JrPrO7HCAEJnBpfD/+czDYunAzen9H5Ib7yKW8x4X+gOwy/C0DrRnDDcInT0fPkQPDs+8lrIdLcheLG9tLt0NVmRZYxFQBqlWVDTkdtBFQDw+Df2n/T66x72vQ6w7Mrvp95FLfY9D5+otrqq/KmvUv4gb2xX7lcBtuwdn+f72hgMzu1Mc3AAAAAElFTkSuQmCC","robot":"data:image/png;base64,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"},"plat":{"bounce":{"src":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGAAAAATCAYAAABvLghXAAABH0lEQVR42mNkwANEeGT+M4wCisCbL08Y8ckzjQY+bQGhcMSIHSUFpf+f3vxiYGBgYHhRqTMaghQCifYreHMDI7bYGg142kUEeiSwYFV95TOijJpZiiH9L70bd5mGph6fWmqoJ9U9tFaPS+0LX3kGic0PcdcBo2X+wNQJjMiCkcc1Gfrbvo2GEo1AYRUXw3LL6yhFERNy4MMUjQLagcjjmgyRxzXhiZ4FV0yNAvoAptEgGNj6YDQCRnPAaASMAjqDvQteYXbEYILOCWJ4NcAANnXkqCfVbGq5h9r2EKsWWd2bL08YUfoBYunCo8mTxuDVzLcoEcCEbXxiFNAewMKcEVsXeTQn0Cf1o0QArrGKUUCblI+zFTRaHNEv8BkYGBgAyX+DtknZ7CMAAAAASUVORK5CYII=","w":96,"h":19,"land":2},"break":{"src":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGAAAAASCAYAAACkctvyAAABfElEQVR42u2ZIU/DUBDHf6+pLAaKGXUjICb6AZog+AATS/CwLPsC2AWxDENCgkIszZhGVFSQ4DAVyAkMYW5bEANVXwwNHWyMEG5tQ/+qyb27d+/+d/fSe4oETMOKKCCOaThS8bdWhCNdKIDxWSuy230ABieHAISTVwCM0vpcxWXyg1OXXrPG2ubv9H8qP7ry5u6TVf/jOAeNKrsXl0o3DSuy232CRnVG8bOhRUhbvmxd1vyP4+y4PqZhRXpSOH4c/klZtYIBvWaNycNQtHwl9+k4NvWuJ2J/a6dM7u+AVZEsDREC4uwpVcrkneB616MVDMTOokk7L+G4dPYn7XccWzShtKI1pFvVWt6cznt1iRKwytYgmTSL7EsklCbtvFTppnXRf0dQ5lpQ1g+fFhzX/0qA4/ozPwh5yNY8E3K9V2EajpQeT+ZMw4q8u0B84/vJM/8Z508vAOzf3Cp4H8bFBAAcb29QQDb48DGSVskFxXvAarDwPSApKCAffIA3Kq39AQNddl0AAAAASUVORK5CYII=","w":96,"h":18,"land":2},"bubble":{"src":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGAAAAARCAYAAAAi5qlcAAABz0lEQVR42u1ZsU7DMBA9W6kKVRekdkER6lAWBsTSoTtDJyYW/oPPYikzEhsLC0Jqpwh1KDAExIKsRESEoVzrunbixE5A4CdViq53z/bZdxdfCEjQafspOFjHy/uciDLqnF8tWBJn+nZtR1pb3RQA4OzpGRpUTfrxuXrO0lPZymx4ThlEG5U+6uXxqbjRTodHdyzUu/B7wJIYWBSSjQjotP205TXXJiIjFmV5gyMP/opumIqvQbO58D/T8XTmoztnjAY+EogoOJ3PlKehTCSIE9TlUtkVjZQijjKJIl3bBl1EAtYEkpd2TBxRZgFlYOKwn8J4b7EJVEw7VTimaqjSpa012F4Hz+fxVVonZGVy2Wk3cYjN6DHl0rE1iUCPjwAZUdHca8Nxqk0uw19HWir6csHPycN31TyCrJNU1yJ/M8oUeZbEsCzCAACDq/ulUnA3c7coi+gf9aB/0IVgGsLt8eHqJsyikGzv7gOfihyqQTANl887wyGwKCQUAOD14YY499SLx+tLstaKwFSEacilIPt4Oz9Z9Yi+2xGUF7S8JkxGA5iMBs5bFYLvBW2kHmxLsCT+83UB70C665Tpq/ykkostaWnu/08t6ToPmux7wBd2VuNivhMc1gAAAABJRU5ErkJggg==","w":96,"h":17,"land":1},"cloud":{"src":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGAAAAAVCAYAAAC5d+tKAAACX0lEQVR42u1ZT2vbMBR/CqlwHBNY8PqPUMjozTB22U7NoffBbvsApR+oH2BfYseeethxl17aU0dYGd3chhXiyDGGRTsEqZIjp5FiuW7xDwxBsfJ+7/ek954UBAXA93pU5/3R5BeCCkLXjyJ8aTwXR8viNEnj5+OL7/Wo7/Wog7s0IgmdzWbSE5GEP+IYm1OFQDAuDu5yflk/VE9EEj4vCAbGfqAiVkycjLTmuo7PPyfpX/TUAWCrXtcPMk3h9atdAADwsGuUjpo629LDrpT3huGVkdNxMgIyTaG/tQ8edulT1AVx9+kKz9BuYbi7v4H+1r5Ss6xeWgFYlh7E79otbEz+dnzNA5FdkYx80RDFGIZXxvxV/ou6iPx9r0fzgtBcJjBb4cwImaYAAJJgRWCSxhAEAxr+HEpjNoLAxNAttqv6cXd/I+nFUlQQDOjFxTf0aA1g4t+Or5fmcNNtq8qjLKCmudgkZ9u0o7KZVyMWBhzcpWWRE0nmbWubtmzayWKzsweTNF5oOpp5BZdM09IIlilEmbZUcHCXikFA67aUNVbfee0Whs3OntQMoHX64Br6cB1fak9RXsdTw24NYo0HrwFfz+dp6dO7+QuXfzakie/7euek78PFY0QY/YOPb5tr/c4qPFS2dfir5ptqwOaw3wyjBowJ5bW2kb2AYoGoKvLEqTJfkfOYUH5Q87D7UAO+nP2u84NldNqIB+D4cGcegOwR+uT0R62UxQAcHbyRrkUa2fuR48OdWilL+PxhWxKf1wBxwNYlWA1YEF95FVHFf6teqvjSDsh7oYY98QEA/gONoJuZfh5sigAAAABJRU5ErkJggg==","w":96,"h":21,"land":7},"grav":{"src":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGAAAAARCAYAAAAi5qlcAAAAv0lEQVR42mNkQAIiPDL/GUYBzcGbL08YYWym0cCnP0AOa0Z0AY9X50dDiIZgh5ghSk5ghAX+aMAPTESwwAT4nO+NhsoAAKbRIBhYwEKswolzdFH4+SmXaaJnIPQNpN7RHDCciyBSUsJIBfBWUJju2tHQoCNYdTl4tAgaFDkAuSNmKFI6GiJ0AOffdMM7YkzoYxOjgD4AFuZM2GJmFNA+9eNsBY1GAv0CH14HwMDoiCh9ix+MHDBaF9A38BkYGBgA3N5KDhgGYeIAAAAASUVORK5CYII=","w":96,"h":17,"land":1},"ice":{"src":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGAAAAAQCAYAAADpunr5AAABsklEQVR42u1YsUoDQRB9swmE4wRTiMHgJcFaSOmP+AliZ5tOC+1s7fINNrb+gXaitSZGIohFBI+QwqxFmGOz2b27GPYE3QcHR3b2Zua9ydzcEjRsrG1LeDjF++cL8b1QFzZ39jz5BUAt8kSJMKxLABh9DDxDjlFdjxDWIrw93hCxIq+jvmemQGxVm7MW5Hv+76LMN8eD6dzC5CvpTjhvkfUBnZ5Zv0pJ4iwSqc7Zp+ory5/JZ6Ukc8er5qn7XSVXAKn5dnoysQOAsZzFQfwPOLh/sgpgItQUjE6ELTHeywHl2ZNGgC0OfX8W+cvkahPBJIS6n+0udpvzU9Dki5KLDfnKCjhPUjb7tD15Cc8iRH2W7lO3+0keJv5s8bBNQAIBCRBPP0cP/UxSlxEjLYD/CD3/bruBgARE3opWK8VUNatW+18jW+0etsIbyymSMXQspzi8e04Wr69u/YjiCL2TfQBAHA+pzJ/GYViX3XYDrdNLz1ABiOMhLRxFqOp4uK3+hbMgVsSL4J78sBZh4SzIdFjEHwsebtqPsQXxO2EVBwEJ50kU4WMZPzzXm+zV31TyAeAbdmLSIzKXJ1gAAAAASUVORK5CYII=","w":96,"h":16,"land":1},"lava":{"src":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGAAAAARCAYAAAAi5qlcAAABwElEQVR42u1XzUrDQBCeJEtoICBC6EGiN6++gZd6yTFP4yuIPk2Pnrz3BXyAtlSQ1B8SUGJLPO12u53902w8uB8Ews7km9lvsjNsAAKyNO8+ty2Mohhk0Nn/G0z0AgDmUzXLgNpCTHwZicz2FxvuK5e+eUQ+jP8yP+/oe8CL/3ST+N95ABxfv8MoiqFqlgHJ0rzbVcoXYEhkad4FaTLuAABe7468IgOfAgAAQgdDcUuYsYUNxECMyVrYsHeT73T+1K7iUnHwNh6yWKZ7NdmnSe48CPahjfgmwWSbxISzjS/jlcUU1zFfWxFt9dgrwG5Kq/v//fTkYK0oVz/yxxIU/WXcVJyH6dmBbVLOGTcfQ5e7mA/GXZQro7x1ulDQzhPySdhWHAuuagHYegsbdF3GHQNBBdK1sz72ZMtlgtDFgNH1btuZ4SIXmof4TMr5r2OaFIreZdgQnq3XcBpHik/wP2NVvxn7V3VjtREbbte5yP3tuRftlrWhkL8W2+Li6tHZn6vixmyucqlfvpxw04sYEz9Nxp36BHj0hUW7hebjOTiYAfRoeLgVHx3CtCIe7sXntSa6Cnm4xV4L8qfAPUSNvwH8m+zlootjlwAAAABJRU5ErkJggg==","w":96,"h":17,"land":1},"move":{"src":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGAAAAASCAYAAACkctvyAAAA+klEQVR42mNkQAMiPDL/GUYBTcGbL08YYWym0eAYWMCILfU/P6QwGjI0ApJ2D1ByASNy4I8GPP0jgmW0zB9YwAJjIKd+w02NoyFDA3Derx53BIwC4gMPPYHikyMERltBZKZcYuQ6os0YOqLNRiOAmoGPnMLxyZFcB4wCwgBfAGOTq1h6arQIGgxFEd6OGLbOl3Sz02hoI4GntftQ+Mjhg08OnzmwfsBoDiAC4AtUShMrSh1w99a30dCmYSRgC18m2JgELEuMAtoDm5RXDAwMkPEglLEgeKy4Jo2GEg3Av93z4GyMwTj0SBgFtAM45wOQJUYB7QOfgYGBAQChsl2javWWbwAAAABJRU5ErkJggg==","w":96,"h":18,"land":1},"normal_aqua":{"src":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGAAAAASCAYAAACkctvyAAABH0lEQVR42u2ZsQrCMBCG/wRBUREHcXISxNFVwU0cfQLBXV/AxdHFF9Bd8AkcxU3Q1dm1YwaRKjrpdCVtrWIxrch9U0h6oXyXS0gr4KGQLd3BGEXZlqC2ZPnxIrzyu+oAADjers5D+WSKTYXkeLu6/C0KFVcViHKxej9dztDlM2ahJACAZPnRo7tOUKPZGgAANuspJqM5WzLAcNxzPC+eHcIAWL5BSL6OZC3xwgmImUSYoOV25+vrNOofx7yL+7eYlxXQ36+ciYMmDyOY8UOuAUAq2xK5dMY38E3RvxwT1TtQPzlWtiWUbQnfTXhWa/MSjWD1003YdQizfPN4HcugvYkxv/+7EkAlwUmIbvsBtK+h+jnAmCXwf4A+wJiXDwAPyq2DsRcfxFYAAAAASUVORK5CYII=","w":96,"h":18,"land":1},"normal_city":{"src":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGAAAAARCAYAAAAi5qlcAAABoElEQVR42u1YvU7DMBD+EhxVrVAXGBlYuqBKCHVmQOo78Bo8BTNDX4WtKgNzxIK6dOnACAtC/KhNYaguulxtxzFJuviTIiXx2Xf+7sc/ERiOD09+EdA4Xj9eInqPAx3tgwd6JH+M354DQw1jejTMM0ER+YH4/WRCKEF7AA92RS/D63MAwOXFIDDUIB6fFtsyJB0Q0A7Wm+J3zBtkY0D96HcTqFjjgID20Osku2sAAKgYSOdLjM5OS2sYZQt507Z2UB+OsrWG6yEdvU5itS2dL/H5s/LSpcv+q9GgVh4e0gX63aRYguhUNplluJtm+URcoFrKn/+URte+PnPhY7vqef9a4fb+Oz8HRPJ0djM+2BlMxUUFNmN5xLoaL+V1kyEZGXEuem3k8D4mOanb9K/MqevNNtD5dYQyGetimG8k2cbTOd/VDhcypIxJX1l0k8NlcJq4NMns0DWZZd7k+zqJdmCmifJ+9LhmU1W7quwGy2SlMyn6tQ7gN3Q2QqoYYOtjIrNKRtVFlosdvs7UgXMdybuJsElsHsbraN4Q0Dz5APAHrdLWD97VCm0AAAAASUVORK5CYII=","w":96,"h":17,"land":1},"normal_ice":{"src":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGAAAAARCAYAAAAi5qlcAAAB2UlEQVR42u2YP0vDQBjGn4Q0BrlDB8FFdHB2kw4uWlzqUPwA+gE6OugiCE4udZB+Bv0EDnWR6uIgro4OiotFB0mopS2tg9x5F+/aJG1ShHsg0Fzvzb35vX+OnAVBc2ShD6PU9R68Wuy3LcL324Ghk4HERLfCAWh+fRhCKWt+ZolXgsWi8fb5bMhMIAiOQTEZsXbvsJuVoxoAoFgqGDohdbo95XjOsSPZifOuLusAAOqS302Y3YRVyXuo5D2tA7oFo87/L8o5Nr/i6mxtmjNRceFP9AiFR6gEPwx3EFjxvySOjisrVePDEoK9W5R5SeCHWSoDwHRTf4id8aM4qYMx7kqL8txh9mJiqZJsWCCva7fqPQAAXk52sHh4gVbgAwD27ppS+bHgAOBzRBVLBQmMqu+ppNtzOt2e5LDKRnxZtl7OsbXreYRio7CqrVqd3ebWuhK8bj7z7+C+Jdl5hP5hZ7OvMr8d4PF4m0dK1fNaga+Er+qVo2Zc1N4cp/JE3+O0zKT9X6wIlrwA0KiWQV3y8x3ABqfc2T4ALO+f871gEGyj5GpUy/w4grcg6hLelwz47CTVFXUJnk53DZWUs18ZAPGEzigdseQWWUvQzXF0NlIeR5sqyB4+AHwD88QOwnkP1RwAAAAASUVORK5CYII=","w":96,"h":17,"land":1},"normal_jungle":{"src":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGAAAAARCAYAAAAi5qlcAAABgElEQVR42mNkQAMiPDL/GUYBzcCbL08YkflMo4FPX4AexozoEpveeo2GEg2Bn/A2lJzAiBwjo4FP30hAKYJGA59+ADmsWWCM+IKjDCwczAyWQXKjIUQjcHzdIwYGBgaGPz/+YkYAusQooD7AFr5Mg8Vxh5fdJ1sfJXrp7V50AK+EBWP5GRgYGBhsoxRRFDy5+hHOvn/xHZyNrg6fo7CpxaWHhYOZgYGBgWBRiC07w/Tj04tLHyF3IutF149LH0w9zD3Ifn2/+CNmEQTThOwBGW1+qsU2tkBn4WBG8cyfH3/hkUBIHy79+PTiMptYt6K7G1uCvX/xHdEJiRG9cyCaKoSi8fi6R0O2boAFDql+gOnDlfCQIwLdXEV9IYbHNz+iiFkGycFzw+vZ71B6xSgdMVjgj7QKGT0XUcM8jNYOVAwWAbCOGAuxtfVIa53QyzxGbGMUsAp5FFA3l6EXPyjNUPRRulFAu1yGHNYogT46GkofgBwBTLgkRgHtA5+BgYEBAPSizCuIRI58AAAAAElFTkSuQmCC","w":96,"h":17,"land":1},"normal_lava":{"src":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGAAAAARCAYAAAAi5qlcAAABEElEQVR42u2YuwrCMBiFT0IXoReQChXUWQdHX05w9QF8NQd11SIFXXqZWmidUlJbS1tJuvzfVHLnnOQklEHCNRcFCOW8E5+Jb05yjAsDgPl0VWRpjuBokiKK8fZJ5RRw11wUWZqTMpoQm1zEPf+uINRzO7ilCYYo3J0mAIDtekMKKSKMYtyffqWMLmENoodRDABwbKtWTwaMjNHFQdm58/VSa9MWW03tu0Rd33nG7jM0vnnXwYcsaCi/xmubR1efvji2Bce2EEZx47hcvEcfwau2AJFdxP+Iy/cRvEqt34nPmPwbYunNSCnFyOLXIkg+BYQe6BU0wu5vNKDpLiDUIP8NNbo6RWiIINkZQv3uB4APJ6qHJrcykNcAAAAASUVORK5CYII=","w":96,"h":17,"land":1},"normal_space":{"src":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGAAAAARCAYAAAAi5qlcAAABfklEQVR42u2YP2sCMRjGn5y62U2EgoUutxXRtrNLv0Whc8Ev0rGb0C/Qb9EObh2sIgWHG7zBQVSQuzo1ynWQXINJ7jy55IbmBwfHm7z587zJe7kQcNSqjQgW7aw2M8LeHStHsRAAOL+4jeh6jvuFbxUxwGv9Mt4FTq3aiOh6jvAnsMoYwm1343RP2Mvjl4fvesWqY4CzBcXLlQsAKDPj+8MzAKDZ6uwLSn/B2O6oYMsC89eFbKwmyKrR5+BNsDlJorEnqYyvo6qrm6Sxmu73cAx8+fXNnRhEVVSPFbNcqqQGgdX5z2x3FONRPz0AaULJGmFpK8vWS/OT9aPD59Q5JfmoNGy2OoKfkILCYIkwWMYrl89pqgmq7CY59fuU55zGo750HMwma9Nh51Fv2AMA+NMJ/OmkUDHZAsiLvBdIWnuyIDAfb9iLtV5tZoTw1xBuu2vPiJrhxbdXEQX9hB11DLXoYfDxJN4F8WlIFiWLnvSjDIBFH7z4Qgo6LLTo5xfXceEP6PpUhgAAAABJRU5ErkJggg==","w":96,"h":17,"land":1},"spring":{"src":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAARCAYAAADdRIy+AAAAlUlEQVR42mNkQAIiPDL/GcgAb748YYSxGZENel2XwsDAwMAg2jSHAZlPCMDUv/nyhJFRhEfmP7EaiTGYhYGBgYHh1j0GagEUL28x0SHLEJ8zVxBepnaksKBLHrhwiihDHAzMUAzCaeCyVVsoD0N0QMjr2FyG04VEev0/Lq/jNJBcrzPikyTH6yzoBpASy0SF4WgskwwAB9RKuPaJUBoAAAAASUVORK5CYII=","w":20,"h":17,"land":1},"spring_compressed":{"src":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAALCAYAAAB/Ca1DAAAAg0lEQVR42mNkQAIiPDL/GcgAb748YYSxGZENel2XwsDAwMAg2jSHAZlPCMDUv/nyhJFRhEfmP7EaiTGYhYGBgYHh1j0GagEUL28x0SHLEJ8zVxBepnaksKBLHrhwiihDHAzMUAzCaeCyVVsoD0N0QMjr2FyG04VEev0/Lq/jNJBcrwMABAIznwSCybsAAAAASUVORK5CYII=","w":20,"h":11,"land":1},"spring_extended":{"src":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAAmElEQVR42mNkQAIiPDL/GcgAb748YYSxGZENel2XwsDAwMAg2jSHAZlPCMDUv/nyhJFRhEfmP7EaiTGYhYGBgYHh1j0GagEUL28x0SHLEJ8zVxBepnaksKBLHrhwiihDHAzMUAzCaeCyVVsoD0N0QMjr2FyG04VEev0/Lq/jNJBcrzPikyTH6yzoBpASy0SF4Wgsj8YyYQAAwCNVADd6m/cAAAAASUVORK5CYII=","w":20,"h":20,"land":1}},"bg":{"city":{"far":"data:image/png;base64,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","farW":160,"farH":63,"farFill":"#372c70","near":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAKAAAABOCAYAAACngR3fAAAJRUlEQVR42u1dQWgbRxQdmSUHycEGSwqKbKjAJVAsF53SQw4luLS+hRZaSE49hBwMKb24UHpsC/UlNJBD8KHkEEMCBd/S0GByyKE5CazQSwIKOEJEcqhEIh2MYXtQZvU1ntmdmZ2dnV3NB4M8Wmln/vz5//33Z0cZJCFHG5sufn3q1lYGWbEiKTNhvwAaoxUr2g3QipVYDdCGYCuxyNHGppufXbTh10o8HvCj3YbVnhWLAa1MqQHmsgVULl20GrRiPaCVKTXAwbBrNWhFvwEul9dt9mtFnwF+9skP1uCsmOMBX7QeWPLZil4DJEnn4kLJas+KzYKTJkcbm66ODRy67hNWAkMp9HyH715lWG1W+IwC/h9VHV3XfVSIE1TPvXb1Jrq9fZ0ahmlt1iCtCBngtas3Ay/iuQaI+8uNL60RWrEY0DTBofDsnZ1Iw+KpW1uZs3d2jA+/CCHkIITQy+dNZV/48PENrQPg2RJmEizAhpG2e8nOlZNkj7JcXne/+fpq4HX37m+7pnCXtZUrqP7srrZ7/f3Pb0bPlXPv/nZijY9se/m8iT74sGJ83+fnqujw3avI72ExYITS6zcQXFEqYYQVzRgwDeLn+Xp9M3ZvYwzU6zeoeAh6rSDIACMAbXy9fgOhpVWUn110TcDArDlItAHe3r7OTRGZMhHQ0CpLqwghhDpv2kL9zc8uurlswfs/lx1tDMbl0ebBvvHJB9UAv9q97b3+89I1hBBC9d1xzbd2aawoVrvuQWCSnPc7oJfBq5LHMFU+jI/v2wFGpEKwIXve5r2By4romPEc0XTMmqtEecDPP/1e8Teuoaf1R2h+ruqbJZOlraONTVfUCON8glDG+4uOGUOC87W1EzpODQbsHHYm/i/mi8z3gqSYLwp/Jqyxzc9VUfNgH83PVVGv30Ct9t6Ja8qli1476bGhR2m19yauDboXrU9RQJLOYUdItycM8Nx//2rHAdBti4TFMAYk8tlTt7YyvOEIjzPYW7M9w8q5j7k/538t+14PH9/w9YwiYw6j20wU2+vJcJafXXR5wyfufP3Z3QkjjKKfIsYO++AXrvOzi25t5UoiIgqpY5nxBmFA7TRM1JRHTiFwz2XZIcyKnIg+qqsFA8IV8bT+yHtdkcjSigslKm2hQ3LZwtQ9CZhTnKnHmoTQkggaXoDJBfSsSSgvvQ9pbudN21hjzWULqLhQMmKThjGluObBPmoe7FONL2liGhFsch89D1g5czzu3OuxYxRtD6I+mgej1+dra1Tv97T+yDc0w/BbPD163Xk7JsWh14HhA19LXi+6McCUsp4O6fUbXpVFFGr56RzOkfIQTJvQ0aSteYZHD7V8eBBjQDg4HbJcXnfjCqnY6OOAIINhFy2X1yPbzuZENVlkh1WQvrjAHkfWjr1yc4TzIgP5okYe9vNBzgSP+0XrgXKPOWGAzdfORFgNaucxQjjBcBMmq1ZICqwE4CSkebAfeWamWnjq6RcuH3PBG9Z7T3bw61KsNftQHpCF5WjttLZev4FqK1eI0Lrm7/14PRq4rvOm7WEK3lAMMQj0FqZgQD/P5Rd6x59Tf1CAaMSZn6uiwbDrOQiazrVkwZ3DzsSfaoHkMTnIXLbg/Sn1YgHb6JfL6y7p9U1PMMh+y45dBnbgv9g2I+BslueIj6iI51y2gFrtPaGdKu+9kUub0Pm5KkrSudkiG2R5xtXrN4QrIUprwTrJYlUebjDsKu93ZWnVeC5QdR+xDkXnRflmBB1GqDK8YgxVWVr1sKsq2GCqEVYUMQlQX3isonPj0LIlmDGxsigZIlq1iBDRrHZcllJpeKoXG+67abVoqK/K0uoJqMQzFw40LmxsYdJ1XSFYFRE9SmguMvGoH/4kr5+o0ig4vo7mTVQZoV9fRcYMr8ebZKVpmGmVVntvxDEKTix5Pcx+W+3wi5E0NFXej8xqB8Oq9JhpYw9tgPXdkrQXTMquFSiqfm4CVwGwQdPgDdTrj398573+9dvfueAN6z3Wd9Hujbfpq/yZDdm9lQ4N9wW1ieA+lsJYk0J7Mo8aQt6WQodhTERbUSMkEZ3KEAzrjTSmnTV4neU7GaPG/QtbCzYJq/PMhcWAhogsvkv6Du3UGGBxoRRYMiKfvBtLNVJvyYIxEKvxwhvWe6zvinIDwoCRhPX6QfoeSyaJPzpDMxAR2sOPgpAlVKPySlHygCrGSJLaolSUQwP/MAEQJaJ1ZcEkySlbL2Z9Dk46lvGWp/H2KdIgctlCIpgAjKVp/WeNlTZeP73zzElqjuhN6++WwAlP4xN5iTPAIMJzMOyiwbA7sYJhO20S7Y8uRpNEsXT+ZMfx2h0YcskwnFTBsOHJjsPkGP+6/NOE4kT5KxERfbDLbxezKCTSUbOn6fCLnZ8n4By+BvcfFzscGu7jyaLCEtEyyoeZVZS8Huu7IRaKKmM2IaFjjZW8XkXksD/TYCVWSR0RTa5oWGGAHh63R7HFKQnlvSj6CHVPRlPWzp5UVkL8QiXN2KIOoyIPe/nBHhlIpGOvpp/+yPfIuXFoeI3W6cqZYylwq1L5IqA4LMka5vNJ4gFVZr0yOqYezcFKItJEFfgZ2WjMJ3db046aGAy71Ow6KUJmq1gnrGM1vPbTbCfCq+dEJyF+vB7PioUh2fKA6uaDFnb99BvJ2TBxyoiAFjuJIEzYTToNo2IsNAMj6TSSB8RzNGMCiA0T9kml6Th+gvXEf9LCr1+feU41CCsniOiwR3PQRPR3RrDxkUkPjT7hWYkyNAtL+bKGp7J6oZrYFzXCybbwm2eVY0BWrTbOg3F0h8lp5QFl5iBVPCAe5IXLx1SvBxcBi7BWtQjTTsMERRnS4eD3a5fGnzGCiBb1jDLPnrKMy2a/0WTDrMOhaPrmMkA/glrWwMJuchA1PBYNQypuBCGqgd/B0y47Vp3EvuiYYDtrUytL37Rq1Ayv8ZkivN4vTfRI2iT1T8WxQiteTDiTo2EXUeyWpjAuyoXSdAVZClw1ab52mAzFzLQZn82C9feRpfuJHdF+mMOkMBy0Snl4v+LptjKiNa0bUsMKz6kV3FmwSGKQhNU/Gk9XeFKmCVfy6MAv+WgO+RyXk1blnXh8MIDBt0mLWn0H6RzreyYtKxOvPtaODJ1hKEmHlMcRyiEdkzgPKEJE45UZZdXDCp9eWXPxP5rEubXmN1KoAAAAAElFTkSuQmCC","nearW":160,"nearH":78,"nearFill":"#241b49","floor":"data:image/png;base64,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","floorW":160,"floorH":107,"floorFill":"#51416e","floorRow":23,"moon":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAs0lEQVR42mNkQAP/v135z4AHMHLpMCLzWdA1/Xx3BZ9+FLWMXDqMLMRqRFf34s4FiCH/v135T0gzTLGEigGKOLuQDqYBR7dsZFDWkEfRwC6kg9WVL+5cYGBBtw2mGZuzsQEmBgoBhgvkzWIYSAlYFmKdiy1sSPICtrDB6gJc0YbLayzEugCX17AaALONmEBkhKVvYpMysjcVHDoQeQFXcsUVPiguQM9tD08twWmAgkMHih4AFslfdyiFq3QAAAAASUVORK5CYII=","moonW":16,"moonH":16,"moonFill":"#e0c078","cs":["data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABoAAAAICAYAAADnVO9eAAAAYklEQVR42mNkwAPuXPr2n4EIoKLHxUhIDQshwx/f/EmMXRj60C1nxKaQWMNhQFadHUMfTAxmIQs5rkcH2PShizHBGLNm3mGgNth+4DGmRbQGKBFWln3pPzUN75qqx0h3HwEAeGYo8hBXaiAAAAAASUVORK5CYII="],"cb":["data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADQAAAAQCAYAAABZRVzLAAAAtElEQVR42mNkoAD8////Pz55RkZGRkJq8OklRx8LpR65duorQXX41ODTS46nGMn1DDmOJBVomXGTHFOMg9UzyJ4iJVkyDmbPEOtZZI8xkpLRB5NncCVNlsEeC8QAZPcyDXXPoLufaTh4BtntTIM9f5AKmBiGGWC6evLL/+Himasnv/xnGk7JjYGBgYFlx8p7DAwMDAwe4UpD2iMwf7CgCwx1AG8p9BZdGtJ5qbhPj5GBgYEBADi1aejIa4F/AAAAAElFTkSuQmCC"],"cloudAlpha":0},"jungle":{"far":"data:image/png;base64,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","farW":160,"farH":38,"farFill":"#295e70","near":"data:image/png;base64,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","nearW":160,"nearH":59,"nearFill":"#1a3541","floor":"data:image/png;base64,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","floorW":160,"floorH":67,"floorFill":"#3a1d29","floorRow":0,"sun":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABoAAAAaCAYAAACpSkzOAAAB9UlEQVR42s2WP07DMBTGv1aISkkHByYQKmuqXsAnyMJahRtkDKEXqHqBUDL2BlSsLDlBLoDoyv8JkoFUSpewxJZjnDSUgniSZSeK3s/fy/N7Bv6jRcnUVM3bdm5VzOZvQNyK2doGxAUA2+rlqtEU1qqCUOItomTq+rZ/CQDji1Olg8n5FQBgHj60omRqUeKFjUAyZOhQDPrH0HSj9N0yjaHpBpZpjNu7e1zPolrYTh2EqZAh4jtNNzDoA3AAADklnhK2sw7CbLejl55XWcqVAcCgf1wLa7NFAbEo8QJ55wzS6eh8sHeabnB1hwf7bNMuJV4opn5bUGRR4oW21cvFkIkQ0USYaEOHwrf9ywK2YLC2ELaQpep3TFRmkC5XRYkXFJtfcJAqbHICZFmKrPgv7HnNOSyFr1LRMo2xTGMk709I3p8qgass5d+KtpEisnf0ZccrAabpBuLkA3HysZkillGrLC05Zms5xQHg5fVtrSKTEi8YzUdnrKzI4ZCBqpBVVYjKc8RC8fz8yB3KQzamRnWOVLWOnyd3fAIAMEhXmVniP3l5fcP1LMJoPjorwmaysNVVbw4bOhSHB/swSLfkWFZSB/lSVIUwhgWsBSAHAKZOtmByAwC1kCbNj3fWqsYndVrzJ522URv/rbvD9i8of3LV2qZ9AqOH5C6t4O76AAAAAElFTkSuQmCC","sunW":26,"sunH":26,"sunFill":"#000000","cs":["data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABwAAAANCAYAAAC6hw6qAAAA20lEQVR42mNkIBGoJZX+xyZ+a143IzH6GUmx7OfP+/9xybGzKxJlFhM1LIPJ73p+6T/FFqollf7HFYzI4OC7z3iDHAZY8MUPLF4uT8/CaoG9EC/cIlzmoMctioXIButmTsPpWpgl2CyDAXlFMYiZP+//R45fRmLjiJAFyMBeiBeFr5s5De5TJrWk0v/EWEYKWP30JQpGDmYmYnwFw+SCuppguKUspAQVIfDq+zc4W4yTC0MMnmhyqhczTGmNZZi68woDrQE80fgvWPaf1pZtTIhiZCSmnKQGgKVSAMytdiL0rt0KAAAAAElFTkSuQmCC","data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACQAAAALCAYAAAAX+i97AAAA40lEQVR42mNkoAJQSyr9T0jNrXndjMSYxUgNx1yenkWUWnZ2RYL2sVAzFIgxg1BIsVA7FNDBwXef8XoM3YEs1AwFdMvRwZTWWAZ7IV4UMV0Ghv/IDmPE5hjk0NDNnMaAL3QIOQIbsBfihevLqV6MElqM5EQHOY4gBuRUL8ZMQ09+fEfh3/32hyRDp+68gsLPdtchST8LAwMDg0/XGgYGBgaGLWUhDDIcnAzVBy5jKHTTU8CwGN0ydMeQGjooaci1ufu/vpk6VsW3n39hoAfYmBDFiJLlXJu7/z+8/4phIAAslwEAJvldRNmjoecAAAAASUVORK5CYII=","data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACYAAAAQCAYAAAB6Hg0eAAABM0lEQVR42mNkoAJQSyr9j0/+1rxuRlLNZKGGwy5Pz8Irr8vA8J9UxzHROrRIVUdRiP38ef+/T9caBgYGBoaH918RVF9U7svAwMDA0EdCyLGQG0JbykIIqj347jNW/cQ4jolhkAIWYtMDsVGALZSU+AQYGBgYGKa0xjIwMDAw5DAwEDSfBVv6wZWz8DnoyY/vDHe//SEqNGAOtBfixZlzmYhxFC0AsqNgjkWOKUZyHIQtushx1OqnLxkYGBgYxDi5IFFcvRgerYxqSaX/cRWQMAe8+v6NIVRanCqOgoFX379hFV+49DDDw/uvcBcXMN8MaK6c/+AxXICHlY0kh4pxcjFM3XkFryXZ7jpEOwhWYDNiKx407QwHNLSuHzoPyZXk1P60BLfmdTMyUqPCpbajGBgYGACxBoJMZ3VspAAAAABJRU5ErkJggg=="],"cb":["data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAE0AAAAoCAYAAAC7MHdZAAADeUlEQVR42uWaP2gTURzHfxcuaSsniEOlNCGJ2IBDQSdxqZODg4OUuieT7SgEF3VxKoG4tVsySzY7dOiUOHTs4FBowUSSUls0gznMv+Ec5B3vrvfu3t+7S/1BoPn7fvd539+/d9UgplYolS3Seye1ihalb1ocYX3d3fL9zNxcPlK/EzCDViiVLT8l/jdKQxCCVIZsdXPHDlUSQFVhHAto43GbWTX1Theq23vgB1pVGOuzCAxZNr9IpV7ZitOiDknacOyNhldeS88vBKoRAKC6vScV3MwUgiBAYVrk4bm6uUOd/GnBIYVdK2h4tdv/WLRDT4aaVAMLHRprW0GCYiRTAACwsXwnEBj67Ew3tyLAkJnTyfXIaSoaTL9QM6cT+30/NSHAMtsPXbmCdrcsniaTJTcFKc/Rz5XKlig4XYW6eD+nytZfPnI8rwIIgdNFgNHmJ5YGNj2/EEoFDL0QqFRO4+xCScWLdIxiUVhcey006PMWLWXQSBdezGViAZHkB03RSoQZYkYyBc3+AJr9QWxDj+bURQ87rJ7cvukJGTd3p1/MZajVtn/Ys/9eWTIAAOBe7ha12uudLhQC2pJQJwKvfqre6YI5nTgeOKB6p8sdnqfnJpyem1yb7lfsIj0a8oMhAovFeqMh9EZDx1qv3zyXF56IPspJKNSa/QFcDv8wJX13SNIaHn5B9uxxWklhCYQ2HrctdBPDy/CkbiRTkQ/TkQ/sQUc5JLUEJVqlPdiLB57ncjzrkoZ86edpXsBkgWIJTZnru6upVGjuVkGm0QJDKsNvxPCkDXcxeFWreCuNZqakSeCiO8uqqI21u8S1UZONN9uN1jfm4oGrLeE+jcjmF+2HO5fxVrwwQpClNxQJU8fsSRofkMwPfvy8smOiDsoARFKG1wiH/PNb1+/30KCvBQ3gjbMLBwwSNC9gslXDC4zXDzSG4fb50xf/iQCFo5FM2bDM6cSRE/zyg9eiYYeyyMa5RzD0XMdD8PDXb/qTDBc40q6vLBlM81/UOTAInB2eAADv364Tw061Y7Nkx62jf4UAgbu/9tBRwpGCVEA7bh3Z68UFBo2d1CqahpfTsC7Cy8FsfhFuZJZjDQ31aRprc8tzkbhDpMO9px8q1vf2peM1VZvoBsR6Oy8h8mVW8/v9g3fl0P5XDveD55qFHKVRpuhGyL5dKEMYfwFtH/ILurwA4gAAAABJRU5ErkJggg==","data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFYAAAAjCAYAAAAOuf2FAAADVElEQVR42u2aP0wTURzHf685jZhiiDZYIsZqoAmJHRg7WKeGOIgTMTJhN9TJpHFgMy5GwoibmJg42DgQBwYX7dLRgYFECdRQojRqiDYttMM5/Y53x7u7372+a+9ofxMt79579/l9f3/eXRkExJK5vE4d+/XVCwYBNxYEmOsvH3i+NjW/HGjIXd3U4eG2Lnstgg0qXBY2oGgLn9ZNnxenpllPg03m8rpM6FMUHCTlRuAEmZcC2AcbUov0qqJODFjMrX7kV97uvH4bCOdpYVdqYXcPAAAmMpMmuKtzs4yyvl8FT/MLmqoNr5R3SONupUdNnzeIh48UgO4H3EgYVRqGvUorltLkpwB0P1XqZNRc/vjJbQAAWFKsXM1PD/M3l5pfhsLuHsxcuugbTBXKVQWXyUKVqe5YaIYHzpq+rzbqUGs1276Z6KnTxt92DnRy6NLzD8rqg+YVqop2qdqoG3CrjboyxdVaTRNcNwdbnakyLXTt5HXz/KBQvSrgUsaoiJCO9LGf//wTKpAHZw1PhAswqDTf1lrNrudsZWDtQhrD/gii2CoHDQAAGD0zANl4DD7+/GWbRzHka60mbJb3YSwxBGulirCfVdmCeUkPGmXSK1eHAQDg+3bV8wbdigivrGw8BivlHcjGY67Fif+8Wd43vlsrVZTBbadr0GQqPqpLVDgo1dguTFGldmrl8yKu9+1HTTlAp/unntQ0FRUfQdgVBFX5DsMdQ75Q3Do25t29tNSaqH6KMCjKZbK9aeWgAaXff4+p6X7isi9geagiezh13VQQ7VoqJ7BuUHHOp8/euz7QYV6VipNbLX3hnFF8/DhJ2YGdyVxT0oLx+dvLeL7rebTwxoBL6gqcIFEa8rCYF3VbuyG8FtOEo2KpqvPqbZlQd1OrdV07h/N5mdI94DxO8/P/w2Oxhg9I8Dgn62lsecYSQx1TWKG4BeMjUeG6IgfzbZkTVJGTreNF8/OwIwAA03dvQK/Y+EjUcIafEcWSubzuBNapT6SEkkyI+w2Wen+ytlH8Ym63+PdGfaMBtNpEZhJW52ZZxOsZuG/Ohi8xGeXhQ68pWaRErw9kyErtVrqg3KSdye4V12wnkvs/MbJxSLvpkfw89mihzr3Wbj/3y+1VRc35D/4hwhllD3aeAAAAAElFTkSuQmCC"],"cloudAlpha":1},"ice":{"far":"data:image/png;base64,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","farW":160,"farH":34,"farFill":"#437ed3","near":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAKAAAAA0CAYAAAANODN4AAATK0lEQVR42u1df0xUZ7p+xsJCAgaNkzDq1B3i0CLiRsHNJSZ0sbqhsduCjdm4V9aFjb1iUluuiwmb693Vls2SSFlqTYAtKa61e0nTVNi2RtJaZztJw8b6I73IDxnTWUUKCQ0QIcEdzOwf0/fj/b7znTNnkKK28yYTmZkz58f3Ped53/d53+8IxC1ucYtb3O6TOVPdYWeqOxwfibgtuE2GZsL0ioPw+2mL7ifz2fksbnEALoh9OPhlfDbiAFw49guOBW0zY9ziAIyzYNy+FXPcj8RD9/nVqdmP16Y4kJqY4HiYBnIyNBP2LPWYfj86OeiIw+0+A9AMfByAa1Mip9QxNINdP0x2PEwAjLbNw3ZTfWdcsKr1XZ0KS4wHAIGJuwhM3BXgA4BffDL6wMaDdE12dcyOoRm8/c/peHx7PxjQmeoOv3Y1IN5XPbcHADDQdULa7nn/uOG3Hz27/oFwXxxkZgmUjtU5o6vXDwBfXTz1vWbFhIU60InXPwYAlO3filC/DwCQmV8mQJiZXyZtn7N550PlXqOB0Jv2iAgxitmNl5p4CnEALoBdbqr45t/I+8THCwEA9b3T2u27z7c9EGwXDVzciO14WBH5FwKAaqxLbvn6xAx+96NURxyANtgg1mCaXKgz1R3Orj8LABhqfxcA0FheIW2bubc64p6baxHq9y2I+yXAJT5eKIUF3G2q8RwByux71QiM1yci3wXSErTn8X3LlhfNZaLm4pImQzMCfNxS0r3S+4Hm2geK7cyANstud6UEai72wfVJ9I5Ox5MQOxPFA3C7TGgG2PXFNeLvxcvcAIDhnkh8SHEiZ9CFjOlU96oDnxlQ6fvmzgD2FnkloFnZg5Jwzdf42sFHTC6Yg8+z1DMvLuNKxyFpwtva8/DKrnXSNp6lnnlzTXbAx+PSolVJ0nedN+4AAFanJURlNe5yKdQoPNrwnWY07lHs4CNhoU5GNZ4B293XXEAYzcWq8RoBxso+7griY0Bit7UpDnETcab7uCuIrfke8d53sFIC4RpnMgDEXfBcWINKTzpgmP2mvndasEHm3mqcKc+SQCliQQ04PUs9tl2U2fGtANc7Oi0B4merU4Vr7bxxR4DEd7BSJEtkdB0EwoPv9CPpWhB3HvNIsW3h0Qb4DlaK3xEYbwWG0XPgqZiv70GqrqhjXt87jWObsiyvadFcGaRjaAZcXFaNi8pU+eCujcd434Y97x83SDz1vdO4PjEjXgQ0enEgmsV7BJ6B5lopYdJVd9RkS024CHi3AsNznuiHvXvIEWviQYPNXU7njTuShuVMdYd/+rcrYoABYKXXJQJtbpQZ67Lffa1Nhs8ayyu01QM+EXRsYjMz40Dra20HAGSVl0jbEAtS7KfKRgDQfq5V0vaIyenziv1/we2vB8X2Gdkb8WXP5wCAqZEAMvdWY6j9XYx/2mKLATkAY/EKC8l+RAI032bnaBoDLs8rDYf6fQJ8urubJgUAXv5iMsxByN0MAPQwxiMR2spC/T4c25QVdfvleaVhmuin3RnIrj8rQH+LETSPw3j81Ts6jQt1x7F4mVsCSbSsl1vDpQlU5qYBALb/9qx2m4zsjQAggKdKTzp2tDPRwbEgUhMT7iv4dCxMHjC7/ix6DjxlGsNbnvmLn/UJN6Zmg/Q5schHz64XBxmdHHQsB6ST2lAhs1n3+TYUuAF8GGG+gW8+d2VHwHbTwkV7tx0OE3sQQIpXJCA4FsS21j7TxAGYFcB311YJEF5g212oO44fV71g+P2BNcli3zqwlGwpt51UjY4MC8CnpHvFdcyFZeZLjfg2wEdEQCC07YL5Tl/8rA+N5RXCnZA97c7QD64yEMvzSsOFRxvwRsEScXL09693zCYdOa80SUBvuDQhxUnkovnkryjZgZVel5QskB18p196n3QtKIBP+yEQnqyuk/Z5pjwLz/vHcaHuODKyN+L0HyODt621D7f9XQamXLzMjeEeHwa6TmB9cY0A1M79v4l4g3MX4Ux3ieNTnXt0RI79hnt8ls0J/xgPhdVyHyVVL6313hdX/PIXkxIAj23KEiEQERMvQHz6XzmOqEkIvxCKeUq2lMd8csvzSi0D5DfflRkjmrZmZWo1Iu8HIeT9IDQvg6y61amRgCVr6RhydGTYALhYWOa7slThiT93h2NKQgjNFKRTpYJ3q1CjAQeuzl3w9iQzeeT6xAyKViVJSQ53c/zYBbsj7nrs0gCGVz0qkgbKcMcuDaC7+5a0D4rBKCajz6gSs7ggX2JA+hwAbn89aHhPDAgAhVvy8P47HQKkFE4Q+xEQ+XsdE15+a49DnQe+XIHGkI8PeaSFZkG6MXTJZPu5VuGJBpprDezuTHWHLSmHEpDtvz0LZ7rrG1dUJgEKADp39+HYpiwRi8zX3aoO9L7WJhzblIXL/T4RU45dikSPrhs3BQjpM+76uLvklpOzUgbGtSCALNwKDIttnemuqOxVuCVPAvaocpxYbMMvW8KX39ojxpG7NIq/D6xJlkKNaMH+XIBlZz8032fKs1DfO42t+U04sCZZm7QuzysNqyB0xCLi6hiNZ8OUteqkGx6cvlGwxNCWRElNY3kF6t5rAQAUr0gwJD10nA0VTQI8ZuY7d1EeVAWMBECVJQHgzmMe3PZ3aRlMx4AEQL4v2pa+k5IwzTH5b26ePgwVfCRpvPhZn5RYDTTXCmGcgv17BaFdAOrEZ7o5uMfjRYavLp5yLM8rDaeke2GrgqGCxcytepZ6kPh4IUL9PkmkVuuhvApQmZuGwMRdqUuYZBguAak6XM7mnQKA3d23RMWBkg0K+F3ZhaiqKRX7n49GVwIJB6AO3GrWT0kJv0FUcPN9Egh1UhRVUFS5az5a2P4xHhIY+I8liQ4rkFp1h3NscIIBUzykJOTtf06HzXrZAhN3DbRa3zstaYG6disz8NmxzPwyLZVzEBGTcOCpmeV8muqKF8fgattefzXqfhcvc4t9WumfvoOVBlH/fsSA6nzRi+aN3puZQw0mrcpr3rRHDBUQcrs68AlX5e+6JyDwuisPcl3ZhYJBODDoWKTL0fnyTN6MCWk/ZoxmFgtGY0BKfp75ebFpiKC7eahkSW6X3BvV4elzusnvlQE5+5Ec9n9POh3Rkg91buyaxID8jqt6bo9wWy+t9eKltbK0cKimU4r5VCPB1wxQBCqqkVLGqDOqu+pYzgwQXBQmN6BqmfcijczVKEvWxYa3vx4ULz4nwbGgAB7XZzn46JrtLpiyY6TFqqsTKUwLjgVxpjwLZ8qzTMEXLeRxqJod17BI6+KNA49uPyzueJJfAGDJE3swNRIQ29J7KzYjoGZkb5QCdjNXlbN5J2oOFUlMpgKXBGFV4iGhWo03OYvaYUAu2egYUAdo/5tlWF9cI6ofXLbhLKgK3Ecaq6VkjAf4aqMFB6japfTfJy6HAeBPZRscsbIfGbFgtC6j4hUJyMwvE4kkLUZTPQFhw3BCVOYiOYEvDipg4+4fNIquHHCu7ELhCtX+t97RaVGmGWiuRc7mnSKJIPH44r8SJVrP3FuNoz9/XBocCsDVczBb1+FNe0SI1QTClHSvaRynAyYByEqaISCp51Lw6xMSyKZGAiIx4cyo/o6DjQOtvnca/pM+UalRr5kW9tsBoBn4aJ6oguFMdYd/efx9AJAahzkA+Tn7T/ok4KlYMVRCrnQcwpWOQ7jzmEeAQgWdmeJv1WJVmZsmCvbAbHeMCvJXdq3DK7vWie9VxuSDo+su5uegS6isFhPNh6ksxgNw/5tlUX9vVWFREzkqW1KlRm0JoxV30ZjviT93h3npkjPfSq9LAh+Rw8V/JWJba59Ue+eyGZ/b7vNt0nUdaaxG3XstqHuvBY5oabVVBkMgpLZ6on4eS1LcxS9q9EyXAXgENupaIZbkXSxq17COAcc/bcFrVwOiK5nqzrrln43lFQYXrlY35go8DibOZpn5ZcKT/OYvrYYqDwDhvngzLAcfj2UP1XRKY9l+rlWq05Mb5jVbdfknX61INz6Xd7h4rEs+kq4FxfHpWvl483PnLXb+k77Zbhiz6gUfvKtTYQEkYjOz0ppuYFXWookgZu058BR6LDJqVfPSsbAd40BWy2sEGisARgNpRvZGMSHkYs3atHRjpBoJzkLOae+O7Lskx7Dt0+4MWb65eEqATm0c4NZz4ClsqGjC6LUgnNvyLSsYj24/LER6AEhKd4lkgxiRiONkdZ3o+OEJyemjbbMx4C8+GQ0TU+jcF1GrCkCKp+h7s8dPmLnJJ7dEBuqTc0bXzUG4Nd+Dk9V1WvekAnBqJIC691osGZC31tPvVbbKzC8zzcx1AKTPeI2Zi8+88lG2f2uE6Q6dsqVV8rXSZt/RhOt6KKM9/oPIh2I7ctnUOEDHpXmjRFSNl6k2TzeM68NaXAp5pZKmmqg5dGl2ZW6apPdxlqOJPLAmGR1Ds63tanZWtCpJ3Nmhfp80IKF+nwAfNwIi31bHcCpYeAsUTQq5kjcKlmjBpzKq6jrIbfDj00DqADjc45MAO9zj0yYYGdkbDQDkmt+SJ/ZIxzMDp3rjkGdZ40w2SDaA+doRAh9JOkWrkqJWP1QPRTov1eo5uai5g3rei6waBw6+02/oq+PrJwh8q9MSTJ8iYJUkWMWVVu41Jd0rhQa7a6u07ft2z8VuI6lZxzRnAXpZGV+TYjYuBG4rfdSuUdOq3e1f/mIybOWuuZ0pzxI3iZUurAOfYECzrgvd6i1dLEZBM4nW3IUmXQviclOFYDUa6COH94vf/N3//xIDchYwyxRVxuJuVT3fn61OFX+Ta/YdrBT1ZmqS4GtIdAyoY0F+TlKMo0gj//t25BrbXn9VbNd9vk07KVzKojUqtBKPu+F9rU3wn/RJyRy/bt7Ia+WKnanusK7sx2vXb73wDEh8tgI6ID/p9tVflRvUE24JPFO6UHc8DEDbkv7Rs+vx079dwd3XjIlA1XN7xECaCdDflhHwKnPT0HBpwrDskUBHILwVGBbuWTeYtL9YWuVVrbCqphQdQzNaWUKX/Zsdb7jHhyyUCGDZWT3H49oVJTsMoNWe9+Sgg5IV0oEXL3MLkZwYzqpMy8eTQrfAxF0UH2uB3yIfMPX1VBmhu8aZ6g6rcZt/UJ8E2HG3T24pxE8K1gn2i5UBucvtHZ0WAIzGgs2dAeE6yHTPJbxQdxxTIwEtA9KEqMsDeGaosuSKkh2z8SYDBJexoslfFDv7B+2FMOOftoikgc6Z5lPXm0cAJALqa22XYlDu6Ugm4vIaV0YoJPvg+qS46bkOTNm/6brgry6ecnDwmcVQHHDqHRwcCxpe/C7i4AMiC5c2VDQZ9qNjIq4trXEmSwMRNZbzd6FjaAYdQzN43j+ONc7kqEs41bhMBR8Q6aYWXqGmVEo8qJ5NT/0K9fvQfq4Vb//1f7THUuvW3Ei+KnBbnyvPVsntE8OZkQ4fa75ElcD3+321+P2+WoOmqxrd6NzWpjjEi7qobHVNcPbjrPXJuUh2y+MYPnA6jZDuDPUpqVwn4wuHaEB0TMszPzORWq2W0NICdYDV9cs6kVsnu3AQUmMof2QHEKmHcrdLnoFipc4bd8R6GC55qRohMaA6B6pspTIxl0C+7PkcgTOHDSzIH7KuiwfJ49CNry43qDlUJM37ttY+7C3yCjGdCIKrEqvTEmID4E8K1knMpbqCaODjplYmVABdqDtuq2QV68N+zBagEwiH2t81Bb2dMpqudMhdbs7mnbjcVGHoZCEjIJJEw4GemxgwkACfB35sq86hm6cPC5CpCsDVqbBBGOcyGiU+tD9y0QVuYOX22VWAZE2v/8pQCePjnaCm31ylppPVWSzg0y1GooE2exjQj6tesARhSrpXmyzdi1m1kEUzHuNZgYBrbmS0hmVpbiY+P99rcKUEwkshrwDhvRrNl9VCMbMkqWB3IfwnfaYaJddEScbjtX9+YzpU8JEYScY7ns1MJ3ySq51L8V/3JAIed/BMXY3deKdNrLbS6zIIufW909LaCzNmzMjeKJo3yAXqJkhNnihB4s+qIaYm9uDPG+TAXjrQJoiAt8HxigxnKTr+6rQEKUPnWSs/Du8+2vWffzDE4lJnuiazN2sk5mO4CIh0TRAjqU9AsLLVaQlR1/Ley5NDOUMeaazGkcZqrCjZIRaUV+amSedbtCoJlblp0sDZAd1Kr0v6jRoebM33aB/toWM8GmgVfIVHG1B4tMHyMWz8u6zyEnTeuCMI4PrEjOE8HnmpwTQE6T7fJlwusZGVWK8jGr7WWpcsRXuON42FTgaaGgkgI3sjHPy/UOBNmyoAdMC0Cy7uZq1cLwez+j1919wZwNZ8T0w3Sqxmxfq9o9MGecLKVIBwHdJOjGqWnZslXTrj9WIaN3XuaLxPH22TMnjVi6lSF79Gq3NQGZEY1rE8rzTMFe+luZnSBaotUTqjGOZebHjVo2KwdfujBlVgtmmVztWKofkAR2NrFfQ0BupDJM0AqHPN0WJDdTUfL9RzWYdAqwsvVnpd0jmp50GPMHHduGk5/rcCw7jt79IuI1XngcIMfo4UQ/O4Va0c0XgQpv4NLY5IOROA2DYAAAAASUVORK5CYII=","nearW":160,"nearH":52,"nearFill":"#71a0cf","floor":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAKAAAABCCAYAAADQQ92kAAAUNElEQVR42u1cfWxU15U/E6wEArZT/IWNHeGkay9mcTEp1KTtZtm1oK5UQLurjRTKZqFdVQJXLH8gNiRKRNSSWmlFLJFI3U2MEsepIlXUodImIKcuRDIsFExxMWsHMlbHH4zHnsQ2BpKQnf4xnOvzzjv3vvvejDEEH8kCv497z8fvfNxz7zPADE05XbtxIzGjBZnumVHBDAi/dABcXFN31yg7d15xIndecUIHOgq8uxWEXA9pAaBO8Rx8i2vqEl9WQKL8kU96jUCU3rkbnZODcHFNXSIjVcUDQGJORkYIJ2iPJ+f4h/z9d4WSb+pA/Yv64EB7vnMQovHrd1XkIzpxgO5C6/4QAMCZ915KTwqmSH90fsgVdmMnWu4qxXtFOdTXlzk7LK6pSyz/zn944iUjyMDUqylh9AMAaOoegt3fWAl51RscRhm+0he605Vbve21BADAxdefg5IHFkFe9QY4895LDs8veWCRdWQoeaAlMXylL5Q7rzhxJ+vHy/Ha4wnY0bAbwp/tgmeXFgIAQMjvBKg8Cr6ahQtcz16KxWD3N1aK49zJSqZ1DIIMAdgeT6gMwNMvAEDLznrA1OME4KI7Xj+8vqMyIWba4wm4FItB+LMvAADg2aWFTgDaFMjUe1GxEgAlQ0jKvp3BKemDR6/2eALqntgBAAD739qn5KYOirXf8RcaYP9b+9T1xx8qVWNi9sBrt7N+dHrhDrj+579L3ms9pOTG+yhvSIpuJvp+8x/hzY1fC8z8tqNhOLR+NZjmwkXNdNI/vX46sbW2UhvRMIXQsoM7Hi9RqLPWPbFD1cZcF1i+uFP1Ilj+TCMc+c81IR0oTAANugKnYy6uqUvwCE6dkcrf1D0ED+flQd0TO1SG4JQRhKlUQegF9DupVfHo/JCoWACA0ntnAQDApvJ8BcbW/ssqFT/28jvWOmqPJ+Dtj8JQ39gG127ccBT4dJE3FbqzHRPB19Q95LguARafDc106GfoVhI6KwJwZituhqYViBnpRDNNRbpFiK5e0F273RTmtdDiOgmix6DPTIdOJBty/ehKFACA0PtDnyf8DGIzaDrrK53ydcU/V4oNn36fDyrHVOvNVgc2jn8r7CumYGlieq09nrhlzPG5bOfF5/zyOdVyTcf4pmtUv0H0nA5SEVCXYkzMXIrFAABUY5G3Gii19l+GmoULoLX/svYZHPPhvLzbMg178U51YpKBrxbxWfounQv/T+e+FIvBicsTAACwceki3zyYdI62otfpmM2dva55W/svu/a6Jb44T/cERbwOfJSwQUsVmE7C8W8nMumDRhjeqrB9l1LB/NlQMH+263o6HFiy2b7te43vHH+hAY6/0ODLfqH3hz5P+OlxIfCQmQ0v7gKAyW2mDS/ugpqFC0RwlNSsg0jrIQAA1RnH53AcU3SR5qdjcXrl3XMAALC1ttJ1jV+3cTgECOeRymojB8pgAh9Gk+oFcx3yUlnpDozEj04vJkL9lFXmw+nDF9R1tBulVU9tBwCAvlNh8RmcX5c5HADEh1p21msZf/yhUtj7vyddACipWed4jjKSXV4FWSUlrrEkgXY07HZ5MAcRKje7vAoAAEa7O0RlozynD1+AzMIc1/vSOzxF1De2KT6Rt33b90JJzTrYtWW1GIUrNm0GAIC1Xy8UI5Euc3BjU52ORSJKh7u2rIan97zhGvenz/2rC4BUn82dvY7otKNht+KvvrENMgtzHON1NR1w2W4sEgEAEO2pI3xH6ecf/zY5/sFj+j6gFL3wWuMr70LjK+9CdnkVZJdXucA3FokocOC/nAkJtDj2VJJNykaAeJUN9Y1tSkb8CUotO+tFh+R6HYtERPABgLqOfKGz3K71tGMRwiMLjyrUcFJEo94zPjiinQyfw2ckYHJvfnrPG7Bw5TJtBERa/cM1rqIdywKJssurHPNwkPLSQgKYKRJEWg+5IjoFtWlc09h+ohAtd3DvOa96g5oT5UfQRloPuezLIyMnk70DtWEkpSAQS2rWGcGXCtFxuZf3nzzr4M0UbXCv1Qt80jxc9tOHL0BJzToVrbNKShSfftKQFPFsgSbpye/cNIDsaNgNW7bWWs8nUVfTAfVz5idb4MxPtqQnAtK0SL2HhnUAgOIVziNDo31jsLW2Ui3PTTTaN5Y0dHGWuoZFLFcI1gt4n3o/Ah/Bic9inYOySBGDv4uRgALSxtHGB0e0DsjHpjUp6hZ5lMYoq8wHAICec0PaSEPtMNo35niGjkkdmIIP69C2V48AAMDClcuMtju6bT0AgDpkDOA+7b78mUYXPiT7I2VwD0HGUTle4PO7mqTA8/S0g8cUsCRQJMda5ihqcRGAxsB3/Hg4n8ekUNMYfE5caGCZw4HHQefl9BLhc/T+wpXLXADGHqIN8LqaDiSDkniK6SXHb+t//jvoOxUWdUbbRihjCI/Yl9Ss86zlpEGxTYBCoeDINC7VTaSLgBjZ8D7lD4GsMwTnP7MwxxEJKDCzSkqUbJQXnM/LaSQexgdHXAsLGpUloyMAaStGyhg4p4kv3h9E8I9FIqpexlaPToc88tmcF8XzngAA695pU3xE49cdPIkApACTjI6RrrmzFzYuXQTNnb3QdfCYEqjt1SNqAcN7fwhETJESMDkQi1eUwmjfmDp7uO1o2FP5qEw0JiqeylFWmQ/R+HXoOxV2AVBnTDzbRyOHrrTgTijVlzSyS6Dh4ODgpM/oQMcJUy0u2rAWxawhAc8GdADJXR3UTd+psKoL//2D44pPib97KjZthopNm32lGdxiwbQXpGvvp2OOuwd8a0dH1FiPrF2svZdZmKMiIfLnZUSbulbrHDedUwIfQPIAK/5QfiXwpbrgo2BMF9FsuPyZRoeT6PQaWvOzIwkd+Kj3ld47y7UTcCkWg33b9zo8u63hSVULYArClgYqmTaybVI0CoBRK7MwxzMicIF5CsAGNR3H9G0LnmjuOTek0juttzjopN2Bik2bteCsXjBX6ZfzKhHu1fKI7PUeTcVetd/S+++BoooC2FSe73liBvunv/7tn9Q1jIKPvfwOZBdnyRHQqzinBkLvbO7sda14eerVNZs52URCnpp1vSfb6GX6QPyDo3+CD45OKvH5zkHx247MwhwY7RvzrMUo+Gwihw1RR6Hv9p0KO3ZUdL1Ym9YZ1n06wCHo8OfwHwbh8B8Gfes9RP+aAa54pWIfBQ1/9oUaSOflHCQ0DdIVnu1CBaOerliXhMNCGFsGq57a7iiIOWjRqOjl+EWXxD9dAJkWQyifLvKh/v75e3/jaIvYApCfeqEdC9wqpM1vvrqWHBltiU1raXuUzo0RGOWnC72Lrz/natsgPtCGof86P+CANUdxdnGWow+3+odrXF4m9bVoMU4XBBRItEjHNC15CTUub1VwwyLwaPFMP+DZ8OIuV4qjEQUje8H82UrOSOshkT8e/UyrSRMAUV82aRePSkkAbO7sVTzgghEBaAM+TJmRT3qB/1UDWkbRUooDkNq0aslfJ232rW8CAMDbv3wNYidaHB9jOXZCqAdura2ENzd+zZX+TMVrpPWQGN5L752llDY+OAJbaysdvcPs8iqIxq9DNH4dNi5dpH76ToWh6+Ax6D95FvpPnrUqxiOf9LpWbvhVVuxEC/z3t1dp0xkqEpX5yNrFKvr1nBtyGXFrbaXVwsi294k6qFm4QPFFr9HdHh6NaEnEwSX1FU3gozrTUfizLxx4yS7Ocq36bSiDh30auTCU82Y07dNJtR8aEtsn/OxbfWMb7NqyGva/tU/tPiDQ60+FVfqgtHDlMkf6k+pIk9Ie/9EP4G3yPPdoNGBX0wEoqVkHp9lCAw3bf/KsWsXSo130M9XvN/8RyirzjYYvmD8bCkhqlyI/XUEi6PBac7zXFXGzi7MU+Ojz3KY6qjvwW5fjNnUPwb7te6FlZz1UbNrsCAKUZ1rLP/6jH7jGfu/3ZyC7vApiJ1qgq+mASsUZpjoKa8NH1i5WkU/ah8S94vrGNnF7ynQigx4IQKAjGIpXlAKsKLVq91DwSYc9aR9utLsDWnbWKxDifHxBhOBb9dR2RyZAY6Kxqbzt8QRsra2E1v7Lqh5a+/Vala6wluYHFGgr55V3z6no2tzZa/1XtXCM4hWlrneo46I+qS2xbVL/m04AACiqKFD3djTsVl2LnnNDDhBynVHwtV+KwaMP58F7vz+jrmE9iCAMPdURSUhFOXovnez04QuOvdWxSMQBIJ4aMG3oDiTSegbp6T1viH0y6sFoeH64FVevVHlI/KgXRm66AKJAl3jge9LYxqDGlZrJvJXEaz0pUqLeTeCToppNuu86eMzRgsGoT1fK44Mj8OjDzsDRfinmcDiacnGxMtAVdTwrdVlwcbL8mUb3Z5lcYFMaQSPpzs6ZztThPf6tiK2ibYn2pXRtIASh175x8YpSRyT0s6/NgRmk4R20tuTg82rTUMDlDvZA2be+qQClIw48kx7zqjeoQwyhLe9/mPBjdH76ZOPSRa4Ix8FEQY1FO69pvLxUxwfSd/5uufp/59X/d0RKSRG0drVthks86nY1/IASm9v8dEtQkHmBj+v16Lb18NUn97h2S3IHe9TvH92Y43DSzMIcRwTECIrvfHRjjnZ9QN8J/JcRUEFBPjjyAp8vPro7YLS7A97+5Wtim8Gr0W5qluOKWHJGjIS6+3c60d4ugk+i2IkW15Es0/Nc777/MgI9ZsR3Alrhsudug82ZQQoiPwdeEYRex+O9PNOLEHw0kqQjYvWdCqu2T7pAzRvEUlbBvhxvo3Sc/z9Rl/h5AF1U4O9jMMex6PPStZiCTcKPD46I+4jpShX8YKVUm+h2HPwQjXzSXjg/DYTy4QkaBDLfYhsX2jdeaZjuL+O76QI0P3zrtf/LS5xUnRV1rfuUwHcKxoHGB0ccSkvVY7sOHgs8hs2esx/w2WQBVGQQ8FOZ2149IjpcdnFWyuDT1cvpJPpRlulzCd1nBKE1PzuSCALA0e4O34a3GZemSd0nndNB1IOxPqLKDsonlVsaQzoo67eW0/E51R8c2dDMn2dLA6XLSfx8NuB3oean7r4VwFMR8LHdv7KKgOMDA5OeU1Tk+fy8gq+o/w92nHe8Nz4wAIVVSwAA4Er04ykXkvLuR4bpGjcoD7d6bi/b29g2w0uJOJifQelz0vgSKIMImVmYedNrx418pcswOllsHTEVZwsyt862lKd0BgETj3zOwY7zkFlUNNmGKftudfLG2T9bM1e47MHJAdl7NsbHKIjM+KEr0Y/hSvRjl2Begqei7FSBzA2kA4ONs3NexgcGrCKy9JwfuUwOJQWuyXozk6T5ccWLdQqeDq8PMh+f1wRAncf6BZoOMDbjBwWgCdQ2hMGj539OBAagjkeanaQ56BgZOsZ0Ee12rFdMhtLdm1fwFYehaV0a1HG4fLTm9SIsSfD5zKKiQODCdz3nu2lfKUJ6RU8rPm5GOSqXWANKjNmEclOUs40EtzrCUj5cKcLSIaTFFV7nAMb5TAsu+lzQGksC63QthLgTeIE4tPzffuFKwVgPYvg0CSkZTnoOx8TxpmP1GDSiSHWrV30jRVUO2iAyey0sEOQ29XmqadxvgKEYEgFoShn8Hl1ABAVlYdUSR1Twu9KeqhrSy4heoJT4t10gpMspOe9+ABmkpWJTG0o6yJCEpB7FV6hSJDMpCgvSwmUPOqKpTX1AmdbNkUpdqVtBBy3Qp3IF7Vcm3prioEvV2XkZZDMOzazIj2MVLDHFFyXU4H6byV5gSuUdXW02VaAw1aFB5EyXvkxtKdSLrizAebyiWTpbWxnxi5OfWM66rwwAAD4dH1XXej+Iw/252TDrvuTvD5ROHncfuXjJMdj9udniJFeHk+Pdm5k8gJldkvx3qMu7dsB3KJ9IcwsmeZHuAwDkLSlT/4+d73Hc+3Q8OfZENKodW3dv1n1fkHFGxedw/KCEstO5AADm5U9+jB5u63Dw++l43GEP+uznV5N2uPbJsGM8vP7p+GyYiEYhflHP09yCAscclPIrihw80Xc4NtAWob/f82YCAWJD0kAovG4SpNLVk5viCD6T8SnpnuNzclnofZ2c0tg6nu7PzXbJ5Ydn0/M6vqmObQjnNb2j06eXLqhD2+BmIhp1vMMpVP3jlxN+FOtHMfisaVxbAOqUJynNxlheRtKNKQHaa/4gMpoch8vvh1JxeASSn4ClAzTOGVr6L88mbBih91JRQLqVYwvAiWjUEYHDbR2BeNfNlUq0u9VEA0PekjIxQHg5UqpOjvdUBEyH4m0VbRNd0NOCGtarHjUpx+vdqQBDqnOYnBdrMyx7OABN+k638/DInmESxk/INRX7vFbjQuLvkuF1XuilGORZBya/400VpQJqKptUQk1EozC3oACGugYgv6LIsUjIW1IGeUvKXPNzPeA7V4Ym1PgUF3hfWlRyHElyh6p//HIiSI0ylZ5uI5SfGmqqotftkkr9RjC6MKB6kbKZzSLOq241LVwzbApxP2DUgccGAMjolaEJxzWbtDmdxI2uW/XZrp6DrtRtxsuvKAJg7RLTO+lwXElujM6uGhBBMB0Rw6v2orULT+upGHcq5KD9N3Qok079rsp17RNd2TSddjUtZDK4YKg8VKBNszho/4sr/erwqFXIp8/fKoXpalGpLxY73wOx8/4cQbcYUkBm9ZtXG4zrMV2LGz+9RelZbv9Q1ZPPJ64OD4sDPrgquWXz5+PniWC5PgrsYY9IketLGXQ8v++mf/GQ5CWn7CHXvWvxMXXfi09JRw+uWgLDH0Zhzvws13iSfSZGrjmewzmld2z1prMdfx95xPlNlPtXSfANfzgJ1FDVk88n/DDCFe41KWd0bs4cFxM2wnspzo8i0gU+ypvX/PQdqkOvZ7n8dJ6Rno+s9HR1eNhzTi+90nckWWzsKtFfAFHf3psKPTSxAAAAAElFTkSuQmCC","floorW":160,"floorH":66,"floorFill":"#315f82","floorRow":0,"cs":["data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACEAAAAOCAYAAAChHnWMAAABJ0lEQVR42mNkoABsf/r7PwMDAwMfGyNczFqUhZFUcxjJdcCfv3//45JjYWYmyVwmajuAgYGB4ejrP/9pFhKELGdgYGA4+Q6h5PjDPwwlJhyMNAkJagNGQr5Fjl9sIbH7xT+UhIkMdt34xcDAwMBQa8WON80wEhPcLMzMjLjk8DnCXIiRqITLQkx8o8shxzsuBxBKW7tf/GPwlGZlZGBgYGCsP/ztP3pwXfsCseTzLwaGBx//wcWFOBmJslyJF0JfeIvqL2keiB5RdoTc2qNfESGBDD7/YsBqMbHgwtv/DAbChPW9+/4fER27X/wjyZIT937jlbdQYsUIBQYGBobLr//hzh31h7/9p3e2fPocEtxzwgQYUcKMXo5ptOXCnjtgkimrPtA9VADaSno7pU9OkQAAAABJRU5ErkJggg==","data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACEAAAAMCAYAAADs1tSHAAABD0lEQVR42mNkIBP8+fv3Py45FmZmRlLMYqK2A8gBjLRwwMr7f+HsaBU2RqqGBDEO2P3iH4MQJyODECfx/mMhZBEsfnE5YPeLf1gN5mNjZOBDCgRk/ehphpFcR5x8h+qmT7/+oziAgYGB4fjDPwwMDAwMBYaseBMuI6mJDd1yfI5gYGBg4GVDqNHiYUQxx1qUhRHuCEIOwBbkMIuQLcfmCELAWpSFkaX+8Lf/r39DDBJlZYT7FJvhuHyODpR4Eex7n/E7ov7wt/8sDAwMDPue/GN4/uEfXsXakswo/LVHv+JUu5aBgUFDiYOokHj6/BcDU6MtF8llBT4HkArmhAkwojggZdUHqpaExDiAgYGBAQCQYHSxC/ioiAAAAABJRU5ErkJggg==","data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACIAAAAOCAYAAABKKc6PAAABSUlEQVR42q1UPU7DMBh9JiZqkYoQE1G2TkicgZGBC3ACBm5RsXMEVhakzAyMVSUGBgZgZIuKVIEQaRvUxHGH4sixncRu+6QojvL5ez/+ARwxGM55zpj2XN7/cGwA4lKcM1ZL9vhZAADOw12yjpCdbYioq3eZQ5pIqeeRJiEiBRVnR7o/uZdVIjKhzVLY4iHOGtOhbaQuSZhq9n1i7DXJOIIOJZWlsSGTG5rQ763eL1/1xsWSTaRwhBjrzfq72Oh0lgJkEXevOW6e/zgAEJHG+3RVEE/bCdXNKNL7TqtzD7t6inKywlw0moFeRQkAIAx89Lp6QCeBV46fPrJ/QqrVmUij0Qxh4Jffav8kLcynJkmLyk8AeBszbAOyCBNPaUO9ooWTeLwAABz3O0YnthB9VNxeHBCnK34wnHPVlS2uT/daeaiLq3WSsMUS5aW9EKqjBJMAAAAASUVORK5CYII="],"cb":["data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAE8AAAAdCAYAAADrcjF6AAAEJ0lEQVR42u2YTWsTQRjHn9kk26Y0JkQChgqmQUoRUjwIrUoPCvYLCO3Bk9CP4FVK8epBPBc89WChZ7EFeyi1LYhKhVBqiS1YUgiGvJmkmzTjYZ3N7GRmdza7fbM+EEg2uzPP/Ob/vMwiuADWPD7Gdvf4fT502n4p/wI4J/d5aeiiQ2PtxccjAACYHe9Dlw5eN9CWD1sAAPDomnKqoaxcZHDpCoZ0BcNAP5/RWq6JL4XynIDLNfRbc3qEwi0OvM18e7j7MT/6D0/SaHAnCdDv5WAvP9UNr8s1PQ+FgnpmeHanF50VuHMdtrKL38zjDgV0C46GNBpFlvCWtjXju5dVWHELzeni6SQ+v6t5KhMZ1c2sVvGZK88pNLKwkNq+9i2nh/bUoM8RmGQITAWDtrJm/l1i9mcj0zDUR9JMPNLW0JObKjpReE7A2amBhNzyYaujTxNBtwPGWknDcOUvk5KGufPQlTzeK1dczv3xzA4c/X9INX+sFGjVAm0V5fpDdFrhKlKc6F4rYLEecdgSW9zS5TiWDJiuW6kuXen0dSQsVqFj5b360nAFbjSKuODo/0KqHoqicMwd6R+re7ywgwruvs/L1nX5xgLIBI7dIdLhy+Y3L8KVhka+0y0JXSBY9XWreKmwnd/VsF0FTFew4TSdkJ2CS1cw93jFbhBPBfma+dpOtml8H4qbdRENIuOZVEwxQQ+p4vFXPlcBAGBuMoIslUfy2dsfx7bUSZtBnHKjNhFAei67eWhwovaHvH2RURm7MdMLBcwCRE4LAalItH34aXYqEVYchygb8iUNdyyA3qyNDD/3Pr/XYzn+XtF6I+g5H15XOgoTXUCQE3B0KJGKR8ClYopxjeRIu56Nl+zpliJfw5AttDeGnJdF9nhE7XjLQnwmc+0VW7CTbRpnbtbiEQWmBn3cygsA8Pp9xQhj//RCATtRBFk4qXaJsNIh/1wDGwBZ562aWrYXiwYRZAv20ERpgOd7KqbATlY8ZrnWAhj0wa1+xPX96YN+eLOiA/QPJ3sdnQjoHSTyL2kAt6+a1UbyZiqmWLYTe8UWN3+JlGGCEVSMo1UibJ6Ht46yJldNedBYm14oYIXeAZmDdUnDhkLoCvv1F//Zpe9N7vX1/Sas7zdt55NRXSIs367K9IVs/0j7ub7fBCI4NLNaxXQfxLYc5MG7N/wdfdTEsCo89pDES+cst5BENjGsclOLVf8n1WcK1F+uteAgq+kF491BAy+u/YaBuMp9UGZhY8mAUQHHkgHH8LyAyFuw1+NtZ+owEFdhdrwPITqG3cBjbSjuN3ovmfzl5YK9gkX7EQoqsJ2pmxpmJEqGosFpwF2dF7POQsjtfF77RzfKyKqaWD0o+0aWfu09s1rFTuHNTUYQOxdRx0ko1Mo/4QnDjVkplXcm9HoON+bGvz99BHJs4N4uigAAAABJRU5ErkJggg==","data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFUAAAAdCAYAAADb/iBbAAAD+ElEQVR42u2Yz0sbQRTH3242qxFjJSXQkENboSK2lQqF/sJjhZ6F9tCrf4CHXot491A89x9Q6FnMVYoKQoulRSpoPYQ9hIaYFRM3m50e1kkmk5nZmd0lrtB30WSz82Y+833febsaJCxW95tIdP3D02ENEh6JmaDbbiPZ3xqpVKLB6kmAqQIU37NZbqH/So2gTByVK47f//p/f1rtRFqDdtOAVi79z7YDsHPqwtJsOnHWoN0EoAAAv857b7MdgGc5LZF+awwy2fL2BQqjTlawgOIc2Yx+rVZw7QeVbOSH4MbEQHbTaroIACCfDp+u0kIdP8UxPeqPt1ftKnrn1FU+vOjeOKrKBwJ1s9xCT277qcKC3asiyJrsa7bT+1kWrMjfo3izsqeKfHFlbkQ4kcolQOUSdRQmC5NnAVi5NOz5B91l/ah4oQ5Lt91GYcEq3RQ0mb0qgrqD4E2xV45fK3751x0ERQIoDy4Jko6JLFvtdHdAA/1t+er9+HJIeTNf5Q0lTnpcQOlyJ/+vO/3tEF2yeCEioLL2wRp/smBIA6UDiyJWpaoAJaGQMMfM6PbNaqNor8Uw/5z1l/27+ynlNZAhq1iupx6cuah05CofJmSMmRq3n1Qte9F12+n6Kj6kCuPq3aIoP11tyuWv+tQjU7ZhlSiKuoM6iy0duRAkgvWTdugNpW1NuvxFMPFBwOoN44KkssDSocP8PpvR4f0jo89/10/aYNU8WJpNd8bH6p4e1QJz4s3bPW4FdjlG1GfyuCCS99YdFMqDRQfR47wOVs2DT99a8OKuwe15WYH9OZeRm5MmAkqqk/VCQwWojPpYvoXh8pQp0yaRc8cWgXtZ2wmGiQNDfX1HFz4saMvbF4g3KRYIOlHUE1UEdfe4BdmMvwC70Zt3fsrsK2FSBKT6WT3slwOnZxxekOPz1oU3HNuCsTBjhgIQB0QRzE5FNLzAnpRsrWynm5ucA13u2YwOdsOD0qETCDZobfNTZk8laZvlFpLxL9pXqg1/YKvm9T0aikpK9sCRicmCn/PeLb0PHmsOWdNXKKn+5xNprn/juS3MmIFrwnnXts67LRXZntCBez/SqHMZDXIZDR4WUvCwkILrDPIFCvZM1kGESz5I/fRm4/uCKmZt69xX6uJGDU1NDLN/eJUc7yy5u7wojmqB/aLMomSDnJtMPqxuOvC7gTD5yPHLltPtU1f3m+jwuOmDKZg9P8LQeZBlJhAnSFWoceTHHkznpJmtzI1oHaiLG7XAk6VYMAcCahCKDTu23fCgbLHt4PPbcU3p1R8POqnqqMGbrEpOEVwVqDJzwRBDv/rjDZC0sBseF56sVUTlERsoGfsY1IZFmUsc8/kHZZ1T/ZFLUTcAAAAASUVORK5CYII="],"cloudAlpha":1},"lava":{"far":"data:image/png;base64,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","farW":160,"farH":52,"farFill":"#782957","near":"data:image/png;base64,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","nearW":160,"nearH":68,"nearFill":"#140c1c","floor":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAKAAAABDCAYAAAAbHw4BAAAVDUlEQVR42u1db2hcV3Y/Yz15xtG/Gf2xtVlZ9uCN4j9sa9FIK3fbNEtLvSaU/dBgagoJ23YhKQWDPxRMS7ZeCoZ8MIimNLAtJvniYtLCfkhUf0hLG4NVpUVOtnWySoMc2Ulk2fPPI61H0ojph9F5c95559x735sZb3D2gsCaee/ec8/5nXN+57z75AQ8hDHYPVLTvru3ejsBvxxf2ZF4GMD7x99/Qfz+D/7p9V8C0dFZH1X9JH5R4JNA+FUFIgWdpK9H2VETvwiF0rF06wEAAPz53OWvJABddbV068EjqaNEuxTKlYlAMw1U8FclGpqyBNXX6N5dIUd9VPSTaKcyUWlL5TKM9vSElVwuN5RMvl8ql+HVD2ceWSC6Ak/S12hPzyPlqAlXZfHNSmSZKvTqjRVxvo9zX/j/7vdSMNCXCYGQAlbz+C8jWacyZbuGAQDgvTv/JepLclQc87eXQnOPj4yKjszBiDr4snQeuBynHp+Cv1l405cv4XLjK5Mn1Q1rEU8DXqFaAQCAjJcKATBXKsD4yKgaKd9amgcAgJeOPG3c9B/964WEixO1Q8GvTJ6Ev/vf/whcs7i2DBrPcwFfvlqBJwa+JmYLG42htovi0NmuYd95mq3iqQzzt5fg0uez5gg42D1Sy3YNw/nvHldTwujeXaICKfhypUJAiQvEEGPbEQIVS69Fj7et5WoEAIDJ/oMAAHB3vRgARKsGN7SkKzqu3lgJAQnBl992Uj4oCAPzs3nQBhpQl8plmLuzCHP5jwLRmo9m9PTK5MkAd+VcFofHb5zY81TNZWEJDKjAgb5MCFALypwf576Afi+lzsUjosYnJQfg4GvXMIFPAp40pMj3MMdQMu3/u11OKnLAv5r4QQ0AfNKP3mBLc67Kmy3ddNo0AMCBVFq9lqZqUxRYKpf9dH9l5Tr82aETxmjxzs2FwO+SM9AojuPKynU/ndoiM0ZADXzUWT+pFH0QUB1ltuXSoqBJL7zYwwgIADC5J2u8Z7SnJ2Df8ZFRlaPGAuBg90iNG4lyNm4Qztm0cenzWTW0a+E92zUMU337RfBJa2mpCgDgt/ePhdKfSwqPku4RvCbQcr3hPrjs/V7K6Kw4nh0dN+rdRUfIwxF8powSZ7joBfURACBXTqFa8YsFTZES8HBQYGubfPP/PgAAgLn8Rz5gOQi1NfPVSqCo4cMFGM2MfLUSew0qO+6dZwSaEumQnDQKACkIadZxDS42HeCaLrpJDHaP1I7vPqoKmFEmoZPjgpTn0QJGIp988Mpxqm+/GCUkA2rDlNI1w9iUJt3nCkJ+75WV64HoTwF4IuXBTKUqglGiLprRTRGQ2rcZR2qKA07seao2JqRKBBPnINp1dLx9dj+8P/+kUxFD+QSmIJ6eJQdBRXKu5ApGqji+V2m/mA24AXF9qkN6rWR0HtH42idS9dpQAqA0B7cRBRNyyjj3Uh1R+akuJQBK+pT0WqhWYIet2kFhJaDxzxbXluHts+7p4Z2bC/4G8tWKygtxncJ21CsI0Q/llIzLDRHXazmI6FpcLi0628AXp2rFeXF9CXQuQJYcVNL1J5Wi/6Pt3zS3sQ0jAYuCEDfOJ0fwYOTDiu83Du8OzX/x3feNYZymI+4AvF2ggVAyKl9nIUKroTF3FEM2ZKA9NxPgzg53AgDA5WIXHEiFZabRNeMNB/aBa0z2HwxV0xKApe/yimNrMlPA4fq0mxJeIx241jMZggqpAc+WKq/eWBFB6OrdfF0pfUifAQC8cawx5+n3UiLwhpJpyHgpX5E2oJl6ZyZQUuBJdKZQrWzLuwkfLnYG+GWecTbOzzH9j3UNQ6FasTaYUQ4qP+qEUgnkqNmuYWs0o9nL1HfFeVA2/5kcFzZqWpjLfwTHdx+F7//mrxp7Xth/osSZbtgWIaIOCYQ8pXBuxwHdirSZsZD86YmGTOfmzXNjdNOAHHXQ/bukTVda4DI8G2JNSqSbnew/qG4eWzDv3FywGiKO8Uzj9HsNA09PVOD0eyl1Ppra6F5cFduMnBj1Lhe7rFWnqTPhUgW3GkS2os00drhOLk1GP6f5X2ruju7d5UdHk2IwJdL1rqxcD7Qs4ng7Rr/piQq8OLgFLw5uOe3ZFVTNgG96ogKHspsh8GktH61lkq9W/J8xWHVev99LwZRXJQ6YEn+izHcglfZlpT+RARhlYRMIm6k4aTWsVcFRQHgouwmHspuBtBdHBwdSaf8nak+QX6ulXVMEKzTZg4uyV0pPeAdAu8fFCTwEzqnHp0I8wwY+HmalR3q074dPPUxC1zcXbEgfeHwKBvoy8NbSvFpwRAEhBR6m5aiGadVTln4vBefmU0bgmZ64mFKd1sjnn+erFZiVGyJChT7k/35+eTMgQ5wmvgcAIfBJCpcq5aFk2om4uh6jwmpKAzJ9Djpbugl314t+KyJKZOUgbMXjNGwezzpGpfr6lUDkMz3C0prC0me2wCHNfzK9BgAAr93rMBRzmwHOSp/WYFbCbFCfLwELxbD8FEueFDaPphMBQegNz46OAwCEopEJbNIRKVMrR2rbXL2xEnhWPUYa1HxMedVtMHhOnPCH40Vr5WmLjDMVbI14TtWutJ6LI2hpl1fyuHc8lAFQf+qk7fVyscsHIV/r9TNpqEF9/sS1YqBNdCLlwRule342+qRShAOptD/fyfSaEUteFGWf/+5xHwx4XIs+w331w5nGEaUbwrm8PVm/DSMNbAVdfPf9QMECEDzKzyPzWNdwbMM1gFgM9QtdohHlg6bvo7RZbM9vbd/RPuHa7Rvkm27juvUiqPFcn1McDj6b/NeLNT8g0GBAcZQY7B6pYQrmp2BoesXDBVI0w7OEk/0HfUPgXPz8GgLQlOL5aQ+amrRnuC58FT1WiowUIAhCBB+PGqZDEtL44XixbeBzic6urZnpiQpcmq+nVbT7zDNpqB1LiwBEgAEAvFG6Z7TFwtoyvHTk6cDxuKs3VoJVcD97UBwlbUpKk+aQSvp2VHPSusjTolaoLsSet0GkESfNx9ENp0YmmTRbSdFPG7NVz89C9Jk0/khUCR9U7DB5Dm7kpSNPN45W9fT4P7lSwedlx3cfhTPf+RZ879iT8L1jT8KZ73wL7q4X/ReJNKXyjSPHtBm/wA4vNAtimnql9gyNYlI/ztbwbZZjNgtC5Pc2OU+NV+FEyoMTKQ+e7xsMRD4t+vnzq89/gyfsEXy5UgF2aM8LceP0xqVy2W+l0GNUC2vLPsqXbj3wwYq5/q2leciVCiqPc41I/du0oGA5ZKmNo+mEsTB5/lr9RwIcfqY1VKU0l6/aCxztlI5rVUv7crw/J0UeLNDoOvw+Pjjv4+DDxv6Lg1s+aDVHoI9o89VKIwLyMG06KULBRxV49cYKLJXLsFQu+wvRAkEynLZ5PO5Dj2vlDUec8EcDoe3JB6UHz18Dn/fkq8E+Ia8UJScxdf418MVxKKq3l448Lb7HQ4PDbLXBf7kjv312vw+0o+kEHE3XX5i8NO8ZwXdqvOo39g9lN1W7Ii54UektClWktHFbK0XaPD12xZWNhQ5GSTp+cq3g1GjFvmFWkJ/e0++l4LK/vHuqdn2OqvXvTqbX4Nx8OtLRfa2iNXUmaOuLUpi3luYDNEU7jUP5Ho12CEIT+OjgYKVFJT/ijwWlZ9okgoqDL6/wNvpCj0vvj7ZaaGge6Mv47yfM3Vn0Wy397NRGtmsYnh0d9/uGZ//liv9KIT1gwYsrF16VuFaE6QkQn5KEHjH5eq9/vgDdfqTEJ0ocpNQh4xwgpY6LrzzQ12J59glGzHTgs5ln0gDXigDQ6Tejaca4XqyFwIjg+3CxU+SDkkPkSoUQdnZopNHfmAAk6dQrXmd76iGtpR3dch245lAyLZ4RlKKvadAjXFJBwj3fJaoVSBSMAjhOMVxoEY02qBN+dpHOxwsMG4/W9r8A3bBAeo22l6cW1pajNaK1kSsVYKAvYwSSpLwL//af4nupWuOZv4hE0/7Fd9/3I9tk/0GxFYHpRwKgiSNSECLPMYOw0S/DE871UY+K55t855vTFqQ6/HVLmm7xO05ZLuwbCqXZeqESjHjnlzfZXvRqWKJFGqXxpFBdB0w4MuVKBch4KVhYWw49g0UQmgBEwTiUTKvg44XBXD7clR/rGvbfP9VeGOJRqKHATgAIAo4SaDqwGHEd2C/T5gMAeCPb4FpaM5dzKEpPpBe6eLMfHZA+OuWc7+56Ec58ehcu7BsS0yyNejPL4apYAh++WDaUTPuF5OSebOhvA6F8XpQox8On6Rr+1IJu3nZ4IVcqhE5uaO8mmF4CMr3PYAJIM4M+NTANXP8QTe2QDhD5mUpVfG+X0iJbocT7sJQbo14QSBRQFJDXizXIeCl47V4jU3Dw1Z3nXmgNKgMNdEPJNMzlPwoDEIEz1bffvxEFRWXQyirbNQyzpZuB93ibOaokvRBNwzmCCiMwRmSeArA5Tsdr94hs8wAv/ym0bdSOpa0g1BrBGGEWiumQbjTAcR2gsaV3PehfJZu7swgzlWroEeWUVxWjIgfeuc//x7cRxwmNiBIVy3YNB98LplHH9m6pxOukVM6Pa2kRkFa5lOu5vKOA68b5Kwm41utnwoCJmn6jpGjToAWByxH9OE192xwuT5akDCP9MYDZ0s3Qe9OhBoIUBW2Dg0l72YcSUxOg8hHfKW3leOFCMVD9PuxB2z3BpyDNZ5VWA1jqH7oECNEhf2fkt2oAALn1UujLA4+Fz+UVtxrHldMdyUaU/HmwYBlI9sGXZVA5XxhoFB/TK9UvjYyof9Q51XPcudAO/Pd26ZBeI+1BwphahPxa714AAPjv+7fE7/lG8HcUggOyWXBKwseZ5/Vch6+Yv31qmz8tefCT0mN1pVXXReNL+5LWx+tcAYTX59jn+5O96j031++LukF5BpJ9ATCkH9sdWR7/dy8ZWnOamPb0bg/GRusg/Iv5GJTkuX2/W9MUZkN0FLBowKFrmOanc/LIjPeh0dBpTADFdf/6B0n4yx+vB7yaglRzKBqpKFiK1XWrAY2peLcXii7cDpK+UAZcx2Y7LXtputXAjuPVF3vh43/+eUCHNrumO5JmAGpAkgxLjSApm8/FI2acqKEZWVOSS+qLKovN4WwycODQQSM0NairjC66bSazUD3zAPHCwJYvc3FrXbRJAIBSysQ0bIoqGr/gG6NzYZSIynMkr46a8lrBzySjcgVrTpBbLwXmQb3Tz3De3HoJLp3eC6emb8GP9g4EIosU/SQg23i6FhgkHXA8RKFAWo0RKkIo94sSQWwAbEVhwgFIFYpyUwNIIKARxxW8rkZy4YASAJuJvlHk09Kyy/2tKGSk4VESPJDsU4sO04a1goV6mMmzXMALAACGjdt4H091ufVSiPhz8o4Gsskuyag54ECyz6mQaUdEjzMn6m1/sjdgX1NkNVXzPFWHOKCphJfSEC6OijRxmlbzKRpNmo0atkqer61F42ayhmbUqBHHVLBpoJRkci1CNZshbQAAePlWTnT2xOH+w7XMzm7rpgob9bNu2rX4vXZN7/Zm7luA0ks2/emDnDjXyM76Hzv66WrwwMM3uxtv4N3eKDutgeuYZHfVjXa/SXf0XrxG+sw2UCf3tzbg0wc52LdrwKLnnQFd4Zqow5+ufuGv6yoPv45e+6Nfqf+++JkHF74o2vuAUUccw0nCF9hhT8m4CC66Zm9H0lc+/w7n4EahRoiiVOkeE/gzO7t9gJgcg8+rOZok6/2tDcv36wHHk2TkYES99u5Kis4aBRMvfwBw7g974OIHZTjztXSjD/jt4claM4AxKQYV6BKVbJ5tu5dGWBpxTACiMrvs52ENU4R2lYtnnMLGasABMbvQtaTs1Kv0IPm1XH98LU23ib8/8uu1i7mq88IuadQlRdHPpHSB0QmBRxXa25EMpZAojmIyps0grtShFSA2OYWkgziyu97D8UCvdc0S9FqMgolvD0/Wvj9Qz8TZr1fh5Q/MCo2jVBv/c1ECXiPxG5MyXGWVImhUTqs51f02VLSaTm1c3ZXfSzaxcWdTFKRyUtk9AAA/AubqZHHxMw8AtvzPtdQaJ6VqKdo2FwWGxPNMyo1jDFtRgbyIGq8dKVuTp5EJgpFQAxVNwbS4kzheZme3mDbpdZJu6Py2IkgtQmrfrBNFAACMjAGQOgKPglSLAHwerZrkXNLkpXzjVJGmNIL/duWNfE+mudtd3N3f2rCuR/Wyb9eAej1+pxUypgBCdUi5J98HnSdxuP9wrRV8hQsTJbpJ1Z5JFg4QrEA5D+IANKVuPrdrS6eZ4sJG6KPYw6RvXpTRSBWlPdRMBJe6EgAAiSfS3/AB2NfZuKi7I/gG1OqW2zsUpc3V0Fz0c/7d8M6u7fk3jGtxeT6rFEJr0Os+q8j/19nXUxnjfqickry2feMa3dtpcXVrw1+L7mF1a9P/3UW3kj0kWbnMqF8AgOWNNWfg8LklHeDcyxtrqn1tcyeeGZ6oUaNSI7kCkCsHlU83bBKwtLkaWJODR9sQXVcDnMk4rQSgaVAQoKNFdWhuE3p/XJm5Q2jBwxWQro5DvwsAkEcXk0CmjcQ1DgUs/RwA4Gdrd+CPdzceSb1Z2LICsBngRIlOzRoiSiSi++JzakaOs26UACFFXLQlXZ8Hpu6OzkYK5gs06/UcvK5gljYhjecyHbB3T/0Q6Y8/7rR6cByQtBKArlQhiuwutMQUubo7OkWqEMcpTPJLMuBniaeGjtZsfEYyhOaZmnA8haDio/IrPt+f/N5OuP3vjRdr/mGlFJKDO0Hc9OziGDYuJKVjDkRXEEZNvZJsLlmEyvyztTux+THFAOIp8UT6GzWb12gLaSmAp/C4Bo8znst0wJuFLSuH0jhjK9K2yblcOF07BoIIAdRqvUcFIOpIjIAmj5HSnJQKNINqUcTkiVoEi6LEZu5thnrY5LBV5c2u10760AoeawRgHB7wZNeepjzNJCwnw1QJJrLNU4jkPFEAoK3lWjBoa2kFmWlvD8ux2jUSzwxP1FrdE2vWc2kqk1pCnDibgOnKJVuRCiXubJpX44O2tphNRk23WpaR6JILLYsbxWlKdk7BUYm6Voq3g3C7OAqXywQWl75Yq3p4vN0kEf0o+jfpWmulxC0kuskzaJ5ZTGmb6tUpBdtK+aieiWlaSjcuHteudEOVpD21iOvpD7Pg0Dh3nIDCC5ioe+FRl9p+eWMN/h/Q3bzNalhFZQAAAABJRU5ErkJggg==","floorW":160,"floorH":67,"floorFill":"#341530","floorRow":0,"sun":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABYAAAAWCAYAAADEtGw7AAABxUlEQVR42rWVv2rCUBTGvxtCKg6lhDyCg4oglG6dxCUOhQw+hJOFzo7OBTvlIRyEDrpIp26lIBR18BFCEIeiIp4unnjv7Y2mLT0QkpuE3/nOn3sucMZo0Cqa7n8yCean3FOdiBNQXwThqF3xyPS91202RBCOaNAqiiCcZwLToOXfd/pDAOje3Rgdd57fAABPH5EwwUUatF4qo1bIw9EEbyMBxyNsI4GXxSfGs6kRbpugrNIxZIHfOR6hhjyAMoApiSBU4HYaNAnpSg2KlpQoB4BawQy3uLoiCEe6MoaKS/t4Hd45HiXqq25OLvgcACz20K54JKdAhioRSHDZ6qUy7jv9IbeiJYJwzoufmKzcda1ENbegpadBLxitdqDVTlmf2VS+CML5N8XbSGAbCWwWwGZxwsGSkn+VSLIovigYFC1JKXAc7xHH+2yKueK0JAXEz3rLAcAkXquKedHrNhu8TfXwdAemFOg70Jb7uF3xjmHFgOtamTqE1fLgUmaF3M8Pt9cA0sFyTifxGuPZNJl2xiEkw+ulMqpuDq5rKSBdqQmaNt0SOACwet0eX9+VuZx1Hhe5W3gu63YolG+C/tux9BsnmQ/ULyoEYRPlam0+AAAAAElFTkSuQmCC","sunW":22,"sunH":22,"sunFill":"#ffb068","cs":["data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACMAAAALCAYAAAD1JjQCAAABHElEQVR42mNkIBH8PbfzPzHqmI3cGUk1m5Fch7w9egOnOmFrDbIcRJZj8DkE2UG3lp5hYGBgYFCLNiHKYYykRsnXaw8YGBgYGH68/0HQQW8ffIE7hpgoZCTkiK/XHsAtfvvgC4OwAg9RoQhzCEaIKfAwnNr7lMFnQxeG3SyEHMLAwMDAIcgBEcBhATJ4eO4tAwMDAwOPEDteddeLW+H2aPZWM8JDBl/ChDuEgYHh5t6nDPJGwjgtOLX3KZytrMxPUk7S7K1mZGRgYGB4NXnif2J9DAPIPr979yNeveJIHsIFlp66ycCyJaDsPwMZ4Mu7nwSjghB4iZYJGAu0w7E6xkVVnoEa4MHbT1jF77x7Tzg34XIcLcCEqytR7AcA4mFwIcj9yWMAAAAASUVORK5CYII=","data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACYAAAAMCAYAAAAOCs/+AAABJklEQVR42mNkIBP8PbfzPzHqmI3cGckxn5FaDnp79AYKX9hagyLHke0wdIdgA5Q4jpEaoUMInNr7lIGBgYHBs86Z6GhmobWj3j74wqCszE+dNIbsqK/XHsDFf7z/QbKjMKJXgQdFTrO3mhGvw9BDCNlByI56++AL3HBCDvry7icDAwMDA48QO1wOm5hatAlG1DLiCyF08PT8GxSfcwhyoDj64bm3WB3y8v0PeHRicxgy+PLuJ4Pp/CZGxim2Gf/DwjQZhK01cIYStqiBWcDAwMAgbySM4rCXJES5sjI/ilkMDAwMJ++8QiR+YhI1ugEwB7yE5jpyALqZS0/dZFAREoREZYF2ON5S3EVVnoGaYM/th3jlJ1xdyYi3HCPkYErAhKsr8doNALNVnJhN7UvIAAAAAElFTkSuQmCC","data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACUAAAAOCAYAAACo9dX2AAABZUlEQVR42mNkoBD8PbfzPzZxZiN3RnLNZKSFgyh1HCOljnl79AZOdcLWGmQ5jJFcB+FzDDYglpvPSBVHYYseUh2DHmrERCsTJemFEOAQ5GB4++ALw9sHXxi+XntAtPlMtHIQNoDssFtLzzBcL279TzD60B3z9doDhh/vf2BoevvgCyRKFHhwOgCmhmC0Qs1ATnOM2BwDSzccghwMDAwMGA57eO4tAwMDA4O8kTDZjsEFNHurGeGOQo9zbCGEbilySOFzzJd3Pxl4hNgxxO/e/cjAwMDAoKzMjyLGOMU247+zmSxZvsJlGbI8LvASh6f33H7IwMLAwMAwc8clDMl0Dz0GBgYGhr2nHsPFFIT5GBgYGBjEodGK7Ft0H6M7COYIcUEOhqWnbmJ1kIuqPCJNFWiHY+QCFSFBgiF15917uEEMDAwMD95+wlAD8wiy3J1373GaOeHqSka8hSc2x1ILTLi6EqfdAH+dop8DuCTNAAAAAElFTkSuQmCC"],"cb":["data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFgAAAAjCAYAAAAQcM02AAAEn0lEQVR42u2aP2gbVxzHvycMFlQ4SAryIEIFlhGuS8CLDIF4qDok0KGFIA8JXpVAoZ4K6eAhQ7OmUEi0GjLEFLpkcKHKkJBANchgEifCEZwwGmJyFg4ynCGtOji/13fv3v3/40vob/I9353efd73/d739+4UJDR+vXh9XMpPmdpV7Z3h+Psn9xQkOJQkgvVzXVJBJ6ZTD7/9cQwAl9dqrs4/2lHZ3+vNrcRCTiVFtar2zjT941L/J63gvzt/jO3U6SemrjWU/wFL4AYFm0TIqSQpN8xYnV9ORLqYSEInwlQuAHRbA1ytVgCcQL7z4oFiB/zOiwfKJwWYFqOwwVJkcpMYHRxL1Xzr5leGc9duP2L/jwJ0IhQcR4hgKRqXzgMAmpvbWJ1fHocN+VQAvz4YxvZbBFAf6qwtnU0DAAZbbz9+FyF6Ux6ulaq8Bg9PU0fSc/KljOU5lE7ut7uh52QlSphO6m1cOo/iwtnQB/Xxbz3MzJwxgaXodzRkcpMmwFFADi1F2Nmuox2VqSydTbPSlqZpvpRh07bbGhiurdSKvvozOjhGJjdpqVbZ8RtuJli5Dq/glajhWrmF9eYWatVzBpW1P8CteoBKA8NbNDfOQgyC++dun7X9dP2C4Zyf7z3zDHkiirRgZ79IyfX6HDY2XqJWPWdSmQhNnP7AybZlvT7H7tfvaI6KtgvaBynnsqx/fD/0oc4WTACu3UYqTrhWDz46OEavdwgAWLoyY3v+0pUZBmNj4yU0dWS5sPmNlcaCqc3vbyhB4d745Tvf1RifiwGglJ9yBGx17WK5EAjqX6/3LZUrg9vc3HaVKgKniCDV2GK5wHIf7QO7vV+9PsdUzAPyC3uxXEClVoQ+1KEPdaSzaYP9i81FhLHnyne86tMlEAARNA+bXjlN2+R0q/tSH+1Sg+g0ZIp2nSJ4p3D3h99ZOzkBv372sy9KvmeDqDAeskyhTvsXssLEDnBzc9tQLK3dfmSCrLhVKuValvSfvjKs3nwHoyge3ELW1BFa7T0slgvI5CbRau+5Bi1CdhPFhbOsDzIbl/ID92hHNSwEYjEQRu7yGryb4CHSDIsquq0B+h0N/Y72YYvUmDoUO3dwtKOyKex2+vIVW1wh27ShSo6PVnuPleoEw69y7fw1X24rMtUGsV68tYkjVXjZEev1Dg2VGkGOCnA5lzW7iJXGQiDrFccWoF+4fKVGbqOUn7Itowk+/V88lgUN3P129wQwqVdWwQR54MHWW5OKxRQiHsuu8QLVqSQm68Z/IkDwZXZOTDVO9zfZtKBw6YH5joidCDIFHVfxiecYvP/SNYA3Qx3T2bRh52w6ovWCKdgOnqgmvo2Ha/dwXuEXJ56Hlg/FIJhLlf/sW3d/NhK4AMDetvKrqvjgYv7xM1XcmnyvcEX1Vgq7DFilsOvPegUEbnIRq/PL469nPw99FL1OPb9ATiO6+7PS/q49/MdQbChWdbUYNAAE7WOCEXYQRFm4LpXdgrcL3hIBJ+/jqG3lwmHkINafnTFaUMlvEqxb36RswTmBtHQRfjuflE+TggYNuOxTgjBefJ7aB3JxDlCUn0Y5xb8reKKnEOAbugAAAABJRU5ErkJggg==","data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFQAAAAlCAYAAADcFc6lAAAE4klEQVR42uWaP2gTURzHf1cPemBoSU7aoZQEkhLUyQ4pCHap4OIiSDuIXa0gKLg5ODjoqiBYFwehg1JwcVBoHCoWmsGC+C+0hYSSocVrsEQ4B42D/s7fvbx/9y9t9EHhknv38u7zvr+/1IAeGvdPzbV15155PW/sxx7NXgN5+d45vYeuQns/4Bq9AJJC/Paxpv384WM57/rQ+JmuvGvfQVentiIl4/rFR3Dt+Ez7v1boj7cvfQCCKJM3bt55BQAAdz88SfSdzW6arm4woWqKChLHjbmTvy/moZ0kVLMbEGVm++DqM9/nJGACAFhpq3eDEmuuOnAOH8uB8+Zz4i9fLTdgoVJNzPT79tO8/8VhJgkziMnGad4ydfZc2oT+MiygpMy9GzBj9aH3T821o8LsljIXKlXp/Cj+NVaTjwKysfYFAABGThyJvA9cK1A6BQC351e8TCMs1FgVOnvpROzmmMr0hwLdWPsCrd3vynnZcbvjOwQbBuqBLz3D+kDdA6i/dQ5ulHebbuDAIgK1urHj+zxRGIJqucFVrOh3i1MjUC03YPvP/WHBvlioF0pFpZ9NBCibJj19+gkmCkM+M5LB1YWZswc8KDw/aedS3nesMrPjNkDMKowdKJaHG7tN77tCJg0ThSHfiRenRkJDnJ4+6juQ5cVNyOcHoVzZ8s2bKo2CU2sp/aSuabMHl3hQknWBWFioVIQi84MIdHr6qE/VbtP1PmOgSWX6fWCnSqO+tVCxVtqCarmhDRRh1pw9n1iCpFNGUBOXNXuXFzelvopuHOewKnaJQqy01eEfqR9FqDl7AAAA8vlBAACt6K6yEPTbNNN4+OKdEmxfWH/JC0gljomzIFEF2XG7I2VxGXPjBRt8Od5o7X4PDJPuSbauqCMWKW0SqZOCEEFd3diBmrPXMcdtut6fU2t5/pD6RVfwwmjquG4Y/zectrzneeqkUC+UikqoRhB18kpL3stWOL6y5uz5DsR585mbAQSpclA5mOLQwCgLNqxLor5T9Dydu7ReF/pVI4ips5WQK1EEhTp5Pp9I+UhNkZe3BoEaNgNYWq/7oBoqkJi+0HSIV66xw6m1YHPzayiguiplfRuFqqPUKHDZZgtCNXWDj5W2vICA/g3TEx5M3GhREah4wc3OpcCptbz1RXkm7ocXiFY3djqgUtOmRUMcAxsqJg8mNW2aB/LAsVDx5cOkLrxcEq9VyXvYhD2qOrebLpwey8LSeh2uHZ9pmzKYUQIFfVanUYG/IVK9bKQy/UKVogJ5kTysX5VlE6bIX6qCDqtIO5fqqEa2my6kMv2+A+E1NXjr0cOhuScLDu/x6n8ZSJp90GueC0DQOmmZwcIMaloy08YNYAUTdh2vw2S+/10t7YwJKx3Wb/IqIJ0R1LdiKmVizVpPsCOD9beOby0OrcvbfQxMPLScPdBhsjyYCGo4bYWGLYLpi/ILlSqcHstKJU43LPI9IrPQCVIqmDgHodI+p8oceYpTJfGq36AgMck3aBlVyKQjyV5W3lFgVGU6EIMoVjd4TBa3hM/TPfHu47q8islQFf2oWt5m2LFcHRXee7wyCLMnv3at0YsgdA/s8cpfP4/7vPn8p/QZXtfJUCWronuoZrZveOtsn29zOqMboFVwgkCLrR+qA/ogj6T/lTE00DjKtH8NJI5flH/7DIuVitAAAAAASUVORK5CYII="],"cloudAlpha":1},"aqua":{"far":"data:image/png;base64,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","farW":160,"farH":38,"farFill":"#144880","near":"data:image/png;base64,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","nearW":160,"nearH":64,"nearFill":"#1b4372","floor":"data:image/png;base64,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","floorW":160,"floorH":81,"floorFill":"#ac7655","floorRow":14}},"cell":{"w":72,"h":65,"ax":32},"coin":{"src":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAOAAAAAcCAYAAAB4fbODAAAJH0lEQVR42u1cUWgTSRj+NwSxtQ8aK2xiFWooXt+uiAhW7UmVPghWKMXm7LMccrYYUXwoVwQfxGKKCiJ9rqZSClXwQWw4cpoDEdE3FYmC2mShNfqgTfEhew/JTGdnZ3Znd2e3V9sBod3G/Xb++b////5/ZgOwNtbG2li2oYh8qLGhSRf53Py3T4qsBxPBDApPJo4dnh9Yy4EZpD3/T77iFDMkCwx91snnZWAGYdAgnyfoua90e4reSxambD4ookDFJ+2WYNF9Oc8Rh8TU3vwF+lzG8Pf0tSn8c3JSlRLdECY9PxaWrCiKMe9tMNux+7tvETsIPISV6tXwtd8v3TSsJfIVGetmh+WHb8rkg+LEKUUHCS46WYTJIp7hgbd0Qv7eEP69/fw6T4vZ2NCks+bJwlkjoBhW7soP/Hu8+xJzPb2QEM1n4vRXfO23P1OWfuMW1y4p8IZeXgoKscN5LmZYlAip4UlLwDMX9uOfC4/iGNQt+Vh4yYu9oM9lIN59CZMjd+UHtJ9fB40NTbrTxTREUQIvebGX+3mp9cvmXxkXc/5pQ5/x6CwR774ETuzrBKNK8noTyXl+ivyz+KQdovtyjtdSBh9YmGGeAekJJS/2gl7WQFnQmICpy49NwCJOa4k50GKShYnBHhMJJ05/hb4bG107C4pWCK+KU13YO0OnoFiqwLlOgJFMTCoJs3cfMK5u9I1/fuIhe57rLMD0Q4BoJATx7uqapq9NYdumrr8FvaxZOqXdmDj9FT5+XMp8lQ+3QalTITU8CWcu7Df5aOr6Wxi9/Ngx8UkfITFwEPn8kvt/RfmgsOSYXtYw2Nmbtww3qHy4zSUhmixphGj3dxAhIJKBJCYLKz2eh8RgjykKjWRirqRF4VG8ujgE2d+9+QI79h6ULndFJL6M+shqrqwRO5yXNidafubvDcGOnZuYPmIlzexIDgBw9uYt0OcyoJc1GL382NJvkO/0nWwXnnNjQ5OObMbjg/76quUzp66/xb6l16sm3BA9OZJ8XH1br0J6nC0xkwMtMHr5Mej1Kuj1qmXniM5CLEwaJ9Efx5E8ebEXjnU1wrGuRrzwbrpd0YixGbxj5yZ49+/fOCM/fVaC6YfzP1Wnkq5PZElPZKvph/PC9ZJTgqM1R/efGMsZiBHafgL7nqFxUqrAaC0z2XUp0XWlTjUlBpaPWvEhdf0t6PUqDgokZpi+gABRhDE1JxY0Lhj9OVEpSmYC2pAiNcoSOWKOF1apU6FYqixl135jltix9yBMP5yEaCQEqV7N0H1daRL0n/vPfcVD3choJFQtFcoM9dIfh+RAC+g2tZHdWiM5qZc1vH4GmTqWwwGbJoPT8oTkhNuhLGi1oJA38MEQ+guP4jgT0fUXSu16vQqJwR5IDPZYsh79jdV5Y3WMWJh3hk4xcToObYXs3QeglzVobmtlZjFRSZa+NlUlPbNBUR3Huhphz+4I7NkdgbXBH8hGe3ZHQC9r8P7FK5P8pAniVq3oZQ30sgYTYzmmrwIALlVo35wYy3HlOCsxWPEhOzOL+cAjN+KDsqCZ+BC2nGRN3yq/nDUYjjUxk7RR1wey6O9fvIJjXY3VXybd3UN/fdVEcp7jyBwHju4yX7yRDxSvcFSODLUbrGBt1UuwIjmp1Fh+RkpflqoR9osawWk+4FGvQkFb5JYyInwIO3VQknyJwR68Ye12kiwsutmCcFgYzW2t8P7FK9eygDRQx/EjXJyfdQRBPtpfZNiXlrfIb7Izs1DQFg1+6oWE1gEl75kPYbuIxCIeK82nhqt1koyJkuSzWzwkZap1QMwVXnZmFjqOH+HikA0YtxjLUZMFjUfa6Uwbez1JJ/WCkdyrCvsNALgivhc+iBLRNgMm+uPVLk9tD87us34Ostjetq26Cdt3sh1nwJGMP7hY4krG6Di0lSFBv/tmPxZe8dDSaRiZdqpKxFemdZOJ4bUpIpS1a/7vxld5tSk5QqIPUSxVmNsEqeFJbpHqWqr0x01RktzMBQD4+HEB14AyHBPhpYYnV5UElUU+K4mYHGjB9vVT4iO/YfmOLMxEf5yL44YPYVFg4ymRHiYpPDkCVcCiSSYGe5gTQhmwua2V6Kh5bxez5vP0WYn4Td42BLtrFvONbH7jkXZqbjNnBBmBekmCiqkwvwiP7knywc38Qm7SLmI+T1qkx/NY7ohG2ER/XGiPBtVszW2toNSpVA0oL+u+e/PF/+wTCZn+BT3QqRLZQ6lTobmtFdsxOdBimJ8XUpD3YXaSLWow1JBhbdTz1IFbGSrChzANiPYpeAbC1z+/5O+/ODRu7HAeivc2cLMgCwe1ob0Qrzpf9rOi/cX0tSkolioQjYSk1jI8OyUn/asBefWTrLqWtA86l8n6OyKB2zcxcDatbcZnZ2aZ9a1V9nPa/bXkQ+1MqBs+hJAB/HwTm3d/+ppIpMnOzMKBo7tMR9fQWVDR52F2tmqGQlFb2dKJnaZYqjjCWCkDnW+VMWj70CdIZJQrJIaypRNnQdaRRV72s/KFoPkQ5qVdkRMsfhX4ZEQjDZadmeUurptIiqMhtUmKsp8+l2HKQlmLE3QNaNxOQRIUPAeW+W+fFHS6iLZXc1srZO8/Z3d8PWAUSxXQ5zKg1KmglzWIqeu5mRCRr+9kO4DDzX9SFfrBB5MjkYdeydMgdpmJJEp6PO/ojXXWaX3WUSV0kh0ADIdqnb4JQWKiYEPOr+9kO4S2n4Crp/5gRl8/3hygM5Ifb0P4iUe/qYAGkqFoD7KgLRrkp5t1ozHQq3I8vyF9R1nQhKUv6SOy+EBjhvyQJm6/LoLU5STZTLp5+wkpMoA2WExdz8X9GeWnH4MnQwvaIiafVzVhtRas9SOvOak7yc/I4oNtBiSZ7zb1uimu7d5ZIxfUy3uAQnPd/Ktpz3MkE5P+lRSsDqSsLLtceKwMRb8k6zb7Wc2HzIIiAd6Nb/rBh7CV3iYNZQdO61unhkWYyEjoxWA74sl2VtTBW03ZT7b9RjIxAzmUOhV0MJ8+cYuLfAWty7nOgumbG3jE8+KbfvBBEWV/kIsZ9PeQBv29knaYfnXggvpe0CDt6cQ/g/RNUcyQzIf2s3W7nBlgpc5rNdhT9F6yMFcDH9bG2lg14z9vIXiuys0tGgAAAABJRU5ErkJggg==","n":8,"cw":28,"ch":28}};
HERO_SPRITES.pilot = ART64.hero.pilot; HERO_SPRITES.ninja = ART64.hero.ninja; HERO_SPRITES.robot = ART64.hero.robot;
var HERO64: any = { pilot: 1, ninja: 1, robot: 1 };
var HERO64_POSES = ["idle", "squash", "up", "fall", "ability", "ko", "blink", "crouch", "apex", "fstart"];
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
    domeT: 0, domeSave: false, kills: 0, shieldT: 0, magnetT: 0, rocketT: 0, invT: 0, freezeT: 0, grabT: 0, grabMob: null, dashT: 0, poundT: 0, wallT: 0, wall: 0, teleFx: 0, stallT: 0, stallH: 0
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
    if (q.y + 3 >= (p.prevY + PH) - 2 && q.y <= feet + reach && overlapsX(p.x + 1, PW - 2, q.x, q.w)) return true;
  }
  return false;
}
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
        if (pf <= q.y + 3 && feet >= q.y && overlapsX(p.x + 1, PW - 2, q.x, q.w)) {
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
  /* stars / plankton / embers */
  if (map === "city" || map === "space" || map === "ice" || (map === "jungle" && m > 500)) {
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
  if (map === "city" || map === "space") {
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
  if (aur > 0) {
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
    var nearTop = nearBase - b64h.nearH;
    var roofY0 = Math.round(-camY);
    /* pushes are capped at "bottom edge = screen bottom", so a layer is carried by the one in front only
       until it rests on the screen edge, then waits there for its own parallax; continuous at every step */
    var yBot = viewY1();
    if (b64h.floor) {
      var floorTop = roofY0 + 3 - b64h.floorRow;
      nearTop = Math.max(nearTop, Math.min(floorTop + stripSolidRow64(b64h, "floor") - b64h.nearH, yBot - b64h.nearH));
    }
    var farTop = Math.max(farBase - b64h.farH, Math.min(nearTop + stripSolidRow64(b64h, "near") - b64h.farH, yBot - b64h.farH));
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
  blob: ["#6ad86a", "#2e9a50", "#c8ffb0"], magma: ["#ff7828", "#b02818", "#ffe060"], penguin: ["#2a3048", "#f6f6ff", "#ffa030"],
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
};
var mobSprCache: any = {};
function drawMobSprite(ctx: Ctx, kind: string, x: number, y: number, frame: number, flip: boolean) {
  var m = MOB_SPRITES[kind];
  if (!m || !m.src) return false;
  var cv = mobSprCache[kind];
  if (cv === undefined) { cv = mobSprCache[kind] = pngToCanvas(m.src) || null; }
  if (!cv) return false;
  var f = Math.max(0, Math.min(m.n - 1, frame | 0));
  if (flip) {
    ctx.save(); ctx.translate(x + 16 - m.ox, y + m.oy); ctx.scale(-1, 1);
    ctx.drawImage(cv, f * m.fw, 0, m.fw, m.fh, 0, 0, m.fw, m.fh); ctx.restore();
  } else ctx.drawImage(cv, f * m.fw, 0, m.fw, m.fh, x + m.ox, y + m.oy, m.fw, m.fh);
  return true;
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
    ctx.globalAlpha = m.squish / 10;
    rect(ctx, x, y + m.h - 3, m.w, 3, pal[1]);
    ctx.globalAlpha = 1;
    return;
  }
  var k: number, b = m.b, lk = m.vx > 0 ? 1 : 0, wb = Math.floor(t / 12) % 2;
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
  ctx.globalAlpha = BUBBLE.fillA;
  fillDisk(ctx, cx, cy, BUBBLE.r - 1, BUBBLE.fill);
  ctx.globalAlpha = 1;
  strokeDisk(ctx, cx, cy, BUBBLE.r, BUBBLE.rim);
  rect(ctx, cx - 4, cy - 6, 2, 1, BUBBLE.hi);
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
    ctx.globalAlpha = 0.12;
    fillDisk(ctx, cx, cy, r, BUBBLE.fill);
    ctx.globalAlpha = 1;
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
  if (drawBonusSprite(ctx, it.kind, cx, cy)) return;
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
  /* v1.0: 64-px hero is ~32.5 game px tall (head at sy-16.5). Stretch the ring
     vertically ×1.4 so the aura covers the hat; width and physics stay the same. */
  var YSC = 1.4, N = 51, H = 25;
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
function drawShieldAura(ctx: Ctx, p: any, sy: number, tick: number) {
  if (!(p.shieldT > 0)) return;
  if (p.shieldT <= SHIELD_BLINK_T) {
    var bt = p.remote ? tick : p.shieldT;
    if (((bt >> 2) % 2) === 0) return;
  }
  if (!SHIELD_FRAMES) SHIELD_FRAMES = buildShieldFrames();
  var ph = Math.floor(tick / 6) % SHIELD_FRAMES.length;
  var pts = SHIELD_FRAMES[ph];
  var cx = Math.round(p.x + 6), cy = Math.round(sy + 5);
  ctx.globalAlpha = 1;
  for (var i = 0; i < pts.length; i++) {
    var pt = pts[i];
    rect(ctx, cx + pt[0], cy + pt[1], 1, 1, pt[2]);
  }
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
    var mh = menuHop(820, 10), hop = mh.hop, pose = mh.pose;
    var platY = L.platY;
    rect(ctx, LW / 2 - 28, platY, 56, 5, C.wood); rect(ctx, LW / 2 - 28, platY + 4, 56, 2, C.woodD); rect(ctx, LW / 2 - 28, platY, 56, 1, C.edge);
    var heroId = (CHARS[save.char] || CHARS[0]).id;
    var heroVis = heroArtH(heroId, 2);
    var heroY = platY - 32 - hop;
    if (platY - heroVis - hop < L.tagBot + 2) { hop = Math.max(0, platY - heroVis - (L.tagBot + 2)); heroY = platY - 32 - hop; }
    drawJumper(ctx, jumperXForCenter(LW / 2, heroId, pose, 2), heroY, lookNow(), 1, pose, ui % 170 < 6, true, 2, true);
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
      var mh = menuHop(860, 10), pose = mh.pose, hop = mh.hop;
      if ((menuNow() % 4300) > 3440) { pose = "ability"; hop = 6; }
      var hopMax = Math.max(0, mid + 8 - shopVis - (y0 + 1));
      if (hop > hopMax) hop = hopMax;
      drawJumper(ctx, jumperXForCenter(LW / 2, H2.id, pose, 2), mid + 8 - 32 - hop, makeLook(i, save.color, save.hat), 1, pose, ui % 170 < 6, true, 2, true);
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

  /* v1.0 menu hop (start screen, shop): time-based, float height (drawJumper snaps it to the device pixel),
     ground beat squash -> crouch, then a parabola with the 64-px transition frames up -> apex -> fstart -> fall. */
  function menuNow() { return (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now(); }
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
    if (raw === "ability") { next = "ability"; forced = true; }
    else if (landed) { next = "squash"; forced = true; }
    else switch (a.pose) {
      case "ability": next = air; forced = true; break;
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
    drawBg(ctx, cam, w.tick, w.map);
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
        drawFxBack(p, sy, cam);
        /* Render-only: while clinging, face into the field. p.face is used by dash/kick/net, so sim stays as-is. */
        var faceDraw = p.wall === -1 ? 1 : p.wall === 1 ? -1 : p.face;
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
    HUD_INSET = phase === "play" ? Math.max(0, Math.round(insetTopCss() / Math.max(0.01, cssScale || 1)) - VIEW_TOPPAD) : 0;
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
    heroPose: function () { var p0 = world && world.players[0]; var a = p0 && animSt && animSt.get(p0); return a ? a.pose : null; },
    net: NET,
    profile: typeof PROFILE !== "undefined" ? PROFILE : null,
    getSave: function () { return save; },
    getFlash: function () { return flash; },
    getSize: function () { return { lw: LW, lh: LH, scale: SCALE, pScale: pScale, pScaleY: pScaleY, cssScale: cssScale, dpr: Math.max(1, window.devicePixelRatio || 1), isWide: isWide, isPhone: isPhone, phoneLand: phoneLand, paused: paused, landPause: landPause, manualPause: manualPause, resumeCd: resumeCd, cw: canvas.width, ch: canvas.height, viewPad: VIEW_PAD, viewCrop: VIEW_CROP, viewBot: VIEW_BOT, viewShift: VIEW_SHIFT, fieldOx: FIELD_OX, fieldOy: FIELD_OY, viewTopPad: VIEW_TOPPAD, hudInset: HUD_INSET, phoneInt: PHONE_INT, devW: DEV_W, devH: DEV_H }; },
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
