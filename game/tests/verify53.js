const pp = require('/tmp/pp/node_modules/puppeteer-core');
const fs = require('fs');
const OUT = '/workspace/jumper/game/screens/v053/';
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const b = await pp.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--allow-file-access-from-files'], headless: 'new' });
  const pg = await b.newPage();
  const errs = [];
  pg.on('pageerror', e => errs.push('pageerror ' + e.message));
  pg.on('console', m => { if (m.type() === 'error') errs.push('console ' + m.text()); });

  async function open(w, h, dpr) {
    await pg.setViewport({ width: w, height: h, deviceScaleFactor: dpr || 1 });
    await pg.goto('file:///workspace/jumper/game/index.html');
    await pg.evaluate(() => localStorage.clear());
    await pg.reload();
    await new Promise(r => setTimeout(r, 400));
  }
  const H = (f, ...a) => pg.evaluate(f, ...a);
  const shot = async (n) => { await new Promise(r => setTimeout(r, 120)); await pg.screenshot({ path: OUT + n + '.png' }); };

  // --- Hz invariance: 10s of game time ---
  await open(390, 844, 1);
  const hzRuns = {};
  for (const hz of [60, 120, 144, 240]) {
    hzRuns[hz] = await H((hz) => {
      const g = window.__hoppak;
      g.setHero(0);
      g.start('solo', 4242, 'city');
      const w = g.getWorld(), p = w.players[0];
      p.abCharge = 0;
      g.setDir(1);
      const r = g.advanceTime(10, hz);
      return r;
    }, hz);
  }
  const base = hzRuns[60];
  const pct = (a, b) => (b === 0 ? (a === 0 ? 0 : 100) : Math.abs(a - b) / Math.abs(b) * 100);
  const hzCmp = {};
  let hzFail = false;
  for (const hz of [60, 120, 144, 240]) {
    const r = hzRuns[hz];
    const d = {
      tick: r.tick, tickPct: pct(r.tick, base.tick),
      m: r.m, mPct: pct(r.m, base.m),
      x: r.x, xPct: pct(r.x, base.x),
      y: r.y, yPct: pct(r.y, base.y),
      charge: r.charge, chargePct: pct(r.charge, base.charge),
      ui: r.ui, uiPct: pct(r.ui, base.ui),
      platVx: r.platVx, platVxPct: pct(r.platVx, base.platVx)
    };
    hzCmp[hz] = d;
    if (d.tickPct > 2 || d.mPct > 2 || d.xPct > 3 || d.chargePct > 2 || d.uiPct > 2) hzFail = true;
  }

  // --- sizes + shots ---
  const views = [
    [360, 640, 1, '360x640'],
    [375, 667, 1, '375x667'],
    [390, 844, 1, '390x844'],
    [430, 932, 1, '430x932'],
    [1280, 800, 1, '1280x800'],
    [1920, 1080, 1, '1920x1080'],
    [390, 844, 2, '390x844_dpr2'],
    [390, 844, 3, '390x844_dpr3']
  ];
  const sizes = {};
  for (const [w, h, dpr, name] of views) {
    await open(w, h, dpr);
    const sz = await H(() => window.__hoppak.getSize());
    const cssW = sz.lw * sz.cssScale, cssH = sz.lh * sz.cssScale;
    sz.ok = sz.lw === 160 && sz.lh >= 280 && sz.lh <= 346
      && sz.pScale === Math.floor(sz.pScale) && sz.pScale >= 1
      && sz.cw === sz.lw * sz.pScale && sz.ch === sz.lh * sz.pScale
      && Math.abs(sz.dpr - dpr) < 0.01
      && cssW <= w + 0.51 && cssH <= h + 0.51;
    sizes[name] = sz;
    const needShot = ['360x640', '390x844', '1280x800', '1920x1080'].includes(name);
    if (needShot) await shot(name + '_menu');
    if (needShot) {
      await H(() => { window.__hoppak.setHero(0); window.__hoppak.start('solo', 7, 'city'); window.__hoppak.simTicks(40); });
      await shot(name + '_play');
    }
  }
  const sizeFail = Object.values(sizes).some(s => !s.ok);

  const out = { hzRuns, hzCmp, hzFail, sizes, sizeFail, errs };
  console.log(JSON.stringify(out, null, 1));
  if (errs.length) throw new Error('errors: ' + errs.join(' | '));
  if (hzFail) throw new Error('hz mismatch: ' + JSON.stringify(hzCmp));
  if (sizeFail) throw new Error('size fail: ' + JSON.stringify(sizes));
  await b.close();
})();
