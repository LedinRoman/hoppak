const pp = require('/tmp/pp/node_modules/puppeteer-core');
(async () => {
  const b = await pp.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'], headless: 'new' });
  const pg = await b.newPage(); await pg.goto('file:///workspace/jumper/game/index.html'); await new Promise(r => setTimeout(r, 400));
  const r = await pg.evaluate(() => {
    const out = {};
    for (const m of ['city', 'jungle', 'ice', 'lava', 'aqua', 'space']) {
      const agg = {}, items = {}; let itemN = 0, overlapP = 0, overlapM = 0;
      for (const seed of [11, 22, 33, 44, 55]) {
        const d = window.__hoppak.inspectMap(seed, 2000, m);
        d.monsters.forEach(x => { agg[x.kind] = (agg[x.kind] || 0) + 1; });
        d.items.forEach(it => { items[it.kind] = (items[it.kind] || 0) + 1; itemN++;
          d.platforms.forEach(p => { if (it.x < p.x + p.w && it.x + 10 > p.x && it.y < p.y + 5 && it.y + 10 > p.y) overlapP++; });
          d.monsters.forEach(mo => { if (it.x < mo.x + mo.w + 2 && it.x + 10 > mo.x - 2 && it.y < mo.y + mo.h + 2 && it.y + 10 > mo.y - 2) overlapM++; }); });
      }
      for (const k in agg) agg[k] = +(agg[k] / 5).toFixed(1);
      out[m] = { mobsPerRun2000m: agg, bonusesPerRun: +(itemN / 5).toFixed(1), kinds: items, overlapPlat: overlapP, overlapMob: overlapM };
    }
    return out;
  });
  console.log(JSON.stringify(r, null, 1)); await b.close();
})();
