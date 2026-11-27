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
/* Black hole (city + space). Visual +15% and hitbox ~+20% vs the previous
   14×14 / scale 0.5. Pull is an extra local acceleration only — ACCEL, GRAVITY
   and springs stay as they are. Cap is below ACCEL (0.16) so a held direction
   always wins. Whirl keeps the old 14×14 / range 36 / accel 0.11 numbers. */
var HOLE_W = 17;
var HOLE_H = 17;
var HOLE_SPRITE_SCALE = 0.575;
var HOLE_ART_CX = 31.5;
var HOLE_DARKEN = 0.87;
var HOLE_PULL_RANGE_MUL = 2.5;
var HOLE_KILL_RADIUS = 7.2;
var HOLE_PULL_ACCEL = 0.10;
var HOLE_PULL_ACCEL_CAP = 0.10;
var HOLE_PULL_VY = 0.6;
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
/* Injected at build time by build.sh (--define HOP_BUILD_LABEL / HOP_BUILD_SHA). Fallback is v0.9 with no sha. */
function buildLabel() {
  try { if (typeof HOP_BUILD_LABEL !== "undefined" && HOP_BUILD_LABEL) return String(HOP_BUILD_LABEL); } catch (_e) {}
  return "v0.9";
}
function buildSha() {
  try { if (typeof HOP_BUILD_SHA !== "undefined" && HOP_BUILD_SHA) return String(HOP_BUILD_SHA); } catch (_e) {}
  return "";
}
function buildVersionText() {
  var sha = buildSha();
  return sha ? (buildLabel() + " · " + sha) : buildLabel();
}


/* When true, the robot keeps the old cosmos-shield (dome, saves a fall). Off: regular bonus shield. */
var ROBOT_OLD_DOME = false;
/* Heroes: look + ability. Each ability has its own TYPE (no repeats) and its own CHARGE:
   charge: time (ticks, 50/s) | coins (coins picked) | height (metres climbed) | kills (mobs stomped) */
var CHARS: any[] = [
  { id: "pilot", get name() { return t('hero.pilot.name'); }, hood: "#2c3a5c", price: 0, ab: "dash", get abName() { return t('hero.pilot.ability'); }, get type() { return t('hero.pilot.type'); }, get abDesc() { return [t('hero.pilot.description1'), t('hero.pilot.description2')]; }, charge: "time", need: 400 },
  { id: "pirate", get name() { return t('hero.pirate.name'); }, hood: "#a8282c", price: 150, ab: "hook", get abName() { return t('hero.pirate.ability'); }, get type() { return t('hero.pirate.type'); }, get abDesc() { return [t('hero.pirate.description1'), t('hero.pirate.description2')]; }, charge: "time", need: 400 },
  { id: "ninja", get name() { return t('hero.ninja.name'); }, hood: "#26305a", price: 200, ab: "wall", get abName() { return t('hero.ninja.ability'); }, get type() { return t('hero.ninja.type'); }, get abDesc() { return [t('hero.ninja.description1'), t('hero.ninja.description2')]; }, charge: "time", need: 500 },
  { id: "robot", get name() { return t('hero.robot.name'); }, hood: "#d8dce8", price: 240, ab: ROBOT_OLD_DOME ? "dome" : "shield", get abName() { return t('hero.robot.ability'); }, get type() { return t('hero.robot.type'); }, get abDesc() { return [t('hero.robot.description1'), t('hero.robot.description2')]; }, charge: "height", need: 200 },
  { id: "mage", get name() { return t('hero.mage.name'); }, hood: "#7a3ac8", price: 280, ab: "tele", get abName() { return t('hero.mage.ability'); }, get type() { return t('hero.mage.type'); }, get abDesc() { return [t('hero.mage.description1'), t('hero.mage.description2')]; }, charge: "coins", need: 5 },
  { id: "knight", get name() { return t('hero.knight.name'); }, hood: "#c02a2a", price: 320, ab: "pound", get abName() { return t('hero.knight.ability'); }, get type() { return t('hero.knight.type'); }, get abDesc() { return [t('hero.knight.description1'), t('hero.knight.description2')]; }, charge: "kills", need: 1 }
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
  robot: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAXoAAAAwCAMAAAAoykEcAAAAw1BMVEXp6+rf0NbwyaLus4PutVeU4vHFuL61pKpLxOvak2OulI/olSTDaxKph22QiJ2HdYEtldBqY3y8bkLLPTCFU56GYlBiVGGFTjRoRDhwOidwRIZRPHBNQ1Iha6U4O1tONzhdNiw5NUUjTXevLyWPJiRUKyBqHB1CLzBGJR83IyRPFB0rMVItKjQoIUQqHiQaHjk6FhYpFBcoCQcYKU4eGSQUDBwaEhYaCg4XEi4PDBULDCYNDAwLBRISBAQFBBwUDBwAAADH/NxIAAAAQXRSTlP/////////////////////////////////////////////////////////////////////////////////////ADBV7McAAAtdSURBVHja7ZsNc6M4EoYhtiXHJMLiythTAiVQtTV7J7BqD3oWsJaa//+rrgXOzI7HNsrsZGdv16p8O4rgofX225Lifby1H9S8G4Ib+hv6W7uhv6G/tRv6G/pbu6H/xgbYbuh/CPYc21+DvvdPAp9+ajnc0P+JAZ+mC89bYLMf0x8f+f8Q9Mjd85bL5WL50rwfHvnePyTivRH6emz28xIj/y+JHv46TuAPk89RahafuA9ab9HjHHjbW5xg6F3oZMKQ8b8FfCTvDeSXL9wH9mmK379l4E8y9M52kjJnvk+o+hvAhyP5tRqhK9O1B3SYFv96DW8GfpLhGfTQUuJ7ee5hR8nh70I+v7tPkXifMp8x1g/wMfTfJrhcGH6NHgw+LA/7cNvPZ/B/Tn4xkk/z+RZxS0pIjvdFRDuyX7yF0XFieIoePoJc3WM/f3z36Z+AHt4sqX8mn6YUyQti7wrZ+4IeA3/x3Qd2ZHiCHji0IZ3N8Hl1DfR91wsXJn+MGwjCGDfwNnKDRmZIrzmTeYdEbDBaIITbNQX70nce2JXh1+gNZ5SIDq9VqarSuusmLw3uAvgcvfDaiNfVIAGla0/49GmqA+To59c25vO8YrnklCARnw+NwRj2S/guY72aoXeiURw4TpBQ58PVYtNVOY0+CJ7AuilDKVPmNfCHfDRKAHXM6eB9es4THdBXLqyntDGfa6F6Floi+XBnWguLHt+usAd/HKsFiF0Dw5XhCXqPy1XgyWa99NZDL7zCaSWA7bMlHxLLkFBWgGPA43VaJ4AakCF7RtzQz2Ewb7nAqXJ9ksGLmc/zjveyCTzBqpwe0WuFgjOB/nEYK5MJBpXbhHZm+AV6IERVLKCyy8ey23ZbO6AnHwBaZjPKmMIap2tkOD9iRuYWPWEoAcTJTkGIj4zhY2aDTl2JfKv0R/L9jFZKRpQ3y4WXjkDyXA3or6i9nVeAU4WEkhBKHSLfneGX6Fe00ixiZV9Vx8J7QgqP/aglfz/6qeEJuMS97WVFceazprSSWOneET1kZBjLatWV5wXpSB75thHLqzJisq9egCD2yr50LewRPRRI3nK3H8LpMHRm+CX6kFXQcimwW14dVzzAKbGgk6Vzax08H8tnF0sKIJQ2xI9pXKHkjhMT3NLYgc7u7EjoHjp9Bf1iOZJP8y6XSjdMyg5v7ahCvcKwvy72qPAHtrLUeYuCXzugd2Z4ovVMVdpoyZrqeIXrygFiKwESLFbu/JdGHVwREUKzIAiZXnr5URQdCnswAoOeEL/XMreTpbuGfokhZ01kKWVjfjKCkyHeLZBlr7Bh7K8vogeTQMboipoik4XWtYPaOzM8QY8MG2NawXtdjTCkw3PuStES307JUQMw1YqJbvAYcKmARxHjODG95aC/DuoGlMiSeZw2OUkt+uriVIF8gYCtpGDIm0PgzYOtETF2sUC0rtD5DZn20tQGRpOCkZjVisWyGNhPo3dleOrrjbkPguAAggu0AGjIJl09xDNflCZ68GUoddN1nRRCTPlEiGJZKzg8oqXUVhVHDXC4s3siTRQwli49Nt7ZpYkJGHPpOh3Rw3MwxzuTPWf2xqpGIvrKok8vo1/R7LDZhGHOfFZg07V2mZZuDE/R/zqbz+fBQ4NVAPLj5udJfwOziJeIPiISJxi6BpTsRovJbthKMFKUFn0+iqJLSl+Fqo2i0M6VhU2XOl9fRI9/cgj6XJoVqecPD5FUEkMD3VTzi7JBr8aVnAvoQ160mw2PNWOU8aKolUPp4crwFL19XsFD1CVUlkoZ+fQvMykdnD9pLJ05z5fMSgDYqJpWDjgEQVG2NjYwdi36ximlh6phKxFiDXwsl5aX0acjeimZR3hTJqpRhClMzrL4D+ZBG/TD6vEF9DHPahYmXGtp61/8ZeYyL90YnqLfzrBbJDs1R69NaKSC5yn0XMsSpxWXvFovvGO1Mj1ZEPzsLoiUSWLEaKdK41TNojECo8rw5Xmt0+oq+kFwtO8nsiwbU6l7QhgLmydNQ5tlr6H/CEkGJtvzWhd6ZO/gml0ZnqLHq3v3S9dofu+vgogolbRT6LNSG5GhdDTV6JlzjEeHdLl6stEhyj36DkwSjZzOK4OdauHX//4W8/BFp5bthTJzSLPHsEf7L7Wy8l4wtuGy1yXxB4FETVpeinoc6/Drb0mM7LUa1n0O0yWtK8NTh0N8VkqD4wgsIhhTmpPfptibFSLMEOBn3zadnMO5T9/Pg/tMZ1yagzF9+864WDfyGN6jkrYxa2wSa3QL5sICCxzXLDFY0RFxVeuyxidcVuhAtCgpxsiwfrY8v2aPZWzIHx8ft20S1mM7gPkwUdI6MzxBH83un+PalA1qiMSUZOTjfTSF/peHuTcLsl7EetQAJ48YPbIMzfb7Tt37XMhMPINaOZQD3t2G3gUPT91BDAuQ5t1uhW72PLwX9HmDoqM0Tq6ERxuheoMWJ+/HHLu+sF2CPpbGjGw279tDEscxj81PTyGh1/XemeEJeuJ5LN7Xuut7ut9rMB33pxa1YDumFZSMwUxpnbssdfhEYPCZRkoskKIH1mq7MDM5WzaE7cLo4UEqnqCN68sySqKw5pfCHsljVOfWzsR23YezkDeSs7JqMeZtybW+tEMLG8qfws12kxUxjnUwxX6TbPhE2Dsz9E6f86znrem63XMcRajgwPlUZQrvdg9omR/+XZY9FqilKFoH9JxylM0WSiUaxjgvjULNnqyCgQtotMwyrWREaMgK816W2QUv+1lxEL2mdsEHZQD9DiNUv+TYy1KPwOs6K7K6yDZoLvn+UOB3CUzVfG4MT9NswiDDKpgnhjHWSW7KyeoIxV41zWbXx0LiF21TvHNJl/YOQJWyq0tsXQ21ARAOnhTH60sohSJ0F2OeQMNzIfVBnn5G35HNTMTC9L2WYuhn0dtS7uKRkGEsU0CRFJQlCc9M0R4+TOJwZOidqXQOHMMjy2STEGIcNj7AMMLRpGSiyHQjw5XbsvuQklB9N2EUSc0LcN4KAnzYqm9RqoqsvbwxBhjUNuyHRZyKESGk7uy6DdYSiTb5sGi5Rs25JpA4M4uibbOs2F8b6xsYemd61it/ThNoZThbuezNwCEku13SGtMZUGq7aV23qUAKijqIuRLl8DWbswB7b599iCLVcfTeF9Aj89Qe8rNhX3EpRD6smKkOE7TuBvT48tSZBByL1LaqLdo4K9y24FwYnkOfYS7nNXYrqHCrcviD75FE606bjBF3iNCGmG6paQGn5uvQe4+eRzHw5d734XzXAf1i3JpVfDaL4srujtjiVmweI7uGMBy9nETvh1iGYeAnNSFwcCLiwNA704uuhCwM1JgApdNeHzToTQhDvda9QPSdM3pTzO7uSA9W9V+znQ4hR7tyxzCrh/TRvyBx9j8ZUrtmb/WGrVNe5cdmE0A6CA6Sn0LPY2p3SZK6QHtEQhcdcGHonfMeFF0A6ilaMO60GQw1p4+J1EVRGLmNhDP5XUh0LMUBXn2eBM3QhsRlaTSPrukv2JM4yyHTVp/Aj/viFbqbJb42hR7/BotpgvdWxxvH/VkXhufQP2+3RTZ0w2njJAPQxoVPYkTfooXLnNFHnIZYVn3DQRgo49AuHUGb7aaOJdggXy4XX7VlenQ/U+iLmGf7PcpH9uToA1wYnkEfYJ0eYTI3OxXhV05HoGpFPJ/WRVGKhHBX7YBVJLAS+KYjSJBtylIbWxpM/ebvgj0fdCb9/U8c4hjd5X6/dxnrNQy9r0u4iMWwRfXt1W4bCtE6nT7rmGRNbV2fEcY1jCFa7b71xB+YTJdufhRAwbhI+UWT+DNH/cA6dt+6H4NyY+iddaWj6Ua3iK12uji7QW3gtccnbW368RubvTxnZYMc8jNNwvcfy5nh/wB73nKLitg4WAAAAABJRU5ErkJggg==",
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
  { id: "bigcoin", wt: 25 },
  { id: "shield", get name() { return t('pickup.shield'); }, wt: 22, t: 500 },
  { id: "magnet", get name() { return t('pickup.magnet'); }, wt: 20, t: 450 },
  { id: "rocket", get name() { return t('pickup.rocket'); }, wt: 15, t: 85 }
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
  { id: "city", get name() { return t('map.city.name'); }, price: 0, goal: 2000, special: "", mobs: [["blob", 120], ["trash", 400], ["bat", 800], ["hole", 1500], ["ufo", 2200]] },
  { id: "jungle", get name() { return t('map.jungle.name'); }, price: 80, goal: 2000, special: "bounce", mobs: [["frog", 100], ["parrot", 300], ["snake", 550], ["monkey", 900], ["bat", 1400]] },
  { id: "ice", get name() { return t('map.ice.name'); }, price: 100, goal: 2000, special: "ice", mobs: [["penguin", 120], ["owl", 400], ["frost", 750], ["wind", 1200], ["blob", 1700]] },
  { id: "lava", get name() { return t('map.lava.name'); }, price: 120, goal: 2000, special: "lava", mobs: [["magma", 120], ["spitter", 380], ["firebat", 700], ["ember", 1100]] },
  { id: "aqua", get name() { return t('map.aqua.name'); }, price: 140, goal: 2000, special: "bubble", mobs: [["crab", 120], ["ray", 350], ["bob", 700], ["puffer", 1100], ["whirl", 1600]] },
  { id: "space", get name() { return t('map.space.name'); }, price: 160, goal: 0, special: "grav", mobs: [["alien", 120], ["ufo", 400], ["comet", 800], ["hole", 1300]] }
];
/* mob kinds. b = behaviour; plat = stands on a platform; gap = min vertical gap (px) it needs */
var MOBS: any = {
  blob: { b: "walk", w: 12, h: 8, gap: 0, plat: true, sp: 0.16, get name() { return t('mob.blob'); }, g: "m" },
  /* Static city obstacle: stands on a platform, never moves. Hitbox is a fair inset of the 30×22.5 body (60×45 art at 0.5). */
  trash: { b: "still", w: 24, h: 20, gap: 0, plat: true, get name() { return t('mob.trash'); }, g: "m" },
  magma: { b: "walk", w: 12, h: 8, gap: 0, plat: true, sp: 0.3, get name() { return t('mob.magma'); }, g: "f" },
  penguin: { b: "walk", w: 10, h: 11, gap: 0, plat: true, sp: 0.55, get name() { return t('mob.penguin'); }, g: "m" },
  crab: { b: "walk", w: 14, h: 8, gap: 0, plat: true, sp: 0.42, get name() { return t('mob.crab'); }, g: "m" },
  alien: { b: "walk", w: 12, h: 9, gap: 0, plat: true, sp: 0.3, get name() { return t('mob.alien'); }, g: "m" },
  frog: { b: "hop", w: 12, h: 8, gap: 31, plat: true, get name() { return t('mob.frog'); }, g: "f" },
  monkey: { b: "throw", w: 12, h: 11, gap: 0, plat: true, get name() { return t('mob.monkey'); }, g: "f" },
  spitter: { b: "spit", w: 12, h: 10, gap: 0, plat: true, get name() { return t('mob.spitter'); }, g: "m" },
  bat: { b: "fly", w: 14, h: 10, gap: 34, get name() { return t('mob.bat'); }, g: "f" },
  parrot: { b: "fly", w: 14, h: 10, gap: 38, dive: true, get name() { return t('mob.parrot'); }, g: "m" },
  owl: { b: "fly", w: 14, h: 10, gap: 34, get name() { return t('mob.owl'); }, g: "f" },
  firebat: { b: "fly", w: 14, h: 10, gap: 34, get name() { return t('mob.firebat'); }, g: "f" },
  ray: { b: "fly", w: 16, h: 8, gap: 34, dive: true, get name() { return t('mob.ray'); }, g: "m" },
  bob: { b: "sway", w: 12, h: 12, gap: 34, get name() { return t('mob.bob'); }, g: "f" },
  ember: { b: "sway", w: 12, h: 12, gap: 34, get name() { return t('mob.ember'); }, g: "m" },
  /* Visual scale 0.5*0.92 (Roman: -8%), contrast 83 (88-5, this mob only). Hitbox scales with the sprite. hangTop stays pl.y+5. */
  snake: { b: "snake", w: 10 * 0.92, h: 8 * 0.92, gap: 38, get name() { return t('mob.snake'); }, g: "f" },

  puffer: { b: "puff", w: 12, h: 12, gap: 40, get name() { return t('mob.puffer'); }, g: "f" },
  hole: { b: "pull", w: HOLE_W, h: HOLE_H, gap: 44, get name() { return t('mob.hole'); }, g: "f" },
  whirl: { b: "pull", w: 14, h: 14, gap: 44, get name() { return t('mob.whirl'); }, g: "m" },
  wind: { b: "wind", w: 24, h: 10, gap: 40, get name() { return t('mob.wind'); }, g: "f" },
  ufo: { b: "shoot", w: 14, h: 8, gap: 34, get name() { return t('mob.ufo'); }, g: "m" },
  frost: { b: "shoot", w: 12, h: 12, gap: 38, freeze: true, get name() { return t('mob.frost'); }, g: "m" },
  comet: { b: "comet", w: 12, h: 8, gap: 34, get name() { return t('mob.comet'); }, g: "f" }
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
  if (!s.ency || typeof s.ency !== "object") s.ency = {};
  if (!s.ency.mobs || typeof s.ency.mobs !== "object") s.ency.mobs = {};
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
  if (s.bgContrast != null) delete s.bgContrast;
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
  get break() { return t('floor.break'); },
  get goal() { return t('floor.goal'); },
  get record() { return t('floor.record'); }
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
  "A": [2,5,7,5,5], "B": [6,5,6,5,6], "C": [3,4,4,4,3], "D": [6,5,5,5,6],
  "E": [7,4,6,4,7], "F": [7,4,6,4,4], "G": [3,4,5,5,3], "H": [5,5,7,5,5],
  "I": [7,2,2,2,7], "J": [1,1,1,5,2], "K": [5,6,4,6,5], "L": [4,4,4,4,7],
  "M": [5,7,5,5,5], "N": [5,6,5,5,5], "O": [2,5,5,5,2], "P": [6,5,6,4,4],
  "Q": [2,5,5,6,3], "R": [6,5,6,6,5], "S": [3,4,2,1,6], "T": [7,2,2,2,2],
  "U": [5,5,5,5,2], "V": [5,5,5,5,2], "W": [5,5,5,7,5], "X": [5,2,2,2,5],
  "Y": [5,5,2,2,2], "Z": [7,1,2,4,7],
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
function typeLines(s: string, role: string, maxW: number) {
  s = String(s || "");
  if (uiWidth(s, role) <= maxW) return [s];
  if (role === "S") return tinyLines(s, maxW);
  var parts = s.split(" ");
  if (parts.length <= 1) return [s];
  var lines: string[] = [], cur = parts[0];
  for (var i = 1; i < parts.length; i++) {
    var try_ = cur + " " + parts[i];
    if (uiWidth(try_, role) <= maxW) cur = try_;
    else { lines.push(cur); cur = parts[i]; }
  }
  lines.push(cur);
  return lines;
}
function uiText(ctx: Ctx, s: string, x: number, y: number, color: string, role: string, align?: string) {
  if (role === "S") return drawTiny(ctx, s, x, y, color, align);
  return drawText(ctx, s, x, y, color, TYPE[role] || 1, align);
}

/* Percent of the original colors. These defaults also apply to offline play.
   shield is local (95 = -5 from 100). Admin payload uses platforms/mobs/coins;
   the original five keys must all be valid to apply it, shield is optional. */
var VISUAL_CONTRAST: any = { bg: 80, platforms: 92, hero: 92, mobs: 88, coins: 85, shield: 95 };

function loadVisualContrast(origin: string): Promise<void> {
  if (typeof fetch === "undefined") return Promise.resolve();
  return new Promise(function (resolve) {
    var settled = false;
    var timer = setTimeout(finish, 1500);
    function finish(data?: any) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      var required = ["bg", "platforms", "hero", "mobs", "coins"];
      if (data && required.every(function (key) {
        return Number.isInteger(data[key]) && data[key] >= 50 && data[key] <= 110;
      })) {
        for (var i = 0; i < required.length; i++) VISUAL_CONTRAST[required[i]] = data[required[i]];
        if (Number.isInteger(data.shield) && data.shield >= 50 && data.shield <= 110) VISUAL_CONTRAST.shield = data.shield;
      }
      resolve();
    }
    fetch(origin + "/api/config/visual", { cache: "no-cache" }).then(function (response) {
      return response.ok ? response.json() : null;
    }).then(finish, function () { finish(); });
  });
}
/* Jungle snake only: render at 92% of the usual 0.5 scale, contrast 83. Shared by draw + spawn clearance. */
var SNAKE_DRAW_SCALE = 0.5 * 0.92;
var SNAKE_CONTRAST = 83;
var SNAKE_HEAD_DRAW_H = 64 * SNAKE_DRAW_SCALE;

function applyContrast(ctx: Ctx, pct: number, fn: any) {
  if (pct === 100) { fn(); return; }
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.filter = "saturate(" + pct + "%) contrast(" + pct + "%)";
  fn();
  ctx.restore();
}
function applyBgContrast(ctx: Ctx, fn: any) { applyContrast(ctx, VISUAL_CONTRAST.bg, fn); }
function applyPlatContrast(ctx: Ctx, fn: any) { applyContrast(ctx, VISUAL_CONTRAST.platforms, fn); }
function applyHeroContrast(ctx: Ctx, fn: any) { applyContrast(ctx, VISUAL_CONTRAST.hero, fn); }
function applyMobContrast(ctx: Ctx, fn: any) { applyContrast(ctx, VISUAL_CONTRAST.mobs, fn); }
function applyCoinContrast(ctx: Ctx, fn: any) { applyContrast(ctx, VISUAL_CONTRAST.coins, fn); }
function applyShieldContrast(ctx: Ctx, fn: any) { applyContrast(ctx, VISUAL_CONTRAST.shield, fn); }
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
  var menuFiles = [
    "btn_play_idle", "btn_play_hover", "btn_play_pressed",
    "btn_sec_idle", "btn_sec_hover", "btn_sec_pressed",
    "panel", "cell_idle", "cell_dim",
    "tab_normal", "tab_active", "tab_locked",
    "slot_idle", "slot_active", "name_row",
    "logo", "logo_x2", "icon_lock",
    "icon_tab_home", "icon_tab_shop", "icon_tab_leagues", "icon_tab_friends", "icon_tab_settings",
    "icon_grid_map", "icon_grid_multiplayer", "icon_grid_encyclopedia", "icon_grid_quests"
  ];
  for (i = 0; i < menuFiles.length; i++) loadUiImage("menu_" + menuFiles[i], "ui/menu/" + menuFiles[i] + ".png");
  var mapIds = ["city", "jungle", "ice", "lava", "aqua", "space"];
  for (i = 0; i < mapIds.length; i++) {
    loadUiImage("mapthumb_" + mapIds[i] + "_locked", "ui/map_thumbs/" + mapIds[i] + "_locked.png");
    loadUiImage("mapthumb_" + mapIds[i] + "_open", "ui/map_thumbs/" + mapIds[i] + "_open.png");
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
/* 9-slice: corners = slice insets, edges repeat the centre pixel of the edge, centre is a flat fill. */
var UI_SLICE: any = {
  btn_play: { l: 6, r: 6, t: 6, b: 7 },
  btn_sec: { l: 4, r: 4, t: 4, b: 5 },
  panel: { l: 4, r: 4, t: 4, b: 4 },
  cell: { l: 3, r: 3, t: 3, b: 3 },
  tab: { l: 1, r: 0, t: 3, b: 0 },
  slot: { l: 3, r: 3, t: 3, b: 3 },
  name_row: { l: 3, r: 3, t: 3, b: 3 }
};
function drawNineSlice(ctx: Ctx, key: string, x: number, y: number, w: number, h: number, sl?: any) {
  x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
  var im = UI_IMGS[key];
  if (!(im && im.complete && im.naturalWidth)) return false;
  ctx.imageSmoothingEnabled = false;
  if ((ctx as any).webkitImageSmoothingEnabled !== undefined) (ctx as any).webkitImageSmoothingEnabled = false;
  var iw = im.naturalWidth, ih = im.naturalHeight;
  if (w === iw && h === ih) { ctx.drawImage(im, x, y); return true; }
  sl = sl || { l: 4, r: 4, t: 4, b: 4 };
  var L = sl.l, R = sl.r, T = sl.t, B = sl.b;
  var midW = iw - L - R, midH = ih - T - B;
  var dw = w - L - R, dh = h - T - B;
  if (dw < 1 || dh < 1 || midW < 1 || midH < 1) { ctx.drawImage(im, x, y, w, h); return true; }
  var cx = L + Math.floor(midW / 2), cy = T + Math.floor(midH / 2);
  ctx.drawImage(im, 0, 0, L, T, x, y, L, T);
  ctx.drawImage(im, iw - R, 0, R, T, x + w - R, y, R, T);
  ctx.drawImage(im, 0, ih - B, L, B, x, y + h - B, L, B);
  ctx.drawImage(im, iw - R, ih - B, R, B, x + w - R, y + h - B, R, B);
  if (dw > 0 && T > 0) ctx.drawImage(im, cx, 0, 1, T, x + L, y, dw, T);
  if (dw > 0 && B > 0) ctx.drawImage(im, cx, ih - B, 1, B, x + L, y + h - B, dw, B);
  if (dh > 0 && L > 0) ctx.drawImage(im, 0, cy, L, 1, x, y + T, L, dh);
  if (dh > 0 && R > 0) ctx.drawImage(im, iw - R, cy, R, 1, x + w - R, y + T, R, dh);
  if (dw > 0 && dh > 0) ctx.drawImage(im, cx, cy, 1, 1, x + L, y + T, dw, dh);
  return true;
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
  /* Full portrait, integer device px per art px, centred in the slot. Prefer the 32 px file,
     or the 64 px file scaled down by an integer, whichever fills more without overflowing.
     crop=true keeps the old tight crop for any leftover callers; lobby/shop use crop=false. */
  var cand = [[im32, 32], [im64, 64]];
  for (var i = 0; i < cand.length; i++) {
    var c: any = cand[i][0], n = cand[i][1] as number;
    if (!(c && c.complete && c.naturalWidth)) continue;
    var kk: number;
    if (crop) {
      var base = n * 0.66;
      kk = Math.max(1, Math.round(dev / base));
      while (kk > 1 && n * kk > dev * 1.6) kk--;
    } else {
      kk = Math.max(1, Math.floor(dev / n));
    }
    var fill = Math.min(1, n * kk / dev);
    var score = fill + (n === 64 && fill >= 0.85 ? 0.05 : 0);
    if (score > best) { best = score; im = c; k = kk; srcN = n; }
  }
  if (!im) return -1;
  var side = crop ? Math.min(srcN, Math.floor(dev / k)) : srcN;
  var sx = crop ? Math.round((srcN - side) / 2) : 0;
  var sy = crop ? Math.max(0, Math.round((srcN - side) / 2) - Math.round(srcN / 16)) : 0;
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
  applyHeroContrast(ctx, function () { drawJumperRaw(ctx, x, y, lk, face, pose, blink, alive, sc, fine); });
}
function drawJumperRaw(ctx: Ctx, x: number, y: number, lk: any, face: number, pose: string, blink: boolean, alive: boolean, sc?: number, fine?: boolean) {
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
