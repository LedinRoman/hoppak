/** Starting sanity limits for the guest profile. Labelled assumptions, not measured live data. */

/** Max coins accepted in a one-time local-save migration. */
export const MIGRATE_COINS_MAX = 8000;

/** Highest height (metres) accepted from a run. Space has no goal; 20_000 is a hard cap. */
export const RUN_HEIGHT_MAX = 20000;

/**
 * Max map-pickup coins in one run.
 * Generator ceiling up to RUN_HEIGHT_MAX (01_core / 02_world, physics unchanged):
 * PX_PER_M = 8, the 3-coin cluster needs gap >= 30px and maxGap is always >= 40,
 * so every row can be 30px (3.75 m) and drop 3 coins. Bonus rows are mandatory
 * (no skip): latest first bonus is 240 m, then +300 m, which is 66 rows with no
 * map coins. The other 5_267 rows × 3 = 15_801. The old cap of 80 cut ordinary runs.
 */
export const RUN_COINS_MAX = 15801;

/**
 * Max bonus coins in one run. A bonus row is at least every 200 m after the first
 * at 160 m (nextBonusM), and each КЛАД is BIGCOIN = 25. Up to 20_000 m that is
 * 100 × 25 = 2_500. The old cap of 40 was one or two chests.
 */
export const RUN_BONUS_MAX = 2500;

/** Height-to-coin conversion: floor(height / 25), and only when height >= HEIGHT_AWARD_MIN. */
export const COINS_PER_HEIGHT = 25;

/** Metres required before the height part of the award is paid. */
export const HEIGHT_AWARD_MIN = 100;

/** Server-authoritative item prices, matching client CHARS (01_core.tsx:44-51) and MAPS (01_core.tsx:263-270). */
export const ITEM_PRICES: Record<string, number> = {
  'char:0': 0,
  'char:1': 150,
  'char:2': 200,
  'char:3': 240,
  'char:4': 280,
  'char:5': 320,
  'map:city': 0,
  'map:jungle': 80,
  'map:ice': 100,
  'map:lava': 120,
  'map:aqua': 140,
  'map:space': 160,
};

export function sanitizePurchases(raw: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  const re = /^(hero|char|map):[a-z0-9_-]+$/i;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!re.test(k)) continue;
    const n = typeof v === 'number' ? v : v ? 1 : 0;
    if (n > 0) out[k] = 1;
  }
  return out;
}

export function sanitizeRunId(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const s = raw.trim();
  if (!s || s.length > 64) return null;
  if (!/^[a-zA-Z0-9_.:-]+$/.test(s)) return null;
  return s;
}

export function mergePurchases(a: Record<string, number>, b: Record<string, number>): Record<string, number> {
  return { ...a, ...b };
}

export function awardForRun(
  height: number,
  runCoins: number,
  bonusCoins: number,
): { awarded: number; limited?: string } {
  const rawH = Math.floor(Number(height) || 0);
  const rawC = Math.floor(Number(runCoins) || 0);
  const rawB = Math.floor(Number(bonusCoins) || 0);
  const h = clamp(rawH, 0, RUN_HEIGHT_MAX);
  const c = clamp(rawC, 0, RUN_COINS_MAX);
  const b = clamp(rawB, 0, RUN_BONUS_MAX);
  const heightPay = h >= HEIGHT_AWARD_MIN ? Math.floor(h / COINS_PER_HEIGHT) : 0;
  let limited: string | undefined;
  if (rawH > RUN_HEIGHT_MAX) limited = 'HEIGHT_CAP';
  else if (rawC > RUN_COINS_MAX) limited = 'COINS_CAP';
  else if (rawB > RUN_BONUS_MAX) limited = 'BONUS_CAP';
  else if (h < HEIGHT_AWARD_MIN) limited = 'HEIGHT_MIN';
  return { awarded: heightPay + c + b, limited };
}

export function clamp(n: number, lo: number, hi: number): number {
  if (!Number.isFinite(n)) return lo;
  return Math.max(lo, Math.min(hi, n));
}
