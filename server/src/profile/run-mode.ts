/** Canonical player_run.mode values. Stored as varchar, not a PG enum, so a new
 *  mode (e.g. ranked) is a code change rather than a new Postgres type. */
export const RUN_MODES = [
  'not_available',
  'solo',
  'coop',
  'coop_bots',
  'coop_mixed',
] as const;

export type RunMode = (typeof RUN_MODES)[number];

/** Used when a current client omits mode. */
export const RUN_MODE_DEFAULT: RunMode = 'solo';

const LEGACY_MODES: Record<string, RunMode> = {
  squad: 'not_available',
  online: 'not_available',
};

/**
 * Parse a finish-run mode.
 * Missing / empty -> 'solo' (a current client forgot the field).
 * Canonical value -> itself.
 * Cached old clients sending 'squad' or 'online' -> 'not_available' (do not 400).
 * Anything else -> null, and the API responds 400 INVALID_MODE.
 */
export function parseRunMode(raw: unknown): RunMode | null {
  if (raw === undefined || raw === null || raw === '') return RUN_MODE_DEFAULT;
  if (typeof raw !== 'string') return null;
  if ((RUN_MODES as readonly string[]).indexOf(raw) >= 0) return raw as RunMode;
  if (Object.prototype.hasOwnProperty.call(LEGACY_MODES, raw)) return LEGACY_MODES[raw];
  return null;
}
