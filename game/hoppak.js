/* Хоппак v0.6 — generated from hoppak.page.tsx by build.sh, do not edit */
(() => {
  var LW = 160;
  var LH = 346;
  var VIEW_PAD = 0;
  var VIEW_CROP = 0;
  var HUD_INSET = 0;
  function viewX0() {
    return -VIEW_PAD;
  }
  function viewW() {
    return LW + VIEW_PAD * 2;
  }
  function hudY(y) {
    return y + VIEW_CROP + HUD_INSET;
  }
  var VIEW_BOT = 0;
  var VIEW_SHIFT = 0;
  function viewBottom() {
    return LH - VIEW_BOT;
  }
  function viewBotMax(lh) {
    return Math.max(0, Math.floor(lh - (lh * 0.42 + PH + JUMP_H + 12)));
  }
  var TOP_CROP_MAX = 80;
  function dimView(ctx, col) {
    rect(ctx, -VIEW_PAD, 0, LW + VIEW_PAD * 2, LH, col);
  }
  var PX_PER_M = 8;
  var REMOTE_ALPHA = 0.84;
  var PW = 12;
  var PH = 16;
  var GRAVITY = 0.19;
  var JUMP_V = -5.55;
  var JUMP_H = JUMP_V * JUMP_V / (2 * GRAVITY);
  var SPRING_V = -8.15;
  var STOMP_V = -5.2;
  var MAX_VX = 2.7;
  var ACCEL = 0.16;
  var TURN_ACCEL = 0.24;
  var AIR_FRIC = 0.91;
  var ICE_FRIC = 0.975;
  var STEP = 1 / 50;
  var ROW_SEP = 28;
  var GAP_CAP = Math.floor(JUMP_H - 6);
  var X_SEP = 10;
  var INK = "#0c0818";
  var C = {
    navy: "#162040",
    cream: "#f6ecd0",
    coral: "#ff645e",
    mint: "#62e6be",
    ink: INK,
    wood: "#c48448",
    woodD: "#8a5a28",
    woodL: "#e0a868",
    edge: "#5ee0d0",
    spring: "#d4dce6",
    springD: "#7a869a",
    brk: "#e85096",
    brkD: "#8a2860",
    brkRim: "#ffd0ea",
    mov: "#3a8ec8",
    movD: "#1e5a86",
    red: "#ff5a62",
    gold: "#ffd046",
    goldD: "#b07a10",
    silver: "#b8c0d0",
    bronze: "#c48448",
    brick: "#463a64",
    brickL: "#5a4c82",
    roof: "#342a4e"
  };
  var CHARS = [
    { id: "pilot", name: "\u041A\u0430\u043F\u0438\u0442\u0430\u043D", hood: "#2c3a5c", price: 0, ab: "dash", abName: "\u0420\u042B\u0412\u041E\u041A", type: "\u0411\u0410\u0417\u041E\u0412\u042B\u0419", abDesc: ["\u041A\u041E\u0420\u041E\u0422\u041A\u0418\u0419 \u0411\u042B\u0421\u0422\u0420\u042B\u0419", "\u0412\u0417\u041B\u0401\u0422 \u041D\u0410 \u0420\u0410\u041D\u0426\u0415"], charge: "time", need: 400 },
    { id: "pirate", name: "\u041F\u0438\u0440\u0430\u0442", hood: "#a8282c", price: 150, ab: "hook", abName: "\u041A\u0420\u042E\u041A", type: "\u041C\u0410\u041D\u0401\u0412\u0420", abDesc: ["\u041A\u0420\u042E\u041A \u041A \u041F\u041B\u0410\u0422\u0424\u041E\u0420\u041C\u0415", "\u0418\u041B\u0418 \u041C\u041E\u041D\u0415\u0422\u0415, \u0411\u042C\u0401\u0422 \u041C\u041E\u0411\u041E\u0412"], charge: "time", need: 400 },
    { id: "ninja", name: "\u041D\u0438\u043D\u0434\u0437\u044F", hood: "#26305a", price: 200, ab: "wall", abName: "\u0421\u0422\u0415\u041D\u042B", type: "\u041F\u0410\u0420\u041A\u0423\u0420", abDesc: ["6 \u0421\u0415\u041A \u0426\u0415\u041F\u041B\u042F\u0415\u0422\u0421\u042F \u0417\u0410 \u041A\u0420\u0410\u0419,", "\u0422\u0410\u041F - \u041F\u0420\u042B\u0416\u041E\u041A \u041E\u0422 \u0421\u0422\u0415\u041D\u042B"], charge: "time", need: 500 },
    { id: "robot", name: "\u0420\u043E\u0431\u043E\u0442", hood: "#d8dce8", price: 240, ab: "dome", abName: "\u041A\u041E\u0421\u041C\u041E\u0429\u0418\u0422", type: "\u0417\u0410\u0429\u0418\u0422\u0410", abDesc: ["\u0429\u0418\u0422 4 \u0421\u0415\u041A, \u0421\u041F\u0410\u0421\u0401\u0422", "\u041E\u0422 \u041F\u0410\u0414\u0415\u041D\u0418\u042F"], charge: "height", need: 200 },
    { id: "mage", name: "\u041C\u0430\u0433", hood: "#7a3ac8", price: 280, ab: "tele", abName: "\u0422\u0415\u041B\u0415\u041F\u041E\u0420\u0422", type: "\u0422\u0415\u041B\u0415\u041F\u041E\u0420\u0422", abDesc: ["\u041C\u0418\u0413\u041E\u041C \u041D\u0410 \u041D\u0410\u0414\u0401\u0416\u041D\u0423\u042E", "\u041F\u041B\u0410\u0422\u0424\u041E\u0420\u041C\u0423 \u0412\u042B\u0428\u0415"], charge: "coins", need: 5 },
    { id: "knight", name: "\u0420\u044B\u0446\u0430\u0440\u044C", hood: "#c02a2a", price: 320, ab: "pound", abName: "\u0422\u0410\u0420\u0410\u041D", type: "\u0410\u0422\u0410\u041A\u0410", abDesc: ["\u041F\u0418\u041A\u0415 \u0429\u0418\u0422\u041E\u041C \u0412\u041D\u0418\u0417,", "\u0421 \u041F\u041B\u0410\u0422\u0424\u041E\u0420\u041C\u042B \u0421\u0423\u041F\u0415\u0420\u041F\u0420\u042B\u0416\u041E\u041A"], charge: "kills", need: 1 }
  ];
  var SPR_CW = 36;
  var SPR_CH = 32;
  var SPR_AX = 16;
  var SPRITE_POSES = ["idle", "squash", "up", "fall", "ability", "ko", "blink"];
  var HERO_SPRITES = {
    pilot: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAXoAAAAwCAMAAAAoykEcAAAAw1BMVEXp6+rf0NbwyaLus4PutVeU4vHFuL61pKpLxOvak2OulI/olSTDaxKph22QiJ2HdYEtldBqY3y8bkLLPTCFU56GYlBiVGGFTjRoRDhwOidwRIZRPHBNQ1Iha6U4O1tONzhdNiw5NUUjTXevLyWPJiRUKyBqHB1CLzBGJR83IyRPFB0rMVItKjQoIUQqHiQaHjk6FhYpFBcoCQcYKU4eGSQUDBwaEhYaCg4XEi4PDBULDCYNDAwLBRISBAQFBBwUDBwAAADH/NxIAAAAQXRSTlP/////////////////////////////////////////////////////////////////////////////////////ADBV7McAAAm6SURBVHja7ZoNc6LKEoblcAOiBCNbflBriGyCwg4wuNhGcJza//+rbo8YN5pNaLLnnFt1y66Iu1W2MzzT/XYzTufn1f5H1rkiuKK/or/aFf0V/dWu6K/or3ZFf0V/tSv6K/qrXdFf0V+tLXpAu9L5M2tg2HnHR1RSXuH/GfcGhp3fOVUamqNpg38FPsD/X4pRGL5FXztpGmN4qf55JFClQRJI+JvT+d+Ujs8xfIMegqNXp+Pjm4B/lgeAowabaWZbPylUOsMfZhvtgwKtxVg0hpfoYVx7aR2fGS3DHidXVlXZhgeoqWnpcIjhAW0XzDA1bQufBi+3nAfNcwUYGIbRcwxjTRyLyPACPRi1U1nuhHoHQeaI93IcUSOrB9QznAl0NegxXC+Y5nxtHRu//qUdtbhp7SAwlA1meCEmCZHhOXoYaL9swg5XIo8X8Cmjs6/vX3s6DlgUe9q9iTqdayltkWL393A2WVMzTc2Hj8c6kE+MRC0BZSwyw845PkOt2FY7sw1Q4smsP+zXPEjsX3xeGaW0/HI73Bc57OFe0+7gdVxqLG2YKzjG0RKDFvZ0hufoTfx6k798fl2/2aTxjj7OkBUqnigID05VevSsiOhPSorGFfycKlM3+GEV98jzCGS300zjA02FmXGytYK/ai4NZIadMxamaTh86p80m4zeNH6x16joVURV6ezoOBe0bHmbKyFR3ro1ejDr2Z5KUzJ57wugZ1zYsqk00Bmeo3ccR05nhTjekqf+8QQ0iEZdtjTOt1vz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",
    pirate: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAXoAAAAwCAMAAAAoykEcAAAAw1BMVEXp6+rf0NbwyaLus4PutVeU4vHFuL61pKpLxOvak2OulI/olSTDaxKph22QiJ2HdYEtldBqY3y8bkLLPTCFU56GYlBiVGGFTjRoRDhwOidwRIZRPHBNQ1Iha6U4O1tONzhdNiw5NUUjTXevLyWPJiRUKyBqHB1CLzBGJR83IyRPFB0rMVItKjQoIUQqHiQaHjk6FhYpFBcoCQcYKU4eGSQUDBwaEhYaCg4XEi4PDBULDCYNDAwLBRISBAQFBBwUDBwAAADH/NxIAAAAQXRSTlP/////////////////////////////////////////////////////////////////////////////////////ADBV7McAAAmGSURBVHja7Zt/i9s6FoYzsZlge3yHq+CxBQVp8Q9JIQh7iGSElGW//6faoyRt78zNxccD7cISdUz7R1XJj97zniNZ3fzn0f5HbfNA8ED/QP9oD/QP9I/2QP9A/2gP9A/0j/ZA/0D/aA/0D/SPthK9+d4ehL7clhjeR29kkqbwU9sH+y+TX2J4F71J05TFlqbmt8nj/438IsPN/V6MNazZMiEK8+vBVw1Ms18L/3eu1/qxEAw3d0axcbm2bAtNSPIFImvVkV7EkZlVw9gsy36PHxrjyrxcMRaO4Wf0xgqRZjFQSrYVW8bWyd6YNEmSFfCjOgSMJgRbY25mmyagKQjmXw/f7PKcsW95jh0LyXDzGZ0S9upRccUASY1/OVhsSCzbJMEKOEZIeh0pqgO/yubqo7BmYFS/mnyZi2srlcG9FY7hR/RmDnq8pYfYZ6sEKzh2sUNyGxCZno1hIuWXscSTgnc7Y0eS6S2aK/GrCwGjSiF24vn5+e1Yot4Ky/AT+qJI0+qKTykRcTBBCJJjDeNVkFlyhgJijBD1dYrlRR0QmDhZiZREzWugz0S20hHXpUxzLCugcNTPwB/FHs3wA3pDNPzN2EeHrusoHebYExNnRjAdMeavQDEvEeZhnBJVehlNXNTBhCoQngNrfLp2u65XOq8hqWJWT9GBbJjNj9Fsdrsd5KPSL46FZ7j5kB5etI7LpLt2v+84pbTug1LaYOxNZek1xnKGyc4gDlLcDEppDfoA9IhVhhym0ttIsNIVE0WKLj4g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",
    ninja: "data:image/png;base64,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",
    robot: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAXoAAAAwCAMAAAAoykEcAAAAw1BMVEXp6+rf0NbwyaLus4PutVeU4vHFuL61pKpLxOvak2OulI/olSTDaxKph22QiJ2HdYEtldBqY3y8bkLLPTCFU56GYlBiVGGFTjRoRDhwOidwRIZRPHBNQ1Iha6U4O1tONzhdNiw5NUUjTXevLyWPJiRUKyBqHB1CLzBGJR83IyRPFB0rMVItKjQoIUQqHiQaHjk6FhYpFBcoCQcYKU4eGSQUDBwaEhYaCg4XEi4PDBULDCYNDAwLBRISBAQFBBwUDBwAAADH/NxIAAAAQXRSTlP/////////////////////////////////////////////////////////////////////////////////////ADBV7McAAAtdSURBVHja7ZsNc6M4EoYhtiXHJMLiythTAiVQtTV7J7BqD3oWsJaa//+rrgXOzI7HNsrsZGdv16p8O4rgofX225Lifby1H9S8G4Ib+hv6W7uhv6G/tRv6G/pbu6H/xgbYbuh/CPYc21+DvvdPAp9+ajnc0P+JAZ+mC89bYLMf0x8f+f8Q9Mjd85bL5WL50rwfHvnePyTivRH6emz28xIj/y+JHv46TuAPk89RahafuA9ab9HjHHjbW5xg6F3oZMKQ8b8FfCTvDeSXL9wH9mmK379l4E8y9M52kjJnvk+o+hvAhyP5tRqhK9O1B3SYFv96DW8GfpLhGfTQUuJ7ee5hR8nh70I+v7tPkXifMp8x1g/wMfTfJrhcGH6NHgw+LA/7cNvPZ/B/Tn4xkk/z+RZxS0pIjvdFRDuyX7yF0XFieIoePoJc3WM/f3z36Z+AHt4sqX8mn6YUyQti7wrZ+4IeA3/x3Qd2ZHiCHji0IZ3N8Hl1DfR91wsXJn+MGwjCGDfwNnKDRmZIrzmTeYdEbDBaIITbNQX70nce2JXh1+gNZ5SIDq9VqarSuusmLw3uAvgcvfDaiNfVIAGla0/49GmqA+To59c25vO8YrnklCARnw+NwRj2S/guY72aoXeiURw4TpBQ58PVYtNVOY0+CJ7AuilDKVPmNfCHfDRKAHXM6eB9es4THdBXLqyntDGfa6F6Floi+XBnWguLHt+usAd/HKsFiF0Dw5XhCXqPy1XgyWa99NZDL7zCaSWA7bMlHxLLkFBW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",
    mage: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAXoAAAAwCAMAAAAoykEcAAAAw1BMVEXp6+rf0NbwyaLus4PutVeU4vHFuL61pKpLxOvak2OulI/olSTDaxKph22QiJ2HdYEtldBqY3y8bkLLPTCFU56GYlBiVGGFTjRoRDhwOidwRIZRPHBNQ1Iha6U4O1tONzhdNiw5NUUjTXevLyWPJiRUKyBqHB1CLzBGJR83IyRPFB0rMVItKjQoIUQqHiQaHjk6FhYpFBcoCQcYKU4eGSQUDBwaEhYaCg4XEi4PDBULDCYNDAwLBRISBAQFBBwUDBwAAADH/NxIAAAAQXRSTlP/////////////////////////////////////////////////////////////////////////////////////ADBV7McAAAoLSURBVHja7Zptc6M4EscdcOLALmHgeBASg6HqWENAPB1t4xhS+/0/1TVO7uomzsXNTNXevbBSrrzqaumn7r9aLVZ/3sb/aKxuCG7ob+hv44b+hv42buhv6G/jhv6G/jZu6G/ob+OG/ob+NujoAceNy68NEsML9DAI4d3g/xp5EsOP6IE7quPw/sb+F8jTGK4+7pfDdQcHh/+fzPzUCv4ib8t9URn+iB5GHgk0UtS/hD1gfMC4GAecOOfjT0DkPNnDUl+e552WGJEZfkA/8DpCM3NOmOVIFgYIhM6cmcJcGFXgOJrjJEuD0Tt7GxZZwdGyDMsqF/giM/yAXkiYd+ycLvy0jCXsHcdaEiDABUdHquksoQgWP89v4xyXUXSE8zSbLVmS51nz0Besi8zwA/oQQLytTOVClFVfkkPy3Z8krwwSPsw2KoZHuQBH4hT8nM/OEvWAmg/vZq/wHxl0xZeVIPyNbllkX2SGqwvNEDMKLnGWa9vzEjsFap5xx5x3OgRy0L+8R4eGRtQMA1G8zH7wJOMRLEmx8S1ZHOffvuD+O3yNsYQ57k3L8hKg6y6J4UVxObqGHvE5Ftu2qaSUDKhLE287Tc1oiMq9mCE6QoqQrddaByTBwV0+VxA65zV9x2o8//i72YgDzeB+9fg1eg96z5wlx/S8nuqLyPASPXJAI61qsowFu4MUtJVJLt/Q028FAD1fqyjBjqHt2qMsIp+0MhgsPB8cPMuMtapptkebIS4NvXHhbNbGIKU9ATw+PsK1KXo6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",
    knight: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAXoAAAAwCAMAAAAoykEcAAAAw1BMVEXp6+rf0NbwyaLus4PutVeU4vHFuL61pKpLxOvak2OulI/olSTDaxKph22QiJ2HdYEtldBqY3y8bkLLPTCFU56GYlBiVGGFTjRoRDhwOidwRIZRPHBNQ1Iha6U4O1tONzhdNiw5NUUjTXevLyWPJiRUKyBqHB1CLzBGJR83IyRPFB0rMVItKjQoIUQqHiQaHjk6FhYpFBcoCQcYKU4eGSQUDBwaEhYaCg4XEi4PDBULDCYNDAwLBRISBAQFBBwUDBwAAADH/NxIAAAAQXRSTlP/////////////////////////////////////////////////////////////////////////////////////ADBV7McAAApkSURBVHja7ZoNj5s6FoZJGmGNSbBIhCFaSzNWKJkgyoWIA+OxE93//6v2OO1qdWemw6Gr25Wu4lHVqqp74PF7Pk3w5339n1ZwR3BHf0d/X3f0d/T3dUd/R39fd/R39Pd1R39Hf1939Hf09zULPfh1Z/M/rWmGwUebDrvdywv881j8TmPTDIP3m667A+7b/aPYI/eu634XfBrDt+jhded34U/5D2IPry87vxz8Hmskhu/QH/wqC/zVz3XRX00Rf3soANj9WL9F90SGwdsDQ1cpy6qq1tHeLGY9Kby6rpvtKvhsp9PL33pi/yV/KH/xmOdsozJ8p/ryUJRVax55IoXgZo7Fwoe3w0xPef3jcJPjr1QQA20XFB46oiiyyJoBfgG8GWZsIzJ8h77Ah2yBM8UWjHFJjo5Q3QIcop/1avAjKjZzg9v1lsdIm6C5qbAzTiodh7MDPlzzPE0z8jYiw+DN8b76A3M8VpyFod9nicrKbigwxhUwNyyiHKsOzKx9mTdGYg83I4gCeJwwXImG/7gNzVaeZZn/RfznVIbBX+XRexAvXEgRMxZmq+XqmSasK+68+TSG0znh5uD1eIVEqpjThQ+vJZ4x5rFiUsKAmc6HG3Ahj8Nw4dnDDSguIKF8zrKnpzzLSe5CZxi8eSPEd3IiUSLZRsuA8STOgSjfwqOvLtaR09+f3wUC7F/hImShJAsfGnw9dOq2u0wZA39IJaZXFguO3MV2FaVoebVco5aBYivPT8+npuss5cXoDN8GnK69gpMi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"
  };
  var spriteCache = {};
  function pngInflate(src) {
    var i = 0, bits = 0, nbit = 0, out = [], outI = 0;
    function nbits(n) {
      while (nbit < n) {
        bits |= src[i++] << nbit;
        nbit += 8;
      }
      var v = bits & (1 << n) - 1;
      bits >>>= n;
      nbit -= n;
      return v;
    }
    function drop() {
      bits = 0;
      nbit = 0;
    }
    if (src[0] === 120 && ((src[0] << 8) + src[1]) % 31 === 0) i = 2;
    var lenBase = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258];
    var lenExtra = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0];
    var distBase = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577];
    var distExtra = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13];
    var order = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];
    function build(lens) {
      var counts = new Uint16Array(16), next = new Uint16Array(16), codes = new Uint16Array(lens.length), k2, l, root = {}, node, bit, code;
      for (k2 = 0; k2 < lens.length; k2++) counts[lens[k2]]++;
      counts[0] = 0;
      next[1] = 0;
      for (k2 = 1; k2 < 15; k2++) next[k2 + 1] = next[k2] + counts[k2] << 1;
      for (k2 = 0; k2 < lens.length; k2++) {
        l = lens[k2];
        if (!l) continue;
        code = next[l]++;
        node = root;
        for (bit = l - 1; bit >= 0; bit--) {
          var b = code >> bit & 1;
          if (!node[b]) node[b] = {};
          node = node[b];
        }
        node.s = k2;
      }
      return root;
    }
    function decode(t) {
      var node = t;
      while (node.s == null) node = node[nbits(1)];
      return node.s;
    }
    function fixedLit() {
      var l = new Uint8Array(288), k2;
      for (k2 = 0; k2 <= 143; k2++) l[k2] = 8;
      for (k2 = 144; k2 <= 255; k2++) l[k2] = 9;
      for (k2 = 256; k2 <= 279; k2++) l[k2] = 7;
      for (k2 = 280; k2 <= 287; k2++) l[k2] = 8;
      return build(l);
    }
    function fixedDist() {
      var l = new Uint8Array(32), k2;
      for (k2 = 0; k2 < 32; k2++) l[k2] = 5;
      return build(l);
    }
    function put(v) {
      out[outI++] = v;
    }
    for (; ; ) {
      var bfinal = nbits(1), btype = nbits(2), lit, dist, k;
      if (btype === 0) {
        drop();
        var len = src[i] | src[i + 1] << 8;
        i += 4;
        for (k = 0; k < len; k++) put(src[i++]);
      } else if (btype === 1 || btype === 2) {
        if (btype === 1) {
          lit = fixedLit();
          dist = fixedDist();
        } else {
          var nlit = nbits(5) + 257, ndist = nbits(5) + 1, nclen = nbits(4) + 4;
          var clens = new Uint8Array(19);
          for (k = 0; k < nclen; k++) clens[order[k]] = nbits(3);
          var ct = build(clens), all = new Uint8Array(nlit + ndist), p = 0, prev = 0, sym, r;
          while (p < all.length) {
            sym = decode(ct);
            if (sym < 16) {
              all[p++] = sym;
              prev = sym;
            } else if (sym === 16) {
              r = 3 + nbits(2);
              while (r--) all[p++] = prev;
            } else if (sym === 17) {
              r = 3 + nbits(3);
              while (r--) all[p++] = 0;
              prev = 0;
            } else {
              r = 11 + nbits(7);
              while (r--) all[p++] = 0;
              prev = 0;
            }
          }
          lit = build(all.subarray(0, nlit));
          dist = build(all.subarray(nlit));
        }
        for (; ; ) {
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
  function u32be(u, i) {
    return (u[i] << 24 | u[i + 1] << 16 | u[i + 2] << 8 | u[i + 3]) >>> 0;
  }
  function pngToCanvas(b64) {
    try {
      let paeth2 = function(a3, b2, c2) {
        var q = a3 + b2 - c2, pa = Math.abs(q - a3), pb = Math.abs(q - b2), pc = Math.abs(q - c2);
        return pa <= pb && pa <= pc ? a3 : pb <= pc ? b2 : c2;
      };
      var paeth = paeth2;
      var raw = b64.indexOf(",") >= 0 ? b64.split(",")[1] : b64;
      var bin = atob(raw), u = new Uint8Array(bin.length), i;
      for (i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
      if (u[0] !== 137 || u[1] !== 80) return null;
      var p = 8, w = 0, h = 0, pal = null, tr = null, idat = new Uint8Array(0), ctype = 0;
      while (p < u.length) {
        var len = u32be(u, p), typ = String.fromCharCode(u[p + 4], u[p + 5], u[p + 6], u[p + 7]), d = u.subarray(p + 8, p + 8 + len);
        if (typ === "IHDR") {
          w = u32be(d, 0);
          h = u32be(d, 4);
          ctype = d[9];
          if (d[8] !== 8 || ctype !== 3 && ctype !== 2 && ctype !== 6) return null;
        } else if (typ === "PLTE") pal = d;
        else if (typ === "tRNS") tr = d;
        else if (typ === "IDAT") {
          var n = new Uint8Array(idat.length + d.length);
          n.set(idat);
          n.set(d, idat.length);
          idat = n;
        } else if (typ === "IEND") break;
        p += 12 + len;
      }
      if (!w || !h) return null;
      if (ctype === 3 && !pal) return null;
      var data = pngInflate(idat);
      var bpp = ctype === 6 ? 4 : ctype === 2 ? 3 : 1;
      var stride = 1 + w * bpp, pix = new Uint8ClampedArray(w * h * 4);
      var prev = new Uint8Array(w * bpp), cur = new Uint8Array(w * bpp);
      var y, x;
      for (y = 0; y < h; y++) {
        var f = data[y * stride], off = y * stride + 1;
        for (x = 0; x < w * bpp; x++) {
          var v = data[off + x], a2 = x >= bpp ? cur[x - bpp] : 0, b = prev[x], c = x >= bpp ? prev[x - bpp] : 0;
          if (f === 1) v = v + a2 & 255;
          else if (f === 2) v = v + b & 255;
          else if (f === 3) v = v + (a2 + b >> 1) & 255;
          else if (f === 4) v = v + paeth2(a2, b, c) & 255;
          cur[x] = v;
        }
        for (x = 0; x < w; x++) {
          var o = (y * w + x) * 4;
          if (ctype === 3) {
            var idx = cur[x], ci = idx * 3;
            pix[o] = pal[ci];
            pix[o + 1] = pal[ci + 1];
            pix[o + 2] = pal[ci + 2];
            pix[o + 3] = tr && idx < tr.length ? tr[idx] : 255;
          } else if (ctype === 6) {
            var s6 = x * 4;
            pix[o] = cur[s6];
            pix[o + 1] = cur[s6 + 1];
            pix[o + 2] = cur[s6 + 2];
            pix[o + 3] = cur[s6 + 3];
          } else {
            var s2 = x * 3;
            pix[o] = cur[s2];
            pix[o + 1] = cur[s2 + 1];
            pix[o + 2] = cur[s2 + 2];
            pix[o + 3] = 255;
          }
        }
        prev.set(cur);
      }
      var cv = document.createElement("canvas");
      cv.width = w;
      cv.height = h;
      var g = cv.getContext("2d");
      if (!g) return null;
      g.putImageData(new ImageData(pix, w, h), 0, 0);
      return cv;
    } catch (_e) {
      return null;
    }
  }
  function heroSprite(id) {
    if (spriteCache[id]) return spriteCache[id];
    var src = HERO_SPRITES[id];
    if (!src) return null;
    var cv = pngToCanvas(src);
    if (cv) spriteCache[id] = cv;
    return cv;
  }
  function warmHeroSprites() {
    for (var k in HERO_SPRITES) heroSprite(k);
  }
  var BONUS_SPRITES = {
    bigcoin: { src: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAABqElEQVR4nJ1UO0jDUBQ9kdChlAwSHSQ4iRQnIZAhk0MnF9fQwVEci0MHhw4dikiRjh06dZDQqRQpDplK6SBmKVVCKKWU0CmIlOAgYhxinvk1TTzTfcm555773n2PggeCWLTpxRBpoL9/w7QMyl2TQBCLdrV2jQO9lkrw7lVAp1UnonSQMHnWUgkiK/iWW2lyOWYJjlnGckIOh5MViSXRAl9pQK2WAAB8pQHoTUDWII9yDslvMOywP89AEi305xkiwEt556fe9BWTRGuzw3bxDbyURxsa1GoJvJSHKms4v99GG3/7S4rIN+h4ZEKCLpEk/MYvEgDsQpXjD40GnJGZjQdQSg9gC9mwiwi4wrLyAYABm+Ns0zIoyp2/XlfB1dFTbPV1mB46+Z1W3d9y1Aye1cuA3iSOjNUeAP80FDx3YfMcek42CXwOb/tm2OEFg52TKQAaj5dfkZzCOsHyKRsiO606Yl6Ot+W1DqNIkggiFifkItVdTgKfw9HiM0QYLTKBL2GObw9n4wF6XeeGi/vB5GTodZXkDpPg2PPiUADA5jj7X0oBmJZB/QA/ZZzVyENwRwAAAABJRU5ErkJggg==", w: 20, h: 20, k: 1 },
    shield: { src: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAABdElEQVR4nJ3UIWjDQBgF4JdRWddQFTUqBoPJiDLGxEQZZXKiVE5MljE1qiamKqZGxeQoVSGMioiJEVFCWE2gUMYoExUVWYmImLuJ9NK75O4S9kxz4c/Hu5SLBgBms0MgiT8daeyanV0GLjcbxiutYjY75P7hTuah23bJ/tFJumZnX20zvf7wfSBwSUUqbfMycYpGEmwbDjw2DwAALStK7/WNNffwzfM3s2og8iwY9d2dXEMWuz6rIUQNw7cfAMDG8Qrb7qkwACkmSuRZalCFlWknBf+LSUERNn+KuRnRdpUNOaw3AD6Hya8CAwT/MotRgM28N8BsvMCFfV7csG+ssXG8tNnh4y03PBsvcphR/+VBfzrSuu2WdAsUyuLZLAMXYbzS0oOvVw1Cjxl/GpKI3httRzGA2TL7ATjVv0pj2XCfJr1qkMur3dbew0YhxrbLgSIUAOxJIGyVxYQgRQH+NWQhADlMCrJwFhW1Kg2ybWlUGAD8AUwxtRHyLrL4AAAAAElFTkSuQmCC", w: 20, h: 20, k: 1 },
    magnet: { src: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABUAAAAVCAYAAACpF6WWAAABR0lEQVR4nOWVMUvDQBTHfw0ZJHSSghlCEQcHJwcJ0imjQ76AxQ/g0Nmho4OTo9/BVcShY8lYOoVODhkkQwQRKVI65RzSC9frXVDqIv6n3Mu93/vnHXnXAgh7fcFKWZrIR94+8xYWNeW4Ya8vrm+GdfDxIWQ6mVSLNBEmsCkHqPLSRDg2J9von0Pdw+eM46vLOvBRlMwXJQCZJcmUAzBflGS6073zk19x+nd6aoTG3s9rPa3OwQrdVq66eL2fEvkO46Ik9hxir8sABFT/9EXnVADcHrgmVq0WQKcdiNnRfh0cF+XGxsH7C+oeda/89NEyrwaKDop8h8jf7MrMNwOtTqXbu93u2ksTXAfqLkHrqS1Rhavu1BM3OpVuAXTHulTYaJkD6wPdONk77UCc7QSNYAk0DXHrdSFdA6gFpDPd3begtgJN95bUF+MSk1paqG+DAAAAAElFTkSuQmCC", w: 21, h: 21, k: 1 },
    rocket: { src: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA0AAAAWCAYAAAAb+hYkAAABUklEQVR4nK1TPUjDQBh9EQeRTOGQDkcGR+nSItIpZOzQQVzNGKGDg0MQ6aJTJgcHkYJrXUSkg0JnJ4ei4hCKlQ41QwnSSYqD8DnEi7n02uLPm3Lf3bv37nv5NCjgsBIBQOs9xOtbqGX351WEw+W4XBmY2AYoS5xTKc2CREqrCJQXOJjO6c9K0rX9fB7DUz9Zn2zV4o92qGZbtktBN6KgGxHTOTUGREznZNkuWbZLaYtj9qxCEUfPLwCApfU6gnZruj0B37ue+qYxpZv7O0TNKgAgalaxslpWkxxWovNRRyJe7K9h168ntWPDTFr/u3BVgU6CUJNOG5sb0qHH3gdMsVj8NiWRhmeXEqkvwgWAXqAmWYUiAKBxFWdTO9iBU/nqnpFoQgOQdEWMQDr9bE01X2A6J/JyRKNbIi9H2T8c+I95kvC097ObmM6JHmyltZnESXufOrN6Mf6iw4AAAAAASUVORK5CYII=", w: 13, h: 22, k: 1 }
  };
  var bonusCache = {};
  function bonusSprite(kind) {
    if (bonusCache[kind]) return bonusCache[kind];
    var m = BONUS_SPRITES[kind];
    if (!m) return null;
    var cv = pngToCanvas(m.src);
    if (cv) bonusCache[kind] = cv;
    return cv;
  }
  function warmBonusSprites() {
    for (var k in BONUS_SPRITES) bonusSprite(k);
  }
  function drawBonusSprite(ctx, kind, cx, cy, k) {
    var m = BONUS_SPRITES[kind], cv = bonusSprite(kind);
    if (!m || !cv) return false;
    var kk = k != null ? k : m.k;
    var dw = Math.round(m.w * kk), dh = Math.round(m.h * kk);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(cv, 0, 0, m.w, m.h, Math.round(cx - dw / 2), Math.round(cy - dh / 2), dw, dh);
    return true;
  }
  var BONUSES = [
    { id: "bigcoin", name: "\u041A\u041B\u0410\u0414", wt: 25 },
    { id: "shield", name: "\u0429\u0418\u0422", wt: 22, t: 500 },
    { id: "magnet", name: "\u041C\u0410\u0413\u041D\u0418\u0422", wt: 20, t: 450 },
    { id: "rocket", name: "\u0420\u0410\u041A\u0415\u0422\u0410", wt: 15, t: 85 }
  ];
  var BIGCOIN = 25;
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
  var MAPS = [
    { id: "city", name: "\u0413\u041E\u0420\u041E\u0414", price: 0, goal: 500, special: "", mobs: [["blob", 180], ["bat", 400], ["bob", 800], ["hole", 1500], ["ufo", 2200]] },
    { id: "jungle", name: "\u0414\u0416\u0423\u041D\u0413\u041B\u0418", price: 80, goal: 700, special: "bounce", mobs: [["frog", 100], ["parrot", 300], ["snake", 550], ["monkey", 900], ["bat", 1400]] },
    { id: "ice", name: "\u041B\u0415\u0414\u041D\u0418\u041A", price: 100, goal: 900, special: "ice", mobs: [["penguin", 120], ["owl", 400], ["frost", 750], ["wind", 1200], ["blob", 1700]] },
    { id: "lava", name: "\u0412\u0423\u041B\u041A\u0410\u041D", price: 120, goal: 1100, special: "lava", mobs: [["magma", 120], ["spitter", 380], ["firebat", 700], ["ember", 1100]] },
    { id: "aqua", name: "\u041E\u041A\u0415\u0410\u041D", price: 140, goal: 1300, special: "bubble", mobs: [["crab", 120], ["ray", 350], ["bob", 700], ["puffer", 1100], ["whirl", 1600]] },
    { id: "space", name: "\u041A\u041E\u0421\u041C\u041E\u0421", price: 160, goal: 0, special: "grav", mobs: [["alien", 120], ["ufo", 400], ["comet", 800], ["hole", 1300]] }
  ];
  var MOBS = {
    blob: { b: "walk", w: 12, h: 8, gap: 0, plat: true, sp: 0.16, name: "\u0421\u041B\u0418\u0417\u0415\u041D\u042C", g: "m" },
    magma: { b: "walk", w: 12, h: 8, gap: 0, plat: true, sp: 0.3, name: "\u041B\u0410\u0412\u041E\u0421\u041B\u0418\u0417\u042C", g: "f" },
    penguin: { b: "walk", w: 10, h: 11, gap: 0, plat: true, sp: 0.55, name: "\u041F\u0418\u041D\u0413\u0412\u0418\u041D", g: "m" },
    crab: { b: "walk", w: 14, h: 8, gap: 0, plat: true, sp: 0.42, name: "\u041A\u0420\u0410\u0411", g: "m" },
    alien: { b: "walk", w: 12, h: 9, gap: 0, plat: true, sp: 0.3, name: "\u041F\u0420\u0418\u0428\u0415\u041B\u0415\u0426", g: "m" },
    frog: { b: "hop", w: 12, h: 8, gap: 31, plat: true, name: "\u041B\u042F\u0413\u0423\u0428\u041A\u0410", g: "f" },
    monkey: { b: "throw", w: 12, h: 11, gap: 0, plat: true, name: "\u041E\u0411\u0415\u0417\u042C\u042F\u041D\u0410", g: "f" },
    spitter: { b: "spit", w: 12, h: 10, gap: 0, plat: true, name: "\u041F\u041B\u0415\u0412\u0423\u041D", g: "m" },
    bat: { b: "fly", w: 14, h: 10, gap: 34, name: "\u041C\u042B\u0428\u042C", g: "f" },
    parrot: { b: "fly", w: 14, h: 10, gap: 38, dive: true, name: "\u041F\u041E\u041F\u0423\u0413\u0410\u0419", g: "m" },
    owl: { b: "fly", w: 14, h: 10, gap: 34, name: "\u0421\u041E\u0412\u0410", g: "f" },
    firebat: { b: "fly", w: 14, h: 10, gap: 34, name: "\u041E\u0413\u041D\u0415\u041C\u042B\u0428\u042C", g: "f" },
    ray: { b: "fly", w: 16, h: 8, gap: 34, dive: true, name: "\u0421\u041A\u0410\u0422", g: "m" },
    bob: { b: "sway", w: 12, h: 12, gap: 34, name: "\u041C\u0415\u0414\u0423\u0417\u0410", g: "f" },
    ember: { b: "sway", w: 12, h: 12, gap: 34, name: "\u041E\u0413\u041D\u0415\u0428\u0410\u0420", g: "m" },
    snake: { b: "snake", w: 10, h: 8, gap: 38, name: "\u0417\u041C\u0415\u042F-\u041B\u0418\u0410\u041D\u0410", g: "f" },
    puffer: { b: "puff", w: 12, h: 12, gap: 40, name: "\u0420\u042B\u0411\u0410-\u0401\u0416", g: "f" },
    hole: { b: "pull", w: 14, h: 14, gap: 44, name: "\u0427\u0401\u0420\u041D\u0410\u042F \u0414\u042B\u0420\u0410", g: "f" },
    whirl: { b: "pull", w: 14, h: 14, gap: 44, name: "\u0412\u041E\u0414\u041E\u0412\u041E\u0420\u041E\u0422", g: "m" },
    wind: { b: "wind", w: 24, h: 10, gap: 40, name: "\u0412\u042C\u042E\u0413\u0410", g: "f" },
    ufo: { b: "shoot", w: 14, h: 8, gap: 34, name: "\u041D\u041B\u041E", g: "m" },
    frost: { b: "shoot", w: 12, h: 12, gap: 38, freeze: true, name: "\u041B\u0415\u0414\u042F\u041D\u041E\u0419 \u0414\u0423\u0425", g: "m" },
    comet: { b: "comet", w: 12, h: 8, gap: 34, name: "\u041A\u041E\u041C\u0415\u0422\u0410", g: "f" }
  };
  var FONT = {
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
    "A": [14, 17, 17, 31, 17, 17, 17],
    "B": [30, 17, 17, 30, 17, 17, 30],
    "C": [14, 17, 16, 16, 16, 17, 14],
    "D": [30, 17, 17, 17, 17, 17, 30],
    "E": [31, 16, 16, 30, 16, 16, 31],
    "F": [31, 16, 16, 30, 16, 16, 16],
    "G": [14, 17, 16, 23, 17, 17, 14],
    "H": [17, 17, 17, 31, 17, 17, 17],
    "I": [14, 4, 4, 4, 4, 4, 14],
    "J": [7, 2, 2, 2, 18, 18, 12],
    "K": [17, 18, 20, 24, 20, 18, 17],
    "L": [16, 16, 16, 16, 16, 16, 31],
    "M": [17, 27, 21, 21, 17, 17, 17],
    "N": [17, 25, 21, 19, 17, 17, 17],
    "O": [14, 17, 17, 17, 17, 17, 14],
    "P": [30, 17, 17, 30, 16, 16, 16],
    "Q": [14, 17, 17, 17, 21, 18, 13],
    "R": [30, 17, 17, 30, 20, 18, 17],
    "S": [14, 17, 16, 14, 1, 17, 14],
    "T": [31, 4, 4, 4, 4, 4, 4],
    "U": [17, 17, 17, 17, 17, 17, 14],
    "V": [17, 17, 17, 17, 17, 10, 4],
    "W": [17, 17, 17, 21, 21, 27, 17],
    "X": [17, 17, 10, 4, 10, 17, 17],
    "Y": [17, 17, 10, 4, 4, 4, 4],
    "Z": [31, 1, 2, 4, 8, 16, 31],
    " ": [0, 0, 0, 0, 0, 0, 0],
    ".": [0, 0, 0, 0, 0, 12, 12],
    ":": [0, 12, 12, 0, 12, 12, 0],
    ",": [0, 0, 0, 0, 12, 4, 8],
    "-": [0, 0, 0, 14, 0, 0, 0],
    "+": [0, 4, 4, 31, 4, 4, 0],
    "?": [14, 17, 1, 2, 4, 0, 4],
    "!": [4, 4, 4, 4, 4, 0, 4],
    "<": [1, 2, 4, 8, 4, 2, 1],
    ">": [16, 8, 4, 2, 4, 8, 16],
    "/": [1, 1, 2, 4, 8, 16, 16],
    "(": [2, 4, 8, 8, 8, 4, 2],
    ")": [8, 4, 2, 2, 2, 4, 8],
    "\u0410": [14, 17, 17, 31, 17, 17, 17],
    "\u0411": [30, 16, 16, 30, 17, 17, 30],
    "\u0412": [30, 17, 17, 30, 17, 17, 30],
    "\u0413": [31, 16, 16, 16, 16, 16, 16],
    "\u0414": [15, 9, 9, 9, 9, 31, 17],
    "\u0415": [31, 16, 16, 30, 16, 16, 31],
    "\u0401": [10, 31, 16, 30, 16, 16, 31],
    "\u0416": [21, 21, 14, 4, 14, 21, 21],
    "\u0417": [14, 17, 1, 6, 1, 17, 14],
    "\u0418": [17, 17, 19, 21, 25, 17, 17],
    "\u0419": [10, 17, 19, 21, 25, 17, 17],
    "\u041A": [17, 18, 20, 24, 20, 18, 17],
    "\u041B": [7, 9, 9, 9, 9, 9, 17],
    "\u041C": [17, 27, 21, 21, 17, 17, 17],
    "\u041D": [17, 17, 17, 31, 17, 17, 17],
    "\u041E": [14, 17, 17, 17, 17, 17, 14],
    "\u041F": [31, 17, 17, 17, 17, 17, 17],
    "\u0420": [30, 17, 17, 30, 16, 16, 16],
    "\u0421": [14, 17, 16, 16, 16, 17, 14],
    "\u0422": [31, 4, 4, 4, 4, 4, 4],
    "\u0423": [17, 17, 17, 15, 1, 17, 14],
    "\u0424": [4, 14, 21, 21, 14, 4, 4],
    "\u0425": [17, 17, 10, 4, 10, 17, 17],
    "\u0426": [17, 17, 17, 17, 17, 31, 1],
    "\u0427": [17, 17, 17, 15, 1, 1, 1],
    "\u0428": [17, 17, 17, 21, 21, 21, 31],
    "\u0429": [21, 21, 21, 21, 21, 31, 3],
    "\u042A": [24, 8, 14, 9, 9, 9, 14],
    "\u042B": [17, 17, 17, 29, 19, 19, 29],
    "\u042C": [16, 16, 16, 30, 17, 17, 30],
    "\u042D": [14, 17, 1, 7, 1, 17, 14],
    "\u042E": [23, 21, 21, 27, 21, 21, 23],
    "\u042F": [15, 17, 17, 15, 5, 9, 17],
    "%": [25, 21, 2, 4, 8, 21, 19],
    "\u25CF": [0, 14, 31, 31, 31, 14, 0],
    "\u2192": [0, 4, 2, 31, 2, 4, 0],
    "\u2190": [0, 4, 8, 31, 8, 4, 0],
    "\u2713": [0, 1, 2, 18, 8, 4, 0],
    "\u25B6": [16, 24, 28, 30, 28, 24, 16],
    "\u2191": [4, 14, 21, 4, 4, 4, 4],
    "\xB7": [0, 0, 0, 12, 12, 0, 0],
    "\u25BC": [0, 0, 31, 14, 4, 0, 0]
  };
  function mulberry32(a2) {
    return function() {
      a2 |= 0;
      a2 = a2 + 1831565813 | 0;
      var t = Math.imul(a2 ^ a2 >>> 15, 1 | a2);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function clamp(v, a2, b) {
    return v < a2 ? a2 : v > b ? b : v;
  }
  function lerp(a2, b, t) {
    return a2 + (b - a2) * t;
  }
  function randInt(r, a2, b) {
    return a2 + Math.floor(r() * (b - a2 + 1));
  }
  function mod(a2, n) {
    return (a2 % n + n) % n;
  }
  function band(v, a2, b, c, d) {
    if (v <= a2 || v >= d) return 0;
    if (v < b) return (v - a2) / (b - a2);
    if (v <= c) return 1;
    return (d - v) / (d - c);
  }
  function difficulty(m) {
    if (m <= 0) return 0;
    if (m < 600) return 0.28 * m / 600;
    return 0.28 + 0.72 * (1 - Math.exp(-(m - 600) / 1800));
  }
  function mapInfo(id) {
    for (var i = 0; i < MAPS.length; i++) if (MAPS[i].id === id) return MAPS[i];
    return MAPS[0];
  }
  function storageGet(k) {
    try {
      return typeof localStorage === "undefined" ? null : localStorage.getItem(k);
    } catch (_e) {
      return null;
    }
  }
  function storageSet(k, v) {
    try {
      if (typeof localStorage !== "undefined") localStorage.setItem(k, v);
    } catch (_e) {
    }
  }
  function loadSave() {
    var s = null;
    try {
      s = JSON.parse(storageGet("hoppak_save") || "null");
    } catch (_e) {
      s = null;
    }
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
    if (s.sfx !== false) s.sfx = true;
    else s.sfx = false;
    if (s.vib !== false) s.vib = true;
    else s.vib = false;
    if (!s.seen || typeof s.seen !== "object") s.seen = {};
    vibOn = !!s.vib;
    if (typeof s.vol !== "number") {
      var mv = typeof s.music === "number" ? clamp(s.music, 0, 1) : 0.55;
      var sv = typeof s.sfxVol === "number" ? clamp(s.sfxVol, 0, 1) : 0.8;
      s.vol = clamp(Math.max(mv, sv), 0, 1);
    }
    s.vol = clamp(s.vol, 0, 1);
    if (s.audioOn !== true && s.audioOn !== false) s.audioOn = s.musicOn !== false || s.sfx !== false;
    s.music = s.vol;
    s.sfxVol = s.vol;
    s.musicOn = s.audioOn;
    s.sfx = s.audioOn;
    masterVol = s.vol;
    audioOn = !!s.audioOn;
    sfxVol = masterVol;
    musicVol = masterVol;
    sfxOn = audioOn;
    musicOn = audioOn;
    return s;
  }
  function writeSave(s) {
    storageSet("hoppak_save", JSON.stringify(s));
  }
  var audioCtx = null;
  var sfxOn = true;
  var vibOn = true;
  var sfxVol = 0.8;
  var musicOn = true;
  var musicVol = 0.55;
  var masterVol = 0.8;
  var audioOn = true;
  var audioUnlocked = false;
  var audioExt = "";
  var SFX_GAIN = { jump: 0.32, coin: 0.7, bonus: 0.75, shield: 0.7, death: 0.8, warn: 0.5, deny: 0.48, tick: 0.22, hit: 0.6 };
  var MUSIC_TRACKS = {
    hush: { ogg: "audio/hush.ogg", mp3: "audio/hush.mp3" }
  };
  var MUSIC_CUES = [
    { track: "hush", screens: ["*"], maps: ["*"] }
  ];
  var musicCur = "";
  var masterGain = null;
  var musicGain = null;
  var musicNode = null;
  var musicBuf = {};
  var musicLoading = {};
  var audioProbe = { sfxToMaster: false, musicToMaster: false };
  var sfxBuf = {};
  var sfxLoading = {};
  var sfxLive = [];
  var sfxStat = { calls: {}, sources: {} };
  var SFX_CAP = 6;
  function ensureCtx() {
    try {
      var AC = typeof window !== "undefined" && (window.AudioContext || window.webkitAudioContext);
      if (!AC) return null;
      if (!audioCtx) audioCtx = new AC();
      if (audioCtx.state === "suspended" || audioCtx.state === "interrupted") {
        var resumed = audioCtx.resume();
        if (resumed && resumed.catch) resumed.catch(function() {
        });
      }
      return audioCtx;
    } catch (_e) {
      return null;
    }
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
  function loadSfx(kind) {
    if (sfxBuf[kind] || sfxLoading[kind] || !audioCtx || typeof fetch === "undefined") return;
    sfxLoading[kind] = 1;
    var ctx = audioCtx;
    var src = "audio/" + kind + "." + pickAudioExt();
    fetch(src).then(function(r) {
      if (!r.ok) throw 0;
      return r.arrayBuffer();
    }).then(function(b) {
      return ctx.decodeAudioData(b);
    }).then(function(buf) {
      sfxBuf[kind] = buf;
      sfxLoading[kind] = 0;
    }).catch(function() {
      sfxLoading[kind] = 0;
    });
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
  function hopVib(ms) {
    if (!vibOn) return;
    try {
      if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(ms);
    } catch (_e) {
    }
  }
  function pickAudioExt() {
    if (audioExt) return audioExt;
    audioExt = "mp3";
    try {
      var ua = typeof navigator !== "undefined" && navigator.userAgent || "";
      if (/iPhone|iPad|iPod/i.test(ua)) return audioExt;
      var a2 = typeof document !== "undefined" && document.createElement("audio");
      if (a2 && a2.canPlayType && a2.canPlayType('audio/ogg; codecs="vorbis"') === "probably") audioExt = "ogg";
    } catch (_e) {
    }
    return audioExt;
  }
  function beep(freq, dur, vol, type, slide) {
    if (!sfxOn || !audioCtx) return;
    try {
      var t0 = audioCtx.currentTime, osc = audioCtx.createOscillator(), g = audioCtx.createGain();
      osc.type = type || "square";
      osc.frequency.setValueAtTime(freq, t0);
      if (slide) osc.frequency.linearRampToValueAtTime(Math.max(40, freq + slide), t0 + dur);
      g.gain.setValueAtTime(1e-4, t0);
      g.gain.exponentialRampToValueAtTime(Math.max(2e-4, vol), t0 + 8e-3);
      g.gain.exponentialRampToValueAtTime(1e-4, t0 + dur);
      osc.connect(g);
      g.connect(ensureMaster() || audioCtx.destination);
      if (masterGain) audioProbe.sfxToMaster = true;
      osc.start(t0);
      osc.stop(t0 + dur + 0.02);
    } catch (_e) {
    }
  }
  function hopSfx(kind) {
    if (!sfxOn || sfxVol <= 0) return;
    if (kind === "bonus") hopVib(18);
    else if (kind === "hit") hopVib(30);
    else if (kind === "death") hopVib([40, 40, 60]);
    else if (kind === "deny") hopVib(12);
    sfxStat.calls[kind] = (sfxStat.calls[kind] || 0) + 1;
    if (!audioUnlocked) return;
    var ctx = ensureCtx();
    if (!ctx) {
      beepFallback(kind);
      return;
    }
    var buf = sfxBuf[kind];
    if (!buf) {
      loadSfx(kind);
      beepFallback(kind);
      return;
    }
    var now = ctx.currentTime, i;
    for (i = sfxLive.length - 1; i >= 0; i--) if (sfxLive[i].until <= now) sfxLive.splice(i, 1);
    if (sfxLive.length >= SFX_CAP) {
      if (kind !== "jump") return;
      var idx = 0;
      for (i = 0; i < sfxLive.length; i++) if (sfxLive[i].kind !== "jump") {
        idx = i;
        break;
      }
      try {
        sfxLive[idx].node.stop();
      } catch (_e) {
      }
      sfxLive.splice(idx, 1);
    }
    try {
      var node = ctx.createBufferSource();
      var g = ctx.createGain();
      node.buffer = buf;
      var vol = clamp(SFX_GAIN[kind] != null ? SFX_GAIN[kind] : 0.5, 0, 1);
      g.gain.setValueAtTime(Math.max(1e-4, vol), now);
      node.connect(g);
      g.connect(ensureMaster() || ctx.destination);
      if (masterGain) audioProbe.sfxToMaster = true;
      node.start(now);
      sfxStat.sources[kind] = (sfxStat.sources[kind] || 0) + 1;
      sfxLive.push({ node, kind, until: now + (buf.duration || 0.25) + 0.02 });
    } catch (_e2) {
      beepFallback(kind);
    }
  }
  function beepFallback(kind) {
    if (kind === "jump") beep(200, 0.045, 0.045, "sine", 40);
    else if (kind === "coin") {
      beep(880, 0.04, 0.05, "square");
      beep(1170, 0.06, 0.04, "square");
    } else if (kind === "bonus" || kind === "shield") beep(520, 0.06, 0.06, "triangle", 200);
    else if (kind === "hit") beep(140, 0.1, 0.08, "sawtooth", -80);
    else if (kind === "death") beep(220, 0.22, 0.08, "sawtooth", -160);
    else if (kind === "warn") beep(160, 0.08, 0.05, "square", -20);
    else if (kind === "deny") beep(110, 0.07, 0.05, "square");
    else if (kind === "tick") beep(940, 0.02, 0.03, "square");
  }
  function musicCue(screen, map) {
    for (var i = 0; i < MUSIC_CUES.length; i++) {
      var c = MUSIC_CUES[i];
      var scr = c.screens || ["*"];
      var maps = c.maps || ["*"];
      if ((scr.indexOf("*") >= 0 || scr.indexOf(screen) >= 0) && (maps.indexOf("*") >= 0 || maps.indexOf(map) >= 0)) return c.track;
    }
    return "";
  }
  function musicSrc(id) {
    var t = MUSIC_TRACKS[id];
    if (!t) return "";
    return pickAudioExt() === "ogg" ? t.ogg : t.mp3;
  }
  function stopMusic() {
    if (!musicNode) return;
    try {
      musicNode.stop();
    } catch (_e) {
    }
    musicNode = null;
  }
  function startMusicBuf(buf) {
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
    } catch (_e) {
    }
  }
  function loadMusic(src) {
    if (!src) return;
    if (musicBuf[src]) {
      startMusicBuf(musicBuf[src]);
      return;
    }
    if (musicLoading[src] || typeof fetch === "undefined") return;
    var ctx = ensureCtx();
    if (!ctx) return;
    musicLoading[src] = 1;
    fetch(src).then(function(r) {
      if (!r.ok) throw 0;
      return r.arrayBuffer();
    }).then(function(b) {
      return ctx.decodeAudioData(b);
    }).then(function(buf) {
      musicBuf[src] = buf;
      musicLoading[src] = 0;
      if (musicCur && musicSrc(musicCur) === src) startMusicBuf(buf);
    }).catch(function() {
      musicLoading[src] = 0;
    });
  }
  function hopMusic(id) {
    applyMaster();
    if (!audioUnlocked) {
      musicCur = id || "";
      return;
    }
    var want = audioOn && masterVol > 0 ? id || "" : "";
    if (want === musicCur && (musicNode || !want)) return;
    musicCur = want;
    if (!want) {
      stopMusic();
      return;
    }
    loadMusic(musicSrc(want));
  }
  function hopMusicTick() {
    applyMaster();
  }
  function setMasterVol(v) {
    masterVol = clamp(Math.round(clamp(v, 0, 1) * 10) / 10, 0, 1);
    sfxVol = masterVol;
    musicVol = masterVol;
    applyMaster();
    if (audioUnlocked && audioOn) hopMusic(musicCur || musicCue("menu", "city"));
  }
  function setAudioOn(on) {
    audioOn = !!on;
    sfxOn = audioOn;
    musicOn = audioOn;
    applyMaster();
    if (!audioOn) stopMusic();
    else if (audioUnlocked) hopMusic(musicCur || musicCue("menu", "city"));
  }
  function readAudioProbe() {
    applyMaster();
    return { gain: masterGain ? masterGain.gain.value : null, sfxToMaster: !!audioProbe.sfxToMaster, musicToMaster: !!audioProbe.musicToMaster };
  }
  var FIRST_TOAST = {
    break: "\u041B\u041E\u041C\u0410\u0415\u0422\u0421\u042F \u041F\u041E\u0421\u041B\u0415 \u041F\u0420\u042B\u0416\u041A\u0410",
    goal: "\u0414\u041E\u041F\u0420\u042B\u0413\u041D\u0418 \u0414\u041E \u0426\u0415\u041B\u0418",
    record: "\u0422\u0412\u041E\u0419 \u0420\u0415\u041A\u041E\u0420\u0414 - \u041F\u041E\u0411\u0415\u0419!"
  };
  function drawableChars(s) {
    s = String(s).toUpperCase();
    var out = "";
    for (var i = 0; i < s.length; i++) if (FONT[s[i]]) out += s[i];
    return out;
  }
  function textWidth(s, sc) {
    var n = drawableChars(s).length;
    return n ? n * 6 * sc : 0;
  }
  function drawText(ctx, s, x, y, color, sc, align) {
    var k = sc || 1;
    s = drawableChars(s);
    var w = s.length ? textWidth(s, k) - k : 0;
    var xx = Math.round(align === "center" ? x - w / 2 : align === "right" ? x - w : x);
    y = Math.round(y);
    ctx.fillStyle = color;
    for (var i = 0; i < s.length; i++) {
      var g = FONT[s[i]];
      for (var r = 0; r < 7; r++) for (var c = 0; c < 5; c++) if (g[r] & 1 << 4 - c) ctx.fillRect(xx + c * k, y + r * k, k, k);
      xx += 6 * k;
    }
    return w;
  }
  function rect(ctx, x, y, w, h, col) {
    ctx.fillStyle = col;
    ctx.fillRect(Math.round(x), Math.round(y), w, h);
  }
  function mixHex(a2, b, t) {
    var x = parseInt(a2.slice(1), 16), y = parseInt(b.slice(1), 16);
    var r = Math.round(lerp(x >> 16 & 255, y >> 16 & 255, t));
    var g = Math.round(lerp(x >> 8 & 255, y >> 8 & 255, t));
    var bl = Math.round(lerp(x & 255, y & 255, t));
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + bl).toString(16).slice(1);
  }
  function box(ctx, x, y, w, h, fill, border) {
    rect(ctx, x + 1, y + h, w, 1, "rgba(0,0,0,0.35)");
    rect(ctx, x, y, w, h, fill);
    ctx.fillStyle = border || C.cream;
    ctx.fillRect(x, y, w, 1);
    ctx.fillRect(x, y + h - 1, w, 1);
    ctx.fillRect(x, y, 1, h);
    ctx.fillRect(x + w - 1, y, 1, h);
    rect(ctx, x + 1, y + h - 2, w - 2, 1, "rgba(0,0,0,0.2)");
  }
  function drawCoin(ctx, x, y, t) {
    var ws = [6, 4, 2, 4];
    var w = ws[Math.floor(t / 7) % 4];
    var xx = Math.round(x + (6 - w) / 2);
    rect(ctx, xx, y, w, 6, C.gold);
    rect(ctx, xx, y + 5, w, 1, C.goldD);
    if (w > 2) {
      rect(ctx, xx, y, w, 1, "#ffe07a");
      rect(ctx, xx + 1, y + 1, 1, 2, "#fff4c0");
    }
  }
  function makeLook(kind, _color, _hat) {
    var b = CHARS[kind] || CHARS[0];
    return { id: b.id, name: b.name, hood: b.hood, kind };
  }
  function drawJumper(ctx, x, y, lk, face, pose, blink, alive, sc) {
    var s = sc || 1;
    x = Math.round(x);
    y = Math.round(y);
    var flip = face < 0;
    var spr = heroSprite(lk.id);
    if (spr) {
      var pn = !alive ? "ko" : pose === "idle" || !pose ? blink ? "blink" : "idle" : pose;
      var fi = SPRITE_POSES.indexOf(pn);
      if (fi < 0) fi = 0;
      var fw = (spr.naturalWidth || spr.width) / SPRITE_POSES.length, fh = spr.naturalHeight || spr.height;
      var dw = SPR_CW * s, dh = SPR_CH * s, cx = x + 6 * s, by = y + 16 * s;
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      if (flip) {
        ctx.translate(cx, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(spr, fi * fw, 0, fw, fh, -SPR_AX * s, by - dh, dw, dh);
      } else ctx.drawImage(spr, fi * fw, 0, fw, fh, cx - SPR_AX * s, by - dh, dw, dh);
      ctx.restore();
      return;
    }
  }
  var LETTERBOX_MIX = 0.5;
  var FIELD_OX = 0;
  var FIELD_OY = 0;
  var DEV_W = 0;
  var DEV_H = 0;
  var PHONE_INT = false;
  var THREAT = null;
  var HUD_PAL = {
    k: "#140c1c",
    S: "#f4f6fc",
    s: "#b8c0d4",
    m: "#6a7090",
    L: "#a4e8ff",
    B: "#3ca4ec",
    b: "#2a5cb4",
    g: "#ffcc40",
    G: "#cc7418",
    R: "#ff8f70",
    r: "#e8363c",
    d: "#a81e3a",
    W: "#ffffff",
    w: "#d6dbea",
    v: "#8a92b4",
    f: "#ff7418",
    F: "#ffd040"
  };
  var HUD_ICONS = {
    shield: [".kkkkkkkk.", "kSSssssssk", "kSLLBBBbmk", "ksLBBgBbmk", "ksBBgggbmk", "ksBBBgbbmk", ".ksBBbbmk.", ".kssbbmmk.", "..kssmmk..", "...kkkk..."],
    magnet: ["kkkk..kkkk", "kSsk..kSsk", "kmmk..kmmk", "kRrk..kRdk", "kRrk..kRdk", "kRrkkkkrdk", "kRRrrrrrdk", ".kRrrrrdk.", "..kkkkkk..", ".........."],
    rocket: ["....kk....", "...kRrk...", "...kWwk...", "..kWBbwk..", "..kWbbvk..", "..kWwwvk..", ".kRkWvkRk.", ".kdkrdkdk.", "..kkFfkk..", "....ff...."],
    bigcoin: [".kkkkkkkk.", "kGggggggGk", "kgFgggggGk", "kgggkkggGk", "kggkFgkgGk", "kggkFgkgGk", "kgggkkggGk", "kGggggggGk", ".kGGGGGGk.", "..kkkkkk.."]
  };
  function drawHudIcon(ctx, kind, x, y) {
    var ic = HUD_ICONS[kind];
    if (!ic) return;
    for (var r = 0; r < ic.length; r++) for (var c = 0; c < ic[r].length; c++) {
      var ch = ic[r][c];
      if (ch !== ".") rect(ctx, x + c, y + r, 1, 1, HUD_PAL[ch]);
    }
  }
  var BIGF = { 2: {}, 3: {} };
  function bigGlyph(ch, k) {
    if (BIGF[k][ch]) return BIGF[k][ch];
    var g = FONT[ch];
    if (!g) return [];
    function P(r2, c5) {
      return r2 >= 0 && r2 < 7 && c5 >= 0 && c5 < 5 && !!(g[r2] & 1 << 4 - c5) ? 1 : 0;
    }
    var W = 5 * k, H = 7 * k, out = [];
    for (var y = 0; y < H; y++) {
      out.push([]);
      for (var x = 0; x < W; x++) out[y].push(0);
    }
    for (var r = 0; r < 7; r++) for (var c = 0; c < 5; c++) {
      var A = P(r - 1, c - 1), B = P(r - 1, c), C2 = P(r - 1, c + 1), D = P(r, c - 1), E = P(r, c), F = P(r, c + 1), G = P(r + 1, c - 1), Hh = P(r + 1, c), I = P(r + 1, c + 1);
      var e;
      if (k === 2) {
        e = [D === B && D !== Hh && B !== F ? B : E, B === F && B !== D && F !== Hh ? F : E, D === Hh && D !== B && Hh !== F ? D : E, Hh === F && Hh !== D && F !== B ? F : E];
      } else {
        var c1 = D === B && D !== Hh && B !== F, c2 = B === F && B !== D && F !== Hh, c3 = D === Hh && D !== B && Hh !== F, c4 = Hh === F && Hh !== D && F !== B;
        e = [
          c1 ? D : E,
          c1 && E !== C2 || c2 && E !== A ? B : E,
          c2 ? F : E,
          c1 && E !== G || c3 && E !== A ? D : E,
          E,
          c2 && E !== I || c4 && E !== C2 ? F : E,
          c3 ? D : E,
          c3 && E !== I || c4 && E !== G ? Hh : E,
          c4 ? F : E
        ];
      }
      for (var j = 0; j < k * k; j++) out[r * k + Math.floor(j / k)][c * k + j % k] = e[j];
    }
    BIGF[k][ch] = out;
    return out;
  }
  function bigWidth(s, k) {
    var n = drawableChars(s).length;
    return n ? n * 6 * k - k : 0;
  }
  function drawBig(ctx, s, x, y, face, k, align, outline, shadow) {
    s = drawableChars(s);
    var w = bigWidth(s, k);
    var x0 = Math.round(align === "center" ? x - w / 2 : align === "right" ? x - w : x);
    y = Math.round(y);
    function pass(dx, dy, col) {
      ctx.fillStyle = col;
      var xx = x0;
      for (var i = 0; i < s.length; i++) {
        var m = bigGlyph(s[i], k);
        for (var r = 0; r < m.length; r++) for (var c = 0; c < m[r].length; c++) if (m[r][c]) ctx.fillRect(xx + c + dx, y + r + dy, 1, 1);
        xx += 6 * k;
      }
    }
    if (shadow) {
      pass(0, 2, shadow);
      pass(1, 2, shadow);
      pass(-1, 2, shadow);
    }
    if (outline) {
      pass(-1, 0, outline);
      pass(1, 0, outline);
      pass(0, -1, outline);
      pass(0, 1, outline);
    }
    pass(0, 0, face);
    return w;
  }
  function drawTextO(ctx, s, x, y, col, align, oc) {
    var o = oc || "#1a1030";
    drawText(ctx, s, x - 1, y, o, 1, align);
    drawText(ctx, s, x + 1, y, o, 1, align);
    drawText(ctx, s, x, y - 1, o, 1, align);
    drawText(ctx, s, x, y + 1, o, 1, align);
    drawText(ctx, s, x, y, col, 1, align);
  }
  function slimeAlert(m) {
    if (!THREAT || !m.alive) return false;
    var dy = THREAT.y - m.y;
    var dx = THREAT.x + THREAT.w / 2 - (m.x + m.w / 2);
    if (dx > LW / 2) dx -= LW;
    if (dx < -LW / 2) dx += LW;
    return dy > -6 && dy <= 96 && Math.abs(dx) <= 28;
  }
  function drawWalkerAlert(ctx, m, x, y, pal, t) {
    var dbg = typeof window !== "undefined" ? window.__dbg : null;
    var at = dbg && dbg.alertT != null ? dbg.alertT : m.alertT || 0;
    var ol = at < 16 && (at >> 2) % 2 === 0 ? "#ff645e" : INK;
    rect(ctx, x + 2, y, 8, 1, ol);
    rect(ctx, x - 1, y + 3, 14, 5, ol);
    rect(ctx, x, y + 1, 12, 3, ol);
    rect(ctx, x - 2, y + 6, 16, 2, ol);
    rect(ctx, x + 3, y + 1, 6, 1, pal[0]);
    rect(ctx, x + 1, y + 2, 10, 2, pal[0]);
    rect(ctx, x, y + 3, 12, 4, pal[0]);
    rect(ctx, x - 1, y + 6, 14, 1, pal[0]);
    rect(ctx, x - 1, y + 7, 14, 1, pal[1]);
    var lk = THREAT && THREAT.x + 6 > m.x + m.w / 2 ? 1 : 0;
    rect(ctx, x + 2, y + 2, 2, 1, INK);
    rect(ctx, x + 4, y + 3, 1, 1, INK);
    rect(ctx, x + 8, y + 2, 2, 1, INK);
    rect(ctx, x + 7, y + 3, 1, 1, INK);
    rect(ctx, x + 2, y + 4, 2, 2, "#fff6e8");
    rect(ctx, x + 8, y + 4, 2, 2, "#fff6e8");
    rect(ctx, x + 2 + lk, y + 5, 1, 1, INK);
    rect(ctx, x + 8 + lk, y + 5, 1, 1, INK);
    rect(ctx, x + 4, y + 6, 4, 1, INK);
    rect(ctx, x + 4, y + 7, 1, 1, "#fff6e8");
    rect(ctx, x + 7, y + 7, 1, 1, "#fff6e8");
  }
  function isPerm(t) {
    return t === "normal" || t === "move" || t === "ice" || t === "bounce" || t === "grav";
  }
  function mkPlat(x, y, w, type, row) {
    return { x, y, w, type, vx: 0, broken: false, breakT: 0, respawnT: 0, restoreT: 0, spring: false, springT: 0, row, seq: 0 };
  }
  function stampPlat(w, pl) {
    pl.seq = w.platSeq++;
    var pending = w.netBreaks && w.netBreaks[pl.seq];
    if (pending && pl.type === "break") {
      delete w.netBreaks[pl.seq];
      if (pending === "brk") {
        pl.broken = true;
        pl.breakT = 0;
      } else {
        pl.broken = false;
        pl.restoreT = 16;
      }
    }
    return pl;
  }
  function findX(r, pw, row) {
    for (var t = 0; t < 24; t++) {
      var x = randInt(r, 4, LW - pw - 4);
      var ok = true;
      for (var i = 0; i < row.length; i++) {
        var o = row[i];
        if (!(x + pw + X_SEP <= o.x || x >= o.x + o.w + X_SEP)) {
          ok = false;
          break;
        }
      }
      if (ok) return x;
    }
    return -1;
  }
  function mkMob(kind, x, y, d, extra) {
    var M = MOBS[kind];
    var m = {
      kind,
      b: M.b,
      x,
      y,
      baseX: x,
      baseY: y,
      w: M.w,
      h: M.h,
      vx: 0,
      alive: true,
      squish: 0,
      t: 0,
      d,
      shootT: 60,
      minX: 2,
      maxX: LW - M.w - 2,
      hy: 0,
      hvy: 0,
      jT: 60,
      cool: 0,
      big: false,
      st: "wait",
      cT: 60,
      dir: 1,
      amp: 0,
      fx: 0
    };
    for (var k in extra) m[k] = extra[k];
    return m;
  }
  function platAlive(w, pl) {
    return !!(pl && !pl.broken && w.platforms.indexOf(pl) >= 0);
  }
  function hangTop(pl) {
    return pl.y + 5;
  }
  function spaceBelow(w, pl, x, ww) {
    var best = 1e9;
    for (var i = 0; i < w.platforms.length; i++) {
      var q = w.platforms[i];
      if (q === pl || q.broken || q.y <= pl.y) continue;
      if (x + ww <= q.x || x >= q.x + q.w) continue;
      if (q.y - pl.y < best) best = q.y - pl.y;
    }
    return best;
  }
  function startFall(mo) {
    mo.falling = true;
    mo.hvy = 0.25;
    mo.home = null;
  }
  function followHome(w, mo, sf, hang) {
    if (mo.falling) {
      mo.hvy += 0.16 * sf;
      mo.y += mo.hvy * sf;
      if (hang) {
        mo.topY += mo.hvy * sf;
        mo.botY += mo.hvy * sf;
      }
      if (mo.y > w.cameraY + LH + 50) {
        mo.alive = false;
        mo.squish = 0;
      }
      return false;
    }
    var home = mo.home;
    if (!platAlive(w, home)) {
      startFall(mo);
      return followHome(w, mo, sf, hang);
    }
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
  function unsupportedMobs(w) {
    var bad = [];
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
          if (Math.abs(hangTop(pl) - (mo.topY || mo.y)) <= 4) {
            ok = true;
            break;
          }
        }
        if (!ok) bad.push({ kind: mo.kind, x: mo.x, y: mo.y, why: "hang" });
      } else if (M.plat) {
        var feet = (mo.b === "hop" ? mo.baseY : mo.y) + mo.h;
        for (j = 0; j < w.platforms.length; j++) {
          pl = w.platforms[j];
          if (pl.broken) continue;
          if (mo.x + mo.w <= pl.x + 1 || mo.x >= pl.x + pl.w - 1) continue;
          if (Math.abs(pl.y - feet) <= 3) {
            ok = true;
            break;
          }
        }
        if (!ok) bad.push({ kind: mo.kind, x: mo.x, y: mo.y, why: "stand" });
      }
    }
    return bad;
  }
  function spawnMob(w, row, y, gap, m, d, isMove) {
    var r = w.rng;
    var normals = row.filter(function(p) {
      return isPerm(p.type) && p.type !== "move" && p.type !== "bounce" && !p.spring && p.w >= 26;
    });
    var solids = row.filter(function(p) {
      return isPerm(p.type);
    });
    var roster = mapInfo(w.map).mobs;
    var elig = [], totalW = 0;
    for (var ri = 0; ri < roster.length; ri++) {
      var k = roster[ri][0], from = roster[ri][1], M = MOBS[k];
      if (m < from) continue;
      if (M.b === "snake") {
        var canHang = false;
        for (var hi = 0; hi < row.length; hi++) {
          var hp = row[hi];
          if (!isPerm(hp.type) || hp.broken || hp.w < M.w + 4) continue;
          if (spaceBelow(w, hp, hp.x + 2, M.w) >= 22) {
            canHang = true;
            break;
          }
        }
        if (!canHang) continue;
      } else {
        if (M.plat) {
          var homes0 = row.filter(function(p) {
            return isPerm(p.type) && p.type !== "bounce" && !p.spring && p.w >= 26 && !p.broken;
          });
          if (!homes0.length || !isMove && solids.length < 2) continue;
        }
        if (gap < M.gap) continue;
      }
      var lastR = w.lastMobRow[k] != null ? w.lastMobRow[k] : w.rowN - 35;
      var age = Math.max(1, w.rowN - lastR);
      var wt = 1 + Math.min(5, age / 14);
      if (m < from + 450) wt *= 1.65;
      if (M.plat) wt *= 2.2;
      elig.push({ kind: k, wt });
      totalW += wt;
    }
    if (!elig.length) return false;
    var pick = r() * totalW, kind = elig[0].kind;
    for (var ei = 0; ei < elig.length; ei++) {
      pick -= elig[ei].wt;
      if (pick <= 0) {
        kind = elig[ei].kind;
        break;
      }
    }
    var M2 = MOBS[kind];
    w.lastMobRow[kind] = w.rowN;
    if (M2.b === "snake") {
      var hangs = row.filter(function(p) {
        return isPerm(p.type) && !p.broken && p.w >= M2.w + 4 && spaceBelow(w, p, p.x + 2, M2.w) >= 22;
      });
      if (!hangs.length) return false;
      var hs = hangs[Math.floor(r() * hangs.length)];
      var sx = hs.x + randInt(r, 1, Math.max(1, hs.w - M2.w - 1));
      var room = spaceBelow(w, hs, sx, M2.w);
      var hangLen = Math.min(M2.gap || 32, Math.max(16, room - M2.h - 6));
      var ty = hangTop(hs);
      w.monsters.push(mkMob(kind, sx, ty + 2, d, {
        home: hs,
        hangLen,
        topY: ty,
        botY: ty + hangLen,
        minX: hs.x,
        maxX: hs.x + hs.w - M2.w
      }));
      return true;
    }
    if (M2.plat) {
      var homes = row.filter(function(p) {
        return isPerm(p.type) && p.type !== "bounce" && !p.spring && p.w >= 26 && !p.broken;
      });
      if (!homes.length) return false;
      var pl = homes[Math.floor(r() * homes.length)];
      var px = pl.x + randInt(r, 1, Math.max(1, pl.w - M2.w - 1));
      var wsp = M2.b === "walk" ? M2.sp * (0.85 + d * 0.6) : 0;
      w.monsters.push(mkMob(kind, px, pl.y - M2.h, d, {
        home: pl,
        minX: pl.x,
        maxX: pl.x + pl.w - M2.w,
        vx: r() < 0.5 ? -wsp : wsp,
        jT: randInt(r, 30, 100),
        shootT: randInt(r, 50, 150),
        dir: r() < 0.5 ? -1 : 1,
        t: randInt(r, 0, 100)
      }));
      return true;
    }
    var my = Math.round(y - gap / 2 - M2.h / 2);
    var mx = randInt(r, 6, LW - M2.w - 6);
    var ex = { shootT: randInt(r, 40, 140), t: randInt(r, 0, 200), dir: r() < 0.5 ? -1 : 1 };
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
        if (dmin > bestD) {
          bestD = dmin;
          best = cx;
        }
      }
      mx = best;
    }
    var sp = lerp(0.4, 0.95, d) * (0.8 + r() * 0.4);
    if (M2.b === "fly" || M2.b === "shoot") ex.vx = r() < 0.5 ? -sp : sp;
    if (M2.b === "fly" && M2.dive) ex.amp = clamp(Math.floor((gap - M2.h) / 2) - 6, 0, 7);
    if (M2.b === "wind") {
      mx = randInt(r, 0, LW - M2.w);
    }
    if (M2.b === "comet") {
      ex.cT = randInt(r, 20, 90);
    }
    w.monsters.push(mkMob(kind, mx, my, d, ex));
    return true;
  }
  function genRow(w) {
    var r = w.rng, y = w.nextY, m = -y / PX_PER_M, d = difficulty(m);
    var spec = mapInfo(w.map).special;
    var row = [];
    var rowId = w.rowN++;
    var h059 = clamp((m - 100) / 200, 0, 1);
    var moveP = m > 70 ? lerp(0.14, 0.45, d) + 0.06 * h059 : 0;
    var isMove = w.lastKind !== "move" && r() < moveP;
    if (isMove) {
      var mw = Math.round(lerp(40, 26, clamp(d + 0.08 * h059, 0, 1)));
      var sp = lerp(0.35, 1.15, d) * (0.85 + r() * 0.3) * (1 + 0.1 * h059);
      var mp = mkPlat(randInt(r, 4, LW - mw - 4), y, mw, "move", rowId);
      mp.vx = r() < 0.5 ? -sp : sp;
      row.push(mp);
    } else {
      var n;
      if (m < 160) n = r() < 0.22 ? 3 : 2;
      else if (m < 300) {
        var u1 = (m - 160) / 140;
        n = r() < lerp(0.2, 0.07, u1) ? 3 : r() < lerp(0.12, 0.46, u1) ? 1 : 2;
      } else if (m < 600) n = r() < 0.07 ? 3 : r() < 0.5 ? 1 : 2;
      else {
        n = r() < lerp(0.56, 0.11, (d - 0.28) / 0.72) ? 2 : 1;
        if (n === 2 && m < 900 && r() < 0.05) n = 3;
      }
      if (spec === "ice" && m < 260 && n === 1) n = 2;
      var dW = clamp(d + 0.08 * h059, 0, 1);
      var wmin = Math.round(lerp(42, 24, dW)), wmax = Math.round(lerp(54, 32, dW));
      var breakP054 = m > 80 ? lerp(0.1, 0.58, d) : 0;
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
            if (row[k].type === "break" && r() < 0.55) {
              row[k].type = spec;
              added = true;
            }
          }
          if (!added && row.length >= 2 && r() < 0.36) {
            var perms = row.filter(function(p) {
              return isPerm(p.type);
            });
            if (perms.length >= 2) perms[Math.floor(r() * perms.length)].type = spec;
          } else if (!added && row.length === 1 && r() < 0.28) {
            var sw = randInt(r, wmin, wmax), sx0 = findX(r, sw, row);
            if (sx0 >= 0) row.push(mkPlat(sx0, y, sw, spec, rowId));
          }
        }
      }
      if (r() < lerp(0.09, 0.045, d)) {
        var cand = row.filter(function(p) {
          return p.type === "normal" || p.type === "ice" || p.type === "grav";
        });
        if (cand.length) cand[Math.floor(r() * cand.length)].spring = true;
      }
    }
    w.lastKind = isMove ? "move" : "static";
    for (var j = 0; j < row.length; j++) w.platforms.push(stampPlat(w, row[j]));
    var gT = clamp((m + 90 * h059) / 700, 0, 1);
    var minG054 = Math.max(ROW_SEP, Math.floor(JUMP_H * lerp(0.42, 0.78, gT)));
    var maxG054 = Math.min(GAP_CAP, Math.floor(JUMP_H * lerp(0.58, 0.94, gT)));
    var minG, maxG;
    if (m < 300) {
      var u = clamp(m / 300, 0, 1);
      minG = Math.round(lerp(Math.max(ROW_SEP, Math.floor(JUMP_H * 0.34)), minG054, u));
      maxG = Math.round(lerp(Math.min(GAP_CAP, Math.floor(JUMP_H * 0.5)), maxG054, u));
    } else {
      minG = minG054;
      maxG = maxG054;
    }
    minG = Math.min(GAP_CAP, minG + Math.round(2 * h059));
    maxG = Math.min(GAP_CAP, maxG + Math.round(2 * h059));
    if (minG > maxG) minG = maxG;
    var gap = randInt(r, minG, maxG);
    var pMon = m < 180 ? 0 : m < 400 ? 0.045 : lerp(0.07, 0.26, d);
    var mob = r() < pMon ? spawnMob(w, row, y, gap, m, d, isMove) : false;
    var bonus = false;
    if (!mob && m >= w.nextBonusM && gap >= 26) {
      var tw = 0, bi;
      for (bi = 0; bi < BONUSES.length; bi++) tw += BONUSES[bi].wt;
      var bp = r() * tw, bk = BONUSES[0].id;
      for (bi = 0; bi < BONUSES.length; bi++) {
        bp -= BONUSES[bi].wt;
        if (bp <= 0) {
          bk = BONUSES[bi].id;
          break;
        }
      }
      w.items.push({ kind: bk, x: randInt(r, 10, LW - 20), y: Math.round(y - gap / 2 - 5), taken: false });
      w.nextBonusM = m + randInt(r, 200, 300);
      bonus = true;
    }
    if (bonus) {
    } else if (!isMove && !mob && r() < 0.4) {
      var cps = row.filter(function(p) {
        return isPerm(p.type);
      });
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
  function generateUntil(w, upToY) {
    var g = 0;
    while (w.nextY > upToY && g++ < 4e3) genRow(w);
  }
  function botKinds(human) {
    var out = [];
    for (var k = 0; k < CHARS.length && out.length < 3; k++) if (k !== human) out.push(k);
    return out;
  }
  function newPlayer(i, kind, look, x, isBot) {
    return {
      id: i,
      kind,
      name: CHARS[kind].name,
      look,
      x,
      y: -PH,
      vx: 0,
      vy: 0,
      prevY: -PH,
      alive: true,
      maxH: 0,
      isBot,
      face: 1,
      squash: 0,
      iceT: 0,
      gravT: 0,
      camY: -LH + 70,
      place: 0,
      why: "",
      bias: [0, -14, 14, 6][i],
      react: [1, 3, 4, 5][i],
      tgt: null,
      botDir: 0,
      abCharge: CHARS[kind].need,
      abFx: 0,
      hookT: 0,
      hookN: 0,
      hx0: 0,
      hy0: 0,
      htx: 0,
      hty: 0,
      hookPl: null,
      hookCoin: null,
      domeT: 0,
      domeSave: false,
      kills: 0,
      shieldT: 0,
      magnetT: 0,
      rocketT: 0,
      invT: 0,
      freezeT: 0,
      grabT: 0,
      grabMob: null,
      dashT: 0,
      poundT: 0,
      wallT: 0,
      wall: 0,
      teleFx: 0,
      stallT: 0,
      stallH: 0
    };
  }
  function createWorld(seed, mode, humanKind, humanLook, mapId) {
    var w = {
      seed: seed >>> 0,
      rng: mulberry32(seed >>> 0),
      mode,
      map: mapInfo(mapId || "city").id,
      platforms: [],
      monsters: [],
      bullets: [],
      coins: [],
      items: [],
      particles: [],
      nextY: -24,
      rowN: 1,
      platSeq: 0,
      netBreaks: {},
      lastKind: "",
      lastMobRow: {},
      cameraY: -LH + 70,
      tick: 0,
      shake: 0,
      phase: "play",
      players: [],
      finishWait: 0,
      runCoins: 0,
      bonusCoins: 0,
      paid: false,
      freezeMobT: 0,
      toast: "",
      toastT: 0,
      nextBonusM: 0,
      fallWarn: 0,
      liftWarn: 0,
      warnSfxT: 0
    };
    w.nextBonusM = randInt(w.rng, 160, 240);
    w.platforms.push(stampPlat(w, mkPlat(8, 0, LW - 16, "normal", 0)));
    var xs = mode === "squad" ? [74, 22, 124, 48] : [74];
    w.players.push(newPlayer(0, humanKind, humanLook, xs[0], false));
    if (mode === "squad") {
      var bk = botKinds(humanKind);
      for (var i = 1; i < 4; i++) w.players.push(newPlayer(i, bk[i - 1], makeLook(bk[i - 1], "base", "none"), xs[i], true));
    }
    generateUntil(w, w.cameraY - 80);
    return w;
  }
  function spawnParts(w, x, y, n, col, spr, g, sz) {
    for (var i = 0; i < n; i++) {
      var life = 14 + Math.floor(Math.random() * 14);
      w.particles.push({
        x,
        y,
        vx: (Math.random() - 0.5) * spr,
        vy: (Math.random() - 0.8) * spr,
        life,
        max: life,
        col,
        s: sz || (Math.random() < 0.4 ? 2 : 1),
        g
      });
    }
  }
  function overlapsX(ax, aw, bx, bw) {
    function hit(a2, b) {
      return a2 + aw > b && a2 < b + bw;
    }
    return hit(ax, bx) || hit(ax + LW, bx) || hit(ax - LW, bx);
  }
  function wrapDx(dx) {
    if (dx > LW / 2) dx -= LW;
    if (dx < -LW / 2) dx += LW;
    return dx;
  }
  function botDir(p, w) {
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
      if (Math.abs(ddx) < dm.w / 2 + PW / 2 + 6) {
        p.botDir = ddx > 0 ? -1 : 1;
        return p.botDir;
      }
    }
    for (var bi = 0; bi < w.bullets.length; bi++) {
      var bu = w.bullets[bi];
      var ab = p.y - bu.y;
      if (ab > 0 && ab < 60 && Math.abs(wrapDx(bu.x - pcx)) < 10) {
        p.botDir = bu.x > pcx ? -1 : 1;
        return p.botDir;
      }
    }
    if (w.tick % p.react !== 0 && p.tgt && !p.tgt.broken) return p.botDir;
    var best = null, bestS = -1e9;
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
      if (s > bestS) {
        bestS = s;
        best = pl;
      }
    }
    p.tgt = best;
    if (!best) {
      var fb = null, fs = 1e9;
      for (var fi = 0; fi < w.platforms.length; fi++) {
        var fq = w.platforms[fi];
        if (fq.broken || fq.y < p.y + PH - 2 || fq.y > p.y + PH + 120) continue;
        var fd = Math.abs(wrapDx(fq.x + fq.w / 2 - cx)) + (fq.y - p.y) * 0.3;
        if (fd < fs) {
          fs = fd;
          fb = fq;
        }
      }
      best = fb;
      if (!best) return 0;
    }
    var target = best.x + best.w / 2 + (best.type === "move" ? best.vx * 12 : 0);
    var d = wrapDx(target - cx);
    p.botDir = Math.abs(d) < 2.5 ? 0 : d < 0 ? -1 : 1;
    return p.botDir;
  }
  function killPlayer(w, p, why) {
    if (!p.alive) return;
    p.alive = false;
    p.vy = -2.5;
    p.why = why;
    p.grabT = 0;
    p.wallT = 0;
    p.wall = 0;
    spawnParts(w, p.x + 6, p.y + 8, 14, p.look.hood, 2.8, 0.1);
    if (p.id === 0) {
      w.shake = 8;
      hopSfx("death");
    }
  }
  function invuln(p) {
    return p.invT > 0 || p.rocketT > 0 || p.dashT > 0 || p.poundT > 0 || p.domeT > 0;
  }
  function useShield(w, p) {
    if (p.shieldT <= 0) return false;
    p.shieldT = 0;
    p.invT = 60;
    spawnParts(w, p.x + 6, p.y + 8, 14, "#8ae8ff", 2.6, 0.02, 2);
    if (p.id === 0) {
      w.shake = 4;
      toast(w, "\u0429\u0418\u0422 \u0421\u041F\u0410\u0421!");
      hopSfx("shield");
    }
    return true;
  }
  function hurt(w, p, why, mo) {
    if (!p.alive || invuln(p)) return;
    if (useShield(w, p)) {
      if (mo && mo.b !== "pull") killMob(w, mo, p, true);
      if (why === "hole") p.vy = JUMP_V * 1.1;
      return;
    }
    killPlayer(w, p, why === "mob" && mo && mo.kind ? "mob:" + mo.kind : why);
  }
  function freezePlayer(w, p) {
    if (!p.alive || invuln(p)) return;
    if (useShield(w, p)) return;
    p.freezeT = 75;
    spawnParts(w, p.x + 6, p.y + 6, 10, "#c8f8ff", 2, 0.02, 1);
    if (p.id === 0) toast(w, "\u0417\u0410\u041C\u041E\u0420\u041E\u0417\u041A\u0410!");
  }
  function grabPlayer(w, p, mo) {
    if (!p.alive || invuln(p) || mo.cool > 0) return;
    if (useShield(w, p)) {
      killMob(w, mo, p, true);
      return;
    }
    p.grabT = 45;
    p.grabMob = mo;
    mo.cool = 160;
    if (p.id === 0) toast(w, "\u0417\u041C\u0415\u042F \u0421\u0425\u0412\u0410\u0422\u0418\u041B\u0410!");
  }
  function toast(w, s) {
    w.toast = s;
    w.toastT = 70;
  }
  function landOn(w, p, pl) {
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
      p.vy = Math.min(p.vy, JUMP_V * 1.42);
      if (p.id === 0) w.shake = 7;
      spawnParts(w, p.x + 6, pl.y, 14, "#ffd046", 3, 0.1, 2);
    }
    if (pl.type === "break" && !pl.broken) {
      pl.broken = true;
      pl.breakT = 14;
      if (w.net) pl.netTell = 1;
      spawnParts(w, pl.x + pl.w / 2, pl.y + 2, 10, C.brk, 2.2, 0.22, 2);
      spawnParts(w, pl.x + pl.w / 2, pl.y + 2, 4, C.brkRim, 1.6, 0.22, 1);
    }
    if (p.id === 0) hopSfx("jump");
  }
  function killMob(w, mo, p, noBounce) {
    if (!mo.alive) return;
    mo.alive = false;
    mo.squish = 10;
    if (!noBounce) {
      p.vy = STOMP_V;
      p.y = mo.y - PH;
    }
    p.kills++;
    addCharge(p, "kills", 1);
    var pal = MOBPAL[mo.kind] || ["#ffd070"];
    spawnParts(w, mo.x + mo.w / 2, mo.y + 4, 12, pal[0], 2.6, 0.15);
    if (p.id === 0) {
      w.shake = 5;
      hopSfx("hit");
    }
  }
  function mobBox(mo) {
    if (mo.b === "puff" && mo.big) return [mo.x - 3, mo.y - 3, mo.w + 6, mo.h + 6];
    if (mo.kind === "blob" || mo.kind === "magma") return [mo.x + 2, mo.y + 1, mo.w - 4, mo.h - 2];
    return [mo.x, mo.y, mo.w, mo.h];
  }
  function abReady(p) {
    return p.abCharge >= CHARS[p.kind].need;
  }
  function addCharge(p, kind, n) {
    var H = CHARS[p.kind];
    if (H.charge === kind) p.abCharge = Math.min(H.need, p.abCharge + n);
  }
  function hookTarget(w, p) {
    var cx = p.x + PW / 2, cy = p.y + PH / 2, best = null, bd = 1e9, i;
    for (i = 0; i < w.platforms.length; i++) {
      var pl = w.platforms[i];
      if (pl.broken || pl.y > p.y + PH - 6 || pl.y < cy - 125) continue;
      var dx = wrapDx(pl.x + pl.w / 2 - cx), dy = pl.y - PH / 2 - cy, d = Math.sqrt(dx * dx + dy * dy);
      if (d < 16 || d > 120) continue;
      var sc = d - Math.min(40, -dy) * 0.5;
      if (sc < bd) {
        bd = sc;
        best = { x: cx + dx, y: pl.y - PH, pl, coin: null };
      }
    }
    for (i = 0; i < w.coins.length; i++) {
      var cn = w.coins[i];
      if (cn.taken) continue;
      var cdx = wrapDx(cn.x + 3 - cx), cdy = cn.y + 3 - cy, cd = Math.sqrt(cdx * cdx + cdy * cdy);
      if (cd < 10 || cd > 100) continue;
      if (cd - 8 < bd) {
        bd = cd - 8;
        best = { x: cx + cdx, y: cn.y + 3 - PH / 2, pl: null, coin: cn };
      }
    }
    return best;
  }
  function useAbility(w, p) {
    if (!p.alive || !abReady(p)) return false;
    var H = CHARS[p.kind] || CHARS[0];
    var col = p.look.hood, i;
    if (H.ab === "hook") {
      var tg = hookTarget(w, p);
      if (!tg) {
        if (p.id === 0) toast(w, "\u041D\u0415\u0422 \u0426\u0415\u041B\u0418");
        return false;
      }
      p.hookT = 0;
      p.hx0 = p.x;
      p.hy0 = p.y;
      p.htx = tg.x - PW / 2;
      p.hty = tg.y;
      p.hookPl = tg.pl;
      p.hookCoin = tg.coin;
      var hd = Math.sqrt(Math.pow(p.htx - p.x, 2) + Math.pow(p.hty - p.y, 2));
      p.hookN = Math.round(clamp(hd / 5, 10, 22));
      p.grabT = 0;
      p.poundT = 0;
    } else if (H.ab === "tele") {
      var best = null;
      for (i = 0; i < w.platforms.length; i++) {
        var q = w.platforms[i];
        if (q.broken || !isPerm(q.type) || q.type === "move" || q.lifeT) continue;
        if (q.y > p.y - 24 || q.y < p.y + PH - JUMP_H * 1.5 || q.y < p.camY + 14) continue;
        var busy = false;
        for (var mi = 0; mi < w.monsters.length; mi++) {
          var mo = w.monsters[mi];
          if (mo.alive && Math.abs(mo.y + mo.h - q.y) < 22 && overlapsX(mo.x - 4, mo.w + 8, q.x, q.w)) busy = true;
        }
        if (!busy && (!best || q.y < best.y)) best = q;
      }
      if (!best) {
        if (p.id === 0) toast(w, "\u041D\u0415\u0422 \u041F\u041B\u0410\u0422\u0424\u041E\u0420\u041C\u042B");
        return false;
      }
      spawnParts(w, p.x + 6, p.y + 8, 14, "#c890ff", 2.4, 0, 2);
      p.x = clamp(best.x + best.w / 2 - PW / 2, 0, LW - PW);
      p.y = best.y - PH;
      p.prevY = p.y;
      p.vy = JUMP_V;
      p.vx = 0;
      p.squash = 6;
      p.invT = Math.max(p.invT, 30);
      p.grabT = 0;
      p.poundT = 0;
      p.teleFx = 18;
      spawnParts(w, p.x + 6, p.y + 8, 16, "#e8c8ff", 2.6, 0, 2);
    } else if (H.ab === "wall") {
      p.wallT = 300;
      p.wall = 0;
      spawnParts(w, p.x + 6, p.y + 8, 10, "#d82a2a", 2, 0, 1);
    } else if (H.ab === "dash") {
      p.vy = Math.min(p.vy, -6.6);
      p.vx = clamp(p.vx + p.face * 1.6, -MAX_VX * 1.3, MAX_VX * 1.3);
      p.dashT = 14;
      p.grabT = 0;
      spawnParts(w, p.x + 6, p.y + PH, 12, "#7ad8ff", 2.4, 0.08, 2);
    } else if (H.ab === "dome") {
      p.domeT = 200;
      p.domeSave = true;
      spawnParts(w, p.x + 6, p.y + 8, 14, "#c89bff", 2.6, 0, 1);
    } else if (H.ab === "pound") {
      p.poundT = 1;
      p.vy = 7.5;
      p.grabT = 0;
      spawnParts(w, p.x + 6, p.y, 8, "#ffd046", 2, -0.05, 1);
    }
    p.abCharge = 0;
    p.abFx = 16;
    if (p.id === 0) toast(w, H.abName + "!");
    return true;
  }
  function botWantsAb(w, p) {
    if (!p.alive || !abReady(p)) return false;
    var ab = CHARS[p.kind].ab;
    if (p.grabT > 0) return ab === "dash" || ab === "hook";
    if (ab === "pound" || ab === "wall") return false;
    if (ab === "dome") return w.tick % 200 === p.id * 41;
    return p.vy > 1.2 && p.y > p.camY + LH * 0.7;
  }
  function pickItem(w, p, it) {
    it.taken = true;
    it.popT = BUBBLE.popTicks;
    var B = null;
    for (var i = 0; i < BONUSES.length; i++) if (BONUSES[i].id === it.kind) B = BONUSES[i];
    if (!B) return;
    if (B.id === "bigcoin") w.bonusCoins += BIGCOIN;
    else if (B.id === "shield") p.shieldT = B.t;
    else if (B.id === "magnet") p.magnetT = Math.max(p.magnetT, B.t);
    else if (B.id === "rocket") {
      p.rocketT = B.t;
      p.grabT = 0;
      p.poundT = 0;
      p.invT = Math.max(p.invT, B.t + 40);
    }
    toast(w, B.id === "bigcoin" ? "\u041A\u041B\u0410\u0414 +" + BIGCOIN : B.name + "!");
    if (p.id === 0) {
      w.shake = 3;
      hopSfx(B.id === "shield" ? "shield" : "bonus");
    }
  }
  function tickWorld(w, inputs) {
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
        if (pl.x < 2) {
          pl.x = 2;
          pl.vx = Math.abs(pl.vx);
        }
        if (pl.x + pl.w > LW - 2) {
          pl.x = LW - 2 - pl.w;
          pl.vx = -Math.abs(pl.vx);
        }
      }
      if (pl.broken && pl.breakT > 0) pl.breakT--;
      if (pl.restoreT > 0) pl.restoreT--;
      if (pl.respawnT > 0 && --pl.respawnT === 0) {
        pl.broken = false;
        spawnParts(w, pl.x + pl.w / 2, pl.y, 4, "#88f8ff", 1.2, -0.02, 1);
      }
      if (pl.springT > 0) pl.springT--;
      if (pl.lifeT > 0 && --pl.lifeT === 0) {
        pl.broken = true;
        pl.breakT = 0;
      }
    }
    function nearPlayer(mo2) {
      for (var q2 = 0; q2 < w.players.length; q2++) if (w.players[q2].alive && Math.abs(w.players[q2].y - mo2.y) < LH * 0.8) return true;
      return false;
    }
    for (i = 0; i < w.monsters.length; i++) {
      var mo = w.monsters[i];
      mo.t += sf;
      if (mo.fx > 0) mo.fx--;
      if (mo.warnT > 0) mo.warnT--;
      else mo.warn = 0;
      if (mo.cool > 0) mo.cool -= sf;
      if (!mo.alive) {
        if (mo.squish > 0) mo.squish--;
        continue;
      }
      if (mobFrozen) {
        mo.t -= sf;
        continue;
      }
      var b = mo.b, MM = MOBS[mo.kind];
      if (b === "snake" || MM && MM.plat || mo.home || mo.falling) {
        if (!followHome(w, mo, sf, b === "snake")) continue;
      }
      if (b === "walk") {
        mo.x += mo.vx * sf;
        if (mo.x < mo.minX) {
          mo.x = mo.minX;
          mo.vx = Math.abs(mo.vx);
        }
        if (mo.x > mo.maxX) {
          mo.x = mo.maxX;
          mo.vx = -Math.abs(mo.vx);
        }
      } else if (b === "hop") {
        if (mo.hy === 0 && mo.hvy === 0) {
          mo.jT -= sf;
          if (mo.jT <= 0) {
            mo.hvy = -1.8;
            mo.jT = 60 + mo.t * 7 % 40;
            if (mo.x <= mo.minX + 2) mo.dir = 1;
            else if (mo.x >= mo.maxX - 2) mo.dir = -1;
            else if ((mo.t * 13 | 0) % 3 === 0) mo.dir = -mo.dir;
            mo.vx = 0.4 * mo.dir;
          }
        } else {
          mo.hy += mo.hvy * sf;
          mo.hvy += 0.12 * sf;
          mo.x = clamp(mo.x + mo.vx * sf, mo.minX, mo.maxX);
          if (mo.hy >= 0) {
            mo.hy = 0;
            mo.hvy = 0;
            mo.vx = 0;
          }
        }
        mo.y = mo.baseY + Math.round(mo.hy);
      } else if (b === "throw" || b === "spit") {
        mo.shootT -= sf;
        if (mo.shootT <= 0) {
          mo.shootT = Math.round(lerp(170, 115, mo.d));
          if (nearPlayer(mo)) {
            mo.fx = 14;
            if (b === "throw") {
              mo.dir = -mo.dir;
              w.bullets.push({ kind: "nut", x: mo.x + 6, y: mo.y - 2, vx: 0.45 * mo.dir, vy: -3.1, g: 0.075, life: 260 });
            } else w.bullets.push({ kind: "fire", x: mo.x + 6, y: mo.y - 3, vx: 0, vy: -3.5, g: 0.065, life: 260 });
          }
        }
      } else if (b === "fly") {
        mo.x += mo.vx * sf;
        if (mo.x < mo.minX) {
          mo.x = mo.minX;
          mo.vx = Math.abs(mo.vx);
        }
        if (mo.x > mo.maxX) {
          mo.x = mo.maxX;
          mo.vx = -Math.abs(mo.vx);
        }
        mo.y = mo.baseY + (mo.amp ? Math.round(Math.sin(mo.t * 0.06) * mo.amp) : Math.floor(mo.t / 8) % 2);
      } else if (b === "sway") {
        mo.y = mo.baseY + Math.round(Math.sin(mo.t * 0.045) * 3.5);
        mo.x = clamp(mo.baseX + Math.sin(mo.t * 0.02) * 14, 2, LW - mo.w - 2);
      } else if (b === "snake") {
        var ph = mo.t % 170, f = 0;
        if (ph < 70) f = 0;
        else if (ph < 84) f = (ph - 70) / 14;
        else if (ph < 120) f = 1;
        else f = 1 - (ph - 120) / 50;
        mo.y = Math.round(mo.topY + 2 + f * (mo.botY - mo.topY - 2));
      } else if (b === "puff") {
        mo.y = mo.baseY + Math.round(Math.sin(mo.t * 0.04) * 1.5);
        mo.x = clamp(mo.baseX + Math.sin(mo.t * 0.015) * 12, 4, LW - mo.w - 4);
        mo.big = mo.t % 170 > 110;
      } else if (b === "wind") {
        mo.x = mod(mo.x + mo.dir * 0.5 * sf, LW);
      } else if (b === "shoot") {
        mo.x += mo.vx * sf;
        if (mo.x < mo.minX) {
          mo.x = mo.minX;
          mo.vx = Math.abs(mo.vx);
        }
        if (mo.x > mo.maxX) {
          mo.x = mo.maxX;
          mo.vx = -Math.abs(mo.vx);
        }
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
        if (mo.st === "wait") {
          if (mo.cT <= 0) {
            mo.st = "go";
            mo.cT = 80;
            mo.vx = 2.6 * mo.dir;
          }
        } else {
          mo.x = mod(mo.x + mo.vx * sf + 6, LW + 12) - 6;
          if (mo.cT <= 0) {
            mo.st = "wait";
            mo.cT = 75;
            mo.vx = 0;
            mo.dir = -mo.dir;
          }
        }
      }
    }
    for (i = w.bullets.length - 1; i >= 0; i--) {
      var bu = w.bullets[i];
      for (k = 0; k < w.players.length; k++) {
        var dp = w.players[k];
        if (dp.alive && dp.domeT > 0 && Math.abs(wrapDx(bu.x - (dp.x + 6))) < 20 && Math.abs(bu.y - (dp.y + 8)) < 20) {
          bu.life = 0;
          spawnParts(w, bu.x, bu.y, 4, "#7ad8ff", 1.6, 0, 1);
        }
      }
      bu.x += (bu.vx || 0) * sf;
      bu.y += bu.vy * sf;
      bu.vy += (bu.g || 0) * sf;
      if (--bu.life <= 0) w.bullets.splice(i, 1);
    }
    for (i = 0; i < w.items.length; i++) w.items[i].t = (w.items[i].t || 0) + 1;
    for (var pi = 0; pi < w.players.length; pi++) {
      var p = w.players[pi];
      if (p.remote) continue;
      if (!p.alive) {
        if (p.y < p.camY + LH + 60) {
          p.vy = Math.min(p.vy + GRAVITY, 5);
          p.y += p.vy;
        }
        continue;
      }
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
      if (p.wallT > 0) {
        p.wallT--;
        if (p.wallT === 0) p.wall = 0;
      }
      if (p.wall && (inp.ab || (inp.dir || 0) === -p.wall || inp.ax && Math.sign(inp.ax) === -p.wall && Math.abs(inp.ax) > 0.3)) {
        var wsd = p.wall;
        p.vy = JUMP_V * 0.97;
        p.vx = -wsd * 2.6;
        p.face = -wsd;
        p.wall = 0;
        p.squash = 4;
        p.x += -wsd * 2;
        spawnParts(w, wsd < 0 ? 1 : LW - 1, p.y + 10, 6, "#d8f0ff", 1.6, 0.05, 1);
      } else if (inp.ab) useAbility(w, p);
      if (p.hookN > 0) {
        p.hookT++;
        var u = p.hookT / p.hookN, hdx = p.htx - p.hx0, hdy = p.hty - p.hy0;
        var arc = Math.min(26, Math.sqrt(hdx * hdx + hdy * hdy) * 0.3) * Math.sin(Math.PI * u);
        var nx = p.hx0 + hdx * u, ny = p.hy0 + hdy * u - arc;
        p.vx = nx - p.x;
        p.vy = ny - p.y;
        p.x = nx;
        p.y = ny;
        if (p.x < -PW) p.x += LW;
        if (p.x > LW) p.x -= LW;
        if (hdx) p.face = hdx > 0 ? 1 : -1;
        for (k = 0; k < w.monsters.length; k++) {
          var hm = w.monsters[k];
          if (!hm.alive || hm.b === "wind") continue;
          var hb = mobBox(hm);
          if (overlapsX(p.x - 2, PW + 4, hb[0], hb[2]) && p.y - 2 < hb[1] + hb[3] && p.y + PH + 2 > hb[1]) killMob(w, hm, p, true);
        }
        if (p.hookT >= p.hookN) {
          p.hookN = 0;
          if (p.hookPl && !p.hookPl.broken) {
            p.x = p.htx;
            landOn(w, p, p.hookPl);
          } else p.vy = -3.2;
          p.vx *= 0.3;
        }
        var hmh = Math.max(0, -(p.y + PH));
        if (hmh > p.maxH) {
          addCharge(p, "height", (hmh - p.maxH) / PX_PER_M);
          p.maxH = hmh;
        }
        if (!p.isBot) for (k = 0; k < w.coins.length; k++) {
          var hc = w.coins[k];
          if (!hc.taken && overlapsX(p.x - 2, PW + 4, hc.x, 6) && hc.y + 6 > p.y - 2 && hc.y < p.y + PH + 2) {
            hc.taken = true;
            w.runCoins += 1;
            addCharge(p, "coins", 1);
            spawnParts(w, hc.x + 3, hc.y + 3, 6, "#ffe07a", 1.8, 0, 1);
          }
        }
        continue;
      }
      if (p.grabT > 0) {
        var gm = p.grabMob;
        p.grabT--;
        if (gm && gm.alive) {
          p.x = gm.x - 1;
          p.y = gm.y + gm.h - 3;
        }
        p.vx = 0;
        p.vy = 0;
        if (p.grabT === 0) {
          p.vy = 1.2;
          p.invT = Math.max(p.invT, 30);
        }
        continue;
      }
      var dir = inp.dir || 0;
      if (p.freezeT > 0) {
        dir = 0;
        p.vx *= 0.9;
      } else if (inp.ax || dir) {
        var cap = p.iceT > 0 ? MAX_VX * 1.15 : MAX_VX;
        var target;
        if (inp.ax) {
          target = cap * clamp(inp.ax, -1, 1);
          dir = inp.ax < -0.12 ? -1 : inp.ax > 0.12 ? 1 : 0;
        } else {
          target = dir * cap;
        }
        var want = target - p.vx;
        var acc = target * p.vx < 0 ? TURN_ACCEL : ACCEL;
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
        if (dist < 6) {
          hurt(w, p, "hole", h);
          if (!p.alive) break;
          continue;
        }
        if (dist < 36 && !invuln(p)) {
          var fpull = 0.11 * (1 - dist / 36);
          p.vx += hx / dist * fpull;
          p.vy += hy / dist * fpull * 0.6;
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
        if (p.x <= 0 && p.vx <= 0) {
          p.x = 0;
          if (p.wall !== -1) {
            p.wall = -1;
            p.face = -1;
          }
        } else if (p.x >= LW - PW && p.vx >= 0) {
          p.x = LW - PW;
          if (p.wall !== 1) {
            p.wall = 1;
            p.face = 1;
          }
        } else if (p.x > 1 && p.x < LW - PW - 1) p.wall = 0;
        if (p.wall) {
          p.vx = 0;
          if (p.vy > 0.9) p.vy = 0.9;
          if (w.tick % 5 === 0) spawnParts(w, p.wall < 0 ? 1 : LW - 2, p.y + PH - 2, 1, "#e8e0d0", 0.6, 0.02, 1);
        }
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
            if (p.poundT > 0 && (q.type === "break" || q.type === "cloud")) {
              q.broken = true;
              q.breakT = 14;
              if (w.net && q.type === "break") q.netTell = 1;
              spawnParts(w, q.x + q.w / 2, q.y + 2, 12, C.brk, 2.6, 0.22, 2);
              if (p.id === 0) w.shake = 3;
              continue;
            }
            landOn(w, p, q);
            break;
          }
        }
      }
      for (k = 0; k < w.monsters.length; k++) {
        var m2 = w.monsters[k];
        if (!m2.alive || m2.b === "pull" || m2.b === "wind") continue;
        if ((m2.kind === "blob" || m2.kind === "magma") && p.id === 0) {
          var sdx = wrapDx(m2.x + m2.w / 2 - (p.x + PW / 2));
          var sdy = m2.y + m2.h / 2 - (p.y + PH / 2);
          var threat = Math.abs(sdx) < 36 && sdy > -28 && sdy < 40;
          if (threat && !m2.warn) {
            m2.warn = 1;
            hopSfx("warn");
            hopVib(8);
          }
          if (threat) m2.warnT = 18;
        }
        var bb = mobBox(m2);
        if (overlapsX(p.x + 2, PW - 4, bb[0] + 1, bb[2] - 2) && p.y + 4 < bb[1] + bb[3] && p.y + PH > bb[1]) {
          if (p.rocketT > 0 || p.dashT > 0 || p.poundT > 0 || p.domeT > 0) {
            killMob(w, m2, p, true);
            continue;
          }
          if (mobFrozen) {
            if (p.vy > 0 && p.prevY + PH <= bb[1] + 5) killMob(w, m2, p);
            continue;
          }
          var stompable = !(m2.b === "puff" && m2.big);
          if (stompable && p.vy > 0 && (p.y + PH - bb[1] < 9 || p.prevY + PH <= bb[1] + 5)) killMob(w, m2, p);
          else if (m2.b === "snake") {
            grabPlayer(w, p, m2);
            if (p.grabT > 0) break;
          } else {
            hurt(w, p, "mob", m2);
            if (!p.alive) break;
          }
        }
      }
      if (!p.alive) continue;
      for (k = 0; k < w.bullets.length; k++) {
        var bl = w.bullets[k];
        if (bl.life <= 0) continue;
        if (overlapsX(p.x + 2, PW - 4, bl.x - 1, 3) && bl.y + 4 > p.y + 2 && bl.y < p.y + PH) {
          if (invuln(p)) {
            bl.life = 0;
            continue;
          }
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
            if (md < 70 && md > 0.5) {
              var ms = Math.min(md, 3.4);
              cn.x += mdx / md * ms;
              cn.y += mdy / md * ms;
            }
          }
          if (overlapsX(p.x, PW, cn.x, 6) && cn.y + 6 > p.y && cn.y < p.y + PH) {
            cn.taken = true;
            w.runCoins += 1;
            addCharge(p, "coins", 1);
            spawnParts(w, cn.x + 3, cn.y + 3, 6, "#ffe07a", 1.8, 0, 1);
            hopSfx("coin");
          }
        }
        for (k = 0; k < w.items.length; k++) {
          var it = w.items[k];
          if (!it.taken && overlapsX(p.x, PW, it.x - 2, 14) && it.y + 12 > p.y && it.y - 2 < p.y + PH) pickItem(w, p, it);
        }
      }
      var mh = Math.max(0, -(p.y + PH));
      if (mh > p.maxH) {
        addCharge(p, "height", (mh - p.maxH) / PX_PER_M);
        p.maxH = mh;
      }
    }
    var minCam = 1e9;
    for (i = 0; i < w.players.length; i++) {
      var cp = w.players[i];
      if (!cp.alive) continue;
      var target = cp.y - LH * 0.42;
      if (target < cp.camY) cp.camY = target;
      if (!cp.remote && w.tick > 80) {
        if (cp.maxH > (cp.stallH || 0) + 0.5) {
          cp.stallH = cp.maxH;
          cp.stallT = 0;
        } else cp.stallT = (cp.stallT || 0) + 1;
        if (cp.stallT > 350) cp.camY -= 0.28;
      }
      if (cp.camY < minCam) minCam = cp.camY;
    }
    w.cameraY = w.players[0].camY;
    if (minCam < 1e9) generateUntil(w, minCam - 80);
    w.fallWarn = 0;
    w.liftWarn = 0;
    for (i = 0; i < w.players.length; i++) {
      var ep = w.players[i];
      if (!ep.alive || ep.remote) continue;
      if (ep.stallT > 350) w.liftWarn = 1;
      if (ep.vy >= 0 && ep.y + PH > ep.camY + LH - 28 && ep.y <= ep.camY + LH) {
        w.fallWarn = 1;
        if (ep.id === 0 && (w.warnSfxT || 0) <= 0) {
          hopSfx("warn");
          w.warnSfxT = 22;
        }
      }
      if (w.tick > 80 && ep.vy >= 0 && ep.y > ep.camY + LH) {
        if (ep.domeT > 0 && ep.domeSave) {
          ep.domeSave = false;
          ep.y = ep.camY + LH - PH - 12;
          ep.vy = SPRING_V;
          ep.invT = 40;
          spawnParts(w, ep.x + 6, ep.y + 8, 16, "#a8f4ff", 3, -0.03, 2);
          if (ep.id === 0) toast(w, "\u041A\u041E\u0421\u041C\u041E\u0429\u0418\u0422 \u0421\u041F\u0410\u0421!");
        } else killPlayer(w, ep, "fall");
      }
    }
    if (w.warnSfxT > 0) w.warnSfxT--;
    for (i = w.particles.length - 1; i >= 0; i--) {
      var pt = w.particles[i];
      pt.x += pt.vx;
      pt.y += pt.vy;
      pt.vy += pt.g;
      pt.vx *= 0.97;
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
      w.platforms = w.platforms.filter(function(a2) {
        return a2.y < cut;
      });
      w.monsters = w.monsters.filter(function(a2) {
        return (a2.home ? a2.home.y : a2.y) < cut;
      });
      w.coins = w.coins.filter(function(a2) {
        return a2.y < cut && !a2.taken;
      });
      w.items = w.items.filter(function(a2) {
        return a2.y < cut && (!a2.taken || a2.popT > 0);
      });
      w.bullets = w.bullets.filter(function(a2) {
        return a2.y < cut;
      });
    }
    var alive = 0;
    for (i = 0; i < w.players.length; i++) if (w.players[i].alive) alive++;
    var me = w.players[0];
    if (w.net) {
    } else if (w.mode === "solo") {
      if (!me.alive && ++w.finishWait > 70) finish(w);
    } else if (alive <= 1) {
      if (++w.finishWait > 45) finish(w);
    } else if (!me.alive) {
      if (++w.finishWait > 200) finish(w);
    } else w.finishWait = 0;
  }
  function finish(w) {
    if (w.phase !== "play") return;
    w.phase = "results";
    var arr = w.players.slice().sort(function(a2, b) {
      return b.maxH - a2.maxH;
    });
    for (var i = 0; i < arr.length; i++) arr[i].place = i + 1;
  }
  function metersOf(p) {
    return Math.floor(p.maxH / PX_PER_M);
  }
  var SKY = {
    city: [[0, "#2a1868", "#622c9a", "#e66e9a"], [700, "#222c7c", "#4854ba", "#9c7ee6"], [1600, "#1e2678", "#3444aa", "#666ce0"], [3e3, "#1a1860", "#3a2898", "#7a3ec8"]],
    jungle: [[0, "#185c74", "#2ca098", "#96e896"], [700, "#1e709e", "#38b4c8", "#a8f0c8"], [1600, "#205898", "#4290d8", "#92d4ff"], [3e3, "#263888", "#5064c4", "#86a8f8"]],
    ice: [[0, "#2c68a8", "#58ace8", "#c4f2ff"], [700, "#2658a4", "#4ea2e6", "#b2e8ff"], [1600, "#264c9e", "#4e80d4", "#a8c8ff"], [3e3, "#2c3c94", "#5a5ec4", "#b096f4"]],
    lava: [[0, "#5a1c36", "#b83a38", "#ff9648"], [700, "#642248", "#c84644", "#ffaa58"], [1600, "#562468", "#a83e68", "#f67c68"], [3e3, "#482278", "#8e3a92", "#e8648c"]],
    aqua: [[0, "#126096", "#2098c8", "#68e6e8"], [700, "#16589c", "#268cd0", "#58d4f0"], [1600, "#204ea4", "#367ce0", "#68b8ff"], [3e3, "#2a44a8", "#4e66e4", "#8a9eff"]],
    space: [[0, "#242078", "#4838b8", "#8264f4"], [700, "#1e2e8c", "#3a56d0", "#64a4f8"], [1600, "#2a2284", "#5a34be", "#a458e8"], [3e3, "#24248a", "#4844c4", "#7888f8"]]
  };
  function skyAt(skin, m) {
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
  function hash(n) {
    var x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  }
  function drawCloud(ctx, x, y, s, col, hl, sh) {
    rect(ctx, x + 6 * s, y, 9 * s, 2 * s, col);
    rect(ctx, x + 2 * s, y + 2 * s, 19 * s, 2 * s, col);
    rect(ctx, x, y + 4 * s, 26 * s, 3 * s, col);
    rect(ctx, x + 7 * s, y, 5 * s, s, hl);
    rect(ctx, x + 3 * s, y + 2 * s, 4 * s, s, hl);
    rect(ctx, x + 2 * s, y + 7 * s, 22 * s, s, sh);
  }
  function drawBuildings(ctx, baseY, seed, far, tick) {
    var x = viewX0() - 4, i = 0;
    while (x < LW + VIEW_PAD) {
      var bw = (far ? 10 : 14) + Math.floor(hash(seed + i) * (far ? 8 : 10));
      var bh = (far ? 22 : 30) + Math.floor(hash(seed + i * 3.1) * (far ? 30 : 34));
      var top = Math.round(baseY - bh);
      var col = far ? i % 2 ? "#281e5c" : "#30246c" : i % 2 ? "#1c1444" : "#221852";
      rect(ctx, x, top, bw, bh + 200, col);
      rect(ctx, x, top, bw, 1, far ? "#423484" : "#3a2c74");
      if (!far && hash(seed + i * 7) > 0.6) {
        rect(ctx, x + 3, top - 5, 1, 5, "#3a2c74");
        if (Math.floor(tick / 30 + i) % 2) rect(ctx, x + 3, top - 6, 1, 1, C.red);
      }
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
  function drawPeaks(ctx, baseY, seed, col, capCol, far) {
    var x = viewX0() - 8, i = 0;
    while (x < LW + VIEW_PAD + 8) {
      var w = (far ? 22 : 28) + Math.floor(hash(seed + i) * 14);
      var h = (far ? 26 : 36) + Math.floor(hash(seed + i * 2.3) * 26);
      for (var r = 0; r < h; r += 2) {
        var rw = Math.max(2, Math.round(w * (r + 2) / h));
        rect(ctx, x + Math.floor((w - rw) / 2), baseY - h + r, rw, 2, r < h * 0.35 ? capCol : col);
      }
      rect(ctx, x, baseY, w, 120, col);
      x += w - 6;
      i++;
    }
  }
  function drawBg(ctx, camY, tick, skin, menu) {
    var map = mapInfo(skin).id;
    var alt = Math.max(0, -camY - (LH - 70));
    var m = alt / PX_PER_M;
    var sky = skyAt(map, m);
    var bands = 24, i, k;
    for (i = 0; i < bands; i++) {
      var t = i / (bands - 1);
      var col = t < 0.5 ? mixHex(sky[0], sky[1], t / 0.5) : mixHex(sky[1], sky[2], (t - 0.5) / 0.5);
      var y0 = Math.round(LH * i / bands), y1 = Math.round(LH * (i + 1) / bands);
      rect(ctx, viewX0(), y0, viewW(), y1 - y0, col);
      if (i > 0) {
        ctx.fillStyle = col;
        for (var dx = viewX0() + i % 2 * 2; dx < LW + VIEW_PAD; dx += 4) ctx.fillRect(dx, y0 - 1, 2, 1);
      }
    }
    if (map === "city" || map === "space" || map === "ice" || map === "jungle" && m > 500) {
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
        if (i % 7 === 0 && !tw) {
          rect(ctx, sx - 1, sy, 3, 1, scol);
          rect(ctx, sx, sy - 1, 1, 3, scol);
        }
      }
      ctx.globalAlpha = 1;
    }
    if (map === "city" || map === "space") {
      var moonA = map === "space" ? 0.95 : 1 - clamp((m - 1200) / 600, 0, 1);
      if (moonA > 0) {
        var mx = LW - 21, my = Math.max(28, Math.round(6 + alt * 0.015));
        if (menu) my = Math.max(70, my);
        ctx.globalAlpha = moonA;
        var mc = map === "space" ? "#a8d8ff" : "#f8e4a8", md = map === "space" ? "#78a8e0" : "#e0c078";
        rect(ctx, mx + 3, my, 10, 16, mc);
        rect(ctx, mx, my + 3, 16, 10, mc);
        rect(ctx, mx + 1, my + 1, 14, 14, mc);
        rect(ctx, mx + 4, my + 4, 3, 3, md);
        rect(ctx, mx + 10, my + 8, 3, 2, md);
        rect(ctx, mx + 6, my + 11, 2, 2, md);
        rect(ctx, mx + 3, my + 2, 4, 1, "#ffffff");
        ctx.globalAlpha = 1;
      }
    } else if (map === "jungle" || map === "lava") {
      var sunC = map === "lava" ? "#ffdc60" : "#fff4a8", sunR = map === "lava" ? "#ff9440" : "#ffd868";
      var sx0 = LW - 24, sy0 = Math.max(28, Math.round(14 + alt * 0.01));
      if (menu) sy0 = Math.max(70, sy0);
      ctx.globalAlpha = 0.25;
      rect(ctx, sx0 - 3, sy0 - 3, 22, 22, sunR);
      ctx.globalAlpha = 1;
      rect(ctx, sx0 + 3, sy0, 10, 16, sunC);
      rect(ctx, sx0, sy0 + 3, 16, 10, sunC);
      rect(ctx, sx0 + 1, sy0 + 1, 14, 14, sunC);
    }
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
    var sp = map === "space" ? 1 : map === "city" ? clamp((m - 2e3) / 800, 0, 1) : 0;
    if (sp > 0) {
      var nebs = [[32, 0.2, "#b44ee0"], [120, 0.7, "#3e8ce8"], [72, 1.3, "#e84ea0"]];
      for (k = 0; k < nebs.length; k++) {
        var nx = nebs[k][0], ny = mod(Math.floor(nebs[k][1] * 200) + alt * 0.03, LH + 120) - 60;
        ctx.globalAlpha = 0.42 * sp;
        for (var yy = -24; yy <= 24; yy += 2) for (var xx = -30; xx <= 30; xx += 2) {
          if (xx * xx / 900 + yy * yy / 576 < 1 - hash(xx * 3 + yy * 7 + k) * 0.45 && (xx + yy) / 2 % 2 === 0) rect(ctx, nx + xx, ny + yy, 2, 2, nebs[k][2]);
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
        rect(ctx, px0 - 20, py + 1, 41, 1, "#fff0b4");
        rect(ctx, px0 - 17, py + 2, 35, 1, "#e0c88c");
        rect(ctx, px0 - 14, py - 3, 6, 2, "#ffd09c");
      }
      for (k = 0; k < 6; k++) {
        var asx = mod(Math.floor(hash(k + 300) * LW) + tick * (0.05 + k * 0.01), LW + 10) - 5;
        var asy = mod(Math.floor(hash(k + 400) * LH) + alt * 0.35, LH + 20) - 10;
        rect(ctx, asx, asy, 4, 3, "#968cb4");
        rect(ctx, asx + 1, asy - 1, 2, 1, "#bab0d8");
        rect(ctx, asx + 1, asy + 1, 1, 1, "#6a6088");
      }
      ctx.globalAlpha = 1;
    }
    if (map === "aqua") {
      ctx.globalAlpha = 0.18;
      for (k = 0; k < 4; k++) {
        var bx = 18 + k * 38;
        for (var by = 0; by < LH; by += 8) rect(ctx, bx + Math.floor(by * 0.14), by, 10, 8, "#c8ffff");
      }
      ctx.globalAlpha = 0.65;
      for (k = 0; k < 16; k++) {
        var ux = mod(Math.floor(hash(k + 500) * LW) + Math.sin(tick * 0.05 + k) * 4, LW);
        var uy = mod(Math.floor(hash(k + 600) * LH) - tick * (0.35 + k % 3 * 0.15) + alt * 0.25, LH);
        var sz = k % 4 === 0 ? 3 : 2;
        rect(ctx, ux, uy, sz, sz, "#a8f8ff");
        if (sz === 3) rect(ctx, ux, uy, 1, 1, "#ffffff");
      }
      ctx.globalAlpha = 1;
    }
    if (map === "ice") {
      ctx.globalAlpha = 0.8;
      for (k = 0; k < 24; k++) {
        var fx = mod(Math.floor(hash(k + 700) * LW) + Math.sin(tick * 0.03 + k) * 5, LW);
        var fy = mod(Math.floor(hash(k + 800) * LH) + tick * (0.3 + k % 3 * 0.12) + alt * 0.28, LH);
        rect(ctx, fx, fy, k % 5 === 0 ? 2 : 1, k % 5 === 0 ? 2 : 1, "#ffffff");
      }
      ctx.globalAlpha = 1;
    }
    if (map === "lava") {
      for (k = 0; k < 20; k++) {
        var ex = mod(Math.floor(hash(k + 900) * LW) + Math.sin(tick * 0.06 + k) * 6, LW);
        var ey = mod(Math.floor(hash(k + 950) * LH) - tick * (0.45 + k % 3 * 0.15) + alt * 0.3, LH);
        rect(ctx, ex, ey, k % 3 === 0 ? 2 : 1, k % 3 === 0 ? 2 : 1, k % 2 ? "#ffd850" : "#ff6830");
      }
    }
    if (map === "city" || map === "jungle" || map === "ice" || map === "lava") {
      var cl = map === "city" ? band(m, 120, 450, 1700, 2400) : 0.85;
      if (cl > 0) {
        ctx.globalAlpha = 0.72 * cl;
        var cf = mixHex(sky[2], "#ffffff", 0.35), ch = mixHex(sky[2], "#ffffff", 0.65), cs = mixHex(sky[1], "#201840", 0.18);
        for (k = 0; k < 7; k++) {
          var cx = mod(Math.floor(hash(k + 10) * 200) + tick * (k % 2 ? 0.04 : -0.03), LW + 60) - 30;
          var cy = mod(k * 61 + alt * 0.18, LH + 60) - 30;
          drawCloud(ctx, cx, cy, 1, cf, ch, cs);
        }
        ctx.globalAlpha = 0.9 * cl;
        var nf = mixHex(sky[2], "#ffffff", 0.58), nh = "#ffffff", ns = mixHex(sky[2], "#201840", 0.12);
        for (k = 0; k < 4; k++) {
          var ncx = mod(Math.floor(hash(k + 20) * 220) + tick * (k % 2 ? 0.09 : -0.07), LW + 80) - 60;
          var ncy = mod(k * 109 + 40 + alt * 0.42, LH + 80) - 40;
          drawCloud(ctx, ncx, ncy, 2, nf, nh, ns);
        }
        ctx.globalAlpha = 1;
      }
    }
    var farBase = LH - 64 + alt * 0.1;
    var nearBase = LH - 40 + alt * 0.3;
    if (map === "city") {
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
    var roofY = Math.round(-camY);
    if (roofY < LH && roofY > -40) {
      if (map === "jungle") {
        rect(ctx, viewX0(), roofY + 3, viewW(), LH, "#2a4e36");
        rect(ctx, viewX0(), roofY + 3, viewW(), 2, "#62d458");
        for (var tx = 6; tx < LW; tx += 22) {
          rect(ctx, tx, roofY + 8, 12, 8, "#3a6848");
          rect(ctx, tx + 2, roofY + 10, 4, 2, "#80e870");
        }
      } else if (map === "ice") {
        rect(ctx, viewX0(), roofY + 3, viewW(), LH, "#6eb8e8");
        rect(ctx, viewX0(), roofY + 3, viewW(), 3, "#e8fbff");
        for (tx = 8; tx < LW; tx += 18) rect(ctx, tx, roofY + 10, 8, 4, "#9cd8fa");
      } else if (map === "lava") {
        rect(ctx, viewX0(), roofY + 3, viewW(), LH, "#3a202c");
        rect(ctx, viewX0(), roofY + 3, viewW(), 2, "#ff7c30");
        for (tx = 10; tx < LW; tx += 26) rect(ctx, tx, roofY + 11, 10, 2, "#ff5820");
      } else if (map === "aqua") {
        rect(ctx, viewX0(), roofY + 3, viewW(), LH, "#d8b46c");
        rect(ctx, viewX0(), roofY + 3, viewW(), 2, "#ffe49c");
        for (tx = 10; tx < LW; tx += 28) {
          rect(ctx, tx, roofY - 4, 2, 7, "#ff70a0");
          rect(ctx, tx - 2, roofY - 2, 2, 3, "#ff70a0");
          rect(ctx, tx + 8, roofY - 5, 2, 8, "#48e090");
        }
      } else if (map === "space") {
        rect(ctx, viewX0(), roofY + 3, viewW(), LH, "#343264");
        rect(ctx, viewX0(), roofY + 3, viewW(), 2, "#78f0ff");
        for (tx = 12; tx < LW; tx += 24) rect(ctx, tx, roofY + 10, 8, 3, "#6058a4");
      } else {
        rect(ctx, viewX0(), roofY + 3, viewW(), LH, C.brick);
        for (var ty = roofY + 7; ty < LH; ty += 6) for (tx = viewX0(); tx < LW + VIEW_PAD; tx += 8) rect(ctx, tx + ((ty - roofY) / 6 % 2 ? 4 : 0), ty, 3, 1, C.brickL);
        rect(ctx, viewX0(), roofY + 3, viewW(), 2, C.roof);
        rect(ctx, 6, roofY + 12, 18, 10, "#342a52");
        rect(ctx, 8, roofY + 14, 14, 1, "#706498");
        rect(ctx, 8, roofY + 17, 14, 1, "#706498");
        rect(ctx, 132, roofY + 10, 2, 16, "#706498");
        rect(ctx, 127, roofY + 10, 12, 1, "#706498");
      }
    }
  }
  var MAP_PLAT = {
    city: { n: "#c48448", nD: "#8a5a28", nL: "#e0a868", edge: "#5ee0d0" },
    jungle: { n: "#4ca848", nD: "#286830", nL: "#82dc6a", edge: "#b8ff70" },
    ice: { n: "#6ec4f0", nD: "#3884b8", nL: "#a8e6ff", edge: "#ffffff" },
    lava: { n: "#584858", nD: "#322834", nL: "#826c7e", edge: "#ff8c38" },
    aqua: { n: "#f07898", nD: "#a84468", nL: "#ffa8c0", edge: "#78fff0" },
    space: { n: "#6468b4", nD: "#3c4080", nL: "#98a0e8", edge: "#6ef4ff" }
  };
  function drawPlatform(ctx, p, cam, mapId, tick) {
    var map = mapInfo(mapId || "city").id;
    var tk = tick || 0;
    var x = Math.round(p.x), y = Math.round(p.y - cam), w = p.w;
    if (y < -16 || y > LH + 12) return;
    if (p.type === "cloud") {
      if (p.broken) return;
      ctx.globalAlpha = p.lifeT < 60 && (p.lifeT >> 3) % 2 ? 0.5 : 1;
      rect(ctx, x + 2, y - 2, w - 4, 6, INK);
      rect(ctx, x, y, w, 4, INK);
      rect(ctx, x + 3, y - 1, w - 6, 4, "#ffffff");
      rect(ctx, x + 1, y + 1, w - 2, 2, "#ffffff");
      rect(ctx, x + 6, y - 3, 6, 2, "#ffffff");
      rect(ctx, x + w - 13, y - 3, 7, 2, "#ffffff");
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
    if (p.type !== "break") rect(ctx, x + 1, y + 6, w - 1, 1, "rgba(0,0,0,0.28)");
    var i;
    if (p.type === "break") {
      rect(ctx, x, y, w, 5, C.brk);
      rect(ctx, x, y + 4, w, 2, C.brkD);
      ctx.fillStyle = C.brkRim;
      for (i = 0; i < w; i += 4) ctx.fillRect(x + i, y, 2, 1);
      rect(ctx, x, y + 1, 1, 4, C.brkRim);
      rect(ctx, x + w - 1, y + 1, 1, 4, C.brkRim);
      ctx.fillStyle = C.brkD;
      var c1 = x + Math.floor(w * 0.3);
      ctx.fillRect(c1, y + 1, 1, 4);
      ctx.fillRect(c1 + 1, y + 3, 2, 1);
      ctx.fillRect(x + Math.floor(w * 0.68), y + 1, 1, 5);
      ctx.fillRect(x + Math.floor(w * 0.5), y + 2, 3, 1);
      rect(ctx, x + Math.floor(w / 2) - 1, y + 2, 2, 3, "#120a2c");
    } else if (p.type === "move") {
      rect(ctx, x, y, w, 5, C.mov);
      rect(ctx, x, y + 4, w, 2, C.movD);
      rect(ctx, x, y, w, 1, C.gold);
      rect(ctx, x, y + 1, 1, 4, C.gold);
      rect(ctx, x + w - 1, y + 1, 1, 4, C.gold);
      rect(ctx, x + 2, y + 2, 1, 1, "#9ad0f0");
      rect(ctx, x + w - 3, y + 2, 1, 1, "#9ad0f0");
      var dr = p.vx >= 0 ? 1 : -1, cx = dr > 0 ? x + w - 10 : x + 4;
      ctx.fillStyle = C.gold;
      for (i = 0; i < 2; i++) {
        var bx2 = cx + i * 3;
        ctx.fillRect(bx2, y + 2, 2, 1);
        ctx.fillRect(bx2 + dr, y + 1, 1, 1);
        ctx.fillRect(bx2 + dr, y + 3, 1, 1);
      }
    } else if (p.type === "bounce") {
      var dy = p.springT > 0 ? 1 : 0;
      rect(ctx, x, y + dy, w, 5, "#6ad850");
      rect(ctx, x, y + 4 + dy, w, 2, "#2a7838");
      rect(ctx, x + 1, y - 1 + dy, w - 2, 2, "#ff6848");
      rect(ctx, x + 2, y - 2 + dy, w - 4, 1, "#ffa858");
      for (i = 3; i < w - 3; i += 6) rect(ctx, x + i, y - 1 + dy, 2, 1, "#fff6d0");
    } else if (p.type === "ice") {
      rect(ctx, x, y, w, 5, "#8ef4ff");
      rect(ctx, x, y + 4, w, 2, "#46a8dc");
      rect(ctx, x, y, w, 1, "#ffffff");
      for (i = 3; i < w - 4; i += 8) {
        rect(ctx, x + i, y + 1, 3, 1, "#ffffff");
        rect(ctx, x + i + 1, y + 2, 2, 1, "#d8ffff");
      }
    } else if (p.type === "lava") {
      var pulse = Math.floor(tk / 8) % 2;
      rect(ctx, x, y, w, 5, "#422430");
      rect(ctx, x, y + 4, w, 2, "#28141c");
      rect(ctx, x, y, w, 1, pulse ? "#ffdc58" : "#ff9030");
      for (i = 4; i < w - 4; i += 6) rect(ctx, x + i, y + 2, 3, 2, pulse ? "#ff7828" : "#ffc040");
    } else if (p.type === "bubble") {
      rect(ctx, x + 1, y, w - 2, 5, "#56e4ff");
      rect(ctx, x, y + 1, w, 3, "#7ef4ff");
      rect(ctx, x + 2, y + 4, w - 4, 2, "#2aa8d8");
      for (i = 3; i < w - 3; i += 6) rect(ctx, x + i, y + 1, 2, 1, "#ffffff");
    } else if (p.type === "grav") {
      rect(ctx, x, y, w, 5, "#7848dc");
      rect(ctx, x, y + 4, w, 2, "#482898");
      rect(ctx, x, y, w, 1, "#80ffe0");
      var up = Math.floor(tk / 6) % 2;
      for (i = 4; i < w - 4; i += 7) rect(ctx, x + i, y + 2 - up, 2, 1, "#ffd0ff");
    } else {
      var th = MAP_PLAT[map] || MAP_PLAT.city;
      rect(ctx, x, y, w, 5, th.n);
      rect(ctx, x, y + 4, w, 2, th.nD);
      rect(ctx, x + 1, y + 1, w - 2, 1, th.nL);
      rect(ctx, x, y, w, 1, th.edge);
      rect(ctx, x, y + 1, 1, 4, th.nD);
      rect(ctx, x + w - 1, y + 1, 1, 4, th.nD);
      ctx.fillStyle = th.nD;
      for (i = 5; i < w - 4; i += 7) ctx.fillRect(x + i, y + 3, 3, 1);
      rect(ctx, x + 2, y + 2, 1, 1, "#ffffff");
      rect(ctx, x + w - 3, y + 2, 1, 1, "#ffffff");
    }
    if (p.spring) {
      var sx = x + Math.floor(w / 2) - 3, h = p.springT > 0 ? 3 : 6;
      rect(ctx, sx, y - 1, 6, 1, C.springD);
      for (i = 2; i <= h; i++) rect(ctx, sx + i % 2, y - i, 5, 1, i % 2 ? C.spring : C.springD);
      rect(ctx, sx - 1, y - h - 1, 8, 1, C.coral);
      rect(ctx, sx, y - h - 2, 6, 1, "#ff8a80");
    }
  }
  var MOBPAL = {
    blob: ["#6ad86a", "#2e9a50", "#c8ffb0"],
    magma: ["#ff7828", "#b02818", "#ffe060"],
    penguin: ["#2a3048", "#f6f6ff", "#ffa030"],
    crab: ["#ff5a48", "#a82420", "#ffa898"],
    alien: ["#9af068", "#3a9a48", "#e0ffd0"],
    frog: ["#58d848", "#2a8a30", "#ffe060"],
    monkey: ["#a86a38", "#6a3a18", "#f0c890"],
    spitter: ["#ff6030", "#8a2010", "#ffe060"],
    bat: ["#8a5ad0", "#5a3aa0", "#ff5a62"],
    parrot: ["#ff4848", "#2aa8ff", "#ffd840"],
    owl: ["#e8f4ff", "#8ab0d8", "#ffd040"],
    firebat: ["#ff4848", "#881828", "#ffd040"],
    ray: ["#ffa040", "#c05a20", "#ffe0a0"],
    bob: ["#7ae0f0", "#3a9ab8", "#e0fcff"],
    ember: ["#ffb838", "#e04818", "#fff098"],
    snake: ["#5ac838", "#2a7a28", "#ffe048"],
    puffer: ["#ffd848", "#c89018", "#ffffff"],
    hole: ["#b050ff", "#ff70d0", "#4a1a7a"],
    whirl: ["#58f0ff", "#ffffff", "#1868a8"],
    wind: ["#ffffff", "#c8ecff", "#88c8f0"],
    ufo: ["#7ac8f0", "#c8d0d8", "#7a8090"],
    frost: ["#c8f8ff", "#58b8f0", "#ffffff"],
    comet: ["#ffd060", "#ff7830", "#fff8d0"]
  };
  var MOB_SPRITES = {
    ray: { src: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEgAAAAMCAYAAADBJPs9AAABSklEQVR4nGNggAIRHpn/yDQyEOGR+b/BQ+L/Bg+J/9jkqQFgdtDKfIoAcgDgcqQIjwxNHU/rgCE3AlhEeGT+z7H5g9XAMyk8cP6FGx8YHGZsYDiQEfDfQEMARa182wEGUTEThjdfnjAScuQcmz8MKUdYGBgYGBgwzT/x/0BGAAO55hMCATtekKyf5c2XJ4wpR7AHEjEA5vgzKTwMJnNk/mPzBCISSLeDGPPR7aFmBLAwMDAwvPnyhDFgB7JHIEBAQwGh8sYF7OIEAK4USi3zUe2gfgSwIHNgAQWzlBgLHlY5MNzp0WFQKbmCNQYoTaGEzKd1BOBNrkSbwsBAVPmAngWoZT56IMHMv9OjAxc7sOECrAxlcAgwgIt/uPGAQUBDAWcEkFXowRxETqFHivkpR1iILphhEUpsBKCro7QCGFZgULa1RsEoGJkAAJpO3YuHkGJqAAAAAElFTkSuQmCC", fw: 24, fh: 12, n: 3, ox: -4, oy: -2 }
  };
  var mobSprCache = {};
  function drawMobSprite(ctx, kind, x, y, frame, flip) {
    var m = MOB_SPRITES[kind];
    if (!m || !m.src) return false;
    var cv = mobSprCache[kind];
    if (cv === void 0) {
      cv = mobSprCache[kind] = pngToCanvas(m.src) || null;
    }
    if (!cv) return false;
    var f = Math.max(0, Math.min(m.n - 1, frame | 0));
    if (flip) {
      ctx.save();
      ctx.translate(x + 16 - m.ox, y + m.oy);
      ctx.scale(-1, 1);
      ctx.drawImage(cv, f * m.fw, 0, m.fw, m.fh, 0, 0, m.fw, m.fh);
      ctx.restore();
    } else ctx.drawImage(cv, f * m.fw, 0, m.fw, m.fh, x + m.ox, y + m.oy, m.fw, m.fh);
    return true;
  }
  function eyes(ctx, x, y, gap, look) {
    rect(ctx, x, y, 2, 2, "#fff6e8");
    rect(ctx, x + gap, y, 2, 2, "#fff6e8");
    rect(ctx, x + look, y + 1, 1, 1, INK);
    rect(ctx, x + gap + look, y + 1, 1, 1, INK);
  }
  function drawMob(ctx, m, cam, mapId, frozen) {
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
    var k, b = m.b, lk = m.vx > 0 ? 1 : 0, wb = Math.floor(t / 12) % 2;
    if ((m.kind === "blob" || m.kind === "magma" || m.kind === "alien" || m.kind === "crab") && slimeAlert(m)) {
      drawWalkerAlert(ctx, m, x, y, pal, t);
    } else if (m.kind === "blob" || m.kind === "magma" || m.kind === "alien" || m.kind === "crab") {
      rect(ctx, x + 2, y - 1 + wb, 8, 1, INK);
      rect(ctx, x - 1, y + 3, 14, 5, INK);
      rect(ctx, x, y + 1 + wb, 12, 3, INK);
      rect(ctx, x + 3, y + wb, 6, 1, pal[0]);
      rect(ctx, x + 1, y + 1 + wb, 10, 2, pal[0]);
      rect(ctx, x, y + 3, 12, 4, pal[0]);
      rect(ctx, x, y + 7, 12, 1, pal[1]);
      rect(ctx, x + 3, y + 1 + wb, 2, 1, pal[2]);
      eyes(ctx, x + 3, y + 3, 4, lk);
      if (m.kind === "crab") {
        rect(ctx, x - 3, y + 1 + wb, 3, 3, INK);
        rect(ctx, x - 2, y + 2 + wb, 2, 1, pal[0]);
        rect(ctx, x + 12, y + 1 + wb, 3, 3, INK);
        rect(ctx, x + 12, y + 2 + wb, 2, 1, pal[0]);
        for (k = 0; k < 3; k++) rect(ctx, x + 2 + k * 4, y + 8, 1, 1, pal[1]);
      }
      if (m.kind === "alien") {
        rect(ctx, x + 5, y - 4 + wb, 1, 4, INK);
        rect(ctx, x + 4, y - 5 + wb, 3, 2, "#ff5ab0");
        rect(ctx, x + 5, y + 1 + wb, 2, 2, "#fff6e8");
        rect(ctx, x + 5 + lk, y + 2 + wb, 1, 1, INK);
      }
      if (m.kind === "magma" && t % 20 < 10) rect(ctx, x + 4 + t % 3, y + 8, 1, 2, pal[2]);
      rect(ctx, x + 5, y + 6, 2, 1, pal[1]);
      if ((m.kind === "blob" || m.kind === "magma") && m.warnT > 0 && (t >> 2) % 2) {
        ctx.globalAlpha = 0.75;
        rect(ctx, x, y + wb, 12, 8, pal[2]);
        ctx.globalAlpha = 1;
      }
    } else if (m.kind === "penguin") {
      var wd = Math.floor(t / 8) % 2;
      rect(ctx, x - 1, y - 1, 12, 13, INK);
      rect(ctx, x, y, 10, 11, pal[0]);
      rect(ctx, x + 2, y + 3, 6, 7, pal[1]);
      eyes(ctx, x + 2, y + 1, 4, lk);
      rect(ctx, x + 4, y + 3, 2, 1, pal[2]);
      rect(ctx, x + (wd ? 1 : 2), y + 11, 3, 1, pal[2]);
      rect(ctx, x + (wd ? 6 : 5), y + 11, 3, 1, pal[2]);
      rect(ctx, x - 1 - wd, y + 4, 1, 4, pal[0]);
      rect(ctx, x + 10 + wd, y + 4, 1, 4, pal[0]);
    } else if (m.kind === "frog") {
      var air = m.hy < 0;
      rect(ctx, x - 1, y + 1, 14, 7, INK);
      rect(ctx, x + 1, y - 2, 4, 4, INK);
      rect(ctx, x + 7, y - 2, 4, 4, INK);
      rect(ctx, x, y + 2, 12, 5, pal[0]);
      rect(ctx, x + 1, y + 6, 10, 1, pal[1]);
      rect(ctx, x + 3, y + 4, 6, 2, pal[2]);
      rect(ctx, x + 2, y - 1, 2, 2, "#fff6e8");
      rect(ctx, x + 8, y - 1, 2, 2, "#fff6e8");
      rect(ctx, x + 2 + lk, y, 1, 1, INK);
      rect(ctx, x + 8 + lk, y, 1, 1, INK);
      rect(ctx, x + 4, y + 3, 4, 1, "#c03040");
      if (air) {
        rect(ctx, x - 1, y + 7, 2, 3, pal[1]);
        rect(ctx, x + 11, y + 7, 2, 3, pal[1]);
      } else {
        rect(ctx, x - 2, y + 6, 3, 2, pal[1]);
        rect(ctx, x + 11, y + 6, 3, 2, pal[1]);
      }
    } else if (m.kind === "monkey") {
      var arm = m.fx > 0;
      rect(ctx, x - 1, y - 1, 14, 12, INK);
      rect(ctx, x + 1, y, 10, 10, pal[0]);
      rect(ctx, x - 1, y + 2, 2, 3, pal[0]);
      rect(ctx, x + 11, y + 2, 2, 3, pal[0]);
      rect(ctx, x + 3, y + 3, 6, 5, pal[2]);
      eyes(ctx, x + 3, y + 2, 4, lk);
      rect(ctx, x + 5, y + 6, 2, 1, pal[1]);
      if (arm) {
        rect(ctx, x + 10, y - 5, 2, 5, pal[0]);
        rect(ctx, x + 9, y - 8, 4, 3, "#6a4020");
      } else {
        rect(ctx, x + 11, y + 6, 3, 3, "#6a4020");
      }
      rect(ctx, x + 1, y + 10, 3, 1, pal[1]);
      rect(ctx, x + 8, y + 10, 3, 1, pal[1]);
    } else if (m.kind === "spitter") {
      var open = m.fx > 0 || m.shootT < 20;
      rect(ctx, x - 1, y + 2, 14, 9, INK);
      rect(ctx, x, y + 3, 12, 7, pal[1]);
      rect(ctx, x + 2, y + 1, 8, 3, INK);
      rect(ctx, x + 3, y + 2, 6, 2, open ? pal[2] : pal[0]);
      rect(ctx, x + 1, y + 5, 10, 2, pal[0]);
      eyes(ctx, x + 2, y + 6, 6, lk);
      if (open) {
        ctx.globalAlpha = 0.6;
        rect(ctx, x + 4, y - 3, 4, 4, "#ffd040");
        ctx.globalAlpha = 1;
      }
    } else if (b === "fly") {
      var fl = Math.floor(t / 6) % 3;
      if (m.kind === "ray" && drawMobSprite(ctx, "ray", x, y, fl, m.vx < 0)) {
      } else if (m.kind === "ray") {
        var up = fl === 0 ? -1 : fl === 2 ? 1 : 0;
        rect(ctx, x + 2, y + 2 + up, 12, 4, INK);
        rect(ctx, x - 1, y + 3 + up * 2, 18, 2, INK);
        rect(ctx, x + 3, y + 3 + up, 10, 2, pal[0]);
        rect(ctx, x, y + 3 + up * 2, 4, 1, pal[0]);
        rect(ctx, x + 12, y + 3 + up * 2, 4, 1, pal[0]);
        rect(ctx, x + 5, y + 2 + up, 1, 1, "#fff6e8");
        rect(ctx, x + 10, y + 2 + up, 1, 1, "#fff6e8");
        rect(ctx, m.vx > 0 ? x - 4 : x + 16, y + 4, 4, 1, pal[1]);
      } else {
        rect(ctx, x + 4, y + 2, 6, 7, INK);
        rect(ctx, x + 5, y + 3, 4, 5, pal[0]);
        rect(ctx, x + 5, y + 2, 1, 1, pal[0]);
        rect(ctx, x + 8, y + 2, 1, 1, pal[0]);
        var wc = m.kind === "parrot" ? pal[1] : m.kind === "owl" ? pal[1] : pal[1];
        if (fl === 0) {
          rect(ctx, x, y + 1, 5, 2, wc);
          rect(ctx, x + 9, y + 1, 5, 2, wc);
          rect(ctx, x, y, 2, 1, wc);
          rect(ctx, x + 12, y, 2, 1, wc);
        } else if (fl === 1) {
          rect(ctx, x, y + 4, 5, 2, wc);
          rect(ctx, x + 9, y + 4, 5, 2, wc);
        } else {
          rect(ctx, x + 1, y + 6, 4, 2, wc);
          rect(ctx, x + 9, y + 6, 4, 2, wc);
          rect(ctx, x, y + 8, 2, 1, wc);
          rect(ctx, x + 12, y + 8, 2, 1, wc);
        }
        if (m.kind === "owl") {
          rect(ctx, x + 5, y + 3, 2, 2, pal[2]);
          rect(ctx, x + 7, y + 3, 2, 2, pal[2]);
          rect(ctx, x + 6, y + 4, 1, 1, INK);
          rect(ctx, x + 7, y + 4, 1, 1, INK);
          rect(ctx, x + 6, y + 6, 2, 1, "#e0a020");
        } else {
          rect(ctx, x + 5, y + 4, 1, 1, pal[2]);
          rect(ctx, x + 8, y + 4, 1, 1, pal[2]);
        }
        if (m.kind === "parrot") {
          rect(ctx, x + (m.vx > 0 ? 9 : 3), y + 5, 2, 2, pal[2]);
          rect(ctx, x + (m.vx > 0 ? 3 : 9), y + 8, 2, 3, pal[1]);
        }
        if (m.kind === "bat") {
          rect(ctx, x + 6, y + 7, 1, 1, "#fff6e8");
          rect(ctx, x + 7, y + 7, 1, 1, "#fff6e8");
        }
        if (m.kind === "firebat" && t % 10 < 5) {
          rect(ctx, x + 1, y - 1, 1, 2, pal[2]);
          rect(ctx, x + 12, y - 1, 1, 2, pal[2]);
        }
      }
    } else if (b === "sway") {
      rect(ctx, x + 2, y - 1, 8, 1, INK);
      rect(ctx, x - 1, y + 2, 14, 5, INK);
      rect(ctx, x, y, 12, 3, INK);
      rect(ctx, x + 3, y, 6, 1, pal[0]);
      rect(ctx, x + 1, y + 1, 10, 2, pal[0]);
      rect(ctx, x, y + 3, 12, 3, pal[0]);
      rect(ctx, x, y + 6, 12, 1, pal[1]);
      rect(ctx, x + 2, y + 1, 3, 1, pal[2]);
      rect(ctx, x + 4, y + 3, 1, 2, INK);
      rect(ctx, x + 7, y + 3, 1, 2, INK);
      for (k = 0; k < 5; k++) {
        var len = 3 + (Math.floor(t / 7) + k) % 2 * 2, off = (Math.floor(t / 10) + k) % 2;
        rect(ctx, x + 1 + k * 2 + off, y + 7, 1, len, k % 2 ? pal[1] : pal[0]);
      }
      if (m.kind === "ember") {
        var fy = t % 8 < 4 ? 1 : 0;
        rect(ctx, x + 3, y - 3 - fy, 2, 2, pal[2]);
        rect(ctx, x + 7, y - 4 + fy, 2, 3, "#ff8030");
      }
    } else if (b === "snake") {
      var top = Math.round(m.topY - cam);
      for (var vy = top; vy < y; vy += 2) {
        rect(ctx, x + 4, vy, 2, 2, (vy >> 1) % 2 ? pal[1] : "#3a8a2a");
        if ((vy - top) % 8 === 4) rect(ctx, x + ((vy >> 3) % 2 ? 6 : 1), vy, 3, 2, "#7ae050");
      }
      rect(ctx, x - 1, y - 1, 12, 10, INK);
      rect(ctx, x, y, 10, 8, pal[0]);
      rect(ctx, x + 1, y + 6, 8, 1, pal[1]);
      rect(ctx, x + 1, y + 2, 3, 2, pal[2]);
      rect(ctx, x + 6, y + 2, 3, 2, pal[2]);
      rect(ctx, x + 2, y + 2, 1, 2, INK);
      rect(ctx, x + 7, y + 2, 1, 2, INK);
      if (t % 30 < 12) {
        rect(ctx, x + 4, y + 8, 2, 3, "#ff3048");
        rect(ctx, x + 3, y + 11, 1, 1, "#ff3048");
        rect(ctx, x + 6, y + 11, 1, 1, "#ff3048");
      }
    } else if (b === "puff") {
      var bg = m.big, r = bg ? 8 : 6, cx = x + 6, cy = y + 6;
      for (var dy = -r - 1; dy <= r + 1; dy++) {
        var hw = Math.floor(Math.sqrt(Math.max(0, (r + 1) * (r + 1) - dy * dy)));
        rect(ctx, cx - hw, cy + dy, hw * 2 + 1, 1, INK);
      }
      for (dy = -r; dy <= r; dy++) {
        var hw2 = Math.floor(Math.sqrt(Math.max(0, r * r - dy * dy)));
        rect(ctx, cx - hw2, cy + dy, hw2 * 2 + 1, 1, dy > r / 3 ? pal[2] : pal[0]);
      }
      if (bg) for (k = 0; k < 8; k++) {
        var aa = k * Math.PI / 4;
        rect(ctx, cx + Math.cos(aa) * (r + 2) - 1, cy + Math.sin(aa) * (r + 2) - 1, 2, 2, pal[1]);
      }
      eyes(ctx, cx - 3 + lk, cy - 2, 4, lk);
      rect(ctx, cx - 1, cy + 2, 3, 1, pal[1]);
      rect(ctx, m.vx > 0 || Math.sin(m.t * 0.015) < 0 ? cx - r - 3 : cx + r + 1, cy - 1, 2, 3, pal[1]);
    } else if (b === "pull") {
      var hl = pal;
      var hx = x + 7, hy = y + 7, a2;
      ctx.globalAlpha = 0.35;
      for (k = 0; k < 18; k++) {
        a2 = k * Math.PI / 9 + t * 0.015;
        rect(ctx, hx + Math.cos(a2) * 32, hy + Math.sin(a2) * 32, 1, 1, hl[0]);
      }
      ctx.globalAlpha = 0.65;
      for (k = 0; k < 12; k++) {
        a2 = k * Math.PI / 6 - t * 0.04;
        rect(ctx, hx + Math.cos(a2) * 18, hy + Math.sin(a2) * 18, 1, 1, hl[1]);
      }
      ctx.globalAlpha = 1;
      for (k = 0; k < 12; k++) {
        a2 = k * 0.52 + t * (m.kind === "whirl" ? -0.12 : 0.09);
        var rr = 8 + k % 3;
        rect(ctx, hx + Math.cos(a2) * rr - 1, hy + Math.sin(a2) * rr - 1, 2, 2, k % 2 ? hl[0] : hl[1]);
      }
      for (var dy2 = -6; dy2 <= 6; dy2++) {
        var hw3 = Math.floor(Math.sqrt(36 - dy2 * dy2));
        rect(ctx, hx - hw3, hy + dy2, hw3 * 2 + 1, 1, Math.abs(dy2) > 4 ? hl[2] : m.kind === "whirl" ? "#0a3a6a" : "#0c0618");
      }
    } else if (b === "wind") {
      ctx.globalAlpha = 0.55;
      for (k = 0; k < 9; k++) {
        var sx = mod(Math.floor(hash(k * 3.3 + m.baseY) * LW) + t * m.dir * 1.6, LW), sy = y + k % 4 * 3;
        rect(ctx, sx, sy, 8 + k % 3 * 3, 1, k % 2 ? pal[0] : pal[1]);
      }
      ctx.globalAlpha = 1;
      rect(ctx, x + 2, y, 18, 9, INK);
      rect(ctx, x, y + 2, 22, 5, INK);
      rect(ctx, x + 3, y + 1, 16, 7, pal[0]);
      rect(ctx, x + 1, y + 3, 20, 3, pal[0]);
      rect(ctx, x + 4, y + 6, 14, 1, pal[2]);
      rect(ctx, x + 7, y + 3, 1, 1, INK);
      rect(ctx, x + 13, y + 3, 1, 1, INK);
      rect(ctx, m.dir > 0 ? x + 17 : x + 3, y + 4, 2, 2, "#88a8d8");
    } else if (m.kind === "ufo") {
      rect(ctx, x + 3, y - 1, 8, 4, INK);
      rect(ctx, x - 1, y + 2, 16, 5, INK);
      rect(ctx, x + 4, y, 6, 1, "#e8fcff");
      rect(ctx, x + 3, y + 1, 8, 2, pal[0]);
      rect(ctx, x + 6, y + 1, 2, 1, "#5ed6b4");
      rect(ctx, x, y + 3, 14, 2, pal[1]);
      rect(ctx, x + 1, y + 5, 12, 1, pal[2]);
      for (k = 0; k < 4; k++) rect(ctx, x + 1 + k * 4, y + 4, 1, 1, (Math.floor(t / 8) + k) % 2 ? C.gold : C.red);
      if (m.shootT < 18) {
        ctx.globalAlpha = 0.4;
        rect(ctx, x + 5, y + 6, 4, 5, "#ff8a3a");
        ctx.globalAlpha = 1;
      }
    } else if (m.kind === "frost") {
      rect(ctx, x + 3, y - 1, 6, 14, INK);
      rect(ctx, x - 1, y + 3, 14, 6, INK);
      rect(ctx, x + 4, y, 4, 12, pal[0]);
      rect(ctx, x, y + 4, 12, 4, pal[0]);
      rect(ctx, x + 2, y + 2, 8, 8, pal[0]);
      rect(ctx, x + 5, y + 1, 2, 2, pal[2]);
      eyes(ctx, x + 3, y + 5, 4, lk);
      for (k = 0; k < 3; k++) rect(ctx, x + 3 + k * 3, y + 12, 1, 2 + k % 2, pal[1]);
      if (m.shootT < 20) {
        ctx.globalAlpha = 0.5;
        rect(ctx, x + 4, y + 12, 4, 4, "#e8ffff");
        ctx.globalAlpha = 1;
      }
    } else if (b === "comet") {
      var go = m.st === "go";
      if (!go) {
        ctx.globalAlpha = 0.3;
        for (var px = 0; px < LW; px += 6) rect(ctx, px, y + 4, 3, 1, pal[1]);
        ctx.globalAlpha = t % 10 < 5 ? 0.5 : 0.25;
        rect(ctx, x - 2, y - 2, 16, 12, pal[2]);
        ctx.globalAlpha = 1;
      } else {
        for (k = 1; k < 6; k++) {
          ctx.globalAlpha = 0.6 - k * 0.1;
          rect(ctx, x + (m.vx > 0 ? -k * 4 : 10 + k * 4 - 4), y + 2 + k % 2, 4, 4 - (k > 3 ? 1 : 0), k % 2 ? pal[1] : pal[0]);
        }
        ctx.globalAlpha = 1;
      }
      rect(ctx, x, y - 1, 12, 10, INK);
      rect(ctx, x + 1, y, 10, 8, "#8a7a6a");
      rect(ctx, x + 2, y + 1, 4, 2, "#b0a090");
      rect(ctx, x + 7, y + 4, 2, 2, "#5a4a3a");
      rect(ctx, x + 1, y, 10, 1, pal[0]);
    }
    if (frozen) {
      ctx.globalAlpha = 0.45;
      rect(ctx, x - 1, y - 1, m.w + 2, m.h + 2, "#c8f8ff");
      ctx.globalAlpha = 1;
    }
  }
  function drawBullet(ctx, b, cam) {
    var y = Math.round(b.y - cam), x = Math.round(b.x);
    if (y < -8 || y > LH + 8 || b.life <= 0) return;
    if (b.kind === "ice") {
      rect(ctx, x - 1, y, 3, 6, "#58b8f0");
      rect(ctx, x, y + 1, 1, 4, "#ffffff");
      rect(ctx, x, y + 6, 1, 1, "#58b8f0");
    } else if (b.kind === "nut") {
      rect(ctx, x - 2, y - 1, 4, 4, INK);
      rect(ctx, x - 1, y, 3, 3, "#7a4a20");
      rect(ctx, x - 1, y, 1, 1, "#c08850");
    } else if (b.kind === "fire") {
      rect(ctx, x - 2, y - 1, 4, 5, "#ff4818");
      rect(ctx, x - 1, y, 2, 3, "#ffd040");
      if ((b.life >> 2) % 2) rect(ctx, x - 1, y + 4, 2, 2, "#ff8030");
    } else {
      rect(ctx, x - 1, y, 3, 5, "#ff6a2a");
      rect(ctx, x, y + 1, 1, 3, "#fff0a0");
    }
  }
  var ITEM_COL = { bigcoin: "#f0b428", shield: "#3d8ad8", magnet: "#e03848", rocket: "#ff6a3a" };
  function drawItemIcon(ctx, kind, x, y) {
    if (HUD_ICONS[kind]) {
      drawHudIcon(ctx, kind, x, y);
      return;
    }
    if (kind === "bigcoin") {
      rect(ctx, x + 2, y + 1, 6, 8, C.gold);
      rect(ctx, x + 1, y + 2, 8, 6, C.gold);
      rect(ctx, x + 3, y + 2, 2, 2, "#fff4c0");
      rect(ctx, x + 4, y + 4, 2, 3, C.goldD);
    } else if (kind === "shield") {
      rect(ctx, x + 2, y + 1, 6, 5, "#5ec8ff");
      rect(ctx, x + 3, y + 6, 4, 2, "#5ec8ff");
      rect(ctx, x + 4, y + 8, 2, 1, "#5ec8ff");
      rect(ctx, x + 3, y + 2, 2, 3, "#e8fcff");
    } else if (kind === "magnet") {
      rect(ctx, x + 1, y + 1, 3, 7, "#ff5a62");
      rect(ctx, x + 6, y + 1, 3, 7, "#ff5a62");
      rect(ctx, x + 1, y + 6, 8, 3, "#ff5a62");
      rect(ctx, x + 1, y + 1, 3, 2, "#e8ecf4");
      rect(ctx, x + 6, y + 1, 3, 2, "#e8ecf4");
      rect(ctx, x + 4, y + 6, 2, 1, "#a82a38");
    } else if (kind === "rocket") {
      rect(ctx, x + 4, y, 2, 1, "#ff5a62");
      rect(ctx, x + 3, y + 1, 4, 6, "#e8ecf4");
      rect(ctx, x + 4, y + 2, 2, 2, "#5ec8ff");
      rect(ctx, x + 2, y + 5, 1, 3, "#ff5a62");
      rect(ctx, x + 7, y + 5, 1, 3, "#ff5a62");
      rect(ctx, x + 4, y + 7, 2, 2, "#ffd046");
    }
  }
  function fillDisk(ctx, cx, cy, r, col) {
    for (var dy = -r; dy <= r; dy++) {
      var hw = Math.floor(Math.sqrt(r * r - dy * dy));
      rect(ctx, cx - hw, cy + dy, hw * 2 + 1, 1, col);
    }
  }
  function strokeDisk(ctx, cx, cy, r, col) {
    var r2 = (r - 1) * (r - 1);
    for (var dy = -r; dy <= r; dy++) {
      var hw = Math.floor(Math.sqrt(r * r - dy * dy));
      var inner = dy * dy >= r2 ? -1 : Math.floor(Math.sqrt(r2 - dy * dy));
      if (inner < 0) rect(ctx, cx - hw, cy + dy, hw * 2 + 1, 1, col);
      else {
        rect(ctx, cx - hw, cy + dy, hw - inner, 1, col);
        rect(ctx, cx + inner + 1, cy + dy, hw - inner, 1, col);
      }
    }
  }
  function drawBubble(ctx, cx, cy) {
    ctx.globalAlpha = BUBBLE.fillA;
    fillDisk(ctx, cx, cy, BUBBLE.r - 1, BUBBLE.fill);
    ctx.globalAlpha = 1;
    strokeDisk(ctx, cx, cy, BUBBLE.r, BUBBLE.rim);
    rect(ctx, cx - 4, cy - 6, 2, 1, BUBBLE.hi);
  }
  function drawBubblePop(ctx, cx, cy, t) {
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
        [-r - d, 0],
        [r + d, 0],
        [0, -r - d],
        [0, r + d],
        [-r, -r],
        [r, -r],
        [-r, r],
        [r, r]
      ];
      for (i = 0; i < (frame === 2 ? 8 : 6); i++) {
        ox = cx + pts[i][0];
        oy = cy + pts[i][1];
        if (frame === 2) {
          rect(ctx, ox, oy, 2, 2, col);
          rect(ctx, ox + 1, oy - 1, 1, 1, BUBBLE.hi);
        } else rect(ctx, ox, oy, 1, 1, col);
      }
    }
  }
  function drawItem(ctx, it, cam, tick) {
    if (it.taken && !(it.popT > 0)) return;
    var by = it.popT > 0 ? 0 : tick + it.x >> BUBBLE.bobShift & 1 ? -BUBBLE.bobAmp : 0;
    var y = Math.round(it.y - cam) + by, x = Math.round(it.x);
    if (y < -28 || y > LH + 12) return;
    var cx = x + 5, cy = y + 5;
    if (it.popT > 0) {
      drawBubblePop(ctx, cx, cy, it.popT);
      return;
    }
    drawBubble(ctx, cx, cy);
    if (drawBonusSprite(ctx, it.kind, cx, cy)) return;
    drawItemIcon(ctx, it.kind, x, y);
  }
  var SHIELD_BLINK_T = 90;
  var WALL_BLINK_T = 60;
  var NINJA_WALL_TILE = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAQCAYAAAArij59AAAAxElEQVR4nJWRrQrCABSFv8GaCwaLYDT6AD6EYWXFZzD6GEafwWIxGCwaBGGI4ISBoks6VESHuA1EBxrGfhWcN13uOZdz7rlCQSq9+r0W36omNxEBJG2AszESYGeyB/AJ2nAOgH5wqRRzCaIIMN3Z4SDeAwiZPNBt+xOlEfVxidnyjHnzkBU4Xu4AjFZWRFhbj3AjAP7z8DMHQ9VRjSvVch7HfX6aDHTT+tk9JG5PZSECjBcnAEzHo66AsbXDyMUAiFf8H28u114h4LlTRwAAAABJRU5ErkJggg==";
  var NINJA_WALL_CAP = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAECAYAAACzzX7wAAAAS0lEQVR4nGMU4ZH5z4AHsDAwMDDsKLNg4ODiYfhy+w5CQlqCwaPrBETBnSvPGBgYGBj+fP7KcOX5VwYDNTGGY0fPMTAwMDAwErICANZaE3BP+jYWAAAAAElFTkSuQmCC";
  var ninjaWallCache = {};
  function ninjaWallSprite(kind) {
    if (ninjaWallCache[kind] !== void 0) return ninjaWallCache[kind];
    var src = kind === "cap" ? NINJA_WALL_CAP : NINJA_WALL_TILE;
    var cv = pngToCanvas(src);
    ninjaWallCache[kind] = cv || null;
    return ninjaWallCache[kind];
  }
  function drawNinjaWallCapAt(ctx, left, y, flipV) {
    var cap = ninjaWallSprite("cap");
    if (!cap) return;
    ctx.save();
    if (!left) {
      ctx.translate(LW, 0);
      ctx.scale(-1, 1);
    }
    if (flipV) {
      ctx.translate(0, y + 4);
      ctx.scale(1, -1);
      ctx.drawImage(cap, 0, 0);
    } else ctx.drawImage(cap, 0, y);
    ctx.restore();
  }
  function drawNinjaWallCol(ctx, left, y0, y1, camI, withCaps) {
    var tile = ninjaWallSprite("tile");
    y0 = Math.floor(y0);
    y1 = Math.ceil(y1);
    if (y1 <= y0) return;
    ctx.save();
    if (!left) {
      ctx.translate(LW, 0);
      ctx.scale(-1, 1);
    }
    ctx.beginPath();
    ctx.rect(0, y0, 8, y1 - y0);
    ctx.clip();
    if (tile) {
      var sy = Math.floor((y0 + camI) / 16) * 16 - camI;
      while (sy < y1) {
        ctx.drawImage(tile, 0, sy);
        sy += 16;
      }
    } else {
      var yy = y0;
      while (yy < y1) {
        var wy = yy + camI, seg = Math.floor(wy / 4), next = Math.min(y1, (seg + 1) * 4 - camI);
        rect(ctx, 0, yy, 8, next - yy, seg & 1 ? "#d82a2a" : C.cream);
        yy = next;
      }
      rect(ctx, 0, y0, 1, y1 - y0, INK);
      rect(ctx, 7, y0, 1, y1 - y0, INK);
    }
    ctx.restore();
    if (withCaps) {
      drawNinjaWallCapAt(ctx, left, y0 - 3, false);
      drawNinjaWallCapAt(ctx, left, y1 - 1, true);
    }
  }
  function drawNinjaWalls(ctx, p, sy, cam, tick, full, bottom) {
    if (!(p.wallT > 0) || !p.alive) return;
    if (p.wallT <= WALL_BLINK_T && ((p.remote ? tick : p.wallT) >> 2) % 2) return;
    var camI = Math.round(cam);
    var y0 = full ? 0 : Math.max(0, Math.round(sy) - 36), y1 = full ? bottom : Math.min(bottom, Math.round(sy) + PH + 36);
    drawNinjaWallCol(ctx, true, y0, y1, camI, !full);
    drawNinjaWallCol(ctx, false, y0, y1, camI, !full);
  }
  var SHIELD_FRAMES = null;
  function buildShieldFrames() {
    var frames = [];
    var specs = [
      { r0: 12.1, r1: 13.7, cHi: "#ffffff", cMid: "#a4e8ff", cLow: "#3ca4ec", sparks: [[0, -15, "#a4e8ff"], [0, 15, "#3ca4ec"], [-15, 0, "#a4e8ff"], [15, 0, "#3ca4ec"]] },
      { r0: 12.7, r1: 14.5, cHi: "#ffffff", cMid: "#a4e8ff", cLow: "#5ec8ff", sparks: [[-11, -11, "#ffffff"], [11, -11, "#a4e8ff"], [-11, 11, "#a4e8ff"], [11, 11, "#3ca4ec"]] },
      { r0: 13.4, r1: 15.2, cHi: "#ffffff", cMid: "#c8f4ff", cLow: "#5ec8ff", sparks: [[0, -16, "#ffffff"], [0, 16, "#a4e8ff"], [-16, 0, "#ffffff"], [16, 0, "#a4e8ff"]] },
      { r0: 12.7, r1: 14.3, cHi: "#a4e8ff", cMid: "#5ec8ff", cLow: "#3ca4ec", sparks: [[-10, -12, "#a4e8ff"], [12, -10, "#a4e8ff"], [-12, 10, "#3ca4ec"], [10, 12, "#3ca4ec"]] }
    ];
    var N = 37, H = 18;
    for (var fi = 0; fi < specs.length; fi++) {
      let idx2 = function(dx2, dy2) {
        return (dy2 + H) * N + (dx2 + H);
      };
      var idx = idx2;
      var sp = specs[fi];
      var grid = [];
      for (var i = 0; i < N * N; i++) grid.push(null);
      for (var dy = -16; dy <= 16; dy++) {
        for (var dx = -16; dx <= 16; dx++) {
          var d = Math.sqrt(dx * dx + dy * dy);
          if (d >= sp.r0 && d <= sp.r1) {
            var diag = dx + dy;
            grid[idx2(dx, dy)] = diag < -7 ? sp.cHi : diag < 7 ? sp.cMid : sp.cLow;
          }
        }
      }
      for (var si = 0; si < sp.sparks.length; si++) {
        var sx = sp.sparks[si][0], sy2 = sp.sparks[si][1];
        grid[idx2(sx, sy2)] = sp.sparks[si][2];
      }
      var out = [];
      var dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      for (dy = -17; dy <= 17; dy++) {
        for (dx = -17; dx <= 17; dx++) {
          var c = grid[idx2(dx, dy)];
          if (c) {
            out.push([dx, dy, c]);
            continue;
          }
          var d2 = Math.sqrt(dx * dx + dy * dy);
          if (d2 <= sp.r0) continue;
          for (var di = 0; di < 4; di++) {
            var nx = dx + dirs[di][0], ny = dy + dirs[di][1];
            if (nx >= -H && nx <= H && ny >= -H && ny <= H && grid[idx2(nx, ny)]) {
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
  function drawShieldAura(ctx, p, sy, tick) {
    if (!(p.shieldT > 0)) return;
    if (p.shieldT <= SHIELD_BLINK_T) {
      var bt = p.remote ? tick : p.shieldT;
      if ((bt >> 2) % 2 === 0) return;
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
  var NET_PROTO = 1;
  var NET_GEN = "0.6";
  var NET_SEND_MS = 66;
  var NET_DELAY_MS = 150;
  var NET_GRACE_MS = 1e4;
  var NET_XS = [74, 22, 124, 48];
  var NET_TAGS = { host: "\u0425\u041E\u0421\u0422", ready: "\u0413\u041E\u0422\u041E\u0412", wait: "\u0416\u0414\u0401\u041C", off: "\u041D\u0415\u0422 \u0421\u0412\u042F\u0417\u0418" };
  var NET = function() {
    var N = {
      ws: null,
      st: "off",
      /* off | connecting | online | reconnecting | error | unsupported */
      room: null,
      you: -1,
      token: "",
      err: "",
      sub: "home",
      code: "",
      startInfo: null,
      results: null,
      off: 0,
      rtt: 0,
      pingT: 0,
      lastSend: 0,
      reconUntil: 0,
      reconTimer: 0,
      onOpen: null,
      probing: false,
      stats: { sent: 0, recv: 0, snaps: 0, startedAt: 0 },
      buf: {},
      /* pid -> samples [{t,x,y,vx,vy,f,a,m,ps}] */
      events: [],
      api: null
    };
    function now() {
      return Date.now();
    }
    function serverNow() {
      return now() + N.off;
    }
    function builtinOrigin() {
      try {
        if (typeof HOP_SERVER !== "undefined" && HOP_SERVER) return String(HOP_SERVER).replace(/\/$/, "");
      } catch (_e) {
      }
      return "";
    }
    function toWs(origin) {
      var o = String(origin || "").trim();
      if (!o) return "";
      if (o.indexOf("ws://") === 0 || o.indexOf("wss://") === 0) {
        return /\/ws\/?$/.test(o) ? o.replace(/\/$/, "") : o.replace(/\/$/, "") + "/ws";
      }
      if (o.indexOf("https://") === 0) return "wss://" + o.slice(8).replace(/\/$/, "") + "/ws";
      if (o.indexOf("http://") === 0) return "ws://" + o.slice(7).replace(/\/$/, "") + "/ws";
      return "";
    }
    function toHealth(wsUrl) {
      try {
        var s = String(wsUrl || "");
        if (s.indexOf("wss://") === 0) s = "https://" + s.slice(6);
        else if (s.indexOf("ws://") === 0) s = "http://" + s.slice(5);
        var u = new URL(s);
        var path = u.pathname || "";
        if (path.lastIndexOf("/ws") === path.length - 3) path = path.slice(0, -3);
        if (path.charAt(path.length - 1) === "/") path = path.slice(0, -1);
        u.pathname = path + "/api/health";
        u.search = "";
        u.hash = "";
        return u.toString();
      } catch (_e) {
        return "";
      }
    }
    function url() {
      var w = typeof window !== "undefined" ? window : null;
      if (!w) return "";
      try {
        var q = new URLSearchParams(w.location.search).get("server");
        if (q) return toWs(q);
        if (w.HOPPAK_SERVER) return toWs(w.HOPPAK_SERVER);
        var ls = w.localStorage && w.localStorage.getItem("hoppak.server");
        if (ls) return toWs(ls);
      } catch (_e) {
      }
      var built = builtinOrigin();
      if (built) return toWs(built);
      var pr = w.location && w.location.protocol;
      if (pr !== "http:" && pr !== "https:") return "";
      return (pr === "https:" ? "wss://" : "ws://") + w.location.host + "/ws";
    }
    function store(k, v) {
      try {
        if (v == null) sessionStorage.removeItem(k);
        else sessionStorage.setItem(k, v);
      } catch (_e) {
      }
    }
    function load(k) {
      try {
        return sessionStorage.getItem(k);
      } catch (_e) {
        return null;
      }
    }
    function nick() {
      var s = "";
      try {
        s = localStorage.getItem("hoppak.nick") || "";
      } catch (_e) {
      }
      return s;
    }
    function cleanText(s, max) {
      s = String(s || "").toUpperCase();
      var out = "";
      for (var i = 0; i < s.length && out.length < max; i++) if (FONT[s[i]] || s[i] === " ") out += s[i];
      return out.trim();
    }
    function cleanNick(s) {
      return cleanText(s, 10);
    }
    function send(event, data) {
      if (!N.ws || N.ws.readyState !== 1) return false;
      N.ws.send(JSON.stringify({ event, data: data || {} }));
      N.stats.sent++;
      return true;
    }
    N.send = send;
    N.serverNow = serverNow;
    function failLink(cb) {
      N.st = "error";
      N.err = "\u041D\u0415\u0422 \u0421\u0412\u042F\u0417\u0418";
      var f = cb || N.onOpen;
      N.onOpen = null;
      if (f) f(false);
    }
    function probeHealth(hu, cb) {
      if (!hu || typeof fetch === "undefined") {
        cb(false);
        return;
      }
      var ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
      var to = setTimeout(function() {
        try {
          if (ctrl) ctrl.abort();
        } catch (_e) {
        }
      }, 5e3);
      var done = false;
      function finish2(ok) {
        if (done) return;
        done = true;
        clearTimeout(to);
        cb(!!ok);
      }
      var opts = { method: "GET", cache: "no-store", mode: "cors" };
      if (ctrl) opts.signal = ctrl.signal;
      fetch(hu, opts).then(function(r) {
        finish2(!!r && r.ok);
      }).catch(function() {
        finish2(false);
      });
    }
    function openSocket(u) {
      var ws;
      try {
        ws = new WebSocket(u);
      } catch (_e) {
        failLink();
        return;
      }
      N.ws = ws;
      var opened = false;
      var to = setTimeout(function() {
        if (!opened) {
          try {
            ws.close();
          } catch (_e) {
          }
        }
      }, 5e3);
      ws.onopen = function() {
        opened = true;
        clearTimeout(to);
        if (N.helloTimer) clearTimeout(N.helloTimer);
        N.helloTimer = setTimeout(function() {
          N.helloTimer = 0;
          if (N.ws === ws && N.st !== "online" && N.st !== "unsupported") rejectVersion();
        }, 2e3);
      };
      ws.onmessage = function(e) {
        N.stats.recv++;
        var m;
        try {
          m = JSON.parse(e.data);
        } catch (_e2) {
          return;
        }
        onMsg(m.event, m.data || {});
      };
      ws.onclose = function() {
        clearTimeout(to);
        if (N.helloTimer) {
          clearTimeout(N.helloTimer);
          N.helloTimer = 0;
        }
        if (N.ws !== ws) return;
        N.ws = null;
        if (N.st === "unsupported") return;
        if (!opened && N.st !== "reconnecting") {
          failLink();
          return;
        }
        if (N.room) startReconnect();
        else if (N.st !== "error") N.st = "off";
      };
      ws.onerror = function() {
      };
    }
    N.connect = function(cb) {
      if (N.ws && N.ws.readyState === 1) {
        if (cb) cb(true);
        return;
      }
      var u = url();
      if (!u || typeof WebSocket === "undefined") {
        failLink(cb);
        return;
      }
      if (N.ws && N.ws.readyState === 0) {
        N.onOpen = cb || N.onOpen;
        return;
      }
      if (N.probing) {
        N.onOpen = cb || N.onOpen;
        return;
      }
      N.st = N.st === "reconnecting" ? "reconnecting" : "connecting";
      N.onOpen = cb || null;
      N.probing = true;
      probeHealth(toHealth(u), function(ok) {
        N.probing = false;
        if (N.st !== "connecting" && N.st !== "reconnecting") return;
        if (!ok) {
          failLink();
          return;
        }
        openSocket(u);
      });
    };
    function startReconnect() {
      if (N.st !== "reconnecting") {
        N.st = "reconnecting";
        N.reconUntil = now() + NET_GRACE_MS;
      }
      if (N.reconTimer) return;
      N.reconTimer = setTimeout(function() {
        N.reconTimer = 0;
        if (N.st !== "reconnecting") return;
        if (now() > N.reconUntil) {
          giveUp("\u0421\u0412\u042F\u0417\u042C \u041F\u041E\u0422\u0415\u0420\u042F\u041D\u0410");
          return;
        }
        N.connect();
        setTimeout(function() {
          if (N.st === "reconnecting" && !N.ws) startReconnect();
        }, 1200);
      }, 800);
    }
    function rejectVersion() {
      if (N.helloTimer) {
        clearTimeout(N.helloTimer);
        N.helloTimer = 0;
      }
      N.st = "unsupported";
      N.err = "\u041C\u0423\u041B\u042C\u0422\u0418\u041F\u041B\u0415\u0415\u0420 \u041D\u0415\u0414\u041E\u0421\u0422\u0423\u041F\u0415\u041D \u0412 \u042D\u0422\u041E\u0419 \u0412\u0415\u0420\u0421\u0418\u0418";
      N.room = null;
      var ws = N.ws;
      N.ws = null;
      try {
        if (ws) ws.close();
      } catch (_e) {
      }
      var f = N.onOpen;
      N.onOpen = null;
      if (f) f(false);
      if (N.api && N.api.phase() === "net") N.sub = "home";
    }
    function giveUp(msg) {
      N.st = "error";
      N.err = msg;
      N.room = null;
      N.token = "";
      store("hoppak.net.token", null);
      var w = N.api && N.api.world();
      if (w && w.net && w.phase === "play") {
        w.net = false;
        w.netLost = true;
      }
      if (N.api && N.api.phase() === "net") N.sub = "home";
    }
    function ping() {
      N.pingT = now();
      send("ping", { c: N.pingT });
    }
    N.dropSocket = function() {
      if (N.ws) {
        try {
          N.ws.close();
        } catch (_e) {
        }
      }
    };
    function onMsg(ev, d) {
      if (ev === "pong") {
        var t = now(), rtt = t - d.c, off = d.s + rtt / 2 - t;
        if (!N.rtt || rtt < N.rtt * 1.5) N.off = N.rtt ? N.off * 0.7 + off * 0.3 : off;
        N.rtt = N.rtt ? N.rtt * 0.8 + rtt * 0.2 : rtt;
      } else if (ev === "hello") {
        if (N.helloTimer) {
          clearTimeout(N.helloTimer);
          N.helloTimer = 0;
        }
        if (d.v !== NET_PROTO) {
          rejectVersion();
          return;
        }
        ping();
        var tok = N.token || load("hoppak.net.token");
        if (N.st === "reconnecting" && tok) send("resume", { token: tok });
        else {
          N.st = "online";
          var f = N.onOpen;
          N.onOpen = null;
          if (f) f(true);
        }
        if (d.s && !N.rtt) N.off = d.s - now();
      } else if (ev === "room") {
        var wasRecon = N.st === "reconnecting";
        N.room = d;
        N.you = d.you;
        N.token = d.token;
        store("hoppak.net.token", d.token);
        N.st = "online";
        sessionFor(d.code);
        if (wasRecon) {
          var f = N.onOpen;
          N.onOpen = null;
          if (f) f(true);
        }
        if (N.api && N.api.phase() === "net" && N.sub !== "room") N.sub = "room";
      } else if (ev === "start") {
        N.startInfo = d;
        N.results = null;
        N.buf = {};
        var w0 = N.api && N.api.world();
        if (d.resumed && w0 && w0.net && w0.netRound === d.round) return;
        if (d.resumed) {
          send("ev", { e: "dead", m: 0, why: "left" });
          N.sub = "room";
          return;
        }
        if (N.api) N.api.startNet(d);
      } else if (ev === "snap") {
        N.stats.snaps++;
        for (var i = 0; i < d.s.length; i++) {
          var a2 = d.s[i], pid = a2[0];
          if (pid === N.you) continue;
          var b = N.buf[pid] || (N.buf[pid] = []);
          b.push({ t: d.ts, x: a2[1], y: a2[2], vx: a2[3], vy: a2[4], f: a2[5], a: a2[6], m: a2[7], ps: a2[8] });
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
          N.err = "\u041E\u0411\u041D\u041E\u0412\u0418 \u0421\u0422\u0420\u0410\u041D\u0418\u0426\u0423";
          N.room = null;
          N.sub = "update";
          return;
        }
        N.err = d.msg || d.code;
        if (d.code === "NO_SESSION") giveUp("\u041A\u041E\u041C\u041D\u0410\u0422\u0410 \u0417\u0410\u041A\u0420\u042B\u0422\u0410");
        if (N.api) N.api.say(cleanText(N.err, 24) || "\u041E\u0428\u0418\u0411\u041A\u0410");
      } else if (ev === "kicked") {
        var code = d && d.code || N.room && N.room.code || "";
        rememberKick(code);
        N.room = null;
        N.you = null;
        N.token = "";
        N.startInfo = null;
        store("hoppak.net.token", null);
        N.sub = "home";
        N.st = N.ws ? "online" : "off";
        if (N.api) {
          N.api.goMenu();
          N.api.say("\u0422\u0415\u0411\u042F \u0412\u042B\u0413\u041D\u0410\u041B\u0418");
        }
      }
    }
    function kickedCodes() {
      try {
        var raw = sessionStorage.getItem("hoppak.net.kicked");
        var a2 = raw ? JSON.parse(raw) : [];
        return Array.isArray(a2) ? a2 : [];
      } catch (_e) {
        return [];
      }
    }
    function rememberKick(code) {
      if (!code) return;
      var a2 = kickedCodes();
      if (a2.indexOf(code) < 0) a2.push(code);
      try {
        sessionStorage.setItem("hoppak.net.kicked", JSON.stringify(a2));
      } catch (_e) {
      }
    }
    function wasKicked(code) {
      return kickedCodes().indexOf(String(code || "")) >= 0;
    }
    function me() {
      return { name: cleanNick(nick()) || CHARS[N.api ? N.api.save().char : 0].name.toUpperCase(), kind: N.api ? N.api.save().char : 0, g: NET_GEN };
    }
    N.create = function() {
      N.connect(function(ok) {
        if (ok) {
          var m = me();
          send("create", m);
        }
      });
    };
    N.join = function(code) {
      if (wasKicked(code)) {
        if (N.api) {
          N.api.goMenu();
          N.api.say("\u0422\u0415\u0411\u042F \u0412\u042B\u0413\u041D\u0410\u041B\u0418");
        }
        return;
      }
      N.connect(function(ok) {
        if (ok) {
          var m = me();
          m.code = code;
          send("join", m);
        }
      });
    };
    N.leave = function() {
      if (N.room) send("leave", {});
      N.room = null;
      N.token = "";
      N.startInfo = null;
      N.results = null;
      N.session = emptySession("");
      store("hoppak.net.token", null);
      if (N.reconTimer) {
        clearTimeout(N.reconTimer);
        N.reconTimer = 0;
      }
      if (N.st === "reconnecting") N.st = N.ws ? "online" : "off";
    };
    N.inRoom = function() {
      return !!N.room;
    };
    N.isHost = function() {
      return !!N.room && N.room.host === N.you;
    };
    N.mePlayer = function() {
      if (!N.room) return null;
      for (var i = 0; i < N.room.players.length; i++) if (N.room.players[i].pid === N.you) return N.room.players[i];
      return null;
    };
    N.fixedLW = function() {
      return N.room ? N.room.lw : 0;
    };
    function emptySession(code) {
      return { code: code || "", rounds: [], wins: {}, best: {}, names: {} };
    }
    N.session = emptySession("");
    function sessionFor(code) {
      if (!N.session || N.session.code !== (code || "")) N.session = emptySession(code);
    }
    function noteResults(d) {
      sessionFor(N.room ? N.room.code : N.session && N.session.code || "");
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
    N.drawEvening = function(ctx, x, y) {
      var S = N.session;
      if (!S || !S.rounds || !S.rounds.length) return y;
      var pids = [];
      for (var k in S.names) pids.push(k);
      if (!pids.length) {
        for (var k2 in S.wins) if (pids.indexOf(k2) < 0) pids.push(k2);
        for (var k3 in S.best) if (pids.indexOf(k3) < 0) pids.push(k3);
      }
      pids.sort(function(a2, b) {
        var wa = S.wins[a2] || 0, wb = S.wins[b] || 0;
        if (wb !== wa) return wb - wa;
        return (S.best[b] || 0) - (S.best[a2] || 0);
      });
      var h = 13 + pids.length * 11;
      box(ctx, x, y, 152, h, C.navy, C.gold);
      drawText(ctx, "\u0421\u0427\u0401\u0422 \u0412\u0415\u0427\u0415\u0420\u0410 \xB7 " + S.rounds.length + " \u0420\u0410\u0423\u041D\u0414", LW / 2, y + 3, C.gold, 1, "center");
      for (var i2 = 0; i2 < pids.length; i2++) {
        var pid = pids[i2], nm = String(S.names[pid] || "\u0418\u0413\u0420\u041E\u041A").slice(0, 8);
        var lineY = y + 13 + i2 * 11;
        drawText(ctx, nm, x + 6, lineY, C.cream, 1, "left");
        drawText(ctx, (S.wins[pid] || 0) + "\u041F  " + (S.best[pid] || 0) + "\u041C", x + 146, lineY, C.cream, 1, "right");
      }
      return y + h + 6;
    };
    function lookOf(k) {
      return makeLook(k, "base", "none");
    }
    function mobId(mo) {
      return mo.kind + ":" + Math.round(mo.baseX) + ":" + Math.round(mo.baseY);
    }
    N.attachWorld = function(w, info) {
      w.net = true;
      w.mode = "squad";
      w.netRound = info.round;
      w.netAt = info.at;
      w.netDead = false;
      var mine = null, others = [];
      for (var i = 0; i < info.players.length; i++) {
        if (info.players[i].pid === N.you) mine = info.players[i];
        else others.push(info.players[i]);
      }
      var me0 = w.players[0];
      if (mine) {
        me0.x = NET_XS[mine.slot % 4];
        me0.name = mine.name;
        me0.pid = mine.pid;
      }
      var hostSim = N.isHost();
      for (var k = 0; k < others.length; k++) {
        var o = others[k];
        var mineBot = !!(o.bot && hostSim);
        var p = newPlayer(k + 1, o.kind, lookOf(o.kind), NET_XS[o.slot % 4], mineBot);
        p.remote = !mineBot;
        p.pid = o.pid;
        p.name = o.name;
        p.react = 1;
        p.bias = 0;
        w.players.push(p);
      }
      N.lastSend = 0;
      N.lastBot = 0;
      N.events = [];
      N.buf = {};
      N.stats.startedAt = now();
    };
    N.waiting = function(w) {
      return !!(w && w.net && w.tick === 0 && serverNow() < w.netAt);
    };
    function flags(p) {
      return (p.abFx > 0 || p.teleFx > 10 ? 1 : 0) | (p.squash > 3 ? 2 : 0) | (p.domeT > 0 ? 4 : 0) | (p.shieldT > 0 ? 8 : 0) | (p.rocketT > 0 ? 16 : 0) | (p.wall ? 32 : 0) | (p.dashT > 0 ? 64 : 0) | (p.poundT > 0 ? 128 : 0) | (p.hookN > 0 ? 256 : 0) | (p.freezeT > 0 ? 512 : 0) | (p.magnetT > 0 ? 1024 : 0) | (p.wall < 0 ? 2048 : 0) | (p.shieldT > 0 && p.shieldT <= SHIELD_BLINK_T ? 4096 : 0) | /* v0.59: ninja wall ability on (8192) and its last-1.2 s blink (16384); old clients ignore both */
      (p.wallT > 0 ? 8192 : 0) | (p.wallT > 0 && p.wallT <= WALL_BLINK_T ? 16384 : 0);
    }
    function applyFlags(p, ps) {
      p.abFx = ps & 1 ? 5 : 0;
      p.squash = ps & 2 ? 4 : 0;
      p.domeT = ps & 4 ? 100 : 0;
      p.shieldT = ps & 8 ? ps & 4096 ? 40 : 120 : 0;
      p.rocketT = ps & 16 ? 10 : 0;
      p.wall = ps & 32 ? ps & 2048 ? -1 : 1 : 0;
      p.wallT = ps & 8192 ? ps & 16384 ? 30 : 120 : p.wall ? 10 : 0;
      p.dashT = ps & 64 ? 5 : 0;
      p.poundT = ps & 128 ? 5 : 0;
      p.hookN = 0;
      p.freezeT = ps & 512 ? 5 : 0;
      p.magnetT = ps & 1024 ? 100 : 0;
    }
    function lerpX(a2, b, t) {
      var d = b - a2;
      if (d > LW / 2) d -= LW;
      if (d < -LW / 2) d += LW;
      var x = a2 + d * t;
      if (x < -PW) x += LW;
      if (x > LW) x -= LW;
      return x;
    }
    function interp(p, b, rt) {
      if (!b || !b.length) return;
      var s0 = b[0], s1 = null;
      for (var i = 0; i < b.length; i++) {
        if (b[i].t <= rt) s0 = b[i];
        else {
          s1 = b[i];
          break;
        }
      }
      var x, y, vx = s0.vx, vy = s0.vy;
      if (s1 && s1.t > s0.t && s0.t <= rt) {
        var u = (rt - s0.t) / (s1.t - s0.t);
        x = lerpX(s0.x, s1.x, u);
        y = s0.y + (s1.y - s0.y) * u;
        vx = s0.vx + (s1.vx - s0.vx) * u;
        vy = s0.vy + (s1.vy - s0.vy) * u;
      } else if (!s1) {
        var dt = Math.min(0.1, Math.max(0, (rt - s0.t) / 1e3)) * 50;
        x = lerpX(s0.x, s0.x + s0.vx * dt, 1);
        y = s0.y + s0.vy * dt;
      } else {
        x = s0.x;
        y = s0.y;
      }
      var last = b[b.length - 1];
      p.x = x;
      p.y = y;
      p.vx = vx;
      p.vy = vy;
      p.face = s0.f;
      p.maxH = Math.max(p.maxH, last.m);
      if (p.alive && !last.a) p.alive = false;
      applyFlags(p, s0.ps);
      var cy = p.y - LH * 0.42;
      if (cy < p.camY) p.camY = cy;
    }
    N.frame = function(w) {
      if (!w || !w.net) return;
      var t = now(), me0 = w.players[0];
      if (t - N.pingT > 2e3) ping();
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
        var rows = [];
        for (var bpi = 0; bpi < w.players.length; bpi++) {
          var bp2 = w.players[bpi];
          if (!bp2.isBot || bp2.remote) continue;
          rows.push({ b: bp2.pid, x: Math.round(bp2.x * 10) / 10, y: Math.round(bp2.y * 10) / 10, vx: Math.round(bp2.vx * 100) / 100, vy: Math.round(bp2.vy * 100) / 100, f: bp2.face, a: bp2.alive ? 1 : 0, m: Math.round(bp2.maxH), ps: flags(bp2) });
          if (!bp2.alive && !bp2.netDead) {
            bp2.netDead = true;
            send("ev", { e: "dead", b: bp2.pid, m: metersOf(bp2), why: bp2.why || "fall" });
          }
        }
        if (rows.length) send("sb", { s: rows });
      }
      for (var bi = 0; bi < w.platforms.length; bi++) {
        var bp = w.platforms[bi];
        if (bp.netTell) {
          bp.netTell = 0;
          send("ev", { e: "brk", id: bp.seq });
        }
      }
      for (var k = 0; k < w.monsters.length; k++) {
        var mo = w.monsters[k];
        if (!mo.alive && !mo.netSent) {
          mo.netSent = true;
          if (!mo.netRemote) send("ev", { e: "mob", id: mobId(mo) });
        }
      }
      var rt = serverNow() - NET_DELAY_MS;
      for (var i = 1; i < w.players.length; i++) {
        var p = w.players[i];
        if (p.remote) interp(p, N.buf[p.pid], rt);
      }
      while (N.events.length) {
        var e = N.events.shift(), rp = byPid(w, e.pid);
        if (e.e === "mob") {
          for (var j = 0; j < w.monsters.length; j++) {
            var m2 = w.monsters[j];
            if (m2.alive && mobId(m2) === e.id) {
              m2.alive = false;
              m2.squish = 10;
              m2.netRemote = true;
              m2.netSent = true;
              spawnParts(w, m2.x + m2.w / 2, m2.y + 4, 10, "#ffd070", 2.4, 0.15);
            }
          }
        } else if (e.e === "dead" && rp) {
          if (rp.alive) {
            rp.alive = false;
            rp.why = e.why || "fall";
            spawnParts(w, rp.x + 6, rp.y + 8, 10, rp.look.hood, 2.6, 0.1);
          }
          rp.maxH = Math.max(rp.maxH, (e.m || 0) * PX_PER_M);
          toast(w, rp.name + " \u0412\u042B\u0411\u042B\u041B");
        } else if (e.e === "left" && rp) {
          rp.alive = false;
          rp.why = "left";
        } else if (e.e === "brk" || e.e === "rst") applyPlatNet(w, e.id, e.e);
      }
      if (!me0.alive) {
        var best = null;
        for (var q = 1; q < w.players.length; q++) {
          var o = w.players[q];
          if (o.alive && (!best || o.maxH > best.maxH)) best = o;
        }
        if (best) {
          w.specCam = w.specCam == null ? w.cameraY : w.specCam + (best.camY - w.specCam) * 0.15;
          w.cameraY = w.specCam;
          generateUntil(w, w.cameraY - 80);
        }
      }
      if (N.results && N.results.round === w.netRound && w.phase === "play") {
        var R = N.results.ranking;
        for (var r = 0; r < R.length; r++) {
          var pp = byPid(w, R[r].pid);
          if (pp) pp.maxH = Math.max(pp.maxH, R[r].m * PX_PER_M);
        }
        finish(w);
        for (var r2 = 0; r2 < R.length; r2++) {
          var p3 = byPid(w, R[r2].pid);
          if (p3) p3.place = R[r2].place;
        }
      }
    };
    function applyPlatNet(w, id, kind) {
      var idn = id | 0;
      if (idn < 0) return;
      var pl = null;
      for (var i = 0; i < w.platforms.length; i++) if (w.platforms[i].seq === idn) {
        pl = w.platforms[i];
        break;
      }
      if (!pl) {
        if (!w.netBreaks) w.netBreaks = {};
        w.netBreaks[idn] = kind === "rst" ? "rst" : "brk";
        return;
      }
      if (pl.type !== "break") return;
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
    function byPid(w, pid) {
      if (pid === N.you) return w.players[0];
      for (var i = 1; i < w.players.length; i++) if (w.players[i].pid === pid) return w.players[i];
      return null;
    }
    N.overlay = function(api, w) {
      var ctx = api.ctx;
      if (w.tick === 0 && w.netAt) {
        var left = Math.max(0, w.netAt - serverNow());
        var n = Math.ceil(left / 500);
        box(ctx, LW / 2 - 30, LH / 2 - 24, 60, 40, C.navy, C.gold);
        drawText(ctx, n > 0 ? String(n) : "\u0412\u041F\u0415\u0420\u0401\u0414", LW / 2, LH / 2 - 14, C.gold, n > 0 ? 3 : 1, "center");
      }
      if (N.st === "reconnecting") {
        box(ctx, LW / 2 - 60, 24, 120, 13, "#4a1020", C.red);
        drawText(ctx, "\u041F\u0415\u0420\u0415\u041F\u041E\u0414\u041A\u041B\u042E\u0427\u0410\u0415\u041C\u0421\u042F...", LW / 2, 27, C.cream, 1, "center");
      } else if (!w.players[0].alive && w.phase === "play") {
        box(ctx, LW / 2 - 64, 24, 128, 13, C.navy, C.cream);
        drawText(ctx, "\u0416\u0414\u0401\u041C \u041E\u0421\u0422\u0410\u041B\u042C\u041D\u042B\u0425", LW / 2, 27, C.cream, 1, "center");
      }
    };
    N.open = function(api) {
      N.api = api;
      N.err = "";
      if (N.st === "update") N.st = N.ws ? "online" : "off";
      if (N.room) {
        N.sub = "room";
        return;
      }
      N.sub = "home";
      N.connect(function(ok) {
        if (!ok) N.sub = "home";
      });
    };
    N.bind = function(api) {
      N.api = api;
    };
    function statusLine() {
      if (N.st === "online") return { t: "\u0421\u0415\u0420\u0412\u0415\u0420 \u041D\u0410 \u0421\u0412\u042F\u0417\u0418", c: C.mint };
      if (N.st === "connecting") return { t: "\u041F\u041E\u0414\u041A\u041B\u042E\u0427\u0410\u0415\u041C\u0421\u042F...", c: C.gold };
      if (N.st === "reconnecting") return { t: "\u041F\u0415\u0420\u0415\u041F\u041E\u0414\u041A\u041B\u042E\u0427\u0410\u0415\u041C\u0421\u042F...", c: C.gold };
      if (N.st === "unsupported") return { t: N.err || "\u041C\u0423\u041B\u042C\u0422\u0418\u041F\u041B\u0415\u0415\u0420 \u041D\u0415\u0414\u041E\u0421\u0422\u0423\u041F\u0415\u041D \u0412 \u042D\u0422\u041E\u0419 \u0412\u0415\u0420\u0421\u0418\u0418", c: C.red, two: true };
      return { t: N.err || "\u041D\u0415\u0422 \u0421\u0412\u042F\u0417\u0418", c: C.red };
    }
    N.draw = function(api) {
      N.api = api;
      var ctx = api.ctx, x = api.colX(), sl = statusLine();
      api.bg();
      if (N.sub === "update" || N.st === "update") return drawUpdate(api, x);
      if (N.sub === "room" && N.room) return drawRoom(api, x);
      if (N.sub === "code") return drawCode(api, x);
      var hd = api.header("\u041C\u0423\u041B\u042C\u0422\u0418\u041F\u041B\u0415\u0415\u0420", 1);
      var subY = hd.bottom + 4;
      drawText(ctx, "\u0414\u041E 4 \u0418\u0413\u0420\u041E\u041A\u041E\u0412 \u041D\u0410 \u041E\u0414\u041D\u041E\u0419 \u041A\u0410\u0420\u0422\u0415", LW / 2, subY, C.cream, 1, "center");
      if (sl.two) {
        box(ctx, x, subY + 14, 152, 24, C.navy, sl.c);
        if (api.markBox) api.markBox("status", x, subY + 14, 152, 24);
        drawText(ctx, "\u041C\u0423\u041B\u042C\u0422\u0418\u041F\u041B\u0415\u0415\u0420 \u041D\u0415\u0414\u041E\u0421\u0422\u0423\u041F\u0415\u041D", LW / 2, subY + 17, sl.c, 1, "center");
        drawText(ctx, "\u0412 \u042D\u0422\u041E\u0419 \u0412\u0415\u0420\u0421\u0418\u0418", LW / 2, subY + 27, sl.c, 1, "center");
      } else {
        box(ctx, x, subY + 14, 152, 13, C.navy, sl.c);
        if (api.markBox) api.markBox("status", x, subY + 14, 152, 13);
        drawText(ctx, sl.t, LW / 2, subY + 17, sl.c, 1, "center");
      }
      var y = subY + (sl.two ? 48 : 38);
      api.btn("net:name", x, y, 152, 20, "#1a1430", "\u0418\u041C\u042F: " + (cleanNick(nick()) || CHARS[api.save().char].name.toUpperCase()), C.cream, 1, C.gold);
      y += 28;
      var ok = N.st === "online";
      api.btn("net:create", x, y, 152, 30, ok ? C.mint : "#3a3450", "\u0421\u041E\u0417\u0414\u0410\u0422\u042C \u041A\u041E\u041C\u041D\u0410\u0422\u0423", INK, 1);
      api.btn("net:enter", x, y + 36, 152, 30, ok ? C.gold : "#3a3450", "\u0412\u041E\u0419\u0422\u0418 \u041F\u041E \u041A\u041E\u0414\u0423", INK, 1);
      if (!ok && N.st !== "connecting") api.btn("net:retry", x + 26, y + 72, 100, 20, C.navy, "\u0415\u0429\u0401 \u0420\u0410\u0417");
      api.btn("net:back", x + 26, LH - 34, 100, 22, C.navy, "\u041D\u0410\u0417\u0410\u0414");
    };
    function drawUpdate(api, x) {
      var ctx = api.ctx;
      api.header("\u041C\u0423\u041B\u042C\u0422\u0418\u041F\u041B\u0415\u0415\u0420", 1);
      box(ctx, x, Math.round(LH / 2 - 40), 152, 64, C.navy, C.gold);
      drawText(ctx, "\u041E\u0411\u041D\u041E\u0412\u0418", LW / 2, Math.round(LH / 2 - 28), C.gold, 2, "center");
      drawText(ctx, "\u0421\u0422\u0420\u0410\u041D\u0418\u0426\u0423", LW / 2, Math.round(LH / 2 - 10), C.gold, 2, "center");
      api.btn("net:back", x + 26, LH - 34, 100, 22, C.navy, "\u041D\u0410\u0417\u0410\u0414");
    }
    function drawCode(api, x) {
      var ctx = api.ctx;
      var hdCode = api.header("\u041A\u041E\u0414 \u041A\u041E\u041C\u041D\u0410\u0422\u042B", 1);
      var codeY = hdCode.bottom + 4;
      for (var i = 0; i < 4; i++) {
        box(ctx, x + 14 + i * 32, codeY, 26, 30, C.navy, i === N.code.length ? C.gold : C.cream);
        if (api.markBox) api.markBox("digit" + i, x + 14 + i * 32, codeY, 26, 30);
        if (N.code[i]) drawText(ctx, N.code[i], x + 27 + i * 32, codeY + 8, C.cream, 2, "center");
      }
      var ky = codeY + 40, keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "<", "0", "OK"];
      for (var k = 0; k < 12; k++) {
        var cx = x + k % 3 * 52, cy = ky + Math.floor(k / 3) * 34;
        var id = keys[k] === "<" ? "net:del" : keys[k] === "OK" ? "net:ok" : "net:k" + keys[k];
        api.btn(id, cx, cy, 48, 30, keys[k] === "OK" ? N.code.length === 4 ? C.mint : "#3a3450" : "#1a1430", keys[k] === "OK" ? "\u0412\u041E\u0419\u0422\u0418" : keys[k], keys[k] === "OK" ? INK : C.cream, keys[k] === "OK" ? 1 : 2);
      }
      if (N.err) drawText(ctx, cleanText(N.err, 24), LW / 2, ky + 140, C.red, 1, "center");
      api.btn("net:home", x + 26, LH - 34, 100, 22, C.navy, "\u041D\u0410\u0417\u0410\u0414");
    }
    function drawRoom(api, x) {
      var ctx = api.ctx, R = N.room, host = N.isHost(), mine = N.mePlayer();
      var y0 = api.belowBand ? api.belowBand() : 20;
      box(ctx, x, y0, 152, 34, C.navy, C.gold);
      if (api.markBox) api.markBox("room", x, y0, 152, 34);
      drawText(ctx, "\u041A\u041E\u041C\u041D\u0410\u0422\u0410", LW / 2, y0 + 4, C.cream, 1, "center");
      drawText(ctx, R.code, LW / 2, y0 + 14, C.gold, 2, "center");
      drawText(ctx, "\u0421\u041A\u0410\u0416\u0418 \u041A\u041E\u0414 \u0414\u0420\u0423\u0417\u042C\u042F\u041C", LW / 2, y0 + 38, "#9a8ab8", 1, "center");
      var sorted = R.players.slice().sort(function(a2, b) {
        return a2.slot - b.slot;
      });
      var row0 = y0 + 50;
      for (var i = 0; i < 4; i++) {
        var y = row0 + i * 26, p = sorted[i];
        if (!p) {
          if (host) api.btn("net:addbot", x, y, 152, 23, "#1a1430", "\u0411\u041E\u0422 +", C.cream);
          else {
            box(ctx, x, y, 152, 23, "#141030", "#3a3450");
            drawText(ctx, "\u0421\u0412\u041E\u0411\u041E\u0414\u041D\u041E", LW / 2, y + 8, "#5a4c82", 1, "center");
          }
          continue;
        }
        var isMe = p.pid === N.you;
        box(ctx, x, y, 152, 23, isMe ? "#2a2050" : C.navy, isMe ? C.gold : C.cream);
        drawJumper(ctx, x + 6, y + 5, lookOf(p.kind), 1, "idle", (api.ui() + i * 50) % 170 < 6, true, 1);
        drawText(ctx, cleanNick(p.name) || "\u0418\u0413\u0420\u041E\u041A", x + 28, y + 3, C.cream, 1, "left");
        var tag = p.bot ? "\u0411\u041E\u0422" : !p.on ? NET_TAGS.off : p.pid === R.host ? NET_TAGS.host : p.ready ? NET_TAGS.ready : NET_TAGS.wait;
        var tc = p.bot ? C.mint : !p.on ? C.red : p.pid === R.host ? C.gold : p.ready ? C.mint : "#9a8ab8";
        drawText(ctx, tag + (isMe ? " \xB7 \u0422\u042B" : ""), x + 28, y + 13, tc, 1, "left");
        if (host && !isMe) api.btn("net:kick" + p.pid, x + 128, y + 4, 18, 15, "#1a1430", "X", C.cream);
        else drawText(ctx, CHARS[p.kind].abName, x + 148, y + 8, "#9a8ab8", 1, "right");
      }
      var my = row0 + 4 * 26 + 4;
      if (host) {
        api.btn("net:mprev", x, my, 20, 18, "#1a1430", "<", C.cream);
        api.btn("net:mnext", x + 132, my, 20, 18, "#1a1430", ">", C.cream);
      }
      box(ctx, x + 22, my, 108, 18, C.navy, C.cream);
      drawText(ctx, "\u041A\u0410\u0420\u0422\u0410: " + mapInfo(R.map).name, LW / 2, my + 6, C.gold, 1, "center");
      api.btn("net:hero", x, my + 22, 152, 18, "#1a1430", "\u0413\u0415\u0420\u041E\u0419: " + CHARS[api.save().char].name.toUpperCase() + " \u25B6", C.cream, 1, C.gold);
      var evY = my + 44;
      if (N.session && N.session.rounds && N.session.rounds.length) evY = N.drawEvening(ctx, x, evY);
      var by = Math.max(evY + 4, LH - 66);
      if (host) {
        var others = R.players.filter(function(q) {
          return q.pid !== R.host && q.on && !q.bot;
        });
        var allReady = others.every(function(q) {
          return q.ready;
        });
        var lab = R.players.length < 2 ? "\u041D\u0410\u0427\u0410\u0422\u042C \u041E\u0414\u041D\u041E\u041C\u0423" : allReady ? "\u041D\u0410\u0427\u0410\u0422\u042C" : "\u0416\u0414\u0401\u041C \u0413\u041E\u0422\u041E\u0412\u041D\u041E\u0421\u0422\u0418";
        api.btn("net:start", x, by, 152, 26, allReady ? C.mint : "#3a3450", lab, INK, 1);
      } else {
        var rd = mine && mine.ready;
        api.btn("net:ready", x, by, 152, 26, rd ? C.mint : C.gold, rd ? "\u0413\u041E\u0422\u041E\u0412 \u2713" : "\u042F \u0413\u041E\u0422\u041E\u0412", INK, 1);
      }
      if (N.st === "reconnecting") drawText(ctx, "\u041F\u0415\u0420\u0415\u041F\u041E\u0414\u041A\u041B\u042E\u0427\u0410\u0415\u041C\u0421\u042F...", LW / 2, by - 10, C.gold, 1, "center");
      api.btn("net:leave", x + 26, LH - 34, 100, 22, C.navy, "\u0412\u042B\u0419\u0422\u0418");
    }
    N.tap = function(id, api) {
      N.api = api;
      if (id === "net:menu") {
        api.setPhase("net");
        N.open(api);
        return;
      }
      if (id === "net:back") {
        api.goMenu();
        return;
      }
      if (id === "net:retry") {
        N.err = "";
        N.connect();
        return;
      }
      if (id === "net:addbot") {
        send("bot", {});
        return;
      }
      if (id.indexOf("net:kick") === 0) {
        send("kick", { pid: parseInt(id.slice(8), 10) });
        return;
      }
      if (id === "net:name") {
        var cur = cleanNick(nick());
        var v = typeof window !== "undefined" && window.prompt ? window.prompt("\u0418\u043C\u044F \u0434\u043B\u044F \u0434\u0440\u0443\u0437\u0435\u0439 (\u043F\u043E-\u0440\u0443\u0441\u0441\u043A\u0438, \u0434\u043E 10 \u0431\u0443\u043A\u0432)", cur) : null;
        if (v != null) {
          var c = cleanNick(v);
          try {
            localStorage.setItem("hoppak.nick", c);
          } catch (_e) {
          }
          if (!c && v) api.say("\u0422\u041E\u041B\u042C\u041A\u041E \u0420\u0423\u0421\u0421\u041A\u0418\u0415 \u0411\u0423\u041A\u0412\u042B");
        }
        return;
      }
      if (id === "net:create") {
        if (N.st !== "online") {
          N.connect();
          return;
        }
        N.create();
        return;
      }
      if (id === "net:enter") {
        if (N.st !== "online") {
          N.connect();
          return;
        }
        N.code = "";
        N.err = "";
        N.sub = "code";
        return;
      }
      if (id === "net:home") {
        N.sub = "home";
        N.err = "";
        return;
      }
      if (id.indexOf("net:k") === 0) {
        if (N.code.length < 4) N.code += id.slice(5);
        N.err = "";
        return;
      }
      if (id === "net:del") {
        N.code = N.code.slice(0, -1);
        return;
      }
      if (id === "net:ok") {
        if (N.code.length === 4) N.join(N.code);
        return;
      }
      if (id === "net:ready") {
        var m = N.mePlayer();
        send("ready", { ready: !(m && m.ready) });
        return;
      }
      if (id === "net:start") {
        send("start", {});
        return;
      }
      if (id === "net:mprev" || id === "net:mnext") {
        var om = api.openMaps(), li = Math.max(0, om.indexOf(N.room.map));
        if (om.indexOf(N.room.map) < 0) om = om.concat([N.room.map]);
        send("map", { map: om[mod(li + (id === "net:mnext" ? 1 : -1), om.length)] });
        return;
      }
      if (id === "net:hero") {
        var s = api.save(), k = s.char;
        for (var n = 1; n <= CHARS.length; n++) {
          var kk = mod(s.char + n, CHARS.length);
          if (api.heroOwned(kk)) {
            k = kk;
            break;
          }
        }
        s.char = k;
        api.saveNow();
        send("hero", { kind: k });
        return;
      }
      if (id === "net:leave") {
        N.leave();
        N.sub = "home";
        return;
      }
      if (id === "net:rematch") {
        api.setPhase("net");
        N.sub = N.room ? "room" : "home";
        return;
      }
    };
    N.tryResume = function(api) {
      N.api = api;
      if (!load("hoppak.net.token")) return;
      N.st = "reconnecting";
      N.reconUntil = now() + NET_GRACE_MS;
      N.connect();
    };
    return N;
  }();
  var PROFILE = function() {
    var TOKEN_KEY = "hoppak_guest_token";
    var QUEUE_KEY = "hoppak_profile_queue";
    var BUYS_KEY = "hoppak_profile_buys";
    var CACHE_KEY = "hoppak_profile_cache";
    var REQ_MS = 5e3;
    var RUN_HEIGHT_MAX = 2e4;
    var RUN_COINS_MAX = 15801;
    var RUN_BONUS_MAX = 2500;
    var HEIGHT_AWARD_MIN = 100;
    var P = {
      st: "idle",
      /* idle | syncing | ready | offline | unavailable */
      profile: null,
      api: null,
      queue: null,
      buySupported: null,
      /* null = unknown | true | false (404 on 2284797) */
      backoffMs: 5e3,
      retryTimer: 0,
      onlineBound: false,
      tgTried: false
    };
    function lsGet(k) {
      try {
        return typeof localStorage !== "undefined" && localStorage.getItem(k) || "";
      } catch (_e) {
        return "";
      }
    }
    function lsSet(k, v) {
      try {
        if (typeof localStorage === "undefined") return;
        if (v) localStorage.setItem(k, v);
        else localStorage.removeItem(k);
      } catch (_e) {
      }
    }
    function readJson(k, def) {
      try {
        var raw = lsGet(k);
        if (!raw) return def;
        var parsed = JSON.parse(raw);
        return parsed == null ? def : parsed;
      } catch (_e) {
        return def;
      }
    }
    function writeJson(k, val) {
      try {
        lsSet(k, JSON.stringify(val));
      } catch (_e) {
      }
    }
    function getToken() {
      return lsGet(TOKEN_KEY);
    }
    function setToken(t) {
      lsSet(TOKEN_KEY, t);
    }
    function getRunQueue() {
      var q = readJson(QUEUE_KEY, []);
      return Array.isArray(q) ? q : [];
    }
    function setRunQueue(q) {
      if (q.length > 50) q = q.slice(q.length - 50);
      writeJson(QUEUE_KEY, q);
    }
    function getPendingBuys() {
      var b = readJson(BUYS_KEY, []);
      return Array.isArray(b) ? b : [];
    }
    function setPendingBuys(b) {
      writeJson(BUYS_KEY, b);
    }
    function pruneConfirmedBuys(prof) {
      var owned = prof && prof.purchases || {};
      var buys = getPendingBuys();
      var next = [];
      var seen = {};
      for (var i = 0; i < buys.length; i++) {
        var it = buys[i];
        if (!it || !it.key || seen[it.key] || owned[it.key]) continue;
        seen[it.key] = 1;
        next.push(it);
      }
      if (next.length !== buys.length) setPendingBuys(next);
      return next;
    }
    function pendingSpend() {
      var buys = getPendingBuys();
      var tot = 0;
      for (var i = 0; i < buys.length; i++) {
        tot += Math.max(0, Math.floor(Number(buys[i] && buys[i].price) || 0));
      }
      return tot;
    }
    function queuedEst() {
      var q = getRunQueue();
      var tot = 0;
      for (var i = 0; i < q.length; i++) {
        tot += Math.max(0, Math.floor(Number(q[i] && q[i].estAward) || 0));
      }
      return tot;
    }
    function computeAward(height, runCoins, bonusCoins) {
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
      return { want: awarded, awarded, limited };
    }
    function pendingBuyKeys() {
      var out = {};
      var buys = getPendingBuys();
      for (var i = 0; i < buys.length; i++) if (buys[i] && buys[i].key) out[buys[i].key] = 1;
      return out;
    }
    function readInitData() {
      try {
        var w = typeof window !== "undefined" ? window : null;
        var d = w && w.Telegram && w.Telegram.WebApp && w.Telegram.WebApp.initData;
        if (typeof d === "string" && d) return d;
      } catch (_e) {
      }
      return "";
    }
    function waitTelegramSdk() {
      try {
        var w = typeof window !== "undefined" ? window : null;
        if (w && w.__tgReady && typeof w.__tgReady.then === "function") return w.__tgReady;
      } catch (_e) {
      }
      return Promise.resolve(null);
    }
    function tryTelegramAuth(token) {
      if (P.tgPending) return P.tgPending;
      if (P.tgTried) return Promise.resolve(null);
      var run = function() {
        return tryTelegramAuthNow(token);
      };
      P.tgPending = waitTelegramSdk().then(run, run).then(function(r) {
        P.tgPending = null;
        return r;
      }, function(e) {
        P.tgPending = null;
        throw e;
      });
      return P.tgPending;
    }
    function tryTelegramAuthNow(token) {
      if (P.tgTried) return Promise.resolve(null);
      var initData = readInitData();
      if (!initData || !token) return Promise.resolve(null);
      P.tgTried = true;
      return req("POST", "/api/auth/telegram", { initData }, token).then(function(res) {
        if (!res || !res.ok || !res.data || !res.data.ok || !res.data.profile) return null;
        if (res.data.token) setToken(res.data.token);
        P.st = "ready";
        applyProfile(res.data.profile);
        if (res.data.merged && P.api && P.api.say) P.api.say("\u041F\u0420\u041E\u0413\u0420\u0415\u0421\u0421 \u041E\u0411\u042A\u0415\u0414\u0418\u041D\u0401\u041D");
        return res.data;
      });
    }
    function makeRunId() {
      var r = "";
      try {
        if (typeof crypto !== "undefined" && crypto.getRandomValues) {
          var u = new Uint32Array(2);
          crypto.getRandomValues(u);
          r = u[0].toString(36) + u[1].toString(36);
        }
      } catch (_e) {
      }
      if (!r) r = Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6);
      return "r_" + Date.now().toString(36) + "_" + r;
    }
    function normalizeOrigin(raw) {
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
    function apiOrigin() {
      var w = typeof window !== "undefined" ? window : null;
      if (!w) return "";
      try {
        var sp = new URLSearchParams(w.location.search);
        var qa = sp.get("api") || sp.get("profileApi");
        if (qa) {
          var qan = normalizeOrigin(qa);
          if (qan) return qan;
        }
        if (w.HOPPAK_API) {
          var wan = normalizeOrigin(w.HOPPAK_API);
          if (wan) return wan;
        }
        var lsa = w.localStorage && w.localStorage.getItem("hoppak.api");
        if (lsa) {
          var lsan = normalizeOrigin(lsa);
          if (lsan) return lsan;
        }
      } catch (_e) {
      }
      try {
        if (typeof HOP_API !== "undefined" && HOP_API) {
          var ban = normalizeOrigin(String(HOP_API));
          if (ban) return ban;
        }
      } catch (_e1) {
      }
      var isPage = false;
      try {
        isPage = typeof HOP_PAGE !== "undefined" && !!HOP_PAGE;
      } catch (_e2) {
      }
      if (!isPage) {
        try {
          var pr = w.location && w.location.protocol;
          if (pr === "http:" || pr === "https:") return w.location.origin;
        } catch (_e3) {
        }
      }
      try {
        var qs = new URLSearchParams(w.location.search).get("server");
        if (qs) {
          var qn = normalizeOrigin(qs);
          if (qn) return qn;
        }
        if (w.HOPPAK_SERVER) {
          var wn = normalizeOrigin(w.HOPPAK_SERVER);
          if (wn) return wn;
        }
        var ls = w.localStorage && w.localStorage.getItem("hoppak.server");
        if (ls) {
          var ln = normalizeOrigin(ls);
          if (ln) return ln;
        }
        if (isPage && typeof HOP_SERVER !== "undefined" && HOP_SERVER) {
          var bn = normalizeOrigin(String(HOP_SERVER));
          if (bn) return bn;
        }
      } catch (_e4) {
      }
      return "";
    }
    function req(method, path, body, token) {
      var base = apiOrigin();
      if (!base || typeof fetch === "undefined") {
        return Promise.resolve({ status: 0, ok: false, data: null });
      }
      var ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
      var to = setTimeout(function() {
        try {
          if (ctrl) ctrl.abort();
        } catch (_e) {
        }
      }, REQ_MS);
      var headers = {};
      if (token) headers["Authorization"] = "Bearer " + token;
      var sameOrig = false;
      try {
        sameOrig = typeof window !== "undefined" && window.location && window.location.origin === base;
      } catch (_e0) {
      }
      var opts = { method, headers, cache: "no-store", mode: sameOrig ? "same-origin" : "cors" };
      if (body !== void 0) {
        headers["Content-Type"] = "application/json";
        opts.body = JSON.stringify(body);
      }
      if (ctrl) opts.signal = ctrl.signal;
      return fetch(base + path, opts).then(function(r) {
        clearTimeout(to);
        return r.json().catch(function() {
          return null;
        }).then(function(data) {
          return { status: r.status, ok: !!r.ok, data };
        });
      }).catch(function() {
        clearTimeout(to);
        return { status: 0, ok: false, data: null };
      });
    }
    function applyProfile(prof, wRef, awarded, limited) {
      if (!prof) return;
      P.profile = prof;
      writeJson(CACHE_KEY, prof);
      pruneConfirmedBuys(prof);
      var effectiveCoins = Math.max(0, (prof.coins || 0) - pendingSpend()) + queuedEst();
      if (P.api && P.api.apply) P.api.apply(prof, wRef, awarded, effectiveCoins, limited);
    }
    function handleStatus(res) {
      if (res.status === 503 || res.data && res.data.error === "PROFILE_UNAVAILABLE") {
        P.st = "unavailable";
        return false;
      }
      if (!res.ok || !res.data || !res.data.ok) {
        if (res.status === 0 || res.status >= 500) P.st = "offline";
        return false;
      }
      return true;
    }
    function scheduleRetry(delayMs) {
      if (typeof setTimeout === "undefined") return;
      if (P.retryTimer) {
        clearTimeout(P.retryTimer);
        P.retryTimer = 0;
      }
      var d = Math.max(250, delayMs);
      P.retryTimer = setTimeout(function() {
        P.retryTimer = 0;
        P.flush();
      }, d);
    }
    function localCampaign() {
      var s = P.api && P.api.save ? P.api.save() : null;
      var mapBest = s && s.mapBest && typeof s.mapBest === "object" ? s.mapBest : {};
      var open = {};
      var owned = s && s.owned && typeof s.owned === "object" ? s.owned : {};
      for (var k in owned) if (owned[k] && String(k).indexOf("map:") === 0) open[k] = 1;
      return { mapBest, open };
    }
    function syncCampaign(token, fallback, bodySnap) {
      var body = bodySnap || localCampaign();
      return req("POST", "/api/profile/campaign", body, token).then(function(res) {
        if (!handleStatus(res) || !res.data || !res.data.profile) {
          if (fallback) {
            P.st = "ready";
            applyProfile(fallback);
          }
          return fallback;
        }
        P.st = "ready";
        applyProfile(res.data.profile);
        return res.data.profile;
      });
    }
    function syncMigrate(token, prof, coinSnap) {
      var s = P.api && P.api.save ? P.api.save() : null;
      var rawCoins = typeof coinSnap === "number" ? coinSnap : s && typeof s.coins === "number" ? Math.max(0, Math.floor(s.coins)) : 0;
      var coins = Math.max(0, rawCoins - queuedEst());
      var purchases = s && s.owned && typeof s.owned === "object" ? s.owned : {};
      var best = s && typeof s.best === "number" ? Math.max(0, Math.floor(s.best)) : 0;
      var migrated = !prof || prof.migratedAt;
      var step = migrated ? Promise.resolve(prof) : req("POST", "/api/profile/migrate", { coins, purchases, best }, token).then(function(res) {
        if (!handleStatus(res)) return null;
        return res.data.profile;
      });
      return step.then(function(ready) {
        if (!ready) return null;
        return syncCampaign(token, ready);
      });
    }
    function createGuest() {
      return req("POST", "/api/profile/guest").then(function(res) {
        if (!handleStatus(res)) return null;
        if (res.data.token) setToken(res.data.token);
        return { token: res.data.token || getToken(), profile: res.data.profile };
      });
    }
    function ensureProfile(deferCoins) {
      var base = apiOrigin();
      if (!base || typeof fetch === "undefined") {
        P.st = "offline";
        return Promise.resolve(null);
      }
      P.st = "syncing";
      var tok = getToken();
      var finish2 = function(token, prof) {
        return deferCoins ? Promise.resolve(prof) : syncMigrate(token, prof);
      };
      if (tok) {
        return req("GET", "/api/profile", void 0, tok).then(function(res) {
          if (res.status === 401) {
            setToken("");
            return createGuest().then(function(made) {
              if (!made) return null;
              return finish2(made.token, made.profile);
            });
          }
          if (!handleStatus(res)) return null;
          return finish2(tok, res.data.profile);
        });
      }
      return createGuest().then(function(made) {
        if (!made) return null;
        return finish2(made.token, made.profile);
      });
    }
    function syncRecords(tok) {
      if (!tok) return Promise.resolve();
      return req("POST", "/api/profile/campaign", localCampaign(), tok).then(function(res) {
        if (res.status === 404 || res.status === 405 || res.status === 501) return;
        if (!handleStatus(res) || !res.data || !res.data.profile) return;
        applyProfile(res.data.profile);
      }, function() {
        return;
      });
    }
    function flushBuysOnce(tok) {
      if (P.buySupported === false) return Promise.resolve();
      var buys = getPendingBuys();
      if (!buys.length || !tok) return Promise.resolve();
      var item = buys[0];
      return req("POST", "/api/profile/buy", { key: item.key }, tok).then(function(res) {
        if (res.status === 404 || res.status === 405 || res.status === 501) {
          P.buySupported = false;
          return;
        }
        if (res.status === 401) {
          setToken("");
          return;
        }
        if (res.status === 400) {
          var cur = getPendingBuys().filter(function(x) {
            return x && x.key !== item.key;
          });
          setPendingBuys(cur);
          if (P.profile) applyProfile(P.profile);
          return flushBuysOnce(tok);
        }
        if (!handleStatus(res)) return;
        P.buySupported = true;
        P.st = "ready";
        var rest = getPendingBuys().filter(function(x) {
          return x && x.key !== item.key;
        });
        setPendingBuys(rest);
        applyProfile(res.data.profile);
        if (rest.length) return flushBuysOnce(tok);
      });
    }
    var runRefs = {};
    function worldOf(head) {
      if (!head) return null;
      return head._wRef || runRefs[head.runId] || null;
    }
    function markRun(head, code) {
      var w = worldOf(head);
      if (w) w.limited = code;
    }
    function markQueued(code) {
      var q = getRunQueue();
      for (var i = 0; i < q.length; i++) markRun(q[i], code);
    }
    function flushRunsStep(tok, authRetried) {
      var q = getRunQueue();
      if (!q.length) return Promise.resolve(null);
      var head = q[0];
      var body = {
        runId: head.runId,
        height: head.height,
        runCoins: head.runCoins,
        bonusCoins: head.bonusCoins
      };
      if (head.mode) body.mode = head.mode;
      if (head.map) body.map = head.map;
      if (head.ver) body.ver = head.ver;
      return req("POST", "/api/run/finish", body, tok).then(function(res) {
        if (res.status === 401) {
          setToken("");
          if (!authRetried) {
            return ensureProfile().then(function() {
              var nt = getToken();
              return nt ? flushRunsStep(nt, true) : null;
            });
          }
          return null;
        }
        if (res.status === 429 || res.data && res.data.error === "RATE_LIMIT") {
          markRun(head, "FAST");
          scheduleRetry(P.backoffMs);
          return null;
        }
        if (res.status === 400) {
          var dropped = getRunQueue().filter(function(x) {
            return x && x.runId !== head.runId;
          });
          setRunQueue(dropped);
          if (P.profile) applyProfile(P.profile, worldOf(head), 0, "REJECTED");
          else markRun(head, "REJECTED");
          if (head && head.runId) delete runRefs[head.runId];
          return dropped.length ? flushRunsStep(tok, authRetried) : null;
        }
        if (!handleStatus(res)) {
          markRun(head, "OFFLINE");
          var wait = P.backoffMs;
          P.backoffMs = Math.min(6e4, P.backoffMs * 2);
          scheduleRetry(wait);
          return null;
        }
        P.backoffMs = 5e3;
        var curQ = getRunQueue();
        if (curQ.length && curQ[0].runId === head.runId) curQ.shift();
        else curQ = curQ.filter(function(x) {
          return x && x.runId !== head.runId;
        });
        setRunQueue(curQ);
        P.st = "ready";
        var done = worldOf(head);
        if (head && head.runId) delete runRefs[head.runId];
        applyProfile(res.data.profile, done, res.data.awarded, res.data.limited || "");
        if (curQ.length) return flushRunsStep(tok, authRetried);
        return res.data;
      });
    }
    function flushAll(allowInit) {
      var base = apiOrigin();
      if (!base || typeof fetch === "undefined") {
        P.st = "offline";
        return Promise.resolve(null);
      }
      var tok = getToken();
      var ready = tok ? Promise.resolve(tok) : allowInit ? ensureProfile().then(function() {
        return getToken();
      }) : Promise.resolve("");
      return ready.then(function(t) {
        if (!t) {
          if (getRunQueue().length || getPendingBuys().length) {
            markQueued("OFFLINE");
            var wait = P.backoffMs;
            P.backoffMs = Math.min(6e4, P.backoffMs * 2);
            scheduleRetry(wait);
          }
          return null;
        }
        return syncRecords(t).then(function() {
          return flushBuysOnce(t).then(function() {
            return flushRunsStep(t);
          });
        });
      });
    }
    function enqueue(fn) {
      var prev = P.queue || Promise.resolve(null);
      var next = prev.then(function() {
        return fn();
      }, function() {
        return fn();
      });
      P.queue = next;
      return next;
    }
    P.init = function(api) {
      P.api = api;
      if (!P.onlineBound && typeof window !== "undefined" && window.addEventListener) {
        P.onlineBound = true;
        window.addEventListener("online", function() {
          P.backoffMs = 5e3;
          P.flush();
        });
      }
      return enqueue(function() {
        var deferCoins = !!readInitData();
        var coinSnap = 0;
        var campSnap = null;
        try {
          var early = P.api && P.api.save ? P.api.save() : null;
          if (early && typeof early.coins === "number") coinSnap = Math.max(0, Math.floor(early.coins));
          campSnap = localCampaign();
        } catch (_eSnap) {
        }
        return ensureProfile(deferCoins).then(function(prof) {
          if (!prof) {
            var cached = readJson(CACHE_KEY, null);
            if (cached) P.profile = cached;
            if (getRunQueue().length || getPendingBuys().length) {
              scheduleRetry(P.backoffMs);
            }
            return null;
          }
          return flushAll(false).then(function() {
            return tryTelegramAuth(getToken()).then(function(auth) {
              if (auth && auth.merged) return syncCampaign(getToken(), auth.profile || P.profile, campSnap);
              return syncMigrate(getToken(), auth && auth.profile || P.profile || prof, coinSnap);
            });
          });
        });
      });
    };
    P.finishRun = function(height, runCoins, bonusCoins, worldRef, meta) {
      var h = Math.max(0, Math.floor(Number(height) || 0));
      var c = Math.max(0, Math.floor(Number(runCoins) || 0));
      var b = Math.max(0, Math.floor(Number(bonusCoins) || 0));
      var pre = meta && typeof meta.awarded === "number" ? Math.max(0, Math.floor(meta.awarded)) : computeAward(h, c, b).awarded;
      var item = {
        runId: makeRunId(),
        height: h,
        runCoins: c,
        bonusCoins: b,
        mode: meta && meta.mode || "solo",
        map: meta && meta.map || "",
        ver: meta && meta.ver || "0.6",
        estAward: pre,
        createdAt: Date.now()
      };
      var q = getRunQueue();
      q.push(item);
      setRunQueue(q);
      return enqueue(function() {
        if (worldRef) runRefs[item.runId] = worldRef;
        return flushAll(true);
      });
    };
    P.buy = function(key, price) {
      if (!key) return Promise.resolve(null);
      var buys = getPendingBuys();
      var found = false;
      for (var i = 0; i < buys.length; i++) if (buys[i] && buys[i].key === key) {
        found = true;
        break;
      }
      if (!found) {
        buys.push({ key, price: Math.max(0, Math.floor(Number(price) || 0)), at: Date.now() });
        setPendingBuys(buys);
      }
      return enqueue(function() {
        if (P.buySupported === false) return null;
        var base = apiOrigin();
        if (!base || typeof fetch === "undefined") {
          P.st = "offline";
          return null;
        }
        var tok = getToken();
        var ready = tok ? Promise.resolve(tok) : ensureProfile().then(function() {
          return getToken();
        });
        return ready.then(function(t) {
          if (!t) return null;
          return flushBuysOnce(t);
        });
      });
    };
    P.flush = function() {
      return enqueue(function() {
        return flushAll(true);
      });
    };
    P.getToken = getToken;
    P.apiOrigin = apiOrigin;
    P.computeAward = computeAward;
    P.noteAward = function() {
    };
    P.pendingBuyKeys = pendingBuyKeys;
    P.getState = function() {
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
  }();
  function startHoppak(canvas) {
    var raw = canvas.getContext("2d");
    var noop = function() {
    };
    if (!raw) return { destroy: noop };
    var ctx = raw;
    var wrap = canvas.parentElement;
    var phase = "menu";
    var world = null;
    var save = loadSave();
    var mode = "solo";
    var room = { round: 0 };
    var shopHero = save.char;
    var abHintRun = false;
    var abTap = false;
    var lobbyMap = save.bg;
    var flash = "", flashT = 0, flashPh = "";
    var tiltOn = false, tiltDenied = false, tiltAx = 0;
    var tiltAvail = typeof window.DeviceOrientationEvent !== "undefined";
    var autoPlay = false;
    var held = { left: false, right: false, kl: false, kr: false };
    var pointers = {};
    var acc = 0, uiAcc = 0, UI_STEP = 1 / 60, lastT = -1, raf = 0, running = true, driving = false, ui = 0;
    var hits = [];
    var SCALE = 1, pScale = 1, pScaleY = 1, cssScale = 1, isWide = false, isPhone = false, phoneLand = false, lastBackdropMap = "";
    var cinemaOn = false, cinemaBtn = null;
    var fieldLocked = false, landPause = false, manualPause = false, lastFill = false;
    var resumeCd = 0, resumeAt = 0, abDenyT = 0, refuseT = 0, popT = -1, wasReady = false, coinT0 = -1, coinSkip = false;
    var pressId = null;
    var rankY = {};
    var rankHead = {};
    var confirmId = null, confirmAt = 0;
    var campCard = -1;
    var showSet = false;
    var menuLay = null;
    var screenLay = [];
    var resultLay = [];
    var pauseLay = [];
    var showProf = false;
    var photoSlot = { url: "", cv: null, fail: false };
    var tgInsetBound = false;
    var paused = false;
    var netLW = 0;
    var WHERE = ["\u0412 \u0413\u041E\u0420\u041E\u0414\u0415", "\u0412 \u0414\u0416\u0423\u041D\u0413\u041B\u042F\u0425", "\u0412 \u041B\u0415\u0414\u041D\u0418\u041A\u0415", "\u041D\u0410 \u0412\u0423\u041B\u041A\u0410\u041D\u0415", "\u0412 \u041E\u041A\u0415\u0410\u041D\u0415", "\u0412 \u041A\u041E\u0421\u041C\u041E\u0421\u0415"];
    var TO = ["\u0413\u041E\u0420\u041E\u0414\u0410", "\u0414\u0416\u0423\u041D\u0413\u041B\u0415\u0419", "\u041B\u0415\u0414\u041D\u0418\u041A\u0410", "\u0412\u0423\u041B\u041A\u0410\u041D\u0410", "\u041E\u041A\u0415\u0410\u041D\u0410", "\u041A\u041E\u0421\u041C\u041E\u0421\u0410"];
    var HTO = ["\u041A\u0410\u041F\u0418\u0422\u0410\u041D\u0410", "\u041F\u0418\u0420\u0410\u0422\u0410", "\u041D\u0418\u041D\u0414\u0417\u042F", "\u0420\u041E\u0411\u041E\u0422\u0410", "\u041C\u0410\u0413\u0410", "\u0420\u042B\u0426\u0410\u0420\u042F"];
    warmHeroSprites();
    warmBonusSprites();
    function isPageBuild() {
      return typeof HOP_PAGE !== "undefined" && !!HOP_PAGE;
    }
    function netFixedLW() {
      return typeof NET !== "undefined" && NET && typeof NET.fixedLW === "function" ? NET.fixedLW() || 0 : 0;
    }
    function syncBackdrop(mapId) {
      if (!wrap) return;
      if (mapId === lastBackdropMap) return;
      lastBackdropMap = mapId || "";
      var cols = skyAt(mapId, 0);
      wrap.style.background = "linear-gradient(" + cols[0] + " 0%, " + cols[1] + " 50%, " + cols[2] + " 100%)";
    }
    function menuMap() {
      if (world && (phase === "play" || phase === "results")) return world.map || save.bg;
      if (phase === "lobby") return lobbyMap || save.bg;
      if (phase === "net" && typeof NET !== "undefined" && NET && NET.room && NET.room.map) return NET.room.map;
      return save.bg;
    }
    function viewSize() {
      var vv = window.visualViewport;
      if (vv && vv.width > 0 && vv.height > 0) return { w: vv.width, h: vv.height, x: vv.offsetLeft || 0, y: vv.offsetTop || 0 };
      var r = (wrap || canvas).getBoundingClientRect();
      return { w: Math.max(1, r.width), h: Math.max(1, r.height), x: 0, y: 0 };
    }
    function isCoarsePointer() {
      try {
        if (window.matchMedia) {
          if (window.matchMedia("(pointer: coarse)").matches) return true;
          if (window.matchMedia("(any-pointer: coarse)").matches) return true;
        }
      } catch (_e) {
      }
      try {
        if (navigator && (navigator.maxTouchPoints || 0) > 0) return true;
      } catch (_e2) {
      }
      try {
        if ("ontouchstart" in window) return true;
      } catch (_e3) {
      }
      return false;
    }
    function cinemaAllowed() {
      try {
        var tg = window.Telegram && window.Telegram.WebApp;
        if (tg && tg.initData) return false;
      } catch (_e) {
      }
      try {
        if (window.matchMedia && window.matchMedia("(pointer: coarse)").matches) return false;
      } catch (_e2) {
      }
      return true;
    }
    function typingTarget(e) {
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
      g.fillRect(0, 0, 22, 1);
      g.fillRect(0, 21, 22, 1);
      g.fillRect(0, 0, 1, 22);
      g.fillRect(21, 0, 1, 22);
      g.fillStyle = cinemaOn ? "#62e6be" : "#f6ecd0";
      g.fillRect(4, 4, 5, 1);
      g.fillRect(4, 4, 1, 5);
      g.fillRect(13, 4, 5, 1);
      g.fillRect(17, 4, 1, 5);
      g.fillRect(4, 17, 5, 1);
      g.fillRect(4, 13, 1, 5);
      g.fillRect(13, 17, 5, 1);
      g.fillRect(17, 13, 1, 5);
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
        cinemaBtn.setAttribute("aria-label", "\u041A\u0438\u043D\u043E");
        cinemaBtn.style.cssText = "position:fixed;top:8px;right:8px;z-index:40;width:22px;height:22px;padding:0;border:0;background:transparent;cursor:pointer;";
        var c = document.createElement("canvas");
        c.width = 22;
        c.height = 22;
        c.style.cssText = "width:22px;height:22px;image-rendering:pixelated;display:block;";
        cinemaBtn.appendChild(c);
        cinemaBtn.addEventListener("click", function(ev) {
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
        var root = document.documentElement;
        var req = root.requestFullscreen || root.webkitRequestFullscreen;
        if (req) {
          var p = req.call(root);
          if (p && p.catch) p.catch(function() {
          });
        }
      } catch (_e) {
      }
      resize();
    }
    function exitCinema() {
      cinemaOn = false;
      try {
        var doc = document;
        if (doc.fullscreenElement || doc.webkitFullscreenElement) {
          var exit = doc.exitFullscreen || doc.webkitExitFullscreen;
          if (exit) exit.call(doc);
        }
      } catch (_e) {
      }
      resize();
    }
    function toggleCinema() {
      if (cinemaOn) exitCinema();
      else enterCinema();
    }
    function resize() {
      var vs = viewSize();
      var cssW = Math.max(1, vs.w), cssH = Math.max(1, vs.h);
      var dpr = Math.max(1, window.devicePixelRatio || 1);
      isPhone = isCoarsePointer() && Math.min(cssW, cssH) < 540;
      isWide = cssW >= 540 && !isPhone;
      phoneLand = isPhone && cssW > cssH;
      var frameX = isWide ? 24 : 0;
      var frameY = isWide ? cssH >= 740 ? 16 : 4 : 0;
      var availW = Math.max(160, cssW - frameX * 2);
      var availH = Math.max(240, cssH - frameY * 2);
      var lw = netFixedLW() || 160;
      var lh = 346;
      if (fieldLocked) {
        lw = LW;
        lh = LH;
      }
      var sx, sy, cssWpx, cssHpx;
      if (isWide) {
        if (cinemaOn) {
          var maxW = Math.max(160, cssW);
          var maxH = Math.max(240, cssH);
          var intScale = Math.max(1, Math.min(Math.floor(maxW / lw), Math.floor(maxH / lh)));
          cssScale = intScale * lh >= maxH - 1 ? intScale : Math.min(maxW / lw, maxH / lh);
          pScale = cssScale * dpr;
        } else {
          pScale = Math.max(1, Math.min(Math.floor(availW * dpr / lw), Math.floor(availH * dpr / lh)));
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
        var fillWidth = fieldLocked && phase === "play";
        if (fillWidth) {
          cssScale = availW / lw;
          VIEW_PAD = 0;
          VIEW_CROP = 0;
          VIEW_BOT = Math.max(0, lh - availH / cssScale);
          var botMax = viewBotMax(lh);
          if (VIEW_BOT > botMax) {
            VIEW_CROP = Math.min(TOP_CROP_MAX, VIEW_BOT - botMax);
            VIEW_BOT = botMax;
            if (lh - VIEW_CROP - VIEW_BOT > availH / cssScale + 1e-6) {
              cssScale = availH / (lh - VIEW_CROP - VIEW_BOT);
              VIEW_PAD = Math.max(0, (availW / cssScale - lw) / 2);
            }
          }
          cssWpx = (lw + 2 * VIEW_PAD) * cssScale;
          cssHpx = (lh - VIEW_CROP - VIEW_BOT) * cssScale;
        } else {
          cssScale = Math.min(availW / lw, availH / lh);
          VIEW_PAD = Math.max(0, (availW / cssScale - lw) / 2);
          VIEW_CROP = 0;
          VIEW_BOT = 0;
          cssWpx = (lw + 2 * VIEW_PAD) * cssScale;
          cssHpx = lh * cssScale;
        }
        var pxW = Math.max(1, Math.round(cssWpx * dpr));
        var pxH = Math.max(1, Math.round(cssHpx * dpr));
        canvas.width = pxW;
        canvas.height = pxH;
        var worldW = lw + 2 * VIEW_PAD;
        var worldH = lh - VIEW_CROP - VIEW_BOT;
        pScale = pxW / worldW;
        pScaleY = pxH / Math.max(1e-6, worldH);
        sx = pScale;
        sy = pScaleY;
        FIELD_OX = Math.round(VIEW_PAD * sx);
        FIELD_OY = Math.round(-VIEW_CROP * sy);
        PHONE_INT = false;
        DEV_W = pxW;
        DEV_H = pxH;
        canvas.style.position = "absolute";
        canvas.style.left = Math.round(vs.x + (cssW - cssWpx) / 2) + "px";
        canvas.style.top = Math.round(vs.y + (cssH - cssHpx) / (VIEW_BOT > 0 || VIEW_CROP > 0 ? 1 : 2)) + "px";
        canvas.style.boxShadow = "none";
        canvas.style.borderRadius = "0px";
      }
      if (isWide) {
        VIEW_PAD = 0;
        VIEW_CROP = 0;
        VIEW_BOT = 0;
        FIELD_OX = 0;
        FIELD_OY = 0;
        PHONE_INT = false;
        DEV_W = canvas.width;
        DEV_H = canvas.height;
      }
      lastFill = fieldLocked && phase === "play" && !isWide;
      netLW = netFixedLW();
      LW = lw;
      LH = lh;
      SCALE = cssScale;
      canvas.style.width = cssWpx + "px";
      canvas.style.height = cssHpx + "px";
      canvas.style.imageRendering = "pixelated";
      var hintEl = document.getElementById("desk-hint");
      if (hintEl) {
        var deskHasAb = !!(CHARS[save.char] && CHARS[save.char].ab);
        hintEl.textContent = deskHasAb ? "\u2190 \u2192 / A D \u2014 \u0434\u0432\u0438\u0436\u0435\u043D\u0438\u0435 \xB7 \u2191 / \u041F\u0440\u043E\u0431\u0435\u043B \u2014 \u0441\u043F\u043E\u0441\u043E\u0431\u043D\u043E\u0441\u0442\u044C \xB7 F \u2014 \u043A\u0438\u043D\u043E \xB7 Esc \u2014 \u043F\u0430\u0443\u0437\u0430" : "\u2190 \u2192 / A D \u2014 \u0434\u0432\u0438\u0436\u0435\u043D\u0438\u0435 \xB7 F \u2014 \u043A\u0438\u043D\u043E \xB7 Esc \u2014 \u043F\u0430\u0443\u0437\u0430";
        hintEl.style.display = isWide && !cinemaOn && cssH - LH * cssScale >= 34 ? "block" : "none";
      }
      ensureCinemaBtn();
      ctx.setTransform(sx, 0, 0, sy, FIELD_OX, FIELD_OY);
      ctx.imageSmoothingEnabled = false;
      ctx.webkitImageSmoothingEnabled = false;
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
        if (!landPause || resumeCd > 0) {
          paused = true;
          landPause = true;
          resumeCd = 0;
          acc = 0;
          uiAcc = 0;
          lastT = -1;
        }
      } else if (landPause && !phoneLand) {
        landPause = false;
        if (manualPause) {
          paused = true;
          resumeCd = 0;
          acc = 0;
          uiAcc = 0;
          lastT = -1;
        } else startResumeCountdown();
      }
    }
    function startResumeCountdown() {
      landPause = false;
      manualPause = false;
      paused = true;
      resumeCd = 3;
      resumeAt = typeof performance !== "undefined" ? performance.now() : Date.now();
      acc = 0;
      uiAcc = 0;
      lastT = -1;
    }
    function heroHasAb(me) {
      var dbg = window.__dbg;
      if (dbg && dbg.noAb) return false;
      return !!(me && CHARS[me.kind] && CHARS[me.kind].ab);
    }
    function showFirstTimeToast(id, text) {
      if (!save.seen) save.seen = {};
      if (save.seen[id]) return;
      save.seen[id] = 1;
      writeSave(save);
      if (world) {
        toast(world, text || FIRST_TOAST[id] || id);
        world.toastT = 150;
      }
    }
    function requestAbility() {
      audioUnlock();
      if (!world || !world.players || !world.players[0] || !world.players[0].alive) return;
      if (!heroHasAb(world.players[0])) return;
      if (abReady(world.players[0])) {
        abTap = true;
        return;
      }
      if (abDenyT <= 0) {
        abDenyT = 18;
        hopSfx("deny");
      }
    }
    function toLogic(cx, cy) {
      var r = canvas.getBoundingClientRect();
      var rw = r.width || 1, rh = r.height || 1;
      var x = ((cx - r.left) / rw * canvas.width - FIELD_OX) / pScale;
      var y = ((cy - r.top) / rh * canvas.height - FIELD_OY) / pScaleY;
      if (phase === "play" && cy >= r.top && cy <= r.bottom && (cx < r.left || cx > r.right)) {
        x = cx < r.left ? 0 : LW;
        y = Math.max(0, Math.min(LH, y));
      }
      return { x, y };
    }
    function colX() {
      return Math.round((LW - 152) / 2);
    }
    function lookNow() {
      return makeLook(save.char, save.color, save.hat);
    }
    function mapIdx(id) {
      for (var i = 0; i < MAPS.length; i++) if (MAPS[i].id === id) return i;
      return 0;
    }
    function mapOpen(i) {
      return i === 0 || !!save.owned["map:" + MAPS[i].id];
    }
    function mapBest(i) {
      return save.mapBest[MAPS[i].id] || 0;
    }
    function mapGoalMet(i) {
      return i > 0 && mapOpen(i - 1) && mapBest(i - 1) >= MAPS[i - 1].goal;
    }
    function openMaps() {
      var o = [];
      for (var i = 0; i < MAPS.length; i++) if (mapOpen(i)) o.push(MAPS[i].id);
      return o;
    }
    function heroOwned(i) {
      return CHARS[i].price === 0 || !!save.owned["char:" + i];
    }
    function mapTip(id) {
      var s = mapInfo(id).special;
      return s === "ice" ? "\u041B\u0401\u0414: \u0421\u041A\u041E\u041B\u042C\u0417\u041A\u041E" : s === "bounce" ? "\u041F\u0420\u0423\u0416\u0418\u041D\u042B \u0427\u0410\u0429\u0415" : s === "lava" ? "\u0416\u0410\u0420\u041A\u0418\u0415 \u041F\u041B\u0410\u0422\u0424\u041E\u0420\u041C\u042B" : s === "bubble" ? "\u041F\u0423\u0417\u042B\u0420\u0418" : s === "grav" ? "\u0421\u041B\u0410\u0411\u0410\u042F \u0413\u0420\u0410\u0412\u0418\u0422\u0410\u0426\u0418\u042F" : "";
    }
    function mapOpened(M) {
      return M.id === "jungle" ? "\u0414\u0416\u0423\u041D\u0413\u041B\u0418 \u041E\u0422\u041A\u0420\u042B\u0422\u042B!" : M.name + " \u041E\u0422\u041A\u0420\u042B\u0422!";
    }
    function say(s) {
      flash = s;
      flashT = 90;
      flashPh = phase;
    }
    function addHit(id, x, y, w, h) {
      hits.push({ id, x, y, w, h });
    }
    function hitAt(x, y) {
      for (var i = hits.length - 1; i >= 0; i--) {
        var h = hits[i];
        if (x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h) return h.id;
      }
      return null;
    }
    function btn(id, x, y, w, h, fill, label, tcol, sc, border) {
      addHit(id, x, y, w, h);
      markBox(id, x, y, w, h);
      var on = pressId === id;
      var fill2 = on ? mixHex(fill, "#ffffff", 0.2) : fill;
      box(ctx, x, y, w, h, fill2, border || C.cream);
      if (on) rect(ctx, x + 1, y + h - 2, w - 2, 1, "rgba(0,0,0,0.35)");
      var s = sc || 1;
      drawText(ctx, label, x + w / 2, y + Math.round((h - 7 * s) / 2) + (on ? 1 : 0), tcol || C.cream, s, "center");
    }
    function telegramLinked() {
      try {
        var w = window;
        if (w.__hopTg && w.__hopTg.linked && location.protocol === "file:") return true;
        return !!(typeof PROFILE !== "undefined" && PROFILE && PROFILE.getState && PROFILE.getState().telegramId);
      } catch (_e) {
        return false;
      }
    }
    function tgName() {
      var raw2 = "";
      try {
        var w = window;
        if (w.__hopTg && w.__hopTg.name && location.protocol === "file:") raw2 = String(w.__hopTg.name);
        else {
          var u = w.Telegram && w.Telegram.WebApp && w.Telegram.WebApp.initDataUnsafe && w.Telegram.WebApp.initDataUnsafe.user;
          if (u && u.first_name) raw2 = String(u.first_name);
        }
      } catch (_e) {
        raw2 = "";
      }
      raw2 = String(raw2).toUpperCase();
      var out = "";
      for (var i = 0; i < raw2.length && out.length < 10; i++) if (FONT[raw2[i]]) out += raw2[i];
      return out;
    }
    function coinsLabel(x, y, n, align, _showTg) {
      var s = String(n), w = textWidth(s, 1) + 9;
      var x0 = align === "right" ? x - w : align === "center" ? x - w / 2 : x;
      drawCoin(ctx, x0, y, ui);
      drawText(ctx, s, x0 + 9, y - 0.5, C.gold, 1, "left");
    }
    function menuTop() {
      return Math.round(insetTopCss() / Math.max(0.01, cssScale || 1));
    }
    function nickWidth(n) {
      return n ? n * 6 - 1 + 2 : 0;
    }
    function fitNick(raw2, maxW) {
      var s = drawableChars(String(raw2 || ""));
      if (nickWidth(s.length) <= maxW) return { text: s, dots: false };
      var room2 = maxW - 7;
      var n = 0;
      while (n < s.length && nickWidth(n + 1) <= room2) n++;
      return { text: s.slice(0, n), dots: true };
    }
    function drawNick(raw2, x, y, maxW) {
      var fit = fitNick(raw2, maxW);
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
    function glyphsOf(raw2, max) {
      return drawableChars(String(raw2 || "").replace(/@/g, "")).slice(0, max);
    }
    function tgUser() {
      try {
        var w = window;
        if (w.__hopTg && w.__hopTg.name && location.protocol === "file:") return { first_name: w.__hopTg.name, username: "" };
        return w.Telegram && w.Telegram.WebApp && w.Telegram.WebApp.initDataUnsafe && w.Telegram.WebApp.initDataUnsafe.user;
      } catch (_e) {
        return null;
      }
    }
    function guestTag() {
      var src = "";
      try {
        var st = typeof PROFILE !== "undefined" && PROFILE && PROFILE.getState ? PROFILE.getState() : null;
        if (st && st.profile && st.profile.id) src = String(st.profile.id);
        else if (st && st.tokenPresent) src = "";
      } catch (_e) {
      }
      try {
        if (!src) src = localStorage.getItem("hoppak_guest_token") || "";
      } catch (_e2) {
      }
      if (!src) {
        try {
          var prev = localStorage.getItem("hoppak_guest_tag") || "";
          if (/^[0-9A-F]{4}$/.test(prev)) return prev;
        } catch (_e3) {
        }
        return "0000";
      }
      var h = 2166136261;
      for (var i = 0; i < src.length; i++) {
        h ^= src.charCodeAt(i);
        h = Math.imul(h, 16777619);
      }
      var tag = ("0000" + (h >>> 0).toString(16).toUpperCase()).slice(-4);
      try {
        localStorage.setItem("hoppak_guest_tag", tag);
      } catch (_e4) {
      }
      return tag;
    }
    function accountName(full) {
      if (telegramLinked()) {
        var u = tgUser() || {};
        var raw2 = u.first_name || u.username || tgName();
        return glyphsOf(raw2, full ? 16 : 24);
      }
      var tag = guestTag();
      return full ? "GUEST HOPPER-" + tag : "HOP-" + tag;
    }
    var CHIP = 15, CHIP_IN = 13;
    function quantizeChip(px, size) {
      var pts = [], i;
      for (i = 0; i < size * size; i++) pts.push([px[i * 4], px[i * 4 + 1], px[i * 4 + 2]]);
      var boxes = [pts];
      function spanOf(box3) {
        var mn = [255, 255, 255], mx = [0, 0, 0], ch2 = 0, s = 0, a2;
        for (a2 = 0; a2 < box3.length; a2++) for (var c = 0; c < 3; c++) {
          if (box3[a2][c] < mn[c]) mn[c] = box3[a2][c];
          if (box3[a2][c] > mx[c]) mx[c] = box3[a2][c];
        }
        for (c = 0; c < 3; c++) if (mx[c] - mn[c] > s) {
          s = mx[c] - mn[c];
          ch2 = c;
        }
        return { span: s, ch: ch2 };
      }
      while (boxes.length < 12) {
        var bi = 0, best = -1;
        for (var b = 0; b < boxes.length; b++) {
          var sp = spanOf(boxes[b]);
          if (sp.span > best && boxes[b].length > 1) {
            best = sp.span;
            bi = b;
          }
        }
        if (best < 8) break;
        var ch = spanOf(boxes[bi]).ch;
        var box2 = boxes[bi].slice().sort(function(p2, q) {
          return p2[ch] - q[ch];
        });
        var mid = Math.max(1, Math.floor(box2.length / 2));
        boxes.splice(bi, 1, box2.slice(0, mid), box2.slice(mid));
      }
      var pal = [];
      for (b = 0; b < boxes.length; b++) {
        var rs = 0, gs = 0, bs = 0;
        for (a = 0; a < boxes[b].length; a++) {
          rs += boxes[b][a][0];
          gs += boxes[b][a][1];
          bs += boxes[b][a][2];
        }
        var n = boxes[b].length || 1;
        pal.push([Math.round(rs / n), Math.round(gs / n), Math.round(bs / n)]);
      }
      var cv = document.createElement("canvas");
      cv.width = size;
      cv.height = size;
      var g = cv.getContext("2d");
      if (!g) return null;
      var im = g.createImageData(size, size);
      for (i = 0; i < size * size; i++) {
        var r = px[i * 4], gg = px[i * 4 + 1], bb = px[i * 4 + 2], bd = 1e9, pick = 0;
        for (var p = 0; p < pal.length; p++) {
          var dr = r - pal[p][0], dg = gg - pal[p][1], db = bb - pal[p][2], d = dr * dr + dg * dg + db * db;
          if (d < bd) {
            bd = d;
            pick = p;
          }
        }
        im.data[i * 4] = pal[pick][0];
        im.data[i * 4 + 1] = pal[pick][1];
        im.data[i * 4 + 2] = pal[pick][2];
        im.data[i * 4 + 3] = 255;
      }
      g.putImageData(im, 0, 0);
      return cv;
    }
    function pixelizeImage(img) {
      var sw = img.naturalWidth || img.width, sh = img.naturalHeight || img.height;
      var side = Math.min(sw, sh) || 1;
      var crop = Math.max(1, Math.round(side * 0.7));
      var sx0 = Math.floor((sw - side) / 2 + (side - crop) / 2);
      var sy0 = Math.floor((sh - side) / 2 + (side - crop) / 2);
      var tmp = document.createElement("canvas");
      tmp.width = crop;
      tmp.height = crop;
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
            r += data[ii];
            g += data[ii + 1];
            b += data[ii + 2];
            n++;
          }
          n = n || 1;
          r /= n;
          g /= n;
          b /= n;
          r = (r - 128) * 1.15 + 128;
          g = (g - 128) * 1.15 + 128;
          b = (b - 128) * 1.15 + 128;
          var avg = (r + g + b) / 3;
          r = avg + (r - avg) * 1.25;
          g = avg + (g - avg) * 1.25;
          b = avg + (b - avg) * 1.25;
          var o = (y * size + x) * 4;
          out[o] = clamp(Math.round(r), 0, 255);
          out[o + 1] = clamp(Math.round(g), 0, 255);
          out[o + 2] = clamp(Math.round(b), 0, 255);
          out[o + 3] = 255;
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
      photoSlot = { url, cv: null, fail: false };
      try {
        var img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = function() {
          try {
            var cv = pixelizeImage(img);
            if (!cv) {
              if (photoSlot.url === url) photoSlot.fail = true;
              return;
            }
            if (photoSlot.url === url) photoSlot.cv = cv;
          } catch (_err) {
            if (photoSlot.url === url) photoSlot.fail = true;
          }
        };
        img.onerror = function() {
          if (photoSlot.url === url) photoSlot.fail = true;
        };
        img.src = url;
      } catch (_e) {
        photoSlot.fail = true;
      }
      return null;
    }
    var SIL = ["..##..", ".####.", "..##..", "######", ".####.", ".#..#.", ".#..#."];
    function drawSil(x, y, sc) {
      for (var r = 0; r < SIL.length; r++) for (var c = 0; c < 6; c++) if (SIL[r][c] === "#") rect(ctx, x + c * sc, y + r * sc, sc, sc, "#c4b8a4");
    }
    function drawBang(x, y) {
      var stem = [[0, 0], [0, 1], [0, 3]];
      var i, k;
      for (i = 0; i < stem.length; i++) {
        var px = x + stem[i][0], py = y + stem[i][1];
        for (k = 0; k < 4; k++) rect(ctx, px + [-1, 1, 0, 0][k], py + [0, 0, -1, 1][k], 1, 1, "#1a1030");
      }
      for (i = 0; i < stem.length; i++) rect(ctx, x + stem[i][0], y + stem[i][1], 1, 1, "#a89068");
    }
    function drawChip(x, y, photo, bang) {
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
    function drawBuy(id, x, y, w, h, price) {
      addHit(id, x, y, w, h);
      markBox(id, x, y, w, h);
      var on = pressId === id;
      var lack = save.coins < price;
      var wait = !lack && confirmId === id && Date.now() < confirmAt;
      var fill = lack ? "#5a5668" : C.mint;
      if (on) fill = mixHex(fill, "#ffffff", 0.2);
      box(ctx, x, y, w, h, fill, lack ? "#8a8498" : C.cream);
      if (on) rect(ctx, x + 1, y + h - 2, w - 2, 1, "rgba(0,0,0,0.35)");
      var lab = lack ? "\u041D\u0423\u0416\u041D\u041E \u0415\u0429\u0401 \u25CF " + (price - save.coins) : wait ? "\u0422\u041E\u0427\u041D\u041E? \u25CF " + price : "\u041A\u0423\u041F\u0418\u0422\u042C \u25CF " + price;
      drawText(ctx, lab, x + w / 2, y + Math.round((h - 7) / 2) + (on ? 1 : 0), lack ? "#d8d0e0" : INK, 1, "center");
    }
    function tryBuy(id, price, apply) {
      if (save.coins < price) return;
      if (confirmId === id && Date.now() < confirmAt) {
        confirmId = null;
        apply();
        writeSave(save);
      } else {
        confirmId = id;
        confirmAt = Date.now() + 2e3;
      }
    }
    function abBar() {
      var coinW = 28;
      try {
        if (world) coinW = textWidth(String(world.runCoins || 0), 1) + 19;
      } catch (_e) {
      }
      return { x: 4 + coinW, y: hudY(5), w: 16, h: 16 };
    }
    function startSquad(seed) {
      mode = "squad";
      startRun(seed != null ? seed : Date.now() + (room && room.round || 0) * 40503 >>> 0);
    }
    function startNet(info) {
      mode = "solo";
      resize();
      startRun(info.seed, info.map);
      NET.attachWorld(world, info);
    }
    function startRun(seed, mapId) {
      var s = seed != null ? seed : (Date.now() ^ Math.floor(Math.random() * 2147483647)) >>> 0;
      world = createWorld(s, mode, save.char, lookNow(), mapId || (mode === "squad" ? lobbyMap : save.bg));
      var mi = mapIdx(world.map);
      world.recM = mapBest(mi);
      world.goalM = MAPS[mi].goal || 0;
      phase = "play";
      rankY = {};
      paused = false;
      landPause = false;
      fieldLocked = true;
      acc = 0;
      uiAcc = 0;
      lastT = -1;
      held.left = held.right = false;
      pointers = {};
      abTap = false;
      pressId = null;
      resumeCd = 0;
      landPause = false;
      manualPause = false;
      abDenyT = 0;
      refuseT = 0;
      popT = -1;
      wasReady = false;
      coinT0 = -1;
      coinSkip = false;
      try {
        canvas.focus();
      } catch (_e) {
      }
      VIEW_SHIFT = 0;
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
      var plan = typeof PROFILE !== "undefined" && PROFILE && PROFILE.computeAward ? PROFILE.computeAward(mtr, runC, bonC) : { awarded: (mtr >= 100 ? Math.floor(Math.max(0, Math.min(2e4, mtr)) / 25) : 0) + Math.max(0, runC) + Math.max(0, bonC), limited: mtr < 100 ? "HEIGHT_MIN" : "" };
      world.earnH = mtr >= 100 ? Math.floor(Math.max(0, Math.min(2e4, mtr)) / 25) : 0;
      world.earnC = Math.max(0, plan.awarded - world.earnH);
      world.earned = plan.awarded;
      world.limited = plan.limited || "";
      world.coinFrom = save.coins;
      var mi = mapIdx(world.map);
      world.prevMapBest = mapBest(mi);
      world.newBest = mtr > (world.prevMapBest || 0);
      if (mtr > world.prevMapBest) save.mapBest[world.map] = mtr;
      save.coins += world.earned;
      coinT0 = -1;
      coinSkip = false;
      if (mtr > save.best) save.best = mtr;
      world.best = save.best;
      writeSave(save);
      if (typeof PROFILE !== "undefined" && PROFILE) {
        if (mtr > 0 || runC > 0 || bonC > 0) {
          PROFILE.finishRun(mtr, runC, bonC, world, {
            mode: world.net ? "online" : mode,
            map: world.map,
            ver: "0.6rc",
            awarded: world.earned
          });
        }
      }
    }
    function goMenu() {
      if (phase === "play" && world && !world.paid) payout();
      phase = "menu";
      world = null;
      showSet = false;
      showProf = false;
      campCard = -1;
      paused = false;
      landPause = false;
      manualPause = false;
      fieldLocked = false;
      resize();
    }
    function shopTap(key) {
      if (key.indexOf("char:") !== 0) return;
      var i = parseInt(key.slice(5), 10);
      if (isNaN(i) || i < 0 || i >= CHARS.length) return;
      if (heroOwned(i)) {
        save.char = i;
        writeSave(save);
        say("\u0412\u042B\u0411\u0420\u0410\u041D");
      } else tryBuy("hero:act", CHARS[i].price, function() {
        save.coins -= CHARS[i].price;
        save.owned["char:" + i] = 1;
        save.char = i;
        say("\u041A\u0423\u041F\u041B\u0415\u041D\u041E!");
        if (typeof PROFILE !== "undefined" && PROFILE) PROFILE.buy("char:" + i, CHARS[i].price);
      });
    }
    function activate(id) {
      if (!id) return;
      if (id.indexOf("net:") === 0) {
        NET.tap(id, netApi);
        return;
      }
      if (world && world.netRound && (id === "rematch" || id === "menu")) {
        if (id === "menu") {
          NET.leave();
          goMenu();
        } else NET.tap("net:rematch", netApi);
        return;
      }
      if (id === "start") {
        mode = "solo";
        startRun();
        return;
      }
      if (id === "camp") {
        phase = "camp";
        campCard = -1;
        return;
      }
      if (id.indexOf("camp:") === 0) {
        campTap(id.slice(5));
        return;
      }
      if (id === "hero:prev") {
        shopHero = mod(shopHero - 1, CHARS.length);
        return;
      }
      if (id === "hero:next") {
        shopHero = mod(shopHero + 1, CHARS.length);
        return;
      }
      if (id.indexOf("hero:") === 0 && id !== "hero:act") {
        var hi = parseInt(id.slice(5), 10);
        if (!isNaN(hi) && hi >= 0 && hi < CHARS.length) shopHero = hi;
        return;
      }
      if (id === "hero:act") {
        shopTap("char:" + shopHero);
        return;
      }
      if (id === "lmap:prev" || id === "lmap:next") {
        var om = openMaps(), li = Math.max(0, om.indexOf(lobbyMap));
        lobbyMap = om[mod(li + (id === "lmap:next" ? 1 : -1), om.length)];
        return;
      }
      if (id === "shop") {
        phase = "shop";
        return;
      }
      if (id === "mp" || id === "create") {
        if (openMaps().indexOf(lobbyMap) < 0) lobbyMap = save.bg;
        room = room || { round: 0 };
        phase = "lobby";
        return;
      }
      if (id === "acct") {
        showSet = false;
        showProf = !showProf;
        return;
      }
      if (id === "set:prof") {
        showSet = false;
        showProf = true;
        return;
      }
      if (id === "prof:close" || id === "prof:out") {
        showProf = false;
        return;
      }
      if (id === "prof:card") return;
      if (id === "set") {
        showSet = !showSet;
        showProf = false;
        return;
      }
      if (id === "tilt") {
        toggleTilt();
        return;
      }
      if (id === "vol:mute") {
        setAudioOn(!audioOn);
        save.audioOn = audioOn;
        save.musicOn = audioOn;
        save.sfx = audioOn;
        save.vol = masterVol;
        writeSave(save);
        if (audioOn) hopSfx("tick");
        return;
      }
      if (id === "vib") {
        vibOn = !vibOn;
        save.vib = vibOn;
        writeSave(save);
        if (vibOn) hopVib(18);
        return;
      }
      if (id === "menu") {
        goMenu();
        return;
      }
      if (id === "back") {
        showSet = false;
        campCard = -1;
        phase = "menu";
        return;
      }
      if (id === "go") {
        startSquad();
        return;
      }
      if (id === "pause") {
        if (phase === "play" && !paused) {
          paused = true;
          manualPause = true;
          acc = 0;
          uiAcc = 0;
          lastT = -1;
        }
        return;
      }
      if (id === "resume") {
        startResumeCountdown();
        return;
      }
      if (id === "font") {
        phase = "font";
        return;
      }
      if (id === "rematch") {
        if (mode === "squad") {
          room.round = (room.round || 0) + 1;
          startSquad(Date.now() + room.round * 40503 >>> 0);
        } else startRun();
      }
    }
    function campTap(key) {
      if (key === "play") return;
      if (key === "open" || key.indexOf("open:") === 0) {
        var i2 = key.indexOf("open:") === 0 ? parseInt(key.slice(5), 10) : nextClosable();
        if (i2 < 0 || isNaN(i2)) return;
        unlockMap(i2, key === "open" ? "camp:open" : "camp:open:" + i2);
        return;
      }
      var i = parseInt(key, 10);
      if (isNaN(i) || i < 0 || i >= MAPS.length) return;
      var M = MAPS[i];
      flashT = 0;
      if (mapOpen(i)) {
        if (save.bg !== M.id) {
          save.bg = M.id;
          writeSave(save);
        }
        return;
      }
      if (!mapOpen(i - 1)) {
        say("\u0421\u041D\u0410\u0427\u0410\u041B\u0410 \u041E\u0422\u041A\u0420\u041E\u0419 " + MAPS[i - 1].name);
        return;
      }
      if (!mapGoalMet(i)) {
        say("\u0414\u041E\u0419\u0414\u0418 \u0414\u041E " + MAPS[i - 1].goal + " \u041C " + WHERE[i - 1]);
        return;
      }
    }
    function nextClosable() {
      for (var i = 1; i < MAPS.length; i++) if (!mapOpen(i) && mapGoalMet(i)) return i;
      return -1;
    }
    function unlockMap(i, buyId) {
      var M = MAPS[i];
      if (mapOpen(i) || !mapGoalMet(i)) return;
      tryBuy(buyId || "camp:open:" + i, M.price, function() {
        save.coins -= M.price;
        save.owned["map:" + M.id] = 1;
        save.bg = M.id;
        say(mapOpened(M));
        if (typeof PROFILE !== "undefined" && PROFILE) PROFILE.buy("map:" + M.id, M.price);
      });
    }
    function stagingBuild() {
      try {
        return typeof HOP_STAGING !== "undefined" && !!HOP_STAGING;
      } catch (_e) {
        return false;
      }
    }
    function remoteAlpha() {
      return REMOTE_ALPHA;
    }
    function toggleTilt() {
      if (!tiltAvail || tiltDenied) {
        say("\u041D\u0410\u041A\u041B\u041E\u041D \u041D\u0415\u0414\u041E\u0421\u0422\u0423\u041F\u0415\u041D");
        return;
      }
      if (tiltOn) {
        tiltOn = false;
        tiltAx = 0;
        return;
      }
      var ok = function() {
        tiltOn = true;
      };
      var fail = function() {
        tiltOn = false;
        tiltDenied = true;
        say("\u041D\u0410\u041A\u041B\u041E\u041D \u041D\u0415\u0414\u041E\u0421\u0422\u0423\u041F\u0415\u041D");
      };
      try {
        var DOE = window.DeviceOrientationEvent;
        if (DOE && typeof DOE.requestPermission === "function") DOE.requestPermission().then(function(s) {
          if (s === "granted") ok();
          else fail();
        }).catch(fail);
        else ok();
      } catch (_e) {
        fail();
      }
    }
    function onOrient(e) {
      if (!tiltOn || e.gamma == null || isNaN(e.gamma)) return;
      tiltAx = clamp(e.gamma / 22, -1, 1);
    }
    function recomputeHold() {
      var l = false, r = false;
      if (phase === "play" && !paused) for (var k in pointers) {
        var q = pointers[k];
        var pb = pauseBox();
        if (q.x >= pb.x && q.y >= pb.y && q.y < pb.y + pb.h) continue;
        if (q.x < LW / 2) l = true;
        else r = true;
      }
      held.left = l;
      held.right = r;
    }
    var volGeom = { x: 0, w: 1 };
    function setSlider(id, x) {
      var v = Math.round(clamp((x - volGeom.x) / Math.max(1, volGeom.w), 0, 1) * 10) / 10;
      if (v > 0 && !audioOn) setAudioOn(true);
      setMasterVol(v);
      save.vol = masterVol;
      save.music = masterVol;
      save.sfxVol = masterVol;
      save.audioOn = audioOn;
      save.musicOn = audioOn;
      save.sfx = audioOn;
      writeSave(save);
    }
    function volRow(id, x, y, w, label, vol, on) {
      drawText(ctx, label, x, y, on ? C.cream : "#9a8ab8", 1, "left");
      btn(id + ":mute", x + w - 36, y - 2, 36, 12, on ? C.mint : "#1a1430", on ? "\u0412\u041A\u041B" : "\u0412\u042B\u041A\u041B", on ? INK : C.cream);
      var bx = x, bw = w, by = y + 12;
      addHit(id, bx, by, bw, 8);
      volGeom = { x: bx, w: bw };
      rect(ctx, bx, by, bw, 5, "#120c28");
      var fw = Math.max(0, Math.round(bw * (on ? vol : 0)));
      if (fw > 0) rect(ctx, bx, by, fw, 5, C.mint);
      rect(ctx, bx, by, bw, 1, on ? C.cream : "#5a5668");
      rect(ctx, bx + Math.min(bw - 1, fw), by - 1, 1, 7, C.gold);
    }
    function onPtrDown(e) {
      e.preventDefault();
      audioUnlock();
      try {
        canvas.focus();
      } catch (_e) {
      }
      try {
        if (e.pointerId != null) (e.currentTarget || ptrRoot).setPointerCapture(e.pointerId);
      } catch (_e) {
      }
      var loc = toLogic(e.clientX, e.clientY);
      var id = hitAt(loc.x, loc.y);
      pressId = id;
      if (id === "vol") {
        setSlider(id, loc.x);
        return;
      }
      if (phase === "results") coinSkip = true;
      if (phase !== "play") return;
      if (paused) return;
      if (id === "ab" || id === "pause") return;
      pointers[e.pointerId != null ? e.pointerId : 1] = { x: loc.x, y: loc.y, sx: loc.x, sy: loc.y, sxCss: e.clientX, syCss: e.clientY, t0: e.timeStamp || Date.now(), swiped: false };
      recomputeHold();
    }
    function onPtrMove(e) {
      var loc = toLogic(e.clientX, e.clientY);
      if (pressId === "vol") {
        setSlider(pressId, loc.x);
        return;
      }
      if (phase !== "play" || paused) return;
      var pid = e.pointerId != null ? e.pointerId : 1;
      var p = pointers[pid];
      if (!p) return;
      p.x = loc.x;
      p.y = loc.y;
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
    function onPtrUp(e) {
      var loc = toLogic(e.clientX, e.clientY);
      var id = hitAt(loc.x, loc.y);
      if (phase === "play") {
        if (paused) {
          if (id === "resume" || id === "menu" || id === "vol:mute" && pressId === id) activate(id);
        } else if (id === "pause" && pressId === "pause") activate("pause");
        else if (id === "ab" && pressId === "ab") requestAbility();
        delete pointers[e.pointerId != null ? e.pointerId : 1];
        recomputeHold();
      } else if (pressId === "vol") {
        if (id === pressId) setSlider(pressId, loc.x);
      } else if (id && id === pressId) activate(id);
      pressId = null;
    }
    function onKey(e, down) {
      var k = e.key;
      if ((k === "f" || k === "F" || k === "\u0430" || k === "\u0410") && !typingTarget(e)) {
        if (down && cinemaAllowed()) {
          toggleCinema();
          e.preventDefault();
        }
        return;
      }
      if (k === "Escape" && cinemaOn && !typingTarget(e)) {
        if (down) {
          exitCinema();
          e.preventDefault();
        }
        return;
      }
      if (down) audioUnlock();
      if (k === "ArrowLeft" || k === "a" || k === "A" || k === "\u0444" || k === "\u0424") {
        held.kl = down;
        e.preventDefault();
        return;
      }
      if (k === "ArrowRight" || k === "d" || k === "D" || k === "\u0432" || k === "\u0412") {
        held.kr = down;
        e.preventDefault();
        return;
      }
      if (!down) return;
      if (phase === "play" && paused && (k === " " || k === "Enter" || k === "Escape")) {
        if (landPause || resumeCd <= 0) startResumeCountdown();
        e.preventDefault();
        return;
      }
      if (phase === "play" && (k === " " || k === "ArrowUp" || k === "w" || k === "W" || k === "\u0446" || k === "\u0426" || k === "Shift")) {
        requestAbility();
        e.preventDefault();
        return;
      }
      if (k === "Escape" && phase === "play") {
        paused = true;
        manualPause = true;
        acc = 0;
        uiAcc = 0;
        lastT = -1;
        return;
      }
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
      var inputs = {};
      for (var i = 0; i < world.players.length; i++) {
        var p = world.players[i];
        if (p.isBot || autoPlay) inputs[p.id] = { dir: botDir(p, world), ax: 0, ab: botWantsAb(world, p) };
        else {
          var d = dirNow();
          inputs[p.id] = tiltOn && d === 0 ? { dir: 0, ax: tiltAx } : { dir: d, ax: 0 };
        }
        if (!p.isBot && abTap) {
          inputs[p.id].ab = true;
          abTap = false;
        }
      }
      return inputs;
    }
    var TITLE = { face: "#ffe9a8", outline: "#2a1840", shadow: "#6a3cb4" };
    var MENU_CAM = function() {
      return -LH + 70;
    };
    function bandBottom() {
      return menuTop() + 1 + CHIP;
    }
    function belowBand() {
      return bandBottom() + 4;
    }
    function markBox(id, x, y, w, h) {
      screenLay.push({ id, x, y, w, h });
    }
    function header(title, sc) {
      var y = belowBand();
      var h = 7 * sc + 10;
      var w = textWidth(title, sc) + 16;
      var x = Math.round(LW / 2 - w / 2);
      box(ctx, x, y, w, h, C.navy, C.cream);
      drawText(ctx, title, LW / 2, y + 5, C.cream, sc, "center");
      markBox("header", x, y, w, h);
      if (phase === "results") pushRes("header", x, y, w, h);
      return { x, y, w, h, bottom: y + h };
    }
    function drawFlash() {
      if (flashT <= 0) return;
      if (phase !== flashPh) {
        flashT = 0;
        return;
      }
      var unlock = flash.indexOf("\u041E\u0422\u041A\u0420\u042B\u0422") >= 0;
      var sc = 1, fy = LH - 64, fh = 13;
      if (unlock && phase === "camp") {
        if (campCard >= 0) {
          fy = Math.round(LH / 2 - 70) + 84;
          fh = 16;
        } else {
          fy = 36;
          fh = 22;
        }
      } else if (unlock) {
        fy = 36;
        fh = 16;
      }
      var w = Math.min(LW - 8, textWidth(flash, sc) + 16);
      ctx.globalAlpha = Math.min(1, flashT / 20);
      box(ctx, Math.round(LW / 2 - w / 2), fy, w, fh, C.navy, C.gold);
      drawText(ctx, flash, LW / 2, fy + 4, C.gold, sc, "center");
      ctx.globalAlpha = 1;
    }
    function plaque() {
      var x = colX();
      box(ctx, x, 48, 152, 14, C.navy, C.gold);
      coinsLabel(x + 4, 51, save.coins, void 0, true);
      drawText(ctx, "\u0420\u0415\u041A\u041E\u0420\u0414 " + (save.best || 0) + " \u041C", x + 148, 51, C.cream, 1, "right");
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
      drawText(ctx, "\u041F\u0420\u041E\u0424\u0418\u041B\u042C", LW / 2, y + 6, C.gold, 1, "center");
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
      drawText(ctx, linked ? "\u0412\u0425\u041E\u0414: TELEGRAM" : "\u0412\u0425\u041E\u0414: \u0413\u041E\u0421\u0422\u0415\u0412\u041E\u0419", x + 8, entryY, C.cream, 1, "left");
      if (!linked) drawText(ctx, "\u041F\u0420\u041E\u0413\u0420\u0415\u0421\u0421 \u041D\u0410 \u0423\u0421\u0422\u0420\u041E\u0419\u0421\u0422\u0412\u0415", x + 8, entryY + 12, "#b8ae9a", 1, "left");
      drawText(ctx, "\u0420\u0415\u041A\u041E\u0420\u0414 " + (save.best || 0) + " \u041C", x + 8, y + h - 36, C.gold, 1, "left");
      btn("prof:close", x + 26, y + h - 22, 100, 16, C.navy, "\u0417\u0410\u041A\u0420\u042B\u0422\u042C");
    }
    function drawMenu() {
      drawBg(ctx, MENU_CAM(), ui, save.bg, true);
      dimView(ctx, "rgba(18,14,44,0.14)");
      var x = colX();
      var top = menuTop();
      var logoY = top + 25;
      var heroPeak = 108;
      var logoSc = 3;
      if (logoY + 7 * logoSc + 4 + 7 + 4 > heroPeak) logoSc = 2;
      var tagY = logoY + 7 * logoSc + 4;
      var logoW = bigWidth("\u0425\u041E\u041F\u041F\u0410\u041A", logoSc);
      drawBig(ctx, "\u0425\u041E\u041F\u041F\u0410\u041A", LW / 2, logoY, TITLE.face, logoSc, "center", TITLE.outline, TITLE.shadow);
      drawTextO(ctx, "\u041F\u0420\u042B\u0413\u0410\u0419 \u0412\u042B\u0428\u0415 \u0412\u0421\u0415\u0425", LW / 2, tagY, C.cream, "center");
      menuLay = {
        chip: { x: 3, y: 1 + top, w: CHIP, h: CHIP },
        coins: { x: 0, y: 1 + top, w: 0, h: CHIP },
        logo: { x: Math.round(LW / 2 - logoW / 2) - 1, y: logoY - 1, w: logoW + 2, h: 7 * logoSc + 2 },
        tag: { x: Math.round(LW / 2 - textWidth("\u041F\u0420\u042B\u0413\u0410\u0419 \u0412\u042B\u0428\u0415 \u0412\u0421\u0415\u0425", 1) / 2) - 1, y: tagY - 1, w: textWidth("\u041F\u0420\u042B\u0413\u0410\u0419 \u0412\u042B\u0428\u0415 \u0412\u0421\u0415\u0425", 1) + 2, h: 9 },
        logoSc
      };
      var mi = mapIdx(save.bg), M = MAPS[mi], b = mapBest(mi);
      var sub = M.goal ? M.name + " \xB7 " + b + "/" + M.goal + " \u041C" : M.name + " \xB7 " + b + " \u041C";
      var by = LH - 118;
      var py = Math.min(by - 40, Math.max(148, Math.round((70 + by) * 0.5)));
      var ph = ui % 60 / 60;
      var hop = Math.round(Math.sin(ph * Math.PI) * 10);
      var pose = ph < 0.08 || ph > 0.95 ? "squash" : ph < 0.5 ? "up" : "fall";
      rect(ctx, LW / 2 - 28, py + 2, 56, 5, C.wood);
      rect(ctx, LW / 2 - 28, py + 6, 56, 2, C.woodD);
      rect(ctx, LW / 2 - 28, py + 2, 56, 1, C.edge);
      drawJumper(ctx, LW / 2 - 12, py + 2 - 32 - hop, lookNow(), 1, pose, ui % 170 < 6, true, 2);
      btn("shop", x + 36, py + 16, 80, 16, "#1a1430", "\u0413\u0415\u0420\u041E\u0419 \u25B6", C.cream, 1, C.gold);
      by = Math.max(py + 40, by);
      btn("start", x, by, 152, 34, C.mint, "", INK, 2);
      drawBig(ctx, "\u0418\u0413\u0420\u0410\u0422\u042C \u25B6", LW / 2, by + 4, INK, 2, "center");
      drawText(ctx, sub, LW / 2, by + 23, INK, 1, "center");
      if (isPageBuild()) {
        btn("camp", x, by + 40, 152, 22, C.navy, "\u041A\u0410\u0420\u0422\u042B");
        btn("shop", x, by + 66, 72, 22, C.navy, "\u041C\u0410\u0413\u0410\u0417\u0418\u041D");
        btn("set", x + 80, by + 66, 72, 22, C.navy, "\u041D\u0410\u0421\u0422\u0420\u041E\u0419\u041A\u0418");
      } else {
        btn("camp", x, by + 40, 72, 22, C.navy, "\u041A\u0410\u0420\u0422\u042B");
        btn("net:menu", x + 80, by + 40, 72, 22, C.navy, "\u041C\u0423\u041B\u042C\u0422\u0418\u041F\u041B\u0415\u0415\u0420", C.cream, 1, C.mint);
        btn("shop", x, by + 66, 72, 22, C.navy, "\u041C\u0410\u0413\u0410\u0417\u0418\u041D");
        btn("set", x + 80, by + 66, 72, 22, C.navy, "\u041D\u0410\u0421\u0422\u0420\u041E\u0419\u041A\u0418");
      }
      if (showSet) {
        hits = [];
        screenLay = [];
        dimView(ctx, "rgba(8,6,20,0.62)");
        var py0 = belowBand();
        box(ctx, x, py0, 152, 142, C.navy, C.cream);
        markBox("settings", x, py0, 152, 142);
        drawText(ctx, "\u041D\u0410\u0421\u0422\u0420\u041E\u0419\u041A\u0418", LW / 2, py0 + 6, C.gold, 1, "center");
        btn("tilt", x + 8, py0 + 20, 136, 20, tiltOn ? C.mint : "#1a1430", "\u041D\u0410\u041A\u041B\u041E\u041D: " + (tiltOn ? "\u0412\u041A\u041B" : "\u0412\u042B\u041A\u041B"), tiltOn ? INK : C.cream);
        volRow("vol", x + 8, py0 + 44, 136, "\u0413\u0420\u041E\u041C\u041A\u041E\u0421\u0422\u042C", masterVol, audioOn);
        btn("vib", x + 8, py0 + 70, 136, 20, vibOn ? C.mint : "#1a1430", "\u0412\u0418\u0411\u0420\u041E: " + (vibOn ? "\u0412\u041A\u041B" : "\u0412\u042B\u041A\u041B"), vibOn ? INK : C.cream);
        btn("set:prof", x + 8, py0 + 94, 136, 20, "#1a1430", "\u041F\u0420\u041E\u0424\u0418\u041B\u042C", C.cream);
        btn("set", x + 26, py0 + 118, 100, 16, C.navy, "\u0417\u0410\u041A\u0420\u042B\u0422\u042C");
      }
      drawFlash();
    }
    function drawBgSwatch(x, y, w, h, id) {
      var sk = skyAt(id, 0);
      for (var i = 0; i < h; i += 2) rect(ctx, x, y + i, w, 2, i < h / 2 ? mixHex(sk[0], sk[1], i / (h / 2)) : mixHex(sk[1], sk[2], (i - h / 2) / (h / 2)));
      var pt = MAP_PLAT[id] || MAP_PLAT.city;
      rect(ctx, x + 4, y + 18, 16, 3, pt.n);
      rect(ctx, x + 4, y + 18, 16, 1, pt.edge);
      if (id === "city") {
        rect(ctx, x + 2, y + h - 9, 5, 9, "#221852");
        rect(ctx, x + 8, y + h - 13, 6, 13, "#1c1444");
        rect(ctx, x + 15, y + h - 8, 6, 8, "#221852");
        rect(ctx, x + 10, y + h - 10, 1, 1, "#ffd060");
      } else if (id === "jungle") {
        rect(ctx, x, y + h - 6, w, 6, "#2a4e36");
        rect(ctx, x + 5, y + 11, 14, 3, "#ff6848");
      } else if (id === "ice") {
        rect(ctx, x, y + h - 7, w, 7, "#6eb8e8");
        rect(ctx, x, y + h - 7, w, 2, "#ffffff");
      } else if (id === "lava") {
        rect(ctx, x, y + h - 6, w, 6, "#4a1830");
        rect(ctx, x + 3, y + h - 6, w - 6, 2, "#ff7828");
      } else if (id === "aqua") {
        rect(ctx, x, y + h - 5, w, 5, "#d8b46c");
        rect(ctx, x + 6, y + 10, 5, 5, "#ff6ec8");
      } else {
        rect(ctx, x + 5, y + 7, 6, 6, "#e88a62");
        rect(ctx, x + 3, y + 10, 10, 1, "#fff0b4");
      }
    }
    function drawShop() {
      drawBg(ctx, MENU_CAM(), ui, save.bg, true);
      dimView(ctx, "rgba(18,14,44,0.32)");
      var x = colX();
      var hdShop = header("\u041C\u0410\u0413\u0410\u0417\u0418\u041D", 2);
      var pw = 22, gap = 4, sx = Math.round(LW / 2 - (6 * pw + 5 * gap) / 2);
      var heroY = hdShop.bottom + 4;
      markBox("heroes", sx, heroY, 6 * pw + 5 * gap, 22);
      for (var k = 0; k < 6; k++) {
        var bx = sx + k * (pw + gap), by = heroY, H = CHARS[k], own = heroOwned(k), sel = k === shopHero, on = save.char === k;
        addHit("hero:" + k, bx, by, pw, 22);
        box(ctx, bx, by, pw, 22, sel ? "#2a2050" : C.navy, sel ? C.gold : own ? C.cream : "#5a4a72");
        ctx.save();
        ctx.beginPath();
        ctx.rect(bx + 1, by + 1, pw - 2, 20);
        ctx.clip();
        drawJumper(ctx, bx + 3, by + 4, makeLook(k, "base", "none"), 1, "idle", false, true, 1);
        ctx.restore();
        if (on) {
          var qx = bx + pw - 8, qy = by + 1;
          rect(ctx, qx, qy, 7, 7, C.mint);
          rect(ctx, qx + 1, qy + 3, 2, 1, INK);
          rect(ctx, qx + 2, qy + 4, 2, 1, INK);
          rect(ctx, qx + 4, qy + 2, 1, 1, INK);
          rect(ctx, qx + 5, qy + 1, 1, 1, INK);
        }
      }
      var i = shopHero, H2 = CHARS[i], own2 = heroOwned(i), on2 = save.char === i;
      var y0 = heroY + 28, ch = LH - y0 - 42;
      markBox("card", x, y0, 152, ch);
      box(ctx, x, y0, 152, ch, on2 ? "#2a2050" : C.navy, on2 ? C.gold : own2 ? C.cream : "#6a5a8a");
      var mid = y0 + 52;
      rect(ctx, x + 40, mid + 8, 72, 4, C.wood);
      rect(ctx, x + 40, mid + 8, 72, 1, C.edge);
      var ph = ui % 70 / 70, pose = ui % 280 > 230 ? "ability" : ph < 0.08 ? "squash" : ph < 0.5 ? "up" : "fall";
      var hop = pose === "ability" ? 6 : Math.round(Math.sin(ph * Math.PI) * 10);
      drawJumper(ctx, LW / 2 - 12, mid + 8 - 32 - hop, makeLook(i, save.color, save.hat), 1, pose, ui % 170 < 6, true, 2);
      drawText(ctx, H2.name, LW / 2, mid + 16, C.cream, 2, "center");
      var tw = textWidth(H2.abName, 1) + 10;
      box(ctx, Math.round(LW / 2 - tw / 2), mid + 34, tw, 12, "#3a4ac8", C.cream);
      drawText(ctx, H2.abName, LW / 2, mid + 37, C.cream, 1, "center");
      drawText(ctx, H2.abDesc[0], LW / 2, mid + 52, C.cream, 1, "center");
      drawText(ctx, H2.abDesc[1], LW / 2, mid + 62, C.cream, 1, "center");
      drawChargeLine(LW / 2, mid + 76, H2, "#9a8ab8");
      var byb = y0 + ch - 28;
      if (on2) btn("hero:act", x + 10, byb, 132, 22, "#2a2050", "\u0412\u042B\u0411\u0420\u0410\u041D", C.gold, 1, C.gold);
      else if (own2) btn("hero:act", x + 10, byb, 132, 22, C.mint, "\u0412\u042B\u0411\u0420\u0410\u0422\u042C", INK);
      else drawBuy("hero:act", x + 10, byb, 132, 22, H2.price);
      btn("back", x + 26, LH - 34, 100, 22, C.navy, "\u041D\u0410\u0417\u0410\u0414");
      drawFlash();
    }
    function bar(x, y, w, h, f, col) {
      rect(ctx, x, y, w, h, "#1a1430");
      rect(ctx, x, y, Math.max(0, Math.round(w * clamp(f, 0, 1))), h, col);
    }
    function drawCamp() {
      drawBg(ctx, MENU_CAM(), ui, save.bg, true);
      dimView(ctx, "rgba(18,14,44,0.34)");
      var x = colX();
      var hdCamp = header("\u041A\u0410\u041C\u041F\u0410\u041D\u0418\u042F", 2);
      var tipY = hdCamp.bottom + 4;
      box(ctx, x, tipY, 152, 22, "#1a1430", C.mint);
      markBox("tip", x, tipY, 152, 22);
      drawText(ctx, "\u0414\u041E\u0419\u0414\u0418 \u0414\u041E \u0426\u0415\u041B\u0418 \u2192", LW / 2, tipY + 3, C.cream, 1, "center");
      drawText(ctx, "\u041E\u0422\u041A\u0420\u041E\u0419 \u0417\u0410 \u041C\u041E\u041D\u0415\u0422\u042B", LW / 2, tipY + 13, C.mint, 1, "center");
      var top = tipY + 26, bot = LH - 40, rh = Math.min(42, Math.floor((bot - top) / MAPS.length));
      for (var i = 0; i < MAPS.length; i++) {
        var M = MAPS[i], y = top + i * rh, open = mapOpen(i), can = !open && mapGoalMet(i), locked = !open && !can;
        var bd = save.bg === M.id ? C.gold : open ? C.cream : can ? C.mint : "#4a3a6a";
        addHit("camp:" + i, x, y, 152, rh - 3);
        markBox("map" + i, x, y, 152, rh - 3);
        box(ctx, x, y, 152, rh - 3, open ? save.bg === M.id ? "#2a2050" : C.navy : "#1a1430", bd);
        drawBgSwatch(x + 3, y + 3, 20, rh - 9, M.id);
        if (!open) {
          ctx.globalAlpha = 0.55;
          rect(ctx, x + 3, y + 3, 20, rh - 9, "#0c0818");
          ctx.globalAlpha = 1;
        }
        drawText(ctx, i + 1 + ". " + M.name, x + 28, y + 3, open || can ? C.cream : "#9a8ab8", 1, "left");
        if (open) {
          var b = mapBest(i);
          if (M.goal) {
            drawText(ctx, (b >= M.goal ? "\u2713 " : "") + "\u0426\u0415\u041B\u042C " + M.goal + " \u041C", x + 28, y + 13, b >= M.goal ? C.mint : C.gold, 1, "left");
            drawText(ctx, b + "/" + M.goal, x + 148, y + 3, C.cream, 1, "right");
            bar(x + 28, y + rh - 11, 107, 5, b / M.goal, b >= M.goal ? C.mint : C.gold);
          } else drawText(ctx, "\u0420\u0415\u041A\u041E\u0420\u0414 " + b + " \u041C", x + 28, y + 15, C.gold, 1, "left");
        } else if (can) {
          drawBuy("camp:open:" + i, x + 28, y + rh - 20, 120, 16, M.price);
        } else {
          drawText(ctx, MAPS[i - 1].goal + " \u041C " + WHERE[i - 1], x + 28, y + 13, "#9a8ab8", 1, "left");
          drawText(ctx, "\u25CF " + M.price, x + 28, y + 23, C.gold, 1, "left");
        }
      }
      btn("back", x + 26, LH - 34, 100, 22, C.navy, "\u041D\u0410\u0417\u0410\u0414");
      drawFlash();
    }
    function drawLobby() {
      drawBg(ctx, MENU_CAM(), ui, menuMap(), true);
      dimView(ctx, "rgba(18,14,44,0.32)");
      var x = colX();
      var hdLobby = header("\u0417\u0410\u0411\u0415\u0413 \u0421 \u0411\u041E\u0422\u0410\u041C\u0418", 1);
      var ps = lobbyNames();
      var row0 = hdLobby.bottom + 4;
      for (var i = 0; i < ps.length; i++) {
        var y = row0 + i * 26;
        markBox("slot" + i, x, y, 152, 23);
        box(ctx, x, y, 152, 23, i === 0 ? "#2a2050" : C.navy, i === 0 ? C.gold : C.cream);
        drawJumper(ctx, x + 6, y + 5, ps[i].look, 1, "idle", (ui + i * 50) % 170 < 6, true, 1);
        drawText(ctx, ps[i].name, x + 28, y + 3, C.cream, 1, "left");
        drawText(ctx, ps[i].tag, x + 28, y + 13, i === 0 ? C.gold : "#9a8ab8", 1, "left");
        drawText(ctx, CHARS[ps[i].kind].abName, x + 148, y + 8, "#9a8ab8", 1, "right");
      }
      var my = row0 + 4 * 26 + 6;
      btn("lmap:prev", x, my, 20, 18, "#1a1430", "<", C.cream);
      btn("lmap:next", x + 132, my, 20, 18, "#1a1430", ">", C.cream);
      box(ctx, x + 22, my, 108, 18, C.navy, C.cream);
      drawText(ctx, "\u041A\u0410\u0420\u0422\u0410: " + mapInfo(lobbyMap).name, LW / 2, my + 6, C.gold, 1, "center");
      btn("go", x, Math.max(my + 28, LH - 66), 152, 26, C.mint, "\u041D\u0410\u0427\u0410\u0422\u042C", INK, 2);
      btn("back", x + 26, LH - 34, 100, 22, C.navy, "\u041D\u0410\u0417\u0410\u0414");
    }
    function lobbyNames() {
      var out = [{ kind: save.char, look: lookNow(), name: CHARS[save.char].name, tag: "\u0422\u042B" }];
      var bk = botKinds(save.char);
      for (var k = 0; k < bk.length; k++) out.push({ kind: bk[k], look: makeLook(bk[k], "base", "none"), name: CHARS[bk[k]].name, tag: "\u0411\u041E\u0422" });
      return out;
    }
    function poseOf(p) {
      if (!(p.domeT > 0) && (p.abFx > 0 || p.poundT > 0 || p.dashT > 0 || p.hookN > 0 || p.wall || p.teleFx > 10)) return "ability";
      if (p.squash > 3) return "squash";
      if (p.vy < -2.2) return "up";
      if (p.vy > 1.5) return "fall";
      return "idle";
    }
    function goalLine(y, label) {
      if (y < -8 || y > LH + 8) return;
      var yy = Math.round(y);
      for (var x = viewX0(); x < LW + VIEW_PAD; x += 4) {
        var on = (x - viewX0() >> 2) % 2 === 0;
        rect(ctx, x, yy, 4, 1, on ? C.cream : "#162040");
        rect(ctx, x, yy + 1, 4, 1, on ? "#162040" : C.cream);
      }
      var tw = textWidth(label, 1) + 6;
      rect(ctx, 3, yy - 11, tw + 2, 11, INK);
      rect(ctx, 4, yy - 10, tw, 9, "#162040");
      drawText(ctx, label, 4 + tw / 2, yy - 9, C.gold, 1, "center");
    }
    function recLine(y, label) {
      if (y < -8 || y > LH + 8) return;
      var yy = Math.round(y);
      ctx.globalAlpha = 0.7;
      for (var x = viewX0(); x < LW + VIEW_PAD; x += 2) rect(ctx, x, yy, 1, 1, C.cream);
      ctx.globalAlpha = 1;
      var tw = textWidth(label, 1) + 6, lx = LW - tw - 5;
      rect(ctx, lx - 1, yy - 11, tw + 2, 11, INK);
      rect(ctx, lx, yy - 10, tw, 9, "#162040");
      drawText(ctx, label, lx + tw / 2, yy - 9, C.cream, 1, "center");
    }
    function drawReadyPip(me, sy) {
      var dbg = window.__dbg || {};
      var pp = dbg.ring && dbg.ring.pop != null ? dbg.ring.pop : popT;
      if (!heroHasAb(me) || pp < 0 || pp >= 36) return;
      var x = Math.round(me.x + PW / 2) - 2, y = Math.round(sy) - 9;
      rect(ctx, x + 1, y, 1, 1, "#3a6848");
      rect(ctx, x, y + 1, 3, 1, "#3a6848");
      rect(ctx, x + 1, y + 2, 1, 1, "#3a6848");
      rect(ctx, x + 1, y + 1, 1, 1, "#d8e8d0");
    }
    function withWrapX(x, wdt, fn) {
      fn(x);
      if (x < 12) fn(x + LW);
      if (x + wdt > LW - 12) fn(x - LW);
    }
    function rankHeadOf(look) {
      if (!look || !look.id) return null;
      if (rankHead[look.id]) return rankHead[look.id];
      var cv = document.createElement("canvas");
      cv.width = 12;
      cv.height = 12;
      var g = cv.getContext("2d");
      if (!g) return null;
      g.imageSmoothingEnabled = false;
      drawJumper(g, 1, 8, look, 1, "idle", false, true);
      rankHead[look.id] = cv;
      return cv;
    }
    function drawRankColumn(w) {
      if (!w || w.mode !== "squad" || !w.players || w.players.length < 2) return;
      var list = w.players.slice().sort(function(a2, b) {
        var dm = metersOf(b) - metersOf(a2);
        return dm || a2.id - b.id;
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
        var head = rankHeadOf(p.look);
        if (head) {
          ctx.save();
          ctx.imageSmoothingEnabled = false;
          if (!p.alive) ctx.globalAlpha = 0.55;
          ctx.drawImage(head, x, iy, 12, 12);
          ctx.restore();
        }
        if (p.id === 0) {
          rect(ctx, x - 1, iy - 1, 14, 1, C.gold);
          rect(ctx, x - 1, iy + 12, 14, 1, C.gold);
          rect(ctx, x - 1, iy, 1, 12, C.gold);
          rect(ctx, x + 12, iy, 1, 12, C.gold);
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
      var me0 = w.players[0];
      if (VIEW_BOT > 0 && me0) {
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
      var mclip = ctx.getTransform();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      var x0 = Math.ceil(mclip.e - shx * mclip.a - 1e-9);
      var y0 = Math.ceil(mclip.f - 1e-9);
      var x1 = Math.floor(mclip.e - shx * mclip.a + LW * mclip.a + 1e-9);
      var y1 = Math.floor(mclip.f + LH * mclip.d + 1e-9);
      ctx.beginPath();
      ctx.rect(x0, y0, Math.max(0, x1 - x0), Math.max(0, y1 - y0));
      ctx.clip();
      ctx.setTransform(mclip.a, mclip.b, mclip.c, mclip.d, mclip.e, mclip.f);
      for (i = 0; i < w.platforms.length; i++) drawPlatform(ctx, w.platforms[i], cam, w.map, w.tick);
      if (w.goalM) goalLine(-w.goalM * PX_PER_M - cam, "\u0426\u0415\u041B\u042C " + w.goalM + " \u041C");
      if (w.recM) recLine(-w.recM * PX_PER_M - cam, "\u0420\u0415\u041A\u041E\u0420\u0414 " + w.recM);
      if (w.goalM) {
        var gy = -w.goalM * PX_PER_M - cam;
        if (gy > 8 && gy < LH - 8) showFirstTimeToast("goal");
      }
      if (w.recM) {
        var ry = -w.recM * PX_PER_M - cam;
        if (ry > 8 && ry < LH - 8) showFirstTimeToast("record");
      }
      for (i = 0; i < w.platforms.length; i++) {
        var brk = w.platforms[i];
        if (brk.type === "break" && !brk.broken) {
          var by2 = brk.y - cam;
          if (by2 > 8 && by2 < LH - 8) {
            showFirstTimeToast("break");
            break;
          }
        }
      }
      for (i = 0; i < w.coins.length; i++) {
        var cn = w.coins[i];
        if (!cn.taken && cn.y - cam > -8 && cn.y - cam < LH + 4) {
          withWrapX(cn.x, 6, function(xx) {
            drawCoin(ctx, xx, Math.round(cn.y - cam), w.tick + i * 3);
          });
        }
      }
      for (i = 0; i < w.items.length; i++) {
        var it = w.items[i];
        withWrapX(it.x, 14, function(xx) {
          var ox = it.x;
          it.x = xx;
          drawItem(ctx, it, cam, w.tick);
          it.x = ox;
        });
      }
      for (i = 0; i < w.monsters.length; i++) {
        var mo = w.monsters[i];
        var mw = MOBS[mo.kind] && MOBS[mo.kind].w || 12;
        withWrapX(mo.x, mw, function(xx) {
          var ox = mo.x;
          mo.x = xx;
          drawMob(ctx, mo, cam, w.map, w.freezeMobT > 0);
          mo.x = ox;
        });
      }
      for (i = 0; i < w.bullets.length; i++) {
        var bu = w.bullets[i];
        withWrapX(bu.x - 2, 5, function(xx) {
          var ox = bu.x;
          bu.x = xx + 2;
          drawBullet(ctx, bu, cam);
          bu.x = ox;
        });
      }
      for (i = 0; i < w.particles.length; i++) {
        var pt = w.particles[i];
        ctx.globalAlpha = clamp(pt.life / pt.max, 0, 1);
        withWrapX(pt.x, pt.s, function(xx) {
          rect(ctx, xx, pt.y - cam, pt.s, pt.s, pt.col);
        });
      }
      ctx.globalAlpha = 1;
      for (var wi = 0; wi < w.players.length; wi++) {
        var wp = w.players[wi];
        drawNinjaWalls(ctx, wp, wp.y - cam, cam, w.tick, wp.id === 0 && !wp.remote, LH);
      }
      var tags = [];
      for (var pi = w.players.length - 1; pi >= 0; pi--) {
        var p = w.players[pi];
        var sy = p.y - cam;
        if (sy < -22 || sy > LH + 10) continue;
        var blink = (w.tick + p.id * 41) % 170 < 6;
        var pose = p.alive ? poseOf(p) : "fall";
        var drawHeroAt = function(xx) {
          var ox = p.x;
          p.x = xx;
          drawFxBack(p, sy, cam);
          var faceDraw = p.wall === -1 ? 1 : p.wall === 1 ? -1 : p.face;
          ctx.save();
          if (p.id !== 0) ctx.globalAlpha = remoteAlpha();
          drawJumper(ctx, p.x, sy, p.look, faceDraw, pose, blink, p.alive);
          ctx.restore();
          if (p.id === 0) drawReadyPip(p, sy);
          drawFxFront(p, sy, w.tick);
          p.x = ox;
        };
        drawHeroAt(p.x);
        if (p.wallT <= 0 && p.x < 12) drawHeroAt(p.x + LW);
        if (p.wallT <= 0 && p.x > LW - PW - 12) drawHeroAt(p.x - LW);
        if (w.mode === "squad") tags.push({ p, x: p.x + 6, y: Math.round(sy) - 13 });
      }
      tags.sort(function(a2, b) {
        return b.y - a2.y;
      });
      for (i = 0; i < tags.length; i++) {
        var tg = tags[i];
        var isMe = tg.p.id === 0;
        var label = !tg.p.alive ? "\u0412\u042B\u0411\u042B\u041B" : isMe ? "\u25BC" : (tg.p.name || "\u0411\u041E\u0422").slice(0, 3);
        tg.w = textWidth(label, 1) + 4;
        for (var j = 0; j < i; j++) {
          var o = tags[j];
          if (Math.abs(o.x - tg.x) < (o.w + tg.w) / 2 + 1 && Math.abs(o.y - tg.y) < 10) tg.y = o.y - 10;
        }
        var lx = clamp(tg.x, tg.w / 2 + 1, LW - 12 - tg.w / 2);
        ctx.globalAlpha = isMe ? 0.85 : 0.5;
        if (!isMe) rect(ctx, Math.round(lx - tg.w / 2), tg.y, tg.w, 9, tg.p.alive ? C.navy : "#4a1020");
        drawText(ctx, label, lx, tg.y + (isMe ? 2 : 1), tg.p.alive ? isMe ? C.gold : C.cream : C.red, 1, "center");
        ctx.globalAlpha = 1;
      }
      ctx.restore();
      ctx.restore();
      var me = w.players[0];
      var wantPause = wantTouchPause();
      var meter = metersOf(me) + " \u041C";
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
        var line1 = !isPhone ? "\u2190 \u2192 \u0425\u041E\u0414" : "\u0422\u0410\u041F \u0421\u041B\u0415\u0412\u0410 / \u0421\u041F\u0420\u0410\u0412\u0410";
        var line2 = abHintRun ? !isPhone ? "\u2191 " + Hn.abName : "\u0421\u0412\u0410\u0419\u041F \u2191 " + Hn.abName : "";
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
          var liftLab = "\u041B\u0415\u0417\u042C \u0412\u0412\u0415\u0420\u0425!";
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
        drawBig(ctx, "\u041F\u0410\u0423\u0417\u0410", LW / 2, top + 8, C.gold, 2, "center", INK);
        var py = top + 28;
        if (resumeCd > 0) {
          drawText(ctx, String(resumeCd), LW / 2, py, C.gold, 3, "center");
          py += 26;
        } else if (land) {
          drawText(ctx, "\u041F\u041E\u0412\u0415\u0420\u041D\u0418 \u0422\u0415\u041B\u0415\u0424\u041E\u041D", LW / 2, py, C.cream, 1, "center");
          py += 14;
        }
        volRow("vol", px + 8, py, 136, "\u0413\u0420\u041E\u041C\u041A\u041E\u0421\u0422\u042C", masterVol, audioOn);
        py += 28;
        if (resumeCd > 0) btn("menu", px + 10, py, 132, 22, C.navy, "\u041C\u0415\u041D\u042E");
        else {
          btn("resume", px + 10, py, 132, 22, C.mint, "\u041F\u0420\u041E\u0414\u041E\u041B\u0416\u0418\u0422\u042C", INK);
          btn("menu", px + 10, py + 26, 132, 22, C.navy, "\u041C\u0415\u041D\u042E");
        }
        pauseLay = hits.filter(function(h) {
          return h.id === "vol" || h.id === "vol:mute" || h.id === "resume" || h.id === "menu";
        });
      }
    }
    function drawFxBack(p, sy, cam) {
      var cx = Math.round(p.x + 6), cy = Math.round(sy + 8), k;
      if (p.hookN > 0) {
        var hx = Math.round(p.htx + 6), hy = Math.round(p.hty - cam);
        var n = Math.max(2, Math.round(Math.abs(hy - sy) / 3));
        for (k = 0; k <= n; k++) rect(ctx, Math.round(cx + (hx - cx) * k / n), Math.round(sy + 2 + (hy - sy - 2) * k / n), 1, 1, k % 2 ? "#c8a070" : "#7a5030");
        rect(ctx, hx - 2, hy - 1, 5, 2, "#d8dce8");
        rect(ctx, hx - 2, hy - 3, 1, 2, "#d8dce8");
        rect(ctx, hx + 2, hy - 3, 1, 2, "#d8dce8");
      }
      if (p.grabT > 0 && p.grabMob) {
        for (k = 0; k < 4; k++) rect(ctx, cx - 5 + k * 3, cy - 2 + k % 2 * 3, 3, 2, "#3a9a2a");
      }
      if (p.magnetT > 0 && (ui >> 2) % 2) {
        ctx.globalAlpha = 0.35;
        for (k = 0; k < 8; k++) {
          var a2 = k * 0.785 + ui * 0.05;
          rect(ctx, cx + Math.cos(a2) * 15, cy + Math.sin(a2) * 15, 1, 1, "#ff5a62");
        }
        ctx.globalAlpha = 1;
      }
      if (p.teleFx > 0) {
        ctx.globalAlpha = p.teleFx / 18;
        for (k = 0; k < 10; k++) {
          var a22 = k * 0.63 + ui * 0.2, r2 = 18 - p.teleFx * 0.6;
          rect(ctx, cx + Math.cos(a22) * r2, cy + Math.sin(a22) * r2, 2, 2, k % 2 ? "#e8c8ff" : "#a060ff");
        }
        ctx.globalAlpha = 1;
      }
    }
    function drawDome(p, cx, cy, _tick) {
      if (!(p.domeT > 0)) return;
      var left = p.domeT;
      if (left <= 55 && (left >> 2) % 2 === 0) return;
      var rad = 16;
      solidRing(cx, cy, rad + 1, "#2a1048");
      solidRing(cx, cy, rad, "#f4e8ff");
      solidRing(cx, cy, rad - 1, "#7a4ec8");
    }
    function solidRing(cx, cy, r, col) {
      var n = Math.max(8, Math.round(r * 8));
      for (var k = 0; k < n; k++) {
        var a2 = k / n * Math.PI * 2;
        rect(ctx, Math.round(cx + Math.cos(a2) * r), Math.round(cy + Math.sin(a2) * r), 1, 1, col);
      }
    }
    function drawFxFront(p, sy, tick) {
      if (!p.alive) return;
      var cx = Math.round(p.x + 6), cy = Math.round(sy + 6);
      if (p.shieldT > 0) drawShieldAura(ctx, p, sy, tick);
      drawDome(p, cx, cy, tick);
      if (p.freezeT > 0) {
        ctx.globalAlpha = 0.45;
        rect(ctx, p.x - 2, sy - 6, PW + 4, PH + 6, "#c8f8ff");
        ctx.globalAlpha = 1;
      }
      if (p.rocketT > 0) {
        rect(ctx, cx - 2, sy + PH, 4, 3 + ui % 3, "#ffd046");
        rect(ctx, cx - 1, sy + PH + 3, 2, 3, "#ff7830");
      }
    }
    var BON_HUD = [["shieldT", "shield", 500], ["magnetT", "magnet", 450], ["rocketT", "rocket", 85], ["domeT", "shield", 200], ["wallT", "rocket", 300]];
    function drawBonusHud(me) {
      var x = 3, y = hudY(36);
      for (var i = 0; i < BON_HUD.length; i++) {
        var b = BON_HUD[i], t = me[b[0]];
        if (!(t > 0)) continue;
        if (b[0] === "domeT" || b[0] === "wallT") continue;
        rect(ctx, x, y, 16, 18, INK);
        rect(ctx, x + 1, y + 1, 14, 16, "#1a1430");
        drawHudIcon(ctx, b[1], x + 3, y + 2);
        var f = clamp(t / b[2], 0, 1);
        rect(ctx, x + 3, y + 14, 10, 2, "#2c2a52");
        rect(ctx, x + 3, y + 14, Math.max(1, Math.round(10 * f)), 2, ITEM_COL[b[1]] || C.cream);
        y += 20;
      }
    }
    function fillDisc(cx, cy, r, col) {
      for (var y = -r; y <= r; y++) {
        var hw = Math.floor(Math.sqrt(r * r - y * y));
        rect(ctx, cx - hw, cy + y, hw * 2 + 1, 1, col);
      }
    }
    function strokeArc(cx, cy, r, col, frac) {
      if (frac <= 0) return;
      var n = Math.max(20, r * 10), steps = Math.max(1, Math.round(n * Math.min(1, frac))), i;
      for (i = 0; i <= steps; i++) {
        var a2 = -Math.PI / 2 + i / n * Math.PI * 2;
        rect(ctx, Math.round(cx + Math.cos(a2) * r), Math.round(cy + Math.sin(a2) * r), 1, 1, col);
      }
    }
    function drawAbIcon(ab, x, y) {
      if (ab === "dash") {
        rect(ctx, x + 5, y + 1, 2, 1, "#7ad8ff");
        rect(ctx, x + 4, y + 2, 4, 2, "#7ad8ff");
        rect(ctx, x + 5, y + 4, 2, 3, "#c8f4ff");
        rect(ctx, x + 4, y + 7, 4, 2, "#ffd046");
        rect(ctx, x + 5, y + 9, 2, 2, "#ff7830");
        rect(ctx, x + 3, y + 8, 1, 2, "#ff7830");
        rect(ctx, x + 8, y + 8, 1, 2, "#ff7830");
      } else if (ab === "hook") {
        rect(ctx, x + 6, y + 1, 1, 7, "#c8a070");
        rect(ctx, x + 5, y + 1, 3, 1, "#c8a070");
        rect(ctx, x + 7, y + 8, 3, 1, "#d8dce8");
        rect(ctx, x + 9, y + 6, 1, 2, "#d8dce8");
        rect(ctx, x + 4, y + 8, 2, 2, "#d8dce8");
      } else if (ab === "wall") {
        rect(ctx, x + 1, y + 2, 2, 8, "#a8a8b8");
        rect(ctx, x + 9, y + 2, 2, 8, "#a8a8b8");
        rect(ctx, x + 4, y + 5, 4, 1, "#d82a2a");
        rect(ctx, x + 6, y + 3, 1, 5, "#d82a2a");
        rect(ctx, x + 5, y + 4, 3, 1, "#d82a2a");
      } else if (ab === "dome") {
        rect(ctx, x + 4, y + 2, 4, 1, "#7ad8ff");
        rect(ctx, x + 3, y + 3, 6, 1, "#7ad8ff");
        rect(ctx, x + 2, y + 4, 1, 5, "#7ad8ff");
        rect(ctx, x + 9, y + 4, 1, 5, "#7ad8ff");
        rect(ctx, x + 3, y + 9, 6, 1, "#7ad8ff");
        rect(ctx, x + 5, y + 5, 2, 2, "#c8f4ff");
      } else if (ab === "tele") {
        rect(ctx, x + 5, y + 2, 2, 2, "#e8c8ff");
        rect(ctx, x + 3, y + 5, 6, 2, "#a060ff");
        rect(ctx, x + 5, y + 8, 2, 2, "#e8c8ff");
        rect(ctx, x + 1, y + 5, 1, 1, "#e8c8ff");
        rect(ctx, x + 10, y + 6, 1, 1, "#e8c8ff");
        rect(ctx, x + 2, y + 2, 1, 1, "#c890ff");
        rect(ctx, x + 9, y + 9, 1, 1, "#c890ff");
      } else if (ab === "pound") {
        rect(ctx, x + 4, y + 1, 4, 1, "#d8dce8");
        rect(ctx, x + 3, y + 2, 6, 5, "#c02a2a");
        rect(ctx, x + 4, y + 3, 4, 3, "#ffd046");
        rect(ctx, x + 5, y + 7, 2, 1, "#c02a2a");
        rect(ctx, x + 4, y + 8, 4, 1, "#ffd046");
        rect(ctx, x + 5, y + 9, 2, 2, "#ffd046");
      }
    }
    function icoClock(x, y, col) {
      rect(ctx, x + 1, y, 5, 1, col);
      rect(ctx, x, y + 1, 7, 5, col);
      rect(ctx, x + 1, y + 6, 5, 1, col);
      rect(ctx, x + 1, y + 1, 5, 5, "#0c0818");
      rect(ctx, x + 3, y + 2, 1, 3, col);
      rect(ctx, x + 3, y + 4, 2, 1, col);
    }
    function ruCount(n, one, few, many) {
      var k = Math.abs(Math.floor(n));
      var m100 = k % 100, m10 = k % 10;
      var w = m100 >= 11 && m100 <= 14 ? many : m10 === 1 ? one : m10 >= 2 && m10 <= 4 ? few : many;
      return k + " " + w;
    }
    function drawChargeLine(cx, y, H, col) {
      var ic = H.charge;
      var chg = ic === "time" ? Math.round(H.need / 50) + " \u0421\u0415\u041A" : ic === "coins" ? ruCount(H.need, "\u041C\u041E\u041D\u0415\u0422\u0410", "\u041C\u041E\u041D\u0415\u0422\u042B", "\u041C\u041E\u041D\u0415\u0422") : ic === "height" ? H.need + " \u041C" : ruCount(H.need, "\u041C\u041E\u0411", "\u041C\u041E\u0411\u0410", "\u041C\u041E\u0411\u041E\u0412");
      var pre = "\u0417\u0410\u0420\u042F\u0414: ", iw = 8, gap = 2, tw = textWidth(pre, 1) + iw + gap + textWidth(chg, 1);
      var x0 = Math.round(cx - tw / 2);
      drawText(ctx, pre, x0, y, col, 1, "left");
      var ix = x0 + textWidth(pre, 1);
      if (ic === "time") icoClock(ix, y, col);
      else if (ic === "coins") drawCoin(ctx, ix, y + 1, ui);
      else if (ic === "height") drawText(ctx, "\u2191", ix, y, C.mint, 1, "left");
      else icoSkull(ix, y, col);
      drawText(ctx, chg, ix + iw + gap, y, col, 1, "left");
    }
    function icoSkull(x, y, col) {
      rect(ctx, x + 1, y, 5, 4, col);
      rect(ctx, x + 2, y + 4, 3, 2, col);
      rect(ctx, x + 2, y + 1, 1, 1, "#0c0818");
      rect(ctx, x + 4, y + 1, 1, 1, "#0c0818");
    }
    function drawAbRing(me) {
      if (!heroHasAb(me)) return;
      var H = CHARS[me.kind], dbg = window.__dbg || {}, rs = dbg.ring || {};
      var f = rs.f != null ? rs.f : clamp(me.abCharge / H.need, 0, 1);
      var ready = rs.state ? rs.state === "ready" : me.alive && me.abCharge >= H.need;
      var active = rs.state ? rs.state === "active" : !!(me.dashT > 0 || me.wall || me.domeT > 0 || me.poundT > 0);
      var rf = rs.refuse != null ? rs.refuse : abDenyT;
      var b = abBar();
      var shx = rf > 0 ? rf % 4 < 2 ? 1 : -1 : 0;
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
    function whyText(p) {
      var m = metersOf(p), w = p.why || "";
      if (w === "fall") return "\u0421\u041E\u0420\u0412\u0410\u041B\u0421\u042F \xB7 " + m + " \u041C";
      if (w === "shot") return "\u0421\u0411\u0418\u041B \u0412\u042B\u0421\u0422\u0420\u0415\u041B \xB7 " + m + " \u041C";
      if (w === "hole") return "\u0417\u0410\u0422\u042F\u041D\u0423\u041B\u0410 \u0414\u042B\u0420\u0410 \xB7 " + m + " \u041C";
      if (w === "left") return "\u0412\u042B\u0428\u0415\u041B \xB7 " + m + " \u041C";
      if (w.indexOf("mob:") === 0) {
        var mk = w.slice(4);
        var mo = MOBS[mk] || {};
        var nm = mo.name || "\u041C\u041E\u0411";
        if (mk === "hole") nm = "\u0414\u042B\u0420\u0410";
        if (m >= 1e4) {
          if (mk === "snake") nm = "\u041B\u0418\u0410\u041D\u0410";
          if (mk === "frost") nm = "\u0414\u0423\u0425";
        }
        return (mo.g === "f" ? "\u0421\u0411\u0418\u041B\u0410 " : "\u0421\u0411\u0418\u041B ") + nm + " \xB7 " + m + " \u041C";
      }
      return w ? w + " \xB7 " + m + " \u041C" : "";
    }
    function nextHeroNeed() {
      for (var i = 0; i < CHARS.length; i++) if (!heroOwned(i)) return { i, H: CHARS[i], left: Math.max(0, CHARS[i].price - save.coins) };
      return null;
    }
    function limitLabel(code) {
      if (code === "HEIGHT_MIN") return "\u0417\u0410 \u0412\u042B\u0421\u041E\u0422\u0423 \xB7 \u0421 100 \u041C";
      if (code === "HEIGHT_CAP") return "\u0412\u042B\u0421\u041E\u0422\u0410 \u0421\u0420\u0415\u0417\u0410\u041D\u0410";
      if (code === "COINS_CAP") return "\u041C\u041E\u041D\u0415\u0422\u042B \u0421\u0420\u0415\u0417\u0410\u041D\u042B";
      if (code === "BONUS_CAP") return "\u0411\u041E\u041D\u0423\u0421 \u0421\u0420\u0415\u0417\u0410\u041D";
      if (code === "DUPLICATE") return "\u0423\u0416\u0415 \u0417\u0410\u0421\u0427\u0418\u0422\u0410\u041D";
      if (code === "OFFLINE") return "\u041D\u0415\u0422 \u0421\u0415\u0422\u0418";
      if (code === "FAST") return "\u0421\u041B\u0418\u0428\u041A\u041E\u041C \u0411\u042B\u0421\u0422\u0420\u041E";
      if (code === "REJECTED") return "\u041D\u0415 \u041F\u0420\u0418\u041D\u042F\u0422\u041E";
      return "";
    }
    function pushRes(id, x, y, w, h) {
      resultLay.push({ id, x, y, w, h });
    }
    function eveningCount() {
      try {
        var S = typeof NET !== "undefined" && NET.session ? NET.session : null;
        if (!world.net || !S || !S.rounds || !S.rounds.length) return 0;
        var n = 0, k;
        for (k in S.names) n++;
        if (!n) {
          for (k in S.wins) n++;
        }
        return n;
      } catch (_e) {
        return 0;
      }
    }
    function drawEveningCompact(x, y) {
      var S = NET.session, pids = [], k;
      for (k in S.names) pids.push(k);
      if (!pids.length) {
        for (k in S.wins) if (pids.indexOf(k) < 0) pids.push(k);
      }
      pids.sort(function(a2, b) {
        return (S.wins[b] || 0) - (S.wins[a2] || 0);
      });
      var h = 11 + pids.length * 9;
      box(ctx, x, y, 152, h, C.navy, C.gold);
      pushRes("evening", x, y, 152, h);
      drawText(ctx, "\u0421\u0427\u0401\u0422 \u0412\u0415\u0427\u0415\u0420\u0410 \xB7 " + S.rounds.length + " \u0420\u0410\u0423\u041D\u0414", LW / 2, y + 2, C.gold, 1, "center");
      for (var i = 0; i < pids.length; i++) {
        var pid = pids[i];
        var lineY = y + 11 + i * 9;
        drawText(ctx, String(S.names[pid] || "\u0418\u0413\u0420\u041E\u041A").slice(0, 8), x + 6, lineY, C.cream, 1, "left");
        drawText(ctx, (S.wins[pid] || 0) + "\u041F  " + (S.best[pid] || 0) + "\u041C", x + 146, lineY, C.cream, 1, "right");
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
      var hdRes = header("\u0418\u0422\u041E\u0413\u0418", 2);
      var list = world.players.slice().sort(function(a2, b2) {
        return a2.place - b2.place;
      });
      var squad = world.mode === "squad";
      var me = world.players[0], mtr = metersOf(me), why = whyText(me);
      var note = limitLabel(world.limited);
      var mi2 = mapIdx(world.map), M2 = MAPS[mi2];
      var hasGoal = !!(M2.goal && mi2 + 1 < MAPS.length);
      var met = hasGoal && mapBest(mi2) >= M2.goal;
      var evN = eveningCount();
      var nh = nextHeroNeed();
      var y0 = hdRes.bottom + 4;
      var btnY = LH - 64 - bot;
      var full = list.length * (squad ? 28 : 36) + (why ? 18 : 0) + (hasGoal ? met ? 26 : 32 : 0) + (note ? 72 : 60) + (evN ? 13 + evN * 11 + 6 : 0) + 16 + (nh ? 26 : 0);
      var compact = full > btnY - 4 - y0;
      var y = y0;
      var limitY = btnY - 4;
      for (var i = 0; i < list.length; i++) {
        var p = list[i];
        var rowH = compact ? 13 : squad ? 25 : 33;
        var step = compact ? 14 : squad ? 28 : 36;
        if (y + step > limitY) break;
        var fill = p.place === 1 ? "#6a4a10" : p.place === 2 ? "#3a4050" : p.place === 3 ? "#4a3020" : C.navy;
        box(ctx, x, y, 152, rowH, fill, p.id === 0 ? C.gold : C.cream);
        pushRes("place" + p.place, x, y, 152, rowH);
        if (compact) {
          drawText(ctx, String(p.place), x + 8, y + 3, p.place === 1 ? C.gold : C.cream, 1, "center");
          var head = rankHeadOf(p.look);
          if (head) {
            ctx.save();
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(head, x + 16, y + 1, 12, 12);
            ctx.restore();
          }
          drawText(ctx, String(p.name || "").slice(0, 8) + " " + metersOf(p) + " \u041C", x + 30, y + 3, C.cream, 1, "left");
        } else {
          drawText(ctx, String(p.place), x + 10, y + rowH / 2 - 6, p.place === 1 ? C.gold : C.cream, 2, "center");
          drawJumper(ctx, x + 22, y + Math.round(rowH / 2 - 8), p.look, 1, "idle", false, true);
          drawText(ctx, p.name + (p.id === 0 && squad ? " (\u0422\u042B)" : ""), x + 42, y + 4, C.cream, 1, "left");
          drawText(ctx, metersOf(p) + " \u041C", x + 42, y + 14, C.cream, 1, "left");
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
      if (hasGoal && y + (compact ? 16 : met ? 26 : 32) <= limitY) {
        var nxt = MAPS[mi2 + 1], b = mapBest(mi2);
        if (met) {
          var gh = compact ? 14 : 22;
          addHit("camp", x, y, 152, gh);
          box(ctx, x, y, 152, gh, C.navy, C.mint);
          pushRes("goal", x, y, 152, gh);
          drawText(ctx, nxt.name + ": \u041C\u041E\u0416\u041D\u041E \u041E\u0422\u041A\u0420\u042B\u0422\u042C", LW / 2, y + (compact ? 4 : 7), C.mint, 1, "center");
          y += compact ? 16 : 26;
        } else if (!compact) {
          box(ctx, x, y, 152, 28, C.navy, C.gold);
          pushRes("goal", x, y, 152, 28);
          drawText(ctx, "\u0414\u041E " + TO[mi2 + 1], x + 6, y + 3, C.cream, 1, "left");
          drawText(ctx, b + "/" + M2.goal + " \u041C", x + 146, y + 3, C.cream, 1, "right");
          bar(x + 6, y + 16, 140, 6, b / M2.goal, C.gold);
          y += 32;
        } else {
          box(ctx, x, y, 152, 14, C.navy, C.gold);
          pushRes("goal", x, y, 152, 14);
          drawText(ctx, "\u0414\u041E " + TO[mi2 + 1] + " " + b + "/" + M2.goal, LW / 2, y + 4, C.cream, 1, "center");
          y += 16;
        }
      }
      var rec = save.mapBest[world.map] || world.best || 0;
      var ah = compact ? note ? 40 : 32 : note ? 68 : 56;
      if (y + ah + 4 <= limitY) {
        box(ctx, x, y, 152, ah, C.navy, C.gold);
        pushRes("award", x, y, 152, ah);
        drawText(ctx, "\u0412\u042B\u0421\u041E\u0422\u0410 " + mtr + " \u041C", x + 6, y + 3, C.cream, 1, "left");
        coinsLabel(x + 146, y + 3, world.earnH || 0, "right");
        drawText(ctx, "\u0421\u041E\u0411\u0420\u0410\u041D\u041E", x + 6, y + (compact ? 12 : 15), C.cream, 1, "left");
        coinsLabel(x + 146, y + (compact ? 12 : 15), world.earnC || 0, "right");
        var dur = 700, nowA = typeof performance !== "undefined" ? performance.now() : Date.now();
        if (coinT0 < 0) coinT0 = nowA;
        var kk = coinSkip ? 1 : Math.max(0, Math.min(1, (nowA - coinT0) / dur));
        kk = 1 - (1 - kk) * (1 - kk);
        var shownEarn = Math.round((world.earned || 0) * kk);
        var shownTot = (world.coinFrom != null ? world.coinFrom : save.coins - (world.earned || 0)) + shownEarn;
        if (kk < 1 && ui % 4 === 0) hopSfx("tick");
        if (compact) {
          drawText(ctx, "+" + shownEarn + " \u2192 " + shownTot, LW / 2, y + 21, C.gold, 1, "center");
          if (note) drawText(ctx, note, LW / 2, y + 30, C.cream, 1, "center");
        } else {
          rect(ctx, x + 6, y + 25, 140, 1, "#5a4a7a");
          drawText(ctx, "+" + shownEarn + " \u2192 " + shownTot, LW / 2, y + 30, C.gold, 2, "center");
          if (note) drawText(ctx, note, LW / 2, y + 48, C.cream, 1, "center");
        }
        y += compact ? ah + 3 : note ? 72 : 60;
      }
      if (evN && y + (compact ? 11 + evN * 9 + 3 : 13 + evN * 11 + 6) <= limitY) {
        if (compact) y = drawEveningCompact(x, y);
        else {
          var ey = y;
          y = NET.drawEvening(ctx, x, y);
          pushRes("evening", x, ey, 152, y - ey - 6);
        }
      }
      var recH = world.newBest ? 13 : 11;
      if (y + recH <= limitY) {
        if (world.newBest) {
          box(ctx, x, y, 152, 13, C.navy, C.gold);
          pushRes("record", x, y, 152, 13);
          drawText(ctx, "\u041D\u041E\u0412\u042B\u0419 \u0420\u0415\u041A\u041E\u0420\u0414 \u041A\u0410\u0420\u0422\u042B " + rec + " \u041C", LW / 2, y + 3, C.gold, 1, "center");
          y += 15;
        } else {
          pushRes("record", x, y, 152, 9);
          drawText(ctx, "\u0420\u0415\u041A\u041E\u0420\u0414 \u041A\u0410\u0420\u0422\u042B " + rec + " \u041C", LW / 2, y + 1, C.cream, 1, "center");
          y += 12;
        }
      }
      if (nh && y + (compact ? 14 : 22) <= limitY) {
        var nhH = compact ? 12 : 22;
        if (nh.left === 0 && !compact) {
          addHit("shop", x, y, 152, 22);
          box(ctx, x, y, 152, 22, C.navy, C.mint);
          pushRes("need", x, y, 152, 22);
          drawText(ctx, "\u0425\u0412\u0410\u0422\u0410\u0415\u0422 \u041D\u0410 " + HTO[nh.i] + "!", LW / 2, y + 7, C.mint, 1, "center");
        } else if (!compact) {
          box(ctx, x, y, 152, 22, C.navy, C.coral);
          pushRes("need", x, y, 152, 22);
          drawText(ctx, "\u0414\u041E " + HTO[nh.i] + " \u041E\u0421\u0422\u0410\u041B\u041E\u0421\u042C \u25CF " + nh.left, LW / 2, y + 3, C.cream, 1, "center");
          var runsLeft = Math.max(1, Math.ceil(nh.left / Math.max(8, world.earned || 8)));
          drawText(ctx, "\u0415\u0429\u0401 " + ruCount(runsLeft, "\u0417\u0410\u0411\u0415\u0413", "\u0417\u0410\u0411\u0415\u0413\u0410", "\u0417\u0410\u0411\u0415\u0413\u041E\u0412"), LW / 2, y + 12, C.gold, 1, "center");
        } else {
          box(ctx, x, y, 152, nhH, C.navy, C.coral);
          pushRes("need", x, y, 152, nhH);
          drawText(ctx, "\u0414\u041E " + HTO[nh.i] + " \u25CF " + nh.left, LW / 2, y + 3, C.cream, 1, "center");
        }
      }
      var lab = squad ? "\u0420\u0415\u0412\u0410\u041D\u0428 \u25B6" : "\u0415\u0429\u0401 \u0420\u0410\u0417 \u25B6";
      btn("rematch", x, btnY, 152, 28, C.mint, lab, INK, 2);
      btn("menu", x, btnY + 32, 72, 22, C.navy, "\u041C\u0415\u041D\u042E");
      btn("shop", x + 80, btnY + 32, 72, 22, C.navy, "\u041C\u0410\u0413\u0410\u0417\u0418\u041D");
      pushRes("rematch", x, btnY, 152, 28);
      pushRes("menu", x, btnY + 32, 72, 22);
      pushRes("shop", x + 80, btnY + 32, 72, 22);
    }
    function drawFontSheet() {
      hits = [];
      dimView(ctx, "#120c28");
      drawText(ctx, "\u0428\u0420\u0418\u0424\u0422", LW / 2, 6, C.gold, 2, "center");
      var words = ["\u041D\u0418\u041D\u0414\u0417\u042F", "\u041C\u0415\u041D\u042E", "\u041A\u041E\u0421\u041C\u041E\u0429\u0418\u0422", "\u0417\u0410\u0420\u042F\u0414 40%", "\u041A\u0423\u041F\u0418\u0422\u042C \u25CF 80", "\u0414\u041E\u0419\u0414\u0418 \u0414\u041E \u0426\u0415\u041B\u0418 \u2192", "\u0418\u0413\u0420\u0410\u0422\u042C \u25B6", "\u0415\u0429\u0401 \u0420\u0410\u0417 \u25B6", "\u0421 \u0411\u041E\u0422\u0410\u041C\u0418", "\u2713 \u0426\u0415\u041B\u042C 500 \u041C"];
      for (var i = 0; i < words.length; i++) drawText(ctx, words[i], 6, 28 + i * 12, C.cream, 1, "left");
      var keys = Object.keys(FONT), x = 6, y = 28 + words.length * 12 + 8;
      for (var k = 0; k < keys.length; k++) {
        drawText(ctx, keys[k], x, y, C.mint, 1, "left");
        x += 12;
        if (x > LW - 12) {
          x = 6;
          y += 12;
        }
      }
      btn("back", colX() + 26, LH - 28, 100, 20, C.navy, "\u041D\u0410\u0417\u0410\u0414");
    }
    function frame(now) {
      if (!running) return;
      if (lastT < 0) lastT = now;
      var dt = Math.min(0.05, Math.max(0, (now - lastT) / 1e3));
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
        if (now - resumeAt >= 1e3) {
          resumeCd--;
          resumeAt = now;
          if (resumeCd <= 0) {
            paused = false;
            landPause = false;
            manualPause = false;
            acc = 0;
            uiAcc = 0;
            lastT = now;
          }
        }
      }
      bindTgInsets();
      HUD_INSET = phase === "play" ? Math.round(insetTopCss() / Math.max(0.01, cssScale || 1)) : 0;
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
        if (world.phase === "results") {
          payout();
          phase = "results";
        }
      } else acc = 0;
      ctx.imageSmoothingEnabled = false;
      hits = [];
      screenLay = [];
      if (phase === "menu") drawMenu();
      else if (phase === "shop") drawShop();
      else if (phase === "camp") drawCamp();
      else if (phase === "lobby") drawLobby();
      else if (phase === "results") drawResults();
      else if (phase === "font") drawFontSheet();
      else if (phase === "net") {
        hits = [];
        NET.draw(netApi);
        drawFlash();
      }
      if (phase !== "play") drawWallet();
      else {
        drawPlay();
        if (world && world.net) NET.overlay(netApi, world);
      }
      if (showProf && phase !== "play") drawProfileCard();
      if (phoneLand && phase !== "play") {
        dimView(ctx, "rgba(8,6,20,0.55)");
        box(ctx, colX(), LH / 2 - 28, 152, 40, C.navy, C.gold);
        drawText(ctx, "\u041F\u041E\u0412\u0415\u0420\u041D\u0418 \u0422\u0415\u041B\u0415\u0424\u041E\u041D", LW / 2, LH / 2 - 14, C.cream, 1, "center");
        hits = [];
      }
      if (PHONE_INT && FIELD_OY > 0) {
        var lb = mixHex(skyAt(menuMap(), 0)[0], INK, LETTERBOX_MIX);
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = lb;
        ctx.fillRect(0, 0, DEV_W, FIELD_OY);
        ctx.fillRect(0, FIELD_OY + LH * pScale, DEV_W, DEV_H - FIELD_OY - LH * pScale);
        ctx.restore();
      }
      if (netFixedLW() !== netLW || (fieldLocked && phase === "play" && !isWide) !== lastFill) resize();
      hopMusicTick();
      if (audioUnlocked) hopMusic(musicCue(phase, phase === "play" && world && world.map || save.bg || "city"));
      if (running && !driving) raf = requestAnimationFrame(frame);
    }
    var netApi = {
      ctx,
      btn,
      header,
      belowBand,
      markBox,
      colX,
      say,
      openMaps,
      heroOwned,
      bg: function() {
        drawBg(ctx, MENU_CAM(), ui, menuMap(), true);
        dimView(ctx, "rgba(18,14,44,0.32)");
      },
      ui: function() {
        return ui;
      },
      save: function() {
        return save;
      },
      saveNow: function() {
        writeSave(save);
      },
      world: function() {
        return world;
      },
      phase: function() {
        return phase;
      },
      setPhase: function(p) {
        phase = p;
      },
      goMenu,
      bots: function() {
        activate("mp");
      },
      startNet
    };
    NET.bind(netApi);
    NET.tryResume(netApi);
    var profileApi = {
      save: function() {
        return save;
      },
      saveNow: function() {
        writeSave(save);
      },
      say: function(s) {
        say(s);
      },
      apply: function(prof, wRef, awarded, effectiveCoins, limited) {
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
          var pend = {};
          try {
            if (typeof PROFILE !== "undefined" && PROFILE && PROFILE.pendingBuyKeys) pend = PROFILE.pendingBuyKeys() || {};
          } catch (_e) {
          }
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
      acc = 0;
      uiAcc = 0;
      lastT = -1;
      if (!document.hidden && audioUnlocked) {
        ensureCtx();
        if (audioOn && masterVol > 0) {
          var id = musicCur || musicCue(phase === "play" ? "play" : "menu", save && save.bg || "city");
          musicCur = "";
          stopMusic();
          hopMusic(id);
        } else applyMaster();
      }
      if (document.hidden && phase === "play") paused = true;
    }
    var envSide = {};
    function insetSideCss(side) {
      var sum = 0;
      try {
        var tg = window.Telegram && window.Telegram.WebApp;
        if (tg) {
          var c = tg.contentSafeAreaInset, s = tg.safeAreaInset;
          sum = s && Number(s[side]) || 0;
          sum += c && Number(c[side]) || 0;
        }
      } catch (_e) {
      }
      if (sum > 0) return sum;
      if (envSide[side] == null) {
        envSide[side] = 0;
        try {
          var cap = side.charAt(0).toUpperCase() + side.slice(1);
          var probe = document.createElement("div");
          probe.style.cssText = "position:absolute;padding-" + side + ":env(safe-area-inset-" + side + ")";
          document.body.appendChild(probe);
          envSide[side] = parseFloat(getComputedStyle(probe)["padding" + cap]) || 0;
          probe.remove();
        } catch (_e2) {
          envSide[side] = 0;
        }
      }
      return envSide[side];
    }
    function insetTopCss() {
      return insetSideCss("top");
    }
    function edgePad(side) {
      return 5 + Math.round(insetSideCss(side) / Math.max(0.01, cssScale || 1));
    }
    function pauseBox() {
      return { x: LW - edgePad("right") - 22, y: hudY(0), w: 22, h: 22 };
    }
    function bindTgInsets() {
      if (tgInsetBound) return;
      var w = window;
      var tg = w.Telegram && w.Telegram.WebApp;
      if (!tg) {
        if (w.__tgReady && w.__tgReady.then && !w.__hopInsetWait) {
          w.__hopInsetWait = true;
          w.__tgReady.then(function() {
            bindTgInsets();
          });
        }
        return;
      }
      tgInsetBound = true;
      var bump = function() {
        resize();
      };
      try {
        if (tg.onEvent) {
          tg.onEvent("safeAreaChanged", bump);
          tg.onEvent("contentSafeAreaChanged", bump);
          tg.onEvent("fullscreenChanged", bump);
        }
      } catch (_e) {
      }
      try {
        var bb = tg.BackButton;
        if (bb && bb.onClick) bb.onClick(function() {
          if (showProf) showProf = false;
        });
      } catch (_e2) {
      }
    }
    function wantTouchPause() {
      if (isPhone || !isWide) return true;
      try {
        return !!(navigator && navigator.maxTouchPoints);
      } catch (_e) {
        return false;
      }
    }
    var ptrRoot = wrap || canvas;
    resize();
    window.addEventListener("resize", resize);
    document.addEventListener("fullscreenchange", function() {
      if (cinemaOn && !document.fullscreenElement) {
        cinemaOn = false;
        resize();
      }
    });
    var onOrientationChange = function() {
      resize();
      setTimeout(resize, 300);
      setTimeout(resize, 800);
    };
    window.addEventListener("orientationchange", onOrientationChange);
    if (window.visualViewport) window.visualViewport.addEventListener("resize", resize);
    var onCtx = function(e) {
      e.preventDefault();
    };
    var onKD = function(e) {
      onKey(e, true);
    };
    var onKU = function(e) {
      onKey(e, false);
    };
    var noScroll = function(e) {
      e.preventDefault();
    };
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
    var onTouch = function(e) {
      audioUnlock();
      noScroll(e);
    };
    canvas.addEventListener("touchstart", onTouch, { passive: false });
    if (ptrRoot !== canvas) ptrRoot.addEventListener("touchstart", noScroll, { passive: false });
    raf = requestAnimationFrame(frame);
    return {
      destroy: function() {
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
      getPhase: function() {
        return phase;
      },
      dbgToast: function(s) {
        if (world) {
          world.toast = s;
          world.toastT = 70;
        }
      },
      getWorld: function() {
        return world;
      },
      net: NET,
      profile: typeof PROFILE !== "undefined" ? PROFILE : null,
      getSave: function() {
        return save;
      },
      getFlash: function() {
        return flash;
      },
      getSize: function() {
        return { lw: LW, lh: LH, scale: SCALE, pScale, pScaleY, cssScale, dpr: Math.max(1, window.devicePixelRatio || 1), isWide, isPhone, phoneLand, paused, landPause, manualPause, resumeCd, cw: canvas.width, ch: canvas.height, viewPad: VIEW_PAD, viewCrop: VIEW_CROP, viewBot: VIEW_BOT, viewShift: VIEW_SHIFT, fieldOx: FIELD_OX, fieldOy: FIELD_OY, phoneInt: PHONE_INT, devW: DEV_W, devH: DEV_H };
      },
      tap: function(id) {
        activate(id);
      },
      audioUnlock: function() {
        audioUnlock();
      },
      sfxPlay: function(k) {
        hopSfx(k);
      },
      sfxStats: function() {
        return sfxStat;
      },
      sfxReady: function(k) {
        return !!sfxBuf[k];
      },
      screen: function(s) {
        phase = s;
      },
      start: function(m, seed, mapId) {
        mode = m || "solo";
        if (mapId) save.bg = mapId;
        startRun(seed);
      },
      setDir: function(d) {
        held.kl = d < 0;
        held.kr = d > 0;
      },
      setAutoPlay: function(on) {
        autoPlay = !!on;
      },
      ability: function() {
        abTap = true;
      },
      setHero: function(k) {
        save.char = k;
      },
      addCoins: function(n) {
        save.coins += n;
        writeSave(save);
      },
      forceResults: function() {
        if (world) {
          finish(world);
          payout();
          phase = "results";
        }
      },
      setVolume: function(v) {
        setMasterVol(v);
        save.vol = masterVol;
        save.music = masterVol;
        save.sfxVol = masterVol;
        writeSave(save);
      },
      audioProbe: function() {
        return readAudioProbe();
      },
      menuLayout: function() {
        return menuLay;
      },
      resultsBoxes: function() {
        return resultLay;
      },
      screenLayout: function() {
        var w = [];
        if (menuLay && menuLay.chip && menuLay.chip.w) w.push({ id: "chip", x: menuLay.chip.x, y: menuLay.chip.y, w: menuLay.chip.w, h: menuLay.chip.h });
        if (menuLay && menuLay.coins && menuLay.coins.w) w.push({ id: "coins", x: menuLay.coins.x, y: menuLay.coins.y, w: menuLay.coins.w, h: menuLay.coins.h });
        return { phase, wallet: w, boxes: screenLay.slice() };
      },
      pauseLayout: function() {
        return pauseLay;
      },
      pixelize: function(img) {
        var cv = pixelizeImage(img);
        return cv ? cv.toDataURL("image/png") : "";
      },
      pause: function(on) {
        paused = !!on;
        manualPause = !!on;
        acc = 0;
        uiAcc = 0;
        lastT = -1;
      },
      warp: function(m) {
        if (!world) return;
        generateUntil(world, -m * PX_PER_M - LH);
        for (var i = 0; i < world.players.length; i++) {
          var p = world.players[i];
          p.y = -m * PX_PER_M - PH - i * 30;
          p.vy = -6;
          p.maxH = -(p.y + PH);
          p.camY = p.y - LH * 0.42;
        }
        world.cameraY = world.players[0].camY;
        world.tick = Math.max(world.tick, 200);
        var cut = world.cameraY + LH + 80;
        world.platforms = world.platforms.filter(function(a2) {
          return a2.y < cut;
        });
        world.monsters = world.monsters.filter(function(a2) {
          return a2.y < cut;
        });
        world.coins = world.coins.filter(function(a2) {
          return a2.y < cut;
        });
      },
      simTicks: function(n) {
        if (!world) return null;
        var was = paused;
        paused = false;
        for (var i = 0; i < n && world.phase === "play"; i++) tickWorld(world, collectInputs());
        paused = was;
        if (world.phase === "results") {
          payout();
          phase = "results";
        }
        return { phase: world.phase, tick: world.tick, players: world.players.map(function(p) {
          return { name: p.name, alive: p.alive, m: metersOf(p), why: p.why };
        }) };
      },
      advanceTime: function(seconds, hz) {
        if (raf) {
          cancelAnimationFrame(raf);
          raf = 0;
        }
        driving = true;
        acc = 0;
        uiAcc = 0;
        lastT = 0;
        var ui0 = ui;
        var n = Math.max(0, Math.round(seconds * hz));
        var step = 1e3 / hz;
        for (var i = 0; i < n; i++) frame((i + 1) * step);
        driving = false;
        if (running) raf = requestAnimationFrame(frame);
        ui0 = ui - ui0;
        var me = world && world.players[0];
        var platVx = 0;
        if (world) {
          for (var j = 0; j < world.platforms.length; j++) if (world.platforms[j].type === "move") {
            platVx = world.platforms[j].vx;
            break;
          }
        }
        return {
          tick: world ? world.tick : 0,
          ui: ui0,
          flashT,
          m: me ? metersOf(me) : 0,
          x: me ? me.x : 0,
          y: me ? me.y : 0,
          charge: me ? me.abCharge : 0,
          platVx,
          phase
        };
      },
      checkGroundMobs: function() {
        return unsupportedMobs(world);
      },
      inspectMap: function(seed, toM, mapId) {
        var w = createWorld(seed, "solo", 0, makeLook(0, "base", "none"), mapId || save.bg);
        generateUntil(w, -toM * PX_PER_M - 200);
        return {
          jumpH: JUMP_H,
          gapCap: GAP_CAP,
          rowSep: ROW_SEP,
          xSep: X_SEP,
          platforms: w.platforms.map(function(p) {
            return { x: p.x, y: p.y, w: p.w, type: p.type, spring: p.spring, row: p.row, vx: p.vx };
          }),
          monsters: w.monsters.map(function(m) {
            return { kind: m.kind, x: m.x, y: m.y, w: m.w, h: m.h, b: m.b, topY: m.topY, home: !!m.home };
          }),
          unsupported: unsupportedMobs(w),
          coins: w.coins.map(function(c) {
            return { x: c.x, y: c.y };
          }),
          items: w.items.map(function(c) {
            return { kind: c.kind, x: c.x, y: c.y };
          })
        };
      }
    };
  }
  (function() {
    var c = document.getElementById("c");
    if (c) {
      window.__hoppak = startHoppak(c);
    }
  })();
})();
