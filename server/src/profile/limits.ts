/** Starting sanity limits for the guest profile. Labelled assumptions, not measured live data. */

/** Max coins accepted in a one-time local-save migration. */
export const MIGRATE_COINS_MAX = 8000;

/** Highest height (metres) accepted from a run. Space has no goal; 20_000 is a hard cap. */
export const RUN_HEIGHT_MAX = 20000;

/** Max coins collected during one run (map pickups). */
export const RUN_COINS_MAX = 80;

/** Max bonus coins from one run (chests etc.). */
export const RUN_BONUS_MAX = 40;

/** Height-to-coin conversion, same formula as the current client: floor(height / 25). */
export const COINS_PER_HEIGHT = 25;

/** Hard cap on coins granted for a single /run/finish, after the formula. */
export const RUN_AWARD_MAX = 200;

/** Minimum interval between two /run/finish calls for the same player. */
export const FINISH_INTERVAL_MS = 8000;

/** Max coins granted to one player in a rolling hour. */
export const HOUR_AWARD_MAX = 400;

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

export function mergePurchases(a: Record<string, number>, b: Record<string, number>): Record<string, number> {
  return { ...a, ...b };
}

export function awardForRun(height: number, runCoins: number, bonusCoins: number): number {
  const h = clamp(Math.floor(height), 0, RUN_HEIGHT_MAX);
  const c = clamp(Math.floor(runCoins), 0, RUN_COINS_MAX);
  const b = clamp(Math.floor(bonusCoins), 0, RUN_BONUS_MAX);
  return clamp(Math.floor(h / COINS_PER_HEIGHT) + c + b, 0, RUN_AWARD_MAX);
}

export function clamp(n: number, lo: number, hi: number): number {
  if (!Number.isFinite(n)) return lo;
  return Math.max(lo, Math.min(hi, n));
}
