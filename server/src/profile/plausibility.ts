/**
 * Theoretical ceilings for one run, seeded into rules_plausibility.
 * The table is the source of truth at runtime. These numbers are the
 * conservative fallback when a row is missing, and the seed the migration inserts.
 *
 * Climb (best hero + boosts), from the client constants (not changed here):
 * - rocket vy = -8.2 px/tick for 85 ticks — game/src/02_world.tsx (rocketT), BONUSES rocket t:85 in game/src/01_core.tsx
 *   8.2 * (1/STEP=50) / PX_PER_M(8) = 51.25 m/s while the rocket is on
 * - mage teleport up to 1.5 * JUMP_H, JUMP_H = JUMP_V^2 / (2*GRAVITY)
 *   JUMP_V=-5.55, GRAVITY=0.19, PX_PER_M=8 — game/src/01_core.tsx
 *   ≈ 15.20 m, counted once per 2 s on top of the rocket (abilities do not stack forever)
 * - margin 20%
 * - height cap RUN_HEIGHT_MAX 20000 — server/src/profile/limits.ts
 *
 * Coins: up to 3 pickups on a row when the vertical gap is ≥ 30 px — game/src/02_world.tsx genRow.
 * 30 px / PX_PER_M = 3.75 m → 0.8 coins/m, times 1.2 → 0.96 coins per metre of the height ceiling.
 *
 * Height pay floor(m/25) from 100 m is awarded separately and is not part of max_coins.
 * Treasures: first bonus 160–240 m, then every 200–300 m — nextBonusM in game/src/02_world.tsx.
 * Face value BIGCOIN = 25 — game/src/01_core.tsx. Ceiling uses the shortest gap (160, then 200) times 1.2.
 */

export type PlausRule = {
  map: string;
  tSeconds: number;
  maxCoins: number;
  maxHeightM: number;
  maxTreasures: number;
  margin: number;
};

export const PLAUS_TIMES = [30, 60, 120, 180, 300, 600];
export const PLAUS_MAPS = ['city', 'jungle', 'ice', 'lava', 'aqua', 'space'];

export function plausBuckets(): PlausRule[] {
  const rocketMs = (8.2 * 50) / 8;
  const jumpH = (5.55 * 5.55) / (2 * 0.19);
  const teleM = (1.5 * jumpH) / 8;
  const rate = (rocketMs + teleM / 2) * 1.2;
  const rows: PlausRule[] = [];
  for (const map of PLAUS_MAPS) {
    for (const t of PLAUS_TIMES) {
      const h = Math.min(20000, Math.ceil(rate * t));
      const raw = h < 160 ? 0 : 1 + Math.floor((h - 160) / 200);
      rows.push({
        map,
        tSeconds: t,
        maxHeightM: h,
        maxCoins: Math.ceil(0.96 * h),
        maxTreasures: Math.ceil(raw * 1.2),
        margin: 1.2,
      });
    }
  }
  return rows;
}

/** Smallest bucket whose t_seconds is at least the run duration. Longer runs use the last bucket. */
export function bucketFor(rows: PlausRule[], map: string, seconds: number): PlausRule | null {
  const t = Math.max(0, Number(seconds) || 0);
  const mine = rows.filter((r) => r.map === map);
  const use = mine.length ? mine : rows.filter((r) => r.map === '*');
  if (!use.length) return null;
  const sorted = use.slice().sort((a, b) => a.tSeconds - b.tSeconds);
  for (const r of sorted) if (r.tSeconds >= t) return r;
  return sorted[sorted.length - 1];
}
