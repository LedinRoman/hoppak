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
var ART64: any = {"hero":{"pilot":"data:image/png;base64,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","ninja":"data:image/png;base64,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","robot":"data:image/png;base64,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","mage":"data:image/png;base64,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","knight":"data:image/png;base64,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","pirate":"data:image/png;base64,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"},"plat":{"bounce":{"src":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGAAAAATCAYAAABvLghXAAABH0lEQVR42mNkwANEeGT+M4wCisCbL08Y8ckzjQY+bQGhcMSIHSUFpf+f3vxiYGBgYHhRqTMaghQCifYreHMDI7bYGg142kUEeiSwYFV95TOijJpZiiH9L70bd5mGph6fWmqoJ9U9tFaPS+0LX3kGic0PcdcBo2X+wNQJjMiCkcc1Gfrbvo2GEo1AYRUXw3LL6yhFERNy4MMUjQLagcjjmgyRxzXhiZ4FV0yNAvoAptEgGNj6YDQCRnPAaASMAjqDvQteYXbEYILOCWJ4NcAANnXkqCfVbGq5h9r2EKsWWd2bL08YUfoBYunCo8mTxuDVzLcoEcCEbXxiFNAewMKcEVsXeTQn0Cf1o0QArrGKUUCblI+zFTRaHNEv8BkYGBgAyX+DtknZ7CMAAAAASUVORK5CYII=","w":96,"h":19,"land":2},"break":{"src":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGAAAAASCAYAAACkctvyAAABfElEQVR42u2ZIU/DUBDHf6+pLAaKGXUjICb6AZog+AATS/CwLPsC2AWxDENCgkIszZhGVFSQ4DAVyAkMYW5bEANVXwwNHWyMEG5tQ/+qyb27d+/+d/fSe4oETMOKKCCOaThS8bdWhCNdKIDxWSuy230ABieHAISTVwCM0vpcxWXyg1OXXrPG2ubv9H8qP7ry5u6TVf/jOAeNKrsXl0o3DSuy232CRnVG8bOhRUhbvmxd1vyP4+y4PqZhRXpSOH4c/klZtYIBvWaNycNQtHwl9+k4NvWuJ2J/a6dM7u+AVZEsDREC4uwpVcrkneB616MVDMTOokk7L+G4dPYn7XccWzShtKI1pFvVWt6cznt1iRKwytYgmTSL7EsklCbtvFTppnXRf0dQ5lpQ1g+fFhzX/0qA4/ozPwh5yNY8E3K9V2EajpQeT+ZMw4q8u0B84/vJM/8Z508vAOzf3Cp4H8bFBAAcb29QQDb48DGSVskFxXvAarDwPSApKCAffIA3Kq39AQNddl0AAAAASUVORK5CYII=","w":96,"h":18,"land":2},"bubble":{"src":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGAAAAARCAYAAAAi5qlcAAABz0lEQVR42u1ZsU7DMBA9W6kKVRekdkER6lAWBsTSoTtDJyYW/oPPYikzEhsLC0Jqpwh1KDAExIKsRESEoVzrunbixE5A4CdViq53z/bZdxdfCEjQafspOFjHy/uciDLqnF8tWBJn+nZtR1pb3RQA4OzpGRpUTfrxuXrO0lPZymx4ThlEG5U+6uXxqbjRTodHdyzUu/B7wJIYWBSSjQjotP205TXXJiIjFmV5gyMP/opumIqvQbO58D/T8XTmoztnjAY+EogoOJ3PlKehTCSIE9TlUtkVjZQijjKJIl3bBl1EAtYEkpd2TBxRZgFlYOKwn8J4b7EJVEw7VTimaqjSpa012F4Hz+fxVVonZGVy2Wk3cYjN6DHl0rE1iUCPjwAZUdHca8Nxqk0uw19HWir6csHPycN31TyCrJNU1yJ/M8oUeZbEsCzCAACDq/ulUnA3c7coi+gf9aB/0IVgGsLt8eHqJsyikGzv7gOfihyqQTANl887wyGwKCQUAOD14YY499SLx+tLstaKwFSEacilIPt4Oz9Z9Yi+2xGUF7S8JkxGA5iMBs5bFYLvBW2kHmxLsCT+83UB70C665Tpq/ykkostaWnu/08t6ToPmux7wBd2VuNivhMc1gAAAABJRU5ErkJggg==","w":96,"h":17,"land":1},"cloud":{"src":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGAAAAAVCAYAAAC5d+tKAAACX0lEQVR42u1ZT2vbMBR/CqlwHBNY8PqPUMjozTB22U7NoffBbvsApR+oH2BfYseeethxl17aU0dYGd3chhXiyDGGRTsEqZIjp5FiuW7xDwxBsfJ+7/ek954UBAXA93pU5/3R5BeCCkLXjyJ8aTwXR8viNEnj5+OL7/Wo7/Wog7s0IgmdzWbSE5GEP+IYm1OFQDAuDu5yflk/VE9EEj4vCAbGfqAiVkycjLTmuo7PPyfpX/TUAWCrXtcPMk3h9atdAADwsGuUjpo629LDrpT3huGVkdNxMgIyTaG/tQ8edulT1AVx9+kKz9BuYbi7v4H+1r5Ss6xeWgFYlh7E79otbEz+dnzNA5FdkYx80RDFGIZXxvxV/ou6iPx9r0fzgtBcJjBb4cwImaYAAJJgRWCSxhAEAxr+HEpjNoLAxNAttqv6cXd/I+nFUlQQDOjFxTf0aA1g4t+Or5fmcNNtq8qjLKCmudgkZ9u0o7KZVyMWBhzcpWWRE0nmbWubtmzayWKzsweTNF5oOpp5BZdM09IIlilEmbZUcHCXikFA67aUNVbfee0Whs3OntQMoHX64Br6cB1fak9RXsdTw24NYo0HrwFfz+dp6dO7+QuXfzakie/7euek78PFY0QY/YOPb5tr/c4qPFS2dfir5ptqwOaw3wyjBowJ5bW2kb2AYoGoKvLEqTJfkfOYUH5Q87D7UAO+nP2u84NldNqIB+D4cGcegOwR+uT0R62UxQAcHbyRrkUa2fuR48OdWilL+PxhWxKf1wBxwNYlWA1YEF95FVHFf6teqvjSDsh7oYY98QEA/gONoJuZfh5sigAAAABJRU5ErkJggg==","w":96,"h":21,"land":7},"grav":{"src":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGAAAAARCAYAAAAi5qlcAAAAv0lEQVR42mNkQAIiPDL/GUYBzcGbL08YYWym0cCnP0AOa0Z0AY9X50dDiIZgh5ghSk5ghAX+aMAPTESwwAT4nO+NhsoAAKbRIBhYwEKswolzdFH4+SmXaaJnIPQNpN7RHDCciyBSUsJIBfBWUJju2tHQoCNYdTl4tAgaFDkAuSNmKFI6GiJ0AOffdMM7YkzoYxOjgD4AFuZM2GJmFNA+9eNsBY1GAv0CH14HwMDoiCh9ix+MHDBaF9A38BkYGBgA3N5KDhgGYeIAAAAASUVORK5CYII=","w":96,"h":17,"land":1},"ice":{"src":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGAAAAAQCAYAAADpunr5AAABsklEQVR42u1YsUoDQRB9swmE4wRTiMHgJcFaSOmP+AliZ5tOC+1s7fINNrb+gXaitSZGIohFBI+QwqxFmGOz2b27GPYE3QcHR3b2Zua9ydzcEjRsrG1LeDjF++cL8b1QFzZ39jz5BUAt8kSJMKxLABh9DDxDjlFdjxDWIrw93hCxIq+jvmemQGxVm7MW5Hv+76LMN8eD6dzC5CvpTjhvkfUBnZ5Zv0pJ4iwSqc7Zp+ory5/JZ6Ukc8er5qn7XSVXAKn5dnoysQOAsZzFQfwPOLh/sgpgItQUjE6ELTHeywHl2ZNGgC0OfX8W+cvkahPBJIS6n+0udpvzU9Dki5KLDfnKCjhPUjb7tD15Cc8iRH2W7lO3+0keJv5s8bBNQAIBCRBPP0cP/UxSlxEjLYD/CD3/bruBgARE3opWK8VUNatW+18jW+0etsIbyymSMXQspzi8e04Wr69u/YjiCL2TfQBAHA+pzJ/GYViX3XYDrdNLz1ABiOMhLRxFqOp4uK3+hbMgVsSL4J78sBZh4SzIdFjEHwsebtqPsQXxO2EVBwEJ50kU4WMZPzzXm+zV31TyAeAbdmLSIzKXJ1gAAAAASUVORK5CYII=","w":96,"h":16,"land":1},"lava":{"src":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGAAAAARCAYAAAAi5qlcAAABwElEQVR42u1XzUrDQBCeJEtoICBC6EGiN6++gZd6yTFP4yuIPk2Pnrz3BXyAtlSQ1B8SUGJLPO12u53902w8uB8Ews7km9lvsjNsAAKyNO8+ty2Mohhk0Nn/G0z0AgDmUzXLgNpCTHwZicz2FxvuK5e+eUQ+jP8yP+/oe8CL/3ST+N95ABxfv8MoiqFqlgHJ0rzbVcoXYEhkad4FaTLuAABe7468IgOfAgAAQgdDcUuYsYUNxECMyVrYsHeT73T+1K7iUnHwNh6yWKZ7NdmnSe48CPahjfgmwWSbxISzjS/jlcUU1zFfWxFt9dgrwG5Kq/v//fTkYK0oVz/yxxIU/WXcVJyH6dmBbVLOGTcfQ5e7mA/GXZQro7x1ulDQzhPySdhWHAuuagHYegsbdF3GHQNBBdK1sz72ZMtlgtDFgNH1btuZ4SIXmof4TMr5r2OaFIreZdgQnq3XcBpHik/wP2NVvxn7V3VjtREbbte5yP3tuRftlrWhkL8W2+Li6tHZn6vixmyucqlfvpxw04sYEz9Nxp36BHj0hUW7hebjOTiYAfRoeLgVHx3CtCIe7sXntSa6Cnm4xV4L8qfAPUSNvwH8m+zlootjlwAAAABJRU5ErkJggg==","w":96,"h":17,"land":1},"move":{"src":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGAAAAASCAYAAACkctvyAAAA+klEQVR42mNkQAMiPDL/GUYBTcGbL08YYWym0eAYWMCILfU/P6QwGjI0ApJ2D1ByASNy4I8GPP0jgmW0zB9YwAJjIKd+w02NoyFDA3Derx53BIwC4gMPPYHikyMERltBZKZcYuQ6os0YOqLNRiOAmoGPnMLxyZFcB4wCwgBfAGOTq1h6arQIGgxFEd6OGLbOl3Sz02hoI4GntftQ+Mjhg08OnzmwfsBoDiAC4AtUShMrSh1w99a30dCmYSRgC18m2JgELEuMAtoDm5RXDAwMkPEglLEgeKy4Jo2GEg3Av93z4GyMwTj0SBgFtAM45wOQJUYB7QOfgYGBAQChsl2javWWbwAAAABJRU5ErkJggg==","w":96,"h":18,"land":1},"normal_aqua":{"src":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGAAAAASCAYAAACkctvyAAABH0lEQVR42u2ZsQrCMBCG/wRBUREHcXISxNFVwU0cfQLBXV/AxdHFF9Bd8AkcxU3Q1dm1YwaRKjrpdCVtrWIxrch9U0h6oXyXS0gr4KGQLd3BGEXZlqC2ZPnxIrzyu+oAADjers5D+WSKTYXkeLu6/C0KFVcViHKxej9dztDlM2ahJACAZPnRo7tOUKPZGgAANuspJqM5WzLAcNxzPC+eHcIAWL5BSL6OZC3xwgmImUSYoOV25+vrNOofx7yL+7eYlxXQ36+ciYMmDyOY8UOuAUAq2xK5dMY38E3RvxwT1TtQPzlWtiWUbQnfTXhWa/MSjWD1003YdQizfPN4HcugvYkxv/+7EkAlwUmIbvsBtK+h+jnAmCXwf4A+wJiXDwAPyq2DsRcfxFYAAAAASUVORK5CYII=","w":96,"h":18,"land":1},"normal_city":{"src":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGAAAAARCAYAAAAi5qlcAAABoElEQVR42u1YvU7DMBD+EhxVrVAXGBlYuqBKCHVmQOo78Bo8BTNDX4WtKgNzxIK6dOnACAtC/KhNYaguulxtxzFJuviTIiXx2Xf+7sc/ERiOD09+EdA4Xj9eInqPAx3tgwd6JH+M354DQw1jejTMM0ER+YH4/WRCKEF7AA92RS/D63MAwOXFIDDUIB6fFtsyJB0Q0A7Wm+J3zBtkY0D96HcTqFjjgID20Osku2sAAKgYSOdLjM5OS2sYZQt507Z2UB+OsrWG6yEdvU5itS2dL/H5s/LSpcv+q9GgVh4e0gX63aRYguhUNplluJtm+URcoFrKn/+URte+PnPhY7vqef9a4fb+Oz8HRPJ0djM+2BlMxUUFNmN5xLoaL+V1kyEZGXEuem3k8D4mOanb9K/MqevNNtD5dYQyGetimG8k2cbTOd/VDhcypIxJX1l0k8NlcJq4NMns0DWZZd7k+zqJdmCmifJ+9LhmU1W7quwGy2SlMyn6tQ7gN3Q2QqoYYOtjIrNKRtVFlosdvs7UgXMdybuJsElsHsbraN4Q0Dz5APAHrdLWD97VCm0AAAAASUVORK5CYII=","w":96,"h":17,"land":1},"normal_ice":{"src":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGAAAAARCAYAAAAi5qlcAAAB2UlEQVR42u2YP0vDQBjGn4Q0BrlDB8FFdHB2kw4uWlzqUPwA+gE6OugiCE4udZB+Bv0EDnWR6uIgro4OiotFB0mopS2tg9x5F+/aJG1ShHsg0Fzvzb35vX+OnAVBc2ShD6PU9R68Wuy3LcL324Ghk4HERLfCAWh+fRhCKWt+ZolXgsWi8fb5bMhMIAiOQTEZsXbvsJuVoxoAoFgqGDohdbo95XjOsSPZifOuLusAAOqS302Y3YRVyXuo5D2tA7oFo87/L8o5Nr/i6mxtmjNRceFP9AiFR6gEPwx3EFjxvySOjisrVePDEoK9W5R5SeCHWSoDwHRTf4id8aM4qYMx7kqL8txh9mJiqZJsWCCva7fqPQAAXk52sHh4gVbgAwD27ppS+bHgAOBzRBVLBQmMqu+ppNtzOt2e5LDKRnxZtl7OsbXreYRio7CqrVqd3ebWuhK8bj7z7+C+Jdl5hP5hZ7OvMr8d4PF4m0dK1fNaga+Er+qVo2Zc1N4cp/JE3+O0zKT9X6wIlrwA0KiWQV3y8x3ABqfc2T4ALO+f871gEGyj5GpUy/w4grcg6hLelwz47CTVFXUJnk53DZWUs18ZAPGEzigdseQWWUvQzXF0NlIeR5sqyB4+AHwD88QOwnkP1RwAAAAASUVORK5CYII=","w":96,"h":17,"land":1},"normal_jungle":{"src":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGAAAAARCAYAAAAi5qlcAAABgElEQVR42mNkQAMiPDL/GUYBzcCbL08YkflMo4FPX4AexozoEpveeo2GEg2Bn/A2lJzAiBwjo4FP30hAKYJGA59+ADmsWWCM+IKjDCwczAyWQXKjIUQjcHzdIwYGBgaGPz/+YkYAusQooD7AFr5Mg8Vxh5fdJ1sfJXrp7V50AK+EBWP5GRgYGBhsoxRRFDy5+hHOvn/xHZyNrg6fo7CpxaWHhYOZgYGBgWBRiC07w/Tj04tLHyF3IutF149LH0w9zD3Ifn2/+CNmEQTThOwBGW1+qsU2tkBn4WBG8cyfH3/hkUBIHy79+PTiMptYt6K7G1uCvX/xHdEJiRG9cyCaKoSi8fi6R0O2boAFDql+gOnDlfCQIwLdXEV9IYbHNz+iiFkGycFzw+vZ71B6xSgdMVjgj7QKGT0XUcM8jNYOVAwWAbCOGAuxtfVIa53QyzxGbGMUsAp5FFA3l6EXPyjNUPRRulFAu1yGHNYogT46GkofgBwBTLgkRgHtA5+BgYEBAPSizCuIRI58AAAAAElFTkSuQmCC","w":96,"h":17,"land":1},"normal_lava":{"src":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGAAAAARCAYAAAAi5qlcAAABEElEQVR42u2YuwrCMBiFT0IXoReQChXUWQdHX05w9QF8NQd11SIFXXqZWmidUlJbS1tJuvzfVHLnnOQklEHCNRcFCOW8E5+Jb05yjAsDgPl0VWRpjuBokiKK8fZJ5RRw11wUWZqTMpoQm1zEPf+uINRzO7ilCYYo3J0mAIDtekMKKSKMYtyffqWMLmENoodRDABwbKtWTwaMjNHFQdm58/VSa9MWW03tu0Rd33nG7jM0vnnXwYcsaCi/xmubR1efvji2Bce2EEZx47hcvEcfwau2AJFdxP+Iy/cRvEqt34nPmPwbYunNSCnFyOLXIkg+BYQe6BU0wu5vNKDpLiDUIP8NNbo6RWiIINkZQv3uB4APJ6qHJrcykNcAAAAASUVORK5CYII=","w":96,"h":17,"land":1},"normal_space":{"src":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGAAAAARCAYAAAAi5qlcAAABfklEQVR42u2YP2sCMRjGn5y62U2EgoUutxXRtrNLv0Whc8Ev0rGb0C/Qb9EObh2sIgWHG7zBQVSQuzo1ynWQXINJ7jy55IbmBwfHm7z587zJe7kQcNSqjQgW7aw2M8LeHStHsRAAOL+4jeh6jvuFbxUxwGv9Mt4FTq3aiOh6jvAnsMoYwm1343RP2Mvjl4fvesWqY4CzBcXLlQsAKDPj+8MzAKDZ6uwLSn/B2O6oYMsC89eFbKwmyKrR5+BNsDlJorEnqYyvo6qrm6Sxmu73cAx8+fXNnRhEVVSPFbNcqqQGgdX5z2x3FONRPz0AaULJGmFpK8vWS/OT9aPD59Q5JfmoNGy2OoKfkILCYIkwWMYrl89pqgmq7CY59fuU55zGo750HMwma9Nh51Fv2AMA+NMJ/OmkUDHZAsiLvBdIWnuyIDAfb9iLtV5tZoTw1xBuu2vPiJrhxbdXEQX9hB11DLXoYfDxJN4F8WlIFiWLnvSjDIBFH7z4Qgo6LLTo5xfXceEP6PpUhgAAAABJRU5ErkJggg==","w":96,"h":17,"land":1},"spring":{"src":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAARCAYAAADdRIy+AAAAlUlEQVR42mNkQAIiPDL/GcgAb748YYSxGZENel2XwsDAwMAg2jSHAZlPCMDUv/nyhJFRhEfmP7EaiTGYhYGBgYHh1j0GagEUL28x0SHLEJ8zVxBepnaksKBLHrhwiihDHAzMUAzCaeCyVVsoD0N0QMjr2FyG04VEev0/Lq/jNJBcrzPikyTH6yzoBpASy0SF4WgskwwAB9RKuPaJUBoAAAAASUVORK5CYII=","w":20,"h":17,"land":1},"spring_compressed":{"src":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAALCAYAAAB/Ca1DAAAAg0lEQVR42mNkQAIiPDL/GcgAb748YYSxGZENel2XwsDAwMAg2jSHAZlPCMDUv/nyhJFRhEfmP7EaiTGYhYGBgYHh1j0GagEUL28x0SHLEJ8zVxBepnaksKBLHrhwiihDHAzMUAzCaeCyVVsoD0N0QMjr2FyG04VEev0/Lq/jNJBcrwMABAIznwSCybsAAAAASUVORK5CYII=","w":20,"h":11,"land":1},"spring_extended":{"src":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAAmElEQVR42mNkQAIiPDL/GcgAb748YYSxGZENel2XwsDAwMAg2jSHAZlPCMDUv/nyhJFRhEfmP7EaiTGYhYGBgYHh1j0GagEUL28x0SHLEJ8zVxBepnaksKBLHrhwiihDHAzMUAzCaeCyVVsoD0N0QMjr2FyG04VEev0/Lq/jNJBcrzPikyTH6yzoBpASy0SF4Wgsj8YyYQAAwCNVADd6m/cAAAAASUVORK5CYII=","w":20,"h":20,"land":1}},"bg":{"city":{"L":{"aurora":{"src":"data:image/png;base64,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","x":0,"y":32,"w":160,"h":65,"m":2000},"clouds_big":{"src":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAKAAAAFaCAYAAACZsVbmAAADbUlEQVR42u3Zva3iQBSA0TEiowtCAkJqoAP6gDp4fdABLUCIBCFVQDwbWVo97Rpj8M+Mz4ltYeOPubYJAQAAAAAAAAAAclGkcqAxxvjWiRVFUWe/cjv6MU0pvtv52SjYqv3K7YRoBfxafE0sVjMRjjHAOqO17fhEOMIA647IrolwBAF2NVY/idDDSuYBDjU+K2O3JkO85xui2/mZ7LELsKeHChEKMDup/ngECH0GeD094vX0yGJ85XIeo1wBjTD+1tl/wcfDPYQQwnozT/oLK8+DxAJ0AfmXzl+s7reXpO+fdj9LL6MBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACA9hS+gnGIMcbKEIqieLVN1b5Nj2vq0ownvNv5+XK7qm2q9m0aoRVwBPE1iepdi9Ws0UooQPF9NcJ3x7QAxddpnL9DFGCmDxZDiq9qVHsIscp16vfxTlxK8fW5cgtQfL2uggJM/AKmToAIkHqup0fM7VwEaPz2ymuYhBwP9xBCCOvNPIvzEGAGFzB1/glJ0H57SfpecPez1B0AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACfKnwFeYsxxreCKIpOm5i6RPnHdzs/39qnywitgJmtaGU8TeIrLVazzlZKK2CC4VVFVXe7KnX2Kz/n0xCtgJmO0q4sVrOPIpy4vOL7xKfHJUDxdf6kbQQnFODQ4/vfg0vdsewhhFZGcd3XOUYwvd4bCpDWXE+Pl/eGRnCCFy0nVsAMxljKrIADczzcQwghrDfzLM5DgJlfwNR5DzhQ++0l6XvB3c9SWwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACMRtH2B8QY41sHVBRFnf3K7UjbtIv4budno2Cr9iu3E6IV8GvxNbFYzUQ4xgDrjNa24xPhCAOsOyK7JsIRBNjVWP0kQg8rmQc41PisjGmafPOeb4hu52eyxy7Anh4qRCjA7KT64xEg9Bng9fSI19Mji/GVy3mMcgU0wmjDy/+Cj4d7CCGE9Wae9ImW50FiAbqAtKn2C9r99pL0/dPuZ+llNAAAAAAAAAB04A/rpK4WpDO93QAAAABJRU5ErkJggg==","x":0,"y":0,"w":160,"h":346,"m":700},"clouds_small":{"src":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAKAAAAFaCAYAAACZsVbmAAAC8ElEQVR42u3dMW7iQBQG4BghIdHlAHRIdL5DDsEp6DkEPYW5Qg5AGc7gDsmdD0CHROWtrEUbQuzxbGLL31clxjNBb349TxrPywsAAGOTfPVBkV+rkAmX6TxRVoIDeB+88nxrPeFiNRNEwgJYhy8keI+CKIR8Z1L/sN3k0cJXz1PPCd8GMGb4IOgR/PF+idqx3tavHsE8Nb3/5XgqVYTfewQDAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADAU4kS0EaRX6sm9y3TeaNsTZWUtqErz7egcY9CqQPSKEBNQ1dbrGafxtXX7oOoA/JU2+A9G/fo2kSJ+cohK6LPeTyVAoj/ghmI7SavYs6326eJDggAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAECYpOmNRX6tQv/IMp0nSs0j0zbhK883FSOqyU+Er0v3ZOQBPGRF5853yAqVJnwP+PF+6dTB3tav9oCEdUD4tQ643eRR9267faoTogMCAAAAAAAAAAAAAAAAAAAAAAAAAPCXN5aOUOipBf/jvBcBHGnwQk4+WKxm0YMogCMLX4zDhharWbQQekf0CNQvm4910lV5vkV7gb0AjkRfj1nzCB6JrocN/SvW4UNTSzMOx1PZy+/lEQwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEBziRIMQ5Ffqyb3LdP5oNZ0ammHE7ryfAsa1+dQ6oA9D17T0NUWq9mncfW1PgZRB+yptsF7Ni50rp8wsdT9c8iK6HMeT6UAgj3gQGw3eRVzvt0+7eVa64AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA0l8SYpMivVejYZTpPLMN4TWOFrzzfVJPWJr8dvi7dk5EH8JAVnTvfISusgj1guI/3S6cO9rZ+tQfUAWFgHXC7yaPu3Xb7VCfUAQEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABgKP4AygvkI+g3SFoAAAAASUVORK5CYII=","x":0,"y":0,"w":160,"h":346,"m":700},"stars":{"src":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAKAAAAFaCAYAAACZsVbmAAABr0lEQVR42u3cwRGEIAwAQIb+C7QSv9zjfvdQ8QQk7JaQwYAhJCUAAAAAAIDllH0rogAAAAAAAAAAAAAAAAAAAMApD9QBAAAAAAAAAACgitY7AAAAIJiyb0XJ4ysLAQAAAAAAADCpme993VkDgC0VAAAAAADgNa48wPcwHQCAIQdVUQAAAAAAAAAAAAAAAAAAAAAAAAAAAACoZ84zd+WnFp9FiAwIAACAn0kAGQmAx7cJWwV3ZSEAAAAAAAAAAAAgIL2VAAAAAABwQjEdqxqAlhlZVp6f4UQAAAAA8anjAQAAAAAAAB25ogQAAAAACECxFwAAAAAABug9/N2QcgAAAAAAAIA4PAoDAFj3TJcFh6fiK874yAFkRQAAAAAA4A+9p0hFZToWAMQ4F4kCQ86AumKRAQEARxEEk7n/gv3ZIgMCADgyAQAAAAAAAMCruCgHgOqt0/ZJC8azAQAAAAAAAABwjQ4mAAAAACClMbVC9UkAAAAAAAAAAID4TORfiyn5AAAAAAAAAAC/dM8AYGcAAAAAAAAAjrlHpId8tPgsQmRAAAAAAAAAAKA5fQIAML0PtYnvT658bsUAAAAASUVORK5CYII=","x":0,"y":0,"w":160,"h":346,"m":700},"sun_moon":{"src":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAs0lEQVR42mNkQAP/v135z4AHMHLpMCLzWdA1/Xx3BZ9+FLWMXDqMLMRqRFf34s4FiCH/v135T0gzTLGEigGKOLuQDqYBR7dsZFDWkEfRwC6kg9WVL+5cYGBBtw2mGZuzsQEmBgoBhgvkzWIYSAlYFmKdiy1sSPICtrDB6gJc0YbLayzEugCX17AaALONmEBkhKVvYpMysjcVHDoQeQFXcsUVPiguQM9tD08twWmAgkMHih4AFslfdyiFq3QAAAAASUVORK5CYII=","x":139,"y":90,"w":16,"h":16,"m":700}},"far":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAKAAAAB/CAYAAABop8nXAAAMWUlEQVR42u1dS2tcRxYudTdaGF93DAIhIdkBQUCDHQIW9iKLEMSANgER/YKQnVc2sx28GLwNM6vswvwCDwZtDMYYL7yYQQZjDRYYBJbVSAgMdruNFw1NzyJzLtWn63HqVt1Hx98HIYndfW/Vqa/Ou6rnFBCEn378bayUUm96RyrLumow6Kss6yZ59v1Hf5mbNXlsXr8zVkqpR//5W6Gxt0CpcPLpSEW+WQSRLwYd0EqOd/33SimlTs+OlVJKffz0Yeozo9Fw6s/a7Xnj8+iz7fa8On/uwszKxSSHSgl49/aj8d6L55+V6XERykU022dnUZPSmGMI2EpBviao8ipwsftFMPn4Z+gfHUuLq5+tVYnWgIdHr/P/Pj07ti5Euz2vlhZXc/NFgh8M+jNngkOJF0vupiPGfUjmAxKx2u1546KMRkPVOzmcMEOnZ8fq/LkLUSo8BNubv4x9JDCRTCmlNr7+Riml1N6L58lIR/Kqk3yb1++Mi0awKVB5FKwv3tLiqsqybiUmKNZVkPi4V9evqavr1+wbYGtnYgPagpOqNiO5Pjeu3IqSTa0+oG1Xk3BNQk6pQaTpE91VCDGxoSRcu/yl8+//9NXVRpDvYvcLdWnlcq4A6vLDo00wLdpoNMyFShptMOir/uCt02xXof14+oSPVwo+Vvo+baj9g2dq/+CZPdp/cG9ic9ZJPn2zkR9+48qt8Wg0VHsHv4pMcu/kUK0srzXHBFOE1zs5bISZ0X077melGlfV2rwoNtZvjskH1jfk6dmx+vjpg+oP3uZz2Vi/OZY8j8g7Gg1F3yk1CLEFJSZNoaOKKFjX0nWTzzSGl6/2c9NcJmhNJOPeWL85lmjCLOs6rVwQAU1Roi9JvPH1N+rw6LXqnUwLmi+0LUJuCoqYZZ8vbHsH/3dV6ZIYsujoZgtpfEBfFcNESt2cuZx7Lty6yEfj5ZvENK7RaJgLNya6s5Gqmy3kJKD3VpWIzrKuqOKiu1ClByFFSmgmB9a3CDbyUUdJVaAx6clTrhX0ElPKTUNES6WF6sT3336n7j+4F11C7HC/ILWZdNVHiQxV1UF9po7/PR87j/p039b3bB6c8ede7F6rlEAxm56sIsmCOLN5/c740spl9c9//SxObHe4f5aKfE2Ifl1waTc9gArdXLzc2JRIWV8PG/l8Lgcl8/dePJ/IieouxLv+e2/FqZIouEkpDJ6r9L23iDUYjYZqZXktT/m8fLU/M8GXFJJkvisCN8mgUxe5JBqSdhLvOo5p33KNiwiqWwN9nL5gIbame/f2o/Ff/745J5VLEVm4TK+vLm9K6MfKvBO6M8vYzbRwd28/miiZ2UpjXMXT922+hy0K1iPSFC6EXgUJSUGtLK/lJbyffvxt7CsJclnQ/Pj3ODklfp8vVeMiXxFedEzCMKlMKrK7Sk2xu//x0ycTkTFpPV+QIl0wnQREEJ2EIaTjAQgXPn+PJAm+9+J5IS2qz18vb25v/jImEo5Gw9Ki7yJKzEpAfeF14b3pHZUejWZZV/VODnMzoJsD3wJKe9J0smRZV52eHQdrO97R4jPrUnLrvqOrr1ISbfPP7R38OhdSLpNUQSTE8yXbO/wvPn76kC+8/oKY3cPzgXxRJL6FZAFvXLk1/vd//zEnJUOoL1NVEBVKaNPnTRtSJ+H21s7U399/cE9EvtDqDTUjm2TeKlu4uhY1manYJDQ91+c8h/hV0nemJuvLV/tBUXfoOFzko7WSEove280WRB0xpoaQiSCkzrzdLLXlxxK3CfnRw6PX1r7F0I0lLSLoaSmjBuQvTiko36S+//a7wn5djP82C1hZXgvquSMtZqr70tx95DP5ipSEXlpczd+hy9LUnCCRdUe6Q/WzqyH+oI98WdZVey+e52cu9PdLmwGk52qbQD6fFuRBjeucisTs6dWL07Nj1c0WrJ3dekZAT3WRheIJdu7T8bFLtGmLM1n3LUxMlyyk61yEy9+wJXr1MbkmZdsYRO46oMuQ+8N8PjR//fO04KG+mW5uiXB0BselDLrZgupmC2ow6KvBoJ8T7PHTJ2r/4JnVly+cB5RUBnSNRJrG1WRatum2aZHtrR21vbUz0V5WJvlMMuC9fiHysfnCoe1R+jt9GQbJ+Ewb20bCYAJKJ0PCNuXmOHzJahN5dNJID3lzIemJbF0DlNER7TrdVuT5tjpr0YUdDPr55iO5lJ0+4uac8rou+XVChW1LMoZMyqTBKHkaIxzaqXplQ68M6M9vSkRq83ljSUKbcPfhbi2NEC5Tr8+5JSUMj0p5sd7mL6bOlcU+z3VctMizlxZX1Q9//qGwb6ibxyK5vZhcXpnonRyKXIdW7MKaBGZyvMsmWyiplxZX839ink1+m+lQEZdDKvL/UVJMYhPMTUToOQ/XdR11IbYMp5t9KmFJCJCaJGU+r+j68Pqvsx0rNn9lS6XELnAVUXZoji7lIkm/H0Iw6Vh4ZxN/R+x9PbpVoWYP29iSX81BNT99EE3oBu6dHDr9qxRBicR/syXMXclmV5Ld50a4/NNutmCs1YeQj1dqJFex6P+fvCP65at947mIpqPs0qPr+b4ztv3BW29bk434j58+mfoOkd3U9SRVFvRMat/jZ06o1c3mgtH/JyUgPTQF+erUmmWkaGzapd2eVx8/fbCmLXiVwXRSz0d2blL5HTmxqSM+J9OfWaPgomH7+XMXptIypmcV6ZZNdeq+Cm0YKr8iN6TqptL1XttYbHdZF93kKZVDp6yE7B/hFFgdxI9pb08d9KRaQ28UXOQKDZMpSTXwsm5MLTNPZjv7kSLosWmwog0KvjmQyXZZM2n7nu/dLdOXXQ9Lka33RUxlaM+q+ht510tZMnF1muuw9Vr6/DqTW2CqeknHYZJRuz1vD0JCDnAXNR9lkCvFGCS5TIkG4uMqM7dpGw9vRJBsRqrqmOavf9eUL+RzoxQNBUv83S3+JT2wsA10ZXltKlCoO2qVkkoC2/mFVGkYHizwWnCIqfTBpAHPn7tglAe9O+UZGr0mbOJTh+8gX0eGfqFQk255SrkBSPiufKavq7kK1yG1r2w6LcitnP5n0vV3zaFTxIbrCcayNCBp2FQkD8lNVplE98ltaXF16pyvVNZ6LyQnro28rva6kDWWbsJOkSgphfbxaRBKzDb1Lr3YS86lJP/dHbjmPLAu9UWlfmisMuEugktTt2JNRmryEfTzCKkIk/oHZkJh8y1dife1y19O3ErB33t1/dpEK5g+z3f99xPvo8Nb589dEI9/ZXlNdMbH5NtKXASRBpT4O6kvtSzzHpO6+uZMdXJfKY5avfgi++RN9dg3vaOJOZvqv74gQqm1whvRR8JOEyoWs9a40IS50sLbDnwTKFiMWWffuY4YZdAKUampzHCoOaRxrCyvWU/D+cxEiiMDZSEkRWQLDrhMq7j2OIbU1m6Ydns+7yGjw8z8S6kXkSI96Wf51XGugzf6rzfpc6E57j7crd0015lyMvl8g0FfbKpHo2G++Ukb6/lJ3496BzWk/v/cbaH+sRhB6m1eqVJA+jHIshsAQjV93c/Vtaf0e9LENZd1x7U4obdhSpzjoiW71BrqXf/91E+vSt/xuXUQ+dbM9HuB0rl1TEw3Obaj0XAqIiuqHfhnQm6lT9V+xM14kdtRq8T21o5I/hLo/jK/RMBV+bHlEblVMpldm8USNaTWvTPJ9KceU1MCE1vRn8Zlu89Pam55gOIyl0U6Woq4MN5umCaahaYECVUHLDE/j5DaPTAFojGy6KgZwO7D3Tzb37QffSmb5O32fHRnCjebv3eoyOZWtrw7TVgMWxqG+6Vllf2anm4JSV777nh0kapq8ikVWQlJdb9KFaauydUWXyI6tPG3SCai6p+OzYOQOjVHGaf+Xb5Lih1d933WIXV7V1Mtb6vncvIdO0hGQFsUOCu+VmgkGzuvSyuXS5krkSUmKved5Uklk5SdRS0F1ArpD+zMmu8qJSgICNQKEBAAAQEQEABAQAAEBAAQEAABAQAEBEBAAAABARAQAEBAAAQEABAQAAEBAAQEQEAAAAEBEBAAQEAABAQAEBAAAQEABARAQAAAAQEQEABAQAAEBAAQEAABAQAEBEBAAAQEABAQAAEBAAQEQEAAAAEBEBAAQEAABAQAEBAAAQEABARAQAAAAQEQEABAQAAEBAAQEAABAQAEBEBAAAABARAQAEBAAAQEABAQAAEBAAQEQEAAAAGBhuB/DVy8KOv15o0AAAAASUVORK5CYII=","farW":160,"farH":127,"farFill":"#372c70","farY0":219,"near":"data:image/png;base64,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","nearW":160,"nearH":118,"nearFill":"#241b49","nearY0":228,"floor":"data:image/png;base64,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","floorW":160,"floorH":90,"floorFill":"#51416e","floorRow":23},"jungle":{"L":{"clouds_big":{"src":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAKAAAAFaCAYAAACZsVbmAAAIM0lEQVR42u3dT2iU6R0H8CfLJqtLLLKVrGLEuKggNFBPxUOzJ1k87Jay2NKeqqfG9tKFsIdte2h7EUt6izdTKBTa0EPrwYOXmh5y9OBBWBfNkohr2JVlHYwmh+zpmb4zmXfmfd9551/m8wHBJOO8M3m/8/s9v+edwRAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgFxGBvWBn748t5P1tp/euDbiVAtgaaG7d/1K7n87PbsgjALYnlevHu0U/bcxgEIogF0NXvTJf+/VfP3n9z4QQgHM1naLtNwsFVEl7L3XhvnJ5xlkEEAEUIViSAIY136dWP8l/eivfxfyHnp92Crf0uOnIYQQzsycrQnhv3/x85Esxze4DHgA005uWSd2cXUt0+0unJus+fp+xk3u6RB2hHAPtuBBWu9Zmw5gBcyymTwdQqETm7XqNZN1rfnRx++HEEKYVwkHJ4BZK0YyBNOzC2Hp8dNw8ejbHQtdGc9LCNsz0q3wFZlm48Awsf/Nmu9vbL4Ile2tth/b+OhY9e9pQW8W/PmrNw0m/VwBy7qMtrH5ohrCjc0XpT2+yvZWTQhbvRDqQ68d76EhpJV33zrQsBqWEcIstymj4tLDIaTenWfPG1a0ZMDq22IMYQgHSl0PVra3+mJNKYBdlNZKY7v9f9gaW3+5GUIIYXLf/nD+8KFw+4svU9d5sdVWtrfCZ6tfh5NTB8OtlfUQwu79wDIHLW25SwGs/+UfPzERQgjh80cbue+r1TCQrFTnDx8Ki6tr4fzhQy2HjOTXn61+Xf3erZX10kJoSu5yALNOuLFaNRoAskyfae0xVr206pdct8XjPXhSKf2X2Oz5u3LSoQC2M+HGwKQt7Mtaj8U2G1vt0vLDXbf558/OFTpmrKZZXkAqYbqRouHLUvnqq+DKV9/sqk6Xpo51JIDJ8DXyq/e+VzPYpG21NAtgq/DF+/zDn/7V8OdCWSCAeStfPAn1zn33O9Uhosyq1yqAF2feKWVrJrm+zHP75JT/60/+NvQh7MgU3CxMWTZ+B0Wealk//cd/O+ztudQKmLWK5a0eRVpsq+pXf9y0F0Zy3ZhlWo730+z+kz8b9st5hSrg9OxC9TJU0coRt0JOTh3s2pNdWn4YTh0Zb3jcRi+E5HZNs/A1ejHU377R/e+lblBUoUtxH/z0h0PzCzp1ZLwa2k5XaBUwh2R1SGq2z5asCmmVr9MnLj6+rPuBMXzx+ebZR8zyXM7MnA33l++agotswyQ/V0FrjYJ2ZuZsSH4eRQvOwP5VeYY5fIUrYKNqWP+qHvbK5kXbpQD2W5tuZz1V9LHGYwpZl1owu4MrfF2egrO3nO59hLH9EBR7rMIHAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdMaIX0FvnL48t5P2s09vXBsRQDoWvHvXrzS9zRtvnBia8/KaSPRnSJtVSBWQwi23VfWLpmcXqu04LYx7oVULYBe8evUodzVbXF0L81dvhmah3Qut+nXx6L/wRcdPTGSqqoNcCVXAHg8c0frLzV3fm9y3v2WVDCGE+as3BzaEhpA+0Spse5UW3GHTswuZB4+sIYyVTwBpujYLIYRbf7lUba9lVLm9FD4B7FDwsla8tICNj46FEEK4ePTtluGLtx1U1oAlayd8UWV7yxqQ9Laa1M702aydVra3qj9vVuViWAd1S0YA261s16/sFNkQzrOWa1URa/YLL8/tDFIIBbBA1St6u0758Cc/qPl6PoSBCaEANglV1vVcns3myX3799wkawjpUeUrYunx04GfXMvkUlwbla8Tw0cZ4psYyhyYBLDPApgWoktTx/oikGmPo9/eQaMFl9hGx0fHwp1nz8OdZ8/79rG38+4cQ0iPZalU7751oGFgk+qvcFyaOpa5Ct5aWa/+/dSR8RBCCCenDmauwoura+F0H23VqIAlarRft7i6FirbWzV/kmFbXF0r3IIfPKmEB08qhV5A/fKWfwHsUcVsJ3h5rL/cDOsvN2uO9dHH72vB/TqAhBCqa7jYTu88ex42Nl/kGjjq225WyRbbyoVzkz2ZsgWw5EV5/ABQI8mBYnx0bKjeKCCAXap4adsuaVWs1SK/k+Z//P2G7yssctx+eAODFpxTo/CVFbo87bfM4/dyKhbAHOq3T8qUNXyx+iU/xFRkaVA/iPzyxjUVsFstt5ksw0O7FSdvpbs4807qseOGeHJjfGn5Ye7BpVdVcKi2Ye5dvxKOn5io/qlf+xWdXLvRZtOUORT1Ym9waK4Fp12Ciq3s9hdf7qok7Z7sMsKWVrHqJdtws+M2u7/4JoZuVsI9H8BWby5Yevy0JlhpAWwUvrKrWdHwFX0c8VJe0n/+8b+uBnCor4TEljs+OlYNXmV7q2YN1Ww91egEdrtdt/MiqL+Ml+eyniEkh9hmV776Jns460KYVo1OHRnv6InrdJXtReiGLoAXfrMYfv/bD1Nba6crDUM+hMTp7szM2ZptjVjZOhGu+8t3q8frB/eX72a6Xbe3YoZmCj59eW6nW4FodLKPn5gIbx472tcB7MU+4FC9JT/PPleewCRPbtpJPP/HazufP9qo+V6nXhD1Yevnj2gO1RTc6RPR7P5v/25upBfPs98/H+xDSW1WzHZPcNlXH4bpv3gAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAveJborDEz0Vto1AAAAAASUVORK5CYII=","x":0,"y":0,"w":160,"h":346,"m":700},"clouds_small":{"src":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAKAAAAFaCAYAAACZsVbmAAAD/ElEQVR42u3Yv2ucdRwH8M+VaEwwIjfEQUHjEBEaxcXRTLVLxcG6FAIlW9JMQuoQcZEsDTjlxxYtQZd2KXSJk9E/QDABIVLOYEvpDVkilx4UHody4e5yP55c75rmntcLDu7u+XF3z/Pm8/l8LwIAAAAAAAAAAAAAAAAAzopcP/+48en5pN0+u+tLOTEQwJ6Eb3ttNtW+g4NjQnhKBrJQ5dKcQyUUwJ5WuXpb+wctgyyQAti1KlcftnrLi1MxmR+peW8iIhFEM2BN+Kqr3cTMarSqfu1C18hkfuTouLmFDdUwywHspL12Ero05hY2hDDrM+D9x4c1r++Vnpzo+JXNnZrX1y6ed/cFsLVLN25HRMTd65fjrVeGYuHX7WP7fPrBO8eCVh+u+vCdtPqR4RnwwndLyYcfv9dw298P/3su3+HO1Svab1YDWAnhXqF4Kp9t9gMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAOpdzCWqNT88nrbbvri+5Zl004BLU2l6bbbl9IiIRwu455xKkr34n3Q8VsK1yuZBcunE7IiL2CsW2+3/19WcREfG9SiiA3ap4d69fbrvv1v5Bw+OFUAtGBTxbc13aqtWo6r372usREbG8OBUREXMRHZ+fPg9guVxImq1kWx13//Fh3Cs9SfUZlSBO5keslLXg9uHrherwVUJppZxOLuvBa9RmOwnfrQePIiJidGj4aWte2NCOsxbA8en5pNkfyZWgFQ9L8eWbb3QlfBXFw1LD92/+9HvsFYpCmOVFSHV1QgB77od//j16/upLL58okKNDw7GyudPy/Ncunk/9XdL8sa0F95n64f/9Tz461e/z129/aMFZWgW/aDdb+DJWAdtVROEDAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAPpHrp9+zPj0fNLo/d31pZxbLYA9VS4XkmbbBgfHBPAFda7fw1fZ/svDPxO3WwC73nKbtd1qW/sHLVs0p2fgrM53lblue222YeAm8yNHwWt2HrOhAKZWHbSJmdWm1awSukbhq3h7bPTpOcuFxHxoEfLMM167wFWbzI/UvJ6YWVUJzYDN226a8J3ErQePah5mQwHs2Nb+wdGjU99+84UQmgGfvbW2UzwsHT0fHRo+9h4C2NDcwkYsL07FyuaOu2URcjo+//HnnrfHO1evWIgIYOsFSa/ObRUMAAAAAAAAAAAAAAAAAAAAAAAAAGTZ/+vzW8uDqmdKAAAAAElFTkSuQmCC","x":0,"y":0,"w":160,"h":346,"m":700},"sun_moon":{"src":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYAAADgdz34AAACDElEQVR42q2Wv27aUBTGf1AUJMxwXaZEbTLWiBe4T2Cp6hrRN2AkLlO3iBdIKWOkPEBp1ix+Ai8dq7K2zZ8psYcYYVBEF1/LvvFNoOFIVxdb9ved7/M59wBrRhCNnLL9RZEDcw27s03wvmF3XwLeB+i6+6uytQ5JpQxcCm8aRKP+SffkK8Dxl4+lLw8/fQNg4v+pBNHIlcLznyTQwQ97kk77gIZlF16axSENy2YWh/z89Zvz08BIUjOBq6x18Py9hmXTaQM9AFZSeI9Iak+Bq9ipW4XrRRJnSgA67QMjSRUgBXel8MZ6pgq8Xreype41LDtTs7fbUk70pfB8VSivVBVI4fldd3+VtyYPXvC1tgPAw8MSgOVyzny+4O27Fmefv78/+zEMpfAugmjkVFN7fFVym0ReiS2amQopvHGa9LRaZo/+YZMkJkl9V9fP9FFmU6mCWRwyi0Oiu0uiu0sj0SKJs2fzsZEC8frNowwXOZKGZRNG94TR/WYKVIUskrgAqH7rpQpwfXNrVOBI4Y0Hk8GRan9dtk5UZk1ZR5f2gZJ8dfU3A9KXHip7vQ/0syjrh/7xBwBs0SytlLzn1ze3nJ8GDCaDo9QeRwpvajpNM5LDnmRvt4UtmgVAPXMTeOGwy5WYn5JUgBWAUqPHeHgBYAR/rlmySWYaONpkc/5nsq01Lrc9m7c3+Lfxl+Uf9z3sRb8QTp8AAAAASUVORK5CYII=","x":131,"y":65,"w":24,"h":24,"m":700}},"far":"data:image/png;base64,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","farW":160,"farH":102,"farFill":"#295e70","farY0":244,"near":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAKAAAABjCAYAAAAcsws3AAAUWklEQVR42u2dbWxU15mA3ztCYyNcN6E2JrY3tiVsPgKOgu2tUJYPU6U1tZaquOQHKqvK7Q/XiWpUrZSuRGCToH6sKgSr4PIj8Y9klR8Es1pXWayyAdyoQottVthOwB+SY2oc/LGAyCDsEfLdH+P3+D3vPefec2euibc9rzTyeObMnXvPec77dc59x4FlInk5xa5Ju5nEuANW/mJkxXIBrvVSlfT+yBdz4vm6Z7LEa8cPgGthXP7ip1DouH0lA9j47h638/QsAACcaM31gLfumSwJQIQQ30N5ueY/LIDLUM50fy/QmuHYOUtNPddSje/uEW3qKuMSdH4AcrEgLl+tx62ZTt75OBadCf5lR50HvuMHBqCwptad6L7k4AmOT2cDAMCuTY8kyPhzDqSqHb1wBH3zT1Oz70ijBdNUvv3r77sAABNj8573Bn5n1odU63X2JVNKIj/10uXPVnraF+fPQnF+RD7gt3/9fXdkelZ8IcrPP9gMb781B4U1tW7yxnDgcShoQcLBxE7ctemReP1M9/dcC2EweD/51ry2TdvV3S4AQGfvRcfU5I5PZ0Nx/iyMTDuACodLR0s/rD1YlbkJxosozp+VvmzXpkcwMr14+Ks9cfG8sCQmZoFqpmCH4EyibRAu+h7Vqhzkdz6OwR9+8e8WwjT8NJ3fxl0qqnhwDFXaFMf+2rFu4Z5lNDBo7ihUKinOn5UARPnb6qQEkO6zkpZcuFjd7EIIueq3EAbDp3Jv6GQ+1PwA0J3i/vzVnriHAYTwzvu92rggFtVF6Yjn2i+scMhGph1f1R6kqS18XvhGvpjTBn3vfBwLxQDlgAM5kxh3eFBq7APS1InOlIaFb/G9eUjcSj2v2P5YOp4KtIvncgAAIOfZpOdcLn+2knTCvK925lH7X3peUZWlaK7tFf66X7S6a9MjePX1LDh+IHWMrYdrYHxarXzo/3fe7/XtVycMgOloL51mTNyKSwBRk+wxA8TscngLS2LiOwpLYpIJ/uB8lsf3mEmMO7p0wXILWJ5rPCT1+adtJ5wo4aNC+4Jrw8ufrZSUQkdLP2w9XONr/ajZ9QNwxVLCR6EKMsM6+PwENRtCSOHDVMybbXIn+eWq8L3loAk5fPy1MDBiiuz4gQFtm/KjawEAYPiNO0q/mk5+P9eL+3tB8DsmM4fSjl+aDjAqR9XPfIcRGomp0jkYNXe09EvmRtW2ubb3K4NQBZ5OTCCkgaI7VwYAAJNnzkLOzm2yReq6Iv2/9+QWrS9+7Vg3rD0oT+C7PQ/Ec7665SdGGjAowDD1BQtLYlK6Bttj3mipZOSLOairTIG2zsfXoaDS5PZyE1PtR+GjUvDyD+Dh5G3PawgnTlQEEceLcoA+e3JqxgMdmnCTvK4RgPhlElAKQIvzzTpQFWRECSFCVFcZ164p87Z89uMAPCntZgpVJn4glVUFRQI2AICEYRYCJTk1A/E1eRBfkycgNEnrcMtjZILp/6i6eQSKEFLTjFDRgIFrPpSB9vupWdvwFAAADH2ywvM9Kn9RWtpjfgpNXnf2JcXasyqJzQUDlidtVsPA5+cTPtd4yHWyRiXfLL6xHFQrUtzFunasW4wzwrW54SmYGEtlKxJdVyC+sRwAAFZX53rGlq+I4bjw1zPOAxaWxLQpDhzYi+dylBo0E0Ggw+YCl7tPl8lx6f/4HH0+P1GlXziQ3PwifGH8cxV8Wg1ItZ7qZIY+WQEV2x8H+okUPGyPmo1qN3Rg42vytBeBbRF4mnqh5wUAsHtfItCkI8R0NQaXiKKKhJcKPhMtid/NNSPPAkibQFiCn48pDTQAAF59PUuYUswnqqA+fmBAm2d0dB3nZI1qtRsHUGcuTTUfqnkEEP0L7m8kp2aEyudO8OaGpzwAUnN/8VyOOGfd0mBQ0nS5wxfkJ9JVEA6ezu+jEN7teQB1TdlKbUYDDgqjn7Y9fmDAa4JNOm5VQZFxsGIi6MyqoOQObuJWXPk96EPyDhyfzhYrJ1EkbP8/SKbwD7Tfl/ozXYlvLBcPBG7dMymtiTlJh3c8huMAAEUVY9IBbw+VLKrOBQeXwqAyqSrtpvo/DKwcUv4e1cQqWLk7oAp0TPfBmQCgM4tRaMlP2044quNwLajar4lQ8LwfX3LlZjcoskUtiODR/aC+aRgKHwIn54vo87gYPBxk/IvgUUA4LCbgVc470BdzPYDpPouv350C6Ty4dqV+KJ63CsKoTWFUKRS/71HB+MuOOjdolzmFDiPl+MZy3zQLj3TXPbP4f+ulKjjU/ACe3vI8PL3leffTthOOyr2JAQCU1u93OXwPJ297kpVh4AmjyYIgNNnMauJjhhFdEtcUiKWCzVTb+gldkvt5QGKejxU3oar8K8qJ1lzBUWn9flcbhPA3VxUUKeGjA6kCKMxAm5jgyvlUX/YMDilD/+SN4VApgSDoqRa82yPvfVvu6RkdeLpbJVQpFZzofJnO45cvtKPw0lwfjYz5sT7/6EPpPGMqu3yv/3okJtRP+IlQ6PDBYZvovuTgQ9lBAZoSr+nzjz508Dm9zqjzlWHhQ83JNWi6GlXn99EAIWgi8v6tnHegen2FB+R0rz2yDalBQFKgECAdhCbCIcTjm5pr+nmqGXVR9nLQfH4QhjmuzpoAgNhkEOQTUwhpGmdk2tH6mpg9oee6YiYx7kDXFfFCzs5t0uCgeZ7ovuQU1tS6WpM1lbqImcS41I6Ch++rQCisqXW51qOicmBnEuNO3XyFSzulZ3BIOjY9Fw4tvo87QXSmZynhC6vZ0o2gUVvl7NwG8TVfU1oiz7LrwvjihJxJjDs9g+AifNjfHS39nt0zQbfVSlEwHdyZjz7UmkpPOF1d5atd6qp2P9Gcmrhzq3s8UGPy16kfnOi6Evl2LB0wzzUecoMgVLUxAfHyZyvFHkk+uZJTM1Kf5OUUu6j9VFmBIGtFIRyZdkSyGrWeLqCNwTIRP+2nE1PATYKJTNyBTM3uc42H3KVaOTl+YMDYV9O5Hn7mGLUhQmgqaJnSui8Yt7UfaUxFOq2XqgAac+HlGllrdPZedCgkqZOtcPk9piYgcfNAL1zSfmnARyEsrd+v3AeoW1sNahMGLL/gJB2TfO1Yt5TbRS0UdrKZJOUX+2yLdJsm1Xz4nK6kRaYBdXdPqcCoq9rthjHP1OfAhwl8UUXnqp0mJm2e5HqwDlKaz11VUOQLH2q6VQVFYidNOitCGJTo3BgKpRbA0vr9Lj6WqtPycopd07VXDp2IrBp/6GvWMjVvQfdmmLb5KiJnGu0+nLwdGPC4c2XSFi5T+FRjgxDqgE/eGIaGU22u43fBlFR+oLycYhe39BxqfqCMcAEAGk61pY7V9m8ZDULP4JAU5e78zZueNjd7+zJKZUQ18BuqKo3OZ0NVpWiDn1F9jr6H0v5KY+B1FNbUuphiCjK7NAhBCFV9hQrDzwo1vrvHbfvxeYcrNMnf7LoCO3/zplcDqlZFVhUUGQ0G12YIH2oqnbYygQ8AoC/m+iZQlwIqVWI4KsARLhVgUVzPRPclhy8oBAUhiVtxuNd/XXsdOrNKXSoOHwBA1Xf36NMwfjb64eRt4TTyVAVX99t+dBAAwHeAVzX+ELpeO+JrVnWycHylmGi/sKmPdH2w9lcanYZTba5OE3LgVFrQT9pfaXR0fqnqukwDMRxnE2BLy9anNOvoIJSWrYeznb8HnfXjzNCUUIz7S0GOLA88MPhQrbMiaFxU5jMTCQOfKvXBO4pqPlP4MvH5TMG72dsHN3v7fCcHf88UvnTzngiiygLqxp0qrxg/YTS5YRxcChx9+EEYFXTpwKeapSoI/UyySuPQvjTx0UwnUthrTHcy4F1y2350EBpOtbn4UGYLRge1/en3Oa58tDOX3rInherkbim8g22g/b5YS6QVB5pre0Ueis/yrteOGJtg9AH5lrEohJtJE62nM3nY6Qgf/p/pJFmK9Ixq0qGy4JDQyRQUVPYMDoWycCuCwOMlLJprrwgNiPcLJG8MK9r1Sjc7UwBNtCJGvenIN18chP/+03pjM0d9sA1VbS52uEny2c83+yrBC/J3VRpKB07DqVSf0M/g+PyqoBzON43BrffKtFoxFIBBZStaL1VBc21vSuNVywVtVO0RaD4YJnBFDeFSmzA/QR+aO/hPb3le+5l7/deN2wZdTyaRtg7YXxWUe/xBuhnExNUQM3byzFkBF5W9J7d4qlPVVcZFu7UHq+DAnjllEhKlo6VfMp+TZ876gtUzOAT/eLIZAAB+29LqMf88alNJUcWYdA9LUK4tCjPud9x7/de1NVPe+F2ZZ9KqiidRq7LUAU+QdL12BC7sqId/mhwOZYZ5/8T8/D0/0W3lVlVR2ntyC3zzxXDq+TvtY/Cd9rGMOonfVLXUEgT1oeYHohgk3a509Kejy+Ycw4gKvrDfLWrl0WpHtIoSBY7euIzbfD44nyVpQCyLq7opvKOlP9CkcrUOAPDSHz9SakDUgjRXaWIGg7TnUgg1wXVN2cKSqLQbBxKtTc7ObZGet04bUlB0bXgQueNoHG69l+IGc4KoBf2gd0rr97ummXKMeilgHEgA/63afgCq4OMg6jaNmg7Mw8nbUPXdPdD7n+fFa8mpmbT9K1Oh/hxmDOgmTiz6+JNvzQvtyPtRNwGjhFAFi6oNKiduCW+9VyYANHEXQu2G2bXpkXhQ+MJIX8yVbrXkqZZ0JDk143HYdcIHLIo7/MLAF6U8KS2uglIH1+ejg6ECxxUAoKxKgGaCgvbB+Xk40ogRMkBzbbevP4h1ZfAue+l77vxvJJ2DWfULO+rBb6X54ItryH93AEOtnzW9JF7919MXMoo2ETZ+Xwrfrn7xHGqyhKjasPfkFqirTKW13n5rTuq/RQvzpdCKKZdp1KgAURQ+oa7dH99Iai1dz5mzSlDp9rCYSptQ+NDcosnFkrc0WuamIr6xXPIp0XTzu9AyETzOhR31cGFHvfBZ+bJhUcUYFFWMwcXpbunzTftegKZ9L2jNNB5Dt5XcRNNtPVwDWw/XQOfpxZJl49PZULH9MfzLP6cGrmL7Y6jY/hg6Wvqhsy+ZKiPX5LUs6Fvzya46v3v9133v645aSsvWQ2nZethxNA47jsZ9+3PyzFnIeTYJOc8mwckaDWeCsZKUrvgMnb0AcmEb6j8upfBNEpkIak2+OUM1uBQ+Xr5W5FXzXWUVMazKRbe0v/p6lqfmNYXQ73dZnpRrgfABADz7D6NKLUgDWXxOq2w5fPvV7n2LtTKv9sSlYpDYQbgOrLu5HGGbGJuXOsqv4E3yxrDQZH5BCBZZ9GuLUTNX/5iW2Z1fI2nE3flyCbr3/zQl4EOzrKpJg6b6Xv91iK/JEzVnEDL60xN8UmK/Uujw2mjulYLHBfsTz4NPCu4j8mVHuh/RNHvAJ3uQv8d9+62Ha8TS7dqDVbIG5PDxFAqFb3V1rlCluo6h8OHvTOjgexLCE9Mm8rOmlwR8uFGDVvOig6Orpc1r0YSRt9+aU05c+hqa3CD5evaH8OWXv0/b3cnUhUKfFsf7bs+DxaU4Ch+Vqz1xUXo/zEZQNCvcZ6EQ4sy+dkzWXFy74euZbESlEL4/NAUAJUILdM9y0wsef/G3La2wSlE/R6RIFibixNi8ZGIQVIRTvFed7dF+dLLzfqPFM7G9X6kRrv3oQgBagpvMk+KrRyJ3uaCVUTpPz3ogxMyG6u5GGkzhdeD1ChOMAGLEq4xcifnZW7JBvPZJbpZvqkGn+WjSmldnQgjR7IYx1xRYev50ULBzcacuNUU0Yu6eXSs2T/gNOh+Q1dW5noqi9LXkjWH4Qd3fL/pSe/4GABaXHuMby2F1da6Y/Lg0ySN21fmo0jM4PpsbnpIg05Xgo5ML/WqsmI8BKZ1APKeJpnl+/9elCciVWQxn7/h0tlFeL6jAjyqFQQMTHl2biGklLa4hwojKhHXPpn68ha5rpmN+cLJyIDl8AOqNoRw+nj4Kc01B8KkCLEyA8/t+eXqJKrCewSEBn584pfX7XV4VCqtO8YHHmXWv/7qkAQEAOsZuCgCxeCXtcF1FJVWlfHRQcbbk7Nwm9h/y2Uc1IWo+FYA6iOmd+0GJXRwwbh2kIk4L5w4A8HfThZ5jYD9RMCmAVAvq4KNy+tz/LEnyWmXRVCs4aJJplgPNLDW91GelbWM0WtPN0CDBTl1dnQv0pwHooOPNRHinvmq5jqdqRKmIrivSex0t/R7AKHxbD9dEnvah2oLmNUM79DeGYW/JBmkCf37+z1Ibapovt/6XeKikad8LkeVWMVUyeeasJzDE3OTWwzWBFRAw/0mBxNredFwG2u8vBiFSqV3NeivVEh1jNz1aMKyoimGvrs6FOzf0Tix33OunhxR17R5LnZZafYgGviDfT5cDDBIOoZhg8+o2VGuKiqYBrkqYpTv8ftqHql9MGJ/Ohs0N2TDQfl856WnwhBBKJphXvDLxt2in7y3ZIDRgfE2ep0607svxfXrSnkiRaZyB9vvaGtFo+mjqpzh/VmxKRZNicn2qYKVi+2OpZDF1R/g1Jm7FoW6l/D24QE+1m4lVoZO889GM57gAi/dnYCHPdECkfp9Km9Y1Zfv+sJDKxJr8dEcsDGwmZidsfb10q7F7CpRjQeyFix5ovw+dp2fhXv91cLJGBRxhTJVfbi1oqavzkdn3dD6aMW77JETXP36Fy8OwQN2FibF5rwbMVHSrI+lWxVcd3+QYfuV704mqVVoxzHWalr9V/T4Kfj9q28p5B26u/YbRMcJowSh37ZiWcF425dms/HWKBdCKBdCKBdCKFQugFQugFSsWQCsWQCtWLIBWLIBWrFgArVgArVixAFqxAFqxYgG0YgG0YsUCaMUCaMWKBdCKBdCKFQugFQugFSsWQCsWQCtWLIBWLIBWrFgArVgArVixAFqxAFqxYgG0YgG0YsUCaMUCaMUCaMWKBdCKBdCKFQugFQugFSsWQCt/JfJ/8iCzs+DYGnwAAAAASUVORK5CYII=","nearW":160,"nearH":99,"nearFill":"#1a3541","nearY0":247,"floor":"data:image/png;base64,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","floorW":160,"floorH":67,"floorFill":"#3a1d29","floorRow":0},"ice":{"L":{"aurora":{"src":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAKAAAAAmCAYAAABDJpDoAAAFsElEQVR42u2aT2gbRxTG37Qm0jpxbRQZxwlqKxAtxMQlxZhCLy3tpT340IsPPQVKLwX3kpMvJRffbfDN4JMhvfSQQH1JaS6GHkKgFS40BNLYB8fINXadSEkg3R7Utx2N58+b3ZnVStoPhFa7O6vVzG+/996MGOTyqvmtzdDl9b7/8DPWT/3DckSyCxsFwvmtzbCXocwBTKC5H+6GAADBRCsz99RrMOYAWrhbaz+IPiN0rf0gUwD2GpCv5WjZh1YROB7MQU0LcgdMYcBkDthrypoj5g5ooWCiFb3yQil3wL4sIgbNFdkgwXbri48YD17ScFooj3m/7xcHRwAAMFqZgeeth6Rzk6i1HwD2UyoAoiX32wSnyu1UoTWrAAIAFIMaAEBqAAJAahAyXU7Qq1DqYOOBw87WAchDphpgsQoWrz82VYja8tdDsEySgce3xePFoHbqXNn3xgHVFwtDg+R0lGkT8VihDHC0/QLR0k/B1KsAVx6199Wr8MFfZ9r77wL8cv5lu8N3jwEA4KQyCheu2TlgnONpubQXB9SSu34JNtamGQDAl1/9FuJ2N8Hyqnq1jeCnv7fBu3PZ2AQB3G42IuhGOAApunBtONFty9zTV6iOsyyYaBpmfmszjAMwD1PXwSKAN/Jjqb195RG07lyGofVLpKboeqKo8AEAPFlvOv9JhfKYM2fE8YtrZMzlvJBpRUBVhVKLAdX1g4mWk9UIBE10qmj788M2kLvHVhDZnu/LGflcEXW8e68jVCd1RyoDCC3L+lKNS4mdIwPO1qGyIteh2kWY1hU0yN1grYTUq+0nsF6NcjqErReh8x2qfYk3Pfb1TiNM+wnwLT6/Obp5URoS+wE6n2E6LQ4iAKk3ETdXKJTHyG1k5+qS5mJQgyf3tjuq1aR5mey4j1yuV8I05opxxtO6CuaT1GJQg9HKjLX7yIDhqy9VJWZbnVEnc+NUonxeqNs3CBLHzqsD2j4VvCu6nviUAYYOLQuvsapfISTzTkdxQlMBIwv51Gv4dt3S2+fgzMf/JLqG6I5WDvjGr2djNx6tzHQAlwS+YlCLXvxnmY5uXnQGn87hcNu0Tzvt8N1bLM494Kvfxa7fbnY44N/vPfP+pc9bD42h00dVJ3M6cRpGPEbR7FV13vntNyOnAFxePSFFHWw7d+NxmGYu6nJKh1+flkXIUwDK5BvKtKYQKACKn/nlRhNsMj374yksrkwaXXB59SRE4JZXT0JVO7wPGYC49KdagekWkFYOKNPBoXqFIm7+8PLn/+ufwz+fOvtB4vqrztVk+6eGxwEAYHFlkvFr3FTXEuFzIRPAczceh9EfH/777bL8MgurMaJI/4YplwIlhDxIPoDqhnDAZ69WYZYAnizMopYW9ryvNPHwJan6uxG5SA4ouqAOyDQB1OVp6GToBrJzcVCwULB1OR14rmAU3W9pYS9cXJlk+G5yxqwvMZIBtA3NvkB0URliHicCZAOgLXwUIE1AyQA2tcHf9NPBobFfuwEoEzt9983XISmQ5ZL8HxEP7jecwicWCCahK5599xwZMr5/XECngopSqFAdlL8W3j/eu9hXsoIsTTgZ9amPC2Zl51XUlt82gWlyuqnh8Y5CQ9TG2jQTO3tjbZotLeyFCCAFKL46zYooICKEslCtar/dbET9ZircXGmIL/2pILnWO++Pw4P7DfikXDKGChlYsnP4d15U93Ptevyg80CIgKgckZLzqb6P2pbyr3a+4HEx3UPOgcSBwNyxsvNK65p4XAavrq0rAGwHLq5MTmm6D9XxuPfvq/qWRR2ZW8qWL8Xi8BSANmHn+u1mKAOIb6cCmgczLQcaNMmc1AWUurSHAqaYOrGkT70NKDb5lO/kP0ugpOHQfAGCLuTLFfk0SXQ88Tw2SIOdyy5cqx4M3XSQrcvmsOUiF0zUoioHMFeqjpgrl3cgfVXV/wJFnbUu5EboNwAAAABJRU5ErkJggg==","x":0,"y":45,"w":160,"h":38,"m":700},"clouds_big":{"src":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAKAAAAFaCAYAAACZsVbmAAAJwElEQVR42u3bz2ucdR4H8O9MkmkjjS2RgKELtmG3lLotCoJV8bALCnsW9OBpoX+AB69Slr16EM/CnjxY8FyssB6K2xZklcqWUqW2sGGEYEgz2SadTObZw/SZPPPM88w8M5lMk+b1gmIymXl+vufz+X6/M4YAAAAAAAAAAAAA7Helg3jSja2tqN9zJicmSuKx+8rCt7PnoQKG3QzU3//1KIQQwt/efEZFFMDxBO/rX5shhBDeer6sLWvB4wvfrbUo3FqLwvEj2Tn7dqmhLauAow/f0mbrqUutbhvOZATwxvL25t6Ym1QJBXB8k4hk+IRwtCb38sF9/N1G+87X1lvjspnp1qjhw1cOl55U+HjKK2DRAN1Yjroq0bDhSwbt1dlSzwBeuV1v/2x2/BRNQhpbW9GgAUpODD7/uT7SclWk+l28+lCJfBoq4KDBi8MxU9l+7MelVpt+7+TEQOFamAkdk5CkWr3z99VUxq/f3WxXwXjIMH9s+339/u8rKuReD+Ag4etXleL2+fWvza51vLzg9gtd2mo9Cs8+ztVqPcrcT3KGPX/YhGVftOBx6RW+5N9nKp3/elXCvPCFEMLNB9YP92wFHLb15lW+vOf2Ct3cofwWHPvyZqssnl+Y6ni8V/W7tdZ9rOeOqoZ7qgJ+8v3mjsL36mwpM3zJv81UWm01r7UuPWr96/WcUVhcUwjTxroOWN1otaK5qVJH+NKVIv4kouh4bxStNxm8+Ofkckty0pGugsNWXsbUgj//uR71m5neWovaNz45yB80fLfWosyP0tIhz6pGy+udj92pNto/n5rvfK/OTpfarzk7V+4I7kwlf/vf/PthCCGEz949phXvdgWMx3df/LLV97nxEkp8Y3dS9fJCmNxXv/0kw5e3tBN/a6ZItUuH+8KllUgId7ECFp1cxDPFpH/+t/PGnjhaHrjdptv3aj3qCkEy8NfvZo9FP3r9UM/t33vQO8zJff75d+Wuyc5Bn5SUnmT4km0xnonG4Ts7V24/Fo8Z80IQV56sCURyuWR5PQrVle1wx58v53nnXKVjTJo85nhf9x40w51qo/0Zddr8sXJ47+RE5ow4hBA+/WrtQLfkkbfgC5dWokEqUxyeeBZ64mi5q5UtbUbtEKYDkBe8dPjialdd6R+8vJaedexn58rhTjV/m7X1ZggnJ8KZI6XMY//rn46Ef3yzZgw4KqcXDvddOsmafSZb2Wo9hJee6ywI8Tjy7Fy551LJvQfNzPFcXoXqCNR0uf0x2omjnfvJOo9avdgsNyt4WW/cg1gFR74OmKwERT7MX61H7UqVnPn+8Fv2a6/81Mh8/Nr9Rrh2vzHQ8eU5cbT4ZSmybpheX0we57X7ja43rQq4Q8nZYXo5Jb74r70w2bXOduJoZznJC2GvoMVjvHTQigSvtt4MtfVm13Gkx5hZ64O9xM9PVuHkOQw6JDAJ6ePy4mb05bf/C8fnKx3tbZALfn5hqj0zPb8w1Z5NJicRg1bkYaRb96i3d/vuRjg+Xzmw3yvctZO+cGkl2kkA007NT7bX5oqM50YZmlEFLnkcM9PlcPvuxoGeAe9qAIvOjJMhHcZidbB2uNP9jfr4Dvpi9NhOPiuEyYtf9JvFyVZ18erDaNAAfvbusVJ6X3GV2o1K2ev4fBKyR/+fkF4Vc1Q3rd965bCECgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAgkouwd7y8XcbUa+/f/jK4ZIAMnKNra2o6HMnJyaemvtWduuffPAGCV/8msuLm9HTcP4q4D6oeLGlx5n74bfWf/9T3dr37VkA91n4lh61fq/VQ7h2vxE+eHlqX7dnAdwH4QshhFtrnS+r1UN4dba078eHkyIxPhevPhwofEs9hnlZ4Yv3MTNd3jft2CRkn5g79HSelxY8BtWNRhRCCHNTw1/upc2oPf6LnTnS2t6N5e1Kee1+Y+CJSXrtcZzVUwDH4PLiZvTSc61LPWwIbyxHYaaS/bdavfP3oiHsNR4d11jSGHCE47i/vflMz5u29CiEpUdRu3IVDV5eG44rYjqYb/9h+7b+uNQcaiLU2NqKxhFCFXCEM9gby1FYrUfhL8c7y9y3S60WvFqPwvFE+PKCmAxd2sJMdhVNz5LT4btTbVXFj14/NHDw35ib3LWcmITswvJJ8lOKy4ub0Wq9ewkl3Tbjm94rfEVbeNb2T81PFg5fWvwGUgH3QfiSAUoG79nKzi911tJLemwYB+/eg+7W+97JiYHPIWk3KqExYI6bDxrRlZ8aA08Ukp6tlHLX6wZtvb3+XqtvjwPjCcj8scGbW6/9p6u4FrxHKl7R1jlshetltR61g3Hlp0bo94b54petocOfHlpowWMOXjzIz1p7G1WgBgnDldv1zMdnpsvh/T9Odo0Xv/hlK1RXmuGDl6fa24+r5pkjpb77jIN+/e5m39m+FjyGqjfqwCVfu1qPhhoz9ppknJ0rh+pKM3zy/WZ47YXJ3DXFLPF4cnZ69PVKBewRvmTVy/oywCDhK1LVssZZcRDzKl6RpZXkscdtOl4rrNX7By8WB/Ct57tHbsOuGR74AF68+jDKu4FZoUnflJ3OLHsF8PrdzTAz3brZtfXO/b59utLVRpNvmGRVzVoj/PJmvWM7eZLbzzuv+M0xTGs+8C34nXOVocIyisD1Cl670q43e742rmDxckytvr3v5DGkW+7MdDnU1pvhyu163xD2O7e3T1d6VmgVsM/Mrsh4Kz0OWl5v3YTqSrOjpfVra0UnE0Wcmm/t88TRclfQso5hptKqfMmqen5hKne8GR/bO+cqfc8p3u+nX62Fz949VjhXlmEyljTS4rW15CB8droUZqdL4cX5ifDi/MQTPfbklw/iMV7WJCNuu/2qavqNEb+uXyX+9Ks1FXBQFy6tRKcXDmdf1Mc3Kq4YyaqR5/iRUt/1uCIBKCp5bEX2F1fNtPiz4mH2l9z+YrU+UAU0C37s4+82ott3N1ohmq90XNA4oHmBLHKzRhm6QQM4iv3HY8b0PtPXbNCJiAAmKmG/5xyfr4wlVOOohMNuu7beDIvV7JY8SOUTwBEFNFktdyrvxg6yz15BHCSARY5lmMCZhAxpFBd7HGrrzdygFW3X47weKuAYW/i4wr2TY9lPbzYAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA2JP+DxFm0rQIQmnYAAAAAElFTkSuQmCC","x":0,"y":0,"w":160,"h":346,"m":700},"clouds_small":{"src":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAKAAAAFaCAYAAACZsVbmAAAEcUlEQVR42u3ZPUtkVxwH4P91xlmVVcQgROwkxZJtEggkZLFMsV/AJq1FyhRpg9jnI9imiGC9ECGNyO5CCiHJkspkIaIgilnfwrzdFJPRO+PMODpqdp3ngcVx773nDnN//s45GgEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABA/0h8BP3r2VYpjYgYK5zH4MlkPhFAbl25UknbHcvncneWiwGPQviare+WUw3InQcvIuLl/vkpz1+X45tPhm41IxoQmxBur+Wy67lWDbi6U23YhGT9+HsxIiK+/fzBra0RBbAPpth8Lpe0O9YpgJ9OJLe+Scl7bPd/fdd8LLvOaxe+y+61ulONp9ODPQdRA77jFtZO0uYp8tVRLWCHxYg//66e/f/EcNJV8GZGa1839hozPf2wds3kg/NjK+vHsTQ3fu0cacB76LAYLUPXrY29ND567/Lr9k97/22NAN4DqzvVK53/YrPU8fhnM4MX2i8i4pfd6o2/d1PwPZmG7/qeW9u1mu1l+hVAQbyWxdkRu2BaB2N++SD1SQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA74bkpgcsVyppu2P5XC7xkZM1cFfhg1ttwG7C98MflbPXX35Q0IbcTAN2E77VnWpMDCcxMSx3ZJZl1w1ZfT3XLnyrO9WW44wVkhjLlF/2emtEU3DPAXy535jHN8W0IXwREc9flyMi4uuPB21SBPBmNhbNwesUwIiI0cL5OR8+TBrGeTKZF0QBvDx8rabZesiywWsVwMsIYZ+vARfWTtLdUi1Ek4PJWcO1Cla7xms2M3r+evOw8xtbWDtJF2dHhLCfNyE//VWN7YNqxwEeT+Uavl9ZP2577kpEPJoZ6uqNbW0XPZ0+0PbXMNdpn07hu6qluXHtZxNSM798cKd/4RA+AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADgrbCwdpKWK5UL/+aXD1KfTv9I/o+bliuVtiFb3alGRMTT6cHE47n/Bt6m8LU7/6rXoAEbwpbP5ZJOAay3XrMv3r/485EdCw3YVdN1M+V269lWSRveI/m7mmKv0nytzhkrJC3H2i2lMTWU14qm4O5Clg1SKzOjta8be+2Lrj4172bKUAhNwV15U+x9Bt0tpQ3h+/7Xcnz38z+m5n5uwHr7vTqq5WDr6PI8NG8y6m25f9p47cTwxbeZbdJ6qFfWj2NpblwT9uMa8KuVw4iImJ4qxOjwxWJ9PJU7e/1is/Rf0C7evlXYVtaPY3qqcPZ98/iHp1VP0hTcGIjmUPy2XbmRsbPha3Uf+ngTEhHR/Ke0enNtbRcjIuLRzFBPzVUfp5mpVwC7srB2kja3WLcWZ0eEzBrwZqZoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAOjNvwrorthR0B51AAAAAElFTkSuQmCC","x":0,"y":0,"w":160,"h":346,"m":700},"snow":{"src":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAKAAAAFaCAYAAACZsVbmAAADwUlEQVR42u3dvU7rMBQA4Cap1IGBneFKTAy8CI/Bo/WlOjBV4g0YGCqR5g4ICFVLf5Lajv19S0XLAOnR8XFsn8xmAAAAMHXLVdstV2137Pdql4qYBCCQ7zDsKpBM3bfvs8pl4xrZ7vmxqU75TA3I6PoBtvvz7mcQtQaUAYk6ARGAQNlZEAAAAAAAACBV7WbbtZuttc8z2Q0DAFCeJA6IrN9/Ni6+vH2+Pt05vGISAqUF4MOtL6Uk8xT+iK9hFxkQAAAAAAAAAAAAAAAAAAAAAIBMadbNqUZvAtlvNnl/o8kkfxu1O9Zu5usHI1w1AA8Nu4ZjggRgs6irZlFX+953mTnkah1S1X+YBQMAKI32MVEoRKoLBB7TUGDmS2mBQAAWOuymMhwLwMylvkAw9xXFy0oxgsACAbN2s+1iDIEWCAAAAKBosW5JkAYrIQAAAAAAAAAAAAAAAADAQKUcV/3uD9hv2/ry9vn6dKeXHIECkLSU8oizvQfTH24FAIEz4NewC9EzIAAAAAAAAACTNtktP/Yv5sFmBATgUPYvTtdkd0TbvygDAgAAAADHLVdtt1y1UfvPuA/ITAAC5Q7DrgLJ1H2hA9L+uYKz3fPjz/7Jvz5TAzK63QDr/xwq+LLJgHZHD8uKIQNOBiSpCUh2AWh39LRk0SPa7ujL60ArISQ1GQEAAAAAAEjPVB9wbSkOAAAAAAAAAAAAoHBDN8LakAoAcN16K0VqQACA8upJNSAAAAAAAAAAAAAAAECmcjwQTRocSiKqyiVIz/q9/R5tXt4+X5/umiy/KxkQAchhD7d5/39zX3F6vobdEkwqAGPWRu1m2zWLWs0sA8YJ/NePbrZ+b7v7m+sHfK4TjqxqwFC10e79z34WprAMGLo2OnTz3XAsAwbRLOpqX6AJPoLXgIZeorIWDgAAAABwGUtKhUh1m7+1YAQgYaW0zd+G1EKkus1fBgQAKI/7gJGV1IbDJAQByGFTbsNx6ZEF9wEjy6ENx5CD+zIgo2a+c08PmoQwOPheP37H3L95dfLZaRmQi41xcF8NyGhCNG6CUWfBAEAUoxeNpa9tch63Ycg3AHN/xADDjX4fsKRHDGAIBgAAAAAAAAAAABJpzeEcSblsSEUA9jlHUpYkesM4RyIDAgAAAAAAAAAAAAAAAAAAAJdqN9vOVbgOHaiO6Hfuur/RsWtsWnOckfn6wYgAjDLsGo4FYBDNoq6aRV3te9/VGc/cJTiN+g+zYAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIDU/QdV247MCMB5mwAAAABJRU5ErkJggg==","x":0,"y":0,"w":160,"h":346,"m":700}},"far":"data:image/png;base64,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","farW":160,"farH":98,"farFill":"#437ed3","farY0":248,"near":"data:image/png;base64,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","nearW":160,"nearH":90,"nearFill":"#71a0cf","nearY0":256,"floor":"data:image/png;base64,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","floorW":160,"floorH":66,"floorFill":"#315f82","floorRow":-1},"lava":{"L":{"clouds_big":{"src":"data:image/png;base64,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","x":0,"y":0,"w":160,"h":346,"m":700},"clouds_small":{"src":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAKAAAAFaCAYAAACZsVbmAAAEuElEQVR42u3dv2uUdxzA8U+q4A2h4XJQxwROJUHoEOwUOlWwBYdOOvgH1KGlgtBF6FBwEQRLHdqpUwY3hw4Vkqk4NMgVCkZjEniOkiHS54Jygcsg6aB33O+7JHcp5l6vKX7vueeJPm++n3vikAgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAN4fY0d9wTeFR3vt1k/MXRpzOwT4v8QnRAEeWXjp4+cdj8vNz4hQgMOJr1t47Xz0zbciFODhR+x+w2veDY3m4+2Do/x810smm4k0KUealGNnJRn4+TmmAQ4rjvoIXyw8iWc3b4vQCO4c3s5KEpXtSstxaVJ+O1anxzueq3pMz9H87hw+I45wgM3hVT/nZbKZiIiWCIuFNCIipuZyBw6vk9m7t4Q4igE2f0Zrt/M1B1a/A3YLr1zajfHJUy3rGxuvIiIin59oWLv88I4I31Mn9/uG+59e33ux8ORAFysW0rZh1YfX7uuIiK26wKshRkQsrhXdxVEKMCLil9//bln76vOPIyJiafmf2tp07sOIiDj9bjQ3x1O/k3UK7nQ2EwvLq22/j4tnp9zBURzBN85fbXkaPTOZ7fm+9dJ2QzRJ+rrlmGq09a+tl7Y7nvPe0wfG76g+BfcT5qAIDQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADozq9AHaA3hUd9/braE3OX/LsLcHjxpY+fdzwuNz8jQgEOL8Bu8dVH+GLhSUREnLt2YaRjFOAAx+3OShIREZXtSs/3p0m5FuAoj2cBHiK8nZWkFlualCM3Pd7XOarxteyM0+OxvLQZlx/eGZn7clJSB48vIiKTzbxd6BBVvWIhjYiI8clTXY97dvN27Tqzd28d6xjtgId4uKjFFxGrS5sxNZfreJ7lpc3a1/n8xL6+h+McoQB7ePnTjz1/tFLd2arqd7iNjVdd33u6LuJOFpZX497TB8fyXhnBXfz25Xd7B3lfubTbc8z2stXHg4wAj7nFtWIsrhVb1i+enRpIQEn6OpL0dcv6emnbUzCtbpy/undU1zquIxcAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADgPTU2qn/xN4VHe/0cd2Lu0phMBDj08NLHzxv+nJufEaEAhxdgc3DtiFCAR7Lb9bK8tBkREV98/5nxPGAnxdddmpQjn59Qih3wYPHtrCS19cp2Zd/xtYzl6fGG12bv3rILCrB1x6sPrz6+NCnXIuoVXrm0GxER45Onaq+1Wzt37YKRPMoBdtrxmm3+9W/DTpbJZhriLBbStsFtbVdqY7hdgPXKpd345NcfhDgqAd7/9PrelSuzkZuf6bjrtRup1ZAiIqbmcg0Bbu1jVOfzEw3nioj4c/1lfP3HzyIcpYeQfh4umkOphrb17in3IJrPubC8Gmcms8oapRF84/zVrv+rcfHs1ECvt7hW7Pr6vacP7H6j/BTcb5iHITIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABg+P4D9mHEU0FmvQEAAAAASUVORK5CYII=","x":0,"y":0,"w":160,"h":346,"m":700},"embers":{"src":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAKAAAAFaCAYAAACZsVbmAAADF0lEQVR42u3dP04qURQH4ANSkFjSuQRLt0BMZgNsAGsbtmI9bsDaZBL3AB0LeAU7mIQG7it8zPPFaMS8Ga7M91XiNPfP4XdmcglEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwE+yK4tkFfIxtASc0qhPk92vFikm09iVkSIiLu6qgRI4rV5swK4s0uDm+vXFZBoREenlobmuELXg1qXlOtJy/a74kIAneQCRehKwc4qOrFIQALQ+PIRA9zo5CXEC8f2Oce5rNWx7EferRdN6B7f3zf+1ZDppwU4g+Ewn8e4E4shbll/PzXqd+5l1Jw8hiu7rb9SPbk221ZUWrBBPtz6XT4/WjjzSUAICAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAPAtu7JIOY+trfHlPO82jJT6cerZPG0r63DWBbhfLVJMprErI0VEXNxVg3xSeRPb6irGxSbqmKfLp8fBuc+7TcPcWtt+tWha0OD2vvWW9x3jYtPLefciAdNy/WcTppFeHrIa2yGR6tk8RUT8z/TLed5tyjLi377r+9CG+jzvYY6D6lPRmfcPSAPzBgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAICv2JVF2pVFynV8I1t0vurZPG2rvMc4tE3nm3zjYhMREeNiE/VsnhQgnTsUIZysDeeafgAAAAAAAAAAAAAAAAAAAAAAAAAAABwl958d4Di+pBwFSH/9qB+q2f96Tn9bcTR/X9xVA1upAFu97/vo2ra6sotacLs+S7jLp0fph6dgPIQAAAAAAAAAeXLG3D1nwZzUyBK82q8WKSbT5oOuPuTajd4v8q4s0uDm+vXFZBoREenlobmuELXg1qXlOtJy/a74kIAneQCRehKwc4qOrFIQAADo8EbczThd+ecorp7N07ayKHRn+Db5xsUmIiLGxSbq2VwK0l0BHhyKEE6ins2T9AMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA+NRv5u4vx9AOWJYAAAAASUVORK5CYII=","x":0,"y":0,"w":160,"h":346,"m":700},"sun_moon":{"src":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABYAAAAWCAYAAADEtGw7AAABxUlEQVR42rWVv2rCUBTGvxtCKg6lhDyCg4oglG6dxCUOhQw+hJOFzo7OBTvlIRyEDrpIp26lIBR18BFCEIeiIp4unnjv7Y2mLT0QkpuE3/nOn3sucMZo0Cqa7n8yCean3FOdiBNQXwThqF3xyPS91202RBCOaNAqiiCcZwLToOXfd/pDAOje3Rgdd57fAABPH5EwwUUatF4qo1bIw9EEbyMBxyNsI4GXxSfGs6kRbpugrNIxZIHfOR6hhjyAMoApiSBU4HYaNAnpSg2KlpQoB4BawQy3uLoiCEe6MoaKS/t4Hd45HiXqq25OLvgcACz20K54JKdAhioRSHDZ6qUy7jv9IbeiJYJwzoufmKzcda1ENbegpadBLxitdqDVTlmf2VS+CML5N8XbSGAbCWwWwGZxwsGSkn+VSLIovigYFC1JKXAc7xHH+2yKueK0JAXEz3rLAcAkXquKedHrNhu8TfXwdAemFOg70Jb7uF3xjmHFgOtamTqE1fLgUmaF3M8Pt9cA0sFyTifxGuPZNJl2xiEkw+ulMqpuDq5rKSBdqQmaNt0SOACwet0eX9+VuZx1Hhe5W3gu63YolG+C/tux9BsnmQ/ULyoEYRPlam0+AAAAAElFTkSuQmCC","x":132,"y":66,"w":22,"h":22,"m":700}},"far":"data:image/png;base64,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","farW":160,"farH":108,"farFill":"#782957","farY0":238,"near":"data:image/png;base64,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","nearW":160,"nearH":108,"nearFill":"#491e44","nearY0":238,"floor":"data:image/png;base64,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","floorW":160,"floorH":67,"floorFill":"#341530","floorRow":0},"aqua":{"L":{"bubbles":{"src":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAKAAAAFaCAYAAACZsVbmAAACVklEQVR42u3dsa6CMBQG4MpzMPgYvv/kIzg6OBrToenaO5EQY+K9F+EAft+i8+EPLW05pAQAAAAAAAAAAAAAAAAAANuSa2mqQIjz7drGvxAWQgAAAAAA2I1cS7MATohx8KJC2LkMQOhd0BAMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMwj1+IrScQYPtHlU12EhxAAAAAAAHbpoASfNeytXh73lFJKp/6oxizj1baWrS7CwieE73VKgAAigICHkK9jiWDmEFqGAQAAAAAA+FaLbhPlWpqTwoR43iO1SU9KjmMhgJgDBgzD5oAAAAAAAAAAAAAAAAAAAAAwk1xL20tvHa05NmjoMAYAAACsVa5FW2ZiDOuWeoMTHkIAAAAAAAAAANYq19KccyPE+HiRo0aEhU8I/8+L6WAIhgkhFD4AAAAAAFipgxLEybW0oeH4qT+6FiznefvuW7fznIZBADEHJHgYNgcEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAYE65lna+XZtKsLhx8IRwmzolgIl3QXc/AGAlKwOqQOjKgHkx4SEEAFjbU5p5CikFbcVdHneVBwAAAAAAAAAAVmbq0TqdEZjE0ToAAFjJk6EXrwjxHDohJCx8QviedUAEEDAHDHFQgnlDeOqPagwAAAAAAAAAAAAAAAAAAPBXWpcxCOkNo7E1AAAAAAAAAAAAAAAAAAAAAADADulyRphx8KaEsFNKYLN3QUMwAADMKNfSci0m3cQ88b36D4uGTwg/y0I0GILhlyEUPgA+4weGKVQskcpU9AAAAABJRU5ErkJggg==","x":0,"y":0,"w":160,"h":346,"m":700},"sunbeams":{"src":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIgAAAFaCAYAAADFOxXCAAAD3UlEQVR42u3VsQ0AIAzEwJ+O/UtGSJkR6BkAiejSUNuynuyulST3+/vhIhPXCy4ScZGJi0RcZOISCS7fjDgsiEgsCIkWhExcJOIiExeZuHwzuCwILgsiDgtCpgUh0YKQiYtEXGTiIhOXbwaXBcFlQcRhQci0ICRaEDJxkYiLTFxk4vLN4LIgIrEg4rAgZFoQEnGRiYtMXCTiIhOXBcFlQURiQcRhQci0ICTiIhMXmbhIxGVBcFkQXBZEJBZEHBaETAtCIi4ycZGJi0RcFgSXBRGHBRGJBSHRgpApEjJxkYiLTFwk4rIguCyIOCyISCwIiRaETFxk4iIRF5m4SMRlQXBZEHFYEJFYEBItCJm4yMRFIi4ycVkQXBYElwURhwUhUyRk+mZIxEUmLhJxkYnLguCyILgsiDgsCJkiIdM3QyIuMnGRiItMXBYElwURiQURhwUhUyRk4iIRF5m4SMRFJi4LgsuCiEQkZPpmSLQgZOIiEReZuEjEZUFwWRBcFkQkIiHTN0OiBSETF4m4yMRFIi4LgsuC4LIgIhEJmb4ZEi0ImbhIxEUmLhJxWRBcIhGJb0YcFoRMC0IiLjJxkYiLTFwk4rIguEQiEt+MOCwImRaERFxk4iIRF5m4LAguC4JLJCLxzYjDgpBpQUjERSYuEnGRiUskuHwz4rAgIrEgJFoQMi0IibjIxEUiLjJxiQSXb0YcFkQkFoREC0KmBSERF5m4SMRFJi6R4PLNiMOCiMSCkGhByMRFIi4ycZGJi0RcFgSXBRGHBSHTgojDgpBpQcSBi0wLQiYuC4LLguCyIOKwICKxIOKwICIRiTjEQaZIyMQlDlwWBJcFEYcFEYkFEYcFEYkFIVMkJIqDTFwWBJcFwWVBxGFBRGJBxCEOkYiEzKlcJOKyILhIxGVBRGJBcFkQkThxWBAyLQiZuEjERSYuEnGJBJc4cDmROJGIhERxkImLRFxk4iIRl0hwiUMcTiSOTJGQKA4ycZGIi0xcJOISCS5xiMOJxJEpEhLFQSYuEnGRiYtEXCLB5UTixCEOMkVCIi4ycZGIi0xc4sAlElxOJE4c4iBTJCTiIhMXibjIxCUOXCIRiROJI1EcZIqERFxk4iIRF5m4RIJLHOJwIhEJieIgUyQk4iITF4m4RIJLJLjEIQ4nEpGQKA4ycZGIi0xcJOISCS6R4HLicCIRCYniIBMXibjIxEUmLnHgEolInDgcmSIhURxk4iIRF5m4yMQlDlwiEYkThyNTJCSKg0xcJOIiE5dIcIkDlxOJE4c4yBQJibjIxEUmLhJxiQSXOHA5kThxiINMkZA4kusAH3ZFPHaXXt8AAAAASUVORK5CYII=","x":24,"y":0,"w":136,"h":346,"m":700}},"far":"data:image/png;base64,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","farW":160,"farH":101,"farFill":"#17518d","farY0":245,"near":"data:image/png;base64,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","nearW":160,"nearH":127,"nearFill":"#1d3c75","nearY0":219,"floor":"data:image/png;base64,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","floorW":160,"floorH":84,"floorFill":"#9f743d","floorRow":17},"space":{"L":{"asteroids":{"src":"data:image/png;base64,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","x":0,"y":0,"w":160,"h":346,"m":0},"nebulae":{"src":"data:image/png;base64,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","x":0,"y":0,"w":160,"h":346,"m":0},"planet":{"src":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEQAAAAtCAYAAAAX6M0gAAAEpElEQVR42t2az0sUYRjHv2NDK4bFxparC8naUlISpUUlUVFUBv0DEdEhMCrqIHRIgiiibh0qDAIPHroFHeqQRWIR/YAtO1Rk6EqBZrUYFYUbxnaIZ33nnfedeWfmnVntgUV39p3Z9/m83+fHvDsGymCJykxRdWx+csiIcm5GOQB8uLzT9ZxfH3+g8fyTyOFUhA2CYDTVxNFUE3eFQC8WHJ3LXm/WKYSduKoixkcLAIBkKoaq2mrbmCXH7oauFqPcIERAGtYmHMeGCUZ7yJC8vcDIZfMlGCrg3nZu9JWgI1fI1vp1RQC40pYuHZOtdi6btx1zUwYLhazx/BOtKjF0hsmHyzuFjqqYCgwWBGtUjXSAMcLIGV6gOIG4ev295f2BbQttYyjUtva80AJFCxBZvmDBqIYDDyO9wLQc39wyXwiEoAQFYobZcXqF4AYDAKpqq5HL5pFMxYSJOFGZKQaBUhEWDD+Wy+ZLqmJhLEvGSi+RMsj6DzQHnpsZ1Im3nRstyU7UUDkBEBkPgz8nmXIGE3kOSVRmik01cdw42BjKpJKpGB4+/y4EwsKQffe78QLae1/7yiemLgf8rhjvIJs8ebXxZbenbwK7ls+zgAhqpu48IHPQj8n6DtZ6B38Kk29kIcM2YbKJsyur4pRfo7CSmZ+w8YWWEik57pRIq2qrQ4Wi23wBGR8tIJmKWaCIusvPhSkAwIndiwNN0i0vUbMmUozXvsRUDRHZJJOMEq5ef2+J5zRMjHybQk/fBA7vq3dViteE3LYnVQpLHsbItymhD25wTBUAI4+PlP4/d7RX6EQDp5RlyRjejReQXmCWJqe7POeyeWFloe9rqonj1s291h6ntcviHw/IFIFgAQDAoztvPE2Uegf+r25zgiGa+6a2FRbf0q1dNvWYicpMkQfAEbUd27+q2TaZBklnGTYIHgBrrz59xf6z/dMHzvZbgPB+p1u7io45RARDtjJ3bo+W+gK2WXJr04MogoVBCVxk+ckhg5RAPslE4AiEPenemQcAgB2ntwAArnXcV2qWwlIMweBBLI79+972i9txavpwcc7zIQDAn5aMc2PmlDvcjIfSfnG7EJRIMUGt/tAG22KR0aJ5termDsNQSar/s1EIUbUx3MruyOMjwiqzZdFcy3s3KUZhFBZkD778thcENskKyq5rB+e02XJwzVLpec/GJgAA6+sWanPYyzW7B4alCTZQpyq6gMqOlE4Qfq/pZz+k4n/MCzJ1hL4f0j0wjGu7Vk5L+vOkVseohKr0GqLxkeyH8KHDAtFpPFxyVgaFPr/wdNB3uISyY6bb+FVn3xMcHcrQBqS99zVOblgurvEetvac7knoOqIxOmEEDhlR2Dg55qlhEsDc3DIfPX0T0nMuPB0s7y93FKuXXsaLAHB8dZ3FET9wZKrif8LkQcyYkKHb7H9WZ3NOBYoMAp17eF89APv2JB8uM+LX/zCrjhNMSqjdA8Nanw/RXmUuvRwDhU9QCLJb+6DNV2QK4dt6FbVQvyGqFiwQ/vOg/UZkQGT3O3xpdlp92ThWFbPmKURVOKpA2Aoy6x/cVS2TKjCiMqMcQGbys+5/ASxUZJ4YO9p9AAAAAElFTkSuQmCC","x":0,"y":8,"w":68,"h":45,"m":0},"sun_moon":{"src":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAB0AAAAgCAYAAADud3N8AAACL0lEQVR42q1Xv0sjQRh9swQrIXAeFtEQNmB3zXGFTQhnkz9AG23srK/PH2DlFfZWwnEWF/+AIFwIAbHwrrEQhAzLblKEVQgsCBI4q28zNzs/k3zVwM7Mm/d933szy+AZH9e3/5m+p1nCbHuwRUDO+0/a+d+aO9ZDBL5MTYCuwVzYLQqkY20FXQUzAteC/vjzWqjh/qe1fHz98GYE2Nos5ePRZFYAT7OEMZmhzEwEtAFfXfbycaVeQ7MRAgB4PAUAxNELOu2WuZFUgLqQAU0RuOrPNaUmwGrtAwCgJAL+euSFOrikVQakzSnCahk8niKOXnBw2kXJtIkNRNUwMqAYzUaI/oD7m4MuDo+/ar9RI+XmQKlV6dHU/rbaqtb0B3xeU50BfD+7cWJiO5jMNLBJoFKvoVKvoT/gBSaLRuCSJlNz2EJmmafXJAEC9AEWD81j+IEuGmIv7O59zi3QmN7RZFZonLBatnbw1WXvPzsEgLvff9H4suHO9Gh/x0syKncaDyN1eum+k6XjC6TyX5UXl9IsYcuYvQ5MtL6lGknUrmpD8laxPKPJDD+vn+w65fG0oC+SgchG1jOPpwVpiYcAML/E0yxhaZYwqm1YLWvBSbO0Oc0R59E3maE1vXQHzjeea45icP9cWCfq0dkGia2cFvEwlAlXwPEwwngYodNuIc0SFqjepfJ71VZvF4a3Fyd+j+2D0663fMgURDDjY3uZA3TardX/y6wimO+CVfwqvgPO2BFwT9mQTgAAAABJRU5ErkJggg==","x":131,"y":20,"w":29,"h":32,"m":0}},"far":"data:image/png;base64,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","farW":160,"farH":104,"farFill":"#3d2f90","farY0":242,"near":"data:image/png;base64,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","nearW":160,"nearH":105,"nearFill":"#2d2268","nearY0":241,"floor":"data:image/png;base64,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","floorW":160,"floorH":70,"floorFill":"#312d5b","floorRow":3}},"cell":{"w":72,"h":68,"ax":32},"anchor":{"pirate":{"ability":[66,10],"ab2":[68,2],"ab3":[60,0],"ab4":[64,25]}},"coin":{"src":"data:image/png;base64,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","n":8,"cw":28,"ch":28}};
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
  blob: { src: "data:image/png;base64,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", fw: 64, fh: 64, n: 8, ox: -10, oy: -24, scale: 0.5 }};
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
  function menuFrame() {
    var top = menuTop();
    var bot = Math.round(insetBottomUiCss() / Math.max(0.01, cssScale || 1));
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
      return { tabY: tabY, gridY: gridY, playY: playY, pickY: pickY, logoY: logoY, tagY: tagY, tagBot: tagBot, platY: platY };
    }
    var L = stack();
    /* Need a real jump (the hero must leave the ground), not just pose frames in place.
       Telegram safe-area + content-safe-area insets on a phone used to leave platY - cellH
       <= tagBot, so demoHop's room was clamped to 0. Squeeze the logo/grid first, then
       shrink the hero to a smaller whole device-px size rather than killing the hop. */
    function gap() { return L.platY - (L.tagBot + 2); }
    function need() { var f = heroFitHop(1000); return f.h + 26; }
    if (gap() < need()) { logoSc = 2; L = stack(); }
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
    var platY = L.platY;
    rect(ctx, LW / 2 - 28, platY, 56, 5, C.wood); rect(ctx, LW / 2 - 28, platY + 4, 56, 2, C.woodD); rect(ctx, LW / 2 - 28, platY, 56, 1, C.edge);
    var heroId = (CHARS[save.char] || CHARS[0]).id;
    var mh = demoHop(lookNow(), L.hopRoom), hop = mh.hop, pose = mh.pose;
    var heroY = platY - 16 * L.heroSc - hop;
    drawJumper(ctx, jumperXForCenter(LW / 2, heroId, pose, L.heroSc), heroY, lookNow(), 1, pose, ui % 170 < 6, true, L.heroSc, true);
    lastHop = { where: "menu", hop: hop, room: L.hopRoom, sc: L.heroSc, k: L.heroK, h: L.heroH, platY: platY, budget: platY - (L.tagBot + 2) };
    markBox("hero", LW / 2 - 18, platY - hop - L.heroH, 36, L.heroH);
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
    /* If the card would be too short for a readable jumping hero, tighten the title and grid first. */
    var shopBotPeek = Math.round(insetBottomUiCss() / Math.max(0.01, cssScale || 1));
    var backPeek = LH - 34 - shopBotPeek;
    var y0est = belowBand() + (7 * 2 + 10) + 4 + (34 * 2 + 4) + 4;
    var tightShop = backPeek - 6 - y0est < 140;
    var hdShop = header("МАГАЗИН", tightShop ? 1 : 2);
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
    /* Always show the jumping hero (same demoHop as the start screen). Reserve a real hop first,
       then pick the largest whole device-px size that stays inside the card, including tall sprites
       (robot dome, mage staff) after drawJumper's rounded k. Never drop the hero or clamp hop to 0
       the way the old "if the card is short, hide it" / shopVis=cell path did on Telegram phones. */
    var btnH = 22, btnPad = 6, platH = 8;
    var textH = 69; /* name → charge; shrink only if the card would leave no jump room */
    var chrome = 4 + btnH + btnPad + platH + 2;
    var minBand = 16 + heroFitHop(40).h + 2;
    if (ch - textH - chrome < minBand) textH = Math.max(52, ch - chrome - minBand);
    var byb = y0 + ch - btnH - btnPad;
    var textTop = byb - 4 - textH;
    var platTop = textTop - platH;
    var budget = platTop - (y0 + 1);
    if (budget < 24) {
      /* last resort: pull the text block down into the button pad and shrink textH */
      textH = Math.max(52, textH - (24 - Math.max(0, budget)));
      textTop = byb - 4 - textH;
      platTop = textTop - platH;
      budget = platTop - (y0 + 1);
    }
    var fit = heroFitHop(Math.max(16, budget));
    var hopRoom = fit.hop;
    if (fit.h + hopRoom > budget && budget > 0) hopRoom = Math.max(8, budget - fit.h);
    rect(ctx, x + 40, platTop, 72, 4, C.wood); rect(ctx, x + 40, platTop, 72, 1, C.edge);
    var mh = demoHop(makeLook(i, save.color, save.hat), hopRoom), pose = mh.pose, hop = mh.hop;
    if (hop > hopRoom) hop = hopRoom;
    drawJumper(ctx, jumperXForCenter(LW / 2, H2.id, pose, fit.sc), platTop - 16 * fit.sc - hop, makeLook(i, save.color, save.hat), 1, pose, ui % 170 < 6, true, fit.sc, true);
    lastHop = { where: "shop", hop: hop, room: hopRoom, sc: fit.sc, k: fit.k, h: fit.h, platY: platTop, budget: budget };
    var mid = textTop - 16;
    var nameSc = textH < 62 ? 1 : 2;
    var ny = textTop + (nameSc === 2 ? 0 : 2);
    drawText(ctx, H2.name, LW / 2, ny, C.cream, nameSc, "center");
    var tw = textWidth(H2.abName, 1) + 10;
    var by0 = ny + (nameSc === 2 ? 18 : 12);
    box(ctx, Math.round(LW / 2 - tw / 2), by0, tw, 12, "#3a4ac8", C.cream);
    drawText(ctx, H2.abName, LW / 2, by0 + 3, C.cream, 1, "center");
    drawText(ctx, H2.abDesc[0], LW / 2, by0 + 16, C.cream, 1, "center");
    drawText(ctx, H2.abDesc[1], LW / 2, by0 + 26, C.cream, 1, "center");
    drawChargeLine(LW / 2, by0 + 40, H2, "#9a8ab8");
    markBox("cardText", x + 4, textTop, 144, textH);
    markBox("cardBtn", x + 10, byb, 132, btnH);
    if (on2) btn("hero:act", x + 10, byb, 132, 22, "#2a2050", "ВЫБРАН", C.gold, 1, C.gold);
    else if (own2) btn("hero:act", x + 10, byb, 132, 22, C.mint, "ВЫБРАТЬ", INK);
    else drawBuy("hero:act", x + 10, byb, 132, 22, H2.price);
    btn("back", x + 26, backY, 100, 22, C.navy, "НАЗАД");
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
        /* Render-only: while clinging, face into the field. p.face is used by dash/kick/net, so sim stays as-is. */
        var faceDraw = p.wall === -1 ? 1 : p.wall === 1 ? -1 : p.face;
        drawFxBack(p, sy, cam, pose, faceDraw);
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
  function drawFxBack(p: any, sy: number, cam: number, pose?: string, faceDraw?: number) {
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
    var bot = Math.round(insetBottomUiCss() / Math.max(0.01, cssScale || 1));
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
        drawJumper(ctx, x + 22, y + rowH - 16, p.look, 1, "idle", false, true, 1, true);
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
