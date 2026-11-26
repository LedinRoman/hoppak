/* BUG-51 / BUG-55-follow-up layout check for the results screen (no servers needed).
   Loads game/index.html (offline build of the current src) in headless Chrome and renders:
     - offline bot squad results            -> screens/bluegreen/10_offline_bot_results.png
     - online 4p results + update banner    -> screens/bluegreen/09_bug51_4p_results_banner.png  (synthetic session)
     - online 7 names + update banner       -> screens/bluegreen/11_results_7_names_banner.png
   and asserts that the evening score never reaches the update banner (y=258) and never exceeds 4 lines.
   Usage: node game/tests/results-layout.mjs [--no-shots]
*/
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { mkdirSync } from 'node:fs';
const __dirname = dirname(fileURLToPath(import.meta.url));
const GAME = resolve(__dirname, '..');
const SHOTS = join(GAME, 'screens', 'bluegreen');
const NO_SHOTS = process.argv.includes('--no-shots');
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright-core')); }
catch { ({ chromium } = require('/usr/local/lib/pnpm/5/.pnpm/playwright-core@1.59.1/node_modules/playwright-core')); }

let fails = 0;
const check = (ok, m) => { console.log((ok ? 'PASS ' : 'FAIL ') + m); if (!ok) fails++; };
mkdirSync(SHOTS, { recursive: true });

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
const BANNER_Y = 258;

async function open() {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => { console.log('pageerror', e.message); fails++; });
  await page.goto(pathToFileURL(join(GAME, 'index.html')).href);
  await page.waitForFunction(() => window.__hoppak);
  await page.waitForTimeout(500);
  return { ctx, page };
}

/* ---------- offline bot squad ---------- */
{
  const { ctx, page } = await open();
  await page.evaluate(() => { __hoppak.start('squad', 4242); });
  await page.waitForTimeout(300);
  await page.evaluate(() => { const w = __hoppak.getWorld(); w.players.forEach((p, i) => { p.maxH = 160 - i * 30; p.place = i + 1; p.alive = false; p.why = i === 0 ? 'fall' : ''; }); __hoppak.forceResults(); });
  await page.waitForTimeout(1200);
  const st = await page.evaluate(() => ({ phase: __hoppak.getPhase(), mode: __hoppak.getWorld().mode, n: __hoppak.getWorld().players.length, net: !!__hoppak.getWorld().net, banner: __hoppak.net.shouldShowBanner() }));
  check(st.phase === 'results' && st.mode === 'squad' && st.n === 4 && !st.net && !st.banner, `offline bot squad results render (${JSON.stringify(st)})`);
  if (!NO_SHOTS) await page.screenshot({ path: join(SHOTS, '10_offline_bot_results.png') });
  await ctx.close();
}

/* ---------- online results with N names in the evening ---------- */
async function online(names, shot) {
  const { ctx, page } = await open();
  await page.evaluate((nm) => {
    __hoppak.start('squad', 777);
    const w = __hoppak.getWorld();
    w.net = true;
    const N = __hoppak.net;
    N.you = 'p1';
    N.session = { rounds: [], names: {}, wins: {}, best: {} };
    nm.forEach((n, i) => { N.session.names['p' + (i + 1)] = n; N.session.wins['p' + (i + 1)] = nm.length - i > 3 ? 0 : 3 - (nm.length - i - 1) % 3; N.session.best['p' + (i + 1)] = 40 + i * 3; });
    N.session.rounds.push({ round: 1, ranking: [] }, { round: 2, ranking: [] });
    N.shouldShowBanner = () => true;
    w.players.forEach((p, i) => { p.maxH = 90 - i * 20; p.place = i + 1; p.alive = false; p.why = i === 0 ? 'fall' : ''; if (i === 0) p.name = nm[0]; });
    window.__evEnd = -1;
    const orig = N.drawEvening;
    N.drawEvening = function (c, x, y) { const r = orig.call(N, c, x, y); window.__evEnd = r; window.__evStart = y; return r; };
    __hoppak.forceResults();
  }, names);
  await page.waitForTimeout(1200);
  const r = await page.evaluate(() => ({ phase: __hoppak.getPhase(), start: window.__evStart, end: window.__evEnd }));
  const lines = Math.round((r.end - r.start - 2 - 11) / 9);
  check(r.phase === 'results' && r.end > 0, `${names.length} names: results rendered, evening box y ${r.start}..${r.end}`);
  check(r.end <= BANNER_Y - 2, `${names.length} names: evening score ends at y=${r.end} (banner at ${BANNER_Y})`);
  check(lines <= 4, `${names.length} names: evening score uses ${lines} lines (max 4)`);
  if (shot && !NO_SHOTS) await page.screenshot({ path: join(SHOTS, shot) });
  await ctx.close();
}
await online(['АНЯ', 'ВЕРА', 'ГЛЕБ', 'БОРЯ'], '09_bug51_4p_results_banner.png');
await online(['АНЯ', 'ВЕРА', 'ГЛЕБ', 'БОРЯ', 'ДИМА'], null);
await online(['АНЯ', 'ВЕРА', 'ГЛЕБ', 'БОРЯ', 'ДИМА', 'ЛЕНА', 'ОЛЕГ'], '11_results_7_names_banner.png');
await online(['ВЕРА', 'ГЛЕБ', 'БОРЯ', 'ДИМА', 'ЛЕНА', 'ОЛЕГ'], null);

await browser.close();
console.log(fails ? `results-layout: ${fails} FAILED` : 'results-layout: all PASS');
process.exit(fails ? 1 : 0);
