import { useEffect, useRef } from "grok/canvas";

/* Хоппак v0.5 — pixel-art jumper for friends.
   Single source of truth: this file. hoppak.js is generated from it (build.sh). */
type Ctx = CanvasRenderingContext2D;

var DEFAULT_LW = 160;
var DEFAULT_LH = 346;
var DEFAULT_PX_PER_M = 8;
var LW = DEFAULT_LW;
var LH = DEFAULT_LH;
var VIEW_PAD = 0; /* extra scenery px on each side; not part of the world */
function viewX0() { return -VIEW_PAD; }
function viewW() { return LW + VIEW_PAD * 2; }
function dimView(ctx: Ctx, col: string) { rect(ctx, -VIEW_PAD, 0, LW + VIEW_PAD * 2, LH, col); }
var PX_PER_M = DEFAULT_PX_PER_M;
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
  { id: "pilot", name: "Капитан", hood: "#2c3a5c", price: 0, ab: "dash", abName: "РЫВОК", type: "БАЗОВЫЙ", abDesc: ["КОРОТКИЙ БЫСТРЫЙ", "ВЗЛЁТ НА РАНЦЕ"], charge: "time", need: 250 },
  { id: "pirate", name: "Пират", hood: "#a8282c", price: 150, ab: "hook", abName: "КРЮК", type: "МАНЁВР", abDesc: ["КРЮК К ПЛАТФОРМЕ", "ИЛИ МОНЕТЕ, БЬЁТ МОБОВ"], charge: "time", need: 400 },
  { id: "ninja", name: "Ниндзя", hood: "#26305a", price: 200, ab: "wall", abName: "СТЕНЫ", type: "ПАРКУР", abDesc: ["6 СЕК ЦЕПЛЯЕТСЯ ЗА КРАЙ,", "ТАП - ПРЫЖОК ОТ СТЕНЫ"], charge: "time", need: 500 },
  { id: "robot", name: "Робот", hood: "#d8dce8", price: 240, ab: "dome", abName: "КОСМОЩИТ", type: "ЗАЩИТА", abDesc: ["ЩИТ 4 СЕК, СПАСЁТ", "ОТ ПАДЕНИЯ"], charge: "height", need: 200 },
  { id: "mage", name: "Маг", hood: "#7a3ac8", price: 280, ab: "tele", abName: "ТЕЛЕПОРТ", type: "ТЕЛЕПОРТ", abDesc: ["МИГОМ НА НАДЁЖНУЮ", "ПЛАТФОРМУ ВЫШЕ"], charge: "coins", need: 12 },
  { id: "knight", name: "Рыцарь", hood: "#c02a2a", price: 320, ab: "pound", abName: "ТАРАН", type: "АТАКА", abDesc: ["ПИКЕ ЩИТОМ ВНИЗ,", "С ПЛАТФОРМЫ СУПЕРПРЫЖОК"], charge: "kills", need: 2 }
];
/* Hero sprite sheets (made by /workspace/jumper/sprites_tool: make_sheet.py + unify.py).
   One row of 7 cells: idle, squash (landing), up, fall, ability, ko, blink. Facing RIGHT, hard alpha.
   Cell = 36x32 game px stored at 1.5 art px per game px (54x48 px), drawn x2 nearest on the x3 canvas.
   Head centre at x=16 game px (24 art px) of the cell, feet on the bottom edge, shared 48-colour palette,
   1-px dark outline #140c1c. */
var SPR_SC = 3;
var SPR_CW = 36, SPR_CH = 32, SPR_AX = 16;
var SPRITE_POSES = ["idle", "squash", "up", "fall", "ability", "ko", "blink"];
var HERO_SPRITES: any = {
  pilot: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAXoAAAAwCAMAAAAoykEcAAAAw1BMVEXp6+rf0NbwyaLus4PutVeU4vHFuL61pKpLxOvak2OulI/olSTDaxKph22QiJ2HdYEtldBqY3y8bkLLPTCFU56GYlBiVGGFTjRoRDhwOidwRIZRPHBNQ1Iha6U4O1tONzhdNiw5NUUjTXevLyWPJiRUKyBqHB1CLzBGJR83IyRPFB0rMVItKjQoIUQqHiQaHjk6FhYpFBcoCQcYKU4eGSQUDBwaEhYaCg4XEi4PDBULDCYNDAwLBRISBAQFBBwUDBwAAADH/NxIAAAAQXRSTlP/////////////////////////////////////////////////////////////////////////////////////ADBV7McAAAm6SURBVHja7ZoNc6LKEoblcAOiBCNbflBriGyCwg4wuNhGcJza//+rbo8YN5pNaLLnnFt1y66Iu1W2MzzT/XYzTufn1f5H1rkiuKK/or/aFf0V/dWu6K/or3ZFf0V/tSv6K/qrXdFf0V+tLXpAu9L5M2tg2HnHR1RSXuH/GfcGhp3fOVUamqNpg38FPsD/X4pRGL5FXztpGmN4qf55JFClQRJI+JvT+d+Ujs8xfIMegqNXp+Pjm4B/lgeAowabaWZbPylUOsMfZhvtgwKtxVg0hpfoYVx7aR2fGS3DHidXVlXZhgeoqWnpcIjhAW0XzDA1bQufBi+3nAfNcwUYGIbRcwxjTRyLyPACPRi1U1nuhHoHQeaI93IcUSOrB9QznAl0NegxXC+Y5nxtHRu//qUdtbhp7SAwlA1meCEmCZHhOXoYaL9swg5XIo8X8Cmjs6/vX3s6DlgUe9q9iTqdayltkWL393A2WVMzTc2Hj8c6kE+MRC0BZSwyw845PkOt2FY7sw1Q4smsP+zXPEjsX3xeGaW0/HI73Bc57OFe0+7gdVxqLG2YKzjG0RKDFvZ0hufoTfx6k798fl2/2aTxjj7OkBUqnigID05VevSsiOhPSorGFfycKlM3+GEV98jzCGS300zjA02FmXGytYK/ai4NZIadMxamaTh86p80m4zeNH6x16joVURV6ezoOBe0bHmbKyFR3ro1ejDr2Z5KUzJ57wugZ1zYsqk00Bmeo3ccR05nhTjekqf+8QQ0iEZdtjTOt1vz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",
  pirate: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAXoAAAAwCAMAAAAoykEcAAAAw1BMVEXp6+rf0NbwyaLus4PutVeU4vHFuL61pKpLxOvak2OulI/olSTDaxKph22QiJ2HdYEtldBqY3y8bkLLPTCFU56GYlBiVGGFTjRoRDhwOidwRIZRPHBNQ1Iha6U4O1tONzhdNiw5NUUjTXevLyWPJiRUKyBqHB1CLzBGJR83IyRPFB0rMVItKjQoIUQqHiQaHjk6FhYpFBcoCQcYKU4eGSQUDBwaEhYaCg4XEi4PDBULDCYNDAwLBRISBAQFBBwUDBwAAADH/NxIAAAAQXRSTlP/////////////////////////////////////////////////////////////////////////////////////ADBV7McAAAmGSURBVHja7Zt/i9s6FoYzsZlge3yHq+CxBQVp8Q9JIQh7iGSElGW//6faoyRt78zNxccD7cISdUz7R1XJj97zniNZ3fzn0f5HbfNA8ED/QP9oD/QP9I/2QP9A/2gP9A/0j/ZA/0D/aA/0D/SPthK9+d4ehL7clhjeR29kkqbwU9sH+y+TX2J4F71J05TFlqbmt8nj/438IsPN/V6MNazZMiEK8+vBVw1Ms18L/3eu1/qxEAw3d0axcbm2bAtNSPIFImvVkV7EkZlVw9gsy36PHxrjyrxcMRaO4Wf0xgqRZjFQSrYVW8bWyd6YNEmSFfCjOgSMJgRbY25mmyagKQjmXw/f7PKcsW95jh0LyXDzGZ0S9upRccUASY1/OVhsSCzbJMEKOEZIeh0pqgO/yubqo7BmYFS/mnyZi2srlcG9FY7hR/RmDnq8pYfYZ6sEKzh2sUNyGxCZno1hIuWXscSTgnc7Y0eS6S2aK/GrCwGjSiF24vn5+e1Yot4Ky/AT+qJI0+qKTykRcTBBCJJjDeNVkFlyhgJijBD1dYrlRR0QmDhZiZREzWugz0S20hHXpUxzLCugcNTPwB/FHs3wA3pDNPzN2EeHrusoHebYExNnRjAdMeavQDEvEeZhnBJVehlNXNTBhCoQngNrfLp2u65XOq8hqWJWT9GBbJjNj9Fsdrsd5KPSL46FZ7j5kB5etI7LpLt2v+84pbTug1LaYOxNZek1xnKGyc4gDlLcDEppDfoA9IhVhhym0ttIsNIVE0WKLj4gRzSxK7JsM/aoy/JCHp7XN5D9UqGzguEH9OSkY4udxqYnlPae0oAgTwpq079mFqYX2IM4tNJRHmrqWhAH7UaNQG/gLc7XkQSsmIi1kXrBijhLIDU/bxtchjDAwpfXFAt/jOo/qmrpvdAMP6B3sZOFXq3kY5JxmyU153Y5xogsbgqO3tFAtbLkOPG1VBTHBHOkII7G0h4RYKa47RLV3HUDHab4jwhk5XEtp94g8QmM7k1ZXjWvZ86F6K1Wx+Nx4b3wDDef9inRoNpZcboLKku2bjf1dBm9Ujd/u5V8l/maJfTQpm6/n7jMekpn+B3lpNGaLCxYS+taks4iDPHSFZJ/dRHHFrddMZWOtn20TVXBHqLRFbd6WRtohp8qHOc62gXJyTkBnPHplUPw0Ff2yrrzPIcgFm37qo4RvGbis89Utq3mmSKsDUaCSe0hnHkNPjo31J1Q5ZRW8zVFKBG394g6oLqoQ1RVpcUb9PTwYxHlA5LhR9VDYuiGORkblSSAMwE35cv1w0XBMAJoGNrA6XAIesm1jQlhGtpRTGTnblOUi4v8Ek1XDRfyJOHvSSYpR1V8aXotA4RwwUWTWnIpUx0v5EHzk6hyYfNSMbYMA81w87HXvoVehMw8SeK2FB5EKXs1D9uBeexjOUV7OphF9PvWtp2fOMwwTnELU1xGD+6iNe32554HRwhEs3Uo9EQLEp1wBhOmdDxYtThBcBd9Yk3lhQi+qvIdjLWYVVYw/IQeDMC5JNv/bIjCzfTuFA4xp+/3A21iPVXzhUlexNG5hPRNEqcX55jMiCpWg5O2VszZFsIkPg5zlGCulihhjpxONZk4wjnMSXvWWGHLHaxCfLxCoMcy/JRmx7a1daBz970pzB5nP7th6NrWTBMoClRfA/tF9O0Q0Wf85xQ9wty47Q525s2PaPYTDj00MKrA6+10TphFLJgRlivnBMvz0wnQn07+hFgwLMPN39ZM2eLFhSAtGQYXEBMEZvS960Yr+4n3/Uz76h3wL8VzaLthOmfZjxl2c5Kcl1XVjUPSjhef2saA3uLqmxgt3V5JecsrGE1VfBJ5MzGd5/kOfuU7zCpjGX5C3+09zM0MA1UzIbDsOPTtYfAJVOcZybKejxmRiwFtIPaD6sfeTcO1zYEkGSKghwCx8jOeFepIBnLPfugmar8Hy7TczVSVCHmVl833phFjoRn+7dDYSHkeQMPFvEteyYB5Kw96shWpe55U2+ydJAnxki9DHJTz8zC+05HUThPaENIs9gIn9falG34067cBWXfIRNJLYoFg0X67tK0yvOHeVlz9aNbvPMJycAz//pXKSrDtoR/Gp/KJzB02xHyaZFPNb+GMONIy49lvt7Jr04PMyev4fuCYQjZA1pqJ9H60hFTKNEm9HCtxigcwNJI139OKXbYq46vG+Up7r21VvWnH8iZHHV6iGG7uvBykTOj67enpyZ67AWU5syFz5pIfuQ9zoGWaGl6/7ua0f9o+TdNBetQ6n0OWdu14OCREKtKlTVYjXACWbArfs8o0pSzLymXH8b4Eu5mUyiulK1ay8g11+oNhuLl3ukeq+VAc6zRztMLQaP3ZzHUffHJruENZk4E1HcDqJ0Dveos6/DUufgY7tF16yF9fJzeMFcrrzX5Umkynd5AjeA+RiOGMh+Rajg0r1R9//mm90m/ILwoYhnfQE+fsPLzQghNOw4x6LzMfDrDSztXRfh3yTBay0PksaTGlpGhGj+yVZFkjh/chBUk5eZiQ3VomIRz7dp+OsO/Dffc0u7JkSsyi3D0/w557wh6RYhjeQX8G2dpWmqIozlAC4z6KDcOBtu3BvhLfDzP6S4Q7DF1qaSELz2okQ5K9N/480PmtKs7EoT9WQ5Ejzj0lxThiv66Y19J+814w+/ZWhgo/Fobh5p6skqwnlsWDjvcB9f3NDF0xwZ5qeHv+w4XDgP50AZaYhlg52CPifORHjDF7qA1js5wZEwF9UQBGo7JXr/k7eoIGikPVOCGcmgU7osdCMNzcnWOwRDB3EiwgvW0oQiz7Oj1qwR3+ZkFNWqIYOzl7FEd8Nzq0lDVAHRZMNWbFaG0q6bjm+o6BAZiIp25aiCNDj7XM8C56yOhMaK+XDt3/UgHXysLWMjUOQKoV30qDV1G4kmrtVnQjBezvxfl8Oqq6plgpMl+kWiler7psVZUOdOHD6agbfGguM9zcPw8jfR3mnhD092OnfJaU5b/D1NdrrsYYCQi1idu/VTy8EwC9DkdD0R0BR6iFmwVdd4nBu+MRtrJeG7biUtIiw/voJwsqDtOksEo0Sp2OkhAXVN+7NehregJDndTq+4W2p1KGFRc7DKuFUF5NQpq1YwmmVHBr1LHM8D56SXkPQu45mgjoVkOZnnjJ6TrVX7awX7i/ZyYpp1UweM+/+L8GjIVSYOVd0kWG/6B6aLDWdsJfs3DO8Xj85UII/1rh2v2Xb+4ZtS5UTC+/fFPNaL02LBcZ/hc9yggi+Yv6CQAAAABJRU5ErkJggg==",
  ninja: "data:image/png;base64,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",
  robot: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAXoAAAAwCAMAAAAoykEcAAAAw1BMVEXp6+rf0NbwyaLus4PutVeU4vHFuL61pKpLxOvak2OulI/olSTDaxKph22QiJ2HdYEtldBqY3y8bkLLPTCFU56GYlBiVGGFTjRoRDhwOidwRIZRPHBNQ1Iha6U4O1tONzhdNiw5NUUjTXevLyWPJiRUKyBqHB1CLzBGJR83IyRPFB0rMVItKjQoIUQqHiQaHjk6FhYpFBcoCQcYKU4eGSQUDBwaEhYaCg4XEi4PDBULDCYNDAwLBRISBAQFBBwUDBwAAADH/NxIAAAAQXRSTlP/////////////////////////////////////////////////////////////////////////////////////ADBV7McAAAtdSURBVHja7ZsNc6M4EoYhtiXHJMLiythTAiVQtTV7J7BqD3oWsJaa//+rrgXOzI7HNsrsZGdv16p8O4rgofX225Lifby1H9S8G4Ib+hv6W7uhv6G/tRv6G/pbu6H/xgbYbuh/CPYc21+DvvdPAp9+ajnc0P+JAZ+mC89bYLMf0x8f+f8Q9Mjd85bL5WL50rwfHvnePyTivRH6emz28xIj/y+JHv46TuAPk89RahafuA9ab9HjHHjbW5xg6F3oZMKQ8b8FfCTvDeSXL9wH9mmK379l4E8y9M52kjJnvk+o+hvAhyP5tRqhK9O1B3SYFv96DW8GfpLhGfTQUuJ7ee5hR8nh70I+v7tPkXifMp8x1g/wMfTfJrhcGH6NHgw+LA/7cNvPZ/B/Tn4xkk/z+RZxS0pIjvdFRDuyX7yF0XFieIoePoJc3WM/f3z36Z+AHt4sqX8mn6YUyQti7wrZ+4IeA3/x3Qd2ZHiCHji0IZ3N8Hl1DfR91wsXJn+MGwjCGDfwNnKDRmZIrzmTeYdEbDBaIITbNQX70nce2JXh1+gNZ5SIDq9VqarSuusmLw3uAvgcvfDaiNfVIAGla0/49GmqA+To59c25vO8YrnklCARnw+NwRj2S/guY72aoXeiURw4TpBQ58PVYtNVOY0+CJ7AuilDKVPmNfCHfDRKAHXM6eB9es4THdBXLqyntDGfa6F6Floi+XBnWguLHt+usAd/HKsFiF0Dw5XhCXqPy1XgyWa99NZDL7zCaSWA7bMlHxLLkFBW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",
  mage: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAXoAAAAwCAMAAAAoykEcAAAAw1BMVEXp6+rf0NbwyaLus4PutVeU4vHFuL61pKpLxOvak2OulI/olSTDaxKph22QiJ2HdYEtldBqY3y8bkLLPTCFU56GYlBiVGGFTjRoRDhwOidwRIZRPHBNQ1Iha6U4O1tONzhdNiw5NUUjTXevLyWPJiRUKyBqHB1CLzBGJR83IyRPFB0rMVItKjQoIUQqHiQaHjk6FhYpFBcoCQcYKU4eGSQUDBwaEhYaCg4XEi4PDBULDCYNDAwLBRISBAQFBBwUDBwAAADH/NxIAAAAQXRSTlP/////////////////////////////////////////////////////////////////////////////////////ADBV7McAAAoLSURBVHja7Zptc6M4EscdcOLALmHgeBASg6HqWENAPB1t4xhS+/0/1TVO7uomzsXNTNXevbBSrrzqaumn7r9aLVZ/3sb/aKxuCG7ob+hv44b+hv42buhv6G/jhv6G/jZu6G/ob+OG/ob+NujoAceNy68NEsML9DAI4d3g/xp5EsOP6IE7quPw/sb+F8jTGK4+7pfDdQcHh/+fzPzUCv4ib8t9URn+iB5GHgk0UtS/hD1gfMC4GAecOOfjT0DkPNnDUl+e552WGJEZfkA/8DpCM3NOmOVIFgYIhM6cmcJcGFXgOJrjJEuD0Tt7GxZZwdGyDMsqF/giM/yAXkiYd+ycLvy0jCXsHcdaEiDABUdHquksoQgWP89v4xyXUXSE8zSbLVmS51nz0Besi8zwA/oQQLytTOVClFVfkkPy3Z8krwwSPsw2KoZHuQBH4hT8nM/OEvWAmg/vZq/wHxl0xZeVIPyNbllkX2SGqwvNEDMKLnGWa9vzEjsFap5xx5x3OgRy0L+8R4eGRtQMA1G8zH7wJOMRLEmx8S1ZHOffvuD+O3yNsYQ57k3L8hKg6y6J4UVxObqGHvE5Ftu2qaSUDKhLE287Tc1oiMq9mCE6QoqQrddaByTBwV0+VxA65zV9x2o8//i72YgDzeB+9fg1eg96z5wlx/S8nuqLyPASPXJAI61qsowFu4MUtJVJLt/Q028FAD1fqyjBjqHt2qMsIp+0MhgsPB8cPMuMtapptkebIS4NvXHhbNbGIKU9ATw+PsK1KXo6xn2C8A3dNF1KShMZXqCPUKc0NY8D3/VjNzgWxIVFr+a7wuHhAgQQ5/0SOs5Rsdsqi4NGDle3+d2Mo4o6+jqemmaQhU3NsrOZo6K3XMroBPZjbcAVXxWiD5H77lShapcuBT2N4Uet9wT3tMMudXPfjxs/aLCMAKrCvZF/wgVey03ATId5jtLR7TxOfT9z/a64VrPA4wpmtRc1d9ZVnqYZy/rBJaIXYnCcddukQRywKQLwO7v9r7bw9DD7SsLes4y+yvNqW+17QiBSGX6ocEC49iEP/CC1g5hpqR/HAN9o7F/Oh4uQqKgqCnfQwFcM7x91wDjkardjPs6RxT67qqTwbRZnTBZuuzvGfLcJ/IM8UqNecM2omO/7DXP3PXh29oVHsB6e0FcZeq6Xb7eMtVt2Kq/7IjP8AT1U7m991cR+1qkaOmMsaCdcLon9rB78fI2zD201FFH0hRDAt8dvWYJFmNbGmJNbHE3cxFfRPz3ijr2iWZcF/jNjceYz6r0Ws9LudhiEKXO3PuJwfeur6Hh6ejJhDD3jkO+Q+3ZXse11X3SGqx+sNCnbLI3jZ+WVnUdzgDlAgRZUWE05hl01aZamA4bmVwtjtQVSYxULcju9d133viWUsaA+acANt2EsddU0VTWcLjXoXa1NWdqpu0ZV42wCPGi/NNAtA0LTQ+q5p+e5buT57mpw0Bn+gN6VxZhnbpzOJM6/HMB7fPxOjHo8+bo8jn03c4MOipev0Idp0Go1TjLolJNhGKNySK/XbtCiUGt7PJQz/YTLmqaJeu8QdpPj0fDH5DKWu02LUn+lumnzbGfsUWwq/YRpib7y60FPZ/ij4HhZts9UrdH/NVDs7G81pYSYm1Oa26IOdL5/iP1AvnwdUzD5lcym51hV5jEqWOwp01X2edzJKt2nxt1xYmzcTxntJNoHGIyHeIr7I5olRxP86tqhns9lTb7Pzc1x2m5PewL6BQxXFw2w41HP1BlHVSl4x4HJDraUs8VHiU/9LOg0Fm9bP0Md+LrISVt/alUtV96cqZPb2spV9CbzjT3TMlcpt/eurtzT7jnAwuS11ZpOuWPnYATlui8rZOZ+a1TeQ7l98MzNA8UXmeHqE+EYhukciLMVzvmZ4G743ZcVikecvadZnFV4rH95PoPV/bHtu055H/P9aiKsTNHUA/5wZb5RVQwqgtUbkb2i4lD+9veqGg6qQvC1MfQT/vTNhpl9v4Ven2jiS2C4+qzf7HoCUKyTuc8EPqGBBrYsoMmmODPOYx9nWLd9v3ZNV33miki+Kc6ApTrlGgyqzZxBzDtm+4oS8YYA8c1w1cvJQDNbGT3RNIR16e7WgvCw2WxcttkkXqtvaK0EAsNP0L9iqcJd35ZmNAKcaJf7zBXNZGft21aXCsZ88/h4pSqFDrjDC20IutoW3AxJ4Tsxw3EiTTbo6IjV7FqjtR8U1eW1zqvnKcEKf6CsC05b0/ISs2w3D5tjYnkGrZFLYrj6tPnLxVCsCiE474yJepkdZyl4Vzh1Pluukf8TtjXnXEhbtUP0JhIS+lGu0Uoa0m4E3gy4diRZFUwVBheRavtmJERG81UbnueVZum2IYSe5x6J3VUCw9WlN3NuMbE75wk3bq1oCvXGUkSy9NV34Z7R29cCC1xbRFHhGMLKhQxrmo5a0sYFReLZxBoaN8yjQRRRXczdVQ03Sw5lQPLlVW6Y4F9l9UYf4qBNkcTwEj13HBE569XmSRt48Kx2VPQgZcIhm8HjBIHFhOM5gfk6oN2tZEh+EYM99LXkjn93p6G1oHXPkH3hzh3Fw8ODDVA2QPXVl6HFHh4MqJKQ1i6iMbxEv1a55NzQNHstRJxO5BcCPCe59AY73w14U40DYgNYODxdZ/3hFRa8RcwZDb8/9wf6Eya6khBxd5dp/csCK5iFZs+aPd0XjeEl+sZPh9mssSdRMp/+JjlvtZDyQQ5C6xTSJROSiGNhk2taEXkF+eMfmE9Xewzs1yiiv7TOCcZ5K1+K0KI/b8ExMT133LpjmFAfg2kML9GriooyNURFAe7KSpcEPaL3zDspRWqrKkWA5w4/1/qikFJGhaSubN4vfohCUUchGeLcy+W8SaKhjiK6VRJ6lndIwrBHzadOkMRw9ZkEYCAWcigKe+yor+Jo5a7XWoQBfABZMkrBB4hCW3dDFL1MtYykpHZj5oc+VSL21yKq6c/23Fu3USQrJiW52xnO3yToJWIfy6SnaxuB4eoSIVrxXCZ1VDSCqjdQC8g1tT1kdppEY3wgyQ3X4j1gDNZJGkOdEIMKDERvj5gnMqdu11xqb9ebYxHh5OLYIluZiN49VWVSVmVJD0MKwwv0Ww+tTBgKNBsFeYpYu4GqHhKJ4RtFxLuAbUIY1yg0EGQn+ic/oDmaLMahkFlM/x4E0tWqlbKGOF7yJY5hGWV52pdltSNLPY3hpeAEv5leII/QpMHY0hfmpjZCD/uhLop/nKjv4tBmAdKDdlrySc2kdXEzNWlmLvlwDVZhlrZLv5CbzMOunaq8siw6DBLD1Wfd3CaeAA5p0CxZGFL02xr/xc90O2jfnCz7iO/88julzcIPUcEL5meVpZ8Zzr521SJfJIarz9rUjPUAY9V0i+Jjn22zPeC/XUZHH8ZPP/ldLcTT4o9C8+rnnMF2oS8Kw38CJAX71Vh1tH4AAAAASUVORK5CYII=",
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
  "9": [14, 17, 17, 15, 1, 1, 14], " ": [0, 0, 0, 0, 0, 0, 0], ".": [0, 0, 0, 0, 0, 12, 12],
  ":": [0, 12, 12, 0, 12, 12, 0], ",": [0, 0, 0, 0, 12, 4, 8], "-": [0, 0, 0, 14, 0, 0, 0], "—": [0, 0, 0, 31, 0, 0, 0],
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
  sfxOn = !!s.sfx; vibOn = !!s.vib;
  return s;
}
function writeSave(s: any) { storageSet("hoppak_save", JSON.stringify(s)); }

/* ---- audio / vibro (WebAudio, no files: Canvas CSP blocks data-URI) ---- */
var audioCtx: any = null, sfxOn = true, vibOn = true, sfxMem: any = {};
function audioUnlock() {
  try {
    var AC: any = (typeof window !== "undefined") && ((window as any).AudioContext || (window as any).webkitAudioContext);
    if (!AC) return;
    if (!audioCtx) audioCtx = new AC();
    if (audioCtx.state === "suspended") audioCtx.resume();
  } catch (_e) {}
}
function hopVib(ms: any) {
  if (!vibOn) return;
  try { if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(ms); } catch (_e) {}
}
function beep(freq: number, dur: number, vol: number, type: string, slide?: number) {
  if (!sfxOn || !audioCtx) return;
  try {
    var t0 = audioCtx.currentTime, osc = audioCtx.createOscillator(), g = audioCtx.createGain();
    osc.type = type || "square";
    osc.frequency.setValueAtTime(freq, t0);
    if (slide) osc.frequency.linearRampToValueAtTime(Math.max(40, freq + slide), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g); g.connect(audioCtx.destination);
    osc.start(t0); osc.stop(t0 + dur + 0.02);
  } catch (_e) {}
}
function hopSfx(kind: string) {
  if (!sfxOn) return;
  audioUnlock();
  if (!audioCtx) return;
  if (kind === "jump") { beep(200 + Math.random() * 36, 0.045, 0.045, "sine", 40); }
  else if (kind === "coin") { beep(880, 0.04, 0.05, "square"); beep(1170, 0.06, 0.04, "square"); }
  else if (kind === "bonus") { beep(520, 0.06, 0.06, "triangle", 200); beep(780, 0.1, 0.05, "triangle"); hopVib(18); }
  else if (kind === "hit") { beep(140, 0.1, 0.08, "sawtooth", -80); hopVib(30); }
  else if (kind === "death") { beep(220, 0.22, 0.08, "sawtooth", -160); hopVib([40, 40, 60]); }
  else if (kind === "warn") { beep(160, 0.08, 0.05, "square", -20); }
  else if (kind === "deny") { beep(110, 0.07, 0.05, "square"); hopVib(12); }
  else if (kind === "tick") { beep(940, 0.02, 0.03, "square"); }
}

var FIRST_TOAST: any = {
  break: "ЛОМАЕТСЯ ПОСЛЕ ПРЫЖКА",
  goal: "ДОПРЫГНИ ДО ЦЕЛИ",
  record: "ТВОЙ РЕКОРД - ПОБЕЙ!"
};


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
function drawJumper(ctx: Ctx, x: number, y: number, lk: any, face: number, pose: string, blink: boolean, alive: boolean, sc?: number) {
  var s = sc || 1;
  x = Math.round(x); y = Math.round(y);
  var flip = face < 0;
  var spr = heroSprite(lk.id);
  if (spr) {
    var pn = !alive ? "ko" : pose === "idle" || !pose ? (blink ? "blink" : "idle") : pose;
    var fi = SPRITE_POSES.indexOf(pn);
    if (fi < 0) fi = 0;
    var fw = (spr.naturalWidth || spr.width) / SPRITE_POSES.length, fh = spr.naturalHeight || spr.height;
    var dw = SPR_CW * s, dh = SPR_CH * s, cx = x + 6 * s, by = y + 16 * s;
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
  var g = FONT[ch] || FONT["?"];
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
function bigWidth(s: string, k: number) { return String(s).length * 6 * k - k; }
function drawBig(ctx: Ctx, s: string, x: number, y: number, face: string, k: number, align: string, outline?: string, shadow?: string) {
  s = String(s).toUpperCase();
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
