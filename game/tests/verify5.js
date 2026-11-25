const pp = require('/tmp/pp/node_modules/puppeteer-core');
const fs = require('fs');
const OUT = '/workspace/jumper/game/screens/v054/verify5/';
fs.mkdirSync(OUT, { recursive: true });
const SIZES = [
  [360, 640, '360x640'],
  [375, 667, '375x667'],
  [390, 844, '390x844'],
  [430, 932, '430x932']
];
(async () => {
  const b = await pp.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--allow-file-access-from-files'], headless: 'new' });
  const pg = await b.newPage();
  const errs = [];
  pg.on('pageerror', e => errs.push('pageerror ' + e.message));
  pg.on('console', m => { if (m.type() === 'error') errs.push('console ' + m.text()); });
  async function open(w, h) {
    await pg.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
    await pg.goto('file:///workspace/jumper/game/index.html');
    await pg.evaluate(() => localStorage.clear());
    await pg.reload();
    await new Promise(r => setTimeout(r, 500));
  }
  const H = (f, ...a) => pg.evaluate(f, ...a);
  const shot = async (n) => { await new Promise(r => setTimeout(r, 200)); await pg.screenshot({ path: OUT + n + '.png' }); };
  function countHeroPixels() {
    return pg.evaluate(() => {
      const c = document.querySelector('canvas');
      const g = c.getContext('2d');
      const sz = window.__hoppak.getSize();
      const sc = sz.scale, lw = sz.lw, lh = sz.lh;
      // hero card roughly center
      const x = Math.round((lw / 2 - 30) * sc), y = Math.round((80) * sc);
      const img = g.getImageData(x, y, Math.round(60 * sc), Math.round(80 * sc));
      let n = 0;
      for (let i = 0; i < img.data.length; i += 4) {
        const r = img.data[i], gv = img.data[i+1], b = img.data[i+2], a = img.data[i+3];
        if (a < 200) continue;
        const navy = r < 60 && gv < 50 && b < 100;
        const wood = r > 140 && r < 230 && gv > 90 && gv < 180 && b < 90;
        if (!navy && !wood) n++;
      }
      return n;
    });
  }

  await open(390, 844);
  const size0 = await H(() => window.__hoppak.getSize());
  await shot('01_menu');
  await H(() => window.__hoppak.tap('font')); await shot('00_font');
  await H(() => window.__hoppak.tap('back'));
  await H(() => { const s = window.__hoppak.getSave(); s.mapBest.city = 620; s.best = 620; s.coins = 500; });
  await shot('01_menu_progress');
  await H(() => window.__hoppak.tap('camp')); await shot('02_campaign');
  // closed volcano-like: ice is index 2, should be locked (city done, jungle not owned)
  await H(() => window.__hoppak.tap('camp:2')); await shot('03_campaign_locked_card');
  await H(() => window.__hoppak.tap('back')); // dismiss? back hits overlay
  await H(() => { window.__hoppak.tap('back'); window.__hoppak.tap('camp'); });
  // Row buy: two taps on КУПИТЬ, no modal, toast under the header
  await H(() => window.__hoppak.tap('camp:open:1'));
  await shot('03_campaign_row_confirm');
  await H(() => window.__hoppak.tap('camp:open:1'));
  await shot('04_campaign_toast');
  await H(() => { const s = window.__hoppak.getSave(); s.owned['map:jungle'] = 0; s.coins = 500; s.mapBest.city = 620; });
  await H(() => window.__hoppak.tap('camp:1')); await shot('03_campaign_can_open');
  await H(() => window.__hoppak.tap('camp:open'));
  await shot('03_campaign_confirm');
  await H(() => window.__hoppak.tap('camp:open'));
  await shot('04_campaign_opened');
  await H(() => window.__hoppak.tap('camp:1')); await shot('04_campaign_card');
  await H(() => { window.__hoppak.tap('back'); window.__hoppak.tap('shop'); });
  const spritePix = [];
  for (let k = 0; k < 6; k++) {
    await H(k => window.__hoppak.tap('hero:' + k), k);
    await shot('05_shop_hero_' + k);
    spritePix.push(await countHeroPixels());
  }
  // purchase states: pirate costs 150, drop coins
  await H(() => { const s = window.__hoppak.getSave(); s.coins = 20; window.__hoppak.tap('hero:1'); });
  await shot('05_shop_nomoney');
  await H(() => { window.__hoppak.getSave().coins = 200; });
  await new Promise(r => setTimeout(r, 100));
  await shot('05_shop_buy');
  await H(() => window.__hoppak.tap('hero:act'));
  await shot('05_shop_confirm');

  const res = {};
  const names = ['pilot', 'pirate', 'ninja', 'robot', 'mage', 'knight'];
  for (let k = 0; k < 6; k++) {
    const r = await H(k => {
      const g = window.__hoppak; g.setHero(k); g.start('solo', 1234 + k, ['city', 'jungle', 'ice', 'lava', 'aqua', 'space'][k]);
      g.simTicks(60); g.warp(300); g.simTicks(20);
      const w = g.getWorld(), p = w.players[0];
      p.abCharge = 999; const y0 = p.y, x0 = p.x;
      if (k === 2) { p.x = 2; p.vx = -2; }
      g.ability(); g.simTicks(1);
      const after = { dy: Math.round(p.y - y0), dashT: p.dashT, hookN: p.hookN, wallT: p.wallT, domeT: p.domeT, poundT: p.poundT, teleFx: p.teleFx, toast: w.toast, charge: p.abCharge };
      if (k === 2) { g.setDir(-1); g.simTicks(8); after.wall = p.wall; after.xEdge = Math.round(p.x); after.vySlide = +p.vy.toFixed(2); g.setDir(1); g.simTicks(1); after.kickVx = +p.vx.toFixed(2); after.kickVy = +p.vy.toFixed(2); g.setDir(0); }
      return after;
    }, k);
    res[names[k]] = r;
    await shot('06_ability_' + names[k]);
  }
  await H(() => { const g = window.__hoppak; g.setHero(0); g.start('solo', 4242, 'city'); g.simTicks(40); const w = g.getWorld(); w.players[0].abCharge = 999; g.simTicks(2); });
  await shot('10_ability_bar');
  await H(() => { const g = window.__hoppak; g.warp(480); g.simTicks(5); });
  await shot('10_goal_line');

  await H(() => { const g = window.__hoppak; g.tap('menu'); g.tap('mp'); g.tap('lmap:next'); });
  await shot('07_lobby');
  await H(() => { const g = window.__hoppak; g.tap('go'); g.setAutoPlay(true); g.simTicks(80); });
  await shot('08_squad_play');
  await H(() => { const g = window.__hoppak; g.simTicks(1400); g.setAutoPlay(false); const w = g.getWorld(); if (w && w.phase === 'play') { w.bonusCoins = 25; w.players[0].why = w.players[0].why || 'mob:bob'; g.forceResults(); } else if (w) { w.bonusCoins = 25; } });
  await shot('09_results');
  await H(() => { const g = window.__hoppak; g.setHero(0); g.start('solo', 99, 'city'); g.simTicks(40); g.warp(355); const w = g.getWorld(); w.players[0].why = 'fall'; w.bonusCoins = 10; g.forceResults(); });
  await shot('09_results_solo');
  await H(() => {
    const g = window.__hoppak;
    const s = g.getSave();
    s.coins = 150; s.owned = { 'hero:pilot': 1 }; s.mapBest = { city: 200 }; s.best = 200; s.bg = 'city';
    g.setHero(0); g.start('solo', 77, 'city'); g.simTicks(20); g.warp(120);
    const w = g.getWorld(); w.players[0].why = 'fall'; w.bonusCoins = 8; g.forceResults();
  });
  await shot('09_results_afford');
  await H(() => {
    const g = window.__hoppak;
    const s = g.getSave();
    s.coins = 80; s.owned = { 'hero:pilot': 1 }; s.mapBest = { city: 500 }; s.best = 500; s.bg = 'city';
    g.setHero(0); g.start('solo', 88, 'city'); g.simTicks(20); g.warp(520);
    const w = g.getWorld(); w.players[0].why = 'fall'; w.bonusCoins = 4; g.forceResults();
  });
  await shot('09_results_mapready');

  // four viewports of key screens
  const sizes = {};
  for (const [w, h, name] of SIZES) {
    await open(w, h);
    const sz = await H(() => window.__hoppak.getSize());
    sizes[name] = sz;
    /* v0.57: integer k, canvas covers the device, 160×346 field letterboxed, never cropped. */
    const k = sz.pScale, ox = sz.fieldOx || 0, oy = sz.fieldOy || 0;
    const fieldOk = sz.lw === 160 && sz.lh === 346
      && Number.isInteger(k) && k >= 1
      && k === Math.max(1, Math.min(Math.floor(sz.cw / 160), Math.floor(sz.ch / 346)))
      && ox >= 0 && oy >= 0
      && ox + 160 * k <= sz.cw && oy + 346 * k <= sz.ch
      && Math.abs(ox - Math.floor((sz.cw - 160 * k) / 2)) < 1
      && Math.abs(oy - Math.floor((sz.ch - 346 * k) / 2)) < 1;
    sizes[name].integerOk = fieldOk;
    sizes[name].fieldOk = fieldOk;
    await H(() => { const s = window.__hoppak.getSave(); s.mapBest.city = 355; s.best = 355; s.coins = 80; });
    await shot('size_' + name + '_menu');
    await H(() => window.__hoppak.tap('camp')); await shot('size_' + name + '_campaign');
    await H(() => { window.__hoppak.tap('back'); window.__hoppak.tap('shop'); }); await shot('size_' + name + '_shop');
    await H(() => { window.__hoppak.setHero(0); window.__hoppak.start('solo', 7, 'city'); window.__hoppak.simTicks(30); const wr = window.__hoppak.getWorld(); wr.players[0].abCharge = 200; window.__hoppak.simTicks(2); });
    await shot('size_' + name + '_play');
  }

  const spriteFail = spritePix.some(n => n < 80);
  const sizeFail = Object.values(sizes).some(s => !s.integerOk);
  const ground = await H(() => {
    const maps = ['city', 'jungle', 'ice', 'lava', 'aqua', 'space'];
    const out = {};
    for (const map of maps) {
      const spawn = [];
      let snakes = 0, plat = 0;
      for (let seed = 1; seed <= 50; seed++) {
        const d = window.__hoppak.inspectMap(seed * 9973, 2500, map);
        if (d.unsupported && d.unsupported.length) spawn.push({ seed, uns: d.unsupported });
        (d.monsters || []).forEach(m => {
          if (m.kind === 'snake') snakes++;
          if (m.b === 'walk' || m.b === 'hop' || m.b === 'throw' || m.b === 'spit' || m.b === 'snake') plat++;
        });
      }
      const g = window.__hoppak;
      g.setHero(0); g.start('solo', 11, map);
      g.simTicks(40); g.warp(800);
      const mid = [];
      for (let t = 0; t < 300; t++) {
        g.simTicks(1);
        const b = g.checkGroundMobs();
        if (b && b.length) mid.push({ t, b });
      }
      out[map] = { spawnBad: spawn.length, midBad: mid.length, snakes, plat, sample: spawn.slice(0, 3), midSample: mid.slice(0, 3) };
    }
    return out;
  });
  const groundFail = Object.values(ground).some(g => g.spawnBad > 0 || g.midBad > 0);
  const out = { res, errs, spritePix, spriteFail, size0, sizes, sizeFail, ground, groundFail };
  console.log(JSON.stringify(out, null, 1));
  if (spriteFail) throw new Error('hero sprites missing in shop: ' + JSON.stringify(spritePix));
  if (errs.length) throw new Error('errors: ' + errs.join(' | '));
  if (sizeFail) throw new Error('integer scale failed: ' + JSON.stringify(sizes));
  if (groundFail) throw new Error('ground mobs unsupported: ' + JSON.stringify(ground));
  await b.close();
})();
